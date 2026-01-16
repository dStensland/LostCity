"""
Crawler for The Masquerade (masqueradeatlanta.com/events).
Atlanta's legendary multi-room music venue with Heaven, Hell, Purgatory, and Altar.
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

BASE_URL = "https://www.masqueradeatlanta.com"
EVENTS_URL = f"{BASE_URL}/events/"

VENUE_DATA = {
    "name": "The Masquerade",
    "slug": "the-masquerade",
    "address": "50 Lower Alabama St SW #110",
    "neighborhood": "Downtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30303",
    "venue_type": "music_venue",
    "website": BASE_URL,
}


def parse_date(date_text: str) -> Optional[str]:
    """Parse date from 'Thu 15 Jan 2026' or 'Jan 15, 2026' format."""
    # Clean up text
    date_text = date_text.strip()

    # Try "Thu 15 Jan 2026" format
    match = re.search(r"(\d{1,2})\s+(\w{3})\s+(\d{4})", date_text)
    if match:
        day, month, year = match.groups()
        try:
            dt = datetime.strptime(f"{day} {month} {year}", "%d %b %Y")
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            pass

    # Try "Jan 15, 2026" format
    match = re.search(r"(\w{3})\s+(\d{1,2}),?\s*(\d{4})?", date_text)
    if match:
        month, day, year = match.groups()
        if not year:
            year = str(datetime.now().year)
        try:
            dt = datetime.strptime(f"{month} {day} {year}", "%b %d %Y")
            # If date is in past, assume next year
            if dt < datetime.now():
                dt = datetime.strptime(f"{month} {day} {int(year) + 1}", "%b %d %Y")
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            pass

    return None


def parse_time(time_text: str) -> Optional[str]:
    """Parse time from 'Doors 7:00 pm' or '7:00 PM' format."""
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
    """Crawl The Masquerade events."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36"
    }

    try:
        logger.info(f"Fetching The Masquerade: {EVENTS_URL}")
        response = requests.get(EVENTS_URL, headers=headers, timeout=30)
        response.raise_for_status()

        soup = BeautifulSoup(response.text, "html.parser")
        venue_id = get_or_create_venue(VENUE_DATA)

        # Find all event containers - look for links with event titles
        # The page uses event cards with h3 headings for artist names
        event_cards = soup.find_all("a", href=True)

        for card in event_cards:
            # Skip non-event links
            href = card.get("href", "")
            if "/event/" not in href and "/events/" not in href.replace(EVENTS_URL, ""):
                continue

            # Find title (h3 inside link or strong text)
            title_el = card.find("h3") or card.find("strong")
            if not title_el:
                continue

            title = title_el.get_text(strip=True)
            if not title or len(title) < 3:
                continue

            # Skip navigation items
            skip_words = ["buy tickets", "sold out", "calendar", "venue info", "more info"]
            if title.lower() in skip_words:
                continue

            # Find date - look for text patterns in the card
            card_text = card.get_text(" ", strip=True)

            # Try to find date pattern
            date_match = re.search(
                r"(Mon|Tue|Wed|Thu|Fri|Sat|Sun)?\s*(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})",
                card_text,
                re.IGNORECASE
            )

            if not date_match:
                # Try alternate format: "Jan 15, 2026"
                date_match = re.search(
                    r"(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2}),?\s*(\d{4})?",
                    card_text,
                    re.IGNORECASE
                )

            if not date_match:
                continue

            # Parse the date
            start_date = parse_date(card_text)
            if not start_date:
                continue

            # Find time - look for "Doors X:XX pm" pattern
            start_time = parse_time(card_text)

            # Determine the room (Heaven, Hell, Purgatory, Altar)
            room = None
            for r in ["Heaven", "Hell", "Purgatory", "Altar"]:
                if r.lower() in card_text.lower():
                    room = r
                    break

            events_found += 1

            # Generate content hash for deduplication
            content_hash = generate_content_hash(title, "The Masquerade", start_date)

            # Check for existing event
            existing = find_event_by_hash(content_hash)
            if existing:
                events_updated += 1
                continue

            # Build event URL
            event_url = href if href.startswith("http") else f"{BASE_URL}{href}"

            # Build tags
            tags = ["music", "concert", "the-masquerade"]
            if room:
                tags.append(f"masquerade-{room.lower()}")

            event_record = {
                "source_id": source_id,
                "venue_id": venue_id,
                "title": title,
                "description": f"Live at The Masquerade{f' - {room}' if room else ''}",
                "start_date": start_date,
                "start_time": start_time,
                "end_date": None,
                "end_time": None,
                "is_all_day": False,
                "category": "music",
                "subcategory": "concert",
                "tags": tags,
                "price_min": None,
                "price_max": None,
                "price_note": None,
                "is_free": False,
                "source_url": event_url,
                "ticket_url": event_url,
                "image_url": None,
                "raw_text": card_text[:500] if card_text else None,
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

        logger.info(f"The Masquerade crawl complete: {events_found} found, {events_new} new")

    except Exception as e:
        logger.error(f"Failed to crawl The Masquerade: {e}")
        raise

    return events_found, events_new, events_updated
