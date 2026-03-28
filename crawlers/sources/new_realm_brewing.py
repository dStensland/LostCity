"""
Crawler for New Realm Brewing (newrealmbrewing.com/atlanta).

Popular Poncey-Highland brewery with live music and events.
Uses JavaScript rendering - must use Playwright.
Also generates recurring Thursday trivia events.
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
)
from dedupe import generate_content_hash
from utils import extract_images_from_page, extract_event_links, find_event_url, enrich_event_record

logger = logging.getLogger(__name__)

BASE_URL = "https://newrealmbrewing.com"
EVENTS_URL = f"{BASE_URL}/atlanta/live-music-events"

WEEKS_AHEAD = 6

PLACE_DATA = {
    "name": "New Realm Brewing",
    "slug": "new-realm-brewing",
    "address": "550 Somerset Terrace NE",
    "neighborhood": "Poncey-Highland",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30306",
    "lat": 33.7705,
    "lng": -84.3648,
    "venue_type": "brewery",
    "spot_type": "bar",
    "website": BASE_URL,
    "vibes": ["brewery", "beltline", "rooftop", "patio", "craft-beer", "live-music"],
    "_destination_details": {
        "commitment_tier": "hour",
        "parking_type": "garage",
        "best_time_of_day": "any",
        "family_suitability": "yes",
        "practical_notes": "Parking garage adjacent. Direct access to BeltLine Eastside Trail. Full-service restaurant makes it a complete stop.",
    },
    "_venue_features": [
        {
            "slug": "rooftop-bar-beltline-views",
            "title": "Rooftop Bar with BeltLine Views",
            "feature_type": "experience",
            "description": "Rooftop bar overlooking the BeltLine Eastside Trail with skyline views.",
            "is_free": True,
            "sort_order": 1,
        },
        {
            "slug": "full-service-restaurant",
            "title": "Full-Service Restaurant",
            "feature_type": "amenity",
            "description": "On-site restaurant with a full menu — not just bar snacks.",
            "is_free": False,
            "sort_order": 2,
        },
        {
            "slug": "on-site-brewery",
            "title": "On-Site Brewery",
            "feature_type": "experience",
            "description": "Beers brewed on premises, including flagship IPA and rotating seasonal releases.",
            "is_free": False,
            "sort_order": 3,
        },
        {
            "slug": "beltline-trail-access",
            "title": "Direct BeltLine Eastside Trail Access",
            "feature_type": "amenity",
            "description": "Walk directly onto the BeltLine Eastside Trail from the brewery.",
            "is_free": True,
            "sort_order": 4,
        },
    ],
    "_venue_specials": [
        {
            "title": "Happy Hour",
            "type": "happy_hour",
            "description": "Weekday happy hour with discounted drafts and select food items.",
            "days_of_week": [1, 2, 3, 4, 5],
            "time_start": "15:00",
            "time_end": "18:00",
            "price_note": None,
        },
        {
            "title": "Weekend Brunch",
            "type": "brunch",
            "description": "Weekend brunch service with food and specialty drinks.",
            "days_of_week": [6, 7],
            "time_start": "10:00",
            "time_end": "15:00",
            "price_note": None,
        },
    ],
}

WEEKLY_SCHEDULE = [
    {
        "day": 3,  # Thursday
        "title": "Trivia at New Realm Brewing",
        "description": (
            "Thursday trivia night at New Realm Brewing on the BeltLine Eastside Trail. "
            "Rooftop patio trivia with house-brewed beers and BeltLine views."
        ),
        "start_time": "19:00",
        "category": "nightlife",
        "subcategory": "nightlife.trivia",
        "tags": ["trivia", "nightlife", "weekly", "brewery", "beltline", "rooftop"],
    },
]

DAY_CODES = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"]
DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]


def get_next_weekday(start_date: datetime, weekday: int) -> datetime:
    days_ahead = weekday - start_date.weekday()
    if days_ahead < 0:
        days_ahead += 7
    return start_date + timedelta(days=days_ahead)


def _generate_recurring_events(source_id: int, venue_id: int) -> tuple[int, int, int]:
    """Generate recurring trivia events for New Realm Brewing."""
    events_found = 0
    events_new = 0
    events_updated = 0

    today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)

    for template in WEEKLY_SCHEDULE:
        next_date = get_next_weekday(today, template["day"])
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
                template["title"], PLACE_DATA["name"], start_date
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
                "source_url": BASE_URL,
                "ticket_url": None,
                "image_url": None,
                "raw_text": f"{template['title']} at New Realm Brewing - {start_date}",
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


def parse_time(time_text: str) -> Optional[str]:
    """Parse time from various formats."""
    match = re.search(r"(\d{1,2}):(\d{2})\s*(am|pm)", time_text, re.IGNORECASE)
    if match:
        hour, minute, period = match.groups()
        hour = int(hour)
        if period.lower() == "pm" and hour != 12:
            hour += 12
        elif period.lower() == "am" and hour == 12:
            hour = 0
        return f"{hour:02d}:{minute}"
    # Try without minutes
    match = re.search(r"(\d{1,2})\s*(am|pm)", time_text, re.IGNORECASE)
    if match:
        hour, period = match.groups()
        hour = int(hour)
        if period.lower() == "pm" and hour != 12:
            hour += 12
        elif period.lower() == "am" and hour == 12:
            hour = 0
        return f"{hour:02d}:00"
    return None


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl New Realm Brewing events using Playwright."""
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

            logger.info(f"Fetching New Realm Brewing: {EVENTS_URL}")
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

            # Parse events - look for date patterns
            i = 0
            while i < len(lines):
                line = lines[i]

                if len(line) < 3:
                    i += 1
                    continue

                # Look for date patterns (e.g., "Feb 15", "February 15, 2026")
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
                            if re.match(r"(January|February|March|April|May|June|July|August|September|October|November|December)", check_line, re.IGNORECASE):
                                continue
                            if not start_time:
                                time_result = parse_time(check_line)
                                if time_result:
                                    start_time = time_result
                                    continue
                            if not title and len(check_line) > 5:
                                if not re.match(r"\d{1,2}[:/]", check_line):
                                    if not re.match(r"(free|tickets|register|\$|more info|choose|location)", check_line.lower()):
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

                    content_hash = generate_content_hash(title, PLACE_DATA["name"], start_date)


                    # Get specific event URL


                    event_url = find_event_url(title, event_links, EVENTS_URL)



                    event_record = {
                        "source_id": source_id,
                        "venue_id": venue_id,
                        "title": title,
                        "description": f"Live music at {PLACE_DATA['name']}",
                        "start_date": start_date,
                        "start_time": start_time,
                        "end_date": None,
                        "end_time": None,
                        "is_all_day": False,
                        "category": "music",
                        "subcategory": "live_music",
                        "tags": ["brewery", "beer", "live-music", "poncey-highland"],
                        "price_min": None,
                        "price_max": None,
                        "price_note": None,
                        "is_free": True,  # Most brewery events are free
                        "source_url": event_url,
                        "ticket_url": event_url if event_url and event_url != EVENTS_URL else None,
                        "image_url": image_map.get(title),
                        "raw_text": f"{title} - {start_date}",
                        "extraction_confidence": 0.80,
                        "is_recurring": False,
                        "recurrence_rule": None,
                        "content_hash": content_hash,
                    }

                    # Enrich from detail page if we're missing start_time
                    if not start_time and event_url and event_url != EVENTS_URL:
                        try:
                            event_record = enrich_event_record(event_record, PLACE_DATA["name"])
                        except Exception as enrich_err:
                            logger.debug(f"Enrichment failed for {title}: {enrich_err}")

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
            f"New Realm Brewing scrape complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl New Realm Brewing: {e}")
        raise

    # Generate recurring trivia events
    venue_id = get_or_create_place(PLACE_DATA)
    r_found, r_new, r_updated = _generate_recurring_events(source_id, venue_id)
    events_found += r_found
    events_new += r_new
    events_updated += r_updated

    logger.info(
        f"New Realm Brewing crawl complete (incl. recurring): {events_found} found, {events_new} new, {events_updated} updated"
    )

    return events_found, events_new, events_updated
