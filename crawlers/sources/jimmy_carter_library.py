"""
Crawler for Jimmy Carter Presidential Library and Museum.
Crawls exhibitions, talks, book events, and programming from jimmycarterlibrary.gov.
Museum in Old Fourth Ward, Atlanta - part of National Archives Presidential Library system.
"""

import json
import logging
import re
import time
from datetime import datetime
from typing import Optional, Tuple
import requests
from bs4 import BeautifulSoup

from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://www.jimmycarterlibrary.gov"
EVENTS_URL = f"{BASE_URL}/events"

VENUE_DATA = {
    "name": "Jimmy Carter Presidential Library and Museum",
    "slug": "jimmy-carter-library",
    "address": "441 John Lewis Freedom Pkwy NE",
    "neighborhood": "Old Fourth Ward",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30307",
    "lat": 33.7679,
    "lng": -84.3582,
    "venue_type": "museum",
    "website": "https://www.jimmycarterlibrary.gov/",
}


def parse_event_date(date_str: str) -> Tuple[Optional[str], Optional[str]]:
    """
    Parse event date from formats like:
    - "March 10, 2026"
    - "2026-03-10 19:00:00" (from JSON-LD)
    Returns (date, time) tuple in YYYY-MM-DD and HH:MM format.
    """
    if not date_str:
        return None, None

    try:
        # Try ISO format with time first (from JSON-LD)
        if " " in date_str and ":" in date_str:
            # Format: "2026-03-10 19:00:00"
            dt = datetime.strptime(date_str, "%Y-%m-%d %H:%M:%S")
            return dt.strftime("%Y-%m-%d"), dt.strftime("%H:%M")

        # Try "Month day, year" format
        if "," in date_str:
            # Format: "March 10, 2026"
            dt = datetime.strptime(date_str, "%B %d, %Y")
            return dt.strftime("%Y-%m-%d"), None

        # Try YYYY-MM-DD format
        if re.match(r"\d{4}-\d{2}-\d{2}", date_str):
            return date_str, None

    except ValueError as e:
        logger.warning(f"Failed to parse date '{date_str}': {e}")

    return None, None


def extract_event_from_json_ld(soup: BeautifulSoup, event_url: str) -> Optional[dict]:
    """
    Extract event details from JSON-LD structured data on event detail page.
    Returns dict with event info or None if not found.
    """
    try:
        # Find JSON-LD script tag
        json_ld_script = soup.find("script", type="application/ld+json")
        if not json_ld_script:
            return None

        data = json.loads(json_ld_script.string)

        # Verify it's an Event type
        if data.get("@type") != "Event":
            return None

        title = data.get("name", "").strip()
        if not title:
            return None

        # Parse dates
        start_date, start_time = parse_event_date(data.get("startDate", ""))
        if not start_date:
            return None

        # Clean up description (remove HTML tags)
        description = data.get("description", "")
        if description:
            # Remove HTML tags
            description = re.sub(r"<[^>]+>", " ", description)
            # Clean up whitespace
            description = re.sub(r"\s+", " ", description).strip()
            # Remove &nbsp; entities
            description = description.replace("&nbsp;", " ")
            # Truncate if too long
            if len(description) > 500:
                description = description[:497] + "..."

        # Get location info if available
        location = data.get("location", {})
        location_name = None
        if isinstance(location, dict):
            location_name = location.get("name")

        return {
            "title": title,
            "description": description,
            "start_date": start_date,
            "start_time": start_time,
            "location_name": location_name,
            "source_url": event_url,
        }

    except Exception as e:
        logger.warning(f"Failed to extract JSON-LD from {event_url}: {e}")
        return None


def crawl(source: dict) -> Tuple[int, int, int]:
    """Crawl Jimmy Carter Presidential Library events."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
        }

        # Get or create venue
        venue_id = get_or_create_venue(VENUE_DATA)

        # Fetch events page
        logger.info(f"Fetching events from {EVENTS_URL}")
        response = requests.get(EVENTS_URL, headers=headers, timeout=30)
        response.raise_for_status()

        soup = BeautifulSoup(response.text, "html.parser")

        # Extract event data from JavaScript embedded in page
        # Look for drupal-settings-json script tag
        settings_script = soup.find("script", {"data-drupal-selector": "drupal-settings-json"})

        event_urls = []

        if settings_script:
            try:
                settings = json.loads(settings_script.string)
                event_calendar = settings.get("eventsCalendar", {})
                dates = event_calendar.get("dates", [])

                # Extract event URLs from calendar data
                for event_data in dates:
                    event_url = event_data.get("url")
                    if event_url:
                        full_url = BASE_URL + event_url if event_url.startswith("/") else event_url
                        event_urls.append(full_url)

                logger.info(f"Found {len(event_urls)} events in calendar data")

            except Exception as e:
                logger.warning(f"Failed to parse drupal settings: {e}")

        # Also scrape event links from HTML as fallback
        for link in soup.find_all("a", href=re.compile(r"/events/\d+")):
            event_url = link.get("href")
            if event_url:
                full_url = BASE_URL + event_url if event_url.startswith("/") else event_url
                if full_url not in event_urls:
                    event_urls.append(full_url)

        logger.info(f"Total unique event URLs to crawl: {len(event_urls)}")

        # Fetch each event detail page
        for i, event_url in enumerate(event_urls):
            try:
                events_found += 1

                # Add small delay between requests to avoid overwhelming the server
                if i > 0:
                    time.sleep(1.5)

                logger.debug(f"Fetching event: {event_url}")
                event_response = requests.get(event_url, headers=headers, timeout=45)
                event_response.raise_for_status()

                event_soup = BeautifulSoup(event_response.text, "html.parser")

                # Extract event details from JSON-LD
                event_data = extract_event_from_json_ld(event_soup, event_url)

                if not event_data:
                    logger.debug(f"No structured data found for {event_url}")
                    continue

                title = event_data["title"]
                start_date = event_data["start_date"]

                # Build description
                description = event_data.get("description")
                if not description or len(description) < 50:
                    description = "Event at the Jimmy Carter Presidential Library and Museum, featuring talks, exhibitions, and programming celebrating American history and the Carter presidency."

                # Try to extract image from page
                image_url = None

                # Look for og:image meta tag
                og_image = event_soup.find("meta", property="og:image")
                if og_image and og_image.get("content"):
                    image_url = og_image["content"]
                    if image_url and not image_url.startswith("http"):
                        image_url = BASE_URL + "/" + image_url.lstrip("/")

                # Or look for thumbnail in event listing
                if not image_url:
                    thumbnail = event_soup.find("div", class_="thumbnail")
                    if thumbnail:
                        img = thumbnail.find("img")
                        if img and img.get("src"):
                            image_url = img["src"]
                            if not image_url.startswith("http"):
                                # Handle archives.gov URLs
                                if image_url.startswith("/"):
                                    if "archives.gov" in image_url:
                                        image_url = "https://www.archives.gov" + image_url
                                    else:
                                        image_url = BASE_URL + image_url

                # Categorize event based on title and description
                title_lower = title.lower()
                desc_lower = description.lower()

                category = "community"
                subcategory = "lecture"

                if any(keyword in title_lower for keyword in ["book", "author", "writer"]):
                    category = "community"
                    subcategory = "book-talk"
                elif any(keyword in title_lower for keyword in ["film", "movie", "screening"]):
                    category = "film"
                    subcategory = None
                elif any(keyword in title_lower for keyword in ["music", "concert", "performance"]):
                    category = "music"
                    subcategory = "concert"
                elif any(keyword in title_lower for keyword in ["exhibition", "exhibit", "gallery"]):
                    category = "museums"
                    subcategory = "exhibition"

                # Build tags
                tags = ["museum", "history", "presidential", "jimmy-carter", "old-fourth-ward"]

                if "book" in title_lower or "author" in title_lower:
                    tags.append("books")
                if "virtual" in title_lower or "online" in title_lower:
                    tags.append("virtual")
                if "lecture" in title_lower or "talk" in title_lower:
                    tags.append("lecture")

                # Determine if free based on text
                is_free = False
                price_note = None
                combined_text = f"{title} {description or ''}".lower()
                if any(kw in combined_text for kw in ["free", "no cost", "no charge", "complimentary"]):
                    is_free = True
                    price_note = "Free admission"

                # Generate content hash
                content_hash = generate_content_hash(title, VENUE_DATA["name"], start_date)

                # Create event record
                event_record = {
                    "source_id": source_id,
                    "venue_id": venue_id,
                    "title": title,
                    "description": description,
                    "start_date": start_date,
                    "start_time": event_data.get("start_time"),
                    "end_date": None,
                    "end_time": None,
                    "is_all_day": False,
                    "category": category,
                    "tags": tags,
                    "price_min": None,
                    "price_max": None,
                    "price_note": price_note,
                    "is_free": is_free,
                    "source_url": event_url,
                    "ticket_url": None,  # Presidential libraries don't typically require advance tickets
                    "image_url": image_url,
                    "raw_text": json.dumps(event_data),
                    "extraction_confidence": 0.95,  # High confidence for structured data
                    "is_recurring": False,
                    "recurrence_rule": None,
                    "content_hash": content_hash,
                }

                # Check for duplicates
                existing = find_event_by_hash(content_hash)
                if existing:
                    smart_update_existing_event(existing, event_record)
                    events_updated += 1
                    continue

                insert_event(event_record)
                events_new += 1
                logger.debug(f"Inserted: {title} on {start_date}")

            except Exception as e:
                logger.error(f"Failed to process event {event_url}: {e}", exc_info=True)
                continue

        logger.info(
            f"Jimmy Carter Library: Found {events_found} events, {events_new} new, {events_updated} existing"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Jimmy Carter Library: {e}", exc_info=True)
        raise

    return events_found, events_new, events_updated
