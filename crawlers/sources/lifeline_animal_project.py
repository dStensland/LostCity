"""
Crawler for LifeLine Animal Project (lifelineanimal.org).
Runs Fulton County Animal Services and DeKalb County Animal Services shelters.
Volunteer events, adoption events, foster programs, and shelter shifts.

Uses the iCal feed (Tribe Events Calendar export) which bypasses the site's
reCAPTCHA bot protection. The REST API and HTML pages are blocked by CAPTCHA,
but the .ics feed is served directly.
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

BASE_URL = "https://lifelineanimal.org"
ICAL_URL = f"{BASE_URL}/events/?ical=1"

VENUE_DATA = {
    "name": "LifeLine Animal Project",
    "slug": "lifeline-animal-project",
    "address": "3180 Presidential Dr",
    "neighborhood": "Doraville",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30340",
    "lat": 33.8844,
    "lng": -84.2488,
    "venue_type": "nonprofit_hq",
    "spot_type": "nonprofit_hq",
    "website": BASE_URL,
    "vibes": ["family-friendly", "dog-friendly"],
}


def determine_category(title: str, description: str, categories: list[str]) -> tuple[str, Optional[str], list[str]]:
    """Determine event category based on title, description, and iCal categories."""
    combined = f"{title} {description}".lower()
    ical_cats = " ".join(c.lower() for c in categories)

    event_tags = ["animals", "lifeline"]

    # Adoption events
    if "adoption" in ical_cats or any(word in combined for word in ["adoption", "adopt", "meet the pets", "meet & greet"]):
        event_tags.extend(["adoption", "family-friendly"])
        return "family", "adoption-event", event_tags

    # Vaccine clinics
    if "vaccine" in ical_cats or any(word in combined for word in ["vaccine", "vaccination", "clinic", "spay", "neuter"]):
        event_tags.extend(["pets", "family-friendly"])
        return "family", "pet-clinic", event_tags

    # Volunteer orientation or shifts
    if any(word in combined for word in ["volunteer", "orientation", "training", "shelter shift"]):
        event_tags.append("volunteer")
        return "community", "volunteer", event_tags

    # Foster events
    if any(word in combined for word in ["foster", "fostering"]):
        event_tags.extend(["volunteer", "foster"])
        return "community", "foster", event_tags

    # Fundraising events
    if any(word in combined for word in ["fundraiser", "gala", "benefit", "donation", "fundraising", "bingo"]):
        event_tags.append("fundraiser")
        return "community", "fundraiser", event_tags

    # Educational workshops
    if any(word in combined for word in ["workshop", "class", "training", "seminar", "learn"]):
        event_tags.extend(["education", "family-friendly"])
        return "learning", "workshop", event_tags

    # Default to family event
    event_tags.append("family-friendly")
    return "family", "animal-event", event_tags


def clean_ical_text(text: str) -> str:
    """Clean text from iCal fields — remove HTML tags and excessive whitespace."""
    if not text:
        return ""
    text = re.sub(r'<[^>]+>', '', text)
    text = re.sub(r'\\n', '\n', text)
    text = re.sub(r'\\,', ',', text)
    text = re.sub(r'\s+', ' ', text).strip()
    return text


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl LifeLine Animal Project events via iCal feed."""
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

        logger.info(f"Fetching LifeLine Animal Project iCal feed: {ICAL_URL}")
        response = requests.get(ICAL_URL, headers=headers, timeout=30)
        response.raise_for_status()

        cal = Calendar.from_ical(response.content)
        today = date.today()

        for component in cal.walk():
            if component.name != "VEVENT":
                continue

            try:
                # Extract title
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
                    description = f"{title} hosted by LifeLine Animal Project"

                # URL
                source_url = str(component.get("URL", f"{BASE_URL}/events/"))

                # Image from ATTACH
                image_url = None
                attach = component.get("ATTACH")
                if attach:
                    attach_str = str(attach)
                    if attach_str.startswith("http") and any(ext in attach_str.lower() for ext in [".png", ".jpg", ".jpeg", ".webp"]):
                        image_url = attach_str

                # Categories from iCal CATEGORIES field
                ical_categories = []
                cats = component.get("CATEGORIES")
                if cats:
                    if hasattr(cats, 'cats'):
                        ical_categories = [str(c) for c in cats.cats]
                    elif isinstance(cats, list):
                        for cat_group in cats:
                            if hasattr(cat_group, 'cats'):
                                ical_categories.extend(str(c) for c in cat_group.cats)

                events_found += 1

                # Determine category
                category, subcategory, event_tags = determine_category(title, description, ical_categories)

                # Content hash for dedup
                content_hash = generate_content_hash(title, "LifeLine Animal Project", start_date)


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
            f"LifeLine Animal Project crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl LifeLine Animal Project: {e}")
        raise

    return events_found, events_new, events_updated
