"""
Crawler for Red Light Cafe (redlightcafe.com).

Site uses Squarespace summary blocks with JavaScript rendering - requires Playwright.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime, timedelta
from typing import Optional

from playwright.sync_api import sync_playwright

from db import get_or_create_venue, insert_event, find_event_by_hash, find_existing_event_for_insert, smart_update_existing_event
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://redlightcafe.com"
EVENTS_URL = f"{BASE_URL}/calendar"

VENUE_DATA = {
    "name": "Red Light Cafe",
    "slug": "red-light-cafe",
    "address": "553 Amsterdam Ave NE",
    "neighborhood": "Midtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30306",
    "lat": 33.7789,
    "lng": -84.3734,
    "venue_type": "music_venue",
    "spot_type": "music_venue",
    "website": BASE_URL,
    "vibes": ["live-music", "intimate", "acoustic", "singer-songwriter"],
}


def parse_time(text: str) -> Optional[str]:
    """Parse time from excerpt text like 'WED • FEB 4 • 9 PM' or '9:00 PM'."""
    # Look for patterns like "9 PM", "9:00 PM", "10:30 PM"
    match = re.search(r"(\d{1,2})(?::(\d{2}))?\s*(AM|PM)", text, re.IGNORECASE)
    if match:
        hour = int(match.group(1))
        minute = match.group(2) if match.group(2) else "00"
        period = match.group(3).upper()

        if period == "PM" and hour != 12:
            hour += 12
        elif period == "AM" and hour == 12:
            hour = 0

        return f"{hour:02d}:{minute}"
    return None


def parse_price(text: str) -> tuple[Optional[float], Optional[float], Optional[str]]:
    """Parse price from excerpt text."""
    # Look for patterns like "$15", "$20-$25", "FREE"
    if re.search(r"\bFREE\b", text, re.IGNORECASE):
        return None, None, "Free"

    # Look for dollar amounts
    prices = re.findall(r"\$(\d+(?:\.\d{2})?)", text)
    if prices:
        prices = [float(p) for p in prices]
        if len(prices) == 1:
            return prices[0], prices[0], f"${prices[0]:.0f}"
        elif len(prices) > 1:
            return min(prices), max(prices), f"${min(prices):.0f}-${max(prices):.0f}"

    return None, None, None


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Red Light Cafe events using Playwright."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
                viewport={"width": 1920, "height": 1080},
            )
            page = context.new_page()

            venue_id = get_or_create_venue(VENUE_DATA)

            logger.info(f"Fetching Red Light Cafe: {EVENTS_URL}")
            page.goto(EVENTS_URL, wait_until="domcontentloaded", timeout=30000)

            # Wait for summary blocks to load
            page.wait_for_selector(".summary-item-record-type-event", timeout=10000)
            page.wait_for_timeout(2000)

            # Scroll to load all events
            for _ in range(3):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1000)

            # Get all event cards
            event_cards = page.query_selector_all(".summary-item-record-type-event")
            logger.info(f"Found {len(event_cards)} event cards")

            for card in event_cards:
                try:
                    # Extract title and URL
                    title_link = card.query_selector("a.summary-title-link")
                    if not title_link:
                        continue

                    title = title_link.inner_text().strip()
                    event_url = title_link.get_attribute("href")
                    if event_url and not event_url.startswith("http"):
                        event_url = f"{BASE_URL}{event_url}"

                    # Extract date from time element
                    date_elem = card.query_selector("time.summary-metadata-item--date")
                    if not date_elem:
                        continue

                    # Try datetime attribute first (ISO format), then text content
                    date_str = date_elem.get_attribute("datetime")
                    dt = None
                    if date_str:
                        try:
                            dt = datetime.fromisoformat(date_str.split("T")[0])
                        except ValueError:
                            pass

                    if not dt:
                        # Parse from text content (e.g., "Feb 4, 2026")
                        date_text = date_elem.inner_text().strip()
                        for fmt in ("%b %d, %Y", "%B %d, %Y", "%b %d %Y", "%B %d %Y"):
                            try:
                                dt = datetime.strptime(date_text, fmt)
                                break
                            except ValueError:
                                continue

                    if not dt:
                        continue

                    start_date = dt.strftime("%Y-%m-%d")

                    # Skip past events
                    if dt.date() < datetime.now().date():
                        continue

                    # Extract excerpt (contains time, price, description)
                    excerpt = ""
                    excerpt_elem = card.query_selector(".summary-excerpt")
                    if excerpt_elem:
                        excerpt = excerpt_elem.inner_text().strip()

                    # Parse time from excerpt
                    start_time = parse_time(excerpt)

                    # Parse price from excerpt
                    price_min, price_max, price_note = parse_price(excerpt)
                    is_free = price_note == "Free"

                    # Extract image
                    image_url = None
                    img_elem = card.query_selector("img.summary-thumbnail-image")
                    if img_elem:
                        image_url = img_elem.get_attribute("src")
                        if image_url and not image_url.startswith("http"):
                            image_url = f"https:{image_url}" if image_url.startswith("//") else f"{BASE_URL}{image_url}"

                    events_found += 1

                    # Generate content hash for deduplication
                    content_hash = generate_content_hash(title, "Red Light Cafe", start_date)


                    # Build event record
                    event_record = {
                        "source_id": source_id,
                        "venue_id": venue_id,
                        "title": title,
                        "description": excerpt if excerpt else None,
                        "start_date": start_date,
                        "start_time": start_time,
                        "end_date": None,
                        "end_time": None,
                        "is_all_day": False,
                        "category": "music",
                        "subcategory": "live",
                        "tags": ["red-light-cafe", "midtown", "live-music", "acoustic"],
                        "price_min": price_min,
                        "price_max": price_max,
                        "price_note": price_note,
                        "is_free": is_free,
                        "source_url": event_url or EVENTS_URL,
                        "ticket_url": event_url or EVENTS_URL,
                        "image_url": image_url,
                        "raw_text": f"{title}\n{excerpt}",
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

                    insert_event(event_record)
                    events_new += 1
                    logger.info(f"Added: {title} on {start_date} at {start_time or 'TBD'}")

                except Exception as e:
                    logger.error(f"Failed to parse event card: {e}")
                    continue

            browser.close()

        logger.info(
            f"Red Light Cafe website: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Red Light Cafe website: {e}")

    # Generate recurring weekly events
    try:
        f, n, u = _generate_recurring_events(source_id, venue_id)
        events_found += f
        events_new += n
        events_updated += u
    except Exception as e:
        logger.error(f"Failed to generate Red Light Cafe recurring events: {e}")

    return events_found, events_new, events_updated


WEEKS_AHEAD = 6
DAY_CODES = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"]
DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

RECURRING_SCHEDULE = [
    {
        "day": 2,  # Wednesday
        "title": "Wednesday Jazz Jam",
        "description": "Wednesday jazz jam at Red Light Cafe with the Gordon Vernick Quartet. Quartet performs then opens the stage. $10 door, $5 for performers/students.",
        "start_time": "21:00",
        "category": "music",
        "subcategory": None,
        "tags": ["jazz", "open-jam", "live-music", "weekly"],
    },
]


def _get_next_weekday(start_date: datetime, weekday: int) -> datetime:
    days_ahead = weekday - start_date.weekday()
    if days_ahead < 0:
        days_ahead += 7
    return start_date + timedelta(days=days_ahead)


def _generate_recurring_events(source_id: int, venue_id: int) -> tuple[int, int, int]:
    events_found = events_new = events_updated = 0
    today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)

    for template in RECURRING_SCHEDULE:
        next_date = _get_next_weekday(today, template["day"])
        day_code = DAY_CODES[template["day"]]
        day_name = DAY_NAMES[template["day"]]

        series_hint = {
            "series_type": "recurring_show",
            "series_title": template["title"],
            "frequency": "weekly",
            "day_of_week": day_name,
            "description": template["description"],
        }

        for week in range(WEEKS_AHEAD):
            event_date = next_date + timedelta(weeks=week)
            start_date = event_date.strftime("%Y-%m-%d")
            events_found += 1

            content_hash = generate_content_hash(
                template["title"], VENUE_DATA["name"], start_date
            )

            event_record = {
                "source_id": source_id,
                "venue_id": venue_id,
                "title": template["title"],
                "description": template["description"],
                "start_date": start_date,
                "start_time": template["start_time"],
                "end_date": None,
                "end_time": None,
                "is_all_day": False,
                "category": template["category"],
                "subcategory": template.get("subcategory"),
                "tags": template["tags"],
                "is_free": False,
                "price_min": 10.0,
                "price_max": 10.0,
                "price_note": "$10 door, $5 performers/students",
                "source_url": BASE_URL,
                "ticket_url": None,
                "image_url": None,
                "raw_text": f"{template['title']} at Red Light Cafe - {start_date}",
                "extraction_confidence": 0.90,
                "is_recurring": True,
                "recurrence_rule": f"FREQ=WEEKLY;BYDAY={day_code}",
                "content_hash": content_hash,
            }

            existing = find_existing_event_for_insert(event_record)
            if existing:
                smart_update_existing_event(existing, event_record)
                events_updated += 1
                continue

            try:
                insert_event(event_record, series_hint=series_hint)
                events_new += 1
            except Exception as exc:
                logger.error(f"Failed to insert {template['title']} on {start_date}: {exc}")

    logger.info(f"Red Light Cafe recurring: {events_found} found, {events_new} new, {events_updated} updated")
    return events_found, events_new, events_updated
