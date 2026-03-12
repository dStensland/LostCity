"""
Crawler for Spruill Center for the Arts summer camps.

Official source:
https://spruillarts.org/camps/

Pattern role:
Official camp landing page with public course-detail registration pages that
expose exact titles, dates, times, and pricing for each summer camp session.
"""

from __future__ import annotations

import logging
import re
from datetime import date, datetime
from typing import Optional
from urllib.parse import parse_qs, urljoin, urlparse

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

SOURCE_URL = "https://spruillarts.org/camps/"
BASE_URL = "https://spruillarts.org"

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
    "name": "Spruill Center for the Arts",
    "slug": "spruill-center-for-the-arts",
    "address": "5339 Chamblee Dunwoody Rd",
    "city": "Dunwoody",
    "state": "GA",
    "zip": "30338",
    "neighborhood": "Dunwoody",
    "venue_type": "arts_center",
    "spot_type": "arts_center",
    "website": BASE_URL,
    "vibes": ["family-friendly", "artsy", "all-ages"],
}

BASE_TAGS = [
    "camp",
    "arts",
    "family-friendly",
    "rsvp-required",
]

COURSE_URL_RE = re.compile(r"CourseStatus\.awp\?course=(26C[0-9A-Z]+)", re.IGNORECASE)
FEE_RE = re.compile(r"\$([0-9]+(?:\.[0-9]{2})?)")
TITLE_SUFFIX_RE = re.compile(r"\s*-\s*26C[0-9A-Z]+\s*-\s*Spruill Center for the Arts$", re.I)
AGES_RE = re.compile(r"Ages?\s*(\d+)\s*[-–]\s*(\d+)", re.IGNORECASE)
RISING_GRADES_RE = re.compile(r"Rising\s+(\d+)(?:st|nd|rd|th)\s*-\s*(\d+)(?:st|nd|rd|th)\s+Graders", re.I)
DATE_CELL_RE = re.compile(r"^\d{2}/\d{2}/\d{4}$")
TIME_CELL_RE = re.compile(r"(\d{1,2}:\d{2}\s*[AP]M)\s+to\s+(\d{1,2}(?::\d{2})?\s*[AP]M)", re.I)


def _clean_text(value: Optional[str]) -> str:
    if not value:
        return ""
    value = value.replace("\xa0", " ").replace("–", "-").replace("—", "-")
    return re.sub(r"\s+", " ", value).strip()


def _course_id(url: str) -> Optional[str]:
    match = COURSE_URL_RE.search(url)
    return match.group(1).upper() if match else None


def _course_url(url: str) -> str:
    course_id = _course_id(url)
    return (
        f"https://registration.spruillarts.org/wconnect/CourseStatus.awp?course={course_id}"
        if course_id
        else url
    )


def _parse_course_links(html: str) -> list[str]:
    soup = BeautifulSoup(html, "html.parser")
    seen: set[str] = set()
    urls: list[str] = []
    for anchor in soup.find_all("a", href=True):
        href = urljoin(SOURCE_URL, anchor["href"])
        course_id = _course_id(href)
        if not course_id:
            continue
        if not course_id.startswith("26C"):
            continue
        normalized = _course_url(href)
        if normalized not in seen:
            seen.add(normalized)
            urls.append(normalized)
    return urls


def _parse_title(soup: BeautifulSoup) -> str:
    raw_title = _clean_text(soup.title.get_text(" ", strip=True) if soup.title else "")
    raw_title = TITLE_SUFFIX_RE.sub("", raw_title)
    return raw_title.strip(" -")


def _parse_age_range(title: str, course_id: str) -> tuple[Optional[int], Optional[int]]:
    match = AGES_RE.search(title)
    if match:
        return int(match.group(1)), int(match.group(2))

    rising_match = RISING_GRADES_RE.search(title)
    if rising_match:
        # Approximate rising grades into age bands for summer-camp discovery.
        lo_grade = int(rising_match.group(1))
        hi_grade = int(rising_match.group(2))
        return lo_grade + 5, hi_grade + 6

    if course_id.endswith("CAMP"):
        return 5, 10
    if "SPC" in course_id:
        return 11, 14
    return None, None


def _age_band_tags(age_min: Optional[int], age_max: Optional[int]) -> list[str]:
    if age_min is None and age_max is None:
        return []
    lo = age_min if age_min is not None else 0
    hi = age_max if age_max is not None else 18
    tags: list[str] = []
    if lo <= 12 and hi >= 5:
        tags.append("elementary")
    if lo <= 14 and hi >= 11:
        tags.append("preteen")
    if hi >= 13:
        tags.append("teen")
    return list(dict.fromkeys(tags))


def _derive_tags(title: str, age_min: Optional[int], age_max: Optional[int]) -> list[str]:
    lowered = title.lower()
    tags = list(BASE_TAGS)
    if any(keyword in lowered for keyword in ["watercolor", "painting", "draw", "illustration"]):
        tags.append("painting")
    if any(keyword in lowered for keyword in ["fiber", "sewing", "textile"]):
        tags.append("fiber-arts")
    if any(keyword in lowered for keyword in ["film", "animatic", "storytelling"]):
        tags.append("media-arts")
    if any(keyword in lowered for keyword in ["ceramics", "clay"]):
        tags.append("ceramics")
    if any(keyword in lowered for keyword in ["jewelry", "metal"]):
        tags.append("crafts")
    tags.extend(_age_band_tags(age_min, age_max))
    return list(dict.fromkeys(tags))


def _parse_detail_row(url: str, html: str) -> Optional[dict]:
    soup = BeautifulSoup(html, "html.parser")
    title = _parse_title(soup)
    if not title or title.lower().startswith("not a valid course"):
        return None

    course_id = parse_qs(urlparse(url).query).get("course", [""])[0].upper()
    age_min, age_max = _parse_age_range(title, course_id)

    price_value = None
    date_values: list[datetime] = []
    start_time = None
    end_time = None

    for th in soup.find_all("th"):
        if _clean_text(th.get_text(" ", strip=True)).lower() != "fee:":
            continue
        td = th.find_next("td")
        if td:
            price_match = FEE_RE.search(_clean_text(td.get_text(" ", strip=True)))
            if price_match:
                price_value = float(price_match.group(1))
                break

    for td in soup.find_all("td"):
        text = _clean_text(td.get_text(" ", strip=True))
        if DATE_CELL_RE.match(text):
            try:
                date_values.append(datetime.strptime(text, "%m/%d/%Y"))
            except ValueError:
                pass
            continue
        if start_time is None:
            time_match = TIME_CELL_RE.search(text)
            if time_match:
                start_time = datetime.strptime(time_match.group(1), "%I:%M %p").strftime("%H:%M")
                end_text = time_match.group(2)
                end_fmt = "%I:%M %p" if ":" in end_text else "%I %p"
                end_time = datetime.strptime(end_text, end_fmt).strftime("%H:%M")

    if not date_values:
        return None

    start_date = min(date_values).strftime("%Y-%m-%d")
    end_date = max(date_values).strftime("%Y-%m-%d")
    start_time = start_time or "09:30"
    end_time = end_time or "15:00"

    duration_days = len({dt.strftime("%Y-%m-%d") for dt in date_values})
    price_note = f"${price_value:.0f}" if price_value is not None else "See official course page for pricing."
    if duration_days >= 8:
        price_note = f"{price_note} Multi-day intensive session."
    elif duration_days == 4:
        price_note = f"{price_note} 4-day camp week."

    description = (
        f"Summer art camp at Spruill Center for the Arts. "
        f"Official course page lists {duration_days} camp day"
        f"{'' if duration_days == 1 else 's'} from {start_time} to {end_time}."
    )

    return {
        "title": f"Spruill Summer Camp: {title}",
        "description": description,
        "source_url": SOURCE_URL,
        "ticket_url": url,
        "start_date": start_date,
        "end_date": end_date,
        "start_time": start_time,
        "end_time": end_time,
        "is_all_day": False,
        "age_min": age_min,
        "age_max": age_max,
        "price_min": price_value,
        "price_max": price_value,
        "price_note": price_note,
        "tags": _derive_tags(title, age_min, age_max),
    }


def _parse_rows(landing_html: str, detail_html_map: dict[str, str]) -> list[dict]:
    rows: list[dict] = []
    for url in _parse_course_links(landing_html):
        detail_html = detail_html_map.get(url)
        if not detail_html:
            continue
        row = _parse_detail_row(url, detail_html)
        if row:
            rows.append(row)
    rows.sort(key=lambda row: (row["start_date"], row["title"]))
    return rows


def _build_event_record(source_id: int, venue_id: int, row: dict) -> dict:
    title = f"{row['title']} at Spruill Center for the Arts"
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
        landing_response = requests.get(SOURCE_URL, headers=REQUEST_HEADERS, timeout=30)
        landing_response.raise_for_status()
        course_urls = _parse_course_links(landing_response.text)
        detail_html_map: dict[str, str] = {}
        for url in course_urls:
            response = requests.get(url, headers=REQUEST_HEADERS, timeout=30)
            if response.ok:
                detail_html_map[url] = response.text
        rows = _parse_rows(landing_response.text, detail_html_map)
    except Exception as exc:
        logger.error("Spruill Summer Camps: fetch failed: %s", exc)
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
                "Spruill Summer Camps: failed to process %s (%s): %s",
                row.get("title"),
                row.get("start_date"),
                exc,
            )

    return events_found, events_new, events_updated
