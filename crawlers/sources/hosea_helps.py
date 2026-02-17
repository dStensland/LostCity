"""
Crawler for Hosea Helps (hoseahelps.org).

Hunger and homelessness relief organization founded in 1971 by Hosea Williams.
Provides food, clothing, and support services. Site uses JavaScript rendering - must use Playwright.
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

BASE_URL = "https://hoseahelps.org"
EVENTS_URL = f"{BASE_URL}/events"
VOLUNTEER_URL = f"{BASE_URL}/volunteer"

# Hosea Helps HQ venue
HOSEA_HELPS_HQ = {
    "name": "Hosea Helps",
    "slug": "hosea-helps",
    "address": "3430 Frazier Cir SE",
    "neighborhood": "East Atlanta",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30354",
    "lat": 33.6854,
    "lng": -84.3517,
    "venue_type": "nonprofit",
    "spot_type": "nonprofit",
    "website": BASE_URL,
}


def parse_event_date(date_text: str) -> Optional[dict]:
    """
    Parse various date formats from Hosea Helps events.
    Examples:
    - "February 15, 2026"
    - "March 1, 2026 @ 6:00 PM"
    - "Every Saturday 9:00 AM"
    """
    if not date_text:
        return None

    # Try format: "Month DD, YYYY" or "Month DD, YYYY @ HH:MM AM/PM"
    match = re.search(
        r'(\w+)\s+(\d+),?\s+(\d{4})\s*[@at]?\s*(\d{1,2}):?(\d{2})?\s*(am|pm)?',
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

    if any(word in text for word in ["volunteer", "food drive", "clothing drive", "serve", "help"]):
        return "community"
    if any(word in text for word in ["feed the hungry", "food distribution", "meal service"]):
        return "community"
    if any(word in text for word in ["fundraiser", "gala", "benefit", "donation drive"]):
        return "community"
    if any(word in text for word in ["workshop", "training", "education"]):
        return "education"

    return "community"


def extract_tags(title: str, description: str = "") -> list[str]:
    """Extract relevant tags from event content."""
    text = f"{title} {description}".lower()
    tags = ["volunteer", "food", "homelessness"]  # Default tags

    if any(word in text for word in ["clothing", "clothes", "apparel"]):
        tags.append("clothing-drive")
    if any(word in text for word in ["thanksgiving", "christmas", "holiday"]):
        tags.append("holiday")
    if any(word in text for word in ["youth", "children", "kids", "family"]):
        tags.append("family-friendly")
    if any(word in text for word in ["senior", "elderly"]):
        tags.append("seniors")
    if any(word in text for word in ["emergency", "crisis", "urgent"]):
        tags.append("emergency-relief")
    if any(word in text for word in ["community", "neighborhood"]):
        tags.append("community")
    if any(word in text for word in ["charity", "nonprofit"]):
        tags.append("charity")
    if any(word in text for word in ["free", "no cost"]):
        tags.append("free")

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
        # But note: donation drives might mention $ without being paid
        if "donation" in text or "fundraiser" in text:
            return True
        return False

    # Default to True for Hosea Helps events (most are volunteer)
    return True


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl Hosea Helps events and volunteer opportunities using Playwright.

    Checks both /events and /volunteer pages for opportunities.
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

            # Get venue ID for Hosea Helps HQ
            venue_id = get_or_create_venue(HOSEA_HELPS_HQ)

            # Try both events and volunteer pages
            urls_to_check = [EVENTS_URL, VOLUNTEER_URL]

            for url in urls_to_check:
                try:
                    logger.info(f"Fetching Hosea Helps page: {url}")
                    page.goto(url, wait_until="domcontentloaded", timeout=30000)
                    page.wait_for_timeout(5000)

                    # Extract images from page
                    image_map = extract_images_from_page(page)

                    # Scroll to load all content
                    for _ in range(5):
                        page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                        page.wait_for_timeout(1000)

                    # Try to find event containers
                    event_selectors = [
                        ".event-item",
                        ".tribe-event",
                        ".event-card",
                        ".volunteer-opportunity",
                        "article[class*='event']",
                        ".post-type-event",
                    ]

                    events = []
                    for selector in event_selectors:
                        try:
                            elements = page.query_selector_all(selector)
                            if elements:
                                events = elements
                                logger.info(f"Found {len(events)} events using selector: {selector}")
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
                                "contact us", "about", "donate now"
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

                                if title:
                                    events_found += 1

                                    category = determine_category(title, description)
                                    tags = extract_tags(title, description)
                                    is_free = is_free_event(title, description)

                                    content_hash = generate_content_hash(
                                        title, "Hosea Helps", date_data["start_date"]
                                    )


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

                                    existing = find_event_by_hash(content_hash)
                                    if existing:
                                        smart_update_existing_event(existing, event_record)
                                        events_updated += 1
                                        i += 1
                                        continue

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

                                events_found += 1

                                category = determine_category(title, description)
                                tags = extract_tags(title, description)
                                is_free = is_free_event(title, description)

                                content_hash = generate_content_hash(
                                    title, "Hosea Helps", date_data["start_date"]
                                )

                                existing = find_event_by_hash(content_hash)
                                if existing:
                                    smart_update_existing_event(existing, event_record)
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
            f"Hosea Helps crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except PlaywrightTimeout as e:
        logger.error(f"Timeout fetching Hosea Helps: {e}")
        raise
    except Exception as e:
        logger.error(f"Failed to crawl Hosea Helps: {e}")
        raise

    return events_found, events_new, events_updated
