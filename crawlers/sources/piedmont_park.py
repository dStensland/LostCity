"""
Crawler for Piedmont Park Conservancy (piedmontpark.org).

Uses The Events Calendar REST API to fetch event data.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime, timedelta
from typing import Optional
import httpx

from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event, find_existing_event_for_insert
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://www.piedmontpark.org"
API_URL = "https://piedmontpark.org/wp-json/tribe/events/v1/events"

VENUE_DATA = {
    "name": "Piedmont Park",
    "slug": "piedmont-park",
    "address": "1320 Monroe Dr NE",
    "neighborhood": "Midtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30306",
    "lat": 33.7875,
    "lng": -84.3733,
    "venue_type": "park",
    "spot_type": "outdoor",
    "website": BASE_URL,
}

WEEKS_AHEAD = 6
DAY_CODES = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"]
DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

RECURRING_SCHEDULE = [
    {
        "day": 1,
        "title": "Piedmont Park Walking Club",
        "start_time": "10:00",
        "description": "Tuesday morning guided walk through Piedmont Park led by Conservancy staff. 45 minutes, meets at Dockside. Free, all ages and fitness levels welcome.",
        "category": "fitness",
        "subcategory": "fitness.walking",
        "tags": ["walking", "free", "outdoor", "morning", "weekly"],
        "is_free": True,
    },
    {
        "day": 4,
        "title": "Piedmont Park Pickleball Open Play",
        "start_time": "17:00",
        "description": "Friday open pickleball at the Sharon Lester Tennis & Pickleball Center in Piedmont Park. 5-9pm, free, 2.5+ skill level.",
        "category": "sports",
        "subcategory": "sports.pickleball",
        "tags": ["sports", "pickleball", "free", "outdoor", "pickup", "weekly"],
        "is_free": True,
    },
    {
        "day": 5,
        "title": "Piedmont Park Pickleball Open Play",
        "start_time": "14:00",
        "description": "Saturday open pickleball at the Sharon Lester Tennis & Pickleball Center in Piedmont Park. 2-5pm, free, 2.5+ skill level.",
        "category": "sports",
        "subcategory": "sports.pickleball",
        "tags": ["sports", "pickleball", "free", "outdoor", "pickup", "weekly"],
        "is_free": True,
    },
    {
        "day": 5,
        "title": "Piedmont Park Ultimate Frisbee Pickup",
        "start_time": "10:00",
        "description": "Saturday morning pickup ultimate frisbee at the Active Oval in Piedmont Park. All levels welcome, free, cleats recommended.",
        "category": "sports",
        "subcategory": "sports.pickup_sports",
        "tags": ["sports", "ultimate-frisbee", "free", "outdoor", "pickup", "weekly"],
        "is_free": True,
    },
    {
        "day": 6,
        "title": "Piedmont Park Ultimate Frisbee Pickup",
        "start_time": "10:00",
        "description": "Sunday morning pickup ultimate frisbee at the Active Oval in Piedmont Park. All levels welcome, free, cleats recommended.",
        "category": "sports",
        "subcategory": "sports.pickup_sports",
        "tags": ["sports", "ultimate-frisbee", "free", "outdoor", "pickup", "weekly"],
        "is_free": True,
    },
    {
        "day": 2,
        "title": "Piedmont Park Ultimate Frisbee Pickup",
        "start_time": "18:00",
        "description": "Wednesday evening pickup ultimate frisbee at the Active Oval in Piedmont Park. All levels welcome, free, cleats recommended.",
        "category": "sports",
        "subcategory": "sports.pickup_sports",
        "tags": ["sports", "ultimate-frisbee", "free", "outdoor", "pickup", "weekly"],
        "is_free": True,
    },
    {
        "day": 5,
        "title": "Piedmont Park Pickup Soccer",
        "start_time": "09:00",
        "description": "Saturday morning pickup soccer at Piedmont Park. Free, all skill levels, just show up.",
        "category": "sports",
        "subcategory": "sports.pickup_sports",
        "tags": ["sports", "soccer", "free", "outdoor", "pickup", "weekly"],
        "is_free": True,
    },
]


def _get_next_weekday(start_date: datetime, weekday: int) -> datetime:
    """Return the next occurrence of weekday (0=Monday) on or after start_date."""
    days_ahead = weekday - start_date.weekday()
    if days_ahead < 0:
        days_ahead += 7
    return start_date + timedelta(days=days_ahead)


def _generate_recurring_events(source_id: int, venue_id: int) -> tuple[int, int, int]:
    """Generate recurring weekly events for Piedmont Park."""
    events_found = events_new = events_updated = 0
    today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)

    for template in RECURRING_SCHEDULE:
        next_date = _get_next_weekday(today, template["day"])
        day_code = DAY_CODES[template["day"]]
        day_name = DAY_NAMES[template["day"]]

        series_hint = {
            "series_type": "recurring_show",
            "series_title": template["title"],
            "frequency": "weekly",
            "day_of_week": day_name,
            "description": template["description"],
        }

        for week in range(WEEKS_AHEAD):
            event_date = next_date + timedelta(weeks=week)
            start_date = event_date.strftime("%Y-%m-%d")
            events_found += 1

            content_hash = generate_content_hash(
                template["title"], VENUE_DATA["name"], start_date
            )

            is_free = template.get("is_free", False) or "free" in template["tags"]

            event_record = {
                "source_id": source_id,
                "venue_id": venue_id,
                "title": template["title"],
                "description": template["description"],
                "start_date": start_date,
                "start_time": template["start_time"],
                "end_date": None,
                "end_time": None,
                "is_all_day": False,
                "category": template["category"],
                "subcategory": template.get("subcategory"),
                "tags": template["tags"],
                "is_free": is_free,
                "price_min": None if is_free else template.get("price_min"),
                "price_max": None if is_free else template.get("price_max"),
                "source_url": BASE_URL,
                "ticket_url": None,
                "image_url": None,
                "raw_text": f"{template['title']} at {VENUE_DATA['name']} - {start_date}",
                "extraction_confidence": 0.90,
                "is_recurring": True,
                "recurrence_rule": f"FREQ=WEEKLY;BYDAY={day_code}",
                "content_hash": content_hash,
            }

            existing = find_existing_event_for_insert(event_record)
            if existing:
                smart_update_existing_event(existing, event_record)
                events_updated += 1
                continue

            try:
                insert_event(event_record, series_hint=series_hint)
                events_new += 1
            except Exception as exc:
                logger.error(f"Failed to insert {template['title']} on {start_date}: {exc}")

    logger.info(
        f"Piedmont Park recurring: {events_found} found, {events_new} new, {events_updated} updated"
    )
    return events_found, events_new, events_updated


def parse_datetime(dt_str: str) -> tuple[str, str]:
    """Parse datetime string from API into date and time."""
    # Format: "2026-01-24 08:30:00"
    dt = datetime.strptime(dt_str, "%Y-%m-%d %H:%M:%S")
    return dt.strftime("%Y-%m-%d"), dt.strftime("%H:%M")


def extract_image_from_description(description: str) -> Optional[str]:
    """Extract image URL from HTML description."""
    img_match = re.search(r'<img[^>]+src="([^"]+)"', description)
    if img_match:
        url = img_match.group(1)
        # Convert .webp to .png if needed, or just return the webp
        return url
    return None


def categorize_event(title: str, description: str) -> str:
    """Determine category based on title and description."""
    text = (title + " " + description).lower()

    if any(w in text for w in ["pickleball", "soccer", "ultimate frisbee", "ultimate", "open play", "pickup"]):
        return "sports"
    if any(w in text for w in ["yoga", "fitness", "run", "5k", "race", "walk", "hike"]):
        return "fitness"
    elif any(w in text for w in ["concert", "music", "band", "jazz", "festival"]):
        return "music"
    elif any(w in text for w in ["market", "food", "farmers", "vendor"]):
        return "food_drink"
    elif any(w in text for w in ["art", "gallery", "exhibition", "show"]):
        return "arts"
    elif any(w in text for w in ["movie", "film", "cinema"]):
        return "film"
    elif any(w in text for w in ["kids", "children", "family"]):
        return "family"
    else:
        return "outdoors"


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Piedmont Park events using The Events Calendar REST API."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        venue_id = get_or_create_venue(VENUE_DATA)

        # Fetch events from API - use 50 per page (API's max limit)
        page = 1
        per_page = 50
        total_pages = 1

        while page <= total_pages:
            logger.info(f"Fetching Piedmont Park events (page {page}/{total_pages})")

            response = httpx.get(
                API_URL,
                params={"per_page": per_page, "page": page},
                timeout=30.0,
                follow_redirects=True,
            )
            response.raise_for_status()
            data = response.json()

            # Update total pages from response
            if page == 1:
                total = data.get("total", 0)
                total_pages = (total + per_page - 1) // per_page  # Round up
                logger.info(f"Found {total} total events across {total_pages} pages")

            events = data.get("events", [])

            for event_data in events:
                events_found += 1

                title = event_data.get("title", "").strip()
                if not title:
                    continue

                # Parse dates and times
                start_date_str = event_data.get("start_date")
                end_date_str = event_data.get("end_date")

                if not start_date_str:
                    logger.warning(f"Skipping event without start date: {title}")
                    continue

                start_date, start_time = parse_datetime(start_date_str)
                end_date, end_time = None, None

                if end_date_str:
                    end_date, end_time = parse_datetime(end_date_str)

                # Get description and extract image
                description = event_data.get("description", "")
                # Strip HTML for cleaner description
                description_clean = re.sub(r"<[^>]+>", " ", description)
                description_clean = re.sub(r"\s+", " ", description_clean).strip()

                # Truncate very long descriptions
                if len(description_clean) > 500:
                    description_clean = description_clean[:497] + "..."

                # Extract image
                image_url = extract_image_from_description(description)

                # Get event URL
                source_url = event_data.get("url", "https://piedmontpark.org/calendar/")

                # Determine if free — only mark free if explicitly stated
                cost = event_data.get("cost", "")
                is_free = bool(cost and "free" in cost.lower())

                # Parse cost if present
                price_min, price_max = None, None
                if cost and not is_free:
                    # Try to extract numeric values
                    price_matches = re.findall(r"\$?(\d+(?:\.\d{2})?)", cost)
                    if price_matches:
                        prices = [float(p) for p in price_matches]
                        price_min = min(prices)
                        price_max = max(prices)

                # Check if all-day event
                is_all_day = event_data.get("all_day", False)

                # Determine category
                category = categorize_event(title, description_clean)

                # Generate content hash
                content_hash = generate_content_hash(title, "Piedmont Park", start_date)

                # Check if event exists

                # Build event record
                event_record = {
                    "source_id": source_id,
                    "venue_id": venue_id,
                    "title": title,
                    "description": description_clean if description_clean else "Event at Piedmont Park",
                    "start_date": start_date,
                    "start_time": None if is_all_day else start_time,
                    "end_date": end_date if end_date != start_date else None,
                    "end_time": None if is_all_day else end_time,
                    "is_all_day": is_all_day,
                    "category": category,
                    "subcategory": None,
                    "tags": [
                        "piedmont-park",
                        "midtown",
                        "outdoor",
                        "park",
                        "family-friendly",
                    ],
                    "price_min": price_min,
                    "price_max": price_max,
                    "price_note": cost if cost else None,
                    "is_free": is_free,
                    "source_url": source_url,
                    "ticket_url": source_url,
                    "image_url": image_url,
                    "raw_text": f"{title} - {start_date}",
                    "extraction_confidence": 0.95,  # High confidence from structured API
                    "is_recurring": False,
                    "recurrence_rule": None,
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
                    logger.info(f"Added: {title} on {start_date}")
                except Exception as e:
                    logger.error(f"Failed to insert event '{title}': {e}")

            page += 1

        logger.info(
            f"Piedmont Park crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Piedmont Park: {e}")
        raise

    try:
        f, n, u = _generate_recurring_events(source_id, venue_id)
        events_found += f
        events_new += n
        events_updated += u
    except Exception as e:
        logger.error(f"Failed to generate recurring events: {e}")

    return events_found, events_new, events_updated
