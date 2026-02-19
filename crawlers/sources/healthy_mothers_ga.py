"""
Crawler for Healthy Mothers Healthy Babies Coalition of Georgia (hmhbga.org).

Healthy Mothers Healthy Babies Coalition of Georgia works to improve maternal
and infant health outcomes through education, advocacy, and community programs.

Events include:
- Prenatal and postpartum support groups
- Maternal health educational workshops
- Breastfeeding support and classes
- Baby shower and resource fairs
- Community health initiatives
- Advocacy and awareness events

Service area: Statewide Georgia with headquarters in Tucker.

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

BASE_URL = "https://hmhbga.org"
EVENTS_URL = f"{BASE_URL}/events/"

# Healthy Mothers Healthy Babies Coalition of Georgia headquarters
VENUE_DATA = {
    "name": "Healthy Mothers Healthy Babies Coalition of Georgia",
    "slug": "healthy-mothers-healthy-babies-ga",
    "address": "2300 Henderson Mill Rd NE, Suite 300",
    "neighborhood": "Tucker",
    "city": "Tucker",
    "state": "GA",
    "zip": "30345",
    "lat": 33.8437,
    "lng": -84.2667,
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
    Categorize HMHB events based on content.

    Returns: (category, subcategory, tags)
    """
    text = f"{title} {description}".lower()
    tags = ["maternal-health", "family-friendly", "community"]

    # Prenatal and postpartum support
    if any(kw in text for kw in [
        "prenatal", "postpartum", "pregnancy", "expecting",
        "new mom", "new parent", "support group", "moms group"
    ]):
        tags.extend(["prenatal", "postpartum", "support-group"])
        return "wellness", "support_group", tags

    # Breastfeeding support
    if any(kw in text for kw in [
        "breastfeeding", "lactation", "nursing", "breastfeed",
        "breast feeding", "la leche"
    ]):
        tags.extend(["breastfeeding", "postpartum", "education"])
        return "wellness", "health_program", tags

    # Educational workshops and classes
    if any(kw in text for kw in [
        "workshop", "class", "training", "education",
        "seminar", "webinar", "learn", "childbirth"
    ]):
        tags.extend(["education", "workshop", "parenting"])
        return "learning", "workshop", tags

    # Baby showers and resource fairs
    if any(kw in text for kw in [
        "baby shower", "resource fair", "health fair",
        "baby fair", "community shower", "diaper drive"
    ]):
        tags.extend(["resource-fair", "community-event", "families"])
        return "community", "fair", tags

    # Health programs and screenings
    if any(kw in text for kw in [
        "health screening", "wellness", "nutrition",
        "health education", "community health", "prenatal care"
    ]):
        tags.extend(["health", "wellness", "screening"])
        return "wellness", "health_program", tags

    # Advocacy and awareness
    if any(kw in text for kw in [
        "advocacy", "awareness", "maternal health week",
        "awareness month", "policy", "legislative"
    ]):
        tags.extend(["advocacy", "awareness", "education"])
        return "community", "advocacy", tags

    # Community events
    if any(kw in text for kw in [
        "community", "social", "celebration", "gathering",
        "fundraiser", "benefit"
    ]):
        tags.extend(["community-event", "social"])
        return "community", "social", tags

    # Default to wellness/educational
    tags.append("educational")
    return "wellness", "educational", tags


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl Healthy Mothers Healthy Babies Coalition of Georgia events calendar.

    The site uses The Events Calendar plugin with server-rendered HTML.
    """
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        venue_id = get_or_create_venue(VENUE_DATA)

        logger.info(f"Fetching HMHB events: {EVENTS_URL}")

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

                # Most HMHB events are free
                is_free = False
                if description and any(kw in description.lower() for kw in ["$", "cost", "fee", "price"]):
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
            f"HMHB crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except requests.RequestException as e:
        logger.error(f"Failed to fetch HMHB events: {e}")
        raise
    except Exception as e:
        logger.error(f"Failed to crawl HMHB: {e}")
        raise

    return events_found, events_new, events_updated
