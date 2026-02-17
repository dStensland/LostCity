"""
Crawler for BAPS Shri Swaminarayan Mandir Atlanta.
https://www.baps.org/Global-Network/North-America/Atlanta.aspx

Traditional Hindu temple in Lilburn hosting major festivals, cultural programs,
kids activities, and spiritual gatherings. Open to people of all faiths.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime
from typing import Optional

from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout

from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://www.baps.org"
EVENTS_URL = f"{BASE_URL}/Global-Network/North-America/Atlanta/Upcoming-Events.aspx"

VENUE_DATA = {
    "name": "BAPS Shri Swaminarayan Mandir",
    "slug": "baps-mandir-atlanta",
    "address": "460 Rockbridge Rd NW",
    "neighborhood": "Lilburn",
    "city": "Lilburn",
    "state": "GA",
    "zip": "30047",
    "lat": 33.8847,
    "lng": -84.1362,
    "venue_type": "community_center",
    "spot_type": "attraction",
    "website": f"{BASE_URL}/Global-Network/North-America/Atlanta.aspx",
    "vibes": ["faith-hindu", "family-friendly", "all-ages", "historic"],
}


def parse_date_string(date_str: str) -> Optional[str]:
    """
    Parse date from various formats.
    Returns YYYY-MM-DD format string or None.
    """
    if not date_str:
        return None

    current_year = datetime.now().year

    # Try full month name formats (e.g., "February 7, 2026", "Feb 7")
    date_match = re.search(
        r"(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})(?:,?\s+(\d{4}))?",
        date_str,
        re.IGNORECASE
    )
    if date_match:
        month = date_match.group(1)
        day = int(date_match.group(2))
        year = int(date_match.group(3)) if date_match.group(3) else current_year
        try:
            dt = datetime.strptime(f"{month} {day} {year}", "%B %d %Y")
            if dt.date() < datetime.now().date() and not date_match.group(3):
                dt = datetime.strptime(f"{month} {day} {year + 1}", "%B %d %Y")
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            pass

    # Try short month name formats
    date_match = re.search(
        r"(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})(?:,?\s+(\d{4}))?",
        date_str,
        re.IGNORECASE
    )
    if date_match:
        month = date_match.group(1)
        day = int(date_match.group(2))
        year = int(date_match.group(3)) if date_match.group(3) else current_year
        try:
            dt = datetime.strptime(f"{month} {day} {year}", "%b %d %Y")
            if dt.date() < datetime.now().date() and not date_match.group(3):
                dt = datetime.strptime(f"{month} {day} {year + 1}", "%b %d %Y")
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            pass

    # Try MM/DD/YYYY format
    date_match = re.search(r"(\d{1,2})/(\d{1,2})/(\d{4})", date_str)
    if date_match:
        month = int(date_match.group(1))
        day = int(date_match.group(2))
        year = int(date_match.group(3))
        try:
            dt = datetime(year, month, day)
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            pass

    return None


def parse_time(time_text: str) -> Optional[str]:
    """Parse time from various formats like '7pm', '10:30 AM', 'noon'."""
    if not time_text:
        return None

    if "noon" in time_text.lower():
        return "12:00"

    match = re.search(r"(\d{1,2})(?::(\d{2}))?\s*(am|pm)", time_text, re.IGNORECASE)
    if match:
        hour = int(match.group(1))
        minute = match.group(2) or "00"
        period = match.group(3).lower()

        if period == "pm" and hour != 12:
            hour += 12
        elif period == "am" and hour == 12:
            hour = 0

        return f"{hour:02d}:{minute}"
    return None


def determine_category_and_tags(title: str, description: str) -> tuple[str, Optional[str], list[str]]:
    """Determine category based on title and description."""
    text = f"{title} {description}".lower()
    tags = ["baps-mandir", "hindu", "faith", "lilburn", "family-friendly", "free"]

    # Major festivals
    if any(kw in text for kw in ["diwali", "annakut", "holi", "janmashtami", "ram navami", "mahashivratri"]):
        tags.extend(["festival", "celebration", "cultural"])
        return "community", "celebration", tags

    # Birthday celebrations (guru birthdays, deity celebrations)
    if "birthday" in text or "jayanti" in text or "celebration" in text:
        tags.extend(["celebration", "cultural"])
        return "community", "celebration", tags

    # Kids programs
    if any(kw in text for kw in ["kids", "children", "youth", "bal", "balika"]):
        tags.extend(["kids", "all-ages"])
        return "family", "kids", tags

    # Cultural programs
    if any(kw in text for kw in ["cultural", "dance", "music", "sangeet", "garba", "raas"]):
        tags.extend(["cultural", "performance"])
        return "community", "cultural", tags

    # Educational/talks/lectures
    if any(kw in text for kw in ["talk", "lecture", "discourse", "satsang", "assembly"]):
        tags.extend(["lecture", "education", "spiritual"])
        return "learning", "lecture", tags

    # Wellness/yoga
    if any(kw in text for kw in ["yoga", "meditation", "wellness"]):
        tags.extend(["wellness", "meditation", "yoga"])
        return "wellness", "meditation", tags

    # Default to community
    return "community", "cultural", tags


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl BAPS Mandir Atlanta events using Playwright."""
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

            venue_id = get_or_create_venue(VENUE_DATA)

            logger.info(f"Fetching BAPS Mandir Atlanta events: {EVENTS_URL}")
            page.goto(EVENTS_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(3000)

            # Scroll to load all content
            for _ in range(3):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1000)

            # BAPS site typically uses structured event listings
            # Look for common patterns like .event, .eventItem, .calendar-item, etc.
            # Will need to inspect actual structure, but this is a reasonable starting approach

            # Try multiple possible selectors
            event_containers = []
            possible_selectors = [
                ".event-item",
                ".calendar-item",
                ".eventItem",
                ".event",
                "article",
                ".content-block",
                "tr.event",  # Sometimes calendar tables
            ]

            for selector in possible_selectors:
                found = page.query_selector_all(selector)
                if found and len(found) > 0:
                    logger.info(f"Found {len(found)} events using selector: {selector}")
                    event_containers = found
                    break

            # If no structured elements found, fall back to extracting from page text
            if not event_containers:
                logger.warning("No structured event elements found, attempting text extraction")
                page_text = page.inner_text("body")
                logger.info(f"Page text length: {len(page_text)} characters")

                # Look for date patterns in the text
                lines = [l.strip() for l in page_text.split("\n") if l.strip()]

                current_date = None
                current_title = None
                current_description = []

                for i, line in enumerate(lines):
                    # Check if this line contains a date
                    parsed_date = parse_date_string(line)

                    if parsed_date:
                        # If we have a previous event, save it
                        if current_date and current_title:
                            events_found += 1

                            content_hash = generate_content_hash(
                                current_title, "BAPS Shri Swaminarayan Mandir", current_date
                            )

                            if not find_event_by_hash(content_hash):
                                description_text = " ".join(current_description[:3])
                                start_time = parse_time(" ".join(current_description[:2]))

                                category, subcategory, tags = determine_category_and_tags(
                                    current_title, description_text
                                )

                                event_record = {
                                    "source_id": source_id,
                                    "venue_id": venue_id,
                                    "title": current_title[:200],
                                    "description": description_text[:1000] if description_text else None,
                                    "start_date": current_date,
                                    "start_time": start_time,
                                    "end_date": None,
                                    "end_time": None,
                                    "is_all_day": False,
                                    "category": category,
                                    "subcategory": subcategory,
                                    "tags": tags,
                                    "price_min": None,
                                    "price_max": None,
                                    "price_note": "Free admission - donations welcome",
                                    "is_free": True,
                                    "source_url": EVENTS_URL,
                                    "ticket_url": None,
                                    "image_url": None,
                                    "raw_text": f"{current_title} {description_text}"[:500],
                                    "extraction_confidence": 0.75,
                                    "is_recurring": False,
                                    "recurrence_rule": None,
                                    "content_hash": content_hash,
                                }

                                try:
                                    insert_event(event_record)
                                    events_new += 1
                                    logger.info(f"Added: {current_title[:50]}... on {current_date}")
                                except Exception as e:
                                    logger.error(f"Failed to insert: {current_title}: {e}")
                            else:
                                events_updated += 1

                        # Start new event
                        current_date = parsed_date
                        current_title = None
                        current_description = []

                        # Next non-empty line is likely the title
                        for j in range(i + 1, min(i + 5, len(lines))):
                            if lines[j] and len(lines[j]) > 5:
                                current_title = lines[j]
                                # Following lines are description
                                for k in range(j + 1, min(j + 4, len(lines))):
                                    if lines[k] and len(lines[k]) > 5:
                                        current_description.append(lines[k])
                                break

                # Process last event
                if current_date and current_title:
                    events_found += 1

                    content_hash = generate_content_hash(
                        current_title, "BAPS Shri Swaminarayan Mandir", current_date
                    )

                    if not find_event_by_hash(content_hash):
                        description_text = " ".join(current_description[:3])
                        start_time = parse_time(" ".join(current_description[:2]))

                        category, subcategory, tags = determine_category_and_tags(
                            current_title, description_text
                        )

                        event_record = {
                            "source_id": source_id,
                            "venue_id": venue_id,
                            "title": current_title[:200],
                            "description": description_text[:1000] if description_text else None,
                            "start_date": current_date,
                            "start_time": start_time,
                            "end_date": None,
                            "end_time": None,
                            "is_all_day": False,
                            "category": category,
                            "subcategory": subcategory,
                            "tags": tags,
                            "price_min": None,
                            "price_max": None,
                            "price_note": "Free admission - donations welcome",
                            "is_free": True,
                            "source_url": EVENTS_URL,
                            "ticket_url": None,
                            "image_url": None,
                            "raw_text": f"{current_title} {description_text}"[:500],
                            "extraction_confidence": 0.75,
                            "is_recurring": False,
                            "recurrence_rule": None,
                            "content_hash": content_hash,
                        }

                        try:
                            insert_event(event_record)
                            events_new += 1
                            logger.info(f"Added: {current_title[:50]}... on {current_date}")
                        except Exception as e:
                            logger.error(f"Failed to insert: {current_title}: {e}")
                    else:
                        events_updated += 1

            else:
                # Process structured event containers
                logger.info(f"Processing {len(event_containers)} event elements")

                for container in event_containers:
                    try:
                        text = container.inner_text().strip()

                        if len(text) < 20:
                            continue

                        # Extract title (usually first heading or strong text)
                        title_elem = container.query_selector("h2, h3, h4, strong, .title, .event-title")
                        title = title_elem.inner_text().strip() if title_elem else text.split("\n")[0]

                        if not title or len(title) < 5:
                            continue

                        # Look for date in container
                        start_date = parse_date_string(text)
                        if not start_date:
                            continue

                        # Look for time
                        start_time = parse_time(text)

                        # Extract description
                        desc_elem = container.query_selector("p, .description, .event-description")
                        description = desc_elem.inner_text().strip() if desc_elem else ""

                        # Extract image
                        image_url = None
                        img_elem = container.query_selector("img")
                        if img_elem:
                            src = img_elem.get_attribute("src")
                            if src:
                                if src.startswith("http"):
                                    image_url = src
                                elif src.startswith("//"):
                                    image_url = "https:" + src
                                elif src.startswith("/"):
                                    image_url = BASE_URL + src

                        events_found += 1

                        content_hash = generate_content_hash(
                            title, "BAPS Shri Swaminarayan Mandir", start_date
                        )

                        existing = find_event_by_hash(content_hash)
                        if existing:
                            smart_update_existing_event(existing, event_record)
                            events_updated += 1
                            continue

                        category, subcategory, tags = determine_category_and_tags(title, description)

                        event_record = {
                            "source_id": source_id,
                            "venue_id": venue_id,
                            "title": title[:200],
                            "description": description[:1000] if description else None,
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
                            "price_note": "Free admission - donations welcome",
                            "is_free": True,
                            "source_url": EVENTS_URL,
                            "ticket_url": None,
                            "image_url": image_url,
                            "raw_text": f"{title} {description}"[:500],
                            "extraction_confidence": 0.85,
                            "is_recurring": False,
                            "recurrence_rule": None,
                            "content_hash": content_hash,
                        }

                        try:
                            insert_event(event_record)
                            events_new += 1
                            logger.info(f"Added: {title[:50]}... on {start_date}")
                        except Exception as e:
                            logger.error(f"Failed to insert: {title}: {e}")

                    except Exception as e:
                        logger.warning(f"Error processing event container: {e}")
                        continue

            browser.close()

        logger.info(
            f"BAPS Mandir Atlanta crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except PlaywrightTimeout as e:
        logger.error(f"Timeout fetching BAPS Mandir: {e}")
        raise
    except Exception as e:
        logger.error(f"Failed to crawl BAPS Mandir: {e}")
        raise

    return events_found, events_new, events_updated
