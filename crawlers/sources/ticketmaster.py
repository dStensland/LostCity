"""
Crawler for Ticketmaster Discovery API.
Fetches events from all Ticketmaster venues in Atlanta.

API Docs: https://developer.ticketmaster.com/products-and-docs/apis/discovery-api/v2/
"""

from __future__ import annotations

import os
import logging
import re
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


def _clean_text(value: Optional[str]) -> str:
    if not value:
        return ""
    return " ".join(str(value).split()).strip()


def _normalize_tm_title(title: str) -> str:
    """Normalize Ticketmaster title for dedup.

    Strips ticket-tier suffixes like '(2)', '(Section 100)', '(Floor)',
    '(GA)' etc. and collapses repeated whitespace.  Case normalization
    happens downstream in generate_content_hash via normalize_text(), but
    we also title-case here so the stored title is readable.

    Examples:
        "Lady Gaga (2)"           -> "Lady Gaga"
        "LADY GAGA"               -> "LADY GAGA"  (case kept for display)
        "Beyoncé (Section 100)"   -> "Beyoncé"
        "Hozier (Floor)"          -> "Hozier"
        "SZA (GA)"                -> "SZA"
        "Bad Bunny (VIP)"         -> "Bad Bunny"
    """
    if not title:
        return title
    # Strip bare numeric suffixes: " (2)", " (10)", etc.
    title = re.sub(r'\s*\(\d+\)\s*$', '', title)
    # Strip named ticket-tier / section suffixes (case-insensitive).
    title = re.sub(
        r'\s*\((?:Section|Floor|GA|VIP|Pit|Lawn|Balcony|Club|Loge|Suite|General\s*Admission)\s*\d*\)\s*$',
        '',
        title,
        flags=re.IGNORECASE,
    )
    return title.strip()


_ATTRACTION_REJECT_TERMS = {
    "parking",
    "vip package",
    "ticket package",
    "premium seating",
    "fast lane",
    "meet and greet",
}

_NON_EVENT_TITLE_PATTERNS = [
    re.compile(r"\bsuite pass(?:es)?\b", re.IGNORECASE),
    re.compile(r"\bitem voucher\b", re.IGNORECASE),
    re.compile(r"\bpost game access\b", re.IGNORECASE),
    re.compile(r"\b(?:ticket|experience)\s*add[- ]?on\b", re.IGNORECASE),
    re.compile(r"\bhospitality\b.*\badd[- ]?ons?\b", re.IGNORECASE),
    re.compile(r"\badd[- ]?ons?\b", re.IGNORECASE),
    re.compile(r"\bnot a concert ticket\b", re.IGNORECASE),
    re.compile(r"\bparking\b", re.IGNORECASE),
]


def _should_skip_event_title(title: str) -> bool:
    text = _clean_text(title)
    if not text:
        return True
    lowered = text.lower()
    if lowered in {"tbd", "to be announced"}:
        return True
    return any(pattern.search(text) for pattern in _NON_EVENT_TITLE_PATTERNS)


def _build_parsed_artists(attractions: list[dict]) -> list[dict]:
    parsed: list[dict] = []
    seen: set[str] = set()
    for idx, attraction in enumerate(attractions, start=1):
        name = _clean_text((attraction or {}).get("name"))
        if not name:
            continue
        key = name.lower()
        if key in seen:
            continue
        if any(term in key for term in _ATTRACTION_REJECT_TERMS):
            continue
        seen.add(key)
        parsed.append(
            {
                "name": name,
                "role": "headliner" if idx == 1 else "support",
                "billing_order": idx,
                "is_headliner": idx == 1,
            }
        )
    return parsed


def _format_time_label(time_value: Optional[str]) -> Optional[str]:
    if not time_value:
        return None
    raw = str(time_value).strip()
    if not raw:
        return None
    for fmt in ("%H:%M", "%H:%M:%S"):
        try:
            return datetime.strptime(raw, fmt).strftime("%-I:%M %p")
        except ValueError:
            continue
    return raw


def _format_price_note(price_min: Optional[float], price_max: Optional[float]) -> Optional[str]:
    if price_min is None and price_max is None:
        return None
    if price_min is not None and price_max is not None:
        if float(price_min) == float(price_max):
            return f"Ticket price: ${float(price_min):.0f}."
        return f"Ticket range: ${float(price_min):.0f}-${float(price_max):.0f}."
    if price_min is not None:
        return f"Tickets from ${float(price_min):.0f}."
    return f"Tickets up to ${float(price_max):.0f}."


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


def _build_structured_description(
    *,
    title: str,
    current_description: Optional[str],
    category: str,
    genre: Optional[str],
    attractions: list[str],
    venue_data: Optional[dict],
    start_date: str,
    start_time: Optional[str],
    price_min: Optional[float],
    price_max: Optional[float],
    source_url: str,
) -> str:
    parts: list[str] = []
    base = _clean_text(current_description)
    if base and not _is_low_quality_description(base):
        parts.append(base if base.endswith(".") else f"{base}.")
    else:
        category_label = category.replace("_", " ").strip().title() if category else "Live"
        descriptor = f"{category_label} event"
        if genre:
            descriptor = f"{genre} {category_label.lower()} event"
        parts.append(f"{title} is a {descriptor}.")

    if attractions:
        parts.append(f"Lineup includes {', '.join(attractions[:3])}.")

    if venue_data:
        venue_name = _clean_text(venue_data.get("name"))
        venue_city = _clean_text(venue_data.get("city")) or "Atlanta"
        venue_state = _clean_text(venue_data.get("state")) or "GA"
        if venue_name:
            parts.append(f"Location: {venue_name}, {venue_city}, {venue_state}.")

    time_label = _format_time_label(start_time)
    if start_date and time_label:
        parts.append(f"Scheduled on {start_date} at {time_label}.")
    elif start_date:
        parts.append(f"Scheduled on {start_date}.")

    price_note = _format_price_note(price_min, price_max)
    if price_note:
        parts.append(price_note)

    if source_url:
        parts.append(f"Check Ticketmaster for latest lineup updates and ticket availability ({source_url}).")
    else:
        parts.append("Check Ticketmaster for latest lineup updates and ticket availability.")

    return " ".join(parts)[:1600]


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
        # Basic info — normalize before any further use so the cleaned title
        # flows into both the stored record and the content hash.
        title = _normalize_tm_title(event_data.get("name", "").strip())
        if not title:
            return None
        if _should_skip_event_title(title):
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

        # Images - get the highest resolution, filtering out TM category placeholders
        images = event_data.get("images", [])
        image_url = None
        images_list = []
        if images:
            # Filter out generic TM category placeholders (/dam/c/ = category, /dam/a/ = attraction)
            event_specific = [img for img in images if "/dam/c/" not in (img.get("url") or "")]
            pool = event_specific if event_specific else images
            # Sort by width descending and get largest
            sorted_images = sorted(
                pool, key=lambda x: x.get("width", 0), reverse=True
            )
            image_url = sorted_images[0].get("url") if sorted_images else None
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

        attractions = event_data.get("_embedded", {}).get("attractions", [])
        parsed_artists = _build_parsed_artists(
            [a for a in attractions if isinstance(a, dict)]
        )

        # Try detail page enrichment if description is low quality
        if DETAIL_ENRICH and source_url and _is_low_quality_description(description):
            enriched_description = _fetch_detail_description(source_url)
            if enriched_description and (not description or len(enriched_description) > len(description)):
                description = enriched_description

        # If still low quality, store None — no description is better than
        # auto-generated boilerplate like "X is a Other event."
        if _is_low_quality_description(description):
            description = None

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
            "_parsed_artists": parsed_artists,
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

                # Skip events with no usable link — they can't be actioned by a user.
                if not parsed.get("source_url") and not parsed.get("ticket_url"):
                    logger.debug("Skipping event with no URL: %s", parsed.get("title", ""))
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

                # Build tags — no source tags (they leak to UI)
                tags = ["ticketed"]
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
