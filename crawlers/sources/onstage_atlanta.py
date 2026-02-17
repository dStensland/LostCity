"""
Crawler for OnStage Atlanta.
Community theater with plays and musicals.

Site uses JavaScript rendering - must use Playwright.
Parses show schedule format: "February 6 - 22, 2026" with day/time info.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime, timedelta
from typing import Optional

from playwright.sync_api import sync_playwright

from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash
from utils import extract_images_from_page, extract_event_links, find_event_url

logger = logging.getLogger(__name__)

BASE_URL = "https://www.onstageatlanta.com"
EVENTS_URL = BASE_URL

VENUE_DATA = {
    "name": "OnStage Atlanta",
    "slug": "onstage-atlanta",
    "address": "3041 North Decatur Rd",
    "neighborhood": "Scottdale",
    "city": "Scottdale",
    "state": "GA",
    "zip": "30079",
    "venue_type": "theater",
    "website": BASE_URL,
}


def parse_date_range(text: str) -> tuple[Optional[datetime], Optional[datetime]]:
    """Parse date ranges like 'February 6 - 22, 2026' or 'February 6-22, 2026'."""
    patterns = [
        # February 6 - 22, 2026
        r"(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})\s*[-–]\s*(\d{1,2}),?\s*(\d{4})",
        # Feb 6-22, 2026
        r"(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})\s*[-–]\s*(\d{1,2}),?\s*(\d{4})",
    ]

    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            month_str = match.group(1)[:3]
            start_day = int(match.group(2))
            end_day = int(match.group(3))
            year = int(match.group(4))

            try:
                start_date = datetime.strptime(f"{month_str} {start_day} {year}", "%b %d %Y")
                end_date = datetime.strptime(f"{month_str} {end_day} {year}", "%b %d %Y")
                return start_date, end_date
            except ValueError:
                continue

    return None, None


def get_performance_dates(start_date: datetime, end_date: datetime, schedule_text: str) -> list[tuple[datetime, str]]:
    """Generate individual performance dates based on schedule like 'Friday & Saturday at 8:00 pm, Sunday at 3:00 pm'."""
    performances = []

    # Parse day/time mappings
    day_times = {}

    # Friday, & Saturday at 8:00 pm
    fri_sat_match = re.search(r"Friday.*?Saturday.*?(\d{1,2}):(\d{2})\s*(pm|am)", schedule_text, re.IGNORECASE)
    if fri_sat_match:
        hour = int(fri_sat_match.group(1))
        minute = fri_sat_match.group(2)
        period = fri_sat_match.group(3).lower()
        if period == "pm" and hour != 12:
            hour += 12
        time_str = f"{hour:02d}:{minute}"
        day_times[4] = time_str  # Friday
        day_times[5] = time_str  # Saturday

    # Sunday at 3:00 pm
    sun_match = re.search(r"Sunday.*?(\d{1,2}):(\d{2})\s*(pm|am)", schedule_text, re.IGNORECASE)
    if sun_match:
        hour = int(sun_match.group(1))
        minute = sun_match.group(2)
        period = sun_match.group(3).lower()
        if period == "pm" and hour != 12:
            hour += 12
        day_times[6] = f"{hour:02d}:{minute}"  # Sunday

    # If no specific schedule found, default to Fri/Sat 8pm, Sun 3pm
    if not day_times:
        day_times = {4: "20:00", 5: "20:00", 6: "15:00"}

    # Generate dates
    current = start_date
    while current <= end_date:
        weekday = current.weekday()
        if weekday in day_times:
            performances.append((current, day_times[weekday]))
        current += timedelta(days=1)

    return performances


def crawl(source: dict) -> tuple[int, int, int]:
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

            logger.info(f"Fetching OnStage Atlanta: {EVENTS_URL}")
            page.goto(EVENTS_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(3000)

            # Extract images from page
            image_map = extract_images_from_page(page)

            # Extract event links for specific URLs
            event_links = extract_event_links(page, BASE_URL)

            # Scroll to load content
            for _ in range(3):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1000)

            body_text = page.inner_text("body")

            # Look for "CURRENT PRODUCTION" section
            current_match = re.search(
                r"CURRENT PRODUCTION\s*\n\s*(.+?)\s*\n.*?(?:By|by)\s+(.+?)\s*\n.*?SHOW SCHEDULE\s*\n\s*(.+?)\s*\n\s*(.+?)(?:\n|Reserve|$)",
                body_text,
                re.IGNORECASE | re.DOTALL
            )

            if current_match:
                title = current_match.group(1).strip()
                playwright = current_match.group(2).strip()
                date_range_text = current_match.group(3).strip()
                schedule_text = current_match.group(4).strip()

                logger.info(f"Found show: {title} by {playwright}")
                logger.info(f"Date range: {date_range_text}")
                logger.info(f"Schedule: {schedule_text}")

                start_date, end_date = parse_date_range(date_range_text)

                if start_date and end_date:
                    performances = get_performance_dates(start_date, end_date, schedule_text)

                    for perf_date, perf_time in performances:
                        # Skip past dates
                        if perf_date.date() < datetime.now().date():
                            continue

                        events_found += 1
                        start_date_str = perf_date.strftime("%Y-%m-%d")
                        content_hash = generate_content_hash(title, "OnStage Atlanta", start_date_str)


                        # Get specific event URL


                        event_url = find_event_url(title, event_links, EVENTS_URL)



                        event_record = {
                            "source_id": source_id,
                            "venue_id": venue_id,
                            "title": title,
                            "description": f"{title} by {playwright}. Live theater performance at OnStage Atlanta.",
                            "start_date": start_date_str,
                            "start_time": perf_time,
                            "end_date": None,
                            "end_time": None,
                            "is_all_day": False,
                            "category": "theater",
                            "subcategory": "play",
                            "tags": ["theater", "play", "community-theater", "scottdale"],
                            "price_min": None,
                            "price_max": None,
                            "price_note": None,
                            "is_free": False,
                            "source_url": event_url,
                            "ticket_url": f"{BASE_URL}/box-office",
                            "image_url": image_map.get(title),
                            "raw_text": f"{title} - {start_date_str} at {perf_time}",
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
                            logger.info(f"Added: {title} on {start_date_str} at {perf_time}")
                        except Exception as e:
                            logger.error(f"Failed to insert: {title}: {e}")

            # Also look for "Upcoming Shows" section
            upcoming_section = re.search(r"Upcoming Shows(.+?)(?:Get Involved|$)", body_text, re.DOTALL | re.IGNORECASE)
            if upcoming_section:
                upcoming_text = upcoming_section.group(1)
                # Look for show cards with titles and dates
                show_matches = re.findall(
                    r"([A-Z][A-Za-z\s']+?)\s*\n\s*(?:By|by)\s+([A-Za-z\s]+)\s*\n.*?((?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}\s*[-–]\s*\d{1,2},?\s*\d{4})",
                    upcoming_text,
                    re.IGNORECASE
                )

                for show_title, show_author, show_dates in show_matches:
                    show_title = show_title.strip()
                    start_date, end_date = parse_date_range(show_dates)

                    if start_date and end_date:
                        performances = get_performance_dates(start_date, end_date, "Friday & Saturday at 8:00 pm, Sunday at 3:00 pm")

                        for perf_date, perf_time in performances:
                            if perf_date.date() < datetime.now().date():
                                continue

                            events_found += 1
                            start_date_str = perf_date.strftime("%Y-%m-%d")
                            content_hash = generate_content_hash(show_title, "OnStage Atlanta", start_date_str)

                            existing = find_event_by_hash(content_hash)
                            if existing:
                                smart_update_existing_event(existing, event_record)
                                events_updated += 1
                                continue

                            # Get specific event URL


                            event_url = find_event_url(title, event_links, EVENTS_URL)



                            event_record = {
                                "source_id": source_id,
                                "venue_id": venue_id,
                                "title": show_title,
                                "description": f"{show_title} by {show_author.strip()}. Live theater at OnStage Atlanta.",
                                "start_date": start_date_str,
                                "start_time": perf_time,
                                "end_date": None,
                                "end_time": None,
                                "is_all_day": False,
                                "category": "theater",
                                "subcategory": "play",
                                "tags": ["theater", "play", "community-theater", "scottdale"],
                                "price_min": None,
                                "price_max": None,
                                "price_note": None,
                                "is_free": False,
                                "source_url": event_url,
                                "ticket_url": f"{BASE_URL}/box-office",
                                "image_url": image_map.get(show_title),
                                "raw_text": f"{show_title} - {start_date_str}",
                                "extraction_confidence": 0.85,
                                "is_recurring": False,
                                "recurrence_rule": None,
                                "content_hash": content_hash,
                            }

                            try:
                                insert_event(event_record)
                                events_new += 1
                                logger.info(f"Added upcoming: {show_title} on {start_date_str}")
                            except Exception as e:
                                logger.error(f"Failed to insert upcoming: {show_title}: {e}")

            browser.close()

        logger.info(f"OnStage Atlanta crawl complete: {events_found} found, {events_new} new, {events_updated} updated")

    except Exception as e:
        logger.error(f"Failed to crawl OnStage Atlanta: {e}")
        raise

    return events_found, events_new, events_updated
