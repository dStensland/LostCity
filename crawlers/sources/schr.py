"""
Crawler for Southern Center for Human Rights (schr.org).

SCHR is a non-profit legal advocacy organization dedicated to defending the rights
of people in the criminal legal system, challenging mass incarceration, and fighting
for racial and economic justice in the Deep South since 1976.

2026 is their 50th anniversary with several signature events.

Events include:
- "Joyful Resistance" community events
- Digital security trainings for activists and advocates
- Policy forums and legislative advocacy events
- Community workshops on civil rights and legal aid
- 50th anniversary gala and celebration events
- Professional legal training and CLE courses

STRATEGY:
- Primary: Scrape main events page at /events/ with requests
- Fallback: Use Eventbrite org page if main site blocks
- Tag appropriately: civil-rights, legal-aid, social-justice, human-rights
- Category mapping: "learning" for trainings/workshops, "community" for forums/galas/advocacy

Site notes:
- Eventbrite fallback: https://www.eventbrite.com/o/southern-center-for-human-rights-13836291777
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

BASE_URL = "https://www.schr.org"
EVENTS_URL = f"{BASE_URL}/events/"
EVENTBRITE_URL = "https://www.eventbrite.com/o/southern-center-for-human-rights-13836291777"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
    "Accept-Encoding": "gzip, deflate, br",
    "DNT": "1",
    "Connection": "keep-alive",
    "Upgrade-Insecure-Requests": "1",
}

VENUE_DATA = {
    "name": "Southern Center for Human Rights",
    "slug": "schr",
    "address": "60 Walton St NW",
    "neighborhood": "Downtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30303",
    "lat": 33.7565,
    "lng": -84.3930,
    "venue_type": "organization",
    "spot_type": "organization",
    "website": BASE_URL,
    # Note: vibes are for venue atmosphere/amenities, not program types
    # Tags on events will capture civil-rights, legal-aid, social-justice, etc.
}


def parse_time_string(time_str: str) -> Optional[str]:
    """
    Parse time string to 24-hour format.
    Examples: '6:00 PM', '12:30 PM', '6pm', '12:30pm', '9:00 AM - 1:00 PM'
    """
    try:
        time_str = time_str.strip().upper()

        # If it's a range, extract the first time
        if '-' in time_str or '–' in time_str:
            time_str = re.split(r'[-–]', time_str)[0].strip()

        # Pattern: H:MM AM/PM or H AM/PM or HAM/PM
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


def determine_category_and_tags(title: str, description: str = "") -> tuple[str, list[str], bool]:
    """
    Determine category, tags, and is_free flag based on event content.
    Returns (category, tags, is_free).
    """
    text = f"{title} {description}".lower()
    tags = ["civil-rights", "legal-aid", "social-justice"]

    # Galas and fundraisers
    if any(word in text for word in ["gala", "fundraiser", "benefit", "celebration", "anniversary"]):
        category = "community"
        tags.extend(["fundraiser", "charity"])
        is_free = False  # Galas typically have tickets

    # Digital security and technical training
    elif any(word in text for word in ["digital security", "cybersecurity", "tech", "encryption", "privacy"]):
        category = "learning"
        tags.extend(["technology", "security", "training", "privacy"])
        is_free = "free" in text or "no cost" in text

    # Legal training and CLE courses
    elif any(word in text for word in ["cle", "continuing legal education", "attorney", "lawyer training", "legal training"]):
        category = "learning"
        tags.extend(["legal", "professional-development", "training"])
        is_free = False  # CLE often has fees

    # Policy forums and advocacy events
    elif any(word in text for word in ["policy", "forum", "panel", "discussion", "advocacy", "legislative"]):
        category = "community"
        tags.extend(["policy", "advocacy", "forum"])
        is_free = "free" in text or "no cost" in text

    # Community workshops and education
    elif any(word in text for word in ["workshop", "training", "seminar", "class", "education"]):
        category = "learning"
        tags.extend(["workshop", "education"])
        is_free = "free" in text or "no cost" in text

    # Joyful Resistance and community events
    elif any(word in text for word in ["joyful resistance", "community", "organizing", "activism"]):
        category = "community"
        tags.extend(["activism", "organizing", "community"])
        is_free = "free" in text or "no cost" in text

    # Default to community
    else:
        category = "community"
        is_free = "free" in text or "no cost" in text

    # Check for explicit free/paid mentions
    if any(word in text for word in ["free", "no cost", "no charge", "complimentary"]):
        is_free = True
        tags.append("free")
    elif any(word in text for word in ["ticket", "$", "donation required", "registration fee"]):
        is_free = False

    # Add thematic tags
    if any(word in text for word in ["mass incarceration", "prison", "criminal justice", "death penalty"]):
        tags.append("criminal-justice-reform")
    if any(word in text for word in ["racial justice", "racial equity", "racism"]):
        tags.append("racial-justice")
    if any(word in text for word in ["human rights", "constitutional", "rights"]):
        tags.append("human-rights")

    return category, list(set(tags)), is_free


def crawl_main_site(source_id: int, venue_id: int) -> tuple[int, int, int]:
    """
    Attempt to crawl main SCHR website with requests.
    Returns (events_found, events_new, events_updated).
    """
    events_found = 0
    events_new = 0
    events_updated = 0
    today = datetime.now().date()
    seen_events = set()

    logger.info(f"Attempting to fetch SCHR events from main site: {EVENTS_URL}")

    try:
        response = requests.get(EVENTS_URL, headers=HEADERS, timeout=30)
        response.raise_for_status()
        soup = BeautifulSoup(response.text, "html.parser")
    except Exception as e:
        logger.warning(f"Failed to load main site: {e}")
        return 0, 0, 0

    # Look for The Events Calendar plugin events
    events = soup.select('.tribe-events-calendar-list__event')

    if not events or len(events) == 0:
        # Fallback to generic tribe events selector
        events = soup.select('.tribe-events-list-event')

    if not events or len(events) == 0:
        logger.info("No structured events found on main site")
        return 0, 0, 0

    logger.info(f"Found {len(events)} events on main site")

    # Parse each event
    for event_elem in events:
        try:
            # Extract title using The Events Calendar structure
            title_elem = event_elem.select_one(".tribe-events-calendar-list__event-title-link, .tribe-events-list-event-title")
            if not title_elem:
                # Fallback to generic selectors
                title_elem = event_elem.select_one("h1, h2, h3, h4, .title, .event-title")

            if not title_elem:
                logger.debug("No title element found")
                continue

            title = title_elem.get_text(strip=True)
            if not title or len(title) < 3:
                continue

            # Extract date
            date_elem = event_elem.select_one(".date, .event-date, [class*='date'], time")
            date_str = None
            if date_elem:
                date_str = date_elem.get_text(strip=True)
                datetime_attr = date_elem.get("datetime")
                if datetime_attr:
                    date_str = datetime_attr

            if not date_str:
                event_text = event_elem.get_text()
                date_match = re.search(
                    r'(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:,?\s+\d{4})?',
                    event_text,
                    re.IGNORECASE
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
            try:
                event_date = datetime.strptime(start_date, "%Y-%m-%d").date()
                if event_date < today:
                    logger.debug(f"Skipping past event: {title} on {start_date}")
                    continue
            except ValueError:
                continue

            # Dedupe
            event_key = f"{title}|{start_date}"
            if event_key in seen_events:
                continue
            seen_events.add(event_key)

            events_found += 1

            # Extract time
            time_elem = event_elem.select_one(".time, .event-time, [class*='time']")
            time_str = None
            if time_elem:
                time_str = time_elem.get_text(strip=True)
            else:
                time_match = re.search(r'\d{1,2}(?::\d{2})?\s*(?:AM|PM|am|pm)', event_elem.get_text())
                if time_match:
                    time_str = time_match.group(0)

            start_time = None
            if time_str:
                start_time = parse_time_string(time_str)

            # Extract description
            description = None
            desc_elem = event_elem.select_one(".description, .event-description, .excerpt, .summary, p")
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

            # Generate content hash
            content_hash = generate_content_hash(
                title, "Southern Center for Human Rights", start_date
            )

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
                "price_note": "Free" if is_free else None,
                "is_free": is_free,
                "source_url": event_url,
                "ticket_url": None,
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

    return events_found, events_new, events_updated


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl SCHR events.

    Tries main site first, falls back to Eventbrite if main site blocks or has no events.
    """
    source_id = source["id"]

    try:
        # Create venue record
        venue_id = get_or_create_venue(VENUE_DATA)

        # Try main site first
        events_found, events_new, events_updated = crawl_main_site(source_id, venue_id)

        logger.info(
            f"SCHR crawl complete: {events_found} found, "
            f"{events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl SCHR: {e}")
        raise

    return events_found, events_new, events_updated
