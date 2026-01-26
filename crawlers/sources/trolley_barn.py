"""
Crawler for Trolley Barn (trolleybarn.org).

Historic community arts venue in Inman Park hosting:
- Art exhibitions and gallery shows
- Live music performances
- Theater and dance productions
- Community workshops and classes
- Special events and receptions

Site uses WordPress with EventON calendar plugin.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime
from typing import Optional

from playwright.sync_api import sync_playwright
from bs4 import BeautifulSoup

from db import get_or_create_venue, insert_event, find_event_by_hash
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://trolleybarn.org"
EVENTS_URL = BASE_URL

VENUE_DATA = {
    "name": "Trolley Barn",
    "slug": "trolley-barn",
    "address": "963 Edgewood Ave NE",
    "neighborhood": "Inman Park",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30307",
    "lat": 33.7580,
    "lng": -84.3514,
    "venue_type": "arts_venue",
    "website": BASE_URL,
}


def parse_eventon_date(date_str: str) -> tuple[Optional[str], Optional[str]]:
    """
    Parse date from EventON format.

    Common formats:
    - "January 28, 2026"
    - "Jan 28"
    - "28 Jan 2026"

    Returns: (date, time)
    """
    try:
        current_year = datetime.now().year
        date_str = date_str.strip()

        # Remove day of week if present
        date_str = re.sub(r"^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*,?\s*", "", date_str, flags=re.I)

        # Try various date formats
        formats = [
            "%B %d, %Y",     # January 28, 2026
            "%b %d, %Y",     # Jan 28, 2026
            "%d %B %Y",      # 28 January 2026
            "%d %b %Y",      # 28 Jan 2026
            "%B %d",         # January 28
            "%b %d",         # Jan 28
            "%d %B",         # 28 January
            "%d %b",         # 28 Jan
        ]

        for fmt in formats:
            try:
                dt = datetime.strptime(date_str, fmt)
                # If no year provided, use current year or next year if date has passed
                if "%Y" not in fmt:
                    dt = dt.replace(year=current_year)
                    if dt.date() < datetime.now().date():
                        dt = dt.replace(year=current_year + 1)
                return dt.strftime("%Y-%m-%d"), None
            except ValueError:
                continue

        return None, None

    except Exception as e:
        logger.debug(f"Failed to parse date '{date_str}': {e}")
        return None, None


def parse_eventon_time(time_str: str) -> Optional[str]:
    """
    Parse time from EventON format.

    Formats:
    - "7:00 PM"
    - "7:00 pm"
    - "19:00"
    """
    try:
        time_str = time_str.strip()

        # 12-hour format with AM/PM
        match = re.search(r"(\d{1,2}):(\d{2})\s*(AM|PM)", time_str, re.IGNORECASE)
        if match:
            hour = int(match.group(1))
            minute = int(match.group(2))
            period = match.group(3).upper()

            if period == "PM" and hour != 12:
                hour += 12
            elif period == "AM" and hour == 12:
                hour = 0

            return f"{hour:02d}:{minute:02d}"

        # 24-hour format
        match = re.match(r"(\d{1,2}):(\d{2})", time_str)
        if match:
            hour = int(match.group(1))
            minute = int(match.group(2))
            return f"{hour:02d}:{minute:02d}"

        return None

    except Exception as e:
        logger.debug(f"Failed to parse time '{time_str}': {e}")
        return None


def determine_category(title: str, description: str) -> tuple[str, Optional[str], list[str]]:
    """Determine event category based on title and description."""
    combined = f"{title} {description}".lower()
    tags = ["arts", "trolley-barn", "inman-park", "community"]

    # Music events
    if any(w in combined for w in ["concert", "music", "band", "live music", "performance", "jazz", "blues", "folk"]):
        return "music", "live", tags + ["live-music"]

    # Art exhibitions
    if any(w in combined for w in ["exhibition", "gallery", "artist", "opening", "art show", "exhibit"]):
        return "art", "exhibition", tags + ["gallery", "visual-arts"]

    # Theater and dance
    if any(w in combined for w in ["theater", "theatre", "play", "dance", "performance art"]):
        return "theater", "performance", tags + ["performing-arts"]

    # Workshops and classes
    if any(w in combined for w in ["workshop", "class", "lesson", "teaching", "learn"]):
        return "education", "workshop", tags + ["workshop", "learning"]

    # Community events
    if any(w in combined for w in ["community", "meeting", "reception", "gathering"]):
        return "community", "social", tags + ["social"]

    # Default to arts
    return "art", "general", tags


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Trolley Barn events using Playwright."""
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

            logger.info(f"Fetching Trolley Barn events from {EVENTS_URL}")
            page.goto(EVENTS_URL, wait_until="domcontentloaded", timeout=45000)

            # Wait for EventON calendar to load
            page.wait_for_timeout(5000)

            # Scroll to trigger any lazy loading
            for _ in range(2):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1500)

            content = page.content()
            soup = BeautifulSoup(content, "html.parser")

            # EventON uses various class names for events
            # Try multiple selectors
            event_selectors = [
                ".eventon_list_event",       # Standard EventON event
                ".evcal_list_a",             # EventON list item
                ".evcal_event",              # EventON event wrapper
                ".evo_event",                # Alternative EventON class
                "article[class*='event']",   # WordPress event posts
            ]

            event_elements = []
            for selector in event_selectors:
                elements = soup.select(selector)
                if elements:
                    event_elements = elements
                    logger.info(f"Found {len(elements)} events using selector: {selector}")
                    break

            if not event_elements:
                # Try to find events in the page text if no structured elements found
                logger.info("No structured EventON elements found, checking for WordPress event posts")
                event_elements = soup.select("article.post")
                if event_elements:
                    logger.info(f"Found {len(event_elements)} WordPress posts")

            if not event_elements:
                logger.warning("No events found on page")
                browser.close()
                return events_found, events_new, events_updated

            for event_elem in event_elements:
                try:
                    # Extract title
                    title_elem = event_elem.find(["h1", "h2", "h3", "h4", ".event-title", ".evcal_event_title"])
                    if not title_elem:
                        title_elem = event_elem.find("a")

                    title = title_elem.get_text(strip=True) if title_elem else None

                    if not title or len(title) < 3:
                        continue

                    # Skip generic titles
                    if title.lower() in ["events", "upcoming events", "calendar", "past events"]:
                        continue

                    # Extract date
                    date_elem = event_elem.find(["time", ".event-date", ".evcal_date", "[class*='date']"])
                    date_text = None

                    if date_elem:
                        # Check for datetime attribute first
                        if date_elem.get("datetime"):
                            date_text = date_elem.get("datetime")
                        else:
                            date_text = date_elem.get_text(strip=True)

                    # If no date element, look in the text
                    if not date_text:
                        text = event_elem.get_text()
                        date_match = re.search(
                            r"(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:,?\s+\d{4})?",
                            text,
                            re.IGNORECASE
                        )
                        if date_match:
                            date_text = date_match.group(0)

                    if not date_text:
                        logger.debug(f"No date found for: {title}")
                        continue

                    start_date, start_time = parse_eventon_date(date_text)

                    if not start_date:
                        logger.debug(f"Could not parse date '{date_text}' for: {title}")
                        continue

                    # Extract time if not already found
                    if not start_time:
                        time_elem = event_elem.find([".event-time", ".evcal_time", "[class*='time']"])
                        if time_elem:
                            time_text = time_elem.get_text(strip=True)
                            start_time = parse_eventon_time(time_text)

                    # Extract description
                    desc_elem = event_elem.find([".event-description", ".evcal_desc", ".entry-summary", "p"])
                    description = None
                    if desc_elem:
                        description = desc_elem.get_text(strip=True)[:500]

                    # Extract event URL
                    link_elem = event_elem.find("a")
                    event_url = EVENTS_URL
                    if link_elem and link_elem.get("href"):
                        href = link_elem.get("href")
                        if href.startswith("http"):
                            event_url = href
                        elif href.startswith("/"):
                            event_url = BASE_URL + href

                    # Extract image
                    image_url = None
                    img_elem = event_elem.find("img")
                    if img_elem:
                        image_url = img_elem.get("src") or img_elem.get("data-src")

                    events_found += 1

                    # Generate content hash
                    content_hash = generate_content_hash(title, "Trolley Barn", start_date)

                    # Check for existing event
                    if find_event_by_hash(content_hash):
                        events_updated += 1
                        continue

                    # Determine category
                    category, subcategory, event_tags = determine_category(
                        title, description or ""
                    )

                    # Check for free events
                    combined_text = f"{title} {description or ''}".lower()
                    is_free = "free" in combined_text or "no charge" in combined_text

                    # Extract pricing if mentioned
                    price_min = None
                    price_max = None
                    price_match = re.search(r"\$(\d+)", combined_text)
                    if price_match:
                        price_min = float(price_match.group(1))
                        price_max = price_min

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
                        "tags": event_tags,
                        "price_min": price_min,
                        "price_max": price_max,
                        "price_note": None,
                        "is_free": is_free,
                        "source_url": event_url,
                        "ticket_url": event_url,
                        "image_url": image_url,
                        "raw_text": f"{title} - {description or ''}",
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
                    logger.debug(f"Error processing event element: {e}")
                    continue

            browser.close()

        logger.info(
            f"Trolley Barn crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Trolley Barn: {e}")
        raise

    return events_found, events_new, events_updated
