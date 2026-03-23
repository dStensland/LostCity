"""
Crawler for Hands On Atlanta volunteer opportunities.
https://volunteer.handsonatlanta.org

Uses the Golden Volunteer API (api2.goldenvolunteer.com).
The API key is a public read-only key embedded in the platform's React bundle.
No login required; all public opportunities are exposed.

Strategy:
  1. Fetch the full opportunity listing (paginated, ~298 active opps).
  2. For each opportunity with upcoming timeslots, fetch the detail endpoint
     to get the full `times` array.
  3. Filter to future timeslots within the next 30 days (avoids feed spam).
  4. One DB event per timeslot. Group same opportunity + venue into a series
     so the feed shows one card with "See all dates" instead of 20+ rows.

Timeslot field notes:
  - `startTime` / `endTime` are UTC ISO strings.
  - `start` / `end` appear to be America/New_York-localized ISO strings.
  - We parse `start` directly and apply the opportunity's `timezoneId`
    to produce correct local display times.
  - `isCancelled`: skip these.
"""

from __future__ import annotations

import html
import re
import time
import logging
from datetime import date, datetime, timedelta
from typing import Optional

import requests

from db import (
    get_or_create_venue,
    insert_event,
    find_event_by_hash,
    prefetch_events_by_source,
    smart_update_existing_event,
)
from dedupe import generate_content_hash
from utils import slugify

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# API configuration
# ---------------------------------------------------------------------------
API_BASE = "https://api2.goldenvolunteer.com/v1"

# Public read-only key embedded in the Golden Volunteer React bundle for HOA.
# This is equivalent to a public API key — it's shipped to every browser that
# loads volunteer.handsonatlanta.org. Rotate this in config if HOA updates it.
GOLDEN_API_KEY = "WSCp_r4FUJjgMbaL9Rw5PEE5fA2G6oZ6MxajomkM"

HOA_BASE_URL = "https://volunteer.handsonatlanta.org"

API_HEADERS = {
    "x-golden-api-key": GOLDEN_API_KEY,
    "x-source-app": "portal",
    "x-source-domain": "volunteer.handsonatlanta.org",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en",
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    ),
    "Referer": HOA_BASE_URL,
    "Origin": HOA_BASE_URL,
}

# How many days ahead to include timeslots (avoids polluting feed with months-out shifts)
LOOKAHEAD_DAYS = 30

# Gentle rate-limiting between detail fetches (seconds)
DETAIL_FETCH_DELAY = 0.25

# ---------------------------------------------------------------------------
# HOA category → LostCity cause tags mapping
# ---------------------------------------------------------------------------
# HOA uses freeform tags on each opportunity; the category tags match these keys.
HOA_CATEGORY_CAUSE_MAP: dict[str, list[str]] = {
    "hunger + food insecurity": ["food-security"],
    "environment + sustainability": ["environment"],
    "education": ["education"],
    "civic + community": [],  # too broad — fall through to keyword matching
    "health + wellness": ["health"],
    "youth + family services": ["youth"],
    "arts + culture": ["arts-culture"],
    "civil + human rights": ["housing"],
    "senior services": ["health"],
    "court ordered approved": [],
    "family friendly": [],
    "love your park": ["environment"],
    "virtual opportunities": [],
    "immigrant & refugee services": ["community-support"],
    "immigrant and refugee services": ["community-support"],
    "disability services": ["health"],
    "animal welfare": [],
    "crisis intervention": ["health"],
    "housing + homelessness": ["housing"],
    "substance abuse & mental health": ["health"],
}

# Orientation / training keywords that indicate a commitment beyond drop-in
TRAINING_REQUIRED_PATTERNS = [
    "orientation required",
    "training required",
    "background check",
    "must complete",
    "prior training",
    "certification required",
    "pre-approved",
    "application required",
]

GENERIC_OPPORTUNITY_TITLES = {
    "volunteer",
    "volunteer opportunity",
    "opportunity",
    "service opportunity",
    "volunteer shift",
    "shift",
}


# ---------------------------------------------------------------------------
# Data helpers
# ---------------------------------------------------------------------------


def _build_api_headers() -> dict[str, str]:
    """Return the request headers for the Golden Volunteer API."""
    return dict(API_HEADERS)


def _fetch_opportunities_page(offset: int, limit: int = 200) -> list[dict]:
    """Fetch a page of available opportunities from the listing endpoint."""
    resp = requests.get(
        f"{API_BASE}/opportunities/available",
        headers=_build_api_headers(),
        params={
            "offset": offset,
            "limit": limit,
            "view": "list",
            "locale": "en",
            "dosFilterCriteria": "include-dos",
        },
        timeout=30,
    )
    resp.raise_for_status()
    data = resp.json()
    if not isinstance(data, list):
        logger.warning(
            "Unexpected response format from listing endpoint: %s", type(data)
        )
        return []
    return data


def _fetch_all_opportunities() -> list[dict]:
    """Paginate through the full opportunity listing. Returns all active opps."""
    all_opps: list[dict] = []
    offset = 0
    limit = 200
    while True:
        page = _fetch_opportunities_page(offset, limit)
        all_opps.extend(page)
        logger.debug(
            "Fetched %d opportunities (offset=%d, page_size=%d)",
            len(page),
            offset,
            limit,
        )
        if len(page) < limit:
            break
        offset += limit
    return all_opps


def _fetch_opportunity_detail(opp_id: str) -> Optional[dict]:
    """Fetch full opportunity detail including the `times` array."""
    try:
        resp = requests.get(
            f"{API_BASE}/opportunities/{opp_id}",
            headers=_build_api_headers(),
            timeout=20,
        )
        resp.raise_for_status()
        return resp.json()
    except Exception as e:
        logger.warning("Failed to fetch detail for opportunity %s: %s", opp_id, e)
        return None


def _parse_iso_datetime(iso_str: str) -> tuple[str, str]:
    """
    Parse an ISO 8601 datetime string into (date_str, time_str) in local time.

    The `start` field from the Golden Volunteer API is America/New_York-localized
    (despite having no explicit offset), so we trust it as-is for display.
    Format: '2026-03-20T14:15:00.000Z' or '2026-03-20T17:15:00.000Z'
    """
    try:
        # Strip trailing Z and milliseconds for parsing
        clean = re.sub(r"\.\d+Z?$", "", iso_str)
        dt = datetime.fromisoformat(clean)
        return dt.strftime("%Y-%m-%d"), dt.strftime("%H:%M")
    except Exception as e:
        logger.debug("Failed to parse datetime '%s': %s", iso_str, e)
        return "", ""


def _future_timeslots_within_window(
    times: list[dict], window_days: int = LOOKAHEAD_DAYS
) -> list[dict]:
    """
    Filter timeslots to:
      - Not cancelled
      - Start date >= today
      - Start date <= today + window_days
    Uses the `start` field (local time ISO) for date comparison.
    """
    today = date.today()
    cutoff = today + timedelta(days=window_days)
    result = []
    for slot in times:
        if slot.get("isCancelled"):
            continue
        start_iso = slot.get("start") or slot.get("startTime", "")
        if not start_iso:
            continue
        date_str, _ = _parse_iso_datetime(start_iso)
        if not date_str:
            continue
        try:
            slot_date = date.fromisoformat(date_str)
        except ValueError:
            continue
        if slot_date < today or slot_date > cutoff:
            continue
        result.append(slot)
    return result


def _extract_cause_tags(opp_tags: list[str]) -> list[str]:
    """Map HOA opportunity tags to LostCity cause tags."""
    cause_tags: list[str] = []
    for tag in opp_tags:
        # Unescape HTML entities (e.g. '&amp;' -> '&') before matching
        clean_tag = html.unescape(tag)
        key = clean_tag.lower().strip()
        if key in HOA_CATEGORY_CAUSE_MAP:
            cause_tags.extend(HOA_CATEGORY_CAUSE_MAP[key])
    return list(dict.fromkeys(cause_tags))  # deduplicate, preserve order


def _requires_training(description: str, tags: list[str]) -> bool:
    """Return True if this opportunity requires orientation/training."""
    clean_tags = [html.unescape(t) for t in tags]
    combined = (description + " " + " ".join(clean_tags)).lower()
    return any(pat in combined for pat in TRAINING_REQUIRED_PATTERNS)


def _build_description(opp: dict) -> str:
    """Build a concise event description from the opportunity fields."""
    parts: list[str] = []

    purpose = (opp.get("purpose") or "").strip()
    role = (opp.get("role") or "").strip()
    desc = (opp.get("description") or "").strip()
    org = (opp.get("organizationName") or "").strip()
    pro_tips = (opp.get("proTips") or "").strip()

    if purpose:
        parts.append(purpose if purpose.endswith(".") else f"{purpose}.")
    if role:
        parts.append(
            f"Your role: {role}" if not role.endswith(".") else f"Your role: {role}"
        )
    if desc and desc != purpose:
        parts.append(desc if desc.endswith(".") else f"{desc}.")
    if org:
        parts.append(f"Organized by {org}.")
    if pro_tips:
        parts.append(f"Tips: {pro_tips}")

    combined = " ".join(parts)
    # Cap at 1800 chars to leave headroom for DB limits
    return combined[:1800]


def _clean_short_text(value: str | None) -> str:
    """Normalize HOA text fields into a compact single line."""
    if not value:
        return ""
    return " ".join(html.unescape(value).split()).strip(" -:|")


def _is_generic_opportunity_title(value: str) -> bool:
    """Return True when HOA gives us a placeholder instead of a real title."""
    normalized = _clean_short_text(value).lower().rstrip(".")
    return normalized in GENERIC_OPPORTUNITY_TITLES


def _build_event_title(opp: dict, fallback_name: str | None = None) -> str:
    """
    Build a consumer-grade volunteer title.

    Some HOA partner records publish `name="Volunteer"`, which is not useful in
    the feed. Prefer purpose, then the first role line, then org name.
    """
    raw_name = _clean_short_text(opp.get("name") or fallback_name or "")
    if raw_name and not _is_generic_opportunity_title(raw_name):
        return raw_name

    purpose = _clean_short_text(opp.get("purpose"))
    if purpose and not _is_generic_opportunity_title(purpose):
        return f"Volunteer: {purpose}"

    role = _clean_short_text(
        (opp.get("role") or "").splitlines()[0] if opp.get("role") else ""
    )
    if role:
        if role.endswith("."):
            role = role[:-1].strip()
        if len(role) > 72:
            role = role[:69].rstrip(" ,;:-") + "..."
        return f"Volunteer: {role}"

    org_name = _clean_short_text(opp.get("organizationName"))
    if org_name:
        return f"Volunteer with {org_name}"

    return raw_name or "Volunteer Opportunity"


def _get_image_url(opp: dict) -> Optional[str]:
    """Extract the medium-sized image URL from the opportunity images list."""
    images = opp.get("images") or []
    for img in images:
        nested = img.get("images") or {}
        md = nested.get("md") or {}
        url = md.get("url")
        if url:
            return url
    return None


def _build_venue_data(opp: dict) -> dict:
    """Build venue data dict from the opportunity location object."""
    location = opp.get("location") or {}
    org_name = (opp.get("organizationName") or "Hands On Atlanta").strip()

    # Use org name as the venue name — HOA opps happen at the org's location
    venue_name = org_name
    address = location.get("address") or ""
    city = location.get("city") or "Atlanta"
    state = location.get("state") or "GA"
    zip_code = location.get("zip") or ""
    lat = location.get("latitude")
    lng = location.get("longitude")

    venue_slug = slugify(org_name)

    venue_data: dict = {
        "name": venue_name,
        "slug": venue_slug,
        "city": city,
        "state": state,
        "venue_type": "organization",
        "spot_type": "organization",
    }

    if address:
        full_address = address
        if zip_code:
            full_address = f"{address}, {zip_code}"
        venue_data["address"] = full_address

    if zip_code:
        venue_data["zip"] = zip_code

    if lat and lng:
        venue_data["lat"] = float(lat)
        venue_data["lng"] = float(lng)

    return venue_data


def _infer_series_frequency(times: list[dict]) -> str:
    """
    Infer recurrence frequency from a set of timeslots.

    If multiple slots share the same time-of-day on the same weekday → weekly.
    If multiple slots are on consecutive days → daily.
    Otherwise → irregular.
    """
    if len(times) < 2:
        return "irregular"

    dates: list[date] = []
    for slot in times:
        start_iso = slot.get("start") or slot.get("startTime", "")
        date_str, _ = _parse_iso_datetime(start_iso)
        if date_str:
            try:
                dates.append(date.fromisoformat(date_str))
            except ValueError:
                pass

    if len(dates) < 2:
        return "irregular"

    dates.sort()
    gaps = [(dates[i + 1] - dates[i]).days for i in range(len(dates) - 1)]

    if not gaps:
        return "irregular"

    avg_gap = sum(gaps) / len(gaps)
    if avg_gap <= 1.5:
        return "daily"
    if 5 <= avg_gap <= 9:
        return "weekly"
    if 12 <= avg_gap <= 16:
        return "biweekly"
    return "irregular"


# ---------------------------------------------------------------------------
# Main crawl function
# ---------------------------------------------------------------------------


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl Hands On Atlanta volunteer opportunities via the Golden Volunteer API.

    Returns (events_found, events_new, events_updated).
    """
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    # Step 0: Prefetch all existing events for this source in one query.
    # Eliminates ~1,000 individual find_event_by_hash() calls per run,
    # cutting Supabase HTTP/2 traffic from ~2,000 requests to ~20.
    logger.info("Prefetching existing HOA events for dedup")
    existing_events = prefetch_events_by_source(source_id)
    logger.info("Prefetched %d existing events for source %d", len(existing_events), source_id)

    # Step 1: Fetch the full opportunity listing
    logger.info("Fetching Hands On Atlanta opportunity listing")
    try:
        all_opps = _fetch_all_opportunities()
    except Exception as e:
        logger.error("Failed to fetch HOA opportunity listing: %s", e)
        raise

    logger.info("Found %d total HOA opportunities", len(all_opps))

    # Only fetch details for opportunities that have upcoming timeslots
    opps_with_next = [o for o in all_opps if o.get("nextAvailableTimeslot")]
    logger.info(
        "%d of %d opportunities have upcoming timeslots — fetching details",
        len(opps_with_next),
        len(all_opps),
    )

    # Step 2: For each opportunity, fetch detail, extract timeslots, upsert events
    for opp_summary in opps_with_next:
        opp_id = opp_summary["id"]
        opp_name = opp_summary.get("name", "Unknown Opportunity")

        # Fetch full detail with times array
        time.sleep(DETAIL_FETCH_DELAY)
        opp = _fetch_opportunity_detail(opp_id)
        if not opp:
            continue

        times = opp.get("times") or []
        upcoming = _future_timeslots_within_window(times)

        if not upcoming:
            logger.debug("No upcoming timeslots within window for: %s", opp_name)
            continue

        logger.debug(
            "Opportunity '%s' has %d upcoming timeslots", opp_name, len(upcoming)
        )

        # Build venue once per opportunity
        venue_data = _build_venue_data(opp)
        try:
            venue_id = get_or_create_venue(venue_data)
        except Exception as e:
            logger.warning("Could not create venue for '%s': %s", opp_name, e)
            continue

        venue_name = venue_data["name"]
        event_title = _build_event_title(opp, fallback_name=opp_name)

        # Build tags
        opp_tags = opp.get("tags") or []
        cause_tags = _extract_cause_tags(opp_tags)
        needs_training = _requires_training(
            (opp.get("description") or "") + " " + (opp.get("purpose") or ""),
            opp_tags,
        )
        base_tags = ["volunteer"]
        if needs_training:
            base_tags.append("training-required")
        else:
            base_tags.append("drop-in")
        base_tags.extend(cause_tags)

        description = _build_description(opp)
        image_url = _get_image_url(opp)
        source_url = f"{HOA_BASE_URL}/opportunities/{opp_id}"
        is_recurring = len(upcoming) > 1

        # Determine series frequency for grouping
        frequency = _infer_series_frequency(upcoming) if is_recurring else "irregular"
        series_hint = (
            {
                "series_type": "recurring_show",
                "series_title": f"{event_title} at {venue_name}",
                "frequency": frequency,
            }
            if is_recurring
            else None
        )

        events_found += len(upcoming)

        for slot in upcoming:
            slot_id = slot.get("id", "")
            start_iso = slot.get("start") or slot.get("startTime", "")
            end_iso = slot.get("end") or slot.get("endTime", "")

            start_date_str, start_time_str = _parse_iso_datetime(start_iso)
            _, end_time_str = _parse_iso_datetime(end_iso) if end_iso else ("", "")

            if not start_date_str:
                logger.debug("Skipping slot %s — cannot parse start date", slot_id)
                events_found -= 1
                continue

            content_hash = generate_content_hash(event_title, venue_name, start_date_str)

            event_record: dict = {
                "source_id": source_id,
                "venue_id": venue_id,
                "title": event_title,
                "description": description,
                "start_date": start_date_str,
                "start_time": start_time_str or None,
                "end_date": None,
                "end_time": end_time_str or None,
                "is_all_day": False,
                "category": "volunteer",
                "subcategory": "volunteer",
                "tags": base_tags,
                "price_min": 0,
                "price_max": 0,
                "price_note": "Free — volunteer opportunity",
                "is_free": True,
                "source_url": source_url,
                "ticket_url": source_url,
                "image_url": image_url,
                "raw_text": None,
                "extraction_confidence": 0.92,
                "is_recurring": is_recurring,
                "recurrence_rule": None,
                "content_hash": content_hash,
            }

            # Check prefetched cache first (no DB call); fall back to DB for misses
            existing = existing_events.get(content_hash)
            if existing is None:
                existing = find_event_by_hash(content_hash)
            if existing:
                smart_update_existing_event(existing, event_record)
                events_updated += 1
                continue

            try:
                insert_event(event_record, series_hint=series_hint)
                events_new += 1
                logger.debug("Added: %s on %s", event_title, start_date_str)
            except Exception as e:
                logger.error(
                    "Failed to insert '%s' on %s: %s", event_title, start_date_str, e
                )
                events_found -= 1

    logger.info(
        "Hands On Atlanta crawl complete: %d timeslots found, %d new, %d updated",
        events_found,
        events_new,
        events_updated,
    )
    return events_found, events_new, events_updated
