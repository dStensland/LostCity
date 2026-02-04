"""
Crawler for Painting With a Twist (Atlanta area locations).

Chain with 7 Atlanta-area studios. Each location has server-rendered HTML calendar.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime
from typing import Optional
import httpx
from bs4 import BeautifulSoup

from db import get_or_create_venue, insert_event, find_event_by_hash
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://www.paintingwithatwist.com"

# All 7 Atlanta-area locations
LOCATIONS = [
    {
        "slug": "atlanta-edgewood",
        "venue_name": "Painting With a Twist - Edgewood",
        "venue_slug": "painting-with-a-twist-edgewood",
        "address": "1230 Caroline St NE #240",
        "neighborhood": "Edgewood",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30307",
        "lat": 33.7554,
        "lng": -84.3437,
    },
    {
        "slug": "atlanta-sandy-springs",
        "venue_name": "Painting With a Twist - Sandy Springs",
        "venue_slug": "painting-with-a-twist-sandy-springs",
        "address": "6690 Roswell Rd NE Suite 170",
        "neighborhood": "Sandy Springs",
        "city": "Sandy Springs",
        "state": "GA",
        "zip": "30328",
        "lat": 33.9383,
        "lng": -84.3521,
    },
    {
        "slug": "kennesaw",
        "venue_name": "Painting With a Twist - Kennesaw",
        "venue_slug": "painting-with-a-twist-kennesaw",
        "address": "2500 Cobb Pl Ln NW",
        "neighborhood": "Kennesaw",
        "city": "Kennesaw",
        "state": "GA",
        "zip": "30144",
        "lat": 34.0234,
        "lng": -84.6155,
    },
    {
        "slug": "douglasville",
        "venue_name": "Painting With a Twist - Douglasville",
        "venue_slug": "painting-with-a-twist-douglasville",
        "address": "2986 Chapel Hill Rd",
        "neighborhood": "Douglasville",
        "city": "Douglasville",
        "state": "GA",
        "zip": "30135",
        "lat": 33.7315,
        "lng": -84.7477,
    },
    {
        "slug": "mcdonough",
        "venue_name": "Painting With a Twist - McDonough",
        "venue_slug": "painting-with-a-twist-mcdonough",
        "address": "1590 Hwy 20 W Suite 200",
        "neighborhood": "McDonough",
        "city": "McDonough",
        "state": "GA",
        "zip": "30253",
        "lat": 33.4473,
        "lng": -84.1827,
    },
    {
        "slug": "alpharetta",
        "venue_name": "Painting With a Twist - Alpharetta",
        "venue_slug": "painting-with-a-twist-alpharetta",
        "address": "5530 Windward Pkwy Suite 125",
        "neighborhood": "Alpharetta",
        "city": "Alpharetta",
        "state": "GA",
        "zip": "30004",
        "lat": 34.0836,
        "lng": -84.2395,
    },
    {
        "slug": "lawrenceville",
        "venue_name": "Painting With a Twist - Lawrenceville",
        "venue_slug": "painting-with-a-twist-lawrenceville",
        "address": "750 Duluth Hwy Suite 400",
        "neighborhood": "Lawrenceville",
        "city": "Lawrenceville",
        "state": "GA",
        "zip": "30043",
        "lat": 33.9601,
        "lng": -84.0020,
    },
]


def parse_price(price_text: str) -> tuple[Optional[float], Optional[float]]:
    """Parse price from '$40' or '$38-$40' format."""
    if not price_text:
        return None, None

    # Strip whitespace and dollar signs
    price_text = price_text.strip().replace("$", "")

    # Check for range format
    if "-" in price_text:
        parts = price_text.split("-")
        try:
            price_min = float(parts[0].strip())
            price_max = float(parts[1].strip())
            return price_min, price_max
        except (ValueError, IndexError):
            return None, None

    # Single price
    try:
        price = float(price_text.strip())
        return price, price
    except ValueError:
        return None, None


def parse_datetime(datetime_str: str) -> tuple[Optional[str], Optional[str]]:
    """
    Parse datetime from format: 'Wed, Feb 4, 7:00 pm' or '2026-02-04T07:00'.
    Returns (date, time) tuple in ('YYYY-MM-DD', 'HH:MM') format.
    """
    # Try ISO format first (from datetime attribute)
    iso_match = re.match(r"(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})", datetime_str)
    if iso_match:
        year, month, day, hour, minute = iso_match.groups()
        return f"{year}-{month}-{day}", f"{hour}:{minute}"

    # Try text format: "Wed, Feb 4, 7:00 pm"
    text_match = re.match(
        r"(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun),?\s+([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{1,2}):(\d{2})\s*(am|pm)",
        datetime_str,
        re.IGNORECASE
    )
    if text_match:
        month_str, day, hour, minute, period = text_match.groups()

        # Convert month name to number
        month_map = {
            "jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6,
            "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12
        }
        month = month_map.get(month_str[:3].lower())
        if not month:
            return None, None

        # Convert to 24-hour format
        hour = int(hour)
        if period.lower() == "pm" and hour != 12:
            hour += 12
        elif period.lower() == "am" and hour == 12:
            hour = 0

        # Determine year (assume current year, or next year if date has passed)
        year = datetime.now().year
        try:
            date_obj = datetime(year, month, int(day))
            if date_obj.date() < datetime.now().date():
                year += 1
        except ValueError:
            return None, None

        return f"{year}-{month:02d}-{int(day):02d}", f"{hour:02d}:{minute}"

    return None, None


def clean_title(title: str) -> tuple[str, list[str]]:
    """
    Clean event title and extract tags.
    Strips suffixes like '~ **PUBLIC**', '~ **BLACKLIGHT**', etc.
    Returns (cleaned_title, additional_tags).
    """
    tags = []

    # Detect special event types
    if "**BLACKLIGHT**" in title or "BLACKLIGHT" in title.upper():
        tags.append("blacklight")
    if "**PUBLIC**" in title or "PUBLIC" in title.upper():
        tags.append("public")
    if "date night" in title.lower():
        tags.append("date-night")
    if "couples" in title.lower() or "- set or solo" in title.lower():
        tags.append("couples-friendly")
    if "family" in title.lower() or "kids" in title.lower():
        tags.append("family-friendly")

    # Strip decoration
    cleaned = re.sub(r"~\s*\*\*[A-Z]+\*\*", "", title, flags=re.IGNORECASE)
    cleaned = re.sub(r"~\s*PUBLIC", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"~\s*BLACKLIGHT", "", cleaned, flags=re.IGNORECASE)
    cleaned = cleaned.strip(" ~-")

    return cleaned, tags


def crawl_location(
    client: httpx.Client,
    location: dict,
    source_id: int,
    venue_id: int,
) -> tuple[int, int, int]:
    """Crawl one location's calendar page."""
    slug = location["slug"]
    venue_name = location["venue_name"]

    calendar_url = f"{BASE_URL}/studio/{slug}/calendar/"
    logger.info(f"Crawling {venue_name}: {calendar_url}")

    try:
        response = client.get(calendar_url, timeout=30)
        response.raise_for_status()
    except Exception as e:
        logger.error(f"Failed to fetch {calendar_url}: {e}")
        return 0, 0, 0

    soup = BeautifulSoup(response.text, "html.parser")

    events_found = 0
    events_new = 0
    events_updated = 0

    # Find all event cards
    # Structure: <time class="event-datetime"> ... <strong class="event-price"> ... <div class="event-title"><a>
    event_cards = soup.find_all("time", class_="event-datetime")

    for time_elem in event_cards:
        try:
            # Extract datetime
            datetime_attr = time_elem.get("datetime")
            datetime_text = time_elem.get_text(strip=True)

            start_date, start_time = parse_datetime(datetime_attr or datetime_text)
            if not start_date:
                continue

            # Find price (next <strong class="event-price">)
            price_elem = time_elem.find_next("strong", class_="event-price")
            price_text = price_elem.get_text(strip=True) if price_elem else ""
            price_min, price_max = parse_price(price_text)

            # Find title (next <div class="event-title"><a>)
            title_elem = time_elem.find_next("div", class_="event-title")
            if not title_elem:
                continue

            title_link = title_elem.find("a")
            if not title_link:
                continue

            raw_title = title_link.get_text(strip=True)
            event_url = title_link.get("href", "")
            if event_url and not event_url.startswith("http"):
                event_url = f"{BASE_URL}{event_url}"

            # Clean title and extract tags
            title, event_tags = clean_title(raw_title)

            # Find image (look for img with rackcdn.com URL near this event)
            image_url = None
            img_elem = title_elem.find_previous("img")
            if img_elem:
                img_src = img_elem.get("src", "")
                if "rackcdn.com" in img_src or "admin.paintingwithatwist.com" in img_src:
                    image_url = img_src

            events_found += 1

            # Generate content hash for dedup
            content_hash = generate_content_hash(title, venue_name, start_date)

            existing = find_event_by_hash(content_hash)
            if existing:
                events_updated += 1
                continue

            # Build tags
            tags = [
                "paint-and-sip",
                "workshop",
                "creative",
                "arts",
                "painting",
                "byob",
            ] + event_tags

            event_record = {
                "source_id": source_id,
                "venue_id": venue_id,
                "title": title,
                "description": None,
                "start_date": start_date,
                "start_time": start_time,
                "end_date": None,
                "end_time": None,
                "is_all_day": False,
                "category": "arts",
                "subcategory": "arts.workshop",
                "tags": tags,
                "price_min": price_min,
                "price_max": price_max,
                "price_note": None,
                "is_free": False,
                "source_url": event_url or calendar_url,
                "ticket_url": event_url or calendar_url,
                "image_url": image_url,
                "raw_text": None,
                "extraction_confidence": 0.90,
                "is_recurring": False,
                "recurrence_rule": None,
                "content_hash": content_hash,
            }

            try:
                insert_event(event_record)
                events_new += 1
                logger.info(f"  Added: {title} on {start_date}")
            except Exception as e:
                logger.error(f"  Failed to insert {title}: {e}")

        except Exception as e:
            logger.debug(f"  Error parsing event card: {e}")
            continue

    logger.info(f"  {venue_name}: {events_found} found, {events_new} new, {events_updated} updated")
    return events_found, events_new, events_updated


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl all Painting With a Twist locations. Returns (found, new, updated)."""
    source_id = source["id"]

    total_found = 0
    total_new = 0
    total_updated = 0

    # Create HTTP client with reasonable timeout
    client = httpx.Client(
        timeout=30.0,
        headers={
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
        },
        follow_redirects=True,
    )

    try:
        # Create or verify all venues first
        for location in LOCATIONS:
            venue_data = {
                "name": location["venue_name"],
                "slug": location["venue_slug"],
                "address": location["address"],
                "neighborhood": location["neighborhood"],
                "city": location["city"],
                "state": location["state"],
                "zip": location["zip"],
                "lat": location["lat"],
                "lng": location["lng"],
                "venue_type": "studio",
                "spot_type": "studio",
                "website": f"{BASE_URL}/studio/{location['slug']}/",
                "vibes": ["workshop", "creative", "hands-on", "date-night", "paint-and-sip", "byob"],
            }

            venue_id = get_or_create_venue(venue_data)

            # Crawl this location
            found, new, updated = crawl_location(client, location, source_id, venue_id)
            total_found += found
            total_new += new
            total_updated += updated

        logger.info(
            f"Painting With a Twist crawl complete: {total_found} found, "
            f"{total_new} new, {total_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Painting With a Twist: {e}")
        raise

    finally:
        client.close()

    return total_found, total_new, total_updated
