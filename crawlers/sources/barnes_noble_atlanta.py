"""
Crawler for Barnes & Noble Atlanta-area stores (barnesandnoble.com).

Covers kids events, storytimes, author events, and book clubs at:
- Buckhead (Peachtree Rd)
- Perimeter (Ashford Dunwoody Rd)
- Atlantic Station
- Alpharetta (North Point Pkwy)
- Marietta (Barrett Pkwy)
- Kennesaw (Barrett Pkwy)

Events typically include Saturday morning storytimes, author signings,
character appearances, and holiday events.

Barnes & Noble posts their store events on Eventbrite, so we search
Eventbrite for each store's events.
"""

from __future__ import annotations

import re
import json
import logging
from datetime import datetime
from typing import Optional
from urllib.parse import quote

from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout

from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

# Barnes & Noble Atlanta-area stores
# Each store has an Eventbrite search query
STORES = [
    {
        "name": "Barnes & Noble Buckhead",
        "slug": "barnes-noble-buckhead",
        "address": "2900 Peachtree Rd NW",
        "neighborhood": "Buckhead",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30305",
        "venue_type": "bookstore",
        "website": "https://stores.barnesandnoble.com/store/2094",
        "_eventbrite_query": "Barnes Noble Buckhead",
    },
    {
        "name": "Barnes & Noble Perimeter",
        "slug": "barnes-noble-perimeter",
        "address": "1275 Ashford Dunwoody Rd",
        "neighborhood": "Perimeter",
        "city": "Dunwoody",
        "state": "GA",
        "zip": "30338",
        "venue_type": "bookstore",
        "website": "https://stores.barnesandnoble.com/store/2093",
        "_eventbrite_query": "Barnes Noble Perimeter",
    },
    {
        "name": "Barnes & Noble Atlantic Station",
        "slug": "barnes-noble-atlantic-station",
        "address": "201 19th St NW",
        "neighborhood": "Atlantic Station",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30363",
        "venue_type": "bookstore",
        "website": "https://stores.barnesandnoble.com/store/2728",
        "_eventbrite_query": "Barnes Noble Atlantic Station",
    },
    {
        "name": "Barnes & Noble Alpharetta",
        "slug": "barnes-noble-alpharetta",
        "address": "10905 State Bridge Rd",
        "neighborhood": "Alpharetta",
        "city": "Alpharetta",
        "state": "GA",
        "zip": "30022",
        "venue_type": "bookstore",
        "website": "https://stores.barnesandnoble.com/store/2754",
        "_eventbrite_query": "Barnes Noble Alpharetta",
    },
    {
        "name": "Barnes & Noble Marietta",
        "slug": "barnes-noble-marietta",
        "address": "1660 Cobb Pkwy SE",
        "neighborhood": "Cumberland",
        "city": "Marietta",
        "state": "GA",
        "zip": "30339",
        "venue_type": "bookstore",
        "website": "https://stores.barnesandnoble.com/store/2092",
        "_eventbrite_query": "Barnes Noble Marietta",
    },
    {
        "name": "Barnes & Noble Kennesaw",
        "slug": "barnes-noble-kennesaw",
        "address": "800 Cobb Place Blvd NW",
        "neighborhood": "Town Center",
        "city": "Kennesaw",
        "state": "GA",
        "zip": "30144",
        "venue_type": "bookstore",
        "website": "https://stores.barnesandnoble.com/store/2795",
        "_eventbrite_query": "Barnes Noble Kennesaw",
    },
]


def parse_eventbrite_jsonld(page) -> list[dict]:
    """Extract event data from Eventbrite JSON-LD structured data."""
    events = []

    scripts = page.query_selector_all('script[type="application/ld+json"]')
    for script in scripts:
        try:
            content = script.inner_html()
            data = json.loads(content)

            if isinstance(data, dict) and data.get("@type") == "Event":
                events.append(data)
            elif isinstance(data, list):
                for item in data:
                    if isinstance(item, dict) and item.get("@type") == "Event":
                        events.append(item)
        except (json.JSONDecodeError, Exception):
            continue

    return events


def determine_category(title: str, description: str = "") -> tuple[str, str, list[str]]:
    """Determine event category based on title and description."""
    title_lower = title.lower()
    description_lower = description.lower() if description else ""
    combined = f"{title_lower} {description_lower}"

    tags = ["books", "bookstore"]

    # Check for family/kids events
    is_family = any(
        keyword in combined
        for keyword in [
            "storytime",
            "story time",
            "kids",
            "children",
            "family",
            "toddler",
            "baby",
            "character",
            "pajama",
        ]
    )

    if is_family:
        tags.extend(["family", "kids", "family-friendly"])

    # Determine category and subcategory
    if "storytime" in combined or "story time" in combined:
        tags.append("storytime")
        return "family", "storytime", tags
    elif "book club" in combined:
        return "words", "bookclub", tags
    elif "author" in combined or "signing" in combined:
        return "words", "reading", tags
    elif "workshop" in combined or "writing" in combined:
        return "words", "workshop", tags
    else:
        return "words", "reading", tags


def crawl_store_events(page, store: dict, source_id: int) -> tuple[int, int, int]:
    """Crawl events for a single Barnes & Noble store from Eventbrite."""
    events_found = 0
    events_new = 0
    events_updated = 0

    venue_data = {k: v for k, v in store.items() if not k.startswith("_")}
    venue_id = get_or_create_venue(venue_data)

    # Build Eventbrite search URL
    query = quote(store["_eventbrite_query"])
    eventbrite_url = f"https://www.eventbrite.com/d/ga--atlanta/{query}/"

    logger.info(f"Searching Eventbrite for {store['name']}: {eventbrite_url}")

    try:
        page.goto(eventbrite_url, wait_until="domcontentloaded", timeout=30000)
        page.wait_for_timeout(3000)

        # Find event links
        event_links = page.query_selector_all('a[href*="/e/"]')
        event_urls = set()

        for link in event_links:
            href = link.get_attribute("href") or ""
            text = link.inner_text().lower()

            # Only get Barnes & Noble events
            if "barnes" in text or "noble" in text or "b&n" in text:
                # Normalize URL
                if "?" in href:
                    href = href.split("?")[0]
                event_urls.add(href)

        logger.info(f"Found {len(event_urls)} potential events for {store['name']}")

        # Visit each event page
        for event_url in event_urls:
            try:
                logger.debug(f"Fetching event: {event_url}")
                page.goto(event_url, wait_until="domcontentloaded", timeout=30000)
                page.wait_for_timeout(2000)

                # Extract JSON-LD data
                jsonld_events = parse_eventbrite_jsonld(page)

                for event_data in jsonld_events:
                    try:
                        title = event_data.get("name", "")
                        if not title:
                            continue

                        # Parse dates
                        start_date_str = event_data.get("startDate", "")
                        if not start_date_str:
                            continue

                        # Parse ISO datetime
                        try:
                            start_dt = datetime.fromisoformat(
                                start_date_str.replace("Z", "+00:00")
                            )
                            start_date = start_dt.strftime("%Y-%m-%d")
                            start_time = start_dt.strftime("%H:%M")
                        except ValueError:
                            continue

                        # Skip past events
                        if start_date < datetime.now().strftime("%Y-%m-%d"):
                            continue

                        end_date = None
                        end_time = None
                        end_date_str = event_data.get("endDate", "")
                        if end_date_str:
                            try:
                                end_dt = datetime.fromisoformat(
                                    end_date_str.replace("Z", "+00:00")
                                )
                                end_date = end_dt.strftime("%Y-%m-%d")
                                end_time = end_dt.strftime("%H:%M")
                            except ValueError:
                                pass

                        # Get description
                        description = event_data.get("description", "")
                        if not description:
                            description = f"{title} at {store['name']}"

                        # Extract pricing
                        is_free = False
                        price_min = None
                        price_max = None
                        offers = event_data.get("offers", [])

                        if isinstance(offers, list):
                            prices = []
                            for offer in offers:
                                if isinstance(offer, dict):
                                    if offer.get("@type") == "AggregateOffer":
                                        low = offer.get("lowPrice")
                                        high = offer.get("highPrice")
                                        if low is not None:
                                            prices.append(float(low))
                                        if high is not None:
                                            prices.append(float(high))
                                    else:
                                        price = offer.get("price")
                                        if price is not None:
                                            prices.append(float(price))

                            if prices:
                                price_min = min(prices)
                                price_max = max(prices)
                                is_free = price_min == 0

                        # Get image
                        image_url = event_data.get("image")
                        if isinstance(image_url, list):
                            image_url = image_url[0] if image_url else None

                        events_found += 1

                        # Generate content hash
                        content_hash = generate_content_hash(
                            title, store["name"], start_date
                        )


                        # Determine category and tags
                        category, subcategory, tags = determine_category(
                            title, description
                        )

                        # Add free tag if applicable
                        if is_free:
                            tags.append("free")

                        # Add educational tag for certain events
                        if "educational" in title.lower() or "learn" in title.lower():
                            tags.append("educational")

                        event_record = {
                            "source_id": source_id,
                            "venue_id": venue_id,
                            "title": title,
                            "description": description[:1000] if description else None,
                            "start_date": start_date,
                            "start_time": start_time,
                            "end_date": end_date,
                            "end_time": end_time,
                            "is_all_day": False,
                            "category": category,
                            "subcategory": subcategory,
                            "tags": tags,
                            "price_min": price_min,
                            "price_max": price_max,
                            "price_note": "Free" if is_free else "See Eventbrite",
                            "is_free": is_free,
                            "source_url": event_url,
                            "ticket_url": event_url,
                            "image_url": image_url,
                            "raw_text": f"{title} - {description[:200] if description else ''}",
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
                            logger.info(f"Added: {title} on {start_date}")
                        except Exception as e:
                            logger.error(f"Failed to insert: {title}: {e}")

                    except Exception as e:
                        logger.debug(f"Error processing JSON-LD event: {e}")
                        continue

            except PlaywrightTimeout:
                logger.warning(f"Timeout loading event page: {event_url}")
            except Exception as e:
                logger.debug(f"Error fetching event page {event_url}: {e}")

    except PlaywrightTimeout:
        logger.warning(f"Timeout loading Eventbrite search for {store['name']}")
    except Exception as e:
        logger.warning(f"Error searching Eventbrite for {store['name']}: {e}")

    return events_found, events_new, events_updated


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Barnes & Noble Atlanta-area stores for kids/family events via Eventbrite."""
    source_id = source["id"]
    total_found = 0
    total_new = 0
    total_updated = 0

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
                viewport={"width": 1920, "height": 1080},
            )
            page = context.new_page()

            # Process each store
            for store in STORES:
                try:
                    found, new, updated = crawl_store_events(page, store, source_id)
                    total_found += found
                    total_new += new
                    total_updated += updated
                except Exception as e:
                    logger.warning(f"Error crawling {store['name']}: {e}")
                    continue

            browser.close()

        logger.info(
            f"Barnes & Noble crawl complete: {total_found} found, {total_new} new, {total_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Barnes & Noble: {e}")
        raise

    return total_found, total_new, total_updated
