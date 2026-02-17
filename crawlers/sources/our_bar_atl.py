"""
Crawler for Our Bar ATL (ourbaratl.com).
Edgewood Avenue nightlife venue with live music, comedy, and community events.
Part of Atlanta's vibrant Edgewood bar scene.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime
from typing import Optional

import requests
from bs4 import BeautifulSoup

from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://www.ourbaratl.com"
EVENTS_URL = f"{BASE_URL}/events"

VENUE_DATA = {
    "name": "Our Bar ATL",
    "slug": "our-bar-atl",
    "address": "488 Edgewood Ave SE",
    "neighborhood": "Edgewood",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30312",
    "lat": 33.7540,
    "lng": -84.3720,
    "venue_type": "bar",
    "spot_type": "bar",
    "website": BASE_URL,
    "description": "Edgewood Avenue bar and event space with live music, comedy, and community programming.",
}

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
}


def parse_date(date_str: str) -> Optional[str]:
    """Parse date from various formats."""
    date_str = date_str.strip()
    now = datetime.now()

    # Try various formats
    formats = [
        "%B %d, %Y",
        "%b %d, %Y",
        "%m/%d/%Y",
        "%m/%d/%y",
    ]

    for fmt in formats:
        try:
            dt = datetime.strptime(date_str, fmt)
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            continue

    # Try partial match
    match = re.search(
        r"(January|February|March|April|May|June|July|August|September|October|November|December|"
        r"Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s*(\d{4}))?",
        date_str,
        re.IGNORECASE
    )
    if match:
        month_str = match.group(1)[:3]
        day = match.group(2)
        year = match.group(3) if match.group(3) else str(now.year)
        try:
            dt = datetime.strptime(f"{month_str} {day} {year}", "%b %d %Y")
            if dt.date() < now.date():
                dt = dt.replace(year=now.year + 1)
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            pass

    return None


def parse_time(time_str: str) -> Optional[str]:
    """Parse time from various formats."""
    match = re.search(r"(\d{1,2}):?(\d{2})?\s*(am|pm|a|p)", time_str, re.IGNORECASE)
    if match:
        hour = int(match.group(1))
        minute = int(match.group(2)) if match.group(2) else 0
        period = match.group(3).lower()
        if period in ("pm", "p") and hour != 12:
            hour += 12
        elif period in ("am", "a") and hour == 12:
            hour = 0
        return f"{hour:02d}:{minute:02d}"
    return None


def determine_category(title: str) -> tuple[str, Optional[str], list[str]]:
    """Determine category based on event title."""
    title_lower = title.lower()
    tags = ["our-bar", "edgewood", "nightlife"]

    if any(w in title_lower for w in ["comedy", "stand-up", "standup", "open mic comedy", "laugh"]):
        return "comedy", "standup", tags + ["comedy"]
    if any(w in title_lower for w in ["dj", "dance", "disco", "party"]):
        return "nightlife", "club", tags + ["dj", "dance"]
    if any(w in title_lower for w in ["karaoke"]):
        return "nightlife", "karaoke", tags + ["karaoke"]
    if any(w in title_lower for w in ["trivia", "quiz"]):
        return "community", None, tags + ["trivia"]
    if any(w in title_lower for w in ["drag", "brunch"]):
        return "nightlife", "drag", tags + ["drag", "lgbtq"]
    if any(w in title_lower for w in ["live", "music", "band", "concert"]):
        return "music", "live", tags + ["live-music"]
    if any(w in title_lower for w in ["open mic"]):
        return "music", "open_mic", tags + ["open-mic"]
    if any(w in title_lower for w in ["pop-up", "market", "vendor"]):
        return "community", "market", tags + ["pop-up"]

    # Default to nightlife
    return "nightlife", "bar", tags


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Our Bar ATL events."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        venue_id = get_or_create_venue(VENUE_DATA)

        # Try events page
        response = requests.get(EVENTS_URL, headers=HEADERS, timeout=30)
        response.raise_for_status()

        soup = BeautifulSoup(response.text, "html.parser")

        # Look for event elements
        event_selectors = [
            ".event", ".event-item", "[class*='event']",
            ".show", ".listing", "article"
        ]

        for selector in event_selectors:
            elements = soup.select(selector)
            if not elements:
                continue

            for element in elements:
                try:
                    # Extract title
                    title_elem = element.find(["h1", "h2", "h3", "h4", "a"])
                    if not title_elem:
                        continue
                    title = title_elem.get_text(strip=True)
                    if not title or len(title) < 3:
                        continue

                    # Extract date
                    text = element.get_text()
                    date_match = re.search(
                        r"(January|February|March|April|May|June|July|August|September|October|November|December|"
                        r"Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\.?\s+\d{1,2}",
                        text,
                        re.IGNORECASE
                    )
                    if not date_match:
                        # Try mm/dd format
                        date_match = re.search(r"\d{1,2}/\d{1,2}/\d{2,4}", text)

                    if not date_match:
                        continue

                    start_date = parse_date(date_match.group())
                    if not start_date:
                        continue

                    # Skip past events
                    if datetime.strptime(start_date, "%Y-%m-%d").date() < datetime.now().date():
                        continue

                    events_found += 1

                    # Extract time
                    time_match = re.search(r"\d{1,2}:?\d{0,2}\s*(am|pm|a|p)", text, re.I)
                    start_time = parse_time(time_match.group()) if time_match else "21:00"

                    content_hash = generate_content_hash(
                        title, "Our Bar ATL", start_date
                    )


                    category, subcategory, tags = determine_category(title)

                    # Check if free
                    is_free = "free" in text.lower()

                    # Extract link
                    link = element.find("a", href=True)
                    event_url = link["href"] if link else EVENTS_URL
                    if event_url.startswith("/"):
                        event_url = BASE_URL + event_url

                    event_record = {
                        "source_id": source_id,
                        "venue_id": venue_id,
                        "title": title,
                        "description": f"Event at Our Bar ATL on Edgewood Avenue",
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
                        "is_free": is_free,
                        "source_url": event_url,
                        "ticket_url": event_url,
                        "image_url": None,
                        "raw_text": text[:500],
                        "extraction_confidence": 0.75,
                        "is_recurring": False,
                        "recurrence_rule": None,
                        "content_hash": content_hash,
                    }

                    existing = find_event_by_hash(content_hash)
                    if existing:
                        smart_update_existing_event(existing, event_record)
                        events_updated += 1
                        continue

                    try:
                        insert_event(event_record)
                        events_new += 1
                        logger.info(f"Added: {title} on {start_date}")
                    except Exception as e:
                        logger.error(f"Failed to insert: {title}: {e}")

                except Exception as e:
                    logger.debug(f"Error parsing event: {e}")
                    continue

            break  # Found events with this selector

        logger.info(f"Our Bar ATL crawl complete: {events_found} found, {events_new} new, {events_updated} updated")

    except Exception as e:
        logger.error(f"Failed to crawl Our Bar ATL: {e}")
        raise

    return events_found, events_new, events_updated
