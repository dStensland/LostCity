"""
Backfill script: populate missing or weak descriptions for future events.

Category-aware strategy:
- Film events: OMDB plot via get_metadata_for_film_event()
- Music events: Artist Wikipedia bio via get_info_for_music_event()
- All events: Try fetch_description_from_url(source_url / ticket_url)
- Skips synthetic filler ("Event at X") — NULL is better than template text

Also catches short descriptions (< 30 chars) that are basically useless.

Usage:
    python backfill_descriptions.py [--dry-run] [--limit N] [--source SOURCE_SLUG]
    python backfill_descriptions.py --source tara-theatre --dry-run
    python backfill_descriptions.py --category music --limit 100
"""

from __future__ import annotations

import re
import sys
import time
import logging
import argparse
from datetime import datetime
from typing import Optional

from db import get_client, get_venue_by_id
from description_fetcher import fetch_description_from_url
from posters import get_metadata_for_film_event
from artist_images import get_info_for_music_event

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
)
logger = logging.getLogger(__name__)

# Descriptions matching these patterns are template filler — treat as missing
_FILLER_PATTERN = re.compile(
    r"^(Event at |Live music at .+ featuring|Comedy show at |"
    r"Theater performance at |Film screening at |Sporting event at |"
    r"Arts event at |Food & drink event at |Fitness class at |"
    r"Creative workshop at |Performance at |Show at |Paint and sip class at )",
)

# Minimum useful description length
MIN_DESC_LENGTH = 30


def _is_weak_description(desc: str | None) -> bool:
    """Check if a description is missing, too short, or template filler."""
    if not desc:
        return True
    if len(desc) < MIN_DESC_LENGTH:
        return True
    if _FILLER_PATTERN.match(desc):
        return True
    return False


def _fetch_for_film(title: str, existing_image: str | None) -> str | None:
    """Try OMDB for film plot."""
    try:
        metadata = get_metadata_for_film_event(title, existing_image)
        if metadata and metadata.plot and len(metadata.plot) >= MIN_DESC_LENGTH:
            return metadata.plot[:2000]
    except Exception as e:
        logger.debug(f"OMDB lookup failed for '{title[:50]}': {e}")
    return None


def _fetch_for_music(title: str, existing_genres: list | None) -> str | None:
    """Try Wikipedia bio for music artist."""
    try:
        info = get_info_for_music_event(title, existing_genres=existing_genres)
        if info and info.bio and len(info.bio) >= MIN_DESC_LENGTH:
            return info.bio[:2000]
    except Exception as e:
        logger.debug(f"Music bio lookup failed for '{title[:50]}': {e}")
    return None


# Domains where URL fetching returns junk (ticket info, 401s, paywalls)
_SKIP_DOMAINS = {
    "ticketmaster.com",
    "livenation.com",
    "axs.com",
    "seatgeek.com",
    "stubhub.com",
}


def _should_skip_url(url: str) -> bool:
    """Check if URL is from a domain that returns junk descriptions."""
    if not url:
        return True
    for domain in _SKIP_DOMAINS:
        if domain in url:
            return True
    return False


def _fetch_from_urls(source_url: str | None, ticket_url: str | None) -> str | None:
    """Try fetching description from source_url, then ticket_url."""
    if source_url and not _should_skip_url(source_url):
        desc = fetch_description_from_url(source_url)
        if desc and len(desc) >= MIN_DESC_LENGTH:
            return desc
        time.sleep(0.5)

    if ticket_url and ticket_url != source_url and not _should_skip_url(ticket_url):
        desc = fetch_description_from_url(ticket_url)
        if desc and len(desc) >= MIN_DESC_LENGTH:
            return desc
        time.sleep(0.5)

    return None


def backfill(
    dry_run: bool = False,
    limit: int = 0,
    source_slug: str | None = None,
    category: str | None = None,
) -> dict:
    """Backfill weak/missing descriptions for future events.

    Returns dict with counts: {total, film, music, fetched, skipped, failed}.
    """
    client = get_client()
    today = datetime.now().strftime("%Y-%m-%d")

    # Build query for future events with weak descriptions
    # Supabase doesn't support OR(is_null, lt_length) in one query,
    # so we fetch NULL descriptions and short ones separately.

    select_fields = (
        "id, title, category, venue_id, source_id, source_url, "
        "ticket_url, description, image_url, genres"
    )

    # Resolve source_slug to source_id if provided
    source_id = None
    if source_slug:
        src = client.table("sources").select("id").eq("slug", source_slug).execute()
        if not src.data:
            logger.error(f"Source not found: {source_slug}")
            return {"total": 0}
        source_id = src.data[0]["id"]

    # Query 1: NULL descriptions
    q1 = (
        client.table("events")
        .select(select_fields)
        .is_("description", "null")
        .gte("start_date", today)
        .order("id")
    )
    if source_id:
        q1 = q1.eq("source_id", source_id)
    if category:
        q1 = q1.eq("category", category)
    if limit > 0:
        q1 = q1.limit(limit)
    null_events = q1.execute().data or []

    # Query 2: Short descriptions (< MIN_DESC_LENGTH chars)
    # We can't filter by length in Supabase REST, so fetch non-null and filter client-side
    remaining = (limit - len(null_events)) if limit > 0 else 0
    short_events = []
    if limit == 0 or remaining > 0:
        q2 = (
            client.table("events")
            .select(select_fields)
            .not_.is_("description", "null")
            .gte("start_date", today)
            .order("id")
        )
        if source_id:
            q2 = q2.eq("source_id", source_id)
        if category:
            q2 = q2.eq("category", category)
        # Fetch a reasonable batch — most events will be filtered out
        q2 = q2.limit(5000 if limit == 0 else remaining * 10)
        all_non_null = q2.execute().data or []
        short_events = [e for e in all_non_null if _is_weak_description(e.get("description"))]
        if limit > 0 and remaining > 0:
            short_events = short_events[:remaining]

    events = null_events + short_events
    logger.info(
        f"Found {len(events)} events to backfill "
        f"({len(null_events)} NULL, {len(short_events)} short/filler)"
    )

    stats = {
        "total": len(events),
        "film": 0,
        "music": 0,
        "fetched": 0,
        "skipped": 0,
        "failed": 0,
    }

    for i, event in enumerate(events):
        event_id = event["id"]
        title = event.get("title", "")
        cat = event.get("category", "")
        source_url = event.get("source_url")
        ticket_url = event.get("ticket_url")

        description = None

        # Strategy 1: Category-specific enrichment
        if cat == "film":
            description = _fetch_for_film(title, event.get("image_url"))
            if description:
                stats["film"] += 1

        elif cat == "music":
            description = _fetch_for_music(title, event.get("genres"))
            if description:
                stats["music"] += 1

        # Strategy 2: URL fetch (for all categories if strategy 1 didn't work)
        if not description:
            description = _fetch_from_urls(source_url, ticket_url)
            if description:
                stats["fetched"] += 1

        # No synthetic fallback — NULL is better than "Event at X"
        if not description:
            stats["skipped"] += 1
            if dry_run:
                logger.debug(f"[SKIP] #{event_id} \"{title[:50]}\" — no description found")
            continue

        if dry_run:
            logger.info(
                f"[DRY RUN] #{event_id} [{cat}] \"{title[:50]}\" -> "
                f"{description[:80]}..."
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
                f"(film={stats['film']}, music={stats['music']}, "
                f"fetched={stats['fetched']}, skipped={stats['skipped']})"
            )

    logger.info(
        f"Backfill complete: {stats['total']} events, "
        f"{stats['film']} from OMDB, {stats['music']} from artist bio, "
        f"{stats['fetched']} from web pages, "
        f"{stats['skipped']} no description found, "
        f"{stats['failed']} failed"
    )
    return stats


def main():
    parser = argparse.ArgumentParser(description="Backfill event descriptions")
    parser.add_argument("--dry-run", action="store_true", help="Preview without updating")
    parser.add_argument("--limit", type=int, default=0, help="Max events to process (0=all)")
    parser.add_argument("--source", type=str, help="Only backfill events from this source slug")
    parser.add_argument("--category", type=str, help="Only backfill events with this category")
    args = parser.parse_args()

    backfill(
        dry_run=args.dry_run,
        limit=args.limit,
        source_slug=args.source,
        category=args.category,
    )


if __name__ == "__main__":
    main()
