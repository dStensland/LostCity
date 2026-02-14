"""
Crawler for Georgia Department of Public Health events (dph.georgia.gov).

Primary target: Upcoming Events page.
Fallback target: Past Events page (used only when an event date resolves in the future).
"""

from __future__ import annotations

import logging
import re
from datetime import datetime
from typing import Optional
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

from db import find_event_by_hash, get_or_create_venue, insert_event
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://dph.georgia.gov"
UPCOMING_URL = f"{BASE_URL}/events"
PAST_URL = f"{BASE_URL}/past-events"

VENUE_DATA = {
    "name": "Georgia Department of Public Health",
    "slug": "georgia-dph",
    "address": "2 Peachtree St NW",
    "neighborhood": "Downtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30303",
    "lat": 33.7529,
    "lng": -84.3915,
    "venue_type": "organization",
    "spot_type": "organization",
    "website": BASE_URL,
    "vibes": ["all-ages", "family-friendly"],
}

HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; LostCity/1.0; +https://lostcity.example)"
}


def _fetch(url: str) -> Optional[str]:
    try:
        response = requests.get(url, headers=HEADERS, timeout=30)
        response.raise_for_status()
        return response.text
    except Exception as exc:
        logger.error(f"Failed fetching {url}: {exc}")
        return None


def _parse_time(raw: str) -> Optional[str]:
    text = (raw or "").strip().lower()
    if not text:
        return None
    text = text.replace("a.m.", "am").replace("p.m.", "pm")
    text = re.sub(r"\s+", " ", text)
    for fmt in ("%I:%M %p", "%I %p"):
        try:
            dt = datetime.strptime(text.upper(), fmt)
            return dt.strftime("%H:%M")
        except ValueError:
            continue
    return None


def _parse_start_date(date_text: str, event_url: str) -> Optional[str]:
    date_text = re.sub(r"\s+", " ", (date_text or "").strip())

    slug_match = re.search(r"/events/(\d{4})-(\d{2})-(\d{2})/", event_url)
    if slug_match:
        year, month, day = slug_match.groups()
        try:
            return datetime(int(year), int(month), int(day)).strftime("%Y-%m-%d")
        except ValueError:
            pass

    if not date_text:
        return None

    # Some cards use "March 15" without year.
    for fmt in ("%B %d, %Y", "%b %d, %Y", "%B %d", "%b %d"):
        try:
            parsed = datetime.strptime(date_text, fmt)
            year = parsed.year if "%Y" in fmt else datetime.now().year
            result = datetime(year, parsed.month, parsed.day)
            return result.strftime("%Y-%m-%d")
        except ValueError:
            continue

    return None


def _category_and_tags(title: str, description: str) -> tuple[str, list[str]]:
    text = f"{title} {description}".lower()
    tags = ["public-health", "georgia-dph", "government"]

    if any(keyword in text for keyword in ("workshop", "training", "office hours", "course")):
        tags.append("class")
        return "learning", tags

    if any(keyword in text for keyword in ("vaccine", "screening", "immunization", "wellness", "health")):
        tags.append("wellness")
        return "wellness", tags

    return "community", tags


def _extract_description(detail_html: str) -> str:
    soup = BeautifulSoup(detail_html, "html.parser")
    meta_description = soup.find("meta", attrs={"name": "description"})
    if meta_description and meta_description.get("content"):
        content = meta_description["content"].strip()
        if content:
            return content[:500]

    paragraph = soup.select_one("main p, .layout-content p, .page__content p")
    if paragraph:
        text = re.sub(r"\s+", " ", paragraph.get_text(" ", strip=True)).strip()
        if text:
            return text[:500]

    return "Public health event from the Georgia Department of Public Health."


def _extract_cards(page_html: str) -> list[dict]:
    soup = BeautifulSoup(page_html, "html.parser")
    cards = soup.select("a.global-teaser")
    parsed_cards: list[dict] = []

    for card in cards:
        href = card.get("href")
        title_el = card.select_one(".global-teaser__title")
        date_el = card.select_one(".event-teaser__date")
        time_el = card.select_one(".event-teaser__time")

        title = re.sub(r"\s+", " ", title_el.get_text(" ", strip=True) if title_el else "").strip()
        if not href or not title:
            continue

        parsed_cards.append(
            {
                "url": urljoin(BASE_URL, href),
                "title": title,
                "date_text": re.sub(r"\s+", " ", date_el.get_text(" ", strip=True) if date_el else "").strip(),
                "time_text": re.sub(r"\s+", " ", time_el.get_text(" ", strip=True) if time_el else "").strip(),
            }
        )
    return parsed_cards


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Georgia DPH event listings."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0
    seen_hashes: set[str] = set()

    venue_id = get_or_create_venue(VENUE_DATA)

    upcoming_html = _fetch(UPCOMING_URL)
    cards = _extract_cards(upcoming_html) if upcoming_html else []

    # Fallback: if no upcoming cards on the live page, inspect past listings
    # and keep only entries that still resolve to future dates.
    if not cards:
        past_html = _fetch(PAST_URL)
        if past_html:
            cards = _extract_cards(past_html)

    today = datetime.now().date()
    for card in cards:
        try:
            start_date = _parse_start_date(card["date_text"], card["url"])
            if not start_date:
                continue

            start_date_obj = datetime.strptime(start_date, "%Y-%m-%d").date()
            if start_date_obj < today:
                continue

            start_time = _parse_time(card["time_text"])
            content_hash = generate_content_hash(card["title"], VENUE_DATA["name"], start_date)
            if content_hash in seen_hashes:
                continue
            seen_hashes.add(content_hash)

            events_found += 1
            if find_event_by_hash(content_hash):
                events_updated += 1
                continue

            detail_html = _fetch(card["url"]) or ""
            description = _extract_description(detail_html)
            category, tags = _category_and_tags(card["title"], description)
            is_free = True

            event_record = {
                "source_id": source_id,
                "venue_id": venue_id,
                "title": card["title"],
                "description": description,
                "start_date": start_date,
                "start_time": start_time,
                "end_date": start_date,
                "end_time": None,
                "is_all_day": False,
                "category": category,
                "tags": tags,
                "price_min": 0 if is_free else None,
                "price_max": 0 if is_free else None,
                "price_note": "Free" if is_free else None,
                "is_free": is_free,
                "source_url": card["url"],
                "ticket_url": card["url"],
                "image_url": None,
                "raw_text": f"{card['date_text']} {card['time_text']}".strip(),
                "extraction_confidence": 0.9,
                "is_recurring": False,
                "recurrence_rule": None,
                "content_hash": content_hash,
            }
            insert_event(event_record)
            events_new += 1
        except Exception as exc:
            logger.error(f"Failed processing Georgia DPH card {card.get('url')}: {exc}")

    logger.info(
        "Georgia DPH crawl complete: %s found, %s new, %s updated",
        events_found,
        events_new,
        events_updated,
    )
    return events_found, events_new, events_updated
