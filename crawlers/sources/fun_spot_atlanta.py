"""
Crawler for Fun Spot America Atlanta (funspotamericaatlanta.com).
Family amusement park with special events.

Site uses WordPress - BeautifulSoup should work.
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
from utils import extract_image_url

logger = logging.getLogger(__name__)

BASE_URL = "https://funspotamericaatlanta.com"
EVENTS_URL = f"{BASE_URL}/category/events/"

VENUE_DATA = {
    "name": "Fun Spot America Atlanta",
    "slug": "fun-spot-america-atlanta",
    "address": "1675 Highway 85 N",
    "neighborhood": "Fayetteville",
    "city": "Fayetteville",
    "state": "GA",
    "zip": "30214",
    "lat": 33.4501,
    "lng": -84.4549,
    "venue_type": "amusement_park",
    "website": BASE_URL,
}


def parse_date_from_text(text: str) -> Optional[tuple[str, str]]:
    """
    Parse date from text like 'Friday, April 17, 2026' or 'Upcoming Date: Friday, April 17, 2026'.

    Returns tuple of (start_date, end_date) in YYYY-MM-DD format.
    """
    # Look for date patterns
    patterns = [
        # "Friday, April 17, 2026"
        r"(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s+"
        r"(January|February|March|April|May|June|July|August|September|October|November|December)\s+"
        r"(\d{1,2}),?\s+(\d{4})",
        # "April 17, 2026"
        r"(January|February|March|April|May|June|July|August|September|October|November|December)\s+"
        r"(\d{1,2}),?\s+(\d{4})",
    ]

    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            groups = match.groups()
            if len(groups) == 3:
                month, day, year = groups
            else:
                continue

            try:
                dt = datetime.strptime(f"{month} {day} {year}", "%B %d %Y")
                date_str = dt.strftime("%Y-%m-%d")
                return date_str, date_str
            except ValueError:
                continue

    return None, None


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Fun Spot America Atlanta events."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        venue_id = get_or_create_venue(VENUE_DATA)

        headers = {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
        }

        logger.info(f"Fetching Fun Spot America Atlanta: {EVENTS_URL}")
        response = requests.get(EVENTS_URL, headers=headers, timeout=30)
        response.raise_for_status()

        soup = BeautifulSoup(response.text, "lxml")

        # Find event articles - WordPress typically uses article tags
        articles = soup.find_all("article")

        if not articles:
            # Try common WordPress post containers
            articles = soup.find_all("div", class_=re.compile(r"post|entry|event"))

        for article in articles:
            try:
                # Get title
                title_elem = article.find(["h2", "h3", "h1"], class_=re.compile(r"title|entry-title"))
                if not title_elem:
                    title_elem = article.find(["h2", "h3", "h1"])

                if not title_elem:
                    continue

                title = title_elem.get_text(strip=True)
                if not title or len(title) < 5:
                    continue

                # Get link
                link_elem = title_elem.find("a") or article.find("a")
                event_url = link_elem.get("href") if link_elem else EVENTS_URL

                # Get content/description
                content_elem = article.find("div", class_=re.compile(r"content|excerpt|entry-content"))
                if not content_elem:
                    content_elem = article.find("p")

                description = ""
                if content_elem:
                    description = content_elem.get_text(strip=True)[:500]

                # Parse date from title or description
                full_text = f"{title} {description}"
                start_date, end_date = parse_date_from_text(full_text)

                if not start_date:
                    # Try to find date in any element
                    date_elem = article.find(class_=re.compile(r"date|time|meta"))
                    if date_elem:
                        start_date, end_date = parse_date_from_text(date_elem.get_text())

                if not start_date:
                    logger.debug(f"No date found for: {title}")
                    continue

                # Get image
                img_elem = article.find("img")
                image_url = None
                if img_elem:
                    image_url = img_elem.get("src") or img_elem.get("data-src")

                events_found += 1

                # Generate content hash
                content_hash = generate_content_hash(
                    title, "Fun Spot America Atlanta", start_date
                )

                # Check for existing
                existing = find_event_by_hash(content_hash)
                if existing:
                    events_updated += 1
                    continue

                event_record = {
                    "source_id": source_id,
                    "venue_id": venue_id,
                    "title": title,
                    "description": description if description else f"Special event at Fun Spot America Atlanta",
                    "start_date": start_date,
                    "start_time": None,
                    "end_date": end_date if end_date != start_date else None,
                    "end_time": None,
                    "is_all_day": True,
                    "category": "family",
                    "subcategory": "amusement",
                    "tags": ["fun-spot", "amusement-park", "family", "fayetteville"],
                    "price_min": None,
                    "price_max": None,
                    "price_note": "Park admission required",
                    "is_free": False,
                    "source_url": event_url,
                    "ticket_url": f"{BASE_URL}/tickets/",
                    "image_url": image_url,
                    "raw_text": f"{title}: {description[:200] if description else ''}",
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
                    logger.error(f"Failed to insert: {title}: {e}")

            except Exception as e:
                logger.warning(f"Error parsing article: {e}")
                continue

        logger.info(
            f"Fun Spot America Atlanta crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Fun Spot America Atlanta: {e}")
        raise

    return events_found, events_new, events_updated
