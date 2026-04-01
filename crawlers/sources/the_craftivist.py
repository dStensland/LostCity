"""
Crawler for The Craftivist (thecraftivist.com).
Women-owned yarn and craft shop on Edgewood Ave in Inman Park.

Site is Shopify. Classes sold as products in /collections/knitting-classes-atlanta.
Also has a free "Open Table" drop-in knit/crochet session (in-person + virtual).
Shopify embeds product JSON in page analytics — we extract from there and
fall back to DOM scraping.
"""

from __future__ import annotations

import json
import re
import logging
from datetime import date, datetime, timedelta
from typing import Optional
from urllib.parse import urljoin

from playwright.sync_api import sync_playwright

from db import get_or_create_place, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://www.thecraftivist.com"
CLASSES_URL = f"{BASE_URL}/collections/knitting-classes-atlanta"
OPEN_TABLE_URL = f"{BASE_URL}/products/knit-togethers"

MAX_EVENTS = 30

PLACE_DATA = {
    "name": "The Craftivist",
    "slug": "the-craftivist",
    "address": "743 Edgewood Ave NE",
    "neighborhood": "Inman Park",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30307",
    "lat": 33.7583,
    "lng": -84.3560,
    "place_type": "venue",
    "spot_type": "shop",
    "website": BASE_URL,
}

WEEKDAY_CODES = {
    0: "MO",
    1: "TU",
    2: "WE",
    3: "TH",
    4: "FR",
    5: "SA",
    6: "SU",
}


def extract_price(price_text: str) -> Optional[float]:
    """Extract price from Shopify price string."""
    if not price_text:
        return None
    # Shopify sometimes stores price in cents
    match = re.search(r'\$(\d+(?:\.\d{2})?)', price_text)
    if match:
        return float(match.group(1))
    # Try raw number (cents)
    match = re.search(r'(\d+)00$', price_text)
    if match:
        return float(match.group(1))
    return None


def parse_class_dates(title: str) -> Optional[str]:
    """Try to extract first date from class title or variant text.

    Titles often contain patterns like 'Wed, Feb 4, 11, 18 & 25'
    or 'Sat, Feb 7, 14, 21 & 28'. We extract the first date.
    """
    # Match patterns like "Feb 4" or "Mar 8"
    month_map = {
        'jan': 1, 'feb': 2, 'mar': 3, 'apr': 4, 'may': 5, 'jun': 6,
        'jul': 7, 'aug': 8, 'sep': 9, 'oct': 10, 'nov': 11, 'dec': 12,
    }
    match = re.search(
        r'(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+(\d{1,2})',
        title.lower()
    )
    if match:
        month = month_map.get(match.group(1)[:3])
        day = int(match.group(2))
        year = datetime.now().year
        if month and 1 <= day <= 31:
            # If month is in the past, assume next year
            if month < datetime.now().month:
                year += 1
            try:
                return f"{year:04d}-{month:02d}-{day:02d}"
            except ValueError:
                pass
    return None


def _next_weekday_date(
    weekday: int,
    *,
    hour: int = 0,
    minute: int = 0,
    now: datetime | None = None,
) -> date:
    current = now or datetime.now()
    today = current.date()
    days_ahead = (weekday - today.weekday()) % 7
    if days_ahead == 0 and (current.hour > hour or (current.hour == hour and current.minute >= minute)):
        days_ahead = 7
    return today + timedelta(days=days_ahead)


def _third_friday_date(now: datetime | None = None) -> date:
    current = now or datetime.now()
    year = current.year
    month = current.month

    while True:
        first_day = date(year, month, 1)
        days_until_friday = (4 - first_day.weekday()) % 7
        third_friday = first_day + timedelta(days=days_until_friday + 14)
        if third_friday > current.date() or (
            third_friday == current.date()
            and (current.hour < 18 or (current.hour == 18 and current.minute < 0))
        ):
            return third_friday
        month += 1
        if month == 13:
            month = 1
            year += 1


def _build_recurring_open_table_rows(source_id: int, venue_id: int) -> list[dict]:
    weekly_rows = [
        {
            "title": "Open Table at The Craftivist",
            "description": "Free in-person knit and crochet gathering. All crafts welcome.",
            "weekday": 1,
            "start_time": "14:00",
            "end_time": "16:00",
            "recurrence_rule": "FREQ=WEEKLY;BYDAY=TU",
            "tags": ["open-table", "drop-in", "knitting", "crochet", "free", "inman-park"],
        },
        {
            "title": "Open Table at The Craftivist",
            "description": "Free in-person knit and crochet gathering. All crafts welcome.",
            "weekday": 5,
            "start_time": "15:00",
            "end_time": "17:00",
            "recurrence_rule": "FREQ=WEEKLY;BYDAY=SA",
            "tags": ["open-table", "drop-in", "knitting", "crochet", "free", "inman-park"],
        },
        {
            "title": "Open Table at The Craftivist",
            "description": "Free in-person knit and crochet gathering. All crafts welcome.",
            "weekday": 6,
            "start_time": "15:00",
            "end_time": "17:00",
            "recurrence_rule": "FREQ=WEEKLY;BYDAY=SU",
            "tags": ["open-table", "drop-in", "knitting", "crochet", "free", "inman-park"],
        },
        {
            "title": "Virtual Open Table at The Craftivist",
            "description": "Free Thursday night Zoom knit and crochet gathering.",
            "weekday": 3,
            "start_time": "19:00",
            "end_time": "21:00",
            "recurrence_rule": "FREQ=WEEKLY;BYDAY=TH",
            "tags": ["open-table", "virtual", "knitting", "crochet", "free", "zoom"],
        },
    ]

    rows: list[dict] = []
    for row in weekly_rows:
        hour, minute = (int(part) for part in row["start_time"].split(":", 1))
        start_date = _next_weekday_date(
            row["weekday"], hour=hour, minute=minute
        ).isoformat()
        rows.append(
            {
                "source_id": source_id,
                "place_id": venue_id,
                "title": row["title"],
                "description": row["description"],
                "start_date": start_date,
                "start_time": row["start_time"],
                "end_date": None,
                "end_time": row["end_time"],
                "is_all_day": False,
                "category": "community",
                "subcategory": "social",
                "tags": row["tags"],
                "price_min": 0,
                "price_max": 0,
                "price_note": None,
                "is_free": True,
                "source_url": OPEN_TABLE_URL,
                "ticket_url": OPEN_TABLE_URL,
                "image_url": None,
                "raw_text": row["description"],
                "extraction_confidence": 0.9,
                "is_recurring": True,
                "recurrence_rule": row["recurrence_rule"],
                "content_hash": generate_content_hash(
                    f"{row['title']} {WEEKDAY_CODES[row['weekday']]}",
                    PLACE_DATA["name"],
                    start_date,
                ),
            }
        )

    mixer_date = _third_friday_date().isoformat()
    rows.append(
        {
            "source_id": source_id,
            "place_id": venue_id,
            "title": "Mykeala's Monthly Mixer at The Craftivist",
            "description": "Free monthly Open Table mixer held every third Friday from 6-8 pm.",
            "start_date": mixer_date,
            "start_time": "18:00",
            "end_date": None,
            "end_time": "20:00",
            "is_all_day": False,
            "category": "community",
            "subcategory": "social",
            "tags": ["open-table", "mixer", "knitting", "crochet", "free", "inman-park"],
            "price_min": 0,
            "price_max": 0,
            "price_note": None,
            "is_free": True,
            "source_url": urljoin(BASE_URL, "/products/mykealas-monthly-mixer"),
            "ticket_url": urljoin(BASE_URL, "/products/mykealas-monthly-mixer"),
            "image_url": None,
            "raw_text": "Mykeala's Monthly Mixer every third Friday from 6-8 pm.",
            "extraction_confidence": 0.9,
            "is_recurring": True,
            "recurrence_rule": "FREQ=MONTHLY;BYDAY=3FR",
            "content_hash": generate_content_hash(
                "Mykeala's Monthly Mixer at The Craftivist",
                PLACE_DATA["name"],
                mixer_date,
            ),
        }
    )

    return rows


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl The Craftivist classes from Shopify collection page.

    Scrapes /collections/knitting-classes-atlanta for class products,
    and /products/knit-togethers for the free Open Table drop-in.

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

            venue_id = get_or_create_place(PLACE_DATA)

            # --- Scrape classes collection ---
            logger.info(f"Fetching The Craftivist classes: {CLASSES_URL}")
            page.goto(CLASSES_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(3000)

            # Scroll to load all products
            for _ in range(3):
                page.evaluate("window.scrollBy(0, 1000)")
                page.wait_for_timeout(1000)

            # Try to extract Shopify analytics JSON for structured product data
            shopify_data = None
            try:
                shopify_data = page.evaluate("""
                    () => {
                        const metas = document.querySelectorAll('script[type="application/json"]');
                        for (const m of metas) {
                            try {
                                const d = JSON.parse(m.textContent);
                                if (d && d.products) return d.products;
                            } catch(e) {}
                        }
                        // Try ShopifyAnalytics
                        if (window.ShopifyAnalytics && window.ShopifyAnalytics.meta) {
                            return window.ShopifyAnalytics.meta.products;
                        }
                        return null;
                    }
                """)
            except Exception:
                pass

            # Fall back to DOM scraping — Shopify product cards
            product_cards = page.query_selector_all(
                ".product-card, .grid-product, .collection-product, "
                "[data-product-card], .product-item"
            )
            logger.info(f"Found {len(product_cards)} product cards")

            for card in product_cards[:MAX_EVENTS]:
                try:
                    # Title
                    title_el = card.query_selector(
                        ".product-card__title, .grid-product__title, h2, h3, "
                        ".product-title, [data-product-title]"
                    )
                    title = title_el.inner_text().strip() if title_el else None
                    if not title:
                        continue

                    # Link
                    link_el = card.query_selector("a[href*='/products/']")
                    detail_url = link_el.get_attribute("href") if link_el else None
                    if detail_url and not detail_url.startswith("http"):
                        detail_url = urljoin(BASE_URL, detail_url)

                    # Price
                    price_el = card.query_selector(
                        ".product-card__price, .grid-product__price, .price, "
                        ".product-price, [data-product-price]"
                    )
                    price_text = price_el.inner_text() if price_el else ""
                    price = extract_price(price_text)

                    # Try to get date from title or variant text
                    variant_el = card.query_selector(
                        ".product-card__variant, .variant-title, .product-option"
                    )
                    variant_text = variant_el.inner_text() if variant_el else ""
                    start_date = parse_class_dates(variant_text) or parse_class_dates(title)

                    events_found += 1

                    content_hash = generate_content_hash(title, PLACE_DATA["name"], start_date or "")

                    existing = find_event_by_hash(content_hash)

                    # Categorize
                    title_lower = title.lower()
                    if "crochet" in title_lower:
                        tags = ["crochet", "class", "fiber-arts", "inman-park"]
                    elif "knit" in title_lower:
                        tags = ["knitting", "class", "fiber-arts", "inman-park"]
                    else:
                        tags = ["craft", "class", "fiber-arts", "inman-park"]

                    event_record = {
                        "source_id": source_id,
                        "place_id": venue_id,
                        "title": title[:500],
                        "description": None,
                        "start_date": start_date,
                        "start_time": None,
                        "end_date": None,
                        "end_time": None,
                        "is_all_day": False,
                        "category": "art",
                        "subcategory": "workshop",
                        "tags": tags,
                        "price_min": price,
                        "price_max": price,
                        "price_note": None,
                        "is_free": price == 0 if price is not None else False,
                        "source_url": detail_url,
                        "ticket_url": detail_url,
                        "image_url": None,
                        "raw_text": None,
                        "extraction_confidence": 0.75,
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
                    logger.error(f"Error processing product card: {e}")
                    continue

            # --- Recurring Open Table programming ---
            try:
                logger.info(f"Checking Open Table: {OPEN_TABLE_URL}")
                page.goto(OPEN_TABLE_URL, wait_until="domcontentloaded", timeout=30000)
                page.wait_for_timeout(2000)

                for event_record in _build_recurring_open_table_rows(
                    source_id, venue_id
                ):
                    events_found += 1
                    existing = find_event_by_hash(event_record["content_hash"])
                    if existing:
                        smart_update_existing_event(existing, event_record)
                        events_updated += 1
                    else:
                        insert_event(event_record)
                        events_new += 1
                        logger.info("Added recurring event: %s", event_record["title"])

            except Exception as e:
                logger.warning(f"Could not fetch Open Table page: {e}")

            browser.close()

        logger.info(
            f"The Craftivist crawl complete: {events_found} found, "
            f"{events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl The Craftivist: {e}")
        raise

    return events_found, events_new, events_updated
