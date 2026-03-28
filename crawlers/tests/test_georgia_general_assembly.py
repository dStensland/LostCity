from datetime import date

from sources import georgia_general_assembly as source_module

from sources.georgia_general_assembly import _extract_meeting_events


def test_extract_meeting_events_normalizes_house_and_senate_meetings() -> None:
    payload = [
        {
            "start": "2026-03-18T09:00:00-04:00",
            "subject": "Appropriations: Health and Human Development Subcommittee",
            "body": "",
            "location": "307 CLOB",
            "willBroadcast": True,
            "livestreamUrl": "https://vimeo.example/stream",
            "agendaUri": "https://www.legis.ga.gov/api/document/agendas/senate/hhd.pdf",
            "chamber": 2,
        },
        {
            "start": "2026-03-19T13:00:00-04:00",
            "subject": "JUDICIARY NON-CIVIL",
            "body": "",
            "location": "132 CAP",
            "willBroadcast": False,
            "livestreamUrl": "",
            "agendaUri": "https://www.legis.ga.gov/api/document/agendas/house/jnc.pdf",
            "chamber": 1,
        },
    ]

    events = _extract_meeting_events(payload, today=date(2026, 3, 11))

    assert [event["title"] for event in events] == [
        "Senate: Appropriations: Health and Human Development Subcommittee",
        "House: JUDICIARY NON-CIVIL",
    ]
    assert events[0]["start_date"] == "2026-03-18"
    assert events[0]["source_url"] == "https://www.legis.ga.gov/api/document/agendas/senate/hhd.pdf"
    assert "senate" in events[0]["tags"]
    assert "committee" in events[0]["tags"]
    assert "budget" in events[0]["tags"]
    assert "capitol" in events[1]["tags"]


def test_extract_meeting_events_skips_past_and_duplicate_rows() -> None:
    payload = [
        {
            "start": "2026-03-10T09:00:00-04:00",
            "subject": "Past meeting",
            "location": "CAP",
            "body": "",
            "agendaUri": "",
            "livestreamUrl": "",
            "chamber": 1,
        },
        {
            "start": "2026-03-18T09:00:00-04:00",
            "subject": "Appropriations: Health and Human Development Subcommittee",
            "location": "307 CLOB",
            "body": "",
            "agendaUri": "",
            "livestreamUrl": "",
            "chamber": 2,
        },
        {
            "start": "2026-03-18T09:00:00-04:00",
            "subject": "Appropriations: Health and Human Development Subcommittee",
            "location": "307 CLOB",
            "body": "",
            "agendaUri": "",
            "livestreamUrl": "",
            "chamber": 2,
        },
    ]

    events = _extract_meeting_events(payload, today=date(2026, 3, 11))

    assert len(events) == 1
    assert events[0]["title"] == "Senate: Appropriations: Health and Human Development Subcommittee"


def test_extract_meeting_events_skips_cancelled_rows() -> None:
    payload = [
        {
            "start": "2026-03-18T09:00:00-04:00",
            "subject": "CANCELED: RETIREMENT",
            "location": "415 CLOB",
            "body": "",
            "agendaUri": "",
            "livestreamUrl": "",
            "chamber": 1,
        },
        {
            "start": "2026-03-18T10:00:00-04:00",
            "subject": "Appropriations",
            "location": "307 CLOB",
            "body": "",
            "agendaUri": "",
            "livestreamUrl": "",
            "chamber": 2,
        },
    ]

    events = _extract_meeting_events(payload, today=date(2026, 3, 11))

    assert len(events) == 1
    assert events[0]["title"] == "Senate: Appropriations"


def test_crawl_updates_existing_events_with_shared_db_contract(monkeypatch) -> None:
    source = {"id": 1566}
    existing = {"id": 123, "title": "Senate: Existing Meeting"}
    payload = [
        {
            "title": "Senate: Existing Meeting",
            "description": "Official Senate meeting.",
            "start_date": "2026-03-18",
            "start_time": "09:00",
            "end_time": None,
            "source_url": "https://www.legis.ga.gov/agenda.pdf",
            "ticket_url": "https://www.legis.ga.gov/agenda.pdf",
            "image_url": None,
            "category": "community",
            "subcategory": "government",
            "tags": ["government"],
            "is_free": True,
            "is_all_day": False,
        }
    ]
    calls = []

    class DummySession:
        pass

    monkeypatch.setattr(source_module.requests, "Session", lambda: DummySession())
    monkeypatch.setattr(source_module, "_fetch_meetings", lambda session, now: [{"ignored": True}])
    monkeypatch.setattr(source_module, "_extract_meeting_events", lambda raw_payload, today=None: payload)
    monkeypatch.setattr(source_module, "get_or_create_place", lambda venue: 99)
    monkeypatch.setattr(source_module, "find_event_by_hash", lambda content_hash: existing)
    monkeypatch.setattr(source_module, "insert_event", lambda event_record: calls.append(("insert", event_record)))
    monkeypatch.setattr(
        source_module,
        "smart_update_existing_event",
        lambda existing_event, event_record: calls.append(("update", existing_event, event_record)),
    )
    monkeypatch.setattr(
        source_module,
        "remove_stale_source_events",
        lambda source_id, seen_hashes: calls.append(("stale", source_id, seen_hashes)),
    )

    found, new, updated = source_module.crawl(source)

    assert (found, new, updated) == (1, 0, 1)
    assert calls[0][0] == "update"
    assert calls[0][1] == existing
    assert calls[0][2]["source_id"] == 1566
    assert calls[1] == ("stale", 1566, {calls[0][2]["content_hash"]})
