"""
Crawler for DeKalb County Government Meetings via the Legistar REST API.

Source API: https://webapi.legistar.com/v1/dekalbcountyga/events
Calendar URL: https://dekalbcountyga.legistar.com/Calendar.aspx

The Legistar API returns structured JSON — no authentication required. Each
record includes body name, date, time, location, agenda status, agenda file
URL, and a canonical meeting detail URL (EventInSiteURL).

EventItems are fetched per-event to detect public comment opportunities.

Volume: approximately 6 meetings per month across all bodies.
"""

from __future__ import annotations

import logging
import re
from datetime import datetime, timedelta
from typing import Optional

import requests

from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

API_BASE = "https://webapi.legistar.com/v1/dekalbcountyga"
CALENDAR_URL = "https://dekalbcountyga.legistar.com/Calendar.aspx"
LOOKAHEAD_DAYS = 90

# Default meeting venue
DEFAULT_VENUE_DATA = {
    "name": "Manuel J. Maloof Auditorium",
    "slug": "manuel-j-maloof-auditorium",
    "address": "1300 Commerce Dr",
    "neighborhood": "Decatur",
    "city": "Decatur",
    "state": "GA",
    "zip": "30030",
    "lat": 33.7748,
    "lng": -84.2963,
    "venue_type": "community_center",
    "spot_type": "community_center",
    "website": "https://www.dekalbcountyga.gov",
}

# Body name substrings → cause tag. Checked case-insensitively.
BODY_CAUSE_MAP: list[tuple[str, str]] = [
    ("planning commission", "housing"),
    ("zoning board of appeals", "housing"),
    ("board of commissioners - zoning", "housing"),
    ("transportation committee", "transit"),
]

# Strings that indicate a meeting has been cancelled or postponed.
CANCEL_KEYWORDS = {"cancelled", "canceled", "postponed", "rescheduled"}


def _parse_legistar_datetime(date_str: str, time_str: str) -> tuple[Optional[str], Optional[str]]:
    """
    Parse Legistar EventDate and EventTime into (YYYY-MM-DD, HH:MM).

    EventDate arrives as ISO-8601: "2026-03-18T00:00:00"
    EventTime arrives as 12-hour clock: "9:30 AM", "1:00 PM", or "" when unknown.
    """
    parsed_date: Optional[str] = None
    parsed_time: Optional[str] = None

    if date_str:
        date_part = date_str.split("T")[0]
        try:
            dt = datetime.strptime(date_part, "%Y-%m-%d")
            parsed_date = dt.strftime("%Y-%m-%d")
        except ValueError:
            logger.debug("Could not parse EventDate: %s", date_str)

    if time_str:
        time_str = time_str.strip()
        match = re.match(r"(\d{1,2}):(\d{2})\s*(AM|PM)", time_str, re.IGNORECASE)
        if match:
            hour = int(match.group(1))
            minute = match.group(2)
            period = match.group(3).upper()
            if period == "PM" and hour != 12:
                hour += 12
            elif period == "AM" and hour == 12:
                hour = 0
            parsed_time = f"{hour:02d}:{minute}"

    return parsed_date, parsed_time


def _is_cancelled(event: dict) -> bool:
    """Return True if the event record indicates a cancellation."""
    status = (event.get("EventAgendaStatusName") or "").lower()
    if any(kw in status for kw in CANCEL_KEYWORDS):
        return True
    body = (event.get("EventBodyName") or "").lower()
    if any(kw in body for kw in CANCEL_KEYWORDS):
        return True
    comment = (event.get("EventComment") or "").lower()
    if any(kw in comment for kw in CANCEL_KEYWORDS):
        return True
    return False


def _has_public_comment(items: list[dict]) -> bool:
    """Return True if any agenda item title contains a public comment marker."""
    pattern = re.compile(r"public\s+comment|comment\s+from\s+the\s+public", re.IGNORECASE)
    for item in items:
        title = item.get("EventItemTitle") or ""
        if pattern.search(title):
            return True
    return False


def _cause_tag_for_body(body_name: str) -> Optional[str]:
    """Return a cause tag based on the meeting body name, or None."""
    body_lower = body_name.strip().lower()
    for pattern, tag in BODY_CAUSE_MAP:
        if pattern in body_lower:
            return tag
    return None


def _venue_id_for_location(location: str, default_id: int) -> int:
    """
    Return the default venue ID unless the location is materially different.
    If so, get-or-create a venue record for the alternate address.
    """
    if not location or not location.strip():
        return default_id

    loc = location.strip()
    if DEFAULT_VENUE_DATA["name"].lower() in loc.lower():
        return default_id
    if DEFAULT_VENUE_DATA["address"].lower() in loc.lower():
        return default_id

    slug = re.sub(r"[^a-z0-9]+", "-", loc[:60].lower()).strip("-")
    venue_data = {
        "name": loc[:100],
        "slug": slug,
        "address": loc,
        "city": "Decatur",
        "state": "GA",
        "venue_type": "community_center",
        "spot_type": "community_center",
        "website": "https://www.dekalbcountyga.gov",
    }
    try:
        return get_or_create_venue(venue_data)
    except Exception as exc:
        logger.warning("Could not create venue for location '%s': %s", loc, exc)
        return default_id


def _fetch_events(start_date: str, end_date: str) -> list[dict]:
    """Fetch upcoming events from the Legistar API for the given date window."""
    params = {
        "$filter": (
            f"EventDate ge datetime'{start_date}' "
            f"and EventDate le datetime'{end_date}'"
        ),
        "$orderby": "EventDate",
    }
    response = requests.get(f"{API_BASE}/events", params=params, timeout=30)
    response.raise_for_status()
    return response.json()


def _fetch_event_items(event_id: int) -> list[dict]:
    """Fetch agenda items for a single event. Returns empty list on failure."""
    try:
        response = requests.get(
            f"{API_BASE}/events/{event_id}/eventitems", timeout=15
        )
        if response.status_code == 200:
            return response.json()
    except requests.exceptions.RequestException as exc:
        logger.debug("Could not fetch items for event %s: %s", event_id, exc)
    return []


def _series_hint_for_body(body_name: str) -> dict:
    """Return a series_hint dict for a recurring government body."""
    return {
        "series_type": "recurring_show",
        "series_title": f"DeKalb County {body_name}",
        "frequency": "monthly",
    }


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl DeKalb County government meetings via the Legistar REST API."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    today = datetime.now().date()
    end_date = today + timedelta(days=LOOKAHEAD_DAYS)
    start_str = today.strftime("%Y-%m-%d")
    end_str = end_date.strftime("%Y-%m-%d")

    try:
        default_venue_id = get_or_create_venue(DEFAULT_VENUE_DATA)

        logger.info(
            "Fetching DeKalb Legistar events %s to %s", start_str, end_str
        )

        try:
            raw_events = _fetch_events(start_str, end_str)
        except requests.exceptions.RequestException as exc:
            logger.error("Failed to fetch DeKalb Legistar events: %s", exc)
            raise

        logger.info("Legistar returned %d events for DeKalb", len(raw_events))

        for event in raw_events:
            try:
                if _is_cancelled(event):
                    logger.debug(
                        "Skipping cancelled: %s", event.get("EventBodyName")
                    )
                    continue

                event_id = event.get("EventId")
                body_name = (event.get("EventBodyName") or "").strip()
                raw_date = event.get("EventDate") or ""
                raw_time = event.get("EventTime") or ""
                location = (event.get("EventLocation") or "").strip()
                agenda_file = (event.get("EventAgendaFile") or "").strip()
                agenda_status = (event.get("EventAgendaStatusName") or "").strip()
                # EventInSiteURL is the canonical meeting detail page
                detail_url = (event.get("EventInSiteURL") or "").strip() or CALENDAR_URL

                if not body_name or not raw_date:
                    continue

                start_date, start_time = _parse_legistar_datetime(raw_date, raw_time)
                if not start_date:
                    logger.debug("Could not parse date for event %s", event_id)
                    continue

                # Defensive past-event guard (API filter handles this, but be safe)
                try:
                    if datetime.strptime(start_date, "%Y-%m-%d").date() < today:
                        continue
                except ValueError:
                    continue

                # Build title
                title = body_name

                # Venue — use location-specific venue if meaningfully different
                venue_id = _venue_id_for_location(location, default_venue_id)
                venue_name_for_hash = (
                    location if location else DEFAULT_VENUE_DATA["name"]
                )

                events_found += 1

                # Fetch agenda items for public comment detection
                items = _fetch_event_items(event_id) if event_id else []
                has_public_comment = _has_public_comment(items)

                # Tags
                tags = [
                    "dekalb-county",
                    "government",
                    "public-meeting",
                    "civic-engagement",
                ]
                cause = _cause_tag_for_body(body_name)
                if cause:
                    tags.append(cause)
                if has_public_comment:
                    tags.append("public-comment")
                else:
                    tags.append("attend")

                # Description
                desc_parts = [
                    f"{body_name} meeting of DeKalb County Government.",
                ]
                if agenda_status:
                    desc_parts.append(f"Agenda status: {agenda_status}.")
                if location:
                    desc_parts.append(f"Location: {location}.")
                if has_public_comment:
                    desc_parts.append(
                        "Public comment is available at this meeting."
                    )
                else:
                    desc_parts.append(
                        "This meeting is open to the public."
                    )
                if agenda_file:
                    desc_parts.append(f"Agenda: {agenda_file}")
                description = " ".join(desc_parts)

                series_hint = _series_hint_for_body(body_name)
                content_hash = generate_content_hash(
                    title, venue_name_for_hash, start_date
                )

                event_record = {
                    "source_id": source_id,
                    "venue_id": venue_id,
                    "title": title,
                    "description": description,
                    "start_date": start_date,
                    "start_time": start_time,
                    "end_date": None,
                    "end_time": None,
                    "is_all_day": False,
                    "category": "community",
                    "subcategory": None,
                    "tags": tags,
                    "price_min": None,
                    "price_max": None,
                    "price_note": None,
                    "is_free": True,
                    "source_url": detail_url,
                    "ticket_url": None,
                    "image_url": None,
                    "raw_text": f"{title} | {start_date} | {location}",
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

                insert_event(event_record, series_hint=series_hint)
                events_new += 1
                logger.info("Added: %s on %s", title, start_date)

            except Exception as exc:
                logger.warning(
                    "Error processing DeKalb event %s: %s",
                    event.get("EventId"),
                    exc,
                )
                continue

        logger.info(
            "DeKalb County crawl complete: %d found, %d new, %d updated",
            events_found,
            events_new,
            events_updated,
        )

    except Exception as exc:
        logger.error("Failed to crawl DeKalb County meetings: %s", exc)
        raise

    return events_found, events_new, events_updated
