"""
Crawler for Stone Mountain Park (stonemountainpark.com).
Major Atlanta-area park with festivals and seasonal events throughout the year.

Site structure: Events page with date ranges and descriptions.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime
from typing import Optional

import requests
from bs4 import BeautifulSoup

from db import get_or_create_venue, insert_event, find_event_by_hash
from dedupe import generate_content_hash
from utils import extract_image_url

logger = logging.getLogger(__name__)

BASE_URL = "https://stonemountainpark.com"
EVENTS_URL = f"{BASE_URL}/activities/events/"

VENUE_DATA = {
    "name": "Stone Mountain Park",
    "slug": "stone-mountain-park",
    "address": "1000 Robert E Lee Blvd",
    "neighborhood": "Stone Mountain",
    "city": "Stone Mountain",
    "state": "GA",
    "zip": "30083",
    "lat": 33.8054,
    "lng": -84.1454,
    "venue_type": "park",
    "website": BASE_URL,
}


def parse_date_range(date_text: str) -> tuple[Optional[str], Optional[str]]:
    """
    Parse date range from formats like:
    - "11/7/2026 — 1/3/2027"
    - "4/5/2026"
    - "5/22/2026 — 5/25/2026"

    Returns (start_date, end_date) in YYYY-MM-DD format.
    """
    if not date_text:
        return None, None

    # Clean the text
    date_text = date_text.strip()

    # Pattern for date range: "M/D/YYYY — M/D/YYYY" or "M/D/YYYY - M/D/YYYY"
    range_match = re.search(
        r"(\d{1,2})/(\d{1,2})/(\d{4})\s*[—–-]\s*(\d{1,2})/(\d{1,2})/(\d{4})",
        date_text
    )
    if range_match:
        sm, sd, sy, em, ed, ey = range_match.groups()
        try:
            start = datetime(int(sy), int(sm), int(sd))
            end = datetime(int(ey), int(em), int(ed))
            return start.strftime("%Y-%m-%d"), end.strftime("%Y-%m-%d")
        except ValueError:
            pass

    # Pattern for single date: "M/D/YYYY"
    single_match = re.search(r"(\d{1,2})/(\d{1,2})/(\d{4})", date_text)
    if single_match:
        m, d, y = single_match.groups()
        try:
            dt = datetime(int(y), int(m), int(d))
            date_str = dt.strftime("%Y-%m-%d")
            return date_str, date_str
        except ValueError:
            pass

    return None, None


def determine_category(title: str) -> tuple[str, Optional[str], list[str]]:
    """Determine category based on event title."""
    title_lower = title.lower()
    base_tags = ["stone-mountain", "park", "family"]

    if "christmas" in title_lower or "north pole" in title_lower:
        return "family", "holiday", base_tags + ["christmas", "holiday", "lights"]
    if "new year" in title_lower:
        return "family", "holiday", base_tags + ["new-years", "holiday", "fireworks"]
    if "lunar" in title_lower:
        return "community", "cultural", base_tags + ["lunar-new-year", "cultural", "festival"]
    if "dino" in title_lower:
        return "family", "kids", base_tags + ["dinosaurs", "kids", "educational"]
    if "easter" in title_lower:
        return "community", "religious", base_tags + ["easter", "sunrise-service"]
    if "memorial day" in title_lower:
        return "community", "holiday", base_tags + ["memorial-day", "patriotic", "fireworks"]
    if "fourth" in title_lower or "4th" in title_lower or "july" in title_lower:
        return "community", "holiday", base_tags + ["july-4th", "fireworks", "patriotic"]
    if "summer" in title_lower:
        return "family", "seasonal", base_tags + ["summer", "outdoor"]
    if "labor day" in title_lower:
        return "community", "holiday", base_tags + ["labor-day", "lasershow"]
    if "yellow daisy" in title_lower:
        return "community", "festival", base_tags + ["craft-fair", "festival", "artisan"]

    return "family", "outdoor", base_tags


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Stone Mountain Park events."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        venue_id = get_or_create_venue(VENUE_DATA)

        headers = {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
        }

        logger.info(f"Fetching Stone Mountain Park: {EVENTS_URL}")
        response = requests.get(EVENTS_URL, headers=headers, timeout=30)
        response.raise_for_status()

        soup = BeautifulSoup(response.text, "lxml")

        # Find event items - the page uses a structured layout
        # Look for event containers with titles and date info
        event_containers = soup.find_all("div", class_=re.compile(r"event|festival|card"))

        # Also try looking for headings followed by date info
        if not event_containers:
            # Try finding by the structure: h2/h3 title, then date, then description
            event_containers = []
            headings = soup.find_all(["h2", "h3", "h4"])
            for h in headings:
                parent = h.find_parent("div")
                if parent and parent not in event_containers:
                    event_containers.append(parent)

        # Parse the page content more directly
        # Stone Mountain uses a specific structure with dates like "11/7/2026 — 1/3/2027"
        page_text = soup.get_text()

        # Find all event blocks by looking for date patterns
        # The page structure has title, then date, then location, then description
        event_sections = soup.find_all(["article", "div"], class_=re.compile(r"event|card|item"))

        # If structured sections not found, parse more loosely
        if not event_sections:
            # Look for the main content area
            main_content = soup.find("main") or soup.find("div", class_="content") or soup

            # Find all headings that look like event titles
            all_elements = main_content.find_all(["h2", "h3", "h4", "h5"])

            for elem in all_elements:
                title = elem.get_text(strip=True)

                # Skip navigation items
                if not title or len(title) < 5:
                    continue
                skip_words = ["buy", "membership", "explore", "tickets", "contact", "menu"]
                if any(w in title.lower() for w in skip_words):
                    continue

                # Look for date in nearby elements
                parent = elem.find_parent()
                if not parent:
                    continue

                # Get all text from parent container
                container_text = parent.get_text()

                # Try to find date
                start_date, end_date = parse_date_range(container_text)

                if not start_date:
                    # Look in siblings
                    for sibling in elem.find_next_siblings(limit=5):
                        sibling_text = sibling.get_text() if hasattr(sibling, 'get_text') else str(sibling)
                        start_date, end_date = parse_date_range(sibling_text)
                        if start_date:
                            break

                if not start_date:
                    continue

                # Get description
                description = ""
                desc_elem = parent.find("p")
                if desc_elem:
                    description = desc_elem.get_text(strip=True)[:500]

                # Get image
                img_elem = parent.find("img")
                image_url = None
                if img_elem:
                    image_url = img_elem.get("src") or img_elem.get("data-src")
                    # Handle srcset
                    if not image_url and img_elem.get("srcset"):
                        srcset = img_elem.get("srcset")
                        first_src = srcset.split(",")[0].split()[0]
                        image_url = first_src

                # Get event link
                link_elem = parent.find("a", href=re.compile(r"/activities/|/events/"))
                event_url = EVENTS_URL
                if link_elem and link_elem.get("href"):
                    href = link_elem.get("href")
                    if href.startswith("/"):
                        event_url = BASE_URL + href
                    elif href.startswith("http"):
                        event_url = href

                events_found += 1

                # Generate content hash
                content_hash = generate_content_hash(
                    title, "Stone Mountain Park", start_date
                )

                # Check for existing
                existing = find_event_by_hash(content_hash)
                if existing:
                    events_updated += 1
                    continue

                # Determine category
                category, subcategory, tags = determine_category(title)

                event_record = {
                    "source_id": source_id,
                    "venue_id": venue_id,
                    "title": title,
                    "description": description if description else f"Festival/event at Stone Mountain Park",
                    "start_date": start_date,
                    "start_time": None,
                    "end_date": end_date if end_date != start_date else None,
                    "end_time": None,
                    "is_all_day": True,
                    "category": category,
                    "subcategory": subcategory,
                    "tags": tags,
                    "price_min": None,
                    "price_max": None,
                    "price_note": "Park admission required",
                    "is_free": False,
                    "source_url": event_url,
                    "ticket_url": f"{BASE_URL}/tickets/",
                    "image_url": image_url,
                    "raw_text": f"{title}: {description[:200] if description else ''}",
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
                    logger.error(f"Failed to insert: {title}: {e}")

        logger.info(
            f"Stone Mountain Park crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Stone Mountain Park: {e}")
        raise

    return events_found, events_new, events_updated
