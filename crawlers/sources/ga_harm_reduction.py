"""
Crawler for Georgia Harm Reduction Coalition (gaharmreduction.org).

The Georgia Harm Reduction Coalition (GHRC) is a statewide organization dedicated
to promoting harm reduction strategies and providing services to people who use drugs
and their communities.

Events include:
- Naloxone training and distribution
- Community outreach events
- Harm reduction workshops and education
- Awareness campaigns and advocacy events
- Syringe services program information sessions

Site uses WordPress with server-rendered HTML event listings.
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

BASE_URL = "https://georgiaharmreduction.org"
EVENTS_URL = f"{BASE_URL}/programs-services/training-services/"

# GHRC is a statewide organization with HQ in downtown Atlanta
VENUE_DATA = {
    "name": "Georgia Harm Reduction Coalition",
    "slug": "georgia-harm-reduction-coalition",
    "address": "230 Peachtree St NW, Suite 1700",
    "neighborhood": "Downtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30303",
    "lat": 33.7590,
    "lng": -84.3880,
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
    Categorize GHRC events based on content.

    Returns: (category, subcategory, tags)
    """
    text = f"{title} {description}".lower()
    tags = ["harm-reduction", "community-health"]

    # Naloxone training
    if any(kw in text for kw in [
        "naloxone", "narcan", "overdose prevention", "overdose response",
        "opioid reversal"
    ]):
        tags.extend(["naloxone", "substance-abuse", "education"])
        return "learning", "workshop", tags

    # Syringe services
    if any(kw in text for kw in [
        "syringe", "needle exchange", "harm reduction supplies",
        "safer injection"
    ]):
        tags.extend(["syringe-services", "substance-abuse"])
        return "wellness", "health_program", tags

    # Community outreach
    if any(kw in text for kw in [
        "outreach", "community event", "awareness", "advocacy",
        "community education"
    ]):
        tags.extend(["outreach", "advocacy", "community"])
        return "community", "outreach", tags

    # Training and workshops
    if any(kw in text for kw in [
        "training", "workshop", "seminar", "class", "education",
        "learn", "certification"
    ]):
        tags.extend(["education", "workshop"])
        return "learning", "workshop", tags

    # Support groups
    if any(kw in text for kw in [
        "support group", "peer support", "recovery support",
        "group meeting"
    ]):
        tags.extend(["support-group", "substance-abuse"])
        return "wellness", "support_group", tags

    # Default to community/educational
    tags.append("education")
    return "community", "educational", tags


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl Georgia Harm Reduction Coalition events using BeautifulSoup.

    The site uses WordPress with server-rendered HTML.
    """
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        venue_id = get_or_create_venue(VENUE_DATA)

        logger.info(f"Fetching GHRC events: {EVENTS_URL}")

        response = requests.get(
            EVENTS_URL,
            headers={
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
            },
            timeout=20
        )
        response.raise_for_status()

        soup = BeautifulSoup(response.text, "html.parser")

        # Find all event containers - adjust selectors based on actual site structure
        event_containers = soup.find_all("article", class_=re.compile(r"tribe-events|post-\d+"))

        if not event_containers:
            # Try alternative selector
            event_containers = soup.find_all("div", class_="tribe-event-schedule-details")

        if not event_containers:
            logger.warning("No events found on page")
            return events_found, events_new, events_updated

        logger.info(f"Found {len(event_containers)} event containers")

        seen_events = set()
        today = datetime.now().date()

        for container in event_containers:
            try:
                # Extract title and URL
                title_elem = container.find(["h2", "h3"], class_=re.compile(r"entry-title|tribe-events-list-event-title"))
                if not title_elem:
                    title_elem = container.find("a", class_="tribe-event-url")

                if not title_elem:
                    continue

                link_elem = title_elem.find("a") if title_elem.name != "a" else title_elem
                if not link_elem:
                    continue

                title = link_elem.get_text(strip=True)
                event_url = link_elem.get("href", EVENTS_URL)

                if not title:
                    continue

                # Extract description
                desc_elem = container.find(["div", "p"], class_=re.compile(r"entry-content|tribe-events-list-event-description|excerpt"))
                description = None
                if desc_elem:
                    desc_text = desc_elem.get_text(" ", strip=True)
                    desc_text = re.sub(r'\s*Read More\s*$', '', desc_text)
                    description = desc_text if len(desc_text) > 10 else None

                # Extract date from datetime attribute or text
                date_elem = container.find(["time", "span"], class_=re.compile(r"tribe-event-date|published"))
                if not date_elem:
                    logger.debug(f"No date found for: {title}")
                    continue

                # Try datetime attribute first
                start_date = None
                if date_elem.has_attr("datetime"):
                    datetime_str = date_elem["datetime"]
                    try:
                        dt = datetime.fromisoformat(datetime_str.replace("Z", "+00:00"))
                        start_date = dt.strftime("%Y-%m-%d")
                    except ValueError:
                        pass

                # Fallback to text parsing
                if not start_date:
                    date_text = date_elem.get_text(strip=True)
                    start_date = parse_date_from_text(date_text)

                if not start_date:
                    logger.debug(f"Could not parse date for: {title}")
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
                time_elem = container.find("span", class_=re.compile(r"tribe-event-time"))
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

                # Most GHRC events are free
                is_free = True
                if description and any(kw in description.lower() for kw in ["$", "cost", "fee", "price"]):
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
            f"GHRC crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except requests.RequestException as e:
        logger.error(f"Failed to fetch GHRC events: {e}")
        raise
    except Exception as e:
        logger.error(f"Failed to crawl GHRC: {e}")
        raise

    return events_found, events_new, events_updated
