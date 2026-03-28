"""
Crawler for Atlanta Roller Derby (atlantarollerderby.com).
Women's flat track roller derby league with home teams and all-star travel teams.

Site uses Squarespace with static HTML that can be parsed with Playwright.
Each event has double-header bouts (two matches per date).
"""

from __future__ import annotations

import re
import logging
from datetime import date, datetime
from typing import Optional

from playwright.sync_api import sync_playwright
from bs4 import BeautifulSoup

from db import (
    find_event_by_hash,
    get_or_create_place,
    insert_event,
    remove_stale_source_events,
    smart_update_existing_event,
)
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://atlantarollerderby.com"
SCHEDULE_URL = f"{BASE_URL}/schedule"

PLACE_DATA = {
    "name": "Atlanta Roller Derby",
    "slug": "atlanta-roller-derby",
    "address": "225 E Dougherty St",
    "neighborhood": "Decatur",
    "city": "Decatur",
    "state": "GA",
    "zip": "30030",
    "lat": 33.7704,
    "lng": -84.2963,
    "place_type": "arena",
    "spot_type": "arena",
    "website": BASE_URL,
    "description": "Atlanta's premier women's flat track roller derby league competing at Agnes Scott College.",
    "vibes": ["roller-derby", "women-sports", "live-sports", "family-friendly"],
}

# Month names to numbers
MONTH_MAP = {
    "january": 1, "february": 2, "march": 3, "april": 4, "may": 5, "june": 6,
    "july": 7, "august": 8, "september": 9, "october": 10, "november": 11, "december": 12,
}


def build_matchup_participants(*bouts: str | None) -> list[dict]:
    """Return structured team participants from parsed bout strings."""
    participants: list[dict] = []
    seen: set[str] = set()

    for bout in bouts:
        if not bout or " vs " not in bout.lower():
            continue

        left, right = re.split(r"\s+vs\s+", bout, maxsplit=1, flags=re.IGNORECASE)
        for team in (left.strip(), right.strip()):
            if not team or team.upper() == "TBD" or team.upper().startswith("TBD "):
                continue
            normalized = team.lower()
            if normalized in seen:
                continue
            seen.add(normalized)
            participants.append(
                {
                    "name": team,
                    "role": "team",
                    "billing_order": len(participants) + 1,
                }
            )

    return participants


def parse_date(date_str: str, *, today: date | None = None) -> Optional[str]:
    """
    Parse date from format 'March 21' or 'February 28'.
    Returns YYYY-MM-DD string.

    Args:
        date_str: Date string to parse
        today: Reference date for determining year (defaults to today)
    """
    date_str = date_str.strip()
    match = re.match(r"(\w+)\s+(\d{1,2})", date_str, re.IGNORECASE)
    if not match:
        return None

    month_name, day = match.groups()
    month_name = month_name.lower()

    if month_name not in MONTH_MAP:
        return None

    month = MONTH_MAP[month_name]
    day = int(day)

    # Determine year (assume current year or next year if date has passed)
    ref_date = today or datetime.now().date()
    year = ref_date.year

    try:
        event_date = datetime(year, month, day)
        # If date is in the past, use next year
        if event_date.date() < ref_date:
            year += 1
            event_date = datetime(year, month, day)

        return event_date.strftime("%Y-%m-%d")
    except ValueError:
        return None


def parse_time(time_str: str) -> Optional[str]:
    """
    Parse time from format like '5:00pm' or '7:30pm'.
    Returns HH:MM in 24-hour format.
    """
    match = re.match(r"(\d{1,2}):(\d{2})\s*(am|pm)", time_str.strip(), re.IGNORECASE)
    if not match:
        return None

    hour, minute, period = match.groups()
    hour = int(hour)

    if period.lower() == "pm" and hour != 12:
        hour += 12
    elif period.lower() == "am" and hour == 12:
        hour = 0

    return f"{hour:02d}:{minute}"


def extract_schedule_events(html_content: str, *, today: date | None = None) -> list[dict]:
    ref_today = today or datetime.now().date()
    soup = BeautifulSoup(html_content, "html.parser")

    events: list[dict] = []
    date_headings = soup.find_all("h3")
    for h3 in date_headings:
        date_text = h3.get_text(strip=True)
        start_date = parse_date(date_text, today=ref_today)
        if not start_date:
            continue
        if datetime.strptime(start_date, "%Y-%m-%d").date() < ref_today:
            continue

        section = h3.find_parent("section")
        if not section:
            logger.warning(f"No section found for date: {date_text}")
            continue

        paragraphs = section.find_all("p")
        times = None
        bout_1 = None
        bout_2 = None
        ticket_url = None

        for p in paragraphs:
            p_text = p.get_text(strip=True)

            if re.search(r"\d{1,2}:\d{2}\s*(?:am|pm)", p_text, re.IGNORECASE):
                if "&" in p_text or "and" in p_text.lower():
                    time_matches = re.findall(r"(\d{1,2}:\d{2}\s*(?:am|pm))", p_text, re.IGNORECASE)
                    if len(time_matches) >= 2:
                        times = (parse_time(time_matches[0]), parse_time(time_matches[1]))
                else:
                    time_match = re.search(r"(\d{1,2}:\d{2}\s*(?:am|pm))", p_text, re.IGNORECASE)
                    if time_match:
                        times = (parse_time(time_match.group(1)), None)

            if re.search(r"\d{1,2}:\d{2}\s*(?:am|pm)\s*:", p_text, re.IGNORECASE):
                parts = re.split(r"(\d{1,2}:\d{2}\s*(?:am|pm)\s*:)", p_text, flags=re.IGNORECASE)
                i = 0
                while i < len(parts):
                    if re.match(r"\d{1,2}:\d{2}\s*(?:am|pm)\s*:", parts[i], re.IGNORECASE):
                        if i + 1 < len(parts):
                            matchup = parts[i + 1].strip()
                            if matchup:
                                if not bout_1:
                                    bout_1 = matchup
                                elif not bout_2:
                                    bout_2 = matchup
                            i += 2
                        else:
                            i += 1
                    else:
                        i += 1

        for link in section.find_all("a"):
            href = link.get("href", "")
            text = link.get_text(strip=True).lower()
            if ("ticket" in text or "buy" in text) and href:
                if href.startswith("http"):
                    ticket_url = href
                elif href.startswith("/"):
                    ticket_url = f"{BASE_URL}{href}"

        if bout_1 and bout_2:
            title = f"Roller Derby Double-Header: {bout_1} / {bout_2}"
        elif bout_1:
            title = f"Roller Derby: {bout_1}"
        else:
            title = "Roller Derby Bout"

        description_parts = []
        if bout_1:
            description_parts.append(f"Bout 1: {bout_1}")
        if bout_2:
            description_parts.append(f"Bout 2: {bout_2}")
        description_parts.append(
            "Atlanta Roller Derby hosts exciting flat track roller derby action at Agnes Scott College's Woodruff Athletic Complex."
        )
        description_parts.append("Doors at 5:00pm. Double-header featuring two exciting matchups.")

        events.append(
            {
                "title": title,
                "description": " ".join(description_parts),
                "start_date": start_date,
                "start_time": times[0] if times else "17:00",
                "ticket_url": ticket_url,
                "raw_text": f"{date_text} | {bout_1 or ''} | {bout_2 or ''}",
                "participants": build_matchup_participants(bout_1, bout_2),
            }
        )

    return events


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Atlanta Roller Derby schedule using Playwright."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0
    current_hashes: set[str] = set()

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
                viewport={"width": 1920, "height": 1080},
            )
            page = context.new_page()

            # Get or create venue
            venue_id = get_or_create_place(PLACE_DATA)

            logger.info(f"Fetching Atlanta Roller Derby schedule: {SCHEDULE_URL}")
            page.goto(SCHEDULE_URL, wait_until="networkidle", timeout=60000)
            page.wait_for_timeout(3000)

            # Get page HTML
            html_content = page.content()
            browser.close()

        for event in extract_schedule_events(html_content):
            events_found += 1
            content_hash = generate_content_hash(event["title"], PLACE_DATA["name"], event["start_date"])
            current_hashes.add(content_hash)

            # Create event record
            event_record = {
                "source_id": source_id,
                "place_id": venue_id,
                "title": event["title"],
                "description": event["description"],
                "start_date": event["start_date"],
                "start_time": event["start_time"],
                "end_date": None,
                "end_time": None,
                "is_all_day": False,
                "category": "sports",
                "subcategory": "roller_derby",
                "tags": ["roller-derby", "atlanta-roller-derby", "decatur", "women-sports", "live-sports"],
                "price_min": None,
                "price_max": None,
                "price_note": "Check website for ticket pricing",
                "is_free": False,
                "source_url": event["ticket_url"] or SCHEDULE_URL,
                "ticket_url": event["ticket_url"],
                "image_url": None,
                "raw_text": event["raw_text"],
                "extraction_confidence": 0.90,
                "is_recurring": False,
                "recurrence_rule": None,
                "content_hash": content_hash,
                "_parsed_artists": event["participants"],
            }

            existing = find_event_by_hash(content_hash)
            if existing:
                smart_update_existing_event(existing, event_record)
                events_updated += 1
                continue

            try:
                insert_event(event_record)
                events_new += 1
                logger.info(f"Added: {event['title']} on {event['start_date']}")
            except Exception as e:
                logger.error(f"Failed to insert event: {event['title']}: {e}")

        removed = remove_stale_source_events(source_id, current_hashes)
        if removed:
            logger.info(f"Removed {removed} stale Atlanta Roller Derby events")

        logger.info(
            f"Atlanta Roller Derby crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Atlanta Roller Derby: {e}")
        raise

    return events_found, events_new, events_updated
