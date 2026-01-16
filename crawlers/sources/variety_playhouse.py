"""
Crawler for Variety Playhouse (variety-playhouse.com/calendar).
Atlanta's beloved Little Five Points music venue since 1940.
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

BASE_URL = "https://www.variety-playhouse.com"
CALENDAR_URL = f"{BASE_URL}/calendar/"

VENUE_DATA = {
    "name": "Variety Playhouse",
    "slug": "variety-playhouse",
    "address": "1099 Euclid Ave NE",
    "neighborhood": "Little Five Points",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30307",
    "venue_type": "music_venue",
    "website": BASE_URL,
}


def parse_date(date_text: str) -> Optional[str]:
    """Parse date from various formats like 'Fri Jan 17' or 'January 17, 2026'."""
    date_text = date_text.strip()

    # Try "Fri Jan 17" format (with or without year)
    match = re.search(r"(\w{3})\s+(\w{3})\s+(\d{1,2})(?:,?\s*(\d{4}))?", date_text)
    if match:
        _, month, day, year = match.groups()
        if not year:
            year = str(datetime.now().year)
        try:
            dt = datetime.strptime(f"{month} {day} {year}", "%b %d %Y")
            if dt < datetime.now():
                dt = datetime.strptime(f"{month} {day} {int(year) + 1}", "%b %d %Y")
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            pass

    # Try "Jan 17, 2026" format
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

    # Try "January 17, 2026" format
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
    """Parse time from '7:30 PM' or 'Doors: 7:00 PM' format."""
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
    """Crawl Variety Playhouse events."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
    }

    try:
        logger.info(f"Fetching Variety Playhouse: {CALENDAR_URL}")
        response = requests.get(CALENDAR_URL, headers=headers, timeout=30)
        response.raise_for_status()

        soup = BeautifulSoup(response.text, "html.parser")
        venue_id = get_or_create_venue(VENUE_DATA)

        # Try AXS event card selectors first
        event_cards = soup.find_all(class_=re.compile(r"c-axs-event-card"))

        if not event_cards:
            # Fallback: look for event containers
            event_cards = soup.find_all(class_=re.compile(r"event"))

        if not event_cards:
            # Another fallback: find by structure
            event_cards = soup.find_all("article")

        for card in event_cards:
            # Find title
            title_el = (
                card.find(class_=re.compile(r"title"))
                or card.find(["h2", "h3", "h4"])
            )
            if not title_el:
                continue

            title = title_el.get_text(strip=True)
            if not title or len(title) < 3:
                continue

            # Skip navigation items
            skip_words = ["buy tickets", "view all", "calendar", "more"]
            if title.lower() in skip_words:
                continue

            # Find date
            date_el = card.find(class_=re.compile(r"date"))
            if date_el:
                date_text = date_el.get_text(strip=True)
            else:
                date_text = card.get_text(" ", strip=True)

            start_date = parse_date(date_text)
            if not start_date:
                continue

            # Find time
            time_el = card.find(class_=re.compile(r"doors|time"))
            if time_el:
                time_text = time_el.get_text(strip=True)
            else:
                time_text = card.get_text(" ", strip=True)

            start_time = parse_time(time_text)

            events_found += 1

            # Generate content hash
            content_hash = generate_content_hash(title, "Variety Playhouse", start_date)

            # Check for existing
            existing = find_event_by_hash(content_hash)
            if existing:
                events_updated += 1
                continue

            # Find event URL
            link_el = card.find("a", href=True)
            if link_el:
                href = link_el.get("href", "")
                event_url = href if href.startswith("http") else f"{BASE_URL}{href}"
            else:
                event_url = CALENDAR_URL

            # Extract supporting text/opener
            support_el = card.find(class_=re.compile(r"support"))
            supporting = support_el.get_text(strip=True) if support_el else None

            event_record = {
                "source_id": source_id,
                "venue_id": venue_id,
                "title": title,
                "description": supporting,
                "start_date": start_date,
                "start_time": start_time,
                "end_date": None,
                "end_time": None,
                "is_all_day": False,
                "category": "music",
                "subcategory": "concert",
                "tags": ["music", "concert", "variety-playhouse", "little-five-points"],
                "price_min": None,
                "price_max": None,
                "price_note": None,
                "is_free": False,
                "source_url": event_url,
                "ticket_url": event_url,
                "image_url": None,
                "raw_text": card.get_text(" ", strip=True)[:500],
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

        logger.info(f"Variety Playhouse crawl complete: {events_found} found, {events_new} new")

    except Exception as e:
        logger.error(f"Failed to crawl Variety Playhouse: {e}")
        raise

    return events_found, events_new, events_updated
