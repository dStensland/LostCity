#!/usr/bin/env python3
"""
Reclassify exhibit/attraction spam from content_kind='event' to 'exhibit'.

Targets three categories of misclassified rows:
  1. Stone Mountain Park permanent attractions (~800 events)
  2. Chattahoochee Nature Center daily operations (~120 events)
  3. Long-span events (>30 days) without festival keywords

Sets content_kind='exhibit' so they're captured in the DB but kept out of
the event feed.  Never deletes or deactivates.

Usage:
    python scripts/deactivate_exhibit_spam.py           # Dry-run (default)
    python scripts/deactivate_exhibit_spam.py --apply   # Execute reclassification
"""

import argparse
import re
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from db import get_client
from datetime import datetime
import logging

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

# Stone Mountain permanent attraction titles (case-insensitive match)
STONE_MOUNTAIN_ATTRACTIONS = {
    "summit skyride",
    "scenic railroad",
    "dinosaur explore",
    "skyhike",
    "mini golf",
    "adventure golf",
    "gemstone mining",
    "geyser tower",
    "farmyard",
    "4-d theater",
    "duck adventures",
    "general admission",
    "nature playground",
    "splash pad",
}

# Chattahoochee Nature Center daily operations
CNC_EXHIBIT_TITLES = {
    "river roots science stations",
    "weekend activities",
    "birdseed fundraiser pick up",
}

_LONG_SPAN_OK_RE = re.compile(
    r"(festival|conference|convention|fair|summit|expo|marathon|relay)",
    re.IGNORECASE,
)


def reclassify_by_title_match(client, venue_slug: str, titles: set[str], apply: bool) -> int:
    """Reclassify events at a venue matching exact title set to content_kind='exhibit'."""
    venue_result = client.table("places").select("id, name").eq("slug", venue_slug).execute()
    if not venue_result.data:
        logger.warning(f"Venue '{venue_slug}' not found")
        return 0

    venue_id = venue_result.data[0]["id"]
    venue_name = venue_result.data[0]["name"]

    result = (
        client.table("events")
        .select("id, title, start_date, content_kind")
        .eq("place_id", venue_id)
        .neq("content_kind", "exhibit")
        .execute()
    )

    if not result.data:
        logger.info(f"No misclassified events at {venue_name}")
        return 0

    # Filter by title match (case-insensitive)
    matches = [
        e for e in result.data
        if (e.get("title") or "").strip().lower() in titles
    ]

    if not matches:
        logger.info(f"No matching attraction titles at {venue_name}")
        return 0

    by_title: dict[str, int] = {}
    for e in matches:
        t = e.get("title", "?")
        by_title[t] = by_title.get(t, 0) + 1

    print(f"\n  {venue_name}: {len(matches)} events to reclassify as exhibit")
    for t, count in sorted(by_title.items(), key=lambda x: -x[1]):
        print(f"    - \"{t}\" x{count}")

    if apply:
        ids = [e["id"] for e in matches]
        for i in range(0, len(ids), 100):
            chunk = ids[i : i + 100]
            client.table("events").update({"content_kind": "exhibit"}).in_("id", chunk).execute()
        logger.info(f"Reclassified {len(ids)} events as exhibit at {venue_name}")

    return len(matches)


def reclassify_long_span_events(client, apply: bool) -> int:
    """Reclassify events spanning >30 days as exhibits (unless festival-like)."""
    result = (
        client.table("events")
        .select("id, title, start_date, end_date, content_kind")
        .not_.is_("end_date", "null")
        .neq("content_kind", "exhibit")
        .execute()
    )

    if not result.data:
        logger.info("No long-span events found")
        return 0

    matches = []
    for e in result.data:
        try:
            start = datetime.strptime(e["start_date"], "%Y-%m-%d")
            end = datetime.strptime(e["end_date"], "%Y-%m-%d")
            span = (end - start).days
            if span > 30 and not _LONG_SPAN_OK_RE.search(e.get("title") or ""):
                matches.append(e)
        except (ValueError, TypeError, KeyError):
            continue

    if not matches:
        logger.info("No long-span non-festival events to reclassify")
        return 0

    by_title: dict[str, int] = {}
    for e in matches:
        t = (e.get("title") or "?")[:60]
        by_title[t] = by_title.get(t, 0) + 1

    print(f"\n  Long-span events (>30 days): {len(matches)} to reclassify as exhibit")
    for t, count in sorted(by_title.items(), key=lambda x: -x[1])[:15]:
        print(f"    - \"{t}\" x{count}")
    if len(by_title) > 15:
        print(f"    ... and {len(by_title) - 15} more distinct titles")

    if apply:
        ids = [e["id"] for e in matches]
        for i in range(0, len(ids), 100):
            chunk = ids[i : i + 100]
            client.table("events").update({"content_kind": "exhibit"}).in_("id", chunk).execute()
        logger.info(f"Reclassified {len(ids)} long-span events as exhibit")

    return len(matches)


def main():
    parser = argparse.ArgumentParser(
        description="Reclassify exhibit/attraction events as content_kind='exhibit'",
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Execute reclassification (default is dry-run)",
    )
    args = parser.parse_args()

    if not args.apply:
        print("=" * 60)
        print("DRY RUN — pass --apply to execute")
        print("=" * 60)

    client = get_client()
    total = 0

    # Phase 1: Stone Mountain permanent attractions
    print("\n--- Phase 1: Stone Mountain Park permanent attractions ---")
    total += reclassify_by_title_match(
        client, "stone-mountain-park", STONE_MOUNTAIN_ATTRACTIONS, args.apply
    )

    # Phase 2: Chattahoochee Nature Center daily operations
    print("\n--- Phase 2: Chattahoochee Nature Center daily operations ---")
    total += reclassify_by_title_match(
        client, "chattahoochee-nature-center", CNC_EXHIBIT_TITLES, args.apply
    )

    # Phase 3: Long-span events (>30 days, not festivals)
    print("\n--- Phase 3: Long-span events (>30 days, non-festival) ---")
    total += reclassify_long_span_events(client, args.apply)

    print(f"\n{'=' * 60}")
    if args.apply:
        print(f"DONE: Reclassified {total} events as exhibit")
    else:
        print(f"DRY RUN: Would reclassify {total} events as exhibit")
        print("Run with --apply to execute")
    print(f"{'=' * 60}")


if __name__ == "__main__":
    main()
