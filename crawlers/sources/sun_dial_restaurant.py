"""
Crawler for The Sun Dial Restaurant atop the Westin Peachtree Plaza.
Rotating restaurant with 360-degree views, 700+ feet above Atlanta.
"""

import json
import logging
from datetime import datetime
from bs4 import BeautifulSoup
import requests

from db import get_or_create_venue, insert_event, find_event_by_hash
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://www.sundialrestaurant.com"
EVENTS_URL = f"{BASE_URL}/sundialevents"
CALENDAR_URL = f"{BASE_URL}/calendar"

VENUE_DATA = {
    "name": "The Sun Dial Restaurant",
    "slug": "sun-dial-restaurant",
    "address": "210 Peachtree Street NW",
    "neighborhood": "Downtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30303",
    "venue_type": "restaurant",
    "website": BASE_URL,
}


def parse_jsonld_events(soup: BeautifulSoup) -> list[dict]:
    """Extract Event data from JSON-LD scripts."""
    events = []
    scripts = soup.find_all("script", type="application/ld+json")

    for script in scripts:
        try:
            data = json.loads(script.string)
            if isinstance(data, dict):
                if data.get("@type") == "Event":
                    events.append(data)
                if "@graph" in data:
                    events.extend([e for e in data["@graph"] if e.get("@type") == "Event"])
            elif isinstance(data, list):
                events.extend([e for e in data if e.get("@type") == "Event"])
        except (json.JSONDecodeError, TypeError):
            continue

    return events


def generate_annual_events(source_id: int, venue_id: int) -> list[dict]:
    """Generate known annual special events at Sun Dial."""
    events = []
    current_year = datetime.now().year
    today = datetime.now().date()

    # Valentine's Day (Feb 14)
    valentines_date = f"{current_year}-02-14"
    if datetime.strptime(valentines_date, "%Y-%m-%d").date() >= today:
        content_hash = generate_content_hash("Valentine's Day Dinner", VENUE_DATA["name"], valentines_date)
        events.append({
            "source_id": source_id,
            "venue_id": venue_id,
            "title": "Valentine's Day Dinner at Sun Dial",
            "description": "Celebrate Valentine's Day 700+ feet above Atlanta with a special prix fixe menu and 360-degree rotating views of the city.",
            "start_date": valentines_date,
            "start_time": "17:00",
            "end_date": None,
            "end_time": "22:00",
            "is_all_day": False,
            "category": "food_drink",
            "subcategory": "special_dinner",
            "tags": ["valentines", "romantic", "fine-dining", "downtown", "views"],
            "price_min": None,
            "price_max": None,
            "price_note": "Reservations required",
            "is_free": False,
            "source_url": BASE_URL,
            "ticket_url": None,
            "image_url": None,
            "raw_text": "Valentine's Day at Sun Dial",
            "extraction_confidence": 0.90,
            "is_recurring": True,
            "recurrence_rule": "Annual - February 14",
            "content_hash": content_hash,
        })

    # New Year's Eve (Dec 31)
    nye_date = f"{current_year}-12-31"
    if datetime.strptime(nye_date, "%Y-%m-%d").date() >= today:
        content_hash = generate_content_hash("New Year's Eve Celebration", VENUE_DATA["name"], nye_date)
        events.append({
            "source_id": source_id,
            "venue_id": venue_id,
            "title": f"New Year's Eve {current_year + 1} Celebration",
            "description": f"Ring in {current_year + 1} at the top of Atlanta! Watch fireworks and the city lights from 700+ feet above with special dinner and celebration.",
            "start_date": nye_date,
            "start_time": "20:00",
            "end_date": None,
            "end_time": None,
            "is_all_day": False,
            "category": "nightlife",
            "subcategory": "new_years",
            "tags": ["new-years-eve", "celebration", "fine-dining", "downtown", "fireworks"],
            "price_min": None,
            "price_max": None,
            "price_note": "Reservations required",
            "is_free": False,
            "source_url": BASE_URL,
            "ticket_url": None,
            "image_url": None,
            "raw_text": "New Year's Eve at Sun Dial",
            "extraction_confidence": 0.90,
            "is_recurring": True,
            "recurrence_rule": "Annual - December 31",
            "content_hash": content_hash,
        })

    return events


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Sun Dial Restaurant events."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
    }

    try:
        venue_id = get_or_create_venue(VENUE_DATA)

        # Try to fetch events page
        for url in [EVENTS_URL, CALENDAR_URL]:
            try:
                response = requests.get(url, headers=headers, timeout=30)
                if response.ok:
                    soup = BeautifulSoup(response.text, "html.parser")

                    # Try JSON-LD first
                    json_events = parse_jsonld_events(soup)

                    for event_data in json_events:
                        events_found += 1
                        title = event_data.get("name", "").strip()
                        if not title:
                            continue

                        start_date = event_data.get("startDate", "")[:10] if event_data.get("startDate") else None
                        if not start_date:
                            continue

                        content_hash = generate_content_hash(title, VENUE_DATA["name"], start_date)
                        existing = find_event_by_hash(content_hash)
                        if existing:
                            events_updated += 1
                            continue

                        event_record = {
                            "source_id": source_id,
                            "venue_id": venue_id,
                            "title": title,
                            "description": event_data.get("description", "Special event at The Sun Dial Restaurant, 73 stories above Atlanta")[:500],
                            "start_date": start_date,
                            "start_time": None,
                            "end_date": None,
                            "end_time": None,
                            "is_all_day": True,
                            "category": "food_drink",
                            "subcategory": "special_dinner",
                            "tags": ["fine-dining", "downtown", "views", "rotating-restaurant"],
                            "price_min": None,
                            "price_max": None,
                            "price_note": "Reservations required",
                            "is_free": False,
                            "source_url": url,
                            "ticket_url": None,
                            "image_url": event_data.get("image"),
                            "raw_text": json.dumps(event_data),
                            "extraction_confidence": 0.85,
                            "is_recurring": False,
                            "recurrence_rule": None,
                            "content_hash": content_hash,
                        }

                        try:
                            insert_event(event_record)
                            events_new += 1
                        except Exception as e:
                            logger.error(f"Failed to insert {title}: {e}")

            except requests.RequestException as e:
                logger.debug(f"Could not fetch {url}: {e}")

        # Generate known annual events
        annual_events = generate_annual_events(source_id, venue_id)

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

        logger.info(f"Sun Dial Restaurant: Found {events_found} events, {events_new} new, {events_updated} existing")

    except Exception as e:
        logger.error(f"Failed to crawl Sun Dial Restaurant: {e}")
        raise

    return events_found, events_new, events_updated
