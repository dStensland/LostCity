"""
Crawler for Echo Room venue in Atlanta.
Crawls event listings from Songkick venue page.
Echo Room is a live music venue that hosts concerts and shows.
"""

import json
import logging
import re
from datetime import datetime
from typing import Optional
from bs4 import BeautifulSoup
import requests

from db import get_or_create_venue, insert_event, find_event_by_hash
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

SONGKICK_VENUE_URL = "https://www.songkick.com/venues/3586926-echo-room"
BASE_URL = "https://www.songkick.com"

VENUE_DATA = {
    "name": "Echo Room",
    "slug": "echo-room",
    "address": "551 Swanson Dr SE",
    "neighborhood": "Grant Park",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30312",
    "venue_type": "music_venue",
    "website": "https://echoroomatlanta.com",
}


def parse_date(date_str: str) -> Optional[str]:
    """Parse date from various Songkick formats."""
    if not date_str:
        return None

    date_str = date_str.strip()

    # Try ISO format first (2026-01-26)
    if re.match(r"^\d{4}-\d{2}-\d{2}$", date_str):
        return date_str

    # Try formats like "Mon 26 Jan 2026" or "January 26, 2026"
    date_patterns = [
        r"(\w+)\s+(\d{1,2})\s+(\w+)\s+(\d{4})",  # Mon 26 Jan 2026
        r"(\w+)\s+(\d{1,2}),?\s+(\d{4})",  # January 26, 2026
        r"(\d{1,2})\s+(\w+)\s+(\d{4})",  # 26 January 2026
    ]

    for pattern in date_patterns:
        match = re.search(pattern, date_str)
        if match:
            try:
                # Parse the matched date
                dt = datetime.strptime(date_str, "%a %d %b %Y")
                return dt.strftime("%Y-%m-%d")
            except ValueError:
                try:
                    dt = datetime.strptime(date_str, "%B %d, %Y")
                    return dt.strftime("%Y-%m-%d")
                except ValueError:
                    try:
                        dt = datetime.strptime(date_str, "%d %B %Y")
                        return dt.strftime("%Y-%m-%d")
                    except ValueError:
                        continue

    return None


def parse_time(time_str: str) -> Optional[str]:
    """Parse time from formats like '8:00 PM' or '20:00'."""
    if not time_str:
        return None

    time_str = time_str.strip()

    # Try 12-hour format
    match = re.search(r"(\d{1,2}):(\d{2})\s*(AM|PM)", time_str, re.IGNORECASE)
    if match:
        hour, minute, period = match.groups()
        hour = int(hour)
        if period.upper() == "PM" and hour != 12:
            hour += 12
        elif period.upper() == "AM" and hour == 12:
            hour = 0
        return f"{hour:02d}:{minute}"

    # Try 24-hour format
    match = re.search(r"(\d{1,2}):(\d{2})", time_str)
    if match:
        hour, minute = match.groups()
        return f"{int(hour):02d}:{minute}"

    return None


def parse_songkick_events(soup: BeautifulSoup) -> list[dict]:
    """Extract events from Songkick venue page."""
    events = []

    # Look for event listings with various possible class names
    event_elements = []

    # Try common Songkick event list patterns
    for selector in [
        "li.event-listing",
        "li.concert-listing",
        "li[class*='event']",
        "article[class*='event']",
        "div[class*='event-listing']",
    ]:
        found = soup.select(selector)
        if found:
            event_elements = found
            break

    for event_elem in event_elements:
        try:
            # Extract title/artist name
            title = None
            title_elem = event_elem.select_one("a.event-link, .event-title, .artist-name, h3 a, strong a")
            if title_elem:
                title = title_elem.get_text(strip=True)

            if not title:
                continue

            # Extract date
            date_elem = event_elem.select_one("time, .date, [class*='date']")
            start_date = None
            if date_elem:
                # Try datetime attribute first
                if date_elem.get("datetime"):
                    start_date = date_elem.get("datetime")[:10]
                else:
                    start_date = parse_date(date_elem.get_text(strip=True))

            if not start_date:
                continue

            # Extract time
            time_elem = event_elem.select_one(".time, [class*='time']")
            start_time = None
            if time_elem:
                start_time = parse_time(time_elem.get_text(strip=True))

            # Extract event URL
            event_url = None
            link_elem = event_elem.select_one("a[href*='/concerts/']")
            if link_elem:
                href = link_elem.get("href")
                if href:
                    event_url = href if href.startswith("http") else BASE_URL + href

            # Extract supporting artists if available
            support_elem = event_elem.select_one(".support, .supporting-artists")
            description = None
            if support_elem:
                description = f"With {support_elem.get_text(strip=True)}"

            events.append({
                "title": title,
                "start_date": start_date,
                "start_time": start_time,
                "description": description,
                "event_url": event_url,
            })

        except Exception as e:
            logger.debug(f"Error parsing event element: {e}")
            continue

    return events


def parse_jsonld_events(soup: BeautifulSoup) -> list[dict]:
    """Extract Event data from JSON-LD scripts if available."""
    events = []
    scripts = soup.find_all("script", type="application/ld+json")

    for script in scripts:
        try:
            data = json.loads(script.string)
            if isinstance(data, dict):
                if data.get("@type") in ["Event", "MusicEvent"]:
                    events.append(data)
                if "@graph" in data:
                    events.extend([e for e in data["@graph"] if e.get("@type") in ["Event", "MusicEvent"]])
            elif isinstance(data, list):
                events.extend([e for e in data if e.get("@type") in ["Event", "MusicEvent"]])
        except (json.JSONDecodeError, TypeError):
            continue

    return events


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Echo Room events from Songkick."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
    }

    try:
        response = requests.get(SONGKICK_VENUE_URL, headers=headers, timeout=30)
        response.raise_for_status()

        soup = BeautifulSoup(response.text, "html.parser")
        venue_id = get_or_create_venue(VENUE_DATA)

        # Try JSON-LD first
        json_events = parse_jsonld_events(soup)

        if json_events:
            logger.info(f"Found {len(json_events)} events in JSON-LD")
            for event_data in json_events:
                events_found += 1
                title = event_data.get("name", "").strip()
                if not title:
                    continue

                start_date = event_data.get("startDate", "")[:10] if event_data.get("startDate") else None
                if not start_date:
                    continue

                content_hash = generate_content_hash(title, VENUE_DATA["name"], start_date)
                existing = find_event_by_hash(content_hash)
                if existing:
                    events_updated += 1
                    continue

                # Parse time if available
                start_time = None
                if event_data.get("startDate") and "T" in event_data.get("startDate", ""):
                    try:
                        dt = datetime.fromisoformat(event_data["startDate"].replace("Z", "+00:00"))
                        if dt.hour != 0 or dt.minute != 0:
                            start_time = dt.strftime("%H:%M")
                    except ValueError:
                        pass

                event_record = {
                    "source_id": source_id,
                    "venue_id": venue_id,
                    "title": title,
                    "description": event_data.get("description", f"Live music at Echo Room - {title}")[:500],
                    "start_date": start_date,
                    "start_time": start_time,
                    "end_date": None,
                    "end_time": None,
                    "is_all_day": False,
                    "category": "music",
                    "subcategory": "live_music",
                    "tags": ["music", "live-music", "concert", "grant-park"],
                    "price_min": None,
                    "price_max": None,
                    "price_note": None,
                    "is_free": False,
                    "source_url": SONGKICK_VENUE_URL,
                    "ticket_url": event_data.get("url"),
                    "image_url": event_data.get("image"),
                    "raw_text": json.dumps(event_data),
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
                    logger.error(f"Failed to insert {title}: {e}")

        else:
            # Fall back to HTML parsing
            logger.info("No JSON-LD found, parsing HTML")
            html_events = parse_songkick_events(soup)

            for event_data in html_events:
                events_found += 1
                title = event_data.get("title")
                start_date = event_data.get("start_date")

                if not title or not start_date:
                    continue

                content_hash = generate_content_hash(title, VENUE_DATA["name"], start_date)
                existing = find_event_by_hash(content_hash)
                if existing:
                    events_updated += 1
                    continue

                description = event_data.get("description") or f"Live music at Echo Room - {title}"

                event_record = {
                    "source_id": source_id,
                    "venue_id": venue_id,
                    "title": title,
                    "description": description[:500],
                    "start_date": start_date,
                    "start_time": event_data.get("start_time"),
                    "end_date": None,
                    "end_time": None,
                    "is_all_day": event_data.get("start_time") is None,
                    "category": "music",
                    "subcategory": "live_music",
                    "tags": ["music", "live-music", "concert", "grant-park"],
                    "price_min": None,
                    "price_max": None,
                    "price_note": None,
                    "is_free": False,
                    "source_url": SONGKICK_VENUE_URL,
                    "ticket_url": event_data.get("event_url"),
                    "image_url": None,
                    "raw_text": None,
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
                    logger.error(f"Failed to insert {title}: {e}")

        logger.info(f"Echo Room: Found {events_found} events, {events_new} new, {events_updated} existing")

    except requests.exceptions.HTTPError as e:
        if e.response.status_code == 404:
            logger.warning(f"Echo Room Songkick page not found (404). Venue may not have upcoming events or URL changed.")
            # Return success with 0 events rather than raising
            return 0, 0, 0
        else:
            logger.error(f"Failed to crawl Echo Room: HTTP {e.response.status_code}")
            raise

    except Exception as e:
        logger.error(f"Failed to crawl Echo Room: {e}")
        raise

    return events_found, events_new, events_updated
