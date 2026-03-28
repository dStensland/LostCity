"""
Crawler for the Georgia Elections Calendar (Cobb County source).

Source URL: https://www.cobbcounty.gov/elections/voting/elections-calendar

The page publishes a single HTML table listing statewide election dates for the
current cycle. Columns are:

  Election | Election Date | Registration Deadline (*Federal Contest Deadline)

One source covers all metro Atlanta counties — election dates are statewide, so
there is no need for per-county duplication. This crawler supersedes the four
manual per-county sources (fulton-county-elections, dekalb-county-elections,
cobb-county-elections, gwinnett-county-elections).

Per row, two events are emitted:
  1. Registration Deadline  — using the first (state) deadline from column 3
  2. Election Day           — using the election date from column 2

Both use is_all_day=True (no time specified by the source) and are grouped
under series_title="2026 Georgia Elections".

Volume: 6–8 events per table row (12–16 total events), updated annually.
"""

from __future__ import annotations

import logging
import re
from datetime import date, datetime
from typing import Optional

import requests
from bs4 import BeautifulSoup

from db import (
    get_or_create_place,
    insert_event,
    find_event_by_hash,
    smart_update_existing_event,
)
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

SOURCE_URL = "https://www.cobbcounty.gov/elections/voting/elections-calendar"
SERIES_TITLE = "2026 Georgia Elections"

PLACE_DATA = {
    "name": "Cobb County Elections and Registration",
    "slug": "cobb-county-elections-registration",
    "address": "736 Whitlock Ave NW",
    "neighborhood": "Downtown Marietta",
    "city": "Marietta",
    "state": "GA",
    "zip": "30064",
    "lat": 33.9526,
    "lng": -84.5547,
    "place_type": "organization",
    "spot_type": "organization",
    "website": "https://www.cobbcounty.gov/elections",
}

ELECTION_DAY_TAGS = [
    "election",
    "government",
    "civic-engagement",
    "election-day",
]

REGISTRATION_DEADLINE_TAGS = [
    "election",
    "government",
    "civic-engagement",
    "voter-registration",
    "civic-deadline",
]


def _fetch_html(url: str) -> str:
    """Fetch the elections calendar page, following redirects."""
    response = requests.get(url, timeout=30, allow_redirects=True)
    response.raise_for_status()
    return response.text


def _parse_date(raw: str) -> Optional[str]:
    """
    Parse a human-readable date string into YYYY-MM-DD format.

    Handles formats like "March 10, 2026", "April 7, 2026".
    Returns None if the string cannot be parsed.
    """
    raw = raw.strip()
    if not raw:
        return None
    try:
        dt = datetime.strptime(raw, "%B %d, %Y")
        return dt.strftime("%Y-%m-%d")
    except ValueError:
        logger.debug("Could not parse date: %r", raw)
        return None


def _extract_first_deadline(raw_deadline: str) -> str:
    """
    Extract the state registration deadline from the combined cell text.

    The source uses an asterisk to separate the state deadline from the
    federal-contest-specific deadline:
        "April 20, 2026"            → "April 20, 2026"
        "April 20, 2026*May 18, 2026" → "April 20, 2026"

    We always use the earlier (state) deadline for the registration event.
    """
    return raw_deadline.split("*")[0].strip()


def _parse_table(html: str) -> list[dict]:
    """
    Parse the elections calendar HTML table and return a list of row dicts.

    Each dict has keys:
        election_name   — str, e.g. "General Primary Election"
        election_date   — str, YYYY-MM-DD or None
        reg_deadline    — str, YYYY-MM-DD or None (state deadline only)
    """
    soup = BeautifulSoup(html, "html.parser")
    table = soup.find("table")
    if not table:
        logger.warning("No table found on Georgia elections calendar page")
        return []

    rows = table.find_all("tr")
    if not rows:
        return []

    results = []
    for row in rows[1:]:  # skip header row
        cells = row.find_all(["td", "th"])
        if len(cells) < 2:
            continue

        election_name = cells[0].get_text(strip=True)
        raw_election_date = cells[1].get_text(strip=True) if len(cells) > 1 else ""
        raw_reg_deadline = cells[2].get_text(strip=True) if len(cells) > 2 else ""

        if not election_name:
            continue

        election_date = _parse_date(raw_election_date)
        first_deadline = _extract_first_deadline(raw_reg_deadline)
        reg_deadline = _parse_date(first_deadline)

        results.append(
            {
                "election_name": election_name,
                "election_date": election_date,
                "reg_deadline": reg_deadline,
            }
        )

    return results


def _build_election_day_event(
    source_id: int,
    venue_id: int,
    election_name: str,
    election_date: str,
) -> dict:
    """Build an event record for an Election Day."""
    # Clean up slash-separated names for titles
    # e.g. "General Election/Special Election" → "Georgia General Election"
    clean_name = re.sub(r"/\w[\w ]+", "", election_name).strip()
    title = f"Georgia {clean_name}"

    description = (
        f"{election_name} for Georgia voters. "
        "Polls are open 7:00 AM – 7:00 PM. "
        "Find your polling location at mvp.sos.ga.gov."
    )

    content_hash = generate_content_hash(title, PLACE_DATA["name"], election_date)

    return {
        "source_id": source_id,
        "place_id": venue_id,
        "title": title,
        "description": description,
        "start_date": election_date,
        "start_time": "07:00",
        "end_date": None,
        "end_time": "19:00",
        "is_all_day": False,
        "category": "civic",
        "subcategory": None,
        "tags": ELECTION_DAY_TAGS,
        "price_min": None,
        "price_max": None,
        "price_note": None,
        "is_free": True,
        "source_url": SOURCE_URL,
        "ticket_url": None,
        "image_url": None,
        "raw_text": f"{title} | {election_date}",
        "extraction_confidence": 0.98,
        "is_recurring": False,
        "recurrence_rule": None,
        "content_hash": content_hash,
    }


def _build_registration_deadline_event(
    source_id: int,
    venue_id: int,
    election_name: str,
    reg_deadline: str,
) -> dict:
    """Build an event record for a Voter Registration Deadline."""
    clean_name = re.sub(r"/\w[\w ]+", "", election_name).strip()
    title = f"Voter Registration Deadline — Georgia {clean_name}"

    description = (
        f"Last day to register to vote in the {election_name}. "
        "Register online at mvp.sos.ga.gov, by mail, or in person at "
        "your county elections office."
    )

    content_hash = generate_content_hash(title, PLACE_DATA["name"], reg_deadline)

    return {
        "source_id": source_id,
        "place_id": venue_id,
        "title": title,
        "description": description,
        "start_date": reg_deadline,
        "start_time": None,
        "end_date": None,
        "end_time": None,
        "is_all_day": True,
        "category": "civic",
        "subcategory": None,
        "tags": REGISTRATION_DEADLINE_TAGS,
        "price_min": None,
        "price_max": None,
        "price_note": None,
        "is_free": True,
        "source_url": SOURCE_URL,
        "ticket_url": "https://mvp.sos.ga.gov/s/voter-registration",
        "image_url": None,
        "raw_text": f"{title} | {reg_deadline}",
        "extraction_confidence": 0.98,
        "is_recurring": False,
        "recurrence_rule": None,
        "content_hash": content_hash,
    }


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl the Georgia Elections Calendar and emit election + deadline events."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0
    today = date.today()

    try:
        venue_id = get_or_create_place(PLACE_DATA)
    except Exception as exc:
        logger.error("Failed to get/create venue for Georgia Elections: %s", exc)
        raise

    try:
        html = _fetch_html(SOURCE_URL)
    except requests.exceptions.RequestException as exc:
        logger.error("Failed to fetch Georgia elections calendar: %s", exc)
        raise

    rows = _parse_table(html)
    if not rows:
        logger.warning("Georgia elections: no rows parsed from table")
        return 0, 0, 0

    logger.info("Georgia elections: found %d election rows", len(rows))

    series_hint = {
        "series_type": "other",
        "series_title": SERIES_TITLE,
        "frequency": "irregular",
    }

    for row in rows:
        election_name = row["election_name"]
        election_date = row["election_date"]
        reg_deadline = row["reg_deadline"]

        # --- Registration Deadline event ---
        if reg_deadline:
            try:
                deadline_dt = datetime.strptime(reg_deadline, "%Y-%m-%d").date()
                if deadline_dt >= today:
                    events_found += 1
                    event_record = _build_registration_deadline_event(
                        source_id, venue_id, election_name, reg_deadline
                    )
                    existing = find_event_by_hash(event_record["content_hash"])
                    if existing:
                        smart_update_existing_event(existing, event_record)
                        events_updated += 1
                    else:
                        insert_event(event_record, series_hint=series_hint)
                        events_new += 1
                        logger.info(
                            "Added deadline: %s on %s",
                            election_name,
                            reg_deadline,
                        )
                else:
                    logger.debug(
                        "Skipping past registration deadline: %s (%s)",
                        election_name,
                        reg_deadline,
                    )
            except Exception as exc:
                logger.warning(
                    "Error processing registration deadline for %r: %s",
                    election_name,
                    exc,
                )

        # --- Election Day event ---
        if election_date:
            try:
                election_dt = datetime.strptime(election_date, "%Y-%m-%d").date()
                if election_dt >= today:
                    events_found += 1
                    event_record = _build_election_day_event(
                        source_id, venue_id, election_name, election_date
                    )
                    existing = find_event_by_hash(event_record["content_hash"])
                    if existing:
                        smart_update_existing_event(existing, event_record)
                        events_updated += 1
                    else:
                        insert_event(event_record, series_hint=series_hint)
                        events_new += 1
                        logger.info(
                            "Added election day: %s on %s",
                            election_name,
                            election_date,
                        )
                else:
                    logger.debug(
                        "Skipping past election: %s (%s)",
                        election_name,
                        election_date,
                    )
            except Exception as exc:
                logger.warning(
                    "Error processing election day for %r: %s",
                    election_name,
                    exc,
                )

    logger.info(
        "Georgia elections crawl complete: %d found, %d new, %d updated",
        events_found,
        events_new,
        events_updated,
    )
    return events_found, events_new, events_updated
