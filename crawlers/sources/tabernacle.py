"""
Crawler for The Tabernacle (tabernacleatl.com/shows).
Historic Downtown Atlanta concert venue, former church converted for the '96 Olympics.

Site uses JavaScript rendering - must use Playwright.
Format: DAY (3-letter), DD, MON (3-letter), TITLE
"""

from __future__ import annotations

import logging
from datetime import datetime

from playwright.sync_api import sync_playwright

from db import get_or_create_venue, insert_event, find_event_by_hash
from dedupe import generate_content_hash
from utils import extract_images_from_page
from description_fetcher import fetch_description_playwright

logger = logging.getLogger(__name__)

BASE_URL = "https://www.tabernacleatl.com"
SHOWS_URL = f"{BASE_URL}/shows"

VENUE_DATA = {
    "name": "The Tabernacle",
    "slug": "tabernacle",
    "address": "152 Luckie St NW",
    "neighborhood": "Downtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30303",
    "venue_type": "music_venue",
    "website": BASE_URL,
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
    """Crawl The Tabernacle events using Playwright."""
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

            logger.info(f"Fetching The Tabernacle: {SHOWS_URL}")
            page.goto(SHOWS_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(3000)

            # Extract images from page
            image_map = extract_images_from_page(page)

            # Scroll to load all content
            for _ in range(5):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1000)

            # Extract event detail links from page
            detail_links = page.evaluate("""
                () => {
                    const links = {};
                    document.querySelectorAll('a[href*="/shows/"], a[href*="/events/"]').forEach(a => {
                        const text = a.textContent.trim();
                        const href = a.href;
                        if (text && text.length > 3 && href) {
                            links[text] = href;
                        }
                    });
                    return links;
                }
            """)

            # Get page text
            body_text = page.inner_text("body")
            lines = [line.strip() for line in body_text.split("\n") if line.strip()]

            # Skip navigation items
            skip_items = [
                "skip to content",
                "shows",
                "filter",
                "list",
                "calendar",
                "the tabernacle",
                "get tickets",
                "about",
                "contact",
                "privacy policy",
                "terms of use",
            ]

            i = 0
            seen_events = set()
            current_year = datetime.now().year
            new_events = []

            while i < len(lines):
                line = lines[i].upper()

                # Skip nav/UI items
                if line.lower() in skip_items or len(line) < 2:
                    i += 1
                    continue

                # Look for 3-letter day name (SAT, TUE, etc.)
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
                            title, "The Tabernacle", start_date
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
                        tags = ["music", "concert", "tabernacle", "downtown"]

                        title_lower = title.lower()
                        if any(
                            w in title_lower
                            for w in ["comedy", "comedian", "stand-up", "stand up"]
                        ):
                            category = "comedy"
                            subcategory = None
                            tags = ["comedy", "tabernacle", "downtown"]
                        elif any(w in title_lower for w in ["murder", "podcast"]):
                            category = "community"
                            subcategory = "podcast"
                            tags = ["podcast", "tabernacle", "downtown"]

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
                            "source_url": SHOWS_URL,
                            "ticket_url": SHOWS_URL,
                            "image_url": image_map.get(title),
                            "raw_text": f"{line} {day_num} {month} - {title}",
                            "extraction_confidence": 0.90,
                            "is_recurring": False,
                            "recurrence_rule": None,
                            "content_hash": content_hash,
                        }

                        new_events.append(event_record)

                        i += 4
                        continue

                i += 1

            # Fetch descriptions from detail pages for new events
            detail_page = context.new_page()
            detail_fetches = 0
            for evt in new_events:
                title = evt["title"]
                detail_url = detail_links.get(title)
                if detail_url and detail_fetches < 20:
                    desc = fetch_description_playwright(detail_page, detail_url)
                    if desc:
                        evt["description"] = desc
                    detail_fetches += 1
                    page.wait_for_timeout(1000)

                # Synthetic fallback
                if not evt["description"]:
                    evt["description"] = f"Live event at The Tabernacle."

                try:
                    insert_event(evt)
                    events_new += 1
                    logger.info(f"Added: {title} on {evt['start_date']}")
                except Exception as e:
                    logger.error(f"Failed to insert: {title}: {e}")

            detail_page.close()
            browser.close()

        logger.info(
            f"The Tabernacle crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl The Tabernacle: {e}")
        raise

    return events_found, events_new, events_updated
