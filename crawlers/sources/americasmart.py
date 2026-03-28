"""
Crawler for official AmericasMart / Atlanta Market dates.

This source should publish the concrete upcoming market windows surfaced on the
official Atlanta Market dates page rather than trying to infer events from
generic venue copy.
"""

from __future__ import annotations

import logging
import re
from datetime import date, datetime, timedelta
from typing import Optional
from urllib.parse import urlsplit, urlunsplit

from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright

from db import (
    find_existing_event_for_insert,
    get_or_create_place,
    insert_event,
    remove_stale_source_events,
    smart_update_existing_event,
)
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://www.americasmart.com"
MARKET_DATES_URL = "https://www.atlantamarket.com/Attend/Market-Dates-and-Hours"
USER_AGENT = "Mozilla/5.0 (compatible; LostCityBot/1.0)"
MAX_FUTURE_DAYS = 270
TRADE_ONLY_NOTE = "Trade-only market; proof of trade status required for registration."

PLACE_DATA = {
    "name": "AmericasMart Atlanta",
    "slug": "americasmart",
    "address": "240 Peachtree St NW",
    "neighborhood": "Downtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30303",
    "lat": 33.7589,
    "lng": -84.3879,
    "place_type": "convention_center",
    "spot_type": "convention_center",
    "website": BASE_URL,
}

MONTHS = {
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

MARKET_SPECS = {
    "SUMMER MARKET 2026": {
        "title": "Atlanta Market Summer 2026",
        "tags": ["market", "trade-show", "gift", "home", "design", "wholesale", "downtown"],
        "subcategory": "market",
        "description": (
            "Atlanta Market Summer 2026 is the flagship AmericasMart wholesale market for gift, "
            "home, and design buyers. Showrooms run June 9-14, 2026, with temporaries open "
            "June 9-13 and closing early on Saturday."
        ),
    },
    "SPRING CASH & CARRY": {
        "title": "Spring Cash & Carry",
        "tags": ["market", "trade-show", "gift", "home", "wholesale", "downtown"],
        "subcategory": "market",
        "description": (
            "Spring Cash & Carry is AmericasMart's mid-season gift and home buying market with "
            "showrooms and temporaries in Downtown Atlanta."
        ),
    },
    "MARCH ATLANTA APPAREL": {
        "title": "March Atlanta Apparel",
        "tags": ["market", "trade-show", "apparel", "fashion", "wholesale", "downtown"],
        "subcategory": "market",
        "description": (
            "March Atlanta Apparel is the official AmericasMart fashion buying market, bringing "
            "apparel showrooms and temporaries together in Downtown Atlanta."
        ),
    },
}


def clean_text(value: str) -> str:
    return re.sub(r"\s+", " ", (value or "").strip())


def sanitize_url(url: Optional[str]) -> Optional[str]:
    if not url:
        return None
    parts = urlsplit(url)
    return urlunsplit((parts.scheme, parts.netloc, parts.path, "", ""))


def parse_date_line(text: str) -> tuple[str, Optional[str]]:
    cleaned = clean_text(text).replace("–", "-").replace("—", "-")
    cleaned = re.sub(
        r"\b(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s+",
        "",
        cleaned,
        flags=re.IGNORECASE,
    )
    match = re.search(
        r"([A-Za-z]+)\s+(\d{1,2})\s*-\s*(?:([A-Za-z]+)\s+)?(\d{1,2}),\s*(\d{4})",
        cleaned,
        re.IGNORECASE,
    )
    if not match:
        raise ValueError(f"Could not parse AmericasMart date line: {text}")

    start_month_label, start_day_str, end_month_label, end_day_str, year_str = match.groups()
    year = int(year_str)
    start_month = MONTHS[start_month_label.lower()]
    end_month = MONTHS[(end_month_label or start_month_label).lower()]
    start_date = date(year, start_month, int(start_day_str))
    end_date = date(year, end_month, int(end_day_str))
    return start_date.isoformat(), end_date.isoformat()


def parse_time_line(text: str) -> tuple[Optional[str], Optional[str]]:
    cleaned = clean_text(text).replace("*", "").replace("–", "-").replace("—", "-")
    match = re.search(
        r"(\d{1,2})(?::(\d{2}))?\s*(a\.m\.|p\.m\.|am|pm)\s*-\s*"
        r"(\d{1,2})(?::(\d{2}))?\s*(a\.m\.|p\.m\.|am|pm)",
        cleaned,
        re.IGNORECASE,
    )
    if not match:
        return None, None

    start_hour, start_minute, start_period, end_hour, end_minute, end_period = match.groups()
    return (
        _to_24h(start_hour, start_minute or "00", start_period),
        _to_24h(end_hour, end_minute or "00", end_period),
    )


def _to_24h(hour: str, minute: str, period: str) -> str:
    value = int(hour)
    normalized = period.lower().replace(".", "")
    if normalized == "pm" and value != 12:
        value += 12
    if normalized == "am" and value == 12:
        value = 0
    return f"{value:02d}:{minute}"


def _find_heading(soup: BeautifulSoup, heading_text: str) -> Optional[BeautifulSoup]:
    return soup.find(["h1", "h2", "h3"], string=lambda value: clean_text(value) == heading_text)


def _find_section_container(heading: BeautifulSoup) -> Optional[BeautifulSoup]:
    return heading.find_parent("div", class_=lambda value: value and "imc-section--inner-content" in value)


def _find_following_ticket_url(heading: BeautifulSoup) -> Optional[str]:
    for element in heading.find_all_next():
        if element.name in {"h1", "h2", "h3"} and element is not heading:
            next_heading = clean_text(element.get_text(" ", strip=True))
            if next_heading in MARKET_SPECS or next_heading == "FUTURE ATLANTA MARKET DATES":
                break
        if element.name == "a":
            href = sanitize_url(element.get("href"))
            if href and "xpressreg" in href.lower():
                return href
    return None


def _extract_section_links(container: BeautifulSoup) -> tuple[Optional[str], Optional[str]]:
    source_url = None
    ticket_url = None

    for anchor in container.select("a[href]"):
        href = sanitize_url(anchor.get("href"))
        if not href:
            continue
        text = clean_text(anchor.get_text(" ", strip=True)).upper()

        if "XPRESSREG" in href.upper() and ticket_url is None:
            ticket_url = href
            continue

        if text in {"REGISTER NOW", "REGISTRATION"} and ticket_url is None:
            ticket_url = href
            continue

        if source_url is None and text not in {"REGISTER NOW", "REGISTRATION"}:
            source_url = href

    return source_url or MARKET_DATES_URL, ticket_url


def _extract_image_url(container: BeautifulSoup) -> Optional[str]:
    image = container.find("img", src=True)
    if not image:
        return None
    return sanitize_url(image.get("src"))


def _build_raw_text(lines: list[str]) -> str:
    kept = [line for line in lines if line.upper() not in {"REGISTER NOW", "REGISTRATION", "LEARN MORE"}]
    return " | ".join(kept[:8])


def parse_market_sections(html_text: str, today: date | None = None) -> list[dict]:
    today = today or datetime.now().date()
    soup = BeautifulSoup(html_text, "html.parser")
    events: list[dict] = []

    for heading_text, spec in MARKET_SPECS.items():
        heading = _find_heading(soup, heading_text)
        if not heading:
            continue
        container = _find_section_container(heading)
        if container is None:
            continue

        lines = [
            clean_text(line)
            for line in container.get_text("\n", strip=True).splitlines()
            if clean_text(line)
        ]
        date_line = next(
            (
                line
                for line in lines
                if re.search(r"\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\b", line, re.IGNORECASE)
                and ("-" in line or "–" in line or "—" in line)
                and re.search(r"\b20\d{2}\b", line)
            ),
            None,
        )
        time_line = next((line for line in lines if re.search(r"\ba\.m\.|\bp\.m\.|\bam\b|\bpm\b", line, re.IGNORECASE)), None)
        if not date_line:
            continue

        start_date, end_date = parse_date_line(date_line)
        start_dt = datetime.strptime(start_date, "%Y-%m-%d").date()
        if start_dt < today:
            continue
        if start_dt > today + timedelta(days=MAX_FUTURE_DAYS):
            continue

        start_time, end_time = parse_time_line(time_line or "")
        source_url, ticket_url = _extract_section_links(container)
        ticket_url = ticket_url or _find_following_ticket_url(heading)
        image_url = _extract_image_url(container)

        events.append(
            {
                "title": spec["title"],
                "description": spec["description"],
                "start_date": start_date,
                "end_date": end_date,
                "start_time": start_time,
                "end_time": end_time,
                "is_all_day": start_time is None,
                "subcategory": spec["subcategory"],
                "tags": spec["tags"],
                "source_url": source_url,
                "ticket_url": ticket_url,
                "image_url": image_url,
                "raw_text": _build_raw_text(lines),
            }
        )

    return events


def fetch_market_dates_html() -> str:
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        context = browser.new_context(
            user_agent=USER_AGENT,
            viewport={"width": 1440, "height": 2200},
        )
        page = context.new_page()
        page.goto(MARKET_DATES_URL, wait_until="networkidle", timeout=90000)
        html = page.content()
        browser.close()
        return html


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl official upcoming Atlanta Market windows from the market dates page."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0
    current_hashes: set[str] = set()

    html_text = fetch_market_dates_html()
    events = parse_market_sections(html_text)
    if not events:
        raise ValueError("AmericasMart market dates page did not yield any current market windows")

    venue_id = get_or_create_place(PLACE_DATA)

    for event in events:
        title = event["title"]
        content_hash = generate_content_hash(title, PLACE_DATA["name"], event["start_date"])
        current_hashes.add(content_hash)
        events_found += 1

        event_record = {
            "source_id": source_id,
            "place_id": venue_id,
            "title": title,
            "description": event["description"],
            "start_date": event["start_date"],
            "start_time": event["start_time"],
            "end_date": event["end_date"],
            "end_time": event["end_time"],
            "is_all_day": event["is_all_day"],
            "category": "community",
            "subcategory": event["subcategory"],
            "tags": event["tags"],
            "price_min": None,
            "price_max": None,
            "price_note": TRADE_ONLY_NOTE,
            "is_free": False,
            "source_url": event["source_url"],
            "ticket_url": event["ticket_url"],
            "image_url": event["image_url"],
            "raw_text": event["raw_text"],
            "extraction_confidence": 0.95,
            "is_recurring": False,
            "recurrence_rule": None,
            "content_hash": content_hash,
        }

        existing = find_existing_event_for_insert(event_record)
        if existing:
            smart_update_existing_event(existing, event_record)
            events_updated += 1
            continue

        insert_event(event_record)
        events_new += 1
        logger.info("Added AmericasMart market: %s on %s", title, event["start_date"])

    removed = remove_stale_source_events(source_id, current_hashes)
    if removed:
        logger.info("Removed %s stale AmericasMart events", removed)

    logger.info(
        "AmericasMart crawl complete: %s found, %s new, %s updated",
        events_found,
        events_new,
        events_updated,
    )
    return events_found, events_new, events_updated
