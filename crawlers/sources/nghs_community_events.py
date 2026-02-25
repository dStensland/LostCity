"""
Crawler for Northeast Georgia Health System (NGHS) Community Events.

Northeast Georgia Health System serves the Greater Gainesville/Hall County region
with events including women's health classes (prepared childbirth, breastfeeding,
labor tours), support groups, weight loss programs, diabetes education, mental health
programs, and community wellness events.

Located in Gainesville, GA (edge of metro Atlanta), NGHS provides critical health
education and community programming for Northeast Georgia communities.

STRATEGY:
- Use Localist API at events.nghs.com/api/2/events
- Extract health education classes, support groups, wellness programs
- Tag: community-health, hospital, maternity, wellness, health-education
- Most events are free or low-cost for the community
- Category: "education" for classes, "community" for support groups/screenings

Relevant for Emory portal's community health track and regional health resources.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime
from typing import Optional

import requests

from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://events.nghs.com"
API_URL = f"{BASE_URL}/api/2/events"

VENUE_DATA = {
    "name": "Northeast Georgia Medical Center",
    "slug": "northeast-georgia-medical-center",
    "address": "743 Spring St NE",
    "neighborhood": "Gainesville",
    "city": "Gainesville",
    "state": "GA",
    "zip": "30501",
    "lat": 34.3037,
    "lng": -83.8208,
    "venue_type": "hospital",
    "spot_type": "hospital",
    "website": "https://www.nghs.com",
    "vibes": ["community-health", "hospital", "maternity", "wellness"],
}


def parse_date(date_str: str) -> Optional[str]:
    """Parse ISO date string to YYYY-MM-DD."""
    try:
        dt = datetime.fromisoformat(date_str.replace('Z', '+00:00'))
        return dt.strftime("%Y-%m-%d")
    except (ValueError, AttributeError):
        return None


def parse_time(date_str: str) -> Optional[str]:
    """Parse ISO date string to HH:MM."""
    try:
        dt = datetime.fromisoformat(date_str.replace('Z', '+00:00'))
        return dt.strftime("%H:%M")
    except (ValueError, AttributeError):
        return None


def determine_category_and_tags(title: str, description: str = "") -> tuple[str, list[str], bool]:
    """
    Determine category, tags, and is_free flag based on event content.
    Returns (category, tags, is_free).
    """
    text = f"{title} {description}".lower()
    tags = ["community-health", "hospital"]

    # Maternity/childbirth classes
    if any(word in text for word in ["childbirth", "breastfeeding", "labor", "delivery", "maternity", "baby", "newborn", "pregnancy"]):
        category = "learning"
        tags.extend(["maternity", "prenatal", "health-education"])

    # Support groups
    elif any(word in text for word in ["support group", "support meeting", "grief", "bereavement", "caregiver"]):
        category = "support_group"
        tags.extend(["mental-health", "wellness"])

    # Weight loss and fitness programs
    elif any(word in text for word in ["weight loss", "bariatric", "fitness", "exercise", "yoga"]):
        category = "wellness"
        tags.extend(["fitness", "weight-management"])

    # Diabetes education
    elif any(word in text for word in ["diabetes", "blood sugar", "diabetic"]):
        category = "learning"
        tags.extend(["diabetes", "chronic-disease", "health-education"])

    # Mental health programs
    elif any(word in text for word in ["mental health", "anxiety", "depression", "therapy", "counseling"]):
        category = "wellness"
        tags.extend(["mental-health", "health-education"])

    # Health screenings and health fairs
    elif any(word in text for word in ["screening", "health fair", "wellness check", "blood pressure", "health screening"]):
        category = "wellness"
        tags.extend(["health-screening", "preventive-care"])

    # CPR/First Aid training
    elif any(word in text for word in ["cpr", "first aid", "aed", "life support"]):
        category = "learning"
        tags.extend(["first-aid", "cpr", "training"])

    # Nutrition and cooking classes
    elif any(word in text for word in ["nutrition", "cooking", "diet", "healthy eating"]):
        category = "learning"
        tags.extend(["nutrition", "wellness", "health-education"])

    # Tours and facility visits
    elif any(word in text for word in ["tour", "visit", "open house"]):
        category = "tours"
        tags.extend(["hospital-tour", "facility-visit"])

    # Community events and fundraisers
    elif any(word in text for word in ["fundraiser", "gala", "benefit", "community event", "5k", "run", "walk"]):
        category = "community"
        tags.extend(["fundraiser", "wellness"])

    # Default to learning
    else:
        category = "learning"
        tags.append("health-education")

    # Only mark free when explicitly stated
    is_free = False
    if any(word in text for word in ["free", "no cost", "no charge", "complimentary", "no fee"]):
        is_free = True
        tags.append("free")
    elif any(word in text for word in ["$", "cost:", "fee:", "registration fee", "price"]):
        is_free = False

    return category, list(set(tags)), is_free


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl NGHS events using Localist API."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        # Create venue record
        venue_id = get_or_create_venue(VENUE_DATA)

        headers = {
            "User-Agent": "LostCity/1.0 (https://lostcity.ai; events@lostcity.ai)"
        }

        # Fetch 90 days of events
        params = {
            "days": 90,
            "pp": 100,  # Events per page
        }

        logger.info(f"Fetching NGHS events from API: {API_URL}")
        response = requests.get(API_URL, headers=headers, params=params, timeout=30)
        response.raise_for_status()
        data = response.json()

        events = data.get("events", [])
        logger.info(f"Fetched {len(events)} events from NGHS Localist API")

        for item in events:
            event_data = item.get("event", {})

            if not event_data:
                continue

            title = event_data.get("title", "").strip()
            if not title:
                continue

            # Get first event instance
            instances = event_data.get("event_instances", [])
            if not instances:
                continue

            instance = instances[0].get("event_instance", {})
            start_date_str = instance.get("start")

            if not start_date_str:
                continue

            start_date = parse_date(start_date_str)
            if not start_date:
                continue

            events_found += 1

            # Get description
            description = event_data.get("description_text", "")[:500]

            # Determine category and tags
            category, tags, is_free = determine_category_and_tags(title, description)

            # Check for duplicates
            content_hash = generate_content_hash(
                title, VENUE_DATA["name"], start_date
            )

            existing = find_event_by_hash(content_hash)
            if existing:
                events_updated += 1
                logger.debug(f"Event already exists: {title}")
                continue

            # Parse times
            is_all_day = instance.get("all_day", False)
            start_time = None if is_all_day else parse_time(start_date_str)

            end_date_str = instance.get("end")
            end_date = parse_date(end_date_str) if end_date_str else None
            end_time = None if is_all_day else parse_time(end_date_str) if end_date_str else None

            # Get event URL
            event_url = event_data.get("localist_url") or f"{BASE_URL}/event/{event_data.get('urlname', '')}"

            # Get photo
            photo_url = event_data.get("photo_url")

            # Get location details
            location_name = event_data.get("location_name", "")
            room_number = event_data.get("room_number", "")
            location_text = f"{location_name} {room_number}".strip() if location_name or room_number else ""

            # Get ticket/registration info
            ticket_url = event_data.get("ticket_url")
            ticket_cost = event_data.get("ticket_cost")
            has_register = event_data.get("has_register", False)

            # Build price note
            price_note = None
            if ticket_cost:
                price_note = ticket_cost
            elif has_register and not is_free:
                price_note = "Registration required"
            elif has_register and is_free:
                price_note = "Free, registration required"

            # Create event record
            event_record = {
                "source_id": source_id,
                "venue_id": venue_id,
                "title": title,
                "description": description,
                "start_date": start_date,
                "start_time": start_time,
                "end_date": end_date,
                "end_time": end_time,
                "is_all_day": is_all_day,
                "category": category,
                "subcategory": None,
                "tags": tags,
                "price_min": None,
                "price_max": None,
                "price_note": price_note,
                "is_free": is_free,
                "source_url": event_url,
                "ticket_url": ticket_url,
                "image_url": photo_url,
                "raw_text": json.dumps(event_data)[:500],
                "extraction_confidence": 0.9,
                "is_recurring": event_data.get("recurring", False),
                "recurrence_rule": None,
                "content_hash": content_hash,
            }

            try:
                insert_event(event_record)
                events_new += 1
                logger.info(f"Added: {title} on {start_date}")
            except Exception as e:
                logger.error(f"Failed to insert event '{title}': {e}")

        logger.info(
            f"NGHS crawl complete: {events_found} found, "
            f"{events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl NGHS: {e}")
        raise

    return events_found, events_new, events_updated
