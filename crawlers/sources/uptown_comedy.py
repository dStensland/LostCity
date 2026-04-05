"""
Crawler for Uptown Comedy Corner (uptowncomedy.net).
Atlanta's original comedy club, now in Forest Park.

Site uses SpaceCraft CMS — JS-rendered event list on /tickets page.
Each event block: month abbreviation, day number, title (repeated), BUY link.
All tickets go through Eventbrite.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime

from playwright.sync_api import sync_playwright

from db import get_or_create_place, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://www.uptowncomedy.net"
EVENTS_URL = f"{BASE_URL}/tickets"

PLACE_DATA = {
    "name": "Uptown Comedy Corner",
    "slug": "uptown-comedy-corner",
    "address": "4730 Frontage Rd",
    "neighborhood": "Forest Park",
    "city": "Forest Park",
    "state": "GA",
    "zip": "30297",
    "lat": 33.6209,
    "lng": -84.3602,
    "place_type": "comedy_club",
    "spot_type": "comedy_club",
    "website": BASE_URL,
}

MONTH_MAP = {
    "jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6,
    "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12,
}


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Uptown Comedy Corner events."""
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

            venue_id = get_or_create_place(PLACE_DATA)

            logger.info(f"Fetching Uptown Comedy Corner: {EVENTS_URL}")
            page.goto(EVENTS_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(5000)

            # Scroll to load all events
            for _ in range(3):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1000)

            # Collect Eventbrite URLs mapped by title
            links = page.query_selector_all("a")
            eventbrite_urls = {}
            for link in links:
                href = link.get_attribute("href") or ""
                if "eventbrite.com" in href:
                    text = link.inner_text().strip()
                    if text and text != "BUY" and len(text) > 10:
                        eventbrite_urls[text.lower()] = href

            # Parse event list from body text
            # Pattern: month_abbr, day_number, title, title_duplicate, BUY
            body_text = page.inner_text("body")
            lines = [l.strip() for l in body_text.split("\n") if l.strip()]

            now = datetime.now()
            current_year = now.year
            i = 0

            while i < len(lines) - 2:
                line = lines[i].lower()

                # Look for month abbreviation
                if line in MONTH_MAP:
                    month_num = MONTH_MAP[line]

                    # Next line should be day number
                    if i + 1 < len(lines) and re.match(r"^\d{1,2}$", lines[i + 1]):
                        day = int(lines[i + 1])

                        # Next line is the event title
                        title = None
                        if i + 2 < len(lines):
                            candidate = lines[i + 2].strip()
                            if candidate and candidate != "BUY" and len(candidate) > 5:
                                title = candidate

                        if not title:
                            i += 1
                            continue

                        # Build date
                        year = current_year
                        try:
                            event_date = datetime(year, month_num, day)
                            # If date is >60 days in the past, assume next year
                            if (now - event_date).days > 60:
                                event_date = datetime(year + 1, month_num, day)
                        except ValueError:
                            i += 1
                            continue

                        # Skip past events
                        if event_date.date() < now.date():
                            i += 5  # Skip full block
                            continue

                        start_date = event_date.strftime("%Y-%m-%d")
                        events_found += 1

                        # Find Eventbrite URL for this event
                        ticket_url = None
                        title_lower = title.lower()
                        for eb_title, eb_url in eventbrite_urls.items():
                            if title_lower[:30] in eb_title or eb_title[:30] in title_lower:
                                ticket_url = eb_url
                                break

                        # Clean up title — remove "Uptown Comedy Corner Presents:" prefix
                        clean_title = re.sub(
                            r"^Uptown Comedy (?:Corner )?Presents:\s*",
                            "",
                            title,
                            flags=re.IGNORECASE,
                        )
                        if len(clean_title) < 5:
                            clean_title = title

                        content_hash = generate_content_hash(clean_title, "Uptown Comedy Corner", start_date)

                        # Determine subcategory from title
                        title_check = title.lower()
                        is_open_mic = "open mic" in title_check or "tequila tap in" in title_check
                        tags = ["uptown-comedy", "comedy", "stand-up", "forest-park"]
                        if is_open_mic:
                            tags.append("open-mic")

                        event_record = {
                            "source_id": source_id,
                            "place_id": venue_id,
                            "title": clean_title,
                            "description": f"{clean_title} at Uptown Comedy Corner",
                            "start_date": start_date,
                            "start_time": "21:00",  # Default 9pm for comedy
                            "end_date": None,
                            "end_time": None,
                            "is_all_day": False,
                            "category": "comedy",
                            "tags": tags,
                            "price_min": None,
                            "price_max": None,
                            "price_note": None,
                            "is_free": False,
                            "source_url": EVENTS_URL,
                            "ticket_url": ticket_url,
                            "image_url": None,
                            "raw_text": f"{title} - {start_date}",
                            "extraction_confidence": 0.88,
                            "is_recurring": False,
                            "recurrence_rule": None,
                            "content_hash": content_hash,
                        }

                        existing = find_event_by_hash(content_hash)
                        if existing:
                            smart_update_existing_event(existing, event_record)
                            events_updated += 1
                            i += 5
                            continue

                        try:
                            insert_event(event_record, genres=["comedy", "stand-up"])
                            events_new += 1
                            logger.info(f"Added: {clean_title} on {start_date}")
                        except Exception as e:
                            logger.error(f"Failed to insert: {clean_title}: {e}")

                        i += 5  # Skip past this block
                        continue

                i += 1

            browser.close()

        logger.info(
            f"Uptown Comedy Corner crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Uptown Comedy Corner: {e}")
        raise

    return events_found, events_new, events_updated
