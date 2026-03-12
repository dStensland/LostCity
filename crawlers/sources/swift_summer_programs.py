"""
Crawler for Swift School summer programs.

Official source pages:
https://www.theswiftschool.org/programs/summer-programs/summerexplorations
https://www.theswiftschool.org/programs/summer-programs/multisensory-math
https://www.theswiftschool.org/programs/summer-programs/swift-skills

Pattern role:
Structured school-program pack built from a small set of rich official pages.
Swift publishes a handful of summer programs with explicit dates, times, ages,
costs, aftercare, and program-specific registration links.
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

REQUEST_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/122.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml",
    "Accept-Language": "en-US,en;q=0.9",
}

PROGRAM_PAGES = [
    "https://www.theswiftschool.org/programs/summer-programs/summerexplorations",
    "https://www.theswiftschool.org/programs/summer-programs/multisensory-math",
    "https://www.theswiftschool.org/programs/summer-programs/swift-skills",
]

VENUE_DATA = {
    "name": "Swift School",
    "slug": "swift-school",
    "address": "300 Grimes Bridge Road",
    "city": "Roswell",
    "state": "GA",
    "zip": "30075",
    "neighborhood": "Roswell",
    "venue_type": "institution",
    "spot_type": "education",
    "website": "https://www.theswiftschool.org/",
    "vibes": ["family-friendly", "educational"],
}

BASE_TAGS = [
    "kids",
    "family-friendly",
    "educational",
    "seasonal",
    "rsvp-required",
]

DATE_RANGE_RE = re.compile(
    r"(?P<start_month>[A-Za-z]+)\s+(?P<start_day>\d{1,2})\s*-\s*"
    r"(?:(?P<end_month>[A-Za-z]+)\s+)?(?P<end_day>\d{1,2}),\s*(?P<year>20\d{2})",
    re.IGNORECASE,
)
TIME_RANGE_RE = re.compile(
    r"(?P<start>[\d:apm.\s]+?)\s*-\s*(?P<end>[\d:apm.\s]+)",
    re.IGNORECASE,
)
PRICE_RE = re.compile(r"\$ ?([0-9]+(?:\.[0-9]{2})?)")
GRADE_PAIR_RE = re.compile(
    r"Rising\s+(?P<first>(?:Kindergarten|\d+(?:st|nd|rd|th)))\s*(?:&|and|through|-)\s*"
    r"(?P<second>(?:Kindergarten|\d+(?:st|nd|rd|th)))",
    re.IGNORECASE,
)
RANGE_RE = re.compile(
    r"Rising\s+(?P<first>(?:Kindergarten|\d+(?:st|nd|rd|th)))\s+through\s+"
    r"(?P<second>(?:sixth|eighth|\d+(?:st|nd|rd|th)))[ -]grade",
    re.IGNORECASE,
)


def _clean_text(value: Optional[str]) -> str:
    if not value:
        return ""
    value = value.replace("\u00a0", " ")
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


def _grade_token_to_age(grade: str) -> Optional[int]:
    cleaned = _clean_text(grade).lower()
    word_map = {"kindergarten": 5, "sixth": 11, "eighth": 13}
    if cleaned in word_map:
        return word_map[cleaned]

    match = re.search(r"(\d+)", cleaned)
    if not match:
        return None
    return int(match.group(1)) + 5


def _parse_date_range(text: str) -> tuple[Optional[str], Optional[str]]:
    match = DATE_RANGE_RE.search(_clean_text(text))
    if not match:
        return None, None

    start_month = match.group("start_month")
    end_month = match.group("end_month") or start_month
    start_day = int(match.group("start_day"))
    end_day = int(match.group("end_day"))
    year = int(match.group("year"))

    for fmt in ("%B %d %Y", "%b %d %Y"):
        try:
            start_dt = datetime.strptime(f"{start_month} {start_day} {year}", fmt)
            end_dt = datetime.strptime(f"{end_month} {end_day} {year}", fmt)
            return start_dt.strftime("%Y-%m-%d"), end_dt.strftime("%Y-%m-%d")
        except ValueError:
            continue
    return None, None


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


def _parse_time_range(text: str) -> tuple[Optional[str], Optional[str]]:
    match = TIME_RANGE_RE.search(_clean_text(text))
    if not match:
        return None, None
    return _parse_time_value(match.group("start")), _parse_time_value(
        match.group("end")
    )


def _extract_intro_and_content(soup: BeautifulSoup) -> tuple[str, Tag | None]:
    main = soup.find("main", id="fsPageContent")
    if main is None:
        return "", None
    title_node = main.find("h1")
    title = _clean_text(title_node.get_text(" ", strip=True) if title_node else "")
    content = main.find("div", class_="fsElementContent")
    return title, content


def _parse_info_list(content: Tag) -> dict[str, str]:
    info: dict[str, str] = {}
    for item in content.find_all("li"):
        strong = item.find("strong")
        if not strong:
            continue
        key = _clean_text(strong.get_text(" ", strip=True)).rstrip(":*")
        item_text = _clean_text(item.get_text(" ", strip=True))
        label_text = _clean_text(strong.get_text(" ", strip=True))
        value = _clean_text(item_text.replace(label_text, "", 1))
        if key and value:
            info[key] = value
    return info


def _extract_register_link(content: Tag) -> Optional[str]:
    for link in content.find_all("a", href=True):
        text = _clean_text(link.get_text(" ", strip=True)).lower()
        href = link["href"]
        if "register" in text or "form-manager" in href:
            return href
    return None


def _parse_costs_from_text(
    text: str,
) -> tuple[Optional[float], Optional[float], Optional[str]]:
    prices = [float(match) for match in PRICE_RE.findall(text)]
    if not prices:
        return None, None, None
    price_note = _clean_text(text)
    return min(prices), max(prices), price_note


def _parse_grade_range_from_text(
    text: str,
) -> tuple[Optional[int], Optional[int], list[str]]:
    cleaned = _clean_text(text)
    match = RANGE_RE.search(cleaned)
    if match:
        first = _grade_token_to_age(match.group("first"))
        second = _grade_token_to_age(match.group("second"))
        if first is not None and second is not None:
            return first, second, _age_band_tags(first, second)

    match = GRADE_PAIR_RE.search(cleaned)
    if match:
        first = _grade_token_to_age(match.group("first"))
        second = _grade_token_to_age(match.group("second"))
        if first is not None and second is not None:
            return first, second, _age_band_tags(first, second)

    return None, None, []


def _build_description(parts: list[str]) -> str:
    return _clean_text(" ".join(part for part in parts if part))[:1000]


def _parse_summer_explorations(title: str, content: Tag, source_url: str) -> list[dict]:
    info = _parse_info_list(content)
    start_date, end_date = _parse_date_range(info.get("Dates", ""))
    start_time, end_time = _parse_time_range(info.get("Times", ""))
    age_min, age_max, age_tags = _parse_grade_range_from_text(
        info.get("Open to All", "")
    )
    price_min, price_max, price_note = _parse_costs_from_text(
        info.get("2026 Costs", "")
    )
    aftercare_note = info.get("Aftercare")
    if aftercare_note:
        price_note = _build_description(
            [price_note or "", f"Aftercare: {aftercare_note}."]
        )

    intro = content.find("h2", string=re.compile("three-week program", re.I))
    intro_text = _clean_text(intro.get_text(" ", strip=True) if intro else "")
    ticket_url = _extract_register_link(content)

    return [
        {
            "title": title,
            "description": _build_description([intro_text, price_note or ""]),
            "start_date": start_date,
            "end_date": end_date,
            "start_time": start_time,
            "end_time": end_time,
            "age_min": age_min,
            "age_max": age_max,
            "tags": list(dict.fromkeys(BASE_TAGS + age_tags + ["stem", "theater"])),
            "class_category": "education",
            "price_min": price_min,
            "price_max": price_max,
            "price_note": price_note,
            "ticket_url": ticket_url,
            "source_url": source_url,
        }
    ]


def _parse_math_clinic(title: str, content: Tag, source_url: str) -> list[dict]:
    text = _clean_text(content.get_text(" ", strip=True))
    dates_match = re.search(r"Dates:\s*([A-Za-z0-9 ,\-]+20\d{2})", text)
    cost_match = re.search(r"Cost:\s*(\$ ?[0-9]+)", text)
    start_date, end_date = _parse_date_range(
        dates_match.group(1) if dates_match else ""
    )
    price_min, price_max, _ = _parse_costs_from_text(
        cost_match.group(1) if cost_match else ""
    )
    ticket_url = _extract_register_link(content)

    intro_h5 = content.find("h5")
    intro_text = _clean_text(intro_h5.get_text(" ", strip=True) if intro_h5 else "")

    rows: list[dict] = []
    session_list: Optional[Tag] = None
    for strong in content.find_all("strong"):
        label = _clean_text(strong.get_text(" ", strip=True)).rstrip(":").lower()
        if label == "time":
            parent = strong.find_parent(["p", "div"])
            if parent is not None:
                session_list = parent.find_next_sibling("ul")
            break

    list_items = session_list.find_all("li") if session_list else []
    for item in list_items:
        item_text = _clean_text(item.get_text(" ", strip=True))
        if (
            "Rising" not in item_text
            or "-" not in item_text
            or "Graders" not in item_text
        ):
            continue
        grade_part, _, time_part = item_text.partition("-")
        age_min, age_max, age_tags = _parse_grade_range_from_text(grade_part)
        start_time, end_time = _parse_time_range(time_part)
        grade_label = _clean_text(grade_part.rstrip(":"))
        rows.append(
            {
                "title": f"{title} ({grade_label})",
                "description": _build_description(
                    [
                        intro_text,
                        item_text,
                        "Spaces are limited to 6 students per session.",
                    ]
                ),
                "start_date": start_date,
                "end_date": end_date,
                "start_time": start_time,
                "end_time": end_time,
                "age_min": age_min,
                "age_max": age_max,
                "tags": list(dict.fromkeys(BASE_TAGS + age_tags + ["stem"])),
                "class_category": "education",
                "price_min": price_min,
                "price_max": price_max,
                "price_note": "$900 for the two-week clinic",
                "ticket_url": ticket_url,
                "source_url": source_url,
            }
        )
    return rows


def _parse_swift_skills(title: str, content: Tag, source_url: str) -> list[dict]:
    info = _parse_info_list(content)
    start_date, end_date = _parse_date_range(info.get("Dates", ""))
    start_time, end_time = _parse_time_range(info.get("Times", ""))
    age_min, age_max, age_tags = _parse_grade_range_from_text(info.get("Open to", ""))
    ticket_url = _extract_register_link(content)

    body_text = _clean_text(content.get_text(" ", strip=True))
    cost_line_match = re.search(r"Cost:\s*(\$[0-9]+[^*]+)", body_text)
    base_cost_match = re.search(r"Cost:\s*(\$[0-9]+)", body_text)
    base_price = (
        float(base_cost_match.group(1).replace("$", "").strip())
        if base_cost_match
        else None
    )
    price_min = base_price
    price_max = base_price
    price_note = _clean_text(cost_line_match.group(1) if cost_line_match else "")
    if "aftercare" in body_text.lower():
        aftercare_match = re.search(
            r"\$125 per week for aftercare\s*\(([^)]+)\)", body_text, re.IGNORECASE
        )
        aftercare_note = (
            f"Aftercare: {aftercare_match.group(1)}, $125 per week."
            if aftercare_match
            else info.get("Aftercare")
        )
        price_note = _build_description([price_note or "", aftercare_note or ""])

    intro = content.find("h2")
    intro_text = _clean_text(intro.get_text(" ", strip=True) if intro else "")

    return [
        {
            "title": title,
            "description": _build_description([intro_text, price_note or ""]),
            "start_date": start_date,
            "end_date": end_date,
            "start_time": start_time,
            "end_time": end_time,
            "age_min": age_min,
            "age_max": age_max,
            "tags": list(dict.fromkeys(BASE_TAGS + age_tags)),
            "class_category": "education",
            "price_min": price_min,
            "price_max": price_max,
            "price_note": price_note,
            "ticket_url": ticket_url,
            "source_url": source_url,
        }
    ]


def _parse_program_page(html: str, source_url: str) -> list[dict]:
    soup = BeautifulSoup(html, "html.parser")
    title, content = _extract_intro_and_content(soup)
    if not title or content is None:
        return []

    title_lower = title.lower()
    if "summer explorations" in title_lower:
        return _parse_summer_explorations(title, content, source_url)
    if "math" in title_lower:
        return _parse_math_clinic(title, content, source_url)
    if "swift skills" in title_lower:
        return _parse_swift_skills(title, content, source_url)
    return []


def _build_event_record(source_id: int, venue_id: int, row: dict) -> dict:
    content_hash = generate_content_hash(
        row["title"], VENUE_DATA["name"], row["start_date"]
    )
    record = {
        "source_id": source_id,
        "venue_id": venue_id,
        "title": row["title"],
        "description": row["description"],
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
        "price_note": row["price_note"],
        "is_free": bool(row.get("price_max") == 0.0),
        "source_url": row["source_url"],
        "ticket_url": row["ticket_url"],
        "image_url": None,
        "raw_text": f"{row['title']} | {row['description']}",
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

    venue_id = get_or_create_venue(VENUE_DATA)
    today = date.today().strftime("%Y-%m-%d")

    for page_url in PROGRAM_PAGES:
        try:
            response = session.get(page_url, timeout=30)
            response.raise_for_status()
        except Exception as exc:
            logger.error("Swift Summer Programs: failed to fetch %s: %s", page_url, exc)
            continue

        for row in _parse_program_page(response.text, page_url):
            try:
                if row["end_date"] and row["end_date"] < today:
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
                    "Swift Summer Programs: failed to process %s (%s): %s",
                    row.get("title"),
                    row.get("source_url"),
                    exc,
                )

    logger.info(
        "Swift Summer Programs crawl complete: %d found, %d new, %d updated",
        events_found,
        events_new,
        events_updated,
    )
    return events_found, events_new, events_updated
