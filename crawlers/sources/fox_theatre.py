"""
Crawler for Fox Theatre (foxtheatre.org/events).
Atlanta's historic theater hosting Broadway shows, concerts, and special events.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime
from typing import Optional

import requests
from bs4 import BeautifulSoup

from db import get_or_create_venue, insert_event, find_event_by_hash
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://www.foxtheatre.org"
EVENTS_URL = f"{BASE_URL}/events"

VENUE_DATA = {
    "name": "Fox Theatre",
    "slug": "fox-theatre",
    "address": "660 Peachtree St NE",
    "neighborhood": "Midtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30308",
    "venue_type": "theater",
    "website": BASE_URL,
}


def parse_date(date_text: str) -> Optional[str]:
    """Parse date from 'Jan 16, 2026' or similar format."""
    date_text = date_text.strip()

    # Try "Jan 16, 2026" format
    match = re.search(r"(\w{3})\s+(\d{1,2}),?\s*(\d{4})?", date_text)
    if match:
        month, day, year = match.groups()
        if not year:
            year = str(datetime.now().year)
        try:
            dt = datetime.strptime(f"{month} {day} {year}", "%b %d %Y")
            if dt < datetime.now():
                dt = datetime.strptime(f"{month} {day} {int(year) + 1}", "%b %d %Y")
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            pass

    # Try "January 16, 2026" format
    match = re.search(r"(\w+)\s+(\d{1,2}),?\s*(\d{4})?", date_text)
    if match:
        month, day, year = match.groups()
        if not year:
            year = str(datetime.now().year)
        try:
            dt = datetime.strptime(f"{month} {day} {year}", "%B %d %Y")
            if dt < datetime.now():
                dt = datetime.strptime(f"{month} {day} {int(year) + 1}", "%B %d %Y")
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            pass

    return None


def parse_time(time_text: str) -> Optional[str]:
    """Parse time from '7:30 PM' format."""
    match = re.search(r"(\d{1,2}):(\d{2})\s*(am|pm)", time_text, re.IGNORECASE)
    if match:
        hour, minute, period = match.groups()
        hour = int(hour)
        if period.lower() == "pm" and hour != 12:
            hour += 12
        elif period.lower() == "am" and hour == 12:
            hour = 0
        return f"{hour:02d}:{minute}"
    return None


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Fox Theatre events."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36"
    }

    try:
        logger.info(f"Fetching Fox Theatre: {EVENTS_URL}")
        response = requests.get(EVENTS_URL, headers=headers, timeout=30)
        response.raise_for_status()

        soup = BeautifulSoup(response.text, "html.parser")
        venue_id = get_or_create_venue(VENUE_DATA)

        # Find event detail links
        event_links = soup.find_all("a", href=re.compile(r"/events/detail/"))

        seen_urls = set()

        for link in event_links:
            href = link.get("href", "")
            if href in seen_urls:
                continue
            seen_urls.add(href)

            # Get the parent container for context
            parent = link.find_parent()
            if not parent:
                continue

            # Find title - h3 or h4 in the same container
            container = parent.find_parent() or parent
            title_el = container.find(["h3", "h4"])

            if not title_el:
                # Title might be in the link itself
                title_el = link.find(["h3", "h4"])

            if not title_el:
                continue

            title = title_el.get_text(strip=True)
            if not title or len(title) < 3:
                continue

            # Find date - look in the text before/around the title
            container_text = container.get_text(" ", strip=True)

            # Extract date
            start_date = parse_date(container_text)
            if not start_date:
                continue

            # Extract time
            start_time = parse_time(container_text)

            events_found += 1

            # Generate content hash
            content_hash = generate_content_hash(title, "Fox Theatre", start_date)

            # Check for existing
            existing = find_event_by_hash(content_hash)
            if existing:
                events_updated += 1
                continue

            # Build event URL
            event_url = href if href.startswith("http") else f"{BASE_URL}{href}"

            # Determine category based on content
            category = "theater"
            subcategory = None
            tags = ["fox-theatre"]

            title_lower = title.lower()
            if any(w in title_lower for w in ["broadway", "musical", "hamilton", "wicked"]):
                subcategory = "musical"
                tags.append("broadway")
            elif any(w in title_lower for w in ["concert", "tour", "live"]):
                category = "music"
                subcategory = "concert"
                tags.append("concert")
            elif any(w in title_lower for w in ["comedy", "comedian", "stand-up"]):
                category = "comedy"
                tags.append("comedy")

            event_record = {
                "source_id": source_id,
                "venue_id": venue_id,
                "title": title,
                "description": None,
                "start_date": start_date,
                "start_time": start_time,
                "end_date": None,
                "end_time": None,
                "is_all_day": False,
                "category": category,
                "subcategory": subcategory,
                "tags": tags,
                "price_min": None,
                "price_max": None,
                "price_note": None,
                "is_free": False,
                "source_url": event_url,
                "ticket_url": event_url,
                "image_url": None,
                "raw_text": container_text[:500] if container_text else None,
                "extraction_confidence": 0.85,
                "is_recurring": False,
                "recurrence_rule": None,
                "content_hash": content_hash,
            }

            try:
                insert_event(event_record)
                events_new += 1
                logger.info(f"Added: {title} on {start_date}")
            except Exception as e:
                logger.error(f"Failed to insert: {title}: {e}")

        logger.info(f"Fox Theatre crawl complete: {events_found} found, {events_new} new")

    except Exception as e:
        logger.error(f"Failed to crawl Fox Theatre: {e}")
        raise

    return events_found, events_new, events_updated
