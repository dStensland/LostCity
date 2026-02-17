"""
Crawler for Exhibition Hub Atlanta (exhibitionhub.com).
Immersive art installation venue hosting rotating exhibits like Bubble Planet, Van Gogh experiences, etc.

Location: 1280 Peachtree St NE, Midtown (Atlanta Art Center area)

NOTE: Exhibition Hub runs seasonal/rotating exhibitions (3-6 month cycles).
They may not always have active events, which is expected behavior.

Ticketing: Primarily through Eventbrite, but may also use Fever, See Tickets, or direct sales.
This crawler monitors Eventbrite search results for their Atlanta events.

See EXHIBITION_HUB_INVESTIGATION.md for detailed research and status updates.
"""

from __future__ import annotations

import logging
import re
from datetime import datetime
from typing import Optional

from playwright.sync_api import sync_playwright

from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://exhibitionhub.com"
# Search Eventbrite for Exhibition Hub events in Atlanta
# Note: Organizer page may be inactive between exhibitions
EVENTBRITE_SEARCH_URL = "https://www.eventbrite.com/d/ga--atlanta/exhibition-hub/"
EVENTBRITE_ORG_URL = "https://www.eventbrite.com/o/exhibition-hub-33046723533"

VENUE_DATA = {
    "name": "Exhibition Hub Atlanta",
    "slug": "exhibition-hub-atlanta",
    "address": "1280 Peachtree St NE",
    "neighborhood": "Midtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30309",
    "lat": 33.7883,
    "lng": -84.3831,
    "venue_type": "museum",
    "spot_type": "museum",
    "website": BASE_URL,
}


def parse_eventbrite_date(date_str: str) -> Optional[dict]:
    """
    Parse Eventbrite date format like:
    - "Sat, Jan 25, 2026, 10:00 AM"
    - "Thu, Feb 13, 10:00 AM - 9:00 PM EST"

    Returns dict with start_date, start_time, end_time or None.
    """
    # Remove timezone suffix
    date_str = re.sub(r'\s+[A-Z]{2,4}$', '', date_str)

    # Pattern: Day, Month DD, YYYY, HH:MM AM/PM or Day, Month DD, HH:MM AM/PM
    patterns = [
        r'(\w+),\s+(\w+)\s+(\d{1,2}),\s+(\d{4}),\s+(\d{1,2}):(\d{2})\s+(AM|PM)',
        r'(\w+),\s+(\w+)\s+(\d{1,2}),\s+(\d{1,2}):(\d{2})\s+(AM|PM)',
    ]

    for pattern in patterns:
        match = re.search(pattern, date_str)
        if match:
            groups = match.groups()
            if len(groups) == 7:  # Has year
                day_name, month_abbr, day, year, hour, minute, period = groups
            else:  # No year - use current or next year
                day_name, month_abbr, day, hour, minute, period = groups
                current_year = datetime.now().year
                # Try current year first
                try:
                    test_date = datetime.strptime(f"{month_abbr} {day} {current_year}", "%b %d %Y")
                    if test_date < datetime.now():
                        year = str(current_year + 1)
                    else:
                        year = str(current_year)
                except ValueError:
                    year = str(current_year)

            # Parse date
            try:
                dt = datetime.strptime(f"{month_abbr} {day} {year}", "%b %d %Y")
                start_date = dt.strftime("%Y-%m-%d")
            except ValueError:
                return None

            # Parse time
            hour_int = int(hour)
            if period == "PM" and hour_int != 12:
                hour_int += 12
            elif period == "AM" and hour_int == 12:
                hour_int = 0
            start_time = f"{hour_int:02d}:{minute}"

            # Look for end time
            end_time = None
            end_match = re.search(r'-\s*(\d{1,2}):(\d{2})\s+(AM|PM)', date_str)
            if end_match:
                end_hour, end_minute, end_period = end_match.groups()
                end_hour_int = int(end_hour)
                if end_period == "PM" and end_hour_int != 12:
                    end_hour_int += 12
                elif end_period == "AM" and end_hour_int == 12:
                    end_hour_int = 0
                end_time = f"{end_hour_int:02d}:{end_minute}"

            return {
                "start_date": start_date,
                "start_time": start_time,
                "end_time": end_time,
            }

    return None


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl Exhibition Hub events via Eventbrite search.

    Note: Returns (0, 0, 0) when no exhibitions are currently active, which is normal.
    Exhibition Hub runs seasonal exhibitions that may have gaps between runs.
    """
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

            # Try search page first (more reliable than organizer page which may be inactive)
            logger.info(f"Fetching Exhibition Hub Eventbrite search: {EVENTBRITE_SEARCH_URL}")
            page.goto(EVENTBRITE_SEARCH_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(3000)

            # Scroll to load all events
            for _ in range(3):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1500)

            # Check if page shows "not found" message
            page_text = page.inner_text("body")
            if "not found" in page_text.lower() or "whoops" in page_text.lower():
                logger.info("No active Exhibition Hub events found (organizer page inactive)")
                browser.close()
                return 0, 0, 0

            # Extract event cards - try multiple selectors
            event_cards = page.query_selector_all("article[data-testid='organizer-profile__events-card']")

            if not event_cards:
                event_cards = page.query_selector_all(".eds-event-card")

            if not event_cards:
                # Try search result cards
                event_cards = page.query_selector_all("div[data-testid='search-event-card']")

            if not event_cards:
                # Generic event card selector
                event_cards = page.query_selector_all("article, [class*='event-card']")

            logger.info(f"Found {len(event_cards)} event cards")

            for card in event_cards:
                try:
                    # Extract title
                    title_elem = card.query_selector("h2, h3, .eds-event-card__formatted-name--is-clamped")
                    if not title_elem:
                        continue

                    title = title_elem.inner_text().strip()
                    if not title or len(title) < 3:
                        continue

                    # Extract date/time
                    date_elem = card.query_selector("[data-testid='organizer-profile__events-card-date'], .eds-event-card__formatted-date")
                    if not date_elem:
                        continue

                    date_text = date_elem.inner_text().strip()
                    date_info = parse_eventbrite_date(date_text)
                    if not date_info:
                        logger.debug(f"Could not parse date: {date_text}")
                        continue

                    start_date = date_info["start_date"]
                    start_time = date_info["start_time"]
                    end_time = date_info["end_time"]

                    # Extract URL
                    link_elem = card.query_selector("a[href*='/e/']")
                    event_url = link_elem.get_attribute("href") if link_elem else EVENTBRITE_SEARCH_URL
                    if event_url and not event_url.startswith("http"):
                        event_url = f"https://www.eventbrite.com{event_url}"

                    # Filter: Only include events that are likely Exhibition Hub events
                    # Check title for Exhibition Hub keywords
                    if not any(
                        keyword in title_lower
                        for keyword in ["exhibition hub", "bubble", "immersive", "van gogh", "monet"]
                    ):
                        # This might not be an Exhibition Hub event
                        logger.debug(f"Skipping non-Exhibition Hub event: {title}")
                        continue

                    # Extract image
                    img_elem = card.query_selector("img[src*='eventbrite'], img[alt]")
                    image_url = img_elem.get_attribute("src") if img_elem else None

                    # Extract price if available
                    price_elem = card.query_selector("[data-testid='organizer-profile__events-card-price'], .eds-event-card-content__sub")
                    price_text = price_elem.inner_text().strip() if price_elem else ""

                    is_free = "free" in price_text.lower()
                    price_min = None
                    price_max = None

                    # Try to extract price
                    price_match = re.search(r'\$(\d+(?:\.\d{2})?)', price_text)
                    if price_match and not is_free:
                        price_min = float(price_match.group(1))

                    events_found += 1

                    # Generate content hash
                    content_hash = generate_content_hash(
                        title, "Exhibition Hub Atlanta", start_date
                    )

                    # Check for existing

                    # Determine category/subcategory based on title
                    title_lower = title.lower()
                    category = "arts"
                    subcategory = "immersive"
                    tags = [
                        "exhibition-hub",
                        "immersive",
                        "instagram-worthy",
                        "midtown",
                    ]

                    if "bubble" in title_lower:
                        tags.extend(["bubble-planet", "family-friendly", "kids"])
                        category = "family"
                        subcategory = "kids"
                    elif "van gogh" in title_lower or "gogh" in title_lower:
                        tags.extend(["van-gogh", "art", "impressionism"])
                    elif "monet" in title_lower:
                        tags.extend(["monet", "art", "impressionism"])
                    elif "picasso" in title_lower:
                        tags.extend(["picasso", "art", "modern-art"])
                    elif "disney" in title_lower:
                        tags.extend(["disney", "family-friendly", "kids"])
                        category = "family"
                        subcategory = "kids"

                    event_record = {
                        "source_id": source_id,
                        "venue_id": venue_id,
                        "title": title,
                        "description": None,  # Eventbrite cards don't show full description
                        "start_date": start_date,
                        "start_time": start_time,
                        "end_date": None,
                        "end_time": end_time,
                        "is_all_day": False,
                        "category": category,
                        "subcategory": subcategory,
                        "tags": tags,
                        "price_min": price_min,
                        "price_max": price_max,
                        "price_note": price_text if price_text else None,
                        "is_free": is_free,
                        "source_url": event_url,
                        "ticket_url": event_url,
                        "image_url": image_url,
                        "raw_text": f"{title} | {date_text} | {price_text}",
                        "extraction_confidence": 0.90,
                        "is_recurring": False,
                        "recurrence_rule": None,
                        "content_hash": content_hash,
                    }

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
                        logger.error(f"Failed to insert: {title}: {e}")

                except Exception as e:
                    logger.warning(f"Failed to parse event card: {e}")
                    continue

            browser.close()

        logger.info(
            f"Exhibition Hub crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Exhibition Hub: {e}")
        raise

    return events_found, events_new, events_updated
