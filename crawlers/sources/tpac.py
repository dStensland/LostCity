"""
Crawler for TPAC - Tennessee Performing Arts Center (tpac.org/events).
Nashville's premier performing arts venue featuring Broadway shows and performances.

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

BASE_URL = "https://www.tpac.org"
EVENTS_URL = f"{BASE_URL}/events"

VENUE_DATA = {
    "name": "TPAC - Tennessee Performing Arts Center",
    "slug": "tpac",
    "address": "505 Deaderick St",
    "neighborhood": "Downtown",
    "city": "Nashville",
    "state": "TN",
    "zip": "37243",
    "venue_type": "performing_arts",
    "website": BASE_URL,
}


def parse_date_range(date_text: str) -> tuple[Optional[str], Optional[str]]:
    """
    Parse date range like 'Feb 4-9' or 'Mar 15, 2026'.
    Returns (start_date, end_date) tuple.
    """
    date_text = date_text.strip()
    current_year = datetime.now().year

    # Pattern: "Feb 4-9" (same month)
    match = re.match(r"([A-Za-z]{3})\s+(\d{1,2})\s*-\s*(\d{1,2})", date_text)
    if match:
        month, start_day, end_day = match.groups()
        try:
            start_dt = datetime.strptime(f"{month} {start_day} {current_year}", "%b %d %Y")
            end_dt = datetime.strptime(f"{month} {end_day} {current_year}", "%b %d %Y")
            # If dates are in the past, assume next year
            now = datetime.now()
            if start_dt < now:
                start_dt = start_dt.replace(year=current_year + 1)
                end_dt = end_dt.replace(year=current_year + 1)
            return start_dt.strftime("%Y-%m-%d"), end_dt.strftime("%Y-%m-%d")
        except ValueError:
            pass

    # Pattern: "Feb 4 - Mar 9" (different months)
    match = re.match(r"([A-Za-z]{3})\s+(\d{1,2})\s*-\s*([A-Za-z]{3})\s+(\d{1,2})", date_text)
    if match:
        start_month, start_day, end_month, end_day = match.groups()
        try:
            start_dt = datetime.strptime(f"{start_month} {start_day} {current_year}", "%b %d %Y")
            end_dt = datetime.strptime(f"{end_month} {end_day} {current_year}", "%b %d %Y")
            # If dates are in the past, assume next year
            now = datetime.now()
            if start_dt < now:
                start_dt = start_dt.replace(year=current_year + 1)
                end_dt = end_dt.replace(year=current_year + 1)
            return start_dt.strftime("%Y-%m-%d"), end_dt.strftime("%Y-%m-%d")
        except ValueError:
            pass

    # Pattern: Single date "Mar 15, 2026" or "Mar 15"
    match = re.match(r"([A-Za-z]{3})\s+(\d{1,2})(?:,?\s*(\d{4}))?", date_text)
    if match:
        month, day, year = match.groups()
        year = year or current_year
        try:
            dt = datetime.strptime(f"{month} {day} {year}", "%b %d %Y")
            # If date is in the past, assume next year (unless year was explicit)
            if not match.group(3) and dt < datetime.now():
                dt = dt.replace(year=int(year) + 1)
            return dt.strftime("%Y-%m-%d"), None
        except ValueError:
            pass

    return None, None


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl TPAC events using Playwright."""
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

            logger.info(f"Fetching TPAC: {EVENTS_URL}")
            page.goto(EVENTS_URL, wait_until="domcontentloaded", timeout=30000)
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
                "skip to content", "tickets", "plan your visit", "support",
                "about", "calendar", "buy tickets", "learn more", "events",
                "upcoming events", "all events", "broadway", "special events",
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
                start_date, end_date = parse_date_range(line)

                if start_date:
                    # Found a date line, look ahead for title
                    title = None
                    category_line = None

                    # Check next few lines for title
                    if i + 1 < len(lines):
                        next_line = lines[i + 1]
                        # Skip category markers like "BROADWAY" or "SPECIAL EVENT"
                        if next_line.isupper() and len(next_line) < 30:
                            category_line = next_line
                            if i + 2 < len(lines):
                                title = lines[i + 2]
                        else:
                            title = next_line

                    if not title or title.lower() in skip_items:
                        i += 1
                        continue

                    # Check for duplicates
                    event_key = f"{title}|{start_date}"
                    if event_key in seen_events:
                        i += 1
                        continue
                    seen_events.add(event_key)

                    events_found += 1

                    # Generate content hash
                    content_hash = generate_content_hash(title, "TPAC", start_date)

                    # Check for existing
                    existing = find_event_by_hash(content_hash)
                    if existing:
                        events_updated += 1
                        i += 1
                        continue

                    # Determine category based on content
                    event_category = "theater"
                    subcategory = "performing_arts"
                    tags = ["tpac", "performing-arts", "downtown-nashville"]

                    title_lower = title.lower()
                    if category_line and "broadway" in category_line.lower():
                        subcategory = "broadway"
                        tags.append("broadway")
                    elif any(w in title_lower for w in ["musical", "broadway"]):
                        subcategory = "musical"
                        tags.append("broadway")
                    elif any(w in title_lower for w in ["symphony", "orchestra", "concert"]):
                        event_category = "music"
                        subcategory = "classical"
                        tags.append("classical")
                    elif any(w in title_lower for w in ["ballet", "dance"]):
                        subcategory = "dance"
                        tags.append("dance")
                    elif any(w in title_lower for w in ["opera"]):
                        subcategory = "opera"
                        tags.append("opera")

                    event_record = {
                        "source_id": source_id,
                        "venue_id": venue_id,
                        "title": title,
                        "description": category_line,
                        "start_date": start_date,
                        "start_time": None,
                        "end_date": end_date,
                        "end_time": None,
                        "is_all_day": False,
                        "category": event_category,
                        "subcategory": subcategory,
                        "tags": tags,
                        "price_min": None,
                        "price_max": None,
                        "price_note": None,
                        "is_free": False,
                        "source_url": EVENTS_URL,
                        "ticket_url": EVENTS_URL,
                        "image_url": image_map.get(title),
                        "raw_text": f"{line} {title}",
                        "extraction_confidence": 0.90,
                        "is_recurring": end_date is not None,
                        "recurrence_rule": None,
                        "content_hash": content_hash,
                    }

                    try:
                        insert_event(event_record)
                        events_new += 1
                        logger.info(f"Added: {title} on {start_date}")
                    except Exception as e:
                        logger.error(f"Failed to insert: {title}: {e}")

                i += 1

        logger.info(
            f"TPAC crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl TPAC: {e}")
        raise

    return events_found, events_new, events_updated
