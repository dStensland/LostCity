"""
Crawler for Atlanta City Council and Committee Meetings via IQM2 RSS feed.

Source: https://atlantacityga.iqm2.com/Services/RSS.aspx?Feed=Calendar

The IQM2 portal publishes a calendar RSS feed for the City of Atlanta covering:
- Atlanta City Council (full council, bi-monthly)
- Committee on Council
- City Utilities Committee
- Community Development/Human Services Committee
- Finance/Executive Committee
- Public Safety & Legal Administration Committee
- Transportation Committee
- Zoning Committee

The feed URL returns HTML (not RSS XML) with meeting entries as <div> blocks.
Each <h2> title has format: "Committee Name - Document Type - Date Time"

Document types include Agenda, Minutes, and Webcast. We only emit events for
Agenda entries of upcoming meetings to avoid duplicating past-meeting records
with Minutes/Webcast entries that share the same meeting ID.

All meetings are free and open to the public.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime, date
from html import unescape
from typing import Optional

import requests
from bs4 import BeautifulSoup

from db import get_or_create_place, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

FEED_URL = "https://atlantacityga.iqm2.com/Services/RSS.aspx?Feed=Calendar"
BASE_URL = "https://atlantacityga.iqm2.com"

PLACE_DATA = {
    "name": "Atlanta City Hall",
    "slug": "atlanta-city-hall",
    "address": "55 Trinity Avenue SW",
    "neighborhood": "Downtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30303",
    "lat": 33.7490,
    "lng": -84.3903,
    "place_type": "government",
    "spot_type": "government",
    "website": "https://www.atlantaga.gov",
    "vibes": ["civic", "government", "public"],
}

# Committee-specific tags for richer filtering in HelpATL
COMMITTEE_TAGS: dict[str, list[str]] = {
    "atlanta city council": ["city-council", "legislation", "governance"],
    "committee on council": ["city-council", "committee", "governance"],
    "city utilities committee": ["utilities", "infrastructure", "committee"],
    "community development/human services committee": [
        "community-development", "human-services", "committee"
    ],
    "finance/executive committee": ["finance", "budget", "committee"],
    "public safety & legal administration committee": [
        "public-safety", "legal", "committee"
    ],
    "transportation committee": ["transportation", "transit", "committee"],
    "zoning committee": ["zoning", "planning", "land-use", "committee"],
}

BASE_TAGS = ["government", "city-council", "public-meeting", "civic-engagement"]


def _normalize_committee(name: str) -> str:
    """Lowercase + collapse whitespace for committee name lookups."""
    return re.sub(r"\s+", " ", name.strip().lower())


def _committee_tags(committee: str) -> list[str]:
    """Return committee-specific tags merged with base tags."""
    extra = COMMITTEE_TAGS.get(_normalize_committee(committee), [])
    seen: dict[str, None] = {}
    result: list[str] = []
    for tag in BASE_TAGS + extra:
        if tag not in seen:
            seen[tag] = None
            result.append(tag)
    return result


def _series_hint(committee: str) -> dict:
    """Build a recurring_show series hint for a committee."""
    return {
        "series_type": "recurring_show",
        "series_title": f"{committee} Meeting",
        "frequency": "monthly",
    }


def _parse_entry_title(raw_title: str) -> Optional[tuple[str, str, str]]:
    """
    Parse an IQM2 entry title into (committee, doc_type, datetime_str).

    Expected format: "Committee Name - Document Type - Mon DD, YYYY H:MM AM/PM"
    e.g.  "Finance/Executive Committee - Agenda - Mar 25, 2026 1:30 PM"

    Returns None if the title does not match the expected format.
    """
    # Split from the right to handle committee names that contain " - "
    parts = raw_title.rsplit(" - ", 2)
    if len(parts) != 3:
        return None
    committee = parts[0].strip()
    doc_type = parts[1].strip()
    datetime_str = parts[2].strip()
    if not committee or not doc_type or not datetime_str:
        return None
    return committee, doc_type, datetime_str


def _parse_meeting_datetime(datetime_str: str) -> tuple[Optional[str], Optional[str]]:
    """
    Parse "Mar 25, 2026 1:30 PM" into ("2026-03-25", "13:30").

    Returns (start_date, start_time). start_time may be None if not parseable.
    """
    # Full pattern with time
    m = re.match(
        r"(\w{3,9})\s+(\d{1,2}),?\s+(\d{4})\s+(\d{1,2}):(\d{2})\s*(AM|PM)",
        datetime_str,
        re.IGNORECASE,
    )
    if m:
        month_str, day_str, year_str, hour_str, minute_str, period = (
            m.group(1), m.group(2), m.group(3),
            m.group(4), m.group(5), m.group(6).upper(),
        )
        try:
            # Try abbreviated month first, then full
            for fmt in ("%b %d %Y", "%B %d %Y"):
                try:
                    dt = datetime.strptime(f"{month_str} {day_str} {year_str}", fmt)
                    break
                except ValueError:
                    continue
            else:
                return None, None

            hour = int(hour_str)
            minute = int(minute_str)
            if period == "PM" and hour != 12:
                hour += 12
            elif period == "AM" and hour == 12:
                hour = 0
            start_date = dt.strftime("%Y-%m-%d")
            start_time = f"{hour:02d}:{minute:02d}"
            return start_date, start_time
        except (ValueError, UnboundLocalError):
            return None, None

    # Date-only fallback
    m = re.match(r"(\w{3,9})\s+(\d{1,2}),?\s+(\d{4})", datetime_str, re.IGNORECASE)
    if m:
        month_str, day_str, year_str = m.group(1), m.group(2), m.group(3)
        for fmt in ("%b %d %Y", "%B %d %Y"):
            try:
                dt = datetime.strptime(f"{month_str} {day_str} {year_str}", fmt)
                return dt.strftime("%Y-%m-%d"), None
            except ValueError:
                continue

    return None, None


def _parse_meeting_id(link: str) -> Optional[str]:
    """Extract the numeric meeting ID from a Detail_Meeting URL."""
    m = re.search(r"ID=(\d+)", link, re.IGNORECASE)
    return m.group(1) if m else None


def _fetch_feed(session: requests.Session) -> Optional[str]:
    """Fetch the IQM2 feed HTML. Returns raw content or None on failure."""
    try:
        resp = session.get(
            FEED_URL,
            headers={
                "User-Agent": (
                    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/120.0.0.0 Safari/537.36"
                )
            },
            timeout=30,
        )
        resp.raise_for_status()
        return resp.text
    except requests.RequestException as e:
        logger.error(f"Failed to fetch IQM2 feed: {e}")
        return None


def _parse_feed(html: str) -> list[dict]:
    """
    Parse IQM2 feed HTML into a list of raw entry dicts.

    Each dict has: title, doc_type, committee, datetime_str, link, meeting_id
    """
    soup = BeautifulSoup(html, "html.parser")
    entries = []

    for div in soup.find_all("div"):
        h2 = div.find("h2")
        if not h2:
            continue
        raw_title = unescape(h2.get_text(strip=True))

        # Find the detail page link (canonical per meeting)
        detail_link = None
        for a in div.find_all("a", href=True):
            href = a["href"]
            if "Detail_Meeting.aspx" in href:
                detail_link = href
                break

        if not detail_link:
            continue

        parsed = _parse_entry_title(raw_title)
        if not parsed:
            logger.debug(f"Could not parse entry title: {raw_title!r}")
            continue

        committee, doc_type, datetime_str = parsed
        meeting_id = _parse_meeting_id(detail_link)

        # Normalize the detail URL
        if detail_link.startswith("/"):
            detail_link = f"{BASE_URL}{detail_link}"
        # IQM2 uses mixed-case domain in hrefs — normalize to lowercase
        detail_link = re.sub(
            r"https?://AtlantaCityGA\.IQM2\.com",
            BASE_URL,
            detail_link,
            flags=re.IGNORECASE,
        )

        entries.append(
            {
                "title": raw_title,
                "committee": committee,
                "doc_type": doc_type,
                "datetime_str": datetime_str,
                "link": detail_link,
                "meeting_id": meeting_id,
            }
        )

    return entries


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl Atlanta City Council meetings from the IQM2 RSS feed.

    Strategy:
    - Parse the HTML-format feed from the IQM2 calendar endpoint
    - Emit only "Agenda" document type entries (not Minutes or Webcast)
    - Emit only upcoming meetings (start_date >= today)
    - Deduplicate by meeting ID within a single crawl pass
    - Group each committee into a recurring series
    """
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        venue_id = get_or_create_place(PLACE_DATA)

        with requests.Session() as session:
            html = _fetch_feed(session)

        if not html:
            logger.error("Empty response from IQM2 feed — aborting crawl")
            return 0, 0, 0

        raw_entries = _parse_feed(html)
        logger.info(f"IQM2 feed: {len(raw_entries)} raw entries parsed")

        today = date.today()
        seen_meeting_ids: set[str] = set()

        for entry in raw_entries:
            try:
                # Only process Agenda entries — Minutes/Webcast are past-meeting docs
                if entry["doc_type"].lower() != "agenda":
                    logger.debug(
                        f"Skipping {entry['doc_type']} entry: {entry['committee']}"
                    )
                    continue

                start_date, start_time = _parse_meeting_datetime(entry["datetime_str"])
                if not start_date:
                    logger.warning(
                        f"Could not parse date from: {entry['datetime_str']!r} "
                        f"(title: {entry['title']!r})"
                    )
                    continue

                try:
                    event_date = datetime.strptime(start_date, "%Y-%m-%d").date()
                except ValueError:
                    continue

                # Only upcoming meetings belong in the feed
                if event_date < today:
                    logger.debug(
                        f"Skipping past meeting: {entry['committee']} on {start_date}"
                    )
                    continue

                # One event per meeting — deduplicate by meeting ID
                meeting_id = entry["meeting_id"]
                if meeting_id and meeting_id in seen_meeting_ids:
                    logger.debug(
                        f"Duplicate meeting ID {meeting_id} for "
                        f"{entry['committee']} on {start_date} — skipping"
                    )
                    continue
                if meeting_id:
                    seen_meeting_ids.add(meeting_id)

                committee = entry["committee"]
                title = f"{committee} — Regular Meeting"

                # Richer title for special body names
                if "city council" in committee.lower() and "committee" not in committee.lower():
                    title = "Atlanta City Council — Regular Meeting"

                tags = _committee_tags(committee)

                description_parts = [
                    f"{committee} meeting of the City of Atlanta.",
                    "Open to the public. Agenda available at the link above.",
                ]
                description = " ".join(description_parts)

                content_hash = generate_content_hash(
                    title, PLACE_DATA["name"], start_date
                )

                event_record = {
                    "source_id": source_id,
                    "place_id": venue_id,
                    "title": title,
                    "description": description,
                    "start_date": start_date,
                    "start_time": start_time,
                    "end_date": None,
                    "end_time": None,
                    "is_all_day": False,
                    "category": "civic",
                    "tags": tags,
                    "price_min": None,
                    "price_max": None,
                    "price_note": None,
                    "is_free": True,
                    "source_url": entry["link"],
                    "ticket_url": None,
                    "image_url": None,
                    "is_recurring": True,
                    "recurrence_rule": "Monthly",
                    "content_hash": content_hash,
                }

                series_hint = _series_hint(committee)
                events_found += 1

                existing = find_event_by_hash(content_hash)
                if existing:
                    smart_update_existing_event(existing, event_record)
                    events_updated += 1
                    logger.debug(f"Updated: {title} on {start_date}")
                    continue

                insert_event(event_record, series_hint=series_hint)
                events_new += 1
                logger.info(f"Added: {title} on {start_date}")

            except Exception as e:
                logger.warning(f"Error processing entry {entry.get('title', '?')!r}: {e}")
                continue

        logger.info(
            f"Atlanta City Council crawl complete: "
            f"{events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Atlanta City Council: {e}")
        raise

    return events_found, events_new, events_updated
