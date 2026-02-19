"""
Crawler for Georgia Equality (georgiaequality.org/communitycalendar/).

LGBTQ+ advocacy organization hosting advocacy days, lobby days, voter registration
events, candidate forums, and community education events across Georgia.

The site embeds a public Google Calendar which we access via iCal feed.
Calendar ID: georgiaequality.org_bpidk7r7g86t7nl9vpncb5h48s@group.calendar.google.com
"""

from __future__ import annotations

import re
import logging
from datetime import datetime, timedelta
from typing import Optional

import requests
from icalendar import Calendar, Event

from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://georgiaequality.org"
CALENDAR_URL = f"{BASE_URL}/communitycalendar/"

# Google Calendar iCal feed
ICAL_FEED_URL = "https://calendar.google.com/calendar/ical/georgiaequality.org_bpidk7r7g86t7nl9vpncb5h48s%40group.calendar.google.com/public/basic.ics"

VENUE_DATA = {
    "name": "Georgia Equality",
    "slug": "georgia-equality",
    "address": "PO Box 2128",
    "neighborhood": "Atlanta",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30301",
    "venue_type": "organization",
    "spot_type": "nonprofit",
    "website": BASE_URL,
    "description": "LGBTQ+ advocacy organization advancing fairness, safety, and opportunity for LGBTQ Georgians.",
}


def parse_ical_datetime(dt) -> tuple[Optional[str], Optional[str], bool]:
    """
    Parse iCal datetime/date object.

    Returns: (date_str, time_str, is_all_day)
    """
    if dt is None:
        return None, None, False

    # Check if it's a date-only (all-day event)
    if hasattr(dt, 'hour'):
        # It's a datetime
        date_str = dt.strftime("%Y-%m-%d")
        time_str = dt.strftime("%H:%M")
        return date_str, time_str, False
    else:
        # It's a date (all-day)
        date_str = dt.strftime("%Y-%m-%d")
        return date_str, None, True


def extract_location_info(location_str: str) -> Optional[dict]:
    """
    Extract venue information from location string.

    If event is at a specific venue (not Georgia Equality office),
    return venue data to create/link the venue.
    """
    if not location_str or "Georgia Equality" in location_str:
        return None

    # Check for Georgia State Capitol
    if any(kw in location_str.lower() for kw in ["capitol", "state house", "legislative"]):
        return {
            "name": "Georgia State Capitol",
            "slug": "georgia-state-capitol",
            "address": "206 Washington St SW",
            "neighborhood": "Downtown",
            "city": "Atlanta",
            "state": "GA",
            "zip": "30334",
            "lat": 33.7490,
            "lng": -84.3880,
            "venue_type": "government",
            "spot_type": "landmark",
            "website": "https://doas.ga.gov/state-properties/georgia-state-capitol",
        }

    # For other locations, return None and use Georgia Equality as default venue
    return None


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Georgia Equality events from Google Calendar iCal feed."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        # Create default venue
        default_venue_id = get_or_create_venue(VENUE_DATA)

        logger.info(f"Fetching Georgia Equality calendar: {ICAL_FEED_URL}")

        # Fetch iCal feed
        response = requests.get(
            ICAL_FEED_URL,
            headers={"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"},
            timeout=30
        )
        response.raise_for_status()

        # Parse iCal
        cal = Calendar.from_ical(response.text)

        seen_events = set()
        today = datetime.now().date()

        for component in cal.walk():
            if component.name != "VEVENT":
                continue

            try:
                # Extract basic fields
                summary = str(component.get('summary', ''))
                description = str(component.get('description', ''))
                location = str(component.get('location', ''))
                uid = str(component.get('uid', ''))

                if not summary or len(summary) < 3:
                    continue

                # Parse dates
                dtstart = component.get('dtstart').dt if component.get('dtstart') else None
                dtend = component.get('dtend').dt if component.get('dtend') else None

                start_date, start_time, is_all_day = parse_ical_datetime(dtstart)

                if not start_date:
                    logger.debug(f"No start date for: {summary}")
                    continue

                # Skip past events (with 7-day grace period for all-day events that may still be ongoing)
                try:
                    event_date = datetime.strptime(start_date, "%Y-%m-%d").date()
                    if event_date < today - timedelta(days=7):
                        continue
                except ValueError:
                    continue

                # Parse end date/time if present
                end_date = None
                end_time = None
                if dtend:
                    end_date_parsed, end_time_parsed, _ = parse_ical_datetime(dtend)
                    end_date = end_date_parsed
                    end_time = end_time_parsed

                # Dedupe check
                event_key = f"{summary}|{start_date}"
                if event_key in seen_events:
                    continue
                seen_events.add(event_key)

                events_found += 1

                # Check for alternate venue
                venue_info = extract_location_info(location)
                if venue_info:
                    venue_id = get_or_create_venue(venue_info)
                    venue_name = venue_info["name"]
                else:
                    venue_id = default_venue_id
                    venue_name = VENUE_DATA["name"]

                # Clean up description (remove URLs and extra whitespace)
                if description:
                    # Remove URLs
                    description = re.sub(r'https?://\S+', '', description)
                    # Clean up whitespace
                    description = re.sub(r'\s+', ' ', description).strip()
                    if len(description) > 500:
                        description = description[:497] + "..."

                if not description or len(description) < 20:
                    description = f"{summary} - Georgia Equality event"

                # Categorize based on title/description
                text_lower = f"{summary} {description}".lower()
                tags = ["activism", "civic-engagement", "lgbtq"]

                if any(kw in text_lower for kw in ["advocacy", "lobby", "capitol"]):
                    tags.append("advocacy")
                if any(kw in text_lower for kw in ["voter", "registration", "vote"]):
                    tags.append("voter-registration")
                if any(kw in text_lower for kw in ["forum", "candidate", "town hall"]):
                    tags.append("town-hall")
                if any(kw in text_lower for kw in ["training", "workshop", "education"]):
                    tags.append("education")

                # Default to not-free; only set True when source text says "free"
                is_free = False
                if any(kw in text_lower for kw in ["free", "no cost", "no charge", "complimentary"]):
                    is_free = True

                # Build source URL
                source_url = CALENDAR_URL

                # Generate content hash
                content_hash = generate_content_hash(summary, venue_name, start_date)

                # Build event record
                event_record = {
                    "source_id": source_id,
                    "venue_id": venue_id,
                    "title": summary[:200],
                    "description": description[:1000] if description else None,
                    "start_date": start_date,
                    "start_time": start_time,
                    "end_date": end_date,
                    "end_time": end_time,
                    "is_all_day": is_all_day,
                    "category": "community",
                    "tags": tags,
                    "price_min": None,
                    "price_max": None,
                    "price_note": None,
                    "is_free": is_free,
                    "source_url": source_url,
                    "ticket_url": source_url,
                    "image_url": None,
                    "raw_text": f"{summary} {description or ''}"[:500],
                    "extraction_confidence": 0.90,  # iCal is structured data
                    "is_recurring": False,
                    "recurrence_rule": None,
                    "content_hash": content_hash,
                }

                # Check for existing event
                existing = find_event_by_hash(content_hash)
                if existing:
                    smart_update_existing_event(existing, event_record)
                    events_updated += 1
                    continue

                try:
                    insert_event(event_record)
                    events_new += 1
                    logger.info(f"Added: {summary} on {start_date}")
                except Exception as e:
                    logger.error(f"Failed to insert event '{summary}': {e}")

            except Exception as e:
                logger.debug(f"Error processing calendar event: {e}")
                continue

        logger.info(
            f"Georgia Equality crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except requests.RequestException as e:
        logger.error(f"Failed to fetch Georgia Equality calendar: {e}")
        raise
    except Exception as e:
        logger.error(f"Failed to crawl Georgia Equality: {e}")
        raise

    return events_found, events_new, events_updated
