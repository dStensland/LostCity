"""
Crawler for Common Cause Georgia events.

Source: https://www.commoncause.org/georgia/events/
Platform: WordPress event landing pages with stable detail URLs.

Common Cause Georgia runs civic engagement and democracy participation events such as:
- Democracy Squad calls
- advocacy days
- election board meeting turnout
- voter education and accountability events

These are high-value civic action events for HelpATL's participation layer.
"""

from __future__ import annotations

import logging
import re
from datetime import datetime
from typing import Optional

import requests
from bs4 import BeautifulSoup

from db import (
    find_event_by_hash,
    get_or_create_place,
    insert_event,
    smart_update_existing_event,
)
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://www.commoncause.org"
EVENTS_URL = f"{BASE_URL}/georgia/events/"

PLACE_DATA = {
    "name": "Common Cause Georgia",
    "slug": "common-cause-georgia",
    "address": "Atlanta, GA",
    "neighborhood": "Citywide",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30303",
    "lat": 33.7490,
    "lng": -84.3880,
    "place_type": "organization",
    "spot_type": "organization",
    "website": "https://www.commoncause.org/georgia/",
}

BASE_TAGS = ["civic", "advocacy", "democracy", "attend"]

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/122.0.0.0 Safari/537.36"
    )
}

EVENT_LINK_RE = re.compile(r"^https://www\.commoncause\.org/georgia/events/[^/]+/?$")

TAG_RULES: list[tuple[str, list[str]]] = [
    (r"democracy squad", ["community", "training"]),
    (r"election board|state election board", ["election", "public-meeting", "public-comment"]),
    (r"democracy day|advocacy day|capitol", ["government", "advocacy"]),
    (r"vote|voting|ballot", ["election"]),
]


def _fetch(url: str) -> Optional[str]:
    try:
        response = requests.get(url, headers=HEADERS, timeout=30)
        response.raise_for_status()
        return response.text
    except requests.RequestException as exc:
        logger.error("Common Cause Georgia: failed to fetch %s: %s", url, exc)
        return None


def _event_links(list_html: str) -> list[str]:
    soup = BeautifulSoup(list_html, "lxml")
    links: list[str] = []
    for anchor in soup.find_all("a", href=True):
        href = anchor["href"].strip()
        if not EVENT_LINK_RE.match(href.rstrip("/") + "/"):
            continue
        if href.rstrip("/") == EVENTS_URL.rstrip("/"):
            continue
        if href not in links:
            links.append(href)
    return links


def _clean_text(value: str | None) -> str:
    if not value:
        return ""
    return re.sub(r"\s+", " ", value).strip()


def _parse_time_block(text: str) -> tuple[Optional[str], Optional[str]]:
    match = re.search(
        r"(\d{1,2}):(\d{2})\s*(am|pm)\s*[–-]\s*(\d{1,2}):(\d{2})\s*(am|pm)",
        text,
        re.IGNORECASE,
    )
    if not match:
        single = re.search(r"(\d{1,2}):(\d{2})\s*(am|pm)", text, re.IGNORECASE)
        if not single:
            return None, None
        return _to_24h(single.group(1), single.group(2), single.group(3)), None

    start = _to_24h(match.group(1), match.group(2), match.group(3))
    end = _to_24h(match.group(4), match.group(5), match.group(6))
    return start, end


def _to_24h(hour_text: str, minute_text: str, period_text: str) -> str:
    hour = int(hour_text)
    period = period_text.lower()
    if period == "pm" and hour != 12:
        hour += 12
    elif period == "am" and hour == 12:
        hour = 0
    return f"{hour:02d}:{minute_text}"


def _enrich_tags(title: str, description: str) -> list[str]:
    text = f"{title} {description}".lower()
    tags: list[str] = []
    for pattern, extra in TAG_RULES:
        if re.search(pattern, text):
            tags.extend(extra)
    return list(dict.fromkeys(tags))


def _extract_event(detail_html: str, detail_url: str) -> Optional[dict]:
    soup = BeautifulSoup(detail_html, "lxml")

    title = ""
    title_el = soup.find("h1")
    if title_el:
      title = _clean_text(title_el.get_text(" ", strip=True))
    if not title:
        meta_title = soup.find("meta", property="og:title")
        if meta_title and meta_title.get("content"):
            title = _clean_text(str(meta_title["content"]).replace(" - Common Cause Georgia", ""))
    if not title:
        return None

    date_el = soup.find("time", attrs={"datetime": True})
    if not date_el:
        return None

    try:
        event_date = datetime.strptime(date_el["datetime"], "%Y-%m-%d").date()
    except ValueError:
        return None

    if event_date < datetime.now().date():
        return None

    body_text = _clean_text(soup.get_text(" ", strip=True))
    start_time, end_time = _parse_time_block(body_text)

    description_parts: list[str] = []
    meta_desc = soup.find("meta", attrs={"name": "description"})
    if meta_desc and meta_desc.get("content"):
        description_parts.append(_clean_text(str(meta_desc["content"])))

    paragraphs = []
    for paragraph in soup.find_all("p"):
        text = _clean_text(paragraph.get_text(" ", strip=True))
        if len(text) < 40:
            continue
        if text in paragraphs:
            continue
        paragraphs.append(text)
        if len(paragraphs) == 2:
            break

    description_parts.extend(paragraphs)
    description = _clean_text(" ".join(description_parts))[:1200]

    location_summary = None
    if re.search(r"\bonline\b|\bzoom\b", body_text, re.IGNORECASE):
        location_summary = "Online"
    elif re.search(r"\bin person\b", body_text, re.IGNORECASE):
        location_summary = "In person"

    ticket_url = None
    for anchor in soup.find_all("a", href=True):
        href = anchor["href"].strip()
        label = _clean_text(anchor.get_text(" ", strip=True)).lower()
        combined = f"{label} {href}".lower()
        if any(token in combined for token in ["register", "sign up", "signup", "mobilize", "eventbrite", "rsvp"]):
            ticket_url = href
            break

    image_url = None
    og_image = soup.find("meta", property="og:image")
    if og_image and og_image.get("content"):
        image_url = _clean_text(str(og_image["content"])) or None

    tags = list(dict.fromkeys(BASE_TAGS + _enrich_tags(title, description)))

    return {
        "title": title,
        "start_date": event_date.strftime("%Y-%m-%d"),
        "start_time": start_time,
        "end_time": end_time,
        "description": description or f"{title} — Common Cause Georgia civic participation event.",
        "location_summary": location_summary,
        "ticket_url": ticket_url,
        "image_url": image_url,
        "tags": tags,
    }


def crawl(source: dict) -> tuple[int, int, int]:
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    venue_id = get_or_create_place(PLACE_DATA)

    list_html = _fetch(EVENTS_URL)
    if not list_html:
        return 0, 0, 0

    detail_links = _event_links(list_html)
    if not detail_links:
        logger.warning("Common Cause Georgia: no detail links found")
        return 0, 0, 0

    logger.info("Common Cause Georgia: found %d detail links", len(detail_links))

    seen: set[str] = set()
    for detail_url in detail_links:
        detail_html = _fetch(detail_url)
        if not detail_html:
            continue

        parsed = _extract_event(detail_html, detail_url)
        if not parsed:
            continue

        dedupe_key = f"{parsed['title'].lower()}|{parsed['start_date']}"
        if dedupe_key in seen:
            continue
        seen.add(dedupe_key)
        events_found += 1

        description = parsed["description"]
        if parsed["location_summary"] and parsed["location_summary"] not in description:
            description = f"{description}\n\nLocation: {parsed['location_summary']}"

        content_hash = generate_content_hash(
            parsed["title"],
            PLACE_DATA["name"],
            parsed["start_date"],
        )

        event_record = {
            "source_id": source_id,
            "place_id": venue_id,
            "title": parsed["title"],
            "description": description,
            "start_date": parsed["start_date"],
            "start_time": parsed["start_time"],
            "end_date": parsed["start_date"],
            "end_time": parsed["end_time"],
            "is_all_day": parsed["start_time"] is None,
            "category": "community",
            "subcategory": "civic_engagement",
            "tags": parsed["tags"],
            "price_min": None,
            "price_max": None,
            "price_note": None,
            "is_free": True,
            "source_url": detail_url,
            "ticket_url": parsed["ticket_url"] or detail_url,
            "image_url": parsed["image_url"],
            "raw_text": detail_html[:5000],
            "extraction_confidence": 0.84,
            "is_recurring": "democracy squad" in parsed["title"].lower(),
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
        except Exception as exc:
            logger.error(
                "Common Cause Georgia: failed to insert %r on %s: %s",
                parsed["title"],
                parsed["start_date"],
                exc,
            )

    logger.info(
        "Common Cause Georgia: crawl complete: %d found, %d new, %d updated",
        events_found,
        events_new,
        events_updated,
    )
    return events_found, events_new, events_updated
