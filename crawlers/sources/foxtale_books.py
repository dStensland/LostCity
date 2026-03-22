"""
Crawler for FoxTale Book Shoppe (foxtalebookshoppe.com/events).
An independent bookstore in Woodstock with book clubs and author events.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime
from typing import Optional

import requests
from bs4 import BeautifulSoup

from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash
from utils import find_event_url

logger = logging.getLogger(__name__)

BASE_URL = "https://foxtalebookshoppe.com"
EVENTS_URL = f"{BASE_URL}/events"

VENUE_DATA = {
    "name": "FoxTale Book Shoppe",
    "slug": "foxtale-book-shoppe",
    "address": "105 E Main St",
    "neighborhood": "Woodstock",
    "city": "Woodstock",
    "state": "GA",
    "zip": "30188",
    "venue_type": "bookstore",
    "website": BASE_URL,
}


def parse_date(date_str: str) -> Optional[str]:
    """Parse date from format like 'Thu, 1/8/2026'."""
    date_str = date_str.strip()

    # Remove day of week prefix
    date_str = re.sub(r"^[A-Za-z]+,\s*", "", date_str)

    for fmt in ["%m/%d/%Y", "%m/%d/%y", "%B %d, %Y", "%b %d, %Y"]:
        try:
            dt = datetime.strptime(date_str, fmt)
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            continue
    return None


def parse_time(time_str: str) -> Optional[str]:
    """Parse time from format like '11:00am'."""
    try:
        match = re.search(r"(\d{1,2}):(\d{2})\s*(am|pm)", time_str, re.IGNORECASE)
        if match:
            hour, minute, period = match.groups()
            hour = int(hour)
            if period.lower() == "pm" and hour != 12:
                hour += 12
            elif period.lower() == "am" and hour == 12:
                hour = 0
            return f"{hour:02d}:{minute}"
    except Exception:
        pass
    return None


def _extract_images_from_soup(soup: BeautifulSoup) -> dict[str, str]:
    image_map: dict[str, str] = {}
    for img in soup.find_all("img"):
        alt = img.get("alt") or img.get("title") or ""
        src = img.get("src") or img.get("data-src") or ""
        if alt and src and len(alt) > 3 and not any(x in src.lower() for x in ["logo", "icon", "sprite"]):
            image_map[alt.strip()] = src
    return image_map


def _extract_event_links_from_soup(soup: BeautifulSoup, base_url: str) -> dict[str, str]:
    skip_words = ["view more", "learn more", "read more", "see all", "donate", "subscribe",
                  "sign up", "log in", "register", "contact", "about", "home", "menu", "search"]
    event_links: dict[str, str] = {}
    for a in soup.find_all("a", href=True):
        href = a.get("href", "")
        text = a.get_text(strip=True)
        if not href or not text or len(text) < 3:
            continue
        if href.startswith("#") or href.startswith("javascript:"):
            continue
        text_lower = text.lower()
        if any(skip in text_lower for skip in skip_words):
            continue
        if not href.startswith("http"):
            href = base_url.rstrip("/") + href if href.startswith("/") else base_url.rstrip("/") + "/" + href
        event_links[text_lower] = href
    return event_links


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl FoxTale Book Shoppe events using requests + BeautifulSoup."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        logger.info(f"Fetching FoxTale Book Shoppe: {EVENTS_URL}")
        response = requests.get(
            EVENTS_URL,
            headers={"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"},
            timeout=30,
        )
        response.raise_for_status()
        soup = BeautifulSoup(response.text, "html.parser")

        # Extract images from page
        image_map = _extract_images_from_soup(soup)

        # Extract event links for specific URLs
        event_links = _extract_event_links_from_soup(soup, BASE_URL)

        venue_id = get_or_create_venue(VENUE_DATA)

        # Get page text
        text = soup.get_text(separator="\n")

        # Split by month+day pattern to get event blocks
        blocks = re.split(
            r"(?=JAN\s+\d|FEB\s+\d|MAR\s+\d|APR\s+\d|MAY\s+\d|JUN\s+\d|JUL\s+\d|AUG\s+\d|SEP\s+\d|OCT\s+\d|NOV\s+\d|DEC\s+\d)",
            text,
        )

        for block in blocks:
            try:
                # Skip navigation blocks
                if "SUB-NAVIGATION" in block or "Events Calendar" in block:
                    continue

                # Extract date from DATE: line
                date_match = re.search(
                    r"DATE:\s*\n?\s*([A-Za-z]+,?\s*\d{1,2}/\d{1,2}/\d{2,4})", block
                )
                if not date_match:
                    continue

                start_date = parse_date(date_match.group(1))
                if not start_date:
                    continue

                # Extract time from TIME: line
                time_match = re.search(
                    r"TIME:\s*\n?\s*(\d{1,2}:\d{2}\s*(am|pm))", block, re.I
                )
                start_time = parse_time(time_match.group(1)) if time_match else None

                # Extract title - it's right after the month/day at start of block
                lines = [l.strip() for l in block.split("\n") if l.strip()]

                title = None
                description = None

                for i, line in enumerate(lines):
                    # Skip month abbreviations and day numbers
                    if re.match(
                        r"^(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)$", line
                    ):
                        continue
                    if re.match(r"^\d{1,2}$", line):
                        continue
                    # Skip navigation/metadata
                    if any(
                        skip in line
                        for skip in [
                            "DATE:",
                            "TIME:",
                            "PLACE:",
                            "VIEW EVENT",
                            "ABOUT",
                            "RSVP",
                        ]
                    ):
                        break
                    # Skip address lines
                    if re.match(r"^\d+\s+(E\.|W\.|Main|Oak)", line, re.I):
                        continue
                    if re.match(r"^(Woodstock|Atlanta),?\s*GA", line, re.I):
                        continue
                    if "FoxTale Book Shoppe" in line:
                        continue
                    if "Deep Roots" in line:
                        continue
                    # Title is the first substantial line
                    if not title and len(line) > 10:
                        title = line
                        continue
                    # Description is the next substantial line after title
                    if title and not description and len(line) > 20:
                        description = line[:500]
                        break

                if not title:
                    continue

                # Clean up title
                title = re.sub(r"\s+", " ", title).strip()
                if len(title) < 5:
                    continue

                events_found += 1

                content_hash = generate_content_hash(
                    title, VENUE_DATA["name"], start_date
                )

                # Determine subcategory
                title_lower = title.lower()
                if "book club" in title_lower:
                    subcategory = "words.bookclub"
                elif "writing" in title_lower or "workshop" in title_lower:
                    subcategory = "words.workshop"
                elif "storytime" in title_lower:
                    subcategory = "words.storytelling"
                else:
                    subcategory = "words.reading"

                event_url = find_event_url(title, event_links, EVENTS_URL)

                event_record = {
                    "source_id": source_id,
                    "venue_id": venue_id,
                    "title": title.title() if title.isupper() else title,
                    "description": description,
                    "start_date": start_date,
                    "start_time": start_time,
                    "end_date": None,
                    "end_time": None,
                    "is_all_day": False,
                    "category": "words",
                    "subcategory": subcategory,
                    "tags": ["books", "author", "reading", "woodstock"],
                    "price_min": None,
                    "price_max": None,
                    "price_note": None,
                    "is_free": True,
                    "source_url": event_url,
                    "ticket_url": event_url if event_url != EVENTS_URL else None,
                    "image_url": image_map.get(title),
                    "raw_text": None,
                    "extraction_confidence": 0.85,
                    "is_recurring": False,
                    "recurrence_rule": None,
                    "content_hash": content_hash,
                }

                existing = find_event_by_hash(content_hash)
                if existing:
                    smart_update_existing_event(existing, event_record)
                    events_updated += 1
                    continue

                insert_event(event_record)
                events_new += 1
                logger.info(f"Added: {title} on {start_date}")

            except Exception as e:
                logger.debug(f"Error processing event block: {e}")
                continue

        logger.info(
            f"FoxTale Book Shoppe crawl complete: {events_found} found, {events_new} new"
        )

    except Exception as e:
        logger.error(f"Failed to crawl FoxTale Book Shoppe: {e}")
        raise

    return events_found, events_new, events_updated
