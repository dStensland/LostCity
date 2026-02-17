"""
Crawler for Needle Nook (needlenookyarns.com).
Fiber arts shop since 1976 near Emory on Briarcliff Rd.

Site is WordPress + WooCommerce. Classes are listed as WooCommerce products
at /shop/classes/. Each class product has title, dates in description,
and price.
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

BASE_URL = "https://needlenookyarns.com"
CLASSES_URL = f"{BASE_URL}/shop/classes/"

MAX_EVENTS = 30

VENUE_DATA = {
    "name": "Needle Nook",
    "slug": "needle-nook",
    "address": "2165 Briarcliff Rd NE",
    "neighborhood": "Briarcliff",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30329",
    "lat": 33.8065,
    "lng": -84.3255,
    "venue_type": "venue",
    "spot_type": "shop",
    "website": BASE_URL,
}


def extract_price(price_text: str) -> Optional[float]:
    """Extract price from WooCommerce price string like '$45.00'."""
    if not price_text:
        return None
    match = re.search(r'\$(\d+(?:\.\d{2})?)', price_text)
    return float(match.group(1)) if match else None


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl Needle Nook classes page.

    WooCommerce product listing at /shop/classes/. Each product card has
    a title, price, and link to detail page with dates/description.

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

            logger.info(f"Fetching Needle Nook classes: {CLASSES_URL}")
            page.goto(CLASSES_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(3000)

            # Scroll to load all products
            for _ in range(3):
                page.evaluate("window.scrollBy(0, 1000)")
                page.wait_for_timeout(1000)

            # WooCommerce product cards
            products = page.query_selector_all(".product, .type-product, li.product")
            logger.info(f"Found {len(products)} class products")

            for product in products[:MAX_EVENTS]:
                try:
                    # Title
                    title_el = product.query_selector("h2, .woocommerce-loop-product__title, .product-title")
                    title = title_el.inner_text().strip() if title_el else None
                    if not title:
                        continue

                    # Link
                    link_el = product.query_selector("a[href*='/product/']")
                    detail_url = link_el.get_attribute("href") if link_el else None

                    # Price
                    price_el = product.query_selector(".price, .woocommerce-Price-amount")
                    price_text = price_el.inner_text() if price_el else ""
                    price = extract_price(price_text)

                    events_found += 1

                    # Use title + venue as hash since we don't have precise dates from listing
                    content_hash = generate_content_hash(title, VENUE_DATA["name"], "")

                    existing = find_event_by_hash(content_hash)

                    event_record = {
                        "source_id": source_id,
                        "venue_id": venue_id,
                        "title": title[:500],
                        "description": None,
                        "start_date": None,  # Would need detail page scrape
                        "start_time": None,
                        "end_date": None,
                        "end_time": None,
                        "is_all_day": False,
                        "category": "art",
                        "subcategory": "workshop",
                        "tags": ["fiber-arts", "knitting", "crochet", "class", "briarcliff"],
                        "price_min": price,
                        "price_max": price,
                        "price_note": None,
                        "is_free": price == 0 if price is not None else False,
                        "source_url": detail_url,
                        "ticket_url": detail_url,
                        "image_url": None,
                        "raw_text": None,
                        "extraction_confidence": 0.65,
                        "is_recurring": False,
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
                    logger.error(f"Error processing product: {e}")
                    continue

            browser.close()

        logger.info(
            f"Needle Nook crawl complete: {events_found} found, "
            f"{events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Needle Nook: {e}")
        raise

    return events_found, events_new, events_updated
