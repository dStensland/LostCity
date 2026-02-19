"""
Crawler for Georgia Ovarian Cancer Alliance (gaovariancancer.org).

The Georgia Ovarian Cancer Alliance provides support, education, and
awareness for ovarian cancer patients and families.

Events include:
- Teal Trot 5K at Chastain Park (major annual walk)
- Support group meetings
- Educational workshops
- Awareness campaigns

Located in Buckhead area, serving Georgia.
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
from date_utils import parse_human_date

logger = logging.getLogger(__name__)

BASE_URL = "https://gaovariancancer.org"
EVENTS_URL = f"{BASE_URL}/events"

VENUE_DATA = {
    "name": "Georgia Ovarian Cancer Alliance",
    "slug": "georgia-ovarian-cancer",
    "address": "Atlanta, GA",
    "neighborhood": "Buckhead",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30305",
    "lat": 33.8380,
    "lng": -84.3790,
    "venue_type": "organization",
    "spot_type": "organization",
    "website": BASE_URL,
    "vibes": ["ovarian-cancer", "awareness", "support", "teal"],
}


def parse_time_string(time_str: str) -> Optional[str]:
    """Parse time string to 24-hour format."""
    try:
        time_str = time_str.strip().upper()
        match = re.search(r'(\d{1,2})(?::(\d{2}))?\s*(AM|PM)', time_str)
        if match:
            hour = int(match.group(1))
            minute = match.group(2) or "00"
            period = match.group(3)

            if period == "PM" and hour != 12:
                hour += 12
            elif period == "AM" and hour == 12:
                hour = 0

            return f"{hour:02d}:{minute}"
    except (ValueError, AttributeError) as e:
        logger.debug(f"Could not parse time '{time_str}': {e}")

    return None


def categorize_event(title: str, description: str = "") -> tuple[str, list[str], bool]:
    """Determine category, tags, and is_free flag."""
    text = f"{title} {description}".lower()
    tags = ["ovarian-cancer"]

    # Teal Trot 5K
    if any(word in text for word in ["teal trot", "5k", "walk", "run", "fundraiser"]):
        category = "community"
        tags.extend(["fundraiser", "5k", "awareness", "outdoor"])
        is_free = "free registration" in text

    # Support groups
    elif any(word in text for word in ["support group", "patient support", "survivor"]):
        category = "wellness"
        tags.extend(["support-group", "patient-support", "mental-health"])
        is_free = "free" in text or "no cost" in text

    # Educational events
    elif any(word in text for word in ["workshop", "education", "seminar", "webinar"]):
        category = "learning"
        tags.extend(["education", "health-education"])
        is_free = "free" in text or "no cost" in text

    # Awareness
    elif any(word in text for word in ["awareness", "campaign", "teal"]):
        category = "community"
        tags.extend(["awareness", "advocacy"])
        is_free = "free" in text or "no cost" in text

    else:
        category = "community"
        is_free = "free" in text or "no cost" in text

    if "free" in text:
        tags.append("free")

    return category, list(set(tags)), is_free


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Georgia Ovarian Cancer Alliance events."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        venue_id = get_or_create_venue(VENUE_DATA)

        logger.info(f"Fetching GOCA events: {EVENTS_URL}")

        response = requests.get(
            EVENTS_URL,
            headers={"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"},
            timeout=20
        )

        if response.status_code != 200:
            logger.info(f"GOCA venue record ensured (ID: {venue_id})")
            return 0, 0, 0

        soup = BeautifulSoup(response.text, "html.parser")

        event_containers = soup.find_all("div", class_=lambda x: x and "event" in x.lower())
        if not event_containers:
            event_containers = soup.find_all("article")

        if not event_containers:
            logger.info("No event containers found")
            return 0, 0, 0

        logger.info(f"Found {len(event_containers)} potential events")

        today = datetime.now().date()

        for container in event_containers:
            try:
                title_elem = container.find(["h1", "h2", "h3", "h4"])
                if not title_elem:
                    continue

                title = title_elem.get_text(strip=True)

                if len(title) < 5:
                    continue

                # Extract date
                date_elem = container.find(["time", "span"], class_=lambda x: x and "date" in (x or "").lower())
                date_str = None

                if date_elem:
                    date_str = date_elem.get_text(strip=True)

                if not date_str:
                    date_match = re.search(
                        r'(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:,?\s+\d{4})?',
                        container.get_text(),
                        re.IGNORECASE
                    )
                    if date_match:
                        date_str = date_match.group(0)

                if not date_str:
                    continue

                start_date = parse_human_date(date_str)
                if not start_date:
                    continue

                # Skip past events
                try:
                    event_date = datetime.strptime(start_date, "%Y-%m-%d").date()
                    if event_date < today:
                        continue
                except ValueError:
                    continue

                events_found += 1

                # Extract time
                time_match = re.search(r'\d{1,2}(?::\d{2})?\s*(?:AM|PM|am|pm)', container.get_text())
                start_time = None
                if time_match:
                    start_time = parse_time_string(time_match.group(0))

                # Extract description
                desc_elem = container.find("p")
                description = None
                if desc_elem:
                    description = desc_elem.get_text(" ", strip=True)[:500]

                # Get event URL
                link_elem = container.find("a")
                event_url = EVENTS_URL
                if link_elem and link_elem.get("href"):
                    href = link_elem.get("href")
                    if href.startswith("http"):
                        event_url = href
                    elif href.startswith("/"):
                        event_url = f"{BASE_URL}{href}"

                category, tags, is_free = categorize_event(title, description or "")

                content_hash = generate_content_hash(
                    title, "Georgia Ovarian Cancer Alliance", start_date
                )


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
                    "subcategory": None,
                    "tags": tags,
                    "price_min": None,
                    "price_max": None,
                    "price_note": None,
                    "is_free": is_free,
                    "source_url": event_url,
                    "ticket_url": event_url,
                    "image_url": None,
                    "raw_text": container.get_text()[:500],
                    "extraction_confidence": 0.75,
                    "is_recurring": False,
                    "recurrence_rule": None,
                    "content_hash": content_hash,
                }

                existing = find_event_by_hash(content_hash)
                if existing:
                    smart_update_existing_event(existing, event_record)
                    events_updated += 1
                    continue

                try:
                    insert_event(event_record)
                    events_new += 1
                    logger.info(f"Added: {title} on {start_date}")
                except Exception as e:
                    logger.error(f"Failed to insert event '{title}': {e}")

            except Exception as e:
                logger.debug(f"Failed to parse event container: {e}")
                continue

        logger.info(
            f"GOCA crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl GOCA: {e}")
        raise

    return events_found, events_new, events_updated
