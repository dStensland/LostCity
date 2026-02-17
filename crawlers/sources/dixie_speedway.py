"""
Crawler for Dixie Speedway (theredclayatwoodstock.com).

Venue hosts demolition derbies, monster truck shows, and dirt track racing.
Site uses WordPress with static HTML table - requires Playwright for full rendering.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime
from typing import Optional

from playwright.sync_api import sync_playwright
from bs4 import BeautifulSoup

from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://www.theredclayatwoodstock.com"
EVENTS_URL = f"{BASE_URL}/events/"

VENUE_DATA = {
    "name": "Dixie Speedway",
    "slug": "dixie-speedway",
    "address": "150 Dixie Dr",
    "neighborhood": "Woodstock",
    "city": "Woodstock",
    "state": "GA",
    "zip": "30188",
    "lat": 34.0987,
    "lng": -84.5143,
    "venue_type": "arena",
    "spot_type": "arena",
    "website": BASE_URL,
}


def parse_time(time_text: str) -> Optional[str]:
    """Parse time from various formats like '7:00 PM', '7 PM', '7pm'."""
    match = re.search(r"(\d{1,2})(?::(\d{2}))?\s*(am|pm)", time_text, re.IGNORECASE)
    if match:
        hour = int(match.group(1))
        minute = match.group(2) if match.group(2) else "00"
        period = match.group(3).lower()

        if period == "pm" and hour != 12:
            hour += 12
        elif period == "am" and hour == 12:
            hour = 0

        return f"{hour:02d}:{minute}"
    return None


def parse_price(price_text: str) -> tuple[Optional[float], Optional[float]]:
    """Extract min/max prices from text, focusing on main ticket prices."""
    # Look for Grandstand Ticket price (main admission)
    grandstand_match = re.search(r"Grandstand Ticket:\s*\$(\d+)", price_text)
    if grandstand_match:
        base_price = float(grandstand_match.group(1))

        # Also check for Tailgate and Pit prices
        all_prices = [base_price]

        tailgate_match = re.search(r"Tailgate Tickets?:\s*\$(\d+)", price_text)
        if tailgate_match:
            all_prices.append(float(tailgate_match.group(1)))

        pit_match = re.search(r"Pit Pass:\s*\$(\d+)", price_text)
        if pit_match:
            all_prices.append(float(pit_match.group(1)))

        return min(all_prices), max(all_prices)

    # Check if it's explicitly free
    if re.search(r"Grandstand Ticket:\s*FREE", price_text, re.IGNORECASE):
        return 0.0, 0.0

    return None, None


def categorize_event(title: str, description: str = "") -> tuple[str, Optional[str], list[str]]:
    """
    Determine category, subcategory, and tags based on event title and description.

    Returns:
        (category, subcategory, tags)
    """
    title_lower = title.lower()
    desc_lower = description.lower()
    combined = f"{title_lower} {desc_lower}"

    # Demolition Derby
    if any(term in combined for term in ["demo derby", "demolition derby", "demo-derby"]):
        return "sports", "demolition_derby", [
            "demo-derby", "demolition-derby", "motorsports", "woodstock", "dirt-track"
        ]

    # Monster Trucks
    if any(term in combined for term in ["monster truck", "truckfest", "truck show"]):
        return "sports", "monster_trucks", [
            "monster-trucks", "motorsports", "woodstock", "dirt-track"
        ]

    # Default to dirt track racing
    return "sports", "racing", [
        "dirt-track", "racing", "motorsports", "woodstock", "stock-car"
    ]


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Dixie Speedway events using Playwright."""
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

            logger.info(f"Fetching Dixie Speedway: {EVENTS_URL}")
            page.goto(EVENTS_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(2000)

            # Get HTML and parse with BeautifulSoup
            html = page.content()
            browser.close()

            soup = BeautifulSoup(html, "html.parser")

            # Find the events table
            tables = soup.find_all("table")
            if not tables:
                logger.warning("No tables found on page")
                return events_found, events_new, events_updated

            # Parse the first table (should be the events table)
            event_table = tables[0]
            rows = event_table.find_all("tr")

            # Skip header row
            for row in rows[1:]:
                cells = row.find_all("td")
                if len(cells) < 3:
                    continue

                # Extract date/time
                date_cell = cells[0]
                date_text = date_cell.get_text(strip=True)

                # Extract event info
                event_cell = cells[1]
                event_link = event_cell.find("a")
                title = event_link.get_text(strip=True) if event_link else event_cell.get_text(strip=True)
                source_url = event_link.get("href") if event_link else EVENTS_URL

                # Extract image
                img = event_cell.find("img", class_="wp-post-image")
                image_url = img.get("src") if img else None

                # Extract tickets/time info
                tickets_cell = cells[2]
                tickets_text = tickets_cell.get_text(strip=True)

                # Parse date - format is like "Saturday, March 28"
                date_match = re.search(
                    r"(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s+"
                    r"(January|February|March|April|May|June|July|August|September|October|November|December)\s+"
                    r"(\d{1,2})",
                    date_text,
                    re.IGNORECASE
                )

                if not date_match:
                    logger.debug(f"Could not parse date from: {date_text}")
                    continue

                month = date_match.group(2)
                day = date_match.group(3)

                # Infer year - if month has passed this year, assume next year
                current_date = datetime.now()
                try:
                    dt = datetime.strptime(f"{month} {day} {current_date.year}", "%B %d %Y")
                    if dt.date() < current_date.date():
                        dt = datetime.strptime(f"{month} {day} {current_date.year + 1}", "%B %d %Y")
                    start_date = dt.strftime("%Y-%m-%d")
                except ValueError:
                    logger.debug(f"Could not parse date: {month} {day}")
                    continue

                # Parse start time from tickets cell
                start_time = None
                if "Racing Starts:" in tickets_text:
                    time_match = re.search(r"Racing Starts:\s*([^\n]+)", tickets_text)
                    if time_match:
                        start_time = parse_time(time_match.group(1))
                elif "Gates:" in tickets_text:
                    # Try to get grandstand gates time as fallback
                    time_match = re.search(r"Grandstand Gates:\s*([^\n]+)", tickets_text)
                    if time_match:
                        start_time = parse_time(time_match.group(1))

                # Parse pricing
                price_min, price_max = parse_price(tickets_text)
                is_free = price_min == 0.0 and price_max == 0.0

                # Skip if no title
                if not title or len(title) < 3:
                    continue

                events_found += 1

                # Generate content hash for deduplication
                content_hash = generate_content_hash(title, "Dixie Speedway", start_date)


                # Categorize the event
                category, subcategory, tags = categorize_event(title, "")

                event_record = {
                    "source_id": source_id,
                    "venue_id": venue_id,
                    "title": title,
                    "description": f"Event at Dixie Speedway - {title}",
                    "start_date": start_date,
                    "start_time": start_time,
                    "end_date": None,
                    "end_time": None,
                    "is_all_day": False,
                    "category": category,
                    "subcategory": subcategory,
                    "tags": tags,
                    "price_min": price_min,
                    "price_max": price_max,
                    "price_note": None,
                    "is_free": is_free,
                    "source_url": source_url,
                    "ticket_url": source_url,
                    "image_url": image_url,
                    "raw_text": f"{title} - {date_text} - {tickets_text[:200]}",
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
                    logger.error(f"Failed to insert: {title}: {e}")

        logger.info(
            f"Dixie Speedway crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Dixie Speedway: {e}")
        raise

    return events_found, events_new, events_updated
