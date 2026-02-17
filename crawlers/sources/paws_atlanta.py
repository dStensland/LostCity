"""
Crawler for PAWS Atlanta (pawsatlanta.org).
No-kill animal shelter in Decatur. Adoption events, vaccine clinics, volunteer
opportunities, fundraisers, and educational workshops.

The website embeds a Google Calendar (pawsatlantacalendar@gmail.com).
Uses the public iCal feed which is more reliable than scraping the embedded iframe.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime, date
from typing import Optional
import requests
from icalendar import Calendar

from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://pawsatlanta.org"
ICAL_URL = "https://calendar.google.com/calendar/ical/pawsatlantacalendar%40gmail.com/public/basic.ics"

VENUE_DATA = {
    "name": "PAWS Atlanta",
    "slug": "paws-atlanta",
    "address": "5287 Covington Hwy",
    "neighborhood": "Decatur",
    "city": "Decatur",
    "state": "GA",
    "zip": "30035",
    "lat": 33.7575,
    "lng": -84.2545,
    "venue_type": "animal_shelter",
    "spot_type": "animal_shelter",
    "website": BASE_URL,
    "vibes": ["dog-friendly", "family-friendly", "adoption"],
}


def clean_ical_text(text: str) -> str:
    """Clean text from iCal fields — remove HTML tags and excessive whitespace."""
    if not text:
        return ""
    text = re.sub(r'<[^>]+>', '', text)
    text = re.sub(r'\\n', '\n', text)
    text = re.sub(r'\\,', ',', text)
    text = re.sub(r'\s+', ' ', text).strip()
    return text


def determine_category(title: str, description: str) -> tuple[str, Optional[str], list[str]]:
    """Determine event category based on title and description."""
    combined = f"{title} {description}".lower()
    event_tags = ["animals", "paws-atlanta"]

    # Adoption events
    if any(word in combined for word in ["adoption", "adopt", "meet & greet", "meet the pets", "adoptable"]):
        event_tags.extend(["adoption", "family-friendly"])
        return "family", "adoption-event", event_tags

    # Vaccine/spay/neuter clinics
    if any(word in combined for word in ["vaccine", "vaccination", "clinic", "spay", "neuter", "wellness", "vet"]):
        event_tags.extend(["pets", "family-friendly"])
        return "family", "pet-clinic", event_tags

    # Volunteer events
    if any(word in combined for word in ["volunteer", "orientation", "training"]):
        event_tags.append("volunteer")
        return "community", "volunteer", event_tags

    # Fundraising events
    if any(word in combined for word in ["fundraiser", "gala", "benefit", "donation", "charity", "auction", "raffle"]):
        event_tags.extend(["fundraiser", "charity"])
        return "community", "fundraiser", event_tags

    # Educational workshops
    if any(word in combined for word in ["workshop", "class", "seminar", "learn", "education", "training"]):
        event_tags.extend(["education", "family-friendly"])
        return "learning", "workshop", event_tags

    # Default to community event
    event_tags.append("family-friendly")
    return "community", "community-event", event_tags


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl PAWS Atlanta events via Google Calendar iCal feed."""
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

        logger.info(f"Fetching PAWS Atlanta iCal feed: {ICAL_URL}")
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
                    description = f"{title} at PAWS Atlanta"

                # URL - Google Calendar events might have an event URL
                source_url = str(component.get("URL", f"{BASE_URL}/events/"))
                if source_url == "None":
                    source_url = f"{BASE_URL}/events/"

                # Image - not typically in Google Calendar
                image_url = None

                events_found += 1

                # Determine category
                category, subcategory, event_tags = determine_category(title, description)

                # Content hash for dedup
                content_hash = generate_content_hash(title, "PAWS Atlanta", start_date)


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
                    logger.info(f"  Added: [{category}] {title} on {start_date}")
                except Exception as e:
                    logger.error(f"  Failed to insert event '{title}': {e}")

            except Exception as e:
                logger.error(f"Error processing iCal event: {e}")
                continue

        logger.info(
            f"PAWS Atlanta crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl PAWS Atlanta: {e}")
        raise

    return events_found, events_new, events_updated
