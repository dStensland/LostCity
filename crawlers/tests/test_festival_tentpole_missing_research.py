from datetime import date

from festival_tentpole_missing_research import Target, _evaluate_target


def make_target() -> Target:
    return Target(
        canonical_key="sweetwater-420-fest",
        name="SweetWater 420 Fest",
        kind="tentpole_event",
        tier="tier_a",
        portal_slug="atlanta",
        aliases=("sweetwater 420 fest",),
        source_url="https://www.sweetwater420fest.com/",
        source_slug_hints=("sweetwater-420-fest",),
        expected_window={"start_month": 4, "end_month": 4},
        surface_in_horizon=True,
    )


def test_event_only_horizon_coverage_counts_as_covered_horizon():
    target = make_target()
    row = _evaluate_target(
        target,
        festivals=[],
        feed_rows=[],
        event_rows=[
            {
                "title": "SweetWater 420 Fest 2026",
                "start_date": "2026-04-20",
                "image_url": "https://example.com/sweetwater.jpg",
                "festival_id": None,
                "source_id": 42,
            }
        ],
        sources=[],
        latest_crawl_by_source_id={},
        source_slug_by_id={42: "sweetwater-420-fest"},
        horizon_start=date(2026, 4, 14),
        horizon_end=date(2026, 10, 4),
    )

    assert row["status"] == "covered_horizon"
    assert row["blocking_cause"] == "none"


def test_event_only_outside_window_counts_as_covered_data_not_horizon():
    target = make_target()
    row = _evaluate_target(
        target,
        festivals=[],
        feed_rows=[],
        event_rows=[
            {
                "title": "SweetWater 420 Fest 2027",
                "start_date": "2027-04-20",
                "image_url": "https://example.com/sweetwater.jpg",
                "festival_id": None,
                "source_id": 42,
            }
        ],
        sources=[],
        latest_crawl_by_source_id={},
        source_slug_by_id={42: "sweetwater-420-fest"},
        horizon_start=date(2026, 4, 14),
        horizon_end=date(2026, 10, 4),
    )

    assert row["status"] == "covered_data_not_horizon"
    assert row["blocking_cause"] == "outside_current_horizon_window"


def test_active_source_with_no_rows_stays_active_source_zero_yield():
    target = make_target()
    row = _evaluate_target(
        target,
        festivals=[],
        feed_rows=[],
        event_rows=[],
        sources=[
            {
                "id": 42,
                "slug": "sweetwater-420-fest",
                "name": "SweetWater 420 Fest",
                "url": "https://www.sweetwater420fest.com/",
                "is_active": True,
                "expected_event_count": 0,
                "last_crawled_at": "2026-04-07T00:00:00",
            }
        ],
        latest_crawl_by_source_id={
            42: {
                "events_found": 0,
            }
        },
        source_slug_by_id={42: "sweetwater-420-fest"},
        horizon_start=date(2026, 4, 14),
        horizon_end=date(2026, 10, 4),
    )

    assert row["status"] == "active_source_zero_yield"
    assert row["blocking_cause"] == "active_source_zero_yield"
