"""
Crawler for The Masquerade (masqueradeatlanta.com/events).
Atlanta's legendary multi-room music venue with Heaven, Hell, Purgatory, and Altar.

Site uses JavaScript rendering - must use Playwright.
Format: THU, 22, JAN, 2026, "presents", TITLE, opener, "Room at The Masquerade", "Doors X:XX pm"
"""

from __future__ import annotations

import re
import logging
from datetime import datetime
from typing import Optional

from playwright.sync_api import sync_playwright

from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash
from utils import extract_images_from_page, extract_event_links, find_event_url, enrich_event_record

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


def parse_time(time_text: str) -> Optional[str]:
    """Parse time from 'Doors 7:00 pm' format."""
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


MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"]
DAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl The Masquerade events using Playwright."""
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

            logger.info(f"Fetching The Masquerade: {EVENTS_URL}")
            page.goto(EVENTS_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(5000)

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

            # Parse events - format is:
            # THU (day of week)
            # 22 (day number)
            # JAN (month)
            # 2026 (year)
            # "The Masquerade presents"
            # ARTIST NAME (title)
            # opener
            # "Room at The Masquerade"
            # "Doors X:XX pm / All Ages"
            # BUY TICKETS / SOLD OUT / CANCELED

            i = 0
            while i < len(lines):
                line = lines[i].upper()

                # Look for day-of-week pattern starting an event block
                if line in DAYS and i + 3 < len(lines):
                    # Check if next lines follow the pattern: day number, month, year
                    day_num = lines[i + 1]
                    month = lines[i + 2].upper()
                    year = lines[i + 3]

                    if (day_num.isdigit() and
                        month in MONTHS and
                        year.isdigit() and len(year) == 4):

                        # Valid date block found
                        day = int(day_num)
                        month_idx = MONTHS.index(month) + 1
                        year_int = int(year)

                        # Look ahead for title, room, time
                        title = None
                        opener = None
                        room = None
                        start_time = None
                        is_cancelled = False
                        is_sold_out = False

                        # Scan next ~10 lines for event details
                        for j in range(i + 4, min(i + 15, len(lines))):
                            check_line = lines[j]
                            check_upper = check_line.upper()

                            # Skip "The Masquerade presents" header
                            if "masquerade presents" in check_line.lower():
                                continue

                            # Check for room
                            if not room:
                                for r in ["Heaven", "Hell", "Purgatory", "Altar"]:
                                    if f"{r} at The Masquerade" in check_line:
                                        room = r
                                        break

                            # Check for time (Doors X:XX pm)
                            if not start_time and "doors" in check_line.lower():
                                start_time = parse_time(check_line)

                            # Check status
                            if check_upper == "CANCELED" or check_upper == "CANCELLED":
                                is_cancelled = True
                            if "SOLD OUT" in check_upper:
                                is_sold_out = True

                            # Check for end of event block (next event starts)
                            if check_upper in DAYS:
                                break

                            # Skip navigation/status items
                            skip = ["BUY TICKETS", "MORE INFO", "SOLD OUT", "CANCELED", "CANCELLED",
                                   "FILTER BY", "SEARCH BY", "SUBMIT", "UPCOMING SHOWS"]
                            if check_upper in skip or any(s in check_upper for s in skip):
                                continue

                            # Get title (first substantial line after date that's not skipped)
                            if not title and len(check_line) > 2:
                                if not any(s.lower() in check_line.lower() for s in
                                          ["masquerade", "doors", "all ages", "heaven at", "hell at", "purgatory at", "altar at"]):
                                    title = check_line
                                    continue

                            # Get opener (line after title, before room)
                            if title and not opener and not room and len(check_line) > 2:
                                if not any(s.lower() in check_line.lower() for s in
                                          ["masquerade", "doors", "all ages"]):
                                    opener = check_line

                        # Skip cancelled events
                        if is_cancelled:
                            i += 1
                            continue

                        if not title:
                            i += 1
                            continue

                        # Build date
                        try:
                            dt = datetime(year_int, month_idx, day)
                            start_date = dt.strftime("%Y-%m-%d")
                        except ValueError:
                            i += 1
                            continue

                        events_found += 1

                        # Generate content hash
                        content_hash = generate_content_hash(title, "The Masquerade", start_date)

                        # Check for existing

                        # Build tags
                        tags = ["music", "concert", "the-masquerade", "downtown"]
                        if room:
                            tags.append(f"masquerade-{room.lower()}")

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
                            "category": "music",
                            "subcategory": "concert",
                            "tags": tags,
                            "price_min": None,
                            "price_max": None,
                            "price_note": "Sold Out" if is_sold_out else None,
                            "is_free": False,
                            "source_url": event_url,
                            "ticket_url": event_url,
                            "image_url": image_map.get(title),
                            "raw_text": f"{title} - {start_date}",
                            "extraction_confidence": 0.90,
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
                            enrich_event_record(event_record, "The Masquerade")
                            insert_event(event_record)
                            events_new += 1
                            logger.info(f"Added: {title} on {start_date}")
                        except Exception as e:
                            logger.error(f"Failed to insert: {title}: {e}")

                i += 1

            browser.close()

        logger.info(
            f"The Masquerade crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl The Masquerade: {e}")
        raise

    return events_found, events_new, events_updated
