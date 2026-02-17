"""
Crawler for Variant Brewing (variantbrewing.com).
Roswell craft brewery with taproom, live music, food trucks, and community events.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime
from typing import Optional

import requests
from bs4 import BeautifulSoup

from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://variantbrewing.com"

VENUE_DATA = {
    "name": "Variant Brewing",
    "slug": "variant-brewing",
    "address": "280 Azalea Dr",
    "neighborhood": "Roswell",
    "city": "Roswell",
    "state": "GA",
    "zip": "30075",
    "lat": 34.0180,
    "lng": -84.3410,
    "venue_type": "brewery",
    "spot_type": "brewery",
    "website": BASE_URL,
    "description": "Roswell craft brewery with rotating taps, taproom, live music, and food trucks.",
}

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
}


def parse_date(date_str: str) -> Optional[str]:
    """Parse date from various formats."""
    date_str = date_str.strip()
    now = datetime.now()

    formats = ["%B %d, %Y", "%b %d, %Y", "%m/%d/%Y", "%m/%d/%y"]

    for fmt in formats:
        try:
            dt = datetime.strptime(date_str, fmt)
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            continue

    match = re.search(
        r"(January|February|March|April|May|June|July|August|September|October|November|December|"
        r"Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\.?\s+(\d{1,2})",
        date_str, re.IGNORECASE
    )
    if match:
        month_str = match.group(1)[:3]
        day = match.group(2)
        try:
            dt = datetime.strptime(f"{month_str} {day} {now.year}", "%b %d %Y")
            if dt.date() < now.date():
                dt = dt.replace(year=now.year + 1)
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            pass

    return None


def determine_category(title: str) -> tuple[str, Optional[str], list[str]]:
    """Determine category based on event title."""
    title_lower = title.lower()
    tags = ["variant-brewing", "roswell", "brewery", "craft-beer"]

    if any(w in title_lower for w in ["music", "live", "band", "acoustic", "concert"]):
        return "music", "live", tags + ["live-music"]
    if any(w in title_lower for w in ["trivia", "quiz"]):
        return "community", None, tags + ["trivia"]
    if any(w in title_lower for w in ["release", "tap", "beer"]):
        return "food_drink", "tasting", tags + ["beer-release"]
    if any(w in title_lower for w in ["food truck", "truck"]):
        return "food_drink", None, tags + ["food-truck"]
    if any(w in title_lower for w in ["yoga", "fitness"]):
        return "fitness", None, tags + ["wellness"]

    return "community", None, tags


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Variant Brewing events."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        venue_id = get_or_create_venue(VENUE_DATA)

        for path in ["/events", "/taproom", "/calendar", ""]:
            try:
                url = BASE_URL + path
                response = requests.get(url, headers=HEADERS, timeout=30)
                if response.status_code != 200:
                    continue

                soup = BeautifulSoup(response.text, "html.parser")

                event_selectors = [".event", ".event-item", "[class*='event']", "article"]

                for selector in event_selectors:
                    elements = soup.select(selector)
                    if not elements:
                        continue

                    for element in elements:
                        try:
                            title_elem = element.find(["h2", "h3", "h4", "a"])
                            if not title_elem:
                                continue
                            title = title_elem.get_text(strip=True)
                            if not title or len(title) < 3:
                                continue

                            text = element.get_text()
                            date_match = re.search(
                                r"(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}",
                                text, re.IGNORECASE
                            )
                            if not date_match:
                                continue

                            start_date = parse_date(date_match.group())
                            if not start_date:
                                continue

                            if datetime.strptime(start_date, "%Y-%m-%d").date() < datetime.now().date():
                                continue

                            events_found += 1

                            content_hash = generate_content_hash(title, "Variant Brewing", start_date)


                            category, subcategory, tags = determine_category(title)

                            event_record = {
                                "source_id": source_id,
                                "venue_id": venue_id,
                                "title": title,
                                "description": f"Event at Variant Brewing in Roswell",
                                "start_date": start_date,
                                "start_time": "18:00",
                                "end_date": None,
                                "end_time": None,
                                "is_all_day": False,
                                "category": category,
                                "subcategory": subcategory,
                                "tags": tags,
                                "price_min": None,
                                "price_max": None,
                                "price_note": None,
                                "is_free": True,
                                "source_url": url,
                                "ticket_url": None,
                                "image_url": None,
                                "raw_text": text[:500],
                                "extraction_confidence": 0.75,
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
                            logger.debug(f"Error parsing event: {e}")
                            continue

                    if events_found > 0:
                        break

                if events_found > 0:
                    break

            except requests.RequestException:
                continue

        logger.info(f"Variant Brewing crawl complete: {events_found} found, {events_new} new, {events_updated} updated")

    except Exception as e:
        logger.error(f"Failed to crawl Variant Brewing: {e}")
        raise

    return events_found, events_new, events_updated
