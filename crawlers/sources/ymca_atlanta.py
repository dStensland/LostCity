"""
Crawler for YMCA of Metro Atlanta Events (ymcaatlanta.org/events).
Community events, fitness classes, family programs, and wellness activities.
Uses requests for faster page loading.
"""

import logging
import re
from datetime import datetime
from typing import Optional

import requests
from bs4 import BeautifulSoup

from db import get_or_create_venue, insert_event, find_event_by_hash
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://ymcaatlanta.org"
EVENTS_URL = f"{BASE_URL}/events"

VENUE_DATA = {
    "name": "YMCA of Metro Atlanta",
    "slug": "ymca-atlanta",
    "address": "100 Edgewood Avenue NE",
    "neighborhood": "Downtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30303",
    "venue_type": "community",
    "website": BASE_URL,
}


def parse_date(date_str: str) -> Optional[str]:
    """Parse various date formats to YYYY-MM-DD."""
    if not date_str:
        return None

    date_str = date_str.strip()

    # Remove day of week
    date_str = re.sub(r"^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*,?\s*", "", date_str, flags=re.I)
    date_str = re.sub(r"^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s*", "", date_str, flags=re.I)

    # Try common formats
    for fmt in [
        "%B %d, %Y",
        "%b %d, %Y",
        "%m/%d/%Y",
        "%Y-%m-%d",
    ]:
        try:
            dt = datetime.strptime(date_str, fmt)
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            continue

    # Try without year (assume current or next year)
    current_year = datetime.now().year
    for fmt in ["%B %d", "%b %d", "%m/%d"]:
        try:
            dt = datetime.strptime(date_str, fmt)
            dt = dt.replace(year=current_year)
            # If date is in the past, try next year
            if dt < datetime.now():
                dt = dt.replace(year=current_year + 1)
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            continue

    return None


def parse_time(time_str: str) -> Optional[str]:
    """Parse time from various formats."""
    if not time_str:
        return None

    # Try to match time patterns
    match = re.search(r'(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)', time_str)
    if match:
        hour, minute, period = match.groups()
        hour = int(hour)
        if period.upper() == "PM" and hour != 12:
            hour += 12
        elif period.upper() == "AM" and hour == 12:
            hour = 0
        return f"{hour:02d}:{minute}"

    # Try just hour
    match = re.search(r'(\d{1,2})\s*(AM|PM|am|pm)', time_str)
    if match:
        hour, period = match.groups()
        hour = int(hour)
        if period.upper() == "PM" and hour != 12:
            hour += 12
        elif period.upper() == "AM" and hour == 12:
            hour = 0
        return f"{hour:02d}:00"

    return None


def categorize_event(title: str, description: str) -> tuple[str, str]:
    """Determine category and subcategory."""
    title_lower = title.lower()
    desc_lower = description.lower()

    # Fitness
    if any(word in title_lower for word in [
        "fitness", "yoga", "zumba", "cycling", "workout",
        "exercise", "pilates", "bootcamp", "training"
    ]):
        return "sports", "fitness"

    # Swimming
    if any(word in title_lower for word in ["swim", "aquatics", "pool"]):
        return "sports", "swimming"

    # Youth programs
    if any(word in title_lower for word in ["kids", "youth", "children", "teen", "camp"]):
        return "community", "family"

    # Community events
    if any(word in title_lower for word in ["community", "family", "volunteer", "fundraiser"]):
        return "community", "community"

    # Sports
    if any(word in title_lower for word in ["basketball", "soccer", "sports", "league"]):
        return "sports", "recreational"

    # Health/Wellness
    if any(word in title_lower for word in ["health", "wellness", "nutrition", "diabetes"]):
        return "community", "wellness"

    # Default to community
    return "community", "community"


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl YMCA Atlanta events using requests."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        logger.info(f"Fetching YMCA Atlanta: {EVENTS_URL}")

        headers = {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
        }
        response = requests.get(EVENTS_URL, headers=headers, timeout=30)
        response.raise_for_status()

        soup = BeautifulSoup(response.text, "html.parser")

        venue_id = get_or_create_venue(VENUE_DATA)

        # Parse events - look for event containers
        # YMCA uses a grid of event cards
        event_blocks = soup.find_all("article", class_=re.compile(r"node--type-event"))

        if not event_blocks:
            # Try alternate selectors
            event_blocks = soup.find_all("div", class_=re.compile(r"(event-teaser|event-card|views-row)"))

        if not event_blocks:
            # Look for cards or items
            event_blocks = soup.find_all("div", class_=re.compile(r"card"))

        logger.info(f"Found {len(event_blocks)} potential event blocks")

        for block in event_blocks:
            try:
                # Extract title - YMCA uses h2.post-title or div.event-title
                title_elem = block.find("h2", class_="post-title")
                if not title_elem:
                    title_elem = block.find("div", class_="event-title")
                if not title_elem:
                    title_elem = block.find("a")

                if not title_elem:
                    continue

                title = title_elem.get_text(strip=True)
                if not title or len(title) < 3:
                    continue

                # Extract event URL
                link_elem = block.find("a", href=True)
                event_url = None
                if link_elem and link_elem.get("href"):
                    href = link_elem.get("href")
                    if href.startswith("http"):
                        event_url = href
                    else:
                        event_url = f"{BASE_URL}{href}" if href.startswith("/") else f"{BASE_URL}/{href}"

                # Extract date - YMCA uses div.event-date__event-day and div.event-date__event-month
                day_elem = block.find("div", class_="event-date__event-day")
                month_elem = block.find("div", class_="event-date__event-month")

                if not day_elem or not month_elem:
                    continue

                day = day_elem.get_text(strip=True)
                month = month_elem.get_text(strip=True)

                # Build date string and parse
                current_year = datetime.now().year
                date_text = f"{month} {day}, {current_year}"
                start_date = parse_date(date_text)

                # If date is in the past, try next year
                if start_date:
                    from datetime import datetime as dt
                    parsed = dt.strptime(start_date, "%Y-%m-%d")
                    if parsed < dt.now():
                        start_date = f"{current_year + 1}-{parsed.month:02d}-{parsed.day:02d}"

                if not start_date:
                    continue

                events_found += 1

                # Extract time from event-date__event-time
                time_elem = block.find("div", class_="event-date__event-time")
                time_text = time_elem.get_text(strip=True) if time_elem else ""
                start_time = parse_time(time_text)

                # Extract description
                desc_elem = block.find(class_=re.compile(r"(description|summary|field--name-body)"))
                description = desc_elem.get_text(strip=True)[:500] if desc_elem else ""

                # Extract image
                img_elem = block.find("img")
                image_url = None
                if img_elem:
                    src = img_elem.get("src")
                    if src:
                        if src.startswith("http"):
                            image_url = src
                        elif src.startswith("/"):
                            image_url = f"{BASE_URL}{src}"

                # Check for duplicates
                content_hash = generate_content_hash(title, VENUE_DATA["name"], start_date)
                existing = find_event_by_hash(content_hash)
                if existing:
                    events_updated += 1
                    continue

                # Categorize
                category, subcategory = categorize_event(title, description)

                # Build tags
                tags = ["ymca", "community", "wellness", "family-friendly"]

                event_record = {
                    "source_id": source_id,
                    "venue_id": venue_id,
                    "title": title,
                    "description": description or "Event at YMCA of Metro Atlanta",
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
                    "price_note": "Member pricing may vary",
                    "is_free": None,
                    "source_url": event_url or EVENTS_URL,
                    "ticket_url": None,
                    "image_url": image_url,
                    "raw_text": None,
                    "extraction_confidence": 0.75,
                    "is_recurring": False,
                    "recurrence_rule": None,
                    "content_hash": content_hash,
                }

                try:
                    insert_event(event_record)
                    events_new += 1
                    logger.debug(f"Added: {title} on {start_date}")
                except Exception as e:
                    logger.error(f"Failed to insert {title}: {e}")

            except Exception as e:
                logger.debug(f"Error processing event block: {e}")
                continue

        logger.info(
            f"YMCA Atlanta: Found {events_found} events, {events_new} new, {events_updated} existing"
        )

    except Exception as e:
        logger.error(f"Failed to crawl YMCA Atlanta: {e}")
        raise

    return events_found, events_new, events_updated
