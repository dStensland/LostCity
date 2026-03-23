"""
Crawler for Park Tavern at Piedmont Park.
Sports bar with outdoor patio overlooking Piedmont Park - UGA football watch party HQ.
Also generates recurring Sunday live music events.
"""

import json
import logging
from datetime import datetime, timedelta
from urllib.parse import urljoin
from typing import Optional
from bs4 import BeautifulSoup
import requests

from sources._sports_bar_common import detect_sports_watch_party
from db import get_or_create_venue, insert_event, find_event_by_hash, find_existing_event_for_insert, smart_update_existing_event
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://www.parktavern.com"
EVENTS_URL = f"{BASE_URL}/events"

VENUE_DATA = {
    "name": "Park Tavern",
    "slug": "park-tavern",
    "address": "500 10th Street NE",
    "neighborhood": "Midtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30309",
    "lat": 33.7821,
    "lng": -84.3692,
    "venue_type": "restaurant",
    "website": BASE_URL,
}


def parse_jsonld_events(soup: BeautifulSoup) -> list[dict]:
    """Extract Event data from JSON-LD scripts."""
    events = []
    scripts = soup.find_all("script", type="application/ld+json")

    for script in scripts:
        try:
            data = json.loads(script.string)
            if isinstance(data, dict):
                if data.get("@type") == "Event":
                    events.append(data)
                if "@graph" in data:
                    events.extend([e for e in data["@graph"] if e.get("@type") == "Event"])
            elif isinstance(data, list):
                events.extend([e for e in data if e.get("@type") == "Event"])
        except (json.JSONDecodeError, TypeError):
            continue

    return events


def parse_event_links_from_html(html: str) -> list[str]:
    soup = BeautifulSoup(html, "html.parser")
    links: list[str] = []
    for anchor in soup.find_all("a", href=True):
        href = anchor["href"].strip()
        if "/event/" not in href:
            continue
        if not href.startswith("http"):
            href = urljoin(BASE_URL, href)
        if href not in links:
            links.append(href)
    return links


def parse_detail_page(html: str, source_url: str) -> Optional[dict]:
    soup = BeautifulSoup(html, "html.parser")
    events = parse_jsonld_events(soup)
    if not events:
        return None

    event_data = events[0]
    title = (event_data.get("name") or "").strip()
    if not title:
        return None

    start_raw = (event_data.get("startDate") or "").strip()
    if not start_raw:
        return None

    start_dt = datetime.strptime(start_raw[:19], "%Y-%m-%d %H:%M:%S")
    start_date = start_dt.strftime("%Y-%m-%d")
    start_time = start_dt.strftime("%H:%M")

    end_raw = (event_data.get("endDate") or "").strip()
    end_date = None
    end_time = None
    if end_raw:
        end_dt = datetime.strptime(end_raw[:19], "%Y-%m-%d %H:%M:%S")
        end_date = end_dt.strftime("%Y-%m-%d")
        end_time = end_dt.strftime("%H:%M")

    description_html = event_data.get("description") or ""
    description = " ".join(BeautifulSoup(description_html, "html.parser").get_text(" ").split())

    watch_party = detect_sports_watch_party(title, description, extra_tags=["piedmont-park"])
    if watch_party:
        category, subcategory, tags = watch_party
    elif "sports/" in source_url:
        category, subcategory, tags = "sports", "watch_party", ["sports", "watch-party", "piedmont-park"]
    elif any(word in title.lower() for word in ["trivia", "bingo"]):
        category, subcategory = "nightlife", "trivia"
        tags = ["nightlife", "trivia", "piedmont-park"]
    else:
        category, subcategory = "nightlife", "bar_event"
        tags = ["nightlife", "piedmont-park"]

    ticket_url = None
    for anchor in soup.find_all("a", href=True):
        link_text = " ".join(anchor.get_text(" ", strip=True).split()).lower()
        href = anchor["href"].strip()
        if "ticket" in link_text or "buy" in link_text:
            ticket_url = href
            break

    image_url = None
    image = event_data.get("image")
    if isinstance(image, list) and image:
        image_url = image[0]
    elif isinstance(image, str):
        image_url = image

    return {
        "title": title,
        "description": description[:500] if description else "Event at Park Tavern overlooking Piedmont Park",
        "start_date": start_date,
        "start_time": start_time,
        "end_date": end_date,
        "end_time": end_time,
        "category": category,
        "subcategory": subcategory,
        "tags": tags,
        "is_free": False if ticket_url else True,
        "source_url": source_url,
        "ticket_url": ticket_url,
        "image_url": image_url,
        "raw_text": json.dumps(event_data),
    }


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Park Tavern events."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
    }

    try:
        response = requests.get(EVENTS_URL, headers=headers, timeout=30)
        response.raise_for_status()

        soup = BeautifulSoup(response.text, "html.parser")
        venue_id = get_or_create_venue(VENUE_DATA)

        event_links = parse_event_links_from_html(response.text)

        for event_url in event_links:
            detail_response = requests.get(event_url, headers=headers, timeout=30)
            if not detail_response.ok:
                continue

            parsed = parse_detail_page(detail_response.text, event_url)
            if not parsed:
                continue

            events_found += 1
            title = parsed["title"]
            start_date = parsed["start_date"]

            content_hash = generate_content_hash(title, VENUE_DATA["name"], start_date)

            event_record = {
                "source_id": source_id,
                "venue_id": venue_id,
                "title": title,
                "description": parsed["description"],
                "start_date": start_date,
                "start_time": parsed["start_time"],
                "end_date": parsed["end_date"],
                "end_time": parsed["end_time"],
                "is_all_day": False,
                "category": parsed["category"],
                "subcategory": parsed["subcategory"],
                "tags": parsed["tags"],
                "price_min": None,
                "price_max": None,
                "price_note": None,
                "is_free": parsed["is_free"],
                "source_url": parsed["source_url"],
                "ticket_url": parsed["ticket_url"],
                "image_url": parsed["image_url"],
                "raw_text": parsed["raw_text"],
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
            except Exception as e:
                logger.error(f"Failed to insert {title}: {e}")

        logger.info(f"Park Tavern website: {events_found} found, {events_new} new, {events_updated} updated")

    except Exception as e:
        logger.error(f"Failed to crawl Park Tavern website: {e}")

    # Generate recurring Sunday live music events
    try:
        f, n, u = _generate_recurring_events(source_id, venue_id)
        events_found += f
        events_new += n
        events_updated += u
    except Exception as e:
        logger.error(f"Failed to generate Park Tavern recurring events: {e}")

    return events_found, events_new, events_updated


WEEKS_AHEAD = 6

RECURRING_SCHEDULE = [
    {
        "day": 6,  # Sunday
        "title": "Sunday Live Music",
        "description": (
            "Sunday live music at Park Tavern overlooking Piedmont Park. "
            "Outdoor stage, craft beer, and local bands."
        ),
        "start_time": "15:00",
        "category": "music",
        "subcategory": None,
        "tags": ["live-music", "outdoor", "weekly", "family-friendly", "piedmont-park"],
    },
]

DAY_CODES = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"]
DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]


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
                "is_free": True,
                "price_min": None,
                "price_max": None,
                "source_url": EVENTS_URL,
                "ticket_url": None,
                "image_url": None,
                "raw_text": f"{template['title']} at Park Tavern - {start_date}",
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

    logger.info(f"Park Tavern recurring: {events_found} found, {events_new} new, {events_updated} updated")
    return events_found, events_new, events_updated
