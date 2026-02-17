"""
Crawler for Central Presbyterian Church public events.
https://cpcatlanta.org/events-calendar/

Historic downtown church hosting "Concerts with a Cause" series,
Saturday master classes, worship concerts, and community programs.
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

BASE_URL = "https://cpcatlanta.org"
EVENTS_URL = f"{BASE_URL}/events-calendar/"

VENUE_DATA = {
    "name": "Central Presbyterian Church",
    "slug": "central-presbyterian-church",
    "address": "201 Washington St SW",
    "neighborhood": "Downtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30303",
    "lat": 33.7490,
    "lng": -84.3907,
    "venue_type": "church",
    "spot_type": "church",
    "website": BASE_URL,
    "vibes": ["faith-christian", "presbyterian", "live-music", "historic"],
}

# Skip member-only, internal church business, or non-event entries
SKIP_KEYWORDS = [
    "member", "deacon", "trustee", "pastor search", "session meeting",
    "business meeting", "board meeting", "staff meeting", "committee",
    "bible study", "prayer group", "small group",
    "sunday school", "choir rehearsal", "staff retreat",
    "budget", "annual meeting", "congregational meeting",
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

    # Try YYYY-MM-DD format
    date_match = re.search(r"(\d{4})-(\d{2})-(\d{2})", date_str)
    if date_match:
        return date_str

    return None


def determine_category_and_tags(title: str, description: str) -> tuple[str, Optional[str], list[str]]:
    """Determine category based on title and description."""
    text = f"{title} {description}".lower()
    tags = ["central-presbyterian", "downtown", "historic"]

    # --- Music events (must have explicit music keywords) ---

    # Concerts with a Cause series
    if "concerts with a cause" in text:
        tags.extend(["live-music", "charity", "concert-series"])
        return "music", "classical", tags

    # Explicit concert/recital/performance
    if any(kw in text for kw in [
        "concert", "recital", "symphony", "orchestra", "quartet",
        "ensemble", "sonata", "cantata", "chorale",
    ]):
        tags.append("live-music")
        return "music", "classical", tags

    # Organ music (common in historic churches)
    if "organ" in text and any(kw in text for kw in [
        "recital", "concert", "music", "play", "perform",
    ]):
        tags.extend(["live-music", "classical"])
        return "music", "classical", tags

    # Worship concerts (distinct from regular worship)
    if "worship concert" in text:
        tags.extend(["live-music", "gospel"])
        return "music", "worship", tags

    # Master classes (music education)
    if "master class" in text or "masterclass" in text:
        tags.extend(["class", "hands-on"])
        return "learning", "workshop", tags

    # --- Religious events ---

    if any(kw in text for kw in [
        "worship", "service", "sermon", "prayer", "vespers", "advent",
        "lent", "ash wednesday", "easter", "christmas eve", "palm sunday",
        "holy week", "communion", "eucharist", "baptism", "confirmation",
        "ordination", "memorial service", "funeral",
    ]):
        tags.append("community")
        return "religious", None, tags

    # --- Community / social services ---

    if any(kw in text for kw in [
        "shelter", "night shelter", "homeless", "food pantry", "food bank",
        "meal", "soup kitchen", "clothing", "donation drive",
    ]):
        tags.extend(["volunteer", "community"])
        return "community", "service", tags

    # --- Advocacy / civic ---

    if any(kw in text for kw in [
        "advocacy", "council", "aging", "civic", "rally", "march",
        "justice", "rights", "policy", "legislative", "voter",
        "organizing", "activist",
    ]):
        tags.extend(["activism", "community"])
        return "community", "advocacy", tags

    # --- Education / lectures ---

    if any(kw in text for kw in [
        "lecture", "talk", "discussion", "symposium", "seminar",
        "class", "workshop", "lesson", "training", "presentation",
        "art of the", "history of",
    ]):
        tags.append("educational")
        return "learning", "lecture", tags

    # --- Art / exhibitions ---

    if any(kw in text for kw in [
        "exhibition", "exhibit", "gallery", "art show", "sculpture",
    ]):
        return "art", "exhibition", tags

    # --- Default to community (it's a church, not a music venue) ---
    tags.append("community")
    return "community", None, tags


def is_public_event(title: str, description: str) -> bool:
    """Determine if event is public/community-facing vs. member-only."""
    text = f"{title} {description}".lower()

    # Explicit skip keywords — always filter these out
    if any(kw in text for kw in SKIP_KEYWORDS):
        return False

    # Music/performance events are public
    if any(kw in text for kw in [
        "concert", "recital", "performance", "master class", "masterclass",
        "symphony", "orchestra", "ensemble", "worship concert",
    ]):
        return True

    # Community programs open to the public
    if any(kw in text for kw in [
        "all are welcome", "open to the public", "free and open",
        "shelter", "food pantry", "advocacy day",
        "council on aging", "community meal",
    ]):
        return True

    # Educational events / discussions
    if any(kw in text for kw in [
        "lecture", "symposium", "workshop", "seminar", "presentation",
        "discussion", "panel",
    ]):
        return True

    # Art exhibitions
    if any(kw in text for kw in ["exhibition", "exhibit", "gallery", "art show"]):
        return True

    # Default: assume member-only unless explicitly public
    return False


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Central Presbyterian Church public events using Playwright."""
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

            logger.info(f"Fetching Central Presbyterian Church: {EVENTS_URL}")
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

            # Try common event selectors
            event_selectors = [
                ".event-item",
                ".tribe-events-list-event-title",
                ".eventlist-event",
                "[class*='event']",
                "article.event",
                ".event",
                ".calendar-event",
            ]

            event_elements = []
            for selector in event_selectors:
                elements = page.query_selector_all(selector)
                if elements:
                    logger.info(f"Found {len(elements)} events using selector: {selector}")
                    event_elements = elements
                    break

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
                            title, "Central Presbyterian Church", start_date
                        )

                        # Check for existing

                        # Determine category and tags
                        category, subcategory, tags = determine_category_and_tags(title, description)

                        # Look for event URL
                        event_url = find_event_url(title, event_links, EVENTS_URL)

                        # Build event record
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
                            logger.info(f"Added: {title[:50]}... on {start_date}")
                        except Exception as e:
                            logger.error(f"Failed to insert: {title}: {e}")

                    except Exception as e:
                        logger.error(f"Error processing event element: {e}")
                        continue

            browser.close()

        logger.info(
            f"Central Presbyterian Church crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Central Presbyterian Church: {e}")
        raise

    return events_found, events_new, events_updated
