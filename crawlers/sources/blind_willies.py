"""
Crawler for Blind Willie's (blindwilliesblues.com).
Blues bar in Virginia-Highland with live music most nights.

Site structure: Static HTML calendar grid at /live-music-atlanta-concerts/.
Word-generated table with alternating rows:
  - Day-number rows: 21 cells (7 days × 3: day#, empty, price)
  - Event-detail rows: 7 cells with colspan=3 (performer, door/show times)
Month/year in header. Emoji markers: 🚪🚪 = doors, 🎵 = showtime.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime
from typing import Optional

import requests
from bs4 import BeautifulSoup

from db import get_or_create_place, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://www.blindwilliesblues.com"
EVENTS_URL = f"{BASE_URL}/live-music-atlanta-concerts/"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
}

PLACE_DATA = {
    "name": "Blind Willie's",
    "slug": "blind-willies",
    "address": "828 N Highland Ave NE",
    "neighborhood": "Virginia-Highland",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30306",
    "lat": 33.7850,
    "lng": -84.3503,
    "place_type": "bar",
    "spot_type": "bar",
    "website": BASE_URL,
}


def parse_month_year(text: str) -> Optional[tuple[int, int]]:
    """Parse month and year from text like 'February 2026'."""
    match = re.search(
        r"(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})",
        text,
        re.IGNORECASE,
    )
    if match:
        dt = datetime.strptime(f"{match.group(1)} 1 {match.group(2)}", "%B %d %Y")
        return dt.month, int(match.group(2))
    return None


def extract_performer(cell) -> Optional[str]:
    """Extract performer name from an event-detail cell.

    Performer name is in <strong> or <a> tags within <font> elements.
    Ignores CLOSED, door/show time text.
    """
    # Get text from strong/a tags (the performer name)
    name_parts = []
    for tag in cell.find_all(["strong", "a"]):
        text = tag.get_text(separator=" ").strip()
        # Skip time markers and empty text
        if not text or text.startswith("\U0001F3B5") or text.startswith("\U0001F6AA"):
            continue
        # Clean up
        text = re.sub(r"[\U0001F6AA\U0001F3B5\U0001F3B6]", "", text).strip()
        text = re.sub(r"\d{1,2}:\d{2}", "", text).strip()
        if text and len(text) > 1:
            name_parts.append(text)

    if not name_parts:
        return None

    name = name_parts[0]

    # Skip CLOSED days
    if re.match(r"^CLOSED", name, re.IGNORECASE):
        return None

    # Clean up extra whitespace from <br> tags
    name = re.sub(r"\s+", " ", name).strip()
    # Fix split words from <br> mid-word: "Electro- matics" → "Electro-matics"
    name = re.sub(r"-\s+", "-", name)
    return name if len(name) >= 3 else None


def extract_times(cell) -> tuple[Optional[str], Optional[str]]:
    """Extract door and show times from cell text.

    Patterns: '🚪🚪 7:00' for doors, '🎵 8:30' for show.
    """
    text = cell.get_text()
    door_time = None
    show_time = None

    door_match = re.search(r"\U0001F6AA+\s*(\d{1,2}):(\d{2})", text)
    show_match = re.search(r"\U0001F3B5\s*(\d{1,2}):(\d{2})", text)

    if door_match:
        h, m = int(door_match.group(1)), door_match.group(2)
        if h < 12:
            h += 12
        door_time = f"{h:02d}:{m}"

    if show_match:
        h, m = int(show_match.group(1)), show_match.group(2)
        if h < 12:
            h += 12
        show_time = f"{h:02d}:{m}"

    return door_time, show_time


def extract_price(cell_text: str) -> Optional[int]:
    """Extract price from text like '$5', '$10', 'Free'."""
    text = cell_text.strip()
    if re.search(r"\bfree\b", text, re.IGNORECASE):
        return 0
    match = re.search(r"\$(\d+)", text)
    if match:
        return int(match.group(1))
    return None


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Blind Willie's calendar grid."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        venue_id = get_or_create_place(PLACE_DATA)

        logger.info(f"Fetching Blind Willie's: {EVENTS_URL}")
        resp = requests.get(EVENTS_URL, headers=HEADERS, timeout=15)
        resp.raise_for_status()

        soup = BeautifulSoup(resp.text, "html.parser")

        # Extract month/year from page
        month_year = None
        for tag in soup.find_all(["h1", "h2", "h3", "strong", "td"]):
            result = parse_month_year(tag.get_text())
            if result:
                month_year = result
                break

        if not month_year:
            logger.warning("Could not determine month/year from Blind Willie's calendar")
            return events_found, events_new, events_updated

        month, year = month_year
        logger.info(f"Parsing calendar for {month}/{year}")

        # Find the main calendar table (the one with event data)
        tables = soup.find_all("table")
        calendar_table = None
        for table in tables:
            # The calendar table has cells with day numbers and performer names
            if table.find("td", string=re.compile(r"^\s*1\s*$")):
                calendar_table = table
                break

        if not calendar_table:
            # Fallback: use the largest table
            calendar_table = max(tables, key=lambda t: len(t.find_all("td"))) if tables else None

        if not calendar_table:
            logger.warning("Could not find calendar table")
            return events_found, events_new, events_updated

        rows = calendar_table.find_all("tr")
        logger.info(f"Found {len(rows)} table rows")

        # Process pairs of rows: day-number row + event-detail row
        # Skip row 0 (day-of-week headers)
        row_idx = 1
        while row_idx + 1 < len(rows):
            day_row = rows[row_idx]
            event_row = rows[row_idx + 1]
            row_idx += 2

            day_cells = day_row.find_all("td")
            event_cells = event_row.find_all("td")

            # Day-number row has groups of 3 cells per day: (day#, empty, price)
            # Event-detail row has 7 cells (one per day, colspan=3)
            days_info = []
            for i in range(0, len(day_cells), 3):
                if i + 2 >= len(day_cells):
                    break
                day_text = day_cells[i].get_text().strip()
                price_text = day_cells[i + 2].get_text().strip()

                day_num = None
                day_match = re.search(r"(\d{1,2})", day_text)
                if day_match:
                    day_num = int(day_match.group(1))

                price = extract_price(price_text) if price_text else None
                days_info.append((day_num, price))

            # Match days with event cells
            for col_idx, (day_num, price) in enumerate(days_info):
                if day_num is None:
                    continue

                if col_idx >= len(event_cells):
                    continue

                event_cell = event_cells[col_idx]

                # Extract performer name
                performer = extract_performer(event_cell)
                if not performer:
                    continue

                # Extract times
                door_time, show_time = extract_times(event_cell)

                # Build event date
                try:
                    event_date = datetime(year, month, day_num)
                except ValueError:
                    continue

                # Skip past events
                if event_date.date() < datetime.now().date():
                    continue

                start_date = event_date.strftime("%Y-%m-%d")
                events_found += 1

                content_hash = generate_content_hash(performer, "Blind Willie's", start_date)
                is_free = price == 0 if price is not None else False

                # Extract artist URL if present
                artist_link = event_cell.find("a")
                artist_url = artist_link.get("href") if artist_link else None

                event_record = {
                    "source_id": source_id,
                    "place_id": venue_id,
                    "title": performer,
                    "description": f"{performer} live at Blind Willie's Blues Club",
                    "start_date": start_date,
                    "start_time": show_time or door_time or "21:00",
                    "end_date": None,
                    "end_time": None,
                    "is_all_day": False,
                    "category": "music",
                    "tags": ["blind-willies", "blues", "live-music", "virginia-highland"],
                    "price_min": price,
                    "price_max": price,
                    "price_note": f"${price} cover" if price and price > 0 else ("Free" if is_free else None),
                    "is_free": is_free,
                    "source_url": EVENTS_URL,
                    "ticket_url": artist_url,
                    "image_url": None,
                    "raw_text": f"{performer} - {start_date}",
                    "extraction_confidence": 0.88,
                    "is_recurring": False,
                    "recurrence_rule": None,
                    "content_hash": content_hash,
                }

                existing = find_event_by_hash(content_hash)
                if existing:
                    smart_update_existing_event(existing, event_record)
                    events_updated += 1
                    continue

                try:
                    insert_event(event_record, genres=["blues", "live-music"])
                    events_new += 1
                    logger.info(f"Added: {performer} on {start_date}")
                except Exception as e:
                    logger.error(f"Failed to insert: {performer}: {e}")

        logger.info(
            f"Blind Willie's crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except requests.RequestException as e:
        logger.error(f"Failed to fetch Blind Willie's: {e}")
        raise
    except Exception as e:
        logger.error(f"Failed to crawl Blind Willie's: {e}")
        raise

    return events_found, events_new, events_updated
