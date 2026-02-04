#!/usr/bin/env python3
"""
Clean up placeholder/TBA events from cinema sources.

Removes events that have:
- "Coming Soon" as description
- No start_time (is_all_day=true for non-festival events)
- TBA in title or description

Run with --dry-run to see what would be deleted without actually deleting.
"""

import argparse
import logging
from db import get_client

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def find_placeholder_events(dry_run: bool = True):
    """Find and optionally delete placeholder events."""
    client = get_client()

    # Find "Coming Soon" events from Tara and Plaza
    cinema_sources = client.table("sources").select("id, slug, name").or_(
        "slug.eq.tara-theatre,slug.eq.plaza-theatre,slug.eq.landmark-midtown"
    ).execute()

    source_ids = [s["id"] for s in cinema_sources.data]
    source_map = {s["id"]: s for s in cinema_sources.data}

    if not source_ids:
        logger.info("No cinema sources found")
        return

    logger.info(f"Checking sources: {[s['slug'] for s in cinema_sources.data]}")

    # Find placeholder events
    placeholder_events = []

    # Query 1: Events with "Coming Soon" description
    result = client.table("events").select("id, title, description, start_date, source_id").in_(
        "source_id", source_ids
    ).eq("description", "Coming Soon").execute()
    placeholder_events.extend(result.data or [])

    # Query 2: Events with TBA in title
    result = client.table("events").select("id, title, description, start_date, source_id").in_(
        "source_id", source_ids
    ).ilike("title", "%TBA%").execute()
    for event in result.data or []:
        if event not in placeholder_events:
            placeholder_events.extend([event])

    # Query 3: Film events that are all-day with "Now Playing" description (placeholder)
    # These are legacy events from Landmark with no actual showtimes
    result = client.table("events").select("id, title, description, start_date, source_id, is_all_day").in_(
        "source_id", source_ids
    ).eq("is_all_day", True).eq("category", "film").eq("description", "Now Playing").execute()
    for event in result.data or []:
        if event["id"] not in [e["id"] for e in placeholder_events]:
            placeholder_events.append(event)

    # Query 4: Film events that are all-day with short/missing description (likely placeholders)
    result = client.table("events").select("id, title, description, start_date, source_id, is_all_day").in_(
        "source_id", source_ids
    ).eq("is_all_day", True).eq("category", "film").is_("start_time", "null").execute()
    for event in result.data or []:
        desc = event.get("description", "") or ""
        # Only include if description is very short (likely placeholder) or contains placeholder markers
        if len(desc) < 20 or "coming soon" in desc.lower() or "now playing" in desc.lower():
            if event["id"] not in [e["id"] for e in placeholder_events]:
                placeholder_events.append(event)

    if not placeholder_events:
        logger.info("No placeholder events found")
        return

    logger.info(f"Found {len(placeholder_events)} placeholder events to clean up")

    # Group by source
    by_source = {}
    for event in placeholder_events:
        source_id = event["source_id"]
        source = source_map.get(source_id, {})
        slug = source.get("slug", f"source-{source_id}")
        if slug not in by_source:
            by_source[slug] = []
        by_source[slug].append(event)

    # Show what we found
    for slug, events in by_source.items():
        logger.info(f"\n{slug}: {len(events)} placeholder events")
        for event in events[:5]:
            logger.info(f"  - ID {event['id']}: {event['title'][:40]} ({event.get('description', 'no desc')[:20]})")
        if len(events) > 5:
            logger.info(f"  ... and {len(events) - 5} more")

    if dry_run:
        logger.info("\n[DRY RUN] Would delete these events. Run with --execute to delete.")
        return

    # Delete the events
    event_ids = [e["id"] for e in placeholder_events]
    logger.info(f"\nDeleting {len(event_ids)} placeholder events...")

    try:
        # Delete in batches of 100
        for i in range(0, len(event_ids), 100):
            batch = event_ids[i:i+100]
            client.table("events").delete().in_("id", batch).execute()
            logger.info(f"  Deleted batch {i//100 + 1}: {len(batch)} events")

        logger.info(f"Successfully deleted {len(event_ids)} placeholder events")
    except Exception as e:
        logger.error(f"Error deleting events: {e}")


def main():
    parser = argparse.ArgumentParser(description="Clean up placeholder cinema events")
    parser.add_argument(
        "--execute",
        action="store_true",
        help="Actually delete the events (default is dry-run)"
    )
    args = parser.parse_args()

    find_placeholder_events(dry_run=not args.execute)


if __name__ == "__main__":
    main()
