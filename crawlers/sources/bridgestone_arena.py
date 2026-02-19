"""
Crawler for Bridgestone Arena (bridgestonearena.com/events).
Nashville's premier arena for major concerts, sporting events, and entertainment.

Site uses JavaScript rendering - must use Playwright.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime
from typing import Optional

from playwright.sync_api import sync_playwright
from bs4 import BeautifulSoup

from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash
from utils import extract_event_links, find_event_url, enrich_event_record

logger = logging.getLogger(__name__)

BASE_URL = "https://www.bridgestonearena.com"
EVENTS_URL = f"{BASE_URL}/events"

VENUE_DATA = {
    "name": "Bridgestone Arena",
    "slug": "bridgestone-arena",
    "address": "501 Broadway",
    "city": "Nashville",
    "state": "TN",
    "zip": "37203",
    "neighborhood": "Downtown",
    "venue_type": "arena",
    "website": BASE_URL,
    "lat": 36.1593,
    "lng": -86.7784,
}


def parse_date(date_text: str) -> Optional[str]:
    """Parse date from various formats to YYYY-MM-DD."""
    formats = [
        "%B %d, %Y",      # "January 15, 2026"
        "%b %d, %Y",      # "Jan 15, 2026"
        "%m/%d/%Y",       # "01/15/2026"
        "%Y-%m-%d",       # "2026-01-15"
        "%A, %B %d, %Y",  # "Monday, January 15, 2026"
        "%b %d",          # "Jan 15" - will add current year
    ]

    date_text = date_text.strip()

    for fmt in formats:
        try:
            if "%Y" not in fmt:
                # Add current year
                date_text_with_year = f"{date_text}, {datetime.now().year}"
                dt = datetime.strptime(date_text_with_year, fmt + ", %Y")
                # If date is in the past, assume next year
                if dt.date() < datetime.now().date():
                    dt = datetime.strptime(f"{date_text}, {datetime.now().year + 1}", fmt + ", %Y")
            else:
                dt = datetime.strptime(date_text, fmt)
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            continue

    return None


def parse_time(time_text: str) -> Optional[str]:
    """Parse time from '7:00 PM' or '19:00' format to 24-hour time."""
    match = re.search(r"(\d{1,2}):(\d{2})\s*(am|pm)", time_text, re.IGNORECASE)
    if match:
        hour, minute, period = match.groups()
        hour = int(hour)
        if period.lower() == "pm" and hour != 12:
            hour += 12
        elif period.lower() == "am" and hour == 12:
            hour = 0
        return f"{hour:02d}:{minute}"
    return None


def determine_category(title: str, description: str = "") -> tuple[str, Optional[str]]:
    """Determine category and subcategory based on title and description."""
    title_lower = title.lower()
    desc_lower = description.lower()
    combined = f"{title_lower} {desc_lower}"

    # Sports
    if any(word in combined for word in ["predators", "nhl", "hockey", "basketball", "nba"]):
        return "sports", "hockey" if "hockey" in combined or "nhl" in combined else "basketball"

    # Concerts/Music
    if any(word in combined for word in ["concert", "tour", "live", "show"]):
        return "music", "concert"

    # Wrestling/Entertainment
    if any(word in combined for word in ["wwe", "wrestling", "smackdown", "raw"]):
        return "sports", "wrestling"

    # Comedy
    if any(word in combined for word in ["comedy", "comedian", "stand-up"]):
        return "comedy", None

    # Family shows
    if any(word in combined for word in ["disney", "frozen", "sesame street", "kids"]):
        return "family", "kids-show"

    # Default to music for arena
    return "music", "concert"


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Bridgestone Arena events using Playwright."""
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

            venue_id = get_or_create_venue(VENUE_DATA)

            logger.info(f"Fetching Bridgestone Arena: {EVENTS_URL}")
            page.goto(EVENTS_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(3000)

            # Scroll to load all content
            for _ in range(5):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1000)

            # Extract event links for specific URLs
            event_links = extract_event_links(page, BASE_URL)

            # Get page HTML and parse with BeautifulSoup
            html = page.content()
            soup = BeautifulSoup(html, "html.parser")

            # Find all event containers
            event_containers = soup.find_all("div", class_=re.compile(r"event|show|game|card", re.I))

            if not event_containers:
                # Try alternative selectors
                event_containers = soup.find_all("li", class_=re.compile(r"event|show", re.I))

            if not event_containers:
                event_containers = soup.find_all("article")

            logger.info(f"Found {len(event_containers)} potential event containers")

            for container in event_containers:
                try:
                    # Extract title
                    title_elem = (
                        container.find("h2") or
                        container.find("h3") or
                        container.find("h4") or
                        container.find(class_=re.compile(r"title|name|headline", re.I))
                    )
                    if not title_elem:
                        continue

                    title = title_elem.get_text(strip=True)
                    if not title or len(title) < 3:
                        continue

                    # Extract date
                    date_elem = container.find(class_=re.compile(r"date|when|day", re.I))
                    if not date_elem:
                        # Try data attributes
                        date_attr = container.get("data-date") or container.get("data-start")
                        if date_attr:
                            start_date = parse_date(date_attr)
                        else:
                            continue
                    else:
                        date_text = date_elem.get_text(strip=True)
                        start_date = parse_date(date_text)

                    if not start_date:
                        logger.debug(f"Could not parse date for: {title}")
                        continue

                    # Extract time
                    time_elem = container.find(class_=re.compile(r"time|hour", re.I))
                    start_time = None
                    if time_elem:
                        time_text = time_elem.get_text(strip=True)
                        start_time = parse_time(time_text)

                    # Extract description
                    desc_elem = container.find(class_=re.compile(r"description|summary|excerpt", re.I))
                    description = desc_elem.get_text(strip=True) if desc_elem else f"Live event at Bridgestone Arena"

                    # Determine category
                    category, subcategory = determine_category(title, description)

                    # Extract ticket URL
                    ticket_url = EVENTS_URL
                    ticket_link = container.find("a", href=re.compile(r"ticket|buy|purchase", re.I))
                    if not ticket_link:
                        ticket_link = container.find("a")

                    if ticket_link and ticket_link.get("href"):
                        ticket_url = ticket_link["href"]
                        if ticket_url.startswith("/"):
                            ticket_url = BASE_URL + ticket_url

                    # Extract image URL
                    image_url = None
                    img_elem = container.find("img")
                    if img_elem:
                        image_url = img_elem.get("src") or img_elem.get("data-src")
                        if image_url and image_url.startswith("/"):
                            image_url = BASE_URL + image_url

                    events_found += 1

                    content_hash = generate_content_hash(title, "Bridgestone Arena", start_date)


                    # Build tags
                    tags = ["bridgestone-arena", "downtown-nashville", "arena"]

                    if category == "sports":
                        tags.append("sports")
                        if "predators" in title.lower():
                            tags.append("nashville-predators")
                    elif category == "music":
                        tags.append("concert")
                    elif category == "comedy":
                        tags.append("comedy")

                    # Get specific event URL


                    event_url = find_event_url(title, event_links, EVENTS_URL)



                    event_record = {
                        "source_id": source_id,
                        "venue_id": venue_id,
                        "title": title,
                        "description": description,
                        "start_date": start_date,
                        "start_time": start_time,
                        "end_date": None,
                        "end_time": None,
                        "is_all_day": False,
                        "category": category,
                        "subcategory": subcategory,
                        "tags": tags,
                        "price_min": None,
                        "price_max": None,
                        "price_note": None,
                        "is_free": None,
                        "source_url": event_url,
                        "ticket_url": ticket_url,
                        "image_url": image_url,
                        "raw_text": f"{title} - {start_date} - {description}",
                        "extraction_confidence": 0.90,
                        "is_recurring": False,
                        "recurrence_rule": None,
                        "content_hash": content_hash,
                    }

                    # Enrich from detail page
                    enrich_event_record(event_record, source_name="Bridgestone Arena")

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
                        continue

                    insert_event(event_record)
                    events_new += 1
                    logger.info(f"Added: {title} on {start_date}")

                except Exception as e:
                    logger.error(f"Failed to parse event: {e}")
                    continue

            browser.close()

        logger.info(
            f"Bridgestone Arena crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Bridgestone Arena: {e}")
        raise

    return events_found, events_new, events_updated
