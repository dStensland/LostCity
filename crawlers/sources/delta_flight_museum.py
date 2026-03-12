"""
Crawler for Delta Flight Museum upcoming events.

The museum exposes a stable HTML listing page with detail pages containing
plain-text event metadata, making this a low-cost requests crawler.
"""

from __future__ import annotations

import logging
import re
from datetime import datetime
from typing import Optional
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

from db import find_event_by_hash, get_client, get_or_create_venue, insert_event, smart_update_existing_event
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://www.deltamuseum.org"
LIST_URL = f"{BASE_URL}/visit/whats-on/upcoming-events"

VENUE_DATA = {
    "name": "Delta Flight Museum",
    "slug": "delta-flight-museum",
    "address": "1060 Delta Blvd",
    "neighborhood": "Hapeville",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30354",
    "lat": 33.6479,
    "lng": -84.4284,
    "venue_type": "museum",
    "spot_type": "museum",
    "website": BASE_URL,
    # Admission: $15 adult, $12 child (ages 4-17) / senior, free under 4
    # Hours verified 2026-03-11 against deltamuseum.org
    "hours": {
        "sunday": "12:00-16:30",
        "monday": "closed",
        "tuesday": "10:00-16:30",
        "wednesday": "10:00-16:30",
        "thursday": "10:00-16:30",
        "friday": "10:00-16:30",
        "saturday": "10:00-16:30",
    },
    "vibes": [
        "educational",
        "family-friendly",
        "interactive",
        "aviation",
        "historic",
    ],
}

def _extract_og_meta(html: str) -> tuple[Optional[str], Optional[str]]:
    """Return (og:image, og:description) from page HTML."""
    soup = BeautifulSoup(html, "lxml")

    og_image: Optional[str] = None
    tag = soup.find("meta", property="og:image")
    if tag and tag.get("content"):  # type: ignore[union-attr]
        og_image = str(tag["content"])  # type: ignore[index]

    og_desc: Optional[str] = None
    for attr_dict in ({"property": "og:description"}, {"name": "description"}):
        tag = soup.find("meta", attrs=attr_dict)
        if tag and tag.get("content"):  # type: ignore[union-attr]
            og_desc = str(tag["content"])[:500]  # type: ignore[index]
            break

    return og_image, og_desc


DATE_TIME_RE = re.compile(
    r"(\d{1,2}\s+[A-Za-z]+,\s+\d{4}),\s+(\d{1,2}(?::\d{2})?\s*[AP]M)(?:-(\d{1,2}(?::\d{2})?\s*[AP]M))?",
    re.IGNORECASE,
)


def _parse_time(value: str) -> Optional[str]:
    for fmt in ("%I %p", "%I:%M %p"):
        try:
            return datetime.strptime(value.upper().strip(), fmt).strftime("%H:%M")
        except ValueError:
            continue
    return None


def _extract_event_links(html: str) -> list[str]:
    soup = BeautifulSoup(html, "lxml")
    urls: list[str] = []
    for anchor in soup.select('a[href*="/visit/whats-on/upcoming-events/"]'):
        href = anchor.get("href") or ""
        absolute = urljoin(BASE_URL, href)
        if absolute == LIST_URL:
            continue
        if absolute not in urls:
            urls.append(absolute)
    return urls


def _extract_event_record(event_url: str, venue_id: int, source_id: int) -> Optional[dict]:
    response = requests.get(event_url, timeout=20, headers={"User-Agent": "Mozilla/5.0"})
    response.raise_for_status()
    soup = BeautifulSoup(response.text, "lxml")
    text = " ".join(soup.get_text(" ", strip=True).split())

    title = (soup.title.get_text(" ", strip=True) if soup.title else "").strip()
    if not title:
        return None

    title = re.sub(r"\s*-\s*Delta Flight Museum\s*$", "", title).strip()
    title = re.sub(r"\s+Advance Ticket Purchase Recommended.*$", "", title).strip()

    date_time_match = DATE_TIME_RE.search(text)
    if not date_time_match:
        logger.warning("No date/time found for Delta Flight Museum event: %s", event_url)
        return None

    date_text, start_text, end_text = date_time_match.groups()
    start_dt = datetime.strptime(date_text, "%d %B, %Y")
    start_date = start_dt.strftime("%Y-%m-%d")
    start_time = _parse_time(start_text)
    end_time = _parse_time(end_text) if end_text else None

    if start_dt.date() < datetime.now().date():
        return None

    marker = f"{date_text}, {start_text}"
    description = ""
    marker_idx = text.find(marker)
    if marker_idx != -1:
        description = text[marker_idx + len(marker):].strip()
    if not description:
        description = title
    for stop_marker in (
        "Upcoming Events Fundraising events hosted by the museum",
        "Connect Donate Donate Financially",
    ):
        stop_idx = description.find(stop_marker)
        if stop_idx != -1:
            description = description[:stop_idx].strip()
    description = description[:4000]

    content_hash = generate_content_hash(title, VENUE_DATA["name"], start_date)
    return {
        "source_id": source_id,
        "venue_id": venue_id,
        "title": title,
        "description": description,
        "start_date": start_date,
        "start_time": start_time,
        "end_date": start_date if end_time else None,
        "end_time": end_time,
        "is_all_day": False,
        "category": "community",
        "subcategory": "museum-event",
        "tags": ["museum", "aviation", "delta-flight-museum", "hapeville"],
        "price_min": None,
        "price_max": None,
        "price_note": None,
        "is_free": False,
        "source_url": event_url,
        "ticket_url": event_url,
        "image_url": None,
        "raw_text": text[:5000],
        "extraction_confidence": 0.88,
        "is_recurring": False,
        "recurrence_rule": None,
        "content_hash": content_hash,
    }


def crawl(source: dict) -> tuple[int, int, int]:
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    venue_id = get_or_create_venue(VENUE_DATA)
    logger.info("Fetching Delta Flight Museum listing: %s", LIST_URL)

    response = requests.get(LIST_URL, timeout=20, headers={"User-Agent": "Mozilla/5.0"})
    response.raise_for_status()

    # Enrich venue with og:image and og:description from the listing/homepage on first pass
    try:
        # Prefer homepage for og: meta; the listing page may have it too
        home_resp = requests.get(BASE_URL, timeout=20, headers={"User-Agent": "Mozilla/5.0"})
        home_resp.raise_for_status()
        og_image, og_desc = _extract_og_meta(home_resp.text)
        venue_update: dict = {}
        if og_image:
            venue_update["image_url"] = og_image
        if og_desc:
            venue_update["description"] = og_desc
        if venue_update:
            get_client().table("venues").update(venue_update).eq("id", venue_id).execute()
            logger.info("Delta Flight Museum: enriched venue from homepage og: metadata")
    except Exception as enrich_exc:
        logger.warning("Delta Flight Museum: og: enrichment failed: %s", enrich_exc)

    event_links = _extract_event_links(response.text)
    logger.info("Found %s Delta Flight Museum event links", len(event_links))

    for event_url in event_links:
        try:
            event_record = _extract_event_record(event_url, venue_id=venue_id, source_id=source_id)
            if not event_record:
                continue
        except Exception as exc:
            logger.warning("Failed to parse Delta Flight Museum event %s: %s", event_url, exc)
            continue

        events_found += 1
        existing = find_event_by_hash(event_record["content_hash"])
        if existing:
            smart_update_existing_event(existing, event_record)
            events_updated += 1
            continue

        insert_event(event_record)
        events_new += 1
        logger.info("Added Delta Flight Museum event: %s", event_record["title"])

    logger.info(
        "Delta Flight Museum crawl complete: %s found, %s new, %s updated",
        events_found,
        events_new,
        events_updated,
    )
    return events_found, events_new, events_updated
