"""
Shared base for server-rendered The Events Calendar HTML list pages.

This covers sites that expose upcoming events as standard
`div.type-tribe_events` blocks with `tribe-event-schedule-details` markup but
do not provide a usable public Tribe REST API.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
import logging
import re
from typing import Callable, Optional

import requests
from bs4 import BeautifulSoup

from db import find_event_by_hash, get_or_create_place, insert_event, smart_update_existing_event
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

_USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"


@dataclass
class HtmlTribeConfig:
    events_url: str
    place_data: dict
    categorize_event: Callable[[str, str], tuple[str, Optional[str], list[str]]]
    is_public_event: Optional[Callable[[str, str], bool]] = None
    container_finder: Optional[Callable[[BeautifulSoup], list]] = None
    container_parser: Optional[Callable[[object, str], Optional[dict]]] = None
    free_markers: tuple[str, ...] = ("$", "cost", "fee", "price", "registration")
    max_description_length: int = 1000
    extraction_confidence: float = 0.9
    headers: dict = field(
        default_factory=lambda: {
            "User-Agent": _USER_AGENT,
        }
    )


def parse_date_from_text(date_text: str) -> Optional[str]:
    if not date_text:
        return None

    current_year = datetime.now().year
    date_text = date_text.strip()

    match = re.match(
        r"(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})(?:,?\s+(\d{4}))?",
        date_text,
        re.IGNORECASE,
    )
    if match:
        month = match.group(1)
        day = int(match.group(2))
        year = int(match.group(3)) if match.group(3) else current_year
        try:
            dt = datetime.strptime(f"{month} {day} {year}", "%B %d %Y")
            if not match.group(3) and dt.date() < datetime.now().date():
                dt = datetime.strptime(f"{month} {day} {year + 1}", "%B %d %Y")
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            pass

    match = re.match(
        r"(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})(?:,?\s+(\d{4}))?",
        date_text,
        re.IGNORECASE,
    )
    if match:
        month = match.group(1)
        day = int(match.group(2))
        year = int(match.group(3)) if match.group(3) else current_year
        try:
            dt = datetime.strptime(f"{month} {day} {year}", "%b %d %Y")
            if not match.group(3) and dt.date() < datetime.now().date():
                dt = datetime.strptime(f"{month} {day} {year + 1}", "%b %d %Y")
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            pass

    return None


def parse_time_from_text(time_text: str) -> Optional[str]:
    if not time_text:
        return None

    match = re.match(r"(\d{1,2}):(\d{2})\s*(am|pm)", time_text.strip(), re.IGNORECASE)
    if not match:
        return None

    hour = int(match.group(1))
    minute = int(match.group(2))
    period = match.group(3).lower()
    if period == "pm" and hour != 12:
        hour += 12
    elif period == "am" and hour == 12:
        hour = 0
    return f"{hour:02d}:{minute:02d}"


def _extract_event_rows(soup: BeautifulSoup) -> list:
    return soup.find_all("div", class_="type-tribe_events")


def _default_parse_container(container, events_url: str) -> Optional[dict]:
    title_elem = container.find("h3", class_="tribe-events-list-event-title")
    if not title_elem:
        return None

    link_elem = title_elem.find("a", class_="tribe-event-url") or title_elem.find("a")
    if not link_elem:
        return None

    title = link_elem.get_text(strip=True)
    event_url = link_elem.get("href", events_url)
    if not title:
        return None

    desc_elem = container.find("div", class_="tribe-events-list-event-description")
    description = None
    if desc_elem:
        desc_text = desc_elem.get_text(" ", strip=True)
        desc_text = re.sub(r"\s*Read More\s*$", "", desc_text)
        description = desc_text if len(desc_text) > 10 else None

    schedule_elem = container.find("div", class_="tribe-event-schedule-details")
    if not schedule_elem:
        return None

    date_start_elem = schedule_elem.find("span", class_="tribe-event-date-start")
    if not date_start_elem:
        return None

    month_hl_elem = date_start_elem.find("span", class_="month-hl")
    if month_hl_elem:
        date_text = month_hl_elem.get_text(strip=True)
    else:
        date_text = date_start_elem.get_text(" ", strip=True).split("\n")[0]

    start_date = parse_date_from_text(date_text)
    if not start_date:
        return None

    start_time = None
    time_parts = str(date_start_elem).split("<br/>")
    if len(time_parts) > 1:
        time_text = BeautifulSoup(time_parts[1], "html.parser").get_text(strip=True)
        start_time = parse_time_from_text(time_text)

    end_time = None
    time_elem = schedule_elem.find("span", class_="tribe-event-time")
    if time_elem:
        end_time = parse_time_from_text(time_elem.get_text(strip=True))

    return {
        "title": title,
        "event_url": event_url,
        "description": description,
        "start_date": start_date,
        "start_time": start_time,
        "end_time": end_time,
    }


def crawl_html_tribe(source: dict, config: HtmlTribeConfig) -> tuple[int, int, int]:
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    venue_id = get_or_create_place(config.place_data)
    response = requests.get(config.events_url, headers=config.headers, timeout=20)
    response.raise_for_status()
    soup = BeautifulSoup(response.text, "html.parser")
    event_containers = (
        config.container_finder(soup)
        if config.container_finder
        else _extract_event_rows(soup)
    )

    if not event_containers:
        logger.warning("[tribe-html/%s] No events found on page", config.place_data.get("slug", "?"))
        return 0, 0, 0

    logger.info(
        "[tribe-html/%s] Found %d event containers",
        config.place_data.get("slug", "?"),
        len(event_containers),
    )

    seen_events: set[str] = set()
    today = datetime.now().date()

    for container in event_containers:
        try:
            parsed = (
                config.container_parser(container, config.events_url)
                if config.container_parser
                else _default_parse_container(container, config.events_url)
            )
            if not parsed:
                continue

            title = parsed["title"]
            event_url = parsed["event_url"]
            description = parsed.get("description")
            start_date = parsed["start_date"]

            if config.is_public_event and not config.is_public_event(title, description or ""):
                continue

            try:
                event_date = datetime.strptime(start_date, "%Y-%m-%d").date()
                if event_date < today:
                    continue
            except ValueError:
                continue

            start_time = parsed.get("start_time")
            end_time = parsed.get("end_time")

            event_key = f"{title}|{start_date}"
            if event_key in seen_events:
                continue
            seen_events.add(event_key)

            events_found += 1
            content_hash = generate_content_hash(title, config.place_data["name"], start_date)
            category, subcategory, tags = config.categorize_event(title, description or "")

            is_free = False
            if description and any(marker in description.lower() for marker in config.free_markers):
                is_free = "free" in description.lower()

            event_record = {
                "source_id": source_id,
                "place_id": venue_id,
                "title": title[:200],
                "description": description[: config.max_description_length] if description else None,
                "start_date": start_date,
                "start_time": start_time,
                "end_date": start_date,
                "end_time": end_time,
                "is_all_day": False,
                "category": category,
                "subcategory": subcategory,
                "tags": tags,
                "price_min": 0 if is_free else None,
                "price_max": 0 if is_free else None,
                "price_note": "Free" if is_free else None,
                "is_free": is_free,
                "source_url": event_url,
                "ticket_url": event_url,
                "image_url": None,
                "raw_text": f"{title} {description or ''}"[:500],
                "extraction_confidence": config.extraction_confidence,
                "is_recurring": False,
                "recurrence_rule": None,
                "content_hash": content_hash,
            }

            existing = find_event_by_hash(content_hash)
            if existing:
                smart_update_existing_event(existing, event_record)
                events_updated += 1
                continue

            insert_event(event_record)
            events_new += 1
        except Exception as exc:
            logger.debug(
                "[tribe-html/%s] Failed to parse event container: %s",
                config.place_data.get("slug", "?"),
                exc,
            )
            continue

    logger.info(
        "[tribe-html/%s] Crawl complete: %d found, %d new, %d updated",
        config.place_data.get("slug", "?"),
        events_found,
        events_new,
        events_updated,
    )
    return events_found, events_new, events_updated
