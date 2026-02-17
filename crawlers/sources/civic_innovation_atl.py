"""
Crawler for Center for Civic Innovation (civicatlanta.org/events).

CCI hosts town halls, candidate forums, panel discussions, Civics 101 workshops,
and policy forums focused on local governance and civic engagement in Atlanta.

Location: 104 Trinity Ave SW, Atlanta, GA 30303 (Downtown)

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

BASE_URL = "https://civicatlanta.org"
EVENTS_URL = f"{BASE_URL}/events"

VENUE_DATA = {
    "name": "Center for Civic Innovation",
    "slug": "center-civic-innovation",
    "address": "104 Trinity Ave SW",
    "neighborhood": "Downtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30303",
    "lat": 33.7490,
    "lng": -84.3920,
    "venue_type": "community_center",
    "spot_type": "community_center",
    "website": BASE_URL,
    "description": "Civic engagement hub fostering public dialogue on Atlanta issues.",
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
    """Crawl Center for Civic Innovation events using Playwright."""
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

            logger.info(f"Fetching CCI events: {EVENTS_URL}")

            try:
                page.goto(EVENTS_URL, wait_until="networkidle", timeout=30000)
                page.wait_for_timeout(2000)  # Let dynamic content load
            except PlaywrightTimeout:
                logger.warning("Timeout loading events page")
                browser.close()
                return events_found, events_new, events_updated

            # Squarespace uses .summary-item with record-type-event for calendar items
            event_items = page.query_selector_all('.summary-item-record-type-event, .eventlist-event, article[class*="event"]')

            if not event_items:
                logger.warning("No events found on events page")
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
                        description = f"{title} - Center for Civic Innovation event"

                    # Extract image from Squarespace thumbnail
                    img_elem = item.query_selector('img.summary-thumbnail-image, img')
                    image_url = None
                    if img_elem:
                        image_url = img_elem.get_attribute('src') or img_elem.get_attribute('data-src')
                        if image_url and not image_url.startswith('http'):
                            image_url = f"https:{image_url}" if image_url.startswith('//') else None

                    # Categorize based on title/description
                    text_lower = f"{title} {description}".lower()
                    tags = ["civic-engagement", "community", "cci"]

                    if any(kw in text_lower for kw in ["town hall", "forum", "panel"]):
                        tags.append("town-hall")
                    if any(kw in text_lower for kw in ["workshop", "training", "101"]):
                        tags.append("education")
                    if any(kw in text_lower for kw in ["candidate", "election"]):
                        tags.append("voter-education")
                    if any(kw in text_lower for kw in ["policy", "advocacy"]):
                        tags.append("advocacy")

                    # Most CCI events are free
                    is_free = True

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
                        "image_url": image_url,
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
            f"CCI crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Center for Civic Innovation: {e}")
        raise

    return events_found, events_new, events_updated
