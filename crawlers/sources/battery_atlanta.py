"""
Crawler for The Battery Atlanta (batteryatl.com).
Mixed-use development next to Truist Park with concerts, festivals,
dining events, markets, and community gatherings.
Uses The Events Calendar (Tribe Events) WordPress plugin.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime
from typing import Optional

from playwright.sync_api import sync_playwright
from bs4 import BeautifulSoup

from db import get_or_create_venue, insert_event, find_event_by_hash
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://www.batteryatl.com"
EVENTS_URL = f"{BASE_URL}/events/"

VENUE_DATA = {
    "name": "The Battery Atlanta",
    "slug": "battery-atlanta",
    "address": "800 Battery Ave SE",
    "neighborhood": "Cumberland",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30339",
    "lat": 33.8905,
    "lng": -84.4679,
    "venue_type": "mixed_use",
    "spot_type": "district",
    "website": BASE_URL,
}


def parse_datetime(datetime_text: str) -> tuple[Optional[str], Optional[str], Optional[str], Optional[str]]:
    """
    Parse datetime from various formats like:
    - 'January 28 @ 6:00 pm-8:00 pm'
    - 'January 30 @ 7:30 pm-11:00 pm'
    - 'January 31 @ 9:00 pm-February 1 @ 12:00 am'

    Returns: (start_date, start_time, end_date, end_time)
    """
    current_year = datetime.now().year

    # Remove extra whitespace
    text = datetime_text.strip()

    # Try to handle multi-day events FIRST like "January 31 @ 9:00 pm-February 1 @ 12:00 am"
    match_multiday = re.match(
        r'(\w+)\s+(\d+)\s+@\s+(\d+):(\d+)\s+(am|pm)\s*-\s*(\w+)\s+(\d+)\s+@\s+(\d+):(\d+)\s+(am|pm)',
        text,
        re.IGNORECASE
    )

    if match_multiday:
        start_month = match_multiday.group(1)
        start_day = match_multiday.group(2)
        start_hour = int(match_multiday.group(3))
        start_min = match_multiday.group(4)
        start_period = match_multiday.group(5).lower()

        end_month = match_multiday.group(6)
        end_day = match_multiday.group(7)
        end_hour = int(match_multiday.group(8))
        end_min = match_multiday.group(9)
        end_period = match_multiday.group(10).lower()

        try:
            start_dt = datetime.strptime(f"{start_month} {start_day} {current_year}", "%B %d %Y")
            if start_dt.date() < datetime.now().date():
                start_dt = datetime.strptime(f"{start_month} {start_day} {current_year + 1}", "%B %d %Y")

            start_date = start_dt.strftime("%Y-%m-%d")

            # Convert start time
            if start_period == "pm" and start_hour != 12:
                start_hour += 12
            elif start_period == "am" and start_hour == 12:
                start_hour = 0
            start_time = f"{start_hour:02d}:{start_min}"

            # Parse end date
            year = start_dt.year
            # If end month is earlier than start month, assume next year
            end_month_num = datetime.strptime(end_month, "%B").month
            if end_month_num < start_dt.month:
                year += 1

            end_dt = datetime.strptime(f"{end_month} {end_day} {year}", "%B %d %Y")
            end_date = end_dt.strftime("%Y-%m-%d")

            # Convert end time
            if end_period == "pm" and end_hour != 12:
                end_hour += 12
            elif end_period == "am" and end_hour == 12:
                end_hour = 0
            end_time = f"{end_hour:02d}:{end_min}"

            return start_date, start_time, end_date, end_time

        except ValueError as e:
            logger.warning(f"Failed to parse multi-day datetime '{text}': {e}")
            return None, None, None, None

    # Match patterns like "January 28 @ 6:00 pm-8:00 pm" (same day)
    match = re.match(
        r'(\w+)\s+(\d+)\s+@\s+(\d+):(\d+)\s+(am|pm)(?:-(\d+):(\d+)\s+(am|pm))?',
        text,
        re.IGNORECASE
    )

    if match:
        month_name = match.group(1)
        day = match.group(2)
        start_hour = int(match.group(3))
        start_min = match.group(4)
        start_period = match.group(5).lower()

        # Parse start date and time
        try:
            dt = datetime.strptime(f"{month_name} {day} {current_year}", "%B %d %Y")

            # If date is in the past, assume next year
            if dt.date() < datetime.now().date():
                dt = datetime.strptime(f"{month_name} {day} {current_year + 1}", "%B %d %Y")

            start_date = dt.strftime("%Y-%m-%d")

            # Convert 12-hour to 24-hour
            if start_period == "pm" and start_hour != 12:
                start_hour += 12
            elif start_period == "am" and start_hour == 12:
                start_hour = 0

            start_time = f"{start_hour:02d}:{start_min}"

            # Parse end time if exists
            end_date = None
            end_time = None

            if match.group(6):  # End time exists
                end_hour = int(match.group(6))
                end_min = match.group(7)
                end_period = match.group(8).lower()

                if end_period == "pm" and end_hour != 12:
                    end_hour += 12
                elif end_period == "am" and end_hour == 12:
                    end_hour = 0

                end_time = f"{end_hour:02d}:{end_min}"

                # If end time is earlier than start time, assume next day
                if end_time < start_time:
                    end_dt = dt.replace(day=dt.day + 1)
                    end_date = end_dt.strftime("%Y-%m-%d")
                else:
                    end_date = start_date

            return start_date, start_time, end_date, end_time

        except ValueError as e:
            logger.warning(f"Failed to parse datetime '{text}': {e}")
            return None, None, None, None

    return None, None, None, None


def determine_category(title: str, description: str, categories: list[str], tags: list[str]) -> tuple[str, Optional[str], list[str]]:
    """Determine category based on event data."""
    combined = f"{title} {description}".lower()
    all_cats = " ".join(categories + tags).lower()

    event_tags = ["battery", "battery-atlanta", "truist-park", "cumberland"]

    # Use Tribe Events categories first
    if "concert" in all_cats or "live-music" in all_cats:
        return "music", "live", event_tags + ["live-music"]
    if "dine" in all_cats or "dining" in all_cats:
        if any(w in combined for w in ["wine", "tasting", "pairing"]):
            return "food_drink", "tasting", event_tags + ["dining", "wine"]
        if any(w in combined for w in ["brunch", "jazz", "music"]):
            return "food_drink", "dining", event_tags + ["dining", "live-music"]
        return "food_drink", "dining", event_tags + ["dining"]
    if "play" in all_cats:
        if "braves" in all_cats or "baseball" in all_cats:
            return "sports", "baseball", event_tags + ["atlanta-braves", "baseball"]
        return "sports", None, event_tags + ["sports"]
    if "special-event" in all_cats:
        if "braves" in all_cats:
            return "sports", "festival", event_tags + ["atlanta-braves", "festival"]
        return "community", "festival", event_tags + ["festival"]

    # Fallback to text analysis
    if any(w in combined for w in ["concert", "music", "live band", "piano"]):
        return "music", "live", event_tags + ["live-music"]
    if any(w in combined for w in ["braves", "baseball"]):
        return "sports", "baseball", event_tags + ["atlanta-braves", "baseball"]
    if any(w in combined for w in ["market", "farmers", "makers", "vendors"]):
        return "community", "market", event_tags + ["market"]
    if any(w in combined for w in ["festival", "fest", "holiday", "seasonal"]):
        return "community", "festival", event_tags + ["festival"]
    if any(w in combined for w in ["yoga", "fitness", "workout"]):
        return "fitness", None, event_tags + ["fitness"]
    if any(w in combined for w in ["family", "kids", "children"]):
        return "family", None, event_tags + ["family"]

    return "community", None, event_tags


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl The Battery Atlanta events using Playwright."""
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

            logger.info(f"Fetching Battery Atlanta events from {EVENTS_URL}")
            page.goto(EVENTS_URL, wait_until="domcontentloaded", timeout=45000)
            page.wait_for_timeout(5000)  # Wait for JS to render events
            page.wait_for_timeout(3000)

            content = page.content()
            soup = BeautifulSoup(content, 'html.parser')

            # Find all event articles using Tribe Events structure
            event_articles = soup.select('article.tribe-events-calendar-list__event')
            logger.info(f"Found {len(event_articles)} events on page")

            for event_article in event_articles:
                try:
                    # Extract title and URL
                    title_elem = event_article.find('h3', class_='tribe-events-calendar-list__event-title')
                    if not title_elem:
                        continue

                    link = title_elem.find('a')
                    if not link:
                        continue

                    title = link.get_text(strip=True)
                    source_url = link.get('href', EVENTS_URL)

                    # Skip Braves games (we have a separate Braves crawler)
                    if "braves game" in title.lower() or "vs." in title.lower():
                        continue

                    # Extract datetime
                    datetime_elem = event_article.find('time', class_='tribe-events-calendar-list__event-datetime')
                    if not datetime_elem:
                        logger.warning(f"No datetime found for: {title}")
                        continue

                    datetime_text = datetime_elem.get_text(strip=True)
                    start_date, start_time, end_date, end_time = parse_datetime(datetime_text)

                    if not start_date:
                        logger.warning(f"Could not parse datetime for: {title}")
                        continue

                    # Extract venue name (may be specific venue within Battery)
                    venue_name = "The Battery Atlanta"
                    venue_elem = event_article.find('span', class_='tribe-events-calendar-list__event-venue-title')
                    if venue_elem:
                        specific_venue = venue_elem.get_text(strip=True)
                        if specific_venue and specific_venue != "The Battery Atlanta":
                            venue_name = f"{specific_venue} at The Battery Atlanta"

                    # Extract description
                    desc_elem = event_article.find('div', class_='tribe-events-calendar-list__event-description')
                    description = desc_elem.get_text(strip=True) if desc_elem else f"Event at {venue_name}"

                    # Extract categories and tags from CSS classes
                    classes = event_article.get('class', [])
                    categories = [c.replace('cat_', '') for c in classes if c.startswith('cat_')]
                    tags = [c.replace('tag-', '').replace('-', ' ') for c in classes if c.startswith('tag-')]

                    events_found += 1

                    # Generate content hash
                    content_hash = generate_content_hash(title, venue_name, start_date)

                    # Check for existing event
                    if find_event_by_hash(content_hash):
                        events_updated += 1
                        continue

                    # Determine category
                    category, subcategory, event_tags = determine_category(title, description, categories, tags)

                    # Check for free events
                    is_free = any(word in f"{title} {description}".lower() for word in ["free", "no cover", "complimentary"])

                    # Check for pricing
                    price_match = re.search(r'\$(\d+(?:\.\d{2})?)', f"{title} {description}")
                    price_min = None
                    price_max = None
                    if price_match:
                        price_min = float(price_match.group(1))
                        price_max = price_min

                    # Check for recurring events
                    is_recurring = 'tribe-recurring-event' in classes

                    event_record = {
                        "source_id": source_id,
                        "venue_id": venue_id,
                        "title": title,
                        "description": description,
                        "start_date": start_date,
                        "start_time": start_time,
                        "end_date": end_date,
                        "end_time": end_time,
                        "is_all_day": start_time is None,
                        "category": category,
                        "subcategory": subcategory,
                        "tags": event_tags,
                        "price_min": price_min,
                        "price_max": price_max,
                        "price_note": None,
                        "is_free": is_free,
                        "source_url": source_url,
                        "ticket_url": source_url,
                        "image_url": None,  # Could extract from event detail page
                        "raw_text": f"{title} - {description}",
                        "extraction_confidence": 0.90,  # High confidence - structured data
                        "is_recurring": is_recurring,
                        "recurrence_rule": None,
                        "content_hash": content_hash,
                    }

                    try:
                        insert_event(event_record)
                        events_new += 1
                        logger.info(f"Added: {title} on {start_date}")
                    except Exception as e:
                        logger.error(f"Failed to insert event '{title}': {e}")

                except Exception as e:
                    logger.error(f"Error processing event: {e}")
                    continue

            # TODO: Handle pagination - check for "Load More" button or next page links
            # The site uses AJAX loading, so we might need to:
            # 1. Click "Load More" button multiple times
            # 2. Or fetch additional pages from /events-calendar/list/page/2/, etc.

            browser.close()

        logger.info(
            f"Battery Atlanta crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Battery Atlanta: {e}")
        raise

    return events_found, events_new, events_updated
