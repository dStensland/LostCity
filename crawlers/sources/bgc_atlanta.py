"""
Crawler for Boys & Girls Clubs of Metro Atlanta (bgcma.org).

BGCMA serves youth across metro Atlanta with comprehensive programs focused on
academic success, healthy lifestyles, and character development.

Events include:
- Youth wellness and fitness programs
- Teen health fairs and wellness events
- Summer camp programs and registration events
- Sports leagues and tournaments
- Community family events
- Volunteer opportunities and fundraisers
- After-school program showcases

Site may use JavaScript rendering for event calendars.
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

BASE_URL = "https://bgcma.org"
EVENTS_URL = "https://bgcma.org/news-events/"

VENUE_DATA = {
    "name": "Boys & Girls Clubs of Metro Atlanta",
    "slug": "bgc-atlanta",
    "address": "500 Luckie St NW",
    "neighborhood": "Downtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30313",
    "lat": 33.7617,
    "lng": -84.3985,
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

    # Try "YYYY-MM-DD" format
    match = re.match(r'(\d{4})-(\d{2})-(\d{2})', date_text)
    if match:
        return date_text

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
    Categorize Boys & Girls Clubs events based on content.

    Returns: (category, subcategory, tags)
    """
    text = f"{title} {description}".lower()
    tags = ["youth", "community-health"]

    # Summer camp and day camp programs
    if any(kw in text for kw in [
        "summer camp", "day camp", "camp registration",
        "summer program"
    ]):
        tags.extend(["summer-camp", "kids", "free"])
        return "community", "youth_program", tags

    # Sports and fitness
    if any(kw in text for kw in [
        "sports", "basketball", "soccer", "football",
        "fitness", "athletics", "tournament", "league"
    ]):
        tags.extend(["sports", "fitness", "after-school"])
        return "sports", "youth_sports", tags

    # Wellness and health programs
    if any(kw in text for kw in [
        "wellness", "health", "nutrition", "mental health",
        "health fair", "wellness fair"
    ]):
        tags.extend(["wellness", "health", "free"])
        return "wellness", "youth_wellness", tags

    # Teen-specific programs
    if any(kw in text for kw in [
        "teen", "youth leadership", "keystone",
        "torch club", "teen center"
    ]):
        tags.extend(["teens", "leadership"])
        return "community", "youth_program", tags

    # After-school programs
    if any(kw in text for kw in [
        "after school", "after-school", "homework help",
        "tutoring", "academic"
    ]):
        tags.extend(["after-school", "education", "free"])
        return "learning", "after_school", tags

    # Family events
    if any(kw in text for kw in [
        "family", "parent", "family night", "community event"
    ]):
        tags.extend(["family", "community", "free"])
        return "community", "family_event", tags

    # Fundraising events
    if any(kw in text for kw in [
        "fundraiser", "gala", "golf tournament", "donor",
        "benefit", "auction"
    ]):
        tags.extend(["fundraiser", "charity"])
        return "community", "fundraiser", tags

    # Volunteer opportunities
    if any(kw in text for kw in [
        "volunteer", "community service", "mentoring"
    ]):
        tags.extend(["volunteer", "service"])
        return "community", "volunteer", tags

    # Default to community/youth
    tags.extend(["free", "after-school"])
    return "community", "youth_program", tags


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl Boys & Girls Clubs of Metro Atlanta events.

    NOTE: BGCMA website may use JavaScript rendering or may focus
    primarily on program information rather than public event calendars.
    """
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        venue_id = get_or_create_venue(VENUE_DATA)

        logger.info(f"Fetching BGCMA events: {EVENTS_URL}")

        response = requests.get(
            EVENTS_URL,
            headers={
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
            },
            timeout=20
        )
        response.raise_for_status()

        soup = BeautifulSoup(response.text, "html.parser")

        # Try to find event containers
        event_containers = (
            soup.find_all("div", class_=re.compile(r"event", re.I)) or
            soup.find_all("article") or
            soup.find_all("div", class_=re.compile(r"card|item|program", re.I))
        )

        if not event_containers:
            logger.warning("No event containers found - site may use JavaScript rendering")
            return events_found, events_new, events_updated

        logger.info(f"Found {len(event_containers)} potential event containers")

        seen_events = set()
        today = datetime.now().date()

        for container in event_containers:
            try:
                # Try to extract title
                title_elem = (
                    container.find("h2") or
                    container.find("h3") or
                    container.find("h4") or
                    container.find("a", class_=re.compile(r"title|headline", re.I))
                )
                if not title_elem:
                    continue

                title = title_elem.get_text(strip=True)
                if not title or len(title) < 5:
                    continue

                # Skip if it's clearly a permanent program, not an event
                if any(kw in title.lower() for kw in [
                    "after school program",
                    "membership",
                    "about us",
                    "our programs"
                ]) and not any(kw in title.lower() for kw in [
                    "registration",
                    "fair",
                    "showcase",
                    "tournament"
                ]):
                    continue

                # Find link
                link_elem = container.find("a", href=True)
                event_url = EVENTS_URL
                if link_elem:
                    href = link_elem.get("href")
                    if href.startswith("http"):
                        event_url = href
                    elif href.startswith("/"):
                        event_url = f"{BASE_URL}{href}"

                # Extract description
                desc_elem = (
                    container.find("p") or
                    container.find("div", class_=re.compile(r"description|summary|excerpt", re.I))
                )
                description = None
                if desc_elem:
                    desc_text = desc_elem.get_text(" ", strip=True)
                    description = desc_text if len(desc_text) > 10 else None

                # Try to extract date
                date_elem = container.find(class_=re.compile(r"date|time", re.I))
                if not date_elem:
                    # Try to find any text that looks like a date
                    all_text = container.get_text()
                    date_match = re.search(
                        r'(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:,?\s+\d{4})?',
                        all_text,
                        re.IGNORECASE
                    )
                    if date_match:
                        date_text = date_match.group(0)
                    else:
                        logger.debug(f"No date found for: {title}")
                        continue
                else:
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

                # Most BGCMA community events are free for members/participants
                is_free = True
                if description:
                    desc_lower = description.lower()
                    if any(kw in desc_lower for kw in [
                        "ticket", "admission", "registration fee", "cost"
                    ]):
                        if "free" not in desc_lower:
                            is_free = False

                # Build event record
                event_record = {
                    "source_id": source_id,
                    "venue_id": venue_id,
                    "title": title[:200],
                    "description": description[:1000] if description else None,
                    "start_date": start_date,
                    "start_time": None,
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
                    "extraction_confidence": 0.7,
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
            f"BGCMA crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except requests.RequestException as e:
        logger.error(f"Failed to fetch BGCMA events: {e}")
        raise
    except Exception as e:
        logger.error(f"Failed to crawl BGCMA: {e}")
        raise

    return events_found, events_new, events_updated
