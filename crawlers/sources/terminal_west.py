"""
Crawler for Terminal West (terminalwestatl.com/events).
A music venue in Atlanta.
"""

import logging
from bs4 import BeautifulSoup

from utils import fetch_page, rate_limit, get_date_range
from extract import extract_events
from dedupe import generate_content_hash, is_duplicate, merge_event_data
from db import get_or_create_venue, insert_event, update_event, find_event_by_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://terminalwestatl.com"
EVENTS_URL = f"{BASE_URL}/events"


@rate_limit(1.0)
def fetch_event_list() -> list[str]:
    """Fetch the events page and extract individual event URLs."""
    html = fetch_page(EVENTS_URL)
    soup = BeautifulSoup(html, "lxml")

    event_links = []
    # This selector will need adjustment based on actual site structure
    for link in soup.select("a[href*='/event/']"):
        href = link.get("href", "")
        if href.startswith("/"):
            href = BASE_URL + href
        if href not in event_links:
            event_links.append(href)

    return event_links


@rate_limit(1.0)
def fetch_event_detail(url: str) -> str:
    """Fetch a single event detail page."""
    return fetch_page(url)


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl Terminal West events.

    Args:
        source: Source record from database

    Returns:
        Tuple of (events_found, events_new, events_updated)
    """
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        event_urls = fetch_event_list()
        logger.info(f"Found {len(event_urls)} event links on Terminal West")

        for url in event_urls:
            try:
                html = fetch_event_detail(url)
                extracted = extract_events(html, url, "Terminal West")

                for event_data in extracted:
                    events_found += 1

                    # Resolve venue
                    venue_data = {
                        "name": "Terminal West",
                        "slug": "terminal-west",
                        "address": "887 W Marietta St NW Suite J",
                        "neighborhood": "West Midtown",
                        "city": "Atlanta",
                        "state": "GA",
                        "zip": "30318",
                        "venue_type": "music_venue",
                        "website": BASE_URL
                    }
                    venue_id = get_or_create_venue(venue_data)

                    # Check for duplicate
                    content_hash = generate_content_hash(
                        event_data.title,
                        event_data.venue.name,
                        event_data.start_date
                    )

                    canonical_id = is_duplicate(event_data, venue_id)

                    if canonical_id:
                        # Update existing event with any new data
                        existing = find_event_by_hash(content_hash)
                        if existing:
                            merged = merge_event_data(existing, event_data)
                            update_event(existing["id"], merged)
                            events_updated += 1
                    else:
                        # Insert new event
                        event_record = {
                            "source_id": source_id,
                            "venue_id": venue_id,
                            "title": event_data.title,
                            "description": event_data.description,
                            "start_date": event_data.start_date,
                            "start_time": event_data.start_time,
                            "end_date": event_data.end_date,
                            "end_time": event_data.end_time,
                            "is_all_day": event_data.is_all_day,
                            "category": event_data.category,
                            "subcategory": event_data.subcategory,
                            "tags": event_data.tags,
                            "price_min": event_data.price_min,
                            "price_max": event_data.price_max,
                            "price_note": event_data.price_note,
                            "is_free": event_data.is_free,
                            "source_url": url,
                            "ticket_url": event_data.ticket_url,
                            "image_url": event_data.image_url,
                            "raw_text": html[:10000],  # Store first 10k chars
                            "extraction_confidence": event_data.confidence,
                            "is_recurring": event_data.is_recurring,
                            "recurrence_rule": event_data.recurrence_rule,
                            "content_hash": content_hash
                        }
                        insert_event(event_record)
                        events_new += 1

            except Exception as e:
                logger.error(f"Failed to process event at {url}: {e}")
                continue

    except Exception as e:
        logger.error(f"Failed to crawl Terminal West: {e}")
        raise

    return events_found, events_new, events_updated
