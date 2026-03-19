"""
Crawler for Sanctuary Nightclub (sanctuarynightclub.com).
Atlanta's longest-running Latin nightclub (est. 1993).
Relocated from Buckhead to Alpharetta in Jan 2026.

Generates recurring Latin nights: Friday (weekly) + Saturday (1st/3rd/5th).
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta

from db import (
    get_or_create_venue,
    insert_event,
    find_existing_event_for_insert,
    smart_update_existing_event,
)
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://www.sanctuarynightclub.com"
WEEKS_AHEAD = 6

VENUE_DATA = {
    "name": "Sanctuary Nightclub",
    "slug": "sanctuary-nightclub",
    "address": "10595 Old Alabama Rd Connector",
    "neighborhood": "Alpharetta",
    "city": "Alpharetta",
    "state": "GA",
    "zip": "30022",
    "lat": 34.0510,
    "lng": -84.2700,
    "venue_type": "nightclub",
    "spot_type": "nightclub",
    "website": BASE_URL,
    "description": (
        "Atlanta's longest-running Latin nightclub, established 1993. "
        "Weekly Latin Fridays (Viernes Tropicales) with salsa, bachata, merengue, "
        "Latin pop, and reggaeton. Beginner salsa and bachata lesson included. "
        "Full bar, free parking, 21+."
    ),
    "vibes": ["latin", "salsa", "bachata", "dancing", "late-night", "nightclub"],
}

WEEKLY_SCHEDULE = [
    {
        "day": 4,  # Friday
        "title": "Viernes Tropicales at Sanctuary",
        "description": (
            "Latin Fridays at Sanctuary Nightclub — Atlanta's longest-running Latin night. "
            "Salsa, bachata, merengue, Latin pop, and reggaeton. "
            "Free beginner salsa & bachata lesson early in the evening. "
            "Full bar, free parking. 21+."
        ),
        "start_time": "22:00",
        "category": "nightlife",
        "subcategory": "nightlife.latin_night",
        "tags": ["latin", "salsa", "bachata", "dancing", "nightlife", "weekly", "21+"],
        "every_week": True,
    },
    {
        "day": 5,  # Saturday (1st, 3rd, 5th only)
        "title": "Tropical Elegance Saturday at Sanctuary",
        "description": (
            "Tropical Elegance Saturday at Sanctuary Nightclub. "
            "Latin night on the 1st, 3rd, and 5th Saturday of each month. "
            "Salsa, bachata, merengue, and Latin beats. 21+."
        ),
        "start_time": "22:00",
        "category": "nightlife",
        "subcategory": "nightlife.latin_night",
        "tags": ["latin", "salsa", "bachata", "dancing", "nightlife", "21+"],
        "every_week": False,  # 1st, 3rd, 5th Saturdays only
    },
]

DAY_CODES = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"]
DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]


def get_next_weekday(start_date: datetime, weekday: int) -> datetime:
    days_ahead = weekday - start_date.weekday()
    if days_ahead < 0:
        days_ahead += 7
    return start_date + timedelta(days=days_ahead)


def _is_nth_weekday_of_month(dt: datetime, allowed: tuple[int, ...] = (1, 3, 5)) -> bool:
    """Check if dt is the 1st, 3rd, or 5th occurrence of its weekday in the month."""
    day = dt.day
    occurrence = (day - 1) // 7 + 1
    return occurrence in allowed


def crawl(source: dict) -> tuple[int, int, int]:
    """Generate recurring Latin night events for Sanctuary Nightclub."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    venue_id = get_or_create_venue(VENUE_DATA)
    logger.info(f"Sanctuary Nightclub venue record ensured (ID: {venue_id})")

    today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)

    for template in WEEKLY_SCHEDULE:
        next_date = get_next_weekday(today, template["day"])
        day_code = DAY_CODES[template["day"]]
        day_name = DAY_NAMES[template["day"]]

        series_hint = {
            "series_type": "recurring_show",
            "series_title": template["title"],
            "frequency": "weekly" if template.get("every_week") else "monthly",
            "day_of_week": day_name.lower(),
            "description": template["description"],
        }

        for week in range(WEEKS_AHEAD):
            event_date = next_date + timedelta(weeks=week)

            # Skip non-qualifying Saturdays (only 1st, 3rd, 5th)
            if not template.get("every_week") and not _is_nth_weekday_of_month(event_date):
                continue

            start_date = event_date.strftime("%Y-%m-%d")
            events_found += 1

            content_hash = generate_content_hash(
                template["title"], VENUE_DATA["name"], start_date
            )

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
                "is_free": False,
                "price_min": None,
                "price_max": None,
                "source_url": BASE_URL,
                "ticket_url": None,
                "image_url": None,
                "raw_text": f"{template['title']} - {start_date}",
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
        f"Sanctuary Nightclub crawl complete: {events_found} found, "
        f"{events_new} new, {events_updated} updated"
    )
    return events_found, events_new, events_updated
