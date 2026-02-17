"""
Crawler for Wild Bill's (wildbillsatlanta.com).

Duluth country bar featuring line dancing, two-step lessons, and country nights.
Major Atlanta metro destination for country music and line dancing.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta

from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://www.wildbillsatlanta.com"

VENUE_DATA = {
    "name": "Wild Bill's",
    "slug": "wild-bills",
    "address": "2075 Market St",
    "neighborhood": "Duluth",
    "city": "Duluth",
    "state": "GA",
    "zip": "30096",
    "lat": 33.9761,
    "lng": -84.1442,
    "venue_type": "nightclub",
    "spot_type": "nightclub",
    "website": BASE_URL,
    "vibes": ["country", "line-dancing", "two-step", "honky-tonk", "dance-club"],
}

# Weekly recurring events at Wild Bill's
WEEKLY_SCHEDULE = [
    (
        2,  # Wednesday
        "Line Dancing Lessons at Wild Bill's",
        "20:00",
        "Free line dancing lessons every Wednesday! Learn classic country line dances from experienced instructors. Perfect for beginners. Stay for dancing after the lesson.",
        "nightlife.line_dancing",
        ["line-dancing"],
        ["line-dancing", "dance-lessons", "country", "free", "21+"],
    ),
    (
        4,  # Friday
        "Friday Night Country at Wild Bill's",
        "21:00",
        "Friday night country party! Live DJs spinning country hits, line dancing all night. Large dance floor with experienced dancers and welcoming atmosphere for all levels.",
        "nightlife.line_dancing",
        ["line-dancing", "dance-party"],
        ["line-dancing", "country", "dance-party", "21+", "high-energy"],
    ),
    (
        5,  # Saturday
        "Saturday Night Two-Step",
        "21:00",
        "Saturday night two-step and line dancing! DJs playing classic and modern country. Couples and singles welcome. Atlanta's premier country dance destination.",
        "nightlife.line_dancing",
        ["line-dancing", "dance-party"],
        ["line-dancing", "two-step", "country", "dance-party", "21+", "date-night"],
    ),
]


def get_next_weekday(start_date: datetime, weekday: int) -> datetime:
    """Get the next occurrence of a weekday from start_date."""
    days_ahead = weekday - start_date.weekday()
    if days_ahead < 0:
        days_ahead += 7
    return start_date + timedelta(days=days_ahead)


def crawl(source: dict) -> tuple[int, int, int]:
    """Generate Wild Bill's events for upcoming weeks."""
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


                is_free = "free" in tags
                price_note = "Free lessons, cover charge for dancing" if "lessons" in title.lower() else "Cover charge varies"

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
                    "price_min": None if is_free else 5,
                    "price_max": None if is_free else 15,
                    "price_note": price_note,
                    "is_free": is_free,
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
            f"Wild Bill's crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Wild Bill's: {e}")
        raise

    return events_found, events_new, events_updated
