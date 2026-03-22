"""
Crawler for Grant Park Farmers Market.
Weekly community farmers market - Sundays 9:30am-1:30pm, April through November.

Located in Grant Park near the Zoo Atlanta parking lot.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta

import requests
from bs4 import BeautifulSoup

from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash
from utils import find_event_url

logger = logging.getLogger(__name__)

BASE_URL = "https://www.grantparkmarket.org"
EVENTS_URL = BASE_URL

VENUE_DATA = {
    "name": "Grant Park Farmers Market",
    "slug": "grant-park-farmers-market",
    "address": "551 Boulevard SE",
    "neighborhood": "Grant Park",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30312",
    "venue_type": "market",
    "website": BASE_URL,
}


def generate_market_dates(year: int, start_month: int, start_day: int, end_month: int, end_day: int, weekday: int) -> list[datetime]:
    """Generate all market dates for a season."""
    start_date = datetime(year, start_month, start_day)
    end_date = datetime(year, end_month, end_day)

    dates = []
    current = start_date

    while current.weekday() != weekday:
        current += timedelta(days=1)

    while current <= end_date:
        dates.append(current)
        current += timedelta(days=7)

    return dates


def _extract_images_from_soup(soup: BeautifulSoup) -> dict[str, str]:
    image_map: dict[str, str] = {}
    for img in soup.find_all("img"):
        alt = img.get("alt") or img.get("title") or ""
        src = img.get("src") or img.get("data-src") or ""
        if alt and src and len(alt) > 3 and not any(x in src.lower() for x in ["logo", "icon", "sprite"]):
            image_map[alt.strip()] = src
    return image_map


def _extract_event_links_from_soup(soup: BeautifulSoup, base_url: str) -> dict[str, str]:
    skip_words = ["view more", "learn more", "read more", "see all", "donate", "subscribe",
                  "sign up", "log in", "register", "contact", "about", "home", "menu", "search"]
    event_links: dict[str, str] = {}
    for a in soup.find_all("a", href=True):
        href = a.get("href", "")
        text = a.get_text(strip=True)
        if not href or not text or len(text) < 3:
            continue
        if href.startswith("#") or href.startswith("javascript:"):
            continue
        text_lower = text.lower()
        if any(skip in text_lower for skip in skip_words):
            continue
        if not href.startswith("http"):
            href = base_url.rstrip("/") + href if href.startswith("/") else base_url.rstrip("/") + "/" + href
        event_links[text_lower] = href
    return event_links


def crawl(source: dict) -> tuple[int, int, int]:
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        venue_id = get_or_create_venue(VENUE_DATA)

        logger.info(f"Fetching Grant Park Farmers Market: {EVENTS_URL}")
        response = requests.get(
            EVENTS_URL,
            headers={"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"},
            timeout=30,
        )
        response.raise_for_status()
        soup = BeautifulSoup(response.text, "html.parser")

        # Extract images from page
        image_map = _extract_images_from_soup(soup)

        # Extract event links for specific URLs
        event_links = _extract_event_links_from_soup(soup, BASE_URL)

        # Grant Park Market: Sundays 9:30am-1:30pm, April - November
        current_year = datetime.now().year

        for year in [current_year, current_year + 1]:
            market_dates = generate_market_dates(
                year=year,
                start_month=4, start_day=1,    # April 1
                end_month=11, end_day=30,      # November 30
                weekday=6  # Sunday
            )

            for market_date in market_dates:
                if market_date.date() < datetime.now().date():
                    continue

                if market_date > datetime.now() + timedelta(days=180):
                    continue

                events_found += 1
                start_date_str = market_date.strftime("%Y-%m-%d")
                title = "Grant Park Farmers Market"

                content_hash = generate_content_hash(title, "Grant Park Farmers Market", start_date_str)

                event_url = find_event_url(title, event_links, EVENTS_URL)

                description = "Community farmers market in Grant Park featuring fresh produce, prepared foods, live music, and local artisans. Dog-friendly and family-friendly!"
                image_url = image_map.get(title)

                event_record = {
                    "source_id": source_id,
                    "venue_id": venue_id,
                    "title": title,
                    "description": description,
                    "start_date": start_date_str,
                    "start_time": "09:30",
                    "end_date": start_date_str,
                    "end_time": "13:30",
                    "is_all_day": False,
                    "category": "food_drink",
                    "subcategory": "farmers_market",
                    "tags": ["farmers-market", "local-food", "grant-park", "outdoor", "family-friendly", "dog-friendly"],
                    "price_min": None,
                    "price_max": None,
                    "price_note": "Free admission",
                    "is_free": True,
                    "source_url": event_url,
                    "ticket_url": event_url if event_url != EVENTS_URL else None,
                    "image_url": image_url,
                    "raw_text": f"Grant Park Farmers Market - {start_date_str} 9:30am-1:30pm",
                    "extraction_confidence": 0.95,
                    "is_recurring": True,
                    "recurrence_rule": "FREQ=WEEKLY;BYDAY=SU",
                    "content_hash": content_hash,
                }

                existing = find_event_by_hash(content_hash)
                if existing:
                    smart_update_existing_event(existing, event_record)
                    events_updated += 1
                    continue

                series_hint = {
                    "series_type": "recurring_show",
                    "series_title": title,
                    "frequency": "weekly",
                    "day_of_week": "Sunday",
                    "description": description,
                }
                if image_url:
                    series_hint["image_url"] = image_url

                try:
                    insert_event(event_record, series_hint=series_hint)
                    events_new += 1
                    logger.info(f"Added: {title} on {start_date_str}")
                except Exception as e:
                    logger.error(f"Failed to insert: {title}: {e}")

        logger.info(f"Grant Park Farmers Market crawl complete: {events_found} found, {events_new} new, {events_updated} updated")

    except Exception as e:
        logger.error(f"Failed to crawl Grant Park Farmers Market: {e}")
        raise

    return events_found, events_new, events_updated
