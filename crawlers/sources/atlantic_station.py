"""
Crawler for Atlantic Station (atlanticstation.com).

The current site exposes an event listing page plus detail pages built with
Elementor ACF widgets. Older synthetic placeholders are intentionally removed
once the live first-party calendar is available.
"""

from __future__ import annotations

import logging
import re
from datetime import datetime, timedelta
from html import unescape
from typing import Optional
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup

from db import (
    find_event_by_hash,
    get_or_create_place,
    insert_event,
    remove_stale_source_events,
    smart_update_existing_event,
)
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://atlanticstation.com"
EVENTS_URL = f"{BASE_URL}/events-list/"

PLACE_DATA = {
    "name": "Atlantic Station",
    "slug": "atlantic-station",
    "address": "1380 Atlantic Dr NW",
    "neighborhood": "Atlantic Station",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30363",
    "lat": 33.7920,
    "lng": -84.3950,
    "venue_type": "entertainment_complex",
    "spot_type": "entertainment_complex",
    "website": BASE_URL,
    "description": "Urban mixed-use retail and entertainment destination with outdoor plaza, concerts, and seasonal events.",
}

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
}

WEEKDAY_TO_BYDAY = {
    "monday": "MO",
    "tuesday": "TU",
    "wednesday": "WE",
    "thursday": "TH",
    "friday": "FR",
    "saturday": "SA",
    "sunday": "SU",
}


def normalize_title(value: str) -> str:
    """Normalize Atlantic Station card titles into readable title case."""
    cleaned = unescape(value or "").strip()
    if not cleaned:
        return ""

    lowered = cleaned.lower()
    if lowered == cleaned:
        cleaned = " ".join(word.capitalize() for word in cleaned.split())
    return cleaned


def parse_time_value(value: str) -> Optional[str]:
    """Parse a single time label into HH:MM."""
    match = re.search(r"(\d{1,2})(?::(\d{2}))?\s*(am|pm|a|p)", value, re.IGNORECASE)
    if not match:
        return None

    hour = int(match.group(1))
    minute = int(match.group(2) or 0)
    period = match.group(3).lower()
    if period in {"pm", "p"} and hour != 12:
        hour += 12
    elif period in {"am", "a"} and hour == 12:
        hour = 0
    return f"{hour:02d}:{minute:02d}"


def parse_time_range(label: str) -> tuple[Optional[str], Optional[str], bool]:
    """Parse Atlantic Station time labels like '6pm-7:30pm'."""
    cleaned = " ".join((label or "").replace("–", "-").split())
    lowered = cleaned.lower()
    if not cleaned:
        return None, None, True
    if any(token in lowered for token in ["hours vary", "various times", "times vary"]):
        return None, None, True

    if "starts at" in lowered:
        start = parse_time_value(cleaned.split("starts at", 1)[1])
        return start, None, start is None

    if "-" not in cleaned:
        start = parse_time_value(cleaned)
        return start, None, start is None

    start_part, end_part = [part.strip() for part in cleaned.split("-", 1)]
    end_period_match = re.search(r"(am|pm)$", end_part, re.IGNORECASE)
    if end_period_match and not re.search(r"(am|pm)$", start_part, re.IGNORECASE):
        start_part = f"{start_part} {end_period_match.group(1)}"

    start = parse_time_value(start_part)
    end = parse_time_value(end_part)
    return start, end, start is None and end is None


def parse_month_day(date_str: str, reference_date: Optional[datetime] = None) -> Optional[datetime]:
    """Parse current-year month/day labels from Atlantic Station cards."""
    cleaned = " ".join((date_str or "").replace(".", "").split())
    if not cleaned:
        return None

    reference_date = reference_date or datetime.now()
    formats = ["%B %d %Y", "%b %d %Y"]
    for fmt in formats:
        try:
            return datetime.strptime(f"{cleaned} {reference_date.year}", fmt)
        except ValueError:
            continue
    return None


def next_occurrence_for_repeat(
    repeat_type: str,
    start_dt: datetime,
    reference_date: Optional[datetime] = None,
) -> tuple[datetime, Optional[str]]:
    """Advance recurring Atlantic Station series to the next real occurrence."""
    reference_date = reference_date or datetime.now()
    lowered = (repeat_type or "").strip().lower()

    for weekday_name, byday in WEEKDAY_TO_BYDAY.items():
        if weekday_name not in lowered:
            continue

        target_weekday = list(WEEKDAY_TO_BYDAY.keys()).index(weekday_name)
        anchor = max(start_dt.date(), reference_date.date())
        days_ahead = (target_weekday - anchor.weekday()) % 7
        next_date = datetime.combine(anchor + timedelta(days=days_ahead), datetime.min.time())
        return next_date, f"FREQ=WEEKLY;BYDAY={byday}"

    return start_dt, None


def determine_category(title: str, description: str) -> tuple[str, Optional[str], list[str]]:
    """Determine category based on Atlantic Station event copy."""
    text = f"{title} {description}".lower()
    tags = ["atlantic-station", "midtown"]

    if any(word in text for word in ["run club", "run ", "wellness", "yoga", "fitness"]):
        return "fitness", None, tags + ["wellness", "outdoor"]
    if any(word in text for word in ["movie", "film", "screen"]):
        return "film", "screening", tags + ["film", "outdoor"]
    if any(word in text for word in ["tot spot", "kids", "family", "little ones"]):
        return "family", None, tags + ["family-friendly", "kids"]
    if any(word in text for word in ["sample sale", "prom dress", "giveaway", "market"]):
        return "community", "market", tags + ["shopping"]
    if any(word in text for word in ["panda fest", "food", "festival"]):
        return "food_drink", "festival", tags + ["festival", "food"]
    if any(word in text for word in ["piano", "music", "concert"]):
        return "music", "live", tags + ["music"]

    return "community", None, tags


def _extract_field_value(container: BeautifulSoup, field_name: str) -> Optional[str]:
    marker = f'"acf_field_list":"{field_name}"'
    for node in container.select(".elementor-widget-dyncontel-acf"):
        settings = node.get("data-settings") or ""
        if marker not in settings:
            continue
        value = node.get_text(" ", strip=True)
        if value:
            return unescape(value).strip()
    return None


def _extract_background_image(node: BeautifulSoup) -> Optional[str]:
    figure = node.select_one("figure.dynamic-content-featuredimage-bg")
    if not figure:
        return None
    style = figure.get("style") or ""
    match = re.search(r"background-image:\s*url\(([^)]+)\)", style)
    if not match:
        return None
    return match.group(1).strip("'\" ")


def extract_listing_cards(html: str) -> list[dict]:
    """Extract event cards from Atlantic Station's event list page."""
    soup = BeautifulSoup(html, "html.parser")
    cards: list[dict] = []
    seen_urls: set[str] = set()

    for card in soup.select("div.elementor-location-single"):
        link = card.select_one('a[href*="/event/"]')
        title_node = card.select_one("h4.elementor-heading-title")
        if not link or not title_node:
            continue

        detail_url = urljoin(BASE_URL, link.get("href", "").strip())
        if not detail_url or detail_url in seen_urls:
            continue
        seen_urls.add(detail_url)

        title = normalize_title(title_node.get_text(" ", strip=True))
        if not title:
            continue

        date_label = _extract_field_value(card, "event_date")
        image_url = _extract_background_image(card)
        cards.append(
            {
                "title": title,
                "detail_url": detail_url,
                "date_label": date_label,
                "image_url": image_url,
            }
        )

    return cards


def is_missing_detail_page(response: requests.Response, html: str) -> bool:
    """Detect dead Atlantic Station detail pages that still return branded HTML."""
    if response.status_code == 404:
        return True
    soup = BeautifulSoup(html, "html.parser")
    title = soup.title.get_text(" ", strip=True).lower() if soup.title else ""
    body_text = soup.get_text(" ", strip=True).lower()
    return "page not found" in title or "sorry, page not found" in body_text


def extract_detail_data(
    html: str,
    fallback_title: str,
    fallback_image_url: Optional[str] = None,
) -> dict:
    """Extract normalized detail-page data from Atlantic Station event pages."""
    soup = BeautifulSoup(html, "html.parser")

    title_candidates = [
        node.get_text(" ", strip=True)
        for node in soup.select(".elementor-heading-title")
        if node.get_text(" ", strip=True)
    ]
    title = normalize_title(fallback_title)
    if title_candidates:
        first = normalize_title(title_candidates[0])
        if first and "atlanta, ga 30363" not in first.lower():
            title = first

    location = title_candidates[1].strip() if len(title_candidates) > 1 else None
    address = title_candidates[2].strip() if len(title_candidates) > 2 else None

    date_label = _extract_field_value(soup, "event_date")
    repeat_type = _extract_field_value(soup, "repeat_type")
    time_label = _extract_field_value(soup, "event_time_from-to")

    description_parts: list[str] = []
    for node in soup.select("p"):
        text = " ".join(node.get_text(" ", strip=True).split())
        if not text or text == "|" or text == "404" or text.lower() == "sorry, page not found":
            continue
        if text not in description_parts:
            description_parts.append(text)
    description = " ".join(description_parts).strip()

    ticket_url = None
    site_host = urlparse(BASE_URL).netloc
    for link in soup.select("a[href]"):
        href = link.get("href", "").strip()
        text = link.get_text(" ", strip=True).lower()
        if not href:
            continue
        absolute = urljoin(BASE_URL, href)
        host = urlparse(absolute).netloc
        if host == site_host:
            continue
        if any(token in text for token in ["learn more", "register", "ticket", "rsvp", "reserve"]):
            ticket_url = absolute
            break

    image_node = soup.find("meta", property="og:image")
    image_url = image_node.get("content") if image_node else fallback_image_url

    return {
        "title": title,
        "date_label": date_label,
        "repeat_type": repeat_type,
        "time_label": time_label,
        "location": location,
        "address": address,
        "description": description,
        "ticket_url": ticket_url,
        "image_url": image_url,
    }


def build_event_record(
    source_id: int,
    venue_id: int,
    detail_url: str,
    detail: dict,
    reference_date: Optional[datetime] = None,
) -> Optional[dict]:
    """Build a normalized event record from listing/detail data."""
    reference_date = reference_date or datetime.now()
    date_label = detail.get("date_label")
    start_dt = parse_month_day(date_label, reference_date=reference_date) if date_label else None
    if not start_dt:
        return None

    recurrence_rule = None
    is_recurring = False
    if detail.get("repeat_type"):
        start_dt, recurrence_rule = next_occurrence_for_repeat(
            detail["repeat_type"],
            start_dt,
            reference_date=reference_date,
        )
        is_recurring = recurrence_rule is not None

    if start_dt.date() < reference_date.date():
        return None

    start_time, end_time, is_all_day = parse_time_range(detail.get("time_label") or "")
    category, subcategory, tags = determine_category(detail["title"], detail.get("description") or "")
    start_date = start_dt.strftime("%Y-%m-%d")
    content_hash = generate_content_hash(detail["title"], PLACE_DATA["name"], start_date)

    raw_parts = [part for part in [detail.get("date_label"), detail.get("repeat_type"), detail.get("time_label"), detail.get("location")] if part]
    return {
        "source_id": source_id,
        "venue_id": venue_id,
        "title": detail["title"],
        "description": detail.get("description"),
        "start_date": start_date,
        "start_time": start_time,
        "end_date": start_date,
        "end_time": end_time,
        "is_all_day": is_all_day,
        "category": category,
        "subcategory": subcategory,
        "tags": tags,
        "price_min": None,
        "price_max": None,
        "price_note": None,
        "is_free": True,
        "source_url": detail_url,
        "ticket_url": detail.get("ticket_url"),
        "image_url": detail.get("image_url"),
        "raw_text": " | ".join(raw_parts) or None,
        "extraction_confidence": 0.86,
        "is_recurring": is_recurring,
        "recurrence_rule": recurrence_rule,
        "content_hash": content_hash,
    }


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Atlantic Station events."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0
    current_hashes: set[str] = set()

    try:
        venue_id = get_or_create_place(PLACE_DATA)
        response = requests.get(EVENTS_URL, headers=HEADERS, timeout=30)
        response.raise_for_status()

        cards = extract_listing_cards(response.text)
        logger.info("Atlantic Station list page exposed %s candidate cards", len(cards))

        for card in cards:
            detail_response = requests.get(card["detail_url"], headers=HEADERS, timeout=30)
            if is_missing_detail_page(detail_response, detail_response.text):
                logger.info("Skipping dead Atlantic Station detail page: %s", card["detail_url"])
                continue

            detail = extract_detail_data(
                detail_response.text,
                fallback_title=card["title"],
                fallback_image_url=card.get("image_url"),
            )
            if not detail.get("date_label"):
                detail["date_label"] = card.get("date_label")
            if not detail.get("image_url"):
                detail["image_url"] = card.get("image_url")

            event_record = build_event_record(
                source_id,
                venue_id,
                detail_url=card["detail_url"],
                detail=detail,
            )
            if not event_record:
                continue

            events_found += 1
            current_hashes.add(event_record["content_hash"])

            existing = find_event_by_hash(event_record["content_hash"])
            if existing:
                smart_update_existing_event(existing, event_record)
                events_updated += 1
                continue

            insert_event(event_record)
            events_new += 1
            logger.info("Added Atlantic Station event: %s", event_record["title"])

        stale_removed = remove_stale_source_events(source_id, current_hashes)
        if stale_removed:
            logger.info("Removed %s stale Atlantic Station rows", stale_removed)

        logger.info(
            "Atlantic Station crawl complete: %s found, %s new, %s updated",
            events_found,
            events_new,
            events_updated,
        )

    except Exception as exc:
        logger.error("Failed to crawl Atlantic Station: %s", exc)
        raise

    return events_found, events_new, events_updated
