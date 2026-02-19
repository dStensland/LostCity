"""
Crawler for League of Women Voters of Atlanta-Fulton County (lwvaf.org/calendar).

The LWV hosts voter education events, candidate forums, public meetings,
advocacy training, and community engagement events across metro Atlanta.

Site uses Squarespace CMS - requires JavaScript rendering with Playwright.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime
from typing import Optional

from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout

from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://lwvaf.org"
CALENDAR_URL = f"{BASE_URL}/calendar"

VENUE_DATA = {
    "name": "League of Women Voters of Atlanta-Fulton County",
    "slug": "lwv-atlanta-fulton",
    "address": "1100 Peachtree St NE, Suite 200",
    "neighborhood": "Midtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30309",
    "lat": 33.7849,
    "lng": -84.3833,
    "venue_type": "organization",
    "spot_type": "nonprofit",
    "website": BASE_URL,
    "description": "Nonpartisan political organization encouraging informed participation in government.",
}


def parse_date_time(date_str: str, time_str: str = None) -> tuple[Optional[str], Optional[str]]:
    """
    Parse date and time from Squarespace event format.

    Examples:
    - "February 18, 2026" + "6:00 PM"
    - "Mar 15" + "7:00 PM - 9:00 PM"
    """
    if not date_str:
        return None, None

    current_year = datetime.now().year
    start_date = None
    start_time = None

    # Clean up date string
    date_str = date_str.strip()

    # Try various date formats
    for fmt in ["%B %d, %Y", "%B %d", "%b %d, %Y", "%b %d", "%Y-%m-%d"]:
        try:
            dt = datetime.strptime(date_str, fmt)
            # If no year provided, use current or next year
            if fmt in ["%B %d", "%b %d"]:
                dt = dt.replace(year=current_year)
                if dt.date() < datetime.now().date():
                    dt = dt.replace(year=current_year + 1)
            start_date = dt.strftime("%Y-%m-%d")
            break
        except ValueError:
            continue

    # Parse time if provided
    if time_str:
        time_str = time_str.strip()
        # Extract first time from range like "7:00 PM - 9:00 PM"
        time_match = re.search(r'(\d{1,2}):(\d{2})\s*(AM|PM)', time_str, re.IGNORECASE)
        if time_match:
            hour = int(time_match.group(1))
            minute = time_match.group(2)
            period = time_match.group(3).upper()

            if period == "PM" and hour != 12:
                hour += 12
            elif period == "AM" and hour == 12:
                hour = 0

            start_time = f"{hour:02d}:{minute}"

    return start_date, start_time


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl League of Women Voters Atlanta events using Playwright."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        venue_id = get_or_create_venue(VENUE_DATA)

        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
            )
            page = context.new_page()

            logger.info(f"Fetching LWV Atlanta calendar: {CALENDAR_URL}")

            try:
                page.goto(CALENDAR_URL, wait_until="networkidle", timeout=30000)
                page.wait_for_timeout(2000)  # Let dynamic content load
            except PlaywrightTimeout:
                logger.warning("Timeout loading calendar page")
                browser.close()
                return events_found, events_new, events_updated

            # Squarespace uses .summary-item with record-type-event for calendar items
            event_items = page.query_selector_all('.summary-item-record-type-event, .eventlist-event, article[class*="event"]')

            if not event_items:
                logger.warning("No events found on calendar page")
                browser.close()
                return events_found, events_new, events_updated

            logger.info(f"Found {len(event_items)} potential events")

            seen_events = set()
            today = datetime.now().date()

            for item in event_items:
                try:
                    # Extract title from link
                    title_elem = item.query_selector('h1, h2, h3, h4, .summary-title, a.summary-title-link')
                    if not title_elem:
                        continue

                    title = title_elem.text_content().strip()
                    if not title or len(title) < 5:
                        continue

                    # Get event URL
                    link_elem = item.query_selector('a')
                    event_url = BASE_URL
                    if link_elem:
                        href = link_elem.get_attribute('href')
                        if href:
                            event_url = href if href.startswith('http') else f"{BASE_URL}{href}"

                    # Extract date from Squarespace event date structure
                    month_elem = item.query_selector('.summary-thumbnail-event-date-month')
                    day_elem = item.query_selector('.summary-thumbnail-event-date-day')

                    date_text = None
                    if month_elem and day_elem:
                        month = month_elem.text_content().strip()
                        day = day_elem.text_content().strip()
                        date_text = f"{month} {day}"

                    # Fallback to other date selectors
                    if not date_text:
                        date_elem = item.query_selector('time, .event-date')
                        if date_elem:
                            date_text = date_elem.get_attribute('datetime') or date_elem.text_content().strip()

                    # Extract time from excerpt or HTML
                    time_text = None
                    item_html = item.inner_html()
                    time_match = re.search(r'(\d{1,2}:\d{2}\s*[AP]M)', item_html, re.IGNORECASE)
                    if time_match:
                        time_text = time_match.group(1)

                    start_date, start_time = parse_date_time(date_text, time_text)

                    if not start_date:
                        logger.debug(f"Could not parse date for: {title}")
                        continue

                    # Skip past events
                    try:
                        event_date = datetime.strptime(start_date, "%Y-%m-%d").date()
                        if event_date < today:
                            continue
                    except ValueError:
                        continue

                    # Dedupe check
                    event_key = f"{title}|{start_date}"
                    if event_key in seen_events:
                        continue
                    seen_events.add(event_key)

                    events_found += 1

                    # Extract description from Squarespace excerpt
                    desc_elem = item.query_selector('.summary-excerpt, .summary-content, .event-description, p')
                    description = None
                    if desc_elem:
                        description = desc_elem.text_content().strip()
                        # Remove the date line if it's at the start
                        description = re.sub(r'^[A-Z][a-z]+day,\s+\w+\s+\d{1,2},\s+\d{4}\s*', '', description)
                        if len(description) > 500:
                            description = description[:497] + "..."

                    if not description or len(description) < 20:
                        description = f"{title} - League of Women Voters event"

                    # Categorize based on title/description
                    text_lower = f"{title} {description}".lower()
                    tags = ["civic-engagement", "voter-education", "lwv"]

                    if any(kw in text_lower for kw in ["forum", "candidate", "debate"]):
                        tags.append("town-hall")
                    if any(kw in text_lower for kw in ["voter", "registration", "vote"]):
                        tags.append("voter-registration")
                    if any(kw in text_lower for kw in ["advocacy", "lobby"]):
                        tags.append("advocacy")

                    # Default to unknown cost
                    is_free = False

                    # Generate content hash
                    content_hash = generate_content_hash(title, VENUE_DATA["name"], start_date)

                    # Build event record
                    event_record = {
                        "source_id": source_id,
                        "venue_id": venue_id,
                        "title": title[:200],
                        "description": description[:1000] if description else None,
                        "start_date": start_date,
                        "start_time": start_time,
                        "end_date": None,
                        "end_time": None,
                        "is_all_day": False,
                        "category": "community",
                        "tags": tags,
                        "price_min": None,
                        "price_max": None,
                        "price_note": None,
                        "is_free": is_free,
                        "source_url": event_url,
                        "ticket_url": event_url,
                        "image_url": None,
                        "raw_text": f"{title} {description or ''}"[:500],
                        "extraction_confidence": 0.85,
                        "is_recurring": False,
                        "recurrence_rule": None,
                        "content_hash": content_hash,
                    }

                    # Check for existing event
                    existing = find_event_by_hash(content_hash)
                    if existing:
                        smart_update_existing_event(existing, event_record)
                        events_updated += 1
                        continue

                    try:
                        insert_event(event_record)
                        events_new += 1
                        logger.info(f"Added: {title} on {start_date}")
                    except Exception as e:
                        logger.error(f"Failed to insert event '{title}': {e}")

                except Exception as e:
                    logger.debug(f"Error processing event item: {e}")
                    continue

            browser.close()

        logger.info(
            f"LWV Atlanta crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl LWV Atlanta: {e}")
        raise

    return events_found, events_new, events_updated
