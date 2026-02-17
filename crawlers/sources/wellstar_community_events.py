"""
Crawler for WellStar Health System Community Events (wellstar.org).

WellStar Health System is a comprehensive healthcare network serving metro Atlanta
with 13 hospitals and hundreds of medical offices. They host community health events
including Speaking About Wellness seminars, health screenings, WellStar Mobile Markets,
Understanding Your Newborn classes, faith-based wellness programs, workplace wellness
events, and community health fairs.

STRATEGY:
- Scrape the event calendar page at /event-calendar
- Extract community health events, classes, screenings, support groups
- Events span multiple hospital locations across metro Atlanta
- Tag appropriately: community-health, hospital, wellness, family-friendly
- Most events are paid classes or free community health programs
- Category: "education" for classes, "community" for health fairs/screenings

Relevant for hospital portal's community health track.
"""

from __future__ import annotations

import re
import logging
from typing import Optional
from datetime import datetime

import requests
from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout

from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash
from date_utils import parse_human_date

logger = logging.getLogger(__name__)

BASE_URL = "https://www.wellstar.org"
EVENTS_URL = f"{BASE_URL}/event-calendar"

# Main WellStar venue - Kennestone Hospital (flagship)
VENUE_DATA = {
    "name": "WellStar Health System",
    "slug": "wellstar-health-system",
    "address": "677 Church St NE",
    "neighborhood": "Marietta",
    "city": "Marietta",
    "state": "GA",
    "zip": "30060",
    "lat": 33.9537,
    "lng": -84.5493,
    "venue_type": "hospital",
    "spot_type": "hospital",
    "website": BASE_URL,
    "vibes": ["community-health", "hospital", "wellness", "family-friendly"],
}


def parse_time_string(time_str: str) -> Optional[str]:
    """
    Parse time string to 24-hour format.
    Examples: '10:00AM ET', '2:00PM ET', '6:00 PM', '12:30 PM'
    """
    try:
        time_str = time_str.strip().upper()

        # Remove timezone indicators
        time_str = re.sub(r'\s*(ET|EST|EDT|CST|CDT|PST|PDT)\s*', ' ', time_str)

        # If it's a range, extract the first time
        if ' to ' in time_str or '-' in time_str or '–' in time_str:
            time_str = re.split(r'\s+to\s+|-|–', time_str)[0].strip()

        # Pattern: H:MM AM/PM or H AM/PM or HAM/PM
        match = re.search(r'(\d{1,2})(?::(\d{2}))?\s*(AM|PM)', time_str)
        if match:
            hour = int(match.group(1))
            minute = match.group(2) or "00"
            period = match.group(3)

            if period == "PM" and hour != 12:
                hour += 12
            elif period == "AM" and hour == 12:
                hour = 0

            return f"{hour:02d}:{minute}"

    except (ValueError, AttributeError) as e:
        logger.debug(f"Could not parse time '{time_str}': {e}")

    return None


def parse_date_range(date_str: str) -> tuple[Optional[str], Optional[str]]:
    """
    Parse date range from WellStar format.
    Examples:
    - "Saturday, February 14 : 10:00AM ET to Saturday, February 21 : 2:00PM ET"
    - "Thursday, February 27 : 6:00PM ET to 7:00PM ET"

    Returns (start_date, end_date) as YYYY-MM-DD strings.
    """
    try:
        # Check if it's a date range (has "to" with dates on both sides)
        if ' to ' in date_str:
            parts = date_str.split(' to ')

            # Extract date from first part
            # Format: "Saturday, February 14 : 10:00AM ET"
            first_match = re.search(
                r'(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s+'
                r'(January|February|March|April|May|June|July|August|September|October|November|December)\s+'
                r'(\d{1,2})',
                parts[0],
                re.IGNORECASE
            )

            if first_match:
                start_date_str = f"{first_match.group(2)} {first_match.group(3)}"
                start_date = parse_human_date(start_date_str)

                # Check if second part has a full date or just time
                second_match = re.search(
                    r'(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s+'
                    r'(January|February|March|April|May|June|July|August|September|October|November|December)\s+'
                    r'(\d{1,2})',
                    parts[1],
                    re.IGNORECASE
                )

                if second_match:
                    # Full date range
                    end_date_str = f"{second_match.group(2)} {second_match.group(3)}"
                    end_date = parse_human_date(end_date_str)
                    return start_date, end_date
                else:
                    # Same day, just time range
                    return start_date, None

        # Not a range, just parse single date
        date_match = re.search(
            r'(January|February|March|April|May|June|July|August|September|October|November|December)\s+'
            r'(\d{1,2})',
            date_str,
            re.IGNORECASE
        )

        if date_match:
            date_str_clean = f"{date_match.group(1)} {date_match.group(2)}"
            start_date = parse_human_date(date_str_clean)
            return start_date, None

    except Exception as e:
        logger.debug(f"Could not parse date range '{date_str}': {e}")

    return None, None


def determine_category_and_tags(event_type: str, title: str, description: str = "") -> tuple[str, list[str], bool]:
    """
    Determine category, tags, and is_free flag based on event content.
    Returns (category, tags, is_free).

    Valid categories: music, film, comedy, theater, art, sports, food_drink,
    nightlife, community, fitness, family, learning, dance, tours, meetup,
    words, religious, markets, wellness
    """
    text = f"{event_type} {title} {description}".lower()
    tags = ["community-health", "hospital"]

    # Event type classification
    if event_type:
        event_type_lower = event_type.lower()

        # Classes and education - use "learning" or "wellness" category
        if event_type_lower in ["class", "virtual"]:
            # Determine if it's more health/wellness or general learning
            if any(word in text for word in ["birth", "newborn", "baby", "breastfeeding", "childbirth", "maternity", "prenatal"]):
                category = "family"
                tags.extend(["prenatal", "family-friendly", "health-education"])
            elif any(word in text for word in ["cpr", "first aid", "safety"]):
                category = "learning"
                tags.extend(["health-education", "safety"])
            elif any(word in text for word in ["nutrition", "diabetes", "weight", "fitness", "wellness"]):
                category = "wellness"
                tags.extend(["health-education", "nutrition"])
            else:
                # Default for classes
                category = "learning"
                tags.extend(["health-education"])

        # Community events and health fairs
        elif event_type_lower == "community":
            category = "community"
            tags.extend(["community-health"])

        # Support groups
        elif event_type_lower == "support group":
            category = "wellness"
            tags.extend(["support-group", "mental-health"])

        # Fundraising events
        elif event_type_lower == "fundraising":
            category = "community"
            tags.extend(["fundraiser"])

        # General events (health fairs, screenings, etc.)
        elif event_type_lower == "event":
            # Specific event types
            if any(word in text for word in ["screening", "health fair", "wellness check", "blood pressure"]):
                category = "wellness"
                tags.extend(["health-screening", "preventive-care"])
            elif any(word in text for word in ["mobile market", "food", "farmers market"]):
                category = "markets"
                tags.extend(["food-access", "health-equity"])
            elif any(word in text for word in ["wellness", "seminar", "speaking about wellness"]):
                category = "wellness"
                tags.extend(["health-education"])
            else:
                category = "community"

        # Default
        else:
            category = "community"
    else:
        category = "community"

    # Check for free events
    is_free = False
    if any(word in text for word in ["free", "no cost", "no charge", "complimentary", "no fee"]):
        is_free = True
        tags.append("free")

    # Add family-friendly tag for appropriate events
    if any(word in text for word in ["family", "children", "kids", "newborn", "baby", "parent"]):
        tags.append("family-friendly")

    return category, list(set(tags)), is_free


def try_simple_requests_first(url: str) -> Optional[BeautifulSoup]:
    """
    Try fetching with simple requests first (faster than Playwright).
    Returns BeautifulSoup object if successful, None if needs Playwright.

    For WellStar, the events are JS-rendered, so this will likely fail
    and we'll fall back to Playwright.
    """
    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
        }
        response = requests.get(url, headers=headers, timeout=20)
        response.raise_for_status()

        soup = BeautifulSoup(response.text, "html.parser")

        # Check if we got meaningful content with actual event items
        # WellStar uses .article-item for events
        if soup.select(".article-item"):
            return soup

        return None
    except Exception as e:
        logger.debug(f"Simple request failed, will use Playwright: {e}")
        return None


def extract_location_from_address(address_text: str) -> Optional[str]:
    """
    Extract specific WellStar location from address text.
    Examples:
    - "Wellstar Kennestone Hospital, 677 Church Street Northeast, Marietta, GA, USA"
    - "Virtual Class"
    - "Attend online"
    """
    if not address_text:
        return None

    # Virtual events
    if any(word in address_text.lower() for word in ["virtual", "online", "zoom", "webinar"]):
        return "Virtual Event"

    # Extract hospital/facility name
    hospital_match = re.search(
        r'(Wellstar|WellStar)\s+([^,]+?)(?:\s+Hospital|\s+Medical Center)?(?:,|$)',
        address_text,
        re.IGNORECASE
    )

    if hospital_match:
        return hospital_match.group(0).strip().rstrip(',')

    return None


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl WellStar Health System community events calendar.

    First tries simple requests, falls back to Playwright if the page
    requires JavaScript rendering.
    """
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        # Create venue record
        venue_id = get_or_create_venue(VENUE_DATA)

        # Try simple requests first
        logger.info(f"Trying simple fetch: {EVENTS_URL}")
        soup = try_simple_requests_first(EVENTS_URL)

        # If simple request didn't work, use Playwright
        if not soup:
            logger.info(f"Fetching with Playwright: {EVENTS_URL}")
            with sync_playwright() as p:
                browser = p.chromium.launch(headless=True)
                context = browser.new_context(
                    user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                    viewport={"width": 1920, "height": 1080},
                )
                page = context.new_page()
                page.goto(EVENTS_URL, wait_until="domcontentloaded", timeout=30000)
                page.wait_for_timeout(3000)

                # Scroll to load any lazy-loaded content
                for _ in range(3):
                    page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                    page.wait_for_timeout(1000)

                html_content = page.content()
                soup = BeautifulSoup(html_content, "html.parser")
                browser.close()

        # Look for event containers
        # WellStar uses <div class="article-item px-2 px-md-0"> for each event
        events = soup.select(".article-item")

        if not events or len(events) == 0:
            logger.info("No event items found on page")
            logger.info(f"WellStar Health System venue record ensured (ID: {venue_id})")
            return 0, 0, 0

        logger.info(f"Found {len(events)} events on page")

        # Parse each event
        for event_elem in events:
            try:
                # Extract event type (Virtual, Class, Community, etc.)
                event_type = None
                event_type_elem = event_elem.select_one(".purple-text")
                if event_type_elem:
                    event_type = event_type_elem.get_text(strip=True)

                # Extract title
                title_elem = event_elem.select_one(".headline-card")
                if not title_elem:
                    continue

                title = title_elem.get_text(strip=True)
                if not title or len(title) < 3:
                    continue

                # Extract event URL
                event_url = EVENTS_URL
                link_elem = event_elem.select_one("a.headline-card")
                if link_elem and link_elem.get("href"):
                    href = link_elem.get("href")
                    if href.startswith("http"):
                        event_url = href
                    elif href.startswith("/"):
                        event_url = BASE_URL + href

                # Extract date and time from time-address-box
                date_time_elem = event_elem.select_one(".box-heading")
                if not date_time_elem:
                    logger.debug(f"No date/time found for: {title}")
                    continue

                date_time_text = date_time_elem.get_text(strip=True)

                # Parse date range
                start_date, end_date = parse_date_range(date_time_text)
                if not start_date:
                    logger.debug(f"Could not parse date '{date_time_text}' for: {title}")
                    continue

                events_found += 1

                # Extract time from date_time_text
                start_time = None
                end_time = None

                # Extract start time
                start_time_match = re.search(r':\s*(\d{1,2}:\d{2}\s*[AP]M\s*ET)', date_time_text)
                if start_time_match:
                    start_time = parse_time_string(start_time_match.group(1))

                # Extract end time (after "to")
                if ' to ' in date_time_text:
                    end_time_match = re.search(r'to\s+.*?(\d{1,2}:\d{2}\s*[AP]M\s*ET)', date_time_text)
                    if end_time_match:
                        end_time = parse_time_string(end_time_match.group(1))

                # Extract description
                description = None
                desc_elem = event_elem.select_one(".event-des")
                if desc_elem:
                    description = desc_elem.get_text(strip=True)
                    if len(description) > 500:
                        description = description[:497] + "..."

                # Extract location/address
                location = None
                address_elems = event_elem.select(".address")
                if address_elems:
                    address_parts = [elem.get_text(strip=True) for elem in address_elems]
                    location = " ".join(address_parts)

                    # Extract specific hospital/location
                    specific_location = extract_location_from_address(location)
                    if specific_location and description:
                        description = f"{description}\n\nLocation: {specific_location}"
                    elif specific_location:
                        description = f"Location: {specific_location}"

                # Extract price
                price_min = None
                price_max = None
                price_note = None
                is_free = False

                price_elem = event_elem.select_one(".price")
                if price_elem:
                    price_text = price_elem.get_text(strip=True)
                    if price_text and price_text.lower() not in ["free", ""]:
                        try:
                            # Parse price like "80.00"
                            price_value = float(price_text.replace("$", "").replace(",", ""))
                            price_min = price_value
                            price_max = price_value
                            price_note = f"${price_value:.2f}"
                        except ValueError:
                            price_note = price_text
                    elif price_text.lower() == "free":
                        is_free = True

                # Extract image
                image_url = None
                img_elem = event_elem.select_one("img")
                if img_elem:
                    image_url = img_elem.get("src")
                    if image_url and not image_url.startswith("http"):
                        image_url = BASE_URL + image_url if image_url.startswith("/") else None
                    # Skip placeholder images
                    if image_url and "search-result.png" in image_url:
                        image_url = None

                # Determine category and tags
                category, tags, is_free_inferred = determine_category_and_tags(
                    event_type or "", title, description or ""
                )

                # Use explicit price info if available
                if not is_free and is_free_inferred:
                    is_free = is_free_inferred

                # Generate content hash for deduplication
                content_hash = generate_content_hash(
                    title, "WellStar Health System", start_date
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
                    "end_date": end_date,
                    "end_time": end_time,
                    "is_all_day": False,
                    "category": category,
                    "subcategory": event_type,
                    "tags": tags,
                    "price_min": price_min,
                    "price_max": price_max,
                    "price_note": price_note,
                    "is_free": is_free,
                    "source_url": event_url,
                    "ticket_url": event_url,
                    "image_url": image_url,
                    "raw_text": event_elem.get_text()[:500],
                    "extraction_confidence": 0.85,
                    "is_recurring": False,
                    "recurrence_rule": None,
                    "content_hash": content_hash,
                }

                try:
                    insert_event(event_record)
                    events_new += 1
                    logger.info(f"Added: {title} on {start_date}")
                except Exception as e:
                    logger.error(f"Failed to insert event '{title}': {e}")

            except Exception as e:
                logger.warning(f"Error parsing event element: {e}")
                continue

        logger.info(
            f"WellStar Health System crawl complete: {events_found} found, "
            f"{events_new} new, {events_updated} updated"
        )

    except PlaywrightTimeout as e:
        logger.error(f"Timeout fetching WellStar events: {e}")
        raise
    except Exception as e:
        logger.error(f"Failed to crawl WellStar Health System: {e}")
        raise

    return events_found, events_new, events_updated
