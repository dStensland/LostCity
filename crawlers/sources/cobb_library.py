"""
Crawler for Cobb County Public Library System events.

Cobb County has 15 library branches offering free events including:
- Storytimes, book clubs, educational programs, kids activities
- Computer classes, author talks, crafts, and community programs

Uses the Cobb County /api/search/events REST endpoint (department=85 = Library).
Previously used Playwright against the JS-rendered events listing page, which only
returned the default 7-day window. The REST API returns all events in the requested
date range without JavaScript rendering.
"""

from __future__ import annotations

import logging
import re
import requests
from datetime import datetime, timedelta
from typing import Optional
from zoneinfo import ZoneInfo

from utils import slugify
from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash
from entity_lanes import SourceEntityCapabilities, TypedEntityEnvelope
from entity_persistence import persist_typed_entity_envelope

logger = logging.getLogger(__name__)

SOURCE_ENTITY_CAPABILITIES = SourceEntityCapabilities(
    events=True,
    destinations=True,
    destination_details=True,
    venue_features=True,
)

BASE_URL = "https://www.cobbcounty.gov"
EVENTS_API = f"{BASE_URL}/api/search/events"
EVENTS_PAGE = f"{BASE_URL}/events?department=85"
LIBRARY_DEPARTMENT_ID = "85"
CRAWL_DAYS = 90

# Cobb County API uses US/Eastern timestamps
EASTERN = ZoneInfo("America/New_York")

# Library branches - used to resolve location titles to venue records
LIBRARY_BRANCHES = {
    "east cobb": {
        "name": "East Cobb Library",
        "address": "4880 Lower Roswell Road",
        "city": "Marietta",
        "state": "GA",
        "zip": "30068",
    },
    "gritters": {
        "name": "Gritters Library",
        "address": "2550 Sandy Plains Road",
        "city": "Marietta",
        "state": "GA",
        "zip": "30066",
    },
    "kemp memorial": {
        "name": "Kemp Memorial Library",
        "address": "1090 Powder Springs Street",
        "city": "Marietta",
        "state": "GA",
        "zip": "30064",
    },
    "lewis a. ray": {
        "name": "Lewis A. Ray Library",
        "address": "1315 Kennestone Circle",
        "city": "Marietta",
        "state": "GA",
        "zip": "30066",
    },
    "mountain view": {
        "name": "Mountain View Regional Library",
        "address": "3320 Sandy Plains Road",
        "city": "Marietta",
        "state": "GA",
        "zip": "30066",
    },
    "sibley": {
        "name": "Sibley Library",
        "address": "130 Powder Springs Street",
        "city": "Marietta",
        "state": "GA",
        "zip": "30064",
    },
    "south cobb": {
        "name": "South Cobb Regional Library",
        "address": "805 Clay Road SW",
        "city": "Mableton",
        "state": "GA",
        "zip": "30126",
    },
    "stratton": {
        "name": "Stratton Library",
        "address": "2470 Windy Hill Road SE",
        "city": "Marietta",
        "state": "GA",
        "zip": "30067",
    },
    "switzer": {
        "name": "Switzer Library",
        "address": "266 Roswell Street",
        "city": "Marietta",
        "state": "GA",
        "zip": "30060",
    },
    "vinings": {
        "name": "Vinings Library",
        "address": "4290 Paces Ferry Road SE",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30339",
    },
    "west cobb": {
        "name": "West Cobb Regional Library",
        "address": "1750 Dennis Kemp Lane",
        "city": "Kennesaw",
        "state": "GA",
        "zip": "30152",
    },
    "sewell mill": {
        "name": "Sewell Mill Library & Cultural Center",
        "address": "2051 Lower Roswell Road",
        "city": "Marietta",
        "state": "GA",
        "zip": "30068",
    },
    "merchants walk": {
        "name": "Merchants Walk Library",
        "address": "1550 Merchants Drive",
        "city": "Marietta",
        "state": "GA",
        "zip": "30066",
    },
    "sweetwater valley": {
        "name": "Sweetwater Valley Library",
        "address": "3200 County Line Road",
        "city": "Austell",
        "state": "GA",
        "zip": "30106",
    },
    "powder springs": {
        "name": "Powder Springs Library",
        "address": "4181 Atlanta Street",
        "city": "Powder Springs",
        "state": "GA",
        "zip": "30127",
    },
    "north cobb": {
        "name": "North Cobb Regional Library",
        "address": "3535 Old 41 Highway NW",
        "city": "Kennesaw",
        "state": "GA",
        "zip": "30144",
    },
}

# Category mapping based on event titles/descriptions
CATEGORY_MAP = {
    "book": "words",
    "storytime": "words",
    "story time": "words",
    "author": "words",
    "writing": "words",
    "reading": "words",
    "poetry": "words",
    "computer": "learning",
    "technology": "learning",
    "tech": "learning",
    "esl": "learning",
    "class": "learning",
    "career": "learning",
    "homework": "learning",
    "music": "music",
    "concert": "music",
    "film": "film",
    "movie": "film",
    "craft": "art",
    "art": "art",
    "arts": "art",
    "paint": "art",
    "draw": "art",
    "fitness": "fitness",
    "yoga": "fitness",
    "wellness": "fitness",
    "game": "play",
    "gaming": "play",
    "lego": "play",
    "toy": "play",
}

# Cobb County API age label to age-band tags
COBB_AGE_TAG_MAP = {
    "babies": ["infant", "kids", "family-friendly"],
    "toddlers": ["toddler", "kids", "family-friendly"],
    "preschool": ["preschool", "kids", "family-friendly"],
    "birth to five": ["infant", "toddler", "preschool", "kids", "family-friendly"],
    "elementary": ["elementary", "kids", "family-friendly"],
    "kids": ["elementary", "kids", "family-friendly"],
    "children": ["elementary", "kids", "family-friendly"],
    "tweens": ["teen", "kids", "family-friendly"],
    "teens": ["teen"],
    "young adults": ["teen"],
    "adults": ["adults"],
    "seniors": ["adults", "seniors"],
    "all ages": ["family-friendly"],
    "families": ["family-friendly", "kids"],
}

FAMILY_AGE_KEYWORDS = {
    "babies",
    "toddlers",
    "preschool",
    "birth to five",
    "elementary",
    "kids",
    "children",
    "tweens",
    "families",
    "all ages",
}


def _build_branch_destination_envelope(venue_id: int, venue_data: dict) -> TypedEntityEnvelope:
    """Project a Cobb library branch into shared Family-friendly destination details."""
    envelope = TypedEntityEnvelope()
    branch_name = str(venue_data.get("name") or "Cobb library branch").strip()

    envelope.add(
        "destination_details",
        {
            "venue_id": venue_id,
            "destination_type": "library_branch",
            "commitment_tier": "hour",
            "primary_activity": "free indoor family library visit",
            "best_seasons": ["spring", "summer", "fall", "winter"],
            "weather_fit_tags": ["indoor", "rainy-day", "heat-day", "free-option"],
            "parking_type": "free_lot",
            "practical_notes": (
                f"{branch_name} is a free indoor family destination with books, browsing, and library programming. "
                "Check the official branch listing for current hours and event timing."
            ),
            "accessibility_notes": (
                "Cobb library branches are generally easier low-friction indoor stops for families who need predictable bathrooms, seating, and a calmer weather-proof outing."
            ),
            "best_time_of_day": "any",
            "family_suitability": "yes",
            "reservation_required": False,
            "permit_required": False,
            "fee_note": "Free public library access.",
            "source_url": "https://www.cobbcounty.org/library",
            "metadata": {
                "source_type": "family_destination_enrichment",
                "venue_type": "library",
                "branch_name": branch_name,
                "county": "cobb",
            },
        },
    )

    envelope.add(
        "venue_features",
        {
            "venue_id": venue_id,
            "slug": "free-indoor-family-stop",
            "title": "Free indoor family stop",
            "feature_type": "amenity",
            "description": f"{branch_name} is a free indoor place for browsing, reading, and easy family time out of the weather.",
            "url": "https://www.cobbcounty.org/library",
            "price_note": "Free public library access.",
            "is_free": True,
            "sort_order": 5,
        },
    )
    envelope.add(
        "venue_features",
        {
            "venue_id": venue_id,
            "slug": "storytime-and-family-programs",
            "title": "Storytime and family programs",
            "feature_type": "experience",
            "description": f"{branch_name} regularly hosts free storytimes, reading events, and family-friendly branch programming.",
            "url": EVENTS_PAGE,
            "price_note": "Most branch programs are free; confirm event details on the official calendar.",
            "is_free": True,
            "sort_order": 15,
        },
    )

    return envelope


def resolve_branch_venue(location_title: str) -> dict:
    """
    Resolve a Cobb County API location title to a venue dict.
    Falls back to a generic Cobb County Library System record.
    """
    if not location_title:
        return _default_venue()

    loc_lower = location_title.lower()

    for key, branch in LIBRARY_BRANCHES.items():
        if key in loc_lower:
            return {
                "name": branch["name"],
                "slug": slugify(branch["name"]),
                "address": branch.get("address"),
                "city": branch["city"],
                "state": branch["state"],
                "zip": branch.get("zip"),
                "venue_type": "library",
            }

    # If it mentions "library", use the location title as the name
    if "library" in loc_lower or "cultural center" in loc_lower:
        name = location_title.strip()
        return {
            "name": name,
            "slug": slugify(name),
            "city": "Marietta",
            "state": "GA",
            "venue_type": "library",
        }

    return _default_venue()


def _default_venue() -> dict:
    return {
        "name": "Cobb County Public Library System",
        "slug": "cobb-county-public-library-system",
        "city": "Marietta",
        "state": "GA",
        "venue_type": "library",
    }


def parse_cobb_datetime(time_str: str) -> tuple[Optional[str], Optional[str]]:
    """
    Parse a Cobb County API datetime string.
    Format: "2026-03-23T14:00:00+00:00" (UTC offset included).
    Returns (date, time) in local Eastern time.
    """
    if not time_str:
        return None, None
    try:
        dt = datetime.fromisoformat(time_str)
        dt_eastern = dt.astimezone(EASTERN)
        return dt_eastern.strftime("%Y-%m-%d"), dt_eastern.strftime("%H:%M")
    except Exception:
        try:
            clean = re.sub(r"[+-]\d{2}:\d{2}$", "", time_str).replace("Z", "")
            dt = datetime.fromisoformat(clean)
            return dt.strftime("%Y-%m-%d"), dt.strftime("%H:%M")
        except Exception as e:
            logger.warning(f"Failed to parse datetime '{time_str}': {e}")
            return None, None


def derive_age_tags_and_category(event_age: Optional[list]) -> tuple[list[str], bool]:
    """
    Derive age-band tags and whether to set category='family' from the
    Cobb County API eventAge list (list of {"name": "..."} dicts).
    """
    if not event_age:
        return [], False

    tags: list[str] = []
    is_family = False

    for age_entry in event_age:
        label = (age_entry.get("name") or "").lower().strip()
        for key, tag_list in COBB_AGE_TAG_MAP.items():
            if key in label:
                for t in tag_list:
                    if t not in tags:
                        tags.append(t)
                if key in FAMILY_AGE_KEYWORDS:
                    is_family = True
                break

    return tags, is_family


def determine_category(title: str, summary: str) -> str:
    """Determine event category from title and summary text."""
    text = f"{title} {summary}".lower()
    for keyword, category in CATEGORY_MAP.items():
        # Word-boundary match to avoid substring false positives
        # (e.g. "art" matching inside "partnering", "start", "party")
        if re.search(r'\b' + re.escape(keyword) + r'\b', text):
            return category
    return "words"


def fetch_all_events(from_date: str, to_date: str) -> list[dict]:
    """
    Fetch all library events from the Cobb County REST API for the given
    date range. Returns the raw list of event dicts from the API.
    """
    params = {
        "fromDate": from_date,
        "toDate": to_date,
        "department": LIBRARY_DEPARTMENT_ID,
        "pageSize": "2000",
        "search": "",
        "category": "",
        "age": "",
        "location": "",
    }
    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        "Accept": "application/json",
        "Referer": EVENTS_PAGE,
    }

    try:
        resp = requests.get(EVENTS_API, params=params, headers=headers, timeout=60)
        resp.raise_for_status()
        data = resp.json()
        results = data.get("graphqlEventsSearchWww", {}).get("results", [])
        logger.info(f"Cobb County API returned {len(results)} events")
        return results
    except Exception as e:
        logger.error(f"Cobb County API fetch failed: {e}")
        return []


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Cobb County Public Library events via the REST API."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    today = datetime.now(EASTERN)
    end_date = today + timedelta(days=CRAWL_DAYS)
    from_date = today.strftime("%Y-%m-%d")
    to_date = end_date.strftime("%Y-%m-%d")

    logger.info(f"Cobb Library: fetching events {from_date} to {to_date}")

    raw_events = fetch_all_events(from_date, to_date)
    events_found = len(raw_events)

    enriched_venue_ids: set[int] = set()

    for raw_event in raw_events:
        try:
            title = (raw_event.get("title") or "").strip()
            if not title:
                continue

            # Skip cancelled events
            if "cancel" in title.lower():
                logger.debug(f"Skipping cancelled event: {title}")
                continue

            # Parse dates
            start_date, start_time = parse_cobb_datetime(
                (raw_event.get("startDate") or {}).get("time", "")
            )
            end_date_str, end_time = parse_cobb_datetime(
                (raw_event.get("endDate") or {}).get("time", "")
            )

            if not start_date:
                logger.warning(f"Event '{title}' has no parseable start date, skipping")
                continue

            # Skip past events
            try:
                if datetime.strptime(start_date, "%Y-%m-%d").date() < today.date():
                    continue
            except ValueError:
                continue

            # Resolve venue
            location_title = (raw_event.get("location") or {}).get("title", "")
            venue_data = resolve_branch_venue(location_title)
            venue_id = get_or_create_venue(venue_data)

            if venue_id and venue_id not in enriched_venue_ids:
                persist_typed_entity_envelope(
                    _build_branch_destination_envelope(venue_id, venue_data)
                )
                enriched_venue_ids.add(venue_id)

            # Build source URL from event path
            path = raw_event.get("path", "")
            event_url = f"{BASE_URL}{path}" if path else EVENTS_PAGE

            # Summary / description
            summary = (raw_event.get("summary") or "").strip()

            # Category and age tags
            event_age = raw_event.get("eventAge")
            age_tags, is_family_audience = derive_age_tags_and_category(event_age)
            category = determine_category(title, summary)
            if is_family_audience:
                category = "family"

            # Build tags
            base_tags = ["library", "free", "public"]
            tags = base_tags + [t for t in age_tags if t not in base_tags]

            # Add activity tags from title
            title_lower = title.lower()
            if "book club" in title_lower:
                tags.append("book-club")
            if any(w in title_lower for w in ["craft", "make"]):
                tags.append("craft")
            if "computer" in title_lower or "tech" in title_lower:
                tags.append("educational")

            content_hash = generate_content_hash(title, venue_data["name"], start_date)

            event_record = {
                "source_id": source_id,
                "venue_id": venue_id,
                "title": title,
                "description": summary if summary else None,
                "start_date": start_date,
                "start_time": start_time,
                "end_date": end_date_str,
                "end_time": end_time,
                "is_all_day": False,
                "category": category,
                "subcategory": None,
                "tags": tags,
                "price_min": None,
                "price_max": None,
                "price_note": None,
                "is_free": True,
                "source_url": event_url,
                "ticket_url": None,
                "image_url": None,
                "raw_text": None,
                "extraction_confidence": 0.92,
                "is_recurring": bool(raw_event.get("sticky")),
                "recurrence_rule": None,
                "content_hash": content_hash,
            }

            existing = find_event_by_hash(content_hash)
            if existing:
                smart_update_existing_event(existing, event_record)
                events_updated += 1
                continue

            insert_event(event_record)
            events_new += 1
            logger.debug(f"Added: {title} on {start_date} at {venue_data['name']}")

        except Exception as e:
            logger.error(f"Failed to process Cobb event '{raw_event.get('title', 'unknown')}': {e}")
            continue

    logger.info(
        f"Cobb County Library crawl complete: {events_found} found, "
        f"{events_new} new, {events_updated} updated"
    )

    return events_found, events_new, events_updated
