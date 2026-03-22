"""
Post-crawl health reporting and source quality scoring.

Generates structured health summaries after each crawl run and persists
them to the crawl_health_reports table. Raises system_alerts when
fleet-wide P0 conditions are detected (e.g. >5 sources broken in one run).

Quality scoring formula (0-100):
  score = (
      run_success_score     * 0.30  +  # 0-100: min(100, consecutive_successes * 20)
      yield_stability_score * 0.25  +  # 0-100: 100 if yield_ratio within 10% of 1.0
      lane_completeness     * 0.20  +  # 0-100: direct percentage
      rejection_rate_score  * 0.15  +  # 0-100: (1 - rejection_rate) * 100
      freshness_score       * 0.10     # 0-100: max(0, 100 - days_since_success * 10)
  )
"""

from __future__ import annotations

import logging
from typing import Any

from db.client import get_client, writes_enabled

logger = logging.getLogger(__name__)

# P0 threshold: more than this many sources broken in a single run raises an alert.
_BROKEN_SOURCE_ALERT_THRESHOLD = 5


def compute_source_quality_score(
    *,
    consecutive_successes: int,
    yield_ratio: float,
    lane_completeness: float,
    rejection_rate: float,
    days_since_success: int,
) -> float:
    """Compute a 0-100 quality score for a crawl source.

    Args:
        consecutive_successes: Number of consecutive successful crawl runs.
        yield_ratio: Current event yield as a ratio of the baseline
            (1.0 = at baseline, 0.5 = half baseline, 2.0 = double).
        lane_completeness: Fraction of required data lanes populated (0.0-1.0).
        rejection_rate: Fraction of events rejected by validation (0.0-1.0).
        days_since_success: Days elapsed since the last successful crawl.

    Returns:
        float between 0 and 100 inclusive.
    """
    # Sub-scores, each 0-100.
    run_success_score = min(100.0, consecutive_successes * 20.0)

    # Yield stability: full score when within 10% of baseline (0.9-1.1 range).
    deviation = abs(yield_ratio - 1.0)
    if deviation <= 0.10:
        yield_stability_score = 100.0
    else:
        # Linearly scale down from 100 at 10% deviation to 0 at 110% deviation.
        yield_stability_score = max(0.0, 100.0 - ((deviation - 0.10) / 1.00) * 100.0)

    lane_score = max(0.0, min(100.0, lane_completeness * 100.0))

    rejection_rate_score = max(0.0, (1.0 - rejection_rate) * 100.0)

    freshness_score = max(0.0, 100.0 - days_since_success * 10.0)

    score = (
        run_success_score     * 0.30
        + yield_stability_score * 0.25
        + lane_score            * 0.20
        + rejection_rate_score  * 0.15
        + freshness_score       * 0.10
    )

    return max(0.0, min(100.0, score))


def generate_health_report(
    run_id: str,
    crawl_results: list[dict[str, Any]],
) -> dict[str, Any]:
    """Generate and persist a post-crawl health report.

    Args:
        run_id: Unique identifier for this crawl run (e.g. ISO timestamp or UUID).
        crawl_results: List of per-source result dicts, each containing:
            - source_slug (str)
            - success (bool)
            - events_found (int)
            - events_new (int)
            - events_updated (int)
            - error (str | None)

    Returns:
        Report dict with keys: run_id, total_sources, sources_succeeded,
        sources_failed, sources_zero_events, fleet_event_yield,
        sources_yield_drop, sources_newly_broken.
    """
    # Tally counts.
    total = len(crawl_results)
    succeeded = sum(1 for r in crawl_results if r.get("success"))
    failed = sum(1 for r in crawl_results if not r.get("success"))
    zero_events = sum(
        1 for r in crawl_results
        if r.get("success") and (r.get("events_found") or 0) == 0
    )
    fleet_yield = sum(r.get("events_found") or 0 for r in crawl_results)

    newly_broken = [
        r["source_slug"]
        for r in crawl_results
        if not r.get("success") and r.get("source_slug")
    ]

    report: dict[str, Any] = {
        "run_id": run_id,
        "total_sources": total,
        "sources_succeeded": succeeded,
        "sources_failed": failed,
        "sources_zero_events": zero_events,
        "fleet_event_yield": fleet_yield,
        "sources_yield_drop": [],
        "sources_newly_broken": newly_broken,
        "summary": (
            f"{succeeded}/{total} sources succeeded, "
            f"{failed} failed, "
            f"{zero_events} returned zero events, "
            f"{fleet_yield} total events yielded."
        ),
    }

    if not writes_enabled():
        logger.info("[DRY RUN] Skipping health report DB write (run_id=%s)", run_id)
        return report

    client = get_client()

    # Persist the health report row.
    try:
        client.table("crawl_health_reports").insert({
            "run_id": run_id,
            "total_sources": total,
            "sources_succeeded": succeeded,
            "sources_failed": failed,
            "sources_zero_events": zero_events,
            "sources_yield_drop": [],
            "sources_newly_broken": newly_broken,
            "fleet_event_yield": fleet_yield,
            "enrichment_queue_depth": {},
            "summary": report["summary"],
        }).execute()
        logger.info("Health report persisted for run_id=%s", run_id)
    except Exception:
        logger.exception("Failed to persist health report for run_id=%s", run_id)

    # P0 alert: too many broken sources in a single run.
    if failed > _BROKEN_SOURCE_ALERT_THRESHOLD:
        _raise_system_alert(
            client=client,
            alert_type="many_broken_sources",
            severity="critical",
            message=(
                f"{failed} sources failed in run {run_id} "
                f"(threshold: {_BROKEN_SOURCE_ALERT_THRESHOLD})"
            ),
            metadata={
                "run_id": run_id,
                "failed_count": failed,
                "sources": newly_broken,
            },
        )

    return report


def _raise_system_alert(
    *,
    client: Any,
    alert_type: str,
    severity: str,
    message: str,
    metadata: dict[str, Any],
) -> None:
    """Insert a row into system_alerts."""
    try:
        client.table("system_alerts").insert({
            "alert_type": alert_type,
            "severity": severity,
            "message": message,
            "metadata": metadata,
        }).execute()
        logger.warning("System alert raised: [%s/%s] %s", severity, alert_type, message)
    except Exception:
        logger.exception("Failed to persist system alert: %s", message)
