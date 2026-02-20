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
import shutil
import subprocess
import sys
from datetime import date, datetime, timedelta
from pathlib import Path
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
from utils import setup_logging, slugify, is_likely_non_event_image

logger = logging.getLogger(__name__)

_UNKNOWN_VENUE_MARKERS = {
    "unknown venue",
    "unknown",
    "tba",
    "to be announced",
    "n/a",
    "none",
    "off campus in atl",
}

_FESTIVAL_LLM_PROVIDER_OVERRIDES_PATH = (
    Path(__file__).resolve().parent / "config" / "festival_llm_provider_overrides.json"
)


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


def _normalize_image_url(image_url: Optional[str], base_url: str) -> Optional[str]:
    """Normalize and quality-filter an image URL."""
    if not image_url:
        return None
    normalized = str(image_url).strip()
    if not normalized:
        return None

    if normalized.startswith("//"):
        normalized = "https:" + normalized
    elif not normalized.startswith("http"):
        normalized = urljoin(base_url, normalized)

    if is_likely_non_event_image(normalized):
        return None
    return normalized


def _pick_best_image_url(image_field, base_url: str) -> Optional[str]:
    """Pick the first usable image URL from JSON-LD image payloads."""
    candidates: list[str] = []

    if isinstance(image_field, str):
        candidates.append(image_field)
    elif isinstance(image_field, dict):
        for key in ("url", "contentUrl", "thumbnailUrl"):
            value = image_field.get(key)
            if isinstance(value, str) and value:
                candidates.append(value)
    elif isinstance(image_field, list):
        for item in image_field:
            if isinstance(item, str):
                candidates.append(item)
            elif isinstance(item, dict):
                for key in ("url", "contentUrl", "thumbnailUrl"):
                    value = item.get(key)
                    if isinstance(value, str) and value:
                        candidates.append(value)

    for candidate in candidates:
        normalized = _normalize_image_url(candidate, base_url)
        if normalized:
            return normalized
    return None


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
    headers = {
        "User-Agent": cfg.crawler.user_agent,
        # Keep decoding predictable for parser/LLM input.
        "Accept-Encoding": "gzip, deflate",
    }
    resp = requests.get(url, headers=headers, timeout=cfg.crawler.request_timeout)
    resp.raise_for_status()
    if (resp.headers.get("content-encoding") or "").lower() == "br":
        return _decode_brotli_response(resp)
    return resp.text


def _decode_brotli_response(resp: requests.Response) -> str:
    """Decode brotli-compressed response bytes with optional local decoders."""
    raw = resp.content

    for module_name in ("brotli", "brotlicffi"):
        try:
            decoder = __import__(module_name)
            decoded = decoder.decompress(raw)
            return decoded.decode(resp.encoding or "utf-8", errors="replace")
        except Exception:
            continue

    brotli_bin = shutil.which("brotli")
    if brotli_bin:
        try:
            proc = subprocess.run(
                [brotli_bin, "-d", "-c"],
                input=raw,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                check=True,
            )
            return proc.stdout.decode(resp.encoding or "utf-8", errors="replace")
        except Exception as exc:
            logger.debug("brotli CLI decode failed for %s: %s", resp.url, exc)

    logger.warning("Brotli content received but no decoder available for %s", resp.url)
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
    image_url = _pick_best_image_url(item.get("image"), base_url)

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
    image_url = None
    if img:
        src = img.get("src") or img.get("data-src")
        if not src:
            srcset = img.get("srcset")
            if srcset:
                src = srcset.split(",")[0].strip().split(" ")[0]
        image_url = _normalize_image_url(src, base_url)

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


def _load_provider_overrides() -> dict[str, str]:
    if not _FESTIVAL_LLM_PROVIDER_OVERRIDES_PATH.exists():
        return {}

    try:
        payload = json.loads(_FESTIVAL_LLM_PROVIDER_OVERRIDES_PATH.read_text())
    except Exception as exc:
        logger.warning("Unable to parse provider override file %s: %s", _FESTIVAL_LLM_PROVIDER_OVERRIDES_PATH, exc)
        return {}

    raw = payload.get("providers_by_slug", {}) if isinstance(payload, dict) else {}
    if not isinstance(raw, dict):
        return {}
    out: dict[str, str] = {}
    for slug, provider in raw.items():
        if isinstance(slug, str) and isinstance(provider, str):
            out[slug.strip().lower()] = provider.strip().lower()
    return out


def _resolve_llm_provider_for_slug(slug: str, override_provider: Optional[str]) -> Optional[str]:
    if override_provider:
        return override_provider.strip().lower()
    overrides = _load_provider_overrides()
    return overrides.get((slug or "").strip().lower())


def _extract_sessions_llm_with_provider(
    html: str,
    url: str,
    festival_name: str,
    slug: str,
    llm_provider: Optional[str] = None,
    llm_model: Optional[str] = None,
) -> list[SessionData]:
    """Run LLM extraction with optional per-source provider override."""
    from extract import extract_events

    provider = _resolve_llm_provider_for_slug(slug, llm_provider)
    events = extract_events(
        html,
        url,
        festival_name,
        llm_provider=provider,
        llm_model=llm_model,
    )
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

    if provider:
        logger.info("LLM extraction provider for %s: %s", slug, provider)
    logger.info(f"LLM extraction: extracted {len(sessions)} sessions")
    return sessions


def _is_unknown_venue(venue_name: Optional[str]) -> bool:
    if not venue_name:
        return True
    normalized = venue_name.strip().lower()
    return normalized in _UNKNOWN_VENUE_MARKERS


def _is_generic_title(title: str, festival_name: str) -> bool:
    normalized_title = (title or "").strip().lower()
    normalized_festival = (festival_name or "").strip().lower()
    if not normalized_title:
        return True
    if normalized_festival and normalized_title == normalized_festival:
        return True
    # Same title with only year suffix variation.
    return bool(
        normalized_festival
        and re.sub(r"\s+\d{4}$", "", normalized_title) == re.sub(r"\s+\d{4}$", "", normalized_festival)
    )


def _parse_session_date(value: Optional[str]) -> Optional[date]:
    if not value:
        return None
    try:
        return datetime.strptime(value, "%Y-%m-%d").date()
    except ValueError:
        return None


def _apply_llm_quality_gate(
    sessions: list[SessionData],
    festival_name: str,
    today: Optional[date] = None,
) -> tuple[list[SessionData], list[str]]:
    """Drop low-signal LLM sessions that are likely hallucinated placeholders."""
    if not sessions:
        return sessions, []

    now = today or date.today()
    reasons: list[str] = []
    kept: list[SessionData] = []

    for session in sessions:
        session_date = _parse_session_date(session.start_date)
        if session_date is None:
            reasons.append(f"drop:{session.title}:invalid_date")
            continue
        if session_date < now:
            reasons.append(f"drop:{session.title}:past_date")
            continue
        if len((session.title or "").strip()) < 4:
            reasons.append(f"drop:{session.title}:short_title")
            continue
        kept.append(session)

    if not kept:
        reasons.append("batch_reject:no_valid_sessions_after_row_filter")
        return [], reasons

    if len(kept) == 1:
        only = kept[0]
        only_date = _parse_session_date(only.start_date)
        jan_first = bool(only_date and only_date.month == 1 and only_date.day == 1)
        low_signal_singleton = (
            not only.start_time
            and (
                _is_unknown_venue(only.venue_name)
                or _is_generic_title(only.title, festival_name)
                or jan_first
            )
        )
        if low_signal_singleton:
            reasons.append("batch_reject:singleton_low_signal")
            return [], reasons

    unknown_venue_count = sum(1 for session in kept if _is_unknown_venue(session.venue_name))
    missing_time_count = sum(1 for session in kept if not session.start_time)
    if (
        len(kept) <= 2
        and missing_time_count == len(kept)
        and unknown_venue_count == len(kept)
    ):
        reasons.append("batch_reject:tiny_batch_all_tba_unknown_venue")
        return [], reasons

    return kept, reasons


# ---------------------------------------------------------------------------
# Date/time parsing helpers
# ---------------------------------------------------------------------------

def _parse_iso_datetime(dt_str: str) -> tuple[Optional[str], Optional[str]]:
    """Parse an ISO 8601 datetime string into (date, time) or (date, None)."""
    if not dt_str:
        return None, None

    value = dt_str.strip()

    # Native ISO parser handles timezone offsets and fractional seconds.
    try:
        normalized = value.replace("Z", "+00:00")
        dt = datetime.fromisoformat(normalized)
        return dt.strftime("%Y-%m-%d"), dt.strftime("%H:%M")
    except ValueError:
        pass

    # Try ISO date with timezone (strip tz)
    m = re.search(r"(\d{4}-\d{2}-\d{2})[T\s](\d{2}:\d{2})", value)
    if m:
        return m.group(1), m.group(2)

    # Date only
    m = re.search(r"(\d{4}-\d{2}-\d{2})", value)
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

    # Parse first explicit time token, if present.
    time_value = None
    time_match = re.search(r"(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b", text, re.IGNORECASE)
    if time_match:
        hour = int(time_match.group(1))
        minute = int(time_match.group(2) or "00")
        period = time_match.group(3).lower()
        if period == "pm" and hour != 12:
            hour += 12
        elif period == "am" and hour == 12:
            hour = 0
        time_value = f"{hour:02d}:{minute:02d}"

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
            return f"{year:04d}-{month:02d}-{day:02d}", time_value

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
            if candidate < datetime.now() - timedelta(days=30):
                year += 1
            return f"{year:04d}-{month:02d}-{day:02d}", time_value

    # "2026-03-15"
    m = re.match(r"(\d{4})-(\d{2})-(\d{2})", text)
    if m:
        return m.group(0), time_value

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
    llm_provider: Optional[str] = None,
    llm_model: Optional[str] = None,
) -> tuple[int, int, int]:
    """
    Crawl a festival schedule page and insert sessions.

    Args:
        slug: Festival source slug (must exist in sources table)
        url: Schedule page URL
        render_js: Use Playwright for JS-rendered pages
        use_llm: Force LLM extraction instead of structured parsing
        dry_run: Log what would be inserted without writing to DB
        llm_provider: Optional provider override ("openai" | "anthropic")
        llm_model: Optional model override for the selected provider

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
    used_llm = False

    if use_llm:
        used_llm = True
        sessions = _extract_sessions_llm_with_provider(
            html=html,
            url=url,
            festival_name=festival_name,
            slug=slug,
            llm_provider=llm_provider,
            llm_model=llm_model,
        )
    else:
        # Try strategies in order of quality
        sessions = extract_sessions_jsonld(html, url)

        if not sessions:
            sessions = extract_sessions_wp_events_calendar(html, url)

        if not sessions:
            sessions = extract_sessions_html_table(html, url)

        if not sessions:
            logger.info("No structured data found, falling back to LLM extraction")
            used_llm = True
            sessions = _extract_sessions_llm_with_provider(
                html=html,
                url=url,
                festival_name=festival_name,
                slug=slug,
                llm_provider=llm_provider,
                llm_model=llm_model,
            )

    if used_llm and sessions:
        sessions, gate_reasons = _apply_llm_quality_gate(sessions, festival_name)
        if gate_reasons:
            logger.info("LLM quality gate (%s): %s", slug, "; ".join(gate_reasons))

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
    parser.add_argument("--llm-provider", choices=["openai", "anthropic"], help="Override LLM provider for this run")
    parser.add_argument("--llm-model", help="Override model name for the selected provider")
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
        llm_provider=args.llm_provider,
        llm_model=args.llm_model,
    )


if __name__ == "__main__":
    main()
