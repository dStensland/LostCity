"""
Crawler health digest.

Combines watchlist alerts, regression detection, and category coverage
into a single structured report. Runs after every crawl batch.
Saves JSON reports to crawlers/reports/health/ for historical tracking.
"""

from __future__ import annotations

import dataclasses
import json
import logging
import os
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Optional

from watchlist import WatchlistAlert, get_watchlist_status
from watchdog import SourceRegression, detect_regressions

logger = logging.getLogger(__name__)

DIGEST_DIR = os.path.join(os.path.dirname(__file__), "reports", "health")


# ---------------------------------------------------------------------------
# Dataclass
# ---------------------------------------------------------------------------


@dataclass
class HealthDigest:
    timestamp: str
    overall_health: str  # "healthy" | "degraded" | "critical"
    critical_count: int
    warning_count: int
    watchlist_alerts: list  # list of dicts (serialised WatchlistAlert)
    regressions: list       # list of dicts (serialised SourceRegression)
    category_coverage: dict
    active_sources: int
    producing_sources: int

    # ------------------------------------------------------------------
    # Serialisation
    # ------------------------------------------------------------------

    def to_dict(self) -> dict:
        return {
            "timestamp": self.timestamp,
            "overall_health": self.overall_health,
            "critical_count": self.critical_count,
            "warning_count": self.warning_count,
            "watchlist_alerts": self.watchlist_alerts,
            "regressions": self.regressions,
            "category_coverage": self.category_coverage,
            "active_sources": self.active_sources,
            "producing_sources": self.producing_sources,
        }

    # ------------------------------------------------------------------
    # Persistence
    # ------------------------------------------------------------------

    def save(self) -> str:
        """Write digest JSON to DIGEST_DIR/digest-{timestamp}.json.

        Returns the absolute path of the written file.
        """
        os.makedirs(DIGEST_DIR, exist_ok=True)
        # Use a filesystem-safe version of the timestamp
        safe_ts = self.timestamp.replace(":", "-").replace(" ", "_")
        filename = f"digest-{safe_ts}.json"
        path = os.path.join(DIGEST_DIR, filename)
        with open(path, "w", encoding="utf-8") as fh:
            json.dump(self.to_dict(), fh, indent=2)
        logger.debug("Health digest saved to %s", path)
        return path

    # ------------------------------------------------------------------
    # Logging
    # ------------------------------------------------------------------

    def log_summary(self) -> None:
        """Log a concise one-line status plus critical alerts and top-5 regressions."""
        status_line = (
            f"[HealthDigest] {self.overall_health.upper()} | "
            f"{self.critical_count} critical, {self.warning_count} warnings, "
            f"{len(self.regressions)} regressions | "
            f"{self.producing_sources}/{self.active_sources} sources producing"
        )

        if self.overall_health == "critical":
            logger.error(status_line)
        elif self.overall_health == "degraded":
            logger.warning(status_line)
        else:
            logger.info(status_line)

        # Emit critical alerts individually so they surface in logs
        for alert in self.watchlist_alerts:
            if alert.get("severity") == "critical":
                logger.error("[HealthDigest] %s", alert.get("message", alert["slug"]))

        # Top 5 regressions
        for regression in self.regressions[:5]:
            logger.warning(
                "[HealthDigest] REGRESSION: %s", regression.get("message", regression["slug"])
            )


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _get_category_coverage() -> dict:
    """Query events in the next 30 days and return counts by category_id.

    Returns an empty dict if the query fails (non-fatal).
    """
    try:
        from db.client import get_client

        client = get_client()
        now = datetime.now(timezone.utc)
        cutoff = now + timedelta(days=30)

        resp = (
            client.table("events")
            .select("category_id")
            .eq("is_active", True)
            .gte("start_date", now.strftime("%Y-%m-%d"))
            .lte("start_date", cutoff.strftime("%Y-%m-%d"))
            .execute()
        )

        counts: dict = {}
        for row in resp.data or []:
            cat = row.get("category_id") or "uncategorized"
            counts[cat] = counts.get(cat, 0) + 1

        return counts
    except Exception as exc:
        logger.debug("_get_category_coverage failed (non-fatal): %s", exc)
        return {}


def _count_active_sources() -> tuple[int, int]:
    """Return (active_sources, producing_sources).

    producing_sources = sources with at least one event in next 30 days.
    Returns (0, 0) on failure (non-fatal).
    """
    try:
        from db.client import get_client

        client = get_client()
        now = datetime.now(timezone.utc)
        cutoff = now + timedelta(days=30)

        # Count active sources
        active_resp = (
            client.table("sources")
            .select("id", count="exact")
            .eq("is_active", True)
            .execute()
        )
        active_count = active_resp.count or 0

        # Count sources with upcoming events (distinct source_ids)
        events_resp = (
            client.table("events")
            .select("source_id")
            .eq("is_active", True)
            .gte("start_date", now.strftime("%Y-%m-%d"))
            .lte("start_date", cutoff.strftime("%Y-%m-%d"))
            .execute()
        )
        producing_ids = {row["source_id"] for row in (events_resp.data or []) if row.get("source_id")}
        producing_count = len(producing_ids)

        return active_count, producing_count
    except Exception as exc:
        logger.debug("_count_active_sources failed (non-fatal): %s", exc)
        return 0, 0


def _alert_to_dict(alert: WatchlistAlert) -> dict:
    return {
        "slug": alert.slug,
        "name": alert.name,
        "category": alert.category,
        "severity": alert.severity,
        "expected_min": alert.expected_min,
        "actual_count": alert.actual_count,
        "message": alert.message,
    }


def _regression_to_dict(regression: SourceRegression) -> dict:
    return {
        "slug": regression.slug,
        "name": regression.name,
        "regression_type": regression.regression_type,
        "recent_avg": regression.recent_avg,
        "last_found": regression.last_found,
        "consecutive_zeros": regression.consecutive_zeros,
        "message": regression.message,
    }


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def generate_health_digest() -> HealthDigest:
    """Generate a full health digest from watchlist, regressions, and coverage.

    All sub-queries are individually fault-tolerant; this function should
    not raise unless there is a code-level bug.
    """
    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    # 1. Watchlist alerts
    try:
        alerts: list[WatchlistAlert] = get_watchlist_status()
    except Exception as exc:
        logger.warning("get_watchlist_status failed: %s", exc)
        alerts = []

    # 2. Regression detection
    try:
        regressions: list[SourceRegression] = detect_regressions()
    except Exception as exc:
        logger.warning("detect_regressions failed: %s", exc)
        regressions = []

    # 3. Category coverage
    category_coverage = _get_category_coverage()

    # 4. Source counts
    active_sources, producing_sources = _count_active_sources()

    # 5. Derived counts
    critical_count = sum(1 for a in alerts if a.severity == "critical")
    warning_count = sum(1 for a in alerts if a.severity == "warning")

    # 6. Overall health
    if critical_count > 0:
        overall_health = "critical"
    elif warning_count > 3:
        overall_health = "degraded"
    else:
        overall_health = "healthy"

    return HealthDigest(
        timestamp=timestamp,
        overall_health=overall_health,
        critical_count=critical_count,
        warning_count=warning_count,
        watchlist_alerts=[_alert_to_dict(a) for a in alerts],
        regressions=[_regression_to_dict(r) for r in regressions],
        category_coverage=category_coverage,
        active_sources=active_sources,
        producing_sources=producing_sources,
    )


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    digest = generate_health_digest()
    digest.log_summary()
    path = digest.save()
    print(f"Digest saved: {path}")
