"""
Crawler for Fernbank Museum of Natural History (fernbankmuseum.org).
Natural history museum with events including Fernbank After Dark.

Site uses JavaScript rendering - must use Playwright.
Format: Category, Title, Day Month DD, YYYY H:MM AM — H:MM PM, Description
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

BASE_URL = "https://www.fernbankmuseum.org"
EVENTS_URL = f"{BASE_URL}/events/calendar-of-events/"

VENUE_DATA = {
    "name": "Fernbank Museum of Natural History",
    "slug": "fernbank-museum",
    "address": "767 Clifton Rd NE",
    "neighborhood": "Druid Hills",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30307",
    "lat": 33.7739,
    "lng": -84.3281,
    "venue_type": "museum",
    "website": BASE_URL,
}


def parse_time(time_text: str) -> Optional[str]:
    """Parse time from '11:00 AM' format."""
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


def determine_category(title: str, category_type: str) -> tuple[str, Optional[str], list[str]]:
    """Determine category based on event title and type."""
    title_lower = title.lower()
    type_lower = category_type.lower() if category_type else ""
    tags = ["fernbank", "museum", "druid-hills"]

    if "museum nights" in type_lower or "after dark" in title_lower:
        return "community", "adults", tags + ["adults-only", "21+"]
    if "nature walk" in title_lower or "ranger" in title_lower:
        return "fitness", "outdoors", tags + ["nature", "outdoor"]
    if "story time" in title_lower:
        return "family", "kids", tags + ["family", "kids"]
    if any(w in title_lower for w in ["kids", "children", "family", "camp"]):
        return "family", None, tags + ["family"]
    if "educator" in type_lower or "educator" in title_lower:
        return "community", "education", tags + ["education"]
    if any(w in title_lower for w in ["film", "movie", "imax", "giant screen"]):
        return "film", None, tags + ["film"]
    if "aglow" in title_lower or "wildwoods" in title_lower:
        return "family", "outdoor", tags + ["outdoor", "nature"]

    return "museums", "museum", tags


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Fernbank Museum events using Playwright."""
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

            logger.info(f"Fetching Fernbank Museum: {EVENTS_URL}")
            page.goto(EVENTS_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(3000)

            # Extract images from page
            image_map = extract_images_from_page(page)

            # Extract event links for specific URLs
            event_links = extract_event_links(page, BASE_URL)

            # Scroll to load all content
            for _ in range(5):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1000)

            # Get page text
            body_text = page.inner_text("body")
            lines = [l.strip() for l in body_text.split("\n") if l.strip()]

            # Skip navigation items
            skip_items = ["get tickets", "become a member", "visit", "events",
                         "calendar of events", "host an event", "museum nights",
                         "private experiences", "sensory mornings", "experiences",
                         "learn", "support", "membership", "open daily", "filter by",
                         "for educators", "special programs", "sign up", "subscribe"]

            # Event type markers
            event_types = ["daily programs", "guided programs", "discovery days",
                          "museum nights", "special programs"]

            i = 0
            seen_events = set()
            current_type = None

            while i < len(lines):
                line = lines[i]

                # Skip nav/UI items
                if line.lower() in skip_items or len(line) < 3:
                    i += 1
                    continue

                # Check for event type header
                if line.lower() in event_types:
                    current_type = line
                    i += 1
                    continue

                # Look for date pattern: "Tuesday, January 20, 2026 11:00 AM — 11:30 AM"
                date_match = re.match(
                    r"(\w+),\s+(\w+)\s+(\d{1,2}),\s+(\d{4})\s+(\d{1,2}:\d{2}\s*[AP]M)",
                    line,
                    re.IGNORECASE
                )

                if date_match:
                    # Look back for title
                    title = None
                    if i - 1 >= 0:
                        prev_line = lines[i - 1]
                        if prev_line.lower() not in skip_items and prev_line.lower() not in event_types:
                            title = prev_line

                    if not title:
                        i += 1
                        continue

                    # Parse date
                    day_name, month, day, year, time_str = date_match.groups()
                    try:
                        dt = datetime.strptime(f"{month} {day} {year}", "%B %d %Y")
                        start_date = dt.strftime("%Y-%m-%d")
                    except ValueError:
                        i += 1
                        continue

                    # Parse time
                    start_time = parse_time(time_str)

                    # Parse end time if present (after "—")
                    end_time = None
                    end_match = re.search(r"—\s*(\d{1,2}:\d{2}\s*[AP]M)", line, re.IGNORECASE)
                    if end_match:
                        end_time = parse_time(end_match.group(1))

                    # Look ahead for description
                    description = None
                    if i + 1 < len(lines):
                        next_line = lines[i + 1]
                        if next_line.lower() not in event_types and len(next_line) > 20:
                            description = next_line[:500]

                    # Check for duplicates
                    event_key = f"{title}|{start_date}|{start_time}"
                    if event_key in seen_events:
                        i += 1
                        continue
                    seen_events.add(event_key)

                    events_found += 1

                    # Generate content hash
                    content_hash = generate_content_hash(
                        title, "Fernbank Museum of Natural History", start_date
                    )

                    # Check for existing
                    existing = find_event_by_hash(content_hash)
                    if existing:
                        events_updated += 1
                        i += 1
                        continue

                    # Determine category
                    category, subcategory, tags = determine_category(title, current_type)

                    # Get specific event URL


                    event_url = find_event_url(title, event_links, EVENTS_URL)



                    event_record = {
                        "source_id": source_id,
                        "venue_id": venue_id,
                        "title": title,
                        "description": description,
                        "start_date": start_date,
                        "start_time": start_time,
                        "end_date": None,
                        "end_time": end_time,
                        "is_all_day": False,
                        "category": category,
                        "subcategory": subcategory,
                        "tags": tags,
                        "price_min": None,
                        "price_max": None,
                        "price_note": None,
                        "is_free": False,
                        "source_url": event_url,
                        "ticket_url": event_url,
                        "image_url": image_map.get(title),
                        "raw_text": f"{current_type}: {title}" if current_type else title,
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

                i += 1

            browser.close()

        logger.info(
            f"Fernbank Museum crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Fernbank Museum: {e}")
        raise

    return events_found, events_new, events_updated
