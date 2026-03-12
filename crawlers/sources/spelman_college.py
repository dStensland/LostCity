"""
Crawler for Spelman College Events (spelman.edu/events).
Concerts, lectures, museum exhibitions, and campus events at the #1 HBCU.
Uses their JSON feed for reliable event extraction, plus static HTML list for annual events.
"""

from __future__ import annotations

import json
import logging
import re
from datetime import datetime
from typing import Optional
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

# Keywords that indicate student/alumni-only events (not public)
STUDENT_ONLY_KEYWORDS = [
    "orientation", "new student", "prospective", "open house",
    "registration", "enrollment", "advising", "deadline",
    "reunion", "alumnae weekend", "alumni weekend",
    "virtual info session", "info session",
    "staff meeting", "faculty meeting",
    "commencement rehearsal", "graduation rehearsal",
    "student only", "students only", "for students",
    "admitted students", "accepted students",
    "parent weekend", "family weekend",
    "preview day", "admitted student",
    "career fair", "graduate school fair", "job fair",
]


def is_public_event(title: str, description: str = "") -> bool:
    """Check if event appears to be open to the public (not student/alumni only)."""
    text = f"{title} {description}".lower()

    for keyword in STUDENT_ONLY_KEYWORDS:
        if keyword in text:
            return False

    return True


BASE_URL = "https://www.spelman.edu"
JSON_FEED_URL = f"{BASE_URL}/events/_data/current-live.json"
EVENTS_PAGE_URL = f"{BASE_URL}/events/"
MUSEUM_BASE_URL = "https://museum.spelman.edu"
MUSEUM_EXHIBITIONS_URL = f"{MUSEUM_BASE_URL}/art-and-events/exhibitions/index.html"

VENUES = {
    "museum": {
        "name": "Spelman College Museum of Fine Art",
        "slug": "spelman-museum",
        "address": "350 Spelman Lane SW",
        "neighborhood": "West End",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30314",
        "venue_type": "museum",
        "website": "https://museum.spelman.edu",
    },
    "default": {
        "name": "Spelman College",
        "slug": "spelman-college",
        "address": "350 Spelman Lane SW",
        "neighborhood": "West End",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30314",
        "venue_type": "university",
        "website": "https://spelman.edu",
    },
}


def _clean_text(value: str) -> str:
    text = value or ""
    if any(token in text for token in ("â", "Â", "Ã")):
        try:
            text = text.encode("latin1", errors="ignore").decode("utf-8", errors="ignore")
        except Exception:
            pass
    text = text.replace("\xa0", " ")
    return re.sub(r"\s+", " ", text).strip()


def parse_iso_datetime(iso_string: str) -> tuple[str, str]:
    """
    Parse ISO 8601 datetime string.
    Returns (date, time) tuple.
    Example: "2026-01-25T13:00-0500" -> ("2026-01-25", "13:00")
    """
    if not iso_string:
        return None, None

    try:
        # Split on 'T' to separate date and time
        parts = iso_string.split('T')
        date = parts[0]

        if len(parts) > 1:
            # Extract time, removing timezone offset
            time_part = parts[1]
            # Remove timezone (e.g., "-0500")
            time = re.sub(r'[+-]\d{4}$', '', time_part)
            # Take just HH:MM
            time = time[:5] if len(time) >= 5 else time
            return date, time

        return date, None
    except Exception as e:
        logger.warning(f"Failed to parse datetime {iso_string}: {e}")
        return None, None


def parse_html_date(date_text: str, current_year: int = 2026) -> tuple[str, str]:
    """
    Parse date from HTML text like 'Apr. 17, 2026' or 'May 11-17, 2026' or 'Oct. 2026'.
    Returns (start_date, end_date) tuple in YYYY-MM-DD format.
    """
    if not date_text:
        return None, None

    try:
        # Clean up the text
        date_text = date_text.strip()

        # Pattern: "Month. day - day, year" (with period, e.g., "Dec. 4 - 6, 2026")
        match = re.search(r'(\w+)\.\s+(\d+)\s*-\s*(\d+),\s+(\d{4})', date_text)
        if match:
            month_name, start_day, end_day, year = match.groups()
            month_abbr = month_name[:3]
            start_date = datetime.strptime(f"{month_abbr} {start_day} {year}", "%b %d %Y").strftime("%Y-%m-%d")
            end_date = datetime.strptime(f"{month_abbr} {end_day} {year}", "%b %d %Y").strftime("%Y-%m-%d")
            return start_date, end_date

        # Pattern: "Month day-day, year" (no period, e.g., "May 11-17, 2026")
        match = re.search(r'(\w+)\s+(\d+)\s*-\s*(\d+),\s+(\d{4})', date_text)
        if match:
            month_name, start_day, end_day, year = match.groups()
            # Try full month name first
            try:
                start_date = datetime.strptime(f"{month_name} {start_day} {year}", "%B %d %Y").strftime("%Y-%m-%d")
                end_date = datetime.strptime(f"{month_name} {end_day} {year}", "%B %d %Y").strftime("%Y-%m-%d")
                return start_date, end_date
            except ValueError:
                # Try abbreviated month name
                month_abbr = month_name[:3]
                start_date = datetime.strptime(f"{month_abbr} {start_day} {year}", "%b %d %Y").strftime("%Y-%m-%d")
                end_date = datetime.strptime(f"{month_abbr} {end_day} {year}", "%b %d %Y").strftime("%Y-%m-%d")
                return start_date, end_date

        # Pattern: "Month day, year" (e.g., "Apr. 17, 2026")
        match = re.search(r'(\w+)\.\s+(\d+),\s+(\d{4})', date_text)
        if match:
            month_name, day, year = match.groups()
            month_abbr = month_name[:3]
            date = datetime.strptime(f"{month_abbr} {day} {year}", "%b %d %Y").strftime("%Y-%m-%d")
            return date, None

        # Pattern: "Month year" (e.g., "Oct. 2026")
        match = re.search(r'(\w+)\.\s+(\d{4})', date_text)
        if match:
            month_name, year = match.groups()
            month_abbr = month_name[:3]
            # Use first day of month
            date = datetime.strptime(f"{month_abbr} 1 {year}", "%b %d %Y").strftime("%Y-%m-%d")
            return date, None

    except Exception as e:
        logger.warning(f"Failed to parse HTML date '{date_text}': {e}")

    return None, None


def categorize_event(event_data: dict, title: str) -> tuple[str, str, dict]:
    """
    Categorize event based on filter tags and title.
    Returns (category, subcategory, venue_data).
    """
    filter_tags = event_data.get("filter1", [])
    title_lower = title.lower()

    # Check for museum events
    if "Museum of Fine Art" in filter_tags:
        return "art", "exhibition", VENUES["museum"]

    # Check other filter tags
    if "Arts and Entertainment" in filter_tags:
        if "concert" in title_lower or "music" in title_lower or "choir" in title_lower:
            return "music", "concert", VENUES["default"]
        elif "theater" in title_lower or "performance" in title_lower:
            return "theater", "play", VENUES["default"]
        else:
            return "art", "exhibition", VENUES["default"]

    if "Admissions" in filter_tags:
        return "community", "campus", VENUES["default"]

    if "Athletics" in filter_tags or "athletics" in title_lower:
        return "sports", "college", VENUES["default"]

    if "Commencement" in filter_tags or "homecoming" in title_lower:
        return "community", "campus", VENUES["default"]

    if "Research" in filter_tags or "research" in title_lower or "conference" in title_lower:
        return "community", "lecture", VENUES["default"]

    # Check title keywords
    if "christmas" in title_lower or "carol" in title_lower:
        return "music", "concert", VENUES["default"]

    if "concert" in title_lower or "music" in title_lower or "organist" in title_lower:
        return "music", "concert", VENUES["default"]

    if "lecture" in title_lower or "speaker" in title_lower or "panel" in title_lower:
        return "community", "lecture", VENUES["default"]

    # Default category
    return "community", "campus", VENUES["default"]


def parse_spelman_museum_date_range(date_text: str) -> tuple[Optional[str], Optional[str]]:
    """Parse museum exhibit dates from abbreviated or verbose copy."""
    cleaned = _clean_text(date_text).replace("–", "-").replace("—", "-")
    cleaned = re.sub(r"(\b[A-Za-z]{3})\.\s", r"\1 ", cleaned)

    range_match = re.search(
        r"([A-Za-z]{3,9}\s+\d{1,2},\s+\d{4})\s*-\s*([A-Za-z]{3,9}\s+\d{1,2},\s+\d{4})",
        cleaned,
    )
    if range_match:
        start_raw, end_raw = range_match.groups()
        return _parse_spelman_date(start_raw), _parse_spelman_date(end_raw)

    open_until_match = re.search(
        r"open to the public on\s+(?:[A-Za-z]+,\s+)?([A-Za-z]{3,9}\s+\d{1,2},\s+\d{4}).{0,220}?until\s+([A-Za-z]{3,9}\s+\d{1,2},\s+\d{4})",
        cleaned,
        re.IGNORECASE,
    )
    if open_until_match:
        start_raw, end_raw = open_until_match.groups()
        return _parse_spelman_date(start_raw), _parse_spelman_date(end_raw)

    return None, None


def _parse_spelman_date(date_text: str) -> Optional[str]:
    cleaned = _clean_text(date_text)
    cleaned = re.sub(r"(\b[A-Za-z]{3})\.\s", r"\1 ", cleaned)
    for fmt in ("%B %d, %Y", "%b %d, %Y"):
        try:
            return datetime.strptime(cleaned, fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue
    return None


def normalize_ongoing_exhibit_dates(start_date: str, end_date: Optional[str]) -> tuple[str, Optional[str]]:
    """Keep active exhibits visible by advancing already-open shows to today."""
    if not start_date or not end_date:
        return start_date, end_date

    today = datetime.now().date()
    start_dt = datetime.strptime(start_date, "%Y-%m-%d").date()
    end_dt = datetime.strptime(end_date, "%Y-%m-%d").date()
    if start_dt < today <= end_dt:
        return today.strftime("%Y-%m-%d"), end_date
    return start_date, end_date


def _museum_hash_candidates(title: str, start_date: str) -> list[str]:
    candidates = [generate_content_hash(title, VENUES["museum"]["name"], start_date)]
    if ": " in title:
        candidates.append(
            generate_content_hash(title.replace(": ", ", ", 1), VENUES["museum"]["name"], start_date)
        )
    if ", " in title:
        candidates.append(
            generate_content_hash(title.replace(", ", ": ", 1), VENUES["museum"]["name"], start_date)
        )
    deduped: list[str] = []
    for candidate in candidates:
        if candidate not in deduped:
            deduped.append(candidate)
    return deduped


def extract_museum_exhibitions(html_content: str) -> list[dict]:
    """Extract museum exhibition cards from the museum site."""
    exhibitions: list[dict] = []
    soup = BeautifulSoup(html_content, "html.parser")

    for block in soup.select(".image-content-container"):
        content = block.select_one(".image-content")
        if not content:
            continue

        title_el = content.find("h3")
        if not title_el:
            continue

        title = _clean_text(title_el.get_text(" ", strip=True).split("\n")[0])
        title = title.split(" Oct.", 1)[0].split(" October ", 1)[0].strip()
        if not title:
            continue

        detail_url = None
        detail_link = content.find("a", href=re.compile(r"(?:^|/)exhibitions/.+\.html$", re.IGNORECASE))
        if detail_link and detail_link.get("href"):
            detail_href = detail_link["href"].strip()
            detail_url = urljoin(f"{MUSEUM_BASE_URL}/", detail_href.lstrip("/"))

        combined_text = _clean_text(content.get_text(" ", strip=True))
        start_date_raw, end_date = parse_spelman_museum_date_range(combined_text)
        if not start_date_raw or not end_date:
            continue

        description = None
        for paragraph in content.find_all("p"):
            text = _clean_text(paragraph.get_text(" ", strip=True))
            if len(text) >= 50:
                description = text[:1000]
                break

        image_url = None
        image_container = block.select_one(".image-container[style]")
        if image_container:
            style = image_container.get("style", "")
            image_match = re.search(r"url\(([^)]+)\)", style)
            if image_match:
                image_url = urljoin(MUSEUM_EXHIBITIONS_URL, image_match.group(1).strip("'\""))

        start_date, normalized_end_date = normalize_ongoing_exhibit_dates(start_date_raw, end_date)
        exhibitions.append(
            {
                "title": title,
                "description": description or f"Exhibition at {VENUES['museum']['name']}.",
                "start_date": start_date,
                "hash_start_date": start_date_raw,
                "end_date": normalized_end_date,
                "source_url": detail_url or MUSEUM_EXHIBITIONS_URL,
                "ticket_url": detail_url,
                "image_url": image_url,
            }
        )

    return exhibitions


def parse_static_events(html_content: str) -> list[dict]:
    """
    Parse the static annual events list from the HTML page.
    Returns list of event dicts.
    """
    events = []

    try:
        soup = BeautifulSoup(html_content, 'html.parser')

        # Find the "Key Events for Families" section or similar
        # The events are in a <ul> list with <li> items containing <a> tags and dates
        for li in soup.find_all('li'):
            a_tag = li.find('a')
            if not a_tag:
                continue

            title = a_tag.get('title') or a_tag.get_text(strip=True)
            if not title:
                continue

            # Get the full text which includes the date
            full_text = li.get_text(strip=True)

            # Extract URL
            url = a_tag.get('href', '')
            if url and not url.startswith('http'):
                url = BASE_URL + "/" + url.lstrip('/')

            # Extract date from text after the title
            # Format: "Title - Date"
            if ' - ' in full_text:
                parts = full_text.split(' - ', 1)
                if len(parts) == 2:
                    date_text = parts[1]
                    start_date, end_date = parse_html_date(date_text)

                    if start_date:
                        events.append({
                            'title': title,
                            'url': url,
                            'start_date': start_date,
                            'end_date': end_date,
                            'date_text': date_text,
                        })

        logger.info(f"Parsed {len(events)} static events from HTML")

    except Exception as e:
        logger.error(f"Failed to parse static events: {e}", exc_info=True)

    return events


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Spelman College events from JSON feed and static HTML list."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
        }

        # First, fetch and parse JSON feed
        response = requests.get(JSON_FEED_URL, headers=headers, timeout=30)
        response.raise_for_status()

        data = response.json()
        json_events = data.get("events", [])

        logger.info(f"Fetched {len(json_events)} events from Spelman College JSON feed")

        # Also fetch HTML page for static events
        html_response = requests.get(EVENTS_PAGE_URL, headers=headers, timeout=30)
        html_response.raise_for_status()
        static_events = parse_static_events(html_response.text)

        museum_response = requests.get(MUSEUM_EXHIBITIONS_URL, headers=headers, timeout=30)
        museum_response.raise_for_status()
        museum_exhibitions = extract_museum_exhibitions(museum_response.text)

        # Process JSON events first
        for event_data in json_events:
            try:
                events_found += 1

                # Extract basic info
                title = event_data.get("title", "").strip()
                if not title:
                    logger.debug("Skipping event without title")
                    continue

                # Skip student/alumni-only events
                description = event_data.get("description", "")
                if not is_public_event(title, description):
                    logger.debug(f"Skipping non-public event: {title}")
                    continue

                # Parse dates
                start_date, start_time = parse_iso_datetime(event_data.get("startDate"))
                end_date, end_time = parse_iso_datetime(event_data.get("endDate"))

                if not start_date:
                    logger.debug(f"Skipping event '{title}' without start date")
                    continue

                # Categorize event and get venue
                category, subcategory, venue_data = categorize_event(event_data, title)
                venue_id = get_or_create_venue(venue_data)

                # Check for duplicates
                content_hash = generate_content_hash(title, venue_data["name"], start_date)

                # Extract additional info
                description = event_data.get("description", "")
                if not description:
                    description = "Event at Spelman College, ranked #1 HBCU in the nation."

                # Truncate description if too long
                if len(description) > 500:
                    description = description[:497] + "..."

                # Get event URL
                event_url = event_data.get("url", "")
                if event_url and not event_url.startswith("http"):
                    event_url = BASE_URL + "/" + event_url.lstrip("/")

                # Get image URL
                image_url = None
                if event_data.get("image"):
                    image_url = event_data["image"].get("url", "")
                    if image_url and not image_url.startswith("http"):
                        image_url = BASE_URL + "/" + image_url.lstrip("/")

                # Check for ticket/registration links
                ticket_url = None
                additional_details = event_data.get("additionDetails", [])
                for detail in additional_details:
                    if detail.get("text") in ["Register to Attend", "Register Today", "Join Us Online"]:
                        ticket_url = detail.get("link", "")
                        break

                # Determine if all-day event
                is_all_day = event_data.get("allDay", "false") == "true" or not start_time

                # Build tags
                tags = ["college", "hbcu", "spelman", "women"]
                filter_tags = event_data.get("filter1", [])
                for tag in filter_tags:
                    tag_slug = tag.lower().replace(" ", "-")
                    if tag_slug not in tags:
                        tags.append(tag_slug)

                # Create event record
                event_record = {
                    "source_id": source_id,
                    "venue_id": venue_id,
                    "title": title,
                    "description": description,
                    "start_date": start_date,
                    "start_time": start_time if not is_all_day else None,
                    "end_date": end_date,
                    "end_time": end_time if not is_all_day else None,
                    "is_all_day": is_all_day,
                    "category": category,
                    "subcategory": subcategory,
                    "tags": tags,
                    "price_min": None,
                    "price_max": None,
                    "price_note": None,
                    "is_free": True,
                    "source_url": event_url or JSON_FEED_URL,
                    "ticket_url": ticket_url,
                    "image_url": image_url,
                    "raw_text": json.dumps(event_data),
                    "extraction_confidence": 0.95,  # High confidence for JSON feed
                    "is_recurring": event_data.get("recurringEvent", "false") == "true",
                    "recurrence_rule": None,
                    "content_hash": content_hash,
                }

                existing = find_event_by_hash(content_hash)
                if existing:
                    smart_update_existing_event(existing, event_record)
                    events_updated += 1
                    continue

                insert_event(event_record)
                events_new += 1
                logger.debug(f"Inserted: {title} on {start_date}")

            except Exception as e:
                logger.error(f"Failed to process event '{title}': {e}", exc_info=True)
                continue

        # Process static HTML events (annual events not yet in JSON)
        for event_data in static_events:
            try:
                title = event_data.get("title", "").strip()
                if not title:
                    continue

                # Skip student/alumni-only events
                if not is_public_event(title):
                    logger.debug(f"Skipping non-public static event: {title}")
                    continue

                events_found += 1

                start_date = event_data.get("start_date")
                end_date = event_data.get("end_date")

                if not start_date:
                    continue

                # Categorize event and get venue
                category, subcategory, venue_data = categorize_event({}, title)
                venue_id = get_or_create_venue(venue_data)

                # Build description
                description = "Annual event at Spelman College, ranked #1 HBCU in the nation."

                # Build tags
                tags = ["college", "hbcu", "spelman", "women", "annual"]

                # Create event record
                content_hash = generate_content_hash(title, venue_data["name"], start_date)
                event_record = {
                    "source_id": source_id,
                    "venue_id": venue_id,
                    "title": title,
                    "description": description,
                    "start_date": start_date,
                    "start_time": None,
                    "end_date": end_date,
                    "end_time": None,
                    "is_all_day": True,
                    "category": category,
                    "subcategory": subcategory,
                    "tags": tags,
                    "price_min": None,
                    "price_max": None,
                    "price_note": None,
                    "is_free": True,
                    "source_url": event_data.get("url") or EVENTS_PAGE_URL,
                    "ticket_url": None,
                    "image_url": None,
                    "raw_text": json.dumps(event_data),
                    "extraction_confidence": 0.85,  # Slightly lower for HTML parsing
                    "is_recurring": False,
                    "recurrence_rule": None,
                    "content_hash": content_hash,
                }

                existing = find_event_by_hash(content_hash)
                if existing:
                    smart_update_existing_event(existing, event_record)
                    events_updated += 1
                    continue

                insert_event(event_record)
                events_new += 1
                logger.debug(f"Inserted static event: {title} on {start_date}")

            except Exception as e:
                logger.error(f"Failed to process static event '{event_data.get('title', 'Unknown')}': {e}", exc_info=True)
                continue

        museum_venue_id = get_or_create_venue(VENUES["museum"])
        for exhibit in museum_exhibitions:
            try:
                end_date = exhibit.get("end_date")
                if not end_date or end_date < datetime.now().strftime("%Y-%m-%d"):
                    continue

                events_found += 1
                hash_start_date = exhibit.get("hash_start_date") or exhibit["start_date"]
                hash_candidates = _museum_hash_candidates(exhibit["title"], hash_start_date)

                event_record = {
                    "source_id": source_id,
                    "venue_id": museum_venue_id,
                    "title": exhibit["title"],
                    "description": exhibit["description"],
                    "start_date": exhibit["start_date"],
                    "start_time": None,
                    "end_date": exhibit["end_date"],
                    "end_time": None,
                    "is_all_day": True,
                    "content_kind": "exhibit",
                    "category": "art",
                    "subcategory": "exhibition",
                    "tags": ["art", "museum", "spelman", "hbcu", "exhibition"],
                    "price_min": None,
                    "price_max": None,
                    "price_note": "Suggested donation: $5",
                    "is_free": True,
                    "source_url": exhibit["source_url"],
                    "ticket_url": exhibit["ticket_url"],
                    "image_url": exhibit["image_url"],
                    "raw_text": json.dumps(exhibit),
                    "extraction_confidence": 0.93,
                    "is_recurring": False,
                    "recurrence_rule": None,
                    "content_hash": hash_candidates[0],
                }

                existing = None
                for candidate_hash in hash_candidates:
                    existing = find_event_by_hash(candidate_hash)
                    if existing:
                        event_record["content_hash"] = candidate_hash
                        break

                if existing:
                    smart_update_existing_event(existing, event_record)
                    events_updated += 1
                    continue

                insert_event(event_record)
                events_new += 1
                logger.debug(f"Inserted museum exhibit: {exhibit['title']} ({exhibit['start_date']})")

            except Exception as e:
                logger.error(
                    f"Failed to process museum exhibit '{exhibit.get('title', 'Unknown')}': {e}",
                    exc_info=True,
                )
                continue

        logger.info(f"Spelman College: Found {events_found} events, {events_new} new, {events_updated} existing")

    except Exception as e:
        logger.error(f"Failed to crawl Spelman College: {e}", exc_info=True)
        raise

    return events_found, events_new, events_updated
