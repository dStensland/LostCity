"""
Crawler for Georgia Chess Association (georgiachess.org).

Chess tournaments and events across Georgia.
Uses Playwright to parse the calendar.
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

BASE_URL = "https://www.georgiachess.org"
EVENTS_URL = f"{BASE_URL}/events"

# Common venue locations for chess events
KNOWN_VENUES = {
    "doubletree by hilton": {
        "name": "DoubleTree by Hilton Roswell",
        "slug": "doubletree-roswell",
        "address": "1075 Holcomb Bridge Road",
        "neighborhood": "Roswell",
        "city": "Roswell",
        "state": "GA",
        "zip": "30076",
        "venue_type": "hotel",
    },
    "chess zone": {
        "name": "Chess Zone",
        "slug": "chess-zone-roswell",
        "address": "2500 Old Alabama Rd Suite 11",
        "neighborhood": "Roswell",
        "city": "Roswell",
        "state": "GA",
        "zip": "30076",
        "venue_type": "community_center",
    },
    "shiloh high school": {
        "name": "Shiloh High School",
        "slug": "shiloh-high-school",
        "address": "4210 Shiloh Rd",
        "neighborhood": "Snellville",
        "city": "Snellville",
        "state": "GA",
        "zip": "30039",
        "venue_type": "school",
    },
    "new life atlanta": {
        "name": "New Life Atlanta",
        "slug": "new-life-atlanta-suwanee",
        "address": "3140 Old Atlanta Rd",
        "neighborhood": "Suwanee",
        "city": "Suwanee",
        "state": "GA",
        "zip": "30024",
        "venue_type": "community_center",
    },
}


def parse_date(date_str: str, year: int) -> Optional[str]:
    """Parse date from various formats."""
    # Try "January 24, 2026" format
    match = re.search(
        r"(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(\d{4})",
        date_str,
        re.IGNORECASE
    )
    if match:
        month, day, yr = match.groups()
        try:
            dt = datetime.strptime(f"{month} {day} {yr}", "%B %d %Y")
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            pass

    # Try "Jan 24" format (use provided year)
    match = re.search(
        r"(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})",
        date_str,
        re.IGNORECASE
    )
    if match:
        month, day = match.groups()
        try:
            dt = datetime.strptime(f"{month} {day} {year}", "%b %d %Y")
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            pass

    return None


def find_venue_for_location(location: str) -> Optional[dict]:
    """Try to match location text to a known venue."""
    location_lower = location.lower()
    for key, venue_data in KNOWN_VENUES.items():
        if key in location_lower:
            return venue_data
    return None


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Georgia Chess Association events."""
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

            logger.info(f"Fetching Georgia Chess: {EVENTS_URL}")
            page.goto(EVENTS_URL, wait_until="networkidle", timeout=30000)
            page.wait_for_timeout(2000)

            # Extract images from page
            image_map = extract_images_from_page(page)

            # Get current year from page or use current year
            current_year = datetime.now().year

            # Find all event links in the calendar
            # Events are typically in anchor tags with event info
            event_elements = page.query_selector_all("a[href*='/event/'], a[href*='events/'], .event-item, [class*='event']")

            # Also try to get events from the calendar grid
            calendar_cells = page.query_selector_all("td.has-event, td a, .calendar-event")

            # Combine and dedupe
            all_elements = list(event_elements) + list(calendar_cells)

            seen_events = set()

            for element in all_elements:
                try:
                    # Get element text and href
                    text = element.inner_text().strip()
                    href = element.get_attribute("href") or ""

                    if not text or len(text) < 5:
                        continue

                    # Skip navigation items
                    if text.lower() in ["previous", "next", "today", "month", "week", "list"]:
                        continue

                    # Try to extract title from the text
                    lines = [l.strip() for l in text.split("\n") if l.strip()]
                    if not lines:
                        continue

                    title = lines[0]

                    # Skip if we've seen this title
                    if title in seen_events:
                        continue

                    # Skip titles that are just dates/months
                    if re.match(r"^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}$", title, re.IGNORECASE):
                        continue
                    if re.match(r"^\d{1,2}$", title):
                        continue

                    seen_events.add(title)

                    # Try to get title attribute for more info
                    title_attr = element.get_attribute("title") or ""

                    # Parse date from text or title attribute
                    combined_text = f"{text} {title_attr}"
                    start_date = parse_date(combined_text, current_year)

                    if not start_date:
                        # Try to get date from parent cell if in a calendar
                        try:
                            parent_cell = element.evaluate_handle("el => el.closest('td')")
                            if parent_cell:
                                cell_date = parent_cell.get_attribute("data-date")
                                if cell_date:
                                    start_date = cell_date
                        except:
                            pass

                    if not start_date:
                        continue

                    # Skip past events
                    if start_date < datetime.now().strftime("%Y-%m-%d"):
                        continue

                    # Extract location if available
                    location = ""
                    for line in lines[1:]:
                        if any(x in line.lower() for x in ["roswell", "atlanta", "marietta", "suwanee", "snellville", "ga", "georgia"]):
                            location = line
                            break

                    # Determine if this is a scholastic event
                    is_scholastic = any(x in title.lower() for x in ["scholastic", "k-12", "k-8", "k-5", "youth", "junior"])

                    events_found += 1

                    content_hash = generate_content_hash(title, "Georgia Chess", start_date)

                    if find_event_by_hash(content_hash):
                        events_updated += 1
                        continue

                    # Try to match venue
                    venue_id = None
                    venue_data = find_venue_for_location(location) or find_venue_for_location(title)
                    if venue_data:
                        venue_id = get_or_create_venue(venue_data)

                    # Build event URL
                    event_url = href if href.startswith("http") else f"{BASE_URL}{href}" if href else EVENTS_URL

                    event_record = {
                        "source_id": source_id,
                        "venue_id": venue_id,
                        "title": title,
                        "description": f"{title} - USCF rated chess tournament organized by the Georgia Chess Association. " +
                                      ("Open to K-12 students." if is_scholastic else "Open to all players."),
                        "start_date": start_date,
                        "start_time": "09:00" if is_scholastic else "10:00",  # Default times
                        "end_date": None,
                        "end_time": None,
                        "is_all_day": False,
                        "category": "community",
                        "subcategory": "gaming",
                        "tags": [
                            "chess",
                            "tournament",
                            "uscf",
                            "georgia-chess",
                        ] + (["scholastic", "youth"] if is_scholastic else ["open"]),
                        "price_min": None,
                        "price_max": None,
                        "price_note": "Registration required",
                        "is_free": False,
                        "source_url": event_url,
                        "ticket_url": event_url,
                        "image_url": image_map.get(title),
                        "raw_text": f"{title} - {location}" if location else title,
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

                except Exception as e:
                    logger.debug(f"Error parsing event element: {e}")
                    continue

            # Also try to get events from the page body text as fallback
            body_text = page.inner_text("body")

            # Look for event patterns in the text
            event_patterns = re.findall(
                r"([A-Z][^\n]{10,80})\n.*?(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(\d{4})",
                body_text,
                re.MULTILINE
            )

            for match in event_patterns:
                title = match[0].strip()
                month, day, year = match[1], match[2], match[3]

                # Skip if already seen
                if title in seen_events:
                    continue

                try:
                    dt = datetime.strptime(f"{month} {day} {year}", "%B %d %Y")
                    start_date = dt.strftime("%Y-%m-%d")
                except ValueError:
                    continue

                if start_date < datetime.now().strftime("%Y-%m-%d"):
                    continue

                seen_events.add(title)
                events_found += 1

                content_hash = generate_content_hash(title, "Georgia Chess", start_date)

                if find_event_by_hash(content_hash):
                    events_updated += 1
                    continue

                is_scholastic = any(x in title.lower() for x in ["scholastic", "k-12", "k-8", "k-5", "youth", "junior"])

                event_record = {
                    "source_id": source_id,
                    "venue_id": None,
                    "title": title,
                    "description": f"{title} - USCF rated chess tournament organized by the Georgia Chess Association.",
                    "start_date": start_date,
                    "start_time": "09:00" if is_scholastic else "10:00",
                    "end_date": None,
                    "end_time": None,
                    "is_all_day": False,
                    "category": "community",
                    "subcategory": "gaming",
                    "tags": ["chess", "tournament", "uscf", "georgia-chess"],
                    "price_min": None,
                    "price_max": None,
                    "price_note": "Registration required",
                    "is_free": False,
                    "source_url": EVENTS_URL,
                    "ticket_url": EVENTS_URL,
                    "image_url": image_map.get(title),
                    "raw_text": title,
                    "extraction_confidence": 0.75,
                    "is_recurring": False,
                    "recurrence_rule": None,
                    "content_hash": content_hash,
                }

                try:
                    insert_event(event_record)
                    events_new += 1
                    logger.info(f"Added (from text): {title} on {start_date}")
                except Exception as e:
                    logger.error(f"Failed to insert: {title}: {e}")

            browser.close()

        logger.info(
            f"Georgia Chess crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Georgia Chess: {e}")
        raise

    return events_found, events_new, events_updated
