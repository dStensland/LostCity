"""
Crawler for Trees Atlanta (treesatlanta.org/events).

Trees Atlanta organizes volunteer tree plantings, nature walks, trail maintenance,
and community events. Site uses JavaScript rendering - must use Playwright.
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

BASE_URL = "https://www.treesatlanta.org"
EVENTS_URL = f"{BASE_URL}/get-involved/events/"

# Trees Atlanta HQ venue
TREES_ATLANTA_HQ = {
    "name": "Trees Atlanta",
    "slug": "trees-atlanta",
    "address": "225 Chester Ave SE",
    "neighborhood": "Grant Park",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30316",
    "venue_type": "nonprofit",
    "website": BASE_URL,
}


def parse_event_line(line: str) -> Optional[dict]:
    """
    Parse Trees Atlanta event line format: 'Day Mon DD | HH:MMam/pm-HH:MMam/pm | Location'
    Example: 'Sat Jan 31 | 9am-12pm | Morningside/Lenox Park'
    """
    # Pattern: Day Mon DD | Time | Location
    match = re.match(
        r'(\w+)\s+(\w+)\s+(\d+)\s*\|\s*([\d:apm\-]+)\s*\|\s*(.+)',
        line,
        re.IGNORECASE
    )

    if not match:
        return None

    day_name, month_abbr, day, time_range, location = match.groups()

    # Parse date
    try:
        current_year = datetime.now().year
        month_abbr = month_abbr[:3]  # Ensure 3-letter abbrev
        dt = datetime.strptime(f"{month_abbr} {day} {current_year}", "%b %d %Y")

        # If date is in the past, assume next year
        if dt.date() < datetime.now().date():
            dt = datetime.strptime(f"{month_abbr} {day} {current_year + 1}", "%b %d %Y")

        start_date = dt.strftime("%Y-%m-%d")
    except ValueError:
        return None

    # Parse time
    start_time = None
    time_match = re.search(r'(\d{1,2}):?(\d{2})?(am|pm)', time_range, re.IGNORECASE)
    if time_match:
        hour, minute, period = time_match.groups()
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
        "location": location.strip(),
    }


def determine_category(title: str, description: str = "") -> str:
    """Determine event category based on title and description."""
    text = f"{title} {description}".lower()

    if any(word in text for word in ["volunteer", "planting", "tree plant", "cleanup", "trail maintenance", "care", "project ambassador"]):
        return "community"
    if any(word in text for word in ["walk", "hike", "nature walk", "tour", "trail"]):
        return "outdoor"
    if any(word in text for word in ["workshop", "class", "training", "education", "docent", "ask the expert"]):
        return "education"
    if any(word in text for word in ["fundraiser", "gala", "benefit"]):
        return "community"

    return "community"


def extract_tags(title: str, description: str = "") -> list[str]:
    """Extract relevant tags from event content."""
    text = f"{title} {description}".lower()
    tags = []

    if any(word in text for word in ["volunteer", "planting", "cleanup", "care", "project ambassador"]):
        tags.append("volunteer")
    if any(word in text for word in ["tree", "trees", "planting", "pruning"]):
        tags.append("trees")
    if any(word in text for word in ["trail", "park", "nature preserve", "forest"]):
        tags.append("parks")
    if any(word in text for word in ["outdoor", "nature"]):
        tags.append("outdoor")
    if any(word in text for word in ["walk", "hike"]):
        tags.append("walking")
    if any(word in text for word in ["family", "kid", "children", "all ages"]):
        tags.append("family-friendly")
    if any(word in text for word in ["education", "training", "learn"]):
        tags.append("education")
    if "beltline" in text:
        tags.append("beltline")

    # Add nature tag by default for Trees Atlanta events
    if "outdoor" not in tags:
        tags.append("nature")

    # Add free tag (most events are free)
    tags.append("free")

    return list(set(tags))


def is_free_event(title: str, description: str = "") -> bool:
    """Determine if event is free based on content."""
    text = f"{title} {description}".lower()

    # Most volunteer events are free
    if any(word in text for word in ["volunteer", "planting", "cleanup", "tree plant"]):
        return True

    # Check for explicit free mentions
    if any(word in text for word in ["free", "no cost", "no charge"]):
        return True

    # Check for paid indicators
    if any(word in text for word in ["$", "ticket", "registration fee", "cost:", "price:"]):
        return False

    # Default to True for Trees Atlanta (most events are free/volunteer)
    return True


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl Trees Atlanta events using Playwright.

    Event format on page:
    - Title
    - Day Mon DD | HH:MMam-HH:MMpm | Location
    - Description
    - LEARN MORE
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

            # Get venue ID for Trees Atlanta HQ
            venue_id = get_or_create_venue(TREES_ATLANTA_HQ)

            logger.info(f"Fetching Trees Atlanta events: {EVENTS_URL}")
            page.goto(EVENTS_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(5000)

            # Extract images from page
            image_map = extract_images_from_page(page)

            # Scroll to load all content
            for _ in range(5):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1000)

            # Get page text
            body_text = page.inner_text("body")
            lines = [l.strip() for l in body_text.split("\n") if l.strip()]

            # Parse line by line looking for event pattern
            i = 0
            while i < len(lines):
                line = lines[i]

                # Skip short lines and URLs
                if len(line) < 5 or line.startswith("http"):
                    i += 1
                    continue

                # Try to parse as event date/time/location line
                event_data = parse_event_line(line)

                if event_data:
                    # Previous line should be the title
                    title = None
                    if i > 0:
                        potential_title = lines[i - 1]
                        # Make sure it's not a URL or too short
                        if len(potential_title) > 10 and not potential_title.startswith("http"):
                            title = potential_title

                    # Next line should be description
                    description = ""
                    if i + 1 < len(lines):
                        potential_desc = lines[i + 1]
                        if len(potential_desc) > 20 and not potential_desc.startswith("LEARN MORE"):
                            description = potential_desc

                    if title:
                        events_found += 1

                        category = determine_category(title, description)
                        tags = extract_tags(title, description)
                        is_free = is_free_event(title, description)

                        content_hash = generate_content_hash(
                            title, "Trees Atlanta", event_data["start_date"]
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
                            "start_date": event_data["start_date"],
                            "start_time": event_data["start_time"],
                            "end_date": None,
                            "end_time": None,
                            "is_all_day": event_data["start_time"] is None,
                            "category": category,
                            "subcategory": None,
                            "tags": tags,
                            "price_min": None,
                            "price_max": None,
                            "price_note": None,
                            "is_free": is_free,
                            "source_url": EVENTS_URL,
                            "ticket_url": None,
                            "image_url": image_map.get(title),
                            "raw_text": f"{title} | {line} | {description[:200]}"[:500],
                            "extraction_confidence": 0.85,
                            "is_recurring": False,
                            "recurrence_rule": None,
                            "content_hash": content_hash,
                        }

                        try:
                            insert_event(event_record)
                            events_new += 1
                            logger.info(f"Added: {title} on {event_data['start_date']}")
                        except Exception as e:
                            logger.error(f"Failed to insert: {title}: {e}")

                i += 1

            browser.close()

        logger.info(
            f"Trees Atlanta crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except PlaywrightTimeout as e:
        logger.error(f"Timeout fetching Trees Atlanta: {e}")
        raise
    except Exception as e:
        logger.error(f"Failed to crawl Trees Atlanta: {e}")
        raise

    return events_found, events_new, events_updated
