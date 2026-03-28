"""
Crawler for Atlanta Printmakers Studio exhibitions.

The source page is a Squarespace exhibitions archive with a reliable block
stream: current "Now on view" text, image blocks, and dated exhibition
descriptions. We persist real exhibit inventory instead of relying on the
generic profile pipeline.
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from datetime import date, datetime
from typing import Optional

import requests
from bs4 import BeautifulSoup

from db import (
    get_or_create_place,
    insert_exhibition,
)

logger = logging.getLogger(__name__)

BASE_URL = "https://www.atlantaprintmakersstudio.org"
EXHIBITIONS_URL = f"{BASE_URL}/exhibitions"
USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36"
)

PLACE_DATA = {
    "name": "Atlanta Printmakers Studio",
    "slug": "atlanta-printmakers-studio",
    "address": "748 Virginia Ave",
    "neighborhood": "Hapeville",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30354",
    "lat": 33.6697,
    "lng": -84.4118,
    "place_type": "studio",
    "spot_type": "studio",
    "website": BASE_URL,
    "description": (
        "Atlanta Printmakers Studio is a nonprofit printmaking organization that "
        "hosts exhibitions, classes, and collaborative print projects across metro Atlanta."
    ),
    "image_url": (
        "https://images.squarespace-cdn.com/content/v1/5394c62ee4b03c674072fa0b/"
        "0d454dc0-295c-4a3c-9ea9-87fd20125b37/APS%2B20th.jpg?format=1500w"
    ),
    "vibes": ["printmaking", "studio", "gallery", "workshops", "local-art"],
}

MONTHS = {
    "jan": 1,
    "january": 1,
    "feb": 2,
    "february": 2,
    "mar": 3,
    "march": 3,
    "apr": 4,
    "april": 4,
    "may": 5,
    "jun": 6,
    "june": 6,
    "jul": 7,
    "july": 7,
    "aug": 8,
    "august": 8,
    "sep": 9,
    "sept": 9,
    "september": 9,
    "oct": 10,
    "october": 10,
    "nov": 11,
    "november": 11,
    "dec": 12,
    "december": 12,
}

RANGE_RE = re.compile(
    r"(?P<m1>[A-Za-z]+)\s+(?P<d1>\d{1,2})(?:st|nd|rd|th)?"
    r"(?:,\s*(?P<y1>\d{4}))?\s*(?:-|–|—|to)\s*"
    r"(?:(?P<m2>[A-Za-z]+)\s+)?(?P<d2>\d{1,2})(?:st|nd|rd|th)?"
    r"(?:,\s*(?P<y2>\d{4}))?",
    re.IGNORECASE,
)


@dataclass
class ExhibitionCandidate:
    title: str
    description: str
    image_url: Optional[str]
    event_start_date: str
    opening_date: Optional[str]
    closing_date: Optional[str]
    hash_basis: str
    current_without_dates: bool = False


def _today() -> date:
    return date.today()


def _clean_text(value: str) -> str:
    return re.sub(r"\s+", " ", (value or "").replace("\xa0", " ")).strip()


def _fetch_soup(url: str) -> BeautifulSoup:
    response = requests.get(
        url,
        timeout=30,
        headers={"User-Agent": USER_AGENT},
    )
    response.raise_for_status()
    return BeautifulSoup(response.text, "html.parser")


def _parse_date_range(
    text: str,
    *,
    today: date,
    default_year: Optional[int] = None,
) -> Optional[tuple[re.Match[str], date, date]]:
    normalized = _clean_text(text).replace("—", "-").replace("–", "-")
    match = RANGE_RE.search(normalized)
    if not match:
        return None

    month_1 = MONTHS.get(match.group("m1").lower())
    month_2 = MONTHS.get((match.group("m2") or match.group("m1")).lower())
    if not month_1 or not month_2:
        return None

    day_1 = int(match.group("d1"))
    day_2 = int(match.group("d2"))
    base_year = default_year or today.year
    year_2 = int(match.group("y2") or match.group("y1") or base_year)

    if match.group("y1"):
        year_1 = int(match.group("y1"))
    elif match.group("y2"):
        year_1 = year_2 if month_1 <= month_2 else year_2 - 1
    else:
        year_1 = year_2
        if month_2 < month_1:
            year_2 += 1

    try:
        start_dt = date(year_1, month_1, day_1)
        end_dt = date(year_2, month_2, day_2)
    except ValueError:
        return None

    return match, start_dt, end_dt


def _strip_archive_labels(prefix: str) -> str:
    cleaned = _clean_text(prefix)
    cleaned = re.sub(r"^past exhibits\s*-\s*\d{4}:?\s*", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(
        r"^opening\s+[A-Za-z]+\s+\d{1,2}(?:st|nd|rd|th)?:?\s*",
        "",
        cleaned,
        flags=re.IGNORECASE,
    )
    return cleaned.strip(" :-")


def _title_from_suffix(suffix: str) -> str:
    cleaned = _clean_text(suffix)
    if not cleaned:
        return ""
    stop_markers = [
        "Reception:",
        "Opening Reception:",
        "Atlanta Printmakers Studio is pleased",
        "Atlanta Printmakers Studio presents",
        "The exhibition",
        "This exhibition",
        "at Gallery",
        "Gallery 72",
        "Kai Lin Art",
    ]
    for marker in stop_markers:
        index = cleaned.find(marker)
        if index > 0:
            cleaned = cleaned[:index]
            break
    return cleaned.strip(" :-,")


def _nearest_image(blocks: list[dict[str, Optional[str]]], index: int, *, max_distance: int = 2) -> Optional[str]:
    for distance in range(1, max_distance + 1):
        before = index - distance
        if before >= 0 and blocks[before]["image_url"]:
            return blocks[before]["image_url"]
        after = index + distance
        if after < len(blocks) and blocks[after]["image_url"]:
            return blocks[after]["image_url"]
    return None


def _candidate_from_text_block(
    text: str,
    *,
    today: date,
    image_url: Optional[str],
    context_year: Optional[int] = None,
) -> Optional[ExhibitionCandidate]:
    cleaned = _clean_text(text)
    if not cleaned:
        return None

    if cleaned.lower().startswith("now on view:"):
        title = cleaned.split(":", 1)[1].strip()
        if not title:
            return None
        return ExhibitionCandidate(
            title=title,
            description=f"{title} is currently on view through Atlanta Printmakers Studio.",
            image_url=image_url,
            event_start_date=today.isoformat(),
            opening_date=None,
            closing_date=None,
            hash_basis="current",
            current_without_dates=True,
        )

    parsed = _parse_date_range(cleaned, today=today, default_year=context_year)
    if not parsed:
        return None

    match, start_dt, end_dt = parsed
    if end_dt < today:
        return None

    prefix = _strip_archive_labels(cleaned[: match.start()])
    suffix = cleaned[match.end() :].strip()
    title = prefix or _title_from_suffix(suffix)
    if not title:
        return None

    if start_dt <= today <= end_dt:
        event_start = today
    else:
        event_start = start_dt

    description = suffix or f"{title} at Atlanta Printmakers Studio."
    if description and not description.endswith("."):
        description = f"{description}."

    return ExhibitionCandidate(
        title=title,
        description=description,
        image_url=image_url,
        event_start_date=event_start.isoformat(),
        opening_date=start_dt.isoformat(),
        closing_date=end_dt.isoformat(),
        hash_basis=start_dt.isoformat(),
        current_without_dates=False,
    )


def _extract_candidates(soup: BeautifulSoup, *, today: date) -> list[ExhibitionCandidate]:
    blocks: list[dict[str, Optional[str]]] = []
    for block in soup.select("[data-block-type]"):
        image = block.select_one("img")
        blocks.append(
            {
                "text": _clean_text(block.get_text(" ", strip=True)),
                "image_url": (image.get("data-src") or image.get("src")) if image else None,
            }
        )

    candidates: list[ExhibitionCandidate] = []
    seen_titles: set[str] = set()
    archive_year: Optional[int] = None
    for index, block in enumerate(blocks):
        text = block["text"] or ""
        if not text:
            continue
        archive_match = re.search(r"past exhibits\s*-\s*(\d{4})", text, re.IGNORECASE)
        if archive_match:
            archive_year = int(archive_match.group(1))
        candidate = _candidate_from_text_block(
            text,
            today=today,
            image_url=_nearest_image(blocks, index),
            context_year=archive_year,
        )
        if not candidate:
            continue
        key = candidate.title.lower()
        if key in seen_titles:
            continue
        seen_titles.add(key)
        candidates.append(candidate)
    return candidates


def _sync_exhibition_record(
    candidate: ExhibitionCandidate, *, source_id: int, venue_id: int
) -> tuple[int, int, int]:
    """Persist an exhibition record and return (found, new, updated)."""
    exhibition_record = {
        "title": candidate.title,
        "place_id": venue_id,
        "source_id": source_id,
        "_venue_name": PLACE_DATA["name"],
        "opening_date": candidate.opening_date,
        "closing_date": candidate.closing_date,
        "description": candidate.description,
        "image_url": candidate.image_url,
        "source_url": EXHIBITIONS_URL,
        "exhibition_type": "group",
        "admission_type": "free",
        "tags": ["printmaking", "exhibition", "studio"],
        "is_active": True,
        "metadata": (
            {"date_precision": "current_no_dates"} if candidate.current_without_dates else None
        ),
    }
    result = insert_exhibition(exhibition_record)
    # insert_exhibition returns the UUID on new insert, None on skip/duplicate
    if result:
        return 1, 1, 0
    return 1, 0, 1


def crawl(source: dict) -> tuple[int, int, int]:
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0
    today = _today()

    venue_id = get_or_create_place(PLACE_DATA)
    soup = _fetch_soup(EXHIBITIONS_URL)
    candidates = _extract_candidates(soup, today=today)

    if not candidates:
        logger.info("Atlanta Printmakers Studio: no current or future exhibitions found")
        return 0, 0, 0

    for candidate in candidates:
        found_delta, new_delta, updated_delta = _sync_exhibition_record(
            candidate,
            source_id=source_id,
            venue_id=venue_id,
        )
        events_found += found_delta
        events_new += new_delta
        events_updated += updated_delta
        logger.info(
            "Atlanta Printmakers Studio exhibition synced: %s (open=%s close=%s)",
            candidate.title,
            candidate.opening_date or "current",
            candidate.closing_date or "unknown",
        )

    logger.info(
        "Atlanta Printmakers Studio crawl complete: %s found, %s new, %s updated",
        events_found,
        events_new,
        events_updated,
    )
    return events_found, events_new, events_updated
