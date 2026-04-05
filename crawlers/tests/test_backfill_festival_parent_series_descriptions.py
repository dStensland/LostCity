from scripts.backfill_festival_parent_series_descriptions import (
    plan_parent_series_description_backfill,
)


def test_plan_parent_series_description_backfill_matches_named_parent_series() -> None:
    candidates = plan_parent_series_description_backfill(
        [
            {
                "id": "series-1",
                "title": "Atlanta Fringe Festival 2026",
                "festival_id": "fest-1",
                "series_type": "festival_program",
                "description": None,
            },
            {
                "id": "series-2",
                "title": "Different Program Name",
                "festival_id": "fest-1",
                "series_type": "festival_program",
                "description": None,
            },
        ],
        {"series-1": 3, "series-2": 4},
        {"fest-1": {"id": "fest-1", "name": "Atlanta Fringe Festival", "description": "Festival parent copy"}},
        allowed_festival_ids={"fest-1"},
    )

    assert candidates == [
        {
            "series_id": "series-1",
            "title": "Atlanta Fringe Festival 2026",
            "festival_id": "fest-1",
            "description": "Festival parent copy",
            "action": "backfill_parent_series_description",
        }
    ]


def test_plan_parent_series_description_backfill_requires_linked_events() -> None:
    candidates = plan_parent_series_description_backfill(
        [
            {
                "id": "series-1",
                "title": "404 Day Weekend 2026",
                "festival_id": "fest-1",
                "series_type": "festival_program",
                "description": None,
            }
        ],
        {"series-1": 0},
        {"fest-1": {"id": "fest-1", "name": "404 Day Weekend", "description": "Festival copy"}},
        allowed_festival_ids={"fest-1"},
    )

    assert candidates == []


def test_plan_parent_series_description_backfill_matches_generic_parent_wrapper_tokens() -> None:
    candidates = plan_parent_series_description_backfill(
        [
            {
                "id": "series-1",
                "title": "404 Day Weekend 2026",
                "festival_id": "fest-1",
                "series_type": "festival_program",
                "description": None,
            }
        ],
        {"series-1": 9},
        {"fest-1": {"id": "fest-1", "name": "404 Day Festival", "description": "Festival parent copy"}},
        allowed_festival_ids={"fest-1"},
    )

    assert candidates == [
        {
            "series_id": "series-1",
            "title": "404 Day Weekend 2026",
            "festival_id": "fest-1",
            "description": "Festival parent copy",
            "action": "backfill_parent_series_description",
        }
    ]
