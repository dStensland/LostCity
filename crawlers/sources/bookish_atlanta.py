"""
Crawler for Bookish Atlanta in East Atlanta Village.
Queer-owned, women-led indie bookshop with book clubs, story times, and events.
"""

import logging
from datetime import datetime, timedelta

from db import get_or_create_venue, insert_event, find_event_by_hash
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://www.bookishatl.com"

VENUE_DATA = {
    "name": "Bookish Atlanta",
    "slug": "bookish-atlanta",
    "address": "490 Flat Shoals Avenue SE",
    "neighborhood": "East Atlanta",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30316",
    "venue_type": "bookstore",
    "website": BASE_URL,
}

# Book clubs meet at partner venues but are organized by Bookish Atlanta
BOOK_CLUB_VENUE_HOLY_TACO = {
    "name": "Holy Taco",
    "slug": "holy-taco",
    "address": "1314 Glenwood Avenue SE",
    "neighborhood": "East Atlanta",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30316",
    "venue_type": "restaurant",
    "website": "https://holytacoatl.com",
}

BOOK_CLUB_VENUE_MANUELS = {
    "name": "Manuel's Tavern",
    "slug": "manuels-tavern",
    "address": "602 N Highland Avenue NE",
    "neighborhood": "Poncey-Highland",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30307",
    "venue_type": "bar",
    "website": "https://manuelstavern.com",
}

# Recurring book clubs: (title, weekday_position, weekday, time, venue_data)
# weekday: 0=Monday, 1=Tuesday, etc.
# weekday_position: -1=last, 1=first
RECURRING_BOOK_CLUBS = [
    ("Contemporary Fiction Book Club", -1, 0, "19:00", BOOK_CLUB_VENUE_HOLY_TACO),  # Last Monday
    ("Fantasy Book Club", 1, 1, "19:30", BOOK_CLUB_VENUE_MANUELS),  # First Tuesday
    ("Memoirs and Other True Stories Book Club", -1, 1, "19:00", BOOK_CLUB_VENUE_HOLY_TACO),  # Last Tuesday
]


def get_nth_weekday_of_month(year: int, month: int, weekday: int, position: int) -> datetime:
    """Get the nth weekday of a month. position=-1 means last."""
    if position > 0:
        # First occurrence: start from day 1
        first_day = datetime(year, month, 1)
        days_ahead = weekday - first_day.weekday()
        if days_ahead < 0:
            days_ahead += 7
        target = first_day + timedelta(days=days_ahead)
        # Add weeks for nth occurrence
        target += timedelta(weeks=position - 1)
        return target
    else:
        # Last occurrence: start from last day of month
        if month == 12:
            last_day = datetime(year + 1, 1, 1) - timedelta(days=1)
        else:
            last_day = datetime(year, month + 1, 1) - timedelta(days=1)
        days_behind = last_day.weekday() - weekday
        if days_behind < 0:
            days_behind += 7
        return last_day - timedelta(days=days_behind)


def generate_book_club_events(source_id: int, months_ahead: int = 3) -> list[dict]:
    """Generate book club events for the next N months."""
    events = []
    today = datetime.now()

    for title, position, weekday, time, venue_data in RECURRING_BOOK_CLUBS:
        venue_id = get_or_create_venue(venue_data)

        for month_offset in range(months_ahead):
            year = today.year
            month = today.month + month_offset
            if month > 12:
                month -= 12
                year += 1

            event_date = get_nth_weekday_of_month(year, month, weekday, position)

            # Skip if date is in the past
            if event_date.date() < today.date():
                continue

            start_date = event_date.strftime("%Y-%m-%d")
            content_hash = generate_content_hash(title, "Bookish Atlanta", start_date)
            description = "Monthly book club hosted by Bookish Atlanta. Join fellow readers for discussion and community."

            events.append({
                "source_id": source_id,
                "venue_id": venue_id,
                "title": title,
                "description": description,
                "start_date": start_date,
                "start_time": time,
                "end_date": None,
                "end_time": None,
                "is_all_day": False,
                "category": "community",
                "subcategory": "book_club",
                "tags": ["books", "book-club", "reading", "community", "east-atlanta"],
                "price_min": None,
                "price_max": None,
                "price_note": "Free to attend",
                "is_free": True,
                "source_url": BASE_URL,
                "ticket_url": None,
                "image_url": None,
                "raw_text": f"Recurring: {title}",
                "extraction_confidence": 0.90,
                "is_recurring": True,
                "recurrence_rule": None,
                "content_hash": content_hash,
                "series_hint": {
                    "series_type": "recurring_show",
                    "series_title": title,
                    "frequency": "monthly",
                    "description": description,
                },
            })

    return events


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Bookish Atlanta events."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        # Generate recurring book club events
        book_club_events = generate_book_club_events(source_id)

        for event_record in book_club_events:
            events_found += 1
            existing = find_event_by_hash(event_record["content_hash"])
            if existing:
                events_updated += 1
                continue

            # Extract series_hint if present
            series_hint = event_record.pop("series_hint", None)

            try:
                insert_event(event_record, series_hint=series_hint)
                events_new += 1
            except Exception as e:
                logger.error(f"Failed to insert {event_record['title']}: {e}")

        logger.info(f"Bookish Atlanta: Found {events_found} events, {events_new} new, {events_updated} existing")

    except Exception as e:
        logger.error(f"Failed to crawl Bookish Atlanta: {e}")
        raise

    return events_found, events_new, events_updated
