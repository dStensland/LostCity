"""
Crawler for Atlanta Lyric Theatre.

NOTE: The original domain (atlantalyrictheatre.com) was taken over by spam content
after September 2024. This crawler now checks their Eventbrite organizer page.
If no events are found, the venue may have permanently closed.
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

# Original site is down, trying Eventbrite
EVENTBRITE_URL = "https://www.eventbrite.com/o/atlanta-lyric-theatre-31645477533"
FALLBACK_SITE_URL = "https://www.atlantalyrictheatre.com"

VENUE_DATA = {
    "name": "Atlanta Lyric Theatre",
    "slug": "atlanta-lyric-theatre",
    "address": "60 Glover Park Dr SE",
    "neighborhood": "Marietta",
    "city": "Marietta",
    "state": "GA",
    "zip": "30060",
    "lat": 33.9519,
    "lng": -84.5454,
    "venue_type": "theater",
    "spot_type": "theater",
    "website": FALLBACK_SITE_URL,
}


def check_if_spam_site(page) -> bool:
    """Check if the page has been taken over by spam/gambling content."""
    body_text = page.inner_text("body").lower()
    spam_indicators = ["slot", "gacor", "rtp tinggi", "bocoran", "judi", "casino"]
    spam_count = sum(1 for indicator in spam_indicators if indicator in body_text)
    return spam_count >= 2


def parse_eventbrite_date(date_str: str) -> Optional[dict]:
    """Parse Eventbrite date formats like 'Sat, Jan 25, 7:30 PM' or 'Jan 25, 2026'."""
    # Try full format with time
    match = re.search(
        r"(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)?,?\s*"
        r"(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})(?:,\s*(\d{4}))?"
        r"(?:\s*[•,]\s*(\d{1,2}):(\d{2})\s*(AM|PM))?",
        date_str,
        re.IGNORECASE
    )

    if not match:
        return None

    month, day, year, hour, minute, period = match.groups()

    # Default to current year if not specified
    if not year:
        year = str(datetime.now().year)

    # Parse date
    try:
        dt = datetime.strptime(f"{month} {day} {year}", "%b %d %Y")
    except ValueError:
        return None

    start_date = dt.strftime("%Y-%m-%d")
    start_time = None

    # Parse time if available
    if hour and minute and period:
        hour_int = int(hour)
        if period.upper() == "PM" and hour_int != 12:
            hour_int += 12
        elif period.upper() == "AM" and hour_int == 12:
            hour_int = 0
        start_time = f"{hour_int:02d}:{minute}"

    return {
        "date": start_date,
        "time": start_time
    }


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Atlanta Lyric Theatre events from Eventbrite."""
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

            # Try Eventbrite first
            logger.info(f"Fetching Atlanta Lyric Theatre from Eventbrite: {EVENTBRITE_URL}")
            try:
                page.goto(EVENTBRITE_URL, wait_until="domcontentloaded", timeout=30000)
                page.wait_for_timeout(3000)

                # Check if Eventbrite page exists
                body_text = page.inner_text("body").lower()
                if "page or event you are looking for was not found" in body_text:
                    logger.error(
                        "Eventbrite organizer page has been removed (404). "
                        "Atlanta Lyric Theatre has likely permanently closed."
                    )
                    raise Exception("Eventbrite organizer page no longer exists")

                # Check for events on Eventbrite
                # Look for event cards or listings
                event_elements = page.query_selector_all("[data-event-id], .event-card, .search-event-card")

                if len(event_elements) > 0:
                    logger.info(f"Found {len(event_elements)} potential events on Eventbrite")

                    for elem in event_elements:
                        try:
                            # Extract title
                            title_elem = elem.query_selector("h3, .event-card__title, .eds-event-card__formatted-name--is-clamped")
                            if not title_elem:
                                continue

                            title = title_elem.inner_text().strip()
                            if not title or len(title) < 3:
                                continue

                            # Extract date
                            date_elem = elem.query_selector(".event-card__date, [data-spec='event-card-date']")
                            if not date_elem:
                                continue

                            date_text = date_elem.inner_text().strip()
                            parsed_date = parse_eventbrite_date(date_text)

                            if not parsed_date:
                                logger.warning(f"Could not parse date: {date_text}")
                                continue

                            start_date = parsed_date["date"]
                            start_time = parsed_date["time"]

                            # Extract event URL
                            link_elem = elem.query_selector("a[href*='/e/']")
                            event_url = link_elem.get_attribute("href") if link_elem else EVENTBRITE_URL
                            if event_url and not event_url.startswith("http"):
                                event_url = f"https://www.eventbrite.com{event_url}"

                            # Extract image
                            img_elem = elem.query_selector("img")
                            image_url = img_elem.get_attribute("src") if img_elem else None

                            events_found += 1

                            content_hash = generate_content_hash(title, "Atlanta Lyric Theatre", start_date)

                            if find_event_by_hash(content_hash):
                                events_updated += 1
                                continue

                            event_record = {
                                "source_id": source_id,
                                "venue_id": venue_id,
                                "title": title,
                                "description": "Musical theater performance at Atlanta Lyric Theatre",
                                "start_date": start_date,
                                "start_time": start_time,
                                "end_date": None,
                                "end_time": None,
                                "is_all_day": False,
                                "category": "theater",
                                "subcategory": "performance",
                                "tags": [
                                    "atlanta-lyric",
                                    "theater",
                                    "marietta",
                                    "musical",
                                    "broadway",
                                ],
                                "price_min": None,
                                "price_max": None,
                                "price_note": None,
                                "is_free": False,
                                "source_url": event_url,
                                "ticket_url": event_url,
                                "image_url": image_url,
                                "raw_text": f"{title} - {start_date}",
                                "extraction_confidence": 0.75,
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
                            logger.error(f"Error processing event element: {e}")
                            continue

                else:
                    # No events found on Eventbrite
                    logger.warning("No events found on Eventbrite organizer page")

                    # Check if original site is back online (not spam)
                    logger.info(f"Checking original site: {FALLBACK_SITE_URL}")
                    page.goto(f"{FALLBACK_SITE_URL}/shows", wait_until="domcontentloaded", timeout=30000)
                    page.wait_for_timeout(2000)

                    if check_if_spam_site(page):
                        logger.error(
                            "Original domain has been taken over by spam content. "
                            "Atlanta Lyric Theatre may have permanently closed. "
                            "Consider marking this source as inactive."
                        )
                    else:
                        logger.info("Original site appears to be back online. Site structure may have changed.")

            except PlaywrightTimeout:
                logger.error("Timeout loading Eventbrite page")
            except Exception as e:
                logger.error(f"Error fetching from Eventbrite: {e}")

            browser.close()

        logger.info(
            f"Atlanta Lyric Theatre crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Atlanta Lyric Theatre: {e}")
        raise

    return events_found, events_new, events_updated
