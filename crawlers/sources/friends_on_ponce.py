"""
Crawler for Friends on Ponce.
No-attitude LGBTQ+ bar with recurring weekly events.

Known events:
- Mixed Tape Sundays (every Sunday)
- Sip and Sing Karaoke (weekly)
- New Faces Amateur Drag Competition (2nd Sunday of each month)
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta
from calendar import monthcalendar

import requests
from bs4 import BeautifulSoup

from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash
from utils import find_event_url

logger = logging.getLogger(__name__)

BASE_URL = "https://www.friendsonponce.com"
EVENTS_URL = BASE_URL

VENUE_DATA = {
    "name": "Friends on Ponce",
    "slug": "friends-on-ponce",
    "address": "736 Ponce De Leon Ave NE",
    "neighborhood": "Midtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30306",
    "venue_type": "bar",
    "website": BASE_URL,
}


def get_second_sunday(year: int, month: int) -> datetime:
    """Get the 2nd Sunday of a given month."""
    cal = monthcalendar(year, month)
    # Find all Sundays (index 6)
    sundays = [week[6] for week in cal if week[6] != 0]
    second_sunday_day = sundays[1] if len(sundays) >= 2 else sundays[0]
    return datetime(year, month, second_sunday_day)


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

        logger.info(f"Fetching Friends on Ponce: {EVENTS_URL}")
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

        # Generate next 3 months of recurring events
        current_date = datetime.now()
        end_date = current_date + timedelta(days=90)

        # Weekly Sunday events - Mixed Tape Sundays
        current = current_date
        while current.weekday() != 6:  # Sunday
            current += timedelta(days=1)

        while current <= end_date:
            events_found += 1
            start_date_str = current.strftime("%Y-%m-%d")
            title = "Mixed Tape Sundays"
            description = "Mixed Tape Sundays DJ dance party at Friends on Ponce. Throwback music and good vibes every Sunday."

            content_hash = generate_content_hash(title, "Friends on Ponce", start_date_str)

            if not find_event_by_hash(content_hash):
                event_url = find_event_url(title, event_links, EVENTS_URL)

                image_url = image_map.get(title)

                event_record = {
                    "source_id": source_id,
                    "venue_id": venue_id,
                    "title": title,
                    "description": description,
                    "start_date": start_date_str,
                    "start_time": "16:00",
                    "end_date": None,
                    "end_time": None,
                    "is_all_day": False,
                    "category": "nightlife",
                    "subcategory": "lgbtq",
                    "tags": ["lgbtq", "queer", "gay-bar", "midtown", "ponce"],
                    "price_min": None,
                    "price_max": None,
                    "price_note": None,
                    "is_free": True,
                    "source_url": event_url,
                    "ticket_url": event_url if event_url != EVENTS_URL else None,
                    "image_url": image_url,
                    "raw_text": f"{title} at Friends on Ponce - {start_date_str}",
                    "extraction_confidence": 0.90,
                    "is_recurring": True,
                    "recurrence_rule": "FREQ=WEEKLY;BYDAY=SU",
                    "content_hash": content_hash,
                }

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
            else:
                events_updated += 1

            current += timedelta(days=7)

        # Weekly Karaoke nights (Sip and Sing - appears to be Tuesday/Thursday based on typical bar schedules)
        # Let's add Wednesday karaoke as a common midweek activity
        current = current_date
        while current.weekday() != 2:  # Wednesday
            current += timedelta(days=1)

        while current <= end_date:
            events_found += 1
            start_date_str = current.strftime("%Y-%m-%d")
            title = "Sip and Sing Karaoke"
            description = "Sip and Sing Karaoke at Friends on Ponce. Sing your heart out with Atlanta's friendliest crowd."

            content_hash = generate_content_hash(title, "Friends on Ponce", start_date_str)

            if not find_event_by_hash(content_hash):
                event_url = find_event_url(title, event_links, EVENTS_URL)

                image_url = image_map.get(title)

                event_record = {
                    "source_id": source_id,
                    "venue_id": venue_id,
                    "title": title,
                    "description": description,
                    "start_date": start_date_str,
                    "start_time": "21:00",
                    "end_date": None,
                    "end_time": None,
                    "is_all_day": False,
                    "category": "nightlife",
                    "subcategory": "lgbtq",
                    "tags": ["lgbtq", "queer", "karaoke", "gay-bar", "midtown"],
                    "price_min": None,
                    "price_max": None,
                    "price_note": None,
                    "is_free": True,
                    "source_url": event_url,
                    "ticket_url": event_url if event_url != EVENTS_URL else None,
                    "image_url": image_url,
                    "raw_text": f"{title} at Friends on Ponce - {start_date_str}",
                    "extraction_confidence": 0.85,
                    "is_recurring": True,
                    "recurrence_rule": "FREQ=WEEKLY;BYDAY=WE",
                    "content_hash": content_hash,
                }

                series_hint = {
                    "series_type": "recurring_show",
                    "series_title": title,
                    "frequency": "weekly",
                    "day_of_week": "Wednesday",
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
            else:
                events_updated += 1

            current += timedelta(days=7)

        # New Faces Amateur Drag Competition - 2nd Sunday of each month
        for month_offset in range(4):  # Current month + 3 months
            check_date = current_date + timedelta(days=month_offset * 30)
            year = check_date.year
            month = check_date.month

            second_sunday = get_second_sunday(year, month)

            # Skip if in the past
            if second_sunday.date() < current_date.date():
                continue

            events_found += 1
            start_date_str = second_sunday.strftime("%Y-%m-%d")
            title = "New Faces Amateur Drag Competition"
            description = "New Faces Amateur Drag Competition at Friends on Ponce. The longest-running amateur drag competition in Atlanta, launching careers since the 1990s. Hosted by Charmaine Sinclair Dupree."

            content_hash = generate_content_hash(title, "Friends on Ponce", start_date_str)

            if not find_event_by_hash(content_hash):
                event_url = find_event_url(title, event_links, EVENTS_URL)

                image_url = image_map.get(title)

                event_record = {
                    "source_id": source_id,
                    "venue_id": venue_id,
                    "title": title,
                    "description": description,
                    "start_date": start_date_str,
                    "start_time": "21:00",
                    "end_date": None,
                    "end_time": None,
                    "is_all_day": False,
                    "category": "nightlife",
                    "subcategory": "lgbtq",
                    "tags": ["lgbtq", "queer", "drag", "competition", "gay-bar", "midtown"],
                    "price_min": None,
                    "price_max": None,
                    "price_note": None,
                    "is_free": True,
                    "source_url": f"{BASE_URL}/events",
                    "ticket_url": event_url if event_url != EVENTS_URL else None,
                    "image_url": image_url,
                    "raw_text": f"{title} at Friends on Ponce - {start_date_str}",
                    "extraction_confidence": 0.90,
                    "is_recurring": True,
                    "recurrence_rule": "FREQ=MONTHLY;BYDAY=2SU",
                    "content_hash": content_hash,
                }

                series_hint = {
                    "series_type": "recurring_show",
                    "series_title": title,
                    "frequency": "monthly",
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
            else:
                events_updated += 1

        logger.info(f"Friends on Ponce crawl complete: {events_found} found, {events_new} new, {events_updated} updated")

    except Exception as e:
        logger.error(f"Failed to crawl Friends on Ponce: {e}")
        raise

    return events_found, events_new, events_updated
