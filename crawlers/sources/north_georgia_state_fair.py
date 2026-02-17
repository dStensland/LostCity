"""
Crawler for North Georgia State Fair (northgeorgiastatefair.com).

Annual fair in Marietta featuring demolition derby, monster trucks, rides, and concerts.
Site uses Wix platform - requires Playwright for JavaScript rendering.
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

BASE_URL = "https://www.northgeorgiastatefair.com"

VENUE_DATA = {
    "name": "North Georgia State Fair",
    "slug": "north-georgia-state-fair",
    "address": "2245 Callaway Rd SW",
    "neighborhood": "Marietta",
    "city": "Marietta",
    "state": "GA",
    "zip": "30008",
    "lat": 33.9271,
    "lng": -84.5868,
    "venue_type": "event_space",
    "spot_type": "event_space",
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
            "north-georgia-state-fair", "fair", "marietta", "demo-derby",
            "demolition-derby", "motorsports"
        ]

    # Monster Trucks
    if any(term in combined for term in ["monster truck", "truckfest", "truck show"]):
        return "sports", "monster_trucks", [
            "north-georgia-state-fair", "fair", "marietta", "monster-trucks",
            "motorsports"
        ]

    # Concert/Music
    if any(term in combined for term in ["concert", "live music", "band", "performance"]):
        return "music", "concert", [
            "north-georgia-state-fair", "fair", "marietta", "concert", "live-music"
        ]

    # Default to family fair event
    return "family", "fair", [
        "north-georgia-state-fair", "fair", "marietta", "family", "rides"
    ]


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl North Georgia State Fair events using Playwright."""
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

            # Try BigTickets first for structured event data
            bigtickets_url = "https://www.bigtickets.com/e/northgeorgiastatefair/"
            logger.info(f"Checking BigTickets: {bigtickets_url}")

            try:
                page.goto(bigtickets_url, wait_until="domcontentloaded", timeout=30000)
                page.wait_for_timeout(3000)

                html = page.content()
                soup = BeautifulSoup(html, "html.parser")

                # Look for event listings on BigTickets
                event_links = soup.find_all("a", href=re.compile(r"/events/"))

                for link in event_links:
                    title = link.get_text(strip=True)

                    # Skip navigation/header items
                    if not title or len(title) < 5:
                        continue
                    if any(skip in title.lower() for skip in ["buy tickets", "view all", "more events"]):
                        continue

                    event_url = link.get("href")
                    if event_url and not event_url.startswith("http"):
                        event_url = f"https://www.bigtickets.com{event_url}"

                    # Try to find date information near the link
                    parent = link.find_parent()
                    date_text = parent.get_text() if parent else ""

                    # Look for date patterns
                    date_match = re.search(
                        r"(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\.?\s+(\d{1,2})(?:,?\s+(\d{4}))?",
                        date_text,
                        re.IGNORECASE
                    )

                    if date_match:
                        month = date_match.group(1)
                        day = date_match.group(2)
                        year = date_match.group(3) if date_match.group(3) else str(datetime.now().year)

                        try:
                            # Convert month name to number
                            month_map = {
                                "jan": 1, "january": 1,
                                "feb": 2, "february": 2,
                                "mar": 3, "march": 3,
                                "apr": 4, "april": 4,
                                "may": 5,
                                "jun": 6, "june": 6,
                                "jul": 7, "july": 7,
                                "aug": 8, "august": 8,
                                "sep": 9, "september": 9,
                                "oct": 10, "october": 10,
                                "nov": 11, "november": 11,
                                "dec": 12, "december": 12,
                            }
                            month_num = month_map.get(month.lower()[:3])
                            dt = datetime(int(year), month_num, int(day))

                            # If date is in the past, assume next year
                            if dt.date() < datetime.now().date():
                                dt = datetime(int(year) + 1, month_num, int(day))

                            start_date = dt.strftime("%Y-%m-%d")

                        except (ValueError, KeyError):
                            logger.debug(f"Could not parse date: {month} {day} {year}")
                            continue

                        # Parse time if present
                        start_time = parse_time(date_text)

                        events_found += 1

                        # Generate content hash for deduplication
                        content_hash = generate_content_hash(title, "North Georgia State Fair", start_date)


                        # Categorize the event
                        category, subcategory, tags = categorize_event(title, "")

                        event_record = {
                            "source_id": source_id,
                            "venue_id": venue_id,
                            "title": title,
                            "description": f"Event at North Georgia State Fair - {title}",
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
                            "is_free": False,
                            "source_url": event_url if event_url else bigtickets_url,
                            "ticket_url": event_url if event_url else bigtickets_url,
                            "image_url": None,
                            "raw_text": f"{title} - {date_text[:200]}",
                            "extraction_confidence": 0.75,
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
                logger.warning(f"BigTickets fetch failed: {e}")

            # If no events found via BigTickets, try main site
            if events_found == 0:
                logger.info(f"Fetching main site: {BASE_URL}")
                page.goto(BASE_URL, wait_until="domcontentloaded", timeout=30000)
                page.wait_for_timeout(3000)

                # Scroll to load all content
                for _ in range(3):
                    page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                    page.wait_for_timeout(1000)

                html = page.content()
                soup = BeautifulSoup(html, "html.parser")

                # Look for schedule/dates section
                body_text = page.inner_text("body")

                # Try to find fair dates
                # Common pattern: "September 20-29, 2024" or similar
                date_range_match = re.search(
                    r"(September|Sept)\s+(\d{1,2})\s*[-–]\s*(\d{1,2})(?:,?\s+(\d{4}))?",
                    body_text,
                    re.IGNORECASE
                )

                if date_range_match:
                    month = "September"  # North Georgia State Fair is typically in September
                    start_day = int(date_range_match.group(2))
                    end_day = int(date_range_match.group(3))
                    year = date_range_match.group(4) if date_range_match.group(4) else str(datetime.now().year)

                    try:
                        # Create the fair event
                        start_dt = datetime(int(year), 9, start_day)
                        end_dt = datetime(int(year), 9, end_day)

                        # If dates are in the past, assume next year
                        if start_dt.date() < datetime.now().date():
                            start_dt = datetime(int(year) + 1, 9, start_day)
                            end_dt = datetime(int(year) + 1, 9, end_day)

                        start_date = start_dt.strftime("%Y-%m-%d")
                        end_date = end_dt.strftime("%Y-%m-%d")

                        title = "North Georgia State Fair"
                        events_found += 1

                        content_hash = generate_content_hash(title, "North Georgia State Fair", start_date)

                        if not find_event_by_hash(content_hash):
                            event_record = {
                                "source_id": source_id,
                                "venue_id": venue_id,
                                "title": title,
                                "description": "Annual state fair featuring rides, food, entertainment, demolition derby, monster trucks, and more at Jim R. Miller Park in Marietta.",
                                "start_date": start_date,
                                "start_time": None,
                                "end_date": end_date,
                                "end_time": None,
                                "is_all_day": True,
                                "category": "family",
                                "subcategory": "fair",
                                "tags": [
                                    "north-georgia-state-fair", "fair", "marietta", "family",
                                    "rides", "demolition-derby", "monster-trucks"
                                ],
                                "price_min": None,
                                "price_max": None,
                                "price_note": None,
                                "is_free": False,
                                "source_url": BASE_URL,
                                "ticket_url": BASE_URL,
                                "image_url": None,
                                "raw_text": f"{title} - {start_date} to {end_date}",
                                "extraction_confidence": 0.70,
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
                        else:
                            events_updated += 1

                    except ValueError as e:
                        logger.debug(f"Could not create fair dates: {e}")
                else:
                    logger.warning("Could not find fair date range on main site")

            browser.close()

        logger.info(
            f"North Georgia State Fair crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl North Georgia State Fair: {e}")
        raise

    return events_found, events_new, events_updated
