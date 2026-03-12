"""
Crawler for Mercedes-Benz Stadium (mercedesbenzstadium.com).

Site uses JavaScript rendering - must use Playwright.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime
from typing import Optional

import requests
from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright

from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash
from utils import extract_images_from_page, extract_event_links, find_event_url, enrich_event_record

logger = logging.getLogger(__name__)

BASE_URL = "https://mercedesbenzstadium.com"
EVENTS_URL = f"{BASE_URL}/events"

VENUE_DATA = {
    "name": "Mercedes-Benz Stadium",
    "slug": "mercedes-benz-stadium",
    "address": "1 AMB Drive NW",
    "neighborhood": "Downtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30313",
    "lat": 33.7553,
    "lng": -84.4006,
    "venue_type": "stadium",
    "spot_type": "stadium",
    "website": BASE_URL,
    "vibes": ["sports", "landmark", "tours-available", "downtown", "world-class"],
    "description": (
        "Mercedes-Benz Stadium is the home of the Atlanta Falcons (NFL) and Atlanta United FC (MLS), "
        "and one of the most acclaimed sports and entertainment venues in the world. The stadium "
        "features a retractable roof, a 360-degree halo video board, and hosts major events including "
        "Super Bowls, College Football Playoff games, MLS Cup, soccer internationals, concerts, and "
        "college football. Tours available on non-event days."
    ),
}


def parse_time(time_text: str) -> Optional[str]:
    """Parse time from '7:00 PM' format."""
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


def should_skip_official_match(title: str) -> bool:
    lowered = title.lower()
    if lowered.startswith("atlanta united") and (" vs " in lowered or " vs." in lowered):
        return True
    if lowered.startswith("usmnt vs"):
        return True
    if lowered.startswith("18th match - usmnt"):
        return True
    return False


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Mercedes-Benz Stadium events using Playwright."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        # Fetch og:image from homepage to enrich venue record
        venue_data = dict(VENUE_DATA)
        try:
            _headers = {
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
            }
            _home_resp = requests.get(BASE_URL, headers=_headers, timeout=15)
            if _home_resp.status_code == 200:
                _home_soup = BeautifulSoup(_home_resp.text, "html.parser")
                _og_image = _home_soup.find("meta", attrs={"property": "og:image"})
                if _og_image and _og_image.get("content"):
                    venue_data["image_url"] = _og_image["content"]
                    logger.debug("Fetched og:image for Mercedes-Benz Stadium")
        except Exception as _e:
            logger.debug(f"Could not fetch og:image for Mercedes-Benz Stadium: {_e}")

        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
                viewport={"width": 1920, "height": 1080},
            )
            page = context.new_page()

            venue_id = get_or_create_venue(venue_data)

            logger.info(f"Fetching Mercedes-Benz Stadium: {EVENTS_URL}")
            page.goto(EVENTS_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(3000)

            # Extract images from page
            image_map = extract_images_from_page(page)

            # Extract event links for specific URLs
            event_links = extract_event_links(page, BASE_URL)

            # Scroll to load all content
            for _ in range(5):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1000)

            # Get page text and parse line by line
            body_text = page.inner_text("body")
            lines = [l.strip() for l in body_text.split("\n") if l.strip()]

            # Parse events - look for date patterns
            i = 0
            while i < len(lines):
                line = lines[i]

                # Skip navigation items
                if len(line) < 3:
                    i += 1
                    continue

                # Look for date patterns
                date_match = re.match(
                    r"(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)?,?\s*(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})(?:,?\s+(\d{4}))?",
                    line,
                    re.IGNORECASE
                )

                if date_match:
                    month = date_match.group(1)
                    day = date_match.group(2)
                    year = date_match.group(3) if date_match.group(3) else str(datetime.now().year)

                    # Look for title in surrounding lines
                    title = None
                    start_time = None

                    for offset in [-2, -1, 1, 2, 3]:
                        idx = i + offset
                        if 0 <= idx < len(lines):
                            check_line = lines[idx]
                            if re.match(r"(January|February|March)", check_line, re.IGNORECASE):
                                continue
                            if not start_time:
                                time_result = parse_time(check_line)
                                if time_result:
                                    start_time = time_result
                                    continue
                            if not title and len(check_line) > 5:
                                if not re.match(r"\d{1,2}[:/]", check_line):
                                    if not re.match(r"(free|tickets|register|\$|more info)", check_line.lower()):
                                        title = check_line
                                        break

                    if not title:
                        i += 1
                        continue

                    if should_skip_official_match(title):
                        i += 1
                        continue

                    # Parse date
                    try:
                        month_str = month[:3] if len(month) > 3 else month
                        dt = datetime.strptime(f"{month_str} {day} {year}", "%b %d %Y")
                        if dt.date() < datetime.now().date():
                            dt = datetime.strptime(f"{month_str} {day} {int(year) + 1}", "%b %d %Y")
                        start_date = dt.strftime("%Y-%m-%d")
                    except ValueError:
                        i += 1
                        continue

                    events_found += 1

                    content_hash = generate_content_hash(title, "Mercedes-Benz Stadium", start_date)


                    # Get specific event URL


                    event_url = find_event_url(title, event_links, EVENTS_URL)



                    event_record = {
                        "source_id": source_id,
                        "venue_id": venue_id,
                        "title": title,
                        "description": None,
                        "start_date": start_date,
                        "start_time": start_time,
                        "end_date": None,
                        "end_time": None,
                        "is_all_day": False,
                        "category": "community",
                        "subcategory": None,
                        "tags": ["event"],
                        "price_min": None,
                        "price_max": None,
                        "price_note": None,
                        "is_free": None,
                        "source_url": event_url,
                        "ticket_url": event_url,
                        "image_url": image_map.get(title),
                        "raw_text": f"{title} - {start_date}",
                        "extraction_confidence": 0.80,
                        "is_recurring": False,
                        "recurrence_rule": None,
                        "content_hash": content_hash,
                    }

                    # Enrich from detail page
                    enrich_event_record(event_record, source_name="Mercedes-Benz Stadium")

                    # Determine is_free if still unknown after enrichment
                    if event_record.get("is_free") is None:
                        desc_lower = (event_record.get("description") or "").lower()
                        title_lower = event_record.get("title", "").lower()
                        combined = f"{title_lower} {desc_lower}"
                        if any(kw in combined for kw in ["free", "no cost", "no charge", "complimentary"]):
                            event_record["is_free"] = True
                            event_record["price_min"] = event_record.get("price_min") or 0
                            event_record["price_max"] = event_record.get("price_max") or 0
                        else:
                            event_record["is_free"] = False

                    existing = find_event_by_hash(content_hash)
                    if existing:
                        smart_update_existing_event(existing, event_record)
                        events_updated += 1
                        i += 1
                        continue

                    try:
                        insert_event(event_record)
                        events_new += 1
                        logger.info(f"Added: {title} on {start_date}")
                    except Exception as e:
                        logger.error(f"Failed to insert: {title}: {e}")

                i += 1

            browser.close()

        logger.info(
            f"Mercedes-Benz Stadium crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Mercedes-Benz Stadium: {e}")
        raise

    return events_found, events_new, events_updated
