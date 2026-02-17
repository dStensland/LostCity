"""
Example Nashville crawler implementations.

This file demonstrates the crawler patterns for Nashville sources.
Copy and adapt these templates when building new Nashville crawlers.

NOT A WORKING CRAWLER - TEMPLATE ONLY
"""

from __future__ import annotations

import re
import logging
from datetime import datetime
from typing import Optional

import requests
from bs4 import BeautifulSoup

from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash
from utils import slugify

logger = logging.getLogger(__name__)


# ============================================================================
# TEMPLATE 1: Simple Venue Crawler (e.g., Ryman Auditorium)
# ============================================================================

def crawl_ryman_auditorium(source: dict) -> tuple[int, int, int]:
    """
    Template for crawling a single venue with structured event listings.

    Use this pattern for:
    - Grand Ole Opry
    - Ryman Auditorium
    - Bridgestone Arena
    - Exit/In
    - Most dedicated music venues
    """
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    # Venue data - store once in venues table
    VENUE_DATA = {
        "name": "Ryman Auditorium",
        "slug": "ryman-auditorium",
        "address": "116 5th Ave N",
        "neighborhood": "Downtown",
        "city": "Nashville",
        "state": "TN",
        "zip": "37219",
        "lat": 36.1611,
        "lng": -86.7785,
        "venue_type": "music_venue",
        "website": "https://www.ryman.com",
        "vibes": ["historic", "legendary", "acoustic", "iconic", "mother-church"]
    }

    venue_id = get_or_create_venue(VENUE_DATA)

    # Fetch events page
    url = "https://www.ryman.com/events"
    response = requests.get(url, timeout=30)
    response.raise_for_status()
    soup = BeautifulSoup(response.text, "html.parser")

    # Parse event listings
    # NOTE: This is pseudocode - actual selectors will vary by site
    event_cards = soup.find_all("div", class_="event-card")

    for card in event_cards:
        try:
            title = card.find("h3", class_="event-title").text.strip()
            date_str = card.find("time", class_="event-date")["datetime"]
            ticket_url = card.find("a", class_="buy-tickets")["href"]

            # Parse date (ISO format)
            start_date = datetime.fromisoformat(date_str).strftime("%Y-%m-%d")
            start_time = datetime.fromisoformat(date_str).strftime("%H:%M")

            # Generate content hash for deduplication
            content_hash = generate_content_hash(title, "Ryman Auditorium", start_date)


            # Create event record
            event_record = {
                "source_id": source_id,
                "venue_id": venue_id,
                "title": title,
                "description": None,  # Extract if available
                "start_date": start_date,
                "start_time": start_time,
                "end_date": None,
                "end_time": None,
                "is_all_day": False,
                "category": "music",
                "subcategory": None,  # Let AI extract from title
                "tags": [],
                "price_min": None,
                "price_max": None,
                "price_note": None,
                "is_free": False,
                "source_url": url,
                "ticket_url": ticket_url if ticket_url else url,
                "image_url": None,  # Extract if available
                "raw_text": f"{title}",
                "extraction_confidence": 0.85,
                "is_recurring": False,
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
            events_found += 1
            logger.info(f"Added: {title} on {start_date}")

        except Exception as e:
            logger.error(f"Failed to parse event: {e}")
            continue

    logger.info(
        f"Ryman crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
    )
    return events_found, events_new, events_updated


# ============================================================================
# TEMPLATE 2: Honky-Tonk Continuous Music Generator
# ============================================================================

def create_honky_tonk_continuous_events(source: dict) -> tuple[int, int, int]:
    """
    Template for honky-tonks without formal event listings.

    These venues have live music 11am-2am daily but don't post schedules.
    Create recurring "Live Music" events to help users discover them.

    Use this pattern for:
    - Tootsie's Orchid Lounge
    - Robert's Western World
    - Layla's Bluegrass Inn
    - Legends Corner
    - Most Broadway honky-tonks
    """
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    # List of honky-tonks
    HONKY_TONKS = [
        {
            "name": "Tootsie's Orchid Lounge",
            "slug": "tootsies",
            "address": "422 Broadway",
            "description": "Iconic purple honky-tonk. 3 floors of live music, no cover.",
        },
        {
            "name": "Robert's Western World",
            "slug": "roberts-western-world",
            "address": "416 Broadway",
            "description": "Home of the $6 Recession Special: fried bologna, chips, PBR.",
        },
        {
            "name": "Layla's Bluegrass Inn",
            "slug": "laylas-bluegrass-inn",
            "address": "418 Broadway",
            "description": "3 floors of country and bluegrass music.",
        },
        # Add remaining 9 honky-tonks here
    ]

    # Create venue and recurring event for each
    for honky_tonk in HONKY_TONKS:
        venue_data = {
            "name": honky_tonk["name"],
            "slug": honky_tonk["slug"],
            "address": honky_tonk["address"],
            "neighborhood": "Downtown",
            "city": "Nashville",
            "state": "TN",
            "venue_type": "honky_tonk",
            "website": f"https://{honky_tonk['slug']}.com",  # Update with actual URLs
            "vibes": ["honky-tonk", "country", "live-music", "no-cover", "walk-ins"]
        }

        venue_id = get_or_create_venue(venue_data)

        # Generate next 30 days of events
        from datetime import timedelta
        today = datetime.now().date()

        for i in range(30):
            event_date = (today + timedelta(days=i)).strftime("%Y-%m-%d")

            content_hash = generate_content_hash(
                f"Live Music at {honky_tonk['name']}",
                honky_tonk["slug"],
                event_date
            )

            existing = find_event_by_hash(content_hash)
            if existing:
                smart_update_existing_event(existing, event_record)
                events_updated += 1
                continue

            event_record = {
                "source_id": source_id,
                "venue_id": venue_id,
                "title": f"Live Music at {honky_tonk['name']}",
                "description": f"{honky_tonk['description']} Continuous live country music featuring rotating artists. Check venue social media for today's lineup.",
                "start_date": event_date,
                "start_time": "11:00",
                "end_date": event_date,
                "end_time": "02:00",  # Next day 2am
                "is_all_day": False,
                "category": "music",
                "subcategory": "country",
                "tags": ["honky-tonk", "live-music", "country", "walk-ins", "no-cover", "broadway"],
                "price_min": None,
                "price_max": None,
                "price_note": "No cover charge",
                "is_free": True,
                "source_url": venue_data["website"],
                "ticket_url": None,
                "image_url": None,
                "raw_text": honky_tonk["description"],
                "extraction_confidence": 0.70,  # Lower since not from explicit listing
                "is_recurring": True,
                "recurrence_rule": "FREQ=DAILY",
                "content_hash": content_hash,
            }

            insert_event(event_record)
            events_new += 1
            events_found += 1

    logger.info(f"Honky-tonk events created: {events_found} total")
    return events_found, events_new, events_updated


# ============================================================================
# TEMPLATE 3: Aggregator Crawler (e.g., Nashville Scene, Do615)
# ============================================================================

def crawl_nashville_scene_events(source: dict) -> tuple[int, int, int]:
    """
    Template for crawling event aggregator sites.

    These sites list events from multiple venues. Need to:
    1. Extract event details
    2. Match/create venues
    3. Handle various categories

    Use this pattern for:
    - Nashville Scene
    - Do615
    - Visit Music City
    """
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    url = "https://www.nashvillescene.com/events"
    response = requests.get(url, timeout=30)
    response.raise_for_status()
    soup = BeautifulSoup(response.text, "html.parser")

    # Parse event listings
    event_cards = soup.find_all("div", class_="event-item")

    for card in event_cards:
        try:
            # Extract event details
            title = card.find("h2").text.strip()
            venue_name = card.find("div", class_="venue").text.strip()
            date_str = card.find("time")["datetime"]
            category_tag = card.find("span", class_="category").text.strip().lower()

            # Parse date
            start_date = datetime.fromisoformat(date_str).strftime("%Y-%m-%d")

            # Map to our categories
            category = map_category(category_tag)

            # Get or create venue (may be new)
            venue_data = {
                "name": venue_name,
                "slug": slugify(venue_name),
                "city": "Nashville",
                "state": "TN",
                "venue_type": "venue",  # Generic for now
            }
            venue_id = get_or_create_venue(venue_data)

            # Generate content hash
            content_hash = generate_content_hash(title, venue_name, start_date)

            existing = find_event_by_hash(content_hash)
            if existing:
                smart_update_existing_event(existing, event_record)
                events_updated += 1
                continue

            event_record = {
                "source_id": source_id,
                "venue_id": venue_id,
                "title": title,
                "start_date": start_date,
                "category": category,
                "content_hash": content_hash,
                # ... other fields
            }

            insert_event(event_record)
            events_new += 1
            events_found += 1

        except Exception as e:
            logger.error(f"Failed to parse event: {e}")
            continue

    return events_found, events_new, events_updated


def map_category(tag: str) -> str:
    """Map Nashville Scene categories to our taxonomy."""
    mapping = {
        "live music": "music",
        "nightlife": "nightlife",
        "food & drink": "food_drink",
        "arts": "art",
        "theater": "theater",
        "comedy": "comedy",
        "family": "family",
        "sports": "sports",
    }
    return mapping.get(tag, "other")


# ============================================================================
# TEMPLATE 4: Songwriter Round / Special Format
# ============================================================================

def crawl_bluebird_cafe(source: dict) -> tuple[int, int, int]:
    """
    Template for songwriter round venues.

    Songwriter rounds are unique to Nashville:
    - Multiple songwriters perform
    - Acoustic, intimate format
    - Often require advance reservations
    - May have "in-the-round" format (circular seating)

    Use this pattern for:
    - Bluebird Cafe
    - The Listening Room Cafe
    - Douglas Corner Cafe
    """
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    VENUE_DATA = {
        "name": "Bluebird Cafe",
        "slug": "bluebird-cafe",
        "address": "4104 Hillsboro Pike",
        "neighborhood": "Green Hills",
        "city": "Nashville",
        "state": "TN",
        "zip": "37215",
        "venue_type": "listening_room",
        "website": "https://www.bluebirdcafe.com",
        "vibes": ["songwriter", "acoustic", "intimate", "legendary", "reservations"]
    }

    venue_id = get_or_create_venue(VENUE_DATA)

    # Bluebird typically posts monthly schedules
    url = "https://www.bluebirdcafe.com/calendar"
    response = requests.get(url, timeout=30)
    response.raise_for_status()

    # Parse songwriter rounds
    # NOTE: Actual parsing logic depends on site structure
    # This is pseudocode

    soup = BeautifulSoup(response.text, "html.parser")
    rounds = soup.find_all("div", class_="songwriter-round")

    for round_event in rounds:
        try:
            # Extract songwriters
            writers = round_event.find_all("span", class_="writer")
            writer_names = [w.text.strip() for w in writers]

            # Create title with all writers
            title = f"Songwriter Round: {', '.join(writer_names)}"

            date_str = round_event.find("time")["datetime"]
            start_date = datetime.fromisoformat(date_str).strftime("%Y-%m-%d")
            start_time = datetime.fromisoformat(date_str).strftime("%H:%M")

            content_hash = generate_content_hash(title, "Bluebird Cafe", start_date)

            existing = find_event_by_hash(content_hash)
            if existing:
                smart_update_existing_event(existing, event_record)
                events_updated += 1
                continue

            event_record = {
                "source_id": source_id,
                "venue_id": venue_id,
                "title": title,
                "description": "Intimate acoustic songwriter round featuring Nashville's finest tunesmiths. Reservations required.",
                "start_date": start_date,
                "start_time": start_time,
                "category": "music",
                "subcategory": "songwriter-round",
                "tags": ["songwriter", "acoustic", "intimate", "in-the-round", "reservations"],
                "content_hash": content_hash,
                # ... other fields
            }

            insert_event(event_record)
            events_new += 1
            events_found += 1

        except Exception as e:
            logger.error(f"Failed to parse songwriter round: {e}")
            continue

    return events_found, events_new, events_updated


# ============================================================================
# TEMPLATE 5: Festival / Multi-Day Event
# ============================================================================

def crawl_cma_fest(source: dict) -> tuple[int, int, int]:
    """
    Template for multi-day festivals with many sub-events.

    Challenges:
    - 100+ events over 4 days
    - Multiple venues
    - High risk of duplication
    - Need series detection

    Use this pattern for:
    - CMA Fest
    - AmericanaFest
    - Nashville Film Festival
    - Live on the Green
    """
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    # CMA Fest is a series - create series record
    series_hint = {
        "series_type": "festival_program",
        "series_title": "CMA Fest 2026",
        "frequency": "annual",
        "genres": ["country"],
    }

    # Fetch festival schedule
    url = "https://www.cmafest.com/schedule"
    response = requests.get(url, timeout=30)
    response.raise_for_status()

    # Parse each sub-event
    soup = BeautifulSoup(response.text, "html.parser")
    performances = soup.find_all("div", class_="performance")

    for performance in performances:
        try:
            artist = performance.find("h3", class_="artist").text.strip()
            venue_name = performance.find("span", class_="stage").text.strip()
            time_str = performance.find("time")["datetime"]

            # Create venue if needed (stages within festival)
            venue_data = {
                "name": venue_name,
                "slug": slugify(venue_name),
                "city": "Nashville",
                "state": "TN",
                "venue_type": "festival_stage",
            }
            venue_id = get_or_create_venue(venue_data)

            start_date = datetime.fromisoformat(time_str).strftime("%Y-%m-%d")
            start_time = datetime.fromisoformat(time_str).strftime("%H:%M")

            title = f"{artist} at CMA Fest"

            # Include venue in hash to avoid duplicates across stages
            content_hash = generate_content_hash(
                title,
                venue_name,  # Include venue to distinguish same artist, different stages
                start_date + start_time  # Include time to distinguish same day, different sets
            )

            existing = find_event_by_hash(content_hash)
            if existing:
                smart_update_existing_event(existing, event_record)
                events_updated += 1
                continue

            event_record = {
                "source_id": source_id,
                "venue_id": venue_id,
                "title": title,
                "start_date": start_date,
                "start_time": start_time,
                "category": "music",
                "subcategory": "country",
                "tags": ["festival", "cma-fest", "country", "outdoor"],
                "content_hash": content_hash,
                # ... other fields
            }

            # Pass series_hint to insert_event for linking
            insert_event(event_record, series_hint=series_hint)
            events_new += 1
            events_found += 1

        except Exception as e:
            logger.error(f"Failed to parse performance: {e}")
            continue

    return events_found, events_new, events_updated


# ============================================================================
# UTILITY FUNCTIONS
# ============================================================================

def get_nashville_neighborhood(address: str) -> Optional[str]:
    """
    Map address to Nashville neighborhood.

    This is a simplified version - in production, use geocoding + polygon matching.
    """
    address_lower = address.lower()

    if "broadway" in address_lower or "2nd ave" in address_lower:
        return "Downtown"
    elif "gallatin" in address_lower or "5 points" in address_lower:
        return "East Nashville"
    elif "12th" in address_lower and "south" in address_lower:
        return "The Gulch"
    elif "germantown" in address_lower:
        return "Germantown"
    elif "12 south" in address_lower or "12th south" in address_lower:
        return "12South"
    elif "hillsboro" in address_lower:
        return "Green Hills"
    elif "charlotte" in address_lower:
        return "The Nations"
    elif "berry" in address_lower:
        return "Berry Hill"
    elif "music valley" in address_lower or "opryland" in address_lower:
        return "Music Valley"
    elif "music row" in address_lower or "16th ave" in address_lower:
        return "Music Row"

    return None


def detect_honky_tonk(venue_name: str, address: str) -> bool:
    """
    Detect if a venue is a honky-tonk.

    Honky-tonks typically:
    - Are on Broadway
    - Have "honky tonk" in name
    - Have continuous live music
    """
    name_lower = venue_name.lower()
    address_lower = address.lower()

    if "honky tonk" in name_lower or "honky-tonk" in name_lower:
        return True

    # Broadway venues are often honky-tonks
    if "broadway" in address_lower:
        # Known honky-tonks
        honky_tonks = [
            "tootsie", "robert's western", "layla's", "acme", "legends",
            "rippy", "stage", "underground", "nashville underground",
            "kid rock", "luke's", "jason aldean", "fgl house"
        ]
        for name in honky_tonks:
            if name in name_lower:
                return True

    return False


# ============================================================================
# EXAMPLE USAGE
# ============================================================================

if __name__ == "__main__":
    """
    Example of how these templates would be used in actual crawlers.

    In production, each template becomes its own file:
    - sources/ryman_auditorium.py
    - sources/bluebird_cafe.py
    - sources/honky_tonks.py
    - sources/nashville_scene.py
    - sources/cma_fest.py
    """

    # Example source record from database
    example_source = {
        "id": 1,
        "name": "Ryman Auditorium",
        "slug": "ryman-auditorium",
        "url": "https://www.ryman.com/events",
        "source_type": "scrape",
    }

    # Run crawler
    # found, new, updated = crawl_ryman_auditorium(example_source)
    # print(f"Ryman: {found} found, {new} new, {updated} updated")
