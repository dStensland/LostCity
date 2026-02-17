"""
Crawler for Atlanta Craft Club (lu.ma/atlcraftclub → luma.com/atlcraftclub).
Community org that hosts craft workshops at various ATL venues via Luma.

Events have structured JSON-LD with title, date, location, and price.
Workshops rotate between venues: 142 Mangum St SW, Lore, BrewDog, Haven Yoga, etc.
"""

from __future__ import annotations

import json
import re
import logging
from datetime import datetime
from typing import Optional
from urllib.parse import urljoin

from playwright.sync_api import sync_playwright

from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

CALENDAR_URL = "https://luma.com/atlcraftclub"

MAX_EVENTS = 30

# Atlanta Craft Club is an org, not a fixed venue.
# Events happen at various host venues — we resolve venue per event.
ORG_NAME = "Atlanta Craft Club"


def parse_luma_date(date_str: str) -> Optional[str]:
    """Parse ISO 8601 date from Luma JSON-LD to YYYY-MM-DD."""
    if not date_str:
        return None
    try:
        dt = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
        return dt.strftime("%Y-%m-%d")
    except (ValueError, TypeError):
        return None


def parse_luma_time(date_str: str) -> Optional[str]:
    """Parse ISO 8601 date from Luma JSON-LD to HH:MM:SS."""
    if not date_str:
        return None
    try:
        dt = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
        return dt.strftime("%H:%M:%S")
    except (ValueError, TypeError):
        return None


def extract_price(offers: dict) -> tuple[Optional[float], Optional[float], bool]:
    """Extract price from JSON-LD offers object."""
    if not offers:
        return None, None, False

    price = offers.get("price")
    if price is not None:
        try:
            price_val = float(price)
            return price_val, price_val, price_val == 0
        except (ValueError, TypeError):
            pass

    low = offers.get("lowPrice")
    high = offers.get("highPrice")
    if low is not None:
        try:
            return float(low), float(high) if high else float(low), float(low) == 0
        except (ValueError, TypeError):
            pass

    return None, None, False


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl Atlanta Craft Club events from Luma calendar.

    Luma embeds JSON-LD Event schema on the page. We extract structured
    data directly from the script tags, then fall back to DOM scraping
    for any events not in JSON-LD.

    Returns:
        Tuple of (events_found, events_new, events_updated)
    """
    source_id = source["id"]
    producer_id = source.get("producer_id")
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

            logger.info(f"Fetching Atlanta Craft Club calendar: {CALENDAR_URL}")
            page.goto(CALENDAR_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(4000)

            # Scroll to load more events
            for _ in range(5):
                page.evaluate("window.scrollBy(0, 1000)")
                page.wait_for_timeout(1000)

            # Extract JSON-LD event data
            json_ld_scripts = page.query_selector_all('script[type="application/ld+json"]')
            json_ld_events = []

            for script in json_ld_scripts:
                try:
                    content = script.inner_html()
                    data = json.loads(content)
                    if isinstance(data, dict) and data.get("@type") == "Event":
                        json_ld_events.append(data)
                    elif isinstance(data, list):
                        for item in data:
                            if isinstance(item, dict) and item.get("@type") == "Event":
                                json_ld_events.append(item)
                except (json.JSONDecodeError, Exception):
                    continue

            logger.info(f"Found {len(json_ld_events)} JSON-LD events")

            for event_data in json_ld_events[:MAX_EVENTS]:
                try:
                    title = event_data.get("name", "").strip()
                    if not title:
                        continue

                    start_date = parse_luma_date(event_data.get("startDate"))
                    end_date = parse_luma_date(event_data.get("endDate"))
                    start_time = parse_luma_time(event_data.get("startDate"))
                    end_time = parse_luma_time(event_data.get("endDate"))

                    if not start_date:
                        continue

                    events_found += 1

                    # Location info
                    location = event_data.get("location", {})
                    location_name = location.get("name", "")
                    location_address = ""
                    if isinstance(location.get("address"), dict):
                        addr = location["address"]
                        location_address = addr.get("streetAddress", "")

                    # Price
                    offers = event_data.get("offers", {})
                    price_min, price_max, is_free = extract_price(offers)

                    # Source URL
                    source_url = event_data.get("url", CALENDAR_URL)

                    # Description
                    description = event_data.get("description", "")

                    content_hash = generate_content_hash(title, ORG_NAME, start_date)

                    existing = find_event_by_hash(content_hash)

                    # Categorize
                    title_lower = title.lower()
                    if any(k in title_lower for k in ["yoga", "mindfulness", "meditation"]):
                        category, subcategory = "wellness", "class"
                    elif any(k in title_lower for k in ["craft", "collage", "journal", "calligraphy", "charm"]):
                        category, subcategory = "art", "workshop"
                    elif "byo" in title_lower:
                        category, subcategory = "community", "social"
                    else:
                        category, subcategory = "art", "workshop"

                    tags = ["craft-club", "workshop", "community"]
                    if location_name:
                        tags.append(location_name.lower().replace(" ", "-")[:30])

                    event_record = {
                        "source_id": source_id,
                        "venue_id": None,  # Org-based — venue varies per event
                        "producer_id": producer_id,
                        "title": title[:500],
                        "description": description[:2000] if description else None,
                        "start_date": start_date,
                        "start_time": start_time,
                        "end_date": end_date or start_date,
                        "end_time": end_time,
                        "is_all_day": False,
                        "category": category,
                        "subcategory": subcategory,
                        "tags": tags,
                        "price_min": price_min,
                        "price_max": price_max,
                        "price_note": None,
                        "is_free": is_free,
                        "source_url": source_url,
                        "ticket_url": source_url,
                        "image_url": event_data.get("image"),
                        "raw_text": None,
                        "extraction_confidence": 0.90,
                        "is_recurring": False,
                        "recurrence_rule": None,
                        "content_hash": content_hash,
                        "venue_name_hint": location_name,
                        "venue_address_hint": location_address,
                    }

                    if existing:
                        smart_update_existing_event(existing, event_record)
                        events_updated += 1
                    else:
                        insert_event(event_record)
                        events_new += 1
                        logger.info(f"Added: {title[:50]}... on {start_date} at {location_name}")

                except Exception as e:
                    logger.error(f"Error processing Luma event: {e}")
                    continue

            browser.close()

        logger.info(
            f"Atlanta Craft Club crawl complete: {events_found} found, "
            f"{events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Atlanta Craft Club: {e}")
        raise

    return events_found, events_new, events_updated
