"""
Crawler for Wild Aster Books in Chamblee.
Indie bookstore with stage for storytelling, open mic nights, and performances.
"""

import json
import logging
from datetime import datetime, timedelta
from bs4 import BeautifulSoup
import requests

from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://www.wildasterbooks.com"
EVENTS_URL = f"{BASE_URL}/events"

VENUE_DATA = {
    "name": "Wild Aster Books",
    "slug": "wild-aster-books",
    "address": "5450 Peachtree Industrial Blvd",
    "neighborhood": "Chamblee",
    "city": "Chamblee",
    "state": "GA",
    "zip": "30341",
    "venue_type": "bookstore",
    "website": BASE_URL,
}

# Recurring events: Storytime with MaryJean on Tuesdays & Thursdays at 10:30am
RECURRING_STORYTIMES = [
    {"title": "Storytime with MaryJean", "weekday": 1, "time": "10:30"},  # Tuesday
    {"title": "Storytime with MaryJean", "weekday": 3, "time": "10:30"},  # Thursday
]


def generate_storytime_events(source_id: int, venue_id: int, weeks_ahead: int = 8) -> list[dict]:
    """Generate storytime events for the next N weeks."""
    events = []
    today = datetime.now()

    for recurring in RECURRING_STORYTIMES:
        for week in range(weeks_ahead):
            # Calculate the date for this weekday
            days_ahead = recurring["weekday"] - today.weekday()
            if days_ahead < 0:
                days_ahead += 7
            event_date = today + timedelta(days=days_ahead + (week * 7))

            # Skip if in the past
            if event_date.date() < today.date():
                continue

            start_date = event_date.strftime("%Y-%m-%d")
            content_hash = generate_content_hash(recurring["title"], VENUE_DATA["name"], start_date)
            description = "Join MaryJean for interactive children's storytime on our stage. Perfect for little readers and their families!"
            day_names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

            events.append({
                "source_id": source_id,
                "venue_id": venue_id,
                "title": recurring["title"],
                "description": description,
                "start_date": start_date,
                "start_time": recurring["time"],
                "end_date": None,
                "end_time": "11:00",
                "is_all_day": False,
                "category": "family",
                "subcategory": "storytime",
                "tags": ["family", "kids", "storytime", "books", "reading", "chamblee"],
                "price_min": None,
                "price_max": None,
                "price_note": "Free",
                "is_free": True,
                "source_url": BASE_URL,
                "ticket_url": None,
                "image_url": None,
                "raw_text": f"Recurring: {recurring['title']}",
                "extraction_confidence": 0.90,
                "is_recurring": True,
                "recurrence_rule": None,
                "content_hash": content_hash,
                "series_hint": {
                    "series_type": "recurring_show",
                    "series_title": recurring["title"],
                    "frequency": "weekly",
                    "day_of_week": day_names[recurring["weekday"]],
                    "description": description,
                },
            })

    return events


def parse_square_events(html: str) -> list[dict]:
    """Try to parse Square event data from page bootstrap state."""
    events = []
    soup = BeautifulSoup(html, "html.parser")

    # Look for Square bootstrap data
    scripts = soup.find_all("script")
    for script in scripts:
        if script.string and "window.__BOOTSTRAP_STATE__" in script.string:
            try:
                # Extract JSON from bootstrap state
                start = script.string.find("{")
                end = script.string.rfind("}") + 1
                if start >= 0 and end > start:
                    data = json.loads(script.string[start:end])
                    # Look for featured events
                    if "featuredEvents" in str(data):
                        # Square stores events in various locations
                        pass  # Square events are loaded dynamically via API
            except (json.JSONDecodeError, TypeError):
                continue

    return events


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Wild Aster Books events."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
    }

    try:
        venue_id = get_or_create_venue(VENUE_DATA)

        # Try to fetch events page for any additional events
        try:
            response = requests.get(EVENTS_URL, headers=headers, timeout=30)
            if response.ok:
                square_events = parse_square_events(response.text)
                # Process any Square events found
                for event_data in square_events:
                    events_found += 1
                    # Would process here if Square events were parseable
        except Exception as e:
            logger.debug(f"Could not fetch Square events: {e}")

        # Generate recurring storytime events
        storytime_events = generate_storytime_events(source_id, venue_id)

        for event_record in storytime_events:
            events_found += 1
            existing = find_event_by_hash(event_record["content_hash"])
            if existing:
                smart_update_existing_event(existing, event_record)
                events_updated += 1
                continue

            # Extract series_hint if present
            series_hint = event_record.pop("series_hint", None)

            try:
                insert_event(event_record, series_hint=series_hint)
                events_new += 1
            except Exception as e:
                logger.error(f"Failed to insert {event_record['title']}: {e}")

        logger.info(f"Wild Aster Books: Found {events_found} events, {events_new} new, {events_updated} existing")

    except Exception as e:
        logger.error(f"Failed to crawl Wild Aster Books: {e}")
        raise

    return events_found, events_new, events_updated
