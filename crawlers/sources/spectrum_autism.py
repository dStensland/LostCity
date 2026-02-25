"""
Crawler for Spectrum Autism Support Group (spectrumautism.org).

Spectrum provides support, education, and advocacy for individuals with autism
and their families in the Atlanta metro area. Operating since 1971, it's one
of Georgia's oldest autism support organizations.

Events include:
- Monthly support group meetings (parent groups, adult groups, sibling groups)
- Summer camps and day programs
- Family social events (picnics, movie nights, bowling)
- Educational workshops and seminars
- Teen social groups
- Adult life skills programs

Service area: Metro Atlanta (Fulton, DeKalb, Cobb, Gwinnett counties).

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

BASE_URL = "https://spectrumautism.org"
EVENTS_URL = f"{BASE_URL}/events/"

VENUE_DATA = {
    "name": "Spectrum Autism Support Group",
    "slug": "spectrum-autism-support-group",
    "address": "1925 Century Blvd NE, Suite 10",
    "neighborhood": "North Druid Hills",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30345",
    "lat": 33.8424,
    "lng": -84.2996,
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
    Categorize Spectrum Autism Support Group events based on content.

    Returns: (category, subcategory, tags)
    """
    text = f"{title} {description}".lower()
    tags = ["autism", "disability", "support-group", "family-friendly"]

    # Support groups
    if any(kw in text for kw in [
        "support group", "parent support", "parent group",
        "sibling support", "adult support", "caregiver support"
    ]):
        tags.extend(["support", "mental-health", "parents"])
        return "wellness", "support_group", tags

    # Camp events
    if any(kw in text for kw in [
        "camp", "summer camp", "day camp", "overnight camp"
    ]):
        tags.extend(["camp", "youth", "children"])
        return "community", "youth_program", tags

    # Social events
    if any(kw in text for kw in [
        "social", "movie night", "bowling", "game night",
        "picnic", "party", "family fun", "family event"
    ]):
        tags.extend(["social", "recreation", "fun"])
        return "community", "social", tags

    # Teen programs
    if any(kw in text for kw in [
        "teen", "teenage", "adolescent", "youth group",
        "teen social"
    ]):
        tags.extend(["teens", "youth", "social"])
        return "community", "youth_program", tags

    # Educational workshops
    if any(kw in text for kw in [
        "workshop", "education", "training", "seminar",
        "class", "learn", "presentation"
    ]):
        tags.extend(["education", "workshop", "learning"])
        return "learning", "workshop", tags

    # Life skills and adult programs
    if any(kw in text for kw in [
        "life skills", "adult program", "job skills",
        "employment", "independent living"
    ]):
        tags.extend(["life-skills", "adults", "education"])
        return "learning", "life_skills", tags

    # Fundraising events
    if any(kw in text for kw in [
        "fundraiser", "benefit", "gala", "auction",
        "walk", "5k", "run"
    ]):
        tags.extend(["fundraiser", "benefit"])
        return "community", "fundraiser", tags

    # Default to community/support
    return "community", "support_group", tags


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl Spectrum Autism Support Group events using BeautifulSoup.

    The site may use WordPress or static HTML.
    """
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        venue_id = get_or_create_venue(VENUE_DATA)

        logger.info(f"Fetching Spectrum Autism Support Group events: {EVENTS_URL}")

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

                # Default to not-free; only set True when source text says "free"
                is_free = False
                text_lower_check = f"{title} {description or ''}".lower()
                if any(kw in text_lower_check for kw in ["free", "no cost", "no charge", "complimentary"]):
                    is_free = True

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
            f"Spectrum Autism Support Group crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except requests.RequestException as e:
        logger.error(f"Failed to fetch Spectrum Autism Support Group events: {e}")
        raise
    except Exception as e:
        logger.error(f"Failed to crawl Spectrum Autism Support Group: {e}")
        raise

    return events_found, events_new, events_updated
