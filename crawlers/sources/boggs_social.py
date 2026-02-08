"""
Crawler for Boggs Social & Supply (boggssocial.com).
West End music venue and bar off the Beltline with live shows, karaoke, comedy, food pop-ups.
Pet-friendly, 250 capacity.

Site is Squarespace — same pattern as Star Community Bar.
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
from utils import parse_price

logger = logging.getLogger(__name__)

BASE_URL = "https://www.boggssocial.com"

VENUE_DATA = {
    "name": "Boggs Social & Supply",
    "slug": "boggs-social-supply",
    "address": "1310 White St SW",
    "neighborhood": "West End",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30310",
    "lat": 33.7332,
    "lng": -84.4106,
    "venue_type": "music_venue",
    "spot_type": "music_venue",
    "website": BASE_URL,
    "vibes": ["live-music", "dive-bar", "west-side", "pet-friendly", "local-bands", "beltline"],
}

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
}


def parse_time(time_str: str) -> Optional[str]:
    """Parse time from various formats."""
    if not time_str:
        return None
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
    tags = ["boggs-social", "west-end"]

    if any(w in title_lower for w in ["comedy", "stand-up", "standup", "socially awkward"]):
        return "comedy", "standup", tags + ["comedy"]
    if any(w in title_lower for w in ["karaoke", "music mike"]):
        return "nightlife", "karaoke", tags + ["karaoke"]
    if any(w in title_lower for w in ["dj", "dance night"]):
        return "nightlife", "club", tags + ["dj"]
    if any(w in title_lower for w in ["bingo"]):
        return "community", None, tags + ["bingo"]
    if any(w in title_lower for w in ["trivia", "quiz"]):
        return "community", None, tags + ["trivia"]
    if any(w in title_lower for w in ["gaming", "tournament"]):
        return "community", None, tags + ["gaming"]

    return "music", "live", tags + ["live-music"]


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Boggs Social & Supply calendar."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        venue_id = get_or_create_venue(VENUE_DATA)

        for path in ["/events", "/calendar", ""]:
            try:
                url = BASE_URL + path
                logger.info(f"Trying URL: {url}")
                response = requests.get(url, headers=HEADERS, timeout=30)
                if response.status_code != 200:
                    continue

                soup = BeautifulSoup(response.text, "html.parser")
                event_elements = soup.select("article.eventlist-event")

                if not event_elements:
                    continue

                logger.info(f"Found {len(event_elements)} events at {url}")

                for element in event_elements:
                    try:
                        title_elem = element.select_one(".eventlist-title-link")
                        if not title_elem:
                            continue

                        title = title_elem.get_text(strip=True)
                        if not title or len(title) < 3:
                            continue

                        if "google calendar" in title.lower() or "add to calendar" in title.lower():
                            continue

                        # Date from <time> element
                        date_elem = element.select_one("time.event-date")
                        if not date_elem or not date_elem.get("datetime"):
                            continue

                        start_date = date_elem["datetime"]
                        try:
                            date_obj = datetime.strptime(start_date, "%Y-%m-%d")
                        except ValueError:
                            continue

                        if date_obj.date() < datetime.now().date():
                            continue

                        events_found += 1

                        # Time
                        time_elem = element.select_one("time.event-time-localized")
                        start_time = None
                        if time_elem:
                            start_time = parse_time(time_elem.get_text(strip=True))
                        if not start_time:
                            start_time = "20:00"

                        # Description
                        description = None
                        desc_elem = element.select_one("div.eventlist-excerpt")
                        if desc_elem:
                            description = desc_elem.get_text(strip=True)

                        # Image
                        image_url = None
                        img_container = element.select_one("a.eventlist-column-thumbnail")
                        if img_container:
                            img_elem = img_container.find("img")
                            if img_elem and img_elem.get("src"):
                                image_url = img_elem["src"]
                                if image_url.startswith("//"):
                                    image_url = "https:" + image_url
                                elif image_url.startswith("/"):
                                    image_url = BASE_URL + image_url

                        # Event URL
                        event_url = title_elem.get("href", url)
                        if event_url.startswith("/"):
                            event_url = BASE_URL + event_url

                        # Dedup
                        content_hash = generate_content_hash(title, "Boggs Social & Supply", start_date)
                        if find_event_by_hash(content_hash):
                            events_updated += 1
                            continue

                        category, subcategory, tags = determine_category(title)

                        # Price from description or excerpt
                        price_min, price_max, price_note = None, None, None
                        is_free = False
                        if description:
                            price_min, price_max, price_note = parse_price(description)
                            if price_min == 0:
                                is_free = True

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
                            "category": category,
                            "subcategory": subcategory,
                            "tags": tags,
                            "price_min": price_min,
                            "price_max": price_max,
                            "price_note": price_note,
                            "is_free": is_free,
                            "source_url": event_url,
                            "ticket_url": event_url,
                            "image_url": image_url,
                            "raw_text": element.get_text(separator=" ", strip=True)[:500],
                            "extraction_confidence": 0.85,
                            "is_recurring": False,
                            "recurrence_rule": None,
                            "content_hash": content_hash,
                        }

                        try:
                            insert_event(event_record)
                            events_new += 1
                            logger.info(f"Added: {title} on {start_date} at {start_time}")
                        except Exception as e:
                            logger.error(f"Failed to insert: {title}: {e}")

                    except Exception as e:
                        logger.debug(f"Error parsing event: {e}")
                        continue

                if event_elements:
                    break

            except requests.RequestException as e:
                logger.debug(f"Request failed for {url}: {e}")
                continue

        logger.info(f"Boggs Social crawl complete: {events_found} found, {events_new} new, {events_updated} updated")

    except Exception as e:
        logger.error(f"Failed to crawl Boggs Social & Supply: {e}")
        raise

    return events_found, events_new, events_updated
