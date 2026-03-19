#!/usr/bin/env python3
"""
Crawl frequency optimizer.

Analyzes crawl_logs history for every active source and recommends the most
efficient crawl_frequency setting based on observed change rate, new-event
yield, and dormancy patterns.

Usage:
  python3 scripts/crawl_frequency_optimizer.py                 # Report only
  python3 scripts/crawl_frequency_optimizer.py --apply         # Apply changes
  python3 scripts/crawl_frequency_optimizer.py --source <slug> # Single source
  python3 scripts/crawl_frequency_optimizer.py --verbose       # Per-source detail
  python3 scripts/crawl_frequency_optimizer.py --window 60     # Look back N runs
"""

from __future__ import annotations

import argparse
import os
import sys
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from db import get_client  # noqa: E402

# ===== CONSTANTS =====

VALID_FREQUENCIES = ("daily", "twice_weekly", "weekly", "monthly")

# Slugs whose slug name contains one of these substrings are always daily.
# These are high-volume aggregator platforms where new events appear continuously.
AGGREGATOR_SLUG_SUBSTRINGS = (
    "ticketmaster",
    "eventbrite",
    "dice",
)

# Crawl savings vs daily (crawls per week saved per source)
WEEKLY_SAVES_PER_SOURCE = {
    "daily": 0,
    "twice_weekly": 5,    # 7 - 2
    "weekly": 6,           # 7 - 1
    "monthly": 6.75,       # 7 - 0.25
}

MIN_RUNS_FOR_RECOMMENDATION = 5
DEFAULT_WINDOW = 30

# ===== DATA CLASSES =====


@dataclass
class SourceStats:
    source_id: int
    slug: str
    name: str
    current_frequency: str
    source_type: Optional[str]
    run_count: int
    change_rate: float           # fraction 0.0 - 1.0
    avg_new_per_run: float
    avg_found_per_run: float
    days_since_last_new: Optional[float]
    error_rate: float
    avg_duration_seconds: Optional[float]
    is_aggregator: bool
    is_dormant: bool             # zero events_found across all runs
    recommended_frequency: str
    recommendation_reason: str
    flag: Optional[str] = None   # "high_error_rate" | "needs_more_data"
    changed: bool = False        # set to True after --apply writes it


@dataclass
class OptimizationReport:
    total_analyzed: int
    already_optimal: int
    recommend_change: int
    needs_more_data: int
    flagged: int
    changes_by_transition: dict[str, list[SourceStats]] = field(default_factory=dict)
    flagged_sources: list[SourceStats] = field(default_factory=list)
    needs_data_sources: list[SourceStats] = field(default_factory=list)
    all_stats: list[SourceStats] = field(default_factory=list)


# ===== CORE LOGIC =====


def _is_aggregator(slug: str, source_type: Optional[str]) -> bool:
    slug_lower = slug.lower()
    for substring in AGGREGATOR_SLUG_SUBSTRINGS:
        if substring in slug_lower:
            return True
    if source_type and source_type.lower() in ("aggregator", "ticketing_platform"):
        return True
    return False


def _parse_iso(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except (ValueError, TypeError):
        return None


def _compute_duration_seconds(started: Optional[str], completed: Optional[str]) -> Optional[float]:
    s = _parse_iso(started)
    c = _parse_iso(completed)
    if s and c:
        delta = (c - s).total_seconds()
        return delta if delta >= 0 else None
    return None


def _recommend_frequency(
    slug: str,
    source_type: Optional[str],
    run_count: int,
    change_rate: float,
    avg_new_per_run: float,
    days_since_last_new: Optional[float],
    error_rate: float,
    is_dormant: bool,
) -> tuple[str, str, Optional[str]]:
    """
    Returns (recommended_frequency, reason, flag_or_None).

    Flag values:
      "needs_more_data"  — fewer than MIN_RUNS_FOR_RECOMMENDATION runs
      "high_error_rate"  — error_rate > 0.50
    """

    # --- Always daily: aggregators ---
    if _is_aggregator(slug, source_type):
        return "daily", "aggregator — always daily", None

    # --- Not enough data ---
    if run_count < MIN_RUNS_FOR_RECOMMENDATION:
        return "daily", f"only {run_count} run(s); keeping daily until more data", "needs_more_data"

    # --- High error rate: flag, don't change ---
    if error_rate > 0.50:
        return "daily", f"error rate {error_rate:.0%} > 50%; needs investigation not frequency change", "high_error_rate"

    # --- Dormant: keep daily to detect when they wake up ---
    if is_dormant:
        return "daily", "dormant (0 events found across all runs); keeping daily to detect activation", None

    # --- Recommend based on observed change patterns ---

    # daily: high activity
    if change_rate > 0.40 or avg_new_per_run > 5:
        reason_parts = []
        if change_rate > 0.40:
            reason_parts.append(f"change_rate {change_rate:.0%} > 40%")
        if avg_new_per_run > 5:
            reason_parts.append(f"avg_new {avg_new_per_run:.1f} > 5")
        return "daily", " + ".join(reason_parts), None

    # monthly: very low activity
    if change_rate < 0.05 and (days_since_last_new is None or days_since_last_new > 30):
        dsln_label = f"{days_since_last_new:.0f}d" if days_since_last_new is not None else "never"
        return "monthly", f"change_rate {change_rate:.0%} < 5% and last_new={dsln_label}", None

    # weekly: low activity
    if change_rate < 0.15 or (days_since_last_new is not None and days_since_last_new > 14):
        reason_parts = []
        if change_rate < 0.15:
            reason_parts.append(f"change_rate {change_rate:.0%} < 15%")
        if days_since_last_new is not None and days_since_last_new > 14:
            reason_parts.append(f"{days_since_last_new:.0f}d since last new event")
        return "weekly", " + ".join(reason_parts), None

    # twice_weekly: moderate activity
    return "twice_weekly", f"change_rate {change_rate:.0%} in 15-40% / avg_new {avg_new_per_run:.1f} in 1-5", None


def analyze_source(
    client,
    source: dict,
    window: int,
) -> SourceStats:
    """Fetch crawl logs and compute stats for one source."""
    sid = source["id"]
    slug = source["slug"]
    name = source.get("name") or slug
    current_freq = source.get("crawl_frequency") or "daily"
    source_type = source.get("source_type")
    is_aggregator = _is_aggregator(slug, source_type)

    # Fetch recent logs (all statuses so we can compute error_rate)
    logs_result = (
        client.table("crawl_logs")
        .select("status, events_found, events_new, started_at, completed_at")
        .eq("source_id", sid)
        .order("completed_at", desc=True)
        .limit(window)
        .execute()
    )
    logs = logs_result.data or []

    run_count = len(logs)

    if run_count == 0:
        return SourceStats(
            source_id=sid,
            slug=slug,
            name=name,
            current_frequency=current_freq,
            source_type=source_type,
            run_count=0,
            change_rate=0.0,
            avg_new_per_run=0.0,
            avg_found_per_run=0.0,
            days_since_last_new=None,
            error_rate=0.0,
            avg_duration_seconds=None,
            is_aggregator=is_aggregator,
            is_dormant=True,
            recommended_frequency="daily",
            recommendation_reason="no crawl history; keeping daily",
            flag="needs_more_data",
        )

    # Split by status
    success_logs = [l for l in logs if l.get("status") == "success"]
    error_count = sum(1 for l in logs if l.get("status") not in ("success", "running", "cancelled"))
    error_rate = error_count / run_count if run_count > 0 else 0.0

    # Stats over successful runs only
    if success_logs:
        new_counts = [l.get("events_new") or 0 for l in success_logs]
        found_counts = [l.get("events_found") or 0 for l in success_logs]
        runs_with_new = sum(1 for n in new_counts if n > 0)
        change_rate = runs_with_new / len(success_logs)
        avg_new_per_run = sum(new_counts) / len(success_logs)
        avg_found_per_run = sum(found_counts) / len(success_logs)
        is_dormant = all(f == 0 for f in found_counts)

        # Days since last run that produced new events
        now_utc = datetime.now(timezone.utc)
        days_since_last_new: Optional[float] = None
        for log in success_logs:  # already sorted desc by completed_at
            if (log.get("events_new") or 0) > 0:
                ts = _parse_iso(log.get("completed_at"))
                if ts:
                    days_since_last_new = (now_utc - ts).total_seconds() / 86400
                break

        # Average duration
        durations = [
            d for d in (
                _compute_duration_seconds(l.get("started_at"), l.get("completed_at"))
                for l in success_logs
            )
            if d is not None
        ]
        avg_duration_seconds = (sum(durations) / len(durations)) if durations else None
    else:
        # No successful runs in window
        change_rate = 0.0
        avg_new_per_run = 0.0
        avg_found_per_run = 0.0
        is_dormant = True
        days_since_last_new = None
        avg_duration_seconds = None

    recommended_frequency, reason, flag = _recommend_frequency(
        slug=slug,
        source_type=source_type,
        run_count=run_count,
        change_rate=change_rate,
        avg_new_per_run=avg_new_per_run,
        days_since_last_new=days_since_last_new,
        error_rate=error_rate,
        is_dormant=is_dormant,
    )

    return SourceStats(
        source_id=sid,
        slug=slug,
        name=name,
        current_frequency=current_freq,
        source_type=source_type,
        run_count=run_count,
        change_rate=change_rate,
        avg_new_per_run=avg_new_per_run,
        avg_found_per_run=avg_found_per_run,
        days_since_last_new=days_since_last_new,
        error_rate=error_rate,
        avg_duration_seconds=avg_duration_seconds,
        is_aggregator=is_aggregator,
        is_dormant=is_dormant,
        recommended_frequency=recommended_frequency,
        recommendation_reason=reason,
        flag=flag,
    )


def build_report(all_stats: list[SourceStats]) -> OptimizationReport:
    """Aggregate per-source stats into a report."""
    already_optimal = 0
    recommend_change = 0
    needs_more_data = 0
    flagged_count = 0
    changes_by_transition: dict[str, list[SourceStats]] = {}
    flagged_sources: list[SourceStats] = []
    needs_data_sources: list[SourceStats] = []

    for s in all_stats:
        if s.flag == "needs_more_data":
            needs_more_data += 1
            needs_data_sources.append(s)
            continue

        if s.flag == "high_error_rate":
            flagged_count += 1
            flagged_sources.append(s)
            continue

        if s.recommended_frequency == s.current_frequency:
            already_optimal += 1
            continue

        recommend_change += 1
        key = f"{s.current_frequency} → {s.recommended_frequency}"
        if key not in changes_by_transition:
            changes_by_transition[key] = []
        changes_by_transition[key].append(s)

    return OptimizationReport(
        total_analyzed=len(all_stats),
        already_optimal=already_optimal,
        recommend_change=recommend_change,
        needs_more_data=needs_more_data,
        flagged=flagged_count,
        changes_by_transition=changes_by_transition,
        flagged_sources=flagged_sources,
        needs_data_sources=needs_data_sources,
        all_stats=all_stats,
    )


def apply_changes(client, report: OptimizationReport) -> int:
    """Write recommended frequency changes to the sources table. Returns count updated."""
    updated = 0
    for sources_list in report.changes_by_transition.values():
        for s in sources_list:
            try:
                client.table("sources").update(
                    {"crawl_frequency": s.recommended_frequency}
                ).eq("id", s.source_id).execute()
                s.changed = True
                updated += 1
                print(f"  updated {s.slug}: {s.current_frequency} -> {s.recommended_frequency}")
            except Exception as exc:
                print(f"  ERROR updating {s.slug}: {exc}")
    return updated


# ===== OUTPUT =====


def _savings_label(transition_key: str, count: int) -> str:
    """Compute crawls/week saved for a transition."""
    try:
        from_freq, to_freq = transition_key.split(" → ")
        per_source = WEEKLY_SAVES_PER_SOURCE.get(to_freq, 0) - WEEKLY_SAVES_PER_SOURCE.get(from_freq, 0)
        total_saved = per_source * count
        if total_saved > 0:
            return f"(saves ~{total_saved:.0f} crawls/week)"
    except Exception:
        pass
    return ""


def print_report(report: OptimizationReport, verbose: bool, applied: bool) -> None:
    width = 60
    print()
    print("=" * width)
    print("CRAWL FREQUENCY OPTIMIZATION REPORT")
    print(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}")
    print("=" * width)
    print()
    print(f"Sources analyzed:  {report.total_analyzed}")
    print(f"  Already optimal: {report.already_optimal}")
    print(f"  Recommend change:{report.recommend_change}")
    print(f"  Needs more data: {report.needs_more_data}")
    print(f"  Flagged (errors):{report.flagged}")

    # --- Recommended changes summary ---
    if report.changes_by_transition:
        print()
        print("RECOMMENDED CHANGES:")
        # Sort by total savings descending
        sorted_transitions = sorted(
            report.changes_by_transition.items(),
            key=lambda item: len(item[1]),
            reverse=True,
        )
        for key, sources_list in sorted_transitions:
            savings = _savings_label(key, len(sources_list))
            print(f"  {key:<30} {len(sources_list):>4} sources  {savings}")

    # --- Top savings (verbose or not) ---
    downgrade_sources: list[SourceStats] = []
    for key, sources_list in report.changes_by_transition.items():
        from_freq = key.split(" → ")[0]
        to_freq = key.split(" → ")[1]
        if VALID_FREQUENCIES.index(to_freq) > VALID_FREQUENCIES.index(from_freq):
            downgrade_sources.extend(sources_list)

    if downgrade_sources:
        downgrade_sources.sort(key=lambda s: s.change_rate)
        print()
        print(f"TOP SAVINGS ({len(downgrade_sources)} sources moving to less frequent crawl):")
        shown = downgrade_sources[:20]
        for s in shown:
            status = "APPLIED" if s.changed else "pending"
            print(
                f"  {s.slug:<45} {s.current_frequency} -> {s.recommended_frequency:<12}"
                f"  change_rate={s.change_rate:.0%}  runs={s.run_count}  [{status}]"
            )
        if len(downgrade_sources) > 20:
            print(f"  ... and {len(downgrade_sources) - 20} more")

    # --- Upgrades (less common but worth noting) ---
    upgrade_sources: list[SourceStats] = []
    for key, sources_list in report.changes_by_transition.items():
        from_freq = key.split(" → ")[0]
        to_freq = key.split(" → ")[1]
        if VALID_FREQUENCIES.index(to_freq) < VALID_FREQUENCIES.index(from_freq):
            upgrade_sources.extend(sources_list)

    if upgrade_sources:
        print()
        print(f"FREQUENCY UPGRADES ({len(upgrade_sources)} sources moving to more frequent crawl):")
        for s in upgrade_sources[:15]:
            print(
                f"  {s.slug:<45} {s.current_frequency} -> {s.recommended_frequency:<12}"
                f"  change_rate={s.change_rate:.0%}  avg_new={s.avg_new_per_run:.1f}/run"
            )

    # --- Flagged for investigation ---
    if report.flagged_sources:
        print()
        print(f"FLAGGED FOR INVESTIGATION (high error rate, {len(report.flagged_sources)} sources):")
        for s in report.flagged_sources[:20]:
            print(
                f"  {s.slug:<45}  error_rate={s.error_rate:.0%}  runs={s.run_count}"
            )
        if len(report.flagged_sources) > 20:
            print(f"  ... and {len(report.flagged_sources) - 20} more")

    # --- Needs more data ---
    if verbose and report.needs_data_sources:
        print()
        print(f"NEEDS MORE DATA (fewer than {MIN_RUNS_FOR_RECOMMENDATION} runs, {len(report.needs_data_sources)} sources):")
        for s in report.needs_data_sources[:20]:
            print(f"  {s.slug:<45}  runs={s.run_count}")
        if len(report.needs_data_sources) > 20:
            print(f"  ... and {len(report.needs_data_sources) - 20} more")

    # --- Verbose: all recommendations ---
    if verbose:
        print()
        print("ALL SOURCES (verbose):")
        header = f"  {'SLUG':<45} {'CURRENT':<12} {'RECOMMENDED':<12} {'CR':>5} {'AVG_NEW':>7} {'RUNS':>5}  REASON"
        print(header)
        print("  " + "-" * (len(header) - 2))
        sorted_all = sorted(
            report.all_stats,
            key=lambda s: (
                0 if s.recommended_frequency != s.current_frequency else 1,
                s.current_frequency,
                s.slug,
            ),
        )
        for s in sorted_all:
            flag_marker = f"[{s.flag}] " if s.flag else ""
            dsln = f"{s.days_since_last_new:.0f}d" if s.days_since_last_new is not None else "never"
            print(
                f"  {s.slug:<45} {s.current_frequency:<12} {s.recommended_frequency:<12}"
                f" {s.change_rate:>4.0%} {s.avg_new_per_run:>7.1f} {s.run_count:>5}"
                f"  {flag_marker}{s.recommendation_reason}  (last_new={dsln})"
            )

    # --- Summary footer ---
    print()
    if applied:
        print(f"Changes APPLIED to database.")
    else:
        print("Run with --apply to write recommended changes to the database.")
    print("=" * width)
    print()


# ===== CLI =====


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Analyze crawl log history and recommend optimal crawl_frequency settings."
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Apply recommended frequency changes to the sources table.",
    )
    parser.add_argument(
        "--source",
        metavar="SLUG",
        help="Analyze a single source by slug.",
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Print per-source detail for all sources.",
    )
    parser.add_argument(
        "--window",
        type=int,
        default=DEFAULT_WINDOW,
        metavar="N",
        help=f"Number of recent crawl_logs to analyze per source (default: {DEFAULT_WINDOW}).",
    )
    return parser.parse_args()


def main() -> None:
    args = _parse_args()
    client = get_client()

    # Fetch active sources
    if args.source:
        rows = (
            client.table("sources")
            .select("id, slug, name, is_active, crawl_frequency, source_type")
            .eq("slug", args.source)
            .execute()
            .data
            or []
        )
        if not rows:
            print(f"Source '{args.source}' not found.")
            sys.exit(1)
    else:
        rows = (
            client.table("sources")
            .select("id, slug, name, is_active, crawl_frequency, source_type")
            .eq("is_active", True)
            .execute()
            .data
            or []
        )

    if not rows:
        print("No active sources found.")
        sys.exit(0)

    print(f"Analyzing {len(rows)} source(s) with window={args.window} runs...")

    all_stats: list[SourceStats] = []
    for i, source in enumerate(rows, 1):
        if not args.source and i % 50 == 0:
            print(f"  ... {i}/{len(rows)}")
        stats = analyze_source(client, source, window=args.window)
        all_stats.append(stats)

    report = build_report(all_stats)

    applied = False
    if args.apply:
        print(f"\nApplying {report.recommend_change} change(s)...")
        n_updated = apply_changes(client, report)
        applied = True
        print(f"Done. {n_updated} source(s) updated.")

    print_report(report, verbose=args.verbose, applied=applied)


if __name__ == "__main__":
    main()
