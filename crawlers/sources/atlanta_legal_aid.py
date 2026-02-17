"""
Crawler for Atlanta Legal Aid Society (atlantalegalaid.org).

Atlanta Legal Aid provides free civil legal services to low-income residents
in the Atlanta metro area.

Events include:
- Know Your Rights workshops
- Legal clinics and consultations
- Community education sessions
- Housing rights workshops
- Benefits advocacy training
- Volunteer attorney orientations

Site structure: Check events/calendar or news section for programs.
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

logger = logging.getLogger(__name__)

BASE_URL = "https://atlantalegalaid.org"
# Try common event page patterns
EVENTS_URLS = [
    f"{BASE_URL}/events/",
    f"{BASE_URL}/calendar/",
    f"{BASE_URL}/workshops/",
    f"{BASE_URL}/news-events/",
]

VENUE_DATA = {
    "name": "Atlanta Legal Aid Society",
    "slug": "atlanta-legal-aid",
    "address": "54 Ellis St NE",
    "neighborhood": "Downtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30303",
    "lat": 33.7565,
    "lng": -84.3893,
    "venue_type": "organization",
    "spot_type": "organization",
    "website": BASE_URL,
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

    # Try YYYY-MM-DD format
    match = re.match(r'(\d{4})-(\d{2})-(\d{2})', date_text)
    if match:
        return date_text[:10]

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
    Categorize Legal Aid events based on content.

    Returns: (category, subcategory, tags)
    """
    text = f"{title} {description}".lower()
    tags = ["legal-aid", "free", "community"]

    # Legal clinics
    if any(kw in text for kw in [
        "clinic", "consultation", "legal help", "legal assistance",
        "free legal"
    ]):
        tags.extend(["legal-clinic", "consultation"])
        return "other", "legal_clinic", tags

    # Know Your Rights workshops
    if any(kw in text for kw in [
        "know your rights", "rights workshop", "tenant rights",
        "housing rights", "consumer rights", "immigration rights"
    ]):
        tags.extend(["workshop", "education", "advocacy"])
        return "learning", "workshop", tags

    # Educational workshops
    if any(kw in text for kw in [
        "workshop", "training", "education", "seminar",
        "presentation", "class"
    ]):
        tags.extend(["workshop", "education"])
        return "learning", "workshop", tags

    # Volunteer events
    if any(kw in text for kw in [
        "volunteer", "pro bono", "attorney orientation",
        "legal volunteer"
    ]):
        tags.extend(["volunteer"])
        return "community", "volunteer", tags

    # Community events
    if any(kw in text for kw in [
        "community", "outreach", "awareness", "fundraiser"
    ]):
        tags.extend(["community"])
        return "community", None, tags

    # Default to learning/legal
    tags.append("legal")
    return "other", None, tags


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl Atlanta Legal Aid Society events.

    Note: Legal Aid orgs may not have frequent public events.
    This crawler attempts to find events but may return 0 if none are listed.
    """
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        venue_id = get_or_create_venue(VENUE_DATA)

        # Try each potential events URL
        events_page_html = None
        working_url = None

        for url in EVENTS_URLS:
            try:
                logger.info(f"Trying Atlanta Legal Aid events URL: {url}")
                response = requests.get(
                    url,
                    headers={
                        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
                    },
                    timeout=20
                )
                if response.status_code == 200:
                    events_page_html = response.text
                    working_url = url
                    logger.info(f"Successfully fetched: {url}")
                    break
            except requests.RequestException as e:
                logger.debug(f"Failed to fetch {url}: {e}")
                continue

        if not events_page_html:
            logger.warning("Could not find Atlanta Legal Aid events page at any known URL")
            return events_found, events_new, events_updated

        soup = BeautifulSoup(events_page_html, "html.parser")

        # Try to find event containers
        event_containers = (
            soup.find_all("div", class_=re.compile(r"event", re.I)) or
            soup.find_all("article", class_=re.compile(r"event|post", re.I)) or
            soup.find_all("li", class_=re.compile(r"event", re.I))
        )

        if not event_containers:
            logger.warning(f"No event containers found on {working_url}")
            return events_found, events_new, events_updated

        logger.info(f"Found {len(event_containers)} potential event containers")

        seen_events = set()
        today = datetime.now().date()

        for container in event_containers:
            try:
                # Extract title
                title_elem = (
                    container.find("h1") or
                    container.find("h2") or
                    container.find("h3") or
                    container.find("a", class_=re.compile(r"title|heading", re.I))
                )
                if not title_elem:
                    continue

                title = title_elem.get_text(strip=True)
                if not title or len(title) < 5:
                    continue

                # Get event URL
                link_elem = container.find("a", href=True)
                event_url = link_elem.get("href", working_url) if link_elem else working_url
                if event_url and not event_url.startswith("http"):
                    event_url = BASE_URL + event_url if event_url.startswith("/") else f"{BASE_URL}/{event_url}"

                # Extract description
                desc_elem = container.find("div", class_=re.compile(r"description|content|excerpt|summary", re.I))
                description = desc_elem.get_text(" ", strip=True) if desc_elem else None

                # Extract date
                date_elem = container.find("time") or container.find(class_=re.compile(r"date|when", re.I))
                date_text = None
                if date_elem:
                    date_text = date_elem.get("datetime") or date_elem.get_text(strip=True)

                start_date = parse_date_from_text(date_text) if date_text else None
                if not start_date:
                    logger.debug(f"No valid date found for: {title}")
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
                time_elem = container.find(class_=re.compile(r"time|hour", re.I))
                start_time = None
                if time_elem:
                    time_text = time_elem.get_text(strip=True)
                    start_time = parse_time_from_text(time_text)

                # Dedupe check
                event_key = f"{title}|{start_date}"
                if event_key in seen_events:
                    continue
                seen_events.add(event_key)

                events_found += 1

                # Generate content hash
                content_hash = generate_content_hash(
                    title, VENUE_DATA["name"], start_date
                )

                # Check for existing

                # Categorize event
                category, subcategory, tags = categorize_event(
                    title, description or ""
                )

                # Build event record
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
                    "is_free": True,
                    "source_url": event_url,
                    "ticket_url": event_url,
                    "image_url": None,
                    "raw_text": f"{title} {description or ''}"[:500],
                    "extraction_confidence": 0.8,
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
                    logger.error(f"Failed to insert {title}: {e}")

            except Exception as e:
                logger.debug(f"Failed to parse event container: {e}")
                continue

        logger.info(
            f"Atlanta Legal Aid crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Atlanta Legal Aid: {e}")
        raise

    return events_found, events_new, events_updated
