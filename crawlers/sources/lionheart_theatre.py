"""
Crawler for Lionheart Theatre Company (lionhearttheatre.org).

Award-winning community theatre in a restored 1877 church in historic downtown
Norcross, GA. Oldest operating community theatre in Gwinnett County.

Strategy: requests + BeautifulSoup against the season page.
Divi-powered WordPress sites render full HTML server-side, so no JS rendering
is needed. Falls back to WordPress REST API page listing if direct HTML parse
yields nothing.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime
from typing import Optional

import requests
from bs4 import BeautifulSoup

from db import (
    get_or_create_venue,
    insert_event,
    find_event_by_hash,
    smart_update_existing_event,
    remove_stale_source_events,
)
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://lionhearttheatre.org"
SEASON_URL = f"{BASE_URL}/2026-season/"
WP_PAGES_API = f"{BASE_URL}/wp-json/wp/v2/pages?per_page=50"

REQUEST_HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; LostCity/1.0)",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}

VENUE_DATA = {
    "name": "Lionheart Theatre Company",
    "slug": "lionheart-theatre",
    "address": "10 College St NW",
    "neighborhood": "Downtown Norcross",
    "city": "Norcross",
    "state": "GA",
    "zip": "30071",
    "lat": 33.9421,
    "lng": -84.2110,
    "venue_type": "theater",
    "spot_type": "theater",
    "website": BASE_URL,
    "description": (
        "Award-winning community theatre in a restored 1877 church in historic downtown "
        "Norcross. Oldest operating community theatre in Gwinnett County. Presents a "
        "full season of comedies, dramas, and musicals in an intimate historic setting."
    ),
    "vibes": ["theater", "community-theater", "historic", "family-friendly"],
}

OVATIONTIX_BASE = "https://ci.ovationtix.com/35819/production/"


_MONTH_PATTERN = (
    r"(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?"
    r"|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)"
)


def _to_date(month_name: str, day: str, year: str) -> Optional[str]:
    """Convert month name (full or abbreviated), day, year to YYYY-MM-DD."""
    # Normalise abbreviated months: "Mar" -> "Mar", "March" -> "Mar"
    abbrev = month_name[:3].title()
    for fmt in ("%b %d %Y", "%B %d %Y"):
        try:
            dt = datetime.strptime(f"{abbrev} {day} {year}", fmt)
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            pass
    # Try full name directly
    try:
        dt = datetime.strptime(f"{month_name} {day} {year}", "%B %d %Y")
        return dt.strftime("%Y-%m-%d")
    except ValueError:
        return None


def parse_date_range(text: str) -> tuple[Optional[str], Optional[str]]:
    """
    Parse date ranges from Lionheart's season page.

    Handles both abbreviated ("Mar") and full ("March") month names:
      - "March 13-29, 2026"  or  "Mar 13-29, 2026"       (same month)
      - "October 22-25, 2026"                              (same month)
      - "April 30 - May 16, 2026"                          (cross-month)
      - "July 16-19, 2026"   or  "Jul 16-19, 2026"        (same month)
    """
    # Cross-month: "Month Day - Month Day, Year"
    cross = re.search(
        _MONTH_PATTERN + r"\s+(\d{1,2})\s*[-\u2013]\s*" + _MONTH_PATTERN + r"\s+(\d{1,2}),?\s*(\d{4})",
        text,
        re.IGNORECASE,
    )
    if cross:
        s_mon, s_day, e_mon, e_day, year = cross.groups()
        s_date = _to_date(s_mon, s_day, year)
        e_date = _to_date(e_mon, e_day, year)
        if s_date and e_date:
            return s_date, e_date

    # Same month: "Month Day-Day, Year"
    same = re.search(
        _MONTH_PATTERN + r"\s+(\d{1,2})\s*[-\u2013]\s*(\d{1,2}),?\s*(\d{4})",
        text,
        re.IGNORECASE,
    )
    if same:
        month, s_day, e_day, year = same.groups()
        s_date = _to_date(month, s_day, year)
        e_date = _to_date(month, e_day, year)
        if s_date and e_date:
            return s_date, e_date

    # Single date
    single = re.search(
        _MONTH_PATTERN + r"\s+(\d{1,2}),?\s*(\d{4})",
        text,
        re.IGNORECASE,
    )
    if single:
        month, day, year = single.groups()
        date_str = _to_date(month, day, year)
        if date_str:
            return date_str, date_str

    return None, None


def parse_shows_from_html(html: str) -> list[dict]:
    """
    Extract show records from the Lionheart season page HTML.

    Divi renders all shows inside a single et_pb_text_inner div as a text block:

        "Show Title" by Author
        Dates: Month Day-Day, Year
        Directed by ...
        Description paragraph...

    We split on the "Dates:" lines to segment shows.
    """
    soup = BeautifulSoup(html, "html.parser")
    shows = []

    # All season content is in one big Divi text inner block
    inner_div = soup.find("div", class_="et_pb_text_inner")
    if not inner_div:
        logger.warning("Could not find et_pb_text_inner on Lionheart season page")
        return shows

    full_text = inner_div.get_text(separator="\n", strip=True)

    # Split into blocks: each block starts with a line that looks like "Title" by Author
    # followed shortly by "Dates: ..."
    # Strategy: split on "Dates:" keyword and walk back to find the title
    date_blocks = re.split(r"\nDates:", full_text)

    for i, block in enumerate(date_blocks):
        if i == 0:
            # Everything before first "Dates:" — skip (season header)
            continue

        # This block starts with the date line (after "Dates:"), then description
        # The title is the last non-empty line of the PREVIOUS block
        prev_block = date_blocks[i - 1].strip()
        prev_lines = [ln.strip() for ln in prev_block.splitlines() if ln.strip()]
        if not prev_lines:
            continue

        # Title is the last substantive line of the previous block
        # It may be: '"Title" by Author', 'Title by Author', or just 'Title'
        raw_title_line = prev_lines[-1]
        # Remove " by Author" suffix first, then strip all quote characters
        title = re.sub(r"\s+by\s+.+$", "", raw_title_line, flags=re.IGNORECASE).strip()
        title = title.strip("\"'\u2018\u2019\u201c\u201d\u201e\u201f").strip()
        if not title or len(title) < 3:
            continue

        # Parse dates from the first line of this block
        block_lines = block.splitlines()
        date_line = block_lines[0].strip() if block_lines else ""
        start_date, end_date = parse_date_range(date_line)
        if not start_date:
            # Try the broader block text
            start_date, end_date = parse_date_range(block[:100])

        if not start_date:
            logger.debug("No date found for show: %s", title)
            continue

        # Description: skip "Directed by ..." lines, collect the rest
        desc_lines = []
        for line in block_lines[1:]:
            line = line.strip()
            if not line:
                continue
            if re.match(r"^Directed by\b", line, re.IGNORECASE):
                continue
            if len(line) > 20:
                desc_lines.append(line)
            if len(desc_lines) >= 3:
                break
        description = " ".join(desc_lines)[:500] if desc_lines else None

        # OvationTix ticket URL if present in the block
        ticket_url: Optional[str] = None
        for a in inner_div.find_all("a", href=True):
            href = a["href"]
            if "ovationtix" in href:
                # Try to associate with the nearest title — for now grab any
                ticket_url = href
                break

        # Image
        image_url: Optional[str] = None
        img = soup.find("img")
        if img:
            src = img.get("src") or img.get("data-src") or ""
            if src and "logo" not in src.lower() and src.startswith("http"):
                image_url = src

        shows.append(
            {
                "title": title,
                "start_date": start_date,
                "end_date": end_date,
                "description": description,
                "ticket_url": ticket_url,
                "image_url": image_url,
            }
        )

    return shows


def fetch_season_html() -> Optional[str]:
    """
    Attempt to fetch the 2026 season page.
    Tries direct URL first; falls back to WP REST API to find the page.
    """
    try:
        resp = requests.get(SEASON_URL, headers=REQUEST_HEADERS, timeout=25)
        if resp.status_code == 200 and len(resp.text) > 500:
            logger.info("Fetched season page directly: %s (%d bytes)", SEASON_URL, len(resp.text))
            return resp.text
        logger.warning("Direct season page returned status %d", resp.status_code)
    except Exception as exc:
        logger.warning("Direct season page fetch failed: %s", exc)

    # Fallback: WordPress REST API
    logger.info("Trying WP REST API to find season page")
    try:
        api_resp = requests.get(WP_PAGES_API, headers=REQUEST_HEADERS, timeout=20)
        api_resp.raise_for_status()
        pages = api_resp.json()
        season_page = next(
            (p for p in pages if "2026" in p.get("slug", "") or "season" in p.get("slug", "")),
            None,
        )
        if season_page:
            page_url = season_page.get("link") or f"{BASE_URL}/{season_page.get('slug', '')}/"
            resp2 = requests.get(page_url, headers=REQUEST_HEADERS, timeout=20)
            if resp2.status_code == 200:
                logger.info("Fetched season page via WP API: %s", page_url)
                return resp2.text
    except Exception as exc:
        logger.warning("WP API fallback failed: %s", exc)

    return None


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Lionheart Theatre Company 2026 season."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0
    seen_hashes: set[str] = set()

    try:
        venue_id = get_or_create_venue(VENUE_DATA)

        html = fetch_season_html()
        if not html:
            logger.error("Could not fetch Lionheart season page — aborting")
            return 0, 0, 0

        shows = parse_shows_from_html(html)
        logger.info("Parsed %d shows from Lionheart season page", len(shows))

        today = datetime.now().date()

        for show in shows:
            title = show["title"]
            start_date = show["start_date"]
            end_date = show["end_date"]

            if not start_date:
                logger.debug("No date for show: %s", title)
                continue

            # Skip fully past shows
            check_date = end_date or start_date
            try:
                if datetime.strptime(check_date, "%Y-%m-%d").date() < today:
                    continue
            except ValueError:
                pass

            events_found += 1

            content_hash = generate_content_hash(
                title, "Lionheart Theatre Company", start_date
            )
            seen_hashes.add(content_hash)

            series_hint = None
            if end_date and end_date != start_date:
                series_hint = {
                    "series_type": "recurring_show",
                    "series_title": title,
                }
                if show.get("description"):
                    series_hint["description"] = show["description"]
                if show.get("image_url"):
                    series_hint["image_url"] = show["image_url"]

            event_record = {
                "source_id": source_id,
                "venue_id": venue_id,
                "title": title,
                "description": show.get("description") or f"{title} at Lionheart Theatre Company",
                "start_date": start_date,
                "start_time": "19:30",
                "end_date": end_date,
                "end_time": None,
                "is_all_day": False,
                "category": "theater",
                "subcategory": None,
                "tags": sorted(
                    {"lionheart-theatre", "theater", "community-theater", "norcross", "gwinnett"}
                ),
                "price_min": None,
                "price_max": None,
                "price_note": None,
                "is_free": False,
                "source_url": SEASON_URL,
                "ticket_url": show.get("ticket_url") or SEASON_URL,
                "image_url": show.get("image_url"),
                "raw_text": None,
                "extraction_confidence": 0.87,
                "is_recurring": True if end_date and end_date != start_date else False,
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
            except Exception as exc:
                logger.error("Failed to insert %s: %s", title, exc)

        if seen_hashes:
            stale = remove_stale_source_events(source_id, seen_hashes)
            if stale:
                logger.info("Removed %d stale Lionheart events", stale)

        logger.info(
            "Lionheart Theatre crawl complete: %d found, %d new, %d updated",
            events_found,
            events_new,
            events_updated,
        )

    except Exception as exc:
        logger.error("Failed to crawl Lionheart Theatre Company: %s", exc)
        raise

    return events_found, events_new, events_updated
