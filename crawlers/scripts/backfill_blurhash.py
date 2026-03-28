"""
Backfill script to compute BlurHash for existing events and venues with images.

BlurHash is a compact image placeholder that eliminates the blank-image flash
while real images load. This script computes blurhash strings for all existing
images in the database and stores them for client-side decoding.

Usage:
    python backfill_blurhash.py [--events-only | --venues-only] [--limit N]

Example:
    python backfill_blurhash.py --events-only --limit 100
"""

import sys
import time
import logging
import argparse
from io import BytesIO
from typing import Optional

import requests
import blurhash
import numpy as np
from PIL import Image

from config import get_config
from db import get_client

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler()]
)
logger = logging.getLogger(__name__)

# Configuration
BATCH_SIZE = 50
REQUEST_TIMEOUT = 10
RATE_LIMIT_DELAY = 0.2  # seconds between requests
THUMBNAIL_SIZE = (32, 32)  # Small for speed
BLURHASH_COMPONENTS = (4, 3)  # x_components=4, y_components=3 (produces ~20 char strings)


def compute_blurhash(image_url: str) -> Optional[str]:
    """
    Download image and compute its blurhash.

    Args:
        image_url: URL of the image to process

    Returns:
        BlurHash string or None if computation failed
    """
    try:
        # Download image
        response = requests.get(image_url, timeout=REQUEST_TIMEOUT)
        response.raise_for_status()

        # Open and process image
        img = Image.open(BytesIO(response.content))

        # Convert to RGB (blurhash requires RGB)
        img = img.convert("RGB")

        # Resize to small thumbnail for speed
        img.thumbnail(THUMBNAIL_SIZE, Image.Resampling.LANCZOS)

        # Compute blurhash (encode expects a numpy array)
        hash_str = blurhash.encode(np.array(img), components_x=BLURHASH_COMPONENTS[0], components_y=BLURHASH_COMPONENTS[1])

        return hash_str

    except requests.RequestException as e:
        logger.warning(f"Failed to download image {image_url}: {e}")
        return None
    except Exception as e:
        logger.warning(f"Failed to compute blurhash for {image_url}: {e}")
        return None


def backfill_events(limit: Optional[int] = None):
    """
    Backfill blurhash for events with image_url but no blurhash.

    Args:
        limit: Maximum number of events to process (None for all)
    """
    client = get_client()

    # Query events with images but no blurhash
    query = (
        client.table("events")
        .select("id, image_url")
        .neq("image_url", "null")
        .is_("blurhash", "null")
        .order("id")
    )

    if limit:
        query = query.limit(limit)

    result = query.execute()
    events = result.data or []

    if not events:
        logger.info("No events need blurhash backfill")
        return

    logger.info(f"Found {len(events)} events to process")

    processed = 0
    updated = 0
    failed = 0

    for i, event in enumerate(events, 1):
        event_id = event["id"]
        image_url = event["image_url"]

        logger.info(f"[{i}/{len(events)}] Processing event {event_id}")

        # Compute blurhash
        hash_str = compute_blurhash(image_url)

        if hash_str:
            # Update event with blurhash
            try:
                client.table("events").update({"blurhash": hash_str}).eq("id", event_id).execute()
                updated += 1
                logger.info(f"  ✓ Updated event {event_id} with blurhash: {hash_str}")
            except Exception as e:
                logger.error(f"  ✗ Failed to update event {event_id}: {e}")
                failed += 1
        else:
            logger.warning(f"  ✗ Could not compute blurhash for event {event_id}")
            failed += 1

        processed += 1

        # Rate limiting
        if i < len(events):
            time.sleep(RATE_LIMIT_DELAY)

        # Progress report every 10 items
        if i % 10 == 0:
            logger.info(f"Progress: {i}/{len(events)} processed, {updated} updated, {failed} failed")

    logger.info(f"Events backfill complete: {processed} processed, {updated} updated, {failed} failed")


def backfill_venues(limit: Optional[int] = None):
    """
    Backfill blurhash for venues with image_url but no blurhash.

    Args:
        limit: Maximum number of venues to process (None for all)
    """
    client = get_client()

    # Query venues with images but no blurhash
    query = (
        client.table("places")
        .select("id, image_url")
        .neq("image_url", "null")
        .is_("blurhash", "null")
        .order("id")
    )

    if limit:
        query = query.limit(limit)

    result = query.execute()
    venues = result.data or []

    if not venues:
        logger.info("No venues need blurhash backfill")
        return

    logger.info(f"Found {len(venues)} venues to process")

    processed = 0
    updated = 0
    failed = 0

    for i, venue in enumerate(venues, 1):
        venue_id = venue["id"]
        image_url = venue["image_url"]

        logger.info(f"[{i}/{len(venues)}] Processing venue {venue_id}")

        # Compute blurhash
        hash_str = compute_blurhash(image_url)

        if hash_str:
            # Update venue with blurhash
            try:
                client.table("places").update({"blurhash": hash_str}).eq("id", venue_id).execute()
                updated += 1
                logger.info(f"  ✓ Updated venue {venue_id} with blurhash: {hash_str}")
            except Exception as e:
                logger.error(f"  ✗ Failed to update venue {venue_id}: {e}")
                failed += 1
        else:
            logger.warning(f"  ✗ Could not compute blurhash for venue {venue_id}")
            failed += 1

        processed += 1

        # Rate limiting
        if i < len(venues):
            time.sleep(RATE_LIMIT_DELAY)

        # Progress report every 10 items
        if i % 10 == 0:
            logger.info(f"Progress: {i}/{len(venues)} processed, {updated} updated, {failed} failed")

    logger.info(f"Venues backfill complete: {processed} processed, {updated} updated, {failed} failed")


def main():
    parser = argparse.ArgumentParser(
        description="Backfill blurhash for existing events and venues with images"
    )
    parser.add_argument(
        "--events-only",
        action="store_true",
        help="Only process events"
    )
    parser.add_argument(
        "--venues-only",
        action="store_true",
        help="Only process venues"
    )
    parser.add_argument(
        "--limit",
        type=int,
        help="Maximum number of records to process per entity type"
    )

    args = parser.parse_args()

    if args.events_only and args.venues_only:
        logger.error("Cannot specify both --events-only and --venues-only")
        sys.exit(1)

    logger.info("Starting blurhash backfill")
    logger.info(f"Batch size: {BATCH_SIZE}, Rate limit: {RATE_LIMIT_DELAY}s, Thumbnail size: {THUMBNAIL_SIZE}")
    logger.info(f"BlurHash components: {BLURHASH_COMPONENTS[0]}x{BLURHASH_COMPONENTS[1]}")

    try:
        if args.venues_only:
            backfill_venues(args.limit)
        elif args.events_only:
            backfill_events(args.limit)
        else:
            # Process both
            backfill_events(args.limit)
            backfill_venues(args.limit)

        logger.info("✓ Backfill complete")

    except KeyboardInterrupt:
        logger.info("\n✗ Backfill interrupted by user")
        sys.exit(1)
    except Exception as e:
        logger.error(f"✗ Backfill failed: {e}", exc_info=True)
        sys.exit(1)


if __name__ == "__main__":
    main()
