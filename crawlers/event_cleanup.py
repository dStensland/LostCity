#!/usr/bin/env python3
"""
Event Cleanup - Remove old/past events from the database.

Cleans up:
- Events with start_date in the past (configurable retention)
- Duplicate events
- Events with invalid data
"""

import argparse
import logging
from datetime import datetime, timedelta
from db import get_client

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def cleanup_past_events(days_to_keep: int = 0, dry_run: bool = True) -> dict:
    """
    Remove events that have already passed.

    Args:
        days_to_keep: Keep events up to N days in the past (default: 7)
        dry_run: If True, only report what would be deleted

    Returns:
        Dict with cleanup stats
    """
    client = get_client()
    cutoff_date = (datetime.now() - timedelta(days=days_to_keep)).strftime("%Y-%m-%d")

    # Find past events
    result = client.table("events").select(
        "id, title, start_date, source_id"
    ).lt("start_date", cutoff_date).execute()

    past_events = result.data or []

    if not past_events:
        logger.info("No past events to clean up")
        return {"deleted": 0, "dry_run": dry_run}

    logger.info(f"Found {len(past_events)} events older than {cutoff_date}")

    # Group by date for logging
    by_date = {}
    for e in past_events:
        date = e["start_date"]
        by_date[date] = by_date.get(date, 0) + 1

    for date in sorted(by_date.keys())[:5]:
        logger.info(f"  {date}: {by_date[date]} events")
    if len(by_date) > 5:
        logger.info(f"  ... and {len(by_date) - 5} more dates")

    if dry_run:
        logger.info(f"[DRY RUN] Would delete {len(past_events)} past events")
        return {"deleted": 0, "would_delete": len(past_events), "dry_run": True}

    # Delete in batches (clear canonical references first)
    event_ids = [e["id"] for e in past_events]
    deleted = 0

    # Clear canonical_event_id references pointing to events we're about to delete
    for eid in event_ids:
        try:
            client.table("events").update(
                {"canonical_event_id": None}
            ).eq("canonical_event_id", eid).execute()
        except Exception:
            pass

    for i in range(0, len(event_ids), 100):
        batch = event_ids[i:i+100]
        try:
            client.table("events").delete().in_("id", batch).execute()
            deleted += len(batch)
            logger.info(f"  Deleted batch: {len(batch)} events")
        except Exception as e:
            logger.error(f"Error deleting batch: {e}")

    logger.info(f"Successfully deleted {deleted} past events")
    return {"deleted": deleted, "dry_run": False}


def cleanup_duplicate_events(dry_run: bool = True) -> dict:
    """
    Remove duplicate events (same content_hash).

    Keeps the most recent event for each content_hash.
    """
    client = get_client()

    # Find duplicate content hashes
    # This is a simplified approach - in production you might use SQL window functions
    result = client.table("events").select("content_hash, id, created_at").execute()

    events_by_hash = {}
    for e in result.data or []:
        ch = e.get("content_hash")
        if ch:
            if ch not in events_by_hash:
                events_by_hash[ch] = []
            events_by_hash[ch].append(e)

    # Find hashes with duplicates
    duplicates_to_delete = []
    for ch, events in events_by_hash.items():
        if len(events) > 1:
            # Sort by created_at descending, keep the newest
            sorted_events = sorted(events, key=lambda x: x.get("created_at", ""), reverse=True)
            duplicates_to_delete.extend([e["id"] for e in sorted_events[1:]])

    if not duplicates_to_delete:
        logger.info("No duplicate events found")
        return {"deleted": 0, "dry_run": dry_run}

    logger.info(f"Found {len(duplicates_to_delete)} duplicate events to remove")

    if dry_run:
        logger.info(f"[DRY RUN] Would delete {len(duplicates_to_delete)} duplicates")
        return {"deleted": 0, "would_delete": len(duplicates_to_delete), "dry_run": True}

    # Delete duplicates (clear canonical references first)
    deleted = 0
    for eid in duplicates_to_delete:
        try:
            client.table("events").update(
                {"canonical_event_id": None}
            ).eq("canonical_event_id", eid).execute()
        except Exception:
            pass

    for i in range(0, len(duplicates_to_delete), 100):
        batch = duplicates_to_delete[i:i+100]
        try:
            client.table("events").delete().in_("id", batch).execute()
            deleted += len(batch)
        except Exception as e:
            logger.error(f"Error deleting duplicates: {e}")

    logger.info(f"Deleted {deleted} duplicate events")
    return {"deleted": deleted, "dry_run": False}


def cleanup_invalid_events(dry_run: bool = True) -> dict:
    """
    Remove events with invalid data:
    - Missing title
    - Missing start_date
    - Invalid dates (year < 2020 or year > 2030)
    """
    client = get_client()

    # Find events with missing required fields
    invalid_events = []

    # Events without titles
    result = client.table("events").select("id").is_("title", "null").execute()
    invalid_events.extend([e["id"] for e in result.data or []])

    # Events without start_date
    result = client.table("events").select("id").is_("start_date", "null").execute()
    invalid_events.extend([e["id"] for e in result.data or []])

    # Events with invalid year (using string comparison)
    result = client.table("events").select("id, start_date").lt("start_date", "2020-01-01").execute()
    invalid_events.extend([e["id"] for e in result.data or []])

    result = client.table("events").select("id, start_date").gt("start_date", "2030-12-31").execute()
    invalid_events.extend([e["id"] for e in result.data or []])

    # Deduplicate
    invalid_events = list(set(invalid_events))

    if not invalid_events:
        logger.info("No invalid events found")
        return {"deleted": 0, "dry_run": dry_run}

    logger.info(f"Found {len(invalid_events)} invalid events")

    if dry_run:
        logger.info(f"[DRY RUN] Would delete {len(invalid_events)} invalid events")
        return {"deleted": 0, "would_delete": len(invalid_events), "dry_run": True}

    # Delete (clear canonical references first)
    deleted = 0
    for eid in invalid_events:
        try:
            client.table("events").update(
                {"canonical_event_id": None}
            ).eq("canonical_event_id", eid).execute()
        except Exception:
            pass

    for i in range(0, len(invalid_events), 100):
        batch = invalid_events[i:i+100]
        try:
            client.table("events").delete().in_("id", batch).execute()
            deleted += len(batch)
        except Exception as e:
            logger.error(f"Error deleting invalid events: {e}")

    logger.info(f"Deleted {deleted} invalid events")
    return {"deleted": deleted, "dry_run": False}


def run_full_cleanup(days_to_keep: int = 0, dry_run: bool = True) -> dict:
    """Run all cleanup operations."""
    logger.info("=" * 50)
    logger.info("EVENT CLEANUP")
    logger.info("=" * 50)

    results = {
        "past_events": cleanup_past_events(days_to_keep, dry_run),
        "duplicates": cleanup_duplicate_events(dry_run),
        "invalid": cleanup_invalid_events(dry_run),
    }

    total_deleted = sum(r.get("deleted", 0) for r in results.values())
    total_would_delete = sum(r.get("would_delete", 0) for r in results.values())

    logger.info("=" * 50)
    if dry_run:
        logger.info(f"[DRY RUN] Would delete {total_would_delete} total events")
    else:
        logger.info(f"Cleanup complete: {total_deleted} events deleted")
    logger.info("=" * 50)

    return results


def main():
    parser = argparse.ArgumentParser(description="Clean up old and invalid events")
    parser.add_argument(
        "--execute",
        action="store_true",
        help="Actually delete events (default is dry-run)"
    )
    parser.add_argument(
        "--days",
        type=int,
        default=0,
        help="Keep past events for N days (default: 0, same-day cleanup)"
    )
    parser.add_argument(
        "--past-only",
        action="store_true",
        help="Only clean up past events"
    )
    args = parser.parse_args()

    dry_run = not args.execute

    if args.past_only:
        cleanup_past_events(args.days, dry_run)
    else:
        run_full_cleanup(args.days, dry_run)


if __name__ == "__main__":
    main()
