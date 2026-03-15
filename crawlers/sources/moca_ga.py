"""
Crawler for MOCA GA (mocaga.org).

MOCA no longer maintains a usable /events page. The current first-party
surfaces are the "Current & Upcoming Exhibitions" and "Upcoming Events"
sections, which currently expose sparse or empty inventory. This crawler keeps
MOCA aligned to those live surfaces instead of scraping the stale legacy page.
"""

from __future__ import annotations

import logging
import re
from datetime import date, datetime
from typing import Optional
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

from db import find_event_by_hash, get_or_create_venue, insert_event, smart_update_existing_event, insert_exhibition
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://www.mocaga.org"
EXHIBITIONS_URL = f"{BASE_URL}/exhibitions-events/current-upcoming-exhibitions/"
SPECIAL_EVENTS_URL = f"{BASE_URL}/exhibitions-events/special-events/"
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
    )
}

VENUE_DATA = {
    "name": "MOCA GA",
    "slug": "moca-ga",
    "address": "75 Bennett St NW",
    "neighborhood": "West Midtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30309",
    "lat": 33.7920,
    "lng": -84.4078,
    "venue_type": "museum",
    "spot_type": "museum",
    "website": BASE_URL,
    # Description populated dynamically at crawl time from og:description.
    # Fallback for offline/test runs:
    "description": (
        "The Museum of Contemporary Art of Georgia (MOCA GA) is a free contemporary art museum "
        "in West Midtown dedicated to collecting and exhibiting work by Georgia artists, "
        "with rotating exhibitions of painting, sculpture, photography, and mixed media."
    ),
    # Hours verified 2026-03-11 from mocaga.org/visit
    "hours": {
        "monday": "closed",
        "tuesday": "10:00-17:00",
        "wednesday": "10:00-17:00",
        "thursday": "10:00-20:00",
        "friday": "10:00-17:00",
        "saturday": "10:00-17:00",
        "sunday": "12:00-17:00",
    },
    "vibes": ["free", "contemporary-art", "cultural", "buckhead"],
}


def _clean_text(value: Optional[str]) -> str:
    if not value:
        return ""
    value = value.replace("\xa0", " ")
    if any(token in value for token in ("â", "Â", "Ã")):
        try:
            value = value.encode("latin1", errors="ignore").decode("utf-8", errors="ignore")
        except Exception:
            pass
    return re.sub(r"\s+", " ", value).strip()


def _parse_time_component(value: str) -> Optional[str]:
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


def _parse_schedule_text(value: str) -> tuple[Optional[str], Optional[str], Optional[str]]:
    cleaned = _clean_text(value).replace("–", "-").replace("—", "-")
    match = re.search(
        r"([A-Za-z]{3,9}\.?\s+\d{1,2},\s+\d{4})\s+(\d{1,2}:\d{2}\s*[ap]m)\s*-\s*(\d{1,2}:\d{2}\s*[ap]m)",
        cleaned,
        re.IGNORECASE,
    )
    if not match:
        return None, None, None

    date_text, start_raw, end_raw = match.groups()
    parsed_date = _parse_date_text(date_text)
    if not parsed_date:
        return None, None, None

    return parsed_date, _parse_time_component(start_raw), _parse_time_component(end_raw)


def _parse_date_text(value: str) -> Optional[str]:
    cleaned = _clean_text(value).replace(".", "")
    for fmt in ("%B %d, %Y", "%b %d, %Y"):
        try:
            return datetime.strptime(cleaned, fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue
    return None


def _parse_exhibition_date_range(value: str) -> tuple[Optional[str], Optional[str]]:
    cleaned = _clean_text(value).replace("–", "-").replace("—", "-").replace(".", "")
    match = re.search(
        r"([A-Za-z]{3,9}\s+\d{1,2},\s+\d{4})\s*-\s*([A-Za-z]{3,9}\s+\d{1,2},\s+\d{4})",
        cleaned,
    )
    if not match:
        return None, None

    start_raw, end_raw = match.groups()
    start_date = _parse_date_text(start_raw)
    end_date = _parse_date_text(end_raw)
    return start_date, end_date


def _normalize_ongoing_exhibit_dates(start_date: str, end_date: Optional[str]) -> tuple[str, Optional[str]]:
    if not start_date or not end_date:
        return start_date, end_date

    today = date.today().isoformat()
    if start_date < today <= end_date:
        return today, end_date
    return start_date, end_date


def _extract_detail_record(session: requests.Session, detail_url: str) -> Optional[dict]:
    response = session.get(detail_url, timeout=30)
    response.raise_for_status()
    soup = BeautifulSoup(response.text, "html.parser")
    page_text = _clean_text(soup.get_text(" ", strip=True))

    schedule_el = soup.select_one(".tribe-events-schedule")
    title_el = soup.select_one(".tribe-events-single-event-title, .entry-title")
    image_el = soup.select_one(".tribe-events-event-image img, .entry-content img")

    title = _clean_text(title_el.get_text(" ", strip=True)) if title_el else ""
    start_date, start_time, end_time = _parse_schedule_text(
        schedule_el.get_text(" ", strip=True) if schedule_el else ""
    )
    if not title or not start_date:
        return None

    description_parts: list[str] = []
    for paragraph in soup.select(".tribe-events-single-event-description p, .entry-content p"):
        text = _clean_text(paragraph.get_text(" ", strip=True))
        if len(text) >= 40:
            description_parts.append(text)
    description = " ".join(description_parts[:4])[:1000] if description_parts else f"Event at {VENUE_DATA['name']}."

    location_note = None
    meta_group = soup.select_one(".tribe-events-event-meta")
    if meta_group:
        meta_text = _clean_text(meta_group.get_text(" ", strip=True))
        location_match = re.search(r"Location\s+(.+?)\s+United States", meta_text, re.IGNORECASE)
        if location_match:
            location_note = _clean_text(location_match.group(1))
            if location_note and location_note.lower() not in description.lower():
                description = f"{description} Offsite location: {location_note}."

    ticket_url = detail_url
    for link in soup.find_all("a", href=True):
        href = link["href"]
        text = _clean_text(link.get_text(" ", strip=True)).lower()
        if "eventbrite.com" in href or any(token in text for token in ("rsvp", "ticket", "register")):
            ticket_url = urljoin(detail_url, href)
            break

    return {
        "title": title,
        "description": description,
        "start_date": start_date,
        "end_date": start_date,
        "start_time": start_time,
        "end_time": end_time,
        "is_all_day": False,
        "content_kind": "event",
        "category": "art",
        "subcategory": "museum-event",
        "tags": ["art", "museum", "moca-ga", "west-midtown", "contemporary-art"],
        "source_url": detail_url,
        "ticket_url": ticket_url,
        "image_url": urljoin(detail_url, image_el.get("src")) if image_el and image_el.get("src") else None,
        "raw_text": page_text[:4000],
        "extraction_confidence": 0.92,
        "is_free": "free and open to the public" in page_text.lower(),
        "price_note": "Free and open to the public" if "free and open to the public" in page_text.lower() else None,
    }


def _extract_special_event_records(session: requests.Session) -> list[dict]:
    response = session.get(SPECIAL_EVENTS_URL, timeout=30)
    response.raise_for_status()
    soup = BeautifulSoup(response.text, "html.parser")
    page_text = _clean_text(soup.get_text(" ", strip=True))

    if "No Current or Upcoming Events" in page_text:
        logger.info("MOCA GA special events page currently reports no upcoming inventory.")
        return []

    records: list[dict] = []
    detail_urls: list[str] = []
    for anchor in soup.find_all("a", href=True):
        href = urljoin(SPECIAL_EVENTS_URL, anchor["href"])
        if re.search(r"/calendar/[^/]+/?$", href) and href not in detail_urls:
            detail_urls.append(href)

    for detail_url in detail_urls:
        record = _extract_detail_record(session, detail_url)
        if record:
            records.append(record)

    return records


def _extract_exhibition_records(session: requests.Session) -> list[dict]:
    response = session.get(EXHIBITIONS_URL, timeout=30)
    response.raise_for_status()
    soup = BeautifulSoup(response.text, "html.parser")

    records: list[dict] = []
    for block in soup.select(".image-content-container"):
        content = block.select_one(".image-content")
        if not content:
            continue

        title_el = content.find("h3")
        if not title_el:
            continue

        strong_parts = [
            _clean_text(strong.get_text(" ", strip=True))
            for strong in title_el.find_all("strong")
            if _clean_text(strong.get_text(" ", strip=True))
        ]
        title = strong_parts[0] if strong_parts else _clean_text(title_el.get_text(" ", strip=True))
        date_text = next((part for part in strong_parts[1:] if re.search(r"\d{4}", part)), "")
        start_date_raw, end_date = _parse_exhibition_date_range(date_text)
        if not start_date_raw or not end_date:
            continue

        detail_url = None
        detail_link = content.find("a", href=re.compile(r"exhibitions/.+\.html$"))
        if detail_link and detail_link.get("href"):
            detail_url = urljoin(EXHIBITIONS_URL, detail_link["href"])

        description = None
        for paragraph in content.find_all("p"):
            text = _clean_text(paragraph.get_text(" ", strip=True))
            if len(text) >= 40:
                description = text[:1000]
                break

        image_url = None
        image_container = block.select_one(".image-container[style]")
        if image_container:
            style = image_container.get("style", "")
            image_match = re.search(r"url\(([^)]+)\)", style)
            if image_match:
                image_url = urljoin(EXHIBITIONS_URL, image_match.group(1).strip("'\""))

        start_date, normalized_end_date = _normalize_ongoing_exhibit_dates(start_date_raw, end_date)
        records.append(
            {
                "title": title,
                "description": description or f"Exhibition at {VENUE_DATA['name']}.",
                "start_date": start_date,
                "hash_start_date": start_date_raw,
                "end_date": normalized_end_date,
                "start_time": None,
                "end_time": None,
                "is_all_day": True,
                "content_kind": "exhibit",
                "category": "art",
                "subcategory": "exhibition",
                "tags": ["art", "museum", "moca-ga", "west-midtown", "exhibition"],
                "source_url": detail_url or EXHIBITIONS_URL,
                "ticket_url": detail_url or EXHIBITIONS_URL,
                "image_url": image_url,
                "raw_text": _clean_text(content.get_text(" ", strip=True)),
                "extraction_confidence": 0.86,
                "is_free": True,
                "price_note": "Included with museum admission" if detail_url else None,
            }
        )

    return records


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl MOCA GA special events and current exhibitions from live site surfaces."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        session = requests.Session()
        session.headers.update(HEADERS)

        # ----------------------------------------------------------------
        # 0. Homepage — extract og:image / og:description for venue record
        # ----------------------------------------------------------------
        try:
            home_resp = session.get(BASE_URL, timeout=20)
            if home_resp.status_code == 200:
                home_soup = BeautifulSoup(home_resp.text, "html.parser")
                og_img = home_soup.find("meta", property="og:image")
                og_desc = home_soup.find("meta", property="og:description") or home_soup.find("meta", attrs={"name": "description"})
                if og_img and og_img.get("content"):
                    VENUE_DATA["image_url"] = og_img["content"]
                    logger.debug("MOCA GA: og:image = %s", og_img["content"])
                if og_desc and og_desc.get("content"):
                    VENUE_DATA["description"] = og_desc["content"]
                    logger.debug("MOCA GA: og:description captured")
        except Exception as _meta_exc:
            logger.debug("MOCA GA: could not extract og meta from homepage: %s", _meta_exc)

        venue_id = get_or_create_venue(VENUE_DATA)
        records = _extract_special_event_records(session) + _extract_exhibition_records(session)

        today = date.today().isoformat()
        for record in records:
            end_date = record.get("end_date") or record.get("start_date")
            if not end_date or end_date < today:
                continue

            events_found += 1
            hash_start_date = record.pop("hash_start_date", None) or record["start_date"]
            content_hash = generate_content_hash(record["title"], VENUE_DATA["name"], hash_start_date)

            event_record = {
                "source_id": source_id,
                "venue_id": venue_id,
                "title": record["title"],
                "description": record["description"],
                "start_date": record["start_date"],
                "start_time": record["start_time"],
                "end_date": record["end_date"],
                "end_time": record["end_time"],
                "is_all_day": record["is_all_day"],
                "content_kind": record["content_kind"],
                "category": record["category"],
                "subcategory": record["subcategory"],
                "tags": record["tags"],
                "price_min": None,
                "price_max": None,
                "price_note": record["price_note"],
                "is_free": record["is_free"],
                "source_url": record["source_url"],
                "ticket_url": record["ticket_url"],
                "image_url": record["image_url"],
                "raw_text": record["raw_text"],
                "extraction_confidence": record["extraction_confidence"],
                "is_recurring": False,
                "recurrence_rule": None,
                "content_hash": content_hash,
            }

            existing = find_event_by_hash(content_hash)
            if existing:
                smart_update_existing_event(existing, event_record)
                events_updated += 1
                if record.get("content_kind") == "exhibit":
                    try:
                        exhibition_record = {
                            "title": record["title"],
                            "venue_id": venue_id,
                            "source_id": source_id,
                            "_venue_name": VENUE_DATA["name"],
                            "opening_date": hash_start_date,
                            "closing_date": record["end_date"],
                            "description": record["description"],
                            "image_url": record["image_url"],
                            "source_url": record["source_url"],
                            "admission_type": "free" if record.get("is_free") else "ticketed",
                            "tags": ["museum", "moca-ga", "west-midtown", "exhibition", "contemporary-art"],
                            "is_active": True,
                        }
                        insert_exhibition(exhibition_record)
                    except Exception as exc:
                        logger.debug("Exhibition insert failed for %r: %s", record["title"], exc)
                continue

            insert_event(event_record)
            events_new += 1
            if record.get("content_kind") == "exhibit":
                try:
                    exhibition_record = {
                        "title": record["title"],
                        "venue_id": venue_id,
                        "source_id": source_id,
                        "_venue_name": VENUE_DATA["name"],
                        "opening_date": hash_start_date,
                        "closing_date": record["end_date"],
                        "description": record["description"],
                        "image_url": record["image_url"],
                        "source_url": record["source_url"],
                        "admission_type": "free" if record.get("is_free") else "ticketed",
                        "tags": ["museum", "moca-ga", "west-midtown", "exhibition", "contemporary-art"],
                        "is_active": True,
                    }
                    insert_exhibition(exhibition_record)
                except Exception as exc:
                    logger.debug("Exhibition insert failed for %r: %s", record["title"], exc)

        logger.info(
            "MOCA GA crawl complete: %s found, %s new, %s updated",
            events_found,
            events_new,
            events_updated,
        )

    except Exception as exc:
        logger.error("Failed to crawl MOCA GA: %s", exc, exc_info=True)
        raise

    return events_found, events_new, events_updated
