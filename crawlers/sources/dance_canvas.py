"""
Crawler for Dance Canvas (dancecanvas.com).
Contemporary dance company and choreographic incubator in Atlanta.
Known for the annual "Introducing the Next Generation" performance series at Rialto Center.

Site structure:
  - dancecanvas.com (Wix site) — homepage shows upcoming events with ticket links to Rialto
  - Ticket sales via Rialto Center events system: events.rialtocenter.gsu.edu/online/article/canvas[YY]

Strategy:
  - Use Playwright to render the homepage, which lists upcoming events with purchase links
  - For each Rialto ticket link found, fetch that Rialto page to get exact dates/times/titles
  - Also scan the /events page for any additional upcoming events
  - Company is a touring/incubator org — Rialto Center is their primary home stage

Typical yield: 2-4 events/year (annual 2-night series + occasional film screenings)
"""

from __future__ import annotations

import logging
import re
from datetime import datetime
from typing import Optional

from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeoutError

from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://www.dancecanvas.com"
RIALTO_EVENTS_BASE = "https://events.rialtocenter.gsu.edu"

# Dance Canvas primary performance venue — Rialto Center for the Arts
RIALTO_VENUE_DATA = {
    "name": "Rialto Center for the Arts",
    "slug": "rialto-center-for-the-arts",
    "address": "80 Forsyth St NW",
    "neighborhood": "Downtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30303",
    "lat": 33.7497,
    "lng": -84.3884,
    "venue_type": "theater",
    "spot_type": "theater",
    "website": "https://rialto.gsu.edu",
    "vibes": ["all-ages"],
}

# Dance Canvas org venue for events without a specific performance venue
DANCE_CANVAS_ORG_VENUE_DATA = {
    "name": "Dance Canvas",
    "slug": "dance-canvas-atl",
    "address": "Atlanta, GA",
    "neighborhood": "Atlanta",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30308",
    "lat": 33.7490,
    "lng": -84.3880,
    "venue_type": "organization",
    "spot_type": "theater",
    "website": BASE_URL,
    "vibes": ["artsy"],
}


def _parse_rialto_datetime(text: str) -> tuple[Optional[str], Optional[str]]:
    """
    Parse Rialto Center date/time from text like:
    "Friday, March 20, 2026 - 8:00 PM"
    "Start DateFriday, March 20, 2026 - 8:00 PM"

    Returns (start_date, start_time) as ("YYYY-MM-DD", "HH:MM") or (None, None).
    """
    # Clean up "Start Date" prefix
    text = re.sub(r"^Start\s*Date\s*", "", text.strip(), flags=re.IGNORECASE)

    match = re.search(
        r"(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s+"
        r"(January|February|March|April|May|June|July|August|September|October|November|December)\s+"
        r"(\d{1,2}),?\s+(\d{4})\s*[-–]\s*(\d{1,2}):(\d{2})\s*(AM|PM)",
        text,
        re.IGNORECASE,
    )

    if match:
        month, day, year, hour, minute, meridiem = match.groups()
        try:
            dt = datetime.strptime(f"{month} {day} {year}", "%B %d %Y")
            start_date = dt.strftime("%Y-%m-%d")

            hour_int = int(hour)
            if meridiem.upper() == "PM" and hour_int != 12:
                hour_int += 12
            elif meridiem.upper() == "AM" and hour_int == 12:
                hour_int = 0

            start_time = f"{hour_int:02d}:{minute}"
            return start_date, start_time
        except ValueError:
            pass

    return None, None


def _is_future_date(date_str: str) -> bool:
    """Return True if date_str (YYYY-MM-DD) is today or in the future."""
    try:
        return datetime.strptime(date_str, "%Y-%m-%d").date() >= datetime.now().date()
    except ValueError:
        return False


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Dance Canvas events via Playwright — homepage + Rialto ticket pages."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    rialto_venue_id = get_or_create_venue(RIALTO_VENUE_DATA)
    org_venue_id = get_or_create_venue(DANCE_CANVAS_ORG_VENUE_DATA)

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                user_agent=(
                    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                ),
                viewport={"width": 1280, "height": 900},
            )
            page = context.new_page()

            # --- Step 1: Load homepage and extract Rialto ticket links ---
            logger.info(f"Dance Canvas: fetching homepage {BASE_URL}")
            try:
                page.goto(BASE_URL, wait_until="domcontentloaded", timeout=30000)
                page.wait_for_timeout(3000)
            except PlaywrightTimeoutError:
                logger.warning("Dance Canvas: homepage timed out, proceeding with partial load")

            # Collect Rialto event article URLs from homepage
            rialto_article_urls: set[str] = set()
            links = page.query_selector_all("a[href]")
            for link in links:
                href = link.get_attribute("href") or ""
                # Rialto article pages: events.rialtocenter.gsu.edu/online/article/...
                if "rialtocenter.gsu.edu/online/article/" in href:
                    rialto_article_urls.add(href)

            logger.info(f"Dance Canvas: found {len(rialto_article_urls)} Rialto article links")

            # --- Step 2: For each Rialto article, extract event dates/details ---
            for article_url in rialto_article_urls:
                try:
                    logger.debug(f"Dance Canvas: fetching Rialto article {article_url}")
                    page.goto(article_url, wait_until="domcontentloaded", timeout=20000)
                    page.wait_for_timeout(2000)

                    body_text = page.inner_text("body")
                    body_text_clean = re.sub(r"\s+", " ", body_text)

                    # Get description from the article text (skip header/footer boilerplate)
                    # Description is typically the paragraphs below the event listings
                    desc_match = re.search(
                        r"(Dance Canvas['\u2019]?\s+(?:acclaimed|annual|returns).{100,600})",
                        body_text_clean,
                        re.IGNORECASE,
                    )
                    description = desc_match.group(1).strip()[:600] if desc_match else None

                    # Extract all event listings.
                    # Rialto format: "TITLE Start DateDAYOFWEEK, Month D, YEAR - H:MM PM ... Buy"
                    # e.g. '2026 Performance Series - "Introducing..." Start DateFriday, March 20, 2026 - 8:00 PM'
                    # Strategy: locate each "Start Date..." match, then look back to find the title.
                    event_blocks: list[tuple[str, str]] = []
                    for sd_match in re.finditer(
                        r"Start\s*Date\s*((?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)"
                        r",?\s+(?:January|February|March|April|May|June|July|August|"
                        r"September|October|November|December)\s+\d{1,2},?\s+\d{4}[^A-Z]{0,20}(?:AM|PM))",
                        body_text_clean,
                        re.IGNORECASE,
                    ):
                        date_text = sd_match.group(1).strip()
                        # Look back up to 300 chars for a title
                        lookback = body_text_clean[max(0, sd_match.start() - 300): sd_match.start()]
                        # Title comes after last "Buy " separator or start of nav text
                        # Split on "Buy" (end of previous event listing) to get the most recent chunk
                        chunks = re.split(r"\bBuy\b|\bEvent Dates\b", lookback, flags=re.IGNORECASE)
                        raw_title = chunks[-1].strip() if chunks else ""
                        # Remove Rialto location noise
                        raw_title = re.sub(r"\s*Rialto Center.*$", "", raw_title, flags=re.IGNORECASE).strip()
                        raw_title = re.sub(r"\s*presented by.*$", "", raw_title, flags=re.IGNORECASE).strip()
                        raw_title = re.sub(r"^from\s+to\s+", "", raw_title, flags=re.IGNORECASE).strip()
                        if not raw_title or len(raw_title) < 5:
                            raw_title = "Dance Canvas Performance"
                        event_blocks.append((raw_title, date_text))

                    for raw_title, date_text in event_blocks:
                        # Clean title
                        title = raw_title.strip().strip('"').strip()
                        # Remove "Rialto Center for the Arts, Atlanta" if present
                        title = re.sub(r"\s*Rialto Center.*$", "", title).strip()
                        # Remove "presented by..." suffixes
                        title = re.sub(r"\s*presented by.*$", "", title, flags=re.IGNORECASE).strip()

                        if not title or len(title) < 5:
                            title = "Dance Canvas Performance"

                        start_date, start_time = _parse_rialto_datetime(date_text)
                        if not start_date:
                            logger.debug(f"Dance Canvas: could not parse date from '{date_text}'")
                            continue

                        if not _is_future_date(start_date):
                            logger.debug(f"Dance Canvas: skipping past event '{title}' on {start_date}")
                            continue

                        events_found += 1
                        content_hash = generate_content_hash(title, "Rialto Center for the Arts", start_date)

                        event_record = {
                            "source_id": source_id,
                            "venue_id": rialto_venue_id,
                            "title": title,
                            "description": description,
                            "start_date": start_date,
                            "start_time": start_time,
                            "end_date": None,
                            "end_time": None,
                            "is_all_day": False,
                            "category": "theater",
                            "subcategory": "dance",
                            "tags": ["dance-canvas", "dance", "contemporary-dance", "performing-arts"],
                            "price_min": None,
                            "price_max": None,
                            "price_note": None,
                            "is_free": False,
                            "source_url": BASE_URL,
                            "ticket_url": article_url,
                            "image_url": None,
                            "raw_text": f"{title} — {date_text}",
                            "extraction_confidence": 0.88,
                            "is_recurring": False,
                            "recurrence_rule": None,
                            "content_hash": content_hash,
                        }

                        existing = find_event_by_hash(content_hash)
                        if existing:
                            smart_update_existing_event(existing, event_record)
                            events_updated += 1
                        else:
                            try:
                                insert_event(event_record)
                                events_new += 1
                                logger.info(
                                    f"Dance Canvas: added '{title}' on {start_date} at {start_time}"
                                )
                            except Exception as e:
                                logger.error(f"Dance Canvas: failed to insert '{title}': {e}")

                except PlaywrightTimeoutError:
                    logger.warning(f"Dance Canvas: timed out fetching {article_url}")
                except Exception as e:
                    logger.error(f"Dance Canvas: error processing {article_url}: {e}")

            # --- Step 3: Also scan homepage body text for any direct upcoming event mentions ---
            # Re-load homepage if we already navigated away
            try:
                page.goto(BASE_URL, wait_until="domcontentloaded", timeout=25000)
                page.wait_for_timeout(3000)
                home_text = re.sub(r"\s+", " ", page.inner_text("body"))

                # Look for "Dance Canvas: on Film" screening dates not already captured
                film_dates = re.findall(
                    r"(?:Dance Canvas[:\s]+on Film|Film Screening)[^.]*?"
                    r"(\w+ \d+(?:st|nd|rd|th)?,?\s*\d{4})",
                    home_text,
                    re.IGNORECASE,
                )
                for date_text in film_dates:
                    # Simple month-day-year parse
                    for fmt in ["%B %d, %Y", "%B %dth, %Y", "%B %dst, %Y", "%B %dnd, %Y", "%B %drd, %Y"]:
                        clean = re.sub(r"(st|nd|rd|th)", "", date_text)
                        try:
                            dt = datetime.strptime(clean.strip(), "%B %d, %Y")
                            start_date = dt.strftime("%Y-%m-%d")
                            if not _is_future_date(start_date):
                                continue
                            title = "Dance Canvas: On Film"
                            content_hash = generate_content_hash(title, "Dance Canvas", start_date)
                            if find_event_by_hash(content_hash):
                                break  # Already have it
                            events_found += 1
                            event_record = {
                                "source_id": source_id,
                                "venue_id": org_venue_id,
                                "title": title,
                                "description": "Dance Canvas: On Film — a curated film screening series presented by Dance Canvas.",
                                "start_date": start_date,
                                "start_time": None,
                                "end_date": None,
                                "end_time": None,
                                "is_all_day": False,
                                "category": "theater",
                                "subcategory": "dance",
                                "tags": ["dance-canvas", "dance", "contemporary-dance", "film", "performing-arts"],
                                "price_min": None,
                                "price_max": None,
                                "price_note": None,
                                "is_free": False,
                                "source_url": BASE_URL,
                                "ticket_url": BASE_URL,
                                "image_url": None,
                                "raw_text": f"Dance Canvas: on Film — {date_text}",
                                "extraction_confidence": 0.75,
                                "is_recurring": False,
                                "recurrence_rule": None,
                                "content_hash": content_hash,
                            }
                            insert_event(event_record)
                            events_new += 1
                            logger.info(f"Dance Canvas: added film screening on {start_date}")
                            break
                        except ValueError:
                            continue

            except Exception as e:
                logger.warning(f"Dance Canvas: error scanning homepage for film events: {e}")

            browser.close()

    except Exception as e:
        logger.error(f"Dance Canvas: crawl failed: {e}")
        raise

    logger.info(
        f"Dance Canvas crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
    )
    return events_found, events_new, events_updated
