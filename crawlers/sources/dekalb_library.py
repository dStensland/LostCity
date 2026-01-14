"""
Crawler for DeKalb County Public Library System events.
Uses Communico events platform.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime
from typing import Optional
import httpx
from bs4 import BeautifulSoup

from db import get_or_create_venue, insert_event, find_event_by_hash
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://events.dekalblibrary.org"
EVENTS_URL = f"{BASE_URL}/events"

# Map branch names to venue data
BRANCH_VENUES = {
    "decatur": {
        "name": "Decatur Library",
        "slug": "decatur-library",
        "address": "215 Sycamore St",
        "neighborhood": "Downtown Decatur",
        "city": "Decatur",
        "state": "GA",
        "zip": "30030",
        "venue_type": "library",
    },
}

DEFAULT_VENUE = {
    "name": "DeKalb County Library",
    "slug": "dekalb-county-library",
    "city": "Decatur",
    "state": "GA",
    "venue_type": "library",
}


def find_branch_venue(location_text: str) -> dict:
    """Find matching branch venue from location text."""
    location_lower = location_text.lower()
    for key, venue in BRANCH_VENUES.items():
        if key in location_lower:
            return venue
    return DEFAULT_VENUE


def parse_date(date_str: str) -> Optional[str]:
    """Parse date from various formats."""
    for fmt in ["%Y-%m-%d", "%B %d, %Y", "%b %d, %Y", "%m/%d/%Y", "%A, %B %d, %Y"]:
        try:
            dt = datetime.strptime(date_str.strip(), fmt)
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            continue

    # Try partial formats
    current_year = datetime.now().year
    for fmt in ["%B %d", "%b %d"]:
        try:
            dt = datetime.strptime(date_str.strip(), fmt)
            dt = dt.replace(year=current_year)
            if dt < datetime.now():
                dt = dt.replace(year=current_year + 1)
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            continue

    return None


def parse_time(time_str: str) -> Optional[str]:
    """Parse time from various formats."""
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
    """Crawl DeKalb County Library events."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        }

        response = httpx.get(
            EVENTS_URL,
            headers=headers,
            timeout=30,
            follow_redirects=True,
            params={"v": "grid"}
        )
        response.raise_for_status()

        soup = BeautifulSoup(response.text, 'html.parser')

        # Find event cards - Communico uses various class patterns
        event_elements = soup.find_all(['div', 'article', 'li'], class_=re.compile(r'event|card|listing', re.I))

        for event_el in event_elements:
            try:
                # Get title
                title_el = event_el.find(['h2', 'h3', 'h4', 'a'], class_=re.compile(r'title|name|heading', re.I))
                if not title_el:
                    title_el = event_el.find(['h2', 'h3', 'h4'])
                if not title_el:
                    continue

                title = title_el.get_text(strip=True)
                if not title or len(title) < 3:
                    continue

                # Skip non-events
                if any(skip in title.lower() for skip in ['view all', 'subscribe', 'newsletter', 'ongoing']):
                    continue

                # Get date from various possible elements
                date_el = event_el.find(['time', 'span', 'div'], class_=re.compile(r'date', re.I))
                if not date_el:
                    date_el = event_el.find(string=re.compile(r'(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d', re.I))

                if not date_el:
                    continue

                date_text = date_el.get_text(strip=True) if hasattr(date_el, 'get_text') else str(date_el)

                # Extract just the date part
                date_match = re.search(r'(\w+\s+\d{1,2},?\s*\d{0,4})', date_text)
                if date_match:
                    date_text = date_match.group(1)

                start_date = parse_date(date_text)
                if not start_date:
                    continue

                # Get time
                time_text = event_el.get_text()
                time_match = re.search(r'(\d{1,2}:\d{2}\s*(am|pm))', time_text, re.I)
                start_time = parse_time(time_match.group()) if time_match else None

                # Get location/branch
                location_el = event_el.find(['span', 'div'], class_=re.compile(r'location|branch|venue', re.I))
                location_text = location_el.get_text(strip=True) if location_el else ""
                venue_data = find_branch_venue(location_text)
                venue_id = get_or_create_venue(venue_data)

                # Get description
                desc_el = event_el.find(['p', 'div'], class_=re.compile(r'desc|summary|teaser', re.I))
                description = desc_el.get_text(strip=True)[:500] if desc_el else None

                # Get event URL
                link_el = title_el if title_el.name == 'a' else event_el.find('a', href=True)
                event_url = ''
                if link_el and link_el.get('href'):
                    event_url = link_el['href']
                    if not event_url.startswith('http'):
                        event_url = f"{BASE_URL}{event_url}"

                events_found += 1

                content_hash = generate_content_hash(title, venue_data['name'], start_date)

                existing = find_event_by_hash(content_hash)
                if existing:
                    events_updated += 1
                    continue

                # Determine subcategory
                title_lower = title.lower()
                if 'book club' in title_lower or 'reading group' in title_lower:
                    subcategory = 'words.bookclub'
                elif 'story' in title_lower or 'storytime' in title_lower:
                    subcategory = 'words.storytelling'
                elif 'author' in title_lower or 'signing' in title_lower:
                    subcategory = 'words.reading'
                elif 'poetry' in title_lower:
                    subcategory = 'words.poetry'
                elif 'writing' in title_lower or 'workshop' in title_lower:
                    subcategory = 'words.workshop'
                else:
                    subcategory = 'words.lecture'

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
                    "tags": ["library", "free", "dekalb"],
                    "price_min": None,
                    "price_max": None,
                    "price_note": None,
                    "is_free": True,
                    "source_url": event_url or EVENTS_URL,
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
                logger.debug(f"Error processing event: {e}")
                continue

        logger.info(f"DeKalb Library crawl complete: {events_found} found, {events_new} new")

    except Exception as e:
        logger.error(f"Failed to crawl DeKalb Library: {e}")
        raise

    return events_found, events_new, events_updated
