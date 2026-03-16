from datetime import date, time

from scripts.backfill_hooky_programs import (
    _discover_candidate_source_slugs,
    _schedule_days,
    backfill_hooky_programs,
    build_program_record,
)


def test_build_program_record_maps_family_event_to_program() -> None:
    record = build_program_record(
        {
            "event_id": 101,
            "source_id": 202,
            "source_slug": "club-scikidz-atlanta",
            "source_name": "Club SciKidz Atlanta",
            "owner_portal_id": "atlanta-families-portal",
            "portal_id": "atlanta-families-portal",
            "venue_id": 303,
            "venue_name": "Lutheran Church of the Resurrection",
            "title": "Junior AI and Chat Bots at Lutheran Church of the Resurrection",
            "description": "Step into the future with AI.",
            "start_date": date(2026, 6, 8),
            "end_date": date(2026, 6, 12),
            "start_time": time(9, 0),
            "end_time": time(16, 0),
            "age_min": 9,
            "age_max": 11,
            "price_min": 325.0,
            "price_max": 325.0,
            "price_note": "per week",
            "tags": ["stem", "kids", "coding", "camp"],
            "source_url": "https://example.com/program",
            "ticket_url": "https://example.com/register",
            "content_hash": "event-hash",
        }
    )

    assert record is not None
    assert record["portal_id"] == "atlanta-families-portal"
    assert record["program_type"] == "camp"
    assert record["season"] == "summer"
    assert record["session_start"] == "2026-06-08"
    assert record["session_end"] == "2026-06-12"
    assert record["schedule_days"] == [1, 2, 3, 4, 5]
    assert record["schedule_start_time"] == "09:00:00"
    assert record["schedule_end_time"] == "16:00:00"
    assert record["cost_amount"] == 325.0
    assert record["registration_status"] == "open"
    assert record["provider_name"] == "Club SciKidz Atlanta"
    assert record["metadata"]["backfilled_from_event_id"] == 101


def test_discover_candidate_source_slugs_reads_ranked_source_list(monkeypatch) -> None:
    rows = [("cobb-family-programs",), ("atlanta-family-programs",), ("gwinnett-family-programs",)]

    class FakeCursor:
        def execute(self, query, params):
            assert "future_family_events" in query
            assert params == ("atlanta-families", 20, 3)

        def fetchall(self):
            return rows

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return False

    class FakeConnection:
        def cursor(self):
            return FakeCursor()

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return False

    monkeypatch.setattr("scripts.backfill_hooky_programs._connect", lambda: FakeConnection())

    assert _discover_candidate_source_slugs(portal_slug="atlanta-families", max_sources=3, min_candidates=20) == [
        "cobb-family-programs",
        "atlanta-family-programs",
        "gwinnett-family-programs",
    ]


def test_schedule_days_uses_short_date_span_when_weekly_tag_missing() -> None:
    assert _schedule_days(date(2026, 6, 1), date(2026, 6, 5), ["camp"]) == [1, 2, 3, 4, 5]
    assert _schedule_days(date(2026, 5, 26), date(2026, 5, 29), ["camp"]) == [2, 3, 4, 5]


def test_schedule_days_prefers_explicit_weekday_text() -> None:
    assert _schedule_days(
        date(2026, 6, 8),
        date(2026, 6, 12),
        ["camp"],
        "Ages 4-6 Cost: Full Day $425/week (Mon-Fri 9-4pm) or Half Day $350/week (9-1pm)",
    ) == [1, 2, 3, 4, 5]


def test_backfill_updates_existing_program_hashes_when_apply_true(monkeypatch) -> None:
    candidate_event = {
        "event_id": 101,
        "source_id": 202,
        "source_slug": "woodward-summer-camps",
        "source_name": "Woodward",
        "owner_portal_id": "atlanta-families-portal",
        "portal_id": "atlanta-families-portal",
        "venue_id": 303,
        "venue_name": "Woodward Academy",
        "title": "Woodward Summer Camp: Championship Chess (AM) at Woodward Academy",
        "description": "Woodward Academy summer camp.",
        "start_date": date(2026, 5, 26),
        "end_date": date(2026, 5, 29),
        "age_min": 8,
        "age_max": 13,
        "price_min": None,
        "price_max": None,
        "price_note": "See official Woodward registration flow for tuition and after-care pricing.",
        "tags": ["family-friendly", "rsvp-required", "stem", "camp"],
        "source_url": "https://example.com/program",
        "ticket_url": "https://example.com/register",
        "content_hash": "event-hash",
    }
    updated_payloads = []

    monkeypatch.setattr(
        "scripts.backfill_hooky_programs._fetch_candidate_events",
        lambda portal_slug, source_slugs, per_source_limit: [candidate_event],
    )
    monkeypatch.setattr(
        "scripts.backfill_hooky_programs._fetch_existing_program_hashes",
        lambda hashes: {next(iter(hashes))},
    )
    monkeypatch.setattr(
        "scripts.backfill_hooky_programs.insert_program",
        lambda payload: updated_payloads.append(payload) or "program-123",
    )

    stats = backfill_hooky_programs(
        portal_slug="atlanta-families",
        source_slugs=["woodward-summer-camps"],
        per_source_limit=10,
        apply=True,
    )

    assert stats.candidates == 1
    assert stats.inserted == 0
    assert stats.existing == 1
    assert stats.skipped == 0
    assert updated_payloads[0]["schedule_days"] == [2, 3, 4, 5]
