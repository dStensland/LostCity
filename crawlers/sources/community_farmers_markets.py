"""
Crawler for Community Farmers Markets (cfmatl.org).

Largest farmers market nonprofit in the Southeast, operating 5 weekly markets
near Emory University area. The primary value of this crawler is registering
all CFM market locations as destination venues (farmers markets are places
people want to visit, not just event sources).

Market locations as venues:
- CFM Decatur Farmers Market: Wednesdays 4-7pm at First Baptist Church, 308 Clairmont Ave
- CFM Oakhurst Farmers Market: Saturdays 9am-1pm at Sceptre Brewing Arts, 630 East Lake Dr
- CFM East Atlanta Village Farmers Market: Thursdays 4-8pm at 572 Stokeswood Ave SE
- CFM Grant Park Farmers Market: Sundays 9am-1pm at 1040 Grant St SE

Special events:
This crawler also monitors cfmatl.org/get-involved/events/ for special events like
Farm Fondo (cycling event) and Red Clay Soirée (annual fundraising gala). These are
only added as events when specific dates are listed on the page. As of 2026-02, the
events page describes these annual events but doesn't list 2026 dates yet.
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

logger = logging.getLogger(__name__)

BASE_URL = "https://cfmatl.org"
EVENTS_URL = f"{BASE_URL}/get-involved/events/"

# Community Farmers Markets organization HQ
CFM_ORG = {
    "name": "Community Farmers Markets",
    "slug": "community-farmers-markets",
    "address": "308 Clairmont Ave",
    "neighborhood": "Decatur",
    "city": "Decatur",
    "state": "GA",
    "zip": "30030",
    "lat": 33.7746,
    "lng": -84.2963,
    "venue_type": "organization",
    "spot_type": "farmers_market",
    "website": BASE_URL,
    "vibes": ["farmers-market", "local-food", "sustainable", "community"],
}

# Individual market locations as destination venues
MARKET_LOCATIONS = [
    {
        "name": "CFM Decatur Farmers Market",
        "slug": "cfm-decatur-farmers-market",
        "address": "308 Clairmont Ave",
        "neighborhood": "Decatur",
        "city": "Decatur",
        "state": "GA",
        "zip": "30030",
        "lat": 33.7746,
        "lng": -84.2963,
        "venue_type": "farmers_market",
        "spot_type": "farmers_market",
        "website": BASE_URL,
        "vibes": ["farmers-market", "local-food", "outdoor", "family-friendly"],
        "description": "Weekly farmers market every Wednesday 4-7pm at First Baptist Church of Decatur. Fresh produce, local vendors, and community gathering.",
    },
    {
        "name": "CFM Oakhurst Farmers Market",
        "slug": "cfm-oakhurst-farmers-market",
        "address": "630 East Lake Dr",
        "neighborhood": "Oakhurst",
        "city": "Decatur",
        "state": "GA",
        "zip": "30030",
        "lat": 33.7512,
        "lng": -84.3059,
        "venue_type": "farmers_market",
        "spot_type": "farmers_market",
        "website": BASE_URL,
        "vibes": ["farmers-market", "local-food", "outdoor", "family-friendly", "brewery"],
        "description": "Weekly farmers market every Saturday 9am-1pm at Sceptre Brewing Arts. Fresh produce, local vendors, and craft beer.",
    },
    {
        "name": "CFM East Atlanta Village Farmers Market",
        "slug": "cfm-east-atlanta-village-farmers-market",
        "address": "572 Stokeswood Ave SE",
        "neighborhood": "East Atlanta Village",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30316",
        "lat": 33.7369,
        "lng": -84.3432,
        "venue_type": "farmers_market",
        "spot_type": "farmers_market",
        "website": BASE_URL,
        "vibes": ["farmers-market", "local-food", "outdoor", "family-friendly"],
        "description": "Weekly farmers market every Thursday 4-8pm. Fresh produce, local vendors, and community gathering in East Atlanta Village.",
    },
    {
        "name": "CFM Grant Park Farmers Market",
        "slug": "cfm-grant-park-farmers-market",
        "address": "1040 Grant St SE",
        "neighborhood": "Grant Park",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30315",
        "lat": 33.7384,
        "lng": -84.3686,
        "venue_type": "farmers_market",
        "spot_type": "farmers_market",
        "website": BASE_URL,
        "vibes": ["farmers-market", "local-food", "outdoor", "family-friendly"],
        "description": "Weekly farmers market every Sunday 9am-1pm. Fresh produce, local vendors, and community gathering in Grant Park.",
    },
]


def parse_event_date(date_text: str) -> Optional[dict]:
    """
    Parse various date formats from CFM events page.

    Examples:
    - "March 15, 2026"
    - "Saturday, April 10, 2026"
    """
    if not date_text:
        return None

    # Try format: "Day, Month DD, YYYY" or "Month DD, YYYY"
    match = re.search(
        r'(?:\w+,\s+)?(\w+)\s+(\d+),?\s+(\d{4})',
        date_text,
        re.IGNORECASE
    )

    if match:
        month, day, year = match.groups()
        try:
            dt = datetime.strptime(f"{month} {day} {year}", "%B %d %Y")
        except ValueError:
            try:
                dt = datetime.strptime(f"{month} {day} {year}", "%b %d %Y")
            except ValueError:
                return None

        return {
            "start_date": dt.strftime("%Y-%m-%d"),
            "start_time": None,
        }

    return None


def parse_time(time_text: str) -> Optional[str]:
    """
    Parse time from various formats.

    Examples:
    - '7:00 PM'
    - '7pm'
    - '7:30pm'
    """
    time_match = re.search(r'(\d{1,2}):?(\d{2})?\s*(am|pm)', time_text, re.IGNORECASE)
    if time_match:
        hour, minute, period = time_match.groups()
        hour = int(hour)
        minute = minute or "00"
        if period.lower() == "pm" and hour != 12:
            hour += 12
        elif period.lower() == "am" and hour == 12:
            hour = 0
        return f"{hour:02d}:{minute}"
    return None


def determine_category(title: str, description: str = "") -> str:
    """Determine event category based on title and description."""
    text = f"{title} {description}".lower()

    if any(word in text for word in ["gala", "soirée", "fundraiser", "benefit"]):
        return "community"
    if any(word in text for word in ["fondo", "ride", "bike", "cycling"]):
        return "sports"
    if any(word in text for word in ["farm tour", "tour", "workshop", "class"]):
        return "learning"
    if any(word in text for word in ["market", "farmers market"]):
        return "food-drink"

    return "community"


def extract_tags(title: str, description: str = "") -> list[str]:
    """Extract relevant tags from event content."""
    text = f"{title} {description}".lower()
    tags = ["local-food", "sustainable"]

    if any(word in text for word in ["fundraiser", "gala", "benefit", "soirée"]):
        tags.append("fundraiser")
    if any(word in text for word in ["farm", "farmers", "agriculture"]):
        tags.append("farm")
    if any(word in text for word in ["bike", "cycling", "ride", "fondo"]):
        tags.append("cycling")
    if any(word in text for word in ["chef", "food", "culinary", "cooking"]):
        tags.append("food")
    if any(word in text for word in ["family", "kid", "children", "all ages"]):
        tags.append("family-friendly")
    if any(word in text for word in ["outdoor", "outside"]):
        tags.append("outdoor")
    if "free" in text or "no cost" in text:
        tags.append("free")

    return list(set(tags))


def is_free_event(title: str, description: str = "") -> bool:
    """Determine if event is free based on content."""
    text = f"{title} {description}".lower()

    # Check for explicit free mentions
    if any(word in text for word in ["free", "no cost", "no charge"]):
        return True

    # Check for paid indicators
    if any(word in text for word in ["$", "ticket", "registration", "cost:", "price:"]):
        return False

    # Galas and fundraisers are typically paid
    if any(word in text for word in ["gala", "soirée", "fundraiser"]):
        return False

    return False


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl Community Farmers Markets events.

    First ensures all market locations are registered as destination venues,
    then crawls special events from the events page.
    """
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        # Ensure organization venue exists
        org_venue_id = get_or_create_venue(CFM_ORG)
        logger.info(f"CFM organization venue ID: {org_venue_id}")

        # Ensure all market location venues exist
        for market in MARKET_LOCATIONS:
            market_venue_id = get_or_create_venue(market)
            logger.info(f"Market location '{market['name']}' venue ID: {market_venue_id}")

        # Fetch events page
        logger.info(f"Fetching CFM events: {EVENTS_URL}")
        headers = {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
        }
        response = requests.get(EVENTS_URL, headers=headers, timeout=30)
        response.raise_for_status()

        soup = BeautifulSoup(response.content, "html.parser")

        # Look for event sections (h3 headings followed by paragraphs)
        # The CFM site doesn't have a single content container, so we search the whole page
        headings = soup.find_all(["h3", "h2"])

        for heading in headings:
            heading_text = heading.get_text(strip=True)

            # Skip "Community Events" header
            if "community events" in heading_text.lower():
                continue

            # Extract event details from paragraphs following the heading
            title = heading_text
            description_parts = []

            # Gather all sibling paragraphs until next heading
            for sibling in heading.find_next_siblings():
                if sibling.name in ["h2", "h3", "h4"]:
                    break
                if sibling.name == "p":
                    text = sibling.get_text(strip=True)
                    if text:
                        description_parts.append(text)

            description = " ".join(description_parts)

            # Skip if no description (likely not a real event)
            if not description or len(description) < 50:
                continue

            # Try to extract date from description
            date_data = None
            for part in description_parts:
                date_data = parse_event_date(part)
                if date_data:
                    break

            # If no specific date found, skip this item
            # (Farm Fondo and Red Clay Soirée may not have dates listed yet)
            # Per CLAUDE.md: only crawl programmed events with dates, not descriptions of annual events
            if not date_data:
                logger.info(f"Skipping '{title}' - no specific date found (event description only)")
                continue

            # Try to extract time from description
            start_time = None
            for part in description_parts:
                start_time = parse_time(part)
                if start_time:
                    break

            if date_data:
                date_data["start_time"] = start_time

            events_found += 1

            category = determine_category(title, description)
            tags = extract_tags(title, description)
            is_free = is_free_event(title, description)

            content_hash = generate_content_hash(
                title, "Community Farmers Markets", date_data["start_date"]
            )

            if find_event_by_hash(content_hash):
                events_updated += 1
                continue

            # Extract image if available
            image_url = None
            img = heading.find_next("img")
            if img and img.get("src"):
                image_url = img["src"]
                if not image_url.startswith("http"):
                    image_url = BASE_URL + image_url if image_url.startswith("/") else BASE_URL + "/" + image_url

            # Check for external links (like Red Clay Soirée)
            ticket_url = None
            link = heading.find("a") or (heading.find_next("p") and heading.find_next("p").find("a"))
            if link and link.get("href"):
                ticket_url = link["href"]

            event_record = {
                "source_id": source_id,
                "venue_id": org_venue_id,
                "title": title,
                "description": description[:1000] if description else None,
                "start_date": date_data["start_date"],
                "start_time": date_data.get("start_time"),
                "end_date": None,
                "end_time": None,
                "is_all_day": False,
                "category": category,
                "subcategory": None,
                "tags": tags,
                "price_min": None,
                "price_max": None,
                "price_note": None,
                "is_free": is_free,
                "source_url": EVENTS_URL,
                "ticket_url": ticket_url,
                "image_url": image_url,
                "raw_text": f"{title} | {description[:300]}"[:500],
                "extraction_confidence": 0.80,
                "is_recurring": False,
                "recurrence_rule": None,
                "content_hash": content_hash,
            }

            try:
                insert_event(event_record)
                events_new += 1
                logger.info(f"Added: {title} on {date_data['start_date']}")
            except Exception as e:
                logger.error(f"Failed to insert event '{title}': {e}")

        logger.info(
            f"CFM crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Community Farmers Markets: {e}")
        raise

    return events_found, events_new, events_updated
