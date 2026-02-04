"""
Crawler for Pullman Yards (pullmanyards.com).
27-acre historic rail yard complex in Kirkwood with 9 venue spaces.
Hosts major events including SweetWater 420 Fest, Candler Park Music Festival, concerts, and immersive experiences.
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

BASE_URL = "https://www.pullmanyards.com"
EVENTS_URL = f"{BASE_URL}/events"

VENUE_DATA = {
    "name": "Pullman Yards",
    "slug": "pullman-yards",
    "address": "225 Rogers St NE",
    "neighborhood": "Kirkwood",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30317",
    "lat": 33.7560,
    "lng": -84.3280,
    "venue_type": "event_space",
    "spot_type": "event_space",
    "website": BASE_URL,
    "description": "Historic 27-acre rail yard complex with 9 venue spaces hosting concerts, festivals, and immersive experiences.",
}

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
}


def parse_date(date_str: str) -> Optional[str]:
    """Parse date from various formats."""
    date_str = date_str.strip()
    now = datetime.now()

    # Month day, year format
    match = re.search(
        r"(January|February|March|April|May|June|July|August|September|October|November|December|"
        r"Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s*(\d{4})?",
        date_str,
        re.IGNORECASE
    )
    if match:
        month_str = match.group(1)[:3]
        day = match.group(2)
        year = match.group(3) if match.group(3) else str(now.year)
        try:
            dt = datetime.strptime(f"{month_str} {day} {year}", "%b %d %Y")
            if dt.date() < now.date():
                dt = dt.replace(year=now.year + 1)
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            pass

    return None


def parse_time(time_str: str) -> Optional[str]:
    """Parse time from various formats."""
    match = re.search(r"(\d{1,2}):?(\d{2})?\s*(am|pm|a|p)", time_str, re.IGNORECASE)
    if match:
        hour = int(match.group(1))
        minute = int(match.group(2)) if match.group(2) else 0
        period = match.group(3).lower()
        if period in ("pm", "p") and hour != 12:
            hour += 12
        elif period in ("am", "a") and hour == 12:
            hour = 0
        return f"{hour:02d}:{minute:02d}"
    return None


def determine_category(title: str) -> tuple[str, Optional[str], list[str]]:
    """Determine category based on event title."""
    title_lower = title.lower()
    tags = ["pullman-yards", "kirkwood", "historic-venue"]

    if any(w in title_lower for w in ["420", "sweetwater", "fest", "festival"]):
        return "music", "live", tags + ["festival", "outdoor"]
    if any(w in title_lower for w in ["concert", "live", "music", "dj", "band"]):
        return "music", "live", tags + ["live-music"]
    if any(w in title_lower for w in ["immersive", "experience", "art", "exhibit"]):
        return "art", None, tags + ["immersive", "experience"]
    if any(w in title_lower for w in ["market", "pop-up", "vendor"]):
        return "community", "market", tags + ["market"]
    if any(w in title_lower for w in ["comedy", "standup"]):
        return "comedy", "standup", tags + ["comedy"]
    if any(w in title_lower for w in ["food", "tasting", "chef"]):
        return "food_drink", "tasting", tags + ["food"]

    return "community", None, tags


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Pullman Yards events using Playwright."""
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

            logger.info(f"Fetching Pullman Yards: {EVENTS_URL}")
            page.goto(EVENTS_URL, wait_until="networkidle", timeout=45000)
            page.wait_for_timeout(3000)

            # Extract images
            image_map = extract_images_from_page(page)

            # Scroll to load content
            for _ in range(5):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1000)

            # Look for event cards/containers
            event_selectors = [
                ".event-card", ".event-item", "[class*='event']",
                ".show-card", ".listing-item", "article"
            ]

            found_events = False
            for selector in event_selectors:
                elements = page.query_selector_all(selector)
                if elements and len(elements) > 0:
                    for element in elements:
                        try:
                            text = element.inner_text()
                            if len(text) < 10:
                                continue

                            # Extract title (usually first substantial line)
                            lines = [l.strip() for l in text.split("\n") if l.strip()]
                            title = None
                            start_date = None
                            start_time = None

                            for line in lines:
                                # Skip short lines and common UI elements
                                if len(line) < 4:
                                    continue
                                if line.lower() in ["buy tickets", "more info", "learn more", "sold out"]:
                                    continue

                                # Check for date
                                if not start_date:
                                    date_result = parse_date(line)
                                    if date_result:
                                        start_date = date_result
                                        continue

                                # Check for time
                                if not start_time:
                                    time_result = parse_time(line)
                                    if time_result:
                                        start_time = time_result
                                        continue

                                # First substantial line is likely the title
                                if not title and len(line) > 5:
                                    if not re.match(r"^\$|^\d{1,2}[:/]", line):
                                        title = line

                            if not title or not start_date:
                                continue

                            events_found += 1
                            found_events = True

                            content_hash = generate_content_hash(
                                title, "Pullman Yards", start_date
                            )

                            if find_event_by_hash(content_hash):
                                events_updated += 1
                                continue

                            category, subcategory, tags = determine_category(title)

                            # Try to get link
                            link = element.query_selector("a")
                            event_url = link.get_attribute("href") if link else EVENTS_URL
                            if event_url and event_url.startswith("/"):
                                event_url = BASE_URL + event_url

                            event_record = {
                                "source_id": source_id,
                                "venue_id": venue_id,
                                "title": title,
                                "description": f"Event at Pullman Yards, Atlanta's premier 27-acre event venue.",
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
                                "source_url": event_url or EVENTS_URL,
                                "ticket_url": event_url or EVENTS_URL,
                                "image_url": image_map.get(title),
                                "raw_text": text[:500],
                                "extraction_confidence": 0.80,
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
                            logger.debug(f"Error parsing event element: {e}")
                            continue

                    if found_events:
                        break

            # Fallback: parse page text if no structured events found
            if not found_events:
                logger.info("No structured events found, trying text parsing")
                body_text = page.inner_text("body")
                lines = [l.strip() for l in body_text.split("\n") if l.strip()]

                i = 0
                while i < len(lines):
                    line = lines[i]
                    date_result = parse_date(line)

                    if date_result:
                        # Look for title nearby
                        for j in range(max(0, i-2), min(len(lines), i+4)):
                            if j == i:
                                continue
                            potential_title = lines[j]
                            if len(potential_title) > 10 and not parse_date(potential_title):
                                if not re.match(r"^\$|^tickets|^buy|^more", potential_title.lower()):
                                    title = potential_title
                                    events_found += 1

                                    content_hash = generate_content_hash(
                                        title, "Pullman Yards", date_result
                                    )

                                    if not find_event_by_hash(content_hash):
                                        category, subcategory, tags = determine_category(title)

                                        event_record = {
                                            "source_id": source_id,
                                            "venue_id": venue_id,
                                            "title": title,
                                            "description": f"Event at Pullman Yards",
                                            "start_date": date_result,
                                            "start_time": None,
                                            "end_date": None,
                                            "end_time": None,
                                            "is_all_day": True,
                                            "category": category,
                                            "subcategory": subcategory,
                                            "tags": tags,
                                            "price_min": None,
                                            "price_max": None,
                                            "price_note": None,
                                            "is_free": False,
                                            "source_url": EVENTS_URL,
                                            "ticket_url": EVENTS_URL,
                                            "image_url": None,
                                            "raw_text": f"{title} - {date_result}",
                                            "extraction_confidence": 0.70,
                                            "is_recurring": False,
                                            "recurrence_rule": None,
                                            "content_hash": content_hash,
                                        }

                                        try:
                                            insert_event(event_record)
                                            events_new += 1
                                            logger.info(f"Added: {title} on {date_result}")
                                        except Exception as e:
                                            logger.error(f"Failed to insert: {title}: {e}")
                                    else:
                                        events_updated += 1

                                    break

                    i += 1

            browser.close()

        logger.info(
            f"Pullman Yards crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Pullman Yards: {e}")
        raise

    return events_found, events_new, events_updated
