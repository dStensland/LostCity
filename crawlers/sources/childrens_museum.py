"""
Crawler for Children's Museum of Atlanta (childrensmuseumatlanta.org).
Interactive children's museum with family events and programs.

Site uses JavaScript to load calendar data - extracts from embedded JSON.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime, timedelta
from typing import Optional

from playwright.sync_api import sync_playwright

from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash
from utils import enrich_event_record, parse_date_range

logger = logging.getLogger(__name__)

BASE_URL = "https://childrensmuseumatlanta.org"
EVENTS_URL = f"{BASE_URL}/events/"

VENUE_DATA = {
    "name": "Children's Museum of Atlanta",
    "slug": "childrens-museum-atlanta",
    "address": "275 Centennial Olympic Park Dr NW",
    "neighborhood": "Downtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30313",
    "lat": 33.7625,
    "lng": -84.3933,
    "venue_type": "museum",
    "spot_type": "museum",
    "website": BASE_URL,
}


def parse_time(time_str: str) -> Optional[str]:
    """Parse time from various formats like '9:30am', '11:30 AM', '16:30'."""
    if not time_str:
        return None

    # Handle 24-hour format (e.g., "16:30")
    if re.match(r'^\d{2}:\d{2}$', time_str):
        return time_str

    # Handle 12-hour format (e.g., "9:30am", "11:30 AM")
    match = re.search(r'(\d{1,2}):(\d{2})\s*(am|pm)', time_str, re.IGNORECASE)
    if match:
        hour, minute, period = match.groups()
        hour = int(hour)
        if period.lower() == 'pm' and hour != 12:
            hour += 12
        elif period.lower() == 'am' and hour == 12:
            hour = 0
        return f"{hour:02d}:{minute}"

    return None


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Children's Museum events by extracting embedded calendar JSON."""
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

            logger.info(f"Fetching Children's Museum events: {EVENTS_URL}")
            page.goto(EVENTS_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(2000)

            # Extract the _cma_calendar JavaScript variable
            calendar_data = page.evaluate("""
                () => {
                    if (typeof _cma_calendar !== 'undefined') {
                        return _cma_calendar;
                    }
                    return null;
                }
            """)

            if not calendar_data:
                logger.error("Could not find _cma_calendar data on page")
                browser.close()
                return 0, 0, 0

            logger.info(f"Found calendar data: {len(calendar_data.get('preload', {}).get('special_programs', []))} special programs")

            # Process special programs (these are the main events)
            special_programs = calendar_data.get('preload', {}).get('special_programs', [])

            # Skip generic museum themes/exhibits that repeat daily -- not real events
            skip_titles = {
                "play at the museum",
                "black history month",
                "women's history month",
                "hispanic heritage month",
                "asian american pacific islander heritage month",
                "pride month",
                "museum open",
                "general admission",
            }

            for program in special_programs:
                try:
                    title = program.get('post_title', '').strip()
                    if not title:
                        continue

                    # Skip generic exhibit/theme titles
                    if title.lower() in skip_titles:
                        continue

                    start_date_str = program.get('start_date')
                    end_date_str = program.get('end_date')
                    permalink = program.get('permalink', EVENTS_URL)
                    description = program.get('post_content', '')
                    image_url = program.get('thumbnail_url')

                    # Clean up HTML from description
                    if description:
                        description = re.sub(r'<[^>]+>', ' ', description)
                        description = re.sub(r'\s+', ' ', description).strip()
                        if len(description) > 500:
                            description = description[:500] + "..."

                    if not start_date_str:
                        continue

                    # Parse dates
                    try:
                        start_date = datetime.strptime(start_date_str, "%Y-%m-%d").date()
                        end_date = datetime.strptime(end_date_str, "%Y-%m-%d").date() if end_date_str else start_date
                    except ValueError:
                        logger.warning(f"Could not parse dates for {title}: {start_date_str} - {end_date_str}")
                        continue

                    # Skip past events
                    if end_date < datetime.now().date():
                        continue

                    # Get session times
                    sessions = program.get('all_sessions', [])
                    start_time = None
                    end_time = None

                    if sessions and len(sessions) > 0:
                        first_session = sessions[0]
                        start_time = parse_time(first_session.get('start', ''))
                        end_time = parse_time(first_session.get('end', ''))

                    # If event spans multiple days, create separate events for each day
                    current_date = start_date
                    while current_date <= end_date:
                        # Skip Wednesdays (museum closed)
                        if current_date.weekday() == 2:
                            current_date += timedelta(days=1)
                            continue

                        # Skip if this date is in exclusions
                        exclusions = program.get('exclusions', [])
                        if current_date.strftime("%Y-%m-%d") in exclusions:
                            current_date += timedelta(days=1)
                            continue

                        events_found += 1

                        # Generate content hash
                        content_hash = generate_content_hash(
                            title, "Children's Museum of Atlanta", current_date.strftime("%Y-%m-%d")
                        )

                        # Check for existing
                        existing = find_event_by_hash(content_hash)
                        if existing:
                            events_updated += 1
                            current_date += timedelta(days=1)
                            continue

                        # Determine category
                        category = "family"
                        subcategory = "kids"

                        # Check for specific types in title/description
                        title_lower = title.lower()
                        desc_lower = description.lower() if description else ""

                        if any(word in title_lower or word in desc_lower for word in ['workshop', 'class', 'learn']):
                            subcategory = "education"
                        elif any(word in title_lower for word in ['celebrate', 'festival', 'holiday']):
                            category = "cultural"
                            subcategory = "celebration"

                        event_record = {
                            "source_id": source_id,
                            "venue_id": venue_id,
                            "title": title,
                            "description": description or f"{title} at Children's Museum of Atlanta",
                            "start_date": current_date.strftime("%Y-%m-%d"),
                            "start_time": start_time,
                            "end_date": current_date.strftime("%Y-%m-%d"),
                            "end_time": end_time,
                            "is_all_day": False,
                            "category": category,
                            "subcategory": subcategory,
                            "tags": [
                                "childrens-museum",
                                "family",
                                "kids",
                                "downtown",
                                "centennial-park",
                            ],
                            "price_min": None,
                            "price_max": None,
                            "price_note": "Museum admission required (members free)",
                            "is_free": False,
                            "source_url": permalink,
                            "ticket_url": permalink,
                            "image_url": image_url,
                            "raw_text": f"{title} - {description[:100] if description else ''}",
                            "extraction_confidence": 0.90,
                            "is_recurring": False,
                            "recurrence_rule": None,
                            "content_hash": content_hash,
                        }

                        # Enrich from detail page
                        enrich_event_record(event_record, source_name="Children's Museum of Atlanta")

                        # Determine is_free if still unknown after enrichment
                        if event_record.get("is_free") is None:
                            desc_lower = (event_record.get("description") or "").lower()
                            title_lower = event_record.get("title", "").lower()
                            combined = f"{title_lower} {desc_lower}"
                            if any(kw in combined for kw in ["free", "no cost", "no charge", "complimentary"]):
                                event_record["is_free"] = True
                                event_record["price_min"] = event_record.get("price_min") or 0
                                event_record["price_max"] = event_record.get("price_max") or 0
                            else:
                                event_record["is_free"] = False

                        # Detect exhibits and set content_kind
                        _exhibit_kw = ["exhibit", "exhibition", "on view", "collection", "installation"]
                        _check = f"{event_record.get('title', '')} {event_record.get('description') or ''}".lower()
                        if any(kw in _check for kw in _exhibit_kw):
                            event_record["content_kind"] = "exhibit"
                            event_record["is_all_day"] = True
                            event_record["start_time"] = None

                        # Extract end_date from date range patterns
                        range_text = f"{event_record.get('title', '')} {event_record.get('description') or ''}"
                        _, range_end = parse_date_range(range_text)
                        if range_end:
                            event_record["end_date"] = range_end

                        try:
                            insert_event(event_record)
                            events_new += 1
                            logger.info(f"Added: {title} on {current_date.strftime('%Y-%m-%d')}")
                        except Exception as e:
                            logger.error(f"Failed to insert {title} on {current_date}: {e}")

                        current_date += timedelta(days=1)

                except Exception as e:
                    logger.error(f"Error processing program: {e}")
                    continue

            browser.close()

        logger.info(
            f"Children's Museum crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Children's Museum: {e}")
        raise

    return events_found, events_new, events_updated
