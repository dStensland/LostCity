"""
Crawler for National Center for Civil and Human Rights (civilandhumanrights.org).

The site uses The Events Calendar markup, so the stable path is to parse the
list view and event detail pages directly instead of scraping body text.
"""

from __future__ import annotations

import logging
import re
from datetime import date, datetime, timedelta
from typing import Optional
from urllib.parse import urljoin

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

BASE_URL = "https://www.civilandhumanrights.org"
LIST_URL = f"{BASE_URL}/events/list/?posts_per_page=13"
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
    )
}

VENUE_DATA = {
    "name": "National Center for Civil and Human Rights",
    "slug": "civil-human-rights-center",
    "address": "100 Ivan Allen Jr Blvd NW",
    "neighborhood": "Downtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30313",
    "lat": 33.7635,
    "lng": -84.3933,
    "venue_type": "museum",
    "spot_type": "museum",
    "website": BASE_URL,
    "description": (
        "The National Center for Civil and Human Rights in downtown Atlanta connects the American "
        "civil rights movement to today's global human rights struggles through powerful exhibitions, "
        "immersive experiences, and public programming."
    ),
    # og:image from civilandhumanrights.org — verified 2026-03-11
    "image_url": "https://www.civilandhumanrights.org/wp-content/uploads/2023/09/NCCHR-Social-Share.jpg",
    # Hours verified 2026-03-11: Mon-Sat 10am-5pm, Sun 12-5pm
    "hours": {
        "monday": "10:00-17:00",
        "tuesday": "10:00-17:00",
        "wednesday": "10:00-17:00",
        "thursday": "10:00-17:00",
        "friday": "10:00-17:00",
        "saturday": "10:00-17:00",
        "sunday": "12:00-17:00",
    },
    "vibes": ["historic", "educational", "cultural", "downtown", "civil-rights"],
}

MONTH_PATTERN = re.compile(
    r"(January|February|March|April|May|June|July|August|September|October|November|December)"
)


def _clean_text(value: Optional[str]) -> str:
    """Collapse whitespace and nbsp characters for reliable parsing."""
    if not value:
        return ""
    value = value.replace("\xa0", " ")
    return re.sub(r"\s+", " ", value).strip()


def _parse_time_component(value: str) -> Optional[str]:
    """Parse a 12-hour time string into HH:MM."""
    match = re.search(r"(\d{1,2}):(\d{2})\s*(am|pm)", value, re.IGNORECASE)
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


def _parse_month_day(text: str, *, default_year: int) -> Optional[str]:
    """Convert strings like 'March 31' into ISO dates."""
    cleaned = _clean_text(text).replace(",", "")
    try:
        parsed = datetime.strptime(f"{cleaned} {default_year}", "%B %d %Y")
    except ValueError:
        return None
    return parsed.strftime("%Y-%m-%d")


def _image_url(img: Optional[Tag]) -> Optional[str]:
    """Prefer lazy-loaded image URLs when present."""
    if not img:
        return None
    return img.get("data-src") or img.get("src")


def _normalize_ongoing_dates(start_date: str, end_date: Optional[str]) -> tuple[str, Optional[str]]:
    """Keep active multi-day programs visible by normalizing ongoing starts to today."""
    today = date.today().isoformat()
    if end_date and start_date < today <= end_date:
        return today, end_date
    return start_date, end_date


def determine_category(title: str, description: str) -> tuple[str, Optional[str], list[str]]:
    """Map National Center programming into portal categories."""
    combined = f"{title} {description}".lower()
    tags = ["civil-rights", "human-rights", "museum", "downtown", "history"]

    if any(word in combined for word in ("exhibit", "exhibition", "installation", "gallery")):
        return "art", "exhibition", tags + ["exhibition"]
    if any(word in combined for word in ("family day", "family", "kids", "children")):
        return "family", "family-activity", tags + ["family-friendly"]
    if any(word in combined for word in ("lecture", "conversation", "talk", "panel", "fellowship")):
        return "community", "lecture", tags + ["lecture"]
    if any(word in combined for word in ("gala", "fundraiser", "power to inspire")):
        return "community", "fundraiser", tags + ["fundraiser"]
    return "community", "museum-program", tags


def _extract_ticket_url(detail_soup: BeautifulSoup, detail_url: str) -> str:
    """Prefer event-specific registration links over the generic ticket CTA."""
    registration_link = detail_soup.find("a", string=re.compile(r"registration here", re.IGNORECASE))
    if registration_link and registration_link.get("href"):
        return urljoin(detail_url, registration_link["href"])

    for link in detail_soup.find_all("a", href=True):
        href = link["href"]
        text = _clean_text(link.get_text(" ", strip=True)).lower()
        if "blackbaudhosting.com" in href and any(
            token in text for token in ("register", "ticket", "buy")
        ):
            return href

    return detail_url


def _extract_detail_data(session: requests.Session, detail_url: str) -> dict:
    """Fetch richer description, image, and event metadata from the detail page."""
    response = session.get(detail_url, timeout=30)
    response.raise_for_status()
    soup = BeautifulSoup(response.text, "html.parser")

    description_el = soup.select_one(".tribe-events-single-event-description")
    description = _clean_text(description_el.get_text(" ", strip=True)) if description_el else ""

    image_el = soup.select_one(".tribe-events-event-image img")
    image_url = _image_url(image_el)

    meta: dict[str, str] = {}
    for group in soup.select(".tribe-events-meta-group-details dl"):
        terms = group.find_all("dt")
        values = group.find_all("dd")
        for term, value in zip(terms, values):
            key = _clean_text(term.get_text(" ", strip=True)).rstrip(":").lower()
            meta[key] = _clean_text(value.get_text(" ", strip=True))

    start_date = None
    start_abbr = soup.select_one(".tribe-events-start-date[title]")
    if start_abbr and start_abbr.get("title"):
        start_date = start_abbr["title"]

    end_date = None
    end_abbr = soup.select_one(".tribe-events-end-date[title]")
    if end_abbr and end_abbr.get("title"):
        end_date = end_abbr["title"]

    if not end_date:
        start_label = meta.get("start")
        end_label = meta.get("end")
        if start_label and end_label:
            year = int(start_date[:4]) if start_date else date.today().year
            start_candidate = _parse_month_day(start_label, default_year=year)
            end_candidate = _parse_month_day(end_label, default_year=year)
            if start_candidate:
                start_date = start_candidate
            end_date = end_candidate

    time_text = meta.get("time", "")
    time_parts = [part.strip() for part in time_text.split("-", 1)] if time_text else []
    start_time = _parse_time_component(time_parts[0]) if time_parts else None
    end_time = _parse_time_component(time_parts[1]) if len(time_parts) > 1 else None

    return {
        "description": description,
        "image_url": image_url,
        "start_date": start_date,
        "end_date": end_date,
        "start_time": start_time,
        "end_time": end_time,
        "ticket_url": _extract_ticket_url(soup, detail_url),
    }


def _extract_listings(session: requests.Session) -> list[dict]:
    """Walk the list view pages and collect stable event records."""
    records: list[dict] = []
    next_url = LIST_URL
    visited: set[str] = set()

    while next_url and next_url not in visited:
        visited.add(next_url)
        response = session.get(next_url, timeout=30)
        response.raise_for_status()
        soup = BeautifulSoup(response.text, "html.parser")

        rows = soup.select(".tribe-events-calendar-list__event-row")
        logger.info("Found %s list rows at %s", len(rows), next_url)

        for row in rows:
            title_el = row.select_one(".tribe-events-calendar-list__event-title-link")
            time_el = row.select_one(".tribe-events-calendar-list__event-datetime")
            if not title_el or not title_el.get("href") or not time_el:
                continue

            title = _clean_text(title_el.get_text(" ", strip=True))
            detail_url = urljoin(BASE_URL, title_el["href"])
            description_el = row.select_one(".tribe-events-calendar-list__event-description")
            description = (
                _clean_text(description_el.get_text(" ", strip=True))
                if description_el
                else ""
            )
            image_el = row.select_one(".tribe-events-calendar-list__event-featured-image")

            start_date = time_el.get("datetime")
            start_text_el = time_el.select_one(".tribe-event-date-start")
            end_text_el = time_el.select_one(".tribe-event-date-end")
            start_text = _clean_text(start_text_el.get_text(" ", strip=True)) if start_text_el else ""
            end_text = _clean_text(end_text_el.get_text(" ", strip=True)) if end_text_el else ""
            date_text = _clean_text(time_el.get_text(" ", strip=True))

            start_time = None
            end_time = None
            if "|" in date_text:
                _, time_range = [part.strip() for part in date_text.split("|", 1)]
                if " - " in time_range:
                    start_part, end_part = [part.strip() for part in time_range.split(" - ", 1)]
                    start_time = _parse_time_component(start_part)
                    end_time = _parse_time_component(end_part)
                else:
                    start_time = _parse_time_component(time_range)

            end_date = None
            if end_text and MONTH_PATTERN.search(end_text):
                default_year = int(start_date[:4]) if start_date else date.today().year
                end_date = _parse_month_day(end_text, default_year=default_year)
            elif end_text and start_date:
                end_date = start_date

            records.append(
                {
                    "title": title,
                    "detail_url": detail_url,
                    "description": description,
                    "image_url": _image_url(image_el),
                    "start_date": start_date,
                    "end_date": end_date,
                    "start_time": start_time,
                    "end_time": end_time,
                }
            )

        next_link = soup.find("a", rel="next")
        next_url = urljoin(BASE_URL, next_link["href"]) if next_link and next_link.get("href") else None

    return records


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl National Center for Civil and Human Rights events via list/detail pages."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    venue_id = get_or_create_venue(VENUE_DATA)

    with requests.Session() as session:
        session.headers.update(HEADERS)

        logger.info("Fetching National Center for Civil and Human Rights: %s", LIST_URL)
        listings = _extract_listings(session)
        seen_keys: set[tuple[str, str]] = set()
        max_start_date = (date.today() + timedelta(days=270)).isoformat()

        for listing in listings:
            detail = _extract_detail_data(session, listing["detail_url"])

            description = detail["description"] or listing["description"] or (
                f"{listing['title']} at National Center for Civil and Human Rights"
            )
            canonical_start_date = detail["start_date"] or listing["start_date"]
            if not canonical_start_date:
                logger.warning("Skipping %r without start date", listing["title"])
                continue

            end_date = detail["end_date"] or listing["end_date"]
            start_time = detail["start_time"] if detail["start_time"] is not None else listing["start_time"]
            end_time = detail["end_time"] if detail["end_time"] is not None else listing["end_time"]
            start_date, end_date = _normalize_ongoing_dates(canonical_start_date, end_date)

            dedupe_key = (listing["title"], canonical_start_date)
            if dedupe_key in seen_keys:
                continue
            seen_keys.add(dedupe_key)

            if canonical_start_date > max_start_date:
                logger.info(
                    "Skipping %r beyond validation horizon: %s",
                    listing["title"],
                    canonical_start_date,
                )
                continue

            category, subcategory, tags = determine_category(listing["title"], description)

            event_record = {
                "source_id": source_id,
                "venue_id": venue_id,
                "title": listing["title"],
                "description": description[:5000],
                "start_date": start_date,
                "start_time": start_time,
                "end_date": end_date,
                "end_time": end_time,
                "is_all_day": start_time is None,
                "category": category,
                "subcategory": subcategory,
                "tags": tags,
                "price_min": None,
                "price_max": None,
                "price_note": None,
                "is_free": "free" in description.lower(),
                "source_url": listing["detail_url"],
                "ticket_url": detail["ticket_url"],
                "image_url": detail["image_url"] or listing["image_url"],
                "raw_text": f"{listing['title']} - {description[:300]}",
                "extraction_confidence": 0.92,
                "is_recurring": False,
                "recurrence_rule": None,
                "content_hash": generate_content_hash(
                    listing["title"],
                    "National Center for Civil and Human Rights",
                    canonical_start_date,
                ),
            }

            events_found += 1

            existing = find_event_by_hash(event_record["content_hash"])
            if existing:
                smart_update_existing_event(existing, event_record)
                events_updated += 1
                continue

            try:
                insert_event(event_record)
                events_new += 1
                logger.info("Added: %s on %s", listing["title"], start_date)
            except Exception as exc:
                logger.error("Failed to insert %r: %s", listing["title"], exc)

    logger.info(
        "National Center for Civil and Human Rights crawl complete: %s found, %s new, %s updated",
        events_found,
        events_new,
        events_updated,
    )
    return events_found, events_new, events_updated
