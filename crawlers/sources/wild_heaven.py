"""
Crawler for Wild Heaven Beer (wildheavenbeer.com).
Avondale Estates brewery with live music, trivia, yoga, open mic, and food trucks.
Site is JS-rendered — uses Playwright.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime
from typing import Optional

from playwright.sync_api import sync_playwright

from db import get_or_create_venue, insert_event, find_event_by_hash
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://wildheavenbeer.com"
EVENTS_URL = f"{BASE_URL}/avondale/events"

VENUE_DATA = {
    "name": "Wild Heaven Beer",
    "slug": "wild-heaven-beer",
    "address": "135B Clairemont Ave",
    "neighborhood": "Avondale Estates",
    "city": "Decatur",
    "state": "GA",
    "zip": "30030",
    "lat": 33.7745,
    "lng": -84.2963,
    "venue_type": "brewery",
    "spot_type": "brewery",
    "website": BASE_URL,
    "vibes": ["craft-beer", "brewery", "taproom", "avondale-estates", "patio", "live-music"],
}


def parse_date(date_text: str) -> Optional[str]:
    """Parse date from various formats found on the Wild Heaven site."""
    date_text = date_text.strip()
    now = datetime.now()
    year = now.year

    # Remove day of week prefix
    date_text = re.sub(
        r"^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s*",
        "", date_text, flags=re.IGNORECASE,
    )

    for fmt in ("%B %d, %Y", "%B %d", "%b %d, %Y", "%b %d"):
        try:
            dt = datetime.strptime(date_text, fmt)
            if "%Y" not in fmt:
                dt = dt.replace(year=year)
                if dt < now:
                    dt = dt.replace(year=year + 1)
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            continue

    return None


def parse_time(time_text: str) -> Optional[str]:
    """Parse time from formats like '7:00 PM', '7 PM', '10:30 AM'."""
    if not time_text:
        return None
    match = re.search(r"(\d{1,2})(?::(\d{2}))?\s*(am|pm)", time_text, re.IGNORECASE)
    if match:
        hour = int(match.group(1))
        minute = int(match.group(2)) if match.group(2) else 0
        period = match.group(3).lower()
        if period == "pm" and hour != 12:
            hour += 12
        elif period == "am" and hour == 12:
            hour = 0
        return f"{hour:02d}:{minute:02d}"
    return None


def categorize_event(title: str, description: str = "") -> tuple[str, Optional[str], list[str]]:
    """Assign category, subcategory, and tags based on event content."""
    text = f"{title} {description}".lower()
    base_tags = ["brewery", "beer", "craft-beer", "avondale-estates"]

    if any(w in text for w in ["live music", "band", "concert", "musician", "acoustic", "dj set"]):
        return "music", "music.live", base_tags + ["live-music"]

    if any(w in text for w in ["open mic", "open-mic", "openmic"]):
        return "music", "music.open_mic", base_tags + ["open-mic", "live-music"]

    if "karaoke" in text:
        return "nightlife", "nightlife.karaoke", base_tags + ["karaoke"]

    if "trivia" in text:
        return "nightlife", "nightlife.trivia", base_tags + ["trivia", "games"]

    if any(w in text for w in ["drag", "drag show", "drag queen"]):
        return "nightlife", "nightlife.drag", base_tags + ["drag"]

    if any(w in text for w in ["yoga"]):
        return "fitness", "fitness.yoga", base_tags + ["yoga", "fitness"]

    if any(w in text for w in ["run club", "running"]):
        return "fitness", "fitness.running", base_tags + ["running", "fitness"]

    if any(w in text for w in ["fitness", "workout"]):
        return "fitness", "fitness.dance", base_tags + ["fitness"]

    if any(w in text for w in ["comedy", "comedian", "stand-up", "standup"]):
        return "comedy", "comedy.standup", base_tags + ["comedy"]

    if any(w in text for w in ["movie night", "film", "screening"]):
        return "film", "film.repertory", base_tags + ["movie-night"]

    if any(w in text for w in ["food truck", "taco", "bbq", "pop-up kitchen"]):
        return "food_drink", "food_drink.popup", base_tags + ["food-truck"]

    if any(w in text for w in ["beer release", "release", "new beer", "tap takeover"]):
        return "food_drink", "food_drink.tasting", base_tags + ["beer-release"]

    if any(w in text for w in ["fundraiser", "charity", "benefit"]):
        return "community", "community.meetup", base_tags + ["fundraiser"]

    if any(w in text for w in ["market", "makers", "craft fair", "vendor"]):
        return "markets", None, base_tags + ["market"]

    # Default: nightlife/brewery event
    return "nightlife", None, base_tags


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Wild Heaven Beer events using Playwright."""
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

            logger.info(f"Fetching Wild Heaven Beer: {EVENTS_URL}")
            page.goto(EVENTS_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(5000)

            # Scroll to load lazy content
            for _ in range(5):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1500)

            # Extract text-based event blocks
            # Page structure per event:
            #   TITLE
            #   Day-abbrev (e.g. "Sun")
            #   MONTH-ABBREV (e.g. "FEB")
            #   DAY-NUMBER (e.g. "8")
            #   "Sun, Feb 8, 2026 (Avondale)"   <-- parseable date line
            #   Description text
            #   "EVENT DETAILS"
            body_text = page.inner_text("body")
            lines = [line.strip() for line in body_text.split("\n") if line.strip()]

            seen_events = set()
            # Non-event recurring promos to skip
            skip_titles = {
                "closing early", "half-priced pitchers", "thirsty thursday",
            }

            i = 0
            while i < len(lines):
                line = lines[i]

                # Match the full date line: "Sun, Feb 8, 2026 (Avondale)"
                date_match = re.match(
                    r"^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun),\s+"
                    r"((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},\s+\d{4})"
                    r"\s+\(.*\)$",
                    line, re.IGNORECASE,
                )

                if date_match:
                    date_str = date_match.group(1)
                    start_date = parse_date(date_str)
                    if not start_date:
                        i += 1
                        continue

                    # Title is ~4 lines before the date line
                    title = None
                    for offset in [-4, -3, -5, -2]:
                        idx = i + offset
                        if 0 <= idx < len(lines):
                            candidate = lines[idx].strip()
                            # Title lines are longer than day/month abbreviations
                            if (len(candidate) > 5
                                    and candidate.upper() == candidate  # Titles are ALL CAPS on this site
                                    and candidate not in ("EVENT DETAILS", "LOCATIONS", "OUR BEERS", "ABOUT")
                                    and not re.match(r"^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)$", candidate, re.IGNORECASE)
                                    and not re.match(r"^(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)$", candidate)
                                    and not re.match(r"^\d{1,2}$", candidate)):
                                title = candidate.title()  # Convert "LIVE MUSIC: BLACKFOOT DAISY AT 6 PM" to title case
                                break

                    if not title:
                        i += 1
                        continue

                    # Skip non-event promos
                    if any(skip in title.lower() for skip in skip_titles):
                        i += 1
                        continue

                    # Description is the line after the date
                    description = None
                    if i + 1 < len(lines):
                        desc_candidate = lines[i + 1].strip()
                        if desc_candidate != "EVENT DETAILS" and len(desc_candidate) > 10:
                            description = desc_candidate[:500]

                    # Extract time from title (e.g., "Live Music: Blackfoot Daisy At 6 Pm")
                    start_time = None
                    time_in_title = re.search(r"at\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm))", title, re.IGNORECASE)
                    if time_in_title:
                        start_time = parse_time(time_in_title.group(1))
                    # Also check description for time
                    if not start_time and description:
                        time_in_desc = re.search(r"at\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm))", description, re.IGNORECASE)
                        if time_in_desc:
                            start_time = parse_time(time_in_desc.group(1))

                    # Clean title: remove "at 6 PM" suffix
                    clean_title = re.sub(r"\s+At\s+\d{1,2}(?::\d{2})?\s*(?:Am|Pm)$", "", title).strip()
                    if clean_title:
                        title = clean_title

                    # Dedup within this crawl
                    event_key = f"{title}|{start_date}"
                    if event_key in seen_events:
                        i += 1
                        continue
                    seen_events.add(event_key)

                    events_found += 1

                    content_hash = generate_content_hash(title, "Wild Heaven Beer", start_date)
                    if find_event_by_hash(content_hash):
                        events_updated += 1
                        i += 1
                        continue

                    category, subcategory, tags = categorize_event(title, description or "")

                    event_record = {
                        "source_id": source_id,
                        "venue_id": venue_id,
                        "title": title,
                        "description": description,
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
                        "is_free": True,
                        "source_url": EVENTS_URL,
                        "ticket_url": None,
                        "image_url": None,
                        "raw_text": f"{title} - {start_date}",
                        "extraction_confidence": 0.85,
                        "is_recurring": False,
                        "recurrence_rule": None,
                        "content_hash": content_hash,
                    }

                    try:
                        insert_event(event_record)
                        events_new += 1
                        logger.info(f"  Added: [{category}] {title} on {start_date} at {start_time}")
                    except Exception as e:
                        logger.error(f"  Failed to insert: {title}: {e}")

                i += 1

            browser.close()

        logger.info(
            f"Wild Heaven Beer: {events_found} found, {events_new} new, {events_updated} existing"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Wild Heaven Beer: {e}")
        raise

    return events_found, events_new, events_updated
