"""
Crawler for Little Shop of Stories (littleshopofstories.com/events).
A children's bookstore in Decatur with storytimes, book clubs, and author events.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime
from typing import Optional
from bs4 import BeautifulSoup
import httpx

from db import get_or_create_venue, insert_event, find_event_by_hash
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://www.littleshopofstories.com"
EVENTS_URL = f"{BASE_URL}/events"

VENUE_DATA = {
    "name": "Little Shop of Stories",
    "slug": "little-shop-of-stories",
    "address": "133A E Court Square",
    "neighborhood": "Downtown Decatur",
    "city": "Decatur",
    "state": "GA",
    "zip": "30030",
    "venue_type": "bookstore",
    "website": BASE_URL,
}


def parse_date(date_str: str) -> Optional[str]:
    """Parse date from various formats like 'Jan 04' or '1/4/2026'."""
    current_year = datetime.now().year

    # Clean up the string
    date_str = date_str.strip()

    # Try "Jan 04" format
    for fmt in ["%b %d", "%B %d"]:
        try:
            dt = datetime.strptime(date_str, fmt)
            dt = dt.replace(year=current_year)
            if dt < datetime.now():
                dt = dt.replace(year=current_year + 1)
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            continue

    # Try with year
    for fmt in ["%b %d, %Y", "%B %d, %Y", "%m/%d/%Y", "%Y-%m-%d"]:
        try:
            dt = datetime.strptime(date_str, fmt)
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            continue

    return None


def parse_time(time_str: str) -> Optional[str]:
    """Parse time from format like '11:00am' or '5:00pm'."""
    try:
        match = re.search(r'(\d{1,2}):(\d{2})\s*(am|pm)', time_str, re.IGNORECASE)
        if match:
            hour, minute, period = match.groups()
            hour = int(hour)
            if period.lower() == 'pm' and hour != 12:
                hour += 12
            elif period.lower() == 'am' and hour == 12:
                hour = 0
            return f"{hour:02d}:{minute}"
    except Exception:
        pass
    return None


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Little Shop of Stories events."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
        }

        response = httpx.get(EVENTS_URL, headers=headers, timeout=30, follow_redirects=True)
        response.raise_for_status()

        soup = BeautifulSoup(response.text, 'html.parser')
        venue_id = get_or_create_venue(VENUE_DATA)

        # Find event cards
        event_elements = soup.find_all(['div', 'article', 'li'], class_=re.compile(r'event|card|item', re.I))

        for event_el in event_elements:
            try:
                text = event_el.get_text()

                # Extract title
                title_el = event_el.find(['h2', 'h3', 'h4', 'strong'])
                if not title_el:
                    continue

                title = title_el.get_text(strip=True)
                if not title or len(title) < 3:
                    continue

                # Skip navigation/non-event items
                if any(skip in title.lower() for skip in ['view all', 'see more', 'calendar', 'menu']):
                    continue

                # Extract date
                date_match = re.search(r'(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}', text, re.I)
                if not date_match:
                    continue

                start_date = parse_date(date_match.group())
                if not start_date:
                    continue

                # Extract time
                time_match = re.search(r'(\d{1,2}:\d{2}\s*(am|pm))', text, re.I)
                start_time = parse_time(time_match.group()) if time_match else None

                # Extract description
                desc_el = event_el.find('p')
                description = desc_el.get_text(strip=True)[:500] if desc_el else None

                events_found += 1

                content_hash = generate_content_hash(title, VENUE_DATA['name'], start_date)

                existing = find_event_by_hash(content_hash)
                if existing:
                    events_updated += 1
                    continue

                # Determine subcategory
                title_lower = title.lower()
                if 'book club' in title_lower:
                    subcategory = 'words.bookclub'
                elif 'story' in title_lower or 'storytime' in title_lower:
                    subcategory = 'words.storytelling'
                elif 'poetry' in title_lower:
                    subcategory = 'words.poetry'
                elif 'workshop' in title_lower or 'writing' in title_lower:
                    subcategory = 'words.workshop'
                else:
                    subcategory = 'words.reading'

                event_record = {
                    "source_id": source_id,
                    "venue_id": venue_id,
                    "title": title,
                    "description": description,
                    "start_date": start_date,
                    "start_time": start_time,
                    "end_date": None,
                    "end_time": None,
                    "is_all_day": False,
                    "category": "words",
                    "subcategory": subcategory,
                    "tags": ["books", "children", "family", "storytime", "decatur"],
                    "price_min": None,
                    "price_max": None,
                    "price_note": None,
                    "is_free": True,
                    "source_url": EVENTS_URL,
                    "ticket_url": None,
                    "image_url": None,
                    "raw_text": None,
                    "extraction_confidence": 0.8,
                    "is_recurring": False,
                    "recurrence_rule": None,
                    "content_hash": content_hash,
                }

                insert_event(event_record)
                events_new += 1
                logger.info(f"Added: {title} on {start_date}")

            except Exception as e:
                logger.debug(f"Error processing event element: {e}")
                continue

        logger.info(f"Little Shop of Stories crawl complete: {events_found} found, {events_new} new")

    except Exception as e:
        logger.error(f"Failed to crawl Little Shop of Stories: {e}")
        raise

    return events_found, events_new, events_updated
