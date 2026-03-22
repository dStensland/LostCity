"""
Crawler for Central Rock Gym Atlanta (formerly Stone Summit Climbing).

SOURCE: centralrockgym.com/atlanta/climbing_type/events/
PURPOSE: Climbing gym with special recurring events (BIPOC/LGBTQ+ meetups, adaptive climbing).

These are RECURRING programs (monthly meetups), not one-time events.
We generate future event instances for the next 3 months.
Uses static HTTP (requests + BeautifulSoup).
"""

from __future__ import annotations

import re
import logging
import calendar
from datetime import datetime, timedelta
from typing import Optional, List

import requests
from bs4 import BeautifulSoup

from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash
from utils import normalize_time_format

logger = logging.getLogger(__name__)

BASE_URL = "https://centralrockgym.com"
EVENTS_URL = f"{BASE_URL}/atlanta/climbing_type/events/"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
}

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

BIPOC_KEYWORDS = ["bipoc", "color", "black", "indigenous", "people of color"]
LGBTQ_KEYWORDS = ["pride", "lgbtq", "queer", "unharnessed"]
ADAPTIVE_KEYWORDS = ["adaptive", "accessible", "disability"]
SKIP_KEYWORDS = ["staff assisted", "birthday", "group events", "party"]


def categorize_event(title: str, description: str = "") -> dict:
    """Determine category, subcategory, and tags."""
    text = f"{title} {description}".lower()

    tags = ["climbing", "fitness", "indoor", "social"]

    if any(kw in text for kw in BIPOC_KEYWORDS):
        tags.extend(["bipoc", "inclusive", "community"])
    if any(kw in text for kw in LGBTQ_KEYWORDS):
        tags.extend(["lgbtq", "inclusive", "pride"])
    if any(kw in text for kw in ADAPTIVE_KEYWORDS):
        tags.extend(["adaptive", "inclusive", "accessibility"])
    if "boulder" in text:
        tags.append("bouldering")

    return {
        "category": "fitness",
        "subcategory": "climbing",
        "tags": list(set(tags)),
    }


def should_skip(title: str, description: str = "") -> bool:
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
        "monday": 0, "tuesday": 1, "wednesday": 2, "thursday": 3,
        "friday": 4, "saturday": 5, "sunday": 6,
    }
    ordinals = {
        "first": 1, "second": 2, "third": 3,
        "1st": 1, "2nd": 2, "3rd": 3, "4th": 4,
    }

    for ordinal_str, ordinal_num in ordinals.items():
        for weekday_str, weekday_num in weekdays.items():
            if f"{ordinal_str} {weekday_str}" in text:
                return {"week": ordinal_num, "weekday": weekday_num}

    for weekday_str, weekday_num in weekdays.items():
        if f"every {weekday_str}" in text:
            return {"week": None, "weekday": weekday_num}

    return None


def get_nth_weekday_of_month(year: int, month: int, weekday: int, n: int) -> Optional[int]:
    """Get the day number of the Nth occurrence of a weekday in a month."""
    first_day = datetime(year, month, 1)
    first_weekday = first_day.weekday()
    days_until = (weekday - first_weekday) % 7
    first_occurrence = 1 + days_until
    nth_occurrence = first_occurrence + (n - 1) * 7
    days_in_month = calendar.monthrange(year, month)[1]
    if nth_occurrence <= days_in_month:
        return nth_occurrence
    return None


def generate_future_dates(recurrence: dict, months_ahead: int = 3) -> List[str]:
    """Generate future dates based on recurrence pattern."""
    dates = []
    today = datetime.now().date()

    for i in range(months_ahead):
        target_date = today + timedelta(days=30 * i)
        year = target_date.year
        month = target_date.month

        if i == 0:
            month_start = datetime(year, month, 1).date()
            if target_date > month_start + timedelta(days=20):
                if month == 12:
                    year += 1
                    month = 1
                else:
                    month += 1

        if recurrence["week"] is not None:
            day = get_nth_weekday_of_month(year, month, recurrence["weekday"], recurrence["week"])
            if day:
                event_date = datetime(year, month, day).date()
                if event_date >= today:
                    dates.append(event_date.strftime("%Y-%m-%d"))
        else:
            for week_num in [1, 2, 3, 4]:
                day = get_nth_weekday_of_month(year, month, recurrence["weekday"], week_num)
                if day:
                    event_date = datetime(year, month, day).date()
                    if event_date >= today:
                        dates.append(event_date.strftime("%Y-%m-%d"))

    return dates


def fetch_event_detail(url: str) -> Optional[str]:
    """Fetch full description from event detail page."""
    try:
        resp = requests.get(url, headers=HEADERS, timeout=15)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "lxml")

        content_elem = (
            soup.find("article")
            or soup.find("main")
            or soup.find("div", class_=re.compile(r"content|entry|post-body"))
            or soup.find("body")
        )

        if content_elem:
            for tag in content_elem.find_all(["nav", "header", "footer", "script", "style"]):
                tag.decompose()
            text = content_elem.get_text(separator=" ", strip=True)
            return re.sub(r"\s+", " ", text)

        return soup.get_text(separator=" ", strip=True)
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
        logger.info(f"Fetching Central Rock Gym events: {EVENTS_URL}")
        resp = requests.get(EVENTS_URL, headers=HEADERS, timeout=30)
        resp.raise_for_status()

        soup = BeautifulSoup(resp.text, "lxml")
        venue_id = get_or_create_venue(VENUE_DATA)

        articles = soup.find_all("article", class_="activities")
        logger.info(f"Found {len(articles)} activity cards")

        for article in articles:
            try:
                title_elem = article.find(["h1", "h2", "h3"])
                if not title_elem:
                    continue

                title = title_elem.get_text(strip=True)
                logger.info(f"Processing: {title}")

                content = article.get_text(separator=" ", strip=True)

                if should_skip(title, content):
                    logger.info(f"Skipping: {title}")
                    continue

                link = article.find("a", href=True)
                if not link:
                    logger.warning(f"No link found for: {title}")
                    continue

                detail_url = link.get("href")
                if not detail_url.startswith("http"):
                    detail_url = BASE_URL + detail_url

                detail_text = fetch_event_detail(detail_url) or content

                recurrence = parse_recurrence_pattern(detail_text)
                if not recurrence:
                    logger.warning(f"No recurrence pattern found for: {title}")
                    continue

                future_dates = generate_future_dates(recurrence, months_ahead=3)
                if not future_dates:
                    logger.warning(f"No future dates generated for: {title}")
                    continue

                logger.info(f"Generating {len(future_dates)} instances for: {title}")

                start_time = None
                time_match = re.search(r"(\d{1,2}:\d{2}\s*[AP]M)", detail_text, re.IGNORECASE)
                if not time_match:
                    time_match = re.search(r"(\d{1,2})\s*([AP]M)", detail_text, re.IGNORECASE)
                if time_match:
                    start_time = normalize_time_format(time_match.group(0))

                image_url = None
                img = article.find("img")
                if img:
                    image_url = img.get("src") or img.get("data-src")

                cat_info = categorize_event(title, detail_text)

                description = detail_text[:500].strip()
                if len(detail_text) > 500:
                    description += "..."

                weekday_names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
                if recurrence["week"]:
                    ordinal_names = ["", "first", "second", "third", "fourth"]
                    freq_desc = f"Monthly on the {ordinal_names[recurrence['week']]} {weekday_names[recurrence['weekday']]}"
                else:
                    freq_desc = f"Weekly on {weekday_names[recurrence['weekday']]}"

                series_hint = {
                    "series_type": "class_series",
                    "series_title": title,
                    "frequency": "monthly" if recurrence["week"] else "weekly",
                    "description": f"{title} - {freq_desc}",
                }

                for event_date in future_dates:
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

        logger.info(
            f"Central Rock Gym crawl complete: {events_found} found, {events_new} new"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Central Rock Gym: {e}")
        raise

    return events_found, events_new, events_updated
