"""
Crawler for Atlanta Legal Aid Society volunteer trainings.

Atlanta Legal Aid's general events pages are sparse, but the official volunteer
page publishes upcoming pro bono trainings with dates, times, locations, and a
signup form. This crawler targets that page directly instead of the generic
calendar guesses that previously returned 0 events.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime
from typing import Optional

import requests
from bs4 import BeautifulSoup

from db import get_or_create_place, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://atlantalegalaid.org"
VOLUNTEER_URL = f"{BASE_URL}/volunteer/"

PLACE_DATA = {
    "name": "Atlanta Legal Aid Society",
    "slug": "atlanta-legal-aid",
    "address": "54 Ellis St NE",
    "neighborhood": "Downtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30303",
    "lat": 33.7565,
    "lng": -84.3893,
    "place_type": "organization",
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


def extract_upcoming_training(page_text: str) -> Optional[dict]:
    """
    Parse the upcoming volunteer training block from the volunteer page text.

    Example block observed on 2026-03-09:
      Upcoming Training: Representing Survivors at Temporary Protective Order Hearings
      April 2, 2026, 9 am – 12 pm
      RedBud Blossom Family Justice Center
      277 Fairground Street, SE
      Marietta, GA 30060
    """
    match = re.search(
        r"Upcoming\s*Training:?\s*"
        r"(?P<title>.+?)\s+"
        r"(?P<date>(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4}),\s*"
        r"(?P<start>\d{1,2}(?::\d{2})?\s*(?:am|pm))\s*[–-]\s*"
        r"(?P<end>\d{1,2}(?::\d{2})?\s*(?:am|pm))\s+"
        r"(?P<venue>.+?)\s+"
        r"(?P<address>\d{1,5}.+?)\s+"
        r"(?P<city_state_zip>[A-Za-z .'-]+,\s*[A-Z]{2}\s+\d{5})",
        page_text,
        re.IGNORECASE | re.DOTALL,
    )
    if not match:
        return None

    title = " ".join(match.group("title").split())
    start_date = parse_date_from_text(match.group("date"))
    if not start_date:
        return None

    return {
        "title": title,
        "start_date": start_date,
        "start_time": parse_time_from_text(match.group("start")),
        "end_time": parse_time_from_text(match.group("end")),
        "venue": " ".join(match.group("venue").split()),
        "address": " ".join(match.group("address").split()),
        "city_state_zip": " ".join(match.group("city_state_zip").split()),
    }


def categorize_event(title: str, description: str) -> tuple[str, Optional[str], list[str]]:
    """
    Categorize Legal Aid events based on content.

    Returns: (category, subcategory, tags)
    """
    text = f"{title} {description}".lower()
    tags = ["legal-aid", "free", "community"]

    # Legal clinics
    if any(kw in text for kw in [
        "clinic", "consultation", "legal help", "legal assistance",
        "free legal"
    ]):
        tags.extend(["legal-clinic", "consultation"])
        return "other", "legal_clinic", tags

    # Know Your Rights workshops
    if any(kw in text for kw in [
        "know your rights", "rights workshop", "tenant rights",
        "housing rights", "consumer rights", "immigration rights"
    ]):
        tags.extend(["workshop", "education", "advocacy"])
        return "learning", "workshop", tags

    # Educational workshops
    if any(kw in text for kw in [
        "workshop", "training", "education", "seminar",
        "presentation", "class"
    ]):
        tags.extend(["workshop", "education"])
        return "learning", "workshop", tags

    # Volunteer events
    if any(kw in text for kw in [
        "volunteer", "pro bono", "attorney orientation",
        "legal volunteer"
    ]):
        tags.extend(["volunteer"])
        return "community", "volunteer", tags

    # Community events
    if any(kw in text for kw in [
        "community", "outreach", "awareness", "fundraiser"
    ]):
        tags.extend(["community"])
        return "community", None, tags

    # Default to learning/legal
    tags.append("legal")
    return "other", None, tags


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl Atlanta Legal Aid's volunteer page for dated pro bono trainings.
    """
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        venue_id = get_or_create_place(PLACE_DATA)
        logger.info("Fetching Atlanta Legal Aid volunteer page: %s", VOLUNTEER_URL)
        response = requests.get(
            VOLUNTEER_URL,
            headers={
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
            },
            timeout=20
        )
        response.raise_for_status()

        soup = BeautifulSoup(response.text, "html.parser")
        page_text = soup.get_text("\n", strip=True)
        training = extract_upcoming_training(page_text)
        if not training:
            logger.warning("No upcoming training found on %s", VOLUNTEER_URL)
            return events_found, events_new, events_updated

        today = datetime.now().date()
        event_date = datetime.strptime(training["start_date"], "%Y-%m-%d").date()
        if event_date < today:
            logger.info("Upcoming training on %s is already past; skipping", training["start_date"])
            return events_found, events_new, events_updated

        signup_link = None
        for anchor in soup.find_all("a", href=True):
            anchor_text = " ".join(anchor.get_text(" ", strip=True).split())
            if "representing survivors at tpo proceedings" in anchor_text.lower():
                signup_link = anchor["href"]
                break
        if signup_link and not signup_link.startswith("http"):
            signup_link = BASE_URL + signup_link if signup_link.startswith("/") else f"{BASE_URL}/{signup_link}"

        description = (
            "Free pro bono training for attorneys and advocates interested in representing survivors "
            "at temporary protective order hearings. "
            f"Location: {training['venue']}, {training['address']}, {training['city_state_zip']}."
        )

        category, subcategory, tags = categorize_event(training["title"], description)
        tags = list(dict.fromkeys(tags + ["volunteer", "training", "advocacy"]))

        content_hash = generate_content_hash(
            training["title"], PLACE_DATA["name"], training["start_date"]
        )
        event_record = {
            "source_id": source_id,
            "place_id": venue_id,
            "title": training["title"][:200],
            "description": description[:1000],
            "start_date": training["start_date"],
            "start_time": training["start_time"],
            "end_date": training["start_date"],
            "end_time": training["end_time"],
            "is_all_day": False,
            "category": category,
            "subcategory": subcategory,
            "tags": tags,
            "price_min": 0,
            "price_max": 0,
            "price_note": "Free",
            "is_free": True,
            "source_url": VOLUNTEER_URL,
            "ticket_url": signup_link or VOLUNTEER_URL,
            "image_url": None,
            "raw_text": page_text[:500],
            "extraction_confidence": 0.9,
            "is_recurring": False,
            "recurrence_rule": None,
            "content_hash": content_hash,
        }

        events_found = 1
        existing = find_event_by_hash(content_hash)
        if existing:
            smart_update_existing_event(existing, event_record)
            events_updated += 1
        else:
            insert_event(event_record)
            events_new += 1
            logger.info("Added Atlanta Legal Aid training: %s on %s", training["title"], training["start_date"])

        logger.info(
            "Atlanta Legal Aid crawl complete: %d found, %d new, %d updated",
            events_found,
            events_new,
            events_updated,
        )

    except Exception as e:
        logger.error(f"Failed to crawl Atlanta Legal Aid: {e}")
        raise

    return events_found, events_new, events_updated
