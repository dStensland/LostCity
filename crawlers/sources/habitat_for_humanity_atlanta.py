"""
Crawler for Habitat for Humanity Atlanta (atlantahabitat.org).

Major nonprofit building affordable housing. Volunteer opportunities include
house builds, ReStore volunteering, and community events.

Uses Webflow with JavaScript rendering.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime
from typing import Optional

from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout

from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash
from utils import extract_images_from_page, extract_event_links, find_event_url

logger = logging.getLogger(__name__)

BASE_URL = "https://atlantahabitat.org"
EVENTS_URL = f"{BASE_URL}/volunteer"

VENUE_DATA = {
    "name": "Habitat for Humanity Atlanta",
    "slug": "habitat-for-humanity-atlanta",
    "address": "824 Memorial Dr SE",
    "neighborhood": "Reynoldstown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30316",
    "lat": 33.7407,
    "lng": -84.3582,
    "venue_type": "nonprofit",
    "spot_type": "nonprofit",
    "website": BASE_URL,
    "vibes": ["volunteer", "family-friendly"],
}

# Skip staff meetings and internal events
SKIP_KEYWORDS = [
    "staff meeting",
    "board meeting",
    "committee",
    "internal",
    "closed",
    "private",
    "homeowner",
]

# Volunteer event indicators
VOLUNTEER_KEYWORDS = [
    "volunteer",
    "build",
    "restore",
    "construction",
    "opportunity",
    "help",
    "service",
]


def parse_time(time_text: str) -> Optional[str]:
    """Parse time from various formats like '7pm', '10:30 AM', '9:00 am - 12:00 pm'."""
    if not time_text:
        return None

    # Try to extract first time from range
    match = re.search(r"(\d{1,2})(?::(\d{2}))?\s*(am|pm)", time_text, re.IGNORECASE)
    if match:
        hour = int(match.group(1))
        minute = match.group(2) or "00"
        period = match.group(3).lower()

        if period == "pm" and hour != 12:
            hour += 12
        elif period == "am" and hour == 12:
            hour = 0

        return f"{hour:02d}:{minute}"
    return None


def parse_date_string(date_str: str) -> Optional[str]:
    """
    Parse date from various formats.
    Returns YYYY-MM-DD format string or None.
    """
    if not date_str:
        return None

    date_str = date_str.strip()
    current_year = datetime.now().year

    # Remove day name if present
    date_str = re.sub(r"^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*,?\s+", "", date_str, flags=re.IGNORECASE)

    # Try full month name formats
    date_match = re.search(
        r"(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})(?:,?\s+(\d{4}))?",
        date_str,
        re.IGNORECASE
    )
    if date_match:
        month = date_match.group(1)
        day = int(date_match.group(2))
        year = int(date_match.group(3)) if date_match.group(3) else current_year
        try:
            dt = datetime.strptime(f"{month} {day} {year}", "%B %d %Y")
            if dt.date() < datetime.now().date() and not date_match.group(3):
                dt = datetime.strptime(f"{month} {day} {year + 1}", "%B %d %Y")
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            pass

    # Try short month name formats
    date_match = re.search(
        r"(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})(?:,?\s+(\d{4}))?",
        date_str,
        re.IGNORECASE
    )
    if date_match:
        month = date_match.group(1)
        day = int(date_match.group(2))
        year = int(date_match.group(3)) if date_match.group(3) else current_year
        try:
            dt = datetime.strptime(f"{month} {day} {year}", "%b %d %Y")
            if dt.date() < datetime.now().date() and not date_match.group(3):
                dt = datetime.strptime(f"{month} {day} {year + 1}", "%b %d %Y")
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            pass

    # Try M/D/YYYY
    date_match = re.search(r"(\d{1,2})/(\d{1,2})/(\d{4})", date_str)
    if date_match:
        month, day, year = date_match.groups()
        try:
            dt = datetime.strptime(f"{month}/{day}/{year}", "%m/%d/%Y")
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            pass

    return None


def determine_category_and_tags(title: str, description: str) -> tuple[str, Optional[str], list[str]]:
    """Determine category based on title and description."""
    text = f"{title} {description}".lower()
    tags = ["volunteer", "nonprofit", "housing"]

    # Most events are volunteer opportunities
    if any(kw in text for kw in VOLUNTEER_KEYWORDS):
        tags.append("volunteer-opportunity")

    if any(kw in text for kw in ["family", "kid", "children", "all ages"]):
        tags.append("family-friendly")

    if any(kw in text for kw in ["build", "construction", "house"]):
        tags.append("construction")

    if any(kw in text for kw in ["restore", "repair", "renovation"]):
        tags.append("restoration")

    if any(kw in text for kw in ["training", "orientation", "workshop"]):
        return "learning", "workshop", tags + ["education"]

    if any(kw in text for kw in ["fundraiser", "gala", "benefit"]):
        return "community", "fundraiser", tags + ["fundraiser"]

    # Default to community/volunteer
    return "community", "volunteer", tags


def is_public_event(title: str, description: str) -> bool:
    """Determine if event is public volunteer opportunity vs. internal."""
    text = f"{title} {description}".lower()

    # Skip internal events
    if any(kw in text for kw in SKIP_KEYWORDS):
        return False

    # Most events are volunteer opportunities
    return True


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Habitat for Humanity Atlanta volunteer events using Playwright."""
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

            logger.info(f"Fetching Habitat for Humanity Atlanta: {EVENTS_URL}")
            page.goto(EVENTS_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(5000)

            # Scroll to load all content (Webflow often lazy loads)
            for _ in range(5):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1000)

            # Extract images from page
            image_map = extract_images_from_page(page)

            # Extract event links for specific URLs
            event_links = extract_event_links(page, BASE_URL)

            # Try common event selectors for Webflow
            event_selectors = [
                ".event-item",
                ".event-card",
                "[class*='event']",
                ".volunteer-opportunity",
                "[class*='volunteer']",
                ".opportunity",
                "article",
                ".card",
            ]

            event_elements = []
            for selector in event_selectors:
                elements = page.query_selector_all(selector)
                if elements and len(elements) > 3:  # Need at least a few elements
                    logger.info(f"Found {len(elements)} events using selector: {selector}")
                    event_elements = elements
                    break

            seen_events = set()

            if event_elements:
                logger.info(f"Processing {len(event_elements)} event containers")

                for elem in event_elements:
                    try:
                        # Extract full text from container
                        elem_text = elem.inner_text().strip()

                        # Skip if too short to be an event
                        if len(elem_text) < 20:
                            continue

                        lines = [l.strip() for l in elem_text.split("\n") if l.strip()]

                        if not lines:
                            continue

                        # Look for title - usually in a heading or prominent text
                        title_elem = elem.query_selector("h1, h2, h3, h4, h5, .title, [class*='title'], .heading")
                        if title_elem:
                            title = title_elem.inner_text().strip()
                        else:
                            # Fallback to first substantial line
                            title = None
                            for line in lines:
                                if len(line) > 10 and len(line) < 200:
                                    title = line
                                    break

                        if not title or len(title) < 5:
                            continue

                        # Look for date in the element
                        start_date = None
                        date_elem = elem.query_selector(".date, .event-date, time, [class*='date']")
                        if date_elem:
                            date_text = date_elem.inner_text().strip()
                            start_date = parse_date_string(date_text)

                        # If not found in element, search in text
                        if not start_date:
                            for line in lines:
                                parsed_date = parse_date_string(line)
                                if parsed_date:
                                    start_date = parsed_date
                                    break

                        if not start_date:
                            logger.debug(f"No date found for: {title[:50]}")
                            continue

                        # Look for time
                        start_time = None
                        time_elem = elem.query_selector(".time, .event-time, [class*='time']")
                        if time_elem:
                            time_text = time_elem.inner_text().strip()
                            start_time = parse_time(time_text)

                        if not start_time:
                            for line in lines:
                                parsed_time = parse_time(line)
                                if parsed_time:
                                    start_time = parsed_time
                                    break

                        # Extract description
                        description = ""
                        desc_elem = elem.query_selector(".description, .event-description, p, [class*='description']")
                        if desc_elem:
                            description = desc_elem.inner_text().strip()[:500]

                        if not description:
                            # Use text that's not the title
                            desc_parts = []
                            for line in lines:
                                if line != title and len(line) > 30:
                                    desc_parts.append(line)
                                    if len(" ".join(desc_parts)) > 200:
                                        break
                            description = " ".join(desc_parts)[:500]

                        # Check if public
                        if not is_public_event(title, description):
                            logger.debug(f"Skipping internal event: {title}")
                            continue

                        # Dedupe
                        event_key = f"{title}|{start_date}"
                        if event_key in seen_events:
                            continue
                        seen_events.add(event_key)

                        events_found += 1

                        # Generate content hash
                        content_hash = generate_content_hash(
                            title, "Habitat for Humanity Atlanta", start_date
                        )

                        # Check for existing

                        # Determine category and tags
                        category, subcategory, tags = determine_category_and_tags(title, description)

                        # Look for event URL
                        event_url = find_event_url(title, event_links, EVENTS_URL)

                        # Build event record
                        event_record = {
                            "source_id": source_id,
                            "venue_id": venue_id,
                            "title": title[:200],
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
                            "price_note": None,
                            "is_free": True,
                            "source_url": event_url,
                            "ticket_url": event_url,
                            "image_url": image_map.get(title),
                            "raw_text": f"{title} {description}"[:500],
                            "extraction_confidence": 0.85,
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
                            logger.info(f"Added: {title[:50]}... on {start_date}")
                        except Exception as e:
                            logger.error(f"Failed to insert: {title}: {e}")

                    except Exception as e:
                        logger.error(f"Error processing event element: {e}")
                        continue

            browser.close()

        logger.info(
            f"Habitat for Humanity Atlanta crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except PlaywrightTimeout as e:
        logger.error(f"Timeout fetching Habitat for Humanity Atlanta: {e}")
        raise
    except Exception as e:
        logger.error(f"Failed to crawl Habitat for Humanity Atlanta: {e}")
        raise

    return events_found, events_new, events_updated
