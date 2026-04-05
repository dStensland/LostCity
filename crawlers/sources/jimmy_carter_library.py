"""
Crawler for Jimmy Carter Presidential Library and Museum.
Crawls exhibitions, talks, book events, and programming from jimmycarterlibrary.gov.
Museum in Old Fourth Ward, Atlanta - part of National Archives Presidential Library system.
"""

import json
import logging
import re
import time
from datetime import datetime
from typing import Optional, Tuple
import requests
from bs4 import BeautifulSoup

from db import get_or_create_place, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash
from entity_lanes import SourceEntityCapabilities, TypedEntityEnvelope
from entity_persistence import persist_typed_entity_envelope

logger = logging.getLogger(__name__)

BASE_URL = "https://www.jimmycarterlibrary.gov"
EVENTS_URL = f"{BASE_URL}/events"

PLACE_DATA = {
    "name": "Jimmy Carter Presidential Library and Museum",
    "slug": "jimmy-carter-library",
    "address": "441 John Lewis Freedom Pkwy NE",
    "neighborhood": "Old Fourth Ward",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30307",
    "lat": 33.7679,
    "lng": -84.3582,
    "place_type": "museum",
    "spot_type": "museum",
    "website": "https://www.jimmycarterlibrary.gov/",
    "vibes": ["historic", "museum", "presidential", "gardens", "free-parking"],
    "description": (
        "The Jimmy Carter Presidential Library and Museum preserves the legacy of the 39th President "
        "of the United States. Set on 35 acres of gardens in Atlanta's Old Fourth Ward, the museum "
        "features permanent and rotating exhibitions on the Carter presidency, human rights, and "
        "global peace initiatives. Open to the public Monday–Saturday and Sunday afternoons."
    ),
    "hours": {
        "monday": {"open": "09:00", "close": "16:45"},
        "tuesday": {"open": "09:00", "close": "16:45"},
        "wednesday": {"open": "09:00", "close": "16:45"},
        "thursday": {"open": "09:00", "close": "16:45"},
        "friday": {"open": "09:00", "close": "16:45"},
        "saturday": {"open": "09:00", "close": "16:45"},
        "sunday": {"open": "12:00", "close": "16:45"},
    },
}

SOURCE_ENTITY_CAPABILITIES = SourceEntityCapabilities(
    events=True,
    destinations=True,
    destination_details=True,
    venue_features=True,
    venue_specials=True,
)


def _build_destination_envelope(venue_id: int) -> TypedEntityEnvelope:
    envelope = TypedEntityEnvelope()
    envelope.add("destination_details", {
        "place_id": venue_id,
        "destination_type": "presidential_library",
        "commitment_tier": "halfday",
        "primary_activity": "Presidential museum, rotating exhibitions, and Japanese gardens",
        "best_seasons": ["spring", "summer", "fall", "winter"],
        "weather_fit_tags": ["indoor", "outdoor-indoor-mix"],
        "parking_type": "free_lot",
        "best_time_of_day": "morning",
        "practical_notes": (
            "Free parking on-site. The museum and grounds sit on 35 acres in Old Fourth Ward — "
            "allow 2-3 hours for the museum plus time to walk the Japanese gardens. "
            "Easy to combine with a Freedom Park Trail walk or Beltline connection."
        ),
        "accessibility_notes": "Fully ADA accessible. Wheelchair available at front desk.",
        "family_suitability": "yes",
        "reservation_required": False,
        "permit_required": False,
        "fee_note": "Admission charged for adults. Children 15 and under free.",
        "source_url": BASE_URL,
        "metadata": {"source_type": "venue_enrichment", "place_type": "museum", "city": "atlanta"},
    })
    envelope.add("venue_features", {
        "place_id": venue_id,
        "slug": "presidential-museum-permanent-exhibits",
        "title": "Presidential museum permanent exhibits",
        "feature_type": "collection",
        "description": "Permanent collection documenting the Carter presidency, human rights work, and global peace initiatives.",
        "url": BASE_URL,
        "is_free": False,
        "sort_order": 10,
    })
    envelope.add("venue_features", {
        "place_id": venue_id,
        "slug": "oval-office-replica",
        "title": "Oval Office replica",
        "feature_type": "attraction",
        "description": "A full-scale replica of the Oval Office as it appeared during the Carter presidency.",
        "url": BASE_URL,
        "is_free": False,
        "sort_order": 20,
    })
    envelope.add("venue_features", {
        "place_id": venue_id,
        "slug": "japanese-garden-grounds",
        "title": "Japanese garden and grounds",
        "feature_type": "amenity",
        "description": "35 acres of landscaped grounds including a serene Japanese garden, cherry trees, and walking paths.",
        "url": BASE_URL,
        "is_free": True,
        "sort_order": 30,
    })
    envelope.add("venue_features", {
        "place_id": venue_id,
        "slug": "rotating-special-exhibitions",
        "title": "Rotating special exhibitions",
        "feature_type": "experience",
        "description": "Regularly changing special exhibitions on topics ranging from presidential history to human rights and global affairs.",
        "url": f"{BASE_URL}/exhibitions",
        "is_free": False,
        "sort_order": 40,
    })
    envelope.add("venue_specials", {
        "place_id": venue_id,
        "slug": "children-15-and-under-free",
        "title": "Children 15 and under free",
        "description": "Free admission for all visitors age 15 and under, making it a family-friendly museum destination.",
        "price_note": "Children 15 and under admitted free.",
        "is_free": True,
        "source_url": BASE_URL,
        "category": "admission",
    })
    return envelope


def parse_event_date(date_str: str) -> Tuple[Optional[str], Optional[str]]:
    """
    Parse event date from formats like:
    - "March 10, 2026"
    - "2026-03-10 19:00:00" (from JSON-LD)
    Returns (date, time) tuple in YYYY-MM-DD and HH:MM format.
    """
    if not date_str:
        return None, None

    try:
        # Try ISO format with time first (from JSON-LD)
        if " " in date_str and ":" in date_str:
            # Format: "2026-03-10 19:00:00"
            dt = datetime.strptime(date_str, "%Y-%m-%d %H:%M:%S")
            return dt.strftime("%Y-%m-%d"), dt.strftime("%H:%M")

        # Try "Month day, year" format
        if "," in date_str:
            # Format: "March 10, 2026"
            dt = datetime.strptime(date_str, "%B %d, %Y")
            return dt.strftime("%Y-%m-%d"), None

        # Try YYYY-MM-DD format
        if re.match(r"\d{4}-\d{2}-\d{2}", date_str):
            return date_str, None

    except ValueError as e:
        logger.warning(f"Failed to parse date '{date_str}': {e}")

    return None, None


def extract_event_from_json_ld(soup: BeautifulSoup, event_url: str) -> Optional[dict]:
    """
    Extract event details from JSON-LD structured data on event detail page.
    Returns dict with event info or None if not found.
    """
    try:
        # Find JSON-LD script tag
        json_ld_script = soup.find("script", type="application/ld+json")
        if not json_ld_script:
            return None

        data = json.loads(json_ld_script.string)

        # Verify it's an Event type
        if data.get("@type") != "Event":
            return None

        title = data.get("name", "").strip()
        if not title:
            return None

        # Parse dates
        start_date, start_time = parse_event_date(data.get("startDate", ""))
        if not start_date:
            return None

        # Clean up description (remove HTML tags)
        description = data.get("description", "")
        if description:
            # Remove HTML tags
            description = re.sub(r"<[^>]+>", " ", description)
            # Clean up whitespace
            description = re.sub(r"\s+", " ", description).strip()
            # Remove &nbsp; entities
            description = description.replace("&nbsp;", " ")
            # Truncate if too long
            if len(description) > 500:
                description = description[:497] + "..."

        # Get location info if available
        location = data.get("location", {})
        location_name = None
        if isinstance(location, dict):
            location_name = location.get("name")

        return {
            "title": title,
            "description": description,
            "start_date": start_date,
            "start_time": start_time,
            "location_name": location_name,
            "source_url": event_url,
        }

    except Exception as e:
        logger.warning(f"Failed to extract JSON-LD from {event_url}: {e}")
        return None


def crawl(source: dict) -> Tuple[int, int, int]:
    """Crawl Jimmy Carter Presidential Library events."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
        }

        # Fetch og:image from homepage to enrich venue record
        place_data = dict(PLACE_DATA)
        try:
            _home_resp = requests.get(BASE_URL, headers=headers, timeout=15)
            if _home_resp.status_code == 200:
                _home_soup = BeautifulSoup(_home_resp.text, "html.parser")
                _og_image = _home_soup.find("meta", attrs={"property": "og:image"})
                if _og_image and _og_image.get("content"):
                    img_src = _og_image["content"]
                    if img_src and not img_src.startswith("http"):
                        img_src = BASE_URL + "/" + img_src.lstrip("/")
                    place_data["image_url"] = img_src
                    logger.debug("Fetched og:image for Jimmy Carter Library")
        except Exception as _e:
            logger.debug(f"Could not fetch og:image for Jimmy Carter Library: {_e}")

        # Get or create venue
        venue_id = get_or_create_place(place_data)
        persist_typed_entity_envelope(_build_destination_envelope(venue_id))

        # Fetch events page
        logger.info(f"Fetching events from {EVENTS_URL}")
        response = requests.get(EVENTS_URL, headers=headers, timeout=30)
        response.raise_for_status()

        soup = BeautifulSoup(response.text, "html.parser")

        # Extract event data from JavaScript embedded in page
        # Look for drupal-settings-json script tag
        settings_script = soup.find("script", {"data-drupal-selector": "drupal-settings-json"})

        event_urls = []

        if settings_script:
            try:
                settings = json.loads(settings_script.string)
                event_calendar = settings.get("eventsCalendar", {})
                dates = event_calendar.get("dates", [])

                # Extract event URLs from calendar data
                for event_data in dates:
                    event_url = event_data.get("url")
                    if event_url:
                        full_url = BASE_URL + event_url if event_url.startswith("/") else event_url
                        event_urls.append(full_url)

                logger.info(f"Found {len(event_urls)} events in calendar data")

            except Exception as e:
                logger.warning(f"Failed to parse drupal settings: {e}")

        # Also scrape event links from HTML as fallback
        for link in soup.find_all("a", href=re.compile(r"/events/\d+")):
            event_url = link.get("href")
            if event_url:
                full_url = BASE_URL + event_url if event_url.startswith("/") else event_url
                if full_url not in event_urls:
                    event_urls.append(full_url)

        logger.info(f"Total unique event URLs to crawl: {len(event_urls)}")

        # Fetch each event detail page
        for i, event_url in enumerate(event_urls):
            try:
                events_found += 1

                # Add small delay between requests to avoid overwhelming the server
                if i > 0:
                    time.sleep(1.5)

                logger.debug(f"Fetching event: {event_url}")
                event_response = requests.get(event_url, headers=headers, timeout=45)
                event_response.raise_for_status()

                event_soup = BeautifulSoup(event_response.text, "html.parser")

                # Extract event details from JSON-LD
                event_data = extract_event_from_json_ld(event_soup, event_url)

                if not event_data:
                    logger.debug(f"No structured data found for {event_url}")
                    continue

                title = event_data["title"]
                start_date = event_data["start_date"]

                # Build description
                description = event_data.get("description")
                if not description or len(description) < 50:
                    description = "Event at the Jimmy Carter Presidential Library and Museum, featuring talks, exhibitions, and programming celebrating American history and the Carter presidency."

                # Try to extract image from page
                image_url = None

                # Look for og:image meta tag
                og_image = event_soup.find("meta", property="og:image")
                if og_image and og_image.get("content"):
                    image_url = og_image["content"]
                    if image_url and not image_url.startswith("http"):
                        image_url = BASE_URL + "/" + image_url.lstrip("/")

                # Or look for thumbnail in event listing
                if not image_url:
                    thumbnail = event_soup.find("div", class_="thumbnail")
                    if thumbnail:
                        img = thumbnail.find("img")
                        if img and img.get("src"):
                            image_url = img["src"]
                            if not image_url.startswith("http"):
                                # Handle archives.gov URLs
                                if image_url.startswith("/"):
                                    if "archives.gov" in image_url:
                                        image_url = "https://www.archives.gov" + image_url
                                    else:
                                        image_url = BASE_URL + image_url

                # Categorize event based on title and description
                title_lower = title.lower()
                description.lower()

                category = "community"

                if any(keyword in title_lower for keyword in ["book", "author", "writer"]):
                    category = "community"
                elif any(keyword in title_lower for keyword in ["film", "movie", "screening"]):
                    category = "film"
                elif any(keyword in title_lower for keyword in ["music", "concert", "performance"]):
                    category = "music"
                elif any(keyword in title_lower for keyword in ["exhibition", "exhibit", "gallery"]):
                    category = "museums"

                # Build tags
                tags = ["museum", "history", "presidential", "jimmy-carter", "old-fourth-ward"]

                if "book" in title_lower or "author" in title_lower:
                    tags.append("books")
                if "virtual" in title_lower or "online" in title_lower:
                    tags.append("virtual")
                if "lecture" in title_lower or "talk" in title_lower:
                    tags.append("lecture")

                # Determine if free based on text
                is_free = False
                price_note = None
                combined_text = f"{title} {description or ''}".lower()
                if any(kw in combined_text for kw in ["free", "no cost", "no charge", "complimentary"]):
                    is_free = True
                    price_note = "Free admission"

                # Generate content hash
                content_hash = generate_content_hash(title, PLACE_DATA["name"], start_date)

                # Create event record
                event_record = {
                    "source_id": source_id,
                    "place_id": venue_id,
                    "title": title,
                    "description": description,
                    "start_date": start_date,
                    "start_time": event_data.get("start_time"),
                    "end_date": None,
                    "end_time": None,
                    "is_all_day": False,
                    "category": category,
                    "tags": tags,
                    "price_min": None,
                    "price_max": None,
                    "price_note": price_note,
                    "is_free": is_free,
                    "source_url": event_url,
                    "ticket_url": None,  # Presidential libraries don't typically require advance tickets
                    "image_url": image_url,
                    "raw_text": json.dumps(event_data),
                    "extraction_confidence": 0.95,  # High confidence for structured data
                    "is_recurring": False,
                    "recurrence_rule": None,
                    "content_hash": content_hash,
                }

                # Check for duplicates
                existing = find_event_by_hash(content_hash)
                if existing:
                    smart_update_existing_event(existing, event_record)
                    events_updated += 1
                    continue

                insert_event(event_record)
                events_new += 1
                logger.debug(f"Inserted: {title} on {start_date}")

            except Exception as e:
                logger.error(f"Failed to process event {event_url}: {e}", exc_info=True)
                continue

        logger.info(
            f"Jimmy Carter Library: Found {events_found} events, {events_new} new, {events_updated} existing"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Jimmy Carter Library: {e}", exc_info=True)
        raise

    return events_found, events_new, events_updated
