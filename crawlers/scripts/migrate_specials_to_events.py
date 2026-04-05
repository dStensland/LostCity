#!/usr/bin/env python3
"""
Migrate venue_specials that are really recurring events (Taco Tuesday, Happy Hour, etc.)
into the events table as Regular Hangs.

Usage:
  python3 scripts/migrate_specials_to_events.py              # dry run (default)
  python3 scripts/migrate_specials_to_events.py --apply       # write changes
  python3 scripts/migrate_specials_to_events.py --venue-id 42 # single venue dry run
"""

from __future__ import annotations

import argparse
import logging
import re
import sys
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from db import get_client, insert_event
from dedupe import generate_content_hash, find_event_by_hash

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)

# Generic source for events created from venue specials scraper
SPECIALS_SOURCE_SLUG = "venue-specials-scraper"
SPECIALS_SOURCE_ID = None  # Resolved at runtime

# Patterns that identify event-worthy specials (matches _FOOD_NIGHT_RE + _EVENT_CONTENT_RE)
_MIGRATE_RE = re.compile(
    r"\b(taco|wing|oyster|burger|steak|fish fry|pizza|sushi|pasta|crawfish|bbq|hot dog|"
    r"happy hour|brunch|ladies night|wine night|wine wednesday|margarita|industry night|"
    r"trivia|karaoke|open mic|live music|dj set|comedy|drag show|bingo|"
    r"run club|jazz jam|game night|pub quiz|vinyl night)\b", re.I
)

# Map special types → genres for Regular Hangs
_TYPE_GENRES = {
    "happy_hour": ["happy-hour"],
    "brunch": ["brunch"],
    "daily_special": ["specials"],
    "recurring_deal": ["specials"],
    "event_night": [],
}

# ISO weekday (1=Mon) to Python weekday (0=Mon)
_ISO_TO_PYTHON_WEEKDAY = {1: 0, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 7: 6}
_ISO_DAY_NAMES = {1: "monday", 2: "tuesday", 3: "wednesday", 4: "thursday",
                  5: "friday", 6: "saturday", 7: "sunday"}


def should_migrate(special: dict) -> bool:
    """Return True if this special should be migrated to events."""
    title = special.get("title") or ""
    desc = special.get("description") or ""
    combined = f"{title} {desc}"
    return bool(_MIGRATE_RE.search(combined))


def migrate_special_to_events(
    special: dict, venue: dict, dry_run: bool = True
) -> int:
    """Create recurring event instances from a venue_specials row. Returns count."""
    title = special.get("title", "").strip()
    if not title:
        return 0

    venue_id = venue["id"]
    venue_name = venue.get("name", "")
    stype = special.get("type", "daily_special")
    genres = _TYPE_GENRES.get(stype, [])
    time_start = special.get("time_start")
    special.get("time_end")

    # Build description: fold price_note + original description
    desc_parts = []
    price = special.get("price_note")
    if price:
        desc_parts.append(price)
    orig_desc = special.get("description")
    if orig_desc and orig_desc != price:
        desc_parts.append(orig_desc)
    desc = ". ".join(desc_parts) if desc_parts else None

    # Parse days_of_week (stored as int[] in DB)
    iso_days = special.get("days_of_week") or []
    if not iso_days:
        return 0

    today = date.today()
    inserted = 0
    now_iso = datetime.now(timezone.utc).isoformat()

    # Series title includes venue name to prevent cross-venue sharing
    series_title = f"{title} at {venue_name}" if venue_name else title

    # One series per day — "Happy Hour" Mon-Fri = 5 separate series
    for iso_day in iso_days:
        if iso_day not in _ISO_TO_PYTHON_WEEKDAY:
            continue
        day_name = _ISO_DAY_NAMES.get(iso_day, "")
        py_day = _ISO_TO_PYTHON_WEEKDAY[iso_day]

        series_hint = {
            "series_type": "recurring_show",
            "series_title": series_title,
            "frequency": "weekly",
            "day_of_week": day_name,
            "last_verified_at": now_iso,
        }
        if price:
            series_hint["price_note"] = price

        # Generate next 2 weekly occurrences for this day
        days_ahead = (py_day - today.weekday()) % 7
        next_date = today + timedelta(days=days_ahead)

        for i in range(2):
            event_date = next_date + timedelta(weeks=i)
            date_str = event_date.isoformat()
            content_hash = generate_content_hash(title, venue_name, date_str)

            if find_event_by_hash(content_hash):
                continue

            event_data = {
                "title": title,
                "place_id": venue_id,
                "source_id": SPECIALS_SOURCE_ID,
                "start_date": date_str,
                "start_time": time_start,
                "category": "nightlife",
                "description": desc,
                "source_url": venue.get("website"),
                "is_recurring": True,
                "content_hash": content_hash,
            }

            if dry_run:
                logger.info(f"  [dry-run] Would insert: {title} on {date_str} ({day_name})")
                inserted += 1
                continue

            try:
                insert_event(event_data, series_hint=series_hint, genres=genres or None)
                inserted += 1
            except (ValueError, Exception) as e:
                logger.debug(f"  Insert failed for '{title}' on {date_str}: {e}")

    return inserted


def main():
    parser = argparse.ArgumentParser(description="Migrate venue_specials → events")
    parser.add_argument("--apply", action="store_true", help="Write changes (default is dry-run)")
    parser.add_argument("--venue-id", type=int, help="Migrate single venue")
    args = parser.parse_args()

    dry_run = not args.apply
    client = get_client()

    # Resolve specials source ID
    global SPECIALS_SOURCE_ID
    src = client.table("sources").select("id").eq("slug", SPECIALS_SOURCE_SLUG).execute()
    if not src.data:
        logger.error(f"Source '{SPECIALS_SOURCE_SLUG}' not found. Create it first.")
        sys.exit(1)
    SPECIALS_SOURCE_ID = src.data[0]["id"]
    logger.info(f"Using source_id={SPECIALS_SOURCE_ID} ({SPECIALS_SOURCE_SLUG})")

    # Fetch active specials with venue data
    query = (
        client.table("place_specials")
        .select("id, venue_id, title, type, description, price_note, "
                "days_of_week, time_start, time_end, "
                "venues!inner(id, name, slug, website)")
        .eq("is_active", True)
        .is_("start_date", "null")  # Only recurring specials, not one-off
    )
    if args.venue_id:
        query = query.eq("place_id", args.venue_id)

    result = query.execute()
    specials = result.data or []

    logger.info(f"Found {len(specials)} active specials")

    migrated_count = 0
    skipped_count = 0
    event_count = 0
    migrated_ids = []

    for special in specials:
        venue = special.get("venues")
        if not venue:
            skipped_count += 1
            continue

        if not should_migrate(special):
            skipped_count += 1
            logger.info(f"  SKIP (pure deal): {special.get('title')} @ {venue.get('name')}")
            continue

        logger.info(f"  MIGRATE: {special.get('title')} @ {venue.get('name')}")
        n = migrate_special_to_events(special, venue, dry_run=dry_run)
        if n > 0:
            migrated_count += 1
            event_count += n
            migrated_ids.append(special["id"])

    # Deactivate migrated specials
    if migrated_ids and not dry_run:
        for sid in migrated_ids:
            client.table("place_specials").update({"is_active": False}).eq("id", sid).execute()
        logger.info(f"\nDeactivated {len(migrated_ids)} migrated specials")

    mode = "DRY RUN" if dry_run else "APPLIED"
    logger.info(f"\n=== {mode} ===")
    logger.info(f"Specials found:    {len(specials)}")
    logger.info(f"Migrated to events: {migrated_count}")
    logger.info(f"Event instances:    {event_count}")
    logger.info(f"Skipped (pure deals): {skipped_count}")

    if dry_run:
        logger.info("\nRe-run with --apply to write changes.")


if __name__ == "__main__":
    main()
