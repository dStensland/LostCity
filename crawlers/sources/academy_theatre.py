"""
Crawler for Academy Theatre (academytheatre.org).
Atlanta's longest-running professional theater, located in Hapeville, GA (near airport).
Founded 1956. Produces main stage shows, special events, variety series, and film series.

Site structure: Shows listed at /upcoming-shows/ as WordPress post cards with
individual event pages at /event/<slug>/. Uses SimpleTix for ticketing.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime
from typing import Optional

from playwright.sync_api import sync_playwright

from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://academytheatre.org"
SHOWS_URL = f"{BASE_URL}/upcoming-shows/"

VENUE_DATA = {
    "name": "Academy Theatre",
    "slug": "academy-theatre",
    "address": "599 N Central Ave",
    "neighborhood": "Hapeville",
    "city": "Hapeville",
    "state": "GA",
    "zip": "30354",
    "lat": 33.6613,
    "lng": -84.4063,
    "venue_type": "theater",
    "spot_type": "theater",
    "website": BASE_URL,
    "vibes": ["theater", "eclectic"],
}

SKIP_TITLES = {
    "upcoming shows",
    "browse all events on simpletix.com",
    "donate today",
    "season & flex passes",
    "resident companies",
    "thanks to our sponsors!",
    "become a sponsor",
    "volunteer",
    "audition",
    "become an intern",
    "join our mailing list",
    "show me: all shows main stage shows special events sunday variety series film series script readings",
}

SKIP_PATTERNS = [
    r"^(back to top|learn more|read more|show me).*",
    r"^(facebook|twitter|instagram|youtube)$",
    r"^(privacy|terms|copyright|site credits).*",
]

# Skip camp/workshop events (not public performances)
SKIP_CONTENT_PATTERNS = [
    r"\bcamp\b",
    r"\bworkshop\b",
    r"\bclass\b",
]


def is_valid_show_title(title: str) -> bool:
    """Reject nav/boilerplate text."""
    if not title or len(title) < 3 or len(title) > 200:
        return False
    title_lower = title.lower().strip()
    if title_lower in SKIP_TITLES:
        return False
    for pattern in SKIP_PATTERNS:
        if re.match(pattern, title_lower, re.IGNORECASE):
            return False
    return True


def is_event_content(title: str) -> bool:
    """True if this looks like a public performance vs camp/class."""
    title_lower = title.lower()
    for pattern in SKIP_CONTENT_PATTERNS:
        if re.search(pattern, title_lower):
            return False
    return True


def parse_event_date(date_text: str) -> tuple[Optional[str], Optional[str], Optional[str]]:
    """
    Parse date strings from Academy Theatre show cards.

    Formats:
    - "March 22, 2026 @ 6:30PM"  -> single date with time
    - "March 28 - April 5, 2026" -> date range
    - "April 25, 2026 @ 7:30PM"  -> single date with time
    - "June 8 - 12, 2026"        -> same-month range

    Returns (start_date, end_date, start_time) as YYYY-MM-DD strings.
    """
    if not date_text:
        return None, None, None

    date_text = date_text.strip()

    # Extract time if present
    time_match = re.search(r"@\s*(\d{1,2}:\d{2})\s*(AM|PM)", date_text, re.IGNORECASE)
    start_time = None
    if time_match:
        time_str = time_match.group(1)
        ampm = time_match.group(2).upper()
        try:
            dt = datetime.strptime(f"{time_str} {ampm}", "%I:%M %p")
            start_time = dt.strftime("%H:%M")
        except ValueError:
            pass

    # Cross-month range: "March 28 - April 5, 2026"
    cross_month = re.search(
        r"(January|February|March|April|May|June|July|August|September|October|November|December)"
        r"\s+(\d{1,2})\s*[-–—]\s*"
        r"(January|February|March|April|May|June|July|August|September|October|November|December)"
        r"\s+(\d{1,2}),?\s*(\d{4})",
        date_text,
        re.IGNORECASE,
    )
    if cross_month:
        start_month, start_day, end_month, end_day, year = cross_month.groups()
        try:
            start_dt = datetime.strptime(f"{start_month} {start_day} {year}", "%B %d %Y")
            end_dt = datetime.strptime(f"{end_month} {end_day} {year}", "%B %d %Y")
            return start_dt.strftime("%Y-%m-%d"), end_dt.strftime("%Y-%m-%d"), start_time
        except ValueError:
            pass

    # Same-month range: "June 8 - 12, 2026"
    same_month = re.search(
        r"(January|February|March|April|May|June|July|August|September|October|November|December)"
        r"\s+(\d{1,2})\s*[-–—]\s*(\d{1,2}),?\s*(\d{4})",
        date_text,
        re.IGNORECASE,
    )
    if same_month:
        month, start_day, end_day, year = same_month.groups()
        try:
            start_dt = datetime.strptime(f"{month} {start_day} {year}", "%B %d %Y")
            end_dt = datetime.strptime(f"{month} {end_day} {year}", "%B %d %Y")
            return start_dt.strftime("%Y-%m-%d"), end_dt.strftime("%Y-%m-%d"), start_time
        except ValueError:
            pass

    # Single date: "March 22, 2026"
    single = re.search(
        r"(January|February|March|April|May|June|July|August|September|October|November|December)"
        r"\s+(\d{1,2}),?\s*(\d{4})",
        date_text,
        re.IGNORECASE,
    )
    if single:
        month, day, year = single.groups()
        try:
            dt = datetime.strptime(f"{month} {day} {year}", "%B %d %Y")
            date_str = dt.strftime("%Y-%m-%d")
            return date_str, date_str, start_time
        except ValueError:
            pass

    return None, None, None


def classify_event(title: str, event_url: str) -> tuple[str, str, list[str]]:
    """Return (category, subcategory, tags) for an Academy Theatre event."""
    title_lower = title.lower()
    url_lower = event_url.lower()

    tags = ["academy-theatre", "theater", "hapeville", "professional-theater"]

    if "sunday-variety" in url_lower or "variety" in title_lower:
        tags.append("variety")
        return "theater", "variety_show", tags

    if "film" in title_lower or "film-series" in url_lower:
        tags.append("film")
        return "film", "screening", tags

    if "script-reading" in url_lower or "reading" in title_lower:
        tags.append("script-reading")
        return "theater", "reading", tags

    if any(w in title_lower for w in ["musical", "concert", "mccartney", "playlist", "songs"]):
        tags.append("musical")
        return "theater", "musical", tags

    if "comedy" in title_lower:
        tags.append("comedy")
        return "theater", "comedy", tags

    return "theater", "play", tags


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Academy Theatre upcoming shows."""
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

            logger.info(f"Fetching Academy Theatre shows: {SHOWS_URL}")
            page.goto(SHOWS_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(3000)

            # Academy Theatre uses Elementor — each show is a 3-element block:
            # heading (title), text (date), button (LEARN MORE -> event URL).
            # The simplest reliable approach is to:
            # 1. Get all LEARN MORE links (one per show)
            # 2. Pair each with the title+date text visible just above it in the body

            learn_links = page.query_selector_all('a:has-text("LEARN MORE")')
            logger.info(f"Found {len(learn_links)} show links")

            # Also get full body text to extract titles+dates by position
            body_text = page.inner_text("body")

            # Build a map: event_url -> (title, date_text)
            # Parse body_text: pattern is title line, date line, "LEARN MORE"
            lines = [ln.strip() for ln in body_text.split("\n") if ln.strip()]
            # Find all LEARN MORE positions and work backwards for title+date
            show_entries = []
            for idx, line in enumerate(lines):
                if line == "LEARN MORE":
                    # Look back 2 lines: idx-1 = date, idx-2 = title
                    if idx >= 2:
                        potential_title = lines[idx - 2]
                        potential_date = lines[idx - 1]
                    elif idx >= 1:
                        potential_title = lines[idx - 1]
                        potential_date = ""
                    else:
                        continue
                    show_entries.append((potential_title, potential_date, idx))

            # Match show_entries to learn_links by order
            for entry_idx, (title, date_text, _) in enumerate(show_entries):
                try:
                    if not is_valid_show_title(title) or not is_event_content(title):
                        continue

                    start_date, end_date, start_time = parse_event_date(date_text)
                    if not start_date:
                        logger.debug(f"No date found for: {title} (raw: {date_text!r})")
                        continue

                    # Skip past shows
                    check_date = end_date or start_date
                    try:
                        if datetime.strptime(check_date, "%Y-%m-%d").date() < datetime.now().date():
                            logger.debug(f"Skipping past show: {title}")
                            continue
                    except ValueError:
                        pass

                    # Get the LEARN MORE link URL for this show
                    event_url = SHOWS_URL
                    if entry_idx < len(learn_links):
                        href = learn_links[entry_idx].get_attribute("href")
                        if href and href.startswith("http"):
                            event_url = href

                    events_found += 1

                    # Fetch individual event page for description, image, ticket URL
                    description = None
                    image_url = None
                    ticket_url = None

                    try:
                        event_page = context.new_page()
                        event_page.goto(event_url, wait_until="domcontentloaded", timeout=20000)
                        event_page.wait_for_timeout(2000)

                        # Get og:image
                        og_img = event_page.query_selector('meta[property="og:image"]')
                        if og_img:
                            image_url = og_img.get_attribute("content")

                        # Get description from page body text
                        event_body = event_page.inner_text("body")
                        event_lines = [ln.strip() for ln in event_body.split("\n") if ln.strip()]
                        desc_lines = []
                        for ln in event_lines:
                            # Skip nav, title, date, and boilerplate lines
                            if ln in {"DONATE NOW", "AUDITIONS", "BACK TO TOP", "BUY TICKETS",
                                      "SEASON TICKETS", "SEATING MAP", "VOLUNTEER", title}:
                                continue
                            if re.search(
                                r"(January|February|March|April|May|June|July|August|September|"
                                r"October|November|December)\s+\d{1,2}",
                                ln, re.IGNORECASE
                            ):
                                continue
                            if re.match(r"^(Skip to|Facebook|Twitter|Instagram|Youtube|©|Box Office|599)", ln):
                                continue
                            if len(ln) > 40:
                                desc_lines.append(ln)
                            if len(desc_lines) >= 3:
                                break
                        if desc_lines:
                            description = " ".join(desc_lines)[:500]

                        # Find SimpleTix or other ticket links
                        tix_link = event_page.query_selector('a[href*="simpletix"], a[href*="ticket"]')
                        if tix_link:
                            ticket_url = tix_link.get_attribute("href")

                        # Also look for BUY TICKETS link
                        buy_link = event_page.query_selector('a:has-text("BUY TICKETS"), a:has-text("Buy Tickets")')
                        if buy_link and not ticket_url:
                            ticket_url = buy_link.get_attribute("href")

                        event_page.close()
                    except Exception as e:
                        logger.debug(f"Could not fetch event detail for {title}: {e}")

                    category, subcategory, tags = classify_event(title, event_url)

                    content_hash = generate_content_hash(title, "Academy Theatre", start_date)

                    series_hint = None
                    if end_date and end_date != start_date:
                        series_hint = {
                            "series_type": "recurring_show",
                            "series_title": title,
                        }
                        if description:
                            series_hint["description"] = description
                        if image_url:
                            series_hint["image_url"] = image_url

                    event_record = {
                        "source_id": source_id,
                        "venue_id": venue_id,
                        "title": title,
                        "description": description or f"{title} at Academy Theatre",
                        "start_date": start_date,
                        "start_time": start_time or "19:30",
                        "end_date": end_date,
                        "end_time": None,
                        "is_all_day": False,
                        "category": category,
                        "subcategory": subcategory,
                        "tags": tags,
                        "price_min": None,
                        "price_max": None,
                        "price_note": None,
                        "is_free": False,
                        "source_url": event_url,
                        "ticket_url": ticket_url or event_url,
                        "image_url": image_url,
                        "raw_text": f"{title} {date_text}"[:300],
                        "extraction_confidence": 0.88,
                        "is_recurring": True if end_date and end_date != start_date else False,
                        "recurrence_rule": None,
                        "content_hash": content_hash,
                    }

                    existing = find_event_by_hash(content_hash)
                    if existing:
                        smart_update_existing_event(existing, event_record)
                        events_updated += 1
                        continue

                    try:
                        insert_event(event_record, series_hint=series_hint)
                        events_new += 1
                        logger.info(f"Added: {title} ({start_date} to {end_date})")
                    except Exception as e:
                        logger.error(f"Failed to insert {title}: {e}")

                except Exception as e:
                    logger.warning(f"Error processing show card: {e}")
                    continue

            browser.close()

        logger.info(
            f"Academy Theatre crawl complete: {events_found} found, "
            f"{events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Academy Theatre: {e}")
        raise

    return events_found, events_new, events_updated
