"""
Crawler for Creative Loafing Atlanta (creativeloafing.com/atlanta-events).
Atlanta's best local events calendar, covering music, art, food, and more.
This is an aggregator source - events link to external venues.
"""

from __future__ import annotations

import re
import json
import logging
from datetime import datetime
from typing import Optional

import requests
from bs4 import BeautifulSoup

from db import get_or_create_venue, insert_event, find_event_by_hash
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://creativeloafing.com"
EVENTS_URL = f"{BASE_URL}/atlanta-events"

# Creative Loafing is an aggregator, not a venue
# We'll create venues dynamically based on event data


def parse_date(date_text: str) -> Optional[str]:
    """Parse date from '01/16/2026' or 'January 16, 2026' format."""
    date_text = date_text.strip()

    # Try MM/DD/YYYY format
    match = re.search(r"(\d{1,2})/(\d{1,2})/(\d{4})", date_text)
    if match:
        month, day, year = match.groups()
        try:
            dt = datetime(int(year), int(month), int(day))
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            pass

    # Try "January 16, 2026" format
    for fmt in ["%B %d, %Y", "%B %d %Y", "%b %d, %Y", "%b %d %Y"]:
        try:
            dt = datetime.strptime(date_text, fmt)
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            continue

    # Try finding date pattern in text
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
    """Parse time from '8:00 PM' format."""
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


def determine_category(text: str) -> tuple[str, Optional[str], list]:
    """Determine category based on event text."""
    text_lower = text.lower()
    tags = ["creative-loafing"]

    if any(w in text_lower for w in ["concert", "live music", "band", "tour", "dj"]):
        tags.append("music")
        if "dj" in text_lower:
            return "music", "dj", tags
        return "music", "concert", tags

    if any(w in text_lower for w in ["comedy", "stand-up", "comedian", "improv"]):
        tags.append("comedy")
        return "comedy", None, tags

    if any(w in text_lower for w in ["theater", "theatre", "play", "musical", "broadway"]):
        tags.append("theater")
        if "musical" in text_lower:
            return "theater", "musical", tags
        return "theater", None, tags

    if any(w in text_lower for w in ["art", "gallery", "exhibit", "museum"]):
        tags.append("art")
        return "art", "exhibit", tags

    if any(w in text_lower for w in ["film", "movie", "screening", "cinema"]):
        tags.append("film")
        return "film", "screening", tags

    if any(w in text_lower for w in ["food", "tasting", "dinner", "brunch", "restaurant"]):
        tags.append("food")
        return "food_drink", None, tags

    if any(w in text_lower for w in ["beer", "brewery", "wine", "cocktail", "bar"]):
        tags.append("drinks")
        return "food_drink", None, tags

    if any(w in text_lower for w in ["trivia", "karaoke", "drag", "party"]):
        tags.append("nightlife")
        return "nightlife", None, tags

    if any(w in text_lower for w in ["festival", "market", "fair"]):
        tags.append("community")
        return "community", None, tags

    if any(w in text_lower for w in ["yoga", "run", "fitness", "workout"]):
        tags.append("fitness")
        return "fitness", None, tags

    return "other", None, tags


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Creative Loafing events."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36"
    }

    try:
        logger.info(f"Fetching Creative Loafing: {EVENTS_URL}")
        response = requests.get(EVENTS_URL, headers=headers, timeout=30)
        response.raise_for_status()

        soup = BeautifulSoup(response.text, "html.parser")

        # Find event containers - try multiple approaches
        # Approach 1: Look for event articles
        event_items = soup.find_all("article")

        if not event_items:
            # Approach 2: Find divs with event-like content
            event_items = soup.find_all("div", class_=re.compile(r"event|listing|item"))

        if not event_items:
            # Approach 3: Find by structure - links with dates
            event_items = soup.find_all("div", recursive=False)

        venue_cache = {}

        for item in event_items:
            # Find title
            title_el = item.find(["h2", "h3", "h4"])
            if not title_el:
                continue

            title_link = title_el.find("a") or title_el
            title = title_link.get_text(strip=True)

            if not title or len(title) < 5:
                continue

            # Skip navigation/UI elements
            skip_patterns = ["read article", "more info", "subscribe", "login"]
            if any(p in title.lower() for p in skip_patterns):
                continue

            # Get full text for parsing
            item_text = item.get_text(" ", strip=True)

            # Parse date
            start_date = parse_date(item_text)
            if not start_date:
                continue

            # Parse time
            start_time = parse_time(item_text)

            # Find venue name
            venue_name = None
            # Look for venue-like text after date/time
            venue_match = re.search(
                r"(?:at|@)\s+([A-Z][A-Za-z0-9\s&'-]+?)(?:\s*[-–|]|\s*\d{1,2}[:/]|\s*$)",
                item_text
            )
            if venue_match:
                venue_name = venue_match.group(1).strip()

            if not venue_name:
                # Try to find a separate venue element
                venue_el = item.find(class_=re.compile(r"venue|location"))
                if venue_el:
                    venue_name = venue_el.get_text(strip=True)

            # Default venue if none found
            if not venue_name or len(venue_name) < 3:
                venue_name = "Atlanta"

            # Get or create venue
            if venue_name in venue_cache:
                venue_id = venue_cache[venue_name]
            else:
                venue_data = {
                    "name": venue_name,
                    "slug": re.sub(r"[^a-z0-9]+", "-", venue_name.lower()).strip("-"),
                    "city": "Atlanta",
                    "state": "GA",
                    "venue_type": "venue",
                }
                venue_id = get_or_create_venue(venue_data)
                venue_cache[venue_name] = venue_id

            events_found += 1

            # Generate content hash
            content_hash = generate_content_hash(title, venue_name, start_date)

            # Check for existing
            existing = find_event_by_hash(content_hash)
            if existing:
                events_updated += 1
                continue

            # Get event URL
            event_url = EVENTS_URL
            if hasattr(title_link, "get") and title_link.get("href"):
                href = title_link.get("href")
                event_url = href if href.startswith("http") else f"{BASE_URL}{href}"

            # Determine category
            category, subcategory, tags = determine_category(title + " " + item_text)

            # Extract description
            desc_el = item.find("p")
            description = desc_el.get_text(strip=True) if desc_el else None

            event_record = {
                "source_id": source_id,
                "venue_id": venue_id,
                "title": title,
                "description": description[:500] if description else None,
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
                "is_free": None,  # Unknown from aggregator
                "source_url": event_url,
                "ticket_url": None,
                "image_url": None,
                "raw_text": item_text[:500] if item_text else None,
                "extraction_confidence": 0.7,  # Lower for aggregator
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

        logger.info(f"Creative Loafing crawl complete: {events_found} found, {events_new} new")

    except Exception as e:
        logger.error(f"Failed to crawl Creative Loafing: {e}")
        raise

    return events_found, events_new, events_updated
