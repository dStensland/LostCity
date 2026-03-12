"""
Crawler for Zoo Atlanta Summer Safari Camp.

Official source:
https://zooatlanta.org/program/summer-camp/

Pattern role:
Institution-led summer camp page with stable age-track registration links and
week-by-week accordion content for each track.
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

SOURCE_URL = "https://zooatlanta.org/program/summer-camp/"

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
    "name": "Zoo Atlanta",
    "slug": "zoo-atlanta",
    "address": "800 Cherokee Ave SE",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30315",
    "neighborhood": "Grant Park",
    "venue_type": "zoo",
    "spot_type": "zoo",
    "website": "https://zooatlanta.org/",
    "vibes": ["family-friendly", "all-ages"],
}

BASE_TAGS = [
    "kids",
    "family-friendly",
    "camp",
    "zoo",
    "animals",
    "rsvp-required",
]

WEEK_HEADING_RE = re.compile(
    r"Week\s+\d+:\s+(?P<start_month>[A-Za-z]+)\s+(?P<start_day>\d{1,2})\s*[–-]\s*(?P<end_month>[A-Za-z]+)?\s*(?P<end_day>\d{1,2})",
    re.IGNORECASE,
)
TRACK_HEADING_RE = re.compile(
    r"(?P<label>Junior Rangers|Trek|Quest)\s+\(Ages?\s+(?P<age_min>\d+)\s*-\s*(?P<age_max>\d+)\)",
    re.IGNORECASE,
)
PRICE_LINE_RE = re.compile(
    r"JUNIOR RANGER AND TREK:\s*\$(?P<jr>[0-9]+)\/week.*?QUEST:\s*\$(?P<quest>[0-9]+)\/week.*?"
    r"Member Cost:\s*JUNIOR RANGER AND TREK:\s*\$(?P<jr_member>[0-9]+)\/week.*?QUEST:\s*\$(?P<quest_member>[0-9]+)\/week.*?"
    r"EXTENDED CARE COST:\s*\$(?P<extended>[0-9]+)\/week",
    re.IGNORECASE,
)


def _clean_text(value: Optional[str]) -> str:
    if not value:
        return ""
    value = value.replace("\xa0", " ").replace("–", "-").replace("—", "-")
    return re.sub(r"\s+", " ", value).strip()


def _age_band_tags(age_min: int, age_max: int) -> list[str]:
    tags: list[str] = []
    if age_min <= 12 and age_max >= 5:
        tags.append("elementary")
    if age_min <= 13 and age_max >= 10:
        tags.append("tween")
    if age_min >= 12:
        tags.append("teen")
    return tags


def _parse_week_dates(heading_text: str, year: int) -> tuple[str, str]:
    match = WEEK_HEADING_RE.search(_clean_text(heading_text))
    if not match:
        raise ValueError(f"Unable to parse week heading: {heading_text}")

    start_month = match.group("start_month")
    end_month = match.group("end_month") or start_month
    start_day = int(match.group("start_day"))
    end_day = int(match.group("end_day"))

    start_dt = datetime.strptime(f"{start_month} {start_day} {year}", "%B %d %Y")
    end_dt = datetime.strptime(f"{end_month} {end_day} {year}", "%B %d %Y")
    return start_dt.strftime("%Y-%m-%d"), end_dt.strftime("%Y-%m-%d")


def _extract_registration_links(soup: BeautifulSoup) -> dict[str, str]:
    links: dict[str, str] = {}
    for anchor in soup.find_all("a", href=True):
        text = _clean_text(anchor.get_text(" ", strip=True)).lower()
        href = anchor["href"]
        if "doubleknot.com" not in href:
            continue
        if "junior ranger" in text:
            links["junior rangers"] = href
        elif text == "trek registration":
            links["trek"] = href
        elif text == "quest registration":
            links["quest"] = href
    return links


def _extract_pricing(text: str) -> dict[str, dict[str, int]]:
    match = PRICE_LINE_RE.search(_clean_text(text))
    if not match:
        return {
            "junior rangers": {"price": 400, "member_price": 350, "extended": 75},
            "trek": {"price": 400, "member_price": 350, "extended": 75},
            "quest": {"price": 425, "member_price": 370, "extended": 75},
        }
    return {
        "junior rangers": {
            "price": int(match.group("jr")),
            "member_price": int(match.group("jr_member")),
            "extended": int(match.group("extended")),
        },
        "trek": {
            "price": int(match.group("jr")),
            "member_price": int(match.group("jr_member")),
            "extended": int(match.group("extended")),
        },
        "quest": {
            "price": int(match.group("quest")),
            "member_price": int(match.group("quest_member")),
            "extended": int(match.group("extended")),
        },
    }


def _extract_track_overviews(soup: BeautifulSoup) -> dict[str, dict]:
    overviews: dict[str, dict] = {}
    for panel in soup.find_all("div", class_="wpsm_panel"):
        heading = panel.find("h4")
        heading_text = _clean_text(heading.get_text(" ", strip=True) if heading else "")
        if not heading_text or heading_text.startswith("Week "):
            continue
        match = TRACK_HEADING_RE.search(heading_text)
        if not match:
            continue
        label = match.group("label").title()
        key = label.lower()
        paragraph = panel.find("p")
        overview = _clean_text(paragraph.get_text(" ", strip=True) if paragraph else "")
        overviews[key] = {
            "label": label,
            "age_min": int(match.group("age_min")),
            "age_max": int(match.group("age_max")),
            "overview": overview,
        }
    return overviews


def _derive_tags(track_label: str, theme_title: str, age_min: int, age_max: int) -> list[str]:
    lowered = f"{track_label} {theme_title}".lower()
    tags = list(BASE_TAGS)
    if "biome" in lowered or "ecosystem" in lowered:
        tags.append("nature")
    if "animal care" in lowered or "wildlife" in lowered:
        tags.append("educational")
    tags.extend(_age_band_tags(age_min, age_max))
    return list(dict.fromkeys(tags))


def _parse_week_rows(html: str) -> list[dict]:
    soup = BeautifulSoup(html, "html.parser")
    full_text = soup.get_text(" ", strip=True)
    year_match = re.search(r"May 26 - July 31,\s*(20\d{2})", _clean_text(full_text))
    year = int(year_match.group(1)) if year_match else datetime.now().year
    registration_links = _extract_registration_links(soup)
    track_meta = _extract_track_overviews(soup)
    pricing = _extract_pricing(full_text)
    rows: list[dict] = []

    for panel in soup.find_all("div", class_="wpsm_panel"):
        heading = panel.find("h4")
        heading_text = _clean_text(heading.get_text(" ", strip=True) if heading else "")
        if not heading_text.startswith("Week "):
            continue

        start_date, end_date = _parse_week_dates(heading_text, year)
        paragraphs = [
            _clean_text(p.get_text(" ", strip=True))
            for p in panel.find_all("p")
            if _clean_text(p.get_text(" ", strip=True))
        ]
        i = 0
        while i + 1 < len(paragraphs):
            match = TRACK_HEADING_RE.search(paragraphs[i])
            if not match:
                i += 1
                continue
            key = match.group("label").lower()
            theme_text = paragraphs[i + 1]
            theme_title, _, body = theme_text.partition(":")
            body = body.strip() or theme_text
            meta = track_meta[key]
            price_info = pricing[key]
            rows.append(
                {
                    "title": f"Summer Safari Camp - {meta['label']}: {theme_title.strip()}",
                    "description": _clean_text(f"{meta['overview']} {body}")[:1000],
                    "source_url": SOURCE_URL,
                    "ticket_url": registration_links.get(key, SOURCE_URL),
                    "start_date": start_date,
                    "end_date": end_date,
                    "start_time": "09:00",
                    "end_time": "16:00",
                    "is_all_day": False,
                    "age_min": meta["age_min"],
                    "age_max": meta["age_max"],
                    "price_min": float(price_info["price"]),
                    "price_max": float(price_info["price"]),
                    "price_note": (
                        f"${price_info['price']}/week; member price ${price_info['member_price']}/week. "
                        f"Extended care +${price_info['extended']}/week. Abbreviated holiday weeks prorated."
                    ),
                    "tags": _derive_tags(
                        meta["label"], theme_title, meta["age_min"], meta["age_max"]
                    ),
                }
            )
            i += 2

    return rows


def _build_event_record(source_id: int, venue_id: int, row: dict) -> dict:
    title = f"{row['title']} at Zoo Atlanta"
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
        rows = _parse_week_rows(response.text)
    except Exception as exc:
        logger.error("Zoo Atlanta Summer Safari Camp: fetch failed: %s", exc)
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
                "Zoo Atlanta Summer Safari Camp: failed to process %s (%s): %s",
                row.get("title"),
                row.get("start_date"),
                exc,
            )

    return events_found, events_new, events_updated
