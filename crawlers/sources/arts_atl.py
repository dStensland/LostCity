"""
Crawler for ArtsATL (artsatl.org) - comprehensive arts calendar and coverage.
Major arts events aggregator for Atlanta theater, dance, music, visual arts.
Uses The Events Calendar (Modern Tribe) plugin with JSON-LD structured data.
"""

import json
import logging
import re
from bs4 import BeautifulSoup
import requests

from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash
from utils import extract_image_url

logger = logging.getLogger(__name__)

BASE_URL = "https://www.artsatl.org"
CALENDAR_URL = f"{BASE_URL}/calendar"

# Default venue for when venue info is not available
DEFAULT_VENUE = {
    "name": "ArtsATL Event",
    "slug": "artsatl-event",
    "address": "Atlanta, GA",
    "neighborhood": "Atlanta",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30303",
    "venue_type": "various",
    "website": BASE_URL,
}


def parse_jsonld_events(soup: BeautifulSoup) -> list[dict]:
    """Extract Event data from JSON-LD scripts."""
    events = []
    scripts = soup.find_all("script", type="application/ld+json")

    for script in scripts:
        try:
            if not script.string:
                continue
            data = json.loads(script.string)
            if isinstance(data, dict):
                if data.get("@type") == "Event":
                    events.append(data)
                if "@graph" in data:
                    events.extend([e for e in data["@graph"] if e.get("@type") == "Event"])
            elif isinstance(data, list):
                events.extend([e for e in data if isinstance(e, dict) and e.get("@type") == "Event"])
        except (json.JSONDecodeError, TypeError):
            continue

    return events


def parse_tribe_events(soup: BeautifulSoup) -> list[dict]:
    """Parse events from The Events Calendar HTML structure."""
    events = []

    # Find event articles
    event_articles = soup.find_all("article", class_=re.compile(r"tribe-events"))

    for article in event_articles:
        try:
            # Get title
            title_elem = article.find(class_=re.compile(r"tribe-events.*title")) or article.find("h3")
            if not title_elem:
                continue
            title = title_elem.get_text(strip=True)

            # Get link
            link_elem = article.find("a", href=True)
            event_url = link_elem["href"] if link_elem else None

            # Get date from datetime attribute
            datetime_elem = article.find(attrs={"datetime": True})
            start_date = None
            if datetime_elem:
                dt_str = datetime_elem.get("datetime", "")
                if dt_str:
                    start_date = dt_str[:10]

            # Get venue
            venue_elem = article.find(class_=re.compile(r"tribe-events.*venue"))
            venue_name = venue_elem.get_text(strip=True) if venue_elem else None

            events.append({
                "title": title,
                "start_date": start_date,
                "venue_name": venue_name,
                "event_url": event_url,
            })

        except Exception as e:
            logger.debug(f"Error parsing event article: {e}")
            continue

    return events


def determine_category(title: str) -> tuple[str, str, list[str]]:
    """Determine category, subcategory, and tags based on event title."""
    title_lower = title.lower()

    if any(w in title_lower for w in ["theater", "theatre", "play", "musical", "stage"]):
        return "theater", "play", ["theater", "performing-arts", "atlanta-arts"]
    elif any(w in title_lower for w in ["dance", "ballet", "choreograph"]):
        return "theater", "dance", ["dance", "performing-arts", "atlanta-arts"]
    elif any(w in title_lower for w in ["opera", "symphony", "orchestra", "classical"]):
        return "music", "classical", ["classical", "music", "atlanta-arts"]
    elif any(w in title_lower for w in ["exhibit", "gallery", "art show", "installation"]):
        return "art", "exhibition", ["art", "visual-arts", "atlanta-arts"]
    elif any(w in title_lower for w in ["film", "movie", "screening", "cinema"]):
        return "film", "screening", ["film", "movies", "atlanta-arts"]
    elif any(w in title_lower for w in ["reading", "poetry", "literary", "book"]):
        return "community", "literary", ["literary", "books", "atlanta-arts"]
    else:
        return "art", "performance", ["arts", "atlanta-arts"]


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl ArtsATL calendar for arts events."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
    }

    try:
        response = requests.get(CALENDAR_URL, headers=headers, timeout=30)
        response.raise_for_status()

        soup = BeautifulSoup(response.text, "html.parser")

        # Try JSON-LD first
        json_events = parse_jsonld_events(soup)

        for event_data in json_events:
            events_found += 1
            title = event_data.get("name", "").strip()
            if not title:
                continue

            start_date = event_data.get("startDate", "")[:10] if event_data.get("startDate") else None
            if not start_date:
                continue

            # Get or create venue
            venue_info = event_data.get("location", {})
            if isinstance(venue_info, dict) and venue_info.get("name"):
                venue_data = {
                    "name": venue_info.get("name"),
                    "slug": re.sub(r'[^a-z0-9]+', '-', venue_info.get("name", "").lower()).strip('-'),
                    "address": venue_info.get("address", {}).get("streetAddress", ""),
                    "neighborhood": venue_info.get("address", {}).get("addressLocality", "Atlanta"),
                    "city": "Atlanta",
                    "state": "GA",
                    "zip": venue_info.get("address", {}).get("postalCode", ""),
                    "venue_type": "various",
                    "website": venue_info.get("url", ""),
                }
                venue_id = get_or_create_venue(venue_data)
            else:
                venue_id = get_or_create_venue(DEFAULT_VENUE)

            content_hash = generate_content_hash(title, "ArtsATL", start_date)

            category, subcategory, tags = determine_category(title)

            event_record = {
                "source_id": source_id,
                "venue_id": venue_id,
                "title": title,
                "description": event_data.get("description", "Arts event from ArtsATL calendar")[:500],
                "start_date": start_date,
                "start_time": None,
                "end_date": event_data.get("endDate", "")[:10] if event_data.get("endDate") else None,
                "end_time": None,
                "is_all_day": True,
                "category": category,
                "subcategory": subcategory,
                "tags": tags,
                "price_min": None,
                "price_max": None,
                "price_note": None,
                "is_free": False,
                "source_url": event_data.get("url", CALENDAR_URL),
                "ticket_url": event_data.get("url"),
                "image_url": event_data.get("image"),
                "raw_text": json.dumps(event_data),
                "extraction_confidence": 0.85,
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
            except Exception as e:
                logger.error(f"Failed to insert {title}: {e}")

        # If no JSON-LD events, try parsing HTML
        if events_found == 0:
            html_events = parse_tribe_events(soup)

            for event_data in html_events:
                events_found += 1
                title = event_data.get("title", "").strip()
                start_date = event_data.get("start_date")

                if not title or not start_date:
                    continue

                venue_id = get_or_create_venue(DEFAULT_VENUE)
                content_hash = generate_content_hash(title, "ArtsATL", start_date)
                existing = find_event_by_hash(content_hash)
                if existing:
                    smart_update_existing_event(existing, event_record)
                    events_updated += 1
                    continue

                category, subcategory, tags = determine_category(title)

                event_record = {
                    "source_id": source_id,
                    "venue_id": venue_id,
                    "title": title,
                    "description": "Arts event from ArtsATL calendar",
                    "start_date": start_date,
                    "start_time": None,
                    "end_date": None,
                    "end_time": None,
                    "is_all_day": True,
                    "category": category,
                    "subcategory": subcategory,
                    "tags": tags,
                    "price_min": None,
                    "price_max": None,
                    "price_note": None,
                    "is_free": False,
                    "source_url": event_data.get("event_url", CALENDAR_URL),
                    "ticket_url": event_data.get("event_url"),
                    "image_url": extract_image_url(soup) if soup else None,
                    "raw_text": json.dumps(event_data),
                    "extraction_confidence": 0.75,
                    "is_recurring": False,
                    "recurrence_rule": None,
                    "content_hash": content_hash,
                }

                try:
                    insert_event(event_record)
                    events_new += 1
                except Exception as e:
                    logger.error(f"Failed to insert {title}: {e}")

        logger.info(f"ArtsATL: Found {events_found} events, {events_new} new, {events_updated} existing")

    except Exception as e:
        logger.error(f"Failed to crawl ArtsATL: {e}")
        raise

    return events_found, events_new, events_updated
