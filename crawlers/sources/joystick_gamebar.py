"""
Crawler for Joystick Gamebar (joystickgamebar.com).

Site uses JavaScript rendering - must use Playwright.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime
from typing import Optional

from playwright.sync_api import sync_playwright

from db import get_or_create_place, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash
from utils import extract_images_from_page, extract_event_links, find_event_url

logger = logging.getLogger(__name__)

BASE_URL = "https://www.joystickgamebar.com"
EVENTS_URL = f"{BASE_URL}/events"

# Recurring-type detection: these keywords in the title imply the event is a
# weekly standing-order at Joystick (every-Thursday trivia, every-Monday bingo,
# etc.). Events matching these get grouped into a single series so the feed
# shows "Trivia Night" once with a schedule instead of 8 separate cards.
_RECURRING_TITLE_KEYWORDS = (
    "bingo",
    "trivia",
    "quiz",
    "karaoke",
)


def _is_joystick_recurring_type(title: str) -> bool:
    t = (title or "").lower()
    return any(k in t for k in _RECURRING_TITLE_KEYWORDS)


_JOYSTICK_SPONSOR_SUFFIX_RE = re.compile(
    r"\s+(?:sponsored|presented|hosted)\s+by\b.*$",
    re.IGNORECASE,
)
_JOYSTICK_ISSUE_NUMBER_RE = re.compile(r"\s*#\s*\d+\s*$")
_JOYSTICK_DATE_SUFFIX_RE = re.compile(
    r"\s*(?:-|–|—|:)\s*"
    r"(?:"
    r"\d{1,2}/\d{1,2}(?:/\d{2,4})?"
    r"|"
    r"(?:(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*\s+)?"
    r"(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2}(?:,?\s*\d{4})?"
    r")"
    r"\s*$",
    re.IGNORECASE,
)


def _normalize_series_title(title: str) -> str:
    """Strip instance-specific suffixes so every weekly instance shares a series.

    "Trivia Night #42"       → "Trivia Night"
    "Bingo Night - March 15" → "Bingo Night"
    "Karaoke Thursday - 3/7" → "Karaoke Thursday"
    """
    cleaned = (title or "").strip()
    cleaned = _JOYSTICK_ISSUE_NUMBER_RE.sub("", cleaned)
    cleaned = _JOYSTICK_DATE_SUFFIX_RE.sub("", cleaned)
    cleaned = _JOYSTICK_SPONSOR_SUFFIX_RE.sub("", cleaned)
    return cleaned.strip(" -:–—") or (title or "").strip()

PLACE_DATA = {
    "name": "Joystick Gamebar",
    "slug": "joystick-gamebar",
    "address": "427 Edgewood Ave SE",
    "neighborhood": "Edgewood",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30312",
    "lat": 33.7541,
    "lng": -84.3725,
    "place_type": "bar",
    "spot_type": "bar",
    "website": BASE_URL,
    "image_url": "https://images.squarespace-cdn.com/content/v1/5c4a69e37c9327f7a21fbed1/1584564799207-7FMDT9JRJTZHBPSHS0M8/Joystick-4.jpg",
    "description": (
        "Joystick Gamebar is a LGBTQ-inclusive retro arcade bar on Edgewood Ave, "
        "packed with classic arcade and pinball machines, craft drinks, and a weekly "
        "calendar of bingo nights, tournaments, and themed events."
    ),
    "hours": {
        "monday": {"open": "16:00", "close": "02:30"},
        "tuesday": {"open": "16:00", "close": "02:30"},
        "wednesday": {"open": "16:00", "close": "02:30"},
        "thursday": {"open": "16:00", "close": "02:30"},
        "friday": {"open": "16:00", "close": "02:30"},
        "saturday": {"open": "12:00", "close": "02:30"},
        "sunday": {"open": "12:00", "close": "00:00"},
    },
    "vibes": ["lgbtq", "arcade", "games", "bar-games", "casual", "retro", "edgewood"],
}


def extract_description_from_context(lines: list[str], title_idx: int, title: str) -> str:
    """Pull a meaningful description from lines surrounding the event title."""
    candidates = []
    for offset in range(1, 6):
        idx = title_idx + offset
        if idx >= len(lines):
            break
        line = lines[idx]
        if re.match(
            r"(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|January|February|March|April|May|June|July|August|September|October|November|December)",
            line,
            re.IGNORECASE,
        ):
            break
        if re.match(r"(tickets?|register|buy|more info|\$\d|reserve)", line, re.IGNORECASE):
            break
        if len(line) > 20 and line != title:
            candidates.append(line)
        if len(candidates) >= 2:
            break
    if candidates:
        desc = " ".join(candidates)
        if len(desc) > 400:
            desc = desc[:397] + "..."
        return desc
    return ""


def parse_time(time_text: str) -> Optional[str]:
    """Parse time from '7:00 PM' format."""
    match = re.search(r"(\d{1,2}):(\d{2})\s*(am|pm)", time_text, re.IGNORECASE)
    if match:
        hour, minute, period = match.groups()
        hour = int(hour)
        if period.lower() == "pm" and hour != 12:
            hour += 12
        elif period.lower() == "am" and hour == 12:
            hour = 0
        return f"{hour:02d}:{minute}"
    return None


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Joystick Gamebar events using Playwright."""
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

            venue_id = get_or_create_place(PLACE_DATA)

            logger.info(f"Fetching Joystick Gamebar: {EVENTS_URL}")
            page.goto(EVENTS_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(3000)

            # Extract images from page
            image_map = extract_images_from_page(page)

            # Extract event links for specific URLs
            event_links = extract_event_links(page, BASE_URL)

            # Scroll to load all content
            for _ in range(5):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1000)

            # Get page text and parse line by line
            body_text = page.inner_text("body")
            lines = [l.strip() for l in body_text.split("\n") if l.strip()]

            # Parse events - look for date patterns
            i = 0
            while i < len(lines):
                line = lines[i]

                # Skip navigation items
                if len(line) < 3:
                    i += 1
                    continue

                # Look for date patterns
                date_match = re.match(
                    r"(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)?,?\s*(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})(?:,?\s+(\d{4}))?",
                    line,
                    re.IGNORECASE
                )

                if date_match:
                    month = date_match.group(1)
                    day = date_match.group(2)
                    year = date_match.group(3) if date_match.group(3) else str(datetime.now().year)

                    # Look for title in surrounding lines
                    title = None
                    start_time = None

                    for offset in [-2, -1, 1, 2, 3]:
                        idx = i + offset
                        if 0 <= idx < len(lines):
                            check_line = lines[idx]
                            if re.match(r"(January|February|March)", check_line, re.IGNORECASE):
                                continue
                            if not start_time:
                                time_result = parse_time(check_line)
                                if time_result:
                                    start_time = time_result
                                    continue
                            if not title and len(check_line) > 5:
                                if not re.match(r"\d{1,2}[:/]", check_line):
                                    if not re.match(r"(free|tickets|register|\$|more info)", check_line.lower()):
                                        title = check_line
                                        break

                    if not title:
                        i += 1
                        continue

                    # Parse date
                    try:
                        month_str = month[:3] if len(month) > 3 else month
                        dt = datetime.strptime(f"{month_str} {day} {year}", "%b %d %Y")
                        if dt.date() < datetime.now().date():
                            dt = datetime.strptime(f"{month_str} {day} {int(year) + 1}", "%b %d %Y")
                        start_date = dt.strftime("%Y-%m-%d")
                    except ValueError:
                        i += 1
                        continue

                    events_found += 1

                    content_hash = generate_content_hash(title, "Joystick Gamebar", start_date)


                    # Get specific event URL
                    event_url = find_event_url(title, event_links, EVENTS_URL)

                    # Extract real description from surrounding lines
                    description = extract_description_from_context(lines, i, title)

                    # Detect free events from surrounding context
                    context_text = " ".join(lines[max(0, i - 3):min(len(lines), i + 6)]).lower()
                    is_free = any(
                        w in context_text
                        for w in ["free", "no cover", "no charge", "free admission", "free event"]
                    )

                    # Infer subcategory and genres from title
                    title_lower = title.lower()
                    subcategory = "nightlife.bar_games"
                    genres = ["bar-games"]
                    tags = ["arcade", "21+", "lgbtq"]

                    if "bingo" in title_lower:
                        subcategory = "nightlife.bingo"
                        genres = ["bingo", "bar-games"]
                        tags.append("bingo")
                    elif "trivia" in title_lower or "quiz" in title_lower:
                        subcategory = "nightlife.bar_games"
                        genres = ["trivia", "bar-games"]
                        tags.extend(["trivia", "bar-games"])
                    elif "tournament" in title_lower or "compete" in title_lower:
                        tags.extend(["bar-games", "tournament"])
                    elif "karaoke" in title_lower:
                        subcategory = "nightlife.karaoke"
                        genres = ["karaoke"]
                        tags.append("karaoke")
                    elif "drag" in title_lower or "show" in title_lower:
                        subcategory = "nightlife.drag"
                        genres = ["drag"]
                        tags.append("drag")
                    else:
                        tags.append("bar-games")

                    # Joystick runs weekly standing-orders for bingo/trivia/karaoke.
                    # When the title matches a recurring type, flag is_recurring
                    # and pass a normalized series_hint so all weekly instances
                    # aggregate under one series (shows as "Trivia Night — every
                    # Thursday" instead of 8 duplicate cards).
                    is_recurring_type = _is_joystick_recurring_type(title)
                    series_hint: Optional[dict] = None
                    if is_recurring_type:
                        series_title = _normalize_series_title(title)
                        series_hint = {
                            "series_type": "recurring_show",
                            "series_title": series_title,
                            "frequency": "weekly",
                        }

                    event_record = {
                        "source_id": source_id,
                        "place_id": venue_id,
                        "title": title,
                        "description": description or None,
                        "start_date": start_date,
                        "start_time": start_time,
                        "end_date": None,
                        "end_time": None,
                        "is_all_day": False,
                        "category": "nightlife",
                        "subcategory": subcategory,
                        "genres": genres,
                        "tags": tags,
                        "price_min": None,
                        "price_max": None,
                        "price_note": None,
                        "is_free": is_free,
                        "source_url": event_url,
                        "ticket_url": event_url,
                        "image_url": image_map.get(title),
                        "raw_text": f"{title} - {start_date}",
                        "extraction_confidence": 0.80,
                        "is_recurring": is_recurring_type,
                        "recurrence_rule": "FREQ=WEEKLY" if is_recurring_type else None,
                        "content_hash": content_hash,
                    }

                    existing = find_event_by_hash(content_hash)
                    if existing:
                        smart_update_existing_event(existing, event_record)
                        events_updated += 1
                        i += 1
                        continue

                    try:
                        insert_event(event_record, series_hint=series_hint)
                        events_new += 1
                        logger.info(f"Added: {title} on {start_date}")
                    except Exception as e:
                        logger.error(f"Failed to insert: {title}: {e}")

                i += 1

            browser.close()

        logger.info(
            f"Joystick Gamebar crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Joystick Gamebar: {e}")
        raise

    return events_found, events_new, events_updated
