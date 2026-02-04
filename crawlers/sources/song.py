"""
Crawler for SONG - Southerners on New Ground (southernersonnewground.org).

SONG is a regional LGBTQ+ liberation organization working across the South,
focusing on queer and trans people of color, immigrants, and working class people.
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
from utils import extract_images_from_page, normalize_time_format

logger = logging.getLogger(__name__)

BASE_URL = "https://southernersonnewground.org"
EVENTS_URL = f"{BASE_URL}/events"

# SONG HQ venue (Atlanta office)
SONG_HQ = {
    "name": "SONG - Southerners on New Ground",
    "slug": "song-southerners-on-new-ground",
    "address": "659 Auburn Ave NE",
    "neighborhood": "Old Fourth Ward",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30312",
    "venue_type": "nonprofit",
    "website": BASE_URL,
}


def parse_date(date_str: str) -> Optional[str]:
    """
    Parse various date formats to YYYY-MM-DD.

    Handles formats like:
    - January 15, 2026
    - Jan 15, 2026
    - 1/15/2026
    - Monday, January 15
    """
    if not date_str:
        return None

    date_str = date_str.strip()
    current_year = datetime.now().year

    # Try "Month DD, YYYY" or "Month DD"
    match = re.match(r'(?:\w+,?\s+)?(\w+)\s+(\d{1,2})(?:,?\s+(\d{4}))?', date_str, re.IGNORECASE)
    if match:
        month_str, day, year = match.groups()
        year = year or str(current_year)
        try:
            # Handle full month name or abbreviation
            dt = datetime.strptime(f"{month_str} {day} {year}", "%B %d %Y")
        except ValueError:
            try:
                dt = datetime.strptime(f"{month_str} {day} {year}", "%b %d %Y")
            except ValueError:
                return None

        # If date is in the past, assume next year
        if dt.date() < datetime.now().date():
            dt = datetime.strptime(f"{month_str} {day} {current_year + 1}", "%B %d %Y" if len(month_str) > 3 else "%b %d %Y")

        return dt.strftime("%Y-%m-%d")

    # Try MM/DD/YYYY
    match = re.match(r'(\d{1,2})/(\d{1,2})/(\d{4})', date_str)
    if match:
        month, day, year = match.groups()
        try:
            dt = datetime.strptime(f"{month}/{day}/{year}", "%m/%d/%Y")
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            return None

    return None


def parse_time(time_str: str) -> Optional[str]:
    """Parse time string to HH:MM format."""
    if not time_str:
        return None

    normalized = normalize_time_format(time_str.strip())
    return normalized


def determine_category(title: str, description: str = "") -> str:
    """Determine event category based on title and description."""
    text = f"{title} {description}".lower()

    if any(word in text for word in ["workshop", "training", "education", "seminar", "class", "learn"]):
        return "education"
    if any(word in text for word in ["town hall", "community meeting", "forum", "discussion", "gathering"]):
        return "community"
    if any(word in text for word in ["rally", "march", "protest", "demonstration", "action", "die-in"]):
        return "community"
    if any(word in text for word in ["social", "mixer", "party", "celebration", "dance"]):
        return "nightlife"
    if any(word in text for word in ["film", "screening", "documentary", "movie"]):
        return "arts"
    if any(word in text for word in ["fundraiser", "gala", "benefit", "donation"]):
        return "community"
    if any(word in text for word in ["performance", "show", "concert", "drag"]):
        return "arts"

    return "community"


def extract_tags(title: str, description: str = "") -> list[str]:
    """Extract relevant tags from event content."""
    text = f"{title} {description}".lower()
    tags = []

    # Core LGBTQ+ tags
    if any(word in text for word in ["lgbtq", "lgbt", "queer", "gay", "lesbian", "bisexual"]):
        tags.append("lgbtq")
    if any(word in text for word in ["trans", "transgender", "nonbinary", "non-binary", "gender"]):
        tags.append("trans")

    # Justice/activism tags
    if any(word in text for word in ["activism", "activist", "organize", "organizing", "movement"]):
        tags.append("activism")
    if any(word in text for word in ["social justice", "justice", "equity", "liberation"]):
        tags.append("social-justice")
    if any(word in text for word in ["civil rights", "human rights", "rights"]):
        tags.append("civil-rights")

    # Community tags
    if any(word in text for word in ["community", "neighborhood", "grassroots"]):
        tags.append("community")
    if any(word in text for word in ["volunteer", "help", "join"]):
        tags.append("volunteer")
    if any(word in text for word in ["poc", "people of color", "bipoc", "racial justice"]):
        tags.append("racial-justice")

    # Event type tags
    if any(word in text for word in ["education", "training", "workshop", "learning"]):
        tags.append("education")
    if any(word in text for word in ["art", "performance", "drag", "creative"]):
        tags.append("arts")
    if any(word in text for word in ["youth", "young", "student"]):
        tags.append("youth")

    # Add free tag (most organizing events are free)
    if "free" in text or "volunteer" in tags or "no cost" in text:
        tags.append("free")

    return list(set(tags))


def is_free_event(title: str, description: str = "") -> bool:
    """Determine if event is free based on content."""
    text = f"{title} {description}".lower()

    # Most organizing/volunteer events are free
    if any(word in text for word in ["volunteer", "community meeting", "workshop", "training", "organizing"]):
        return True

    # Check for explicit free mentions
    if any(word in text for word in ["free", "no cost", "no charge", "free admission"]):
        return True

    # Check for paid indicators
    if any(word in text for word in ["$", "ticket", "registration fee", "cost:", "price:", "donation required"]):
        return False

    # Default to True for LGBTQ+ org (most events are free/accessible)
    return True


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl SONG events using Playwright.

    The events page typically has event cards with:
    - Title
    - Date and time
    - Location/description
    - Link to details
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

            # Get venue ID for SONG HQ
            venue_id = get_or_create_venue(SONG_HQ)

            logger.info(f"Fetching SONG events: {EVENTS_URL}")
            page.goto(EVENTS_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(5000)

            # Extract images from page
            image_map = extract_images_from_page(page)

            # Scroll to load all content
            for _ in range(5):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1000)

            # Try to find event containers (adjust selectors based on actual site structure)
            event_selectors = [
                ".event-card",
                ".event-item",
                ".tribe-events-list-event-row",
                "article[class*='event']",
                "[class*='event-listing'] > div",
                ".calendar-event",
                ".upcoming-event",
                ".eventlist-event",
            ]

            events_found_on_page = False
            for selector in event_selectors:
                event_elements = page.query_selector_all(selector)
                if event_elements and len(event_elements) > 0:
                    logger.info(f"Found {len(event_elements)} events with selector: {selector}")

                    for event_elem in event_elements:
                        try:
                            # Extract text content
                            event_text = event_elem.inner_text()
                            lines = [l.strip() for l in event_text.split("\n") if l.strip()]

                            if len(lines) < 2:
                                continue

                            # Assume first substantial line is the title
                            title = lines[0] if len(lines[0]) > 5 else (lines[1] if len(lines) > 1 else None)
                            if not title or len(title) < 5:
                                continue

                            # Try to find date/time in the text
                            start_date = None
                            start_time = None
                            description = ""

                            for line in lines[1:]:
                                # Look for date patterns
                                if not start_date:
                                    parsed_date = parse_date(line)
                                    if parsed_date:
                                        start_date = parsed_date
                                        continue

                                # Look for time patterns
                                if not start_time and re.search(r'\d{1,2}:\d{2}|am|pm', line, re.IGNORECASE):
                                    parsed_time = parse_time(line)
                                    if parsed_time:
                                        start_time = parsed_time
                                        continue

                                # Accumulate description
                                if len(line) > 20 and line not in title:
                                    description += line + " "

                            # If no date found, skip
                            if not start_date:
                                continue

                            events_found += 1
                            events_found_on_page = True

                            description = description.strip()[:500]
                            category = determine_category(title, description)
                            tags = extract_tags(title, description)
                            is_free = is_free_event(title, description)

                            content_hash = generate_content_hash(
                                title, "SONG", start_date
                            )

                            if find_event_by_hash(content_hash):
                                events_updated += 1
                                continue

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
                                "subcategory": None,
                                "tags": tags,
                                "price_min": None,
                                "price_max": None,
                                "price_note": None,
                                "is_free": is_free,
                                "source_url": EVENTS_URL,
                                "ticket_url": None,
                                "image_url": image_map.get(title),
                                "raw_text": f"{title} | {event_text[:300]}"[:500],
                                "extraction_confidence": 0.8,
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
                            logger.warning(f"Error processing event element: {e}")
                            continue

                    # Found events with this selector, stop trying others
                    break

            # If no events found with structured selectors, try text parsing
            if not events_found_on_page:
                logger.info("No events found with standard selectors, trying text parsing")
                body_text = page.inner_text("body")
                lines = [l.strip() for l in body_text.split("\n") if l.strip()]

                # Look for patterns like date followed by event info
                i = 0
                while i < len(lines):
                    line = lines[i]

                    # Try to parse as date
                    parsed_date = parse_date(line)
                    if parsed_date and i + 1 < len(lines):
                        # Next line might be title
                        potential_title = lines[i + 1]
                        if len(potential_title) > 10 and not potential_title.startswith("http"):
                            title = potential_title
                            description = ""
                            start_time = None

                            # Look ahead for time and description
                            if i + 2 < len(lines):
                                next_line = lines[i + 2]
                                parsed_time = parse_time(next_line)
                                if parsed_time:
                                    start_time = parsed_time
                                elif len(next_line) > 20:
                                    description = next_line[:500]

                            events_found += 1

                            category = determine_category(title, description)
                            tags = extract_tags(title, description)
                            is_free = is_free_event(title, description)

                            content_hash = generate_content_hash(
                                title, "SONG", parsed_date
                            )

                            if not find_event_by_hash(content_hash):
                                event_record = {
                                    "source_id": source_id,
                                    "venue_id": venue_id,
                                    "title": title,
                                    "description": description if description else None,
                                    "start_date": parsed_date,
                                    "start_time": start_time,
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
                                    logger.info(f"Added: {title} on {parsed_date}")
                                except Exception as e:
                                    logger.error(f"Failed to insert: {title}: {e}")
                            else:
                                events_updated += 1

                    i += 1

            browser.close()

        logger.info(
            f"SONG crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except PlaywrightTimeout as e:
        logger.error(f"Timeout fetching SONG: {e}")
        raise
    except Exception as e:
        logger.error(f"Failed to crawl SONG: {e}")
        raise

    return events_found, events_new, events_updated
