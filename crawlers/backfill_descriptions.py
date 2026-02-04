"""
One-time backfill script: populate NULL descriptions for future events.

For each event with a NULL description and start_date >= today:
1. Try fetch_description_from_url(source_url)
2. If that fails, try fetch_description_from_url(ticket_url)
3. If both fail, generate_synthetic_description from title + venue + category
4. Update the event record

Rate limited to 1 request/second for detail page fetches.

Usage:
    python backfill_descriptions.py [--dry-run] [--limit N]
"""

import sys
import time
import logging
import argparse
from datetime import datetime

from db import get_client, get_venue_by_id
from description_fetcher import (
    fetch_description_from_url,
    generate_synthetic_description,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
)
logger = logging.getLogger(__name__)


def backfill(dry_run: bool = False, limit: int = 0) -> dict:
    """Backfill NULL descriptions for future events.

    Returns dict with counts: {total, fetched, synthetic, failed}.
    """
    client = get_client()
    today = datetime.now().strftime("%Y-%m-%d")

    # Query future events with NULL description
    query = (
        client.table("events")
        .select("id, title, category, venue_id, source_url, ticket_url")
        .is_("description", "null")
        .gte("start_date", today)
        .order("id")
    )
    if limit > 0:
        query = query.limit(limit)

    result = query.execute()
    events = result.data or []

    logger.info(f"Found {len(events)} future events with NULL description")

    stats = {"total": len(events), "fetched": 0, "synthetic": 0, "failed": 0}

    for i, event in enumerate(events):
        event_id = event["id"]
        title = event.get("title", "")
        source_url = event.get("source_url")
        ticket_url = event.get("ticket_url")

        description = None

        # Try source_url first
        if source_url:
            description = fetch_description_from_url(source_url)
            time.sleep(1)

        # Try ticket_url if different from source_url
        if not description and ticket_url and ticket_url != source_url:
            description = fetch_description_from_url(ticket_url)
            time.sleep(1)

        # Synthetic fallback
        if not description:
            venue_name = None
            if event.get("venue_id"):
                venue = get_venue_by_id(event["venue_id"])
                if venue:
                    venue_name = venue.get("name")

            description = generate_synthetic_description(
                title,
                venue_name=venue_name,
                category=event.get("category"),
            )
            stats["synthetic"] += 1
        else:
            stats["fetched"] += 1

        if dry_run:
            logger.info(
                f"[DRY RUN] #{event_id} \"{title[:50]}\" -> "
                f"{description[:80] if description else 'NONE'}..."
            )
        else:
            try:
                client.table("events").update(
                    {"description": description}
                ).eq("id", event_id).execute()
            except Exception as e:
                logger.error(f"Failed to update event {event_id}: {e}")
                stats["failed"] += 1
                continue

        if (i + 1) % 50 == 0:
            logger.info(
                f"Progress: {i + 1}/{len(events)} "
                f"(fetched={stats['fetched']}, synthetic={stats['synthetic']})"
            )

    logger.info(
        f"Backfill complete: {stats['total']} total, "
        f"{stats['fetched']} fetched from web, "
        f"{stats['synthetic']} synthetic, "
        f"{stats['failed']} failed"
    )
    return stats


def main():
    parser = argparse.ArgumentParser(description="Backfill NULL event descriptions")
    parser.add_argument("--dry-run", action="store_true", help="Preview without updating")
    parser.add_argument("--limit", type=int, default=0, help="Max events to process (0=all)")
    args = parser.parse_args()

    backfill(dry_run=args.dry_run, limit=args.limit)


if __name__ == "__main__":
    main()
