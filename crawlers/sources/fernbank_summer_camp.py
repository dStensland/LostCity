"""
Crawler for Fernbank Museum summer camp.

Official source:
https://fernbankmuseum.org/learn/community-programs/fernbank-camps/summer-camp/

Pattern role:
Official summer-camp landing page with a season-wide date window, stable age
bands, weekly schedule, and official CampSite enrollment link.
"""

from __future__ import annotations

import logging
import re
from datetime import date, datetime, timedelta
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

SOURCE_URL = "https://fernbankmuseum.org/learn/community-programs/fernbank-camps/summer-camp/"
ENROLL_URL = "https://fernbank.campmanagement.com/p/request_for_info_m.php?action=enroll"

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
    "name": "Fernbank Museum of Natural History",
    "slug": "fernbank-museum",
    "address": "767 Clifton Rd NE",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30307",
    "lat": 33.7741,
    "lng": -84.3282,
    "neighborhood": "Druid Hills",
    "venue_type": "museum",
    "spot_type": "museum",
    "website": "https://fernbankmuseum.org/",
    "vibes": ["family-friendly", "all-ages", "educational"],
}

BASE_TAGS = [
    "camp",
    "science",
    "nature",
    "museum",
    "family-friendly",
    "rsvp-required",
]

SEASON_RE = re.compile(
    r"([A-Za-z]+)\s+(\d{1,2})\s*[–-]\s*([A-Za-z]+)\s+(\d{1,2}),\s*(20\d{2})",
    re.IGNORECASE,
)
AGE_GROUP_RE = re.compile(r"ages?\s+(\d+)\s*-\s*(\d+)\s+and\s+ages?\s+(\d+)\s*-\s*(\d+)", re.I)
PRICE_RE = re.compile(r"\$([0-9]+)\s+for members;\s*\$([0-9]+)\s+for nonmembers", re.I)
EXTENDED_RE = re.compile(r"Extended care.*?\$([0-9]+)\s+for the week", re.I)


def _clean_text(value: Optional[str]) -> str:
    if not value:
        return ""
    value = value.replace("\xa0", " ").replace("–", "-").replace("—", "-")
    return re.sub(r"\s+", " ", value).strip()


def _age_band_tags(age_min: int, age_max: int) -> list[str]:
    tags: list[str] = []
    if age_min <= 12 and age_max >= 5:
        tags.append("elementary")
    if age_min <= 13 and age_max >= 8:
        tags.append("tween")
    return tags


def _week_ranges(start_date: str, end_date: str) -> list[tuple[str, str]]:
    current = datetime.strptime(start_date, "%Y-%m-%d")
    final = datetime.strptime(end_date, "%Y-%m-%d")
    ranges: list[tuple[str, str]] = []
    while current <= final:
        week_end = min(current + timedelta(days=4), final)
        ranges.append((current.strftime("%Y-%m-%d"), week_end.strftime("%Y-%m-%d")))
        current += timedelta(days=7)
    return ranges


def _parse_rows(html: str) -> list[dict]:
    soup = BeautifulSoup(html, "html.parser")
    text = _clean_text(soup.get_text(" ", strip=True))

    season_match = SEASON_RE.search(text)
    if not season_match:
        return []

    start_month, start_day, end_month, end_day, year = season_match.groups()
    season_start = datetime.strptime(f"{start_month} {start_day} {year}", "%B %d %Y").strftime("%Y-%m-%d")
    season_end = datetime.strptime(f"{end_month} {end_day} {year}", "%B %d %Y").strftime("%Y-%m-%d")

    age_match = AGE_GROUP_RE.search(text)
    if age_match:
        age_groups = [
            (int(age_match.group(1)), int(age_match.group(2))),
            (int(age_match.group(3)), int(age_match.group(4))),
        ]
    else:
        age_groups = [(5, 7), (8, 10)]

    price_match = PRICE_RE.search(text)
    member_price = float(price_match.group(1)) if price_match else 330.0
    public_price = float(price_match.group(2)) if price_match else 380.0
    extended_match = EXTENDED_RE.search(text)
    extended_price = float(extended_match.group(1)) if extended_match else 100.0

    description = (
        "Fernbank Summer Camp explores science and nature through themed daily activities and experiments. "
        "Themes repeat weekly on the official camp page, so families can choose the week that best fits their schedule."
    )
    price_note = (
        f"Members ${member_price:.0f}; nonmembers ${public_price:.0f}. "
        f"Extended care ${extended_price:.0f}/week from 8:15am to 5:30pm."
    )

    rows: list[dict] = []
    for week_start, week_end in _week_ranges(season_start, season_end):
        for age_min, age_max in age_groups:
            rows.append(
                {
                    "title": f"Fernbank Summer Camp (Ages {age_min}-{age_max})",
                    "description": description,
                    "source_url": SOURCE_URL,
                    "ticket_url": ENROLL_URL,
                    "start_date": week_start,
                    "end_date": week_end,
                    "start_time": "09:00",
                    "end_time": "16:00",
                    "is_all_day": False,
                    "age_min": age_min,
                    "age_max": age_max,
                    "price_min": member_price,
                    "price_max": public_price,
                    "price_note": price_note,
                    "tags": list(dict.fromkeys(BASE_TAGS + _age_band_tags(age_min, age_max))),
                }
            )

    return rows


def _build_event_record(source_id: int, venue_id: int, row: dict) -> dict:
    title = f"{row['title']} at Fernbank Museum"
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
        "class_category": "education",
        "tags": row["tags"],
        "price_min": row["price_min"],
        "price_max": row["price_max"],
        "price_note": row["price_note"],
        "is_free": False,
        "source_url": row["source_url"],
        "ticket_url": row["ticket_url"],
        "image_url": None,
        "raw_text": f"{title} | {row['description']}",
        "extraction_confidence": 0.83,
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
        rows = _parse_rows(response.text)
    except Exception as exc:
        logger.error("Fernbank Summer Camp: fetch failed: %s", exc)
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
                "Fernbank Summer Camp: failed to process %s (%s): %s",
                row.get("title"),
                row.get("start_date"),
                exc,
            )

    return events_found, events_new, events_updated
