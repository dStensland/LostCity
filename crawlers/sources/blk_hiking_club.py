"""
Crawler for BLK Hiking Club Atlanta (blkhikingclub.com/atlanta).

The Atlanta landing page exposes event detail links directly. Each detail page
contains schema.org `Event` JSON-LD, which is more reliable than scraping the
rendered Squarespace layout.
"""

from __future__ import annotations

import json
import logging
import re
from datetime import date, datetime
from typing import Optional
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

from db import get_or_create_place, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://www.blkhikingclub.com"
EVENTS_URL = f"{BASE_URL}/atlanta"
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
    )
}

ORG_VENUE = {
    "name": "BLK Hiking Club Atlanta",
    "slug": "blk-hiking-club",
    "city": "Atlanta",
    "state": "GA",
    "venue_type": "organization",
    "spot_type": "organization",
    "website": EVENTS_URL,
}


def parse_event_jsonld(detail_soup: BeautifulSoup) -> Optional[dict]:
    for script in detail_soup.select('script[type="application/ld+json"]'):
        raw = script.get_text(strip=True)
        if not raw:
            continue
        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError:
            continue

        candidates = parsed if isinstance(parsed, list) else [parsed]
        for candidate in candidates:
            if isinstance(candidate, dict) and candidate.get("@type") == "Event":
                return candidate
    return None


def meta_content(detail_soup: BeautifulSoup, attr: str, value: str) -> str:
    tag = detail_soup.find("meta", attrs={attr: value})
    if not tag or not tag.get("content"):
        return ""
    return " ".join(tag.get("content", "").split())


def clean_title(value: str) -> str:
    return (
        value.replace("— BLK Hiking Club", "")
        .replace("- BLK Hiking Club", "")
        .strip()
    )


def select_event_title(detail_soup: BeautifulSoup, event_json: dict) -> str:
    candidates = [
        str(event_json.get("name", "")),
        meta_content(detail_soup, "property", "og:title"),
        meta_content(detail_soup, "name", "twitter:title"),
    ]

    title_tag = detail_soup.find("title")
    if title_tag:
        candidates.append(title_tag.get_text(" ", strip=True))

    h1 = detail_soup.find("h1")
    if h1:
        candidates.append(h1.get_text(" ", strip=True))

    for candidate in candidates:
        cleaned = clean_title(candidate)
        if cleaned:
            return cleaned
    return ""


def derive_location_name(title: str) -> str:
    lowered = title.lower()
    if lowered.startswith("blk hike:"):
        return title.split(":", 1)[1].strip()
    if lowered.startswith("blk hiking club:"):
        return title.split(":", 1)[1].strip()
    if lowered.startswith("blk hike at "):
        return title[12:].strip()
    if lowered.startswith("blk hiking club at "):
        return title[20:].strip()
    if ":" in title:
        return title.split(":", 1)[1].strip()
    return title.strip()


def parse_iso_datetime(value: str) -> Optional[datetime]:
    cleaned = value.strip()
    if not cleaned:
        return None

    try:
        return datetime.fromisoformat(cleaned.replace("Z", "+00:00"))
    except ValueError:
        pass

    for fmt in ("%Y-%m-%dT%H:%M:%S%z", "%Y-%m-%dT%H:%M:%S"):
        try:
            return datetime.strptime(cleaned, fmt)
        except ValueError:
            continue

    return None


def categorize_event(title: str, description: str) -> tuple[str, Optional[str], list[str]]:
    combined = f"{title} {description}".lower()
    tags = ["blk-hiking-club", "outdoor", "adventure", "hiking"]

    if "kid" in combined or "family" in combined:
        tags.append("family")
        return "family", "outdoor", tags
    if "women" in combined:
        tags.append("womens-group")
    if "sunset" in combined or "sunrise" in combined:
        tags.append("scenic")
    return "community", "outdoor", tags


def crawl(source: dict) -> tuple[int, int, int]:
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    session = requests.Session()
    fallback_venue_id = get_or_create_place(ORG_VENUE)

    try:
        logger.info("Fetching BLK Hiking Club listing: %s", EVENTS_URL)
        response = session.get(EVENTS_URL, headers=HEADERS, timeout=20)
        response.raise_for_status()
        soup = BeautifulSoup(response.text, "html.parser")

        event_links: list[str] = []
        seen = set()
        for anchor in soup.select('a[href^="/atlanta/"]'):
            href = anchor.get("href", "")
            if not href or href == "/atlanta":
                continue
            if href.endswith("?format=ical"):
                continue
            if "google.com/calendar" in href:
                continue
            absolute = urljoin(BASE_URL, href)
            if absolute not in seen:
                seen.add(absolute)
                event_links.append(absolute)

        today = date.today()
        for detail_url in event_links:
            detail_response = session.get(detail_url, headers=HEADERS, timeout=20)
            detail_response.raise_for_status()
            detail_soup = BeautifulSoup(detail_response.text, "html.parser")
            event_json = parse_event_jsonld(detail_soup)
            if not event_json:
                continue

            title = select_event_title(detail_soup, event_json)
            start_raw = str(event_json.get("startDate", "")).strip()
            end_raw = str(event_json.get("endDate", "")).strip()
            if not title or not start_raw:
                continue

            start_dt = parse_iso_datetime(start_raw)
            if start_dt is None:
                logger.debug("Skipping BLK Hiking Club event with bad startDate: %s", start_raw)
                continue

            if start_dt.date() < today:
                continue

            end_dt = parse_iso_datetime(end_raw) if end_raw else None

            description = (
                detail_soup.find("meta", attrs={"property": "og:description"}) or
                detail_soup.find("meta", attrs={"name": "description"})
            )
            description_text = ""
            if description and description.get("content"):
                description_text = " ".join(description.get("content", "").split())

            image_tag = detail_soup.find("meta", attrs={"property": "og:image"})
            image_url = image_tag.get("content") if image_tag else None

            location_name = (
                str((event_json.get("location") or {}).get("name", "")).strip()
                if isinstance(event_json.get("location"), dict)
                else ""
            )
            if not location_name:
                location_name = derive_location_name(title)

            if title == location_name and location_name:
                title = f"BLK Hike: {location_name}"

            venue_id = fallback_venue_id
            if location_name:
                venue_record = {
                    "name": location_name,
                    "slug": re.sub(r"[^a-z0-9]+", "-", location_name.lower()).strip("-")[:80],
                    "city": "Atlanta",
                    "state": "GA",
                    "venue_type": "park",
                    "spot_type": "trail",
                    "website": detail_url,
                }
                try:
                    venue_id = get_or_create_place(venue_record)
                except Exception as exc:
                    logger.debug("Falling back to org venue for %s: %s", title, exc)

            category, subcategory, tags = categorize_event(title, description_text)
            content_hash = generate_content_hash(title, location_name or "BLK Hiking Club Atlanta", start_dt.strftime("%Y-%m-%d"))
            events_found += 1

            event_record = {
                "source_id": source_id,
                "venue_id": venue_id,
                "title": title[:500],
                "description": (description_text or f"{title} hosted by BLK Hiking Club Atlanta.")[:2000],
                "start_date": start_dt.strftime("%Y-%m-%d"),
                "start_time": start_dt.strftime("%H:%M"),
                "end_date": end_dt.strftime("%Y-%m-%d") if end_dt else start_dt.strftime("%Y-%m-%d"),
                "end_time": end_dt.strftime("%H:%M") if end_dt else None,
                "is_all_day": False,
                "category": category,
                "subcategory": subcategory,
                "tags": tags[:10],
                "price_min": None,
                "price_max": None,
                "price_note": "Registration details on BLK Hiking Club",
                "is_free": False,
                "source_url": detail_url,
                "ticket_url": detail_url,
                "image_url": image_url,
                "raw_text": description_text[:500] or title,
                "extraction_confidence": 0.95,
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
            except Exception as exc:
                logger.error("Failed to insert BLK Hiking Club event '%s': %s", title, exc)

        logger.info(
            "BLK Hiking Club crawl complete: %s found, %s new, %s updated",
            events_found,
            events_new,
            events_updated,
        )
    except Exception as exc:
        logger.error("Failed to crawl BLK Hiking Club: %s", exc)
        raise
    finally:
        session.close()

    return events_found, events_new, events_updated
