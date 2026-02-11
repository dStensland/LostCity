"""
Crawler for Atlanta BeltLine Fitness program.

SOURCE: beltline.org/things-to-do/fitness/
PURPOSE: Free weekly fitness classes along the BeltLine trail (yoga, Zumba, HIIT, bootcamp, run club).

These are PUBLIC recurring fitness events during the active season (roughly April-October).
We generate events for the next 4 weeks based on the weekly schedule.

SEPARATE from the main beltline.py crawler which hits /events.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime, timedelta
from typing import Optional

from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout

from db import get_or_create_venue, insert_event, find_event_by_hash
from dedupe import generate_content_hash
from utils import extract_images_from_page

logger = logging.getLogger(__name__)

BASE_URL = "https://beltline.org"
FITNESS_URL = f"{BASE_URL}/things-to-do/fitness/"
RUN_CLUB_URL = f"{BASE_URL}/things-to-do/fitness/run-club/"

BELTLINE_VENUE = {
    "name": "Atlanta BeltLine",
    "slug": "atlanta-beltline",
    "address": "112 Krog Street NE",
    "neighborhood": "Inman Park",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30307",
    "lat": 33.7665,
    "lng": -84.3625,
    "venue_type": "park",
    "spot_type": "park",
    "website": BASE_URL,
    "vibes": ["outdoor", "active", "scenic"],
}

DAYS_OF_WEEK = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]

# Class category mappings
CLASS_CATEGORIES = {
    "yoga": {"subcategory": "yoga", "tags": ["yoga", "stretching", "mindfulness"]},
    "pilates": {"subcategory": "pilates", "tags": ["pilates", "core", "strength"]},
    "zumba": {"subcategory": "dance", "tags": ["zumba", "dance", "cardio"]},
    "hiit": {"subcategory": "hiit", "tags": ["hiit", "cardio", "strength"]},
    "bootcamp": {"subcategory": "bootcamp", "tags": ["bootcamp", "strength", "cardio"]},
    "boot camp": {"subcategory": "bootcamp", "tags": ["bootcamp", "strength", "cardio"]},
    "barre": {"subcategory": "barre", "tags": ["barre", "ballet", "strength"]},
    "run": {"subcategory": "running", "tags": ["running", "cardio", "social"]},
    "running": {"subcategory": "running", "tags": ["running", "cardio", "social"]},
    "hike": {"subcategory": "hiking", "tags": ["hiking", "outdoor", "nature"]},
    "walk": {"subcategory": "walking", "tags": ["walking", "outdoor", "social"]},
    "soccer": {"subcategory": "soccer", "tags": ["soccer", "sports", "team"]},
    "strength": {"subcategory": "strength", "tags": ["strength", "weights"]},
}


def get_class_category(class_name: str) -> dict:
    """Determine subcategory and tags based on class name."""
    name_lower = class_name.lower()

    for keyword, cat_info in CLASS_CATEGORIES.items():
        if keyword in name_lower:
            return cat_info

    # Default fitness class
    return {"subcategory": "class", "tags": ["group-class"]}


def parse_time(time_text: str) -> Optional[str]:
    """Parse time to HH:MM format."""
    try:
        match = re.search(r"(\d{1,2}):?(\d{2})?\s*(am|pm)", time_text, re.IGNORECASE)
        if match:
            hour, minute, period = match.groups()
            hour = int(hour)
            minute = minute or "00"
            if period.lower() == "pm" and hour != 12:
                hour += 12
            elif period.lower() == "am" and hour == 12:
                hour = 0
            return f"{hour:02d}:{minute}"
        return None
    except Exception:
        return None


def get_next_weekday(weekday_name: str, weeks_ahead: int = 0) -> datetime:
    """Get the next occurrence of a weekday from today, optionally N weeks ahead."""
    weekday_name = weekday_name.lower()
    if weekday_name not in DAYS_OF_WEEK:
        return datetime.now()

    target_weekday = DAYS_OF_WEEK.index(weekday_name)
    today = datetime.now()
    days_ahead = target_weekday - today.weekday()

    if days_ahead < 0:  # Target day already passed this week
        days_ahead += 7

    # Add weeks offset
    days_ahead += weeks_ahead * 7

    return today + timedelta(days=days_ahead)


def parse_event_cards(text: str, venue_id: int, source_id: int, image_map: dict) -> list[dict]:
    """
    Parse event cards from the BeltLine page.

    Format:
    FEB
    12
    FITNESS AND WELLNESS
    Atlanta Beltline Thursday Run Club
    6:15PM-8:15PM
    IN-PERSON
    NEW REALM BREWING CO.
    """
    events = []
    lines = [line.strip() for line in text.split("\n") if line.strip()]

    i = 0
    while i < len(lines):
        line = lines[i]

        # Look for month abbreviation (event card start)
        month_match = re.match(r"^(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)$", line, re.IGNORECASE)
        if month_match and i + 1 < len(lines):
            # Next line should be day
            try:
                day = int(lines[i + 1])
                if day < 1 or day > 31:
                    i += 1
                    continue
            except ValueError:
                i += 1
                continue

            # Parse date
            month_abbr = month_match.group(1).upper()
            current_year = datetime.now().year
            try:
                month_num = datetime.strptime(month_abbr, "%b").month
                event_date = datetime(current_year, month_num, day)
                # If date is in the past, assume next year
                if event_date < datetime.now() - timedelta(days=7):
                    event_date = datetime(current_year + 1, month_num, day)
                start_date = event_date.strftime("%Y-%m-%d")
            except (ValueError, TypeError):
                i += 1
                continue

            # Look ahead for event details
            # Format is: MONTH, DAY, CATEGORY, TITLE, TIME, IN-PERSON, LOCATION
            event_title = None
            time_range = None
            location = None

            # Look for category label (should be at i+2)
            if i + 2 < len(lines) and lines[i + 2].upper() in ["FITNESS AND WELLNESS", "FITNESS", "WELLNESS", "COMMUNITY"]:
                # Title should be at i+3
                if i + 3 < len(lines):
                    event_title = lines[i + 3]

                # Time should be at i+4
                if i + 4 < len(lines):
                    check_time = lines[i + 4]
                    if re.match(r"\d{1,2}:\d{2}[AP]M-\d{1,2}:\d{2}[AP]M", check_time, re.IGNORECASE):
                        time_range = check_time

                # IN-PERSON might be at i+5, location at i+6
                if i + 5 < len(lines) and lines[i + 5].upper() == "IN-PERSON":
                    if i + 6 < len(lines):
                        potential_location = lines[i + 6]
                        # Check if it's a location (all caps, not a month)
                        if potential_location.isupper() and not re.match(r"^(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)$", potential_location):
                            location = potential_location.title()

            # If we found an event with title and time
            if event_title and time_range:
                # Parse start time from time range
                start_time_str = time_range.split("-")[0]
                start_time = parse_time(start_time_str)

                if not start_time:
                    i += 1
                    continue

                # Build description
                description = f"Free weekly fitness program along the Atlanta BeltLine."
                if location:
                    description += f" Meets at {location}."
                description += " All levels welcome. No registration required."

                cat_info = get_class_category(event_title)
                base_tags = ["beltline", "outdoor", "free", "all-ages", "beginner-friendly"]

                # Determine day of week from date
                day_of_week = event_date.strftime("%A")

                # Build series_hint for recurring classes
                series_hint = {
                    "series_type": "class_series",
                    "series_title": event_title,
                    "frequency": "weekly",
                    "day_of_week": day_of_week,
                    "description": description,
                }

                image_url = image_map.get(event_title)

                event_record = {
                    "source_id": source_id,
                    "venue_id": venue_id,
                    "title": event_title,
                    "description": description,
                    "start_date": start_date,
                    "start_time": start_time,
                    "end_date": None,
                    "end_time": None,
                    "is_all_day": False,
                    "category": "fitness",
                    "subcategory": cat_info["subcategory"],
                    "tags": list(set(base_tags + cat_info["tags"])),
                    "price_min": 0,
                    "price_max": 0,
                    "price_note": "Free",
                    "is_free": True,
                    "source_url": FITNESS_URL,
                    "ticket_url": None,
                    "image_url": image_url,
                    "raw_text": f"{event_title} - {time_range}",
                    "extraction_confidence": 0.85,
                    "is_recurring": True,
                    "recurrence_rule": f"FREQ=WEEKLY;BYDAY={day_of_week[:2].upper()}",
                    "content_hash": generate_content_hash(
                        event_title, "Atlanta BeltLine", start_date
                    ),
                    "series_hint": series_hint,
                }

                events.append(event_record)

        i += 1

    return events


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl Atlanta BeltLine Fitness program.
    """
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

            logger.info(f"Fetching BeltLine Fitness page: {FITNESS_URL}")
            page.goto(FITNESS_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(5000)

            # Extract images from page
            image_map = extract_images_from_page(page)

            # Scroll to load content
            for _ in range(3):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1000)

            # Get venue ID
            venue_id = get_or_create_venue(BELTLINE_VENUE)

            # Extract page text
            body_text = page.inner_text("body")

            # Parse event cards
            event_records = parse_event_cards(body_text, venue_id, source_id, image_map)

            logger.info(f"Found {len(event_records)} fitness events")

            for event_record in event_records:
                events_found += 1

                # Check for existing
                existing = find_event_by_hash(event_record["content_hash"])
                if existing:
                    events_updated += 1
                    continue

                try:
                    series_hint = event_record.pop("series_hint", None)
                    insert_event(event_record, series_hint=series_hint)
                    events_new += 1
                    logger.info(
                        f"Added: {event_record['title']} on {event_record['start_date']}"
                    )
                except Exception as e:
                    logger.error(f"Failed to insert: {event_record['title']}: {e}")

            # Also check run club page
            logger.info(f"Fetching BeltLine Run Club page: {RUN_CLUB_URL}")
            page.goto(RUN_CLUB_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(5000)

            # Scroll to load content
            for _ in range(2):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1000)

            run_club_text = page.inner_text("body")
            run_club_events = parse_event_cards(run_club_text, venue_id, source_id, image_map)

            logger.info(f"Found {len(run_club_events)} run club events")

            for event_record in run_club_events:
                events_found += 1

                # Check for existing
                existing = find_event_by_hash(event_record["content_hash"])
                if existing:
                    events_updated += 1
                    continue

                try:
                    series_hint = event_record.pop("series_hint", None)
                    insert_event(event_record, series_hint=series_hint)
                    events_new += 1
                    logger.info(
                        f"Added: {event_record['title']} on {event_record['start_date']}"
                    )
                except Exception as e:
                    logger.error(f"Failed to insert: {event_record['title']}: {e}")

            browser.close()

        logger.info(
            f"BeltLine Fitness crawl complete: {events_found} found, {events_new} new"
        )

    except PlaywrightTimeout as e:
        logger.error(f"Timeout fetching BeltLine Fitness: {e}")
        raise
    except Exception as e:
        logger.error(f"Failed to crawl BeltLine Fitness: {e}")
        raise

    return events_found, events_new, events_updated
