"""
Shared crawler helpers for Agape-managed City of Atlanta racquet centers.

These pages publish public event tables, but they also mix in league-style
inventory and sometimes cross-promote events hosted at other centers.
This helper keeps only public event rows and prefers the freshest yearly page
when the site links from `/events/` to a year-specific detail page.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
import logging
import re
from typing import Optional
from urllib.parse import urlparse

import requests
from bs4 import BeautifulSoup

from db import get_or_create_place, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"

MONTH_INDEX = {
    "jan": 1,
    "january": 1,
    "feb": 2,
    "february": 2,
    "mar": 3,
    "march": 3,
    "apr": 4,
    "april": 4,
    "may": 5,
    "jun": 6,
    "june": 6,
    "jul": 7,
    "july": 7,
    "aug": 8,
    "august": 8,
    "sep": 9,
    "sept": 9,
    "september": 9,
    "oct": 10,
    "october": 10,
    "nov": 11,
    "november": 11,
    "dec": 12,
    "december": 12,
}

IMAGE_EXTENSIONS = (".jpg", ".jpeg", ".png", ".webp", ".gif")
TICKET_HOST_HINTS = ("clubautomation.com", "utrsports.net", "traeyoungfamilyfoundation.org")


@dataclass(frozen=True)
class AgapeCenterConfig:
    slug: str
    name: str
    events_url: str
    place_data: dict


AGAPE_CENTER_CONFIGS: dict[str, AgapeCenterConfig] = {
    "bitsy-grant-tennis-center": AgapeCenterConfig(
        slug="bitsy-grant-tennis-center",
        name="Bitsy Grant Tennis Center",
        events_url="https://bitsygrant.agapetennisacademy.com/events/",
        place_data={
            "name": "Bitsy Grant Tennis Center",
            "slug": "bitsy-grant-tennis-center",
            "address": "2125 Northside Dr. NW",
            "neighborhood": "Buckhead",
            "city": "Atlanta",
            "state": "GA",
            "zip": "30305",
            "lat": 33.8131096,
            "lng": -84.4076328,
            "venue_type": "fitness_center",
            "spot_type": "recreation",
            "website": "https://bitsygrant.agapetennisacademy.com",
            "vibes": ["tennis", "pickleball", "outdoor", "community"],
            "description": "City of Atlanta public racquet center managed by Agape Tennis Academy with tennis and pickleball events.",
        },
    ),
    "chastain-park-tennis-center": AgapeCenterConfig(
        slug="chastain-park-tennis-center",
        name="Chastain Park Tennis Center",
        events_url="https://chastainpark.agapetennisacademy.com/events/",
        place_data={
            "name": "Chastain Park Tennis Center",
            "slug": "chastain-park-tennis-center",
            "address": "290 Chastain Park Ave",
            "neighborhood": "Chastain Park",
            "city": "Atlanta",
            "state": "GA",
            "zip": "30342",
            "lat": 33.8731334,
            "lng": -84.3960896,
            "venue_type": "fitness_center",
            "spot_type": "recreation",
            "website": "https://chastainpark.agapetennisacademy.com",
            "vibes": ["tennis", "pickleball", "outdoor", "community"],
            "description": "City of Atlanta public racquet center in Chastain Park managed by Agape Tennis Academy.",
        },
    ),
    "sharon-lester-tennis-center": AgapeCenterConfig(
        slug="sharon-lester-tennis-center",
        name="Sharon Lester Tennis Center at Piedmont Park",
        events_url="https://sharonlester.agapetennisacademy.com/events/",
        place_data={
            "name": "Sharon Lester Tennis Center at Piedmont Park",
            "slug": "sharon-lester-tennis-center",
            "address": "400 Park Dr. NE",
            "neighborhood": "Midtown",
            "city": "Atlanta",
            "state": "GA",
            "zip": "30306",
            "lat": 33.7864420,
            "lng": -84.3716600,
            "venue_type": "fitness_center",
            "spot_type": "recreation",
            "website": "https://sharonlester.agapetennisacademy.com",
            "vibes": ["tennis", "pickleball", "outdoor", "community"],
            "description": "City of Atlanta tennis and pickleball center at Piedmont Park managed by Agape Tennis Academy.",
        },
    ),
    "washington-park-tennis-center": AgapeCenterConfig(
        slug="washington-park-tennis-center",
        name="Washington Park Tennis Center",
        events_url="https://washingtonpark.agapetennisacademy.com/events/",
        place_data={
            "name": "Washington Park Tennis Center",
            "slug": "washington-park-tennis-center",
            "address": "1125 Lena St. NW",
            "neighborhood": "Washington Park",
            "city": "Atlanta",
            "state": "GA",
            "zip": "30314",
            "lat": 33.7567587,
            "lng": -84.4240071,
            "venue_type": "fitness_center",
            "spot_type": "recreation",
            "website": "https://washingtonpark.agapetennisacademy.com",
            "vibes": ["tennis", "pickleball", "outdoor", "community"],
            "description": "Westside City of Atlanta racquet center managed by Agape Tennis Academy.",
        },
    ),
    "joseph-mcghee-tennis-center": AgapeCenterConfig(
        slug="joseph-mcghee-tennis-center",
        name="Joseph McGhee Tennis Center",
        events_url="https://mcghee.agapetennisacademy.com/events/",
        place_data={
            "name": "Joseph McGhee Tennis Center",
            "slug": "joseph-mcghee-tennis-center",
            "address": "820 Beecher St. SW",
            "neighborhood": "West End",
            "city": "Atlanta",
            "state": "GA",
            "zip": "30311",
            "lat": 33.7337777,
            "lng": -84.4157412,
            "venue_type": "fitness_center",
            "spot_type": "recreation",
            "website": "https://mcghee.agapetennisacademy.com",
            "vibes": ["tennis", "pickleball", "outdoor", "community"],
            "description": "Southwest Atlanta public tennis center managed by Agape Tennis Academy.",
        },
    ),
}


def clean_text(value: str | None) -> str:
    return " ".join((value or "").replace("\xa0", " ").split()).strip()


def find_detail_events_url(soup: BeautifulSoup, current_url: str) -> Optional[str]:
    for anchor in soup.find_all("a", href=True):
        href = anchor["href"].strip()
        if not href.startswith("http"):
            continue
        if href.rstrip("/") == current_url.rstrip("/"):
            continue
        if "/20" not in href or "events" not in href:
            continue
        if urlparse(href).netloc != urlparse(current_url).netloc:
            continue
        return href
    return None


def extract_table_year(page_text: str, page_url: str) -> int:
    patterns = [
        r"\b(20\d{2})\b\s+adult(?:\s+and\s+junior)?\s+tennis(?:\s+and\s+pickleball)?\s+events",
        r"\b(20\d{2})\b\s+tennis(?:\s+and\s+pickleball)?\s+events",
    ]
    lowered = page_text.lower()
    for pattern in patterns:
        match = re.search(pattern, lowered, re.IGNORECASE)
        if match:
            return int(match.group(1))

    url_match = re.search(r"/(20\d{2})-[^/]*events", page_url)
    if url_match:
        return int(url_match.group(1))

    return datetime.now().year


def parse_meridian_time(raw_text: str) -> Optional[str]:
    match = re.search(r"(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)", raw_text, re.IGNORECASE)
    if not match:
        return None

    hour = int(match.group(1))
    minute = int(match.group(2) or "00")
    period = match.group(3).lower()

    if period.startswith("p") and hour != 12:
        hour += 12
    elif period.startswith("a") and hour == 12:
        hour = 0

    return f"{hour:02d}:{minute:02d}"


def parse_time_range(time_label: str) -> tuple[Optional[str], Optional[str]]:
    normalized = clean_text(time_label)
    if not normalized:
        return None, None

    normalized = normalized.replace("–", "-").replace("—", "-")
    normalized = normalized.split("&", 1)[0].strip()

    if "-" not in normalized:
        return parse_meridian_time(normalized), None

    start_part, end_part = [part.strip() for part in normalized.split("-", 1)]
    end_period_match = re.search(r"(a\.?m\.?|p\.?m\.?)", end_part, re.IGNORECASE)
    if end_period_match and not re.search(r"(a\.?m\.?|p\.?m\.?)", start_part, re.IGNORECASE):
        start_part = f"{start_part} {end_period_match.group(1)}"

    return parse_meridian_time(start_part), parse_meridian_time(end_part)


def month_from_token(token: str, current_month: Optional[int]) -> Optional[int]:
    match = re.search(
        r"\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b",
        token,
        re.IGNORECASE,
    )
    if match:
        key = match.group(1).lower().rstrip(".")
        return MONTH_INDEX.get(key)
    return current_month


def parse_date_label(date_label: str, page_year: int) -> tuple[Optional[str], Optional[str]]:
    cleaned = clean_text(date_label).upper()
    if not cleaned:
        return None, None

    cleaned = re.sub(r"^(MON|TUE|TUES|WED|THU|THUR|FRI|SAT|SUN),\s*", "", cleaned)
    cleaned = re.sub(
        r"-(JAN(?:UARY)?|FEB(?:RUARY)?|MAR(?:CH)?|APR(?:IL)?|MAY|JUN(?:E)?|JUL(?:Y)?|AUG(?:UST)?|SEP(?:T|TEMBER)?|OCT(?:OBER)?|NOV(?:EMBER)?|DEC(?:EMBER)?)",
        r", \1",
        cleaned,
    )
    cleaned = cleaned.replace("&", ",")

    tokens = [token.strip() for token in cleaned.split(",") if token.strip()]
    current_month: Optional[int] = None
    current_year = page_year
    previous_month: Optional[int] = None
    all_dates: list[datetime] = []

    for token in tokens:
        token_month = month_from_token(token, current_month)
        if token_month is None:
            continue
        if previous_month is not None and token_month < previous_month:
            current_year += 1
        current_month = token_month
        previous_month = token_month

        numbers = [int(number) for number in re.findall(r"\d{1,2}", token)]
        if not numbers:
            continue

        if "-" in token and len(numbers) >= 2:
            start_day, end_day = numbers[0], numbers[1]
            all_dates.append(datetime(current_year, current_month, start_day))
            all_dates.append(datetime(current_year, current_month, end_day))
            continue

        for day in numbers:
            all_dates.append(datetime(current_year, current_month, day))

    if not all_dates:
        return None, None

    start_date = min(all_dates).strftime("%Y-%m-%d")
    end_date = max(all_dates).strftime("%Y-%m-%d")
    return start_date, None if start_date == end_date else end_date


def should_skip_event(title: str, venue_name: str) -> bool:
    lowered = title.lower()
    if "league" in lowered:
        return True
    if "ladder" in lowered:
        return True
    if re.search(r"\balta\b", lowered):
        return True
    if "held at" in lowered and venue_name.lower() not in lowered:
        return True
    return False


def extract_row_links(row) -> tuple[Optional[str], Optional[str]]:
    image_url = None
    ticket_url = None

    for anchor in row.find_all("a", href=True):
        href = anchor["href"].strip()
        if not href.startswith("http"):
            href = f"https://{href.lstrip('/')}"

        lowered = href.lower()
        if lowered.endswith(IMAGE_EXTENSIONS) and image_url is None:
            image_url = href
            continue

        if any(host_hint in lowered for host_hint in TICKET_HOST_HINTS) and ticket_url is None:
            ticket_url = href

    return image_url, ticket_url


def resolve_event_page(config: AgapeCenterConfig) -> tuple[str, BeautifulSoup]:
    response = requests.get(
        config.events_url,
        headers={"User-Agent": USER_AGENT},
        timeout=30,
    )
    response.raise_for_status()
    soup = BeautifulSoup(response.text, "html.parser")

    detail_url = find_detail_events_url(soup, config.events_url)
    if detail_url:
        try:
            detail_response = requests.get(
                detail_url,
                headers={"User-Agent": USER_AGENT},
                timeout=30,
            )
            if detail_response.ok:
                detail_soup = BeautifulSoup(detail_response.text, "html.parser")
                if detail_soup.find("table"):
                    return detail_url, detail_soup
        except requests.RequestException:
            logger.warning("Failed loading detail events page for %s", config.slug)

    return config.events_url, soup


def classify_event(title: str) -> tuple[str, list[str]]:
    lowered = title.lower()
    tags = ["agape-tennis", "city-racquet-center"]

    if any(keyword in lowered for keyword in ("pickleball", "pball", "dinks")):
        tags.append("pickleball")
        subcategory = "pickleball"
    else:
        tags.append("tennis")
        subcategory = "tennis"

    if any(keyword in lowered for keyword in ("tournament", "championship", "match play")):
        tags.append("tournament")
    if any(keyword in lowered for keyword in ("round robin", " rr", "rr ")):
        tags.append("round-robin")
    if any(keyword in lowered for keyword in ("drills", "clinic", "showcase", "preview")):
        tags.append("clinic")
    if "camp" in lowered:
        tags.append("camp")
    if any(keyword in lowered for keyword in ("social", "singles", "community night", "community tennis")):
        tags.append("social")
    if "free" in lowered:
        tags.append("free")

    return subcategory, tags


def build_description(title: str, venue_name: str, price_label: str) -> str:
    description = f"{title} at {venue_name}. Public racquet-center event published by Agape Tennis Academy."
    if price_label:
        description += f" Cost: {price_label}."
    description += " Check registration details before attending."
    return description


def upsert_event(
    source_id: int,
    venue_id: int,
    venue_name: str,
    event_title: str,
    start_date: str,
    end_date: Optional[str],
    time_label: str,
    price_label: str,
    source_url: str,
    image_url: Optional[str],
    ticket_url: Optional[str],
) -> tuple[bool, bool]:
    start_time, end_time = parse_time_range(time_label)
    subcategory, tags = classify_event(event_title)
    content_hash = generate_content_hash(event_title, venue_name, start_date)

    event_record = {
        "source_id": source_id,
        "venue_id": venue_id,
        "title": event_title,
        "description": build_description(event_title, venue_name, price_label),
        "start_date": start_date,
        "start_time": start_time,
        "end_date": end_date,
        "end_time": end_time,
        "is_all_day": False,
        "category": "sports",
        "subcategory": subcategory,
        "tags": tags,
        "price_min": 0 if price_label.strip().lower() == "free" else None,
        "price_max": 0 if price_label.strip().lower() == "free" else None,
        "price_note": price_label or None,
        "is_free": price_label.strip().lower() == "free",
        "source_url": source_url,
        "ticket_url": ticket_url,
        "image_url": image_url,
        "raw_text": f"{event_title}\n{time_label}\n{price_label}",
        "extraction_confidence": 0.88,
        "is_recurring": False,
        "recurrence_rule": None,
        "content_hash": content_hash,
    }

    existing = find_event_by_hash(content_hash)
    if existing:
        smart_update_existing_event(existing, event_record)
        return False, True

    insert_event(event_record)
    return True, False


def crawl_agape_center(source: dict, config: AgapeCenterConfig) -> tuple[int, int, int]:
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    page_url, soup = resolve_event_page(config)
    page_text = clean_text(soup.get_text(" ", strip=True))
    page_year = extract_table_year(page_text, page_url)
    today = datetime.now().date()

    default_venue_id = get_or_create_place(config.place_data)
    table = soup.find("table")
    if not table:
        logger.warning("No events table found for %s", config.slug)
        return events_found, events_new, events_updated

    known_centers = {center.place_data["name"].lower(): center for center in AGAPE_CENTER_CONFIGS.values()}

    for row in table.find_all("tr")[1:]:
        cells = row.find_all("td")
        if len(cells) < 4:
            continue

        date_label = clean_text(cells[0].get_text(" ", strip=True))
        title = clean_text(cells[1].get_text(" ", strip=True))
        time_label = clean_text(cells[2].get_text(" ", strip=True))
        price_label = clean_text(cells[3].get_text(" ", strip=True))

        if not title or should_skip_event(title, config.place_data["name"]):
            continue

        start_date, end_date = parse_date_label(date_label, page_year)
        if not start_date:
            logger.warning("Could not parse date '%s' for %s", date_label, title)
            continue

        if datetime.strptime(end_date or start_date, "%Y-%m-%d").date() < today:
            continue

        image_url, ticket_url = extract_row_links(row)

        place_data = config.place_data
        for known_name, known_center in known_centers.items():
            if known_name in title.lower():
                place_data = known_center.place_data
                break

        venue_id = default_venue_id if place_data["slug"] == config.place_data["slug"] else get_or_create_place(place_data)
        venue_name = place_data["name"]

        events_found += 1
        inserted, updated = upsert_event(
            source_id=source_id,
            venue_id=venue_id,
            venue_name=venue_name,
            event_title=title,
            start_date=start_date,
            end_date=end_date,
            time_label=time_label,
            price_label=price_label,
            source_url=page_url,
            image_url=image_url,
            ticket_url=ticket_url,
        )
        if inserted:
            events_new += 1
        if updated:
            events_updated += 1

    logger.info(
        "%s: found=%s new=%s updated=%s (page=%s year=%s)",
        config.slug,
        events_found,
        events_new,
        events_updated,
        page_url,
        page_year,
    )
    return events_found, events_new, events_updated
