"""
Crawler for Buckhead Theatre (Live Nation venue in Atlanta).

NOTE: As of Jan 2026, the original buckheadtheatre.com site is defunct (parked domain).
Now crawling from Live Nation venue page which uses standard Live Nation format.
The venue shows "PAGE IS STILL IN SOUND CHECK" - may be temporarily closed or not booking.

Site uses JavaScript rendering - must use Playwright.
Format: DAY (3-letter), DD, MON (3-letter), TITLE (same as Tabernacle)
"""

from __future__ import annotations

import logging
from datetime import datetime

from playwright.sync_api import sync_playwright

from db import get_or_create_venue, insert_event, find_event_by_hash
from dedupe import generate_content_hash
from utils import extract_images_from_page

logger = logging.getLogger(__name__)

# Updated to use Live Nation venue page
BASE_URL = "https://www.livenation.com"
VENUE_URL = f"{BASE_URL}/venue/KovZpaIJZ7A/buckhead-theatre-events"

VENUE_DATA = {
    "name": "Buckhead Theatre",
    "slug": "buckhead-theatre",
    "address": "3110 Roswell Rd NE",
    "neighborhood": "Buckhead",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30305",
    "lat": 33.8395,
    "lng": -84.3798,
    "venue_type": "theater",
    "spot_type": "theater",
    "website": VENUE_URL,
}

# 3-letter day names for validation
DAY_NAMES = {"MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"}

# 3-letter month names to full month numbers
MONTH_MAP = {
    "JAN": 1,
    "FEB": 2,
    "MAR": 3,
    "APR": 4,
    "MAY": 5,
    "JUN": 6,
    "JUL": 7,
    "AUG": 8,
    "SEP": 9,
    "OCT": 10,
    "NOV": 11,
    "DEC": 12,
}


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Buckhead Theatre events using Playwright.

    Uses Live Nation venue page with standard format:
    DAY (3-letter), DD, MMM (3-letter), TITLE
    Same parsing logic as Tabernacle crawler.
    """
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

            logger.info(f"Fetching Buckhead Theatre: {VENUE_URL}")
            page.goto(VENUE_URL, wait_until="networkidle", timeout=30000)
            page.wait_for_timeout(3000)

            # Extract images from page
            image_map = extract_images_from_page(page)

            # Scroll to load all content
            for _ in range(5):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1000)

            # Get page text
            body_text = page.inner_text("body")
            lines = [line.strip() for line in body_text.split("\n") if line.strip()]

            # Check for "sound check" message indicating no events
            if any("SOUND CHECK" in line.upper() for line in lines[:20]):
                logger.info("Venue page shows 'SOUND CHECK' - no events currently listed")

            # Skip navigation items
            skip_items = [
                "skip to content",
                "search",
                "artists",
                "venues",
                "sign in",
                "sound check",
                "go home",
                "browse",
                "all access",
                "exclusives",
                "shows near you",
                "gifts",
                "ticketmaster",
                "house of blues",
                "get tickets",
                "about",
                "contact",
                "privacy policy",
                "terms of use",
            ]

            i = 0
            seen_events = set()
            current_year = datetime.now().year

            while i < len(lines):
                line = lines[i].upper()

                # Skip nav/UI items
                if line.lower() in skip_items or len(line) < 2:
                    i += 1
                    continue

                # Look for 3-letter day name (SAT, TUE, etc.) - same format as Tabernacle
                if line in DAY_NAMES:
                    # Next lines should be: day number, month, title
                    if i + 3 < len(lines):
                        day_num = lines[i + 1].strip()
                        month = lines[i + 2].strip().upper()
                        title = lines[i + 3].strip()

                        # Validate day number (1-31)
                        if not day_num.isdigit() or not (1 <= int(day_num) <= 31):
                            i += 1
                            continue

                        # Validate month
                        if month not in MONTH_MAP:
                            i += 1
                            continue

                        # Skip if title is another day name (malformed data)
                        if title.upper() in DAY_NAMES:
                            i += 1
                            continue

                        # Build date
                        day = int(day_num)
                        month_num = MONTH_MAP[month]

                        # Determine year - if month is in the past, use next year
                        year = current_year
                        try:
                            event_date = datetime(year, month_num, day)
                            if event_date < datetime.now():
                                year += 1
                                event_date = datetime(year, month_num, day)
                            start_date = event_date.strftime("%Y-%m-%d")
                        except ValueError:
                            i += 1
                            continue

                        # Check for duplicates (same show on multiple dates)
                        event_key = f"{title}|{start_date}"
                        if event_key in seen_events:
                            i += 4
                            continue
                        seen_events.add(event_key)

                        events_found += 1

                        # Generate content hash
                        content_hash = generate_content_hash(
                            title, "Buckhead Theatre", start_date
                        )

                        # Check for existing
                        existing = find_event_by_hash(content_hash)
                        if existing:
                            events_updated += 1
                            i += 4
                            continue

                        # Determine category based on title
                        category = "music"
                        subcategory = "concert"
                        tags = ["music", "concert", "buckhead-theatre", "buckhead"]

                        title_lower = title.lower()
                        if any(
                            w in title_lower
                            for w in ["comedy", "comedian", "stand-up", "stand up"]
                        ):
                            category = "comedy"
                            subcategory = None
                            tags = ["comedy", "buckhead-theatre", "buckhead"]
                        elif any(w in title_lower for w in ["theater", "theatre", "play"]):
                            category = "arts_culture"
                            subcategory = "theater"
                            tags = ["theater", "buckhead-theatre", "buckhead"]

                        event_record = {
                            "source_id": source_id,
                            "venue_id": venue_id,
                            "title": title,
                            "description": None,
                            "start_date": start_date,
                            "start_time": None,
                            "end_date": None,
                            "end_time": None,
                            "is_all_day": False,
                            "category": category,
                            "subcategory": subcategory,
                            "tags": tags,
                            "price_min": None,
                            "price_max": None,
                            "price_note": None,
                            "is_free": False,
                            "source_url": VENUE_URL,
                            "ticket_url": VENUE_URL,
                            "image_url": image_map.get(title),
                            "raw_text": f"{line} {day_num} {month} - {title}",
                            "extraction_confidence": 0.90,
                            "is_recurring": False,
                            "recurrence_rule": None,
                            "content_hash": content_hash,
                        }

                        try:
                            insert_event(event_record)
                            events_new += 1
                            logger.info(f"Added: {title} on {start_date}")
                        except Exception as e:
                            logger.error(f"Failed to insert: {title}: {e}")

                        i += 4
                        continue

                i += 1

            browser.close()

        logger.info(
            f"Buckhead Theatre crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Buckhead Theatre: {e}")
        raise

    return events_found, events_new, events_updated
