"""
Crawler for World of Coca-Cola (worldofcoca-cola.com).

Site uses JavaScript rendering - must use Playwright.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime
from typing import Optional

from playwright.sync_api import sync_playwright

from db import get_client, get_or_create_place, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash
from utils import extract_images_from_page, extract_event_links, find_event_url

logger = logging.getLogger(__name__)

BASE_URL = "https://www.worldofcoca-cola.com"
EVENTS_URL = f"{BASE_URL}/events"

PLACE_DATA = {
    "name": "World of Coca-Cola",
    "slug": "world-of-coca-cola",
    "address": "121 Baker St NW",
    "neighborhood": "Downtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30313",
    "lat": 33.7626,
    "lng": -84.3927,
    "place_type": "museum",
    "spot_type": "museum",
    "website": BASE_URL,
    # Admission: $21 adult, $17 child (ages 3-12), free under 3
    # Hours verified 2026-03-11 against worldofcoca-cola.com
    "hours": {
        "sunday": "10:00-17:00",
        "monday": "10:00-17:00",
        "tuesday": "10:00-17:00",
        "wednesday": "10:00-17:00",
        "thursday": "10:00-17:00",
        "friday": "10:00-18:00",
        "saturday": "10:00-18:00",
    },
    "vibes": [
        "family-friendly",
        "educational",
        "tourist-attraction",
        "interactive",
        "downtown",
        "centennial-park",
    ],
    "_destination_details": {
        "commitment_tier": "halfday",
        "parking_type": "paid_lot",
        "best_time_of_day": "morning",
        "family_suitability": "yes",
        "practical_notes": (
            "Pemberton Place garage is the closest paid parking option, shared with the Georgia Aquarium. "
            "Arriving in the morning avoids peak afternoon crowds. "
            "Budget 2-3 hours for the full experience including the tasting room."
        ),
        "primary_activity": "Interactive museum exploring Coca-Cola history with global beverage tasting",
        "destination_type": "museum",
    },
    "_venue_features": [
        {
            "title": "Taste It! — 100+ beverages from around the world",
            "feature_type": "experience",
            "description": "Sample over 100 Coca-Cola beverages from countries around the world in the self-serve tasting room, a highlight of the visit.",
            "is_free": False,
            "sort_order": 10,
        },
        {
            "title": "4D Theater experience",
            "feature_type": "experience",
            "description": "Immersive 4D theater show with sensory effects included with admission.",
            "is_free": False,
            "sort_order": 20,
        },
        {
            "title": "Vault of the Secret Formula",
            "feature_type": "exhibition",
            "description": "Interactive exhibit centered on the mythologized secret formula for Coca-Cola, with theatrical storytelling.",
            "is_free": False,
            "sort_order": 30,
        },
        {
            "title": "Pop culture gallery and memorabilia",
            "feature_type": "collection",
            "description": "Extensive collection of Coca-Cola memorabilia, vintage advertising, and pop culture artifacts spanning over a century.",
            "is_free": False,
            "sort_order": 40,
        },
    ],
    "_venue_specials": [
        {
            "title": "Online ticket discount",
            "type": "admission",
            "description": "Purchase tickets online in advance for a discount versus walk-up pricing at the door.",
            "price_note": "Save vs. walk-up price; check worldofcoca-cola.com for current rates",
        },
        {
            "title": "Combo tickets with Georgia Aquarium",
            "type": "recurring_deal",
            "description": "Discounted combo tickets available for both World of Coca-Cola and the adjacent Georgia Aquarium.",
            "price_note": "Check georgiaaquarium.org or worldofcoca-cola.com for current combo pricing",
        },
    ],
}


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
    """Crawl World of Coca-Cola events using Playwright."""
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

            logger.info(f"Fetching World of Coca-Cola: {EVENTS_URL}")
            response = page.goto(EVENTS_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(3000)

            if response and response.status == 404:
                logger.warning(
                    "World of Coca-Cola events endpoint returned 404; "
                    "enriching venue record from homepage and treating as destination-first"
                )
                # Enrich venue with og:image and og:description from the homepage
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
                    if og_image or og_desc:
                        venue_update: dict = {}
                        if og_image:
                            venue_update["image_url"] = og_image
                        if og_desc:
                            venue_update["description"] = og_desc[:500]
                        if venue_update:
                            get_client().table("places").update(venue_update).eq(
                                "id", venue_id
                            ).execute()
                            logger.info(
                                "World of Coca-Cola: enriched venue with homepage og: metadata"
                            )
                except Exception as enrich_exc:
                    logger.warning(
                        "World of Coca-Cola: homepage enrichment failed: %s", enrich_exc
                    )
                browser.close()
                return 0, 0, 0

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

                    content_hash = generate_content_hash(title, "World of Coca-Cola", start_date)


                    # Get specific event URL


                    event_url = find_event_url(title, event_links, EVENTS_URL)



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
                        "category": "family",
                        "subcategory": None,
                        "tags": [
                        "world-of-coca-cola",
                        "coca-cola",
                        "downtown",
                        "centennial-park",
                        "family",
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
            f"World of Coca-Cola crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl World of Coca-Cola: {e}")
        raise

    return events_found, events_new, events_updated
