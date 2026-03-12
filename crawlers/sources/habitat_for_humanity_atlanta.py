"""
Crawler for Habitat for Humanity Atlanta (atlantahabitat.org).

Major nonprofit building affordable housing. Volunteer opportunities include
house builds, ReStore volunteering, and community events.

Volunteer scheduling is managed via VolunteerHub (BetterGood platform).
Two public landing pages are available without login:
  - orientation: https://atlantahabitat.volunteerhub.com/lp/orientation/
  - constructionvolunteers: http://constructionvolunteers.atlantahabitat.volunteerhub.com/

The full volunteer schedule requires orientation completion + login, so only
publicly listed events (orientation sessions and urgent-need construction dates)
are available for crawling. These are sparse but real and actionable.

API pattern: GET https://atlantahabitat.volunteerhub.com/internalapi/volunteerview/view/index
  Params: landingPageSubhost=<subhost>, filter=<JSON filter object>
  Returns: { months: [{ date, days: [{ date, past, events: [{ id, name, startTime, endTime }] }] }] }
"""

from __future__ import annotations

import json
import logging
import calendar
from datetime import datetime
from typing import Optional
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from urllib.error import URLError, HTTPError

from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://www.atlantahabitat.org"
VOLUNTEERHUB_API = "https://atlantahabitat.volunteerhub.com/internalapi/volunteerview/view/index"

# Public VolunteerHub landing page subhosts (no login required)
PUBLIC_SUBHOSTS = [
    "orientation",
    "constructionvolunteers",
]

# Months ahead to scan (VolunteerHub rarely schedules more than 2-3 months out)
MONTHS_TO_SCAN = 6

VENUE_DATA = {
    "name": "Habitat for Humanity Atlanta",
    "slug": "habitat-for-humanity-atlanta",
    "address": "824 Memorial Dr SE",
    "neighborhood": "Reynoldstown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30316",
    "lat": 33.7407,
    "lng": -84.3582,
    "venue_type": "nonprofit",
    "spot_type": "nonprofit",
    "website": BASE_URL,
    "vibes": ["volunteer", "family-friendly"],
}

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/json, */*",
    "X-Requested-With": "XMLHttpRequest",
}


def _build_api_url(subhost: str, start_date: str, end_date: str) -> str:
    filter_obj = {
        "eventGroupId": None,
        "partySize": None,
        "startDate": start_date,
        "endDate": end_date,
        "daysOfWeek": [],
        "timeOfDay": None,
        "locationId": None,
    }
    params = urlencode({"landingPageSubhost": subhost, "filter": json.dumps(filter_obj)})
    return f"{VOLUNTEERHUB_API}?{params}"


def _fetch_month(subhost: str, year: int, month: int) -> list[dict]:
    """Fetch all non-past events for a given subhost/month. Returns flat list of event dicts."""
    target = datetime(year, month, 1)
    start_date = target.strftime("%Y-%m-%d")
    _, last_day = calendar.monthrange(year, month)
    end_date = target.replace(day=last_day).strftime("%Y-%m-%d")

    url = _build_api_url(subhost, start_date, end_date)
    try:
        req = Request(url, headers=HEADERS)
        with urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except (HTTPError, URLError) as e:
        logger.warning(f"VolunteerHub API error for {subhost} {start_date[:7]}: {e}")
        return []

    events = []
    for month_block in data.get("months", []):
        for day in month_block.get("days", []):
            if day.get("past"):
                continue
            date_str = day.get("date", "")[:10]
            for ev in day.get("events", []):
                if ev.get("name"):
                    events.append(
                        {
                            "date": date_str,
                            "name": ev["name"],
                            "start_time": ev.get("startTime", "")[:19],
                            "end_time": ev.get("endTime", "")[:19],
                            "id": ev.get("id"),
                            "guid": ev.get("guid"),
                            "subhost": subhost,
                        }
                    )
    return events


def _source_url(subhost: str) -> str:
    if subhost == "orientation":
        return "https://atlantahabitat.volunteerhub.com/lp/orientation/"
    return f"https://atlantahabitat.volunteerhub.com/lp/{subhost}/"


def _make_event_record(
    raw: dict,
    source_id: int,
    venue_id: int,
) -> Optional[dict]:
    """Convert a raw VolunteerHub event dict into an insertable event record."""
    title = raw["name"].strip()
    if not title:
        return None

    start_date = raw["date"]  # Already YYYY-MM-DD
    if not start_date:
        return None

    # Parse HH:MM from ISO datetime string
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    if raw.get("start_time") and "T" in raw["start_time"]:
        start_time = raw["start_time"][11:16]  # "HH:MM"
    if raw.get("end_time") and "T" in raw["end_time"]:
        end_time = raw["end_time"][11:16]

    subhost = raw.get("subhost", "orientation")
    source_url = _source_url(subhost)

    # Category logic
    text = title.lower()
    if "orientation" in text:
        category = "community"
        subcategory = "volunteer"
        tags = ["volunteer", "nonprofit", "orientation", "housing"]
    elif "construction" in text or "build" in text:
        category = "community"
        subcategory = "volunteer"
        tags = ["volunteer", "nonprofit", "construction", "housing"]
    else:
        category = "community"
        subcategory = "volunteer"
        tags = ["volunteer", "nonprofit", "housing"]

    content_hash = generate_content_hash(title, "Habitat for Humanity Atlanta", start_date)

    return {
        "source_id": source_id,
        "venue_id": venue_id,
        "title": title[:200],
        "description": None,
        "start_date": start_date,
        "start_time": start_time,
        "end_date": None,
        "end_time": end_time,
        "is_all_day": False,
        "category": category,
        "subcategory": subcategory,
        "tags": tags,
        "price_min": None,
        "price_max": None,
        "price_note": None,
        "is_free": True,
        "source_url": source_url,
        "ticket_url": source_url,
        "image_url": None,
        "raw_text": title,
        "extraction_confidence": 0.90,
        "is_recurring": "orientation" in title.lower(),
        "recurrence_rule": None,
        "content_hash": content_hash,
    }


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl Habitat for Humanity Atlanta volunteer events via VolunteerHub API.

    Only public landing pages (orientation, urgent-need construction) are accessible
    without a volunteer account. The full schedule requires post-orientation login,
    so event counts will be low (typically 0-5 sessions visible at a time).
    """
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    venue_id = get_or_create_venue(VENUE_DATA)

    # Collect all raw events across subhosts and months
    raw_events: list[dict] = []
    now = datetime.now()

    for subhost in PUBLIC_SUBHOSTS:
        for month_offset in range(MONTHS_TO_SCAN):
            target_month = (now.month + month_offset - 1) % 12 + 1
            target_year = now.year + (now.month + month_offset - 1) // 12
            month_events = _fetch_month(subhost, target_year, target_month)
            raw_events.extend(month_events)
            logger.debug(
                f"Habitat/VolunteerHub [{subhost}] {target_year}-{target_month:02d}: "
                f"{len(month_events)} events"
            )

    # Deduplicate by (name, date) across subhosts
    seen: set[str] = set()
    unique_events: list[dict] = []
    for ev in raw_events:
        key = f"{ev['name']}|{ev['date']}"
        if key not in seen:
            seen.add(key)
            unique_events.append(ev)

    logger.info(
        f"Habitat for Humanity Atlanta: {len(unique_events)} unique volunteer events found "
        f"across {len(PUBLIC_SUBHOSTS)} public VolunteerHub pages"
    )

    for raw in unique_events:
        record = _make_event_record(raw, source_id, venue_id)
        if not record:
            continue

        events_found += 1
        existing = find_event_by_hash(record["content_hash"])

        if existing:
            smart_update_existing_event(existing, record)
            events_updated += 1
        else:
            try:
                insert_event(record)
                events_new += 1
                logger.info(
                    f"Added: {record['title'][:60]} on {record['start_date']}"
                )
            except Exception as e:
                logger.error(f"Failed to insert {record['title']}: {e}")

    logger.info(
        f"Habitat for Humanity Atlanta crawl complete: "
        f"{events_found} found, {events_new} new, {events_updated} updated"
    )
    return events_found, events_new, events_updated
