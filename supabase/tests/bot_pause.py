"""D07 multi-session regression. Used only by the private-cluster bot-local runner."""
import time
from concurrent.futures import ThreadPoolExecutor


def exercise_d07(db, connect, overlap, rows, expect_error):
    receive = "select * from public.receive_bot_contact_message(%s,%s,%s,%s,%s,%s)"
    claim = "select claimed,reason from public.claim_bot_contact_message(%s)"
    resolve = "select * from public.resolve_bot_contact_message(%s,%s,%s)"
    reserve = "select id,bot_slot from public.reserve_bot_reply(%s,%s,%s,%s,%s)"
    turn = "select * from public.get_bot_contact_turn(%s)"

    def inbound(key, phone="+12025550123", line="d07-line"):
        return ("demo", phone, "demo", line, key, "Busco Corolla")

    # Test-only clock shared by all sessions. Never installed by the migration.
    db.execute("""create table private.test_bot_clock(t timestamptz);
        insert into private.test_bot_clock values('2026-11-01 12:00Z');
        create or replace function private.bot_clock() returns timestamptz language sql volatile
        set search_path='' as $$ select t from private.test_bot_clock $$;
        insert into private.bot_processing_limits values('demo','d07-line',3600,100,200),
        ('demo','other-line',3600,100,200);""")

    first, again = overlap(db, connect, receive, inbound("one"), inbound("one"))
    receipt = first[0][0]
    assert first[0][1] and again[0][0] == receipt and not again[0][1]
    one, two = overlap(db, connect, claim, (receipt,), (receipt,))
    assert one == [(True, "claimed")] and two == [(False, "processing")]
    one, two = overlap(db, connect, resolve, (receipt, "new_search", None), (receipt, "new_search", None))
    assert one == two
    _, lead, conversation, message, cycle = one[0]
    assert rows(db, "select count(*) from public.customers") == [(1,)]
    assert rows(db, "select count(*) from public.leads") == [(1,)]

    # Closure and its 72h gate must roll back together with the reservation.
    with connect() as bot:
        bot.execute("set role service_role")
        bot.execute("begin")
        rows(bot, reserve, (conversation, message, "Cierre", "closing", 0))
        assert rows(bot, turn, (receipt,))[0][-1].isoformat() == "2026-11-04T12:00:00+00:00"
        bot.execute("rollback")
    assert rows(db, "select closed_at from private.bot_cycles where id=%s", (cycle,)) == [(None,)]
    assert rows(db, "select pause_until from private.bot_contacts") == [(None,)]
    assert rows(db, "select count(*) from public.messages where sender_kind='bot'") == [(0,)]

    # A new inbound cannot slip between a committed close and its pause.
    with connect() as writer, connect() as contender, ThreadPoolExecutor(1) as pool:
        for session in (writer, contender):
            session.execute("set role service_role; set statement_timeout='10s'")
        with writer.transaction():
            closed = rows(writer, reserve, (conversation, message, "Cierre", "closing", 0))[0]
            future = pool.submit(rows, contender, receive, inbound("during-close"))
            deadline = time.monotonic() + 5
            while rows(db, "select wait_event_type from pg_stat_activity where pid=%s", (contender.info.backend_pid,)) != [("Lock",)]:
                if future.done() or time.monotonic() > deadline:
                    raise AssertionError("Inbound did not wait for atomic close")
                time.sleep(0.02)
        paused = future.result(timeout=10)[0]
        assert paused[2] == "paused"
    assert rows(db, "select count(*) from public.leads") == [(1,)]

    # Two simultaneous new messages at exactly 72h share one active turn/cycle.
    db.execute("update private.test_bot_clock set t='2026-11-04 12:00Z'")
    with connect() as bot:
        bot.execute("set role service_role")
        before = rows(bot, claim, (paused[0],))
        assert before == [(False, "paused")]
        a = rows(bot, receive, inbound("after-a"))[0][0]
        b = rows(bot, receive, inbound("after-b"))[0][0]
    one, two = overlap(db, connect, claim, (a,), (b,))
    assert one == [(True, "claimed")] and two == [(False, "busy")]
    with connect() as bot:
        bot.execute("set role service_role")
        new = rows(bot, resolve, (a, "same_search", lead))[0]
        assert new[1] == lead and new[-1] != cycle
        assert rows(bot, "select claimed from public.claim_bot_reply(%s,%s)", (conversation, closed[0])) == [(False,)]
        rows(bot, reserve, (new[2], new[3], "Pregunta", "question", 0))
        assert rows(bot, claim, (b,)) == [(True, "claimed")]
        second = rows(bot, resolve, (b, "same_search", lead))[0]
        assert second[-1] == new[-1]
        rows(bot, "select public.complete_bot_contact_turn(%s)", (b,))
    assert rows(db, "select count(*) from private.bot_cycles") == [(2,)]
    assert rows(db, "select count(*) from public.messages where bot_cycle_id=%s and bot_slot is not null", (cycle,)) == [(1,)]

    # Independent lines serialize customer resolution and do not duplicate the
    # first open search of a previously unseen phone.
    with connect() as bot:
        bot.execute("set role service_role")
        x = rows(bot, receive, inbound("line-a", "+12025550124"))[0][0]
        y = rows(bot, receive, inbound("line-b", "+12025550124", "other-line"))[0][0]
        rows(bot, claim, (x,)); rows(bot, claim, (y,))
    one, two = overlap(db, connect, resolve, (x, "new_search", None), (y, "new_search", None))
    assert one[0][1] == two[0][1]
    assert one[0][-1] != two[0][-1]
    assert rows(db, "select count(*) from public.customers") == [(2,)]
    assert rows(db, "select count(*) from public.leads") == [(2,)]
    db.execute("insert into private.bot_processing_limits values('demo','quota-line',3600,10,1)")
    with connect() as bot:
        bot.execute("set role service_role")
        x = rows(bot, receive, inbound("quota-a", "+12025550125", "quota-line"))[0][0]
        y = rows(bot, receive, inbound("quota-b", "+12025550126", "quota-line"))[0][0]
    one, two = overlap(db, connect, claim, (x,), (y,))
    assert one == [(True, "claimed")] and two == [(False, "processing_limit")]
    print("OK D07: duplicate intake/claim/resolution, rollback, close-vs-inbound lock, exact 72h, concurrent restart, cross-line customer resolution and atomic processing limit")
