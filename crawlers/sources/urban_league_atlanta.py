"""
Crawler for Urban League of Greater Atlanta (ulgatl.org/events).

African American empowerment organization offering education, workforce development,
and civil rights advocacy. Site uses JavaScript rendering - must use Playwright.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime
from typing import Optional

from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout

from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash
from utils import extract_images_from_page, extract_event_links, find_event_url

logger = logging.getLogger(__name__)

BASE_URL = "https://ulgatl.org"
EVENTS_URL = f"{BASE_URL}/events"

# Urban League HQ venue
URBAN_LEAGUE_HQ = {
    "name": "Urban League of Greater Atlanta",
    "slug": "urban-league-greater-atlanta",
    "address": "100 Edgewood Ave NE",
    "neighborhood": "Downtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30303",
    "venue_type": "nonprofit",
    "website": BASE_URL,
}


def parse_event_date(date_text: str) -> Optional[dict]:
    """
    Parse various date formats from Urban League events.
    Examples:
    - "February 15, 2026"
    - "March 1, 2026 at 6:00 PM"
    - "Apr 10 @ 2:00 pm"
    """
    if not date_text:
        return None

    # Try format: "Month DD, YYYY" or "Month DD, YYYY at HH:MM AM/PM"
    match = re.search(
        r'(\w+)\s+(\d+),?\s+(\d{4})\s*(?:at|@)?\s*(\d{1,2}):?(\d{2})?\s*(am|pm)?',
        date_text,
        re.IGNORECASE
    )

    if match:
        month, day, year, hour, minute, period = match.groups()
        try:
            dt = datetime.strptime(f"{month} {day} {year}", "%B %d %Y")
        except ValueError:
            try:
                dt = datetime.strptime(f"{month} {day} {year}", "%b %d %Y")
            except ValueError:
                return None

        start_date = dt.strftime("%Y-%m-%d")
        start_time = None

        if hour and period:
            hour = int(hour)
            minute = minute or "00"
            if period.lower() == "pm" and hour != 12:
                hour += 12
            elif period.lower() == "am" and hour == 12:
                hour = 0
            start_time = f"{hour:02d}:{minute}"

        return {
            "start_date": start_date,
            "start_time": start_time,
        }

    # Try simple format: "Month DD, YYYY"
    match = re.search(r'(\w+)\s+(\d+),?\s+(\d{4})', date_text, re.IGNORECASE)
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


def determine_category(title: str, description: str = "") -> str:
    """Determine event category based on title and description."""
    text = f"{title} {description}".lower()

    if any(word in text for word in ["job fair", "career", "workforce", "employment", "hiring"]):
        return "community"
    if any(word in text for word in ["education", "workshop", "training", "class", "seminar", "conference"]):
        return "education"
    if any(word in text for word in ["gala", "fundraiser", "benefit", "celebration"]):
        return "community"
    if any(word in text for word in ["volunteer", "service", "community service"]):
        return "community"
    if any(word in text for word in ["youth", "teen", "student"]):
        return "education"

    return "community"


def extract_tags(title: str, description: str = "") -> list[str]:
    """Extract relevant tags from event content."""
    text = f"{title} {description}".lower()
    tags = ["civil-rights", "education", "workforce"]  # Default tags

    if any(word in text for word in ["volunteer", "community service"]):
        tags.append("volunteer")
    if any(word in text for word in ["job", "career", "employment", "hiring"]):
        tags.append("job-fair")
    if any(word in text for word in ["youth", "teen", "student", "scholarship"]):
        tags.append("youth")
    if any(word in text for word in ["health", "wellness", "mental health"]):
        tags.append("health")
    if any(word in text for word in ["entrepreneur", "business", "small business"]):
        tags.append("business")
    if any(word in text for word in ["voter", "voting", "election", "advocacy"]):
        tags.append("advocacy")
    if any(word in text for word in ["family", "families"]):
        tags.append("family-friendly")
    if any(word in text for word in ["free", "no cost", "no charge"]):
        tags.append("free")

    return list(set(tags))


def is_free_event(title: str, description: str = "") -> bool:
    """Determine if event is free based on content."""
    text = f"{title} {description}".lower()

    # Check for explicit free mentions
    if any(word in text for word in ["free", "no cost", "no charge", "complimentary"]):
        return True

    # Check for paid indicators
    if any(word in text for word in ["$", "ticket", "registration fee", "cost:", "price:", "donation"]):
        return False

    # Default to True for Urban League community events
    return True


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl Urban League of Greater Atlanta events using Playwright.

    The events page typically shows event cards with title, date, description,
    and registration links.
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

            # Get venue ID for Urban League HQ
            venue_id = get_or_create_venue(URBAN_LEAGUE_HQ)

            logger.info(f"Fetching Urban League events: {EVENTS_URL}")
            page.goto(EVENTS_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(5000)

            # Extract images from page
            image_map = extract_images_from_page(page)

            # Extract event links for specific URLs
            event_links = extract_event_links(page, BASE_URL)

            # Scroll to load all content
            for _ in range(5):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1000)

            # Try to find event containers
            # Common WordPress event plugin selectors
            event_selectors = [
                ".event-item",
                ".tribe-event",
                ".event-card",
                ".upcoming-event",
                "article[class*='event']",
                ".post-type-event",
            ]

            events = []
            for selector in event_selectors:
                try:
                    elements = page.query_selector_all(selector)
                    if elements:
                        events = elements
                        logger.info(f"Found {len(events)} events using selector: {selector}")
                        break
                except Exception:
                    continue

            if not events:
                # Fall back to parsing text content
                logger.info("No event containers found, parsing text content")
                body_text = page.inner_text("body")
                lines = [l.strip() for l in body_text.split("\n") if l.strip()]

                # Look for event patterns in text
                i = 0
                while i < len(lines):
                    line = lines[i]

                    # Skip navigation, headers, footers
                    if len(line) < 10 or any(skip in line.lower() for skip in [
                        "navigation", "menu", "footer", "copyright", "privacy",
                        "contact us", "about us", "donate"
                    ]):
                        i += 1
                        continue

                    # Try to parse date
                    date_data = parse_event_date(line)

                    if date_data:
                        # Previous line might be title
                        title = None
                        if i > 0:
                            potential_title = lines[i - 1]
                            if len(potential_title) > 10 and not parse_event_date(potential_title):
                                title = potential_title

                        # Next lines might be description
                        description = ""
                        if i + 1 < len(lines):
                            potential_desc = lines[i + 1]
                            if len(potential_desc) > 20:
                                description = potential_desc

                        if title:
                            events_found += 1

                            category = determine_category(title, description)
                            tags = extract_tags(title, description)
                            is_free = is_free_event(title, description)

                            content_hash = generate_content_hash(
                                title, "Urban League of Greater Atlanta", date_data["start_date"]
                            )


                            # Get specific event URL


                            event_url = find_event_url(title, event_links, EVENTS_URL)



                            event_record = {
                                "source_id": source_id,
                                "venue_id": venue_id,
                                "title": title,
                                "description": description if description else None,
                                "start_date": date_data["start_date"],
                                "start_time": date_data["start_time"],
                                "end_date": None,
                                "end_time": None,
                                "is_all_day": date_data["start_time"] is None,
                                "category": category,
                                "subcategory": None,
                                "tags": tags,
                                "price_min": None,
                                "price_max": None,
                                "price_note": None,
                                "is_free": is_free,
                                "source_url": event_url,
                                "ticket_url": event_url if event_url != (EVENTS_URL if "EVENTS_URL" in dir() else BASE_URL) else None,
                                "image_url": image_map.get(title),
                                "raw_text": f"{title} | {line} | {description[:200]}"[:500],
                                "extraction_confidence": 0.80,
                                "is_recurring": False,
                                "recurrence_rule": None,
                                "content_hash": content_hash,
                            }

                            existing = find_event_by_hash(content_hash)
                            if existing:
                                smart_update_existing_event(existing, event_record)
                                events_updated += 1
                                i += 1
                                continue

                            try:
                                insert_event(event_record)
                                events_new += 1
                                logger.info(f"Added: {title} on {date_data['start_date']}")
                            except Exception as e:
                                logger.error(f"Failed to insert: {title}: {e}")

                    i += 1
            else:
                # Parse structured event elements
                for event_elem in events:
                    try:
                        title = event_elem.inner_text().split("\n")[0].strip()
                        event_text = event_elem.inner_text()

                        # Extract date
                        date_data = parse_event_date(event_text)
                        if not date_data:
                            continue

                        # Extract description (usually after title and date)
                        description = ""
                        lines = event_text.split("\n")
                        for line in lines[2:]:  # Skip title and date
                            if len(line) > 20:
                                description = line
                                break

                        events_found += 1

                        category = determine_category(title, description)
                        tags = extract_tags(title, description)
                        is_free = is_free_event(title, description)

                        content_hash = generate_content_hash(
                            title, "Urban League of Greater Atlanta", date_data["start_date"]
                        )

                        existing = find_event_by_hash(content_hash)
                        if existing:
                            smart_update_existing_event(existing, event_record)
                            events_updated += 1
                            continue

                        # Get specific event URL


                        event_url = find_event_url(title, event_links, EVENTS_URL)



                        event_record = {
                            "source_id": source_id,
                            "venue_id": venue_id,
                            "title": title,
                            "description": description if description else None,
                            "start_date": date_data["start_date"],
                            "start_time": date_data["start_time"],
                            "end_date": None,
                            "end_time": None,
                            "is_all_day": date_data["start_time"] is None,
                            "category": category,
                            "subcategory": None,
                            "tags": tags,
                            "price_min": None,
                            "price_max": None,
                            "price_note": None,
                            "is_free": is_free,
                            "source_url": event_url,
                            "ticket_url": event_url if event_url != (EVENTS_URL if "EVENTS_URL" in dir() else BASE_URL) else None,
                            "image_url": image_map.get(title),
                            "raw_text": event_text[:500],
                            "extraction_confidence": 0.85,
                            "is_recurring": False,
                            "recurrence_rule": None,
                            "content_hash": content_hash,
                        }

                        try:
                            insert_event(event_record)
                            events_new += 1
                            logger.info(f"Added: {title} on {date_data['start_date']}")
                        except Exception as e:
                            logger.error(f"Failed to insert: {title}: {e}")

                    except Exception as e:
                        logger.warning(f"Failed to parse event element: {e}")
                        continue

            browser.close()

        logger.info(
            f"Urban League crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except PlaywrightTimeout as e:
        logger.error(f"Timeout fetching Urban League: {e}")
        raise
    except Exception as e:
        logger.error(f"Failed to crawl Urban League: {e}")
        raise

    return events_found, events_new, events_updated
