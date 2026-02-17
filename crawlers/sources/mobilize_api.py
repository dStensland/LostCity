"""
Mobilize.us API aggregator crawler for Atlanta metro area.
Replaces slow Playwright-based per-org crawlers with direct API access.
API docs: https://github.com/mobilizeamerica/api (public events require no auth)
"""

from __future__ import annotations

import logging
import time
import requests
from datetime import datetime
from typing import Optional
from urllib.parse import urljoin

from db import get_or_create_venue, insert_event, find_event_by_hash, get_or_create_virtual_venue, smart_update_existing_event
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

# API Configuration
API_BASE = "https://api.mobilize.us/v1/"
ATLANTA_ZIP = "30303"
SEARCH_RADIUS_MILES = 25
MAX_EVENTS = 500
EVENTS_PER_PAGE = 100
REQUEST_DELAY = 0.5  # seconds between API calls

# Event type mapping: Mobilize event_type -> (category, tags)
EVENT_TYPE_MAP = {
    "CANVASS": ("community", ["activism", "canvassing", "voter-outreach"]),
    "PHONE_BANK": ("community", ["activism", "phone-banking", "voter-outreach"]),
    "TEXT_BANK": ("community", ["activism", "text-banking", "voter-outreach"]),
    "VOTER_REG": ("community", ["activism", "voter-registration"]),
    "RALLY": ("community", ["activism", "rally"]),
    "MARCH": ("community", ["activism", "rally", "march"]),
    "MEETING": ("community", ["activism", "civic-engagement"]),
    "COMMUNITY": ("community", ["activism", "civic-engagement"]),
    "FUNDRAISER": ("community", ["fundraiser"]),
    "ADVOCACY_CALL": ("community", ["activism", "advocacy"]),
    "TRAINING": ("learning", ["activism", "training"]),
    "TOWN_HALL": ("community", ["activism", "town-hall"]),
    "HOUSE_PARTY": ("community", ["activism", "social"]),
    "DEBATE_WATCH_PARTY": ("community", ["activism", "watch-party"]),
    "SIGNATURE_GATHERING": ("community", ["activism", "petition"]),
    "PETITION": ("community", ["activism", "petition"]),
    "TABLING": ("community", ["activism", "tabling"]),
    "LITERATURE_DROP_OFF": ("community", ["activism", "canvassing"]),
    "OTHER": ("community", ["activism"]),
}


def parse_datetime(unix_timestamp: Optional[int]) -> tuple[Optional[str], Optional[str]]:
    """Convert Unix timestamp to date and time strings."""
    if not unix_timestamp:
        return None, None

    try:
        dt = datetime.fromtimestamp(unix_timestamp)
        date_str = dt.strftime('%Y-%m-%d')
        time_str = dt.strftime('%H:%M:%S')
        return date_str, time_str
    except (ValueError, OSError):
        return None, None


def get_event_type_mapping(event_type: str) -> tuple[str, list[str]]:
    """Map Mobilize event type to category and tags."""
    return EVENT_TYPE_MAP.get(event_type, ("community", ["activism"]))


def fetch_events_page(page: int = 1) -> Optional[dict]:
    """Fetch a single page of events from Mobilize API."""
    try:
        url = urljoin(API_BASE, "events")
        params = {
            "zipcode": ATLANTA_ZIP,
            "max_dist": SEARCH_RADIUS_MILES,
            "visibility": "PUBLIC",
            "timeslot_start": "gte_now",
            "per_page": EVENTS_PER_PAGE,
            "page": page,
        }

        response = requests.get(url, params=params, timeout=30)

        if response.status_code == 429:
            logger.warning("Rate limited, waiting 30 seconds...")
            time.sleep(30)
            return fetch_events_page(page)  # Retry

        response.raise_for_status()
        return response.json()

    except Exception as e:
        logger.error(f"Error fetching events page {page}: {e}")
        return None


def discover_events(max_events: int = MAX_EVENTS) -> list[dict]:
    """Discover all events from Mobilize API with pagination."""
    all_events = []
    page = 1

    while len(all_events) < max_events:
        logger.info(f"Fetching page {page} from Mobilize API...")

        result = fetch_events_page(page)
        if not result:
            break

        events = result.get("data", [])
        if not events:
            logger.info("No more events found, stopping pagination")
            break

        all_events.extend(events)
        logger.info(f"Fetched {len(events)} events (total: {len(all_events)})")

        # Check if there are more pages
        if len(events) < EVENTS_PER_PAGE:
            logger.info("Last page reached")
            break

        page += 1
        time.sleep(REQUEST_DELAY)  # Be respectful to API

    logger.info(f"Discovered {len(all_events)} total events from Mobilize API")
    return all_events[:max_events]


def process_location(location_data: dict) -> Optional[dict]:
    """Convert Mobilize location to venue data."""
    if not location_data:
        return None

    venue_name = location_data.get("venue", "").strip()
    if not venue_name or venue_name.lower() in ["tbd", "tba", "online", "virtual"]:
        venue_name = "Community Location"

    address_lines = location_data.get("address_lines", [])
    address = address_lines[0] if address_lines else None

    city = location_data.get("locality", "").strip()
    state = location_data.get("region", "").strip()
    zip_code = location_data.get("postal_code", "").strip()

    # Skip if not in Georgia
    if state and state not in ["GA", "Georgia"]:
        return None

    # Generate slug
    import re
    slug = re.sub(r'[^a-z0-9]+', '-', venue_name.lower()).strip('-')[:50]

    venue_data = {
        "name": venue_name,
        "slug": slug,
        "address": address,
        "city": city or "Atlanta",
        "state": "GA",
        "zip": zip_code,
        "lat": location_data.get("lat"),
        "lng": location_data.get("lon"),
        "venue_type": "event_space",
    }

    return venue_data


def expand_timeslots(event_data: dict) -> list[dict]:
    """
    Expand a Mobilize event into individual occurrences based on timeslots.
    Each timeslot becomes a separate event in our system.

    Returns list of event dicts ready for processing.
    """
    timeslots = event_data.get("timeslots", [])
    if not timeslots:
        return []

    # Base event info
    title = event_data.get("title", "").strip()
    description = event_data.get("description", "").strip()
    summary = event_data.get("summary", "").strip()

    # Use summary as description if description is empty
    if not description and summary:
        description = summary

    # Truncate description
    if description and len(description) > 2000:
        description = description[:2000]

    event_type = event_data.get("event_type", "OTHER")
    is_virtual = event_data.get("is_virtual", False)
    browser_url = event_data.get("browser_url", "")
    image_url = event_data.get("featured_image_url")

    location = event_data.get("location")
    sponsor = event_data.get("sponsor", {})
    sponsor_name = sponsor.get("name", "Mobilize") if sponsor else "Mobilize"

    # Generate individual events for each timeslot
    expanded_events = []
    for timeslot in timeslots:
        start_date, start_time = parse_datetime(timeslot.get("start_date"))
        end_date, end_time = parse_datetime(timeslot.get("end_date"))

        if not start_date:
            continue

        expanded_events.append({
            "title": title,
            "description": description,
            "start_date": start_date,
            "start_time": start_time,
            "end_date": end_date,
            "end_time": end_time,
            "event_type": event_type,
            "is_virtual": is_virtual,
            "browser_url": browser_url,
            "image_url": image_url,
            "location": location,
            "sponsor_name": sponsor_name,
            "timeslot_id": timeslot.get("id"),
        })

    return expanded_events


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl Mobilize.us API for Atlanta metro area events.

    Args:
        source: Source dict with 'id', 'slug', etc.

    Returns:
        Tuple of (events_found, events_new, events_updated)
    """
    source_id = source['id']
    producer_id = source.get('producer_id')

    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        # Step 1: Discover events from API
        logger.info("Discovering events from Mobilize API...")
        api_events = discover_events(max_events=MAX_EVENTS)

        if not api_events:
            logger.warning("No events discovered from API")
            return 0, 0, 0

        # Step 2: Expand timeslots and process each event
        logger.info(f"Processing {len(api_events)} events from API...")

        # Track series for events with 3+ timeslots
        series_candidates = {}

        for api_event in api_events:
            try:
                # Expand into individual occurrences
                expanded = expand_timeslots(api_event)

                # Track if this should be a series (3+ occurrences)
                if len(expanded) >= 3:
                    title = api_event.get("title", "").strip()
                    event_type = api_event.get("event_type", "OTHER")
                    location = api_event.get("location", {})
                    venue_name = location.get("venue", "Community Location") if location else "Community Location"

                    # Create series hint key
                    series_key = f"{title}|{venue_name}"
                    series_candidates[series_key] = {
                        "series_type": "recurring_show",
                        "series_title": title,
                        "frequency": "irregular",
                    }

                for event_occurrence in expanded:
                    try:
                        events_found += 1

                        # Log progress
                        if events_found % 50 == 0:
                            logger.info(f"Progress: {events_found} events processed, {events_new} new")

                        title = event_occurrence["title"]
                        start_date = event_occurrence["start_date"]
                        start_time = event_occurrence["start_time"]
                        end_date = event_occurrence["end_date"]
                        end_time = event_occurrence["end_time"]

                        if not title or not start_date:
                            continue

                        # Get or create venue
                        venue_id = None
                        venue_name = "Mobilize"

                        if event_occurrence["is_virtual"]:
                            venue_id = get_or_create_virtual_venue()
                            venue_name = "Online / Virtual Event"
                        elif event_occurrence["location"]:
                            venue_data = process_location(event_occurrence["location"])
                            if venue_data:
                                venue_name = venue_data["name"]
                                venue_id = get_or_create_venue(venue_data)

                        # Get category and tags
                        event_type = event_occurrence["event_type"]
                        category, base_tags = get_event_type_mapping(event_type)

                        # Build tags list
                        tags = ["mobilize"] + base_tags

                        # Add sponsor name to tags for tracking
                        sponsor_name = event_occurrence["sponsor_name"]
                        if sponsor_name and sponsor_name != "Mobilize":
                            sponsor_slug = sponsor_name.lower().replace(" ", "-")[:30]
                            tags.append(sponsor_slug)

                        # Generate content hash for dedup
                        content_hash = generate_content_hash(title, venue_name, start_date)

                        # Check if this should be part of a series
                        series_key = f"{title}|{venue_name}"
                        series_hint = series_candidates.get(series_key)

                        # Build event record
                        event_record = {
                            "source_id": source_id,
                            "venue_id": venue_id,
                            "producer_id": producer_id,
                            "title": title[:500],
                            "description": event_occurrence.get("description"),
                            "start_date": start_date,
                            "start_time": start_time,
                            "end_date": end_date,
                            "end_time": end_time,
                            "is_all_day": False,
                            "category": category,
                            "tags": tags,
                            "price_min": None,
                            "price_max": None,
                            "price_note": None,
                            "is_free": True,  # Most Mobilize events are free volunteer/activism
                            "source_url": event_occurrence["browser_url"],
                            "ticket_url": event_occurrence["browser_url"],
                            "image_url": event_occurrence.get("image_url"),
                            "raw_text": None,
                            "extraction_confidence": 0.95,
                            "is_recurring": len(expanded) >= 3,
                            "recurrence_rule": None,
                            "content_hash": content_hash,
                        }

                        # Check if already exists
                        existing = find_event_by_hash(content_hash)
                        if existing:
                            smart_update_existing_event(existing, event_record)
                            events_updated += 1
                            continue

                        # Insert event
                        try:
                            insert_event(event_record, series_hint=series_hint)
                            events_new += 1
                            logger.debug(f"Added: {title[:60]}... on {start_date}")
                        except Exception as e:
                            logger.error(f"Failed to insert event: {title[:60]}: {e}")

                    except Exception as e:
                        logger.error(f"Error processing event occurrence: {e}")
                        continue

            except Exception as e:
                logger.error(f"Error processing API event: {e}")
                continue

        logger.info(
            f"Mobilize API crawl complete: {events_found} found, {events_new} new, {events_updated} existing"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Mobilize API: {e}")
        raise

    return events_found, events_new, events_updated
