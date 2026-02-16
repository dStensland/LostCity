"""
Crawler for Pancreatic Cancer Action Network Atlanta (pancan.org).

PanCAN provides support, research funding, and advocacy for pancreatic
cancer patients and families.

Events include:
- PurpleStride Atlanta (major annual walk - April 25, 2026)
- Patient and caregiver support groups
- Educational webinars
- Advocacy events

Virtual-first organization with events at various Atlanta locations.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime
from typing import Optional

import requests
from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout

from db import get_or_create_venue, insert_event, find_event_by_hash
from dedupe import generate_content_hash
from date_utils import parse_human_date

logger = logging.getLogger(__name__)

BASE_URL = "https://www.pancan.org"
EVENTS_URL = f"{BASE_URL}/events"
ATLANTA_URL = f"{BASE_URL}/purplestride-atlanta"

VENUE_DATA = {
    "name": "Pancreatic Cancer Action Network Atlanta",
    "slug": "pancan-atlanta",
    "address": "Atlanta, GA",
    "neighborhood": "Midtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30308",
    "lat": 33.7834,
    "lng": -84.3831,
    "venue_type": "organization",
    "spot_type": "organization",
    "website": BASE_URL,
    "vibes": ["pancreatic-cancer", "advocacy", "research", "support"],
}


def parse_time_string(time_str: str) -> Optional[str]:
    """Parse time string to 24-hour format."""
    try:
        time_str = time_str.strip().upper()
        time_str = re.sub(r'\s+(ET|EST|EDT|CT|CST|CDT|PT|PST|PDT)$', '', time_str)

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
    tags = ["pancreatic-cancer"]

    # PurpleStride walks
    if any(word in text for word in ["purplestride", "walk", "5k", "fundraiser"]):
        category = "community"
        tags.extend(["fundraiser", "walk", "awareness", "outdoor"])
        is_free = "free registration" in text or "no registration fee" in text

    # Support groups
    elif any(word in text for word in ["support group", "patient support", "caregiver"]):
        category = "wellness"
        tags.extend(["support-group", "patient-support", "mental-health"])
        is_free = True

    # Educational webinars
    elif any(word in text for word in ["webinar", "education", "workshop", "seminar", "learn"]):
        category = "learning"
        tags.extend(["education", "health-education", "patient-education"])
        is_free = True

    # Advocacy events
    elif any(word in text for word in ["advocacy", "awareness", "campaign"]):
        category = "community"
        tags.extend(["advocacy", "awareness"])
        is_free = True

    else:
        category = "community"
        tags.append("community-health")
        is_free = True

    if "free" in text or "no cost" in text:
        is_free = True
        tags.append("free")

    return category, list(set(tags)), is_free


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl PanCAN Atlanta events."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        venue_id = get_or_create_venue(VENUE_DATA)

        urls_to_try = [ATLANTA_URL, EVENTS_URL]

        for url in urls_to_try:
            logger.info(f"Fetching PanCAN page: {url}")

            try:
                response = requests.get(
                    url,
                    headers={"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"},
                    timeout=20
                )

                if response.status_code != 200:
                    continue

                soup = BeautifulSoup(response.text, "html.parser")

                # Look for event containers
                event_containers = soup.find_all("div", class_=lambda x: x and "event" in x.lower())

                if not event_containers:
                    event_containers = soup.find_all("article")

                if not event_containers:
                    logger.debug(f"No event containers found on {url}")
                    continue

                logger.info(f"Found {len(event_containers)} potential events")

                today = datetime.now().date()

                for container in event_containers:
                    try:
                        title_elem = container.find(["h1", "h2", "h3", "h4"])
                        if not title_elem:
                            continue

                        title = title_elem.get_text(strip=True)

                        if len(title) < 5 or "atlanta" not in title.lower():
                            continue

                        # Extract date
                        date_elem = container.find(["time", "span"], class_=lambda x: x and "date" in (x or "").lower())
                        date_str = None

                        if date_elem:
                            date_str = date_elem.get_text(strip=True)
                            if date_elem.name == "time" and date_elem.get("datetime"):
                                date_str = date_elem.get("datetime")

                        if not date_str:
                            text = container.get_text()
                            date_match = re.search(
                                r'(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:,?\s+\d{4})?',
                                text,
                                re.IGNORECASE
                            )
                            if date_match:
                                date_str = date_match.group(0)

                        if not date_str:
                            logger.debug(f"No date found for: {title}")
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
                        event_url = url
                        if link_elem and link_elem.get("href"):
                            href = link_elem.get("href")
                            if href.startswith("http"):
                                event_url = href
                            elif href.startswith("/"):
                                event_url = f"{BASE_URL}{href}"

                        category, tags, is_free = categorize_event(title, description or "")

                        content_hash = generate_content_hash(
                            title, "Pancreatic Cancer Action Network Atlanta", start_date
                        )

                        if find_event_by_hash(content_hash):
                            events_updated += 1
                            continue

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

                        try:
                            insert_event(event_record)
                            events_new += 1
                            logger.info(f"Added: {title} on {start_date}")
                        except Exception as e:
                            logger.error(f"Failed to insert event '{title}': {e}")

                    except Exception as e:
                        logger.debug(f"Failed to parse event container: {e}")
                        continue

                if events_found > 0:
                    break

            except requests.RequestException as e:
                logger.debug(f"Failed to fetch {url}: {e}")
                continue

        logger.info(
            f"PanCAN Atlanta crawl complete: {events_found} found, "
            f"{events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl PanCAN Atlanta: {e}")
        raise

    return events_found, events_new, events_updated
