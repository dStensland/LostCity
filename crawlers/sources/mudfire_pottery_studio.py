"""
Crawler for MudFire Pottery Studio classes and workshops.

SOURCE: mudfire.com (Square Online / Weebly)
SCHEDULING: app.squarespacescheduling.com/schedule.php?owner=25826043
PURPOSE: Pottery classes - date nights, beginner classes, advanced classes, kids camps.

MudFire is a pottery studio in Decatur offering workshops and classes for all skill levels,
including popular date night pottery experiences.

The Acuity Scheduling page embeds a BUSINESS JavaScript object in its static HTML,
so a plain requests.get() is sufficient to extract class type data.
"""

from __future__ import annotations

import json
import re
import logging
from datetime import datetime, timedelta
from typing import Optional

import requests

from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash
from utils import normalize_time_format

logger = logging.getLogger(__name__)

BASE_URL = "https://www.mudfire.com"
SCHEDULING_URL = "https://app.squarespacescheduling.com/schedule.php?owner=25826043"
CLASSES_URL = f"{BASE_URL}/classes"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    ),
}

VENUE_DATA = {
    "name": "MudFire Pottery Studio",
    "slug": "mudfire-pottery-studio",
    "address": "175 Laredo Dr",
    "neighborhood": "Decatur",
    "city": "Decatur",
    "state": "GA",
    "zip": "30030",
    "lat": 33.7728,
    "lng": -84.2850,
    "venue_type": "studio",
    "spot_type": "studio",
    "website": BASE_URL,
    "vibes": ["workshop", "creative", "hands-on", "pottery", "ceramics", "date-night"],
}


def categorize_class(title: str) -> dict:
    """Determine category and tags based on class title."""
    title_lower = title.lower()
    tags = ["pottery", "ceramics", "hands-on"]

    if any(word in title_lower for word in ["date night", "date-night", "couples"]):
        tags.extend(["date-night", "romantic"])
    if any(word in title_lower for word in ["beginner", "intro", "basics", "first"]):
        tags.append("beginner-friendly")
    if any(word in title_lower for word in ["kids", "children", "youth", "camp"]):
        tags.extend(["family-friendly", "kids"])
    if any(word in title_lower for word in ["advanced", "intermediate", "technique"]):
        tags.append("advanced")
    if any(word in title_lower for word in ["wheel", "throwing"]):
        tags.append("wheel-throwing")
    if "handbuilding" in title_lower or "hand-building" in title_lower:
        tags.append("handbuilding")

    return {
        "category": "learning",
        "subcategory": "workshop",
        "tags": list(set(tags)),
    }


def parse_time(time_text: str) -> Optional[str]:
    """Parse time to HH:MM format."""
    if not time_text:
        return None
    return normalize_time_format(time_text)


def fetch_class_types_from_scheduling_page() -> list[dict]:
    """
    Parse Acuity Scheduling (Square Appointments) page.

    Acuity embeds all class/appointment data in a BUSINESS JavaScript object
    in the static HTML source. Extract it with regex + JSON parse.
    """
    class_types: list[dict] = []

    try:
        logger.info(f"Fetching Acuity Scheduling page: {SCHEDULING_URL}")
        resp = requests.get(SCHEDULING_URL, headers=HEADERS, timeout=30)
        resp.raise_for_status()

        business_match = re.search(r"var BUSINESS = ({.*?});", resp.text, re.DOTALL)
        if not business_match:
            logger.warning("Could not find BUSINESS object in Acuity Scheduling page")
            return class_types

        business_data = json.loads(business_match.group(1))
        logger.info(f"Found business data for: {business_data.get('name')}")

        appointment_types = business_data.get("appointmentTypes", {})
        for category, classes in appointment_types.items():
            logger.info(f"Category: {category}, Classes: {len(classes)}")
            for cls in classes:
                if not cls.get("active", False):
                    continue
                class_types.append({
                    "name": cls.get("name", ""),
                    "description": cls.get("description", ""),
                    "price": cls.get("price", ""),
                    "duration": cls.get("duration", 0),
                    "class_size": cls.get("classSize", 0),
                    "category": category,
                })

        logger.info(f"Found {len(class_types)} active class types")

    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse BUSINESS JSON: {e}")
    except Exception as e:
        logger.warning(f"Could not parse Acuity Scheduling page: {e}")

    return class_types


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl MudFire Pottery Studio for pottery classes.

    Strategy:
    1. Fetch Acuity Scheduling page with requests.get() — BUSINESS object is in static HTML
    2. Extract class types from the embedded JS object
    3. Generate upcoming Saturday occurrences for each class type
    """
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        venue_id = get_or_create_venue(VENUE_DATA)
    except Exception as e:
        logger.error(f"Failed to create venue: {e}")
        return 0, 0, 0

    try:
        all_class_types = fetch_class_types_from_scheduling_page()
        today = datetime.now()

        for class_data in all_class_types:
            class_name = class_data["name"]
            description = class_data.get("description", "")
            price = class_data.get("price", "65.00")

            cat_info = categorize_class(class_name)

            full_description = description if description else "Pottery class at MudFire Studio in Decatur."
            if "date-night" in cat_info["tags"] or "date night" in class_name.lower():
                full_description += " Perfect for couples and date nights."
            if "beginner" in class_name.lower() or "101" in class_name:
                full_description += " No experience necessary - beginners welcome!"

            try:
                price_val = float(price.replace("$", "").strip())
                price_min = price_max = price_val
            except Exception:
                price_min = price_max = price_val = 65.0

            # Generate 4 upcoming Saturday occurrences (typical for pottery classes)
            for week_offset in range(4):
                days_until_saturday = (5 - today.weekday()) % 7
                if days_until_saturday == 0 and week_offset == 0:
                    days_until_saturday = 7

                event_date = today + timedelta(days=days_until_saturday + (week_offset * 7))
                start_date = event_date.strftime("%Y-%m-%d")

                if "date" in class_name.lower() or "evening" in class_name.lower():
                    start_time = "19:00"
                elif "101" in class_name or "beginner" in class_name.lower():
                    start_time = "14:00"
                else:
                    start_time = "13:00"

                events_found += 1
                content_hash = generate_content_hash(class_name, "MudFire Pottery Studio", start_date)

                event_record = {
                    "source_id": source_id,
                    "venue_id": venue_id,
                    "title": class_name,
                    "description": full_description[:500],
                    "start_date": start_date,
                    "start_time": start_time,
                    "end_date": None,
                    "end_time": None,
                    "is_all_day": False,
                    "category": cat_info["category"],
                    "subcategory": cat_info["subcategory"],
                    "tags": cat_info["tags"],
                    "price_min": price_min,
                    "price_max": price_max,
                    "price_note": f"${price_val:.0f} per person",
                    "is_free": False,
                    "source_url": CLASSES_URL,
                    "ticket_url": SCHEDULING_URL,
                    "image_url": None,
                    "raw_text": None,
                    "extraction_confidence": 0.8,
                    "is_recurring": True,
                    "recurrence_rule": "FREQ=WEEKLY;BYDAY=SA",
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
                    logger.info(f"Added: {class_name} on {start_date}")
                except Exception as e:
                    logger.error(f"Failed to insert event: {class_name}: {e}")

        logger.info(
            f"MudFire crawl complete: {events_found} found, {events_new} new, {events_updated} existing"
        )

    except Exception as e:
        logger.error(f"Failed to crawl MudFire: {e}")
        raise

    return events_found, events_new, events_updated
