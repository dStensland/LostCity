"""
Crawler for Doraville Art Center / DART (doravilleartcenter.org).
Community art space across from MARTA Gold Line station in downtown Doraville.
Classes in painting, music, dance, knitting, and more.

Site is Wix with Wix Bookings for classes. Content loads dynamically via
client-side rendering. Playwright required to wait for booking widget to hydrate.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime
from typing import Optional

from playwright.sync_api import sync_playwright

from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://www.doravilleartcenter.org"
CLASSES_URL = f"{BASE_URL}/classes"

MAX_EVENTS = 50

VENUE_DATA = {
    "name": "Doraville Art Center",
    "slug": "doraville-art-center",
    "address": "3774 Central Ave",
    "neighborhood": "Doraville",
    "city": "Doraville",
    "state": "GA",
    "zip": "30340",
    "lat": 33.8979,
    "lng": -84.2832,
    "venue_type": "venue",
    "spot_type": "community_center",
    "website": BASE_URL,
}


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl Doraville Art Center classes page.

    Wix Bookings widget renders client-side. We wait for the booking
    grid to populate, then extract class titles, dates, and descriptions.

    Returns:
        Tuple of (events_found, events_new, events_updated)
    """
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

            venue_id = get_or_create_venue(VENUE_DATA)

            logger.info(f"Fetching Doraville Art Center classes: {CLASSES_URL}")
            page.goto(CLASSES_URL, wait_until="domcontentloaded", timeout=30000)

            # Wix Bookings loads async — wait for widget to hydrate
            page.wait_for_timeout(5000)

            # Scroll to trigger lazy loading
            for _ in range(5):
                page.evaluate("window.scrollBy(0, 800)")
                page.wait_for_timeout(1000)

            # Try to find Wix Bookings service cards
            # Common selectors: [data-hook="service-card"], .service-card, .booking-service
            service_cards = page.query_selector_all(
                '[data-hook="service-card"], .service-card, .booking-service, '
                '[data-testid="service-card"], .service-list-item'
            )
            logger.info(f"Found {len(service_cards)} class cards")

            if not service_cards:
                # Fallback: try to get any content blocks that look like classes
                service_cards = page.query_selector_all(
                    'section [role="listitem"], .comp-class, article'
                )
                logger.info(f"Fallback: found {len(service_cards)} items")

            for card in service_cards[:MAX_EVENTS]:
                try:
                    # Title
                    title_el = card.query_selector(
                        '[data-hook="service-title"], h2, h3, .service-title'
                    )
                    title = title_el.inner_text().strip() if title_el else None
                    if not title or len(title) < 3:
                        continue

                    # Description
                    desc_el = card.query_selector(
                        '[data-hook="service-description"], .service-description, p'
                    )
                    description = desc_el.inner_text().strip() if desc_el else None

                    # Price
                    price_el = card.query_selector(
                        '[data-hook="service-price"], .service-price, .price'
                    )
                    price_text = price_el.inner_text() if price_el else ""
                    price_match = re.search(r'\$(\d+(?:\.\d{2})?)', price_text)
                    price = float(price_match.group(1)) if price_match else None
                    is_free = "free" in price_text.lower() if price_text else False

                    # Link
                    link_el = card.query_selector("a[href]")
                    detail_url = link_el.get_attribute("href") if link_el else None

                    events_found += 1

                    content_hash = generate_content_hash(title, VENUE_DATA["name"], "")

                    existing = find_event_by_hash(content_hash)

                    # Categorize by title keywords
                    title_lower = title.lower()
                    if any(k in title_lower for k in ["paint", "drawing", "sketch"]):
                        subcategory = "visual_arts"
                    elif any(k in title_lower for k in ["music", "guitar", "piano", "drum"]):
                        subcategory = "music_class"
                    elif any(k in title_lower for k in ["dance", "ballet", "salsa"]):
                        subcategory = "dance_class"
                    elif any(k in title_lower for k in ["knit", "crochet", "fiber", "sew"]):
                        subcategory = "fiber_arts"
                    else:
                        subcategory = "workshop"

                    event_record = {
                        "source_id": source_id,
                        "venue_id": venue_id,
                        "title": title[:500],
                        "description": description[:2000] if description else None,
                        "start_date": None,
                        "start_time": None,
                        "end_date": None,
                        "end_time": None,
                        "is_all_day": False,
                        "category": "art",
                        "subcategory": subcategory,
                        "tags": ["doraville", "class", "art", "community"],
                        "price_min": price if not is_free else 0,
                        "price_max": price if not is_free else 0,
                        "price_note": None,
                        "is_free": is_free,
                        "source_url": detail_url,
                        "ticket_url": detail_url,
                        "image_url": None,
                        "raw_text": None,
                        "extraction_confidence": 0.60,
                        "is_recurring": True,
                        "recurrence_rule": None,
                        "content_hash": content_hash,
                    }

                    if existing:
                        smart_update_existing_event(existing, event_record)
                        events_updated += 1
                    else:
                        insert_event(event_record)
                        events_new += 1
                        logger.info(f"Added class: {title[:50]}...")

                except Exception as e:
                    logger.error(f"Error processing class card: {e}")
                    continue

            browser.close()

        logger.info(
            f"Doraville Art Center crawl complete: {events_found} found, "
            f"{events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Doraville Art Center: {e}")
        raise

    return events_found, events_new, events_updated
