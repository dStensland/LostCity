#!/usr/bin/env python3
"""
Quick crawler health check. Run anytime to see current status.

Usage:
    python3 scripts/health_check.py              # Full report
    python3 scripts/health_check.py --watchlist   # Flagship sources only
    python3 scripts/health_check.py --regressions # Regression detection only
"""

from __future__ import annotations

import argparse
import logging
import os
import sys

# Allow imports from the crawlers/ root regardless of where this script is called from.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Watchlist mode
# ---------------------------------------------------------------------------


def run_watchlist() -> int:
    """Print flagship source alerts. Returns exit code (1 if any critical)."""
    from watchlist import FLAGSHIP_SOURCES, get_watchlist_status

    print(f"Checking {len(FLAGSHIP_SOURCES)} flagship sources...")

    try:
        alerts = get_watchlist_status()
    except Exception as exc:
        print(f"ERROR: Could not query watchlist status: {exc}", file=sys.stderr)
        return 1

    if not alerts:
        print("All flagship sources are healthy.")
        return 0

    criticals = [a for a in alerts if a.severity == "critical"]
    warnings = [a for a in alerts if a.severity == "warning"]

    for alert in criticals:
        print(alert.message)
    for alert in warnings:
        print(alert.message)

    healthy = len(FLAGSHIP_SOURCES) - len(alerts)
    print(
        f"\nSummary: {len(criticals)} critical, {len(warnings)} warnings, "
        f"{healthy} healthy out of {len(FLAGSHIP_SOURCES)} flagship sources"
    )

    return 1 if criticals else 0


# ---------------------------------------------------------------------------
# Regressions mode
# ---------------------------------------------------------------------------


def run_regressions() -> int:
    """Print regression detections. Returns exit code (1 if any found)."""
    from watchdog import detect_regressions

    print("Running regression detection...")

    try:
        regressions = detect_regressions()
    except Exception as exc:
        print(f"ERROR: Could not run regression detection: {exc}", file=sys.stderr)
        return 1

    if not regressions:
        print("No regressions detected.")
        return 0

    print(f"{len(regressions)} regression(s) detected:\n")
    for reg in regressions:
        print(f"  [{reg.regression_type.upper()}] {reg.message}")

    return 1


# ---------------------------------------------------------------------------
# Full report mode
# ---------------------------------------------------------------------------


def run_full_report() -> int:
    """Print full health report. Returns exit code (1 if critical issues)."""
    # Try health_digest first; fall back to watchlist + regressions if it doesn't exist yet.
    try:
        from health_digest import generate_health_digest

        has_digest = True
    except ImportError:
        has_digest = False

    if has_digest:
        return _full_report_via_digest()
    else:
        return _full_report_via_fallback()


def _full_report_via_digest() -> int:
    """Full report using health_digest.generate_health_digest()."""
    from health_digest import generate_health_digest

    print("Generating health digest...")

    try:
        digest = generate_health_digest()
    except Exception as exc:
        print(f"ERROR: Could not generate health digest: {exc}", file=sys.stderr)
        return 1

    # Overall status line
    print(f"\nOverall status: {digest.overall_health.upper()}")
    print(f"Active sources: {digest.active_sources}")
    print(f"Producing sources (30d): {digest.producing_sources}")
    print(f"Critical alerts: {digest.critical_count}")
    print(f"Warnings: {digest.warning_count}")

    # Watchlist alerts (dicts from HealthDigest)
    watchlist_alerts = digest.watchlist_alerts or []
    if watchlist_alerts:
        print(f"\nFlagship alerts ({len(watchlist_alerts)}):")
        for alert in watchlist_alerts:
            severity = str(alert.get("severity", "")).upper()
            message = alert.get("message", str(alert))
            print(f"  [{severity}] {message}")
    else:
        print("\nFlagship sources: all healthy")

    # Regressions (top 10, dicts from HealthDigest)
    regressions = digest.regressions or []
    if regressions:
        top_regressions = regressions[:10]
        print(f"\nRegressions (showing {len(top_regressions)} of {len(regressions)}):")
        for reg in top_regressions:
            reg_type = str(reg.get("regression_type", "")).upper()
            message = reg.get("message", str(reg))
            print(f"  [{reg_type}] {message}")
    else:
        print("\nRegressions: none detected")

    # Category coverage (top 10)
    category_coverage = digest.category_coverage or {}
    if category_coverage:
        sorted_categories = sorted(category_coverage.items(), key=lambda x: x[1], reverse=True)
        top_categories = sorted_categories[:10]
        print(f"\nCategory coverage (top {len(top_categories)} by event count):")
        for category, count in top_categories:
            print(f"  {category}: {count} active events")

    is_critical = digest.critical_count > 0
    return 1 if is_critical else 0


def _full_report_via_fallback() -> int:
    """Full report by combining watchlist + regressions directly."""
    print("Note: health_digest.py not found — running watchlist + regressions directly.\n")

    # --- Active sources count ---
    try:
        from db.client import get_client

        client = get_client()
        resp = client.table("sources").select("id", count="exact").eq("is_active", True).execute()
        active_count = resp.count if resp.count is not None else "unknown"
        print(f"Active sources: {active_count}")
    except Exception as exc:
        print(f"Active sources: unavailable ({exc})")

    # --- Watchlist ---
    from watchlist import FLAGSHIP_SOURCES, get_watchlist_status

    print(f"\nChecking {len(FLAGSHIP_SOURCES)} flagship sources...")
    try:
        alerts = get_watchlist_status()
    except Exception as exc:
        print(f"ERROR: Could not query watchlist: {exc}", file=sys.stderr)
        alerts = []

    criticals = [a for a in alerts if a.severity == "critical"]
    warnings = [a for a in alerts if a.severity == "warning"]
    healthy = len(FLAGSHIP_SOURCES) - len(alerts)

    print(
        f"Critical: {len(criticals)}, Warnings: {len(warnings)}, "
        f"Healthy: {healthy} of {len(FLAGSHIP_SOURCES)} flagship sources"
    )

    if alerts:
        print("\nFlagship alerts:")
        for alert in criticals:
            print(f"  [CRITICAL] {alert.message}")
        for alert in warnings:
            print(f"  [WARNING] {alert.message}")
    else:
        print("Flagship sources: all healthy")

    # --- Regressions ---
    from watchdog import detect_regressions

    print("\nRunning regression detection...")
    try:
        regressions = detect_regressions()
    except Exception as exc:
        print(f"ERROR: Could not run regression detection: {exc}", file=sys.stderr)
        regressions = []

    if regressions:
        top_regressions = regressions[:10]
        print(f"\nRegressions (showing {len(top_regressions)} of {len(regressions)}):")
        for reg in top_regressions:
            print(f"  [{reg.regression_type.upper()}] {reg.message}")
    else:
        print("Regressions: none detected")

    # --- Overall ---
    print(f"\nOverall status: {'CRITICAL' if criticals else 'OK'}")

    return 1 if criticals else 0


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Quick crawler health check — run anytime to see current status.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=(
            "Exit codes:\n"
            "  0  All clear (no critical issues)\n"
            "  1  Critical issues detected\n"
        ),
    )
    group = parser.add_mutually_exclusive_group()
    group.add_argument(
        "--watchlist",
        action="store_true",
        help="Check flagship sources only (watchlist alerts)",
    )
    group.add_argument(
        "--regressions",
        action="store_true",
        help="Run regression detection only",
    )
    return parser.parse_args()


def main() -> int:
    logging.basicConfig(
        level=logging.WARNING,
        format="%(levelname)s %(name)s: %(message)s",
    )

    args = parse_args()

    if args.watchlist:
        return run_watchlist()
    elif args.regressions:
        return run_regressions()
    else:
        return run_full_report()


if __name__ == "__main__":
    raise SystemExit(main())
