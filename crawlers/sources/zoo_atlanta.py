"""
Crawler for Zoo Atlanta (zooatlanta.org).
Historic zoo in Grant Park with special events and programs.

Site uses JavaScript rendering - must use Playwright.
URL: /visit/events/
Format: Card-based layout with flip cards containing event details.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime
from typing import Optional

from playwright.sync_api import sync_playwright

from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://zooatlanta.org"
EVENTS_URL = f"{BASE_URL}/visit/events/"

VENUE_DATA = {
    "name": "Zoo Atlanta",
    "slug": "zoo-atlanta",
    "address": "800 Cherokee Ave SE",
    "neighborhood": "Grant Park",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30315",
    "lat": 33.7328,
    "lng": -84.3697,
    "venue_type": "zoo",
    "website": BASE_URL,
}


def extract_background_image_url(element) -> Optional[str]:
    """Extract URL from inline background-image style."""
    try:
        style = element.get_attribute("style")
        if style:
            match = re.search(r'url\(["\']?(.*?)["\']?\)', style)
            if match:
                url = match.group(1)
                # Make absolute if relative
                if url.startswith("/"):
                    return BASE_URL + url
                elif url.startswith("http"):
                    return url
    except Exception as e:
        logger.debug(f"Error extracting background image: {e}")
    return None


def parse_multi_dates(date_text: str) -> list[str]:
    """
    Parse date strings that may contain multiple dates.

    Examples:
    - "February 14 and 15" -> ["2026-02-14", "2026-02-15"]
    - "March 14, 2026" -> ["2026-03-14"]
    - "July 11, July 18 & July 25" -> ["2026-07-11", "2026-07-18", "2026-07-25"]
    - "October 17, 18, 24, 25 & 31" -> ["2026-10-17", "2026-10-18", ...]

    Returns:
        List of dates in YYYY-MM-DD format
    """
    dates = []
    date_text = date_text.strip()
    current_year = datetime.now().year

    # Pattern 1: "Month Day, Year" (single explicit date)
    match = re.match(r"^(\w+)\s+(\d{1,2}),?\s*(\d{4})$", date_text)
    if match:
        month, day, year = match.groups()
        try:
            dt = datetime.strptime(f"{month} {day} {year}", "%B %d %Y")
            return [dt.strftime("%Y-%m-%d")]
        except ValueError:
            pass

    # Pattern 2: "Month Day and Day" (e.g., "February 14 and 15")
    match = re.match(r"^(\w+)\s+(\d{1,2})\s+and\s+(\d{1,2})$", date_text)
    if match:
        month, day1, day2 = match.groups()
        year = current_year
        for day in [day1, day2]:
            try:
                dt = datetime.strptime(f"{month} {day} {year}", "%B %d %Y")
                if dt < datetime.now():
                    dt = dt.replace(year=year + 1)
                dates.append(dt.strftime("%Y-%m-%d"))
            except ValueError:
                continue
        if dates:
            return dates

    # Pattern 3: "Month Day, Day, Day..." (e.g., "October 17, 18, 24, 25 & 31")
    # Check this BEFORE the general "Month Day" pattern to catch the simpler case
    match = re.match(r"^(\w+)\s+([\d,\s&]+)$", date_text)
    if match:
        month = match.group(1)
        days_text = match.group(2)
        # Extract all numbers
        days = re.findall(r"\d+", days_text)
        year = current_year

        for day in days:
            try:
                dt = datetime.strptime(f"{month} {day} {year}", "%B %d %Y")
                if dt < datetime.now():
                    dt = dt.replace(year=year + 1)
                dates.append(dt.strftime("%Y-%m-%d"))
            except ValueError:
                continue

        if dates:
            return dates

    # Pattern 4: Multiple full dates with month repeated (e.g., "July 11, July 18 & July 25")
    # Extract all "Month Day" pairs
    month_day_pattern = r"(\w+)\s+(\d{1,2})"
    matches = re.findall(month_day_pattern, date_text)
    if matches and len(matches) > 1:  # Only use this if we found multiple month-day pairs
        year = current_year
        for month, day in matches:
            try:
                dt = datetime.strptime(f"{month} {day} {year}", "%B %d %Y")
                if dt < datetime.now():
                    dt = dt.replace(year=year + 1)
                dates.append(dt.strftime("%Y-%m-%d"))
            except ValueError:
                # Try abbreviated month
                try:
                    dt = datetime.strptime(f"{month} {day} {year}", "%b %d %Y")
                    if dt < datetime.now():
                        dt = dt.replace(year=year + 1)
                    dates.append(dt.strftime("%Y-%m-%d"))
                except ValueError:
                    continue

        if dates:
            return list(set(dates))  # Remove duplicates

    # Fallback: try to parse as single date without year
    match = re.match(r"^(\w+)\.?\s+(\d{1,2})$", date_text)
    if match:
        month, day = match.groups()
        year = current_year
        for fmt in ["%B %d", "%b %d"]:
            try:
                dt = datetime.strptime(f"{month} {day}", fmt)
                dt = dt.replace(year=year)
                if dt < datetime.now():
                    dt = dt.replace(year=year + 1)
                return [dt.strftime("%Y-%m-%d")]
            except ValueError:
                continue

    return dates


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Zoo Atlanta events using Playwright with CSS selectors."""
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

            logger.info(f"Fetching Zoo Atlanta: {EVENTS_URL}")
            page.goto(EVENTS_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(3000)

            # Scroll to load all content
            for _ in range(5):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1000)

            # Find all event cards using CSS selector
            event_cards = page.query_selector_all("div.event.card")
            logger.info(f"Found {len(event_cards)} event cards")

            seen_events = set()

            for card in event_cards:
                try:
                    # Extract title from h3 heading in the front of the card
                    title_elem = card.query_selector(".front .container h3[role='heading']")
                    if not title_elem:
                        continue

                    title = title_elem.inner_text().strip()
                    if not title or len(title) < 3:
                        continue

                    # Extract date from em tag in front container
                    date_elem = card.query_selector(".front .container em")
                    if not date_elem:
                        continue

                    date_text = date_elem.inner_text().strip()

                    # Parse potentially multiple dates
                    parsed_dates = parse_multi_dates(date_text)
                    if not parsed_dates:
                        logger.debug(f"Could not parse date from: {date_text}")
                        continue

                    # Extract description from back of card
                    description = None
                    desc_elems = card.query_selector_all(".back .back-content p")
                    if desc_elems and len(desc_elems) > 1:
                        # Second p tag contains description (first is date bold)
                        description = desc_elems[1].inner_text().strip()
                        if description and len(description) > 500:
                            description = description[:500]

                    # Extract image URL from background style
                    image_url = None
                    image_elem = card.query_selector("div.featured-image[role='img']")
                    if image_elem:
                        image_url = extract_background_image_url(image_elem)

                    # Extract event URL from "Read More" link
                    event_url = EVENTS_URL
                    link_elem = card.query_selector("a.read-more")
                    if link_elem:
                        href = link_elem.get_attribute("href")
                        if href:
                            if href.startswith("http"):
                                event_url = href
                            elif href.startswith("/"):
                                event_url = BASE_URL + href

                    # Determine category based on title
                    title_lower = title.lower()
                    if any(w in title_lower for w in ["brew", "sip", "night out"]):
                        category = "food_drink"
                        subcategory = "beer"
                        tags = ["zoo-atlanta", "grant-park", "adults-only", "21+"]
                    elif any(w in title_lower for w in ["run", "5k", "race"]):
                        category = "fitness"
                        subcategory = "running"
                        tags = ["zoo-atlanta", "grant-park", "fitness", "running"]
                    elif any(w in title_lower for w in ["gala", "beastly"]):
                        category = "community"
                        subcategory = "fundraiser"
                        tags = ["zoo-atlanta", "grant-park", "gala", "fundraiser"]
                    elif any(w in title_lower for w in ["educator", "teacher"]):
                        category = "community"
                        subcategory = "education"
                        tags = ["zoo-atlanta", "grant-park", "education", "teachers"]
                    elif any(w in title_lower for w in ["science", "bird"]):
                        category = "community"
                        subcategory = "education"
                        tags = ["zoo-atlanta", "grant-park", "science", "family"]
                    elif any(w in title_lower for w in ["illuminights", "lights"]):
                        category = "family"
                        subcategory = "holiday"
                        tags = ["zoo-atlanta", "grant-park", "holiday", "lights", "family"]
                        is_all_day = True
                    else:
                        category = "family"
                        subcategory = "zoo"
                        tags = ["zoo-atlanta", "grant-park", "family", "zoo", "animals"]

                    # Determine if genuinely all-day
                    # Only multi-day festivals and illuminights are all-day
                    is_all_day = (
                        "illuminights" in title_lower or
                        "festival" in title_lower or
                        len(parsed_dates) > 3  # Multi-day events with many dates
                    )

                    # Create an event for each parsed date
                    for start_date in parsed_dates:
                        # Check for duplicates
                        event_key = f"{title}|{start_date}"
                        if event_key in seen_events:
                            continue
                        seen_events.add(event_key)

                        events_found += 1

                        # Generate content hash
                        content_hash = generate_content_hash(title, "Zoo Atlanta", start_date)

                        # Check for existing

                        event_record = {
                            "source_id": source_id,
                            "venue_id": venue_id,
                            "title": title,
                            "description": description,
                            "start_date": start_date,
                            "start_time": None,
                            "end_date": None,
                            "end_time": None,
                            "is_all_day": is_all_day,
                            "category": category,
                            "subcategory": subcategory,
                            "tags": tags,
                            "price_min": None,
                            "price_max": None,
                            "price_note": "May require separate ticket",
                            "is_free": False,
                            "source_url": event_url,
                            "ticket_url": event_url,
                            "image_url": image_url,
                            "raw_text": f"{title} - {date_text}",
                            "extraction_confidence": 0.90,
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
                    logger.warning(f"Error parsing event card: {e}")
                    continue

            browser.close()

        logger.info(
            f"Zoo Atlanta crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Zoo Atlanta: {e}")
        raise

    return events_found, events_new, events_updated
