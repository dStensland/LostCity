"""
Crawler for Big Peach Running Co. social group runs.

The official group-runs page publishes a weekly recurring schedule. We only
seed the Atlanta-portal relevant locations rather than the full metro network.
"""

from __future__ import annotations

import logging
import re
from datetime import datetime, timedelta

import requests
from bs4 import BeautifulSoup

from db import (
    find_existing_event_for_insert,
    get_or_create_place,
    insert_event,
    remove_stale_source_events,
    smart_update_existing_event,
)
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://www.bigpeachrunningco.com"
GROUP_RUNS_URL = f"{BASE_URL}/group-runs/"
USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
WEEKS_AHEAD = 8
DAY_CODES = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"]
DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

ATLANTA_LOCATIONS = {
    "Brookhaven",
    "Decatur",
    "Midtown",
    "South Fulton",
    "Vinings/Smyrna",
}

VENUE_DATA_BY_LOCATION = {
    "Midtown": {
        "name": "Big Peach Running Co - Midtown",
        "slug": "big-peach-running-midtown",
        "address": "800 Peachtree Street, Suites B & C",
        "neighborhood": "Midtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30308",
        "venue_type": "retail",
        "spot_type": "retail",
        "website": f"{BASE_URL}/locations/midtown/",
    },
    "Brookhaven": {
        "name": "Big Peach Running Co - Brookhaven",
        "slug": "big-peach-running-brookhaven",
        "address": "705 Town Blvd, Ste. Q340",
        "neighborhood": "Brookhaven",
        "city": "Brookhaven",
        "state": "GA",
        "zip": "30319",
        "venue_type": "retail",
        "spot_type": "retail",
        "website": f"{BASE_URL}/locations/brookhaven/",
    },
    "Decatur": {
        "name": "Big Peach Running Co - Decatur",
        "slug": "big-peach-running-decatur",
        "address": "1565 Church St, Ste. 520",
        "neighborhood": "Decatur",
        "city": "Decatur",
        "state": "GA",
        "zip": "30033",
        "venue_type": "retail",
        "spot_type": "retail",
        "website": f"{BASE_URL}/locations/decatur/",
    },
    "South Fulton": {
        "name": "Big Peach Running Co - South Fulton",
        "slug": "big-peach-running-south-fulton",
        "address": "5829 Campbellton Road, Ste. #102",
        "neighborhood": "South Fulton",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30331",
        "venue_type": "retail",
        "spot_type": "retail",
        "website": f"{BASE_URL}/locations/south-fulton/",
    },
    "Vinings/Smyrna": {
        "name": "Big Peach Running Co - Vinings/Smyrna",
        "slug": "big-peach-running-vinings-smyrna",
        "address": "4624 Camp Highland Rd SE, Suite 200",
        "neighborhood": "Vinings/Smyrna",
        "city": "Smyrna",
        "state": "GA",
        "zip": "30082",
        "venue_type": "retail",
        "spot_type": "retail",
        "website": f"{BASE_URL}/locations/vinings-smyrna/",
    },
}


def parse_time_to_24h(value: str) -> str:
    """Convert a published time like 6:30pm or 8:00am into HH:MM."""
    match = re.search(r"(\d{1,2}):(\d{2})\s*(am|pm)", value.lower())
    if not match:
        raise ValueError(f"Unrecognized time: {value}")

    hour = int(match.group(1))
    minute = int(match.group(2))
    period = match.group(3)

    if period == "pm" and hour != 12:
        hour += 12
    if period == "am" and hour == 12:
        hour = 0

    return f"{hour:02d}:{minute:02d}"


def slugify(value: str) -> str:
    return re.sub(r"-{2,}", "-", re.sub(r"[^a-z0-9]+", "-", value.lower())).strip("-")


def get_next_weekday(start_date: datetime, weekday: int) -> datetime:
    """Return the next occurrence of weekday (0=Monday) on or after start_date."""
    days_ahead = weekday - start_date.weekday()
    if days_ahead < 0:
        days_ahead += 7
    return start_date + timedelta(days=days_ahead)


def build_event_title(location: str, weekday: int, start_time: str) -> str:
    """Build a stable title that distinguishes duplicate locations across weekdays."""
    day_name = DAY_NAMES[weekday]
    if location == "South Fulton":
        if start_time < "12:00":
            return f"Big Peach Group Run/Walk - {location} ({day_name} Morning)"
        return f"Big Peach Group Run/Walk - {location} ({day_name} Evening)"
    if location == "Vinings/Smyrna" and weekday == 5:
        return f"Big Peach Social Group Run - {location} ({day_name} Morning)"
    if location == "Brookhaven":
        return f"Big Peach Social Group Run - {location} ({day_name})"
    return f"Big Peach Social Group Run - {location}"


def build_description(location: str, day_name: str, start_time: str) -> str:
    """Build a consistent public-facing description from the official schedule page."""
    time_label = datetime.strptime(start_time, "%H:%M").strftime("%-I:%M %p")
    location_url = VENUE_DATA_BY_LOCATION[location]["website"]
    if location == "South Fulton":
        activity = "group run/walk"
    else:
        activity = "social group run"

    return (
        f"Official Big Peach Running Co. {activity} at the {location} store. "
        f"Big Peach says its social group runs welcome runners and walkers of all paces and abilities, "
        f"with access to store amenities like water, restrooms, and changing space where available. "
        f"Published schedule: {day_name}s at {time_label}. "
        f"Check the official Big Peach group-runs page and store page for route details or weather updates "
        f"({GROUP_RUNS_URL}; {location_url})."
    )[:1400]


def parse_group_runs_schedule(html: str) -> list[dict]:
    """Parse the official weekly schedule table from the group-runs page."""
    soup = BeautifulSoup(html, "html.parser")
    table = soup.select_one("table#runs-group-orig")
    if table is None:
        return []

    schedule: list[dict] = []
    current_weekday: int | None = None

    for row in table.find_all("tr", recursive=False):
        header = row.find("th")
        if header:
            day_label = header.get_text(" ", strip=True)
            current_weekday = DAY_NAMES.index(day_label)
            continue

        cells = row.find_all("td")
        if len(cells) != 2 or current_weekday is None:
            continue

        location_link = cells[0].find("a")
        location = cells[0].get_text(" ", strip=True)
        if location not in ATLANTA_LOCATIONS:
            continue

        time_24 = parse_time_to_24h(cells[1].get_text(" ", strip=True))
        schedule.append(
            {
                "location": location,
                "weekday": current_weekday,
                "start_time": time_24,
                "source_url": f"{BASE_URL}{location_link['href']}" if location_link and location_link.get("href", "").startswith("/") else GROUP_RUNS_URL,
            }
        )

    return schedule


def build_schedule_templates(entries: list[dict]) -> list[dict]:
    """Normalize parsed entries into crawl-ready recurring templates."""
    templates: list[dict] = []
    for entry in entries:
        location = entry["location"]
        weekday = entry["weekday"]
        start_time = entry["start_time"]
        day_name = DAY_NAMES[weekday]
        title = build_event_title(location, weekday, start_time)
        is_walk = location == "South Fulton"

        tags = ["run-club", "running", "group-run", "free", "weekly", slugify(location)]
        if start_time < "12:00":
            tags.append("morning")
        if is_walk:
            tags.append("walking")
            tags.append("group-walk")

        templates.append(
            {
                "title": title,
                "weekday": weekday,
                "start_time": start_time,
                "description": build_description(location, day_name, start_time),
                "location": location,
                "source_url": entry["source_url"],
                "venue_data": VENUE_DATA_BY_LOCATION[location],
                "category": "fitness",
                "subcategory": "running",
                "tags": tags,
            }
        )

    return templates


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Big Peach Running Co social group runs."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0
    current_hashes: set[str] = set()

    response = requests.get(
        GROUP_RUNS_URL,
        headers={"User-Agent": USER_AGENT},
        timeout=30,
    )
    response.raise_for_status()

    templates = build_schedule_templates(parse_group_runs_schedule(response.text))
    if not templates:
        raise ValueError("Big Peach group-runs page did not yield any Atlanta schedule rows")

    today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)

    for template in templates:
        venue_id = get_or_create_place(template["venue_data"])
        next_date = get_next_weekday(today, template["weekday"])
        day_code = DAY_CODES[template["weekday"]]
        day_name = DAY_NAMES[template["weekday"]]

        series_hint = {
            "series_type": "recurring_show",
            "series_title": template["title"],
            "frequency": "weekly",
            "day_of_week": day_name,
            "description": template["description"],
        }

        for week in range(WEEKS_AHEAD):
            event_date = next_date + timedelta(weeks=week)
            start_date = event_date.strftime("%Y-%m-%d")
            content_hash = generate_content_hash(template["title"], template["location"], start_date)
            current_hashes.add(content_hash)
            events_found += 1

            event_record = {
                "source_id": source_id,
                "venue_id": venue_id,
                "title": template["title"],
                "description": template["description"],
                "start_date": start_date,
                "start_time": template["start_time"],
                "end_date": None,
                "end_time": None,
                "is_all_day": False,
                "category": template["category"],
                "subcategory": template["subcategory"],
                "tags": template["tags"],
                "price_min": None,
                "price_max": None,
                "price_note": None,
                "is_free": True,
                "source_url": template["source_url"],
                "ticket_url": None,
                "image_url": None,
                "raw_text": f"{template['title']} | {start_date} | {template['start_time']}",
                "extraction_confidence": 0.93,
                "is_recurring": True,
                "recurrence_rule": f"FREQ=WEEKLY;BYDAY={day_code}",
                "content_hash": content_hash,
            }

            existing = find_existing_event_for_insert(event_record)
            if existing:
                smart_update_existing_event(existing, event_record)
                events_updated += 1
                continue

            insert_event(event_record, series_hint=series_hint)
            events_new += 1

    stale_deleted = remove_stale_source_events(source_id, current_hashes)
    if stale_deleted:
        logger.info("Removed %s stale Big Peach events after schedule refresh", stale_deleted)

    logger.info(
        "Big Peach Running Co crawl complete: %s found, %s new, %s updated",
        events_found,
        events_new,
        events_updated,
    )
    return events_found, events_new, events_updated
