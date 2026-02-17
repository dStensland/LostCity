"""
Crawler for Buckhead Theatre (thebuckheadtheatre.com).

Historic 1931 theater in Buckhead hosting concerts, comedy, and special events.
Uses direct website with MusicEvent schema structured data.
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

BASE_URL = "https://www.thebuckheadtheatre.com"
SHOWS_URL = f"{BASE_URL}/shows"

VENUE_DATA = {
    "name": "Buckhead Theatre",
    "slug": "buckhead-theatre",
    "address": "3110 Roswell Rd NE",
    "neighborhood": "Buckhead",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30305",
    "lat": 33.8395,
    "lng": -84.3798,
    "venue_type": "theater",
    "spot_type": "theater",
    "website": BASE_URL,
}

def parse_date(date_text: str) -> Optional[str]:
    """Parse date from formats like 'February 1, 2026' or 'Feb 1, 2026'."""
    if not date_text:
        return None

    date_text = date_text.strip()

    # Try "February 1, 2026" or "Feb 1, 2026" format
    match = re.search(
        r"(January|February|March|April|May|June|July|August|September|October|November|December|"
        r"Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2}),?\s*(\d{4})",
        date_text,
        re.IGNORECASE
    )
    if match:
        month, day, year = match.groups()
        try:
            dt = datetime.strptime(f"{month[:3]} {day} {year}", "%b %d %Y")
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            pass

    return None


def parse_time(time_text: str) -> Optional[str]:
    """Parse time from '7:00 PM' or '8:00 PM' format."""
    if not time_text:
        return None

    match = re.search(r"(\d{1,2}):(\d{2})\s*(am|pm)", time_text, re.IGNORECASE)
    if match:
        hour, minute, period = match.groups()
        hour = int(hour)
        if period.lower() == "pm" and hour != 12:
            hour += 12
        elif period.lower() == "am" and hour == 12:
            hour = 0
        return f"{hour:02d}:{minute}"
    return None


def determine_category(title: str) -> tuple[str, Optional[str], list[str]]:
    """Determine category, subcategory, and tags based on event title."""
    title_lower = title.lower()

    # Comedy shows
    if any(word in title_lower for word in ["comedy", "comedian", "stand-up", "standup", "funny", "laughs"]):
        return "nightlife", "comedy", ["comedy", "standup", "buckhead-theatre", "buckhead"]

    # Tours often have specific keywords
    if any(word in title_lower for word in ["tour", "live", "concert"]):
        return "music", "concert", ["concert", "live-music", "buckhead-theatre", "buckhead"]

    # Default to music/concert for this venue
    return "music", "concert", ["concert", "live-music", "buckhead-theatre", "buckhead"]


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Buckhead Theatre events from thebuckheadtheatre.com.

    The site embeds event data as JSON-LD structured data (MusicEvent schema).
    We extract from the script tags rather than parsing rendered HTML.
    """
    import json

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

            logger.info(f"Fetching Buckhead Theatre: {SHOWS_URL}")
            page.goto(SHOWS_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(3000)

            # Scroll to load all content (may trigger lazy-loaded JSON-LD)
            for _ in range(3):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1000)

            # Extract image map for event images
            image_map = extract_images_from_page(page)

            # Extract JSON-LD scripts containing MusicEvent data
            json_ld_scripts = page.query_selector_all('script[type="application/ld+json"]')
            logger.info(f"Found {len(json_ld_scripts)} JSON-LD scripts")

            seen_events = set()

            for script in json_ld_scripts:
                try:
                    script_content = script.inner_text()
                    if not script_content:
                        continue

                    data = json.loads(script_content)

                    # Handle both single objects and arrays
                    events_data = data if isinstance(data, list) else [data]

                    for event_data in events_data:
                        # Check if this is a MusicEvent
                        event_type = event_data.get("@type", "")
                        if event_type not in ["MusicEvent", "Event", "ComedyEvent", "TheaterEvent"]:
                            continue

                        title = event_data.get("name")
                        start_date_str = event_data.get("startDate")
                        event_url = event_data.get("url", SHOWS_URL)

                        if not title or not start_date_str:
                            continue

                        # Parse ISO date format (2026-02-01T19:00:00-05:00)
                        try:
                            # Handle ISO format with timezone
                            dt = datetime.fromisoformat(start_date_str.replace("Z", "+00:00"))
                            start_date = dt.strftime("%Y-%m-%d")
                            start_time = dt.strftime("%H:%M")
                        except ValueError:
                            # Fallback to simple date parsing
                            start_date = parse_date(start_date_str)
                            start_time = parse_time(start_date_str)
                            if not start_date:
                                continue

                        # Skip past events
                        try:
                            event_date = datetime.strptime(start_date, "%Y-%m-%d").date()
                            if event_date < datetime.now().date():
                                continue
                        except ValueError:
                            continue

                        # Check for duplicates
                        event_key = f"{title}|{start_date}"
                        if event_key in seen_events:
                            continue
                        seen_events.add(event_key)

                        events_found += 1

                        content_hash = generate_content_hash(title, "Buckhead Theatre", start_date)


                        category, subcategory, tags = determine_category(title)

                        # Get image from JSON-LD if available
                        image_url = None
                        image_data = event_data.get("image")
                        if isinstance(image_data, str):
                            image_url = image_data
                        elif isinstance(image_data, list) and image_data:
                            image_url = image_data[0]
                        elif isinstance(image_data, dict):
                            image_url = image_data.get("url")

                        # If no JSON-LD image, try matching from image map
                        if not image_url:
                            title_lower = title.lower()
                            for img_alt, img_url in image_map.items():
                                if img_alt.lower() == title_lower or title_lower in img_alt.lower() or img_alt.lower() in title_lower:
                                    image_url = img_url
                                    break

                        event_record = {
                            "source_id": source_id,
                            "venue_id": venue_id,
                            "title": title,
                            "description": event_data.get("description", f"{title} at Buckhead Theatre"),
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
                            "price_note": "Tickets at thebuckheadtheatre.com",
                            "is_free": False,
                            "source_url": event_url,
                            "ticket_url": event_url,
                            "image_url": image_url,
                            "raw_text": json.dumps(event_data)[:500],
                            "extraction_confidence": 0.95,
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
                            logger.error(f"Failed to insert: {title}: {e}")

                except json.JSONDecodeError as e:
                    logger.debug(f"Failed to parse JSON-LD: {e}")
                    continue
                except Exception as e:
                    logger.debug(f"Error processing JSON-LD script: {e}")
                    continue

            # Fallback: parse page text if no JSON-LD events found
            if events_found == 0:
                logger.info("No JSON-LD events found, trying text parsing fallback")
                events_found, events_new, events_updated = parse_text_events(
                    page, source_id, venue_id
                )

            browser.close()

        logger.info(
            f"Buckhead Theatre crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Buckhead Theatre: {e}")
        raise

    return events_found, events_new, events_updated


def parse_text_events(page, source_id: int, venue_id: int) -> tuple[int, int, int]:
    """Fallback text-based parsing when DOM selectors don't work."""
    events_found = 0
    events_new = 0
    events_updated = 0
    seen_events = set()

    body_text = page.inner_text("body")
    lines = [l.strip() for l in body_text.split("\n") if l.strip()]

    i = 0
    while i < len(lines):
        line = lines[i]

        # Look for date pattern
        start_date = parse_date(line)
        if start_date:
            # Skip past events
            try:
                event_date = datetime.strptime(start_date, "%Y-%m-%d").date()
                if event_date < datetime.now().date():
                    i += 1
                    continue
            except ValueError:
                i += 1
                continue

            # Look for title in previous lines
            title = None
            for offset in range(1, min(4, i + 1)):
                prev_line = lines[i - offset].strip()
                if len(prev_line) > 3 and not parse_date(prev_line) and not parse_time(prev_line):
                    skip_words = ["buy tickets", "more info", "sold out", "shows", "events"]
                    if prev_line.lower() not in skip_words:
                        title = prev_line
                        break

            if not title:
                i += 1
                continue

            # Look for time in nearby lines
            start_time = None
            for j in range(max(0, i - 2), min(len(lines), i + 3)):
                start_time = parse_time(lines[j])
                if start_time:
                    break

            # Check for duplicates
            event_key = f"{title}|{start_date}"
            if event_key in seen_events:
                i += 1
                continue
            seen_events.add(event_key)

            events_found += 1

            content_hash = generate_content_hash(title, "Buckhead Theatre", start_date)

            existing = find_event_by_hash(content_hash)
            if existing:
                smart_update_existing_event(existing, event_record)
                events_updated += 1
                i += 1
                continue

            category, subcategory, tags = determine_category(title)

            event_record = {
                "source_id": source_id,
                "venue_id": venue_id,
                "title": title,
                "description": f"{title} at Buckhead Theatre",
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
                "price_note": "Tickets at thebuckheadtheatre.com",
                "is_free": False,
                "source_url": SHOWS_URL,
                "ticket_url": SHOWS_URL,
                "image_url": None,
                "raw_text": f"{title} - {start_date}",
                "extraction_confidence": 0.80,
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
