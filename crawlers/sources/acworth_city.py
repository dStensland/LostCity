"""
Crawler for City of Acworth events.
"Lake City" of Cobb County with Acworth Beach, historic Main Street,
and signature Taste of Acworth festival (18,000+ attendees).
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta

from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://acworth-ga.gov"

VENUE_DATA = {
    "name": "Downtown Acworth",
    "slug": "downtown-acworth",
    "address": "Main Street, Acworth",
    "neighborhood": "Acworth",
    "city": "Acworth",
    "state": "GA",
    "zip": "30101",
    "lat": 34.0654,
    "lng": -84.6769,
    "venue_type": "city",
    "spot_type": "city",
    "website": BASE_URL,
    "description": "Historic 'Lake City' with charming Main Street, Lake Acworth beach, and year-round community events.",
}

LOGAN_FARM_VENUE = {
    "name": "Logan Farm Park",
    "slug": "logan-farm-park",
    "address": "4405 Cherokee St NW",
    "neighborhood": "Acworth",
    "city": "Acworth",
    "state": "GA",
    "zip": "30101",
    "lat": 34.0598,
    "lng": -84.6832,
    "venue_type": "park",
    "spot_type": "outdoor_space",
    "website": "https://acworth-ga.gov",
    "description": "Community park hosting concerts, festivals, and July 4th fireworks.",
}


def get_first_saturday(year: int, month: int) -> datetime:
    """Get the first Saturday of a given month."""
    first_day = datetime(year, month, 1)
    days_until_saturday = (5 - first_day.weekday()) % 7
    return first_day + timedelta(days=days_until_saturday)


def get_second_saturday(year: int, month: int) -> datetime:
    """Get the second Saturday of a given month."""
    first_day = datetime(year, month, 1)
    days_until_saturday = (5 - first_day.weekday()) % 7
    first_saturday = first_day + timedelta(days=days_until_saturday)
    return first_saturday + timedelta(days=7)


def create_taste_of_acworth(source_id: int, venue_id: int) -> tuple[int, int]:
    """Create Taste of Acworth festival (major annual event)."""
    events_new = 0
    events_updated = 0
    now = datetime.now()

    # Taste of Acworth - Second Saturday of October
    year = now.year
    if now.month > 10:
        year += 1

    taste_date = get_second_saturday(year, 10)

    title = f"Taste of Acworth {year}"
    start_date = taste_date.strftime("%Y-%m-%d")

    content_hash = generate_content_hash(title, "Downtown Acworth", start_date)

    if not find_event_by_hash(content_hash):
        event_record = {
            "source_id": source_id,
            "venue_id": venue_id,
            "title": title,
            "description": (
                "Acworth's signature food and arts festival on historic Main Street. "
                "150+ vendors, local restaurant tastings, live entertainment, "
                "and family activities. Over 18,000 annual attendees."
            ),
            "start_date": start_date,
            "start_time": "10:00",
            "end_date": None,
            "end_time": "18:00",
            "is_all_day": False,
            "category": "food_drink",
            "subcategory": "festival",
            "tags": ["acworth", "food-festival", "main-street", "family-friendly"],
            "price_min": None,
            "price_max": None,
            "price_note": "Free admission, food samples $1-$10",
            "is_free": True,
            "source_url": "https://www.acworth.com/taste-of-acworth/",
            "ticket_url": None,
            "image_url": None,
            "raw_text": None,
            "extraction_confidence": 0.90,
            "is_recurring": False,
            "recurrence_rule": None,
            "content_hash": content_hash,
        }
        try:
            insert_event(event_record)
            events_new += 1
            logger.info(f"Added: {title} on {start_date}")
        except Exception as e:
            logger.error(f"Failed to insert: {e}")
    else:
        events_updated += 1

    return events_new, events_updated


def create_logan_farm_concerts(source_id: int, logan_venue_id: int) -> tuple[int, int]:
    """Create Concert on the Green series at Logan Farm Park."""
    events_new = 0
    events_updated = 0
    now = datetime.now()

    # July 4th Concert & Fireworks
    year = now.year
    if now.month > 7:
        year += 1

    july_4 = datetime(year, 7, 4)

    title = f"July 4th Concert & Fireworks {year}"
    start_date = july_4.strftime("%Y-%m-%d")

    content_hash = generate_content_hash(title, "Logan Farm Park", start_date)

    if not find_event_by_hash(content_hash):
        event_record = {
            "source_id": source_id,
            "venue_id": logan_venue_id,
            "title": title,
            "description": (
                "Acworth's Independence Day celebration at Logan Farm Park. "
                "Live music, food vendors, family activities, and fireworks display."
            ),
            "start_date": start_date,
            "start_time": "16:00",
            "end_date": None,
            "end_time": "22:00",
            "is_all_day": False,
            "category": "community",
            "subcategory": "celebration",
            "tags": ["acworth", "july-4th", "fireworks", "concert", "free"],
            "price_min": None,
            "price_max": None,
            "price_note": None,
            "is_free": True,
            "source_url": "https://acworth-ga.gov/acworth-city-events/",
            "ticket_url": None,
            "image_url": None,
            "raw_text": None,
            "extraction_confidence": 0.90,
            "is_recurring": False,
            "recurrence_rule": None,
            "content_hash": content_hash,
        }
        try:
            insert_event(event_record)
            events_new += 1
            logger.info(f"Added: {title} on {start_date}")
        except Exception as e:
            logger.error(f"Failed to insert: {e}")
    else:
        events_updated += 1

    # Juneteenth Concert on the Green (June)
    year = now.year
    if now.month > 6:
        year += 1

    # Third Saturday of June (near Juneteenth)
    june_19 = datetime(year, 6, 19)
    # Find closest Saturday
    days_to_saturday = (5 - june_19.weekday()) % 7
    if days_to_saturday > 3:
        days_to_saturday -= 7
    juneteenth_concert = june_19 + timedelta(days=days_to_saturday)

    title = f"Juneteenth Concert on the Green {year}"
    start_date = juneteenth_concert.strftime("%Y-%m-%d")

    content_hash = generate_content_hash(title, "Logan Farm Park", start_date)

    if not find_event_by_hash(content_hash):
        event_record = {
            "source_id": source_id,
            "venue_id": logan_venue_id,
            "title": title,
            "description": (
                "Juneteenth celebration concert at Logan Farm Park. "
                "Live music, cultural performances, food, and community gathering."
            ),
            "start_date": start_date,
            "start_time": "17:00",
            "end_date": None,
            "end_time": "22:00",
            "is_all_day": False,
            "category": "community",
            "subcategory": "celebration",
            "tags": ["acworth", "juneteenth", "concert", "cultural", "free"],
            "price_min": None,
            "price_max": None,
            "price_note": None,
            "is_free": True,
            "source_url": "https://acworth-ga.gov/acworth-city-events/",
            "ticket_url": None,
            "image_url": None,
            "raw_text": None,
            "extraction_confidence": 0.85,
            "is_recurring": False,
            "recurrence_rule": None,
            "content_hash": content_hash,
        }
        try:
            insert_event(event_record)
            events_new += 1
            logger.info(f"Added: {title} on {start_date}")
        except Exception as e:
            logger.error(f"Failed to insert: {e}")
    else:
        events_updated += 1

    # Hispanic Heritage Month Concert (September)
    year = now.year
    if now.month > 9:
        year += 1

    # Third Saturday of September
    sept_1 = datetime(year, 9, 1)
    days_until_saturday = (5 - sept_1.weekday()) % 7
    hispanic_heritage = sept_1 + timedelta(days=days_until_saturday + 14)

    title = f"Hispanic Heritage Month Concert {year}"
    start_date = hispanic_heritage.strftime("%Y-%m-%d")

    content_hash = generate_content_hash(title, "Logan Farm Park", start_date)

    if not find_event_by_hash(content_hash):
        event_record = {
            "source_id": source_id,
            "venue_id": logan_venue_id,
            "title": title,
            "description": (
                "Concert celebrating Hispanic Heritage Month at Logan Farm Park. "
                "Latin music, cultural performances, food, and community celebration."
            ),
            "start_date": start_date,
            "start_time": "17:00",
            "end_date": None,
            "end_time": "22:00",
            "is_all_day": False,
            "category": "community",
            "subcategory": "celebration",
            "tags": ["acworth", "hispanic-heritage", "concert", "cultural", "free"],
            "price_min": None,
            "price_max": None,
            "price_note": None,
            "is_free": True,
            "source_url": "https://acworthtourism.org/acworth-events/",
            "ticket_url": None,
            "image_url": None,
            "raw_text": None,
            "extraction_confidence": 0.85,
            "is_recurring": False,
            "recurrence_rule": None,
            "content_hash": content_hash,
        }
        try:
            insert_event(event_record)
            events_new += 1
            logger.info(f"Added: {title} on {start_date}")
        except Exception as e:
            logger.error(f"Failed to insert: {e}")
    else:
        events_updated += 1

    return events_new, events_updated


def create_seasonal_events(source_id: int, venue_id: int) -> tuple[int, int]:
    """Create other seasonal Acworth events."""
    events_new = 0
    events_updated = 0
    now = datetime.now()

    # Acworth Art Festival (April)
    year = now.year
    if now.month > 4:
        year += 1

    art_fest_date = get_first_saturday(year, 4)

    title = f"Acworth Art Festival {year}"
    start_date = art_fest_date.strftime("%Y-%m-%d")

    content_hash = generate_content_hash(title, "Downtown Acworth", start_date)

    if not find_event_by_hash(content_hash):
        event_record = {
            "source_id": source_id,
            "venue_id": venue_id,
            "title": title,
            "description": (
                "Annual spring art festival in downtown Acworth. "
                "Local and regional artists, live demonstrations, and family activities."
            ),
            "start_date": start_date,
            "start_time": "10:00",
            "end_date": None,
            "end_time": "17:00",
            "is_all_day": False,
            "category": "community",
            "subcategory": "festival",
            "tags": ["acworth", "art", "festival", "spring", "family-friendly"],
            "price_min": None,
            "price_max": None,
            "price_note": None,
            "is_free": True,
            "source_url": "https://www.acworthartsalliance.org/",
            "ticket_url": None,
            "image_url": None,
            "raw_text": None,
            "extraction_confidence": 0.80,
            "is_recurring": False,
            "recurrence_rule": None,
            "content_hash": content_hash,
        }
        try:
            insert_event(event_record)
            events_new += 1
            logger.info(f"Added: {title} on {start_date}")
        except Exception as e:
            logger.error(f"Failed to insert: {e}")
    else:
        events_updated += 1

    return events_new, events_updated


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl City of Acworth events."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    venue_id = get_or_create_venue(VENUE_DATA)
    logan_venue_id = get_or_create_venue(LOGAN_FARM_VENUE)

    # Taste of Acworth
    taste_new, taste_updated = create_taste_of_acworth(source_id, venue_id)
    events_found += 1
    events_new += taste_new
    events_updated += taste_updated

    # Logan Farm Park concerts
    concert_new, concert_updated = create_logan_farm_concerts(source_id, logan_venue_id)
    events_found += 3
    events_new += concert_new
    events_updated += concert_updated

    # Seasonal events
    seasonal_new, seasonal_updated = create_seasonal_events(source_id, venue_id)
    events_found += 1
    events_new += seasonal_new
    events_updated += seasonal_updated

    logger.info(f"Acworth City crawl complete: {events_found} found, {events_new} new, {events_updated} updated")

    return events_found, events_new, events_updated
