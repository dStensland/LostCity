"""
Crawler for Crux Collective Atlanta (cruxatl.com).
Atlanta-based circus and aerial arts performance company.

Produces 2-4 large-scale shows per year at rotating Atlanta venues.
Uses Crowdwork/FourthWall ticketing (same platform as Dynamic El Dorado).
API: https://crowdwork.com/api/v2/cruxcollectiveatlanta/shows

Shows are named after the production (e.g., "Untamed", "Mutara", "Parallel")
with separate API entries per performance date. The crawler groups dates under
the same production title into a series.

Because Crux is a traveling company with no fixed venue, the event's venue
is parsed from the show's `venue` field and created dynamically.
"""

from __future__ import annotations

import logging
import re
from datetime import datetime, timezone
from typing import Optional
from zoneinfo import ZoneInfo

import requests

from db import (
    get_or_create_place,
    insert_event,
    find_event_by_hash,
    smart_update_existing_event,
    remove_stale_source_events,
)
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

API_URL = "https://crowdwork.com/api/v2/cruxcollectiveatlanta/shows"
BASE_URL = "https://www.cruxatl.com"
PURCHASE_URL = "https://crowdwork.com/v/cruxcollectiveatlanta/shows"

# Crux Collective is a performing arts company, not a fixed venue.
# Their organizational identity is captured here; per-show venues are parsed
# from the API's `venue` field.
ORG_DATA = {
    "name": "Crux Collective Atlanta",
    "slug": "crux-collective-atlanta",
    "address": "1235 Constitution Rd SE",  # Challenge Aerial, their home studio
    "neighborhood": "Grant Park",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30316",
    "lat": 33.7338,
    "lng": -84.3517,
    "venue_type": "organization",
    "spot_type": "organization",
    "website": BASE_URL,
    "description": (
        "Atlanta-based circus and aerial arts performance company producing large-scale "
        "collaborative shows featuring aerialists, dancers, acrobats, and physical theater "
        "artists. Known for narrative-driven productions that blur the boundaries between "
        "aerial arts, contemporary dance, and storytelling."
    ),
    "vibes": ["artsy", "live-music", "lively", "all-ages"],
}

EASTERN = ZoneInfo("America/New_York")

_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    "Accept": "application/json",
    "Referer": BASE_URL,
}

# Address parsing regex for venue strings like:
# "Windmill Arts Center, 2823 Church St, East Point, GA 30344"
_VENUE_ADDR_RE = re.compile(
    r"^(?P<name>.+?),\s*(?P<address>\d+.+?),\s*(?P<city>[^,]+),\s*(?P<state>[A-Z]{2})\s*(?P<zip>\d{5})?$"
)


def _strip_html(html: str) -> str:
    """Strip HTML tags from description."""
    if not html:
        return ""
    text = re.sub(r"<br\s*/?>", "\n", html, flags=re.IGNORECASE)
    text = re.sub(r"<[^>]+>", "", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def _parse_cost(show: dict) -> tuple[Optional[float], Optional[float], bool, Optional[str]]:
    """
    Extract price info from Crowdwork show.
    Returns (price_min, price_max, is_free, price_note).
    """
    cost_obj = show.get("cost", {})
    formatted = cost_obj.get("formatted", "") if cost_obj else ""
    cost_tiers = show.get("cost_tiers", [])

    if "pay what you want" in formatted.lower() or "pwyw" in formatted.lower():
        return None, None, True, "Pay what you want"
    if "free" in formatted.lower():
        return None, None, True, None

    prices = []
    for tier in cost_tiers:
        cost_cents = tier.get("cost", 0)
        if cost_cents and cost_cents > 0:
            prices.append(cost_cents / 100.0)

    if prices:
        price_min = min(prices)
        price_max = max(prices) if max(prices) != price_min else None
        return price_min, price_max, False, None

    dollar_match = re.search(r"\$(\d+(?:\.\d{2})?)", formatted)
    if dollar_match:
        return float(dollar_match.group(1)), None, False, None

    return None, None, False, None


def _parse_show_dates(show: dict) -> list[tuple[str, str]]:
    """
    Parse all future show dates.
    Returns list of (YYYY-MM-DD, HH:MM) tuples in Eastern time.
    """
    now = datetime.now(timezone.utc)
    results = []

    for date_str in show.get("dates", []):
        try:
            dt = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
            if dt < now:
                continue
            dt_eastern = dt.astimezone(EASTERN)
            results.append((
                dt_eastern.strftime("%Y-%m-%d"),
                dt_eastern.strftime("%H:%M"),
            ))
        except (ValueError, TypeError):
            logger.debug(f"Could not parse Crux date: {date_str!r}")
            continue

    return results


def _get_or_create_show_venue(venue_str: str) -> int:
    """
    Parse a venue string like "Windmill Arts Center, 2823 Church St, East Point, GA 30344"
    and return its venue_id via get_or_create_place.
    Falls back to the org record if parsing fails.
    """
    if not venue_str or not venue_str.strip():
        return get_or_create_place(ORG_DATA)

    m = _VENUE_ADDR_RE.match(venue_str.strip())
    if m:
        name = m.group("name").strip()
        address = m.group("address").strip()
        city = m.group("city").strip()
        state = m.group("state").strip()
        zip_code = (m.group("zip") or "").strip()

        # Generate a slug from venue name
        slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")

        place_data = {
            "name": name,
            "slug": slug,
            "address": address,
            "neighborhood": city,  # Best approximation without geocoding
            "city": city,
            "state": state,
            "zip": zip_code,
            "lat": None,
            "lng": None,
            "venue_type": "event_space",
            "spot_type": "event_space",
            "website": None,
            "vibes": ["artsy", "live-music", "lively"],
        }
        try:
            return get_or_create_place(place_data)
        except Exception as exc:
            logger.warning(f"Failed to create venue for '{venue_str}': {exc}")

    # Fallback: use org record
    return get_or_create_place(ORG_DATA)


def _extract_production_title(show_name: str) -> str:
    """
    Extract the clean production title from a show name like:
    "Crux Collective Atlanta Presents: Untamed (March 14th, Saturday)"
    -> "Untamed"

    Falls back to the full name if the pattern doesn't match.
    """
    # Pattern: "... Presents: TITLE (date stuff)"
    m = re.search(r"Presents?:\s*([^(]+?)(?:\s*\([^)]+\))?\s*$", show_name, re.IGNORECASE)
    if m:
        return m.group(1).strip()
    # Fallback: strip "(date)" suffix
    clean = re.sub(r"\s*\([^)]+\)\s*$", "", show_name).strip()
    return clean


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Crux Collective Atlanta shows via Crowdwork API."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0
    current_hashes: set[str] = set()

    try:
        logger.info(f"Fetching Crux Collective shows: {API_URL}")
        try:
            resp = requests.get(API_URL, headers=_HEADERS, timeout=30)
            resp.raise_for_status()
            data = resp.json()
        except requests.RequestException as exc:
            logger.error(f"HTTP error fetching Crux Collective API: {exc}")
            return 0, 0, 0
        except ValueError as exc:
            logger.error(f"JSON parse error from Crux Collective API: {exc}")
            return 0, 0, 0

        shows = data.get("data", [])
        logger.info(f"Crux Collective API returned {len(shows)} shows")

        # Group shows by production title for series linking
        # e.g., all "Untamed" dates form one series
        production_series_map: dict[str, dict] = {}

        for show in shows:
            if show.get("status") != "active":
                continue

            show_id = show.get("id")
            show_name = (show.get("name") or "").strip()
            if not show_name:
                continue

            production_title = _extract_production_title(show_name)

            # Parse dates — skip shows with no future dates
            show_dates = _parse_show_dates(show)
            if not show_dates:
                logger.debug(f"No future dates for: {show_name}")
                continue

            # Resolve venue
            venue_str = show.get("venue", "")
            venue_id = _get_or_create_show_venue(venue_str)

            # Description
            desc_obj = show.get("description", {})
            desc_html = desc_obj.get("body", "") if isinstance(desc_obj, dict) else ""
            description = _strip_html(desc_html) or show.get("description_short", "")

            # Image
            img_obj = show.get("img", {})
            image_url = (
                img_obj.get("large") or img_obj.get("url")
                if isinstance(img_obj, dict)
                else None
            )

            # Ticket URL
            ticket_url = show.get("url") or PURCHASE_URL
            source_url = ticket_url or PURCHASE_URL

            # Price
            price_min, price_max, is_free, price_note = _parse_cost(show)

            # Series hint — group all performances of the same production
            series_key = production_title.lower()
            if series_key not in production_series_map:
                production_series_map[series_key] = {
                    "series_type": "recurring_show",
                    "series_title": production_title,
                    "frequency": "irregular",
                }
            series_hint = production_series_map[series_key]

            # Create one event per date
            for start_date, start_time in show_dates:
                events_found += 1

                content_hash = generate_content_hash(
                    show_name, "Crux Collective Atlanta", f"{start_date}|{show_id}"
                )
                current_hashes.add(content_hash)

                event_record = {
                    "source_id": source_id,
                    "venue_id": venue_id,
                    "title": show_name,
                    "description": (
                        description[:2000]
                        if description
                        else f"{production_title} — a Crux Collective Atlanta production."
                    ),
                    "start_date": start_date,
                    "start_time": start_time,
                    "end_date": None,
                    "end_time": None,
                    "is_all_day": False,
                    "category": "theater",
                    "subcategory": "circus",
                    "tags": [
                        "circus",
                        "aerial",
                        "performance",
                        "dance",
                        "physical-theater",
                        "crux-collective",
                        "atlanta",
                    ],
                    "price_min": price_min,
                    "price_max": price_max,
                    "price_note": price_note,
                    "is_free": is_free,
                    "source_url": source_url,
                    "ticket_url": ticket_url,
                    "image_url": image_url,
                    "raw_text": f"{show_name} | {start_date} {start_time} | {venue_str}",
                    "extraction_confidence": 0.95,
                    "is_recurring": True,
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
                    logger.info(f"Added: {show_name} on {start_date} at {start_time} @ {venue_str}")
                except Exception as exc:
                    logger.error(f"Failed to insert '{show_name}' on {start_date}: {exc}")

        remove_stale_source_events(source_id, current_hashes)

    except requests.RequestException as exc:
        logger.error(f"Failed to fetch Crux Collective API: {exc}")
        raise
    except Exception as exc:
        logger.error(f"Failed to crawl Crux Collective: {exc}")
        raise

    logger.info(
        f"Crux Collective crawl complete: {events_found} found, "
        f"{events_new} new, {events_updated} updated"
    )
    return events_found, events_new, events_updated
