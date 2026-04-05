from scripts.cleanup_festival_program_orphans import plan_orphan_series_cleanup


def test_plan_orphan_series_cleanup_accepts_inactive_only_orphans() -> None:
    series_rows = [
        {
            "id": "series-1",
            "title": "Stale Program",
            "festival_id": "fest-1",
            "series_type": "festival_program",
            "description": None,
        }
    ]
    events_by_series = {
        "series-1": [
            {
                "id": 1,
                "title": "Stale Program",
                "series_id": "series-1",
                "is_active": False,
                "festival_id": None,
            }
        ]
    }

    candidates = plan_orphan_series_cleanup(
        series_rows,
        events_by_series,
        festival_rows_by_id={"fest-1": {"id": "fest-1", "description": ""}},
    )

    assert candidates == [
        {
            "series_id": "series-1",
            "festival_id": "fest-1",
            "title": "Stale Program",
            "action": "unlink_stale_rows_and_delete_series",
            "event_ids": [1],
            "active_event_ids": [],
        }
    ]


def test_plan_orphan_series_cleanup_promotes_matching_singletons() -> None:
    series_rows = [
        {
            "id": "series-1",
            "title": "Festival Day 1",
            "festival_id": "fest-1",
            "series_type": "festival_program",
            "description": None,
        },
        {
            "id": "series-2",
            "title": "Festival Parent",
            "festival_id": "fest-1",
            "series_type": "festival_program",
            "description": "keep",
        },
    ]
    events_by_series = {
        "series-1": [
            {
                "id": 11,
                "title": "Festival Day 1",
                "series_id": "series-1",
                "is_active": True,
                "festival_id": None,
            }
        ],
        "series-2": [
            {
                "id": 22,
                "title": "Other Event",
                "series_id": "series-2",
                "is_active": True,
                "festival_id": None,
            }
        ],
    }

    candidates = plan_orphan_series_cleanup(
        series_rows,
        events_by_series,
        festival_rows_by_id={"fest-1": {"id": "fest-1", "description": ""}},
    )

    assert candidates == [
        {
            "series_id": "series-1",
            "festival_id": "fest-1",
            "title": "Festival Day 1",
            "action": "promote_single_event_and_delete_series",
            "event_ids": [11],
            "active_event_ids": [11],
        }
    ]


def test_plan_orphan_series_cleanup_preserves_described_parent_wrappers() -> None:
    series_rows = [
        {
            "id": "series-1",
            "title": "Atlanta Ice Cream Festival",
            "festival_id": "fest-1",
            "series_type": "festival_program",
            "description": "Long festival description",
        }
    ]
    events_by_series = {
        "series-1": [
            {
                "id": 11,
                "title": "Atlanta Ice Cream Festival",
                "series_id": "series-1",
                "is_active": True,
                "festival_id": None,
            },
            {
                "id": 12,
                "title": "Atlanta Ice Cream Festival",
                "series_id": "series-1",
                "is_active": False,
                "festival_id": "fest-1",
            },
        ]
    }

    candidates = plan_orphan_series_cleanup(
        series_rows,
        events_by_series,
        festival_rows_by_id={"fest-1": {"id": "fest-1", "description": ""}},
    )

    assert candidates == [
        {
            "series_id": "series-1",
            "festival_id": "fest-1",
            "title": "Atlanta Ice Cream Festival",
            "action": "promote_single_event_and_preserve_description",
            "event_ids": [11, 12],
            "active_event_ids": [11],
        }
    ]


def test_plan_orphan_series_cleanup_preserves_description_for_described_stale_wrappers() -> None:
    series_rows = [
        {
            "id": "series-1",
            "title": "Beer, Bourbon & BBQ Festival",
            "festival_id": "fest-1",
            "series_type": "festival_program",
            "description": "Longer wrapper description",
        }
    ]
    events_by_series = {
        "series-1": [
            {
                "id": 11,
                "title": "Beer, Bourbon & BBQ Festival",
                "series_id": "series-1",
                "is_active": False,
                "festival_id": None,
            }
        ]
    }

    candidates = plan_orphan_series_cleanup(
        series_rows,
        events_by_series,
        festival_rows_by_id={"fest-1": {"id": "fest-1", "description": "Short"}},
    )

    assert candidates == [
        {
            "series_id": "series-1",
            "festival_id": "fest-1",
            "title": "Beer, Bourbon & BBQ Festival",
            "action": "delete_stale_wrapper_and_preserve_festival_description",
            "event_ids": [11],
            "active_event_ids": [],
        }
    ]


def test_plan_orphan_series_cleanup_promotes_single_child_events_under_stale_parent_wrappers() -> None:
    series_rows = [
        {
            "id": "series-1",
            "title": "Georgia Food + Wine Festival",
            "festival_id": "fest-1",
            "series_type": "festival_program",
            "description": "Long festival wrapper description",
        }
    ]
    events_by_series = {
        "series-1": [
            {
                "id": 11,
                "title": "The Chef's Table Experience",
                "series_id": "series-1",
                "is_active": True,
                "festival_id": "fest-1",
            },
            {
                "id": 12,
                "title": "Georgia Food + Wine Festival",
                "series_id": "series-1",
                "is_active": False,
                "festival_id": None,
            },
        ]
    }

    candidates = plan_orphan_series_cleanup(
        series_rows,
        events_by_series,
        festival_rows_by_id={"fest-1": {"id": "fest-1", "description": "Short"}},
    )

    assert candidates == [
        {
            "series_id": "series-1",
            "festival_id": "fest-1",
            "title": "Georgia Food + Wine Festival",
            "action": "promote_single_child_event_and_preserve_festival_description",
            "event_ids": [11, 12],
            "active_event_ids": [11],
        }
    ]
