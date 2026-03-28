"""
Crawler for Steve & Kate's Camp — Atlanta (Sandy Springs) location.

Official source:
https://www.steveandkatescamp.com/atlanta/

Pattern role:
Steve & Kate's is a drop-in day camp franchise (owned by Bright Horizons).
Unlike traditional week-block camps, families buy Day Passes ($108/day) and
can use them on any open day across the season. There are no fixed "sessions"
to parse — the whole summer window is the enrollment period.

Atlanta location:
  Springmont School
  5750 Long Island Dr., Atlanta, GA 30327
  Season: June 1 – July 24 (closed June 19 and July 3)
  Ages: 5–12
  Price: $108/day (all-inclusive: lunch, snacks, activities, 8am–6pm)
  Activities: Media Lab, Sewing Salon, Bakery, Sports, Water Games, and more.

Because S&K has no per-week listing structure, we emit one season-level event
record representing the enrollment window. The price_note and description explain
the Day Pass model so parents understand what they're booking.

This crawler refreshes the dates and price from the live page each run.
If the price or dates change, the record is updated via content-hash matching.
"""

from __future__ import annotations

import logging
import re
from datetime import date, datetime
from typing import Optional

import requests
from bs4 import BeautifulSoup

from db import (
    find_event_by_hash,
    get_or_create_place,
    insert_event,
    smart_update_existing_event,
)
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

CAMP_URL = "https://www.steveandkatescamp.com/atlanta/"

REQUEST_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/122.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml",
    "Accept-Language": "en-US,en;q=0.9",
}

PLACE_DATA = {
    "name": "Springmont School",
    "slug": "springmont-school-atlanta",
    "address": "5750 Long Island Dr",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30327",
    "lat": 33.8798,
    "lng": -84.4241,
    "neighborhood": "Sandy Springs",
    "venue_type": "college",
    "spot_type": "education",
    "website": "https://www.springmont.com",
    "vibes": ["family-friendly", "educational", "kids"],
}

BASE_TAGS = [
    "kids",
    "family-friendly",
    "camp",
    "summer-camp",
    "day-camp",
    "arts-and-crafts",
    "sports",
    "rsvp-required",
    "elementary",
]

# Date patterns found on the location page
# "Jun 1 - Jul 24" or "June 1 – July 24"
DATE_RANGE_RE = re.compile(
    r"(?:Jun(?:e)?|Jul(?:y)?)\s+\d{1,2}\s*[-\u2013]\s*(?:Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?)\s+\d{1,2}",
    re.IGNORECASE,
)
# Individual date parser: "Jun 1" or "June 1"
DATE_TOKEN_RE = re.compile(
    r"(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|"
    r"Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{1,2})",
    re.IGNORECASE,
)

# Price pattern: "$108 /day" or "$108/day"
PRICE_RE = re.compile(r"\$(\d+(?:\.\d{2})?)\s*/day", re.IGNORECASE)

MONTH_MAP = {
    "jan": 1,
    "january": 1,
    "feb": 2,
    "february": 2,
    "mar": 3,
    "march": 3,
    "apr": 4,
    "april": 4,
    "may": 5,
    "jun": 6,
    "june": 6,
    "jul": 7,
    "july": 7,
    "aug": 8,
    "august": 8,
    "sep": 9,
    "september": 9,
    "oct": 10,
    "october": 10,
    "nov": 11,
    "november": 11,
    "dec": 12,
    "december": 12,
}


def _clean_text(value: Optional[str]) -> str:
    if not value:
        return ""
    return re.sub(r"\s+", " ", value.replace("\xa0", " ")).strip()


def _parse_month_day(month_str: str, day_str: str, year: int = 2026) -> Optional[str]:
    key = month_str.lower().rstrip(".")
    month_num = MONTH_MAP.get(key)
    if not month_num:
        return None
    try:
        dt = datetime(year, month_num, int(day_str))
        return dt.strftime("%Y-%m-%d")
    except ValueError:
        return None


def _extract_dates_from_page(
    soup: BeautifulSoup,
) -> tuple[Optional[str], Optional[str]]:
    """
    Extract camp season start/end dates from the location page.

    The dates appear as "Jun 1 - Jul 24" in a camp-details-info-content element.
    We take the first valid date range found.
    """
    page_text = _clean_text(soup.get_text(" ", strip=True))

    # Try structured .camp-details-info-content spans first
    for elem in soup.select(".camp-details-info-content"):
        text = _clean_text(elem.get_text(" ", strip=True))
        tokens = list(DATE_TOKEN_RE.finditer(text))
        if len(tokens) >= 2:
            start = _parse_month_day(tokens[0].group(1), tokens[0].group(2))
            end = _parse_month_day(tokens[-1].group(1), tokens[-1].group(2))
            if start and end and start <= end:
                return start, end

    # Fallback: scan all text for a date range pattern
    match = DATE_RANGE_RE.search(page_text)
    if match:
        tokens = list(DATE_TOKEN_RE.finditer(match.group(0)))
        if len(tokens) >= 2:
            start = _parse_month_day(tokens[0].group(1), tokens[0].group(2))
            end = _parse_month_day(tokens[-1].group(1), tokens[-1].group(2))
            if start and end and start <= end:
                return start, end

    return None, None


def _extract_price(soup: BeautifulSoup) -> Optional[float]:
    """Extract day pass price from the location page."""
    for elem in soup.select(".card-price, .camp-details-info-content"):
        text = _clean_text(elem.get_text(" ", strip=True))
        match = PRICE_RE.search(text)
        if match:
            try:
                return float(match.group(1))
            except ValueError:
                pass

    # Fallback: scan full page text
    page_text = _clean_text(soup.get_text(" ", strip=True))
    match = PRICE_RE.search(page_text)
    if match:
        try:
            return float(match.group(1))
        except ValueError:
            pass

    return None


def _extract_age_range(soup: BeautifulSoup) -> tuple[Optional[int], Optional[int]]:
    """Extract age range (5–12 pattern) from camp details."""
    for elem in soup.select(".camp-details-info-content"):
        text = _clean_text(elem.get_text(" ", strip=True))
        age_match = re.search(r"(\d{1,2})\s*[–\-]\s*(\d{1,2})", text)
        if age_match:
            try:
                lo = int(age_match.group(1))
                hi = int(age_match.group(2))
                if 3 <= lo <= 18 and lo <= hi <= 18:
                    return lo, hi
            except ValueError:
                pass
    return 5, 12  # Steve & Kate's is always 5-12


def _build_event_record(source_id: int, venue_id: int, row: dict) -> dict:
    title = row["title"]
    return {
        "source_id": source_id,
        "venue_id": venue_id,
        "title": title,
        "description": row["description"],
        "start_date": row["start_date"],
        "start_time": row["start_time"],
        "end_date": row["end_date"],
        "end_time": row["end_time"],
        "is_all_day": row["is_all_day"],
        "category": "programs",
        "subcategory": "camp",
        "class_category": "general",
        "tags": row["tags"],
        "price_min": row["price_min"],
        "price_max": row["price_max"],
        "price_note": row["price_note"],
        "is_free": False,
        "source_url": row["source_url"],
        "ticket_url": row["ticket_url"],
        "image_url": row["image_url"],
        "raw_text": f"{title} | {row['description']}",
        "extraction_confidence": 0.9,
        "is_recurring": False,
        "recurrence_rule": None,
        "content_hash": generate_content_hash(
            title,
            PLACE_DATA["name"],
            row["start_date"],
        ),
        "age_min": row["age_min"],
        "age_max": row["age_max"],
    }


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl Steve & Kate's Camp Atlanta location.

    Emits one season-level event record describing the enrollment window.
    The Day Pass model means there are no fixed weekly blocks to parse.
    """
    source_id = source["id"]

    try:
        response = requests.get(CAMP_URL, headers=REQUEST_HEADERS, timeout=30)
        response.raise_for_status()
    except Exception as exc:
        logger.error("Steve & Kate's Atlanta: failed to fetch page: %s", exc)
        return 0, 0, 0

    soup = BeautifulSoup(response.text, "html.parser")

    start_date, end_date = _extract_dates_from_page(soup)
    if not start_date or not end_date:
        logger.warning(
            "Steve & Kate's Atlanta: could not extract season dates from %s", CAMP_URL
        )
        # Use known 2026 dates as fallback rather than silently failing
        start_date = "2026-06-01"
        end_date = "2026-07-24"

    today = date.today().strftime("%Y-%m-%d")
    if end_date < today:
        logger.info("Steve & Kate's Atlanta: season has ended (%s), skipping", end_date)
        return 0, 0, 0

    price_per_day = _extract_price(soup) or 108.0
    age_min, age_max = _extract_age_range(soup)

    # Derive price note
    price_note = (
        f"${price_per_day:.0f}/day. All-inclusive: lunch, snacks, activities, 8am–6pm. "
        "Buy any number of Day Passes — no weekly commitment required. "
        "Unused passes are automatically refunded at season end."
    )

    og_image = soup.find("meta", property="og:image")
    image_url = og_image.get("content") if og_image else None

    description = (
        "Steve & Kate's Camp is an unstructured, child-directed summer day camp "
        "at Springmont School in Sandy Springs. Kids choose their own activities "
        "minute to minute from a Media Lab, Sewing Salon, Bakery, Sports, Water "
        "Games, and more. No fixed weekly sessions — families buy Day Passes ($108/day) "
        "and use them on any open day during the summer. Ages 5–12. "
        "All-inclusive (lunch, snacks, 8am–6pm)."
    )

    row = {
        "title": "Steve & Kate's Camp Atlanta (Sandy Springs)",
        "description": description,
        "source_url": CAMP_URL,
        "ticket_url": "https://www.steveandkatescamp.com/register/",
        "start_date": start_date,
        "end_date": end_date,
        "start_time": "08:00",
        "end_time": "18:00",
        "is_all_day": False,
        "age_min": age_min,
        "age_max": age_max,
        "price_min": price_per_day,
        "price_max": price_per_day,
        "price_note": price_note,
        "is_free": False,
        "image_url": image_url,
        "tags": BASE_TAGS,
    }

    try:
        venue_id = get_or_create_place(PLACE_DATA)
        record = _build_event_record(source_id, venue_id, row)

        existing = find_event_by_hash(record["content_hash"])
        if existing:
            smart_update_existing_event(existing, record)
            logger.info("Steve & Kate's Atlanta: updated existing season record")
            return 1, 0, 1
        else:
            insert_event(record)
            logger.info(
                "Steve & Kate's Atlanta: inserted season record (%s – %s)",
                start_date,
                end_date,
            )
            return 1, 1, 0

    except Exception as exc:
        logger.error("Steve & Kate's Atlanta: failed to upsert record: %s", exc)
        return 0, 0, 0
