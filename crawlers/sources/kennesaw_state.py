"""
Crawler for Kennesaw State University ArtsKSU / AudienceView storefront.

The old storefront no longer renders event cards in the initial DOM. The
current AudienceView client loads inventory from REST endpoints, so this
crawler reads the supported API directly instead of scraping obsolete markup.
"""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Optional

import requests
from bs4 import BeautifulSoup

from db import find_event_by_hash, get_or_create_venue, insert_event, smart_update_existing_event
from dedupe import generate_content_hash
from utils import enrich_event_record

logger = logging.getLogger(__name__)

BASE_URL = "https://ci.ovationtix.com/35355"
API_BASE_URL = "https://web.ovationtix.com/trs/api/rest"
CLIENT_ID = "35355"

# Map venue names from AudienceView to our venue data
VENUE_MAP = {
    "bailey performance center": "bailey",
    "morgan concert hall": "bailey",
    "marietta dance theater": "bailey",
    "onyx theater": "bailey",
    "zuckerman museum of art": "zuckerman",
    "fine arts gallery": "fine_arts",
    "fifth third bank stadium": "stadium",
    "default": "bailey",
}

VENUES = {
    "bailey": {
        "name": "Bailey Performance Center",
        "slug": "bailey-performance-center",
        "address": "488 Prillaman Way",
        "neighborhood": "Kennesaw",
        "city": "Kennesaw",
        "state": "GA",
        "zip": "30144",
        "venue_type": "performing_arts",
        "website": "https://arts.kennesaw.edu",
    },
    "zuckerman": {
        "name": "Zuckerman Museum of Art",
        "slug": "zuckerman-museum-of-art",
        "address": "492 Prillaman Way",
        "neighborhood": "Kennesaw",
        "city": "Kennesaw",
        "state": "GA",
        "zip": "30144",
        "venue_type": "museum",
        "website": "https://zuckerman.kennesaw.edu",
    },
    "fine_arts": {
        "name": "KSU Fine Arts Gallery",
        "slug": "ksu-fine-arts-gallery",
        "address": "471 Bartow Ave",
        "neighborhood": "Kennesaw",
        "city": "Kennesaw",
        "state": "GA",
        "zip": "30144",
        "venue_type": "gallery",
        "website": "https://arts.kennesaw.edu",
    },
    "stadium": {
        "name": "Fifth Third Bank Stadium",
        "slug": "fifth-third-bank-stadium",
        "address": "3200 George Busbee Parkway NW",
        "neighborhood": "Kennesaw",
        "city": "Kennesaw",
        "state": "GA",
        "zip": "30144",
        "venue_type": "stadium",
        "website": "https://ksuowls.com",
    },
}


def _audienceview_headers() -> dict[str, str]:
    return {
        "User-Agent": "Mozilla/5.0",
        "clientId": CLIENT_ID,
    }


def _parse_ovation_datetime(value: Optional[str]) -> tuple[Optional[str], Optional[str]]:
    """Parse AudienceView timestamps like '2026-03-20 18:00'."""
    if not value:
        return None, None

    try:
        parsed = datetime.strptime(value, "%Y-%m-%d %H:%M")
    except ValueError:
        return None, None

    return parsed.strftime("%Y-%m-%d"), parsed.strftime("%H:%M")


def _clean_description(raw_html: Optional[str]) -> Optional[str]:
    """Convert AudienceView rich-text descriptions to compact plain text."""
    if not raw_html:
        return None

    text = BeautifulSoup(raw_html, "html.parser").get_text(" ", strip=True)
    text = " ".join(text.split())
    return text[:1000] if text else None


def _logo_url(raw_logo_url: Optional[str]) -> Optional[str]:
    if not raw_logo_url:
        return None
    if raw_logo_url.startswith("http"):
        return raw_logo_url
    if raw_logo_url.startswith("/ClientFile("):
        return f"{API_BASE_URL}{raw_logo_url}"
    return f"{BASE_URL}{raw_logo_url}"


def categorize_event(title: str, venue_name: str) -> tuple[str, str]:
    """Determine category and subcategory."""
    title_lower = title.lower()
    venue_lower = venue_name.lower()

    if "museum" in venue_lower or "gallery" in venue_lower or "exhibition" in title_lower:
        return "museums", "exhibition"

    if any(word in title_lower for word in ["dance", "ballet", "choreograph"]):
        return "theater", "dance"

    if any(word in title_lower for word in ["play", "theater", "theatre", "drama"]):
        return "theater", "performance"

    if any(word in title_lower for word in ["jazz", "symphony", "orchestra", "ensemble", "choir", "concert", "recital", "piano", "violin"]):
        if "jazz" in title_lower:
            return "music", "jazz"
        if any(word in title_lower for word in ["symphony", "orchestra", "ensemble"]):
            return "music", "classical"
        return "music", "concert"

    return "arts", "performance"


def get_venue_key(venue_text: str) -> str:
    """Map venue text from AudienceView to our venue key."""
    venue_lower = venue_text.lower()
    for key, mapped_key in VENUE_MAP.items():
        if key in venue_lower:
            return mapped_key
    return VENUE_MAP["default"]


def _should_skip_production(title: str) -> bool:
    title_lower = title.lower()
    return ("admission" in title_lower or "general admission" in title_lower) and "opening" not in title_lower


def _build_tags(category: str) -> list[str]:
    tags = ["college", "kennesaw-state", "arts-ksu"]
    if category == "music":
        tags.append("classical")
    return tags


def _fetch_json(path: str) -> list[dict]:
    response = requests.get(
        f"{API_BASE_URL}/{path}",
        headers=_audienceview_headers(),
        timeout=30,
    )
    response.raise_for_status()
    return response.json()


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Kennesaw State ArtsKSU events from AudienceView APIs."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        logger.info("Fetching Kennesaw State ArtsKSU via AudienceView REST API")
        productions = _fetch_json("Production?expandPerformances=summary")
        calendar_days = _fetch_json("CalendarProductions")

        production_map = {item["id"]: item for item in productions if isinstance(item, dict) and item.get("id")}
        logger.info("Loaded %d productions and %d calendar days", len(production_map), len(calendar_days))

        for day in calendar_days:
            for calendar_prod in day.get("productions", []):
                try:
                    production_id = calendar_prod.get("productionId")
                    production = production_map.get(production_id)
                    title = (calendar_prod.get("name") or (production or {}).get("productionName") or "").strip()
                    if not title:
                        continue

                    if _should_skip_production(title):
                        logger.debug("Skipping general admission: %s", title)
                        continue

                    venue_text = (
                        calendar_prod.get("subtitle")
                        or (production or {}).get("subtitle")
                        or ((production or {}).get("venue") or {}).get("name")
                        or "Bailey Performance Center"
                    )
                    venue_key = get_venue_key(venue_text)
                    venue_data = VENUES[venue_key]
                    venue_id = get_or_create_venue(venue_data)

                    description = _clean_description((production or {}).get("description"))
                    image_url = _logo_url((production or {}).get("logoUrl"))
                    source_url = BASE_URL

                    for showtime in calendar_prod.get("showtimes", []):
                        if not showtime.get("isVisible", True) or showtime.get("isCancelled"):
                            continue

                        start_date, start_time = _parse_ovation_datetime(showtime.get("performanceStartTime"))
                        end_date, end_time = _parse_ovation_datetime(showtime.get("performanceEndTime"))
                        if not start_date:
                            continue

                        events_found += 1

                        content_hash = generate_content_hash(title, venue_data["name"], start_date)
                        category, subcategory = categorize_event(title, venue_data["name"])

                        event_record = {
                            "source_id": source_id,
                            "venue_id": venue_id,
                            "title": title,
                            "description": description,
                            "start_date": start_date,
                            "start_time": None if calendar_prod.get("allDayEvent") else start_time,
                            "end_date": end_date if end_date != start_date else None,
                            "end_time": None if calendar_prod.get("allDayEvent") else end_time,
                            "is_all_day": bool(calendar_prod.get("allDayEvent")),
                            "category": category,
                            "subcategory": subcategory,
                            "tags": _build_tags(category),
                            "price_min": None,
                            "price_max": None,
                            "price_note": "Check ArtsKSU for pricing",
                            "is_free": None,
                            "source_url": source_url,
                            "ticket_url": source_url,
                            "image_url": image_url,
                            "raw_text": description[:500] if description else title,
                            "extraction_confidence": 0.9,
                            "is_recurring": False,
                            "recurrence_rule": None,
                            "content_hash": content_hash,
                        }

                        existing = find_event_by_hash(content_hash)
                        if existing:
                            smart_update_existing_event(existing, event_record)
                            events_updated += 1
                            continue

                        enrich_event_record(event_record, "Kennesaw State University Arts")
                        insert_event(event_record)
                        events_new += 1
                        logger.debug("Added: %s on %s at %s", title, start_date, start_time)

                except Exception as exc:
                    logger.debug("Error processing AudienceView production: %s", exc)
                    continue

        logger.info(
            "Kennesaw State ArtsKSU: Found %d events, %d new, %d existing",
            events_found,
            events_new,
            events_updated,
        )

    except Exception as exc:
        logger.error("Failed to crawl Kennesaw State ArtsKSU: %s", exc)
        raise

    return events_found, events_new, events_updated
