"""
Crawler for MODEX.

Official source:
- The homepage publishes the current 2026 Atlanta date range, registration CTA,
  image, and event description.
"""

from __future__ import annotations

import logging
import re
from datetime import date, datetime
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

from db import (
    find_existing_event_for_insert,
    get_or_create_venue,
    insert_event,
    remove_stale_source_events,
    smart_update_existing_event,
)
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

SOURCE_URL = "https://modexshow.com/"
USER_AGENT = "Mozilla/5.0 (compatible; LostCityBot/1.0)"

VENUE_DATA = {
    "name": "Georgia World Congress Center",
    "slug": "georgia-world-congress-center",
    "address": "285 Andrew Young International Blvd NW",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30313",
    "venue_type": "convention_center",
    "spot_type": "convention_center",
    "website": "https://www.gwcca.org/",
}


def parse_homepage(html: str, today: date | None = None) -> dict:
    """Extract the current MODEX cycle from the official homepage."""
    today = today or datetime.now().date()
    soup = BeautifulSoup(html, "html.parser")

    description = ""
    desc_tag = soup.find("meta", attrs={"name": "description"})
    if desc_tag and desc_tag.get("content"):
        description = str(desc_tag["content"]).strip()
    if not description:
        og_desc = soup.find("meta", attrs={"property": "og:description"})
        if og_desc and og_desc.get("content"):
            description = str(og_desc["content"]).strip()

    search_text = description or soup.get_text(" ", strip=True)
    date_match = re.search(
        r"April\s+(\d{1,2})-(\d{1,2}),\s*(\d{4}),?\s*Atlanta",
        search_text,
        re.IGNORECASE,
    )
    if not date_match:
        raise ValueError("MODEX homepage did not expose the 2026 Atlanta date range")

    start_day = int(date_match.group(1))
    end_day = int(date_match.group(2))
    year = int(date_match.group(3))
    start_date = date(year, 4, start_day)
    end_date = date(year, 4, end_day)
    if end_date < today:
        raise ValueError("MODEX homepage only exposes a past-dated cycle")

    ticket_url = None
    for anchor in soup.find_all("a", href=True):
        text = re.sub(r"\s+", " ", anchor.get_text(" ", strip=True)).lower()
        href = anchor["href"]
        if "register" in text and "free" in text:
            ticket_url = urljoin(SOURCE_URL, href)
            break
    if not ticket_url:
        for anchor in soup.find_all("a", href=True):
            text = re.sub(r"\s+", " ", anchor.get_text(" ", strip=True)).lower()
            if "register" in text:
                ticket_url = urljoin(SOURCE_URL, anchor["href"])
                break
    if not ticket_url:
        ticket_url = urljoin(SOURCE_URL, "/register")

    image_url = None
    og_image = soup.find("meta", attrs={"property": "og:image"})
    if og_image and og_image.get("content"):
        image_url = str(og_image["content"]).strip()

    return {
        "title": "MODEX 2026",
        "start_date": start_date.isoformat(),
        "end_date": end_date.isoformat(),
        "ticket_url": ticket_url,
        "image_url": image_url,
        "description": description
        or "MODEX is a large Atlanta supply-chain and logistics trade show focused on manufacturing, warehousing, automation, and material handling.",
        "source_url": SOURCE_URL,
    }


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl MODEX from the official homepage."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0
    current_hashes: set[str] = set()

    response = requests.get(
        SOURCE_URL,
        headers={"User-Agent": USER_AGENT},
        timeout=30,
    )
    response.raise_for_status()

    event = parse_homepage(response.text)
    venue_id = get_or_create_venue(VENUE_DATA)
    content_hash = generate_content_hash(event["title"], VENUE_DATA["name"], event["start_date"])
    current_hashes.add(content_hash)
    events_found = 1

    event_record = {
        "source_id": source_id,
        "venue_id": venue_id,
        "title": event["title"],
        "description": event["description"],
        "start_date": event["start_date"],
        "start_time": None,
        "end_date": event["end_date"],
        "end_time": None,
        "is_all_day": True,
        "category": "community",
        "subcategory": "conference",
        "tags": ["logistics", "supply-chain", "automation", "trade-show", "technology"],
        "price_min": 0.0,
        "price_max": 0.0,
        "price_note": "Official MODEX registration is promoted as free.",
        "is_free": True,
        "source_url": event["source_url"],
        "ticket_url": event["ticket_url"],
        "image_url": event["image_url"],
        "raw_text": (
            f"{event['title']} | {event['start_date']} to {event['end_date']} | "
            f"{VENUE_DATA['name']}"
        ),
        "extraction_confidence": 0.93,
        "content_hash": content_hash,
    }

    existing = find_existing_event_for_insert(event_record)
    if existing:
        smart_update_existing_event(existing, event_record)
        events_updated = 1
    else:
        insert_event(event_record)
        events_new = 1

    stale_removed = remove_stale_source_events(source_id, current_hashes)
    if stale_removed:
        logger.info("Removed %s stale MODEX events after refresh", stale_removed)

    logger.info(
        "MODEX crawl complete: %s found, %s new, %s updated",
        events_found,
        events_new,
        events_updated,
    )
    return events_found, events_new, events_updated
