"""
Crawler for Essential Theatre (essentialtheatre.com).

Georgia's longest-running company exclusively dedicated to Georgia playwrights.
Resident company at 7 Stages in Little Five Points.

Uses WordPress REST API — structured `et_play` custom post type with `festival`
taxonomy.  Performance dates are embedded in HTML content and must be parsed.
"""

from __future__ import annotations

import json
import logging
import re
from datetime import datetime
from typing import Optional

import requests
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

BASE_URL = "https://www.essentialtheatre.com"
# REST API for the custom `et_play` post type
PLAYS_API = f"{BASE_URL}/wp-json/wp/v2/et_play"
PROGRAMS_API = f"{BASE_URL}/wp-json/wp/v2/et_program"
TICKET_URL = "https://www.tix.com/ticket-sales/essentialtheatre/709"
REQUEST_HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; LostCity/1.0)"}

# Essential Theatre performs at 7 Stages — use existing venue record
PLACE_DATA = {
    "name": "7 Stages",
    "slug": "7-stages",
    "address": "1105 Euclid Ave NE",
    "neighborhood": "Little Five Points",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30307",
    "lat": 33.7648,
    "lng": -84.3491,
    "venue_type": "theater",
    "spot_type": "theater",
    "website": "https://www.7stages.org",
}

# Month names for date parsing
_MONTHS = (
    "january|february|march|april|may|june|"
    "july|august|september|october|november|december"
)

# Patterns WITH explicit year
_DATE_RANGE_CROSS_MONTH = re.compile(
    rf"({_MONTHS})\s+(\d{{1,2}})\s*[-–—]\s*({_MONTHS})\s+(\d{{1,2}}),?\s*(\d{{4}})",
    re.IGNORECASE,
)
_DATE_RANGE_SAME_MONTH = re.compile(
    rf"({_MONTHS})\s+(\d{{1,2}})\s*[-–—]\s*(\d{{1,2}}),?\s*(\d{{4}})",
    re.IGNORECASE,
)
_SINGLE_DATE_WITH_YEAR = re.compile(
    rf"({_MONTHS})\s+(\d{{1,2}}),?\s*(\d{{4}})",
    re.IGNORECASE,
)

# Patterns WITHOUT year (inferred from WP publish date)
# "August 16 at 2pm", "Thursday, August 28 7:30pm"
_SINGLE_DATE_NO_YEAR = re.compile(
    rf"(?:(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday),?\s*)?({_MONTHS})\s+(\d{{1,2}})\b",
    re.IGNORECASE,
)
# "August 7 - 31" (same month range, no year)
_DATE_RANGE_SAME_MONTH_NO_YEAR = re.compile(
    rf"({_MONTHS})\s+(\d{{1,2}})\s*[-–—]\s*(\d{{1,2}})\b(?!\s*,?\s*\d{{4}})",
    re.IGNORECASE,
)
# "August 7 - September 1" (cross month range, no year)
_DATE_RANGE_CROSS_MONTH_NO_YEAR = re.compile(
    rf"({_MONTHS})\s+(\d{{1,2}})\s*[-–—]\s*({_MONTHS})\s+(\d{{1,2}})\b(?!\s*,?\s*\d{{4}})",
    re.IGNORECASE,
)

_TIME_PATTERN = re.compile(
    r"(\d{1,2}(?::\d{2})?)\s*(am|pm)",
    re.IGNORECASE,
)


def _parse_time(text: str) -> Optional[str]:
    """Extract first time mention, return as HH:MM."""
    m = _TIME_PATTERN.search(text)
    if not m:
        return None
    raw, ampm = m.group(1), m.group(2).lower()
    if ":" in raw:
        hour, minute = raw.split(":")
    else:
        hour, minute = raw, "00"
    hour_int = int(hour)
    if ampm == "pm" and hour_int != 12:
        hour_int += 12
    elif ampm == "am" and hour_int == 12:
        hour_int = 0
    return f"{hour_int:02d}:{minute}"


def _parse_date_range(text: str, year_hint: Optional[int] = None) -> tuple[Optional[str], Optional[str]]:
    """Parse date range from HTML content.

    Tries patterns with explicit year first, then yearless patterns using
    year_hint (typically from WP publish date) or current year as fallback.
    """
    # --- Patterns WITH explicit year ---

    # Cross-month: "August 7 - September 1, 2025"
    m = _DATE_RANGE_CROSS_MONTH.search(text)
    if m:
        s_month, s_day, e_month, e_day, year = m.groups()
        try:
            start = datetime.strptime(f"{s_month} {s_day} {year}", "%B %d %Y")
            end = datetime.strptime(f"{e_month} {e_day} {year}", "%B %d %Y")
            return start.strftime("%Y-%m-%d"), end.strftime("%Y-%m-%d")
        except ValueError:
            pass

    # Same month: "August 7 - 31, 2025"
    m = _DATE_RANGE_SAME_MONTH.search(text)
    if m:
        month, s_day, e_day, year = m.groups()
        try:
            start = datetime.strptime(f"{month} {s_day} {year}", "%B %d %Y")
            end = datetime.strptime(f"{month} {e_day} {year}", "%B %d %Y")
            return start.strftime("%Y-%m-%d"), end.strftime("%Y-%m-%d")
        except ValueError:
            pass

    # Single date with year: "January 3, 2026"
    m = _SINGLE_DATE_WITH_YEAR.search(text)
    if m:
        month, day, year = m.groups()
        try:
            dt = datetime.strptime(f"{month} {day} {year}", "%B %d %Y")
            return dt.strftime("%Y-%m-%d"), dt.strftime("%Y-%m-%d")
        except ValueError:
            pass

    # --- Patterns WITHOUT year (use year_hint) ---
    inferred_year = year_hint or datetime.now().year

    # Cross-month no year: "August 7 - September 1"
    m = _DATE_RANGE_CROSS_MONTH_NO_YEAR.search(text)
    if m:
        s_month, s_day, e_month, e_day = m.groups()
        try:
            start = datetime.strptime(f"{s_month} {s_day} {inferred_year}", "%B %d %Y")
            end = datetime.strptime(f"{e_month} {e_day} {inferred_year}", "%B %d %Y")
            return start.strftime("%Y-%m-%d"), end.strftime("%Y-%m-%d")
        except ValueError:
            pass

    # Same month no year: "August 7 - 31"
    m = _DATE_RANGE_SAME_MONTH_NO_YEAR.search(text)
    if m:
        month, s_day, e_day = m.groups()
        try:
            start = datetime.strptime(f"{month} {s_day} {inferred_year}", "%B %d %Y")
            end = datetime.strptime(f"{month} {e_day} {inferred_year}", "%B %d %Y")
            return start.strftime("%Y-%m-%d"), end.strftime("%Y-%m-%d")
        except ValueError:
            pass

    # Single date no year: "August 16", "Thursday, August 28"
    m = _SINGLE_DATE_NO_YEAR.search(text)
    if m:
        month, day = m.groups()
        try:
            dt = datetime.strptime(f"{month} {day} {inferred_year}", "%B %d %Y")
            return dt.strftime("%Y-%m-%d"), dt.strftime("%Y-%m-%d")
        except ValueError:
            pass

    return None, None


def _html_to_text(html: str) -> str:
    """Strip HTML tags, collapse whitespace."""
    soup = BeautifulSoup(html, "html.parser")
    return re.sub(r"\s+", " ", soup.get_text(separator=" ")).strip()


def _extract_description(content_html: str) -> Optional[str]:
    """Pull first substantial paragraph from rendered content."""
    soup = BeautifulSoup(content_html, "html.parser")
    for p in soup.find_all("p"):
        text = p.get_text(strip=True)
        # Skip short fragments, schedule lines, cast credits
        if len(text) > 60 and not re.match(r"^(directed by|written by|starring|cast:|crew:)", text, re.I):
            return text[:500]
    return None


def _get_image_url(play: dict) -> Optional[str]:
    """Extract featured image URL from WP REST response."""
    src = play.get("uagb_featured_image_src")
    if isinstance(src, dict):
        for size in ("full", "large", "medium_large", "medium"):
            url_list = src.get(size)
            if isinstance(url_list, list) and url_list and url_list[0]:
                return str(url_list[0])
    return None


def _infer_subcategory(title: str, content_text: str) -> str:
    """Classify as play, musical, reading, or workshop."""
    combined = f"{title} {content_text}".lower()
    if "reading" in combined or "bare essentials" in combined:
        return "reading"
    if "musical" in combined:
        return "musical"
    if "bootcamp" in combined or "workshop" in combined or "class" in combined:
        return "workshop"
    if "bake-off" in combined or "bakeoff" in combined:
        return "festival"
    return "play"


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Essential Theatre plays via WordPress REST API."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0
    seen_hashes: set[str] = set()
    today = datetime.now().date()

    try:
        venue_id = get_or_create_place(PLACE_DATA)

        # Fetch all plays (they have ~61 total, well under 100 per_page limit)
        logger.info("Fetching Essential Theatre plays: %s", PLAYS_API)
        resp = requests.get(
            PLAYS_API,
            params={"per_page": 100, "orderby": "date", "order": "desc"},
            timeout=30,
            headers=REQUEST_HEADERS,
        )
        resp.raise_for_status()
        plays = resp.json()

        # Also fetch programs (Southern Fried Bake-Off, etc.)
        logger.info("Fetching Essential Theatre programs: %s", PROGRAMS_API)
        prog_resp = requests.get(
            PROGRAMS_API,
            params={"per_page": 50},
            timeout=30,
            headers=REQUEST_HEADERS,
        )
        if prog_resp.ok:
            programs = prog_resp.json()
            plays.extend(programs)

        logger.info("Found %d plays/programs", len(plays))

        for play in plays:
            title = _html_to_text(play.get("title", {}).get("rendered", ""))
            if not title or len(title) < 3:
                continue

            content_html = play.get("content", {}).get("rendered", "")
            content_text = _html_to_text(content_html)

            # Extract year hint from WP publish date (e.g. "2025-07-06T13:40:43")
            year_hint = None
            wp_date = play.get("date", "")
            if wp_date and len(wp_date) >= 4:
                try:
                    year_hint = int(wp_date[:4])
                except ValueError:
                    pass

            # Parse dates from the content body
            start_date, end_date = _parse_date_range(content_text, year_hint=year_hint)
            if not start_date:
                # Try excerpt as fallback
                excerpt_html = play.get("excerpt", {}).get("rendered", "")
                excerpt_text = _html_to_text(excerpt_html)
                start_date, end_date = _parse_date_range(excerpt_text, year_hint=year_hint)

            if not start_date:
                logger.debug("No dates found for: %s", title)
                continue

            # Skip past shows
            check_date = end_date or start_date
            try:
                if datetime.strptime(check_date, "%Y-%m-%d").date() < today:
                    continue
            except ValueError:
                continue

            # Extract time from content
            start_time = _parse_time(content_text) or "19:30"

            description = _extract_description(content_html)
            image_url = _get_image_url(play)
            subcategory = _infer_subcategory(title, content_text)
            source_url = play.get("link") or f"{BASE_URL}/play/{play.get('slug', '')}/"

            tags = ["essential-theatre", "theater", "georgia-playwright", "little-five-points"]

            # Check for festival association
            festival_ids = play.get("festival", [])
            is_festival = bool(festival_ids)
            if is_festival:
                tags.append("essential-theatre-festival")

            # Free readings
            is_free = "free" in content_text.lower() and subcategory == "reading"
            if is_free:
                tags.append("free")

            events_found += 1

            hash_key = f"{start_date}|{start_time}"
            content_hash = generate_content_hash(title, "7 Stages", hash_key)
            seen_hashes.add(content_hash)

            # Series hint for multi-day runs
            series_hint = None
            if end_date and end_date != start_date:
                series_type = "festival_program" if is_festival else "recurring_show"
                series_hint = {
                    "series_type": series_type,
                    "series_title": title,
                }
                if description:
                    series_hint["description"] = description
                if image_url:
                    series_hint["image_url"] = image_url

            event_record = {
                "source_id": source_id,
                "venue_id": venue_id,
                "title": title,
                "description": description or f"{title} — Essential Theatre at 7 Stages",
                "start_date": start_date,
                "start_time": start_time,
                "end_date": end_date,
                "end_time": None,
                "is_all_day": False,
                "category": "theater",
                "subcategory": subcategory,
                "tags": sorted(set(tags)),
                "price_min": None,
                "price_max": None,
                "price_note": None,
                "is_free": is_free,
                "source_url": source_url,
                "ticket_url": TICKET_URL,
                "image_url": image_url,
                "raw_text": None,
                "extraction_confidence": 0.90,
                "is_recurring": bool(end_date and end_date != start_date),
                "recurrence_rule": None,
                "content_hash": content_hash,
            }

            existing = find_event_by_hash(content_hash)
            if existing:
                smart_update_existing_event(existing, event_record)
                events_updated += 1
                continue

            try:
                insert_event(event_record, series_hint=series_hint)
                events_new += 1
                logger.info("Added: %s (%s to %s)", title, start_date, end_date)
            except Exception as e:
                logger.error("Failed to insert: %s: %s", title, e)

        if seen_hashes:
            stale_removed = remove_stale_source_events(source_id, seen_hashes)
            if stale_removed:
                logger.info("Removed %d stale Essential Theatre events", stale_removed)

        logger.info(
            "Essential Theatre crawl complete: %d found, %d new, %d updated",
            events_found,
            events_new,
            events_updated,
        )

    except Exception as exc:
        logger.error("Failed to crawl Essential Theatre: %s", exc)
        raise

    return events_found, events_new, events_updated
