"""
Crawler for High Museum of Art (high.org/events).
Uses Playwright for JS-rendered content.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime
from typing import Optional
from bs4 import BeautifulSoup

try:
    from playwright.sync_api import sync_playwright
    PLAYWRIGHT_AVAILABLE = True
except ImportError:
    PLAYWRIGHT_AVAILABLE = False

from utils import slugify
from db import get_or_create_venue, insert_event, find_event_by_hash
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://high.org"
EVENTS_URL = f"{BASE_URL}/events/"

VENUE_DATA = {
    "name": "High Museum of Art",
    "slug": "high-museum",
    "address": "1280 Peachtree St NE",
    "neighborhood": "Midtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30309",
    "venue_type": "museum",
    "website": BASE_URL
}


def parse_date_heading(date_text: str) -> Optional[str]:
    """
    Parse date headings like 'January 14', 'Today', 'Daily', 'Weekly'.
    Returns YYYY-MM-DD or None for recurring events.
    """
    date_text = date_text.strip()
    now = datetime.now()
    year = now.year

    if date_text.lower() in ["daily", "weekly", "ongoing"]:
        return None  # Recurring events handled separately

    if date_text.lower() == "today":
        return now.strftime("%Y-%m-%d")

    if date_text.lower() == "tomorrow":
        from datetime import timedelta
        return (now + timedelta(days=1)).strftime("%Y-%m-%d")

    # Try parsing "January 14" format
    try:
        dt = datetime.strptime(date_text, "%B %d")
        dt = dt.replace(year=year)
        # If date is in the past, assume next year
        if dt < now:
            dt = dt.replace(year=year + 1)
        return dt.strftime("%Y-%m-%d")
    except ValueError:
        pass

    # Try "Jan 14" format
    try:
        dt = datetime.strptime(date_text, "%b %d")
        dt = dt.replace(year=year)
        if dt < now:
            dt = dt.replace(year=year + 1)
        return dt.strftime("%Y-%m-%d")
    except ValueError:
        pass

    logger.warning(f"Could not parse date heading: {date_text}")
    return None


def parse_time(time_text: str) -> Optional[str]:
    """Parse time like '1–2 p.m.' or '7:30 p.m.' to HH:MM."""
    if not time_text:
        return None

    time_text = time_text.strip().lower()

    # Look for start time pattern
    match = re.search(r'(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)', time_text)
    if match:
        hour = int(match.group(1))
        minute = int(match.group(2)) if match.group(2) else 0
        period = match.group(3).replace(".", "")

        if "p" in period and hour != 12:
            hour += 12
        elif "a" in period and hour == 12:
            hour = 0

        return f"{hour:02d}:{minute:02d}"

    return None


def fetch_with_playwright() -> str:
    """Fetch High Museum events page with Playwright."""
    if not PLAYWRIGHT_AVAILABLE:
        raise ImportError("Playwright is required for High Museum crawler")

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto(EVENTS_URL, wait_until="domcontentloaded", timeout=30000)
        page.wait_for_timeout(3000)  # Wait for JS to render
        html = page.content()
        browser.close()
        return html


def extract_events(html: str) -> list[dict]:
    """Extract events from High Museum page."""
    soup = BeautifulSoup(html, 'lxml')
    events = []

    # Find date containers
    date_containers = soup.select('.at-calendar-list-date-container')

    for container in date_containers:
        # Get date from heading
        date_h3 = container.select_one('h3')
        date_text = date_h3.get_text(strip=True) if date_h3 else ""
        start_date = parse_date_heading(date_text)

        is_recurring = date_text.lower() in ["daily", "weekly", "ongoing"]

        # Find events in this container
        event_cards = container.select('.at-calendar-list-element-container')

        for card in event_cards:
            try:
                # URL
                link = card.select_one('a[href*="/event/"]')
                if not link:
                    continue
                source_url = link.get('href', '')
                if source_url.startswith('/'):
                    source_url = BASE_URL + source_url

                # Title - look for h4 first, then strong
                title_el = card.select_one('h4, strong')
                title = title_el.get_text(strip=True) if title_el else None

                if not title:
                    # Get first line of text
                    text = card.get_text(strip=True)
                    title = text.split('\n')[0][:100]

                if not title:
                    continue

                # Time - look for time pattern in text
                card_text = card.get_text()
                time_match = re.search(r'\d{1,2}(?::\d{2})?\s*[–-]\s*\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?)', card_text, re.IGNORECASE)
                start_time = None
                if time_match:
                    start_time = parse_time(time_match.group())

                # For recurring events without a specific date, use today
                event_date = start_date
                if not event_date and is_recurring:
                    event_date = datetime.now().strftime("%Y-%m-%d")

                if not event_date:
                    continue

                # Description - look for excerpt or p tags
                desc_el = card.select_one('p, .excerpt, .description')
                description = desc_el.get_text(strip=True) if desc_el else None

                # Category based on text
                category = "art"
                text_lower = card_text.lower()
                if "tour" in text_lower:
                    category = "tours"
                elif "jazz" in text_lower or "music" in text_lower:
                    category = "music"
                elif "film" in text_lower:
                    category = "film"
                elif "dance" in text_lower:
                    category = "dance"
                elif "kids" in text_lower or "family" in text_lower or "toddler" in text_lower:
                    category = "family"

                events.append({
                    "title": title,
                    "description": description,
                    "start_date": event_date,
                    "start_time": start_time,
                    "source_url": source_url,
                    "category": category,
                    "is_recurring": is_recurring,
                })

            except Exception as e:
                logger.warning(f"Failed to parse event card: {e}")
                continue

    return events


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl High Museum events."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        logger.info(f"Fetching High Museum: {EVENTS_URL}")
        html = fetch_with_playwright()
        all_events = extract_events(html)

        logger.info(f"Found {len(all_events)} events at High Museum")

        venue_id = get_or_create_venue(VENUE_DATA)

        for event_data in all_events:
            events_found += 1

            content_hash = generate_content_hash(
                event_data["title"],
                "High Museum of Art",
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
                "is_all_day": event_data.get("start_time") is None,
                "category": event_data.get("category", "art"),
                "subcategory": "museum",
                "tags": ["art", "museum", "culture"],
                "price_min": None,
                "price_max": None,
                "price_note": "Museum admission may be required",
                "is_free": False,
                "source_url": event_data["source_url"],
                "ticket_url": event_data["source_url"],
                "image_url": None,
                "raw_text": None,
                "extraction_confidence": 0.85,
                "is_recurring": event_data.get("is_recurring", False),
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
        logger.error(f"Failed to crawl High Museum: {e}")
        raise

    return events_found, events_new, events_updated
