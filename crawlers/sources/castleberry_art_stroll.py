"""
Crawler for Castleberry Hill Art Stroll.
Monthly First Friday art walk through Atlanta's Castleberry Hill arts district.
Multiple galleries participate with openings, exhibitions, and artist receptions.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta

from db import get_or_create_venue, insert_event, find_event_by_hash
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

VENUE_DATA = {
    "name": "Castleberry Hill",
    "slug": "castleberry-hill",
    "address": "Walker St SW & Peters St SW",
    "neighborhood": "Castleberry Hill",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30313",
    "lat": 33.7510,
    "lng": -84.3970,
    "venue_type": "arts_district",
    "spot_type": "arts_district",
    "website": "https://castleberryhill.org",
    "description": "Historic warehouse district turned arts neighborhood with galleries, lofts, and monthly art stroll.",
}


def get_first_friday(year: int, month: int) -> datetime:
    """Get the first Friday of a given month."""
    first_day = datetime(year, month, 1)
    days_until_friday = (4 - first_day.weekday()) % 7
    first_friday = first_day + timedelta(days=days_until_friday)
    return first_friday


def create_monthly_art_strolls(source_id: int, venue_id: int) -> tuple[int, int]:
    """Create monthly First Friday Art Stroll events."""
    events_new = 0
    events_updated = 0
    now = datetime.now()

    # Generate next 6 months of art strolls
    for i in range(6):
        month = now.month + i
        year = now.year
        if month > 12:
            month -= 12
            year += 1

        stroll_date = get_first_friday(year, month)

        # Skip if already passed
        if stroll_date.date() < now.date():
            continue

        title = "Castleberry Hill Art Stroll"
        start_date = stroll_date.strftime("%Y-%m-%d")

        content_hash = generate_content_hash(title, "Castleberry Hill", start_date)

        if find_event_by_hash(content_hash):
            events_updated += 1
            continue

        description = (
            "Monthly First Friday Art Stroll through Castleberry Hill arts district. "
            "Explore gallery openings, artist receptions, and exhibitions. "
            "Participating galleries include ZuCot Gallery, Marcia Wood Gallery, "
            "Poem 88, and many more. Free and open to the public."
        )

        event_record = {
            "source_id": source_id,
            "venue_id": venue_id,
            "title": title,
            "description": description,
            "start_date": start_date,
            "start_time": "19:00",
            "end_date": None,
            "end_time": "22:00",
            "is_all_day": False,
            "category": "community",
            "subcategory": "art_walk",
            "tags": ["castleberry-hill", "art-stroll", "first-friday", "galleries", "free", "art"],
            "price_min": None,
            "price_max": None,
            "price_note": None,
            "is_free": True,
            "source_url": "https://castleberryhill.org",
            "ticket_url": None,
            "image_url": None,
            "raw_text": None,
            "extraction_confidence": 0.90,
            "is_recurring": True,
            "recurrence_rule": "FREQ=MONTHLY;BYDAY=1FR",
            "content_hash": content_hash,
        }

        series_hint = {
            "series_type": "recurring_show",
            "series_title": title,
            "frequency": "monthly",
            "day_of_week": "Friday",
            "description": description,
        }

        try:
            insert_event(event_record, series_hint=series_hint)
            events_new += 1
            logger.info(f"Added: {title} on {start_date}")
        except Exception as e:
            logger.error(f"Failed to insert art stroll: {e}")

    return events_new, events_updated


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Castleberry Hill Art Stroll events."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    venue_id = get_or_create_venue(VENUE_DATA)

    # Create monthly art stroll events
    stroll_new, stroll_updated = create_monthly_art_strolls(source_id, venue_id)
    events_found += 6
    events_new += stroll_new
    events_updated += stroll_updated

    # Note: Individual gallery crawlers handle specific gallery events:
    # - zucot_gallery.py
    # - marcia_wood_gallery.py
    # - poem88_gallery.py
    # - whitespace_gallery.py
    #
    # This crawler focuses on the district-wide monthly art stroll event

    logger.info(f"Castleberry Art Stroll crawl complete: {events_found} found, {events_new} new, {events_updated} updated")

    return events_found, events_new, events_updated
