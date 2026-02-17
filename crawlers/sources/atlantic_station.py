"""
Crawler for Atlantic Station (atlanticstation.com).
Major urban mixed-use retail and entertainment destination in Midtown.
Hosts outdoor concerts, seasonal festivals, farmers markets, and community events.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime, timedelta
from typing import Optional

import requests
from bs4 import BeautifulSoup

from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://atlanticstation.com"
EVENTS_URL = f"{BASE_URL}/events"

VENUE_DATA = {
    "name": "Atlantic Station",
    "slug": "atlantic-station",
    "address": "1380 Atlantic Dr NW",
    "neighborhood": "Atlantic Station",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30363",
    "lat": 33.7920,
    "lng": -84.3950,
    "venue_type": "entertainment_complex",
    "spot_type": "entertainment_complex",
    "website": BASE_URL,
    "description": "Urban mixed-use retail and entertainment destination with outdoor plaza, concerts, and seasonal events.",
}

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
}


def create_seasonal_events(source_id: int, venue_id: int) -> tuple[int, int]:
    """Create known seasonal events at Atlantic Station."""
    events_new = 0
    events_updated = 0
    now = datetime.now()
    year = now.year

    seasonal_events = [
        {
            "title": "Atlantic Station Outdoor Movie Night",
            "month": 6,
            "day_offset": 14,  # Mid-month
            "time": "20:30",
            "description": "Free outdoor movie screenings on the Central Park lawn. Bring blankets and picnic items.",
            "category": "film",
            "subcategory": "screening",
            "tags": ["atlantic-station", "outdoor-movie", "free", "family-friendly"],
            "is_free": True,
        },
        {
            "title": "Atlantic Station Summer Concert Series",
            "month": 7,
            "day_offset": 7,
            "time": "19:00",
            "description": "Free live music on the Central Park stage. Local and regional artists perform throughout summer.",
            "category": "music",
            "subcategory": "live",
            "tags": ["atlantic-station", "live-music", "outdoor", "free", "summer"],
            "is_free": True,
        },
        {
            "title": "Atlantic Station Tree Lighting",
            "month": 11,
            "day_offset": 28,  # After Thanksgiving
            "time": "18:00",
            "description": "Annual holiday tree lighting ceremony with live entertainment, Santa, and festive activities.",
            "category": "community",
            "subcategory": "celebration",
            "tags": ["atlantic-station", "holiday", "tree-lighting", "family-friendly"],
            "is_free": True,
        },
        {
            "title": "Atlantic Station Ice Rink Opening",
            "month": 11,
            "day_offset": 15,
            "time": "12:00",
            "description": "Seasonal outdoor ice skating rink opens for the winter season. Skate rentals available.",
            "category": "fitness",
            "subcategory": None,
            "tags": ["atlantic-station", "ice-skating", "winter", "family-friendly", "outdoor"],
            "is_free": False,
        },
    ]

    for event in seasonal_events:
        event_year = year
        if event["month"] < now.month:
            event_year = year + 1

        event_date = datetime(event_year, event["month"], 1) + timedelta(days=event["day_offset"])
        start_date = event_date.strftime("%Y-%m-%d")

        if datetime.strptime(start_date, "%Y-%m-%d").date() < now.date():
            continue

        content_hash = generate_content_hash(event["title"], "Atlantic Station", start_date)


        event_record = {
            "source_id": source_id,
            "venue_id": venue_id,
            "title": event["title"],
            "description": event["description"],
            "start_date": start_date,
            "start_time": event["time"],
            "end_date": None,
            "end_time": None,
            "is_all_day": False,
            "category": event["category"],
            "subcategory": event["subcategory"],
            "tags": event["tags"],
            "price_min": None,
            "price_max": None,
            "price_note": None,
            "is_free": event["is_free"],
            "source_url": EVENTS_URL,
            "ticket_url": None,
            "image_url": None,
            "raw_text": None,
            "extraction_confidence": 0.80,
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
            logger.info(f"Added: {event['title']} on {start_date}")
        except Exception as e:
            logger.error(f"Failed to insert: {event['title']}: {e}")

    return events_new, events_updated


def parse_date(date_str: str) -> Optional[str]:
    """Parse date from various formats."""
    date_str = date_str.strip()
    now = datetime.now()

    formats = [
        "%B %d, %Y",
        "%b %d, %Y",
        "%m/%d/%Y",
        "%m/%d/%y",
    ]

    for fmt in formats:
        try:
            dt = datetime.strptime(date_str, fmt)
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            continue

    match = re.search(
        r"(January|February|March|April|May|June|July|August|September|October|November|December|"
        r"Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s*(\d{4}))?",
        date_str,
        re.IGNORECASE
    )
    if match:
        month_str = match.group(1)[:3]
        day = match.group(2)
        year = match.group(3) if match.group(3) else str(now.year)
        try:
            dt = datetime.strptime(f"{month_str} {day} {year}", "%b %d %Y")
            if dt.date() < now.date():
                dt = dt.replace(year=now.year + 1)
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            pass

    return None


def parse_time(time_str: str) -> Optional[str]:
    """Parse time from various formats."""
    match = re.search(r"(\d{1,2}):?(\d{2})?\s*(am|pm|a|p)", time_str, re.IGNORECASE)
    if match:
        hour = int(match.group(1))
        minute = int(match.group(2)) if match.group(2) else 0
        period = match.group(3).lower()
        if period in ("pm", "p") and hour != 12:
            hour += 12
        elif period in ("am", "a") and hour == 12:
            hour = 0
        return f"{hour:02d}:{minute:02d}"
    return None


def determine_category(title: str) -> tuple[str, Optional[str], list[str]]:
    """Determine category based on event title."""
    title_lower = title.lower()
    tags = ["atlantic-station", "midtown"]

    if any(w in title_lower for w in ["concert", "music", "live", "band", "dj"]):
        return "music", "live", tags + ["live-music", "outdoor"]
    if any(w in title_lower for w in ["movie", "film", "screening"]):
        return "film", "screening", tags + ["outdoor-movie"]
    if any(w in title_lower for w in ["market", "farmers", "vendor"]):
        return "community", "market", tags + ["market", "shopping"]
    if any(w in title_lower for w in ["holiday", "christmas", "tree lighting"]):
        return "community", "celebration", tags + ["holiday", "family-friendly"]
    if any(w in title_lower for w in ["ice", "skating", "rink"]):
        return "fitness", None, tags + ["ice-skating", "winter"]
    if any(w in title_lower for w in ["kids", "children", "family"]):
        return "family", None, tags + ["family-friendly", "kids"]
    if any(w in title_lower for w in ["fitness", "yoga", "run", "walk"]):
        return "fitness", None, tags + ["outdoor", "wellness"]

    return "community", None, tags


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Atlantic Station events."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        venue_id = get_or_create_venue(VENUE_DATA)

        # Create known seasonal events
        seasonal_new, seasonal_updated = create_seasonal_events(source_id, venue_id)
        events_found += 4
        events_new += seasonal_new
        events_updated += seasonal_updated

        # Try to fetch events from website
        for path in ["/events", "/whats-happening", "/calendar", ""]:
            try:
                url = BASE_URL + path
                response = requests.get(url, headers=HEADERS, timeout=30)
                if response.status_code != 200:
                    continue

                soup = BeautifulSoup(response.text, "html.parser")

                # Look for event elements
                event_selectors = [
                    ".event", ".event-item", "[class*='event']",
                    ".calendar-item", "article", ".post"
                ]

                for selector in event_selectors:
                    elements = soup.select(selector)
                    if not elements:
                        continue

                    for element in elements:
                        try:
                            title_elem = element.find(["h1", "h2", "h3", "h4", "a"])
                            if not title_elem:
                                continue
                            title = title_elem.get_text(strip=True)
                            if not title or len(title) < 3:
                                continue

                            # Skip seasonal events (already handled)
                            title_lower = title.lower()
                            if any(w in title_lower for w in ["tree lighting", "ice rink", "summer concert", "movie night"]):
                                continue

                            text = element.get_text()
                            date_match = re.search(
                                r"(January|February|March|April|May|June|July|August|September|October|November|December|"
                                r"Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\.?\s+\d{1,2}",
                                text,
                                re.IGNORECASE
                            )
                            if not date_match:
                                date_match = re.search(r"\d{1,2}/\d{1,2}/\d{2,4}", text)

                            if not date_match:
                                continue

                            start_date = parse_date(date_match.group())
                            if not start_date:
                                continue

                            if datetime.strptime(start_date, "%Y-%m-%d").date() < datetime.now().date():
                                continue

                            events_found += 1

                            time_match = re.search(r"\d{1,2}:?\d{0,2}\s*(am|pm|a|p)", text, re.I)
                            start_time = parse_time(time_match.group()) if time_match else None

                            content_hash = generate_content_hash(title, "Atlantic Station", start_date)

                            existing = find_event_by_hash(content_hash)
                            if existing:
                                smart_update_existing_event(existing, event_record)
                                events_updated += 1
                                continue

                            category, subcategory, tags = determine_category(title)

                            link = element.find("a", href=True)
                            event_url = link["href"] if link else url
                            if event_url.startswith("/"):
                                event_url = BASE_URL + event_url

                            event_record = {
                                "source_id": source_id,
                                "venue_id": venue_id,
                                "title": title,
                                "description": f"Event at Atlantic Station, Atlanta's premier mixed-use destination",
                                "start_date": start_date,
                                "start_time": start_time,
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
                                "source_url": event_url,
                                "ticket_url": event_url,
                                "image_url": None,
                                "raw_text": text[:500],
                                "extraction_confidence": 0.75,
                                "is_recurring": False,
                                "recurrence_rule": None,
                                "content_hash": content_hash,
                            }

                            try:
                                insert_event(event_record)
                                events_new += 1
                                logger.info(f"Added: {title} on {start_date}")
                            except Exception as e:
                                logger.error(f"Failed to insert: {title}: {e}")

                        except Exception as e:
                            logger.debug(f"Error parsing event: {e}")
                            continue

                    if events_found > 4:
                        break

                if events_found > 4:
                    break

            except requests.RequestException:
                continue

        logger.info(f"Atlantic Station crawl complete: {events_found} found, {events_new} new, {events_updated} updated")

    except Exception as e:
        logger.error(f"Failed to crawl Atlantic Station: {e}")
        raise

    return events_found, events_new, events_updated
