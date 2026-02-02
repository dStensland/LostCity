"""
Crawler for City of Alpharetta events.
Premium suburban destination with upscale mixed-use developments and family programming.
Hosts concerts, festivals, farmers markets, and community events.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime, timedelta
from typing import Optional

import requests
from bs4 import BeautifulSoup

from db import get_or_create_venue, insert_event, find_event_by_hash
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://www.alpharetta.ga.us"

VENUE_DATA = {
    "name": "Alpharetta",
    "slug": "alpharetta-city",
    "address": "Downtown Alpharetta",
    "neighborhood": "Alpharetta",
    "city": "Alpharetta",
    "state": "GA",
    "zip": "30009",
    "lat": 34.0754,
    "lng": -84.2941,
    "venue_type": "city",
    "spot_type": "city",
    "website": BASE_URL,
    "description": "City of Alpharetta - upscale North Fulton suburb with vibrant downtown, Avalon, and family-friendly events.",
}

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
}


def get_first_saturday(year: int, month: int) -> datetime:
    """Get the first Saturday of a given month."""
    first_day = datetime(year, month, 1)
    days_until_saturday = (5 - first_day.weekday()) % 7
    return first_day + timedelta(days=days_until_saturday)


def create_recurring_events(source_id: int, venue_id: int) -> tuple[int, int]:
    """Create known recurring Alpharetta events."""
    events_new = 0
    events_updated = 0
    now = datetime.now()

    # Alpharetta Farmers Market (Saturdays, April-October)
    market_months = [4, 5, 6, 7, 8, 9, 10]
    year = now.year

    for month in market_months:
        if month < now.month and year == now.year:
            continue

        market_date = get_first_saturday(year, month)
        if market_date.date() < now.date():
            continue

        title = "Alpharetta Farmers Market"
        start_date = market_date.strftime("%Y-%m-%d")

        content_hash = generate_content_hash(title, "Alpharetta", start_date)

        if find_event_by_hash(content_hash):
            events_updated += 1
            continue

        event_record = {
            "source_id": source_id,
            "venue_id": venue_id,
            "title": title,
            "description": (
                "Weekly farmers market in downtown Alpharetta featuring local produce, "
                "artisan goods, baked items, and live music. Family-friendly with "
                "food trucks and community gathering."
            ),
            "start_date": start_date,
            "start_time": "08:00",
            "end_date": None,
            "end_time": "12:30",
            "is_all_day": False,
            "category": "community",
            "subcategory": "market",
            "tags": ["alpharetta", "farmers-market", "local", "family-friendly", "outdoor"],
            "price_min": None,
            "price_max": None,
            "price_note": None,
            "is_free": True,
            "source_url": BASE_URL,
            "ticket_url": None,
            "image_url": None,
            "raw_text": None,
            "extraction_confidence": 0.80,
            "is_recurring": True,
            "recurrence_rule": "FREQ=WEEKLY;BYDAY=SA",
            "content_hash": content_hash,
        }

        try:
            insert_event(event_record)
            events_new += 1
            logger.info(f"Added: {title} on {start_date}")
        except Exception as e:
            logger.error(f"Failed to insert market: {e}")

    # Wire & Wood Alpharetta Music Festival (October)
    year = now.year
    if now.month > 10:
        year += 1

    oct_1 = datetime(year, 10, 1)
    days_until_friday = (4 - oct_1.weekday()) % 7
    first_friday = oct_1 + timedelta(days=days_until_friday)
    festival_friday = first_friday + timedelta(days=7)  # Second Friday

    title = f"Wire & Wood Alpharetta Music Festival {year}"
    start_date = festival_friday.strftime("%Y-%m-%d")

    content_hash = generate_content_hash(title, "Alpharetta", start_date)

    if not find_event_by_hash(content_hash):
        event_record = {
            "source_id": source_id,
            "venue_id": venue_id,
            "title": title,
            "description": (
                "Annual singer-songwriter music festival in downtown Alpharetta. "
                "Multiple stages featuring acoustic artists, craft vendors, food trucks, "
                "and family activities. Celebrating guitar-driven Americana music."
            ),
            "start_date": start_date,
            "start_time": "17:00",
            "end_date": (festival_friday + timedelta(days=1)).strftime("%Y-%m-%d"),
            "end_time": "22:00",
            "is_all_day": False,
            "category": "music",
            "subcategory": "festival",
            "tags": ["alpharetta", "wire-and-wood", "music-festival", "singer-songwriter", "outdoor"],
            "price_min": None,
            "price_max": None,
            "price_note": None,
            "is_free": True,
            "source_url": "https://wireandwood.com",
            "ticket_url": None,
            "image_url": None,
            "raw_text": None,
            "extraction_confidence": 0.85,
            "is_recurring": False,
            "recurrence_rule": None,
            "content_hash": content_hash,
        }

        try:
            insert_event(event_record)
            events_new += 1
            logger.info(f"Added: {title} on {start_date}")
        except Exception as e:
            logger.error(f"Failed to insert festival: {e}")
    else:
        events_updated += 1

    return events_new, events_updated


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl City of Alpharetta events."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    venue_id = get_or_create_venue(VENUE_DATA)

    # Create recurring events
    recurring_new, recurring_updated = create_recurring_events(source_id, venue_id)
    events_found += 8  # Approximate
    events_new += recurring_new
    events_updated += recurring_updated

    # Try to fetch from city calendar
    try:
        for path in ["/recreation/events", "/events", "/calendar", "/parks-recreation/events"]:
            try:
                url = BASE_URL + path
                response = requests.get(url, headers=HEADERS, timeout=30)
                if response.status_code != 200:
                    continue

                soup = BeautifulSoup(response.text, "html.parser")
                event_elements = soup.select(".event, .calendar-event, article, [class*='event']")

                for element in event_elements:
                    try:
                        title_elem = element.find(["h2", "h3", "h4", "a"])
                        if not title_elem:
                            continue
                        title = title_elem.get_text(strip=True)
                        if not title or len(title) < 3:
                            continue

                        # Skip already handled
                        if "farmers market" in title.lower() or "wire" in title.lower():
                            continue

                        text = element.get_text()
                        date_match = re.search(
                            r"(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}",
                            text, re.IGNORECASE
                        )
                        if not date_match:
                            continue

                        # Parse date
                        now = datetime.now()
                        month_str = date_match.group()[:3]
                        day_match = re.search(r"(\d{1,2})", date_match.group())
                        if not day_match:
                            continue
                        try:
                            dt = datetime.strptime(f"{month_str} {day_match.group(1)} {now.year}", "%b %d %Y")
                            if dt.date() < now.date():
                                dt = dt.replace(year=now.year + 1)
                            start_date = dt.strftime("%Y-%m-%d")
                        except ValueError:
                            continue

                        events_found += 1
                        content_hash = generate_content_hash(title, "Alpharetta", start_date)

                        if find_event_by_hash(content_hash):
                            events_updated += 1
                            continue

                        event_record = {
                            "source_id": source_id,
                            "venue_id": venue_id,
                            "title": title,
                            "description": f"City of Alpharetta event",
                            "start_date": start_date,
                            "start_time": None,
                            "end_date": None,
                            "end_time": None,
                            "is_all_day": True,
                            "category": "community",
                            "subcategory": None,
                            "tags": ["alpharetta", "community"],
                            "price_min": None,
                            "price_max": None,
                            "price_note": None,
                            "is_free": True,
                            "source_url": url,
                            "ticket_url": None,
                            "image_url": None,
                            "raw_text": text[:500],
                            "extraction_confidence": 0.70,
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

                break
            except requests.RequestException:
                continue

    except Exception as e:
        logger.error(f"Error fetching city calendar: {e}")

    logger.info(f"Alpharetta City crawl complete: {events_found} found, {events_new} new, {events_updated} updated")

    return events_found, events_new, events_updated
