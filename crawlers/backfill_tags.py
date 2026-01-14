#!/usr/bin/env python3
"""
Backfill tags for existing events.
One-time script to add inferred tags to events already in the database.
"""

import logging
from db import get_all_events, get_venue_by_id, update_event_tags
from tag_inference import infer_tags

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(message)s")
logger = logging.getLogger(__name__)


def backfill_tags(dry_run: bool = False, batch_size: int = 100) -> dict:
    """
    Backfill tags for all existing events.

    Args:
        dry_run: If True, don't actually update, just report what would change
        batch_size: Number of events to process per batch

    Returns:
        Stats dict with counts
    """
    stats = {
        "total": 0,
        "updated": 0,
        "unchanged": 0,
        "errors": 0,
    }

    offset = 0
    venue_cache = {}  # Cache venue lookups

    while True:
        events = get_all_events(limit=batch_size, offset=offset)
        if not events:
            break

        for event in events:
            stats["total"] += 1
            event_id = event["id"]

            try:
                # Get venue vibes (with caching)
                venue_id = event.get("venue_id")
                venue_vibes = []

                if venue_id:
                    if venue_id not in venue_cache:
                        venue = get_venue_by_id(venue_id)
                        venue_cache[venue_id] = venue.get("vibes", []) if venue else []
                    venue_vibes = venue_cache[venue_id]

                # Infer new tags
                new_tags = infer_tags(event, venue_vibes, preserve_existing=True)
                old_tags = event.get("tags") or []

                # Check if tags changed
                if set(new_tags) != set(old_tags):
                    if dry_run:
                        logger.info(
                            f"[DRY RUN] Event {event_id}: {old_tags} -> {new_tags}"
                        )
                    else:
                        update_event_tags(event_id, new_tags)
                        logger.info(f"Updated event {event_id}: {old_tags} -> {new_tags}")
                    stats["updated"] += 1
                else:
                    stats["unchanged"] += 1

            except Exception as e:
                logger.error(f"Error processing event {event_id}: {e}")
                stats["errors"] += 1

        offset += batch_size
        logger.info(f"Processed {offset} events...")

    return stats


def main():
    import argparse

    parser = argparse.ArgumentParser(description="Backfill tags for existing events")
    parser.add_argument(
        "--dry-run", "-n",
        action="store_true",
        help="Show what would change without making updates"
    )
    parser.add_argument(
        "--batch-size", "-b",
        type=int,
        default=100,
        help="Number of events to process per batch"
    )

    args = parser.parse_args()

    logger.info("Starting tag backfill...")
    if args.dry_run:
        logger.info("DRY RUN MODE - no changes will be made")

    stats = backfill_tags(dry_run=args.dry_run, batch_size=args.batch_size)

    logger.info("=" * 50)
    logger.info(f"Backfill complete!")
    logger.info(f"  Total events: {stats['total']}")
    logger.info(f"  Updated: {stats['updated']}")
    logger.info(f"  Unchanged: {stats['unchanged']}")
    logger.info(f"  Errors: {stats['errors']}")


if __name__ == "__main__":
    main()
