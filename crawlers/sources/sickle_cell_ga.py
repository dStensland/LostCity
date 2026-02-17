"""
Crawler for Sickle Cell Foundation of Georgia (sicklecellga.org).

The Sickle Cell Foundation of Georgia provides comprehensive support services
for individuals and families affected by sickle cell disease, including
education, advocacy, and community programs.

Events include:
- Mobile testing events and screenings
- Camp New Hope (annual summer camp for kids with sickle cell)
- Annual Sickle Cell Walk
- Health awareness campaigns
- Support group meetings
- Educational workshops
- Community health fairs

Service area: State of Georgia, headquartered in Atlanta.

Site may use WordPress or static HTML.
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

BASE_URL = "https://www.sicklecellga.org"
EVENTS_URL = BASE_URL

VENUE_DATA = {
    "name": "Sickle Cell Foundation of Georgia",
    "slug": "sickle-cell-foundation-georgia",
    "address": "2391 Benjamin E. Mays Dr SW",
    "neighborhood": "Southwest Atlanta",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30311",
    "lat": 33.7355,
    "lng": -84.4373,
    "venue_type": "organization",
    "spot_type": "organization",
    "website": BASE_URL,
}


def parse_date_from_text(date_text: str) -> Optional[str]:
    """
    Parse date from formats like 'Feb 23' or 'February 23, 2026'.
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
            # If no year provided and date is in the past, assume next year
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
            # If no year provided and date is in the past, assume next year
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
    Categorize Sickle Cell Foundation of Georgia events based on content.

    Returns: (category, subcategory, tags)
    """
    text = f"{title} {description}".lower()
    tags = ["sickle-cell", "community-health", "education", "family-friendly"]

    # Walks and fundraising events
    if any(kw in text for kw in [
        "walk", "5k", "run", "fundraiser", "gala",
        "benefit", "auction", "donor"
    ]):
        tags.extend(["fundraiser", "walk", "active"])
        return "community", "fundraiser", tags

    # Camp events
    if any(kw in text for kw in [
        "camp", "camp new hope", "summer camp", "youth camp"
    ]):
        tags.extend(["camp", "youth", "children"])
        return "community", "youth_program", tags

    # Testing and screening events
    if any(kw in text for kw in [
        "testing", "screening", "mobile testing", "health screening",
        "sickle cell test", "trait test"
    ]):
        tags.extend(["health", "screening", "testing"])
        return "wellness", "health_program", tags

    # Support groups
    if any(kw in text for kw in [
        "support group", "support meeting", "peer support",
        "caregiver support", "family support"
    ]):
        tags.extend(["support-group", "mental-health"])
        return "wellness", "support_group", tags

    # Educational workshops
    if any(kw in text for kw in [
        "workshop", "education", "training", "seminar",
        "class", "learn", "awareness"
    ]):
        tags.extend(["education", "workshop", "awareness"])
        return "learning", "workshop", tags

    # Health fairs and awareness events
    if any(kw in text for kw in [
        "health fair", "awareness", "community health",
        "wellness", "awareness campaign"
    ]):
        tags.extend(["health", "awareness", "community"])
        return "wellness", "health_program", tags

    # Social and family events
    if any(kw in text for kw in [
        "family", "social", "celebration", "gathering",
        "picnic", "party"
    ]):
        tags.extend(["social", "family"])
        return "community", "social", tags

    # Default to community/educational
    return "community", "educational", tags


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl Sickle Cell Foundation of Georgia events using BeautifulSoup.

    The site may use WordPress or static HTML.
    """
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        venue_id = get_or_create_venue(VENUE_DATA)

        logger.info(f"Fetching Sickle Cell Foundation of Georgia events: {EVENTS_URL}")

        try:
            response = requests.get(
                EVENTS_URL,
                headers={
                    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
                },
                timeout=20
            )
            response.raise_for_status()
        except requests.exceptions.HTTPError as e:
            logger.warning(f"Sickle Cell Foundation site returned error (Wix site, no events page): {e}")
            logger.info(f"Sickle Cell Foundation venue record ensured (ID: {venue_id})")
            return 0, 0, 0

        soup = BeautifulSoup(response.text, "html.parser")

        # Find all event containers
        event_containers = soup.find_all("div", class_=re.compile(r"event|tribe-events|post"))
        if not event_containers:
            event_containers = soup.find_all("article", class_=re.compile(r"event|post"))

        if not event_containers:
            logger.warning("No events found on page")
            return events_found, events_new, events_updated

        logger.info(f"Found {len(event_containers)} event containers")

        seen_events = set()
        today = datetime.now().date()

        for container in event_containers:
            try:
                # Extract title and URL
                title_elem = container.find(["h3", "h2", "h1"], class_=re.compile(r"title|event"))
                if not title_elem:
                    title_elem = container.find("a")

                if not title_elem:
                    continue

                link_elem = title_elem.find("a") if title_elem.name != "a" else title_elem
                title = title_elem.get_text(strip=True) if title_elem.name != "a" else link_elem.get_text(strip=True)
                event_url = link_elem.get("href", EVENTS_URL) if link_elem else EVENTS_URL

                if not title or len(title) < 3:
                    continue

                # Extract description
                desc_elem = container.find(["div", "p"], class_=re.compile(r"description|excerpt|content|summary"))
                description = None
                if desc_elem:
                    desc_text = desc_elem.get_text(" ", strip=True)
                    desc_text = re.sub(r'\s*Read More\s*$', '', desc_text)
                    description = desc_text if len(desc_text) > 10 else None

                # Extract date
                date_elem = container.find(["span", "div", "time"], class_=re.compile(r"date|start|time"))
                if not date_elem:
                    logger.debug(f"No date found for: {title}")
                    continue

                date_text = date_elem.get_text(strip=True)
                start_date = parse_date_from_text(date_text)
                if not start_date:
                    logger.debug(f"Could not parse date '{date_text}' for: {title}")
                    continue

                # Skip past events
                try:
                    event_date = datetime.strptime(start_date, "%Y-%m-%d").date()
                    if event_date < today:
                        logger.debug(f"Skipping past event: {title} on {start_date}")
                        continue
                except ValueError:
                    continue

                # Extract start time
                start_time = None
                time_elem = container.find(["span", "div", "time"], class_=re.compile(r"time"))
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

                # Check if free
                is_free = True
                if description and any(kw in description.lower() for kw in ["$", "cost", "fee", "price", "ticket"]):
                    if "free" not in description.lower():
                        is_free = False

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
                    "price_min": 0 if is_free else None,
                    "price_max": 0 if is_free else None,
                    "price_note": "Free" if is_free else None,
                    "is_free": is_free,
                    "source_url": event_url,
                    "ticket_url": event_url,
                    "image_url": None,
                    "raw_text": f"{title} {description or ''}"[:500],
                    "extraction_confidence": 0.9,
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
            f"Sickle Cell Foundation of Georgia crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except requests.RequestException as e:
        logger.error(f"Failed to fetch Sickle Cell Foundation of Georgia events: {e}")
        raise
    except Exception as e:
        logger.error(f"Failed to crawl Sickle Cell Foundation of Georgia: {e}")
        raise

    return events_found, events_new, events_updated
