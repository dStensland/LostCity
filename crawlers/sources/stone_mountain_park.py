"""
Crawler for Stone Mountain Park (stonemountainpark.com).
Located in Stone Mountain, GA (~16 miles east of Atlanta).

Stone Mountain Park is a major family destination operated by Herschend
Family Entertainment. It hosts a small number of large seasonal festivals
per year rather than a high-frequency event calendar:

  - Dino Fest (March–April)
  - Easter Sunrise Service (April)
  - Memorial Day Weekend (May)
  - Summer at the Rock (June–July)
  - Fantastic Fourth Celebration (July 1–6)
  - Labor Day Weekend Celebration (September)
  - Yellow Daisy Festival (September — 400+ artists, SE Tourism Top 20)
  - Pumpkin Festival (September–November, Fri–Sun)
  - Stone Mountain Christmas (November–January, 2M+ lights)
  - Kids' Early New Year's Eve Celebration (December 31)

Data strategy:
  1. Scrape the curated /activities/events/ listing page (div.resultItem.events
     cards). Each card has: title (h3), date text, description excerpt,
     detail-page link, and thumbnail image.
  2. Visit each detail page to get the og:image (higher resolution than the
     listing thumbnail) and og:description (clean summary).
  3. Parse date ranges from listing card text.
  4. Apply structured metadata (category, tags, pricing, open time) per slug.
  5. Emit one event record per festival — NOT per day of operation.

Why NOT the Tribe Events API:
  The site's Tribe Events calendar exposes 900+ recurring instances of daily
  attractions (Summit Skyride, Dinosaur Explore, Scenic Railroad — every open
  day). These are operating hours, not events per our CLAUDE.md definition.
  Paginating 19 pages to extract ~10 real events would be slow and fragile.
  The curated listing page is the correct authoritative source.

Site is WordPress — requests + BeautifulSoup, no Playwright needed.
"""

from __future__ import annotations

import html as html_lib
import logging
import re
import time
from datetime import datetime, timedelta
from typing import Optional

import requests
from bs4 import BeautifulSoup

from db import (
    get_client,
    find_event_by_hash,
    get_or_create_place,
    insert_event,
    smart_update_existing_event,
)
from dedupe import generate_content_hash
from entity_lanes import SourceEntityCapabilities, TypedEntityEnvelope
from entity_persistence import persist_typed_entity_envelope

logger = logging.getLogger(__name__)

SOURCE_ENTITY_CAPABILITIES = SourceEntityCapabilities(
    events=True,
    destinations=True,
    destination_details=True,
    venue_features=True,
)

BASE_URL = "https://stonemountainpark.com"
EVENTS_LISTING_URL = f"{BASE_URL}/activities/events/"
ATTRACTIONS_URL = f"{BASE_URL}/activities/attractions/"

# ── Venue record ──────────────────────────────────────────────────────────────
PLACE_DATA = {
    "name": "Stone Mountain Park",
    "slug": "stone-mountain-park",
    "address": "1000 Robert E. Lee Blvd",
    "neighborhood": "Stone Mountain",
    "city": "Stone Mountain",
    "state": "GA",
    "zip": "30083",
    "lat": 33.8081,
    "lng": -84.1460,
    "place_type": "park",
    "spot_type": "park",
    "website": BASE_URL,
    "vibes": ["family-friendly", "outdoor-seating", "good-for-groups", "free-parking"],
    "description": (
        "Stone Mountain Park is a 3,200-acre natural and historic attraction "
        "16 miles east of Atlanta, featuring the world's largest exposed granite "
        "monadnock, the Summit Skyride, Scenic Railroad, laser shows, and major "
        "seasonal events including the Yellow Daisy Festival, Pumpkin Festival, "
        "and Stone Mountain Christmas."
    ),
    "hours": {
        "monday": {"open": "05:00", "close": "24:00"},
        "tuesday": {"open": "05:00", "close": "24:00"},
        "wednesday": {"open": "05:00", "close": "24:00"},
        "thursday": {"open": "05:00", "close": "24:00"},
        "friday": {"open": "05:00", "close": "24:00"},
        "saturday": {"open": "05:00", "close": "24:00"},
        "sunday": {"open": "05:00", "close": "24:00"},
    },
}


def _build_destination_envelope(venue_id: int) -> TypedEntityEnvelope:
    envelope = TypedEntityEnvelope()
    envelope.add(
        "destination_details",
        {
            "place_id": venue_id,
            "destination_type": "regional_park",
            "commitment_tier": "fullday",
            "primary_activity": "family outdoor destination visit",
            "best_seasons": ["spring", "summer", "fall", "winter"],
            "weather_fit_tags": ["outdoor", "family-daytrip", "weekend-trip"],
            "parking_type": "paid_lot",
            "best_time_of_day": "morning",
            "practical_notes": (
                "Stone Mountain works best as an earlier-start full-day family outing, because the park's "
                "footprint is large and attraction schedules, parking, and festival access vary by season. "
                "Families should treat it as a paced day with rest stops and activity picks, not as a single continuous walk."
            ),
            "accessibility_notes": (
                "The attraction cluster offers the lowest-friction family entry points, while trail and mountain "
                "terrain vary more by route and activity. That makes shade, sit-down breaks, and choosing shorter loops more important here than at compact city destinations."
            ),
            "family_suitability": "yes",
            "reservation_required": False,
            "permit_required": False,
            "fee_note": "Park entry and attractions pricing vary by date and festival; it remains one of metro Atlanta's biggest family day-trip destinations.",
            "source_url": BASE_URL,
            "metadata": {
                "source_type": "family_destination_enrichment",
                "place_type": "park",
                "city": "stone mountain",
            },
        },
    )
    envelope.add(
        "venue_features",
        {
            "place_id": venue_id,
            "slug": "summit-skyride-and-mountain-attractions",
            "title": "Summit Skyride and mountain attractions",
            "feature_type": "attraction",
            "description": "Stone Mountain Park combines its natural landmark with family attractions like the Summit Skyride and other seasonal adventure offerings.",
            "url": ATTRACTIONS_URL,
            "is_free": False,
            "sort_order": 10,
        },
    )
    envelope.add(
        "venue_features",
        {
            "place_id": venue_id,
            "slug": "seasonal-family-festivals-and-holiday-programming",
            "title": "Seasonal family festivals and holiday programming",
            "feature_type": "amenity",
            "description": "Pumpkin Festival, Christmas, Yellow Daisy Festival, and other seasonal events make Stone Mountain a repeat family destination across the year.",
            "url": EVENTS_LISTING_URL,
            "is_free": False,
            "sort_order": 20,
        },
    )
    envelope.add(
        "venue_features",
        {
            "place_id": venue_id,
            "slug": "geyser-splash-pad-and-water-play",
            "title": "Geyser splash pad and water play",
            "feature_type": "amenity",
            "description": "Stone Mountain Park's official attractions page includes Geyser Splash Pad, giving families a real hot-weather water-play stop inside the larger park visit.",
            "url": ATTRACTIONS_URL,
            "price_note": "Splash-pad access follows park attraction schedules and ticketing.",
            "is_free": False,
            "sort_order": 30,
        },
    )
    envelope.add(
        "venue_features",
        {
            "place_id": venue_id,
            "slug": "choose-your-range-with-rest-breaks",
            "title": "Choose your range with rest breaks",
            "feature_type": "amenity",
            "description": "Stone Mountain works best when families choose a few anchor attractions and pace the day around shade, snacks, and rest instead of trying to cover the whole park in one push.",
            "url": BASE_URL,
            "is_free": False,
            "sort_order": 35,
        },
    )
    envelope.add(
        "venue_features",
        {
            "place_id": venue_id,
            "slug": "dinotorium-and-dinosaur-explore",
            "title": "Dinotorium and Dinosaur Explore",
            "feature_type": "attraction",
            "description": "Stone Mountain Park's official family attractions include Dinotorium and Dinosaur Explore, which make the park stronger for kid-focused visits beyond scenic time outdoors.",
            "url": ATTRACTIONS_URL,
            "is_free": False,
            "sort_order": 40,
        },
    )
    envelope.add(
        "venue_features",
        {
            "place_id": venue_id,
            "slug": "scenic-railroad-and-lower-walk-family-loop",
            "title": "Scenic Railroad and lower-walk family loop",
            "feature_type": "experience",
            "description": "Stone Mountain Park's attraction mix includes lower-walk options like the Scenic Railroad, which helps families build a fuller day without relying only on long-distance walking.",
            "url": ATTRACTIONS_URL,
            "is_free": False,
            "sort_order": 50,
        },
    )
    return envelope

# ── Date parsing helpers ──────────────────────────────────────────────────────
# Matches "3/7/2026 — 4/26/2026" or "5/22/2026 — 5/25/2026"
_SLASH_DATE_RANGE_RE = re.compile(
    r"(\d{1,2})/(\d{1,2})/(\d{4})\s*[–—\-]+\s*(\d{1,2})/(\d{1,2})/(\d{4})"
)
# Matches single slash date "4/5/2026" or "12/31/2026"
_SLASH_SINGLE_DATE_RE = re.compile(r"(\d{1,2})/(\d{1,2})/(\d{4})")

# Matches "Nov 7, 2026 – Jan 3, 2027" (sometimes appears on detail pages)
_MONTH_RANGE_RE = re.compile(
    r"(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|"
    r"Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)"
    r"\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(\d{4}))?"
    r"\s*[–—\-]+\s*"
    r"(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|"
    r"Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)"
    r"\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(\d{4}))?",
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
    "sept": 9,
    "september": 9,
    "oct": 10,
    "october": 10,
    "nov": 11,
    "november": 11,
    "dec": 12,
    "december": 12,
}


def _parse_month_abbr(s: str) -> int:
    return _MONTH_MAP.get(s.lower().rstrip("."), 0)


def _resolve_year(month: int, day: int, hint_year: Optional[int] = None) -> int:
    """Return the most likely calendar year for a month/day, biased toward future."""
    today = datetime.now().date()
    year = hint_year if hint_year else today.year
    try:
        candidate = datetime(year, month, day).date()
        # If candidate is more than 60 days in the past, project to next year
        if candidate < today - timedelta(days=60):
            year += 1
    except ValueError:
        pass
    return year


def _to_date_str(month: int, day: int, year: Optional[int] = None) -> Optional[str]:
    if not month or not day:
        return None
    try:
        resolved = _resolve_year(month, day, year)
        return datetime(resolved, month, day).strftime("%Y-%m-%d")
    except ValueError:
        return None


def parse_date_range(text: str) -> tuple[Optional[str], Optional[str]]:
    """
    Parse a date range from card text. Handles:
      - "3/7/2026 — 4/26/2026"
      - "Nov 7, 2026 – Jan 3, 2027"
      - "12/31/2026"  (single date)
    Returns (start_date, end_date) as YYYY-MM-DD strings, or (None, None).
    """
    text = html_lib.unescape(text)

    # Try M/D/YYYY — M/D/YYYY range first
    m = _SLASH_DATE_RANGE_RE.search(text)
    if m:
        start = _to_date_str(int(m.group(1)), int(m.group(2)), int(m.group(3)))
        end = _to_date_str(int(m.group(4)), int(m.group(5)), int(m.group(6)))
        return start, end

    # Try "Month D, YYYY – Month D, YYYY"
    m = _MONTH_RANGE_RE.search(text)
    if m:
        sm = _parse_month_abbr(m.group(1))
        sd = int(m.group(2))
        sy = int(m.group(3)) if m.group(3) else None
        em = _parse_month_abbr(m.group(4))
        ed = int(m.group(5))
        ey = int(m.group(6)) if m.group(6) else None
        start = _to_date_str(sm, sd, sy)
        end = _to_date_str(em, ed, ey)
        return start, end

    # Try single M/D/YYYY
    m = _SLASH_SINGLE_DATE_RE.search(text)
    if m:
        d = _to_date_str(int(m.group(1)), int(m.group(2)), int(m.group(3)))
        return d, d

    return None, None


# ── Per-festival structured metadata ─────────────────────────────────────────
# Keyed by the URL slug from /activity/events/<slug>/.
# Applied over the parsed card data to provide correct category, tags, and
# pricing. Pricing reflects the Attractions Ticket admission tier (adult).
_FESTIVAL_META: dict[str, dict] = {
    "dino-fest": {
        "category": "family",
        "tags": [
            "seasonal",
            "family-friendly",
            "outdoor",
            "all-ages",
            "ticketed",
            "kids",
        ],
        "price_note": "Included with Attractions Ticket or Mountain Membership",
        "is_free": False,
        "price_min": 34.99,
        "price_max": 44.99,
        "ticket_url": f"{BASE_URL}/tickets/",
        "open_time": "10:00",
    },
    "easter-sunrise-service": {
        "category": "community",
        "tags": [
            "seasonal",
            "family-friendly",
            "outdoor",
            "all-ages",
            "holiday",
            "morning",
        ],
        "price_note": "Free sunrise service; Attractions Ticket required for park attractions",
        "is_free": False,
        "price_min": 0.0,
        "price_max": 0.0,
        "ticket_url": f"{BASE_URL}/activity/events/easter-sunrise-service/",
        "open_time": "06:00",
    },
    "memorial-day-weekend": {
        "category": "family",
        "tags": [
            "seasonal",
            "family-friendly",
            "outdoor",
            "all-ages",
            "ticketed",
            "holiday",
        ],
        "price_note": "Included with Attractions Ticket; active duty/veterans FREE with ID",
        "is_free": False,
        "price_min": 34.99,
        "price_max": 44.99,
        "ticket_url": f"{BASE_URL}/tickets/",
        "open_time": "10:30",
    },
    "fantastic-fourth-celebration": {
        "category": "family",
        "tags": [
            "seasonal",
            "family-friendly",
            "outdoor",
            "all-ages",
            "ticketed",
            "holiday",
        ],
        "price_note": "Attractions Ticket required; Drone & Light Show + fireworks included",
        "is_free": False,
        "price_min": 34.99,
        "price_max": 44.99,
        "ticket_url": f"{BASE_URL}/tickets/",
        "open_time": "10:30",
    },
    "summer-at-the-rock": {
        "category": "family",
        "tags": ["seasonal", "family-friendly", "outdoor", "all-ages", "ticketed"],
        "price_note": "Included with Attractions Ticket or Mountain Membership",
        "is_free": False,
        "price_min": 34.99,
        "price_max": 44.99,
        "ticket_url": f"{BASE_URL}/tickets/",
        "open_time": "10:00",
    },
    "labor-day-weekend-celebration": {
        "category": "family",
        "tags": [
            "seasonal",
            "family-friendly",
            "outdoor",
            "all-ages",
            "ticketed",
            "holiday",
        ],
        "price_note": "FREE Classic Lasershow engagement; Attractions Ticket for full access",
        "is_free": False,
        "price_min": 0.0,
        "price_max": 44.99,
        "ticket_url": f"{BASE_URL}/tickets/",
        "open_time": "10:00",
    },
    "yellow-daisy-festival": {
        "category": "markets",
        "tags": [
            "seasonal",
            "family-friendly",
            "outdoor",
            "all-ages",
            "ticketed",
            "market",
        ],
        "price_note": "Separate festival admission required; 400+ artists and crafters",
        "is_free": False,
        "price_min": 10.00,
        "price_max": 20.00,
        "ticket_url": f"{BASE_URL}/activity/events/yellow-daisy-festival/",
        "open_time": "09:00",
    },
    "pumpkin-festival": {
        "category": "family",
        "tags": [
            "seasonal",
            "family-friendly",
            "outdoor",
            "all-ages",
            "ticketed",
            "holiday",
            "kids",
        ],
        "price_note": "Included with Attractions Ticket or Mountain Membership (Fri–Sun)",
        "is_free": False,
        "price_min": 34.99,
        "price_max": 44.99,
        "ticket_url": f"{BASE_URL}/tickets/",
        "open_time": "14:00",
    },
    "stone-mountain-christmas": {
        "category": "family",
        "tags": [
            "seasonal",
            "family-friendly",
            "outdoor",
            "all-ages",
            "ticketed",
            "holiday",
            "kids",
        ],
        "price_note": "Stone Mountain Christmas Ticket required; 2M+ lights",
        "is_free": False,
        "price_min": 34.99,
        "price_max": 44.99,
        "ticket_url": f"{BASE_URL}/tickets/",
        "open_time": "14:00",
    },
    "kids-early-new-years-eve-celebration": {
        "category": "family",
        "tags": [
            "seasonal",
            "family-friendly",
            "outdoor",
            "all-ages",
            "ticketed",
            "holiday",
            "kids",
        ],
        "price_note": "Stone Mountain Christmas Ticket required; countdown at 9 PM",
        "is_free": False,
        "price_min": 34.99,
        "price_max": 44.99,
        "ticket_url": f"{BASE_URL}/tickets/",
        "open_time": "12:00",
    },
}

# Default metadata for any event slug not in the table above
_DEFAULT_META = {
    "category": "family",
    "tags": ["seasonal", "family-friendly", "outdoor", "all-ages", "ticketed"],
    "price_note": "Attractions Ticket required",
    "is_free": False,
    "price_min": 34.99,
    "price_max": 44.99,
    "ticket_url": f"{BASE_URL}/tickets/",
    "open_time": "10:00",
}


def _slug_from_url(url: str) -> str:
    """Extract the last path segment slug from a detail URL."""
    return url.rstrip("/").split("/")[-1]


def _fetch_detail_page(
    session: requests.Session, url: str
) -> tuple[Optional[str], Optional[str]]:
    """
    Fetch a festival detail page and return (og_image_url, description_text).
    og:image is higher resolution than the listing thumbnail.
    Best-effort — returns (None, None) on any failure.
    """
    try:
        resp = session.get(url, timeout=20)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "html.parser")

        # og:image is higher res than listing thumbnail
        og_image = soup.find("meta", property="og:image")
        image_url = og_image.get("content") if og_image else None

        # og:description for clean excerpt
        og_desc = soup.find("meta", property="og:description")
        description: Optional[str] = (
            og_desc.get("content", "").strip() if og_desc else None
        )
        if description:
            description = html_lib.unescape(description)

        # Fallback: pull first substantial paragraph from page content
        if not description:
            for tag in soup(["script", "style", "nav", "header", "footer"]):
                tag.decompose()
            main = soup.find("main") or soup.find("body")
            if main:
                for p in main.find_all("p"):
                    txt = p.get_text(strip=True)
                    if len(txt) > 80:
                        description = html_lib.unescape(txt)
                        break

        return image_url, description

    except Exception as e:
        logger.debug(f"Stone Mountain Park: could not fetch detail page {url}: {e}")
        return None, None


def _parse_card(card: BeautifulSoup) -> Optional[dict]:
    """
    Parse a div.resultItem.events card into a raw event dict.
    Returns None if essential fields (title, dates, URL) can't be extracted.
    """
    # Title from h3
    h3 = card.find("h3")
    if not h3:
        return None
    title = html_lib.unescape(h3.get_text(strip=True))
    if not title:
        return None

    # Detail-page URL — first anchor leading to /activity/events/
    detail_url: Optional[str] = None
    for a in card.find_all("a", href=True):
        href = a["href"]
        if "/activity/events/" in href:
            detail_url = href
            break
    if not detail_url:
        return None

    # Image: first img — check src first (eager), then data-src (lazy-loaded)
    img = card.find("img")
    image_url: Optional[str] = None
    if img:
        image_url = img.get("src") or img.get("data-src")

    # Date text: inside the calendar-check icon's parent div
    date_text = ""
    cal_span = card.find("span", class_=lambda c: c and "fa-calendar" in c)
    if cal_span and cal_span.parent:
        date_text = cal_span.parent.get_text(separator=" ", strip=True)
    if not date_text:
        # Broad fallback: search full card text
        date_text = card.get_text(separator=" ")

    start_date, end_date = parse_date_range(date_text)
    if not start_date:
        logger.debug(
            f"Stone Mountain Park: no date parsed for '{title}' from '{date_text[:100]}'"
        )
        return None

    # Description excerpt from first <p> with meaningful content
    description: Optional[str] = None
    for p in card.find_all("p"):
        txt = p.get_text(strip=True)
        if len(txt) > 40:
            description = html_lib.unescape(txt)
            break

    # Location sub-area (e.g., "Crossroads")
    location_note = ""
    map_span = card.find("span", class_=lambda c: c and "fa-map" in c)
    if map_span and map_span.parent:
        location_note = map_span.parent.get_text(separator=" ", strip=True)

    return {
        "title": title,
        "detail_url": detail_url,
        "slug": _slug_from_url(detail_url),
        "start_date": start_date,
        "end_date": end_date,
        "description": description,
        "image_url": image_url,
        "location_note": location_note,
    }


def _build_event_record(
    raw: dict,
    source_id: int,
    venue_id: int,
    detail_image: Optional[str],
    detail_description: Optional[str],
) -> dict:
    """
    Assemble the final event record from parsed card data + detail page enrichment.
    """
    slug = raw["slug"]
    meta = _FESTIVAL_META.get(slug, _DEFAULT_META)

    title = raw["title"]
    start_date = raw["start_date"]

    # end_date: set to None if same as start (single-day event)
    end_date: Optional[str] = (
        raw["end_date"] if raw["end_date"] and raw["end_date"] != start_date else None
    )

    # Image: prefer detail-page og:image (higher resolution)
    image_url = detail_image or raw.get("image_url")

    # Description: prefer detail-page og:description (cleaner, editor-controlled)
    description = detail_description or raw.get("description")
    if description:
        description = description[:1500]
        # Append location note if it adds context
        location_note = raw.get("location_note", "")
        if location_note and location_note not in description:
            description = f"{description}\n\nLocation: {location_note}"

    content_hash = generate_content_hash(title, "Stone Mountain Park", start_date)

    return {
        "source_id": source_id,
        "place_id": venue_id,
        "title": title,
        "description": description,
        "start_date": start_date,
        "start_time": meta["open_time"],
        "end_date": end_date,
        "end_time": None,
        "is_all_day": False,
        "category": meta["category"],
        "subcategory": None,
        "tags": meta["tags"],
        "price_min": meta.get("price_min"),
        "price_max": meta.get("price_max"),
        "price_note": meta.get("price_note"),
        "is_free": meta.get("is_free", False),
        "source_url": raw["detail_url"],
        "ticket_url": meta.get("ticket_url", raw["detail_url"]),
        "image_url": image_url,
        "raw_text": f"{title} {start_date}",
        "extraction_confidence": 0.92,
        "is_recurring": False,
        "recurrence_rule": None,
        "content_hash": content_hash,
    }


def scrape_events(
    session: requests.Session,
    source_id: int,
    venue_id: int,
) -> tuple[int, int, int]:
    """
    Scrape the /activities/events/ listing page and enrich from detail pages.
    Returns (found, new, updated).
    """
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        resp = session.get(EVENTS_LISTING_URL, timeout=30)
        resp.raise_for_status()
    except requests.RequestException as e:
        logger.error(f"Stone Mountain Park: could not fetch listing page: {e}")
        return 0, 0, 0

    soup = BeautifulSoup(resp.text, "html.parser")
    cards = soup.find_all(
        "div",
        class_=lambda c: c and "resultItem" in c and "events" in c,
    )

    if not cards:
        logger.warning(
            "Stone Mountain Park: no event cards found on listing page — "
            "site structure may have changed (expected div.resultItem.events)"
        )
        return 0, 0, 0

    logger.info(
        f"Stone Mountain Park: found {len(cards)} festival cards on listing page"
    )

    today = datetime.now().date()

    for card in cards:
        try:
            raw = _parse_card(card)
            if not raw:
                continue

            # Skip events whose end (or start for single-day) is >60 days past
            check_str = raw.get("end_date") or raw.get("start_date")
            if check_str:
                try:
                    check_dt = datetime.strptime(check_str, "%Y-%m-%d").date()
                    if check_dt < today - timedelta(days=60):
                        logger.debug(
                            f"Stone Mountain Park: skipping past event '{raw['title']}' "
                            f"({check_str})"
                        )
                        continue
                except ValueError:
                    pass

            # Fetch detail page — small delay to be a polite guest
            time.sleep(0.5)
            detail_image, detail_description = _fetch_detail_page(
                session, raw["detail_url"]
            )

            event_record = _build_event_record(
                raw, source_id, venue_id, detail_image, detail_description
            )

            events_found += 1
            existing = find_event_by_hash(event_record["content_hash"])

            if existing:
                smart_update_existing_event(existing, event_record)
                events_updated += 1
                logger.debug(
                    f"Stone Mountain Park: updated '{event_record['title']}' "
                    f"({event_record['start_date']})"
                )
            else:
                try:
                    insert_event(event_record)
                    events_new += 1
                    end_note = (
                        f" – {event_record['end_date']}"
                        if event_record.get("end_date")
                        else ""
                    )
                    logger.info(
                        f"Stone Mountain Park: added '{event_record['title']}' "
                        f"({event_record['start_date']}{end_note})"
                    )
                except Exception as e:
                    logger.error(
                        f"Stone Mountain Park: failed to insert "
                        f"'{event_record['title']}': {e}"
                    )

        except Exception as e:
            logger.warning(f"Stone Mountain Park: error processing card: {e}")
            continue

    return events_found, events_new, events_updated


# ── Entry point ───────────────────────────────────────────────────────────────


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl Stone Mountain Park seasonal festivals and special events.

    Scrapes the curated /activities/events/ listing page (10–12 events/year)
    and enriches each with detail-page og:image and og:description.

    Intentionally does NOT use the Tribe Events REST API, which exposes 900+
    daily attraction-hours instances (Summit Skyride, Dinosaur Explore, etc.).
    Those are operating hours, not programmed events.

    Stone Mountain Park is a high-impact source:
    - Yellow Daisy Festival: 60,000+ visitors, Southeast Tourism Top 20
    - Stone Mountain Christmas: 2M+ lights, Atlanta's signature holiday event
    - Pumpkin Festival: one of Atlanta's top fall family destinations
    - Fantastic Fourth: AJC-voted best fireworks in Atlanta
    """
    source_id = source["id"]

    session = requests.Session()
    session.headers.update(
        {
            "User-Agent": (
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/121.0.0.0 Safari/537.36"
            ),
            "Accept-Language": "en-US,en;q=0.9",
        }
    )

    try:
        venue_id = get_or_create_place(PLACE_DATA)
        persist_typed_entity_envelope(_build_destination_envelope(venue_id))
    except Exception as e:
        logger.error(f"Stone Mountain Park: could not get/create venue: {e}")
        raise

    # Enrich venue with og:image from the homepage
    try:
        resp = session.get(BASE_URL, timeout=15)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "html.parser")
        og_img = soup.find("meta", property="og:image")
        if og_img and og_img.get("content"):
            get_client().table("places").update(
                {"image_url": og_img["content"].strip()}
            ).eq("id", venue_id).execute()
            logger.debug("Stone Mountain Park: updated venue image from og:image")
    except Exception as enrich_exc:
        logger.warning(f"Stone Mountain Park: og:image enrichment failed: {enrich_exc}")

    try:
        events_found, events_new, events_updated = scrape_events(
            session, source_id, venue_id
        )
    except Exception as e:
        logger.error(f"Stone Mountain Park: crawl failed: {e}")
        raise

    # Sanity check — always expect ≥5 events (partial year minimum)
    if events_found < 3:
        logger.warning(
            f"Stone Mountain Park: only {events_found} events found — "
            "expected 8+. Listing page structure may have changed."
        )

    logger.info(
        f"Stone Mountain Park crawl complete: {events_found} found, "
        f"{events_new} new, {events_updated} updated"
    )

    return events_found, events_new, events_updated
