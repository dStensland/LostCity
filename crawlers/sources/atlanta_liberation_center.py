"""
Crawler for Atlanta Liberation Center (liberationatl.org/events).
Community organizing, mutual aid, and grassroots activism space.
Uses JavaScript calendar - requires Playwright.
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

BASE_URL = "https://www.liberationatl.org"
EVENTS_URL = f"{BASE_URL}/events"

VENUE_DATA = {
    "name": "Atlanta Liberation Center",
    "slug": "atlanta-liberation-center",
    "address": "344 Candler Park Dr NE",
    "neighborhood": "Candler Park",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30307",
    "lat": 33.7621,
    "lng": -84.3428,
    "venue_type": "community_center",
    "spot_type": "nonprofit",
    "website": BASE_URL,
}


def parse_date_range(date_text: str) -> tuple[Optional[str], Optional[str]]:
    """
    Parse date or date range from various formats.

    Examples:
    - "February 21, 2026"
    - "Monday, February 21, 2026"
    - "Feb 21 - Feb 23, 2026"
    """
    current_year = datetime.now().year

    # Single date with optional day of week
    match = re.match(
        r"(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)?[,\s]*(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2}),?\s+(\d{4})",
        date_text,
        re.IGNORECASE
    )
    if match:
        try:
            month_name = match.group(1)
            day = match.group(2)
            year = match.group(3)
            if len(month_name) > 3:
                dt = datetime.strptime(f"{month_name} {day} {year}", "%B %d %Y")
            else:
                dt = datetime.strptime(f"{month_name} {day} {year}", "%b %d %Y")
            return dt.strftime("%Y-%m-%d"), None
        except ValueError:
            pass

    # Date without year
    match = re.match(
        r"(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)?[,\s]*(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})",
        date_text,
        re.IGNORECASE
    )
    if match:
        try:
            month_name = match.group(1)
            day = match.group(2)
            if len(month_name) > 3:
                dt = datetime.strptime(f"{month_name} {day} {current_year}", "%B %d %Y")
            else:
                dt = datetime.strptime(f"{month_name} {day} {current_year}", "%b %d %Y")

            # If date is in the past, assume next year
            if dt.date() < datetime.now().date():
                dt = dt.replace(year=current_year + 1)

            return dt.strftime("%Y-%m-%d"), None
        except ValueError:
            pass

    return None, None


def parse_time(time_text: str) -> Optional[str]:
    """Parse time from '10:00 AM' or similar format."""
    match = re.search(r"(\d{1,2}):(\d{2})\s*(am|pm)", time_text, re.IGNORECASE)
    if match:
        hour = int(match.group(1))
        minute = match.group(2)
        period = match.group(3).lower()

        if period == "pm" and hour != 12:
            hour += 12
        elif period == "am" and hour == 12:
            hour = 0

        return f"{hour:02d}:{minute}"

    return None


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Atlanta Liberation Center events using Playwright."""
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

            logger.info(f"Fetching Atlanta Liberation Center events: {EVENTS_URL}")

            # Navigate to events page
            page.goto(EVENTS_URL, wait_until="domcontentloaded", timeout=60000)
            page.wait_for_timeout(3000)

            # Wait for events to load
            try:
                page.wait_for_selector(".event, .event-item, [class*='event'], [class*='calendar']", timeout=10000)
            except Exception:
                logger.warning("Could not find event selectors, continuing anyway")

            # Extract images
            image_map = extract_images_from_page(page)

            # Extract event links for specific URLs
            event_links = extract_event_links(page, BASE_URL)

            # Scroll to load all events (handle lazy loading)
            for _ in range(3):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1500)

                # Try to click "Load More" button if present
                try:
                    load_more = page.query_selector("button:has-text('Load More'), button:has-text('Show More'), a:has-text('More Events')")
                    if load_more and load_more.is_visible():
                        load_more.click()
                        page.wait_for_timeout(2000)
                except Exception:
                    pass

            # Find event links - common patterns for event pages
            event_links = page.query_selector_all('a[href*="/event"], a[href*="/events/"]')

            # Filter to unique event pages
            unique_events = {}
            for link in event_links:
                href = link.get_attribute('href') or ''
                text = link.inner_text().strip()

                # Skip navigation links and empty text
                if not text or len(text) < 3:
                    continue
                if href == '/events' or href == '/events/' or href == EVENTS_URL:
                    continue

                # Normalize URL
                if href.startswith('/'):
                    href = BASE_URL + href
                elif not href.startswith('http'):
                    continue

                # Dedupe by URL
                if href not in unique_events:
                    unique_events[href] = text

            logger.info(f"Found {len(unique_events)} unique event links")

            # If no event links found, try to parse events directly from the page
            if not unique_events:
                logger.info("No event links found, trying to parse events from main page")

                # Look for event containers on the page
                event_containers = page.query_selector_all('.event, .event-item, [class*="event-"]')

                for container in event_containers:
                    try:
                        title = container.query_selector('h2, h3, h4, .title, .event-title')
                        if not title:
                            continue

                        title_text = title.inner_text().strip()

                        # Find date
                        date_elem = container.query_selector('.date, .event-date, time, [class*="date"]')
                        if not date_elem:
                            continue

                        date_text = date_elem.inner_text().strip()
                        start_date, end_date = parse_date_range(date_text)

                        if not start_date:
                            continue

                        events_found += 1

                        # Find time
                        time_elem = container.query_selector('.time, .event-time, [class*="time"]')
                        time_text = time_elem.inner_text().strip() if time_elem else ""
                        start_time = parse_time(time_text) if time_text else None

                        # Find description
                        desc_elem = container.query_selector('.description, .event-description, p')
                        description = desc_elem.inner_text().strip() if desc_elem else ""
                        if len(description) > 500:
                            description = description[:497] + "..."

                        if not description:
                            description = f"{title_text} at Atlanta Liberation Center"

                        # Generate content hash
                        content_hash = generate_content_hash(title_text, VENUE_DATA["name"], start_date)

                        # Check if exists
                        if find_event_by_hash(content_hash):
                            events_updated += 1
                            continue

                        # Build event record
                        # Get specific event URL

                        event_url = find_event_url(title, event_links, EVENTS_URL)


                        event_record = {
                            "source_id": source_id,
                            "venue_id": venue_id,
                            "title": title_text,
                            "description": description,
                            "start_date": start_date,
                            "start_time": start_time,
                            "end_date": end_date,
                            "end_time": None,
                            "is_all_day": False,
                            "category": "activism",
                            "subcategory": None,
                            "tags": ["activism", "organizing", "mutual-aid", "grassroots"],
                            "price_min": None,
                            "price_max": None,
                            "price_note": None,
                            "is_free": True,
                            "source_url": event_url,
                            "ticket_url": event_url if event_url != (EVENTS_URL if "EVENTS_URL" in dir() else BASE_URL) else None,
                            "image_url": image_map.get(title_text),
                            "raw_text": f"{title_text} - {start_date}",
                            "extraction_confidence": 0.80,
                            "is_recurring": False,
                            "recurrence_rule": None,
                            "content_hash": content_hash,
                        }

                        try:
                            insert_event(event_record)
                            events_new += 1
                            logger.info(f"Added: {title_text} on {start_date}")
                        except Exception as e:
                            logger.error(f"Failed to insert event '{title_text}': {e}")

                    except Exception as e:
                        logger.debug(f"Error processing event container: {e}")
                        continue

            else:
                # Visit individual event pages
                for event_url, title in unique_events.items():
                    try:
                        # Visit individual event page to get details
                        page.goto(event_url, wait_until='domcontentloaded', timeout=30000)
                        page.wait_for_timeout(1000)

                        # Find date
                        date_elem = page.query_selector(
                            ".event-date, .date, [class*='date'], time, .event-meta"
                        )

                        date_text = ""
                        if date_elem:
                            date_text = date_elem.inner_text().strip()
                            # Also check for datetime attribute
                            datetime_attr = date_elem.get_attribute("datetime")
                            if datetime_attr:
                                date_text = datetime_attr

                        start_date, end_date = parse_date_range(date_text)

                        if not start_date:
                            # Try to find date in page text
                            page_text = page.inner_text('body')
                            for line in page_text.split("\n"):
                                start_date, end_date = parse_date_range(line.strip())
                                if start_date:
                                    break

                        if not start_date:
                            logger.debug(f"No date found for: {title}")
                            continue

                        events_found += 1

                        # Find time
                        time_elem = page.query_selector(
                            ".time, .event-time, [class*='time']"
                        )
                        time_text = time_elem.inner_text().strip() if time_elem else ""
                        start_time = parse_time(time_text) if time_text else None

                        # Find description
                        desc_elem = page.query_selector(
                            ".event-description, .description, .content, article p"
                        )
                        description = desc_elem.inner_text().strip() if desc_elem else ""
                        if len(description) > 500:
                            description = description[:497] + "..."

                        if not description:
                            description = f"{title} at Atlanta Liberation Center"

                        # Generate content hash
                        content_hash = generate_content_hash(title, VENUE_DATA["name"], start_date)

                        # Check if exists
                        if find_event_by_hash(content_hash):
                            events_updated += 1
                            continue

                        # Build event record
                        # Get specific event URL

                        event_url = find_event_url(title, event_links, EVENTS_URL)


                        event_record = {
                            "source_id": source_id,
                            "venue_id": venue_id,
                            "title": title,
                            "description": description,
                            "start_date": start_date,
                            "start_time": start_time,
                            "end_date": end_date,
                            "end_time": None,
                            "is_all_day": False,
                            "category": "activism",
                            "subcategory": None,
                            "tags": ["activism", "organizing", "mutual-aid", "grassroots"],
                            "price_min": None,
                            "price_max": None,
                            "price_note": None,
                            "is_free": True,
                            "source_url": event_url,
                            "ticket_url": event_url,
                            "image_url": image_map.get(title),
                            "raw_text": f"{title} - {start_date}",
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
                            logger.error(f"Failed to insert event '{title}': {e}")

                    except Exception as e:
                        logger.debug(f"Error parsing event: {e}")
                        continue

            browser.close()

        logger.info(
            f"Atlanta Liberation Center crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Atlanta Liberation Center: {e}")
        raise

    return events_found, events_new, events_updated
