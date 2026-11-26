"""Run against a fresh private PostgreSQL cluster. Never accepts a database URL."""
import os
import secrets
import socket
import subprocess
import tempfile
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from uuid import UUID

import psycopg

ROOT = Path(__file__).resolve().parents[1]
ADMIN, OWNER, OTHER, CUSTOMER, LEAD, CHAT, PENDING, OTHER_CHAT = map(UUID, [
    f"00000000-0000-4000-8000-{n:012d}" for n in range(1, 9)
])
PHONE = "+12025550123"
RECEIVE = "select * from public.receive_bot_message(%s,%s,%s,%s,%s,%s,%s,%s)"
RESERVE = "select id, bot_slot, send_state, reply_kind from public.reserve_bot_reply(%s,%s,%s,%s,%s)"
CLAIM = "select claimed from public.claim_bot_reply(%s,%s)"
RESULT = "select id, history_position from public.record_bot_reply_result(%s,%s,%s,%s)"
HISTORY = "select message_id,sender_kind from public.bot_message_history(%s,%s,%s,%s)"
COUNTS = "select reserved_slots,sent_count from public.get_bot_conversation(%s)"


def rows(db, statement, args=()):
    return db.execute(statement, args).fetchall()


def expect_error(code, db, statement, args=()):
    try:
        with db.transaction():
            db.execute(statement, args)
    except psycopg.Error as error:
        if error.sqlstate == code:
            return
        raise
    raise AssertionError(f"Missing expected SQLSTATE {code}: {statement}")


def fixture(db):
    for uid, name, role in [(ADMIN, "Admin", "admin"), (OWNER, "Owner", "seller"), (OTHER, "Other", "seller")]:
        email = f"{name}@demo.example"
        db.execute("insert into auth.users(id,email) values (%s,%s)", (uid, email))
        db.execute("""insert into public.profiles(id,full_name,role,is_enabled,accepts_assignments,contact_phone,contact_email)
                      values (%s,%s,%s,true,true,%s,%s)""", (uid, name, role, PHONE, email))
    db.execute("insert into public.customers(id,phone_e164) values (%s,%s)", (CUSTOMER, PHONE))
    db.execute("insert into public.leads(id,customer_id,source) values (%s,%s,'demo')", (PENDING, CUSTOMER))
    assert rows(db, "select assigned_to from public.leads where id=%s", (PENDING,)) == [(None,)]
    db.execute("""insert into public.leads(id,customer_id,source,assigned_to,waiting_since)
                  values (%s,%s,'demo',%s,null)""", (LEAD, CUSTOMER, OWNER))


def inbound(key, chat=CHAT, lead=LEAD, body="Hola", provider="demo", business="demo-line"):
    return (chat, lead, "demo", PHONE, provider, business, key, body)


def overlap(db, connect, statement, first, second, *, second_error=None):
    # Hold the first write open until pg_stat_activity proves the second writer is waiting.
    with connect() as writer, connect() as contender, ThreadPoolExecutor(1) as pool:
        for session in (writer, contender):
            session.execute("set role service_role")
            session.execute("set statement_timeout='10s'")
        pid = contender.info.backend_pid
        with writer.transaction():
            one = rows(writer, statement, first)
            future = pool.submit(rows, contender, statement, second)
            deadline = time.monotonic() + 5
            while rows(db, "select wait_event_type from pg_stat_activity where pid=%s", (pid,)) != [("Lock",)]:
                if future.done() or time.monotonic() > deadline:
                    raise AssertionError("Second connection did not wait for the first transaction")
                time.sleep(0.02)
        try:
            two = future.result(timeout=10)
        except psycopg.Error as error:
            if second_error is None or error.sqlstate != second_error:
                raise
            return one, None
        assert second_error is None, f"Expected contender to fail with {second_error}"
        return one, two


def exercise(db, connect):
    fixture(db)
    first, again = overlap(db, connect, RECEIVE, inbound("ext-1"), inbound("ext-1"))
    _, msg1, pos1, created = first[0]
    assert created and again == [(CHAT, msg1, pos1, False)]
    with connect() as bot:
        bot.execute("set role service_role")
        expect_error("22023", bot, RECEIVE, inbound("ext-1", body="otro cuerpo"))
        expect_error("22023", bot, RECEIVE, inbound("ext-1", chat=OTHER_CHAT, lead=PENDING))
        assert rows(bot, "select count(*) from public.conversations where id=%s", (OTHER_CHAT,)) == [(0,)]
        wrong_source = list(inbound("ext-1"))
        wrong_source[2] = "whatsapp_bot"
        expect_error("22023", bot, RECEIVE, wrong_source)
        pending_message = rows(bot, RECEIVE, inbound("ext-1", OTHER_CHAT, PENDING, business="demo-line-2"))[0][1]
        expect_error("22023", bot, RESERVE, (CHAT, pending_message, "Hola", "question", 0))
        assert rows(bot, RECEIVE, inbound("ext-1", UUID(int=90), PENDING, provider="demo-2"))[0][-1]
        replies = overlap(db, connect, RESERVE, (CHAT, msg1, "respuesta", "question", 0), (CHAT, msg1, "respuesta", "question", 0))
        reply1, slot, state, kind = replies[0][0]
        assert replies[0] == replies[1] and (slot, state, kind) == (1, "pending", "question")
        assert rows(bot, COUNTS, (CHAT,)) == [(1, 0)]
        msg2 = rows(bot, RECEIVE, inbound("ext-2"))[0][1]
        assert rows(bot, HISTORY, (CHAT, None, 0, 100)) == [(msg1, "customer"), (msg2, "customer")]
        expect_error("22023", bot, RESULT, (CHAT, reply1, "sent", "provider-out-1"))
        claims = overlap(db, connect, CLAIM, (CHAT, reply1), (CHAT, reply1))
        assert claims == ([(True,)], [(False,)])
        confirmed = rows(bot, RESULT, (CHAT, reply1, "sent", "provider-out-1"))
        assert rows(bot, RESULT, (CHAT, reply1, "sent", "provider-out-1")) == confirmed
        expect_error("22023", bot, RESULT, (CHAT, reply1, "failed", None))
        assert rows(bot, COUNTS, (CHAT,)) == [(1, 1)]
        msg3 = rows(bot, RECEIVE, inbound("ext-3"))[0][1]
        msg4 = rows(bot, RECEIVE, inbound("ext-4"))[0][1]
        # Dos preguntas distintas se decidieron sobre el mismo cupo disponible.
        observed = rows(bot, COUNTS, (CHAT,))[0][0]
        assert observed == 1
        second, _ = overlap(db, connect, RESERVE, (CHAT, msg2, "segunda", "question", observed),
                            (CHAT, msg3, "otra pregunta", "question", observed), second_error="PT409")
        reply2, slot, state, kind = second[0]
        assert (slot, state, kind) == (2, "pending", "question")
        assert not rows(bot, "select id from public.messages where reply_to=%s", (msg3,))
        assert rows(bot, COUNTS, (CHAT,)) == [(2, 1)]
        # Actualizar sólo el contador sin recalcular el tipo sigue siendo inválido.
        expect_error("22023", bot, RESERVE, (CHAT, msg3, "otra pregunta", "question", 2))
        expect_error("23514", bot, """insert into public.messages
            (conversation_id, provider, business_phone_id, sender_kind, body, send_state, bot_slot, reply_to, reply_kind)
            values (%s, 'demo', 'demo-line', 'bot', 'otra pregunta', 'pending', 3, %s, 'question')""", (CHAT, msg3))
        expect_error("22023", bot, RESERVE, (CHAT, msg3, "ambigua", None, 2))
        expect_error("22023", bot, RESERVE, (CHAT, msg3, "cierre", "closing", None))
        assert rows(bot, CLAIM, (CHAT, reply2)) == [(True,)]
        rows(bot, RESULT, (CHAT, reply2, "unknown", None))
        assert rows(bot, CLAIM, (CHAT, reply2)) == [(False,)]
        rows(bot, RESULT, (CHAT, reply2, "failed", None))
        # Recalcular el cierre con el contador vigente. Sólo un cierre puede ganar.
        closing, _ = overlap(db, connect, RESERVE, (CHAT, msg3, "cierre", "closing", 2),
                             (CHAT, msg4, "otro cierre", "closing", 2), second_error="PT409")
        assert closing[0][1:] == (3, "pending", "closing")
        assert rows(bot, COUNTS, (CHAT,)) == [(3, 1)]
        assert rows(bot, HISTORY, (CHAT, confirmed[0][1], pos1, 1)) == [(msg2, "customer")]
        assert rows(bot, HISTORY, (CHAT, None, 0, 100)) == [
            (msg1, "customer"), (msg2, "customer"), (reply1, "bot"), (msg3, "customer"), (msg4, "customer")]
        change = "select public.set_bot_conversation_state(%s,%s,%s)"
        assert rows(bot, change, (CHAT, "collecting", "waiting_assignment")) == [("waiting_assignment",)]
        assert rows(bot, change, (CHAT, "collecting", "waiting_assignment")) == [("waiting_assignment",)]
        expect_error("22023", bot, change, (CHAT, "collecting", "handed_off"))
        expect_error("PT409", bot, RESERVE, (CHAT, msg4, "otra", "question", 3))
        assert rows(bot, RESERVE, (CHAT, msg1, "respuesta", "question", 0))[0][0] == reply1
        assert rows(bot, RECEIVE, inbound("ext-1")) == again
        reply3 = rows(bot, RESERVE, (CHAT, msg3, "cierre", "closing", 2))[0][0]
        rows(bot, change, (CHAT, "waiting_assignment", "handed_off"))
        assert rows(bot, CLAIM, (CHAT, reply3)) == [(False,)]
        expect_error("22023", bot, change, (CHAT, "handed_off", "collecting"))

    with connect() as panel:
        panel.execute("set role anon")
        expect_error("42501", panel, HISTORY, (CHAT, None, 0, 100))
        expect_error("42501", panel, "select * from public.messages")
        panel.execute("reset role")
        panel.execute("set role authenticated")
        for uid, visible in [(ADMIN, True), (OTHER, False), (OWNER, True)]:
            panel.execute("select set_config('request.jwt.claim.sub',%s,false)", (str(uid),))
            assert bool(rows(panel, HISTORY, (CHAT, None, 0, 100))) == visible
            assert bool(rows(panel, COUNTS, (CHAT,))) == visible
            assert bool(rows(panel, "select id from public.messages where conversation_id=%s", (OTHER_CHAT,))) == (uid == ADMIN)
            assert bool(rows(panel, "select id from public.conversations where id=%s", (CHAT,))) == visible
            assert bool(rows(panel, "select id from public.messages where conversation_id=%s", (CHAT,))) == visible
            expect_error("42501", panel, RECEIVE, inbound("forbidden"))
            expect_error("42501", panel, RESERVE, (CHAT, msg1, "forbidden", "question", 0))
            expect_error("42501", panel, CLAIM, (CHAT, reply1))
            expect_error("42501", panel, RESULT, (CHAT, reply1, "failed", None))
            expect_error("42501", panel, "update public.conversations set bot_state='stopped'")
        db.execute("update public.leads set assigned_to=%s where id=%s", (OTHER, LEAD))
        assert not rows(panel, HISTORY, (CHAT, None, 0, 100))
        panel.execute("select set_config('request.jwt.claim.sub',%s,false)", (str(OTHER),))
        assert rows(panel, COUNTS, (CHAT,)) == [(3, 1)]
        db.execute("update public.profiles set is_enabled=false,accepts_assignments=false where id=%s", (OTHER,))
        assert not rows(panel, HISTORY, (CHAT, None, 0, 100))


def early_closing(db, connect):
    chat = UUID(int=91)
    with connect() as bot:
        bot.execute("set role service_role")
        first, second, third = [
            rows(bot, RECEIVE, inbound(f"early-{n}", chat))[0][1] for n in range(3)
        ]
        first_reply = rows(bot, RESERVE, (chat, first, "Primera", "question", 0))
        close = (chat, second, "Cierre temprano", "closing", 1)

        # Un rollback revierte juntos la reserva y el cambio de estado.
        with bot.transaction(force_rollback=True):
            rows(bot, RESERVE, close)
            assert rows(bot, "select bot_state from public.get_bot_conversation(%s)", (chat,)) == [("waiting_assignment",)]
        assert rows(bot, "select bot_state,reserved_slots from public.get_bot_conversation(%s)", (chat,)) == [("collecting", 1)]

        closing, _ = overlap(db, connect, RESERVE, close, (chat, third, "Pregunta tardía", "question", 1),
                             second_error="PT409")
        assert closing[0][1:] == (2, "pending", "closing")
        assert rows(bot, "select bot_state,reserved_slots,sent_count from public.get_bot_conversation(%s)", (chat,)) == [
            ("waiting_assignment", 2, 0)]
        expect_error("PT409", bot, RESERVE, (chat, third, "Pregunta tardía", "question", 2))
        assert not rows(bot, "select id from public.messages where reply_to=%s", (third,))
        assert rows(bot, RESERVE, close) == closing
        assert rows(bot, RESERVE, (chat, first, "Primera", "question", 0)) == first_reply
        expect_error("22023", bot, RESERVE, (chat, second, "Cierre temprano", "question", 1))
        expect_error("22023", bot, RESERVE, (chat, second, "Otro texto", "closing", 1))
        assert rows(bot, CLAIM, (chat, first_reply[0][0])) == [(False,)]
        assert rows(bot, CLAIM, (chat, closing[0][0])) == [(True,)]
        rows(bot, RESULT, (chat, closing[0][0], "sent", "early-out"))
        assert rows(bot, COUNTS, (chat,)) == [(2, 1)]

        # Orden inverso: una pregunta gana mientras un cierre calculado con cero cupos espera.
        chat = UUID(int=92)
        first, second = [rows(bot, RECEIVE, inbound(f"reverse-{n}", chat))[0][1] for n in range(2)]
        overlap(db, connect, RESERVE, (chat, first, "Primera", "question", 0),
                (chat, second, "Gracias", "closing", 0), second_error="PT409")
        assert rows(bot, "select bot_state,reserved_slots from public.get_bot_conversation(%s)", (chat,)) == [
            ("collecting", 1)]
        assert rows(bot, RESERVE, (chat, second, "Gracias", "closing", 1))[0][1:] == (2, "pending", "closing")

        chat = UUID(int=93)
        only = rows(bot, RECEIVE, inbound("close-first", chat))[0][1]
        assert rows(bot, RESERVE, (chat, only, "Gracias", "closing", 0))[0][1:] == (1, "pending", "closing")
        assert rows(bot, "select bot_state,reserved_slots from public.get_bot_conversation(%s)", (chat,)) == [
            ("waiting_assignment", 1)]


def run():
    # Ignore ambient libpq connection/service settings, including PGSERVICE and PGHOSTADDR.
    for key in list(os.environ):
        if key.startswith("PG"):
            del os.environ[key]
    with tempfile.TemporaryDirectory(prefix="pelucars-bot-") as directory:
        data = str(Path(directory) / "data")
        password = secrets.token_urlsafe(32)
        password_file = Path(directory) / "init-password"
        password_file.write_text(password + "\n", encoding="utf-8")
        subprocess.run(["initdb", "-D", data, "-U", "postgres", "-A", "scram-sha-256", "-E", "UTF8",
                        "--no-locale", "--pwfile", str(password_file)], check=True, stdout=subprocess.DEVNULL)
        password_file.unlink()
        with socket.socket() as probe:
            probe.bind(("127.0.0.1", 0))
            port = probe.getsockname()[1]
        ctl = ["pg_ctl", "-D", data, "-w"]
        subprocess.run([*ctl, "-l", str(Path(directory) / "postgres.log"), "-o",
                        f"-c listen_addresses=127.0.0.1 -c unix_socket_directories='' -p {port}", "start"], check=True)

        def connect():
            return psycopg.connect(host="127.0.0.1", port=port, password=password, user="postgres",
                                   dbname="postgres", autocommit=True)
        try:
            with connect() as db:
                assert rows(db, "show data_directory") == [(data,)]
                db.execute("""create role anon; create role authenticated; create role service_role bypassrls;
                    create schema auth; create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb);
                    create function auth.uid() returns uuid language sql stable as $$
                    select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
                    grant usage on schema auth to anon,authenticated,service_role;""")
                for migration in sorted((ROOT / "migrations").glob("*.sql")):
                    db.execute(migration.read_text(encoding="utf-8-sig"))
                for regression in ("identity", "crm", "crm-recurrence"):
                    db.execute((ROOT / "tests" / f"{regression}.sql").read_text(encoding="utf-8-sig"))
                exercise(db, connect)
                early_closing(db, connect)
                print("OK: migraciones, 3 regresiones CRM/identidad, ingreso, historial, cupos, concurrencia y RLS")
        finally:
            subprocess.run([*ctl, "-m", "immediate", "stop"], check=True)


if __name__ == "__main__":
    if not __debug__:
        raise SystemExit("Run without python -O so test assertions are enabled.")
    run()
