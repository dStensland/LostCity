"""
Crawler for AA (Alcoholics Anonymous) Atlanta Intergroup meeting directory.

Crawls 1,200+ weekly recurring meetings across metro Atlanta from atlantaaa.org.
These are support group meetings stored for completeness but not surfaced in
public feeds initially. Meeting types include open, closed, men's/women's groups,
discussion groups, and Spanish-language meetings.

Data source: JSON cache file from the AA Meeting Guide app integration.
"""

from __future__ import annotations

import re
import logging
import requests
from datetime import datetime, timedelta
from typing import Optional

from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://atlantaaa.org"
MEETINGS_JSON_URL = f"{BASE_URL}/wp-content/tsml-cache-d14d9a6ef1.json"

# How many weeks ahead to generate events for recurring meetings
WEEKS_AHEAD = 4

# Day mapping: API uses 0=Sunday, 1=Monday... 6=Saturday
# We need to convert to Python's weekday() format: 0=Monday, 6=Sunday
DAY_MAP = {
    0: 6,  # Sunday
    1: 0,  # Monday
    2: 1,  # Tuesday
    3: 2,  # Wednesday
    4: 3,  # Thursday
    5: 4,  # Friday
    6: 5,  # Saturday
}

# Meeting type codes
TYPE_CODES = {
    "O": "Open",
    "C": "Closed",
    "D": "Discussion",
    "B": "Beginners",
    "M": "Men",
    "W": "Women",
    "S": "Spanish",
    "LGBTQ": "LGBTQ+",
    "Y": "Young People",
}


def parse_address(formatted_address: str) -> dict:
    """
    Parse formatted address into components.
    Example: "631 N Main St Suite #114, Alpharetta, GA 30009, USA"
    """
    parts = [p.strip() for p in formatted_address.split(",")]

    result = {
        "address": None,
        "city": None,
        "state": None,
        "zip": None,
    }

    if len(parts) >= 3:
        result["address"] = parts[0]
        result["city"] = parts[1]

        # State and zip are together: "GA 30009"
        state_zip = parts[2].strip()
        match = re.match(r"([A-Z]{2})\s+(\d{5})", state_zip)
        if match:
            result["state"] = match.group(1)
            result["zip"] = match.group(2)

    return result


def determine_venue_type(location_name: str) -> str:
    """Determine venue type based on location name."""
    name_lower = location_name.lower()

    if any(word in name_lower for word in ["church", "chapel", "cathedral", "baptist", "methodist", "lutheran", "catholic", "episcopal"]):
        return "church"
    elif any(word in name_lower for word in ["club", "clubhouse", "alano"]):
        return "community_center"
    elif any(word in name_lower for word in ["hospital", "medical", "health"]):
        return "community_center"
    elif any(word in name_lower for word in ["library"]):
        return "library"
    elif any(word in name_lower for word in ["center", "community"]):
        return "community_center"
    else:
        return "community_center"  # Default


def format_meeting_description(meeting: dict) -> str:
    """Generate a description for the meeting based on meeting types."""
    types_list = meeting.get("types", [])
    type_names = [TYPE_CODES.get(t, t) for t in types_list if t in TYPE_CODES]

    attendance = meeting.get("attendance_option", "in_person")
    attendance_str = "In-person" if attendance == "in_person" else "Online"

    parts = [
        f"{attendance_str} AA meeting",
    ]

    if type_names:
        parts.append(f"({', '.join(type_names)})")

    # Add location context
    location_notes = meeting.get("location_notes", "")
    if location_notes:
        parts.append(f"Location notes: {location_notes}")

    return ". ".join(parts) + "."


def get_next_weekday(start_date: datetime, weekday: int) -> datetime:
    """Get the next occurrence of a weekday (0=Monday, 6=Sunday)."""
    days_ahead = weekday - start_date.weekday()
    if days_ahead < 0:
        days_ahead += 7
    return start_date + timedelta(days=days_ahead)


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl AA Atlanta Intergroup meeting directory.

    Fetches all meetings from JSON cache and creates recurring weekly events
    for the next 4 weeks.
    """
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        logger.info(f"Fetching AA meetings from: {MEETINGS_JSON_URL}")

        response = requests.get(
            MEETINGS_JSON_URL,
            headers={"User-Agent": "Mozilla/5.0 (compatible; LostCity/1.0)"},
            timeout=15
        )
        response.raise_for_status()

        # Parse JSON - remove any BOM or extra chars
        data = response.text
        data = re.sub(r'^[^[{]*', '', data)
        meetings = requests.models.complexjson.loads(data)

        logger.info(f"Found {len(meetings)} meetings in Atlanta AA directory")

        # Cache venue IDs to avoid repeated lookups
        venue_cache = {}

        today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)

        for meeting in meetings:
            try:
                # Skip online-only meetings outside metro Atlanta
                region = meeting.get("region", "")
                if meeting.get("attendance_option") == "online" and region not in [
                    "Atlanta", "Decatur", "Marietta", "Alpharetta", "Roswell",
                    "Sandy Springs", "Dunwoody", "Smyrna", "East Point", "College Park",
                    "Johns Creek", "Lawrenceville", "Norcross", "Peachtree City",
                    "Newnan", "Douglasville", "Kennesaw", "Carrollton", "Jonesboro"
                ]:
                    logger.debug(f"Skipping online meeting outside metro: {meeting.get('name')}")
                    continue

                # Parse location info
                location_name = meeting.get("location", "AA Meeting Location")
                location_id = meeting.get("location_id")

                # Use location_id as cache key
                venue_key = f"location_{location_id}"

                if venue_key not in venue_cache:
                    # Parse address
                    formatted_address = meeting.get("formatted_address", "")
                    addr_parts = parse_address(formatted_address)

                    # Create venue
                    venue_data = {
                        "name": location_name,
                        "slug": f"aa-{meeting.get('slug', '').split('-')[0]}-{location_id}",
                        "address": addr_parts["address"],
                        "city": addr_parts["city"],
                        "state": addr_parts["state"],
                        "zip": addr_parts["zip"],
                        "lat": meeting.get("latitude"),
                        "lng": meeting.get("longitude"),
                        "neighborhood": region,
                        "venue_type": determine_venue_type(location_name),
                        "spot_type": "community_center",
                        "website": meeting.get("location_url"),
                    }

                    venue_id = get_or_create_venue(venue_data)
                    venue_cache[venue_key] = (venue_id, location_name)
                else:
                    venue_id, location_name = venue_cache[venue_key]

                # Parse meeting details
                meeting_name = meeting.get("name", "AA Meeting")
                group_name = meeting.get("group", "")

                # Use group name if different from meeting name
                title = meeting_name
                if group_name and group_name != meeting_name:
                    title = f"{group_name} - {meeting_name}"

                # Parse time
                time_str = meeting.get("time", "")  # Format: "18:00"
                start_time = time_str if time_str else None

                # Get day of week (convert from AA's 0=Sunday to Python's 0=Monday)
                api_day = meeting.get("day")
                if api_day is None:
                    logger.warning(f"No day specified for meeting: {title}")
                    continue

                python_weekday = DAY_MAP.get(api_day)
                if python_weekday is None:
                    logger.warning(f"Invalid day {api_day} for meeting: {title}")
                    continue

                # Generate description
                description = format_meeting_description(meeting)

                # Get meeting URL
                meeting_url = meeting.get("url", BASE_URL + "/meetings/")

                # Find next occurrence of this day
                next_date = get_next_weekday(today, python_weekday)

                # Generate events for the next N weeks
                for week in range(WEEKS_AHEAD):
                    event_date = next_date + timedelta(weeks=week)
                    start_date = event_date.strftime("%Y-%m-%d")

                    events_found += 1

                    # Generate content hash
                    content_hash = generate_content_hash(
                        title,
                        location_name,
                        start_date
                    )


                    # Create event record
                    event_record = {
                        "source_id": source_id,
                        "venue_id": venue_id,
                        "title": title,
                        "description": description,
                        "start_date": start_date,
                        "start_time": start_time,
                        "end_date": None,
                        "end_time": None,
                        "is_all_day": False,
                        "category": "wellness",
                        "subcategory": None,
                        "tags": ["support-group", "free", "wellness"],
                        "price_min": None,
                        "price_max": None,
                        "price_note": None,
                        "is_free": True,
                        "source_url": meeting_url,
                        "ticket_url": None,
                        "image_url": None,
                        "raw_text": f"{title} - {description}",
                        "extraction_confidence": 0.95,
                        "is_recurring": True,
                        "recurrence_rule": f"FREQ=WEEKLY;BYDAY={['MO','TU','WE','TH','FR','SA','SU'][python_weekday]}",
                        "content_hash": content_hash,
                    }

                    existing = find_event_by_hash(content_hash)
                    if existing:
                        smart_update_existing_event(existing, event_record)
                        events_updated += 1
                        continue

                    # Add series hint for linking
                    day_names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
                    series_hint = {
                        "series_type": "recurring_show",
                        "series_title": title,
                        "frequency": "weekly",
                        "day_of_week": day_names[python_weekday],
                        "description": description,
                    }

                    try:
                        insert_event(event_record, series_hint=series_hint)
                        events_new += 1
                        logger.debug(f"Added: {title} at {location_name} on {start_date}")
                    except Exception as e:
                        logger.error(f"Failed to insert {title}: {e}")

            except Exception as e:
                logger.warning(f"Error processing meeting {meeting.get('name', 'unknown')}: {e}")
                continue

        logger.info(
            f"AA Atlanta crawl complete: {events_found} events found, "
            f"{events_new} new, {events_updated} existing"
        )

    except Exception as e:
        logger.error(f"Failed to crawl AA Atlanta: {e}")
        raise

    return events_found, events_new, events_updated
