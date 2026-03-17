"""
Crawler for Trees Atlanta (www.treesatlanta.org/get-involved/events/).

Trees Atlanta organizes volunteer tree plantings, nature walks, trail maintenance,
BeltLine arboretum care events, and community programs across Atlanta.

The events page renders with standard HTML (custom CMS, likely Salesforce-based).
No JavaScript rendering required — uses requests + BeautifulSoup.

Event card structure (div.partial-post):
  [img]
  [title]
  [date: "Sat Mar 07"]
  [time: "| 9am-12pm"]
  [location: "| Beltline Arboretum"]  (optional)
  [description excerpt]
  "Learn More"

Each unique location gets its own venue record.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime
from typing import Optional

import requests
from bs4 import BeautifulSoup

from db import (
    find_existing_event_for_insert,
    get_or_create_venue,
    insert_event,
    remove_stale_source_events,
    smart_update_existing_event,
    update_event,
)
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://www.treesatlanta.org"
EVENTS_URL = f"{BASE_URL}/get-involved/events/"

# Trees Atlanta HQ — used only when no per-event location is available
TREES_ATLANTA_HQ = {
    "name": "Trees Atlanta",
    "slug": "trees-atlanta",
    "address": "225 Chester Ave SE",
    "neighborhood": "Grant Park",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30316",
    "lat": 33.7398,
    "lng": -84.3544,
    "venue_type": "organization",
    "spot_type": "nonprofit",
    "website": BASE_URL,
    "vibes": ["volunteer", "outdoors", "environment"],
}

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
}

# Map location name fragments to Atlanta neighborhoods
LOCATION_NEIGHBORHOODS = {
    "beltline arboretum": "Old Fourth Ward",
    "eastside trail": "Old Fourth Ward",
    "westside trail": "West End",
    "southwest trail": "West End",
    "west end": "West End",
    "downtown": "Downtown",
    "midtown": "Midtown",
    "grant park": "Grant Park",
    "inman park": "Inman Park",
    "vine city": "Vine City",
    "sweet auburn": "Sweet Auburn",
    "decatur": "Decatur",
    "kirkwood": "Kirkwood",
    "morningside": "Virginia-Highland",
    "lenox park": "Buckhead",
    "chastain": "Buckhead",
    "buckhead": "Buckhead",
    "east atlanta": "East Atlanta Village",
    "reynoldstown": "Reynoldstown",
    "cabbagetown": "Cabbagetown",
    "mechanicsville": "Mechanicsville",
    "adair park": "Adair Park",
    "sylvan hills": "Sylvan Hills",
}


def parse_date(date_str: str) -> Optional[str]:
    """
    Parse Trees Atlanta date format: "Sat Mar 07" or "Mon Mar 09".
    Infers current or next year; treats past dates as next year.
    """
    if not date_str:
        return None

    # Strip leading pipe/whitespace
    date_str = date_str.lstrip("| ").strip()

    # Format: "Sat Mar 07" — day-of-week + month-abbr + day
    match = re.search(
        r"(?:\w+\s+)?"  # optional day-of-week
        r"(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})",
        date_str,
        re.IGNORECASE,
    )
    if not match:
        return None

    month_abbr = match.group(1)
    day = match.group(2)
    current_year = datetime.now().year

    for year in [current_year, current_year + 1]:
        try:
            dt = datetime.strptime(f"{month_abbr} {day} {year}", "%b %d %Y")
            if dt.date() >= datetime.now().date():
                return dt.strftime("%Y-%m-%d")
        except ValueError:
            continue

    return None


def parse_time_range(time_str: str) -> tuple[Optional[str], Optional[str]]:
    """
    Parse Trees Atlanta time format: "| 9am-12pm" or "| 12:30pm-3:30pm".
    Returns (start_time, end_time) in HH:MM format.
    """
    if not time_str:
        return None, None

    # Strip leading pipe/whitespace
    time_str = time_str.lstrip("| ").strip()

    def parse_single_time(t: str) -> Optional[str]:
        m = re.match(r"(\d{1,2}):?(\d{2})?\s*(am|pm)", t, re.IGNORECASE)
        if not m:
            return None
        hour = int(m.group(1))
        minute = m.group(2) or "00"
        period = m.group(3).lower()
        if period == "pm" and hour != 12:
            hour += 12
        elif period == "am" and hour == 12:
            hour = 0
        return f"{hour:02d}:{minute}"

    # Split on "-" between times: "9am-12pm" or "12:30pm-3:30pm"
    parts = re.split(r"-(?=\d)", time_str, maxsplit=1)
    start_time = parse_single_time(parts[0].strip()) if parts else None
    end_time = parse_single_time(parts[1].strip()) if len(parts) > 1 else None

    return start_time, end_time


def build_location_venue(location_name: str) -> dict:
    """
    Build a venue dict for a Trees Atlanta event location.
    Each unique location (park/trail/neighborhood) gets its own venue record.
    """
    # Clean up location name: remove parenthetical suffixes like "(ATL)"
    clean_name = re.sub(r"\s*\(ATL\)\s*", "", location_name).strip()

    slug = "trees-atl-" + re.sub(r"[^a-z0-9]+", "-", clean_name.lower()).strip("-")

    # Infer neighborhood
    name_lower = clean_name.lower()
    neighborhood = None
    for keyword, nbhd in LOCATION_NEIGHBORHOODS.items():
        if keyword in name_lower:
            neighborhood = nbhd
            break

    return {
        "name": clean_name,
        "slug": slug,
        "city": "Atlanta",
        "state": "GA",
        "neighborhood": neighborhood,
        "venue_type": "park",
        "spot_type": "park",
        "website": BASE_URL,
    }


def determine_category(title: str, description: str = "") -> str:
    """Determine event category based on title and description."""
    text = f"{title} {description}".lower()

    if any(
        word in text
        for word in [
            "volunteer",
            "planting",
            "tree plant",
            "cleanup",
            "trail maintenance",
            "care",
            "project ambassador",
            "pruning",
        ]
    ):
        return "community"
    if any(word in text for word in ["walk", "hike", "nature walk", "tour", "trail"]):
        return "outdoor"
    if any(
        word in text
        for word in ["workshop", "class", "training", "education", "docent", "ask the expert"]
    ):
        return "learning"
    if any(word in text for word in ["fundraiser", "gala", "benefit"]):
        return "community"

    return "community"


def build_tags(title: str, description: str = "", location: str = "") -> list[str]:
    """Build tag list from event content."""
    text = f"{title} {description} {location}".lower()
    tags = ["environment", "volunteer", "trees-atlanta"]

    if any(word in text for word in ["volunteer", "planting", "cleanup", "care", "workday"]):
        tags.append("volunteer-opportunity")
    if any(word in text for word in ["tree", "planting", "pruning", "arbor"]):
        tags.append("trees")
    if any(word in text for word in ["trail", "park", "forest", "arboretum"]):
        tags.append("parks")
    if any(word in text for word in ["beltline", "belt line"]):
        tags.append("beltline")
    if any(word in text for word in ["outdoor", "nature", "trail", "park", "arboretum"]):
        tags.append("outdoor")
    if any(word in text for word in ["walk", "hike", "tour"]):
        tags.append("walking")
    if any(word in text for word in ["family", "kid", "children", "all ages"]):
        tags.append("family-friendly")
    if any(word in text for word in ["education", "training", "learn", "workshop", "class"]):
        tags.append("education")
    if any(word in text for word in ["ask the expert", "expert"]):
        tags.append("talk")

    tags.append("free")
    return list(set(tags))


def is_free_event(title: str, description: str = "") -> bool:
    """Determine if the event is free. Trees Atlanta events are almost always free."""
    text = f"{title} {description}".lower()
    if any(word in text for word in ["$", "registration fee", "cost:", "price:", "ticket"]):
        return False
    return True


def is_canceled_event(title: str, description: str = "") -> bool:
    """Skip cards that are clearly marked canceled by the source."""
    text = f"{title} {description}".strip().lower()
    return bool(re.search(r"\bcancel(?:ed|led)\b", text))


def resolve_public_event_url(
    candidate_url: str,
    *,
    cache: Optional[dict[str, bool]] = None,
) -> str:
    """
    Use the stable listing page when a Trees Atlanta detail URL is dead.

    Trees occasionally leaves expired same-day detail pages linked from the live
    grid. Falling back to the listing page is better than surfacing a known 404.
    """
    url = (candidate_url or "").strip()
    if not url or url == EVENTS_URL:
        return EVENTS_URL

    if cache is not None and url in cache:
        return url if cache[url] else EVENTS_URL

    is_live = False
    try:
        response = requests.get(url, headers=HEADERS, timeout=20, allow_redirects=True)
        is_live = response.status_code == 200
    except requests.RequestException:
        is_live = False

    if cache is not None:
        cache[url] = is_live

    return url if is_live else EVENTS_URL


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl Trees Atlanta events using requests + BeautifulSoup.

    Parses div.partial-post cards from the events listing page.
    Each card contains: image, title, date, time, optional location, description excerpt.
    """
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    # Venue cache: location slug -> venue_id
    venue_cache: dict[str, int] = {}
    current_hashes: set[str] = set()
    url_status_cache: dict[str, bool] = {}

    try:
        # Ensure HQ venue exists (used as fallback)
        hq_venue_id = get_or_create_venue(TREES_ATLANTA_HQ)
        venue_cache["trees-atlanta"] = hq_venue_id

        logger.info(f"Fetching Trees Atlanta events: {EVENTS_URL}")
        try:
            response = requests.get(EVENTS_URL, headers=HEADERS, timeout=30)
            response.raise_for_status()
        except requests.exceptions.RequestException as e:
            logger.error(f"Failed to fetch Trees Atlanta events page: {e}")
            raise

        soup = BeautifulSoup(response.text, "html.parser")

        # Each event is a div.partial-post
        event_cards = soup.select("div.partial-post")
        logger.info(f"Found {len(event_cards)} event cards on page")

        for card in event_cards:
            try:
                # All text content, split cleanly
                # Structure: img_url | title | date | | time | [location] | description | "Learn More"
                parts = [
                    t.strip()
                    for t in card.get_text(separator="|||").split("|||")
                    if t.strip()
                ]

                if len(parts) < 3:
                    continue

                # First text part is the image URL (rendered as text from the img src)
                # Find the link for the event detail URL
                link = card.find("a")
                event_path = link.get("href", "") if link else ""
                if event_path and not event_path.startswith("http"):
                    raw_event_url = BASE_URL + event_path
                elif event_path:
                    raw_event_url = event_path
                else:
                    raw_event_url = EVENTS_URL
                event_url = resolve_public_event_url(raw_event_url, cache=url_status_cache)

                # Get image from actual img tag
                img_tag = card.find("img")
                image_url = None
                if img_tag:
                    image_url = img_tag.get("src") or img_tag.get("data-src")
                    # Use the treesatlanta.org version not the CDN version
                    if image_url and "nmcdn.io" in image_url:
                        # Convert CDN URL back to origin if possible via og:image pattern
                        # The card text contains the full WP origin URL as the first part
                        for p in parts:
                            if p.startswith("https://www.treesatlanta.org/wp-content/"):
                                image_url = p
                                break

                # Identify which part is the title vs date vs time vs location
                # Pattern: parts look like:
                #   "https://...jpg"  (image URL — skip)
                #   "Forest Stewardship Training 2026"  (title)
                #   "Sat Mar 07"  (date — matches month abbr pattern)
                #   "| 9am-12pm"  (time — starts with | and contains am/pm)
                #   "| Beltline Arboretum"  (location — starts with | no digits)
                #   "Forest Stewardship training includes..."  (description)
                #   "Learn More"  (skip)

                title = None
                date_str = None
                time_str = None
                location_str = None
                description = None

                for part in parts:
                    # Skip image URLs
                    if part.startswith("http") and any(
                        ext in part for ext in [".jpg", ".png", ".webp", ".jpeg"]
                    ):
                        continue
                    # Skip "Learn More"
                    if part.lower() in ("learn more", "register", "sign up"):
                        continue

                    # Date: contains month abbreviation
                    if re.search(
                        r"\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}\b",
                        part,
                        re.IGNORECASE,
                    ):
                        if date_str is None:
                            date_str = part
                        continue

                    # Time: starts with pipe and contains am/pm
                    if part.startswith("|") and re.search(r"\d+:?\d*\s*(am|pm)", part, re.IGNORECASE):
                        if time_str is None:
                            time_str = part
                        continue

                    # Location: starts with pipe, no digits (or has words only)
                    if part.startswith("|") and not re.search(r"\d+:?\d*\s*(am|pm)", part, re.IGNORECASE):
                        if location_str is None:
                            location_str = part.lstrip("| ").strip()
                        continue

                    # Title: first meaningful non-URL text before date
                    if title is None and date_str is None and len(part) > 5:
                        title = part
                        continue

                    # Description: comes after date/time/location, longer text
                    if title is not None and date_str is not None and description is None:
                        if len(part) > 20 and not part.startswith("|"):
                            description = part
                        continue

                if not title:
                    logger.debug("No title found in event card, skipping")
                    continue

                if is_canceled_event(title, description or ""):
                    logger.debug("Skipping canceled Trees Atlanta event: %s", title)
                    continue

                if not date_str:
                    logger.debug(f"No date found for event: {title}")
                    continue

                start_date = parse_date(date_str)
                if not start_date:
                    logger.debug(f"Could not parse date '{date_str}' for: {title}")
                    continue

                # Skip past events
                try:
                    if datetime.strptime(start_date, "%Y-%m-%d").date() < datetime.now().date():
                        continue
                except ValueError:
                    continue

                start_time, end_time = parse_time_range(time_str) if time_str else (None, None)

                events_found += 1

                # Venue: use location from card if available, else HQ
                venue_id = hq_venue_id
                venue_name_for_hash = "Trees Atlanta"

                if location_str and len(location_str) > 2:
                    venue_dict = build_location_venue(location_str)
                    slug = venue_dict["slug"]
                    if slug not in venue_cache:
                        venue_cache[slug] = get_or_create_venue(venue_dict)
                    venue_id = venue_cache[slug]
                    venue_name_for_hash = venue_dict["name"]

                category = determine_category(title, description or "")
                tags = build_tags(title, description or "", location_str or "")
                is_free = is_free_event(title, description or "")

                content_hash = generate_content_hash(title, venue_name_for_hash, start_date)
                current_hashes.add(content_hash)

                event_record = {
                    "source_id": source_id,
                    "venue_id": venue_id,
                    "title": title[:200],
                    "description": description[:800] if description else None,
                    "start_date": start_date,
                    "start_time": start_time,
                    "end_date": None,
                    "end_time": end_time,
                    "is_all_day": False,
                    "category": category,
                    "subcategory": None,
                    "tags": tags,
                    "price_min": None,
                    "price_max": None,
                    "price_note": None,
                    "is_free": is_free,
                    "source_url": event_url,
                    "ticket_url": event_url if event_url != EVENTS_URL else None,
                    "image_url": image_url,
                    "raw_text": f"{title} {description or ''}"[:500],
                    "extraction_confidence": 0.88,
                    "is_recurring": False,
                    "recurrence_rule": None,
                    "content_hash": content_hash,
                }

                existing = find_existing_event_for_insert(event_record)
                if existing:
                    if event_url == EVENTS_URL and (existing.get("source_url") or "").strip() != EVENTS_URL:
                        update_event(existing["id"], {"source_url": EVENTS_URL, "ticket_url": None})
                        existing = {**existing, "source_url": EVENTS_URL, "ticket_url": None}
                    smart_update_existing_event(existing, event_record)
                    events_updated += 1
                    continue

                try:
                    insert_event(event_record)
                    events_new += 1
                    logger.info(
                        f"Added: {title[:50]} on {start_date}"
                        + (f" @ {venue_name_for_hash}" if location_str else "")
                    )
                except Exception as e:
                    logger.error(f"Failed to insert Trees Atlanta event '{title}': {e}")

            except Exception as e:
                logger.debug(f"Error processing Trees Atlanta event card: {e}")
                continue

        stale_deleted = remove_stale_source_events(source_id, current_hashes)
        if stale_deleted:
            logger.info(
                "Removed %s stale Trees Atlanta events after schedule refresh",
                stale_deleted,
            )

        logger.info(
            f"Trees Atlanta crawl complete: {events_found} found, "
            f"{events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Trees Atlanta: {e}")
        raise

    return events_found, events_new, events_updated
