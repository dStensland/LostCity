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


def parse_time(time_str: str) -> Optional[str]:
    """Parse time from various formats."""
    if not time_str:
        return None

    # Clean up common patterns
    time_str = time_str.strip().lower()

    # Match patterns like "8:00 PM", "8 PM", "8:00pm", "8pm"
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
                logger.info(f"Trying URL: {url}")
                response = requests.get(url, headers=HEADERS, timeout=30)
                if response.status_code != 200:
                    logger.debug(f"URL {url} returned {response.status_code}")
                    continue

                soup = BeautifulSoup(response.text, "html.parser")

                # Look for Squarespace event collection elements
                event_elements = soup.select("article.eventlist-event")

                if not event_elements:
                    logger.debug(f"No Squarespace events found at {url}")
                    continue

                logger.info(f"Found {len(event_elements)} events at {url}")

                for element in event_elements:
                    try:
                        # Extract title from Squarespace event title link
                        title_elem = element.select_one(".eventlist-title-link")
                        if not title_elem:
                            logger.debug("No title link found, skipping event")
                            continue

                        title = title_elem.get_text(strip=True)
                        if not title or len(title) < 3:
                            logger.debug(f"Title too short: '{title}'")
                            continue

                        # Skip Google Calendar export links (these aren't event titles)
                        if "google calendar" in title.lower() or "add to calendar" in title.lower():
                            logger.debug(f"Skipping calendar link: {title}")
                            continue

                        # Extract date from time element with datetime attribute
                        date_elem = element.select_one("time.event-date")
                        if not date_elem or not date_elem.get("datetime"):
                            logger.debug(f"No date found for: {title}")
                            continue

                        # Squarespace provides ISO format date like "2026-02-05"
                        start_date = date_elem["datetime"]

                        # Validate date format
                        try:
                            date_obj = datetime.strptime(start_date, "%Y-%m-%d")
                        except ValueError:
                            logger.debug(f"Invalid date format: {start_date}")
                            continue

                        # Skip past events
                        if date_obj.date() < datetime.now().date():
                            logger.debug(f"Skipping past event: {title} on {start_date}")
                            continue

                        events_found += 1

                        # Extract time from time element
                        time_elem = element.select_one("time.event-time-localized")
                        start_time = None
                        if time_elem:
                            time_text = time_elem.get_text(strip=True)
                            start_time = parse_time(time_text)

                        # Default to 9pm if no time found
                        if not start_time:
                            start_time = "21:00"

                        # Extract description
                        description = None
                        desc_elem = element.select_one("div.eventlist-excerpt")
                        if desc_elem:
                            description = desc_elem.get_text(strip=True)

                        if not description:
                            description = f"Event at Star Community Bar in Little Five Points"

                        # Extract image
                        image_url = None
                        img_container = element.select_one("a.eventlist-column-thumbnail")
                        if img_container:
                            img_elem = img_container.find("img")
                            if img_elem and img_elem.get("src"):
                                image_url = img_elem["src"]
                                # Ensure absolute URL
                                if image_url.startswith("//"):
                                    image_url = "https:" + image_url
                                elif image_url.startswith("/"):
                                    image_url = BASE_URL + image_url

                        # Extract event URL
                        event_url = title_elem["href"] if title_elem.get("href") else url
                        if event_url.startswith("/"):
                            event_url = BASE_URL + event_url

                        # Generate hash for deduplication
                        content_hash = generate_content_hash(
                            title, "Star Community Bar", start_date
                        )

                        if find_event_by_hash(content_hash):
                            events_updated += 1
                            logger.debug(f"Event already exists: {title}")
                            continue

                        category, subcategory, tags = determine_category(title)

                        # Get raw text for debugging
                        raw_text = element.get_text(separator=" ", strip=True)[:500]

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
                            "price_min": None,
                            "price_max": None,
                            "price_note": None,
                            "is_free": False,
                            "source_url": event_url,
                            "ticket_url": event_url,
                            "image_url": image_url,
                            "raw_text": raw_text,
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

                # Found events, stop trying other paths
                if event_elements:
                    break

            except requests.RequestException as e:
                logger.debug(f"Request failed for {url}: {e}")
                continue

        logger.info(f"Star Bar crawl complete: {events_found} found, {events_new} new, {events_updated} updated")

    except Exception as e:
        logger.error(f"Failed to crawl Star Community Bar: {e}")
        raise

    return events_found, events_new, events_updated
