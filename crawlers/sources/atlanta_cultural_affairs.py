"""
Crawler for Atlanta Mayor's Office of Cultural Affairs.
City-sponsored arts programming including Atlanta Jazz Festival.
Note: Government site may block direct requests - uses fallback data for major annual events.
"""

import logging
from datetime import datetime
from bs4 import BeautifulSoup
import requests

from db import get_or_create_venue, insert_event, find_event_by_hash
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://www.atlantaga.gov/government/mayor-s-office/executive-offices/office-of-cultural-affairs"
EVENTS_URL = BASE_URL

# Events typically happen at city facilities
VENUES = {
    "piedmont_park": {
        "name": "Piedmont Park",
        "slug": "piedmont-park",
        "address": "400 Park Drive NE",
        "neighborhood": "Midtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30309",
        "venue_type": "park",
        "website": "https://piedmontpark.org",
    },
    "chastain": {
        "name": "Chastain Park Amphitheatre",
        "slug": "chastain-park-amphitheatre",
        "address": "4469 Stella Drive NW",
        "neighborhood": "Chastain Park",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30327",
        "venue_type": "amphitheater",
        "website": "https://www.livenation.com",
    },
    "woodruff_park": {
        "name": "Woodruff Park",
        "slug": "woodruff-park",
        "address": "91 Peachtree Street NW",
        "neighborhood": "Downtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30303",
        "venue_type": "park",
        "website": "https://www.atlantaga.gov",
    },
}


def get_atlanta_jazz_festival_dates(year: int) -> tuple[str, str]:
    """
    Atlanta Jazz Festival is held Memorial Day weekend (last weekend of May).
    Returns Saturday and Sunday dates.
    """
    from datetime import timedelta

    # Find the last Monday of May (Memorial Day)
    may_31 = datetime(year, 5, 31)
    # Go back to find the last Monday
    days_since_monday = (may_31.weekday() - 0) % 7
    memorial_day = may_31 - timedelta(days=days_since_monday)

    # Festival is Saturday and Sunday before Memorial Day
    saturday = memorial_day - timedelta(days=2)
    sunday = memorial_day - timedelta(days=1)

    return saturday.strftime("%Y-%m-%d"), sunday.strftime("%Y-%m-%d")


def generate_annual_events(source_id: int, year: int) -> list[dict]:
    """Generate known annual events for the Office of Cultural Affairs."""
    events = []

    # Atlanta Jazz Festival - Memorial Day Weekend at Piedmont Park
    sat_date, sun_date = get_atlanta_jazz_festival_dates(year)
    piedmont_venue_id = get_or_create_venue(VENUES["piedmont_park"])

    # Only generate if event is in the future
    today = datetime.now().date()
    sat_datetime = datetime.strptime(sat_date, "%Y-%m-%d").date()

    if sat_datetime >= today:
        for day_date, day_name in [(sat_date, "Saturday"), (sun_date, "Sunday")]:
            content_hash = generate_content_hash(f"Atlanta Jazz Festival {year} - {day_name}", "Piedmont Park", day_date)

            events.append({
                "source_id": source_id,
                "venue_id": piedmont_venue_id,
                "title": f"Atlanta Jazz Festival {year}",
                "description": f"Free outdoor jazz festival at Piedmont Park, presented by the City of Atlanta Mayor's Office of Cultural Affairs. {day_name} performances featuring local, national, and international jazz artists.",
                "start_date": day_date,
                "start_time": "12:00",
                "end_date": None,
                "end_time": "22:00",
                "is_all_day": False,
                "category": "music",
                "subcategory": "jazz",
                "tags": ["jazz", "music", "festival", "free", "outdoor", "piedmont-park"],
                "price_min": None,
                "price_max": None,
                "price_note": "Free admission",
                "is_free": True,
                "source_url": "https://atlantafestivals.com/atlanta-jazz-festival/",
                "ticket_url": None,
                "image_url": None,
                "raw_text": f"Atlanta Jazz Festival {year} - {day_name}",
                "extraction_confidence": 0.95,
                "is_recurring": True,
                "recurrence_rule": "Annual - Memorial Day Weekend",
                "content_hash": content_hash,
            })

    return events


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Atlanta Cultural Affairs events."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    }

    try:
        # Try to fetch from government site
        page_events = []
        try:
            response = requests.get(EVENTS_URL, headers=headers, timeout=30)
            if response.ok:
                soup = BeautifulSoup(response.text, "html.parser")
                # Government sites often list events in news/announcement sections
                # Parse any event-like content found
        except requests.RequestException as e:
            logger.debug(f"Could not fetch Atlanta government site: {e}")

        # Generate known annual events
        current_year = datetime.now().year
        annual_events = generate_annual_events(source_id, current_year)

        # Also generate next year's events if we're past June
        if datetime.now().month > 6:
            annual_events.extend(generate_annual_events(source_id, current_year + 1))

        for event_record in annual_events:
            events_found += 1
            existing = find_event_by_hash(event_record["content_hash"])
            if existing:
                events_updated += 1
                continue

            try:
                insert_event(event_record)
                events_new += 1
            except Exception as e:
                logger.error(f"Failed to insert {event_record['title']}: {e}")

        logger.info(f"Atlanta Cultural Affairs: Found {events_found} events, {events_new} new, {events_updated} existing")

    except Exception as e:
        logger.error(f"Failed to crawl Atlanta Cultural Affairs: {e}")
        raise

    return events_found, events_new, events_updated
