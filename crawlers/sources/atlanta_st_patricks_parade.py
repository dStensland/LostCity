"""
Crawler for the Atlanta St. Patrick's Parade site.

Captures the annual parade and official 5K road race details.
"""

from __future__ import annotations

import html
import logging
import re
from datetime import datetime, timedelta
from typing import Optional
from urllib.error import URLError
from urllib.request import Request, urlopen

from bs4 import BeautifulSoup

from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://atlantastpats.com"
HOME_URL = f"{BASE_URL}/"
RACE_URL = f"{BASE_URL}/events/"
MAP_URL = f"{BASE_URL}/parade-info/map/"

PARADE_VENUE = {
    "name": "Peachtree Street (Midtown)",
    "slug": "peachtree-street-midtown",
    "address": "15th St & Peachtree St NE",
    "neighborhood": "Midtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30309",
    "venue_type": "outdoor_venue",
    "website": BASE_URL,
}

RACE_VENUE = {
    "name": "Fado Irish Pub Midtown",
    "slug": "fado-irish-pub-midtown",
    "address": "933 Peachtree St NE",
    "neighborhood": "Midtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30309",
    "venue_type": "bar",
    "website": "https://www.fadoirishpub.com/atlanta",
}

MONTH_PATTERN = r"(January|February|March|April|May|June|July|August|September|October|November|December)"


def clean_text(value: str) -> str:
    if not value:
        return ""
    text = html.unescape(value)
    return re.sub(r"\s+", " ", text).strip()


def clean_html(value: str) -> str:
    if not value:
        return ""
    soup = BeautifulSoup(value, "html.parser")
    return clean_text(soup.get_text(" ", strip=True))


def fetch_html(url: str) -> Optional[str]:
    try:
        req = Request(
            url,
            headers={
                "User-Agent": (
                    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/122.0.0.0 Safari/537.36"
                ),
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.9",
                "Connection": "keep-alive",
                "Upgrade-Insecure-Requests": "1",
            },
        )
        with urlopen(req, timeout=20) as response:
            return response.read().decode("utf-8", errors="ignore")
    except URLError as e:
        logger.warning(f"Failed to fetch {url}: {e}")
        return None


def extract_og_image(page_html: str) -> Optional[str]:
    soup = BeautifulSoup(page_html, "html.parser")
    og = soup.find("meta", attrs={"property": "og:image"})
    if og and og.get("content"):
        return og["content"].strip()
    return None


def extract_runsignup_url(page_html: str) -> Optional[str]:
    soup = BeautifulSoup(page_html, "html.parser")
    for link in soup.select("a[href]"):
        href = (link.get("href") or "").strip()
        if "runsignup.com" in href.lower():
            return href
    return None


def _candidate_date_from_match(month: str, day: str, year: str) -> Optional[str]:
    try:
        dt = datetime.strptime(f"{month} {day} {year}", "%B %d %Y")
        return dt.strftime("%Y-%m-%d")
    except ValueError:
        return None


def pick_best_future_date(candidates: list[str]) -> Optional[str]:
    """Pick the most likely current parade date from several date mentions."""
    if not candidates:
        return None

    today = datetime.now().date()
    parsed = []
    for candidate in candidates:
        try:
            parsed.append(datetime.strptime(candidate, "%Y-%m-%d").date())
        except ValueError:
            continue

    if not parsed:
        return None

    upcoming = sorted([d for d in parsed if today - timedelta(days=45) <= d <= today + timedelta(days=400)])
    if upcoming:
        return upcoming[0].strftime("%Y-%m-%d")

    return max(parsed).strftime("%Y-%m-%d")


def parse_parade_date_from_text(text: str) -> Optional[str]:
    """Extract the current parade date from page text."""
    candidates: list[str] = []
    patterns = [rf"(?:SATURDAY,\s*)?MARCH\s+(\d{{1,2}})(?:st|nd|rd|th)?[, ]+\s*(20\d{{2}})"]

    for pattern in patterns:
        for match in re.finditer(pattern, text, flags=re.IGNORECASE):
            groups = match.groups()
            if len(groups) == 2:
                month, day, year = "March", groups[0], groups[1]
            else:
                month, day, year = groups[0], groups[1], groups[2]
            candidate = _candidate_date_from_match(month.title(), day, year)
            if candidate:
                candidates.append(candidate)

    return pick_best_future_date(candidates)


def parse_time_from_text(text: str) -> Optional[str]:
    """Extract a single time from text and convert to HH:MM."""
    if re.search(r"\bnoon\b", text, flags=re.IGNORECASE):
        return "12:00"

    match = re.search(r"\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b", text, flags=re.IGNORECASE)
    if not match:
        return None

    hour = int(match.group(1))
    minute = int(match.group(2) or 0)
    period = match.group(3).lower()

    if period == "pm" and hour != 12:
        hour += 12
    if period == "am" and hour == 12:
        hour = 0

    return f"{hour:02d}:{minute:02d}"


def parse_race_datetime(text: str) -> tuple[Optional[str], Optional[str]]:
    """
    Parse race-specific date and start time.

    Example:
    "Saturday, March 14, 2026 - 9:45 am start time"
    """
    match = re.search(
        rf"(?:Saturday,\s*)?{MONTH_PATTERN}\s+(\d{{1,2}}),\s*(20\d{{2}})\s*[–-]\s*"
        r"(\d{1,2})(?::(\d{2}))?\s*(am|pm)",
        text,
        flags=re.IGNORECASE,
    )
    if not match:
        return None, None

    month, day, year, hour, minute, period = match.groups()
    start_date = _candidate_date_from_match(month.title(), day, year)
    if not start_date:
        return None, None

    hour_num = int(hour)
    minute_num = int(minute or 0)
    period = period.lower()
    if period == "pm" and hour_num != 12:
        hour_num += 12
    if period == "am" and hour_num == 12:
        hour_num = 0

    return start_date, f"{hour_num:02d}:{minute_num:02d}"


def upsert_event(event_record: dict) -> tuple[bool, bool]:
    """Insert or update event and return (is_new, is_updated)."""
    existing = find_event_by_hash(event_record["content_hash"])
    if existing:
        smart_update_existing_event(existing, event_record)
        return False, True
    insert_event(event_record)
    return True, False


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Atlanta St. Patrick's Parade pages."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    home_html = fetch_html(HOME_URL)
    race_html = fetch_html(RACE_URL)
    map_html = fetch_html(MAP_URL)

    if not home_html:
        logger.error("Cannot crawl parade source without home page content")
        return events_found, events_new, events_updated

    parade_venue_id = get_or_create_venue(PARADE_VENUE)
    race_venue_id = get_or_create_venue(RACE_VENUE)

    home_text = clean_html(home_html)
    race_text = clean_html(race_html or "")
    map_text = clean_html(map_html or "")
    combined_text = " ".join([home_text, race_text, map_text])

    parade_time = parse_time_from_text(map_text) or "12:00"
    parade_image = extract_og_image(home_html)
    race_date, race_time = parse_race_datetime(race_text)
    parade_date = parse_parade_date_from_text(combined_text)

    if race_date:
        parade_date = race_date

    if race_html:
        race_ticket_url = extract_runsignup_url(race_html)
        race_image = extract_og_image(race_html)

        if race_date:
            events_found += 1
            race_title = "St. Patrick's Parade 5K Road Race"
            race_hash = generate_content_hash(race_title, RACE_VENUE["name"], race_date)
            race_record = {
                "source_id": source_id,
                "venue_id": race_venue_id,
                "title": race_title,
                "description": (
                    "Official Atlanta St. Patrick's Parade 5K through Midtown, "
                    "finishing just before the parade."
                ),
                "start_date": race_date,
                "start_time": race_time or "09:45",
                "end_date": None,
                "end_time": None,
                "is_all_day": False,
                "category": "sports",
                "subcategory": "running",
                "tags": ["atlanta", "st-patricks-day", "5k", "running", "midtown"],
                "price_min": None,
                "price_max": None,
                "price_note": None,
                "is_free": False,
                "source_url": RACE_URL,
                "ticket_url": race_ticket_url,
                "image_url": race_image,
                "raw_text": race_text[:1000],
                "extraction_confidence": 0.88,
                "is_recurring": False,
                "recurrence_rule": None,
                "content_hash": race_hash,
            }
            is_new, is_updated = upsert_event(race_record)
            events_new += int(is_new)
            events_updated += int(is_updated)

    if parade_date:
        events_found += 1
        parade_title = "Atlanta St. Patrick's Parade"
        parade_hash = generate_content_hash(parade_title, PARADE_VENUE["name"], parade_date)
        parade_record = {
            "source_id": source_id,
            "venue_id": parade_venue_id,
            "title": parade_title,
            "description": (
                "Annual Midtown parade celebrating Irish heritage in Atlanta, "
                "with floats, bands, and community groups along Peachtree Street."
            ),
            "start_date": parade_date,
            "start_time": parade_time,
            "end_date": None,
            "end_time": None,
            "is_all_day": False,
            "category": "community",
            "subcategory": "parade",
            "tags": ["atlanta", "st-patricks-day", "parade", "midtown", "irish-heritage"],
            "price_min": None,
            "price_max": None,
            "price_note": None,
            "is_free": True,
            "source_url": HOME_URL,
            "ticket_url": None,
            "image_url": parade_image,
            "raw_text": combined_text[:1000],
            "extraction_confidence": 0.9,
            "is_recurring": False,
            "recurrence_rule": None,
            "content_hash": parade_hash,
        }
        is_new, is_updated = upsert_event(parade_record)
        events_new += int(is_new)
        events_updated += int(is_updated)

    logger.info(
        "St. Patrick's crawl complete: %s found, %s new, %s updated",
        events_found,
        events_new,
        events_updated,
    )
    return events_found, events_new, events_updated
