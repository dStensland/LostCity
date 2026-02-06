"""
Crawler for Piedmont Healthcare Foundation Special Events.
(piedmont.org/about-piedmont-healthcare/foundation-and-giving/overview/special-events)

Events include galas, golf tournaments, 5K races, and fundraisers
at various Piedmont hospitals across metro Atlanta.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime
from typing import Optional

from playwright.sync_api import sync_playwright

from db import get_or_create_venue, insert_event, find_event_by_hash, get_portal_id_by_slug
from dedupe import generate_content_hash
from utils import extract_images_from_page, extract_event_links, find_event_url

# Portal ID for Piedmont-exclusive events
PORTAL_SLUG = "piedmont"

logger = logging.getLogger(__name__)

BASE_URL = "https://www.piedmont.org"
EVENTS_URL = f"{BASE_URL}/about-piedmont-healthcare/foundation-and-giving/overview/special-events"

# Map hospital names to venue data
VENUE_MAP = {
    "piedmont atlanta": {
        "name": "Piedmont Atlanta Hospital",
        "slug": "piedmont-atlanta-hospital",
        "address": "1968 Peachtree Road NW",
        "neighborhood": "Buckhead",
        "city": "Atlanta",
        "state": "GA",
    },
    "piedmont fayette": {
        "name": "Piedmont Fayette Hospital",
        "slug": "piedmont-fayette-hospital",
        "address": "1255 Highway 54 West",
        "neighborhood": None,
        "city": "Fayetteville",
        "state": "GA",
    },
    "piedmont henry": {
        "name": "Piedmont Henry Hospital",
        "slug": "piedmont-henry-hospital",
        "address": "1133 Eagle's Landing Parkway",
        "neighborhood": None,
        "city": "Stockbridge",
        "state": "GA",
    },
    "piedmont newnan": {
        "name": "Piedmont Newnan Hospital",
        "slug": "piedmont-newnan-hospital",
        "address": "745 Poplar Road",
        "neighborhood": None,
        "city": "Newnan",
        "state": "GA",
    },
    "piedmont newton": {
        "name": "Piedmont Newton Hospital",
        "slug": "piedmont-newton-hospital",
        "address": "5126 Hospital Drive NE",
        "neighborhood": None,
        "city": "Covington",
        "state": "GA",
    },
    "piedmont mountainside": {
        "name": "Piedmont Mountainside Hospital",
        "slug": "piedmont-mountainside-hospital",
        "address": "1266 Highway 515 South",
        "neighborhood": None,
        "city": "Jasper",
        "state": "GA",
    },
    "piedmont rockdale": {
        "name": "Piedmont Rockdale Hospital",
        "slug": "piedmont-rockdale-hospital",
        "address": "1412 Milstead Avenue NE",
        "neighborhood": None,
        "city": "Conyers",
        "state": "GA",
    },
}

# Known event venues (not hospitals)
EXTERNAL_VENUES = {
    "newnan centre": {
        "name": "Newnan Centre Amphitheater",
        "slug": "newnan-centre-amphitheater",
        "address": "1515 Lower Fayetteville Road",
        "city": "Newnan",
        "state": "GA",
    },
    "roper park": {
        "name": "Roper Park",
        "slug": "roper-park-jasper",
        "address": "420 Burnt Mountain Road",
        "city": "Jasper",
        "state": "GA",
    },
    "crystal lake": {
        "name": "Crystal Lake Golf & Country Club",
        "slug": "crystal-lake-golf-club",
        "address": "100 Crystal Lake Blvd",
        "city": "Hampton",
        "state": "GA",
    },
    "camp southern ground": {
        "name": "Camp Southern Ground",
        "slug": "camp-southern-ground",
        "address": "1150 County Line Road",
        "city": "Fayetteville",
        "state": "GA",
    },
    "braelin": {
        "name": "Braelin Golf Club",
        "slug": "braelin-golf-club",
        "address": "141 Braelin Village Circle",
        "city": "Peachtree City",
        "state": "GA",
    },
    "burge club": {
        "name": "Burge Club",
        "slug": "burge-club",
        "address": "2060 Eatonton Highway",
        "city": "Mansfield",
        "state": "GA",
    },
}


def parse_date(date_text: str) -> Optional[str]:
    """Parse date from various formats."""
    date_text = date_text.strip()

    # Try "Month DD, YYYY" format
    patterns = [
        (r"(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(\d{4})", "%B %d %Y"),
        (r"(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2}),?\s+(\d{4})", "%b %d %Y"),
        (r"(\d{1,2})/(\d{1,2})/(\d{4})", None),  # MM/DD/YYYY
    ]

    for pattern, fmt in patterns:
        match = re.search(pattern, date_text, re.IGNORECASE)
        if match:
            if fmt:
                try:
                    month, day, year = match.groups()
                    dt = datetime.strptime(f"{month} {day} {year}", fmt)
                    return dt.strftime("%Y-%m-%d")
                except ValueError:
                    continue
            else:
                # MM/DD/YYYY format
                month, day, year = match.groups()
                try:
                    dt = datetime(int(year), int(month), int(day))
                    return dt.strftime("%Y-%m-%d")
                except ValueError:
                    continue

    return None


def find_venue_for_event(title: str, location_text: str) -> dict:
    """Find the appropriate venue based on event title and location."""
    search_text = f"{title} {location_text}".lower()

    # Check external venues first
    for key, venue_data in EXTERNAL_VENUES.items():
        if key in search_text:
            return {**venue_data, "venue_type": "event_venue", "website": None}

    # Check hospital names
    for key, venue_data in VENUE_MAP.items():
        if key in search_text:
            return {**venue_data, "venue_type": "hospital", "website": BASE_URL}

    # Default to Piedmont Atlanta
    return {**VENUE_MAP["piedmont atlanta"], "venue_type": "hospital", "website": BASE_URL}


def determine_category(title: str) -> tuple[str, Optional[str], list[str]]:
    """Determine category based on event title.

    Note: Piedmont portal only allows these categories:
    fitness, wellness, community, family, learning, meetup, outdoors
    """
    title_lower = title.lower()
    base_tags = ["piedmont", "healthcare", "fundraiser", "charity"]

    if "golf" in title_lower:
        # Golf tournaments are outdoor fundraisers
        return "outdoors", "golf", base_tags + ["golf", "tournament"]
    if "5k" in title_lower or "race" in title_lower or "run" in title_lower:
        return "fitness", "running", base_tags + ["5k", "running", "race"]
    if "gala" in title_lower or "luminaria" in title_lower:
        return "community", "gala", base_tags + ["gala", "formal", "dinner"]
    if "derby" in title_lower:
        # Derby parties are community fundraisers
        return "community", "social", base_tags + ["derby", "party"]
    if "clays" in title_lower or "shooting" in title_lower:
        # Clay shooting is an outdoor activity
        return "outdoors", "shooting", base_tags + ["clay-shooting"]
    if "rocks" in title_lower or "concert" in title_lower or "music" in title_lower:
        # Concerts at fundraisers are community events
        return "community", "concert", base_tags + ["concert", "live-music"]

    return "community", "fundraiser", base_tags


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Piedmont Foundation special events using Playwright."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    # Get portal ID for Piedmont-exclusive events
    portal_id = get_portal_id_by_slug(PORTAL_SLUG)

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
                viewport={"width": 1920, "height": 1080},
            )
            page = context.new_page()

            logger.info(f"Fetching Piedmont Foundation: {EVENTS_URL}")
            page.goto(EVENTS_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(3000)

            # Extract images from page
            image_map = extract_images_from_page(page)

            # Extract event links for specific URLs
            event_links = extract_event_links(page, BASE_URL)

            # Scroll to load all content
            for _ in range(3):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1000)

            # Get page text
            body_text = page.inner_text("body")
            lines = [line.strip() for line in body_text.split("\n") if line.strip()]

            # Skip navigation items
            skip_items = [
                "home", "about", "giving", "contact", "donate", "foundation",
                "menu", "search", "sign up", "e-newsletter", "sponsorship",
                "skip to main", "piedmont healthcare", "foundation and giving",
                "special events", "more information", "contact us",
            ]

            i = 0
            seen_events = set()

            while i < len(lines):
                line = lines[i]
                line_lower = line.lower()

                # Skip nav/UI items
                if line_lower in skip_items or len(line) < 3:
                    i += 1
                    continue

                # Look for date patterns
                date_match = re.search(
                    r"(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:-\d{1,2})?,?\s+\d{4}",
                    line,
                    re.IGNORECASE
                )

                if date_match:
                    # Extract just the start date (for date ranges like "October 1-2, 2026")
                    date_text = date_match.group(0)
                    # Remove end date from range
                    date_text = re.sub(r"-\d{1,2}", "", date_text)
                    start_date = parse_date(date_text)

                    if not start_date:
                        i += 1
                        continue

                    # Check if date is in the past
                    try:
                        event_date = datetime.strptime(start_date, "%Y-%m-%d")
                        if event_date.date() < datetime.now().date():
                            i += 1
                            continue
                    except ValueError:
                        i += 1
                        continue

                    # Look for title in previous lines
                    title = None
                    location = None
                    description = None

                    for offset in range(-5, 0):
                        idx = i + offset
                        if 0 <= idx < len(lines):
                            check_line = lines[idx].strip()
                            if check_line.lower() in skip_items:
                                continue
                            if len(check_line) > 5 and len(check_line) < 80:
                                # Skip if it looks like a date
                                if re.search(r"(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d", check_line, re.IGNORECASE):
                                    continue
                                if not title:
                                    title = check_line
                                    break

                    # Look for location and description in following lines
                    for offset in range(1, 6):
                        idx = i + offset
                        if idx < len(lines):
                            check_line = lines[idx].strip()
                            if check_line.lower() in skip_items:
                                continue

                            # Check for location indicators
                            if any(loc in check_line.lower() for loc in ["park", "club", "centre", "center", "amphitheater", "ground"]):
                                if not location:
                                    location = check_line

                            # Check for description
                            if len(check_line) > 30 and not description:
                                if "proceeds" in check_line.lower() or "benefit" in check_line.lower():
                                    description = check_line[:500]

                    if not title:
                        i += 1
                        continue

                    # Dedupe
                    event_key = f"{title}|{start_date}"
                    if event_key in seen_events:
                        i += 1
                        continue
                    seen_events.add(event_key)

                    events_found += 1

                    # Find venue
                    venue_data = find_venue_for_event(title, location or "")
                    venue_id = get_or_create_venue(venue_data)

                    content_hash = generate_content_hash(
                        title, venue_data["name"], start_date
                    )

                    existing = find_event_by_hash(content_hash)
                    if existing:
                        events_updated += 1
                        i += 1
                        continue

                    category, subcategory, tags = determine_category(title)

                    # Determine if free (most foundation events are paid)
                    is_free = False
                    price_note = "Tickets required - proceeds benefit Piedmont Healthcare"

                    # Get specific event URL


                    event_url = find_event_url(title, event_links, EVENTS_URL)



                    event_record = {
                        "source_id": source_id,
                        "venue_id": venue_id,
                        "portal_id": portal_id,  # Piedmont-exclusive event
                        "title": title,
                        "description": description,
                        "start_date": start_date,
                        "start_time": None,  # Foundation events usually don't list times on calendar
                        "end_date": None,
                        "end_time": None,
                        "is_all_day": True,
                        "category": category,
                        "subcategory": subcategory,
                        "tags": tags,
                        "price_min": None,
                        "price_max": None,
                        "price_note": price_note,
                        "is_free": is_free,
                        "source_url": event_url,
                        "ticket_url": event_url,
                        "image_url": image_map.get(title),
                        "raw_text": f"{title} - {start_date} at {venue_data['name']}",
                        "extraction_confidence": 0.85,
                        "is_recurring": False,
                        "recurrence_rule": None,
                        "content_hash": content_hash,
                    }

                    try:
                        insert_event(event_record)
                        events_new += 1
                        logger.info(f"Added: {title} on {start_date}")
                    except Exception as e:
                        logger.error(f"Failed to insert: {title}: {e}")

                i += 1

            browser.close()

        logger.info(
            f"Piedmont Foundation crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Piedmont Foundation: {e}")
        raise

    return events_found, events_new, events_updated
