"""
Crawler for major annual health charity walks and runs in Atlanta.
Captures events from American Heart Association, March of Dimes, Arthritis Foundation,
American Cancer Society, and Susan G. Komen.

These are major community health events with thousands of participants each year.
"""

from __future__ import annotations

import logging
import re
from datetime import datetime
from typing import Optional

import requests
from bs4 import BeautifulSoup

from db import get_or_create_venue, insert_event, find_event_by_hash
from dedupe import generate_content_hash
from date_utils import parse_human_date

logger = logging.getLogger(__name__)

# Source URLs for each organization
SOURCES = {
    "march_for_babies": {
        "name": "March of Dimes - March for Babies Atlanta",
        "url": "https://www.marchforbabies.org/atlanta",
        "alt_urls": [
            "https://www.marchforbabies.org/event/atlanta",
            "https://www.marchofdimes.org/atlanta",
        ],
        "base_description": "Join thousands for March for Babies, supporting maternal and infant health research.",
        "known_venue": "battery_atlanta",  # 2026 event at Battery Atlanta
        "typical_month": 5,  # Usually May
    },
    "walk_to_cure_arthritis": {
        "name": "Arthritis Foundation - Walk to Cure Arthritis Atlanta",
        "url": "https://events.arthritis.org/wtcaatlanta",
        "alt_urls": [],
        "base_description": "Walk to Cure Arthritis brings together families, friends, and coworkers to raise funds and awareness for arthritis research and programs. Features Zumba, yoga, and family fun zone.",
        "typical_month": 5,  # Usually May
    },
    "heart_walk": {
        "name": "American Heart Association - Atlanta Heart Walk",
        "url": "https://www2.heart.org/site/TR?fr_id=7031&pg=entry",
        "alt_urls": [
            "https://www.heart.org/en/get-involved/events/atlanta-heart-walk",
            "https://www2.heart.org/goto/atlanta",
        ],
        "base_description": "The Atlanta Heart Walk is a celebration of heart health, bringing together thousands to fight heart disease and stroke.",
        "typical_month": 9,  # Usually September
    },
    "relay_for_life": {
        "name": "American Cancer Society - Relay For Life of Atlanta",
        "url": "https://secure.acsevents.org/site/STR?fr_id=108522&pg=entry",
        "alt_urls": [
            "https://www.cancer.org/involved/fundraise/relay-for-life.html",
        ],
        "base_description": "Relay For Life is a team fundraising cancer walk event bringing survivors, caregivers, and supporters together.",
        "typical_month": 5,  # Usually May-June
    },
    "more_than_pink_walk": {
        "name": "Susan G. Komen - More Than Pink Walk Atlanta",
        "url": "https://komenatlanta.org/morethanpink",
        "alt_urls": [
            "https://www.komen.org/event/atlanta-more-than-pink-walk/",
        ],
        "base_description": "The More Than Pink Walk raises critical funds for breast cancer research and support programs in the Atlanta community.",
        "typical_month": 10,  # Usually October (Breast Cancer Awareness Month)
    },
}

# Known venue locations
VENUE_DATA = {
    "battery_atlanta": {
        "name": "The Battery Atlanta",
        "slug": "battery-atlanta",
        "address": "800 Battery Ave SE",
        "neighborhood": "Cumberland",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30339",
        "lat": 33.8907,
        "lng": -84.4676,
        "venue_type": "event_space",
        "spot_type": "event_space",
        "website": "https://www.thebatteryatlanta.com",
    },
    "piedmont_park": {
        "name": "Piedmont Park",
        "slug": "piedmont-park-atlanta",
        "address": "1320 Monroe Dr NE",
        "neighborhood": "Midtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30306",
        "lat": 33.7869,
        "lng": -84.3733,
        "venue_type": "park",
        "spot_type": "park",
        "website": "https://piedmontpark.org",
    },
    "centennial_olympic_park": {
        "name": "Centennial Olympic Park",
        "slug": "centennial-olympic-park",
        "address": "265 Park Ave W NW",
        "neighborhood": "Downtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30313",
        "lat": 33.7606,
        "lng": -84.3934,
        "venue_type": "park",
        "spot_type": "park",
        "website": "https://www.gwcca.org/centennial-olympic-park",
    },
    "grant_park": {
        "name": "Grant Park",
        "slug": "grant-park-atlanta",
        "address": "537 Park Ave SE",
        "neighborhood": "Grant Park",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30312",
        "lat": 33.7423,
        "lng": -84.3711,
        "venue_type": "park",
        "spot_type": "park",
        "website": "https://www.atlantaga.gov/government/departments/parks-recreation/parks-facilities/parks-recreation/grant-park",
    },
}


def scrape_event_page(url: str, alt_urls: list[str] = None) -> Optional[dict]:
    """
    Attempt to scrape event details from an organization's event page.
    Tries main URL and alternative URLs if provided.
    Returns dict with date, time, location, and description if found.
    """
    urls_to_try = [url] + (alt_urls or [])

    for try_url in urls_to_try:
        try:
            response = requests.get(
                try_url,
                headers={
                    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
                },
                timeout=20,
            )
            response.raise_for_status()
            soup = BeautifulSoup(response.text, "html.parser")

            # Extract structured data if available
            event_data = {}

            # Look for date information
            date_patterns = [
                r"(?:date|when):\s*([A-Za-z]+\s+\d{1,2},?\s+\d{4})",
                r"([A-Za-z]+\s+\d{1,2},?\s+\d{4})",
                r"(\d{1,2}/\d{1,2}/\d{4})",
            ]

            # Search meta tags
            for meta in soup.find_all("meta"):
                if meta.get("property") == "event:start_time" or meta.get(
                    "name"
                ) == "event_date":
                    content = meta.get("content", "")
                    if content:
                        event_data["date_text"] = content
                        break

            # Search visible text if not found in meta
            if not event_data.get("date_text"):
                page_text = soup.get_text(" ", strip=True)
                for pattern in date_patterns:
                    match = re.search(pattern, page_text, re.IGNORECASE)
                    if match:
                        event_data["date_text"] = match.group(1)
                        break

            # Look for time information
            time_patterns = [
                r"(?:check-?in|start|begins?):\s*(\d{1,2}:\d{2}\s*[ap]m)",
                r"(\d{1,2}:\d{2}\s*[ap]m)",
            ]
            page_text = soup.get_text(" ", strip=True) if 'page_text' not in locals() else page_text
            for pattern in time_patterns:
                match = re.search(pattern, page_text, re.IGNORECASE)
                if match:
                    event_data["time_text"] = match.group(1)
                    break

            # Look for location
            location_keywords = [
                "battery atlanta",
                "piedmont park",
                "centennial olympic park",
                "grant park",
            ]
            for keyword in location_keywords:
                if keyword in page_text.lower():
                    event_data["location"] = keyword
                    break

            # Extract description from meta or first paragraph
            meta_desc = soup.find("meta", {"name": "description"})
            if meta_desc and meta_desc.get("content"):
                event_data["description"] = meta_desc.get("content").strip()
            elif soup.find("p"):
                first_para = soup.find("p").get_text(" ", strip=True)
                if len(first_para) > 50:
                    event_data["description"] = first_para

            # If we found something, return it
            if event_data:
                logger.info(f"Successfully scraped event data from {try_url}")
                return event_data

        except requests.exceptions.HTTPError as e:
            if e.response.status_code == 404:
                logger.debug(f"404 Not Found: {try_url}")
            else:
                logger.warning(f"HTTP error scraping {try_url}: {e}")
        except Exception as e:
            logger.warning(f"Failed to scrape {try_url}: {e}")

    # None of the URLs worked
    return None


def parse_time(time_text: str) -> Optional[str]:
    """Parse time from '7:00 AM' or '07:30 PM' format to 24-hour HH:MM."""
    match = re.search(r"(\d{1,2}):(\d{2})\s*(am|pm)", time_text, re.IGNORECASE)
    if match:
        hour, minute, period = match.groups()
        hour = int(hour)
        if period.lower() == "pm" and hour != 12:
            hour += 12
        elif period.lower() == "am" and hour == 12:
            hour = 0
        return f"{hour:02d}:{minute}"
    return None


def determine_venue(location_hint: Optional[str] = None) -> tuple[int, str]:
    """
    Determine venue based on location hint.
    Returns (venue_id, venue_name).
    """
    if not location_hint:
        # Default to Piedmont Park (common walk location)
        venue_data = VENUE_DATA["piedmont_park"]
        venue_id = get_or_create_venue(venue_data)
        return venue_id, venue_data["name"]

    location_lower = location_hint.lower()

    # Check for known venues
    if "battery" in location_lower:
        venue_data = VENUE_DATA["battery_atlanta"]
    elif "piedmont" in location_lower:
        venue_data = VENUE_DATA["piedmont_park"]
    elif "centennial" in location_lower or "olympic" in location_lower:
        venue_data = VENUE_DATA["centennial_olympic_park"]
    elif "grant" in location_lower:
        venue_data = VENUE_DATA["grant_park"]
    else:
        # Default fallback
        venue_data = VENUE_DATA["piedmont_park"]

    venue_id = get_or_create_venue(venue_data)
    return venue_id, venue_data["name"]


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl major health charity walk/run events in Atlanta.
    Attempts to scrape current event info from each organization's page.
    """
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    for event_key, event_info in SOURCES.items():
        try:
            logger.info(f"Checking {event_info['name']}...")

            # Attempt to scrape event details
            scraped_data = scrape_event_page(
                event_info["url"], event_info.get("alt_urls", [])
            )

            # Parse date if found
            start_date = None
            start_time = None

            if scraped_data and scraped_data.get("date_text"):
                start_date = parse_human_date(scraped_data["date_text"])
                if scraped_data.get("time_text"):
                    start_time = parse_time(scraped_data["time_text"])

            # Skip if no valid date found
            if not start_date:
                logger.warning(
                    f"Could not find date for {event_info['name']}, skipping for now"
                )
                continue

            events_found += 1

            # Determine venue - use known venue hint if provided
            known_venue_key = event_info.get("known_venue")
            if known_venue_key and known_venue_key in VENUE_DATA:
                venue_data = VENUE_DATA[known_venue_key]
                venue_id = get_or_create_venue(venue_data)
                venue_name = venue_data["name"]
            else:
                # Try to determine from scraped data
                location_hint = scraped_data.get("location") if scraped_data else None
                venue_id, venue_name = determine_venue(location_hint)

            # Build description
            description = event_info["base_description"]
            if scraped_data and scraped_data.get("description"):
                description = scraped_data["description"]

            # Build title
            title = event_info["name"]

            # Generate content hash
            content_hash = generate_content_hash(title, venue_name, start_date)

            # Check if already exists
            if find_event_by_hash(content_hash):
                events_updated += 1
                logger.info(f"Event already exists: {title}")
                continue

            # Create event record
            event_record = {
                "source_id": source_id,
                "venue_id": venue_id,
                "title": title,
                "description": description,
                "start_date": start_date,
                "start_time": start_time or "08:00",  # Default morning start
                "end_date": None,
                "end_time": None,
                "is_all_day": False,
                "category": "fitness",
                "subcategory": "running",
                "tags": [
                    "free",
                    "outdoor",
                    "community",
                    "charity",
                    "family-friendly",
                    "all-ages",
                    "health",
                ],
                "price_min": None,
                "price_max": None,
                "price_note": "Free to register; fundraising optional",
                "is_free": True,
                "source_url": event_info["url"],
                "ticket_url": event_info["url"],
                "image_url": None,
                "raw_text": None,
                "extraction_confidence": 0.85,
                "is_recurring": True,
                "recurrence_rule": "FREQ=YEARLY",
                "content_hash": content_hash,
            }

            insert_event(event_record)
            events_new += 1
            logger.info(f"Added health walk event: {title} on {start_date}")

        except Exception as e:
            logger.error(f"Error processing {event_info['name']}: {e}")
            continue

    logger.info(
        f"Health walks crawl complete: {events_found} found, "
        f"{events_new} new, {events_updated} updated"
    )

    return events_found, events_new, events_updated
