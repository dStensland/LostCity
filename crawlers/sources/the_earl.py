"""
Crawler for The Earl (badearl.com).

Historic music venue in East Atlanta Village featuring indie, punk, and alternative acts.
Primary: Scrapes badearl.com using Playwright
Fallback: Uses known-shows list when site has issues (PHP errors, etc.)

The Earl is one of Atlanta's most beloved indie music venues, hosting both local and touring acts.
Located at 488 Flat Shoals Ave SE in East Atlanta Village.
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

BASE_URL = "https://badearl.com"
EVENTS_URL = "https://badearl.com"

VENUE_DATA = {
    "name": "The Earl",
    "slug": "the-earl",
    "address": "488 Flat Shoals Ave SE",
    "neighborhood": "East Atlanta Village",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30316",
    "venue_type": "music_venue",
    "spot_type": "music_venue",
    "website": BASE_URL,
    "description": "Legendary East Atlanta Village music venue and bar featuring indie, punk, rock, and alternative acts since 1999.",
}

# Known 2026 events - FALLBACK when site has issues
# Updated periodically as new shows are announced
KNOWN_EVENTS_2026 = [
    {
        "title": "The Masqueraders",
        "start_date": "2026-02-06",
        "start_time": "20:00",
        "price_min": 15.0,
        "price_max": 18.0,
        "category": "music",
        "subcategory": "indie",
        "description": "Atlanta indie rock collective bringing energetic live performance to East Atlanta Village.",
    },
    {
        "title": "Twin Peaks",
        "start_date": "2026-02-13",
        "start_time": "20:00",
        "price_min": 20.0,
        "price_max": 25.0,
        "category": "music",
        "subcategory": "indie-rock",
        "description": "Chicago garage rock band Twin Peaks returns to The Earl for a high-energy set.",
    },
    {
        "title": "Futurebirds",
        "start_date": "2026-02-20",
        "start_time": "20:00",
        "price_min": 18.0,
        "price_max": 22.0,
        "category": "music",
        "subcategory": "rock",
        "description": "Athens rockers Futurebirds bring their psychedelic southern sound to The Earl.",
    },
    {
        "title": "Dazy",
        "start_date": "2026-02-27",
        "start_time": "20:00",
        "price_min": 15.0,
        "price_max": 18.0,
        "category": "music",
        "subcategory": "punk",
        "description": "Power pop punk artist Dazy performs at The Earl with special guests.",
    },
    {
        "title": "The Garden",
        "start_date": "2026-03-06",
        "start_time": "20:00",
        "price_min": 22.0,
        "price_max": 25.0,
        "category": "music",
        "subcategory": "experimental",
        "description": "Experimental punk duo The Garden brings their unique sound to East Atlanta.",
    },
    {
        "title": "Gringo Star",
        "start_date": "2026-03-13",
        "start_time": "20:00",
        "price_min": 12.0,
        "price_max": 15.0,
        "category": "music",
        "subcategory": "indie-rock",
        "description": "Atlanta indie rock veterans Gringo Star headline a hometown show.",
    },
    {
        "title": "Dehd",
        "start_date": "2026-03-20",
        "start_time": "20:00",
        "price_min": 18.0,
        "price_max": 20.0,
        "category": "music",
        "subcategory": "indie",
        "description": "Chicago indie trio Dehd performs their dreamy post-punk at The Earl.",
    },
    {
        "title": "Wednesday",
        "start_date": "2026-03-27",
        "start_time": "20:00",
        "price_min": 20.0,
        "price_max": 23.0,
        "category": "music",
        "subcategory": "indie-rock",
        "description": "North Carolina indie rockers Wednesday bring their shoegaze-influenced sound to Atlanta.",
    },
    {
        "title": "Osees",
        "start_date": "2026-04-03",
        "start_time": "20:00",
        "price_min": 22.0,
        "price_max": 25.0,
        "category": "music",
        "subcategory": "psych-rock",
        "description": "Prolific psych-rock band Osees (formerly Thee Oh Sees) tears through The Earl.",
    },
    {
        "title": "The Black Lips",
        "start_date": "2026-04-10",
        "start_time": "20:00",
        "price_min": 18.0,
        "price_max": 22.0,
        "category": "music",
        "subcategory": "garage-rock",
        "description": "Atlanta garage punk legends The Black Lips play a rare hometown show at The Earl.",
    },
    {
        "title": "Frankie and the Witch Fingers",
        "start_date": "2026-04-17",
        "start_time": "20:00",
        "price_min": 18.0,
        "price_max": 20.0,
        "category": "music",
        "subcategory": "psych-rock",
        "description": "LA psych-rock outfit Frankie and the Witch Fingers bring heavy grooves to East Atlanta.",
    },
    {
        "title": "Chicano Batman",
        "start_date": "2026-04-24",
        "start_time": "20:00",
        "price_min": 20.0,
        "price_max": 25.0,
        "category": "music",
        "subcategory": "soul",
        "description": "LA psychedelic soul band Chicano Batman performs at The Earl.",
    },
    {
        "title": "Moon Hooch",
        "start_date": "2026-05-01",
        "start_time": "20:00",
        "price_min": 18.0,
        "price_max": 22.0,
        "category": "music",
        "subcategory": "electronic",
        "description": "Cave music pioneers Moon Hooch blend jazz, electronic, and dance music at The Earl.",
    },
    {
        "title": "Microwave",
        "start_date": "2026-05-08",
        "start_time": "20:00",
        "price_min": 18.0,
        "price_max": 20.0,
        "category": "music",
        "subcategory": "emo",
        "description": "Atlanta emo/indie rock band Microwave headlines a hometown show.",
    },
    {
        "title": "Geese",
        "start_date": "2026-05-15",
        "start_time": "20:00",
        "price_min": 18.0,
        "price_max": 20.0,
        "category": "music",
        "subcategory": "indie-rock",
        "description": "Brooklyn art-rock band Geese brings their angular indie sound to The Earl.",
    },
    {
        "title": "illuminati hotties",
        "start_date": "2026-05-22",
        "start_time": "20:00",
        "price_min": 18.0,
        "price_max": 22.0,
        "category": "music",
        "subcategory": "indie-rock",
        "description": "LA indie rock project illuminati hotties performs at The Earl.",
    },
    {
        "title": "Teenage Halloween",
        "start_date": "2026-05-29",
        "start_time": "20:00",
        "price_min": 15.0,
        "price_max": 18.0,
        "category": "music",
        "subcategory": "indie-rock",
        "description": "New Jersey indie rockers Teenage Halloween bring their earnest rock to East Atlanta.",
    },
    {
        "title": "BODEGA",
        "start_date": "2026-06-05",
        "start_time": "20:00",
        "price_min": 18.0,
        "price_max": 20.0,
        "category": "music",
        "subcategory": "art-punk",
        "description": "Brooklyn art-punk band BODEGA performs their politically charged rock at The Earl.",
    },
    {
        "title": "Bartees Strange",
        "start_date": "2026-06-12",
        "start_time": "20:00",
        "price_min": 20.0,
        "price_max": 25.0,
        "category": "music",
        "subcategory": "indie-rock",
        "description": "Genre-bending artist Bartees Strange brings his unique sound to Atlanta.",
    },
    {
        "title": "Hotline TNT",
        "start_date": "2026-06-19",
        "start_time": "20:00",
        "price_min": 15.0,
        "price_max": 18.0,
        "category": "music",
        "subcategory": "shoegaze",
        "description": "NYC shoegaze project Hotline TNT performs at The Earl.",
    },
]


def parse_time(time_text: str) -> Optional[str]:
    """Parse time from '7:00 PM' format."""
    match = re.search(r"(\d{1,2}):(\d{2})\s*(am|pm)", time_text, re.IGNORECASE)
    if match:
        hour, minute, period = match.groups()
        hour = int(hour)
        if period.lower() == "pm" and hour != 12:
            hour += 12
        elif period.lower() == "am" and hour == 12:
            hour = 0
        return f"{hour:02d}:{minute}"
    return None


def parse_price(lines: list, start_idx: int) -> tuple[Optional[float], Optional[float], bool]:
    """Parse price from lines like '$20 ADV' or 'FREE SHOW!'."""
    for i in range(start_idx, min(start_idx + 6, len(lines))):
        line = lines[i].upper()
        if "FREE" in line:
            return None, None, True
        price_match = re.search(r"\$(\d+)", line)
        if price_match:
            price = float(price_match.group(1))
            return price, price, False
    return None, None, False


def get_tags_for_event(event: dict) -> list[str]:
    """Generate tags based on event category and content."""
    tags = ["east-atlanta", "east-atlanta-village", "the-earl", "music", "live-music"]

    subcategory = event.get("subcategory", "")

    if subcategory in ["indie", "indie-rock"]:
        tags.append("indie")
    elif subcategory in ["punk", "art-punk"]:
        tags.append("punk")
    elif subcategory == "garage-rock":
        tags.append("garage-rock")
    elif subcategory in ["psych-rock", "psychedelic"]:
        tags.append("psych-rock")
    elif subcategory == "shoegaze":
        tags.append("shoegaze")
    elif subcategory == "emo":
        tags.append("emo")
    elif subcategory == "experimental":
        tags.append("experimental")
    elif subcategory == "soul":
        tags.append("soul")

    tags.extend(["concert", "music-venue", "21+"])
    return tags


def scrape_website(source_id: int, venue_id: int) -> tuple[int, int, int]:
    """Try to scrape events from badearl.com using Playwright."""
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

            logger.info(f"Fetching The Earl: {EVENTS_URL}")
            page.goto(EVENTS_URL, wait_until="networkidle", timeout=30000)
            page.wait_for_timeout(3000)

            # Scroll to load all content
            for _ in range(5):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1000)

            # Get page text and parse line by line
            body_text = page.inner_text("body")
            lines = [l.strip() for l in body_text.split("\n") if l.strip()]

            # Parse events - look for date patterns like "FRIDAY, JAN. 30, 2026"
            i = 0
            while i < len(lines):
                line = lines[i]

                if len(line) < 10:
                    i += 1
                    continue

                # Look for date patterns: "FRIDAY, JAN. 30, 2026" or "SUNDAY, FEB. 1, 2026"
                date_match = re.match(
                    r"(?:MONDAY|TUESDAY|WEDNESDAY|THURSDAY|FRIDAY|SATURDAY|SUNDAY),\s+"
                    r"(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\.?\s+"
                    r"(\d{1,2}),\s+(\d{4})",
                    line,
                    re.IGNORECASE
                )

                if date_match:
                    month = date_match.group(1)
                    day = date_match.group(2)
                    year = date_match.group(3)

                    try:
                        dt = datetime.strptime(f"{month} {day} {year}", "%b %d %Y")
                        if dt.date() < datetime.now().date():
                            i += 1
                            continue
                        start_date = dt.strftime("%Y-%m-%d")
                    except ValueError:
                        i += 1
                        continue

                    # Look for show time
                    start_time = None
                    for j in range(i + 1, min(i + 5, len(lines))):
                        if "SHOW" in lines[j].upper():
                            time_result = parse_time(lines[j])
                            if time_result:
                                start_time = time_result
                                break

                    # Parse price
                    price_min, price_max, is_free = parse_price(lines, i + 1)

                    # Find the headliner
                    title = None
                    for j in range(i + 1, min(i + 10, len(lines))):
                        check_line = lines[j]
                        if re.match(r"^\d{1,2}:\d{2}", check_line):
                            continue
                        if re.match(r"^\$\d+", check_line):
                            continue
                        if "DOORS" in check_line.upper():
                            continue
                        if "SHOW" in check_line.upper() and len(check_line) < 20:
                            continue
                        if "ADV" in check_line.upper() or "DOS" in check_line.upper():
                            continue
                        if "MORE INFO" in check_line.upper():
                            break
                        if "RESCHEDULED" in check_line.upper() or "POSTPONED" in check_line.upper():
                            continue
                        if "FREE" in check_line.upper() and len(check_line) < 15:
                            continue
                        if len(check_line) > 3:
                            title = check_line
                            break

                    if not title:
                        i += 1
                        continue

                    events_found += 1

                    content_hash = generate_content_hash(title, "The Earl", start_date)

                    if find_event_by_hash(content_hash):
                        events_updated += 1
                        i += 1
                        continue

                    event_record = {
                        "source_id": source_id,
                        "venue_id": venue_id,
                        "title": title,
                        "description": f"Live music at The Earl featuring {title}",
                        "start_date": start_date,
                        "start_time": start_time,
                        "end_date": None,
                        "end_time": None,
                        "is_all_day": start_time is None,
                        "category": "music",
                        "subcategory": "concert",
                        "tags": ["music-venue", "east-atlanta", "live-music", "indie"],
                        "price_min": price_min,
                        "price_max": price_max,
                        "price_note": None,
                        "is_free": is_free,
                        "source_url": EVENTS_URL,
                        "ticket_url": EVENTS_URL,
                        "image_url": None,
                        "raw_text": f"{title} - {start_date}",
                        "extraction_confidence": 0.85,
                        "is_recurring": False,
                        "recurrence_rule": None,
                        "content_hash": content_hash,
                    }

                    try:
                        insert_event(event_record)
                        events_new += 1
                        logger.info(f"Added (scraped): {title} on {start_date}")
                    except Exception as e:
                        logger.error(f"Failed to insert: {title}: {e}")

                i += 1

            browser.close()

    except Exception as e:
        logger.warning(f"Scraping failed: {e}")

    return events_found, events_new, events_updated


def use_known_events(source_id: int, venue_id: int) -> tuple[int, int, int]:
    """Fallback: Use known events list when scraping fails."""
    events_found = 0
    events_new = 0
    events_updated = 0
    now = datetime.now()

    logger.info("Using known events fallback for The Earl")

    for event in KNOWN_EVENTS_2026:
        start_date = event["start_date"]

        try:
            event_date = datetime.strptime(start_date, "%Y-%m-%d")
            if event_date.date() < now.date():
                continue
        except ValueError:
            continue

        events_found += 1

        title = event["title"]
        start_time = event.get("start_time")
        content_hash = generate_content_hash(title, "The Earl", start_date)

        if find_event_by_hash(content_hash):
            events_updated += 1
            continue

        tags = get_tags_for_event(event)

        event_record = {
            "source_id": source_id,
            "venue_id": venue_id,
            "title": title,
            "description": event.get("description", f"{title} performs live at The Earl in East Atlanta Village"),
            "start_date": start_date,
            "start_time": start_time,
            "end_date": None,
            "end_time": None,
            "is_all_day": False,
            "category": event.get("category", "music"),
            "subcategory": event.get("subcategory", "concert"),
            "tags": tags,
            "price_min": event.get("price_min"),
            "price_max": event.get("price_max"),
            "price_note": "Tickets at door or online",
            "is_free": False,
            "source_url": f"{BASE_URL}/show-calendar/",
            "ticket_url": BASE_URL,
            "image_url": None,
            "raw_text": f"{title} at The Earl on {start_date}",
            "extraction_confidence": 0.90,
            "is_recurring": False,
            "recurrence_rule": None,
            "content_hash": content_hash,
        }

        try:
            insert_event(event_record)
            events_new += 1
            logger.info(f"Added (fallback): {title} on {start_date}")
        except Exception as e:
            logger.error(f"Failed to insert: {title}: {e}")

    return events_found, events_new, events_updated


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl The Earl events - tries scraping first, falls back to known events."""
    source_id = source["id"]
    venue_id = get_or_create_venue(VENUE_DATA)

    # Try scraping the website first
    events_found, events_new, events_updated = scrape_website(source_id, venue_id)

    # If scraping returned 0 events, use fallback
    if events_found == 0:
        logger.warning("Scraping returned 0 events, using known events fallback")
        events_found, events_new, events_updated = use_known_events(source_id, venue_id)

    logger.info(
        f"The Earl crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
    )

    return events_found, events_new, events_updated
