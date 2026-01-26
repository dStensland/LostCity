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

from db import get_or_create_venue, insert_event, find_event_by_hash
from dedupe import generate_content_hash

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

            for program in special_programs:
                try:
                    title = program.get('post_title', '').strip()
                    if not title:
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
                            "is_all_day": start_time is None,
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

            # Also extract daily programs (on-stage and drop-in activities)
            # These are recurring daily activities
            on_stage = calendar_data.get('preload', {}).get('on_stage_programs', [])
            drop_in = calendar_data.get('preload', {}).get('drop_in_activities', [])

            daily_programs = []
            if on_stage:
                daily_programs.extend(on_stage)
            if drop_in:
                daily_programs.extend(drop_in)

            # Process daily programs as recurring events for the next 30 days
            for program in daily_programs:
                try:
                    name = program.get('name', '').strip()
                    description = program.get('description', '').strip()

                    if not name or program.get('hide_on_program_page'):
                        continue

                    # Get session times
                    sessions = program.get('sessions', {}).get('a', {})
                    start_time_str = sessions.get('start', '')
                    end_time_str = sessions.get('end', '')

                    start_time = parse_time(start_time_str)
                    end_time = parse_time(end_time_str)

                    # Create events for next 30 days (daily programs)
                    for i in range(30):
                        event_date = (datetime.now() + timedelta(days=i)).date()

                        # Skip Mondays (museum closed)
                        if event_date.weekday() == 0:
                            continue

                        events_found += 1

                        content_hash = generate_content_hash(
                            name, "Children's Museum of Atlanta", event_date.strftime("%Y-%m-%d")
                        )

                        existing = find_event_by_hash(content_hash)
                        if existing:
                            events_updated += 1
                            continue

                        event_record = {
                            "source_id": source_id,
                            "venue_id": venue_id,
                            "title": name,
                            "description": description or f"{name} - Daily program at Children's Museum",
                            "start_date": event_date.strftime("%Y-%m-%d"),
                            "start_time": start_time,
                            "end_date": event_date.strftime("%Y-%m-%d"),
                            "end_time": end_time,
                            "is_all_day": False,
                            "category": "family",
                            "subcategory": "kids",
                            "tags": [
                                "childrens-museum",
                                "family",
                                "kids",
                                "downtown",
                                "daily-program",
                            ],
                            "price_min": None,
                            "price_max": None,
                            "price_note": "Included with museum admission",
                            "is_free": False,
                            "source_url": EVENTS_URL,
                            "ticket_url": EVENTS_URL,
                            "image_url": None,
                            "raw_text": f"{name} - {description[:100] if description else ''}",
                            "extraction_confidence": 0.85,
                            "is_recurring": True,
                            "recurrence_rule": "FREQ=DAILY",
                            "content_hash": content_hash,
                        }

                        try:
                            insert_event(event_record)
                            events_new += 1
                            if i == 0:  # Only log first occurrence
                                logger.info(f"Added daily program: {name}")
                        except Exception as e:
                            logger.error(f"Failed to insert daily program {name}: {e}")

                except Exception as e:
                    logger.error(f"Error processing daily program: {e}")
                    continue

            browser.close()

        logger.info(
            f"Children's Museum crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Children's Museum: {e}")
        raise

    return events_found, events_new, events_updated
