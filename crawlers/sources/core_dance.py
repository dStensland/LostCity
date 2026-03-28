"""
Crawler for Core Dance (coredance.org).
Contemporary dance company and creative laboratory based in Decatur, GA.
Founded by Artistic Director Sue Schroeder.

Site structure:
  - Wix site — no dedicated event calendar page
  - coredance.org/current-season: describes season highlights and projects
  - coredance.org/presents: past and current full productions
  - coredance.org/convenings: special events and convenings
  - Ticket sales via third-party sites (Rialto, 7 Stages, Emory, etc.)

Strategy:
  - Scan the /presents and /current-season pages for upcoming event dates
  - Extract events with concrete dates (skip project descriptions without dates)
  - Core Dance's public events are infrequent (2-4/year) but worth capturing
  - Home base is in Decatur; performs at partner venues across Atlanta

Typical yield: 2-4 events/year (main productions + occasional public programs)
"""

from __future__ import annotations

import logging
import re
from datetime import datetime
from typing import Optional

from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeoutError

from db import get_or_create_place, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://www.coredance.org"

# Core Dance home base in Decatur
CORE_DANCE_VENUE_DATA = {
    "name": "Core Dance Studio",
    "slug": "core-dance-studio-decatur",
    "address": "50 S Candler St",
    "neighborhood": "Decatur",
    "city": "Decatur",
    "state": "GA",
    "zip": "30030",
    "lat": 33.7749,
    "lng": -84.2963,
    "venue_type": "dance_studio",
    "spot_type": "theater",
    "website": BASE_URL,
    "vibes": ["artsy", "all-ages"],
}

# Pages to scan for upcoming public events
SCAN_PAGES = [
    f"{BASE_URL}/presents",
    f"{BASE_URL}/current-season",
    f"{BASE_URL}/convenings",
    f"{BASE_URL}/theatrical-works",
]

# Month names for date parsing
MONTHS = (
    "January|February|March|April|May|June|"
    "July|August|September|October|November|December"
)


def _parse_date_from_text(text: str) -> tuple[Optional[str], Optional[str]]:
    """
    Extract the first future date from a block of text.
    Handles:
    - "March 15, 2026 at 7:30 PM"
    - "March 15-17, 2026"
    - "Spring 2026" → skip (too vague)
    - "2026" alone → skip

    Returns (start_date, start_time) or (None, None).
    """
    # Full date with optional time: "Month Day, Year [at H:MM PM]"
    match = re.search(
        rf"({MONTHS})\s+(\d{{1,2}})(?:st|nd|rd|th)?(?:\s*[-–]\s*\d{{1,2}})?,?\s+(\d{{4}})"
        r"(?:\s+at\s+(\d{1,2}):(\d{2})\s*(am|pm|AM|PM))?",
        text,
        re.IGNORECASE,
    )
    if match:
        month, day, year = match.group(1), match.group(2), match.group(3)
        hour_s, min_s, meridiem = match.group(4), match.group(5), match.group(6)
        try:
            dt = datetime.strptime(f"{month} {day} {year}", "%B %d %Y")
            start_date = dt.strftime("%Y-%m-%d")
            start_time = None
            if hour_s and min_s and meridiem:
                hour_int = int(hour_s)
                if meridiem.upper() == "PM" and hour_int != 12:
                    hour_int += 12
                elif meridiem.upper() == "AM" and hour_int == 12:
                    hour_int = 0
                start_time = f"{hour_int:02d}:{min_s}"
            return start_date, start_time
        except ValueError:
            pass

    return None, None


def _is_future(date_str: str) -> bool:
    try:
        return datetime.strptime(date_str, "%Y-%m-%d").date() >= datetime.now().date()
    except ValueError:
        return False


def _extract_events_from_page(body_text: str, page_url: str) -> list[dict]:
    """
    Scan a page's body text for blocks that contain:
    - A title (heading-like text)
    - A concrete future date

    Returns list of raw event candidates.
    """
    candidates = []

    # Look for sections: title line followed (within 500 chars) by a date
    # Core Dance pages typically have: Title, date, description, Learn More
    # E.g., "EXPOSED\nMarch 15, 2026\n...description..."

    # Split text into chunks around date patterns
    date_pattern = re.compile(
        rf"({MONTHS})\s+\d{{1,2}}(?:st|nd|rd|th)?(?:\s*[-–]\s*\d{{1,2}})?,?\s+\d{{4}}",
        re.IGNORECASE,
    )

    # Find all date positions
    date_matches = list(date_pattern.finditer(body_text))
    for dm in date_matches:
        date_text = dm.group(0)
        start_date, start_time = _parse_date_from_text(date_text)
        if not start_date or not _is_future(start_date):
            continue

        # Look back 200 chars for a title
        lookback_start = max(0, dm.start() - 200)
        preceding = body_text[lookback_start: dm.start()]

        # Extract last meaningful chunk as title
        # Split on common separators
        title_candidates = re.split(r"[\n.!?]|Learn\s+More|more\s+about", preceding, flags=re.IGNORECASE)
        title = None
        for chunk in reversed(title_candidates):
            chunk = chunk.strip()
            chunk = re.sub(r"\s+", " ", chunk)
            if 5 < len(chunk) < 120 and not re.match(r"^\d", chunk):
                # Skip boilerplate navigation text
                if not re.match(
                    r"^(CURRENT SEASON|DONATE|ABOUT|PROGRAMS|MORE|Studio Rental|SUPPORT|"
                    r"Core Dance|Skip to|Wix\.com)",
                    chunk,
                    re.IGNORECASE,
                ):
                    title = chunk
                    break

        # Look ahead 400 chars for description
        lookahead_end = min(len(body_text), dm.end() + 400)
        following = body_text[dm.end(): lookahead_end]
        following = re.sub(r"\s+", " ", following).strip()
        # Trim at "Learn More" or next title indicator
        following = re.split(r"Learn\s+More|READ\s+MORE|\s{3,}", following)[0].strip()
        description = following[:400] if len(following) > 30 else None

        if title:
            candidates.append({
                "title": title,
                "start_date": start_date,
                "start_time": start_time,
                "description": description,
                "source_page": page_url,
            })

    return candidates


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Core Dance events by scanning season and presentation pages via Playwright."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    home_venue_id = get_or_create_place(CORE_DANCE_VENUE_DATA)

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                user_agent=(
                    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                ),
                viewport={"width": 1280, "height": 900},
            )
            page = context.new_page()

            all_candidates: list[dict] = []

            for scan_url in SCAN_PAGES:
                try:
                    logger.debug(f"Core Dance: scanning {scan_url}")
                    page.goto(scan_url, wait_until="domcontentloaded", timeout=25000)
                    page.wait_for_timeout(2500)

                    body_text = re.sub(r"\s+", " ", page.inner_text("body"))

                    # Also look for ticket/event links on this page
                    event_links: list[str] = []
                    links = page.query_selector_all("a[href]")
                    for link in links:
                        href = link.get_attribute("href") or ""
                        if any(k in href.lower() for k in ["ticket", "eventbrite", "rialto", "7stages", "emory.edu"]):
                            if href.startswith("http"):
                                event_links.append(href)

                    page_candidates = _extract_events_from_page(body_text, scan_url)
                    for cand in page_candidates:
                        # Attach ticket link if available
                        cand["ticket_url"] = event_links[0] if event_links else scan_url
                    all_candidates.extend(page_candidates)

                except PlaywrightTimeoutError:
                    logger.warning(f"Core Dance: timed out scanning {scan_url}")
                except Exception as e:
                    logger.warning(f"Core Dance: error scanning {scan_url}: {e}")

            browser.close()

        logger.info(f"Core Dance: {len(all_candidates)} event candidates found across all pages")

        # Deduplicate candidates by (title_lower, start_date)
        seen: set[tuple[str, str]] = set()
        for cand in all_candidates:
            title = cand["title"]
            start_date = cand["start_date"]
            start_time = cand.get("start_time")
            description = cand.get("description")
            ticket_url = cand.get("ticket_url", cand["source_page"])

            key = (title.lower()[:40], start_date)
            if key in seen:
                continue
            seen.add(key)

            events_found += 1
            content_hash = generate_content_hash(title, "Core Dance Studio", start_date)

            event_record = {
                "source_id": source_id,
                "venue_id": home_venue_id,
                "title": title,
                "description": description,
                "start_date": start_date,
                "start_time": start_time,
                "end_date": None,
                "end_time": None,
                "is_all_day": False,
                "category": "dance",
                "subcategory": "contemporary",
                "tags": ["core-dance", "dance", "contemporary-dance", "performing-arts", "decatur"],
                "price_min": None,
                "price_max": None,
                "price_note": None,
                "is_free": False,
                "source_url": cand["source_page"],
                "ticket_url": ticket_url,
                "image_url": None,
                "raw_text": f"{title} — {start_date}",
                "extraction_confidence": 0.78,
                "is_recurring": False,
                "recurrence_rule": None,
                "content_hash": content_hash,
            }

            existing = find_event_by_hash(content_hash)
            if existing:
                smart_update_existing_event(existing, event_record)
                events_updated += 1
            else:
                try:
                    insert_event(event_record)
                    events_new += 1
                    logger.info(f"Core Dance: added '{title}' on {start_date}")
                except Exception as e:
                    logger.error(f"Core Dance: failed to insert '{title}': {e}")

    except Exception as e:
        logger.error(f"Core Dance: crawl failed: {e}")
        raise

    logger.info(
        f"Core Dance crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
    )
    return events_found, events_new, events_updated
