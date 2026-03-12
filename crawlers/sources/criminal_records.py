"""
Crawler for Criminal Records (criminalatl.com).

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
from utils import extract_images_from_page, extract_event_links, find_event_url

logger = logging.getLogger(__name__)

BASE_URL = "https://www.criminalatl.com"
EVENTS_URL = f"{BASE_URL}/events"

VENUE_DATA = {
    "name": "Criminal Records",
    "slug": "criminal-records",
    "address": "1154 Euclid Ave NE",
    "neighborhood": "Little Five Points",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30307",
    "lat": 33.7651,
    "lng": -84.3492,
    "venue_type": "record_store",
    "spot_type": "retail",
    "website": BASE_URL,
    "description": (
        "Criminal Records is Little Five Points' iconic independent record store, "
        "hosting in-store performances, album signings, and community events. "
        "A cornerstone of Atlanta's independent music scene since 1991."
    ),
    "hours": {
        "monday": {"open": "11:00", "close": "20:00"},
        "tuesday": {"open": "11:00", "close": "20:00"},
        "wednesday": {"open": "11:00", "close": "20:00"},
        "thursday": {"open": "11:00", "close": "20:00"},
        "friday": {"open": "11:00", "close": "20:00"},
        "saturday": {"open": "11:00", "close": "20:00"},
        "sunday": {"open": "12:00", "close": "18:00"},
    },
    "vibes": ["record-store", "indie", "instore", "l5p", "community", "music", "vinyl"],
}


def determine_event_type(title: str) -> tuple[str, str]:
    """Infer category and subcategory from event title."""
    t = title.lower()
    if any(w in t for w in ["signing", "book signing", "record signing", "autograph"]):
        return "community", "signing"
    if any(w in t for w in ["in-store", "instore", "in store", "performance", "live", "acoustic"]):
        return "music", "live"
    if any(w in t for w in ["release", "album release", "record release", "listening party"]):
        return "music", "live"
    if any(w in t for w in ["comedy", "stand-up", "standup"]):
        return "comedy", None
    if any(w in t for w in ["art", "gallery", "opening", "exhibit"]):
        return "art", "gallery"
    if any(w in t for w in ["trivia", "quiz"]):
        return "community", "trivia"
    return "music", "live"


def extract_description_from_context(lines: list[str], title_idx: int, title: str) -> str:
    """Try to pull a meaningful description from surrounding lines near the title."""
    candidates = []
    for offset in range(1, 6):
        idx = title_idx + offset
        if idx >= len(lines):
            break
        line = lines[idx]
        # Stop at the next date line or navigation noise
        if re.match(
            r"(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|January|February|March|April|May|June|July|August|September|October|November|December)",
            line,
            re.IGNORECASE,
        ):
            break
        if re.match(r"(tickets?|register|buy|more info|\$\d)", line, re.IGNORECASE):
            break
        if len(line) > 20 and line != title:
            candidates.append(line)
        if len(candidates) >= 2:
            break
    if candidates:
        desc = " ".join(candidates)
        if len(desc) > 400:
            desc = desc[:397] + "..."
        return desc
    return ""


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
    """Crawl Criminal Records events using Playwright."""
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

            logger.info(f"Fetching Criminal Records: {EVENTS_URL}")
            page.goto(EVENTS_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(3000)

            # Extract images from page
            image_map = extract_images_from_page(page)

            # Extract event links for specific URLs
            event_links = extract_event_links(page, BASE_URL)

            # Scroll to load all content
            for _ in range(5):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1000)

            # Get page text and parse line by line
            body_text = page.inner_text("body")
            lines = [l.strip() for l in body_text.split("\n") if l.strip()]

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
                    month = date_match.group(1)
                    day = date_match.group(2)
                    year = date_match.group(3) if date_match.group(3) else str(datetime.now().year)

                    # Look for title in surrounding lines
                    title = None
                    start_time = None

                    for offset in [-2, -1, 1, 2, 3]:
                        idx = i + offset
                        if 0 <= idx < len(lines):
                            check_line = lines[idx]
                            if re.match(r"(January|February|March)", check_line, re.IGNORECASE):
                                continue
                            if not start_time:
                                time_result = parse_time(check_line)
                                if time_result:
                                    start_time = time_result
                                    continue
                            if not title and len(check_line) > 5:
                                if not re.match(r"\d{1,2}[:/]", check_line):
                                    if not re.match(r"(free|tickets|register|\$|more info)", check_line.lower()):
                                        title = check_line
                                        break

                    if not title:
                        i += 1
                        continue

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

                    content_hash = generate_content_hash(title, "Criminal Records", start_date)

                    event_url = find_event_url(title, event_links, EVENTS_URL)

                    # Extract real description from surrounding lines
                    description = extract_description_from_context(lines, i, title)

                    # Detect free events from surrounding text
                    context_text = " ".join(lines[max(0, i - 3):min(len(lines), i + 6)]).lower()
                    is_free = any(
                        w in context_text
                        for w in ["free", "no cover", "no charge", "free admission", "free event"]
                    )

                    # Infer category from title
                    category, subcategory = determine_event_type(title)

                    event_record = {
                        "source_id": source_id,
                        "venue_id": venue_id,
                        "title": title,
                        "description": description or None,
                        "start_date": start_date,
                        "start_time": start_time,
                        "end_date": None,
                        "end_time": None,
                        "is_all_day": False,
                        "category": category,
                        "subcategory": subcategory,
                        "tags": [
                            "criminal-records",
                            "vinyl",
                            "record-store",
                            "l5p",
                            "instore",
                        ],
                        "price_min": None,
                        "price_max": None,
                        "price_note": None,
                        "is_free": is_free,
                        "source_url": event_url,
                        "ticket_url": event_url,
                        "image_url": image_map.get(title),
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
            f"Criminal Records crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Criminal Records: {e}")
        raise

    return events_found, events_new, events_updated
