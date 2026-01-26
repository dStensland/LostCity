"""
Crawler for Piedmont Cancer Institute Support Groups.
(piedmontcancerinstitute.com/support-groups.php)

Recurring support groups for cancer patients and caregivers.
Groups meet monthly at fixed times - we generate events for the next 3 months.
"""

from __future__ import annotations

import logging
from datetime import datetime
from calendar import monthrange
from typing import Optional

from playwright.sync_api import sync_playwright

from db import get_or_create_venue, insert_event, find_event_by_hash, get_portal_id_by_slug
from dedupe import generate_content_hash
from utils import extract_images_from_page

# Portal ID for Piedmont-exclusive events
PORTAL_SLUG = "piedmont"

logger = logging.getLogger(__name__)

BASE_URL = "https://www.piedmontcancerinstitute.com"
SUPPORT_GROUPS_URL = f"{BASE_URL}/support-groups.php"

# Venue data for support group locations
VENUES = {
    "howell_mill": {
        "name": "Piedmont Cancer Institute",
        "slug": "piedmont-cancer-institute",
        "address": "1800 Howell Mill Rd, Suite 575",
        "neighborhood": "Westside",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30318",
        "venue_type": "hospital",
        "website": BASE_URL,
    },
    "stockbridge": {
        "name": "Piedmont Cancer Institute Stockbridge",
        "slug": "piedmont-cancer-institute-stockbridge",
        "address": "290 Country Club Drive, Suite 100",
        "neighborhood": None,
        "city": "Stockbridge",
        "state": "GA",
        "zip": "30281",
        "venue_type": "hospital",
        "website": BASE_URL,
    },
}

# Known support groups with their schedules
SUPPORT_GROUPS = [
    {
        "title": "Colon Cancer Support Group",
        "description": "Support group for individuals dealing with colon cancer. Facilitated by Erika Flippin, LMSW, OSW-C.",
        "schedule": "first_tuesday",
        "time": "17:30",  # 5:30 PM
        "venue_key": None,  # Virtual/Zoom
        "is_virtual": True,
        "category": "community",
        "subcategory": "support-group",
        "tags": ["piedmont", "cancer", "support-group", "colon-cancer", "virtual", "healthcare"],
    },
    {
        "title": "Breast Cancer Support Group",
        "description": "Support group for breast cancer patients and survivors. Facilitated by Heather Sewell, LMSW.",
        "schedule": "second_tuesday",
        "time": "10:00",
        "venue_key": None,  # Virtual/Zoom
        "is_virtual": True,
        "category": "community",
        "subcategory": "support-group",
        "tags": ["piedmont", "cancer", "support-group", "breast-cancer", "virtual", "healthcare"],
    },
    {
        "title": "Coping With Cancer",
        "description": "Support for all battling cancer - assistance to anyone facing cancer diagnosis and treatment. Facilitated by Stacie Nevins, LCSW.",
        "schedule": "fourth_tuesday",
        "time": "10:00",
        "venue_key": "howell_mill",
        "is_virtual": False,
        "category": "community",
        "subcategory": "support-group",
        "tags": ["piedmont", "cancer", "support-group", "healthcare", "westside"],
    },
    {
        "title": "Caregiver Support Group",
        "description": "Support group specifically designed for family members and caregivers of cancer patients. Facilitated by Erika Flippin, LMSW, OSW-C.",
        "schedule": "third_saturday",
        "time": "10:00",
        "venue_key": "stockbridge",
        "is_virtual": False,
        "category": "community",
        "subcategory": "support-group",
        "tags": ["piedmont", "cancer", "support-group", "caregiver", "healthcare"],
    },
]


def get_nth_weekday(year: int, month: int, weekday: int, n: int) -> Optional[datetime]:
    """
    Get the nth occurrence of a weekday in a month.
    weekday: 0=Monday, 1=Tuesday, ..., 5=Saturday, 6=Sunday
    n: 1=first, 2=second, 3=third, 4=fourth
    """
    first_day = datetime(year, month, 1)
    first_weekday = first_day.weekday()

    # Calculate day of first occurrence
    days_until = (weekday - first_weekday) % 7
    first_occurrence = 1 + days_until

    # Calculate nth occurrence
    target_day = first_occurrence + (n - 1) * 7

    # Validate it's still in the month
    _, last_day = monthrange(year, month)
    if target_day > last_day:
        return None

    return datetime(year, month, target_day)


def parse_schedule(schedule: str, year: int, month: int) -> Optional[datetime]:
    """Parse schedule string like 'first_tuesday' to a date."""
    parts = schedule.split("_")
    if len(parts) != 2:
        return None

    ordinal_map = {"first": 1, "second": 2, "third": 3, "fourth": 4}
    weekday_map = {
        "monday": 0, "tuesday": 1, "wednesday": 2, "thursday": 3,
        "friday": 4, "saturday": 5, "sunday": 6
    }

    ordinal = ordinal_map.get(parts[0])
    weekday = weekday_map.get(parts[1])

    if ordinal is None or weekday is None:
        return None

    return get_nth_weekday(year, month, weekday, ordinal)


def generate_upcoming_dates(schedule: str, months_ahead: int = 3) -> list[str]:
    """Generate dates for the next N months based on schedule."""
    dates = []
    now = datetime.now()

    for month_offset in range(months_ahead + 1):
        year = now.year
        month = now.month + month_offset
        while month > 12:
            month -= 12
            year += 1

        dt = parse_schedule(schedule, year, month)
        if dt and dt >= now:
            dates.append(dt.strftime("%Y-%m-%d"))

    return dates


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl/generate Piedmont Cancer Institute support group events."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    # Get portal ID for Piedmont-exclusive events
    portal_id = get_portal_id_by_slug(PORTAL_SLUG)

    try:
        # First, verify the support groups page is accessible and scrape any updates
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
            )
            page = context.new_page()

            logger.info(f"Fetching Piedmont Cancer Support Groups: {SUPPORT_GROUPS_URL}")
            try:
                page.goto(SUPPORT_GROUPS_URL, wait_until="domcontentloaded", timeout=30000)
                page.wait_for_timeout(2000)

                # Extract images from page
                image_map = extract_images_from_page(page)
                body_text = page.inner_text("body")
                logger.info(f"Page loaded, content length: {len(body_text)}")
            except Exception as e:
                logger.warning(f"Could not fetch page, using known schedule: {e}")

            browser.close()

        # Generate events from known schedules
        for group in SUPPORT_GROUPS:
            dates = generate_upcoming_dates(group["schedule"], months_ahead=3)

            # Get or create venue
            if group["venue_key"]:
                venue_data = VENUES[group["venue_key"]]
                venue_id = get_or_create_venue(venue_data)
                venue_name = venue_data["name"]
            else:
                # Virtual event - use main PCI location for reference
                venue_data = VENUES["howell_mill"]
                venue_id = get_or_create_venue(venue_data)
                venue_name = "Virtual (Zoom)"

            for start_date in dates:
                events_found += 1

                # Create title with date indication
                title = group["title"]

                content_hash = generate_content_hash(
                    title, venue_name, start_date
                )

                existing = find_event_by_hash(content_hash)
                if existing:
                    events_updated += 1
                    continue

                # Build description
                description = group["description"]
                if group["is_virtual"]:
                    description += " This group meets virtually via Zoom."

                event_record = {
                    "source_id": source_id,
                    "venue_id": venue_id,
                    "portal_id": portal_id,  # Piedmont-exclusive event
                    "title": title,
                    "description": description,
                    "start_date": start_date,
                    "start_time": group["time"],
                    "end_date": None,
                    "end_time": None,
                    "is_all_day": False,
                    "category": group["category"],
                    "subcategory": group["subcategory"],
                    "tags": group["tags"],
                    "price_min": None,
                    "price_max": None,
                    "price_note": "Free for patients and caregivers",
                    "is_free": True,
                    "source_url": SUPPORT_GROUPS_URL,
                    "ticket_url": SUPPORT_GROUPS_URL,
                    "image_url": image_map.get(title),
                    "raw_text": f"{title} - {start_date}",
                    "extraction_confidence": 0.95,  # High confidence since we know the schedule
                    "is_recurring": True,
                    "recurrence_rule": f"MONTHLY;{group['schedule'].upper()}",
                    "content_hash": content_hash,
                }

                try:
                    insert_event(event_record)
                    events_new += 1
                    logger.info(f"Added: {title} on {start_date}")
                except Exception as e:
                    logger.error(f"Failed to insert: {title}: {e}")

        logger.info(
            f"Piedmont Cancer Support crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Piedmont Cancer Support: {e}")
        raise

    return events_found, events_new, events_updated
