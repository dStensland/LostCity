"""
Crawler for Helium Comedy Club (atlanta.heliumcomedy.com).

Extracts event data from DOM structure after expanding event cards.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime
from typing import Optional
from zoneinfo import ZoneInfo

from playwright.sync_api import sync_playwright

from db import get_or_create_venue, insert_event, find_event_by_hash, remove_stale_source_events
from dedupe import generate_content_hash
from utils import extract_event_links, find_event_url

logger = logging.getLogger(__name__)

BASE_URL = "https://atlanta.heliumcomedy.com"
EVENTS_URL = f"{BASE_URL}/events"

VENUE_DATA = {
    "name": "Helium Comedy Club Atlanta",
    "slug": "helium-comedy-club-atlanta",
    "address": "539 Peachtree St NE",
    "neighborhood": "Midtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30308",
    "lat": 33.7706,
    "lng": -84.3853,
    "venue_type": "comedy_club",
    "spot_type": "comedy_club",
    "website": BASE_URL,
}


def parse_showtime(text: str) -> Optional[tuple[str, str]]:
    """
    Parse showtime like 'Sat Feb 7 2026, 4:00 PM' to (date, time).
    Returns (YYYY-MM-DD, HH:MM) or None.
    """
    # Match: Day Month DD YYYY, HH:MM AM/PM
    pattern = r"(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+([A-Za-z]+)\s+(\d{1,2})\s+(\d{4}),\s+(\d{1,2}):(\d{2})\s*(AM|PM)"
    match = re.search(pattern, text, re.IGNORECASE)

    if not match:
        return None

    month_str, day, year, hour, minute, period = match.groups()

    # Convert month name to number
    try:
        month_num = datetime.strptime(month_str[:3], "%b").month
        date_str = f"{year}-{month_num:02d}-{int(day):02d}"

        # Convert to 24-hour format
        hour_int = int(hour)
        if period.upper() == "PM" and hour_int != 12:
            hour_int += 12
        elif period.upper() == "AM" and hour_int == 12:
            hour_int = 0

        time_str = f"{hour_int:02d}:{minute}"

        return (date_str, time_str)
    except ValueError:
        return None


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Helium Comedy Club Atlanta events by expanding event cards."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0
    current_hashes = set()

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
                viewport={"width": 1920, "height": 1080},
            )
            page = context.new_page()

            venue_id = get_or_create_venue(VENUE_DATA)

            logger.info(f"Fetching Helium Comedy Club Atlanta: {EVENTS_URL}")
            page.goto(EVENTS_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(3000)

            # Scroll to load all content
            for _ in range(5):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1000)

            # Extract event links for specific URLs
            event_links = extract_event_links(page, BASE_URL)

            # Get all event list items
            event_elements = page.query_selector_all(".event-list-item")
            logger.info(f"Found {len(event_elements)} event elements")

            for idx, event_el in enumerate(event_elements):
                try:
                    # Try to expand the event to reveal showtimes
                    more_btn = event_el.query_selector('a[href="#"]')
                    if more_btn:
                        try:
                            more_btn.click()
                            page.wait_for_timeout(500)
                        except Exception:
                            pass  # Already expanded or not expandable

                    # Extract event text
                    event_text = event_el.inner_text()
                    lines = [l.strip() for l in event_text.split("\n") if l.strip()]

                    if len(lines) < 2:
                        continue

                    # First line is usually the date range, second is title
                    title = None
                    description = ""
                    image_url = None
                    showtime_data = None

                    # Look for title (usually line with "SPECIAL EVENT:" or all caps)
                    for i, line in enumerate(lines[:5]):
                        if "SPECIAL EVENT:" in line or "IN THE OTHER ROOM:" in line:
                            title = line.replace("SPECIAL EVENT:", "").replace("IN THE OTHER ROOM:", "").strip()
                            break
                        elif line.isupper() and len(line) > 5 and "BUY TICKETS" not in line and "MORE" not in line:
                            # Skip date lines
                            if not re.match(r"(January|February|March|April|May|June|July|August|September|October|November|December)", line):
                                title = line
                                break

                    if not title:
                        continue

                    # Look for showtime (format: "Sat Feb 7 2026, 4:00 PM")
                    for line in lines:
                        result = parse_showtime(line)
                        if result:
                            showtime_data = result
                            break

                    if not showtime_data:
                        # Skip events without specific showtimes
                        logger.debug(f"No showtime found for: {title}")
                        continue

                    start_date, start_time = showtime_data

                    # Skip past events
                    eastern = ZoneInfo("America/New_York")
                    event_dt = datetime.strptime(f"{start_date} {start_time}", "%Y-%m-%d %H:%M")
                    event_dt = event_dt.replace(tzinfo=eastern)
                    if event_dt < datetime.now(eastern):
                        continue

                    # Extract description (usually after title, before "THERE IS A TWO-ITEM" or "more")
                    desc_lines = []
                    capturing = False
                    for line in lines:
                        if line == title:
                            capturing = True
                            continue
                        if capturing:
                            if "THERE IS A TWO-ITEM" in line or "BUY TICKETS" in line or line == "more":
                                break
                            if len(line) > 20:  # Skip short UI elements
                                desc_lines.append(line)

                    if desc_lines:
                        description = " ".join(desc_lines[:3])  # First 3 sentences

                    # Extract image
                    img_el = event_el.query_selector("img")
                    if img_el:
                        image_url = img_el.get_attribute("src")

                    events_found += 1

                    content_hash = generate_content_hash(title, "Helium Comedy Club Atlanta", start_date)
                    current_hashes.add(content_hash)

                    if find_event_by_hash(content_hash):
                        events_updated += 1
                        continue

                    # Get specific event URL


                    event_url = find_event_url(title, event_links, EVENTS_URL)



                    event_record = {
                        "source_id": source_id,
                        "venue_id": venue_id,
                        "title": title,
                        "description": description if description else "Comedy show at Helium Comedy Club Atlanta",
                        "start_date": start_date,
                        "start_time": start_time,
                        "end_date": None,
                        "end_time": None,
                        "is_all_day": False,
                        "category": "comedy",
                        "subcategory": "standup",
                        "tags": ["helium", "comedy", "stand-up"],
                        "price_min": None,
                        "price_max": None,
                        "price_note": None,
                        "is_free": False,
                        "source_url": event_url,
                        "ticket_url": event_url,
                        "image_url": image_url if image_url else None,
                        "raw_text": event_text[:500],
                        "extraction_confidence": 0.90,
                        "is_recurring": False,
                        "recurrence_rule": None,
                        "content_hash": content_hash,
                    }

                    try:
                        insert_event(event_record)
                        events_new += 1
                        logger.info(f"Added: {title} on {start_date} at {start_time}")
                    except Exception as e:
                        logger.error(f"Failed to insert: {title}: {e}")

                except Exception as e:
                    logger.warning(f"Failed to process event {idx}: {e}")
                    continue

            browser.close()

            # Remove stale events
            remove_stale_source_events(source_id, current_hashes)

        logger.info(
            f"Helium Comedy Club Atlanta crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Helium Comedy Club Atlanta: {e}")
        raise

    return events_found, events_new, events_updated
