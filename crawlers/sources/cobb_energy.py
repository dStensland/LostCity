"""
Crawler for Cobb Energy Performing Arts Centre (cobbenergycentre.com).

Visits detail pages to extract rich event data including descriptions,
multiple showtimes, images, and ticket URLs.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime
from typing import Optional

from playwright.sync_api import sync_playwright, Page

from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash
from utils import enrich_event_record

logger = logging.getLogger(__name__)

BASE_URL = "https://www.cobbenergycentre.com"
EVENTS_URL = f"{BASE_URL}/events"

VENUE_DATA = {
    "name": "Cobb Energy Performing Arts Centre",
    "slug": "cobb-energy-centre",
    "address": "2800 Cobb Galleria Pkwy",
    "neighborhood": "Cumberland",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30339",
    "lat": 33.8836,
    "lng": -84.4669,
    "venue_type": "theater",
    "spot_type": "theater",
    "website": BASE_URL,
}


def parse_date_time(date_str: str, time_str: str) -> tuple[Optional[str], Optional[str]]:
    """
    Parse date and time from detail page formats.

    Date examples: "March 15, 2026", "Mar 15, 2026", "March 15"
    Time examples: "7:30 PM", "7:30PM", "2:00 p.m."

    Returns (YYYY-MM-DD, HH:MM)
    """
    if not date_str:
        return None, None

    # Parse date
    current_year = datetime.now().year
    start_date = None

    # Try "March 15, 2026" or "Mar 15, 2026"
    match = re.search(r"(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[.,]?\s+(\d{1,2})[.,]?\s*(\d{4})?", date_str, re.IGNORECASE)
    if match:
        month, day, year = match.groups()
        year = year or str(current_year)
        for fmt in ["%B %d %Y", "%b %d %Y"]:
            try:
                dt = datetime.strptime(f"{month} {day} {year}", fmt)
                # If date is in the past, try next year
                if dt.date() < datetime.now().date():
                    dt = datetime.strptime(f"{month} {day} {int(year) + 1}", fmt)
                start_date = dt.strftime("%Y-%m-%d")
                break
            except ValueError:
                continue

    # Parse time if present
    start_time = None
    if time_str:
        match = re.search(r"(\d{1,2}):(\d{2})\s*(am|pm|a\.m\.|p\.m\.)", time_str, re.IGNORECASE)
        if match:
            hour, minute, period = match.groups()
            hour = int(hour)
            if "p" in period.lower() and hour != 12:
                hour += 12
            elif "a" in period.lower() and hour == 12:
                hour = 0
            start_time = f"{hour:02d}:{minute}"

    return start_date, start_time


def extract_detail_data(page: Page, detail_url: str) -> list[dict]:
    """
    Extract event data from a detail page.

    Returns a list of event dicts (one per showtime if multiple dates).
    """
    try:
        logger.info(f"Fetching detail page: {detail_url}")
        page.goto(detail_url, wait_until="domcontentloaded", timeout=30000)
        page.wait_for_timeout(2000)

        # Extract title
        title = None
        title_selectors = ["h1", ".event-title", ".title", "h2"]
        for selector in title_selectors:
            try:
                elem = page.query_selector(selector)
                if elem:
                    text = elem.inner_text().strip()
                    if text and len(text) > 2 and text.lower() not in ["events", "home", "calendar"]:
                        title = text
                        break
            except:
                continue

        if not title:
            logger.warning(f"Could not extract title from {detail_url}")
            return []

        # Extract description — skip boilerplate paragraphs
        description = None
        boilerplate = [
            "tickets are available",
            "the synovus box office",
            "group information",
            "plan your visit",
            "bag policy",
            "prohibited items",
            "parking",
            "2800 cobb galleria",
        ]
        desc_selectors = [
            ".event-description",
            ".description",
            "div.content p",
            "article p",
            ".event-details p",
            "p"
        ]
        for selector in desc_selectors:
            try:
                elems = page.query_selector_all(selector)
                for elem in elems:
                    text = elem.inner_text().strip()
                    if text and len(text) > 50:
                        text_lower = text.lower()
                        if any(bp in text_lower for bp in boilerplate):
                            continue
                        description = text
                        break
                if description:
                    break
            except:
                continue

        # Extract presenter/presenting org
        presenter = None
        body_text = page.inner_text("body")
        presenter_match = re.search(r"(?:Presented by|Presenting Organization:|Presenter:)\s*([^\n]+)", body_text, re.IGNORECASE)
        if presenter_match:
            presenter = presenter_match.group(1).strip()

        # Add presenter to description if found
        if presenter and description:
            description = f"Presented by {presenter}. {description}"
        elif presenter:
            description = f"Presented by {presenter}."

        # Extract image
        image_url = None
        image_selectors = [
            "img[src*='1250x610']",
            "img[src*='assets/img']",
            ".event-image img",
            "article img",
            "img[class*='event']",
            "img"
        ]
        for selector in image_selectors:
            try:
                elem = page.query_selector(selector)
                if elem:
                    src = elem.get_attribute("src")
                    if src and ("assets/img" in src or "1250x610" in src or len(src) > 20):
                        if not src.startswith("http"):
                            if src.startswith("/"):
                                image_url = BASE_URL + src
                            else:
                                image_url = BASE_URL + "/" + src
                        else:
                            image_url = src
                        break
            except:
                continue

        # Extract ticket URL
        ticket_url = None
        try:
            ticket_links = page.query_selector_all("a[href*='ticketmaster'], a[href*='ticket'], a:has-text('Buy Tickets'), a:has-text('Tickets')")
            for link in ticket_links:
                href = link.get_attribute("href")
                if href and ("ticketmaster" in href.lower() or "ticket" in href.lower()):
                    if not href.startswith("http"):
                        if href.startswith("/"):
                            ticket_url = BASE_URL + href
                        else:
                            ticket_url = BASE_URL + "/" + href
                    else:
                        ticket_url = href
                    break
        except:
            pass

        # Extract showtimes (dates and times)
        # Cobb Energy site format: "FridayFeb. 13 / 2026\n8:00 PM"
        # Also: "Thursday Feb. 19 / 2026\n7:30 PM" (space after day-of-week)
        # Also: "TuesdayJuly 21 / 2026\n7:00 PM" (full month name)
        showtimes = []

        MONTH_PAT = r"(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)"

        # Pattern: "DayOfWeek[space]Month[.] DD / YYYY" followed by time on next line
        showtime_pattern = re.compile(
            r"(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\s*"
            rf"({MONTH_PAT})\.?\s+(\d{{1,2}})\s*/\s*(\d{{4}})"
            r"\s*\n\s*(\d{1,2}:\d{2}\s*(?:AM|PM))",
            re.IGNORECASE,
        )
        for m in showtime_pattern.finditer(body_text):
            month_str, day_str, year_str, time_str = m.groups()
            date_str = f"{month_str} {day_str}, {year_str}"
            start_date, start_time = parse_date_time(date_str, time_str)
            if start_date:
                showtimes.append({"date": start_date, "time": start_time})

        # Fallback: date range header like "Feb. 13 - 15 / 2026"
        if not showtimes:
            range_match = re.search(
                rf"({MONTH_PAT})\.?\s+(\d{{1,2}})\s*-\s*(\d{{1,2}})\s*/\s*(\d{{4}})",
                body_text, re.IGNORECASE,
            )
            if range_match:
                month_str, start_day, end_day, year_str = range_match.groups()
                for day in range(int(start_day), int(end_day) + 1):
                    date_str = f"{month_str} {day}, {year_str}"
                    start_date, _ = parse_date_time(date_str, "")
                    if start_date:
                        showtimes.append({"date": start_date, "time": None})

        # Fallback: single date like "Mar. 14 / 2026" or "July 21 / 2026"
        if not showtimes:
            single_match = re.search(
                rf"({MONTH_PAT})\.?\s+(\d{{1,2}})\s*/\s*(\d{{4}})",
                body_text, re.IGNORECASE,
            )
            if single_match:
                month_str, day_str, year_str = single_match.groups()
                date_str = f"{month_str} {day_str}, {year_str}"
                start_date, _ = parse_date_time(date_str, "")
                if start_date:
                    showtimes.append({"date": start_date, "time": None})

        if not showtimes:
            logger.warning(f"No showtimes found for {title} at {detail_url}")
            return []

        # Determine category based on presenter/content
        category = "theater"  # Default for performing arts center
        if presenter:
            presenter_lower = presenter.lower()
            if "ballet" in presenter_lower:
                category = "theater"
            elif "opera" in presenter_lower:
                category = "theater"
            elif "comedy" in presenter_lower or "comedian" in title.lower():
                category = "comedy"
            elif any(word in presenter_lower for word in ["orchestra", "symphony", "jazz", "blues", "music"]):
                category = "music"

        # Also check title
        title_lower = title.lower()
        if any(word in title_lower for word in ["comedy", "comedian", "stand-up"]):
            category = "comedy"
        elif any(word in title_lower for word in ["concert", "symphony", "orchestra", "jazz", "blues"]):
            category = "music"

        # Create one event per showtime
        events = []
        for showtime in showtimes:
            event_data = {
                "title": title,
                "description": description,
                "start_date": showtime["date"],
                "start_time": showtime["time"],
                "category": category,
                "image_url": image_url,
                "ticket_url": ticket_url or detail_url,
                "source_url": detail_url,
            }
            events.append(event_data)

        return events

    except Exception as e:
        logger.error(f"Error extracting detail from {detail_url}: {e}")
        return []


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Cobb Energy Performing Arts Centre events using Playwright."""
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

            logger.info(f"Fetching Cobb Energy events listing: {EVENTS_URL}")
            page.goto(EVENTS_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(3000)

            # Scroll to load all events
            for _ in range(3):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1000)

            # Extract event detail page links
            detail_links = []
            try:
                links = page.query_selector_all("a[href*='/events/detail/']")
                for link in links:
                    href = link.get_attribute("href")
                    if href:
                        if not href.startswith("http"):
                            href = BASE_URL + (href if href.startswith("/") else "/" + href)
                        if href not in detail_links:
                            detail_links.append(href)
            except Exception as e:
                logger.error(f"Error extracting event links: {e}")

            logger.info(f"Found {len(detail_links)} event detail pages")

            # Visit each detail page
            detail_page = context.new_page()
            for detail_url in detail_links[:50]:  # Limit to 50 events to avoid long crawls
                event_data_list = extract_detail_data(detail_page, detail_url)

                for event_data in event_data_list:
                    events_found += 1

                    title = event_data["title"]
                    start_date = event_data["start_date"]

                    content_hash = generate_content_hash(title, "Cobb Energy Performing Arts Centre", start_date)


                    event_record = {
                        "source_id": source_id,
                        "venue_id": venue_id,
                        "title": title,
                        "description": event_data.get("description"),
                        "start_date": start_date,
                        "start_time": event_data.get("start_time"),
                        "end_date": None,
                        "end_time": None,
                        "is_all_day": False,
                        "category": event_data.get("category", "theater"),
                        "subcategory": None,
                        "tags": ["performing-arts"],
                        "price_min": None,
                        "price_max": None,
                        "price_note": None,
                        "is_free": None,
                        "source_url": event_data.get("source_url"),
                        "ticket_url": event_data.get("ticket_url"),
                        "image_url": event_data.get("image_url"),
                        "raw_text": None,
                        "extraction_confidence": 0.85,
                        "is_recurring": False,
                        "recurrence_rule": None,
                        "content_hash": content_hash,
                    }

                    # Enrich from detail page
                    enrich_event_record(event_record, source_name="Cobb Energy Performing Arts Centre")

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

                    try:
                        insert_event(event_record)
                        events_new += 1
                        logger.info(f"Added: {title} on {start_date}")
                    except Exception as e:
                        logger.error(f"Failed to insert: {title}: {e}")

                # Rate limiting
                page.wait_for_timeout(500)

            detail_page.close()
            browser.close()

        logger.info(
            f"Cobb Energy crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Cobb Energy Performing Arts Centre: {e}")
        raise

    return events_found, events_new, events_updated
