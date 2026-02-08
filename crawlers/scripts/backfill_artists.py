#!/usr/bin/env python3
"""
Backfill artists for existing music events.

Three passes:
1. Parse lineups from titles → populate event_artists rows (fast, no API)
2. Resolve canonical artist records, enrich from MusicBrainz/Wikidata (rate-limited)
3. Regenerate descriptions — replace stubs with lineup-based descriptions

Usage:
    python scripts/backfill_artists.py                  # full backfill
    python scripts/backfill_artists.py --dry-run        # preview only
    python scripts/backfill_artists.py --limit 50       # process 50 events
    python scripts/backfill_artists.py --artists-only   # skip descriptions
    python scripts/backfill_artists.py --descriptions-only  # skip artist creation
"""

from __future__ import annotations

import sys
import os
import time
import logging
import argparse

# Add parent dir to path so we can import from crawlers/
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from db import (
    get_client,
    parse_lineup_from_title,
    upsert_event_artists,
    get_venue_by_id,
)
from artists import get_or_create_and_enrich, resolve_and_link_event_artists
from description_fetcher import generate_synthetic_description

logger = logging.getLogger(__name__)

# Stub descriptions that should be replaced with lineup-based ones
STUB_PATTERNS = [
    "Live music at ",
    "Live music performance.",
]


def is_stub_description(desc: str) -> bool:
    """Check if a description is a generic stub we should replace."""
    if not desc:
        return True
    return any(desc.startswith(p) for p in STUB_PATTERNS)


def pass1_parse_lineups(events: list[dict], dry_run: bool) -> dict:
    """Parse lineups from titles and populate event_artists."""
    stats = {"parsed": 0, "skipped_has_artists": 0, "no_artists_found": 0}
    client = get_client()

    for event in events:
        event_id = event["id"]
        title = event.get("title", "")

        # Check if event already has artists
        existing = client.table("event_artists").select("id").eq("event_id", event_id).execute()
        if existing.data:
            stats["skipped_has_artists"] += 1
            continue

        parsed = parse_lineup_from_title(title)
        if not parsed:
            stats["no_artists_found"] += 1
            continue

        if dry_run:
            names = [a["name"] for a in parsed]
            print(f"  [DRY RUN] Event {event_id}: '{title[:60]}' → {names}")
        else:
            try:
                upsert_event_artists(event_id, parsed)
            except Exception as e:
                logger.warning(f"Failed to upsert artists for event {event_id}: {e}")
                continue

        stats["parsed"] += 1

    return stats


def pass2_resolve_artists(events: list[dict], dry_run: bool) -> dict:
    """Resolve canonical artist records and enrich from MusicBrainz/Wikidata."""
    stats = {"resolved": 0, "enriched": 0, "errors": 0}
    client = get_client()

    for event in events:
        event_id = event["id"]

        # Get unlinked event_artists
        rows = (
            client.table("event_artists")
            .select("id, name, artist_id")
            .eq("event_id", event_id)
            .is_("artist_id", "null")
            .execute()
        ).data or []

        if not rows:
            continue

        for row in rows:
            if dry_run:
                print(f"  [DRY RUN] Would resolve artist: '{row['name']}'")
                stats["resolved"] += 1
                continue

            try:
                artist = get_or_create_and_enrich(row["name"])
                client.table("event_artists").update(
                    {"artist_id": artist["id"]}
                ).eq("id", row["id"]).execute()
                stats["resolved"] += 1
                if artist.get("musicbrainz_id"):
                    stats["enriched"] += 1
            except Exception as e:
                logger.warning(f"Failed to resolve artist '{row['name']}': {e}")
                stats["errors"] += 1

            # Rate limit: MusicBrainz allows 1 req/sec, each artist = 2 MB calls + Wikidata
            # The rate limiter in artist_images.py handles MB calls, but add a buffer
            time.sleep(1.0)

    return stats


def pass3_regenerate_descriptions(events: list[dict], dry_run: bool) -> dict:
    """Replace stub descriptions with lineup-based ones."""
    stats = {"updated": 0, "skipped_good_desc": 0, "skipped_no_artists": 0}
    client = get_client()

    for event in events:
        event_id = event["id"]
        desc = event.get("description") or ""

        if not is_stub_description(desc):
            stats["skipped_good_desc"] += 1
            continue

        # Get event_artists with canonical artist data
        rows = (
            client.table("event_artists")
            .select("name, billing_order, is_headliner, artist_id, artist:artists(genres)")
            .eq("event_id", event_id)
            .order("billing_order")
            .execute()
        ).data or []

        if not rows:
            stats["skipped_no_artists"] += 1
            continue

        # Build artist dicts for description generator
        artist_dicts = []
        for row in rows:
            entry = {"name": row["name"]}
            artist_data = row.get("artist") or {}
            if artist_data.get("genres"):
                entry["genres"] = artist_data["genres"]
            artist_dicts.append(entry)

        # Get venue name
        venue_name = None
        if event.get("venue_id"):
            venue = get_venue_by_id(event["venue_id"])
            if venue:
                venue_name = venue.get("name")

        new_desc = generate_synthetic_description(
            event.get("title", ""),
            venue_name=venue_name,
            category="music",
            artists=artist_dicts,
        )

        if new_desc == desc:
            stats["skipped_good_desc"] += 1
            continue

        if dry_run:
            print(f"  [DRY RUN] Event {event_id}: '{desc[:50]}' → '{new_desc[:50]}'")
        else:
            try:
                client.table("events").update({"description": new_desc}).eq("id", event_id).execute()
            except Exception as e:
                logger.warning(f"Failed to update description for event {event_id}: {e}")
                continue

        stats["updated"] += 1

    return stats


def main():
    parser = argparse.ArgumentParser(description="Backfill artists for music events")
    parser.add_argument("--dry-run", action="store_true", help="Preview without writing")
    parser.add_argument("--limit", type=int, default=0, help="Max events to process (0=all)")
    parser.add_argument("--artists-only", action="store_true", help="Skip description regeneration")
    parser.add_argument("--descriptions-only", action="store_true", help="Skip artist creation/resolution")
    parser.add_argument("--verbose", action="store_true", help="Enable debug logging")
    args = parser.parse_args()

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s [%(levelname)s] %(message)s",
    )

    client = get_client()

    # Fetch music events
    query = (
        client.table("events")
        .select("id, title, description, venue_id, category")
        .eq("category", "music")
        .order("id")
    )
    if args.limit:
        query = query.limit(args.limit)

    result = query.execute()
    events = result.data or []
    print(f"Found {len(events)} music events to process")

    if not events:
        return

    if not args.descriptions_only:
        # Pass 1: Parse lineups
        print("\n--- Pass 1: Parse lineups from titles ---")
        stats1 = pass1_parse_lineups(events, args.dry_run)
        print(f"  Parsed: {stats1['parsed']}, Already had artists: {stats1['skipped_has_artists']}, "
              f"No artists found: {stats1['no_artists_found']}")

        # Pass 2: Resolve canonical artists
        print("\n--- Pass 2: Resolve canonical artists + MusicBrainz/Wikidata enrichment ---")
        stats2 = pass2_resolve_artists(events, args.dry_run)
        print(f"  Resolved: {stats2['resolved']}, Enriched from MusicBrainz: {stats2['enriched']}, "
              f"Errors: {stats2['errors']}")

    if not args.artists_only:
        # Pass 3: Regenerate descriptions
        print("\n--- Pass 3: Regenerate stub descriptions ---")
        stats3 = pass3_regenerate_descriptions(events, args.dry_run)
        print(f"  Updated: {stats3['updated']}, Good description kept: {stats3['skipped_good_desc']}, "
              f"No artists for desc: {stats3['skipped_no_artists']}")

    print("\nDone!")


if __name__ == "__main__":
    main()
