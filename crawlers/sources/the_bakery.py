"""
Crawler for The Bakery Atlanta (thebakeryatlanta.com).
DIY arts collective now operating out of The Supermarket ATL in Poncey-Highland.
Hosts live music (punk, indie, electronic), comedy, art shows, film screenings.

Uses Ticket Tailor for event listings — we scrape their public event widget.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime
from typing import Optional

from playwright.sync_api import sync_playwright

from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash
from utils import parse_price, extract_images_from_page

logger = logging.getLogger(__name__)

BASE_URL = "https://www.thebakeryatlanta.com"
EVENTS_URL = "https://www.thebakeryatlanta.com/events"
# Ticket Tailor public listing
TT_URL = "https://www.tickettailor.com/events/thebakeryatlanta"

VENUE_DATA = {
    "name": "The Bakery",
    "slug": "the-bakery-atl",
    "address": "638 N Highland Ave NE",
    "neighborhood": "Poncey-Highland",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30306",
    "lat": 33.7710,
    "lng": -84.3560,
    "venue_type": "music_venue",
    "spot_type": "music_venue",
    "website": BASE_URL,
    "vibes": ["diy", "underground", "experimental", "queer-friendly", "local-bands", "punk"],
}

MONTHS = {
    "jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6,
    "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12,
    "january": 1, "february": 2, "march": 3, "april": 4,
    "june": 6, "july": 7, "august": 8, "september": 9,
    "october": 10, "november": 11, "december": 12,
}


def parse_time(time_str: str) -> Optional[str]:
    """Parse time from various formats."""
    if not time_str:
        return None
    match = re.search(r"(\d{1,2}):?(\d{2})?\s*(am|pm)", time_str, re.IGNORECASE)
    if match:
        hour = int(match.group(1))
        minute = int(match.group(2)) if match.group(2) else 0
        period = match.group(3).lower()
        if period == "pm" and hour != 12:
            hour += 12
        elif period == "am" and hour == 12:
            hour = 0
        return f"{hour:02d}:{minute:02d}"
    return None


def parse_date_text(text: str) -> Optional[str]:
    """Parse date from text like 'Sat 15 Feb 2026' or 'February 15, 2026'."""
    text = text.strip().lower()

    # "15 feb 2026" or "feb 15 2026" or "sat 15 feb 2026"
    m = re.search(
        r"(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+(\d{4})",
        text,
    )
    if m:
        day, month_str, year = int(m.group(1)), m.group(2)[:3], int(m.group(3))
        month = MONTHS.get(month_str)
        if month:
            try:
                return datetime(year, month, day).strftime("%Y-%m-%d")
            except ValueError:
                pass

    m = re.search(
        r"(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+(\d{1,2})\s*,?\s*(\d{4})",
        text,
    )
    if m:
        month_str, day, year = m.group(1)[:3], int(m.group(2)), int(m.group(3))
        month = MONTHS.get(month_str)
        if month:
            try:
                return datetime(year, month, day).strftime("%Y-%m-%d")
            except ValueError:
                pass

    return None


def determine_category(title: str) -> tuple[str, Optional[str], list[str]]:
    """Determine category based on event title."""
    title_lower = title.lower()
    tags = ["the-bakery", "diy", "poncey-highland"]

    if any(w in title_lower for w in ["comedy", "stand-up", "standup", "fresh produce"]):
        return "comedy", "standup", tags + ["comedy"]
    if any(w in title_lower for w in ["dj", "atl sync", "techno", "house", "electronic"]):
        return "nightlife", "club", tags + ["electronic", "dj"]
    if any(w in title_lower for w in ["film", "screening", "movie", "lavender lens"]):
        return "film", None, tags + ["screening"]
    if any(w in title_lower for w in ["art", "gallery", "exhibition", "opening"]):
        return "arts", "visual", tags + ["gallery"]
    if any(w in title_lower for w in ["workshop", "class", "café"]):
        return "workshop", None, tags + ["workshop"]
    if any(w in title_lower for w in ["variety", "super cozy", "burlesque", "poetry"]):
        return "performing_arts", "variety", tags + ["variety"]

    return "music", "live", tags + ["live-music"]


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl The Bakery events via Ticket Tailor."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        venue_id = get_or_create_venue(VENUE_DATA)

        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
                viewport={"width": 1920, "height": 1080},
            )
            page = context.new_page()

            # Try Ticket Tailor first, fall back to main site
            loaded = False
            for url in [TT_URL, EVENTS_URL]:
                try:
                    logger.info(f"Trying: {url}")
                    page.goto(url, wait_until="domcontentloaded", timeout=20000)
                    page.wait_for_timeout(3000)
                    loaded = True
                    break
                except Exception as e:
                    logger.debug(f"Failed to load {url}: {e}")
                    continue

            if not loaded:
                browser.close()
                logger.warning("Could not load any Bakery events page")
                return 0, 0, 0

            # Scroll to load all events
            for _ in range(5):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1000)

            # Extract image map for event images
            image_map = extract_images_from_page(page)

            body_text = page.inner_text("body")
            html = page.content()

            browser.close()

        # Parse the page
        from bs4 import BeautifulSoup

        soup = BeautifulSoup(html, "html.parser")

        # Strategy 1: Ticket Tailor event cards
        # TT uses .event-listing or similar structures
        event_cards = soup.select("[class*='event']")

        # Strategy 2: Parse from text if no structured cards
        # Ticket Tailor pages have event blocks with title, date, price
        lines = [l.strip() for l in body_text.split("\n") if l.strip()]

        # Look for event patterns in the text
        i = 0
        while i < len(lines):
            line = lines[i]

            # Try to find a date line
            date_str = parse_date_text(line)
            if date_str:
                try:
                    date_obj = datetime.strptime(date_str, "%Y-%m-%d")
                except ValueError:
                    i += 1
                    continue

                if date_obj.date() < datetime.now().date():
                    i += 1
                    continue

                # Look backwards/forwards for a title
                title = None
                start_time = None
                price_text = None

                # Check previous lines for title
                for back in range(1, 4):
                    if i - back >= 0:
                        candidate = lines[i - back].strip()
                        if (
                            len(candidate) > 3
                            and not parse_date_text(candidate)
                            and not re.match(r"^\$", candidate)
                            and candidate.lower() not in ("events", "upcoming", "past", "all events")
                        ):
                            title = candidate
                            break

                # Check forward lines for time and price
                for fwd in range(1, 5):
                    if i + fwd < len(lines):
                        fwd_line = lines[i + fwd]
                        if not start_time:
                            t = parse_time(fwd_line)
                            if t:
                                start_time = t
                        if not price_text and "$" in fwd_line:
                            price_text = fwd_line

                if not title:
                    i += 1
                    continue

                events_found += 1

                if not start_time:
                    start_time = "20:00"

                content_hash = generate_content_hash(title, "The Bakery", date_str)

                category, subcategory, tags = determine_category(title)

                price_min, price_max, price_note = None, None, None
                is_free = False
                if price_text:
                    price_min, price_max, price_note = parse_price(price_text)
                    if price_min == 0:
                        is_free = True

                # Find image by title match
                event_image = None
                title_lower = title.lower()
                for img_alt, img_url in image_map.items():
                    if img_alt.lower() == title_lower or title_lower in img_alt.lower() or img_alt.lower() in title_lower:
                        event_image = img_url
                        break

                event_record = {
                    "source_id": source_id,
                    "venue_id": venue_id,
                    "title": title,
                    "description": None,
                    "start_date": date_str,
                    "start_time": start_time,
                    "end_date": None,
                    "end_time": None,
                    "is_all_day": False,
                    "category": category,
                    "subcategory": subcategory,
                    "tags": tags,
                    "price_min": price_min,
                    "price_max": price_max,
                    "price_note": price_note,
                    "is_free": is_free,
                    "source_url": EVENTS_URL,
                    "ticket_url": TT_URL,
                    "image_url": event_image,
                    "raw_text": f"{title} - {date_str}",
                    "extraction_confidence": 0.75,
                    "is_recurring": False,
                    "recurrence_rule": None,
                    "content_hash": content_hash,
                }

                existing = find_event_by_hash(content_hash)
                if existing:
                    smart_update_existing_event(existing, event_record)
                    events_updated += 1
                    i += 1
                    continue

                try:
                    insert_event(event_record)
                    events_new += 1
                    logger.info(f"Added: {title} on {date_str} at {start_time}")
                except Exception as e:
                    logger.error(f"Failed to insert: {title}: {e}")

            i += 1

        logger.info(f"The Bakery crawl complete: {events_found} found, {events_new} new, {events_updated} updated")

    except Exception as e:
        logger.error(f"Failed to crawl The Bakery: {e}")
        raise

    return events_found, events_new, events_updated
