"""
Crawler for Spruill Center for the Arts events.
https://www.spruillarts.org/events/
One of the largest ceramics programs in Georgia.
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

EVENTS_URL = "https://www.spruillarts.org/events/"
VENUE_NAME = "Spruill Center for the Arts"
VENUE_ADDRESS = "5339 Chamblee Dunwoody Rd"
VENUE_CITY = "Dunwoody"
VENUE_STATE = "GA"


def parse_event_date(date_str: str) -> tuple[Optional[str], Optional[str]]:
    """
    Parse Spruill date format like 'January 29 @ 6:30 pm - 8:30 pm'
    Returns (date, time) tuple.
    """
    try:
        # Extract date part: "January 29" or "February 1"
        date_match = re.search(r'(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})', date_str)
        if not date_match:
            return None, None

        month_name = date_match.group(1)
        day = int(date_match.group(2))

        # Determine year - assume current year, or next year if month is before current
        now = datetime.now()
        month_num = datetime.strptime(month_name, "%B").month

        year = now.year
        if month_num < now.month or (month_num == now.month and day < now.day):
            year = now.year + 1

        start_date = f"{year}-{month_num:02d}-{day:02d}"

        # Extract time: "6:30 pm" or "8:00 am"
        time_match = re.search(r'@\s*(\d{1,2}):(\d{2})\s*(am|pm)', date_str, re.IGNORECASE)
        start_time = None
        if time_match:
            hour = int(time_match.group(1))
            minute = int(time_match.group(2))
            period = time_match.group(3).lower()

            if period == "pm" and hour != 12:
                hour += 12
            elif period == "am" and hour == 12:
                hour = 0

            start_time = f"{hour:02d}:{minute:02d}"

        return start_date, start_time
    except Exception as e:
        logger.debug(f"Failed to parse date {date_str}: {e}")
        return None, None


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Spruill Center for events."""
    if not source.get("is_active"):
        logger.info("Spruill Center source is not active, skipping")
        return 0, 0, 0

    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    venue_data = {
        "name": VENUE_NAME,
        "slug": "spruill-center",
        "address": VENUE_ADDRESS,
        "city": VENUE_CITY,
        "state": VENUE_STATE,
        "spot_type": "gallery",
        "vibes": ["artsy", "chill", "family-friendly"],
    }

    try:
        venue_id = get_or_create_venue(venue_data)
    except Exception as e:
        logger.error(f"Failed to create venue: {e}")
        venue_id = None

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
                viewport={"width": 1920, "height": 1080},
            )
            page = context.new_page()

            logger.info(f"Fetching Spruill Center events: {EVENTS_URL}")
            page.goto(EVENTS_URL, wait_until="domcontentloaded", timeout=60000)
            page.wait_for_timeout(3000)

            # Scroll to load more events
            for _ in range(5):
                page.keyboard.press("End")
                page.wait_for_timeout(1000)

            # The events page has event cards with titles and dates
            # Look for event links that contain /event/
            event_links = page.query_selector_all('a[href*="/event/"]')

            seen_urls = set()
            event_data = []

            for link in event_links:
                try:
                    href = link.get_attribute("href")
                    if not href or href in seen_urls:
                        continue

                    if not href.startswith("http"):
                        href = f"https://www.spruillarts.org{href}"

                    seen_urls.add(href)

                    # Get the parent container for more context
                    text = link.inner_text().strip()
                    if text and len(text) > 3:
                        event_data.append({"url": href, "title_hint": text})
                except Exception:
                    continue

            logger.info(f"Found {len(event_data)} Spruill events to process")

            for event in event_data[:30]:
                try:
                    page.goto(event["url"], wait_until="domcontentloaded", timeout=30000)
                    page.wait_for_timeout(1000)

                    # Get title from h1
                    title_el = page.query_selector("h1.tribe-events-single-event-title, h1")
                    if not title_el:
                        continue
                    title = title_el.inner_text().strip()
                    if not title or len(title) < 3:
                        continue

                    # Get date/time from the event meta
                    date_el = page.query_selector(".tribe-events-schedule, .tribe-events-start-datetime, time")
                    start_date = None
                    start_time = None

                    if date_el:
                        date_text = date_el.inner_text().strip()
                        start_date, start_time = parse_event_date(date_text)

                    # Also try datetime attribute
                    if not start_date:
                        time_el = page.query_selector("time[datetime]")
                        if time_el:
                            dt_attr = time_el.get_attribute("datetime")
                            if dt_attr and "T" in dt_attr:
                                try:
                                    dt = datetime.fromisoformat(dt_attr.replace("Z", "+00:00"))
                                    start_date = dt.strftime("%Y-%m-%d")
                                    start_time = dt.strftime("%H:%M")
                                except Exception:
                                    pass

                    if not start_date:
                        logger.debug(f"Skipping event without date: {title}")
                        continue

                    events_found += 1

                    # Get description
                    description = None
                    desc_el = page.query_selector(".tribe-events-single-event-description, .entry-content, article p")
                    if desc_el:
                        description = desc_el.inner_text().strip()[:2000]

                    # Check if free
                    is_free = False
                    page_text = page.inner_text("body").lower()
                    if "free" in page_text[:500]:
                        is_free = True

                    # Get image
                    image_url = None
                    img_el = page.query_selector(".tribe-events-event-image img, article img")
                    if img_el:
                        image_url = img_el.get_attribute("src")

                    content_hash = generate_content_hash(title, VENUE_NAME, start_date)

                    existing = find_event_by_hash(content_hash)
                    if existing:
                        events_updated += 1
                        continue

                    # Determine tags based on title
                    title_lower = title.lower()
                    if any(w in title_lower for w in ["ceramic", "pottery", "clay", "wheel", "glaze", "raku"]):
                        tags = ["pottery", "ceramics", "art-class"]
                        subcategory = "art.class"
                    elif any(w in title_lower for w in ["yoga", "tai chi", "meditation"]):
                        tags = ["yoga", "wellness", "fitness"]
                        subcategory = "fitness.yoga"
                    elif any(w in title_lower for w in ["paint", "drawing", "sketch", "watercolor"]):
                        tags = ["painting", "drawing", "art-class"]
                        subcategory = "art.class"
                    elif any(w in title_lower for w in ["jewelry", "metal", "silver", "glass"]):
                        tags = ["jewelry", "crafts", "art-class"]
                        subcategory = "art.class"
                    elif any(w in title_lower for w in ["market", "sale", "shop"]):
                        tags = ["market", "shopping", "art"]
                        subcategory = "art.market"
                    else:
                        tags = ["art-class", "workshop", "crafts"]
                        subcategory = "art.class"

                    event_record = {
                        "source_id": source_id,
                        "venue_id": venue_id,
                        "title": title,
                        "description": description,
                        "start_date": start_date,
                        "start_time": start_time,
                        "end_date": None,
                        "end_time": None,
                        "is_all_day": False,
                        "category": "art",
                        "subcategory": subcategory,
                        "tags": tags,
                        "price_min": None,
                        "price_max": None,
                        "price_note": "See website for pricing",
                        "is_free": is_free,
                        "source_url": event["url"],
                        "ticket_url": event["url"],
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
                        logger.error(f"Failed to insert: {title}: {e}")

                except Exception as e:
                    logger.debug(f"Error processing event {event.get('url')}: {e}")
                    continue

            browser.close()

        logger.info(f"Spruill Center crawl complete: {events_found} found, {events_new} new, {events_updated} existing")

    except Exception as e:
        logger.error(f"Failed to crawl Spruill Center: {e}")
        raise

    return events_found, events_new, events_updated
