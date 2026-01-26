"""
Crawler for Oakland Cemetery (oaklandcemetery.com/events).
Historic cemetery in Atlanta with tours, special events, and cultural programs.
Events include daily tours, special topic tours, family programs, and special events.
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

BASE_URL = "https://oaklandcemetery.com"
EVENTS_URL = f"{BASE_URL}/events/"

VENUE_DATA = {
    "name": "Oakland Cemetery",
    "slug": "oakland-cemetery",
    "address": "248 Oakland Ave SE",
    "neighborhood": "Grant Park",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30312",
    "lat": 33.7484,
    "lng": -84.3716,
    "venue_type": "historic_site",
    "website": BASE_URL,
}


def parse_squarespace_date(date_str: str) -> tuple[Optional[str], Optional[str]]:
    """
    Parse Squarespace event date formats.
    Examples:
    - "January 31, 2026"
    - "February 1, 2026 at 8:00pm"
    - "Jan 31 @ 9:00 AM - 11:00 AM"
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
            # Match time patterns like "8:00pm", "9:00 AM", "8pm", "9:00 AM - 11:00 AM"
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


def categorize_event(title: str, description: str) -> tuple[str, str, list[str]]:
    """Categorize Oakland Cemetery events based on title and description."""
    title_lower = (title + " " + (description or "")).lower()

    # Tours
    if any(w in title_lower for w in ["tour", "walking tour", "guided tour"]):
        tags = ["historic", "tours", "outdoor", "educational"]

        if any(w in title_lower for w in ["black magnolias", "we shall overcome", "african american"]):
            tags.append("black-history")
        elif "jewish" in title_lower:
            tags.append("jewish-heritage")
        elif "crime" in title_lower:
            tags.append("true-crime")
        elif "love" in title_lower or "valentine" in title_lower:
            tags.append("romance")

        return "cultural", "tour", tags

    # Family programs
    if any(w in title_lower for w in ["homeschool", "kids", "children", "family", "camp"]):
        return "family", "kids_program", ["family-friendly", "educational", "historic", "kids"]

    # Fitness/Sports
    if any(w in title_lower for w in ["run", "5k", "race", "walk"]):
        return "sports", "running", ["fitness", "outdoor", "charity", "historic"]

    # Art/Cultural Events
    if any(w in title_lower for w in ["art", "gallery", "exhibition", "workshop", "craft"]):
        return "cultural", "workshop", ["art", "historic", "educational", "hands-on"]

    # Music/Performances
    if any(w in title_lower for w in ["concert", "music", "performance", "jazz", "symphony"]):
        return "music", "live", ["music", "outdoor", "historic", "cultural"]

    # Special events
    if any(w in title_lower for w in ["friday", "celebration", "festival", "party"]):
        return "community", "social", ["community", "outdoor", "historic", "social"]

    # Default to cultural/tour for Oakland
    return "cultural", "special_event", ["historic", "tours", "outdoor", "educational"]


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Oakland Cemetery events."""
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

            logger.info(f"Fetching Oakland Cemetery: {EVENTS_URL}")
            page.goto(EVENTS_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(3000)

            # Extract images
            image_map = extract_images_from_page(page)

            # Scroll to load all events
            for _ in range(3):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1500)

            venue_id = get_or_create_venue(VENUE_DATA)

            # Squarespace uses summary-item-record-type-event for event items
            event_items = page.query_selector_all(".summary-item-record-type-event")

            if not event_items:
                logger.info("No events found on page")
                browser.close()
                return events_found, events_new, events_updated

            logger.info(f"Found {len(event_items)} potential events")

            current_year = datetime.now().year

            for item in event_items:
                try:
                    # Extract title
                    title_elem = item.query_selector(".summary-title-link, .summary-title")
                    if not title_elem:
                        continue
                    title = title_elem.inner_text().strip()

                    if not title:
                        continue

                    # Extract date from thumbnail date element
                    start_date = None
                    start_time = None

                    month_elem = item.query_selector(".summary-thumbnail-event-date-month")
                    day_elem = item.query_selector(".summary-thumbnail-event-date-day")

                    if month_elem and day_elem:
                        month_text = month_elem.inner_text().strip()
                        day_text = day_elem.inner_text().strip()

                        # Parse "JAN 27" format
                        try:
                            dt = datetime.strptime(f"{month_text} {day_text} {current_year}", "%b %d %Y")
                            if dt < datetime.now().replace(hour=0, minute=0, second=0, microsecond=0):
                                dt = dt.replace(year=current_year + 1)
                            start_date = dt.strftime("%Y-%m-%d")
                        except ValueError:
                            pass

                    # Try to get more detailed date/time from metadata
                    date_elem = item.query_selector(".summary-metadata-item--date time")
                    if date_elem and not start_date:
                        datetime_attr = date_elem.get_attribute("datetime")
                        if datetime_attr:
                            # datetime attribute is in ISO format: "2026-01-31T14:00:00"
                            try:
                                dt = datetime.fromisoformat(datetime_attr)
                                start_date = dt.strftime("%Y-%m-%d")
                                start_time = dt.strftime("%H:%M")
                            except ValueError:
                                pass

                    # Fallback: try to parse from visible date text
                    if not start_date:
                        date_text_elem = item.query_selector(".summary-metadata-item--date")
                        if date_text_elem:
                            date_text = date_text_elem.inner_text().strip()
                            start_date, start_time = parse_squarespace_date(date_text)

                    if not start_date:
                        logger.debug(f"Could not determine date for: {title}")
                        continue

                    # Extract description/excerpt
                    desc_elem = item.query_selector(".summary-excerpt p, .summary-content p")
                    description = desc_elem.inner_text().strip() if desc_elem else None

                    # Extract event URL
                    link_elem = item.query_selector("a.summary-title-link, a.summary-thumbnail-container")
                    event_url = link_elem.get_attribute("href") if link_elem else EVENTS_URL
                    if event_url and not event_url.startswith("http"):
                        event_url = BASE_URL + event_url

                    # Extract image
                    img_elem = item.query_selector(".summary-thumbnail-image")
                    image_url = None
                    if img_elem:
                        image_url = (
                            img_elem.get_attribute("data-src") or
                            img_elem.get_attribute("src") or
                            img_elem.get_attribute("data-image")
                        )

                    # Fall back to image map if no image found
                    if not image_url and title in image_map:
                        image_url = image_map[title]

                    events_found += 1

                    content_hash = generate_content_hash(title, VENUE_DATA["name"], start_date)
                    existing = find_event_by_hash(content_hash)
                    if existing:
                        events_updated += 1
                        continue

                    # Categorize event
                    category, subcategory, tags = categorize_event(title, description or "")

                    # Determine if free (most Oakland tours have admission)
                    is_free = "free" in (description or "").lower()

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
                        "is_free": is_free,
                        "source_url": event_url,
                        "ticket_url": event_url,  # Same as source for Oakland
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
                        logger.error(f"Failed to insert {title}: {e}")

                except Exception as e:
                    logger.debug(f"Failed to parse event item: {e}")
                    continue

            browser.close()

        logger.info(
            f"Oakland Cemetery crawl complete: {events_found} found, {events_new} new"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Oakland Cemetery: {e}")
        raise

    return events_found, events_new, events_updated
