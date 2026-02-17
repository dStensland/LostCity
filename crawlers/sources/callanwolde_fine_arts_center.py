"""
Crawler for Callanwolde Fine Arts Center (callanwolde.org).

Historic Gothic-Revival mansion in Druid Hills offering pottery, dance, yoga,
painting, drawing, jewelry, photography, writing, kids programs, and more.

Uses the iCal feed from The Events Calendar WordPress plugin — single request
instead of paginating through 1,400+ events via the REST API.
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
from description_fetcher import fetch_description_from_url
from utils import enrich_event_record

logger = logging.getLogger(__name__)

BASE_URL = "https://callanwolde.org"
ICAL_URL = f"{BASE_URL}/events/?ical=1"

VENUE_DATA = {
    "name": "Callanwolde Fine Arts Center",
    "slug": "callanwolde-fine-arts-center",
    "address": "980 Briarcliff Rd NE",
    "neighborhood": "Druid Hills",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30306",
    "lat": 33.7858,
    "lng": -84.3398,
    "venue_type": "community_center",
    "spot_type": "community_center",
    "website": BASE_URL,
    "vibes": ["workshop", "creative", "hands-on", "art-class", "historic", "pottery"],
}

# Skip staff meetings and internal events
SKIP_KEYWORDS = [
    "staff meeting",
    "board meeting",
    "committee",
    "internal",
    "closed",
    "private",
    "board of directors",
]


def clean_ical_text(text: str) -> str:
    """Clean text from iCal fields."""
    if not text:
        return ""
    text = re.sub(r"<[^>]+>", "", text)
    text = re.sub(r"\\n", "\n", text)
    text = re.sub(r"\\,", ",", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def determine_category_and_tags(
    title: str, description: str, ical_categories: list[str] | None = None,
) -> tuple[str, Optional[str], list[str]]:
    """Determine category, subcategory, and tags based on title, description, and iCal categories."""
    text = f"{title} {description}".lower()
    tags = ["art-class", "creative"]

    # Use iCal categories for extra signal
    ical_cats = {c.lower() for c in (ical_categories or [])}

    # Pottery/ceramics
    if any(kw in text for kw in ["pottery", "ceramics", "wheel", "clay", "kiln"]) or "pottery & ceramics" in ical_cats:
        tags.extend(["pottery", "ceramics", "hands-on"])
        return "learning", "workshop", tags

    # Blacksmithing
    if "blacksmith" in text or "blacksmithing" in ical_cats:
        tags.extend(["blacksmithing", "hands-on"])
        return "learning", "workshop", tags

    # Dance classes
    if any(kw in text for kw in ["dance", "ballet", "hip-hop", "hip hop", "creative movement", "contemporary dance", "tap dance"]) or ical_cats & {"adult dance", "children's dance", "salsa"}:
        tags.append("dance")
        if "salsa" in text or "salsa" in ical_cats:
            tags.append("salsa")
            return "nightlife", "dance-party", tags
        return "learning", "class", tags

    # Yoga/wellness
    if any(kw in text for kw in ["yoga", "tai chi", "meditation", "wellness", "mindfulness"]):
        tags.extend(["yoga", "wellness"])
        if "yoga" in text:
            return "fitness", "yoga", tags
        return "fitness", "class", tags

    # Painting/drawing
    if any(kw in text for kw in ["painting", "drawing", "sketch", "watercolor", "acrylic", "oil painting", "pastel"]) or "drawing & painting" in ical_cats:
        tags.extend(["painting", "art-class"])
        return "learning", "workshop", tags

    # Photography
    if any(kw in text for kw in ["photography", "photo", "camera", "darkroom"]):
        tags.append("photography")
        return "learning", "workshop", tags

    # Writing/poetry
    if any(kw in text for kw in ["writing", "poetry", "creative writing", "journaling", "memoir"]):
        tags.extend(["writing", "creative-writing"])
        return "learning", "workshop", tags

    # Jewelry/crafts
    if any(kw in text for kw in ["jewelry", "metalwork", "beading", "silversmith"]) or "jewelry making & metalsmithing" in ical_cats:
        tags.append("hands-on")
        return "learning", "workshop", tags

    # Textiles
    if any(kw in text for kw in ["textile", "weaving", "sewing", "fiber", "quilting"]) or "textiles" in ical_cats:
        tags.extend(["textiles", "hands-on"])
        return "learning", "workshop", tags

    # Music performances/concerts
    if any(kw in text for kw in ["concert", "recital", "performance", "symphony", "chamber music"]):
        tags.append("performance")
        return "music", "performance", tags

    # Theater/performances
    if any(kw in text for kw in ["theater", "theatre", "play", "drama"]):
        tags.append("performance")
        return "art", "performance", tags

    # Special events
    if "special events" in ical_cats:
        return "community", "social", tags

    # Kids/family programs
    if any(kw in text for kw in ["kids", "children", "youth", "family", "toddler", "preschool"]):
        tags.append("family-friendly")
        return "learning", "class", tags

    # Workshops in general
    if any(kw in text for kw in ["workshop", "class", "lesson", "instruction"]) or "art classes" in ical_cats:
        return "learning", "workshop", tags

    # Exhibitions/galleries
    if any(kw in text for kw in ["exhibition", "exhibit", "gallery", "opening"]):
        tags.append("gallery")
        return "art", "exhibition", tags

    # Default to learning/class
    return "learning", "class", tags


def is_public_event(title: str, description: str) -> bool:
    """Determine if event is public vs. internal."""
    text = f"{title} {description}".lower()
    return not any(kw in text for kw in SKIP_KEYWORDS)


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Callanwolde Fine Arts Center events via iCal feed."""
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

        logger.info(f"Fetching Callanwolde iCal feed: {ICAL_URL}")
        response = requests.get(ICAL_URL, headers=headers, timeout=30)
        response.raise_for_status()

        cal = Calendar.from_ical(response.content)
        today = date.today()
        seen_events: set[str] = set()

        for component in cal.walk():
            if component.name != "VEVENT":
                continue

            try:
                title = str(component.get("SUMMARY", "")).strip()
                if not title or len(title) < 5:
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

                # Dedupe by title + date
                event_key = f"{title}|{start_date}"
                if event_key in seen_events:
                    continue
                seen_events.add(event_key)

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

                # URL (extract early for description fetching)
                source_url = str(component.get("URL", f"{BASE_URL}/events/"))

                # Description — prefer iCal, fall back to web page, then generic
                description = clean_ical_text(str(component.get("DESCRIPTION", "")))
                if not description or len(description) < 80:
                    fetched = fetch_description_from_url(source_url)
                    if fetched:
                        description = fetched
                        logger.debug(f"Fetched description from URL for: {title}")
                    elif not description or len(description) < 10:
                        description = f"{title} at Callanwolde Fine Arts Center"

                # Check if public
                if not is_public_event(title, description):
                    logger.debug(f"Skipping internal event: {title}")
                    continue

                # Image from ATTACH
                image_url = None
                attach = component.get("ATTACH")
                if attach:
                    attach_str = str(attach)
                    if attach_str.startswith("http") and any(
                        ext in attach_str.lower() for ext in [".png", ".jpg", ".jpeg", ".webp"]
                    ):
                        image_url = attach_str

                # iCal categories
                ical_categories = []
                cat_prop = component.get("CATEGORIES")
                if cat_prop:
                    if hasattr(cat_prop, "cats"):
                        ical_categories = [str(c) for c in cat_prop.cats]
                    else:
                        ical_categories = [str(cat_prop)]

                events_found += 1

                content_hash = generate_content_hash(
                    title, "Callanwolde Fine Arts Center", start_date
                )


                category, subcategory, tags = determine_category_and_tags(
                    title, description, ical_categories
                )

                event_record = {
                    "source_id": source_id,
                    "venue_id": venue_id,
                    "title": title[:200],
                    "description": description[:1000],
                    "start_date": start_date,
                    "start_time": start_time if not is_all_day else None,
                    "end_date": end_date if end_date != start_date else None,
                    "end_time": end_time if not is_all_day else None,
                    "is_all_day": is_all_day,
                    "category": category,
                    "subcategory": subcategory,
                    "tags": tags,
                    "price_min": None,
                    "price_max": None,
                    "price_note": "Registration required",
                    "is_free": False,
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

                # Enrich from detail page if missing image or description
                if source_url and source_url != f"{BASE_URL}/events/":
                    event_record = enrich_event_record(event_record, source_name="Callanwolde Fine Arts Center")

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
            f"Callanwolde crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Callanwolde: {e}")
        raise

    return events_found, events_new, events_updated
