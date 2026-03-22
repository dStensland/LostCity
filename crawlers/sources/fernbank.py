"""
Crawler for Fernbank Museum of Natural History (fernbankmuseum.org).
Natural history museum with events including Fernbank After Dark.

Site uses JavaScript rendering - must use Playwright.
Format: Category, Title, Day Month DD, YYYY H:MM AM — H:MM PM, Description
"""

from __future__ import annotations

import re
import logging
from datetime import datetime
from typing import Optional

from playwright.sync_api import sync_playwright

from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash
from entity_lanes import SourceEntityCapabilities, TypedEntityEnvelope
from entity_persistence import persist_typed_entity_envelope
from exhibition_utils import build_exhibition_record
from utils import extract_images_from_page, extract_event_links, find_event_url, enrich_event_record, parse_date_range

logger = logging.getLogger(__name__)

BASE_URL = "https://www.fernbankmuseum.org"
EVENTS_URL = f"{BASE_URL}/events/calendar-of-events/"

SOURCE_ENTITY_CAPABILITIES = SourceEntityCapabilities(
    events=True,
    destinations=True,
    destination_details=True,
    exhibitions=True,
    venue_features=True,
    venue_specials=True,
)

VENUE_DATA = {
    "name": "Fernbank Museum of Natural History",
    "slug": "fernbank-museum",
    "address": "767 Clifton Rd NE",
    "neighborhood": "Druid Hills",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30307",
    "lat": 33.7739,
    "lng": -84.3281,
    "venue_type": "museum",
    "spot_type": "museum",
    "website": BASE_URL,
    # description and image_url are extracted dynamically from og: tags on the homepage
    # at crawl time — see _enrich_venue_data() called before get_or_create_venue().
    # Hours verified 2026-03-11: Wed-Sun 10am-5pm (closed Mon-Tue)
    "hours": {
        "wednesday": "10:00-17:00",
        "thursday": "10:00-17:00",
        "friday": "10:00-17:00",
        "saturday": "10:00-17:00",
        "sunday": "10:00-17:00",
    },
    "vibes": ["family-friendly", "educational", "interactive", "nature", "dinosaurs"],
}


def _build_destination_envelope(venue_id: int) -> TypedEntityEnvelope:
    envelope = TypedEntityEnvelope()
    envelope.add(
        "destination_details",
        {
            "venue_id": venue_id,
            "destination_type": "natural_history_museum",
            "commitment_tier": "halfday",
            "primary_activity": "family museum and nature visit",
            "best_seasons": ["spring", "summer", "fall", "winter"],
            "weather_fit_tags": ["indoor", "outdoor-indoor-mix", "rainy-day", "family-daytrip"],
            "parking_type": "free_lot",
            "best_time_of_day": "morning",
            "practical_notes": (
                "Fernbank works best as a half-day museum outing with optional outdoor nature add-ons, which makes it easier "
                "to scale the day up or down depending on weather and kid energy. It is especially useful when families want a real outing with indoor bathrooms and an outdoor bonus instead of an all-outdoor commitment."
            ),
            "accessibility_notes": (
                "Indoor museum galleries give Fernbank a lower-friction entry point for strollers and shorter visits, "
                "while the surrounding outdoor areas add extra walking when families want more range. That makes it easier to adjust for shade, stamina, and heat than a pure trail destination."
            ),
            "family_suitability": "yes",
            "reservation_required": False,
            "permit_required": False,
            "fee_note": "Admission, giant-screen films, and special events vary by date and package.",
            "source_url": BASE_URL,
            "metadata": {
                "source_type": "family_destination_enrichment",
                "venue_type": "museum",
                "city": "atlanta",
            },
        },
    )
    envelope.add(
        "venue_features",
        {
            "venue_id": venue_id,
            "slug": "dinosaurs-and-natural-history-galleries",
            "title": "Dinosaurs and natural history galleries",
            "feature_type": "amenity",
            "description": "Fernbank's museum galleries make it one of the strongest kid-focused natural history anchors in the city.",
            "url": BASE_URL,
            "is_free": False,
            "sort_order": 10,
        },
    )
    envelope.add(
        "venue_features",
        {
            "venue_id": venue_id,
            "slug": "museum-plus-outdoor-nature-flex",
            "title": "Museum plus outdoor nature flex",
            "feature_type": "amenity",
            "description": "Fernbank gives families an indoor core plus optional outdoor nature time, which makes it more flexible than a museum-only or trail-only stop.",
            "url": BASE_URL,
            "is_free": False,
            "sort_order": 20,
        },
    )
    envelope.add(
        "venue_features",
        {
            "venue_id": venue_id,
            "slug": "indoor-bathroom-core-with-outdoor-bonus",
            "title": "Indoor bathroom core with outdoor bonus",
            "feature_type": "amenity",
            "description": "Fernbank gives families a reliable indoor museum base for restrooms and resets, with outdoor trails and nature space as an optional add-on instead of a requirement.",
            "url": BASE_URL,
            "is_free": False,
            "sort_order": 30,
        },
    )
    envelope.add(
        "venue_specials",
        {
            "venue_id": venue_id,
            "slug": "children-2-and-under-free",
            "title": "Children 2 and under free",
            "description": "Children age 2 and under receive free admission, which makes Fernbank easier to use as a repeat museum-and-nature day for families with very young kids.",
            "price_note": "Children 2 and under are free.",
            "is_free": True,
            "source_url": BASE_URL,
            "category": "admission",
        },
    )
    return envelope


def _enrich_venue_data(page) -> None:
    """
    Fetch og:description and og:image from the Fernbank homepage and inject them
    into VENUE_DATA so get_or_create_venue() stores them on first creation.
    Only fills fields that are not already set.
    """
    try:
        page.goto(BASE_URL, wait_until="domcontentloaded", timeout=20000)
        og_desc = page.get_attribute('meta[property="og:description"]', "content")
        og_image = page.get_attribute('meta[property="og:image"]', "content")
        if og_desc and not VENUE_DATA.get("description"):
            VENUE_DATA["description"] = re.sub(r"\s+", " ", og_desc).strip()
        if og_image and not VENUE_DATA.get("image_url"):
            VENUE_DATA["image_url"] = og_image.strip()
    except Exception as exc:
        logger.debug("Fernbank homepage og: fetch failed: %s", exc)


def parse_time(time_text: str) -> Optional[str]:
    """Parse time from '11:00 AM' format."""
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


def determine_category(title: str, category_type: str) -> tuple[str, Optional[str], list[str]]:
    """Determine category based on event title and type."""
    title_lower = title.lower()
    type_lower = category_type.lower() if category_type else ""
    tags = ["fernbank", "museum", "druid-hills"]

    if "museum nights" in type_lower or "after dark" in title_lower:
        return "community", "adults", tags + ["adults-only", "21+"]
    if "nature walk" in title_lower or "ranger" in title_lower:
        return "fitness", "outdoors", tags + ["nature", "outdoor"]
    if "story time" in title_lower:
        return "family", "kids", tags + ["family", "kids"]
    if any(w in title_lower for w in ["kids", "children", "family", "camp"]):
        return "family", None, tags + ["family"]
    if "educator" in type_lower or "educator" in title_lower:
        return "community", "education", tags + ["education"]
    if any(w in title_lower for w in ["film", "movie", "imax", "giant screen"]):
        return "film", None, tags + ["film"]
    if "aglow" in title_lower or "wildwoods" in title_lower:
        return "family", "outdoor", tags + ["outdoor", "nature"]

    return "museums", "museum", tags


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Fernbank Museum events using Playwright."""
    source_id = source["id"]
    portal_id = source.get("portal_id")
    events_found = 0
    events_new = 0
    events_updated = 0
    exhibition_envelope = TypedEntityEnvelope()

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
                viewport={"width": 1920, "height": 1080},
            )
            page = context.new_page()

            _enrich_venue_data(page)
            venue_id = get_or_create_venue(VENUE_DATA)
            persist_typed_entity_envelope(_build_destination_envelope(venue_id))

            logger.info(f"Fetching Fernbank Museum: {EVENTS_URL}")
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

            # Get page text
            body_text = page.inner_text("body")
            lines = [l.strip() for l in body_text.split("\n") if l.strip()]

            # Skip navigation items
            skip_items = ["get tickets", "become a member", "visit", "events",
                         "calendar of events", "host an event", "museum nights",
                         "private experiences", "sensory mornings", "experiences",
                         "learn", "support", "membership", "open daily", "filter by",
                         "for educators", "special programs", "sign up", "subscribe"]

            # Event type markers
            event_types = ["daily programs", "guided programs", "discovery days",
                          "museum nights", "special programs"]

            i = 0
            seen_events = set()
            current_type = None

            while i < len(lines):
                line = lines[i]

                # Skip nav/UI items
                if line.lower() in skip_items or len(line) < 3:
                    i += 1
                    continue

                # Check for event type header
                if line.lower() in event_types:
                    current_type = line
                    i += 1
                    continue

                # Look for date pattern: "Tuesday, January 20, 2026 11:00 AM — 11:30 AM"
                date_match = re.match(
                    r"(\w+),\s+(\w+)\s+(\d{1,2}),\s+(\d{4})\s+(\d{1,2}:\d{2}\s*[AP]M)",
                    line,
                    re.IGNORECASE
                )

                if date_match:
                    # Look back for title
                    title = None
                    if i - 1 >= 0:
                        prev_line = lines[i - 1]
                        if prev_line.lower() not in skip_items and prev_line.lower() not in event_types:
                            title = prev_line

                    if not title:
                        i += 1
                        continue

                    # Parse date
                    day_name, month, day, year, time_str = date_match.groups()
                    try:
                        dt = datetime.strptime(f"{month} {day} {year}", "%B %d %Y")
                        start_date = dt.strftime("%Y-%m-%d")
                    except ValueError:
                        i += 1
                        continue

                    # Parse time
                    start_time = parse_time(time_str)

                    # Parse end time if present (after "—")
                    end_time = None
                    end_match = re.search(r"—\s*(\d{1,2}:\d{2}\s*[AP]M)", line, re.IGNORECASE)
                    if end_match:
                        end_time = parse_time(end_match.group(1))

                    # Look ahead for description
                    description = None
                    if i + 1 < len(lines):
                        next_line = lines[i + 1]
                        if next_line.lower() not in event_types and len(next_line) > 20:
                            description = next_line[:500]

                    # Check for duplicates
                    event_key = f"{title}|{start_date}|{start_time}"
                    if event_key in seen_events:
                        i += 1
                        continue
                    seen_events.add(event_key)

                    events_found += 1

                    # Generate content hash
                    content_hash = generate_content_hash(
                        title, "Fernbank Museum of Natural History", start_date
                    )

                    # Check for existing

                    # Determine category
                    category, subcategory, tags = determine_category(title, current_type)

                    # Get specific event URL


                    event_url = find_event_url(title, event_links, EVENTS_URL)



                    event_record = {
                        "source_id": source_id,
                        "venue_id": venue_id,
                        "title": title,
                        "description": description,
                        "start_date": start_date,
                        "start_time": start_time,
                        "end_date": None,
                        "end_time": end_time,
                        "is_all_day": False,
                        "category": category,
                        "subcategory": subcategory,
                        "tags": tags,
                        "price_min": None,
                        "price_max": None,
                        "price_note": None,
                        "is_free": None,
                        "source_url": event_url,
                        "ticket_url": event_url,
                        "image_url": image_map.get(title),
                        "raw_text": f"{current_type}: {title}" if current_type else title,
                        "extraction_confidence": 0.85,
                        "is_recurring": False,
                        "recurrence_rule": None,
                        "content_hash": content_hash,
                    }

                    # Enrich from detail page
                    enrich_event_record(event_record, source_name="Fernbank Museum")

                    # Determine is_free if still unknown after enrichment
                    if event_record.get("is_free") is None:
                        desc_lower = (event_record.get("description") or "").lower()
                        title_lower = event_record.get("title", "").lower()
                        combined = f"{title_lower} {desc_lower}"
                        if any(kw in combined for kw in ["free", "no cost", "no charge", "complimentary"]):
                            event_record["is_free"] = True
                            event_record["price_min"] = event_record.get("price_min") or 0
                            event_record["price_max"] = event_record.get("price_max") or 0
                        else:
                            event_record["is_free"] = False

                    # Extract end_date from date range patterns in title/description
                    range_text = f"{title} {description or ''}"
                    _, range_end = parse_date_range(range_text)
                    if range_end:
                        event_record["end_date"] = range_end

                    # Detect exhibits: route to exhibitions lane instead of events
                    exhibit_keywords = ["exhibit", "exhibition", "on view", "collection", "installation"]
                    combined_text = f"{title} {description or ''}".lower()
                    if any(kw in combined_text for kw in exhibit_keywords):
                        ex_record, ex_artists = build_exhibition_record(
                            title=title,
                            venue_id=venue_id,
                            source_id=source_id,
                            opening_date=start_date,
                            closing_date=event_record.get("end_date"),
                            venue_name=VENUE_DATA["name"],
                            description=description,
                            image_url=image_map.get(title),
                            source_url=event_record.get("source_url"),
                            portal_id=portal_id,
                            admission_type="ticketed",
                            tags=["museum", "fernbank", "druid-hills", "exhibition"],
                        )
                        if ex_artists:
                            ex_record["artists"] = ex_artists
                        exhibition_envelope.add("exhibitions", ex_record)
                        events_new += 1
                        logger.info(f"Queued exhibition: {title} on {start_date}")
                        i += 1
                        continue

                    # Group "Fernbank After Dark" (Museum Nights) into a recurring series
                    title_lower = title.lower()
                    series_hint = None
                    if "after dark" in title_lower or (
                        "museum nights" in (current_type or "").lower()
                        and "museum nights" in title_lower
                    ):
                        event_record["is_recurring"] = True
                        series_hint = {
                            "series_type": "recurring_show",
                            "series_title": "Fernbank After Dark",
                            "frequency": "biweekly",
                        }

                    existing = find_event_by_hash(content_hash)
                    if existing:
                        smart_update_existing_event(existing, event_record)
                        events_updated += 1
                        i += 1
                        continue

                    try:
                        insert_event(event_record, series_hint=series_hint)
                        events_new += 1
                        logger.info(f"Added: {title} on {start_date}")
                    except Exception as e:
                        logger.error(f"Failed to insert: {title}: {e}")

                i += 1

            browser.close()

        if exhibition_envelope.exhibitions:
            persist_result = persist_typed_entity_envelope(exhibition_envelope)
            skipped = persist_result.skipped.get("exhibitions", 0)
            if skipped:
                logger.warning("Fernbank Museum: skipped %d exhibition rows", skipped)

        logger.info(
            f"Fernbank Museum crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Fernbank Museum: {e}")
        raise

    return events_found, events_new, events_updated
