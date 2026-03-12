"""
Crawler for Camp Invention Atlanta-metro programs.

Official sources:
https://www.invent.org/program-search
https://www.invent.org/program-search/camp-invention/ga22/11452

Pattern role:
Brand-owned program search surface with public teaser cards and server-rendered
detail pages for each local Camp Invention session.
"""

from __future__ import annotations

import json
import logging
import re
from datetime import date
from typing import Optional

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

SEARCH_URL = "https://www.invent.org/program-search"
BASE_URL = "https://www.invent.org"

REQUEST_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/122.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml",
    "Accept-Language": "en-US,en;q=0.9",
}

METRO_CITIES = {
    "Atlanta",
    "Alpharetta",
    "Brookhaven",
    "Decatur",
    "Duluth",
    "Johns Creek",
    "Marietta",
    "Roswell",
    "Smyrna",
}

BASE_TAGS = [
    "kids",
    "family-friendly",
    "camp",
    "rsvp-required",
    "education",
    "stem",
]

PROGRAM_CARD_RE = re.compile(
    r'<a href="(?P<href>/program-search/camp-invention/[^"]+)"[^>]*'
    r'class="program-teaser[^>]*>(?P<html>.*?)</a>',
    re.DOTALL,
)
DATE_RE = re.compile(
    r"(?P<start_month>[A-Za-z]+)\s+(?P<start_day>\d{1,2})-(?:(?P<end_month>[A-Za-z]+)\s+)?(?P<end_day>\d{1,2}),\s*(?P<year>20\d{2})"
)
GRADE_RANGE_RE = re.compile(
    r"grades?\s+(?P<first>K|\d+)\s*-\s*(?P<second>\d+)", re.IGNORECASE
)
TIME_RANGE_RE = re.compile(
    r"(?P<start>\d{1,2}:\d{2}\s*[AP]M)\s*-\s*(?P<end>\d{1,2}:\d{2}\s*[AP]M)",
    re.IGNORECASE,
)
PRICE_RE = re.compile(r"\$([0-9]+(?:\.[0-9]{2})?)")


def _clean_text(value: Optional[str]) -> str:
    if not value:
        return ""
    return re.sub(r"\s+", " ", value.replace("\xa0", " ")).strip()


def _slugify(value: str) -> str:
    cleaned = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return cleaned[:120]


def _decode_embedded_markup(value: str) -> str:
    replacements = [
        ("\\u003C", "<"),
        ("\\u003E", ">"),
        ("\\u0022", '"'),
        ("\\/", "/"),
        ("\\n", "\n"),
    ]
    for old, new in replacements:
        value = value.replace(old, new)
    return value


def _parse_search_rows(search_html: str) -> list[dict]:
    decoded = _decode_embedded_markup(search_html)
    rows: list[dict] = []

    for match in PROGRAM_CARD_RE.finditer(decoded):
        card = BeautifulSoup(match.group("html"), "html.parser")
        title_node = card.select_one(".program-teaser__title")
        date_node = card.select_one(".program-teaser__date")
        address_node = card.select_one(".program-teaser__address")
        if not (title_node and date_node and address_node):
            continue

        title = _clean_text(title_node.get_text(" ", strip=True))
        date_text = _clean_text(date_node.get_text(" ", strip=True))
        address_text = _clean_text(address_node.get_text(" ", strip=True))
        if not any(f"{city}, GA" in address_text for city in METRO_CITIES):
            continue

        rows.append(
            {
                "title": title,
                "date_text": date_text,
                "address_text": address_text,
                "detail_url": f"{BASE_URL}{match.group('href')}",
            }
        )

    return rows


def _parse_time_value(value: str) -> Optional[str]:
    cleaned = _clean_text(value).upper()
    match = re.match(r"(\d{1,2}):(\d{2})\s*(AM|PM)", cleaned)
    if not match:
        return None
    hour = int(match.group(1))
    minute = int(match.group(2))
    ampm = match.group(3)
    if ampm == "PM" and hour != 12:
        hour += 12
    if ampm == "AM" and hour == 12:
        hour = 0
    return f"{hour:02d}:{minute:02d}"


def _grade_token_to_age(token: str) -> Optional[int]:
    cleaned = _clean_text(token).upper()
    if cleaned == "K":
        return 5
    if cleaned.isdigit():
        return int(cleaned) + 5
    return None


def _age_band_tags(age_min: Optional[int], age_max: Optional[int]) -> list[str]:
    if age_min is None and age_max is None:
        return []
    lo = age_min if age_min is not None else 0
    hi = age_max if age_max is not None else 18
    tags: list[str] = []
    if lo <= 12 and hi >= 5:
        tags.append("elementary")
    if lo <= 13 and hi >= 10:
        tags.append("tween")
    return tags


def _parse_program_name(full_title: str) -> tuple[str, str]:
    if " - " not in full_title:
        return full_title, "Camp Invention"
    venue_name, program_name = full_title.split(" - ", 1)
    return venue_name.strip(), program_name.strip()


def _parse_detail_page(detail_html: str, detail_url: str) -> Optional[dict]:
    soup = BeautifulSoup(detail_html, "html.parser")

    event_data = None
    for script in soup.find_all("script", type="application/ld+json"):
        try:
            payload = json.loads(script.string or "")
        except Exception:
            continue
        graph = payload.get("@graph") if isinstance(payload, dict) else None
        if not isinstance(graph, list):
            continue
        for item in graph:
            if isinstance(item, dict) and item.get("@type") == "Event":
                event_data = item
                break
        if event_data:
            break

    if not event_data:
        return None

    note_texts = [
        _clean_text(node.get_text(" ", strip=True))
        for node in soup.select(".program__inner--body p")
        if _clean_text(node.get_text(" ", strip=True))
    ]
    if any("only accepting students that attend" in note.lower() for note in note_texts):
        return None

    info_texts = [
        _clean_text(node.get_text(" ", strip=True))
        for node in soup.select(".program__info--text, .program__info--strong")
        if _clean_text(node.get_text(" ", strip=True))
    ]
    info_blob = " ".join(info_texts)

    grades_match = GRADE_RANGE_RE.search(info_blob)
    age_min = _grade_token_to_age(grades_match.group("first")) if grades_match else None
    age_max = _grade_token_to_age(grades_match.group("second")) if grades_match else None

    time_match = TIME_RANGE_RE.search(info_blob)
    start_time = _parse_time_value(time_match.group("start")) if time_match else None
    end_time = _parse_time_value(time_match.group("end")) if time_match else None

    price_match = PRICE_RE.search(info_blob)
    price_value = float(price_match.group(1)) if price_match else None
    before_after_care = next(
        (note for note in note_texts if "before and after care" in note.lower()),
        None,
    )
    price_note = f"${price_value:.0f} camper price" if price_value is not None else None
    if before_after_care:
        price_note = (
            f"{price_note}. {before_after_care}" if price_note else before_after_care
        )

    register_link = soup.select_one("a.program__register")
    ticket_url = register_link["href"] if register_link and register_link.get("href") else detail_url

    location = event_data.get("location", {})
    address = location.get("address", {}) if isinstance(location, dict) else {}
    full_title = _clean_text(event_data.get("name"))
    venue_name, program_name = _parse_program_name(full_title)

    description_parts = [
        _clean_text(event_data.get("description")),
        before_after_care,
        next((note for note in note_texts if note.lower().startswith("please note:")), None),
    ]
    description = _clean_text(" ".join(part for part in description_parts if part))[:1000]
    tags = list(dict.fromkeys(BASE_TAGS + _age_band_tags(age_min, age_max) + ["science"]))

    venue_data = {
        "name": venue_name,
        "slug": _slugify(venue_name),
        "address": _clean_text(address.get("streetAddress")),
        "city": _clean_text(address.get("addressLocality")),
        "state": _clean_text(address.get("addressRegion")) or "GA",
        "zip": _clean_text(address.get("postalCode")),
        "neighborhood": _clean_text(address.get("addressLocality")),
        "venue_type": "institution",
        "spot_type": "education",
        "website": detail_url,
        "vibes": ["family-friendly", "educational"],
    }

    return {
        "title": f"{program_name} at {venue_name}",
        "source_url": detail_url,
        "ticket_url": ticket_url,
        "start_date": event_data.get("startDate"),
        "end_date": event_data.get("endDate"),
        "start_time": start_time,
        "end_time": end_time,
        "is_all_day": False,
        "age_min": age_min,
        "age_max": age_max,
        "price_min": price_value,
        "price_max": price_value,
        "price_note": price_note,
        "description": description,
        "tags": tags,
        "venue_data": venue_data,
    }


def _build_event_record(source_id: int, venue_id: int, row: dict) -> dict:
    return {
        "source_id": source_id,
        "venue_id": venue_id,
        "title": row["title"],
        "description": row["description"],
        "start_date": row["start_date"],
        "start_time": row["start_time"],
        "end_date": row["end_date"],
        "end_time": row["end_time"],
        "is_all_day": row["is_all_day"],
        "category": "programs",
        "subcategory": "camp",
        "class_category": "education",
        "tags": row["tags"],
        "price_min": row["price_min"],
        "price_max": row["price_max"],
        "price_note": row["price_note"],
        "is_free": False,
        "source_url": row["source_url"],
        "ticket_url": row["ticket_url"],
        "image_url": None,
        "raw_text": f"{row['title']} | {row['description']}",
        "extraction_confidence": 0.9,
        "is_recurring": False,
        "recurrence_rule": None,
        "content_hash": generate_content_hash(
            row["title"], row["venue_data"]["name"], row["start_date"]
        ),
        "age_min": row["age_min"],
        "age_max": row["age_max"],
    }


def crawl(source: dict) -> tuple[int, int, int]:
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    session = requests.Session()
    session.headers.update(REQUEST_HEADERS)

    try:
        search_response = session.get(SEARCH_URL, timeout=30)
        search_response.raise_for_status()
    except Exception as exc:
        logger.error("Camp Invention Atlanta: failed to fetch search page: %s", exc)
        return 0, 0, 0

    today = date.today().strftime("%Y-%m-%d")
    for listing in _parse_search_rows(search_response.text):
        try:
            detail_response = session.get(listing["detail_url"], timeout=30)
            detail_response.raise_for_status()
        except Exception as exc:
            logger.error(
                "Camp Invention Atlanta: failed to fetch detail page %s: %s",
                listing["detail_url"],
                exc,
            )
            continue

        row = _parse_detail_page(detail_response.text, listing["detail_url"])
        if not row or not row.get("end_date") or row["end_date"] < today:
            continue

        try:
            venue_id = get_or_create_venue(row["venue_data"])
            record = _build_event_record(source_id, venue_id, row)
            events_found += 1

            existing = find_event_by_hash(record["content_hash"])
            if existing:
                smart_update_existing_event(existing, record)
                events_updated += 1
            else:
                insert_event(record)
                events_new += 1
        except Exception as exc:
            logger.error(
                "Camp Invention Atlanta: failed to process %s (%s): %s",
                row.get("title"),
                row.get("start_date"),
                exc,
            )

    return events_found, events_new, events_updated
