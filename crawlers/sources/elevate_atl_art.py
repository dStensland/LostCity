"""
Crawler for Elevate ATL Art (elevateatlart.com).
Annual temporary public art festival activating various Atlanta neighborhoods.
Includes murals, installations, performances, music, spoken word, and community engagement.
All programming is FREE and open to the public.

Site uses JavaScript rendering - must use Playwright.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime
from typing import Optional

from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout

from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://elevateatlart.com"

# Generic organization venue for events without specific locations
VENUE_DATA = {
    "name": "Elevate ATL Art",
    "slug": "elevate-atl-art",
    "address": "Various Locations",
    "neighborhood": "Downtown",
    "city": "Atlanta",
    "state": "GA",
    "lat": 33.7490,
    "lng": -84.3880,
    "venue_type": "organization",
    "spot_type": "organization",
    "website": BASE_URL,
    "description": "Annual temporary public art festival activating Atlanta neighborhoods with murals, installations, performances, and community engagement.",
}


def parse_date_text(date_text: str) -> tuple[Optional[str], Optional[str], Optional[str], Optional[str]]:
    """
    Parse date from various formats found on the site.
    Returns (start_date, end_date, start_time, end_time) as (YYYY-MM-DD, YYYY-MM-DD, HH:MM, HH:MM).

    Examples:
    - "September 20, 2025"
    - "Sept 20-22, 2025"
    - "October 5, 2025 at 7:00 PM"
    - "Sep 20 - Oct 1, 2025"
    """
    try:
        date_text = date_text.strip()
        current_year = datetime.now().year

        # Pattern: "Month Day-Day, Year" (e.g., "Sept 20-22, 2025")
        match = re.match(
            r'([A-Za-z]+)\s+(\d{1,2})\s*-\s*(\d{1,2}),?\s+(\d{4})',
            date_text,
            re.IGNORECASE
        )
        if match:
            month, day1, day2, year = match.groups()
            try:
                start_dt = datetime.strptime(f"{month} {day1} {year}", "%B %d %Y")
            except ValueError:
                start_dt = datetime.strptime(f"{month} {day1} {year}", "%b %d %Y")

            try:
                end_dt = datetime.strptime(f"{month} {day2} {year}", "%B %d %Y")
            except ValueError:
                end_dt = datetime.strptime(f"{month} {day2} {year}", "%b %d %Y")

            return start_dt.strftime("%Y-%m-%d"), end_dt.strftime("%Y-%m-%d"), None, None

        # Pattern: "Month Day - Month Day, Year" (e.g., "Sep 20 - Oct 1, 2025")
        match = re.match(
            r'([A-Za-z]+)\s+(\d{1,2})\s*-\s*([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})',
            date_text,
            re.IGNORECASE
        )
        if match:
            month1, day1, month2, day2, year = match.groups()
            try:
                start_dt = datetime.strptime(f"{month1} {day1} {year}", "%B %d %Y")
            except ValueError:
                start_dt = datetime.strptime(f"{month1} {day1} {year}", "%b %d %Y")

            try:
                end_dt = datetime.strptime(f"{month2} {day2} {year}", "%B %d %Y")
            except ValueError:
                end_dt = datetime.strptime(f"{month2} {day2} {year}", "%b %d %Y")

            return start_dt.strftime("%Y-%m-%d"), end_dt.strftime("%Y-%m-%d"), None, None

        # Pattern: "Month Day, Year at Time" (e.g., "October 5, 2025 at 7:00 PM")
        match = re.match(
            r'([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})\s+at\s+(\d{1,2}):(\d{2})\s*(am|pm)',
            date_text,
            re.IGNORECASE
        )
        if match:
            month, day, year, hour, minute, period = match.groups()
            try:
                dt = datetime.strptime(f"{month} {day} {year}", "%B %d %Y")
            except ValueError:
                dt = datetime.strptime(f"{month} {day} {year}", "%b %d %Y")

            # Parse time
            hour = int(hour)
            period = period.lower()
            if period == "pm" and hour != 12:
                hour += 12
            elif period == "am" and hour == 12:
                hour = 0

            time_str = f"{hour:02d}:{minute}"
            return dt.strftime("%Y-%m-%d"), None, time_str, None

        # Pattern: "Month Day, Year" (e.g., "September 20, 2025")
        match = re.match(
            r'([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})',
            date_text,
            re.IGNORECASE
        )
        if match:
            month, day, year = match.groups()
            try:
                dt = datetime.strptime(f"{month} {day} {year}", "%B %d %Y")
            except ValueError:
                dt = datetime.strptime(f"{month} {day} {year}", "%b %d %Y")

            return dt.strftime("%Y-%m-%d"), None, None, None

        # Pattern: "Month Day" (e.g., "September 20") - assume current or next year
        match = re.match(r'([A-Za-z]+)\s+(\d{1,2})', date_text, re.IGNORECASE)
        if match:
            month, day = match.groups()
            try:
                dt = datetime.strptime(f"{month} {day} {current_year}", "%B %d %Y")
            except ValueError:
                dt = datetime.strptime(f"{month} {day} {current_year}", "%b %d %Y")

            # If date is in the past, assume next year
            if dt.date() < datetime.now().date():
                dt = dt.replace(year=current_year + 1)

            return dt.strftime("%Y-%m-%d"), None, None, None

    except (ValueError, AttributeError) as e:
        logger.debug(f"Could not parse date from '{date_text}': {e}")

    return None, None, None, None


def determine_category_and_tags(title: str, description: str = "", location: str = "") -> tuple[str, Optional[str], list[str]]:
    """Determine category and tags based on event title, description, and location."""
    title_lower = title.lower()
    description_lower = description.lower() if description else ""
    combined = f"{title_lower} {description_lower}".lower()

    base_tags = ["elevate-atl", "public-art", "festival", "free"]

    # Mural-related events
    if any(w in combined for w in ["mural", "painting", "street art", "wall art"]):
        return "art", "mural", base_tags + ["mural", "street-art"]

    # Installation art
    if any(w in combined for w in ["installation", "sculpture", "exhibit"]):
        return "art", "installation", base_tags + ["installation", "contemporary-art"]

    # Performance art
    if any(w in combined for w in ["performance", "performer", "dance"]):
        return "art", "performance", base_tags + ["performance", "performance-art"]

    # Music performances
    if any(w in combined for w in ["music", "concert", "dj", "band", "musician"]):
        return "music", "performance", base_tags + ["music", "live-music"]

    # Spoken word, poetry
    if any(w in combined for w in ["spoken word", "poetry", "poet", "slam"]):
        return "community", "spoken_word", base_tags + ["spoken-word", "poetry"]

    # Community engagement, workshops
    if any(w in combined for w in ["workshop", "class", "community", "engagement", "discussion"]):
        return "community", "workshop", base_tags + ["community", "workshop"]

    # Opening events, receptions
    if any(w in combined for w in ["opening", "reception", "launch", "kick off", "kickoff"]):
        return "art", "opening", base_tags + ["opening", "reception"]

    # Tours, walks
    if any(w in combined for w in ["tour", "walk", "explore"]):
        return "community", "tour", base_tags + ["tour", "art-walk"]

    # Default to art festival
    return "art", "festival", base_tags


def extract_location_info(location_text: str) -> tuple[Optional[str], Optional[str]]:
    """
    Extract neighborhood from location text.
    Returns (neighborhood, address_hint).

    Examples:
    - "Westview" -> ("Westview", None)
    - "West End Plaza, 692 Lee St SW" -> ("West End", "692 Lee St SW")
    - "Castleberry Hill" -> ("Castleberry Hill", None)
    """
    location_text = location_text.strip() if location_text else ""

    # Known Elevate ATL neighborhoods
    neighborhoods = {
        "westview": "Westview",
        "west end": "West End",
        "castleberry hill": "Castleberry Hill",
        "south downtown": "South Downtown",
        "downtown": "Downtown",
        "mechanicsville": "Mechanicsville",
        "peoplestown": "Peoplestown",
        "summerhill": "Summerhill",
        "adair park": "Adair Park",
        "pittsburgh": "Pittsburgh",
        "english avenue": "English Avenue",
        "vine city": "Vine City",
    }

    location_lower = location_text.lower()

    for key, neighborhood in neighborhoods.items():
        if key in location_lower:
            # Try to extract address if present
            # Pattern: street number + street name
            addr_match = re.search(r'(\d+\s+[A-Za-z\s]+(?:St|Street|Ave|Avenue|Rd|Road|Blvd|Boulevard|Dr|Drive|Way|Pl|Place)\.?\s+(?:NW|NE|SW|SE)?)', location_text, re.IGNORECASE)
            address = addr_match.group(1).strip() if addr_match else None
            return neighborhood, address

    return None, None


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl Elevate ATL Art events using Playwright.

    The site structure varies year to year, so we'll look for:
    - Event pages, schedule pages, program pages
    - Date information, titles, descriptions
    - Location/neighborhood information
    - Images from event cards or detail pages
    """
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                viewport={"width": 1920, "height": 1080},
            )
            page = context.new_page()

            # Get default venue ID
            default_venue_id = get_or_create_venue(VENUE_DATA)

            logger.info(f"Fetching Elevate ATL Art homepage: {BASE_URL}")

            try:
                page.goto(BASE_URL, wait_until="domcontentloaded", timeout=30000)
                page.wait_for_timeout(3000)
            except PlaywrightTimeout:
                logger.warning("Timeout loading homepage, continuing with partial content")

            # Scroll to load all content
            for _ in range(3):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1000)

            # Look for links to event/schedule/program pages
            event_page_patterns = [
                r'/event',
                r'/schedule',
                r'/program',
                r'/calendar',
                r'/whats-on',
                r'/happenings',
            ]

            event_page_links = []
            all_links = page.query_selector_all("a[href]")

            for link in all_links:
                href = link.get_attribute("href")
                if not href:
                    continue

                # Make absolute URL
                if href.startswith("/"):
                    href = BASE_URL + href
                elif not href.startswith("http"):
                    continue

                # Check if it matches event page patterns
                for pattern in event_page_patterns:
                    if re.search(pattern, href, re.IGNORECASE):
                        if href not in event_page_links:
                            event_page_links.append(href)
                        break

            logger.info(f"Found {len(event_page_links)} potential event pages")

            # Also check main page for event content
            pages_to_check = [BASE_URL] + event_page_links[:5]  # Limit to avoid too many requests

            for page_url in pages_to_check:
                try:
                    if page_url != BASE_URL:
                        logger.info(f"Checking page: {page_url}")
                        page.goto(page_url, wait_until="domcontentloaded", timeout=30000)
                        page.wait_for_timeout(2000)

                        # Scroll to load content
                        for _ in range(2):
                            page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                            page.wait_for_timeout(1000)

                    # Look for event cards, articles, or similar containers
                    # Try multiple selectors since site structure may vary
                    event_selectors = [
                        "article",
                        "[class*='event']",
                        "[class*='program']",
                        "[class*='card']",
                        ".schedule-item",
                        ".event-item",
                    ]

                    event_elements = []
                    for selector in event_selectors:
                        elements = page.query_selector_all(selector)
                        if elements and len(elements) > event_elements.__len__():
                            event_elements = elements
                            logger.debug(f"Using selector '{selector}' found {len(elements)} elements")

                    if not event_elements:
                        logger.debug(f"No event elements found on {page_url}")
                        continue

                    logger.info(f"Processing {len(event_elements)} potential events from {page_url}")

                    for element in event_elements:
                        try:
                            # Extract text content
                            element_text = element.inner_text().strip()

                            # Skip if too short to be meaningful
                            if len(element_text) < 10:
                                continue

                            # Try to find title
                            title = None
                            for tag in ["h1", "h2", "h3", "h4", ".title", "[class*='title']", "[class*='name']"]:
                                title_elem = element.query_selector(tag)
                                if title_elem:
                                    title_text = title_elem.inner_text().strip()
                                    if title_text and len(title_text) >= 3:
                                        title = title_text
                                        break

                            # If no title found in specific element, try to extract from text
                            if not title:
                                lines = [l.strip() for l in element_text.split("\n") if l.strip()]
                                # First substantial line is often the title
                                for line in lines:
                                    if len(line) >= 5 and not re.match(r'^\d{1,2}[:/]', line):
                                        title = line
                                        break

                            if not title or len(title) < 3:
                                continue

                            # Skip navigation/footer elements
                            if any(nav in title.lower() for nav in ["menu", "navigation", "footer", "header", "subscribe", "instagram", "facebook"]):
                                continue

                            # Try to extract date
                            date_text = None
                            for tag in [".date", "[class*='date']", "time"]:
                                date_elem = element.query_selector(tag)
                                if date_elem:
                                    date_text = date_elem.inner_text().strip()
                                    break

                            # If no explicit date element, look in the text
                            if not date_text:
                                # Search for date patterns in element text
                                date_match = re.search(
                                    r'(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}(?:,?\s+\d{4})?',
                                    element_text,
                                    re.IGNORECASE
                                )
                                if date_match:
                                    date_text = date_match.group(0)

                            if not date_text:
                                logger.debug(f"No date found for: {title[:50]}")
                                continue

                            start_date, end_date, start_time, end_time = parse_date_text(date_text)

                            if not start_date:
                                logger.debug(f"Could not parse date from: {date_text}")
                                continue

                            # Try to extract description
                            description = ""
                            for tag in ["p", ".description", "[class*='description']", "[class*='content']"]:
                                desc_elem = element.query_selector(tag)
                                if desc_elem:
                                    desc_text = desc_elem.inner_text().strip()
                                    if desc_text and len(desc_text) > len(description):
                                        description = desc_text

                            # Extract location/neighborhood
                            location_text = ""
                            for tag in [".location", "[class*='location']", "[class*='venue']", "[class*='place']"]:
                                loc_elem = element.query_selector(tag)
                                if loc_elem:
                                    location_text = loc_elem.inner_text().strip()
                                    break

                            neighborhood, address = extract_location_info(location_text)

                            # Extract image
                            image_url = None
                            img_elem = element.query_selector("img")
                            if img_elem:
                                src = img_elem.get_attribute("src")
                                if src:
                                    # Make absolute URL
                                    if src.startswith("http"):
                                        image_url = src
                                    elif src.startswith("//"):
                                        image_url = "https:" + src
                                    elif src.startswith("/"):
                                        image_url = BASE_URL + src

                            # Extract event URL
                            event_url = page_url
                            link_elem = element.query_selector("a[href]")
                            if link_elem:
                                href = link_elem.get_attribute("href")
                                if href:
                                    if href.startswith("http"):
                                        event_url = href
                                    elif href.startswith("/"):
                                        event_url = BASE_URL + href

                            events_found += 1

                            # Use default venue unless we have specific location info
                            venue_id = default_venue_id
                            venue_name = "Elevate ATL Art"

                            # If we have neighborhood info, could create/use a neighborhood-specific venue
                            # For now, using the generic organization venue for all events

                            # Generate content hash
                            content_hash = generate_content_hash(title, venue_name, start_date)

                            # Check for existing event

                            # Determine category and tags
                            category, subcategory, tags = determine_category_and_tags(
                                title, description, location_text
                            )

                            # Add neighborhood tag if available
                            if neighborhood:
                                tags.append(neighborhood.lower().replace(" ", "-"))

                            # Build event record
                            event_record = {
                                "source_id": source_id,
                                "venue_id": venue_id,
                                "title": title,
                                "description": description if description else None,
                                "start_date": start_date,
                                "start_time": start_time,
                                "end_date": end_date,
                                "end_time": end_time,
                                "is_all_day": False,
                                "category": category,
                                "subcategory": subcategory,
                                "tags": tags,
                                "price_min": None,
                                "price_max": None,
                                "price_note": "Free admission",
                                "is_free": True,
                                "source_url": event_url,
                                "ticket_url": event_url,
                                "image_url": image_url,
                                "raw_text": f"{title} - {location_text}" if location_text else title,
                                "extraction_confidence": 0.85,
                                "is_recurring": False,
                                "recurrence_rule": None,
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
                                logger.info(f"Added: {title} on {start_date}" + (f" at {start_time}" if start_time else ""))
                            except Exception as e:
                                logger.error(f"Failed to insert event '{title}': {e}")

                        except Exception as e:
                            logger.debug(f"Error parsing event element: {e}")
                            continue

                except PlaywrightTimeout:
                    logger.warning(f"Timeout loading {page_url}, continuing")
                    continue
                except Exception as e:
                    logger.warning(f"Error processing page {page_url}: {e}")
                    continue

            browser.close()

        # If no events found, log it but don't error (festival may not be active)
        if events_found == 0:
            logger.info("No upcoming Elevate ATL Art events found - festival may not be currently active")
        else:
            logger.info(
                f"Elevate ATL Art crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
            )

    except PlaywrightTimeout as e:
        logger.error(f"Timeout fetching Elevate ATL Art: {e}")
        # Don't raise - allow graceful handling when festival isn't active
    except Exception as e:
        logger.error(f"Failed to crawl Elevate ATL Art: {e}")
        raise

    return events_found, events_new, events_updated
