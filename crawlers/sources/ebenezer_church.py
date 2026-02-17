"""
Crawler for Ebenezer Baptist Church public events.
https://www.ebenezeratl.org/upcoming-events/

Historic church founded by Martin Luther King Sr. in 1886.
Focuses on PUBLIC community events - Bible studies, lectures, concerts.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime
from typing import Optional

from playwright.sync_api import sync_playwright

from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash
from utils import extract_images_from_page, extract_event_links, find_event_url

logger = logging.getLogger(__name__)

BASE_URL = "https://www.ebenezeratl.org"
EVENTS_URL = f"{BASE_URL}/upcoming-events/"

VENUE_DATA = {
    "name": "Ebenezer Baptist Church",
    "slug": "ebenezer-baptist-church",
    "address": "101 Jackson St NE",
    "neighborhood": "Sweet Auburn",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30312",
    "lat": 33.7561,
    "lng": -84.3728,
    "venue_type": "church",
    "spot_type": "church",
    "website": BASE_URL,
    "vibes": ["faith-christian", "baptist", "historic"],
}

# Skip congregation-specific events (bible studies, prayer groups, internal business)
SKIP_KEYWORDS = [
    "member", "congregation", "deacon", "trustee", "pastor search",
    "business meeting", "board meeting", "staff meeting",
    "bible study", "prayer and bible", "prayer call", "prayer calls",
    "ministry leaders", "ministry retreat", "leaders retreat",
    "rsvp for", "small group", "new member",
]

# Only include events with clear public-facing indicators
PUBLIC_KEYWORDS = [
    "community", "public", "all are welcome", "open to",
    "lecture", "concert", "symposium", "mlk", "martin luther king",
    "movie day", "film", "screening", "celebration", "festival",
    "performance", "recital", "exhibit", "gallery",
    "health fair", "food drive", "service day",
    "navigating our world",  # Their public lecture series
]


def parse_time(time_text: str) -> Optional[str]:
    """Parse time from various formats like '7pm', '10:30 AM', 'noon'."""
    if "noon" in time_text.lower():
        return "12:00"

    match = re.search(r"(\d{1,2})(?::(\d{2}))?\s*(am|pm)", time_text, re.IGNORECASE)
    if match:
        hour = int(match.group(1))
        minute = match.group(2) or "00"
        period = match.group(3).lower()

        if period == "pm" and hour != 12:
            hour += 12
        elif period == "am" and hour == 12:
            hour = 0

        return f"{hour:02d}:{minute}"
    return None


def parse_date_string(date_str: str) -> Optional[str]:
    """
    Parse date from various formats.
    Returns YYYY-MM-DD format string or None.
    """
    if not date_str:
        return None

    current_year = datetime.now().year

    # Try full month name formats (e.g., "February 7", "February 13-15")
    date_match = re.search(
        r"(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})(?:-\d{1,2})?(?:,?\s+(\d{4}))?",
        date_str,
        re.IGNORECASE
    )
    if date_match:
        month = date_match.group(1)
        day = int(date_match.group(2))
        year = int(date_match.group(3)) if date_match.group(3) else current_year
        try:
            dt = datetime.strptime(f"{month} {day} {year}", "%B %d %Y")
            if dt.date() < datetime.now().date() and not date_match.group(3):
                dt = datetime.strptime(f"{month} {day} {year + 1}", "%B %d %Y")
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            pass

    # Try short month name formats (e.g., "Feb 15", "Feb 15, 2026")
    date_match = re.search(
        r"(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})(?:,?\s+(\d{4}))?",
        date_str,
        re.IGNORECASE
    )
    if date_match:
        month = date_match.group(1)
        day = int(date_match.group(2))
        year = int(date_match.group(3)) if date_match.group(3) else current_year
        try:
            dt = datetime.strptime(f"{month} {day} {year}", "%b %d %Y")
            if dt.date() < datetime.now().date() and not date_match.group(3):
                dt = datetime.strptime(f"{month} {day} {year + 1}", "%b %d %Y")
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            pass

    return None


def determine_category_and_tags(title: str, description: str) -> tuple[str, Optional[str], list[str]]:
    """Determine category based on title and description."""
    text = f"{title} {description}".lower()
    tags = ["ebenezer-baptist", "faith", "sweet-auburn"]

    # Check if it's MLK-related (important historical events)
    if any(kw in text for kw in ["mlk", "martin luther king", "civil rights"]):
        tags.extend(["mlk", "civil-rights", "black-history-month"])
        if "birthday" in text or "celebration" in text:
            return "community", "celebration", tags

    # Bible study
    if "bible study" in text:
        tags.extend(["bible-study", "education"])
        return "community", "education", tags

    # Prayer groups
    if "prayer" in text:
        tags.extend(["prayer", "spirituality"])
        return "community", "spiritual", tags

    # Youth/Young Adult events
    if any(kw in text for kw in ["youth", "young adult", "yam"]):
        tags.extend(["young-adults", "18-35"])
        return "community", "youth", tags

    # Music/Concert
    if any(kw in text for kw in ["concert", "choir", "music", "symphony"]):
        tags.extend(["music", "live-music"])
        return "music", "gospel", tags

    # Lecture/Educational
    if any(kw in text for kw in ["lecture", "symposium", "talk", "discussion"]):
        tags.extend(["education", "lecture"])
        return "community", "education", tags

    # Default to faith/community
    return "community", "faith", tags


def is_public_event(title: str, description: str) -> bool:
    """Determine if event is public/community-facing vs. member-only.

    Default is FALSE — only include events with clear public indicators.
    Churches post many congregation-specific items (bible studies, prayer groups,
    ministry retreats) that aren't meaningful for general discovery.
    """
    text = f"{title} {description}".lower()

    # Explicit skip keywords — always exclude
    if any(kw in text for kw in SKIP_KEYWORDS):
        return False

    # Explicit public indicators
    if any(kw in text for kw in PUBLIC_KEYWORDS):
        return True

    # MLK events are public (this is Ebenezer — MLK's church)
    if "mlk" in text or "martin luther king" in text:
        return True

    # Concerts/music events are usually public
    if any(kw in text for kw in ["concert", "music", "performance", "symphony", "choir"]):
        return True

    # Default: assume congregation-specific unless proven otherwise
    return False


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Ebenezer Baptist Church public events using Playwright."""
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

            logger.info(f"Fetching Ebenezer Baptist Church: {EVENTS_URL}")
            page.goto(EVENTS_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(3000)

            # Scroll to load all content
            for _ in range(5):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1000)

            # Extract images from page
            image_map = extract_images_from_page(page)

            # Extract event links for specific URLs
            event_links = extract_event_links(page, BASE_URL)

            # This site uses Divi/Elegant Themes builder with .et_pb_text blocks for events
            # Each event is in its own .et_pb_text div
            event_elements = page.query_selector_all(".et_pb_text")
            logger.info(f"Found {len(event_elements)} .et_pb_text blocks on page")

            seen_events = set()

            if event_elements:
                logger.info(f"Processing {len(event_elements)} event containers via DOM selectors")

                for elem in event_elements:
                    try:
                        # Extract full text from container
                        elem_text = elem.inner_text().strip()

                        # Skip if too short to be an event
                        if len(elem_text) < 30:
                            continue

                        lines = [l.strip() for l in elem_text.split("\n") if l.strip()]

                        if not lines:
                            continue

                        # First line is typically the title
                        title = lines[0]

                        # Skip if title is too short or too long
                        if len(title) < 10 or len(title) > 200:
                            continue

                        # Look for date in the text (could be in title or body)
                        start_date = None
                        for line in lines:
                            parsed_date = parse_date_string(line)
                            if parsed_date:
                                start_date = parsed_date
                                break

                        if not start_date:
                            # Skip events without dates
                            logger.debug(f"No date found for: {title[:50]}")
                            continue

                        # Look for time
                        start_time = None
                        for line in lines:
                            parsed_time = parse_time(line)
                            if parsed_time:
                                start_time = parsed_time
                                break

                        # Extract description (first substantial paragraph that's not the title)
                        description_parts = []
                        for line in lines:
                            if line == title:
                                continue
                            if len(line) > 30 and not parse_date_string(line) and not parse_time(line):
                                description_parts.append(line)
                                if len(description_parts) >= 3:
                                    break

                        description = " ".join(description_parts[:3])

                        # Check if public
                        if not is_public_event(title, description):
                            logger.debug(f"Skipping member-only event: {title}")
                            continue

                        # Dedupe
                        event_key = f"{title}|{start_date}"
                        if event_key in seen_events:
                            continue
                        seen_events.add(event_key)

                        events_found += 1

                        # Generate content hash
                        content_hash = generate_content_hash(
                            title, "Ebenezer Baptist Church", start_date
                        )

                        # Check for existing

                        # Determine category and tags
                        category, subcategory, tags = determine_category_and_tags(title, description)

                        # Look for recurrence patterns
                        recurrence_pattern = None
                        elem_text_lower = elem_text.lower()
                        if any(kw in elem_text_lower for kw in ["every", "each", "weekly", "monthly"]):
                            for line in lines:
                                if re.search(r"(monday|tuesday|wednesday|thursday|friday|saturday|sunday)", line, re.IGNORECASE):
                                    recurrence_pattern = line
                                    break

                        # Build event record
                        # Get specific event URL

                        event_url = find_event_url(title, event_links, EVENTS_URL)


                        event_record = {
                            "source_id": source_id,
                            "venue_id": venue_id,
                            "title": title[:200],
                            "description": description[:1000] if description else None,
                            "start_date": start_date,
                            "start_time": start_time,
                            "end_date": None,
                            "end_time": None,
                            "is_all_day": False,
                            "category": category,
                            "subcategory": subcategory,
                            "tags": tags,
                            "price_min": None,
                            "price_max": None,
                            "price_note": "Free - donations welcome",
                            "is_free": True,
                            "source_url": event_url,
                            "ticket_url": event_url,
                            "image_url": image_map.get(title),
                            "raw_text": f"{title} {description}"[:500],
                            "extraction_confidence": 0.85,
                            "is_recurring": bool(recurrence_pattern),
                            "recurrence_rule": recurrence_pattern,
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
                            logger.info(f"Added: {title[:50]}... on {start_date}")
                        except Exception as e:
                            logger.error(f"Failed to insert: {title}: {e}")

                    except Exception as e:
                        logger.error(f"Error processing event element: {e}")
                        continue


            browser.close()

        logger.info(
            f"Ebenezer Baptist Church crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Ebenezer Baptist Church: {e}")
        raise

    return events_found, events_new, events_updated
