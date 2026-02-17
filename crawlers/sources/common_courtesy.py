"""
Crawler for Common Courtesy Inc (commoncourtesy.org).

Common Courtesy Inc is a nonprofit organization providing free transportation services
to seniors and adults with disabilities in metro Atlanta. They connect volunteer drivers
with those in need of rides to medical appointments, grocery shopping, and other essential trips.

Events include:
- Volunteer driver training sessions
- Community outreach events
- Fundraising events
- Appreciation events for volunteers

Note: This is primarily a transportation service organization, so event listings may be
sparse. The venue record itself is valuable for showing this community resource.

Site uses WordPress with server-rendered HTML.
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

BASE_URL = "https://commoncourtesy.org"
EVENTS_URL = f"{BASE_URL}/events/"

# Common Courtesy headquarters in Norcross
VENUE_DATA = {
    "name": "Common Courtesy Inc",
    "slug": "common-courtesy",
    "address": "1000 Center Pl",
    "neighborhood": "Norcross",
    "city": "Norcross",
    "state": "GA",
    "zip": "30093",
    "lat": 33.9413,
    "lng": -84.2134,
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
    Categorize Common Courtesy events based on content.

    Returns: (category, subcategory, tags)
    """
    text = f"{title} {description}".lower()
    tags = ["transportation", "community-health", "accessibility"]

    # Volunteer driver training
    if any(kw in text for kw in [
        "driver training", "volunteer training", "new driver",
        "orientation", "driver orientation"
    ]):
        tags.extend(["volunteer", "education"])
        return "learning", "workshop", tags

    # Volunteer appreciation
    if any(kw in text for kw in [
        "appreciation", "thank you", "volunteer recognition",
        "driver appreciation"
    ]):
        tags.extend(["volunteer", "community"])
        return "community", "social", tags

    # Fundraising events
    if any(kw in text for kw in [
        "fundraiser", "gala", "fundraising", "donation", "auction"
    ]):
        tags.extend(["fundraiser", "community"])
        return "community", "fundraiser", tags

    # Community outreach
    if any(kw in text for kw in [
        "outreach", "community event", "awareness", "information session"
    ]):
        tags.extend(["outreach", "community"])
        return "community", "outreach", tags

    # Default to community event
    tags.append("volunteer")
    return "community", "educational", tags


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl Common Courtesy Inc events using BeautifulSoup.

    The site uses WordPress with server-rendered HTML.
    Note: This org primarily provides transportation services, so events may be sparse.
    The venue record itself is valuable for showing this community resource.
    """
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        venue_id = get_or_create_venue(VENUE_DATA)

        logger.info(f"Fetching Common Courtesy events: {EVENTS_URL}")

        response = requests.get(
            EVENTS_URL,
            headers={
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
            },
            timeout=20
        )
        response.raise_for_status()

        soup = BeautifulSoup(response.text, "html.parser")

        # Find all event containers
        event_containers = soup.find_all(["article", "div"], class_=re.compile(r"event|tribe-events|post"))

        if not event_containers:
            logger.warning("No events found on page - this is expected for transportation service orgs")
            return events_found, events_new, events_updated

        logger.info(f"Found {len(event_containers)} event containers")

        seen_events = set()
        today = datetime.now().date()

        for container in event_containers:
            try:
                # Extract title and URL
                title_elem = container.find(["h2", "h3", "h4"], class_=re.compile(r"entry-title|event-title|title"))
                if not title_elem:
                    continue

                link_elem = title_elem.find("a") if title_elem.name != "a" else title_elem

                title = title_elem.get_text(strip=True)
                event_url = link_elem.get("href", EVENTS_URL) if link_elem else EVENTS_URL

                if not title:
                    continue

                # Extract description
                desc_elem = container.find(["div", "p"], class_=re.compile(r"entry-content|description|excerpt|summary"))
                description = None
                if desc_elem:
                    desc_text = desc_elem.get_text(" ", strip=True)
                    desc_text = re.sub(r'\s*Read More\s*$', '', desc_text)
                    description = desc_text if len(desc_text) > 10 else None

                # Extract date
                date_elem = container.find(["time", "span"], class_=re.compile(r"date|published|event-date|tribe-event-date"))
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
                time_elem = container.find("span", class_=re.compile(r"time|event-time|tribe-event-time"))
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

                # Most Common Courtesy events are free
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
            f"Common Courtesy crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except requests.RequestException as e:
        logger.error(f"Failed to fetch Common Courtesy events: {e}")
        raise
    except Exception as e:
        logger.error(f"Failed to crawl Common Courtesy: {e}")
        raise

    return events_found, events_new, events_updated
