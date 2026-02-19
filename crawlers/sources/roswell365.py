"""
Crawler for Roswell365.com — community events site for Roswell, GA.

Covers events across Roswell including:
- Roswell Roots (Black History Month festival at Roswell Cultural Arts Center)
- Music, theater, and performing arts
- Worship services and religious events
- Community programs and classes
- Kids events and family programming
- Art shows and cultural events

Site uses JavaScript rendering - requires Playwright.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime
from typing import Optional
from urllib.parse import urljoin

from playwright.sync_api import sync_playwright

from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash
from utils import enrich_event_record

logger = logging.getLogger(__name__)

BASE_URL = "https://roswell365.com"
EVENTS_URL = f"{BASE_URL}/event/"


def parse_date(date_text: str) -> Optional[str]:
    """Parse date from 'Feb 21, 2026' format."""
    try:
        # Handle formats like "Feb 21, 2026" or "February 21, 2026"
        date_text = date_text.strip()
        for fmt in ["%b %d, %Y", "%B %d, %Y", "%b %d %Y", "%B %d %Y"]:
            try:
                dt = datetime.strptime(date_text, fmt)
                return dt.strftime("%Y-%m-%d")
            except ValueError:
                continue
        return None
    except Exception as e:
        logger.debug(f"Failed to parse date '{date_text}': {e}")
        return None


def parse_time(time_text: str) -> Optional[str]:
    """Parse time from '7:00pm' or '7:00 PM' format."""
    try:
        time_text = time_text.strip().lower()
        match = re.search(r"(\d{1,2}):(\d{2})\s*(am|pm)", time_text)
        if match:
            hour, minute, period = match.groups()
            hour = int(hour)
            if period == "pm" and hour != 12:
                hour += 12
            elif period == "am" and hour == 12:
                hour = 0
            return f"{hour:02d}:{minute}"
        return None
    except Exception as e:
        logger.debug(f"Failed to parse time '{time_text}': {e}")
        return None


def extract_price_info(text: str) -> tuple[Optional[float], Optional[float], Optional[str], bool]:
    """Extract price information from text like 'Tickets from $47.75' or 'Free'."""
    text = text.lower()

    if "free" in text:
        return None, None, None, True

    # Match patterns like "$47.75", "from $47.75", "$10-$20"
    price_match = re.search(r"\$(\d+(?:\.\d{2})?)", text)
    if price_match:
        price = float(price_match.group(1))
        return price, None, f"from ${price:.2f}", False

    return None, None, None, False


def parse_venue_from_text(location_text: str) -> dict:
    """Parse venue information from location text."""
    # Default to Roswell Cultural Arts Center if not specified
    default_venue = {
        "name": "Roswell Cultural Arts Center",
        "slug": "roswell-cultural-arts-center",
        "address": "950 Forrest St",
        "neighborhood": "Historic Roswell",
        "city": "Roswell",
        "state": "GA",
        "zip": "30075",
        "lat": 34.0232,
        "lng": -84.3616,
        "venue_type": "theater",
        "spot_type": "theater",
        "website": "https://www.roswellgov.com/cultural-arts",
    }

    location_text = location_text.strip()

    # Check for known venues
    if "roswell cultural arts center" in location_text.lower():
        return default_venue
    elif "roswell adult recreation center" in location_text.lower():
        return {
            "name": "Roswell Adult Recreation Center",
            "slug": "roswell-adult-recreation-center",
            "address": "11925 Crabapple Rd",
            "neighborhood": "Roswell",
            "city": "Roswell",
            "state": "GA",
            "zip": "30075",
            "lat": 34.0595,
            "lng": -84.3214,
            "venue_type": "community_center",
            "spot_type": "community_center",
            "website": "https://www.roswellgov.com/recreation",
        }
    elif "roswell presbyterian church" in location_text.lower():
        return {
            "name": "Roswell Presbyterian Church",
            "slug": "roswell-presbyterian-church",
            "address": "755 Mimosa Blvd",
            "neighborhood": "Roswell",
            "city": "Roswell",
            "state": "GA",
            "zip": "30075",
            "lat": 34.0209,
            "lng": -84.3454,
            "venue_type": "church",
            "spot_type": "church",
            "website": "https://roswellpres.org",
        }
    elif "roswell area park" in location_text.lower():
        return {
            "name": "Roswell Area Park",
            "slug": "roswell-area-park",
            "address": "10495 Woodstock Rd",
            "neighborhood": "Roswell",
            "city": "Roswell",
            "state": "GA",
            "zip": "30075",
            "lat": 34.0523,
            "lng": -84.3625,
            "venue_type": "park",
            "spot_type": "park",
            "website": "https://www.roswellgov.com/recreation",
        }
    elif "roswell library" in location_text.lower():
        return {
            "name": "Roswell Library",
            "slug": "roswell-library",
            "address": "115 Norcross St",
            "neighborhood": "Historic Roswell",
            "city": "Roswell",
            "state": "GA",
            "zip": "30075",
            "lat": 34.0229,
            "lng": -84.3619,
            "venue_type": "library",
            "spot_type": "library",
            "website": "https://www.roswelllibrary.org",
        }

    # If no match, return default venue
    return default_venue


def infer_category(title: str, description: str) -> str:
    """Infer category from event title and description."""
    combined = (title + " " + description).lower()

    if any(word in combined for word in ["concert", "music", "band", "jazz", "tribute", "singer"]):
        return "music"
    elif any(word in combined for word in ["theater", "play", "musical", "performance"]):
        return "performing-arts"
    elif any(word in combined for word in ["workshop", "class", "learn", "training"]):
        return "community"
    elif any(word in combined for word in ["worship", "service", "church", "prayer"]):
        return "community"
    elif any(word in combined for word in ["documentary", "film", "movie"]):
        return "film"
    elif any(word in combined for word in ["art", "gallery", "exhibition", "museum"]):
        return "art"
    elif any(word in combined for word in ["kids", "children", "family", "youth"]):
        return "community"
    elif any(word in combined for word in ["festival", "celebration", "commemoration"]):
        return "community"

    return "community"


def scrape_event_page(page, event_url: str) -> Optional[dict]:
    """Scrape details from an individual event page."""
    try:
        page.goto(event_url, wait_until="domcontentloaded", timeout=30000)
        page.wait_for_timeout(2000)

        body_text = page.inner_text("body")

        # Extract title - look for h1 or main heading
        title = None
        try:
            title_elem = page.locator("h1").first
            if title_elem:
                title = title_elem.inner_text().strip()
        except:
            pass

        if not title:
            # Try to find title from URL
            match = re.search(r"/event/([^/]+)", event_url)
            if match:
                title = match.group(1).replace("-", " ").title()

        if not title or len(title) < 3:
            logger.debug(f"No valid title found for {event_url}")
            return None

        # Extract date and time from "Feb 21, 2026 at 7:00pm" pattern
        date_match = re.search(
            r"(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(\d{4})",
            body_text
        )

        if not date_match:
            logger.debug(f"No date found for {event_url}")
            return None

        date_str = f"{date_match.group(1)} {date_match.group(2)}, {date_match.group(3)}"
        start_date = parse_date(date_str)

        if not start_date:
            logger.debug(f"Could not parse date '{date_str}' for {event_url}")
            return None

        # Extract time
        start_time = None
        time_match = re.search(r"at\s+(\d{1,2}:\d{2}\s*(?:am|pm))", body_text, re.IGNORECASE)
        if time_match:
            start_time = parse_time(time_match.group(1))

        # Extract description - look for paragraphs after the title
        description = ""
        _BANNER_PHRASES = [
            "cookie", "consent", "we value your privacy", "privacy policy",
            "accept all", "decline all", "essential cookies", "analytics cookies",
            "gdpr", "data protection", "manage preferences",
        ]
        try:
            # Prefer content area over all <p> tags
            content = page.locator(".entry-content p, .event-content p, article p")
            paragraphs = content.all() if content.count() > 0 else page.locator("p").all()
            desc_parts = []
            for p in paragraphs[:5]:
                text = p.inner_text().strip()
                text_lower = text.lower()
                if len(text) > 20 and not any(bp in text_lower for bp in _BANNER_PHRASES):
                    desc_parts.append(text)
            description = " ".join(desc_parts)[:500]
        except:
            pass

        # Extract location/venue
        location_text = ""
        location_match = re.search(r"at\s+([^\n]+(?:Center|Church|Library|Park|Arena|Theater))", body_text, re.IGNORECASE)
        if location_match:
            location_text = location_match.group(1).strip()

        venue_data = parse_venue_from_text(location_text)

        # Extract price info
        price_min, price_max, price_note, is_free = extract_price_info(body_text)

        # Extract image — filter out cookie/privacy plugin images
        _COOKIE_IMG_WORDS = ["cookie-law", "gdpr", "consent", "privacy-mgmt"]
        image_url = None
        try:
            # Try og:image first (most reliable)
            og_img = page.locator("meta[property='og:image']").first
            if og_img:
                og_src = og_img.get_attribute("content")
                if og_src and not any(w in og_src.lower() for w in _COOKIE_IMG_WORDS):
                    image_url = og_src
            # Fallback to content images
            if not image_url:
                for sel in [".entry-content img", ".event-content img", "article img", "img[src*='roswell365']"]:
                    img = page.locator(sel).first
                    if img:
                        src = img.get_attribute("src")
                        if src and not any(w in src.lower() for w in _COOKIE_IMG_WORDS):
                            image_url = src
                            break
            if image_url and not image_url.startswith("http"):
                image_url = urljoin(BASE_URL, image_url)
        except:
            pass

        # Extract ticket URL
        ticket_url = None
        try:
            buy_link = page.locator("a:has-text('BUY TICKETS')").first
            if buy_link:
                ticket_url = buy_link.get_attribute("href")
                if ticket_url and not ticket_url.startswith("http"):
                    ticket_url = urljoin(BASE_URL, ticket_url)
        except:
            pass

        if not ticket_url:
            ticket_url = event_url

        category = infer_category(title, description)

        # Build tags
        tags = ["roswell"]
        if "roswell roots" in body_text.lower():
            tags.extend(["roswell-roots", "black-history-month"])
        if category == "music":
            tags.append("live-music")
        if "cultural arts center" in location_text.lower():
            tags.append("cultural-arts")

        return {
            "title": title,
            "start_date": start_date,
            "start_time": start_time,
            "description": description,
            "venue_data": venue_data,
            "price_min": price_min,
            "price_max": price_max,
            "price_note": price_note,
            "is_free": is_free,
            "image_url": image_url,
            "ticket_url": ticket_url,
            "source_url": event_url,
            "category": category,
            "tags": tags,
        }

    except Exception as e:
        logger.error(f"Failed to scrape event page {event_url}: {e}")
        return None


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Roswell365.com events using Playwright."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
                viewport={"width": 1920, "height": 1080},
            )
            page = context.new_page()

            # Collect event URLs from main listing page (with pagination)
            event_urls = set()
            page_num = 1
            max_pages = 10  # Safety limit

            while page_num <= max_pages:
                list_url = f"{EVENTS_URL}?page={page_num}" if page_num > 1 else EVENTS_URL

                logger.info(f"Fetching Roswell365 events page {page_num}: {list_url}")
                page.goto(list_url, wait_until="domcontentloaded", timeout=30000)
                page.wait_for_timeout(3000)

                # Scroll to load all content - wrap in try/except to handle navigation issues
                try:
                    for _ in range(3):
                        page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                        page.wait_for_timeout(500)
                except Exception as e:
                    logger.debug(f"Scroll failed (likely navigation): {e}")

                # Extract event links
                links = page.locator("a[href*='/event/']").all()
                found_new = False

                for link in links:
                    href = link.get_attribute("href")
                    if not href:
                        continue

                    # Full URL
                    if href.startswith("http"):
                        event_url = href
                    else:
                        event_url = urljoin(BASE_URL, href)

                    # Skip the main events page and pagination links
                    if event_url in [EVENTS_URL, f"{BASE_URL}/event/"] or "?page=" in event_url or "?view=" in event_url or "print_event_search_result" in event_url:
                        continue

                    if event_url not in event_urls:
                        event_urls.add(event_url)
                        found_new = True

                # Check if there are more pages
                next_page_link = page.locator(f"a[href*='?page={page_num + 1}']").first
                if not next_page_link or not found_new:
                    break

                page_num += 1

            logger.info(f"Found {len(event_urls)} unique event URLs")

            # Scrape each event page
            for event_url in sorted(event_urls):
                events_found += 1

                event_data = scrape_event_page(page, event_url)
                if not event_data:
                    continue

                # Get or create venue
                venue_id = get_or_create_venue(event_data["venue_data"])

                # Check for duplicates
                content_hash = generate_content_hash(
                    event_data["title"],
                    event_data["venue_data"]["name"],
                    event_data["start_date"]
                )

                # Prepare event record
                event_record = {
                    "source_id": source_id,
                    "venue_id": venue_id,
                    "title": event_data["title"],
                    "description": event_data["description"],
                    "start_date": event_data["start_date"],
                    "start_time": event_data["start_time"],
                    "end_date": None,
                    "end_time": None,
                    "is_all_day": False,
                    "category": event_data["category"],
                    "tags": event_data["tags"],
                    "price_min": event_data["price_min"],
                    "price_max": event_data["price_max"],
                    "price_note": event_data["price_note"],
                    "is_free": event_data["is_free"],
                    "source_url": event_data["source_url"],
                    "ticket_url": event_data["ticket_url"],
                    "image_url": event_data["image_url"],
                    "raw_text": None,
                    "extraction_confidence": 0.85,
                    "is_recurring": False,
                    "recurrence_rule": None,
                    "content_hash": content_hash,
                }

                # Enrich from detail page
                enrich_event_record(event_record, source_name="Roswell365")

                # Determine is_free if still unknown after enrichment
                if event_record.get("is_free") is None:
                    desc_lower = (event_record.get("description") or "").lower()
                    title_lower = event_record.get("title", "").lower()
                    combined = f"{title_lower} {desc_lower}"
                    if any(kw in combined for kw in ["free", "no cost", "no charge", "complimentary"]):
                        event_record["is_free"] = True
                        event_record["price_min"] = event_record.get("price_min") or 0
                        event_record["price_max"] = event_record.get("price_max") or 0
                    else:
                        event_record["is_free"] = False

                existing = find_event_by_hash(content_hash)
                if existing:
                    smart_update_existing_event(existing, event_record)
                    events_updated += 1
                    logger.debug(f"Event updated: {event_data['title']}")
                    continue

                try:
                    insert_event(event_record)
                    events_new += 1
                    logger.info(f"Added: {event_data['title']} on {event_data['start_date']}")
                except Exception as e:
                    logger.error(f"Failed to insert event '{event_data['title']}': {e}")

            browser.close()

        logger.info(
            f"Roswell365 crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Roswell365: {e}")
        raise

    return events_found, events_new, events_updated
