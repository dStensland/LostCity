"""
Crawler for Ryman Auditorium (ryman.com/events).
Nashville's iconic music venue - "The Mother Church of Country Music"

Venue capacity: 2,362
Site uses JavaScript rendering - must use Playwright.
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
from utils import find_event_url, enrich_event_record

logger = logging.getLogger(__name__)

BASE_URL = "https://www.ryman.com"
EVENTS_URL = f"{BASE_URL}/events"

VENUE_DATA = {
    "name": "Ryman Auditorium",
    "slug": "ryman-auditorium",
    "address": "116 5th Ave N",
    "city": "Nashville",
    "state": "TN",
    "zip": "37219",
    "neighborhood": "Downtown",
    "venue_type": "music_venue",
    "website": BASE_URL,
    "lat": 36.1612,
    "lng": -86.7769,
}


def parse_date(date_text: str) -> Optional[str]:
    """Parse date from various formats to YYYY-MM-DD."""
    # Try common formats
    formats = [
        "%B %d, %Y",      # "January 15, 2026"
        "%b %d, %Y",      # "Jan 15, 2026"
        "%m/%d/%Y",       # "01/15/2026"
        "%Y-%m-%d",       # "2026-01-15"
    ]

    date_text = date_text.strip()

    for fmt in formats:
        try:
            dt = datetime.strptime(date_text, fmt)
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            continue

    return None


def parse_time(time_text: str) -> Optional[str]:
    """Parse time from '7:00 PM' or '19:00' format to 24-hour time."""
    match = re.search(r"(\d{1,2}):(\d{2})\s*(am|pm)", time_text, re.IGNORECASE)
    if match:
        hour, minute, period = match.groups()
        hour = int(hour)
        if period.lower() == "pm" and hour != 12:
            hour += 12
        elif period.lower() == "am" and hour == 12:
            hour = 0
        return f"{hour:02d}:{minute}"
    return None


def _extract_event_links_from_soup(soup: BeautifulSoup, base_url: str) -> dict[str, str]:
    """Extract title-to-URL mapping from a BeautifulSoup object."""
    skip_words = [
        "view more", "learn more", "read more", "see all", "load more",
        "submit", "upcoming", "donate", "subscribe", "newsletter",
        "sign up", "log in", "register", "contact", "about", "home",
        "menu", "navigation", "search", "filter", "sort", "reset",
        "privacy", "terms", "cookie", "accept", "decline",
    ]
    event_links: dict[str, str] = {}
    for a in soup.find_all("a", href=True):
        href = a.get("href", "")
        text = a.get_text(strip=True)
        if not href or not text or len(text) < 3:
            continue
        text_lower = text.lower()
        if any(skip in text_lower for skip in skip_words):
            continue
        if href.startswith("#") or href.startswith("javascript:"):
            continue
        if not href.startswith("http"):
            if href.startswith("/"):
                href = base_url.rstrip("/") + href
            else:
                href = base_url.rstrip("/") + "/" + href
        event_links[text_lower] = href
    return event_links


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Ryman Auditorium events."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        venue_id = get_or_create_venue(VENUE_DATA)

        logger.info(f"Fetching Ryman Auditorium: {EVENTS_URL}")
        headers = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"}
        response = requests.get(EVENTS_URL, headers=headers, timeout=30)
        response.raise_for_status()
        soup = BeautifulSoup(response.text, "html.parser")

        # Extract event links for specific URLs
        event_links = _extract_event_links_from_soup(soup, BASE_URL)

        # Find all event items - Ryman uses "eventItem" class
        event_containers = soup.find_all("div", class_="eventItem")

        logger.info(f"Found {len(event_containers)} event containers")

        for container in event_containers:
            try:
                # Extract title from h3.title > a
                title_elem = container.find("h3", class_="title")
                if not title_elem:
                    continue

                title_link = title_elem.find("a")
                if not title_link:
                    continue

                title = title_link.get_text(strip=True)
                if not title or len(title) < 3:
                    continue

                # Check for tagline (supporting act) and append if present
                tagline_elem = container.find("h4", class_="tagline")
                if tagline_elem:
                    tagline = tagline_elem.get_text(strip=True)
                    title = f"{title} {tagline}"

                # Extract date components
                date_container = container.find("div", class_="date")
                if not date_container:
                    continue

                month_elem = date_container.find("span", class_="m-date__month")
                day_elem = date_container.find("span", class_="m-date__day")
                year_elem = date_container.find("span", class_="m-date__year")
                hour_elem = date_container.find("span", class_="m-date__hour")

                if not month_elem or not day_elem or not year_elem:
                    logger.debug(f"Missing date components for {title}")
                    continue

                month = month_elem.get_text(strip=True)
                day = day_elem.get_text(strip=True)
                year = year_elem.get_text(strip=True).replace(",", "").strip()

                date_text = f"{month} {day}, {year}"
                start_date = parse_date(date_text)

                if not start_date:
                    logger.debug(f"Could not parse date: {date_text}")
                    continue

                start_time = None
                if hour_elem:
                    time_text = hour_elem.get_text(strip=True)
                    start_time = parse_time(time_text)

                # Extract event URL and use it as ticket URL
                event_url = None
                if title_link and title_link.get("href"):
                    event_url = title_link["href"]
                    if event_url.startswith("/"):
                        event_url = BASE_URL + event_url

                ticket_url = event_url if event_url else EVENTS_URL

                # Extract image URL
                image_url = None
                thumb_elem = container.find("div", class_="thumb")
                if thumb_elem:
                    img_elem = thumb_elem.find("img")
                    if img_elem:
                        image_url = img_elem.get("src") or img_elem.get("data-src")
                        if image_url and image_url.startswith("/"):
                            image_url = BASE_URL + image_url

                description = "Live performance at the historic Ryman Auditorium"
                events_found += 1

                content_hash = generate_content_hash(title, "Ryman Auditorium", start_date)
                tags = ["ryman-auditorium", "downtown-nashville", "historic-venue", "live-music"]

                # Get specific event URL from extracted links
                event_url = find_event_url(title, event_links, EVENTS_URL)

                event_record = {
                    "source_id": source_id,
                    "venue_id": venue_id,
                    "title": title,
                    "description": description,
                    "start_date": start_date,
                    "start_time": start_time,
                    "end_date": None,
                    "end_time": None,
                    "is_all_day": False,
                    "category": "music",
                    "subcategory": "concert",
                    "tags": tags,
                    "price_min": None,
                    "price_max": None,
                    "price_note": None,
                    "is_free": None,
                    "source_url": event_url,
                    "ticket_url": ticket_url,
                    "image_url": image_url,
                    "raw_text": f"{title} - {date_text} - {description}",
                    "extraction_confidence": 0.90,
                    "is_recurring": False,
                    "recurrence_rule": None,
                    "content_hash": content_hash,
                }

                # Enrich from detail page
                enrich_event_record(event_record, source_name="Ryman Auditorium")

                # Determine is_free if still unknown after enrichment
                if event_record.get("is_free") is None:
                    desc_lower = (event_record.get("description") or "").lower()
                    title_lower = event_record.get("title", "").lower()
                    combined = f"{title_lower} {desc_lower}"
                    if any(kw in combined for kw in ["free", "no cost", "no charge", "complimentary"]):
                        event_record["is_free"] = True
                        event_record["price_min"] = event_record.get("price_min") or 0
                        event_record["price_max"] = event_record.get("price_max") or 0
                    else:
                        event_record["is_free"] = False

                existing = find_event_by_hash(content_hash)
                if existing:
                    smart_update_existing_event(existing, event_record)
                    events_updated += 1
                    continue

                insert_event(event_record)
                events_new += 1
                logger.info(f"Added: {title} on {start_date}")

            except Exception as e:
                logger.error(f"Failed to parse event: {e}")
                continue

        logger.info(
            f"Ryman Auditorium crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Ryman Auditorium: {e}")
        raise

    return events_found, events_new, events_updated
