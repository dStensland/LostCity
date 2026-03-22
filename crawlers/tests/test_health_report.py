"""
Tests for health_report.py — quality scoring and report generation.
"""

from __future__ import annotations

from unittest.mock import MagicMock, patch

from health_report import compute_source_quality_score, generate_health_report


# ===== compute_source_quality_score =====

def test_quality_score_perfect_source():
    score = compute_source_quality_score(
        consecutive_successes=5, yield_ratio=1.0,
        lane_completeness=1.0, rejection_rate=0.0, days_since_success=0,
    )
    assert score >= 90


def test_quality_score_broken_source():
    score = compute_source_quality_score(
        consecutive_successes=0, yield_ratio=0.0,
        lane_completeness=0.0, rejection_rate=1.0, days_since_success=14,
    )
    assert score < 20


def test_quality_score_clamps_to_0_100():
    score = compute_source_quality_score(
        consecutive_successes=100, yield_ratio=2.0,
        lane_completeness=1.0, rejection_rate=0.0, days_since_success=0,
    )
    assert 0 <= score <= 100


def test_quality_score_clamps_minimum_at_zero():
    score = compute_source_quality_score(
        consecutive_successes=0, yield_ratio=0.0,
        lane_completeness=0.0, rejection_rate=2.0, days_since_success=100,
    )
    assert score >= 0


def test_quality_score_partial_success():
    """Source with 3 consecutive successes, decent yield, some rejections."""
    score = compute_source_quality_score(
        consecutive_successes=3, yield_ratio=0.9,
        lane_completeness=0.7, rejection_rate=0.1, days_since_success=1,
    )
    # 3 successes → run_success = min(100, 60) = 60
    # yield 0.9 within 10% of 1.0 → yield_stability = 100
    # lane_completeness 0.7 → 70
    # rejection 0.1 → (1-0.1)*100 = 90
    # days=1 → freshness = max(0, 90) = 90
    # weighted: 60*.30 + 100*.25 + 70*.20 + 90*.15 + 90*.10
    # = 18 + 25 + 14 + 13.5 + 9 = 79.5
    assert 70 <= score <= 90


def test_quality_score_yield_within_10_percent_is_full_score():
    """yield_ratio between 0.9 and 1.1 should give full yield stability score."""
    score_low = compute_source_quality_score(
        consecutive_successes=5, yield_ratio=0.91,
        lane_completeness=1.0, rejection_rate=0.0, days_since_success=0,
    )
    score_exact = compute_source_quality_score(
        consecutive_successes=5, yield_ratio=1.0,
        lane_completeness=1.0, rejection_rate=0.0, days_since_success=0,
    )
    assert score_low == score_exact


def test_quality_score_stale_source():
    """Source that succeeded 10 days ago but not recently should score low on freshness."""
    score = compute_source_quality_score(
        consecutive_successes=5, yield_ratio=1.0,
        lane_completeness=1.0, rejection_rate=0.0, days_since_success=10,
    )
    # freshness = max(0, 100 - 10*10) = 0
    # Everything else perfect: 100*.30 + 100*.25 + 100*.20 + 100*.15 + 0*.10
    # = 30 + 25 + 20 + 15 + 0 = 90
    assert 85 <= score <= 95


def test_quality_score_zero_yield_ratio_scores_low_on_yield():
    """Zero yield (source returned nothing) should produce a low yield sub-score."""
    score_zero_yield = compute_source_quality_score(
        consecutive_successes=5, yield_ratio=0.0,
        lane_completeness=1.0, rejection_rate=0.0, days_since_success=0,
    )
    score_good_yield = compute_source_quality_score(
        consecutive_successes=5, yield_ratio=1.0,
        lane_completeness=1.0, rejection_rate=0.0, days_since_success=0,
    )
    assert score_zero_yield < score_good_yield


# ===== generate_health_report =====

def _make_crawl_result(slug: str, *, success: bool, events_found: int = 10) -> dict:
    return {
        "source_slug": slug,
        "success": success,
        "events_found": events_found,
        "events_new": events_found,
        "events_updated": 0,
        "error": None if success else "Connection refused",
    }


def test_generate_health_report_counts_correctly(monkeypatch):
    """Report aggregates succeeded/failed/zero correctly."""
    results = [
        _make_crawl_result("source-a", success=True, events_found=5),
        _make_crawl_result("source-b", success=True, events_found=0),
        _make_crawl_result("source-c", success=False, events_found=0),
    ]

    captured_inserts = []

    mock_table = MagicMock()
    mock_table.insert.return_value = mock_table
    mock_table.execute.return_value = MagicMock(data=[{"id": 1}])

    mock_client = MagicMock()
    mock_client.table.return_value = mock_table

    monkeypatch.setattr("health_report.writes_enabled", lambda: True)
    monkeypatch.setattr("health_report.get_client", lambda: mock_client)

    def capture_insert(payload):
        captured_inserts.append(payload)
        return mock_table

    mock_table.insert.side_effect = capture_insert

    report = generate_health_report(run_id="run-001", crawl_results=results)

    assert report["total_sources"] == 3
    assert report["sources_succeeded"] == 2
    assert report["sources_failed"] == 1
    assert report["sources_zero_events"] == 1  # source-b succeeded but 0 events


def test_generate_health_report_raises_alert_when_many_broken(monkeypatch):
    """More than 5 failed sources triggers a system_alert insert."""
    results = [
        _make_crawl_result(f"source-{i}", success=False)
        for i in range(6)
    ]

    alert_inserts = []
    report_inserts = []

    def make_table(table_name):
        mock_table = MagicMock()

        def capture(payload):
            if table_name == "system_alerts":
                alert_inserts.append(payload)
            else:
                report_inserts.append(payload)
            return mock_table

        mock_table.insert.side_effect = capture
        mock_table.execute.return_value = MagicMock(data=[{"id": 1}])
        return mock_table

    mock_client = MagicMock()
    mock_client.table.side_effect = make_table

    monkeypatch.setattr("health_report.writes_enabled", lambda: True)
    monkeypatch.setattr("health_report.get_client", lambda: mock_client)

    generate_health_report(run_id="run-002", crawl_results=results)

    assert len(alert_inserts) >= 1
    assert any(
        a.get("alert_type") == "many_broken_sources"
        for a in alert_inserts
    )


def test_generate_health_report_no_alert_when_few_broken(monkeypatch):
    """Fewer than 5 failures should NOT trigger a system_alert."""
    results = [
        _make_crawl_result(f"source-{i}", success=False)
        for i in range(4)
    ]

    alert_inserts = []

    def make_table(table_name):
        mock_table = MagicMock()

        def capture(payload):
            if table_name == "system_alerts":
                alert_inserts.append(payload)
            return mock_table

        mock_table.insert.side_effect = capture
        mock_table.execute.return_value = MagicMock(data=[{"id": 1}])
        return mock_table

    mock_client = MagicMock()
    mock_client.table.side_effect = make_table

    monkeypatch.setattr("health_report.writes_enabled", lambda: True)
    monkeypatch.setattr("health_report.get_client", lambda: mock_client)

    generate_health_report(run_id="run-003", crawl_results=results)

    assert len(alert_inserts) == 0


def test_generate_health_report_skips_writes_in_dry_run(monkeypatch):
    """When writes_enabled() is False, no DB calls should be made."""
    results = [_make_crawl_result("source-a", success=True)]

    mock_client = MagicMock()

    monkeypatch.setattr("health_report.writes_enabled", lambda: False)
    monkeypatch.setattr("health_report.get_client", lambda: mock_client)

    report = generate_health_report(run_id="run-dry", crawl_results=results)

    mock_client.table.assert_not_called()
    assert report["total_sources"] == 1


def test_generate_health_report_returns_dict_shape(monkeypatch):
    """Return value has all expected top-level keys."""
    results = [_make_crawl_result("source-a", success=True, events_found=3)]

    mock_table = MagicMock()
    mock_table.insert.return_value = mock_table
    mock_table.execute.return_value = MagicMock(data=[{"id": 42}])

    mock_client = MagicMock()
    mock_client.table.return_value = mock_table

    monkeypatch.setattr("health_report.writes_enabled", lambda: True)
    monkeypatch.setattr("health_report.get_client", lambda: mock_client)

    report = generate_health_report(run_id="run-shape", crawl_results=results)

    for key in (
        "run_id", "total_sources", "sources_succeeded", "sources_failed",
        "sources_zero_events", "fleet_event_yield",
    ):
        assert key in report, f"Missing key: {key}"
