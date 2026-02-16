"""
Crawler for APEX Museum (African American Panoramic Experience).

Historic museum in Sweet Auburn focusing on African American history and culture.
Events include music tributes, educational programs, exhibits, and cultural events.

Location: 135 Auburn Ave NE, Atlanta, GA (Sweet Auburn neighborhood)

Events are listed on Eventbrite. This crawler extracts event data from JSON-LD
structured data on Eventbrite event pages.
"""

from __future__ import annotations

import re
import json
import logging
from datetime import datetime
from typing import Optional

from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout

from db import get_or_create_venue, insert_event, find_event_by_hash
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://www.apexmuseum.org"
# APEX Museum Eventbrite search results page
EVENTBRITE_SEARCH_URL = "https://www.eventbrite.com/d/ga--atlanta/apex-museum/"

VENUE_DATA = {
    "name": "APEX Museum",
    "slug": "apex-museum",
    "address": "135 Auburn Ave NE",
    "neighborhood": "Sweet Auburn",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30303",
    "venue_type": "museum",
    "spot_type": "museum",
    "website": BASE_URL,
}


def determine_category(title: str, description: str = "") -> tuple[str, Optional[str], list[str]]:
    """Determine event category based on title and description."""
    title_lower = title.lower()
    description_lower = description.lower() if description else ""
    combined = f"{title_lower} {description_lower}"

    tags = ["museum", "apex-museum", "sweet-auburn", "educational"]

    # Black History Month events (February)
    if "black history" in combined or "african american history" in combined:
        tags.append("black-history-month")

    # Music events (tribute series, concerts)
    if any(w in combined for w in ["tribute", "concert", "music", "live music", "performance", "jazz", "soul", "blues", "r&b", "gospel"]):
        tags.extend(["live-music"])
        return "music", "concert", tags

    # Art exhibitions
    if any(w in combined for w in ["exhibition", "exhibit", "art show", "gallery", "artist"]):
        return "museums", "exhibition", tags

    # Educational programs
    if any(w in combined for w in ["lecture", "talk", "speaker", "discussion", "panel", "workshop"]):
        return "learning", "lecture", tags

    # Community events
    if any(w in combined for w in ["community", "celebration", "festival", "gathering"]):
        tags.append("community")
        return "community", "cultural", tags

    # Family events
    if any(w in combined for w in ["family", "children", "kids"]):
        tags.append("family-friendly")
        return "family", "educational", tags

    # Default to community/cultural for museum events
    return "community", "cultural", tags


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


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl APEX Museum events from Eventbrite."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
                viewport={"width": 1920, "height": 1080},
            )
            page = context.new_page()

            venue_id = get_or_create_venue(VENUE_DATA)

            logger.info(f"Fetching APEX Museum events from Eventbrite: {EVENTBRITE_SEARCH_URL}")

            try:
                page.goto(EVENTBRITE_SEARCH_URL, wait_until="domcontentloaded", timeout=30000)
                page.wait_for_timeout(5000)

                # Find event links that mention APEX Museum
                event_links = page.query_selector_all('a[href*="/e/"]')
                apex_event_urls = set()

                for link in event_links:
                    href = link.get_attribute("href") or ""
                    text = link.inner_text().lower()

                    # Only get APEX Museum specific events
                    if "apex-museum" in href or "apex museum" in text:
                        # Normalize URL
                        if "?" in href:
                            href = href.split("?")[0]
                        apex_event_urls.add(href)

                logger.info(f"Found {len(apex_event_urls)} unique APEX Museum event URLs")

                # Visit each event page and extract JSON-LD data
                for event_url in apex_event_urls:
                    try:
                        logger.info(f"Fetching event: {event_url}")
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
                                end_date_str = event_data.get("endDate", "")

                                if not start_date_str:
                                    continue

                                # Parse ISO datetime
                                try:
                                    start_dt = datetime.fromisoformat(start_date_str.replace("Z", "+00:00"))
                                    start_date = start_dt.strftime("%Y-%m-%d")
                                    start_time = start_dt.strftime("%H:%M")
                                except ValueError:
                                    continue

                                end_date = None
                                end_time = None
                                if end_date_str:
                                    try:
                                        end_dt = datetime.fromisoformat(end_date_str.replace("Z", "+00:00"))
                                        end_date = end_dt.strftime("%Y-%m-%d")
                                        end_time = end_dt.strftime("%H:%M")
                                    except ValueError:
                                        pass

                                # For recurring events, check if end date is in the future
                                is_recurring = False
                                try:
                                    start_dt_check = datetime.strptime(start_date, "%Y-%m-%d").date()
                                    end_dt_check = datetime.strptime(end_date, "%Y-%m-%d").date() if end_date else start_dt_check
                                    today = datetime.now().date()

                                    # If start is past but end is future, it's an ongoing recurring event
                                    if start_dt_check < today and end_dt_check >= today:
                                        is_recurring = True
                                        # Use today as the "start" since recurring events are ongoing
                                        start_date = today.strftime("%Y-%m-%d")
                                        logger.info(f"Recurring event detected: {title} (ongoing until {end_date})")
                                    elif end_dt_check < today:
                                        logger.debug(f"Skipping past event: {title}")
                                        continue
                                except ValueError:
                                    pass

                                # Get description
                                description = event_data.get("description", "")
                                if not description:
                                    description = f"{title} at APEX Museum"

                                # Get image
                                image_url = event_data.get("image")
                                if isinstance(image_url, list):
                                    image_url = image_url[0] if image_url else None

                                # Check for sold out status
                                is_sold_out = False
                                offers = event_data.get("offers", [])
                                if isinstance(offers, list):
                                    # Check if ALL offers are sold out
                                    if offers and all(
                                        offer.get("availability") == "SoldOut"
                                        for offer in offers
                                        if isinstance(offer, dict)
                                    ):
                                        is_sold_out = True
                                elif isinstance(offers, dict):
                                    is_sold_out = offers.get("availability") == "SoldOut"

                                # Extract pricing
                                is_free = False
                                price_min = None
                                price_max = None

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

                                events_found += 1

                                # Generate content hash
                                content_hash = generate_content_hash(title, "APEX Museum", start_date)

                                if find_event_by_hash(content_hash):
                                    events_updated += 1
                                    continue

                                # Determine category and tags
                                category, subcategory, tags = determine_category(title, description)

                                # Add sold-out tag if applicable
                                if is_sold_out:
                                    tags.append("sold-out")

                                # Build series_hint for recurring events
                                series_hint = None
                                if is_recurring:
                                    series_hint = {
                                        "series_type": "recurring_show",
                                        "series_title": title,
                                        "description": description[:500] if description else None,
                                    }
                                    if image_url:
                                        series_hint["image_url"] = image_url

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
                                    "price_note": "Sold Out" if is_sold_out else None,
                                    "is_free": is_free,
                                    "source_url": event_url,
                                    "ticket_url": event_url,
                                    "image_url": image_url,
                                    "raw_text": f"{title} - {description[:200] if description else ''}",
                                    "extraction_confidence": 0.9,
                                    "is_recurring": is_recurring,
                                    "recurrence_rule": "Every Thursday" if is_recurring else None,
                                    "content_hash": content_hash,
                                }

                                try:
                                    insert_event(event_record, series_hint=series_hint)
                                    events_new += 1
                                    sold_status = " (SOLD OUT)" if is_sold_out else ""
                                    logger.info(f"Added: {title} on {start_date}{sold_status}")
                                except Exception as e:
                                    logger.error(f"Failed to insert: {title}: {e}")

                            except Exception as e:
                                logger.error(f"Error processing JSON-LD event: {e}")
                                continue

                    except PlaywrightTimeout:
                        logger.warning(f"Timeout loading event page: {event_url}")
                    except Exception as e:
                        logger.error(f"Error fetching event page {event_url}: {e}")

            except PlaywrightTimeout:
                logger.error("Timeout loading Eventbrite search page")
            except Exception as e:
                logger.error(f"Error fetching from Eventbrite: {e}")

            browser.close()

        logger.info(
            f"APEX Museum crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl APEX Museum: {e}")
        raise

    return events_found, events_new, events_updated
