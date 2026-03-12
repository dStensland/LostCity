"""
Crawler for Big Blue Swim School Johns Creek.

Official source:
https://bigblueswimschool.com/locations/georgia/johns-creek/

Pattern role:
Recurring swim/location implementation using a public location landing page with
structured lesson-tier cards and direct schedule links. The official site exposes
age bands, class ratios, lesson duration, and enrollment URLs for each swim tier.
"""

from __future__ import annotations

import json
import logging
import re
from datetime import datetime, timedelta
from typing import Optional

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

SOURCE_URL = "https://bigblueswimschool.com/locations/georgia/johns-creek/"
WEEKS_AHEAD = 6

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
    "swimming",
    "class",
    "rsvp-required",
]

LESSON_TITLES = {"Baby Blue", "Bright Blue", "Bold Blue", "Big Blue"}
ONGOING_PROGRAM_TITLES = {"Drop-in Lessons", "Adaptive Swim Lessons"}

MONTH_RANGE_RE = re.compile(
    r"(?P<min>\d{1,2})\s*-\s*(?P<max>\d{1,2})\s*mo", re.IGNORECASE
)
YEAR_RANGE_RE = re.compile(
    r"(?P<min>\d{1,2})(?:\s*\+)?\s*-\s*(?P<max>\d{1,2})\s*years?", re.IGNORECASE
)
PLUS_YEARS_RE = re.compile(r"(?P<min>\d{1,2})\s*\+\s*years?", re.IGNORECASE)


def _clean_text(value: Optional[str]) -> str:
    if not value:
        return ""
    value = value.replace("\xa0", " ")
    return re.sub(r"\s+", " ", value).strip()


def _extract_location_config(html: str) -> dict:
    match = re.search(r"var bbss = (\{.*?\});", html, re.S)
    if not match:
        raise ValueError("Big Blue location config not found")

    payload = json.loads(match.group(1))
    lb_data = payload["location"]["lb_data"]
    address = lb_data["address"]

    return {
        "name": f"Big Blue Swim School - {lb_data['displayName']}",
        "short_name": lb_data["name"],
        "slug": f"big-blue-swim-school-{lb_data['slug']}",
        "region_slug": lb_data["regionSlug"],
        "location_slug": lb_data["slug"],
        "address": address["street"],
        "city": address["city"],
        "state": address["province"]["shortName"],
        "zip": address["postalCode"],
        "lat": address["coords"]["lat"],
        "lng": address["coords"]["lng"],
        "phone": lb_data.get("phoneNumber"),
        "email": lb_data.get("email"),
        "website": SOURCE_URL,
    }


def _build_venue_data(location: dict) -> dict:
    return {
        "name": location["name"],
        "slug": location["slug"],
        "address": location["address"],
        "city": location["city"],
        "state": location["state"],
        "zip": location["zip"],
        "lat": location["lat"],
        "lng": location["lng"],
        "neighborhood": location["short_name"],
        "venue_type": "fitness_center",
        "spot_type": "fitness",
        "website": location["website"],
        "vibes": ["family-friendly", "all-ages"],
    }


def _replace_schedule_placeholders(url: str, location: dict) -> str:
    return url.replace("regionSlug", location["region_slug"]).replace(
        "locationSlug", location["location_slug"]
    )


def _age_band_tags(age_min: Optional[int], age_max: Optional[int]) -> list[str]:
    if age_min is None and age_max is None:
        return []

    lo = age_min if age_min is not None else 0
    hi = age_max if age_max is not None else 18
    tags: list[str] = []
    if hi <= 1:
        tags.append("infant")
    if lo <= 2 and hi >= 1:
        tags.append("toddler")
    if lo <= 5 and hi >= 3:
        tags.append("preschool")
    if lo <= 12 and hi >= 5:
        tags.append("elementary")
    if lo <= 13 and hi >= 10:
        tags.append("tween")
    return tags


def _parse_age_range(
    label: str,
) -> tuple[Optional[int], Optional[int], list[str], Optional[str]]:
    cleaned = _clean_text(label).lower()
    month_match = MONTH_RANGE_RE.search(cleaned)
    if month_match:
        month_min = int(month_match.group("min"))
        month_max = int(month_match.group("max"))
        age_min = month_min // 12
        age_max = month_max // 12
        age_label = f"{month_min}-{month_max} months"
        return age_min, age_max, _age_band_tags(age_min, age_max), age_label

    year_match = YEAR_RANGE_RE.search(cleaned)
    if year_match:
        age_min = int(year_match.group("min"))
        age_max = int(year_match.group("max"))
        age_label = f"{age_min}-{age_max} years"
        return age_min, age_max, _age_band_tags(age_min, age_max), age_label

    plus_match = PLUS_YEARS_RE.search(cleaned)
    if plus_match:
        age_min = int(plus_match.group("min"))
        age_label = f"{age_min}+ years"
        return age_min, 17, _age_band_tags(age_min, 17), age_label

    return None, None, [], None


def _derive_tags(
    title: str, age_tags: list[str], extra: Optional[list[str]] = None
) -> list[str]:
    tags = BASE_TAGS + age_tags + ["weekly", "fitness"]
    lowered = title.lower()
    if "adaptive" in lowered:
        tags.extend(["adaptive", "inclusive"])
    if "drop-in" in lowered:
        tags.append("drop-in")
    if "advanced" in lowered:
        tags.append("advanced")
    if extra:
        tags.extend(extra)
    return list(dict.fromkeys(tags))


def _next_start_dates() -> list[str]:
    today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    days_until_sat = (5 - today.weekday()) % 7
    if days_until_sat == 0:
        days_until_sat = 7
    first_saturday = today + timedelta(days=days_until_sat)
    return [
        (first_saturday + timedelta(weeks=offset)).strftime("%Y-%m-%d")
        for offset in range(WEEKS_AHEAD)
    ]


def _extract_lesson_rows(soup: BeautifulSoup, location: dict) -> list[dict]:
    rows: list[dict] = []

    for heading in soup.find_all("h5"):
        title = _clean_text(heading.get_text(" ", strip=True))
        if title not in LESSON_TITLES:
            continue

        card = heading.find_parent("div", class_=re.compile(r"\bcol-12\b"))
        if not card:
            continue

        subtitle_node = card.find("div", class_="sub-text")
        description_node = card.find("p")
        bullet_items = [
            _clean_text(li.get_text(" ", strip=True))
            for li in card.find_all("li")
            if _clean_text(li.get_text(" ", strip=True))
        ]
        buttons = card.find_all("a", href=True)

        subtitle = (
            _clean_text(subtitle_node.get_text(" ", strip=True))
            if subtitle_node
            else ""
        )
        description = (
            _clean_text(description_node.get_text(" ", strip=True))
            if description_node
            else ""
        )

        if title == "Baby Blue":
            for button in buttons:
                button_text = _clean_text(button.get_text(" ", strip=True))
                age_min, age_max, age_tags, age_label = _parse_age_range(button_text)
                rows.append(
                    {
                        "title": f"Baby Blue Swim Lessons ({button_text})",
                        "program_name": "Baby Blue",
                        "age_label": age_label or subtitle,
                        "description": description,
                        "details": bullet_items,
                        "ticket_url": _replace_schedule_placeholders(
                            button["href"], location
                        ),
                        "source_url": SOURCE_URL,
                        "age_min": age_min,
                        "age_max": age_max,
                        "tags": _derive_tags(
                            title,
                            age_tags,
                            extra=["infant" if age_max == 1 else "toddler"],
                        ),
                        "price_min": None,
                        "price_max": None,
                        "price_note": "Weekly lessons. Pricing varies by plan.",
                    }
                )
            continue

        schedule_url = (
            _replace_schedule_placeholders(buttons[0]["href"], location)
            if buttons
            else f"https://app.bigblueswimschool.com/locations/{location['region_slug']}/{location['location_slug']}/preview/weekly"
        )
        age_min, age_max, age_tags, age_label = _parse_age_range(subtitle)
        rows.append(
            {
                "title": (
                    f"{title} Swim Lessons"
                    if title != "Big Blue"
                    else "Big Blue Advanced Swim Lessons"
                ),
                "program_name": title,
                "age_label": age_label or subtitle,
                "description": description,
                "details": bullet_items,
                "ticket_url": schedule_url,
                "source_url": SOURCE_URL,
                "age_min": age_min,
                "age_max": age_max,
                "tags": _derive_tags(title, age_tags),
                "price_min": None,
                "price_max": None,
                "price_note": "Weekly lessons. Pricing varies by plan.",
            }
        )

    return rows


def _extract_ongoing_program_rows(soup: BeautifulSoup, location: dict) -> list[dict]:
    rows: list[dict] = []
    for container in soup.select(".program-item"):
        title_node = container.find(
            ["h3", "h4"], class_=re.compile(r"program-headline")
        )
        if not title_node:
            continue

        title = _clean_text(title_node.get_text(" ", strip=True))
        if title not in ONGOING_PROGRAM_TITLES:
            continue

        description_node = container.find("p", class_=re.compile(r"program-content"))
        links = container.find_all("a", href=True)
        primary_link = links[0]["href"] if links else SOURCE_URL
        learn_more_link = links[1]["href"] if len(links) > 1 else SOURCE_URL
        phone = location.get("phone")

        rows.append(
            {
                "title": title,
                "program_name": title,
                "age_label": "Kids and families",
                "description": (
                    _clean_text(description_node.get_text(" ", strip=True))
                    if description_node
                    else ""
                ),
                "details": [],
                "ticket_url": primary_link,
                "source_url": learn_more_link,
                "age_min": 3 if "Adaptive" in title else None,
                "age_max": 17 if "Adaptive" in title else None,
                "tags": _derive_tags(
                    title, _age_band_tags(3, 17) if "Adaptive" in title else []
                ),
                "price_min": None,
                "price_max": None,
                "price_note": (
                    f"Call {phone} to enroll."
                    if primary_link.startswith("tel:") and phone
                    else None
                ),
            }
        )

    return rows


def _build_description(row: dict, location: dict) -> str:
    parts = [
        f"{row['program_name']} at Big Blue Swim School {location['short_name']}.",
        row["description"],
    ]
    if row.get("age_label"):
        parts.append(f"Age fit: {row['age_label']}.")
    if row.get("details"):
        parts.append("Program details: " + "; ".join(row["details"]) + ".")
    if row.get("price_note"):
        parts.append(f"Pricing: {row['price_note']}")
    if location.get("phone"):
        parts.append(f"Contact: {location['phone']}.")
    return _clean_text(" ".join(parts))[:1000]


def _build_event_record(
    source_id: int, venue_id: int, row: dict, start_date: str, location: dict
) -> dict:
    title = f"{row['title']} at Big Blue Swim School ({location['short_name']})"
    description = _build_description(row, location)
    record = {
        "source_id": source_id,
        "venue_id": venue_id,
        "title": title,
        "description": description,
        "start_date": start_date,
        "start_time": None,
        "end_date": None,
        "end_time": None,
        "is_all_day": False,
        "category": "fitness",
        "subcategory": "fitness.swim",
        "tags": row["tags"],
        "is_free": False,
        "price_min": row["price_min"],
        "price_max": row["price_max"],
        "price_note": row["price_note"],
        "source_url": row["source_url"],
        "ticket_url": row["ticket_url"],
        "image_url": None,
        "raw_text": f"{title} | {row['age_label']} | {description}",
        "extraction_confidence": 0.9,
        "is_recurring": True,
        "recurrence_rule": "FREQ=WEEKLY;BYDAY=SA",
        "content_hash": generate_content_hash(title, location["name"], start_date),
        "is_class": True,
        "class_category": "fitness",
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
        response = session.get(SOURCE_URL, timeout=30)
        response.raise_for_status()
    except Exception as exc:
        logger.error(
            "Big Blue Swim Johns Creek: failed to fetch location page: %s", exc
        )
        return 0, 0, 0

    location = _extract_location_config(response.text)
    venue_id = get_or_create_venue(_build_venue_data(location))
    soup = BeautifulSoup(response.text, "html.parser")

    rows = _extract_lesson_rows(soup, location) + _extract_ongoing_program_rows(
        soup, location
    )
    logger.info(
        "Big Blue Swim Johns Creek: parsed %s recurring program templates", len(rows)
    )

    for row in rows:
        for start_date in _next_start_dates():
            try:
                record = _build_event_record(
                    source_id, venue_id, row, start_date, location
                )
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
                    "Big Blue Swim Johns Creek: failed to process %s (%s): %s",
                    row.get("title"),
                    start_date,
                    exc,
                )

    return events_found, events_new, events_updated
