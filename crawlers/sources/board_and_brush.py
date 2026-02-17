"""
Crawler for Board & Brush DIY wood sign workshops (Atlanta area locations).

Workshop data is embedded as a JavaScript array in the page HTML.
No Playwright needed - extract and parse the calendarEvents JS variable.
"""

from __future__ import annotations

import re
import json
import logging
from datetime import datetime
from typing import Optional
import httpx
from bs4 import BeautifulSoup

from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://boardandbrush.com"

# All Atlanta-area locations
LOCATIONS = [
    {
        "slug": "southforsyth",
        "name": "Board & Brush - South Forsyth",
        "venue_slug": "board-and-brush-south-forsyth",
        "address": "410 Peachtree Pkwy, Suite 408",
        "neighborhood": "South Forsyth",
        "city": "Cumming",
        "state": "GA",
        "zip": "30041",
        "lat": 34.1376,
        "lng": -84.1402,
    },
    {
        "slug": "kennesaw",
        "name": "Board & Brush - Kennesaw",
        "venue_slug": "board-and-brush-kennesaw",
        "address": "2700 Town Center Dr NW, Suite 3200",
        "neighborhood": "Kennesaw",
        "city": "Kennesaw",
        "state": "GA",
        "zip": "30144",
        "lat": 34.0234,
        "lng": -84.6155,
    },
    {
        "slug": "canton",
        "name": "Board & Brush - Canton",
        "venue_slug": "board-and-brush-canton",
        "address": "2190 Towne Lake Pkwy, Suite 120",
        "neighborhood": "Canton",
        "city": "Canton",
        "state": "GA",
        "zip": "30114",
        "lat": 34.2267,
        "lng": -84.4909,
    },
    {
        "slug": "athens",
        "name": "Board & Brush - Athens",
        "venue_slug": "board-and-brush-athens",
        "address": "3700 Atlanta Hwy, Suite 131",
        "neighborhood": "Athens",
        "city": "Athens",
        "state": "GA",
        "zip": "30606",
        "lat": 33.9519,
        "lng": -83.3918,
    },
]


def parse_time_string(time_str: str) -> Optional[str]:
    """
    Parse time from formats like '6PM', '3:30PM', '11:30AM' to 24-hour 'HH:MM'.
    """
    if not time_str:
        return None

    time_str = time_str.strip().upper()

    # Match patterns like "6PM", "3:30PM", "11:30AM"
    match = re.match(r"(\d{1,2})(?::(\d{2}))?\s*(AM|PM)", time_str)
    if not match:
        return None

    hour_str, minute_str, period = match.groups()
    hour = int(hour_str)
    minute = int(minute_str) if minute_str else 0

    # Convert to 24-hour format
    if period == "PM" and hour != 12:
        hour += 12
    elif period == "AM" and hour == 12:
        hour = 0

    return f"{hour:02d}:{minute:02d}"


def is_private_event(event: dict) -> bool:
    """
    Check if an event is private and should be filtered out.
    Private events typically have different colors or specific titles.
    """
    title = event.get("evTitle", "").lower()
    color = event.get("color", "").lower()

    # Common indicators of private events
    if any(keyword in title for keyword in ["private", "closed", "reserved", "booked"]):
        return True

    # Some locations use color coding for private events (red, gray, etc.)
    if color in ["red", "gray", "#ff0000", "#808080"]:
        return True

    return False


def clean_title(title: str) -> tuple[str, list[str]]:
    """
    Clean event title and extract additional tags.
    Returns (cleaned_title, additional_tags).
    """
    tags = []

    if not title:
        return "", tags

    # Detect special event types
    if "kids" in title.lower() or "children" in title.lower():
        tags.append("family-friendly")
    if "date night" in title.lower() or "couples" in title.lower():
        tags.append("date-night")
    if "$50 friday" in title.lower():
        tags.append("special-pricing")
    if "condensed collection" in title.lower():
        tags.append("quick-workshop")

    # Remove price indicators from title (already extracted separately)
    cleaned = re.sub(r"\$\d+(?:\.\d{2})?\s*-?\s*", "", title)
    cleaned = cleaned.strip(" -")

    return cleaned, tags


def extract_calendar_events(html_content: str) -> list[dict]:
    """
    Extract calendarEvents JavaScript array from page HTML.
    Looks for pattern: var calendarEvents = [{...}, {...}];
    """
    # Try to find the calendarEvents variable assignment
    pattern = r"var\s+calendarEvents\s*=\s*(\[[\s\S]*?\]);?"

    match = re.search(pattern, html_content)
    if not match:
        logger.debug("Could not find calendarEvents variable in page")
        return []

    json_str = match.group(1)

    try:
        events = json.loads(json_str)
        if isinstance(events, list):
            return events
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse calendarEvents JSON: {e}")

    return []


def crawl_location(
    client: httpx.Client,
    location: dict,
    source_id: int,
    venue_id: int,
) -> tuple[int, int, int]:
    """Crawl one location's workshop calendar."""
    slug = location["slug"]
    venue_name = location["name"]

    location_url = f"{BASE_URL}/{slug}/"
    logger.info(f"Crawling {venue_name}: {location_url}")

    try:
        response = client.get(location_url, timeout=30)
        response.raise_for_status()
    except Exception as e:
        logger.error(f"Failed to fetch {location_url}: {e}")
        return 0, 0, 0

    events_found = 0
    events_new = 0
    events_updated = 0

    # Extract calendar events from JavaScript
    calendar_events = extract_calendar_events(response.text)

    if not calendar_events:
        logger.warning(f"No calendar events found for {venue_name}")
        return 0, 0, 0

    today = datetime.now().date()

    for event in calendar_events:
        try:
            # Skip private events
            if is_private_event(event):
                continue

            # Extract event data
            raw_title = event.get("evTitle", "")
            event_date = event.get("evEdate", "")  # YYYY-MM-DD format
            event_url = event.get("url", "")
            image_url = event.get("evimage", "")

            if not raw_title or not event_date:
                continue

            # Parse date and skip past events
            try:
                date_obj = datetime.strptime(event_date, "%Y-%m-%d").date()
                if date_obj < today:
                    continue
            except ValueError:
                logger.debug(f"Invalid date format: {event_date}")
                continue

            # Parse times
            time_data = event.get("time", {})
            start_time_str = time_data.get("start", "")
            end_time_str = time_data.get("end", "")

            start_time = parse_time_string(start_time_str)
            end_time = parse_time_string(end_time_str)

            # Clean title and extract tags
            title, event_tags = clean_title(raw_title)

            # Extract availability info
            seats_data = event.get("seats", {})
            available_seats = seats_data.get("available", 0)
            total_seats = seats_data.get("total", 0)

            # Build price note if seats info available
            price_note = None
            if total_seats:
                if available_seats == 0:
                    price_note = "Sold out"
                elif available_seats < 5:
                    price_note = f"Only {available_seats} seats left"

            events_found += 1

            # Generate content hash for dedup
            content_hash = generate_content_hash(title, venue_name, event_date)


            # Build tags
            tags = [
                "board-and-brush",
                "diy",
                "wood-sign",
                "workshop",
                "craft",
                "hands-on",
                "creative",
            ] + event_tags

            event_record = {
                "source_id": source_id,
                "venue_id": venue_id,
                "title": title,
                "description": None,
                "start_date": event_date,
                "start_time": start_time,
                "end_date": None,
                "end_time": end_time,
                "is_all_day": False,
                "category": "art",
                "subcategory": "arts.workshop",
                "tags": tags,
                "price_min": None,  # Could be extracted from title or event page
                "price_max": None,
                "price_note": price_note,
                "is_free": False,
                "source_url": event_url or location_url,
                "ticket_url": event_url or location_url,
                "image_url": image_url if image_url else None,
                "raw_text": None,
                "extraction_confidence": 0.90,
                "is_recurring": False,
                "recurrence_rule": None,
                "content_hash": content_hash,
                "is_class": True,
                "class_category": "woodworking",
            }

            existing = find_event_by_hash(content_hash)
            if existing:
                smart_update_existing_event(existing, event_record)
                events_updated += 1
                continue

            # Build series hint for class enrichment
            series_hint = {
                "series_type": "class_series",
                "series_title": title,
            }
            if image_url:
                series_hint["image_url"] = image_url

            try:
                insert_event(event_record, series_hint=series_hint)
                events_new += 1
                logger.info(f"  Added: {title} on {event_date} at {start_time or 'TBD'}")
            except Exception as e:
                logger.error(f"  Failed to insert {title}: {e}")

        except Exception as e:
            logger.debug(f"  Error parsing event: {e}")
            continue

    logger.info(f"  {venue_name}: {events_found} found, {events_new} new, {events_updated} updated")
    return events_found, events_new, events_updated


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl all Board & Brush locations. Returns (found, new, updated)."""
    source_id = source["id"]

    total_found = 0
    total_new = 0
    total_updated = 0

    # Create HTTP client with reasonable timeout
    client = httpx.Client(
        timeout=30.0,
        headers={
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
        },
        follow_redirects=True,
    )

    try:
        # Create or verify all venues first
        for location in LOCATIONS:
            venue_data = {
                "name": location["name"],
                "slug": location["venue_slug"],
                "address": location["address"],
                "neighborhood": location["neighborhood"],
                "city": location["city"],
                "state": location["state"],
                "zip": location["zip"],
                "lat": location["lat"],
                "lng": location["lng"],
                "venue_type": "studio",
                "spot_type": "studio",
                "website": f"{BASE_URL}/{location['slug']}/",
                "vibes": ["workshop", "creative", "hands-on", "diy", "date-night", "craft"],
            }

            venue_id = get_or_create_venue(venue_data)

            # Crawl this location
            found, new, updated = crawl_location(client, location, source_id, venue_id)
            total_found += found
            total_new += new
            total_updated += updated

        logger.info(
            f"Board & Brush crawl complete: {total_found} found, "
            f"{total_new} new, {total_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Board & Brush: {e}")
        raise

    finally:
        client.close()

    return total_found, total_new, total_updated
