"""
Crawler for Piedmont Healthcare Classes (classes.inquicker.com).

The public site is a React shell backed by the ClassFind API on
classfindapi.beryl.net. The structured occurrences payload already exposes
class titles, descriptions, dates, times, fees, venue data, and detail images,
so this crawler uses the API directly instead of scraping rendered page text.
"""

from __future__ import annotations

import logging
import re
from datetime import datetime
from typing import Optional

import requests

from db import (
    find_event_by_hash,
    get_or_create_place,
    get_portal_id_by_slug,
    insert_event,
    smart_update_existing_event,
)
from dedupe import generate_content_hash

# Portal ID for Piedmont-exclusive events
PORTAL_SLUG = "piedmont"

logger = logging.getLogger(__name__)

BASE_URL = "https://classes.inquicker.com"
API_BASE_URL = "https://classfindapi.beryl.net"
CLIENT_ID = 12422
LANGUAGE_CODE = "en-US"
CLASSES_URL = f"{BASE_URL}/?ClientID={CLIENT_ID}"
AUTH_URL = f"{API_BASE_URL}/api/v3/authenticate"
CATEGORIES_URL = f"{API_BASE_URL}/api/v3/categories/language/{LANGUAGE_CODE}"
OCCURRENCES_URL = f"{API_BASE_URL}/api/v4/occurrences"

REQUEST_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
    ),
    "Accept": "*/*",
    "Referer": f"{BASE_URL}/",
    "Origin": BASE_URL,
    "clientid": str(CLIENT_ID),
}

# Categories to crawl
CATEGORIES = [
    "Maternity Services",
    "Weight Loss & Nutrition",
    "Bone and Joint Health",
    "Community Education & Wellness",
    "Women's Health",
    "Support Groups",
    "Diabetes Health",
    "CPR and First Aid",
    "Virtual Classes",
]

# Category mappings
CATEGORY_MAP = {
    "Maternity Services": ("family", "maternity", ["maternity", "prenatal", "baby"]),
    "Weight Loss & Nutrition": ("wellness", "nutrition", ["nutrition", "weight-loss", "health"]),
    "Bone and Joint Health": ("wellness", "fitness", ["health", "orthopedic", "fitness"]),
    "Community Education & Wellness": ("learning", "health", ["health-education", "wellness"]),
    "Women's Health": ("wellness", "womens-health", ["womens-health", "health"]),
    "Support Groups": ("community", "support-group", ["support-group", "health"]),
    "Diabetes Health": ("wellness", "health", ["diabetes", "health-education"]),
    "CPR and First Aid": ("learning", "safety", ["cpr", "first-aid", "certification"]),
    "Virtual Classes": ("learning", "online", ["virtual", "online", "health"]),
}


def _request_headers(session_token: Optional[str] = None) -> dict[str, str]:
    headers = dict(REQUEST_HEADERS)
    if session_token:
        headers["sessiontoken"] = session_token
    return headers


def _authenticate_session(session: requests.Session) -> str:
    response = session.get(
        AUTH_URL,
        headers={**_request_headers(), "Content-Type": "application/json"},
        timeout=20,
    )
    response.raise_for_status()
    token = response.json().get("SessionToken")
    if not token:
        raise ValueError("Piedmont Classes auth did not return SessionToken")
    return token


def _fetch_category_ids(session: requests.Session, session_token: str) -> dict[str, int]:
    response = session.get(
        CATEGORIES_URL,
        headers=_request_headers(session_token),
        timeout=20,
    )
    response.raise_for_status()
    categories = response.json()
    return {
        item["CategoryName"]: item["CategoryId"]
        for item in categories
        if item.get("CategoryName") and item.get("CategoryId") is not None
    }


def _fetch_occurrences(
    session: requests.Session,
    session_token: str,
    category_id: int,
) -> list[dict]:
    response = session.post(
        OCCURRENCES_URL,
        headers={**_request_headers(session_token), "Content-Type": "application/json"},
        json={
            "NextOccurrence": True,
            "clientid": CLIENT_ID,
            "CategoryID": category_id,
            "Keyword": "",
            "LanguageCode": LANGUAGE_CODE,
        },
        timeout=30,
    )
    response.raise_for_status()
    return response.json() or []


def _parse_occurrence_datetime(raw: Optional[str]) -> tuple[Optional[str], Optional[str]]:
    if not raw:
        return None, None
    try:
        parsed = datetime.fromisoformat(str(raw).replace("Z", "+00:00"))
    except ValueError:
        return None, None
    return parsed.strftime("%Y-%m-%d"), parsed.strftime("%H:%M:%S")


def _build_detail_url(class_id: Optional[int], occurrence_id: Optional[str]) -> str:
    if class_id and occurrence_id:
        return (
            f"{BASE_URL}/details/?ClientID={CLIENT_ID}"
            f"&ClassID={class_id}&OccurrenceID={occurrence_id}&lang={LANGUAGE_CODE}"
        )
    return CLASSES_URL


def _slugify(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


def _build_description(occurrence: dict) -> Optional[str]:
    parts: list[str] = []
    for key in (
        "ClassDescription",
        "ParkingNotes",
        "SupplyNotes",
        "EnrolleeNotes",
        "ClosingNotes",
        "InclementWeatherPolicyMessage",
    ):
        value = occurrence.get(key)
        if not value:
            continue
        cleaned = " ".join(str(value).split())
        if cleaned and cleaned not in parts:
            parts.append(cleaned)
    if not parts:
        return None
    return " ".join(parts)[:2000]


def _get_or_create_class_venue(occurrence: dict) -> Optional[int]:
    business_name = occurrence.get("BusinessName")
    if not business_name:
        return None

    address_parts = [
        occurrence.get("AddressLineOne"),
        occurrence.get("AddressLineTwo"),
    ]
    address = ", ".join(part.strip() for part in address_parts if part and str(part).strip())

    place_data = {
        "name": business_name.strip(),
        "slug": _slugify(str(business_name)),
        "address": address or None,
        "city": occurrence.get("City") or "Atlanta",
        "state": occurrence.get("State") or "GA",
        "zip": occurrence.get("ZipCode") or "",
        "venue_type": "hospital",
        "website": "https://www.piedmont.org",
    }
    return get_or_create_place(place_data)


def crawl_category(
    session: requests.Session,
    session_token: str,
    category_name: str,
    category_id: int,
    source_id: int,
    portal_id: str,
) -> tuple[int, int, int]:
    """Crawl a single category from the ClassFind occurrences API."""
    events_found = 0
    events_new = 0
    events_updated = 0

    event_category, subcategory, base_tags = CATEGORY_MAP.get(
        category_name, ("learning", "health", ["health-education"])
    )

    occurrences = _fetch_occurrences(session, session_token, category_id)
    now_date = datetime.now().date()

    for occurrence in occurrences:
        title = occurrence.get("ClassName")
        start_date, start_time = _parse_occurrence_datetime(occurrence.get("StartDateTime"))
        end_date, end_time = _parse_occurrence_datetime(occurrence.get("EndDateTime"))
        if not title or not start_date:
            continue
        if datetime.strptime(start_date, "%Y-%m-%d").date() < now_date:
            continue

        venue_id = _get_or_create_class_venue(occurrence)
        venue_name = occurrence.get("BusinessName") or "Piedmont Healthcare"
        fee = occurrence.get("Fee")
        price_min = float(fee) if isinstance(fee, (int, float)) else None
        price_max = float(fee) if isinstance(fee, (int, float)) else None
        is_free = bool(price_min == 0.0 and price_max == 0.0)
        detail_url = _build_detail_url(occurrence.get("ClassID"), occurrence.get("OccurrenceID"))
        description = _build_description(occurrence)

        events_found += 1
        content_hash = generate_content_hash(title, venue_name, start_date)
        tags = ["piedmont", "healthcare", "class"] + base_tags
        room_name = occurrence.get("RoomName")
        days_held = occurrence.get("DaysHeld")

        event_record = {
            "source_id": source_id,
            "venue_id": venue_id,
            "portal_id": portal_id,
            "title": title,
            "description": description,
            "start_date": start_date,
            "start_time": start_time,
            "end_date": end_date,
            "end_time": end_time,
            "is_all_day": False,
            "category": event_category,
            "category_id": event_category,
            "subcategory": subcategory,
            "tags": tags,
            "price_min": price_min,
            "price_max": price_max,
            "price_note": occurrence.get("PaymentMethodNames") or "Registration required via Inquicker.",
            "is_free": is_free,
            "source_url": detail_url,
            "ticket_url": detail_url,
            "image_url": occurrence.get("PhotoUrl"),
            "raw_text": " | ".join(
                value
                for value in (
                    title,
                    days_held,
                    room_name,
                    occurrence.get("BusinessName"),
                )
                if value
            ),
            "extraction_confidence": 0.96,
            "is_recurring": False,
            "recurrence_rule": None,
            "content_hash": content_hash,
            "is_class": True,
            "class_category": subcategory,
        }

        existing = find_event_by_hash(content_hash)
        if existing:
            smart_update_existing_event(existing, event_record)
            events_updated += 1
            continue

        try:
            insert_event(event_record)
            events_new += 1
            logger.info("Added: %s on %s", title, start_date)
        except Exception as exc:
            logger.error("Failed to insert Piedmont class %s: %s", title, exc)

    return events_found, events_new, events_updated


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Piedmont classes from the ClassFind API."""
    source_id = source["id"]
    total_found = 0
    total_new = 0
    total_updated = 0

    portal_id = get_portal_id_by_slug(PORTAL_SLUG)

    try:
        with requests.Session() as session:
            session_token = _authenticate_session(session)
            category_ids = _fetch_category_ids(session, session_token)

            for category_name in CATEGORIES:
                category_id = category_ids.get(category_name)
                if category_id is None:
                    logger.warning("Piedmont category missing from API: %s", category_name)
                    continue
                try:
                    found, new, updated = crawl_category(
                        session,
                        session_token,
                        category_name,
                        category_id,
                        source_id,
                        portal_id,
                    )
                    total_found += found
                    total_new += new
                    total_updated += updated
                    logger.info("%s: %s found, %s new, %s updated", category_name, found, new, updated)
                except Exception as exc:
                    logger.error("Failed to crawl Piedmont category %s: %s", category_name, exc)
                    continue

        logger.info(
            "Piedmont Classes crawl complete: %s found, %s new, %s updated",
            total_found,
            total_new,
            total_updated,
        )

    except Exception as exc:
        logger.error("Failed to crawl Piedmont Classes: %s", exc)
        raise

    return total_found, total_new, total_updated
