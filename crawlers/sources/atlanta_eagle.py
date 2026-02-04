"""
Crawler for Atlanta Eagle (atlantaeagle.com).

Historic LGBTQ+ leather bar with events, drink specials, and themed nights.
Site uses The Events Calendar WordPress plugin (tribe-events) with JSON-LD.
"""

from __future__ import annotations

import html
import json
import logging
import re
from datetime import datetime
from typing import Optional
from zoneinfo import ZoneInfo

from playwright.sync_api import sync_playwright

from db import get_or_create_venue, insert_event, find_event_by_hash, remove_stale_source_events
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://www.atlantaeagle.com"
EVENTS_URL = f"{BASE_URL}/events"

VENUE_DATA = {
    "name": "Atlanta Eagle",
    "slug": "atlanta-eagle",
    "address": "306 Ponce De Leon Ave NE",
    "neighborhood": "Midtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30308",
    "lat": 33.7731,
    "lng": -84.3725,
    "venue_type": "bar",
    "spot_type": "bar",
    "website": BASE_URL,
}


def clean_text(text: str) -> str:
    """Decode HTML entities and clean text."""
    if not text:
        return ""
    # Decode HTML entities like &#038; -> &
    text = html.unescape(text)
    # Remove extra whitespace
    text = re.sub(r'\s+', ' ', text).strip()
    return text


def parse_datetime_from_jsonld(iso_string: str) -> tuple[Optional[str], Optional[str]]:
    """Parse ISO datetime string to date and time components in Eastern time."""
    if not iso_string:
        return None, None

    try:
        # Parse ISO format with timezone
        dt = datetime.fromisoformat(iso_string.replace('Z', '+00:00'))

        # Convert to Eastern time
        eastern = ZoneInfo("America/New_York")
        dt_eastern = dt.astimezone(eastern)

        date_str = dt_eastern.strftime('%Y-%m-%d')
        time_str = dt_eastern.strftime('%H:%M')
        return date_str, time_str
    except (ValueError, AttributeError):
        return None, None


def parse_tribe_date_text(date_text: str) -> tuple[Optional[str], Optional[str], Optional[str]]:
    """
    Parse tribe-events date format like 'February 3 @ 8:00 pm - 11:00 pm'.
    Returns (start_date, start_time, end_time).
    """
    if not date_text:
        return None, None, None

    # Pattern: "February 3 @ 8:00 pm - 11:00 pm" or "February 3 @ 8:00 pm"
    match = re.match(
        r'(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})(?:\s+@\s+(\d{1,2}:\d{2})\s*(am|pm)(?:\s*-\s*(\d{1,2}:\d{2})\s*(am|pm))?)?',
        date_text,
        re.IGNORECASE
    )

    if not match:
        return None, None, None

    month_name, day, start_time_str, start_period, end_time_str, end_period = match.groups()

    # Parse date
    try:
        month_num = datetime.strptime(month_name, '%B').month
        year = datetime.now().year
        date_obj = datetime(year, month_num, int(day))

        # If date is in the past, assume next year
        if date_obj.date() < datetime.now().date():
            date_obj = datetime(year + 1, month_num, int(day))

        start_date = date_obj.strftime('%Y-%m-%d')
    except ValueError:
        return None, None, None

    # Parse start time
    start_time = None
    if start_time_str and start_period:
        start_time = parse_time_12hr(start_time_str, start_period)

    # Parse end time
    end_time = None
    if end_time_str and end_period:
        end_time = parse_time_12hr(end_time_str, end_period)

    return start_date, start_time, end_time


def parse_time_12hr(time_str: str, period: str) -> str:
    """Convert '8:00' 'pm' to 24-hour format '20:00'."""
    try:
        hour, minute = map(int, time_str.split(':'))
        period = period.lower()

        if period == 'pm' and hour != 12:
            hour += 12
        elif period == 'am' and hour == 12:
            hour = 0

        return f"{hour:02d}:{minute:02d}"
    except (ValueError, AttributeError):
        return None


def extract_json_ld_events(page) -> list[dict]:
    """Extract Event objects from JSON-LD script tags."""
    events = []
    scripts = page.query_selector_all('script[type="application/ld+json"]')

    for script in scripts:
        try:
            content = script.inner_text()
            if not content:
                continue

            data = json.loads(content)

            # Handle array format
            if isinstance(data, list):
                for item in data:
                    if isinstance(item, dict) and item.get('@type') == 'Event':
                        events.append(item)
            # Handle single object
            elif isinstance(data, dict):
                if data.get('@type') == 'Event':
                    events.append(data)
                # Check @graph array
                if '@graph' in data:
                    for item in data['@graph']:
                        if isinstance(item, dict) and item.get('@type') == 'Event':
                            events.append(item)
        except (json.JSONDecodeError, Exception) as e:
            logger.debug(f"Failed to parse JSON-LD: {e}")
            continue

    return events


def extract_tribe_events_from_dom(page) -> list[dict]:
    """Fallback: Extract events from tribe-events DOM elements using page.evaluate()."""
    raw_events = page.evaluate("""() => {
        const results = [];

        // Try .tribe-events-calendar-list__event-row containers
        const eventContainers = document.querySelectorAll(
            '.tribe-events-calendar-list__event-row, ' +
            'article.tribe-events-calendar-list__event, ' +
            '.tribe-common-g-row.tribe-common-g-row--gutters'
        );

        eventContainers.forEach(container => {
            try {
                // Extract title
                const titleEl = container.querySelector(
                    '.tribe-events-calendar-list__event-title-link, ' +
                    '.tribe-events-calendar-list__event-title a, ' +
                    '.tribe-common-h6 a'
                );
                if (!titleEl) return;

                const title = titleEl.textContent.trim();
                const url = titleEl.href || '';

                // Extract date/time text
                // Format: "February 3 @ 8:00 pm - 11:00 pm"
                const dateTimeEl = container.querySelector(
                    '.tribe-events-calendar-list__event-datetime, ' +
                    '.tribe-event-date-start, ' +
                    '[class*="event-date"]'
                );
                const dateTimeText = dateTimeEl ? dateTimeEl.textContent.trim() : '';

                // Extract image
                const imgEl = container.querySelector('img');
                const image = imgEl ? (imgEl.src || imgEl.dataset.src || '') : '';

                // Extract description
                const descEl = container.querySelector(
                    '.tribe-events-calendar-list__event-description, ' +
                    '.tribe-events-list-event-description'
                );
                const description = descEl ? descEl.textContent.trim() : '';

                results.push({
                    title: title,
                    url: url,
                    dateTimeText: dateTimeText,
                    image: image,
                    description: description
                });
            } catch (e) {
                console.error('Error extracting event:', e);
            }
        });

        return results;
    }""")

    return raw_events


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Atlanta Eagle events using Playwright with JSON-LD and DOM fallback."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0
    seen_hashes: set[str] = set()

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
                viewport={"width": 1920, "height": 1080},
            )
            page = context.new_page()

            venue_id = get_or_create_venue(VENUE_DATA)

            logger.info(f"Fetching Atlanta Eagle: {EVENTS_URL}")
            page.goto(EVENTS_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(3000)

            # Scroll to load all content
            for _ in range(5):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1000)

            # PRIMARY: Try JSON-LD extraction
            json_ld_events = extract_json_ld_events(page)
            logger.info(f"Found {len(json_ld_events)} events in JSON-LD")

            # Process JSON-LD events
            for event_data in json_ld_events:
                try:
                    title = clean_text(event_data.get('name', ''))
                    if not title:
                        continue

                    # Parse dates from ISO format
                    start_date, start_time = parse_datetime_from_jsonld(event_data.get('startDate'))
                    end_date, end_time = parse_datetime_from_jsonld(event_data.get('endDate'))

                    if not start_date:
                        continue

                    # Default to 9pm for nightlife if no time found
                    if not start_time:
                        start_time = "21:00"

                    # Get image
                    image_url = event_data.get('image')
                    if isinstance(image_url, dict):
                        image_url = image_url.get('url')
                    elif isinstance(image_url, list) and image_url:
                        image_url = image_url[0]

                    # Get description
                    description = clean_text(event_data.get('description', ''))
                    if not description:
                        description = f"{title} at Atlanta Eagle"

                    # Get event URL
                    event_url = event_data.get('url', EVENTS_URL)

                    events_found += 1

                    content_hash = generate_content_hash(title, "Atlanta Eagle", start_date)
                    seen_hashes.add(content_hash)

                    if find_event_by_hash(content_hash):
                        events_updated += 1
                        continue

                    event_record = {
                        "source_id": source_id,
                        "venue_id": venue_id,
                        "title": title,
                        "description": description[:500],
                        "start_date": start_date,
                        "start_time": start_time,
                        "end_date": end_date,
                        "end_time": end_time,
                        "is_all_day": False,  # Bar/nightlife events are never all-day
                        "category": "nightlife",
                        "subcategory": "club",
                        "tags": [
                            "eagle",
                            "lgbtq",
                            "leather",
                            "gay-bar",
                            "midtown",
                            "ansley-square",
                        ],
                        "price_min": None,
                        "price_max": None,
                        "price_note": None,
                        "is_free": False,
                        "source_url": event_url,
                        "ticket_url": event_url,
                        "image_url": image_url if isinstance(image_url, str) else None,
                        "raw_text": json.dumps(event_data)[:500],
                        "extraction_confidence": 0.95,
                        "is_recurring": False,
                        "recurrence_rule": None,
                        "content_hash": content_hash,
                    }

                    try:
                        insert_event(event_record)
                        events_new += 1
                        logger.info(f"Added: {title} on {start_date} at {start_time}")
                    except Exception as e:
                        logger.error(f"Failed to insert: {title}: {e}")

                except Exception as e:
                    logger.debug(f"Error processing JSON-LD event: {e}")
                    continue

            # FALLBACK: If no JSON-LD events, try DOM extraction
            if events_found == 0:
                logger.info("No JSON-LD events found, trying DOM extraction fallback")
                dom_events = extract_tribe_events_from_dom(page)
                logger.info(f"Found {len(dom_events)} events in DOM")

                for raw_event in dom_events:
                    try:
                        title = clean_text(raw_event.get('title', ''))
                        if not title:
                            continue

                        # Parse date/time from text
                        date_time_text = raw_event.get('dateTimeText', '')
                        start_date, start_time, end_time = parse_tribe_date_text(date_time_text)

                        if not start_date:
                            continue

                        # Default to 9pm for nightlife if no time found
                        if not start_time:
                            start_time = "21:00"

                        events_found += 1

                        content_hash = generate_content_hash(title, "Atlanta Eagle", start_date)
                        seen_hashes.add(content_hash)

                        if find_event_by_hash(content_hash):
                            events_updated += 1
                            continue

                        description = clean_text(raw_event.get('description', ''))
                        if not description:
                            description = f"{title} at Atlanta Eagle"

                        event_record = {
                            "source_id": source_id,
                            "venue_id": venue_id,
                            "title": title,
                            "description": description[:500],
                            "start_date": start_date,
                            "start_time": start_time,
                            "end_date": None,
                            "end_time": end_time,
                            "is_all_day": False,
                            "category": "nightlife",
                            "subcategory": "club",
                            "tags": [
                                "eagle",
                                "lgbtq",
                                "leather",
                                "gay-bar",
                                "midtown",
                                "ansley-square",
                            ],
                            "price_min": None,
                            "price_max": None,
                            "price_note": None,
                            "is_free": False,
                            "source_url": raw_event.get('url', EVENTS_URL),
                            "ticket_url": raw_event.get('url', EVENTS_URL),
                            "image_url": raw_event.get('image') or None,
                            "raw_text": f"{title} - {date_time_text}",
                            "extraction_confidence": 0.80,
                            "is_recurring": False,
                            "recurrence_rule": None,
                            "content_hash": content_hash,
                        }

                        try:
                            insert_event(event_record)
                            events_new += 1
                            logger.info(f"Added (DOM): {title} on {start_date} at {start_time}")
                        except Exception as e:
                            logger.error(f"Failed to insert: {title}: {e}")

                    except Exception as e:
                        logger.debug(f"Error processing DOM event: {e}")
                        continue

            # Clean up stale events no longer on the site
            stale_removed = remove_stale_source_events(source_id, seen_hashes)
            logger.info(f"Removed {stale_removed} stale events")

            browser.close()

        logger.info(
            f"Atlanta Eagle crawl complete: {events_found} found, {events_new} new, "
            f"{events_updated} updated, {stale_removed} removed"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Atlanta Eagle: {e}")
        raise

    return events_found, events_new, events_updated
