"""Catalogue concurrency against the private PostgreSQL cluster, never a remote URL."""
import time
from concurrent.futures import ThreadPoolExecutor
from uuid import UUID
from psycopg.types.json import Jsonb


def exercise_catalog(db, connect, overlap, rows):
    save = "select * from public.save_bot_lead_details_with_catalog(%s,%s,%s,%s,%s,%s)"
    admin = "ca100000-0000-4000-8000-000000000001"
    db.execute("insert into private.bot_processing_limits values('demo','catalog-line',3600,100,200)")
    db.execute("insert into auth.users(id) values(%s)", (admin,))
    db.execute("insert into public.profiles(id,full_name,role,is_enabled) values(%s,'Admin','admin',true)", (admin,))

    def fixture(phone, brand, model):
        text = f"Busco {brand} {model}"
        with connect() as bot:
            bot.execute("set role service_role")
            r = rows(bot, "select * from public.receive_bot_contact_message('demo',%s,'test','catalog-line',%s,%s)", (phone, phone, text))[0][0]
            assert rows(bot, "select claimed from public.claim_bot_contact_message(%s)", (r,)) == [(True,)]
            outcome, lead, conversation, message, cycle = rows(bot, "select * from public.resolve_bot_contact_message(%s,'new_search')", (r,))[0]
        extraction = {"vehiculo_buscado": f"{brand} {model}", "caracteristicas": [], "presupuesto_importe": None,
            "presupuesto_moneda": None, "presupuesto_alcance": None, "tiene_usado": None,
            "decision_entrega_usado": "no_informada", "usado_detalle": None, "plazo_compra": None,
            "necesita_financiacion": None, "resumen_consulta": text}
        resolution = {"status": "unambiguous", "role": "sought_vehicle", "message_id": str(message), "quote": text}
        return (conversation, message, Jsonb(extraction), Jsonb({"marca": brand, "modelo": model}), None, Jsonb(resolution))

    a = fixture("+12025550123", "Ford", "Ranger")
    b = fixture("+12025550124", " ford  ", "RANGER")
    first, second = overlap(db, connect, save, a, b)
    assert first[0][3] == second[0][3]
    assert first[0][4] == "created" and second[0][4] == "reused"
    assert rows(db, "select count(*) from public.vehicles") == [(1,)]
    assert rows(db, "select count(*) from public.inventory_events") == [(1,)]
    assert rows(db, "select count(*) from public.inventory_units") == [(0,)]

    def race(first_action, second_args, rollback=False):
        with connect() as writer, connect() as contender, ThreadPoolExecutor(1) as pool:
            writer.execute("set statement_timeout='10s'")
            contender.execute("set role service_role; set statement_timeout='10s'")
            writer.execute("begin")
            try:
                value = first_action(writer)
                future = pool.submit(rows, contender, save, second_args)
                deadline = time.monotonic() + 5
                while rows(db, "select wait_event_type from pg_stat_activity where pid=%s", (contender.info.backend_pid,)) != [("Lock",)]:
                    if future.done() or time.monotonic() > deadline:
                        raise AssertionError("Catalogue contender did not wait for the first transaction")
                    time.sleep(0.02)
                writer.execute("rollback" if rollback else "commit")
                return value, future.result(timeout=10)
            finally:
                writer.execute("rollback")

    # Admin and bot share the same expression-index arbiter. Bot never overwrites
    # the administrator's spelling, origin, timestamps or audit record.
    c = fixture("+12025550125", "Toyota", "Corolla")
    def admin_create(writer):
        writer.execute("set role authenticated")
        writer.execute("select set_config('request.jwt.claim.sub',%s,false)", (admin,))
        return rows(writer, "select public.save_vehicle_for_source(null,'TOYOTA','Corolla',null,'demo')")[0][0]
    created, reused = race(admin_create, c)
    assert reused[0][3] == created and reused[0][4] == "reused"
    assert rows(db, "select brand,origin,created_by from public.vehicles where id=%s", (created,)) == [("TOYOTA", "admin", UUID(admin))]
    assert rows(db, "select count(*) from public.inventory_events where vehicle_id=%s", (created,)) == [(1,)]

    # If the competing creator rolls back, the waiting bot creates exactly once.
    d = fixture("+12025550126", "Nissan", "Sentra")
    e = fixture("+12025550127", "Nissan", "Sentra")
    def aborting_create(writer):
        writer.execute("set role service_role")
        return rows(writer, save, d)
    _, winner = race(aborting_create, e, rollback=True)
    assert winner[0][4] == "created"
    assert rows(db, "select count(*) from public.vehicles where brand='Nissan'") == [(1,)]

    # A duplicate blocked behind save+close must retrieve the committed response,
    # even though the contact is paused by the time it acquires the lock.
    f = fixture("+12025550128", "Lexus", "NX")
    def save_and_close(writer):
        writer.execute("set role service_role")
        result = rows(writer, save, f)
        rows(writer, "select public.reserve_bot_reply(%s,%s,'Cierre','closing',0)", f[:2])
        return result
    first, retry = race(save_and_close, f)
    assert first[0][3] == retry[0][3] and retry[0][2] == "unchanged"
    assert rows(db, "select count(*) from public.vehicles") == [(4,)]
    assert rows(db, "select count(*) from public.inventory_events") == [(4,)]
    assert rows(db, "select count(*) from public.inventory_units") == [(0,)]
    print("OK catalogue: concurrent bot/bot and admin/bot deduplication, rollback winner, replay after concurrent close; no units, stock or prices")
