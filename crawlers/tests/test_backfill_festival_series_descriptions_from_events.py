from scripts.backfill_festival_series_descriptions_from_events import (
    plan_festival_series_description_backfill,
)


def test_plan_backfills_missing_series_description_from_longest_active_event() -> None:
    candidates = plan_festival_series_description_backfill(
        [
            {
                "id": "series-1",
                "title": "Film A",
                "festival_id": "fest-1",
                "series_type": "film",
                "description": None,
            }
        ],
        [
            {
                "id": 1,
                "title": "Film A",
                "series_id": "series-1",
                "description": "short",
                "is_active": True,
            },
            {
                "id": 2,
                "title": "Film A",
                "series_id": "series-1",
                "description": "x" * 140,
                "is_active": True,
            },
        ],
        allowed_festival_ids={"fest-1"},
        allowed_series_types={"film"},
        min_length=80,
    )

    assert candidates == [
        {
            "series_id": "series-1",
            "title": "Film A",
            "festival_id": "fest-1",
            "series_type": "film",
            "source_event_id": 2,
            "source_event_title": "Film A",
            "description": "x" * 140,
            "action": "backfill_series_description_from_event",
        }
    ]


def test_plan_ignores_inactive_or_already_described_series() -> None:
    candidates = plan_festival_series_description_backfill(
        [
            {
                "id": "series-1",
                "title": "Film A",
                "festival_id": "fest-1",
                "series_type": "film",
                "description": "already set",
            },
            {
                "id": "series-2",
                "title": "Film B",
                "festival_id": "fest-1",
                "series_type": "film",
                "description": None,
            },
        ],
        [
            {
                "id": 1,
                "title": "Film A",
                "series_id": "series-1",
                "description": "x" * 140,
                "is_active": True,
            },
            {
                "id": 2,
                "title": "Film B",
                "series_id": "series-2",
                "description": "x" * 140,
                "is_active": False,
            },
        ],
        allowed_festival_ids={"fest-1"},
        allowed_series_types={"film"},
        min_length=80,
    )

    assert candidates == []
