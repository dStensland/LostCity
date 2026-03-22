"""
Crawler for Atlanta Motor Speedway (atlantamotorspeedway.com).
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

logger = logging.getLogger(__name__)

BASE_URL = "https://www.atlantamotorspeedway.com"
EVENTS_URL = f"{BASE_URL}/events"

VENUE_DATA = {
    "name": "Atlanta Motor Speedway",
    "slug": "atlanta-motor-speedway",
    "address": "1500 Tara Pl",
    "neighborhood": "Hampton",
    "city": "Hampton",
    "state": "GA",
    "zip": "30228",
    "lat": 33.3868,
    "lng": -84.3168,
    "venue_type": "stadium",
    "spot_type": "stadium",
    "website": BASE_URL,
}

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
}


def parse_time(time_text: str) -> Optional[str]:
    """Parse time from '7:00 PM' format."""
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


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Atlanta Motor Speedway events."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        logger.info(f"Fetching Atlanta Motor Speedway: {EVENTS_URL}")
        response = requests.get(EVENTS_URL, headers=HEADERS, timeout=30)
        response.raise_for_status()
        soup = BeautifulSoup(response.text, "lxml")

        # Extract image alt-text → URL mapping
        image_map: dict[str, str] = {}
        for img in soup.find_all("img", alt=True):
            alt = img.get("alt", "").strip()
            src = img.get("src") or img.get("data-src", "")
            if alt and src and len(alt) > 3:
                image_map[alt] = src

        # Extract event links (title → URL mapping)
        event_links: dict[str, str] = {}
        for a in soup.find_all("a", href=True):
            text = a.get_text(strip=True)
            href = a["href"]
            if text and len(text) > 2:
                if not href.startswith("http"):
                    href = BASE_URL.rstrip("/") + href if href.startswith("/") else BASE_URL + "/" + href
                event_links[text.lower()] = href

        venue_id = get_or_create_venue(VENUE_DATA)
        body_text = soup.get_text(separator="\n")
        lines = [l.strip() for l in body_text.split("\n") if l.strip()]

        # Parse events - look for date patterns
        i = 0
        while i < len(lines):
            line = lines[i]

            # Skip navigation items
            if len(line) < 3:
                i += 1
                continue

            # Look for date patterns
            date_match = re.match(
                r"(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)?,?\s*(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})(?:,?\s+(\d{4}))?",
                line,
                re.IGNORECASE
            )

            if date_match:
                month = date_match.group(1)
                day = date_match.group(2)
                year = date_match.group(3) if date_match.group(3) else str(datetime.now().year)

                # Look for title in surrounding lines
                title = None
                start_time = None

                for offset in [-2, -1, 1, 2, 3]:
                    idx = i + offset
                    if 0 <= idx < len(lines):
                        check_line = lines[idx]
                        if re.match(r"(January|February|March)", check_line, re.IGNORECASE):
                            continue
                        if not start_time:
                            time_result = parse_time(check_line)
                            if time_result:
                                start_time = time_result
                                continue
                        if not title and len(check_line) > 5:
                            if not re.match(r"\d{1,2}[:/]", check_line):
                                if not re.match(r"(free|tickets|register|\$|more info)", check_line.lower()):
                                    title = check_line
                                    break

                if not title:
                    i += 1
                    continue

                # Parse date
                try:
                    month_str = month[:3] if len(month) > 3 else month
                    dt = datetime.strptime(f"{month_str} {day} {year}", "%b %d %Y")
                    if dt.date() < datetime.now().date():
                        dt = datetime.strptime(f"{month_str} {day} {int(year) + 1}", "%b %d %Y")
                    start_date = dt.strftime("%Y-%m-%d")
                except ValueError:
                    i += 1
                    continue

                events_found += 1

                content_hash = generate_content_hash(title, "Atlanta Motor Speedway", start_date)

                event_url = event_links.get(title.lower(), EVENTS_URL)

                event_record = {
                    "source_id": source_id,
                    "venue_id": venue_id,
                    "title": title,
                    "description": "Event at Atlanta Motor Speedway",
                    "start_date": start_date,
                    "start_time": start_time,
                    "end_date": None,
                    "end_time": None,
                    "is_all_day": False,
                    "category": "sports",
                    "subcategory": None,
                    "tags": [
                        "atlanta-motor-speedway",
                        "nascar",
                        "racing",
                        "motorsports",
                        "hampton",
                    ],
                    "price_min": None,
                    "price_max": None,
                    "price_note": None,
                    "is_free": False,
                    "source_url": event_url,
                    "ticket_url": event_url,
                    "image_url": image_map.get(title),
                    "raw_text": f"{title} - {start_date}",
                    "extraction_confidence": 0.80,
                    "is_recurring": False,
                    "recurrence_rule": None,
                    "content_hash": content_hash,
                }

                existing = find_event_by_hash(content_hash)
                if existing:
                    smart_update_existing_event(existing, event_record)
                    events_updated += 1
                    i += 1
                    continue

                try:
                    insert_event(event_record)
                    events_new += 1
                    logger.info(f"Added: {title} on {start_date}")
                except Exception as e:
                    logger.error(f"Failed to insert: {title}: {e}")

            i += 1

        logger.info(
            f"Atlanta Motor Speedway crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Atlanta Motor Speedway: {e}")
        raise

    return events_found, events_new, events_updated
