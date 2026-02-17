"""
Crawler for Belcourt Theatre (belcourt.org/events).
Independent art house cinema in Hillsboro Village showing films and special events.

Site uses JavaScript rendering - must use Playwright.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime, timedelta
from typing import Optional

from playwright.sync_api import sync_playwright

from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash
from utils import extract_images_from_page, extract_event_links, find_event_url

logger = logging.getLogger(__name__)

BASE_URL = "https://www.belcourt.org"
EVENTS_URL = f"{BASE_URL}/events/"

VENUE_DATA = {
    "name": "Belcourt Theatre",
    "slug": "belcourt-theatre",
    "address": "2102 Belcourt Ave",
    "neighborhood": "Hillsboro Village",
    "city": "Nashville",
    "state": "TN",
    "zip": "37212",
    "venue_type": "theater",
    "website": BASE_URL,
}


def parse_date(date_text: str) -> Optional[str]:
    """
    Parse date from formats like 'Feb 14', 'Friday, March 8'.
    Returns YYYY-MM-DD.
    """
    date_text = date_text.strip()
    current_year = datetime.now().year

    # Try "Friday, March 8" format
    match = re.search(
        r"(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})",
        date_text,
        re.IGNORECASE
    )
    if match:
        month, day = match.group(2), match.group(3)
        try:
            dt = datetime.strptime(f"{month} {day} {current_year}", "%B %d %Y")
            if dt < datetime.now():
                dt = dt.replace(year=current_year + 1)
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            pass

    # Try "March 8" format
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
    """Parse time like '7:30 PM' or '8:00pm' to HH:MM."""
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
    """Crawl Belcourt Theatre events using Playwright."""
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

            logger.info(f"Fetching Belcourt Theatre: {EVENTS_URL}")
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

            # Get page text
            body_text = page.inner_text("body")
            lines = [l.strip() for l in body_text.split("\n") if l.strip()]

            # Skip navigation items
            skip_items = [
                "skip to content", "tickets", "calendar", "membership", "support",
                "about", "buy tickets", "learn more", "events", "films",
                "view all", "filter", "upcoming events", "belcourt theatre",
                "hillsboro village", "special events", "films",
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
                date_match = re.search(
                    r"(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}",
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
                        title, "Belcourt Theatre", start_date
                    )

                    # Check for existing

                    # Determine category based on content
                    event_category = "film"
                    subcategory = "screening"
                    tags = ["belcourt", "independent-film", "art-house", "hillsboro-village"]

                    title_lower = title.lower()
                    if any(w in title_lower for w in ["special event", "live", "concert", "music"]):
                        event_category = "community"
                        subcategory = "special-event"
                        tags.append("special-event")
                    elif any(w in title_lower for w in ["classic", "classics"]):
                        tags.append("classic-film")
                    elif any(w in title_lower for w in ["documentary"]):
                        tags.append("documentary")
                    elif any(w in title_lower for w in ["foreign", "international"]):
                        tags.append("foreign-film")

                    # Get specific event URL


                    event_url = find_event_url(title, event_links, EVENTS_URL)



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
                        "price_note": None,
                        "is_free": False,
                        "source_url": event_url,
                        "ticket_url": event_url,
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
            f"Belcourt Theatre crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Belcourt Theatre: {e}")
        raise

    return events_found, events_new, events_updated
