"""
Crawler for Cabbagetown Neighborhood (cabbagetown.com).
Historic mill village neighborhood with active community calendar including
concerts, Forward Warrior mural festival, tour of homes, and more.
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

BASE_URL = "https://cabbagetown.com"
CALENDAR_URL = f"{BASE_URL}/calendar"

# Default venue for neighborhood-wide events
VENUE_DATA = {
    "name": "Cabbagetown",
    "slug": "cabbagetown-neighborhood",
    "address": "177 Carroll St SE",
    "neighborhood": "Cabbagetown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30312",
    "lat": 33.7495,
    "lng": -84.3535,
    "venue_type": "neighborhood",
    "spot_type": "neighborhood",
    "website": BASE_URL,
}

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
}


def parse_date(date_str: str) -> Optional[str]:
    """Parse date from various formats."""
    date_str = date_str.strip()

    # Try common formats
    formats = [
        "%B %d, %Y",      # January 15, 2026
        "%b %d, %Y",      # Jan 15, 2026
        "%m/%d/%Y",       # 01/15/2026
        "%Y-%m-%d",       # 2026-01-15
    ]

    for fmt in formats:
        try:
            dt = datetime.strptime(date_str, fmt)
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            continue

    return None


def parse_time(time_str: str) -> Optional[str]:
    """Parse time from '7:00 PM' format."""
    match = re.search(r"(\d{1,2}):?(\d{2})?\s*(am|pm)", time_str, re.IGNORECASE)
    if match:
        hour = int(match.group(1))
        minute = int(match.group(2)) if match.group(2) else 0
        period = match.group(3).lower()
        if period == "pm" and hour != 12:
            hour += 12
        elif period == "am" and hour == 12:
            hour = 0
        return f"{hour:02d}:{minute:02d}"
    return None


def determine_category(title: str) -> tuple[str, Optional[str], list[str]]:
    """Determine category based on event title."""
    title_lower = title.lower()
    tags = ["cabbagetown", "neighborhood"]

    if "concert" in title_lower or "music" in title_lower or "band" in title_lower:
        return "music", "live", tags + ["live-music"]
    if "mural" in title_lower or "art" in title_lower or "forward warrior" in title_lower:
        return "art", "street", tags + ["street-art", "mural"]
    if "tour" in title_lower and "home" in title_lower:
        return "community", None, tags + ["tour-of-homes", "architecture"]
    if "market" in title_lower or "vendor" in title_lower:
        return "community", "market", tags + ["market"]
    if "meeting" in title_lower:
        return "community", None, tags + ["meeting"]
    if "cleanup" in title_lower or "volunteer" in title_lower:
        return "community", None, tags + ["volunteer"]

    return "community", None, tags


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Cabbagetown community calendar."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        # Fetch calendar page
        response = requests.get(CALENDAR_URL, headers=HEADERS, timeout=30)
        response.raise_for_status()

        soup = BeautifulSoup(response.text, "html.parser")
        venue_id = get_or_create_venue(VENUE_DATA)

        # Look for event containers - common patterns
        event_elements = soup.select(".event, .calendar-event, [class*='event-item'], article")

        if not event_elements:
            # Try alternative: look for date headers with content
            logger.info("No event elements found with standard selectors, trying alternative parsing")
            event_elements = soup.find_all(["div", "article", "section"], class_=re.compile(r"event|calendar", re.I))

        for element in event_elements:
            try:
                # Extract title
                title_elem = element.find(["h2", "h3", "h4", "a", ".title", ".event-title"])
                if not title_elem:
                    continue
                title = title_elem.get_text(strip=True)
                if not title or len(title) < 3:
                    continue

                # Extract date
                date_elem = element.find(class_=re.compile(r"date|time", re.I)) or element.find("time")
                if not date_elem:
                    # Look for date in text
                    text = element.get_text()
                    date_match = re.search(
                        r"(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s*\d{4}",
                        text,
                        re.IGNORECASE
                    )
                    if date_match:
                        date_str = date_match.group()
                    else:
                        continue
                else:
                    date_str = date_elem.get_text(strip=True)

                start_date = parse_date(date_str)
                if not start_date:
                    continue

                # Skip past events
                if datetime.strptime(start_date, "%Y-%m-%d").date() < datetime.now().date():
                    continue

                events_found += 1

                # Extract time if available
                time_match = re.search(r"\d{1,2}:?\d{0,2}\s*(am|pm)", element.get_text(), re.IGNORECASE)
                start_time = parse_time(time_match.group()) if time_match else None

                # Extract description
                desc_elem = element.find(class_=re.compile(r"desc|summary|content", re.I))
                description = desc_elem.get_text(strip=True) if desc_elem else f"Community event in Cabbagetown"

                # Extract URL
                link = element.find("a", href=True)
                event_url = link["href"] if link else CALENDAR_URL
                if event_url.startswith("/"):
                    event_url = BASE_URL + event_url

                # Generate hash
                content_hash = generate_content_hash(title, "Cabbagetown", start_date)

                if find_event_by_hash(content_hash):
                    events_updated += 1
                    continue

                category, subcategory, tags = determine_category(title)

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
                    "is_free": True,
                    "source_url": event_url,
                    "ticket_url": None,
                    "image_url": None,
                    "raw_text": element.get_text()[:1000],
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
                logger.debug(f"Error parsing event element: {e}")
                continue

        logger.info(f"Cabbagetown crawl complete: {events_found} found, {events_new} new, {events_updated} updated")

    except Exception as e:
        logger.error(f"Failed to crawl Cabbagetown: {e}")
        raise

    return events_found, events_new, events_updated
