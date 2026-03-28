"""
Crawler for Grant Park Conservancy (grantpark.org).
Nonprofit organization managing Atlanta's oldest park (est. 1882).
Hosts regular volunteer workdays, restoration events, and community programming.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime, timedelta
from typing import Optional

import requests
from bs4 import BeautifulSoup

from db import get_or_create_place, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash
from entity_lanes import SourceEntityCapabilities, TypedEntityEnvelope
from entity_persistence import persist_typed_entity_envelope

logger = logging.getLogger(__name__)

BASE_URL = "https://grantpark.org"

SOURCE_ENTITY_CAPABILITIES = SourceEntityCapabilities(
    events=True,
    destinations=True,
    destination_details=True,
    venue_features=True,
)

PLACE_DATA = {
    "name": "Grant Park",
    "slug": "grant-park",
    "address": "625 Park Ave SE",
    "neighborhood": "Grant Park",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30312",
    "lat": 33.7360,
    "lng": -84.3700,
    "venue_type": "park",
    "spot_type": "park",
    "website": BASE_URL,
    "description": "Atlanta's oldest park (est. 1882), 80+ acres with walking trails, playgrounds, and community programming.",
}

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
}


def _build_destination_envelope(venue_id: int) -> TypedEntityEnvelope:
    envelope = TypedEntityEnvelope()

    envelope.add(
        "destination_details",
        {
            "venue_id": venue_id,
            "destination_type": "park",
            "commitment_tier": "halfday",
            "primary_activity": "family park visit",
            "best_seasons": ["spring", "summer", "fall"],
            "weather_fit_tags": ["outdoor", "free-option", "family-daytrip"],
            "practical_notes": (
                "Grant Park's large historic footprint works well for playground time, open-lawn hangouts, "
                "and stroller-friendly family loops without requiring a ticketed attraction. It works best as a "
                "flexible free park stop where families can linger, reset, and move between play and picnic time."
            ),
            "accessibility_notes": (
                "Open lawns and path-style circulation are the easiest way to use the park with strollers or "
                "mobility needs; trail and festival surfaces vary by weather and setup. Shade and lawn space make it easier "
                "to stretch the visit without turning it into a high-friction outing."
            ),
            "best_time_of_day": "morning",
            "family_suitability": "yes",
            "reservation_required": False,
            "permit_required": False,
            "fee_note": "Open park access is free; events and festivals vary by season.",
            "source_url": BASE_URL,
            "metadata": {
                "source_type": "family_destination_enrichment",
                "acreage": 80,
                "city": "atlanta",
            },
        },
    )

    envelope.add(
        "venue_features",
        {
            "venue_id": venue_id,
            "slug": "playgrounds-and-open-green-space",
            "title": "Playgrounds and open green space",
            "feature_type": "amenity",
            "description": "Grant Park combines playground access with broad open green space, making it a reliable free family park option in the city core.",
            "url": BASE_URL,
            "is_free": True,
            "sort_order": 10,
        },
    )

    envelope.add(
        "venue_features",
        {
            "venue_id": venue_id,
            "slug": "walking-trails-and-family-park-loops",
            "title": "Walking trails and family park loops",
            "feature_type": "experience",
            "description": "Walking trails and a large historic-park footprint make Grant Park useful for stroller loops, casual outdoor time, and pairing with nearby family outings.",
            "url": BASE_URL,
            "is_free": True,
            "sort_order": 20,
        },
    )

    envelope.add(
        "venue_features",
        {
            "venue_id": venue_id,
            "slug": "picnic-lawns-and-family-spread-out-space",
            "title": "Picnic lawns and family spread-out space",
            "feature_type": "amenity",
            "description": "Grant Park's broad lawns and flexible open space make it useful for blankets, snack breaks, and low-cost family hang time between playground laps.",
            "url": BASE_URL,
            "is_free": True,
            "sort_order": 30,
        },
    )
    envelope.add(
        "venue_features",
        {
            "venue_id": venue_id,
            "slug": "flexible-free-park-reset-stop",
            "title": "Flexible free park reset stop",
            "feature_type": "amenity",
            "description": "Grant Park is especially useful when families want a free city-core outdoor stop with room for snacks, shade, and looser pacing between bigger destinations.",
            "url": BASE_URL,
            "is_free": True,
            "sort_order": 40,
        },
    )

    return envelope


def get_second_saturday(year: int, month: int) -> datetime:
    """Get the second Saturday of a given month (typical volunteer day)."""
    first_day = datetime(year, month, 1)
    days_until_saturday = (5 - first_day.weekday()) % 7
    first_saturday = first_day + timedelta(days=days_until_saturday)
    second_saturday = first_saturday + timedelta(days=7)
    return second_saturday


def create_volunteer_workdays(source_id: int, venue_id: int) -> tuple[int, int]:
    """Create recurring volunteer workday events (Project G.R.A.N.T.)."""
    events_new = 0
    events_updated = 0
    now = datetime.now()

    # Generate next 4 months of volunteer days
    for i in range(4):
        month = now.month + i
        year = now.year
        if month > 12:
            month -= 12
            year += 1

        workday_date = get_second_saturday(year, month)

        # Skip if already passed
        if workday_date.date() < now.date():
            continue

        title = "Project G.R.A.N.T. Volunteer Workday"
        start_date = workday_date.strftime("%Y-%m-%d")

        content_hash = generate_content_hash(title, "Grant Park", start_date)


        description = (
            "Join the Grant Park Conservancy for monthly volunteer workdays! "
            "Help with park beautification, invasive species removal, planting, "
            "and general restoration work. All skill levels welcome. "
            "Tools and training provided."
        )

        event_record = {
            "source_id": source_id,
            "venue_id": venue_id,
            "title": title,
            "description": description,
            "start_date": start_date,
            "start_time": "09:00",
            "end_date": None,
            "end_time": "12:00",
            "is_all_day": False,
            "category": "community",
            "subcategory": None,
            "tags": ["grant-park", "volunteer", "conservation", "outdoor", "family-friendly"],
            "price_min": None,
            "price_max": None,
            "price_note": None,
            "is_free": True,
            "source_url": BASE_URL,
            "ticket_url": None,
            "image_url": None,
            "raw_text": None,
            "extraction_confidence": 0.85,
            "is_recurring": True,
            "recurrence_rule": "FREQ=MONTHLY;BYDAY=2SA",
            "content_hash": content_hash,
        }

        existing = find_event_by_hash(content_hash)
        if existing:
            smart_update_existing_event(existing, event_record)
            events_updated += 1
            continue

        series_hint = {
            "series_type": "recurring_show",
            "series_title": title,
            "frequency": "monthly",
            "day_of_week": "Saturday",
            "description": description,
        }

        try:
            insert_event(event_record, series_hint=series_hint)
            events_new += 1
            logger.info(f"Added: {title} on {start_date}")
        except Exception as e:
            logger.error(f"Failed to insert workday: {e}")

    return events_new, events_updated


def parse_date(date_str: str) -> Optional[str]:
    """Parse date from various formats."""
    date_str = date_str.strip()
    now = datetime.now()

    formats = [
        "%B %d, %Y",
        "%b %d, %Y",
        "%m/%d/%Y",
    ]

    for fmt in formats:
        try:
            dt = datetime.strptime(date_str, fmt)
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            continue

    match = re.search(
        r"(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})",
        date_str,
        re.IGNORECASE
    )
    if match:
        month_str = match.group(1)[:3]
        day = match.group(2)
        try:
            dt = datetime.strptime(f"{month_str} {day} {now.year}", "%b %d %Y")
            if dt.date() < now.date():
                dt = dt.replace(year=now.year + 1)
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            pass

    return None


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Grant Park Conservancy events."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    venue_id = get_or_create_place(PLACE_DATA)
    persist_typed_entity_envelope(_build_destination_envelope(venue_id))

    # Create recurring volunteer workdays
    workday_new, workday_updated = create_volunteer_workdays(source_id, venue_id)
    events_found += 4
    events_new += workday_new
    events_updated += workday_updated

    try:
        # Try to fetch info/events page
        for path in ["/info/61117", "/events", "/calendar", ""]:
            try:
                url = BASE_URL + path
                response = requests.get(url, headers=HEADERS, timeout=30)
                if response.status_code != 200:
                    continue

                soup = BeautifulSoup(response.text, "html.parser")

                # Look for event elements
                event_elements = soup.select(".event, .calendar-event, article, [class*='event']")

                for element in event_elements:
                    try:
                        title_elem = element.find(["h2", "h3", "h4", "a"])
                        if not title_elem:
                            continue
                        title = title_elem.get_text(strip=True)
                        if not title or len(title) < 3:
                            continue

                        # Skip workdays (already handled)
                        if "volunteer" in title.lower() or "g.r.a.n.t" in title.lower():
                            continue
                        # Skip Summer Shade (handled by separate crawler)
                        if "summer shade" in title.lower():
                            continue

                        text = element.get_text()
                        date_match = re.search(
                            r"(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}",
                            text,
                            re.IGNORECASE
                        )
                        if not date_match:
                            continue

                        start_date = parse_date(date_match.group())
                        if not start_date:
                            continue

                        if datetime.strptime(start_date, "%Y-%m-%d").date() < datetime.now().date():
                            continue

                        events_found += 1

                        content_hash = generate_content_hash(title, "Grant Park", start_date)

                        existing = find_event_by_hash(content_hash)
                        if existing:
                            smart_update_existing_event(existing, event_record)
                            events_updated += 1
                            continue

                        # Determine category
                        title_lower = title.lower()
                        if "run" in title_lower or "5k" in title_lower:
                            category, subcategory = "fitness", None
                            tags = ["grant-park", "running", "5k"]
                        elif "concert" in title_lower or "music" in title_lower:
                            category, subcategory = "music", "live"
                            tags = ["grant-park", "live-music", "outdoor"]
                        elif "movie" in title_lower or "film" in title_lower:
                            category, subcategory = "film", "screening"
                            tags = ["grant-park", "outdoor-movie"]
                        else:
                            category, subcategory = "community", None
                            tags = ["grant-park", "community"]

                        event_record = {
                            "source_id": source_id,
                            "venue_id": venue_id,
                            "title": title,
                            "description": f"Event at Grant Park, Atlanta's oldest park",
                            "start_date": start_date,
                            "start_time": None,
                            "end_date": None,
                            "end_time": None,
                            "is_all_day": True,
                            "category": category,
                            "subcategory": subcategory,
                            "tags": tags,
                            "price_min": None,
                            "price_max": None,
                            "price_note": None,
                            "is_free": True,
                            "source_url": url,
                            "ticket_url": None,
                            "image_url": None,
                            "raw_text": text[:500],
                            "extraction_confidence": 0.70,
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

                    except Exception as e:
                        logger.debug(f"Error parsing event: {e}")
                        continue

                break

            except requests.RequestException:
                continue

        logger.info(f"Grant Park Conservancy crawl complete: {events_found} found, {events_new} new, {events_updated} updated")

    except Exception as e:
        logger.error(f"Failed to crawl Grant Park Conservancy: {e}")

    return events_found, events_new, events_updated
