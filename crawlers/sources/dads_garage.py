"""
Crawler for Dad's Garage Theatre (dadsgarage.com/shows).
Comedy and improv theater in Atlanta.
"""

import re
import logging
from datetime import datetime
from bs4 import BeautifulSoup
from typing import Optional

from utils import fetch_page, slugify
from db import get_or_create_venue, insert_event, find_event_by_hash
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://dadsgarage.com"
SHOWS_URL = f"{BASE_URL}/shows"

VENUE_DATA = {
    "name": "Dad's Garage Theatre",
    "slug": "dads-garage",
    "address": "569 Ezzard St SE",
    "neighborhood": "Old Fourth Ward",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30312",
    "venue_type": "theater",
    "website": BASE_URL
}


def parse_squarespace_date(date_text: str) -> Optional[str]:
    """
    Parse Squarespace date format like 'Thursday, January 15, 2026' to YYYY-MM-DD.
    """
    try:
        date_text = date_text.strip()
        # Remove day of week if present
        if "," in date_text:
            parts = date_text.split(",", 1)
            if len(parts) > 1:
                date_text = parts[1].strip()

        # Parse "January 15, 2026"
        dt = datetime.strptime(date_text, "%B %d, %Y")
        return dt.strftime("%Y-%m-%d")
    except ValueError:
        try:
            # Try without year
            dt = datetime.strptime(date_text, "%B %d")
            # Assume current year or next year
            now = datetime.now()
            dt = dt.replace(year=now.year)
            if dt < now:
                dt = dt.replace(year=now.year + 1)
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            logger.warning(f"Failed to parse date: {date_text}")
            return None


def parse_time(time_text: str) -> Optional[str]:
    """Parse time like '8:00 PM' to 'HH:MM'."""
    try:
        time_text = time_text.strip().upper()
        match = re.search(r'(\d{1,2}):(\d{2})\s*(AM|PM)', time_text)
        if match:
            hour = int(match.group(1))
            minute = int(match.group(2))
            period = match.group(3)
            if period == 'PM' and hour != 12:
                hour += 12
            elif period == 'AM' and hour == 12:
                hour = 0
            return f"{hour:02d}:{minute:02d}"
    except Exception:
        pass
    return None


def extract_events(html: str) -> list[dict]:
    """Extract events from Dad's Garage shows page."""
    soup = BeautifulSoup(html, 'lxml')
    events = []

    event_items = soup.select('.eventlist-event')

    for item in event_items:
        try:
            # Title
            title_el = item.select_one('.eventlist-title a, .eventlist-title')
            if not title_el:
                continue
            title = title_el.get_text(strip=True)

            # URL
            link = item.select_one('.eventlist-title a')
            source_url = BASE_URL + link.get('href') if link and link.get('href') else SHOWS_URL

            # Date
            date_el = item.select_one('.eventlist-meta-date')
            start_date = None
            if date_el:
                date_text = date_el.get_text(strip=True)
                start_date = parse_squarespace_date(date_text)

            if not start_date:
                continue

            # Time
            time_el = item.select_one('.eventlist-meta-time')
            start_time = None
            if time_el:
                start_time = parse_time(time_el.get_text(strip=True))

            # Description/excerpt
            desc_el = item.select_one('.eventlist-excerpt, .eventlist-description')
            description = desc_el.get_text(strip=True) if desc_el else None

            # Image
            img_el = item.select_one('.eventlist-column-thumbnail img')
            image_url = None
            if img_el:
                image_url = img_el.get('data-src') or img_el.get('src')

            events.append({
                "title": title,
                "description": description,
                "start_date": start_date,
                "start_time": start_time,
                "source_url": source_url,
                "image_url": image_url,
                "category": "comedy",
            })

        except Exception as e:
            logger.warning(f"Failed to parse event: {e}")
            continue

    return events


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Dad's Garage events."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        logger.info(f"Fetching Dad's Garage: {SHOWS_URL}")
        html = fetch_page(SHOWS_URL)
        all_events = extract_events(html)

        logger.info(f"Found {len(all_events)} events at Dad's Garage")

        venue_id = get_or_create_venue(VENUE_DATA)

        for event_data in all_events:
            events_found += 1

            content_hash = generate_content_hash(
                event_data["title"],
                "Dad's Garage Theatre",
                event_data["start_date"]
            )

            existing = find_event_by_hash(content_hash)
            if existing:
                events_updated += 1
                continue

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
                "category": "comedy",
                "subcategory": "improv",
                "tags": ["improv", "comedy", "theater"],
                "price_min": None,
                "price_max": None,
                "price_note": None,
                "is_free": False,
                "source_url": event_data["source_url"],
                "ticket_url": event_data["source_url"],
                "image_url": event_data.get("image_url"),
                "raw_text": None,
                "extraction_confidence": 0.95,
                "is_recurring": False,
                "recurrence_rule": None,
                "content_hash": content_hash,
            }

            try:
                insert_event(event_record)
                events_new += 1
                logger.debug(f"Added: {event_data['title']}")
            except Exception as e:
                logger.error(f"Failed to insert: {event_data['title']}: {e}")

    except Exception as e:
        logger.error(f"Failed to crawl Dad's Garage: {e}")
        raise

    return events_found, events_new, events_updated
