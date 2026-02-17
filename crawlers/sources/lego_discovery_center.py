"""
Crawler for LEGO Discovery Center Atlanta (legolanddiscoverycenter.com/atlanta).
Indoor LEGO attraction at Phipps Plaza with workshops, events, and building activities.

Site uses JavaScript rendering - must use Playwright.
Events include: Daily admission, special workshops, birthday parties, seasonal events, LEGO building classes.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime
from typing import Optional

from playwright.sync_api import sync_playwright

from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://www.legolanddiscoverycenter.com/atlanta"
EVENTS_URL = f"{BASE_URL}/whats-on/"

VENUE_DATA = {
    "name": "LEGO Discovery Center Atlanta",
    "slug": "lego-discovery-center-atlanta",
    "address": "3500 Peachtree Rd NE",
    "neighborhood": "Buckhead",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30326",
    "lat": 33.8457,
    "lng": -84.3615,
    "venue_type": "attraction",
    "spot_type": "attraction",
    "website": BASE_URL,
}

# Month name to number mapping
MONTHS = {
    "january": 1, "february": 2, "march": 3, "april": 4,
    "may": 5, "june": 6, "july": 7, "august": 8,
    "september": 9, "october": 10, "november": 11, "december": 12,
    "jan": 1, "feb": 2, "mar": 3, "apr": 4, "jun": 6,
    "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12,
}


def parse_date(date_str: str) -> Optional[str]:
    """
    Parse date from various formats:
    - January 15, 2026
    - Jan 15
    - 01/15/2026
    - 2026-01-15

    Returns YYYY-MM-DD format or None.
    """
    if not date_str:
        return None

    date_str = date_str.strip()
    now = datetime.now()
    current_year = now.year

    # Try YYYY-MM-DD format
    if re.match(r'^\d{4}-\d{2}-\d{2}$', date_str):
        return date_str

    # Try MM/DD/YYYY format
    match = re.match(r'^(\d{1,2})/(\d{1,2})/(\d{4})$', date_str)
    if match:
        month, day, year = match.groups()
        return f"{year}-{int(month):02d}-{int(day):02d}"

    # Try "January 15, 2026" or "Jan 15, 2026"
    match = re.match(r'^([A-Za-z]+)\s+(\d{1,2}),?\s*(\d{4})$', date_str)
    if match:
        month_str, day, year = match.groups()
        month = MONTHS.get(month_str.lower())
        if month:
            return f"{year}-{month:02d}-{int(day):02d}"

    # Try "January 15" or "Jan 15" (assume current year or next year)
    match = re.match(r'^([A-Za-z]+)\s+(\d{1,2})$', date_str)
    if match:
        month_str, day = match.groups()
        month = MONTHS.get(month_str.lower())
        if month:
            # If date is in the past, assume next year
            test_date = datetime(current_year, month, int(day))
            if test_date.date() < now.date():
                current_year += 1
            return f"{current_year}-{month:02d}-{int(day):02d}"

    return None


def parse_time(time_str: str) -> Optional[str]:
    """
    Parse time from formats like:
    - 9:30am, 11:30 AM
    - 16:30 (24-hour)
    - 9am, 2pm

    Returns HH:MM format.
    """
    if not time_str:
        return None

    time_str = time_str.strip()

    # Handle 24-hour format
    if re.match(r'^\d{2}:\d{2}$', time_str):
        return time_str

    # Handle 12-hour format
    match = re.search(r'(\d{1,2})(?::(\d{2}))?\s*(am|pm)', time_str, re.IGNORECASE)
    if match:
        hour = int(match.group(1))
        minute = int(match.group(2)) if match.group(2) else 0
        period = match.group(3).lower()

        if period == 'pm' and hour != 12:
            hour += 12
        elif period == 'am' and hour == 12:
            hour = 0

        return f"{hour:02d}:{minute:02d}"

    return None


def determine_category(title: str, description: str = "") -> tuple[str, Optional[str], list[str]]:
    """Determine event category based on title and description."""
    title_lower = title.lower()
    desc_lower = description.lower() if description else ""
    combined = f"{title_lower} {desc_lower}"

    base_tags = ["lego", "family", "kids", "indoor", "buckhead", "phipps-plaza"]

    if any(w in combined for w in ["workshop", "class", "master builder", "building class"]):
        return "family", "workshop", base_tags + ["workshop", "education", "building"]

    if any(w in combined for w in ["holiday", "christmas", "halloween", "easter", "thanksgiving"]):
        return "family", "holiday", base_tags + ["holiday", "seasonal"]

    if any(w in combined for w in ["birthday", "party"]):
        return "family", "party", base_tags + ["birthday", "party"]

    if any(w in combined for w in ["special event", "character", "meet"]):
        return "family", "special-event", base_tags + ["special-event"]

    # Default to kids attraction
    return "family", "kids", base_tags


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl LEGO Discovery Center events using Playwright."""
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

            logger.info(f"Fetching LEGO Discovery Center: {EVENTS_URL}")
            page.goto(EVENTS_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(3000)

            # Scroll to load all content
            for _ in range(5):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1500)

            # Try to extract event data from common patterns
            # Pattern 1: Look for article/event cards with classes like "event", "card", "listing"
            event_cards = page.query_selector_all('article, .event-card, .event-item, .listing-item, [class*="event"]')

            logger.info(f"Found {len(event_cards)} potential event elements")

            # If no structured event cards, try parsing from text
            if len(event_cards) < 2:
                logger.info("No structured events found, parsing from page text")
                body_text = page.inner_text("body")
                lines = [line.strip() for line in body_text.split("\n") if line.strip()]

                # Look for common event patterns in text
                skip_items = {
                    "skip to main", "visit", "tickets", "plan your visit", "buy tickets",
                    "hours", "pricing", "directions", "contact", "menu", "navigation",
                    "book now", "learn more", "find out more", "view all", "filter",
                    "subscribe", "newsletter", "follow us", "social media",
                }

                i = 0
                current_event = {}

                while i < len(lines):
                    line = lines[i].strip()

                    # Skip navigation and short lines
                    if line.lower() in skip_items or len(line) < 3:
                        i += 1
                        continue

                    # Look for date patterns
                    date = parse_date(line)
                    if date:
                        # If we have a complete event, process it
                        if current_event.get("title"):
                            process_event(
                                current_event, source_id, venue_id,
                                events_found, events_new, events_updated
                            )
                            events_found += 1

                        # Start new event
                        current_event = {"date": date}
                        i += 1
                        continue

                    # Look for time patterns
                    time = parse_time(line)
                    if time and current_event.get("date"):
                        current_event["time"] = time
                        i += 1
                        continue

                    # If we have a date but no title yet, this might be the title
                    if current_event.get("date") and not current_event.get("title"):
                        # Skip very long lines (likely descriptions)
                        if len(line) < 100:
                            current_event["title"] = line
                        i += 1
                        continue

                    i += 1

                # Process final event
                if current_event.get("title"):
                    result = process_event(
                        current_event, source_id, venue_id,
                        events_found, events_new, events_updated
                    )
                    if result:
                        events_found += 1
                        if result == "new":
                            events_new += 1
                        else:
                            events_updated += 1

            else:
                # Process structured event cards
                for card in event_cards:
                    try:
                        # Extract title
                        title_elem = card.query_selector('h1, h2, h3, h4, .title, .event-title, [class*="title"]')
                        if not title_elem:
                            continue

                        title = title_elem.inner_text().strip()
                        if not title or len(title) < 3:
                            continue

                        # Extract date
                        date_elem = card.query_selector('.date, .event-date, time, [class*="date"]')
                        date_text = date_elem.inner_text().strip() if date_elem else ""
                        date = parse_date(date_text)

                        # If no date found, skip this card
                        if not date:
                            continue

                        # Extract time
                        time_elem = card.query_selector('.time, .event-time, [class*="time"]')
                        time_text = time_elem.inner_text().strip() if time_elem else ""
                        start_time = parse_time(time_text)

                        # Extract description
                        desc_elem = card.query_selector('.description, .event-description, p, [class*="description"]')
                        description = desc_elem.inner_text().strip() if desc_elem else ""
                        if len(description) > 500:
                            description = description[:500] + "..."

                        # Extract link
                        link_elem = card.query_selector('a[href]')
                        event_url = link_elem.get_attribute("href") if link_elem else EVENTS_URL
                        if event_url and not event_url.startswith("http"):
                            event_url = BASE_URL + event_url

                        # Extract image
                        img_elem = card.query_selector('img[src]')
                        image_url = img_elem.get_attribute("src") if img_elem else None
                        if image_url and not image_url.startswith("http"):
                            image_url = BASE_URL + image_url

                        events_found += 1

                        # Generate content hash
                        content_hash = generate_content_hash(
                            title, "LEGO Discovery Center Atlanta", date
                        )

                        # Check for existing

                        # Determine category
                        category, subcategory, tags = determine_category(title, description)

                        event_record = {
                            "source_id": source_id,
                            "venue_id": venue_id,
                            "title": title,
                            "description": description or f"{title} at LEGO Discovery Center Atlanta",
                            "start_date": date,
                            "start_time": start_time,
                            "end_date": date,
                            "end_time": None,
                            "is_all_day": False,
                            "category": category,
                            "subcategory": subcategory,
                            "tags": tags,
                            "price_min": None,
                            "price_max": None,
                            "price_note": "Admission required (prices vary)",
                            "is_free": False,
                            "source_url": event_url or EVENTS_URL,
                            "ticket_url": f"{BASE_URL}/plan-your-visit/tickets/",
                            "image_url": image_url,
                            "raw_text": f"{title} - {description[:100] if description else ''}",
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
                            logger.info(f"Added: {title} on {date}")
                        except Exception as e:
                            logger.error(f"Failed to insert {title}: {e}")

                    except Exception as e:
                        logger.error(f"Error processing event card: {e}")
                        continue

            if events_found == 0:
                logger.info("No specific events found — skipping (daily admission is not an event)")

            browser.close()

        logger.info(
            f"LEGO Discovery Center crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl LEGO Discovery Center: {e}")
        raise

    return events_found, events_new, events_updated


def process_event(
    event_data: dict,
    source_id: int,
    venue_id: int,
    events_found: int,
    events_new: int,
    events_updated: int
) -> Optional[str]:
    """
    Process a single event dictionary and insert it.
    Returns "new" if created, "updated" if already exists, None if invalid.
    """
    title = event_data.get("title")
    date = event_data.get("date")

    if not title or not date:
        return None

    # Generate content hash
    content_hash = generate_content_hash(
        title, "LEGO Discovery Center Atlanta", date
    )

    # Check for existing
    existing = find_event_by_hash(content_hash)
    if existing:
        return "updated"

    # Determine category
    category, subcategory, tags = determine_category(title, event_data.get("description", ""))

    event_record = {
        "source_id": source_id,
        "venue_id": venue_id,
        "title": title,
        "description": event_data.get("description") or f"{title} at LEGO Discovery Center Atlanta",
        "start_date": date,
        "start_time": event_data.get("time"),
        "end_date": date,
        "end_time": None,
        "is_all_day": False,
        "category": category,
        "subcategory": subcategory,
        "tags": tags,
        "price_min": None,
        "price_max": None,
        "price_note": "Admission required",
        "is_free": False,
        "source_url": event_data.get("url") or EVENTS_URL,
        "ticket_url": f"{BASE_URL}/plan-your-visit/tickets/",
        "image_url": event_data.get("image"),
        "raw_text": title,
        "extraction_confidence": 0.85,
        "is_recurring": False,
        "recurrence_rule": None,
        "content_hash": content_hash,
    }

    try:
        insert_event(event_record)
        logger.info(f"Added: {title} on {date}")
        return "new"
    except Exception as e:
        logger.error(f"Failed to insert {title}: {e}")
        return None
