"""
Crawler for DeKalb County Public Library System events.
Uses Communico events platform.
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

BASE_URL = "https://events.dekalblibrary.org"
EVENTS_URL = f"{BASE_URL}/events?v=list"

# Map branch names to venue data
BRANCH_VENUES = {
    "decatur": {
        "name": "Decatur Library",
        "slug": "decatur-library",
        "address": "215 Sycamore St",
        "neighborhood": "Downtown Decatur",
        "city": "Decatur",
        "state": "GA",
        "zip": "30030",
        "venue_type": "library",
    },
}

DEFAULT_VENUE = {
    "name": "DeKalb County Library",
    "slug": "dekalb-county-library",
    "city": "Decatur",
    "state": "GA",
    "venue_type": "library",
}


def find_branch_venue(location_text: str) -> dict:
    """Find matching branch venue from location text."""
    location_lower = location_text.lower()
    for key, venue in BRANCH_VENUES.items():
        if key in location_lower:
            return venue
    return DEFAULT_VENUE


def parse_date(date_str: str) -> Optional[str]:
    """Parse date from various formats."""
    for fmt in ["%Y-%m-%d", "%B %d, %Y", "%b %d, %Y", "%m/%d/%Y", "%A, %B %d, %Y"]:
        try:
            dt = datetime.strptime(date_str.strip(), fmt)
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            continue

    # Try partial formats (no year in source text)
    current_year = datetime.now().year
    for fmt in ["%B %d", "%b %d"]:
        try:
            dt = datetime.strptime(date_str.strip(), fmt)
            dt = dt.replace(year=current_year)
            # Only bump to next year if >60 days in the past
            # (avoids pushing recent-past events to wrong year)
            if (datetime.now() - dt).days > 60:
                dt = dt.replace(year=current_year + 1)
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            continue

    return None


def parse_time(time_str: str) -> Optional[str]:
    """Parse time from various formats."""
    try:
        match = re.search(r"(\d{1,2}):(\d{2})\s*(am|pm)", time_str, re.IGNORECASE)
        if match:
            hour, minute, period = match.groups()
            hour = int(hour)
            if period.lower() == "pm" and hour != 12:
                hour += 12
            elif period.lower() == "am" and hour == 12:
                hour = 0
            return f"{hour:02d}:{minute}"
    except Exception:
        pass
    return None


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl DeKalb County Library events using Playwright."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
            )
            page = context.new_page()

            logger.info(f"Fetching DeKalb Library events: {EVENTS_URL}")
            page.goto(EVENTS_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(4000)

            # Extract images from page
            image_map = extract_images_from_page(page)

            # Get full page text and parse events
            body_text = page.inner_text("body")
            lines = [l.strip() for l in body_text.split("\n") if l.strip()]

            # Find event links for URLs
            event_links = page.query_selector_all("a[href*='/event/']")
            event_urls = {}
            for link in event_links:
                title = link.inner_text().strip()
                href = link.get_attribute("href")
                if title and href:
                    event_urls[title] = href

            logger.info(f"Found {len(event_urls)} unique event titles")

            seen_titles = set()
            current_year = datetime.now().year
            i = 0

            while i < len(lines):
                line = lines[i]

                # Look for event titles (lines that match our URL dict)
                if line in event_urls and line not in seen_titles:
                    title = line
                    seen_titles.add(title)

                    # Next line should have date/time: "Wednesday, January 14: 9:30am - 10:00am"
                    date_line = lines[i + 1] if i + 1 < len(lines) else ""
                    location_line = lines[i + 2] if i + 2 < len(lines) else ""

                    # Parse date - format: "Wednesday, January 14: 9:30am"
                    date_match = re.search(r"(\w+)\s+(\d{1,2}):", date_line)
                    if not date_match:
                        i += 1
                        continue

                    month_str, day = date_match.groups()
                    start_date = parse_date(f"{month_str} {day}")
                    if not start_date:
                        i += 1
                        continue

                    # Parse time
                    time_match = re.search(
                        r"(\d{1,2}:\d{2}\s*(am|pm))", date_line, re.I
                    )
                    start_time = parse_time(time_match.group()) if time_match else None

                    # Get location from the line after date/time
                    venue_data = find_branch_venue(location_line)
                    venue_id = get_or_create_venue(venue_data)

                    href = event_urls.get(title, "")

                    events_found += 1

                    content_hash = generate_content_hash(
                        title, venue_data["name"], start_date
                    )


                    # Determine subcategory
                    title_lower = title.lower()
                    if "book club" in title_lower or "reading group" in title_lower:
                        subcategory = "words.bookclub"
                    elif "story" in title_lower or "storytime" in title_lower:
                        subcategory = "words.storytelling"
                    elif "author" in title_lower or "signing" in title_lower:
                        subcategory = "words.reading"
                    elif "poetry" in title_lower:
                        subcategory = "words.poetry"
                    elif "writing" in title_lower or "workshop" in title_lower:
                        subcategory = "words.workshop"
                    else:
                        subcategory = "words.lecture"

                    event_url = (
                        f"{BASE_URL}{href}"
                        if href and href.startswith("/")
                        else (href or EVENTS_URL)
                    )

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
                        "category": "words",
                        "subcategory": subcategory,
                        "tags": ["library", "free", "dekalb"],
                        "price_min": None,
                        "price_max": None,
                        "price_note": None,
                        "is_free": True,
                        "source_url": event_url,
                        "ticket_url": None,
                        "image_url": image_map.get(title),
                        "raw_text": None,
                        "extraction_confidence": 0.8,
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

            browser.close()

        logger.info(
            f"DeKalb Library crawl complete: {events_found} found, {events_new} new"
        )

    except Exception as e:
        logger.error(f"Failed to crawl DeKalb Library: {e}")
        raise

    return events_found, events_new, events_updated
