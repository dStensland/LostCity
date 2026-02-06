"""
Crawler for Rockler Woodworking Sandy Springs classes.

Classes are hosted on Eventbrite - uses Playwright to extract structured JSON data.
"""

from __future__ import annotations

import re
import json
import logging
from datetime import datetime
from typing import Optional

from playwright.sync_api import sync_playwright

from db import get_or_create_venue, insert_event, find_event_by_hash
from dedupe import generate_content_hash
from utils import extract_images_from_page, extract_event_links, find_event_url

logger = logging.getLogger(__name__)

BASE_URL = "https://www.rockler.com"
EVENTS_URL = "https://www.eventbrite.com/cc/sandy-springs-ga-2306939"

VENUE_DATA = {
    "name": "Rockler Woodworking - Sandy Springs",
    "slug": "rockler-woodworking",
    "address": "6690 Roswell Road Suite 450",
    "neighborhood": "Sandy Springs",
    "city": "Sandy Springs",
    "state": "GA",
    "zip": "30328",
    "lat": 33.9236,
    "lng": -84.3558,
    "venue_type": "retail",
    "spot_type": "makerspace",
    "website": BASE_URL,
}


def parse_eventbrite_datetime(timestamp: int) -> tuple[str, str]:
    """Parse Eventbrite timestamp to date and time."""
    dt = datetime.fromtimestamp(timestamp)
    return dt.strftime("%Y-%m-%d"), dt.strftime("%H:%M")


def parse_price(price_text: str) -> tuple[Optional[float], bool]:
    """Parse price from 'From $0.00' or '$25.00' format."""
    if not price_text:
        return None, True

    # Check if free
    if "free" in price_text.lower() or "$0" in price_text:
        return 0.0, True

    # Extract price
    match = re.search(r"\$?([\d,]+\.?\d*)", price_text)
    if match:
        price = float(match.group(1).replace(",", ""))
        return price, price == 0

    return None, False


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Rockler Woodworking classes using Playwright."""
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

            logger.info(f"Fetching Rockler Woodworking classes: {EVENTS_URL}")
            page.goto(EVENTS_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(3000)

            # Try to extract structured JSON from window.__SERVER_DATA__
            server_data = None
            try:
                server_data = page.evaluate("() => window.__SERVER_DATA__")
            except Exception as e:
                logger.warning(f"Could not extract __SERVER_DATA__: {e}")

            events_list = []

            if server_data:
                # Parse structured data
                try:
                    # Eventbrite structure varies, look for events in common locations
                    if isinstance(server_data, dict):
                        # Common paths: events, collection_events, items
                        for key in ["events", "collection_events", "items", "results"]:
                            if key in server_data and isinstance(server_data[key], list):
                                events_list = server_data[key]
                                break

                        # Try nested structures
                        if not events_list and "data" in server_data:
                            data = server_data["data"]
                            if isinstance(data, dict):
                                for key in ["events", "collection_events", "items", "results"]:
                                    if key in data and isinstance(data[key], list):
                                        events_list = data[key]
                                        break

                    logger.info(f"Found {len(events_list)} events in structured data")
                except Exception as e:
                    logger.warning(f"Error parsing structured data: {e}")

            # Fall back to text parsing if no structured data
            if not events_list:
                logger.info("No structured data found, falling back to text parsing")
                # Extract images from page
                image_map = extract_images_from_page(page)

                # Extract event links for specific URLs
                event_links = extract_event_links(page, BASE_URL)

                # Scroll to load all content
                for _ in range(3):
                    page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                    page.wait_for_timeout(1000)

                # Get page text and parse line by line
                body_text = page.inner_text("body")
                lines = [l.strip() for l in body_text.split("\n") if l.strip()]

                # Parse events - look for Eventbrite date patterns like "Wed, Dec 4 • 1:00 PM"
                i = 0
                while i < len(lines):
                    line = lines[i]

                    # Look for Eventbrite date pattern
                    date_match = re.match(
                        r"(Mon|Tue|Wed|Thu|Fri|Sat|Sun),?\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})\s*[•·]\s*(\d{1,2}):(\d{2})\s*(AM|PM)",
                        line,
                        re.IGNORECASE
                    )

                    if date_match:
                        month = date_match.group(2)
                        day = date_match.group(3)
                        hour = int(date_match.group(4))
                        minute = date_match.group(5)
                        period = date_match.group(6)

                        # Convert to 24-hour time
                        if period.upper() == "PM" and hour != 12:
                            hour += 12
                        elif period.upper() == "AM" and hour == 12:
                            hour = 0
                        start_time = f"{hour:02d}:{minute}"

                        # Look for title in surrounding lines
                        title = None
                        price_text = None

                        for offset in [-2, -1, 1, 2, 3]:
                            idx = i + offset
                            if 0 <= idx < len(lines):
                                check_line = lines[idx]

                                # Skip date/time lines
                                if re.match(r"(Mon|Tue|Wed|Thu|Fri|Sat|Sun)", check_line, re.IGNORECASE):
                                    continue

                                # Look for price
                                if re.match(r"(from|price)?\s*\$", check_line, re.IGNORECASE):
                                    price_text = check_line
                                    continue

                                # Look for title
                                if not title and len(check_line) > 5:
                                    if not re.match(r"(register|tickets|view|save)", check_line.lower()):
                                        title = check_line
                                        break

                        if not title:
                            i += 1
                            continue

                        # Parse date
                        try:
                            year = datetime.now().year
                            dt = datetime.strptime(f"{month} {day} {year}", "%b %d %Y")
                            if dt.date() < datetime.now().date():
                                dt = datetime.strptime(f"{month} {day} {year + 1}", "%b %d %Y")
                            start_date = dt.strftime("%Y-%m-%d")
                        except ValueError:
                            i += 1
                            continue

                        events_found += 1

                        # Parse price
                        price_min, is_free = parse_price(price_text) if price_text else (None, False)

                        content_hash = generate_content_hash(title, VENUE_DATA["name"], start_date)

                        if find_event_by_hash(content_hash):
                            events_updated += 1
                            i += 1
                            continue

                        # Get specific event URL


                        event_url = find_event_url(title, event_links, EVENTS_URL)



                        event_record = {
                            "source_id": source_id,
                            "venue_id": venue_id,
                            "title": title,
                            "description": f"Woodworking class at {VENUE_DATA['name']}",
                            "start_date": start_date,
                            "start_time": start_time,
                            "end_date": None,
                            "end_time": None,
                            "is_all_day": False,
                            "category": "learning",
                            "subcategory": "learning.workshop",
                            "tags": ["woodworking", "workshop", "hands-on", "diy", "crafts"],
                            "price_min": price_min,
                            "price_max": None,
                            "price_note": price_text if price_text else None,
                            "is_free": is_free,
                            "source_url": event_url,
                            "ticket_url": event_url,
                            "image_url": image_map.get(title),
                            "raw_text": f"{title} - {start_date}",
                            "extraction_confidence": 0.75,
                            "is_recurring": False,
                            "recurrence_rule": None,
                            "content_hash": content_hash,
                            "is_class": True,
                            "class_category": "woodworking",
                        }

                        try:
                            insert_event(event_record)
                            events_new += 1
                            logger.info(f"Added: {title} on {start_date}")
                        except Exception as e:
                            logger.error(f"Failed to insert: {title}: {e}")

                    i += 1

            else:
                # Process structured data from __SERVER_DATA__
                for event in events_list:
                    try:
                        # Extract fields from Eventbrite event object
                        event_id = event.get("id")
                        title = event.get("name") or event.get("title")

                        if not title:
                            continue

                        # Parse start/end timestamps
                        start_timestamp = event.get("start", {})
                        if isinstance(start_timestamp, dict):
                            start_timestamp = start_timestamp.get("utc") or start_timestamp.get("local")

                        if not start_timestamp:
                            continue

                        # Convert timestamp (could be seconds or milliseconds)
                        if start_timestamp > 10000000000:  # Milliseconds
                            start_timestamp = start_timestamp / 1000

                        start_date, start_time = parse_eventbrite_datetime(int(start_timestamp))

                        # Parse end time if available
                        end_date, end_time = None, None
                        end_timestamp = event.get("end", {})
                        if isinstance(end_timestamp, dict):
                            end_timestamp = end_timestamp.get("utc") or end_timestamp.get("local")
                        if end_timestamp:
                            if end_timestamp > 10000000000:
                                end_timestamp = end_timestamp / 1000
                            end_date, end_time = parse_eventbrite_datetime(int(end_timestamp))

                        # Extract description
                        description = event.get("description") or event.get("summary") or f"Woodworking class at {VENUE_DATA['name']}"

                        # Extract image
                        image_url = None
                        if "logo" in event and isinstance(event["logo"], dict):
                            image_url = event["logo"].get("url")
                        elif "image" in event and isinstance(event["image"], dict):
                            image_url = event["image"].get("url")

                        # Extract price
                        price_min, is_free = None, False
                        if "ticket_availability" in event:
                            ticket = event["ticket_availability"]
                            if isinstance(ticket, dict):
                                is_free = ticket.get("is_free", False)
                                if not is_free and "minimum_ticket_price" in ticket:
                                    price_data = ticket["minimum_ticket_price"]
                                    if isinstance(price_data, dict):
                                        price_min = float(price_data.get("value", 0)) / 100

                        events_found += 1

                        content_hash = generate_content_hash(title, VENUE_DATA["name"], start_date)

                        if find_event_by_hash(content_hash):
                            events_updated += 1
                            continue

                        # Get specific event URL


                        event_url = find_event_url(title, event_links, EVENTS_URL)



                        event_record = {
                            "source_id": source_id,
                            "venue_id": venue_id,
                            "title": title,
                            "description": description,
                            "start_date": start_date,
                            "start_time": start_time,
                            "end_date": end_date,
                            "end_time": end_time,
                            "is_all_day": False,
                            "category": "learning",
                            "subcategory": "learning.workshop",
                            "tags": ["woodworking", "workshop", "hands-on", "diy", "crafts"],
                            "price_min": price_min,
                            "price_max": None,
                            "price_note": None,
                            "is_free": is_free,
                            "source_url": event_url,
                            "ticket_url": f"https://www.eventbrite.com/e/{event_id}" if event_id else EVENTS_URL,
                            "image_url": image_url,
                            "raw_text": json.dumps(event),
                            "extraction_confidence": 0.90,
                            "is_recurring": False,
                            "recurrence_rule": None,
                            "content_hash": content_hash,
                            "is_class": True,
                            "class_category": "woodworking",
                        }

                        try:
                            insert_event(event_record)
                            events_new += 1
                            logger.info(f"Added: {title} on {start_date}")
                        except Exception as e:
                            logger.error(f"Failed to insert: {title}: {e}")

                    except Exception as e:
                        logger.error(f"Error processing event: {e}")
                        continue

            browser.close()

        logger.info(
            f"Rockler Woodworking crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Rockler Woodworking: {e}")
        raise

    return events_found, events_new, events_updated
