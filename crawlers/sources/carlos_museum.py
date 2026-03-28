"""
Crawler for Michael C. Carlos Museum at Emory (carlos.emory.edu).

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
from entity_lanes import SourceEntityCapabilities, TypedEntityEnvelope
from entity_persistence import persist_typed_entity_envelope
from utils import extract_images_from_page, extract_event_links, find_event_url

logger = logging.getLogger(__name__)

BASE_URL = "https://carlos.emory.edu"
EVENTS_URL = f"{BASE_URL}/events"

SOURCE_ENTITY_CAPABILITIES = SourceEntityCapabilities(
    events=True,
    destinations=True,
    destination_details=True,
    venue_features=True,
    venue_specials=True,
)

PLACE_DATA = {
    "name": "Michael C. Carlos Museum",
    # Match the canonical production venue row instead of relying on name fallback.
    "slug": "michael-c-carlos-museum",
    "address": "571 South Kilgo Cir",
    "neighborhood": "Emory",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30322",
    "lat": 33.7904,
    "lng": -84.3253,
    "venue_type": "museum",
    "spot_type": "museum",
    "website": BASE_URL,
    # description and image_url are extracted dynamically from og: tags on the homepage
    # at crawl time — see _enrich_venue_data() called before get_or_create_place().
    # Hours verified 2026-03-11: Tue-Fri 10am-4pm, Sat 10am-5pm, Sun 12-5pm, Mon closed
    "hours": {
        "tuesday": "10:00-16:00",
        "wednesday": "10:00-16:00",
        "thursday": "10:00-16:00",
        "friday": "10:00-16:00",
        "saturday": "10:00-17:00",
        "sunday": "12:00-17:00",
    },
    "vibes": ["free", "educational", "cultural", "art", "historic", "university"],
}


def _build_destination_envelope(venue_id: int) -> TypedEntityEnvelope:
    envelope = TypedEntityEnvelope()
    envelope.add(
        "destination_details",
        {
            "venue_id": venue_id,
            "destination_type": "art_museum",
            "commitment_tier": "hour",
            "primary_activity": "art and antiquities museum visit",
            "best_seasons": ["spring", "summer", "fall", "winter"],
            "weather_fit_tags": ["indoor", "rainy-day", "heat-day", "family-daytrip", "free-option"],
            "parking_type": "paid_lot",
            "best_time_of_day": "afternoon",
            "practical_notes": (
                "Carlos Museum works best as a compact Emory museum stop, especially for families who want a shorter culture outing instead of committing to a larger all-day museum campus."
            ),
            "accessibility_notes": (
                "Its indoor galleries and relatively contained footprint keep the visit lower-friction for strollers and shorter attention spans than larger museum outings."
            ),
            "family_suitability": "yes",
            "reservation_required": False,
            "permit_required": False,
            "fee_note": "The museum remains one of Atlanta's stronger low-cost or free-feeling family culture stops depending on current admission policy and campus access.",
            "source_url": BASE_URL,
            "metadata": {
                "source_type": "family_destination_enrichment",
                "venue_type": "art_museum",
                "city": "atlanta",
            },
        },
    )
    envelope.add(
        "venue_features",
        {
            "venue_id": venue_id,
            "slug": "free-emory-art-and-antiquities-anchor",
            "title": "Emory art and antiquities anchor",
            "feature_type": "amenity",
            "description": "Carlos Museum gives families an easier university-adjacent culture stop built around art, antiquities, and rotating exhibitions.",
            "url": BASE_URL,
            "is_free": True,
            "sort_order": 10,
        },
    )
    envelope.add(
        "venue_features",
        {
            "venue_id": venue_id,
            "slug": "compact-campus-museum-stop",
            "title": "Compact campus museum stop",
            "feature_type": "amenity",
            "description": "The museum's contained indoor layout makes it easier to fit into a shorter family outing than a larger destination museum day.",
            "url": BASE_URL,
            "is_free": True,
            "sort_order": 20,
        },
    )
    envelope.add(
        "venue_specials",
        {
            "venue_id": venue_id,
            "slug": "sunday-funday-free-admission",
            "title": "Sunday FUNday free admission",
            "description": "On the first Sunday of the month during the academic year, Sunday FUNdays offer free admission plus drop-in family art-making at the museum.",
            "price_note": "Free admission during Sunday FUNday programming.",
            "is_free": True,
            "source_url": f"{BASE_URL}/childrens-and-family-programs",
            "category": "admission",
        },
    )
    return envelope


def _enrich_venue_data(page) -> None:
    """
    Fetch og:description and og:image from the Carlos Museum homepage and inject
    them into PLACE_DATA so get_or_create_place() stores them on first creation.
    Only fills fields that are not already set.
    """
    try:
        page.goto(BASE_URL, wait_until="domcontentloaded", timeout=20000)
        page.wait_for_timeout(1500)
        og_desc = page.get_attribute('meta[property="og:description"]', "content")
        og_image = page.get_attribute('meta[property="og:image"]', "content")
        if og_desc and not PLACE_DATA.get("description"):
            PLACE_DATA["description"] = re.sub(r"\s+", " ", og_desc).strip()
        if og_image and not PLACE_DATA.get("image_url"):
            PLACE_DATA["image_url"] = og_image.strip()
    except Exception as exc:
        logger.debug("Carlos Museum homepage og: fetch failed: %s", exc)


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
    """Crawl Michael C. Carlos Museum events using Playwright."""
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

            _enrich_venue_data(page)
            venue_id = get_or_create_place(PLACE_DATA)
            persist_typed_entity_envelope(_build_destination_envelope(venue_id))

            logger.info(f"Fetching Michael C. Carlos Museum: {EVENTS_URL}")
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

                    content_hash = generate_content_hash(title, "Michael C. Carlos Museum", start_date)


                    # Get specific event URL


                    event_url = find_event_url(title, event_links, EVENTS_URL)



                    event_record = {
                        "source_id": source_id,
                        "venue_id": venue_id,
                        "title": title,
                        "description": "Event at Michael C. Carlos Museum",
                        "start_date": start_date,
                        "start_time": start_time,
                        "end_date": None,
                        "end_time": None,
                        "is_all_day": False,
                        "category": "museums",
                        "subcategory": "exhibition",
                        "tags": ["carlos-museum", "emory", "museum", "art", "antiquities", "free"],
                        "price_min": None,
                        "price_max": None,
                        "price_note": "Suggested donation $8",
                        "is_free": True,
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
            f"Michael C. Carlos Museum crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Michael C. Carlos Museum: {e}")
        raise

    return events_found, events_new, events_updated
