"""
Crawler for Out of Hand Theater (outofhandtheater.com).
Experimental/devised theater company in Atlanta, 25th anniversary season.
HQ: 135 Auburn Avenue, Atlanta, GA 30303.

Format: "Shows in Homes" — one-act plays performed in living rooms and intimate
venues across Metro Atlanta, paired with cocktail parties and community conversations.

Current production: "Prisontown" by Lee Osorio.
40 performances through April 2026 at different Atlanta neighborhoods.
Performance schedule at /prisontownperformances.

Site: Squarespace CMS. The upcoming-events calendar page runs behind; the
production-specific performance listing at /prisontownperformances is the
authoritative source for upcoming dates.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime
from typing import Optional

from playwright.sync_api import sync_playwright

from db import get_or_create_place, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://www.outofhandtheater.com"
PERFORMANCES_URL = f"{BASE_URL}/prisontownperformances"
SHOW_INFO_URL = f"{BASE_URL}/shows-in-homes-2026"

# Out of Hand HQ — serves as fallback venue; individual shows are in homes/community spaces
PLACE_DATA = {
    "name": "Out of Hand Theater",
    "slug": "out-of-hand-theater",
    "address": "135 Auburn Ave",
    "neighborhood": "Sweet Auburn",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30303",
    "lat": 33.7538,
    "lng": -84.3779,
    "venue_type": "organization",
    "spot_type": "theater",
    "website": BASE_URL,
    "vibes": ["theater", "experimental"],
}

# Neighborhood → approximate lat/lng for geocoding show-in-home events
NEIGHBORHOOD_COORDS = {
    "decatur": (33.7748, -84.2963),
    "inman park": (33.7547, -84.3494),
    "virginia-highland": (33.7757, -84.3544),
    "virginia highland": (33.7757, -84.3544),
    "lake claire": (33.7677, -84.3273),
    "north druid hills": (33.8029, -84.3228),
    "buckhead": (33.8365, -84.3798),
    "midtown": (33.7808, -84.3832),
    "kirkwood": (33.7486, -84.3284),
    "edgewood": (33.7536, -84.3466),
    "winona park": (33.7660, -84.3336),
    "emory": (33.7941, -84.3239),
    "norcross": (33.9415, -84.2136),
    "hiram": (33.8773, -84.7596),
}


def parse_performance_date_time(date_str: str, time_str: str) -> tuple[Optional[str], Optional[str]]:
    """
    Parse date + time strings from prisontown performances page.
    date_str format: "3/12/26" or "3/12/26"
    time_str format: "7pm" or "8pm" or "2pm" or "1:30pm" or "5pm"

    Returns (YYYY-MM-DD, HH:MM)
    """
    date_str = date_str.strip()
    time_str = time_str.strip().lower()

    # Parse date: M/D/YY
    date_match = re.match(r"(\d{1,2})/(\d{1,2})/(\d{2,4})", date_str)
    if not date_match:
        return None, None
    month, day, year = date_match.groups()
    # 2-digit year: 26 -> 2026
    if len(year) == 2:
        year = "20" + year
    try:
        dt = datetime(int(year), int(month), int(day))
        date_out = dt.strftime("%Y-%m-%d")
    except ValueError:
        return None, None

    # Parse time: "7pm", "1:30pm", "2pm"
    time_out = None
    time_match = re.match(r"(\d{1,2})(?::(\d{2}))?\s*(am|pm)", time_str)
    if time_match:
        hour, minute, ampm = time_match.groups()
        hour = int(hour)
        minute = int(minute or 0)
        if ampm == "pm" and hour != 12:
            hour += 12
        elif ampm == "am" and hour == 12:
            hour = 0
        time_out = f"{hour:02d}:{minute:02d}"

    return date_out, time_out


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl Out of Hand Theater's Prisontown performance schedule.

    Each performance is a Shows-in-Homes event at a different private home or
    community venue in Metro Atlanta. We create one event per public performance
    (skipping private events that require email for info).
    """
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    # Production description (from shows-in-homes page)
    production_description = (
        "Prisontown by Lee Osorio. A writer goes home to Lumpkin, GA, home to one of the nation's "
        "largest immigration detention centers, and witnesses the barbarity of the nation's immigration "
        "crisis, and a small town torn by poverty and the prison industry. Performed in living rooms "
        "across Metro Atlanta, paired with cocktail parties and conversations with community partners."
    )

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
                viewport={"width": 1920, "height": 1080},
            )
            page = context.new_page()

            venue_id = get_or_create_place(PLACE_DATA)

            logger.info(f"Fetching Out of Hand Theater performances: {PERFORMANCES_URL}")
            page.goto(PERFORMANCES_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(3000)

            # Get page text
            body_text = page.inner_text("body")

            # Get all ticket/rsvp links with their href
            ticket_link_els = page.query_selector_all(
                'a[href*="secure.qgiv.com"], a[href*="eventbrite.com"], a[href*="rsvp"]'
            )
            ticket_links_raw = []
            for a in ticket_link_els:
                href = a.get_attribute("href") or ""
                text = a.inner_text().strip()
                if href and ("purchase" in text.lower() or "ticket" in text.lower() or "rsvp" in text.lower()):
                    ticket_links_raw.append(href)

            # Parse performance entries from body text
            # Pattern: date line like "3/12/26 | 7pm" followed by
            # "Host: Name" and "Neighborhood: Place" or "Location: Place"
            lines = [ln.strip() for ln in body_text.split("\n") if ln.strip()]

            # Build a list of performance dicts by scanning lines
            performances = []
            i = 0
            ticket_idx = 0  # Track which ticket link maps to which performance

            while i < len(lines):
                line = lines[i]

                # Match date | time line: "3/12/26 | 7pm"
                date_time_match = re.match(
                    r"(\d{1,2}/\d{1,2}/\d{2,4})\s*\|\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm))",
                    line,
                    re.IGNORECASE,
                )
                # Also match bare date lines: "4/25/26" (extended performances with no time)
                bare_date_match = re.match(r"^(\d{1,2}/\d{1,2}/\d{2,4})$", line)

                if date_time_match:
                    date_str, time_str = date_time_match.groups()
                    start_date, start_time = parse_performance_date_time(date_str, time_str)
                elif bare_date_match:
                    date_str = bare_date_match.group(1)
                    start_date, _ = parse_performance_date_time(date_str, "8pm")
                    start_time = None  # No time info for bare dates
                else:
                    i += 1
                    continue

                if not start_date:
                    i += 1
                    continue

                # Skip past performances
                try:
                    if datetime.strptime(start_date, "%Y-%m-%d").date() < datetime.now().date():
                        i += 1
                        continue
                except ValueError:
                    i += 1
                    continue

                perf = {
                    "start_date": start_date,
                    "start_time": start_time,
                    "host": None,
                    "neighborhood": None,
                    "location": None,
                    "is_private": False,
                    "ticket_url": None,
                }

                # Look ahead up to 6 lines for host/neighborhood/private/ticket info
                j = i + 1
                while j < min(i + 7, len(lines)):
                    next_line = lines[j]

                    if re.match(r"Host:", next_line, re.IGNORECASE):
                        perf["host"] = re.sub(r"^Host:\s*", "", next_line, flags=re.IGNORECASE).strip()
                    elif re.match(r"Neighborhood:", next_line, re.IGNORECASE):
                        perf["neighborhood"] = re.sub(
                            r"^Neighborhood:\s*", "", next_line, flags=re.IGNORECASE
                        ).strip()
                    elif re.match(r"Location:", next_line, re.IGNORECASE):
                        perf["location"] = re.sub(
                            r"^Location:\s*", "", next_line, flags=re.IGNORECASE
                        ).strip()
                    elif re.match(r"Private Event", next_line, re.IGNORECASE):
                        perf["is_private"] = True
                    elif re.match(r"(PURCHASE TICKETS|RSVP FOR A SEAT)", next_line, re.IGNORECASE):
                        if ticket_idx < len(ticket_links_raw):
                            perf["ticket_url"] = ticket_links_raw[ticket_idx]
                            ticket_idx += 1
                    elif re.match(r"EMAIL FOR MORE INFO", next_line, re.IGNORECASE):
                        perf["is_private"] = True

                    # Stop when we hit the next date line or week header
                    if j > i + 1 and (
                        re.match(r"\d{1,2}/\d{1,2}/\d{2,4}", next_line)
                        or re.match(
                            r"WEEK (SEVEN|EIGHT|NINE|TEN|ELEVEN|TWELVE|EXTENDED)",
                            next_line, re.IGNORECASE,
                        )
                    ):
                        break

                    j += 1

                # Skip fully private events (no public ticket link)
                if perf["is_private"] and not perf["ticket_url"]:
                    i += 1
                    continue

                performances.append(perf)
                i = j  # Skip lines already consumed
                continue

            logger.info(f"Found {len(performances)} upcoming public Prisontown performances")

            for perf in performances:
                try:
                    start_date = perf["start_date"]
                    start_time = perf["start_time"]
                    neighborhood = perf["neighborhood"] or perf["location"] or "Atlanta"
                    host = perf["host"] or ""
                    ticket_url = perf["ticket_url"] or PERFORMANCES_URL

                    # Build title with neighborhood context
                    if neighborhood and neighborhood.lower() not in {"atlanta", "metro atlanta"}:
                        title = f"Prisontown — {neighborhood}"
                    else:
                        title = "Prisontown"

                    content_hash = generate_content_hash(
                        f"Prisontown-{host or neighborhood}", "Out of Hand Theater", start_date
                    )

                    events_found += 1

                    tags = [
                        "out-of-hand-theater",
                        "theater",
                        "experimental",
                        "shows-in-homes",
                        "immersive",
                        "community",
                        "social-justice",
                    ]
                    if neighborhood:
                        tags.append(neighborhood.lower().replace(" ", "-"))

                    series_hint = {
                        "series_type": "recurring_show",
                        "series_title": "Prisontown by Out of Hand Theater",
                        "description": production_description,
                        "frequency": "irregular",
                    }

                    event_record = {
                        "source_id": source_id,
                        "venue_id": venue_id,
                        "title": title,
                        "description": production_description,
                        "start_date": start_date,
                        "start_time": start_time,
                        "end_date": start_date,
                        "end_time": None,
                        "is_all_day": False,
                        "category": "theater",
                        "subcategory": "immersive",
                        "tags": tags,
                        "price_min": 23,  # Student/senior price
                        "price_max": 33,  # General admission
                        "price_note": "Students/Seniors $23 | General Admission $33",
                        "is_free": False,
                        "source_url": PERFORMANCES_URL,
                        "ticket_url": ticket_url,
                        "image_url": None,
                        "raw_text": f"{start_date} {start_time} {neighborhood}",
                        "extraction_confidence": 0.85,
                        "is_recurring": True,
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
                        logger.info(
                            f"Added: Prisontown @ {neighborhood} ({start_date} {start_time})"
                        )
                    except Exception as e:
                        logger.error(f"Failed to insert Prisontown {start_date}: {e}")

                except Exception as e:
                    logger.warning(f"Error processing performance: {e}")
                    continue

            browser.close()

        logger.info(
            f"Out of Hand Theater crawl complete: {events_found} found, "
            f"{events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Out of Hand Theater: {e}")
        raise

    return events_found, events_new, events_updated
