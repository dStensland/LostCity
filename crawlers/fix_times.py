"""
Time Extraction Audit and Fix Script
Identifies events with time issues and attempts to fix them.
"""

import re
import logging
from datetime import datetime, date
from typing import Optional
from db import get_client

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def audit_times(limit: int = 500) -> dict:
    """
    Audit time data quality for upcoming events.

    Returns stats about time issues.
    """
    client = get_client()
    today = date.today().isoformat()

    # Get upcoming events
    result = client.table("events").select(
        "id, title, start_date, start_time, end_time, is_all_day, source_id, category"
    ).gte("start_date", today).order("start_date").limit(limit).execute()

    events = result.data or []

    stats = {
        "total": len(events),
        "has_time": 0,
        "null_time_all_day": 0,
        "null_time_not_all_day": 0,  # Problem cases
        "suspicious_early_morning": 0,
        "by_source": {},
        "by_category": {},
    }

    problem_events = []

    for e in events:
        source_id = e.get("source_id")
        category = e.get("category", "other")
        has_time = e.get("start_time") is not None
        is_all_day = e.get("is_all_day", False)

        # Track by source
        if source_id not in stats["by_source"]:
            stats["by_source"][source_id] = {"total": 0, "missing_time": 0}
        stats["by_source"][source_id]["total"] += 1

        # Track by category
        if category not in stats["by_category"]:
            stats["by_category"][category] = {"total": 0, "missing_time": 0}
        stats["by_category"][category]["total"] += 1

        if has_time:
            stats["has_time"] += 1

            # Check for suspicious times (1-5 AM)
            try:
                hour = int(e["start_time"].split(":")[0])
                if 1 <= hour <= 5:
                    stats["suspicious_early_morning"] += 1
            except:
                pass
        else:
            if is_all_day:
                stats["null_time_all_day"] += 1
            else:
                stats["null_time_not_all_day"] += 1
                stats["by_source"][source_id]["missing_time"] += 1
                stats["by_category"][category]["missing_time"] += 1
                problem_events.append(e)

    return stats, problem_events


def fix_null_times_mark_all_day(dry_run: bool = True) -> int:
    """
    Fix events with null time that should be marked as all-day.

    Criteria for marking as all-day:
    - No start_time
    - Category suggests it might be all-day (art exhibits, community, etc.)
    - Not nightlife/music (which should have times)
    """
    client = get_client()
    today = date.today().isoformat()

    # Categories that are likely all-day if no time specified
    all_day_categories = {"art", "community", "family", "film", "sports"}

    # Get events with null time that are not marked all-day
    result = client.table("events").select(
        "id, title, category, is_all_day"
    ).gte("start_date", today).is_("start_time", "null").eq("is_all_day", False).execute()

    events = result.data or []
    fixed = 0

    for e in events:
        category = e.get("category", "other")

        # Only fix categories that make sense as all-day
        if category in all_day_categories:
            if dry_run:
                logger.info(f"[DRY RUN] Would mark as all-day: [{e['id']}] {e['title'][:50]}")
            else:
                client.table("events").update({"is_all_day": True}).eq("id", e["id"]).execute()
                logger.info(f"Marked as all-day: [{e['id']}] {e['title'][:50]}")
            fixed += 1

    return fixed


def set_default_times(dry_run: bool = True) -> int:
    """
    Set sensible default times for events missing times.

    Rules:
    - nightlife/club events: 21:00 (9 PM)
    - music events: 20:00 (8 PM)
    - comedy events: 20:00 (8 PM)
    - theater events: 19:30 (7:30 PM)
    - food_drink events: 18:00 (6 PM)
    - other events: mark as all-day
    """
    client = get_client()
    today = date.today().isoformat()

    default_times = {
        "nightlife": "21:00",
        "music": "20:00",
        "comedy": "20:00",
        "theater": "19:30",
        "food_drink": "18:00",
    }

    # Get events with null time
    result = client.table("events").select(
        "id, title, category, is_all_day"
    ).gte("start_date", today).is_("start_time", "null").execute()

    events = result.data or []
    fixed = 0

    for e in events:
        category = e.get("category", "other")

        if category in default_times:
            default_time = default_times[category]
            if dry_run:
                logger.info(f"[DRY RUN] Would set {default_time} for: [{e['id']}] {e['title'][:50]}")
            else:
                client.table("events").update({"start_time": default_time}).eq("id", e["id"]).execute()
                logger.info(f"Set {default_time} for: [{e['id']}] {e['title'][:50]}")
            fixed += 1
        elif not e.get("is_all_day"):
            # Mark remaining as all-day
            if dry_run:
                logger.info(f"[DRY RUN] Would mark all-day: [{e['id']}] {e['title'][:50]}")
            else:
                client.table("events").update({"is_all_day": True}).eq("id", e["id"]).execute()
            fixed += 1

    return fixed


def print_audit_report(stats: dict) -> None:
    """Print a formatted audit report."""
    print("\n" + "=" * 70)
    print("TIME DATA AUDIT REPORT")
    print("=" * 70)

    print(f"\nTotal events analyzed: {stats['total']}")
    print(f"  With time:              {stats['has_time']} ({stats['has_time']*100//stats['total']}%)")
    print(f"  Null time (all-day):    {stats['null_time_all_day']}")
    print(f"  Null time (NOT all-day): {stats['null_time_not_all_day']} <- PROBLEM")
    print(f"  Suspicious (1-5 AM):    {stats['suspicious_early_morning']}")

    print("\nBy Source (top issues):")
    sources_sorted = sorted(
        stats["by_source"].items(),
        key=lambda x: x[1]["missing_time"],
        reverse=True
    )
    for source_id, data in sources_sorted[:10]:
        if data["missing_time"] > 0:
            print(f"  source_id={source_id}: {data['missing_time']}/{data['total']} missing time")

    print("\nBy Category (top issues):")
    cats_sorted = sorted(
        stats["by_category"].items(),
        key=lambda x: x[1]["missing_time"],
        reverse=True
    )
    for cat, data in cats_sorted[:10]:
        if data["missing_time"] > 0:
            print(f"  {cat}: {data['missing_time']}/{data['total']} missing time")


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Audit and fix event time data")
    parser.add_argument("--audit", action="store_true", help="Run time audit")
    parser.add_argument("--fix-all-day", action="store_true", help="Mark appropriate events as all-day")
    parser.add_argument("--set-defaults", action="store_true", help="Set default times for missing")
    parser.add_argument("--dry-run", action="store_true", help="Don't actually update database")
    parser.add_argument("--limit", type=int, default=500, help="Max events to analyze")

    args = parser.parse_args()

    if args.audit or (not args.fix_all_day and not args.set_defaults):
        print("Running time audit...")
        stats, problems = audit_times(limit=args.limit)
        print_audit_report(stats)

        if problems[:5]:
            print("\nSample problem events:")
            for e in problems[:5]:
                print(f"  [{e['id']}] {e['category']}: {e['title'][:50]}")

    if args.fix_all_day:
        print("\nMarking appropriate events as all-day...")
        fixed = fix_null_times_mark_all_day(dry_run=args.dry_run)
        print(f"{'Would fix' if args.dry_run else 'Fixed'}: {fixed} events")

    if args.set_defaults:
        print("\nSetting default times...")
        fixed = set_default_times(dry_run=args.dry_run)
        print(f"{'Would fix' if args.dry_run else 'Fixed'}: {fixed} events")
