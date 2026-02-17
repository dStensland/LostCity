"""
Crawler for American Cancer Society Georgia (cancer.org).

The American Cancer Society provides cancer support services, education,
and fundraising events throughout Georgia.

Events include:
- Relay For Life walks and fundraisers
- Cancer screenings and health fairs
- Support group meetings
- Educational workshops and seminars
- Volunteer training and orientation
- Awareness campaigns and walks

Located in Downtown Atlanta, serving all of Georgia.

Site structure: Large organizational website with regional event listings.
May require parsing event calendar or news sections.
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

BASE_URL = "https://www.cancer.org"
GEORGIA_URL = f"{BASE_URL}/about-us/local/georgia.html"
EVENTS_URL = f"{BASE_URL}/involved/participate/relay-for-life/find-a-relay.html"

VENUE_DATA = {
    "name": "American Cancer Society Georgia",
    "slug": "acs-georgia",
    "address": "250 Williams St NW Suite 6000",
    "neighborhood": "Downtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30303",
    "lat": 33.7617,
    "lng": -84.3918,
    "venue_type": "organization",
    "spot_type": "organization",
    "website": "https://www.cancer.org/about-us/local/georgia.html",
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
    Categorize ACS Georgia events.

    Returns: (category, subcategory, tags)
    """
    text = f"{title} {description}".lower()
    tags = ["cancer-support", "community-health", "acs"]

    # Relay For Life and fundraising walks
    if any(kw in text for kw in [
        "relay for life", "relay", "walk", "run", "5k", "fundraiser", "race"
    ]):
        tags.extend(["fundraiser", "walk", "outdoor", "family"])
        return "community", "fundraiser", tags

    # Health screenings
    if any(kw in text for kw in [
        "screening", "test", "mammogram", "health fair", "check-up"
    ]):
        tags.extend(["screening", "health-screening", "free"])
        return "wellness", "health_screening", tags

    # Support groups
    if any(kw in text for kw in [
        "support group", "survivor", "caregiver support", "patient support"
    ]):
        tags.extend(["support-group", "mental-health", "cancer-survivors"])
        return "wellness", "support_group", tags

    # Educational workshops
    if any(kw in text for kw in [
        "workshop", "seminar", "education", "training", "class", "learn",
        "prevention", "awareness"
    ]):
        tags.extend(["education", "workshop", "health-education"])
        return "learning", "workshop", tags

    # Volunteer events
    if any(kw in text for kw in [
        "volunteer", "volunteer training", "orientation"
    ]):
        tags.extend(["volunteer", "community-service"])
        return "community", "volunteer", tags

    # Awareness campaigns
    if any(kw in text for kw in [
        "awareness", "campaign", "pink", "ribbon", "survivors day"
    ]):
        tags.extend(["awareness", "community-event"])
        return "community", "awareness", tags

    # Default
    tags.append("community-event")
    return "wellness", "community_health", tags


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl American Cancer Society Georgia events.

    Note: ACS has a complex national website. This crawler attempts to find
    Georgia-specific events from the regional page and event listings.
    """
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        venue_id = get_or_create_venue(VENUE_DATA)

        urls_to_try = [GEORGIA_URL]

        for url in urls_to_try:
            try:
                logger.info(f"Fetching ACS Georgia page: {url}")

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

                # Look for event containers
                event_containers = soup.find_all("div", class_=lambda x: x and "event" in x.lower())

                if not event_containers:
                    event_containers = soup.find_all("article")

                if not event_containers:
                    # Try to find news/event items
                    event_containers = soup.find_all("div", class_=lambda x: x and any(
                        kw in (x or "").lower() for kw in ["item", "card", "post"]
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

                        # Skip if doesn't look like event title
                        if len(title) < 5:
                            continue

                        # Get link
                        link_elem = title_elem.find("a")
                        if not link_elem:
                            link_elem = container.find("a")

                        event_url = GEORGIA_URL
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


                        category, subcategory, tags = categorize_event(title, description or "")

                        # Many ACS events are free, some have registration fees
                        is_free = "free" in text or "no cost" in text

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

                if events_found > 0:
                    break

            except requests.RequestException as e:
                logger.debug(f"Failed to fetch {url}: {e}")
                continue

        logger.info(
            f"ACS Georgia crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl ACS Georgia: {e}")
        raise

    return events_found, events_new, events_updated
