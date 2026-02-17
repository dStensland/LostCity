"""
Crawler for City of Atlanta Government Meetings via IQM2.

Source: https://atlantacityga.iqm2.com/Citizens/Calendar.aspx

The IQM2 portal hosts the official City of Atlanta meeting calendar.
Each meeting row has a MeetingIcon with a title attribute containing
structured metadata: board name, meeting type, status, and location.

Meeting types include:
- Atlanta City Council Regular Meetings
- Committee meetings (Zoning, Finance, Transportation, etc.)
- Public hearings
- Special sessions

All meetings are free and open to the public.
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

BASE_URL = "https://atlantacityga.iqm2.com"
CALENDAR_URL = f"{BASE_URL}/Citizens/Calendar.aspx"

VENUE_DATA = {
    "name": "Atlanta City Hall",
    "slug": "atlanta-city-hall",
    "address": "55 Trinity Avenue",
    "neighborhood": "Downtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30303",
    "lat": 33.7490,
    "lng": -84.3903,
    "venue_type": "government",
    "spot_type": "government",
    "website": "https://www.atlantaga.gov",
}


def parse_time_string(time_str: str) -> Optional[str]:
    """Parse time string like '1:00 PM' to '13:00' format."""
    try:
        time_str = time_str.strip().upper()
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
    except (ValueError, AttributeError):
        pass
    return None


def parse_icon_title(title_text: str) -> dict:
    """
    Parse the MeetingIcon title attribute which contains structured meeting info.

    Example title:
    "MONDAY, JANUARY 5, 2026  1:00 PM
     Board:\tAtlanta City Council
     Type:\tRegular Meeting
     Status:\tScheduled
     \tMarvin S. Arrington, Sr. Council Chamber
     \tAtlanta City Hall, 55 Trinity Avenue, Atlanta, GA  30303"
    """
    info = {"board": "", "type": "", "status": "", "location": ""}

    if not title_text:
        return info

    # Extract board name
    board_match = re.search(r'Board:\s*(.+?)(?:\n|Type:)', title_text, re.DOTALL)
    if board_match:
        info["board"] = board_match.group(1).strip()

    # Extract meeting type
    type_match = re.search(r'Type:\s*(.+?)(?:\n|Status:)', title_text, re.DOTALL)
    if type_match:
        info["type"] = type_match.group(1).strip()

    # Extract status
    status_match = re.search(r'Status:\s*(\w+)', title_text)
    if status_match:
        info["status"] = status_match.group(1).strip()

    # Extract location (last lines after Status)
    location_match = re.search(r'Status:\s*\w+\s+(.+)', title_text, re.DOTALL)
    if location_match:
        info["location"] = location_match.group(1).strip().replace('\t', ' ').replace('\n', ', ')

    return info


def determine_series_hint(board: str, meeting_type: str) -> Optional[dict]:
    """Determine series grouping for recurring meetings."""
    name_lower = board.lower()

    if "city council" in name_lower:
        return {
            "series_type": "recurring_show",
            "series_title": f"Atlanta City Council {meeting_type}",
            "frequency": "monthly",
        }

    if "committee" in name_lower:
        return {
            "series_type": "recurring_show",
            "series_title": f"{board} {meeting_type}",
            "frequency": "monthly",
        }

    if "commission" in name_lower:
        return {
            "series_type": "recurring_show",
            "series_title": f"{board} {meeting_type}",
            "frequency": "monthly",
        }

    return None


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl City of Atlanta IQM2 calendar for upcoming government meetings."""
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

            logger.info(f"Fetching Atlanta IQM2 calendar: {CALENDAR_URL}")

            try:
                response = page.goto(CALENDAR_URL, wait_until="domcontentloaded", timeout=30000)
                if not response or response.status >= 400:
                    logger.error(f"Calendar returned status {response.status if response else 'none'}")
                    browser.close()
                    return 0, 0, 0

                page.wait_for_timeout(3000)
                html_content = page.content()

            except Exception as e:
                logger.error(f"Failed to load calendar page: {e}")
                browser.close()
                return 0, 0, 0
            finally:
                browser.close()

        soup = BeautifulSoup(html_content, "html.parser")

        # Each meeting is in a div.Row.MeetingRow
        meeting_rows = soup.find_all("div", class_="MeetingRow")
        if not meeting_rows:
            logger.warning("No MeetingRow elements found")
            return 0, 0, 0

        logger.info(f"Found {len(meeting_rows)} meeting rows")

        today = datetime.now().date()
        seen_events = set()

        for row in meeting_rows:
            try:
                # Extract date/time from the RowLink anchor
                row_link = row.find("div", class_="RowLink")
                if not row_link:
                    continue
                link = row_link.find("a", href=lambda h: h and "Detail_Meeting" in str(h))
                if not link:
                    continue

                date_time_text = link.get_text(strip=True)
                detail_href = link.get("href", "")
                detail_url = f"{BASE_URL}{detail_href}" if detail_href.startswith("/") else detail_href

                # Parse date: "Feb 16, 2026 1:00 PM"
                date_match = re.search(
                    r'(\w{3,9})\s+(\d{1,2}),?\s+(\d{4})\s+(\d{1,2}:\d{2}\s*[AP]M)',
                    date_time_text
                )
                if not date_match:
                    # Try without time
                    date_match = re.search(r'(\w{3,9})\s+(\d{1,2}),?\s+(\d{4})', date_time_text)
                    if not date_match:
                        continue

                month_str = date_match.group(1)
                day_str = date_match.group(2)
                year_str = date_match.group(3)
                time_str = date_match.group(4) if date_match.lastindex >= 4 else None

                try:
                    event_date = datetime.strptime(f"{month_str} {day_str} {year_str}", "%b %d %Y").date()
                except ValueError:
                    try:
                        event_date = datetime.strptime(f"{month_str} {day_str} {year_str}", "%B %d %Y").date()
                    except ValueError:
                        continue

                if event_date < today:
                    continue

                start_date = event_date.strftime("%Y-%m-%d")
                start_time = parse_time_string(time_str) if time_str else None

                # Extract meeting info from the MeetingIcon title attribute
                icon = row.find("img", class_="MeetingIcon")
                icon_title = icon.get("title", "") if icon else ""
                info = parse_icon_title(icon_title)

                # Also get meeting name from RowBottom
                row_bottom = row.find("div", class_="RowBottom")
                bottom_text = row_bottom.get_text(strip=True) if row_bottom else ""

                # Build title from board + type
                board = info["board"] or bottom_text.split(" - ")[0] if bottom_text else "Unknown"
                meeting_type = info["type"] or "Meeting"

                # Clean up the board name
                board = board.strip()
                if not board:
                    continue

                # Build title
                title = f"{board} — {meeting_type}"

                # Skip cancelled/postponed
                status = info.get("status", "").lower()
                if status in ("cancelled", "canceled", "postponed"):
                    logger.debug(f"Skipping {status}: {title} on {start_date}")
                    continue

                # Dedupe within this crawl
                event_key = f"{board}|{start_date}"
                if event_key in seen_events:
                    continue
                seen_events.add(event_key)

                events_found += 1

                # Build description
                desc_parts = [f"{board} {meeting_type} of the City of Atlanta."]
                if info["location"]:
                    desc_parts.append(f"Location: {info['location']}.")
                desc_parts.append("All meetings are open to the public.")
                description = " ".join(desc_parts)

                # Series hint
                series_hint = determine_series_hint(board, meeting_type)

                # Content hash
                content_hash = generate_content_hash(title, VENUE_DATA["name"], start_date)

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
                    "tags": ["government", "public-meeting", "civic-engagement", "atlanta"],
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

                existing = find_event_by_hash(content_hash)
                if existing:
                    smart_update_existing_event(existing, event_record)
                    events_updated += 1
                    continue

                insert_event(event_record, series_hint=series_hint)
                events_new += 1
                logger.info(f"Added: {title} on {start_date}")

            except Exception as e:
                logger.warning(f"Error parsing meeting row: {e}")
                continue

        logger.info(
            f"Atlanta City crawl complete: {events_found} found, "
            f"{events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Atlanta City meetings: {e}")
        raise

    return events_found, events_new, events_updated
