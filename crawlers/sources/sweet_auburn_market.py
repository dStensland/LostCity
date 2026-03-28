"""
Crawler for Sweet Auburn Curb Market (sweetauburncurbmarket.com).

Site uses JavaScript rendering - must use Playwright.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime
from typing import Optional

from playwright.sync_api import sync_playwright

from db import get_or_create_place, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash
from utils import extract_images_from_page, extract_event_links, find_event_url
from entity_lanes import TypedEntityEnvelope, SourceEntityCapabilities
from entity_persistence import persist_typed_entity_envelope

logger = logging.getLogger(__name__)

BASE_URL = "https://www.sweetauburncurbmarket.com"
EVENTS_URL = f"{BASE_URL}/events"

PLACE_DATA = {
    "name": "Sweet Auburn Curb Market",
    "slug": "sweet-auburn-curb-market",
    "address": "209 Edgewood Ave SE",
    "neighborhood": "Sweet Auburn",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30303",
    "lat": 33.7539,
    "lng": -84.3803,
    "place_type": "market",
    "spot_type": "market",
    "website": BASE_URL,
}

SOURCE_ENTITY_CAPABILITIES = SourceEntityCapabilities(
    events=True,
    destination_details=True,
    venue_features=True,
)


def _build_destination_envelope(venue_id: int) -> TypedEntityEnvelope:
    envelope = TypedEntityEnvelope()
    envelope.add("destination_details", {
        "place_id": venue_id,
        "destination_type": "food_hall",
        "commitment_tier": "hour",
        "primary_activity": "Historic municipal market with local food vendors since 1924",
        "best_seasons": ["spring", "summer", "fall", "winter"],
        "weather_fit_tags": ["indoor", "rainy-day"],
        "parking_type": "street",
        "best_time_of_day": "afternoon",
        "practical_notes": "Street parking and nearby lots. Located in the Sweet Auburn district — combine with a visit to the Martin Luther King Jr. National Historic Site nearby. Best for lunch. Some vendors are cash-only.",
        "accessibility_notes": "ADA accessible main floor.",
        "family_suitability": "yes",
        "reservation_required": False,
        "permit_required": False,
        "fee_note": "Free to enter. Pay vendors individually.",
        "source_url": "https://sweetauburnmarket.com",
        "metadata": {"source_type": "venue_enrichment", "place_type": "food_hall", "city": "atlanta"},
    })
    envelope.add("venue_features", {
        "place_id": venue_id,
        "slug": "historic-market-since-1924",
        "title": "Historic municipal market since 1924",
        "feature_type": "attraction",
        "description": "One of Atlanta's oldest continuously operating municipal markets, a living piece of the city's history in the Sweet Auburn district.",
        "url": "https://sweetauburnmarket.com",
        "is_free": True,
        "sort_order": 10,
    })
    envelope.add("venue_features", {
        "place_id": venue_id,
        "slug": "local-food-vendors",
        "title": "Diverse local food vendors",
        "feature_type": "amenity",
        "description": "A mix of meat markets, produce stalls, and prepared food vendors representing Atlanta's diverse food cultures.",
        "url": "https://sweetauburnmarket.com",
        "is_free": False,
        "sort_order": 20,
    })
    envelope.add("venue_features", {
        "place_id": venue_id,
        "slug": "sweet-auburn-neighborhood",
        "title": "Sweet Auburn historic district",
        "feature_type": "experience",
        "description": "Located in the Sweet Auburn historic district, steps from the Martin Luther King Jr. National Historic Site.",
        "url": "https://sweetauburnmarket.com",
        "is_free": True,
        "sort_order": 30,
    })
    return envelope


def parse_time(time_text: str) -> Optional[str]:
    """Parse time from '7:00 PM' format."""
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


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Sweet Auburn Curb Market events using Playwright."""
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
            page = context.new_page()

            venue_id = get_or_create_place(PLACE_DATA)
            persist_typed_entity_envelope(_build_destination_envelope(venue_id))

            logger.info(f"Fetching Sweet Auburn Curb Market: {EVENTS_URL}")
            page.goto(EVENTS_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(3000)

            # Extract images from page
            image_map = extract_images_from_page(page)

            # Extract event links for specific URLs
            event_links = extract_event_links(page, BASE_URL)

            # Scroll to load all content
            for _ in range(5):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1000)

            # Get page text and parse line by line
            body_text = page.inner_text("body")
            lines = [l.strip() for l in body_text.split("\n") if l.strip()]

            # Parse events - look for date patterns
            i = 0
            while i < len(lines):
                line = lines[i]

                # Skip navigation items
                if len(line) < 3:
                    i += 1
                    continue

                # Look for date patterns
                date_match = re.match(
                    r"(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)?,?\s*(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})(?:,?\s+(\d{4}))?",
                    line,
                    re.IGNORECASE
                )

                if date_match:
                    month = date_match.group(1)
                    day = date_match.group(2)
                    year = date_match.group(3) if date_match.group(3) else str(datetime.now().year)

                    # Look for title in surrounding lines
                    title = None
                    start_time = None

                    for offset in [-2, -1, 1, 2, 3]:
                        idx = i + offset
                        if 0 <= idx < len(lines):
                            check_line = lines[idx]
                            if re.match(r"(January|February|March)", check_line, re.IGNORECASE):
                                continue
                            if not start_time:
                                time_result = parse_time(check_line)
                                if time_result:
                                    start_time = time_result
                                    continue
                            if not title and len(check_line) > 5:
                                if not re.match(r"\d{1,2}[:/]", check_line):
                                    if not re.match(r"(free|tickets|register|\$|more info)", check_line.lower()):
                                        title = check_line
                                        break

                    if not title:
                        i += 1
                        continue

                    # Parse date
                    try:
                        month_str = month[:3] if len(month) > 3 else month
                        dt = datetime.strptime(f"{month_str} {day} {year}", "%b %d %Y")
                        if dt.date() < datetime.now().date():
                            dt = datetime.strptime(f"{month_str} {day} {int(year) + 1}", "%b %d %Y")
                        start_date = dt.strftime("%Y-%m-%d")
                    except ValueError:
                        i += 1
                        continue

                    events_found += 1

                    content_hash = generate_content_hash(title, "Sweet Auburn Curb Market", start_date)


                    # Get specific event URL


                    event_url = find_event_url(title, event_links, EVENTS_URL)



                    event_record = {
                        "source_id": source_id,
                        "place_id": venue_id,
                        "title": title,
                        "description": "Event at Sweet Auburn Curb Market",
                        "start_date": start_date,
                        "start_time": start_time,
                        "end_date": None,
                        "end_time": None,
                        "is_all_day": False,
                        "category": "community",
                        "subcategory": None,
                        "tags": [
                        "sweet-auburn",
                        "curb-market",
                        "food",
                        "historic",
                        "downtown",
                    ],
                        "price_min": None,
                        "price_max": None,
                        "price_note": None,
                        "is_free": False,
                        "source_url": event_url,
                        "ticket_url": event_url,
                        "image_url": image_map.get(title),
                        "raw_text": f"{title} - {start_date}",
                        "extraction_confidence": 0.80,
                        "is_recurring": False,
                        "recurrence_rule": None,
                        "content_hash": content_hash,
                    }

                    existing = find_event_by_hash(content_hash)
                    if existing:
                        smart_update_existing_event(existing, event_record)
                        events_updated += 1
                        i += 1
                        continue

                    try:
                        insert_event(event_record)
                        events_new += 1
                        logger.info(f"Added: {title} on {start_date}")
                    except Exception as e:
                        logger.error(f"Failed to insert: {title}: {e}")

                i += 1

            browser.close()

        logger.info(
            f"Sweet Auburn Curb Market crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Sweet Auburn Curb Market: {e}")
        raise

    return events_found, events_new, events_updated
