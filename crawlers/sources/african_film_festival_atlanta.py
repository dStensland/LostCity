"""
Crawler for African Film Festival Atlanta (AFFATL).

Uses the festival's official press pages for the annual tentpole metadata and
the organizer-controlled Eventbrite collection for the live screening schedule.
"""

from __future__ import annotations

import json
import logging
import re
from datetime import datetime
from typing import Optional

import requests
from bs4 import BeautifulSoup

from db import (
    get_or_create_place,
    persist_screening_bundle,
    sync_run_events_from_screenings,
    remove_stale_showtime_events,
    build_screening_bundle_from_event_rows,
    entries_to_event_like_rows,
)
from utils import slugify

logger = logging.getLogger(__name__)

BASE_URL = "https://africanfilmfestatl.com"
PRESS_URL = f"{BASE_URL}/press/"
SUBMISSIONS_URL = (
    f"{PRESS_URL}african-film-festival-atlanta-opens-call-for-submissions-for-2026-edition/"
)
ANNOUNCEMENT_URL = (
    f"{PRESS_URL}2026-african-film-festival-atlanta-announces-its-official-film-selections-and-ticket-sales/"
)
EVENTBRITE_COLLECTION_URL = (
    "https://www.eventbrite.com/cc/african-film-festival-atlanta-2026-4819851"
)
USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36"
)
REQUEST_HEADERS = {
    "User-Agent": USER_AGENT,
    "Accept": (
        "text/html,application/xhtml+xml,application/xml;q=0.9,"
        "image/avif,image/webp,*/*;q=0.8"
    ),
    "Accept-Language": "en-US,en;q=0.9",
    "Upgrade-Insecure-Requests": "1",
}

DATE_RANGE_RE = re.compile(
    r"(March)\s+(\d{1,2})\s+to\s+(March)\s+(\d{1,2}),\s*(\d{4})",
    re.IGNORECASE,
)
ANNOUNCEMENT_FACTS_RE = re.compile(
    r"(\d+\s+curated\s+films\s+from\s+\d+\s+countries,\s+selected\s+from\s+more\s+than\s+\d+\s+submissions.*?)\.",
    re.IGNORECASE,
)
YEAR_RE = re.compile(r"\b(20\d{2})\b")

FESTIVAL_VENUE = {
    "name": "African Film Festival Atlanta",
    "slug": "african-film-festival-atlanta",
    "address": "Atlanta, GA",
    "neighborhood": "Atlanta",
    "city": "Atlanta",
    "state": "GA",
    "zip": "",
    "place_type": "festival",
    "spot_type": "festival",
    "website": BASE_URL,
}

KNOWN_VENUES = {
    "cinefest film theatre": {
        "name": "Cinefest Film Theatre",
        "slug": "cinefest-film-theatre",
        "address": "66 Courtland Street Southeast #262",
        "neighborhood": "Downtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30303",
        "place_type": "movie_theater",
        "spot_type": "movie_theater",
        "website": "https://calendar.gsu.edu/rialto",
    },
    "auburn avenue research library": {
        "name": "Auburn Avenue Research Library",
        "slug": "auburn-avenue-research-library",
        "address": "101 Auburn Avenue Northeast",
        "neighborhood": "Sweet Auburn",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30303",
        "place_type": "library",
        "spot_type": "library",
        "website": "https://www.fulcolibrary.org/central-library/auburn-avenue-research-library/",
    },
}


def _fetch_html(url: str) -> str:
    response = requests.get(url, headers=REQUEST_HEADERS, timeout=30)
    response.raise_for_status()
    return response.text


def _page_text(html: str) -> str:
    return " ".join(BeautifulSoup(html, "html.parser").get_text(" ", strip=True).split())


def _extract_meta_content(html: str, *selectors: str) -> Optional[str]:
    soup = BeautifulSoup(html, "html.parser")
    for selector in selectors:
        node = soup.select_one(selector)
        if not node:
            continue
        content = (node.get("content") or "").strip()
        if content:
            return content
    return None


def parse_official_date_range(text: str) -> tuple[Optional[str], Optional[str]]:
    match = DATE_RANGE_RE.search(text)
    if not match:
        return None, None

    start_month, start_day, end_month, end_day, year = match.groups()
    start_date = datetime.strptime(
        f"{start_month} {start_day} {year}",
        "%B %d %Y",
    ).strftime("%Y-%m-%d")
    end_date = datetime.strptime(
        f"{end_month} {end_day} {year}",
        "%B %d %Y",
    ).strftime("%Y-%m-%d")
    return start_date, end_date


def _extract_theme(text: str) -> Optional[str]:
    match = re.search(
        r"CTRL\s*\+\s*CULTURE\s*=\s*AFRICA'?S\s+NEXT\s+CINEMA\s+CODE",
        text,
        re.IGNORECASE,
    )
    if not match:
        return None
    return "CTRL + CULTURE = AFRICA'S NEXT CINEMA CODE"


def _extract_announcement_facts(text: str) -> Optional[str]:
    match = ANNOUNCEMENT_FACTS_RE.search(text)
    if not match:
        return None
    return match.group(1).strip()


def _extract_eventbrite_link(html: str) -> Optional[str]:
    soup = BeautifulSoup(html, "html.parser")
    for link in soup.select('a[href*="eventbrite.com/cc/"]'):
        href = (link.get("href") or "").strip()
        if href:
            return href.split("?", 1)[0]
    return None


def _extract_eventbrite_server_data(html: str) -> Optional[dict]:
    needle = "window.__SERVER_DATA__ = "
    start = html.find(needle)
    if start == -1:
        return None

    index = start + len(needle)
    brace_depth = 0
    in_string = False
    escape = False
    end_index: Optional[int] = None

    for offset, char in enumerate(html[index:], index):
        if in_string:
            if escape:
                escape = False
            elif char == "\\":
                escape = True
            elif char == '"':
                in_string = False
            continue

        if char == '"':
            in_string = True
        elif char == "{":
            brace_depth += 1
        elif char == "}":
            brace_depth -= 1
            if brace_depth == 0:
                end_index = offset + 1
                break

    if end_index is None:
        return None

    try:
        return json.loads(html[index:end_index])
    except json.JSONDecodeError:
        return None


def parse_eventbrite_collection(html: str) -> list[dict]:
    data = _extract_eventbrite_server_data(html) or {}
    return (
        data.get("events_in_collection", {})
        .get("upcoming", {})
        .get("events", [])
    ) or []


def _parse_eventbrite_datetime(payload: Optional[dict]) -> tuple[Optional[str], Optional[str]]:
    if not payload:
        return None, None

    local_value = str(payload.get("local") or "").strip()
    if not local_value:
        return None, None

    try:
        parsed = datetime.fromisoformat(local_value)
    except ValueError:
        return None, None
    return parsed.strftime("%Y-%m-%d"), parsed.strftime("%H:%M")


def _normalize_title(title: str) -> str:
    cleaned = " ".join(str(title or "").split())
    cleaned = re.sub(r"([A-Za-z])-(Opening Night|Centerpiece|Closing Night)", r"\1 - \2", cleaned)
    cleaned = re.sub(r"\s+:", ":", cleaned)
    return cleaned.strip()


def _build_venue_data(event: dict) -> dict:
    venue = event.get("venue") or {}
    venue_name = str(venue.get("name") or "").strip() or "African Film Festival Atlanta"
    known = KNOWN_VENUES.get(venue_name.lower())
    if known:
        return known

    address = venue.get("address") or {}
    address_1 = str(address.get("address_1") or "").strip()
    address_2 = str(address.get("address_2") or "").strip()
    street = " ".join(part for part in [address_1, address_2] if part).strip()
    return {
        "name": venue_name,
        "slug": slugify(venue_name) or "affatl-venue",
        "address": street or str(address.get("localized_address_display") or "").strip() or "Atlanta, GA",
        "neighborhood": str(address.get("city") or "").strip() or "Atlanta",
        "city": str(address.get("city") or "").strip() or "Atlanta",
        "state": str(address.get("region") or "").strip() or "GA",
        "zip": str(address.get("postal_code") or "").strip(),
        "place_type": "movie_theater",
        "spot_type": "movie_theater",
        "website": BASE_URL,
    }


def build_tentpole_event_record(
    source_id: int,
    submissions_html: str,
    announcement_html: str,
    collection_events: list[dict],
) -> dict:
    submissions_text = _page_text(submissions_html)
    announcement_text = _page_text(announcement_html)

    start_date, end_date = parse_official_date_range(submissions_text)
    if (not start_date or not end_date) and collection_events:
        start_dates = []
        end_dates = []
        for event in collection_events:
            parsed_start, _ = _parse_eventbrite_datetime(event.get("start"))
            parsed_end, _ = _parse_eventbrite_datetime(event.get("end"))
            if parsed_start:
                start_dates.append(parsed_start)
            if parsed_end:
                end_dates.append(parsed_end)
        if start_dates:
            start_date = min(start_dates)
        if end_dates:
            end_date = max(end_dates)

    if not start_date or not end_date:
        raise ValueError("AFFATL official pages did not expose a usable 2026 festival date range")

    festival_year_match = YEAR_RE.search(start_date)
    festival_year = festival_year_match.group(1) if festival_year_match else "2026"
    title = f"African Film Festival Atlanta {festival_year}"
    ticket_url = _extract_eventbrite_link(announcement_html) or EVENTBRITE_COLLECTION_URL
    theme = _extract_theme(submissions_text) or _extract_theme(announcement_text)
    lineup_facts = _extract_announcement_facts(announcement_text)

    description_parts = [
        "Annual African Film Festival Atlanta showcase featuring screenings, shorts programs, and special presentations across Atlanta venues."
    ]
    if lineup_facts:
        description_parts.append(lineup_facts)
    if theme:
        description_parts.append(f"2026 theme: {theme}.")
    description_parts.append("Screenings take place at venues across Atlanta with tickets and schedule managed through the official AFFATL Eventbrite collection.")

    venue_id = get_or_create_place(FESTIVAL_VENUE)

    return {
        "source_id": source_id,
        "place_id": venue_id,
        "title": title,
        "description": " ".join(description_parts),
        "start_date": start_date,
        "start_time": None,
        "end_date": end_date,
        "end_time": None,
        "is_all_day": True,
        "category": "film",
        "subcategory": "festival",
        "tags": ["film", "festival", "affatl", "african-cinema", "tentpole"],
        "price_min": None,
        "price_max": None,
        "price_note": "Festival passes and screening tickets available through the official AFFATL Eventbrite collection.",
        "is_free": False,
        "is_tentpole": True,
        "source_url": ANNOUNCEMENT_URL,
        "ticket_url": ticket_url,
        "image_url": _extract_meta_content(
            announcement_html,
            'meta[property="og:image"]',
            'meta[name="twitter:image"]',
        ),
        "raw_text": " ".join([submissions_text, announcement_text]),
        "extraction_confidence": 0.95,
        "is_recurring": False,
        "recurrence_rule": None,
    }


def build_screening_event_record(source_id: int, event: dict) -> Optional[dict]:
    title = _normalize_title((event.get("name") or {}).get("text") or "")
    if not title:
        return None

    place_data = _build_venue_data(event)
    venue_id = get_or_create_place(place_data)
    start_date, start_time = _parse_eventbrite_datetime(event.get("start"))
    end_date, end_time = _parse_eventbrite_datetime(event.get("end"))
    if not start_date:
        return None

    summary = str(event.get("summary") or "").strip()
    description_text = BeautifulSoup(
        str((event.get("description") or {}).get("html") or ""),
        "html.parser",
    ).get_text(" ", strip=True)
    description = description_text or summary or f"{title} screening for African Film Festival Atlanta."

    ticket_url = str(event.get("url") or "").strip().split("?", 1)[0] or None
    image = event.get("logo") or {}
    image_url = (
        ((image.get("original") or {}).get("url"))
        or image.get("url")
        or None
    )
    is_free = bool(event.get("is_free"))
    price_note = "Free with RSVP on Eventbrite." if is_free else "Tickets available on Eventbrite."

    return {
        "source_id": source_id,
        "place_id": venue_id,
        "title": title,
        "description": description[:1000],
        "start_date": start_date,
        "start_time": start_time,
        "end_date": end_date,
        "end_time": end_time,
        "is_all_day": False,
        "category": "film",
        "subcategory": "screening",
        "tags": ["film", "affatl", "african-cinema", "festival-screening"],
        "price_min": 0.0 if is_free else None,
        "price_max": 0.0 if is_free else None,
        "price_note": price_note,
        "is_free": is_free,
        "source_url": ticket_url,
        "ticket_url": ticket_url,
        "image_url": image_url,
        "raw_text": " ".join(part for part in [title, summary, description] if part),
        "extraction_confidence": 0.93,
        "is_recurring": False,
        "recurrence_rule": None,
    }


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl official AFFATL pages and organizer-managed Eventbrite schedule."""
    source_id = source["id"]
    all_entries: list[dict] = []

    submissions_html = _fetch_html(SUBMISSIONS_URL)
    announcement_html = _fetch_html(ANNOUNCEMENT_URL)
    collection_html = _fetch_html(EVENTBRITE_COLLECTION_URL)
    collection_events = parse_eventbrite_collection(collection_html)

    tentpole_record = build_tentpole_event_record(
        source_id,
        submissions_html,
        announcement_html,
        collection_events,
    )
    all_entries.append(tentpole_record)

    for event in collection_events:
        event_record = build_screening_event_record(source_id, event)
        if not event_record:
            continue
        all_entries.append(event_record)

    # --- Screening-primary persistence ---
    total_found = len(all_entries)
    source_slug = source.get("slug", "african-film-festival-atlanta")

    event_like_rows = entries_to_event_like_rows(all_entries)
    bundle = build_screening_bundle_from_event_rows(
        source_id=source_id,
        source_slug=source_slug,
        events=event_like_rows,
    )
    screening_summary = persist_screening_bundle(bundle)
    logger.info(
        "AFFATL screening sync: %s titles, %s runs, %s times",
        screening_summary.get("titles", 0),
        screening_summary.get("runs", 0),
        screening_summary.get("times", 0),
    )

    run_summary = sync_run_events_from_screenings(
        source_id=source_id,
        source_slug=source_slug,
    )
    total_new = run_summary.get("events_created", 0)
    total_updated = run_summary.get("events_updated", 0)
    logger.info(
        "AFFATL run events: %s created, %s updated, %s times linked",
        total_new, total_updated, run_summary.get("times_linked", 0),
    )

    run_event_hashes = run_summary.get("run_event_hashes", set())
    if run_event_hashes:
        cleanup = remove_stale_showtime_events(
            source_id=source_id,
            run_event_hashes=run_event_hashes,
        )
        if cleanup.get("deactivated") or cleanup.get("deleted"):
            logger.info("AFFATL stale showtime cleanup: %s", cleanup)

    logger.info(
        "AFFATL crawl complete: %s found, %s new run events, %s updated",
        total_found,
        total_new,
        total_updated,
    )
    return total_found, total_new, total_updated
