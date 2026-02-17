"""
Crawler for GriefShare grief support groups in Atlanta metro area.
https://find.griefshare.org - national directory with location search

GriefShare is a church-based grief support program (13-week cycles).
Category: wellness
Tags: support-group, free, faith-based

IMPORTANT: This is a SUPPORT GROUP crawler - events are stored but NOT
surfaced in public feeds initially. These are sensitive community resources.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime, timedelta
from typing import Optional

from playwright.sync_api import sync_playwright

from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://find.griefshare.org"
SEARCH_URL = "https://www.griefshare.org/findagroup"

# Atlanta metro zip codes to search
ATLANTA_ZIPS = [
    "30308",  # Midtown
    "30309",  # Midtown
    "30318",  # West Midtown
    "30303",  # Downtown
    "30316",  # East Atlanta
    "30312",  # Sweet Auburn
    "30306",  # Virginia Highland
    "30307",  # Little Five Points
    "30324",  # Buckhead
    "30305",  # Buckhead
    "30319",  # Brookhaven
    "30030",  # Decatur
    "30033",  # Decatur
    "30092",  # Dunwoody
    "30068",  # Marietta
    "30075",  # Roswell
    "30084",  # Tucker
]


def parse_date_string(date_str: str) -> Optional[str]:
    """
    Parse date from GriefShare format.
    Examples:
      - "Sunday, February 15"
      - "Wednesday, February 11"
    Returns YYYY-MM-DD format or None.
    """
    if not date_str:
        return None

    current_year = datetime.now().year

    # Format: "Day, Month DD"
    match = re.search(
        r"(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),\s+"
        r"(January|February|March|April|May|June|July|August|September|October|November|December)\s+"
        r"(\d{1,2})",
        date_str,
        re.IGNORECASE
    )
    if match:
        month = match.group(2)
        day = int(match.group(3))
        try:
            dt = datetime.strptime(f"{month} {day} {current_year}", "%B %d %Y")
            # If date is in the past, assume next year
            if dt.date() < datetime.now().date():
                dt = datetime.strptime(f"{month} {day} {current_year + 1}", "%B %d %Y")
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            pass

    return None


def parse_time_range(time_str: str) -> tuple[Optional[str], Optional[str]]:
    """
    Parse time range from GriefShare format.
    Examples:
      - "11:15am–12:45pm ET"
      - "7–8:30pm ET"
      - "6:30–8:30pm ET"
    Returns (start_time, end_time) in HH:MM format.
    """
    if not time_str:
        return None, None

    # Match patterns like "7–8:30pm", "11:15am–12:45pm"
    match = re.search(
        r"(\d{1,2})(?::(\d{2}))?(am|pm)?\s*[–-]\s*(\d{1,2})(?::(\d{2}))?(am|pm)",
        time_str,
        re.IGNORECASE
    )
    if match:
        start_hour = int(match.group(1))
        start_min = match.group(2) or "00"
        start_period = match.group(3) or match.group(6)  # Use end period if start not specified
        end_hour = int(match.group(4))
        end_min = match.group(5) or "00"
        end_period = match.group(6)

        # Convert to 24-hour format
        if start_period.lower() == "pm" and start_hour != 12:
            start_hour += 12
        elif start_period.lower() == "am" and start_hour == 12:
            start_hour = 0

        if end_period.lower() == "pm" and end_hour != 12:
            end_hour += 12
        elif end_period.lower() == "am" and end_hour == 12:
            end_hour = 0

        start_time = f"{start_hour:02d}:{start_min}"
        end_time = f"{end_hour:02d}:{end_min}"
        return start_time, end_time

    return None, None


def parse_date_range(range_str: str) -> tuple[Optional[str], Optional[str]]:
    """
    Parse date range to get start and end dates.
    Examples:
      - "February 1–May 3, 2026"
      - "January 14–April 8, 2026"
    Returns (start_date, end_date) in YYYY-MM-DD format.
    """
    if not range_str:
        return None, None

    match = re.search(
        r"(January|February|March|April|May|June|July|August|September|October|November|December)\s+"
        r"(\d{1,2})\s*[–-]\s*"
        r"(January|February|March|April|May|June|July|August|September|October|November|December)\s+"
        r"(\d{1,2}),?\s*"
        r"(\d{4})",
        range_str,
        re.IGNORECASE
    )
    if match:
        start_month = match.group(1)
        start_day = int(match.group(2))
        end_month = match.group(3)
        end_day = int(match.group(4))
        year = int(match.group(5))

        try:
            start_date = datetime.strptime(f"{start_month} {start_day} {year}", "%B %d %Y")
            end_date = datetime.strptime(f"{end_month} {end_day} {year}", "%B %d %Y")
            return start_date.strftime("%Y-%m-%d"), end_date.strftime("%Y-%m-%d")
        except ValueError:
            pass

    return None, None


def parse_address_line(addr_line: str) -> tuple[str, str, str]:
    """
    Parse address line to extract street, city, state.
    Examples:
      - "Atlanta, GA" -> ("", "Atlanta", "GA")
      - "240 Maynard Terrace SE, Atlanta, GA" -> ("240 Maynard Terrace SE", "Atlanta", "GA")
    """
    # Pattern: "street, city, state" or "city, state"
    parts = [p.strip() for p in addr_line.split(',')]

    if len(parts) >= 2:
        state = parts[-1].strip()
        city = parts[-2].strip()
        street = ', '.join(parts[:-2]).strip() if len(parts) > 2 else ""
        return street, city, state

    return "", "", ""


def parse_groups_from_text(text_lines: list[str]) -> list[dict]:
    """
    Parse group information from extracted text lines.

    Expected pattern (repeating):
      - "GRIEFSHARE GROUP"
      - Format line ("In-person", "Online", "Hybrid")
      - Day/time line (e.g., "Sunday, February 15 11:15am–12:45pm ET")
      - Date range line (e.g., "February 1–May 3, 2026")
      - Optional: "Childcare"
      - Distance line (e.g., "2.4 mi") [only for in-person]
      - Church name
      - Address line (city, state or full address)
    """
    groups = []
    i = 0

    while i < len(text_lines):
        line = text_lines[i]

        # Look for "GRIEFSHARE GROUP" marker
        if "GRIEFSHARE GROUP" in line.upper():
            try:
                group_data = {}
                i += 1

                # Format (In-person, Online, Hybrid)
                if i < len(text_lines):
                    format_line = text_lines[i]
                    group_data["format"] = format_line.strip()
                    i += 1

                # Day/time line
                if i < len(text_lines):
                    datetime_line = text_lines[i]
                    group_data["datetime_line"] = datetime_line
                    i += 1

                # Date range line
                if i < len(text_lines):
                    range_line = text_lines[i]
                    group_data["range_line"] = range_line
                    i += 1

                # Optional childcare indicator
                if i < len(text_lines) and "Childcare" in text_lines[i]:
                    group_data["childcare"] = True
                    i += 1
                else:
                    group_data["childcare"] = False

                # Optional distance (skip it)
                if i < len(text_lines) and re.search(r"\d+\.\d+\s*mi", text_lines[i]):
                    i += 1

                # Church name
                if i < len(text_lines):
                    church_name = text_lines[i].strip()
                    group_data["church_name"] = church_name
                    i += 1

                # Address line
                if i < len(text_lines):
                    addr_line = text_lines[i].strip()
                    group_data["address_line"] = addr_line
                    i += 1

                groups.append(group_data)

            except Exception as e:
                logger.debug(f"Error parsing group at line {i}: {e}")
                i += 1
        else:
            i += 1

    return groups


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl GriefShare directory for Atlanta metro area groups."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    all_groups = []
    seen_groups = set()  # (church_name, start_date) tuples

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
                viewport={"width": 1920, "height": 1080},
            )

            # Search multiple zip codes to ensure metro coverage
            for zip_code in ATLANTA_ZIPS[:5]:  # Limit to 5 searches to avoid overload
                logger.info(f"Searching GriefShare for zip: {zip_code}")

                page = context.new_page()
                page.goto(SEARCH_URL, wait_until="domcontentloaded", timeout=60000)
                page.wait_for_timeout(3000)

                # Enter zip code in search
                search_input = page.query_selector('input[placeholder="Postal code or city/state"]')
                if not search_input:
                    logger.warning(f"Search input not found for {zip_code}")
                    page.close()
                    continue

                search_input.fill(zip_code)
                search_input.press("Enter")

                # Wait for results to load
                try:
                    page.wait_for_selector("text=GriefShare Group", timeout=10000)
                except:
                    logger.warning(f"No results loaded for {zip_code}")
                    page.close()
                    continue

                page.wait_for_timeout(5000)

                # Scroll to load all results
                for _ in range(3):
                    page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                    page.wait_for_timeout(2000)

                # Extract all text from page
                body_text = page.inner_text("body")
                text_lines = [l.strip() for l in body_text.split("\n") if l.strip()]

                # Parse groups from text
                groups = parse_groups_from_text(text_lines)
                logger.info(f"Found {len(groups)} groups for zip {zip_code}")

                for group in groups:
                    church_name = group.get("church_name", "")
                    if not church_name:
                        continue

                    # Parse dates
                    datetime_line = group.get("datetime_line", "")
                    start_date = parse_date_string(datetime_line)

                    if not start_date:
                        logger.debug(f"No start date for {church_name}")
                        continue

                    # Dedupe across searches
                    group_key = (church_name, start_date)
                    if group_key in seen_groups:
                        continue
                    seen_groups.add(group_key)

                    all_groups.append(group)

                page.close()

            browser.close()

        # Now process all unique groups and create venue + event records
        logger.info(f"Processing {len(all_groups)} unique groups")

        for group in all_groups:
            try:
                church_name = group["church_name"]
                address_line = group.get("address_line", "")
                datetime_line = group.get("datetime_line", "")
                range_line = group.get("range_line", "")
                format_type = group.get("format", "In-person")
                has_childcare = group.get("childcare", False)

                # Parse address
                street, city, state = parse_address_line(address_line)

                # Skip if not in Georgia
                if state != "GA":
                    continue

                # Parse dates and times
                start_date = parse_date_string(datetime_line)
                start_time, end_time = parse_time_range(datetime_line)
                range_start, range_end = parse_date_range(range_line)

                if not start_date:
                    logger.debug(f"Skipping {church_name} - no start date")
                    continue

                # Create venue record
                venue_data = {
                    "name": church_name,
                    "slug": re.sub(r"[^a-z0-9]+", "-", church_name.lower()).strip("-"),
                    "address": street if street else None,
                    "city": city,
                    "state": state,
                    "venue_type": "church",
                    "spot_type": "church",
                    "vibes": ["faith-christian"],  # Using valid vibe from tags.py
                }

                venue_id = get_or_create_venue(venue_data)

                # Extract day of week for recurrence
                day_match = re.search(
                    r"(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)",
                    datetime_line,
                    re.IGNORECASE
                )
                day_of_week = day_match.group(1) if day_match else None
                recurrence_pattern = f"Weekly on {day_of_week}s" if day_of_week else None

                # Build event title
                title = f"GriefShare Support Group - {church_name}"

                # Check for existing event
                content_hash = generate_content_hash(title, church_name, start_date)
                existing = find_event_by_hash(content_hash)

                if existing:
                    events_updated += 1
                    events_found += 1
                    continue

                # Build tags
                tags = ["support-group", "grief", "faith-based", "free"]
                if has_childcare:
                    tags.append("childcare")
                if format_type == "Online":
                    tags.append("virtual")
                elif format_type == "Hybrid":
                    tags.extend(["virtual", "in-person"])

                # Build description
                description_parts = [
                    f"A 13-week GriefShare support group meeting {day_of_week}s at {church_name}."
                ]
                if has_childcare:
                    description_parts.append("Childcare is available.")
                if range_start and range_end:
                    description_parts.append(f"This session runs from {range_start} to {range_end}.")
                description_parts.append(
                    "GriefShare is a grief recovery support group where you can find help and healing. "
                    "You are welcome to join at any session."
                )
                description = " ".join(description_parts)

                # Create event record
                event_record = {
                    "source_id": source_id,
                    "venue_id": venue_id,
                    "title": title[:200],
                    "description": description[:1000],
                    "start_date": start_date,
                    "start_time": start_time,
                    "end_date": range_end,  # Session end date
                    "end_time": end_time,
                    "is_all_day": False,
                    "category": "wellness",
                    "subcategory": "support-group",
                    "tags": tags,
                    "price_min": None,
                    "price_max": None,
                    "price_note": "Free - donations welcome",
                    "is_free": True,
                    "source_url": SEARCH_URL,
                    "ticket_url": None,
                    "image_url": None,
                    "raw_text": f"{title} {description}"[:500],
                    "extraction_confidence": 0.9,
                    "is_recurring": True,
                    "recurrence_rule": recurrence_pattern,
                    "content_hash": content_hash,
                }

                insert_event(event_record)
                events_new += 1
                events_found += 1
                logger.info(f"Added: {church_name} on {start_date}")

            except Exception as e:
                logger.error(f"Failed to process group {group.get('church_name', 'unknown')}: {e}")
                continue

        logger.info(
            f"GriefShare crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl GriefShare: {e}")
        raise

    return events_found, events_new, events_updated
