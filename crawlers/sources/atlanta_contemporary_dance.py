"""
Crawler for Atlanta Contemporary Dance Company (atlantacontemporarydance.com).
Professional contemporary dance company based in Atlanta, GA.
Artistic Director: Lauren Overstreet.

Site structure:
  - Wix site with a static /performances page listing upcoming and past performances
  - Events are rendered in static HTML and visible without JavaScript execution
  - Upcoming section precedes "Past Performances" divider in page text

Strategy:
  - Use Playwright to render the performances page
  - Parse "Upcoming Performances" section before the "Past Performances" boundary
  - Date formats: "Thursday, 3.19" (month.day), "April 18th, 2026", "Month Day, Year at H:MM PM"
  - Ticket links may be Wix member-gated or external (Eventbrite, etc.)

Typical yield: 3-6 events/year (productions, festival appearances, workshops)
"""

from __future__ import annotations

import logging
import re
from datetime import datetime, date
from typing import Optional

from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeoutError

from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://www.atlantacontemporarydance.com"
PERFORMANCES_URL = f"{BASE_URL}/performances"

# ACDC does not have a fixed home stage — they perform at various Atlanta venues.
# Use org venue as fallback when no venue can be determined.
ACDC_ORG_VENUE_DATA = {
    "name": "Atlanta Contemporary Dance Company",
    "slug": "atlanta-contemporary-dance-company",
    "address": "Atlanta, GA",
    "neighborhood": "Atlanta",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30308",
    "lat": 33.7490,
    "lng": -84.3880,
    "venue_type": "organization",
    "spot_type": "theater",
    "website": BASE_URL,
    "vibes": ["artsy", "all-ages"],
}

# KSU Dance Theatre — appears frequently as a performance venue
KSU_VENUE_DATA = {
    "name": "KSU Dance Theatre",
    "slug": "ksu-dance-theatre",
    "address": "860 Rossbacher Way",
    "neighborhood": "Marietta",
    "city": "Marietta",
    "state": "GA",
    "zip": "30060",
    "lat": 33.9360,
    "lng": -84.5218,
    "venue_type": "theater",
    "spot_type": "theater",
    "website": "https://dance.kennesaw.edu",
    "vibes": ["artsy"],
}


def _parse_acdc_date(text: str) -> tuple[Optional[str], Optional[str]]:
    """
    Parse date/time from ACDC event text. Handles multiple formats:
    - "Thursday, 3.19" → infer year as current/next
    - "April 18th, 2026"
    - "April 18th, 2026 at 7:30 PM"
    - "July 27, 2024 at 7:30pm"
    - "June 3-9, 2024" → use start date

    Returns (start_date, start_time) as ("YYYY-MM-DD", "HH:MM") or (None, None).
    """
    text = text.strip()

    # Format: "Month Day, Year at H:MM PM" or "Month Day, Year"
    match = re.search(
        r"(January|February|March|April|May|June|July|August|"
        r"September|October|November|December)\s+"
        r"(\d{1,2})(?:st|nd|rd|th)?(?:\s*[-–]\s*\d{1,2})?,?\s+"
        r"(\d{4})"
        r"(?:\s+at\s+(\d{1,2}):(\d{2})\s*(am|pm|AM|PM))?",
        text,
        re.IGNORECASE,
    )
    if match:
        month, day, year = match.group(1), match.group(2), match.group(3)
        hour_s, min_s, meridiem = match.group(4), match.group(5), match.group(6)
        try:
            dt = datetime.strptime(f"{month} {day} {year}", "%B %d %Y")
            start_date = dt.strftime("%Y-%m-%d")
            start_time = None
            if hour_s and min_s and meridiem:
                hour_int = int(hour_s)
                if meridiem.upper() == "PM" and hour_int != 12:
                    hour_int += 12
                elif meridiem.upper() == "AM" and hour_int == 12:
                    hour_int = 0
                start_time = f"{hour_int:02d}:{min_s}"
            return start_date, start_time
        except ValueError:
            pass

    # Format: "Thursday, 3.19" (month.day, no year) — infer year
    match2 = re.search(
        r"(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s+(\d{1,2})\.(\d{1,2})",
        text,
        re.IGNORECASE,
    )
    if match2:
        month_num, day_num = int(match2.group(1)), int(match2.group(2))
        today = date.today()
        # Infer year: use current year, bump to next if already past
        for year_offset in range(2):
            candidate_year = today.year + year_offset
            try:
                candidate_date = date(candidate_year, month_num, day_num)
                if candidate_date >= today:
                    return candidate_date.strftime("%Y-%m-%d"), None
            except ValueError:
                continue

    return None, None


def _extract_upcoming_events(body_text: str) -> list[dict]:
    """
    Parse the ACDC performances page body text to extract upcoming events.
    Returns list of dicts with keys: title, date_text, description, is_future_note.
    """
    # Split on "Past Performances" to get only upcoming section
    past_boundary = re.split(r"Past\s+(?:Guest\s+)?Performances?", body_text, flags=re.IGNORECASE, maxsplit=1)
    upcoming_text = past_boundary[0] if len(past_boundary) > 1 else body_text

    # Strip navigation noise
    upcoming_text = re.sub(r"Skip to Main Content.*?Upcoming Performances", "", upcoming_text, flags=re.DOTALL | re.IGNORECASE)
    upcoming_text = upcoming_text.strip()

    events = []

    # Pattern 1: Explicit "New Production Coming [Date]!" style announcements
    coming_matches = re.findall(
        r"(?:New\s+)?(?:Production|Show|Performance)\s+Coming\s+([A-Z][a-z]+\s+\d+(?:st|nd|rd|th)?,?\s*\d{4})",
        upcoming_text,
        re.IGNORECASE,
    )
    for date_text in coming_matches:
        events.append({
            "title": "ACDC New Production",
            "date_text": date_text,
            "description": "Upcoming production by Atlanta Contemporary Dance Company. Check website for details.",
            "is_tba": True,
        })

    # Pattern 2: "DayOfWeek, M.D Title [Ticket noise]"
    # e.g. "Thursday, 3.19 Community Performance Complimentary Ticket"
    # Extract up to the first noise word/phrase
    for day_match in re.finditer(
        r"((?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s+\d{1,2}\.\d{1,2})"
        r"\s+(.+?)(?=(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s+\d{1,2}\.\d{1,2}|"
        r"New\s+Production|Past|$)",
        upcoming_text,
        re.IGNORECASE | re.DOTALL,
    ):
        date_text = day_match.group(1).strip()
        title_block = re.sub(r"\s+", " ", day_match.group(2)).strip()
        # Strip ticket/CTA noise — keep only the event title (first phrase before ticket language)
        title_block = re.split(
            r"\s+(?:Complimentary\s+Ticket|Buy\s+Ticket|RSVP|Register|Learn\s+More|More\s+Info)",
            title_block,
            flags=re.IGNORECASE,
            maxsplit=1,
        )[0].strip()
        # Also split on "New Production Coming" if it bleeds in
        title_block = re.split(r"\s+New\s+Production", title_block, flags=re.IGNORECASE)[0].strip()
        if title_block and 3 < len(title_block) < 120:
            events.append({
                "title": title_block,
                "date_text": date_text,
                "description": None,
                "is_tba": False,
            })

    # Deduplicate by (title_lower, date_text)
    seen = set()
    unique_events = []
    for ev in events:
        key = (ev["title"].lower()[:40], ev["date_text"])
        if key not in seen:
            seen.add(key)
            unique_events.append(ev)

    return unique_events


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Atlanta Contemporary Dance Company performances via Playwright."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    org_venue_id = get_or_create_venue(ACDC_ORG_VENUE_DATA)

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                user_agent=(
                    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                ),
                viewport={"width": 1280, "height": 900},
            )
            page = context.new_page()

            logger.info(f"ACDC: fetching performances page {PERFORMANCES_URL}")
            try:
                page.goto(PERFORMANCES_URL, wait_until="domcontentloaded", timeout=30000)
                page.wait_for_timeout(3000)
            except PlaywrightTimeoutError:
                logger.warning("ACDC: performances page timed out, proceeding with partial load")

            body_text = re.sub(r"\s+", " ", page.inner_text("body"))

            # Extract ticket link if present
            ticket_url = PERFORMANCES_URL
            ticket_links = page.query_selector_all('a[href*="ticket"], a[href*="eventbrite"], a[href*="buy"]')
            for link in ticket_links:
                href = link.get_attribute("href")
                if href and href.startswith("http"):
                    ticket_url = href
                    break

            # Extract og:image for event image
            image_url = None
            og_image = page.query_selector('meta[property="og:image"]')
            if og_image:
                image_url = og_image.get_attribute("content")

            upcoming_events = _extract_upcoming_events(body_text)
            logger.info(f"ACDC: found {len(upcoming_events)} upcoming event candidates")

            for ev_data in upcoming_events:
                title = ev_data["title"]
                date_text = ev_data["date_text"]
                description = ev_data.get("description")

                start_date, start_time = _parse_acdc_date(date_text)
                if not start_date:
                    # For "New Production Coming April 18th, 2026!" style
                    start_date, start_time = _parse_acdc_date(date_text)

                if not start_date:
                    logger.debug(f"ACDC: could not parse date '{date_text}' for '{title}'")
                    continue

                # Skip past events
                try:
                    if datetime.strptime(start_date, "%Y-%m-%d").date() < datetime.now().date():
                        logger.debug(f"ACDC: skipping past event '{title}' on {start_date}")
                        continue
                except ValueError:
                    continue

                events_found += 1
                content_hash = generate_content_hash(title, "Atlanta Contemporary Dance Company", start_date)

                event_record = {
                    "source_id": source_id,
                    "venue_id": org_venue_id,
                    "title": title,
                    "description": description,
                    "start_date": start_date,
                    "start_time": start_time,
                    "end_date": None,
                    "end_time": None,
                    "is_all_day": False,
                    "category": "theater",
                    "subcategory": "dance",
                    "tags": [
                        "atlanta-contemporary-dance",
                        "dance",
                        "contemporary-dance",
                        "performing-arts",
                    ],
                    "price_min": None,
                    "price_max": None,
                    "price_note": None,
                    "is_free": False,
                    "source_url": PERFORMANCES_URL,
                    "ticket_url": ticket_url,
                    "image_url": image_url,
                    "raw_text": f"{title} — {date_text}",
                    "extraction_confidence": 0.82,
                    "is_recurring": False,
                    "recurrence_rule": None,
                    "content_hash": content_hash,
                }

                existing = find_event_by_hash(content_hash)
                if existing:
                    smart_update_existing_event(existing, event_record)
                    events_updated += 1
                else:
                    try:
                        insert_event(event_record)
                        events_new += 1
                        logger.info(f"ACDC: added '{title}' on {start_date}")
                    except Exception as e:
                        logger.error(f"ACDC: failed to insert '{title}': {e}")

            browser.close()

    except Exception as e:
        logger.error(f"ACDC: crawl failed: {e}")
        raise

    logger.info(
        f"ACDC crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
    )
    return events_found, events_new, events_updated
