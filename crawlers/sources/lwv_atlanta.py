"""
Crawler for League of Women Voters of Atlanta-Fulton County calendar.

Source: https://www.lwvaf.org/calendar
Platform: Squarespace — stacked list view, requires Playwright for JS rendering.

LWVAF organizes voter education, election information, and civic participation events:
- Voter registration drives
- Candidate forums and debates
- "Good Trouble Tuesday" monthly civic engagement events
- General meetings and board meetings
- Election watch parties
- Educational workshops on democracy and voting rights

Events are low volume (~35/year) but high civic value.
"""

from __future__ import annotations

import logging
import re
from datetime import datetime
from typing import Optional
from urllib.parse import urlparse

from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout

from db import (
    find_event_by_hash,
    get_or_create_venue,
    get_client,
    insert_event,
    smart_update_existing_event,
    update_event,
)
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://www.lwvaf.org"
EVENTS_URL = f"{BASE_URL}/calendar"

VENUE_DATA = {
    "name": "League of Women Voters Atlanta-Fulton",
    "slug": "lwv-atlanta-fulton",
    "address": "Atlanta, GA",
    "neighborhood": "Citywide",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30303",
    "lat": 33.7490,
    "lng": -84.3888,
    "venue_type": "organization",
    "spot_type": "organization",
    "website": "https://www.lwvaf.org",
}

BASE_TAGS = ["civic", "civic-engagement", "government", "attend"]

# Tag enrichment based on title keywords
_TAG_RULES: list[tuple[str, list[str]]] = [
    (r"voter\s+registration|register\s+to\s+vote", ["voter-registration"]),
    (r"candidate\s+forum|debate", ["election", "public-comment"]),
    (r"election|ballot|vote|voting", ["election"]),
    (r"good\s+trouble", ["community", "advocacy"]),
    (r"board\s+meeting|general\s+meeting", ["public-meeting"]),
    (r"workshop|training|education", ["education"]),
    (r"watch\s+party", ["community"]),
]


def _enrich_tags(title: str) -> list[str]:
    """Add tags based on event title."""
    lower = title.lower()
    extra: list[str] = []
    for pattern, tags in _TAG_RULES:
        if re.search(pattern, lower):
            extra.extend(tags)
    return list(dict.fromkeys(extra))


def _series_hint_for(title: str) -> Optional[dict]:
    """Return series hint for known recurring events."""
    lower = title.lower()
    if "good trouble" in lower:
        return {
            "series_type": "recurring_show",
            "series_title": "Good Trouble Tuesday",
            "frequency": "monthly",
        }
    return None


def _normalize_title(raw_title: str) -> str:
    """Normalize recurring LWV title glitches without changing event meaning."""
    title = re.sub(r"\bEunoff\b", "Runoff", raw_title or "", flags=re.I)
    title = re.sub(r"\s+", " ", title).strip()
    return title


def _normalize_detail_url(url: str) -> str:
    raw = (url or "").strip()
    if not raw:
        return ""
    parsed = urlparse(raw)
    host = parsed.netloc.lower().lstrip("www.")
    path = re.sub(r"/+$", "", parsed.path or "") or "/"
    return f"{host}{path}"


def _find_existing_by_date_and_url(
    source_id: int,
    venue_id: int,
    date_str: str,
    detail_url: str,
) -> Optional[dict]:
    normalized_detail = _normalize_detail_url(detail_url)
    if not normalized_detail:
        return None

    client = get_client()
    result = (
        client.table("events")
        .select("*")
        .eq("source_id", source_id)
        .eq("venue_id", venue_id)
        .eq("start_date", date_str)
        .execute()
    )
    for row in result.data or []:
        if _normalize_detail_url(row.get("source_url") or "") == normalized_detail:
            return row
    return None


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


def _parse_time_12hr(time_str: str) -> Optional[str]:
    """Parse 12-hour time like '7:00 PM' to 'HH:MM'."""
    if not time_str:
        return None
    m = re.match(r"(\d{1,2}):(\d{2})\s*(am|pm)", time_str.strip().lower())
    if m:
        hour = int(m.group(1))
        minute = m.group(2)
        ampm = m.group(3)
        if ampm == "pm" and hour != 12:
            hour += 12
        elif ampm == "am" and hour == 12:
            hour = 0
        return f"{hour:02d}:{minute}"
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
            logger.info("LWV Atlanta: loading events page: %s", EVENTS_URL)
            page.goto(EVENTS_URL, wait_until="domcontentloaded", timeout=45000)
            page.wait_for_selector(".eventlist-event", timeout=15000)
            page.wait_for_timeout(2000)
            return page.content()
        except PlaywrightTimeout:
            logger.error("LWV Atlanta: timeout loading events page")
            return None
        except Exception as exc:
            logger.error("LWV Atlanta: error loading events page: %s", exc)
            return None
        finally:
            browser.close()


def _parse_events(html: str) -> list[dict]:
    """Parse Squarespace eventlist-event items from the list view HTML."""
    soup = BeautifulSoup(html, "lxml")
    events: list[dict] = []

    items = soup.find_all(class_="eventlist-event")
    if not items:
        logger.warning("LWV Atlanta: no eventlist-event items found")
        return []

    for item in items:
        # Title
        title_el = item.find(class_="eventlist-title")
        if not title_el:
            continue
        link_el = title_el.find("a")
        if not link_el:
            continue
        raw_title = link_el.get_text(strip=True)
        if not raw_title:
            continue
        title = _normalize_title(raw_title)

        # Detail URL
        href = link_el.get("href", "")
        detail_url = f"{BASE_URL}{href}" if href.startswith("/") else href

        # Date from <time class="event-date" datetime="YYYY-MM-DD">
        date_el = item.find("time", class_="event-date")
        if not date_el:
            continue
        date_str = date_el.get("datetime")
        if not date_str:
            continue

        # Start time — try 24hr first, then 12hr
        start_time = None
        time_start_el = item.find("time", class_="event-time-24hr-start")
        if time_start_el:
            start_time = _parse_time_24hr(time_start_el.get_text(strip=True))
        if not start_time:
            time_12hr_el = item.find("time", class_="event-time-12hr-start")
            if time_12hr_el:
                start_time = _parse_time_12hr(time_12hr_el.get_text(strip=True))

        # End time
        end_time = None
        time_24hr_span = item.find("span", class_="event-time-24hr")
        if time_24hr_span:
            end_els = time_24hr_span.find_all("time")
            if len(end_els) >= 2:
                end_time = _parse_time_24hr(end_els[-1].get_text(strip=True))
        if not end_time:
            time_12hr_end = item.find("time", class_="event-time-12hr-end")
            if time_12hr_end:
                end_time = _parse_time_12hr(time_12hr_end.get_text(strip=True))

        # Description
        desc_el = item.find(class_="eventlist-description")
        description = ""
        if desc_el:
            description = _clean_description(str(desc_el))

        events.append({
            "raw_title": raw_title,
            "title": title,
            "date_str": date_str,
            "start_time": start_time,
            "end_time": end_time,
            "description": description,
            "detail_url": detail_url,
        })

    logger.info("LWV Atlanta: parsed %d events from list view", len(events))
    return events


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl League of Women Voters Atlanta-Fulton County calendar."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    venue_id = get_or_create_venue(VENUE_DATA)

    html = _fetch_events_page()
    if not html:
        logger.error("LWV Atlanta: could not fetch events page — aborting")
        return 0, 0, 0

    raw_events = _parse_events(html)
    if not raw_events:
        logger.warning("LWV Atlanta: no events parsed")
        return 0, 0, 0

    today = datetime.now().date()
    seen: set[str] = set()

    for entry in raw_events:
        try:
            title = entry["title"]
            raw_title = entry.get("raw_title") or title
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
                    f"{title} — League of Women Voters Atlanta-Fulton County event. "
                    "Open to the public."
                )

            # Tags
            extra_tags = _enrich_tags(title)
            tags = list(BASE_TAGS) + extra_tags

            # Series hint
            series_hint = _series_hint_for(title)

            content_hash = generate_content_hash(
                title, "League of Women Voters Atlanta-Fulton", date_str
            )
            legacy_content_hash = generate_content_hash(
                raw_title, "League of Women Voters Atlanta-Fulton", date_str
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
                "category": "community",
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
                "extraction_confidence": 0.90,
                "is_recurring": bool(series_hint),
                "recurrence_rule": None,
                "content_hash": content_hash,
            }

            existing = find_event_by_hash(content_hash)
            if not existing and legacy_content_hash != content_hash:
                existing = find_event_by_hash(legacy_content_hash)
            if not existing:
                existing = _find_existing_by_date_and_url(
                    source_id, venue_id, date_str, detail_url
                )
            if existing:
                if existing.get("content_hash") != content_hash:
                    update_event(existing["id"], {"content_hash": content_hash})
                    existing["content_hash"] = content_hash
                smart_update_existing_event(existing, event_record)
                events_updated += 1
                logger.debug("LWV Atlanta: updated: %s on %s", title, date_str)
                continue

            insert_event(event_record, series_hint=series_hint)
            events_new += 1
            logger.info("LWV Atlanta: added: %s on %s", title, date_str)

        except Exception as exc:
            logger.warning("LWV Atlanta: error processing event %r: %s", entry.get("title"), exc)
            continue

    logger.info(
        "LWV Atlanta: crawl complete: %d found, %d new, %d updated",
        events_found,
        events_new,
        events_updated,
    )
    return events_found, events_new, events_updated
