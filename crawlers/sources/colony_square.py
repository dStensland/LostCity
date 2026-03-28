"""
Crawler for Colony Square.

The site exposes stable listing cards and detail pages with hidden ICS fields,
which provide better event dates than the generic list-card labels.
"""

from __future__ import annotations

import logging
import re
from datetime import datetime
from typing import Optional
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

from db import find_event_by_hash, get_or_create_place, insert_event, smart_update_existing_event
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://colonysquare.com"
EVENTS_URL = f"{BASE_URL}/events/"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
}

PLACE_DATA = {
    "name": "Colony Square",
    "slug": "colony-square",
    "address": "1197 Peachtree St NE",
    "neighborhood": "Midtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30361",
    "lat": 33.7864,
    "lng": -84.3834,
    "venue_type": "entertainment_complex",
    "spot_type": "entertainment_complex",
    "website": BASE_URL,
    "description": "Midtown mixed-use destination with plaza programming, markets, wellness classes, film nights, and live music.",
}

SCHEDULE_HEADERS = {
    "Upcoming Class Schedule:",
    "Upcoming Movie Schedule:",
    "Upcoming Schedule:",
    "Upcoming Concert Schedule:",
    "Class Schedule:",
}

SCHEDULE_STOP_PREFIXES = (
    "Additional",
    "Loyalty Program:",
    "Rain or Shine:",
    "Reserve",
    "No ticketing",
    "Complimentary wine",
    "If you are interested",
    "Please be aware",
    "Explore More Events",
)


def parse_ics_datetime(value: str) -> Optional[datetime]:
    """Parse Colony Square ICS hidden input values."""
    value = value.strip()
    if not value:
        return None
    try:
        return datetime.strptime(value, "%a, %d %b %Y %H:%M:%S %z")
    except ValueError:
        return None


def parse_time_value(value: str) -> Optional[str]:
    """Parse a single clock value."""
    match = re.search(r"(\d{1,2})(?::(\d{2}))?\s*(am|pm)", value, re.IGNORECASE)
    if not match:
        return None

    hour = int(match.group(1))
    minute = int(match.group(2) or 0)
    period = match.group(3).lower()
    if period == "pm" and hour != 12:
        hour += 12
    elif period == "am" and hour == 12:
        hour = 0
    return f"{hour:02d}:{minute:02d}"


def parse_time_range(label: str) -> tuple[Optional[str], Optional[str]]:
    """Parse time labels like '6-7 PM' or '11:00-11:45 am'."""
    cleaned = " ".join(label.split()).replace("–", "-")
    if not cleaned or "vary" in cleaned.lower():
        return None, None

    if "-" not in cleaned:
        parsed = parse_time_value(cleaned)
        return parsed, None

    start_part, end_part = [part.strip() for part in cleaned.split("-", 1)]
    end_period_match = re.search(r"(am|pm)$", end_part, re.IGNORECASE)
    if end_period_match and not re.search(r"(am|pm)$", start_part, re.IGNORECASE):
        start_part = f"{start_part} {end_period_match.group(1)}"

    return parse_time_value(start_part), parse_time_value(end_part)


def parse_schedule_dates(lines: list[str], default_year: int) -> list[tuple[str, Optional[str]]]:
    """Extract concrete upcoming dates from schedule sections."""
    parsed: list[tuple[str, Optional[str]]] = []
    collecting = False

    for line in lines:
        if line in SCHEDULE_HEADERS:
            collecting = True
            continue
        if not collecting:
            continue
        if any(line.startswith(prefix) for prefix in SCHEDULE_STOP_PREFIXES):
            break

        match = re.match(
            r"([A-Za-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?(?::\s*(.+))?$",
            line,
        )
        if not match:
            continue

        month, day, note = match.groups()
        dt = datetime.strptime(f"{month[:3]} {day} {default_year}", "%b %d %Y")
        parsed.append((dt.strftime("%Y-%m-%d"), note.strip() if note else None))

    return parsed


def determine_category(title: str, description: str) -> tuple[str, Optional[str], list[str]]:
    """Determine category for Colony Square programming."""
    text = f"{title} {description}".lower()
    tags = ["colony-square", "midtown", "plaza"]

    if any(word in text for word in ["yoga", "pilates", "fitness", "wellness"]):
        return "wellness", None, tags + ["wellness"]
    if any(word in text for word in ["movie", "film", "screening"]):
        return "film", "screening", tags + ["film"]
    if any(word in text for word in ["groovin", "music", "concert", "live musical"]):
        return "music", "live", tags + ["music"]
    if any(word in text for word in ["kids", "playdate", "family-friendly"]):
        return "family", None, tags + ["family"]
    if any(word in text for word in ["book", "reading", "wine"]):
        return "words", None, tags + ["books"]
    if any(word in text for word in ["march madness", "basketball", "game day", "football"]):
        return "sports", None, tags + ["sports"]
    if any(word in text for word in ["st. patrick", "parade", "party"]):
        return "community", "celebration", tags + ["celebration"]

    return "community", None, tags


def extract_detail_page(detail_url: str) -> dict:
    """Extract normalized detail-page data."""
    response = requests.get(detail_url, headers=HEADERS, timeout=30)
    response.raise_for_status()
    soup = BeautifulSoup(response.text, "html.parser")

    detail_root = soup.select_one("#single-event-details") or soup
    heading = detail_root.select_one("h3")
    title = heading.get_text(" ", strip=True) if heading else soup.title.get_text(" ", strip=True)

    detail_values = [
        node.get_text(" ", strip=True)
        for node in detail_root.select("h5")
        if node.get_text(" ", strip=True)
    ]
    date_label = detail_values[0] if len(detail_values) > 0 else ""
    time_label = detail_values[1] if len(detail_values) > 1 else ""
    location = detail_values[2] if len(detail_values) > 2 else ""
    price_label = detail_values[3] if len(detail_values) > 3 else ""

    inputs = {
        name: (detail_root.select_one(f'input[name="{name}"]') or {}).get("value")
        if detail_root.select_one(f'input[name="{name}"]')
        else None
        for name in ["date_start", "date_end", "summary", "location", "url"]
    }

    lines = [line.strip() for line in detail_root.get_text("\n", strip=True).split("\n") if line.strip()]
    schedule_dates = parse_schedule_dates(lines, parse_ics_datetime(inputs["date_start"]).year if inputs["date_start"] else datetime.now().year)

    description_parts: list[str] = []
    for node in detail_root.select("p"):
        text = node.get_text(" ", strip=True)
        if not text:
            continue
        if text.startswith("If you are interested") or text.startswith("Please be aware") or text.startswith("Explore More Events"):
            break
        description_parts.append(text)
    description = " ".join(description_parts).strip()

    image = soup.find("meta", property="og:image")
    image_url = image.get("content") if image else None

    return {
        "title": title,
        "date_label": date_label,
        "time_label": time_label,
        "location": location or inputs.get("location"),
        "price_label": price_label,
        "description": description,
        "schedule_dates": schedule_dates,
        "ics_start": parse_ics_datetime(inputs["date_start"]) if inputs["date_start"] else None,
        "ics_end": parse_ics_datetime(inputs["date_end"]) if inputs["date_end"] else None,
        "image_url": image_url,
    }


def build_occurrences(detail: dict) -> list[tuple[str, Optional[str], Optional[str], Optional[str], bool]]:
    """Build event occurrences from detail page data."""
    start_time, end_time = parse_time_range(detail["time_label"])
    if detail["schedule_dates"]:
        return [
            (start_date, start_date, start_time, end_time, start_time is None)
            for start_date, _note in detail["schedule_dates"]
        ]

    ics_start = detail["ics_start"]
    ics_end = detail["ics_end"]
    description = detail["description"].lower()

    if "tba" in description and detail["date_label"].lower() == "select dates":
        return []

    if ics_start and ics_end:
        start_date = ics_start.strftime("%Y-%m-%d")
        end_date = ics_end.strftime("%Y-%m-%d")
        is_all_day = start_time is None and "times vary" in detail["time_label"].lower()
        return [(start_date, end_date, start_time, end_time, is_all_day)]

    return []


def should_skip_detail(detail: dict) -> bool:
    """Skip pages that don't expose concrete event dates."""
    title = detail["title"].lower()
    if "events at politan row" in title:
        return True
    if "game day on the square" in title and not detail["schedule_dates"]:
        return True
    return False


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Colony Square event programming."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    venue_id = get_or_create_place(PLACE_DATA)

    response = requests.get(EVENTS_URL, headers=HEADERS, timeout=30)
    response.raise_for_status()
    soup = BeautifulSoup(response.text, "html.parser")

    for card in soup.select(".event-item"):
        link = card.select_one("a[href]")
        if not link:
            continue

        detail_url = urljoin(EVENTS_URL, link.get("href", ""))
        detail = extract_detail_page(detail_url)
        if should_skip_detail(detail):
            logger.info("Skipping Colony Square umbrella page without concrete dates: %s", detail["title"])
            continue

        occurrences = build_occurrences(detail)
        if not occurrences:
            logger.info("No concrete Colony Square occurrences found for %s", detail["title"])
            continue

        category, subcategory, tags = determine_category(detail["title"], detail["description"])
        is_free = "complimentary" in detail["price_label"].lower()

        for start_date, end_date, start_time, end_time, is_all_day in occurrences:
            events_found += 1
            content_hash = generate_content_hash(detail["title"], PLACE_DATA["name"], start_date)

            event_record = {
                "source_id": source_id,
                "venue_id": venue_id,
                "title": detail["title"],
                "description": detail["description"],
                "start_date": start_date,
                "start_time": start_time,
                "end_date": end_date,
                "end_time": end_time,
                "is_all_day": is_all_day,
                "category": category,
                "subcategory": subcategory,
                "tags": tags,
                "price_min": None,
                "price_max": None,
                "price_note": detail["price_label"] or None,
                "is_free": is_free,
                "source_url": detail_url,
                "ticket_url": None,
                "image_url": detail["image_url"],
                "raw_text": f"{detail['date_label']} | {detail['time_label']}",
                "extraction_confidence": 0.9,
                "is_recurring": False,
                "recurrence_rule": None,
                "content_hash": content_hash,
            }

            existing = find_event_by_hash(content_hash)
            if existing:
                smart_update_existing_event(existing, event_record)
                events_updated += 1
                continue

            try:
                insert_event(event_record)
                events_new += 1
                logger.info("Added Colony Square event: %s on %s", detail["title"], start_date)
            except Exception as exc:
                logger.error("Failed to insert Colony Square event %s: %s", detail["title"], exc)

    logger.info(
        "Colony Square crawl complete: %s found, %s new, %s updated",
        events_found,
        events_new,
        events_updated,
    )
    return events_found, events_new, events_updated
