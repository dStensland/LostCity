"""
Crawler for 529 (529atlanta.com).
East Atlanta Village music venue — punk, metal, indie, local bands.
WordPress site with calendar grid, BigTickets integration.

Uses Playwright since the calendar is JS-rendered via Beaver Builder.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime
from typing import Optional

from playwright.sync_api import sync_playwright

from db import get_or_create_venue, insert_event, find_event_by_hash
from dedupe import generate_content_hash
from utils import extract_images_from_page, extract_event_links, find_event_url, enrich_event_record, parse_price

logger = logging.getLogger(__name__)

BASE_URL = "https://529atlanta.com"
EVENTS_URL = "https://529atlanta.com"
CALENDAR_URL = f"{BASE_URL}/calendar/"

VENUE_DATA = {
    "name": "529",
    "slug": "529",
    "address": "529 Flat Shoals Ave SE",
    "neighborhood": "East Atlanta Village",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30316",
    "lat": 33.7410,
    "lng": -84.3420,
    "venue_type": "music_venue",
    "spot_type": "music_venue",
    "website": BASE_URL,
    "vibes": ["live-music", "punk", "metal", "indie", "east-atlanta", "dive-bar"],
}


def parse_date(date_text: str) -> Optional[str]:
    """Parse date from format like 'Saturday Feb 07, 2026'."""
    date_match = re.search(
        r"(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\s+"
        r"(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+"
        r"(\d{1,2})\s*,?\s*(\d{4})",
        date_text,
        re.IGNORECASE,
    )
    if not date_match:
        return None

    month_str = date_match.group(1)[:3].capitalize()
    day = date_match.group(2)
    year = date_match.group(3)

    try:
        dt = datetime.strptime(f"{month_str} {day} {year}", "%b %d %Y")
        return dt.strftime("%Y-%m-%d")
    except ValueError:
        return None


def parse_time(time_text: str) -> Optional[str]:
    """Parse time from '7:00 PM' or '7:30 pm doors' format."""
    match = re.search(r"(\d{1,2}):(\d{2})\s*(am|pm)", time_text, re.IGNORECASE)
    if match:
        hour, minute, period = int(match.group(1)), int(match.group(2)), match.group(3).lower()
        if period == "pm" and hour != 12:
            hour += 12
        elif period == "am" and hour == 12:
            hour = 0
        return f"{hour:02d}:{minute:02d}"
    return None


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl 529 events using Playwright with DOM selectors."""
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

            logger.info(f"Fetching 529: {EVENTS_URL}")
            page.goto(EVENTS_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(3000)

            # Scroll to load all content
            for _ in range(5):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1000)

            # Extract images for matching with events
            image_map = extract_images_from_page(page)
            event_links = extract_event_links(page, BASE_URL)

            # Try DOM selectors first
            event_cards = page.query_selector_all(".event-card, .event-card-condensed")
            logger.info(f"Found {len(event_cards)} event cards")

            for card in event_cards:
                try:
                    # Extract title from headliner or h3
                    title_element = card.query_selector(".headliner, h3")
                    if not title_element:
                        continue

                    title = title_element.inner_text().strip()
                    if not title:
                        continue

                    card_text = card.inner_text()

                    start_date = parse_date(card_text)
                    if not start_date:
                        continue

                    # Skip past events
                    try:
                        if datetime.strptime(start_date, "%Y-%m-%d").date() < datetime.now().date():
                            continue
                    except ValueError:
                        continue

                    start_time = parse_time(card_text)

                    # Extract ticket URL
                    ticket_url = None
                    links = card.query_selector_all("a")
                    for link in links:
                        href = link.get_attribute("href") or ""
                        link_text = (link.inner_text() or "").lower()
                        if "bigtickets" in href or "ticket" in link_text:
                            ticket_url = href if href.startswith("http") else BASE_URL + href
                            break

                    # Extract price from card text
                    price_min, price_max, price_note = None, None, None
                    is_free = False
                    price_match = re.search(r"\$\d+.*(?:ADV|DOS|door)", card_text, re.IGNORECASE)
                    if price_match:
                        price_min, price_max, price_note = parse_price(price_match.group())
                        if price_min == 0:
                            is_free = True

                    # Extract age restriction
                    age_match = re.search(r"(\d{2}\+)", card_text)
                    age_tag = age_match.group(1).lower() if age_match else None

                    # Extract opener/supporting acts
                    opener = None
                    opener_match = re.search(r"w/\s*(.+?)(?:\n|$)", card_text)
                    if opener_match:
                        opener = opener_match.group(1).strip()

                    events_found += 1

                    content_hash = generate_content_hash(title, "529", start_date)
                    if find_event_by_hash(content_hash):
                        events_updated += 1
                        continue

                    # Build description
                    description = None
                    if opener:
                        description = f"{title} w/ {opener}"

                    # Tags
                    tags = ["music", "concert", "529", "east-atlanta", "live-music"]
                    if age_tag:
                        tags.append(age_tag)

                    # Find image
                    event_image = image_map.get(title)
                    if not event_image:
                        title_lower = title.lower()
                        for img_title, img_url in image_map.items():
                            if img_title.lower() in title_lower or title_lower in img_title.lower():
                                event_image = img_url
                                break

                    event_url = find_event_url(title, event_links, EVENTS_URL)

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
                        "category": "music",
                        "subcategory": "concert",
                        "tags": tags,
                        "price_min": price_min,
                        "price_max": price_max,
                        "price_note": price_note,
                        "is_free": is_free,
                        "source_url": event_url,
                        "ticket_url": ticket_url or event_url,
                        "image_url": event_image,
                        "raw_text": card_text[:500],
                        "extraction_confidence": 0.85,
                        "is_recurring": False,
                        "recurrence_rule": None,
                        "content_hash": content_hash,
                    }

                    try:
                        enrich_event_record(event_record, "529")
                        insert_event(event_record)
                        events_new += 1
                        logger.info(f"Added: {title} on {start_date}")
                    except Exception as e:
                        logger.error(f"Failed to insert '{title}': {e}")

                except Exception as e:
                    logger.error(f"Error processing event card: {e}")
                    continue

            browser.close()

        logger.info(
            f"529 crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl 529: {e}")
        raise

    return events_found, events_new, events_updated
