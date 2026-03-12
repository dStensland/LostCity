"""
Crawler for Pace Academy summer programs.

Official source:
https://www.paceacademy.org/community/summer-programs/search-camps

Pattern role:
Second school summer-hub implementation. Pace exposes a large server-rendered
camp catalog with one article per camp/week offering, including visible week,
date, time, cost, vendor, category, and grade tags.
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

BASE_URL = "https://www.paceacademy.org"
SEARCH_CAMPS_URL = f"{BASE_URL}/community/summer-programs/search-camps"
REGISTRATION_URL = "https://paceacademysummerprograms.campbrainregistration.com/"

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
    "name": "Pace Academy",
    "slug": "pace-academy",
    "address": "966 W Paces Ferry Rd NW",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30327",
    "neighborhood": "Buckhead",
    "venue_type": "institution",
    "spot_type": "education",
    "website": "https://www.paceacademy.org/",
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
    r"(?P<month>[A-Za-z]+)\s+(?P<start_day>\d{1,2})\s*-\s*(?P<end_day>\d{1,2})",
    re.IGNORECASE,
)
PRICE_RE = re.compile(r"\$([0-9]+(?:\.[0-9]{2})?)")
GRADE_RE = re.compile(r"Grade\s*0?(\d{1,2})", re.IGNORECASE)
K_RANGE_RE = re.compile(r"\bK\s*-\s*(\d{1,2})(?:st|nd|rd|th)\b", re.IGNORECASE)
TIME_RANGE_RE = re.compile(
    r"(?P<start>[\d:apm.\s]+?)\s*-\s*(?P<end>[\d:apm.\s]+)",
    re.IGNORECASE,
)

CATEGORY_CLASS_CATEGORY = {
    "Athletics": "fitness",
    "Arts": "mixed",
    "Math, Technology and Science": "education",
    "Middle School": "education",
    "Lower School": "education",
    "Preschool": "education",
    "Pace Camp": "mixed",
    "Specialty": "mixed",
    "Visual Arts": "mixed",
    "Performing Arts": "mixed",
    "STEM": "education",
    "Language": "education",
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
    body_text = soup.get_text(" ", strip=True)
    match = re.search(r"\b(20\d{2})\b", body_text)
    if match:
        return int(match.group(1))
    return datetime.now().year


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


def _parse_time_range(value: str) -> tuple[Optional[str], Optional[str]]:
    match = TIME_RANGE_RE.search(_clean_text(value))
    if not match:
        return None, None
    return _parse_time_value(match.group("start")), _parse_time_value(
        match.group("end")
    )


def _parse_date_range(value: str, year: int) -> tuple[Optional[str], Optional[str]]:
    match = DATE_SEGMENT_RE.search(_clean_text(value))
    if not match:
        return None, None

    month = match.group("month")
    start_day = int(match.group("start_day"))
    end_day = int(match.group("end_day"))

    for fmt in ("%B %d %Y", "%b %d %Y"):
        try:
            start_dt = datetime.strptime(f"{month} {start_day} {year}", fmt)
            end_dt = datetime.strptime(f"{month} {end_day} {year}", fmt)
            return start_dt.strftime("%Y-%m-%d"), end_dt.strftime("%Y-%m-%d")
        except ValueError:
            continue

    return None, None


def _parse_grade_labels(tag_items: list[str]) -> list[str]:
    labels: list[str] = []
    for item in tag_items:
        label = _clean_text(item)
        if not label:
            continue
        labels.append(label)
    return labels


def _grade_label_to_age_range(label: str) -> tuple[Optional[int], Optional[int]]:
    cleaned = _clean_text(label)

    if cleaned.lower() in {"0_kindergarten", "kindergarten", "grade k"}:
        return 5, 6

    match = GRADE_RE.search(cleaned)
    if match:
        grade = int(match.group(1))
        return grade + 5, grade + 6

    match = K_RANGE_RE.search(cleaned)
    if match:
        upper_grade = int(match.group(1))
        return 5, upper_grade + 6

    return None, None


def _derive_age_range(
    grade_labels: list[str],
) -> tuple[Optional[int], Optional[int], list[str]]:
    ranges = []
    for label in grade_labels:
        age_min, age_max = _grade_label_to_age_range(label)
        if age_min is not None and age_max is not None:
            ranges.append((age_min, age_max))
    if not ranges:
        return None, None, []

    age_min = min(item[0] for item in ranges)
    age_max = max(item[1] for item in ranges)
    return age_min, age_max, _age_band_tags(age_min, age_max)


def _derive_class_category(category_label: str, title: str) -> str:
    if category_label in CATEGORY_CLASS_CATEGORY:
        return CATEGORY_CLASS_CATEGORY[category_label]

    lowered = title.lower()
    if any(
        term in lowered
        for term in [
            "basketball",
            "soccer",
            "golf",
            "volleyball",
            "tennis",
            "pickleball",
            "gymnastics",
            "football",
            "wrestling",
            "track",
        ]
    ):
        return "fitness"
    if any(
        term in lowered
        for term in ["art", "dance", "theatre", "theater", "music", "paint"]
    ):
        return "mixed"
    return "education"


def _derive_tags(title: str, category_label: str, age_tags: list[str]) -> list[str]:
    tags = BASE_TAGS + age_tags
    lowered = title.lower()

    if category_label == "Athletics":
        tags.extend(["sports", "fitness"])
    elif category_label in {"Arts", "Visual Arts", "Performing Arts"}:
        tags.append("arts")
    elif category_label in {"STEM", "Math, Technology and Science"}:
        tags.append("stem")

    if any(
        term in lowered for term in ["art", "paint", "ceramic", "sewing", "jewelry"]
    ):
        tags.append("art")
    if any(
        term in lowered
        for term in ["dance", "theatre", "theater", "broadway", "music", "dj"]
    ):
        tags.append("theater")
    if any(
        term in lowered
        for term in [
            "robotics",
            "coding",
            "engineering",
            "chemistry",
            "science",
            "steam",
            "cybersecurity",
            "drone",
        ]
    ):
        tags.append("stem")
    if any(
        term in lowered
        for term in [
            "basketball",
            "soccer",
            "golf",
            "volleyball",
            "tennis",
            "pickleball",
            "gymnastics",
            "football",
            "wrestling",
            "track",
            "cheer",
        ]
    ):
        tags.append("sports")

    return list(dict.fromkeys(tags))


def _extract_summary_map(summary: Tag) -> dict[str, str]:
    result: dict[str, str] = {}
    for strong in summary.find_all("strong"):
        key = _clean_text(strong.get_text(" ", strip=True)).rstrip(":")
        value_parts: list[str] = []
        for sibling in strong.next_siblings:
            if isinstance(sibling, Tag) and sibling.name == "br":
                break
            text = _clean_text(
                sibling.get_text(" ", strip=True)
                if isinstance(sibling, Tag)
                else str(sibling)
            )
            if text:
                value_parts.append(text)
        if key and value_parts:
            result[key] = _clean_text(" ".join(value_parts))

    if not result:
        text = summary.get_text("\n", strip=True)
        for line in text.splitlines():
            cleaned = _clean_text(line)
            if ":" in cleaned:
                key, value = cleaned.split(":", 1)
                result[_clean_text(key)] = _clean_text(value)

    return result


def _extract_week_value(summary_map: dict[str, str]) -> Optional[str]:
    if "Week" in summary_map:
        return summary_map["Week"]
    for key, value in summary_map.items():
        if key.startswith("Week "):
            return value
    return None


def _build_source_url(article: Tag) -> str:
    link = article.find("a", class_=re.compile(r"fsPostLink"))
    if link and link.get("data-slug"):
        return f"{SEARCH_CAMPS_URL}/~board/{link['data-slug'].split('/post/')[0]}/post/{link['data-slug'].split('/post/')[1]}"
    return SEARCH_CAMPS_URL


def _parse_articles(soup: BeautifulSoup) -> list[dict]:
    year = _parse_year(soup)
    rows: list[dict] = []

    for article in soup.find_all("article"):
        title_node = article.find("div", class_="fsTitle")
        summary_node = article.find("div", class_="fsSummary")
        categories_node = article.find("ul", class_=re.compile(r"fsCategories"))
        tags_node = article.find("ul", class_=re.compile(r"fsTags"))
        if not title_node or not summary_node or not categories_node or not tags_node:
            continue

        title = _clean_text(title_node.get_text(" ", strip=True))
        category_label = _clean_text(categories_node.get_text(" ", strip=True))
        grade_labels = _parse_grade_labels(
            [
                _clean_text(li.get_text(" ", strip=True))
                for li in tags_node.find_all("li")
            ]
        )
        summary_map = _extract_summary_map(summary_node)
        week_value = _extract_week_value(summary_map)

        if not week_value or "Camp Time" not in summary_map:
            continue

        start_date, end_date = _parse_date_range(week_value, year)
        if not start_date:
            continue

        start_time, end_time = _parse_time_range(summary_map["Camp Time"])
        age_min, age_max, age_tags = _derive_age_range(grade_labels)
        price_match = PRICE_RE.search(summary_map.get("Cost", ""))
        price_value = float(price_match.group(1)) if price_match else None
        vendor = summary_map.get("Vendor")

        rows.append(
            {
                "title": title,
                "category_label": category_label,
                "grade_labels": grade_labels,
                "week_label": summary_map.get("Week Label"),
                "start_date": start_date,
                "end_date": end_date,
                "start_time": start_time,
                "end_time": end_time,
                "price_min": price_value,
                "price_max": price_value,
                "vendor": vendor,
                "age_min": age_min,
                "age_max": age_max,
                "age_tags": age_tags,
                "class_category": _derive_class_category(category_label, title),
                "tags": _derive_tags(title, category_label, age_tags),
                "source_url": _build_source_url(article),
                "summary_text": _clean_text(summary_node.get_text(" ", strip=True)),
            }
        )

    return rows


def _build_description(row: dict) -> str:
    parts = [
        row["title"],
        f"Category: {row['category_label']}." if row["category_label"] else "",
        f"For {', '.join(row['grade_labels'])}." if row["grade_labels"] else "",
        (
            f"Camp time: {row['start_time']} to {row['end_time']}."
            if row["start_time"] and row["end_time"]
            else ""
        ),
        f"Vendor: {row['vendor']}." if row.get("vendor") else "",
    ]
    description = _clean_text(" ".join(part for part in parts if part))
    return description[:1000]


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
        "price_min": row["price_min"],
        "price_max": row["price_max"],
        "price_note": (
            f"${int(row['price_min'])}"
            if row.get("price_min") is not None
            else "Registration required. See CampBrain for current pricing."
        ),
        "is_free": bool(row.get("price_max") == 0.0),
        "source_url": row["source_url"],
        "ticket_url": REGISTRATION_URL,
        "image_url": None,
        "raw_text": (
            f"{row['title']} | {row['category_label']} | {', '.join(row['grade_labels'])} | "
            f"{row['summary_text']}"
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
        response = session.get(SEARCH_CAMPS_URL, timeout=30)
        response.raise_for_status()
    except Exception as exc:
        logger.error("Pace Summer Programs: failed to fetch catalog page: %s", exc)
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
                "Pace Summer Programs: failed to process %s (%s): %s",
                row.get("title"),
                row.get("start_date"),
                exc,
            )

    logger.info(
        "Pace Summer Programs crawl complete: %d found, %d new, %d updated",
        events_found,
        events_new,
        events_updated,
    )
    return events_found, events_new, events_updated
