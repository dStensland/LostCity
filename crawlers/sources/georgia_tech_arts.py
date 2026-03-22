"""
Crawler for Georgia Tech Arts Events (arts.gatech.edu).
Performing arts, concerts, theater, exhibitions at Georgia Tech including Ferst Center.
Uses static HTTP (requests + BeautifulSoup) for both listing and detail pages.
"""

import logging
import re
from datetime import datetime
from typing import Optional

import requests
from bs4 import BeautifulSoup

from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://arts.gatech.edu"
EVENTS_URL = f"{BASE_URL}/events"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
}

VENUES = {
    "ferst": {
        "name": "Ferst Center for the Arts",
        "slug": "ferst-center",
        "address": "349 Ferst Drive NW",
        "neighborhood": "Midtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30332",
        "venue_type": "theater",
        "website": "https://ferstcenter.gatech.edu",
    },
    "default": {
        "name": "Georgia Tech Arts",
        "slug": "georgia-tech-arts",
        "address": "823 Marietta Street NW",
        "neighborhood": "Midtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30318",
        "venue_type": "university",
        "website": BASE_URL,
    },
}

CAMPUS_ONLY_KEYWORDS = [
    "faculty mixer",
    "faculty meeting",
    "faculty reception",
    "student org",
    "grad student",
    "social mixer",
    "spring break",
    "alternative break",
    "hackathon",
    "town hall",
    "org fair",
    "wreckcon",
    "create-your-own",
    "media arts day",
    "community salon",
    "ceismc",
    "end-of-year",
    "open call",
    "night of diversity",
    "belonging in view",
    "inventure prize",
    "capstone",
    "thesis",
    "orientation",
    "commencement",
    "convocation",
    "student band",
    "student-led band",
]

CAMPUS_PATTERNS = [
    re.compile(r"\bfaculty\b.*\b(mixer|reception|meeting|retreat|luncheon)\b", re.I),
    re.compile(r"\b(student|campus)\b.*\b(mixer|social|org fair|orientation)\b", re.I),
    re.compile(r"\balternative\s+spring\s+break\b", re.I),
]

FOOTER_BOILERPLATE = [
    "Equal Opportunity, Nondiscrimination",
    "Human Trafficking Notice",
    "Georgia Institute of Technology.All Rights Reserved",
    "Hazing Public Disclosures",
    "Anti-Harassment Policy",
    "ArtsRich Computer Center258",
]


def parse_time(time_str: str) -> Optional[str]:
    """Parse time from various formats."""
    if not time_str:
        return None

    match = re.search(r"(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)", time_str)
    if match:
        hour, minute, period = match.groups()
        hour = int(hour)
        if period.upper() == "PM" and hour != 12:
            hour += 12
        elif period.upper() == "AM" and hour == 12:
            hour = 0
        return f"{hour:02d}:{minute}"

    return None


def categorize_event(title: str, description: str) -> tuple[str, str]:
    """Determine category and subcategory."""
    title_lower = title.lower()

    if any(w in title_lower for w in ["concert", "symphony", "jazz", "choir", "orchestra", "recital"]):
        return "music", "concert"
    if any(w in title_lower for w in ["theater", "theatre", "play", "dance", "ballet"]):
        return "theater", "performance"
    if any(w in title_lower for w in ["exhibition", "gallery", "art show", "opening"]):
        return "art", "exhibition"
    if any(w in title_lower for w in ["film", "screening", "movie"]):
        return "film", "screening"
    if any(w in title_lower for w in ["lecture", "talk", "discussion", "symposium"]):
        return "community", "lecture"
    return "arts", "performance"


def parse_date_from_text(text: str) -> Optional[str]:
    """Extract date from text like 'Feb 27, 2026' or 'February 27, 2026'."""
    if not text:
        return None

    month_pattern = (
        r"(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?"
        r"|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)"
        r"\s+(\d{1,2}),?\s+(\d{4})"
    )
    match = re.search(month_pattern, text, re.IGNORECASE)
    if match:
        month_str, day, year = match.groups()
        month_map = {
            "jan": 1,
            "january": 1,
            "feb": 2,
            "february": 2,
            "mar": 3,
            "march": 3,
            "apr": 4,
            "april": 4,
            "may": 5,
            "jun": 6,
            "june": 6,
            "jul": 7,
            "july": 7,
            "aug": 8,
            "august": 8,
            "sep": 9,
            "september": 9,
            "oct": 10,
            "october": 10,
            "nov": 11,
            "november": 11,
            "dec": 12,
            "december": 12,
        }
        month = month_map.get(month_str.lower())
        if month:
            return f"{year}-{month:02d}-{int(day):02d}"

    return None


def _fetch_detail(url: str) -> Optional[BeautifulSoup]:
    """Fetch an event detail page."""
    try:
        resp = requests.get(url, headers=HEADERS, timeout=20)
        resp.raise_for_status()
        return BeautifulSoup(resp.text, "html.parser")
    except Exception as exc:
        logger.debug(f"Failed to fetch detail page {url}: {exc}")
        return None


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Georgia Tech Arts events."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        logger.info(f"Fetching Georgia Tech Arts: {EVENTS_URL}")
        resp = requests.get(EVENTS_URL, headers=HEADERS, timeout=30)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "html.parser")

        ferst_venue_id = get_or_create_venue(VENUES["ferst"])
        default_venue_id = get_or_create_venue(VENUES["default"])

        event_links = soup.find_all("a", href=lambda x: x and "/event/" in str(x))
        unique_events: dict[str, str] = {}
        for link in event_links:
            href = link.get("href")
            text = link.get_text(strip=True)
            if not (href and text and text not in ["LEARN MORE →", "Image", ""] and len(text) > 3):
                continue
            text_lower = text.lower()
            if any(kw in text_lower for kw in CAMPUS_ONLY_KEYWORDS):
                logger.debug(f"Skipping campus-only event: {text}")
                continue
            if any(pat.search(text) for pat in CAMPUS_PATTERNS):
                logger.debug(f"Skipping campus-only event (pattern): {text}")
                continue
            if href not in unique_events:
                unique_events[href] = text

        logger.info(f"Found {len(unique_events)} unique event links")

        for href, title in unique_events.items():
            try:
                if href.startswith("http"):
                    event_url = href
                else:
                    event_url = f"{BASE_URL}{href}" if href.startswith("/") else f"{BASE_URL}/{href}"

                event_soup = _fetch_detail(event_url)
                if not event_soup:
                    continue

                page_text = event_soup.get_text()
                start_date = parse_date_from_text(page_text)

                if not start_date:
                    logger.debug(f"No date found for {title}")
                    continue

                start_time = parse_time(page_text)
                events_found += 1

                description = ""
                meta_desc = event_soup.find("meta", attrs={"name": "description"})
                if meta_desc and meta_desc.get("content"):
                    description = meta_desc.get("content", "").strip()[:500]

                if not description:
                    og_desc = event_soup.find("meta", property="og:description")
                    if og_desc and og_desc.get("content"):
                        description = og_desc.get("content", "").strip()[:500]

                if not description:
                    for selector in [
                        "article",
                        '[class*="event-description"]',
                        '[class*="event-body"]',
                        '[class*="field--body"]',
                        ".node__content .field--type-text-with-summary",
                    ]:
                        desc_elem = event_soup.select_one(selector)
                        if desc_elem:
                            description = desc_elem.get_text(separator=" ", strip=True)[:500]
                            break

                if description and any(marker in description for marker in FOOTER_BOILERPLATE):
                    logger.debug(f"Rejected footer-text description for: {title}")
                    description = ""

                image_url = None
                og_image = event_soup.find("meta", property="og:image")
                if og_image and og_image.get("content"):
                    image_url = og_image.get("content")
                else:
                    img_elem = event_soup.find("img", src=re.compile(r"/sites/default/files/"))
                    if img_elem:
                        src = img_elem.get("src")
                        if src:
                            image_url = src if src.startswith("http") else f"{BASE_URL}{src}"

                venue_id = ferst_venue_id if "ferst" in title.lower() else default_venue_id
                venue_name = (
                    VENUES["ferst"]["name"] if venue_id == ferst_venue_id else VENUES["default"]["name"]
                )

                content_hash = generate_content_hash(title, venue_name, start_date)
                category, subcategory = categorize_event(title, description)
                tags = ["college", "georgia-tech", "midtown", "arts"]

                event_record = {
                    "source_id": source_id,
                    "venue_id": venue_id,
                    "title": title,
                    "description": description or None,
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
                    "price_note": None,
                    "is_free": None,
                    "source_url": event_url or EVENTS_URL,
                    "ticket_url": None,
                    "image_url": image_url,
                    "raw_text": None,
                    "extraction_confidence": 0.75,
                    "is_recurring": False,
                    "recurrence_rule": None,
                    "content_hash": content_hash,
                }

                existing = find_event_by_hash(content_hash)
                if existing:
                    smart_update_existing_event(existing, event_record)
                    events_updated += 1
                    continue

                try:
                    insert_event(event_record)
                    events_new += 1
                    logger.debug(f"Added: {title} on {start_date}")
                except Exception as e:
                    logger.error(f"Failed to insert {title}: {e}")

            except Exception as e:
                logger.debug(f"Error processing event: {e}")
                continue

        logger.info(
            f"Georgia Tech Arts: Found {events_found} events, {events_new} new, {events_updated} existing"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Georgia Tech Arts: {e}")
        raise

    return events_found, events_new, events_updated
