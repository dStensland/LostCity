"""
Crawler for Atlanta Master Chorale (atlantamasterchorale.org).

Atlanta Master Chorale is a professional-level choral ensemble based in Atlanta
that performs primarily at Emory University's Schwartz Center for Performing Arts.
The site is Wix-based; events are listed on the /concerts page with dates, times,
and ticket links embedded in the page HTML (static render).

Season typically: 4–6 concerts, Sep–May, at Schwartz Center.
Tickets sold through tickets.arts.emory.edu.
"""

from __future__ import annotations

import logging
import re
from datetime import datetime, date
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

BASE_URL = "https://www.atlantamasterchorale.org"
CONCERTS_URL = "https://www.atlantamasterchorale.org/concerts"

REQUEST_HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; LostCity/1.0)",
}

# Schwartz Center is the primary performance venue
PLACE_DATA = {
    "name": "Schwartz Center for Performing Arts",
    "slug": "schwartz-center",
    "address": "1700 North Decatur Road NE",
    "neighborhood": "Druid Hills",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30322",
    "lat": 33.7963,
    "lng": -84.3254,
    "venue_type": "theater",
    "spot_type": "theater",
    "website": "https://schwartz.emory.edu",
}

# Atlanta Master Chorale as an organization record
AMC_ORG_VENUE = {
    "name": "Atlanta Master Chorale",
    "slug": "atlanta-master-chorale",
    "address": "PO Box 133201",
    "neighborhood": "Atlanta",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30333",
    "venue_type": "organization",
    "website": BASE_URL,
}

MONTH_MAP = {
    "january": 1, "february": 2, "march": 3, "april": 4,
    "may": 5, "june": 6, "july": 7, "august": 8,
    "september": 9, "october": 10, "november": 11, "december": 12,
    "jan": 1, "feb": 2, "mar": 3, "apr": 4,
    "jun": 6, "jul": 7, "aug": 8,
    "sep": 9, "oct": 10, "nov": 11, "dec": 12,
}


def _parse_month_day_year(text: str) -> Optional[tuple[int, int, int]]:
    """Parse 'Friday, May 1, 2026' or 'May 1, 2026' into (year, month, day)."""
    # Strip day-of-week prefix
    text = re.sub(r"^\w+,\s*", "", text).strip()
    match = re.match(
        r"(January|February|March|April|May|June|July|August|September|October|November|December)\s+"
        r"(\d{1,2}),?\s*(\d{4})",
        text, re.I,
    )
    if not match:
        return None
    month_str, day_str, year_str = match.groups()
    month = MONTH_MAP.get(month_str.lower())
    if not month:
        return None
    return int(year_str), month, int(day_str)


def _parse_time(time_str: str) -> Optional[str]:
    """Parse '8 pm' or '7:30 pm' to 'HH:MM'."""
    match = re.search(r"(\d{1,2})(?::(\d{2}))?\s*(am|pm)", time_str, re.I)
    if not match:
        return None
    hour = int(match.group(1))
    minute = int(match.group(2) or 0)
    period = match.group(3).upper()
    if period == "PM" and hour != 12:
        hour += 12
    elif period == "AM" and hour == 12:
        hour = 0
    return f"{hour:02d}:{minute:02d}"


def _parse_price(text: str) -> tuple[Optional[float], Optional[float], Optional[str]]:
    """
    Parse price from text like '$45 Adults; $41.50 Seniors; $10 Youth'.
    Returns (price_min, price_max, price_note).
    """
    prices = re.findall(r"\$(\d+(?:\.\d{2})?)", text)
    if not prices:
        return None, None, None
    floats = [float(p) for p in prices]
    price_note = text.strip()[:200] if text.strip() else None
    return min(floats), max(floats), price_note


_DATE_LINE_RE = re.compile(
    r"((?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),\s+)"
    r"((?:January|February|March|April|May|June|July|August|September|October|November|December)"
    r"\s+\d{1,2},?\s*\d{4})"
    r"(?:\s*[|\-]\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)))?",
    re.I,
)
_TICKET_URL_RE = re.compile(r"https://tickets\.arts\.emory\.edu/overview/\w+")
_SKIP_LINE_RE = re.compile(
    r"^(home|concerts|tickets?|donate|sing with us|about us?|click here|subscribe|"
    r"join|email|phone|bottom of page|top of page|purchase|virtual|log in|more|give|"
    r"videos?|shop|our people|for teachers|add your voice|stay connected|contact)",
    re.I,
)


def _clean_lines(soup: BeautifulSoup) -> list[str]:
    """Return page lines with zero-width chars stripped, empty lines removed."""
    raw = soup.get_text(separator="\n", strip=True)
    result = []
    for ln in raw.split("\n"):
        cleaned = re.sub(r"[\u200b\u200c\u200d\ufeff\xa0]", "", ln).strip()
        if cleaned:
            result.append(cleaned)
    return result


def _collect_ticket_links(soup: BeautifulSoup) -> dict[str, str]:
    """Return {link_text_lower: href} for all Emory ticket links on the page."""
    result: dict[str, str] = {}
    for a in soup.find_all("a", href=True):
        href = a.get("href", "")
        if "tickets.arts.emory.edu/overview" in href:
            text = re.sub(r"[\u200b\u200c\u200d\ufeff\xa0]", "", a.get_text()).strip().lower()
            if text:
                result[text] = href
    return result


def _extract_concert_blocks(soup: BeautifulSoup) -> list[dict]:
    """
    Extract concert info from the Wix-rendered Atlanta Master Chorale concerts page.

    Page structure (Wix renders the block twice):
        CONCERT TITLE (may span 1-2 lines)
        "Friday, May 1, 2026 | 8 pm"
        "Saturday, May 2, 2026 | 8 pm"
        "$45 Adults; $41.50 Seniors; $10 Youth"
        "Purchase [concert] tickets online"  ← carries the ticket URL

    Strategy: scan for date lines, then look backward for title lines and
    forward for price/ticket info. De-duplicate by (title, start_date).
    """
    lines = _clean_lines(soup)
    ticket_links = _collect_ticket_links(soup)

    seen: set[str] = set()
    concerts: list[dict] = []
    i = 0

    while i < len(lines):
        line = lines[i]
        dm = _DATE_LINE_RE.search(line)
        if not dm:
            i += 1
            continue

        # --- Title extraction ---
        # Collect up to 2 real content lines immediately before this date line.
        # Stop at: nav items, date lines, zero-width-only lines.
        title_parts: list[str] = []
        for back in range(1, 10):
            idx = i - back
            if idx < 0:
                break
            candidate = lines[idx]
            # Skip if it's a date line itself
            if _DATE_LINE_RE.search(candidate):
                break
            # Skip nav/footer noise
            if _SKIP_LINE_RE.search(candidate):
                break
            # Skip very short lines (likely decorative/icon text)
            if len(candidate) < 5:
                continue
            title_parts.insert(0, candidate)
            if len(title_parts) >= 2:
                break

        title = " ".join(title_parts).strip()
        # If the "title" we found is actually the date line itself, skip
        if not title or _DATE_LINE_RE.search(title):
            i += 1
            continue

        # --- Date parsing ---
        date_str = dm.group(2).strip()
        parsed = _parse_month_day_year(date_str)
        if not parsed:
            i += 1
            continue
        year, month, day = parsed
        start_date = f"{year}-{month:02d}-{day:02d}"

        # De-duplicate (Wix renders each block twice)
        dedup_key = f"{title}|{start_date}"
        if dedup_key in seen:
            i += 1
            continue
        seen.add(dedup_key)

        # --- Time ---
        time_str = dm.group(3)
        if not time_str:
            m = re.search(r"\d{1,2}(?::\d{2})?\s*(?:am|pm)", line, re.I)
            if m:
                time_str = m.group(0)
        start_time = _parse_time(time_str) if time_str else None

        # --- Price + ticket URL (scan forward up to 15 lines) ---
        price_note = price_min = price_max = None
        ticket_url: Optional[str] = None

        for fwd in range(1, 16):
            if i + fwd >= len(lines):
                break
            fwd_line = lines[i + fwd]
            # Another date line = next concert block
            if _DATE_LINE_RE.search(fwd_line) and fwd > 2:
                break
            if "$" in fwd_line and price_note is None:
                price_min, price_max, price_note = _parse_price(fwd_line)
            if ticket_url is None:
                m_url = _TICKET_URL_RE.search(fwd_line)
                if m_url:
                    ticket_url = m_url.group(0)
                else:
                    # Check if line text matches a link we collected
                    fwd_lower = fwd_line.lower()
                    for lt, lh in ticket_links.items():
                        if lt in fwd_lower:
                            ticket_url = lh
                            break

        concerts.append({
            "title": title,
            "start_date": start_date,
            "start_time": start_time,
            "price_min": price_min,
            "price_max": price_max,
            "price_note": price_note,
            "ticket_url": ticket_url,
        })

        i += 1

    return concerts


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Atlanta Master Chorale concert listings."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0
    seen_hashes: set[str] = set()

    try:
        venue_id = get_or_create_place(PLACE_DATA)
        get_or_create_place(AMC_ORG_VENUE)

        logger.info("Fetching Atlanta Master Chorale concerts: %s", CONCERTS_URL)
        resp = requests.get(CONCERTS_URL, headers=REQUEST_HEADERS, timeout=20)
        resp.raise_for_status()

        soup = BeautifulSoup(resp.text, "html.parser")
        today = date.today()

        # Get og:image for the season (used as fallback image)
        og_image_tag = soup.find("meta", property="og:image")
        season_image = og_image_tag.get("content", "").strip() if og_image_tag else None

        concerts = _extract_concert_blocks(soup)
        logger.info("Parsed %s concert blocks", len(concerts))

        for concert in concerts:
            title = concert["title"]
            start_date = concert["start_date"]

            if not title or not start_date:
                continue

            try:
                event_date = datetime.strptime(start_date, "%Y-%m-%d").date()
            except ValueError:
                continue

            # Skip events more than 2 months in the past
            if (today - event_date).days > 60:
                continue

            # Build tags
            tags = sorted({
                "atlanta-master-chorale",
                "choral",
                "classical",
                "performing-arts",
                "schwartz-center",
                "emory",
                "druid-hills",
            })

            content_hash = generate_content_hash(
                title, PLACE_DATA["name"], start_date
            )
            seen_hashes.add(content_hash)
            events_found += 1

            event_record = {
                "source_id": source_id,
                "venue_id": venue_id,
                "title": title,
                "description": f"{title} — Atlanta Master Chorale performing at the Schwartz Center for Performing Arts at Emory University.",
                "start_date": start_date,
                "start_time": concert.get("start_time"),
                "end_date": None,
                "end_time": None,
                "is_all_day": False,
                "category": "music",
                "subcategory": "choral",
                "tags": tags,
                "price_min": concert.get("price_min"),
                "price_max": concert.get("price_max"),
                "price_note": concert.get("price_note"),
                "is_free": False,
                "source_url": CONCERTS_URL,
                "ticket_url": concert.get("ticket_url"),
                "image_url": season_image,
                "raw_text": None,
                "extraction_confidence": 0.87,
                "is_recurring": False,
                "recurrence_rule": None,
                "content_hash": content_hash,
            }

            existing = find_event_by_hash(content_hash)
            if existing:
                smart_update_existing_event(existing, event_record)
                events_updated += 1
            else:
                insert_event(event_record)
                events_new += 1
                logger.debug("Added AMC concert: %s on %s", title, start_date)

        if seen_hashes:
            stale = remove_stale_source_events(source_id, seen_hashes)
            if stale:
                logger.info("Removed %s stale AMC events", stale)

        logger.info(
            "Atlanta Master Chorale: %s found, %s new, %s updated",
            events_found, events_new, events_updated,
        )

    except Exception as exc:
        logger.error("Failed to crawl Atlanta Master Chorale: %s", exc)
        raise

    return events_found, events_new, events_updated
