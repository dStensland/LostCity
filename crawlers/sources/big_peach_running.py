"""
Crawler for Big Peach Running Co.
Running store with free group runs and events at multiple Atlanta-area locations.

Known recurring events:
- Safety Ride Midtown - Mondays 6pm
- Group Ride Brookhaven - Wednesdays 6pm
- Group Run Cumming - Thursdays 7pm
- Group Run/Walk South Fulton - Saturdays 8am & Wednesdays 6pm
"""

from __future__ import annotations

import re
import logging
from datetime import datetime, timedelta
from typing import Optional

from playwright.sync_api import sync_playwright

from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash
from utils import extract_images_from_page, extract_event_links, find_event_url

logger = logging.getLogger(__name__)

BASE_URL = "https://www.bigpeachrunningco.com"
EVENTS_URL = f"{BASE_URL}/events"

# Main Midtown location
VENUE_DATA = {
    "name": "Big Peach Running Co - Midtown",
    "slug": "big-peach-running-midtown",
    "address": "1071 Piedmont Ave NE",
    "neighborhood": "Midtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30309",
    "venue_type": "retail",
    "website": BASE_URL,
}

# Recurring events with location, day, time
RECURRING_EVENTS = [
    {
        "title": "Safety Ride - Midtown",
        "weekday": 0,  # Monday
        "time": "18:00",
        "description": "Weekly group safety ride from Big Peach Running Co Midtown. Free and open to all abilities.",
        "category": "fitness",
        "subcategory": "cycling",
        "tags": ["cycling", "group-ride", "midtown", "free"],
        "location": "Midtown"
    },
    {
        "title": "Group Ride - Brookhaven",
        "weekday": 2,  # Wednesday
        "time": "18:00",
        "description": "Weekly group ride from Big Peach Running Co Brookhaven. Free and open to all abilities.",
        "category": "fitness",
        "subcategory": "cycling",
        "tags": ["cycling", "group-ride", "brookhaven", "free"],
        "location": "Brookhaven"
    },
    {
        "title": "Group Run - Decatur",
        "weekday": 1,  # Tuesday
        "time": "18:30",
        "description": "Weekly group run from Big Peach Running Co Decatur. Free and open to runners and walkers of all abilities.",
        "category": "fitness",
        "subcategory": "running",
        "tags": ["running", "group-run", "decatur", "free"],
        "location": "Decatur"
    },
    {
        "title": "Group Run/Walk - Decatur",
        "weekday": 5,  # Saturday
        "time": "08:00",
        "description": "Saturday morning group run/walk from Big Peach Running Co Decatur. Free and open to all abilities.",
        "category": "fitness",
        "subcategory": "running",
        "tags": ["running", "walking", "group-run", "decatur", "free", "morning"],
        "location": "Decatur"
    },
]


def parse_date_time(text: str) -> Optional[tuple[datetime, str]]:
    """Parse date/time patterns like '2/17/26 6:30 pm' or 'Feb 17, 2026 at 6:30pm'."""
    # Pattern: M/D/YY H:MM am/pm
    match = re.search(r"(\d{1,2})/(\d{1,2})/(\d{2,4})\s+(\d{1,2}):(\d{2})\s*(am|pm)", text, re.IGNORECASE)
    if match:
        month = int(match.group(1))
        day = int(match.group(2))
        year = int(match.group(3))
        if year < 100:
            year += 2000
        hour = int(match.group(4))
        minute = int(match.group(5))
        period = match.group(6).lower()

        if period == "pm" and hour != 12:
            hour += 12
        elif period == "am" and hour == 12:
            hour = 0

        try:
            dt = datetime(year, month, day)
            time_str = f"{hour:02d}:{minute:02d}"
            return (dt, time_str)
        except ValueError:
            pass
    return None


def crawl(source: dict) -> tuple[int, int, int]:
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

            logger.info(f"Fetching Big Peach Running Co: {EVENTS_URL}")
            page.goto(EVENTS_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(3000)

            # Extract images from page
            image_map = extract_images_from_page(page)

            # Extract event links for specific URLs
            event_links = extract_event_links(page, BASE_URL)

            # Scroll to load content
            for _ in range(5):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1000)

            body_text = page.inner_text("body")

            # Generate recurring events for next 3 months
            current_date = datetime.now()
            end_date = current_date + timedelta(days=90)

            for event_info in RECURRING_EVENTS:
                weekday = event_info["weekday"]
                title = event_info["title"]
                time = event_info["time"]
                description = event_info["description"]

                # Find the next occurrence of this weekday
                current = current_date
                while current.weekday() != weekday:
                    current += timedelta(days=1)

                # Generate all occurrences
                while current <= end_date:
                    events_found += 1
                    start_date_str = current.strftime("%Y-%m-%d")

                    content_hash = generate_content_hash(title, "Big Peach Running Co", start_date_str)

                    if find_event_by_hash(content_hash):
                        events_updated += 1
                        current += timedelta(days=7)
                        continue

                    # Get specific event URL


                    event_url = find_event_url(title, event_links, EVENTS_URL)



                    image_url = image_map.get(title)

                    event_record = {
                        "source_id": source_id,
                        "venue_id": venue_id,
                        "title": title,
                        "description": description,
                        "start_date": start_date_str,
                        "start_time": time,
                        "end_date": None,
                        "end_time": None,
                        "is_all_day": False,
                        "category": event_info["category"],
                        "subcategory": event_info["subcategory"],
                        "tags": event_info["tags"],
                        "price_min": None,
                        "price_max": None,
                        "price_note": None,
                        "is_free": True,
                        "source_url": event_url,
                        "ticket_url": event_url if event_url != (EVENTS_URL if "EVENTS_URL" in dir() else BASE_URL) else None,
                        "image_url": image_url,
                        "raw_text": f"{title} at Big Peach Running Co - {start_date_str}",
                        "extraction_confidence": 0.90,
                        "is_recurring": True,
                        "recurrence_rule": f"FREQ=WEEKLY;BYDAY={['MO','TU','WE','TH','FR','SA','SU'][weekday]}",
                        "content_hash": content_hash,
                    }

                    day_names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
                    series_hint = {
                        "series_type": "recurring_show",
                        "series_title": title,
                        "frequency": "weekly",
                        "day_of_week": day_names[weekday],
                        "description": description,
                    }
                    if image_url:
                        series_hint["image_url"] = image_url

                    try:
                        insert_event(event_record, series_hint=series_hint)
                        events_new += 1
                        logger.info(f"Added: {title} on {start_date_str}")
                    except Exception as e:
                        logger.error(f"Failed to insert: {title}: {e}")

                    current += timedelta(days=7)

            # Also try to parse one-off events from the page
            lines = [l.strip() for l in body_text.split('\n') if l.strip()]

            for i, line in enumerate(lines):
                # Look for specific dated events like demos
                if "DEMO" in line.upper() or "CLINIC" in line.upper():
                    # Check nearby lines for date
                    for offset in range(-2, 3):
                        if 0 <= i + offset < len(lines):
                            date_time = parse_date_time(lines[i + offset])
                            if date_time:
                                dt, time_str = date_time

                                # Skip past events
                                if dt.date() < current_date.date():
                                    continue

                                events_found += 1
                                start_date_str = dt.strftime("%Y-%m-%d")
                                title = line

                                content_hash = generate_content_hash(title, "Big Peach Running Co", start_date_str)

                                if find_event_by_hash(content_hash):
                                    events_updated += 1
                                    break

                                # Get specific event URL


                                event_url = find_event_url(title, event_links, EVENTS_URL)



                                event_record = {
                                    "source_id": source_id,
                                    "venue_id": venue_id,
                                    "title": title,
                                    "description": f"{title} at Big Peach Running Co. Free shoe demo/clinic event.",
                                    "start_date": start_date_str,
                                    "start_time": time_str,
                                    "end_date": None,
                                    "end_time": None,
                                    "is_all_day": False,
                                    "category": "fitness",
                                    "subcategory": "running",
                                    "tags": ["running", "demo", "free", "clinic"],
                                    "price_min": None,
                                    "price_max": None,
                                    "price_note": None,
                                    "is_free": True,
                                    "source_url": event_url,
                                    "ticket_url": event_url if event_url != (EVENTS_URL if "EVENTS_URL" in dir() else BASE_URL) else None,
                                    "image_url": image_map.get(title),
                                    "raw_text": f"{title} - {start_date_str}",
                                    "extraction_confidence": 0.80,
                                    "is_recurring": False,
                                    "recurrence_rule": None,
                                    "content_hash": content_hash,
                                }

                                try:
                                    insert_event(event_record)
                                    events_new += 1
                                    logger.info(f"Added special event: {title} on {start_date_str}")
                                except Exception as e:
                                    logger.error(f"Failed to insert: {title}: {e}")
                                break

            browser.close()

        logger.info(f"Big Peach Running Co crawl complete: {events_found} found, {events_new} new, {events_updated} updated")

    except Exception as e:
        logger.error(f"Failed to crawl Big Peach Running Co: {e}")
        raise

    return events_found, events_new, events_updated
