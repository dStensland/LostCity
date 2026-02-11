"""
Crawler for Narcotics Anonymous (NA) Metro Atlanta meeting directory.

Crawls 500+ weekly recurring meetings across Metro Atlanta from the Georgia Regional
Service Committee's BMLT (Basic Meeting List Toolbox) server. These are support group
meetings stored for completeness but marked as INACTIVE (not surfaced in public feeds).

Meeting types include open, closed, discussion groups, Spanish-language meetings,
and LGBTQ+ meetings. Locations include churches, community centers, recovery clubs
(Galano Club, Triangle Club, NABA Club, 8111 Clubhouse).

Data source: BMLT JSON API at bmlt.sezf.org serving Metro Atlanta sub-region.
Coverage: Midtown Atlanta, North Atlanta, South Atlanta, Marietta, Southwest Atlanta,
West Georgia areas.
"""

from __future__ import annotations

import re
import logging
import requests
from datetime import datetime, timedelta
from typing import Optional

from db import get_or_create_venue, insert_event, find_event_by_hash
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BMLT_BASE_URL = "https://bmlt.sezf.org/main_server"
BMLT_JSON_URL = f"{BMLT_BASE_URL}/client_interface/json/"

# Metro Atlanta sub-region service body IDs
# 74 = Metro Atlanta Sub-Region (parent)
# 64 = Midtown Atlanta Area
# 65 = North Atlanta Area
# 69 = South Atlanta Area
# 63 = Marietta Area
# 168 = Southwest Atlanta Area
# 123 = West Georgia Area
METRO_ATLANTA_SERVICE_BODIES = [64, 65, 69, 63, 168, 123]

# How many weeks ahead to generate events for recurring meetings
WEEKS_AHEAD = 4

# Day mapping: BMLT uses 1=Sunday, 2=Monday... 7=Saturday
# We need to convert to Python's weekday() format: 0=Monday, 6=Sunday
DAY_MAP = {
    1: 6,  # Sunday
    2: 0,  # Monday
    3: 1,  # Tuesday
    4: 2,  # Wednesday
    5: 3,  # Thursday
    6: 4,  # Friday
    7: 5,  # Saturday
}

# Known recovery-focused venues in Atlanta
RECOVERY_VENUES = {
    "galano club": "LGBTQ+ recovery community center",
    "triangle club": "Recovery community center",
    "naba club": "Recovery community center",
    "8111 clubhouse": "Recovery community center",
    "365 center": "Recovery community center",
}


def parse_meeting_format(formats_str: str) -> list[str]:
    """
    Parse BMLT format codes into readable format names.
    Common codes: O=Open, C=Closed, D=Discussion, SP=Spanish, LGBTQ=LGBTQ+
    """
    if not formats_str:
        return []

    format_codes = [f.strip() for f in formats_str.split(',')]
    format_names = []

    for code in format_codes:
        code_upper = code.upper()
        if code_upper in ['O', 'OPEN']:
            format_names.append('Open')
        elif code_upper in ['C', 'CLOSED']:
            format_names.append('Closed')
        elif code_upper in ['D', 'DISC', 'DISCUSSION']:
            format_names.append('Discussion')
        elif code_upper in ['SP', 'SPANISH', 'ES']:
            format_names.append('Spanish')
        elif code_upper in ['LGBTQ', 'LGBTQIA', 'GAY']:
            format_names.append('LGBTQ+')
        elif code_upper in ['W', 'WOMEN', 'WOM']:
            format_names.append('Women')
        elif code_upper in ['M', 'MEN']:
            format_names.append('Men')
        elif code_upper in ['BEG', 'BEGINNER', 'B']:
            format_names.append('Beginners')
        elif code_upper in ['Y', 'YOUNG', 'YP']:
            format_names.append('Young People')

    return format_names


def determine_venue_type(location_name: str, location_info: str = "") -> str:
    """Determine venue type based on location name and info."""
    name_lower = location_name.lower()
    info_lower = location_info.lower()
    combined = f"{name_lower} {info_lower}"

    # Check for known recovery venues first
    for venue_keyword, _ in RECOVERY_VENUES.items():
        if venue_keyword in combined:
            return "community_center"

    if any(word in combined for word in ["church", "chapel", "cathedral", "baptist", "methodist",
                                          "lutheran", "catholic", "episcopal", "presbyterian",
                                          "united methodist", "pentecostal", "assembly of god"]):
        return "church"
    elif any(word in combined for word in ["club", "clubhouse", "alano"]):
        return "community_center"
    elif any(word in combined for word in ["hospital", "medical", "health"]):
        return "community_center"
    elif any(word in combined for word in ["library"]):
        return "library"
    elif any(word in combined for word in ["center", "community"]):
        return "community_center"
    else:
        return "community_center"  # Default


def format_meeting_description(meeting: dict, formats: list[str]) -> str:
    """Generate a description for the meeting based on meeting formats."""
    parts = []

    # Check if virtual/hybrid
    is_virtual = meeting.get("virtual_meeting_link") or meeting.get("phone_meeting_number")
    is_in_person = meeting.get("latitude") and meeting.get("longitude")

    if is_virtual and is_in_person:
        parts.append("Hybrid NA meeting (in-person and online)")
    elif is_virtual:
        parts.append("Online NA meeting")
    else:
        parts.append("In-person NA meeting")

    if formats:
        parts.append(f"({', '.join(formats)})")

    # Add comments if available
    comments = meeting.get("comments", "").strip()
    if comments:
        parts.append(f"Notes: {comments}")

    # Add virtual meeting info
    if meeting.get("virtual_meeting_link"):
        parts.append(f"Virtual meeting link available.")
    if meeting.get("phone_meeting_number"):
        parts.append(f"Phone: {meeting.get('phone_meeting_number')}")

    return ". ".join(parts) + "."


def get_next_weekday(start_date: datetime, weekday: int) -> datetime:
    """Get the next occurrence of a weekday (0=Monday, 6=Sunday)."""
    days_ahead = weekday - start_date.weekday()
    if days_ahead < 0:
        days_ahead += 7
    return start_date + timedelta(days=days_ahead)


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl NA Metro Atlanta meeting directory from BMLT server.

    Fetches all meetings from Metro Atlanta area service bodies and creates
    recurring weekly events for the next 4 weeks.
    """
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        # Fetch meetings for all Metro Atlanta service bodies
        all_meetings = []

        for service_body_id in METRO_ATLANTA_SERVICE_BODIES:
            logger.info(f"Fetching NA meetings for service body {service_body_id}")

            params = {
                "switcher": "GetSearchResults",
                "services[]": service_body_id,
                "data_field_key": "weekday_tinyint,start_time,duration_time,location_text,"
                                 "location_street,location_municipality,location_province,"
                                 "location_postal_code_1,location_sub_province,latitude,"
                                 "longitude,meeting_name,formats,comments,virtual_meeting_link,"
                                 "phone_meeting_number,location_info,location_neighborhood"
            }

            response = requests.get(
                BMLT_JSON_URL,
                params=params,
                headers={"User-Agent": "Mozilla/5.0 (compatible; LostCity/1.0)"},
                timeout=30
            )
            response.raise_for_status()

            meetings = response.json()
            logger.info(f"Found {len(meetings)} meetings for service body {service_body_id}")
            all_meetings.extend(meetings)

        logger.info(f"Found {len(all_meetings)} total meetings in Metro Atlanta NA")

        # Cache venue IDs to avoid repeated lookups
        venue_cache = {}

        today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)

        for meeting in all_meetings:
            try:
                # Parse location info
                location_name = meeting.get("location_text", "NA Meeting Location").strip()
                if not location_name or location_name == "":
                    location_name = "NA Meeting Location"

                location_street = meeting.get("location_street", "").strip()
                location_city = meeting.get("location_municipality", "").strip()
                location_state = meeting.get("location_province", "GA").strip()
                location_zip = meeting.get("location_postal_code_1", "").strip()
                location_county = meeting.get("location_sub_province", "").strip()
                location_info = meeting.get("location_info", "").strip()

                # Use location as cache key
                venue_key = f"{location_name}_{location_street}_{location_city}".lower()

                if venue_key not in venue_cache:
                    # Determine neighborhood (use county if no specific neighborhood)
                    neighborhood = meeting.get("location_neighborhood", "").strip()
                    if not neighborhood and location_county:
                        neighborhood = location_county

                    # Get coordinates
                    lat = meeting.get("latitude")
                    lng = meeting.get("longitude")

                    # Convert to float if string
                    try:
                        lat = float(lat) if lat else None
                        lng = float(lng) if lng else None
                    except (ValueError, TypeError):
                        lat = None
                        lng = None

                    # Create venue
                    venue_data = {
                        "name": location_name,
                        "slug": f"na-{location_city.lower().replace(' ', '-')}-{location_street[:20].lower().replace(' ', '-')}",
                        "address": location_street,
                        "city": location_city,
                        "state": location_state,
                        "zip": location_zip,
                        "lat": lat,
                        "lng": lng,
                        "neighborhood": neighborhood or location_city,
                        "venue_type": determine_venue_type(location_name, location_info),
                        "spot_type": "community_center",
                    }

                    venue_id = get_or_create_venue(venue_data)
                    venue_cache[venue_key] = (venue_id, location_name)
                else:
                    venue_id, location_name = venue_cache[venue_key]

                # Parse meeting details
                meeting_name = meeting.get("meeting_name", "NA Meeting").strip()

                # Parse time (format: "HH:MM:SS")
                start_time_str = meeting.get("start_time", "")
                start_time = None
                if start_time_str:
                    try:
                        # Parse "HH:MM:SS" and convert to "HH:MM"
                        time_parts = start_time_str.split(":")
                        if len(time_parts) >= 2:
                            start_time = f"{time_parts[0]}:{time_parts[1]}"
                    except Exception as e:
                        logger.warning(f"Failed to parse time {start_time_str}: {e}")

                # Get day of week (convert from BMLT's 1=Sunday to Python's 0=Monday)
                weekday_bmlt = meeting.get("weekday_tinyint")
                if not weekday_bmlt:
                    logger.warning(f"No day specified for meeting: {meeting_name}")
                    continue

                try:
                    weekday_bmlt = int(weekday_bmlt)
                except (ValueError, TypeError):
                    logger.warning(f"Invalid day {weekday_bmlt} for meeting: {meeting_name}")
                    continue

                python_weekday = DAY_MAP.get(weekday_bmlt)
                if python_weekday is None:
                    logger.warning(f"Invalid day {weekday_bmlt} for meeting: {meeting_name}")
                    continue

                # Parse formats
                formats_str = meeting.get("formats", "")
                formats = parse_meeting_format(formats_str)

                # Generate description
                description = format_meeting_description(meeting, formats)

                # Build meeting URL
                meeting_url = "https://midtownatlantana.com/meetings/"

                # Find next occurrence of this day
                next_date = get_next_weekday(today, python_weekday)

                # Generate events for the next N weeks
                for week in range(WEEKS_AHEAD):
                    event_date = next_date + timedelta(weeks=week)
                    start_date = event_date.strftime("%Y-%m-%d")

                    events_found += 1

                    # Generate content hash
                    content_hash = generate_content_hash(
                        meeting_name,
                        location_name,
                        start_date
                    )

                    if find_event_by_hash(content_hash):
                        events_updated += 1
                        continue

                    # Build tags
                    tags = ["support-group", "free", "wellness"]
                    if "LGBTQ+" in formats:
                        tags.append("lgbtq")
                    if "Spanish" in formats:
                        tags.append("spanish")
                    if "Women" in formats:
                        tags.append("women")

                    # Create event record
                    event_record = {
                        "source_id": source_id,
                        "venue_id": venue_id,
                        "title": meeting_name,
                        "description": description,
                        "start_date": start_date,
                        "start_time": start_time,
                        "end_date": None,
                        "end_time": None,
                        "is_all_day": False,
                        "category": "wellness",
                        "subcategory": None,
                        "tags": tags,
                        "price_min": None,
                        "price_max": None,
                        "price_note": None,
                        "is_free": True,
                        "source_url": meeting_url,
                        "ticket_url": None,
                        "image_url": None,
                        "raw_text": f"{meeting_name} - {description}",
                        "extraction_confidence": 0.95,
                        "is_recurring": True,
                        "recurrence_rule": f"FREQ=WEEKLY;BYDAY={['MO','TU','WE','TH','FR','SA','SU'][python_weekday]}",
                        "content_hash": content_hash,
                    }

                    # Add series hint for linking
                    day_names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
                    series_hint = {
                        "series_type": "recurring_show",
                        "series_title": meeting_name,
                        "frequency": "weekly",
                        "day_of_week": day_names[python_weekday],
                        "description": description,
                    }

                    try:
                        insert_event(event_record, series_hint=series_hint)
                        events_new += 1
                        logger.debug(f"Added: {meeting_name} at {location_name} on {start_date}")
                    except Exception as e:
                        logger.error(f"Failed to insert {meeting_name}: {e}")

            except Exception as e:
                logger.warning(f"Error processing meeting {meeting.get('meeting_name', 'unknown')}: {e}")
                continue

        logger.info(
            f"NA Metro Atlanta crawl complete: {events_found} events found, "
            f"{events_new} new, {events_updated} existing"
        )

    except Exception as e:
        logger.error(f"Failed to crawl NA Metro Atlanta: {e}")
        raise

    return events_found, events_new, events_updated
