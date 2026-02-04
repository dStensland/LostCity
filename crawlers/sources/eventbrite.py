"""
Eventbrite hybrid crawler for Atlanta metro area events.
Discovers events via website, fetches structured data via API.
"""

from __future__ import annotations

import logging
import re
import time
import requests
from datetime import datetime
from typing import Optional
from playwright.sync_api import sync_playwright

from config import get_config
from db import get_or_create_venue, insert_event, find_event_by_hash
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

API_BASE = "https://www.eventbriteapi.com/v3/"

# Browse multiple category-filtered URLs to surface events the generic page buries
BROWSE_URLS = [
    "https://www.eventbrite.com/d/ga--atlanta/all-events/",
    "https://www.eventbrite.com/d/ga--atlanta/food-and-drink/",
    "https://www.eventbrite.com/d/ga--atlanta/classes/",
    "https://www.eventbrite.com/d/ga--atlanta/hobbies/",
]

# Category mapping from Eventbrite to Lost City
CATEGORY_MAP = {
    "Music": ("music", "concert"),
    "Business & Professional": ("business", "networking"),
    "Food & Drink": ("food", "dining"),
    "Community & Culture": ("community", "cultural"),
    "Performing & Visual Arts": ("art", "performance"),
    "Film, Media & Entertainment": ("film", "screening"),
    "Sports & Fitness": ("sports", "fitness"),
    "Health & Wellness": ("wellness", "health"),
    "Science & Technology": ("tech", "meetup"),
    "Travel & Outdoor": ("outdoors", "adventure"),
    "Charity & Causes": ("community", "charity"),
    "Religion & Spirituality": ("community", "spiritual"),
    "Family & Education": ("family", "kids"),
    "Seasonal & Holiday": ("community", "holiday"),
    "Government & Politics": ("community", "civic"),
    "Fashion & Beauty": ("lifestyle", "fashion"),
    "Home & Lifestyle": ("lifestyle", "home"),
    "Auto, Boat & Air": ("lifestyle", "automotive"),
    "Hobbies & Special Interest": ("community", "hobby"),
    "Other": ("community", "other"),
    "Nightlife": ("nightlife", "party"),
}


def get_api_headers() -> dict:
    """Get API request headers with authentication."""
    cfg = get_config()
    api_key = cfg.api.eventbrite_api_key
    if not api_key:
        raise ValueError("EVENTBRITE_API_KEY not configured")
    return {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }


def discover_event_ids(max_events: int = 500) -> list[str]:
    """Discover event IDs by browsing multiple Eventbrite category pages."""
    event_ids = set()

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
            viewport={"width": 1920, "height": 1080},
        )
        page = context.new_page()

        for browse_url in BROWSE_URLS:
            if len(event_ids) >= max_events:
                break

            logger.info(f"Browsing {browse_url} ...")
            try:
                page.goto(browse_url, wait_until="domcontentloaded", timeout=30000)
                page.wait_for_timeout(3000)
            except Exception as e:
                logger.warning(f"Failed to load {browse_url}: {e}")
                continue

            # Scroll and collect event IDs
            scroll_count = 0
            max_scrolls = 30
            last_count = len(event_ids)
            no_new_count = 0

            while scroll_count < max_scrolls and len(event_ids) < max_events:
                # Find all event links on page
                links = page.query_selector_all('a[href*="/e/"]')

                for link in links:
                    href = link.get_attribute("href")
                    if href:
                        match = re.search(r'/e/[^/]+-(\d+)', href)
                        if match:
                            event_ids.add(match.group(1))

                if len(event_ids) == last_count:
                    no_new_count += 1
                    try:
                        load_more = page.query_selector('button:has-text("See more"), button:has-text("Load more"), [data-testid="load-more-button"]')
                        if load_more and load_more.is_visible():
                            load_more.click()
                            page.wait_for_timeout(2000)
                            no_new_count = 0
                            continue
                    except Exception:
                        pass

                    if no_new_count >= 5:
                        break
                else:
                    no_new_count = 0
                    last_count = len(event_ids)

                logger.info(f"Scroll {scroll_count + 1}: Found {len(event_ids)} unique events so far")
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(2000)
                scroll_count += 1

            logger.info(f"After {browse_url}: {len(event_ids)} total unique events")

        browser.close()

    logger.info(f"Discovered {len(event_ids)} unique event IDs across {len(BROWSE_URLS)} category pages")
    return list(event_ids)[:max_events]


def fetch_event_from_api(event_id: str) -> Optional[dict]:
    """Fetch event details from Eventbrite API."""
    try:
        url = f"{API_BASE}events/{event_id}/"
        params = {"expand": "venue,organizer,category,format,ticket_availability"}
        
        response = requests.get(url, headers=get_api_headers(), params=params, timeout=15)
        
        if response.status_code == 404:
            logger.debug(f"Event {event_id} not found (may be private or ended)")
            return None
        elif response.status_code == 429:
            logger.warning("Rate limited, waiting 30 seconds...")
            time.sleep(30)
            return fetch_event_from_api(event_id)  # Retry once
        
        response.raise_for_status()
        return response.json()
        
    except Exception as e:
        logger.error(f"Error fetching event {event_id}: {e}")
        return None


def parse_datetime(dt_str: str) -> tuple[Optional[str], Optional[str]]:
    """Parse Eventbrite datetime to date and time strings."""
    if not dt_str:
        return None, None
    try:
        dt = datetime.fromisoformat(dt_str.replace("Z", "+00:00"))
        return dt.strftime("%Y-%m-%d"), dt.strftime("%H:%M:%S")
    except Exception:
        return None, None


def get_category(eventbrite_category: Optional[str]) -> tuple[str, str]:
    """Map Eventbrite category to Lost City category/subcategory."""
    if not eventbrite_category:
        return "community", "other"
    return CATEGORY_MAP.get(eventbrite_category, ("community", "other"))


def process_event(event_data: dict, source_id: int, producer_id: Optional[int]) -> Optional[dict]:
    """Process API event data into our format."""
    try:
        # Extract basic info
        title = event_data.get("name", {}).get("text", "").strip()
        if not title:
            return None

        # Skip past events
        start_info = event_data.get("start", {})
        start_date, start_time = parse_datetime(start_info.get("local"))
        if not start_date:
            return None
        
        if start_date < datetime.now().strftime("%Y-%m-%d"):
            return None

        description = event_data.get("description", {}).get("text", "")
        if description:
            description = description[:2000]

        end_info = event_data.get("end", {})
        end_date, end_time = parse_datetime(end_info.get("local"))

        # Get venue info
        venue_data = event_data.get("venue") or {}
        venue_id = None
        venue_name = "TBA"

        if venue_data and venue_data.get("name"):
            venue_name = venue_data.get("name", "").strip()
            address = venue_data.get("address", {})

            # Skip if not in Georgia
            region = address.get("region", "")
            if region and region not in ["GA", "Georgia"]:
                return None

            venue_record = {
                "name": venue_name,
                "slug": re.sub(r'[^a-z0-9-]', '', venue_name.lower().replace(" ", "-"))[:50],
                "address": address.get("address_1"),
                "city": address.get("city", "Atlanta"),
                "state": "GA",
                "zip": address.get("postal_code"),
                "venue_type": "event_space",
                "website": None,
            }
            venue_id = get_or_create_venue(venue_record)

        # Get category
        category_data = event_data.get("category") or {}
        category_name = category_data.get("name") if category_data else None
        category, subcategory = get_category(category_name)

        # Check if free
        is_free = event_data.get("is_free", False)

        # Get image
        logo = event_data.get("logo") or {}
        image_url = None
        if logo:
            original = logo.get("original") or {}
            image_url = original.get("url")

        # Get URL
        event_url = event_data.get("url", "")

        # Generate content hash
        content_hash = generate_content_hash(title, venue_name, start_date)

        # Check if already exists
        if find_event_by_hash(content_hash):
            return {"status": "exists"}

        # Build tags
        tags = ["eventbrite", category]
        if is_free:
            tags.append("free")
        
        format_data = event_data.get("format") or {}
        if format_data.get("short_name"):
            tags.append(format_data.get("short_name").lower())

        # Get organizer info
        organizer = event_data.get("organizer") or {}
        organizer_name = organizer.get("name", "") if organizer else ""

        return {
            "source_id": source_id,
            "venue_id": venue_id,
            "producer_id": producer_id,
            "title": title[:500],
            "description": description,
            "start_date": start_date,
            "start_time": start_time,
            "end_date": end_date or start_date,
            "end_time": end_time,
            "is_all_day": False,
            "category": category,
            "subcategory": subcategory,
            "tags": tags,
            "price_min": None,
            "price_max": None,
            "price_note": "Free" if is_free else "See Eventbrite",
            "is_free": is_free,
            "source_url": event_url,
            "ticket_url": event_url,
            "image_url": image_url,
            "raw_text": None,
            "extraction_confidence": 0.95,
            "is_recurring": False,
            "recurrence_rule": None,
            "content_hash": content_hash,
        }
    except Exception as e:
        logger.error(f"Error processing event: {e}")
        return None


def crawl(source: dict) -> tuple[int, int, int]:
    """Hybrid crawl: discover via website, fetch via API."""
    source_id = source["id"]
    producer_id = source.get("producer_id")

    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        # Step 1: Discover event IDs from website
        logger.info("Step 1: Discovering events from Eventbrite website...")
        event_ids = discover_event_ids(max_events=500)
        
        if not event_ids:
            logger.warning("No event IDs discovered")
            return 0, 0, 0

        # Step 2: Fetch each event from API
        logger.info(f"Step 2: Fetching {len(event_ids)} events from API...")
        
        for i, event_id in enumerate(event_ids):
            if i > 0 and i % 50 == 0:
                logger.info(f"Progress: {i}/{len(event_ids)} events processed, {events_new} new")
            
            # Fetch from API
            event_data = fetch_event_from_api(event_id)
            if not event_data:
                continue
            
            events_found += 1
            
            # Process into our format
            result = process_event(event_data, source_id, producer_id)
            if not result:
                continue

            if result.get("status") == "exists":
                events_updated += 1
                continue

            # Insert
            try:
                insert_event(result)
                events_new += 1
                logger.debug(f"Added: {result['title'][:50]}... on {result['start_date']}")
            except Exception as e:
                logger.error(f"Failed to insert: {result['title'][:50]}: {e}")
            
            # Small delay to be nice to API
            time.sleep(0.2)

        logger.info(
            f"Eventbrite crawl complete: {events_found} found, {events_new} new, {events_updated} existing"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Eventbrite: {e}")
        raise

    return events_found, events_new, events_updated
