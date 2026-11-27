"""Run against a fresh private PostgreSQL cluster. Never accepts a database URL."""
import argparse
import json
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
from psycopg.types.json import Jsonb

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
        expect_error("42501", bot, """insert into public.messages
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



def lead_summary(db, connect):
    save = "select * from public.save_bot_lead_summary(%s,%s,%s)"
    chat = UUID(int=94)
    first_chat = UUID(int=95)
    # Texto comercial de #46, con identidades exclusivamente locales.
    summary = ("Busca un Corolla automático, modelo 2022 en adelante, con un presupuesto total de 20.000 USD. "
               "Quiere comprar dentro de los próximos 15 días, no entrega usado y no necesita financiación.")
    with connect() as bot:
        bot.execute("set role service_role")
        old = rows(bot, RECEIVE, inbound("resumen-otra-conversacion", first_chat))[0][1]
        a, b, c = [rows(bot, RECEIVE, inbound(f"resumen-{n}", chat, body=body))[0][1]
                   for n, body in enumerate(("Busco un Corolla automático 2022 en adelante. Presupuesto total 20.000 USD.",
                                             "Quiero comprar dentro de 15 días. No necesito financiación.",
                                             "No entrego usado"))]
        entry = (chat, c, summary)
        # La oportunidad es el dominio del bloqueo, aun entre conversaciones.
        first, second = overlap(db, connect, save, (first_chat, old, "Consulta anterior"), (chat, a, "Corolla"))
        assert first == [(LEAD, old, "applied")] and second == [(LEAD, a, "applied")]
        before = rows(bot, HISTORY, (chat, None, 0, 100)), rows(bot, COUNTS, (chat,))
        with bot.transaction(force_rollback=True):
            assert rows(bot, save, entry) == [(LEAD, c, "applied")]
        assert rows(bot, "select summary from public.leads where id=%s", (LEAD,)) == [("Corolla",)]
        # La escritura más reciente vence incluso cuando la ejecución antigua espera el bloqueo.
        first, second = overlap(db, connect, save, (chat, b, "Plazo confirmado"), (first_chat, old, "Consulta anterior"))
        assert first == [(LEAD, b, "applied")] and second == [(LEAD, b, "stale")]
        first, second = overlap(db, connect, save, entry, entry)
        assert first == [(LEAD, c, "applied")] and second == [(LEAD, c, "unchanged")]
        state = "select summary, updated_at from public.leads where id=%s"
        snapshot = rows(bot, state, (LEAD,))
        assert snapshot[0][0] == summary
        first, second = overlap(db, connect, save, entry, (first_chat, old, "Consulta anterior"))
        assert first == [(LEAD, c, "unchanged")] and second == [(LEAD, c, "stale")]
        assert rows(bot, save, (chat, b, "Resumen anterior")) == [(LEAD, c, "stale")]
        expect_error("PT409", bot, save, (chat, c, "Otro resumen"))
        for bad in (None, "  ", "\t\n", "x" * 6001):
            expect_error("22023", bot, save, (chat, c, bad))
        expect_error("22023", bot, save, (OTHER_CHAT, c, summary))
        out = rows(bot, "select id from public.messages where bot_slot=3 and conversation_id=%s", (CHAT,))[0][0]
        expect_error("22023", bot, save, (CHAT, out, summary))
        assert rows(bot, state, (LEAD,)) == snapshot
        assert before == (rows(bot, HISTORY, (chat, None, 0, 100)), rows(bot, COUNTS, (chat,)))
        assert rows(bot, "select message_id from private.bot_lead_summary_sources where lead_id=%s", (LEAD,)) == [(c,)]

        db.execute("update public.leads set summary='Revisado en CRM' where id=%s", (LEAD,))
        newest = rows(bot, RECEIVE, inbound("resumen-4", chat))[0][1]
        expect_error("PT409", bot, save, (chat, newest, summary))
        assert rows(bot, state, (LEAD,))[0][0] == "Revisado en CRM"
        legacy = rows(bot, RECEIVE, inbound("resumen-previo", OTHER_CHAT, PENDING, business="demo-line-2"))[0][1]
        db.execute("update public.leads set summary='Resumen preexistente' where id=%s", (PENDING,))
        expect_error("PT409", bot, save, (OTHER_CHAT, legacy, summary))
    with connect() as panel:
        for role in ("anon", "authenticated"):
            panel.execute(f"set role {role}")
            expect_error("42501", panel, save, entry)
            expect_error("42501", panel, "select * from private.bot_lead_summary_sources")
            panel.execute("reset role")


def exercise_score(db, connect):
    fixture(db)
    # Proyección comercial de la extracción guardada. Sólo las identidades de la demo local.
    text = ("Busco un Corolla automático, modelo 2022 en adelante. Mi presupuesto total es de 20.000 dólares. "
            "Quiero comprar dentro de los próximos 15 días. No entrego usado y no necesito financiación")
    extraction = {
        "vehiculo_buscado": "Corolla", "caracteristicas": ["Automático", "Modelo 2022 en adelante"],
        "presupuesto_importe": 20000, "presupuesto_moneda": "USD", "presupuesto_alcance": "valor_total",
        "decision_entrega_usado": "descartada",
        "senales_score": {
            "plazo_categoria": "de_8_a_30_dias", "intencion_categoria": "no_informada",
            "plazo_evidencias": ["Quiero comprar dentro de los próximos 15 días"], "intencion_evidencias": [],
            "busqueda_evidencias": ["Busco un Corolla automático, modelo 2022 en adelante"],
            "presupuesto_evidencias": ["Mi presupuesto total es de 20.000 dólares"],
        },
    }
    workflow = json.loads((ROOT.parent / "n8n/workflows/recepcion-bot.json").read_text())
    scorer = next(n["parameters"]["jsCode"] for n in workflow["nodes"] if n["name"] == "Calcular score")
    js = """const {code, input} = JSON.parse(require('node:fs').readFileSync(0, 'utf8'));
      const result = Function('$json', code)(input).json.evaluacion_score;
      console.log(JSON.stringify(result));"""
    result = json.loads(subprocess.run(["node", "-e", js], text=True, capture_output=True, check=True,
                        input=json.dumps({"code": scorer, "input": extraction})).stdout)
    assert result["total"] == 50 and result["banda"] == "media"
    assert {k: d["puntos"] for k, d in result["desglose"].items()} == {
        "plazo": 20, "intencion": 0, "busqueda": 15, "presupuesto": 15}
    save = "select * from public.save_bot_score(%s,%s,%s,%s)"
    with connect() as bot:
        bot.execute("set role service_role")
        msg = rows(bot, RECEIVE, inbound("score-demo", body=text))[0][1]
        args = (CHAT, msg, Jsonb(result), None)
        first, retry = overlap(db, connect, save, args, args)
        evaluation = first[0][0]
        assert first == [(evaluation, "applied")] and retry == [(evaluation, "unchanged")]
        persisted = rows(bot, """select score, rules_version, rules_snapshot, result, evaluated_at
                              from public.score_evaluations where id=%s""", (evaluation,))[0]
        assert persisted[0:2] == (50, "pelucars_score_v1_prototipo") and persisted[3] == result
        assert persisted[2]["plazo"]["de_8_a_30_dias"] == 20
        assert rows(bot, save, args) == retry
        assert rows(bot, "select evaluated_at from public.score_evaluations") == [(persisted[4],)]
        citations = rows(bot, "select signal_code, message_id, quoted_text from public.score_evidence")
        assert set(citations) == {(k, msg, q) for k, d in result["desglose"].items() for q in d["evidencias"]}
        expect_error("PT409", bot, save, (CHAT, msg, Jsonb({**result, "total": 49}), None))
        foreign = rows(bot, RECEIVE, inbound("otro-lead", OTHER_CHAT, PENDING, body=text))[0][1]
        expect_error("22023", bot, save, (CHAT, foreign, Jsonb(result), None))
        # Ninguna cita puede proceder de otro lead o de un turno futuro.
        empty_chat = UUID(int=96)
        cutoff = rows(bot, RECEIVE, inbound("sin-evidencia", empty_chat, body="Hola"))[0][1]
        rows(bot, RECEIVE, inbound("posterior", empty_chat, body=text))
        expect_error("22023", bot, save, (empty_chat, cutoff, Jsonb(result), None))
        assert rows(bot, "select count(*) from public.score_evaluations") == [(1,)]
        assert rows(bot, "select count(*) from public.score_evidence") == [(3,)]
        # Falla en el último grupo, después de haber insertado citas válidas.
        bad_result = json.loads(json.dumps(result))
        bad_result["desglose"]["presupuesto"]["evidencias"] = ["una frase inventada"]
        expect_error("22023", bot, save, (OTHER_CHAT, foreign, Jsonb(bad_result), None))
        assert rows(bot, "select count(*) from public.score_evidence") == [(3,)]
        assert rows(bot, "select count(*) from public.score_evaluations") == [(1,)]
        later = rows(bot, RECEIVE, inbound("duplicar-cita", body=text))[0][1]
        expect_error("22023", bot, save, (CHAT, later, Jsonb(result), None))
        # Varias citas de una señal no suman de nuevo su contribución.
        multi = json.loads(json.dumps(result))
        quotes = multi["desglose"]["busqueda"]["evidencias"]
        quotes.extend([quotes[0], "modelo 2022 en adelante"])
        pending_eval = rows(bot, save, (OTHER_CHAT, foreign, Jsonb(multi), None))[0][0]
        assert rows(bot, "select count(*) from public.score_evidence where evaluation_id=%s", (pending_eval,)) == [(4,)]
        assert rows(bot, "select score from public.score_evaluations where id=%s", (pending_eval,)) == [(50,)]
        expect_error("42501", bot, "delete from public.score_evidence")

    with connect() as panel:
        panel.execute("set role anon")
        expect_error("42501", panel, "select * from public.score_evaluations")
        panel.execute("reset role")
        panel.execute("set role authenticated")
        for uid, evaluations, evidence in [(ADMIN, 2, 7), (OWNER, 1, 3), (OTHER, 0, 0)]:
            panel.execute("select set_config('request.jwt.claim.sub',%s,false)", (str(uid),))
            assert rows(panel, "select count(*) from public.score_evaluations") == [(evaluations,)]
            assert rows(panel, "select count(*) from public.score_evidence") == [(evidence,)]
            expect_error("42501", panel, save, args)
    print("OK: demo local 50/100, desglose 20+0+15+15, tres citas, reintento concurrente, rollback y RLS")


def run(score_only=False, d07_only=False):
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
        log = Path(directory) / "postgres.log"
        try:
            subprocess.run([*ctl, "-l", str(log), "-o",
                            f"-c listen_addresses=127.0.0.1 -c unix_socket_directories= -p {port}", "start"], check=True)
        except subprocess.CalledProcessError:
            if log.exists():
                print(log.read_text(encoding="utf-8", errors="replace"))
            raise

        def connect():
            return psycopg.connect(host="127.0.0.1", port=port, password=password, user="postgres",
                                   dbname="postgres", options="-c timezone=UTC", autocommit=True)
        try:
            with connect() as db:
                assert Path(rows(db, "show data_directory")[0][0]).resolve() == Path(data).resolve()
                db.execute("""create role anon; create role authenticated; create role service_role bypassrls;
                    create schema auth; create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb);
                    create function auth.uid() returns uuid language sql stable as $$
                    select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
                    grant usage on schema auth to anon,authenticated,service_role;""")
                for migration in sorted((ROOT / "migrations").glob("*.sql")):
                    db.execute(migration.read_text(encoding="utf-8-sig"))
                if d07_only:
                    from bot_pause import exercise_d07
                    exercise_d07(db, connect, overlap, rows, expect_error)
                    return
                if score_only:
                    exercise_score(db, connect)
                    return
                for regression in ("identity", "crm", "crm-recurrence"):
                    db.execute((ROOT / "tests" / f"{regression}.sql").read_text(encoding="utf-8-sig"))
                exercise(db, connect)
                early_closing(db, connect)
                lead_summary(db, connect)
                print("OK: migraciones, 3 regresiones CRM/identidad, ingreso, historial, cupos, concurrencia, resumen y RLS")
        finally:
            subprocess.run([*ctl, "-m", "immediate", "stop"], check=True)


if __name__ == "__main__":
    if not __debug__:
        raise SystemExit("Run without python -O so test assertions are enabled.")
    parser = argparse.ArgumentParser()
    parser.add_argument("--score-only", action="store_true", help="Run only the score persistence checks")
    parser.add_argument("--d07-only", action="store_true", help="Run D07 admission, closure and concurrency checks")
    args = parser.parse_args()
    run(score_only=args.score_only, d07_only=args.d07_only)
