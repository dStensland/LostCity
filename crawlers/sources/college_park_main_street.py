"""
Crawler for College Park Main Street Association (CPMSA).

College Park Main Street Association hosts community events including:
- JazzFest, Wine Walks, Dog Days of Summer, Holiday on the Drive, ReKindle Art Walk

Events are hosted on Eventbrite: https://www.eventbrite.com/o/college-park-main-street-association-78944267493
"""

from __future__ import annotations

import re
import logging
from datetime import datetime
from typing import Optional

from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout

from db import get_or_create_venue, insert_event, find_event_by_hash
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://www.collegeparkmainstreet.com"
EVENTBRITE_ORG_URL = "https://www.eventbrite.com/o/college-park-main-street-association-78944267493"

VENUE_DATA = {
    "name": "College Park Main Street",
    "slug": "college-park-main-street",
    "address": "Main Street",
    "neighborhood": "Historic College Park",
    "city": "College Park",
    "state": "GA",
    "zip": "30337",
    "venue_type": "community_center",
    "spot_type": "community_center",
    "website": BASE_URL,
}


def parse_datetime(date_str: str, time_str: str = None) -> tuple[Optional[str], Optional[str]]:
    """
    Parse Eventbrite date and time strings.
    Examples: 'Sat, Feb 1, 7:00 PM' or separate date/time
    """
    try:
        # Handle combined datetime string like "Sat, Feb 1, 7:00 PM"
        if "," in date_str and ("PM" in date_str.upper() or "AM" in date_str.upper()):
            # Extract date part and time part
            parts = date_str.split(",")
            if len(parts) >= 3:
                # "Sat", " Feb 1", " 7:00 PM"
                month_day = parts[1].strip()  # "Feb 1"
                time_part = parts[2].strip()  # "7:00 PM"

                # Parse date
                now = datetime.now()
                year = now.year

                for fmt in ["%b %d", "%B %d"]:
                    try:
                        dt = datetime.strptime(month_day, fmt)
                        dt = dt.replace(year=year)
                        if dt < now:
                            dt = dt.replace(year=year + 1)
                        date = dt.strftime("%Y-%m-%d")

                        # Parse time
                        time = parse_time(time_part)
                        return date, time
                    except ValueError:
                        continue

        # Handle separate date string
        now = datetime.now()
        year = now.year

        # Try various formats
        formats = [
            "%B %d, %Y",  # "February 1, 2026"
            "%b %d, %Y",  # "Feb 1, 2026"
            "%B %d",      # "February 1"
            "%b %d",      # "Feb 1"
        ]

        for fmt in formats:
            try:
                if "%Y" in fmt:
                    dt = datetime.strptime(date_str.strip(), fmt)
                else:
                    dt = datetime.strptime(date_str.strip(), fmt)
                    dt = dt.replace(year=year)
                    if dt < now:
                        dt = dt.replace(year=year + 1)

                date = dt.strftime("%Y-%m-%d")
                time = parse_time(time_str) if time_str else None
                return date, time
            except ValueError:
                continue

        return None, None
    except Exception as e:
        logger.warning(f"Failed to parse datetime '{date_str}' / '{time_str}': {e}")
        return None, None


def parse_time(time_text: str) -> Optional[str]:
    """Parse time to HH:MM format."""
    if not time_text:
        return None

    try:
        time_text = time_text.lower().strip()

        # "7:00 PM" or "7:00pm"
        match = re.search(r"(\d{1,2}):(\d{2})\s*(am|pm)", time_text)
        if match:
            hour, minute, period = match.groups()
            hour = int(hour)
            if period == "pm" and hour != 12:
                hour += 12
            elif period == "am" and hour == 12:
                hour = 0
            return f"{hour:02d}:{minute}"

        # "7 PM" or "7pm"
        match = re.search(r"(\d{1,2})\s*(am|pm)", time_text)
        if match:
            hour, period = match.groups()
            hour = int(hour)
            if period == "pm" and hour != 12:
                hour += 12
            elif period == "am" and hour == 12:
                hour = 0
            return f"{hour:02d}:00"

        return None
    except Exception:
        return None


def determine_category(title: str, description: str = "") -> tuple[str, Optional[str], list[str]]:
    """Determine category, subcategory, and tags based on event content."""
    text = f"{title} {description}".lower()
    tags = ["college-park", "college-park-main-street", "cpmsa"]

    if any(w in text for w in ["jazz", "jazzfest", "music festival"]):
        return "music", "festival", tags + ["jazz", "festival", "outdoor"]
    if any(w in text for w in ["wine walk", "wine", "tasting"]):
        return "food_drink", "tasting", tags + ["wine", "walk", "social"]
    if any(w in text for w in ["art walk", "rekindle", "gallery", "artist"]):
        return "art", "gallery", tags + ["art-walk", "gallery", "outdoor"]
    if any(w in text for w in ["dog days", "pet", "dog"]):
        return "family", "pets", tags + ["pets", "family", "outdoor"]
    if any(w in text for w in ["holiday", "christmas", "lights"]):
        return "community", "holiday", tags + ["holiday", "festival", "family"]
    if any(w in text for w in ["market", "vendor", "shop"]):
        return "community", "market", tags + ["market", "shopping"]
    if any(w in text for w in ["kids", "children", "family"]):
        return "family", "kids", tags + ["family", "kids"]

    return "community", None, tags


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl College Park Main Street events from Eventbrite organizer page."""
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

            logger.info(f"Fetching College Park Main Street events: {EVENTBRITE_ORG_URL}")
            page.goto(EVENTBRITE_ORG_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(5000)

            # Scroll to load all events
            for _ in range(3):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(2000)

            # Check if there are any upcoming events
            body_text = page.inner_text("body")
            if "Upcoming (0)" in body_text or "Sorry, there are no upcoming events" in body_text:
                logger.info("No upcoming events found on organizer page")
                browser.close()
                return events_found, events_new, events_updated

            # Find event links - Eventbrite organizer pages use simple link structure
            links = page.query_selector_all('a[href*="/e/"]')
            logger.info(f"Found {len(links)} total event links")

            seen_events = set()

            for link in links:
                try:
                    # Get event URL
                    href = link.get_attribute("href")
                    if not href:
                        continue

                    if not href.startswith("http"):
                        href = f"https://www.eventbrite.com{href}"

                    # Get parent element which contains title + date
                    parent = link
                    parent_text = None
                    for _ in range(5):  # Go up the tree to find container
                        parent_el = parent.evaluate_handle('el => el.parentElement').as_element()
                        if parent_el:
                            parent = parent_el
                            text = parent.inner_text()
                            if text and len(text) > 20:
                                parent_text = text
                                break

                    if not parent_text:
                        continue

                    # Parse parent text format: "TitleDay, Month DD •  HH:MM PM ..."
                    # Example: "College Park Fall Wine StrollThu, Sep 26 •  4:00 PM Check ticket price..."
                    lines = parent_text.strip().split('\n')
                    first_line = lines[0] if lines else parent_text

                    # Extract title - everything before the date pattern
                    title_match = re.match(
                        r"^(.+?)(Mon|Tue|Wed|Thu|Fri|Sat|Sun),?\s+",
                        first_line
                    )
                    if not title_match:
                        continue

                    title = title_match.group(1).strip()
                    if not title or len(title) < 3:
                        continue

                    # Extract date/time - look for pattern "Day, Month DD • HH:MM PM"
                    date_match = re.search(
                        r"(Mon|Tue|Wed|Thu|Fri|Sat|Sun),?\s+(\w+)\s+(\d{1,2})\s+•\s+(\d{1,2}:\d{2}\s+[AP]M)",
                        first_line
                    )

                    if not date_match:
                        # Try without bullet
                        date_match = re.search(
                            r"(Mon|Tue|Wed|Thu|Fri|Sat|Sun),?\s+(\w+)\s+(\d{1,2})(?:\s+•)?\s+(\d{1,2}:\d{2}\s+[AP]M)",
                            first_line
                        )

                    if not date_match:
                        logger.debug(f"No date found for: {title}")
                        continue

                    # Parse date components
                    month = date_match.group(2)
                    day = date_match.group(3)
                    time_str = date_match.group(4)

                    # Construct date string
                    date_text = f"{month} {day}"
                    start_date, start_time = parse_datetime(date_text, time_str)

                    if not start_date:
                        logger.debug(f"Could not parse date '{date_text}' for: {title}")
                        continue

                    # Skip past events
                    if start_date < datetime.now().strftime("%Y-%m-%d"):
                        continue

                    # Check for duplicates
                    event_key = f"{title}|{start_date}"
                    if event_key in seen_events:
                        continue
                    seen_events.add(event_key)

                    events_found += 1

                    # Check if free in parent text
                    is_free = "free" in parent_text.lower()

                    # Get image from link element
                    img_el = link.query_selector('img')
                    image_url = None
                    if img_el:
                        image_url = img_el.get_attribute("src") or img_el.get_attribute("data-src")

                    # Determine category
                    category, subcategory, tags = determine_category(title, parent_text)

                    # Description - use a portion of parent text if available
                    description = None
                    if len(parent_text) > len(title) + 50:
                        # Extract text after the event details
                        desc_match = re.search(r"[AP]M\s+(.+?)(?:Save this event|$)", parent_text)
                        if desc_match:
                            description = desc_match.group(1).strip()[:500]

                    # Generate content hash
                    content_hash = generate_content_hash(
                        title, "College Park Main Street", start_date
                    )

                    # Check for existing
                    if find_event_by_hash(content_hash):
                        events_updated += 1
                        continue

                    event_record = {
                        "source_id": source_id,
                        "venue_id": venue_id,
                        "title": title[:500],
                        "description": description,
                        "start_date": start_date,
                        "start_time": start_time,
                        "end_date": None,
                        "end_time": None,
                        "is_all_day": start_time is None,
                        "category": category,
                        "subcategory": subcategory,
                        "tags": tags,
                        "price_min": None,
                        "price_max": None,
                        "price_note": "See Eventbrite",
                        "is_free": is_free,
                        "source_url": href,
                        "ticket_url": href,
                        "image_url": image_url,
                        "raw_text": None,
                        "extraction_confidence": 0.85,
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
                    logger.warning(f"Failed to parse event card: {e}")
                    continue

            browser.close()

        logger.info(
            f"College Park Main Street crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except PlaywrightTimeout as e:
        logger.error(f"Timeout fetching College Park Main Street: {e}")
        raise
    except Exception as e:
        logger.error(f"Failed to crawl College Park Main Street: {e}")
        raise

    return events_found, events_new, events_updated
