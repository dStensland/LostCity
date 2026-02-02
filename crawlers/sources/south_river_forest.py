"""
Crawler for South River Forest Coalition / Defend the Atlanta Forest.

Forest preservation and environmental justice organizing. This coalition
works to protect Atlanta's forests from development. Site uses JavaScript
rendering - must use Playwright.

Note: The actual website URL may need to be updated. Common URLs include:
- defendatlantaforest.org
- saveatlantasforests.org
- southriverforestcoalition.org
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

# TODO: Update this URL when the correct site is confirmed
BASE_URL = "https://defendatlantaforest.org"
EVENTS_URL = f"{BASE_URL}/events"

# Coalition organizing venue (virtual/TBD since they organize at various locations)
SRFC_VENUE = {
    "name": "South River Forest Coalition",
    "slug": "south-river-forest-coalition",
    "city": "Atlanta",
    "state": "GA",
    "venue_type": "nonprofit",
    "website": BASE_URL,
}


def parse_date_string(date_str: str) -> Optional[dict]:
    """
    Parse various date formats found on forest coalition events.
    Examples:
    - "February 15, 2026"
    - "Feb 15"
    - "2/15/2026"
    - "Saturday, Feb 15"
    """
    if not date_str:
        return None

    date_str = date_str.strip()
    current_year = datetime.now().year

    # Try various date formats
    patterns = [
        (r'(?:\w+,?\s+)?(\w+)\s+(\d{1,2}),?\s+(\d{4})', "%B %d %Y"),  # Saturday, February 15, 2026
        (r'(?:\w+,?\s+)?(\w+)\s+(\d{1,2})', "%B %d"),  # Saturday, Feb 15
        (r'(\d{1,2})/(\d{1,2})/(\d{4})', "%m/%d/%Y"),  # 2/15/2026
        (r'(\d{4})-(\d{2})-(\d{2})', "%Y-%m-%d"),  # 2026-02-15
    ]

    for pattern, format_str in patterns:
        match = re.search(pattern, date_str, re.IGNORECASE)
        if match:
            try:
                # Extract just the date parts (skip day name if present)
                if "%Y" not in format_str:
                    # Add current year
                    date_part = match.group(1) if match.lastindex >= 1 else ""
                    day_part = match.group(2) if match.lastindex >= 2 else ""
                    date_to_parse = f"{date_part} {day_part}"
                    dt = datetime.strptime(date_to_parse.strip(), format_str)
                    dt = dt.replace(year=current_year)
                    # If date is in the past, assume next year
                    if dt.date() < datetime.now().date():
                        dt = dt.replace(year=current_year + 1)
                else:
                    dt = datetime.strptime(date_str, format_str)

                return {
                    "start_date": dt.strftime("%Y-%m-%d"),
                }
            except ValueError:
                continue

    return None


def parse_time_string(time_str: str) -> Optional[str]:
    """
    Parse time string into HH:MM format.
    Examples: "6:30pm", "6pm", "18:30", "6:30 PM"
    """
    if not time_str:
        return None

    time_str = time_str.strip()

    # Pattern for "6:30pm" or "6pm"
    match = re.search(r'(\d{1,2}):?(\d{2})?\s*(am|pm)?', time_str, re.IGNORECASE)
    if match:
        hour, minute, period = match.groups()
        hour = int(hour)
        minute = minute or "00"

        if period:
            period = period.lower()
            if period == "pm" and hour != 12:
                hour += 12
            elif period == "am" and hour == 12:
                hour = 0

        return f"{hour:02d}:{minute}"

    return None


def determine_category(title: str, description: str = "") -> str:
    """Determine event category based on title and description."""
    text = f"{title} {description}".lower()

    if any(word in text for word in ["hike", "walk", "trail", "nature walk", "tour"]):
        return "outdoor"
    if any(word in text for word in ["workshop", "class", "training", "teach-in", "education"]):
        return "education"
    if any(word in text for word in ["film", "movie", "screening", "documentary"]):
        return "film"
    if any(word in text for word in ["rally", "march", "protest", "demonstration", "action"]):
        return "community"
    if any(word in text for word in ["cleanup", "planting", "restoration", "volunteer"]):
        return "outdoor"
    if any(word in text for word in ["music", "concert", "performance"]):
        return "music"

    # Default to community for organizing/activism events
    return "community"


def extract_tags(title: str, description: str = "") -> list[str]:
    """Extract relevant tags from event content."""
    text = f"{title} {description}".lower()
    tags = ["environmental", "forest", "activism"]

    if any(word in text for word in ["nature", "wildlife", "ecosystem"]):
        tags.append("nature")
    if any(word in text for word in ["hike", "walk", "trail"]):
        tags.append("hiking")
    if any(word in text for word in ["climate", "climate justice"]):
        tags.append("climate")
    if any(word in text for word in ["police", "cop city", "militarization"]):
        tags.append("police-abolition")
    if any(word in text for word in ["indigenous", "native"]):
        tags.append("indigenous")
    if any(word in text for word in ["justice", "environmental justice"]):
        tags.append("social-justice")
    if any(word in text for word in ["volunteer", "action", "organize"]):
        tags.append("volunteer")
    if any(word in text for word in ["meeting", "coalition", "planning"]):
        tags.append("meeting")
    if any(word in text for word in ["film", "screening"]):
        tags.append("film")
    if any(word in text for word in ["education", "teach-in", "workshop"]):
        tags.append("education")
    if any(word in text for word in ["rally", "march", "protest"]):
        tags.append("protest")
    if any(word in text for word in ["park", "recreation"]):
        tags.append("parks")
    if any(word in text for word in ["community", "neighborhood"]):
        tags.append("community")

    # Most forest coalition events are free
    if not any(word in text for word in ["$", "ticket", "cost", "fee", "donation"]):
        tags.append("free")

    return list(set(tags))


def is_free_event(title: str, description: str = "") -> bool:
    """Determine if event is free based on content."""
    text = f"{title} {description}".lower()

    # Check for explicit free mentions
    if any(word in text for word in ["free", "no cost", "no charge"]):
        return True

    # Check for paid indicators
    if any(word in text for word in ["$", "ticket", "registration fee", "cost:", "price:"]):
        return False

    # Default to True for forest coalition (most events are free)
    return True


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl South River Forest Coalition / Defend the Atlanta Forest events.

    The site structure may vary depending on which coalition website is active.
    This crawler attempts to find event listings in common formats.
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

            # Get venue ID for coalition
            venue_id = get_or_create_venue(SRFC_VENUE)

            logger.info(f"Fetching South River Forest Coalition events: {EVENTS_URL}")

            try:
                page.goto(EVENTS_URL, wait_until="domcontentloaded", timeout=30000)
                page.wait_for_timeout(5000)
            except Exception as e:
                # Try alternate URLs if /events doesn't work
                logger.warning(f"Failed to load /events, trying /calendar: {e}")
                try:
                    page.goto(f"{BASE_URL}/calendar", wait_until="domcontentloaded", timeout=30000)
                    page.wait_for_timeout(5000)
                except Exception as e2:
                    logger.warning(f"Failed to load /calendar, trying /actions: {e2}")
                    try:
                        page.goto(f"{BASE_URL}/actions", wait_until="domcontentloaded", timeout=30000)
                        page.wait_for_timeout(5000)
                    except Exception as e3:
                        logger.error(f"Failed to load any page: {e3}")
                        browser.close()
                        return events_found, events_new, events_updated

            # Extract images from page
            image_map = extract_images_from_page(page)

            # Scroll to load all content
            for _ in range(3):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1000)

            # Get page text for parsing
            body_text = page.inner_text("body")
            lines = [l.strip() for l in body_text.split("\n") if l.strip()]

            # Try to find event elements using common selectors
            event_selectors = [
                ".event",
                ".action",
                ".tribe-event",
                "article.event",
                ".upcoming-event",
                "[class*='event']",
                ".calendar-event",
            ]

            events_elements = []
            for selector in event_selectors:
                elements = page.query_selector_all(selector)
                if elements:
                    logger.info(f"Found {len(elements)} events using selector: {selector}")
                    events_elements = elements
                    break

            if events_elements:
                # Process structured event elements
                for elem in events_elements:
                    try:
                        elem_text = elem.inner_text()
                        elem_lines = [l.strip() for l in elem_text.split("\n") if l.strip()]

                        if len(elem_lines) < 2:
                            continue

                        # Assume first line is title
                        title = elem_lines[0]

                        # Look for date/time in subsequent lines
                        date_info = None
                        time_info = None
                        description = ""

                        for line in elem_lines[1:]:
                            if not date_info:
                                date_info = parse_date_string(line)
                            if not time_info:
                                time_info = parse_time_string(line)
                            if len(line) > 30 and not date_info and not time_info:
                                description = line
                                break

                        if not date_info:
                            continue

                        events_found += 1

                        category = determine_category(title, description)
                        tags = extract_tags(title, description)
                        is_free = is_free_event(title, description)

                        content_hash = generate_content_hash(
                            title, "South River Forest Coalition", date_info["start_date"]
                        )

                        if find_event_by_hash(content_hash):
                            events_updated += 1
                            continue

                        event_record = {
                            "source_id": source_id,
                            "venue_id": venue_id,
                            "title": title,
                            "description": description if description else None,
                            "start_date": date_info["start_date"],
                            "start_time": time_info,
                            "end_date": None,
                            "end_time": None,
                            "is_all_day": time_info is None,
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
                            "raw_text": f"{title} | {elem_text[:400]}"[:500],
                            "extraction_confidence": 0.80,
                            "is_recurring": False,
                            "recurrence_rule": None,
                            "content_hash": content_hash,
                        }

                        try:
                            insert_event(event_record)
                            events_new += 1
                            logger.info(f"Added: {title} on {date_info['start_date']}")
                        except Exception as e:
                            logger.error(f"Failed to insert: {title}: {e}")

                    except Exception as e:
                        logger.error(f"Error processing event element: {e}")
                        continue

            else:
                # Fallback: parse text line-by-line
                logger.info("No structured events found, trying line-by-line parsing")

                i = 0
                while i < len(lines):
                    line = lines[i]

                    # Skip very short lines
                    if len(line) < 10:
                        i += 1
                        continue

                    # Try to parse as date
                    date_info = parse_date_string(line)

                    if date_info:
                        # Look for title in previous or next line
                        title = None
                        description = ""
                        time_info = None

                        if i > 0 and len(lines[i-1]) > 10:
                            title = lines[i-1]
                        elif i + 1 < len(lines) and len(lines[i+1]) > 10:
                            title = lines[i+1]

                        # Look for time and description
                        for j in range(max(0, i-2), min(len(lines), i+3)):
                            if not time_info:
                                time_info = parse_time_string(lines[j])
                            if len(lines[j]) > 30 and lines[j] != title:
                                description = lines[j]

                        if title and len(title) > 10:
                            events_found += 1

                            category = determine_category(title, description)
                            tags = extract_tags(title, description)
                            is_free = is_free_event(title, description)

                            content_hash = generate_content_hash(
                                title, "South River Forest Coalition", date_info["start_date"]
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
                                "start_date": date_info["start_date"],
                                "start_time": time_info,
                                "end_date": None,
                                "end_time": None,
                                "is_all_day": time_info is None,
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
                                "raw_text": f"{title} | {description[:200]}"[:500],
                                "extraction_confidence": 0.75,
                                "is_recurring": False,
                                "recurrence_rule": None,
                                "content_hash": content_hash,
                            }

                            try:
                                insert_event(event_record)
                                events_new += 1
                                logger.info(f"Added: {title} on {date_info['start_date']}")
                            except Exception as e:
                                logger.error(f"Failed to insert: {title}: {e}")

                    i += 1

            browser.close()

        logger.info(
            f"South River Forest Coalition crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except PlaywrightTimeout as e:
        logger.error(f"Timeout fetching South River Forest Coalition: {e}")
        raise
    except Exception as e:
        logger.error(f"Failed to crawl South River Forest Coalition: {e}")
        raise

    return events_found, events_new, events_updated
