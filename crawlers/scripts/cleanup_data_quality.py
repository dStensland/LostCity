#!/usr/bin/env python3
"""
Data quality cleanup script for LostCity database.

Fixes three issues:
1. Delete "Summit Skyride" permanent attraction events (NOT real events)
2. Delete past events older than 30 days
3. Delete duplicate events (same title + venue + date)

Usage:
    python cleanup_data_quality.py [--dry-run]
"""

import argparse
import logging
from datetime import datetime, timedelta
from collections import defaultdict
from db import get_client

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


def cleanup_summit_skyride(dry_run: bool = False) -> int:
    """
    Delete Summit Skyride events - these are permanent attraction operations,
    not real events. Per CLAUDE.md: "Never create events for permanent
    attractions or daily operations."

    Returns: number of events deleted
    """
    logger.info("=" * 80)
    logger.info("TASK 1: Delete Summit Skyride Events")
    logger.info("=" * 80)

    client = get_client()

    # Find Summit Skyride events
    result = client.table("events").select("id, title, start_date, venue_id").eq("title", "Summit Skyride").execute()

    if not result.data:
        logger.info("No Summit Skyride events found - already clean!")
        return 0

    event_count = len(result.data)
    logger.info(f"Found {event_count} Summit Skyride events to delete")

    # Show sample
    if result.data:
        logger.info("\nSample events:")
        for event in result.data[:5]:
            logger.info(f"  - ID {event['id']}: {event['title']} on {event['start_date']}")
        if len(result.data) > 5:
            logger.info(f"  ... and {len(result.data) - 5} more")

    if dry_run:
        logger.info(f"\n[DRY RUN] Would delete {event_count} Summit Skyride events")
        return event_count

    # Delete them
    deleted = 0
    for event in result.data:
        try:
            client.table("events").delete().eq("id", event["id"]).execute()
            deleted += 1
            if deleted % 50 == 0:
                logger.info(f"  Deleted {deleted}/{event_count}...")
        except Exception as e:
            logger.error(f"Failed to delete event {event['id']}: {e}")

    logger.info(f"\n✓ Deleted {deleted} Summit Skyride events")
    return deleted


def cleanup_old_past_events(dry_run: bool = False) -> int:
    """
    Delete past events older than 30 days.
    These are no longer relevant and clutter the database.

    Returns: number of events deleted
    """
    logger.info("\n" + "=" * 80)
    logger.info("TASK 2: Delete Past Events Older Than 30 Days")
    logger.info("=" * 80)

    client = get_client()
    cutoff = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
    logger.info(f"Cutoff date: {cutoff}")

    # Count first
    count_result = client.table("events").select("id", count="exact").lt("start_date", cutoff).execute()
    event_count = count_result.count if count_result.count is not None else 0

    if event_count == 0:
        logger.info("No old past events found - already clean!")
        return 0

    logger.info(f"Found {event_count} past events older than 30 days")

    # Fetch sample for display
    sample_result = client.table("events").select("id, title, start_date").lt("start_date", cutoff).limit(5).execute()

    if sample_result.data:
        logger.info("\nSample events:")
        for event in sample_result.data:
            logger.info(f"  - ID {event['id']}: {event['title']} on {event['start_date']}")
        if event_count > 5:
            logger.info(f"  ... and {event_count - 5} more")

    if dry_run:
        logger.info(f"\n[DRY RUN] Would delete {event_count} old past events")
        return event_count

    # Delete in batches (Supabase has limits)
    deleted = 0
    batch_size = 1000

    while True:
        # Fetch a batch of IDs
        batch = client.table("events").select("id").lt("start_date", cutoff).limit(batch_size).execute()

        if not batch.data:
            break

        # Delete this batch
        ids_to_delete = [e["id"] for e in batch.data]
        try:
            client.table("events").delete().in_("id", ids_to_delete).execute()
            deleted += len(ids_to_delete)
            logger.info(f"  Deleted {deleted}/{event_count}...")
        except Exception as e:
            logger.error(f"Failed to delete batch: {e}")
            break

        # If we got less than batch_size, we're done
        if len(batch.data) < batch_size:
            break

    logger.info(f"\n✓ Deleted {deleted} old past events")
    return deleted


def cleanup_duplicate_events(dry_run: bool = False) -> int:
    """
    Find and delete duplicate events (same title + venue_id + start_date).
    Keep the oldest event by created_at, delete the rest.

    Returns: number of duplicate events deleted
    """
    logger.info("\n" + "=" * 80)
    logger.info("TASK 3: Delete Duplicate Events")
    logger.info("=" * 80)

    client = get_client()

    # Fetch ALL events (need to do in-memory grouping)
    logger.info("Fetching all events to detect duplicates...")
    all_events = []
    offset = 0
    batch_size = 1000

    while True:
        batch = client.table("events").select("id, title, venue_id, start_date, created_at").range(offset, offset + batch_size - 1).execute()

        if not batch.data:
            break

        all_events.extend(batch.data)
        offset += batch_size

        if offset % 10000 == 0:
            logger.info(f"  Fetched {offset} events...")

        # Safety limit to avoid memory issues
        if offset > 100000:
            logger.warning("Reached 100k events limit - stopping fetch")
            break

    logger.info(f"Fetched {len(all_events)} total events")

    # Group by (title, venue_id, start_date)
    logger.info("Grouping events to find duplicates...")
    groups = defaultdict(list)

    for event in all_events:
        key = (event["title"], event["venue_id"], event["start_date"])
        groups[key].append(event)

    # Find duplicate groups
    duplicate_groups = {k: v for k, v in groups.items() if len(v) > 1}

    if not duplicate_groups:
        logger.info("No duplicate events found - already clean!")
        return 0

    logger.info(f"Found {len(duplicate_groups)} duplicate groups")

    # Count total duplicates to delete
    total_dupes = sum(len(events) - 1 for events in duplicate_groups.values())
    logger.info(f"Total duplicate events to delete: {total_dupes}")

    # Show sample duplicate groups
    logger.info("\nSample duplicate groups:")
    for i, (key, events) in enumerate(list(duplicate_groups.items())[:5]):
        title, venue_id, start_date = key
        logger.info(f"\n  Group {i+1}: '{title}' at venue {venue_id} on {start_date}")
        logger.info(f"    {len(events)} instances:")
        for event in sorted(events, key=lambda e: e["created_at"]):
            logger.info(f"      - ID {event['id']}, created {event['created_at']}")

    if len(duplicate_groups) > 5:
        logger.info(f"\n  ... and {len(duplicate_groups) - 5} more duplicate groups")

    if dry_run:
        logger.info(f"\n[DRY RUN] Would delete {total_dupes} duplicate events from {len(duplicate_groups)} groups")
        return total_dupes

    # Delete duplicates (keep oldest by created_at)
    deleted = 0

    for key, events in duplicate_groups.items():
        # Sort by created_at, keep the first (oldest)
        sorted_events = sorted(events, key=lambda e: e["created_at"] or "9999-99-99")

        # Delete all but the first
        for dupe in sorted_events[1:]:
            try:
                client.table("events").delete().eq("id", dupe["id"]).execute()
                deleted += 1

                if deleted % 50 == 0:
                    logger.info(f"  Deleted {deleted}/{total_dupes}...")
            except Exception as e:
                logger.error(f"Failed to delete event {dupe['id']}: {e}")

    logger.info(f"\n✓ Deleted {deleted} duplicate events from {len(duplicate_groups)} groups")
    return deleted


def check_stone_mountain_crawler():
    """
    Check the Stone Mountain crawler and recommend fixes if needed.
    """
    logger.info("\n" + "=" * 80)
    logger.info("BONUS: Stone Mountain Crawler Analysis")
    logger.info("=" * 80)

    logger.info("""
The Stone Mountain Park crawler (sources/stone_mountain_park.py) crawls from:
    https://stonemountainpark.com/wp-json/tribe/events/v1/events

Current behavior:
    - Crawls ALL events from The Events Calendar API
    - No filtering to exclude permanent attractions

Issue:
    "Summit Skyride" is a permanent attraction (cable car ride), NOT an event.
    It has daily operations but shouldn't appear in the event feed.

Recommendation:
    Add a skip list to the crawler to exclude permanent attractions:

    SKIP_TITLES = [
        "Summit Skyride",
        "Summit Skyride - Cable Car",
        "SkyHike",  # If this is also daily ops
        # Add others as discovered
    ]

    Then in the crawl loop (line ~156):

    title = event.get("title", "").strip()
    if not title or any(skip in title for skip in SKIP_TITLES):
        continue

This will prevent these non-events from being imported in future crawls.
""")


def main():
    parser = argparse.ArgumentParser(description="Clean up data quality issues in LostCity database")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be deleted without actually deleting")
    args = parser.parse_args()

    if args.dry_run:
        logger.info("=" * 80)
        logger.info("DRY RUN MODE - No data will be deleted")
        logger.info("=" * 80)

    # Run all cleanup tasks
    total_deleted = 0

    total_deleted += cleanup_summit_skyride(dry_run=args.dry_run)
    total_deleted += cleanup_old_past_events(dry_run=args.dry_run)
    total_deleted += cleanup_duplicate_events(dry_run=args.dry_run)

    check_stone_mountain_crawler()

    # Summary
    logger.info("\n" + "=" * 80)
    logger.info("CLEANUP SUMMARY")
    logger.info("=" * 80)

    if args.dry_run:
        logger.info(f"[DRY RUN] Would delete {total_deleted} total events")
        logger.info("\nRun without --dry-run to apply changes")
    else:
        logger.info(f"✓ Successfully deleted {total_deleted} total events")
        logger.info("\nDatabase cleanup complete!")


if __name__ == "__main__":
    main()
