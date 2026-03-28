"""
Crawler for Ponce City Market / The Roof (poncecitymarket.com).

Site uses JavaScript rendering - must use Playwright.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime, timedelta
from typing import Optional

from playwright.sync_api import sync_playwright

from db import get_or_create_place, insert_event, find_event_by_hash, smart_update_existing_event, find_existing_event_for_insert
from dedupe import generate_content_hash
from utils import extract_images_from_page, extract_event_links, find_event_url
from entity_lanes import SourceEntityCapabilities, TypedEntityEnvelope
from entity_persistence import persist_typed_entity_envelope

logger = logging.getLogger(__name__)


def infer_category_from_title(title: str) -> tuple[str, Optional[str]]:
    """Infer event category and subcategory from the title text."""
    t = title.lower()

    if any(w in t for w in ["cocktail", "wine", "tasting", "beer", "brunch", "dinner", "pasta", "cooking", "chef"]):
        return "food_drink", None
    if any(w in t for w in ["run club", "running"]):
        return "fitness", "fitness.running"
    if any(w in t for w in ["yoga"]):
        return "fitness", "fitness.yoga"
    if any(w in t for w in ["fitness", "stroll", "workout", "pilates"]):
        return "fitness", None
    if any(w in t for w in ["concert", "live music", "dj", "band", "jazz", "soul", "acoustic"]):
        return "music", None
    if any(w in t for w in ["art", "gallery", "exhibition", "paint", "craft", "maker"]):
        return "art", None
    if any(w in t for w in ["market", "pop-up", "pop up", "vendor", "shop", "shopping"]):
        return "shopping", None
    if any(w in t for w in ["valentine", "lunar new year", "holiday", "celebration", "festival"]):
        return "community", None
    if any(w in t for w in ["comedy", "stand-up", "standup", "improv", "laugh"]):
        return "comedy", None
    if any(w in t for w in ["film", "movie", "screening", "cinema"]):
        return "film", None

    return "community", None

BASE_URL = "https://poncecitymarket.com"
EVENTS_URL = f"{BASE_URL}/events"

PLACE_DATA = {
    "name": "Ponce City Market",
    "slug": "ponce-city-market",
    "address": "675 Ponce De Leon Ave NE",
    "neighborhood": "Ponce City Market Area",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30308",
    "lat": 33.7724,
    "lng": -84.3656,
    "place_type": "food_hall",
    "spot_type": "food_hall",
    "website": BASE_URL,
}

SOURCE_ENTITY_CAPABILITIES = SourceEntityCapabilities(
    events=True,
    destinations=True,
    destination_details=True,
    venue_features=True,
    venue_specials=True,
)

WEEKS_AHEAD = 6
DAY_CODES = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"]
DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

RECURRING_SCHEDULE = [
    {
        "day": 0,
        "title": "Atlanta Run Club \u2014 Monday Run",
        "start_time": "18:30",
        "description": "Monday evening run with Atlanta Run Club from Nike at Ponce City Market. 1-5 miles, all levels, walking welcome. No sign-up required.",
        "category": "fitness",
        "subcategory": "fitness.running",
        "tags": ["running", "free", "run-club", "weekly", "beltline"],
        "is_free": True,
    },
    {
        "day": 5,
        "title": "Atlanta Run Club \u2014 Saturday Run",
        "start_time": "08:00",
        "description": "Saturday morning run with Atlanta Run Club from Ponce City Market courtyard. 1-5 miles, all levels. No sign-up required.",
        "category": "fitness",
        "subcategory": "fitness.running",
        "tags": ["running", "free", "run-club", "weekly", "beltline"],
        "is_free": True,
    },
]


def _build_destination_envelope(venue_id: int) -> TypedEntityEnvelope:
    envelope = TypedEntityEnvelope()
    envelope.add("destination_details", {
        "place_id": venue_id,
        "destination_type": "food_hall",
        "commitment_tier": "halfday",
        "primary_activity": "Food hall, rooftop amusements, shopping, and Beltline access",
        "best_seasons": ["spring", "summer", "fall", "winter"],
        "weather_fit_tags": ["indoor", "outdoor-indoor-mix", "rainy-day"],
        "parking_type": "garage",
        "best_time_of_day": "any",
        "practical_notes": (
            "On-site paid parking garage. Direct access to the Beltline Eastside Trail — "
            "walk or bike from the building. Skyline Park rooftop is seasonal and weather-dependent. "
            "The Central Food Hall has 20+ vendors, so plan for browsing."
        ),
        "accessibility_notes": "Elevator access to all floors including Skyline Park rooftop. ADA accessible throughout.",
        "family_suitability": "yes",
        "reservation_required": False,
        "permit_required": False,
        "fee_note": "Free to enter. Skyline Park rooftop games are pay-per-play. Food hall is pay-as-you-go.",
        "source_url": BASE_URL,
        "metadata": {"source_type": "venue_enrichment", "place_type": "food_hall", "city": "atlanta"},
    })
    envelope.add("venue_features", {
        "place_id": venue_id,
        "slug": "skyline-park-rooftop",
        "title": "Skyline Park rooftop amusements",
        "feature_type": "attraction",
        "description": "Rooftop carnival games, mini golf, and a slide with panoramic Atlanta views. Seasonal hours.",
        "url": f"{BASE_URL}/skyline-park",
        "is_free": False,
        "sort_order": 10,
    })
    envelope.add("venue_features", {
        "place_id": venue_id,
        "slug": "central-food-hall",
        "title": "Central Food Hall",
        "feature_type": "amenity",
        "description": "Over 20 food vendors offering everything from ramen to wood-fired pizza in the historic Sears building.",
        "url": BASE_URL,
        "is_free": False,
        "sort_order": 20,
    })
    envelope.add("venue_features", {
        "place_id": venue_id,
        "slug": "beltline-eastside-trail-access",
        "title": "Beltline Eastside Trail access",
        "feature_type": "experience",
        "description": "Direct connection to the Beltline Eastside Trail for walking, biking, and exploring adjacent neighborhoods.",
        "url": BASE_URL,
        "is_free": True,
        "sort_order": 30,
    })
    envelope.add("venue_features", {
        "place_id": venue_id,
        "slug": "retail-local-boutiques",
        "title": "Retail shops and local boutiques",
        "feature_type": "amenity",
        "description": "A curated mix of local and national retailers across multiple floors of the historic building.",
        "url": BASE_URL,
        "is_free": False,
        "sort_order": 40,
    })
    envelope.add("venue_features", {
        "place_id": venue_id,
        "slug": "historic-sears-architecture",
        "title": "Historic Sears building architecture",
        "feature_type": "attraction",
        "description": "The restored 1926 Sears, Roebuck & Co. building — one of Atlanta's most iconic adaptive reuse projects on the Beltline.",
        "url": BASE_URL,
        "is_free": True,
        "sort_order": 50,
    })
    envelope.add("venue_specials", {
        "place_id": venue_id,
        "slug": "skyline-park-admission",
        "title": "Skyline Park rooftop admission",
        "description": "Rooftop carnival games, mini golf, and rides. Pay-per-activity or buy an all-access wristband.",
        "price_note": "Individual game tickets or all-access wristband available.",
        "is_free": False,
        "source_url": f"{BASE_URL}/skyline-park",
        "category": "admission",
    })
    envelope.add("venue_specials", {
        "place_id": venue_id,
        "slug": "free-beltline-access",
        "title": "Free Beltline access",
        "description": "Walk or bike directly onto the Beltline Eastside Trail from the building — no fee, no barrier.",
        "price_note": "Free",
        "is_free": True,
        "source_url": BASE_URL,
        "category": "admission",
    })
    return envelope


def _get_next_weekday(start_date: datetime, weekday: int) -> datetime:
    """Return the next occurrence of weekday (0=Monday) on or after start_date."""
    days_ahead = weekday - start_date.weekday()
    if days_ahead < 0:
        days_ahead += 7
    return start_date + timedelta(days=days_ahead)


def _generate_recurring_events(source_id: int, venue_id: int) -> tuple[int, int, int]:
    """Generate recurring weekly events for Ponce City Market."""
    events_found = events_new = events_updated = 0
    today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)

    for template in RECURRING_SCHEDULE:
        next_date = _get_next_weekday(today, template["day"])
        day_code = DAY_CODES[template["day"]]
        day_name = DAY_NAMES[template["day"]]

        series_hint = {
            "series_type": "recurring_show",
            "series_title": template["title"],
            "frequency": "weekly",
            "day_of_week": day_name,
            "description": template["description"],
        }

        for week in range(WEEKS_AHEAD):
            event_date = next_date + timedelta(weeks=week)
            start_date = event_date.strftime("%Y-%m-%d")
            events_found += 1

            content_hash = generate_content_hash(
                template["title"], PLACE_DATA["name"], start_date
            )

            is_free = template.get("is_free", False) or "free" in template["tags"]

            event_record = {
                "source_id": source_id,
                "place_id": venue_id,
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
                "is_free": is_free,
                "price_min": None if is_free else template.get("price_min"),
                "price_max": None if is_free else template.get("price_max"),
                "source_url": BASE_URL,
                "ticket_url": None,
                "image_url": None,
                "raw_text": f"{template['title']} at {PLACE_DATA['name']} - {start_date}",
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

    logger.info(
        f"Ponce City Market recurring: {events_found} found, {events_new} new, {events_updated} updated"
    )
    return events_found, events_new, events_updated


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
    """Crawl Ponce City Market events using Playwright."""
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

            logger.info(f"Fetching Ponce City Market: {EVENTS_URL}")
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
                                    # Skip UI elements and CTAs
                                    skip_patterns = r"(free|tickets|register|\$|more info|buy now|get tickets|select date|view event|learn more|sold out|upcoming|see all|→)"
                                    if not re.match(skip_patterns, check_line.lower()) and "→" not in check_line:
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

                    content_hash = generate_content_hash(title, "Ponce City Market", start_date)


                    # Get specific event URL


                    event_url = find_event_url(title, event_links, EVENTS_URL)



                    category, subcategory = infer_category_from_title(title)

                    event_record = {
                        "source_id": source_id,
                        "place_id": venue_id,
                        "title": title,
                        "description": None,
                        "start_date": start_date,
                        "start_time": start_time,
                        "end_date": None,
                        "end_time": None,
                        "is_all_day": False,
                        "category": category,
                        "subcategory": subcategory,
                        "tags": ["ponce-city-market", "beltline", "old-fourth-ward"],
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
            f"Ponce City Market crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Ponce City Market: {e}")
        raise

    try:
        f, n, u = _generate_recurring_events(source_id, venue_id)
        events_found += f
        events_new += n
        events_updated += u
    except Exception as e:
        logger.error(f"Failed to generate recurring events: {e}")

    return events_found, events_new, events_updated
