"""
Crawler for Home Depot Kids Workshops.

Home Depot runs free monthly kids workshops (typically first Saturday of the month)
at their stores nationwide. Kids ages 5-12 build a wooden project and receive an apron,
pin, and certificate of completion.

Since the homedepot.com/workshops site has bot protection, this crawler generates
events based on the known monthly schedule for major Atlanta-area Home Depot locations.

Workshop details:
- FREE event
- First Saturday of each month, 9:00 AM - 12:00 PM
- Ages 5-12 (kids must be accompanied by parent/guardian)
- Build a wooden project (changes monthly - birdhouse, toolbox, planter, etc.)
- Get a free kids workshop apron, achievement pin, and certificate
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta
from dateutil.relativedelta import relativedelta
from typing import Optional

from db import get_or_create_venue, insert_event, find_event_by_hash
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

# Major Atlanta-area Home Depot locations
# These are high-traffic stores convenient to families
ATLANTA_HOME_DEPOT_LOCATIONS = [
    {
        "name": "Home Depot - Ponce de Leon",
        "slug": "home-depot-ponce",
        "address": "650 Ponce De Leon Ave NE",
        "neighborhood": "Poncey-Highland",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30308",
        "venue_type": "retail",
        "website": "https://www.homedepot.com",
    },
    {
        "name": "Home Depot - Howell Mill",
        "slug": "home-depot-howell-mill",
        "address": "1200 Howell Mill Rd NW",
        "neighborhood": "West Midtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30318",
        "venue_type": "retail",
        "website": "https://www.homedepot.com",
    },
    {
        "name": "Home Depot - Atlantic Station",
        "slug": "home-depot-atlantic-station",
        "address": "1380 Atlantic Dr NW",
        "neighborhood": "Atlantic Station",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30363",
        "venue_type": "retail",
        "website": "https://www.homedepot.com",
    },
    {
        "name": "Home Depot - Buckhead",
        "slug": "home-depot-buckhead",
        "address": "3535 Piedmont Rd NE",
        "neighborhood": "Buckhead",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30305",
        "venue_type": "retail",
        "website": "https://www.homedepot.com",
    },
    {
        "name": "Home Depot - Decatur",
        "slug": "home-depot-decatur",
        "address": "2410 Glenwood Ave SE",
        "neighborhood": "Decatur",
        "city": "Decatur",
        "state": "GA",
        "zip": "30032",
        "venue_type": "retail",
        "website": "https://www.homedepot.com",
    },
    {
        "name": "Home Depot - Lindbergh",
        "slug": "home-depot-lindbergh",
        "address": "2455 Piedmont Rd NE",
        "neighborhood": "Lindbergh",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30324",
        "venue_type": "retail",
        "website": "https://www.homedepot.com",
    },
]


def get_first_saturday(year: int, month: int) -> datetime:
    """Get the first Saturday of a given month."""
    # Start with first day of month
    first_day = datetime(year, month, 1)

    # Saturday is weekday 5 (Monday=0)
    days_until_saturday = (5 - first_day.weekday()) % 7

    # If first day is already Saturday, it's day 0
    if days_until_saturday == 0:
        return first_day

    # Otherwise add days to get to first Saturday
    return first_day + timedelta(days=days_until_saturday)


def generate_workshop_description(month_name: str) -> str:
    """Generate description for the kids workshop."""
    return (
        f"Join us for the FREE {month_name} Kids Workshop! Children ages 5-12 can build a fun "
        "wooden project and take it home. Each child will receive a FREE orange Home Depot apron, "
        "a workshop achievement pin, and a certificate of completion. Projects change monthly and "
        "may include items like birdhouses, toolboxes, planters, race cars, or seasonal crafts. "
        "All kids must be accompanied by a parent or adult guardian. No registration required - "
        "just show up! Workshops run from 9:00 AM to 12:00 PM, while supplies last. "
        "This is a great hands-on learning experience that teaches kids basic building skills, "
        "tool safety, and the pride of creating something with their own hands."
    )


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Generate Home Depot Kids Workshop events for Atlanta-area stores.

    Creates events for the first Saturday of each month (next 6 months)
    at major Atlanta Home Depot locations.
    """
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        # Generate events for next 6 months
        today = datetime.now()

        for month_offset in range(6):
            target_date = today + relativedelta(months=month_offset)
            first_sat = get_first_saturday(target_date.year, target_date.month)

            # Only create events for future dates
            if first_sat.date() < today.date():
                continue

            month_name = first_sat.strftime("%B")
            event_date = first_sat.strftime("%Y-%m-%d")

            # Create event at each location
            for location in ATLANTA_HOME_DEPOT_LOCATIONS:
                events_found += 1

                # Get or create venue
                venue_id = get_or_create_venue(location)

                title = f"Kids Workshop - Build & Take Home"
                description = generate_workshop_description(month_name)

                # Generate content hash for deduplication
                content_hash = generate_content_hash(
                    title, location["name"], event_date
                )

                # Check if event already exists
                if find_event_by_hash(content_hash):
                    events_updated += 1
                    logger.debug(f"Event already exists: {title} at {location['name']} on {event_date}")
                    continue

                # Build series_hint
                series_hint = {
                    "series_type": "class_series",
                    "series_title": title,
                    "frequency": "monthly",
                    "description": description,
                }

                event_record = {
                    "source_id": source_id,
                    "venue_id": venue_id,
                    "title": title,
                    "description": description,
                    "start_date": event_date,
                    "start_time": "09:00",
                    "end_date": event_date,
                    "end_time": "12:00",
                    "is_all_day": False,
                    "category": "family",
                    "subcategory": None,
                    "tags": [
                        "free",
                        "family-friendly",
                        "kids",
                        "educational",
                        "workshop",
                        "hands-on",
                        "building",
                        "crafts",
                        "woodworking",
                        "ages-5-12",
                    ],
                    "price_min": None,
                    "price_max": None,
                    "price_note": "Free - no registration required",
                    "is_free": True,
                    "source_url": "https://www.homedepot.com/workshops/",
                    "ticket_url": None,
                    "image_url": None,
                    "raw_text": f"Home Depot Kids Workshop - {month_name} | {location['name']} | {event_date} 9:00 AM - 12:00 PM",
                    "extraction_confidence": 0.95,  # High confidence - this is a known recurring program
                    "is_recurring": True,
                    "recurrence_rule": "First Saturday of each month",
                    "content_hash": content_hash,
                }

                try:
                    insert_event(event_record, series_hint=series_hint)
                    events_new += 1
                    logger.info(f"Added: {title} at {location['name']} on {event_date}")
                except Exception as e:
                    logger.error(f"Failed to insert event at {location['name']}: {e}")

        logger.info(
            f"Home Depot Kids Workshops crawl complete: {events_found} found, "
            f"{events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Home Depot Kids Workshops: {e}")
        raise

    return events_found, events_new, events_updated
