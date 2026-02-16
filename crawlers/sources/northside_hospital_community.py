"""
Crawler for Northside Hospital Community Events (northside.com).

Comprehensive community programs beyond basic health fairs:
- Maternity education (childbirth, breastfeeding, infant CPR)
- Cancer support groups (various types)
- Bariatrics support groups (multiple locations)
- Diabetes support groups
- Health screenings (prostate, skin cancer)
- Smoking cessation (Built To Quit program)
- Wellness Wednesday events
- Network of Hope cancer support

Geographic coverage: 5 hospitals (Atlanta/Sandy Springs, Cherokee, Duluth, Forsyth, Gwinnett)

Site requires Playwright (JavaScript-rendered calendar with pagination).
"""

from __future__ import annotations

import re
import logging
from datetime import datetime
from typing import Optional

from playwright.sync_api import sync_playwright

from db import get_or_create_venue, insert_event, find_event_by_hash
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://www.northside.com"
EVENTS_URL = f"{BASE_URL}/community-wellness/classes-events"

VENUE_DATA = {
    "name": "Northside Hospital Atlanta",
    "slug": "northside-hospital-atlanta",
    "address": "1000 Johnson Ferry Rd NE",
    "neighborhood": "Sandy Springs",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30342",
    "lat": 33.9421,
    "lng": -84.3564,
    "venue_type": "hospital",
    "spot_type": "hospital",
    "website": BASE_URL,
    "vibes": ["family-friendly"],
}

# Event type categorization
EVENT_TYPE_MAPPING = {
    "bariatrics support group": {
        "category": "wellness",
        "subcategory": "support_group",
        "tags": ["bariatrics", "support-group", "free", "health"],
        "is_free": True,
    },
    "diabetes support group": {
        "category": "wellness",
        "subcategory": "support_group",
        "tags": ["diabetes", "support-group", "free", "health"],
        "is_free": True,
    },
    "cancer support": {
        "category": "wellness",
        "subcategory": "support_group",
        "tags": ["cancer", "support-group", "free", "health"],
        "is_free": True,
    },
    "network of hope": {
        "category": "wellness",
        "subcategory": "support_group",
        "tags": ["cancer", "support-group", "free", "health"],
        "is_free": True,
    },
    "wellness wednesday": {
        "category": "wellness",
        "subcategory": None,
        "tags": ["wellness", "free", "health", "education"],
        "is_free": True,
    },
    "prostate cancer screening": {
        "category": "wellness",
        "subcategory": None,
        "tags": ["health-screening", "cancer", "free", "prostate"],
        "is_free": True,
    },
    "skin cancer screening": {
        "category": "wellness",
        "subcategory": None,
        "tags": ["health-screening", "cancer", "free", "skin-cancer"],
        "is_free": True,
    },
    "built to quit": {
        "category": "wellness",
        "subcategory": "workshop",
        "tags": ["smoking-cessation", "health", "wellness", "class"],
        "is_free": False,
    },
    "childbirth": {
        "category": "learning",
        "subcategory": "workshop",
        "tags": ["maternity", "childbirth", "education", "parenting"],
        "is_free": False,
    },
    "breastfeeding": {
        "category": "learning",
        "subcategory": "workshop",
        "tags": ["maternity", "breastfeeding", "education", "parenting"],
        "is_free": False,
    },
    "infant cpr": {
        "category": "learning",
        "subcategory": "workshop",
        "tags": ["maternity", "cpr", "safety", "parenting"],
        "is_free": False,
    },
    "maternity": {
        "category": "learning",
        "subcategory": "workshop",
        "tags": ["maternity", "education", "parenting"],
        "is_free": False,
    },
}


def parse_time(time_text: str) -> Optional[str]:
    """Parse time from '9:00 AM' or '9:00 a.m.' format."""
    match = re.search(r"(\d{1,2}):(\d{2})\s*(am|pm|a\.m\.|p\.m\.)", time_text, re.IGNORECASE)
    if match:
        hour, minute, period = match.groups()
        hour = int(hour)
        period_lower = period.lower().replace(".", "")
        if period_lower == "pm" and hour != 12:
            hour += 12
        elif period_lower == "am" and hour == 12:
            hour = 0
        return f"{hour:02d}:{minute}"
    return None


def parse_date(date_text: str) -> Optional[str]:
    """Parse date from various formats."""
    # Try "Month DD, YYYY" format (e.g., "Tuesday, Feb. 17, 2026")
    match = re.search(
        r"(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\.?\s+(\d{1,2})(?:,?\s+(\d{4}))?",
        date_text,
        re.IGNORECASE
    )
    if match:
        month = match.group(1)
        day = match.group(2)
        year = match.group(3) if match.group(3) else str(datetime.now().year)

        try:
            month_str = month[:3] if len(month) > 3 else month
            dt = datetime.strptime(f"{month_str} {day} {year}", "%b %d %Y")
            # If date is in the past, assume next year
            if dt.date() < datetime.now().date():
                dt = datetime.strptime(f"{month_str} {day} {int(year) + 1}", "%b %d %Y")
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            pass

    # Try MM/DD/YYYY format
    match = re.search(r"(\d{1,2})/(\d{1,2})/(\d{4})", date_text)
    if match:
        month, day, year = match.groups()
        try:
            dt = datetime.strptime(f"{month}/{day}/{year}", "%m/%d/%Y")
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            pass

    return None


def categorize_event(title: str) -> dict:
    """Determine category, tags, and pricing based on event title."""
    title_lower = title.lower()

    # Check each event type pattern
    for keyword, metadata in EVENT_TYPE_MAPPING.items():
        if keyword in title_lower:
            return metadata

    # Default to wellness/free
    return {
        "category": "wellness",
        "subcategory": None,
        "tags": ["health", "free"],
        "is_free": True,
    }


def extract_location(location_text: str) -> Optional[str]:
    """Extract clean location from location text."""
    if not location_text or location_text.strip() == "":
        return None

    location = location_text.strip()

    # Clean up common patterns
    if location.lower() == "online":
        return "Online"

    # Remove trailing commas, extra spaces
    location = re.sub(r"\s+", " ", location)
    location = location.rstrip(",")

    return location if len(location) > 3 else None


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Northside Hospital community events using Playwright."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        with sync_playwright() as p:
            # Use non-headless to avoid Cloudflare blocking
            browser = p.chromium.launch(headless=False)
            context = browser.new_context(
                user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
                viewport={"width": 1920, "height": 1080},
                locale="en-US",
            )
            page = context.new_page()

            venue_id = get_or_create_venue(VENUE_DATA)

            logger.info(f"Fetching Northside Hospital community events: {EVENTS_URL}")

            try:
                page.goto(EVENTS_URL, wait_until="networkidle", timeout=60000)
                page.wait_for_timeout(5000)
            except Exception as e:
                logger.error(f"Failed to load page: {e}")
                browser.close()
                return 0, 0, 0

            # Scroll to load initial content
            for _ in range(2):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1000)

            # Process all pagination pages
            page_num = 1
            max_pages = 5  # Safety limit
            seen_events = set()

            while page_num <= max_pages:
                logger.info(f"Processing page {page_num}")

                # Get page text
                body_text = page.inner_text("body")
                lines = [l.strip() for l in body_text.split("\n") if l.strip()]

                # Parse events from the table structure
                current_date = None
                i = 0

                while i < len(lines):
                    line = lines[i]

                    # Check if this line is a date header (e.g., "Tuesday, Feb. 17, 2026")
                    date_str = parse_date(line)
                    if date_str:
                        current_date = date_str
                        i += 1
                        continue

                    # Skip if no current date
                    if not current_date:
                        i += 1
                        continue

                    # Skip table headers
                    if line.lower() in ["time", "event", "location"]:
                        i += 1
                        continue

                    # Try to parse time (this indicates start of an event row)
                    start_time = parse_time(line)
                    if start_time and i + 1 < len(lines):
                        # Next line should be the event title
                        title = lines[i + 1].strip()

                        # Validate title first
                        if len(title) < 5 or title.lower() in ["time", "event", "location"]:
                            i += 2
                            continue

                        # Skip pagination numbers and navigation
                        if re.match(r"^\d+$", title) or title.lower() in ["current", "next", "previous"]:
                            i += 2
                            continue

                        # Skip filter categories
                        if "filter by" in title.lower():
                            i += 2
                            continue

                        # Skip if title starts with "Location:" - this is metadata not an event
                        if title.lower().startswith("location:"):
                            i += 2
                            continue

                        # Look for location in next line
                        location = None
                        if i + 2 < len(lines):
                            potential_location = lines[i + 2].strip()
                            # Location should not be a time or date
                            if not parse_time(potential_location) and not parse_date(potential_location):
                                # Also shouldn't be a header or navigation element
                                if potential_location.lower() not in ["time", "event", "location", "filter by category", "filter by event type"]:
                                    # Don't treat the title as location either
                                    if potential_location != title:
                                        location = extract_location(potential_location)
                                        i += 1  # Skip location line

                        # Dedupe by title and date
                        event_key = f"{title}|{current_date}"
                        if event_key in seen_events:
                            i += 2
                            continue
                        seen_events.add(event_key)

                        events_found += 1

                        content_hash = generate_content_hash(title, "Northside Hospital Atlanta", current_date)

                        if find_event_by_hash(content_hash):
                            events_updated += 1
                            i += 2
                            continue

                        # Categorize event
                        event_metadata = categorize_event(title)

                        # Build description
                        description = f"Community health program at Northside Hospital."
                        if "support group" in title.lower():
                            description = "Free support group for individuals and families."
                        elif "screening" in title.lower():
                            description = "Free health screening. Early detection saves lives."
                        elif "wellness wednesday" in title.lower():
                            description = "Weekly wellness education and community event."
                        elif "built to quit" in title.lower():
                            description = "Smoking cessation program to help you quit tobacco for good."
                        elif "maternity" in title.lower() or "childbirth" in title.lower():
                            description = "Educational class for expectant parents."

                        if location:
                            description += f" Location: {location}"

                        event_record = {
                            "source_id": source_id,
                            "venue_id": venue_id,
                            "title": title[:200],
                            "description": description[:500],
                            "start_date": current_date,
                            "start_time": start_time,
                            "end_date": None,
                            "end_time": None,
                            "is_all_day": False,
                            "category": event_metadata["category"],
                            "subcategory": event_metadata.get("subcategory"),
                            "tags": event_metadata["tags"],
                            "price_min": None,
                            "price_max": None,
                            "price_note": None,
                            "is_free": event_metadata["is_free"],
                            "source_url": EVENTS_URL,
                            "ticket_url": EVENTS_URL,
                            "image_url": None,
                            "raw_text": f"{title} - {current_date} {start_time} - {location if location else 'Northside Hospital'}",
                            "extraction_confidence": 0.85,
                            "is_recurring": False,
                            "recurrence_rule": None,
                            "content_hash": content_hash,
                        }

                        try:
                            insert_event(event_record)
                            events_new += 1
                            logger.info(f"Added: {title[:50]}... on {current_date} at {start_time}")
                        except Exception as e:
                            logger.error(f"Failed to insert: {title}: {e}")

                        i += 2  # Skip to next potential event
                    else:
                        i += 1

                # Try to click next page button
                try:
                    # Look for pagination next button
                    next_selectors = [
                        "a[aria-label='Next page']",
                        "a:has-text('Next')",
                        "button:has-text('Next')",
                        f"a:has-text('{page_num + 1}')",  # Direct page number link
                    ]

                    clicked = False
                    for selector in next_selectors:
                        try:
                            if page.locator(selector).count() > 0:
                                page.click(selector, timeout=3000)
                                page.wait_for_timeout(3000)
                                page_num += 1
                                clicked = True
                                logger.info(f"Clicked next page, now on page {page_num}")
                                break
                        except:
                            pass

                    if not clicked:
                        logger.info("No more pages found, ending pagination")
                        break

                except Exception as e:
                    logger.info(f"Pagination ended: {e}")
                    break

            browser.close()

        logger.info(
            f"Northside Hospital community events crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Northside Hospital community events: {e}")
        raise

    return events_found, events_new, events_updated
