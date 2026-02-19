"""
Crawler for Southern-Fried Gaming Expo (southernfriedgamingexpo.com).

Site uses JavaScript rendering - must use Playwright.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime
from typing import Optional

from playwright.sync_api import sync_playwright

from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash
from utils import extract_images_from_page

logger = logging.getLogger(__name__)

BASE_URL = "https://www.southernfriedgamingexpo.com"
EVENTS_URL = f"{BASE_URL}"

VENUE_DATA = {
    "name": "Southern-Fried Gaming Expo",
    "slug": "southern-fried-gaming",
    "address": "2000 Convention Center Concourse",
    "neighborhood": "Downtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30337",
    "lat": 33.6407,
    "lng": -84.4276,
    "venue_type": "convention",
    "spot_type": "convention",
    "website": BASE_URL,
}

_INVALID_TITLE_PATTERNS = (
    r"^(support|donate|tickets?|register|menu|home)$",
    r"^(sponsors?|volunteer|exhibitor|vendors?)$",
    r"^(monday|tuesday|wednesday|thursday|friday|saturday|sunday)$",
    r"^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|"
    r"january|february|march|april|june|july|august|september|october|november|december)$",
    r"^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|"
    r"january|february|march|april|may|june|july|august|september|october|november|december)\s+"
    r"\d{1,2}(?:st|nd|rd|th)?(?:,?\s+\d{4})?$",
    r"^\d{1,2}(?::\d{2})?\s*(am|pm)$",
)

WEEKDAY_PATTERN = re.compile(
    r"^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)$",
    re.IGNORECASE,
)


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


def parse_time_range(time_range_text: str) -> tuple[Optional[str], Optional[str]]:
    """Parse a time range line like '3:00 pm – Midnight'."""
    text = " ".join((time_range_text or "").split())
    if not text:
        return None, None

    parts = re.split(r"\s*[–-]\s*", text, maxsplit=1)
    if len(parts) == 1:
        return parse_time(parts[0]), None

    start_raw, end_raw = parts[0].strip(), parts[1].strip().lower()
    start_time = parse_time(start_raw)
    if end_raw == "midnight":
        end_time = "23:59"
    elif end_raw == "noon":
        end_time = "12:00"
    else:
        end_time = parse_time(parts[1])

    return start_time, end_time


def is_valid_event_title(value: str) -> bool:
    text = " ".join((value or "").split()).strip()
    if len(text) < 4 or len(text) > 100:
        return False
    lowered = text.lower()
    if any(re.match(pattern, lowered, re.IGNORECASE) for pattern in _INVALID_TITLE_PATTERNS):
        return False
    if re.match(r"^[\W\d_]+$", text):
        return False
    if "sponsor" in lowered or "thanks to our" in lowered:
        return False
    # Skip long sentence-like fragments scraped from body copy.
    if text.count(" ") > 10 and text.endswith("."):
        return False
    if text.lower().startswith(("event at ", "live music at ")):
        return False
    return True


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Southern-Fried Gaming Expo events using Playwright."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
                viewport={"width": 1920, "height": 1080},
            )
            page = context.new_page()

            venue_id = get_or_create_venue(VENUE_DATA)

            logger.info(f"Fetching Southern-Fried Gaming Expo: {EVENTS_URL}")
            page.goto(EVENTS_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(3000)

            # Extract images from page
            image_map = extract_images_from_page(page)

            # Scroll to load all content
            for _ in range(5):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1000)

            # Get page text and parse line by line
            body_text = page.inner_text("body")
            lines = [l.strip() for l in body_text.split("\n") if l.strip()]
            default_image_url = None
            for key, url in image_map.items():
                lowered = key.lower()
                if "southern-fried gaming expo" in lowered or "sfge" in lowered:
                    default_image_url = url
                    break

            # Parse events - look for date patterns
            i = 0
            while i < len(lines):
                line = lines[i]

                # Skip navigation items
                if len(line) < 3:
                    i += 1
                    continue

                # Look for date patterns
                date_match = re.match(
                    r"(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)?,?\s*(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})(?:,?\s+(\d{4}))?",
                    line,
                    re.IGNORECASE
                )

                if date_match:
                    if re.search(
                        r"[–-]\s*(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|"
                        r"January|February|March|April|May|June|July|August|September|October|November|December)\b",
                        line,
                        re.IGNORECASE,
                    ):
                        i += 1
                        continue

                    month = date_match.group(1)
                    day = date_match.group(2)
                    year = date_match.group(3) if date_match.group(3) else str(datetime.now().year)

                    weekday_label = None
                    for offset in [-1, -2]:
                        idx = i + offset
                        if 0 <= idx < len(lines):
                            maybe_weekday = lines[idx].strip()
                            if WEEKDAY_PATTERN.match(maybe_weekday):
                                weekday_label = maybe_weekday.title()
                                break

                    title = (
                        f"Southern-Fried Gaming Expo - {weekday_label}"
                        if weekday_label
                        else "Southern-Fried Gaming Expo"
                    )
                    start_time = None
                    end_time = None
                    for offset in [1, 2]:
                        idx = i + offset
                        if 0 <= idx < len(lines):
                            start_time, end_time = parse_time_range(lines[idx])
                            if start_time:
                                break

                    # Parse date
                    try:
                        month_str = month[:3] if len(month) > 3 else month
                        dt = datetime.strptime(f"{month_str} {day} {year}", "%b %d %Y")
                        if dt.date() < datetime.now().date():
                            dt = datetime.strptime(f"{month_str} {day} {int(year) + 1}", "%b %d %Y")
                        start_date = dt.strftime("%Y-%m-%d")
                    except ValueError:
                        i += 1
                        continue

                    events_found += 1

                    content_hash = generate_content_hash(title, "Southern-Fried Gaming Expo", start_date)

                    event_record = {
                        "source_id": source_id,
                        "venue_id": venue_id,
                        "title": title,
                        "description": "Daily pass window for Southern-Fried Gaming Expo.",
                        "start_date": start_date,
                        "start_time": start_time,
                        "end_date": None,
                        "end_time": end_time,
                        "is_all_day": False,
                        "category": "gaming",
                        "subcategory": None,
                        "tags": [
                        "sfge",
                        "retro-gaming",
                        "arcade",
                        "pinball",
                        "convention",
                        "gaming",
                    ],
                        "price_min": None,
                        "price_max": None,
                        "price_note": None,
                        "is_free": False,
                        "source_url": EVENTS_URL,
                        "ticket_url": EVENTS_URL,
                        "image_url": default_image_url,
                        "raw_text": f"{title} - {start_date}",
                        "extraction_confidence": 0.80,
                        "is_recurring": False,
                        "recurrence_rule": None,
                        "content_hash": content_hash,
                    }

                    existing = find_event_by_hash(content_hash)
                    if existing:
                        smart_update_existing_event(existing, event_record)
                        events_updated += 1
                        i += 1
                        continue

                    try:
                        insert_event(event_record)
                        events_new += 1
                        logger.info(f"Added: {title} on {start_date}")
                    except Exception as e:
                        logger.error(f"Failed to insert: {title}: {e}")

                i += 1

            browser.close()

        logger.info(
            f"Southern-Fried Gaming Expo crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Southern-Fried Gaming Expo: {e}")
        raise

    return events_found, events_new, events_updated
