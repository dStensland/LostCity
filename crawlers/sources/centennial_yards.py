"""
Crawler for Centennial Yards development updates and events.

Pulls from public WordPress JSON endpoints:
- /wp-json/wp/v2/events (onsite events)
- /wp-json/wp/v2/news (launch/opening announcements)
"""

from __future__ import annotations

import html
import logging
import re
from datetime import datetime, timedelta, date
from typing import Optional

import requests
from bs4 import BeautifulSoup

from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://centennialyards.com"
EVENTS_API_URL = f"{BASE_URL}/wp-json/wp/v2/events"
NEWS_API_URL = f"{BASE_URL}/wp-json/wp/v2/news"

VENUE_DATA = {
    "name": "Centennial Yards",
    "slug": "centennial-yards",
    "address": "125 Ted Turner Dr SW",
    "neighborhood": "Downtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30303",
    "venue_type": "event_space",
    "website": BASE_URL,
}

MONTH_PATTERN = r"(January|February|March|April|May|June|July|August|September|October|November|December)"
EVENT_HINTS = ("tailgate", "festival", "concert", "show", "party", "market", "event")
UTILITY_EVENT_TITLES = (
    "need help getting here",
    "want to host an event",
    "host an event",
)
OPENING_KEYWORDS = (
    "open",
    "opening",
    "opens",
    "launch",
    "leased",
    "lease",
    "coming",
    "new location",
    "new restaurant",
    "debut",
)
MEDIA_PREFIXES = (
    "Atlanta Business Chronicle",
    "Atlanta Magazine",
    "Atlanta Journal Constitution",
    "AJC",
    "Atlanta News First",
    "WSB-TV",
    "WhatNow Atlanta",
    "BusinessWire",
    "Bisnow",
    "Patch",
    "11Alive",
    "FOX 5",
)


def clean_text(value: str) -> str:
    if not value:
        return ""
    text = html.unescape(value)
    return re.sub(r"\s+", " ", text).strip()


def clean_html(value: str) -> str:
    if not value:
        return ""
    soup = BeautifulSoup(value, "html.parser")
    return clean_text(soup.get_text(" ", strip=True))


def parse_wp_date(value: str) -> Optional[str]:
    if not value:
        return None
    try:
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
        return dt.strftime("%Y-%m-%d")
    except Exception:
        return None


def parse_time_from_text(text: str) -> Optional[str]:
    match = re.search(r"\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b", text, flags=re.IGNORECASE)
    if not match:
        return None
    hour = int(match.group(1))
    minute = int(match.group(2) or 0)
    period = match.group(3).lower()
    if period == "pm" and hour != 12:
        hour += 12
    if period == "am" and hour == 12:
        hour = 0
    return f"{hour:02d}:{minute:02d}"


def parse_date_from_text(text: str, reference_date: Optional[date] = None) -> Optional[str]:
    match = re.search(
        rf"{MONTH_PATTERN}\s+(\d{{1,2}})(?:st|nd|rd|th)?(?:,?\s*(20\d{{2}}))?",
        text,
        flags=re.IGNORECASE,
    )
    if not match:
        return None

    month, day, year = match.groups()
    if not year:
        base_year = reference_date.year if reference_date else datetime.now().year
        year = str(base_year)

    try:
        dt = datetime.strptime(f"{month} {day} {year}", "%B %d %Y")
        compare_date = reference_date or datetime.now().date()
        if dt.date() < compare_date - timedelta(days=120):
            dt = dt.replace(year=dt.year + 1)
        return dt.strftime("%Y-%m-%d")
    except ValueError:
        return None


def extract_featured_image(item: dict) -> Optional[str]:
    media_nodes = item.get("_embedded", {}).get("wp:featuredmedia", [])
    if not media_nodes:
        return None
    source_url = media_nodes[0].get("source_url")
    if source_url:
        return source_url.strip()
    return None


def extract_ticket_like_url(html_content: str) -> Optional[str]:
    if not html_content:
        return None
    soup = BeautifulSoup(html_content, "html.parser")
    for link in soup.select("a[href]"):
        href = (link.get("href") or "").strip()
        href_lower = href.lower()
        if any(token in href_lower for token in ("ticket", "eventbrite", "rsvp", "runsignup")):
            return href
    return None


def is_external_media_title(title: str) -> bool:
    for prefix in MEDIA_PREFIXES:
        if title.startswith(f"{prefix}:"):
            return True
    return False


def normalize_news_subject(title: str) -> str:
    normalized = re.sub(r"^[^:]{2,70}:\s*", "", title).strip()
    normalized = re.sub(r"[^a-z0-9]+", " ", normalized.lower()).strip()
    return normalized


def fetch_wp_items(url: str, session: requests.Session) -> list[dict]:
    try:
        response = session.get(
            url,
            params={"per_page": 100, "_embed": 1, "status": "publish"},
            timeout=25,
        )
        response.raise_for_status()
        data = response.json()
        if isinstance(data, list):
            return data
        return []
    except Exception as e:
        logger.warning(f"Failed to fetch {url}: {e}")
        return []


def upsert_event(event_record: dict) -> tuple[bool, bool]:
    existing = find_event_by_hash(event_record["content_hash"])
    if existing:
        smart_update_existing_event(existing, event_record)
        return False, True
    insert_event(event_record)
    return True, False


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Centennial Yards events and official opening announcements."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    venue_id = get_or_create_venue(VENUE_DATA)
    session = requests.Session()
    session.headers.update({"User-Agent": "Mozilla/5.0 (compatible; LostCity/1.0)"})
    today = datetime.now().date()
    min_event_date = today
    max_event_date = today + timedelta(days=365)

    event_items = fetch_wp_items(EVENTS_API_URL, session=session)
    news_items = fetch_wp_items(NEWS_API_URL, session=session)

    logger.info(
        "Centennial Yards endpoints returned %s event posts and %s news posts",
        len(event_items),
        len(news_items),
    )

    for item in event_items:
        try:
            title = clean_text(item.get("title", {}).get("rendered", ""))
            if not title or len(title) < 4:
                continue

            title_lower = title.lower()
            if any(marker in title_lower for marker in UTILITY_EVENT_TITLES):
                continue

            content_html = item.get("content", {}).get("rendered", "")
            excerpt_html = item.get("excerpt", {}).get("rendered", "")
            content_text = clean_html(content_html)
            excerpt_text = clean_html(excerpt_html)
            combined_text = f"{title} {content_text} {excerpt_text}".strip()

            if not any(hint in combined_text.lower() for hint in EVENT_HINTS):
                continue

            wp_date_str = parse_wp_date(item.get("date", ""))
            wp_date_obj = None
            if wp_date_str:
                try:
                    wp_date_obj = datetime.strptime(wp_date_str, "%Y-%m-%d").date()
                except ValueError:
                    wp_date_obj = None

            start_date = parse_date_from_text(combined_text, reference_date=wp_date_obj) or wp_date_str
            if not start_date:
                continue
            parsed_start = datetime.strptime(start_date, "%Y-%m-%d").date()
            if parsed_start < min_event_date or parsed_start > max_event_date:
                continue

            start_time = parse_time_from_text(combined_text)
            source_url = item.get("link", EVENTS_API_URL)
            ticket_url = extract_ticket_like_url(content_html)
            image_url = extract_featured_image(item)

            category = "community"
            subcategory = "event"
            tags = ["centennial-yards", "downtown", "atlanta", "development"]

            if "tailgate" in combined_text.lower() or "vs." in combined_text.lower():
                category = "sports"
                subcategory = "tailgate"
                tags.extend(["sports", "tailgate"])
            elif "concert" in combined_text.lower() or "music" in combined_text.lower():
                category = "music"
                subcategory = "concert"
                tags.extend(["music", "live-event"])

            description = excerpt_text or content_text[:400] or f"{title} at Centennial Yards"

            events_found += 1
            content_hash = generate_content_hash(title, VENUE_DATA["name"], start_date)
            record = {
                "source_id": source_id,
                "venue_id": venue_id,
                "title": title,
                "description": description,
                "start_date": start_date,
                "start_time": start_time,
                "end_date": None,
                "end_time": None,
                "is_all_day": start_time is None,
                "category": category,
                "subcategory": subcategory,
                "tags": list(dict.fromkeys(tags)),
                "price_min": None,
                "price_max": None,
                "price_note": None,
                "is_free": True,
                "source_url": source_url,
                "ticket_url": ticket_url,
                "image_url": image_url,
                "raw_text": combined_text[:1000],
                "extraction_confidence": 0.84,
                "is_recurring": False,
                "recurrence_rule": None,
                "content_hash": content_hash,
            }

            is_new, is_updated = upsert_event(record)
            events_new += int(is_new)
            events_updated += int(is_updated)

        except Exception as e:
            logger.error(f"Failed to process Centennial event post: {e}", exc_info=True)
            continue

    seen_news_subjects: set[str] = set()
    min_news_date = today - timedelta(days=120)

    for item in news_items:
        try:
            title = clean_text(item.get("title", {}).get("rendered", ""))
            if not title or len(title) < 8:
                continue

            if is_external_media_title(title) and not title.startswith("Press Release:"):
                continue

            content_html = item.get("content", {}).get("rendered", "")
            excerpt_html = item.get("excerpt", {}).get("rendered", "")
            content_text = clean_html(content_html)
            excerpt_text = clean_html(excerpt_html)
            combined_text = f"{title} {excerpt_text} {content_text}".lower()

            if not any(keyword in combined_text for keyword in OPENING_KEYWORDS):
                continue

            start_date = parse_wp_date(item.get("date", ""))
            if not start_date:
                continue
            parsed_date = datetime.strptime(start_date, "%Y-%m-%d").date()
            if parsed_date < min_news_date:
                continue
            if parsed_date < today:
                continue

            subject_key = normalize_news_subject(title)
            month_key = f"{subject_key}:{start_date[:7]}"
            if month_key in seen_news_subjects:
                continue
            seen_news_subjects.add(month_key)

            source_url = item.get("link", NEWS_API_URL)
            image_url = extract_featured_image(item)
            description = excerpt_text or content_text[:400] or "Centennial Yards development update."

            category = "community"
            subcategory = "development"
            tags = ["centennial-yards", "downtown", "atlanta", "development", "opening"]
            if any(word in combined_text for word in ("restaurant", "cafe", "bar", "steakhouse", "dining")):
                category = "food_drink"
                subcategory = "restaurant-opening"
                tags.extend(["food", "restaurant-opening"])

            events_found += 1
            content_hash = generate_content_hash(title, VENUE_DATA["name"], start_date)
            record = {
                "source_id": source_id,
                "venue_id": venue_id,
                "title": title,
                "description": description,
                "start_date": start_date,
                "start_time": None,
                "end_date": None,
                "end_time": None,
                "is_all_day": True,
                "category": category,
                "subcategory": subcategory,
                "tags": list(dict.fromkeys(tags)),
                "price_min": None,
                "price_max": None,
                "price_note": None,
                "is_free": True,
                "source_url": source_url,
                "ticket_url": None,
                "image_url": image_url,
                "raw_text": (excerpt_text or content_text)[:1000] if (excerpt_text or content_text) else None,
                "extraction_confidence": 0.8,
                "is_recurring": False,
                "recurrence_rule": None,
                "content_hash": content_hash,
            }

            is_new, is_updated = upsert_event(record)
            events_new += int(is_new)
            events_updated += int(is_updated)

        except Exception as e:
            logger.error(f"Failed to process Centennial news post: {e}", exc_info=True)
            continue

    logger.info(
        "Centennial Yards crawl complete: %s found, %s new, %s updated",
        events_found,
        events_new,
        events_updated,
    )
    return events_found, events_new, events_updated
