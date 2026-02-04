"""
Crawler for Halls Atlanta Floral Design School.

WordPress site with static HTML schedule page.
Classes include floral design workshops (9am-1pm, Tue/Wed/Thu).
"""

from __future__ import annotations

import re
import logging
from datetime import datetime
from typing import Optional
import httpx
from bs4 import BeautifulSoup

from db import get_or_create_venue, insert_event, find_event_by_hash
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://hallsatlanta.com"

VENUE_DATA = {
    "name": "Halls Atlanta Floral Design School",
    "slug": "halls-floral",
    "address": "2389 Main St NW",
    "neighborhood": "Buckhead",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30305",
    "lat": 33.8440,
    "lng": -84.3880,
    "venue_type": "studio",
    "spot_type": "studio",
    "website": BASE_URL,
    "vibes": ["floral-design", "workshop", "creative", "hands-on", "flowers"],
}


def parse_date_range(date_text: str) -> list[str]:
    """
    Parse date strings like:
    - "February 4-6" -> ["2026-02-04", "2026-02-05", "2026-02-06"]
    - "Tuesday, February 4" -> ["2026-02-04"]
    - "Feb 4, 5, 6" -> ["2026-02-04", "2026-02-05", "2026-02-06"]
    """
    dates = []

    # Try full date range: "February 4-6" or "Feb 4-6"
    range_match = re.search(
        r"(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})\s*[-–]\s*(\d{1,2})",
        date_text,
        re.IGNORECASE
    )

    if range_match:
        month_str, start_day, end_day = range_match.groups()
        month_map = {
            "jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6,
            "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12
        }
        month = month_map.get(month_str[:3].lower())
        if month:
            year = datetime.now().year
            # Check if dates have passed, use next year if so
            try:
                test_date = datetime(year, month, int(start_day))
                if test_date.date() < datetime.now().date():
                    year += 1
            except ValueError:
                pass

            # Generate all dates in range
            for day in range(int(start_day), int(end_day) + 1):
                try:
                    dates.append(f"{year}-{month:02d}-{day:02d}")
                except ValueError:
                    continue
            return dates

    # Try comma-separated days: "Feb 4, 5, 6"
    comma_match = re.search(
        r"(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+([\d,\s]+)",
        date_text,
        re.IGNORECASE
    )

    if comma_match:
        month_str = comma_match.group(1)
        days_text = comma_match.group(2)

        month_map = {
            "jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6,
            "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12
        }
        month = month_map.get(month_str[:3].lower())

        if month:
            year = datetime.now().year
            days = [d.strip() for d in days_text.split(",") if d.strip().isdigit()]

            # Check if first date has passed
            if days:
                try:
                    test_date = datetime(year, month, int(days[0]))
                    if test_date.date() < datetime.now().date():
                        year += 1
                except ValueError:
                    pass

            for day in days:
                try:
                    dates.append(f"{year}-{month:02d}-{int(day):02d}")
                except ValueError:
                    continue
            return dates

    # Try single date: "February 4" or "Tuesday, February 4"
    single_match = re.search(
        r"(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})",
        date_text,
        re.IGNORECASE
    )

    if single_match:
        month_str, day = single_match.groups()
        month_map = {
            "jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6,
            "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12
        }
        month = month_map.get(month_str[:3].lower())

        if month:
            year = datetime.now().year
            try:
                test_date = datetime(year, month, int(day))
                if test_date.date() < datetime.now().date():
                    year += 1
                dates.append(f"{year}-{month:02d}-{int(day):02d}")
            except ValueError:
                pass

    return dates


def parse_time(time_text: str) -> Optional[str]:
    """Parse time from '9:00am' or '9am-1pm' format. Returns start time."""
    match = re.search(r"(\d{1,2}):?(\d{2})?\s*(am|pm)", time_text, re.IGNORECASE)
    if match:
        hour = int(match.group(1))
        minute = match.group(2) if match.group(2) else "00"
        period = match.group(3)

        if period.lower() == "pm" and hour != 12:
            hour += 12
        elif period.lower() == "am" and hour == 12:
            hour = 0

        return f"{hour:02d}:{minute}"
    return None


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Halls Atlanta Floral Design School schedule page."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    # Create HTTP client
    client = httpx.Client(
        timeout=30.0,
        headers={
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
        },
        follow_redirects=True,
    )

    try:
        venue_id = get_or_create_venue(VENUE_DATA)

        # Try multiple URL patterns for the schedule page
        urls_to_try = [
            f"{BASE_URL}/2026-schedule/",
            f"{BASE_URL}/2026-schedule-2/",
            f"{BASE_URL}/2025-schedule-2/",
            f"{BASE_URL}/design-school/",
        ]

        schedule_html = None
        schedule_url = None

        for url in urls_to_try:
            logger.info(f"Trying schedule URL: {url}")
            try:
                response = client.get(url, timeout=30)
                if response.status_code == 200 and len(response.text) > 500:
                    schedule_html = response.text
                    schedule_url = url
                    logger.info(f"Found schedule at: {url}")
                    break
            except Exception as e:
                logger.debug(f"Failed to fetch {url}: {e}")
                continue

        if not schedule_html:
            logger.warning("Could not find schedule page at any URL")
            return 0, 0, 0

        soup = BeautifulSoup(schedule_html, "html.parser")

        # Strategy 1: Look for structured class containers
        # Common WordPress patterns: .class-item, .event-item, .workshop-item, article, .entry
        class_containers = (
            soup.find_all(class_=re.compile(r"class|event|workshop|course", re.IGNORECASE))
            or soup.find_all("article")
            or soup.find_all(class_=re.compile(r"entry", re.IGNORECASE))
        )

        if class_containers:
            logger.info(f"Found {len(class_containers)} potential class containers")

            for container in class_containers:
                try:
                    # Extract title (look for headings or strong text)
                    title_elem = (
                        container.find(["h1", "h2", "h3", "h4", "h5", "h6"])
                        or container.find("strong")
                        or container.find(class_=re.compile(r"title|name", re.IGNORECASE))
                    )

                    if not title_elem:
                        continue

                    title = title_elem.get_text(strip=True)
                    if not title or len(title) < 3:
                        continue

                    # Extract description (look for .class-extra-info or following paragraphs)
                    description = None
                    desc_elem = (
                        container.find(class_="class-extra-info")
                        or container.find("p")
                        or container.find(class_=re.compile(r"description|content", re.IGNORECASE))
                    )
                    if desc_elem:
                        description = desc_elem.get_text(strip=True)

                    # Extract instructor
                    instructor = None
                    instructor_elem = container.find(class_=re.compile(r"instructor|teacher|taught-by", re.IGNORECASE))
                    if instructor_elem:
                        instructor = instructor_elem.get_text(strip=True)

                    # Extract dates and times from all text in container
                    container_text = container.get_text(" ", strip=True)

                    dates = parse_date_range(container_text)
                    if not dates:
                        continue

                    # Parse time (default to 9am-1pm if not found)
                    start_time = parse_time(container_text) or "09:00"

                    # Create event for each date
                    for date in dates:
                        events_found += 1

                        content_hash = generate_content_hash(
                            title, VENUE_DATA["name"], date
                        )

                        if find_event_by_hash(content_hash):
                            events_updated += 1
                            continue

                        # Build full description
                        full_desc_parts = []
                        if description:
                            full_desc_parts.append(description)
                        if instructor:
                            full_desc_parts.append(f"Instructor: {instructor}")

                        full_description = " | ".join(full_desc_parts) if full_desc_parts else None

                        event_record = {
                            "source_id": source_id,
                            "venue_id": venue_id,
                            "title": title,
                            "description": full_description,
                            "start_date": date,
                            "start_time": start_time,
                            "end_date": date,
                            "end_time": "13:00",  # Classes typically 9am-1pm
                            "is_all_day": False,
                            "category": "arts",
                            "subcategory": "arts.workshop",
                            "tags": [
                                "floral-design",
                                "workshop",
                                "flowers",
                                "creative",
                                "hands-on",
                            ],
                            "price_min": None,
                            "price_max": None,
                            "price_note": "Contact venue for pricing",
                            "is_free": False,
                            "source_url": schedule_url,
                            "ticket_url": schedule_url,
                            "image_url": None,
                            "raw_text": container_text[:500],
                            "extraction_confidence": 0.85,
                            "is_recurring": False,
                            "recurrence_rule": None,
                            "content_hash": content_hash,
                            "is_class": True,
                            "class_category": "floral",
                        }

                        try:
                            insert_event(event_record)
                            events_new += 1
                            logger.info(f"Added: {title} on {date}")
                        except Exception as e:
                            logger.error(f"Failed to insert {title}: {e}")

                except Exception as e:
                    logger.debug(f"Error parsing class container: {e}")
                    continue

        # Strategy 2: Parse page body text line by line (fallback)
        if events_found == 0:
            logger.info("No structured containers found, parsing body text")

            # Get main content area
            main_content = (
                soup.find(class_=re.compile(r"content|main|entry", re.IGNORECASE))
                or soup.find("main")
                or soup.find("body")
            )

            if main_content:
                text = main_content.get_text("\n", strip=True)
                lines = [l.strip() for l in text.split("\n") if l.strip()]

                i = 0
                while i < len(lines):
                    line = lines[i]

                    # Look for date patterns
                    dates = parse_date_range(line)

                    if dates:
                        # Look for title in surrounding lines
                        title = None
                        time_str = None

                        for offset in [-2, -1, 1, 2]:
                            idx = i + offset
                            if 0 <= idx < len(lines):
                                check_line = lines[idx]

                                # Extract time if present
                                if not time_str and re.search(r"\d{1,2}:?\d{0,2}\s*(am|pm)", check_line, re.IGNORECASE):
                                    time_str = check_line

                                # Extract title (non-date, non-time line with substantial text)
                                if not title and len(check_line) > 5:
                                    if not re.search(r"(January|February|March|April|May|June|July|August|September|October|November|December)", check_line, re.IGNORECASE):
                                        if not re.search(r"\d{1,2}:?\d{0,2}\s*(am|pm)", check_line, re.IGNORECASE):
                                            title = check_line

                        if not title:
                            i += 1
                            continue

                        start_time = parse_time(time_str) if time_str else "09:00"

                        for date in dates:
                            events_found += 1

                            content_hash = generate_content_hash(
                                title, VENUE_DATA["name"], date
                            )

                            if find_event_by_hash(content_hash):
                                events_updated += 1
                                continue

                            event_record = {
                                "source_id": source_id,
                                "venue_id": venue_id,
                                "title": title,
                                "description": None,
                                "start_date": date,
                                "start_time": start_time,
                                "end_date": date,
                                "end_time": "13:00",
                                "is_all_day": False,
                                "category": "arts",
                                "subcategory": "arts.workshop",
                                "tags": [
                                    "floral-design",
                                    "workshop",
                                    "flowers",
                                    "creative",
                                    "hands-on",
                                ],
                                "price_min": None,
                                "price_max": None,
                                "price_note": "Contact venue for pricing",
                                "is_free": False,
                                "source_url": schedule_url,
                                "ticket_url": schedule_url,
                                "image_url": None,
                                "raw_text": f"{title} - {date}",
                                "extraction_confidence": 0.75,
                                "is_recurring": False,
                                "recurrence_rule": None,
                                "content_hash": content_hash,
                                "is_class": True,
                                "class_category": "floral",
                            }

                            try:
                                insert_event(event_record)
                                events_new += 1
                                logger.info(f"Added: {title} on {date}")
                            except Exception as e:
                                logger.error(f"Failed to insert {title}: {e}")

                    i += 1

        logger.info(
            f"Halls Atlanta crawl complete: {events_found} found, "
            f"{events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Halls Atlanta: {e}")
        raise

    finally:
        client.close()

    return events_found, events_new, events_updated
