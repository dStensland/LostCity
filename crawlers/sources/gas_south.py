"""
Crawler for Gas South Arena (gassouthdistrict.com).
Formerly known as Infinite Energy Arena.

Hosts concerts, hockey (Atlanta Gladiators), and major events in Gwinnett County.
Site uses JavaScript rendering - must use Playwright.

Updated to use DOM extraction instead of fragile text parsing.
"""

from __future__ import annotations

import re
import json
import logging
from datetime import datetime
from typing import Optional

from playwright.sync_api import sync_playwright

from db import get_or_create_venue, insert_event, find_event_by_hash, remove_stale_source_events
from dedupe import generate_content_hash
from utils import extract_event_links, find_event_url

logger = logging.getLogger(__name__)

BASE_URL = "https://www.gassouthdistrict.com"
EVENTS_URL = f"{BASE_URL}/events"

VENUE_DATA = {
    "name": "Gas South Arena",
    "slug": "gas-south-arena",
    "address": "6400 Sugarloaf Pkwy",
    "neighborhood": "Duluth",
    "city": "Duluth",
    "state": "GA",
    "zip": "30097",
    "lat": 33.9618,
    "lng": -84.0965,
    "venue_type": "arena",
    "spot_type": "stadium",
    "website": BASE_URL,
}


def parse_time(time_text: str) -> Optional[str]:
    """Parse time from '7:00 PM', '7pm', '7:00pm' formats."""
    # Try HH:MM AM/PM format
    match = re.search(r"(\d{1,2}):(\d{2})\s*(am|pm)", time_text, re.IGNORECASE)
    if match:
        hour, minute, period = match.groups()
        hour = int(hour)
        if period.lower() == "pm" and hour != 12:
            hour += 12
        elif period.lower() == "am" and hour == 12:
            hour = 0
        return f"{hour:02d}:{minute}"

    # Try H AM/PM format (e.g., "7pm")
    match = re.search(r"(\d{1,2})\s*(am|pm)", time_text, re.IGNORECASE)
    if match:
        hour, period = match.groups()
        hour = int(hour)
        if period.lower() == "pm" and hour != 12:
            hour += 12
        elif period.lower() == "am" and hour == 12:
            hour = 0
        return f"{hour:02d}:00"

    return None


def parse_jsonld_events(page) -> list[dict]:
    """Extract event data from JSON-LD structured data."""
    events = []

    scripts = page.query_selector_all('script[type="application/ld+json"]')
    for script in scripts:
        try:
            content = script.inner_html()
            data = json.loads(content)

            if isinstance(data, dict) and data.get("@type") == "Event":
                events.append(data)
            elif isinstance(data, list):
                for item in data:
                    if isinstance(item, dict) and item.get("@type") == "Event":
                        events.append(item)
        except (json.JSONDecodeError, Exception) as e:
            logger.debug(f"Could not parse JSON-LD: {e}")
            continue

    return events


def extract_events_from_dom(page) -> list[dict]:
    """Extract event data by parsing the page text content.

    The site structure has a predictable pattern:
    - Title
    - Venue (GAS SOUTH ARENA® or GAS SOUTH THEATER®)
    - Date (e.g., "Feb 4" or "Feb 7 - 8")
    - Time (e.g., "7:10pm")
    """
    body_text = page.inner_text("body")
    lines = [l.strip() for l in body_text.split("\n") if l.strip()]

    events = []
    skip_titles = {
        'grid', 'list', 'atlanta vibe', 'georgia swarm', 'buy tickets', 'more info',
        'search', 'accessibility', 'gas south district', 'events & tickets',
        'arena', 'convention center', 'theater', 'connect with us', 'upcoming events',
        'sort by venue', 'event list', 'cal'
    }
    used_title_indices = set()  # Track which lines we've already used as titles

    i = 0
    while i < len(lines):
        line = lines[i]

        # Look for venue indicators (these mark event boundaries)
        if "GAS SOUTH" in line.upper():
            title = None
            title_index = None
            date_text = None
            time_text = None

            # Look backward for title (skip backwards until we find a valid title)
            for j in range(i-1, max(0, i-5), -1):
                # Skip if we already used this line as a title
                if j in used_title_indices:
                    continue

                candidate = lines[j].strip()
                if candidate and len(candidate) > 3:
                    # Skip known non-title lines
                    if candidate.lower() in skip_titles:
                        continue

                    # Skip if it contains "GAS SOUTH" (venue names)
                    if "GAS SOUTH" in candidate.upper():
                        continue

                    # Skip if it looks like a date (e.g., "Feb 7", "Feb 7 - 8")
                    if re.match(
                        r'^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}',
                        candidate,
                        re.IGNORECASE
                    ):
                        continue

                    # Skip if it looks like a time (e.g., "7:10pm")
                    if re.search(r'\d{1,2}:\d{2}\s*(am|pm)', candidate, re.IGNORECASE):
                        continue

                    title = candidate
                    title_index = j
                    break

            # Look forward for date and time
            for j in range(i+1, min(len(lines), i+5)):
                check_line = lines[j].strip()

                # Date pattern: "Feb 4", "February 4", "Feb 7 - 8"
                if not date_text:
                    date_match = re.match(
                        r'(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:\s*-\s*\d{1,2})?',
                        check_line,
                        re.IGNORECASE
                    )
                    if date_match:
                        date_text = date_match.group(0)

                # Time pattern: "7:10pm", "7:10 pm"
                if not time_text:
                    time_match = re.search(r'\d{1,2}:\d{2}\s*(am|pm)', check_line, re.IGNORECASE)
                    if time_match:
                        time_text = time_match.group(0)

            if title and date_text:
                # Mark this title line as used
                if title_index is not None:
                    used_title_indices.add(title_index)

                events.append({
                    'title': title,
                    'dateText': date_text,
                    'timeText': time_text or '',
                })

        i += 1

    return events


def infer_category(title: str) -> str:
    """Infer event category from title."""
    title_lower = title.lower()

    # Sports events
    if any(word in title_lower for word in ["gladiators", "hockey", "game", "vs.", "vs"]):
        return "sports"

    # Music events
    if any(word in title_lower for word in ["concert", "tour", "band", "music", "fest", "festival"]):
        return "music"

    # Family/kids events
    if any(word in title_lower for word in ["disney", "kids", "family", "children", "paw patrol", "sesame"]):
        return "family"

    # Comedy
    if any(word in title_lower for word in ["comedy", "comedian", "laugh"]):
        return "nightlife"

    # Default to community for other events (conventions, expos, etc.)
    return "community"


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Gas South Arena events using Playwright with DOM extraction."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0
    current_hashes = set()

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
                viewport={"width": 1920, "height": 1080},
            )
            page = context.new_page()

            venue_id = get_or_create_venue(VENUE_DATA)

            logger.info(f"Fetching Gas South Arena: {EVENTS_URL}")
            page.goto(EVENTS_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(3000)

            # Scroll to load lazy-loaded content
            for _ in range(5):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1000)

            # Extract event links for specific URLs
            event_links = extract_event_links(page, BASE_URL)

            # Try JSON-LD extraction first (structured data)
            jsonld_events = parse_jsonld_events(page)

            if jsonld_events:
                logger.info(f"Found {len(jsonld_events)} events in JSON-LD data")

                for event_data in jsonld_events:
                    try:
                        title = event_data.get("name", "")
                        if not title:
                            continue

                        # Parse ISO datetime
                        start_date_str = event_data.get("startDate", "")
                        if not start_date_str:
                            continue

                        try:
                            start_dt = datetime.fromisoformat(start_date_str.replace("Z", "+00:00"))
                            start_date = start_dt.strftime("%Y-%m-%d")
                            start_time = start_dt.strftime("%H:%M")
                        except ValueError:
                            continue

                        # Skip past events
                        if datetime.strptime(start_date, "%Y-%m-%d").date() < datetime.now().date():
                            continue

                        events_found += 1
                        content_hash = generate_content_hash(title, "Gas South Arena", start_date)
                        current_hashes.add(content_hash)

                        if find_event_by_hash(content_hash):
                            events_updated += 1
                            continue

                        # Extract image and description
                        image_url = event_data.get("image")
                        if isinstance(image_url, list):
                            image_url = image_url[0] if image_url else None

                        description = event_data.get("description", f"Event at Gas South Arena")

                        category = infer_category(title)

                        # Get specific event URL


                        event_url = find_event_url(title, event_links, EVENTS_URL)



                        event_record = {
                            "source_id": source_id,
                            "venue_id": venue_id,
                            "title": title,
                            "description": description[:1000] if description else None,
                            "start_date": start_date,
                            "start_time": start_time,
                            "end_date": None,
                            "end_time": None,
                            "is_all_day": False,
                            "category": category,
                            "subcategory": None,
                            "tags": ["gas-south", "duluth", "arena"],
                            "price_min": None,
                            "price_max": None,
                            "price_note": None,
                            "is_free": False,
                            "source_url": event_url,
                            "ticket_url": event_data.get("url", EVENTS_URL),
                            "image_url": image_url,
                            "raw_text": f"{title} - {start_date}",
                            "extraction_confidence": 0.90,
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

                    except Exception as e:
                        logger.error(f"Error processing JSON-LD event: {e}")
                        continue

            # Fallback to DOM extraction if no JSON-LD data
            else:
                logger.info("No JSON-LD data found, using DOM extraction")
                dom_events = extract_events_from_dom(page)
                logger.info(f"Extracted {len(dom_events)} events from DOM")

                for event_data in dom_events:
                    try:
                        title = event_data.get("title", "").strip()
                        if not title or len(title) < 3:
                            continue

                        # Parse date from dateText (e.g., "Feb 4" or "Feb 7 - 8")
                        date_text = event_data.get("dateText", "")
                        if not date_text:
                            continue

                        # Extract month and day from date text
                        # Handle ranges by taking first date only
                        date_match = re.match(
                            r'(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})',
                            date_text,
                            re.IGNORECASE
                        )

                        if not date_match:
                            logger.debug(f"Could not parse date from: {date_text}")
                            continue

                        month = date_match.group(1)
                        day = date_match.group(2)
                        year = str(datetime.now().year)

                        try:
                            month_str = month[:3] if len(month) > 3 else month
                            dt = datetime.strptime(f"{month_str} {day} {year}", "%b %d %Y")

                            # If date is in the past, assume next year
                            if dt.date() < datetime.now().date():
                                dt = datetime.strptime(f"{month_str} {day} {int(year) + 1}", "%b %d %Y")

                            start_date = dt.strftime("%Y-%m-%d")
                        except ValueError as e:
                            logger.debug(f"Could not parse date for {title}: {e}")
                            continue

                        # Parse time
                        time_text = event_data.get("timeText", "")
                        start_time = parse_time(time_text) if time_text else None

                        # Default to 7:00 PM for arena events if no time found
                        if not start_time:
                            start_time = "19:00"
                            logger.debug(f"No time found for {title}, defaulting to 7:00 PM")

                        events_found += 1
                        content_hash = generate_content_hash(title, "Gas South Arena", start_date)
                        current_hashes.add(content_hash)

                        if find_event_by_hash(content_hash):
                            events_updated += 1
                            continue

                        category = infer_category(title)

                        # Get specific event URL


                        event_url = find_event_url(title, event_links, EVENTS_URL)



                        event_record = {
                            "source_id": source_id,
                            "venue_id": venue_id,
                            "title": title,
                            "description": f"Event at Gas South Arena",
                            "start_date": start_date,
                            "start_time": start_time,
                            "end_date": None,
                            "end_time": None,
                            "is_all_day": False,
                            "category": category,
                            "subcategory": None,
                            "tags": ["gas-south", "duluth", "arena"],
                            "price_min": None,
                            "price_max": None,
                            "price_note": None,
                            "is_free": False,
                            "source_url": event_url,
                            "ticket_url": event_url,
                            "image_url": None,
                            "raw_text": f"{title} - {date_text} {time_text}",
                            "extraction_confidence": 0.80,
                            "is_recurring": False,
                            "recurrence_rule": None,
                            "content_hash": content_hash,
                        }

                        try:
                            insert_event(event_record)
                            events_new += 1
                            logger.info(f"Added: {title} on {start_date} at {start_time}")
                        except Exception as e:
                            logger.error(f"Failed to insert: {title}: {e}")

                    except Exception as e:
                        logger.error(f"Error processing DOM event: {e}")
                        continue

            browser.close()

        # Remove stale events (events that are no longer listed on the source)
        removed = remove_stale_source_events(source_id, current_hashes)
        logger.info(f"Removed {removed} stale events")

        logger.info(
            f"Gas South Arena crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Gas South Arena: {e}")
        raise

    return events_found, events_new, events_updated
