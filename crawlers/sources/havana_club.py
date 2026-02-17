"""
Crawler for Havana Club (havanaclubatl.com).

Buckhead Latin nightclub featuring salsa, bachata, and reggaeton nights.
Premier destination for Latin dancing and nightlife in Atlanta.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta

from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://www.havanaclubatl.com"

VENUE_DATA = {
    "name": "Havana Club",
    "slug": "havana-club",
    "address": "247 Buckhead Ave NE",
    "neighborhood": "Buckhead",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30305",
    "lat": 33.8343,
    "lng": -84.3686,
    "venue_type": "nightclub",
    "spot_type": "nightclub",
    "website": BASE_URL,
    "vibes": ["latin-dance", "salsa", "bachata", "upscale", "dance-club"],
}

# Weekly recurring events at Havana Club
WEEKLY_SCHEDULE = [
    (
        3,  # Thursday
        "Salsa Night at Havana Club",
        "21:00",
        "Salsa Thursday! Live salsa music and DJs spinning classic and modern salsa. Free salsa lessons at 9 PM. Atlanta's premier Latin dance night with professional dancers and welcoming atmosphere.",
        "nightlife.latin_night",
        ["latin-night", "dance-party"],
        ["latin-night", "salsa", "dance-party", "21+", "live-music", "dance-lessons"],
    ),
    (
        5,  # Saturday
        "Bachata & Reggaeton Night",
        "22:00",
        "Saturday night Latin party! DJs spinning bachata, reggaeton, and dembow. Multi-level dance floor with premium bottle service. Dress code enforced.",
        "nightlife.latin_night",
        ["latin-night", "dance-party"],
        ["latin-night", "bachata", "reggaeton", "dance-party", "21+", "high-energy", "upscale"],
    ),
]


def get_next_weekday(start_date: datetime, weekday: int) -> datetime:
    """Get the next occurrence of a weekday from start_date."""
    days_ahead = weekday - start_date.weekday()
    if days_ahead < 0:
        days_ahead += 7
    return start_date + timedelta(days=days_ahead)


def crawl(source: dict) -> tuple[int, int, int]:
    """Generate Havana Club events for upcoming weeks."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    # Generate events for next 6 weeks
    today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    weeks_ahead = 6

    try:
        # Get or create venue
        venue_id = get_or_create_venue(VENUE_DATA)

        for day_of_week, title, time_24h, description, subcategory, genres, tags in WEEKLY_SCHEDULE:
            # Generate events for each week
            for week in range(weeks_ahead):
                event_date = get_next_weekday(today + timedelta(weeks=week), day_of_week)

                # Skip if in the past
                if event_date < today:
                    continue

                start_date = event_date.strftime("%Y-%m-%d")
                events_found += 1

                content_hash = generate_content_hash(
                    title, VENUE_DATA["name"], start_date
                )


                event_record = {
                    "source_id": source_id,
                    "venue_id": venue_id,
                    "title": title,
                    "description": description,
                    "start_date": start_date,
                    "start_time": time_24h,
                    "end_date": None,
                    "end_time": None,
                    "is_all_day": False,
                    "category": "nightlife",
                    "subcategory": subcategory,
                    "genres": genres,
                    "tags": tags,
                    "price_min": 10,
                    "price_max": 20,
                    "price_note": "Cover charge varies, ladies free before 11 PM",
                    "is_free": False,
                    "source_url": BASE_URL,
                    "ticket_url": None,
                    "image_url": None,
                    "raw_text": f"{title} - {start_date}",
                    "extraction_confidence": 0.90,
                    "is_recurring": True,
                    "recurrence_rule": f"FREQ=WEEKLY;BYDAY={['MO','TU','WE','TH','FR','SA','SU'][day_of_week]}",
                    "content_hash": content_hash,
                }

                existing = find_event_by_hash(content_hash)
                if existing:
                    smart_update_existing_event(existing, event_record)
                    events_updated += 1
                    continue

                day_names = [
                    "Monday",
                    "Tuesday",
                    "Wednesday",
                    "Thursday",
                    "Friday",
                    "Saturday",
                    "Sunday",
                ]
                series_hint = {
                    "series_type": "recurring_show",
                    "series_title": title,
                    "frequency": "weekly",
                    "day_of_week": day_names[day_of_week],
                    "description": description,
                }

                try:
                    insert_event(event_record, series_hint=series_hint)
                    events_new += 1
                    logger.info(f"Added: {title} on {start_date}")
                except Exception as e:
                    logger.error(f"Failed to insert: {title}: {e}")

        logger.info(
            f"Havana Club crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Havana Club: {e}")
        raise

    return events_found, events_new, events_updated
