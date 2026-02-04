"""
Crawler for Shrine Cultural Center (shrineatl.com).

Historic venue in Castleberry Hill featuring:
- Concerts and live music performances
- Art exhibitions and cultural events
- Community gatherings and private events
- Multi-purpose event space in historic Shrine building

Location: 48 MLK Jr Dr SW, Atlanta (Castleberry Hill neighborhood)

Ticketing: Events are listed on Eventbrite organizer page.
This crawler monitors the Eventbrite organizer for upcoming events.
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

BASE_URL = "https://shrineatl.com"
EVENTBRITE_URL = "https://www.eventbrite.com/o/shrine-cultural-center-51764997263"

VENUE_DATA = {
    "name": "Shrine Cultural Center",
    "slug": "shrine-cultural-center",
    "address": "48 MLK Jr Dr SW",
    "neighborhood": "Castleberry Hill",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30303",
    "lat": 33.7531,
    "lng": -84.3946,
    "venue_type": "venue",
    "spot_type": "venue",
    "website": BASE_URL,
}


def parse_eventbrite_date(date_str: str) -> Optional[dict]:
    """
    Parse Eventbrite date formats like:
    - 'Sat, Jan 25, 7:30 PM'
    - 'Jan 25, 2026'
    - 'Sat, Jan 25, 2026, 7:30 PM'

    Returns dict with date and time or None.
    """
    # Remove timezone suffixes (EST, EDT, etc.)
    date_str = re.sub(r'\s+[A-Z]{2,4}$', '', date_str)

    # Try full format with time and year
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
        # If date is in the past, assume next year
        if dt.date() < datetime.now().date():
            dt = dt.replace(year=dt.year + 1)
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

    # Look for end time
    end_time = None
    end_match = re.search(r'-\s*(\d{1,2}):(\d{2})\s*(AM|PM)', date_str)
    if end_match:
        end_hour, end_minute, end_period = end_match.groups()
        end_hour_int = int(end_hour)
        if end_period.upper() == "PM" and end_hour_int != 12:
            end_hour_int += 12
        elif end_period.upper() == "AM" and end_hour_int == 12:
            end_hour_int = 0
        end_time = f"{end_hour_int:02d}:{end_minute}"

    return {
        "date": start_date,
        "time": start_time,
        "end_time": end_time,
    }


def determine_category(title: str, description: str = "") -> tuple[str, Optional[str], list[str]]:
    """Determine event category based on title and description."""
    title_lower = title.lower()
    description_lower = description.lower() if description else ""
    combined = f"{title_lower} {description_lower}"

    tags = ["shrine-cultural-center", "castleberry-hill", "downtown"]

    # Music events
    if any(w in combined for w in ["concert", "live music", "band", "dj", "performance", "showcase"]):
        return "music", "concert", tags + ["music", "live-music"]

    # Art exhibitions
    if any(w in combined for w in ["exhibition", "art show", "gallery", "opening", "artist"]):
        return "art", "exhibition", tags + ["art", "gallery"]

    # Community events
    if any(w in combined for w in ["community", "fundraiser", "benefit", "charity"]):
        return "community", "gathering", tags + ["community"]

    # Cultural events
    if any(w in combined for w in ["cultural", "festival", "celebration"]):
        return "community", "cultural", tags + ["cultural"]

    # Nightlife/parties
    if any(w in combined for w in ["party", "dance", "night", "lounge"]):
        return "nightlife", "party", tags + ["nightlife", "party"]

    # Default to arts/cultural
    return "arts", "cultural", tags


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Shrine Cultural Center events from Eventbrite."""
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

            logger.info(f"Fetching Shrine Cultural Center from Eventbrite: {EVENTBRITE_URL}")

            try:
                page.goto(EVENTBRITE_URL, wait_until="domcontentloaded", timeout=30000)
                page.wait_for_timeout(3000)

                # Scroll to load all events
                for _ in range(3):
                    page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                    page.wait_for_timeout(1500)

                # Check if Eventbrite page exists
                body_text = page.inner_text("body").lower()
                if "page or event you are looking for was not found" in body_text or "whoops" in body_text:
                    logger.warning("Eventbrite organizer page not found or has no events")
                    browser.close()
                    return 0, 0, 0

                # Look for event cards - try multiple selectors used by Eventbrite
                event_elements = page.query_selector_all(
                    "article[data-testid='organizer-profile__events-card'], "
                    ".eds-event-card, "
                    "div[data-testid='search-event-card'], "
                    "[data-event-id]"
                )

                logger.info(f"Found {len(event_elements)} potential events on Eventbrite")

                if len(event_elements) == 0:
                    logger.warning("No event cards found on page")
                    browser.close()
                    return 0, 0, 0

                for elem in event_elements:
                    try:
                        # Extract title
                        title_elem = elem.query_selector(
                            "h2, h3, "
                            ".event-card__title, "
                            ".eds-event-card__formatted-name--is-clamped, "
                            "[data-testid='organizer-profile__events-card-title']"
                        )
                        if not title_elem:
                            continue

                        title = title_elem.inner_text().strip()
                        if not title or len(title) < 3:
                            continue

                        # Extract date
                        date_elem = elem.query_selector(
                            ".event-card__date, "
                            "[data-spec='event-card-date'], "
                            ".eds-event-card__formatted-date, "
                            "[data-testid='organizer-profile__events-card-date']"
                        )
                        if not date_elem:
                            logger.debug(f"No date found for: {title}")
                            continue

                        date_text = date_elem.inner_text().strip()
                        parsed_date = parse_eventbrite_date(date_text)

                        if not parsed_date:
                            logger.warning(f"Could not parse date: {date_text}")
                            continue

                        start_date = parsed_date["date"]
                        start_time = parsed_date["time"]
                        end_time = parsed_date.get("end_time")

                        # Extract event URL
                        link_elem = elem.query_selector("a[href*='/e/']")
                        event_url = link_elem.get_attribute("href") if link_elem else EVENTBRITE_URL
                        if event_url and not event_url.startswith("http"):
                            event_url = f"https://www.eventbrite.com{event_url}"

                        # Extract image
                        img_elem = elem.query_selector("img")
                        image_url = img_elem.get_attribute("src") if img_elem else None

                        # Extract description if available
                        desc_elem = elem.query_selector(".event-card__description, .eds-event-card-content__sub")
                        description = desc_elem.inner_text().strip() if desc_elem else ""

                        # Extract price info
                        price_elem = elem.query_selector(
                            ".event-card__price, "
                            "[data-testid='organizer-profile__events-card-price'], "
                            ".eds-event-card-content__sub"
                        )
                        price_text = price_elem.inner_text().strip() if price_elem else ""

                        is_free = "free" in price_text.lower()
                        price_min = None
                        price_max = None

                        if not is_free:
                            # Extract numeric prices
                            prices = re.findall(r'\$(\d+(?:\.\d{2})?)', price_text)
                            if prices:
                                price_values = [float(p) for p in prices]
                                price_min = min(price_values)
                                price_max = max(price_values) if len(price_values) > 1 else price_min

                        events_found += 1

                        # Generate content hash for deduplication
                        content_hash = generate_content_hash(title, "Shrine Cultural Center", start_date)

                        if find_event_by_hash(content_hash):
                            events_updated += 1
                            continue

                        # Determine category
                        category, subcategory, tags = determine_category(title, description)

                        event_record = {
                            "source_id": source_id,
                            "venue_id": venue_id,
                            "title": title,
                            "description": description if description else None,
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
                            "raw_text": f"{title} - {date_text}",
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
                        logger.error(f"Error processing event element: {e}")
                        continue

            except PlaywrightTimeout:
                logger.error("Timeout loading Eventbrite page")
            except Exception as e:
                logger.error(f"Error fetching from Eventbrite: {e}")

            browser.close()

        logger.info(
            f"Shrine Cultural Center crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Shrine Cultural Center: {e}")
        raise

    return events_found, events_new, events_updated
