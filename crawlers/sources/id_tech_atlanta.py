"""
Crawler for iD Tech Camps at Atlanta-area university campuses.

Official sources:
- https://www.idtech.com/locations/georgia-summer-camps/emory-university
- https://www.idtech.com/locations/georgia-summer-camps/georgia-tech
- https://www.idtech.com/locations/georgia-summer-camps/fulton-science-academy

Pattern role:
iD Tech is the largest tech summer camp operator in the US. They host week-long
and 2-week residential/day programs at university campuses. Each location page
contains JSON-LD Event schema with start/end dates, pricing, and location address.
Ages 7-17, split into day (9-5) and overnight (residential) options.

Courses: coding, game design, robotics, AI, app development, Minecraft modding,
Roblox development, digital filmmaking, graphic design.

Pricing tier (2026):
- Day camp: ~$999-$1,079/week
- Overnight/residential: higher (captured from JSON-LD offers price)

Three Atlanta-metro locations:
1. Emory University — Atlanta, GA 30322 (May 25 – Jul 24)
2. Georgia Institute of Technology — Atlanta, GA 30332 (Jun 1 – Jul 17)
3. Fulton Science Academy — Alpharetta, GA 30022 (Jun 15 – Jul 17)
"""

from __future__ import annotations

import json
import logging
import re
from datetime import date, datetime
from typing import Optional

import requests
from bs4 import BeautifulSoup

from db import (
    find_event_by_hash,
    get_or_create_place,
    insert_event,
    smart_update_existing_event,
)
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://www.idtech.com"
LOCATIONS_URL = f"{BASE_URL}/locations/georgia-summer-camps"

# All three Atlanta-metro iD Tech locations with their detail URLs and static metadata.
# These are verified from the live /locations page (2026-03-23).
LOCATION_CONFIGS = [
    {
        "slug": "emory-university",
        "venue_name": "Emory University",
        "venue_slug": "emory-university",
        "address": "201 Dowman Dr",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30322",
        "lat": 33.7904,
        "lng": -84.3241,
        "neighborhood": "Druid Hills",
        "place_type": "university",
        "spot_type": "education",
        "website": "https://www.emory.edu",
        "vibes": ["educational", "family-friendly", "campus"],
        "camp_type": "day-and-overnight",
    },
    {
        "slug": "georgia-tech",
        "venue_name": "Georgia Institute of Technology",
        "venue_slug": "georgia-institute-of-technology",
        "address": "North Ave NW",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30332",
        "lat": 33.7756,
        "lng": -84.3963,
        "neighborhood": "Midtown",
        "place_type": "university",
        "spot_type": "education",
        "website": "https://www.gatech.edu",
        "vibes": ["educational", "family-friendly", "campus"],
        "camp_type": "day-and-overnight",
    },
    {
        "slug": "fulton-science-academy",
        "venue_name": "Fulton Science Academy Private School",
        "venue_slug": "fulton-science-academy-private-school",
        "address": "3035 Fanfare Way",
        "city": "Alpharetta",
        "state": "GA",
        "zip": "30022",
        "lat": 34.0570,
        "lng": -84.2743,
        "neighborhood": "Alpharetta",
        "place_type": "college",
        "spot_type": "education",
        "website": "https://www.fultonscience.org",
        "vibes": ["educational", "family-friendly", "stem"],
        "camp_type": "day",
    },
]

REQUEST_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/122.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml",
    "Accept-Language": "en-US,en;q=0.9",
}

BASE_TAGS = [
    "kids",
    "family-friendly",
    "camp",
    "stem",
    "technology",
    "coding",
    "rsvp-required",
    "education",
    "summer-camp",
    "tech-camp",
]

# Prices are extracted from JSON-LD; these are 2026 fallbacks if extraction fails.
DAY_CAMP_PRICE_NOTE = (
    "iD Tech day camps start at $1,079/week. Overnight (residential) sessions "
    "start at $4,899 for 2-week academies. Early enrollment discounts available. "
    "Ages 7-17."
)


def _clean_text(value: Optional[str]) -> str:
    if not value:
        return ""
    # Strip embedded HTML tags (some descriptions contain markup)
    text = re.sub(r"<[^>]+>", " ", value)
    return re.sub(r"\s+", " ", text.replace("\xa0", " ")).strip()


def _parse_date(value: str) -> Optional[str]:
    """Parse ISO-like date strings: '2026-07-24', '2026-07-24T12:00:00+00:00'."""
    if not value:
        return None
    value = value.strip()
    # ISO datetime: take date portion only
    iso_match = re.match(r"(\d{4}-\d{2}-\d{2})", value)
    if iso_match:
        return iso_match.group(1)
    return None


def _extract_event_from_ld_graph(graph_data: dict) -> Optional[dict]:
    """Extract event info from a @graph JSON-LD block (Emory pattern)."""
    graph = graph_data.get("@graph", [])
    for item in graph:
        if not isinstance(item, dict):
            continue
        item_type = item.get("@type", "")
        if item_type in ("Event", "EducationEvent"):
            return item
    return None


def _extract_event_from_ld_org(org_data: dict) -> Optional[dict]:
    """Extract event info from an Organization JSON-LD with nested event list (GA Tech pattern)."""
    events = org_data.get("event", [])
    if isinstance(events, list) and events:
        return events[0]
    if isinstance(events, dict):
        return events
    return None


_RUNNING_FROM_RE = re.compile(
    r"Running from\s+"
    r"((?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?)"
    r"\s+\d{1,2})\s*-\s*"
    r"((?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?)"
    r"\s+\d{1,2})",
    re.IGNORECASE,
)
_DATE_TOKEN_RE = re.compile(
    r"(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?)"
    r"\s+(\d{1,2})",
    re.IGNORECASE,
)
_MONTH_MAP = {
    "jan": 1,
    "january": 1,
    "feb": 2,
    "february": 2,
    "mar": 3,
    "march": 3,
    "apr": 4,
    "april": 4,
    "may": 5,
    "jun": 6,
    "june": 6,
    "jul": 7,
    "july": 7,
    "aug": 8,
    "august": 8,
    "sep": 9,
    "september": 9,
    "oct": 10,
    "october": 10,
    "nov": 11,
    "november": 11,
    "dec": 12,
    "december": 12,
}


def _parse_month_day_str(
    month_str: str, day_str: str, year: int = 2026
) -> Optional[str]:
    key = month_str.lower().rstrip(".")
    month_num = _MONTH_MAP.get(key)
    if not month_num:
        return None
    try:
        return datetime(year, month_num, int(day_str)).strftime("%Y-%m-%d")
    except ValueError:
        return None


def _extract_dates_from_html_text(html: str) -> tuple[Optional[str], Optional[str]]:
    """
    Fallback date extraction for pages where JSON-LD is null/absent.
    Looks for 'Running from <Month Day> - <Month Day>' in raw HTML text.
    """
    match = _RUNNING_FROM_RE.search(html)
    if not match:
        return None, None
    tokens_start = list(_DATE_TOKEN_RE.finditer(match.group(1)))
    tokens_end = list(_DATE_TOKEN_RE.finditer(match.group(2)))
    if not tokens_start or not tokens_end:
        return None, None
    start = _parse_month_day_str(tokens_start[0].group(1), tokens_start[0].group(2))
    end = _parse_month_day_str(tokens_end[0].group(1), tokens_end[0].group(2))
    return start, end


def _parse_location_page(
    url: str, location_cfg: dict, session: requests.Session
) -> Optional[dict]:
    """
    Fetch the iD Tech location page and extract the camp event record.

    Returns a dict with event fields, or None if the page could not be parsed
    or the dates are in the past.
    """
    try:
        response = session.get(url, timeout=30)
        response.raise_for_status()
    except Exception as exc:
        logger.error("iD Tech Atlanta: failed to fetch %s: %s", url, exc)
        return None

    html = response.text
    ld_blocks = re.findall(
        r'<script type="application/ld\+json"[^>]*>(.*?)</script>',
        html,
        re.DOTALL,
    )

    start_date: Optional[str] = None
    end_date: Optional[str] = None
    price_value: Optional[float] = None
    description: Optional[str] = None
    event_name: Optional[str] = None
    image_url: Optional[str] = None

    for block in ld_blocks:
        block = block.strip()
        if not block or block == "null":
            continue
        try:
            data = json.loads(block)
        except json.JSONDecodeError:
            continue

        if not isinstance(data, dict):
            continue

        # Try @graph pattern (Emory) — Event node may be in the @graph list
        event_node = _extract_event_from_ld_graph(data)
        # Try Organization.event pattern (GA Tech)
        if not event_node:
            event_node = _extract_event_from_ld_org(data)

        if event_node:
            start_date = start_date or _parse_date(str(event_node.get("startDate", "")))
            end_date = end_date or _parse_date(str(event_node.get("endDate", "")))
            if not description:
                raw_desc = event_node.get("description", "")
                description = _clean_text(raw_desc)[:800] or None
            if not event_name:
                event_name = _clean_text(event_node.get("name", ""))

            # Extract price from offers nested inside event node
            event_offers = event_node.get("offers", {})
            if isinstance(event_offers, dict):
                event_offers = [event_offers]
            for offer in event_offers:
                if isinstance(offer, dict) and offer.get("priceCurrency") == "USD":
                    try:
                        candidate = float(offer["price"])
                        if price_value is None or candidate < price_value:
                            price_value = candidate
                    except (ValueError, KeyError):
                        pass

        # Extract price from offers at top level too
        offers = data.get("offers", [])
        if isinstance(offers, dict):
            offers = [offers]
        for offer in (offers if isinstance(offers, list) else []):
            if isinstance(offer, dict) and offer.get("priceCurrency") == "USD":
                try:
                    candidate = float(offer["price"])
                    if price_value is None or candidate < price_value:
                        price_value = candidate
                except (ValueError, KeyError):
                    pass

    # Fallback for pages where JSON-LD is null (e.g. Fulton Science Academy Vue-rendered page)
    if not start_date or not end_date:
        start_date, end_date = _extract_dates_from_html_text(html)

    # Fallback: try to find og:image for the image
    soup = BeautifulSoup(html, "html.parser")
    og_image = soup.find("meta", property="og:image")
    if og_image and og_image.get("content"):
        image_url = og_image["content"]

    if not start_date or not end_date:
        logger.warning(
            "iD Tech Atlanta: could not extract dates for %s slug=%s",
            url,
            location_cfg["slug"],
        )
        return None

    # Skip if the entire window is in the past
    today = date.today().strftime("%Y-%m-%d")
    if end_date < today:
        return None

    place_data = {
        "name": location_cfg["venue_name"],
        "slug": location_cfg["venue_slug"],
        "address": location_cfg["address"],
        "city": location_cfg["city"],
        "state": location_cfg["state"],
        "zip": location_cfg["zip"],
        "lat": location_cfg["lat"],
        "lng": location_cfg["lng"],
        "neighborhood": location_cfg["neighborhood"],
        "place_type": location_cfg["place_type"],
        "spot_type": location_cfg["spot_type"],
        "website": location_cfg["website"],
        "vibes": location_cfg["vibes"],
    }

    camp_description = description or (
        f"iD Tech Camps at {location_cfg['venue_name']}: week-long STEM summer camps "
        f"for ages 7-17. Courses include coding, game design, robotics, AI, app "
        f"development, and more. Day and overnight options available."
    )
    place_data["description"] = camp_description
    if image_url:
        place_data["image_url"] = image_url

    return {
        "title": f"iD Tech Summer Camp at {location_cfg['venue_name']}",
        "description": camp_description,
        "source_url": url,
        "ticket_url": f"{BASE_URL}/register",
        "start_date": start_date,
        "end_date": end_date,
        "start_time": "09:00",
        "end_time": "17:00",
        "is_all_day": False,
        "age_min": 7,
        "age_max": 17,
        "price_min": price_value,
        "price_max": price_value,
        "price_note": DAY_CAMP_PRICE_NOTE,
        "is_free": False,
        "image_url": image_url,
        "tags": BASE_TAGS,
        "venue_data": place_data,
    }


def _build_event_record(source_id: int, venue_id: int, row: dict) -> dict:
    title = row["title"]
    return {
        "source_id": source_id,
        "place_id": venue_id,
        "title": title,
        "description": row["description"],
        "start_date": row["start_date"],
        "start_time": row["start_time"],
        "end_date": row["end_date"],
        "end_time": row["end_time"],
        "is_all_day": row["is_all_day"],
        "category": "programs",
        "subcategory": "camp",
        "class_category": "technology",
        "tags": row["tags"],
        "price_min": row["price_min"],
        "price_max": row["price_max"],
        "price_note": row["price_note"],
        "is_free": False,
        "source_url": row["source_url"],
        "ticket_url": row["ticket_url"],
        "image_url": row["image_url"],
        "raw_text": f"{title} | {row['description']}",
        "extraction_confidence": 0.92,
        "is_recurring": False,
        "recurrence_rule": None,
        "content_hash": generate_content_hash(
            title,
            row["venue_data"]["name"],
            row["start_date"],
        ),
        "age_min": row["age_min"],
        "age_max": row["age_max"],
    }


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl all three iD Tech Atlanta-metro camp locations.

    One event record per location (the camp season window), not per week —
    because iD Tech sells enrollment by week but the season is a continuous
    rolling window and individual week listings are not publicly structured.
    """
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    session = requests.Session()
    session.headers.update(REQUEST_HEADERS)

    for cfg in LOCATION_CONFIGS:
        url = f"{LOCATIONS_URL}/{cfg['slug']}"
        row = _parse_location_page(url, cfg, session)
        if not row:
            continue

        try:
            venue_id = get_or_create_place(row["venue_data"])
            record = _build_event_record(source_id, venue_id, row)
            events_found += 1

            existing = find_event_by_hash(record["content_hash"])
            if existing:
                smart_update_existing_event(existing, record)
                events_updated += 1
            else:
                insert_event(record)
                events_new += 1

        except Exception as exc:
            logger.error(
                "iD Tech Atlanta: failed to process %s (%s): %s",
                row.get("title"),
                row.get("start_date"),
                exc,
            )

    logger.info(
        "iD Tech Atlanta: crawl complete — %d found, %d new, %d updated",
        events_found,
        events_new,
        events_updated,
    )
    return events_found, events_new, events_updated
