"""
Crawler for Greater Atlanta Christian specialty summer camps.

Official source:
https://www.greateratlantachristian.org/campus-life/summer-camp/specialty-camps

Pattern role:
Public school summer-hub catalog where each camp card is tagged with visible
week and rising-grade filters. The public page links to the official CampBrain
registration flow, but does not expose deep per-camp registration URLs.
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
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

SOURCE_URL = (
    "https://www.greateratlantachristian.org/campus-life/summer-camp/specialty-camps"
)
REGISTER_URL = "https://gac.campbrainregistration.com/"

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
    "name": "Greater Atlanta Christian School",
    "slug": "greater-atlanta-christian-school",
    "address": "1575 Indian Trail Rd",
    "city": "Norcross",
    "state": "GA",
    "zip": "30093",
    "lat": 33.9231,
    "lng": -84.2012,
    "neighborhood": "Norcross",
    "venue_type": "school",
    "spot_type": "school",
    "website": "https://www.greateratlantachristian.org/",
    "vibes": ["family-friendly", "educational"],
}

BASE_TAGS = ["camp", "family-friendly", "rsvp-required"]

WEEK_RE = re.compile(
    r"(?P<month>[A-Za-z]+)\s+(?P<start_day>\d{1,2})-(?P<end_day>\d{1,2})"
)
TITLE_GRADE_RE = re.compile(
    r"\b(?P<start>K4|K5|K|\d{1,2}(?:st|nd|rd|th)?)\s*-\s*"
    r"(?P<end>K5|K|\d{1,2}(?:st|nd|rd|th)?)\b",
    re.IGNORECASE,
)

GRADE_TO_AGES = {
    "K4": (4, 4),
    "K5": (5, 5),
    "1ST": (6, 6),
    "2ND": (7, 7),
    "3RD": (8, 8),
    "4TH": (9, 9),
    "5TH": (10, 10),
    "6TH": (11, 11),
    "7TH": (12, 12),
    "8TH": (13, 13),
    "9TH": (14, 14),
    "10TH": (15, 15),
    "11TH": (16, 16),
    "12TH": (17, 17),
}


def _clean_text(value: Optional[str]) -> str:
    if not value:
        return ""
    value = value.replace("\xa0", " ").replace("–", "-").replace("—", "-")
    return re.sub(r"\s+", " ", value).strip()


def _normalize_grade_token(value: str) -> str:
    normalized = _clean_text(value).upper()
    if normalized == "K":
        return "K5"
    return normalized


def _grade_label_to_range(label: str) -> tuple[Optional[int], Optional[int]]:
    label = _clean_text(label)
    if label in ("K4", "K5"):
        age = 4 if label == "K4" else 5
        return age, age

    if re.fullmatch(r"\d+(?:st|nd|rd|th)", label, re.IGNORECASE):
        return GRADE_TO_AGES.get(label.upper(), (None, None))

    if "-" in label:
        left, right = [_normalize_grade_token(part) for part in label.split("-", 1)]
        start = GRADE_TO_AGES.get(left)
        end = GRADE_TO_AGES.get(right)
        if start and end:
            return start[0], end[1]

    return None, None


def _combine_grade_ranges(labels: list[str], title: str) -> tuple[Optional[int], Optional[int]]:
    mins: list[int] = []
    maxes: list[int] = []

    for label in labels:
        age_min, age_max = _grade_label_to_range(label)
        if age_min is not None:
            mins.append(age_min)
        if age_max is not None:
            maxes.append(age_max)

    if mins and maxes:
        return min(mins), max(maxes)

    title_match = TITLE_GRADE_RE.search(title)
    if not title_match:
        return None, None

    left = _normalize_grade_token(title_match.group("start"))
    right = _normalize_grade_token(title_match.group("end"))
    start = GRADE_TO_AGES.get(left)
    end = GRADE_TO_AGES.get(right)
    if not start or not end:
        return None, None
    return start[0], end[1]


def _age_band_tags(age_min: Optional[int], age_max: Optional[int]) -> list[str]:
    if age_min is None and age_max is None:
        return []
    lo = age_min if age_min is not None else 0
    hi = age_max if age_max is not None else 18
    tags: list[str] = []
    if lo <= 5 and hi >= 3:
        tags.append("preschool")
    if lo <= 12 and hi >= 5:
        tags.append("elementary")
    if lo <= 13 and hi >= 10:
        tags.append("tween")
    if hi >= 13:
        tags.append("teen")
    return tags


def _derive_tags(title: str, age_min: Optional[int], age_max: Optional[int]) -> list[str]:
    lowered = title.lower()
    tags = list(BASE_TAGS)

    if any(word in lowered for word in ["dance", "ballet", "singing", "broadway", "drama", "film", "art"]):
        tags.append("arts")
    if any(word in lowered for word in ["basketball", "baseball", "golf", "tennis", "volleyball", "cheer", "athlete", "pickleball"]):
        tags.extend(["sports", "movement"])
    if any(word in lowered for word in ["lego", "robotics", "coding", "stem", "chemistry"]):
        tags.append("stem")
    if "chess" in lowered:
        tags.append("chess")

    tags.extend(_age_band_tags(age_min, age_max))
    return list(dict.fromkeys(tags))


def _class_category(title: str) -> str:
    lowered = title.lower()
    if any(word in lowered for word in ["basketball", "baseball", "golf", "tennis", "volleyball", "cheer", "athlete", "pickleball"]):
        return "fitness"
    if any(word in lowered for word in ["dance", "ballet", "singing", "broadway", "drama", "film", "art"]):
        return "arts"
    if any(word in lowered for word in ["lego", "robotics", "coding", "stem", "chemistry", "chess", "writing", "readiness"]):
        return "education"
    return "mixed"


def _parse_week_label(label: str, year: int = 2026) -> tuple[str, str]:
    match = WEEK_RE.search(_clean_text(label))
    if not match:
        raise ValueError(f"Could not parse GAC week label: {label}")

    month = match.group("month")
    start_day = int(match.group("start_day"))
    end_day = int(match.group("end_day"))
    start_dt = datetime.strptime(f"{month} {start_day} {year}", "%B %d %Y")
    end_dt = datetime.strptime(f"{month} {end_day} {year}", "%B %d %Y")
    return start_dt.strftime("%Y-%m-%d"), end_dt.strftime("%Y-%m-%d")


def _parse_filter_maps(soup: BeautifulSoup) -> tuple[dict[str, str], dict[str, str]]:
    week_map: dict[str, str] = {}
    grade_map: dict[str, str] = {}

    for anchor in soup.select("a.fsTagLink[data-tag-id]"):
        tag_id = (anchor.get("data-tag-id") or "").strip()
        label = _clean_text(anchor.get_text(" ", strip=True))
        if tag_id and label and label.lower() != "all":
            week_map[tag_id] = label

    for anchor in soup.select("a.fsCategoryLink[data-category-id]"):
        category_id = (anchor.get("data-category-id") or "").strip()
        label = _clean_text(anchor.get_text(" ", strip=True))
        if category_id and label and label.lower() != "all":
            if label in {"K4", "K5", "1st", "2nd", "3rd", "4th", "5th", "6th", "6th-8th", "9th-12th"}:
                grade_map[category_id] = label

    return grade_map, week_map


def _labels_from_classes(article: Tag, prefix: str, label_map: dict[str, str]) -> list[str]:
    labels: list[str] = []
    for class_name in article.get("class") or []:
        match = re.match(rf"{prefix}-(\d+)", class_name)
        if not match:
            continue
        label = label_map.get(match.group(1))
        if label and label not in labels:
            labels.append(label)
    return labels


def _parse_rows(html: str) -> list[dict]:
    soup = BeautifulSoup(html, "html.parser")
    grade_map, week_map = _parse_filter_maps(soup)
    rows: list[dict] = []

    for article in soup.select("div.fsListItems article[data-post-id]"):
        title_node = article.select_one("div.fsTitle")
        title = _clean_text(title_node.get_text(" ", strip=True) if title_node else "")
        if not title:
            continue

        grade_labels = _labels_from_classes(article, "fsCategory", grade_map)
        week_labels = _labels_from_classes(article, "fsTag", week_map)
        if not week_labels:
            continue

        age_min, age_max = _combine_grade_ranges(grade_labels, title)
        grade_summary = ", ".join(grade_labels) if grade_labels else "see official page"

        for week_label in week_labels:
            start_date, end_date = _parse_week_label(week_label)
            rows.append(
                {
                    "title": title,
                    "description": (
                        f"Official Greater Atlanta Christian specialty camp for rising {grade_summary}. "
                        f"Public catalog lists this session for {week_label} with registration through the school's CampBrain system."
                    ),
                    "source_url": SOURCE_URL,
                    "ticket_url": REGISTER_URL,
                    "start_date": start_date,
                    "end_date": end_date,
                    "start_time": None,
                    "end_time": None,
                    "is_all_day": True,
                    "age_min": age_min,
                    "age_max": age_max,
                    "price_min": None,
                    "price_max": None,
                    "price_note": "See official GAC CampBrain registration flow for current tuition and schedule details.",
                    "class_category": _class_category(title),
                    "tags": _derive_tags(title, age_min, age_max),
                    "hash_key": f"{title}|{grade_summary}|{week_label}",
                }
            )

    rows.sort(key=lambda row: (row["start_date"], row["title"], row["hash_key"]))
    return rows


def _build_event_record(source_id: int, venue_id: int, row: dict) -> dict:
    title = f"{row['title']} at Greater Atlanta Christian"
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
        "class_category": row["class_category"],
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
        "content_hash": generate_content_hash(
            f"{title} [{row['hash_key']}]", PLACE_DATA["name"], row["start_date"]
        ),
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
        logger.error("Greater Atlanta Christian specialty camps: fetch failed: %s", exc)
        return 0, 0, 0

    today = date.today().strftime("%Y-%m-%d")
    venue_id = get_or_create_place(PLACE_DATA)

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
                "Greater Atlanta Christian specialty camps: failed to process %s (%s): %s",
                row.get("title"),
                row.get("start_date"),
                exc,
            )

    return events_found, events_new, events_updated
