"""
Crawler for Central Rock Gym Atlanta (formerly Stone Summit) climbing classes.

Stone Summit was acquired by Central Rock Gym. The site is WordPress-based
with Genesis theme and requires JavaScript rendering.

Crawls climbing, fitness, and yoga classes from the Kennesaw/Atlanta location.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime, timedelta
from typing import Optional

from playwright.sync_api import sync_playwright

from db import get_or_create_venue, insert_event, find_event_by_hash
from dedupe import generate_content_hash
from utils import extract_images_from_page

logger = logging.getLogger(__name__)

BASE_URL = "https://centralrockgym.com"
LOCATION_URL = f"{BASE_URL}/kennesaw/"

VENUE_DATA = {
    "name": "Central Rock Gym Atlanta",
    "slug": "stone-summit",
    "address": "3701 Presidential Pkwy",
    "neighborhood": "South Atlanta",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30340",
    "lat": 33.8898,
    "lng": -84.2571,
    "venue_type": "gym",
    "spot_type": "climbing_gym",
    "website": BASE_URL,
}


def parse_time(time_text: str) -> Optional[str]:
    """Parse time from '7:00 PM' format."""
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


def parse_date(date_text: str) -> Optional[str]:
    """Parse date from various formats."""
    # Try "Monday, January 20" or "January 20"
    match = re.match(
        r"(?:(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s+)?"
        r"(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+"
        r"(\d{1,2})(?:,?\s+(\d{4}))?",
        date_text,
        re.IGNORECASE
    )
    if match:
        month = match.group(1)
        day = match.group(2)
        year = match.group(3) if match.group(3) else str(datetime.now().year)

        try:
            # Handle abbreviated month names
            month_str = month[:3] if len(month) > 3 else month
            dt = datetime.strptime(f"{month_str} {day} {year}", "%b %d %Y")

            # If date is in the past, assume next year
            if dt.date() < datetime.now().date():
                dt = datetime.strptime(f"{month_str} {day} {int(year) + 1}", "%b %d %Y")

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

    return None


def get_class_category(class_name: str) -> dict:
    """Determine category based on class name."""
    name_lower = class_name.lower()

    # Yoga classes
    if any(word in name_lower for word in ["yoga", "vinyasa", "hatha", "restorative"]):
        return {
            "category": "fitness",
            "subcategory": "yoga",
            "class_category": "yoga",
            "tags": ["yoga", "stretching", "mindfulness"]
        }

    # Climbing technique/instruction
    if any(word in name_lower for word in ["climbing", "technique", "lead", "belay", "anchor", "rope"]):
        return {
            "category": "fitness",
            "subcategory": "climbing",
            "class_category": "climbing",
            "tags": ["climbing", "rock-climbing", "instruction", "technique"]
        }

    # Bouldering
    if "boulder" in name_lower:
        return {
            "category": "fitness",
            "subcategory": "climbing",
            "class_category": "climbing",
            "tags": ["bouldering", "climbing", "rock-climbing"]
        }

    # Fitness/training classes
    if any(word in name_lower for word in ["fitness", "training", "strength", "conditioning", "hiit", "cardio"]):
        return {
            "category": "fitness",
            "subcategory": "fitness.class",
            "class_category": "fitness",
            "tags": ["fitness", "strength", "training"]
        }

    # Default climbing/fitness
    return {
        "category": "fitness",
        "subcategory": "fitness.class",
        "class_category": "fitness",
        "tags": ["climbing", "fitness"]
    }


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Central Rock Gym Atlanta classes using Playwright."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    # URLs to try for class schedules
    class_urls = [
        f"{LOCATION_URL}classes/",
        f"{LOCATION_URL}programs/",
        f"{BASE_URL}/classes/",
        f"{BASE_URL}/programs/",
        LOCATION_URL,
    ]

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
                viewport={"width": 1920, "height": 1080},
            )
            page = context.new_page()

            venue_id = get_or_create_venue(VENUE_DATA)

            # Try each URL until we find class information
            body_text = ""
            successful_url = None

            for url in class_urls:
                try:
                    logger.info(f"Trying Central Rock Gym URL: {url}")
                    page.goto(url, wait_until="domcontentloaded", timeout=30000)
                    page.wait_for_timeout(3000)

                    # Scroll to load content
                    for _ in range(3):
                        page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                        page.wait_for_timeout(1000)

                    # Check if page has class-related content
                    text = page.inner_text("body")
                    if any(keyword in text.lower() for keyword in ["class", "program", "yoga", "climbing", "belay", "instruction"]):
                        body_text = text
                        successful_url = url
                        logger.info(f"Found class content at: {url}")
                        break

                except Exception as e:
                    logger.debug(f"Failed to load {url}: {e}")
                    continue

            if not body_text:
                logger.warning("Could not find class schedule page")
                browser.close()
                return events_found, events_new, events_updated

            # Extract images from page
            image_map = extract_images_from_page(page)

            # Parse body text for class listings
            lines = [l.strip() for l in body_text.split("\n") if l.strip()]

            # Look for class patterns
            i = 0
            while i < len(lines):
                line = lines[i]

                # Skip navigation and short lines
                if len(line) < 3:
                    i += 1
                    continue

                # Skip common navigation elements
                skip_words = [
                    "menu", "navigation", "login", "register", "about", "contact",
                    "home", "locations", "membership", "rates", "shop", "cart"
                ]
                if any(skip in line.lower() for skip in skip_words) and len(line) < 20:
                    i += 1
                    continue

                # Look for date patterns
                date_match = re.search(
                    r"(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s*"
                    r"(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+"
                    r"\d{1,2}",
                    line,
                    re.IGNORECASE
                )

                if date_match:
                    start_date = parse_date(line)
                    if not start_date:
                        i += 1
                        continue

                    # Look for title and time in surrounding lines
                    title = None
                    start_time = None
                    description = None

                    for offset in range(-3, 4):
                        idx = i + offset
                        if 0 <= idx < len(lines):
                            check_line = lines[idx]

                            # Skip if it's another date
                            if re.search(r"(January|February|March|April|May|June|July|August|September|October|November|December)", check_line, re.IGNORECASE) and offset != 0:
                                continue

                            # Look for time
                            if not start_time:
                                time_result = parse_time(check_line)
                                if time_result:
                                    start_time = time_result

                            # Look for title (substantial line that's not a date or time)
                            if not title and len(check_line) > 10 and offset != 0:
                                # Avoid UI elements and common words
                                if not re.match(r"(\d{1,2}[:/]|free|register|sign up|learn more|view)", check_line, re.IGNORECASE):
                                    # Check if it looks like a class name
                                    if any(word in check_line.lower() for word in ["yoga", "climbing", "belay", "class", "technique", "boulder", "fitness", "training"]):
                                        title = check_line
                                        # Look for description nearby
                                        if idx + 1 < len(lines) and len(lines[idx + 1]) > 30:
                                            description = lines[idx + 1][:500]

                    if title and start_date:
                        events_found += 1

                        # Generate content hash for deduplication
                        content_hash = generate_content_hash(title, VENUE_DATA["name"], start_date)

                        if find_event_by_hash(content_hash):
                            events_updated += 1
                            i += 1
                            continue

                        # Get category info
                        cat_info = get_class_category(title)

                        # Build tags
                        base_tags = [
                            "climbing",
                            "bouldering",
                            "fitness",
                            "class",
                            "rock-climbing"
                        ]
                        all_tags = list(set(base_tags + cat_info["tags"]))

                        event_description = description or f"{title} at Central Rock Gym Atlanta"
                        image_url = image_map.get(title)

                        event_record = {
                            "source_id": source_id,
                            "venue_id": venue_id,
                            "title": title,
                            "description": event_description,
                            "start_date": start_date,
                            "start_time": start_time,
                            "end_date": None,
                            "end_time": None,
                            "is_all_day": False,
                            "category": cat_info["category"],
                            "subcategory": cat_info["subcategory"],
                            "tags": all_tags,
                            "price_min": None,
                            "price_max": None,
                            "price_note": None,
                            "is_free": False,
                            "source_url": successful_url or LOCATION_URL,
                            "ticket_url": successful_url or LOCATION_URL,
                            "image_url": image_url,
                            "raw_text": f"{title} - {start_date}",
                            "extraction_confidence": 0.75,
                            "is_recurring": False,
                            "recurrence_rule": None,
                            "content_hash": content_hash,
                            "is_class": True,
                            "class_category": cat_info["class_category"],
                        }

                        # Build series hint for class enrichment
                        series_hint = {
                            "series_type": "class_series",
                            "series_title": title,
                        }
                        if event_description:
                            series_hint["description"] = event_description
                        if image_url:
                            series_hint["image_url"] = image_url

                        try:
                            insert_event(event_record, series_hint=series_hint)
                            events_new += 1
                            logger.info(f"Added: {title} on {start_date}")
                        except Exception as e:
                            logger.error(f"Failed to insert: {title}: {e}")

                i += 1

            browser.close()

        logger.info(
            f"Central Rock Gym Atlanta crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Central Rock Gym Atlanta: {e}")
        raise

    return events_found, events_new, events_updated
