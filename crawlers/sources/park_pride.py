"""
Crawler for Park Pride (parkpride.org).

Atlanta nonprofit supporting parks and greenspaces. Events include park cleanups,
community garden workdays, tree plantings, and park improvement projects.

Uses The Events Calendar WordPress plugin with REST API.
Each event includes a venue object with the specific park name and address — we
create a separate venue record per park so events appear at the right location.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime
from typing import Optional
import requests
from bs4 import BeautifulSoup

from db import (
    find_existing_event_for_insert,
    get_or_create_venue,
    insert_event,
    remove_stale_source_events,
    smart_update_existing_event,
)
from dedupe import generate_content_hash
from entity_lanes import SourceEntityCapabilities, TypedEntityEnvelope
from entity_persistence import persist_typed_entity_envelope

logger = logging.getLogger(__name__)

BASE_URL = "https://parkpride.org"
API_URL = f"{BASE_URL}/wp-json/tribe/events/v1/events"

SOURCE_ENTITY_CAPABILITIES = SourceEntityCapabilities(
    events=True,
    destinations=True,
    destination_details=True,
    venue_features=True,
)

# Fallback venue used only when an event has no venue data from the API
FALLBACK_VENUE_DATA = {
    "name": "Park Pride",
    "slug": "park-pride",
    "address": "233 Peachtree St NE #900",
    "neighborhood": "Downtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30303",
    "lat": 33.7590,
    "lng": -84.3880,
    "venue_type": "nonprofit",
    "spot_type": "nonprofit",
    "website": BASE_URL,
    "vibes": ["volunteer", "outdoors", "family-friendly"],
}

# Skip internal/non-public events
SKIP_KEYWORDS = [
    "staff meeting",
    "board meeting",
    "committee",
    "internal",
    "closed",
    "private",
]

VOLUNTEER_KEYWORDS = [
    "volunteer",
    "cleanup",
    "workday",
    "planting",
    "tree",
    "garden",
    "park",
    "community",
]

# Known Atlanta neighborhoods by park name keywords — used to set neighborhood field
PARK_NEIGHBORHOODS = {
    "brownwood": "East Atlanta Village",
    "lionel hampton": "Vine City",
    "murphey candler": "Brookhaven",
    "piedmont": "Midtown",
    "grant park": "Grant Park",
    "inman park": "Inman Park",
    "freedom park": "Candler Park",
    "candler park": "Candler Park",
    "kirkwood": "Kirkwood",
    "beltline": "Old Fourth Ward",
    "old fourth ward": "Old Fourth Ward",
    "eastside trail": "Old Fourth Ward",
    "westside": "West End",
    "ponce de leon": "Poncey-Highland",
    "olmsted": "Midtown",
    "tanyard creek": "Buckhead",
    "chastain": "Buckhead",
    "morningside": "Virginia-Highland",
    "lenox": "Buckhead",
}


def parse_datetime(dt_str: str) -> tuple[Optional[str], Optional[str]]:
    """
    Parse ISO datetime string from Tribe Events API to (YYYY-MM-DD, HH:MM).
    Handles both "2026-02-14 10:00:00" and ISO 8601 with timezone.
    """
    if not dt_str:
        return None, None

    try:
        # Normalize: strip timezone suffix and T separator
        clean = dt_str.replace("T", " ").split("+")[0].split("Z")[0].strip()
        dt = datetime.fromisoformat(clean)
        return dt.strftime("%Y-%m-%d"), dt.strftime("%H:%M")
    except (ValueError, AttributeError) as e:
        logger.debug(f"Could not parse datetime '{dt_str}': {e}")
        return None, None


def strip_html(html: str) -> str:
    """Strip HTML tags and normalize whitespace."""
    if not html:
        return ""
    soup = BeautifulSoup(html, "html.parser")
    text = soup.get_text(separator=" ", strip=True)
    return re.sub(r"\s+", " ", text).strip()


def get_neighborhood_for_park(park_name: str) -> Optional[str]:
    """Infer Atlanta neighborhood from park name keywords."""
    name_lower = park_name.lower()
    for keyword, neighborhood in PARK_NEIGHBORHOODS.items():
        if keyword in name_lower:
            return neighborhood
    return None


def build_venue_from_api(venue_data: dict) -> Optional[dict]:
    """
    Build a venue dict from the Tribe Events API venue object.
    Returns None if the venue object is empty or missing a name.
    """
    if not isinstance(venue_data, dict):
        return None

    park_name = (venue_data.get("venue") or "").strip()
    if not park_name:
        return None

    address = (venue_data.get("address") or "").strip()
    city = (venue_data.get("city") or "Atlanta").strip()
    state = (venue_data.get("state") or venue_data.get("stateprovince") or "GA").strip()
    zip_code = (venue_data.get("zip") or "").strip()

    # Build slug from park name
    slug = re.sub(r"[^a-z0-9]+", "-", park_name.lower()).strip("-")

    neighborhood = get_neighborhood_for_park(park_name)

    return {
        "name": park_name,
        "slug": slug,
        "address": address or None,
        "neighborhood": neighborhood,
        "city": city,
        "state": state,
        "zip": zip_code or None,
        "venue_type": "park",
        "spot_type": "park",
        "website": None,
    }


def _build_destination_envelope(venue_data: dict, venue_id: int) -> TypedEntityEnvelope | None:
    venue_type = str(venue_data.get("venue_type") or "").strip().lower()
    if venue_type != "park":
        return None

    envelope = TypedEntityEnvelope()
    envelope.add(
        "destination_details",
        {
            "venue_id": venue_id,
            "destination_type": "park",
            "commitment_tier": "halfday",
            "primary_activity": "family park visit",
            "best_seasons": ["spring", "summer", "fall"],
            "weather_fit_tags": ["outdoor", "free-option", "family-daytrip"],
            "family_suitability": "yes",
            "reservation_required": False,
            "permit_required": False,
            "fee_note": "Open park access is typically free; check event-specific pages for volunteer projects, festivals, or special programming.",
            "source_url": BASE_URL,
            "metadata": {
                "source_type": "family_destination_enrichment",
                "venue_type": venue_type,
                "city": str(venue_data.get("city") or "atlanta").lower(),
                "supports_org": "park_pride",
            },
        },
    )
    envelope.add(
        "venue_features",
        {
            "venue_id": venue_id,
            "slug": "free-outdoor-play-space",
            "title": "Free outdoor play space",
            "feature_type": "amenity",
            "description": "This public park is a free outdoor option for family time, open-air play, and pairing with nearby neighborhood outings.",
            "url": BASE_URL,
            "price_note": "Open park access is typically free.",
            "is_free": True,
            "sort_order": 10,
        },
    )
    return envelope


def determine_category_and_tags(
    title: str, description: str
) -> tuple[str, Optional[str], list[str]]:
    """Determine category/subcategory/tags from event title and description."""
    text = f"{title} {description}".lower()
    tags = ["volunteer", "nonprofit", "parks", "outdoors", "environment"]

    if any(kw in text for kw in VOLUNTEER_KEYWORDS):
        tags.append("volunteer-opportunity")

    if any(kw in text for kw in ["family", "kid", "children", "all ages"]):
        tags.append("family-friendly")

    if any(kw in text for kw in ["cleanup", "clean-up", "clean up"]):
        tags.append("cleanup")

    if any(kw in text for kw in ["garden", "gardening", "planting"]):
        tags.append("gardening")

    if any(kw in text for kw in ["tree", "trees", "arbor"]):
        tags.append("trees")

    if any(kw in text for kw in ["trail", "path", "greenway", "beltline"]):
        tags.append("trails")

    if any(kw in text for kw in ["training", "orientation", "workshop", "class"]):
        return "learning", "workshop", tags + ["education"]

    if any(kw in text for kw in ["fundraiser", "gala", "benefit"]):
        return "community", "fundraiser", tags + ["fundraiser"]

    if any(kw in text for kw in ["walk", "hike", "nature walk"]):
        return "community", "outdoor", tags + ["walking"]

    return "community", "volunteer", tags


def is_public_event(title: str, description: str) -> bool:
    """Return False for internal/non-public events."""
    text = f"{title} {description}".lower()
    return not any(kw in text for kw in SKIP_KEYWORDS)


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Park Pride events using The Events Calendar REST API."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    # Cache of park slug -> venue_id to avoid redundant DB lookups
    venue_cache: dict[str, int] = {}
    enriched_venue_slugs: set[str] = set()
    current_hashes: set[str] = set()

    try:
        # Ensure fallback venue exists
        fallback_venue_id = get_or_create_venue(FALLBACK_VENUE_DATA)

        headers = {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "application/json",
            "Referer": f"{BASE_URL}/events/",
        }

        page = 1
        per_page = 50
        max_pages = 10
        seen_keys: set[str] = set()

        while page <= max_pages:
            params = {
                "per_page": per_page,
                "page": page,
                "start_date": datetime.now().strftime("%Y-%m-%d"),
                "status": "publish",
            }

            logger.info(f"Fetching Park Pride events API page {page}")
            try:
                response = requests.get(
                    API_URL, params=params, headers=headers, timeout=30
                )
                response.raise_for_status()
            except requests.exceptions.RequestException as e:
                logger.error(f"Failed to fetch Park Pride events page {page}: {e}")
                break

            data = response.json()
            events = data.get("events", [])

            if not events:
                logger.info(f"No more events on page {page}")
                break

            logger.info(f"Processing {len(events)} events from page {page}")

            for event_data in events:
                try:
                    title = (event_data.get("title") or "").strip()
                    if not title or len(title) < 5:
                        continue

                    # Parse dates and times
                    start_date, start_time = parse_datetime(event_data.get("start_date"))
                    end_date, end_time = (
                        parse_datetime(event_data.get("end_date"))
                        if event_data.get("end_date")
                        else (None, None)
                    )

                    if not start_date:
                        logger.debug(f"No valid date for: {title}")
                        continue

                    # Description from HTML
                    description_html = event_data.get("description", "")
                    description = strip_html(description_html)[:800]

                    # Filter internal events
                    if not is_public_event(title, description):
                        logger.debug(f"Skipping internal event: {title}")
                        continue

                    # Dedupe by title + date within this crawl run
                    event_key = f"{title}|{start_date}"
                    if event_key in seen_keys:
                        continue
                    seen_keys.add(event_key)

                    # --- Venue: use per-event park data from API ---
                    venue_id = fallback_venue_id
                    venue_name_for_hash = "Park Pride"

                    api_venue = event_data.get("venue")
                    if api_venue:
                        venue_dict = build_venue_from_api(api_venue)
                        if venue_dict:
                            slug = venue_dict["slug"]
                            if slug not in venue_cache:
                                venue_cache[slug] = get_or_create_venue(venue_dict)
                            if slug not in enriched_venue_slugs:
                                destination_envelope = _build_destination_envelope(
                                    venue_dict, venue_cache[slug]
                                )
                                if destination_envelope is not None:
                                    persist_typed_entity_envelope(destination_envelope)
                                enriched_venue_slugs.add(slug)
                            venue_id = venue_cache[slug]
                            venue_name_for_hash = venue_dict["name"]

                    events_found += 1

                    # Category and tags
                    category, subcategory, tags = determine_category_and_tags(
                        title, description
                    )

                    # All-day flag from API
                    is_all_day = bool(event_data.get("all_day", False))

                    # Image — prefer the 'large' size if available
                    image_url = None
                    img = event_data.get("image")
                    if isinstance(img, dict):
                        sizes = img.get("sizes", {})
                        image_url = (
                            sizes.get("large", {}).get("url")
                            or sizes.get("slide", {}).get("url")
                            or img.get("url")
                        )

                    # Source URL
                    event_url = event_data.get("url", f"{BASE_URL}/events/")

                    # Determine if free (Park Pride volunteer events are always free)
                    cost = (event_data.get("cost") or "").strip()
                    is_free = not cost or "free" in cost.lower()

                    # Series hint for recurring "Second Friday Walk" events
                    series_hint = None
                    if re.search(r"second friday|monthly|weekly", title, re.IGNORECASE):
                        series_hint = {
                            "series_type": "recurring_show",
                            "series_title": re.sub(
                                r"\s*@\s*.+$", "", title
                            ).strip(),  # strip "@ Park Name" suffix
                            "frequency": "monthly"
                            if "second friday" in title.lower()
                            else "irregular",
                        }

                    # Generate content hash
                    content_hash = generate_content_hash(
                        title, venue_name_for_hash, start_date
                    )
                    current_hashes.add(content_hash)

                    event_record = {
                        "source_id": source_id,
                        "venue_id": venue_id,
                        "title": title[:200],
                        "description": description if description else None,
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
                        "price_note": None,
                        "is_free": is_free,
                        "source_url": event_url,
                        "ticket_url": event_url,
                        "image_url": image_url,
                        "raw_text": f"{title} {description}"[:500],
                        "extraction_confidence": 0.92,
                        "is_recurring": series_hint is not None,
                        "recurrence_rule": None,
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
                        logger.info(
                            f"Added: {title[:50]} on {start_date} @ {venue_name_for_hash}"
                        )
                    except Exception as e:
                        logger.error(f"Failed to insert event '{title}': {e}")

                except Exception as e:
                    logger.error(f"Error processing Park Pride event: {e}")
                    continue

            total_pages = data.get("total_pages", 1)
            if page >= total_pages:
                break

            page += 1

        stale_deleted = remove_stale_source_events(source_id, current_hashes)
        if stale_deleted:
            logger.info(
                "Removed %s stale Park Pride events after schedule refresh",
                stale_deleted,
            )

        logger.info(
            f"Park Pride crawl complete: {events_found} found, "
            f"{events_new} new, {events_updated} updated"
        )

    except requests.exceptions.RequestException as e:
        logger.error(f"Failed to fetch Park Pride events: {e}")
        raise
    except Exception as e:
        logger.error(f"Failed to crawl Park Pride: {e}")
        raise

    return events_found, events_new, events_updated
