"""
Crawler for Donate Life Georgia (donatelifegeorgia.org).

Donate Life Georgia is the official organ, eye, and tissue donor registry
for the state of Georgia, promoting organ donation awareness and education.

Key programs:
- Team Georgia Transplant Games (athletes who received transplants)
- Donor awareness events and campaigns
- Registration drives at DMVs, colleges, and community events
- Educational presentations in schools and communities
- Donor family support programs
- National Donate Life Month activities (April)

Located in Norcross, serving all of Georgia.

STRATEGY:
- Scrape events page for Transplant Games, awareness campaigns, registration drives
- Tag: organ-donation, transplant, awareness, athletics
- Most events are free educational/awareness programs
- Category: "fitness" for Transplant Games, "community" for awareness events
"""

from __future__ import annotations

import re
import logging
from typing import Optional

import requests
from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout

from db import get_or_create_venue, insert_event, find_event_by_hash
from dedupe import generate_content_hash
from date_utils import parse_human_date

logger = logging.getLogger(__name__)

BASE_URL = "https://www.donatelifegeorgia.org"
EVENTS_URL = f"{BASE_URL}/events"

VENUE_DATA = {
    "name": "Donate Life Georgia",
    "slug": "donate-life-georgia",
    "address": "2875 Northwoods Pkwy",
    "neighborhood": "Norcross",
    "city": "Norcross",
    "state": "GA",
    "zip": "30071",
    "lat": 33.9360,
    "lng": -84.1960,
    "venue_type": "organization",
    "spot_type": "organization",
    "website": BASE_URL,
    "vibes": ["organ-donation", "transplant", "awareness"],
}


def parse_time_string(time_str: str) -> Optional[str]:
    """Parse time string to 24-hour format."""
    try:
        time_str = time_str.strip().upper()
        time_str = re.sub(r'\s+(ET|EST|EDT)$', '', time_str)

        if '-' in time_str or '–' in time_str:
            time_str = re.split(r'[-–]', time_str)[0].strip()

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
    """Determine category, tags, and is_free flag."""
    text = f"{title} {description}".lower()
    tags = ["organ-donation", "awareness"]

    # Transplant Games
    if "transplant games" in text or "team georgia" in text:
        category = "fitness"
        tags.extend(["athletics", "transplant", "inspiring"])
        is_free = True  # Free to watch/attend

    # Registration drives
    elif any(word in text for word in ["registration drive", "sign up", "dmv", "registry"]):
        category = "community"
        tags.extend(["registration", "activism", "free"])
        is_free = True

    # Educational presentations
    elif any(word in text for word in ["presentation", "workshop", "education", "training", "class"]):
        category = "learning"
        tags.extend(["education", "awareness", "free"])
        is_free = True

    # Donor awareness campaigns
    elif any(word in text for word in ["donate life month", "blue green day", "awareness", "campaign"]):
        category = "community"
        tags.extend(["awareness", "activism", "free"])
        is_free = True

    # Donor family events
    elif "donor family" in text or "family support" in text or "memorial" in text:
        category = "community"
        tags.extend(["support", "remembrance", "free"])
        is_free = True

    # Fundraising galas
    elif "gala" in text or "benefit" in text or "fundraiser" in text:
        category = "community"
        tags.append("fundraiser")
        is_free = False

    # Default
    else:
        category = "community"
        is_free = True

    # Explicit free mentions
    if any(word in text for word in ["free", "no cost", "complimentary"]):
        is_free = True
        tags.append("free")

    return category, list(set(tags)), is_free


def try_simple_requests(url: str) -> Optional[BeautifulSoup]:
    """Try fetching with requests first."""
    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
        }
        response = requests.get(url, headers=headers, timeout=20)
        response.raise_for_status()

        soup = BeautifulSoup(response.text, "html.parser")

        if soup.find(string=re.compile(r'event|transplant|donate', re.I)):
            return soup

        return None
    except Exception as e:
        logger.debug(f"Simple request failed: {e}")
        return None


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Donate Life Georgia events."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        venue_id = get_or_create_venue(VENUE_DATA)

        logger.info(f"Fetching Donate Life Georgia events: {EVENTS_URL}")
        soup = try_simple_requests(EVENTS_URL)

        if not soup:
            logger.info("Using Playwright for JavaScript rendering")
            with sync_playwright() as p:
                browser = p.chromium.launch(headless=True)
                context = browser.new_context(
                    user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
                    viewport={"width": 1920, "height": 1080},
                )
                page = context.new_page()
                page.goto(EVENTS_URL, wait_until="domcontentloaded", timeout=30000)
                page.wait_for_timeout(3000)

                for _ in range(3):
                    page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                    page.wait_for_timeout(1000)

                html_content = page.content()
                soup = BeautifulSoup(html_content, "html.parser")
                browser.close()

        event_selectors = [
            ".event-item",
            ".event-card",
            ".event",
            "[class*='event']",
            ".calendar-event",
            "article",
        ]

        events = None
        for selector in event_selectors:
            events = soup.select(selector)
            if events and len(events) > 0:
                logger.info(f"Found {len(events)} events using selector: {selector}")
                break

        if not events or len(events) == 0:
            logger.info("No structured events found")
            return 0, 0, 0

        for event_elem in events:
            try:
                title_elem = event_elem.select_one("h1, h2, h3, h4, .title, .event-title, [class*='title']")
                if title_elem:
                    title = title_elem.get_text(strip=True)
                else:
                    event_text = event_elem.get_text(strip=True)
                    lines = [l.strip() for l in event_text.split("\n") if l.strip()]
                    title = lines[0] if lines else None

                if not title or len(title) < 3:
                    continue

                date_elem = event_elem.select_one(".date, .event-date, [class*='date'], time")
                date_str = None
                if date_elem:
                    date_str = date_elem.get_text(strip=True)
                    datetime_attr = date_elem.get("datetime") if hasattr(date_elem, 'get') else None
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

                events_found += 1

                time_elem = event_elem.select_one(".time, .event-time, [class*='time']")
                time_str = None
                if time_elem:
                    time_str = time_elem.get_text(strip=True)
                else:
                    time_match = re.search(r'\d{1,2}(?::\d{2})?\s*(?:AM|PM|am|pm)', event_elem.get_text())
                    if time_match:
                        time_str = time_match.group(0)

                start_time = parse_time_string(time_str) if time_str else None

                description = None
                desc_elem = event_elem.select_one(".description, .event-description, .excerpt, .summary, p")
                if desc_elem:
                    description = desc_elem.get_text(strip=True)
                    if len(description) > 500:
                        description = description[:497] + "..."

                image_url = None
                img_elem = event_elem.select_one("img")
                if img_elem:
                    image_url = img_elem.get("src")
                    if image_url and not image_url.startswith("http"):
                        image_url = BASE_URL + image_url if image_url.startswith("/") else None

                link_elem = event_elem.select_one("a[href]")
                event_url = EVENTS_URL
                if link_elem:
                    href = link_elem.get("href")
                    if href:
                        if href.startswith("http"):
                            event_url = href
                        elif href.startswith("/"):
                            event_url = BASE_URL + href

                category, tags, is_free = determine_category_and_tags(title, description or "")

                content_hash = generate_content_hash(title, "Donate Life Georgia", start_date)

                if find_event_by_hash(content_hash):
                    events_updated += 1
                    continue

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
                    "price_note": None,
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

        logger.info(
            f"Donate Life Georgia crawl complete: {events_found} found, "
            f"{events_new} new, {events_updated} updated"
        )

    except PlaywrightTimeout as e:
        logger.error(f"Timeout fetching Donate Life Georgia: {e}")
        raise
    except Exception as e:
        logger.error(f"Failed to crawl Donate Life Georgia: {e}")
        raise

    return events_found, events_new, events_updated
