"""
Crawler for the Atlanta Salsa & Bachata Festival (atlantasbf.com).

The workshop schedule lives on a Wix page with 3 embedded iframes from
wix-visual-data.appspot.com (one per day: Friday, Saturday, Sunday).
Each iframe contains a grid of time slots x rooms.  We extract inner_text()
from each iframe and parse the tab-separated grid into individual workshops.

Site uses JavaScript rendering — must use Playwright.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime, timedelta
from typing import Optional

from playwright.sync_api import sync_playwright

from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://www.atlantasbf.com"
WORKSHOPS_URL = f"{BASE_URL}/workshops"

VENUE_DATA = {
    "name": "Courtland Grand Hotel",
    "slug": "courtland-grand-hotel",
    "address": "165 Courtland St NE, Atlanta, GA 30303",
    "neighborhood": "Downtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30303",
    "lat": 33.7590,
    "lng": -84.3853,
    "venue_type": "hotel",
    "spot_type": "event_space",
    "website": BASE_URL,
}

# Iframe index → (date, day_name)
# Friday Feb 27, Saturday Feb 28, Sunday Mar 1
IFRAME_DAY_MAP = {
    0: ("2026-02-27", "Friday"),
    1: ("2026-02-28", "Saturday"),
    2: ("2026-03-01", "Sunday"),
}

# Known room columns from the grid headers
ROOM_COLUMNS = [
    "Grand Ballroom 1",
    "Grand Ballroom 2",
    "Savannah Room",
    "Athens",
    "Valdosta Macon",
    "Valdosta",
]

# Time slot regex: matches "10:00 AM", "1:00 PM", etc.
TIME_SLOT_RE = re.compile(r"^(\d{1,2}:\d{2}\s*[AP]M)$", re.IGNORECASE)

# Style keywords for tag inference
STYLE_KEYWORDS = {
    "salsa": "salsa",
    "on1": "salsa",
    "on2": "salsa",
    "mambo": "salsa",
    "bachata": "bachata",
    "sensual": "bachata",
    "kizomba": "kizomba",
    "semba": "kizomba",
    "urbankiz": "kizomba",
    "zouk": "zouk",
    "heels": "heels",
    "styling": "styling",
    "body movement": "body-movement",
    "shines": "shines",
    "footwork": "footwork",
    "partnerwork": "partnerwork",
    "turn pattern": "turn-patterns",
    "cha cha": "cha-cha",
    "afro": "afro-latin",
    "reggaeton": "reggaeton",
    "ladies": "ladies-styling",
}


def parse_time_to_24h(time_str: str) -> Optional[str]:
    """Convert '10:00 AM' or '1:00 PM' to 'HH:MM' 24-hour format."""
    match = re.match(r"(\d{1,2}):(\d{2})\s*(AM|PM)", time_str.strip(), re.IGNORECASE)
    if not match:
        return None
    hour, minute, period = int(match.group(1)), match.group(2), match.group(3).upper()
    if period == "PM" and hour != 12:
        hour += 12
    elif period == "AM" and hour == 12:
        hour = 0
    return f"{hour:02d}:{minute}"


def compute_end_time(start_24h: str) -> str:
    """Add 1 hour to a HH:MM time string."""
    h, m = map(int, start_24h.split(":"))
    dt = datetime(2026, 1, 1, h, m) + timedelta(hours=1)
    return dt.strftime("%H:%M")


def infer_style_tags(text: str) -> list[str]:
    """Extract dance style tags from workshop title/description text."""
    text_lower = text.lower()
    found = set()
    for keyword, tag in STYLE_KEYWORDS.items():
        if keyword in text_lower:
            found.add(tag)
    return sorted(found)


def parse_iframe_grid(raw_text: str) -> list[dict]:
    """
    Parse the tab-separated grid text from a wix-visual-data iframe.

    The text comes back as rows separated by newlines. Time slot rows
    start with a time like '10:00 AM'. Between time slots, cells are
    tab-separated by room column.

    Returns a list of dicts with keys: time_slot, room, cell_text
    """
    lines = raw_text.split("\n")
    workshops = []

    current_time = None
    cell_buffer: list[str] = []

    for line in lines:
        stripped = line.strip()
        if not stripped:
            continue

        # Check if this line is a time slot header
        time_match = TIME_SLOT_RE.match(stripped)
        if time_match:
            # Process previous time slot's cells before starting new one
            if current_time and cell_buffer:
                workshops.extend(_parse_cells(current_time, cell_buffer))

            current_time = time_match.group(1).strip()
            cell_buffer = []
            continue

        if current_time:
            cell_buffer.append(stripped)

    # Process final time slot
    if current_time and cell_buffer:
        workshops.extend(_parse_cells(current_time, cell_buffer))

    return workshops


def _parse_cells(time_slot: str, lines: list[str]) -> list[dict]:
    """
    Parse cell content for a single time slot row.

    The grid text between time slots contains tab-separated room data.
    Each cell block typically has:
      - Instructor name (possibly with origin city)
      - Workshop title
      - Level (e.g., "All Levels", "Int/Adv")

    Some lines are tab-separated (one per room column), others are
    multi-line per cell.
    """
    results = []

    # Join all lines and try splitting by tab first (grid columns)
    joined = "\n".join(lines)

    # Try tab-split approach: if tabs exist, columns map to rooms
    tab_segments = joined.split("\t")
    if len(tab_segments) > 1:
        for i, segment in enumerate(tab_segments):
            segment = segment.strip()
            if not segment:
                continue
            room = ROOM_COLUMNS[i] if i < len(ROOM_COLUMNS) else f"Room {i + 1}"
            results.append({
                "time_slot": time_slot,
                "room": room,
                "cell_text": segment,
            })
    else:
        # Fallback: treat each non-empty block as a cell
        # Sometimes lines are separated by blank lines per room
        blocks = re.split(r"\n{2,}", joined)
        for i, block in enumerate(blocks):
            block = block.strip()
            if not block:
                continue
            room = ROOM_COLUMNS[i] if i < len(ROOM_COLUMNS) else f"Room {i + 1}"
            results.append({
                "time_slot": time_slot,
                "room": room,
                "cell_text": block,
            })

    return results


def parse_cell_text(cell_text: str) -> Optional[dict]:
    """
    Parse a single cell's text into instructor, title, and level.

    Typical patterns:
      "Karel Flores\nNew York\nBody Movement & Shines (on2)\nInt/Adv"
      "Alien Ramirez & Alien Ramirez Jr\nAtlanta\nSalsa Partnerwork\nAll Levels"

    Returns dict with: instructor, title, level (or None if unparseable)
    """
    lines = [l.strip() for l in cell_text.split("\n") if l.strip()]
    if not lines:
        return None

    # Filter out lines that look like room headers
    lines = [l for l in lines if l not in ROOM_COLUMNS]
    if not lines:
        return None

    # Common level patterns
    level_re = re.compile(
        r"^(all\s*levels?|beg(?:inner)?(?:/int)?|int(?:ermediate)?(?:/adv)?|adv(?:anced)?|open\s*level|intro)",
        re.IGNORECASE,
    )

    instructor = None
    title = None
    level = None
    origin_city = None

    # Heuristic parsing
    remaining = []
    for line in lines:
        if level_re.match(line):
            level = line
        elif _looks_like_city(line):
            origin_city = line
        else:
            remaining.append(line)

    if len(remaining) >= 2:
        instructor = remaining[0]
        title = remaining[1]
    elif len(remaining) == 1:
        # Single line — could be just a title or instructor
        title = remaining[0]

    if not title:
        return None

    return {
        "instructor": instructor,
        "title": title,
        "level": level,
        "origin_city": origin_city,
    }


def _looks_like_city(text: str) -> bool:
    """Check if a line looks like a city/origin (short, no special chars typical of titles)."""
    # City lines are usually short (e.g., "New York", "Atlanta", "Miami")
    if len(text) > 40:
        return False
    # Contains parentheses or common workshop words → probably a title
    if re.search(r"[()&/]|workshop|class|styling|movement|pattern|shine", text, re.IGNORECASE):
        return False
    # 1-3 words, all capitalized or title case
    words = text.split()
    if 1 <= len(words) <= 4 and all(w[0].isupper() for w in words if w):
        # Extra check: not a dance style name
        if text.lower() not in STYLE_KEYWORDS:
            return True
    return False


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Atlanta Salsa & Bachata Festival workshop schedule."""
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

            logger.info(f"Fetching workshop schedule: {WORKSHOPS_URL}")
            page.goto(WORKSHOPS_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(5000)  # Extra time for Wix + iframes to render

            # Scroll to ensure all iframes load
            for _ in range(3):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(2000)
            page.evaluate("window.scrollTo(0, 0)")
            page.wait_for_timeout(1000)

            # Find all wix-visual-data iframes
            iframe_elements = page.query_selector_all(
                'iframe[src*="wix-visual-data.appspot.com"]'
            )

            if not iframe_elements:
                # Fallback: try any iframe that might contain schedule data
                iframe_elements = page.query_selector_all("iframe")
                iframe_elements = [
                    el for el in iframe_elements
                    if el.get_attribute("src") and "wix-visual-data" in (el.get_attribute("src") or "")
                ]

            logger.info(f"Found {len(iframe_elements)} wix-visual-data iframes")

            if not iframe_elements:
                logger.warning("No wix-visual-data iframes found on workshops page")
                browser.close()
                return 0, 0, 0

            for iframe_idx, iframe_el in enumerate(iframe_elements):
                if iframe_idx not in IFRAME_DAY_MAP:
                    logger.debug(f"Skipping unexpected iframe index {iframe_idx}")
                    continue

                date_str, day_name = IFRAME_DAY_MAP[iframe_idx]

                series_hint = {
                    "series_type": "festival_program",
                    "series_title": f"{day_name} Workshops",
                    "festival_name": "Atlanta Salsa & Bachata Festival",
                    "festival_website": BASE_URL,
                }

                # Get the iframe's Frame object
                frame = iframe_el.content_frame()
                if not frame:
                    logger.warning(f"Could not access frame for iframe {iframe_idx} ({day_name})")
                    continue

                # Wait for frame content to render
                try:
                    frame.wait_for_load_state("domcontentloaded", timeout=15000)
                except Exception:
                    logger.debug(f"Frame {iframe_idx} load timeout, proceeding anyway")

                frame.wait_for_timeout(2000)

                # Extract all text from the iframe
                try:
                    raw_text = frame.inner_text("body")
                except Exception as e:
                    logger.warning(f"Could not extract text from iframe {iframe_idx}: {e}")
                    continue

                if not raw_text or len(raw_text) < 50:
                    logger.warning(f"Iframe {iframe_idx} ({day_name}) returned minimal text")
                    continue

                logger.info(f"Parsing {day_name} schedule ({len(raw_text)} chars)")

                # Parse grid into workshop cells
                grid_cells = parse_iframe_grid(raw_text)
                logger.info(f"  Found {len(grid_cells)} cells in {day_name} grid")

                for cell in grid_cells:
                    parsed = parse_cell_text(cell["cell_text"])
                    if not parsed or not parsed["title"]:
                        continue

                    instructor = parsed["instructor"]
                    workshop_title = parsed["title"]
                    level = parsed["level"]

                    # Build event title: "Instructor - Workshop Title"
                    if instructor:
                        title = f"{instructor} - {workshop_title}"
                    else:
                        title = workshop_title

                    # Append level info if present
                    if level:
                        title_with_level = f"{title} ({level})"
                    else:
                        title_with_level = title

                    # Parse start/end times
                    start_time = parse_time_to_24h(cell["time_slot"])
                    if not start_time:
                        logger.debug(f"  Could not parse time: {cell['time_slot']}")
                        continue

                    end_time = compute_end_time(start_time)

                    # Build tags
                    base_tags = ["dance", "workshop", "latin-dance", "salsa-bachata-festival"]
                    style_tags = infer_style_tags(f"{workshop_title} {level or ''}")
                    tags = base_tags + style_tags

                    # Build description
                    desc_parts = []
                    if instructor:
                        desc_parts.append(f"Workshop by {instructor}")
                        if parsed.get("origin_city"):
                            desc_parts.append(f"({parsed['origin_city']})")
                    desc_parts.append(f"Room: {cell['room']}")
                    if level:
                        desc_parts.append(f"Level: {level}")
                    description = ". ".join(desc_parts) + "."

                    events_found += 1

                    content_hash = generate_content_hash(
                        title_with_level,
                        VENUE_DATA["name"],
                        date_str + start_time,
                    )

                    event_record = {
                        "source_id": source_id,
                        "venue_id": venue_id,
                        "title": title_with_level,
                        "description": description,
                        "start_date": date_str,
                        "start_time": start_time,
                        "end_date": date_str,
                        "end_time": end_time,
                        "is_all_day": False,
                        "category": "community",
                        "subcategory": "festival",
                        "tags": tags,
                        "price_min": None,
                        "price_max": None,
                        "price_note": None,
                        "is_free": False,
                        "source_url": WORKSHOPS_URL,
                        "ticket_url": BASE_URL,
                        "image_url": None,
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
                        insert_event(event_record, series_hint=series_hint)
                        events_new += 1
                        logger.info(f"  Added: {title_with_level} at {start_time} in {cell['room']}")
                    except Exception as e:
                        logger.error(f"  Failed to insert: {title_with_level}: {e}")

            browser.close()

        logger.info(
            f"Atlanta SBF crawl complete: {events_found} found, "
            f"{events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Atlanta Salsa & Bachata Festival: {e}")
        raise

    return events_found, events_new, events_updated
