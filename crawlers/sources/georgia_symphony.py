"""
Crawler for Georgia Symphony Orchestra (georgiasymphony.org).

Professional symphony orchestra serving metro Atlanta with classical, jazz, pops,
and educational concerts. Site uses WordPress with ova-events plugin requiring
JavaScript rendering via Playwright.

Performs at multiple venues including:
- Bailey Performance Center (Kennesaw)
- The Earl and Rachel Smith Strand Theatre (Marietta)
- Atlanta Symphony Hall
- First Presbyterian Church Marietta
- Jennie T. Anderson Theatre
"""

from __future__ import annotations

import re
import logging
from datetime import datetime
from typing import Optional

from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout

from db import get_or_create_venue, insert_event, find_event_by_hash
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://www.georgiasymphony.org"
EVENTS_URL = f"{BASE_URL}/all-events/"

# Venue mappings for events at different locations
VENUE_MAP = {
    "bailey performance center": {
        "name": "Dr. Bobbie Bailey & Family Performance Center",
        "slug": "bailey-performance-center",
        "address": "3201 Campus Loop Rd",
        "neighborhood": "Kennesaw",
        "city": "Kennesaw",
        "state": "GA",
        "zip": "30144",
        "venue_type": "concert-hall",
        "website": "https://www.kennesaw.edu/arts/music/venues/bailey.php",
    },
    "strand theatre": {
        "name": "The Earl and Rachel Smith Strand Theatre",
        "slug": "strand-theatre-marietta",
        "address": "117 N Park Square",
        "neighborhood": "Marietta Square",
        "city": "Marietta",
        "state": "GA",
        "zip": "30060",
        "venue_type": "theater",
        "website": "https://earlsmithstrand.org",
    },
    "atlanta symphony hall": {
        "name": "Atlanta Symphony Hall",
        "slug": "atlanta-symphony-hall",
        "address": "1280 Peachtree St NE",
        "neighborhood": "Midtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30309",
        "venue_type": "concert-hall",
        "website": "https://www.atlantasymphony.org",
    },
    "first presbyterian church marietta": {
        "name": "First Presbyterian Church Marietta",
        "slug": "first-presbyterian-marietta",
        "address": "189 Church St NE",
        "neighborhood": "Marietta Square",
        "city": "Marietta",
        "state": "GA",
        "zip": "30060",
        "venue_type": "church",
        "website": "https://fpcmarietta.org",
    },
    "jennie t. anderson theatre": {
        "name": "Jennie T. Anderson Theatre",
        "slug": "jennie-anderson-theatre",
        "address": "850 Kennesaw Due West Rd NW",
        "neighborhood": "Marietta",
        "city": "Marietta",
        "state": "GA",
        "zip": "30152",
        "venue_type": "theater",
        "website": "https://www.cobbk12.org",
    },
}

# Default to Bailey Performance Center (their primary venue)
DEFAULT_VENUE = "bailey performance center"


def get_venue_for_event(venue_name: str) -> dict:
    """
    Map event venue name to venue data.
    Returns venue dict for insertion/lookup.
    """
    venue_key = venue_name.lower().strip()

    # Try exact match first
    for key, venue_data in VENUE_MAP.items():
        if key in venue_key:
            return venue_data

    # Try partial matches
    if "bailey" in venue_key or "ksu" in venue_key:
        return VENUE_MAP["bailey performance center"]
    if "strand" in venue_key:
        return VENUE_MAP["strand theatre"]
    if "symphony hall" in venue_key or "woodruff" in venue_key:
        return VENUE_MAP["atlanta symphony hall"]
    if "presbyterian" in venue_key or "church" in venue_key:
        return VENUE_MAP["first presbyterian church marietta"]
    if "anderson" in venue_key or "jennie" in venue_key:
        return VENUE_MAP["jennie t. anderson theatre"]

    # Default venue
    return VENUE_MAP[DEFAULT_VENUE]


def parse_date_from_element(date_elem_text: str) -> Optional[str]:
    """
    Parse date from Georgia Symphony date element.
    Format: "07February" (day + month as one string)

    Returns date in YYYY-MM-DD format.
    """
    if not date_elem_text:
        return None

    # Clean text
    text = date_elem_text.strip().replace("\n", "")

    # Pattern: "07February" or "28March"
    match = re.search(
        r"(\d{1,2})(January|February|March|April|May|June|July|August|September|October|November|December)",
        text,
        re.IGNORECASE
    )

    if not match:
        return None

    day, month = match.groups()

    # Determine year - if month is in the past, use next year
    current_year = datetime.now().year
    current_month = datetime.now().month

    month_num = datetime.strptime(month, "%B").month

    year = current_year
    if month_num < current_month or (month_num == current_month and int(day) < datetime.now().day):
        year = current_year + 1

    try:
        dt = datetime(year, month_num, int(day))
        return dt.strftime("%Y-%m-%d")
    except ValueError:
        return None


def parse_time_range(time_text: str) -> tuple[Optional[str], Optional[str]]:
    """
    Parse time range from event time element.
    Format: "7:30 pm - 9:30 pm" or "3:00 pm - 5:00 pm"

    Returns (start_time, end_time) in HH:MM 24-hour format.
    """
    if not time_text:
        return None, None

    # Extract times
    times = re.findall(r"(\d{1,2}):(\d{2})\s*(am|pm)", time_text, re.IGNORECASE)

    if not times:
        return None, None

    def convert_to_24h(hour: str, minute: str, period: str) -> str:
        hour = int(hour)
        if period.lower() == "pm" and hour != 12:
            hour += 12
        elif period.lower() == "am" and hour == 12:
            hour = 0
        return f"{hour:02d}:{minute}"

    start_time = convert_to_24h(*times[0])
    end_time = convert_to_24h(*times[1]) if len(times) > 1 else None

    return start_time, end_time


def determine_category_and_tags(event_type: str, title: str, description: str = "") -> tuple[str, Optional[str], list[str]]:
    """
    Determine event category, subcategory, and tags based on event type and content.

    Event types from GSO: Jazz, Orchestra, Chorus, Pops, Special Event, GYSO, Sensory Friendly

    Returns: (category, subcategory, tags)
    """
    text = f"{event_type} {title} {description}".lower()
    tags = ["georgia-symphony", "classical-music"]

    # Determine primary category
    category = "music"
    subcategory = "classical"

    if "jazz" in event_type.lower():
        subcategory = "jazz"
        tags.extend(["jazz", "gso-jazz"])
    elif "chorus" in event_type.lower() or "choral" in text:
        subcategory = "choral"
        tags.extend(["chorus", "gso-chorus", "choral"])
    elif "gyso" in event_type.lower() or "youth" in text:
        tags.extend(["gyso", "youth-orchestra", "student-performance"])
    elif "pops" in event_type.lower() or "pops" in text:
        subcategory = "pops"
        tags.append("pops")

    # Add descriptive tags
    if "sensory" in text or "sensory-friendly" in text:
        tags.extend(["sensory-friendly", "family-friendly", "accessible"])
    if "family" in text or "children" in text or "kids" in text:
        tags.append("family-friendly")
    if "75th" in text or "anniversary" in text:
        tags.append("special-event")
    if "cinema" in text or "movie" in text or "film" in text:
        tags.extend(["film-music", "pops"])
    if "broadway" in text:
        tags.append("broadway")
    if "big band" in text:
        tags.append("big-band")

    return category, subcategory, list(set(tags))


def extract_price_from_description(description: str) -> tuple[Optional[float], Optional[float], Optional[str]]:
    """
    Extract price information from event description.

    Returns: (price_min, price_max, price_note)
    """
    if not description:
        return None, None, None

    # Look for price patterns: "$10", "$15-49.50", "$15-$49.50"
    price_pattern = r'\$(\d+(?:\.\d{2})?)\s*-\s*\$?(\d+(?:\.\d{2})?)'
    range_match = re.search(price_pattern, description)

    if range_match:
        min_price = float(range_match.group(1))
        max_price = float(range_match.group(2))
        return min_price, max_price, None

    # Single price
    single_match = re.search(r'\$(\d+(?:\.\d{2})?)', description)
    if single_match:
        price = float(single_match.group(1))
        return price, price, None

    # Check for free
    if "free" in description.lower() or "no charge" in description.lower():
        return 0, 0, "Free"

    return None, None, None


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl Georgia Symphony Orchestra events using Playwright.

    Site uses WordPress with ova-events plugin that requires JavaScript
    rendering. Events are in .content.element-event containers with:
    - .date-event > .date-month for date
    - .event_title > a for title and link
    - .time-event for time range and venue
    - .excerpt for description
    - .event_type for category tags
    - .event-thumbnail img for image
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

            logger.info(f"Fetching Georgia Symphony Orchestra: {EVENTS_URL}")
            page.goto(EVENTS_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(5000)

            # Scroll to load all events
            for _ in range(5):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1000)

            # Find all event containers
            event_elements = page.query_selector_all(".content.element-event")
            logger.info(f"Found {len(event_elements)} event elements")

            for event_elem in event_elements:
                try:
                    # Extract title
                    title_elem = event_elem.query_selector("h2.event_title a, .event_title a")
                    if not title_elem:
                        continue

                    title = title_elem.inner_text().strip()
                    # Remove HTML entities
                    title = title.replace("&#038;", "&").replace("</br>", " ")

                    if not title or len(title) < 3:
                        continue

                    # Extract event URL
                    event_url = title_elem.get_attribute("href")
                    if event_url and not event_url.startswith("http"):
                        event_url = BASE_URL + event_url

                    # Extract date
                    date_elem = event_elem.query_selector(".date-event .date-month")
                    if not date_elem:
                        logger.debug(f"No date found for: {title}")
                        continue

                    date_text = date_elem.inner_text()
                    start_date = parse_date_from_element(date_text)

                    if not start_date:
                        logger.debug(f"Could not parse date for: {title} - {date_text}")
                        continue

                    # Skip past events
                    try:
                        if datetime.strptime(start_date, "%Y-%m-%d").date() < datetime.now().date():
                            logger.debug(f"Skipping past event: {title} ({start_date})")
                            continue
                    except ValueError:
                        pass

                    # Extract time and venue from time-event element
                    time_elem = event_elem.query_selector(".time-event")
                    time_text = time_elem.inner_text() if time_elem else ""

                    start_time, end_time = parse_time_range(time_text)

                    # Extract venue name from time text
                    # Format: "7:30 pm - 9:30 pm / Bailey Performance Center"
                    venue_name = None
                    venue_match = re.search(r'/\s*(.+?)$', time_text)
                    if venue_match:
                        venue_name = venue_match.group(1).strip()

                    # Get or create venue
                    venue_data = get_venue_for_event(venue_name or "")
                    venue_id = get_or_create_venue(venue_data)

                    # Extract event type/category
                    event_type = ""
                    type_elem = event_elem.query_selector(".post_cat .event_type")
                    if type_elem:
                        event_type = type_elem.inner_text().strip()

                    # Extract description
                    description = None
                    desc_elem = event_elem.query_selector(".excerpt")
                    if desc_elem:
                        desc_text = desc_elem.inner_text().strip()
                        # Clean up HTML entities
                        desc_text = desc_text.replace("&#8217;", "'").replace("&#8211;", "–").replace("&#038;", "&")
                        # Remove "[…]" truncation marker
                        desc_text = re.sub(r'\[…\]$', '', desc_text).strip()
                        if len(desc_text) > 30:
                            description = desc_text[:800]

                    # Extract image
                    image_url = None
                    img_elem = event_elem.query_selector(".event-thumbnail img")
                    if img_elem:
                        image_url = img_elem.get_attribute("src") or img_elem.get_attribute("data-src")
                        if image_url and not image_url.startswith("http"):
                            image_url = BASE_URL + image_url

                    # Determine category, subcategory, and tags
                    category, subcategory, tags = determine_category_and_tags(
                        event_type, title, description or ""
                    )

                    # Extract price info from description
                    price_min, price_max, price_note = extract_price_from_description(description or "")
                    is_free = price_min == 0 and price_max == 0

                    events_found += 1

                    # Generate content hash for deduplication
                    content_hash = generate_content_hash(title, venue_data["name"], start_date)

                    if find_event_by_hash(content_hash):
                        events_updated += 1
                        continue

                    event_record = {
                        "source_id": source_id,
                        "venue_id": venue_id,
                        "title": title,
                        "description": description,
                        "start_date": start_date,
                        "start_time": start_time,
                        "end_date": start_date if end_time else None,
                        "end_time": end_time,
                        "is_all_day": False,
                        "category": category,
                        "subcategory": subcategory,
                        "tags": tags,
                        "price_min": price_min,
                        "price_max": price_max,
                        "price_note": price_note,
                        "is_free": is_free,
                        "source_url": event_url or EVENTS_URL,
                        "ticket_url": event_url or EVENTS_URL,
                        "image_url": image_url,
                        "raw_text": f"{title} | {event_type} | {time_text}"[:500],
                        "extraction_confidence": 0.92,
                        "is_recurring": False,
                        "recurrence_rule": None,
                        "content_hash": content_hash,
                    }

                    try:
                        insert_event(event_record)
                        events_new += 1
                        logger.info(f"Added: {title} on {start_date} at {venue_data['name']}")
                    except Exception as e:
                        logger.error(f"Failed to insert: {title}: {e}")

                except Exception as e:
                    logger.warning(f"Error processing event element: {e}")
                    continue

            browser.close()

        logger.info(
            f"Georgia Symphony crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except PlaywrightTimeout as e:
        logger.error(f"Timeout fetching Georgia Symphony Orchestra: {e}")
        raise
    except Exception as e:
        logger.error(f"Failed to crawl Georgia Symphony Orchestra: {e}")
        raise

    return events_found, events_new, events_updated
