"""
Crawler for Spruill Center for the Arts (spruillarts.org).

Dunwoody-based community arts center offering workshops, classes, and events
in pottery, glassblowing, jewelry, fiber arts, yoga, and creative activities.

Uses The Events Calendar WordPress plugin with REST API.
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

BASE_URL = "https://www.spruillarts.org"
API_URL = f"{BASE_URL}/wp-json/tribe/events/v1/events"

VENUE_DATA = {
    "name": "Spruill Center for the Arts",
    "slug": "spruill-center-for-the-arts",
    "address": "5339 Chamblee Dunwoody Rd",
    "neighborhood": "Dunwoody",
    "city": "Dunwoody",
    "state": "GA",
    "zip": "30338",
    "lat": 33.9205,
    "lng": -84.3102,
    "venue_type": "community_center",
    "spot_type": "community_center",
    "website": BASE_URL,
    "vibes": [
        "workshop",
        "creative",
        "hands-on",
        "art-class",
        "pottery",
        "glassblowing",
        "jewelry",
        "fiber-arts",
    ],
}

# Skip staff meetings and internal events
SKIP_KEYWORDS = [
    "staff meeting",
    "board meeting",
    "committee",
    "internal",
    "closed",
    "private",
    "members only",
]


def parse_datetime(dt_str: str) -> tuple[Optional[str], Optional[str]]:
    """
    Parse ISO datetime string to date and time.
    Returns (YYYY-MM-DD, HH:MM) tuple.
    """
    if not dt_str:
        return None, None

    try:
        # Parse ISO format: "2026-02-14 10:00:00"
        dt = datetime.fromisoformat(dt_str.replace("T", " ").split("+")[0].split("Z")[0].strip())
        return dt.strftime("%Y-%m-%d"), dt.strftime("%H:%M")
    except (ValueError, AttributeError) as e:
        logger.debug(f"Could not parse datetime '{dt_str}': {e}")
        return None, None


def strip_html(html: str) -> str:
    """Strip HTML tags and clean up text."""
    if not html:
        return ""

    soup = BeautifulSoup(html, "html.parser")
    text = soup.get_text(separator=" ", strip=True)
    # Clean up multiple spaces
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def parse_cost(cost_str: str) -> tuple[Optional[float], Optional[float], bool]:
    """
    Parse cost field into price_min, price_max, is_free.
    Examples:
    - "Free" → (None, None, True)
    - "$15" → (15.0, 15.0, False)
    - "$10 - $20" → (10.0, 20.0, False)
    - "$5 suggested donation" → (5.0, 5.0, False)
    """
    if not cost_str:
        return None, None, False

    cost_lower = cost_str.lower().strip()

    # Check for free
    if cost_lower in ["free", "no cost", "no charge"] or "free" in cost_lower:
        return None, None, True

    # Extract dollar amounts
    amounts = re.findall(r"\$?\s*(\d+(?:\.\d{2})?)", cost_str)
    if not amounts:
        return None, None, False

    try:
        prices = [float(amt) for amt in amounts]
        if len(prices) == 1:
            return prices[0], prices[0], False
        elif len(prices) >= 2:
            return min(prices), max(prices), False
    except ValueError:
        pass

    return None, None, False


def determine_category_and_tags(title: str, description: str) -> tuple[str, Optional[str], list[str]]:
    """Determine category based on title and description."""
    text = f"{title} {description}".lower()
    tags = []

    # Yoga/Tai Chi → fitness
    if any(kw in text for kw in ["yoga", "yogic"]):
        tags.extend(["yoga", "wellness"])
        return "fitness", None, tags

    if any(kw in text for kw in ["tai chi", "taichi", "tai-chi"]):
        tags.extend(["tai-chi", "wellness"])
        return "fitness", None, tags

    # Mah Jongg / games → community
    if any(kw in text for kw in ["mah jongg", "mahjong", "game night", "board game"]):
        tags.extend(["games", "social"])
        return "community", None, tags

    # Artist talks / exhibitions → art
    if any(kw in text for kw in [
        "artist talk",
        "gallery",
        "exhibition",
        "opening",
        "reception",
        "show",
        "exhibit",
    ]):
        tags.extend(["gallery", "talk"])
        return "art", None, tags

    # Art classes / workshops
    if any(kw in text for kw in [
        "workshop",
        "class",
        "pottery",
        "ceramics",
        "glassblowing",
        "glass",
        "jewelry",
        "fiber",
        "weaving",
        "painting",
        "drawing",
        "sculpture",
        "craft",
    ]):
        tags.extend(["art-class", "hands-on"])
        return "learning", "workshop", tags

    # Crafternoon / Mini Makers → kids/family workshops
    if any(kw in text for kw in ["crafternoon", "mini makers", "kids", "children", "family"]):
        tags.extend(["hands-on", "family-friendly"])
        return "learning", "workshop", tags

    # Default: learning/class
    return "learning", "class", tags


def is_public_event(title: str, description: str) -> bool:
    """Determine if event is public vs. internal."""
    text = f"{title} {description}".lower()

    # Skip internal events
    if any(kw in text for kw in SKIP_KEYWORDS):
        return False

    return True


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Spruill Center for the Arts events using The Events Calendar REST API."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        venue_id = get_or_create_venue(VENUE_DATA)

        # Fetch events from API
        headers = {
            "User-Agent": "Mozilla/5.0 (compatible; LostCity/1.0)",
        }

        page = 1
        per_page = 50
        seen_events = set()

        while True:
            params = {
                "per_page": per_page,
                "page": page,
                "start_date": datetime.now().strftime("%Y-%m-%d"),
            }

            logger.info(f"Fetching Spruill Center events API page {page}")
            response = requests.get(API_URL, params=params, headers=headers, timeout=30)
            response.raise_for_status()

            data = response.json()
            events = data.get("events", [])

            if not events:
                logger.info(f"No more events on page {page}")
                break

            logger.info(f"Processing {len(events)} events from page {page}")

            for event_data in events:
                try:
                    title = event_data.get("title", "").strip()

                    if not title or len(title) < 5:
                        continue

                    # Parse dates and times
                    start_date_str = event_data.get("start_date")
                    end_date_str = event_data.get("end_date")

                    start_date, start_time = parse_datetime(start_date_str)
                    end_date, end_time = parse_datetime(end_date_str) if end_date_str else (None, None)

                    if not start_date:
                        logger.debug(f"No valid date for: {title}")
                        continue

                    # Extract description (HTML)
                    description_html = event_data.get("description", "")
                    description = strip_html(description_html)[:500]

                    # Get URL
                    event_url = event_data.get("url", f"{BASE_URL}/events/")

                    # Check if public
                    if not is_public_event(title, description):
                        logger.debug(f"Skipping internal event: {title}")
                        continue

                    # Dedupe by title and date
                    event_key = f"{title}|{start_date}"
                    if event_key in seen_events:
                        continue
                    seen_events.add(event_key)

                    events_found += 1

                    # Generate content hash
                    content_hash = generate_content_hash(
                        title, "Spruill Center for the Arts", start_date
                    )

                    # Check for existing

                    # Determine category and tags
                    category, subcategory, tags = determine_category_and_tags(title, description)

                    # Add family-friendly tag if applicable
                    if any(kw in f"{title} {description}".lower() for kw in [
                        "family",
                        "kid",
                        "children",
                        "all ages",
                        "mini makers",
                    ]):
                        if "family-friendly" not in tags:
                            tags.append("family-friendly")

                    # Check if all day
                    all_day = event_data.get("all_day", False)
                    is_all_day = bool(all_day)

                    # Parse cost
                    cost_str = event_data.get("cost", "")
                    price_min, price_max, is_free = parse_cost(cost_str)

                    # Build price_note from cost string if present
                    price_note = None
                    if cost_str and not is_free:
                        price_note = cost_str[:100]

                    # Get image
                    image_url = None
                    if event_data.get("image"):
                        image_url = event_data["image"].get("url")

                    # Build event record
                    event_record = {
                        "source_id": source_id,
                        "venue_id": venue_id,
                        "title": title[:200],
                        "description": description if description else None,
                        "start_date": start_date,
                        "start_time": start_time if not is_all_day else None,
                        "end_date": end_date if end_date != start_date else None,
                        "end_time": end_time if not is_all_day else None,
                        "is_all_day": is_all_day,
                        "category": category,
                        "subcategory": subcategory,
                        "tags": tags,
                        "price_min": price_min,
                        "price_max": price_max,
                        "price_note": price_note,
                        "is_free": is_free,
                        "source_url": event_url,
                        "ticket_url": event_url,
                        "image_url": image_url,
                        "raw_text": f"{title} {description}"[:500],
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
                        logger.info(f"Added: {title[:50]}... on {start_date}")
                    except Exception as e:
                        logger.error(f"Failed to insert: {title}: {e}")

                except Exception as e:
                    logger.error(f"Error processing event: {e}")
                    continue

            # Check if there are more pages
            total_pages = data.get("total_pages", 1)
            if page >= total_pages:
                break

            page += 1

        logger.info(
            f"Spruill Center crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except requests.exceptions.RequestException as e:
        logger.error(f"Failed to fetch Spruill Center events: {e}")
        raise
    except Exception as e:
        logger.error(f"Failed to crawl Spruill Center: {e}")
        raise

    return events_found, events_new, events_updated
