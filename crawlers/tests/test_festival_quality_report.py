from scripts.festival_quality_report import (
    _build_promotion_holds,
    _build_remediation_queue,
)


def _snapshot() -> dict:
    return {
        "description_quality": {
            "top_short_description_sources": [
                ["atlanta-fringe-festival", 52],
                ["small-source", 3],
            ],
            "top_missing_description_sources": [
                ["render-atl", 2],
                ["ga-food-wine-festival", 1],
            ],
            "top_series_description_gap_festivals": [
                {
                    "slug": "atlanta-film-festival",
                    "series_description_gaps": 18,
                    "series_missing_description": 18,
                    "series_short_description": 0,
                }
            ],
        },
        "schedule_quality": {
            "top_orphan_program_festivals": [
                {
                    "slug": "atlanta-science-festival",
                    "orphan_program_series": 10,
                    "ghost_program_series": 10,
                    "single_program_series": 0,
                },
                {
                    "slug": "toylanta",
                    "orphan_program_series": 3,
                    "ghost_program_series": 3,
                    "single_program_series": 0,
                },
            ]
        },
        "samples": {
            "fragmented_sources": [
                {
                    "source_slug": "atlanta-science-festival",
                    "festival_program_series": 14,
                }
            ],
            "festival_missing_announced_start": [
                {
                    "slug": "atlanta-black-expo",
                    "pending_start": "2026-02-20",
                    "last_year_start": None,
                    "date_source": "auto-demoted-stale",
                },
                {
                    "slug": "west-end-comedy-fest",
                    "pending_start": None,
                    "last_year_start": None,
                    "date_source": "website",
                }
            ],
            "festivals_with_events_outside_announced_window": [
                {
                    "slug": "atlanta-film-festival",
                    "outside_count": 3,
                    "window": ["2026-04-23", "2026-05-03"],
                }
            ],
            "tentpole_fit_candidates": [
                {
                    "slug": "out-on-film",
                    "event_count": 2,
                    "program_series_count": 2,
                    "active_program_series_count": 0,
                }
            ],
        },
    }


def test_build_promotion_holds_derives_high_signal_sources() -> None:
    holds = _build_promotion_holds(_snapshot())
    targets = {row["target"]: row for row in holds}

    assert "atlanta-science-festival" in targets
    assert targets["atlanta-science-festival"]["reason"] == "festival_program fragmentation"

    assert "atlanta-fringe-festival" in targets
    assert targets["atlanta-fringe-festival"]["evidence"] == "52 short festival event descriptions"

    assert "render-atl" in targets
    assert targets["render-atl"]["reason"] == "festival event descriptions missing"

    assert "small-source" not in targets
    assert "ga-food-wine-festival" not in targets


def test_build_remediation_queue_orders_actionable_items() -> None:
    queue = _build_remediation_queue(_snapshot())

    assert queue[0]["target"] == "atlanta-science-festival"
    assert queue[0]["reason"] == "festival_program fragmentation"

    assert any(row["target"] == "toylanta" for row in queue)
    assert any(row["target"] == "atlanta-film-festival" and row["reason"] == "festival series descriptions weak" for row in queue)
    assert any(row["target"] == "out-on-film" and row["reason"] == "festival likely fits tentpole model" for row in queue)
    assert any(row["target"] == "west-end-comedy-fest" for row in queue)
    assert any(row["target"] == "atlanta-film-festival" for row in queue)
    assert not any(row["target"] == "atlanta-black-expo" for row in queue)
