"""
Crawler for The Tabernacle (tabernacleatl.com/shows).
Historic Downtown Atlanta concert venue, former church converted for the '96 Olympics.
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

BASE_URL = "https://www.tabernacleatl.com"
SHOWS_URL = f"{BASE_URL}/shows"

VENUE_DATA = {
    "name": "The Tabernacle",
    "slug": "tabernacle",
    "address": "152 Luckie St NW",
    "neighborhood": "Downtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30303",
    "venue_type": "music_venue",
    "website": BASE_URL,
}


def parse_date(date_text: str) -> Optional[str]:
    """Parse date from various formats."""
    date_text = date_text.strip()

    # Try "Jan 24" or "January 24" format (without year)
    match = re.search(r"(\w{3,9})\s+(\d{1,2})(?:,?\s*(\d{4}))?", date_text)
    if match:
        month, day, year = match.groups()
        if not year:
            year = str(datetime.now().year)

        for fmt in ["%b %d %Y", "%B %d %Y"]:
            try:
                dt = datetime.strptime(f"{month} {day} {year}", fmt)
                if dt < datetime.now():
                    dt = datetime.strptime(f"{month} {day} {int(year) + 1}", fmt)
                return dt.strftime("%Y-%m-%d")
            except ValueError:
                continue

    # Try "01/24/2026" format
    match = re.search(r"(\d{1,2})/(\d{1,2})/(\d{4})", date_text)
    if match:
        month, day, year = match.groups()
        try:
            dt = datetime(int(year), int(month), int(day))
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            pass

    return None


def parse_time(time_text: str) -> Optional[str]:
    """Parse time from '7:00 PM' format."""
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
    """Crawl The Tabernacle events."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    }

    try:
        logger.info(f"Fetching The Tabernacle: {SHOWS_URL}")
        response = requests.get(SHOWS_URL, headers=headers, timeout=30)
        response.raise_for_status()

        soup = BeautifulSoup(response.text, "html.parser")
        venue_id = get_or_create_venue(VENUE_DATA)

        # Find event listings - try multiple approaches
        # Approach 1: Look for event/show containers
        event_items = soup.find_all(class_=re.compile(r"event|show|concert"))

        if not event_items:
            # Approach 2: Find article tags
            event_items = soup.find_all("article")

        if not event_items:
            # Approach 3: Find divs with links containing event info
            event_items = soup.find_all("div", class_=re.compile(r"card|item|listing"))

        if not event_items:
            # Approach 4: Find by event links
            event_links = soup.find_all("a", href=re.compile(r"/shows/|/event/"))
            event_items = []
            seen = set()
            for link in event_links:
                parent = link.find_parent("div") or link.find_parent("article")
                if parent and id(parent) not in seen:
                    seen.add(id(parent))
                    event_items.append(parent)

        for item in event_items:
            # Find title
            title_el = item.find(["h2", "h3", "h4"]) or item.find(class_=re.compile(r"title|name"))
            if not title_el:
                # Try finding title in links
                link = item.find("a")
                if link:
                    title_el = link
                else:
                    continue

            title = title_el.get_text(strip=True)
            if not title or len(title) < 3:
                continue

            # Skip navigation/UI items
            skip_patterns = ["buy tickets", "more info", "view all", "subscribe"]
            if any(p in title.lower() for p in skip_patterns):
                continue

            # Get all text for date/time parsing
            item_text = item.get_text(" ", strip=True)

            # Parse date
            date_el = item.find(class_=re.compile(r"date"))
            if date_el:
                date_text = date_el.get_text(strip=True)
            else:
                date_text = item_text

            start_date = parse_date(date_text)
            if not start_date:
                continue

            # Parse time
            time_el = item.find(class_=re.compile(r"time|doors"))
            if time_el:
                time_text = time_el.get_text(strip=True)
            else:
                time_text = item_text

            start_time = parse_time(time_text)

            events_found += 1

            # Generate content hash
            content_hash = generate_content_hash(title, "The Tabernacle", start_date)

            # Check for existing
            existing = find_event_by_hash(content_hash)
            if existing:
                events_updated += 1
                continue

            # Find event URL
            link_el = item.find("a", href=True)
            if link_el:
                href = link_el.get("href", "")
                event_url = href if href.startswith("http") else f"{BASE_URL}{href}"
            else:
                event_url = SHOWS_URL

            # Extract description if available
            desc_el = item.find("p") or item.find(class_=re.compile(r"desc|support"))
            description = desc_el.get_text(strip=True) if desc_el else None

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
                "category": "music",
                "subcategory": "concert",
                "tags": ["music", "concert", "tabernacle", "downtown"],
                "price_min": None,
                "price_max": None,
                "price_note": None,
                "is_free": False,
                "source_url": event_url,
                "ticket_url": event_url,
                "image_url": None,
                "raw_text": item_text[:500] if item_text else None,
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

        logger.info(f"The Tabernacle crawl complete: {events_found} found, {events_new} new")

    except Exception as e:
        logger.error(f"Failed to crawl The Tabernacle: {e}")
        raise

    return events_found, events_new, events_updated
