"""
Crawler for Hands On Atlanta (volunteer.handsonatlanta.org).
The largest volunteer coordination hub in Atlanta.
Uses the Golden Volunteer API.
"""

from __future__ import annotations

import os
import re
import logging
from datetime import datetime, timedelta
from typing import Optional

import requests

from utils import slugify, validate_event_time
from db import get_or_create_venue, insert_event, find_event_by_hash
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

# Golden Volunteer API configuration
API_BASE = "https://api.goldenvolunteer.com/v1"
ORG_ID = "L5kJQOKdEl"
GOLDEN_VOLUNTEER_API_KEY = os.environ.get("GOLDEN_VOLUNTEER_API_KEY", "")

# Default location for Atlanta
ATLANTA_LAT = 33.748461
ATLANTA_LNG = -84.390678
SEARCH_RADIUS = 50  # miles

# Category mapping from Golden Volunteer interests
INTEREST_MAP = {
    "arts + culture": "art",
    "education": "community",
    "environment + sustainability": "community",
    "health + wellness": "fitness",
    "hunger + food insecurity": "community",
    "civil + human rights": "community",
    "senior services": "community",
    "youth + family services": "family",
}


def fetch_opportunities(page: int = 1, per_page: int = 50) -> dict:
    """Fetch volunteer opportunities from Golden Volunteer API."""
    if not GOLDEN_VOLUNTEER_API_KEY:
        logger.debug("GOLDEN_VOLUNTEER_API_KEY not set, skipping API fetch")
        return {}

    headers = {
        "Authorization": f"Bearer {GOLDEN_VOLUNTEER_API_KEY}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }

    # Try multiple API endpoint patterns
    endpoints = [
        f"{API_BASE}/organizations/{ORG_ID}/opportunities",
        f"{API_BASE}/opportunities",
        f"https://volunteer.handsonatlanta.org/api/opportunities",
    ]

    params = {
        "page": page,
        "per_page": per_page,
        "lat": ATLANTA_LAT,
        "lng": ATLANTA_LNG,
        "radius": SEARCH_RADIUS,
        "status": "published",
    }

    for endpoint in endpoints:
        try:
            response = requests.get(
                endpoint, headers=headers, params=params, timeout=30
            )
            if response.status_code == 200:
                return response.json()
        except Exception as e:
            logger.debug(f"Failed endpoint {endpoint}: {e}")
            continue

    return {}


def fetch_opportunities_via_page() -> list[dict]:
    """
    Fetch opportunities by scraping the page with Playwright.
    """
    from playwright.sync_api import sync_playwright

    opportunities = []

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                viewport={"width": 1920, "height": 1080},
            )
            page = context.new_page()

            logger.info("Fetching Hands On Atlanta via Playwright")
            page.goto(
                "https://volunteer.handsonatlanta.org",
                wait_until="domcontentloaded",
                timeout=30000,
            )
            page.wait_for_timeout(5000)  # Wait for JS to render

            # Get all opportunity cards - they have 'opportunity' in the class
            cards = page.query_selector_all("[class*='opportunity']")
            logger.info(f"Found {len(cards)} opportunity cards")

            for card in cards:
                try:
                    card_text = card.inner_text().strip()
                    lines = [l.strip() for l in card_text.split("\n") if l.strip()]

                    if len(lines) < 2:
                        continue

                    opp = {}

                    # First line is usually "Recommended" label, skip if so
                    idx = 0
                    if lines[0].lower() == "recommended":
                        idx = 1

                    # Title is the next line
                    if idx < len(lines):
                        opp["title"] = lines[idx]
                        idx += 1

                    # Organization is next
                    if idx < len(lines):
                        opp["organization"] = lines[idx]
                        idx += 1

                    # Date/time pattern: "Mon, Jan 19, 2026: 9:00AM - 12:00PM EST"
                    for line in lines[idx:]:
                        if re.search(r"\d{4}:", line):
                            opp["date_text"] = line
                            break

                    # Location pattern: "Location: Atlanta, GA"
                    for line in lines:
                        if line.startswith("Location:"):
                            opp["location"] = line.replace("Location:", "").strip()
                            break

                    # Capacity pattern: "Capacity: 24 Spots Available"
                    for line in lines:
                        if line.startswith("Capacity:"):
                            opp["capacity"] = line.replace("Capacity:", "").strip()
                            break

                    # Get link
                    link = card.query_selector("a")
                    if link:
                        opp["url"] = link.get_attribute("href")

                    if opp.get("title") and opp.get("date_text"):
                        opportunities.append(opp)

                except Exception as e:
                    logger.debug(f"Failed to parse opportunity card: {e}")
                    continue

            browser.close()

    except Exception as e:
        logger.error(f"Playwright fetch failed: {e}")

    return opportunities


def parse_opportunity(opp: dict) -> Optional[dict]:
    """Parse a volunteer opportunity into event format."""
    try:
        title = opp.get("title") or opp.get("name", "").strip()
        if not title:
            return None

        # Parse date from format like "Mon, Jan 19, 2026: 9:00AM - 12:00PM EST"
        date_text = opp.get("date_text") or opp.get("start_date") or ""
        start_date = None
        start_time = None

        if date_text:
            # Try to extract date: "Mon, Jan 19, 2026: 9:00AM"
            date_match = re.search(r"(\w+),?\s+(\w+)\s+(\d+),?\s+(\d{4})", date_text)
            if date_match:
                _, month, day, year = date_match.groups()
                for fmt in ["%B %d %Y", "%b %d %Y"]:
                    try:
                        dt = datetime.strptime(f"{month} {day} {year}", fmt)
                        start_date = dt.strftime("%Y-%m-%d")
                        break
                    except ValueError:
                        continue

            # Extract time: "9:00AM" or "9:00 AM"
            time_match = re.search(
                r"(\d{1,2}):(\d{2})\s*(AM|PM)", date_text, re.IGNORECASE
            )
            if time_match:
                hour, minute, period = time_match.groups()
                hour = int(hour)
                if period.upper() == "PM" and hour != 12:
                    hour += 12
                elif period.upper() == "AM" and hour == 12:
                    hour = 0
                start_time = f"{hour:02d}:{minute}"

        if not start_date:
            # Skip if we can't parse the date
            return None

        # Location
        location = opp.get("location") or "Atlanta, GA"
        organization = opp.get("organization") or "Hands On Atlanta"

        # Create venue name from organization
        venue_name = organization if organization else location.split(",")[0]

        # Category based on title/org
        category = "community"
        title_lower = title.lower()
        if any(w in title_lower for w in ["food", "pantry", "hunger", "meal"]):
            category = "community"
        elif any(w in title_lower for w in ["park", "tree", "garden", "environment"]):
            category = "community"
        elif any(w in title_lower for w in ["senior", "elder"]):
            category = "community"
        elif any(w in title_lower for w in ["kid", "child", "youth", "family"]):
            category = "family"

        # Description
        capacity = opp.get("capacity", "")
        description = f"Volunteer opportunity with {organization}"
        if capacity:
            description += f". {capacity}"

        # URL
        url = opp.get("url") or "https://volunteer.handsonatlanta.org"
        if url and not url.startswith("http"):
            url = f"https://volunteer.handsonatlanta.org{url}"

        return {
            "title": f"Volunteer: {title}",
            "description": description,
            "start_date": start_date,
            "start_time": start_time,
            "venue_name": venue_name,
            "location": location,
            "organization": organization,
            "category": category,
            "interests": opp.get("interests", []),
            "source_url": url,
            "is_free": True,
        }

    except Exception as e:
        logger.warning(f"Failed to parse opportunity: {e}")
        return None


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl Hands On Atlanta volunteer opportunities.

    Args:
        source: Source record from database

    Returns:
        Tuple of (events_found, events_new, events_updated)
    """
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        # Try API first
        logger.info("Attempting Hands On Atlanta API fetch")
        api_data = fetch_opportunities()
        opportunities = api_data.get("data", []) or api_data.get("opportunities", [])

        # Fall back to page scraping if API fails
        if not opportunities:
            logger.info("API fetch failed, falling back to page scraping")
            opportunities = fetch_opportunities_via_page()

        logger.info(f"Found {len(opportunities)} volunteer opportunities")

        for opp in opportunities:
            parsed = parse_opportunity(opp)
            if not parsed:
                continue

            events_found += 1

            # Validate time (1-5 AM is suspicious for volunteer events)
            validated_time, is_suspicious = validate_event_time(
                parsed.get("start_time"),
                category=parsed.get("category"),
                title=parsed.get("title", ""),
            )
            parsed["start_time"] = validated_time

            # Create venue
            venue_data = {
                "name": parsed["venue_name"],
                "slug": slugify(parsed["venue_name"]),
                "address": parsed.get("location"),
                "city": "Atlanta",
                "state": "GA",
                "venue_type": "organization",
            }
            venue_id = get_or_create_venue(venue_data)

            # Generate content hash
            content_hash = generate_content_hash(
                parsed["title"], parsed["venue_name"], parsed["start_date"]
            )

            # Check for existing
            existing = find_event_by_hash(content_hash)
            if existing:
                events_updated += 1
                continue

            # Build tags
            tags = ["volunteer", "community", "hands-on-atlanta"]
            tags.extend([slugify(i) for i in parsed.get("interests", [])])

            event_record = {
                "source_id": source_id,
                "venue_id": venue_id,
                "title": parsed["title"],
                "description": parsed.get("description"),
                "start_date": parsed["start_date"],
                "start_time": validated_time,
                "end_date": None,
                "end_time": None,
                "is_all_day": False,  # Volunteer events have specific times
                "category": parsed["category"],
                "subcategory": "volunteer",
                "tags": tags,
                "price_min": 0,
                "price_max": 0,
                "price_note": "Free - Volunteer Event",
                "is_free": True,
                "source_url": parsed["source_url"],
                "ticket_url": parsed["source_url"],
                "image_url": None,
                "raw_text": None,
                "extraction_confidence": 0.80,
                "is_recurring": False,
                "recurrence_rule": None,
                "content_hash": content_hash,
            }

            try:
                insert_event(event_record)
                events_new += 1
                logger.info(f"Added: {parsed['title']}")
            except Exception as e:
                logger.error(f"Failed to insert: {parsed['title']}: {e}")

        logger.info(
            f"Hands On Atlanta crawl complete: {events_found} found, {events_new} new"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Hands On Atlanta: {e}")
        raise

    return events_found, events_new, events_updated
