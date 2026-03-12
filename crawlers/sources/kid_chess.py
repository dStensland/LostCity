"""
Crawler for Kid Chess seasonal camps and tournaments.

Official source:
https://www.kidchess.com/our-programs/seasonal-camps/

Pattern role:
This is the first implementation of the public camp-table pattern. Kid Chess
publishes server-rendered seasonal camp tables with date ranges, grade bands,
session/time matrices, venue cells, and a public registration landing page.
"""

from __future__ import annotations

import logging
import re
from datetime import datetime
from itertools import zip_longest
from typing import Optional
from urllib.parse import urljoin

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

BASE_URL = "https://www.kidchess.com"
SEASONAL_CAMPS_URL = f"{BASE_URL}/our-programs/seasonal-camps/"

REQUEST_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/122.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml",
    "Accept-Language": "en-US,en;q=0.9",
}

BASE_TAGS = [
    "kids",
    "family-friendly",
    "educational",
    "seasonal",
    "rsvp-required",
    "chess",
]

DATE_RANGE_RE = re.compile(
    r"(?P<start_month>[A-Za-z]+)\s+(?P<start_day>\d{1,2})(?:st|nd|rd|th)?\s*[–-]\s*"
    r"(?:(?P<end_month>[A-Za-z]+)\s+)?(?P<end_day>\d{1,2})(?:st|nd|rd|th)?",
    re.IGNORECASE,
)
SINGLE_DATE_RE = re.compile(
    r"(?:[A-Za-z]+,\s+)?(?P<month>[A-Za-z]+)\s+(?P<day>\d{1,2})(?:st|nd|rd|th)?",
    re.IGNORECASE,
)
CITY_STATE_ZIP_RE = re.compile(
    r"(?P<city>[A-Za-z .'-]+),\s*(?P<state>[A-Z]{2})\s+(?P<zip>\d{5})"
)
PRICE_RE = re.compile(r"\$([0-9]+(?:\.[0-9]{2})?)")

VENUE_OVERRIDES = {
    "chess zone": {
        "address": "2500 Old Alabama Rd Suite 11",
        "city": "Roswell",
        "state": "GA",
        "zip": "30076",
        "neighborhood": "Roswell",
    }
}


def _clean_text(value: Optional[str]) -> str:
    if not value:
        return ""
    return re.sub(r"\s+", " ", value).strip()


def _slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return re.sub(r"-{2,}", "-", slug)


def _normalize_venue_key(value: str) -> str:
    text = _clean_text(value).lower()
    text = re.sub(r"\bsummer camp\b", "", text)
    text = text.replace("&", "and")
    text = re.sub(r"[^a-z0-9]+", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def _age_band_tags(age_min: Optional[int], age_max: Optional[int]) -> list[str]:
    if age_min is None and age_max is None:
        return []

    floor = age_min if age_min is not None else 0
    ceiling = age_max if age_max is not None else 18
    tags: list[str] = []
    if floor <= 5 and ceiling >= 3:
        tags.append("preschool")
    if floor <= 12 and ceiling >= 5:
        tags.append("elementary")
    if floor <= 13 and ceiling >= 10:
        tags.append("tween")
    if 13 <= ceiling <= 18 or 13 <= floor < 18:
        tags.append("teen")
    return tags


def _parse_section_year(section_title: str) -> Optional[int]:
    match = re.search(r"\b(20\d{2})\b", section_title)
    if not match:
        return None
    return int(match.group(1))


def _strip_year(text: str) -> str:
    return _clean_text(re.sub(r"\b20\d{2}\b", "", text)).strip(" -")


def _normalize_program_label(section_title: str) -> str:
    label = _strip_year(section_title)
    label = re.sub(r"\bSummer Camps\b", "Summer Camp", label, flags=re.IGNORECASE)
    if not label.lower().startswith("kid chess"):
        label = f"Kid Chess {label}"
    return _clean_text(label)


def _extract_cell_lines(cell: Tag) -> list[str]:
    return [_clean_text(text) for text in cell.stripped_strings if _clean_text(text)]


def _parse_month_day(value: str, year: int) -> Optional[datetime]:
    cleaned = _clean_text(value)
    for fmt in ("%B %d %Y", "%b %d %Y"):
        try:
            return datetime.strptime(f"{cleaned} {year}", fmt)
        except ValueError:
            continue
    return None


def _parse_date_text(raw_text: str, year: int) -> tuple[Optional[str], Optional[str]]:
    text = _clean_text(raw_text).replace("—", "–")
    if not text:
        return None, None

    match = DATE_RANGE_RE.search(text)
    if match:
        start_month = match.group("start_month")
        end_month = match.group("end_month") or start_month
        start_dt = _parse_month_day(
            f"{start_month} {match.group('start_day')}",
            year,
        )
        end_dt = _parse_month_day(
            f"{end_month} {match.group('end_day')}",
            year,
        )
        if start_dt and end_dt:
            return start_dt.strftime("%Y-%m-%d"), end_dt.strftime("%Y-%m-%d")

    match = SINGLE_DATE_RE.search(text)
    if match:
        dt = _parse_month_day(f"{match.group('month')} {match.group('day')}", year)
        if dt:
            iso = dt.strftime("%Y-%m-%d")
            return iso, iso

    return None, None


def _grade_to_age_floor(token: str) -> Optional[int]:
    cleaned = _clean_text(token).lower()
    cleaned = cleaned.replace("rising", "").replace("grade", "").strip()
    cleaned = cleaned.replace("girls only", "").strip()

    if cleaned in {"0k", "pre-k", "prek", "pre k", "pk"}:
        return 4
    if cleaned in {"kindergarten", "k"}:
        return 5

    match = re.search(r"(\d{1,2})", cleaned)
    if not match:
        return None
    return int(match.group(1)) + 5


def _parse_grade_range(
    grade_text: str,
) -> tuple[Optional[int], Optional[int], list[str]]:
    cleaned = _clean_text(grade_text).replace("—", "–")
    if not cleaned:
        return None, None, []

    parts = re.split(r"\s*[–-]\s*", cleaned, maxsplit=1)
    if len(parts) == 2:
        start_age = _grade_to_age_floor(parts[0])
        end_age_floor = _grade_to_age_floor(parts[1])
        if start_age is not None and end_age_floor is not None:
            age_max = end_age_floor + 1
            return start_age, age_max, _age_band_tags(start_age, age_max)

    age = _grade_to_age_floor(cleaned)
    if age is not None:
        return age, age + 1, _age_band_tags(age, age + 1)

    return None, None, []


def _parse_price_options(
    session_cell: Tag,
    time_cell: Tag,
    tuition_cell: Tag,
) -> tuple[list[dict], Optional[float], Optional[float], Optional[str], bool]:
    session_labels = _extract_cell_lines(session_cell)
    time_labels = _extract_cell_lines(time_cell)
    tuition_labels = _extract_cell_lines(tuition_cell)

    normalized_times: list[str] = []
    current_time = ""
    for entry in time_labels:
        if entry == "^^^":
            normalized_times.append(current_time)
            continue
        current_time = entry
        normalized_times.append(entry)

    options: list[dict] = []
    prices: list[float] = []

    for label, option_time, tuition in zip_longest(
        session_labels,
        normalized_times,
        tuition_labels,
        fillvalue="",
    ):
        price_match = PRICE_RE.search(tuition or "")
        price_value = float(price_match.group(1)) if price_match else None
        if price_value is not None:
            prices.append(price_value)
        options.append(
            {
                "label": _clean_text(label),
                "time": _clean_text(option_time),
                "tuition": _clean_text(tuition),
                "price": price_value,
            }
        )

    price_min = min(prices) if prices else None
    price_max = max(prices) if prices else None
    is_free = bool(prices) and max(prices) == 0.0

    summary_parts: list[str] = []
    for option in options:
        part = option["label"] or "Option"
        if option["time"]:
            part += f" ({option['time']})"
        if option["tuition"]:
            part += f" {option['tuition']}"
        summary_parts.append(part.strip())

    price_note = (
        f"Options: {'; '.join(summary_parts)}"
        if summary_parts
        else "Registration required. See website for current pricing."
    )

    return options, price_min, price_max, price_note, is_free


def _parse_venue_cell(cell: Tag) -> dict:
    lines = _extract_cell_lines(cell)
    if not lines:
        return {}

    raw_name = lines[0]
    venue_name = re.sub(r"\s+Summer Camp$", "", raw_name, flags=re.IGNORECASE).strip()
    venue_name = re.sub(r"\s+Camp$", "", venue_name, flags=re.IGNORECASE).strip()

    anchor = cell.find("a", href=True)
    venue_url = urljoin(BASE_URL, anchor["href"]) if anchor else None

    address = None
    city = None
    state = "GA"
    zip_code = None
    neighborhood = None

    if len(lines) >= 3:
        city_state_zip_line = lines[-1]
        match = CITY_STATE_ZIP_RE.search(city_state_zip_line)
        if match:
            city = _clean_text(match.group("city"))
            state = match.group("state")
            zip_code = match.group("zip")
            neighborhood = city
            address = _clean_text(" ".join(lines[1:-1]))
    elif len(lines) == 2:
        match = CITY_STATE_ZIP_RE.search(lines[-1])
        if match:
            city = _clean_text(match.group("city"))
            state = match.group("state")
            zip_code = match.group("zip")
            neighborhood = city

    venue_key = _normalize_venue_key(venue_name)
    override = VENUE_OVERRIDES.get(venue_key, {})
    if not address and override:
        address = override.get("address")
        city = city or override.get("city")
        state = override.get("state", state)
        zip_code = zip_code or override.get("zip")
        neighborhood = neighborhood or override.get("neighborhood")

    return {
        "raw_name": raw_name,
        "name": venue_name,
        "key": venue_key,
        "address": address,
        "city": city,
        "state": state,
        "zip": zip_code,
        "neighborhood": neighborhood,
        "website": venue_url,
    }


def _infer_venue_type(venue_name: str) -> str:
    lowered = venue_name.lower()
    if "school" in lowered:
        return "institution"
    return "organization"


def _build_venue_data(row: dict) -> dict:
    venue_name = row["venue_name"]
    return {
        "name": venue_name,
        "slug": f"kid-chess-{_slugify(venue_name)}",
        "address": row["address"],
        "city": row["city"] or "Atlanta",
        "state": row["state"] or "GA",
        "zip": row["zip"],
        "neighborhood": row["neighborhood"] or row["city"] or "Atlanta",
        "venue_type": _infer_venue_type(venue_name),
        "spot_type": "education",
        "website": row["venue_url"] or SEASONAL_CAMPS_URL,
        "vibes": ["family-friendly", "educational"],
    }


def _backfill_venue_details(rows: list[dict]) -> None:
    venue_map = {
        row["venue_key"]: row
        for row in rows
        if row.get("address") and row.get("city") and row.get("zip")
    }

    for row in rows:
        if row.get("address") and row.get("city") and row.get("zip"):
            continue
        matched = venue_map.get(row["venue_key"])
        if not matched:
            continue
        for key in ("address", "city", "state", "zip", "neighborhood", "venue_url"):
            if not row.get(key):
                row[key] = matched.get(key)


def _parse_section(section_title: str, section_node: Tag) -> list[dict]:
    section_year = _parse_section_year(section_title)
    if section_year is None:
        return []

    table = section_node.find("table")
    if table is None:
        return []

    register_link = section_node.find(
        "a", href=True, string=re.compile("register", re.I)
    )
    registration_url = (
        urljoin(BASE_URL, register_link["href"])
        if register_link
        else f"{BASE_URL}/register/"
    )
    program_label = _normalize_program_label(section_title)
    section_lower = section_title.lower()

    rows: list[dict] = []
    for row in table.find_all("tr"):
        cells = row.find_all("td")
        if len(cells) != 6:
            continue

        venue_data = _parse_venue_cell(cells[0])
        if not venue_data:
            continue

        start_date, end_date = _parse_date_text(
            cells[1].get_text(" ", strip=True), section_year
        )
        if not start_date:
            continue

        grade_text = _clean_text(cells[2].get_text(" ", strip=True))
        age_min, age_max, age_tags = _parse_grade_range(grade_text)
        options, price_min, price_max, price_note, is_free = _parse_price_options(
            cells[3],
            cells[4],
            cells[5],
        )
        girls_only = "girls only" in grade_text.lower() or "girls" in section_lower

        rows.append(
            {
                "section_title": _clean_text(section_title),
                "program_label": program_label,
                "venue_name": venue_data["name"],
                "venue_key": venue_data["key"],
                "venue_url": venue_data.get("website"),
                "address": venue_data.get("address"),
                "city": venue_data.get("city"),
                "state": venue_data.get("state"),
                "zip": venue_data.get("zip"),
                "neighborhood": venue_data.get("neighborhood"),
                "start_date": start_date,
                "end_date": end_date,
                "grade_text": grade_text,
                "age_min": age_min,
                "age_max": age_max,
                "age_tags": age_tags,
                "girls_only": girls_only,
                "options": options,
                "price_min": price_min,
                "price_max": price_max,
                "price_note": price_note,
                "is_free": is_free,
                "registration_url": registration_url,
            }
        )

    return rows


def _parse_page(soup: BeautifulSoup) -> list[dict]:
    rows: list[dict] = []
    for heading in soup.find_all("h6"):
        title = _clean_text(heading.get_text(" ", strip=True))
        if not title or "camp" not in title.lower():
            continue
        section_node = heading.find_next_sibling("div")
        if section_node is None:
            continue
        rows.extend(_parse_section(title, section_node))

    _backfill_venue_details(rows)
    return rows


def _build_description(row: dict) -> str:
    description = (
        f"{row['program_label']} for {row['grade_text']} at {row['venue_name']}. "
        f"{row['price_note']}"
    )
    return description[:1000]


def _build_event_record(source_id: int, venue_id: int, row: dict) -> dict:
    tags = list(dict.fromkeys(BASE_TAGS + row.get("age_tags", [])))
    if row.get("girls_only"):
        tags.append("girls-only")

    title = f"{row['program_label']} at {row['venue_name']}"
    content_hash = generate_content_hash(title, row["venue_name"], row["start_date"])

    raw_options = " | ".join(
        [
            " / ".join(
                filter(
                    None,
                    [option.get("label"), option.get("time"), option.get("tuition")],
                )
            )
            for option in row.get("options", [])
        ]
    )

    record = {
        "source_id": source_id,
        "venue_id": venue_id,
        "title": title,
        "description": _build_description(row),
        "start_date": row["start_date"],
        "start_time": None,
        "end_date": row["end_date"],
        "end_time": None,
        "is_all_day": True,
        "category": "programs",
        "subcategory": "camp",
        "class_category": "education",
        "tags": tags,
        "price_min": row.get("price_min"),
        "price_max": row.get("price_max"),
        "price_note": row.get("price_note"),
        "is_free": row.get("is_free", False),
        "source_url": SEASONAL_CAMPS_URL,
        "ticket_url": row.get("registration_url"),
        "image_url": None,
        "raw_text": (
            f"{row['section_title']} | {row['venue_name']} | {row['grade_text']} | "
            f"{row['start_date']} | {raw_options}"
        ),
        "extraction_confidence": 0.9,
        "is_recurring": False,
        "recurrence_rule": None,
        "content_hash": content_hash,
    }
    if row.get("age_min") is not None:
        record["age_min"] = row["age_min"]
    if row.get("age_max") is not None:
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
        response = session.get(SEASONAL_CAMPS_URL, timeout=30)
        response.raise_for_status()
    except Exception as exc:
        logger.error("Kid Chess: failed to fetch seasonal camps page: %s", exc)
        return 0, 0, 0

    rows = _parse_page(BeautifulSoup(response.text, "html.parser"))
    venue_cache: dict[str, int] = {}

    for row in rows:
        try:
            if not row.get("address") or not row.get("city"):
                logger.warning(
                    "Kid Chess: skipping row without resolved venue address: %s / %s",
                    row["program_label"],
                    row["venue_name"],
                )
                continue

            venue_key = row["venue_key"]
            if venue_key not in venue_cache:
                venue_cache[venue_key] = get_or_create_venue(_build_venue_data(row))
            venue_id = venue_cache[venue_key]

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
                "Kid Chess: failed to process %s at %s: %s",
                row.get("program_label"),
                row.get("venue_name"),
                exc,
            )

    logger.info(
        "Kid Chess crawl complete: %d found, %d new, %d updated",
        events_found,
        events_new,
        events_updated,
    )
    return events_found, events_new, events_updated
