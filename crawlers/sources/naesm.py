"""
Crawler for NAESM Inc (naesminc.org).

NAESM is a community health organization serving Black gay and bisexual men
in metropolitan Atlanta.

Services and events include:
- Free HIV/STI testing and counseling
- PrEP navigation and support
- Peer support groups and social events
- Health education workshops
- Community outreach programs

Located in East Point, GA, serving the broader Atlanta metro area.

Site structure: WordPress-based, events may be posted on news/events pages or social media.
This crawler attempts to parse the main events/news sections.
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

BASE_URL = "https://naesminc.org"
EVENTS_URL = f"{BASE_URL}/events"  # Try /events, /news, or /programs
NEWS_URL = f"{BASE_URL}/news"

VENUE_DATA = {
    "name": "NAESM",
    "slug": "naesm",
    "address": "2860 Church St",
    "neighborhood": "East Point",
    "city": "East Point",
    "state": "GA",
    "zip": "30344",
    "lat": 33.6765,
    "lng": -84.4393,
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

    # Try MM/DD/YYYY or M/D/YYYY
    match = re.match(r'(\d{1,2})/(\d{1,2})/(\d{4})', date_text)
    if match:
        month = int(match.group(1))
        day = int(match.group(2))
        year = int(match.group(3))
        try:
            dt = datetime(year, month, day)
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
    Categorize NAESM events.

    Returns: (category, subcategory, tags)
    """
    text = f"{title} {description}".lower()
    tags = ["lgbtq", "community-health", "naesm"]

    # Testing events
    if any(kw in text for kw in [
        "hiv test", "sti test", "testing", "screening", "health screening",
        "prep", "pep", "sexual health"
    ]):
        tags.extend(["hiv-testing", "free", "health-screening"])
        return "wellness", "health_screening", tags

    # Support groups
    if any(kw in text for kw in [
        "support group", "peer support", "group session", "sharing circle"
    ]):
        tags.extend(["support-group", "mental-health", "peer-support"])
        return "wellness", "support_group", tags

    # Educational workshops
    if any(kw in text for kw in [
        "workshop", "seminar", "education", "training", "class", "learn"
    ]):
        tags.extend(["education", "workshop", "health-education"])
        return "learning", "workshop", tags

    # Social events
    if any(kw in text for kw in [
        "social", "mixer", "gathering", "celebration", "party", "game night"
    ]):
        tags.extend(["social", "networking"])
        return "community", "social", tags

    # Default to wellness
    tags.append("community-event")
    return "wellness", "community_health", tags


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl NAESM events.

    Note: NAESM may post events on Facebook or other social platforms.
    This crawler attempts to parse any events listed on their website.
    """
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        venue_id = get_or_create_venue(VENUE_DATA)

        # Try multiple possible event pages
        urls_to_try = [EVENTS_URL, NEWS_URL, BASE_URL]

        for url in urls_to_try:
            try:
                logger.info(f"Fetching NAESM page: {url}")

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

                # Look for common event container patterns
                # Try WordPress events plugin
                event_containers = soup.find_all("article", class_=lambda x: x and "event" in x.lower())

                # Try generic article/post containers
                if not event_containers:
                    event_containers = soup.find_all("article")

                # Try div-based event listings
                if not event_containers:
                    event_containers = soup.find_all("div", class_=lambda x: x and any(
                        kw in x.lower() for kw in ["event", "post", "entry", "item"]
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
                        title_elem = container.find(["h1", "h2", "h3", "h4"], class_=lambda x: x and any(
                            kw in x.lower() for kw in ["title", "entry", "event"]
                        ))

                        if not title_elem:
                            title_elem = container.find(["h1", "h2", "h3", "h4"])

                        if not title_elem:
                            continue

                        title = title_elem.get_text(strip=True)

                        # Get link
                        link_elem = title_elem.find("a")
                        if not link_elem:
                            link_elem = container.find("a")

                        event_url = BASE_URL
                        if link_elem and link_elem.get("href"):
                            href = link_elem.get("href")
                            event_url = href if href.startswith("http") else f"{BASE_URL}{href}"

                        # Extract description
                        desc_elem = container.find(["p", "div"], class_=lambda x: x and any(
                            kw in x.lower() for kw in ["excerpt", "summary", "description", "content"]
                        ))

                        description = None
                        if desc_elem:
                            description = desc_elem.get_text(" ", strip=True)[:1000]

                        # Try to extract date from content
                        # Look for date metadata or text
                        date_elem = container.find(["time", "span", "div"], class_=lambda x: x and "date" in x.lower())

                        date_text = None
                        if date_elem:
                            date_text = date_elem.get_text(strip=True)
                            if date_elem.name == "time" and date_elem.get("datetime"):
                                date_text = date_elem.get("datetime")

                        # If no explicit date element, search in title and description
                        if not date_text:
                            search_text = f"{title} {description or ''}"
                            # Look for date patterns in text
                            date_match = re.search(
                                r'(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}(?:,?\s+\d{4})?',
                                search_text,
                                re.IGNORECASE
                            )
                            if date_match:
                                date_text = date_match.group(0)

                        # Skip if no date found
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

                        # Try to extract time
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

                        # Most NAESM events are free
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
                            "price_min": 0 if is_free else None,
                            "price_max": 0 if is_free else None,
                            "price_note": "Free" if is_free else None,
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

                # If we found events, stop trying other URLs
                if events_found > 0:
                    break

            except requests.RequestException as e:
                logger.debug(f"Failed to fetch {url}: {e}")
                continue

        logger.info(
            f"NAESM crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl NAESM: {e}")
        raise

    return events_found, events_new, events_updated
