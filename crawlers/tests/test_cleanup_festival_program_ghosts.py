from scripts.cleanup_festival_program_ghosts import plan_ghost_series_cleanup


def test_plan_ghost_series_cleanup_only_keeps_zero_event_safe_rows() -> None:
    series_rows = [
        {
            "id": "ghost-1",
            "title": "Ghost",
            "festival_id": "fest-1",
            "series_type": "festival_program",
            "description": None,
            "is_active": True,
        },
        {
            "id": "film-ghost",
            "title": "Ghost Film",
            "festival_id": "fest-1",
            "series_type": "film",
            "description": "film synopsis",
            "is_active": False,
        },
        {
            "id": "described-ghost",
            "title": "Described",
            "festival_id": "fest-1",
            "series_type": "festival_program",
            "description": "preserve me",
            "is_active": True,
        },
        {
            "id": "kept-with-event",
            "title": "Live Program",
            "festival_id": "fest-1",
            "series_type": "festival_program",
            "description": None,
            "is_active": True,
        },
        {
            "id": "wrong-type",
            "title": "Festival Parent",
            "festival_id": "fest-1",
            "series_type": "other",
            "description": None,
            "is_active": False,
        },
        {
            "id": "active-film-ghost",
            "title": "Active Ghost Film",
            "festival_id": "fest-1",
            "series_type": "film",
            "description": None,
            "is_active": True,
        },
        {
            "id": "recurring-ghost",
            "title": "Ghost Render Wrapper",
            "festival_id": "fest-1",
            "series_type": "recurring_show",
            "description": None,
            "is_active": False,
        },
    ]

    candidates = plan_ghost_series_cleanup(
        series_rows,
        {"kept-with-event": 1},
        allowed_festival_ids={"fest-1"},
        festival_rows_by_id={"fest-1": {"id": "fest-1", "description": "short"}},
    )

    assert candidates == [
        {
            "series_id": "described-ghost",
            "title": "Described",
            "festival_id": "fest-1",
            "series_type": "festival_program",
            "action": "delete_ghost_series_and_preserve_festival_description",
        },
        {
            "series_id": "ghost-1",
            "title": "Ghost",
            "festival_id": "fest-1",
            "series_type": "festival_program",
            "action": "delete_ghost_series",
        },
        {
            "series_id": "film-ghost",
            "title": "Ghost Film",
            "festival_id": "fest-1",
            "series_type": "film",
            "action": "delete_ghost_series",
        },
        {
            "series_id": "recurring-ghost",
            "title": "Ghost Render Wrapper",
            "festival_id": "fest-1",
            "series_type": "recurring_show",
            "action": "delete_ghost_series",
        },
    ]


def test_plan_ghost_series_cleanup_respects_slug_scope() -> None:
    series_rows = [
        {
            "id": "ghost-1",
            "title": "Ghost A",
            "festival_id": "fest-1",
            "series_type": "film",
            "description": None,
            "is_active": False,
        },
        {
            "id": "ghost-2",
            "title": "Ghost B",
            "festival_id": "fest-2",
            "series_type": "class_series",
            "description": None,
            "is_active": False,
        },
    ]

    candidates = plan_ghost_series_cleanup(
        series_rows,
        {},
        allowed_festival_ids={"fest-2"},
        festival_rows_by_id={"fest-2": {"id": "fest-2", "description": ""}},
    )

    assert [row["series_id"] for row in candidates] == ["ghost-2"]
