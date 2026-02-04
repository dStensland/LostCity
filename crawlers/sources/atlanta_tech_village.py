"""
Crawler for Atlanta Tech Village (atlantatechvillage.com).

Site uses JavaScript rendering (Webflow) - must use Playwright.
Listing page has event cards with title, date, and truncated description.
Detail pages have structured start time, end time, full description, and RSVP links.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime
from typing import Optional

from playwright.sync_api import sync_playwright

from db import get_or_create_venue, insert_event, find_event_by_hash
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://www.atlantatechvillage.com"
EVENTS_URL = f"{BASE_URL}/events/upcoming"

VENUE_DATA = {
    "name": "Atlanta Tech Village",
    "slug": "atlanta-tech-village",
    "address": "3423 Piedmont Rd NE",
    "neighborhood": "Buckhead",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30305",
    "lat": 33.8508,
    "lng": -84.3669,
    "venue_type": "coworking",
    "spot_type": "coworking",
    "website": BASE_URL,
}


def parse_time(text: str) -> Optional[str]:
    """Parse time from text like '1:30 PM' or '7:00 pm'. Returns HH:MM 24h format."""
    match = re.search(r"(\d{1,2}):(\d{2})\s*(am|pm)", text, re.IGNORECASE)
    if match:
        hour, minute, period = int(match.group(1)), match.group(2), match.group(3).lower()
        if period == "pm" and hour != 12:
            hour += 12
        elif period == "am" and hour == 12:
            hour = 0
        return f"{hour:02d}:{minute}"
    return None


def parse_date(date_text: str) -> Optional[str]:
    """Parse date from text like 'Monday, February 3, 2026' or 'February 3, 2026'. Returns YYYY-MM-DD."""
    # Strip day-of-week prefix if present
    cleaned = re.sub(r"^(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s*", "", date_text.strip(), flags=re.IGNORECASE)
    for fmt in ("%B %d, %Y", "%B %d %Y", "%b %d, %Y", "%b %d %Y"):
        try:
            dt = datetime.strptime(cleaned, fmt)
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            continue
    return None


def scrape_detail_page(page, url: str) -> dict:
    """Visit an event detail page and extract start_time, end_time, description, ticket_url, image_url."""
    result = {"start_time": None, "end_time": None, "description": None, "ticket_url": None, "image_url": None}
    try:
        page.goto(url, wait_until="domcontentloaded", timeout=15000)
        page.wait_for_timeout(1500)

        # Start date+time: div.jobs-duration.events-page (e.g. "February 3, 2026 1:30 PM")
        duration_el = page.query_selector("div.jobs-duration.events-page")
        if duration_el:
            duration_text = duration_el.inner_text().strip()
            result["start_time"] = parse_time(duration_text)

        # End time: div.jobs-location.events-page (e.g. "2:30 pm")
        end_el = page.query_selector("div.jobs-location.events-page")
        if end_el:
            end_text = end_el.inner_text().strip()
            result["end_time"] = parse_time(end_text)

        # Full description from rich text area
        desc_el = page.query_selector("div.job-description-rich-text")
        if desc_el:
            desc_text = desc_el.inner_text().strip()
            # Clean up: remove address lines that sometimes appear, limit length
            if desc_text:
                result["description"] = desc_text[:1000]

        # RSVP / ticket link (usually eventbrite)
        rsvp_links = page.query_selector_all("a")
        for link in rsvp_links:
            link_text = link.inner_text().strip().lower()
            if "rsvp" in link_text or "register" in link_text or "ticket" in link_text:
                href = link.get_attribute("href")
                if href and href.startswith("http"):
                    result["ticket_url"] = href
                    break

        # Event image (skip logo/nav images)
        images = page.query_selector_all("img")
        for img in images:
            src = img.get_attribute("src") or ""
            if "logo" in src.lower() or "atv-logo" in src.lower():
                continue
            # Look for event-specific images (usually from evbuc or uploads)
            if "website-files" in src and "logo" not in src.lower():
                result["image_url"] = src
                break

    except Exception as e:
        logger.warning(f"Failed to scrape detail page {url}: {e}")

    return result


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Atlanta Tech Village events using Playwright with proper DOM selectors."""
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

            logger.info(f"Fetching Atlanta Tech Village: {EVENTS_URL}")
            page.goto(EVENTS_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(3000)

            # Scroll to load all content
            for _ in range(5):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1000)

            # Extract events using proper DOM selectors
            event_cards = page.query_selector_all(".event-display-item")
            logger.info(f"Found {len(event_cards)} event cards on listing page")

            listing_events = []
            for card in event_cards:
                # Title from h3
                title_el = card.query_selector("h3")
                if not title_el:
                    continue
                title = title_el.inner_text().strip()
                # Normalize title case (page shows UPPERCASE)
                title = title.title()

                # Date from .blog-display-publish-date
                date_el = card.query_selector(".blog-display-publish-date")
                if not date_el:
                    continue
                date_text = date_el.inner_text().strip()
                start_date = parse_date(date_text)
                if not start_date:
                    continue

                # Skip past events
                try:
                    if datetime.strptime(start_date, "%Y-%m-%d").date() < datetime.now().date():
                        continue
                except ValueError:
                    continue

                # Detail page URL
                link_el = card.query_selector("a")
                detail_url = link_el.get_attribute("href") if link_el else None
                if detail_url and not detail_url.startswith("http"):
                    detail_url = BASE_URL + detail_url

                # Description snippet from listing (fallback if detail page fails)
                desc_el = card.query_selector("p")
                desc_snippet = desc_el.inner_text().strip() if desc_el else None

                listing_events.append({
                    "title": title,
                    "start_date": start_date,
                    "detail_url": detail_url,
                    "desc_snippet": desc_snippet,
                })

            # Now visit detail pages for each event to get times and full descriptions
            for evt in listing_events:
                events_found += 1
                title = evt["title"]
                start_date = evt["start_date"]

                content_hash = generate_content_hash(title, "Atlanta Tech Village", start_date)

                if find_event_by_hash(content_hash):
                    events_updated += 1
                    continue

                # Scrape detail page for times, description, ticket URL
                detail = {}
                if evt["detail_url"]:
                    detail = scrape_detail_page(page, evt["detail_url"])

                description = detail.get("description") or evt.get("desc_snippet") or "Event at Atlanta Tech Village"
                start_time = detail.get("start_time")
                end_time = detail.get("end_time")

                # If no time from detail page, try extracting from description
                if not start_time and description:
                    start_time = parse_time(description)

                is_free = False
                if description:
                    lower_desc = description.lower()
                    if "free" in lower_desc and "free-form" not in lower_desc:
                        is_free = True

                event_record = {
                    "source_id": source_id,
                    "venue_id": venue_id,
                    "title": title,
                    "description": description,
                    "start_date": start_date,
                    "start_time": start_time,
                    "end_date": None,
                    "end_time": end_time,
                    "is_all_day": start_time is None,
                    "category": "community",
                    "subcategory": None,
                    "tags": ["atlanta-tech-village", "tech", "startup", "networking"],
                    "price_min": None,
                    "price_max": None,
                    "price_note": "Free" if is_free else None,
                    "is_free": is_free,
                    "source_url": evt["detail_url"] or EVENTS_URL,
                    "ticket_url": detail.get("ticket_url") or evt["detail_url"] or EVENTS_URL,
                    "image_url": detail.get("image_url"),
                    "raw_text": f"{title} - {start_date}",
                    "extraction_confidence": 0.95,
                    "is_recurring": False,
                    "recurrence_rule": None,
                    "content_hash": content_hash,
                }

                try:
                    insert_event(event_record)
                    events_new += 1
                    logger.info(f"Added: {title} on {start_date} at {start_time or 'all day'}")
                except Exception as e:
                    logger.error(f"Failed to insert: {title}: {e}")

            browser.close()

        logger.info(
            f"Atlanta Tech Village crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Atlanta Tech Village: {e}")
        raise

    return events_found, events_new, events_updated
