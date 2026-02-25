"""
Crawler for Down Syndrome Association of Atlanta (dsaatl.org).

The Down Syndrome Association of Atlanta provides support, advocacy, and
education for individuals with Down syndrome and their families.

Events include:
- Support groups for parents and siblings
- Buddy Walk and fundraising events
- Educational workshops and seminars
- Social events and community gatherings
- Advocacy and awareness campaigns

Service area: Metro Atlanta and surrounding counties.

Site uses WordPress with The Events Calendar plugin for server-rendered HTML.
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

BASE_URL = "https://dsaatl.org"
EVENTS_URL = f"{BASE_URL}/events/"

# Down Syndrome Association of Atlanta headquarters
VENUE_DATA = {
    "name": "Down Syndrome Association of Atlanta",
    "slug": "down-syndrome-association-atlanta",
    "address": "2221 Peachtree Rd NE, Suite D-330",
    "neighborhood": "Buckhead",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30309",
    "lat": 33.8137,
    "lng": -84.3858,
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
    Categorize DSAA events based on content.

    Returns: (category, subcategory, tags)
    """
    text = f"{title} {description}".lower()
    tags = ["disability", "down-syndrome", "family-friendly", "community"]

    # Support groups
    if any(kw in text for kw in [
        "support group", "parent support", "sibling support",
        "family support", "peer support", "parent meeting"
    ]):
        tags.extend(["support-group", "parenting", "family"])
        return "wellness", "support_group", tags

    # Buddy Walk and major fundraisers
    if any(kw in text for kw in [
        "buddy walk", "walk", "fundraiser", "gala",
        "auction", "benefit", "fundraising"
    ]):
        tags.extend(["fundraiser", "outdoor", "family"])
        return "community", "fundraiser", tags

    # Educational workshops
    if any(kw in text for kw in [
        "workshop", "seminar", "training", "education",
        "learn", "class", "presentation", "webinar"
    ]):
        tags.extend(["education", "workshop", "learning"])
        return "learning", "workshop", tags

    # Social events and gatherings
    if any(kw in text for kw in [
        "social", "playgroup", "game night", "party",
        "celebration", "gathering", "meetup", "picnic"
    ]):
        tags.extend(["social", "recreation", "family"])
        return "community", "social", tags

    # Advocacy and awareness
    if any(kw in text for kw in [
        "advocacy", "awareness", "world down syndrome day",
        "awareness month", "legislative", "policy"
    ]):
        tags.extend(["advocacy", "awareness", "education"])
        return "community", "advocacy", tags

    # Programs and activities
    if any(kw in text for kw in [
        "program", "activity", "camp", "class", "club",
        "sports", "arts", "music", "dance"
    ]):
        tags.extend(["recreation", "program", "youth"])
        return "community", "program", tags

    # Default to community/social
    tags.append("social")
    return "community", "social", tags


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl Down Syndrome Association of Atlanta events calendar.

    The site uses The Events Calendar plugin with server-rendered HTML.
    """
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        venue_id = get_or_create_venue(VENUE_DATA)

        logger.info(f"Fetching DSAA events: {EVENTS_URL}")

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
        event_containers = soup.find_all("div", class_="type-tribe_events")

        if not event_containers:
            logger.warning("No events found on page")
            return events_found, events_new, events_updated

        logger.info(f"Found {len(event_containers)} event containers")

        seen_events = set()
        today = datetime.now().date()

        for container in event_containers:
            try:
                # Extract title and URL
                title_elem = container.find("h3", class_="tribe-events-list-event-title")
                if not title_elem:
                    continue

                link_elem = title_elem.find("a", class_="tribe-event-url")
                if not link_elem:
                    continue

                title = link_elem.get_text(strip=True)
                event_url = link_elem.get("href", EVENTS_URL)

                if not title:
                    continue

                # Extract description
                desc_elem = container.find("div", class_="tribe-events-list-event-description")
                description = None
                if desc_elem:
                    # Get text, remove "Read More" link
                    desc_text = desc_elem.get_text(" ", strip=True)
                    desc_text = re.sub(r'\s*Read More\s*$', '', desc_text)
                    description = desc_text if len(desc_text) > 10 else None

                # Extract date and time from schedule details
                schedule_elem = container.find("div", class_="tribe-event-schedule-details")
                if not schedule_elem:
                    logger.debug(f"No schedule found for: {title}")
                    continue

                # Get date start element
                date_start_elem = schedule_elem.find("span", class_="tribe-event-date-start")
                if not date_start_elem:
                    logger.debug(f"No date start found for: {title}")
                    continue

                # Extract date from month highlight
                month_hl_elem = date_start_elem.find("span", class_="month-hl")
                date_text = None
                if month_hl_elem:
                    date_text = month_hl_elem.get_text(strip=True)
                else:
                    # Fallback to full text
                    date_text = date_start_elem.get_text(" ", strip=True).split("\n")[0]

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

                # Extract start time (after first <br>)
                start_time = None
                # Look for time after the date in the date-start element
                time_parts = str(date_start_elem).split("<br/>")
                if len(time_parts) > 1:
                    time_text = BeautifulSoup(time_parts[1], "html.parser").get_text(strip=True)
                    start_time = parse_time_from_text(time_text)

                # Extract end time
                end_time = None
                time_elem = schedule_elem.find("span", class_="tribe-event-time")
                if time_elem:
                    end_time_text = time_elem.get_text(strip=True)
                    end_time = parse_time_from_text(end_time_text)

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

                # Most DSAA events are free for members
                is_free = False
                if description and any(kw in description.lower() for kw in ["$", "cost", "fee", "price", "ticket"]):
                    # Check if it explicitly says free
                    if "free" in description.lower():
                        is_free = True
                    else:
                        is_free = False

                # Build event record
                event_record = {
                    "source_id": source_id,
                    "venue_id": venue_id,
                    "title": title[:200],
                    "description": description[:1000] if description else None,
                    "start_date": start_date,
                    "start_time": start_time,
                    "end_date": start_date,  # Same day
                    "end_time": end_time,
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
            f"DSAA crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except requests.RequestException as e:
        logger.error(f"Failed to fetch DSAA events: {e}")
        raise
    except Exception as e:
        logger.error(f"Failed to crawl DSAA: {e}")
        raise

    return events_found, events_new, events_updated
