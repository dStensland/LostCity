"""
Crawler for Clermont Lounge (clermontlounge.net).
Iconic Atlanta dive bar and burlesque club in Poncey-Highland.

Site uses JavaScript rendering (Wix) - must use Playwright.
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

BASE_URL = "https://www.clermontlounge.net"
EVENTS_URL = f"{BASE_URL}/events"

VENUE_DATA = {
    "name": "Clermont Lounge",
    "slug": "clermont-lounge",
    "address": "789 Ponce de Leon Ave NE",
    "neighborhood": "Poncey-Highland",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30306",
    "lat": 33.7720,
    "lng": -84.3626,
    "venue_type": "bar",
    "spot_type": "bar",
    "website": BASE_URL,
    "description": (
        "The Clermont Lounge is Atlanta's most iconic dive bar and burlesque club, "
        "operating since 1965 in the basement of the historic Clermont Hotel. "
        "Home to legendary performances, themed nights, karaoke, and some of the city's most "
        "beloved characters. A true Atlanta institution."
    ),
    "hours": {
        "monday": {"open": "16:00", "close": "03:00"},
        "tuesday": {"open": "16:00", "close": "03:00"},
        "wednesday": {"open": "16:00", "close": "03:00"},
        "thursday": {"open": "16:00", "close": "03:00"},
        "friday": {"open": "16:00", "close": "03:00"},
        "saturday": {"open": "16:00", "close": "03:00"},
        "sunday": {"closed": True},
    },
    "vibes": ["dive-bar", "burlesque", "iconic", "late-night", "karaoke", "lgbtq-friendly", "poncey-highland"],
}


def determine_event_type(title: str) -> tuple[str, Optional[str]]:
    """Infer subcategory from event title for Clermont Lounge programming."""
    t = title.lower()
    if any(w in t for w in ["burlesque", "show", "performance", "revue"]):
        return "nightlife", "nightlife.burlesque"
    if any(w in t for w in ["karaoke"]):
        return "nightlife", "nightlife.karaoke"
    if any(w in t for w in ["drag", "drag show", "drag night"]):
        return "nightlife", "nightlife.drag"
    if any(w in t for w in ["dj", "dance", "party", "night"]):
        return "nightlife", None
    if any(w in t for w in ["trivia", "quiz"]):
        return "community", "trivia"
    if any(w in t for w in ["live", "band", "concert", "music"]):
        return "music", "live"
    return "nightlife", None


def extract_description_from_context(lines: list[str], title_idx: int, title: str) -> str:
    """Pull a meaningful description from lines surrounding the event title."""
    candidates = []
    for offset in range(1, 6):
        idx = title_idx + offset
        if idx >= len(lines):
            break
        line = lines[idx]
        if re.match(
            r"(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|January|February|March|April|May|June|July|August|September|October|November|December)",
            line,
            re.IGNORECASE,
        ):
            break
        if re.match(r"(tickets?|register|buy|more info|\$\d|reserve|rsvp)", line, re.IGNORECASE):
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
    """Parse time from '10:00 PM' format."""
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
    """Crawl Clermont Lounge events using Playwright."""
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

            logger.info(f"Fetching Clermont Lounge: {EVENTS_URL}")
            page.goto(EVENTS_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(5000)  # Wix sites need extra time

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

                if len(line) < 3:
                    i += 1
                    continue

                # Look for date patterns
                date_match = re.match(
                    r"(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)?,?\s*(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})(?:,?\s+(\d{4}))?",
                    line,
                    re.IGNORECASE,
                )

                if date_match:
                    month = date_match.group(1)
                    day = date_match.group(2)
                    year = (
                        date_match.group(3)
                        if date_match.group(3)
                        else str(datetime.now().year)
                    )

                    title = None
                    start_time = None

                    for offset in [-2, -1, 1, 2, 3]:
                        idx = i + offset
                        if 0 <= idx < len(lines):
                            check_line = lines[idx]
                            if re.match(
                                r"(January|February|March|April|May|June|July|August|September|October|November|December)",
                                check_line,
                                re.IGNORECASE,
                            ):
                                continue
                            if not start_time:
                                time_result = parse_time(check_line)
                                if time_result:
                                    start_time = time_result
                                    continue
                            if not title and len(check_line) > 5:
                                if not re.match(r"\d{1,2}[:/]", check_line):
                                    if not re.match(
                                        r"(free|tickets|register|\$|more info|rsvp|buy)",
                                        check_line.lower(),
                                    ):
                                        title = check_line
                                        break

                    if not title:
                        i += 1
                        continue

                    try:
                        month_str = month[:3] if len(month) > 3 else month
                        dt = datetime.strptime(f"{month_str} {day} {year}", "%b %d %Y")
                        if dt.date() < datetime.now().date():
                            dt = datetime.strptime(
                                f"{month_str} {day} {int(year) + 1}", "%b %d %Y"
                            )
                        start_date = dt.strftime("%Y-%m-%d")
                    except ValueError:
                        i += 1
                        continue

                    events_found += 1

                    content_hash = generate_content_hash(
                        title, "Clermont Lounge", start_date
                    )

                    event_url = find_event_url(title, event_links, EVENTS_URL)

                    # Extract real description from surrounding lines
                    description = extract_description_from_context(lines, i, title)

                    # Detect free events from surrounding context
                    context_text = " ".join(lines[max(0, i - 3):min(len(lines), i + 6)]).lower()
                    is_free = any(
                        w in context_text
                        for w in ["free", "no cover", "no charge", "free admission", "free event"]
                    )

                    # Detect price
                    price_min = None
                    price_max = None
                    price_match = re.search(r"\$(\d+(?:\.\d{2})?)", context_text)
                    if price_match and not is_free:
                        price_min = float(price_match.group(1))
                        price_max = price_min

                    # Infer subcategory
                    category, subcategory = determine_event_type(title)

                    event_record = {
                        "source_id": source_id,
                        "venue_id": venue_id,
                        "title": title,
                        "description": description or None,
                        "start_date": start_date,
                        "start_time": start_time or "22:00",
                        "end_date": None,
                        "end_time": None,
                        "is_all_day": False,
                        "category": category,
                        "subcategory": subcategory,
                        "tags": [
                            "clermont-lounge",
                            "dive-bar",
                            "burlesque",
                            "poncey-highland",
                        ],
                        "price_min": price_min,
                        "price_max": price_max,
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
            f"Clermont Lounge crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Clermont Lounge: {e}")
        raise

    return events_found, events_new, events_updated
