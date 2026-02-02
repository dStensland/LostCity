"""
Crawler for Southern Feedstore (sfseav.com).
East Atlanta Village food hall with 6 independent kitchens, full bar, and live entertainment.
Open late (til 4am weekends), hosts live music, comedy, and special events.
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

BASE_URL = "https://sfseav.com"

VENUE_DATA = {
    "name": "Southern Feedstore",
    "slug": "southern-feedstore",
    "address": "493 Flat Shoals Ave SE",
    "neighborhood": "East Atlanta Village",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30316",
    "lat": 33.7400,
    "lng": -84.3420,
    "venue_type": "food_hall",
    "spot_type": "food_hall",
    "website": BASE_URL,
    "description": "EAV food hall with 6 kitchens, full bar, and stage for live music and comedy. Open til 4am weekends.",
}

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
}


def parse_date(date_str: str) -> Optional[str]:
    """Parse date from various formats."""
    date_str = date_str.strip()
    now = datetime.now()

    formats = [
        "%B %d, %Y",
        "%b %d, %Y",
        "%m/%d/%Y",
        "%m/%d/%y",
    ]

    for fmt in formats:
        try:
            dt = datetime.strptime(date_str, fmt)
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            continue

    # Partial match
    match = re.search(
        r"(January|February|March|April|May|June|July|August|September|October|November|December|"
        r"Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s*(\d{4}))?",
        date_str,
        re.IGNORECASE
    )
    if match:
        month_str = match.group(1)[:3]
        day = match.group(2)
        year = match.group(3) if match.group(3) else str(now.year)
        try:
            dt = datetime.strptime(f"{month_str} {day} {year}", "%b %d %Y")
            if dt.date() < now.date():
                dt = dt.replace(year=now.year + 1)
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            pass

    return None


def parse_time(time_str: str) -> Optional[str]:
    """Parse time from various formats."""
    match = re.search(r"(\d{1,2}):?(\d{2})?\s*(am|pm|a|p)", time_str, re.IGNORECASE)
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
    tags = ["southern-feedstore", "eav", "east-atlanta-village", "food-hall"]

    if any(w in title_lower for w in ["comedy", "stand-up", "standup", "laugh"]):
        return "comedy", "standup", tags + ["comedy"]
    if any(w in title_lower for w in ["live", "music", "band", "concert", "dj"]):
        return "music", "live", tags + ["live-music"]
    if any(w in title_lower for w in ["trivia", "quiz"]):
        return "community", None, tags + ["trivia"]
    if any(w in title_lower for w in ["brunch", "tasting", "food"]):
        return "food_drink", "tasting", tags + ["food"]
    if any(w in title_lower for w in ["market", "pop-up", "vendor"]):
        return "community", "market", tags + ["pop-up"]
    if any(w in title_lower for w in ["karaoke"]):
        return "nightlife", "karaoke", tags + ["karaoke"]
    if any(w in title_lower for w in ["open mic"]):
        return "music", "open_mic", tags + ["open-mic"]

    return "community", None, tags


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Southern Feedstore events."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        venue_id = get_or_create_venue(VENUE_DATA)

        # Try multiple potential event page paths
        for path in ["/events", "/calendar", "/whats-happening", ""]:
            try:
                url = BASE_URL + path
                response = requests.get(url, headers=HEADERS, timeout=30)
                if response.status_code != 200:
                    continue

                soup = BeautifulSoup(response.text, "html.parser")

                # Look for event elements
                event_selectors = [
                    ".event", ".event-item", "[class*='event']",
                    ".show", ".listing", "article"
                ]

                for selector in event_selectors:
                    elements = soup.select(selector)
                    if not elements:
                        continue

                    for element in elements:
                        try:
                            # Extract title
                            title_elem = element.find(["h1", "h2", "h3", "h4", "a"])
                            if not title_elem:
                                continue
                            title = title_elem.get_text(strip=True)
                            if not title or len(title) < 3:
                                continue

                            # Extract date
                            text = element.get_text()
                            date_match = re.search(
                                r"(January|February|March|April|May|June|July|August|September|October|November|December|"
                                r"Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\.?\s+\d{1,2}",
                                text,
                                re.IGNORECASE
                            )
                            if not date_match:
                                date_match = re.search(r"\d{1,2}/\d{1,2}/\d{2,4}", text)

                            if not date_match:
                                continue

                            start_date = parse_date(date_match.group())
                            if not start_date:
                                continue

                            if datetime.strptime(start_date, "%Y-%m-%d").date() < datetime.now().date():
                                continue

                            events_found += 1

                            # Extract time
                            time_match = re.search(r"\d{1,2}:?\d{0,2}\s*(am|pm|a|p)", text, re.I)
                            start_time = parse_time(time_match.group()) if time_match else "20:00"

                            content_hash = generate_content_hash(
                                title, "Southern Feedstore", start_date
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
                                "description": f"Event at Southern Feedstore, EAV's food hall and entertainment venue",
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

                    if events_found > 0:
                        break

                if events_found > 0:
                    break

            except requests.RequestException:
                continue

        logger.info(f"Southern Feedstore crawl complete: {events_found} found, {events_new} new, {events_updated} updated")

    except Exception as e:
        logger.error(f"Failed to crawl Southern Feedstore: {e}")
        raise

    return events_found, events_new, events_updated
