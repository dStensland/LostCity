"""
Crawler for Georgia Aquarium (georgiaaquarium.org).
World's largest aquarium with special events and programs.

Site uses JavaScript rendering - must use Playwright.
URL: /event-calendar/
Format: DATE @ TIME, Title, Description, "View Event Information"
Date patterns:
  - FEBRUARY 10, 2026 @ 9AM-1PM
  - APRIL 6 - 10, 2026
  - JUNE 29 - JULY 3, 2026
"""

from __future__ import annotations

import re
import logging
from typing import Optional

from playwright.sync_api import sync_playwright

from db import get_client, get_or_create_place, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash
from entity_lanes import SourceEntityCapabilities, TypedEntityEnvelope
from entity_persistence import persist_typed_entity_envelope
from exhibition_utils import build_exhibition_record
from utils import extract_images_from_page, extract_event_links, find_event_url, enrich_event_record, parse_date_range

logger = logging.getLogger(__name__)

BASE_URL = "https://www.georgiaaquarium.org"
EVENTS_URL = f"{BASE_URL}/event-calendar/"

SOURCE_ENTITY_CAPABILITIES = SourceEntityCapabilities(
    events=True,
    destinations=True,
    destination_details=True,
    exhibitions=True,
    venue_features=True,
    venue_specials=True,
)

PLACE_DATA = {
    "name": "Georgia Aquarium",
    "slug": "georgia-aquarium",
    "address": "225 Baker St NW",
    "neighborhood": "Downtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30313",
    "lat": 33.7634,
    "lng": -84.3951,
    "place_type": "museum",
    "spot_type": "museum",
    "website": BASE_URL,
    # Admission: ~$45 adult, ~$38 child (ages 3-12), free under 3
    # Hours verified 2026-03-11 against georgiaaquarium.org (typical; vary by season)
    "hours": {
        "sunday": "10:00-21:00",
        "monday": "10:00-21:00",
        "tuesday": "10:00-21:00",
        "wednesday": "10:00-21:00",
        "thursday": "10:00-21:00",
        "friday": "10:00-21:00",
        "saturday": "10:00-21:00",
    },
    "vibes": [
        "family-friendly",
        "tourist-attraction",
        "interactive",
        "educational",
        "downtown",
    ],
}

# Month name to number mapping
MONTHS = {
    "january": 1, "february": 2, "march": 3, "april": 4,
    "may": 5, "june": 6, "july": 7, "august": 8,
    "september": 9, "october": 10, "november": 11, "december": 12,
}


def _build_destination_envelope(venue_id: int) -> TypedEntityEnvelope:
    envelope = TypedEntityEnvelope()
    envelope.add(
        "destination_details",
        {
            "place_id": venue_id,
            "destination_type": "aquarium",
            "commitment_tier": "halfday",
            "primary_activity": "family aquarium visit",
            "best_seasons": ["spring", "summer", "fall", "winter"],
            "weather_fit_tags": ["indoor", "rainy-day", "heat-day", "family-daytrip"],
            "parking_type": "garage",
            "best_time_of_day": "morning",
            "practical_notes": (
                "Georgia Aquarium works best with a timed-entry mindset and an indoor half-day plan, "
                "especially on weekends and school-break days when downtown family demand is highest. "
                "It is also one of the easier big-ticket outings for bathroom breaks, air-conditioning, and mid-visit resets."
            ),
            "accessibility_notes": (
                "The aquarium's indoor galleries make it one of the easier downtown destinations for strollers "
                "and weather-proof family outings compared with longer outdoor attractions, with less walking friction "
                "than most zoo- or garden-scale family destinations."
            ),
            "family_suitability": "yes",
            "reservation_required": False,
            "permit_required": False,
            "fee_note": "General admission and specialty experiences vary by date and package; it remains one of the city's strongest indoor family anchors.",
            "source_url": BASE_URL,
            "metadata": {
                "source_type": "family_destination_enrichment",
                "place_type": "aquarium",
                "city": "atlanta",
            },
        },
    )
    envelope.add(
        "venue_features",
        {
            "place_id": venue_id,
            "slug": "weather-proof-marine-galleries",
            "title": "Weather-proof marine galleries",
            "feature_type": "amenity",
            "description": "Large indoor galleries make Georgia Aquarium a reliable weather-flex family option when outdoor plans fall apart.",
            "url": BASE_URL,
            "is_free": False,
            "sort_order": 10,
        },
    )
    envelope.add(
        "venue_features",
        {
            "place_id": venue_id,
            "slug": "stroller-friendly-downtown-anchor",
            "title": "Stroller-friendly downtown anchor",
            "feature_type": "amenity",
            "description": "The aquarium's indoor circulation and central location make it easier to pair with a downtown family plan than attractions that require more exposed walking.",
            "url": BASE_URL,
            "is_free": False,
            "sort_order": 20,
        },
    )
    envelope.add(
        "venue_features",
        {
            "place_id": venue_id,
            "slug": "easy-bathroom-and-cool-down-resets",
            "title": "Easy bathroom and cool-down resets",
            "feature_type": "amenity",
            "description": "Georgia Aquarium is one of the lower-friction family outings for indoor bathroom breaks, air-conditioning, and quick resets without leaving the attraction.",
            "url": BASE_URL,
            "is_free": False,
            "sort_order": 30,
        },
    )
    envelope.add(
        "venue_specials",
        {
            "place_id": venue_id,
            "slug": "children-2-and-under-free",
            "title": "Children 2 and under free",
            "description": "Children age 2 and under receive free admission, which lowers the barrier for families using the aquarium as a major downtown indoor anchor with very young kids.",
            "price_note": "Children 2 and under are free.",
            "is_free": True,
            "source_url": BASE_URL,
            "category": "admission",
        },
    )
    envelope.add(
        "venue_specials",
        {
            "place_id": venue_id,
            "slug": "community-access-discount-admission",
            "title": "Community Access discount admission",
            "description": "Georgia Aquarium offers a recurring lower-cost access path through its community admission program, which makes a high-ticket anchor more reachable for eligible families.",
            "price_note": "Discount admission available through the aquarium's Community Access program.",
            "is_free": False,
            "source_url": BASE_URL,
            "category": "admission",
        },
    )
    return envelope


def parse_date_line(line: str) -> tuple[Optional[str], Optional[str], Optional[str]]:
    """
    Parse date from patterns like:
    - FEBRUARY 10, 2026 @ 9AM-1PM
    - APRIL 6 - 10, 2026
    - JUNE 29 - JULY 3, 2026
    - MARCH 7, 2026 @ 8AM-11AM

    Returns (start_date, end_date, start_time) as strings.
    """
    line = line.strip().upper()

    # Pattern 1: MONTH DAY, YEAR @ TIME (single day with time)
    # e.g., "FEBRUARY 10, 2026 @ 9AM-1PM" or "MARCH 7, 2026 @ 8AM-11AM"
    match = re.match(
        r"([A-Z]+)\s+(\d{1,2}),?\s*(\d{4})\s*@\s*(\d{1,2}(?::\d{2})?\s*(?:AM|PM))",
        line
    )
    if match:
        month_str, day, year, time_str = match.groups()
        month = MONTHS.get(month_str.lower())
        if month:
            start_date = f"{year}-{month:02d}-{int(day):02d}"
            start_time = parse_time(time_str)
            return start_date, None, start_time

    # Pattern 2: MONTH DAY - DAY, YEAR (date range same month)
    # e.g., "APRIL 6 - 10, 2026"
    match = re.match(
        r"([A-Z]+)\s+(\d{1,2})\s*-\s*(\d{1,2}),?\s*(\d{4})",
        line
    )
    if match:
        month_str, start_day, end_day, year = match.groups()
        month = MONTHS.get(month_str.lower())
        if month:
            start_date = f"{year}-{month:02d}-{int(start_day):02d}"
            end_date = f"{year}-{month:02d}-{int(end_day):02d}"
            return start_date, end_date, None

    # Pattern 3: MONTH DAY - MONTH DAY, YEAR (date range different months)
    # e.g., "JUNE 29 - JULY 3, 2026"
    match = re.match(
        r"([A-Z]+)\s+(\d{1,2})\s*-\s*([A-Z]+)\s+(\d{1,2}),?\s*(\d{4})",
        line
    )
    if match:
        start_month_str, start_day, end_month_str, end_day, year = match.groups()
        start_month = MONTHS.get(start_month_str.lower())
        end_month = MONTHS.get(end_month_str.lower())
        if start_month and end_month:
            start_date = f"{year}-{start_month:02d}-{int(start_day):02d}"
            end_date = f"{year}-{end_month:02d}-{int(end_day):02d}"
            return start_date, end_date, None

    return None, None, None


def parse_time(time_text: str) -> Optional[str]:
    """Parse time like '9AM' or '12:30PM' to HH:MM format."""
    if not time_text:
        return None

    time_text = time_text.strip().upper()

    # Match patterns: "9AM", "12:30PM", "9:00AM"
    match = re.match(r"(\d{1,2})(?::(\d{2}))?\s*(AM|PM)", time_text)
    if match:
        hour = int(match.group(1))
        minute = int(match.group(2)) if match.group(2) else 0
        period = match.group(3)

        if period == "PM" and hour != 12:
            hour += 12
        elif period == "AM" and hour == 12:
            hour = 0

        return f"{hour:02d}:{minute:02d}"

    return None


def determine_category(title: str) -> tuple[str, Optional[str], list[str]]:
    """Determine event category based on title."""
    title_lower = title.lower()
    base_tags = ["georgia-aquarium", "downtown", "aquarium"]

    if any(w in title_lower for w in ["sips", "adults", "21+", "wine", "beer"]):
        return "nightlife", "social", base_tags + ["adults-only", "21+"]
    if any(w in title_lower for w in ["camp", "kids", "children"]):
        return "family", "kids", base_tags + ["family", "kids", "camp"]
    if any(w in title_lower for w in ["5k", "run", "walk", "race"]):
        return "fitness", "running", base_tags + ["fitness", "running", "5k"]
    if any(w in title_lower for w in ["field", "school", "homeschool", "education"]):
        return "community", "education", base_tags + ["education", "field-trip"]
    if any(w in title_lower for w in ["yoga", "fitness"]):
        return "fitness", None, base_tags + ["fitness"]
    if any(w in title_lower for w in ["gala", "fundraiser", "benefit"]):
        return "community", "fundraiser", base_tags + ["gala", "fundraiser"]
    if any(w in title_lower for w in ["holiday", "christmas", "halloween"]):
        return "family", "holiday", base_tags + ["family", "holiday"]

    # Default for aquarium events
    return "family", "attraction", base_tags + ["family"]


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Georgia Aquarium events using Playwright."""
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

            venue_id = get_or_create_place(PLACE_DATA)
            persist_typed_entity_envelope(_build_destination_envelope(venue_id))

            # Enrich venue with og:image and og:description from homepage on first pass
            try:
                page.goto(BASE_URL, wait_until="domcontentloaded", timeout=30000)
                page.wait_for_timeout(2000)
                og_image = page.evaluate(
                    "() => { const m = document.querySelector('meta[property=\"og:image\"]'); "
                    "return m ? m.getAttribute('content') : null; }"
                )
                og_desc = page.evaluate(
                    "() => { const m = document.querySelector('meta[property=\"og:description\"]') "
                    "|| document.querySelector('meta[name=\"description\"]'); "
                    "return m ? m.getAttribute('content') : null; }"
                )
                venue_update: dict = {}
                if og_image:
                    venue_update["image_url"] = og_image
                if og_desc:
                    venue_update["description"] = og_desc[:500]
                if venue_update:
                    get_client().table("places").update(venue_update).eq(
                        "id", venue_id
                    ).execute()
                    logger.info("Georgia Aquarium: enriched venue from homepage og: metadata")
            except Exception as enrich_exc:
                logger.warning("Georgia Aquarium: homepage enrichment failed: %s", enrich_exc)

            logger.info(f"Fetching Georgia Aquarium: {EVENTS_URL}")
            page.goto(EVENTS_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(3000)

            # Extract images from page
            image_map = extract_images_from_page(page)

            # Scroll to load all content
            for _ in range(10):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1000)

            # Get event links for URL extraction
            event_links = extract_event_links(page, BASE_URL)

            # Get page text for parsing
            body_text = page.inner_text("body")
            lines = [line.strip() for line in body_text.split("\n") if line.strip()]

            # Navigation items to skip
            skip_items = {
                "skip to main content", "open today", "live cams", "search",
                "recommended searches", "aqua pass reservations", "presentation reservations",
                "tickets & pricing", "login", "visit", "buy tickets", "membership",
                "special offers", "hotel packages", "citypass", "group tickets",
                "gift certificates", "visitor guide", "directions & parking",
                "aquarium map", "dining", "accessibility", "faqs", "animals",
                "events", "events calendar", "seasonal activities", "host a private event",
                "programs", "support", "more", "plan your visit", "today's hours",
                "clear filters", "all events", "family events", "adults-only events",
                "conventions", "education program events", "camps", "viewing",
                "view event information", "explore event", "let's stay in touch",
                "submit", "about us", "information", "tickets", "resources",
                "privacy policy", "terms & conditions", "chat with us",
            }

            i = 0
            seen_events = set()

            while i < len(lines):
                line = lines[i]

                # Skip navigation items
                if line.lower() in skip_items or len(line) < 5:
                    i += 1
                    continue

                # Look for date patterns
                start_date, end_date, start_time = parse_date_line(line)

                if start_date:
                    # Found a date line - look for title in following lines
                    title_parts = []
                    description = None
                    j = i + 1

                    # Collect title parts (may span multiple lines)
                    while j < len(lines) and j < i + 5:
                        next_line = lines[j]

                        # Stop if we hit another date pattern or skip item
                        if parse_date_line(next_line)[0] is not None:
                            break
                        if next_line.lower() in skip_items:
                            j += 1
                            continue
                        if next_line.lower() == "view event information":
                            break

                        # Skip month names that appear alone (navigation artifacts)
                        if next_line.lower() in MONTHS:
                            j += 1
                            continue

                        # If line looks like a description (longer text), save it
                        if len(next_line) > 80:
                            description = next_line[:500]
                            break

                        # Otherwise it's part of the title
                        if len(next_line) > 3:
                            title_parts.append(next_line)
                            # Usually title is 1-2 lines max
                            if len(title_parts) >= 2:
                                break

                        j += 1

                    if title_parts:
                        title = " - ".join(title_parts)

                        # Clean up title
                        title = title.strip()
                        if not title or len(title) < 3:
                            i += 1
                            continue

                        # Check for duplicates
                        event_key = f"{title}|{start_date}"
                        if event_key in seen_events:
                            i += 1
                            continue
                        seen_events.add(event_key)

                        events_found += 1

                        # Generate content hash
                        content_hash = generate_content_hash(
                            title, "Georgia Aquarium", start_date
                        )

                        # Check for existing

                        # Try to find event URL
                        event_url = find_event_url(title, event_links, EVENTS_URL)

                        # Determine category
                        category, subcategory, tags = determine_category(title)

                        event_record = {
                            "source_id": source_id,
                            "place_id": venue_id,
                            "title": title,
                            "description": description,
                            "start_date": start_date,
                            "start_time": start_time,
                            "end_date": end_date,
                            "end_time": None,
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
                            "raw_text": f"{line} - {title}",
                            "extraction_confidence": 0.85,
                            "is_recurring": False,
                            "recurrence_rule": None,
                            "content_hash": content_hash,
                        }

                        # Enrich from detail page
                        enrich_event_record(event_record, source_name="Georgia Aquarium")

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

                        # Extract end_date from date range patterns
                        range_text = f"{event_record.get('title', '')} {event_record.get('description') or ''}"
                        _, range_end = parse_date_range(range_text)
                        if range_end:
                            event_record["end_date"] = range_end

                        # Detect exhibits: route to exhibitions lane instead of events
                        _exhibit_kw = ["exhibit", "exhibition", "on view", "collection", "installation"]
                        _check = f"{event_record.get('title', '')} {event_record.get('description') or ''}".lower()
                        if any(kw in _check for kw in _exhibit_kw):
                            ex_record, ex_artists = build_exhibition_record(
                                title=title,
                                venue_id=venue_id,
                                source_id=source_id,
                                opening_date=start_date,
                                closing_date=event_record.get("end_date"),
                                venue_name=PLACE_DATA["name"],
                                description=description,
                                image_url=image_map.get(title),
                                source_url=event_record.get("source_url"),
                                portal_id=portal_id,
                                admission_type="ticketed",
                                tags=["aquarium", "georgia-aquarium", "downtown", "exhibition"],
                            )
                            if ex_artists:
                                ex_record["artists"] = ex_artists
                            exhibition_envelope.add("exhibitions", ex_record)
                            events_new += 1
                            logger.info(f"Queued exhibition: {title} on {start_date}")
                            i += 1
                            continue

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

        if exhibition_envelope.exhibitions:
            persist_result = persist_typed_entity_envelope(exhibition_envelope)
            skipped = persist_result.skipped.get("exhibitions", 0)
            if skipped:
                logger.warning("Georgia Aquarium: skipped %d exhibition rows", skipped)

        logger.info(
            f"Georgia Aquarium crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Georgia Aquarium: {e}")
        raise

    return events_found, events_new, events_updated
