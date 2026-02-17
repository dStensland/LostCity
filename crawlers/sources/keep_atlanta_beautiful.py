"""
Crawler for Keep Atlanta Beautiful (keepatlantabeautiful.org).
Environmental nonprofit organizing park cleanups, tree plantings, street beautification,
and community engagement events throughout Atlanta.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime
from typing import Optional

from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout

from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://keepatlantabeautiful.org"

VENUE_DATA = {
    "name": "Keep Atlanta Beautiful",
    "slug": "keep-atlanta-beautiful",
    "address": "675 Ponce de Leon Ave NE",
    "neighborhood": "Poncey-Highland",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30308",
    "lat": 33.7716,
    "lng": -84.3656,
    "venue_type": "nonprofit",
    "spot_type": "nonprofit",
    "website": BASE_URL,
    "description": "Environmental nonprofit dedicated to making Atlanta cleaner and greener through volunteer programs.",
}


def parse_date_string(date_str: str) -> Optional[str]:
    """Parse date from various formats found on the website."""
    if not date_str:
        return None

    date_str = date_str.strip()
    now = datetime.now()

    # Try various date formats
    formats = [
        "%B %d, %Y",
        "%b %d, %Y",
        "%m/%d/%Y",
        "%Y-%m-%d",
    ]

    for fmt in formats:
        try:
            dt = datetime.strptime(date_str, fmt)
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            continue

    # Try partial date (Month Day without year)
    match = re.search(
        r'(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})',
        date_str,
        re.IGNORECASE
    )
    if match:
        month_str = match.group(1)[:3]
        day = match.group(2)
        try:
            dt = datetime.strptime(f"{month_str} {day} {now.year}", "%b %d %Y")
            if dt.date() < now.date():
                dt = dt.replace(year=now.year + 1)
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            pass

    return None


def parse_time_string(time_str: str) -> Optional[str]:
    """Parse time string into HH:MM format."""
    if not time_str:
        return None

    time_str = time_str.strip()

    # Pattern for "9:00 AM" or "9am"
    match = re.search(r'(\d{1,2}):?(\d{2})?\s*(am|pm)', time_str, re.IGNORECASE)
    if match:
        hour, minute, period = match.groups()
        hour = int(hour)
        minute = minute or "00"

        if period.lower() == "pm" and hour != 12:
            hour += 12
        elif period.lower() == "am" and hour == 12:
            hour = 0

        return f"{hour:02d}:{minute}"

    return None


def determine_category(title: str, description: str = "") -> tuple[str, Optional[str], list[str]]:
    """Determine event category based on title and description."""
    combined = f"{title} {description}".lower()
    tags = ["environmental", "volunteer", "keep-atlanta-beautiful"]

    # Cleanup events
    if any(word in combined for word in ["cleanup", "clean-up", "clean up", "litter", "trash", "street"]):
        tags.extend(["cleanup", "outdoor", "community"])
        return "outdoor", "cleanup", tags

    # Tree planting
    if any(word in combined for word in ["tree", "planting", "plant"]):
        tags.extend(["tree-planting", "outdoor", "community"])
        return "outdoor", "tree-planting", tags

    # Beautification
    if any(word in combined for word in ["beautification", "garden", "landscaping", "mural"]):
        tags.extend(["beautification", "outdoor", "community"])
        return "outdoor", "beautification", tags

    # Education/workshops
    if any(word in combined for word in ["workshop", "class", "training", "education", "learn"]):
        tags.extend(["education", "workshop"])
        return "learning", "workshop", tags

    # Community events
    tags.append("community")
    return "community", "volunteer", tags


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Keep Atlanta Beautiful events."""
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

            # Try multiple possible event URLs
            event_urls = [
                f"{BASE_URL}/get-involved/",
                f"{BASE_URL}/events/",
                f"{BASE_URL}/calendar/",
                BASE_URL,
            ]

            page_loaded = False
            for url in event_urls:
                try:
                    logger.info(f"Trying URL: {url}")
                    page.goto(url, wait_until="domcontentloaded", timeout=30000)
                    page.wait_for_timeout(3000)
                    page_loaded = True
                    break
                except Exception as e:
                    logger.debug(f"Failed to load {url}: {e}")
                    continue

            if not page_loaded:
                logger.warning("Failed to load any event pages")
                browser.close()
                return 0, 0, 0

            # Scroll to load dynamic content
            for _ in range(3):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1000)

            # Look for event elements
            event_selectors = [
                ".event",
                ".et_pb_post",
                "article",
                ".calendar-event",
                "[class*='event']",
            ]

            events_elements = []
            for selector in event_selectors:
                elements = page.query_selector_all(selector)
                if elements:
                    logger.info(f"Found {len(elements)} potential events using selector: {selector}")
                    events_elements = elements
                    break

            for elem in events_elements:
                try:
                    elem_text = elem.inner_text()
                    elem_html = elem.inner_html()

                    # Look for title
                    title_elem = elem.query_selector("h1, h2, h3, h4, .title, .event-title")
                    if not title_elem:
                        continue

                    title = title_elem.inner_text().strip()
                    if len(title) < 5:
                        continue

                    # Look for date
                    date_str = None
                    date_match = re.search(
                        r'(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:,\s+\d{4})?',
                        elem_text,
                        re.IGNORECASE
                    )
                    if date_match:
                        date_str = date_match.group()

                    if not date_str:
                        continue

                    start_date = parse_date_string(date_str)
                    if not start_date:
                        continue

                    # Skip past events
                    if datetime.strptime(start_date, "%Y-%m-%d").date() < datetime.now().date():
                        continue

                    events_found += 1

                    # Look for time
                    time_match = re.search(r'\d{1,2}:?\d{0,2}\s*(?:am|pm)', elem_text, re.IGNORECASE)
                    start_time = parse_time_string(time_match.group()) if time_match else None

                    # Extract description
                    desc_elem = elem.query_selector("p, .description, .excerpt")
                    description = desc_elem.inner_text().strip() if desc_elem else f"Event hosted by Keep Atlanta Beautiful"

                    # Get event URL
                    link_elem = elem.query_selector("a")
                    event_url = link_elem.get_attribute("href") if link_elem else BASE_URL
                    if event_url and not event_url.startswith("http"):
                        event_url = BASE_URL + event_url

                    # Determine category
                    category, subcategory, tags = determine_category(title, description)

                    # Generate content hash
                    content_hash = generate_content_hash(title, "Keep Atlanta Beautiful", start_date)

                    event_record = {
                        "source_id": source_id,
                        "venue_id": venue_id,
                        "title": title,
                        "description": description[:2000] if description else None,
                        "start_date": start_date,
                        "start_time": start_time,
                        "end_date": None,
                        "end_time": None,
                        "is_all_day": False,  # Set explicitly, not inferred from missing time
                        "category": category,
                        "tags": tags,
                        "price_min": None,
                        "price_max": None,
                        "price_note": None,
                        "is_free": True,
                        "source_url": event_url,
                        "ticket_url": None,
                        "image_url": None,
                        "raw_text": elem_text[:500],
                        "extraction_confidence": 0.80,
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
                        logger.error(f"Failed to insert event '{title}': {e}")

                except Exception as e:
                    logger.debug(f"Error processing event element: {e}")
                    continue

            browser.close()

        logger.info(
            f"Keep Atlanta Beautiful crawl complete: {events_found} found, "
            f"{events_new} new, {events_updated} existing"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Keep Atlanta Beautiful: {e}")
        raise

    return events_found, events_new, events_updated
