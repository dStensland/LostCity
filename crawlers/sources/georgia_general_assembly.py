"""
Crawler for the Georgia General Assembly meetings schedule.

Official sources:
- https://www.legis.ga.gov/schedule/senate
- https://www.legis.ga.gov/api/meetings

This source provides official statewide legislative process visibility through:
- House committee meetings
- Senate committee meetings
- official chamber meeting schedule items
"""

from __future__ import annotations

import logging
import time
from datetime import date, datetime
from typing import Optional

import requests

from db import (
    find_event_by_hash,
    get_or_create_place,
    insert_event,
    remove_stale_source_events,
    smart_update_existing_event,
)
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

CANCEL_KEYWORDS = {"cancelled", "canceled", "postponed", "rescheduled"}

BASE_URL = "https://www.legis.ga.gov"
SCHEDULE_URL = f"{BASE_URL}/schedule/senate"
TOKEN_URL = f"{BASE_URL}/api/authentication/token"
MEETINGS_URL = f"{BASE_URL}/api/meetings"

# Public bootstrap key used by the official legislature frontend to request a short-lived
# bearer token for the meetings API. This is not a secret credential, but a client bootstrapping
# value shipped to browsers by the official site.
PUBLIC_TOKEN_KEY = (
    "7c1bf2beb1d922379c17181df20d8f3d3cc30e0cf828b2681b4b3305433453498d31807ac90cfc13"
    "d5b7c38f25134ed69626c0e932ee95e4e6b4132e263399ec"
)

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/145.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json, text/plain, */*",
    "Referer": SCHEDULE_URL,
}

PLACE_DATA = {
    "name": "Georgia General Assembly",
    "slug": "georgia-general-assembly",
    "address": "206 Washington St SW",
    "neighborhood": "Downtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30334",
    "lat": 33.7491,
    "lng": -84.3872,
    "place_type": "government",
    "spot_type": "government",
    "website": BASE_URL,
}


def _clean_text(value: str | None) -> str:
    return " ".join((value or "").split()).strip()


def _is_cancelled(subject: str, body: str) -> bool:
    text = f"{subject} {body}".lower()
    return any(keyword in text for keyword in CANCEL_KEYWORDS)


def _get_api_token(session: requests.Session) -> Optional[str]:
    params = {
        "key": PUBLIC_TOKEN_KEY,
        "ms": str(int(time.time() * 1000)),
    }
    try:
        response = session.get(TOKEN_URL, params=params, headers=HEADERS, timeout=30)
        response.raise_for_status()
        token = response.json()
    except requests.RequestException as exc:
        logger.error("Georgia General Assembly: failed fetching API token: %s", exc)
        return None
    except ValueError as exc:
        logger.error("Georgia General Assembly: invalid API token response: %s", exc)
        return None

    if not isinstance(token, str) or not token.strip():
        logger.error("Georgia General Assembly: missing token string in token response")
        return None
    return token.strip()


def _fetch_meetings(session: requests.Session, start_date: datetime) -> list[dict]:
    token = _get_api_token(session)
    if not token:
        return []

    headers = {**HEADERS, "Authorization": f"Bearer {token}"}
    params = {"startDate": start_date.strftime("%a %b %d %Y")}

    try:
        response = session.get(MEETINGS_URL, params=params, headers=headers, timeout=30)
        response.raise_for_status()
        payload = response.json()
    except requests.RequestException as exc:
        logger.error("Georgia General Assembly: failed fetching meetings: %s", exc)
        return []
    except ValueError as exc:
        logger.error("Georgia General Assembly: invalid meetings response: %s", exc)
        return []

    return payload if isinstance(payload, list) else []


def _chamber_label(value: object) -> str:
    if value == 1:
        return "House"
    if value == 2:
        return "Senate"
    return "General Assembly"


def _meeting_tags(chamber: str, subject: str, location: str) -> list[str]:
    tags = ["government", "public-meeting", "statewide", "legislature"]
    lowered_subject = subject.lower()
    lowered_location = location.lower()

    if chamber == "House":
        tags.append("house")
    elif chamber == "Senate":
        tags.append("senate")

    if "committee" in lowered_subject or "subcommittee" in lowered_subject:
        tags.append("committee")
    if "appropriations" in lowered_subject:
        tags.append("budget")
    if "election" in lowered_subject:
        tags.append("election")
    if "cap" in lowered_location or "clob" in lowered_location:
        tags.append("capitol")

    return sorted(set(tags))


def _normalize_meeting(raw: dict, today: date) -> Optional[dict]:
    start_raw = raw.get("start")
    subject = _clean_text(raw.get("subject"))
    if not start_raw or not subject:
        return None

    try:
        start_dt = datetime.fromisoformat(str(start_raw))
    except ValueError:
        return None

    if start_dt.date() < today:
        return None

    chamber = _chamber_label(raw.get("chamber"))
    location = _clean_text(raw.get("location")) or "Georgia State Capitol"
    body = _clean_text(raw.get("body"))
    if _is_cancelled(subject, body):
        return None
    agenda_uri = _clean_text(raw.get("agendaUri"))
    livestream_url = _clean_text(raw.get("livestreamUrl"))
    tags = _meeting_tags(chamber, subject, location)

    description_bits = [f"Official {chamber} meeting from the Georgia General Assembly schedule."]
    if location:
        description_bits.append(f"Location: {location}.")
    if raw.get("willBroadcast") and livestream_url:
        description_bits.append("Livestream available.")
    if body:
        description_bits.append(body)

    return {
        "title": f"{chamber}: {subject}",
        "start_date": start_dt.date().strftime("%Y-%m-%d"),
        "start_time": start_dt.strftime("%H:%M"),
        "end_time": None,
        "description": " ".join(description_bits),
        "source_url": agenda_uri or livestream_url or SCHEDULE_URL,
        "ticket_url": livestream_url or agenda_uri or SCHEDULE_URL,
        "image_url": None,
        "category": "civic",
        "subcategory": "government",
        "tags": tags,
        "is_free": True,
        "is_all_day": False,
    }


def _extract_meeting_events(payload: list[dict], today: date | None = None) -> list[dict]:
    now_date = today or datetime.now().date()
    events: list[dict] = []
    seen_keys: set[tuple[str, str, str]] = set()

    for item in payload:
        normalized = _normalize_meeting(item, now_date)
        if not normalized:
            continue
        dedupe_key = (
            normalized["title"],
            normalized["start_date"],
            normalized["start_time"] or "",
        )
        if dedupe_key in seen_keys:
            continue
        seen_keys.add(dedupe_key)
        events.append(normalized)

    return events


def crawl(source: dict) -> tuple[int, int, int]:
    source_id = source["id"]
    venue_id = get_or_create_place(PLACE_DATA)
    today = datetime.now().date()
    events_found = 0
    events_new = 0
    events_updated = 0

    session = requests.Session()
    payload = _fetch_meetings(session, datetime.now())
    if not payload:
        return 0, 0, 0

    parsed_events = _extract_meeting_events(payload, today=today)
    seen_hashes: set[str] = set()

    for event in parsed_events:
        content_hash = generate_content_hash(
            event["title"],
            PLACE_DATA["name"],
            event["start_date"],
        )
        seen_hashes.add(content_hash)

        event_record = {
            "title": event["title"],
            "description": event["description"],
            "start_date": event["start_date"],
            "end_date": event["start_date"],
            "start_time": event["start_time"],
            "end_time": event["end_time"],
            "source_url": event["source_url"],
            "ticket_url": event["ticket_url"],
            "image_url": event["image_url"],
            "place_id": venue_id,
            "source_id": source_id,
            "category": event["category"],
            "subcategory": event["subcategory"],
            "tags": event["tags"],
            "is_free": event["is_free"],
            "is_all_day": event["is_all_day"],
            "content_hash": content_hash,
        }

        existing = find_event_by_hash(content_hash)
        if existing:
            smart_update_existing_event(existing, event_record)
            events_updated += 1
        else:
            insert_event(event_record)
            events_new += 1

        events_found += 1

    remove_stale_source_events(source_id, seen_hashes)
    logger.info(
        "Georgia General Assembly: crawl complete: %s found, %s new, %s updated",
        events_found,
        events_new,
        events_updated,
    )
    return events_found, events_new, events_updated
