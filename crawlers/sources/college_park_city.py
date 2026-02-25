"""
Crawler for City of College Park Events Calendar (collegeparkga.gov/calendar.aspx).

Government events calendar for College Park, GA - community events, festivals, parks & recreation,
public meetings, and city programs. Uses CivicPlus/CivicEngage calendar system with JavaScript rendering.

Key events include: Juneteenth Parade, Light Up The City, Easter Egg Hunt, Senior Thanksgiving.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime
from typing import Optional

from playwright.sync_api import sync_playwright

from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash
from utils import extract_images_from_page

logger = logging.getLogger(__name__)

BASE_URL = "https://www.collegeparkga.gov"
CALENDAR_URL = f"{BASE_URL}/calendar.aspx"

VENUE_DATA = {
    "name": "City of College Park",
    "slug": "city-of-college-park",
    "address": "3667 Main St",
    "neighborhood": "Historic College Park",
    "city": "College Park",
    "state": "GA",
    "zip": "30337",
    "lat": 33.6473,
    "lng": -84.4494,
    "venue_type": "government",
    "spot_type": "community_center",
    "website": BASE_URL,
}


def parse_date(date_text: str) -> Optional[str]:
    """
    Parse date from various formats used on the calendar.

    Examples:
    - "January 28, 2026"
    - "Jan 28, 2026"
    - "Tuesday, February 4, 2026"
    - "02/04/2026"
    """
    date_text = date_text.strip()

    # Remove day of week if present
    date_text = re.sub(
        r"^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s*",
        "",
        date_text,
        flags=re.IGNORECASE
    )

    # Try full month name format: "January 28, 2026"
    match = re.match(
        r"(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(\d{4})",
        date_text,
        re.IGNORECASE
    )
    if match:
        try:
            dt = datetime.strptime(f"{match.group(1)} {match.group(2)} {match.group(3)}", "%B %d %Y")
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            pass

    # Try abbreviated month format: "Jan 28, 2026"
    match = re.match(
        r"(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2}),?\s+(\d{4})",
        date_text,
        re.IGNORECASE
    )
    if match:
        try:
            dt = datetime.strptime(f"{match.group(1)} {match.group(2)} {match.group(3)}", "%b %d %Y")
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            pass

    # Try MM/DD/YYYY format
    match = re.match(r"(\d{1,2})/(\d{1,2})/(\d{4})", date_text)
    if match:
        try:
            dt = datetime.strptime(date_text, "%m/%d/%Y")
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            pass

    # Try month without year: "January 28"
    now = datetime.now()
    year = now.year

    match = re.match(
        r"(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})$",
        date_text,
        re.IGNORECASE
    )
    if match:
        try:
            dt = datetime.strptime(f"{match.group(1)} {match.group(2)} {year}", "%B %d %Y")
            if dt < now:
                dt = datetime.strptime(f"{match.group(1)} {match.group(2)} {year + 1}", "%B %d %Y")
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            pass

    return None


def parse_time(time_text: str) -> Optional[str]:
    """Parse time from '7:00 PM' or '19:00' format."""
    if not time_text:
        return None

    time_text = time_text.strip()

    # Handle "7:00 PM" or "7:00pm" format
    match = re.search(r"(\d{1,2}):(\d{2})\s*(am|pm)", time_text, re.IGNORECASE)
    if match:
        hour = int(match.group(1))
        minute = match.group(2)
        period = match.group(3).lower()

        if period == "pm" and hour != 12:
            hour += 12
        elif period == "am" and hour == 12:
            hour = 0

        return f"{hour:02d}:{minute}"

    # Handle "7 PM" format (no minutes)
    match = re.search(r"(\d{1,2})\s*(am|pm)", time_text, re.IGNORECASE)
    if match:
        hour = int(match.group(1))
        period = match.group(2).lower()

        if period == "pm" and hour != 12:
            hour += 12
        elif period == "am" and hour == 12:
            hour = 0

        return f"{hour:02d}:00"

    # Handle 24-hour format
    match = re.match(r"^(\d{1,2}):(\d{2})$", time_text)
    if match:
        hour = int(match.group(1))
        minute = match.group(2)
        return f"{hour:02d}:{minute}"

    return None


def categorize_event(title: str, description: str) -> tuple[str, list[str]]:
    """Determine category and tags based on title and description."""
    text = (title + " " + description).lower()
    tags = ["college-park", "community"]

    # Check for specific event types
    if any(w in text for w in ["festival", "celebration", "parade", "juneteenth", "light up the city"]):
        tags.append("festival")
        return "community", tags

    if any(w in text for w in ["concert", "music", "band", "jazz", "orchestra", "symphony"]):
        tags.append("music")
        return "music", tags

    if any(w in text for w in ["art", "gallery", "exhibition", "artist", "craft fair"]):
        tags.append("arts")
        return "arts", tags

    if any(w in text for w in ["kids", "children", "family", "youth", "storytime", "easter egg hunt"]):
        tags.append("family-friendly")
        return "family", tags

    if any(w in text for w in ["senior", "thanksgiving", "elder"]):
        tags.append("seniors")
        return "community", tags

    if any(w in text for w in ["market", "farmers", "vendor"]):
        tags.append("farmers-market")
        return "food_drink", tags

    if any(w in text for w in ["meeting", "council", "commission", "board", "city hall"]):
        tags.append("government")
        return "community", tags

    if any(w in text for w in ["parks", "recreation", "trail", "outdoor", "hike"]):
        tags.append("parks")
        tags.append("outdoor")
        return "outdoor", tags

    if any(w in text for w in ["fitness", "yoga", "exercise", "sports", "run", "race"]):
        tags.append("fitness")
        return "sports", tags

    if any(w in text for w in ["library", "reading", "book", "author"]):
        tags.append("library")
        return "education", tags

    if any(w in text for w in ["workshop", "class", "training", "seminar"]):
        tags.append("workshop")
        return "education", tags

    if any(w in text for w in ["theater", "theatre", "play", "performance"]):
        tags.append("theater")
        return "theater", tags

    if any(w in text for w in ["movie", "film", "screening"]):
        tags.append("film")
        return "film", tags

    # Default to community events
    return "community", tags


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl City of College Park calendar using Playwright."""
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

            venue_id = get_or_create_venue(VENUE_DATA)

            logger.info(f"Fetching City of College Park calendar: {CALENDAR_URL}")

            # Navigate and wait for page to load
            page.goto(CALENDAR_URL, wait_until="domcontentloaded", timeout=60000)
            page.wait_for_timeout(8000)  # Wait for CivicPlus calendar JS to load

            # Try to wait for calendar content to load
            try:
                page.wait_for_selector(
                    ".calendar-event, .event-item, [class*='event'], [class*='calendar']",
                    timeout=10000
                )
            except Exception:
                logger.warning("Could not find event selectors, continuing anyway")

            # Extract images from page
            image_map = extract_images_from_page(page)

            # Scroll to load all events
            for _ in range(5):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1500)

            # Get page text
            body_text = page.inner_text("body")

            # Check if still showing errors or blank
            if "error" in body_text.lower()[:1000] or len(body_text) < 500:
                logger.warning("Page may not have loaded correctly")

            # Find event list items (CivicPlus calendar uses li elements with h3 and .date)
            all_li_elements = page.query_selector_all("li")
            event_elements = []
            for li in all_li_elements:
                h3 = li.query_selector("h3")
                date_elem = li.query_selector(".date")
                if h3 and date_elem:
                    event_elements.append(li)

            if not event_elements:
                logger.info("No event elements found with standard selectors, trying fallback text parsing")
                # Fallback to text parsing
                events_found, events_new, events_updated = parse_text_content(
                    body_text, source_id, venue_id, image_map
                )
            else:
                # Parse event elements
                logger.info(f"Found {len(event_elements)} event elements")
                for element in event_elements:
                    try:
                        # Get title from h3
                        title_elem = element.query_selector("h3")
                        if not title_elem:
                            continue

                        title = title_elem.inner_text().strip()
                        if not title or len(title) < 3:
                            continue

                        # Guard against descriptions being captured as titles
                        if len(title) > 150:
                            logger.warning(f"Title too long ({len(title)} chars), skipping: {title[:80]}...")
                            continue

                        # Get date - CivicPlus uses structured data which is more reliable
                        structured_date = element.query_selector('[itemprop="startDate"]')
                        if structured_date:
                            # Use ISO format from structured data (e.g., "2026-02-11T18:30:00")
                            iso_date = structured_date.inner_text().strip()
                            try:
                                dt = datetime.fromisoformat(iso_date)
                                start_date = dt.strftime("%Y-%m-%d")
                                start_time = dt.strftime("%H:%M")
                            except ValueError as e:
                                logger.warning(f"Failed to parse structured date '{iso_date}': {e}")
                                continue
                        else:
                            # Fallback to text parsing with normalization
                            date_elem = element.query_selector(".date")
                            if not date_elem:
                                continue

                            date_text = date_elem.inner_text().strip()
                            # Normalize non-breaking spaces and thin spaces to regular spaces
                            date_text = date_text.replace('\xa0', ' ').replace('\u2009', ' ')
                            start_date = parse_date(date_text)

                            if not start_date:
                                logger.warning(f"Could not parse date: {repr(date_text)}")
                                continue

                            # Parse time from date text
                            start_time = parse_time(date_text)

                        events_found += 1

                        # Get description from .icalDescription or .eventLocation
                        desc_elem = element.query_selector(".icalDescription, .eventLocation")
                        description = desc_elem.inner_text().strip() if desc_elem else ""
                        if len(description) > 500:
                            description = description[:497] + "..."

                        # Categorize event
                        category, tags = categorize_event(title, description)

                        # Generate content hash
                        content_hash = generate_content_hash(title, "City of College Park", start_date)

                        # Check if exists

                        # Default to not-free; only set True when source text says "free"
                        is_free = False
                        if any(word in (title + " " + description).lower() for word in ["free", "no cost", "no charge", "complimentary"]):
                            is_free = True

                        # Build event record
                        event_record = {
                            "source_id": source_id,
                            "venue_id": venue_id,
                            "title": title,
                            "description": description if description else f"Event at City of College Park",
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
                            "source_url": CALENDAR_URL,
                            "ticket_url": CALENDAR_URL,
                            "image_url": image_map.get(title),
                            "raw_text": f"{title} - {start_date}",
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
                            logger.info(f"Added: {title} on {start_date}")
                        except Exception as e:
                            logger.error(f"Failed to insert event '{title}': {e}")

                    except Exception as e:
                        logger.error(f"Error parsing event element: {e}")
                        continue

            browser.close()

        logger.info(
            f"City of College Park crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl City of College Park: {e}")
        raise

    return events_found, events_new, events_updated


def parse_text_content(
    body_text: str,
    source_id: int,
    venue_id: int,
    image_map: dict[str, str]
) -> tuple[int, int, int]:
    """Fallback parser for plain text content."""
    events_found = 0
    events_new = 0
    events_updated = 0

    lines = [l.strip() for l in body_text.split("\n") if l.strip()]

    # Skip common navigation items
    skip_items = [
        "home", "about", "contact", "search", "menu", "calendar",
        "skip to main", "government", "departments", "residents",
        "business", "visitors", "subscribe", "apply", "pay",
        "notify me", "show past events", "start date", "end date",
        "enter search terms", "select a calendar", "all calendars"
    ]

    i = 0
    seen_events = set()

    while i < len(lines):
        line = lines[i]
        line_lower = line.lower()

        # Skip nav/UI items and short lines
        if line_lower in skip_items or len(line) < 3:
            i += 1
            continue

        # Look for date patterns
        start_date = parse_date(line)

        if start_date:
            # Look for title in surrounding lines
            title = None
            start_time = None
            description = None

            # Check previous lines for title (usually 1-2 lines before date)
            for offset in [-2, -1]:
                idx = i + offset
                if 0 <= idx < len(lines):
                    check_line = lines[idx].strip()

                    if len(check_line) > 5 and check_line.lower() not in skip_items:
                        # Avoid common navigation text
                        if not re.match(r"^(home|about|contact|search|menu)", check_line, re.IGNORECASE):
                            if not parse_date(check_line):  # Make sure it's not a date
                                title = check_line
                                break

            # Check next lines for time and description
            for offset in [1, 2, 3]:
                idx = i + offset
                if idx < len(lines):
                    check_line = lines[idx].strip()

                    # Try to parse as time
                    if not start_time:
                        start_time = parse_time(check_line)

                    # Look for description (not a date or time)
                    if not description and len(check_line) > 30:
                        if not parse_date(check_line) and not parse_time(check_line):
                            if not re.match(r"^(more info|learn more|register|details)", check_line, re.IGNORECASE):
                                description = check_line[:500]

            if title:
                # Validate title length (reject descriptions captured as titles)
                if len(title) > 150:
                    logger.warning(f"Title too long ({len(title)} chars) in text parser, skipping: {title[:80]}...")
                    i += 1
                    continue

                # Reject common description patterns that got captured as titles
                description_patterns = [
                    r"^Community is strongest",
                    r"^Join us for",
                    r"^Come join",
                    r"^Please join",
                    r"^We invite you",
                    r"^Celebrate with us",
                    r"^Bring your family",
                ]
                if any(re.match(pattern, title, re.IGNORECASE) for pattern in description_patterns):
                    logger.warning(f"Title matches description pattern, skipping: {title[:80]}...")
                    i += 1
                    continue

                # Check for duplicates
                event_key = f"{title}|{start_date}"
                if event_key in seen_events:
                    i += 1
                    continue
                seen_events.add(event_key)

                events_found += 1

                content_hash = generate_content_hash(title, "City of College Park", start_date)

                if find_event_by_hash(content_hash):
                    events_updated += 1
                else:
                    category, tags = categorize_event(title, description or "")

                    # Default to not-free; only set True when source text says "free"
                    is_free = False
                    text_check = f"{title} {description or ''}".lower()
                    if any(word in text_check for word in ["free", "no cost", "no charge", "complimentary"]):
                        is_free = True

                    event_record = {
                        "source_id": source_id,
                        "venue_id": venue_id,
                        "title": title,
                        "description": description if description else "Event at City of College Park",
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
                        "source_url": CALENDAR_URL,
                        "ticket_url": CALENDAR_URL,
                        "image_url": image_map.get(title),
                        "raw_text": f"{title} - {start_date}",
                        "extraction_confidence": 0.75,
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

        i += 1

    return events_found, events_new, events_updated
