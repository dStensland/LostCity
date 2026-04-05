from festival_health import _festival_date_backfill_updates


def test_festival_date_backfill_updates_accepts_multi_day_coverage() -> None:
    festival = {"announced_start": None, "announced_end": None, "typical_duration_days": 2, "date_source": None}

    updates = _festival_date_backfill_updates(
        festival,
        ["2026-10-05", "2026-10-06", "2026-10-05"],
        event_count=6,
    )

    assert updates == {
        "announced_start": "2026-10-05",
        "announced_end": "2026-10-06",
        "date_source": "linked-event-backfill",
    }


def test_festival_date_backfill_updates_rejects_weak_single_day_coverage_for_multi_day_festival() -> None:
    festival = {"announced_start": None, "announced_end": None, "typical_duration_days": 2, "date_source": None}

    updates = _festival_date_backfill_updates(
        festival,
        ["2026-09-19"],
        event_count=1,
    )

    assert updates == {}


def test_festival_date_backfill_updates_allows_single_day_festival_with_multiple_events() -> None:
    festival = {"announced_start": None, "announced_end": None, "typical_duration_days": 1, "date_source": None}

    updates = _festival_date_backfill_updates(
        festival,
        ["2026-03-08", "2026-03-08"],
        event_count=2,
    )

    assert updates == {
        "announced_start": "2026-03-08",
        "announced_end": "2026-03-08",
        "date_source": "linked-event-backfill",
    }
