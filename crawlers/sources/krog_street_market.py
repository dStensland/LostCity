"""
Crawler for The Krog District (thekrogdistrict.com).
Food hall and mixed-use district in the Krog Street corridor with multiple venues and events.

Site uses Squarespace with JavaScript rendering - must use Playwright.
Events are in .eventlist-event containers with structured date/time fields.

Sub-venues: Krog Street Market (food hall), BrewDog ATL (brewery),
Guac y Margys (restaurant), Patagonia (retail), Hop City (bottle shop),
Atlanta Stove Works (event space), Pour Taproom (bar), FP Movement (retail).

Also generates recurring weekly events (Tue trivia, Tue run club, Tue yoga, Sat run club).
"""

from __future__ import annotations

import re
import logging
from datetime import datetime, timedelta
from typing import Optional

from playwright.sync_api import sync_playwright

from db import (
    get_or_create_place,
    insert_event,
    find_event_by_hash,
    find_existing_event_for_insert,
    smart_update_existing_event,
    remove_stale_source_events,
)
from dedupe import generate_content_hash
from entity_lanes import TypedEntityEnvelope, SourceEntityCapabilities
from entity_persistence import persist_typed_entity_envelope

logger = logging.getLogger(__name__)

BASE_URL = "https://www.thekrogdistrict.com"
EVENTS_URL = f"{BASE_URL}/events"
WEEKS_AHEAD = 6

# -- Primary venue (default for unmapped events) --
PLACE_DATA = {
    "name": "Krog Street Market",
    "slug": "krog-street-market",
    "address": "99 Krog St NE",
    "neighborhood": "Krog Street",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30307",
    "lat": 33.7575,
    "lng": -84.3641,
    "venue_type": "food_hall",
    "spot_type": "food_hall",
    "website": BASE_URL,
    "vibes": ["food-hall", "inman-park", "beltline", "krog-street"],
}

# -- Sub-venues within Krog District --
BREWDOG_VENUE_DATA = {
    "name": "BrewDog Atlanta",
    "slug": "brewdog-atlanta",
    "address": "112 Krog St NE Suite 9",
    "neighborhood": "Krog Street",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30307",
    "lat": 33.7581,
    "lng": -84.3636,
    "venue_type": "brewery",
    "spot_type": "brewery",
    "website": "https://www.brewdog.com/usa/bars/atlanta",
    "vibes": ["brewery", "craft-beer", "krog-street", "inman-park", "patio", "dog-friendly"],
}

GUAC_Y_MARGYS_VENUE_DATA = {
    "name": "Guac y Margys",
    "slug": "guac-y-margys",
    "address": "99 Krog St NE Suite R",
    "neighborhood": "Krog Street",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30307",
    "lat": 33.7575,
    "lng": -84.3641,
    "venue_type": "restaurant",
    "spot_type": "restaurant",
    "website": "https://www.guacymargys.com",
    "vibes": ["mexican", "margaritas", "krog-street", "inman-park", "trivia"],
}

# Sub-venue keyword mapping: (keyword_in_location, venue_data_dict)
SUB_VENUE_MAP = [
    ("brewdog", BREWDOG_VENUE_DATA),
    ("brew dog", BREWDOG_VENUE_DATA),
    ("guac", GUAC_Y_MARGYS_VENUE_DATA),
    ("margys", GUAC_Y_MARGYS_VENUE_DATA),
    ("spx alley", GUAC_Y_MARGYS_VENUE_DATA),
]

WEEKLY_SCHEDULE = [
    {
        "venue_data": PLACE_DATA,
        "day": 1,  # Tuesday
        "title": "Tuesday Night Trivia at Krog Street Market",
        "description": (
            "Tuesday night trivia at Krog Street Market in the Krog Street corridor. "
            "Free to play with prizes from district businesses. 7-9pm."
        ),
        "start_time": "19:00",
        "category": "nightlife",
        "subcategory": "nightlife.trivia",
        "tags": ["trivia", "nightlife", "weekly", "krog-street", "inman-park", "beltline", "free"],
    },
    {
        "venue_data": BREWDOG_VENUE_DATA,
        "day": 1,  # Tuesday
        "title": "Adidas Run Club at BrewDog Atlanta",
        "description": (
            "Tuesday run/walk club at BrewDog Atlanta in the Krog District. "
            "Adidas community run — every pace has a place. 6:30pm."
        ),
        "start_time": "18:30",
        "category": "fitness",
        "subcategory": "fitness.running",
        "tags": ["run-club", "running", "fitness", "weekly", "krog-street", "inman-park", "free"],
    },
]

DAY_CODES = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"]
DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

SOURCE_ENTITY_CAPABILITIES = SourceEntityCapabilities(
    events=True,
    destination_details=True,
    venue_features=True,
)


def _build_destination_envelope(venue_id: int) -> TypedEntityEnvelope:
    envelope = TypedEntityEnvelope()
    envelope.add("destination_details", {
        "venue_id": venue_id,
        "destination_type": "food_hall",
        "commitment_tier": "hour",
        "primary_activity": "Beltline food hall with local vendors and restaurants",
        "best_seasons": ["spring", "summer", "fall", "winter"],
        "weather_fit_tags": ["indoor", "outdoor-patio"],
        "parking_type": "garage",
        "best_time_of_day": "any",
        "practical_notes": "Paid parking garage on-site. Direct Beltline Eastside Trail access — walk or bike from Inman Park or Old Fourth Ward. Mix of quick-service stalls and sit-down restaurants.",
        "accessibility_notes": "ADA accessible throughout. Elevator access to all levels.",
        "family_suitability": "yes",
        "reservation_required": False,
        "permit_required": False,
        "fee_note": "Free to enter. Pay-as-you-go at individual vendors.",
        "source_url": "https://krogstreetmarket.com",
        "metadata": {"source_type": "venue_enrichment", "venue_type": "food_hall", "city": "atlanta"},
    })
    envelope.add("venue_features", {
        "venue_id": venue_id,
        "slug": "local-vendor-stalls",
        "title": "Local vendor stalls and restaurants",
        "feature_type": "amenity",
        "description": "A curated mix of Atlanta-based food vendors, from craft butchers to poke bowls to artisanal ice cream.",
        "url": "https://krogstreetmarket.com",
        "is_free": False,
        "sort_order": 10,
    })
    envelope.add("venue_features", {
        "venue_id": venue_id,
        "slug": "beltline-trail-access",
        "title": "Beltline Eastside Trail access",
        "feature_type": "experience",
        "description": "Steps from the Beltline Eastside Trail — the anchor food destination on Atlanta's most popular walking path.",
        "url": "https://krogstreetmarket.com",
        "is_free": True,
        "sort_order": 20,
    })
    envelope.add("venue_features", {
        "venue_id": venue_id,
        "slug": "indoor-outdoor-seating",
        "title": "Indoor and outdoor seating",
        "feature_type": "amenity",
        "description": "Spacious indoor food hall seating plus an outdoor patio facing the Beltline.",
        "url": "https://krogstreetmarket.com",
        "is_free": True,
        "sort_order": 30,
    })
    return envelope


def _get_next_weekday(start_date: datetime, weekday: int) -> datetime:
    days_ahead = weekday - start_date.weekday()
    if days_ahead < 0:
        days_ahead += 7
    return start_date + timedelta(days=days_ahead)


def _resolve_venue(title: str, full_text: str) -> dict:
    """Route event to the correct sub-venue based on location keywords."""
    search_text = (title + " " + full_text).lower()
    for keyword, place_data in SUB_VENUE_MAP:
        if keyword in search_text:
            return place_data
    return PLACE_DATA


def parse_time(time_text: str) -> Optional[str]:
    """Parse time from '7:00 PM' format to HH:MM 24-hour format."""
    if not time_text:
        return None

    # Handle time ranges like "7:00 PM  9:00 PM" - extract start time
    time_text = time_text.strip()

    # Look for first time in the string
    match = re.search(r"(\d{1,2})(?::(\d{2}))?\s*(am|pm)", time_text, re.IGNORECASE)
    if match:
        hour = int(match.group(1))
        minute = int(match.group(2) or 0)
        period = match.group(3).lower()

        if period == "pm" and hour != 12:
            hour += 12
        elif period == "am" and hour == 12:
            hour = 0

        return f"{hour:02d}:{minute:02d}"

    return None


def parse_full_date(date_text: str) -> Optional[str]:
    """Parse date from 'Wednesday, February 4, 2026' format to YYYY-MM-DD."""
    if not date_text:
        return None

    # Try full format: "Wednesday, February 4, 2026"
    match = re.search(
        r"(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s+"
        r"(January|February|March|April|May|June|July|August|September|October|November|December)\s+"
        r"(\d{1,2}),?\s+(\d{4})",
        date_text,
        re.IGNORECASE
    )

    if match:
        month_name = match.group(1)
        day = match.group(2)
        year = match.group(3)

        try:
            dt = datetime.strptime(f"{month_name} {day} {year}", "%B %d %Y")
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            pass

    return None


def determine_category(title: str) -> tuple[str, Optional[str], list[str]]:
    """Determine category based on event title."""
    title_lower = title.lower()
    tags = ["krog-street", "inman-park", "beltline"]

    if any(w in title_lower for w in ["trivia", "quiz"]):
        return "nightlife", "nightlife.trivia", tags + ["trivia"]
    if any(w in title_lower for w in ["comedy", "punchlines"]):
        return "comedy", "comedy.standup", tags + ["comedy"]
    if any(w in title_lower for w in ["run club", "run/walk", "running"]):
        return "fitness", "fitness.running", tags + ["run-club", "running"]
    if any(w in title_lower for w in ["yoga"]):
        return "fitness", "fitness.yoga", tags + ["yoga"]
    if any(w in title_lower for w in ["kids", "family", "children"]):
        return "family", None, tags + ["family"]
    if any(w in title_lower for w in ["music", "concert", "live", "dj", "band"]):
        return "music", "concert", tags + ["live-music"]
    if any(w in title_lower for w in ["tasting", "wine", "chef", "dinner", "brunch"]):
        return "food_drink", None, tags + ["food"]
    # Only match "market" if it's not part of "Krog Street Market"
    if "market" in title_lower and "krog street market" not in title_lower:
        return "community", None, tags + ["market"]
    if any(w in title_lower for w in ["pop-up", "vendor", "makers"]):
        return "community", None, tags + ["market"]
    if any(w in title_lower for w in ["sculpt", "workshop", "craft", "pottery"]):
        return "arts", None, tags + ["workshop"]

    return "community", None, tags


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl The Krog District events using Playwright DOM extraction."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0
    seen_hashes: set[str] = set()

    # Ensure all sub-venue records exist
    venue_ids: dict[str, int] = {}
    for vdata in [PLACE_DATA, BREWDOG_VENUE_DATA, GUAC_Y_MARGYS_VENUE_DATA]:
        venue_ids[vdata["slug"]] = get_or_create_place(vdata)

    persist_typed_entity_envelope(_build_destination_envelope(venue_ids[PLACE_DATA["slug"]]))

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
                viewport={"width": 1920, "height": 1080},
            )
            page = context.new_page()

            logger.info(f"Fetching The Krog District events: {EVENTS_URL}")
            page.goto(EVENTS_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(3000)

            # Scroll to load all lazy-loaded content
            for _ in range(5):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1000)

            # Extract events from DOM using page.evaluate
            raw_events = page.evaluate("""
                () => {
                    const eventItems = document.querySelectorAll('.eventlist-event');
                    return Array.from(eventItems).map(item => {
                        const titleEl = item.querySelector('.eventlist-title a, .eventlist-title');
                        const linkEl = item.querySelector('a[href*="/events/"]');
                        const columnInfo = item.querySelector('.eventlist-column-info');
                        const imgEl = item.querySelector('img[data-src], img[src]');
                        const timeEl = item.querySelector('.eventlist-meta-time');

                        // Get full text which includes the complete date
                        const fullText = columnInfo ? columnInfo.innerText.trim() : item.innerText.trim();

                        return {
                            title: titleEl ? titleEl.innerText.trim() : null,
                            url: linkEl ? linkEl.href : null,
                            fullText: fullText,
                            time: timeEl ? timeEl.innerText.trim() : null,
                            image: imgEl ? (imgEl.getAttribute('data-src') || imgEl.src) : null
                        };
                    }).filter(e => e.title);
                }
            """)

            logger.info(f"Found {len(raw_events)} events on page")

            for event_data in raw_events:
                title = event_data["title"]
                full_text = event_data["fullText"]
                time_text = event_data["time"]
                event_url = event_data["url"] or EVENTS_URL
                image_url = event_data["image"]

                # Parse date from full text (format: "Wednesday, February 4, 2026")
                start_date = parse_full_date(full_text)
                if not start_date:
                    logger.debug(f"Skipping event with unparseable date: {title}")
                    continue

                # Skip past events
                try:
                    event_date = datetime.strptime(start_date, "%Y-%m-%d").date()
                    if event_date < datetime.now().date():
                        continue
                except ValueError:
                    continue

                events_found += 1

                # Route to correct sub-venue
                matched_venue = _resolve_venue(title, full_text)
                venue_id = venue_ids[matched_venue["slug"]]

                # Parse time
                start_time = parse_time(time_text) if time_text else None
                if not start_time:
                    start_time = "18:00"

                # Generate content hash for deduplication
                content_hash = generate_content_hash(
                    title, matched_venue["name"], start_date
                )
                seen_hashes.add(content_hash)

                # Determine category
                category, subcategory, tags = determine_category(title)
                is_free = "free" in title.lower() or "free" in full_text.lower()

                # Extract description from full text (after the time/location info)
                description = None
                lines = full_text.split("\n")
                if len(lines) > 3:
                    desc_lines = [l.strip() for l in lines[3:] if l.strip() and "View Event" not in l]
                    if desc_lines:
                        description = " ".join(desc_lines)

                event_record = {
                    "source_id": source_id,
                    "venue_id": venue_id,
                    "title": title,
                    "description": description or f"Event at {matched_venue['name']}",
                    "start_date": start_date,
                    "start_time": start_time,
                    "end_date": None,
                    "end_time": None,
                    "is_all_day": False,
                    "category": category,
                    "subcategory": subcategory,
                    "tags": tags,
                    "price_min": None,
                    "price_max": None,
                    "price_note": None,
                    "is_free": is_free,
                    "source_url": event_url,
                    "ticket_url": event_url,
                    "image_url": image_url,
                    "raw_text": full_text[:500],
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

                try:
                    insert_event(event_record)
                    events_new += 1
                    logger.info(f"Added: {title} at {matched_venue['name']} on {start_date}")
                except Exception as e:
                    logger.error(f"Failed to insert event {title}: {e}")

            # Remove stale events that are no longer on the site
            try:
                removed = remove_stale_source_events(source_id, seen_hashes)
                if removed > 0:
                    logger.info(f"Removed {removed} stale events")
            except Exception as e:
                logger.error(f"Failed to remove stale events: {e}")

            browser.close()

        logger.info(
            f"Krog District scrape complete: {events_found} found, "
            f"{events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Krog District: {e}")
        raise

    # Generate recurring weekly events
    r_found, r_new, r_updated = _generate_recurring_events(source_id, venue_ids)
    events_found += r_found
    events_new += r_new
    events_updated += r_updated

    logger.info(
        f"Krog District crawl complete (incl. recurring): {events_found} found, "
        f"{events_new} new, {events_updated} updated"
    )
    return events_found, events_new, events_updated


def _generate_recurring_events(
    source_id: int, venue_ids: dict[str, int]
) -> tuple[int, int, int]:
    """Generate recurring weekly events for Krog District venues."""
    events_found = 0
    events_new = 0
    events_updated = 0

    today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)

    for template in WEEKLY_SCHEDULE:
        place_data = template["venue_data"]
        venue_id = venue_ids[place_data["slug"]]
        next_date = _get_next_weekday(today, template["day"])
        day_code = DAY_CODES[template["day"]]
        day_name = DAY_NAMES[template["day"]]

        series_hint = {
            "series_type": "recurring_show",
            "series_title": template["title"],
            "frequency": "weekly",
            "day_of_week": day_name.lower(),
            "description": template["description"],
        }

        for week in range(WEEKS_AHEAD):
            event_date = next_date + timedelta(weeks=week)
            start_date = event_date.strftime("%Y-%m-%d")
            events_found += 1

            content_hash = generate_content_hash(
                template["title"], place_data["name"], start_date
            )

            event_record = {
                "source_id": source_id,
                "venue_id": venue_id,
                "title": template["title"],
                "description": template["description"],
                "start_date": start_date,
                "start_time": template["start_time"],
                "end_date": None,
                "end_time": None,
                "is_all_day": False,
                "category": template["category"],
                "subcategory": template.get("subcategory"),
                "tags": template["tags"],
                "is_free": True,
                "price_min": None,
                "price_max": None,
                "source_url": EVENTS_URL,
                "ticket_url": None,
                "image_url": None,
                "raw_text": f"{template['title']} - {start_date}",
                "extraction_confidence": 0.90,
                "is_recurring": True,
                "recurrence_rule": f"FREQ=WEEKLY;BYDAY={day_code}",
                "content_hash": content_hash,
            }

            existing = find_existing_event_for_insert(event_record)
            if existing:
                smart_update_existing_event(existing, event_record)
                events_updated += 1
                continue

            try:
                insert_event(event_record, series_hint=series_hint)
                events_new += 1
            except Exception as exc:
                logger.error(f"Failed to insert {template['title']} on {start_date}: {exc}")

    return events_found, events_new, events_updated
