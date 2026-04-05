from scripts.backfill_festival_window_linkage import _plan_series_action


def test_plan_series_action_demotes_series_with_only_outside_window_events() -> None:
    plan = _plan_series_action(
        festival_start="2026-10-10",
        festival_end="2026-10-11",
        series={"id": "series-1"},
        events=[
            {"id": 1, "title": "HALFWAY to Pride!", "start_date": "2026-04-12", "is_active": True},
        ],
    )

    assert plan == {
        "action": "demote_series",
        "series_id": "series-1",
        "event_ids": [1],
    }


def test_plan_series_action_deactivates_duplicate_outside_window_rows() -> None:
    plan = _plan_series_action(
        festival_start="2026-07-25",
        festival_end="2026-07-25",
        series={"id": "series-2"},
        events=[
            {"id": 10, "title": "Atlanta Ice Cream Festival", "start_date": "2026-07-23", "is_active": True},
            {"id": 11, "title": "Atlanta Ice Cream Festival", "start_date": "2026-07-25", "is_active": True},
        ],
    )

    assert plan == {
        "action": "deactivate_events",
        "series_id": "series-2",
        "event_ids": [10],
    }


def test_plan_series_action_skips_mixed_non_duplicate_rows() -> None:
    plan = _plan_series_action(
        festival_start="2026-04-23",
        festival_end="2026-05-03",
        series={"id": "series-3"},
        events=[
            {"id": 20, "title": "ATLFF Launch Party 2026", "start_date": "2026-03-23", "is_active": True},
            {"id": 21, "title": "Opening Night Screening", "start_date": "2026-04-23", "is_active": True},
        ],
    )

    assert plan is None
