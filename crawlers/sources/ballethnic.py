"""
Crawler for Ballethnic Dance Company (ballethnic.org).
Professional Afrocentric ballet company and academy in East Point, GA.
Known for Urban Nutcracker and Afrocentric ballet productions.

Site: WordPress with The Events Calendar plugin.
Uses the TEC REST API to fetch events.

Categories of interest:
  - productions (id=105): Full company performances — the primary target
  - comm-event (id=125): Community events including open classes and series

Strategy:
  - Pull productions category for main performances (3-4/season)
  - Pull open classes (Afro-Haitian Dance Series, Open Modern) as series
  - Skip internal class schedule events (level classes, BYE days, rehearsals)
  - Group recurring open classes as series to avoid feed spam
"""

from __future__ import annotations

import logging
import re
import time
from datetime import datetime
from typing import Optional

import requests

from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://ballethnic.org"
API_BASE = f"{BASE_URL}/wp-json/tribe/events/v1"

# Category IDs from the TEC API
CATEGORY_PRODUCTIONS = 105   # Full company performances
CATEGORY_COMM_EVENT = 125    # Community events (open classes appear here)
CATEGORY_OPEN_CLASSES = 112  # Open classes
CATEGORY_SPECIAL_CLASSES = 124  # Special one-off classes

# Category slugs to SKIP — internal scheduling, not public discovery events
SKIP_CATEGORY_SLUGS = {
    "bad-jazz-l-iv",
    "bye",
    "level-iv-and-kiddie",
    "level-iv-and-v",
    "levels-a",
    "levels-ii-and-iii-beginner-intermediate",
    "a-b-and-i",
    "parent-and-me",
    "rehearsals",
    "young-mens-class",
}

# Event title patterns that indicate internal/class scheduling — skip these
SKIP_TITLE_PATTERNS = [
    r"^Level\s+(I|II|III|IV|V|A|B)",
    r"^BAD\s+Jazz",
    r"^Young\s+Men",
    r"^Parent\s+and\s+Me",
    r"^Production\s+Rehearsal",
    r"^BYE\s*[-–]",
    r"^\s*BYE\s*$",
]

# Titles that are recurring open classes — group as series
RECURRING_SERIES_TITLES = {
    "Afro-Haitian Dance Series",
    "Open Modern",
}

# Home venue — the company's East Point studio
VENUE_DATA = {
    "name": "Ballethnic Dance Studio",
    "slug": "ballethnic-dance-studio",
    "address": "2587 Ballethnic Way",
    "neighborhood": "East Point",
    "city": "East Point",
    "state": "GA",
    "zip": "30344",
    "lat": 33.6757,
    "lng": -84.4447,
    "venue_type": "dance_studio",
    "spot_type": "theater",
    "website": BASE_URL,
    "vibes": ["all-ages", "family-friendly", "black-owned"],
}


def _parse_price(cost_str: str) -> tuple[Optional[float], Optional[float], Optional[str], bool]:
    """
    Parse a cost string from the TEC API into (price_min, price_max, price_note, is_free).
    Examples: "$30", "$20.00", "$75.00 - $154.00", "Free", ""
    """
    if not cost_str:
        return None, None, None, False

    cleaned = cost_str.strip()
    if not cleaned:
        return None, None, None, False

    lower = cleaned.lower()
    if lower in ("free", "0", "$0", "$0.00"):
        return 0.0, 0.0, "Free", True

    # Extract numeric values
    nums = re.findall(r"[\d,]+(?:\.\d+)?", cleaned.replace(",", ""))
    if not nums:
        return None, None, cleaned, False

    try:
        values = [float(n) for n in nums]
        price_min = min(values)
        price_max = max(values)
        return price_min, price_max, cleaned if len(values) > 1 else None, False
    except (ValueError, TypeError):
        return None, None, cleaned, False


def _build_venue_data_from_api(api_venue: dict) -> dict:
    """Convert a TEC API venue object into our VENUE_DATA dict format."""
    name = api_venue.get("venue", "")
    address = api_venue.get("address", "")
    city = api_venue.get("city", "")
    state = api_venue.get("stateprovince") or api_venue.get("state", "")
    zip_code = api_venue.get("zip", "")
    website = api_venue.get("website", BASE_URL)

    # Generate slug from name
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    slug = re.sub(r"-+", "-", slug)

    # Guess venue type from name
    name_lower = name.lower()
    if any(w in name_lower for w in ["theatre", "theater"]):
        venue_type = "theater"
        spot_type = "theater"
    elif "center" in name_lower or "centre" in name_lower:
        venue_type = "arts_center"
        spot_type = "theater"
    elif "studio" in name_lower:
        venue_type = "dance_studio"
        spot_type = "theater"
    else:
        venue_type = "venue"
        spot_type = "theater"

    return {
        "name": name,
        "slug": slug,
        "address": address,
        "city": city,
        "state": state,
        "zip": zip_code,
        "lat": None,
        "lng": None,
        "venue_type": venue_type,
        "spot_type": spot_type,
        "website": website,
        "vibes": ["all-ages", "family-friendly"],
    }


def _should_skip_event(event: dict) -> bool:
    """Return True if this event should be excluded (internal class schedule, etc.)."""
    title = event.get("title", "")
    category_slugs = {c["slug"] for c in event.get("categories", [])}

    # Skip if any category is in our skip list
    if category_slugs & SKIP_CATEGORY_SLUGS:
        return True

    # Skip if title matches internal schedule patterns
    for pattern in SKIP_TITLE_PATTERNS:
        if re.search(pattern, title, re.IGNORECASE):
            return True

    return False


def _fetch_events_page(
    session: requests.Session,
    page: int = 1,
    per_page: int = 50,
    start_date: str = "",
) -> dict:
    """Fetch one page of events from the TEC REST API."""
    params = {
        "per_page": per_page,
        "page": page,
        "status": "publish",
    }
    if start_date:
        params["start_date"] = start_date

    url = f"{API_BASE}/events"
    resp = session.get(url, params=params, timeout=20)
    resp.raise_for_status()
    return resp.json()


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Ballethnic Dance Company events via WordPress TEC REST API."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    today_str = datetime.now().strftime("%Y-%m-%d")

    session = requests.Session()
    session.headers.update(
        {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"}
    )

    # Create or update home venue record
    home_venue_id = get_or_create_venue(VENUE_DATA)

    # Fetch all upcoming events, paginating if needed
    all_api_events: list[dict] = []
    page = 1
    while True:
        try:
            data = _fetch_events_page(session, page=page, per_page=50, start_date=today_str)
        except Exception as e:
            logger.error(f"Ballethnic: failed to fetch page {page}: {e}")
            break

        page_events = data.get("events", [])
        all_api_events.extend(page_events)

        total_pages = data.get("total_pages", 1)
        logger.debug(f"Ballethnic: fetched page {page}/{total_pages}, got {len(page_events)} events")

        if page >= total_pages:
            break
        page += 1
        time.sleep(0.5)

    logger.info(f"Ballethnic: {len(all_api_events)} total upcoming events from API")

    # Process each event
    for api_event in all_api_events:
        title = api_event.get("title", "").strip()
        # Decode HTML entities in title
        title = title.replace("&#038;", "&").replace("&amp;", "&").replace("&#8211;", "–")

        if not title:
            continue

        if _should_skip_event(api_event):
            logger.debug(f"Ballethnic: skipping internal event: {title}")
            continue

        # Parse dates/times
        start_dt_str = api_event.get("start_date", "")  # "2026-03-27 19:00:00"
        if not start_dt_str:
            continue

        try:
            start_dt = datetime.strptime(start_dt_str, "%Y-%m-%d %H:%M:%S")
        except ValueError:
            logger.debug(f"Ballethnic: bad date format for {title}: {start_dt_str}")
            continue

        start_date = start_dt.strftime("%Y-%m-%d")
        start_time = start_dt.strftime("%H:%M") if start_dt.hour or start_dt.minute else None

        end_dt_str = api_event.get("end_date", "")
        end_date = None
        end_time = None
        if end_dt_str:
            try:
                end_dt = datetime.strptime(end_dt_str, "%Y-%m-%d %H:%M:%S")
                end_date = end_dt.strftime("%Y-%m-%d") if end_dt.date() != start_dt.date() else None
                end_time = end_dt.strftime("%H:%M") if end_dt.hour or end_dt.minute else None
            except ValueError:
                pass

        # Determine venue
        api_venue = api_event.get("venue")
        if api_venue and isinstance(api_venue, dict) and api_venue.get("venue"):
            venue_name = api_venue["venue"].replace("&#038;", "&").replace("&amp;", "&")
            # Check if it's the home studio
            if "ballethnic" in venue_name.lower() or api_venue.get("address", "") == "2587 Ballethnic Way":
                venue_id = home_venue_id
                venue_name = "Ballethnic Dance Studio"
            else:
                venue_data = _build_venue_data_from_api(api_venue)
                venue_id = get_or_create_venue(venue_data)
        else:
            venue_id = home_venue_id
            venue_name = "Ballethnic Dance Studio"

        # Source URL and ticket URL
        source_url = api_event.get("url", BASE_URL)
        # Check for an external website link
        event_website = api_event.get("website", "")
        ticket_url = event_website if event_website and event_website != BASE_URL else source_url

        # Image URL
        image = api_event.get("image")
        image_url = None
        if image and isinstance(image, dict):
            image_url = image.get("url")

        # Price
        cost_str = api_event.get("cost", "")
        price_min, price_max, price_note, is_free = _parse_price(cost_str)

        # Description — strip HTML tags from the API description
        raw_description = api_event.get("description", "") or api_event.get("excerpt", "") or ""
        description = re.sub(r"<[^>]+>", " ", raw_description).strip()
        description = re.sub(r"\s+", " ", description)[:600] if description else None

        # Build tags
        category_slugs = [c["slug"] for c in api_event.get("categories", [])]
        tags = ["ballethnic", "dance", "afrocentric", "performing-arts"]
        if "productions" in category_slugs:
            tags.append("ballet")
        if "open-classes" in category_slugs or "special-classes" in category_slugs:
            tags.append("open-class")
        if "Afro-Haitian" in title:
            tags.extend(["afro-haitian", "world-dance"])
        if "Modern" in title:
            tags.append("modern-dance")

        # Determine if this is a recurring open class that should be grouped as series
        is_recurring = False
        series_hint = None
        clean_title = title.strip()
        for series_name in RECURRING_SERIES_TITLES:
            if series_name.lower() in clean_title.lower():
                is_recurring = True
                series_hint = {
                    "series_type": "recurring_show",
                    "series_title": series_name,
                    "frequency": "weekly",
                }
                break

        # Multi-day camp events — group as series
        camp_match = re.match(r"^(BAD Cultural Arts Camp|Kiddie Camp)\s+(\d{4})$", clean_title)
        if camp_match:
            is_recurring = True
            series_hint = {
                "series_type": "recurring_show",
                "series_title": camp_match.group(1),
                "frequency": "daily",
            }

        # Determine subcategory
        if "productions" in category_slugs:
            subcategory = "ballet"
        elif "Afro-Haitian" in title or "Modern" in title:
            subcategory = "dance"
        else:
            subcategory = "dance"

        events_found += 1
        content_hash = generate_content_hash(title, venue_name, start_date)

        event_record = {
            "source_id": source_id,
            "venue_id": venue_id,
            "title": title,
            "description": description,
            "start_date": start_date,
            "start_time": start_time,
            "end_date": end_date,
            "end_time": end_time,
            "is_all_day": api_event.get("all_day", False),
            "category": "theater",
            "subcategory": subcategory,
            "tags": tags,
            "price_min": price_min,
            "price_max": price_max,
            "price_note": price_note,
            "is_free": is_free,
            "source_url": source_url,
            "ticket_url": ticket_url,
            "image_url": image_url,
            "raw_text": f"{title} — {start_date}",
            "extraction_confidence": 0.92,
            "is_recurring": is_recurring,
            "recurrence_rule": None,
            "content_hash": content_hash,
        }

        existing = find_event_by_hash(content_hash)
        if existing:
            smart_update_existing_event(existing, event_record)
            events_updated += 1
            continue

        try:
            insert_event(event_record, series_hint=series_hint)
            events_new += 1
            logger.info(f"Ballethnic: added '{title}' on {start_date} at {venue_name}")
        except Exception as e:
            logger.error(f"Ballethnic: failed to insert '{title}' on {start_date}: {e}")

    logger.info(
        f"Ballethnic crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
    )
    return events_found, events_new, events_updated
