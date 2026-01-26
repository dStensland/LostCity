"""
Crawler for Freeroll Atlanta (freerollatlanta.com).

Free poker tournaments at bars around Atlanta.
Weekly recurring events - generates events for upcoming weeks.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta

from db import get_or_create_venue, insert_event, find_event_by_hash
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://www.freerollatlanta.com"
SCHEDULE_URL = f"{BASE_URL}/schedule-2/"

# Weekly poker schedule - (day_of_week, venue_name, time_24h, address, neighborhood)
# day_of_week: 0=Monday, 6=Sunday
WEEKLY_SCHEDULE = [
    (6, "Urban Pie", "14:00", "2012A Hosea L Williams Dr NE, Atlanta, GA 30317", "Kirkwood"),
    (6, "The Pub at EAV", "19:00", "469 Flat Shoals Ave SE, Atlanta, GA 30316", "East Atlanta"),
    (0, "Moe's and Joe's", "19:00", "1033 North Highland Ave NE, Atlanta, GA 30306", "Virginia-Highland"),
    (1, "Sweet Auburn BBQ", "18:00", "656 North Highland Ave NE, Atlanta, GA 30306", "Poncey-Highland"),
    (2, "Neighbor's Pub", "18:00", "752 North Highland Ave NE, Atlanta, GA 30306", "Virginia-Highland"),
    (2, "Limerick Junction Pub", "20:00", "822 North Highland Ave NE, Atlanta, GA 30306", "Virginia-Highland"),
    (3, "Neighbor's Pub", "18:00", "752 North Highland Ave NE, Atlanta, GA 30306", "Virginia-Highland"),
    (3, "Gino's New York Pizza Bar", "20:30", "1740 Cheshire Bridge Rd NE, Atlanta, GA 30324", "Cheshire Bridge"),
    (4, "Urban Pie", "19:00", "2012A Hosea L Williams Dr NE, Atlanta, GA 30317", "Kirkwood"),
    (5, "The Independent", "13:00", "931 Monroe Drive NE, Atlanta, GA 30308", "Midtown"),
    (5, "The Independent", "15:00", "931 Monroe Drive NE, Atlanta, GA 30308", "Midtown"),
]

# Venue data for creating venues
VENUE_DATA = {
    "Urban Pie": {
        "name": "Urban Pie",
        "slug": "urban-pie-kirkwood",
        "address": "2012A Hosea L Williams Dr NE",
        "neighborhood": "Kirkwood",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30317",
        "venue_type": "restaurant",
    },
    "The Pub at EAV": {
        "name": "The Pub at EAV",
        "slug": "the-pub-at-eav",
        "address": "469 Flat Shoals Ave SE",
        "neighborhood": "East Atlanta",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30316",
        "venue_type": "bar",
    },
    "Moe's and Joe's": {
        "name": "Moe's and Joe's",
        "slug": "moes-and-joes",
        "address": "1033 North Highland Ave NE",
        "neighborhood": "Virginia-Highland",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30306",
        "venue_type": "bar",
    },
    "Sweet Auburn BBQ": {
        "name": "Sweet Auburn BBQ",
        "slug": "sweet-auburn-bbq",
        "address": "656 North Highland Ave NE",
        "neighborhood": "Poncey-Highland",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30306",
        "venue_type": "restaurant",
    },
    "Neighbor's Pub": {
        "name": "Neighbor's Pub",
        "slug": "neighbors-pub",
        "address": "752 North Highland Ave NE",
        "neighborhood": "Virginia-Highland",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30306",
        "venue_type": "bar",
    },
    "Limerick Junction Pub": {
        "name": "Limerick Junction Pub",
        "slug": "limerick-junction-pub",
        "address": "822 North Highland Ave NE",
        "neighborhood": "Virginia-Highland",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30306",
        "venue_type": "bar",
    },
    "Gino's New York Pizza Bar": {
        "name": "Gino's New York Pizza Bar",
        "slug": "ginos-new-york-pizza-bar",
        "address": "1740 Cheshire Bridge Rd NE",
        "neighborhood": "Cheshire Bridge",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30324",
        "venue_type": "restaurant",
    },
    "The Independent": {
        "name": "The Independent",
        "slug": "the-independent-midtown",
        "address": "931 Monroe Drive NE",
        "neighborhood": "Midtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30308",
        "venue_type": "bar",
    },
}


def get_next_weekday(start_date: datetime, weekday: int) -> datetime:
    """Get the next occurrence of a weekday from start_date."""
    days_ahead = weekday - start_date.weekday()
    if days_ahead < 0:
        days_ahead += 7
    return start_date + timedelta(days=days_ahead)


def format_time_display(time_24h: str) -> str:
    """Convert 24h time to display format."""
    hour, minute = map(int, time_24h.split(":"))
    period = "PM" if hour >= 12 else "AM"
    hour_12 = hour % 12 or 12
    if minute == 0:
        return f"{hour_12} {period}"
    return f"{hour_12}:{minute:02d} {period}"


def crawl(source: dict) -> tuple[int, int, int]:
    """Generate Freeroll Atlanta poker events for upcoming weeks."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    # Generate events for next 6 weeks
    today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    weeks_ahead = 6

    # Cache venue IDs
    venue_ids: dict[str, int] = {}

    try:
        for day_of_week, venue_name, time_24h, address, neighborhood in WEEKLY_SCHEDULE:
            # Get or create venue
            if venue_name not in venue_ids:
                venue_data = VENUE_DATA.get(venue_name)
                if venue_data:
                    venue_ids[venue_name] = get_or_create_venue(venue_data)
                else:
                    logger.warning(f"No venue data for {venue_name}")
                    continue

            venue_id = venue_ids[venue_name]

            # Generate events for each week
            for week in range(weeks_ahead):
                event_date = get_next_weekday(today + timedelta(weeks=week), day_of_week)

                # Skip if in the past
                if event_date < today:
                    continue

                start_date = event_date.strftime("%Y-%m-%d")
                time_display = format_time_display(time_24h)

                title = f"Free Poker Night at {venue_name}"
                events_found += 1

                content_hash = generate_content_hash(title, venue_name, start_date)

                if find_event_by_hash(content_hash):
                    events_updated += 1
                    continue

                event_record = {
                    "source_id": source_id,
                    "venue_id": venue_id,
                    "title": title,
                    "description": f"Free Texas Hold'em poker tournament hosted by Freeroll Atlanta at {venue_name}. No buy-in required. Registration cut-off is one hour after start time. All skill levels welcome!",
                    "start_date": start_date,
                    "start_time": time_24h,
                    "end_date": None,
                    "end_time": None,
                    "is_all_day": False,
                    "category": "community",
                    "subcategory": "gaming",
                    "tags": [
                        "poker",
                        "free",
                        "texas-holdem",
                        "tournament",
                        "freeroll",
                        neighborhood.lower().replace(" ", "-"),
                    ],
                    "price_min": None,
                    "price_max": None,
                    "price_note": "Free to play",
                    "is_free": True,
                    "source_url": SCHEDULE_URL,
                    "ticket_url": None,
                    "image_url": None,
                    "raw_text": f"Freeroll Atlanta poker at {venue_name} - {time_display}",
                    "extraction_confidence": 0.95,
                    "is_recurring": True,
                    "recurrence_rule": f"FREQ=WEEKLY;BYDAY={['MO','TU','WE','TH','FR','SA','SU'][day_of_week]}",
                    "content_hash": content_hash,
                }

                try:
                    insert_event(event_record)
                    events_new += 1
                    logger.info(f"Added: {title} on {start_date} at {time_display}")
                except Exception as e:
                    logger.error(f"Failed to insert: {title}: {e}")

        logger.info(
            f"Freeroll Atlanta crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Freeroll Atlanta: {e}")
        raise

    return events_found, events_new, events_updated
