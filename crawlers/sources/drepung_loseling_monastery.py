"""
Crawler for Drepung Loseling Monastery (drepung.org).
https://www.drepung.org/changing/Calendar/Current.htm

American seat of Drepung Loseling Monastery in Toco Hills.
Events include weekly meditation sessions, Buddhist lectures, Medicine Buddha practice,
special celebrations (Losar), and Foundation Series courses.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime
from typing import Optional

from playwright.sync_api import sync_playwright
from bs4 import BeautifulSoup

from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://www.drepung.org"
CALENDAR_URL = f"{BASE_URL}/changing/Calendar/Current.htm"

VENUE_DATA = {
    "name": "Drepung Loseling Monastery",
    "slug": "drepung-loseling-monastery",
    "address": "1781 Dresden Dr NE",
    "neighborhood": "Toco Hills",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30319",
    "lat": 33.8096,
    "lng": -84.3157,
    "venue_type": "monastery",
    "spot_type": "community_center",
    "website": BASE_URL,
    "vibes": ["faith-buddhist", "intimate", "all-ages"],
}


def parse_time(time_text: str) -> Optional[str]:
    """Parse time from formats like '6:00 pm', '11:00 am', '9:30 am'."""
    match = re.search(r"(\d{1,2})(?::(\d{2}))?\s*(am|pm)", time_text, re.IGNORECASE)
    if match:
        hour = int(match.group(1))
        minute = match.group(2) or "00"
        period = match.group(3).lower()

        if period == "pm" and hour != 12:
            hour += 12
        elif period == "am" and hour == 12:
            hour = 0

        return f"{hour:02d}:{minute}"
    return None


def determine_category_and_series(title: str, description: str) -> tuple[str, Optional[str], list[str], Optional[dict]]:
    """Determine category, subcategory, tags, and series hint based on event content."""
    text = f"{title} {description}".lower()
    tags = ["faith-buddhist", "meditation", "tibetan-buddhism"]

    # Weekly recurring meditation sessions
    if "sunday meditation" in text:
        return "wellness", None, tags + ["sunday"], {
            "series_type": "recurring_show",
            "series_title": "Sunday Meditation Practice",
            "frequency": "weekly",
            "day_of_week": "Sunday",
            "description": "Weekly Sunday meditation at Drepung Loseling Monastery",
        }

    if "vajrasattva practice" in text:
        return "wellness", None, tags + ["advanced", "empowerment-required"], {
            "series_type": "recurring_show",
            "series_title": "Vajrasattva Practice",
            "frequency": "weekly",
            "day_of_week": "Sunday",
            "description": "Weekly Vajrasattva practice (empowerment required)",
        }

    if "medicine buddha" in text:
        return "wellness", None, tags + ["healing", "tuesday"], {
            "series_type": "recurring_show",
            "series_title": "Medicine Buddha Practice",
            "frequency": "weekly",
            "day_of_week": "Tuesday",
            "description": "Weekly Medicine Buddha healing practice",
        }

    if "evening prayers" in text or "protector puja" in text:
        return "wellness", None, tags + ["prayer", "monks"], None

    # Learning events
    if any(kw in text for kw in ["lecture", "talk", "teaching", "foundation series", "course"]):
        tags.append("learning")

        # Check for Foundation Series
        if "foundation series" in text:
            tags.append("course")
            return "learning", None, tags, {
                "series_type": "workshop",
                "series_title": "Foundation Series",
                "description": "Multi-part Foundation Series course",
            }

        # Check for lecture series
        if "37 practices" in text or "bodhisattva" in text:
            return "learning", None, tags + ["lecture-series"], {
                "series_type": "workshop",
                "series_title": "The 37 Practices of a Bodhisattva",
                "description": "Multi-part lecture series on the 37 Practices of a Bodhisattva",
            }

        if "dalai lama" in text:
            tags.append("dalai-lama")

        return "learning", None, tags, None

    # Special celebrations
    if "losar" in text or "tibetan new year" in text:
        return "community", "celebration", tags + ["losar", "new-year"], None

    if "tsok" in text:
        return "wellness", None, tags + ["offering"], None

    # Default to wellness for meditation-related events
    return "wellness", None, tags, None


def extract_events_from_calendar(html_content: str, current_month: int, current_year: int) -> list[dict]:
    """Parse the calendar HTML table and extract events."""
    soup = BeautifulSoup(html_content, "lxml")
    events = []

    # Find the calendar table
    calendar_table = soup.find("table", {"border": "1"})
    if not calendar_table:
        logger.warning("Could not find calendar table")
        return events

    # Process each week row (skip header rows)
    rows = calendar_table.find_all("tr", class_="content-box")

    for row in rows:
        cells = row.find_all("td")

        # Get the date row above this content row
        date_row = row.find_previous_sibling("tr", class_="dates-bar")
        if not date_row:
            continue

        date_cells = date_row.find_all("td")

        # Process each day cell
        for idx, cell in enumerate(cells):
            if idx >= len(date_cells):
                break

            # Get the date from the corresponding date cell
            date_text = date_cells[idx].get_text(strip=True)

            # Parse day number
            day_match = re.search(r"(\d{1,2})", date_text)
            if not day_match:
                continue

            day = int(day_match.group(1))

            # Adjust month/year for dates that might be from previous/next month
            month = current_month
            year = current_year

            if "Jan" in date_text or "March" in date_text:
                # Handle month transitions
                if "Jan" in date_text and month == 2:
                    month = 1
                elif "March" in date_text and month == 2:
                    month = 3

            # Skip if day is dimmed (previous/next month) and no explicit month indicator
            if "dates-bar-dimmed" in str(date_cells[idx].get("class", [])) and "March" in date_text:
                continue

            try:
                event_date = datetime(year, month, day)
            except ValueError:
                continue

            # Skip past events
            if event_date.date() < datetime.now().date():
                continue

            date_str = event_date.strftime("%Y-%m-%d")

            # Extract event text from cell
            cell_text = cell.get_text(separator="\n", strip=True)

            # Skip empty cells or cells with just holiday markers
            if not cell_text or len(cell_text) < 10:
                continue

            # Skip cells that only have "Center is closed"
            if "center is closed" in cell_text.lower() and len(cell_text) < 50:
                continue

            # Split into individual events (usually separated by time markers)
            event_blocks = re.split(r"\n(?=\d{1,2}:\d{2}\s*(?:am|pm))", cell_text, flags=re.IGNORECASE)

            for block in event_blocks:
                if len(block.strip()) < 15:
                    continue

                # Extract time
                time_match = re.search(r"(\d{1,2}:\d{2}\s*(?:am|pm))", block, re.IGNORECASE)
                if not time_match:
                    continue

                start_time = parse_time(time_match.group(1))

                # Extract event title (text after the time)
                # Remove the time and everything before it
                title_text = re.sub(r"^.*?\d{1,2}:\d{2}\s*(?:am|pm)\s*", "", block, flags=re.IGNORECASE)

                # Clean up the title
                lines = [l.strip() for l in title_text.split("\n") if l.strip()]
                if not lines:
                    continue

                # First line is usually the title
                title = lines[0]

                # Remove location indicators from title
                title = re.sub(r"\s*In Person.*$", "", title, flags=re.IGNORECASE)
                title = re.sub(r"\s*Via\s+ZOOM.*$", "", title, flags=re.IGNORECASE)
                title = re.sub(r"\s*Livestream.*$", "", title, flags=re.IGNORECASE)
                title = re.sub(r"\s*\u2022.*$", "", title)  # Remove bullet points and what follows
                title = re.sub(r"\s*by\s+.*$", "", title, flags=re.IGNORECASE)  # Remove "by [person]"
                title = title.strip()

                if not title or len(title) < 5:
                    continue

                # Skip if title is just a holy day marker
                if title.lower() in ["full moon", "new moon", "tsok day"]:
                    continue

                # Build description from remaining lines
                description_parts = []
                for line in lines[1:]:
                    # Skip location/streaming info
                    if any(kw in line.lower() for kw in ["in person", "via zoom", "livestream", "click here"]):
                        continue
                    if len(line) > 10:
                        description_parts.append(line)
                        if len(description_parts) >= 3:
                            break

                description = " ".join(description_parts) if description_parts else title

                events.append({
                    "title": title,
                    "description": description,
                    "start_date": date_str,
                    "start_time": start_time,
                    "raw_text": block[:500],
                })

    return events


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Drepung Loseling Monastery calendar using Playwright."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
                viewport={"width": 1920, "height": 1080},
            )
            page = context.new_page()

            venue_id = get_or_create_venue(VENUE_DATA)

            logger.info(f"Fetching Drepung Loseling Monastery calendar: {CALENDAR_URL}")
            page.goto(CALENDAR_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(2000)

            # Get the HTML content
            html_content = page.content()

            # Extract month and year from page title
            title_text = page.title()
            month_match = re.search(r"(January|February|March|April|May|June|July|August|September|October|November|December)\s+-\s+(\d{4})", title_text)

            if month_match:
                month_name = month_match.group(1)
                year = int(month_match.group(2))
                month = datetime.strptime(month_name, "%B").month
            else:
                # Default to current month
                now = datetime.now()
                month = now.month
                year = now.year

            logger.info(f"Parsing calendar for {month}/{year}")

            # Parse events from calendar
            events = extract_events_from_calendar(html_content, month, year)
            logger.info(f"Extracted {len(events)} potential events from calendar")

            seen_events = set()

            for event_data in events:
                try:
                    title = event_data["title"]
                    start_date = event_data["start_date"]

                    # Dedupe by title + date
                    event_key = f"{title}|{start_date}"
                    if event_key in seen_events:
                        continue
                    seen_events.add(event_key)

                    events_found += 1

                    # Generate content hash
                    content_hash = generate_content_hash(
                        title, "Drepung Loseling Monastery", start_date
                    )

                    # Check for existing

                    # Determine category and tags
                    category, subcategory, tags, series_hint = determine_category_and_series(
                        title, event_data.get("description", "")
                    )

                    event_record = {
                        "source_id": source_id,
                        "venue_id": venue_id,
                        "title": title[:200],
                        "description": event_data.get("description", "")[:1000],
                        "start_date": start_date,
                        "start_time": event_data.get("start_time"),
                        "end_date": None,
                        "end_time": None,
                        "is_all_day": False,
                        "category": category,
                        "subcategory": subcategory,
                        "tags": tags,
                        "price_min": None,
                        "price_max": None,
                        "price_note": "Free - donations welcome",
                        "is_free": True,
                        "source_url": CALENDAR_URL,
                        "ticket_url": CALENDAR_URL,
                        "image_url": None,
                        "raw_text": event_data.get("raw_text", "")[:500],
                        "extraction_confidence": 0.80,
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
                        logger.info(f"Added: {title[:50]}... on {start_date}")
                    except Exception as e:
                        logger.error(f"Failed to insert: {title}: {e}")

                except Exception as e:
                    logger.error(f"Error processing event: {e}")
                    continue

            browser.close()

        logger.info(
            f"Drepung Loseling crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Drepung Loseling Monastery: {e}")
        raise

    return events_found, events_new, events_updated
