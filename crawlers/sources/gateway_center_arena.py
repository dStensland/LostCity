"""
Crawler for Gateway Center Arena @ College Park (gatewaycenterarena.com).

Home to the Atlanta Dream (WNBA), College Park Skyhawks (G-League), concerts, and special events.
Multi-purpose arena in College Park with a capacity of 3,500-5,000.

Site uses The Events Calendar (Tribe Events) WordPress plugin with REST API.
"""

from __future__ import annotations

import logging
import re
from datetime import datetime
from typing import Optional
import requests

from db import get_or_create_venue, insert_event, find_event_by_hash
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://gatewaycenterarena.com"
API_URL = f"{BASE_URL}/wp-json/tribe/events/v1/events"

VENUE_DATA = {
    "name": "Gateway Center Arena",
    "slug": "gateway-center-arena",
    "address": "2330 Convention Center Concourse",
    "neighborhood": "Airport District",
    "city": "College Park",
    "state": "GA",
    "zip": "30337",
    "lat": 33.6624,
    "lng": -84.4440,
    "venue_type": "arena",
    "spot_type": "stadium",
    "website": BASE_URL,
}


def parse_event_datetime(event_data: dict) -> tuple[Optional[str], Optional[str], Optional[str], Optional[str]]:
    """
    Parse event datetime from Tribe Events API response.

    Args:
        event_data: Event object from API

    Returns:
        Tuple of (start_date, start_time, end_date, end_time)
    """
    try:
        # Get start date and time
        start_date_str = event_data.get("start_date", "")
        end_date_str = event_data.get("end_date", "")
        is_all_day = event_data.get("all_day", False)

        if not start_date_str:
            return None, None, None, None

        # Parse start datetime
        start_dt = datetime.strptime(start_date_str, "%Y-%m-%d %H:%M:%S")
        start_date = start_dt.strftime("%Y-%m-%d")
        start_time = None if is_all_day else start_dt.strftime("%H:%M")

        # Parse end datetime if exists
        end_date = None
        end_time = None

        if end_date_str:
            end_dt = datetime.strptime(end_date_str, "%Y-%m-%d %H:%M:%S")
            end_date = end_dt.strftime("%Y-%m-%d")
            # Only include end time if not all-day and different from start time
            if not is_all_day:
                end_time = end_dt.strftime("%H:%M")

        return start_date, start_time, end_date, end_time

    except (ValueError, KeyError) as e:
        logger.warning(f"Failed to parse event datetime: {e}")
        return None, None, None, None


def determine_category(event_data: dict) -> tuple[str, Optional[str], list[str]]:
    """
    Determine category based on event data.

    Args:
        event_data: Event object from API

    Returns:
        Tuple of (category, subcategory, tags)
    """
    title = event_data.get("title", "").lower()
    description = event_data.get("description", "").lower()
    combined = f"{title} {description}"

    # Base tags for all Gateway Center Arena events
    event_tags = ["gateway-center-arena", "college-park"]

    # WNBA/Basketball
    if any(word in combined for word in ["dream", "wnba", "basketball", "hoops"]):
        event_tags.extend(["basketball", "wnba", "atlanta-dream"])
        return "sports", "basketball", event_tags

    # G-League/Basketball
    if any(word in combined for word in ["skyhawks", "g-league", "g league", "gleague"]):
        event_tags.extend(["basketball", "g-league", "college-park-skyhawks"])
        return "sports", "basketball", event_tags

    # Concerts/Music
    if any(word in combined for word in ["concert", "music", "tour", "artist", "show", "performance"]):
        event_tags.extend(["concert", "live-music"])
        return "music", "concert", event_tags

    # Comedy
    if any(word in combined for word in ["comedy", "comedian", "stand-up", "standup", "laughs"]):
        event_tags.append("comedy")
        return "nightlife", "comedy", event_tags

    # Wrestling/Combat Sports
    if any(word in combined for word in ["wrestling", "wwe", "aew", "boxing", "mma", "fight"]):
        event_tags.append("wrestling")
        return "sports", "other", event_tags

    # Community events
    if any(word in combined for word in ["market", "expo", "fair", "festival", "celebration"]):
        event_tags.append("community-event")
        return "community", "festival", event_tags

    # Family events
    if any(word in combined for word in ["family", "kids", "children", "youth"]):
        event_tags.append("family-friendly")
        return "family", "event", event_tags

    # Default to general event
    return "community", "event", event_tags


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Gateway Center Arena events using Tribe Events REST API."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        venue_id = get_or_create_venue(VENUE_DATA)

        # Fetch upcoming events from API
        # Start from today and fetch forward
        today = datetime.now().strftime("%Y-%m-%d")
        params = {
            "per_page": 50,  # Max per page
            "start_date": f"{today} 00:00:00",
            "status": "publish",
        }

        page = 1
        max_pages = 10  # Safety limit

        while page <= max_pages:
            params["page"] = page

            # Use browser-like headers to avoid blocking
            headers = {
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Accept": "application/json",
                "Referer": f"{BASE_URL}/events/",
            }

            logger.info(f"Fetching Gateway Center Arena events page {page}: {API_URL}")
            response = requests.get(API_URL, params=params, headers=headers, timeout=30)
            response.raise_for_status()

            data = response.json()
            events_data = data.get("events", [])

            if not events_data:
                logger.info(f"No more events found on page {page}")
                break

            logger.info(f"Found {len(events_data)} events on page {page}")

            for event_data in events_data:
                try:
                    # Extract basic info
                    title = event_data.get("title", "")
                    if not title:
                        continue

                    # Clean HTML entities
                    title = re.sub(r'&#\d+;', '', title)
                    title = re.sub(r'&[a-z]+;', '', title)
                    title = title.strip()

                    # Parse dates
                    start_date, start_time, end_date, end_time = parse_event_datetime(event_data)

                    if not start_date:
                        logger.warning(f"No start date for: {title}")
                        continue

                    # Skip past events
                    try:
                        check_date = end_date or start_date
                        if datetime.strptime(check_date, "%Y-%m-%d").date() < datetime.now().date():
                            logger.debug(f"Skipping past event: {title}")
                            continue
                    except ValueError:
                        pass

                    # Determine category
                    category, subcategory, event_tags = determine_category(event_data)

                    # Get description
                    description = event_data.get("description", "")
                    # Remove HTML tags
                    description = re.sub(r'<[^>]+>', '', description)
                    description = description.strip()

                    if not description or len(description) < 10:
                        description = f"{title} at Gateway Center Arena"

                    # Get event URL
                    source_url = event_data.get("url", f"{BASE_URL}/events/")

                    # Check for pricing
                    cost = event_data.get("cost", "")
                    is_free = not cost or "free" in cost.lower()
                    price_min = None
                    price_max = None

                    if cost and not is_free:
                        # Try to extract price from cost string
                        price_match = re.search(r'\$?(\d+(?:\.\d{2})?)', cost)
                        if price_match:
                            price_min = float(price_match.group(1))
                            price_max = price_min

                    # Image
                    image_url = None
                    if event_data.get("image"):
                        if isinstance(event_data["image"], dict):
                            image_url = event_data["image"].get("url")
                        elif isinstance(event_data["image"], str):
                            image_url = event_data["image"]

                    events_found += 1

                    # Generate content hash
                    content_hash = generate_content_hash(title, "Gateway Center Arena", start_date)

                    # Check for existing event
                    if find_event_by_hash(content_hash):
                        events_updated += 1
                        continue

                    # Check if all-day
                    is_all_day = event_data.get("all_day", False)

                    event_record = {
                        "source_id": source_id,
                        "venue_id": venue_id,
                        "title": title,
                        "description": description[:1000],  # Limit length
                        "start_date": start_date,
                        "start_time": start_time,
                        "end_date": end_date,
                        "end_time": end_time,
                        "is_all_day": is_all_day,
                        "category": category,
                        "subcategory": subcategory,
                        "tags": event_tags,
                        "price_min": price_min,
                        "price_max": price_max,
                        "price_note": cost if cost else None,
                        "is_free": is_free,
                        "source_url": source_url,
                        "ticket_url": source_url,
                        "image_url": image_url,
                        "raw_text": f"{title} - {description[:200]}",
                        "extraction_confidence": 0.95,  # High confidence - structured API data
                        "is_recurring": False,
                        "recurrence_rule": None,
                        "content_hash": content_hash,
                    }

                    try:
                        insert_event(event_record)
                        events_new += 1
                        logger.info(f"Added: {title} on {start_date}")
                    except Exception as e:
                        logger.error(f"Failed to insert event '{title}': {e}")

                except Exception as e:
                    logger.error(f"Error processing event: {e}")
                    continue

            # Check if there are more pages
            total_pages = data.get("total_pages", 1)
            if page >= total_pages:
                break

            page += 1

        logger.info(
            f"Gateway Center Arena crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Gateway Center Arena: {e}")
        raise

    return events_found, events_new, events_updated
