"""
Crawler for Georgia Aquarium Camp H2O.

Official sources:
https://www.georgiaaquarium.org/camp-h2o/
https://www.georgiaaquarium.org/?s=summer+camp

Pattern role:
Institution-led camp page with week-by-week age-track themes and direct
registration event pages.
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

SOURCE_URL = "https://www.georgiaaquarium.org/camp-h2o/"

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
    "name": "Georgia Aquarium",
    "slug": "georgia-aquarium",
    "address": "225 Baker St NW",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30313",
    "neighborhood": "Downtown",
    "venue_type": "aquarium",
    "spot_type": "aquarium",
    "website": "https://www.georgiaaquarium.org/",
    "vibes": ["family-friendly", "all-ages", "educational"],
}

BASE_TAGS = ["camp", "family-friendly", "science", "animals", "rsvp-required"]

WEEK_RE = re.compile(
    r"(?P<start_month>[A-Za-z]+)\s+(?P<start_day>\d{1,2})[–-](?P<end_month>[A-Za-z]+)?\s*(?P<end_day>\d{1,2}):\s*Campers",
    re.IGNORECASE,
)
AGE_THEME_RE = re.compile(r"Ages\s+(\d+)[–-](\d+):\s*(.+)")


def _clean_text(value: Optional[str]) -> str:
    if not value:
        return ""
    value = value.replace("\xa0", " ").replace("–", "-").replace("—", "-")
    return re.sub(r"\s+", " ", value).strip()


def _parse_week_dates(heading: str, year: int = 2026) -> tuple[str, str]:
    match = WEEK_RE.search(_clean_text(heading))
    if not match:
        raise ValueError(f"Could not parse Aquarium week header: {heading}")
    start_month = match.group("start_month")
    end_month = match.group("end_month") or start_month
    start_day = int(match.group("start_day"))
    end_day = int(match.group("end_day"))
    start_dt = datetime.strptime(f"{start_month} {start_day} {year}", "%B %d %Y")
    end_dt = datetime.strptime(f"{end_month} {end_day} {year}", "%B %d %Y")
    return start_dt.strftime("%Y-%m-%d"), end_dt.strftime("%Y-%m-%d")


def _age_band_tags(age_min: int, age_max: int) -> list[str]:
    tags: list[str] = []
    if age_min <= 12 and age_max >= 5:
        tags.append("elementary")
    if age_min <= 13 and age_max >= 8:
        tags.append("tween")
    if age_min >= 14:
        tags.append("teen")
    return tags


def _derive_tags(theme: str, age_min: int, age_max: int) -> list[str]:
    lowered = theme.lower()
    tags = list(BASE_TAGS)
    if "ocean" in lowered:
        tags.append("marine-life")
    if "artists" in lowered:
        tags.append("arts")
    if "myth" in lowered:
        tags.append("storytelling")
    if "taxonomy" in lowered:
        tags.append("stem")
    tags.extend(_age_band_tags(age_min, age_max))
    return list(dict.fromkeys(tags))


def _parse_rows(html: str) -> list[dict]:
    soup = BeautifulSoup(html, "html.parser")
    rows: list[dict] = []

    for item in soup.select("ul.accordion > li"):
        trigger = item.select_one("a.js-accordion-trigger")
        submenu = item.select_one("div.submenu")
        if not trigger or not submenu:
            continue
        heading = _clean_text(trigger.get_text(" ", strip=True))
        if not heading.startswith(("June", "July")):
            continue
        start_date, end_date = _parse_week_dates(heading)
        register_link = submenu.select_one("a.button[href]")
        ticket_url = register_link["href"] if register_link else SOURCE_URL

        for paragraph in submenu.find_all("p"):
            text = _clean_text(paragraph.get_text(" ", strip=True))
            match = AGE_THEME_RE.match(text)
            if not match:
                continue
            age_min = int(match.group(1))
            age_max = int(match.group(2))
            theme = _clean_text(match.group(3))
            rows.append(
                {
                    "title": f"Camp H2O: {theme}",
                    "description": (
                        f"Georgia Aquarium Camp H2O week for ages {age_min}-{age_max}. "
                        "Campers explore aquarium galleries, presentations, hands-on experiments, and aquatic life themes."
                    ),
                    "source_url": SOURCE_URL,
                    "ticket_url": ticket_url,
                    "start_date": start_date,
                    "end_date": end_date,
                    "start_time": "09:00",
                    "end_time": "15:30",
                    "is_all_day": False,
                    "age_min": age_min,
                    "age_max": age_max,
                    "price_min": None,
                    "price_max": None,
                    "price_note": "See official Camp H2O registration flow for current tuition. Camp runs Monday-Friday 9:00am-3:30pm.",
                    "tags": _derive_tags(theme, age_min, age_max),
                }
            )

    return rows


def _build_event_record(source_id: int, venue_id: int, row: dict) -> dict:
    title = f"{row['title']} at Georgia Aquarium"
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
        "extraction_confidence": 0.9,
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
        logger.error("Georgia Aquarium Camp H2O: fetch failed: %s", exc)
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
                "Georgia Aquarium Camp H2O: failed to process %s (%s): %s",
                row.get("title"),
                row.get("start_date"),
                exc,
            )

    return events_found, events_new, events_updated
