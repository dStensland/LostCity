"""
Crawler for Wren's Nest House Museum (wrensnest.org/calendar).
Historic home of Joel Chandler Harris, author of Uncle Remus stories.
Events include storytelling, tours, family programs, and cultural events.
"""

from __future__ import annotations

import logging
import re
from datetime import datetime
from typing import Optional

from playwright.sync_api import sync_playwright

from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash
from utils import extract_images_from_page

logger = logging.getLogger(__name__)

BASE_URL = "https://www.wrensnest.org"
CALENDAR_URL = f"{BASE_URL}/calendar"

VENUE_DATA = {
    "name": "Wren's Nest House Museum",
    "slug": "wrens-nest",
    "address": "1050 Ralph David Abernathy Blvd SW",
    "neighborhood": "West End",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30310",
    "lat": 33.7397,
    "lng": -84.4158,
    "venue_type": "museum",
    "spot_type": "museum",
    "website": BASE_URL,
}


def parse_squarespace_date(date_str: str) -> tuple[Optional[str], Optional[str]]:
    """
    Parse Squarespace event date formats.
    Examples:
    - "January 31, 2026"
    - "February 1, 2026 at 8:00pm"
    - "Jan 31 @ 9:00 AM - 11:00 AM"
    """
    try:
        current_year = datetime.now().year

        # Remove time portion if present
        date_part = re.split(r'\s+at\s+|\s+@\s+', date_str, flags=re.IGNORECASE)

        # Parse date
        date_text = date_part[0].strip()
        for fmt in ["%B %d, %Y", "%b %d, %Y", "%B %d %Y", "%b %d %Y"]:
            try:
                dt = datetime.strptime(date_text, fmt)
                date_str_result = dt.strftime("%Y-%m-%d")
                break
            except ValueError:
                continue
        else:
            # Try without year, add current or next year
            for fmt in ["%B %d", "%b %d"]:
                try:
                    dt = datetime.strptime(date_text, fmt)
                    dt = dt.replace(year=current_year)
                    if dt < datetime.now():
                        dt = dt.replace(year=current_year + 1)
                    date_str_result = dt.strftime("%Y-%m-%d")
                    break
                except ValueError:
                    continue
            else:
                return None, None

        # Parse time if present
        time_str_result = None
        if len(date_part) > 1:
            time_text = date_part[1].strip()
            # Match time patterns like "8:00pm", "9:00 AM", "8pm", "9:00 AM - 11:00 AM"
            time_match = re.search(r'(\d{1,2})(?::(\d{2}))?\s*(am|pm)', time_text, re.IGNORECASE)
            if time_match:
                hour = int(time_match.group(1))
                minute = int(time_match.group(2)) if time_match.group(2) else 0
                period = time_match.group(3).lower()

                if period == 'pm' and hour != 12:
                    hour += 12
                elif period == 'am' and hour == 12:
                    hour = 0

                time_str_result = f"{hour:02d}:{minute:02d}"

        return date_str_result, time_str_result

    except Exception as e:
        logger.debug(f"Failed to parse date '{date_str}': {e}")
        return None, None


def categorize_event(title: str, description: str) -> tuple[str, str, list[str]]:
    """Categorize Wren's Nest events based on title and description."""
    title_lower = (title + " " + (description or "")).lower()

    # Default tags that apply to most Wren's Nest events
    base_tags = ["historic", "educational"]

    # Storytelling events
    if any(w in title_lower for w in ["storytelling", "story time", "tales", "stories"]):
        tags = base_tags + ["storytelling", "family-friendly"]
        if any(w in title_lower for w in ["br'er rabbit", "uncle remus", "folk tales"]):
            tags.append("folklore")
        return "museums", "storytelling", tags

    # Tours
    if any(w in title_lower for w in ["tour", "guided tour", "house tour"]):
        tags = base_tags + ["tours", "history"]
        if "black history" in title_lower or "african american" in title_lower:
            tags.append("black-history-month")
        return "museums", "tour", tags

    # Family programs
    if any(w in title_lower for w in ["family", "kids", "children", "camp", "young"]):
        return "family", "kids_program", base_tags + ["family-friendly", "kids", "interactive"]

    # Black History Month events
    if "black history" in title_lower or (
        datetime.now().month == 2 and any(w in title_lower for w in ["heritage", "history", "celebration"])
    ):
        return "museums", "special_event", base_tags + ["black-history-month", "community", "heritage"]

    # Literary/Author events
    if any(w in title_lower for w in ["author", "book", "reading", "literature", "writing"]):
        return "museums", "book_event", base_tags + ["literary", "community", "authors"]

    # Music/Performance
    if any(w in title_lower for w in ["concert", "music", "performance", "jazz", "folk music"]):
        return "music", "live", base_tags + ["live-music", "cultural"]

    # Workshops/Classes
    if any(w in title_lower for w in ["workshop", "class", "learn", "craft"]):
        return "museums", "workshop", base_tags + ["hands-on", "educational"]

    # Special events & celebrations
    if any(w in title_lower for w in ["festival", "celebration", "party", "gala", "fundraiser"]):
        return "community", "special_event", base_tags + ["community", "celebration"]

    # Default to museums tour
    return "museums", "tour", base_tags + ["museum", "history"]


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Wren's Nest House Museum events."""
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

            logger.info(f"Fetching Wren's Nest calendar: {CALENDAR_URL}")
            page.goto(CALENDAR_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(3000)

            # Extract images from the page
            image_map = extract_images_from_page(page)

            # Scroll to load all events
            for _ in range(3):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1500)

            venue_id = get_or_create_venue(VENUE_DATA)

            # Wren's Nest uses .summary-item for their event listings
            event_items = page.query_selector_all(".summary-item")

            if not event_items:
                logger.info("No events found on page")
                browser.close()
                return events_found, events_new, events_updated

            logger.info(f"Found {len(event_items)} potential event items")

            # Collect event links from the calendar page
            event_links = []
            for item in event_items:
                try:
                    link_elem = item.query_selector("a[href*='/blog/']")
                    if not link_elem:
                        continue

                    href = link_elem.get_attribute("href")
                    if not href:
                        continue

                    # Make absolute URL
                    if not href.startswith("http"):
                        href = BASE_URL + href

                    # Get title hint from the item
                    title_elem = item.query_selector(".summary-title, h1, h2, h3")
                    title_hint = title_elem.inner_text().strip() if title_elem else ""

                    event_links.append({"url": href, "title_hint": title_hint})
                except Exception as e:
                    logger.debug(f"Failed to extract link from item: {e}")
                    continue

            logger.info(f"Found {len(event_links)} event URLs to process")

            current_year = datetime.now().year

            # Now visit each event page to get full details
            for event_data in event_links:
                try:
                    event_url = event_data["url"]
                    logger.debug(f"Processing event: {event_url}")

                    page.goto(event_url, wait_until="domcontentloaded", timeout=30000)
                    page.wait_for_timeout(1500)

                    # Extract title from the blog post
                    title_elem = page.query_selector("h1.blog-item-title, h1")
                    if not title_elem:
                        logger.debug(f"No title found for {event_url}")
                        continue
                    title = title_elem.inner_text().strip()

                    if not title or len(title) < 3:
                        continue

                    # Extract date from the time element
                    start_date = None
                    start_time = None

                    time_elem = page.query_selector("time.blog-meta-item--date, time")
                    if time_elem:
                        date_text = time_elem.inner_text().strip()

                        # Date format is like "Jan 6" - need to add year
                        # Try to extract year from URL (e.g., /blog/eventname/2026)
                        year_match = re.search(r'/(\d{4})/?$', event_url)
                        year = int(year_match.group(1)) if year_match else current_year

                        # Parse "Jan 6" or "January 15" format
                        try:
                            for fmt in ["%b %d", "%B %d"]:
                                try:
                                    dt = datetime.strptime(date_text, fmt)
                                    dt = dt.replace(year=year)
                                    start_date = dt.strftime("%Y-%m-%d")
                                    break
                                except ValueError:
                                    continue
                        except Exception as e:
                            logger.debug(f"Failed to parse date '{date_text}': {e}")

                    # If still no date, try to find it in page text
                    if not start_date:
                        page_text = page.inner_text("body")
                        # Look for full date formats
                        date_patterns = [
                            r'(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(\d{4})',
                            r'(\d{1,2})/(\d{1,2})/(\d{4})',
                        ]
                        for pattern in date_patterns:
                            match = re.search(pattern, page_text)
                            if match:
                                try:
                                    if '/' in pattern:
                                        month, day, year = match.groups()
                                        dt = datetime(int(year), int(month), int(day))
                                    else:
                                        month_name, day, year = match.groups()
                                        dt = datetime.strptime(f"{month_name} {day} {year}", "%B %d %Y")
                                    start_date = dt.strftime("%Y-%m-%d")
                                    break
                                except Exception:
                                    continue

                    if not start_date:
                        logger.debug(f"Could not determine date for: {title}")
                        continue

                    # Extract description from blog content
                    desc_elem = page.query_selector(".blog-item-content-wrapper, .blog-more-link, article p")
                    description = None
                    if desc_elem:
                        desc_text = desc_elem.inner_text().strip()
                        # Take first 500 chars as description
                        description = desc_text[:500] if len(desc_text) > 500 else desc_text

                    # Extract image
                    img_elem = page.query_selector(".blog-item-content-wrapper img, article img")
                    image_url = None
                    if img_elem:
                        image_url = (
                            img_elem.get_attribute("data-src") or
                            img_elem.get_attribute("src") or
                            img_elem.get_attribute("data-image")
                        )

                    # Fall back to image from the listing page
                    if not image_url and event_data["title_hint"] in image_map:
                        image_url = image_map[event_data["title_hint"]]

                    events_found += 1

                    content_hash = generate_content_hash(title, VENUE_DATA["name"], start_date)

                    # Categorize event
                    category, subcategory, tags = categorize_event(title, description or "")

                    # Add community tag for all Wren's Nest events
                    if "community" not in tags:
                        tags.append("community")

                    # Determine if free
                    is_free = False
                    if description:
                        desc_lower = description.lower()
                        if "free" in desc_lower or "no cost" in desc_lower or "complimentary" in desc_lower:
                            is_free = True

                    event_record = {
                        "source_id": source_id,
                        "venue_id": venue_id,
                        "title": title,
                        "description": description,
                        "start_date": start_date,
                        "start_time": start_time,
                        "end_date": None,
                        "end_time": None,
                        "is_all_day": False,
                        "category": category,
                        "subcategory": subcategory,
                        "tags": tags,
                        "price_min": None,
                        "price_max": None,
                        "price_note": None,
                        "is_free": is_free,
                        "source_url": event_url,
                        "ticket_url": event_url,
                        "image_url": image_url,
                        "raw_text": None,
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
                        logger.info(f"Added: {title} on {start_date}")
                    except Exception as e:
                        logger.error(f"Failed to insert {title}: {e}")

                except Exception as e:
                    logger.debug(f"Failed to process event {event_data.get('url')}: {e}")
                    continue

            browser.close()

        logger.info(
            f"Wren's Nest crawl complete: {events_found} found, {events_new} new"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Wren's Nest: {e}")
        raise

    return events_found, events_new, events_updated
