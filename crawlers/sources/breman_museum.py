"""
Crawler for The Breman Museum (thebreman.org/events).

Atlanta's Jewish museum featuring:
- Film screenings
- Exhibition presentations
- Educational programs (Weinberg Center for Holocaust Education)
- Special events and lectures
- Collaborative performances

Site uses WordPress REST API with custom events post type.
"""

from __future__ import annotations

import re
import logging
import requests
from datetime import datetime
from typing import Optional
from bs4 import BeautifulSoup

from db import get_or_create_venue, insert_event, find_event_by_hash
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://thebreman.org"
API_URL = f"{BASE_URL}/wp-json/wp/v2/events"

VENUE_DATA = {
    "name": "The Breman Museum",
    "slug": "breman-museum",
    "address": "1440 Spring St NW",
    "neighborhood": "Midtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30309",
    "lat": 33.7873,
    "lng": -84.3880,
    "venue_type": "museum",
    "website": BASE_URL,
}


def clean_html(html_text: str) -> str:
    """Strip HTML tags and return clean text."""
    if not html_text:
        return ""
    soup = BeautifulSoup(html_text, "html.parser")
    return soup.get_text(" ", strip=True)


def extract_event_details(content: str) -> dict:
    """
    Extract date, time, location, and cost from event content.

    Common patterns:
    - "When: Wednesday, January 28th at 7 p.m."
    - "When: February 15th, 3 p.m."
    - "Where: The Breman, 1440 Spring St. NW"
    - "How Much: Free with registration" or "VIP $45, General $30"
    """
    details = {
        "date": None,
        "time": None,
        "location": None,
        "price_min": None,
        "price_max": None,
        "price_note": None,
        "is_free": False,
    }

    # Extract "When:" field
    # Match: "When: Wednesday, January 28th at 7 p.m."
    when_match = re.search(
        r"When[:\s]+(.+?)(?:\s+at\s+(\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?)))?(?:\.|$|\n|Where)",
        content,
        re.IGNORECASE
    )

    if when_match:
        date_str = when_match.group(1).strip()
        time_str = when_match.group(2)

        # Parse date from various formats
        # "Wednesday, January 28th" or "February 15th" or "January 25th"
        date_patterns = [
            r"(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s*(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(\d{4}))?",
            r"(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(\d{4}))?",
        ]

        for pattern in date_patterns:
            date_match = re.search(pattern, date_str, re.IGNORECASE)
            if date_match:
                month = date_match.group(1)
                day = date_match.group(2)
                year = date_match.group(3) if len(date_match.groups()) >= 3 and date_match.group(3) else str(datetime.now().year)

                try:
                    dt = datetime.strptime(f"{month} {day} {year}", "%B %d %Y")
                    # If date is in the past, assume next year
                    if dt.date() < datetime.now().date():
                        dt = dt.replace(year=dt.year + 1)
                    details["date"] = dt.strftime("%Y-%m-%d")
                except ValueError:
                    pass
                break

        # Parse time
        if time_str:
            time_match = re.search(
                r"(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)",
                time_str,
                re.IGNORECASE
            )
            if time_match:
                hour = int(time_match.group(1))
                minute = int(time_match.group(2)) if time_match.group(2) else 0
                period = time_match.group(3).lower().replace(".", "")

                if "p" in period and hour != 12:
                    hour += 12
                elif "a" in period and hour == 12:
                    hour = 0

                details["time"] = f"{hour:02d}:{minute:02d}"

    # Extract "Where:" field (though it's usually The Breman)
    where_match = re.search(r"Where[:\s]+([^\.]+)", content, re.IGNORECASE)
    if where_match:
        details["location"] = where_match.group(1).strip()

    # Extract "How Much:" field
    price_match = re.search(r"How Much[:\s]+([^\.]+)", content, re.IGNORECASE)
    if price_match:
        price_str = price_match.group(1).strip()
        details["price_note"] = price_str

        # Check if free
        if re.search(r"\bfree\b", price_str, re.IGNORECASE):
            details["is_free"] = True

        # Extract price ranges: "VIP $45, General $30" or "$30"
        prices = re.findall(r"\$(\d+)", price_str)
        if prices:
            price_values = [int(p) for p in prices]
            details["price_min"] = min(price_values)
            details["price_max"] = max(price_values)

    return details


def determine_category(title: str, content: str) -> tuple[str, Optional[str], list[str]]:
    """Determine event category based on title and content."""
    title_lower = title.lower()
    content_lower = content.lower()
    tags = ["museum", "jewish", "history", "midtown", "breman-museum"]

    # Film screenings
    if any(w in title_lower for w in ["film", "screening", "movie", "cinema"]):
        return "film", "screening", tags + ["film"]

    # Holocaust education
    if any(w in content_lower for w in ["holocaust", "weinberg center", "bearing witness"]):
        return "education", "history", tags + ["holocaust", "education", "history"]

    # Musical performances
    if any(w in title_lower for w in ["broadway", "concert", "music", "performance", "voices of note"]):
        return "music", "performance", tags + ["music", "performance"]

    # Exhibitions and art presentations
    if any(w in title_lower for w in ["exhibition", "presentation", "gallery"]):
        return "art", "exhibition", tags + ["art", "exhibition"]

    # Lectures and talks
    if any(w in title_lower for w in ["lecture", "talk", "conversation", "speaker"]):
        return "education", "lecture", tags + ["lecture", "education"]

    # Special events
    if any(w in title_lower for w in ["special event", "gala", "fundraiser"]):
        return "community", "special", tags + ["special-event"]

    # Default to community/cultural
    return "community", "cultural", tags


def extract_ticket_url(content: str) -> Optional[str]:
    """Extract ticket/RSVP URL from content."""
    # Look for Eventbrite links
    match = re.search(r'href="(https://www\.eventbrite\.com/[^"]+)"', content)
    if match:
        return match.group(1)

    # Look for other ticket links
    match = re.search(r'href="(https://[^"]+ticket[^"]*)"', content, re.IGNORECASE)
    if match:
        return match.group(1)

    return None


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl The Breman Museum events via WordPress REST API."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        venue_id = get_or_create_venue(VENUE_DATA)

        # Fetch events from API (get up to 100 events)
        params = {"per_page": 100, "status": "publish"}

        logger.info(f"Fetching Breman Museum events: {API_URL}")
        response = requests.get(API_URL, params=params, timeout=30)

        if response.status_code != 200:
            logger.error(f"API returned status {response.status_code}")
            return events_found, events_new, events_updated

        events_data = response.json()
        logger.info(f"Found {len(events_data)} events from API")

        for event_item in events_data:
            try:
                title = clean_html(event_item.get("title", {}).get("rendered", ""))

                # Skip if no title
                if not title or len(title) < 3:
                    continue

                # Skip postponed/cancelled events
                if any(w in title.lower() for w in ["postponed", "cancelled", "canceled"]):
                    logger.info(f"Skipping postponed/cancelled event: {title}")
                    continue

                # Get content and excerpt
                content_html = event_item.get("content", {}).get("rendered", "")
                excerpt_html = event_item.get("excerpt", {}).get("rendered", "")

                content = clean_html(content_html)
                excerpt = clean_html(excerpt_html)

                # Extract event details from content
                details = extract_event_details(content)

                # Skip if no date found
                if not details["date"]:
                    logger.warning(f"No date found for event: {title}")
                    continue

                # Get event URL and ticket URL
                event_url = event_item.get("link", BASE_URL)
                ticket_url = extract_ticket_url(content_html) or event_url

                # Get featured image
                image_url = None
                if event_item.get("featured_media"):
                    media_id = event_item["featured_media"]
                    try:
                        img_response = requests.get(
                            f"{BASE_URL}/wp-json/wp/v2/media/{media_id}",
                            timeout=10
                        )
                        if img_response.status_code == 200:
                            media_data = img_response.json()
                            image_url = media_data.get("source_url")
                    except Exception as e:
                        logger.warning(f"Failed to fetch image: {e}")

                events_found += 1

                # Generate content hash
                content_hash = generate_content_hash(
                    title, "The Breman Museum", details["date"]
                )

                # Check for existing event
                if find_event_by_hash(content_hash):
                    events_updated += 1
                    continue

                # Determine category
                category, subcategory, tags = determine_category(title, content)

                # Use excerpt or first part of content as description
                description = excerpt if excerpt else content[:500]

                event_record = {
                    "source_id": source_id,
                    "venue_id": venue_id,
                    "title": title,
                    "description": description,
                    "start_date": details["date"],
                    "start_time": details["time"],
                    "end_date": None,
                    "end_time": None,
                    "is_all_day": details["time"] is None,
                    "category": category,
                    "subcategory": subcategory,
                    "tags": tags,
                    "price_min": details["price_min"],
                    "price_max": details["price_max"],
                    "price_note": details["price_note"],
                    "is_free": details["is_free"],
                    "source_url": event_url,
                    "ticket_url": ticket_url,
                    "image_url": image_url,
                    "raw_text": content[:1000],
                    "extraction_confidence": 0.90,
                    "is_recurring": False,
                    "recurrence_rule": None,
                    "content_hash": content_hash,
                }

                insert_event(event_record)
                events_new += 1
                logger.info(f"Added: {title} on {details['date']}")

            except Exception as e:
                logger.error(f"Error processing event: {e}")
                continue

        logger.info(
            f"Breman Museum crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Breman Museum: {e}")
        raise

    return events_found, events_new, events_updated
