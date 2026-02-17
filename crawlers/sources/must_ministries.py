"""
Crawler for MUST Ministries (mustministries.org).

Major north metro Atlanta nonprofit providing comprehensive support services:
food pantries, shelters, workforce development, healthcare, and more across
Cherokee, Cobb, and Fulton counties.

Volunteer opportunities include:
- Warehouse and donation center sorting
- Food pantry operations
- Community service worker shifts
- Shelter support
- Seasonal programs (Summer Lunch, Toy Shop)
- Special events and fundraisers

Uses VolunteerHub platform with multiple location venues.
"""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Optional
from bs4 import BeautifulSoup

from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout

from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://mustministries.org"
VOLUNTEERHUB_URL = "https://mustministries.volunteerhub.com/vv2/"

# Main Marietta location
VENUE_DATA = {
    "name": "MUST Ministries",
    "slug": "must-ministries",
    "address": "1110 Powder Springs St",
    "neighborhood": "Marietta",
    "city": "Marietta",
    "state": "GA",
    "zip": "30064",
    "lat": 33.9576,
    "lng": -84.5518,
    "venue_type": "nonprofit",
    "spot_type": "nonprofit",
    "website": BASE_URL,
    "vibes": ["volunteer", "family-friendly", "community"],
}

# Cherokee location
CHEROKEE_VENUE = {
    "name": "MUST Ministries Cherokee",
    "slug": "must-ministries-cherokee",
    "address": "3850 Due West Rd NW",
    "neighborhood": "Marietta",
    "city": "Marietta",
    "state": "GA",
    "zip": "30064",
    "lat": 34.0525,
    "lng": -84.6402,
    "venue_type": "nonprofit",
    "spot_type": "nonprofit",
    "website": BASE_URL,
    "vibes": ["volunteer", "family-friendly", "community"],
}

# Smyrna location
SMYRNA_VENUE = {
    "name": "MUST Ministries Smyrna",
    "slug": "must-ministries-smyrna",
    "address": "1295 Concord Rd SE",
    "neighborhood": "Smyrna",
    "city": "Smyrna",
    "state": "GA",
    "zip": "30080",
    "lat": 33.8638,
    "lng": -84.5124,
    "venue_type": "nonprofit",
    "spot_type": "nonprofit",
    "website": BASE_URL,
    "vibes": ["volunteer", "family-friendly", "community"],
}

# Hope House Shelter (Marietta)
HOPE_HOUSE_VENUE = {
    "name": "MUST Ministries Hope House",
    "slug": "must-ministries-hope-house",
    "address": "1168 Powder Springs St",
    "neighborhood": "Marietta",
    "city": "Marietta",
    "state": "GA",
    "zip": "30064",
    "lat": 33.9582,
    "lng": -84.5544,
    "venue_type": "nonprofit",
    "spot_type": "nonprofit",
    "website": BASE_URL,
    "vibes": ["volunteer", "community"],
}

# Skip internal/restricted events
SKIP_KEYWORDS = [
    "orientation",
    "staff meeting",
    "board meeting",
    "committee",
    "internal",
    "closed",
    "private",
    "bgc required",  # Background check required - not public
]


def strip_html(html_text: str) -> str:
    """Remove HTML tags from text."""
    if not html_text:
        return ""
    soup = BeautifulSoup(html_text, "html.parser")
    return soup.get_text(separator=" ", strip=True)


def determine_venue(location: str, event_name: str) -> tuple[int, str]:
    """
    Determine which MUST location this event belongs to.
    Returns (venue_id, venue_name).
    """
    location_lower = location.lower()
    name_lower = event_name.lower()

    # Check for Cherokee
    if "cherokee" in location_lower or "cherokee" in name_lower or "due west" in location_lower:
        venue_id = get_or_create_venue(CHEROKEE_VENUE)
        return venue_id, "MUST Ministries Cherokee"

    # Check for Smyrna
    if "smyrna" in location_lower or "smyrna" in name_lower or "concord" in location_lower:
        venue_id = get_or_create_venue(SMYRNA_VENUE)
        return venue_id, "MUST Ministries Smyrna"

    # Check for Hope House
    if "hope house" in location_lower or "hope house" in name_lower:
        venue_id = get_or_create_venue(HOPE_HOUSE_VENUE)
        return venue_id, "MUST Ministries Hope House"

    # Default to main Marietta location
    venue_id = get_or_create_venue(VENUE_DATA)
    return venue_id, "MUST Ministries"


def determine_category_and_tags(title: str, description: str) -> tuple[str, Optional[str], list[str]]:
    """Determine category based on title and description."""
    text = f"{title} {description}".lower()
    tags = ["volunteer", "nonprofit", "social-services"]

    # All events are volunteer opportunities
    tags.append("volunteer-opportunity")

    if any(kw in text for kw in ["family", "kid", "children", "all ages"]):
        tags.append("family-friendly")

    if any(kw in text for kw in ["food", "pantry", "kitchen", "meal"]):
        tags.extend(["food-bank", "hunger-relief"])

    if any(kw in text for kw in ["warehouse", "sorting", "packing", "donation center"]):
        tags.append("warehouse")

    if any(kw in text for kw in ["shelter", "hope house", "housing"]):
        tags.append("housing-support")

    if any(kw in text for kw in ["workforce", "job", "employment"]):
        tags.append("workforce-development")

    if any(kw in text for kw in ["mobile pantry", "distribution", "community"]):
        tags.append("community-outreach")

    if any(kw in text for kw in ["summer lunch", "toy shop", "seasonal"]):
        tags.append("seasonal")

    if any(kw in text for kw in ["training", "orientation", "workshop"]):
        return "learning", "workshop", tags + ["education"]

    if any(kw in text for kw in ["fundraiser", "gala", "benefit", "gobble jog"]):
        return "community", "fundraiser", tags + ["fundraiser"]

    # Default to community/volunteer
    return "community", "volunteer", tags


def detect_recurring_shift_pattern(title: str, venue_name: str, start_time: str) -> Optional[dict]:
    """
    Detect if this event is a recurring shift and return series metadata.
    Returns None if not a recurring shift (e.g., special events).
    """
    title_lower = title.lower()

    # Skip non-recurring special events
    skip_keywords = [
        "orientation",
        "training",
        "gala",
        "fundraiser",
        "special event",
        "gobble jog",
        "tournament",
        "jan ",
        "feb ",
        "mar ",
        "apr ",
        "may ",
        "jun ",
        "jul ",
        "aug ",
        "sep ",
        "oct ",
        "nov ",
        "dec ",
    ]
    if any(kw in title_lower for kw in skip_keywords):
        return None

    # Recurring shift patterns
    # Format: (title_pattern, description_template)
    shift_patterns = [
        ("marietta- workforce development", "Recurring workforce development volunteer shift at MUST Ministries Marietta. Support job training and employment programs."),
        ("cherokee- workforce development", "Recurring workforce development volunteer shift at MUST Ministries Cherokee. Support job training and employment programs."),
        ("smyrna online signup", "Recurring volunteer shift at MUST Ministries Smyrna. General volunteer support for food pantry and community services."),
        ("hope house workforce development", "Recurring volunteer shift at Hope House Shelter supporting workforce development programs for residents."),
        ("donation center", "Recurring volunteer shift at the MUST Ministries donation center. Help sort clothing, furniture, and household items."),
        ("mobile pantry", "Recurring mobile food pantry volunteer shift. Help distribute food at community locations throughout the service area."),
        ("loaves and fishes kitchen", "Recurring kitchen volunteer shift preparing and serving meals at MUST Ministries."),
        ("marketplace thrift store", "Recurring volunteer shift at MUST Marketplace Thrift Store. Help with sorting, pricing, and customer service."),
        ("community service", "Recurring community service volunteer shift at MUST Ministries."),
    ]

    for pattern, description in shift_patterns:
        if pattern in title_lower:
            # Normalize series title
            series_title = title.strip()

            return {
                "series_type": "recurring_show",
                "series_title": series_title,
                "frequency": "daily",  # Most shifts are weekday-daily
                "day_of_week": None,
                "description": description,
            }

    return None


def is_public_event(title: str, description: str) -> bool:
    """Determine if event is public volunteer opportunity vs. internal."""
    text = f"{title} {description}".lower()

    # Skip internal events and restricted opportunities
    if any(kw in text for kw in SKIP_KEYWORDS):
        return False

    return True


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl MUST Ministries volunteer events from VolunteerHub API."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
                viewport={"width": 1920, "height": 1080},
            )

            # Capture API response
            api_data = None

            def capture_api(response):
                nonlocal api_data
                if "volunteerview/view/index" in response.url:
                    try:
                        api_data = response.json()
                        logger.info("Captured MUST Ministries VolunteerHub API data")
                        logger.debug(f"API data keys: {api_data.keys() if isinstance(api_data, dict) else type(api_data)}")
                    except Exception as e:
                        logger.error(f"Failed to parse API response: {e}")

            page = context.new_page()
            page.on("response", capture_api)

            logger.info(f"Fetching MUST Ministries: {VOLUNTEERHUB_URL}")
            page.goto(VOLUNTEERHUB_URL, wait_until="networkidle", timeout=30000)
            page.wait_for_timeout(3000)

            if not api_data:
                logger.warning("No API data captured from VolunteerHub")
                browser.close()
                return 0, 0, 0

            # Parse API data
            if not api_data or not isinstance(api_data, dict):
                logger.warning(f"Invalid API data received: {type(api_data)}")
                browser.close()
                return 0, 0, 0

            days = api_data.get("days", [])
            if days is None:
                days = []

            logger.info(f"Found {len(days)} days with events")

            seen_events = set()

            for day_data in days:
                day_date = day_data.get("date", "")
                events_list = day_data.get("events", [])

                for event_data in events_list:
                    try:
                        # Extract fields from API
                        event_id = event_data.get("id")
                        event_guid = event_data.get("guid")
                        title = event_data.get("name", "").strip()
                        location = event_data.get("location", "").strip()
                        start_time_str = event_data.get("sTime", "")
                        end_time_str = event_data.get("eTime", "")
                        short_desc = strip_html(event_data.get("shortDescription", ""))
                        long_desc = strip_html(event_data.get("longDescription", ""))

                        if not title or not start_time_str:
                            continue

                        # Parse datetime
                        try:
                            start_dt = datetime.fromisoformat(start_time_str.replace("Z", "+00:00"))
                            start_date = start_dt.strftime("%Y-%m-%d")
                            start_time = start_dt.strftime("%H:%M")
                        except Exception as e:
                            logger.debug(f"Failed to parse date/time for {title}: {e}")
                            continue

                        # Parse end time if available
                        end_time = None
                        if end_time_str:
                            try:
                                end_dt = datetime.fromisoformat(end_time_str.replace("Z", "+00:00"))
                                end_time = end_dt.strftime("%H:%M")
                            except:
                                pass

                        # Build description
                        description = ""
                        if short_desc:
                            description = short_desc
                        if long_desc and long_desc != short_desc:
                            if description:
                                description += " "
                            description += long_desc
                        description = description[:500]

                        # Check if public
                        if not is_public_event(title, description):
                            logger.debug(f"Skipping internal/restricted event: {title}")
                            continue

                        # Dedupe
                        event_key = f"{title}|{start_date}|{start_time}"
                        if event_key in seen_events:
                            continue
                        seen_events.add(event_key)

                        events_found += 1

                        # Determine venue
                        venue_id, venue_name = determine_venue(location, title)

                        # Determine category and tags
                        category, subcategory, tags = determine_category_and_tags(title, description)

                        # Detect recurring shift pattern and build series hint
                        series_hint = detect_recurring_shift_pattern(title, venue_name, start_time)

                        # If it's a recurring shift, mark as recurring
                        is_recurring = bool(series_hint)
                        recurrence_rule = "FREQ=DAILY;BYDAY=MO,TU,WE,TH,FR" if is_recurring else None

                        # Build event URL
                        event_url = f"{VOLUNTEERHUB_URL}?event={event_guid}" if event_guid else VOLUNTEERHUB_URL

                        # Generate content hash
                        content_hash = generate_content_hash(title, venue_name, start_date)

                        # Build event record
                        event_record = {
                            "source_id": source_id,
                            "venue_id": venue_id,
                            "title": title[:200],
                            "description": description if description else None,
                            "start_date": start_date,
                            "start_time": start_time,
                            "end_date": None,
                            "end_time": end_time,
                            "is_all_day": False,
                            "category": category,
                            "tags": tags,
                            "price_min": None,
                            "price_max": None,
                            "price_note": None,
                            "is_free": True,
                            "source_url": event_url,
                            "ticket_url": event_url,
                            "image_url": None,
                            "raw_text": f"{title} {description}"[:500],
                            "extraction_confidence": 0.95,
                            "is_recurring": is_recurring,
                            "recurrence_rule": recurrence_rule,
                            "content_hash": content_hash,
                        }

                        # Check for existing
                        existing = find_event_by_hash(content_hash)
                        if existing:
                            smart_update_existing_event(existing, event_record)
                            events_updated += 1
                            continue

                        try:
                            insert_event(event_record, series_hint=series_hint)
                            events_new += 1
                            logger.info(f"Added: {title[:50]}... on {start_date} at {start_time}")
                        except Exception as e:
                            logger.error(f"Failed to insert: {title}: {e}")

                    except Exception as e:
                        logger.error(f"Error processing event: {e}")
                        continue

            browser.close()

        logger.info(
            f"MUST Ministries crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except PlaywrightTimeout as e:
        logger.error(f"Timeout fetching MUST Ministries: {e}")
        raise
    except Exception as e:
        logger.error(f"Failed to crawl MUST Ministries: {e}")
        raise

    return events_found, events_new, events_updated
