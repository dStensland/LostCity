"""
Crawler for Central Rock Gym Atlanta (formerly Stone Summit Climbing).

SOURCE: centralrockgym.com/atlanta/climbing_type/events/
PURPOSE: Climbing gym with special recurring events (BIPOC/LGBTQ+ meetups, adaptive climbing).

These are RECURRING programs (monthly meetups), not one-time events.
We generate future event instances for the next 3 months.
"""

from __future__ import annotations

import re
import logging
import calendar
from datetime import datetime, timedelta
from typing import Optional, List

from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout
from bs4 import BeautifulSoup

from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash
from utils import normalize_time_format

logger = logging.getLogger(__name__)

BASE_URL = "https://centralrockgym.com"
EVENTS_URL = f"{BASE_URL}/atlanta/climbing_type/events/"

VENUE_DATA = {
    "name": "Central Rock Gym Atlanta",
    "slug": "central-rock-gym-atlanta",
    "address": "3701 Presidential Parkway",
    "neighborhood": "Chamblee",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30340",
    "lat": 33.8875,
    "lng": -84.2780,
    "venue_type": "fitness_center",
    "spot_type": "fitness_center",
    "website": "https://centralrockgym.com/atlanta/",
    "vibes": ["active", "indoor", "welcoming"],
}

# Keywords for categorization
BIPOC_KEYWORDS = ["bipoc", "color", "black", "indigenous", "people of color"]
LGBTQ_KEYWORDS = ["pride", "lgbtq", "queer", "unharnessed"]
ADAPTIVE_KEYWORDS = ["adaptive", "accessible", "disability"]

# Skip general services
SKIP_KEYWORDS = ["staff assisted", "birthday", "group events", "party"]


def categorize_event(title: str, description: str = "") -> dict:
    """Determine category, subcategory, and tags."""
    text = f"{title} {description}".lower()

    category = "fitness"
    subcategory = "climbing"
    tags = ["climbing", "fitness", "indoor", "social"]

    # Add inclusive tags
    if any(kw in text for kw in BIPOC_KEYWORDS):
        tags.extend(["bipoc", "inclusive", "community"])
    if any(kw in text for kw in LGBTQ_KEYWORDS):
        tags.extend(["lgbtq", "inclusive", "pride"])
    if any(kw in text for kw in ADAPTIVE_KEYWORDS):
        tags.extend(["adaptive", "inclusive", "accessibility"])

    # Detect bouldering
    if "boulder" in text:
        tags.append("bouldering")

    tags = list(set(tags))

    return {
        "category": category,
        "subcategory": subcategory,
        "tags": tags,
    }


def should_skip(title: str, description: str = "") -> bool:
    """Check if this should be skipped (not a special event)."""
    text = f"{title} {description}".lower()
    return any(kw in text for kw in SKIP_KEYWORDS)


def parse_recurrence_pattern(text: str) -> Optional[dict]:
    """
    Parse recurrence pattern from description.

    Examples:
    - "3rd Monday of the month" -> {week: 3, weekday: 0}
    - "every Tuesday" -> {week: None, weekday: 1}
    - "first Saturday" -> {week: 1, weekday: 5}
    """
    text = text.lower()

    weekdays = {
        "monday": 0,
        "tuesday": 1,
        "wednesday": 2,
        "thursday": 3,
        "friday": 4,
        "saturday": 5,
        "sunday": 6,
    }

    ordinals = {
        "first": 1,
        "second": 2,
        "third": 3,
        "1st": 1,
        "2nd": 2,
        "3rd": 3,
        "4th": 4,
    }

    # Try "Nth WEEKDAY of the month"
    for ordinal_str, ordinal_num in ordinals.items():
        for weekday_str, weekday_num in weekdays.items():
            pattern = f"{ordinal_str} {weekday_str}"
            if pattern in text:
                return {"week": ordinal_num, "weekday": weekday_num}

    # Try "every WEEKDAY"
    for weekday_str, weekday_num in weekdays.items():
        if f"every {weekday_str}" in text:
            return {"week": None, "weekday": weekday_num}

    return None


def get_nth_weekday_of_month(year: int, month: int, weekday: int, n: int) -> Optional[int]:
    """
    Get the day number of the Nth occurrence of a weekday in a month.

    Args:
        year: Year
        month: Month (1-12)
        weekday: Weekday (0=Monday, 6=Sunday)
        n: Which occurrence (1=first, 2=second, etc.)

    Returns:
        Day of month, or None if doesn't exist
    """
    # Find the first occurrence of this weekday
    first_day = datetime(year, month, 1)
    first_weekday = first_day.weekday()

    # Calculate days until first occurrence
    days_until = (weekday - first_weekday) % 7
    first_occurrence = 1 + days_until

    # Calculate the Nth occurrence
    nth_occurrence = first_occurrence + (n - 1) * 7

    # Check if it's valid for this month
    days_in_month = calendar.monthrange(year, month)[1]
    if nth_occurrence <= days_in_month:
        return nth_occurrence
    return None


def generate_future_dates(recurrence: dict, months_ahead: int = 3) -> List[str]:
    """
    Generate future dates based on recurrence pattern.

    Args:
        recurrence: Dict with 'week' and 'weekday' keys
        months_ahead: How many months to generate

    Returns:
        List of dates in YYYY-MM-DD format
    """
    dates = []
    today = datetime.now().date()

    for i in range(months_ahead):
        # Calculate target month
        target_date = today + timedelta(days=30 * i)
        year = target_date.year
        month = target_date.month

        # Advance to next month if we're past this month's occurrence
        if i == 0:
            # For current month, check if date has passed
            month_start = datetime(year, month, 1).date()
            if target_date > month_start + timedelta(days=20):
                # We're late in the month, skip to next month
                if month == 12:
                    year += 1
                    month = 1
                else:
                    month += 1

        # Get the actual date
        if recurrence["week"] is not None:
            # Nth weekday of month
            day = get_nth_weekday_of_month(year, month, recurrence["weekday"], recurrence["week"])
            if day:
                event_date = datetime(year, month, day).date()
                # Only include future dates
                if event_date >= today:
                    dates.append(event_date.strftime("%Y-%m-%d"))
        else:
            # Every weekday (weekly) - generate all in this month
            for week_num in [1, 2, 3, 4]:
                day = get_nth_weekday_of_month(year, month, recurrence["weekday"], week_num)
                if day:
                    event_date = datetime(year, month, day).date()
                    if event_date >= today:
                        dates.append(event_date.strftime("%Y-%m-%d"))

    return dates


def fetch_event_detail(page, url: str) -> Optional[str]:
    """Fetch full description from event detail page."""
    try:
        page.goto(url, wait_until="domcontentloaded", timeout=15000)
        page.wait_for_timeout(2000)

        # Try to get main content area
        html = page.content()
        soup = BeautifulSoup(html, "lxml")

        # Find the main content - look for article, main, or content divs
        content_elem = (
            soup.find("article")
            or soup.find("main")
            or soup.find("div", class_=re.compile(r"content|entry|post-body"))
            or soup.find("body")
        )

        if content_elem:
            # Remove navigation, footer, header
            for tag in content_elem.find_all(["nav", "header", "footer", "script", "style"]):
                tag.decompose()

            text = content_elem.get_text(separator=" ", strip=True)
            # Clean up multiple spaces
            text = re.sub(r"\s+", " ", text)
            return text

        return page.inner_text("body")
    except Exception as e:
        logger.warning(f"Failed to fetch detail page {url}: {e}")
        return None


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Central Rock Gym Atlanta events."""
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

            logger.info(f"Fetching Central Rock Gym events: {EVENTS_URL}")
            page.goto(EVENTS_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(3000)

            # Get venue ID
            venue_id = get_or_create_venue(VENUE_DATA)

            # Parse HTML
            html = page.content()
            soup = BeautifulSoup(html, "lxml")

            # Find all activity cards
            articles = soup.find_all("article", class_="activities")
            logger.info(f"Found {len(articles)} activity cards")

            for article in articles:
                try:
                    # Extract title
                    title_elem = article.find(["h1", "h2", "h3"])
                    if not title_elem:
                        continue

                    title = title_elem.get_text(strip=True)
                    logger.info(f"Processing: {title}")

                    # Extract preview description
                    content = article.get_text(separator=" ", strip=True)

                    # Skip non-events
                    if should_skip(title, content):
                        logger.info(f"Skipping: {title}")
                        continue

                    # Get detail page URL
                    link = article.find("a", href=True)
                    if not link:
                        logger.warning(f"No link found for: {title}")
                        continue

                    detail_url = link.get("href")
                    if not detail_url.startswith("http"):
                        detail_url = BASE_URL + detail_url

                    # Fetch full description from detail page
                    detail_text = fetch_event_detail(page, detail_url)
                    if not detail_text:
                        detail_text = content

                    # Parse recurrence pattern
                    recurrence = parse_recurrence_pattern(detail_text)
                    if not recurrence:
                        logger.warning(f"No recurrence pattern found for: {title}")
                        continue

                    # Generate future dates
                    future_dates = generate_future_dates(recurrence, months_ahead=3)
                    if not future_dates:
                        logger.warning(f"No future dates generated for: {title}")
                        continue

                    logger.info(f"Generating {len(future_dates)} instances for: {title}")

                    # Extract time if available
                    start_time = None
                    time_match = re.search(r"(\d{1,2}:\d{2}\s*[AP]M)", detail_text, re.IGNORECASE)
                    if time_match:
                        start_time = normalize_time_format(time_match.group(1))

                    # Get image
                    image_url = None
                    img = article.find("img")
                    if img:
                        image_url = img.get("src") or img.get("data-src")

                    # Categorize
                    cat_info = categorize_event(title, detail_text)

                    # Build description (truncate if too long)
                    description = detail_text[:500].strip()
                    if len(detail_text) > 500:
                        description += "..."

                    # Create series hint for recurring events
                    weekday_names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
                    freq_desc = f"Monthly on the {['', 'first', 'second', 'third', 'fourth'][recurrence['week']]} {weekday_names[recurrence['weekday']]}" if recurrence["week"] else f"Weekly on {weekday_names[recurrence['weekday']]}"

                    series_hint = {
                        "series_type": "class_series",
                        "series_title": title,
                        "frequency": "monthly" if recurrence["week"] else "weekly",
                        "description": f"{title} - {freq_desc}",
                    }

                    # Create event for each future date
                    for event_date in future_dates:
                        # Build event record
                        event_record = {
                            "source_id": source_id,
                            "venue_id": venue_id,
                            "title": title,
                            "description": description,
                            "start_date": event_date,
                            "start_time": start_time,
                            "end_date": None,
                            "end_time": None,
                            "is_all_day": False,
                            "category": cat_info["category"],
                            "subcategory": cat_info["subcategory"],
                            "tags": cat_info["tags"],
                            "price_min": None,
                            "price_max": None,
                            "price_note": "Free with membership",
                            "is_free": False,
                            "source_url": detail_url,
                            "ticket_url": None,
                            "image_url": image_url,
                            "raw_text": f"{title} - {event_date}",
                            "extraction_confidence": 0.85,
                            "is_recurring": True,
                            "recurrence_rule": None,
                            "content_hash": generate_content_hash(title, VENUE_DATA["name"], event_date),
                        }

                        events_found += 1

                        # Check for existing
                        existing = find_event_by_hash(event_record["content_hash"])
                        if existing:
                            smart_update_existing_event(existing, event_record)
                            events_updated += 1
                            continue

                        try:
                            insert_event(event_record, series_hint=series_hint)
                            events_new += 1
                            logger.info(f"Added: {title} on {event_date}")
                        except Exception as e:
                            logger.error(f"Failed to insert {title} on {event_date}: {e}")

                except Exception as e:
                    logger.error(f"Error processing article: {e}")
                    continue

            browser.close()

        logger.info(
            f"Central Rock Gym crawl complete: {events_found} found, {events_new} new"
        )

    except PlaywrightTimeout as e:
        logger.error(f"Timeout fetching Central Rock Gym: {e}")
        raise
    except Exception as e:
        logger.error(f"Failed to crawl Central Rock Gym: {e}")
        raise

    return events_found, events_new, events_updated
