"""
Crawler for Big Brothers Big Sisters of Metro Atlanta (bbbsatl.org).

Big Brothers Big Sisters provides youth mentorship programs and
organizes community events. Site may use JavaScript rendering - using Playwright.
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

BASE_URL = "https://www.bbbsatl.org"
EVENTS_URL = f"{BASE_URL}/events"

# Big Brothers Big Sisters HQ venue
BBBS_HQ = {
    "name": "Big Brothers Big Sisters of Metro Atlanta",
    "slug": "big-brothers-big-sisters-atlanta",
    "address": "220 Interstate North Pkwy SE",
    "neighborhood": "Buckhead",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30339",
    "venue_type": "nonprofit",
    "website": BASE_URL,
}


def determine_category(title: str, description: str = "") -> str:
    """Determine event category based on title and description."""
    text = f"{title} {description}".lower()

    if any(word in text for word in ["mentor", "youth", "kid", "children", "student", "education", "tutoring", "school"]):
        return "education"
    if any(word in text for word in ["volunteer", "volunteering", "service"]):
        return "community"
    if any(word in text for word in ["fundraiser", "gala", "benefit", "donor"]):
        return "community"
    if any(word in text for word in ["workshop", "training", "seminar"]):
        return "education"

    return "community"


def extract_tags(title: str, description: str = "") -> list[str]:
    """Extract relevant tags from event content."""
    text = f"{title} {description}".lower()
    tags = []

    if any(word in text for word in ["youth", "kid", "children", "student", "teen"]):
        tags.append("youth")
    if any(word in text for word in ["mentor", "mentoring", "mentorship"]):
        tags.append("mentorship")
    if any(word in text for word in ["volunteer", "volunteering"]):
        tags.append("volunteer")
    if any(word in text for word in ["education", "school", "learning", "tutoring"]):
        tags.append("education")
    if any(word in text for word in ["family", "families"]):
        tags.append("family-friendly")
    if any(word in text for word in ["community", "neighborhood"]):
        tags.append("community")
    if any(word in text for word in ["charity", "nonprofit", "fundraiser", "benefit"]):
        tags.append("charity")

    return list(set(tags))


def is_free_event(title: str, description: str = "") -> bool:
    """Determine if event is free based on content."""
    text = f"{title} {description}".lower()

    # Most volunteer/mentorship events are free
    if any(word in text for word in ["volunteer", "mentor", "orientation"]):
        return True

    # Check for explicit free mentions
    if any(word in text for word in ["free", "no cost", "no charge"]):
        return True

    # Check for paid indicators
    if any(word in text for word in ["$", "ticket", "registration fee", "cost:", "price:", "donation"]):
        return False

    # Default to True for volunteer org
    return True


def parse_date_from_text(text: str) -> Optional[str]:
    """Try to extract a date from text."""
    current_year = datetime.now().year

    # Try "Month DD, YYYY" or "Month DD"
    match = re.search(r'(\w+)\s+(\d{1,2})(?:,?\s+(\d{4}))?', text)
    if match:
        month_str, day, year = match.groups()
        year = year or str(current_year)
        try:
            dt = datetime.strptime(f"{month_str} {day} {year}", "%B %d %Y")
            if dt.date() < datetime.now().date():
                dt = datetime.strptime(f"{month_str} {day} {current_year + 1}", "%B %d %Y")
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            try:
                dt = datetime.strptime(f"{month_str} {day} {year}", "%b %d %Y")
                if dt.date() < datetime.now().date():
                    dt = datetime.strptime(f"{month_str} {day} {current_year + 1}", "%b %d %Y")
                return dt.strftime("%Y-%m-%d")
            except ValueError:
                pass

    # Try "MM/DD/YYYY" or "M/D/YY"
    match = re.search(r'(\d{1,2})/(\d{1,2})/(\d{2,4})', text)
    if match:
        month, day, year = match.groups()
        if len(year) == 2:
            year = f"20{year}"
        try:
            dt = datetime.strptime(f"{month}/{day}/{year}", "%m/%d/%Y")
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            pass

    return None


def parse_time_from_text(text: str) -> Optional[str]:
    """Try to extract a time from text."""
    match = re.search(r'(\d{1,2}):?(\d{2})?\s*(am|pm)', text, re.IGNORECASE)
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


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl Big Brothers Big Sisters of Metro Atlanta events using Playwright.
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
            venue_id = get_or_create_venue(BBBS_HQ)

            logger.info(f"Fetching BBBS Atlanta events: {EVENTS_URL}")
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

            # Parse line by line looking for events
            i = 0
            while i < len(lines):
                line = lines[i]

                # Skip short lines and navigation
                if (len(line) < 10 or
                    line.lower() in ["home", "about", "contact", "donate", "volunteer", "events", "news", "programs"] or
                    line.startswith("http")):
                    i += 1
                    continue

                # Check if this could be an event title
                potential_title = line
                description_parts = []
                event_date = None
                event_time = None

                # Look ahead for date and description
                for j in range(1, min(10, len(lines) - i)):
                    next_line = lines[i + j]

                    # Try to parse date
                    if not event_date:
                        event_date = parse_date_from_text(next_line)

                    # Try to parse time
                    if not event_time:
                        event_time = parse_time_from_text(next_line)

                    # Collect potential description text
                    if len(next_line) > 30 and not parse_date_from_text(next_line):
                        description_parts.append(next_line)

                    # Stop if we've found enough or hit a new section
                    if event_date and len(description_parts) >= 2:
                        break

                if event_date:
                    events_found += 1

                    title = potential_title
                    description = " ".join(description_parts[:3]) if description_parts else ""

                    category = determine_category(title, description)
                    tags = extract_tags(title, description)
                    is_free = is_free_event(title, description)

                    content_hash = generate_content_hash(
                        title, "Big Brothers Big Sisters of Metro Atlanta", event_date
                    )

                    if find_event_by_hash(content_hash):
                        events_updated += 1
                        i += 1
                        continue

                    event_record = {
                        "source_id": source_id,
                        "venue_id": venue_id,
                        "title": title,
                        "description": description[:500] if description else None,
                        "start_date": event_date,
                        "start_time": event_time,
                        "end_date": None,
                        "end_time": None,
                        "is_all_day": event_time is None,
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
                        "raw_text": f"{title} | {event_date} | {description[:200]}"[:500],
                        "extraction_confidence": 0.75,
                        "is_recurring": False,
                        "recurrence_rule": None,
                        "content_hash": content_hash,
                    }

                    try:
                        insert_event(event_record)
                        events_new += 1
                        logger.info(f"Added: {title} on {event_date}")
                    except Exception as e:
                        logger.error(f"Failed to insert: {title}: {e}")

                i += 1

            browser.close()

        logger.info(
            f"BBBS Atlanta crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except PlaywrightTimeout as e:
        logger.error(f"Timeout fetching BBBS Atlanta: {e}")
        raise
    except Exception as e:
        logger.error(f"Failed to crawl BBBS Atlanta: {e}")
        raise

    return events_found, events_new, events_updated
