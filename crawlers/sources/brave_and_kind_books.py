"""
Crawler for Brave + Kind Bookshop (braveandkindbooks.com).

Brave + Kind is an independent bookstore in Decatur, GA that hosts a recurring
series of infant/toddler programming including:

  - "Babies Off Book" — monthly sensory story experience for infants and
    toddlers, in partnership with Alliance Theatre teaching artists.
    Saturdays at 12:00 PM. Ages 0-2.

  - "French Stories with Friends" — 2nd Saturday bilingual storytime led
    by author Krystal Odume. Ages 0-5. Free.

  - "Cuentos con Amigos" — monthly Spanish-language storytime. Ages 0-5.

The store uses Shopify for event "products". Events live in the
`brave-events` collection. Each product's body_html contains the date list
and recurring schedule in plain text. Variants are typically free ($0.00)
or ticketed.

CRAWL STRATEGY:
  1. Fetch all products in the brave-events collection via Shopify JSON API:
     GET /collections/brave-events/products.json?limit=50
  2. For each product, parse future dates from the body_html.
  3. Emit one event per future date, with age tags inferred from the title/body.
  4. Dedup by content hash (title + venue + date).

SHOPIFY PRODUCT ENDPOINT:
  GET https://www.braveandkindbooks.com/products/{handle}.json
  → product.body_html contains schedule text
  → product.variants[0].price gives ticket price (0.00 = free)
  → product.images[0].src gives event image
"""

from __future__ import annotations

import logging
import re
from datetime import datetime, date
from typing import Optional

import requests

from db import (
    find_event_by_hash,
    get_or_create_place,
    insert_event,
    smart_update_existing_event,
)
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

_COLLECTION_URL = (
    "https://www.braveandkindbooks.com/collections/brave-events/products.json"
)
_PRODUCT_URL_BASE = "https://www.braveandkindbooks.com/products/"
_STORE_URL = "https://www.braveandkindbooks.com"

_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/122.0.0.0 Safari/537.36"
    ),
}

_REQUEST_TIMEOUT = 20

PLACE_DATA = {
    "name": "Brave + Kind Bookshop",
    "slug": "brave-and-kind-books",
    "address": "308 W Ponce De Leon Ave",
    "neighborhood": "Downtown Decatur",
    "city": "Decatur",
    "state": "GA",
    "zip": "30030",
    "lat": 33.7741,
    "lng": -84.2968,
    "venue_type": "bookstore",
    "spot_type": "bookstore",
    "website": _STORE_URL,
    "vibes": ["family-friendly", "community", "kids", "cozy"],
}

# ---------------------------------------------------------------------------
# Age inference from product title/description
# ---------------------------------------------------------------------------

_AGE_HINTS: list[tuple[re.Pattern, int, int]] = [
    # Combined "infant and toddler" mentions → 0-3 range
    (
        re.compile(
            r"infant.{0,30}toddler|toddler.{0,30}infant|babies.{0,30}toddler",
            re.IGNORECASE,
        ),
        0,
        3,
    ),
    # Explicit age ranges
    (re.compile(r"ages?\s+0\s*[–-]\s*2", re.IGNORECASE), 0, 2),
    (re.compile(r"ages?\s+0\s*[–-]\s*5", re.IGNORECASE), 0, 5),
    (re.compile(r"ages?\s+0\s*[–-]\s*4", re.IGNORECASE), 0, 4),
    # Single age band mentions
    (re.compile(r"infant|newborn|baby|babies|newborns", re.IGNORECASE), 0, 1),
    (re.compile(r"toddler", re.IGNORECASE), 1, 3),
    (re.compile(r"preschool", re.IGNORECASE), 3, 5),
]


def _infer_age_range(title: str, body: str) -> tuple[Optional[int], Optional[int]]:
    """Infer age_min/age_max from product title and body text."""
    # Strip HTML for cleaner matching
    plain_body = re.sub(r"<[^>]+>", " ", body)
    combined = f"{title} {plain_body}"
    for pattern, lo, hi in _AGE_HINTS:
        if pattern.search(combined):
            return lo, hi
    # General storytime / kids — broad range
    if re.search(
        r"story.?time|storytime|kids|children|bilingual|spanish|french",
        combined,
        re.IGNORECASE,
    ):
        return 0, 8
    return None, None


def _age_band_tags(age_min: Optional[int], age_max: Optional[int]) -> list[str]:
    """Return age-band tags overlapping [age_min, age_max]."""
    bands = [
        (0, 1, "infant"),
        (1, 3, "toddler"),
        (3, 5, "preschool"),
        (5, 12, "elementary"),
    ]
    if age_min is None and age_max is None:
        return []
    lo = age_min if age_min is not None else 0
    hi = age_max if age_max is not None else 100
    return [tag for (band_lo, band_hi, tag) in bands if lo <= band_hi and hi >= band_lo]


# ---------------------------------------------------------------------------
# Date parsing from body HTML
# ---------------------------------------------------------------------------

_MONTH_MAP = {
    "january": 1,
    "february": 2,
    "march": 3,
    "april": 4,
    "may": 5,
    "june": 6,
    "july": 7,
    "august": 8,
    "september": 9,
    "october": 10,
    "november": 11,
    "december": 12,
    "jan": 1,
    "feb": 2,
    "mar": 3,
    "apr": 4,
    "jun": 6,
    "jul": 7,
    "aug": 8,
    "sep": 9,
    "oct": 10,
    "nov": 11,
    "dec": 12,
}

# Patterns like "March 21, 2026" or "March 21" (year inferred)
_DATE_RE = re.compile(
    r"(January|February|March|April|May|June|July|August|September|October|November|December)\s+"
    r"(\d{1,2})(?:st|nd|rd|th)?,?\s*(\d{4})?",
    re.IGNORECASE,
)


def _parse_dates_from_html(body_html: str) -> list[str]:
    """Extract future dates (YYYY-MM-DD) from a product body_html string."""
    # Strip HTML tags first to avoid matching within attribute values
    plain = re.sub(r"<[^>]+>", " ", body_html)
    plain = re.sub(r"\s+", " ", plain)

    today = date.today()
    found: list[str] = []

    for m in _DATE_RE.finditer(plain):
        month_str = m.group(1).lower()
        day = int(m.group(2))
        year_str = m.group(3)

        month = _MONTH_MAP.get(month_str[:3])
        if month is None:
            continue

        if year_str:
            year = int(year_str)
        else:
            # Infer year: if the date (month/day) hasn't passed yet this year use
            # current year, otherwise next year
            year = today.year
            try:
                candidate = date(year, month, day)
                if candidate < today:
                    year += 1
            except ValueError:
                continue

        try:
            event_date = date(year, month, day)
        except ValueError:
            continue

        # Skip past dates
        if event_date < today:
            continue

        found.append(event_date.strftime("%Y-%m-%d"))

    return sorted(set(found))


def _parse_time_from_html(body_html: str) -> Optional[str]:
    """Extract the first time mention (e.g. '12:00 PM') from body_html."""
    plain = re.sub(r"<[^>]+>", " ", body_html)
    m = re.search(r"\b(\d{1,2}:\d{2})\s*(AM|PM|am|pm)\b", plain)
    if not m:
        return None
    raw = f"{m.group(1)}{m.group(2).upper()}"
    try:
        return datetime.strptime(raw, "%I:%M%p").strftime("%H:%M")
    except ValueError:
        return None


def _parse_price(variant_price: str) -> tuple[bool, Optional[float]]:
    """Return (is_free, price_min) from Shopify variant price string."""
    try:
        val = float(variant_price)
        return val == 0.0, val if val > 0 else None
    except (ValueError, TypeError):
        return False, None


# ---------------------------------------------------------------------------
# Product → event records
# ---------------------------------------------------------------------------

# Products that are NOT infant/toddler programming (skip them)
_SKIP_TITLE_PATTERNS = re.compile(
    r"\bauthor\s+event\b|\bbook\s+club\b|\bpoetry\b|\bcelebrat|\bsigning\b",
    re.IGNORECASE,
)


def _is_family_programming(title: str, body: str) -> bool:
    """Return True if this Shopify product is family/infant-focused programming."""
    if _SKIP_TITLE_PATTERNS.search(title):
        return False
    combined = (title + " " + re.sub(r"<[^>]+>", " ", body)).lower()
    family_keywords = [
        "baby",
        "babies",
        "infant",
        "toddler",
        "story",
        "storytime",
        "children",
        "kids",
        "bilingual",
        "sensory",
        "french",
        "spanish",
        "caregiver",
    ]
    return any(kw in combined for kw in family_keywords)


def _products_to_events(
    products: list[dict],
    source_id: int,
    venue_id: int,
) -> list[tuple[dict, dict]]:
    """Convert Shopify product list to (event_record, series_hint) pairs."""
    results = []

    for product in products:
        title_raw = product.get("title", "").strip()
        body_html = product.get("body_html") or ""
        handle = product.get("handle", "")
        images = product.get("images") or []
        variants = product.get("variants") or []

        if not title_raw:
            continue

        # Skip non-family products
        if not _is_family_programming(title_raw, body_html):
            logger.debug("[brave-kind] Skipping non-family product: %r", title_raw)
            continue

        # Parse future dates from body
        dates = _parse_dates_from_html(body_html)
        if not dates:
            logger.debug(
                "[brave-kind] No future dates found for %r — skipping", title_raw
            )
            continue

        # Parse time
        start_time = _parse_time_from_html(body_html)

        # Price
        price_str = variants[0].get("price", "0.00") if variants else "0.00"
        is_free, price_min = _parse_price(price_str)

        # Image
        image_url = images[0].get("src") if images else None

        # Age range
        age_min, age_max = _infer_age_range(title_raw, body_html)

        # Tags
        tags = ["storytime", "family-friendly", "kids", "bookstore"]
        if is_free:
            tags.append("free")
        age_tags = _age_band_tags(age_min, age_max)
        for t in age_tags:
            if t not in tags:
                tags.append(t)

        # Description: strip HTML from body, take first 400 chars
        plain_body = re.sub(r"<[^>]+>", " ", body_html)
        plain_body = re.sub(r"\s+", " ", plain_body).strip()
        description = plain_body[:500] if plain_body else None

        # Source URL
        source_url = f"{_STORE_URL}/products/{handle}"

        # Series hint — use clean title as series name
        series_hint = {
            "series_type": "recurring_show",
            "series_title": title_raw,
            "frequency": "monthly",
        }

        for event_date in dates:
            content_hash = generate_content_hash(
                title_raw, "Brave + Kind Bookshop", event_date
            )

            record: dict = {
                "source_id": source_id,
                "venue_id": venue_id,
                "title": title_raw,
                "description": description,
                "start_date": event_date,
                "end_date": None,
                "start_time": start_time,
                "end_time": None,
                "is_all_day": False,
                "category": "family",
                "subcategory": "family.storytime",
                "tags": tags,
                "is_free": is_free,
                "price_min": price_min,
                "price_max": price_min,
                "price_note": None if is_free else "See event page for pricing",
                "source_url": source_url,
                "ticket_url": source_url,
                "image_url": image_url,
                "raw_text": f"{title_raw} — {event_date}",
                "extraction_confidence": 0.88,
                "is_recurring": True,
                "content_hash": content_hash,
            }

            if age_min is not None:
                record["age_min"] = age_min
            if age_max is not None:
                record["age_max"] = age_max

            results.append((record, series_hint))

    return results


# ---------------------------------------------------------------------------
# Main crawl entry point
# ---------------------------------------------------------------------------


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl Brave + Kind Bookshop events from Shopify product collection.

    Returns (events_found, events_new, events_updated).
    """
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    # Ensure venue exists
    try:
        venue_id = get_or_create_place(PLACE_DATA)
    except Exception as exc:
        logger.error("[brave-kind] Failed to get/create venue: %s", exc)
        return 0, 0, 0

    logger.info("[brave-kind] Starting crawl")

    # Fetch products from the events collection
    try:
        resp = requests.get(
            _COLLECTION_URL,
            headers=_HEADERS,
            params={"limit": 50},
            timeout=_REQUEST_TIMEOUT,
        )
        resp.raise_for_status()
        products = resp.json().get("products", [])
        logger.info(
            "[brave-kind] Fetched %d products from events collection", len(products)
        )
    except Exception as exc:
        logger.error("[brave-kind] Failed to fetch products: %s", exc)
        return 0, 0, 0

    # Convert to event records
    event_pairs = _products_to_events(products, source_id, venue_id)

    for record, series_hint in event_pairs:
        events_found += 1
        content_hash = record["content_hash"]
        existing = find_event_by_hash(content_hash)
        if existing:
            smart_update_existing_event(existing, record)
            events_updated += 1
        else:
            try:
                insert_event(record, series_hint=series_hint)
                events_new += 1
                logger.debug(
                    "[brave-kind] Added: %s on %s",
                    record["title"],
                    record["start_date"],
                )
            except Exception as exc:
                logger.error(
                    "[brave-kind] Failed to insert %r on %s: %s",
                    record["title"],
                    record["start_date"],
                    exc,
                )

    logger.info(
        "[brave-kind] Crawl complete: %d found, %d new, %d updated",
        events_found,
        events_new,
        events_updated,
    )
    return events_found, events_new, events_updated
