"""
Crawler for Girl Scouts of Greater Atlanta summer camps.

Official sources:
https://girlscoutsummer.com/wp-json/wp/v2/camp
https://girlscoutsummer.com/classic-specialty-camps/

Pattern role:
Official camp network using public WordPress REST camp inventory plus public
detail pages with session tables.
"""

from __future__ import annotations

import html
import logging
import re
from datetime import date, datetime
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

API_URL = "https://girlscoutsummer.com/wp-json/wp/v2/camp?per_page=100"
TERM_CATEGORY_URL = "https://girlscoutsummer.com/wp-json/wp/v2/categories?per_page=100"
TERM_LOCATION_URL = "https://girlscoutsummer.com/wp-json/wp/v2/camp-location?per_page=100"
BASE_URL = "https://girlscoutsummer.com/"

REQUEST_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/122.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/json",
    "Accept-Language": "en-US,en;q=0.9",
}

TIMBER_RIDGE_VENUE = {
    "name": "Camp Timber Ridge",
    "slug": "camp-timber-ridge",
    "address": "5540 N Allen Rd SE",
    "city": "Mableton",
    "state": "GA",
    "zip": "30126",
    "neighborhood": "Mableton",
    "place_type": "outdoor_venue",
    "spot_type": "park",
    "website": "https://girlscoutsummer.com/timber-ridge-camp/",
    "vibes": ["family-friendly", "all-ages"],
}

MERIWETHER_VENUE = {
    "name": "Camp Meriwether",
    "slug": "camp-meriwether",
    "address": "653 Meadows Boone Rd",
    "city": "Luthersville",
    "state": "GA",
    "zip": "30251",
    "neighborhood": "Luthersville",
    "place_type": "outdoor_venue",
    "spot_type": "park",
    "website": "https://girlscoutsummer.com/meriwether-camp/",
    "vibes": ["family-friendly", "all-ages"],
}

BASE_TAGS = [
    "kids",
    "family-friendly",
    "camp",
    "rsvp-required",
    "outdoors",
]

PRICE_RE = re.compile(r"\$ ?([0-9]+(?:\.[0-9]{2})?)")

LEVEL_AGE_MAP = {
    "daisy": (5, 6, ["elementary"]),
    "brownie": (7, 8, ["elementary"]),
    "junior": (9, 10, ["elementary", "tween"]),
    "cadette": (11, 13, ["tween"]),
    "senior": (14, 15, ["teen"]),
    "ambassador": (16, 17, ["teen"]),
}

LEADERSHIP_AGE_MAP = [
    ("program aide", (11, 13, ["tween"])),
    ("future leader", (12, 14, ["tween", "teen"])),
    ("future leaders", (12, 14, ["tween", "teen"])),
    ("flit", (12, 14, ["tween", "teen"])),
    ("cit i", (14, 16, ["teen"])),
    ("counselor in training i", (14, 16, ["teen"])),
    ("cit ii", (15, 17, ["teen"])),
    ("counselor-in-training ii", (15, 17, ["teen"])),
    ("counselor in training ii", (15, 17, ["teen"])),
    ("wit", (15, 17, ["teen"])),
    ("wrangler in training", (15, 17, ["teen"])),
]


def _clean_text(value: Optional[str]) -> str:
    if not value:
        return ""
    return re.sub(r"\s+", " ", html.unescape(value).replace("\xa0", " ")).strip()


def _parse_json(session: requests.Session, url: str) -> list[dict]:
    response = session.get(url, timeout=30)
    response.raise_for_status()
    return response.json()


def _build_term_lookup(items: list[dict]) -> dict[int, dict]:
    return {item["id"]: item for item in items}


def _age_data_from_title(title: str) -> tuple[Optional[int], Optional[int], list[str]]:
    lowered = title.lower()
    for level, (age_min, age_max, tags) in LEVEL_AGE_MAP.items():
        if lowered.startswith(level):
            return age_min, age_max, list(tags)
    for needle, payload in LEADERSHIP_AGE_MAP:
        if needle in lowered:
            age_min, age_max, tags = payload
            return age_min, age_max, list(tags)
    return None, None, []


def _derive_tags(title: str, category_slug: str, duration_text: str, location_slug: str) -> list[str]:
    lowered = title.lower()
    tags = list(BASE_TAGS)
    if category_slug == "leadership":
        tags.extend(["leadership", "skills"])
    elif category_slug == "specialty":
        tags.append("specialty")
    elif category_slug == "classic":
        tags.append("classic-camp")

    if "horse" in lowered or "equestrian" in lowered or "pony" in lowered:
        tags.append("horseback")
    if "art" in lowered:
        tags.append("arts")
    if "science" in lowered or "stem" in lowered or "beakers" in lowered:
        tags.append("stem")
    if "wild" in lowered or "survivor" in lowered:
        tags.append("nature")
    if "sleepaway" in duration_text.lower() or "sleepaway" in location_slug:
        tags.append("sleepaway")
    if "day camp" in duration_text.lower() or "day" in location_slug:
        tags.append("day-camp")

    _, _, age_tags = _age_data_from_title(title)
    tags.extend(age_tags)
    return list(dict.fromkeys(tags))


def _parse_session_table(soup: BeautifulSoup) -> list[dict]:
    table = soup.find("table")
    if not table:
        return []
    rows: list[dict] = []
    for tr in table.find_all("tr")[1:]:
        cells = [td.get_text(" ", strip=True) for td in tr.find_all("td")]
        if len(cells) < 4:
            continue
        try:
            start_dt = datetime.strptime(_clean_text(cells[0]), "%m/%d/%Y")
            end_dt = datetime.strptime(_clean_text(cells[1]), "%m/%d/%Y")
        except ValueError:
            continue
        duration_text = _clean_text(cells[2])
        price_match = PRICE_RE.search(cells[3])
        price_value = float(price_match.group(1)) if price_match else None
        rows.append(
            {
                "start_date": start_dt.strftime("%Y-%m-%d"),
                "end_date": end_dt.strftime("%Y-%m-%d"),
                "duration_text": duration_text,
                "price_min": price_value,
                "price_max": price_value,
                "price_note": f"${price_value:.0f}" if price_value is not None else None,
            }
        )
    return rows


def _extract_detail_page_fields(detail_html: str) -> dict:
    soup = BeautifulSoup(detail_html, "html.parser")
    title_node = soup.find("h1")
    description = ""
    cost_text = None
    location_names: list[str] = []

    for inner in soup.select(".et_pb_text_inner"):
        text = _clean_text(inner.get_text(" ", strip=True))
        if not text:
            continue
        if text.startswith("Cost "):
            cost_text = text
        elif text == "Available at the Following Camp Location(s)":
            continue
        elif text in {"Timber Ridge Day Camp", "Timber Ridge Sleepaway", "Camp Meriwether", "Meriwether Sleepaway"}:
            location_names.append(text)
        elif not description and len(text) > 80:
            description = text

    title = _clean_text(title_node.get_text(" ", strip=True) if title_node else "")
    return {
        "title": title,
        "description": description,
        "cost_text": cost_text,
        "location_names": location_names,
        "sessions": _parse_session_table(soup),
    }


def _resolve_venue(term_ids: list[int], location_lookup: dict[int, dict], duration_text: str) -> dict:
    term_slugs = [location_lookup[term_id]["slug"] for term_id in term_ids if term_id in location_lookup]
    duration_lower = duration_text.lower()
    if any("meriwether" in slug for slug in term_slugs):
        return MERIWETHER_VENUE
    if any("timber-ridge" in slug for slug in term_slugs):
        return TIMBER_RIDGE_VENUE
    if "sleepaway" in duration_lower or "day camp" in duration_lower:
        if any(term_id in location_lookup for term_id in term_ids):
            names = " ".join(location_lookup[term_id]["name"] for term_id in term_ids if term_id in location_lookup)
            if "meriwether" in names.lower():
                return MERIWETHER_VENUE
    return TIMBER_RIDGE_VENUE


def _build_rows(
    item: dict,
    detail_fields: dict,
    category_lookup: dict[int, dict],
    location_lookup: dict[int, dict],
) -> list[dict]:
    title = _clean_text(item["title"]["rendered"])
    category_slug = ""
    if item.get("categories"):
        category = category_lookup.get(item["categories"][0])
        category_slug = category["slug"] if category else ""

    age_min, age_max, _ = _age_data_from_title(title)
    rows: list[dict] = []
    for session_row in detail_fields["sessions"]:
        place_data = _resolve_venue(item.get("camp-location", []), location_lookup, session_row["duration_text"])
        tags = _derive_tags(title, category_slug, session_row["duration_text"], place_data["slug"])
        description = detail_fields["description"]
        if session_row["duration_text"]:
            description = _clean_text(f"{description} {session_row['duration_text']}")[:1000]
        rows.append(
                {
                    "title": title,
                    "description": description,
                    "source_url": item["link"],
                    "ticket_url": "https://girlscoutsummer.com/register/",
                "start_date": session_row["start_date"],
                "end_date": session_row["end_date"],
                "start_time": None,
                "end_time": None,
                "is_all_day": True,
                "age_min": age_min,
                "age_max": age_max,
                "price_min": session_row["price_min"],
                "price_max": session_row["price_max"],
                "price_note": _clean_text(
                    " ".join(
                        part
                        for part in [
                            detail_fields["cost_text"],
                            session_row["duration_text"],
                        ]
                        if part
                    )
                )
                or session_row["price_note"],
                "tags": tags,
                "class_category": "mixed" if category_slug != "leadership" else "education",
                "venue_data": place_data,
            }
        )
    return rows


def _build_event_record(source_id: int, venue_id: int, row: dict) -> dict:
    title = f"{row['title']} at {row['venue_data']['name']}"
    return {
        "source_id": source_id,
        "place_id": venue_id,
        "title": title,
        "description": row["description"],
        "start_date": row["start_date"],
        "start_time": row["start_time"],
        "end_date": row["end_date"],
        "end_time": row["end_time"],
        "is_all_day": row["is_all_day"],
        "category": "programs",
        "subcategory": "camp",
        "class_category": row["class_category"],
        "tags": row["tags"],
        "price_min": row["price_min"],
        "price_max": row["price_max"],
        "price_note": row["price_note"],
        "is_free": False,
        "source_url": row["source_url"],
        "ticket_url": row["ticket_url"],
        "image_url": None,
        "raw_text": f"{title} | {row['description']}",
        "extraction_confidence": 0.9,
        "is_recurring": False,
        "recurrence_rule": None,
        "content_hash": generate_content_hash(title, row["venue_data"]["name"], row["start_date"]),
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
        items = _parse_json(session, API_URL)
        category_lookup = _build_term_lookup(_parse_json(session, TERM_CATEGORY_URL))
        location_lookup = _build_term_lookup(_parse_json(session, TERM_LOCATION_URL))
    except Exception as exc:
        logger.error("Girl Scouts Greater Atlanta Camps: failed to fetch API inventory: %s", exc)
        return 0, 0, 0

    today = date.today().strftime("%Y-%m-%d")
    for item in items:
        try:
            detail_response = session.get(item["link"], timeout=30)
            detail_response.raise_for_status()
            detail_fields = _extract_detail_page_fields(detail_response.text)
            rows = _build_rows(item, detail_fields, category_lookup, location_lookup)
        except Exception as exc:
            logger.error(
                "Girl Scouts Greater Atlanta Camps: failed to parse %s: %s",
                item.get("link"),
                exc,
            )
            continue

        for row in rows:
            try:
                if row["end_date"] < today:
                    continue
                venue_id = get_or_create_place(row["venue_data"])
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
                    "Girl Scouts Greater Atlanta Camps: failed to process %s (%s): %s",
                    row.get("title"),
                    row.get("start_date"),
                    exc,
                )

    return events_found, events_new, events_updated
