"""
Crawler for All Fired Up Art pottery/painting studio (allfiredupart.com).

Site uses BookThatApp calendar iframe - must use Playwright to extract text content.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime
from typing import Optional

from playwright.sync_api import sync_playwright

from db import get_or_create_venue, insert_event, find_event_by_hash
from dedupe import generate_content_hash
from utils import extract_images_from_page, extract_event_links, find_event_url

logger = logging.getLogger(__name__)

BASE_URL = "https://allfiredupart.com"
EVENTS_URL = f"{BASE_URL}/pages/things-to-do"
RESERVATIONS_URL = f"{BASE_URL}/pages/reservations"

VENUE_DATA = {
    "name": "All Fired Up Art",
    "slug": "all-fired-up-art",
    "address": "1090 Euclid Ave NE",
    "neighborhood": "Little Five Points",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30307",
    "lat": 33.7647,
    "lng": -84.3494,
    "venue_type": "studio",
    "spot_type": "studio",
    "website": BASE_URL,
}


def parse_time(time_text: str) -> Optional[str]:
    """Parse time from various formats like '7:00 PM', '7pm', '19:00'."""
    match = re.search(r"(\d{1,2}):(\d{2})\s*(am|pm)", time_text, re.IGNORECASE)
    if match:
        hour, minute, period = match.groups()
        hour = int(hour)
        if period.lower() == "pm" and hour != 12:
            hour += 12
        elif period.lower() == "am" and hour == 12:
            hour = 0
        return f"{hour:02d}:{minute}"

    # Try simplified format like "7pm"
    match = re.search(r"(\d{1,2})\s*(am|pm)", time_text, re.IGNORECASE)
    if match:
        hour, period = match.groups()
        hour = int(hour)
        if period.lower() == "pm" and hour != 12:
            hour += 12
        elif period.lower() == "am" and hour == 12:
            hour = 0
        return f"{hour:02d}:00"

    return None


def parse_date_from_line(line: str) -> Optional[tuple[str, str, str]]:
    """
    Parse date from a line of text.
    Returns (month, day, year) tuple or None.
    """
    # Try full date patterns
    date_match = re.search(
        r"(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)?,?\s*"
        r"(January|February|March|April|May|June|July|August|September|October|November|December|"
        r"Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)"
        r"\s+(\d{1,2})(?:st|nd|rd|th)?"
        r"(?:,?\s+(\d{4}))?",
        line,
        re.IGNORECASE
    )

    if date_match:
        month = date_match.group(1)
        day = date_match.group(2)
        year = date_match.group(3) if date_match.group(3) else str(datetime.now().year)
        return month, day, year

    return None


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl All Fired Up Art events using Playwright."""
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

            # Try both URLs to get comprehensive event listings
            urls_to_try = [EVENTS_URL, RESERVATIONS_URL]
            all_events = {}  # Use dict to dedupe by title+date

            for url in urls_to_try:
                try:
                    logger.info(f"Fetching All Fired Up Art: {url}")
                    page.goto(url, wait_until="domcontentloaded", timeout=30000)
                    page.wait_for_timeout(3000)

                    # Extract images from page
                    image_map = extract_images_from_page(page)

                    # Extract event links for specific URLs
                    event_links = extract_event_links(page, BASE_URL)

                    # Scroll to load all content (including iframe content if visible)
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

                        # Skip very short lines
                        if len(line) < 3:
                            i += 1
                            continue

                        # Look for date patterns
                        date_result = parse_date_from_line(line)

                        if date_result:
                            month, day, year = date_result

                            # Look for title and time in surrounding lines
                            title = None
                            start_time = None
                            description_parts = []

                            # Check surrounding lines
                            for offset in range(-3, 6):
                                idx = i + offset
                                if 0 <= idx < len(lines):
                                    check_line = lines[idx]

                                    # Skip lines that are dates themselves
                                    if parse_date_from_line(check_line):
                                        continue

                                    # Try to extract time
                                    if not start_time:
                                        time_result = parse_time(check_line)
                                        if time_result:
                                            start_time = time_result

                                    # Look for title - longer text that's not time, price, or navigation
                                    if not title and len(check_line) > 8:
                                        # Skip lines with prices, times, common UI text
                                        skip_patterns = [
                                            r"^\d{1,2}[:/]",  # Times
                                            r"^\$\d+",  # Prices
                                            r"^(book now|register|tickets|more info|learn more|sign up|contact)",
                                            r"^(home|about|events|classes|shop|cart)",
                                        ]

                                        if not any(re.match(pat, check_line.lower()) for pat in skip_patterns):
                                            # This looks like a title
                                            if not title:
                                                title = check_line
                                            elif len(check_line) > 15:  # Could be description
                                                description_parts.append(check_line)

                            if not title:
                                i += 1
                                continue

                            # Clean up title
                            title = title.strip()

                            # Skip if title looks like navigation or boilerplate
                            if len(title) < 5 or title.lower() in ["class", "event", "workshop", "session"]:
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

                            # Create unique key for deduping across URLs
                            event_key = f"{title}|{start_date}"

                            # Skip if we already have this event
                            if event_key in all_events:
                                i += 1
                                continue

                            # Build description
                            description = " ".join(description_parts) if description_parts else "Pottery and painting class at All Fired Up Art in Little Five Points"

                            # Store event info
                            all_events[event_key] = {
                                "title": title,
                                "description": description,
                                "start_date": start_date,
                                "start_time": start_time,
                                "image_url": image_map.get(title),
                            }

                        i += 1

                except Exception as e:
                    logger.warning(f"Error fetching {url}: {e}")
                    continue

            # Now insert all unique events
            for event_key, event_data in all_events.items():
                events_found += 1

                content_hash = generate_content_hash(
                    event_data["title"],
                    "All Fired Up Art",
                    event_data["start_date"]
                )

                if find_event_by_hash(content_hash):
                    events_updated += 1
                    continue

                # Get specific event URL


                event_url = find_event_url(title, event_links, EVENTS_URL)



                event_record = {
                    "source_id": source_id,
                    "venue_id": venue_id,
                    "title": event_data["title"],
                    "description": event_data["description"],
                    "start_date": event_data["start_date"],
                    "start_time": event_data["start_time"],
                    "end_date": None,
                    "end_time": None,
                    "is_all_day": False,
                    "category": "art",
                    "subcategory": "arts.workshop",
                    "tags": [
                        "pottery",
                        "painting",
                        "ceramics",
                        "workshop",
                        "creative",
                        "hands-on",
                        "little-five-points",
                        "art-class",
                    ],
                    "price_min": None,
                    "price_max": None,
                    "price_note": None,
                    "is_free": False,
                    "source_url": event_url,
                    "ticket_url": RESERVATIONS_URL,
                    "image_url": event_data["image_url"],
                    "raw_text": f"{event_data['title']} - {event_data['start_date']}",
                    "extraction_confidence": 0.75,
                    "is_recurring": False,
                    "recurrence_rule": None,
                    "content_hash": content_hash,
                    "is_class": True,
                    "class_category": "pottery",
                }

                try:
                    insert_event(event_record)
                    events_new += 1
                    logger.info(f"Added: {event_data['title']} on {event_data['start_date']}")
                except Exception as e:
                    logger.error(f"Failed to insert: {event_data['title']}: {e}")

            browser.close()

        logger.info(
            f"All Fired Up Art crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl All Fired Up Art: {e}")
        raise

    return events_found, events_new, events_updated
