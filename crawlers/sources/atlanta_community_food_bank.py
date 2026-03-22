"""
Crawler for Atlanta Community Food Bank (ACFB) volunteer shifts.

Source: https://acfb.volunteerhub.com/internalapi/volunteerview/view/index
Platform: VolunteerHub internal API — no auth required for public listings.

ACFB runs volunteer shifts at multiple locations:
- Hunger Action Center (East Point warehouse) — morning and afternoon sorts
- Community Food Centers in Atlanta, Marietta, Stone Mountain, Jonesboro
- Jesse Hill Jr Dr Market (Downtown)
- Special events (food drives, mobile distributions, advocacy)

The VolunteerHub API returns 7-day blocks. We page forward via nextBlockUrl
until we reach HORIZON_DAYS days out or the API returns no further blocks.

Each shift instance is one event. Recurring shift types at the same location
are grouped into a series (e.g., "ACFB Hunger Action Center Sort").

Previous implementation used Playwright against the ACFB EventON WordPress
calendar, which was an iframe embed of VolunteerHub and yielded nothing.
This version hits the VolunteerHub internal API directly.
"""

from __future__ import annotations

import logging
import re
from datetime import datetime, timedelta
from typing import Optional
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

from db import (
    find_event_by_hash,
    get_or_create_venue,
    insert_event,
    smart_update_existing_event,
)
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

VOLUNTEERHUB_BASE = "https://acfb.volunteerhub.com"
INDEX_API = f"{VOLUNTEERHUB_BASE}/internalapi/volunteerview/view/index"
BLOCK_API_TEMPLATE = (
    f"{VOLUNTEERHUB_BASE}/internalapi/volunteerview/view/indexlistblock"
)

# Public sign-up landing pages
REGISTER_BASE = f"{VOLUNTEERHUB_BASE}/vv2/"

# Maximum calendar days to harvest
HORIZON_DAYS = 30

# Request headers — no auth needed for public volunteer listing
HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; LostCity/1.0; +https://lostcity.ai)",
    "Accept": "application/json",
    "Referer": f"{VOLUNTEERHUB_BASE}/vv2/",
}

# -----------------------------------------------------------------
# Known ACFB venue records keyed by locationId from the API.
# We fall back to dynamic construction for unknown IDs.
# -----------------------------------------------------------------
KNOWN_VENUES: dict[int, dict] = {
    49830: {
        "name": "ACFB Hunger Action Center",
        "slug": "acfb-hunger-action-center",
        "address": "3400 North Desert Drive",
        "neighborhood": "East Point",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30344",
        "lat": 33.6495,
        "lng": -84.4390,
        "venue_type": "organization",
        "spot_type": "organization",
        "website": "https://www.acfb.org",
    },
    # Alternate address string for same facility
    50056: {
        "name": "ACFB Hunger Action Center",
        "slug": "acfb-hunger-action-center",
        "address": "3400 N Desert Dr",
        "neighborhood": "East Point",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30344",
        "lat": 33.6495,
        "lng": -84.4390,
        "venue_type": "organization",
        "spot_type": "organization",
        "website": "https://www.acfb.org",
    },
    50110: {
        "name": "ACFB Stone Mountain Community Food Center",
        "slug": "acfb-stone-mountain-cfc",
        "address": "1979 Parker Court Suite D",
        "neighborhood": "Stone Mountain",
        "city": "Stone Mountain",
        "state": "GA",
        "zip": "30087",
        "lat": 33.8265,
        "lng": -84.1068,
        "venue_type": "organization",
        "spot_type": "organization",
        "website": "https://www.acfb.org",
    },
    90734: {
        "name": "ACFB Marietta Community Food Center",
        "slug": "acfb-marietta-cfc",
        "address": "1605 Austell Road SE",
        "neighborhood": "Marietta",
        "city": "Marietta",
        "state": "GA",
        "zip": "30008",
        "lat": 33.9133,
        "lng": -84.5547,
        "venue_type": "organization",
        "spot_type": "organization",
        "website": "https://www.acfb.org",
    },
    97700: {
        "name": "ACFB Jesse Hill Market",
        "slug": "acfb-jesse-hill-market",
        "address": "92 Jesse Hill Jr Dr SE",
        "neighborhood": "Downtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30303",
        "lat": 33.7513,
        "lng": -84.3832,
        "venue_type": "organization",
        "spot_type": "organization",
        "website": "https://www.acfb.org",
    },
    98838: {
        "name": "ACFB Jonesboro Community Food Center",
        "slug": "acfb-jonesboro-cfc",
        "address": "6805 Tara Blvd",
        "neighborhood": "Jonesboro",
        "city": "Jonesboro",
        "state": "GA",
        "zip": "30236",
        "lat": 33.5682,
        "lng": -84.3724,
        "venue_type": "organization",
        "spot_type": "organization",
        "website": "https://www.acfb.org",
    },
    114401: {
        "name": "ACFB Atlanta Community Food Center",
        "slug": "acfb-atlanta-cfc",
        "address": "3500 MLK Jr Dr SW",
        "neighborhood": "Westside",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30331",
        "lat": 33.7573,
        "lng": -84.5029,
        "venue_type": "organization",
        "spot_type": "organization",
        "website": "https://www.acfb.org",
    },
    # Remote / online opportunities default to main campus
    50270: {
        "name": "Atlanta Community Food Bank",
        "slug": "atlanta-community-food-bank",
        "address": "3400 N Desert Dr",
        "neighborhood": "East Point",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30344",
        "lat": 33.6495,
        "lng": -84.4390,
        "venue_type": "organization",
        "spot_type": "organization",
        "website": "https://www.acfb.org",
    },
}


def _clean_html(raw: str) -> str:
    """Strip HTML tags and collapse whitespace from a description string."""
    if not raw:
        return ""
    text = BeautifulSoup(raw, "lxml").get_text(separator=" ")
    return re.sub(r"\s+", " ", text).strip()


def _venue_for(location_id: int, location_str: str) -> dict:
    """
    Return a venue dict for the given VolunteerHub locationId.

    Uses KNOWN_VENUES where possible; builds a minimal fallback for unknowns.
    """
    if location_id in KNOWN_VENUES:
        return KNOWN_VENUES[location_id]

    name_part = location_str.split(",")[0].strip() if location_str else "ACFB Location"
    slug = re.sub(r"[^a-z0-9]+", "-", name_part.lower()).strip("-")[:80]
    city = "Atlanta"
    state = "GA"
    city_match = re.search(r",\s*([A-Za-z\s]+),\s*GA", location_str)
    if city_match:
        city = city_match.group(1).strip()

    return {
        "name": name_part or "Atlanta Community Food Bank",
        "slug": slug or "acfb-location",
        "address": location_str,
        "city": city,
        "state": state,
        "venue_type": "organization",
        "spot_type": "organization",
        "website": "https://www.acfb.org",
    }


def _series_title_for(shift_name: str, venue_name: str) -> str:
    """
    Derive a stable series title from shift name + venue.

    Strips time-of-day qualifiers ("Morning", "Afternoon") so that morning
    and afternoon sorts at the same location belong to one series, keeping
    the feed from being spammed with near-identical cards.
    """
    clean = re.sub(
        r"\s*\((Morning|Afternoon|Evening|AM|PM)\)",
        "",
        shift_name,
        flags=re.IGNORECASE,
    )
    clean = re.sub(
        r"\s+(Morning|Afternoon|Evening)\s*(Distr\.|Distribution|Sort|Crew)?$",
        "",
        clean,
        flags=re.IGNORECASE,
    ).strip()
    return f"{clean} — {venue_name}"


def _fetch_block(url: str) -> Optional[dict]:
    """Fetch a single VolunteerHub JSON block. Returns None on error."""
    try:
        resp = requests.get(url, headers=HEADERS, timeout=20)
        resp.raise_for_status()
        return resp.json()
    except Exception as exc:
        logger.error(f"ACFB: failed fetching VolunteerHub block {url}: {exc}")
        return None


def _collect_shifts(horizon_days: int) -> list[dict]:
    """
    Page through the VolunteerHub API and collect all shifts within the horizon.

    The index endpoint returns the first 7-day block. Subsequent blocks are
    fetched via nextBlockUrl, adjusted to use the internal API path prefix.
    Each shift dict is augmented with a `_date` field (YYYY-MM-DD).
    """
    cutoff = datetime.now().date() + timedelta(days=horizon_days)
    shifts: list[dict] = []
    pages_fetched = 0

    data = _fetch_block(INDEX_API)

    while data:
        pages_fetched += 1
        days = data.get("days", [])
        stop_paging = False

        for day_block in days:
            raw_date = day_block.get("date", "")
            try:
                block_date = datetime.fromisoformat(raw_date).date()
            except (ValueError, TypeError):
                continue

            if block_date > cutoff:
                stop_paging = True
                break

            date_str = block_date.strftime("%Y-%m-%d")
            for event in day_block.get("events", []):
                event["_date"] = date_str
                shifts.append(event)

        if stop_paging:
            break

        next_path = data.get("nextBlockUrl")
        if not next_path:
            break

        # nextBlockUrl uses a mixed-case MVC path; remap to the internal API path
        next_path_internal = re.sub(
            r"(?i)/VolunteerView/View/IndexListBlock",
            "/internalapi/volunteerview/view/indexlistblock",
            next_path,
        )
        next_url = urljoin(VOLUNTEERHUB_BASE, next_path_internal)
        data = _fetch_block(next_url)

        if pages_fetched >= 20:
            logger.warning("ACFB: hit 20-page safety limit")
            break

    logger.info(
        f"ACFB: collected {len(shifts)} shifts across {pages_fetched} API pages"
    )
    return shifts


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl Atlanta Community Food Bank volunteer shifts via VolunteerHub API.

    Returns (events_found, events_new, events_updated).
    """
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    # Cache venue DB IDs to avoid repeated get_or_create calls
    venue_id_cache: dict[int, int] = {}

    raw_shifts = _collect_shifts(HORIZON_DAYS)
    if not raw_shifts:
        logger.warning("ACFB: no shifts returned from VolunteerHub API")
        return 0, 0, 0

    seen_hashes: set[str] = set()

    for shift in raw_shifts:
        try:
            shift_name = (shift.get("name") or "").strip()
            if not shift_name:
                continue

            start_date = shift.get("_date")
            if not start_date:
                continue

            # Parse start/end times from ISO datetime strings ("2026-03-09T08:30:00")
            start_time: Optional[str] = None
            end_time: Optional[str] = None
            s_raw = shift.get("sTime")
            e_raw = shift.get("eTime")
            if s_raw:
                try:
                    start_time = datetime.fromisoformat(s_raw).strftime("%H:%M")
                except ValueError:
                    pass
            if e_raw:
                try:
                    end_time = datetime.fromisoformat(e_raw).strftime("%H:%M")
                except ValueError:
                    pass

            location_id: int = shift.get("locationId") or 0
            location_str: str = shift.get("location") or ""
            venue_data = _venue_for(location_id, location_str)

            if location_id not in venue_id_cache:
                venue_id_cache[location_id] = get_or_create_venue(venue_data)
            venue_id = venue_id_cache[location_id]
            venue_name = venue_data["name"]

            # Build description from VolunteerHub HTML fields
            short = _clean_html(shift.get("shortDescription") or "")
            long_ = _clean_html(shift.get("longDescription") or "")
            description = (long_[:800] if long_ else short[:400]) or (
                f"Volunteer shift with the Atlanta Community Food Bank "
                f"at {venue_name}. Help fight hunger in the Atlanta region."
            )

            # Registration URL (deep link to this shift's sign-up page)
            guid = shift.get("guid") or ""
            register_url = f"{REGISTER_BASE}lp/{guid}" if guid else REGISTER_BASE

            # Clean redundant "Volunteer: " prefix — the event category already signals this.
            # Apply before series grouping so series titles are also prefix-free.
            clean_shift_name = shift_name.removeprefix("Volunteer: ").removeprefix("Volunteer:").strip()
            title = clean_shift_name

            # Series grouping: one series per shift-type + location
            series_title = _series_title_for(clean_shift_name, venue_name)
            series_hint = {
                "series_type": "recurring_show",
                "series_title": series_title,
                "frequency": "daily",
            }
            content_hash = generate_content_hash(title, venue_name, start_date)
            if content_hash in seen_hashes:
                continue
            seen_hashes.add(content_hash)

            events_found += 1

            slots = shift.get("slotsRemaining")
            price_note = "Free"
            if slots is not None:
                price_note += f" — {slots} spots available"

            event_record = {
                "source_id": source_id,
                "venue_id": venue_id,
                "title": title,
                "description": description,
                "start_date": start_date,
                "start_time": start_time,
                "end_date": start_date,
                "end_time": end_time,
                "is_all_day": False,
                "category": "community",
                "subcategory": "volunteer",
                "tags": ["food-security", "volunteer", "drop-in", "community"],
                "price_min": 0,
                "price_max": 0,
                "price_note": price_note,
                "is_free": True,
                "source_url": REGISTER_BASE,
                "ticket_url": register_url,
                "image_url": None,
                "raw_text": f"{shift_name} | {location_str} | {start_date}",
                "extraction_confidence": 0.95,
                "is_recurring": True,
                "recurrence_rule": "FREQ=DAILY",
                "content_hash": content_hash,
            }

            existing = find_event_by_hash(content_hash)
            if existing:
                smart_update_existing_event(existing, event_record)
                events_updated += 1
                logger.debug(f"Updated: {title} on {start_date} at {venue_name}")
                continue

            insert_event(event_record, series_hint=series_hint)
            events_new += 1
            logger.info(f"Added: {title} on {start_date} at {venue_name}")

        except Exception as exc:
            logger.warning(
                f"ACFB: error processing shift id={shift.get('id')!r}: {exc}"
            )
            continue

    logger.info(
        f"ACFB crawl complete: "
        f"{events_found} found, {events_new} new, {events_updated} updated"
    )
    return events_found, events_new, events_updated
