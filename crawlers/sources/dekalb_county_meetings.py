"""
Crawler for DeKalb County Government Meetings via Legistar.

Source: https://dekalbcountyga.legistar.com/Calendar.aspx
Events: Board of Commissioners meetings, public hearings, committee meetings, planning meetings

Legistar is a government meeting management platform used by many counties.
The calendar page shows a month view with meeting listings that can be scraped.

Meeting types include:
- Board of Commissioners meetings (monthly)
- Committee meetings (various committees)
- Public hearings on zoning, land use, budget
- Planning commission meetings

All meetings are free and open to the public.
"""

from __future__ import annotations

import re
import time
import logging
from datetime import datetime, timedelta
from typing import Optional
from urllib.parse import urljoin

from playwright.sync_api import sync_playwright
from bs4 import BeautifulSoup

from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash
from date_utils import parse_human_date

logger = logging.getLogger(__name__)

BASE_URL = "https://dekalbcountyga.legistar.com"
CALENDAR_URL = f"{BASE_URL}/Calendar.aspx"

VENUE_DATA = {
    "name": "Manuel J. Maloof Center",
    "slug": "manuel-j-maloof-center",
    "address": "1300 Commerce Dr",
    "neighborhood": "Decatur",
    "city": "Decatur",
    "state": "GA",
    "zip": "30030",
    "lat": 33.7748,
    "lng": -84.2963,
    "venue_type": "government",
    "spot_type": "government",
    "website": "https://www.dekalbcountyga.gov",
}


def parse_time_string(time_str: str) -> Optional[str]:
    """
    Parse time string to 24-hour format.
    Examples: '6:00 PM', '12:30 PM', '10:00 AM'
    """
    try:
        time_str = time_str.strip().upper()

        # If it's a range, extract the first time
        if '-' in time_str or '–' in time_str:
            time_str = re.split(r'[-–]', time_str)[0].strip()

        # Pattern: H:MM AM/PM
        match = re.search(r'(\d{1,2}):(\d{2})\s*(AM|PM)', time_str)
        if match:
            hour = int(match.group(1))
            minute = match.group(2)
            period = match.group(3)

            if period == "PM" and hour != 12:
                hour += 12
            elif period == "AM" and hour == 12:
                hour = 0

            return f"{hour:02d}:{minute}"

    except (ValueError, AttributeError) as e:
        logger.debug(f"Could not parse time '{time_str}': {e}")

    return None


def determine_series_hint(meeting_name: str) -> Optional[dict]:
    """
    Determine if a meeting is part of a recurring series.

    Examples:
    - "Board of Commissioners Regular Meeting" -> monthly recurring
    - "Planning Commission Meeting" -> monthly recurring
    - "Public Hearing" -> not a series (each is unique)
    """
    meeting_name_lower = meeting_name.lower()

    # Board of Commissioners meetings are monthly recurring
    if "board of commissioners" in meeting_name_lower and "regular" in meeting_name_lower:
        return {
            "series_type": "recurring_show",
            "series_title": "DeKalb County Board of Commissioners Regular Meeting",
            "frequency": "monthly",
        }

    # Committee meetings are typically monthly
    if "committee" in meeting_name_lower and "meeting" in meeting_name_lower:
        # Use the full committee name as the series title
        return {
            "series_type": "recurring_show",
            "series_title": meeting_name,
            "frequency": "monthly",
        }

    # Planning Commission meetings are monthly
    if "planning commission" in meeting_name_lower:
        return {
            "series_type": "recurring_show",
            "series_title": "DeKalb County Planning Commission Meeting",
            "frequency": "monthly",
        }

    # Public hearings and one-off meetings are not series
    return None


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl DeKalb County Legistar calendar for upcoming government meetings.

    Uses Playwright to load the calendar page and extract meeting data.
    """
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        venue_id = get_or_create_venue(VENUE_DATA)

        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
                viewport={"width": 1920, "height": 1080},
            )
            page = context.new_page()

            logger.info(f"Fetching DeKalb County Legistar calendar: {CALENDAR_URL}")

            try:
                response = page.goto(CALENDAR_URL, wait_until="domcontentloaded", timeout=30000)

                if not response or response.status >= 400:
                    logger.error(f"Calendar returned error status: {response.status if response else 'no response'}")
                    browser.close()
                    return 0, 0, 0

                # Wait for calendar to load
                page.wait_for_timeout(3000)

                # Try to load next month's meetings as well (look ahead 60 days)
                # Some Legistar sites have a "next month" button we can click
                try:
                    next_button = page.locator("text=Next")
                    if next_button.count() > 0:
                        next_button.first.click()
                        page.wait_for_timeout(2000)
                except Exception:
                    pass  # No next button or couldn't click it

                html_content = page.content()
                soup = BeautifulSoup(html_content, "html.parser")

            except Exception as e:
                logger.error(f"Failed to load calendar page: {e}")
                browser.close()
                return 0, 0, 0
            finally:
                browser.close()

        # Parse calendar events
        # Legistar typically uses a table structure with class names like:
        # - rgMasterTable (Telerik grid)
        # - CalendarDetails, MeetingRow

        # Look for meeting rows in the calendar
        meeting_rows = soup.select("tr.rgRow, tr.rgAltRow, tr[id*='CalendarRow'], tr[class*='MeetingRow']")

        if not meeting_rows:
            # Try generic table rows as fallback
            calendar_table = soup.find("table", {"class": re.compile(r"(rgMasterTable|CalendarTable)")})
            if calendar_table:
                meeting_rows = calendar_table.find_all("tr")[1:]  # Skip header row

        if not meeting_rows or len(meeting_rows) == 0:
            logger.warning("No meeting rows found in calendar")
            return 0, 0, 0

        logger.info(f"Found {len(meeting_rows)} potential meeting rows")

        today = datetime.now().date()
        seen_events = set()

        for row in meeting_rows:
            try:
                # Extract meeting name/body
                name_cell = row.find("td", {"class": re.compile(r"(EventName|MeetingBody)")})
                if not name_cell:
                    # Try to find the first cell with substantial text
                    cells = row.find_all("td")
                    name_cell = cells[0] if len(cells) > 0 else None

                if not name_cell:
                    continue

                meeting_name = name_cell.get_text(strip=True)

                # Skip empty rows or header rows
                if not meeting_name or len(meeting_name) < 3:
                    continue
                if meeting_name.lower() in ["meeting", "date", "time", "name", "body"]:
                    continue

                # Extract date
                date_cell = row.find("td", {"class": re.compile(r"(EventDate|MeetingDate)")})
                if not date_cell:
                    # Try to find a date in any cell
                    date_text = row.get_text()
                    date_match = re.search(r'\d{1,2}/\d{1,2}/\d{4}', date_text)
                    date_str = date_match.group(0) if date_match else None
                else:
                    date_str = date_cell.get_text(strip=True)

                if not date_str:
                    logger.debug(f"No date found for meeting: {meeting_name}")
                    continue

                start_date = parse_human_date(date_str)
                if not start_date:
                    logger.debug(f"Could not parse date '{date_str}' for: {meeting_name}")
                    continue

                # Skip past events
                try:
                    event_date = datetime.strptime(start_date, "%Y-%m-%d").date()
                    if event_date < today:
                        logger.debug(f"Skipping past meeting: {meeting_name} on {start_date}")
                        continue
                except ValueError:
                    continue

                # Extract time
                time_cell = row.find("td", {"class": re.compile(r"(EventTime|MeetingTime)")})
                time_str = time_cell.get_text(strip=True) if time_cell else None

                if not time_str:
                    # Try to find time in row text
                    time_match = re.search(r'\d{1,2}:\d{2}\s*[AP]M', row.get_text())
                    time_str = time_match.group(0) if time_match else None

                start_time = parse_time_string(time_str) if time_str else None

                # Extract location/room
                location_cell = row.find("td", {"class": re.compile(r"(EventLocation|MeetingLocation)")})
                location = location_cell.get_text(strip=True) if location_cell else None

                # Extract meeting details URL
                detail_link = row.find("a", href=re.compile(r"MeetingDetail\.aspx|Calendar\.aspx"))
                detail_url = urljoin(BASE_URL, detail_link["href"]) if detail_link else CALENDAR_URL

                # Dedupe check
                event_key = f"{meeting_name}|{start_date}"
                if event_key in seen_events:
                    continue
                seen_events.add(event_key)

                events_found += 1

                # Build event title
                title = meeting_name
                if not title.lower().endswith("meeting"):
                    title = f"{title} Meeting"

                # Build description
                description_parts = [f"{meeting_name} of DeKalb County Government."]
                if location:
                    description_parts.append(f"Location: {location}.")
                description_parts.append("All meetings are open to the public. Check the meeting agenda for public comment periods.")
                description = " ".join(description_parts)

                # Determine series hint
                series_hint = determine_series_hint(meeting_name)

                # Generate content hash
                content_hash = generate_content_hash(
                    title, VENUE_DATA["name"], start_date
                )

                # Check if already exists
                if find_event_by_hash(content_hash):
                    events_updated += 1
                    logger.debug(f"Event already exists: {title}")
                    continue

                # Create event record
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
                    "category": "community",
                    "tags": ["government", "public-meeting", "civic-engagement", "dekalb-county"],
                    "price_min": None,
                    "price_max": None,
                    "price_note": None,
                    "is_free": True,
                    "source_url": detail_url,
                    "ticket_url": None,
                    "image_url": None,
                    "is_recurring": bool(series_hint),
                    "content_hash": content_hash,
                }

                insert_event(event_record, series_hint=series_hint)
                events_new += 1
                logger.info(f"Added: {title} on {start_date}")

            except Exception as e:
                logger.warning(f"Error parsing meeting row: {e}")
                continue

        logger.info(
            f"DeKalb County crawl complete: {events_found} found, "
            f"{events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl DeKalb County meetings: {e}")
        raise

    return events_found, events_new, events_updated
