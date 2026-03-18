"""
Crawler for Atlanta History Center (atlantahistorycenter.com).

This source has three distinct first-party content surfaces:
1. The Events Calendar (Tribe) API for timed public programs
2. The exhibitions index for ongoing museum exhibitions / experiences
3. Summer camp landing pages for family-program sessions
"""

from __future__ import annotations

import html
import json
import logging
import re
from collections import defaultdict
from datetime import date, datetime
from typing import Optional
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup

from db import (
    find_event_by_hash,
    get_client,
    get_or_create_venue,
    insert_event,
    smart_update_existing_event,
)
from dedupe import generate_content_hash
from entity_lanes import SourceEntityCapabilities, TypedEntityEnvelope
from entity_persistence import persist_typed_entity_envelope
from sources._tribe_events_base import TribeConfig, crawl_tribe

logger = logging.getLogger(__name__)

BASE_URL = "https://www.atlantahistorycenter.com"
EXHIBITIONS_URL = f"{BASE_URL}/exhibitions/"
SUMMER_CAMP_URL = f"{BASE_URL}/programs-events/summer-camp/"
HISTORY_CAMP_URL = f"{BASE_URL}/history-summer-camp/"
WRITING_CAMP_URL = f"{BASE_URL}/writing-summer-camp/"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/122.0.0.0 Safari/537.36"
    )
}

SOURCE_ENTITY_CAPABILITIES = SourceEntityCapabilities(
    events=True,
    destinations=True,
    destination_details=True,
    venue_features=True,
)

VENUE_DATA = {
    "name": "Atlanta History Center",
    "slug": "atlanta-history-center",
    "address": "130 W Paces Ferry Rd NW",
    "neighborhood": "Buckhead",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30305",
    "lat": 33.8422,
    "lng": -84.3864,
    "venue_type": "museum",
    "spot_type": "museum",
    "website": BASE_URL,
    "description": (
        "Atlanta History Center is a 33-acre museum campus in Buckhead exploring Atlanta's "
        "complex history through permanent galleries, rotating exhibitions, historic houses, "
        "and the Swan House gardens. Home to a research library, summer camps, and public programs."
    ),
    # og:image from atlantahistorycenter.com — verified 2026-03-11
    "image_url": "https://www.atlantahistorycenter.com/wp-content/uploads/2023/09/AHC_Social_Graphic.jpg",
    # Hours verified 2026-03-11: Mon-Sat 10am-5:30pm, Sun 12-5:30pm
    "hours": {
        "monday": "10:00-17:30",
        "tuesday": "10:00-17:30",
        "wednesday": "10:00-17:30",
        "thursday": "10:00-17:30",
        "friday": "10:00-17:30",
        "saturday": "10:00-17:30",
        "sunday": "12:00-17:30",
    },
    "vibes": ["historic", "family-friendly", "all-ages", "educational", "gardens"],
}


def _build_destination_envelope(venue_id: int) -> TypedEntityEnvelope:
    envelope = TypedEntityEnvelope()
    envelope.add(
        "destination_details",
        {
            "venue_id": venue_id,
            "destination_type": "history_museum",
            "commitment_tier": "halfday",
            "primary_activity": "family history campus visit",
            "best_seasons": ["spring", "summer", "fall", "winter"],
            "weather_fit_tags": ["outdoor-indoor-mix", "family-daytrip"],
            "parking_type": "free_lot",
            "best_time_of_day": "morning",
            "practical_notes": (
                "Atlanta History Center works best as a half-day campus outing, because museum galleries, historic houses, and garden space can be mixed into a longer family history day. "
                "It rewards families who plan for a slower pace instead of treating it like a quick single-building stop."
            ),
            "accessibility_notes": (
                "The indoor galleries provide the lowest-friction entry point, while the larger campus and historic-house layer adds more walking than a compact museum stop."
            ),
            "family_suitability": "yes",
            "reservation_required": False,
            "permit_required": False,
            "fee_note": "General admission, exhibitions, and special programs vary by date and package.",
            "source_url": BASE_URL,
            "metadata": {
                "source_type": "family_destination_enrichment",
                "venue_type": "museum",
                "city": "atlanta",
            },
        },
    )
    envelope.add(
        "venue_features",
        {
            "venue_id": venue_id,
            "slug": "historic-houses-gardens-and-galleries",
            "title": "Historic houses, gardens, and galleries",
            "feature_type": "amenity",
            "description": "Atlanta History Center works as a fuller family history campus because it combines galleries, historic houses, and gardens in one visit.",
            "url": BASE_URL,
            "is_free": False,
            "sort_order": 10,
        },
    )
    envelope.add(
        "venue_features",
        {
            "venue_id": venue_id,
            "slug": "buckhead-history-campus-day",
            "title": "Buckhead history campus day",
            "feature_type": "amenity",
            "description": "Its Buckhead campus format makes Atlanta History Center more than a single exhibition stop and supports longer family history days.",
            "url": BASE_URL,
            "is_free": False,
            "sort_order": 20,
        },
    )
    envelope.add(
        "venue_features",
        {
            "venue_id": venue_id,
            "slug": "longer-walking-campus-with-indoor-reset-points",
            "title": "Longer walking campus with indoor reset points",
            "feature_type": "amenity",
            "description": "Atlanta History Center asks more walking than a compact museum, but its indoor galleries and campus rhythm make it easier to break the day into manageable pieces.",
            "url": BASE_URL,
            "is_free": False,
            "sort_order": 30,
        },
    )
    return envelope

_SUMMER_CAMP_GRADE_AGES = {
    "K-2": (5, 8),
    "3-5": (8, 11),
    "6-8": (11, 14),
}

_EXHIBITION_EXTRA_URLS = [
    f"{BASE_URL}/our-war-too-women-in-service/",
    f"{BASE_URL}/visit-goizueta-childrens-experience/",
]

_TITLE_SUFFIX_RE = re.compile(
    r"\s*(\|\s*)?(Exhibitions\s*\|\s*)?Atlanta History Center\s*$",
    re.IGNORECASE,
)
_CLOSES_ON_RE = re.compile(
    r"closes on ([A-Z][a-z]+ \d{1,2}, \d{4})",
    re.IGNORECASE,
)
_MONTH_DAY_RANGE_RE = re.compile(r"(June|July)\s+(\d{1,2})\s*-\s*(\d{1,2})", re.IGNORECASE)
_CAMP_SESSION_RE = re.compile(
    r"(.+?)[.!?]\s*(June|July)\s+(\d{1,2})\s*-\s*(\d{1,2})(?:\.\s*Register Now|\.)"
)
_GENERIC_PROGRAM_TITLE_RE = re.compile(r"\b(living room learning lecture|week \d+)\b", re.IGNORECASE)
_GRADE_BAND_RE = re.compile(r"\((K-\d+|\d+-\d+)\)$", re.IGNORECASE)


def _transform_tribe_record(_raw_event: dict, record: dict) -> dict:
    """
    Atlanta History Center's Tribe feed is for timed programs, not exhibit rows.

    Explicitly mark them as events so shared museum/exhibit heuristics do not
    misclassify timed lectures, homeschool days, and family programs.
    """
    record["content_kind"] = "event"
    return record


_CONFIG = TribeConfig(
    base_url=BASE_URL,
    venue_data=VENUE_DATA,
    default_category="community",
    default_tags=["history", "history-museum", "educational", "family-friendly"],
    future_only=True,
    skip_category_slugs=[],
    max_pages=20,
    record_transform=_transform_tribe_record,
)


def _fetch_soup(url: str) -> BeautifulSoup:
    response = requests.get(url, headers=HEADERS, timeout=30)
    response.raise_for_status()
    return BeautifulSoup(response.text, "html.parser")


def _clean_text(value: Optional[str]) -> str:
    return " ".join(html.unescape(value or "").split()).strip()


def _extract_meta_description(soup: BeautifulSoup) -> Optional[str]:
    for key, value in [("name", "description"), ("property", "og:description")]:
        tag = soup.find("meta", attrs={key: value})
        if tag and tag.get("content"):
            desc = _clean_text(tag["content"])
            if len(desc) >= 20:
                return desc
    return None


def _parse_title_from_soup(soup: BeautifulSoup) -> Optional[str]:
    heading = soup.select_one("main h1, article h1, h1")
    if heading:
        title = _clean_text(heading.get_text(" ", strip=True))
        if title:
            return title
    if soup.title:
        title = _clean_text(soup.title.get_text(" ", strip=True))
        title = _TITLE_SUFFIX_RE.sub("", title).strip(" -|")
        if title:
            return title
    return None


def _parse_date(date_str: str) -> Optional[str]:
    try:
        return datetime.strptime(date_str, "%B %d, %Y").strftime("%Y-%m-%d")
    except ValueError:
        return None


def _extract_current_year(text: str) -> int:
    school_year_match = re.search(r"2025\s*-\s*(2026)\s+school year", text, re.IGNORECASE)
    if school_year_match:
        return int(school_year_match.group(1))
    explicit_years = [int(match) for match in re.findall(r"\b(20\d{2})\b", text)]
    explicit_years = [year for year in explicit_years if year >= date.today().year]
    if explicit_years:
        return max(explicit_years)
    return date.today().year


def _collect_exhibition_urls(index_soup: BeautifulSoup) -> list[str]:
    urls: list[str] = []
    seen: set[str] = set()

    for seed_url in _EXHIBITION_EXTRA_URLS:
        urls.append(seed_url)
        seen.add(seed_url)

    widget = index_soup.select_one("ahc-exhibition-index-list")
    if widget and widget.get(":items"):
        try:
            items = json.loads(widget.get(":items"))
        except json.JSONDecodeError:
            logger.warning("Atlanta History Center exhibitions widget JSON could not be parsed")
            items = []

        for item in items:
            if not item.get("onViewCurrently"):
                continue
            link = ((item.get("link") or {}).get("url") or "").strip()
            if not link:
                continue
            absolute = urljoin(BASE_URL, link)
            parsed = urlparse(absolute)
            if parsed.netloc != urlparse(BASE_URL).netloc:
                continue
            if absolute in seen:
                continue
            seen.add(absolute)
            urls.append(absolute)

    return urls


def _parse_exhibition_record(url: str, soup: BeautifulSoup, source_id: int, venue_id: int) -> Optional[dict]:
    text = _clean_text(soup.get_text(" ", strip=True))
    title = _parse_title_from_soup(soup)
    if not title:
        return None
    title_lower = title.lower()
    if any(
        marker in title_lower
        for marker in ["past exhibition", "past exhibitions", "sponsors", "historical reads"]
    ):
        return None

    description = _extract_meta_description(soup)
    if not description:
        paragraphs = [_clean_text(p.get_text(" ", strip=True)) for p in soup.select("main p, article p")]
        description = next((p for p in paragraphs if len(p) >= 60), None)

    close_match = _CLOSES_ON_RE.search(text)
    end_date = _parse_date(close_match.group(1)) if close_match else None
    today = date.today().strftime("%Y-%m-%d")
    if end_date and end_date < today:
        return None

    category = "family" if "children" in title_lower else "art"
    tags = ["history", "museum", "exhibition"]
    if category == "family":
        tags.extend(["family-friendly", "kids"])

    return {
        "source_id": source_id,
        "venue_id": venue_id,
        "title": title,
        "description": description,
        "start_date": today,
        "end_date": end_date,
        "start_time": None,
        "end_time": None,
        "is_all_day": True,
        "category": category,
        "tags": tags,
        "is_free": False,
        "price_min": None,
        "price_max": None,
        "price_note": "Included with admission" if "included with admission" in text.lower() else None,
        "source_url": url,
        "ticket_url": url,
        "image_url": None,
        "raw_text": f"{title} | exhibition",
        "extraction_confidence": 0.88,
        "content_kind": "exhibit",
        "content_hash": generate_content_hash(title, VENUE_DATA["name"], url),
    }


def _parse_camp_sections(page_text: str) -> list[tuple[str, str, str]]:
    sections: list[tuple[str, str, str]] = []
    for grade_band in _SUMMER_CAMP_GRADE_AGES:
        marker = f"Campers {grade_band}"
        start = page_text.find(marker)
        if start == -1:
            continue
        next_positions = [
            page_text.find(f"Campers {other}", start + len(marker))
            for other in _SUMMER_CAMP_GRADE_AGES
            if other != grade_band
        ]
        next_positions = [pos for pos in next_positions if pos != -1]
        end = min(next_positions) if next_positions else len(page_text)
        section_text = page_text[start:end].replace(marker, "", 1).strip()
        sections.append((grade_band, marker, section_text))
    return sections


def _parse_camp_heading_sections(soup: BeautifulSoup) -> list[tuple[str, str]]:
    sections: list[tuple[str, str]] = []
    current_grade_band: Optional[str] = None
    current_entries: list[str] = []

    for heading in soup.select("main h2, article h2"):
        text = _clean_text(heading.get_text(" ", strip=True))
        if not text:
            continue
        if text.startswith("Campers "):
            if current_grade_band and current_entries:
                sections.append((current_grade_band, " ".join(current_entries)))
            current_grade_band = text.replace("Campers ", "", 1).strip()
            current_entries = []
            continue
        if current_grade_band:
            current_entries.append(text)

    if current_grade_band and current_entries:
        sections.append((current_grade_band, " ".join(current_entries)))

    return sections


def _parse_summer_camp_records(url: str, soup: BeautifulSoup, source_id: int, venue_id: int) -> list[dict]:
    title = _parse_title_from_soup(soup) or "Summer Camp"
    text = _clean_text(soup.get_text(" ", strip=True))
    year = _extract_current_year(text)
    records: list[dict] = []

    heading_sections = _parse_camp_heading_sections(soup)
    text_sections = [(grade_band, section_text) for grade_band, _, section_text in _parse_camp_sections(text)]

    for grade_band, section_text in heading_sections or text_sections:
        age_min, age_max = _SUMMER_CAMP_GRADE_AGES[grade_band]
        for match in _CAMP_SESSION_RE.finditer(section_text):
            session_title = _clean_text(match.group(1)).strip("* ")
            month = match.group(2)
            start_day = int(match.group(3))
            end_day = int(match.group(4))
            start_date = datetime.strptime(f"{month} {start_day} {year}", "%B %d %Y").strftime(
                "%Y-%m-%d"
            )
            end_date = datetime.strptime(f"{month} {end_day} {year}", "%B %d %Y").strftime("%Y-%m-%d")

            full_title = f"{title}: {session_title} ({grade_band})"
            records.append(
                {
                    "source_id": source_id,
                    "venue_id": venue_id,
                    "title": full_title,
                    "description": (
                        f"{title} session for grades {grade_band} at Atlanta History Center. "
                        f"Runs {month} {start_day}-{end_day}, {year}."
                    ),
                    "start_date": start_date,
                    "end_date": end_date,
                    "start_time": None,
                    "end_time": None,
                    "is_all_day": True,
                    "category": "family",
                    "tags": [
                        "summer-camp",
                        "family-friendly",
                        "kids",
                        "history",
                        f"grades-{grade_band.lower()}".replace(" ", ""),
                    ],
                    "is_free": False,
                    "price_min": None,
                    "price_max": None,
                    "price_note": None,
                    "source_url": url,
                    "ticket_url": url,
                    "image_url": None,
                    "raw_text": f"{full_title} | summer-camp",
                    "extraction_confidence": 0.90,
                    "content_kind": "event",
                    "age_min": age_min,
                    "age_max": age_max,
                    "content_hash": generate_content_hash(full_title, VENUE_DATA["name"], start_date),
                }
            )

    return records


def _upsert_record(record: dict) -> tuple[int, int]:
    existing = find_event_by_hash(record["content_hash"])
    if existing:
        smart_update_existing_event(existing, record)
        return 0, 1
    insert_event(record)
    return 1, 0


def _crawl_exhibitions(source_id: int, venue_id: int) -> tuple[int, int, int]:
    found = new = updated = 0
    index_soup = _fetch_soup(EXHIBITIONS_URL)
    for url in _collect_exhibition_urls(index_soup):
        try:
            record = _parse_exhibition_record(url, _fetch_soup(url), source_id, venue_id)
        except Exception as exc:
            logger.warning("AHC exhibition fetch failed for %s: %s", url, exc)
            continue
        if not record:
            continue
        found += 1
        added, refreshed = _upsert_record(record)
        new += added
        updated += refreshed
    return found, new, updated


def _crawl_summer_camps(source_id: int, venue_id: int) -> tuple[int, int, int]:
    found = new = updated = 0
    for url in [HISTORY_CAMP_URL, WRITING_CAMP_URL]:
        try:
            records = _parse_summer_camp_records(url, _fetch_soup(url), source_id, venue_id)
        except Exception as exc:
            logger.warning("AHC summer camp fetch failed for %s: %s", url, exc)
            continue
        for record in records:
            found += 1
            added, refreshed = _upsert_record(record)
            new += added
            updated += refreshed
    return found, new, updated


def _normalize_timed_program_rows(source_id: int, venue_id: int) -> int:
    """
    Backfill legacy AHC rows that were persisted as exhibits even though they
    are timed public programs. Future rows with a real start_time should be
    classified as events, not exhibits.
    """
    client = get_client()
    today = date.today().strftime("%Y-%m-%d")
    result = (
        client.table("events")
        .select("id")
        .eq("source_id", source_id)
        .eq("venue_id", venue_id)
        .eq("is_active", True)
        .gte("start_date", today)
        .not_.is_("start_time", "null")
        .neq("content_kind", "event")
        .execute()
    )
    corrected = 0
    for row in result.data or []:
        client.table("events").update({"content_kind": "event"}).eq("id", row["id"]).execute()
        corrected += 1
    if corrected:
        logger.info("Atlanta History Center normalized %d timed rows to content_kind=event", corrected)
    return corrected


def _pick_best_row(rows: list[dict]) -> dict:
    def score(row: dict) -> tuple[int, int]:
        title = str(row.get("title") or "")
        url = str(row.get("source_url") or "")
        specific_url = 1 if "/event/" in url else 0
        generic_penalty = -1 if _GENERIC_PROGRAM_TITLE_RE.search(title) else 0
        return (specific_url + generic_penalty, len(title))

    return max(rows, key=score)


def _normalize_cleanup_title(title: str) -> str:
    value = (title or "").lower()
    value = re.sub(r"[\W_]+", " ", value)
    return " ".join(value.split())


def _titles_look_redundant(rows: list[dict]) -> bool:
    titles = [str(row.get("title") or "").strip() for row in rows]
    if len(titles) > 1 and all(_GRADE_BAND_RE.search(title) for title in titles):
        return False
    normalized = [_normalize_cleanup_title(title) for title in titles]
    normalized = [value for value in normalized if value]
    if len(normalized) < 2:
        return False
    shortest = min(normalized, key=len)
    longest = max(normalized, key=len)
    return shortest == longest or (len(shortest) >= 8 and shortest in longest)


def _select_redundant_row_ids(rows: list[dict]) -> list[int]:
    by_slot: dict[tuple[str, Optional[str]], list[dict]] = defaultdict(list)
    for row in rows:
        by_slot[(row.get("start_date"), row.get("start_time"))].append(row)

    to_deactivate: set[int] = set()

    for slot_rows in by_slot.values():
        if len(slot_rows) < 2:
            continue

        by_url: dict[str, list[dict]] = defaultdict(list)
        for row in slot_rows:
            by_url[str(row.get("source_url") or "")].append(row)

        for same_url_rows in by_url.values():
            if len(same_url_rows) < 2:
                continue
            timed_slot = any(row.get("start_time") for row in same_url_rows)
            if not timed_slot and not _titles_look_redundant(same_url_rows):
                continue
            keeper = _pick_best_row(same_url_rows)
            for row in same_url_rows:
                if row["id"] != keeper["id"]:
                    to_deactivate.add(row["id"])

        remaining = [row for row in slot_rows if row["id"] not in to_deactivate]
        event_page_rows = [row for row in remaining if "/event/" in str(row.get("source_url") or "")]
        generic_rows = [
            row
            for row in remaining
            if _GENERIC_PROGRAM_TITLE_RE.search(str(row.get("title") or ""))
            and "/programs-events/" in str(row.get("source_url") or "")
        ]
        if event_page_rows and generic_rows:
            for row in generic_rows:
                to_deactivate.add(row["id"])

    return sorted(to_deactivate)


def _deactivate_redundant_rows(source_id: int, venue_id: int) -> int:
    client = get_client()
    today = date.today().strftime("%Y-%m-%d")
    result = (
        client.table("events")
        .select("id,title,start_date,start_time,source_url")
        .eq("source_id", source_id)
        .eq("venue_id", venue_id)
        .eq("is_active", True)
        .gte("start_date", today)
        .execute()
    )
    duplicate_ids = _select_redundant_row_ids(result.data or [])
    for event_id in duplicate_ids:
        client.table("events").update({"is_active": False}).eq("id", event_id).execute()
    if duplicate_ids:
        logger.info("Atlanta History Center deactivated %d redundant legacy rows", len(duplicate_ids))
    return len(duplicate_ids)


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl Atlanta History Center timed programs, exhibitions, and camp sessions.
    """
    events_found, events_new, events_updated = crawl_tribe(source, _CONFIG)

    venue_id = get_or_create_venue(VENUE_DATA)
    persist_typed_entity_envelope(_build_destination_envelope(venue_id))

    exhibit_found, exhibit_new, exhibit_updated = _crawl_exhibitions(source["id"], venue_id)
    camp_found, camp_new, camp_updated = _crawl_summer_camps(source["id"], venue_id)

    total_found = events_found + exhibit_found + camp_found
    total_new = events_new + exhibit_new + camp_new
    total_updated = events_updated + exhibit_updated + camp_updated

    total_updated += _normalize_timed_program_rows(source["id"], venue_id)
    total_updated += _deactivate_redundant_rows(source["id"], venue_id)

    logger.info(
        "Atlanta History Center crawl complete: %s found, %s new, %s updated",
        total_found,
        total_new,
        total_updated,
    )
    return total_found, total_new, total_updated
