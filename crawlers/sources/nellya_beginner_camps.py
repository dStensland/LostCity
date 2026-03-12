"""
Crawler for Nellya Fencers Club beginner camps.

Official source:
https://www.nellyafencers.com/camps-parties/

Pattern role:
Official camp-page implementation using visible beginner-camp week rows with
shared price and official registration.
"""

from __future__ import annotations

import logging
import re
from datetime import date, datetime
from typing import Optional

import requests
from bs4 import BeautifulSoup

from db import find_event_by_hash, get_or_create_venue, insert_event, smart_update_existing_event
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

SOURCE_URL = "https://www.nellyafencers.com/camps-parties/"

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
    "name": "Nellya Fencers Club",
    "slug": "nellya-fencers-club",
    "address": "1530 Carroll Drive NW #104",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30318",
    "neighborhood": "Upper Westside",
    "venue_type": "fitness_center",
    "spot_type": "fitness",
    "website": "https://www.nellyafencers.com/",
    "vibes": ["family-friendly", "competitive"],
}

BASE_TAGS = [
    "kids",
    "family-friendly",
    "camp",
    "rsvp-required",
    "sports",
    "fencing",
]

WEEK_RE = re.compile(
    r"Week\s+(?P<week>\d+),\s*(?P<month>[A-Za-z]+)\s+(?P<start_day>\d{1,2})\s*-\s*(?P<end_day>\d{1,2}),\s*ages\s*(?P<age_min>\d+)\s*-\s*(?P<age_max>\d+)",
    re.IGNORECASE,
)
PRICE_RE = re.compile(r"\$([0-9]+(?:\.[0-9]{2})?)")


def _clean_text(value: Optional[str]) -> str:
    if not value:
        return ""
    value = value.replace("\xa0", " ").replace("–", "-").replace("—", "-")
    return re.sub(r"\s+", " ", value).strip()


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


def _build_description(overview: str) -> str:
    return _clean_text(
        f"Beginner Fencing Camp at Nellya Fencers Club. {overview} "
        "Campers learn the basics of sabre fencing at Nellya's Atlanta club."
    )[:1000]


def _parse_rows(soup: BeautifulSoup) -> list[dict]:
    year_match = re.search(r"\b(20\d{2})\b", soup.title.string if soup.title and soup.title.string else "")
    year = int(year_match.group(1)) if year_match else datetime.now().year

    overview = ""
    register_url = None
    price_value = None
    rows: list[dict] = []

    for tag in soup.find_all(["h3", "h6", "span", "a"]):
        text = _clean_text(tag.get_text(" ", strip=True))
        if not text:
            continue

        if text == "Beginner Camps":
            continue
        if "Summer fun starts with swords!" in text and not overview:
            overview = text
        if text.startswith("Week 1, 2 & 3") and "$" in text and price_value is None:
            price_match = PRICE_RE.search(text)
            if price_match:
                price_value = float(price_match.group(1))
        if text == "Click Here to Register" and tag.name == "a":
            register_url = tag.get("href")

    for tag in soup.find_all("h6"):
        text = _clean_text(tag.get_text(" ", strip=True))
        if not text:
            continue

        match = WEEK_RE.match(text)
        if not match:
            continue

        month = match.group("month")
        start_day = int(match.group("start_day"))
        end_day = int(match.group("end_day"))
        try:
            start_dt = datetime.strptime(f"{month} {start_day} {year}", "%B %d %Y")
            end_dt = datetime.strptime(f"{month} {end_day} {year}", "%B %d %Y")
        except ValueError:
            continue

        age_min = int(match.group("age_min"))
        age_max = int(match.group("age_max"))
        rows.append(
            {
                "title": "Beginner Fencing Camp",
                "week_label": f"Week {match.group('week')}",
                "start_date": start_dt.strftime("%Y-%m-%d"),
                "end_date": end_dt.strftime("%Y-%m-%d"),
                "age_min": age_min,
                "age_max": age_max,
                "tags": list(dict.fromkeys(BASE_TAGS + _age_band_tags(age_min, age_max))),
                "description": _build_description(overview),
                "ticket_url": register_url,
                "source_url": SOURCE_URL,
                "price_min": price_value,
                "price_max": price_value,
                "price_note": f"${price_value:.0f} beginner camp fee" if price_value else None,
            }
        )

    return rows


def _build_event_record(source_id: int, venue_id: int, row: dict) -> dict:
    title = f"{row['title']} ({row['week_label']})"
    record = {
        "source_id": source_id,
        "venue_id": venue_id,
        "title": title,
        "description": row["description"],
        "start_date": row["start_date"],
        "start_time": None,
        "end_date": row["end_date"],
        "end_time": None,
        "is_all_day": False,
        "category": "programs",
        "subcategory": "camp",
        "class_category": "fitness",
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
    return record


def crawl(source: dict) -> tuple[int, int, int]:
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    session = requests.Session()
    session.headers.update(REQUEST_HEADERS)

    try:
        response = session.get(SOURCE_URL, timeout=30)
        response.raise_for_status()
    except Exception as exc:
        logger.error("Nellya Beginner Camps: failed to fetch page: %s", exc)
        return 0, 0, 0

    venue_id = get_or_create_venue(VENUE_DATA)
    today = date.today().strftime("%Y-%m-%d")

    for row in _parse_rows(BeautifulSoup(response.text, "html.parser")):
        try:
            if row["end_date"] < today:
                continue

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
                "Nellya Beginner Camps: failed to process %s (%s): %s",
                row.get("week_label"),
                row.get("start_date"),
                exc,
            )

    return events_found, events_new, events_updated
