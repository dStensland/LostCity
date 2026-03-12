"""
Crawler for The Lovett School summer programs catalog.

Official sources:
https://www.lovett.org/community/summer-programs
https://www.lovett.org/community/summer-programs/search-programs

Pattern role:
Finalsite summer-program board with visible type, week, and school-level
taxonomy on the public page. The public board does not expose stable deep
detail pages, so Hooky uses the official catalog board as the source URL.
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

LANDING_URL = "https://www.lovett.org/community/summer-programs"
SOURCE_URL = "https://www.lovett.org/community/summer-programs/search-programs"

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
    "name": "The Lovett School",
    "slug": "the-lovett-school",
    "address": "4075 Paces Ferry Rd NW",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30327",
    "neighborhood": "Buckhead",
    "venue_type": "school",
    "spot_type": "school",
    "website": "https://www.lovett.org/",
    "vibes": ["family-friendly", "educational"],
}

BASE_TAGS = ["family-friendly", "rsvp-required"]

WEEK_RE = re.compile(
    r"Week\s+\d+:\s+(?P<month>[A-Za-z]+)\s+(?P<start_day>\d{1,2})-(?P<end_day>\d{1,2})"
)
TITLE_GRADE_RE = re.compile(
    r"Grades?\s+(?P<start>K|\d{1,2})\s*[-to]+\s*(?P<end>K|\d{1,2})",
    re.IGNORECASE,
)

CATEGORY_CLASS_CATEGORY = {
    "Academic": "education",
    "Arts": "arts",
    "Before & After Care": "mixed",
    "Camp Lovett": "mixed",
    "Driver's Education": "education",
    "STEAM": "education",
    "Specialty Camps": "mixed",
    "Sports": "fitness",
    "Summer School": "education",
}

CATEGORY_TAGS = {
    "Academic": ["academic"],
    "Arts": ["arts"],
    "Before & After Care": ["before-care", "after-care"],
    "Camp Lovett": ["camp"],
    "Driver's Education": ["drivers-ed"],
    "STEAM": ["stem"],
    "Specialty Camps": ["camp"],
    "Sports": ["sports", "movement"],
    "Summer School": ["summer-school"],
}

SCHOOL_LEVEL_AGES = {
    "Lower School": (5, 10),
    "Middle School": (11, 13),
    "Upper School": (14, 17),
    "High School": (14, 17),
}


def _clean_text(value: Optional[str]) -> str:
    if not value:
        return ""
    value = value.replace("\xa0", " ").replace("–", "-").replace("—", "-")
    return re.sub(r"\s+", " ", value).strip()


def _grade_token_to_age(token: str) -> Optional[int]:
    normalized = _clean_text(token).upper()
    if normalized == "K":
        return 5
    if normalized.isdigit():
        return int(normalized) + 5
    return None


def _parse_title_grade_range(title: str) -> tuple[Optional[int], Optional[int]]:
    match = TITLE_GRADE_RE.search(_clean_text(title))
    if not match:
        return None, None
    start = _grade_token_to_age(match.group("start"))
    end = _grade_token_to_age(match.group("end"))
    if start is None or end is None:
        return None, None
    return start, end


def _school_level_age_range(levels: list[str]) -> tuple[Optional[int], Optional[int]]:
    mins: list[int] = []
    maxes: list[int] = []
    for level in levels:
        age_range = SCHOOL_LEVEL_AGES.get(level)
        if age_range:
            mins.append(age_range[0])
            maxes.append(age_range[1])
    if mins and maxes:
        return min(mins), max(maxes)
    return None, None


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
    if hi >= 13:
        tags.append("teen")
    return tags


def _parse_week_label(label: str, year: int = 2026) -> tuple[str, str]:
    match = WEEK_RE.search(_clean_text(label))
    if not match:
        raise ValueError(f"Could not parse Lovett week label: {label}")
    month = match.group("month")
    start_day = int(match.group("start_day"))
    end_day = int(match.group("end_day"))
    start_dt = datetime.strptime(f"{month} {start_day} {year}", "%B %d %Y")
    end_dt = datetime.strptime(f"{month} {end_day} {year}", "%B %d %Y")
    return start_dt.strftime("%Y-%m-%d"), end_dt.strftime("%Y-%m-%d")


def _parse_filter_maps(soup: BeautifulSoup) -> tuple[dict[str, str], dict[str, str]]:
    category_map: dict[str, str] = {}
    school_level_map: dict[str, str] = {}

    for anchor in soup.select("a.fsCategoryLink[data-category-id]"):
        category_id = (anchor.get("data-category-id") or "").strip()
        label = _clean_text(anchor.get_text(" ", strip=True))
        if category_id and label and label.lower() != "all":
            category_map[category_id] = label

    for anchor in soup.select("a.fsTagLink[data-tag-id]"):
        tag_id = (anchor.get("data-tag-id") or "").strip()
        label = _clean_text(anchor.get_text(" ", strip=True))
        if tag_id and label and label.lower() != "all":
            school_level_map[tag_id] = label

    return category_map, school_level_map


def _labels_from_article(article: Tag, prefix: str, label_map: dict[str, str]) -> list[str]:
    labels: list[str] = []
    for class_name in article.get("class") or []:
        match = re.match(rf"{prefix}-(\d+)", class_name)
        if not match:
            continue
        label = label_map.get(match.group(1))
        if label and label not in labels:
            labels.append(label)
    return labels


def _derive_tags(
    title: str,
    category_labels: list[str],
    school_levels: list[str],
    age_min: Optional[int],
    age_max: Optional[int],
) -> list[str]:
    tags = list(BASE_TAGS)
    lowered = title.lower()

    for label in category_labels:
        tags.extend(CATEGORY_TAGS.get(label, []))

    if any(word in lowered for word in ["chess", "math", "science", "engineer", "minecraft"]):
        tags.append("stem")
    if any(word in lowered for word in ["theatre", "choral", "art", "movie", "craft"]):
        tags.append("arts")
    if any(word in lowered for word in ["lacrosse", "soccer", "tennis", "basketball", "football", "volleyball", "golf", "wrestling"]):
        tags.extend(["sports", "movement"])

    for level in school_levels:
        if level == "Lower School":
            tags.append("elementary")
        if level == "Middle School":
            tags.append("tween")
        if level in {"Upper School", "High School"}:
            tags.append("teen")

    tags.extend(_age_band_tags(age_min, age_max))
    return list(dict.fromkeys(tags))


def _build_source_url(category_ids: list[str]) -> str:
    if len(category_ids) == 1:
        return f"{SOURCE_URL}?post_category_id={category_ids[0]}"
    return SOURCE_URL


def _parse_rows(html: str) -> list[dict]:
    soup = BeautifulSoup(html, "html.parser")
    category_map, school_level_map = _parse_filter_maps(soup)
    rows: list[dict] = []

    for article in soup.select("div.fsListItems article[data-post-id]"):
        title_node = article.select_one("div.fsTitle")
        title = _clean_text(title_node.get_text(" ", strip=True) if title_node else "")
        if not title:
            continue

        category_ids: list[str] = []
        week_labels: list[str] = []
        category_labels: list[str] = []
        for class_name in article.get("class") or []:
            match = re.match(r"fsCategory-(\d+)", class_name)
            if not match:
                continue
            category_id = match.group(1)
            label = category_map.get(category_id)
            if not label:
                continue
            if label.startswith("Week "):
                if label not in week_labels:
                    week_labels.append(label)
            else:
                category_ids.append(category_id)
                if label not in category_labels:
                    category_labels.append(label)

        if not week_labels:
            continue

        school_levels = _labels_from_article(article, "fsTag", school_level_map)
        age_min, age_max = _parse_title_grade_range(title)
        if age_min is None and age_max is None:
            age_min, age_max = _school_level_age_range(school_levels)

        source_url = _build_source_url(sorted(set(category_ids)))
        category_summary = ", ".join(category_labels) if category_labels else "summer programs"
        school_summary = ", ".join(school_levels) if school_levels else "school-aged students"

        for week_label in week_labels:
            start_date, end_date = _parse_week_label(week_label)
            rows.append(
                {
                    "title": title,
                    "description": (
                        f"Official Summer at Lovett catalog entry in {category_summary} "
                        f"for {school_summary}, listed for {week_label}."
                    ),
                    "source_url": source_url,
                    "ticket_url": source_url,
                    "start_date": start_date,
                    "end_date": end_date,
                    "start_time": None,
                    "end_time": None,
                    "is_all_day": True,
                    "age_min": age_min,
                    "age_max": age_max,
                    "price_min": None,
                    "price_max": None,
                    "price_note": "Use the official Summer at Lovett catalog for current tuition and enrollment details.",
                    "class_category": CATEGORY_CLASS_CATEGORY.get(category_labels[0], "mixed") if category_labels else "mixed",
                    "subcategory": "class" if "Summer School" in category_labels or "Academic" in category_labels or "Driver's Education" in category_labels else "camp",
                    "tags": _derive_tags(title, category_labels, school_levels, age_min, age_max),
                    "hash_key": f"{title}|{'/'.join(category_labels)}|{'/'.join(school_levels)}|{week_label}",
                }
            )

    rows.sort(key=lambda row: (row["start_date"], row["title"], row["hash_key"]))
    return rows


def _build_event_record(source_id: int, venue_id: int, row: dict) -> dict:
    title = f"{row['title']} at The Lovett School"
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
        "subcategory": row["subcategory"],
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
        "extraction_confidence": 0.84,
        "is_recurring": False,
        "recurrence_rule": None,
        "content_hash": generate_content_hash(
            f"{title} [{row['hash_key']}]", VENUE_DATA["name"], row["start_date"]
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
        logger.error("Lovett summer programs: fetch failed: %s", exc)
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
                "Lovett summer programs: failed to process %s (%s): %s",
                row.get("title"),
                row.get("start_date"),
                exc,
            )

    return events_found, events_new, events_updated
