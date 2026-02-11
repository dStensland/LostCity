"""
Crawler for Concrete Jungle (concrete-jungle.org).

Fruit gleaning nonprofit that picks fruit from trees around Atlanta and
donates to food banks. Very Atlanta-specific, beloved local org.

STATUS: BROKEN — Site uses an Airtable embed iframe for their volunteer
calendar (https://airtable.com/embed/shrLr48ircCprxRSF). Standard DOM
selectors cannot reach into the iframe. Needs Airtable API integration
or Playwright iframe handling to fix.
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

BASE_URL = "https://www.concrete-jungle.org"
VOLUNTEER_URL = f"{BASE_URL}/volunteer/atlanta"

VENUE_DATA = {
    "name": "Concrete Jungle",
    "slug": "concrete-jungle",
    "address": "1080 Euclid Ave NE",
    "neighborhood": "Little Five Points",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30307",
    "lat": 33.7630,
    "lng": -84.3480,
    "venue_type": "nonprofit_hq",
    "spot_type": "nonprofit_hq",
    "website": BASE_URL,
    "vibes": ["outdoor-seating", "casual"],
}


def parse_date_string(date_str: str) -> Optional[str]:
    """
    Parse various date formats from Concrete Jungle calendar.
    Examples: 'February 15, 2026', 'Feb 15', 'Saturday, Feb 15'
    """
    try:
        date_str = date_str.strip()

        # Remove day name if present
        date_str = re.sub(r'^[A-Za-z]+,?\s+', '', date_str)

        current_year = datetime.now().year

        # Try "Month DD, YYYY" format
        match = re.search(r'([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})', date_str)
        if match:
            month, day, year = match.groups()
            try:
                dt = datetime.strptime(f"{month} {day} {year}", "%B %d %Y")
            except ValueError:
                dt = datetime.strptime(f"{month} {day} {year}", "%b %d %Y")
            return dt.strftime("%Y-%m-%d")

        # Try "Month DD" format (no year)
        match = re.search(r'([A-Za-z]+)\s+(\d{1,2})', date_str)
        if match:
            month, day = match.groups()
            try:
                dt = datetime.strptime(f"{month} {day} {current_year}", "%B %d %Y")
            except ValueError:
                dt = datetime.strptime(f"{month} {day} {current_year}", "%b %d %Y")

            # If date is in the past, assume next year
            if dt.date() < datetime.now().date():
                dt = dt.replace(year=current_year + 1)

            return dt.strftime("%Y-%m-%d")

    except (ValueError, AttributeError) as e:
        logger.debug(f"Could not parse date '{date_str}': {e}")

    return None


def parse_time_string(time_str: str) -> Optional[str]:
    """
    Parse time string to 24-hour format.
    Examples: '9:00 AM', '2:30 PM', '9am', '2:30pm'
    """
    try:
        time_str = time_str.strip().upper()

        # Pattern: H:MM AM/PM or H AM/PM
        match = re.search(r'(\d{1,2})(?::(\d{2}))?\s*(AM|PM)', time_str)
        if match:
            hour = int(match.group(1))
            minute = match.group(2) or "00"
            period = match.group(3)

            if period == "PM" and hour != 12:
                hour += 12
            elif period == "AM" and hour == 12:
                hour = 0

            return f"{hour:02d}:{minute}"

    except (ValueError, AttributeError) as e:
        logger.debug(f"Could not parse time '{time_str}': {e}")

    return None


def determine_category(title: str, description: str = "") -> tuple[str, Optional[str], list[str]]:
    """Determine event category based on title and description."""
    text = f"{title} {description}".lower()

    # Base tags
    tags = ["volunteer", "food", "concrete-jungle"]

    # Most Concrete Jungle events are gleaning/picking fruit
    if any(word in text for word in ["pick", "glean", "harvest", "fruit", "tree", "orchard", "farm"]):
        tags.extend(["outdoors", "gleaning"])
        return "community", "volunteer", tags

    # Educational events
    if any(word in text for word in ["workshop", "class", "training", "learn", "education"]):
        tags.append("education")
        return "learning", "workshop", tags

    # Community events
    if any(word in text for word in ["volunteer", "community", "orientation"]):
        return "community", "volunteer", tags

    # Default to community volunteer
    return "community", "volunteer", tags


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl Concrete Jungle volunteer events using Playwright.

    The site has an embedded calendar on the volunteer page.
    """
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                viewport={"width": 1920, "height": 1080},
            )
            page = context.new_page()

            venue_id = get_or_create_venue(VENUE_DATA)

            logger.info(f"Fetching Concrete Jungle volunteer page: {VOLUNTEER_URL}")
            page.goto(VOLUNTEER_URL, wait_until="domcontentloaded", timeout=30000)

            # Wait for calendar to load (it's embedded via iframe or JS)
            page.wait_for_timeout(5000)

            # Scroll to load content
            for _ in range(3):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1000)

            # Try to find calendar events - various selectors for common calendar systems
            event_selectors = [
                ".event",
                ".calendar-event",
                "[class*='event']",
                ".fc-event",  # FullCalendar
                ".tribe-events-list-event",  # The Events Calendar
                "[data-event]",
                ".volunteer-event",
                ".opportunity",
            ]

            events = None
            for selector in event_selectors:
                events = page.query_selector_all(selector)
                if events and len(events) > 2:  # Need more than 2 to be legitimate
                    logger.info(f"Found {len(events)} events using selector: {selector}")
                    break

            if not events or len(events) < 1:
                logger.warning("No calendar events found on page, trying iframe approach")

                # Check for iframes (they might embed a calendar)
                iframes = page.query_selector_all("iframe")
                logger.info(f"Found {len(iframes)} iframes")

                for iframe in iframes:
                    try:
                        frame = iframe.content_frame()
                        if frame:
                            # Try to find events in the iframe
                            for selector in event_selectors:
                                events = frame.query_selector_all(selector)
                                if events and len(events) > 2:
                                    logger.info(f"Found {len(events)} events in iframe using selector: {selector}")
                                    page = frame  # Switch context to iframe
                                    break
                            if events and len(events) > 2:
                                break
                    except Exception as e:
                        logger.debug(f"Could not access iframe: {e}")
                        continue

            if not events or len(events) < 1:
                logger.warning("No events found via any method")
                # Log page structure for debugging
                body_text = page.inner_text("body")
                logger.debug(f"Page text preview: {body_text[:1000]}")
                browser.close()
                return 0, 0, 0

            # Parse events
            for event_elem in events:
                try:
                    event_text = event_elem.inner_text()

                    # Extract title
                    title_elem = event_elem.query_selector("h1, h2, h3, h4, .title, [class*='title']")
                    if title_elem:
                        title = title_elem.inner_text().strip()
                    else:
                        # Fallback: first line
                        lines = [l.strip() for l in event_text.split("\n") if l.strip()]
                        title = lines[0] if lines else None

                    if not title or len(title) < 3:
                        continue

                    # Look for date and time
                    date_str = None
                    time_str = None

                    # Try to find date elements
                    date_elem = event_elem.query_selector(".date, [class*='date'], time")
                    if date_elem:
                        date_str = date_elem.inner_text().strip()

                    # Try to find time elements
                    time_elem = event_elem.query_selector(".time, [class*='time']")
                    if time_elem:
                        time_str = time_elem.inner_text().strip()

                    # If not found in elements, search in text
                    if not date_str:
                        date_match = re.search(r'([A-Za-z]+\s+\d{1,2}(?:,\s+\d{4})?)', event_text)
                        if date_match:
                            date_str = date_match.group(1)

                    if not time_str:
                        time_match = re.search(r'(\d{1,2}(?::\d{2})?\s*[AP]M)', event_text, re.IGNORECASE)
                        if time_match:
                            time_str = time_match.group(1)

                    # Parse dates and times
                    start_date = parse_date_string(date_str) if date_str else None
                    start_time = parse_time_string(time_str) if time_str else None

                    if not start_date:
                        logger.debug(f"No valid date found for: {title}")
                        continue

                    # Skip past events
                    try:
                        if datetime.strptime(start_date, "%Y-%m-%d").date() < datetime.now().date():
                            continue
                    except ValueError:
                        pass

                    # Extract description
                    description = ""
                    desc_elem = event_elem.query_selector(".description, .excerpt, p")
                    if desc_elem:
                        description = desc_elem.inner_text().strip()

                    if not description:
                        description = f"Volunteer opportunity with Concrete Jungle: {title}"

                    events_found += 1

                    category, subcategory, tags = determine_category(title, description)

                    content_hash = generate_content_hash(title, "Concrete Jungle", start_date)

                    if find_event_by_hash(content_hash):
                        events_updated += 1
                        continue

                    # Look for event URL
                    link_elem = event_elem.query_selector("a[href]")
                    event_url = VOLUNTEER_URL
                    if link_elem:
                        href = link_elem.get_attribute("href")
                        if href:
                            if href.startswith("http"):
                                event_url = href
                            elif href.startswith("/"):
                                event_url = BASE_URL + href

                    event_record = {
                        "source_id": source_id,
                        "venue_id": venue_id,
                        "title": title,
                        "description": description[:1000] if description else None,
                        "start_date": start_date,
                        "start_time": start_time,
                        "end_date": None,
                        "end_time": None,
                        "is_all_day": False,
                        "category": category,
                        "subcategory": subcategory,
                        "tags": tags,
                        "price_min": 0,
                        "price_max": 0,
                        "price_note": "Free volunteer event",
                        "is_free": True,
                        "source_url": event_url,
                        "ticket_url": event_url,
                        "image_url": None,
                        "raw_text": event_text[:500],
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
                    logger.warning(f"Error parsing event element: {e}")
                    continue

            browser.close()

        logger.info(
            f"Concrete Jungle crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except PlaywrightTimeout as e:
        logger.error(f"Timeout fetching Concrete Jungle: {e}")
        raise
    except Exception as e:
        logger.error(f"Failed to crawl Concrete Jungle: {e}")
        raise

    return events_found, events_new, events_updated
