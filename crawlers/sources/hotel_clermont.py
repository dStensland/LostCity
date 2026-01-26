"""
Crawler for Hotel Clermont (hotelclermont.com/events).
Historic Poncey-Highland hotel with rooftop bar and famous Clermont Lounge.
Events include live music, DJ nights, and special performances.
"""

from __future__ import annotations

import json
import logging
import re
from datetime import datetime
from typing import Optional

from playwright.sync_api import sync_playwright

from db import get_or_create_venue, insert_event, find_event_by_hash
from dedupe import generate_content_hash
from utils import extract_images_from_page

logger = logging.getLogger(__name__)

BASE_URL = "https://www.hotelclermont.com"
EVENTS_URL = f"{BASE_URL}/events"

VENUE_DATA = {
    "name": "Hotel Clermont",
    "slug": "hotel-clermont",
    "address": "789 Ponce De Leon Ave NE",
    "neighborhood": "Poncey-Highland",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30306",
    "venue_type": "hotel",
    "website": BASE_URL,
}


def parse_squarespace_date(date_str: str) -> tuple[Optional[str], Optional[str]]:
    """
    Parse Squarespace event date formats.
    Examples:
    - "January 31, 2026"
    - "February 1, 2026 at 8:00pm"
    - "Jan 31 @ 9:00 PM"
    """
    try:
        current_year = datetime.now().year

        # Remove time portion if present
        date_part = re.split(r'\s+at\s+|\s+@\s+', date_str, flags=re.IGNORECASE)

        # Parse date
        date_text = date_part[0].strip()
        for fmt in ["%B %d, %Y", "%b %d, %Y", "%B %d %Y", "%b %d %Y"]:
            try:
                dt = datetime.strptime(date_text, fmt)
                date_str_result = dt.strftime("%Y-%m-%d")
                break
            except ValueError:
                continue
        else:
            # Try without year, add current or next year
            for fmt in ["%B %d", "%b %d"]:
                try:
                    dt = datetime.strptime(date_text, fmt)
                    dt = dt.replace(year=current_year)
                    if dt < datetime.now():
                        dt = dt.replace(year=current_year + 1)
                    date_str_result = dt.strftime("%Y-%m-%d")
                    break
                except ValueError:
                    continue
            else:
                return None, None

        # Parse time if present
        time_str_result = None
        if len(date_part) > 1:
            time_text = date_part[1].strip()
            # Match time patterns like "8:00pm", "9:00 PM", "8pm"
            time_match = re.search(r'(\d{1,2})(?::(\d{2}))?\s*(am|pm)', time_text, re.IGNORECASE)
            if time_match:
                hour = int(time_match.group(1))
                minute = int(time_match.group(2)) if time_match.group(2) else 0
                period = time_match.group(3).lower()

                if period == 'pm' and hour != 12:
                    hour += 12
                elif period == 'am' and hour == 12:
                    hour = 0

                time_str_result = f"{hour:02d}:{minute:02d}"

        return date_str_result, time_str_result

    except Exception as e:
        logger.debug(f"Failed to parse date '{date_str}': {e}")
        return None, None


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Hotel Clermont events."""
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

            logger.info(f"Fetching Hotel Clermont: {EVENTS_URL}")
            page.goto(EVENTS_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(3000)

            # Extract images
            image_map = extract_images_from_page(page)

            # Scroll to load all events
            for _ in range(3):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1500)

            venue_id = get_or_create_venue(VENUE_DATA)

            # Squarespace events calendar uses eapp-events-calendar components
            event_items = page.query_selector_all("[class*='eapp-events-calendar-grid-item']")

            if not event_items:
                logger.info("No events found on calendar")
                browser.close()
                return events_found, events_new, events_updated

            logger.info(f"Found {len(event_items)} potential events")

            current_year = datetime.now().year

            for item in event_items:
                try:
                    # Extract category (used as event type by Clermont)
                    category_elem = item.query_selector("[class*='eapp-events-calendar-category-item']")
                    event_type = category_elem.inner_text().strip() if category_elem else None

                    # Extract title (event name)
                    title_elem = item.query_selector("[class*='eapp-events-calendar-name-component']")
                    event_name = title_elem.inner_text().strip() if title_elem else None

                    # Build full title
                    if event_type and event_name:
                        title = f"{event_type}: {event_name}"
                    elif event_name:
                        title = event_name
                    elif event_type:
                        title = event_type
                    else:
                        continue

                    # Extract date from JSON-LD schema (most reliable)
                    start_date = None
                    start_time = None

                    # Try JSON-LD first
                    script_elem = item.query_selector("script[type='application/ld+json']")
                    if script_elem:
                        import json
                        try:
                            json_data = json.loads(script_elem.inner_text())
                            start_date = json_data.get("startDate", "")[:10]  # YYYY-MM-DD format

                            # Try to extract time
                            time_elem = item.query_selector("[class*='eapp-events-calendar-time-component']")
                            if time_elem:
                                time_text = time_elem.inner_text().strip()
                                # Parse "7:00 PM - 10:00 PM" to get start time
                                time_match = re.search(r'(\d{1,2}):(\d{2})\s*(AM|PM)', time_text, re.IGNORECASE)
                                if time_match:
                                    hour = int(time_match.group(1))
                                    minute = int(time_match.group(2))
                                    period = time_match.group(3).upper()

                                    if period == 'PM' and hour != 12:
                                        hour += 12
                                    elif period == 'AM' and hour == 12:
                                        hour = 0

                                    start_time = f"{hour:02d}:{minute:02d}"
                        except (json.JSONDecodeError, KeyError) as e:
                            logger.debug(f"Failed to parse JSON-LD: {e}")

                    if not start_date:
                        # Fallback: try to parse date from date elements
                        month_elem = item.query_selector("[class*='date-element-month']")
                        day_elem = item.query_selector("[class*='date-element-day']")

                        if month_elem and day_elem:
                            month_text = month_elem.inner_text().strip()
                            day_text = day_elem.inner_text().strip()

                            # Parse "JAN 27" format
                            try:
                                dt = datetime.strptime(f"{month_text} {day_text} {current_year}", "%b %d %Y")
                                if dt < datetime.now():
                                    dt = dt.replace(year=current_year + 1)
                                start_date = dt.strftime("%Y-%m-%d")
                            except ValueError:
                                pass

                    if not start_date:
                        logger.debug(f"Could not determine date for: {title}")
                        continue

                    # Extract location within venue
                    location_elem = item.query_selector("[class*='eapp-events-calendar-location-component']")
                    location_detail = location_elem.inner_text().strip() if location_elem else None

                    # Build description
                    description = f"Event at Hotel Clermont"
                    if location_detail:
                        description += f" - {location_detail}"
                    if event_type:
                        description += f". Category: {event_type}"

                    # Extract event URL
                    link_elem = item.query_selector("a")
                    event_url = link_elem.get_attribute("href") if link_elem else EVENTS_URL
                    if event_url and not event_url.startswith("http"):
                        event_url = BASE_URL + event_url

                    events_found += 1

                    content_hash = generate_content_hash(title, VENUE_DATA["name"], start_date)
                    existing = find_event_by_hash(content_hash)
                    if existing:
                        events_updated += 1
                        continue

                    # Determine category from title/description
                    title_lower = (title + " " + (description or "")).lower()
                    if any(w in title_lower for w in ["music", "live", "band", "dj", "concert", "performance"]):
                        category, subcategory = "music", "live"
                        tags = ["music", "live-music", "hotel", "rooftop"]
                    elif any(w in title_lower for w in ["comedy", "stand-up"]):
                        category, subcategory = "comedy", "standup"
                        tags = ["comedy", "hotel"]
                    else:
                        category, subcategory = "nightlife", "special_event"
                        tags = ["nightlife", "hotel", "clermont"]

                    event_record = {
                        "source_id": source_id,
                        "venue_id": venue_id,
                        "title": title,
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
                        "price_note": None,
                        "is_free": False,
                        "source_url": event_url,
                        "ticket_url": None,
                        "image_url": image_map.get(title),
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
                        logger.error(f"Failed to insert {title}: {e}")

                except Exception as e:
                    logger.debug(f"Failed to parse event item: {e}")
                    continue

            browser.close()

        logger.info(
            f"Hotel Clermont crawl complete: {events_found} found, {events_new} new"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Hotel Clermont: {e}")
        raise

    return events_found, events_new, events_updated
