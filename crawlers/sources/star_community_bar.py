"""
Crawler for Star Community Bar (starbaratl.bar).
Little Five Points live music venue with shows Wed-Sat, Monday comedy, Tuesday DJ nights.
A fixture of Atlanta's alternative scene.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime
from typing import Optional

import requests
from bs4 import BeautifulSoup

from db import get_or_create_venue, insert_event, find_event_by_hash
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://www.starbaratl.bar"

VENUE_DATA = {
    "name": "Star Community Bar",
    "slug": "star-community-bar",
    "address": "437 Moreland Ave NE",
    "neighborhood": "Little Five Points",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30307",
    "lat": 33.7648,
    "lng": -84.3488,
    "venue_type": "music_venue",
    "spot_type": "music_venue",
    "website": BASE_URL,
    "description": "Little Five Points live music venue and bar with eclectic programming including live music, comedy, and DJ nights.",
}

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
}


def parse_date(date_str: str) -> Optional[str]:
    """Parse date from various formats."""
    date_str = date_str.strip()
    now = datetime.now()

    # Try various date patterns
    patterns = [
        (r"(\d{1,2})/(\d{1,2})/(\d{2,4})", "%m/%d/%Y"),
        (r"(\w+)\s+(\d{1,2}),?\s*(\d{4})?", None),  # January 15 or January 15, 2026
    ]

    for pattern, fmt in patterns:
        match = re.search(pattern, date_str, re.IGNORECASE)
        if match:
            try:
                if fmt:
                    parsed = match.group()
                    if len(match.group(3)) == 2:
                        parsed = f"{match.group(1)}/{match.group(2)}/20{match.group(3)}"
                    dt = datetime.strptime(parsed, fmt)
                else:
                    month_str = match.group(1)
                    day = int(match.group(2))
                    year = int(match.group(3)) if match.group(3) else now.year

                    month_map = {
                        "january": 1, "february": 2, "march": 3, "april": 4,
                        "may": 5, "june": 6, "july": 7, "august": 8,
                        "september": 9, "october": 10, "november": 11, "december": 12,
                        "jan": 1, "feb": 2, "mar": 3, "apr": 4, "jun": 6,
                        "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12
                    }
                    month = month_map.get(month_str.lower())
                    if not month:
                        continue
                    dt = datetime(year, month, day)

                if dt.date() < now.date():
                    dt = dt.replace(year=now.year + 1)

                return dt.strftime("%Y-%m-%d")
            except (ValueError, KeyError):
                continue

    return None


def parse_time(time_str: str) -> Optional[str]:
    """Parse time from various formats."""
    match = re.search(r"(\d{1,2}):?(\d{2})?\s*(am|pm|p|a)", time_str, re.IGNORECASE)
    if match:
        hour = int(match.group(1))
        minute = int(match.group(2)) if match.group(2) else 0
        period = match.group(3).lower()
        if period in ("pm", "p") and hour != 12:
            hour += 12
        elif period in ("am", "a") and hour == 12:
            hour = 0
        return f"{hour:02d}:{minute:02d}"
    return None


def determine_category(title: str) -> tuple[str, Optional[str], list[str]]:
    """Determine category based on event title."""
    title_lower = title.lower()
    tags = ["star-bar", "little-five-points", "l5p"]

    if any(w in title_lower for w in ["comedy", "stand-up", "standup", "open mic comedy"]):
        return "comedy", "standup", tags + ["comedy"]
    if any(w in title_lower for w in ["dj", "dance", "disco", "80s", "90s"]):
        return "nightlife", "club", tags + ["dj", "dance"]
    if any(w in title_lower for w in ["karaoke"]):
        return "nightlife", "karaoke", tags + ["karaoke"]
    if any(w in title_lower for w in ["trivia", "quiz"]):
        return "community", None, tags + ["trivia"]

    # Default to music
    return "music", "live", tags + ["live-music"]


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Star Community Bar calendar."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        venue_id = get_or_create_venue(VENUE_DATA)

        # Try calendar/events pages
        for path in ["/calendar", "/events", "/shows", ""]:
            try:
                url = BASE_URL + path
                response = requests.get(url, headers=HEADERS, timeout=30)
                if response.status_code != 200:
                    continue

                soup = BeautifulSoup(response.text, "html.parser")

                # Look for event elements
                event_selectors = [
                    ".event", ".show", "[class*='event']",
                    ".calendar-item", "article"
                ]

                event_elements = []
                for selector in event_selectors:
                    elements = soup.select(selector)
                    if elements:
                        event_elements = elements
                        break

                if event_elements:
                    for element in event_elements:
                        try:
                            # Extract title
                            title_elem = element.find(["h2", "h3", "h4", "a", ".title"])
                            if not title_elem:
                                continue
                            title = title_elem.get_text(strip=True)
                            if not title or len(title) < 3:
                                continue

                            # Extract date
                            text = element.get_text()
                            date_match = re.search(
                                r"(\w+)\s+(\d{1,2}),?\s*(\d{4})?|\d{1,2}/\d{1,2}/\d{2,4}",
                                text,
                                re.IGNORECASE
                            )
                            if not date_match:
                                continue

                            start_date = parse_date(date_match.group())
                            if not start_date:
                                continue

                            # Skip past events
                            if datetime.strptime(start_date, "%Y-%m-%d").date() < datetime.now().date():
                                continue

                            events_found += 1

                            # Extract time
                            time_match = re.search(r"\d{1,2}:?\d{0,2}\s*(am|pm|p)", text, re.I)
                            start_time = parse_time(time_match.group()) if time_match else "21:00"

                            # Generate hash
                            content_hash = generate_content_hash(
                                title, "Star Community Bar", start_date
                            )

                            if find_event_by_hash(content_hash):
                                events_updated += 1
                                continue

                            category, subcategory, tags = determine_category(title)

                            # Extract link
                            link = element.find("a", href=True)
                            event_url = link["href"] if link else url
                            if event_url.startswith("/"):
                                event_url = BASE_URL + event_url

                            event_record = {
                                "source_id": source_id,
                                "venue_id": venue_id,
                                "title": title,
                                "description": f"Event at Star Community Bar in Little Five Points",
                                "start_date": start_date,
                                "start_time": start_time,
                                "end_date": None,
                                "end_time": None,
                                "is_all_day": False,
                                "category": category,
                                "subcategory": subcategory,
                                "tags": tags,
                                "price_min": None,
                                "price_max": None,
                                "price_note": None,
                                "is_free": False,
                                "source_url": event_url,
                                "ticket_url": event_url,
                                "image_url": None,
                                "raw_text": text[:500],
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
                                logger.error(f"Failed to insert: {title}: {e}")

                        except Exception as e:
                            logger.debug(f"Error parsing event: {e}")
                            continue

                    break  # Found events, stop trying other paths

            except requests.RequestException:
                continue

        logger.info(f"Star Bar crawl complete: {events_found} found, {events_new} new, {events_updated} updated")

    except Exception as e:
        logger.error(f"Failed to crawl Star Community Bar: {e}")
        raise

    return events_found, events_new, events_updated
