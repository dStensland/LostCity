"""
Crawler for AARP Georgia (local.aarp.org/atlanta-ga/).

AARP Georgia provides programs, events, and advocacy for adults 50+
in the Atlanta metro area and throughout Georgia.

Events include:
- Free educational workshops and seminars
- Community events and social gatherings
- Fraud prevention and financial literacy programs
- Health and wellness programs
- Technology training and classes
- Volunteer opportunities
- Advocacy and legislative events

Located in Midtown Atlanta, serving all of Georgia.

Site structure: AARP local chapter website with event calendar.
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

BASE_URL = "https://local.aarp.org"
ATLANTA_URL = f"{BASE_URL}/atlanta-ga/"
EVENTS_URL = f"{BASE_URL}/atlanta-ga/events"

VENUE_DATA = {
    "name": "AARP Georgia",
    "slug": "aarp-georgia",
    "address": "999 Peachtree St NE Suite 1110",
    "neighborhood": "Midtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30309",
    "lat": 33.7822,
    "lng": -84.3836,
    "venue_type": "organization",
    "spot_type": "organization",
    "website": "https://local.aarp.org/atlanta-ga/",
}


def parse_date_from_text(date_text: str) -> Optional[str]:
    """
    Parse date from various formats.
    Returns YYYY-MM-DD format.
    """
    if not date_text:
        return None

    current_year = datetime.now().year
    date_text = date_text.strip()

    # Try "Mon DD, YYYY" format (full month name)
    match = re.match(
        r'(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})(?:,?\s+(\d{4}))?',
        date_text,
        re.IGNORECASE
    )
    if match:
        month = match.group(1)
        day = int(match.group(2))
        year = int(match.group(3)) if match.group(3) else current_year
        try:
            dt = datetime.strptime(f"{month} {day} {year}", "%B %d %Y")
            if not match.group(3) and dt.date() < datetime.now().date():
                dt = datetime.strptime(f"{month} {day} {year + 1}", "%B %d %Y")
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            pass

    # Try "Mon DD" format (abbreviated month)
    match = re.match(
        r'(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})(?:,?\s+(\d{4}))?',
        date_text,
        re.IGNORECASE
    )
    if match:
        month = match.group(1)
        day = int(match.group(2))
        year = int(match.group(3)) if match.group(3) else current_year
        try:
            dt = datetime.strptime(f"{month} {day} {year}", "%b %d %Y")
            if not match.group(3) and dt.date() < datetime.now().date():
                dt = datetime.strptime(f"{month} {day} {year + 1}", "%b %d %Y")
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            pass

    return None


def parse_time_from_text(time_text: str) -> Optional[str]:
    """
    Parse time from formats like '10:00 am' or '2:30 pm'.
    Returns HH:MM in 24-hour format.
    """
    if not time_text:
        return None

    time_text = time_text.strip()

    # Match "H:MM am/pm" or "HH:MM am/pm"
    match = re.match(r'(\d{1,2}):(\d{2})\s*(am|pm)', time_text, re.IGNORECASE)
    if match:
        hour = int(match.group(1))
        minute = int(match.group(2))
        period = match.group(3).lower()

        if period == 'pm' and hour != 12:
            hour += 12
        elif period == 'am' and hour == 12:
            hour = 0

        return f"{hour:02d}:{minute:02d}"

    return None


def categorize_event(title: str, description: str) -> tuple[str, Optional[str], list[str]]:
    """
    Categorize AARP Georgia events.

    Returns: (category, subcategory, tags)
    """
    text = f"{title} {description}".lower()
    tags = ["seniors", "aarp", "community"]

    # Educational workshops
    if any(kw in text for kw in [
        "workshop", "seminar", "class", "training", "learn", "education",
        "fraud prevention", "scam", "financial", "medicare", "social security"
    ]):
        tags.extend(["education", "workshop", "free"])
        return "learning", "workshop", tags

    # Technology classes
    if any(kw in text for kw in [
        "technology", "computer", "smartphone", "internet", "tech", "digital",
        "online", "zoom", "email"
    ]):
        tags.extend(["technology", "education", "free"])
        return "learning", "technology", tags

    # Health and wellness
    if any(kw in text for kw in [
        "health", "wellness", "fitness", "exercise", "nutrition", "screening"
    ]):
        tags.extend(["health", "wellness"])
        return "wellness", "health_program", tags

    # Social events
    if any(kw in text for kw in [
        "social", "mixer", "meet-up", "gathering", "game", "coffee", "lunch"
    ]):
        tags.extend(["social", "networking"])
        return "community", "social", tags

    # Volunteer opportunities
    if any(kw in text for kw in [
        "volunteer", "service", "community service", "give back"
    ]):
        tags.extend(["volunteer", "community-service"])
        return "community", "volunteer", tags

    # Advocacy and legislative
    if any(kw in text for kw in [
        "advocacy", "legislative", "policy", "town hall", "meeting"
    ]):
        tags.extend(["advocacy", "civic"])
        return "community", "advocacy", tags

    # Default
    tags.extend(["free", "community-event"])
    return "community", "educational", tags


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl AARP Georgia events.
    """
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        venue_id = get_or_create_venue(VENUE_DATA)

        urls_to_try = [EVENTS_URL, ATLANTA_URL]

        for url in urls_to_try:
            try:
                logger.info(f"Fetching AARP Georgia page: {url}")

                response = requests.get(
                    url,
                    headers={
                        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
                    },
                    timeout=20
                )

                if response.status_code != 200:
                    logger.debug(f"Page not found: {url} (status {response.status_code})")
                    continue

                soup = BeautifulSoup(response.text, "html.parser")

                # Look for AARP event containers
                event_containers = soup.find_all("div", class_=lambda x: x and "event" in (x or "").lower())

                if not event_containers:
                    # Try article tags
                    event_containers = soup.find_all("article")

                if not event_containers:
                    # Try generic containers
                    event_containers = soup.find_all("div", class_=lambda x: x and any(
                        kw in (x or "").lower() for kw in ["card", "item", "post", "listing"]
                    ))

                if not event_containers:
                    logger.debug(f"No event containers found on {url}")
                    continue

                logger.info(f"Found {len(event_containers)} potential events on {url}")

                seen_events = set()
                today = datetime.now().date()

                for container in event_containers:
                    try:
                        # Extract title
                        title_elem = container.find(["h1", "h2", "h3", "h4", "h5"])
                        if not title_elem:
                            continue

                        title = title_elem.get_text(strip=True)

                        if len(title) < 5:
                            continue

                        # Get link
                        link_elem = title_elem.find("a")
                        if not link_elem:
                            link_elem = container.find("a")

                        event_url = ATLANTA_URL
                        if link_elem and link_elem.get("href"):
                            href = link_elem.get("href")
                            if href.startswith("http"):
                                event_url = href
                            elif href.startswith("/"):
                                event_url = f"{BASE_URL}{href}"

                        # Extract description
                        desc_elem = container.find("p")
                        description = None
                        if desc_elem:
                            description = desc_elem.get_text(" ", strip=True)[:1000]

                        # Extract date
                        date_elem = container.find(["time", "span", "div"], class_=lambda x: x and "date" in (x or "").lower())

                        date_text = None
                        if date_elem:
                            date_text = date_elem.get_text(strip=True)
                            if date_elem.name == "time" and date_elem.get("datetime"):
                                date_text = date_elem.get("datetime")

                        # Search in text if no explicit date
                        if not date_text:
                            search_text = f"{title} {description or ''}"
                            date_match = re.search(
                                r'(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}(?:,?\s+\d{4})?',
                                search_text,
                                re.IGNORECASE
                            )
                            if date_match:
                                date_text = date_match.group(0)

                        if not date_text:
                            logger.debug(f"No date found for: {title}")
                            continue

                        start_date = parse_date_from_text(date_text)
                        if not start_date:
                            logger.debug(f"Could not parse date '{date_text}' for: {title}")
                            continue

                        # Skip past events
                        try:
                            event_date = datetime.strptime(start_date, "%Y-%m-%d").date()
                            if event_date < today:
                                logger.debug(f"Skipping past event: {title}")
                                continue
                        except ValueError:
                            continue

                        # Extract time
                        time_text = container.get_text()
                        time_match = re.search(r'\d{1,2}:\d{2}\s*(?:am|pm)', time_text, re.IGNORECASE)
                        start_time = None
                        if time_match:
                            start_time = parse_time_from_text(time_match.group(0))

                        # Dedupe
                        event_key = f"{title}|{start_date}"
                        if event_key in seen_events:
                            continue
                        seen_events.add(event_key)

                        events_found += 1

                        content_hash = generate_content_hash(title, VENUE_DATA["name"], start_date)

                        existing = find_event_by_hash(content_hash)
                        if existing:
                            events_updated += 1
                            continue

                        category, subcategory, tags = categorize_event(title, description or "")

                        # AARP events are typically free
                        is_free = True

                        event_record = {
                            "source_id": source_id,
                            "venue_id": venue_id,
                            "title": title[:200],
                            "description": description[:1000] if description else None,
                            "start_date": start_date,
                            "start_time": start_time,
                            "end_date": start_date,
                            "end_time": None,
                            "is_all_day": False,
                            "category": category,
                            "subcategory": subcategory,
                            "tags": tags,
                            "price_min": 0,
                            "price_max": 0,
                            "price_note": "Free",
                            "is_free": is_free,
                            "source_url": event_url,
                            "ticket_url": event_url,
                            "image_url": None,
                            "raw_text": f"{title} {description or ''}"[:500],
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
                            logger.error(f"Failed to insert {title}: {e}")

                    except Exception as e:
                        logger.debug(f"Failed to parse event container: {e}")
                        continue

                if events_found > 0:
                    break

            except requests.RequestException as e:
                logger.debug(f"Failed to fetch {url}: {e}")
                continue

        logger.info(
            f"AARP Georgia crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl AARP Georgia: {e}")
        raise

    return events_found, events_new, events_updated
