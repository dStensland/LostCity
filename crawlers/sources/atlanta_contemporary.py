"""
Crawler for Atlanta Contemporary (atlantacontemporary.org).
Free contemporary art center in West Midtown with rotating exhibitions,
artist talks, workshops, openings, and programs.

Site uses JavaScript rendering - must use Playwright.
Events are listed on /programs/schedule page.
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

BASE_URL = "https://atlantacontemporary.org"
EVENTS_URL = f"{BASE_URL}/programs/schedule"

VENUE_DATA = {
    "name": "Atlanta Contemporary",
    "slug": "atlanta-contemporary",
    "address": "535 Means St NW",
    "neighborhood": "West Midtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30318",
    "lat": 33.7780,
    "lng": -84.4127,
    "venue_type": "museum",
    "spot_type": "museum",
    "website": BASE_URL,
}


def parse_date_time(date_time_str: str) -> tuple[Optional[str], Optional[str]]:
    """
    Parse date and time from format like 'February 1 / 12:00pm' or 'February 5 / 6:00pm'.
    Returns (date, time) as (YYYY-MM-DD, HH:MM).
    """
    try:
        date_time_str = date_time_str.strip()

        # Pattern: "Month Day / Hour:MMam/pm"
        match = re.match(
            r'([A-Za-z]+)\s+(\d{1,2})\s*/\s*(\d{1,2}):(\d{2})\s*(am|pm)',
            date_time_str,
            re.IGNORECASE
        )

        if match:
            month, day, hour, minute, period = match.groups()

            # Parse date
            current_year = datetime.now().year
            try:
                dt = datetime.strptime(f"{month} {day} {current_year}", "%B %d %Y")
            except ValueError:
                dt = datetime.strptime(f"{month} {day} {current_year}", "%b %d %Y")

            # If date is in the past, assume next year
            if dt.date() < datetime.now().date():
                dt = dt.replace(year=current_year + 1)

            date_str = dt.strftime("%Y-%m-%d")

            # Parse time
            hour = int(hour)
            period = period.lower()

            if period == "pm" and hour != 12:
                hour += 12
            elif period == "am" and hour == 12:
                hour = 0

            time_str = f"{hour:02d}:{minute}"

            return date_str, time_str

        # Try just date without time: "February 1"
        match = re.match(r'([A-Za-z]+)\s+(\d{1,2})', date_time_str, re.IGNORECASE)
        if match:
            month, day = match.groups()
            current_year = datetime.now().year
            try:
                dt = datetime.strptime(f"{month} {day} {current_year}", "%B %d %Y")
            except ValueError:
                dt = datetime.strptime(f"{month} {day} {current_year}", "%b %d %Y")

            if dt.date() < datetime.now().date():
                dt = dt.replace(year=current_year + 1)

            return dt.strftime("%Y-%m-%d"), None

    except (ValueError, AttributeError) as e:
        logger.debug(f"Could not parse date/time '{date_time_str}': {e}")

    return None, None


def determine_category(event_type: str, title: str, description: str = "") -> tuple[str, Optional[str], list[str]]:
    """Determine category based on event type, title, and description."""
    event_type_lower = event_type.lower()
    title_lower = title.lower()
    description_lower = description.lower() if description else ""
    combined = f"{event_type_lower} {title_lower} {description_lower}"

    tags = ["atlanta-contemporary", "museum", "contemporary-art", "west-midtown", "free"]

    # Contemporary Talks
    if "contemporary talks" in event_type_lower or "artist talk" in title_lower:
        return "museums", "talk", tags + ["talk", "artist-talk"]

    # Contemporary Kids
    if "contemporary kids" in event_type_lower or "kids" in event_type_lower:
        return "family", "kids", tags + ["family-friendly", "kids"]

    # Special Events - openings, receptions
    if "special event" in event_type_lower or "opening" in combined:
        if "opening" in combined or "reception" in combined:
            return "museums", "opening", tags + ["opening", "reception"]
        return "museums", "event", tags + ["special-event"]

    # Open Studios
    if "open studios" in event_type_lower or "open studio" in title_lower:
        return "museums", "studio", tags + ["open-studios", "studio-visit"]

    # Workshops
    if "workshop" in combined or "class" in combined:
        return "museums", "workshop", tags + ["workshop", "class"]

    # Member Programs
    if "member" in event_type_lower:
        return "museums", "member", tags + ["member-exclusive"]

    # Film screenings
    if any(w in combined for w in ["film", "screening", "movie"]):
        return "film", None, tags + ["film"]

    # Music performances
    if any(w in combined for w in ["music", "performance", "concert"]):
        return "music", "performance", tags + ["music", "performance"]

    # Exhibitions
    if any(w in combined for w in ["exhibition", "exhibit", "gallery", "show"]):
        return "museums", "exhibition", tags + ["exhibition"]

    # Default to museums
    return "museums", None, tags


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl Atlanta Contemporary events using Playwright.

    The site has a schedule page at /programs/schedule with well-structured
    event articles containing date, type, title, and description.
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

            # Get venue ID
            venue_id = get_or_create_venue(VENUE_DATA)

            logger.info(f"Fetching Atlanta Contemporary events: {EVENTS_URL}")
            page.goto(EVENTS_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(3000)

            # Scroll to load all content
            for _ in range(3):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1000)

            # Find all event articles
            event_articles = page.query_selector_all("article")
            logger.info(f"Found {len(event_articles)} event articles")

            for article in event_articles:
                try:
                    # Extract date and time
                    date_elem = article.query_selector(".event__date")
                    if not date_elem:
                        continue

                    date_time_str = date_elem.inner_text().strip()
                    start_date, start_time = parse_date_time(date_time_str)

                    if not start_date:
                        logger.debug(f"Could not parse date from: {date_time_str}")
                        continue

                    # Extract event type (Contemporary Talks, Special Event, etc.)
                    event_type = ""
                    type_elem = article.query_selector(".event__type")
                    if type_elem:
                        event_type = type_elem.inner_text().strip()

                    # Extract title
                    title_elem = article.query_selector("h3")
                    if not title_elem:
                        continue

                    title = title_elem.inner_text().strip()
                    if not title or len(title) < 3:
                        continue

                    # Extract description
                    description = ""
                    desc_elem = article.query_selector(".event__info p")
                    if desc_elem:
                        description = desc_elem.inner_text().strip()

                    # Check if free (should always be free for Atlanta Contemporary)
                    is_free = True
                    label_elem = article.query_selector(".event__label")
                    if label_elem and "free" in label_elem.inner_text().lower():
                        is_free = True

                    # Extract image
                    image_url = None
                    img_elem = article.query_selector("img")
                    if img_elem:
                        src = img_elem.get_attribute("src")
                        if src:
                            # Make absolute URL
                            if src.startswith("http"):
                                image_url = src
                            elif src.startswith("//"):
                                image_url = "https:" + src
                            elif src.startswith("/"):
                                image_url = BASE_URL + src

                    # Extract event URL
                    event_url = EVENTS_URL
                    link_elem = article.query_selector("a[href]")
                    if link_elem:
                        href = link_elem.get_attribute("href")
                        if href:
                            if href.startswith("http"):
                                event_url = href
                            elif href.startswith("/"):
                                event_url = BASE_URL + href

                    events_found += 1

                    # Generate content hash
                    content_hash = generate_content_hash(
                        title, "Atlanta Contemporary", start_date
                    )

                    # Check for existing event
                    if find_event_by_hash(content_hash):
                        events_updated += 1
                        continue

                    # Determine category and tags
                    category, subcategory, tags = determine_category(
                        event_type, title, description
                    )

                    event_record = {
                        "source_id": source_id,
                        "venue_id": venue_id,
                        "title": title,
                        "description": description if description else None,
                        "start_date": start_date,
                        "start_time": start_time,
                        "end_date": None,
                        "end_time": None,
                        "is_all_day": False,
                        "category": category,
                        "subcategory": subcategory,
                        "tags": tags,
                        "price_min": None,
                        "price_max": None,
                        "price_note": "Free admission",
                        "is_free": is_free,
                        "source_url": event_url,
                        "ticket_url": event_url,
                        "image_url": image_url,
                        "raw_text": f"{event_type}: {title} - {description[:200] if description else ''}",
                        "extraction_confidence": 0.90,
                        "is_recurring": False,
                        "recurrence_rule": None,
                        "content_hash": content_hash,
                    }

                    try:
                        insert_event(event_record)
                        events_new += 1
                        logger.info(f"Added: {title} on {start_date} at {start_time or 'TBD'}")
                    except Exception as e:
                        logger.error(f"Failed to insert: {title}: {e}")

                except Exception as e:
                    logger.warning(f"Error parsing event article: {e}")
                    continue

            browser.close()

        logger.info(
            f"Atlanta Contemporary crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except PlaywrightTimeout as e:
        logger.error(f"Timeout fetching Atlanta Contemporary: {e}")
        raise
    except Exception as e:
        logger.error(f"Failed to crawl Atlanta Contemporary: {e}")
        raise

    return events_found, events_new, events_updated
