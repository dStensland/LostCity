"""
Crawler for American Red Cross CPR & First Aid Classes - Atlanta area
(redcross.org/local/georgia).

This crawler focuses on training and certification classes, NOT blood drives
(which are handled by a separate blood drive crawler if needed).

Events include:
- CPR and AED certification classes
- First Aid training courses
- Babysitting and childcare training
- Lifeguard certification
- Disaster preparedness workshops
- Instructor training courses

The Atlanta Training Center serves metro Atlanta with a variety of
health and safety certification programs.

Site uses Sched.org or similar event calendar system.
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

BASE_URL = "https://www.redcross.org"
# Note: Red Cross uses a class finder tool that may require form submission
# Attempting to crawl the general events/news page for Georgia
EVENTS_URL = f"{BASE_URL}/local/georgia/about-us/news-and-events"

VENUE_DATA = {
    "name": "American Red Cross Atlanta Training Center",
    "slug": "red-cross-cpr-atlanta",
    "address": "1955 Monroe Dr NE",
    "neighborhood": "Midtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30324",
    "lat": 33.7940,
    "lng": -84.3560,
    "venue_type": "organization",
    "spot_type": "organization",
    "website": "https://www.redcross.org/local/georgia.html",
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
    Categorize Red Cross training events based on content.

    Returns: (category, subcategory, tags)
    """
    text = f"{title} {description}".lower()
    tags = ["cpr", "training", "safety"]

    # Skip blood drive events (not the focus of this crawler)
    if any(kw in text for kw in ["blood drive", "donate blood", "blood donation"]):
        # Still categorize but mark differently
        tags = ["blood-drive", "health", "donation"]
        return "wellness", "blood_drive", tags

    # CPR and AED certification
    if any(kw in text for kw in [
        "cpr", "aed", "bls", "acls", "pals", "heartsaver",
        "cardiopulmonary", "automated external defibrillator"
    ]):
        tags.extend(["certification", "first-aid"])
        return "learning", "certification", tags

    # First Aid
    if any(kw in text for kw in [
        "first aid", "firstaid", "emergency response",
        "wilderness first aid"
    ]):
        tags.extend(["certification", "first-aid"])
        return "learning", "certification", tags

    # Lifeguard training
    if any(kw in text for kw in [
        "lifeguard", "lifeguarding", "water safety",
        "swimming instructor"
    ]):
        tags.extend(["certification", "water-safety", "swimming"])
        return "learning", "certification", tags

    # Babysitting and childcare
    if any(kw in text for kw in [
        "babysitting", "babysitter", "childcare", "child care"
    ]):
        tags.extend(["certification", "childcare", "youth"])
        return "learning", "certification", tags

    # Disaster preparedness
    if any(kw in text for kw in [
        "disaster", "emergency preparedness", "shelter",
        "disaster response", "emergency management"
    ]):
        tags.extend(["disaster-prep", "emergency"])
        return "learning", "workshop", tags

    # Instructor training
    if any(kw in text for kw in [
        "instructor", "teach", "trainer", "train-the-trainer"
    ]):
        tags.extend(["certification", "professional"])
        return "learning", "professional_development", tags

    # Default to learning/training
    tags.append("certification")
    return "learning", "certification", tags


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl American Red Cross training classes for Atlanta.

    NOTE: Red Cross class finder uses interactive forms. This crawler
    attempts to parse news/events page but may require upgrade to
    Playwright or API integration for full class listings.
    """
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        venue_id = get_or_create_venue(VENUE_DATA)

        logger.info(f"Fetching Red Cross events: {EVENTS_URL}")

        response = requests.get(
            EVENTS_URL,
            headers={
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
            },
            timeout=20
        )
        response.raise_for_status()

        soup = BeautifulSoup(response.text, "html.parser")

        # Try to find event/news containers
        event_containers = (
            soup.find_all("div", class_=re.compile(r"event|news|article", re.I)) or
            soup.find_all("article") or
            soup.find_all("div", class_=re.compile(r"card|item", re.I))
        )

        if not event_containers:
            logger.warning("No event containers found - site may require interactive form submission")
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

                # Skip if it's clearly not a training event
                if "blood drive" in title.lower() and "training" not in title.lower():
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

                # Red Cross training classes typically have fees
                is_free = False
                if description and "free" in description.lower():
                    is_free = True

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
            f"Red Cross CPR crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except requests.RequestException as e:
        logger.error(f"Failed to fetch Red Cross events: {e}")
        raise
    except Exception as e:
        logger.error(f"Failed to crawl Red Cross: {e}")
        raise

    return events_found, events_new, events_updated
