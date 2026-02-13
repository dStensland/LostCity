"""
Crawler for Atlanta Track Club.

SOURCE: atlantatrackclub.org/calendar
PURPOSE: Major running organization - races (5K, 10K, half marathons, marathons),
         group runs, training programs, youth programs.

SITE: Custom CMS (Octane CDN), JS-rendered - requires Playwright.
EVENTS: 30+ per year including the famous Peachtree Road Race (July 4th).
"""

from __future__ import annotations

import re
import logging
from datetime import datetime, timedelta
from typing import Optional

from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout

from db import get_or_create_venue, insert_event, find_event_by_hash
from dedupe import generate_content_hash
from utils import extract_images_from_page
from date_utils import parse_human_date

logger = logging.getLogger(__name__)

BASE_URL = "https://www.atlantatrackclub.org"
CALENDAR_URL = f"{BASE_URL}/calendar"

VENUE_DATA = {
    "name": "Atlanta Track Club",
    "slug": "atlanta-track-club",
    "address": "201 Armour Dr NE",
    "neighborhood": "Armour-Ottley",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30324",
    "lat": 33.8098,
    "lng": -84.3666,
    "venue_type": "organization",
    "spot_type": "organization",
    "website": BASE_URL,
    "vibes": ["running", "fitness", "community", "racing"],
}


def categorize_event(title: str, description: str = "") -> dict:
    """
    Determine category, subcategory, and tags based on event title and description.

    Returns:
        dict with "category", "subcategory", and "tags" keys
    """
    title_lower = title.lower()
    desc_lower = description.lower()
    combined = f"{title_lower} {desc_lower}"

    # Base tags that apply to all Track Club events
    base_tags = ["running", "athletics", "atlanta-track-club"]

    # Youth/family programs
    if any(word in combined for word in ["youth", "kids", "junior", "children", "family"]):
        base_tags.extend(["youth", "family-friendly"])

    # Race events
    if any(word in combined for word in ["race", "5k", "10k", "half marathon", "marathon", "peachtree"]):
        return {
            "category": "fitness",
            "subcategory": "race",
            "tags": base_tags + ["race", "outdoor", "competitive"],
        }

    # Training programs
    if any(word in combined for word in ["training", "program", "clinic", "workshop"]):
        return {
            "category": "fitness",
            "subcategory": "training",
            "tags": base_tags + ["training", "education", "group"],
        }

    # Group runs / social runs
    if any(word in combined for word in ["group run", "social run", "meet up", "meetup", "run club"]):
        return {
            "category": "fitness",
            "subcategory": "running",
            "tags": base_tags + ["social", "group-run", "beginner-friendly"],
        }

    # Virtual events
    if "virtual" in combined:
        base_tags.append("virtual")

    # Default to general running event
    return {
        "category": "fitness",
        "subcategory": "running",
        "tags": base_tags + ["outdoor"],
    }


def parse_price_info(text: str) -> tuple[Optional[float], Optional[float], str, bool]:
    """
    Parse price information from event text.

    Returns:
        Tuple of (price_min, price_max, price_note, is_free)
    """
    text_lower = text.lower()

    # Check for free events
    if any(phrase in text_lower for phrase in ["free", "no cost", "no fee", "complimentary"]):
        return 0, 0, "Free", True

    # Look for dollar amounts
    price_pattern = r"\$(\d+(?:\.\d{2})?)"
    prices = re.findall(price_pattern, text)

    if prices:
        price_values = [float(p) for p in prices]
        price_min = min(price_values)
        price_max = max(price_values) if len(price_values) > 1 else price_min

        # Build price note
        if price_min == price_max:
            price_note = f"${price_min:.0f}"
        else:
            price_note = f"${price_min:.0f} - ${price_max:.0f}"

        # Check for member pricing
        if "member" in text_lower:
            price_note += " (member pricing available)"

        return price_min, price_max, price_note, False

    # If we see pricing keywords but no amounts, mark as paid
    if any(word in text_lower for word in ["registration", "register", "entry fee", "cost"]):
        return None, None, "Registration required", False

    # Default to unknown
    return None, None, None, False


def parse_time(time_text: str) -> Optional[str]:
    """Parse time to HH:MM format."""
    try:
        # Handle formats like "7:00 AM", "7:00AM", "7AM"
        match = re.search(r"(\d{1,2}):?(\d{2})?\s*(am|pm)", time_text, re.IGNORECASE)
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
    except Exception:
        return None


def parse_event_from_text(text_block: str, venue_id: int, source_id: int) -> Optional[dict]:
    """
    Parse event data from a text block.

    Expected format varies - try to extract:
    - Date (various formats)
    - Title
    - Time
    - Description
    - Price
    """
    lines = [line.strip() for line in text_block.split("\n") if line.strip()]

    if len(lines) < 2:
        return None

    # Try to find date patterns
    date_str = None
    title = None
    description_parts = []
    time_str = None

    for i, line in enumerate(lines):
        # Look for date patterns
        if not date_str:
            # Try common date formats
            date_patterns = [
                r"(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2},?\s+\d{4}",
                r"(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+\d{1,2},?\s+\d{4}",
                r"\d{1,2}/\d{1,2}/\d{4}",
                r"(monday|tuesday|wednesday|thursday|friday|saturday|sunday),?\s+(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}",
            ]

            for pattern in date_patterns:
                match = re.search(pattern, line, re.IGNORECASE)
                if match:
                    date_str = match.group(0)
                    # Title is likely the line before or after date
                    if i > 0 and not title and len(lines[i-1]) > 5:
                        title = lines[i-1]
                    break

        # Look for time patterns
        if not time_str and re.search(r"\d{1,2}:?\d{0,2}\s*[ap]m", line, re.IGNORECASE):
            time_str = line

        # Collect non-date, non-title lines as description
        if line != date_str and line != title and len(line) > 10:
            description_parts.append(line)

    # If we still don't have a title, use the first substantial line
    if not title and lines:
        title = lines[0]

    if not title or not date_str:
        return None

    # Parse date
    start_date = parse_human_date(date_str)
    if not start_date:
        return None

    # Parse time if available
    start_time = None
    if time_str:
        start_time = parse_time(time_str)

    # Build description
    description = " ".join(description_parts) if description_parts else None

    # Categorize event
    cat_info = categorize_event(title, description or "")

    # Parse price info
    price_text = f"{title} {description or ''}"
    price_min, price_max, price_note, is_free = parse_price_info(price_text)

    return {
        "source_id": source_id,
        "venue_id": venue_id,
        "title": title,
        "description": description,
        "start_date": start_date,
        "start_time": start_time,
        "end_date": None,
        "end_time": None,
        "is_all_day": False,
        "category": cat_info["category"],
        "subcategory": cat_info["subcategory"],
        "tags": cat_info["tags"],
        "price_min": price_min,
        "price_max": price_max,
        "price_note": price_note,
        "is_free": is_free,
        "source_url": CALENDAR_URL,
        "ticket_url": None,
        "image_url": None,
        "raw_text": text_block[:500],
        "extraction_confidence": 0.75,
        "content_hash": generate_content_hash(title, "Atlanta Track Club", start_date),
    }


def parse_event_cards(page, venue_id: int, source_id: int, image_map: dict) -> list[dict]:
    """
    Parse event cards from the Atlanta Track Club calendar page.

    Tries multiple selectors:
    1. .event-wrapper containers
    2. .event-card containers
    3. Fallback to structured text parsing
    """
    events = []

    try:
        # Try .event-wrapper pattern
        event_wrappers = page.query_selector_all(".event-wrapper")
        logger.info(f"Found {len(event_wrappers)} .event-wrapper elements")

        if event_wrappers:
            for wrapper in event_wrappers:
                try:
                    # Extract text content
                    text = wrapper.inner_text()

                    # Try to find title
                    title_elem = wrapper.query_selector(".event-title, h2, h3, .title")
                    title = title_elem.inner_text().strip() if title_elem else None

                    # Try to find date
                    date_elem = wrapper.query_selector(".date, .event-date, time")
                    date_text = date_elem.inner_text().strip() if date_elem else None

                    # Try to find image
                    img_elem = wrapper.query_selector("img")
                    image_url = None
                    if img_elem:
                        image_url = img_elem.get_attribute("src") or img_elem.get_attribute("data-src")

                    # If we have basics, try to parse
                    if title and date_text:
                        start_date = parse_human_date(date_text)
                        if start_date:
                            # Look for time in text
                            start_time = None
                            time_match = re.search(r"(\d{1,2}:?\d{0,2}\s*[ap]m)", text, re.IGNORECASE)
                            if time_match:
                                start_time = parse_time(time_match.group(1))

                            # Extract description (remaining text after title and date)
                            description = text.replace(title, "").replace(date_text, "").strip()
                            if len(description) < 20:
                                description = None

                            # Categorize
                            cat_info = categorize_event(title, description or "")

                            # Parse price
                            price_min, price_max, price_note, is_free = parse_price_info(text)

                            # Check for event detail link
                            link_elem = wrapper.query_selector("a.btn-view, a[href*='/event/'], a")
                            source_url = CALENDAR_URL
                            if link_elem:
                                href = link_elem.get_attribute("href")
                                if href and not href.startswith("javascript:"):
                                    if href.startswith("/"):
                                        source_url = f"{BASE_URL}{href}"
                                    elif href.startswith("http"):
                                        source_url = href

                            # Try to match image from map
                            if not image_url:
                                image_url = image_map.get(title)

                            event_record = {
                                "source_id": source_id,
                                "venue_id": venue_id,
                                "title": title,
                                "description": description,
                                "start_date": start_date,
                                "start_time": start_time,
                                "end_date": None,
                                "end_time": None,
                                "is_all_day": False,
                                "category": cat_info["category"],
                                "subcategory": cat_info["subcategory"],
                                "tags": cat_info["tags"],
                                "price_min": price_min,
                                "price_max": price_max,
                                "price_note": price_note,
                                "is_free": is_free,
                                "source_url": source_url,
                                "ticket_url": None,
                                "image_url": image_url,
                                "raw_text": text[:500],
                                "extraction_confidence": 0.85,
                                "content_hash": generate_content_hash(
                                    title, "Atlanta Track Club", start_date
                                ),
                            }

                            events.append(event_record)
                            logger.debug(f"Parsed event: {title} on {start_date}")

                except Exception as e:
                    logger.warning(f"Error parsing event wrapper: {e}")
                    continue

        # If we didn't find events with .event-wrapper, try other selectors
        if not events:
            event_cards = page.query_selector_all(".event-card, .event-item, article, .calendar-item")
            logger.info(f"Trying alternative selectors, found {len(event_cards)} elements")

            for card in event_cards:
                try:
                    text = card.inner_text()
                    event_data = parse_event_from_text(text, venue_id, source_id)
                    if event_data:
                        # Try to enhance with image from map
                        if event_data.get("title") in image_map:
                            event_data["image_url"] = image_map[event_data["title"]]
                        events.append(event_data)
                except Exception as e:
                    logger.warning(f"Error parsing event card: {e}")
                    continue

    except Exception as e:
        logger.error(f"Error in parse_event_cards: {e}")

    return events


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl Atlanta Track Club calendar using Playwright.
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

            logger.info(f"Fetching Atlanta Track Club calendar: {CALENDAR_URL}")
            page.goto(CALENDAR_URL, wait_until="domcontentloaded", timeout=30000)

            # Wait for JS to render
            page.wait_for_timeout(5000)

            # Scroll to trigger lazy loading
            for _ in range(5):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1500)

            # Get venue ID
            venue_id = get_or_create_venue(VENUE_DATA)

            # Extract images
            image_map = extract_images_from_page(page)
            logger.info(f"Extracted {len(image_map)} images from page")

            # Parse event cards
            event_records = parse_event_cards(page, venue_id, source_id, image_map)

            logger.info(f"Found {len(event_records)} events")

            # Insert events
            for event_record in event_records:
                events_found += 1

                # Check for existing
                existing = find_event_by_hash(event_record["content_hash"])
                if existing:
                    events_updated += 1
                    continue

                try:
                    insert_event(event_record)
                    events_new += 1
                    logger.info(
                        f"Added: {event_record['title']} on {event_record['start_date']}"
                    )
                except Exception as e:
                    logger.error(f"Failed to insert: {event_record['title']}: {e}")

            browser.close()

        logger.info(
            f"Atlanta Track Club crawl complete: {events_found} found, {events_new} new"
        )

    except PlaywrightTimeout as e:
        logger.error(f"Timeout fetching Atlanta Track Club: {e}")
        raise
    except Exception as e:
        logger.error(f"Failed to crawl Atlanta Track Club: {e}")
        raise

    return events_found, events_new, events_updated
