"""
Crawler for Keep Atlanta Beautiful (keepatlantabeautiful.org).

Keep Atlanta Beautiful is an environmental nonprofit focused on litter cleanup,
recycling, and neighborhood beautification programs in Atlanta.

IMPORTANT SITE STATUS (as of 2026-03-08):
  The keepatlantabeautiful.org website is a minimal static site — primarily a
  recycling drop-off directory. It has no events calendar, no WP events plugin,
  and no posts. Their cleanup events are not published on their own website.

  This crawler attempts to find events via:
    1. WordPress posts API (wp-json/wp/v2/posts) — currently returns 0 posts
    2. HTML scrape of homepage + /get-involved/ for event date patterns
    3. Fallback: logs clearly that no events were found

  If KAB adds an events page in the future, update EVENTS_URLS below.
  Their affiliated organization CHaRM/LiveThrive (livethrive.org) has separate
  events but is a different org and should get its own crawler.

  Keep this source active at low cadence (weekly check) — KAB is a valuable
  environmental source if they ever publish event data.
"""

from __future__ import annotations

import logging
import re
from datetime import datetime
from typing import Optional

import requests
from bs4 import BeautifulSoup

from db import get_or_create_place, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://keepatlantabeautiful.org"
WP_POSTS_API = f"{BASE_URL}/wp-json/wp/v2/posts"
WP_TRIBE_API = f"{BASE_URL}/wp-json/tribe/events/v1/events"

# Pages to scan for event content
SCAN_URLS = [
    BASE_URL,
    f"{BASE_URL}/get-involved/",
    f"{BASE_URL}/events/",
    f"{BASE_URL}/volunteer/",
    f"{BASE_URL}/cleanup/",
]

PLACE_DATA = {
    "name": "Keep Atlanta Beautiful",
    "slug": "keep-atlanta-beautiful",
    "address": "675 Ponce de Leon Ave NE",
    "neighborhood": "Poncey-Highland",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30308",
    "lat": 33.7716,
    "lng": -84.3656,
    "place_type": "nonprofit",
    "spot_type": "nonprofit",
    "website": BASE_URL,
    "description": "Environmental nonprofit dedicated to making Atlanta cleaner and greener through volunteer programs.",
}

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}


def parse_date_string(date_str: str) -> Optional[str]:
    """Parse date from various formats found on WordPress sites."""
    if not date_str:
        return None

    date_str = date_str.strip()
    now = datetime.now()

    for fmt in ["%B %d, %Y", "%b %d, %Y", "%m/%d/%Y", "%Y-%m-%d"]:
        try:
            dt = datetime.strptime(date_str, fmt)
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            continue

    # Partial match: "March 15" without year
    match = re.search(
        r"(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})",
        date_str,
        re.IGNORECASE,
    )
    if match:
        month_str = match.group(1)[:3]
        day = match.group(2)
        try:
            dt = datetime.strptime(f"{month_str} {day} {now.year}", "%b %d %Y")
            if dt.date() < now.date():
                dt = dt.replace(year=now.year + 1)
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            pass

    return None


def parse_time_string(time_str: str) -> Optional[str]:
    """Parse time string into HH:MM format."""
    if not time_str:
        return None

    match = re.search(r"(\d{1,2}):?(\d{2})?\s*(am|pm)", time_str, re.IGNORECASE)
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


def try_wp_posts_api() -> list[dict]:
    """
    Attempt to fetch events from the WordPress posts API.
    Returns a list of post dicts if any exist, empty list otherwise.
    """
    try:
        resp = requests.get(
            WP_POSTS_API,
            params={"per_page": 20, "status": "publish"},
            headers=HEADERS,
            timeout=15,
        )
        if resp.status_code == 200:
            posts = resp.json()
            if isinstance(posts, list):
                logger.info(f"KAB WP posts API: found {len(posts)} posts")
                return posts
    except Exception as e:
        logger.debug(f"KAB WP posts API failed: {e}")

    return []


def try_tribe_events_api() -> list[dict]:
    """
    Attempt to fetch from Tribe Events Calendar API.
    Returns events list if available.
    """
    try:
        resp = requests.get(
            WP_TRIBE_API,
            params={"per_page": 20, "start_date": datetime.now().strftime("%Y-%m-%d")},
            headers=HEADERS,
            timeout=15,
        )
        if resp.status_code == 200:
            data = resp.json()
            events = data.get("events", [])
            logger.info(f"KAB Tribe Events API: found {len(events)} events")
            return events
    except Exception as e:
        logger.debug(f"KAB Tribe Events API failed: {e}")

    return []


def scan_html_for_events(soup: BeautifulSoup, url: str) -> list[dict]:
    """
    Scan HTML for event-like content: headings with dates.
    Returns list of raw event dicts (title + start_date minimum).
    """
    found = []

    # Look for elements containing date patterns near headings
    all_elements = soup.find_all(["article", "div", "li", "section"])

    for elem in all_elements:
        text = elem.get_text()

        # Look for date pattern in element text
        date_match = re.search(
            r"(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:,\s+\d{4})?",
            text,
            re.IGNORECASE,
        )
        if not date_match:
            continue

        start_date = parse_date_string(date_match.group())
        if not start_date:
            continue

        # Skip past dates
        try:
            if datetime.strptime(start_date, "%Y-%m-%d").date() < datetime.now().date():
                continue
        except ValueError:
            continue

        # Look for title in heading within element
        heading = elem.find(["h1", "h2", "h3", "h4", "h5"])
        if not heading:
            continue

        title = heading.get_text(strip=True)
        if not title or len(title) < 5:
            continue

        # Look for time
        time_match = re.search(r"\d{1,2}:?\d{0,2}\s*(?:am|pm)", text, re.IGNORECASE)
        start_time = parse_time_string(time_match.group()) if time_match else None

        # Get link
        link = elem.find("a")
        event_url = link.get("href", url) if link else url
        if event_url and not event_url.startswith("http"):
            event_url = BASE_URL + event_url

        found.append({
            "title": title,
            "start_date": start_date,
            "start_time": start_time,
            "event_url": event_url,
            "description": elem.get_text(strip=True)[:300],
        })

    return found


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl Keep Atlanta Beautiful events.

    As of 2026-03-08, the KAB website has no events calendar. This crawler
    checks multiple endpoints and HTML pages, logging clearly when nothing
    is found so future changes to their site are caught automatically.
    """
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        venue_id = get_or_create_place(PLACE_DATA)

        raw_events: list[dict] = []

        # Attempt 1: Tribe Events Calendar API
        tribe_events = try_tribe_events_api()
        if tribe_events:
            for e in tribe_events:
                title = (e.get("title") or "").strip()
                start_date_str = e.get("start_date", "")
                if not title or not start_date_str:
                    continue
                try:
                    dt = datetime.fromisoformat(
                        start_date_str.replace("T", " ").split("+")[0].strip()
                    )
                    raw_events.append({
                        "title": title,
                        "start_date": dt.strftime("%Y-%m-%d"),
                        "start_time": dt.strftime("%H:%M"),
                        "event_url": e.get("url", BASE_URL),
                        "description": re.sub(r"<[^>]+>", "", e.get("description", ""))[:500],
                    })
                except (ValueError, AttributeError):
                    continue

        # Attempt 2: WordPress posts API — look for posts that describe events
        if not raw_events:
            posts = try_wp_posts_api()
            for post in posts:
                title = post.get("title", {}).get("rendered", "").strip()
                date_str = post.get("date", "")[:10]
                if not title or not date_str:
                    continue
                try:
                    dt = datetime.strptime(date_str, "%Y-%m-%d")
                    if dt.date() < datetime.now().date():
                        continue
                    content_html = post.get("content", {}).get("rendered", "")
                    description = re.sub(r"<[^>]+>", "", content_html)[:500].strip()
                    raw_events.append({
                        "title": title,
                        "start_date": date_str,
                        "start_time": None,
                        "event_url": post.get("link", BASE_URL),
                        "description": description,
                    })
                except ValueError:
                    continue

        # Attempt 3: HTML scan of known pages
        if not raw_events:
            for url in SCAN_URLS:
                try:
                    resp = requests.get(url, headers=HEADERS, timeout=15)
                    if resp.status_code != 200:
                        continue
                    soup = BeautifulSoup(resp.text, "html.parser")
                    found = scan_html_for_events(soup, url)
                    if found:
                        raw_events.extend(found)
                        logger.info(f"Found {len(found)} events via HTML scan at {url}")
                        break
                except Exception as e:
                    logger.debug(f"Failed to scan {url}: {e}")
                    continue

        if not raw_events:
            logger.info(
                "Keep Atlanta Beautiful: no events found via any method. "
                "Their site currently has no events calendar. "
                "Will retry on next scheduled crawl."
            )
            return 0, 0, 0

        # Process whatever we found
        for raw in raw_events:
            try:
                title = raw.get("title", "").strip()
                start_date = raw.get("start_date")
                if not title or not start_date:
                    continue

                events_found += 1

                description = raw.get("description", "").strip()
                if not description:
                    description = "Event hosted by Keep Atlanta Beautiful"

                combined = f"{title} {description}".lower()
                tags = ["environmental", "volunteer", "keep-atlanta-beautiful"]

                if any(w in combined for w in ["cleanup", "clean-up", "litter", "trash"]):
                    tags.extend(["cleanup", "outdoor"])
                    category, subcategory = "community", "volunteer"
                elif any(w in combined for w in ["tree", "plant"]):
                    tags.extend(["tree-planting", "outdoor"])
                    category, subcategory = "community", "volunteer"
                elif any(w in combined for w in ["garden", "beautif", "mural"]):
                    tags.extend(["beautification", "outdoor"])
                    category, subcategory = "community", "volunteer"
                elif any(w in combined for w in ["workshop", "class", "training"]):
                    tags.append("education")
                    category, subcategory = "learning", "workshop"
                else:
                    tags.append("community")
                    category, subcategory = "community", "volunteer"

                content_hash = generate_content_hash(title, "Keep Atlanta Beautiful", start_date)

                event_record = {
                    "source_id": source_id,
                    "place_id": venue_id,
                    "title": title[:200],
                    "description": description[:800],
                    "start_date": start_date,
                    "start_time": raw.get("start_time"),
                    "end_date": None,
                    "end_time": None,
                    "is_all_day": False,
                    "category": category,
                    "subcategory": subcategory,
                    "tags": tags,
                    "price_min": None,
                    "price_max": None,
                    "price_note": None,
                    "is_free": True,
                    "source_url": raw.get("event_url", BASE_URL),
                    "ticket_url": None,
                    "image_url": None,
                    "raw_text": f"{title} {description}"[:500],
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
                    logger.info(f"Added: {title} on {start_date}")
                except Exception as e:
                    logger.error(f"Failed to insert KAB event '{title}': {e}")

            except Exception as e:
                logger.debug(f"Error processing KAB event: {e}")
                continue

        logger.info(
            f"Keep Atlanta Beautiful crawl complete: {events_found} found, "
            f"{events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Keep Atlanta Beautiful: {e}")
        raise

    return events_found, events_new, events_updated
