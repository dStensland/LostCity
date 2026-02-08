#!/usr/bin/env python3
"""
Post-crawl analysis script.

Reads from the SQLite health DB (crawler_health.db) and generates an
actionable report with regression detection, failure categorization,
and healing recommendations.

Usage:
  python scripts/post_crawl_analysis.py
  python scripts/post_crawl_analysis.py --json   # also save JSON to tmp/
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime

# Add parent directory to path so we can import project modules
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from crawler_health import (
    get_system_health_summary,
    get_unhealthy_sources,
    get_db,
    init_health_db,
    classify_error,
)
from pipeline.loader import load_profile, find_profile_path


def get_todays_runs() -> list[dict]:
    """Get all crawl runs from today."""
    init_health_db()
    today = datetime.utcnow().strftime("%Y-%m-%d")
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT * FROM crawl_runs WHERE started_at LIKE ? ORDER BY started_at",
            (f"{today}%",),
        )
        return [dict(row) for row in cursor.fetchall()]


def get_historical_nonzero_sources() -> set[str]:
    """Get sources that have historically produced events (events_found > 0)."""
    init_health_db()
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT DISTINCT source_slug FROM crawl_runs "
            "WHERE events_found > 0 AND status = 'success'"
        )
        return {row["source_slug"] for row in cursor.fetchall()}


def detect_regressions(runs: list[dict]) -> list[dict]:
    """Find sources that previously produced events but now produce 0."""
    historical = get_historical_nonzero_sources()
    regressions = []

    today_slugs: dict[str, dict] = {}
    for run in runs:
        slug = run["source_slug"]
        if run["status"] == "success":
            today_slugs[slug] = run

    for slug, run in today_slugs.items():
        if slug in historical and (run.get("events_found") or 0) == 0:
            regressions.append({
                "source_slug": slug,
                "events_found": 0,
                "note": "Previously produced events, now returning 0",
            })

    return regressions


def categorize_failures(runs: list[dict]) -> dict[str, list[dict]]:
    """Group today's failures by error type."""
    categories: dict[str, list[dict]] = {}
    for run in runs:
        if run["status"] != "failed":
            continue
        error_type = run.get("error_type") or "unknown"
        if error_type not in categories:
            categories[error_type] = []
        categories[error_type].append({
            "source_slug": run["source_slug"],
            "error_message": (run.get("error_message") or "")[:200],
        })
    return categories


def get_healing_recommendations(failure_categories: dict[str, list[dict]], regressions: list[dict]) -> list[dict]:
    """Generate healing recommendations per failure category + regressions."""
    recommendations = []

    advice = {
        "timeout": {
            "action": "Increase timeout or simplify wait strategy",
            "suggestions": [
                "Set wait_until: load instead of networkidle",
                "Increase timeout_ms to 30000",
                "Consider disabling render_js if not needed",
            ],
        },
        "parse": {
            "action": "Site structure likely changed",
            "suggestions": [
                "Enable render_js: true if not set (JS-rendered content)",
                "Update CSS selectors in the profile",
                "Check if the site URL has changed",
            ],
        },
        "network": {
            "action": "Transient issue, likely self-healing",
            "suggestions": [
                "Will auto-retry on next run",
                "If persistent, check if site is blocking our IP",
            ],
        },
        "socket": {
            "action": "Resource exhaustion - reduce parallelism",
            "suggestions": [
                "Reduce xargs -P value (try -P3)",
                "Add delay between crawls",
            ],
        },
        "rate_limit": {
            "action": "Being rate-limited by target site",
            "suggestions": [
                "Increase delay between requests",
                "Reduce parallelism for this source",
            ],
        },
        "auth": {
            "action": "Authentication or access denied",
            "suggestions": [
                "Check if site requires login/API key",
                "Verify URL hasn't moved behind a paywall",
            ],
        },
        "captcha": {
            "action": "Bot detection triggered",
            "suggestions": [
                "Enable render_js with longer wait times",
                "Consider using a different user agent",
                "May need manual investigation",
            ],
        },
    }

    for error_type, sources in failure_categories.items():
        info = advice.get(error_type, {
            "action": "Investigate manually",
            "suggestions": ["Check error messages for details"],
        })
        recommendations.append({
            "category": error_type,
            "count": len(sources),
            "action": info["action"],
            "suggestions": info["suggestions"],
            "affected_sources": [s["source_slug"] for s in sources[:10]],
        })

    # Recommendations for regressions (0-event sources)
    for reg in regressions:
        slug = reg["source_slug"]
        profile_path = find_profile_path(slug)
        render_js = False
        if profile_path:
            try:
                profile = load_profile(slug)
                render_js = profile.discovery.fetch.render_js
            except Exception:
                pass

        if render_js:
            suggestions = [
                "render_js is already enabled - site may have restructured",
                "Check if event URLs have changed",
                "Try running manually: python pipeline_main.py --source " + slug,
            ]
        else:
            suggestions = [
                "Try enabling render_js: true in the profile",
                "Site may use JS rendering for event content",
            ]

        recommendations.append({
            "category": "zero_events_regression",
            "count": 1,
            "action": f"Regression: {slug} now returns 0 events",
            "suggestions": suggestions,
            "affected_sources": [slug],
        })

    return recommendations


def print_report(summary: dict, runs: list[dict], regressions: list[dict],
                 failure_categories: dict, recommendations: list[dict]) -> None:
    """Print a concise terminal report."""
    today = summary["today"]
    sources = summary["sources"]

    print("\n" + "=" * 60)
    print("POST-CRAWL ANALYSIS")
    print(f"Date: {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}")
    print("=" * 60)

    # Summary stats
    print(f"\nSources crawled: {today['total_crawls']}")
    print(f"  Successful:    {today['successful']} ({today['success_rate']:.0%})")
    print(f"  Failed:        {today['failed']}")
    print(f"  Events found:  {today['events_found']}")

    # Zero-event successful crawls
    zero_event_runs = [r for r in runs if r["status"] == "success" and (r.get("events_found") or 0) == 0]
    if zero_event_runs:
        print(f"  Zero-event:    {len(zero_event_runs)} sources succeeded but found 0 events")

    # Health distribution
    print(f"\nHealth distribution:")
    print(f"  Healthy (80+):    {sources['healthy']}")
    print(f"  Degraded (50-79): {sources['degraded']}")
    print(f"  Unhealthy (<50):  {sources['unhealthy']}")

    # Regressions
    if regressions:
        print(f"\nRegressions ({len(regressions)} sources):")
        for reg in regressions[:15]:
            print(f"  - {reg['source_slug']}")

    # Failure breakdown
    if failure_categories:
        print(f"\nFailure breakdown:")
        for error_type, sources_list in sorted(failure_categories.items(), key=lambda x: -len(x[1])):
            print(f"  {error_type}: {len(sources_list)} sources")
            for s in sources_list[:3]:
                print(f"    - {s['source_slug']}")
            if len(sources_list) > 3:
                print(f"    ... and {len(sources_list) - 3} more")

    # Recommendations
    if recommendations:
        print(f"\nHealing recommendations:")
        for rec in recommendations:
            if rec["category"] == "zero_events_regression":
                continue  # Already shown in regressions section
            print(f"\n  [{rec['category'].upper()}] ({rec['count']} sources)")
            print(f"  Action: {rec['action']}")
            for sug in rec["suggestions"]:
                print(f"    - {sug}")

        # Show regression recommendations grouped
        regression_recs = [r for r in recommendations if r["category"] == "zero_events_regression"]
        if regression_recs:
            print(f"\n  [ZERO EVENTS] ({len(regression_recs)} regressions)")
            for rec in regression_recs[:5]:
                slug = rec["affected_sources"][0]
                print(f"    {slug}:")
                for sug in rec["suggestions"][:2]:
                    print(f"      - {sug}")

    print("\n" + "=" * 60)


def build_report_data() -> dict:
    """Build the full report data structure."""
    summary = get_system_health_summary()
    runs = get_todays_runs()
    regressions = detect_regressions(runs)
    failure_categories = categorize_failures(runs)
    recommendations = get_healing_recommendations(failure_categories, regressions)
    unhealthy = get_unhealthy_sources(min_failures=3)

    return {
        "generated_at": datetime.utcnow().isoformat(),
        "summary": summary,
        "regressions": regressions,
        "failure_categories": {k: v for k, v in failure_categories.items()},
        "recommendations": recommendations,
        "unhealthy_sources": [
            {
                "slug": h.source_slug,
                "health_score": h.health_score,
                "consecutive_failures": h.consecutive_failures,
                "last_error_type": h.last_error_type,
            }
            for h in unhealthy
        ],
        "total_runs_today": len(runs),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Post-crawl analysis")
    parser.add_argument("--json", action="store_true", help="Save JSON report to tmp/")
    args = parser.parse_args()

    report = build_report_data()
    runs = get_todays_runs()

    print_report(
        report["summary"],
        runs,
        report["regressions"],
        report["failure_categories"],
        report["recommendations"],
    )

    if args.json:
        out_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "tmp")
        os.makedirs(out_dir, exist_ok=True)
        out_path = os.path.join(out_dir, "post_crawl_analysis.json")
        with open(out_path, "w") as f:
            json.dump(report, f, indent=2, default=str)
        print(f"\nJSON report saved: {out_path}")


if __name__ == "__main__":
    main()
