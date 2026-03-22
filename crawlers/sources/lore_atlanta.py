"""
Crawler for Lore Atlanta.
New LGBTQ+ club with dancing, drag shows, karaoke, and crafting nights.

Recurring weekly events:
- Tuesday: Karaoke @ 8pm
- Wednesday: Trivia @ 8pm
- Thursday: Drag Bingo @ 8pm
- Friday: The Other Show @ 9pm
- Sunday: Tossed Salad @ 9pm
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

BASE_URL = "https://loreatl.com"
EVENTS_URL = BASE_URL

VENUE_DATA = {
    "name": "Lore Atlanta",
    "slug": "lore-atlanta",
    "address": "466 Edgewood Ave SE",
    "neighborhood": "Edgewood",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30312",
    "venue_type": "bar",
    "spot_type": "bar",
    "website": BASE_URL,
    "vibes": ["lgbtq-friendly", "drag", "karaoke", "edgewood", "late-night"],
}

# Weekly recurring events
WEEKLY_EVENTS = [
    {"weekday": 1, "title": "Karaoke at Lore Atlanta", "time": "20:00", "subcategory": "nightlife.karaoke",
     "description": "Tuesday karaoke night at Lore Atlanta on Edgewood Ave. LGBTQ+ club with full bar and late-night vibes."},
    {"weekday": 2, "title": "Trivia at Lore Atlanta", "time": "20:00", "subcategory": "nightlife.trivia",
     "description": "Wednesday trivia night at Lore Atlanta on Edgewood Ave. Test your knowledge at this LGBTQ+ nightlife spot."},
    {"weekday": 3, "title": "Drag Bingo at Lore Atlanta", "time": "20:00", "subcategory": "nightlife.bingo",
     "description": "Thursday drag bingo at Lore Atlanta hosted by Tugboat. Prizes, cocktails, and fabulous hosts on Edgewood Ave."},
    {"weekday": 4, "title": "The Other Show at Lore Atlanta", "time": "21:00", "subcategory": "nightlife.drag",
     "description": "Friday drag and variety show at Lore Atlanta on Edgewood Ave. Live performances from Atlanta's queens."},
    {"weekday": 6, "title": "Tossed Salad at Lore Atlanta", "time": "21:00", "subcategory": "nightlife.drag",
     "description": "Sunday night drag show at Lore Atlanta on Edgewood Ave. End the weekend with Atlanta's best drag performers."},
]


def format_time_label(time_24: str | None) -> str | None:
    if not time_24:
        return None
    raw = str(time_24).strip()
    if not raw:
        return None
    for fmt in ("%H:%M", "%H:%M:%S"):
        try:
            return datetime.strptime(raw, fmt).strftime("%-I:%M %p")
        except ValueError:
            continue
    return raw


def build_lore_description(
    *,
    title: str,
    base_description: str,
    start_date: str,
    start_time: str | None,
    source_url: str,
) -> str:
    time_label = format_time_label(start_time)
    parts: list[str] = []
    desc = (base_description or "").strip()
    if desc:
        parts.append(desc if desc.endswith(".") else f"{desc}.")
    else:
        parts.append(f"{title} at Lore Atlanta.")
    parts.append("Location: Lore Atlanta, Edgewood, Atlanta, GA.")
    if start_date and time_label:
        parts.append(f"Scheduled on {start_date} at {time_label}.")
    elif start_date:
        parts.append(f"Scheduled on {start_date}.")
    parts.append("Lore Atlanta is an LGBTQ+ nightlife venue featuring drag, dance, karaoke, and variety programming.")
    if source_url:
        parts.append(f"Check Lore's official listing for host lineup updates, cover details, and entry policy ({source_url}).")
    return " ".join(parts)[:1400]


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

        logger.info(f"Fetching Lore Atlanta: {EVENTS_URL}")
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

        for event_info in WEEKLY_EVENTS:
            weekday = event_info["weekday"]
            title = event_info["title"]
            time = event_info["time"]
            description = event_info["description"]

            # Find the next occurrence of this weekday
            current = current_date
            while current.weekday() != weekday:
                current += timedelta(days=1)

            # Generate all occurrences
            while current <= end_date:
                events_found += 1
                start_date_str = current.strftime("%Y-%m-%d")

                content_hash = generate_content_hash(title, "Lore Atlanta", start_date_str)

                if find_event_by_hash(content_hash):
                    events_updated += 1
                    current += timedelta(days=7)
                    continue

                event_url = find_event_url(title, event_links, EVENTS_URL)

                image_url = image_map.get(title)

                event_record = {
                    "source_id": source_id,
                    "venue_id": venue_id,
                    "title": title,
                    "description": build_lore_description(
                        title=title,
                        base_description=description,
                        start_date=start_date_str,
                        start_time=time,
                        source_url=event_url,
                    ),
                    "start_date": start_date_str,
                    "start_time": time,
                    "end_date": None,
                    "end_time": None,
                    "is_all_day": False,
                    "category": "nightlife",
                    "subcategory": event_info.get("subcategory"),
                    "tags": ["lgbtq", "queer", "drag", "edgewood", "nightlife"],
                    "price_min": None,
                    "price_max": None,
                    "price_note": None,
                    "is_free": True,
                    "source_url": event_url,
                    "ticket_url": event_url if event_url and event_url != EVENTS_URL else None,
                    "image_url": image_url,
                    "raw_text": f"{title} at Lore Atlanta - {start_date_str}",
                    "extraction_confidence": 0.90,
                    "is_recurring": True,
                    "recurrence_rule": f"FREQ=WEEKLY;BYDAY={['MO','TU','WE','TH','FR','SA','SU'][weekday]}",
                    "content_hash": content_hash,
                }

                day_names = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
                series_hint = {
                    "series_type": "recurring_show",
                    "series_title": title,
                    "frequency": "weekly",
                    "day_of_week": day_names[weekday],
                    "description": build_lore_description(
                        title=title,
                        base_description=description,
                        start_date=start_date_str,
                        start_time=time,
                        source_url=event_url,
                    ),
                }
                if image_url:
                    series_hint["image_url"] = image_url

                try:
                    insert_event(event_record, series_hint=series_hint)
                    events_new += 1
                    logger.info(f"Added: {title} on {start_date_str}")
                except Exception as e:
                    logger.error(f"Failed to insert: {title}: {e}")

                current += timedelta(days=7)

        logger.info(f"Lore Atlanta crawl complete: {events_found} found, {events_new} new, {events_updated} updated")

    except Exception as e:
        logger.error(f"Failed to crawl Lore Atlanta: {e}")
        raise

    return events_found, events_new, events_updated
