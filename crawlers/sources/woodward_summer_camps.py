"""
Crawler for Woodward Academy summer camps.

Official sources:
https://www.woodward.edu/summer/camps
https://docs.google.com/spreadsheets/d/1q53GUbWFOccQEHdlw85PdT2gpyxwzfvSbE1nxWB7OAw/

Pattern role:
Official school summer-hub page that publishes weekly public Google Sheet
exports for camp inventory by week.
"""

from __future__ import annotations

import csv
import io
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

SOURCE_URL = "https://www.woodward.edu/summer/camps"
REGISTER_URL = "https://woodward.campbrainregistration.com/"
SHEET_ID = "1q53GUbWFOccQEHdlw85PdT2gpyxwzfvSbE1nxWB7OAw"
SHEET_URL = f"https://docs.google.com/spreadsheets/d/{SHEET_ID}/edit?usp=sharing"

REQUEST_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/122.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,text/csv",
    "Accept-Language": "en-US,en;q=0.9",
}

VENUE_MAIN = {
    "name": "Woodward Academy - Main Campus",
    "slug": "woodward-academy-main-campus",
    "address": "1662 Rugby Ave",
    "city": "College Park",
    "state": "GA",
    "zip": "30337",
    "neighborhood": "College Park",
    "venue_type": "school",
    "spot_type": "school",
    "website": "https://www.woodward.edu/summer",
    "vibes": ["family-friendly", "all-ages"],
}

VENUE_NORTH = {
    "name": "Woodward Academy - Woodward North",
    "slug": "woodward-academy-woodward-north",
    "address": "6565 Boles Rd",
    "city": "Johns Creek",
    "state": "GA",
    "zip": "30097",
    "neighborhood": "Johns Creek",
    "venue_type": "school",
    "spot_type": "school",
    "website": "https://www.woodward.edu/summer",
    "vibes": ["family-friendly", "all-ages"],
}

BASE_TAGS = ["camp", "family-friendly", "rsvp-required"]

WEEK_LINK_RE = re.compile(
    r"https://docs\.google\.com/spreadsheets/d/"
    + re.escape(SHEET_ID)
    + r"/edit\?gid=(\d+)#gid=\1"
)
WEEK_HEADER_RE = re.compile(
    r"Week\s+\d+(?::|\s+\()?\s*(?P<start_month>[A-Za-z]+)\s+(?P<start_day>\d{1,2})\s*-\s*"
    r"(?P<end_month>[A-Za-z]+)?\s*(?P<end_day>\d{1,2})\)?",
    re.IGNORECASE,
)
GRADES_RE = re.compile(r"([PKK]|\d+)\s+to\s+([PKK]|\d+)", re.IGNORECASE)
FULL_DAY_WINDOW = ("07:30", "16:00")


def _clean_text(value: Optional[str]) -> str:
    if not value:
        return ""
    value = value.replace("\xa0", " ").replace("–", "-").replace("—", "-")
    return re.sub(r"\s+", " ", value).strip()


def _parse_week_links(html: str) -> list[tuple[str, str]]:
    soup = BeautifulSoup(html, "html.parser")
    links: list[tuple[str, str]] = []
    for anchor in soup.find_all("a", href=True):
        href = anchor["href"]
        text = _clean_text(anchor.get_text(" ", strip=True))
        match = WEEK_LINK_RE.match(href)
        if not match or not text.startswith("Week "):
            continue
        gid = match.group(1)
        export_url = f"https://docs.google.com/spreadsheets/d/{SHEET_ID}/export?format=csv&gid={gid}"
        links.append((text, export_url))
    return links


def _grade_to_age(value: str) -> int:
    normalized = value.upper()
    if normalized in {"P", "PRE-K", "PK"}:
        return 4
    if normalized == "K":
        return 5
    return int(normalized) + 5


def _parse_grade_range(value: str) -> tuple[Optional[int], Optional[int]]:
    match = GRADES_RE.search(_clean_text(value))
    if not match:
        return None, None
    return _grade_to_age(match.group(1)), _grade_to_age(match.group(2))


def _age_band_tags(age_min: Optional[int], age_max: Optional[int]) -> list[str]:
    if age_min is None and age_max is None:
        return []
    lo = age_min if age_min is not None else 0
    hi = age_max if age_max is not None else 18
    tags: list[str] = []
    if lo <= 12 and hi >= 5:
        tags.append("elementary")
    if lo <= 14 and hi >= 10:
        tags.append("tween")
    if hi >= 13:
        tags.append("teen")
    return tags


def _derive_tags(title: str, location: str) -> list[str]:
    lowered = title.lower()
    tags = list(BASE_TAGS)
    if "main campus" in location.lower():
        tags.append("main-campus")
    if "north campus" in location.lower():
        tags.append("north-campus")
    if "athletic" in lowered or any(
        keyword in lowered
        for keyword in ["soccer", "football", "tennis", "track", "basketball", "swim", "diving", "sports"]
    ):
        tags.extend(["sports", "movement"])
    if any(keyword in lowered for keyword in ["math", "coding", "steam", "science", "robot", "chess"]):
        tags.append("stem")
    if any(keyword in lowered for keyword in ["dance", "theatre", "storybook", "art", "cuisine", "sew"]):
        tags.append("arts")
    if "bike" in lowered:
        tags.append("outdoors")
    return list(dict.fromkeys(tags))


def _class_category(title: str) -> str:
    lowered = title.lower()
    if any(keyword in lowered for keyword in ["soccer", "football", "tennis", "track", "basketball", "swim", "diving", "sports", "bike"]):
        return "fitness"
    if any(keyword in lowered for keyword in ["math", "coding", "steam", "science", "robot", "chess"]):
        return "education"
    if any(keyword in lowered for keyword in ["dance", "theatre", "art", "cuisine", "sew", "storybook"]):
        return "arts"
    return "education"


def _parse_week_dates(heading: str, year: int = 2026) -> tuple[str, str]:
    match = WEEK_HEADER_RE.search(_clean_text(heading))
    if not match:
        raise ValueError(f"Could not parse Woodward week header: {heading}")
    start_month = match.group("start_month")
    end_month = match.group("end_month") or start_month
    start_day = int(match.group("start_day"))
    end_day = int(match.group("end_day"))
    start_dt = datetime.strptime(f"{start_month} {start_day} {year}", "%B %d %Y")
    end_dt = datetime.strptime(f"{end_month} {end_day} {year}", "%B %d %Y")
    return start_dt.strftime("%Y-%m-%d"), end_dt.strftime("%Y-%m-%d")


def _parse_csv_rows(week_heading: str, csv_text: str, source_url: str) -> list[dict]:
    start_date, end_date = _parse_week_dates(week_heading)
    reader = csv.DictReader(io.StringIO(csv_text))
    rows: list[dict] = []
    for record in reader:
        normalized_record = {_clean_text(key): value for key, value in record.items() if key}
        title = _clean_text(normalized_record.get("Camp Name"))
        location = _clean_text(normalized_record.get("Location"))
        grades = _clean_text(normalized_record.get("Grades"))
        director = _clean_text(normalized_record.get("Director"))
        if not title or title.startswith("Week "):
            continue
        lowered_title = title.lower()
        is_full_day = "full day" in lowered_title
        age_min, age_max = _parse_grade_range(grades)
        rows.append(
            {
                "title": f"Woodward Summer Camp: {title}",
                "description": (
                    f"Woodward Academy summer camp at {location}. "
                    f"Director: {director or 'Woodward summer staff'}. Grades: {grades or 'see official sheet'}."
                ),
                "source_url": source_url,
                "ticket_url": REGISTER_URL,
                "start_date": start_date,
                "end_date": end_date,
                "start_time": FULL_DAY_WINDOW[0] if is_full_day else None,
                "end_time": FULL_DAY_WINDOW[1] if is_full_day else None,
                "is_all_day": is_full_day,
                "age_min": age_min,
                "age_max": age_max,
                "price_min": None,
                "price_max": None,
                "price_note": "See official Woodward registration flow for tuition and after-care pricing.",
                "location_name": location,
                "class_category": _class_category(title),
                "tags": _derive_tags(title, location) + _age_band_tags(age_min, age_max),
            }
        )
    return rows


def _parse_rows(landing_html: str, csv_map: dict[str, str]) -> list[dict]:
    rows: list[dict] = []
    for week_heading, export_url in _parse_week_links(landing_html):
        csv_text = csv_map.get(export_url)
        if not csv_text:
            continue
        sheet_url = export_url.replace("/export?format=csv", "/edit").replace("&gid=", "?gid=")
        rows.extend(_parse_csv_rows(week_heading, csv_text, sheet_url))
    rows.sort(key=lambda row: (row["start_date"], row["title"]))
    return rows


def _build_event_record(source_id: int, venue_id: int, row: dict) -> dict:
    title = f"{row['title']} at Woodward Academy"
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
        "extraction_confidence": 0.88,
        "is_recurring": False,
        "recurrence_rule": None,
        "content_hash": generate_content_hash(title, row["location_name"], row["start_date"]),
        "age_min": row["age_min"],
        "age_max": row["age_max"],
    }


def crawl(source: dict) -> tuple[int, int, int]:
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        landing_html = requests.get(SOURCE_URL, headers=REQUEST_HEADERS, timeout=30).text
        csv_map: dict[str, str] = {}
        for _, export_url in _parse_week_links(landing_html):
            response = requests.get(export_url, headers=REQUEST_HEADERS, timeout=30)
            if response.ok:
                csv_map[export_url] = response.text
        rows = _parse_rows(landing_html, csv_map)
    except Exception as exc:
        logger.error("Woodward Summer Camps: fetch failed: %s", exc)
        return 0, 0, 0

    today = date.today().strftime("%Y-%m-%d")
    main_venue_id = get_or_create_venue(VENUE_MAIN)
    north_venue_id = get_or_create_venue(VENUE_NORTH)

    for row in rows:
        if row["end_date"] < today:
            continue
        venue_id = north_venue_id if "north campus" in row["location_name"].lower() else main_venue_id
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
                "Woodward Summer Camps: failed to process %s (%s): %s",
                row.get("title"),
                row.get("start_date"),
                exc,
            )

    return events_found, events_new, events_updated
