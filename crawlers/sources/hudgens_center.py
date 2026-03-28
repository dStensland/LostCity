"""
Crawler for Hudgens Center for Art & Learning (thehudgens.org).

The Hudgens is a private nonprofit arts center in Duluth/Gwinnett County
serving ages 2-18 and adults with art classes, gallery exhibitions, and
drop-in programs. Programs include:
  - Toddler Friday drop-in art (ages 1-5, every last Friday of the month)
  - Healing Arts for Older Adults (55+, monthly)
  - Family Day hands-on art sessions (all ages)
  - Registered art classes: pottery, painting, drawing, mixed media
  - Summer art camps

The Hudgens manages ticketed public events exclusively through Eventbrite
(organizer ID 11640380248). Their Wix site embeds Eventbrite links rather
than hosting its own event calendar.

Approach: fetch the Eventbrite organizer page via plain requests — the
JSON-LD itemListElement list is embedded in the static HTML, so Playwright
is not needed. For each future event, fetch the detail page for the full
EducationEvent JSON-LD which provides image URL, price offers, and a richer
description.

Rate limiting: one detail page per 0.6 s (polite to Eventbrite).
"""

from __future__ import annotations

import json
import logging
import re
import time
from datetime import datetime, timezone
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

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

ORGANIZER_URL = (
    "https://www.eventbrite.com/o/hudgens-center-for-art-learning-11640380248"
)

_USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/122.0.0.0 Safari/537.36"
)
_HEADERS = {
    "User-Agent": _USER_AGENT,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}

# Polite delay between detail page fetches (seconds)
_DETAIL_DELAY = 0.6

# ---------------------------------------------------------------------------
# Venue data
# ---------------------------------------------------------------------------

PLACE_DATA = {
    "name": "Hudgens Center for Art & Learning",
    "slug": "hudgens-center-for-art-learning",
    "address": "6400 Sugarloaf Pkwy Building 300",
    "neighborhood": "Duluth",
    "city": "Duluth",
    "state": "GA",
    "zip": "30097",
    "lat": 33.9726,
    "lng": -84.1450,
    "venue_type": "arts_center",
    "spot_type": "arts_center",
    "website": "https://www.thehudgens.org",
    "vibes": ["family-friendly", "artsy", "all-ages"],
}

# ---------------------------------------------------------------------------
# Series hint patterns — known recurring Hudgens programs
# ---------------------------------------------------------------------------

_SERIES_PATTERNS: list[tuple[re.Pattern, dict]] = [
    (
        re.compile(r"\btoddler\s+friday\b", re.IGNORECASE),
        {
            "series_type": "recurring_show",
            "series_title": "Toddler Friday",
            "frequency": "monthly",
            "day_of_week": "friday",
        },
    ),
    (
        re.compile(r"\bhealing\s+arts\b", re.IGNORECASE),
        {
            "series_type": "recurring_show",
            "series_title": "Healing Arts for Older Adults",
            "frequency": "monthly",
        },
    ),
    (
        re.compile(r"\bfamily\s+day\b", re.IGNORECASE),
        {
            "series_type": "recurring_show",
            "series_title": "Family Day at The Hudgens",
            "frequency": "irregular",
        },
    ),
    (
        re.compile(r"\bsummer\s+(?:art\s+)?camp\b", re.IGNORECASE),
        {
            "series_type": "class_series",
            "series_title": "Hudgens Summer Art Camp",
            "frequency": "weekly",
        },
    ),
    (
        re.compile(r"\b(class|workshop|lesson)\b", re.IGNORECASE),
        {
            "series_type": "class_series",
            "series_title": None,  # filled in dynamically
            "frequency": "weekly",
        },
    ),
]


def _build_series_hint(title: str) -> Optional[dict]:
    """Return a series_hint dict for known Hudgens recurring programs."""
    for pattern, hint_template in _SERIES_PATTERNS:
        if pattern.search(title):
            hint = dict(hint_template)
            if hint.get("series_title") is None:
                # Generic class/workshop — use cleaned title as series name
                hint["series_title"] = _strip_session_suffix(title)
            return hint
    return None


def _strip_session_suffix(title: str) -> str:
    """Strip session-specific suffixes (month names, AM/PM labels) from titles."""
    t = re.sub(
        r"\s*[-–]\s*(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*.*$",
        "",
        title,
        flags=re.IGNORECASE,
    ).strip()
    t = re.sub(
        r"\s+(?:Morning|Afternoon)\s+Session\s*$", "", t, flags=re.IGNORECASE
    ).strip()
    return t or title


# ---------------------------------------------------------------------------
# Age inference
# ---------------------------------------------------------------------------

_AGE_RANGE_RE = re.compile(r"ages?\s+(\d+)\s*[-–to]+\s*(\d+)", re.IGNORECASE)
_AGE_MIN_RE = re.compile(r"ages?\s+(\d+)\s*(?:\+|and\s+up)", re.IGNORECASE)
_AGE_SINGLE_RE = re.compile(r"ages?\s+(\d+)(?!\s*[-–\d])", re.IGNORECASE)


def _parse_age_range(text: str) -> tuple[Optional[int], Optional[int]]:
    """Extract age_min / age_max from event title/description text."""
    if not text:
        return None, None

    m = _AGE_RANGE_RE.search(text)
    if m:
        return int(m.group(1)), int(m.group(2))

    m = _AGE_MIN_RE.search(text)
    if m:
        return int(m.group(1)), None

    m = _AGE_SINGLE_RE.search(text)
    if m:
        age = int(m.group(1))
        return age, age

    t = text.lower()
    if re.search(r"\btoddler\b", t):
        return 1, 5
    if re.search(r"\b(preschool|pre.?k)\b", t):
        return 3, 5
    if re.search(r"\b(older\s+adults?|55\+|seniors?)\b", t):
        return 55, None

    return None, None


# ---------------------------------------------------------------------------
# Category and tag inference
# ---------------------------------------------------------------------------


def _infer_category_and_tags(
    title: str,
    description: str,
    age_min: Optional[int],
    age_max: Optional[int],
) -> tuple[str, list[str]]:
    """Return (category, tags) for a Hudgens event."""
    text = f"{title} {description}".lower()
    tags: list[str] = ["art", "gwinnett", "educational"]

    if re.search(r"\b(toddler|preschool|pre.?k|family\s+day)\b", text):
        category = "family"
        tags.extend(["family-friendly", "kids", "hands-on", "drop-in"])
    elif re.search(r"\b(older\s+adults?|55\+|seniors?|healing\s+arts)\b", text):
        category = "learning"
        tags.append("adults")
    elif re.search(r"\b(summer\s+)?camp\b", text):
        category = "programs"
        tags.extend(["kids", "family-friendly", "hands-on", "class"])
    elif re.search(
        r"\b(class|workshop|lesson|drawing|painting|pottery|ceramics|watercolor|sculpture)\b",
        text,
    ):
        category = "learning"
        tags.extend(["hands-on", "class"])
    elif re.search(r"\b(exhibit|exhibition|gallery|opening|reception)\b", text):
        category = "art"
    elif re.search(r"\bfamily\b", text):
        category = "family"
        tags.append("family-friendly")
    else:
        category = "family"
        tags.append("family-friendly")

    # Content-specific tags
    if re.search(r"\b(pottery|ceramics|clay|wheel)\b", text) and "hands-on" not in tags:
        tags.append("hands-on")
    if re.search(r"\b(drop.?in)\b", text) and "drop-in" not in tags:
        tags.append("drop-in")

    # Age-band tags
    if age_min is not None:
        if age_min <= 5 and "toddler" not in tags:
            tags.append("toddler")
        if 3 <= (age_min or 0) <= 5 and "preschool" not in tags:
            tags.append("preschool")
    if age_max is not None and age_max <= 12:
        if "kids" not in tags:
            tags.append("kids")
        if "family-friendly" not in tags:
            tags.append("family-friendly")
    if age_min is not None and age_min >= 55:
        if "adults" not in tags:
            tags.append("adults")

    # Deduplicate while preserving order
    seen: set[str] = set()
    deduped: list[str] = []
    for t in tags:
        if t not in seen:
            seen.add(t)
            deduped.append(t)

    return category, deduped


# ---------------------------------------------------------------------------
# Price parsing from schema.org offers
# ---------------------------------------------------------------------------


def _parse_price_from_offers(
    offers,
) -> tuple[Optional[float], Optional[float], bool]:
    """
    Extract (price_min, price_max, is_free) from schema.org offers field.

    Handles AggregateOffer {lowPrice, highPrice} and Offer {price}.
    """
    if not offers:
        return None, None, False

    if isinstance(offers, dict):
        offers = [offers]

    for offer in offers:
        if not isinstance(offer, dict):
            continue

        otype = offer.get("@type", "")
        if otype == "AggregateOffer":
            try:
                lo = float(offer.get("lowPrice") or 0)
                hi = float(offer.get("highPrice") or 0)
                if lo == 0.0 and hi == 0.0:
                    return 0.0, 0.0, True
                return lo, hi, lo == 0.0
            except (TypeError, ValueError):
                pass
        elif otype == "Offer":
            try:
                price = float(offer.get("price") or 0)
                return price, price, price == 0.0
            except (TypeError, ValueError):
                pass

    return None, None, False


# ---------------------------------------------------------------------------
# HTTP helpers
# ---------------------------------------------------------------------------


def _fetch_page(
    session: requests.Session,
    url: str,
    *,
    retries: int = 3,
) -> Optional[str]:
    """GET a URL and return HTML text, or None on failure."""
    for attempt in range(1, retries + 1):
        try:
            resp = session.get(url, headers=_HEADERS, timeout=30)
            if resp.status_code == 404:
                logger.warning("[hudgens] 404: %s", url)
                return None
            resp.raise_for_status()
            return resp.text
        except requests.RequestException as exc:
            if attempt >= retries:
                logger.error(
                    "[hudgens] GET %s failed after %d attempts: %s",
                    url,
                    retries,
                    exc,
                )
                return None
            time.sleep(1.5 * attempt)
    return None


def _extract_jsonld_objects(html: str) -> list[dict]:
    """Return all parsed JSON-LD dicts from an HTML page."""
    objects: list[dict] = []
    soup = BeautifulSoup(html, "html.parser")
    for script in soup.find_all("script", attrs={"type": "application/ld+json"}):
        raw = (script.string or script.get_text() or "").strip()
        if not raw:
            continue
        try:
            payload = json.loads(raw)
        except (json.JSONDecodeError, ValueError):
            continue

        if isinstance(payload, dict):
            if isinstance(payload.get("@graph"), list):
                objects.extend(p for p in payload["@graph"] if isinstance(p, dict))
            else:
                objects.append(payload)
        elif isinstance(payload, list):
            objects.extend(p for p in payload if isinstance(p, dict))

    return objects


# ---------------------------------------------------------------------------
# Organizer page parser
# ---------------------------------------------------------------------------


def _parse_event_list_from_organizer(html: str) -> list[dict]:
    """
    Parse the Eventbrite organizer page JSON-LD for the event listing.

    Returns a list of dicts with keys: name, startDate, endDate, url, description.
    """
    events: list[dict] = []
    seen_urls: set[str] = set()

    for obj in _extract_jsonld_objects(html):
        items = obj.get("itemListElement")
        if not isinstance(items, list):
            continue

        for item in items:
            if not isinstance(item, dict):
                continue

            # ListItem may wrap the Event under "item", or be the Event itself
            ev = item.get("item", item)
            if not isinstance(ev, dict):
                continue

            url = ev.get("url", "")
            if not url or url in seen_urls:
                continue
            seen_urls.add(url)

            name = ev.get("name", "").strip()
            if not name:
                continue

            events.append(
                {
                    "name": name,
                    "startDate": ev.get("startDate", ""),
                    "endDate": ev.get("endDate", ""),
                    "url": url,
                    "description": ev.get("description", ""),
                }
            )

    return events


# ---------------------------------------------------------------------------
# Event detail page parser
# ---------------------------------------------------------------------------


def _parse_event_detail(html: str) -> Optional[dict]:
    """
    Parse an Eventbrite detail page for the EducationEvent/Event JSON-LD.

    Returns a dict with keys: description, image, offers, startDate, endDate.
    Returns None if no suitable JSON-LD is found.
    """
    _EVENT_TYPES = frozenset(
        {"Event", "EducationEvent", "SocialEvent", "MusicEvent", "BusinessEvent"}
    )
    for obj in _extract_jsonld_objects(html):
        if obj.get("@type") not in _EVENT_TYPES:
            continue

        return {
            "description": obj.get("description", ""),
            "image": obj.get("image"),
            "offers": obj.get("offers"),
            "startDate": obj.get("startDate", ""),
            "endDate": obj.get("endDate", ""),
        }

    return None


# ---------------------------------------------------------------------------
# Date/time parsing
# ---------------------------------------------------------------------------


def _parse_iso_datetime(value: str) -> tuple[Optional[str], Optional[str]]:
    """
    Parse an ISO 8601 datetime string into (date_str, time_str).

    Handles: "2026-03-27T10:30:00-04:00", "2026-03-27T10:30:00-0400"
    Returns: ("2026-03-27", "10:30") or (None, None) on failure.
    """
    if not value:
        return None, None

    # Normalise -0400 → -04:00 (Python < 3.11 requires the colon)
    value = re.sub(r"([+-]\d{2})(\d{2})$", r"\1:\2", value.strip())

    for fmt in (
        "%Y-%m-%dT%H:%M:%S%z",
        "%Y-%m-%dT%H:%M%z",
        "%Y-%m-%dT%H:%M:%S",
        "%Y-%m-%dT%H:%M",
    ):
        try:
            dt = datetime.strptime(value, fmt)
            date_str = dt.strftime("%Y-%m-%d")
            time_str = dt.strftime("%H:%M")
            # Suppress midnight — likely an all-day placeholder, not a real start time
            if time_str == "00:00":
                time_str = None
            return date_str, time_str
        except ValueError:
            continue

    # Date-only fallback
    m = re.match(r"(\d{4}-\d{2}-\d{2})", value)
    if m:
        return m.group(1), None

    return None, None


# ---------------------------------------------------------------------------
# Main crawl entry point
# ---------------------------------------------------------------------------


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl Hudgens Center for Art & Learning events from Eventbrite.

    Returns (events_found, events_new, events_updated).
    """
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    # Ensure venue exists in DB
    try:
        venue_id = get_or_create_place(PLACE_DATA)
    except Exception as exc:
        logger.error("[hudgens] Failed to create/find venue: %s", exc)
        return 0, 0, 0

    venue_name = PLACE_DATA["name"]
    today = datetime.now(tz=timezone.utc).date()
    session = requests.Session()

    # Step 1 — fetch organizer page and extract event listing
    logger.info("[hudgens] Fetching organizer page: %s", ORGANIZER_URL)
    org_html = _fetch_page(session, ORGANIZER_URL)
    if not org_html:
        logger.error("[hudgens] Could not fetch organizer page")
        return 0, 0, 0

    raw_events = _parse_event_list_from_organizer(org_html)
    logger.info("[hudgens] %d events in organizer listing", len(raw_events))

    if not raw_events:
        logger.warning(
            "[hudgens] No events found in organizer JSON-LD — "
            "Eventbrite page structure may have changed"
        )
        return 0, 0, 0

    # Step 2 — process each event
    for raw in raw_events:
        title = raw["name"]
        event_url = raw["url"]

        # Quick pre-filter: skip events that are clearly in the past from listing data
        listing_date, _ = _parse_iso_datetime(raw.get("startDate", ""))
        if listing_date:
            try:
                if datetime.strptime(listing_date, "%Y-%m-%d").date() < today:
                    logger.debug(
                        "[hudgens] Skipping past: %s on %s", title, listing_date
                    )
                    continue
            except ValueError:
                pass

        # Fetch detail page for richer data
        logger.debug("[hudgens] Fetching detail: %s", event_url)
        time.sleep(_DETAIL_DELAY)
        detail_html = _fetch_page(session, event_url)

        detail: Optional[dict] = None
        if detail_html:
            detail = _parse_event_detail(detail_html)

        # Start/end dates — prefer detail page (more precise offset-aware datetime)
        if detail and detail.get("startDate"):
            start_date, start_time = _parse_iso_datetime(detail["startDate"])
            end_date, end_time = _parse_iso_datetime(detail.get("endDate") or "")
        else:
            start_date, start_time = _parse_iso_datetime(raw.get("startDate", ""))
            end_date, end_time = _parse_iso_datetime(raw.get("endDate", ""))

        if not start_date:
            logger.warning("[hudgens] Could not parse date for: %s", title)
            continue

        # Re-check with authoritative date
        try:
            if datetime.strptime(start_date, "%Y-%m-%d").date() < today:
                continue
        except ValueError:
            continue

        # Description — prefer detail (fuller), fall back to listing snippet
        description: Optional[str] = None
        if detail and detail.get("description"):
            description = detail["description"].strip() or None
        if not description and raw.get("description"):
            description = raw["description"].strip() or None

        # Image URL from detail JSON-LD
        image_url: Optional[str] = None
        if detail and detail.get("image"):
            img = detail["image"]
            if isinstance(img, str):
                image_url = img
            elif isinstance(img, dict):
                image_url = img.get("url") or img.get("contentUrl")

        # Price from schema.org offers
        price_min: Optional[float] = None
        price_max: Optional[float] = None
        is_free = False
        if detail:
            price_min, price_max, is_free = _parse_price_from_offers(
                detail.get("offers")
            )

        # Age inference from title + description
        combined_text = f"{title} {description or ''}"
        age_min, age_max = _parse_age_range(combined_text)

        # Category and tags
        category, tags = _infer_category_and_tags(
            title, description or "", age_min, age_max
        )

        if is_free and "free" not in tags:
            tags.append("free")

        # Series hint for recurring programs
        series_hint = _build_series_hint(title)
        is_recurring = series_hint is not None

        # Content hash — include start_time to distinguish same-day sessions
        # (Family Day runs Morning Session + Afternoon Session on the same date)
        hash_key = f"{start_date}|{start_time}" if start_time else start_date
        content_hash = generate_content_hash(title, venue_name, hash_key)

        event_record: dict = {
            "source_id": source_id,
            "venue_id": venue_id,
            "title": title,
            "description": description,
            "start_date": start_date,
            "end_date": end_date,
            "start_time": start_time,
            "end_time": end_time,
            "is_all_day": False,
            "category": category,
            "tags": tags,
            "is_free": is_free,
            "price_min": price_min,
            "price_max": price_max,
            "price_note": "Free" if is_free else None,
            "source_url": event_url,
            "ticket_url": event_url,
            "image_url": image_url,
            "raw_text": f"{title} | {description or ''}",
            "extraction_confidence": 0.92,
            "is_recurring": is_recurring,
            "content_hash": content_hash,
        }

        if age_min is not None:
            event_record["age_min"] = age_min
        if age_max is not None:
            event_record["age_max"] = age_max

        events_found += 1

        existing = find_event_by_hash(content_hash)
        if existing:
            smart_update_existing_event(existing, event_record)
            events_updated += 1
            logger.debug("[hudgens] Updated: %s on %s", title, start_date)
        else:
            try:
                insert_event(event_record, series_hint=series_hint)
                events_new += 1
                logger.info("[hudgens] Added: %s on %s", title, start_date)
            except Exception as exc:
                logger.error("[hudgens] Failed to insert %r: %s", title, exc)

    logger.info(
        "[hudgens] Crawl complete: %d found, %d new, %d updated",
        events_found,
        events_new,
        events_updated,
    )
    return events_found, events_new, events_updated
