"""
Crawler for Wesleyan School summer camp offerings.

Official source:
https://www.wesleyanschool.org/camps-clinics/summer-camp-offerings

Pattern role:
This is the first school summer-hub implementation. Wesleyan publishes a
server-rendered catalog of camp cards with visible grade filters, camp category
tags, time/date summaries, and a public CampBrain registration endpoint.
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

BASE_URL = "https://www.wesleyanschool.org"
OFFERINGS_URL = f"{BASE_URL}/camps-clinics/summer-camp-offerings"
REGISTRATION_URL = "https://wesleyansummer.campbrainregistration.com/"

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
    "name": "Wesleyan School",
    "slug": "wesleyan-school",
    "address": "5405 Spalding Dr",
    "city": "Peachtree Corners",
    "state": "GA",
    "zip": "30092",
    "lat": 33.9687,
    "lng": -84.2174,
    "neighborhood": "Peachtree Corners",
    "venue_type": "institution",
    "spot_type": "education",
    "website": "https://www.wesleyanschool.org/",
    "vibes": ["family-friendly", "educational"],
}

BASE_TAGS = [
    "kids",
    "family-friendly",
    "educational",
    "seasonal",
    "rsvp-required",
]

DATE_SEGMENT_RE = re.compile(
    r"(?P<month>[A-Za-z]+)\s+(?P<start_day>\d{1,2})(?:st|nd|rd|th)?\s*-\s*(?P<end_day>\d{1,2})(?:st|nd|rd|th)?",
    re.IGNORECASE,
)
WEEK_COUNT_RE = re.compile(r"\((\d+)\s+weeks?\)", re.IGNORECASE)
TIME_RANGE_RE = re.compile(
    r"(?P<start>[\d:apm.\s]+?)\s+to\s+(?P<end>[\d:apm.\s]+)",
    re.IGNORECASE,
)

GRADE_AGE_MAP = {
    "3-year-old to 4-year-old": (3, 4),
    "kindergarten": (5, 6),
    "1st": (6, 7),
    "2nd": (7, 8),
    "3rd": (8, 9),
    "4th": (9, 10),
    "5th": (10, 11),
    "6th": (11, 12),
    "7th": (12, 13),
    "8th": (13, 14),
}

CATEGORY_TAGS = {
    "Academic": ["educational"],
    "Athletic": ["sports", "fitness"],
    "Day Camp": ["camp"],
    "Enrichment": ["educational"],
    "Fine Arts": ["arts"],
}

CATEGORY_CLASS_CATEGORY = {
    "Academic": "education",
    "Athletic": "fitness",
    "Day Camp": "mixed",
    "Enrichment": "mixed",
    "Fine Arts": "mixed",
}


def _clean_text(value: Optional[str]) -> str:
    if not value:
        return ""
    value = value.replace("\u200b", " ")
    return re.sub(r"\s+", " ", value).strip()


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


def _parse_year(soup: BeautifulSoup) -> int:
    heading = soup.find(["h1", "h2"], string=re.compile(r"20\d{2} Summer Camp", re.I))
    text = _clean_text(heading.get_text(" ", strip=True) if heading else "")
    match = re.search(r"\b(20\d{2})\b", text)
    return int(match.group(1)) if match else datetime.now().year


def _parse_filter_maps(soup: BeautifulSoup) -> tuple[dict[str, str], dict[str, str]]:
    grade_map: dict[str, str] = {}
    category_map: dict[str, str] = {}

    for heading in soup.find_all("h2"):
        title = _clean_text(heading.get_text(" ", strip=True))
        container = heading.find_parent(class_="fsElement") or heading.parent
        if "Filter by rising age or grade" in title:
            for link in container.select("a[data-category-id]"):
                category_id = (link.get("data-category-id") or "").strip()
                label = _clean_text(link.get_text(" ", strip=True))
                if category_id and label and label.lower() != "all":
                    grade_map[category_id] = label
        elif "Filter by camp category" in title:
            for link in container.select("a[data-tag-id]"):
                tag_id = (link.get("data-tag-id") or "").strip()
                label = _clean_text(link.get_text(" ", strip=True))
                if tag_id and label and label.lower() != "all":
                    category_map[tag_id] = label

    return grade_map, category_map


def _parse_time_value(value: str) -> Optional[str]:
    cleaned = _clean_text(value).lower().replace(".", "")
    if not cleaned:
        return None
    if cleaned == "noon":
        return "12:00"
    match = re.match(r"(\d{1,2})(?::(\d{2}))?\s*([ap]m)", cleaned)
    if not match:
        return None

    hour = int(match.group(1))
    minute = int(match.group(2) or "00")
    ampm = match.group(3)

    if ampm == "pm" and hour != 12:
        hour += 12
    if ampm == "am" and hour == 12:
        hour = 0
    return f"{hour:02d}:{minute:02d}"


def _parse_time_range(summary_text: str) -> tuple[Optional[str], Optional[str]]:
    match = TIME_RANGE_RE.search(summary_text)
    if not match:
        return None, None
    return _parse_time_value(match.group("start")), _parse_time_value(
        match.group("end")
    )


def _parse_date_segments(
    date_text: str, year: int, title: str
) -> list[tuple[str, str]]:
    segments: list[tuple[str, str]] = []
    cleaned = _clean_text(date_text)
    for raw_part in cleaned.split(","):
        part = _clean_text(raw_part)
        if not part:
            continue
        match = DATE_SEGMENT_RE.search(part)
        if not match:
            continue
        month = match.group("month")
        start_day = int(match.group("start_day"))
        end_day = int(match.group("end_day"))
        try:
            start_dt = datetime.strptime(f"{month} {start_day} {year}", "%B %d %Y")
            end_dt = datetime.strptime(f"{month} {end_day} {year}", "%B %d %Y")
        except ValueError:
            try:
                start_dt = datetime.strptime(f"{month} {start_day} {year}", "%b %d %Y")
                end_dt = datetime.strptime(f"{month} {end_day} {year}", "%b %d %Y")
            except ValueError:
                continue
        segments.append((start_dt.strftime("%Y-%m-%d"), end_dt.strftime("%Y-%m-%d")))

    week_match = WEEK_COUNT_RE.search(title)
    if week_match and len(segments) == int(week_match.group(1)) and len(segments) > 1:
        return [(segments[0][0], segments[-1][1])]

    return segments


def _extract_summary_fields(article: Tag) -> dict:
    summary = article.find("div", class_="fsSummary")
    lines = [_clean_text(text) for text in summary.stripped_strings] if summary else []

    time_text = ""
    date_text = ""
    instructor_text = ""
    for line in lines:
        lowered = line.lower()
        if lowered.startswith("time:"):
            time_text = _clean_text(line.split(":", 1)[1])
        elif lowered.startswith("dates:"):
            date_text = _clean_text(line.split(":", 1)[1])
        elif lowered.startswith("instructor:") or lowered.startswith("instructors:"):
            instructor_text = _clean_text(line.split(":", 1)[1])

    return {
        "summary_text": " ".join(lines),
        "time_text": time_text,
        "date_text": date_text,
        "instructor_text": instructor_text,
    }


def _parse_grade_labels(article: Tag, grade_map: dict[str, str]) -> list[str]:
    labels: list[str] = []
    for class_name in article.get("class") or []:
        match = re.match(r"fsCategory-(\d+)", class_name)
        if not match:
            continue
        label = grade_map.get(match.group(1))
        if label and label not in labels:
            labels.append(label)
    return labels


def _parse_category_labels(article: Tag, category_map: dict[str, str]) -> list[str]:
    labels: list[str] = []
    for class_name in article.get("class") or []:
        match = re.match(r"fsTag-(\d+)", class_name)
        if not match:
            continue
        label = category_map.get(match.group(1))
        if label and label not in labels:
            labels.append(label)
    return labels


def _derive_age_range(
    grade_labels: list[str],
) -> tuple[Optional[int], Optional[int], list[str]]:
    ranges = [GRADE_AGE_MAP[label] for label in grade_labels if label in GRADE_AGE_MAP]
    if not ranges:
        return None, None, []
    age_min = min(age_range[0] for age_range in ranges)
    age_max = max(age_range[1] for age_range in ranges)
    return age_min, age_max, _age_band_tags(age_min, age_max)


def _derive_tags(
    title: str, category_labels: list[str], age_tags: list[str]
) -> list[str]:
    tags = BASE_TAGS + age_tags
    for category in category_labels:
        tags.extend(CATEGORY_TAGS.get(category, []))

    lowered = title.lower()
    if any(term in lowered for term in ["art", "painting", "drawing"]):
        tags.append("art")
    if "theater" in lowered or "show" in lowered:
        tags.append("theater")
    if "science" in lowered or "stem" in lowered:
        tags.append("stem")
    if any(
        term in lowered
        for term in [
            "basketball",
            "soccer",
            "volleyball",
            "football",
            "baseball",
            "tennis",
            "wrestling",
            "lacrosse",
            "pickleball",
            "cheerleading",
            "running",
        ]
    ):
        tags.append("sports")

    return list(dict.fromkeys(tags))


def _derive_class_category(category_labels: list[str], title: str) -> str:
    if category_labels:
        primary = category_labels[0]
        if primary in CATEGORY_CLASS_CATEGORY:
            return CATEGORY_CLASS_CATEGORY[primary]
    lowered = title.lower()
    if "theater" in lowered or "art" in lowered:
        return "mixed"
    if any(
        term in lowered
        for term in [
            "basketball",
            "soccer",
            "football",
            "tennis",
            "wrestling",
            "lacrosse",
            "volleyball",
            "baseball",
            "pickleball",
        ]
    ):
        return "fitness"
    return "education"


def _build_description(row: dict) -> str:
    parts = [
        row["title"],
        (
            f"For rising {', '.join(row['grade_labels'])} campers."
            if row["grade_labels"]
            else ""
        ),
        f"Time: {row['time_text']}." if row["time_text"] else "",
        f"Instructor: {row['instructor_text']}." if row["instructor_text"] else "",
        (
            f"Category: {', '.join(row['category_labels'])}."
            if row["category_labels"]
            else ""
        ),
    ]
    description = _clean_text(" ".join(part for part in parts if part))
    return description[:1000]


def _parse_articles(soup: BeautifulSoup) -> list[dict]:
    year = _parse_year(soup)
    grade_map, category_map = _parse_filter_maps(soup)

    rows: list[dict] = []
    for article in soup.find_all(
        "article", class_=lambda value: value and "fsBoard-48" in value
    ):
        title_node = article.find("div", class_="fsTitle")
        title = _clean_text(title_node.get_text(" ", strip=True) if title_node else "")
        if not title:
            continue

        summary_fields = _extract_summary_fields(article)
        date_segments = _parse_date_segments(summary_fields["date_text"], year, title)
        if not date_segments:
            continue

        grade_labels = _parse_grade_labels(article, grade_map)
        category_labels = _parse_category_labels(article, category_map)
        age_min, age_max, age_tags = _derive_age_range(grade_labels)
        start_time, end_time = _parse_time_range(summary_fields["time_text"])
        read_more = article.find("a", class_=re.compile(r"fsReadMoreLink"))
        source_url = OFFERINGS_URL
        if read_more and read_more.get("data-slug"):
            source_url = f"{OFFERINGS_URL}#/{read_more['data-slug']}"

        base_row = {
            "title": title,
            "summary_text": summary_fields["summary_text"],
            "time_text": summary_fields["time_text"],
            "instructor_text": summary_fields["instructor_text"],
            "grade_labels": grade_labels,
            "category_labels": category_labels,
            "age_min": age_min,
            "age_max": age_max,
            "age_tags": age_tags,
            "start_time": start_time,
            "end_time": end_time,
            "source_url": source_url,
            "class_category": _derive_class_category(category_labels, title),
        }

        for start_date, end_date in date_segments:
            rows.append(
                {
                    **base_row,
                    "start_date": start_date,
                    "end_date": end_date,
                    "tags": _derive_tags(title, category_labels, age_tags),
                }
            )

    return rows


def _build_event_record(source_id: int, venue_id: int, row: dict) -> dict:
    content_hash = generate_content_hash(
        row["title"], VENUE_DATA["name"], row["start_date"]
    )
    record = {
        "source_id": source_id,
        "venue_id": venue_id,
        "title": row["title"],
        "description": _build_description(row),
        "start_date": row["start_date"],
        "start_time": row["start_time"],
        "end_date": row["end_date"],
        "end_time": row["end_time"],
        "is_all_day": row["start_time"] is None and row["end_time"] is None,
        "category": "programs",
        "subcategory": "camp",
        "class_category": row["class_category"],
        "tags": row["tags"],
        "price_min": None,
        "price_max": None,
        "price_note": "Registration required. See CampBrain for current pricing.",
        "is_free": False,
        "source_url": row["source_url"],
        "ticket_url": REGISTRATION_URL,
        "image_url": None,
        "raw_text": (
            f"{row['title']} | {', '.join(row['grade_labels'])} | "
            f"{', '.join(row['category_labels'])} | {row['summary_text']}"
        ),
        "extraction_confidence": 0.89,
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
        response = session.get(OFFERINGS_URL, timeout=30)
        response.raise_for_status()
    except Exception as exc:
        logger.error("Wesleyan School: failed to fetch offerings page: %s", exc)
        return 0, 0, 0

    venue_id = get_or_create_venue(VENUE_DATA)
    today = date.today().strftime("%Y-%m-%d")

    for row in _parse_articles(BeautifulSoup(response.text, "html.parser")):
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
                "Wesleyan School: failed to process %s (%s): %s",
                row.get("title"),
                row.get("start_date"),
                exc,
            )

    logger.info(
        "Wesleyan School crawl complete: %d found, %d new, %d updated",
        events_found,
        events_new,
        events_updated,
    )
    return events_found, events_new, events_updated
