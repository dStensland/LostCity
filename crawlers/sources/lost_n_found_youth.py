"""
Crawler for Lost-N-Found Youth (lnfy.org).

Provides services for LGBTQ homeless youth ages 18-25 in Atlanta.
Offers shelter, case management, and support services.
Hosts fundraisers, volunteer events, and community gatherings.
Site uses JavaScript rendering - must use Playwright.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime
from typing import Optional

from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout

from db import get_or_create_venue, insert_event, find_event_by_hash
from dedupe import generate_content_hash
from utils import extract_images_from_page

logger = logging.getLogger(__name__)

BASE_URL = "https://lnfy.org"
EVENTS_URL = f"{BASE_URL}/events"
GET_INVOLVED_URL = f"{BASE_URL}/get-involved"

# Lost-N-Found Youth main location
LNFY_HQ = {
    "name": "Lost-N-Found Youth",
    "slug": "lost-n-found-youth",
    "address": "2585 Chantilly Dr NE",
    "neighborhood": "Cheshire Bridge",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30324",
    "lat": 33.8163,
    "lng": -84.3536,
    "venue_type": "nonprofit",
    "spot_type": "nonprofit",
    "website": BASE_URL,
    "vibes": ["volunteer", "lgbtq", "lgbtq-friendly"],
}


def parse_event_date(date_text: str) -> Optional[dict]:
    """
    Parse various date formats from Lost-N-Found Youth events.
    Examples:
    - "February 15, 2026"
    - "March 1, 2026 at 6:00 PM"
    - "Saturday, April 10 @ 9:00 AM"
    """
    if not date_text:
        return None

    # Try format: "Day, Month DD, YYYY @ HH:MM AM/PM" or "Month DD, YYYY @ HH:MM AM/PM"
    match = re.search(
        r'(?:\w+,\s+)?(\w+)\s+(\d+),?\s+(\d{4})\s*[@at]?\s*(\d{1,2}):?(\d{2})?\s*(am|pm)?',
        date_text,
        re.IGNORECASE
    )

    if match:
        month, day, year, hour, minute, period = match.groups()
        try:
            dt = datetime.strptime(f"{month} {day} {year}", "%B %d %Y")
        except ValueError:
            try:
                dt = datetime.strptime(f"{month} {day} {year}", "%b %d %Y")
            except ValueError:
                return None

        start_date = dt.strftime("%Y-%m-%d")
        start_time = None

        if hour and period:
            hour = int(hour)
            minute = minute or "00"
            if period.lower() == "pm" and hour != 12:
                hour += 12
            elif period.lower() == "am" and hour == 12:
                hour = 0
            start_time = f"{hour:02d}:{minute}"

        return {
            "start_date": start_date,
            "start_time": start_time,
        }

    # Try simple format: "Month DD, YYYY"
    match = re.search(r'(\w+)\s+(\d+),?\s+(\d{4})', date_text, re.IGNORECASE)
    if match:
        month, day, year = match.groups()
        try:
            dt = datetime.strptime(f"{month} {day} {year}", "%B %d %Y")
        except ValueError:
            try:
                dt = datetime.strptime(f"{month} {day} {year}", "%b %d %Y")
            except ValueError:
                return None

        return {
            "start_date": dt.strftime("%Y-%m-%d"),
            "start_time": None,
        }

    return None


def determine_category(title: str, description: str = "") -> str:
    """Determine event category based on title and description."""
    text = f"{title} {description}".lower()

    if any(word in text for word in ["volunteer", "serve", "help", "community service"]):
        return "community"
    if any(word in text for word in ["gala", "fundraiser", "benefit", "auction", "donation"]):
        return "community"
    if any(word in text for word in ["workshop", "training", "class", "seminar", "education"]):
        return "learning"
    if any(word in text for word in ["pride", "celebration", "party", "social"]):
        return "community"
    if any(word in text for word in ["art", "performance", "show", "concert"]):
        return "music"

    return "community"


def extract_tags(title: str, description: str = "") -> list[str]:
    """Extract relevant tags from event content."""
    text = f"{title} {description}".lower()
    tags = ["lgbtq", "lgbtq-friendly"]  # Default tags for LNFY

    if any(word in text for word in ["volunteer", "serve", "help"]):
        tags.append("volunteer")
    if any(word in text for word in ["youth", "young adult", "18-25"]):
        tags.append("youth")
    if any(word in text for word in ["fundraiser", "gala", "benefit", "donation"]):
        tags.append("fundraiser")
    if any(word in text for word in ["homeless", "housing", "shelter"]):
        tags.append("homelessness")
    if any(word in text for word in ["pride", "queer", "trans", "transgender"]):
        tags.append("pride")
    if any(word in text for word in ["mental health", "therapy", "counseling"]):
        tags.append("mental-health")
    if any(word in text for word in ["free", "no cost"]):
        tags.append("free")
    if any(word in text for word in ["charity", "nonprofit"]):
        tags.append("charity")
    if any(word in text for word in ["drag", "performance"]):
        tags.append("drag")
    if any(word in text for word in ["community", "support group"]):
        tags.append("community")

    return list(set(tags))


def is_free_event(title: str, description: str = "") -> bool:
    """Determine if event is free based on content."""
    text = f"{title} {description}".lower()

    # Most volunteer events are free
    if any(word in text for word in ["volunteer", "serve", "help out"]):
        return True

    # Check for explicit free mentions
    if any(word in text for word in ["free", "no cost", "no charge"]):
        return True

    # Check for paid indicators
    if any(word in text for word in ["$", "ticket", "registration fee", "cost:", "price:"]):
        # But galas/fundraisers have tickets
        if "gala" in text or "fundraiser" in text or "benefit" in text:
            return False
        return False

    # Default to True for community events
    return True


def is_public_event(title: str, description: str = "") -> bool:
    """Filter out internal staff meetings and private events."""
    text = f"{title} {description}".lower()

    # Skip internal/private events
    if any(word in text for word in [
        "staff meeting", "board meeting", "internal", "private",
        "employees only", "staff only", "team meeting", "clients only"
    ]):
        return False

    return True


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl Lost-N-Found Youth events and volunteer opportunities using Playwright.

    Checks both /events and /get-involved pages for public events.
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

            # Get venue ID for Lost-N-Found Youth HQ
            venue_id = get_or_create_venue(LNFY_HQ)

            # Try both events and get-involved pages
            urls_to_check = [EVENTS_URL, GET_INVOLVED_URL]

            for url in urls_to_check:
                try:
                    logger.info(f"Fetching Lost-N-Found Youth page: {url}")
                    page.goto(url, wait_until="domcontentloaded", timeout=30000)
                    page.wait_for_timeout(5000)

                    # Extract images from page
                    image_map = extract_images_from_page(page)

                    # Scroll to load all content
                    for _ in range(5):
                        page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                        page.wait_for_timeout(1000)

                    # Try to find event/volunteer containers
                    event_selectors = [
                        ".event-item",
                        ".volunteer-opportunity",
                        ".event-card",
                        ".tribe-event",
                        "article[class*='event']",
                        ".post-type-event",
                        ".opportunity",
                        ".calendar-event",
                    ]

                    events = []
                    for selector in event_selectors:
                        try:
                            elements = page.query_selector_all(selector)
                            if elements:
                                events = elements
                                logger.info(f"Found {len(events)} items using selector: {selector}")
                                break
                        except Exception:
                            continue

                    if not events:
                        # Fall back to parsing text content
                        logger.info(f"No event containers found on {url}, parsing text content")
                        body_text = page.inner_text("body")
                        lines = [l.strip() for l in body_text.split("\n") if l.strip()]

                        i = 0
                        while i < len(lines):
                            line = lines[i]

                            # Skip short lines and navigation
                            if len(line) < 10 or any(skip in line.lower() for skip in [
                                "navigation", "menu", "footer", "copyright", "privacy",
                                "contact us", "about", "donate", "search"
                            ]):
                                i += 1
                                continue

                            # Try to parse date
                            date_data = parse_event_date(line)

                            if date_data:
                                # Previous line might be title
                                title = None
                                if i > 0:
                                    potential_title = lines[i - 1]
                                    if len(potential_title) > 10 and not parse_event_date(potential_title):
                                        title = potential_title

                                # Next lines might be description
                                description = ""
                                if i + 1 < len(lines):
                                    potential_desc = lines[i + 1]
                                    if len(potential_desc) > 20:
                                        description = potential_desc

                                if title and is_public_event(title, description):
                                    events_found += 1

                                    category = determine_category(title, description)
                                    tags = extract_tags(title, description)
                                    is_free = is_free_event(title, description)

                                    content_hash = generate_content_hash(
                                        title, "Lost-N-Found Youth", date_data["start_date"]
                                    )

                                    if find_event_by_hash(content_hash):
                                        events_updated += 1
                                        i += 1
                                        continue

                                    event_record = {
                                        "source_id": source_id,
                                        "venue_id": venue_id,
                                        "title": title,
                                        "description": description if description else None,
                                        "start_date": date_data["start_date"],
                                        "start_time": date_data["start_time"],
                                        "end_date": None,
                                        "end_time": None,
                                        "is_all_day": False,
                                        "category": category,
                                        "subcategory": None,
                                        "tags": tags,
                                        "price_min": None,
                                        "price_max": None,
                                        "price_note": None,
                                        "is_free": is_free,
                                        "source_url": url,
                                        "ticket_url": None,
                                        "image_url": image_map.get(title),
                                        "raw_text": f"{title} | {line} | {description[:200]}"[:500],
                                        "extraction_confidence": 0.80,
                                        "is_recurring": False,
                                        "recurrence_rule": None,
                                        "content_hash": content_hash,
                                    }

                                    try:
                                        insert_event(event_record)
                                        events_new += 1
                                        logger.info(f"Added: {title} on {date_data['start_date']}")
                                    except Exception as e:
                                        logger.error(f"Failed to insert: {title}: {e}")

                            i += 1
                    else:
                        # Parse structured event elements
                        for event_elem in events:
                            try:
                                title = event_elem.inner_text().split("\n")[0].strip()
                                event_text = event_elem.inner_text()

                                # Extract date
                                date_data = parse_event_date(event_text)
                                if not date_data:
                                    continue

                                # Extract description
                                description = ""
                                lines = event_text.split("\n")
                                for line in lines[2:]:
                                    if len(line) > 20:
                                        description = line
                                        break

                                # Filter out private events
                                if not is_public_event(title, description):
                                    continue

                                events_found += 1

                                category = determine_category(title, description)
                                tags = extract_tags(title, description)
                                is_free = is_free_event(title, description)

                                content_hash = generate_content_hash(
                                    title, "Lost-N-Found Youth", date_data["start_date"]
                                )

                                if find_event_by_hash(content_hash):
                                    events_updated += 1
                                    continue

                                event_record = {
                                    "source_id": source_id,
                                    "venue_id": venue_id,
                                    "title": title,
                                    "description": description if description else None,
                                    "start_date": date_data["start_date"],
                                    "start_time": date_data["start_time"],
                                    "end_date": None,
                                    "end_time": None,
                                    "is_all_day": False,
                                    "category": category,
                                    "subcategory": None,
                                    "tags": tags,
                                    "price_min": None,
                                    "price_max": None,
                                    "price_note": None,
                                    "is_free": is_free,
                                    "source_url": url,
                                    "ticket_url": None,
                                    "image_url": image_map.get(title),
                                    "raw_text": event_text[:500],
                                    "extraction_confidence": 0.85,
                                    "is_recurring": False,
                                    "recurrence_rule": None,
                                    "content_hash": content_hash,
                                }

                                try:
                                    insert_event(event_record)
                                    events_new += 1
                                    logger.info(f"Added: {title} on {date_data['start_date']}")
                                except Exception as e:
                                    logger.error(f"Failed to insert: {title}: {e}")

                            except Exception as e:
                                logger.warning(f"Failed to parse event element: {e}")
                                continue

                except Exception as e:
                    logger.warning(f"Failed to fetch {url}: {e}")
                    continue

            browser.close()

        logger.info(
            f"Lost-N-Found Youth crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except PlaywrightTimeout as e:
        logger.error(f"Timeout fetching Lost-N-Found Youth: {e}")
        raise
    except Exception as e:
        logger.error(f"Failed to crawl Lost-N-Found Youth: {e}")
        raise

    return events_found, events_new, events_updated
