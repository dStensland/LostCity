"""
Crawler for Michael C. Carlos Museum at Emory (carlos.emory.edu).
"""

from __future__ import annotations

import re
import logging
from datetime import datetime
from typing import Optional

import requests
from bs4 import BeautifulSoup

from db import (
    get_or_create_venue,
    insert_event,
    find_event_by_hash,
    smart_update_existing_event,
)
from dedupe import generate_content_hash
from entity_lanes import SourceEntityCapabilities, TypedEntityEnvelope
from entity_persistence import persist_typed_entity_envelope
from utils import find_event_url

logger = logging.getLogger(__name__)

BASE_URL = "https://carlos.emory.edu"
EVENTS_URL = f"{BASE_URL}/events"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36"
}

SOURCE_ENTITY_CAPABILITIES = SourceEntityCapabilities(
    events=True,
    destinations=True,
    destination_details=True,
    venue_features=True,
    venue_specials=True,
)

VENUE_DATA = {
    "name": "Michael C. Carlos Museum",
    # Match the canonical production venue row instead of relying on name fallback.
    "slug": "michael-c-carlos-museum",
    "address": "571 South Kilgo Cir",
    "neighborhood": "Emory",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30322",
    "lat": 33.7904,
    "lng": -84.3253,
    "venue_type": "museum",
    "spot_type": "museum",
    "website": BASE_URL,
    # description and image_url are extracted dynamically from og: tags on the homepage
    # at crawl time — see _enrich_venue_data() called before get_or_create_venue().
    # Hours verified 2026-03-11: Tue-Fri 10am-4pm, Sat 10am-5pm, Sun 12-5pm, Mon closed
    "hours": {
        "tuesday": "10:00-16:00",
        "wednesday": "10:00-16:00",
        "thursday": "10:00-16:00",
        "friday": "10:00-16:00",
        "saturday": "10:00-17:00",
        "sunday": "12:00-17:00",
    },
    "vibes": ["free", "educational", "cultural", "art", "historic", "university"],
}


def _build_destination_envelope(venue_id: int) -> TypedEntityEnvelope:
    envelope = TypedEntityEnvelope()
    envelope.add(
        "destination_details",
        {
            "venue_id": venue_id,
            "destination_type": "art_museum",
            "commitment_tier": "hour",
            "primary_activity": "art and antiquities museum visit",
            "best_seasons": ["spring", "summer", "fall", "winter"],
            "weather_fit_tags": ["indoor", "rainy-day", "heat-day", "family-daytrip", "free-option"],
            "parking_type": "paid_lot",
            "best_time_of_day": "afternoon",
            "practical_notes": (
                "Carlos Museum works best as a compact Emory museum stop, especially for families who want a shorter culture outing instead of committing to a larger all-day museum campus."
            ),
            "accessibility_notes": (
                "Its indoor galleries and relatively contained footprint keep the visit lower-friction for strollers and shorter attention spans than larger museum outings."
            ),
            "family_suitability": "yes",
            "reservation_required": False,
            "permit_required": False,
            "fee_note": "The museum remains one of Atlanta's stronger low-cost or free-feeling family culture stops depending on current admission policy and campus access.",
            "source_url": BASE_URL,
            "metadata": {
                "source_type": "family_destination_enrichment",
                "venue_type": "art_museum",
                "city": "atlanta",
            },
        },
    )
    envelope.add(
        "venue_features",
        {
            "venue_id": venue_id,
            "slug": "free-emory-art-and-antiquities-anchor",
            "title": "Emory art and antiquities anchor",
            "feature_type": "amenity",
            "description": "Carlos Museum gives families an easier university-adjacent culture stop built around art, antiquities, and rotating exhibitions.",
            "url": BASE_URL,
            "is_free": True,
            "sort_order": 10,
        },
    )
    envelope.add(
        "venue_features",
        {
            "venue_id": venue_id,
            "slug": "compact-campus-museum-stop",
            "title": "Compact campus museum stop",
            "feature_type": "amenity",
            "description": "The museum's contained indoor layout makes it easier to fit into a shorter family outing than a larger destination museum day.",
            "url": BASE_URL,
            "is_free": True,
            "sort_order": 20,
        },
    )
    envelope.add(
        "venue_specials",
        {
            "venue_id": venue_id,
            "slug": "sunday-funday-free-admission",
            "title": "Sunday FUNday free admission",
            "description": "On the first Sunday of the month during the academic year, Sunday FUNdays offer free admission plus drop-in family art-making at the museum.",
            "price_note": "Free admission during Sunday FUNday programming.",
            "is_free": True,
            "source_url": f"{BASE_URL}/childrens-and-family-programs",
            "category": "admission",
        },
    )
    return envelope


def _enrich_venue_data() -> None:
    """
    Fetch og:description and og:image from the Carlos Museum homepage and inject
    them into VENUE_DATA so get_or_create_venue() stores them on first creation.
    Only fills fields that are not already set.
    """
    try:
        resp = requests.get(BASE_URL, headers=HEADERS, timeout=20)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "html.parser")

        og_desc_tag = soup.find("meta", property="og:description")
        og_image_tag = soup.find("meta", property="og:image")

        og_desc = og_desc_tag.get("content", "") if og_desc_tag else ""
        og_image = og_image_tag.get("content", "") if og_image_tag else ""

        if og_desc and not VENUE_DATA.get("description"):
            VENUE_DATA["description"] = re.sub(r"\s+", " ", og_desc).strip()
        if og_image and not VENUE_DATA.get("image_url"):
            VENUE_DATA["image_url"] = og_image.strip()
    except Exception as exc:
        logger.debug("Carlos Museum homepage og: fetch failed: %s", exc)


def parse_time(time_text: str) -> Optional[str]:
    """Parse time from '7:00 PM' format."""
    match = re.search(r"(\d{1,2}):(\d{2})\s*(am|pm)", time_text, re.IGNORECASE)
    if match:
        hour, minute, period = match.groups()
        hour = int(hour)
        if period.lower() == "pm" and hour != 12:
            hour += 12
        elif period.lower() == "am" and hour == 12:
            hour = 0
        return f"{hour:02d}:{minute}"
    return None


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Michael C. Carlos Museum events using requests + BeautifulSoup."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        _enrich_venue_data()
        venue_id = get_or_create_venue(VENUE_DATA)
        persist_typed_entity_envelope(_build_destination_envelope(venue_id))

        logger.info(f"Fetching Michael C. Carlos Museum: {EVENTS_URL}")
        response = requests.get(EVENTS_URL, headers=HEADERS, timeout=30)
        response.raise_for_status()
        soup = BeautifulSoup(response.text, "html.parser")

        # Extract event links
        event_links: dict[str, str] = {}
        for a in soup.find_all("a", href=True):
            href = a["href"]
            text = a.get_text(strip=True)
            if text and len(text) > 3:
                if not href.startswith("http"):
                    href = BASE_URL + href if href.startswith("/") else href
                if text.lower() not in event_links:
                    event_links[text.lower()] = href

        # Extract images
        image_map: dict[str, str] = {}
        for img in soup.find_all("img", src=True):
            alt = img.get("alt", "").strip()
            src = img["src"]
            if alt and src and not src.endswith(".svg"):
                if not src.startswith("http"):
                    src = BASE_URL + src if src.startswith("/") else src
                image_map[alt] = src

        # Try structured event containers first (common patterns for WordPress/event plugins)
        event_containers = soup.find_all(
            ["article", "div"],
            class_=lambda x: x and ("event" in x.lower() or "tribe" in x.lower())
        )

        if event_containers:
            for container in event_containers:
                try:
                    title_elem = (
                        container.find("h2") or
                        container.find("h3") or
                        container.find(class_=lambda x: x and "title" in x.lower())
                    )
                    if not title_elem:
                        continue

                    title = title_elem.get_text(strip=True)

                    date_elem = container.find(class_=lambda x: x and "date" in x.lower()) or container
                    date_text = date_elem.get_text()
                    start_date = _parse_date_from_text(date_text)
                    if not start_date:
                        continue

                    start_time = parse_time(date_text)

                    desc_elem = container.find(class_=lambda x: x and ("description" in x.lower() or "excerpt" in x.lower()))
                    description = desc_elem.get_text(strip=True) if desc_elem else f"Event at The Michael C. Carlos Museum."

                    link_elem = container.find("a", href=True)
                    event_url = link_elem["href"] if link_elem else EVENTS_URL
                    if event_url and not event_url.startswith("http"):
                        event_url = BASE_URL + event_url if event_url.startswith("/") else BASE_URL + "/" + event_url

                    img_elem = container.find("img", src=True)
                    image_url = img_elem["src"] if img_elem else image_map.get(title)
                    if image_url and not image_url.startswith("http"):
                        image_url = BASE_URL + image_url if image_url.startswith("/") else None

                    events_found += 1
                    content_hash = generate_content_hash(title, "Michael C. Carlos Museum", start_date)

                    event_record = {
                        "source_id": source_id,
                        "venue_id": venue_id,
                        "title": title,
                        "description": description,
                        "start_date": start_date,
                        "start_time": start_time,
                        "end_date": None,
                        "end_time": None,
                        "is_all_day": False,
                        "category": "museums",
                        "subcategory": "exhibition",
                        "tags": ["carlos-museum", "emory", "museum", "art", "antiquities", "free"],
                        "price_min": None,
                        "price_max": None,
                        "price_note": "Suggested donation $8",
                        "is_free": True,
                        "source_url": event_url,
                        "ticket_url": event_url,
                        "image_url": image_url,
                        "raw_text": f"{title} - {start_date}",
                        "extraction_confidence": 0.85,
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
                        logger.info(f"Added: {title} on {start_date}")
                    except Exception as e:
                        logger.error(f"Failed to insert: {title}: {e}")

                except Exception as e:
                    logger.error(f"Failed to parse event container: {e}")
                    continue
        else:
            # Fallback: text line parsing
            body_text = soup.get_text(separator="\n")
            lines = [l.strip() for l in body_text.split("\n") if l.strip()]

            i = 0
            while i < len(lines):
                line = lines[i]

                if len(line) < 3:
                    i += 1
                    continue

                date_match = re.match(
                    r"(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)?,?\s*(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})(?:,?\s+(\d{4}))?",
                    line,
                    re.IGNORECASE
                )

                if date_match:
                    month = date_match.group(1)
                    day = date_match.group(2)
                    year = date_match.group(3) if date_match.group(3) else str(datetime.now().year)

                    title = None
                    start_time = None

                    for offset in [-2, -1, 1, 2, 3]:
                        idx = i + offset
                        if 0 <= idx < len(lines):
                            check_line = lines[idx]
                            if re.match(r"(January|February|March)", check_line, re.IGNORECASE):
                                continue
                            if not start_time:
                                time_result = parse_time(check_line)
                                if time_result:
                                    start_time = time_result
                                    continue
                            if not title and len(check_line) > 5:
                                if not re.match(r"\d{1,2}[:/]", check_line):
                                    if not re.match(r"(free|tickets|register|\$|more info)", check_line.lower()):
                                        title = check_line
                                        break

                    if not title:
                        i += 1
                        continue

                    try:
                        month_str = month[:3] if len(month) > 3 else month
                        dt = datetime.strptime(f"{month_str} {day} {year}", "%b %d %Y")
                        if dt.date() < datetime.now().date():
                            dt = datetime.strptime(f"{month_str} {day} {int(year) + 1}", "%b %d %Y")
                        start_date = dt.strftime("%Y-%m-%d")
                    except ValueError:
                        i += 1
                        continue

                    events_found += 1
                    content_hash = generate_content_hash(title, "Michael C. Carlos Museum", start_date)

                    event_url = find_event_url(title, event_links, EVENTS_URL)

                    event_record = {
                        "source_id": source_id,
                        "venue_id": venue_id,
                        "title": title,
                        "description": "Event at Michael C. Carlos Museum",
                        "start_date": start_date,
                        "start_time": start_time,
                        "end_date": None,
                        "end_time": None,
                        "is_all_day": False,
                        "category": "museums",
                        "subcategory": "exhibition",
                        "tags": ["carlos-museum", "emory", "museum", "art", "antiquities", "free"],
                        "price_min": None,
                        "price_max": None,
                        "price_note": "Suggested donation $8",
                        "is_free": True,
                        "source_url": event_url,
                        "ticket_url": event_url,
                        "image_url": image_map.get(title),
                        "raw_text": f"{title} - {start_date}",
                        "extraction_confidence": 0.80,
                        "is_recurring": False,
                        "recurrence_rule": None,
                        "content_hash": content_hash,
                    }

                    existing = find_event_by_hash(content_hash)
                    if existing:
                        smart_update_existing_event(existing, event_record)
                        events_updated += 1
                        i += 1
                        continue

                    try:
                        insert_event(event_record)
                        events_new += 1
                        logger.info(f"Added: {title} on {start_date}")
                    except Exception as e:
                        logger.error(f"Failed to insert: {title}: {e}")

                i += 1

        logger.info(
            f"Michael C. Carlos Museum crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Michael C. Carlos Museum: {e}")
        raise

    return events_found, events_new, events_updated


def _parse_date_from_text(text: str) -> Optional[str]:
    """Extract a YYYY-MM-DD date from arbitrary text."""
    match = re.search(
        r"(January|February|March|April|May|June|July|August|September|October|November|December|"
        r"Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})(?:,?\s+(\d{4}))?",
        text,
        re.IGNORECASE,
    )
    if not match:
        return None
    month = match.group(1)
    day = match.group(2)
    year = match.group(3) if match.group(3) else str(datetime.now().year)
    try:
        month_str = month[:3] if len(month) > 3 else month
        dt = datetime.strptime(f"{month_str} {day} {year}", "%b %d %Y")
        if dt.date() < datetime.now().date():
            dt = datetime.strptime(f"{month_str} {day} {int(year) + 1}", "%b %d %Y")
        return dt.strftime("%Y-%m-%d")
    except ValueError:
        return None
