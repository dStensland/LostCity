"""
Crawler for Alliance Theatre (alliancetheatre.org/season).
Atlanta's flagship theater company at Woodruff Arts Center.
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

BASE_URL = "https://www.alliancetheatre.org"
SEASON_URL = f"{BASE_URL}/season/"

VENUE_DATA = {
    "name": "Alliance Theatre",
    "slug": "alliance-theatre",
    "address": "1280 Peachtree St NE",
    "neighborhood": "Midtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30309",
    "venue_type": "theater",
    "website": BASE_URL,
}


def parse_date_range(date_text: str) -> tuple[Optional[str], Optional[str]]:
    """Parse date range from 'JAN 31 – JUN 27' or similar format."""
    date_text = date_text.strip().upper()

    # Month abbreviation mapping
    months = {
        "JAN": 1, "FEB": 2, "MAR": 3, "APR": 4, "MAY": 5, "JUN": 6,
        "JUL": 7, "AUG": 8, "SEP": 9, "OCT": 10, "NOV": 11, "DEC": 12
    }

    # Try "MON DD – MON DD" format
    match = re.search(
        r"([A-Z]{3})\s+(\d{1,2})\s*[–-]\s*([A-Z]{3})\s+(\d{1,2})",
        date_text
    )
    if match:
        start_month, start_day, end_month, end_day = match.groups()
        year = datetime.now().year

        if start_month in months and end_month in months:
            start_m = months[start_month]
            end_m = months[end_month]

            # Handle year rollover
            start_year = year
            end_year = year
            if start_m > end_m:
                end_year = year + 1

            try:
                start_dt = datetime(start_year, start_m, int(start_day))
                end_dt = datetime(end_year, end_m, int(end_day))

                # If start is in the past, bump both years
                if start_dt < datetime.now():
                    start_dt = datetime(start_year + 1, start_m, int(start_day))
                    end_dt = datetime(end_year + 1, end_m, int(end_day))

                return start_dt.strftime("%Y-%m-%d"), end_dt.strftime("%Y-%m-%d")
            except ValueError:
                pass

    # Try single date "MON DD"
    match = re.search(r"([A-Z]{3})\s+(\d{1,2})", date_text)
    if match:
        month_str, day = match.groups()
        if month_str in months:
            month = months[month_str]
            year = datetime.now().year
            try:
                dt = datetime(year, month, int(day))
                if dt < datetime.now():
                    dt = datetime(year + 1, month, int(day))
                return dt.strftime("%Y-%m-%d"), None
            except ValueError:
                pass

    return None, None


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Alliance Theatre shows."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36"
    }

    try:
        logger.info(f"Fetching Alliance Theatre: {SEASON_URL}")
        response = requests.get(SEASON_URL, headers=headers, timeout=30)
        response.raise_for_status()

        soup = BeautifulSoup(response.text, "html.parser")
        venue_id = get_or_create_venue(VENUE_DATA)

        # Find production links
        production_links = soup.find_all("a", href=re.compile(r"/production/"))

        seen_urls = set()

        for link in production_links:
            href = link.get("href", "")
            if href in seen_urls:
                continue
            seen_urls.add(href)

            # Get container for this production
            parent = link.find_parent("div") or link.find_parent("article")
            if not parent:
                continue

            # Find title
            title_el = link.find(["h2", "h3", "h4"]) or parent.find(["h2", "h3", "h4"])
            if not title_el:
                # Title might be the link text itself
                title = link.get_text(strip=True)
            else:
                title = title_el.get_text(strip=True)

            if not title or len(title) < 3:
                continue

            # Skip non-show links
            skip_words = ["learn more", "buy tickets", "subscribe", "donate", "gift"]
            if title.lower() in skip_words:
                continue

            # Get all text from parent for date parsing
            parent_text = parent.get_text(" ", strip=True)

            # Extract dates
            start_date, end_date = parse_date_range(parent_text)
            if not start_date:
                # Try looking in siblings
                for sibling in parent.find_next_siblings()[:2]:
                    sibling_text = sibling.get_text(" ", strip=True)
                    start_date, end_date = parse_date_range(sibling_text)
                    if start_date:
                        break

            if not start_date:
                continue

            events_found += 1

            # Generate content hash
            content_hash = generate_content_hash(title, "Alliance Theatre", start_date)

            # Check for existing
            existing = find_event_by_hash(content_hash)
            if existing:
                events_updated += 1
                continue

            # Build event URL
            event_url = href if href.startswith("http") else f"{BASE_URL}{href}"

            # Determine subcategory
            title_lower = title.lower()
            subcategory = None
            tags = ["theater", "alliance-theatre"]

            if any(w in title_lower for w in ["musical", "broadway"]):
                subcategory = "musical"
                tags.append("musical")
            elif any(w in title_lower for w in ["comedy", "funny"]):
                subcategory = "comedy"
            elif any(w in title_lower for w in ["drama"]):
                subcategory = "drama"

            # Extract description if available
            desc_el = parent.find("p")
            description = desc_el.get_text(strip=True) if desc_el else None

            event_record = {
                "source_id": source_id,
                "venue_id": venue_id,
                "title": title,
                "description": description,
                "start_date": start_date,
                "start_time": None,  # Shows typically have multiple showtimes
                "end_date": end_date,
                "end_time": None,
                "is_all_day": False,
                "category": "theater",
                "subcategory": subcategory,
                "tags": tags,
                "price_min": None,
                "price_max": None,
                "price_note": None,
                "is_free": False,
                "source_url": event_url,
                "ticket_url": event_url,
                "image_url": None,
                "raw_text": parent_text[:500] if parent_text else None,
                "extraction_confidence": 0.8,
                "is_recurring": True,  # Theater shows run multiple dates
                "recurrence_rule": None,
                "content_hash": content_hash,
            }

            try:
                insert_event(event_record)
                events_new += 1
                logger.info(f"Added: {title} ({start_date} to {end_date})")
            except Exception as e:
                logger.error(f"Failed to insert: {title}: {e}")

        logger.info(f"Alliance Theatre crawl complete: {events_found} found, {events_new} new")

    except Exception as e:
        logger.error(f"Failed to crawl Alliance Theatre: {e}")
        raise

    return events_found, events_new, events_updated
