"""
Crawler for High Museum Summer Art Camp.

Official sources:
https://high.org/camp/
https://high.org/camp/rising-kindergarten/

Pattern role:
Institution-led summer art camp pages with grade-band tabs, rising-kindergarten
weekly sessions, stable buy/waitlist links, and visible weekly pricing.
"""

from __future__ import annotations

import http.client
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

http.client._MAXHEADERS = 1000

BASE_URL = "https://high.org"
SUMMER_CAMP_URL = f"{BASE_URL}/camp/"
RISING_K_URL = f"{BASE_URL}/camp/rising-kindergarten/"

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
    "name": "High Museum of Art",
    "slug": "high-museum",
    "address": "1280 Peachtree St NE",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30309",
    "neighborhood": "Midtown",
    "venue_type": "museum",
    "spot_type": "museum",
    "website": "https://high.org/",
    "vibes": ["family-friendly", "artsy", "all-ages"],
}

BASE_TAGS = [
    "kids",
    "family-friendly",
    "arts",
    "camp",
    "museum",
    "rsvp-required",
]

GRADE_TAB_MAP = {
    "tab-grades-1-2": ("Grades 1-2", 6, 8),
    "tab-grades-3-4": ("Grades 3-4", 8, 10),
    "tab-grades-5-6": ("Grades 5-6", 10, 12),
    "tab-grades-7-8": ("Grades 7-8", 12, 14),
}

PRICE_RE = re.compile(r"Members:\s*\$([0-9]+)\s*\|\s*Not-Yet-Members:\s*\$([0-9]+)", re.I)
DATE_RE = re.compile(
    r"([A-Za-z]+)\s+(\d{1,2})\s*[–-]\s*([A-Za-z]+)?\s*(\d{1,2})",
    re.IGNORECASE,
)


def _clean_text(value: Optional[str]) -> str:
    if not value:
        return ""
    value = (
        value.replace("\xa0", " ")
        .replace("–", "-")
        .replace("—", "-")
        .replace("&#038;", "&")
    )
    return re.sub(r"\s+", " ", value).strip()


def _age_band_tags(age_min: int, age_max: int) -> list[str]:
    tags: list[str] = []
    if age_min <= 5:
        tags.append("preschool")
    if age_min <= 12 and age_max >= 5:
        tags.append("elementary")
    if age_min <= 13 and age_max >= 10:
        tags.append("tween")
    return list(dict.fromkeys(tags))


def _parse_date_range(value: str, year: int = 2026) -> tuple[str, str]:
    match = DATE_RE.search(_clean_text(value))
    if not match:
        raise ValueError(f"Could not parse date range: {value}")
    start_month, start_day, end_month, end_day = match.groups()
    end_month = end_month or start_month
    start_dt = datetime.strptime(f"{start_month} {start_day} {year}", "%B %d %Y")
    end_dt = datetime.strptime(f"{end_month} {end_day} {year}", "%B %d %Y")
    return start_dt.strftime("%Y-%m-%d"), end_dt.strftime("%Y-%m-%d")


def _absolute_url(href: Optional[str], fallback: str) -> str:
    if not href:
        return fallback
    if href.startswith("http"):
        return href
    return f"{BASE_URL}{href}"


def _derive_tags(title: str, age_min: int, age_max: int) -> list[str]:
    lowered = title.lower()
    tags = list(BASE_TAGS)
    if "hogwarts" in lowered:
        tags.extend(["themed-camp", "fantasy"])
    if "movies" in lowered or "games" in lowered:
        tags.append("media-arts")
    if "drawing" in lowered or "illustration" in lowered:
        tags.append("drawing")
    if "jewelry" in lowered:
        tags.append("crafts")
    tags.extend(_age_band_tags(age_min, age_max))
    return list(dict.fromkeys(tags))


def _parse_price_line(text: str) -> tuple[Optional[float], Optional[float], str]:
    cleaned = _clean_text(text)
    if "Sold Out" in cleaned:
        return None, None, "Sold out. Join the official High Museum waitlist."
    match = PRICE_RE.search(cleaned)
    if not match:
        return None, None, cleaned
    member_price = float(match.group(1))
    public_price = float(match.group(2))
    return member_price, public_price, cleaned


def _parse_camp_card(
    card: Tag,
    label: str,
    age_min: int,
    age_max: int,
    source_url: str,
    default_price_note: str,
) -> dict:
    title_node = card.find("h3", class_="at-accordion-title")
    price_node = card.find("p", class_="at-accordion-price")
    info_node = card.find("p", class_="at-accordion-info")
    cta = card.find("a", class_="at-accordion-cta", href=True)

    title = _clean_text(title_node.get_text(" ", strip=True) if title_node else "")
    info_text = _clean_text(info_node.get_text(" ", strip=True) if info_node else "")
    start_date, end_date = _parse_date_range(info_text)

    date_match = DATE_RE.search(info_text)
    description = _clean_text(info_text[date_match.end() :] if date_match else info_text)
    price_min, price_max, inline_price_note = _parse_price_line(
        price_node.get_text(" ", strip=True) if price_node else ""
    )

    price_note = inline_price_note if inline_price_note else default_price_note
    if default_price_note and default_price_note not in price_note:
        price_note = _clean_text(f"{price_note} {default_price_note}")

    return {
        "title": f"High Museum Summer Art Camp: {title} ({label})",
        "description": description,
        "source_url": source_url,
        "ticket_url": _absolute_url(cta.get("href") if cta else None, source_url),
        "start_date": start_date,
        "end_date": end_date,
        "start_time": "09:00",
        "end_time": "16:00",
        "is_all_day": False,
        "age_min": age_min,
        "age_max": age_max,
        "price_min": price_min,
        "price_max": price_max,
        "price_note": price_note,
        "tags": _derive_tags(title, age_min, age_max),
    }


def _parse_main_rows(html: str) -> list[dict]:
    soup = BeautifulSoup(html, "html.parser")
    default_price_note = (
        "Members $360/week, not-yet-members $460/week. Beforecare $45, aftercare $95, T-shirts $25."
    )
    rows: list[dict] = []

    for tab_id, (label, age_min, age_max) in GRADE_TAB_MAP.items():
        container = soup.find("div", id=tab_id)
        if not container:
            continue
        for card in container.find_all("div", class_="at-accordion-content-container"):
            title_node = card.find("h3", class_="at-accordion-title")
            if not title_node:
                continue
            title = _clean_text(title_node.get_text(" ", strip=True))
            if not title.startswith("Week "):
                continue
            rows.append(
                _parse_camp_card(card, label, age_min, age_max, SUMMER_CAMP_URL, default_price_note)
            )

    return rows


def _parse_rising_kindergarten_rows(html: str) -> list[dict]:
    soup = BeautifulSoup(html, "html.parser")
    default_price_note = (
        "Full day: members $360/week, not-yet-members $460/week. "
        "Half day: members $180/week, not-yet-members $230/week. "
        "Beforecare $45, aftercare $95, T-shirts $25."
    )
    rows: list[dict] = []
    for card in soup.find_all("div", class_="at-accordion-content-container"):
        title_node = card.find("h3", class_="at-accordion-title")
        if not title_node:
            continue
        title = _clean_text(title_node.get_text(" ", strip=True))
        if not title.startswith("Week "):
            continue
        row = _parse_camp_card(
            card,
            "Rising Kindergarten",
            5,
            5,
            RISING_K_URL,
            default_price_note,
        )
        row["start_time"] = "09:00"
        row["end_time"] = "16:00"
        row["tags"] = list(dict.fromkeys(row["tags"] + ["rising-kindergarten"]))
        rows.append(row)
    return rows


def _build_event_record(source_id: int, venue_id: int, row: dict) -> dict:
    title = f"{row['title']} at High Museum of Art"
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
        main_html = requests.get(SUMMER_CAMP_URL, headers=REQUEST_HEADERS, timeout=30).text
        rising_html = requests.get(RISING_K_URL, headers=REQUEST_HEADERS, timeout=30).text
        rows = _parse_main_rows(main_html) + _parse_rising_kindergarten_rows(rising_html)
    except Exception as exc:
        logger.error("High Museum Summer Art Camp: fetch failed: %s", exc)
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
                "High Museum Summer Art Camp: failed to process %s (%s): %s",
                row.get("title"),
                row.get("start_date"),
                exc,
            )

    return events_found, events_new, events_updated
