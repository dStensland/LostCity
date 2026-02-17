"""
Crawler for Flux Projects (fluxprojects.org).

Public art organization in Downtown Atlanta producing installations, performances,
film screenings, and workshops. Known for experimental public art, community
engagement, and innovative urban interventions.

Site uses The Events Calendar (Tribe Events) WordPress plugin with REST API.
Events page: https://fluxprojects.org/events/
Individual events: https://fluxprojects.org/event/[slug]/
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

BASE_URL = "https://fluxprojects.org"
API_URL = f"{BASE_URL}/wp-json/tribe/events/v1/events"
EVENTS_URL = f"{BASE_URL}/events/"

VENUE_DATA = {
    "name": "Flux Projects",
    "slug": "flux-projects",
    "address": "400 Pryor Street SW #3346",
    "neighborhood": "Downtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30302",
    "lat": 33.7493,
    "lng": -84.3903,
    "venue_type": "organization",
    "spot_type": "gallery",
    "website": BASE_URL,
    "vibes": [
        "public-art",
        "experimental",
        "contemporary-art",
        "community-art",
        "installation",
    ],
}


def parse_datetime(dt_str: str) -> tuple[Optional[str], Optional[str]]:
    """
    Parse ISO datetime string to date and time.
    Returns (YYYY-MM-DD, HH:MM) tuple.

    API returns dates like: "2026-02-15 18:00:00" or "2026-02-15T18:00:00"
    """
    if not dt_str:
        return None, None

    try:
        # Handle both space and T separators, strip timezone info
        dt_str_clean = dt_str.replace("T", " ").split("+")[0].split("Z")[0].strip()
        dt = datetime.fromisoformat(dt_str_clean)
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
    # Clean up multiple spaces and normalize whitespace
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def parse_cost(cost_str: str) -> tuple[Optional[float], Optional[float], bool]:
    """
    Parse cost field into price_min, price_max, is_free.

    Examples:
    - "Free" → (None, None, True)
    - "$15" → (15.0, 15.0, False)
    - "$10 - $20" → (10.0, 20.0, False)
    - "" → (None, None, True) (default free for Flux)
    """
    if not cost_str:
        # Most Flux Projects events are free
        return None, None, True

    cost_lower = cost_str.lower().strip()

    # Check for free indicators
    if cost_lower in ["free", "no cost", "no charge"] or "free" in cost_lower:
        return None, None, True

    # Extract dollar amounts
    amounts = re.findall(r"\$?\s*(\d+(?:\.\d{2})?)", cost_str)
    if not amounts:
        # No price found, assume free for public art events
        return None, None, True

    try:
        prices = [float(amt) for amt in amounts]
        if len(prices) == 1:
            return prices[0], prices[0], False
        elif len(prices) >= 2:
            return min(prices), max(prices), False
    except ValueError:
        pass

    return None, None, True


def determine_category_and_tags(
    title: str, description: str, event_categories: list
) -> tuple[str, Optional[str], list[str]]:
    """
    Determine category and tags based on title, description, and API categories.

    Args:
        title: Event title
        description: Event description
        event_categories: List of category dicts from API

    Returns:
        Tuple of (category, subcategory, tags)
    """
    text = f"{title} {description}".lower()
    tags = ["flux-projects", "public-art", "downtown"]

    # Extract category names from API
    category_names = [cat.get("name", "").lower() for cat in event_categories if cat.get("name")]
    all_cats = " ".join(category_names)

    # Film screenings and cinema events
    if any(kw in text for kw in ["film", "screening", "cinema", "movie", "documentary"]):
        tags.extend(["film", "screening"])
        return "film", None, tags

    # Performances and live events
    if any(kw in text for kw in [
        "performance",
        "dance",
        "theater",
        "theatre",
        "performer",
        "live performance",
    ]):
        tags.extend(["performance", "live-art"])
        return "art", "performance", tags

    # Music events
    if any(kw in text for kw in [
        "concert",
        "music",
        "musician",
        "band",
        "dj",
        "live music",
    ]):
        tags.append("music")
        return "music", None, tags

    # Workshops and educational programs
    if any(kw in text for kw in [
        "workshop",
        "class",
        "training",
        "seminar",
        "learn",
        "hands-on",
        "community engagement",
    ]):
        tags.extend(["workshop", "community"])
        return "learning", "workshop", tags

    # Talks, panels, and discussions
    if any(kw in text for kw in [
        "talk",
        "panel",
        "discussion",
        "conversation",
        "lecture",
        "artist talk",
        "q&a",
    ]):
        tags.extend(["talk", "educational"])
        return "art", "talk", tags

    # Opening receptions and exhibitions
    if any(kw in text for kw in [
        "opening",
        "reception",
        "exhibition",
        "exhibit",
        "gallery",
    ]):
        tags.extend(["opening", "exhibition"])
        return "art", "opening", tags

    # Tours and site-specific events
    if any(kw in text for kw in ["tour", "walking tour", "site visit", "guided"]):
        tags.extend(["tour", "site-specific"])
        return "art", "tour", tags

    # Installations and public art (default for Flux)
    if any(kw in text or kw in all_cats for kw in [
        "installation",
        "public art",
        "sculpture",
        "site-specific",
        "intervention",
        "temporary",
    ]):
        tags.extend(["installation", "site-specific"])
        return "art", "installation", tags

    # Community events and gatherings
    if any(kw in text for kw in [
        "community",
        "gathering",
        "meetup",
        "social",
        "public event",
    ]):
        tags.append("community")
        return "community", None, tags

    # Default to art/installation for Flux Projects
    tags.append("installation")
    return "art", "installation", tags


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Flux Projects events using The Events Calendar REST API."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        venue_id = get_or_create_venue(VENUE_DATA)

        # Fetch events from API
        headers = {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "application/json",
            "Referer": EVENTS_URL,
        }

        page = 1
        per_page = 50
        max_pages = 10  # Safety limit
        seen_events = set()

        while page <= max_pages:
            params = {
                "per_page": per_page,
                "page": page,
                "start_date": datetime.now().strftime("%Y-%m-%d"),
                "status": "publish",
                "order": "asc",
                "orderby": "start_date",
            }

            logger.info(f"Fetching Flux Projects events API page {page}: {API_URL}")
            response = requests.get(API_URL, params=params, headers=headers, timeout=30)
            response.raise_for_status()

            data = response.json()
            events_list = data.get("events", [])

            if not events_list:
                logger.info(f"No more events on page {page}")
                break

            logger.info(f"Processing {len(events_list)} events from page {page}")

            for event_data in events_list:
                try:
                    # Extract title
                    title = event_data.get("title", "").strip()

                    # Clean HTML entities from title
                    title = re.sub(r"&#\d+;", "", title)
                    title = re.sub(r"&[a-z]+;", "", title)
                    title = title.strip()

                    if not title or len(title) < 3:
                        continue

                    # Parse dates and times
                    start_date_str = event_data.get("start_date")
                    end_date_str = event_data.get("end_date")

                    start_date, start_time = parse_datetime(start_date_str)
                    end_date, end_time = parse_datetime(end_date_str) if end_date_str else (None, None)

                    if not start_date:
                        logger.debug(f"No valid start date for: {title}")
                        continue

                    # Skip past events (check end_date if exists, otherwise start_date)
                    try:
                        check_date = end_date or start_date
                        if datetime.strptime(check_date, "%Y-%m-%d").date() < datetime.now().date():
                            logger.debug(f"Skipping past event: {title}")
                            continue
                    except ValueError:
                        pass

                    # Dedupe by title and date
                    event_key = f"{title}|{start_date}"
                    if event_key in seen_events:
                        continue
                    seen_events.add(event_key)

                    events_found += 1

                    # Extract description (strip HTML)
                    description_html = event_data.get("description", "")
                    description = strip_html(description_html)[:1000]

                    if not description or len(description) < 10:
                        description = f"{title} - Public art event presented by Flux Projects in Atlanta."

                    # Get event URL
                    event_url = event_data.get("url", EVENTS_URL)

                    # Extract categories
                    event_categories = event_data.get("categories", [])

                    # Determine category and tags
                    category, subcategory, tags = determine_category_and_tags(
                        title, description, event_categories
                    )

                    # Check if all-day event
                    is_all_day = event_data.get("all_day", False)

                    # Parse cost
                    cost_str = event_data.get("cost", "")
                    price_min, price_max, is_free = parse_cost(cost_str)

                    # Build price note
                    price_note = None
                    if is_free:
                        price_note = "Free and open to the public"
                    elif cost_str:
                        price_note = cost_str[:100]

                    # Extract image
                    image_url = None
                    if event_data.get("image"):
                        if isinstance(event_data["image"], dict):
                            image_url = event_data["image"].get("url")
                        elif isinstance(event_data["image"], str) and event_data["image"] != "false":
                            image_url = event_data["image"]

                    # Generate content hash
                    content_hash = generate_content_hash(
                        title, "Flux Projects", start_date
                    )

                    # Check for existing event

                    # Build event record
                    event_record = {
                        "source_id": source_id,
                        "venue_id": venue_id,
                        "title": title[:500],
                        "description": description,
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
                        "extraction_confidence": 0.95,  # High confidence - structured API data
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
                        logger.info(f"Added: {title[:60]}... on {start_date}")
                    except Exception as e:
                        logger.error(f"Failed to insert event '{title}': {e}")

                except Exception as e:
                    logger.error(f"Error processing event: {e}")
                    continue

            # Check if there are more pages
            total_pages = data.get("total_pages", 1)
            if page >= total_pages:
                logger.info(f"Reached last page ({page}/{total_pages})")
                break

            page += 1

        logger.info(
            f"Flux Projects crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except requests.exceptions.RequestException as e:
        logger.error(f"Failed to fetch Flux Projects events: {e}")
        raise
    except Exception as e:
        logger.error(f"Failed to crawl Flux Projects: {e}")
        raise

    return events_found, events_new, events_updated
