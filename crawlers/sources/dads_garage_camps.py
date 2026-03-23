"""
Crawler for Dad's Garage camps.

Official source:
https://www.dadsgarage.com/camps

Pattern role:
Arts/performance camp implementation using a public schedule page with explicit
week-by-week camp links for kids and teens.
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

SOURCE_URL = "https://www.dadsgarage.com/camps"

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
    "name": "Dad's Garage Theatre",
    "slug": "dads-garage-theatre",
    "address": "569 Ezzard Street Southeast",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30312",
    "lat": 33.7609,
    "lng": -84.3444,
    "neighborhood": "Old Fourth Ward",
    "venue_type": "arts_venue",
    "spot_type": "arts",
    "website": "https://www.dadsgarage.com",
    "vibes": ["family-friendly", "creative"],
}

BASE_TAGS = [
    "kids",
    "family-friendly",
    "arts",
    "camp",
    "rsvp-required",
]

SECTION_AGE_MAP = {
    "kids": (8, 12, "rising grades 3-6"),
    "teen": (12, 17, "rising grades 7-12"),
}

WEEK_RE = re.compile(
    r"Week\s+(?P<week>\d+)\s*:\s*(?P<date>[A-Za-z]+\s+\d{1,2}(?:-\d{1,2}|[—–-][A-Za-z]+\s+\d{1,2}|[—–-]\d{1,2}))\s*[-—–]\s*(?P<title>.+)$",
    re.IGNORECASE,
)


def _clean_text(value: Optional[str]) -> str:
    if not value:
        return ""
    value = value.replace("\xa0", " ")
    value = value.replace("—", "-").replace("–", "-")
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
    if hi >= 13 or lo >= 13:
        tags.append("teen")
    return tags


def _smart_title(value: str) -> str:
    words = _clean_text(value).split()
    return " ".join(word.title() if word.isupper() else word for word in words)


def _parse_date_range(value: str, year: int) -> tuple[Optional[str], Optional[str]]:
    cleaned = _clean_text(value)
    match = re.match(
        r"(?P<start_month>[A-Za-z]+)\s+(?P<start_day>\d{1,2})\s*-\s*"
        r"(?:(?P<end_month>[A-Za-z]+)\s+)?(?P<end_day>\d{1,2})$",
        cleaned,
    )
    if not match:
        return None, None

    start_month = match.group("start_month")
    end_month = match.group("end_month") or start_month
    start_day = int(match.group("start_day"))
    end_day = int(match.group("end_day"))

    for fmt in ("%B %d %Y", "%b %d %Y"):
        try:
            start_dt = datetime.strptime(f"{start_month} {start_day} {year}", fmt)
            end_dt = datetime.strptime(f"{end_month} {end_day} {year}", fmt)
            return start_dt.strftime("%Y-%m-%d"), end_dt.strftime("%Y-%m-%d")
        except ValueError:
            continue
    return None, None


def _derive_tags(title: str, age_tags: list[str], audience: str) -> list[str]:
    tags = BASE_TAGS + age_tags + ["comedy", "improv", "performing-arts"]
    if "bootcamp" in title.lower():
        tags.append("workshop")
    if audience == "teen":
        tags.append("teen")
    return list(dict.fromkeys(tags))


def _build_description(row: dict, shared_summary: str) -> str:
    parts = [
        row["title"],
        f"Audience: {row['grade_text']}.",
        shared_summary,
        "Friday showcase included for friends and family.",
    ]
    return _clean_text(" ".join(parts))[:1000]


def _parse_sections(soup: BeautifulSoup) -> list[dict]:
    rows: list[dict] = []
    year = datetime.now().year

    shared_summary = ""
    for paragraph in soup.find_all("p"):
        text = _clean_text(paragraph.get_text(" ", strip=True))
        if "All camps are five days" in text:
            shared_summary = text
            next_paragraph = paragraph.find_next("p")
            if next_paragraph:
                shared_summary = _clean_text(
                    f"{shared_summary} {_clean_text(next_paragraph.get_text(' ', strip=True))}"
                )
            break

    for heading in soup.find_all("h4"):
        heading_text = _clean_text(heading.get_text(" ", strip=True)).lower()
        if "kids" in heading_text and "rising grades 3-6" in heading_text:
            audience = "kids"
        elif "teen" in heading_text and "rising grades 7-12" in heading_text:
            audience = "teen"
        else:
            continue

        age_min, age_max, grade_text = SECTION_AGE_MAP[audience]
        age_tags = _age_band_tags(age_min, age_max)

        sibling = heading.find_next_sibling()
        while sibling:
            if isinstance(sibling, Tag) and sibling.name == "h4":
                break
            if isinstance(sibling, Tag) and sibling.name == "h3":
                break
            if isinstance(sibling, Tag) and sibling.name == "p":
                link = sibling.find("a", href=True)
                if not link:
                    sibling = sibling.find_next_sibling()
                    continue
                label = _clean_text(link.get_text(" ", strip=True))
                match = WEEK_RE.match(label)
                if not match:
                    sibling = sibling.find_next_sibling()
                    continue
                start_date, end_date = _parse_date_range(match.group("date"), year)
                if not start_date:
                    sibling = sibling.find_next_sibling()
                    continue

                title = _smart_title(match.group("title"))
                rows.append(
                    {
                        "title": title,
                        "audience": audience,
                        "grade_text": grade_text,
                        "ticket_url": link["href"],
                        "source_url": SOURCE_URL,
                        "start_date": start_date,
                        "end_date": end_date,
                        "start_time": "09:00",
                        "end_time": "15:00",
                        "is_all_day": False,
                        "age_min": age_min,
                        "age_max": age_max,
                        "tags": _derive_tags(title, age_tags, audience),
                        "class_category": "mixed",
                        "description": _build_description(
                            {
                                "title": title,
                                "grade_text": grade_text,
                            },
                            shared_summary,
                        ),
                    }
                )
            sibling = sibling.find_next_sibling()

    return rows


def _build_event_record(source_id: int, venue_id: int, row: dict) -> dict:
    title = f"{row['title']} Camp at Dad's Garage ({row['grade_text']})"
    record = {
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
        "price_min": None,
        "price_max": None,
        "price_note": None,
        "is_free": False,
        "source_url": row["source_url"],
        "ticket_url": row["ticket_url"],
        "image_url": None,
        "raw_text": f"{title} | {row['description']}",
        "extraction_confidence": 0.9,
        "is_recurring": False,
        "recurrence_rule": None,
        "content_hash": generate_content_hash(
            title, VENUE_DATA["name"], row["start_date"]
        ),
    }
    record["age_min"] = row["age_min"]
    record["age_max"] = row["age_max"]
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
        logger.error("Dad's Garage Camps: failed to fetch page: %s", exc)
        return 0, 0, 0

    venue_id = get_or_create_venue(VENUE_DATA)
    today = date.today().strftime("%Y-%m-%d")

    for row in _parse_sections(BeautifulSoup(response.text, "html.parser")):
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
                "Dad's Garage Camps: failed to process %s (%s): %s",
                row.get("title"),
                row.get("start_date"),
                exc,
            )

    return events_found, events_new, events_updated
