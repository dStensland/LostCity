"""
Crawler for Stone Mountain Park (stonemountainpark.com).

3,200-acre park with hiking, attractions, and family events.
Uses The Events Calendar API for event data.
"""

from __future__ import annotations

import logging
import requests
from datetime import datetime
from typing import Optional
from bs4 import BeautifulSoup

from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash
from utils import parse_price

logger = logging.getLogger(__name__)

# Multi-week umbrella events that are already tracked in the festivals table.
# These are wrapper entries with no useful detail — the individual programming
# events within them are what we want.
SKIP_UMBRELLA_KEYWORDS = [
    "lunar new year",
    "chinese new year",
    "stone mountain christmas",
    "pumpkin festival",
    "latino family festival",
]

# Minimum span (in days) for an event to be considered an umbrella festival wrapper.
UMBRELLA_MIN_DAYS = 7

BASE_URL = "https://stonemountainpark.com"
API_URL = f"{BASE_URL}/wp-json/tribe/events/v1/events"

VENUE_DATA = {
    "name": "Stone Mountain Park",
    "slug": "stone-mountain-park",
    "address": "1000 Robert E Lee Blvd",
    "neighborhood": "Stone Mountain",
    "city": "Stone Mountain",
    "state": "GA",
    "zip": "30083",
    "lat": 33.8041,
    "lng": -84.1453,
    "venue_type": "park",
    "spot_type": "park",
    "website": BASE_URL,
}

# Keywords to help categorize events
EVENT_KEYWORDS = {
    "family": ["kids", "children", "family", "holiday", "christmas", "easter", "halloween", "pumpkin", "dino"],
    "fitness": ["hike", "run", "walk", "trail", "5k", "marathon", "bike", "yoga"],
    "music": ["concert", "music", "band", "festival", "singer", "performance", "laser show", "lasershow"],
    "food_drink": ["wine", "beer", "food", "tasting", "culinary", "dining"],
    "community": ["festival", "gathering", "celebration", "pow wow", "highland games", "daisy"],
    "outdoors": ["adventure", "zipline", "zip line", "skyride", "hiking", "nature", "trail", "climbing"],
}


def categorize_event(title: str, description: str) -> tuple[str, Optional[str], list[str]]:
    """Determine category based on event title and description."""
    text = f"{title} {description}".lower()
    tags = ["stone-mountain-park", "family-friendly", "outdoor", "parks"]

    # Check for activity keywords
    if any(kw in text for kw in ["zipline", "zip line", "adventure course"]):
        return "outdoors", "adventure", tags + ["zipline", "adventure", "thrills"]

    if any(kw in text for kw in ["skyride", "cable car"]):
        return "outdoors", "sightseeing", tags + ["skyride", "scenic-views", "hiking"]

    if any(kw in text for kw in ["lasershow", "laser show", "fireworks"]):
        return "music", "festival", tags + ["laser-show", "night-show", "spectacle"]

    # Check major festivals and holidays
    if "lunar new year" in text or "chinese new year" in text:
        return "community", "festival", tags + ["lunar-new-year", "cultural", "asian"]

    if "yellow daisy" in text:
        return "community", "festival", tags + ["yellow-daisy-festival", "arts-crafts", "shopping"]

    if "highland games" in text:
        return "sports", "festival", tags + ["highland-games", "scottish", "cultural"]

    if "pow wow" in text or "native american" in text:
        return "community", "festival", tags + ["pow-wow", "native-american", "cultural"]

    if "pumpkin festival" in text or "halloween" in text:
        return "family", "festival", tags + ["halloween", "pumpkin", "fall"]

    if "christmas" in text or "holiday" in text or "north pole" in text:
        return "family", "festival", tags + ["christmas", "holiday", "winter", "lights"]

    if "easter" in text:
        return "community", "festival", tags + ["easter", "spring", "religious"]

    if "dino" in text:
        return "family", "festival", tags + ["dinosaurs", "kids", "educational"]

    # Check keyword categories
    for category, keywords in EVENT_KEYWORDS.items():
        if any(kw in text for kw in keywords):
            return category, None, tags

    # Default for park events
    return "family", None, tags


def is_umbrella_festival(title: str, start_dt: datetime, end_dt: Optional[datetime]) -> bool:
    """Check if an event is a multi-week festival wrapper that should be skipped."""
    if not end_dt:
        return False
    span_days = (end_dt.date() - start_dt.date()).days
    if span_days < UMBRELLA_MIN_DAYS:
        return False
    title_lower = title.lower()
    return any(kw in title_lower for kw in SKIP_UMBRELLA_KEYWORDS)


def strip_html(html_text: str) -> str:
    """Remove HTML tags from text."""
    if not html_text:
        return ""
    soup = BeautifulSoup(html_text, "html.parser")
    return soup.get_text().strip()


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Stone Mountain Park events using The Events Calendar API."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        venue_id = get_or_create_venue(VENUE_DATA)

        # Fetch events from API with pagination
        page = 1
        per_page = 50
        total_pages = 1
        seen_events = set()

        while page <= total_pages:
            logger.info(f"Fetching Stone Mountain Park events (page {page}/{total_pages})")

            params = {
                "per_page": per_page,
                "page": page,
                "status": "publish",
                "start_date": datetime.now().strftime("%Y-%m-%d"),
            }

            headers = {
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            }

            try:
                response = requests.get(API_URL, params=params, headers=headers, timeout=30)
                response.raise_for_status()
                data = response.json()
            except Exception as e:
                logger.error(f"Failed to fetch page {page}: {e}")
                break

            # Update total pages from first response
            if page == 1:
                total_pages = data.get("total_pages", 1)
                logger.info(f"Found {data.get('total', 0)} total events across {total_pages} pages")

            events = data.get("events", [])
            if not events:
                break

            for event in events:
                try:
                    title = event.get("title", "").strip()
                    if not title:
                        continue

                    # Parse dates
                    start_date_str = event.get("start_date", "")
                    end_date_str = event.get("end_date", "")

                    if not start_date_str:
                        continue

                    # Parse start date/time
                    try:
                        start_dt = datetime.strptime(start_date_str, "%Y-%m-%d %H:%M:%S")
                        start_date = start_dt.strftime("%Y-%m-%d")
                        start_time = start_dt.strftime("%H:%M")
                    except ValueError:
                        logger.warning(f"Could not parse start date: {start_date_str}")
                        continue

                    # Parse end time if available
                    end_time = None
                    end_date = None
                    end_dt = None
                    if end_date_str:
                        try:
                            end_dt = datetime.strptime(end_date_str, "%Y-%m-%d %H:%M:%S")
                            end_time = end_dt.strftime("%H:%M")
                            if end_dt.date() != start_dt.date():
                                end_date = end_dt.strftime("%Y-%m-%d")
                        except ValueError:
                            pass

                    # Skip umbrella festival wrappers (tracked in festivals table)
                    if is_umbrella_festival(title, start_dt, end_dt):
                        logger.debug(f"Skipping umbrella festival: {title}")
                        continue

                    # Check for all-day event
                    is_all_day = event.get("all_day", False)
                    if is_all_day:
                        start_time = None
                        end_time = None

                    # Check for duplicates (same title + date)
                    event_key = f"{title}|{start_date}"
                    if event_key in seen_events:
                        continue
                    seen_events.add(event_key)

                    events_found += 1

                    # Clean description
                    description = strip_html(event.get("description", ""))

                    # Get image URL
                    image_url = None
                    image_data = event.get("image")
                    if image_data and isinstance(image_data, dict):
                        image_url = image_data.get("url")

                    # Get event URL
                    event_url = event.get("url", BASE_URL)
                    website = event.get("website")
                    ticket_url = website if website else event_url

                    # Parse cost
                    cost_str = event.get("cost", "")
                    price_min, price_max, price_note = parse_price(cost_str) if cost_str else (None, None, None)
                    is_free = price_min == 0 and price_max == 0

                    # Determine category
                    category, subcategory, tags = categorize_event(title, description)

                    # Generate content hash
                    content_hash = generate_content_hash(title, "Stone Mountain Park", start_date)

                    # Check if event already exists

                    event_record = {
                        "source_id": source_id,
                        "venue_id": venue_id,
                        "title": title,
                        "description": description if description else None,
                        "start_date": start_date,
                        "start_time": start_time,
                        "end_date": end_date,
                        "end_time": end_time,
                        "is_all_day": is_all_day,
                        "category": category,
                        "subcategory": subcategory,
                        "tags": tags,
                        "price_min": price_min,
                        "price_max": price_max,
                        "price_note": price_note,
                        "is_free": is_free,
                        "source_url": event_url,
                        "ticket_url": ticket_url,
                        "image_url": image_url,
                        "raw_text": f"{title} - {description[:200]}" if description else title,
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
                        logger.info(f"Added: {title} on {start_date}")
                    except Exception as e:
                        logger.error(f"Failed to insert event '{title}': {e}")

                except Exception as e:
                    logger.error(f"Error processing event: {e}")
                    continue

            page += 1

        logger.info(
            f"Stone Mountain Park crawl complete: {events_found} found, "
            f"{events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Stone Mountain Park: {e}")
        raise

    return events_found, events_new, events_updated
