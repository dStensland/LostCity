"""
Crawler for All Fired Up Art (allfiredupart.com).

Paint-your-own pottery studio with 3 metro Atlanta locations:
  - Alpharetta: 53 South Main St, Alpharetta, GA 30009
  - Emory Village: 1563 North Decatur Rd, Atlanta, GA 30307
  - Sandy Plains / Marietta: 2960 Shallowford Rd Suite 305, Marietta, GA 30066

Programs include drop-in studio sessions, special workshops/events (pottery, clay,
resin, canvas painting), kids camps, and birthday parties.

Data source: BookThatApp (BTA) widget embedded in the Shopify site.
API endpoint: /apps/bookthatapp/api/v1/products?widget_id=86126
Schedule dates are stored as DTSTART/RRULE in schedule_items (UTC). The schedule
item title also carries the local-time representation ('2026-03-27 18:00'), which
is what we prefer — avoids DST math.

The drop-in studio appointment product (profile=appt) represents open-hours
booking slots, not a discrete event, so it is excluded per the
'no permanent attractions' rule. Only profile=class products are crawled.
"""

from __future__ import annotations

import logging
import re
from datetime import datetime, timedelta, timezone
from typing import Optional

import requests

from db import (
    get_or_create_place,
    insert_event,
    find_event_by_hash,
    smart_update_existing_event,
)
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://allfiredupart.com"
CALENDAR_URL = f"{BASE_URL}/pages/calendar"
BTA_PRODUCTS_URL = f"{BASE_URL}/apps/bookthatapp/api/v1/products?widget_id=86126"
SHOPIFY_PRODUCTS_URL = f"{BASE_URL}/products.json?limit=100"

# Locations — 3 metro Atlanta studios
VENUE_ALPHARETTA = {
    "name": "All Fired Up Art - Alpharetta",
    "slug": "all-fired-up-art-alpharetta",
    "address": "53 South Main St",
    "neighborhood": "Alpharetta",
    "city": "Alpharetta",
    "state": "GA",
    "zip": "30009",
    "lat": 34.0754,
    "lng": -84.2941,
    "venue_type": "studio",
    "website": BASE_URL,
    "vibes": ["family-friendly", "all-ages"],
}

VENUE_EMORY_VILLAGE = {
    "name": "All Fired Up Art - Emory Village",
    "slug": "all-fired-up-art-emory-village",
    "address": "1563 North Decatur Rd",
    "neighborhood": "Emory Village",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30307",
    "lat": 33.7952,
    "lng": -84.3283,
    "venue_type": "studio",
    "website": BASE_URL,
    "vibes": ["family-friendly", "all-ages"],
}

VENUE_MARIETTA = {
    "name": "All Fired Up Art - Marietta",
    "slug": "all-fired-up-art-marietta",
    "address": "2960 Shallowford Rd Suite 305",
    "neighborhood": "Sandy Plains",
    "city": "Marietta",
    "state": "GA",
    "zip": "30066",
    "lat": 34.0070,
    "lng": -84.4741,
    "venue_type": "studio",
    "website": BASE_URL,
    "vibes": ["family-friendly", "all-ages"],
}

# Location keyword → venue data (longest match first)
_LOCATION_MAP: list[tuple[str, dict]] = [
    ("emory village", VENUE_EMORY_VILLAGE),
    ("alpharetta", VENUE_ALPHARETTA),
    ("marietta", VENUE_MARIETTA),
    ("sandy plains", VENUE_MARIETTA),
    ("emory", VENUE_EMORY_VILLAGE),
]


def _infer_venue(title: str) -> dict:
    """Infer venue data from a product title containing a location keyword."""
    title_lower = title.lower()
    for keyword, place_data in _LOCATION_MAP:
        if keyword in title_lower:
            return place_data
    # Default to Alpharetta when no location keyword is found
    return VENUE_ALPHARETTA


def _parse_schedule_title_date(item_title: str) -> Optional[tuple[str, str]]:
    """
    Parse (date, time) from a BTA schedule item title string.

    BTA stores the local Eastern time in the item title, e.g. '2026-03-27 18:00'.
    This is preferable to converting from the UTC DTSTART.

    Returns (start_date, start_time) or None.
    """
    match = re.match(r"(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})", item_title)
    if match:
        return match.group(1), match.group(2)
    return None


def _parse_dtstart_utc(rules: str) -> Optional[datetime]:
    """
    Parse DTSTART from a BTA schedule_items rules string and return as UTC datetime.

    Format: 'DTSTART:20260327T220000Z\\nRRULE:FREQ=DAILY;COUNT=1'
    """
    match = re.search(r"DTSTART:(\d{8}T\d{6}Z)", rules)
    if not match:
        return None
    try:
        return datetime.strptime(match.group(1), "%Y%m%dT%H%M%SZ").replace(
            tzinfo=timezone.utc
        )
    except ValueError:
        return None


def _strip_html(html: str) -> str:
    """Strip HTML tags and decode basic HTML entities."""
    text = re.sub(r"<[^>]+>", " ", html)
    text = text.replace("&amp;", "&").replace("&nbsp;", " ").replace("&#39;", "'")
    text = re.sub(r"&[a-z]+;", "", text)
    return re.sub(r"\s+", " ", text).strip()


def _clean_title(raw_title: str) -> str:
    """
    Produce a display-friendly event title from a BTA product title.

    BTA product titles embed location and sometimes a date:
      'Katie the Messy Artist - Resin Ocean Dish - Alpharetta 3/27'
    becomes:
      'Katie the Messy Artist: Resin Ocean Dish'

    Strategy:
    1. Strip a trailing date pattern like '3/27' or '11/8'.
    2. Strip the trailing location name (preceded by ' - ').
    3. Strip date again in case it was after the location.
    """
    title = raw_title.strip()

    # Strip trailing date like '3/27' or '11/8'
    title = re.sub(r"\s+\d{1,2}/\d{1,2}$", "", title)

    # Strip trailing location (after last ' - ')
    location_keywords = [
        "emory village atlanta",
        "emory village",
        "alpharetta",
        "marietta",
        "sandy plains",
        "emory",
    ]
    title_lower = title.lower()
    for loc in location_keywords:
        pattern = f" - {loc}"
        if title_lower.endswith(pattern):
            title = title[: len(title) - len(pattern)].rstrip()
            break
        if title_lower.endswith(loc):
            title = title[: len(title) - len(loc)].rstrip(" -")
            break

    # Strip date again after location removal
    title = re.sub(r"\s+\d{1,2}/\d{1,2}$", "", title).strip()

    return title


def _build_description(
    *,
    clean_title: str,
    raw_description: str,
    venue_name: str,
    price_min: Optional[float],
    duration_minutes: int,
    source_url: str,
) -> str:
    """Build a clean event description."""
    parts: list[str] = []

    if raw_description and len(raw_description.strip()) > 30:
        body = raw_description.strip()
        parts.append(body if body.endswith(".") else f"{body}.")
    else:
        parts.append(f"Special art event at {venue_name}.")

    if price_min is not None and price_min > 0:
        parts.append(f"Tickets: ${price_min:.0f} per person.")
    elif price_min == 0:
        parts.append("Free to attend.")

    if duration_minutes > 0:
        hours, mins = divmod(duration_minutes, 60)
        if hours and mins:
            parts.append(f"Duration: {hours}h {mins}m.")
        elif hours:
            parts.append(f"Duration: {hours} hour{'s' if hours > 1 else ''}.")
        else:
            parts.append(f"Duration: {mins} minutes.")

    parts.append(f"Register and book at {source_url}")
    return " ".join(parts)[:1400]


def _is_future_date(date_str: str) -> bool:
    """Return True if date_str (YYYY-MM-DD) is today or in the future."""
    try:
        return datetime.strptime(date_str, "%Y-%m-%d").date() >= datetime.now().date()
    except ValueError:
        return False


def _fetch_bta_products(session: requests.Session) -> list[dict]:
    """Fetch all BTA product definitions with schedule_items."""
    try:
        resp = session.get(BTA_PRODUCTS_URL, timeout=20)
        resp.raise_for_status()
        return resp.json().get("products", [])
    except Exception as exc:
        logger.error(f"All Fired Up Art: failed to fetch BTA products: {exc}")
        return []


def _fetch_shopify_products(session: requests.Session) -> dict[int, dict]:
    """
    Fetch Shopify storefront products for description/image enrichment.

    Returns mapping of Shopify product ID (int) → product dict.
    """
    result: dict[int, dict] = {}
    try:
        resp = session.get(SHOPIFY_PRODUCTS_URL, timeout=20)
        resp.raise_for_status()
        for p in resp.json().get("products", []):
            pid = p.get("id")
            if pid:
                result[int(pid)] = p
    except Exception as exc:
        logger.error(f"All Fired Up Art: failed to fetch Shopify products: {exc}")
    return result


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl All Fired Up Art special events and workshops via the BookThatApp API.

    Coverage:
    - All 3 locations (Alpharetta, Emory Village, Marietta)
    - profile=class products only (discrete scheduled events)
    - Future events only (past events skipped)

    Enrichment: Shopify products.json provides description text, hero images,
    and confirmed pricing for each class SKU.
    """
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    session = requests.Session()
    session.headers.update(
        {
            "User-Agent": (
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            ),
            "Accept": "application/json, */*",
            "Referer": BASE_URL,
        }
    )

    # Ensure all 3 venue records exist in the DB before processing events
    venue_ids: dict[str, int] = {}
    for place_data in (VENUE_ALPHARETTA, VENUE_EMORY_VILLAGE, VENUE_MARIETTA):
        try:
            vid = get_or_create_place(place_data)
            venue_ids[place_data["slug"]] = vid
        except Exception as exc:
            logger.error(
                f"All Fired Up Art: failed to create venue '{place_data['name']}': {exc}"
            )

    # Fetch BTA scheduled events and Shopify product enrichment
    bta_products = _fetch_bta_products(session)
    shopify_by_id = _fetch_shopify_products(session)

    logger.info(
        f"All Fired Up Art: {len(bta_products)} BTA products, "
        f"{len(shopify_by_id)} Shopify products"
    )

    for product in bta_products:
        if product.get("profile") != "class":
            # Skip appt (open drop-in hours), course, deposit, bond
            continue

        schedule = product.get("schedule") or {}
        schedule_items = (schedule.get("schedule_items") or []) if schedule else []
        if not schedule_items:
            continue

        product_title = product.get("title", "").strip()
        bta_product_id = product.get("id")
        external_id = product.get("external_id")  # Shopify product ID

        # Shopify enrichment: description, image, price
        shopify_product: Optional[dict] = (
            shopify_by_id.get(int(external_id)) if external_id else None
        )
        raw_desc = ""
        image_url: Optional[str] = None
        price_min: Optional[float] = None

        if shopify_product:
            body_html = shopify_product.get("body_html") or ""
            raw_desc = _strip_html(body_html)[:500]
            images = shopify_product.get("images") or []
            if images:
                image_url = images[0].get("src")
            variants = shopify_product.get("variants") or []
            if variants:
                try:
                    price_min = float(variants[0].get("price", 0)) or None
                except (TypeError, ValueError):
                    price_min = None

        # BTA variant price as fallback
        if price_min is None:
            bta_variants = product.get("variants") or []
            if bta_variants:
                try:
                    val = float(bta_variants[0].get("price", 0))
                    price_min = val if val > 0 else None
                except (TypeError, ValueError):
                    pass

        # Duration: BTA stores seconds
        duration_data = product.get("duration") or {}
        duration_sec = int(duration_data.get("duration") or 0) if duration_data else 0
        duration_minutes = duration_sec // 60

        # Infer venue from product title
        place_data = _infer_venue(product_title)
        venue_id = venue_ids.get(place_data["slug"])
        if not venue_id:
            try:
                venue_id = get_or_create_place(place_data)
                venue_ids[place_data["slug"]] = venue_id
            except Exception as exc:
                logger.error(
                    f"All Fired Up Art: venue fallback creation failed for "
                    f"'{place_data['name']}': {exc}"
                )
                continue

        clean_title = _clean_title(product_title)

        # Shopify product URL for booking (deeplinks directly to booking flow)
        shopify_handle = (shopify_product or {}).get("handle") or ""
        source_url = (
            f"{BASE_URL}/products/{shopify_handle}" if shopify_handle else CALENDAR_URL
        )

        for item in schedule_items:
            item_title = item.get("title", "")
            rules = item.get("rules", "")

            # Prefer item title time (already local ET)
            parsed = _parse_schedule_title_date(item_title)
            if parsed:
                start_date, start_time = parsed
            else:
                # Fallback: parse DTSTART UTC → approximate ET (UTC-5)
                dt_utc = _parse_dtstart_utc(rules)
                if not dt_utc:
                    logger.warning(
                        f"All Fired Up Art: could not parse date for "
                        f"product '{product_title}' item {item.get('id')}"
                    )
                    continue
                dt_local = dt_utc - timedelta(hours=5)
                start_date = dt_local.strftime("%Y-%m-%d")
                start_time = dt_local.strftime("%H:%M")

            if not _is_future_date(start_date):
                continue

            events_found += 1

            description = _build_description(
                clean_title=clean_title,
                raw_description=raw_desc,
                venue_name=place_data["name"],
                price_min=price_min,
                duration_minutes=duration_minutes,
                source_url=source_url,
            )

            content_hash = generate_content_hash(
                clean_title, place_data["name"], start_date
            )

            is_free = price_min is not None and price_min == 0

            tags = ["family-friendly", "hands-on", "class", "kids", "rsvp-required"]
            title_lower = clean_title.lower()
            if any(
                kw in title_lower
                for kw in ["katie", "canvas", "resin", "pottery", "clay", "ceramic"]
            ):
                tags.append("arts")
            if price_min:
                tags.append("ticketed")

            event_record = {
                "source_id": source_id,
                "venue_id": venue_id,
                "title": clean_title,
                "description": description,
                "start_date": start_date,
                "start_time": start_time,
                "end_date": None,
                "end_time": None,
                "is_all_day": False,
                "category": "family",
                "subcategory": "art",
                "tags": list(dict.fromkeys(tags)),  # dedupe, preserve order
                "price_min": price_min,
                "price_max": price_min,  # BTA single-tier pricing
                "price_note": "Registration required. Price per person.",
                "is_free": is_free,
                "source_url": source_url,
                "ticket_url": source_url,
                "image_url": image_url,
                "raw_text": f"{product_title} | BTA product {bta_product_id}",
                "extraction_confidence": 0.92,
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
                logger.info(
                    f"All Fired Up Art: added '{clean_title}' "
                    f"at {place_data['name']} on {start_date}"
                )
            except Exception as exc:
                logger.error(
                    f"All Fired Up Art: insert failed for '{clean_title}' "
                    f"on {start_date}: {exc}"
                )

    logger.info(
        f"All Fired Up Art: {events_found} found, "
        f"{events_new} new, {events_updated} updated"
    )
    return events_found, events_new, events_updated
