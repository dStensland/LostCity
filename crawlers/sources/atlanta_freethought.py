"""
Crawler for Atlanta Freethought Society (atlantafreethought.org).

Atlanta Freethought Society is a non-theist educational community promoting
secular values, science, and reason through lectures, discussions, and social events.
Site uses JavaScript rendering - must use Playwright.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime
from typing import Optional

from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout

from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash
from utils import extract_images_from_page

logger = logging.getLogger(__name__)

BASE_URL = "https://www.atlantafreethought.org"
EVENTS_URL = f"{BASE_URL}/events"

# Atlanta Freethought Society venue
AFS_VENUE = {
    "name": "Atlanta Freethought Society",
    "slug": "atlanta-freethought-society",
    "address": "4775 N Church Ln SE",
    "neighborhood": "Smyrna",
    "city": "Smyrna",
    "state": "GA",
    "zip": "30080",
    "venue_type": "community_center",
    "spot_type": "community_center",
    "website": BASE_URL,
}


def parse_date_from_text(date_text: str) -> Optional[tuple[str, Optional[str]]]:
    """
    Parse date from various formats.
    Returns (start_date, start_time) tuple or None.

    Examples:
    - "Sunday, January 31, 2026"
    - "Jan 31 at 7:00pm"
    - "2026-01-31 19:00"
    """
    if not date_text:
        return None

    date_text = date_text.strip()
    start_time = None

    # Extract time if present
    time_match = re.search(r'(\d{1,2}):(\d{2})\s*(am|pm)', date_text, re.IGNORECASE)
    if time_match:
        hour, minute, period = time_match.groups()
        hour = int(hour)
        if period.lower() == "pm" and hour != 12:
            hour += 12
        elif period.lower() == "am" and hour == 12:
            hour = 0
        start_time = f"{hour:02d}:{minute}"
        # Remove time from date text
        date_text = re.sub(r'\s*at\s*\d{1,2}:\d{2}\s*(?:am|pm)', '', date_text, flags=re.IGNORECASE)

    # Remove day of week
    date_text = re.sub(r'^(monday|tuesday|wednesday|thursday|friday|saturday|sunday),?\s*', '', date_text, flags=re.IGNORECASE)

    # Try ISO format first
    if re.match(r'\d{4}-\d{2}-\d{2}', date_text):
        return date_text[:10], start_time

    # Try "Month DD, YYYY" format
    month_match = re.search(
        r'(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2}),?\s+(\d{4})',
        date_text,
        re.IGNORECASE
    )
    if month_match:
        month, day, year = month_match.groups()
        try:
            dt = datetime.strptime(f"{month} {day} {year}", "%B %d %Y")
            return dt.strftime("%Y-%m-%d"), start_time
        except ValueError:
            pass

    # Try "Mon DD" format (assume current or next year)
    month_match = re.search(
        r'(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{1,2})',
        date_text,
        re.IGNORECASE
    )
    if month_match:
        month_abbr, day = month_match.groups()
        current_year = datetime.now().year
        try:
            dt = datetime.strptime(f"{month_abbr} {day} {current_year}", "%b %d %Y")
            # If date is in the past, assume next year
            if dt.date() < datetime.now().date():
                dt = datetime.strptime(f"{month_abbr} {day} {current_year + 1}", "%b %d %Y")
            return dt.strftime("%Y-%m-%d"), start_time
        except ValueError:
            pass

    return None


def determine_category(title: str, description: str = "") -> str:
    """Determine event category based on title and description."""
    text = f"{title} {description}".lower()

    if any(word in text for word in ["lecture", "speaker", "talk", "presentation", "discussion"]):
        return "education"
    if any(word in text for word in ["social", "meetup", "gathering", "brunch", "dinner"]):
        return "community"
    if any(word in text for word in ["debate", "panel"]):
        return "education"

    return "community"


def extract_tags(title: str, description: str = "") -> list[str]:
    """Extract relevant tags from event content."""
    text = f"{title} {description}".lower()
    tags = ["freethought", "secular", "community"]

    if any(word in text for word in ["science", "scientific", "research"]):
        tags.append("science")
    if any(word in text for word in ["lecture", "talk", "speaker", "presentation"]):
        tags.append("education")
    if any(word in text for word in ["philosophy", "philosophical", "ethics"]):
        tags.append("philosophy")
    if any(word in text for word in ["debate", "discussion"]):
        tags.append("discussion")
    if any(word in text for word in ["social", "brunch", "dinner", "gathering"]):
        tags.append("social")
    if any(word in text for word in ["book", "reading", "literature"]):
        tags.append("books")
    if any(word in text for word in ["atheist", "atheism", "humanist", "humanism"]):
        tags.append("humanism")
    if any(word in text for word in ["activism", "advocate", "rights"]):
        tags.append("activism")
    if any(word in text for word in ["beginner", "intro", "welcome", "new member"]):
        tags.append("beginner-friendly")

    return list(set(tags))


def is_free_event(title: str, description: str = "") -> bool:
    """Determine if event is free based on content."""
    text = f"{title} {description}".lower()

    if any(word in text for word in ["free", "no cost", "no charge"]):
        return True
    if any(word in text for word in ["$", "ticket", "registration fee", "cost:", "price:", "donation"]):
        return False

    # Most lectures and meetings are free
    if any(word in text for word in ["lecture", "meeting", "discussion"]):
        return True

    # Social events may have costs
    if any(word in text for word in ["brunch", "dinner", "meal"]):
        return False

    return True


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl Atlanta Freethought Society events using Playwright.

    The site structure may vary - this crawler looks for common patterns
    in event listings and calendar pages.
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

            # Get venue ID for Atlanta Freethought Society
            venue_id = get_or_create_venue(AFS_VENUE)

            logger.info(f"Fetching Atlanta Freethought Society events: {EVENTS_URL}")

            # Try /events first, then /calendar if needed
            for url in [EVENTS_URL, f"{BASE_URL}/calendar", BASE_URL]:
                try:
                    page.goto(url, wait_until="domcontentloaded", timeout=30000)
                    page.wait_for_timeout(3000)
                    break
                except PlaywrightTimeout:
                    if url == BASE_URL:
                        raise
                    logger.warning(f"Failed to load {url}, trying next URL")
                    continue

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

                # Skip short lines and common navigation text
                if len(line) < 5 or line.lower() in ["events", "calendar", "home", "about", "contact", "join", "donate"]:
                    i += 1
                    continue

                # Try to parse as date
                date_info = parse_date_from_text(line)

                if date_info:
                    start_date, start_time = date_info

                    # Look for title nearby (before or after)
                    title = None
                    description = ""

                    # Check previous line for title
                    if i > 0:
                        potential_title = lines[i - 1]
                        if len(potential_title) > 3 and not parse_date_from_text(potential_title):
                            title = potential_title

                    # Check next line for title if we didn't find one
                    if not title and i + 1 < len(lines):
                        potential_title = lines[i + 1]
                        if len(potential_title) > 3 and not parse_date_from_text(potential_title):
                            title = potential_title

                    # Check following lines for description
                    if title and i + 1 < len(lines):
                        for j in range(i + 1, min(i + 5, len(lines))):
                            if lines[j] != title and len(lines[j]) > 30 and "learn more" not in lines[j].lower():
                                description = lines[j]
                                break

                    if title and len(title) > 3:
                        events_found += 1

                        category = determine_category(title, description)
                        tags = extract_tags(title, description)
                        is_free = is_free_event(title, description)

                        content_hash = generate_content_hash(
                            title, "Atlanta Freethought Society", start_date
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
                            "subcategory": None,
                            "tags": tags,
                            "price_min": None,
                            "price_max": None,
                            "price_note": None,
                            "is_free": is_free,
                            "source_url": page.url,
                            "ticket_url": None,
                            "image_url": image_map.get(title),
                            "raw_text": f"{title} | {line} | {description[:200]}"[:500],
                            "extraction_confidence": 0.80,
                            "is_recurring": False,
                            "recurrence_rule": None,
                            "content_hash": content_hash,
                        }

                        existing = find_event_by_hash(content_hash)
                        if existing:
                            smart_update_existing_event(existing, event_record)
                            events_updated += 1
                            i += 1
                            continue

                        try:
                            insert_event(event_record)
                            events_new += 1
                            logger.info(f"Added: {title} on {start_date}")
                        except Exception as e:
                            logger.error(f"Failed to insert: {title}: {e}")

                i += 1

            browser.close()

        logger.info(
            f"Atlanta Freethought Society crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except PlaywrightTimeout as e:
        logger.error(f"Timeout fetching Atlanta Freethought Society: {e}")
        raise
    except Exception as e:
        logger.error(f"Failed to crawl Atlanta Freethought Society: {e}")
        raise

    return events_found, events_new, events_updated
