"""
Crawler for MJCCA Summer Day Camps.

Official sources:
https://www.mjccadaycamps.org/camps/
https://www.mjccadaycamps.org/register/

Pattern role:
Brand-owned summer camp search network with paginated session cards. Each public
card already exposes the camp title, week/date block, location, grades, type,
member/community pricing, short description, and detail page URL.
"""

from __future__ import annotations

import logging
import re
from datetime import date, datetime
from typing import Optional

import requests
from bs4 import BeautifulSoup, Tag

from db import (
    find_event_by_hash,
    get_or_create_venue,
    insert_event,
    smart_update_existing_event,
)
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://www.mjccadaycamps.org"
SOURCE_URL = f"{BASE_URL}/camps/"
REGISTER_URL = f"{BASE_URL}/register/"
AJAX_URL = f"{BASE_URL}/wp-admin/admin-ajax.php"
MAX_PAGES = 15
RESULTS_PER_PAGE = 20

REQUEST_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/122.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml",
    "Accept-Language": "en-US,en;q=0.9",
}

AJAX_HEADERS = {
    **REQUEST_HEADERS,
    "Origin": BASE_URL,
    "Referer": SOURCE_URL,
    "X-Requested-With": "XMLHttpRequest",
}

VENUE_DUNWOODY = {
    "name": "MJCCA Zaban Park Campus",
    "slug": "mjcca-zaban-park-campus",
    "address": "5342 Tilly Mill Rd",
    "city": "Dunwoody",
    "state": "GA",
    "zip": "30338",
    "neighborhood": "Dunwoody",
    "venue_type": "campus",
    "spot_type": "campus",
    "website": BASE_URL,
    "vibes": ["family-friendly", "outdoors"],
}

VENUE_INTOWN = {
    "name": "MJCCA Day Camps at Emory University",
    "slug": "mjcca-day-camps-emory-university",
    "address": "201 Dowman Dr",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30322",
    "neighborhood": "Druid Hills",
    "venue_type": "campus",
    "spot_type": "campus",
    "website": BASE_URL,
    "vibes": ["family-friendly", "educational"],
}

VENUE_EAST_COBB = {
    "name": "MJCCA Day Camps at Temple Kol Emeth",
    "slug": "mjcca-day-camps-temple-kol-emeth",
    "address": "1415 Old Canton Rd",
    "city": "Marietta",
    "state": "GA",
    "zip": "30062",
    "neighborhood": "East Cobb",
    "venue_type": "campus",
    "spot_type": "campus",
    "website": BASE_URL,
    "vibes": ["family-friendly", "educational"],
}

VENUE_WEBER = {
    "name": "The Weber School",
    "slug": "the-weber-school",
    "address": "3070 Tilly Mill Rd",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30360",
    "neighborhood": "Sandy Springs",
    "venue_type": "school",
    "spot_type": "school",
    "website": BASE_URL,
    "vibes": ["family-friendly", "educational"],
}

VENUE_MAP = {
    "dunwoody": VENUE_DUNWOODY,
    "intown": VENUE_INTOWN,
    "east cobb": VENUE_EAST_COBB,
    "weber": VENUE_WEBER,
}

BASE_TAGS = ["camp", "family-friendly", "rsvp-required", "seasonal"]

TITLE_PREFIX_RE = re.compile(r"^Week\s+\d+\s+[–-]\s*", re.IGNORECASE)
WEEK_RE = re.compile(
    r"Week\s+\d+:\s*(?P<start_month>\d{1,2})/(?P<start_day>\d{1,2})\s*-\s*"
    r"(?P<end_month>\d{1,2})/(?P<end_day>\d{1,2})",
    re.IGNORECASE,
)
PRICE_RE = re.compile(r"\$([\d,]+)")
GRADE_RANGE_RE = re.compile(
    r"(?P<start>Pre\s*-\s*K|Pre-K|Kindergarten|K|\d{1,2}(?:st|nd|rd|th))\s*-\s*"
    r"(?P<end>Pre\s*-\s*K|Pre-K|Kindergarten|K|\d{1,2}(?:st|nd|rd|th))",
    re.IGNORECASE,
)


def _clean_text(value: Optional[str]) -> str:
    if not value:
        return ""
    value = value.replace("\xa0", " ").replace("–", "-").replace("—", "-")
    return re.sub(r"\s+", " ", value).strip()


def _grade_token_to_age(token: str) -> Optional[int]:
    normalized = _clean_text(token).lower()
    if normalized in {"pre-k", "pre - k"}:
        return 4
    if normalized in {"kindergarten", "k"}:
        return 5
    match = re.match(r"(\d{1,2})", normalized)
    if match:
        return int(match.group(1)) + 5
    return None


def _parse_grade_range(value: str) -> tuple[Optional[int], Optional[int]]:
    match = GRADE_RANGE_RE.search(_clean_text(value))
    if not match:
        return None, None
    start = _grade_token_to_age(match.group("start"))
    end = _grade_token_to_age(match.group("end"))
    if start is None or end is None:
        return None, None
    return start, end


def _age_band_tags(age_min: Optional[int], age_max: Optional[int]) -> list[str]:
    if age_min is None and age_max is None:
        return []
    lo = age_min if age_min is not None else 0
    hi = age_max if age_max is not None else 18
    tags: list[str] = []
    if lo <= 5 and hi >= 3:
        tags.append("preschool")
    if lo <= 12 and hi >= 5:
        tags.append("elementary")
    if lo <= 13 and hi >= 10:
        tags.append("tween")
    if hi >= 13:
        tags.append("teen")
    return tags


def _class_category(type_text: str, title: str) -> str:
    combined = f"{type_text} {title}".lower()
    if any(word in combined for word in ["sports", "pickleball", "soccer", "basketball", "ninja", "athlete"]):
        return "fitness"
    if any(word in combined for word in ["performing arts", "art", "dance", "music", "theater"]):
        return "arts"
    if any(word in combined for word in ["tech", "steam", "science"]):
        return "education"
    return "mixed"


def _derive_tags(type_text: str, title: str, age_min: Optional[int], age_max: Optional[int]) -> list[str]:
    combined = f"{type_text} {title}".lower()
    tags = list(BASE_TAGS)

    if "camp isidore alterman" in combined:
        tags.append("outdoors")
    if "sports" in combined or any(word in combined for word in ["soccer", "basketball", "ninja", "pickleball"]):
        tags.extend(["sports", "movement"])
    if "performing arts" in combined or any(word in combined for word in ["art", "dance", "music", "theater"]):
        tags.append("arts")
    if "tech" in combined or any(word in combined for word in ["steam", "science", "minecraft", "robot"]):
        tags.append("stem")
    if "travel" in combined:
        tags.append("field-trips")

    tags.extend(_age_band_tags(age_min, age_max))
    return list(dict.fromkeys(tags))


def _parse_week_dates(value: str, year: int = 2026) -> tuple[str, str]:
    match = WEEK_RE.search(_clean_text(value))
    if not match:
        raise ValueError(f"Could not parse MJCCA week label: {value}")

    start_dt = datetime(
        year,
        int(match.group("start_month")),
        int(match.group("start_day")),
    )
    end_dt = datetime(
        year,
        int(match.group("end_month")),
        int(match.group("end_day")),
    )
    return start_dt.strftime("%Y-%m-%d"), end_dt.strftime("%Y-%m-%d")


def _resolve_venue(location_text: str) -> dict:
    lowered = _clean_text(location_text).lower()
    for key, venue in VENUE_MAP.items():
        if key in lowered:
            return venue
    return VENUE_DUNWOODY


def _extract_label_value(items: list[str], label: str) -> str:
    prefix = f"{label}:"
    for item in items:
        if item.startswith(prefix):
            return _clean_text(item.split(":", 1)[1])
    return ""


def _parse_price(value: str) -> Optional[float]:
    match = PRICE_RE.search(value)
    if not match:
        return None
    return float(match.group(1).replace(",", ""))


def _parse_card(box: Tag) -> Optional[dict]:
    title_node = box.select_one("h5")
    title = _clean_text(title_node.get_text(" ", strip=True) if title_node else "")
    if not title:
        return None

    normalized_title = TITLE_PREFIX_RE.sub("", title).replace("✪", "").strip()
    learn_link = None
    for anchor in box.select("a[href]"):
        href = anchor.get("href") or ""
        if "/camps/" in href and href.rstrip("/") != SOURCE_URL.rstrip("/"):
            learn_link = href
            break
    if not learn_link:
        return None

    info_items = [
        _clean_text(item.get_text(" ", strip=True))
        for item in box.select("div.info li")
        if _clean_text(item.get_text(" ", strip=True))
    ]
    type_text = _extract_label_value(info_items, "Type")
    location_text = _extract_label_value(info_items, "Location")
    grades_text = _extract_label_value(info_items, "Grades")
    dates_text = _extract_label_value(info_items, "Dates")
    member_fee = _parse_price(_extract_label_value(info_items, "Member Fee"))
    community_fee = _parse_price(_extract_label_value(info_items, "Community Fee"))

    if not dates_text:
        return None

    start_date, end_date = _parse_week_dates(dates_text)
    age_min, age_max = _parse_grade_range(grades_text)

    description = ""
    paragraphs = box.select("div.content p")
    if paragraphs:
        description = _clean_text(paragraphs[0].get_text(" ", strip=True)).replace("[…]", "").replace("[...]", "")

    venue = _resolve_venue(location_text)
    return {
        "title": normalized_title,
        "source_url": learn_link,
        "ticket_url": REGISTER_URL,
        "location_text": location_text,
        "type_text": type_text,
        "grades_text": grades_text,
        "start_date": start_date,
        "end_date": end_date,
        "age_min": age_min,
        "age_max": age_max,
        "price_min": member_fee,
        "price_max": community_fee,
        "price_note": "Member and community camp pricing shown on the official MJCCA Day Camps site.",
        "description": description or f"Official MJCCA Summer Day Camps session at {location_text or venue['name']}.",
        "class_category": _class_category(type_text, normalized_title),
        "tags": _derive_tags(type_text, normalized_title, age_min, age_max),
        "venue": venue,
        "hash_key": f"{normalized_title}|{dates_text}|{location_text}|{grades_text}",
    }


def _parse_page(html: str) -> list[dict]:
    soup = BeautifulSoup(html, "html.parser")
    rows: list[dict] = []
    for box in soup.select("div.camp-box"):
        parsed = _parse_card(box)
        if parsed:
            rows.append(parsed)
    return rows


def _fetch_ajax_page(session: requests.Session, offset: int) -> list[dict]:
    response = session.post(
        AJAX_URL,
        data={
            "action": "get_camps",
            "location": "",
            "grades": "",
            "dates": "",
            "types": "",
            "search": "",
            "offset": str(offset),
            "onPage": str(RESULTS_PER_PAGE),
        },
        headers=AJAX_HEADERS,
        timeout=30,
    )
    response.raise_for_status()
    return _parse_page(response.text)


def _fetch_rows() -> list[dict]:
    all_rows: list[dict] = []
    seen_hashes: set[str] = set()
    session = requests.Session()

    for page_num in range(MAX_PAGES):
        page_rows = _fetch_ajax_page(session, page_num * RESULTS_PER_PAGE)
        if not page_rows:
            break

        new_rows = 0
        for row in page_rows:
            if row["hash_key"] in seen_hashes:
                continue
            seen_hashes.add(row["hash_key"])
            all_rows.append(row)
            new_rows += 1

        if new_rows == 0:
            break

    all_rows.sort(key=lambda row: (row["start_date"], row["title"], row["hash_key"]))
    return all_rows


def _build_event_record(source_id: int, venue_id: int, row: dict) -> dict:
    title = f"{row['title']} at MJCCA Day Camps"
    description = row["description"]
    if row["location_text"]:
        description = f"{description} Location: {row['location_text']}."
    if row["grades_text"]:
        description = f"{description} Grades: {row['grades_text']}."
    if row["type_text"]:
        description = f"{description} Camp type: {row['type_text']}."

    return {
        "source_id": source_id,
        "venue_id": venue_id,
        "title": title,
        "description": description,
        "start_date": row["start_date"],
        "start_time": None,
        "end_date": row["end_date"],
        "end_time": None,
        "is_all_day": True,
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
        "raw_text": f"{title} | {description}",
        "extraction_confidence": 0.9,
        "is_recurring": False,
        "recurrence_rule": None,
        "content_hash": generate_content_hash(
            f"{title} [{row['hash_key']}]", row["venue"]["name"], row["start_date"]
        ),
        "age_min": row["age_min"],
        "age_max": row["age_max"],
    }


def crawl(source: dict) -> tuple[int, int, int]:
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        rows = _fetch_rows()
    except Exception as exc:
        logger.error("MJCCA Day Camps: fetch failed: %s", exc)
        return 0, 0, 0

    today = date.today().strftime("%Y-%m-%d")
    venue_cache: dict[str, int] = {}

    for row in rows:
        if row["end_date"] < today:
            continue
        try:
            venue_slug = row["venue"]["slug"]
            if venue_slug not in venue_cache:
                venue_cache[venue_slug] = get_or_create_venue(row["venue"])
            record = _build_event_record(source_id, venue_cache[venue_slug], row)
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
                "MJCCA Day Camps: failed to process %s (%s): %s",
                row.get("title"),
                row.get("start_date"),
                exc,
            )

    return events_found, events_new, events_updated
