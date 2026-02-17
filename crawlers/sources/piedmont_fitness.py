"""
Crawler for Piedmont Fitness Centers.

Crawls class schedules and events from:
- Piedmont Atlanta Fitness Center (PDF schedules)
- Piedmont Newnan Fitness Center (PDF schedules)
- Piedmont Wellness Center Fayetteville (dynamic calendar)

Classes are recurring - we generate events for the current week.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime, timedelta
from typing import Optional
import requests
from io import BytesIO

try:
    import pdfplumber
    HAS_PDFPLUMBER = True
except ImportError:
    HAS_PDFPLUMBER = False

from playwright.sync_api import sync_playwright

from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event, get_portal_id_by_slug
from dedupe import generate_content_hash
from utils import extract_images_from_page

# Portal ID for Piedmont-exclusive events
PORTAL_SLUG = "piedmont"

logger = logging.getLogger(__name__)

# Venue configurations
VENUES = {
    "atlanta": {
        "name": "Piedmont Atlanta Fitness Center",
        "slug": "piedmont-atlanta-fitness-center",
        "address": "2001 Peachtree Road NE, Suite 100",
        "neighborhood": "Buckhead",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30309",
        "venue_type": "fitness_center",
        "website": "https://www.piedmont.org/locations/fitness-centers/atlanta-fitness-center",
        "schedules": {
            "studio": "https://www.piedmont.org/-/media/files/locations/2025-03-pah-studio-schedule.pdf",
            "pool": "https://www.piedmont.org/-/media/files/locations/2025-03-pah-pool-schedule.pdf",
        },
    },
    "newnan": {
        "name": "Piedmont Newnan Fitness Center",
        "slug": "piedmont-newnan-fitness-center",
        "address": "26 West Court Square",
        "city": "Newnan",
        "state": "GA",
        "zip": "30265",
        "venue_type": "fitness_center",
        "website": "https://www.piedmont.org/locations/fitness-centers/newnan-fitness-center",
        "schedules": {
            "fitness": "https://www.piedmont.org/-/media/files/locations/2025-pnh-online-fitness-calendar.pdf",
        },
    },
    "fayetteville": {
        "name": "Piedmont Wellness Center Fayetteville",
        "slug": "piedmont-wellness-fayetteville",
        "address": "200 Trilith Parkway",
        "city": "Fayetteville",
        "state": "GA",
        "zip": "30214",
        "venue_type": "fitness_center",
        "website": "https://www.piedmontwellnesscenter.com/",
        "calendar_url": "https://www.piedmontwellnesscenter.com/calendar/",
    },
}

# Class category mappings
CLASS_CATEGORIES = {
    "yoga": {"category": "fitness", "subcategory": "yoga", "tags": ["yoga", "stretching", "mindfulness"]},
    "pilates": {"category": "fitness", "subcategory": "pilates", "tags": ["pilates", "core", "strength"]},
    "cycling": {"category": "fitness", "subcategory": "cycling", "tags": ["cycling", "spin", "cardio"]},
    "spin": {"category": "fitness", "subcategory": "cycling", "tags": ["cycling", "spin", "cardio"]},
    "hiit": {"category": "fitness", "subcategory": "hiit", "tags": ["hiit", "cardio", "strength"]},
    "boxing": {"category": "fitness", "subcategory": "boxing", "tags": ["boxing", "cardio", "strength"]},
    "zumba": {"category": "fitness", "subcategory": "dance", "tags": ["zumba", "dance", "cardio"]},
    "aqua": {"category": "fitness", "subcategory": "aquatics", "tags": ["aqua", "pool", "swimming"]},
    "water": {"category": "fitness", "subcategory": "aquatics", "tags": ["aqua", "pool", "swimming"]},
    "swim": {"category": "fitness", "subcategory": "aquatics", "tags": ["swimming", "pool", "lap-swim"]},
    "senior": {"category": "fitness", "subcategory": "senior", "tags": ["senior", "low-impact"]},
    "strength": {"category": "fitness", "subcategory": "strength", "tags": ["strength", "weights"]},
    "circuit": {"category": "fitness", "subcategory": "circuit", "tags": ["circuit", "full-body"]},
    "step": {"category": "fitness", "subcategory": "aerobics", "tags": ["step", "aerobics", "cardio"]},
    "barre": {"category": "fitness", "subcategory": "barre", "tags": ["barre", "ballet", "strength"]},
    "stretch": {"category": "fitness", "subcategory": "stretch", "tags": ["stretching", "flexibility"]},
    "meditation": {"category": "fitness", "subcategory": "meditation", "tags": ["meditation", "mindfulness"]},
}

DAYS_OF_WEEK = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]


def get_class_category(class_name: str) -> dict:
    """Determine category based on class name."""
    name_lower = class_name.lower()

    for keyword, cat_info in CLASS_CATEGORIES.items():
        if keyword in name_lower:
            return cat_info

    # Default fitness class
    return {"category": "fitness", "subcategory": "class", "tags": ["fitness", "group-class"]}


def parse_time(time_str: str) -> Optional[str]:
    """Parse time string to HH:MM format."""
    if not time_str:
        return None

    time_str = time_str.strip().upper()

    # Handle various formats
    patterns = [
        (r"(\d{1,2}):(\d{2})\s*(AM|PM)", None),
        (r"(\d{1,2})\s*(AM|PM)", "0"),  # No minutes
    ]

    for pattern, default_min in patterns:
        match = re.search(pattern, time_str)
        if match:
            groups = match.groups()
            hour = int(groups[0])
            minute = groups[1] if len(groups) > 2 else default_min
            period = groups[-1]

            if period == "PM" and hour != 12:
                hour += 12
            elif period == "AM" and hour == 12:
                hour = 0

            return f"{hour:02d}:{minute}"

    return None


def get_next_weekday(weekday_name: str) -> datetime:
    """Get the next occurrence of a weekday from today."""
    weekday_name = weekday_name.lower()
    if weekday_name not in DAYS_OF_WEEK:
        return datetime.now()

    target_weekday = DAYS_OF_WEEK.index(weekday_name)
    today = datetime.now()
    days_ahead = target_weekday - today.weekday()

    if days_ahead < 0:  # Target day already passed this week
        days_ahead += 7

    return today + timedelta(days=days_ahead)


def crawl_pdf_schedule(pdf_url: str, venue_data: dict, source_id: int, portal_id: Optional[str]) -> tuple[int, int, int]:
    """Crawl a PDF schedule and extract class events."""
    events_found = 0
    events_new = 0
    events_updated = 0

    if not HAS_PDFPLUMBER:
        logger.warning("pdfplumber not installed, skipping PDF parsing")
        return events_found, events_new, events_updated

    try:
        # Download PDF
        response = requests.get(pdf_url, timeout=30)
        response.raise_for_status()

        venue_id = get_or_create_venue(venue_data)

        with pdfplumber.open(BytesIO(response.content)) as pdf:
            for page in pdf.pages:
                text = page.extract_text() or ""
                tables = page.extract_tables() or []

                # Try to extract from tables first
                for table in tables:
                    if not table or len(table) < 2:
                        continue

                    # Assume first row is header with days
                    header = table[0] if table else []

                    for row_idx, row in enumerate(table[1:], 1):
                        if not row:
                            continue

                        for col_idx, cell in enumerate(row):
                            if not cell or len(cell.strip()) < 3:
                                continue

                            # Try to parse class info from cell
                            cell_text = cell.strip()

                            # Look for time pattern
                            time_match = re.search(r"(\d{1,2}(?::\d{2})?\s*(?:AM|PM|am|pm))", cell_text)
                            if not time_match:
                                continue

                            start_time = parse_time(time_match.group(1))
                            if not start_time:
                                continue

                            # Extract class name (text before or after time)
                            class_name = re.sub(r"\d{1,2}(?::\d{2})?\s*(?:AM|PM|am|pm)", "", cell_text).strip()
                            class_name = re.sub(r"^\s*[-–—]\s*", "", class_name).strip()

                            if len(class_name) < 3:
                                continue

                            # Determine day from column header
                            day_name = None
                            if col_idx < len(header) and header[col_idx]:
                                for day in DAYS_OF_WEEK:
                                    if day in header[col_idx].lower():
                                        day_name = day
                                        break

                            if not day_name:
                                continue

                            # Generate event for next occurrence of this day
                            event_date = get_next_weekday(day_name)
                            start_date = event_date.strftime("%Y-%m-%d")

                            events_found += 1

                            content_hash = generate_content_hash(
                                class_name, venue_data["name"], start_date
                            )


                            cat_info = get_class_category(class_name)
                            base_tags = ["piedmont", "fitness", "class", venue_data.get("neighborhood", "").lower()]

                            description = f"Group fitness class at {venue_data['name']}. Drop-in welcome for members."

                            # Build series_hint
                            series_hint = {
                                "series_type": "class_series",
                                "series_title": class_name,
                                "frequency": "weekly",
                                "day_of_week": day_name.capitalize(),
                                "description": description,
                            }

                            event_record = {
                                "source_id": source_id,
                                "venue_id": venue_id,
                                "portal_id": portal_id,
                                "title": class_name,
                                "description": description,
                                "start_date": start_date,
                                "start_time": start_time,
                                "end_date": None,
                                "end_time": None,
                                "is_all_day": False,
                                "category": cat_info["category"],
                                "subcategory": cat_info["subcategory"],
                                "tags": list(set(base_tags + cat_info["tags"])),
                                "price_min": None,
                                "price_max": None,
                                "price_note": "Included with membership",
                                "is_free": False,
                                "source_url": venue_data["website"],
                                "ticket_url": venue_data["website"],
                                "image_url": None,
                                "raw_text": cell_text,
                                "extraction_confidence": 0.75,
                                "is_recurring": True,
                                "recurrence_rule": f"WEEKLY;{day_name.upper()}",
                                "content_hash": content_hash,
                            }

                            existing = find_event_by_hash(content_hash)
                            if existing:
                                smart_update_existing_event(existing, event_record)
                                events_updated += 1
                                continue

                            try:
                                insert_event(event_record, series_hint=series_hint)
                                events_new += 1
                                logger.info(f"Added: {class_name} on {day_name} at {start_time}")
                            except Exception as e:
                                logger.error(f"Failed to insert: {class_name}: {e}")

    except Exception as e:
        logger.error(f"Failed to crawl PDF {pdf_url}: {e}")

    return events_found, events_new, events_updated


def crawl_fayetteville_calendar(venue_data: dict, source_id: int, portal_id: Optional[str]) -> tuple[int, int, int]:
    """Crawl the Fayetteville wellness center dynamic calendar."""
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

            venue_id = get_or_create_venue(venue_data)
            calendar_url = venue_data.get("calendar_url", venue_data["website"])

            logger.info(f"Fetching Fayetteville calendar: {calendar_url}")
            page.goto(calendar_url, wait_until="domcontentloaded", timeout=90000)
            page.wait_for_timeout(8000)

            # Extract images from page
            image_map = extract_images_from_page(page)

            # Accept cookies if prompted
            try:
                page.click("text=Accept", timeout=3000)
            except:
                pass

            # Scroll to load content
            for _ in range(3):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1000)

            # Look for calendar entries
            body_text = page.inner_text("body")
            lines = [line.strip() for line in body_text.split("\n") if line.strip()]

            # Calendar format:
            # "Tuesday, January 20"
            # "5:30am-6:15am"
            # "Class Name"
            # "Location (Turf, Studio, etc)"
            # "Instructor Name"
            # ""
            # "Category (Cardio/Strength, etc)"

            current_date = None
            i = 0

            while i < len(lines):
                line = lines[i]

                # Check for date header like "Tuesday, January 20"
                date_match = re.match(
                    r"(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),\s+"
                    r"(January|February|March|April|May|June|July|August|September|October|November|December)\s+"
                    r"(\d{1,2})",
                    line
                )
                if date_match:
                    month = date_match.group(2)
                    day = date_match.group(3)
                    year = datetime.now().year
                    try:
                        current_date = datetime.strptime(f"{month} {day} {year}", "%B %d %Y")
                        # If date is in the past, assume next year
                        if current_date < datetime.now() - timedelta(days=7):
                            current_date = datetime.strptime(f"{month} {day} {year + 1}", "%B %d %Y")
                    except ValueError:
                        pass
                    i += 1
                    continue

                # Check for time range pattern like "5:30am-6:15am"
                time_match = re.match(r"(\d{1,2}:\d{2}(?:am|pm))-(\d{1,2}:\d{2}(?:am|pm))", line, re.IGNORECASE)
                if time_match and current_date:
                    start_time = parse_time(time_match.group(1))
                    end_time = parse_time(time_match.group(2))

                    # Look ahead for class details
                    class_name = None
                    location = None
                    instructor = None
                    class_type = None

                    for offset in range(1, 7):
                        if i + offset >= len(lines):
                            break
                        next_line = lines[i + offset]

                        # Skip UI elements
                        if next_line in ["Add to Calendar", "See More", ""]:
                            continue

                        # Skip if it's a new time entry
                        if re.match(r"\d{1,2}:\d{2}(?:am|pm)", next_line, re.IGNORECASE):
                            break

                        # Skip if it's a new date
                        if re.match(r"(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),", next_line):
                            break

                        # First substantial line is class name
                        if not class_name:
                            class_name = next_line
                            continue

                        # Second is location
                        if not location:
                            location = next_line
                            continue

                        # Third is instructor (contains name pattern)
                        if not instructor:
                            instructor = next_line
                            continue

                        # Fourth is class type (category)
                        if not class_type:
                            class_type = next_line
                            break

                    if class_name and current_date and start_time:
                        # Skip nav items
                        skip_words = ["category", "studio", "class name", "instructor", "reset", "filter", "apply"]
                        if any(sw in class_name.lower() for sw in skip_words):
                            i += 1
                            continue

                        events_found += 1
                        start_date = current_date.strftime("%Y-%m-%d")

                        content_hash = generate_content_hash(
                            class_name, venue_data["name"], f"{start_date} {start_time}"
                        )

                        existing = find_event_by_hash(content_hash)
                        if existing:
                            smart_update_existing_event(existing, event_record)
                            events_updated += 1
                            i += 1
                            continue

                        cat_info = get_class_category(class_name + " " + (class_type or ""))
                        base_tags = ["piedmont", "fitness", "class", "fayetteville"]

                        description = f"{class_name}"
                        if location:
                            description += f" in {location}"
                        if instructor:
                            description += f". Instructor: {instructor}"
                        if class_type:
                            description += f". Type: {class_type}"

                        image_url = image_map.get(class_name)

                        # Build series_hint
                        series_hint = {
                            "series_type": "class_series",
                            "series_title": class_name,
                            "frequency": "weekly",
                            "description": description,
                        }
                        if image_url:
                            series_hint["image_url"] = image_url

                        event_record = {
                            "source_id": source_id,
                            "venue_id": venue_id,
                            "portal_id": portal_id,
                            "title": class_name,
                            "description": description,
                            "start_date": start_date,
                            "start_time": start_time,
                            "end_date": start_date,
                            "end_time": end_time,
                            "is_all_day": False,
                            "category": cat_info["category"],
                            "category_id": cat_info["category"],
                            "subcategory": cat_info["subcategory"],
                            "tags": list(set(base_tags + cat_info["tags"])),
                            "price_min": None,
                            "price_max": None,
                            "price_note": "Included with membership",
                            "is_free": False,
                            "source_url": calendar_url,
                            "ticket_url": venue_data["website"],
                            "image_url": image_url,
                            "raw_text": f"{class_name} - {start_date} {start_time}",
                            "extraction_confidence": 0.85,
                            "is_recurring": True,
                            "recurrence_rule": "FREQ=WEEKLY",
                            "content_hash": content_hash,
                        }

                        try:
                            insert_event(event_record, series_hint=series_hint)
                            events_new += 1
                            logger.info(f"Added: {class_name} on {start_date} at {start_time}")
                        except Exception as e:
                            logger.error(f"Failed to insert: {class_name}: {e}")

                i += 1

            browser.close()

    except Exception as e:
        logger.error(f"Failed to crawl Fayetteville calendar: {e}")

    return events_found, events_new, events_updated


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl all Piedmont fitness center schedules."""
    source_id = source["id"]
    total_found = 0
    total_new = 0
    total_updated = 0

    # Get portal ID for Piedmont-exclusive events
    portal_id = get_portal_id_by_slug(PORTAL_SLUG)

    # Crawl Atlanta fitness center PDFs
    atlanta_venue = VENUES["atlanta"]
    for schedule_name, pdf_url in atlanta_venue.get("schedules", {}).items():
        logger.info(f"Crawling Atlanta {schedule_name} schedule...")
        found, new, updated = crawl_pdf_schedule(pdf_url, atlanta_venue, source_id, portal_id)
        total_found += found
        total_new += new
        total_updated += updated

    # Crawl Newnan fitness center PDFs
    newnan_venue = VENUES["newnan"]
    for schedule_name, pdf_url in newnan_venue.get("schedules", {}).items():
        logger.info(f"Crawling Newnan {schedule_name} schedule...")
        found, new, updated = crawl_pdf_schedule(pdf_url, newnan_venue, source_id, portal_id)
        total_found += found
        total_new += new
        total_updated += updated

    # Crawl Fayetteville wellness center calendar
    fayetteville_venue = VENUES["fayetteville"]
    logger.info("Crawling Fayetteville calendar...")
    found, new, updated = crawl_fayetteville_calendar(fayetteville_venue, source_id, portal_id)
    total_found += found
    total_new += new
    total_updated += updated

    logger.info(
        f"Piedmont Fitness crawl complete: {total_found} found, {total_new} new, {total_updated} updated"
    )

    return total_found, total_new, total_updated
