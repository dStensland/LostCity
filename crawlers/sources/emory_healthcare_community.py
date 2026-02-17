"""
Crawler for Emory Healthcare community events (events.blackthorn.io).

Emory uses Blackthorn.io (Salesforce-native event platform) for community engagement,
maternity classes, support groups, and wellness programs.

## Architecture

Blackthorn loads events in an iframe with an Angular app that makes XHR calls to:
- `https://events.blackthorn.io/00D5e000002EtNZEA0/api/event-group-summaries?groupKey={groupKey}`

This crawler uses Playwright to:
1. Navigate to each event group page
2. Intercept XHR responses via `page.on("response", handler)`
3. Capture JSON event data directly from the API
4. Map to LostCity venues and categories

## Event Groups

1. **Community Engagement** (6tS0ckY1Wf) — support groups, wellness walks, cooking classes
   - Primary focus for general LostCity audience
   - ~18 events (varies)

2. **Maternity In-Person** (af31mXHD2r) — childbirth classes, maternity tours, breastfeeding
   - ~508 events (recurring weekly classes)
   - Critical for hospital portal experience

3. **Maternity Online** (FPCaec5hP1) — online maternity classes
   - ~290 events (virtual versions of in-person classes)

## Venue Mapping

Maps Blackthorn `venueName` field to actual Emory hospital venues:
- "Emory Decatur Hospital" → 2701 N Decatur Rd, Decatur
- "Emory Hillandale Hospital" → Lithonia
- "Emory Midtown" → 550 Peachtree St NE, Atlanta
- "Emory Johns Creek" → 6325 Hospital Pkwy, Johns Creek
- "Emory Saint Joseph's" → Sandy Springs
- "Emory University Hospital" → Druid Hills
- Online/Virtual events → Generic "Emory Healthcare" org venue

Uses `venueGeocode` from API for lat/lng override when available.

## Category Mapping

Blackthorn → LostCity:
- "Support Group" → community/support_group
- "Class/Workshop" + maternity keywords → class/parenting
- "Class/Workshop" + cooking keywords → class/cooking
- "Class/Workshop" + fitness keywords → class/fitness
- "Social/Networking" → community
- Default → community

## Testing

```bash
# Run the crawler (requires database migration 208 first)
python3 main.py --source emory-healthcare-community

# Test imports and mapping functions
python3 -c "from sources.emory_healthcare_community import map_venue_name_to_venue_data; print(map_venue_name_to_venue_data('Emory Decatur Hospital'))"
```

## Database Setup

Run migration 208 to register the source:
```bash
psql $DATABASE_URL -f database/migrations/208_emory_healthcare_community_source.sql
```
"""

from __future__ import annotations

import re
import json
import logging
from datetime import datetime
from typing import Optional
from playwright.sync_api import sync_playwright, Response

from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://events.blackthorn.io/00D5e000002EtNZ"

# Event groups to crawl
EVENT_GROUPS = {
    "community": {
        "key": "6tS0ckY1Wf",
        "name": "Community Engagement",
        "priority": 1,  # Most relevant for LostCity
    },
    "maternity_in_person": {
        "key": "af31mXHD2r",
        "name": "Maternity In-Person",
        "priority": 2,
    },
    "maternity_online": {
        "key": "FPCaec5hP1",
        "name": "Maternity Online",
        "priority": 3,
    },
}

# Emory hospital venue mappings
EMORY_VENUES = {
    "emory decatur": {
        "name": "Emory Decatur Hospital",
        "slug": "emory-decatur-hospital",
        "address": "2701 N Decatur Rd",
        "neighborhood": "Decatur",
        "city": "Decatur",
        "state": "GA",
        "zip": "30033",
        "lat": 33.8181,
        "lng": -84.2897,
        "venue_type": "hospital",
        "website": "https://www.emoryhealthcare.org/locations/hospitals/decatur.html",
    },
    "emory hillandale": {
        "name": "Emory Hillandale Hospital",
        "slug": "emory-hillandale-hospital",
        "address": "2801 DeKalb Medical Pkwy",
        "neighborhood": "Lithonia",
        "city": "Lithonia",
        "state": "GA",
        "zip": "30058",
        "lat": 33.7103,
        "lng": -84.0781,
        "venue_type": "hospital",
        "website": "https://www.emoryhealthcare.org/locations/hospitals/hillandale.html",
    },
    "emory midtown": {
        "name": "Emory University Hospital Midtown",
        "slug": "emory-midtown",
        "address": "550 Peachtree St NE",
        "neighborhood": "Midtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30308",
        "lat": 33.7719,
        "lng": -84.3852,
        "venue_type": "hospital",
        "website": "https://www.emoryhealthcare.org/locations/hospitals/midtown.html",
    },
    "emory johns creek": {
        "name": "Emory Johns Creek Hospital",
        "slug": "emory-johns-creek-hospital",
        "address": "6325 Hospital Pkwy",
        "neighborhood": "Johns Creek",
        "city": "Johns Creek",
        "state": "GA",
        "zip": "30097",
        "lat": 34.0389,
        "lng": -84.1988,
        "venue_type": "hospital",
        "website": "https://www.emoryhealthcare.org/locations/hospitals/johns-creek.html",
    },
    "emory saint josephs": {
        "name": "Emory Saint Joseph's Hospital",
        "slug": "emory-saint-josephs-hospital",
        "address": "5665 Peachtree Dunwoody Rd NE",
        "neighborhood": "Sandy Springs",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30342",
        "lat": 33.9231,
        "lng": -84.3414,
        "venue_type": "hospital",
        "website": "https://www.emoryhealthcare.org/locations/hospitals/saint-josephs.html",
    },
    "emory university hospital": {
        "name": "Emory University Hospital",
        "slug": "emory-university-hospital",
        "address": "1364 Clifton Rd NE",
        "neighborhood": "Druid Hills",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30322",
        "lat": 33.7925,
        "lng": -84.3234,
        "venue_type": "hospital",
        "website": "https://www.emoryhealthcare.org/locations/hospitals/university-hospital.html",
    },
}

# Fallback venue for events without specific location
DEFAULT_VENUE = {
    "name": "Emory Healthcare",
    "slug": "emory-healthcare",
    "address": "1440 Clifton Rd NE",
    "neighborhood": "Druid Hills",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30322",
    "lat": 33.7925,
    "lng": -84.3234,
    "venue_type": "organization",
    "website": "https://www.emoryhealthcare.org",
    "description": "Leading academic health system in metro Atlanta with hospitals, clinics, and community programs.",
}


def map_venue_name_to_venue_data(venue_name: str, lat: Optional[float] = None, lng: Optional[float] = None) -> dict:
    """Map Blackthorn venueName to actual Emory hospital venue data."""
    if not venue_name:
        return DEFAULT_VENUE.copy()

    venue_lower = venue_name.lower()

    # Try exact matching first
    for key, venue_data in EMORY_VENUES.items():
        if key in venue_lower:
            result = venue_data.copy()
            # Override with API coordinates if available
            if lat and lng:
                result["lat"] = lat
                result["lng"] = lng
            return result

    # Partial matches
    if "decatur" in venue_lower:
        result = EMORY_VENUES["emory decatur"].copy()
        if lat and lng:
            result["lat"] = lat
            result["lng"] = lng
        return result

    if "hillandale" in venue_lower:
        result = EMORY_VENUES["emory hillandale"].copy()
        if lat and lng:
            result["lat"] = lat
            result["lng"] = lng
        return result

    if "midtown" in venue_lower:
        result = EMORY_VENUES["emory midtown"].copy()
        if lat and lng:
            result["lat"] = lat
            result["lng"] = lng
        return result

    if "johns creek" in venue_lower:
        result = EMORY_VENUES["emory johns creek"].copy()
        if lat and lng:
            result["lat"] = lat
            result["lng"] = lng
        return result

    if "saint joseph" in venue_lower or "st joseph" in venue_lower:
        result = EMORY_VENUES["emory saint josephs"].copy()
        if lat and lng:
            result["lat"] = lat
            result["lng"] = lng
        return result

    if "university hospital" in venue_lower or "clifton" in venue_lower:
        result = EMORY_VENUES["emory university hospital"].copy()
        if lat and lng:
            result["lat"] = lat
            result["lng"] = lng
        return result

    # Online events - use org venue
    if "online" in venue_lower or "virtual" in venue_lower or "zoom" in venue_lower:
        return DEFAULT_VENUE.copy()

    # Unknown venue - use default but with API coordinates if available
    result = DEFAULT_VENUE.copy()
    if lat and lng:
        result["lat"] = lat
        result["lng"] = lng
        result["name"] = venue_name
        result["slug"] = re.sub(r'[^a-z0-9-]+', '-', venue_name.lower()).strip('-')

    return result


def map_category_to_lostcity(blackthorn_category: str, title: str = "", description: str = "") -> tuple[str, Optional[str]]:
    """Map Blackthorn category to LostCity category and subcategory."""
    category_lower = blackthorn_category.lower()
    combined_text = f"{title.lower()} {description.lower()}"

    # Support groups
    if "support group" in category_lower or "support group" in combined_text:
        return "community", "support_group"

    # Classes/workshops
    if "class" in category_lower or "workshop" in category_lower:
        # Check for specific class types
        if any(word in combined_text for word in ["childbirth", "breastfeeding", "lactation", "newborn", "infant", "maternity", "prenatal", "postpartum"]):
            return "class", "parenting"
        if any(word in combined_text for word in ["cooking", "nutrition", "food"]):
            return "class", "cooking"
        if any(word in combined_text for word in ["yoga", "fitness", "exercise", "wellness"]):
            return "class", "fitness"
        return "class", None

    # Social/networking
    if "social" in category_lower or "networking" in category_lower:
        return "community", None

    # Festivals
    if "festival" in category_lower:
        return "festival", None

    # Default to community
    return "community", None


def parse_iso_datetime(iso_str: str) -> tuple[Optional[str], Optional[str]]:
    """Parse ISO datetime string to (YYYY-MM-DD, HH:MM)."""
    try:
        dt = datetime.fromisoformat(iso_str.replace('Z', '+00:00'))
        return dt.strftime("%Y-%m-%d"), dt.strftime("%H:%M")
    except (ValueError, AttributeError):
        return None, None


def determine_if_free(blackthorn_event: dict, category: str) -> bool:
    """Determine if event is free based on Blackthorn data."""
    # Support groups are typically free
    if category == "community" and "support group" in blackthorn_event.get("category", "").lower():
        return True

    # Check purchasable flag (True = registration required, might have fee)
    # If not purchasable, it's likely free/open
    purchasable = blackthorn_event.get("purchasable", False)
    if not purchasable:
        return True

    # Default: assume not free if it has registration
    return False


def crawl_group(page, group_key: str, group_name: str, source_id: int) -> tuple[int, int, int]:
    """Crawl a single Blackthorn event group and return (found, new, updated)."""
    events_found = 0
    events_new = 0
    events_updated = 0

    captured_events = []

    def handle_response(response: Response):
        """Intercept XHR responses to Blackthorn API."""
        try:
            url = response.url
            if "event-group-summaries" in url and group_key in url:
                if response.status == 200:
                    try:
                        data = response.json()
                        # Response is {"data": [...], "meta": {...}}
                        if isinstance(data, dict):
                            events = data.get("data", [])
                            if events:
                                captured_events.extend(events)
                                logger.info(f"Captured {len(events)} events from {group_name} API response")
                        elif isinstance(data, list):
                            captured_events.extend(data)
                            logger.info(f"Captured {len(data)} events from {group_name} API response")
                    except Exception as e:
                        logger.debug(f"Could not parse JSON from {url}: {e}")
        except Exception as e:
            logger.debug(f"Response handler error: {e}")

    # Set up route interception
    page.on("response", handle_response)

    # Navigate to group page to trigger API call
    group_url = f"{BASE_URL}/g/{group_key}"
    logger.info(f"Fetching {group_name}: {group_url}")

    try:
        page.goto(group_url, wait_until="domcontentloaded", timeout=30000)
        page.wait_for_timeout(5000)  # Give time for XHR requests

        # Try to trigger "load more" if pagination exists
        for _ in range(3):
            try:
                load_more = page.query_selector('button:has-text("Load More"), button:has-text("Show More"), [data-testid="load-more"]')
                if load_more and load_more.is_visible():
                    load_more.click()
                    page.wait_for_timeout(2000)
                else:
                    break
            except Exception:
                break

        page.wait_for_timeout(2000)  # Final wait for any pending requests

    except Exception as e:
        logger.warning(f"Error loading {group_name} page: {e}")
        return events_found, events_new, events_updated

    # Process captured events
    logger.info(f"Processing {len(captured_events)} events from {group_name}")

    for event_data in captured_events:
        try:
            event_id = event_data.get("id")
            title = event_data.get("name", "").strip()

            if not title or not event_id:
                continue

            # Parse dates
            start_date_iso = event_data.get("startDate")
            end_date_iso = event_data.get("endDate")

            start_date, start_time = parse_iso_datetime(start_date_iso) if start_date_iso else (None, None)
            end_date, end_time = parse_iso_datetime(end_date_iso) if end_date_iso else (None, None)

            if not start_date:
                logger.debug(f"Skipping event without start date: {title}")
                continue

            # Skip past events
            try:
                event_dt = datetime.strptime(start_date, "%Y-%m-%d")
                if event_dt.date() < datetime.now().date():
                    continue
            except ValueError:
                continue

            # Venue mapping
            venue_name = event_data.get("venueName", "")
            venue_zipcode = event_data.get("venueZipcode", "")
            venue_geocode = event_data.get("venueGeocode", {})

            lat = venue_geocode.get("latitude") if venue_geocode else None
            lng = venue_geocode.get("longitude") if venue_geocode else None

            venue_data = map_venue_name_to_venue_data(venue_name, lat, lng)
            venue_id = get_or_create_venue(venue_data)

            # Category mapping
            blackthorn_category = event_data.get("category", "")
            description = event_data.get("description", "")

            category, subcategory = map_category_to_lostcity(blackthorn_category, title, description)

            # Tags
            tags = ["emory-healthcare", "health", "wellness"]
            if subcategory == "support_group":
                tags.extend(["support-group", "community"])
            elif subcategory == "parenting":
                tags.extend(["parenting", "family", "maternity"])
            elif subcategory == "cooking":
                tags.extend(["cooking", "nutrition"])
            elif subcategory == "fitness":
                tags.extend(["fitness", "exercise"])

            # Check if online/virtual
            is_online = "online" in venue_name.lower() or "virtual" in venue_name.lower()
            if is_online:
                tags.append("online")

            # Pricing
            is_free = determine_if_free(event_data, category)

            # Event URL
            event_url = f"{BASE_URL}/g/{group_key}/{event_id}"

            # Check for duplicates
            events_found += 1
            content_hash = generate_content_hash(title, venue_data["name"], start_date)


            # Check for recurring event linkage
            recurring_event_id = event_data.get("recurringEventId")
            is_recurring = bool(recurring_event_id)

            event_record = {
                "source_id": source_id,
                "venue_id": venue_id,
                "title": title,
                "description": description[:1000] if description else None,
                "start_date": start_date,
                "start_time": start_time,
                "end_date": end_date if end_date != start_date else None,
                "end_time": end_time,
                "is_all_day": False,  # Blackthorn events have specific times
                "category": category,
                "subcategory": subcategory,
                "tags": tags,
                "price_min": None,
                "price_max": None,
                "price_note": None,
                "is_free": is_free,
                "source_url": event_url,
                "ticket_url": event_url,
                "image_url": event_data.get("imageUrl"),
                "raw_text": json.dumps(event_data)[:1000],
                "extraction_confidence": 0.95,  # High confidence - structured API data
                "is_recurring": is_recurring,
                "recurrence_rule": None,  # Blackthorn handles recurrence server-side
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
                logger.info(f"Added [{group_name}]: {title} on {start_date} at {venue_data['name']}")
            except Exception as e:
                logger.error(f"Failed to insert event {title}: {e}")

        except Exception as e:
            logger.debug(f"Error processing event in {group_name}: {e}")
            continue

    return events_found, events_new, events_updated


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Emory Healthcare community events via Blackthorn API interception."""
    source_id = source["id"]
    total_found = 0
    total_new = 0
    total_updated = 0

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
                viewport={"width": 1920, "height": 1080},
            )
            page = context.new_page()

            # Crawl each event group
            for group_id, group_info in EVENT_GROUPS.items():
                group_key = group_info["key"]
                group_name = group_info["name"]

                logger.info(f"Starting crawl for {group_name} ({group_id})")

                found, new, updated = crawl_group(page, group_key, group_name, source_id)

                total_found += found
                total_new += new
                total_updated += updated

                logger.info(
                    f"{group_name} complete: {found} found, {new} new, {updated} updated"
                )

                # Brief pause between groups
                page.wait_for_timeout(2000)

            browser.close()

        logger.info(
            f"Emory Healthcare crawl complete: {total_found} total events found, "
            f"{total_new} new, {total_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Emory Healthcare: {e}")
        raise

    return total_found, total_new, total_updated
