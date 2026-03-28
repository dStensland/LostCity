"""
Crawler for MARTA Army (martaarmy.org) transit advocacy events.

Source: https://www.martaarmy.org/transit-events
Platform: Squarespace with embedded Google Calendar

MARTA Army is Atlanta's grassroots transit advocacy organization. Their calendar
aggregates transit-related community events across the metro area:
- Transit open houses and public comment sessions
- Beltline briefings and planning meetings
- NPU meetings focused on transportation
- ARC (Atlanta Regional Commission) public meetings
- "Let's Talk Transit" quarterly happy hours
- Atlanta Streets Alive car-free corridor events
- Urban design and planning community events

This crawler uses the public Google Calendar iCal feed rather than scraping the
Squarespace page, which is far more reliable and provides structured data.

Note: MARTA Army aggregates events from various organizers. Events may occur at
many different venues across the metro area. The LOCATION field in the iCal feed
provides venue info per-event, but we use MARTA Army HQ as the fallback venue.
"""

from __future__ import annotations

import logging
import re
from datetime import date, datetime
from typing import Optional

import requests
from icalendar import Calendar

from db import (
    find_event_by_hash,
    get_or_create_place,
    insert_event,
    smart_update_existing_event,
)
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

ICAL_URL = (
    "https://calendar.google.com/calendar/ical/"
    "ad48bb2bea28d1023b0d574b4b6de2286b5a6de4423be0ac3791022aeed757d6"
    "%40group.calendar.google.com/public/basic.ics"
)
EVENTS_PAGE = "https://www.martaarmy.org/transit-events"

# Fallback venue — events happen at various locations, but we need a default
PLACE_DATA = {
    "name": "MARTA Army",
    "slug": "marta-army",
    "address": "Atlanta, GA",
    "neighborhood": "Citywide",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30303",
    "lat": 33.7490,
    "lng": -84.3880,
    "place_type": "organization",
    "spot_type": "organization",
    "website": "https://www.martaarmy.org",
}

EVENT_TAGS = ["transit", "civic", "community", "advocacy", "marta-army"]

# Events with these title patterns are MARTA Board meetings already covered
# by the marta_board.py crawler — skip to avoid duplicates
SKIP_PATTERNS: list[str] = [
    r"marta\s+board\s+(meeting|of\s+directors)",
    r"marta\s+board\s+committee",
    r"marta\s+board\s+working\s+session",
    r"marta\s+(audit|planning|operations|business|external)\s+committee",
]

# Tag enrichment based on event title/description
_TAG_RULES: list[tuple[str, list[str]]] = [
    (r"beltline", ["beltline", "urban-planning"]),
    (r"npu|neighborhood\s+planning", ["npu", "neighborhood"]),
    (r"arc\b|regional\s+commission", ["arc", "regional-planning"]),
    (r"streets?\s+alive", ["streets-alive", "outdoors", "bike"]),
    (r"let'?s\s+talk\s+transit", ["happy-hour", "social"]),
    (r"bike|cycling|bicycle", ["bike", "cycling"]),
    (r"pedestrian|walk", ["pedestrian", "walkability"]),
    (r"open\s+house|public\s+comment|public\s+hearing", ["public-comment", "attend"]),
    (r"design|planning|zoning", ["urban-planning"]),
    (r"bus\s+network|route\s+change|redesign", ["bus", "service-change"]),
    (r"rail|train|station", ["rail"]),
    (r"volunteer", ["volunteer"]),
]


def _clean_ical_text(text: str) -> str:
    """Clean text from iCal fields."""
    if not text:
        return ""
    text = re.sub(r"<[^>]+>", "", text)
    text = re.sub(r"\\n", "\n", text)
    text = re.sub(r"\\,", ",", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def _should_skip(title: str) -> bool:
    """Return True if this event duplicates the MARTA Board crawler."""
    lower = title.lower()
    return any(re.search(p, lower) for p in SKIP_PATTERNS)


def _enrich_tags(title: str, description: str) -> list[str]:
    """Return additional tags based on event content."""
    combined = f"{title} {description}".lower()
    extra: list[str] = []
    for pattern, tags in _TAG_RULES:
        if re.search(pattern, combined):
            extra.extend(tags)
    return list(dict.fromkeys(extra))  # dedupe preserving order


def _extract_url_from_description(description: str) -> Optional[str]:
    """Pull a URL from the description text if present."""
    m = re.search(r"(https?://\S+)", description)
    if m:
        url = m.group(1).rstrip(".,;)")
        return url
    return None


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl MARTA Army transit events via Google Calendar iCal feed."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    venue_id = get_or_create_place(PLACE_DATA)

    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        "Accept": "text/calendar",
    }

    logger.info("Fetching MARTA Army iCal feed: %s", ICAL_URL)
    try:
        response = requests.get(ICAL_URL, headers=headers, timeout=30)
        response.raise_for_status()
    except requests.RequestException as exc:
        logger.error("Failed to fetch MARTA Army iCal feed: %s", exc)
        return 0, 0, 0

    cal = Calendar.from_ical(response.content)
    today = date.today()
    seen: set[str] = set()

    for component in cal.walk():
        if component.name != "VEVENT":
            continue

        try:
            # Title
            title = str(component.get("SUMMARY", "")).strip()
            if not title:
                continue

            # Skip events covered by marta_board.py
            if _should_skip(title):
                logger.debug("MARTA Army: skipping (covered by marta_board): %r", title)
                continue

            # Parse start date/time
            dtstart = component.get("DTSTART")
            if not dtstart:
                continue

            dt_val = dtstart.dt
            if isinstance(dt_val, datetime):
                start_date = dt_val.strftime("%Y-%m-%d")
                start_time = dt_val.strftime("%H:%M")
                is_all_day = False
            elif isinstance(dt_val, date):
                start_date = dt_val.strftime("%Y-%m-%d")
                start_time = None
                is_all_day = True
            else:
                continue

            # Skip past events
            event_date = dt_val.date() if isinstance(dt_val, datetime) else dt_val
            if event_date < today:
                continue

            # Parse end date/time
            end_date = None
            end_time = None
            dtend = component.get("DTEND")
            if dtend:
                end_val = dtend.dt
                if isinstance(end_val, datetime):
                    end_date = end_val.strftime("%Y-%m-%d")
                    end_time = end_val.strftime("%H:%M")
                elif isinstance(end_val, date):
                    end_date = end_val.strftime("%Y-%m-%d")

            # Description
            raw_desc = str(component.get("DESCRIPTION", ""))
            description = _clean_ical_text(raw_desc)

            # Location
            location = _clean_ical_text(str(component.get("LOCATION", "")))

            # Source URL — prefer URL from the event, then from description
            source_url = str(component.get("URL", ""))
            if not source_url or source_url == "None":
                source_url = _extract_url_from_description(description) or EVENTS_PAGE

            # Ticket URL — use event-specific URL if available
            ticket_url = _extract_url_from_description(description)

            # Dedupe within run
            dedup_key = f"{title.lower()}|{start_date}"
            if dedup_key in seen:
                continue
            seen.add(dedup_key)

            events_found += 1

            # Build description with location context
            if location and location.lower() not in ("none", "online", "virtual", "tbd"):
                if location not in description:
                    description = f"{description}\n\nLocation: {location}" if description else f"Location: {location}"

            if not description or len(description) < 10:
                description = f"{title} — Transit community event curated by MARTA Army."

            # Tags
            extra_tags = _enrich_tags(title, description)
            tags = list(EVENT_TAGS) + extra_tags

            # Content hash
            content_hash = generate_content_hash(title, "MARTA Army", start_date)

            event_record = {
                "source_id": source_id,
                "place_id": venue_id,
                "title": title,
                "description": description[:1000],
                "start_date": start_date,
                "start_time": start_time,
                "end_date": end_date,
                "end_time": end_time,
                "is_all_day": is_all_day,
                "category": "community",
                "subcategory": None,
                "tags": tags,
                "price_min": None,
                "price_max": None,
                "price_note": None,
                "is_free": True,
                "source_url": source_url,
                "ticket_url": ticket_url,
                "image_url": None,
                "raw_text": f"{title} — {description[:200]}",
                "extraction_confidence": 0.90,
                "is_recurring": False,
                "recurrence_rule": None,
                "content_hash": content_hash,
            }

            existing = find_event_by_hash(content_hash)
            if existing:
                smart_update_existing_event(existing, event_record)
                events_updated += 1
                logger.debug("MARTA Army: updated: %s on %s", title, start_date)
                continue

            insert_event(event_record)
            events_new += 1
            logger.info("MARTA Army: added: %s on %s", title, start_date)

        except Exception as exc:
            logger.warning("MARTA Army: error processing event: %s", exc)
            continue

    logger.info(
        "MARTA Army crawl complete: %d found, %d new, %d updated",
        events_found,
        events_new,
        events_updated,
    )
    return events_found, events_new, events_updated
