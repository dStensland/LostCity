"""
Crawler for ATLVets - Advancing The Line (atlvets.org).

ATLVets is a veteran entrepreneurship nonprofit focused on helping veterans
transition to successful business ownership. Key programs and events:
- BATL Biz Summit (annual business summit)
- Monthly networking events
- Business development workshops
- Pitch competitions
- Mentorship programs

Virtual-first organization with Atlanta presence. Downtown address used for mapping.

STRATEGY:
- Scrape calendar page at /calendar/
- Extract business summits, networking events, workshops
- Tag: veterans, entrepreneurship, business, networking
- Category: "community" for networking, "learning" for workshops/summits
- Most events are free for veterans

Site uses The Events Calendar (WordPress/Tribe) plugin — static HTML served directly.
"""

from __future__ import annotations

import re
import logging
from typing import Optional
from datetime import datetime

import requests
from bs4 import BeautifulSoup

from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash
from date_utils import parse_human_date

logger = logging.getLogger(__name__)

BASE_URL = "https://atlvets.org"
EVENTS_URL = f"{BASE_URL}/calendar/"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    )
}

VENUE_DATA = {
    "name": "ATLVets",
    "slug": "atlvets",
    "address": "Atlanta, GA",
    "neighborhood": "Downtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30303",
    "lat": 33.7490,
    "lng": -84.3880,
    "venue_type": "organization",
    "spot_type": "organization",
    "website": BASE_URL,
    "vibes": ["veterans", "entrepreneurship", "networking"],
}


def parse_time_string(time_str: str) -> Optional[str]:
    """
    Parse time string to 24-hour format.
    Examples: '6:00 PM', '12:30 PM', '6pm', '12:30pm', '9:00 AM - 1:00 PM'
    """
    try:
        time_str = time_str.strip().upper()

        # If it's a range, extract the first time
        if "-" in time_str or "\u2013" in time_str:
            time_str = re.split(r"[-\u2013]", time_str)[0].strip()

        # Pattern: H:MM AM/PM or H AM/PM or HAM/PM
        match = re.search(r"(\d{1,2})(?::(\d{2}))?\s*(AM|PM)", time_str)
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


def determine_category_and_tags(title: str, description: str = "") -> tuple[str, list[str], bool]:
    """
    Determine category, tags, and is_free flag based on event content.
    Returns (category, tags, is_free).
    """
    text = f"{title} {description}".lower()
    tags = ["veterans", "entrepreneurship"]

    # Business summits and conferences
    if any(word in text for word in ["summit", "batl", "conference", "expo"]):
        category = "learning"
        tags.extend(["business", "summit", "networking"])

    # Workshops and training
    elif any(word in text for word in ["workshop", "training", "class", "seminar", "bootcamp", "course"]):
        category = "learning"
        tags.extend(["workshop", "business", "education"])

    # Pitch competitions
    elif any(word in text for word in ["pitch", "competition", "demo day", "showcase"]):
        category = "community"
        tags.extend(["pitch-competition", "business", "startup"])

    # Networking events
    elif any(word in text for word in ["networking", "mixer", "meetup", "social", "happy hour"]):
        category = "community"
        tags.extend(["networking", "business"])

    # Mentorship events
    elif any(word in text for word in ["mentor", "mentorship", "coaching", "advising"]):
        category = "learning"
        tags.extend(["mentorship", "business"])

    # Default to community
    else:
        category = "community"
        tags.extend(["networking", "business"])

    # Only mark free when explicitly stated
    is_free = False
    if any(word in text for word in ["free", "no cost", "no charge", "complimentary", "no fee"]):
        is_free = True
        tags.append("free")
    elif any(word in text for word in ["$", "ticket", "registration fee", "cost", "donation"]):
        is_free = False

    return category, list(set(tags)), is_free


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl ATLVets calendar.

    ATLVets uses The Events Calendar WordPress plugin which renders events
    as static HTML — no JavaScript rendering required.
    """
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        venue_id = get_or_create_venue(VENUE_DATA)

        logger.info(f"Fetching ATLVets: {EVENTS_URL}")
        response = requests.get(EVENTS_URL, headers=HEADERS, timeout=20)
        response.raise_for_status()
        soup = BeautifulSoup(response.text, "html.parser")

        # The Events Calendar plugin renders events in article elements
        # or .tribe-events-list-event containers
        event_selectors = [
            ".tribe-events-list-event",
            "article.tribe-type-single-tribe_events",
            "article",
            ".event-item",
        ]

        events = []
        for selector in event_selectors:
            events = soup.select(selector)
            if events:
                logger.info(f"Found {len(events)} events using selector: {selector}")
                break

        if not events:
            logger.info("No structured event elements found, searching page text")
            page_text = soup.get_text()
            if "event" in page_text.lower() or "calendar" in page_text.lower():
                logger.info("Found event-related content but couldn't parse structure")
            logger.info(f"ATLVets venue record ensured (ID: {venue_id})")
            return 0, 0, 0

        # Parse each event
        for event_elem in events:
            try:
                # Extract title
                title_elem = event_elem.select_one(
                    "h1, h2, h3, h4, .tribe-events-list-event-title, "
                    ".tribe-event-url, .title, .event-title, [class*='title']"
                )
                if title_elem:
                    title = title_elem.get_text(strip=True)
                else:
                    lines = [
                        l.strip()
                        for l in event_elem.get_text().split("\n")
                        if l.strip()
                    ]
                    title = lines[0] if lines else None

                if not title or len(title) < 3:
                    continue

                # Skip non-event items
                skip_patterns = ["hours", "schedule", "contact us", "about", "services", "mission"]
                if any(pattern in title.lower() for pattern in skip_patterns):
                    continue

                # Extract date — Tribe uses <abbr> or <time datetime="...">
                start_date = None
                date_elem = event_elem.select_one(
                    "abbr.tribe-events-abbr, time[datetime], "
                    ".tribe-events-start-datetime, .date, .event-date, [class*='date']"
                )
                date_str = None
                if date_elem:
                    date_str = date_elem.get("datetime") or date_elem.get("title") or date_elem.get_text(strip=True)

                if not date_str:
                    event_text = event_elem.get_text()
                    date_match = re.search(
                        r"(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:,?\s+\d{4})?",
                        event_text,
                        re.IGNORECASE,
                    )
                    if date_match:
                        date_str = date_match.group(0)

                if not date_str:
                    logger.debug(f"No date found for: {title}")
                    continue

                start_date = parse_human_date(date_str)
                if not start_date:
                    logger.debug(f"Could not parse date '{date_str}' for: {title}")
                    continue

                # Skip past events
                if start_date < datetime.now().strftime("%Y-%m-%d"):
                    logger.debug(f"Skipping past event: {title} on {start_date}")
                    continue

                events_found += 1

                # Extract time
                time_str = None
                time_elem = event_elem.select_one(
                    ".tribe-events-start-datetime, .time, .event-time, [class*='time']"
                )
                if time_elem:
                    time_str = time_elem.get_text(strip=True)
                else:
                    time_match = re.search(
                        r"\d{1,2}(?::\d{2})?\s*(?:AM|PM|am|pm)", event_elem.get_text()
                    )
                    if time_match:
                        time_str = time_match.group(0)

                start_time = parse_time_string(time_str) if time_str else None

                # Extract description
                description = None
                desc_elem = event_elem.select_one(
                    ".tribe-events-list-event-description, "
                    ".description, .event-description, .excerpt, .summary, p"
                )
                if desc_elem:
                    description = desc_elem.get_text(strip=True)
                    if len(description) > 500:
                        description = description[:497] + "..."

                # Extract image
                image_url = None
                img_elem = event_elem.select_one("img")
                if img_elem:
                    image_url = img_elem.get("src")
                    if image_url and not image_url.startswith("http"):
                        image_url = BASE_URL + image_url if image_url.startswith("/") else None

                # Extract event URL
                link_elem = event_elem.select_one("a[href]")
                event_url = EVENTS_URL
                if link_elem:
                    href = link_elem.get("href")
                    if href:
                        if href.startswith("http"):
                            event_url = href
                        elif href.startswith("/"):
                            event_url = BASE_URL + href

                # Determine category and tags
                category, tags, is_free = determine_category_and_tags(title, description or "")

                # Generate content hash for deduplication
                content_hash = generate_content_hash(title, "ATLVets", start_date)

                # Create event record
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
                    "image_url": image_url,
                    "raw_text": event_elem.get_text()[:500],
                    "extraction_confidence": 0.80,
                    "is_recurring": False,
                    "recurrence_rule": None,
                    "content_hash": content_hash,
                }

                existing = find_event_by_hash(content_hash)
                if existing:
                    smart_update_existing_event(existing, event_record)
                    events_updated += 1
                    logger.debug(f"Event updated: {title}")
                    continue

                try:
                    insert_event(event_record)
                    events_new += 1
                    logger.info(f"Added: {title} on {start_date}")
                except Exception as e:
                    logger.error(f"Failed to insert event '{title}': {e}")

            except Exception as e:
                logger.warning(f"Error parsing event element: {e}")
                continue

        logger.info(
            f"ATLVets crawl complete: {events_found} found, "
            f"{events_new} new, {events_updated} updated"
        )

    except requests.RequestException as e:
        logger.error(f"HTTP error fetching ATLVets: {e}")
        raise
    except Exception as e:
        logger.error(f"Failed to crawl ATLVets: {e}")
        raise

    return events_found, events_new, events_updated
