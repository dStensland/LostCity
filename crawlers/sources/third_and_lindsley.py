"""
Crawler for 3rd & Lindsley (3rdandlindsley.com/calendar).

Nashville music venue and bar/grill in SoBro district.
Uses TicketWeb calendar widget — event data lives in a JavaScript `all_events`
array, not in static HTML. We extract directly from JS for reliable times.
"""

from __future__ import annotations

import json
import re
import logging
from typing import Optional

from playwright.sync_api import sync_playwright
from bs4 import BeautifulSoup

from db import get_or_create_place, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash
from utils import enrich_event_record

logger = logging.getLogger(__name__)

BASE_URL = "https://www.3rdandlindsley.com"
CALENDAR_URL = f"{BASE_URL}/calendar/"

PLACE_DATA = {
    "name": "3rd & Lindsley",
    "slug": "third-and-lindsley",
    "address": "818 3rd Ave S",
    "neighborhood": "SoBro",
    "city": "Nashville",
    "state": "TN",
    "zip": "37210",
    "lat": 36.1499,
    "lng": -86.7742,
    "venue_type": "music_venue",
    "website": BASE_URL,
}


def parse_time(time_text: str) -> Optional[str]:
    """Parse time from '7:00 PM' or 'Doors: 6:00 PM' format to HH:MM."""
    match = re.search(r"(\d{1,2}):(\d{2})\s*(am|pm)", time_text, re.IGNORECASE)
    if match:
        hour, minute, period = match.groups()
        hour = int(hour)
        if period.lower() == "pm" and hour != 12:
            hour += 12
        elif period.lower() == "am" and hour == 12:
            hour = 0
        return f"{hour:02d}:{minute}"
    return None


def extract_image_url(image_html: str) -> Optional[str]:
    """Extract src from an <img> HTML string."""
    if not image_html:
        return None
    soup = BeautifulSoup(image_html, "html.parser")
    img = soup.find("img")
    if img and img.get("src"):
        src = img["src"]
        return src if src.startswith("http") else None
    return None


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl 3rd & Lindsley events by extracting the JS all_events array."""
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

            venue_id = get_or_create_place(PLACE_DATA)

            logger.info(f"Fetching 3rd & Lindsley: {CALENDAR_URL}")
            page.goto(CALENDAR_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(3000)

            # Extract the all_events JS array directly from the page
            raw_events = page.evaluate("""
                () => {
                    if (typeof all_events !== 'undefined' && Array.isArray(all_events)) {
                        return all_events.map(e => ({
                            id: e.id || null,
                            start: e.start || null,
                            title: e.title || null,
                            doors: e.doors || null,
                            displayTime: e.displayTime || null,
                            imageUrl: e.imageUrl || null,
                            allDay: e.allDay || false,
                            url: e.url || null,
                        }));
                    }
                    return [];
                }
            """)

            if not raw_events:
                logger.warning("No events found in all_events JS array")
                browser.close()
                return 0, 0, 0

            logger.info(f"Extracted {len(raw_events)} events from JS")

            # Also scrape the rendered HTML for event detail dialogs
            # (TicketWeb renders these after JS executes)
            page.wait_for_timeout(2000)
            html = page.content()
            soup = BeautifulSoup(html, "html.parser")

            # Build a map of dialog content by event ID
            dialog_data: dict[str, dict] = {}
            for dialog in soup.find_all("div", id=re.compile(r"tw-event-dialog-\d+")):
                eid = re.search(r"tw-event-dialog-(\d+)", dialog.get("id", ""))
                if not eid:
                    continue
                eid = eid.group(1)
                info: dict = {}

                # Description
                desc_elem = dialog.find(["div", "p"], class_=re.compile(r"tw-desc|tw-description|tw-event-desc"))
                if desc_elem:
                    info["description"] = desc_elem.get_text(strip=True)[:500]

                # Ticket URL
                ticket_link = dialog.find("a", class_=re.compile(r"tw-buy|tw-ticket|tw-button"))
                if ticket_link and ticket_link.get("href"):
                    href = ticket_link["href"]
                    if href.startswith("http"):
                        info["ticket_url"] = href

                # Price
                price_elem = dialog.find(["span", "div"], class_=re.compile(r"tw-price|price"))
                if price_elem:
                    price_text = price_elem.get_text(strip=True)
                    price_match = re.search(r"\$(\d+(?:\.\d{2})?)", price_text)
                    if price_match:
                        info["price_min"] = float(price_match.group(1))

                if info:
                    dialog_data[eid] = info

            if dialog_data:
                logger.info(f"Found {len(dialog_data)} event dialogs with extra data")

            for evt in raw_events:
                try:
                    title = evt.get("title") or ""
                    # Strip HTML from title if present
                    if "<" in title:
                        title = BeautifulSoup(title, "html.parser").get_text(strip=True)
                    title = title.strip()
                    if not title:
                        continue

                    start_date = evt.get("start")
                    if not start_date or not re.match(r"\d{4}-\d{2}-\d{2}", start_date):
                        continue

                    # Parse show time from displayTime ("Show: 7:30 PM")
                    start_time = None
                    doors_time = None
                    if evt.get("displayTime"):
                        start_time = parse_time(evt["displayTime"])
                    if evt.get("doors"):
                        doors_time = parse_time(evt["doors"])

                    # If no show time but have doors, use doors as start_time
                    if not start_time and doors_time:
                        start_time = doors_time

                    # Extract image URL from HTML string
                    image_url = extract_image_url(evt.get("imageUrl") or "")

                    # Get dialog extras
                    eid = evt.get("id") or ""
                    extras = dialog_data.get(eid, {})

                    events_found += 1
                    content_hash = generate_content_hash(title, "3rd & Lindsley", start_date)

                    event_record = {
                        "source_id": source_id,
                        "venue_id": venue_id,
                        "title": title,
                        "description": extras.get("description"),
                        "start_date": start_date,
                        "start_time": start_time,
                        "doors_time": doors_time,
                        "end_date": None,
                        "end_time": None,
                        "is_all_day": False,
                        "category": "music",
                        "subcategory": "concert",
                        "tags": ["3rd-and-lindsley", "nashville", "live-music", "sobro"],
                        "price_min": extras.get("price_min"),
                        "price_max": extras.get("price_min"),
                        "price_note": None,
                        "is_free": None,
                        "source_url": CALENDAR_URL,
                        "ticket_url": extras.get("ticket_url"),
                        "image_url": image_url,
                        "raw_text": f"{title} - {start_date}",
                        "extraction_confidence": 0.95,
                        "is_recurring": False,
                        "recurrence_rule": None,
                        "content_hash": content_hash,
                    }

                    # Determine is_free
                    desc_lower = (event_record.get("description") or "").lower()
                    title_lower = title.lower()
                    combined = f"{title_lower} {desc_lower}"
                    if any(kw in combined for kw in ["free", "no cost", "no charge", "complimentary"]):
                        event_record["is_free"] = True
                        event_record["price_min"] = event_record.get("price_min") or 0
                        event_record["price_max"] = event_record.get("price_max") or 0
                    else:
                        event_record["is_free"] = False

                    existing = find_event_by_hash(content_hash)
                    if existing:
                        smart_update_existing_event(existing, event_record)
                        events_updated += 1
                        continue

                    try:
                        insert_event(event_record)
                        events_new += 1
                        logger.info(f"Added: {title} on {start_date} at {start_time or 'TBA'}")
                    except Exception as e:
                        logger.error(f"Failed to insert: {title}: {e}")

                except Exception as e:
                    logger.error(f"Failed to parse event: {e}")
                    continue

            browser.close()

        logger.info(
            f"3rd & Lindsley crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl 3rd & Lindsley: {e}")
        raise

    return events_found, events_new, events_updated
