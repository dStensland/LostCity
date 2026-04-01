"""
Crawler for Vinings School of Art summer camps.

Official source:
https://viningsschoolofart.com/summer-camps.html

Pattern role:
Static official summer-camp page with dated weekly tab panes, stable price
blocks, and visible camp themes by week.
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
    get_or_create_place,
    insert_event,
    smart_update_existing_event,
)
from db.programs import insert_program
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

SOURCE_URL = "https://viningsschoolofart.com/summer-camps.html"

REQUEST_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/122.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml",
    "Accept-Language": "en-US,en;q=0.9",
}

PLACE_DATA = {
    "name": "Vinings School of Art",
    "slug": "vinings-school-of-art",
    "address": "1675 Cumberland Pkwy SE #102",
    "city": "Smyrna",
    "state": "GA",
    "zip": "30080",
    "lat": 33.8598,
    "lng": -84.4818,
    "neighborhood": "Vinings",
    "place_type": "arts_venue",
    "spot_type": "arts",
    "website": "https://viningsschoolofart.com/",
    "vibes": ["family-friendly", "creative"],
}

BASE_TAGS = [
    "kids",
    "family-friendly",
    "arts",
    "camp",
    "rsvp-required",
]

DATE_HEADING_RE = re.compile(
    r"(?P<start_month>[A-Za-z]+)\s+(?P<start_day>\d{1,2})\s+to\s+"
    r"(?P<end_month>[A-Za-z]+)\s+(?P<end_day>\d{1,2})",
    re.IGNORECASE,
)
PRICE_RE = re.compile(r"\$([0-9]+(?:\.[0-9]{2})?)")


def _clean_text(value: Optional[str]) -> str:
    if not value:
        return ""
    replacements = {
        "\xa0": " ",
        "â": '"',
        "â": '"',
        "â": "'",
        "â": "-",
        "â": "-",
        "Â": "",
    }
    for old, new in replacements.items():
        value = value.replace(old, new)
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


def _derive_tags(title: str, detail_text: str) -> list[str]:
    text = f"{title} {detail_text}".lower()
    tags = list(BASE_TAGS)
    if "paint" in text or "canvas" in text or "watercolor" in text:
        tags.append("painting")
    if "draw" in text:
        tags.append("drawing")
    if "clay" in text or "sculpt" in text:
        tags.append("clay")
    if "monet" in text:
        tags.append("art-history")
    return list(dict.fromkeys(tags))


def _parse_date_heading(value: str, year: int) -> tuple[Optional[str], Optional[str]]:
    match = DATE_HEADING_RE.search(_clean_text(value))
    if not match:
        return None, None
    start_month = match.group("start_month")
    end_month = match.group("end_month")
    start_day = int(match.group("start_day"))
    end_day = int(match.group("end_day"))
    try:
        start_dt = datetime.strptime(f"{start_month} {start_day} {year}", "%B %d %Y")
        end_dt = datetime.strptime(f"{end_month} {end_day} {year}", "%B %d %Y")
    except ValueError:
        return None, None
    return start_dt.strftime("%Y-%m-%d"), end_dt.strftime("%Y-%m-%d")


def _extract_year(soup: BeautifulSoup) -> int:
    title_text = _clean_text(soup.title.get_text(" ", strip=True) if soup.title else "")
    match = re.search(r"\b(20\d{2})\b", title_text)
    return int(match.group(1)) if match else datetime.now().year


def _extract_pricing(soup: BeautifulSoup) -> tuple[Optional[float], Optional[float]]:
    full_days_price = None
    four_day_price = None
    for span in soup.find_all("span", class_="timeframes"):
        text = _clean_text(span.get_text(" ", strip=True))
        price_match = PRICE_RE.search(text)
        if not price_match:
            continue
        price = float(price_match.group(1))
        lowered = text.lower()
        if lowered.startswith("full days") and full_days_price is None:
            full_days_price = price
        if lowered.startswith("four full days") and four_day_price is None:
            four_day_price = price
    return full_days_price, four_day_price


def _extract_intro(soup: BeautifulSoup) -> str:
    for heading in soup.find_all("h1"):
        text = _clean_text(heading.get_text(" ", strip=True))
        if "Summer 20" in text and "drop-off" in text:
            return text
    return ""


def _extract_procare_url(soup: BeautifulSoup) -> Optional[str]:
    for link in soup.find_all("a", href=True):
        href = link["href"]
        text = _clean_text(link.get_text(" ", strip=True)).lower()
        if "myprocare.com" in href or "procare" in text:
            return href
    return None


def _leaf_li_texts(node: Tag) -> list[str]:
    texts: list[str] = []
    for item in node.find_all("li"):
        if item.find("li"):
            continue
        text = _clean_text(item.get_text(" ", strip=True))
        if text and text not in texts:
            texts.append(text)
    return texts


def _build_description(
    title: str,
    detail_lines: list[str],
    intro: str,
    price_note: str,
    procare_url: Optional[str],
) -> str:
    parts = [
        f"{title} at Vinings School of Art for ages 5 1/2 to 12.",
    ]
    if detail_lines:
        parts.append(" ".join(detail_lines[:2]))
    if intro:
        parts.append(
            "Regular camp day runs 9:15am to 2:30pm with optional early drop-off and late pickup."
        )
    parts.append(price_note)
    if procare_url:
        parts.append("First-time students complete the ProCare form after payment.")
    return _clean_text(" ".join(part for part in parts if part))[:1000]


def _price_note_for_section(
    heading_text: str, full_days_price: Optional[float], four_day_price: Optional[float]
) -> tuple[Optional[float], Optional[float], str]:
    is_four_day = "4-day" in heading_text.lower() or "4 days" in heading_text.lower()
    base_price = four_day_price if is_four_day else full_days_price
    if is_four_day and base_price is not None:
        note = (
            f"${base_price:.0f} for the 4-day holiday week. Early drop-off +$50/week, "
            "pickup to 4pm +$75/week, pickup to 5pm +$110/week."
        )
        return base_price, base_price, note
    if base_price is not None:
        note = (
            f"${base_price:.0f} regular full-day weekly rate. Early drop-off +$50/week, "
            "pickup to 4pm +$75/week, pickup to 5pm +$110/week."
        )
        return base_price, base_price, note
    return None, None, "Call or text Vinings School of Art for current camp pricing."


def _parse_sections(soup: BeautifulSoup) -> list[dict]:
    year = _extract_year(soup)
    full_days_price, four_day_price = _extract_pricing(soup)
    intro = _extract_intro(soup)
    procare_url = _extract_procare_url(soup)
    rows: list[dict] = []

    for pane in soup.find_all("div", class_="tab-pane"):
        heading = pane.find("h2", class_="camp-tab-header") or pane.find("h2")
        if not heading:
            continue
        heading_text = _clean_text(heading.get_text(" ", strip=True))
        if not heading_text or heading_text == "*" or "future camp" in heading_text.lower():
            continue

        start_date, end_date = _parse_date_heading(heading_text, year)
        if not start_date:
            continue

        price_min, price_max, price_note = _price_note_for_section(
            heading_text, full_days_price, four_day_price
        )

        for column in pane.find_all("div", class_=re.compile(r"\bcol-(?:lg|md|xs)-")):
            title_node = column.find("h3")
            if not title_node:
                continue
            title = _clean_text(title_node.get_text(" ", strip=True))
            if not title:
                continue
            if title.lower() in {"prices", "extended day", "*"}:
                continue

            detail_lines = _leaf_li_texts(column)
            detail_text = " ".join(detail_lines)
            tags = list(dict.fromkeys(_derive_tags(title, detail_text) + _age_band_tags(5, 12)))
            rows.append(
                {
                    "title": title,
                    "source_url": SOURCE_URL,
                    "ticket_url": SOURCE_URL,
                    "start_date": start_date,
                    "end_date": end_date,
                    "start_time": "09:15",
                    "end_time": "14:30",
                    "is_all_day": False,
                    "age_min": 5,
                    "age_max": 12,
                    "price_min": price_min,
                    "price_max": price_max,
                    "price_note": price_note,
                    "tags": tags,
                    "description": _build_description(
                        title, detail_lines, intro, price_note, procare_url
                    ),
                }
            )

    return rows


def _build_event_record(source_id: int, venue_id: int, row: dict) -> dict:
    title = f"{row['title']} at Vinings School of Art"
    record = {
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
        "extraction_confidence": 0.89,
        "is_recurring": False,
        "recurrence_rule": None,
        "content_hash": generate_content_hash(title, PLACE_DATA["name"], row["start_date"]),
        "age_min": row["age_min"],
        "age_max": row["age_max"],
    }
    return record


def _build_program_record(source_id: int, venue_id: int, row: dict) -> dict:
    return {
        "source_id": source_id,
        "place_id": venue_id,
        "name": row["title"],
        "description": row["description"],
        "program_type": "camp",
        "provider_name": PLACE_DATA["name"],
        "age_min": row.get("age_min"),
        "age_max": row.get("age_max"),
        "season": "summer",
        "session_start": row["start_date"],
        "session_end": row["end_date"],
        "schedule_start_time": row["start_time"],
        "schedule_end_time": row["end_time"],
        "cost_amount": row.get("price_min"),
        "cost_period": "per_session" if row.get("price_min") is not None else None,
        "cost_notes": row.get("price_note"),
        "registration_status": "open",
        "registration_url": row["ticket_url"],
        "tags": row["tags"],
        "status": "active",
        "metadata": {"source_url": row["source_url"]},
        "_venue_name": PLACE_DATA["name"],
    }


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
        logger.error("Vinings School of Art Summer Camps: failed to fetch page: %s", exc)
        return 0, 0, 0

    venue_id = get_or_create_place(PLACE_DATA)
    today = date.today().strftime("%Y-%m-%d")
    soup = BeautifulSoup(response.content.decode("utf-8", "replace"), "html.parser")

    for row in _parse_sections(soup):
        try:
            if row["end_date"] < today:
                continue

            insert_program(_build_program_record(source_id, venue_id, row))

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
                "Vinings School of Art Summer Camps: failed to process %s (%s): %s",
                row.get("title"),
                row.get("start_date"),
                exc,
            )

    return events_found, events_new, events_updated
