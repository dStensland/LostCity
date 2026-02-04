#!/usr/bin/env python3
"""
Detect recurring events and create series for them.

Finds events at the same venue with the same title on different weeks,
creates recurring_show series, and links the events.

Usage:
    python detect_recurring_series.py              # Dry run (report only)
    python detect_recurring_series.py --execute    # Actually create series
    python detect_recurring_series.py --venue 123  # Filter to one venue
    python detect_recurring_series.py --min-count 5
"""

import argparse
import logging
from collections import defaultdict
from datetime import datetime, timedelta

from db import get_client
from series import normalize_title, get_or_create_series, link_event_to_series

logger = logging.getLogger(__name__)

WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]


def fetch_unlinked_events(client, venue_id=None):
    """Fetch events without a series_id from last 90 days to future."""
    cutoff = (datetime.now() - timedelta(days=90)).strftime("%Y-%m-%d")

    query = (
        client.table("events")
        .select("id, title, start_date, venue_id, venues!inner(id, name)")
        .is_("series_id", "null")
        .gte("start_date", cutoff)
    )

    if venue_id:
        query = query.eq("venue_id", venue_id)

    # Paginate to get all results
    all_events = []
    offset = 0
    page_size = 1000
    while True:
        result = query.range(offset, offset + page_size - 1).execute()
        if not result.data:
            break
        all_events.extend(result.data)
        if len(result.data) < page_size:
            break
        offset += page_size

    return all_events


def detect_recurring_groups(events, min_count=3):
    """Group events by (venue_id, normalized_title) and filter to recurring candidates."""
    groups = defaultdict(list)

    for event in events:
        key = (event["venue_id"], normalize_title(event["title"]))
        groups[key].append(event)

    # Filter to groups with enough events
    candidates = {}
    today = datetime.now().strftime("%Y-%m-%d")

    for key, group_events in groups.items():
        if len(group_events) < min_count:
            continue

        # Must have at least 1 future event
        has_future = any(e["start_date"] >= today for e in group_events)
        if not has_future:
            continue

        candidates[key] = sorted(group_events, key=lambda e: e["start_date"])

    return candidates


def detect_frequency(events):
    """Detect if events follow a weekly pattern on the same weekday.

    Returns (frequency, day_of_week) or (None, None) if no pattern detected.
    frequency is 'weekly' if >=70% of events fall on the same weekday.
    """
    weekday_counts = defaultdict(int)

    for event in events:
        date = datetime.strptime(event["start_date"], "%Y-%m-%d")
        weekday_counts[date.weekday()] += 1

    if not weekday_counts:
        return None, None

    most_common_day = max(weekday_counts, key=weekday_counts.get)
    ratio = weekday_counts[most_common_day] / len(events)

    if ratio >= 0.70:
        return "weekly", WEEKDAYS[most_common_day].lower()

    return None, None


def get_venue_name(event):
    """Extract venue name from joined event data."""
    venues = event.get("venues")
    if isinstance(venues, dict):
        return venues.get("name", "Unknown")
    if isinstance(venues, list) and venues:
        return venues[0].get("name", "Unknown")
    return "Unknown"


def run(execute=False, min_count=3, venue_id=None):
    """Main detection logic."""
    client = get_client()

    print(f"\n{'=' * 60}")
    print(f"  Recurring Series Detection {'(DRY RUN)' if not execute else '(EXECUTING)'}")
    print(f"{'=' * 60}")
    print(f"  Min events per group: {min_count}")
    if venue_id:
        print(f"  Filtering to venue: {venue_id}")
    print()

    # Fetch unlinked events
    events = fetch_unlinked_events(client, venue_id)
    print(f"Fetched {len(events)} unlinked events\n")

    if not events:
        print("No unlinked events found.")
        return

    # Detect recurring groups
    candidates = detect_recurring_groups(events, min_count)
    print(f"Found {len(candidates)} recurring candidate groups\n")

    if not candidates:
        print("No recurring patterns detected.")
        return

    # Process each candidate
    total_series = 0
    total_linked = 0

    for (vid, norm_title), group_events in sorted(candidates.items(), key=lambda x: -len(x[1])):
        venue_name = get_venue_name(group_events[0])
        original_title = group_events[0]["title"]
        frequency, day_of_week = detect_frequency(group_events)

        dates = [e["start_date"] for e in group_events]
        today = datetime.now().strftime("%Y-%m-%d")
        future_count = sum(1 for d in dates if d >= today)

        print(f"  {venue_name}")
        print(f"    Title: {original_title}")
        print(f"    Events: {len(group_events)} total, {future_count} upcoming")
        if frequency:
            print(f"    Pattern: {frequency} on {day_of_week}")
        else:
            print(f"    Pattern: irregular (no consistent weekday)")
        print(f"    Dates: {dates[0]} ... {dates[-1]}")

        if execute:
            # Create or find the series
            series_hint = {
                "series_type": "recurring_show",
                "series_title": original_title,
            }
            if frequency:
                series_hint["frequency"] = frequency

            series_id = get_or_create_series(client, series_hint)

            if series_id:
                # Update day_of_week on the series record if detected
                if day_of_week:
                    client.table("series").update(
                        {"day_of_week": day_of_week}
                    ).eq("id", series_id).execute()

                # Link all events
                linked = 0
                for event in group_events:
                    try:
                        link_event_to_series(client, event["id"], series_id)
                        linked += 1
                    except Exception as e:
                        logger.warning(f"Failed to link event {event['id']}: {e}")

                print(f"    -> Created/found series {series_id[:8]}..., linked {linked} events")
                total_series += 1
                total_linked += linked
            else:
                print(f"    -> Failed to create series")
        else:
            print(f"    -> Would create series and link {len(group_events)} events")

        print()

    # Summary
    print(f"{'=' * 60}")
    if execute:
        print(f"  Series created/found: {total_series}")
        print(f"  Events linked: {total_linked}")
    else:
        print(f"  Candidate groups: {len(candidates)}")
        print(f"  Total events to link: {sum(len(g) for g in candidates.values())}")
        print(f"\n  Run with --execute to create series and link events")
    print(f"{'=' * 60}\n")


def main():
    parser = argparse.ArgumentParser(description="Detect recurring events and create series")
    parser.add_argument("--execute", action="store_true", help="Actually create series (default is dry run)")
    parser.add_argument("--min-count", type=int, default=3, help="Minimum events to consider recurring (default: 3)")
    parser.add_argument("--venue", type=int, default=None, help="Filter to specific venue ID")
    parser.add_argument("--verbose", action="store_true", help="Enable debug logging")
    args = parser.parse_args()

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )

    run(execute=args.execute, min_count=args.min_count, venue_id=args.venue)


if __name__ == "__main__":
    main()
