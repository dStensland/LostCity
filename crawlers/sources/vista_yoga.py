"""
Crawler for Vista Yoga wellness workshops and events.

The public "Upcoming Workshops & Events" page renders a Mindbody schedule table
client-side, so we use Playwright to read the hydrated DOM and then expand the
visible schedule rows into individual local sessions.
"""

from __future__ import annotations

import logging
import re
from datetime import date, datetime, timedelta
from typing import Optional

from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright

from db import (
    find_existing_event_for_insert,
    get_or_create_place,
    insert_event,
    remove_stale_source_events,
    smart_update_existing_event,
    update_event,
)
from db.programs import insert_program
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://vistayoga.com"
EVENTS_URL = f"{BASE_URL}/workshops-and-events/upcoming/"
HORIZON_DAYS = 180

DAY_INDEX = {
    "Mon": 0,
    "Tue": 1,
    "Wed": 2,
    "Thu": 3,
    "Fri": 4,
    "Sat": 5,
    "Sun": 6,
}

PLACE_DATA = {
    "name": "Vista Yoga",
    "slug": "vista-yoga",
    "address": "2836 Lavista Rd",
    "neighborhood": "North Druid Hills",
    "city": "Decatur",
    "state": "GA",
    "zip": "30033",
    "lat": 33.8161,
    "lng": -84.2845,
    "place_type": "studio",
    "spot_type": "studio",
    "website": BASE_URL,
    "description": "Vista Yoga studio hosting public workshops, camps, and wellness events.",
}


def _clean_text(value: str) -> str:
    return " ".join((value or "").replace("\xa0", " ").split())


def _parse_date(value: str) -> date:
    return datetime.strptime(value, "%b %d %Y").date()


def _parse_time(value: str) -> str:
    return datetime.strptime(value.strip(), "%I:%M %p").strftime("%H:%M")


def _parse_time_range(value: str) -> tuple[str, Optional[str]]:
    parts = [_clean_text(part) for part in value.split("-") if _clean_text(part)]
    if not parts:
        raise ValueError("Missing time range")
    start_time = _parse_time(parts[0])
    end_time = _parse_time(parts[1]) if len(parts) > 1 else None
    return start_time, end_time


def _parse_days(value: str) -> list[int]:
    weekdays: list[int] = []
    for token in [part.strip() for part in value.split(",")]:
        weekday = DAY_INDEX.get(token)
        if weekday is not None and weekday not in weekdays:
            weekdays.append(weekday)
    return weekdays


def _normalize_title(value: str) -> str:
    cleaned = _clean_text(value)
    if not cleaned:
        return cleaned

    normalized_parts = []
    changed = False
    for part in re.split(r"(\s+)", cleaned):
        letters = [char for char in part if char.isalpha()]
        if letters and all(char.isupper() for char in letters):
            normalized_parts.append(part.title())
            changed = True
        else:
            normalized_parts.append(part)

    if not changed:
        return cleaned

    normalized = "".join(normalized_parts)
    normalized = re.sub(r"\b(And|Of|The|A|An|As|To|In|At)\b", lambda match: match.group(1).lower(), normalized)
    return normalized


def _extract_data_url(cell) -> Optional[str]:
    if not cell:
        return None

    link = cell.select_one("a[data-url]")
    if link and link.get("data-url"):
        return link["data-url"].strip()

    href_link = cell.select_one('a[href]:not([href=""])')
    if href_link and href_link.get("href"):
        return href_link["href"].strip()

    return None


def _iter_recurring_dates(
    start_date: date,
    end_date: date,
    weekdays: list[int],
    horizon_end: date,
) -> list[date]:
    dates: list[date] = []
    current = start_date
    while current <= end_date and current <= horizon_end:
        if current.weekday() in weekdays:
            dates.append(current)
        current += timedelta(days=1)
    return dates


def _build_description(title: str, instructor: Optional[str], is_series: bool) -> str:
    descriptor = "series" if is_series else "event"
    if instructor:
        return f"{title} at Vista Yoga with {instructor}. Public wellness {descriptor} at the Decatur studio."
    return f"{title} at Vista Yoga. Public wellness {descriptor} at the Decatur studio."


def _build_tags(title: str) -> tuple[str, list[str]]:
    title_lower = title.lower()
    tags = ["vista-yoga", "wellness", "fitness", "decatur", "studio-event"]
    subcategory = "wellness_workshop"

    if "yoga" in title_lower or "nidra" in title_lower or "mantra" in title_lower:
        tags.extend(["yoga", "workshop"])
        subcategory = "yoga_workshop"
    else:
        tags.append("workshop")

    if "feldenkrais" in title_lower:
        tags.extend(["feldenkrais", "mobility"])
        subcategory = "mobility_class"
    if "kid" in title_lower or "camp" in title_lower:
        tags.extend(["kids", "family-friendly"])
    if "sound" in title_lower or "mantra" in title_lower:
        tags.append("meditation")

    return subcategory, list(dict.fromkeys(tags))


def _build_program_record(
    title: str,
    occurrences: list[dict],
    *,
    source_id: int,
    venue_id: int,
) -> dict:
    first = occurrences[0]
    start_dates = sorted(occurrence["start_date"] for occurrence in occurrences)
    schedule_days = sorted(
        {
            datetime.strptime(occurrence["start_date"], "%Y-%m-%d").isoweekday()
            for occurrence in occurrences
        }
    )

    return {
        "source_id": source_id,
        "place_id": venue_id,
        "name": title,
        "description": first["description"],
        "program_type": "class",
        "provider_name": PLACE_DATA["name"],
        "season": "year_round",
        "session_start": start_dates[0],
        "session_end": start_dates[-1],
        "schedule_days": schedule_days,
        "schedule_start_time": first["start_time"],
        "schedule_end_time": first["end_time"],
        "cost_amount": None,
        "cost_period": None,
        "cost_notes": None,
        "registration_status": "open",
        "registration_url": first["ticket_url"],
        "tags": first["tags"],
        "status": "active",
        "metadata": {
            "occurrence_count": len(occurrences),
            "instructor": first.get("instructor"),
        },
        "_venue_name": PLACE_DATA["name"],
    }


def parse_upcoming_html(
    html: str,
    page_url: str,
    *,
    today: Optional[date] = None,
    horizon_days: int = HORIZON_DAYS,
) -> list[dict]:
    soup = BeautifulSoup(html, "html.parser")
    rows = soup.select("table tbody tr")

    if today is None:
        today = datetime.now().date()
    horizon_end = today + timedelta(days=horizon_days)

    summary_urls: dict[str, str] = {}
    summary_source_urls: dict[str, str] = {}
    events: list[dict] = []

    for row in rows:
        classes = row.get("class", [])
        title_cell = row.select_one("td.mbo_class")
        title = _normalize_title(title_cell.get_text(" ", strip=True)) if title_cell else ""
        if not title:
            continue

        title_key = title.casefold()
        if "livestream" in title_key:
            continue

        button_url = _extract_data_url(row.select_one("td.healcode-button-field"))
        source_url = _extract_data_url(title_cell) or page_url

        if "healcode-summary-course" in classes:
            if button_url:
                summary_urls[title_key] = button_url
            if source_url:
                summary_source_urls[title_key] = source_url
            continue

        date_text = _clean_text(
            row.select_one("td.healcode-date-field").get_text(" ", strip=True)
            if row.select_one("td.healcode-date-field")
            else ""
        )
        time_text = _clean_text(
            row.select_one("td.healcode-time-field").get_text(" ", strip=True)
            if row.select_one("td.healcode-time-field")
            else ""
        )
        days_text = _clean_text(
            row.select_one("td.healcode-days-field").get_text(" ", strip=True)
            if row.select_one("td.healcode-days-field")
            else ""
        )
        instructor = _clean_text(
            row.select_one("td.trainer").get_text(" ", strip=True)
            if row.select_one("td.trainer")
            else ""
        )

        if not date_text or not time_text:
            continue

        start_time, end_time = _parse_time_range(time_text)
        ticket_url = button_url or summary_urls.get(title_key) or source_url
        source_url = source_url or summary_source_urls.get(title_key) or page_url

        occurrence_dates: list[date]
        is_series = " - " in date_text and bool(days_text)
        if is_series:
            start_raw, end_raw = [_clean_text(part) for part in date_text.split("-", 1)]
            start_date = _parse_date(start_raw)
            end_date = _parse_date(end_raw)
            weekdays = _parse_days(days_text)
            if not weekdays:
                weekdays = [start_date.weekday()]
            occurrence_dates = _iter_recurring_dates(
                max(start_date, today),
                end_date,
                weekdays,
                horizon_end,
            )
        else:
            single_date = _parse_date(date_text)
            occurrence_dates = [single_date] if today <= single_date <= horizon_end else []

        if not occurrence_dates:
            continue

        subcategory, tags = _build_tags(title)
        description = _build_description(title, instructor or None, is_series)
        raw_text = " | ".join(filter(None, [date_text, time_text, days_text, instructor]))

        for occurrence_date in occurrence_dates:
            events.append(
                {
                    "title": title,
                    "description": description,
                    "start_date": occurrence_date.strftime("%Y-%m-%d"),
                    "start_time": start_time,
                    "end_time": end_time,
                    "source_url": source_url,
                    "ticket_url": ticket_url,
                    "raw_text": raw_text,
                    "instructor": instructor or None,
                    "subcategory": subcategory,
                    "tags": tags,
                }
            )

    return events


def crawl(source: dict) -> tuple[int, int, int]:
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0
    current_hashes: set[str] = set()

    venue_id = get_or_create_place(PLACE_DATA)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
            viewport={"width": 1600, "height": 1200},
        )
        page = context.new_page()

        logger.info(f"Fetching Vista Yoga upcoming schedule: {EVENTS_URL}")
        page.goto(EVENTS_URL, wait_until="networkidle", timeout=60000)
        parsed_events = parse_upcoming_html(page.content(), page.url)

        browser.close()

    events_by_title: dict[str, list[dict]] = {}
    for parsed in parsed_events:
        events_by_title.setdefault(parsed["title"], []).append(parsed)

    for title, occurrences in events_by_title.items():
        insert_program(
            _build_program_record(
                title,
                occurrences,
                source_id=source_id,
                venue_id=venue_id,
            )
        )

    for parsed in parsed_events:
        events_found += 1

        content_hash = generate_content_hash(
            parsed["title"],
            PLACE_DATA["name"],
            parsed["start_date"],
        )
        current_hashes.add(content_hash)

        event_record = {
            "source_id": source_id,
            "place_id": venue_id,
            "title": parsed["title"],
            "description": parsed["description"],
            "start_date": parsed["start_date"],
            "start_time": parsed["start_time"],
            "end_date": None,
            "end_time": parsed["end_time"],
            "is_all_day": False,
            "category": "fitness",
            "subcategory": parsed["subcategory"],
            "tags": parsed["tags"],
            "price_min": None,
            "price_max": None,
            "price_note": None,
            "is_free": False,
            "source_url": parsed["source_url"],
            "ticket_url": parsed["ticket_url"],
            "image_url": None,
            "raw_text": parsed["raw_text"],
            "extraction_confidence": 0.95,
            "is_recurring": False,
            "recurrence_rule": None,
            "content_hash": content_hash,
            "is_class": True,
            "class_category": "fitness",
        }

        existing = find_existing_event_for_insert(event_record)
        if existing:
            smart_update_existing_event(existing, event_record)
            if existing.get("title") != event_record["title"]:
                update_event(existing["id"], {"title": event_record["title"]})
            events_updated += 1
            continue

        series_hint = {
            "series_type": "class_series",
            "series_title": parsed["title"],
            "description": parsed["description"],
        }

        try:
            insert_event(event_record, series_hint=series_hint)
            events_new += 1
            logger.info(
                f"Added Vista Yoga event: {parsed['title']} on {parsed['start_date']}"
            )
        except Exception as exc:
            logger.error(
                f"Failed to insert Vista Yoga event {parsed['title']} on {parsed['start_date']}: {exc}"
            )

    stale_removed = remove_stale_source_events(source_id, current_hashes)
    if stale_removed:
        logger.info(f"Removed {stale_removed} stale Vista Yoga events")

    logger.info(
        f"Vista Yoga crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
    )
    return events_found, events_new, events_updated
