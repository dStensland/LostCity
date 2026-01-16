"""
Crawler for Monday Night Brewing (mondaynightbrewing.com/category/events).
Popular Atlanta brewery with multiple taproom locations hosting weekly events.
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

BASE_URL = "https://mondaynightbrewing.com"
EVENTS_URL = f"{BASE_URL}/category/events/"

# Monday Night has multiple locations
VENUES = {
    "garage": {
        "name": "Monday Night Garage",
        "slug": "monday-night-garage",
        "address": "933 Lee St SW",
        "neighborhood": "West End",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30310",
        "venue_type": "brewery",
        "website": BASE_URL,
    },
    "west_midtown": {
        "name": "Monday Night Brewing West Midtown",
        "slug": "monday-night-west-midtown",
        "address": "670 Trabert Ave NW",
        "neighborhood": "Westside",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30318",
        "venue_type": "brewery",
        "website": BASE_URL,
    },
}

# Default venue if location not specified
DEFAULT_VENUE = VENUES["garage"]


def parse_date(date_text: str) -> Optional[str]:
    """Parse date from various WordPress formats."""
    date_text = date_text.strip()

    # Try "January 16, 2026" format
    for fmt in ["%B %d, %Y", "%b %d, %Y", "%m/%d/%Y"]:
        try:
            dt = datetime.strptime(date_text, fmt)
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            continue

    # Try to find date in text
    match = re.search(r"(\w+)\s+(\d{1,2}),?\s*(\d{4})?", date_text)
    if match:
        month, day, year = match.groups()
        if not year:
            year = str(datetime.now().year)
        for fmt in ["%B %d %Y", "%b %d %Y"]:
            try:
                dt = datetime.strptime(f"{month} {day} {year}", fmt)
                if dt < datetime.now():
                    dt = datetime.strptime(f"{month} {day} {int(year) + 1}", fmt)
                return dt.strftime("%Y-%m-%d")
            except ValueError:
                continue

    return None


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


def determine_venue(text: str) -> dict:
    """Determine which Monday Night location based on text."""
    text_lower = text.lower()
    if "garage" in text_lower or "lee st" in text_lower or "west end" in text_lower:
        return VENUES["garage"]
    elif "west midtown" in text_lower or "trabert" in text_lower:
        return VENUES["west_midtown"]
    return DEFAULT_VENUE


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Monday Night Brewing events."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36"
    }

    # Pre-create venues
    venue_ids = {
        "garage": get_or_create_venue(VENUES["garage"]),
        "west_midtown": get_or_create_venue(VENUES["west_midtown"]),
    }

    try:
        logger.info(f"Fetching Monday Night Brewing: {EVENTS_URL}")
        response = requests.get(EVENTS_URL, headers=headers, timeout=30)
        response.raise_for_status()

        soup = BeautifulSoup(response.text, "html.parser")

        # WordPress block structure - find post items
        posts = soup.find_all("li", class_=re.compile(r"wp-block-post"))
        if not posts:
            # Fallback: look for article tags
            posts = soup.find_all("article")

        for post in posts:
            # Find title
            title_el = post.find(class_=re.compile(r"wp-block-post-title")) or post.find(["h2", "h3"])
            if not title_el:
                continue

            title = title_el.get_text(strip=True)
            if not title or len(title) < 3:
                continue

            # Find date
            date_el = post.find(class_=re.compile(r"wp-block-post-date")) or post.find("time")
            if date_el:
                date_text = date_el.get("datetime", "") or date_el.get_text(strip=True)
                start_date = parse_date(date_text)
            else:
                # Try to find date in post text
                post_text = post.get_text(" ", strip=True)
                start_date = parse_date(post_text)

            if not start_date:
                continue

            # Find excerpt/description
            excerpt_el = post.find(class_=re.compile(r"wp-block-post-excerpt"))
            excerpt = excerpt_el.get_text(strip=True) if excerpt_el else None

            # Get full post text for time and location parsing
            post_text = post.get_text(" ", strip=True)

            # Find time
            start_time = parse_time(post_text)

            # Determine location
            venue_data = determine_venue(post_text + " " + (excerpt or ""))
            venue_key = "garage" if venue_data == VENUES["garage"] else "west_midtown"
            venue_id = venue_ids[venue_key]

            events_found += 1

            # Generate content hash
            content_hash = generate_content_hash(title, venue_data["name"], start_date)

            # Check for existing
            existing = find_event_by_hash(content_hash)
            if existing:
                events_updated += 1
                continue

            # Find link to full post
            link_el = title_el.find("a") or post.find("a", href=True)
            event_url = link_el.get("href", EVENTS_URL) if link_el else EVENTS_URL

            # Determine category based on content
            tags = ["brewery", "monday-night"]
            title_lower = title.lower()

            if "trivia" in title_lower:
                category = "nightlife"
                subcategory = "trivia"
                tags.append("trivia")
            elif any(w in title_lower for w in ["music", "live", "band", "concert"]):
                category = "music"
                subcategory = "concert"
                tags.append("live-music")
            elif any(w in title_lower for w in ["yoga", "fitness", "run"]):
                category = "fitness"
                subcategory = None
                tags.append("fitness")
            elif any(w in title_lower for w in ["market", "pop-up", "vendor"]):
                category = "community"
                subcategory = None
                tags.append("market")
            else:
                category = "food_drink"
                subcategory = None

            event_record = {
                "source_id": source_id,
                "venue_id": venue_id,
                "title": title,
                "description": excerpt,
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
                "is_free": True,  # Most brewery events are free
                "source_url": event_url,
                "ticket_url": None,
                "image_url": None,
                "raw_text": post_text[:500] if post_text else None,
                "extraction_confidence": 0.8,
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

        logger.info(f"Monday Night Brewing crawl complete: {events_found} found, {events_new} new")

    except Exception as e:
        logger.error(f"Failed to crawl Monday Night Brewing: {e}")
        raise

    return events_found, events_new, events_updated
