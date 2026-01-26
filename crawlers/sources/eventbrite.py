"""
Crawler for Eventbrite events in Atlanta.
Scrapes JSON-LD data from Eventbrite's search pages.

Note: Eventbrite's public event discovery API requires partner access.
The free API only allows managing your own events. Scraping JSON-LD
from public search pages is the only option for discovery.
"""

import json
import logging
from typing import Optional
from bs4 import BeautifulSoup

from utils import fetch_page, slugify
from db import get_or_create_venue, get_or_create_virtual_venue, insert_event, find_event_by_hash
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

# Eventbrite Atlanta search URLs
SEARCH_URLS = [
    "https://www.eventbrite.com/d/ga--atlanta/events/",
    "https://www.eventbrite.com/d/ga--atlanta/music/",
    "https://www.eventbrite.com/d/ga--atlanta/food-and-drink/",
    "https://www.eventbrite.com/d/ga--atlanta/arts/",
]

# Category mapping from Eventbrite to our categories
CATEGORY_MAP = {
    "music": "music",
    "food-and-drink": "food_drink",
    "arts": "art",
    "nightlife": "nightlife",
    "performing-arts": "theater",
    "comedy": "comedy",
    "film": "film",
    "sports-and-fitness": "sports",
    "health": "fitness",
    "community": "community",
    "family-and-education": "family",
}


def parse_eventbrite_date(date_str: str) -> Optional[str]:
    """Parse Eventbrite date format to YYYY-MM-DD."""
    if not date_str:
        return None
    try:
        # Handle ISO format: 2026-01-16T20:00:00
        if "T" in date_str:
            return date_str.split("T")[0]
        return date_str[:10]
    except Exception:
        return None


def parse_eventbrite_time(date_str: str) -> Optional[str]:
    """Parse Eventbrite datetime to HH:MM time."""
    if not date_str or "T" not in date_str:
        return None
    try:
        time_part = date_str.split("T")[1]
        return time_part[:5]  # HH:MM
    except Exception:
        return None


def extract_category_from_url(url: str) -> str:
    """Extract category from Eventbrite URL."""
    for cat_slug, our_cat in CATEGORY_MAP.items():
        if f"/{cat_slug}/" in url or f"/{cat_slug}?" in url:
            return our_cat
    return "other"


def extract_events_from_page(html: str, search_url: str) -> list[dict]:
    """Extract events from Eventbrite page using JSON-LD data."""
    soup = BeautifulSoup(html, "lxml")
    events = []

    # Find JSON-LD scripts
    scripts = soup.find_all("script", type="application/ld+json")

    for script in scripts:
        try:
            data = json.loads(script.string)

            # Handle array format
            if isinstance(data, list):
                for item in data:
                    if item.get("@type") == "ItemList":
                        events.extend(process_item_list(item, search_url))
            # Handle object format
            elif data.get("@type") == "ItemList":
                events.extend(process_item_list(data, search_url))

        except json.JSONDecodeError as e:
            logger.warning(f"Failed to parse JSON-LD: {e}")
            continue

    return events


def process_item_list(item_list: dict, search_url: str) -> list[dict]:
    """Process an ItemList and extract events."""
    events = []
    items = item_list.get("itemListElement", [])

    for item in items:
        event_data = item.get("item", {})
        if not event_data:
            continue

        try:
            event = {
                "title": event_data.get("name", "").strip(),
                "description": event_data.get("description", ""),
                "start_date": parse_eventbrite_date(event_data.get("startDate")),
                "start_time": parse_eventbrite_time(event_data.get("startDate")),
                "end_date": parse_eventbrite_date(event_data.get("endDate")),
                "end_time": parse_eventbrite_time(event_data.get("endDate")),
                "source_url": event_data.get("url", ""),
                "image_url": event_data.get("image", ""),
                "category": extract_category_from_url(search_url),
            }

            # Skip if no title or date
            if not event["title"] or not event["start_date"]:
                continue

            # Extract venue info
            location = event_data.get("location", {})
            if location:
                venue_name = location.get("name", "")
                address_obj = location.get("address", {})

                event["venue"] = {
                    "name": venue_name,
                    "address": address_obj.get("streetAddress"),
                    "city": address_obj.get("addressLocality", "Atlanta"),
                    "state": address_obj.get("addressRegion", "GA"),
                    "zip": address_obj.get("postalCode"),
                }

            # Extract price info from offers
            offers = event_data.get("offers", {})
            if offers:
                price = offers.get("price")
                if price is not None:
                    try:
                        event["price_min"] = float(price)
                        event["price_max"] = float(price)
                        event["is_free"] = float(price) == 0
                    except (ValueError, TypeError):
                        pass

                low_price = offers.get("lowPrice")
                high_price = offers.get("highPrice")
                if low_price is not None:
                    try:
                        event["price_min"] = float(low_price)
                        event["is_free"] = float(low_price) == 0
                    except (ValueError, TypeError):
                        pass
                if high_price is not None:
                    try:
                        event["price_max"] = float(high_price)
                    except (ValueError, TypeError):
                        pass

            events.append(event)

        except Exception as e:
            logger.warning(f"Failed to process event: {e}")
            continue

    return events


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl Eventbrite events for Atlanta.

    Args:
        source: Source record from database

    Returns:
        Tuple of (events_found, events_new, events_updated)
    """
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0
    seen_urls = set()

    try:
        all_events = []

        for search_url in SEARCH_URLS:
            logger.info(f"Fetching Eventbrite: {search_url}")

            try:
                html = fetch_page(search_url)
                page_events = extract_events_from_page(html, search_url)
                logger.info(f"Found {len(page_events)} events from {search_url}")

                # Deduplicate by URL
                for event in page_events:
                    url = event.get("source_url", "")
                    if url and url not in seen_urls:
                        seen_urls.add(url)
                        all_events.append(event)

            except Exception as e:
                logger.error(f"Failed to fetch {search_url}: {e}")
                continue

        logger.info(f"Total unique events from Eventbrite: {len(all_events)}")

        for event_data in all_events:
            events_found += 1

            # Get or create venue
            venue_id = None
            venue_info = event_data.get("venue")
            if venue_info and venue_info.get("name"):
                venue_record = {
                    "name": venue_info["name"],
                    "slug": slugify(venue_info["name"]),
                    "address": venue_info.get("address"),
                    "city": venue_info.get("city", "Atlanta"),
                    "state": venue_info.get("state", "GA"),
                    "zip": venue_info.get("zip"),
                }
                try:
                    venue_id = get_or_create_venue(venue_record)
                except Exception as e:
                    logger.warning(f"Failed to create venue {venue_info['name']}: {e}")

            # Fallback to virtual venue if no venue was resolved
            if venue_id is None:
                venue_id = get_or_create_virtual_venue()

            # Generate content hash
            venue_name = venue_info.get("name", "") if venue_info else ""
            content_hash = generate_content_hash(
                event_data["title"], venue_name, event_data["start_date"]
            )

            # Check for existing event
            existing = find_event_by_hash(content_hash)
            if existing:
                events_updated += 1
                continue

            # Insert new event
            event_record = {
                "source_id": source_id,
                "venue_id": venue_id,
                "title": event_data["title"],
                "description": event_data.get("description"),
                "start_date": event_data["start_date"],
                "start_time": event_data.get("start_time"),
                "end_date": event_data.get("end_date"),
                "end_time": event_data.get("end_time"),
                "is_all_day": False,
                "category": event_data.get("category", "other"),
                "subcategory": None,
                "tags": [],
                "price_min": event_data.get("price_min"),
                "price_max": event_data.get("price_max"),
                "price_note": None,
                "is_free": event_data.get("is_free", False),
                "source_url": event_data["source_url"],
                "ticket_url": event_data[
                    "source_url"
                ],  # Eventbrite URL is the ticket URL
                "image_url": event_data.get("image_url"),
                "raw_text": None,
                "extraction_confidence": 0.90,
                "is_recurring": False,
                "recurrence_rule": None,
                "content_hash": content_hash,
            }

            try:
                insert_event(event_record)
                events_new += 1
                logger.debug(f"Added: {event_data['title']}")
            except Exception as e:
                logger.error(f"Failed to insert event {event_data['title']}: {e}")

    except Exception as e:
        logger.error(f"Failed to crawl Eventbrite: {e}")
        raise

    return events_found, events_new, events_updated
