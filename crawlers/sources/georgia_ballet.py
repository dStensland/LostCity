"""
Crawler for The Georgia Ballet (georgiaballet.org).
Professional ballet company based in Marietta, GA.
Performs primarily at Jennie T. Anderson Theatre (JTA) in Marietta.

Site: Wix (JavaScript-heavy, requires Playwright).
Events listed at /about-3 with natural language descriptions + OvationTix ticket links.
Season productions listed at /season (no specific dates, but show titles and descriptions).

Strategy:
  1. Scrape /about-3 (events page) for current season events with dates embedded in text
  2. Scrape /season for upcoming season productions (Firebird/Carmen, Nutcracker, Sleeping Beauty)
  3. Extract OvationTix production URLs, then scrape those for specific performance dates/times/prices
  4. Group each production's performances (multiple nights) as individual events

OvationTix pattern: https://ci.ovationtix.com/36260/production/<id>
  - Organization ID: 36260 (The Georgia Ballet)
"""

from __future__ import annotations

import logging
import re
from datetime import datetime
from typing import Optional

from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeoutError

from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://www.georgiaballet.org"
EVENTS_URL = f"{BASE_URL}/about-3"
SEASON_URL = f"{BASE_URL}/season"
OVATIONTIX_ORG_ID = "36260"

# Primary performance venue
JTA_VENUE_DATA = {
    "name": "Jennie T. Anderson Theatre",
    "slug": "jennie-t-anderson-theatre",
    "address": "528 S Marietta Pkwy SE",
    "neighborhood": "Marietta",
    "city": "Marietta",
    "state": "GA",
    "zip": "30060",
    "lat": 33.9429,
    "lng": -84.5469,
    "venue_type": "theater",
    "spot_type": "theater",
    "website": "https://www.cobbcounty.org/parks/performing-arts/jennie-t-anderson-theatre",
    "vibes": ["all-ages", "family-friendly"],
}

# Georgia Ballet's home studio (used for intimate/studio performances)
STUDIO_VENUE_DATA = {
    "name": "The Georgia Ballet",
    "slug": "the-georgia-ballet",
    "address": "1255 Field Pkwy",
    "neighborhood": "Marietta",
    "city": "Marietta",
    "state": "GA",
    "zip": "30066",
    "lat": 34.0241,
    "lng": -84.4957,
    "venue_type": "dance_studio",
    "spot_type": "theater",
    "website": BASE_URL,
    "vibes": ["all-ages", "family-friendly"],
}

# Month name to number for date parsing
MONTH_MAP = {
    "january": 1, "february": 2, "march": 3, "april": 4,
    "may": 5, "june": 6, "july": 7, "august": 8,
    "september": 9, "october": 10, "november": 11, "december": 12,
}

# Month abbreviation alternatives
MONTH_ABBR_MAP = {
    "jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6,
    "jul": 7, "aug": 8, "sep": 9, "sept": 9, "oct": 10, "nov": 11, "dec": 12,
}


def _parse_date_from_text(text: str) -> Optional[str]:
    """
    Extract a date from natural language text.
    Handles patterns like:
      - "Saturday April 18th, 2026"
      - "Friday, May 8"
      - "May 8, 2026"
      - "April 18th, 2026"
    Returns "YYYY-MM-DD" or None.
    """
    # Full date with year: "Month Day, Year" or "Day Month Year"
    pattern_full = re.search(
        r"(January|February|March|April|May|June|July|August|September|October|November|December)"
        r"\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})",
        text,
        re.IGNORECASE,
    )
    if pattern_full:
        month_str, day_str, year_str = pattern_full.groups()
        month = MONTH_MAP.get(month_str.lower())
        if month:
            try:
                dt = datetime(int(year_str), month, int(day_str))
                return dt.strftime("%Y-%m-%d")
            except ValueError:
                pass

    # Date without year — assume current or next year
    pattern_no_year = re.search(
        r"(January|February|March|April|May|June|July|August|September|October|November|December)"
        r"\s+(\d{1,2})(?:st|nd|rd|th)?",
        text,
        re.IGNORECASE,
    )
    if pattern_no_year:
        month_str, day_str = pattern_no_year.groups()
        month = MONTH_MAP.get(month_str.lower())
        if month:
            year = datetime.now().year
            try:
                dt = datetime(year, month, int(day_str))
                # If the date has passed, try next year
                if dt.date() < datetime.now().date():
                    dt = datetime(year + 1, month, int(day_str))
                return dt.strftime("%Y-%m-%d")
            except ValueError:
                pass

    return None


def _parse_time_from_text(text: str) -> Optional[str]:
    """
    Extract a time from text.
    Handles: "7:00 pm", "7:00 PM", "7:00pm", "7 PM"
    Returns "HH:MM" in 24-hour format or None.
    """
    match = re.search(r"(\d{1,2})(?::(\d{2}))?\s*(AM|PM|am|pm)", text)
    if match:
        hour = int(match.group(1))
        minute = int(match.group(2) or 0)
        meridiem = match.group(3).upper()

        if meridiem == "PM" and hour != 12:
            hour += 12
        elif meridiem == "AM" and hour == 12:
            hour = 0

        return f"{hour:02d}:{minute:02d}"
    return None


def _parse_price_from_text(text: str) -> tuple[Optional[float], Optional[float], Optional[str], bool]:
    """
    Extract price info from OvationTix page text.
    Returns (price_min, price_max, price_note, is_free).
    """
    if not text:
        return None, None, None, False

    # Look for price range patterns: "$79.00 - $154.00 including fees"
    range_match = re.search(r"\$(\d+(?:\.\d+)?)\s*[-–]\s*\$(\d+(?:\.\d+)?)", text)
    if range_match:
        price_min = float(range_match.group(1))
        price_max = float(range_match.group(2))
        return price_min, price_max, None, False

    # Single price: "$75.00"
    single_match = re.search(r"\$(\d+(?:\.\d+)?)", text)
    if single_match:
        price = float(single_match.group(1))
        return price, price, None, price == 0.0

    return None, None, None, False


def _parse_ovationtix_perfs(body_text: str) -> list[tuple[str, Optional[str]]]:
    """
    Parse performance date/time pairs from OvationTix page body text.

    OvationTix formats observed:
      1. "Friday\n8 May 2026\n\n6:30 pm"       — DayName on its own line, DD Month YYYY on next
      2. "Saturday April 18th, 2026\n7:00 pm"  — DayName + Month Day, Year on same line
      3. "Event date\nSaturday April 18th, 2026\n7:00 pm"

    Returns list of ("YYYY-MM-DD", "HH:MM") tuples.
    """
    lines = [l.strip() for l in body_text.split("\n")]

    # Regex patterns for lines
    date_dd_mon_yyyy = re.compile(
        r"^(\d{1,2})\s+"
        r"(January|February|March|April|May|June|July|August|September|October|November|December)"
        r"\s+(\d{4})$",
        re.IGNORECASE,
    )
    date_day_mon_nth_yyyy = re.compile(
        r"^(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)[,\s]+"
        r"(January|February|March|April|May|June|July|August|September|October|November|December)"
        r"\s+(\d{1,2})(?:st|nd|rd|th)?,\s+(\d{4})$",
        re.IGNORECASE,
    )
    time_only = re.compile(r"^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$", re.IGNORECASE)
    # Inline pattern: "Month Day, Year H:MM pm"
    inline_dt = re.compile(
        r"(January|February|March|April|May|June|July|August|September|October|November|December)"
        r"\s+(\d{1,2})(?:st|nd|rd|th)?,\s+(\d{4})\s+(\d{1,2}(?::\d{2})?)\s*(am|pm)",
        re.IGNORECASE,
    )

    perfs: list[tuple[str, Optional[str]]] = []
    seen: set[tuple[str, Optional[str]]] = set()

    def _make_time(hour: int, minute: int, meridiem: str) -> str:
        h = hour
        m = meridiem.upper()
        if m == "PM" and h != 12:
            h += 12
        elif m == "AM" and h == 12:
            h = 0
        return f"{h:02d}:{minute:02d}"

    def _add(date_str: str, time_str: Optional[str]) -> None:
        key = (date_str, time_str)
        if key not in seen:
            seen.add(key)
            perfs.append(key)

    i = 0
    while i < len(lines):
        line = lines[i]

        # Check inline date+time first
        for im in inline_dt.finditer(line):
            month_name, day, year, t_val, mer = im.groups()
            month = MONTH_MAP.get(month_name.lower())
            if month:
                try:
                    date_str = datetime(int(year), month, int(day)).strftime("%Y-%m-%d")
                    t_parts = t_val.split(":")
                    hour = int(t_parts[0])
                    minute = int(t_parts[1]) if len(t_parts) > 1 else 0
                    _add(date_str, _make_time(hour, minute, mer))
                except ValueError:
                    pass

        # Check DD Month YYYY line
        dm = date_dd_mon_yyyy.match(line)
        if dm:
            day, month_name, year = dm.groups()
            month = MONTH_MAP.get(month_name.lower())
            if month:
                try:
                    date_str = datetime(int(year), month, int(day)).strftime("%Y-%m-%d")
                    # Look for time(s) in the next few lines
                    for j in range(i + 1, min(i + 5, len(lines))):
                        tm = time_only.match(lines[j])
                        if tm:
                            hour, minute, mer = tm.groups()
                            _add(date_str, _make_time(int(hour), int(minute or 0), mer))
                        elif lines[j] and not re.match(r"^(Georgia Ballet|Box Office|Email|\$)", lines[j]):
                            break  # Non-time, non-empty line signals end of this block
                except ValueError:
                    pass

        # Check DayName Month Nth, YYYY line
        dm2 = date_day_mon_nth_yyyy.match(line)
        if dm2:
            month_name, day, year = dm2.groups()
            month = MONTH_MAP.get(month_name.lower())
            if month:
                try:
                    date_str = datetime(int(year), month, int(day)).strftime("%Y-%m-%d")
                    for j in range(i + 1, min(i + 5, len(lines))):
                        tm = time_only.match(lines[j])
                        if tm:
                            hour, minute, mer = tm.groups()
                            _add(date_str, _make_time(int(hour), int(minute or 0), mer))
                        elif lines[j] and not re.match(r"^(Georgia Ballet|Box Office|Email|\$)", lines[j]):
                            break
                except ValueError:
                    pass

        i += 1

    return perfs


def _scrape_ovationtix_production(page, prod_url: str) -> list[dict]:
    """
    Scrape an OvationTix production page for performance dates, times, and prices.
    Returns list of {date, time, title, description, price_min, price_max, is_free} dicts.
    """
    performances = []

    try:
        page.goto(prod_url, wait_until="domcontentloaded", timeout=25000)
        page.wait_for_timeout(4000)
        page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
        page.wait_for_timeout(1500)

        body_text = page.inner_text("body")

        # Extract show title — it's usually line 6-8 after nav items
        title = None
        nav_items = {"calendar", "packages", "donations", "gift cards", "login", "georgia ballet",
                     "select time to continue", "filter", "regular price", "event date"}
        lines = [l.strip() for l in body_text.split("\n") if l.strip()]
        for line in lines:
            if (
                line.lower() not in nav_items
                and len(line) > 8
                and len(line) < 200
                and not re.match(r"^\$", line)
                and not re.match(r"^(Georgia Ballet|Box Office|Email|Select|Filter|Regular Price|Event date)", line, re.IGNORECASE)
                and not re.match(r"^\d{1,2}\s+(January|February|March|April|May|June|July|August|September|October|November|December)", line, re.IGNORECASE)
                and not re.match(r"^\d{1,2}(?::\d{2})?\s*(am|pm)", line, re.IGNORECASE)
            ):
                title = line
                break

        # Extract description — multi-line block between nav and date schedule
        description = None
        desc_lines = []
        in_desc = False
        for line in lines:
            if title and line == title:
                in_desc = True
                continue
            if not in_desc:
                continue
            if re.match(r"^Select time|^Filter|^\d{1,2}\s+(January|February|March|April|May|June|July|August|September|October|November|December)|^(Friday|Saturday|Sunday|Monday|Tuesday|Wednesday|Thursday)\b|^Georgia Ballet", line, re.IGNORECASE):
                break
            if len(line) > 20:
                desc_lines.append(line)
        if desc_lines:
            description = " ".join(desc_lines)[:500]

        # Extract price range
        price_min, price_max, _, is_free = _parse_price_from_text(body_text)

        # Parse performance dates/times using line-based approach
        matched_perfs = _parse_ovationtix_perfs(body_text)

        # Filter to future performances
        for date_str, time_str in matched_perfs:
            try:
                if datetime.strptime(date_str, "%Y-%m-%d").date() < datetime.now().date():
                    continue
            except ValueError:
                continue

            performances.append({
                "date": date_str,
                "time": time_str,
                "title": title,
                "description": description,
                "price_min": price_min,
                "price_max": price_max,
                "is_free": is_free,
                "ticket_url": prod_url,
            })

    except PlaywrightTimeoutError:
        logger.warning(f"Georgia Ballet: timeout scraping OvationTix {prod_url}")
    except Exception as e:
        logger.warning(f"Georgia Ballet: error scraping OvationTix {prod_url}: {e}")

    return performances


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl The Georgia Ballet performances from their Wix site + OvationTix."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
                viewport={"width": 1280, "height": 900},
            )
            page = context.new_page()

            # Create venue records
            jta_venue_id = get_or_create_venue(JTA_VENUE_DATA)
            studio_venue_id = get_or_create_venue(STUDIO_VENUE_DATA)

            logger.info(f"Georgia Ballet: fetching events page {EVENTS_URL}")
            page.goto(EVENTS_URL, wait_until="networkidle", timeout=30000)
            page.wait_for_timeout(3000)

            # Collect all OvationTix production URLs from events page
            html_content = page.content()
            ovationtix_prod_urls = re.findall(
                rf"https://ci\.ovationtix\.com/{OVATIONTIX_ORG_ID}/production/(\d+)",
                html_content,
            )
            ovationtix_prod_ids = list(dict.fromkeys(ovationtix_prod_urls))  # deduplicate, preserve order

            logger.info(f"Georgia Ballet: found {len(ovationtix_prod_ids)} OvationTix productions")

            # Get the events page body text for context (titles, descriptions)
            events_page_text = page.inner_text("body")

            # Also check the season page for additional show info
            logger.info(f"Georgia Ballet: fetching season page {SEASON_URL}")
            page.goto(SEASON_URL, wait_until="networkidle", timeout=30000)
            page.wait_for_timeout(2000)
            season_page_text = page.inner_text("body")

            # Extract season production descriptions from season page
            # These are the 2026-2027 season shows without specific dates yet
            season_productions: list[dict] = []

            # Parse show blocks from season page text
            # Pattern: show title followed by description text
            season_show_patterns = [
                ("Firebird", r"Firebird.*?(?=The Nutcracker|\Z)", re.DOTALL),
                ("Firebird & Carmen", r"Firebird\s*&\s*Carmen.*?(?=The Nutcracker|\Z)", re.DOTALL),
                ("The Nutcracker", r"The Nutcracker.*?(?=The Sleeping Beauty|Sleeping Beauty|\Z)", re.DOTALL),
                ("The Sleeping Beauty", r"(?:The\s+)?Sleeping Beauty.*?$", re.DOTALL),
            ]
            for show_name, pattern, flags in season_show_patterns:
                m = re.search(pattern, season_page_text, flags)
                if m:
                    desc = m.group(0)[:400].strip()
                    season_productions.append({"title": show_name, "description": desc})

            # Process each OvationTix production page
            for prod_id in ovationtix_prod_ids:
                prod_url = f"https://ci.ovationtix.com/{OVATIONTIX_ORG_ID}/production/{prod_id}"
                logger.info(f"Georgia Ballet: scraping OvationTix production {prod_id}")

                performances = _scrape_ovationtix_production(page, prod_url)

                if not performances:
                    logger.debug(f"Georgia Ballet: no performances found for production {prod_id}")
                    continue

                # Use the title from OvationTix, enriched with season page descriptions if available
                for perf in performances:
                    title = perf.get("title") or "Georgia Ballet Performance"

                    # Try to enrich description from season page
                    description = perf.get("description")
                    if not description:
                        for season_prod in season_productions:
                            if any(
                                word in title.lower()
                                for word in season_prod["title"].lower().split()
                            ):
                                description = season_prod["description"]
                                break

                    # Determine venue — check if it's a studio or JTA performance
                    title_lower = title.lower()
                    description_lower = (description or "").lower()
                    if any(
                        indicator in title_lower or indicator in description_lower
                        for indicator in ["in-studio", "studio performance", "up close", "dancers up close", "black box"]
                    ):
                        venue_id = studio_venue_id
                        venue_name = "The Georgia Ballet"
                    else:
                        venue_id = jta_venue_id
                        venue_name = "Jennie T. Anderson Theatre"

                    start_date = perf["date"]
                    start_time = perf.get("time")
                    ticket_url = perf.get("ticket_url", prod_url)

                    # Build tags
                    tags = ["georgia-ballet", "ballet", "dance", "performing-arts", "marietta", "classical"]
                    if "nutcracker" in title.lower():
                        tags.extend(["nutcracker", "holiday", "family-friendly"])
                    if "firebird" in title.lower() or "carmen" in title.lower():
                        tags.extend(["classical-ballet", "stravinsky"])
                    if "sleeping beauty" in title.lower():
                        tags.extend(["classical-ballet", "tchaikovsky"])
                    if "sensory" in title.lower():
                        tags.extend(["sensory-friendly", "accessible"])

                    events_found += 1
                    content_hash = generate_content_hash(title, venue_name, start_date)

                    event_record = {
                        "source_id": source_id,
                        "venue_id": venue_id,
                        "title": title,
                        "description": description,
                        "start_date": start_date,
                        "start_time": start_time,
                        "end_date": None,
                        "end_time": None,
                        "is_all_day": False,
                        "category": "theater",
                        "subcategory": "ballet",
                        "tags": tags,
                        "price_min": perf.get("price_min"),
                        "price_max": perf.get("price_max"),
                        "price_note": None,
                        "is_free": perf.get("is_free", False),
                        "source_url": EVENTS_URL,
                        "ticket_url": ticket_url,
                        "image_url": None,
                        "raw_text": f"{title} — {start_date}",
                        "extraction_confidence": 0.88,
                        "is_recurring": False,
                        "recurrence_rule": None,
                        "content_hash": content_hash,
                    }

                    existing = find_event_by_hash(content_hash)
                    if existing:
                        smart_update_existing_event(existing, event_record)
                        events_updated += 1
                        continue

                    try:
                        insert_event(event_record)
                        events_new += 1
                        logger.info(
                            f"Georgia Ballet: added '{title}' on {start_date} at {start_time} ({venue_name})"
                        )
                    except Exception as e:
                        logger.error(
                            f"Georgia Ballet: failed to insert '{title}' on {start_date}: {e}"
                        )

            browser.close()

    except Exception as e:
        logger.error(f"Georgia Ballet: crawl failed: {e}")
        raise

    logger.info(
        f"Georgia Ballet crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
    )
    return events_found, events_new, events_updated
