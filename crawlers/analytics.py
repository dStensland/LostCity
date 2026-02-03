#!/usr/bin/env python3
"""
Analytics Tracking for LostCity.

Tracks and aggregates:
- Daily event counts by category
- Event views (from frontend tracking)
- Attendance data
- Source performance
"""

import logging
from datetime import datetime, timedelta
from db import get_client

logger = logging.getLogger(__name__)


def record_daily_snapshot():
    """
    Record a daily snapshot of event counts by category.
    Should be called once per day (e.g., after nightly crawl).
    """
    client = get_client()
    today = datetime.now().strftime("%Y-%m-%d")

    # Get event counts by category for upcoming events
    result = client.table("events").select("category").gte("start_date", today).execute()

    category_counts = {}
    for event in result.data or []:
        cat = event.get("category") or "uncategorized"
        category_counts[cat] = category_counts.get(cat, 0) + 1

    total_events = sum(category_counts.values())

    # Try to insert into analytics table (create if not exists will be handled by migration)
    snapshot_data = {
        "snapshot_date": today,
        "total_upcoming_events": total_events,
        "events_by_category": category_counts,
        "snapshot_type": "daily",
    }

    try:
        # Check if we already have a snapshot for today
        existing = client.table("analytics_snapshots").select("id").eq(
            "snapshot_date", today
        ).eq("snapshot_type", "daily").execute()

        if existing.data:
            # Update existing
            client.table("analytics_snapshots").update(snapshot_data).eq(
                "snapshot_date", today
            ).eq("snapshot_type", "daily").execute()
            logger.info(f"Updated daily snapshot for {today}")
        else:
            # Insert new
            client.table("analytics_snapshots").insert(snapshot_data).execute()
            logger.info(f"Created daily snapshot for {today}")

        return snapshot_data

    except Exception as e:
        # Table might not exist yet - log and continue
        logger.warning(f"Could not save analytics snapshot (table may not exist): {e}")
        return snapshot_data


def get_category_trends(days: int = 30) -> dict:
    """Get category count trends over the past N days."""
    client = get_client()
    cutoff = (datetime.now() - timedelta(days=days)).strftime("%Y-%m-%d")

    try:
        result = client.table("analytics_snapshots").select(
            "snapshot_date, events_by_category"
        ).gte("snapshot_date", cutoff).eq("snapshot_type", "daily").order("snapshot_date").execute()

        trends = {}
        for snapshot in result.data or []:
            date = snapshot["snapshot_date"]
            by_cat = snapshot.get("events_by_category", {})
            for cat, count in by_cat.items():
                if cat not in trends:
                    trends[cat] = []
                trends[cat].append({"date": date, "count": count})

        return trends

    except Exception as e:
        logger.warning(f"Could not get category trends: {e}")
        return {}


def get_events_per_day(start_date: str = None, end_date: str = None) -> list[dict]:
    """
    Get count of events happening on each day within a date range.

    Returns list of {date, count, categories: {cat: count}}
    """
    client = get_client()

    if not start_date:
        start_date = datetime.now().strftime("%Y-%m-%d")
    if not end_date:
        end_date = (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d")

    result = client.table("events").select(
        "start_date, category"
    ).gte("start_date", start_date).lte("start_date", end_date).execute()

    daily_data = {}
    for event in result.data or []:
        date = event["start_date"]
        cat = event.get("category") or "uncategorized"

        if date not in daily_data:
            daily_data[date] = {"total": 0, "categories": {}}

        daily_data[date]["total"] += 1
        daily_data[date]["categories"][cat] = daily_data[date]["categories"].get(cat, 0) + 1

    # Convert to sorted list
    return [
        {"date": date, "count": data["total"], "categories": data["categories"]}
        for date, data in sorted(daily_data.items())
    ]


def get_source_performance(days: int = 30) -> list[dict]:
    """
    Get performance metrics for each source over the past N days.

    Returns list of {source_slug, total_events, avg_events_per_crawl, success_rate}
    """
    client = get_client()
    cutoff = (datetime.now() - timedelta(days=days)).isoformat()

    # Get crawl logs
    result = client.table("crawl_logs").select(
        "source_id, status, events_found, events_new, source:sources(slug, name)"
    ).gte("started_at", cutoff).execute()

    source_stats = {}
    for log in result.data or []:
        source = log.get("source", {})
        slug = source.get("slug", f"source-{log['source_id']}")

        if slug not in source_stats:
            source_stats[slug] = {
                "name": source.get("name", "Unknown"),
                "total_crawls": 0,
                "successful_crawls": 0,
                "total_events_found": 0,
                "total_new_events": 0,
            }

        source_stats[slug]["total_crawls"] += 1
        if log.get("status") == "success":
            source_stats[slug]["successful_crawls"] += 1
        source_stats[slug]["total_events_found"] += log.get("events_found", 0)
        source_stats[slug]["total_new_events"] += log.get("events_new", 0)

    # Calculate metrics
    performance = []
    for slug, stats in source_stats.items():
        total = stats["total_crawls"]
        success = stats["successful_crawls"]
        performance.append({
            "source_slug": slug,
            "source_name": stats["name"],
            "total_crawls": total,
            "success_rate": success / total if total > 0 else 0,
            "total_events": stats["total_events_found"],
            "new_events": stats["total_new_events"],
            "avg_events_per_crawl": stats["total_events_found"] / success if success > 0 else 0,
        })

    # Sort by total events descending
    return sorted(performance, key=lambda x: -x["total_events"])


def get_venue_popularity(days: int = 30) -> list[dict]:
    """Get venues ranked by number of upcoming events."""
    client = get_client()
    today = datetime.now().strftime("%Y-%m-%d")
    end_date = (datetime.now() + timedelta(days=days)).strftime("%Y-%m-%d")

    result = client.table("events").select(
        "venue_id, venue:venues(name, neighborhood)"
    ).gte("start_date", today).lte("start_date", end_date).execute()

    venue_counts = {}
    for event in result.data or []:
        venue = event.get("venue", {})
        venue_name = venue.get("name", "Unknown")
        neighborhood = venue.get("neighborhood", "")

        key = venue_name
        if key not in venue_counts:
            venue_counts[key] = {"name": venue_name, "neighborhood": neighborhood, "count": 0}
        venue_counts[key]["count"] += 1

    return sorted(venue_counts.values(), key=lambda x: -x["count"])


def get_category_distribution() -> dict:
    """Get distribution of upcoming events by category."""
    client = get_client()
    today = datetime.now().strftime("%Y-%m-%d")

    result = client.table("events").select("category").gte("start_date", today).execute()

    counts = {}
    total = 0
    for event in result.data or []:
        cat = event.get("category") or "uncategorized"
        counts[cat] = counts.get(cat, 0) + 1
        total += 1

    # Add percentages
    distribution = {}
    for cat, count in sorted(counts.items(), key=lambda x: -x[1]):
        distribution[cat] = {
            "count": count,
            "percentage": count / total * 100 if total > 0 else 0
        }

    return distribution


def print_analytics_report():
    """Print a summary analytics report."""
    print("\n" + "=" * 60)
    print("LOSTCITY ANALYTICS REPORT")
    print("=" * 60)

    # Category distribution
    print("\n📊 Events by Category:")
    print("-" * 40)
    dist = get_category_distribution()
    for cat, data in list(dist.items())[:10]:
        bar = "█" * int(data["percentage"] / 5)
        print(f"  {cat:<20} {data['count']:>5} ({data['percentage']:>5.1f}%) {bar}")

    # Daily forecast
    print("\n📅 Events per Day (next 14 days):")
    print("-" * 40)
    daily = get_events_per_day()[:14]
    for day in daily:
        date_obj = datetime.strptime(day["date"], "%Y-%m-%d")
        day_name = date_obj.strftime("%a %m/%d")
        bar = "█" * min(int(day["count"] / 10), 30)
        print(f"  {day_name:<12} {day['count']:>4} {bar}")

    # Top venues
    print("\n🏛️ Top Venues:")
    print("-" * 40)
    venues = get_venue_popularity()[:10]
    for v in venues:
        print(f"  {v['name'][:30]:<32} {v['count']:>4} events")

    # Source performance
    print("\n⚡ Top Performing Sources:")
    print("-" * 40)
    sources = get_source_performance()[:10]
    for s in sources:
        print(f"  {s['source_slug'][:25]:<27} {s['total_events']:>5} events ({s['success_rate']*100:.0f}% success)")

    print("\n" + "=" * 60)


if __name__ == "__main__":
    import sys

    if len(sys.argv) > 1 and sys.argv[1] == "snapshot":
        record_daily_snapshot()
    else:
        print_analytics_report()
