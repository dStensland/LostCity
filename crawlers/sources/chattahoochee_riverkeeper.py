"""
Crawler for Chattahoochee Riverkeeper (chattahoochee.org).
Environmental advocacy organization protecting the Chattahoochee River.
Hosts river cleanups, paddle trips, advocacy events, and educational programs.

Uses the iCal feed (Tribe Events Calendar export) which works reliably
even when the REST API returns 500 errors.
"""

from __future__ import annotations

import logging
import re
from datetime import datetime, date
from typing import Optional
import requests
from icalendar import Calendar

from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://chattahoochee.org"
ICAL_URL = f"{BASE_URL}/events/?ical=1"

VENUE_DATA = {
    "name": "Chattahoochee Riverkeeper",
    "slug": "chattahoochee-riverkeeper",
    "address": "3 Puritan Mill, 916 Joseph E Lowery Blvd",
    "neighborhood": "West Midtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30318",
    "lat": 33.7693,
    "lng": -84.4178,
    "venue_type": "nonprofit_hq",
    "spot_type": "nonprofit_hq",
    "website": BASE_URL,
    "vibes": ["outdoor-seating", "dog-friendly"],
}


def determine_category(title: str, description: str) -> tuple[str, Optional[str], list[str]]:
    """Determine event category based on title and description."""
    combined = f"{title} {description}".lower()

    event_tags = ["environmental", "chattahoochee"]

    if any(word in combined for word in ["cleanup", "clean up", "volunteer", "service"]):
        event_tags.append("volunteer")
        return "community", "volunteer", event_tags

    if any(word in combined for word in ["paddle", "kayak", "canoe", "float", "river trip", "boat"]):
        event_tags.extend(["outdoors", "water-sports"])
        return "outdoors", "paddle", event_tags

    if any(word in combined for word in ["workshop", "training", "class", "learn", "education"]):
        event_tags.append("education")
        return "learning", "workshop", event_tags

    if any(word in combined for word in ["advocacy", "policy", "capitol", "legislat", "hearing", "conservation day"]):
        event_tags.append("advocacy")
        return "community", "meeting", event_tags

    if any(word in combined for word in ["tour", "hike", "walk", "trail"]):
        event_tags.append("outdoors")
        return "outdoors", "tour", event_tags

    if any(word in combined for word in ["happy hour", "fundraiser", "gala", "party", "celebration"]):
        event_tags.append("social")
        return "community", "social", event_tags

    return "community", "environmental", event_tags


def clean_ical_text(text: str) -> str:
    """Clean text from iCal fields."""
    if not text:
        return ""
    text = re.sub(r'<[^>]+>', '', text)
    text = re.sub(r'\\n', '\n', text)
    text = re.sub(r'\\,', ',', text)
    text = re.sub(r'\s+', ' ', text).strip()
    return text


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Chattahoochee Riverkeeper events via iCal feed."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        venue_id = get_or_create_venue(VENUE_DATA)

        headers = {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
            "Accept": "text/calendar",
        }

        logger.info(f"Fetching Chattahoochee Riverkeeper iCal feed: {ICAL_URL}")
        response = requests.get(ICAL_URL, headers=headers, timeout=30)
        response.raise_for_status()

        cal = Calendar.from_ical(response.content)
        today = date.today()

        for component in cal.walk():
            if component.name != "VEVENT":
                continue

            try:
                title = str(component.get("SUMMARY", "")).strip()
                if not title:
                    continue

                # Parse start date/time
                dtstart = component.get("DTSTART")
                if not dtstart:
                    continue

                dt_val = dtstart.dt
                if isinstance(dt_val, datetime):
                    start_date = dt_val.strftime("%Y-%m-%d")
                    start_time = dt_val.strftime("%H:%M")
                    is_all_day = False
                elif isinstance(dt_val, date):
                    start_date = dt_val.strftime("%Y-%m-%d")
                    start_time = None
                    is_all_day = True
                else:
                    continue

                # Skip past events
                event_date = dt_val.date() if isinstance(dt_val, datetime) else dt_val
                if event_date < today:
                    continue

                # Parse end date/time
                end_date = None
                end_time = None
                dtend = component.get("DTEND")
                if dtend:
                    end_val = dtend.dt
                    if isinstance(end_val, datetime):
                        end_date = end_val.strftime("%Y-%m-%d")
                        end_time = end_val.strftime("%H:%M")
                    elif isinstance(end_val, date):
                        end_date = end_val.strftime("%Y-%m-%d")

                # Description
                description = clean_ical_text(str(component.get("DESCRIPTION", "")))
                if not description or len(description) < 10:
                    description = f"{title} hosted by Chattahoochee Riverkeeper"

                # URL
                source_url = str(component.get("URL", f"{BASE_URL}/events/"))

                # Image from ATTACH
                image_url = None
                attach = component.get("ATTACH")
                if attach:
                    attach_str = str(attach)
                    if attach_str.startswith("http") and any(ext in attach_str.lower() for ext in [".png", ".jpg", ".jpeg", ".webp"]):
                        image_url = attach_str

                events_found += 1

                category, subcategory, event_tags = determine_category(title, description)

                content_hash = generate_content_hash(title, "Chattahoochee Riverkeeper", start_date)


                event_record = {
                    "source_id": source_id,
                    "venue_id": venue_id,
                    "title": title,
                    "description": description[:1000],
                    "start_date": start_date,
                    "start_time": start_time,
                    "end_date": end_date,
                    "end_time": end_time,
                    "is_all_day": is_all_day,
                    "category": category,
                    "subcategory": subcategory,
                    "tags": event_tags,
                    "price_min": None,
                    "price_max": None,
                    "price_note": None,
                    "is_free": True,
                    "source_url": source_url,
                    "ticket_url": source_url,
                    "image_url": image_url,
                    "raw_text": f"{title} - {description[:200]}",
                    "extraction_confidence": 0.95,
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

            except Exception as e:
                logger.error(f"Error processing iCal event: {e}")
                continue

        logger.info(
            f"Chattahoochee Riverkeeper crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Chattahoochee Riverkeeper: {e}")
        raise

    return events_found, events_new, events_updated
