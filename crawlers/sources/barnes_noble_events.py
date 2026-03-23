"""
Crawler for Barnes & Noble store events across metro Atlanta.

B&N hosts events at stores.barnesandnoble.com, backed by a Next.js app
that consumes a REST API at /locator-api/v1/. The site blocks automated
requests from barnesandnoble.com (Akamai Bot Manager), but stores.barnesandnoble.com
is accessible via a non-headless Playwright browser with basic stealth settings.

Strategy:
  1. Launch a non-headless Chromium browser with navigator.webdriver overridden.
  2. Load stores.barnesandnoble.com once to establish session cookies.
  3. Call the locator API from the browser context using fetch():
     - GET /locator-api/v1/stores?lat=...&lng=...&radius=50 → store list
     - GET /locator-api/v1/events?lat=...&lng=...&radius=50&pageSize=200 → events
  4. Filter to Georgia stores within the defined Atlanta metro store IDs.
  5. Insert one venue per store, deduplicate events by content hash.

Atlanta metro stores covered (as of 2026-03):
  1907  Buckhead           Atlanta  30305
  2794  Cumberland         Atlanta  30339
  2846  Perimeter          Atlanta  30346 (Dunwoody)
  3443  East Cobb          Marietta 30062
  2656  Town Center Prado  Marietta 30066
  2157  Avenue at West Cobb Marietta 30064
  2070  The Forum          Peachtree Corners 30092
  1955  Mansell Crossings  Alpharetta 30022
  2256  Shoppes at Webb Gin Snellville 30078
  2330  Collection at Forsyth Cumming 30041
  2972  Mall of Georgia    Buford  30519
  3583  Edgewood           Atlanta  30307 (opening Jun 2026)

Series grouping:
  - Weekly Storytime events → series (recurring_show)
  - Author events → one-off (no series)
  - LEGO/craft builds → no series
"""

from __future__ import annotations

import logging
import re
from datetime import datetime
from typing import Optional

from playwright.sync_api import sync_playwright

from db import (
    get_or_create_venue,
    insert_event,
    find_event_by_hash,
    smart_update_existing_event,
)
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://stores.barnesandnoble.com"
# Atlanta city centre lat/lng — used to query the locator API radius
ATL_LAT = 33.748992
ATL_LNG = -84.390264
SEARCH_RADIUS_MILES = 50

# Store IDs for the metro Atlanta stores we want to cover.
# Stores outside this set (e.g. Newnan, Dawsonville) are excluded as too
# far from the core Atlanta market served by the platform.
ATLANTA_METRO_STORE_IDS: set[int] = {
    1907,  # Buckhead (Atlanta)
    2794,  # Cumberland (Atlanta/Vinings)
    2846,  # Perimeter (Dunwoody)
    3443,  # East Cobb (Marietta)
    2656,  # Town Center Prado (Marietta)
    2157,  # Avenue at West Cobb (Marietta)
    2070,  # The Forum (Peachtree Corners)
    1955,  # Mansell Crossings (Alpharetta)
    2256,  # Shoppes at Webb Gin (Snellville)
    2330,  # Collection at Forsyth (Cumming)
    2972,  # Mall of Georgia (Buford)
    3583,  # Edgewood (Atlanta) — opening Jun 2026
}

# Neighborhood overrides: store_id → neighborhood name used in venue record.
# Falls back to city name for stores outside Atlanta proper.
STORE_NEIGHBORHOODS: dict[int, str] = {
    1907: "Buckhead",
    2794: "Cumberland",
    2846: "Perimeter",
    3443: "East Cobb",
    2656: "Town Center",
    2157: "West Cobb",
    2070: "Peachtree Corners",
    1955: "Alpharetta",
    2256: "Snellville",
    2330: "Cumming",
    2972: "Buford",
    3583: "Edgewood",
}

# Event type codes → LostCity category mappings
_TYPE_CODE_TO_CATEGORY: dict[str, str] = {
    "ST": "family",  # Storytime
    "AE": "words",  # Author Event
    "BC": "community",  # Book Club
    "SP": "family",  # Special Event (LEGO builds, seasonal)
    "FE": "family",  # Featured Event
    "OT": "community",  # Other
}

# Tags derived from event type code
_TYPE_CODE_TO_TAGS: dict[str, list[str]] = {
    "ST": [
        "kids",
        "storytime",
        "family-friendly",
        "all-ages",
        "toddler",
        "preschool",
        "elementary",
    ],
    "AE": ["educational"],
    "BC": ["educational", "community"],
    "SP": ["family-friendly", "all-ages"],
    "FE": ["family-friendly"],
}

# Storytime name patterns — used to identify recurring storytime events
_STORYTIME_PATTERNS = re.compile(
    r"\b(story\s*time|storytime|story\s+hour)\b",
    re.IGNORECASE,
)


def _build_venue_data(store: dict) -> dict:
    """Convert a locator-api store dict into a LostCity venue record."""
    store_id = store["storeId"]
    neighborhood = STORE_NEIGHBORHOODS.get(store_id, store.get("city", "Atlanta"))

    address = store.get("address2") or store.get("address1") or ""

    return {
        "name": f"Barnes & Noble {store['name']}",
        "slug": f"barnes-noble-{store['name'].lower().replace(' ', '-').replace('&', 'and')}",
        "address": address,
        "neighborhood": neighborhood,
        "city": store.get("city", "Atlanta"),
        "state": store.get("state", "GA"),
        "zip": store.get("zip", ""),
        "lat": store.get("latitude"),
        "lng": store.get("longitude"),
        "venue_type": "bookstore",
        "website": f"{BASE_URL}/store/{store_id}",
        "phone": store.get("phone"),
    }


def _determine_category_and_tags(
    event: dict,
) -> tuple[str, list[str]]:
    """Return (category, tags) from event type codes and title."""
    types = event.get("types") or []
    type_codes = [t.get("typeCode", "") for t in types]

    category = "family"  # sensible default for B&N events
    tags: list[str] = ["bookstore", "books", "reading"]

    is_storytime = event.get("isStoryTime") or bool(
        _STORYTIME_PATTERNS.search(event.get("name", ""))
    )

    if is_storytime:
        category = "family"
        tags += [
            "kids",
            "storytime",
            "family-friendly",
            "all-ages",
            "toddler",
            "preschool",
            "elementary",
        ]
    else:
        for code in type_codes:
            if code in _TYPE_CODE_TO_CATEGORY:
                category = _TYPE_CODE_TO_CATEGORY[code]
                tags += _TYPE_CODE_TO_TAGS.get(code, [])
                break

        # Author events → words category with learning tag
        if "AE" in type_codes:
            category = "words"
            if "educational" not in tags:
                tags.append("educational")

        # LEGO / craft builds
        title_lower = event.get("name", "").lower()
        if "lego" in title_lower or "build" in title_lower or "craft" in title_lower:
            tags += ["hands-on", "kids", "family-friendly"]
            category = "family"

    # Dedup tags
    return category, list(dict.fromkeys(tags))


def _parse_event(
    event: dict,
    store_info: dict,
    source_id: int,
    venue_id: int,
) -> Optional[dict]:
    """
    Convert a single locator-api event dict into a LostCity event record.

    Returns None if the event is missing required fields.
    """
    title = (event.get("name") or "").strip()
    if not title or len(title) < 3:
        return None

    start_date = event.get("date")  # already "YYYY-MM-DD"
    if not start_date:
        return None

    # Validate date format
    try:
        datetime.strptime(start_date, "%Y-%m-%d")
    except ValueError:
        logger.debug("Skipping event with invalid date: %s", start_date)
        return None

    # time24 is "HH:MM" — use it directly; fall back to parsing time (AM/PM)
    start_time: Optional[str] = None
    time24 = event.get("time24")
    if time24 and re.match(r"^\d{2}:\d{2}$", time24):
        start_time = time24
    else:
        raw_time = event.get("time", "")
        if raw_time:
            m = re.match(r"(\d{1,2}):(\d{2})\s*(AM|PM)", raw_time, re.IGNORECASE)
            if m:
                hour, minute, period = (
                    int(m.group(1)),
                    int(m.group(2)),
                    m.group(3).upper(),
                )
                if period == "PM" and hour != 12:
                    hour += 12
                elif period == "AM" and hour == 12:
                    hour = 0
                start_time = f"{hour:02d}:{minute:02d}"

    description = (event.get("descriptionText") or "").strip()
    description = description[:2000] if description else None

    # Build source URL — link to the event detail page
    event_id = event.get("eventId", "")
    event_url = f"{BASE_URL}/event/{event_id}" if event_id else BASE_URL

    # Image URL — authors have a prodimage URL; generic events use largeIcon
    image_url: Optional[str] = None
    authors = event.get("authors") or []
    eans = event.get("eans") or []
    large_icon = event.get("largeIcon")

    if authors and authors[0].get("authorId"):
        author_id = str(authors[0]["authorId"]).zfill(13)
        image_url = f"https://prodimage.images-bn.com/cimages/{author_id}"
    elif eans:
        image_url = f"https://prodimage.images-bn.com/pimages/{eans[0]}"
    elif large_icon:
        image_url = f"https://dispatch.barnesandnoble.com{large_icon}"

    category, tags = _determine_category_and_tags(event)

    # B&N store events are free unless explicitly ticketed
    is_free = True  # most in-store events are free; author signings sometimes have ticket requirement
    price_note: Optional[str] = None

    # Check event description for ticket/cost indicators
    desc_lower = (description or "").lower()
    title_lower = title.lower()
    combined = f"{title_lower} {desc_lower}"
    if "ticket" in combined or "register" in combined or "buy" in combined:
        is_free = None  # unknown — may be free or paid
        price_note = "See event page for registration details"
        if "rsvp-required" not in tags:
            tags.append("rsvp-required")

    is_recurring = event.get("isStoryTime") or bool(_STORYTIME_PATTERNS.search(title))

    venue_name = f"Barnes & Noble {store_info.get('name', '')}"
    content_hash = generate_content_hash(title, venue_name, start_date)

    record = {
        "source_id": source_id,
        "venue_id": venue_id,
        "title": title,
        "description": description,
        "start_date": start_date,
        "start_time": start_time,
        "end_date": None,
        "end_time": None,
        "is_all_day": False,
        "category": category,
        "tags": tags,
        "price_min": None,
        "price_max": None,
        "price_note": price_note,
        "is_free": is_free,
        "source_url": event_url,
        "ticket_url": event_url,
        "image_url": image_url,
        "raw_text": f"{title} {description or ''}".strip()[:500],
        "extraction_confidence": 0.92,  # structured API data
        "is_recurring": bool(is_recurring),
        "recurrence_rule": None,
        "content_hash": content_hash,
    }
    return record


def _fetch_atlanta_data(page) -> tuple[dict[int, dict], list[dict]]:
    """
    Fetch store and event data from the B&N locator API using the browser context.

    Returns (stores_by_id, events_list).
    The page must already be loaded (stores.barnesandnoble.com) so cookies are set.
    """
    # Fetch stores
    stores_raw = page.evaluate(
        f"""
        async () => {{
            const resp = await fetch(
                "https://stores.barnesandnoble.com/locator-api/v1/stores"
                + "?lat={ATL_LAT}&lng={ATL_LNG}&radius={SEARCH_RADIUS_MILES}&pageSize=50"
            );
            if (!resp.ok) return null;
            return await resp.json();
        }}
        """
    )

    if not stores_raw or not isinstance(stores_raw, dict):
        logger.error("Failed to fetch stores from locator API")
        return {}, []

    stores_by_id: dict[int, dict] = {}
    for store in stores_raw.get("content") or []:
        sid = store.get("storeId")
        if sid and sid in ATLANTA_METRO_STORE_IDS and store.get("state") == "GA":
            stores_by_id[sid] = store

    logger.info("Found %d Atlanta metro stores", len(stores_by_id))

    if not stores_by_id:
        logger.warning(
            "No Atlanta metro stores found — check store IDs or API response"
        )
        return {}, []

    # Fetch events (use pageSize=300 to capture multi-month horizon)
    events_raw = page.evaluate(
        f"""
        async () => {{
            const resp = await fetch(
                "https://stores.barnesandnoble.com/locator-api/v1/events"
                + "?lat={ATL_LAT}&lng={ATL_LNG}&radius={SEARCH_RADIUS_MILES}&pageSize=300"
            );
            if (!resp.ok) return null;
            return await resp.json();
        }}
        """
    )

    if not events_raw or not isinstance(events_raw, dict):
        logger.error("Failed to fetch events from locator API")
        return stores_by_id, []

    all_events = events_raw.get("content") or []
    total = events_raw.get("totalElements", 0)
    logger.info(
        "Locator API returned %d events (total reported: %d)",
        len(all_events),
        total,
    )

    # Filter to Atlanta metro stores only
    atlanta_events = [ev for ev in all_events if ev.get("storeId") in stores_by_id]
    logger.info(
        "Atlanta metro events after store filter: %d / %d",
        len(atlanta_events),
        len(all_events),
    )

    return stores_by_id, atlanta_events


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl Barnes & Noble store events across metro Atlanta.

    Uses Playwright (non-headless) to load stores.barnesandnoble.com for
    session establishment, then calls the locator API from the browser context
    to avoid Akamai bot detection on the API requests.

    Returns (events_found, events_new, events_updated).
    """
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0
    seen_hashes: set[str] = set()

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(
                headless=False,
                args=[
                    "--disable-blink-features=AutomationControlled",
                    "--no-sandbox",
                    "--disable-setuid-sandbox",
                ],
            )
            context = browser.new_context(
                user_agent=(
                    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/120.0.0.0 Safari/537.36"
                ),
                viewport={"width": 1920, "height": 1080},
                locale="en-US",
                timezone_id="America/New_York",
            )
            # Override webdriver flag to avoid trivial bot detection
            context.add_init_script(
                "Object.defineProperty(navigator, 'webdriver', { get: () => false });"
            )
            page = context.new_page()

            # Load the store locator homepage to establish session/cookies
            logger.info("Loading B&N store locator for session establishment")
            try:
                page.goto(
                    BASE_URL,
                    wait_until="domcontentloaded",
                    timeout=30000,
                )
                page.wait_for_timeout(2000)
            except Exception as exc:
                logger.warning("Store locator homepage load failed: %s", exc)
                # Continue anyway — the API may still be accessible

            # Fetch stores and events via the locator API
            stores_by_id, atlanta_events = _fetch_atlanta_data(page)

            if not stores_by_id:
                browser.close()
                return 0, 0, 0

            # Cache venue IDs per store to avoid repeated DB lookups
            venue_ids: dict[int, int] = {}
            for store_id, store in stores_by_id.items():
                venue_data = _build_venue_data(store)
                try:
                    vid = get_or_create_venue(venue_data)
                    venue_ids[store_id] = vid
                    logger.debug("Venue ready: %s (id=%s)", venue_data["name"], vid)
                except Exception as exc:
                    logger.warning(
                        "Failed to upsert venue for store %s: %s", store_id, exc
                    )

            # Process each event
            today_str = datetime.now().strftime("%Y-%m-%d")

            for event in atlanta_events:
                store_id = event.get("storeId")
                venue_id = venue_ids.get(store_id)
                if not venue_id:
                    continue

                store_info = stores_by_id.get(store_id, {})

                # Skip past events (API sometimes returns historical ones)
                event_date = event.get("date", "")
                if event_date and event_date < today_str:
                    continue

                record = _parse_event(event, store_info, source_id, venue_id)
                if not record:
                    continue

                content_hash = record["content_hash"]
                if content_hash in seen_hashes:
                    continue
                seen_hashes.add(content_hash)

                events_found += 1

                # Build series hint for recurring storytime events
                series_hint: Optional[dict] = None
                if record.get("is_recurring"):
                    store_name = store_info.get("name", "")
                    series_hint = {
                        "series_type": "recurring_show",
                        "series_title": f"Story Time at Barnes & Noble {store_name}",
                        "frequency": "weekly",
                        "day_of_week": _weekday_name(event.get("weekday", 0)),
                    }

                existing = find_event_by_hash(content_hash)
                if existing:
                    try:
                        smart_update_existing_event(existing, record)
                        events_updated += 1
                    except Exception as exc:
                        logger.warning(
                            "Failed to update event %s: %s", record["title"], exc
                        )
                else:
                    try:
                        insert_event(record, series_hint=series_hint)
                        events_new += 1
                        logger.info(
                            "Added: %s at %s on %s",
                            record["title"],
                            store_info.get("name", "?"),
                            record["start_date"],
                        )
                    except Exception as exc:
                        logger.error(
                            "Failed to insert event %s: %s", record["title"], exc
                        )

            browser.close()

        # Validation gate: B&N Atlanta typically produces 60–200 events
        if events_found < 10:
            logger.warning(
                "Barnes & Noble: only %d events found — expected 60+. "
                "API may have changed or location filtering is broken.",
                events_found,
            )

        logger.info(
            "Barnes & Noble crawl complete: %d found, %d new, %d updated",
            events_found,
            events_new,
            events_updated,
        )

    except Exception as exc:
        logger.error("Barnes & Noble crawl failed: %s", exc)
        raise

    return events_found, events_new, events_updated


def _weekday_name(weekday_num: int) -> str:
    """
    Convert B&N API weekday number to lowercase day name.

    B&N uses: 1=Sunday, 2=Monday, 3=Tuesday, 4=Wednesday, 5=Thursday, 6=Friday, 7=Saturday
    (confirmed from API data: Saturday Story Time has weekday=7, Wednesday Storytime weekday=4)
    """
    mapping = {
        1: "sunday",
        2: "monday",
        3: "tuesday",
        4: "wednesday",
        5: "thursday",
        6: "friday",
        7: "saturday",
    }
    return mapping.get(weekday_num, "")
