"""Tests for the watchdog regression detector module."""

from __future__ import annotations

import pytest


def _make_source(
    *,
    slug: str = "test-source",
    name: str = "Test Source",
    recent_avg: float = 0.0,
    last_found: int = 0,
    consecutive_zeros: int = 0,
    health_tags: list[str] | None = None,
    active_months: list[int] | None = None,
) -> dict:
    return {
        "slug": slug,
        "name": name,
        "recent_avg": recent_avg,
        "last_found": last_found,
        "consecutive_zeros": consecutive_zeros,
        "health_tags": health_tags or [],
        "active_months": active_months or [],
    }


def test_detect_regression_when_source_drops_to_zero(monkeypatch):
    """Source with avg 12 and 3 consecutive zeros should be flagged as zero_output."""
    import watchdog

    mock_history = [
        _make_source(
            slug="trivia-night",
            name="Trivia Night Bar",
            recent_avg=12.0,
            last_found=0,
            consecutive_zeros=3,
        )
    ]
    monkeypatch.setattr(watchdog, "_get_source_run_history", lambda: mock_history)

    regressions = watchdog.detect_regressions()

    assert len(regressions) == 1
    assert regressions[0].slug == "trivia-night"
    assert regressions[0].regression_type == "zero_output"
    assert regressions[0].recent_avg == 12.0
    assert regressions[0].consecutive_zeros == 3


def test_no_regression_when_source_is_healthy(monkeypatch):
    """Source with avg 12 and last_found=11 should not be flagged."""
    import watchdog

    mock_history = [
        _make_source(
            slug="healthy-venue",
            name="Healthy Venue",
            recent_avg=12.0,
            last_found=11,
            consecutive_zeros=0,
        )
    ]
    monkeypatch.setattr(watchdog, "_get_source_run_history", lambda: mock_history)

    regressions = watchdog.detect_regressions()

    assert regressions == []


def test_detect_regression_significant_drop(monkeypatch):
    """Source with avg 20, last_found=3, consecutive_zeros=0 should be flagged as significant_drop."""
    import watchdog

    mock_history = [
        _make_source(
            slug="dropping-venue",
            name="Dropping Venue",
            recent_avg=20.0,
            last_found=3,
            consecutive_zeros=0,
        )
    ]
    monkeypatch.setattr(watchdog, "_get_source_run_history", lambda: mock_history)

    regressions = watchdog.detect_regressions()

    assert len(regressions) == 1
    assert regressions[0].slug == "dropping-venue"
    assert regressions[0].regression_type == "significant_drop"
    assert regressions[0].last_found == 3
    # last_found (3) < recent_avg (20) * 0.25 (5.0) → significant drop
    assert regressions[0].recent_avg == 20.0


def test_seasonal_source_not_flagged(monkeypatch):
    """Seasonal source outside its active months should be skipped entirely."""
    import watchdog

    # Current month is April (4). active_months=[9] means September only.
    mock_history = [
        _make_source(
            slug="summer-festival",
            name="Summer Festival",
            recent_avg=0.0,
            last_found=0,
            consecutive_zeros=10,
            health_tags=["seasonal"],
            active_months=[9],
        )
    ]
    monkeypatch.setattr(watchdog, "_get_source_run_history", lambda: mock_history)

    regressions = watchdog.detect_regressions()

    assert regressions == []


def test_never_worked_source_not_flagged_as_regression(monkeypatch):
    """Source that has never worked (avg=0, many zeros) should be skipped — separate problem."""
    import watchdog

    mock_history = [
        _make_source(
            slug="never-worked",
            name="Never Worked",
            recent_avg=0.0,
            last_found=0,
            consecutive_zeros=8,
        )
    ]
    monkeypatch.setattr(watchdog, "_get_source_run_history", lambda: mock_history)

    regressions = watchdog.detect_regressions()

    assert regressions == []


def test_zero_output_requires_avg_above_threshold(monkeypatch):
    """Source with recent_avg <= 2 should not be flagged even with consecutive zeros."""
    import watchdog

    mock_history = [
        _make_source(
            slug="low-volume-source",
            name="Low Volume",
            recent_avg=1.5,
            last_found=0,
            consecutive_zeros=3,
        )
    ]
    monkeypatch.setattr(watchdog, "_get_source_run_history", lambda: mock_history)

    regressions = watchdog.detect_regressions()

    assert regressions == []


def test_significant_drop_requires_avg_above_threshold(monkeypatch):
    """Source with recent_avg <= 5 should not be flagged as significant_drop."""
    import watchdog

    mock_history = [
        _make_source(
            slug="micro-source",
            name="Micro Source",
            recent_avg=4.0,
            last_found=0,
            consecutive_zeros=0,
        )
    ]
    monkeypatch.setattr(watchdog, "_get_source_run_history", lambda: mock_history)

    regressions = watchdog.detect_regressions()

    assert regressions == []


def test_regression_has_message_set(monkeypatch):
    """All returned SourceRegression objects should have a non-empty message."""
    import watchdog

    mock_history = [
        _make_source(
            slug="trivia-night",
            name="Trivia Night Bar",
            recent_avg=12.0,
            last_found=0,
            consecutive_zeros=3,
        )
    ]
    monkeypatch.setattr(watchdog, "_get_source_run_history", lambda: mock_history)

    regressions = watchdog.detect_regressions()

    assert len(regressions) == 1
    assert regressions[0].message
    assert isinstance(regressions[0].message, str)


def test_seasonal_source_in_active_month_is_checked(monkeypatch):
    """Seasonal source IN its active month should still be checked for regressions."""
    import watchdog
    import datetime

    # Patch the current month to be 4 (April) — same as active_months
    monkeypatch.setattr(watchdog, "_current_month", lambda: 4)

    mock_history = [
        _make_source(
            slug="april-festival",
            name="April Festival",
            recent_avg=15.0,
            last_found=0,
            consecutive_zeros=3,
            health_tags=["seasonal"],
            active_months=[4],
        )
    ]
    monkeypatch.setattr(watchdog, "_get_source_run_history", lambda: mock_history)

    regressions = watchdog.detect_regressions()

    assert len(regressions) == 1
    assert regressions[0].slug == "april-festival"
    assert regressions[0].regression_type == "zero_output"


def test_multiple_sources_mixed_results(monkeypatch):
    """With multiple sources, only regressions are returned."""
    import watchdog

    mock_history = [
        _make_source(
            slug="healthy-one",
            name="Healthy One",
            recent_avg=10.0,
            last_found=9,
            consecutive_zeros=0,
        ),
        _make_source(
            slug="broken-one",
            name="Broken One",
            recent_avg=10.0,
            last_found=0,
            consecutive_zeros=2,
        ),
        _make_source(
            slug="dropping-one",
            name="Dropping One",
            recent_avg=20.0,
            last_found=2,
            consecutive_zeros=0,
        ),
    ]
    monkeypatch.setattr(watchdog, "_get_source_run_history", lambda: mock_history)

    regressions = watchdog.detect_regressions()

    slugs = [r.slug for r in regressions]
    assert "healthy-one" not in slugs
    assert "broken-one" in slugs
    assert "dropping-one" in slugs
    assert len(regressions) == 2
