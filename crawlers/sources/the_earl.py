"""
Crawler for The Earl (badearl.com/show-calendar/).
A music venue in East Atlanta.
"""

import re
import logging
from datetime import datetime
from bs4 import BeautifulSoup
from typing import Optional

from utils import fetch_page, slugify
from db import get_or_create_venue, insert_event, find_event_by_hash
from dedupe import generate_content_hash, is_duplicate

logger = logging.getLogger(__name__)

BASE_URL = "https://badearl.com"
CALENDAR_URL = f"{BASE_URL}/show-calendar/"

# Venue info (static - it's always The Earl)
VENUE_DATA = {
    "name": "The Earl",
    "slug": "the-earl",
    "address": "488 Flat Shoals Ave SE",
    "neighborhood": "East Atlanta",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30316",
    "venue_type": "music_venue",
    "website": BASE_URL
}


def parse_date(date_text: str) -> Optional[str]:
    """
    Parse date from format like 'Thursday, Jan. 15, 2026' to 'YYYY-MM-DD'.
    """
    try:
        # Clean up the text
        date_text = date_text.strip()
        # Handle abbreviated months with periods
        date_text = re.sub(r'(\w{3})\.', r'\1', date_text)
        # Parse the date
        dt = datetime.strptime(date_text, "%A, %b %d, %Y")
        return dt.strftime("%Y-%m-%d")
    except ValueError as e:
        logger.warning(f"Failed to parse date '{date_text}': {e}")
        return None


def parse_time(time_text: str) -> Optional[str]:
    """
    Parse time from format like '8:00 pm doors' or '8:30pm show' to 'HH:MM'.
    """
    try:
        # Extract time portion
        match = re.search(r'(\d{1,2}):(\d{2})\s*(am|pm)', time_text.lower())
        if not match:
            return None

        hour = int(match.group(1))
        minute = int(match.group(2))
        period = match.group(3)

        if period == 'pm' and hour != 12:
            hour += 12
        elif period == 'am' and hour == 12:
            hour = 0

        return f"{hour:02d}:{minute:02d}"
    except Exception as e:
        logger.warning(f"Failed to parse time '{time_text}': {e}")
        return None


def parse_price(price_text: str) -> tuple[Optional[float], Optional[float]]:
    """
    Parse price from format like '$15 ADV' or '$17 DOS'.
    Returns (price_min, price_max) - ADV is min, DOS is max.
    """
    try:
        match = re.search(r'\$(\d+)', price_text)
        if match:
            return float(match.group(1)), None
        return None, None
    except Exception:
        return None, None


def extract_events_from_html(html: str) -> list[dict]:
    """
    Extract event data from The Earl's calendar page HTML.
    """
    soup = BeautifulSoup(html, "lxml")
    events = []

    # Find all event items
    event_items = soup.select(".cl-layout__item")

    for item in event_items:
        try:
            event = {}

            # Get headliner (main artist)
            headliner_el = item.select_one(".show-listing-headliner")
            if not headliner_el:
                continue
            event["title"] = headliner_el.get_text(strip=True)

            # Get supporting acts
            support_els = item.select(".show-listing-support")
            support_acts = [el.get_text(strip=True) for el in support_els if el.get_text(strip=True)]
            if support_acts:
                event["description"] = f"With: {', '.join(support_acts)}"
                event["tags"] = support_acts
            else:
                event["description"] = None
                event["tags"] = []

            # Get date
            date_el = item.select_one(".show-listing-date")
            if date_el:
                event["start_date"] = parse_date(date_el.get_text(strip=True))
            else:
                continue  # Skip events without dates

            if not event["start_date"]:
                continue

            # Get times (doors and show)
            time_els = item.select(".show-listing-time")
            door_time = None
            show_time = None
            for time_el in time_els:
                time_text = time_el.get_text(strip=True).lower()
                if "door" in time_text:
                    door_time = parse_time(time_text)
                elif "show" in time_text:
                    show_time = parse_time(time_text)

            event["start_time"] = show_time or door_time
            event["door_time"] = door_time

            # Get prices
            price_els = item.select(".show-listing-price")
            price_min = None
            price_max = None
            for price_el in price_els:
                price_text = price_el.get_text(strip=True).upper()
                amount, _ = parse_price(price_text)
                if amount is not None:
                    if "ADV" in price_text:
                        price_min = amount
                    elif "DOS" in price_text:
                        price_max = amount

            event["price_min"] = price_min
            event["price_max"] = price_max or price_min
            event["is_free"] = price_min == 0 if price_min is not None else False

            # Check for free show indicator
            free_el = item.select_one(".listing-free-show-contain")
            if free_el and free_el.get_text(strip=True):
                event["is_free"] = True
                event["price_min"] = 0
                event["price_max"] = 0

            # Get detail page URL
            detail_link = item.select_one("a.cl-element-featured_media__anchor")
            if detail_link:
                href = detail_link.get("href", "")
                event["source_url"] = href if href.startswith("http") else BASE_URL + href
            else:
                event["source_url"] = CALENDAR_URL

            # Get ticket URL
            ticket_link = item.select_one(".show-btn a[href*='freshtix']")
            if ticket_link:
                event["ticket_url"] = ticket_link.get("href")
            else:
                event["ticket_url"] = None

            # Get image URL
            img_el = item.select_one(".cl-element-featured_media__image")
            if img_el:
                event["image_url"] = img_el.get("src")
            else:
                event["image_url"] = None

            # Set category
            event["category"] = "music"
            event["subcategory"] = None

            events.append(event)

        except Exception as e:
            logger.error(f"Failed to parse event item: {e}")
            continue

    return events


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl The Earl events.

    Args:
        source: Source record from database

    Returns:
        Tuple of (events_found, events_new, events_updated)
    """
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        # Fetch all pages of events
        all_events = []
        page = 1
        max_pages = 5  # Safety limit

        while page <= max_pages:
            url = CALENDAR_URL if page == 1 else f"{CALENDAR_URL}?sf_paged={page}"
            logger.info(f"Fetching The Earl page {page}: {url}")

            html = fetch_page(url)
            page_events = extract_events_from_html(html)

            if not page_events:
                break  # No more events

            all_events.extend(page_events)
            page += 1

        logger.info(f"Found {len(all_events)} events on The Earl")

        # Get or create venue
        venue_id = get_or_create_venue(VENUE_DATA)

        for event_data in all_events:
            events_found += 1

            # Generate content hash for deduplication
            content_hash = generate_content_hash(
                event_data["title"],
                "The Earl",
                event_data["start_date"]
            )

            # Check for existing event
            existing = find_event_by_hash(content_hash)
            if existing:
                logger.debug(f"Skipping duplicate: {event_data['title']}")
                events_updated += 1
                continue

            # Check fuzzy duplicate
            canonical_id = is_duplicate(
                type("Event", (), {
                    "title": event_data["title"],
                    "venue": type("Venue", (), {"name": "The Earl"})(),
                    "start_date": event_data["start_date"]
                })(),
                venue_id
            )

            if canonical_id:
                logger.debug(f"Skipping fuzzy duplicate: {event_data['title']}")
                events_updated += 1
                continue

            # Insert new event
            event_record = {
                "source_id": source_id,
                "venue_id": venue_id,
                "title": event_data["title"],
                "description": event_data.get("description"),
                "start_date": event_data["start_date"],
                "start_time": event_data.get("start_time"),
                "end_date": None,
                "end_time": None,
                "is_all_day": False,
                "category": event_data["category"],
                "subcategory": event_data.get("subcategory"),
                "tags": event_data.get("tags", []),
                "price_min": event_data.get("price_min"),
                "price_max": event_data.get("price_max"),
                "price_note": None,
                "is_free": event_data.get("is_free", False),
                "source_url": event_data["source_url"],
                "ticket_url": event_data.get("ticket_url"),
                "image_url": event_data.get("image_url"),
                "raw_text": None,
                "extraction_confidence": 0.95,  # High confidence - structured HTML
                "is_recurring": False,
                "recurrence_rule": None,
                "content_hash": content_hash
            }

            try:
                insert_event(event_record)
                events_new += 1
                logger.info(f"Added: {event_data['title']} on {event_data['start_date']}")
            except Exception as e:
                logger.error(f"Failed to insert event {event_data['title']}: {e}")

    except Exception as e:
        logger.error(f"Failed to crawl The Earl: {e}")
        raise

    return events_found, events_new, events_updated
