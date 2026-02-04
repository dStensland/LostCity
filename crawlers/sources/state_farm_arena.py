"""
Crawler for State Farm Arena (statefarmarena.com).

Home of the Atlanta Hawks - concerts, sports, and special events.
Uses Playwright to handle JavaScript rendering.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime
from typing import Optional

from playwright.sync_api import sync_playwright

from db import get_or_create_venue, insert_event, find_event_by_hash
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://www.statefarmarena.com"
EVENTS_URL = f"{BASE_URL}/events"

VENUE_DATA = {
    "name": "State Farm Arena",
    "slug": "state-farm-arena",
    "address": "1 State Farm Drive",
    "neighborhood": "Downtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30303",
    "lat": 33.7573,
    "lng": -84.3963,
    "venue_type": "arena",
    "spot_type": "stadium",
    "website": BASE_URL,
    "description": "State Farm Arena is a multi-purpose indoor arena in Atlanta, home of the Atlanta Hawks NBA team.",
}


def parse_date(date_text: str) -> Optional[str]:
    """Parse date from formats like 'Sun Feb 1 2026' or 'February 1, 2026'."""
    if not date_text:
        return None

    date_text = date_text.strip()

    # Try "Sun Feb 1 2026" format
    match = re.search(
        r"(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)?\s*(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{1,2})(?:\s+|,\s*)(\d{4})",
        date_text,
        re.IGNORECASE
    )
    if match:
        month, day, year = match.groups()
        try:
            dt = datetime.strptime(f"{month[:3]} {day} {year}", "%b %d %Y")
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            pass

    return None


def parse_time(time_text: str) -> Optional[str]:
    """Parse time from '7:00 PM' or 'Event Starts 7:30 PM' format."""
    if not time_text:
        return None

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


def determine_category(title: str) -> tuple[str, str, list[str]]:
    """Determine category, subcategory, and tags based on event title."""
    title_lower = title.lower()

    if "hawks" in title_lower:
        return "sports", "basketball", ["hawks", "nba", "basketball", "sports", "state-farm-arena", "downtown"]
    elif any(word in title_lower for word in ["wrestling", "wwe", "aew", "raw", "smackdown"]):
        return "sports", "wrestling", ["wrestling", "wwe", "sports", "entertainment", "state-farm-arena", "downtown"]
    elif any(word in title_lower for word in ["monster truck", "monster jam", "hot wheels"]):
        return "family", "show", ["family", "kids", "monster-trucks", "state-farm-arena", "downtown"]
    elif any(word in title_lower for word in ["disney", "ice show", "circus", "sesame"]):
        return "family", "show", ["family", "kids", "show", "state-farm-arena", "downtown"]
    elif any(word in title_lower for word in ["comedy", "comedian", "katt williams", "kevin hart", "stand-up"]):
        return "nightlife", "comedy", ["comedy", "standup", "state-farm-arena", "downtown"]
    elif any(word in title_lower for word in ["tour", "concert", "live", "r&b", "hip hop", "country"]):
        return "music", "concert", ["concert", "live-music", "arena-show", "state-farm-arena", "downtown"]
    else:
        return "community", "event", ["event", "state-farm-arena", "downtown"]


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl State Farm Arena events using semantic HTML structure.

    The site uses h3 for titles, h4 for dates, h5 for times.
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

            logger.info(f"Fetching State Farm Arena: {EVENTS_URL}")
            page.goto(EVENTS_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(3000)

            # Scroll to load all content
            for _ in range(5):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1000)

            # The site uses semantic HTML: h3 for titles, h4 for dates, h5 for times
            # Find all h3 elements which contain event titles
            h3_elements = page.query_selector_all("h3")
            logger.info(f"Found {len(h3_elements)} h3 elements to check for events")

            seen_events = set()

            for h3 in h3_elements:
                try:
                    # Get title from h3 (usually has an <a> inside)
                    title_link = h3.query_selector("a")
                    if title_link:
                        title = title_link.inner_text().strip()
                        event_url = title_link.get_attribute("href") or EVENTS_URL
                        if not event_url.startswith("http"):
                            event_url = BASE_URL + event_url
                    else:
                        title = h3.inner_text().strip()
                        event_url = EVENTS_URL

                    if not title or len(title) < 3:
                        continue

                    # Skip non-event h3s (navigation, headers, etc.)
                    skip_titles = ["events", "calendar", "home", "tickets", "about",
                                   "contact", "arena info", "parking", "buy tickets"]
                    if title.lower() in skip_titles:
                        continue

                    # Try to find the date in a nearby h4 element
                    # Look at siblings and parent siblings
                    parent = h3.evaluate_handle("el => el.parentElement")
                    date_text = None
                    grandparent_text = ""

                    # Check for h4 in parent container
                    parent_text = parent.evaluate("el => el ? el.innerText : ''") or ""
                    date_text = parse_date(parent_text)

                    # If not found, check grandparent
                    if not date_text:
                        grandparent_text = parent.evaluate("el => el && el.parentElement ? el.parentElement.innerText : ''") or ""
                        date_text = parse_date(grandparent_text)

                    if not date_text:
                        continue

                    # Skip past events
                    try:
                        event_date = datetime.strptime(date_text, "%Y-%m-%d").date()
                        if event_date < datetime.now().date():
                            continue
                    except ValueError:
                        continue

                    # Check for duplicates
                    event_key = f"{title}|{date_text}"
                    if event_key in seen_events:
                        continue
                    seen_events.add(event_key)

                    # Try to find time in parent text
                    start_time = parse_time(parent_text)
                    if not start_time and grandparent_text:
                        start_time = parse_time(grandparent_text)

                    events_found += 1

                    content_hash = generate_content_hash(title, "State Farm Arena", date_text)

                    if find_event_by_hash(content_hash):
                        events_updated += 1
                        continue

                    category, subcategory, tags = determine_category(title)

                    event_record = {
                        "source_id": source_id,
                        "venue_id": venue_id,
                        "title": title,
                        "description": f"{title} at State Farm Arena in downtown Atlanta",
                        "start_date": date_text,
                        "start_time": start_time,
                        "end_date": None,
                        "end_time": None,
                        "is_all_day": False,
                        "category": category,
                        "subcategory": subcategory,
                        "tags": tags,
                        "price_min": None,
                        "price_max": None,
                        "price_note": "Tickets at statefarmarena.com",
                        "is_free": False,
                        "source_url": event_url,
                        "ticket_url": event_url,
                        "image_url": None,
                        "raw_text": f"{title} - {date_text}",
                        "extraction_confidence": 0.90,
                        "is_recurring": False,
                        "recurrence_rule": None,
                        "content_hash": content_hash,
                    }

                    try:
                        insert_event(event_record)
                        events_new += 1
                        logger.info(f"Added: {title} on {date_text}")
                    except Exception as e:
                        logger.error(f"Failed to insert: {title}: {e}")

                except Exception as e:
                    logger.debug(f"Error processing h3 element: {e}")
                    continue

            browser.close()

        logger.info(
            f"State Farm Arena crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl State Farm Arena: {e}")
        raise

    return events_found, events_new, events_updated


def parse_text_events(page, source_id: int, venue_id: int) -> tuple[int, int, int]:
    """Fallback text-based parsing when DOM selectors don't work."""
    events_found = 0
    events_new = 0
    events_updated = 0
    seen_events = set()

    body_text = page.inner_text("body")
    lines = [l.strip() for l in body_text.split("\n") if l.strip()]

    # Look for date patterns and extract titles from previous line
    for i, line in enumerate(lines):
        # Look for date pattern "Sun Feb 1 2026"
        date_match = re.match(
            r"(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})\s+(\d{4})",
            line,
            re.IGNORECASE
        )

        if date_match:
            month, day, year = date_match.groups()
            try:
                dt = datetime.strptime(f"{month} {day} {year}", "%b %d %Y")
                if dt.date() < datetime.now().date():
                    continue
                start_date = dt.strftime("%Y-%m-%d")
            except ValueError:
                continue

            # Title should be on the previous line (event name comes before date)
            title = None
            # Check up to 3 lines before the date for the title
            for offset in range(1, min(4, i + 1)):
                prev_line = lines[i - offset].strip()

                # Skip UI elements and non-title words
                skip_words = ['other', 'all', 'filter', 'upcoming', 'past', 'event starts',
                              'buy tickets', 'more info', 'share', 'sold out', 'parking']
                if prev_line.lower() in skip_words or len(prev_line) < 4:
                    continue

                # Skip date patterns (case insensitive)
                if re.match(r'^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)', prev_line, re.IGNORECASE):
                    continue
                if re.match(r'^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)', prev_line, re.IGNORECASE):
                    continue

                # Skip time patterns
                if re.match(r'^\d{1,2}:\d{2}', prev_line):
                    continue

                # Skip all-caps short strings (likely dates)
                if prev_line.isupper() and len(prev_line) < 20:
                    continue

                # Found valid title
                title = prev_line
                break

            if not title:
                continue

            # Check for duplicates
            event_key = f"{title}|{start_date}"
            if event_key in seen_events:
                continue
            seen_events.add(event_key)

            # Look for time in next few lines
            start_time = None
            for j in range(i + 1, min(i + 4, len(lines))):
                start_time = parse_time(lines[j])
                if start_time:
                    break

            events_found += 1

            content_hash = generate_content_hash(title, "State Farm Arena", start_date)

            if find_event_by_hash(content_hash):
                events_updated += 1
                continue

            category, subcategory, tags = determine_category(title)

            event_record = {
                "source_id": source_id,
                "venue_id": venue_id,
                "title": title,
                "description": f"{title} at State Farm Arena in downtown Atlanta",
                "start_date": start_date,
                "start_time": start_time,
                "end_date": None,
                "end_time": None,
                "is_all_day": False,
                "category": category,
                "subcategory": subcategory,
                "tags": tags,
                "price_min": None,
                "price_max": None,
                "price_note": "Tickets at statefarmarena.com",
                "is_free": False,
                "source_url": EVENTS_URL,
                "ticket_url": EVENTS_URL,
                "image_url": None,
                "raw_text": f"{title} - {start_date}",
                "extraction_confidence": 0.80,
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

    return events_found, events_new, events_updated
