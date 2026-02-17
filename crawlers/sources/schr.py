"""
Crawler for Southern Center for Human Rights (schr.org).

SCHR is a non-profit legal advocacy organization dedicated to defending the rights
of people in the criminal legal system, challenging mass incarceration, and fighting
for racial and economic justice in the Deep South since 1976.

2026 is their 50th anniversary with several signature events.

Events include:
- "Joyful Resistance" community events
- Digital security trainings for activists and advocates
- Policy forums and legislative advocacy events
- Community workshops on civil rights and legal aid
- 50th anniversary gala and celebration events
- Professional legal training and CLE courses

STRATEGY:
- Primary: Scrape main events page at /events/ with Playwright (site blocks simple requests)
- Fallback: Use Eventbrite org page if main site continues to block
- Tag appropriately: civil-rights, legal-aid, social-justice, human-rights
- Category mapping: "learning" for trainings/workshops, "community" for forums/galas/advocacy

Site notes:
- Main site returns 403 with simple requests - MUST use Playwright with realistic headers
- Eventbrite fallback: https://www.eventbrite.com/o/southern-center-for-human-rights-13836291777
"""

from __future__ import annotations

import re
import logging
from datetime import datetime
from typing import Optional

from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout
from bs4 import BeautifulSoup

from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash
from date_utils import parse_human_date

logger = logging.getLogger(__name__)

BASE_URL = "https://www.schr.org"
EVENTS_URL = f"{BASE_URL}/events/"
EVENTBRITE_URL = "https://www.eventbrite.com/o/southern-center-for-human-rights-13836291777"

VENUE_DATA = {
    "name": "Southern Center for Human Rights",
    "slug": "schr",
    "address": "60 Walton St NW",
    "neighborhood": "Downtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30303",
    "lat": 33.7565,
    "lng": -84.3930,
    "venue_type": "organization",
    "spot_type": "organization",
    "website": BASE_URL,
    # Note: vibes are for venue atmosphere/amenities, not program types
    # Tags on events will capture civil-rights, legal-aid, social-justice, etc.
}


def parse_time_string(time_str: str) -> Optional[str]:
    """
    Parse time string to 24-hour format.
    Examples: '6:00 PM', '12:30 PM', '6pm', '12:30pm', '9:00 AM - 1:00 PM'
    """
    try:
        time_str = time_str.strip().upper()

        # If it's a range, extract the first time
        if '-' in time_str or '–' in time_str:
            time_str = re.split(r'[-–]', time_str)[0].strip()

        # Pattern: H:MM AM/PM or H AM/PM or HAM/PM
        match = re.search(r'(\d{1,2})(?::(\d{2}))?\s*(AM|PM)', time_str)
        if match:
            hour = int(match.group(1))
            minute = match.group(2) or "00"
            period = match.group(3)

            if period == "PM" and hour != 12:
                hour += 12
            elif period == "AM" and hour == 12:
                hour = 0

            return f"{hour:02d}:{minute}"

    except (ValueError, AttributeError) as e:
        logger.debug(f"Could not parse time '{time_str}': {e}")

    return None


def determine_category_and_tags(title: str, description: str = "") -> tuple[str, list[str], bool]:
    """
    Determine category, tags, and is_free flag based on event content.
    Returns (category, tags, is_free).
    """
    text = f"{title} {description}".lower()
    tags = ["civil-rights", "legal-aid", "social-justice"]

    # Galas and fundraisers
    if any(word in text for word in ["gala", "fundraiser", "benefit", "celebration", "anniversary"]):
        category = "community"
        tags.extend(["fundraiser", "charity"])
        is_free = False  # Galas typically have tickets

    # Digital security and technical training
    elif any(word in text for word in ["digital security", "cybersecurity", "tech", "encryption", "privacy"]):
        category = "learning"
        tags.extend(["technology", "security", "training", "privacy"])
        is_free = True

    # Legal training and CLE courses
    elif any(word in text for word in ["cle", "continuing legal education", "attorney", "lawyer training", "legal training"]):
        category = "learning"
        tags.extend(["legal", "professional-development", "training"])
        is_free = False  # CLE often has fees

    # Policy forums and advocacy events
    elif any(word in text for word in ["policy", "forum", "panel", "discussion", "advocacy", "legislative"]):
        category = "community"
        tags.extend(["policy", "advocacy", "forum"])
        is_free = True

    # Community workshops and education
    elif any(word in text for word in ["workshop", "training", "seminar", "class", "education"]):
        category = "learning"
        tags.extend(["workshop", "education"])
        is_free = True

    # Joyful Resistance and community events
    elif any(word in text for word in ["joyful resistance", "community", "organizing", "activism"]):
        category = "community"
        tags.extend(["activism", "organizing", "community"])
        is_free = True

    # Default to community
    else:
        category = "community"
        is_free = True

    # Check for explicit free/paid mentions
    if any(word in text for word in ["free", "no cost", "no charge", "complimentary"]):
        is_free = True
        tags.append("free")
    elif any(word in text for word in ["ticket", "$", "donation required", "registration fee"]):
        is_free = False

    # Add thematic tags
    if any(word in text for word in ["mass incarceration", "prison", "criminal justice", "death penalty"]):
        tags.append("criminal-justice-reform")
    if any(word in text for word in ["racial justice", "racial equity", "racism"]):
        tags.append("racial-justice")
    if any(word in text for word in ["human rights", "constitutional", "rights"]):
        tags.append("human-rights")

    return category, list(set(tags)), is_free


def crawl_main_site(source_id: int, venue_id: int) -> tuple[int, int, int]:
    """
    Attempt to crawl main SCHR website with Playwright.
    Returns (events_found, events_new, events_updated).
    """
    events_found = 0
    events_new = 0
    events_updated = 0
    today = datetime.now().date()
    seen_events = set()

    logger.info(f"Attempting to fetch SCHR events from main site: {EVENTS_URL}")

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            viewport={"width": 1920, "height": 1080},
            extra_http_headers={
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.5",
                "Accept-Encoding": "gzip, deflate, br",
                "DNT": "1",
                "Connection": "keep-alive",
                "Upgrade-Insecure-Requests": "1",
            }
        )
        page = context.new_page()

        try:
            page.goto(EVENTS_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(5000)

            # Scroll to load any lazy-loaded content
            for _ in range(3):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1000)

            html_content = page.content()
            soup = BeautifulSoup(html_content, "html.parser")

        except Exception as e:
            logger.warning(f"Failed to load main site: {e}")
            browser.close()
            return 0, 0, 0
        finally:
            browser.close()

    # Look for The Events Calendar plugin events
    events = soup.select('.tribe-events-calendar-list__event')

    if not events or len(events) == 0:
        # Fallback to generic tribe events selector
        events = soup.select('.tribe-events-list-event')

    if not events or len(events) == 0:
        logger.info("No structured events found on main site")
        return 0, 0, 0

    logger.info(f"Found {len(events)} events on main site")

    # Parse each event
    for event_elem in events:
        try:
            # Extract title using The Events Calendar structure
            title_elem = event_elem.select_one(".tribe-events-calendar-list__event-title-link, .tribe-events-list-event-title")
            if not title_elem:
                # Fallback to generic selectors
                title_elem = event_elem.select_one("h1, h2, h3, h4, .title, .event-title")

            if not title_elem:
                logger.debug("No title element found")
                continue

            title = title_elem.get_text(strip=True)
            if not title or len(title) < 3:
                continue

            # Extract date
            date_elem = event_elem.select_one(".date, .event-date, [class*='date'], time")
            date_str = None
            if date_elem:
                date_str = date_elem.get_text(strip=True)
                datetime_attr = date_elem.get("datetime")
                if datetime_attr:
                    date_str = datetime_attr

            if not date_str:
                event_text = event_elem.get_text()
                date_match = re.search(
                    r'(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:,?\s+\d{4})?',
                    event_text,
                    re.IGNORECASE
                )
                if date_match:
                    date_str = date_match.group(0)

            if not date_str:
                logger.debug(f"No date found for: {title}")
                continue

            start_date = parse_human_date(date_str)
            if not start_date:
                logger.debug(f"Could not parse date '{date_str}' for: {title}")
                continue

            # Skip past events
            try:
                event_date = datetime.strptime(start_date, "%Y-%m-%d").date()
                if event_date < today:
                    logger.debug(f"Skipping past event: {title} on {start_date}")
                    continue
            except ValueError:
                continue

            # Dedupe
            event_key = f"{title}|{start_date}"
            if event_key in seen_events:
                continue
            seen_events.add(event_key)

            events_found += 1

            # Extract time
            time_elem = event_elem.select_one(".time, .event-time, [class*='time']")
            time_str = None
            if time_elem:
                time_str = time_elem.get_text(strip=True)
            else:
                time_match = re.search(r'\d{1,2}(?::\d{2})?\s*(?:AM|PM|am|pm)', event_elem.get_text())
                if time_match:
                    time_str = time_match.group(0)

            start_time = None
            if time_str:
                start_time = parse_time_string(time_str)

            # Extract description
            description = None
            desc_elem = event_elem.select_one(".description, .event-description, .excerpt, .summary, p")
            if desc_elem:
                description = desc_elem.get_text(strip=True)
                if len(description) > 500:
                    description = description[:497] + "..."

            # Extract image
            image_url = None
            img_elem = event_elem.select_one("img")
            if img_elem:
                image_url = img_elem.get("src")
                if image_url and not image_url.startswith("http"):
                    image_url = BASE_URL + image_url if image_url.startswith("/") else None

            # Extract event URL
            link_elem = event_elem.select_one("a[href]")
            event_url = EVENTS_URL
            if link_elem:
                href = link_elem.get("href")
                if href:
                    if href.startswith("http"):
                        event_url = href
                    elif href.startswith("/"):
                        event_url = BASE_URL + href

            # Determine category and tags
            category, tags, is_free = determine_category_and_tags(title, description or "")

            # Generate content hash
            content_hash = generate_content_hash(
                title, "Southern Center for Human Rights", start_date
            )

            # Check if already exists
            if find_event_by_hash(content_hash):
                events_updated += 1
                logger.debug(f"Event already exists: {title}")
                continue

            # Create event record
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
                "subcategory": None,
                "tags": tags,
                "price_min": None,
                "price_max": None,
                "price_note": "Free" if is_free else None,
                "is_free": is_free,
                "source_url": event_url,
                "ticket_url": None,
                "image_url": image_url,
                "raw_text": event_elem.get_text()[:500],
                "extraction_confidence": 0.80,
                "is_recurring": False,
                "recurrence_rule": None,
                "content_hash": content_hash,
            }

            try:
                insert_event(event_record)
                events_new += 1
                logger.info(f"Added: {title} on {start_date}")
            except Exception as e:
                logger.error(f"Failed to insert event '{title}': {e}")

        except Exception as e:
            logger.warning(f"Error parsing event element: {e}")
            continue

    return events_found, events_new, events_updated


def crawl_eventbrite_fallback(source_id: int, venue_id: int) -> tuple[int, int, int]:
    """
    Fallback: Crawl SCHR's Eventbrite page.
    Returns (events_found, events_new, events_updated).
    """
    events_found = 0
    events_new = 0
    events_updated = 0
    today = datetime.now().date()
    seen_events = set()

    logger.info(f"Attempting Eventbrite fallback: {EVENTBRITE_URL}")

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            viewport={"width": 1920, "height": 1080},
        )
        page = context.new_page()

        try:
            page.goto(EVENTBRITE_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(5000)

            # Scroll to load events
            for _ in range(3):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1000)

            html_content = page.content()
            soup = BeautifulSoup(html_content, "html.parser")

        except Exception as e:
            logger.error(f"Failed to load Eventbrite page: {e}")
            browser.close()
            return 0, 0, 0
        finally:
            browser.close()

    # Eventbrite selectors
    event_cards = soup.select("[data-event-id]")
    if not event_cards:
        event_cards = soup.select(".discover-search-desktop-card, .event-card-details, [class*='EventCard']")

    if not event_cards or len(event_cards) == 0:
        logger.warning("No events found on Eventbrite page")
        return 0, 0, 0

    logger.info(f"Found {len(event_cards)} events on Eventbrite")

    for card in event_cards:
        try:
            # Extract title
            title_elem = card.select_one("h2, h3, [class*='event-title'], [class*='EventTitle']")
            if not title_elem:
                continue

            title = title_elem.get_text(strip=True)
            if not title or len(title) < 3:
                continue

            # Extract URL
            link_elem = card.select_one("a[href*='eventbrite.com/e/']")
            event_url = link_elem.get("href") if link_elem else EVENTBRITE_URL

            # Extract date
            date_elem = card.select_one("time, [class*='date'], [class*='Date']")
            date_str = None
            if date_elem:
                date_str = date_elem.get("datetime") or date_elem.get_text(strip=True)

            if not date_str:
                logger.debug(f"No date found for: {title}")
                continue

            start_date = parse_human_date(date_str)
            if not start_date:
                logger.debug(f"Could not parse date '{date_str}' for: {title}")
                continue

            # Skip past events
            try:
                event_date = datetime.strptime(start_date, "%Y-%m-%d").date()
                if event_date < today:
                    logger.debug(f"Skipping past event: {title} on {start_date}")
                    continue
            except ValueError:
                continue

            # Dedupe
            event_key = f"{title}|{start_date}"
            if event_key in seen_events:
                continue
            seen_events.add(event_key)

            events_found += 1

            # Extract time
            time_str = None
            time_match = re.search(r'\d{1,2}(?::\d{2})?\s*(?:AM|PM|am|pm)', card.get_text())
            if time_match:
                time_str = time_match.group(0)

            start_time = None
            if time_str:
                start_time = parse_time_string(time_str)

            # Extract description
            description = None
            desc_elem = card.select_one("[class*='description'], [class*='summary'], p")
            if desc_elem:
                description = desc_elem.get_text(strip=True)
                if len(description) > 500:
                    description = description[:497] + "..."

            # Extract image
            image_url = None
            img_elem = card.select_one("img")
            if img_elem:
                image_url = img_elem.get("src")

            # Determine category and tags
            category, tags, is_free = determine_category_and_tags(title, description or "")

            # Generate content hash
            content_hash = generate_content_hash(
                title, "Southern Center for Human Rights", start_date
            )

            # Check if already exists
            if find_event_by_hash(content_hash):
                events_updated += 1
                logger.debug(f"Event already exists: {title}")
                continue

            # Create event record
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
                "subcategory": None,
                "tags": tags,
                "price_min": None,
                "price_max": None,
                "price_note": "Free" if is_free else None,
                "is_free": is_free,
                "source_url": event_url,
                "ticket_url": event_url,
                "image_url": image_url,
                "raw_text": card.get_text()[:500],
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
                logger.error(f"Failed to insert event '{title}': {e}")

        except Exception as e:
            logger.warning(f"Error parsing event card: {e}")
            continue

    return events_found, events_new, events_updated


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl SCHR events using Playwright.

    Tries main site first, falls back to Eventbrite if main site blocks or has no events.
    """
    source_id = source["id"]

    try:
        # Create venue record
        venue_id = get_or_create_venue(VENUE_DATA)

        # Try main site first
        events_found, events_new, events_updated = crawl_main_site(source_id, venue_id)

        # If main site failed or had no events, try Eventbrite fallback
        if events_found == 0:
            logger.info("Main site returned no events, trying Eventbrite fallback")
            events_found, events_new, events_updated = crawl_eventbrite_fallback(source_id, venue_id)

        logger.info(
            f"SCHR crawl complete: {events_found} found, "
            f"{events_new} new, {events_updated} updated"
        )

    except PlaywrightTimeout as e:
        logger.error(f"Timeout fetching SCHR events: {e}")
        raise
    except Exception as e:
        logger.error(f"Failed to crawl SCHR: {e}")
        raise

    return events_found, events_new, events_updated
