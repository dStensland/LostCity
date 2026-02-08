"""
Generic festival schedule crawler.

Utility script that extracts individual program sessions from a festival's
schedule page and inserts them as events linked to the festival via series.

Supports multiple extraction strategies:
  1. JSON-LD (@type: Event) — best quality, structured data
  2. WordPress "The Events Calendar" plugin markup
  3. HTML table schedule grids (common for conventions)
  4. LLM extraction fallback for unstructured schedules

Usage:
    python crawl_festival_schedule.py --slug dragon-con --url https://www.dragoncon.org/schedule/
    python crawl_festival_schedule.py --slug dragon-con --url ... --dry-run
    python crawl_festival_schedule.py --slug atlanta-pride --url ... --render-js
    python crawl_festival_schedule.py --slug georgia-renaissance-festival --url ... --use-llm
"""

from __future__ import annotations

import argparse
import json
import logging
import re
import sys
from datetime import datetime
from typing import Optional
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup, Tag

from config import get_config
from db import (
    get_or_create_venue,
    get_source_by_slug,
    get_venue_by_slug,
    insert_event,
    find_event_by_hash,
)
from dedupe import generate_content_hash
from utils import setup_logging, slugify

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Data structures
# ---------------------------------------------------------------------------

class SessionData:
    """A single extracted festival session/event."""

    def __init__(
        self,
        title: str,
        start_date: str,
        start_time: Optional[str] = None,
        end_time: Optional[str] = None,
        description: Optional[str] = None,
        venue_name: Optional[str] = None,
        category: Optional[str] = None,
        image_url: Optional[str] = None,
        source_url: Optional[str] = None,
        is_all_day: bool = False,
        tags: Optional[list[str]] = None,
        artists: Optional[list[str]] = None,
        program_track: Optional[str] = None,
    ):
        self.title = title
        self.start_date = start_date
        self.start_time = start_time
        self.end_time = end_time
        self.description = description
        self.venue_name = venue_name
        self.category = category or "community"
        self.image_url = image_url
        self.source_url = source_url
        self.is_all_day = is_all_day
        self.tags = tags or []
        self.artists = artists or []
        self.program_track = program_track

    def __repr__(self) -> str:
        return f"Session({self.title!r}, {self.start_date}, {self.start_time})"


# ---------------------------------------------------------------------------
# Page fetching
# ---------------------------------------------------------------------------

def fetch_html(url: str, render_js: bool = False) -> str:
    """Fetch HTML from a URL. Optionally uses Playwright for JS-rendered pages."""
    if render_js:
        return _fetch_with_playwright(url)
    return _fetch_with_requests(url)


def _fetch_with_requests(url: str) -> str:
    cfg = get_config()
    headers = {"User-Agent": cfg.crawler.user_agent}
    resp = requests.get(url, headers=headers, timeout=cfg.crawler.request_timeout)
    resp.raise_for_status()
    return resp.text


def _fetch_with_playwright(url: str) -> str:
    from playwright.sync_api import sync_playwright

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
            viewport={"width": 1920, "height": 1080},
        )
        page = context.new_page()
        page.goto(url, wait_until="domcontentloaded", timeout=30000)
        page.wait_for_timeout(3000)

        # Scroll to load lazy content
        for _ in range(5):
            page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
            page.wait_for_timeout(800)

        html = page.content()
        browser.close()
        return html


# ---------------------------------------------------------------------------
# Extraction strategies
# ---------------------------------------------------------------------------

def extract_sessions_jsonld(html: str, base_url: str) -> list[SessionData]:
    """Extract sessions from JSON-LD @type: Event blocks."""
    soup = BeautifulSoup(html, "lxml")
    sessions = []

    for script in soup.find_all("script", type="application/ld+json"):
        try:
            data = json.loads(script.string or "")
        except (json.JSONDecodeError, TypeError):
            continue

        # Handle both single objects and arrays
        items = data if isinstance(data, list) else [data]

        # Also handle @graph wrapper
        for item in items:
            if isinstance(item, dict) and "@graph" in item:
                items.extend(item["@graph"])

        for item in items:
            if not isinstance(item, dict):
                continue
            item_type = item.get("@type", "")
            # Accept Event, MusicEvent, TheaterEvent, etc.
            if "Event" not in str(item_type):
                continue

            session = _parse_jsonld_event(item, base_url)
            if session:
                sessions.append(session)

    logger.info(f"JSON-LD: extracted {len(sessions)} sessions")
    return sessions


def _parse_jsonld_event(item: dict, base_url: str) -> Optional[SessionData]:
    """Parse a single JSON-LD Event object into a SessionData."""
    title = item.get("name", "").strip()
    if not title:
        return None

    # Parse dates
    start_str = item.get("startDate", "")
    start_date, start_time = _parse_iso_datetime(start_str)
    if not start_date:
        return None

    end_str = item.get("endDate", "")
    _, end_time = _parse_iso_datetime(end_str)

    # Venue
    location = item.get("location", {})
    venue_name = None
    if isinstance(location, dict):
        venue_name = location.get("name")
    elif isinstance(location, str):
        venue_name = location

    # Description
    description = item.get("description", "")
    if description:
        description = description[:1000]

    # Image
    image = item.get("image")
    image_url = None
    if isinstance(image, str):
        image_url = image
    elif isinstance(image, list) and image:
        image_url = image[0] if isinstance(image[0], str) else image[0].get("url")
    elif isinstance(image, dict):
        image_url = image.get("url")

    # URL
    source_url = item.get("url")
    if source_url and not source_url.startswith("http"):
        source_url = urljoin(base_url, source_url)

    return SessionData(
        title=title,
        start_date=start_date,
        start_time=start_time,
        end_time=end_time,
        description=description,
        venue_name=venue_name,
        image_url=image_url,
        source_url=source_url,
    )


def extract_sessions_wp_events_calendar(html: str, base_url: str) -> list[SessionData]:
    """Extract sessions from WordPress 'The Events Calendar' plugin markup."""
    soup = BeautifulSoup(html, "lxml")
    sessions = []

    # TEC uses .tribe-events-calendar-list__event-row or .tribe_events class
    selectors = [
        ".tribe-events-calendar-list__event-row",
        ".tribe-events-pro-week-grid__event",
        ".tribe_events .type-tribe_events",
        "article.tribe_events",
        ".tribe-common-g-row",
    ]

    for selector in selectors:
        events = soup.select(selector)
        if events:
            logger.info(f"WP Events Calendar: matched {len(events)} items via {selector}")
            for el in events:
                session = _parse_wp_event_element(el, base_url)
                if session:
                    sessions.append(session)
            break

    if not sessions:
        # Try the single-event page pattern
        single = soup.select_one(".tribe-events-single")
        if single:
            session = _parse_wp_event_element(single, base_url)
            if session:
                sessions.append(session)

    logger.info(f"WP Events Calendar: extracted {len(sessions)} sessions")
    return sessions


def _parse_wp_event_element(el: Tag, base_url: str) -> Optional[SessionData]:
    """Parse a single WordPress Events Calendar element."""
    # Title
    title_el = el.select_one(
        ".tribe-events-calendar-list__event-title a, "
        ".tribe-event-url a, "
        "h2 a, h3 a, .tribe-events-list-event-title a"
    )
    title = title_el.get_text(strip=True) if title_el else None
    if not title:
        title_el = el.select_one("h2, h3, .tribe-events-calendar-list__event-title")
        title = title_el.get_text(strip=True) if title_el else None
    if not title:
        return None

    # URL
    source_url = None
    if title_el and title_el.name == "a":
        source_url = title_el.get("href")
    elif title_el:
        a = title_el.find("a")
        if a:
            source_url = a.get("href")
    if source_url and not source_url.startswith("http"):
        source_url = urljoin(base_url, source_url)

    # Date/time from datetime attribute
    time_el = el.select_one("time[datetime], .tribe-events-schedule time, abbr.tribe-events-abbr")
    start_date = None
    start_time = None
    if time_el:
        dt_str = time_el.get("datetime") or time_el.get("title") or ""
        start_date, start_time = _parse_iso_datetime(dt_str)

    # Fallback: parse from text
    if not start_date:
        date_el = el.select_one(
            ".tribe-events-calendar-list__event-datetime, "
            ".tribe-event-schedule-details, "
            ".tribe-events-schedule"
        )
        if date_el:
            start_date, start_time = _parse_human_datetime(date_el.get_text(strip=True))

    if not start_date:
        return None

    # Description
    desc_el = el.select_one(
        ".tribe-events-calendar-list__event-description p, "
        ".tribe-events-list-event-description p, "
        ".tribe-events-content p"
    )
    description = desc_el.get_text(strip=True) if desc_el else None

    # Venue
    venue_el = el.select_one(
        ".tribe-events-calendar-list__event-venue, "
        ".tribe-venue a, "
        ".tribe-venue"
    )
    venue_name = venue_el.get_text(strip=True) if venue_el else None

    # Image
    img = el.select_one("img")
    image_url = img.get("src") if img else None

    return SessionData(
        title=title,
        start_date=start_date,
        start_time=start_time,
        description=description,
        venue_name=venue_name,
        image_url=image_url,
        source_url=source_url,
    )


def extract_sessions_html_table(html: str, base_url: str) -> list[SessionData]:
    """Extract sessions from HTML table schedule grids (common for conventions)."""
    soup = BeautifulSoup(html, "lxml")
    sessions = []

    tables = soup.find_all("table")
    for table in tables:
        rows = table.find_all("tr")
        if len(rows) < 2:
            continue

        # Try to identify header row
        headers = []
        header_row = rows[0]
        for th in header_row.find_all(["th", "td"]):
            headers.append(th.get_text(strip=True).lower())

        if not headers:
            continue

        # Look for time/title/room columns
        time_col = _find_column(headers, ["time", "start", "when", "schedule"])
        title_col = _find_column(headers, ["title", "session", "event", "panel", "name", "description"])
        room_col = _find_column(headers, ["room", "location", "venue", "stage", "track"])
        date_col = _find_column(headers, ["date", "day"])

        if title_col is None:
            continue

        current_date = None
        for row in rows[1:]:
            cells = row.find_all(["td", "th"])
            if len(cells) <= title_col:
                continue

            title = cells[title_col].get_text(strip=True)
            if not title or len(title) < 3:
                continue

            # Date
            if date_col is not None and len(cells) > date_col:
                date_text = cells[date_col].get_text(strip=True)
                parsed_date, _ = _parse_human_datetime(date_text)
                if parsed_date:
                    current_date = parsed_date

            if not current_date:
                continue

            # Time
            start_time = None
            end_time = None
            if time_col is not None and len(cells) > time_col:
                time_text = cells[time_col].get_text(strip=True)
                start_time, end_time = _parse_time_range(time_text)

            # Room/venue
            venue_name = None
            program_track = None
            if room_col is not None and len(cells) > room_col:
                room_text = cells[room_col].get_text(strip=True)
                venue_name = room_text
                program_track = room_text

            sessions.append(SessionData(
                title=title,
                start_date=current_date,
                start_time=start_time,
                end_time=end_time,
                venue_name=venue_name,
                program_track=program_track,
                source_url=base_url,
            ))

    logger.info(f"HTML table: extracted {len(sessions)} sessions")
    return sessions


def extract_sessions_llm(html: str, url: str, festival_name: str) -> list[SessionData]:
    """Fall back to LLM extraction for unstructured schedule pages."""
    from extract import extract_events

    events = extract_events(html, url, festival_name)
    sessions = []
    for ev in events:
        sessions.append(SessionData(
            title=ev.title,
            start_date=ev.start_date,
            start_time=ev.start_time,
            end_time=ev.end_time,
            description=ev.description,
            venue_name=ev.venue.name if ev.venue else None,
            category=ev.category,
            image_url=ev.image_url,
            source_url=ev.detail_url or url,
            is_all_day=ev.is_all_day,
            tags=ev.tags,
            artists=ev.artists,
        ))

    logger.info(f"LLM extraction: extracted {len(sessions)} sessions")
    return sessions


# ---------------------------------------------------------------------------
# Date/time parsing helpers
# ---------------------------------------------------------------------------

def _parse_iso_datetime(dt_str: str) -> tuple[Optional[str], Optional[str]]:
    """Parse an ISO 8601 datetime string into (date, time) or (date, None)."""
    if not dt_str:
        return None, None

    # Try full datetime formats
    for fmt in ("%Y-%m-%dT%H:%M:%S%z", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%dT%H:%M"):
        try:
            dt = datetime.strptime(dt_str[:19], fmt[:len(dt_str[:19]) + 2].rstrip("%z"))
            return dt.strftime("%Y-%m-%d"), dt.strftime("%H:%M")
        except ValueError:
            continue

    # Try ISO date with timezone (strip tz)
    m = re.match(r"(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})", dt_str)
    if m:
        return m.group(1), m.group(2)

    # Date only
    m = re.match(r"(\d{4}-\d{2}-\d{2})", dt_str)
    if m:
        return m.group(1), None

    return None, None


MONTH_MAP = {
    "jan": 1, "january": 1, "feb": 2, "february": 2, "mar": 3, "march": 3,
    "apr": 4, "april": 4, "may": 5, "jun": 6, "june": 6,
    "jul": 7, "july": 7, "aug": 8, "august": 8, "sep": 9, "september": 9,
    "oct": 10, "october": 10, "nov": 11, "november": 11, "dec": 12, "december": 12,
}


def _parse_human_datetime(text: str) -> tuple[Optional[str], Optional[str]]:
    """Parse human-readable date text like 'March 15, 2026' or 'Sat, Mar 15'."""
    if not text:
        return None, None

    text = text.strip()

    # "March 15, 2026" or "Mar 15, 2026"
    m = re.search(
        r"(\w+)\s+(\d{1,2}),?\s*(\d{4})",
        text,
    )
    if m:
        month_str = m.group(1).lower()
        day = int(m.group(2))
        year = int(m.group(3))
        month = MONTH_MAP.get(month_str)
        if month:
            return f"{year:04d}-{month:02d}-{day:02d}", None

    # "March 15" (assume current/next year)
    m = re.search(r"(\w+)\s+(\d{1,2})(?!\d)", text)
    if m:
        month_str = m.group(1).lower()
        day = int(m.group(2))
        month = MONTH_MAP.get(month_str)
        if month:
            year = datetime.now().year
            # If the date has passed, use next year
            candidate = datetime(year, month, day)
            if candidate < datetime.now() - __import__("datetime").timedelta(days=30):
                year += 1
            return f"{year:04d}-{month:02d}-{day:02d}", None

    # "2026-03-15"
    m = re.match(r"(\d{4})-(\d{2})-(\d{2})", text)
    if m:
        return m.group(0), None

    return None, None


def _parse_time_range(text: str) -> tuple[Optional[str], Optional[str]]:
    """Parse a time range like '7:00 PM - 9:00 PM' into (start, end)."""
    times = re.findall(r"(\d{1,2}):(\d{2})\s*(am|pm)", text, re.IGNORECASE)
    if not times:
        return None, None

    results = []
    for hour_str, minute_str, period in times:
        hour = int(hour_str)
        if period.lower() == "pm" and hour != 12:
            hour += 12
        elif period.lower() == "am" and hour == 12:
            hour = 0
        results.append(f"{hour:02d}:{minute_str}")

    start = results[0] if results else None
    end = results[1] if len(results) > 1 else None
    return start, end


def _find_column(headers: list[str], keywords: list[str]) -> Optional[int]:
    """Find the column index whose header matches any of the given keywords."""
    for i, header in enumerate(headers):
        for keyword in keywords:
            if keyword in header:
                return i
    return None


# ---------------------------------------------------------------------------
# Venue resolution
# ---------------------------------------------------------------------------

def resolve_session_venue(
    session: SessionData,
    festival_slug: str,
    default_venue_id: Optional[int] = None,
) -> int:
    """Map a session's venue name to an existing venue ID, or use the festival's default."""
    if session.venue_name:
        venue_slug = slugify(session.venue_name)
        existing = get_venue_by_slug(venue_slug)
        if existing:
            return existing["id"]

    if default_venue_id:
        return default_venue_id

    # Last resort: create a minimal placeholder venue
    if session.venue_name:
        venue_data = {
            "name": session.venue_name,
            "slug": slugify(session.venue_name),
            "city": "Atlanta",
            "state": "GA",
        }
        return get_or_create_venue(venue_data)

    raise ValueError(f"Cannot resolve venue for session: {session.title}")


# ---------------------------------------------------------------------------
# Session insertion
# ---------------------------------------------------------------------------

def insert_sessions(
    sessions: list[SessionData],
    festival_slug: str,
    festival_name: str,
    source_id: int,
    default_venue_id: Optional[int] = None,
    dry_run: bool = False,
) -> tuple[int, int, int]:
    """Batch insert sessions with dedup. Returns (found, new, skipped)."""
    found = len(sessions)
    new = 0
    skipped = 0

    for session in sessions:
        # Resolve venue name
        venue_name_for_hash = session.venue_name or festival_name
        content_hash = generate_content_hash(
            session.title, venue_name_for_hash, session.start_date
        )

        if find_event_by_hash(content_hash):
            skipped += 1
            logger.debug(f"Duplicate: {session.title} on {session.start_date}")
            continue

        if dry_run:
            logger.info(
                f"[DRY RUN] Would insert: {session.title} | "
                f"{session.start_date} {session.start_time or '??:??'} | "
                f"venue={session.venue_name or 'default'} | "
                f"category={session.category}"
            )
            new += 1
            continue

        try:
            venue_id = resolve_session_venue(session, festival_slug, default_venue_id)
        except ValueError as e:
            logger.warning(f"Skipping session (no venue): {e}")
            skipped += 1
            continue

        # Build series hint for festival program linking
        series_hint = {
            "series_type": "festival_program",
            "series_title": session.program_track or session.title,
            "festival_name": festival_name,
        }

        event_record = {
            "source_id": source_id,
            "venue_id": venue_id,
            "title": session.title,
            "description": session.description,
            "start_date": session.start_date,
            "start_time": session.start_time,
            "end_date": None,
            "end_time": session.end_time,
            "is_all_day": session.is_all_day,
            "category": session.category,
            "tags": session.tags,
            "is_free": False,
            "source_url": session.source_url,
            "image_url": session.image_url,
            "content_hash": content_hash,
            "is_recurring": False,
        }

        try:
            insert_event(event_record, series_hint=series_hint)
            new += 1
            logger.info(f"Added: {session.title} on {session.start_date}")
        except Exception as e:
            logger.error(f"Failed to insert {session.title}: {e}")
            skipped += 1

    return found, new, skipped


# ---------------------------------------------------------------------------
# Main orchestration
# ---------------------------------------------------------------------------

def crawl_festival_schedule(
    slug: str,
    url: str,
    render_js: bool = False,
    use_llm: bool = False,
    dry_run: bool = False,
) -> tuple[int, int, int]:
    """
    Crawl a festival schedule page and insert sessions.

    Args:
        slug: Festival source slug (must exist in sources table)
        url: Schedule page URL
        render_js: Use Playwright for JS-rendered pages
        use_llm: Force LLM extraction instead of structured parsing
        dry_run: Log what would be inserted without writing to DB

    Returns:
        (sessions_found, sessions_new, sessions_skipped)
    """
    # Look up source
    source = get_source_by_slug(slug)
    if not source:
        logger.error(f"Source not found: {slug}")
        sys.exit(1)

    source_id = source["id"]
    festival_name = source.get("name", slug)

    # Resolve default venue from source (if the festival has a "home" venue)
    default_venue_id = source.get("venue_id")

    logger.info(f"Crawling festival schedule: {festival_name} ({slug})")
    logger.info(f"URL: {url}")
    logger.info(f"Options: render_js={render_js}, use_llm={use_llm}, dry_run={dry_run}")

    # Fetch page
    html = fetch_html(url, render_js=render_js)
    logger.info(f"Fetched {len(html):,} bytes")

    # Extract sessions using available strategies
    sessions: list[SessionData] = []

    if use_llm:
        sessions = extract_sessions_llm(html, url, festival_name)
    else:
        # Try strategies in order of quality
        sessions = extract_sessions_jsonld(html, url)

        if not sessions:
            sessions = extract_sessions_wp_events_calendar(html, url)

        if not sessions:
            sessions = extract_sessions_html_table(html, url)

        if not sessions:
            logger.info("No structured data found, falling back to LLM extraction")
            sessions = extract_sessions_llm(html, url, festival_name)

    if not sessions:
        logger.warning(f"No sessions extracted from {url}")
        return 0, 0, 0

    logger.info(f"Extracted {len(sessions)} sessions from {url}")

    # Insert sessions
    found, new, skipped = insert_sessions(
        sessions,
        festival_slug=slug,
        festival_name=festival_name,
        source_id=source_id,
        default_venue_id=default_venue_id,
        dry_run=dry_run,
    )

    logger.info(
        f"Festival schedule crawl complete: {found} found, {new} new, {skipped} skipped"
    )
    return found, new, skipped


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="Crawl a festival schedule page for program sessions"
    )
    parser.add_argument("--slug", required=True, help="Festival source slug")
    parser.add_argument("--url", required=True, help="Schedule page URL")
    parser.add_argument("--render-js", action="store_true", help="Use Playwright for JS rendering")
    parser.add_argument("--use-llm", action="store_true", help="Force LLM extraction")
    parser.add_argument("--dry-run", action="store_true", help="Log without inserting")
    parser.add_argument("--verbose", action="store_true", help="Enable debug logging")

    args = parser.parse_args()

    setup_logging()
    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)

    crawl_festival_schedule(
        slug=args.slug,
        url=args.url,
        render_js=args.render_js,
        use_llm=args.use_llm,
        dry_run=args.dry_run,
    )


if __name__ == "__main__":
    main()
