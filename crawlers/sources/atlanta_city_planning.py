"""
Crawler for Atlanta Department of City Planning events calendar.

Source: https://citydesign.atlantaga.gov/upcoming-events
Platform: Squarespace — list view at ?view=list, requires Playwright for JS rendering.

This calendar is the central hub for all City of Atlanta planning-related public
meetings, including:
- Neighborhood Planning Unit (NPU) monthly meetings (A through Z, ~25/month)
- Board of Zoning Adjustment hearings
- Zoning Review Board hearings
- Atlanta Urban Design Commission hearings
- Tree Conservation Commission hearings
- APAB meetings
- Other city planning public meetings

NPU meetings are the primary mechanism for citizen participation in local
government in Atlanta. Each of the 25 NPUs meets monthly and covers zoning
variances, liquor licenses, land use, and neighborhood concerns.

Venue: Events happen at various locations. NPU meetings are typically at
community centers, churches, or libraries in each neighborhood. Some meetings
are virtual. Zoning/planning meetings are typically at City Hall (55 Trinity Ave SW).
"""

from __future__ import annotations

import logging
import re
from datetime import datetime
from typing import Optional

from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout

from db import (
    find_event_by_hash,
    get_or_create_venue,
    insert_event,
    smart_update_existing_event,
)
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://citydesign.atlantaga.gov"
EVENTS_URL = f"{BASE_URL}/upcoming-events?view=list"

# Default venue for events without a specific location
VENUE_DATA = {
    "name": "Atlanta Department of City Planning",
    "slug": "atlanta-dept-city-planning",
    "address": "55 Trinity Ave SW",
    "neighborhood": "Downtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30303",
    "lat": 33.7490,
    "lng": -84.3919,
    "venue_type": "community_center",
    "spot_type": "community_center",
    "website": "https://citydesign.atlantaga.gov",
}

# Tags applied to all events from this source
BASE_TAGS = ["civic", "government", "public-meeting", "attend"]

# NPU letter → neighborhood mapping for tag enrichment
_NPU_NEIGHBORHOODS: dict[str, str] = {
    "A": "Buckhead",
    "B": "Buckhead",
    "C": "Collier Hills",
    "D": "Home Park",
    "E": "Midtown",
    "F": "Druid Hills",
    "G": "Kirkwood",
    "H": "Poncey-Highland",
    "I": "Ansley Park",
    "J": "Grove Park",
    "K": "Hunter Hills",
    "L": "West End",
    "M": "Inman Park",
    "N": "Virginia-Highland",
    "O": "East Atlanta Village",
    "P": "Grant Park",
    "Q": "Mechanicsville",
    "R": "Peoplestown",
    "S": "Lakewood",
    "T": "Cascade Heights",
    "V": "Southwest Atlanta",
    "W": "Adams Park",
    "X": "Ben Hill",
    "Y": "College Park",
    "Z": "Thomasville Heights",
}

# Series hints for recurring meetings
_SERIES_MAP: dict[str, dict] = {
    "board of zoning": {
        "series_type": "recurring_show",
        "series_title": "Board of Zoning Adjustment Public Hearing",
        "frequency": "monthly",
    },
    "zoning review board": {
        "series_type": "recurring_show",
        "series_title": "Zoning Review Board Public Hearing",
        "frequency": "monthly",
    },
    "urban design commission": {
        "series_type": "recurring_show",
        "series_title": "Atlanta Urban Design Commission Hearing",
        "frequency": "monthly",
    },
    "tree conservation": {
        "series_type": "recurring_show",
        "series_title": "Tree Conservation Commission Hearing",
        "frequency": "monthly",
    },
    "apab": {
        "series_type": "recurring_show",
        "series_title": "APAB Meeting",
        "frequency": "monthly",
    },
}


def _series_hint_for(title: str) -> Optional[dict]:
    """Return series hint for known recurring meeting types."""
    lower = title.lower()
    # NPU meetings
    npu_match = re.match(r"npu-([a-z])", lower)
    if npu_match:
        letter = npu_match.group(1).upper()
        return {
            "series_type": "recurring_show",
            "series_title": f"NPU-{letter} Monthly Meeting",
            "frequency": "monthly",
        }
    for fragment, hint in _SERIES_MAP.items():
        if fragment in lower:
            return hint
    return None


def _enrich_tags(title: str) -> list[str]:
    """Add tags based on event type."""
    lower = title.lower()
    tags: list[str] = []

    npu_match = re.match(r"npu-([a-z])", lower)
    if npu_match:
        tags.extend(["npu", "neighborhood", "public-meeting"])
        return tags

    if "zoning" in lower:
        tags.extend(["zoning", "land-use"])
    if "urban design" in lower:
        tags.extend(["urban-planning", "design-review"])
    if "tree conservation" in lower:
        tags.extend(["environment", "trees"])
    if "apab" in lower:
        tags.append("planning")
    if "public hearing" in lower:
        tags.append("public-comment")

    return tags


def _clean_description(raw_html: str) -> str:
    """Extract clean text from Squarespace description HTML."""
    if not raw_html:
        return ""
    soup = BeautifulSoup(raw_html, "lxml")
    text = soup.get_text(separator=" ", strip=True)
    text = re.sub(r"\s+", " ", text).strip()
    return text[:1000]


def _parse_time_24hr(time_str: str) -> Optional[str]:
    """Parse 24-hour time like '19:00' to 'HH:MM'."""
    if not time_str:
        return None
    m = re.match(r"(\d{1,2}):(\d{2})", time_str.strip())
    if m:
        return f"{int(m.group(1)):02d}:{m.group(2)}"
    return None


def _fetch_events_page() -> Optional[str]:
    """Fetch the Squarespace events list view with Playwright."""
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            user_agent=(
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/122.0.0.0 Safari/537.36"
            ),
            viewport={"width": 1440, "height": 900},
        )
        page = context.new_page()

        try:
            logger.info("City Planning: loading events page: %s", EVENTS_URL)
            page.goto(EVENTS_URL, wait_until="domcontentloaded", timeout=45000)
            page.wait_for_selector(".eventlist-event", timeout=15000)
            page.wait_for_timeout(2000)
            return page.content()
        except PlaywrightTimeout:
            logger.error("City Planning: timeout loading events page")
            return None
        except Exception as exc:
            logger.error("City Planning: error loading events page: %s", exc)
            return None
        finally:
            browser.close()


def _parse_events(html: str) -> list[dict]:
    """Parse Squarespace eventlist-event items from the list view HTML."""
    soup = BeautifulSoup(html, "lxml")
    events: list[dict] = []

    items = soup.find_all(class_="eventlist-event")
    if not items:
        logger.warning("City Planning: no eventlist-event items found")
        return []

    for item in items:
        # Title
        title_el = item.find(class_="eventlist-title-link")
        if not title_el:
            continue
        title = title_el.get_text(strip=True)
        if not title:
            continue

        # Detail URL
        href = title_el.get("href", "")
        detail_url = f"{BASE_URL}{href}" if href.startswith("/") else href

        # Date from <time class="event-date" datetime="YYYY-MM-DD">
        date_el = item.find("time", class_="event-date")
        if not date_el:
            continue
        date_str = date_el.get("datetime")
        if not date_str:
            continue

        # Start time from 24hr element
        start_time = None
        time_start_el = item.find("time", class_="event-time-24hr-start")
        if time_start_el:
            start_time = _parse_time_24hr(time_start_el.get_text(strip=True))

        # End time
        end_time = None
        time_end_el = item.find("time", class_="event-time-12hr-end")
        # The 24hr end is inside event-time-24hr span
        time_24hr_span = item.find("span", class_="event-time-24hr")
        if time_24hr_span:
            end_els = time_24hr_span.find_all("time")
            if len(end_els) >= 2:
                end_time = _parse_time_24hr(end_els[-1].get_text(strip=True))

        # Description
        desc_el = item.find(class_="eventlist-description")
        description = ""
        if desc_el:
            description = _clean_description(str(desc_el))

        events.append({
            "title": title,
            "date_str": date_str,
            "start_time": start_time,
            "end_time": end_time,
            "description": description,
            "detail_url": detail_url,
        })

    logger.info("City Planning: parsed %d events from list view", len(events))
    return events


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Atlanta Department of City Planning events calendar."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    venue_id = get_or_create_venue(VENUE_DATA)

    html = _fetch_events_page()
    if not html:
        logger.error("City Planning: could not fetch events page — aborting")
        return 0, 0, 0

    raw_events = _parse_events(html)
    if not raw_events:
        logger.warning("City Planning: no events parsed")
        return 0, 0, 0

    today = datetime.now().date()
    seen: set[str] = set()

    for entry in raw_events:
        try:
            title = entry["title"]
            date_str = entry["date_str"]
            start_time = entry.get("start_time")
            end_time = entry.get("end_time")
            description = entry.get("description", "")
            detail_url = entry.get("detail_url") or EVENTS_URL

            # Validate date
            try:
                event_date = datetime.strptime(date_str, "%Y-%m-%d").date()
            except ValueError:
                continue

            if event_date < today:
                continue

            # Dedupe within run
            dedup_key = f"{title.lower().strip()}|{date_str}"
            if dedup_key in seen:
                continue
            seen.add(dedup_key)

            events_found += 1

            # Build description if empty
            if not description or len(description) < 20:
                description = (
                    f"{title} — Atlanta Department of City Planning public meeting. "
                    "Open to the public."
                )

            # Tags
            extra_tags = _enrich_tags(title)
            tags = list(BASE_TAGS) + extra_tags

            # Series hint
            series_hint = _series_hint_for(title)

            content_hash = generate_content_hash(
                title, "Atlanta Department of City Planning", date_str
            )

            event_record = {
                "source_id": source_id,
                "venue_id": venue_id,
                "title": title,
                "description": description,
                "start_date": date_str,
                "start_time": start_time,
                "end_date": None,
                "end_time": end_time,
                "is_all_day": False,
                "category": "civic",
                "subcategory": None,
                "tags": tags,
                "price_min": None,
                "price_max": None,
                "price_note": None,
                "is_free": True,
                "source_url": detail_url,
                "ticket_url": None,
                "image_url": None,
                "raw_text": f"{title} — {description[:200]}",
                "extraction_confidence": 0.92,
                "is_recurring": bool(series_hint),
                "recurrence_rule": "FREQ=MONTHLY" if series_hint else None,
                "content_hash": content_hash,
            }

            existing = find_event_by_hash(content_hash)
            if existing:
                smart_update_existing_event(existing, event_record)
                events_updated += 1
                logger.debug("City Planning: updated: %s on %s", title, date_str)
                continue

            insert_event(event_record, series_hint=series_hint)
            events_new += 1
            logger.info("City Planning: added: %s on %s", title, date_str)

        except Exception as exc:
            logger.warning("City Planning: error processing event %r: %s", entry.get("title"), exc)
            continue

    logger.info(
        "City Planning: crawl complete: %d found, %d new, %d updated",
        events_found,
        events_new,
        events_updated,
    )
    return events_found, events_new, events_updated
