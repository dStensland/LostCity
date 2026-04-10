"""Tests for the health_digest module.

TDD: tests written before implementation.
Run with: python3 -m pytest tests/test_health_digest.py -v
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass
from unittest.mock import MagicMock

import pytest

import health_digest
from health_digest import HealthDigest, generate_health_digest
from watchlist import WatchlistAlert
from watchdog import SourceRegression


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_critical_alert() -> WatchlistAlert:
    return WatchlistAlert(
        slug="alliance-theatre",
        name="Alliance Theatre",
        category="theater",
        severity="critical",
        expected_min=5,
        actual_count=0,
        message="CRITICAL: Alliance Theatre (alliance-theatre) has 0 events in next 30 days",
    )


def _make_warning_alert() -> WatchlistAlert:
    return WatchlistAlert(
        slug="dads-garage",
        name="Dad's Garage",
        category="theater",
        severity="warning",
        expected_min=10,
        actual_count=3,
        message="WARNING: Dad's Garage (dads-garage) has 3 events (expected >= 10) in next 30 days",
    )


def _make_regression() -> SourceRegression:
    return SourceRegression(
        slug="terminal-west",
        name="Terminal West",
        regression_type="zero_output",
        recent_avg=12.5,
        last_found=0,
        consecutive_zeros=3,
        message="Terminal West (terminal-west): 3 consecutive runs with 0 events (recent avg was 12.5)",
    )


# ---------------------------------------------------------------------------
# Test 1: critical_count reflects watchlist critical alerts
# ---------------------------------------------------------------------------


def test_digest_includes_watchlist_alerts(monkeypatch):
    """Mock one critical alert; verify digest.critical_count == 1."""
    monkeypatch.setattr(
        health_digest, "get_watchlist_status", lambda: [_make_critical_alert()]
    )
    monkeypatch.setattr(health_digest, "detect_regressions", lambda: [])
    monkeypatch.setattr(health_digest, "_get_category_coverage", lambda: {})
    monkeypatch.setattr(health_digest, "_count_active_sources", lambda: (50, 40))

    digest = generate_health_digest()

    assert digest.critical_count == 1
    assert digest.warning_count == 0
    assert digest.overall_health == "critical"
    assert len(digest.watchlist_alerts) == 1
    assert digest.watchlist_alerts[0]["slug"] == "alliance-theatre"
    assert digest.watchlist_alerts[0]["severity"] == "critical"


# ---------------------------------------------------------------------------
# Test 2: overall_health == "healthy" when nothing is flagged
# ---------------------------------------------------------------------------


def test_digest_calculates_overall_health_score(monkeypatch):
    """Mock no alerts/regressions; verify overall_health == 'healthy'."""
    monkeypatch.setattr(health_digest, "get_watchlist_status", lambda: [])
    monkeypatch.setattr(health_digest, "detect_regressions", lambda: [])
    monkeypatch.setattr(health_digest, "_get_category_coverage", lambda: {})
    monkeypatch.setattr(health_digest, "_count_active_sources", lambda: (50, 45))

    digest = generate_health_digest()

    assert digest.overall_health == "healthy"
    assert digest.critical_count == 0
    assert digest.warning_count == 0
    assert digest.active_sources == 50
    assert digest.producing_sources == 45


# ---------------------------------------------------------------------------
# Test 3: save() writes a valid JSON file to tmp_path
# ---------------------------------------------------------------------------


def test_digest_logs_to_json(monkeypatch, tmp_path):
    """Mock everything empty, call save() to tmp_path, verify JSON file created."""
    monkeypatch.setattr(health_digest, "get_watchlist_status", lambda: [])
    monkeypatch.setattr(health_digest, "detect_regressions", lambda: [])
    monkeypatch.setattr(health_digest, "_get_category_coverage", lambda: {})
    monkeypatch.setattr(health_digest, "_count_active_sources", lambda: (0, 0))

    # Override DIGEST_DIR so files land in tmp_path
    monkeypatch.setattr(health_digest, "DIGEST_DIR", str(tmp_path))

    digest = generate_health_digest()
    saved_path = digest.save()

    # File must exist
    assert os.path.exists(saved_path), f"Expected JSON file at {saved_path}"

    # File must be valid JSON with required keys
    with open(saved_path) as f:
        data = json.load(f)

    assert "timestamp" in data
    assert "overall_health" in data
    assert "critical_count" in data
    assert "warning_count" in data
    assert "watchlist_alerts" in data
    assert "regressions" in data
    assert "category_coverage" in data
    assert "active_sources" in data
    assert "producing_sources" in data

    assert data["overall_health"] == "healthy"
    assert data["critical_count"] == 0


# ---------------------------------------------------------------------------
# Test 4: degraded health when >3 warnings but no criticals
# ---------------------------------------------------------------------------


def test_digest_degraded_on_many_warnings(monkeypatch):
    """More than 3 warnings with no criticals should produce 'degraded' health."""
    warnings = [_make_warning_alert() for _ in range(4)]
    monkeypatch.setattr(health_digest, "get_watchlist_status", lambda: warnings)
    monkeypatch.setattr(health_digest, "detect_regressions", lambda: [])
    monkeypatch.setattr(health_digest, "_get_category_coverage", lambda: {})
    monkeypatch.setattr(health_digest, "_count_active_sources", lambda: (50, 30))

    digest = generate_health_digest()

    assert digest.overall_health == "degraded"
    assert digest.warning_count == 4
    assert digest.critical_count == 0


# ---------------------------------------------------------------------------
# Test 5: regressions are included in digest output
# ---------------------------------------------------------------------------


def test_digest_includes_regressions(monkeypatch):
    """Detected regressions should appear in digest.regressions."""
    monkeypatch.setattr(health_digest, "get_watchlist_status", lambda: [])
    monkeypatch.setattr(
        health_digest, "detect_regressions", lambda: [_make_regression()]
    )
    monkeypatch.setattr(health_digest, "_get_category_coverage", lambda: {})
    monkeypatch.setattr(health_digest, "_count_active_sources", lambda: (50, 40))

    digest = generate_health_digest()

    assert len(digest.regressions) == 1
    assert digest.regressions[0]["slug"] == "terminal-west"
    assert digest.regressions[0]["regression_type"] == "zero_output"


# ---------------------------------------------------------------------------
# Test 6: log_summary() runs without error
# ---------------------------------------------------------------------------


def test_digest_log_summary_runs(monkeypatch):
    """log_summary() should execute without raising on any digest state."""
    monkeypatch.setattr(
        health_digest,
        "get_watchlist_status",
        lambda: [_make_critical_alert(), _make_warning_alert()],
    )
    monkeypatch.setattr(
        health_digest, "detect_regressions", lambda: [_make_regression()]
    )
    monkeypatch.setattr(health_digest, "_get_category_coverage", lambda: {"music": 42})
    monkeypatch.setattr(health_digest, "_count_active_sources", lambda: (100, 80))

    digest = generate_health_digest()

    # Must not raise
    digest.log_summary()
