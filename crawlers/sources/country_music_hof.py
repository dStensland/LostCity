"""
Crawler for Country Music Hall of Fame (countrymusichalloffame.org/calendar).
Nashville's iconic country music museum featuring exhibitions and live performances.

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

BASE_URL = "https://www.countrymusichalloffame.org"
CALENDAR_URL = f"{BASE_URL}/calendar"

VENUE_DATA = {
    "name": "Country Music Hall of Fame and Museum",
    "slug": "country-music-hof",
    "address": "222 Rep. John Lewis Way S",
    "neighborhood": "SoBro",
    "city": "Nashville",
    "state": "TN",
    "zip": "37203",
    "venue_type": "museum",
    "website": BASE_URL,
}


def parse_date(date_text: str) -> Optional[str]:
    """
    Parse date from formats like 'February 15', 'Feb 14'.
    Returns YYYY-MM-DD.
    """
    date_text = date_text.strip()
    current_year = datetime.now().year

    # Try "February 15" format
    try:
        dt = datetime.strptime(date_text, "%B %d")
        dt = dt.replace(year=current_year)
        if dt < datetime.now():
            dt = dt.replace(year=current_year + 1)
        return dt.strftime("%Y-%m-%d")
    except ValueError:
        pass

    # Try "Feb 14" format
    try:
        dt = datetime.strptime(date_text, "%b %d")
        dt = dt.replace(year=current_year)
        if dt < datetime.now():
            dt = dt.replace(year=current_year + 1)
        return dt.strftime("%Y-%m-%d")
    except ValueError:
        pass

    return None


def parse_time(time_text: str) -> Optional[str]:
    """Parse time like '2:00 PM' or '11:30 AM' to HH:MM."""
    if not time_text:
        return None

    time_text = time_text.strip()

    # Look for time pattern
    match = re.search(r"(\d{1,2})(?::(\d{2}))?\s*(AM|PM)", time_text, re.IGNORECASE)
    if match:
        hour = int(match.group(1))
        minute = int(match.group(2)) if match.group(2) else 0
        period = match.group(3).upper()

        if period == "PM" and hour != 12:
            hour += 12
        elif period == "AM" and hour == 12:
            hour = 0

        return f"{hour:02d}:{minute:02d}"

    return None


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Country Music Hall of Fame events using Playwright."""
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

            logger.info(f"Fetching Country Music Hall of Fame: {CALENDAR_URL}")
            page.goto(CALENDAR_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(3000)

            # Extract images from page
            image_map = extract_images_from_page(page)

            # Scroll to load all content
            for _ in range(5):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1000)

            # Get page text
            body_text = page.inner_text("body")
            lines = [l.strip() for l in body_text.split("\n") if l.strip()]

            # Skip navigation items
            skip_items = [
                "skip to content", "visit", "exhibitions", "calendar", "shop",
                "membership", "support", "about", "buy tickets", "plan your visit",
                "all events", "filter", "view", "country music hall of fame",
                "museum", "upcoming events", "learn more",
            ]

            browser.close()

            i = 0
            seen_events = set()

            while i < len(lines):
                line = lines[i]
                line_lower = line.lower()

                # Skip nav/UI items
                if line_lower in skip_items or len(line) < 3:
                    i += 1
                    continue

                # Look for date pattern
                date_match = re.match(
                    r"^(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}",
                    line,
                    re.IGNORECASE
                )

                if date_match:
                    start_date = parse_date(line)

                    if not start_date:
                        i += 1
                        continue

                    # Look ahead for time and title
                    start_time = None
                    title = None

                    # Check next few lines
                    for offset in range(1, 5):
                        if i + offset >= len(lines):
                            break

                        next_line = lines[i + offset]

                        # Check if line contains time
                        if re.search(r"\d{1,2}(?::\d{2})?\s*(?:AM|PM)", next_line, re.IGNORECASE):
                            start_time = parse_time(next_line)
                            continue

                        # Skip if it's a navigation item
                        if next_line.lower() in skip_items:
                            continue

                        # This should be the title
                        if not title and len(next_line) > 3:
                            title = next_line
                            break

                    if not title:
                        i += 1
                        continue

                    # Check for duplicates
                    event_key = f"{title}|{start_date}|{start_time}"
                    if event_key in seen_events:
                        i += 1
                        continue
                    seen_events.add(event_key)

                    events_found += 1

                    # Generate content hash
                    content_hash = generate_content_hash(
                        title, "Country Music Hall of Fame", start_date
                    )

                    # Check for existing

                    # Determine category based on content
                    event_category = "music"
                    subcategory = "country"
                    tags = ["country-music", "museum", "hall-of-fame", "sobro"]

                    title_lower = title.lower()
                    if any(w in title_lower for w in ["tour", "guided tour"]):
                        event_category = "museums"
                        subcategory = "tour"
                        tags.append("tour")
                    elif any(w in title_lower for w in ["workshop", "class"]):
                        event_category = "community"
                        subcategory = "education"
                        tags.extend(["workshop", "education"])
                    elif any(w in title_lower for w in ["family", "kids", "children"]):
                        event_category = "family"
                        subcategory = "kids"
                        tags.extend(["family", "kids"])
                    elif any(w in title_lower for w in ["concert", "performance", "live"]):
                        subcategory = "live"
                        tags.append("live-music")

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
                        "category": event_category,
                        "subcategory": subcategory,
                        "tags": tags,
                        "price_min": None,
                        "price_max": None,
                        "price_note": "Museum admission may be required",
                        "is_free": False,
                        "source_url": CALENDAR_URL,
                        "ticket_url": CALENDAR_URL,
                        "image_url": image_map.get(title),
                        "raw_text": f"{line} {title}",
                        "extraction_confidence": 0.85,
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

        logger.info(
            f"Country Music Hall of Fame crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Country Music Hall of Fame: {e}")
        raise

    return events_found, events_new, events_updated
