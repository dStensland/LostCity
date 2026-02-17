"""
Crawler for Ticketmaster Discovery API.
Fetches events from all Ticketmaster venues in Atlanta.

API Docs: https://developer.ticketmaster.com/products-and-docs/apis/discovery-api/v2/
"""

from __future__ import annotations

import os
import logging
from datetime import datetime, timedelta
from typing import Optional

import requests

from utils import slugify
from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash
from extractors.structured import extract_jsonld_event_fields, extract_open_graph_fields

logger = logging.getLogger(__name__)

API_KEY = os.getenv("TICKETMASTER_API_KEY")
BASE_URL = "https://app.ticketmaster.com/discovery/v2"
DETAIL_ENRICH = os.getenv("TICKETMASTER_ENRICH_DETAIL", "1") != "0"
DETAIL_TIMEOUT = int(os.getenv("TICKETMASTER_DETAIL_TIMEOUT", "12"))
DETAIL_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"

# Atlanta area - using lat/long for better coverage
ATLANTA_LATLONG = "33.749,-84.388"
RADIUS = "30"  # miles

# Category mapping from Ticketmaster segments to our categories
SEGMENT_MAP = {
    "Music": "music",
    "Sports": "sports",
    "Arts & Theatre": "theater",
    "Film": "film",
    "Miscellaneous": "other",
    "Undefined": "other",
}

# Genre to canonical genre slug mapping (used for genres[] field)
GENRE_MAP = {
    "Rock": "rock",
    "Pop": "pop",
    "Hip-Hop/Rap": "hip-hop",
    "R&B": "r-and-b",
    "Country": "country",
    "Jazz": "jazz",
    "Classical": "classical",
    "Comedy": "stand-up",
    "Alternative": "alternative",
    "Metal": "metal",
    "Electronic": "electronic",
    "Folk": "folk",
    "Blues": "blues",
    "Latin": "latin",
    "Reggae": "reggae",
    "World": "world",
    "Soul/Funk": "soul",
    "Gospel/Christian": "gospel",
    "Punk": "punk",
}


def _is_low_quality_description(description: Optional[str]) -> bool:
    if not description:
        return True
    if len(description) < 120:
        return True
    lowered = description.lower()
    return lowered.startswith(
        (
            "event at ",
            "music event at ",
            "sports event at ",
            "theatre event at ",
            "dance event at ",
            "other event at ",
        )
    )


def _fetch_detail_description(url: str) -> Optional[str]:
    if not url:
        return None
    try:
        resp = requests.get(url, headers={"User-Agent": DETAIL_UA}, timeout=DETAIL_TIMEOUT)
        if not resp.ok:
            return None
        html = resp.text
        jsonld = extract_jsonld_event_fields(html)
        description = jsonld.get("description")
        if description:
            return description
        og = extract_open_graph_fields(html)
        return og.get("description")
    except Exception as e:
        logger.debug("Ticketmaster detail fetch failed for %s: %s", url, e)
        return None


def fetch_events(page: int = 0, size: int = 200) -> dict:
    """Fetch events from Ticketmaster API."""
    if not API_KEY:
        raise ValueError("TICKETMASTER_API_KEY environment variable not set")

    # Get events for the next 3 months
    start_date = datetime.now().strftime("%Y-%m-%dT%H:%M:%SZ")
    end_date = (datetime.now() + timedelta(days=90)).strftime("%Y-%m-%dT%H:%M:%SZ")

    params = {
        "apikey": API_KEY,
        "latlong": ATLANTA_LATLONG,
        "radius": RADIUS,
        "unit": "miles",
        "startDateTime": start_date,
        "endDateTime": end_date,
        "size": size,
        "page": page,
        "sort": "date,asc",
    }

    response = requests.get(f"{BASE_URL}/events.json", params=params, timeout=30)
    response.raise_for_status()
    return response.json()


def parse_event(event_data: dict) -> Optional[dict]:
    """Parse a single event from Ticketmaster API response."""
    try:
        # Basic info
        title = event_data.get("name", "").strip()
        if not title:
            return None

        # Dates
        dates = event_data.get("dates", {})
        start = dates.get("start", {})

        start_date = start.get("localDate")
        if not start_date:
            return None

        start_time = start.get("localTime")
        if start_time:
            start_time = start_time[:5]  # HH:MM

        # Venue
        venues = event_data.get("_embedded", {}).get("venues", [])
        venue_data = None
        if venues:
            v = venues[0]
            address = v.get("address", {})
            city = v.get("city", {})
            state = v.get("state", {})

            venue_data = {
                "name": v.get("name", ""),
                "slug": slugify(v.get("name", "")),
                "address": address.get("line1"),
                "city": city.get("name", "Atlanta"),
                "state": state.get("stateCode", "GA"),
                "zip": v.get("postalCode"),
                "venue_type": "venue",
                "website": v.get("url"),
            }

        # Category from segment
        classifications = event_data.get("classifications", [])
        category = "other"
        genres = []
        genre = None

        if classifications:
            c = classifications[0]
            segment = c.get("segment", {}).get("name", "")
            category = SEGMENT_MAP.get(segment, "other")

            genre_data = c.get("genre", {})
            genre = genre_data.get("name")
            if genre:
                mapped = GENRE_MAP.get(genre)
                if mapped:
                    genres = [mapped]

        # Prices
        price_ranges = event_data.get("priceRanges", [])
        price_min = None
        price_max = None
        if price_ranges:
            price_min = price_ranges[0].get("min")
            price_max = price_ranges[0].get("max")

        # Images - get the highest resolution
        images = event_data.get("images", [])
        image_url = None
        images_list = []
        if images:
            # Sort by width descending and get largest
            sorted_images = sorted(
                images, key=lambda x: x.get("width", 0), reverse=True
            )
            image_url = sorted_images[0].get("url")
            for img in sorted_images:
                url = img.get("url")
                if not url:
                    continue
                images_list.append(
                    {
                        "url": url,
                        "width": img.get("width"),
                        "height": img.get("height"),
                        "type": img.get("ratio"),
                        "is_primary": url == image_url,
                    }
                )

        # URLs
        source_url = event_data.get("url", "")

        # Description/info - check multiple fields
        description = event_data.get("info") or event_data.get("pleaseNote") or event_data.get("description")

        # Check _embedded.attractions for artist/performer descriptions
        if not description:
            attractions = event_data.get("_embedded", {}).get("attractions", [])
            if attractions:
                attr = attractions[0]
                description = attr.get("description") or attr.get("additionalInfo")

        # Synthetic fallback from genre + venue
        if not description and genre and venue_data:
            description = f"{genre} event at {venue_data['name']}."
        elif not description and venue_data:
            description = f"Event at {venue_data['name']}."

        if DETAIL_ENRICH and source_url and _is_low_quality_description(description):
            enriched_description = _fetch_detail_description(source_url)
            if enriched_description and (not description or len(enriched_description) > len(description)):
                description = enriched_description

        links = []
        if source_url:
            links.append({"type": "event", "url": source_url})
            links.append({"type": "ticket", "url": source_url})

        return {
            "title": title,
            "description": description,
            "start_date": start_date,
            "start_time": start_time,
            "source_url": source_url,
            "ticket_url": source_url,
            "image_url": image_url,
            "images": images_list,
            "links": links,
            "category": category,
            "genres": genres,
            "price_min": price_min,
            "price_max": price_max,
            "venue": venue_data,
            "ticketmaster_id": event_data.get("id"),
        }

    except Exception as e:
        logger.warning(f"Failed to parse event: {e}")
        return None


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Ticketmaster events for Atlanta area."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0
    seen_ids = set()

    if not API_KEY:
        logger.error("TICKETMASTER_API_KEY not set - skipping Ticketmaster crawl")
        return 0, 0, 0

    try:
        page = 0
        total_pages = 1

        while page < total_pages:
            logger.info(f"Fetching Ticketmaster page {page + 1}/{total_pages}")

            data = fetch_events(page=page)

            # Get pagination info
            page_info = data.get("page", {})
            total_pages = min(
                page_info.get("totalPages", 1), 5
            )  # Limit to 5 pages (1000 events)

            # Get events
            embedded = data.get("_embedded", {})
            events = embedded.get("events", [])

            if not events:
                break

            logger.info(f"Found {len(events)} events on page {page + 1}")

            for event_data in events:
                # Skip duplicates (same event listed multiple times)
                tm_id = event_data.get("id")
                if tm_id in seen_ids:
                    continue
                seen_ids.add(tm_id)

                parsed = parse_event(event_data)
                if not parsed:
                    continue

                events_found += 1

                # Get or create venue
                venue_id = None
                venue_info = parsed.get("venue")
                if venue_info and venue_info.get("name"):
                    try:
                        venue_id = get_or_create_venue(venue_info)
                    except Exception as e:
                        logger.warning(
                            f"Failed to create venue {venue_info['name']}: {e}"
                        )

                # Generate content hash
                venue_name = venue_info.get("name", "") if venue_info else ""
                content_hash = generate_content_hash(
                    parsed["title"], venue_name, parsed["start_date"]
                )

                # Check for existing

                # Build tags
                tags = ["ticketmaster"]
                if parsed.get("genre"):
                    tags.append(parsed["genre"].lower())

                event_record = {
                    "source_id": source_id,
                    "venue_id": venue_id,
                    "title": parsed["title"],
                    "description": parsed.get("description"),
                    "start_date": parsed["start_date"],
                    "start_time": parsed.get("start_time"),
                    "end_date": None,
                    "end_time": None,
                    "is_all_day": parsed.get("start_time") is None,
                    "category": parsed.get("category", "other"),
                    "genres": parsed.get("genres") or [],
                    "tags": tags,
                    "price_min": parsed.get("price_min"),
                    "price_max": parsed.get("price_max"),
                    "price_note": None,
                    "is_free": (
                        parsed.get("price_min") == 0
                        if parsed.get("price_min") is not None
                        else False
                    ),
                    "source_url": parsed["source_url"],
                    "ticket_url": parsed["ticket_url"],
                    "image_url": parsed.get("image_url"),
                    "raw_text": None,
                    "extraction_confidence": 0.95,  # High confidence from structured API
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
                    logger.debug(f"Added: {parsed['title']}")
                except Exception as e:
                    logger.error(f"Failed to insert: {parsed['title']}: {e}")

            page += 1

        logger.info(
            f"Ticketmaster crawl complete: {events_found} found, {events_new} new"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Ticketmaster: {e}")
        raise

    return events_found, events_new, events_updated
