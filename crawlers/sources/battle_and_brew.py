"""
Crawler for Battle & Brew (battleandbrew.com).

Site uses JavaScript rendering with event cards - must use Playwright.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime
from typing import Optional

from playwright.sync_api import sync_playwright

from db import get_or_create_venue, insert_event, find_event_by_hash
from dedupe import generate_content_hash
from utils import extract_images_from_page

logger = logging.getLogger(__name__)

BASE_URL = "https://www.battleandbrew.com"
EVENTS_URL = f"{BASE_URL}/upcoming-events"

VENUE_DATA = {
    "name": "Battle & Brew",
    "slug": "battle-and-brew",
    "address": "5920 Roswell Rd",
    "neighborhood": "Sandy Springs",
    "city": "Sandy Springs",
    "state": "GA",
    "zip": "30328",
    "lat": 33.9240,
    "lng": -84.3562,
    "venue_type": "restaurant",
    "spot_type": "restaurant",
    "website": BASE_URL,
}


def parse_time(time_text: str) -> Optional[str]:
    """Parse time from '7:00 PM' or '7:30 PM - 10:30 PM' format."""
    match = re.search(r"(\d{1,2}):(\d{2})\s*(am|pm)", time_text, re.IGNORECASE)
    if match:
        hour, minute, period = match.groups()
        hour = int(hour)
        if period.lower() == "pm" and hour != 12:
            hour += 12
        elif period.lower() == "am" and hour == 12:
            hour = 0
        return f"{hour:02d}:{minute}"
    return None


def parse_date(date_text: str) -> Optional[str]:
    """Parse date from various formats like 'Tuesday, January 20, 2026'."""
    # Try full format: "Tuesday, January 20, 2026"
    match = re.search(
        r"(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s+"
        r"(January|February|March|April|May|June|July|August|September|October|November|December)\s+"
        r"(\d{1,2}),?\s+(\d{4})",
        date_text,
        re.IGNORECASE
    )
    if match:
        month, day, year = match.groups()
        try:
            dt = datetime.strptime(f"{month} {day} {year}", "%B %d %Y")
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            pass

    # Try shorter format: "Jan 20, 2026"
    match = re.search(
        r"(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2}),?\s+(\d{4})",
        date_text,
        re.IGNORECASE
    )
    if match:
        month, day, year = match.groups()
        try:
            dt = datetime.strptime(f"{month} {day} {year}", "%b %d %Y")
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            pass

    return None


def get_category_from_title(title: str) -> tuple[str, Optional[str]]:
    """Determine category based on event title."""
    title_lower = title.lower()

    if any(x in title_lower for x in ["trivia", "quiz"]):
        return "community", "trivia"
    elif any(x in title_lower for x in ["karaoke"]):
        return "nightlife", "karaoke"
    elif any(x in title_lower for x in ["d&d", "dungeons", "ttrpg", "rpg"]):
        return "community", "gaming"
    elif any(x in title_lower for x in ["mtg", "magic the gathering", "draft", "pokemon", "pokémon"]):
        return "community", "gaming"
    elif any(x in title_lower for x in ["mahjong", "board game"]):
        return "community", "gaming"
    elif any(x in title_lower for x in ["cosplay", "costume"]):
        return "community", "cosplay"
    elif any(x in title_lower for x in ["paint", "art", "craft"]):
        return "art", "workshop"
    elif any(x in title_lower for x in ["brunch", "mimosa"]):
        return "food_drink", None
    else:
        return "community", "gaming"


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Battle & Brew events using Playwright."""
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

            logger.info(f"Fetching Battle & Brew: {EVENTS_URL}")
            page.goto(EVENTS_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(4000)

            # Extract images from page
            image_map = extract_images_from_page(page)

            # Scroll to load all content
            for _ in range(3):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1000)

            # Find event cards - look for links that contain event details
            # Battle & Brew uses article or card elements for events
            event_links = page.query_selector_all("a[href*='/event/']")

            seen_events = set()

            for link in event_links:
                try:
                    href = link.get_attribute("href")
                    if not href or href in seen_events:
                        continue
                    seen_events.add(href)

                    # Get the parent container to find title and date
                    # Try to get text content from the card
                    parent = link.evaluate_handle("el => el.closest('article') || el.closest('[class*=\"event\"]') || el.parentElement.parentElement")
                    if not parent:
                        continue

                    card_text = parent.inner_text() if hasattr(parent, 'inner_text') else ""
                    if not card_text:
                        # Fallback: get text from the link itself and siblings
                        card_text = link.inner_text()

                    # Skip navigation/utility links
                    if not card_text or len(card_text) < 10:
                        continue
                    if card_text.strip().lower() in ["view event", "view event →", "all events"]:
                        continue

                    # Parse the card text
                    lines = [l.strip() for l in card_text.split("\n") if l.strip()]

                    title = None
                    start_date = None
                    start_time = None

                    for line in lines:
                        # Skip utility text
                        if line.lower() in ["view event", "view event →", "all events", "add to calendar"]:
                            continue
                        if re.match(r"^\(\d{3}\)", line):  # Phone numbers
                            continue

                        # Try to parse as date
                        if not start_date:
                            parsed_date = parse_date(line)
                            if parsed_date:
                                start_date = parsed_date
                                continue

                        # Try to parse time
                        if not start_time and re.search(r"\d{1,2}:\d{2}\s*(am|pm)", line, re.IGNORECASE):
                            start_time = parse_time(line)
                            continue

                        # Otherwise might be the title (first substantial text)
                        if not title and len(line) > 3 and not re.match(r"^\d", line):
                            title = line

                    if not title or not start_date:
                        continue

                    # Skip "Closed on Mondays" type entries
                    if "closed" in title.lower():
                        continue

                    events_found += 1

                    content_hash = generate_content_hash(title, "Battle & Brew", start_date)

                    if find_event_by_hash(content_hash):
                        events_updated += 1
                        continue

                    category, subcategory = get_category_from_title(title)

                    # Build event URL
                    event_url = href if href.startswith("http") else f"{BASE_URL}{href}"

                    event_record = {
                        "source_id": source_id,
                        "venue_id": venue_id,
                        "title": title,
                        "description": f"{title} at Battle & Brew - Atlanta's premier geek bar and restaurant.",
                        "start_date": start_date,
                        "start_time": start_time,
                        "end_date": None,
                        "end_time": None,
                        "is_all_day": False,
                        "category": category,
                        "subcategory": subcategory,
                        "tags": [
                            "battle-brew",
                            "gaming",
                            "barcade",
                            "sandy-springs",
                            "geek",
                        ],
                        "price_min": None,
                        "price_max": None,
                        "price_note": None,
                        "is_free": "free" in title.lower() or "50% off" in title.lower(),
                        "source_url": event_url,
                        "ticket_url": event_url,
                        "image_url": image_map.get(title),
                        "raw_text": f"{title} - {start_date}",
                        "extraction_confidence": 0.85,
                        "is_recurring": False,
                        "recurrence_rule": None,
                        "content_hash": content_hash,
                    }

                    try:
                        insert_event(event_record)
                        events_new += 1
                        logger.info(f"Added: {title} on {start_date}")
                    except Exception as e:
                        logger.error(f"Failed to insert: {title}: {e}")

                except Exception as e:
                    logger.debug(f"Error parsing event card: {e}")
                    continue

            browser.close()

        logger.info(
            f"Battle & Brew crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Battle & Brew: {e}")
        raise

    return events_found, events_new, events_updated
