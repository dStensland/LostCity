"""
Crawler for Creative Loafing Atlanta (creativeloafing.com/atlanta-events).
Atlanta's best local events calendar, covering music, art, food, and more.
This is an aggregator source - events link to external venues.

Page structure (as of 2026):
- Events listed with: Title, Date (MM/DD/YYYY H:MM AM/PM), Venue (ALL CAPS), Description
- Must use ?when=This+Week or similar filter to get current events
- Default page shows old events sorted by some other criteria
"""

from __future__ import annotations

import re
import logging
from datetime import datetime, timedelta
from typing import Optional

from playwright.sync_api import sync_playwright, Page

from db import get_or_create_venue, insert_event, find_event_by_hash
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://creativeloafing.com"
EVENTS_URL = f"{BASE_URL}/atlanta-events"

# URLs to scrape - MUST use time filters for current events
SCRAPE_URLS = [
    # Time-filtered views (these show current events)
    f"{EVENTS_URL}?when=This+Week",
    f"{EVENTS_URL}?when=This+Weekend",
    f"{EVENTS_URL}?when=Next+Week",
    f"{EVENTS_URL}?when=Next+Weekend",
    # Category + time filters
    f"{EVENTS_URL}?category=Music&when=This+Month",
    f"{EVENTS_URL}?category=Arts&when=This+Month",
    f"{EVENTS_URL}?category=Nightlife&when=This+Month",
    f"{EVENTS_URL}?category=Food+and+Drink&when=This+Month",
    f"{EVENTS_URL}?category=Community&when=This+Month",
    f"{EVENTS_URL}?category=Festivals&when=This+Month",
    f"{EVENTS_URL}?category=Comedy&when=This+Month",
    f"{EVENTS_URL}?category=Theater&when=This+Month",
]


def parse_date(date_text: str) -> Optional[str]:
    """Parse date from various formats."""
    date_text = date_text.strip()

    # Try MM/DD/YYYY format
    match = re.search(r"(\d{1,2})/(\d{1,2})/(\d{4})", date_text)
    if match:
        month, day, year = match.groups()
        try:
            dt = datetime(int(year), int(month), int(day))
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            pass

    # Try "January 16, 2026" format
    for fmt in ["%B %d, %Y", "%B %d %Y", "%b %d, %Y", "%b %d %Y"]:
        try:
            dt = datetime.strptime(date_text, fmt)
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            continue

    # Try finding date pattern in text
    match = re.search(
        r"(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s*(\d{4})?",
        date_text,
        re.IGNORECASE
    )
    if match:
        month, day, year = match.groups()
        if not year:
            year = str(datetime.now().year)
        try:
            dt = datetime.strptime(f"{month} {day}, {year}", "%B %d, %Y")
            if dt < datetime.now() - timedelta(days=7):
                dt = dt.replace(year=dt.year + 1)
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            pass

    # Try "Mon, Jan 20" format
    match = re.search(r"(\w{3}),?\s*(\w{3})\s+(\d{1,2})", date_text)
    if match:
        _, month_abbr, day = match.groups()
        year = datetime.now().year
        try:
            dt = datetime.strptime(f"{month_abbr} {day}, {year}", "%b %d, %Y")
            if dt < datetime.now() - timedelta(days=7):
                dt = dt.replace(year=dt.year + 1)
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            pass

    return None


def parse_time(time_text: str) -> Optional[str]:
    """Parse time from '8:00 PM' format."""
    match = re.search(r"(\d{1,2}):(\d{2})\s*(am|pm)", time_text, re.IGNORECASE)
    if match:
        hour, minute, period = match.groups()
        hour = int(hour)
        if period.lower() == "pm" and hour != 12:
            hour += 12
        elif period.lower() == "am" and hour == 12:
            hour = 0
        return f"{hour:02d}:{minute}"

    # Try "8pm" format without minutes
    match = re.search(r"(\d{1,2})\s*(am|pm)", time_text, re.IGNORECASE)
    if match:
        hour, period = match.groups()
        hour = int(hour)
        if period.lower() == "pm" and hour != 12:
            hour += 12
        elif period.lower() == "am" and hour == 12:
            hour = 0
        return f"{hour:02d}:00"

    return None


def determine_category(text: str, cl_category: str = None) -> tuple[str, Optional[str], list]:
    """Determine category based on event text and CL category."""
    text_lower = text.lower()
    tags = ["creative-loafing"]

    # Use CL category if provided
    if cl_category:
        cl_cat_lower = cl_category.lower()
        if "music" in cl_cat_lower:
            tags.append("music")
            if "dj" in text_lower:
                return "music", "dj", tags
            if "brunch" in text_lower:
                return "music", "brunch", tags
            return "music", "concert", tags
        if "arts" in cl_cat_lower:
            tags.append("art")
            if "theater" in text_lower or "theatre" in text_lower:
                return "theater", None, tags
            if "film" in text_lower or "movie" in text_lower:
                return "film", "screening", tags
            if "dance" in text_lower:
                return "theater", "dance", tags
            return "art", "exhibit", tags
        if "nightlife" in cl_cat_lower:
            tags.append("nightlife")
            if "comedy" in text_lower:
                return "comedy", None, tags
            if "drag" in text_lower:
                return "nightlife", "drag-show", tags
            if "trivia" in text_lower:
                return "nightlife", "trivia", tags
            if "karaoke" in text_lower:
                return "nightlife", "karaoke", tags
            if "open mic" in text_lower:
                return "music", "open-mic", tags
            return "nightlife", None, tags
        if "food" in cl_cat_lower or "drink" in cl_cat_lower:
            tags.append("food")
            return "food_drink", None, tags
        if "community" in cl_cat_lower:
            tags.append("community")
            if "lgbtq" in text_lower:
                return "community", "lgbtq", tags
            if "class" in text_lower or "workshop" in text_lower:
                return "community", "workshop", tags
            return "community", None, tags
        if "festival" in cl_cat_lower:
            tags.append("festival")
            return "community", "festival", tags
        if "sports" in cl_cat_lower:
            tags.append("sports")
            return "sports", None, tags

    # Fallback to text-based detection
    if any(w in text_lower for w in ["concert", "live music", "band", "tour", "dj"]):
        tags.append("music")
        if "dj" in text_lower:
            return "music", "dj", tags
        return "music", "concert", tags

    if any(w in text_lower for w in ["comedy", "stand-up", "comedian", "improv"]):
        tags.append("comedy")
        return "comedy", None, tags

    if any(w in text_lower for w in ["theater", "theatre", "play", "musical", "broadway"]):
        tags.append("theater")
        return "theater", None, tags

    if any(w in text_lower for w in ["art", "gallery", "exhibit", "museum"]):
        tags.append("art")
        return "art", "exhibit", tags

    if any(w in text_lower for w in ["film", "movie", "screening", "cinema"]):
        tags.append("film")
        return "film", "screening", tags

    if any(w in text_lower for w in ["food", "tasting", "dinner", "brunch", "restaurant"]):
        tags.append("food")
        return "food_drink", None, tags

    if any(w in text_lower for w in ["trivia", "karaoke", "drag", "party"]):
        tags.append("nightlife")
        return "nightlife", None, tags

    return "other", None, tags


def extract_events_from_page(page: Page, source_id: int, venue_cache: dict, seen_events: set, cl_category: str = None) -> tuple[int, int, int]:
    """
    Extract events from the current page using line-based parsing.

    Creative Loafing structure:
    - Line N: Event title
    - Line N+1: MM/DD/YYYY H:MM AM/PM (date/time)
    - Line N+2: VENUE NAME (usually all caps)
    - Line N+3: Description text
    - Line N+4: "—Read Article" (end marker)
    """
    events_found = 0
    events_new = 0
    events_updated = 0

    body_text = page.inner_text("body")
    lines = [l.strip() for l in body_text.split("\n") if l.strip()]

    # Skip words for navigation/UI elements
    skip_patterns = [
        "sign up", "login", "subscribe", "advertisement", "privacy policy",
        "terms of", "© ", "all rights", "popular", "latest", "original atlanta",
        ">> events", "atlanta's guide", "upcoming events", "things to do",
        "cl recommends", "five things", "related:", "looking for", "browse featured",
        "january", "february", "march", "april", "may", "june", "july", "august",
        "september", "october", "november", "december"  # Month headers
    ]

    events_extracted = []
    i = 0

    while i < len(lines) - 2:
        line = lines[i]

        # Skip navigation/header lines
        if len(line) < 5 or any(p in line.lower() for p in skip_patterns):
            i += 1
            continue

        # Skip if line is just a category/tag
        if line.lower() in ["music", "arts", "nightlife", "community", "food and drink",
                            "festivals", "sports", "theater", "comedy", "free events"]:
            i += 1
            continue

        # Check if this could be an event title
        # Title should be reasonable length and not be a date line
        if len(line) > 10 and len(line) < 200:
            # Check if next line is a date in MM/DD/YYYY format
            if i + 1 < len(lines):
                next_line = lines[i + 1]
                date_match = re.match(r"(\d{1,2}/\d{1,2}/\d{4})\s+(\d{1,2}:\d{2}\s*(?:AM|PM))", next_line, re.IGNORECASE)

                if date_match:
                    title = line
                    date_str = date_match.group(1)
                    time_str = date_match.group(2)

                    # Parse date
                    try:
                        dt = datetime.strptime(date_str, "%m/%d/%Y")
                        start_date = dt.strftime("%Y-%m-%d")
                    except ValueError:
                        i += 1
                        continue

                    # Parse time
                    start_time = parse_time(time_str)

                    # Get venue from next line (usually all caps)
                    venue_name = "Atlanta Area"
                    if i + 2 < len(lines):
                        venue_line = lines[i + 2]
                        # Venue is typically all caps or mostly caps
                        if venue_line and len(venue_line) > 3 and len(venue_line) < 100:
                            # Check if it looks like a venue (not a description)
                            if not venue_line.startswith("Join") and not venue_line.startswith("The ") and "—Read Article" not in venue_line:
                                # Clean up venue name
                                venue_name = venue_line.strip()
                                # Title case if all caps
                                if venue_name.isupper():
                                    venue_name = venue_name.title()

                    # Get description from following lines until "—Read Article"
                    description = ""
                    desc_start = i + 3 if venue_name != "Atlanta Area" else i + 2
                    for j in range(desc_start, min(desc_start + 5, len(lines))):
                        if "—Read Article" in lines[j]:
                            break
                        if lines[j] and len(lines[j]) > 10:
                            description = lines[j][:500]
                            break

                    # Create event key for deduplication
                    event_key = f"{title}|{start_date}|{venue_name}"
                    if event_key not in seen_events:
                        seen_events.add(event_key)
                        events_extracted.append({
                            "title": title,
                            "start_date": start_date,
                            "start_time": start_time,
                            "venue_name": venue_name,
                            "description": description,
                            "event_url": EVENTS_URL,
                        })

                    # Skip past this event block
                    i += 4
                    continue

        i += 1

    # Process extracted events
    for event_data in events_extracted:
        events_found += 1

        venue_name = event_data["venue_name"]

        # Get or create venue
        if venue_name in venue_cache:
            venue_id = venue_cache[venue_name]
        else:
            venue_slug = re.sub(r"[^a-z0-9]+", "-", venue_name.lower()).strip("-")
            venue_data = {
                "name": venue_name,
                "slug": venue_slug[:50],
                "city": "Atlanta",
                "state": "GA",
                "venue_type": "venue",
            }
            venue_id = get_or_create_venue(venue_data)
            venue_cache[venue_name] = venue_id

        # Generate content hash
        content_hash = generate_content_hash(event_data["title"], venue_name, event_data["start_date"])

        # Check for existing
        existing = find_event_by_hash(content_hash)
        if existing:
            events_updated += 1
            continue

        # Determine category
        category, subcategory, tags = determine_category(
            event_data["title"] + " " + event_data.get("description", ""),
            cl_category
        )

        event_record = {
            "source_id": source_id,
            "venue_id": venue_id,
            "title": event_data["title"],
            "description": event_data.get("description"),
            "start_date": event_data["start_date"],
            "start_time": event_data.get("start_time"),
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
            "source_url": event_data.get("event_url", EVENTS_URL),
            "ticket_url": None,
            "image_url": None,
            "raw_text": event_data.get("description"),
            "extraction_confidence": 0.80,
            "is_recurring": False,
            "recurrence_rule": None,
            "content_hash": content_hash,
        }

        try:
            insert_event(event_record)
            events_new += 1
            logger.info(f"Added: {event_data['title']} on {event_data['start_date']} at {venue_name}")
        except Exception as e:
            logger.error(f"Failed to insert: {event_data['title']}: {e}")

    return events_found, events_new, events_updated


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Creative Loafing events using Playwright."""
    source_id = source["id"]
    total_found = 0
    total_new = 0
    total_updated = 0

    venue_cache = {}
    seen_events = set()

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
                viewport={"width": 1920, "height": 1080},
            )
            page = context.new_page()

            # Scrape each URL (all use time filters for current events)
            for url in SCRAPE_URLS:
                # Extract category and time filter names from URL
                category_match = re.search(r"category=([^&]+)", url)
                when_match = re.search(r"when=([^&]+)", url)
                cl_category = category_match.group(1).replace("+", " ") if category_match else None
                when_filter = when_match.group(1).replace("+", " ") if when_match else "All"

                url_label = f"{cl_category or 'All'} / {when_filter}"
                logger.info(f"Fetching Creative Loafing ({url_label}): {url}")

                try:
                    page.goto(url, wait_until="domcontentloaded", timeout=30000)
                    page.wait_for_timeout(3000)

                    # Scroll to load more content
                    for _ in range(5):
                        page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                        page.wait_for_timeout(1000)

                    # Try to click "Load More" or "Show More" buttons
                    for _ in range(3):
                        try:
                            load_more = page.locator("text=/load more|show more|view more/i").first
                            if load_more.is_visible(timeout=1000):
                                load_more.click()
                                page.wait_for_timeout(2000)
                        except Exception:
                            break

                    found, new, updated = extract_events_from_page(
                        page, source_id, venue_cache, seen_events, cl_category
                    )
                    total_found += found
                    total_new += new
                    total_updated += updated

                    logger.info(f"  {url_label}: {found} events found, {new} new")

                except Exception as e:
                    logger.warning(f"Failed to fetch {url}: {e}")
                    continue

            browser.close()

        logger.info(
            f"Creative Loafing crawl complete: {total_found} found, {total_new} new, {total_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Creative Loafing: {e}")
        raise

    return total_found, total_new, total_updated
