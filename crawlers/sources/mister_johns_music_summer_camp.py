"""
Crawler for Mister John's Music Atlanta summer camp.

Official source:
https://misterjohnsmusic.com/summer-camp-atl/

Pattern role:
Static official summer-camp page with explicit themed weeks, visible dates,
hours, age band, price, and embedded first-party registration widget.
"""

from __future__ import annotations

import logging
import re
from datetime import date, datetime
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

SOURCE_URL = "https://misterjohnsmusic.com/summer-camp-atl/"

REQUEST_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/122.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml",
    "Accept-Language": "en-US,en;q=0.9",
}

VENUE_DATA = {
    "name": "Mister John's Music - Avondale Estates",
    "slug": "mister-johns-music-avondale-estates",
    "address": "6 Olive Street",
    "city": "Avondale Estates",
    "state": "GA",
    "zip": "30002",
    "lat": 33.7744,
    "lng": -84.2666,
    "neighborhood": "Avondale Estates",
    "venue_type": "studio",
    "spot_type": "studio",
    "website": "https://misterjohnsmusic.com/atlanta/",
    "vibes": ["family-friendly", "artsy", "all-ages"],
}

BASE_TAGS = [
    "kids",
    "family-friendly",
    "music",
    "arts",
    "camp",
    "rsvp-required",
]

YEAR_RE = re.compile(r"Summer Camp\s+(20\d{2})", re.IGNORECASE)
PRICE_RE = re.compile(r"\$([0-9]+(?:\.[0-9]{2})?)")
WEEK_RE = re.compile(
    r"Week\s+(?P<week>\d+):\s*"
    r"(?P<start_month>\d{1,2})/(?P<start_day>\d{1,2})\s*-\s*"
    r"(?P<end_month>\d{1,2})/(?P<end_day>\d{1,2})\s*[–-]\s*"
    r"(?P<title>.+?)(?=(?:Week\s+\d+:|Summer Camp is held|Register for Summer Camp|$))",
    re.IGNORECASE | re.DOTALL,
)


def _clean_text(value: Optional[str]) -> str:
    if not value:
        return ""
    replacements = {
        "\xa0": " ",
        "’": "'",
        "–": "-",
        "—": "-",
        "🍦": " ",
    }
    for old, new in replacements.items():
        value = value.replace(old, new)
    return re.sub(r"\s+", " ", value).strip()


def _age_band_tags(age_min: Optional[int], age_max: Optional[int]) -> list[str]:
    if age_min is None and age_max is None:
        return []
    tags: list[str] = []
    lo = age_min if age_min is not None else 0
    hi = age_max if age_max is not None else 18
    if lo <= 12 and hi >= 5:
        tags.append("elementary")
    if lo <= 13 and hi >= 10:
        tags.append("tween")
    return tags


def _extract_year(text: str) -> int:
    match = YEAR_RE.search(text)
    return int(match.group(1)) if match else datetime.now().year


def _extract_price_note(text: str) -> tuple[Optional[float], Optional[float], str]:
    price_matches = PRICE_RE.findall(text)
    weekly_price = float(price_matches[0]) if price_matches else None
    note = (
        "Camp runs 9am-3pm Monday through Friday. "
        "$425 per 5-day week; shorter weeks are prorated. "
        "Early arrival 8am +$50/week. Late pickup to 5pm +$100/week. "
        "Register via the embedded Enrollsy widget on the official page."
    )
    return weekly_price, weekly_price, note


def _derive_tags(title: str) -> list[str]:
    lowered = title.lower()
    tags = list(BASE_TAGS)
    if "taylor swift" in lowered:
        tags.extend(["pop", "taylor-swift"])
    if "witches" in lowered or "wizards" in lowered:
        tags.append("themed-camp")
    if "k pop" in lowered or "k-pop" in lowered:
        tags.extend(["k-pop", "themed-camp"])
    return list(dict.fromkeys(tags))


def _parse_weeks(html: str) -> list[dict]:
    soup = BeautifulSoup(html, "html.parser")
    text = _clean_text(soup.get_text(" ", strip=True))
    year = _extract_year(text)
    price_min, price_max, price_note = _extract_price_note(text)

    rows: list[dict] = []
    for match in WEEK_RE.finditer(text):
        title = _clean_text(match.group("title")).strip("- ")
        start_dt = datetime(year, int(match.group("start_month")), int(match.group("start_day")))
        end_dt = datetime(year, int(match.group("end_month")), int(match.group("end_day")))
        age_min, age_max = 5, 10

        description = (
            f"{title} is one themed week of Mister John's Music Summer Camp for ages 5 to 10. "
            "Campers get instrument instruction, show choir, visual arts, percussion, outdoor play, "
            "and an end-of-week performance showcase."
        )
        rows.append(
            {
                "title": f"Mister John's Music Summer Camp: {title}",
                "description": description,
                "source_url": SOURCE_URL,
                "ticket_url": SOURCE_URL,
                "start_date": start_dt.strftime("%Y-%m-%d"),
                "end_date": end_dt.strftime("%Y-%m-%d"),
                "start_time": "09:00",
                "end_time": "15:00",
                "is_all_day": False,
                "age_min": age_min,
                "age_max": age_max,
                "price_min": price_min,
                "price_max": price_max,
                "price_note": price_note,
                "tags": _derive_tags(title) + _age_band_tags(age_min, age_max),
            }
        )

    return rows


def _build_event_record(source_id: int, venue_id: int, row: dict) -> dict:
    title = f"{row['title']} at Mister John's Music"
    return {
        "source_id": source_id,
        "venue_id": venue_id,
        "title": title,
        "description": row["description"],
        "start_date": row["start_date"],
        "start_time": row["start_time"],
        "end_date": row["end_date"],
        "end_time": row["end_time"],
        "is_all_day": row["is_all_day"],
        "category": "programs",
        "subcategory": "camp",
        "class_category": "arts",
        "tags": row["tags"],
        "price_min": row["price_min"],
        "price_max": row["price_max"],
        "price_note": row["price_note"],
        "is_free": False,
        "source_url": row["source_url"],
        "ticket_url": row["ticket_url"],
        "image_url": None,
        "raw_text": f"{title} | {row['description']}",
        "extraction_confidence": 0.88,
        "is_recurring": False,
        "recurrence_rule": None,
        "content_hash": generate_content_hash(title, VENUE_DATA["name"], row["start_date"]),
        "age_min": row["age_min"],
        "age_max": row["age_max"],
    }


def crawl(source: dict) -> tuple[int, int, int]:
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        response = requests.get(SOURCE_URL, headers=REQUEST_HEADERS, timeout=30)
        response.raise_for_status()
        rows = _parse_weeks(response.text)
    except Exception as exc:
        logger.error("Mister John's Music Summer Camp: fetch failed: %s", exc)
        return 0, 0, 0

    today = date.today().strftime("%Y-%m-%d")
    venue_id = get_or_create_venue(VENUE_DATA)

    for row in rows:
        if row["end_date"] < today:
            continue
        try:
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
                "Mister John's Music Summer Camp: failed to process %s (%s): %s",
                row.get("title"),
                row.get("start_date"),
                exc,
            )

    return events_found, events_new, events_updated
