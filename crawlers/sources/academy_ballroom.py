"""
Crawler for Academy Ballroom Atlanta.
Ballroom and Latin dance studio with group classes and socials.

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
from utils import find_event_url

logger = logging.getLogger(__name__)

BASE_URL = "https://academyballroomatl.com"
EVENTS_URL = BASE_URL

VENUE_DATA = {
    "name": "Academy Ballroom Atlanta",
    "slug": "academy-ballroom",
    "address": "800 Miami Circle NE, Suite 140",
    "neighborhood": "Buckhead",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30324",
    "venue_type": "dance_studio",
    "website": BASE_URL,
}


def parse_time(time_text: str) -> Optional[str]:
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
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        venue_id = get_or_create_venue(VENUE_DATA)

        logger.info(f"Fetching Academy Ballroom: {EVENTS_URL}")
        headers = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"}
        response = requests.get(EVENTS_URL, headers=headers, timeout=30)
        response.raise_for_status()
        soup = BeautifulSoup(response.text, "html.parser")

        # Build image map from page
        image_map = {}
        for img in soup.find_all("img"):
            alt = (img.get("alt") or img.get("title") or "").strip()
            src = img.get("src") or img.get("data-src")
            if alt and src and len(alt) > 3:
                image_map[alt] = src

        # Build event links map
        event_links = {}
        for a in soup.find_all("a", href=True):
            href = a.get("href", "")
            text = a.get_text(strip=True)
            if not href or not text or len(text) < 3:
                continue
            full_url = href if href.startswith("http") else BASE_URL + href
            event_links[text.lower()] = full_url

        body_text = soup.get_text(separator="\n")
        lines = [l.strip() for l in body_text.split("\n") if l.strip()]

        i = 0
        while i < len(lines):
            line = lines[i]

            if len(line) < 3:
                i += 1
                continue

            date_match = re.match(
                r"(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)?,?\s*(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})(?:,?\s+(\d{4}))?",
                line,
                re.IGNORECASE
            )

            if date_match:
                month = date_match.group(1)
                day = date_match.group(2)
                year = date_match.group(3) if date_match.group(3) else str(datetime.now().year)

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
                content_hash = generate_content_hash(title, "Academy Ballroom", start_date)

                # Determine subcategory based on title
                title_lower = title.lower()
                if "salsa" in title_lower:
                    subcategory = "salsa"
                elif "bachata" in title_lower:
                    subcategory = "bachata"
                elif "tango" in title_lower:
                    subcategory = "tango"
                else:
                    subcategory = "ballroom"

                event_url = find_event_url(title, event_links, EVENTS_URL)

                event_record = {
                    "source_id": source_id,
                    "venue_id": venue_id,
                    "title": title,
                    "description": "Event at Academy Ballroom",
                    "start_date": start_date,
                    "start_time": start_time or "19:00",
                    "end_date": None,
                    "end_time": None,
                    "is_all_day": False,
                    "category": "fitness",
                    "subcategory": subcategory,
                    "tags": ["dance", "ballroom", "latin", "social-dance"],
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
                    "is_class": True,
                    "class_category": "dance",
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

        logger.info(f"Academy Ballroom crawl complete: {events_found} found, {events_new} new, {events_updated} updated")

    except Exception as e:
        logger.error(f"Failed to crawl Academy Ballroom: {e}")
        raise

    return events_found, events_new, events_updated
