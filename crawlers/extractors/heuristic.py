"""
Heuristic extraction for event detail pages.
"""

from __future__ import annotations

import logging
import re
from typing import Optional

from bs4 import BeautifulSoup

from description_fetcher import extract_description_from_html
from extractors.lineup import split_lineup_text

logger = logging.getLogger(__name__)


def _find_ticket_url(soup: BeautifulSoup) -> Optional[str]:
    ticket_keywords = [
        "tickets", "ticket", "buy", "purchase", "register", "rsvp", "reserve"
    ]
    for a in soup.find_all("a"):
        text = (a.get_text() or "").strip().lower()
        href = a.get("href")
        if not href:
            continue
        if any(kw in text for kw in ticket_keywords):
            return href.strip()
    return None


def _find_image_url(soup: BeautifulSoup) -> Optional[str]:
    # Prefer obvious hero/event images first
    selectors = [
        "img.event-image",
        "img.event__image",
        ".event-hero img",
        ".event-image img",
        ".hero img",
        "img[class*='event']",
    ]
    for selector in selectors:
        img = soup.select_one(selector)
        if img and img.get("src"):
            return img["src"].strip()

    # Fallback to the first reasonably sized image
    for img in soup.find_all("img"):
        src = img.get("src")
        if not src:
            continue
        width = img.get("width") or ""
        height = img.get("height") or ""
        if width and height:
            try:
                if int(width) < 200 or int(height) < 200:
                    continue
            except ValueError:
                pass
        return src.strip()
    return None


def _parse_price_from_text(text: str) -> dict:
    """Extract price_min, price_max, price_note, and is_free from page text.

    Handles patterns like:
      "$25", "$15-$30", "$15 - $30", "$15–$30"
      "$15+", "$0", "Free", "free admission", "no cover"

    IMPORTANT: Only marks is_free=True when there's a clear, unambiguous
    pricing signal. Incidental mentions of "free" (free parking, gluten-free,
    feel free to...) must NOT trigger is_free.
    """
    result: dict = {}
    if not text:
        return result

    lower = text.lower()

    # Check for explicit free-admission phrases (high confidence).
    # NOTE: "no cover" is intentionally excluded — it means no door charge
    # but the venue still expects food/drink purchases (e.g. jazz brunch).
    free_phrases = (
        "free admission",
        "free event",
        "free entry",
        "free to attend",
        "free to the public",
        "free and open to the public",
        "free and open",
        "admission is free",
        "entry is free",
        "no charge",
        "no cost",
        "complimentary admission",
        "complimentary event",
        "complimentary entry",
    )
    if any(p in lower for p in free_phrases):
        result["is_free"] = True
        result["price_min"] = 0.0
        result["price_note"] = "Free"
        return result

    # Regex patterns for free pricing in structured contexts
    # Matches: "Price: Free", "Cost: Free", "Admission: Free", "Tickets: Free"
    free_label_re = re.search(
        r"(?:price|cost|admission|tickets?|fee)\s*[:]\s*free\b",
        lower,
    )
    if free_label_re:
        result["is_free"] = True
        result["price_min"] = 0.0
        result["price_note"] = "Free"
        return result

    # Range: "$15 - $30", "$15-$30", "$15–$30", "$15 to $30"
    range_match = re.search(
        r"\$\s?(\d{1,4}(?:\.\d{2})?)\s*[-–—to]+\s*\$\s?(\d{1,4}(?:\.\d{2})?)",
        text,
    )
    if range_match:
        low = float(range_match.group(1))
        high = float(range_match.group(2))
        if 0 <= low <= 10000 and 0 <= high <= 10000:
            result["price_min"] = low
            result["price_max"] = high
            result["price_note"] = range_match.group(0)
            if low == 0:
                result["is_free"] = True
            return result

    # Single price with plus: "$15+"
    plus_match = re.search(r"\$\s?(\d{1,4}(?:\.\d{2})?)\s*\+", text)
    if plus_match:
        val = float(plus_match.group(1))
        if 0 <= val <= 10000:
            result["price_min"] = val
            result["price_note"] = plus_match.group(0)
            if val == 0:
                result["is_free"] = True
            return result

    # Single price: "$25", "$ 25.00"
    single_match = re.search(r"\$\s?(\d{1,4}(?:\.\d{2})?)", text)
    if single_match:
        val = float(single_match.group(1))
        if 0 <= val <= 10000:
            result["price_min"] = val
            result["price_note"] = single_match.group(0)
            if val == 0:
                result["is_free"] = True
            return result

    return result


def _parse_time_12h(time_str: str) -> Optional[str]:
    """Convert '7pm', '7:30 PM', '19:00' to 'HH:MM' 24-hour format."""
    time_str = time_str.strip().upper()
    # Already 24h: "19:00"
    m = re.match(r'^(\d{1,2}):(\d{2})$', time_str)
    if m:
        h, mn = int(m.group(1)), int(m.group(2))
        if 0 <= h <= 23 and 0 <= mn <= 59:
            return f"{h:02d}:{mn:02d}"
    # 12h with minutes: "7:30 PM"
    m = re.match(r'^(\d{1,2}):(\d{2})\s*(AM|PM)$', time_str)
    if m:
        h, mn, ampm = int(m.group(1)), int(m.group(2)), m.group(3)
        if ampm == "PM" and h != 12:
            h += 12
        if ampm == "AM" and h == 12:
            h = 0
        return f"{h:02d}:{mn:02d}"
    # 12h no minutes: "7pm", "7 PM"
    m = re.match(r'^(\d{1,2})\s*(AM|PM)$', time_str)
    if m:
        h, ampm = int(m.group(1)), m.group(2)
        if ampm == "PM" and h != 12:
            h += 12
        if ampm == "AM" and h == 12:
            h = 0
        return f"{h:02d}:00"
    return None


def _find_event_time(soup: BeautifulSoup) -> tuple[Optional[str], Optional[str]]:
    """Extract start_time and end_time from common HTML patterns."""
    text = soup.get_text(" ", strip=True)

    # Pattern: "Doors: 7pm / Show: 8pm" or "Doors 7:00 PM | Show 8:00 PM"
    doors_show = re.search(
        r'(?:doors|door)\s*[:@]?\s*(\d{1,2}(?::\d{2})?\s*[APap][Mm])',
        text, re.IGNORECASE
    )
    show_match = re.search(
        r'(?:show|starts?|music|performance|begins?)\s*[:@]?\s*(\d{1,2}(?::\d{2})?\s*[APap][Mm])',
        text, re.IGNORECASE
    )
    if show_match:
        start = _parse_time_12h(show_match.group(1))
        if start:
            return start, None
    if doors_show:
        start = _parse_time_12h(doors_show.group(1))
        if start:
            return start, None

    # Pattern: "7:00 PM - 10:00 PM" or "7pm–10pm"
    range_match = re.search(
        r'(\d{1,2}(?::\d{2})?\s*[APap][Mm])\s*[-–—to]+\s*(\d{1,2}(?::\d{2})?\s*[APap][Mm])',
        text
    )
    if range_match:
        start = _parse_time_12h(range_match.group(1))
        end = _parse_time_12h(range_match.group(2))
        if start:
            return start, end

    # Pattern: standalone time in common containers
    selectors = [
        ".event-time", "[class*='event-time']", "[class*='event_time']",
        ".time", "[class*='time']",
        "[class*='date-time']", "[class*='date_time']",
        "[class*='event-meta']", "[class*='event_meta']",
        "[class*='door-time']", "[class*='door_time']",
        "[class*='showtime']", "[class*='show-time']",
        "time",
    ]
    for selector in selectors:
        elem = soup.select_one(selector)
        if elem:
            elem_text = elem.get_text(" ", strip=True)
            time_match = re.search(r'(\d{1,2}(?::\d{2})?\s*[APap][Mm])', elem_text)
            if time_match:
                parsed = _parse_time_12h(time_match.group(1))
                if parsed:
                    return parsed, None

    return None, None


def _find_lineup_text(soup: BeautifulSoup) -> Optional[str]:
    selectors = [
        ".lineup",
        ".line-up",
        ".artist-list",
        ".artists",
        ".performers",
        ".support",
        ".supporting",
        ".openers",
        ".opening",
        "[class*='lineup']",
        "[id*='lineup']",
        "[class*='performer']",
        "[id*='performer']",
    ]
    for selector in selectors:
        elem = soup.select_one(selector)
        if elem:
            text = elem.get_text(" ", strip=True)
            if text and len(text) < 300:
                return text
    return None


def extract_heuristic_fields(html: str) -> dict:
    """Extract description, ticket_url, image_url, price fields from HTML."""
    if not html:
        return {}

    soup = BeautifulSoup(html, "lxml")
    result: dict = {}

    description = extract_description_from_html(html)
    if description:
        result["description"] = description

    ticket_url = _find_ticket_url(soup)
    if ticket_url:
        result["ticket_url"] = ticket_url

    image_url = _find_image_url(soup)
    if image_url:
        result["image_url"] = image_url

    lineup_text = _find_lineup_text(soup)
    if lineup_text:
        artists = split_lineup_text(lineup_text)
        if artists:
            result["artists"] = artists

    start_time, end_time = _find_event_time(soup)
    if start_time:
        result["start_time"] = start_time
    if end_time:
        result["end_time"] = end_time

    # Price extraction from page text
    text = soup.get_text(" ", strip=True)
    price_data = _parse_price_from_text(text)
    result.update(price_data)

    return result
