#!/usr/bin/env python3
"""
Seed Metalsome Live Band Karaoke recurring events at Dark Horse Tavern.

Creates events for the next 8 weeks (Thu/Fri/Sat nights).
Run with: python3 scripts/seed_metalsome_karaoke.py
"""

from __future__ import annotations

import sys
from pathlib import Path
from datetime import datetime, timedelta

# Add parent directory to path for imports
ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from db import get_client, insert_event, find_event_by_hash
from dedupe import generate_content_hash

# Configuration
VENUE_ID = 920  # Dark Horse Tavern
VENUE_NAME = "Dark Horse Tavern"
EVENT_TITLE = "Metalsome Live Band Karaoke"
START_TIME = "21:00"  # 9:00 PM
SOURCE_URL = "https://www.metalsomelivebandkaraoke.com/"
IMAGE_URL = "https://www.metalsomelivebandkaraoke.com/wp-content/uploads/2023/08/metalsome-logo.png"

# Days: 3=Thursday, 4=Friday, 5=Saturday
DAYS_OF_WEEK = [3, 4, 5]
DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

DESCRIPTION = """Atlanta's original live band karaoke since 2003. Sing your favorite rock and metal songs backed by a real live band in the intimate basement venue 10 High below Dark Horse Tavern. Hosted by English Nick from 97.1 The River. No cover charge."""


def get_next_weekday(start_date: datetime, weekday: int) -> datetime:
    """Get the next occurrence of a weekday from start_date."""
    days_ahead = weekday - start_date.weekday()
    if days_ahead < 0:
        days_ahead += 7
    return start_date + timedelta(days=days_ahead)


def seed_metalsome_events(source_id: int, weeks: int = 8, dry_run: bool = False):
    """
    Create Metalsome karaoke events for the next N weeks.

    Args:
        source_id: Source ID to attribute events to
        weeks: Number of weeks to generate events for
        dry_run: If True, don't actually insert events
    """
    today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)

    events_found = 0
    events_new = 0
    events_skipped = 0

    print(f"{'[DRY RUN] ' if dry_run else ''}Generating Metalsome events for {weeks} weeks...")
    print(f"Venue: {VENUE_NAME} (ID {VENUE_ID})")
    print(f"Days: Thursday, Friday, Saturday at 9:00 PM")
    print()

    for week in range(weeks):
        for day_of_week in DAYS_OF_WEEK:
            event_date = get_next_weekday(today + timedelta(weeks=week), day_of_week)

            # Skip if in the past
            if event_date < today:
                continue

            start_date = event_date.strftime("%Y-%m-%d")
            day_name = DAY_NAMES[day_of_week]

            # Check for duplicates
            content_hash = generate_content_hash(EVENT_TITLE, VENUE_NAME, start_date)

            if find_event_by_hash(content_hash):
                print(f"  SKIP: {EVENT_TITLE} on {start_date} ({day_name}) - already exists")
                events_skipped += 1
                continue

            events_found += 1

            event_record = {
                "source_id": source_id,
                "venue_id": VENUE_ID,
                "title": EVENT_TITLE,
                "description": DESCRIPTION,
                "start_date": start_date,
                "start_time": START_TIME,
                "end_date": None,
                "end_time": None,
                "is_all_day": False,
                "category": "nightlife",
                "subcategory": "nightlife.karaoke",
                "tags": [
                    "karaoke",
                    "live-music",
                    "rock",
                    "metal",
                    "free",
                    "recurring",
                    "virginia-highland",
                ],
                "price_min": None,
                "price_max": None,
                "price_note": "No cover charge",
                "is_free": True,
                "source_url": SOURCE_URL,
                "ticket_url": None,
                "image_url": IMAGE_URL,
                "raw_text": f"Metalsome Live Band Karaoke at Dark Horse Tavern / 10 High - {day_name}s at 9:00 PM",
                "extraction_confidence": 1.0,
                "is_recurring": True,
                "recurrence_rule": f"FREQ=WEEKLY;BYDAY={['MO','TU','WE','TH','FR','SA','SU'][day_of_week]}",
                "content_hash": content_hash,
            }

            # Series hint for linking events together
            series_hint = {
                "series_type": "recurring_show",
                "series_title": EVENT_TITLE,
                "frequency": "weekly",
                "day_of_week": day_name,
                "description": DESCRIPTION,
                "image_url": IMAGE_URL,
            }

            if dry_run:
                print(f"  WOULD CREATE: {EVENT_TITLE} on {start_date} ({day_name})")
            else:
                try:
                    insert_event(event_record, series_hint=series_hint)
                    events_new += 1
                    print(f"  ✓ CREATED: {EVENT_TITLE} on {start_date} ({day_name})")
                except Exception as e:
                    print(f"  ✗ FAILED: {EVENT_TITLE} on {start_date} - {e}")

    print()
    print(f"{'[DRY RUN] ' if dry_run else ''}Summary:")
    print(f"  Events to create: {events_found}")
    print(f"  Events created: {events_new}")
    print(f"  Events skipped (duplicates): {events_skipped}")
    print(f"  Total: {events_found + events_skipped}")


def main():
    import argparse

    parser = argparse.ArgumentParser(description="Seed Metalsome Live Band Karaoke events")
    parser.add_argument("--source-id", type=int, required=True, help="Source ID to attribute events to")
    parser.add_argument("--weeks", type=int, default=8, help="Number of weeks to generate events for (default: 8)")
    parser.add_argument("--dry-run", action="store_true", help="Don't actually insert events")

    args = parser.parse_args()

    seed_metalsome_events(args.source_id, args.weeks, args.dry_run)


if __name__ == "__main__":
    main()
