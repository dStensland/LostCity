"""
Crawler for Cobb County Public Library System events.

Cobb County has 15 library branches offering free events including:
- Storytimes, book clubs, educational programs, kids activities
- Computer classes, author talks, crafts, and community programs

Uses Playwright to render the JavaScript-heavy Cobb County events page.
"""

from __future__ import annotations

import json
import logging
import re
from datetime import datetime
from typing import Optional

from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout
from bs4 import BeautifulSoup

from utils import slugify
from db import get_or_create_venue, insert_event, find_event_by_hash
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://www.cobbcounty.gov"
# Department 85 is the Library department
EVENTS_PAGE = f"{BASE_URL}/events?department=85"

# Library branches - will create venue records as needed
LIBRARY_BRANCHES = {
    "east-cobb": {
        "name": "East Cobb Library",
        "address": "4880 Lower Roswell Road",
        "city": "Marietta",
        "state": "GA",
        "zip": "30068",
    },
    "gritters": {
        "name": "Gritters Library",
        "address": "2550 Sandy Plains Road",
        "city": "Marietta",
        "state": "GA",
        "zip": "30066",
    },
    "kemp": {
        "name": "Kemp Memorial Library",
        "address": "1090 Powder Springs Street",
        "city": "Marietta",
        "state": "GA",
        "zip": "30064",
    },
    "lewis-ray": {
        "name": "Lewis A. Ray Library",
        "address": "1315 Kennestone Circle",
        "city": "Marietta",
        "state": "GA",
        "zip": "30066",
    },
    "mountain-view": {
        "name": "Mountain View Regional Library",
        "address": "3320 Sandy Plains Road",
        "city": "Marietta",
        "state": "GA",
        "zip": "30066",
    },
    "sibley": {
        "name": "Sibley Library",
        "address": "130 Powder Springs Street",
        "city": "Marietta",
        "state": "GA",
        "zip": "30064",
    },
    "south-cobb": {
        "name": "South Cobb Regional Library",
        "address": "805 Clay Road SW",
        "city": "Mableton",
        "state": "GA",
        "zip": "30126",
    },
    "stratton": {
        "name": "Stratton Library",
        "address": "2470 Windy Hill Road SE",
        "city": "Marietta",
        "state": "GA",
        "zip": "30067",
    },
    "switzer": {
        "name": "Switzer Library",
        "address": "266 Roswell Street",
        "city": "Marietta",
        "state": "GA",
        "zip": "30060",
    },
    "vinings": {
        "name": "Vinings Library",
        "address": "4290 Paces Ferry Road SE",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30339",
    },
    "west-cobb": {
        "name": "West Cobb Regional Library",
        "address": "1750 Dennis Kemp Lane",
        "city": "Kennesaw",
        "state": "GA",
        "zip": "30152",
    },
    "sewell-mill": {
        "name": "Sewell Mill Library & Cultural Center",
        "address": "2051 Lower Roswell Road",
        "city": "Marietta",
        "state": "GA",
        "zip": "30068",
    },
    "merchants-walk": {
        "name": "Merchants Walk Library",
        "address": "1550 Merchants Drive",
        "city": "Marietta",
        "state": "GA",
        "zip": "30066",
    },
    "sweetwater-valley": {
        "name": "Sweetwater Valley Library",
        "address": "3200 County Line Road",
        "city": "Austell",
        "state": "GA",
        "zip": "30106",
    },
    "powder-springs": {
        "name": "Powder Springs Library",
        "address": "4181 Atlanta Street",
        "city": "Powder Springs",
        "state": "GA",
        "zip": "30127",
    },
}

# Category mapping based on event titles/descriptions
CATEGORY_MAP = {
    "book": "words",
    "storytime": "words",
    "story time": "words",
    "author": "words",
    "writing": "words",
    "reading": "words",
    "poetry": "words",
    "computer": "learning",
    "technology": "learning",
    "tech": "learning",
    "esl": "learning",
    "class": "learning",
    "career": "learning",
    "homework": "learning",
    "music": "music",
    "concert": "music",
    "film": "film",
    "movie": "film",
    "craft": "art",
    "art": "art",
    "paint": "art",
    "draw": "art",
    "fitness": "fitness",
    "yoga": "fitness",
    "game": "play",
    "gaming": "play",
    "lego": "play",
    "toy": "play",
}


def determine_category(title: str, description: str) -> str:
    """Determine event category from title and description."""
    text = f"{title} {description}".lower()

    for keyword, category in CATEGORY_MAP.items():
        if keyword in text:
            return category

    return "words"  # Default for library events


def parse_library_name(location_text: str) -> Optional[str]:
    """Extract library branch name from location text."""
    if not location_text:
        return None

    # Try to match known library names
    location_lower = location_text.lower()
    for branch_key, branch_data in LIBRARY_BRANCHES.items():
        branch_name = branch_data["name"].lower()
        if branch_name in location_lower or branch_key.replace("-", " ") in location_lower:
            return branch_data["name"]

    # Check if it contains "library"
    if "library" in location_lower:
        return location_text.strip()

    return None


def parse_event_date(date_str: str) -> Optional[tuple[str, Optional[str]]]:
    """
    Parse event date and time from various formats.
    Returns: (date, time) tuple
    """
    if not date_str:
        return None, None

    try:
        # Try common formats
        # Format: "January 25, 2026 at 10:00 AM"
        match = re.search(r'(\w+ \d+, \d{4})\s*(?:at\s*)?(\d{1,2}:\d{2}\s*[AP]M)?', date_str, re.IGNORECASE)
        if match:
            date_part = match.group(1)
            time_part = match.group(2)

            # Parse date
            dt = datetime.strptime(date_part, "%B %d, %Y")
            date = dt.strftime("%Y-%m-%d")

            # Parse time if present
            time = None
            if time_part:
                time_dt = datetime.strptime(time_part.strip(), "%I:%M %p")
                time = time_dt.strftime("%H:%M")

            return date, time

        # Try ISO datetime format (2026-01-25T10:00:00)
        iso_match = re.match(r'(\d{4}-\d{2}-\d{2})(?:T(\d{2}:\d{2}))?', date_str)
        if iso_match:
            iso_date = iso_match.group(1)
            iso_time = iso_match.group(2) if iso_match.group(2) else None
            return iso_date, iso_time

    except Exception as e:
        logger.warning(f"Failed to parse date '{date_str}': {e}")

    return None, None


def fetch_events_from_page(url: str) -> list[dict]:
    """
    Fetch and parse events from the Cobb County events page using Playwright.
    Returns list of raw event dictionaries.
    """
    events = []

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page()

            logger.info(f"Loading page: {url}")
            page.goto(url, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(4000)

            # Wait for events to load (they're rendered client-side)
            try:
                page.wait_for_selector("a[href*='/events/']", timeout=10000)
            except PlaywrightTimeout:
                logger.warning("Timeout waiting for event links to appear")

            # Get the rendered HTML
            html = page.content()
            browser.close()

        # Parse the rendered HTML
        soup = BeautifulSoup(html, "html.parser")

        # Look for event links in the page
        # Events typically have URLs like /events/2026-01-24event-name
        event_links = soup.find_all("a", href=re.compile(r'/events/\d{4}-\d{2}-\d{2}'))

        logger.info(f"Found {len(event_links)} event links on page")

        seen_urls = set()
        for link in event_links:
            event_url = link.get("href")
            if not event_url:
                continue

            # Make absolute URL
            if not event_url.startswith("http"):
                event_url = BASE_URL + event_url

            # Skip duplicates
            if event_url in seen_urls:
                continue
            seen_urls.add(event_url)

            # Get title from link text or nearby heading
            title = link.get_text(strip=True)

            # Extract date from URL
            date_match = re.search(r'/events/(\d{4}-\d{2}-\d{2})', event_url)
            event_date = date_match.group(1) if date_match else None

            if title and event_date:
                events.append({
                    "title": title,
                    "url": event_url,
                    "date": event_date,
                })

        logger.info(f"Parsed {len(events)} unique events from listing page")

    except Exception as e:
        logger.error(f"Failed to fetch events page: {e}")

    return events


def fetch_event_details(event_url: str) -> dict:
    """Fetch detailed information for a single event using Playwright."""
    details = {}

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page()

            page.goto(event_url, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(3000)

            # Get the rendered HTML
            html = page.content()
            browser.close()

        soup = BeautifulSoup(html, "html.parser")

        # Look for __NEXT_DATA__ which contains structured event data
        next_data_script = soup.find("script", {"id": "__NEXT_DATA__"})
        if next_data_script:
            data = json.loads(next_data_script.string)

            if "props" in data and "pageProps" in data["props"]:
                page_props = data["props"]["pageProps"]

                if "eventResource" in page_props:
                    event_data = page_props["eventResource"]

                    # Extract structured data
                    details["title"] = event_data.get("title")
                    details["description"] = event_data.get("body", {}).get("value", "")

                    # Date/time
                    if "field_event_date" in event_data:
                        date_field = event_data["field_event_date"]
                        if isinstance(date_field, dict):
                            details["start_datetime"] = date_field.get("value")
                            details["end_datetime"] = date_field.get("end_value")

                    # Location
                    if "field_location" in event_data:
                        location = event_data["field_location"]
                        if isinstance(location, dict):
                            details["location_name"] = location.get("title")
                        elif isinstance(location, str):
                            details["location_name"] = location

                    # Address
                    if "field_address" in event_data:
                        address = event_data["field_address"]
                        if isinstance(address, dict):
                            details["address"] = address.get("address_line1")
                            details["city"] = address.get("locality")
                            details["state"] = address.get("administrative_area")
                            details["zip"] = address.get("postal_code")

                    # Image
                    if "field_event_image" in event_data:
                        image = event_data["field_event_image"]
                        if isinstance(image, dict) and "uri" in image:
                            details["image_url"] = image["uri"]

        # Fallback: parse HTML if no structured data
        if not details.get("description"):
            # Look for description in meta tags or content
            meta_desc = soup.find("meta", {"name": "description"})
            if meta_desc:
                details["description"] = meta_desc.get("content", "")

    except Exception as e:
        logger.warning(f"Failed to fetch event details from {event_url}: {e}")

    return details


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Cobb County Public Library events."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        # Fetch events from listing page
        raw_events = fetch_events_from_page(EVENTS_PAGE)
        events_found = len(raw_events)

        today = datetime.now().date()

        # Process each event
        for raw_event in raw_events:
            try:
                event_url = raw_event["url"]
                title = raw_event["title"]
                event_date = raw_event["date"]

                # Skip cancelled events
                if "cancel" in title.lower():
                    logger.info(f"Skipping cancelled event: {title}")
                    continue

                # Skip past events
                try:
                    date_obj = datetime.strptime(event_date, "%Y-%m-%d").date()
                    if date_obj < today:
                        continue
                except ValueError:
                    continue

                # Fetch detailed information
                details = fetch_event_details(event_url)

                # Use details if available, otherwise use raw data
                final_title = details.get("title") or title
                description = details.get("description", "")

                # Parse datetime
                start_date = event_date
                start_time = None
                end_time = None

                if details.get("start_datetime"):
                    parsed_date, parsed_time = parse_event_date(details["start_datetime"])
                    if parsed_date:
                        start_date = parsed_date
                    if parsed_time:
                        start_time = parsed_time

                if details.get("end_datetime"):
                    _, end_time = parse_event_date(details["end_datetime"])

                # Determine venue
                location_name = details.get("location_name")
                library_name = parse_library_name(location_name) if location_name else None

                if library_name:
                    # Find matching branch
                    venue_data = None
                    for branch_data in LIBRARY_BRANCHES.values():
                        if branch_data["name"] == library_name:
                            venue_data = {
                                "name": branch_data["name"],
                                "slug": slugify(branch_data["name"]),
                                "address": branch_data.get("address"),
                                "city": branch_data["city"],
                                "state": branch_data["state"],
                                "zip": branch_data.get("zip"),
                                "venue_type": "library",
                            }
                            break

                    if not venue_data:
                        # Create venue from location name
                        venue_data = {
                            "name": library_name,
                            "slug": slugify(library_name),
                            "city": details.get("city", "Marietta"),
                            "state": details.get("state", "GA"),
                            "address": details.get("address"),
                            "zip": details.get("zip"),
                            "venue_type": "library",
                        }
                else:
                    # Fallback to main library system
                    venue_data = {
                        "name": "Cobb County Public Library System",
                        "slug": "cobb-county-public-library-system",
                        "city": "Marietta",
                        "state": "GA",
                        "venue_type": "library",
                    }

                venue_id = get_or_create_venue(venue_data)

                # Determine category
                category = determine_category(final_title, description)

                # Build tags
                tags = ["library", "free", "public"]

                # Add age-appropriate tags
                title_lower = final_title.lower()
                if any(word in title_lower for word in ["kids", "children", "storytime", "baby", "toddler"]):
                    tags.append("kids")
                    tags.append("family-friendly")
                if "teen" in title_lower or "tween" in title_lower:
                    tags.append("teens")
                if "adult" in title_lower and "young adult" not in title_lower:
                    tags.append("adults")

                # Add activity tags
                if "book club" in title_lower:
                    tags.append("book-club")
                if any(word in title_lower for word in ["craft", "art", "make"]):
                    tags.append("craft")
                if "computer" in title_lower or "tech" in title_lower:
                    tags.append("educational")

                # Clean description HTML
                if description:
                    soup = BeautifulSoup(description, "html.parser")
                    description = soup.get_text(separator=" ", strip=True)
                    description = re.sub(r"\s+", " ", description).strip()
                    if len(description) > 5000:
                        description = description[:5000]

                # Generate content hash
                content_hash = generate_content_hash(final_title, venue_data["name"], start_date)

                # Check if event already exists
                if find_event_by_hash(content_hash):
                    events_updated += 1
                    continue

                # Create event record
                event_record = {
                    "source_id": source_id,
                    "venue_id": venue_id,
                    "title": final_title,
                    "description": description if description else None,
                    "start_date": start_date,
                    "start_time": start_time,
                    "end_date": None,
                    "end_time": end_time,
                    "is_all_day": False,
                    "category": category,
                    "subcategory": None,
                    "tags": tags,
                    "price_min": None,
                    "price_max": None,
                    "price_note": None,
                    "is_free": True,
                    "source_url": event_url,
                    "ticket_url": None,
                    "image_url": details.get("image_url"),
                    "raw_text": None,
                    "extraction_confidence": 0.90,
                    "is_recurring": False,
                    "recurrence_rule": None,
                    "content_hash": content_hash,
                }

                # Insert event
                insert_event(event_record)
                events_new += 1
                logger.info(f"Added: {final_title} on {start_date} at {venue_data['name']}")

            except Exception as e:
                logger.error(f"Failed to process event {raw_event.get('url', 'unknown')}: {e}")
                continue

        logger.info(
            f"Cobb County Library crawl complete: {events_found} found, "
            f"{events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Cobb County Library: {e}")
        raise

    return events_found, events_new, events_updated
