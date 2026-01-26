"""
Crawler for Woofs Atlanta - the city's only LGBTQ+ sports bar.
Sports viewing parties and LGBTQ+ events since 2002.
Uses JSON-LD Event schema data embedded in the page.
"""

import json
import logging
import re
from datetime import datetime
from bs4 import BeautifulSoup
import requests

from db import get_or_create_venue, insert_event, find_event_by_hash
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://woofsatlanta.com"
EVENTS_URL = BASE_URL

VENUE_DATA = {
    "name": "Woofs",
    "slug": "woofs-atlanta",
    "address": "494 Plasters Ave NE, Suite 200",
    "neighborhood": "Midtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30324",
    "venue_type": "sports_bar",
    "website": BASE_URL,
}


def parse_jsonld_events(soup: BeautifulSoup) -> list[dict]:
    """Extract Event data from JSON-LD scripts."""
    events = []
    scripts = soup.find_all("script", type="application/ld+json")

    for script in scripts:
        try:
            data = json.loads(script.string)
            # Handle both single events and arrays
            if isinstance(data, list):
                for item in data:
                    if item.get("@type") == "Event":
                        events.append(item)
            elif isinstance(data, dict):
                if data.get("@type") == "Event":
                    events.append(data)
                # Also check for @graph arrays
                if "@graph" in data:
                    for item in data["@graph"]:
                        if item.get("@type") == "Event":
                            events.append(item)
        except (json.JSONDecodeError, TypeError):
            continue

    return events


def parse_datetime(date_str: str) -> tuple[str, str]:
    """Parse ISO datetime string, return (date, time) tuple."""
    if not date_str:
        return None, None

    try:
        # Handle various ISO formats: "2026-1-23T18:00-5:00", "2026-01-23T18:00:00"
        # Normalize the date string
        date_str = re.sub(r"-(\d):", r"-0\1:", date_str)  # Fix single digit hours in timezone

        # Try parsing with timezone
        if "T" in date_str:
            # Remove timezone offset for simpler parsing
            base = date_str.split("-05:00")[0].split("-5:00")[0].split("+")[0]
            if "T" in base:
                dt = datetime.fromisoformat(base)
                return dt.strftime("%Y-%m-%d"), dt.strftime("%H:%M")
    except ValueError:
        pass

    # Fallback: try basic date parsing
    try:
        match = re.match(r"(\d{4})-(\d{1,2})-(\d{1,2})", date_str)
        if match:
            year, month, day = match.groups()
            return f"{year}-{int(month):02d}-{int(day):02d}", None
    except Exception:
        pass

    return None, None


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Woofs Atlanta events using JSON-LD data."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
        }
        response = requests.get(EVENTS_URL, headers=headers, timeout=30)
        response.raise_for_status()

        soup = BeautifulSoup(response.text, "html.parser")
        venue_id = get_or_create_venue(VENUE_DATA)

        # Extract JSON-LD events
        json_events = parse_jsonld_events(soup)

        for event_data in json_events:
            events_found += 1

            title = event_data.get("name", "").strip()
            if not title:
                continue

            # Parse dates
            start_date, start_time = parse_datetime(event_data.get("startDate", ""))
            end_date, end_time = parse_datetime(event_data.get("endDate", ""))

            if not start_date:
                continue

            # Get image
            image_url = event_data.get("image", "")

            # Generate hash
            content_hash = generate_content_hash(
                title, VENUE_DATA["name"], start_date
            )

            existing = find_event_by_hash(content_hash)
            if existing:
                events_updated += 1
                continue

            # Determine category based on event name
            title_lower = title.lower()
            if "drag" in title_lower:
                category = "nightlife"
                subcategory = "drag"
                tags = ["lgbtq", "drag", "nightlife", "woofs"]
            elif any(sport in title_lower for sport in ["football", "soccer", "basketball", "baseball"]):
                category = "sports"
                subcategory = "watch_party"
                tags = ["lgbtq", "sports", "watch-party", "woofs"]
            else:
                category = "nightlife"
                subcategory = "bar_event"
                tags = ["lgbtq", "nightlife", "woofs"]

            event_record = {
                "source_id": source_id,
                "venue_id": venue_id,
                "title": title,
                "description": "Event at Woofs Atlanta, the city's only LGBTQ+ sports bar.",
                "start_date": start_date,
                "start_time": start_time,
                "end_date": end_date,
                "end_time": end_time,
                "is_all_day": start_time is None,
                "category": category,
                "subcategory": subcategory,
                "tags": tags,
                "price_min": None,
                "price_max": None,
                "price_note": None,
                "is_free": True,
                "source_url": EVENTS_URL,
                "ticket_url": None,
                "image_url": image_url if image_url else None,
                "raw_text": json.dumps(event_data),
                "extraction_confidence": 0.90,
                "is_recurring": False,
                "recurrence_rule": None,
                "content_hash": content_hash,
            }

            try:
                insert_event(event_record)
                events_new += 1
                logger.debug(f"Added: {title} on {start_date}")
            except Exception as e:
                logger.error(f"Failed to insert {title}: {e}")

        logger.info(f"Woofs Atlanta: Found {events_found} events, {events_new} new, {events_updated} existing")

    except Exception as e:
        logger.error(f"Failed to crawl Woofs Atlanta: {e}")
        raise

    return events_found, events_new, events_updated
