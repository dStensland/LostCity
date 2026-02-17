"""
Crawler for Georgia Aquarium (georgiaaquarium.org).
World's largest aquarium with special events and programs.

Site uses JavaScript rendering - must use Playwright.
URL: /event-calendar/
Format: DATE @ TIME, Title, Description, "View Event Information"
Date patterns:
  - FEBRUARY 10, 2026 @ 9AM-1PM
  - APRIL 6 - 10, 2026
  - JUNE 29 - JULY 3, 2026
"""

from __future__ import annotations

import re
import logging
from typing import Optional

from playwright.sync_api import sync_playwright

from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash
from utils import extract_images_from_page

logger = logging.getLogger(__name__)

BASE_URL = "https://www.georgiaaquarium.org"
EVENTS_URL = f"{BASE_URL}/event-calendar/"

VENUE_DATA = {
    "name": "Georgia Aquarium",
    "slug": "georgia-aquarium",
    "address": "225 Baker St NW",
    "neighborhood": "Downtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30313",
    "lat": 33.7634,
    "lng": -84.3951,
    "venue_type": "museum",
    "spot_type": "museum",
    "website": BASE_URL,
}

# Month name to number mapping
MONTHS = {
    "january": 1, "february": 2, "march": 3, "april": 4,
    "may": 5, "june": 6, "july": 7, "august": 8,
    "september": 9, "october": 10, "november": 11, "december": 12,
}


def parse_date_line(line: str) -> tuple[Optional[str], Optional[str], Optional[str]]:
    """
    Parse date from patterns like:
    - FEBRUARY 10, 2026 @ 9AM-1PM
    - APRIL 6 - 10, 2026
    - JUNE 29 - JULY 3, 2026
    - MARCH 7, 2026 @ 8AM-11AM

    Returns (start_date, end_date, start_time) as strings.
    """
    line = line.strip().upper()

    # Pattern 1: MONTH DAY, YEAR @ TIME (single day with time)
    # e.g., "FEBRUARY 10, 2026 @ 9AM-1PM" or "MARCH 7, 2026 @ 8AM-11AM"
    match = re.match(
        r"([A-Z]+)\s+(\d{1,2}),?\s*(\d{4})\s*@\s*(\d{1,2}(?::\d{2})?\s*(?:AM|PM))",
        line
    )
    if match:
        month_str, day, year, time_str = match.groups()
        month = MONTHS.get(month_str.lower())
        if month:
            start_date = f"{year}-{month:02d}-{int(day):02d}"
            start_time = parse_time(time_str)
            return start_date, None, start_time

    # Pattern 2: MONTH DAY - DAY, YEAR (date range same month)
    # e.g., "APRIL 6 - 10, 2026"
    match = re.match(
        r"([A-Z]+)\s+(\d{1,2})\s*-\s*(\d{1,2}),?\s*(\d{4})",
        line
    )
    if match:
        month_str, start_day, end_day, year = match.groups()
        month = MONTHS.get(month_str.lower())
        if month:
            start_date = f"{year}-{month:02d}-{int(start_day):02d}"
            end_date = f"{year}-{month:02d}-{int(end_day):02d}"
            return start_date, end_date, None

    # Pattern 3: MONTH DAY - MONTH DAY, YEAR (date range different months)
    # e.g., "JUNE 29 - JULY 3, 2026"
    match = re.match(
        r"([A-Z]+)\s+(\d{1,2})\s*-\s*([A-Z]+)\s+(\d{1,2}),?\s*(\d{4})",
        line
    )
    if match:
        start_month_str, start_day, end_month_str, end_day, year = match.groups()
        start_month = MONTHS.get(start_month_str.lower())
        end_month = MONTHS.get(end_month_str.lower())
        if start_month and end_month:
            start_date = f"{year}-{start_month:02d}-{int(start_day):02d}"
            end_date = f"{year}-{end_month:02d}-{int(end_day):02d}"
            return start_date, end_date, None

    return None, None, None


def parse_time(time_text: str) -> Optional[str]:
    """Parse time like '9AM' or '12:30PM' to HH:MM format."""
    if not time_text:
        return None

    time_text = time_text.strip().upper()

    # Match patterns: "9AM", "12:30PM", "9:00AM"
    match = re.match(r"(\d{1,2})(?::(\d{2}))?\s*(AM|PM)", time_text)
    if match:
        hour = int(match.group(1))
        minute = int(match.group(2)) if match.group(2) else 0
        period = match.group(3)

        if period == "PM" and hour != 12:
            hour += 12
        elif period == "AM" and hour == 12:
            hour = 0

        return f"{hour:02d}:{minute:02d}"

    return None


def determine_category(title: str) -> tuple[str, Optional[str], list[str]]:
    """Determine event category based on title."""
    title_lower = title.lower()
    base_tags = ["georgia-aquarium", "downtown", "aquarium"]

    if any(w in title_lower for w in ["sips", "adults", "21+", "wine", "beer"]):
        return "nightlife", "social", base_tags + ["adults-only", "21+"]
    if any(w in title_lower for w in ["camp", "kids", "children"]):
        return "family", "kids", base_tags + ["family", "kids", "camp"]
    if any(w in title_lower for w in ["5k", "run", "walk", "race"]):
        return "fitness", "running", base_tags + ["fitness", "running", "5k"]
    if any(w in title_lower for w in ["field", "school", "homeschool", "education"]):
        return "community", "education", base_tags + ["education", "field-trip"]
    if any(w in title_lower for w in ["yoga", "fitness"]):
        return "fitness", None, base_tags + ["fitness"]
    if any(w in title_lower for w in ["gala", "fundraiser", "benefit"]):
        return "community", "fundraiser", base_tags + ["gala", "fundraiser"]
    if any(w in title_lower for w in ["holiday", "christmas", "halloween"]):
        return "family", "holiday", base_tags + ["family", "holiday"]

    # Default for aquarium events
    return "family", "attraction", base_tags + ["family"]


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Georgia Aquarium events using Playwright."""
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

            logger.info(f"Fetching Georgia Aquarium: {EVENTS_URL}")
            page.goto(EVENTS_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(3000)

            # Extract images from page
            image_map = extract_images_from_page(page)

            # Scroll to load all content
            for _ in range(10):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1000)

            # Get event links for URL extraction
            event_links = {}
            link_elements = page.query_selector_all('a[href*="/events/event/"]')
            for link in link_elements:
                href = link.get_attribute("href")
                text = link.inner_text().strip()
                if href and text:
                    # Map event text to URL (first occurrence wins)
                    if text not in event_links:
                        event_links[text.lower()] = href

            # Get page text for parsing
            body_text = page.inner_text("body")
            lines = [line.strip() for line in body_text.split("\n") if line.strip()]

            # Navigation items to skip
            skip_items = {
                "skip to main content", "open today", "live cams", "search",
                "recommended searches", "aqua pass reservations", "presentation reservations",
                "tickets & pricing", "login", "visit", "buy tickets", "membership",
                "special offers", "hotel packages", "citypass", "group tickets",
                "gift certificates", "visitor guide", "directions & parking",
                "aquarium map", "dining", "accessibility", "faqs", "animals",
                "events", "events calendar", "seasonal activities", "host a private event",
                "programs", "support", "more", "plan your visit", "today's hours",
                "clear filters", "all events", "family events", "adults-only events",
                "conventions", "education program events", "camps", "viewing",
                "view event information", "explore event", "let's stay in touch",
                "submit", "about us", "information", "tickets", "resources",
                "privacy policy", "terms & conditions", "chat with us",
            }

            i = 0
            seen_events = set()

            while i < len(lines):
                line = lines[i]

                # Skip navigation items
                if line.lower() in skip_items or len(line) < 5:
                    i += 1
                    continue

                # Look for date patterns
                start_date, end_date, start_time = parse_date_line(line)

                if start_date:
                    # Found a date line - look for title in following lines
                    title_parts = []
                    description = None
                    j = i + 1

                    # Collect title parts (may span multiple lines)
                    while j < len(lines) and j < i + 5:
                        next_line = lines[j]

                        # Stop if we hit another date pattern or skip item
                        if parse_date_line(next_line)[0] is not None:
                            break
                        if next_line.lower() in skip_items:
                            j += 1
                            continue
                        if next_line.lower() == "view event information":
                            break

                        # Skip month names that appear alone (navigation artifacts)
                        if next_line.lower() in MONTHS:
                            j += 1
                            continue

                        # If line looks like a description (longer text), save it
                        if len(next_line) > 80:
                            description = next_line[:500]
                            break

                        # Otherwise it's part of the title
                        if len(next_line) > 3:
                            title_parts.append(next_line)
                            # Usually title is 1-2 lines max
                            if len(title_parts) >= 2:
                                break

                        j += 1

                    if title_parts:
                        title = " - ".join(title_parts)

                        # Clean up title
                        title = title.strip()
                        if not title or len(title) < 3:
                            i += 1
                            continue

                        # Check for duplicates
                        event_key = f"{title}|{start_date}"
                        if event_key in seen_events:
                            i += 1
                            continue
                        seen_events.add(event_key)

                        events_found += 1

                        # Generate content hash
                        content_hash = generate_content_hash(
                            title, "Georgia Aquarium", start_date
                        )

                        # Check for existing

                        # Try to find event URL
                        event_url = EVENTS_URL
                        for key, url in event_links.items():
                            # Match if title contains key text
                            if any(part.lower() in key for part in title_parts):
                                event_url = url
                                break

                        # Determine category
                        category, subcategory, tags = determine_category(title)

                        event_record = {
                            "source_id": source_id,
                            "venue_id": venue_id,
                            "title": title,
                            "description": description,
                            "start_date": start_date,
                            "start_time": start_time,
                            "end_date": end_date,
                            "end_time": None,
                            "is_all_day": False,
                            "category": category,
                            "subcategory": subcategory,
                            "tags": tags,
                            "price_min": None,
                            "price_max": None,
                            "price_note": "May require separate ticket",
                            "is_free": False,
                            "source_url": event_url,
                            "ticket_url": event_url,
                            "image_url": image_map.get(title),
                            "raw_text": f"{line} - {title}",
                            "extraction_confidence": 0.85,
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
            f"Georgia Aquarium crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Georgia Aquarium: {e}")
        raise

    return events_found, events_new, events_updated
