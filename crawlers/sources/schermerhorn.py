"""
Crawler for Schermerhorn Symphony Center (nashvillesymphony.org/tickets).
Home of the Nashville Symphony featuring classical concerts and special performances.

Site uses JavaScript rendering - must use Playwright.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime
from typing import Optional

from playwright.sync_api import sync_playwright

from db import get_or_create_venue, insert_event, find_event_by_hash
from dedupe import generate_content_hash
from utils import extract_images_from_page

logger = logging.getLogger(__name__)

BASE_URL = "https://www.nashvillesymphony.org"
TICKETS_URL = f"{BASE_URL}/tickets/"

VENUE_DATA = {
    "name": "Schermerhorn Symphony Center",
    "slug": "schermerhorn",
    "address": "1 Symphony Pl",
    "neighborhood": "SoBro",
    "city": "Nashville",
    "state": "TN",
    "zip": "37201",
    "venue_type": "performing_arts",
    "website": BASE_URL,
}


def parse_date(date_text: str) -> Optional[str]:
    """
    Parse date from formats like 'Feb 14', 'March 8, 2026'.
    Returns YYYY-MM-DD.
    """
    date_text = date_text.strip()
    current_year = datetime.now().year

    # Try "March 8, 2026" format
    try:
        dt = datetime.strptime(date_text, "%B %d, %Y")
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

    # Try "March 8" format
    try:
        dt = datetime.strptime(date_text, "%B %d")
        dt = dt.replace(year=current_year)
        if dt < datetime.now():
            dt = dt.replace(year=current_year + 1)
        return dt.strftime("%Y-%m-%d")
    except ValueError:
        pass

    return None


def parse_time(time_text: str) -> Optional[str]:
    """Parse time like '7:30 PM' or '8 PM' to HH:MM."""
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
    """Crawl Schermerhorn Symphony Center events using Playwright."""
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

            logger.info(f"Fetching Schermerhorn Symphony Center: {TICKETS_URL}")
            page.goto(TICKETS_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(3000)

            # Scroll to load all content
            for _ in range(3):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1000)

            # Find all event elements using CSS selector
            event_elements = page.query_selector_all(".event")
            logger.info(f"Found {len(event_elements)} event elements")

            seen_events = set()

            for event_elem in event_elements:
                try:
                    # Extract title from h3
                    title_elem = event_elem.query_selector("h3")
                    if not title_elem:
                        continue
                    title = title_elem.inner_text().strip()

                    if not title:
                        continue

                    # Extract category/series from h4
                    category_text = ""
                    category_elem = event_elem.query_selector("h4")
                    if category_elem:
                        category_text = category_elem.inner_text().strip().lower()

                    # Find all .tic elements (multiple dates for same event)
                    tic_elements = event_elem.query_selector_all(".tic")

                    if not tic_elements:
                        logger.debug(f"No date elements found for: {title}")
                        continue

                    # Extract image
                    image_url = None
                    img_elem = event_elem.query_selector("img")
                    if img_elem:
                        image_url = img_elem.get_attribute("src")
                        if image_url and not image_url.startswith("http"):
                            image_url = BASE_URL + image_url if image_url.startswith("/") else None

                    # Process each date for this event
                    for tic_elem in tic_elements:
                        # Extract date from .date (e.g., "2/6")
                        date_elem = tic_elem.query_selector(".date")
                        if not date_elem:
                            continue
                        date_text = date_elem.inner_text().strip()

                        # Parse date (format: "2/6" means Feb 6)
                        try:
                            parts = date_text.split("/")
                            if len(parts) == 2:
                                month = int(parts[0])
                                day = int(parts[1])
                                current_year = datetime.now().year
                                dt = datetime(current_year, month, day)
                                # If date is in the past, assume next year
                                if dt < datetime.now():
                                    dt = dt.replace(year=current_year + 1)
                                start_date = dt.strftime("%Y-%m-%d")
                            else:
                                continue
                        except (ValueError, IndexError):
                            logger.debug(f"Could not parse date: {date_text}")
                            continue

                        # Extract time from .day span (e.g., "Friday<span>7:30 PM</span>")
                        start_time = None
                        day_elem = tic_elem.query_selector(".day")
                        if day_elem:
                            day_text = day_elem.inner_text().strip()
                            start_time = parse_time(day_text)

                        # Check for duplicates
                        event_key = f"{title}|{start_date}|{start_time}"
                        if event_key in seen_events:
                            continue
                        seen_events.add(event_key)

                        events_found += 1

                        # Generate content hash
                        content_hash = generate_content_hash(
                            title, "Schermerhorn Symphony Center", start_date
                        )

                        # Check for existing
                        existing = find_event_by_hash(content_hash)
                        if existing:
                            events_updated += 1
                            continue

                        # Determine category based on content
                        event_category = "music"
                        subcategory = "classical"
                        tags = ["schermerhorn", "symphony", "classical", "sobro"]

                        title_lower = title.lower()
                        if any(w in title_lower or w in category_text for w in ["pops", "movie", "film"]):
                            subcategory = "pops"
                            tags.append("pops")
                        elif any(w in title_lower or w in category_text for w in ["family", "kids", "children"]):
                            event_category = "family"
                            subcategory = "kids"
                            tags.extend(["family", "kids"])
                        elif any(w in title_lower or w in category_text for w in ["jazz"]):
                            subcategory = "jazz"
                            tags.append("jazz")
                        elif "presentation" in category_text:
                            tags.append("special-event")

                        event_record = {
                            "source_id": source_id,
                            "venue_id": venue_id,
                            "title": title,
                            "description": category_text if category_text else None,
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
                            "source_url": TICKETS_URL,
                            "ticket_url": TICKETS_URL,
                            "image_url": image_url,
                            "raw_text": f"{date_text} {title}",
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

                except Exception as e:
                    logger.error(f"Error processing event element: {e}")
                    continue

            browser.close()

        logger.info(
            f"Schermerhorn crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Schermerhorn Symphony Center: {e}")
        raise

    return events_found, events_new, events_updated
