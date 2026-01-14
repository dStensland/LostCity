"""
Event Rollup Utilities

Calculates which events should be rolled up (collapsed) in the UI based on
source/venue behavior settings.

Rollup behaviors:
- 'normal': Show each event individually (default)
- 'venue': Collapse multiple events from same venue (e.g., cinema showtimes)
- 'collapse': Collapse all events from source (e.g., volunteer platforms)
- 'category': Group by category within source (e.g., Meetup groups)
"""

from datetime import date
from typing import Optional
from db import get_client


def get_event_rollup_stats(
    target_date: date,
    category: Optional[str] = None,
    venue_threshold: int = 3,
    source_threshold: int = 5
) -> dict:
    """
    Get rollup statistics for a given date.

    Returns dict with:
    - venue_rollups: Venues with >threshold events that should collapse
    - source_rollups: Sources with collapse behavior that have >threshold events
    """
    client = get_client()

    date_str = target_date.isoformat()

    # Get venue rollups (venues with many events from 'venue' rollup sources)
    venue_query = client.table("events").select(
        "venue_id, venues(id, name, slug), source_id, sources(rollup_behavior)"
    ).eq("start_date", date_str)

    if category:
        venue_query = venue_query.eq("category", category)

    venue_result = venue_query.execute()

    # Count events per venue for 'venue' rollup behavior sources
    venue_counts = {}
    for e in venue_result.data or []:
        venue = e.get("venues")
        source = e.get("sources")
        if venue and source and source.get("rollup_behavior") == "venue":
            vid = venue["id"]
            if vid not in venue_counts:
                venue_counts[vid] = {
                    "venue_id": vid,
                    "venue_name": venue["name"],
                    "venue_slug": venue["slug"],
                    "count": 0
                }
            venue_counts[vid]["count"] += 1

    venue_rollups = [
        v for v in venue_counts.values()
        if v["count"] > venue_threshold
    ]

    # Get source rollups (collapse behavior sources with many events)
    source_query = client.table("events").select(
        "source_id, sources(id, name, rollup_behavior)"
    ).eq("start_date", date_str)

    if category:
        source_query = source_query.eq("category", category)

    source_result = source_query.execute()

    # Count events per collapse source
    source_counts = {}
    for e in source_result.data or []:
        source = e.get("sources")
        if source and source.get("rollup_behavior") == "collapse":
            sid = source["id"]
            if sid not in source_counts:
                source_counts[sid] = {
                    "source_id": sid,
                    "source_name": source["name"],
                    "count": 0
                }
            source_counts[sid]["count"] += 1

    source_rollups = [
        s for s in source_counts.values()
        if s["count"] > source_threshold
    ]

    return {
        "date": date_str,
        "venue_rollups": venue_rollups,
        "source_rollups": source_rollups,
        "venue_ids_to_exclude": [v["venue_id"] for v in venue_rollups],
        "source_ids_to_exclude": [s["source_id"] for s in source_rollups]
    }


def print_rollup_report(target_date: Optional[date] = None) -> None:
    """Print a rollup analysis report for a given date."""
    if target_date is None:
        target_date = date.today()

    stats = get_event_rollup_stats(target_date)

    print(f"\n{'='*60}")
    print(f"ROLLUP ANALYSIS FOR {stats['date']}")
    print(f"{'='*60}")

    print(f"\nVenue Rollups (>{3} events from 'venue' behavior sources):")
    if stats["venue_rollups"]:
        for v in stats["venue_rollups"]:
            print(f"  {v['venue_name']}: {v['count']} events")
    else:
        print("  None")

    print(f"\nSource Rollups (>{5} events from 'collapse' behavior sources):")
    if stats["source_rollups"]:
        for s in stats["source_rollups"]:
            print(f"  {s['source_name']}: {s['count']} events")
    else:
        print("  None")

    # Show overall event distribution
    client = get_client()
    result = client.table("events").select(
        "id, source_id, sources(name, rollup_behavior)"
    ).eq("start_date", target_date.isoformat()).execute()

    print(f"\nTotal events on {target_date}: {len(result.data or [])}")

    # Count by rollup behavior
    behavior_counts = {}
    for e in result.data or []:
        source = e.get("sources")
        behavior = source.get("rollup_behavior", "normal") if source else "unknown"
        behavior_counts[behavior] = behavior_counts.get(behavior, 0) + 1

    print("\nBy rollup behavior:")
    for behavior, count in sorted(behavior_counts.items()):
        print(f"  {behavior}: {count}")


if __name__ == "__main__":
    import argparse
    from datetime import timedelta

    parser = argparse.ArgumentParser(description="Event rollup analysis")
    parser.add_argument("--date", help="Date to analyze (YYYY-MM-DD)")
    parser.add_argument("--days", type=int, default=7, help="Analyze next N days")

    args = parser.parse_args()

    if args.date:
        target = date.fromisoformat(args.date)
        print_rollup_report(target)
    else:
        # Show next N days
        for i in range(args.days):
            target = date.today() + timedelta(days=i)
            print_rollup_report(target)
