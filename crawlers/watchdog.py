"""
Crawler regression detector.

Analyzes crawl_logs history to detect when a source that was previously
producing events has silently gone dark — either dropping to zero output
or experiencing a significant volume drop.

This module only detects regressions; it does not fix them.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime
from typing import Optional

logger = logging.getLogger(__name__)

# --- Detection thresholds ---

# Flag a source after this many consecutive runs returning 0 events.
CONSECUTIVE_ZERO_THRESHOLD = 2

# Flag if the most recent run's output falls below this fraction of the
# source's recent average (e.g. 0.25 = below 25%).
DROP_RATIO_THRESHOLD = 0.25


# --- Data types ---


@dataclass
class SourceRegression:
    """Describes a detected regression for one source."""

    slug: str
    name: str
    # "zero_output" | "significant_drop" | "never_worked"
    regression_type: str
    # Average events_found across recent successful crawl_logs entries.
    recent_avg: float
    # events_found from the most recent run.
    last_found: int
    # How many consecutive runs from the top returned 0 events.
    consecutive_zeros: int
    # Human-readable explanation.
    message: str


# --- Internal helpers ---


def _current_month() -> int:
    """Return the current month as an integer (1–12). Extracted so tests can monkeypatch."""
    return datetime.now().month


def _is_in_active_season(active_months: Optional[list[int]]) -> bool:
    """Return True when the source should be active this month.

    An empty or None active_months list means "always active".
    """
    if not active_months:
        return True
    return _current_month() in active_months


def _get_source_run_history() -> list[dict]:
    """
    Query active sources from the `sources` table and compute run stats.

    For each active source, fetches the last 10 successful crawl_logs entries
    and computes:
      - recent_avg: mean of events_found across those entries
      - last_found: events_found from the most recent entry
      - consecutive_zeros: how many leading 0s appear from the most recent entry

    Also reads `health_tags` and `active_months` from the source row.

    Returns a list of dicts with keys:
      slug, name, recent_avg, last_found, consecutive_zeros, health_tags, active_months
    """
    from db.client import get_client

    client = get_client()

    # Fetch all active sources.
    sources_resp = (
        client.table("sources")
        .select("id, slug, name, health_tags, active_months")
        .eq("is_active", True)
        .execute()
    )

    sources = sources_resp.data or []
    results: list[dict] = []

    for source in sources:
        slug = source.get("slug") or ""
        name = source.get("name") or slug
        health_tags: list[str] = source.get("health_tags") or []
        active_months: list[int] = source.get("active_months") or []

        # Fetch last 10 successful crawl_log entries for this source.
        logs_resp = (
            client.table("crawl_logs")
            .select("events_found")
            .eq("source_slug", slug)
            .eq("status", "success")
            .order("created_at", desc=True)
            .limit(10)
            .execute()
        )
        logs = logs_resp.data or []

        if not logs:
            # No history — skip; can't compute regressions without a baseline.
            continue

        counts = [row.get("events_found") or 0 for row in logs]
        recent_avg = sum(counts) / len(counts)
        last_found = counts[0]

        consecutive_zeros = 0
        for c in counts:
            if c == 0:
                consecutive_zeros += 1
            else:
                break

        results.append(
            {
                "slug": slug,
                "name": name,
                "recent_avg": recent_avg,
                "last_found": last_found,
                "consecutive_zeros": consecutive_zeros,
                "health_tags": health_tags,
                "active_months": active_months,
            }
        )

    return results


# --- Public API ---


def detect_regressions() -> list[SourceRegression]:
    """
    Detect sources that have regressed in output volume.

    Skips:
      - Seasonal sources that are outside their active_months window.
      - Sources where recent_avg == 0 and consecutive_zeros > 5 (never worked —
        a separate problem, not a regression).

    Flags:
      - "zero_output": consecutive_zeros >= CONSECUTIVE_ZERO_THRESHOLD
        AND recent_avg > 2 (source used to produce events, now silent).
      - "significant_drop": recent_avg > 5, last_found > 0, and
        last_found < recent_avg * DROP_RATIO_THRESHOLD.

    Returns a list of SourceRegression objects, one per flagged source.
    """
    history = _get_source_run_history()
    regressions: list[SourceRegression] = []

    for source in history:
        slug: str = source["slug"]
        name: str = source["name"]
        recent_avg: float = source["recent_avg"]
        last_found: int = source["last_found"]
        consecutive_zeros: int = source["consecutive_zeros"]
        health_tags: list[str] = source.get("health_tags") or []
        active_months: list[int] = source.get("active_months") or []

        # Skip seasonal sources that are out of season.
        if "seasonal" in health_tags and not _is_in_active_season(active_months):
            logger.debug(
                "Skipping seasonal source %s (not in active months %s)", slug, active_months
            )
            continue

        # Skip sources that appear to have never worked.
        if recent_avg == 0 and consecutive_zeros > 5:
            logger.debug(
                "Skipping never-worked source %s (avg=0, zeros=%s)", slug, consecutive_zeros
            )
            continue

        # --- Zero-output regression ---
        if consecutive_zeros >= CONSECUTIVE_ZERO_THRESHOLD and recent_avg > 2:
            regressions.append(
                SourceRegression(
                    slug=slug,
                    name=name,
                    regression_type="zero_output",
                    recent_avg=recent_avg,
                    last_found=last_found,
                    consecutive_zeros=consecutive_zeros,
                    message=(
                        f"{name} ({slug}): {consecutive_zeros} consecutive runs with 0 events "
                        f"(recent avg was {recent_avg:.1f})"
                    ),
                )
            )
            continue

        # --- Significant-drop regression ---
        if (
            recent_avg > 5
            and last_found > 0
            and last_found < recent_avg * DROP_RATIO_THRESHOLD
        ):
            regressions.append(
                SourceRegression(
                    slug=slug,
                    name=name,
                    regression_type="significant_drop",
                    recent_avg=recent_avg,
                    last_found=last_found,
                    consecutive_zeros=consecutive_zeros,
                    message=(
                        f"{name} ({slug}): last run produced {last_found} events "
                        f"vs recent avg {recent_avg:.1f} "
                        f"(dropped below {DROP_RATIO_THRESHOLD:.0%} threshold)"
                    ),
                )
            )

    if regressions:
        logger.warning(
            "Regression detector found %s flagged source(s): %s",
            len(regressions),
            [r.slug for r in regressions],
        )
    else:
        logger.info("Regression detector: no regressions detected across %s sources.", len(history))

    return regressions
