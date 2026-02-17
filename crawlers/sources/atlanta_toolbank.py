"""
Crawler for Atlanta Community ToolBank (toolbank.org).

Tool lending library for nonprofits supporting volunteer projects across metro Atlanta.
Volunteer opportunities include tool sorting days, nonprofit project support, warehouse
operations, and community service projects.

CURRENT STATUS:
The ToolBank website does not have a public-facing structured volunteer calendar.
Their volunteer opportunities appear to be coordinated through direct outreach
to partner nonprofits and occasional volunteer workdays that may not be publicly listed.

STRATEGY:
- Check main website for any event listings
- Look for volunteer page announcements
- Report findings for manual follow-up if no structured calendar exists

Future enhancement: Reach out to ToolBank directly to ask if they have:
1. A volunteer calendar API or feed
2. An events page we can scrape
3. Eventbrite or other platform for volunteer signups
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

BASE_URL = "https://www.toolbank.org"
EVENTS_URL = f"{BASE_URL}/events/"
VOLUNTEER_URL = f"{BASE_URL}/volunteer/"

VENUE_DATA = {
    "name": "Atlanta Community ToolBank",
    "slug": "atlanta-toolbank",
    "address": "404 E Lake Ave",
    "neighborhood": "Lakewood Heights",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30315",
    "lat": 33.7006,
    "lng": -84.3798,
    "venue_type": "nonprofit",
    "spot_type": "nonprofit",
    "website": BASE_URL,
    "vibes": ["volunteer", "tools", "community"],
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


def determine_category_and_tags(title: str, description: str) -> tuple[str, Optional[str], list[str]]:
    """
    Categorize ToolBank events based on content.
    Returns: (category, subcategory, tags)
    """
    text = f"{title} {description}".lower()
    tags = ["volunteer", "nonprofit", "tools", "community"]

    # Volunteer workdays
    if any(kw in text for kw in [
        "volunteer day", "tool sorting", "warehouse", "workday",
        "volunteer shift", "volunteer opportunity"
    ]):
        tags.extend(["volunteer-opportunity", "hands-on"])
        return "community", "volunteer", tags

    # Nonprofit project days
    if any(kw in text for kw in [
        "project day", "community project", "nonprofit", "service project"
    ]):
        tags.extend(["community-service", "service-project"])
        return "community", "volunteer", tags

    # Training and workshops
    if any(kw in text for kw in [
        "workshop", "training", "orientation", "safety", "tool training"
    ]):
        tags.extend(["education", "training"])
        return "learning", "workshop", tags

    # Fundraisers and special events
    if any(kw in text for kw in [
        "fundraiser", "gala", "benefit", "auction", "donor"
    ]):
        tags.extend(["fundraiser", "charity"])
        return "community", "fundraiser", tags

    # Default to community/volunteer
    tags.append("volunteer-opportunity")
    return "community", "volunteer", tags


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl Atlanta Community ToolBank events.

    Note: ToolBank does not currently have a structured public volunteer calendar.
    This crawler checks common event page patterns but may return 0 events.
    Manual outreach to ToolBank may be needed to access their volunteer schedule.
    """
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        # Create venue record
        venue_id = get_or_create_venue(VENUE_DATA)

        # Try potential events URLs
        potential_urls = [
            EVENTS_URL,
            VOLUNTEER_URL,
            f"{BASE_URL}/get-involved/",
            f"{BASE_URL}/volunteer-opportunities/",
        ]

        headers = {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
        }

        working_url = None
        events_page_html = None

        for url in potential_urls:
            try:
                logger.info(f"Trying Atlanta ToolBank URL: {url}")
                response = requests.get(url, headers=headers, timeout=20)
                if response.status_code == 200:
                    events_page_html = response.text
                    working_url = url
                    logger.info(f"Successfully fetched: {url}")
                    break
            except requests.RequestException as e:
                logger.debug(f"Failed to fetch {url}: {e}")
                continue

        if not events_page_html:
            logger.warning(
                "Could not find Atlanta ToolBank events page at any known URL. "
                "Site may not have a public volunteer calendar. Manual follow-up recommended."
            )
            return events_found, events_new, events_updated

        soup = BeautifulSoup(events_page_html, "html.parser")

        # Try to find event containers
        # Pattern 1: The Events Calendar plugin (common for WordPress/Divi sites)
        event_containers = soup.select('.tribe-events-calendar-list__event, .tribe-events-list-event')

        if not event_containers:
            # Pattern 2: Generic event divs
            event_containers = soup.select('[class*="event"], article')

        if not event_containers or len(event_containers) == 0:
            logger.info(
                f"No structured events found on {working_url}. "
                "Atlanta ToolBank may coordinate volunteer opportunities through direct outreach "
                "rather than public listings. Consider reaching out to them directly."
            )
            return events_found, events_new, events_updated

        logger.info(f"Found {len(event_containers)} potential event containers")

        seen_events = set()
        today = datetime.now().date()

        for container in event_containers:
            try:
                # Extract title
                title_elem = (
                    container.select_one("h1, h2, h3, h4") or
                    container.select_one("[class*='title'], [class*='heading']") or
                    container.select_one("a")
                )
                if not title_elem:
                    continue

                title = title_elem.get_text(strip=True)
                if not title or len(title) < 5:
                    continue

                # Get event URL
                link_elem = container.select_one("a[href]")
                event_url = link_elem.get("href", working_url) if link_elem else working_url
                if event_url and not event_url.startswith("http"):
                    event_url = BASE_URL + event_url if event_url.startswith("/") else f"{BASE_URL}/{event_url}"

                # Extract description
                desc_elem = container.select_one("[class*='description'], [class*='excerpt'], p")
                description = desc_elem.get_text(" ", strip=True) if desc_elem else None

                # Extract date
                date_elem = container.select_one("time, [class*='date']")
                date_text = None
                if date_elem:
                    date_text = date_elem.get("datetime") or date_elem.get_text(strip=True)

                if not date_text:
                    # Try to find date in text
                    event_text = container.get_text()
                    date_match = re.search(
                        r'(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:,?\s+\d{4})?',
                        event_text,
                        re.IGNORECASE
                    )
                    if date_match:
                        date_text = date_match.group(0)

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
                time_elem = container.select_one("[class*='time']")
                start_time = None
                if time_elem:
                    time_text = time_elem.get_text(strip=True)
                    start_time = parse_time_from_text(time_text)
                else:
                    time_match = re.search(r'\d{1,2}:\d{2}\s*(?:AM|PM|am|pm)', container.get_text())
                    if time_match:
                        start_time = parse_time_from_text(time_match.group(0))

                # Dedupe check
                event_key = f"{title}|{start_date}"
                if event_key in seen_events:
                    continue
                seen_events.add(event_key)

                events_found += 1

                # Categorize event
                category, subcategory, tags = determine_category_and_tags(
                    title, description or ""
                )

                # Generate content hash
                content_hash = generate_content_hash(
                    title, "Atlanta Community ToolBank", start_date
                )

                # Build event record
                event_record = {
                    "source_id": source_id,
                    "venue_id": venue_id,
                    "title": title[:200],
                    "description": description[:1000] if description else None,
                    "start_date": start_date,
                    "start_time": start_time,
                    "end_date": None,
                    "end_time": None,
                    "is_all_day": False,
                    "category": category,
                    "tags": tags,
                    "price_min": None,
                    "price_max": None,
                    "price_note": None,
                    "is_free": True,  # Volunteer opportunities are free
                    "source_url": event_url,
                    "ticket_url": event_url,
                    "image_url": None,
                    "raw_text": f"{title} {description or ''}"[:500],
                    "extraction_confidence": 0.80,
                    "is_recurring": False,
                    "recurrence_rule": None,
                    "content_hash": content_hash,
                }

                # Check for existing
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
            f"Atlanta ToolBank crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

        if events_found == 0:
            logger.info(
                "NOTE: Atlanta ToolBank may not have a public volunteer calendar. "
                "Their events may be coordinated through partner nonprofits or direct outreach. "
                "Consider contacting them at (404) 963-2551 to ask about volunteer opportunities."
            )

    except Exception as e:
        logger.error(f"Failed to crawl Atlanta ToolBank: {e}")
        raise

    return events_found, events_new, events_updated
