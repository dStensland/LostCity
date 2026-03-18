"""
Crawler for Georgia Metropolitan Dance Theatre (GMDT).
Youth ballet company founded 1956, based in Marietta, GA.
100+ dancers ages 7-18. Performs at Jennie T. Anderson Theatre.
~3 major productions per year.

Ticketing platform: Ludus (gmdt.ludus.com)
Ludus is a hosted ticketing platform. The homepage renders all upcoming shows
with showtimes as <div.showtimes_item data-showtime-id="..."> elements. Each
element's inner text contains the date string and time. A POST to
/v1/shows/seats-left returns availability keyed by showtime ID.

Strategy:
  1. Load gmdt.ludus.com with Playwright (Cloudflare-protected, needs JS).
  2. Parse show title + description from the .show_item block.
  3. Parse each .showtimes_item for date and time.
  4. Extract price range from the LEGEND block on the page.
  5. Create one event per performance.
"""

from __future__ import annotations

import logging
import re
from datetime import datetime
from typing import Optional

from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeoutError
from bs4 import BeautifulSoup

from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

LUDUS_URL = "https://gmdt.ludus.com"
SOURCE_URL = "https://georgiametrodance.org"

# Jennie T. Anderson Theatre — GMDT's primary performance venue
JTA_VENUE_DATA = {
    "name": "Jennie T. Anderson Theatre",
    "slug": "jennie-t-anderson-theatre",
    "address": "548 S Marietta Pkwy SE",
    "neighborhood": "Marietta",
    "city": "Marietta",
    "state": "GA",
    "zip": "30060",
    "lat": 33.9429,
    "lng": -84.5469,
    "venue_type": "theater",
    "spot_type": "theater",
    "website": "https://www.cobbcounty.org/parks/performing-arts/jennie-t-anderson-theatre",
    "vibes": ["all-ages", "family-friendly"],
}

MONTH_MAP = {
    "january": 1, "february": 2, "march": 3, "april": 4,
    "may": 5, "june": 6, "july": 7, "august": 8,
    "september": 9, "october": 10, "november": 11, "december": 12,
}


def _parse_showtime_datetime(date_text: str, time_text: str) -> tuple[Optional[str], Optional[str]]:
    """
    Parse date and time from Ludus showtime element text.

    date_text examples:  "Saturday, March 21, 2026"
    time_text examples:  "2:00 PM"  "7:30 PM"

    Returns ("YYYY-MM-DD", "HH:MM") or (None, None).
    """
    # Parse date: "DayName, Month DD, YYYY"
    date_match = re.search(
        r"(January|February|March|April|May|June|July|August|September|October|November|December)"
        r"\s+(\d{1,2}),?\s+(\d{4})",
        date_text,
        re.IGNORECASE,
    )
    if not date_match:
        return None, None

    month_name, day, year = date_match.groups()
    month = MONTH_MAP.get(month_name.lower())
    if not month:
        return None, None

    try:
        start_date = datetime(int(year), month, int(day)).strftime("%Y-%m-%d")
    except ValueError:
        return None, None

    # Parse time: "2:00 PM" or "7:30 PM"
    start_time = None
    time_match = re.search(r"(\d{1,2}):(\d{2})\s*(AM|PM)", time_text, re.IGNORECASE)
    if time_match:
        hour = int(time_match.group(1))
        minute = int(time_match.group(2))
        meridiem = time_match.group(3).upper()
        if meridiem == "PM" and hour != 12:
            hour += 12
        elif meridiem == "AM" and hour == 12:
            hour = 0
        start_time = f"{hour:02d}:{minute:02d}"

    return start_date, start_time


def _fetch_prices_from_seating_page(page, showtime_id: str) -> tuple[Optional[float], Optional[float]]:
    """
    Navigate to the Ludus seating selection page for a showtime and extract
    the ticket price tiers from the LEGEND block.

    The seating page (select.php) renders visible price labels like "$25 Seats",
    "$27.50 Seats", "$32.50 Seats", "$37.50 Seats".

    We click the showtime item to trigger form submission to select.php,
    then extract prices from the visible text.
    """
    try:
        page.click(f"#showtimes_item{showtime_id}")
        page.wait_for_timeout(3000)

        seating_text = page.inner_text("body")
        prices = re.findall(r"\$(\d+(?:\.\d+)?)", seating_text)
        if prices:
            float_prices = sorted(set(float(p) for p in prices if float(p) > 0))
            if float_prices:
                # Navigate back to main page for subsequent showtimes
                page.goto(LUDUS_URL, wait_until="domcontentloaded", timeout=20000)
                page.wait_for_timeout(2000)
                return float_prices[0], float_prices[-1]
    except Exception as e:
        logger.debug(f"GMDT: could not fetch seating page prices: {e}")

    # Navigate back regardless
    try:
        page.goto(LUDUS_URL, wait_until="domcontentloaded", timeout=20000)
        page.wait_for_timeout(2000)
    except Exception:
        pass

    return None, None


def _scrape_ludus_page(page) -> list[dict]:
    """
    Scrape GMDT's Ludus homepage for all upcoming performances.

    Returns list of raw performance dicts:
        {title, description, date, time, price_min, price_max, showtime_id, image_url}
    """
    performances: list[dict] = []
    seen: set[tuple[str, str]] = set()

    try:
        logger.info(f"GMDT: loading {LUDUS_URL}")
        page.goto(LUDUS_URL, wait_until="domcontentloaded", timeout=30000)
        page.wait_for_timeout(4000)

        html = page.content()
        soup = BeautifulSoup(html, "html.parser")
        # Price extraction: navigate to the seating page for the first showtime.
        # Prices are only visible after clicking a showtime (they load into select.php).
        # We fetch once from the first available showtime and reuse across all performances.
        price_min: Optional[float] = None
        price_max: Optional[float] = None

        # Extract show items (each is a production, may have multiple showtimes)
        show_items = soup.find_all(class_="show_item")
        if not show_items:
            logger.warning("GMDT: no .show_item elements found on page")
            return performances

        for show_item in show_items:
            # Show title: first non-nav text block with reasonable length
            title_el = show_item.find(class_="show_listing_title") or show_item.find("h1") or show_item.find("h2")
            if title_el:
                title = title_el.get_text(strip=True)
            else:
                # Fall back to data attribute or first meaningful text line
                title = show_item.get("data-show-id", "")
                for line in show_item.get_text().split("\n"):
                    line = line.strip()
                    if line and len(line) > 5 and len(line) < 200 and not re.match(r"^(Get Directions|Learn More|\$)", line):
                        title = line
                        break

            if not title:
                logger.debug("GMDT: could not determine show title, skipping")
                continue

            # Show description
            desc_el = show_item.find(class_="show_listing_description") or show_item.find("p")
            description = None
            if desc_el:
                description = desc_el.get_text(separator=" ", strip=True)[:600]

            # Show image — look for og:image or hero img in show block
            image_url = None
            img_el = show_item.find("img")
            if img_el:
                src = img_el.get("src") or img_el.get("data-src") or ""
                if src and "logo" not in src.lower():
                    image_url = src if src.startswith("http") else LUDUS_URL + src

            # Fallback to og:image
            if not image_url:
                og_image = soup.find("meta", property="og:image")
                if og_image:
                    image_url = og_image.get("content")

            # Extract showtimes within this show item
            showtime_divs = show_item.find_all(
                lambda tag: tag.name == "div"
                and tag.get("data-showtime-id")
            )

            if not showtime_divs:
                # Also search page-wide for showtimes (Ludus sometimes puts them outside show_item)
                showtime_divs = soup.find_all(
                    lambda tag: tag.name == "div"
                    and tag.get("data-showtime-id")
                )

            logger.debug(f"GMDT: found {len(showtime_divs)} showtimes for '{title}'")

            prices_fetched = False
            for showtime_div in showtime_divs:
                showtime_id = showtime_div.get("data-showtime-id", "")
                past_date = showtime_div.get("data-past-date", "0")
                if past_date == "1":
                    continue

                # Desktop copy has the cleaner date/time text
                desktop_copy = showtime_div.find(class_="desktop_copy")
                if desktop_copy:
                    spans = desktop_copy.find_all("span")
                    date_text = spans[0].get_text(strip=True) if spans else ""
                    time_text = spans[1].get_text(strip=True) if len(spans) > 1 else ""
                else:
                    # Fall back to raw text parsing
                    raw = showtime_div.get_text(" ", strip=True)
                    # Extract date/time by pattern
                    date_match = re.search(
                        r"((?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\w+day),?\s+"
                        r"((?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4})",
                        raw,
                        re.IGNORECASE,
                    )
                    date_text = date_match.group(0) if date_match else raw
                    time_match = re.search(r"\d{1,2}:\d{2}\s*(?:AM|PM)", raw, re.IGNORECASE)
                    time_text = time_match.group(0) if time_match else ""

                start_date, start_time = _parse_showtime_datetime(date_text, time_text)
                if not start_date:
                    logger.debug(f"GMDT: could not parse date from showtime {showtime_id}: '{date_text}' '{time_text}'")
                    continue

                # Skip past performances (belt-and-suspenders, data-past-date may be 0 for today)
                try:
                    if datetime.strptime(start_date, "%Y-%m-%d").date() < datetime.now().date():
                        continue
                except ValueError:
                    pass

                # Fetch prices from seating page on first valid showtime (reuse for all)
                if not prices_fetched and showtime_id:
                    price_min, price_max = _fetch_prices_from_seating_page(page, showtime_id)
                    prices_fetched = True
                    # Re-parse the show HTML since we navigated away and back
                    html = page.content()
                    soup = BeautifulSoup(html, "html.parser")
                    logger.debug(f"GMDT: fetched prices ${price_min}-${price_max} from seating page")

                key = (start_date, start_time or "")
                if key in seen:
                    continue
                seen.add(key)

                performances.append({
                    "title": title,
                    "description": description,
                    "date": start_date,
                    "time": start_time,
                    "price_min": price_min,
                    "price_max": price_max,
                    "showtime_id": showtime_id,
                    "image_url": image_url,
                    "ticket_url": LUDUS_URL,
                })

    except PlaywrightTimeoutError:
        logger.warning(f"GMDT: timeout loading {LUDUS_URL}")
    except Exception as e:
        logger.error(f"GMDT: error scraping Ludus page: {e}")

    return performances


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Georgia Metropolitan Dance Theatre performances from Ludus ticketing."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                user_agent=(
                    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
                ),
                viewport={"width": 1280, "height": 900},
            )
            page = context.new_page()

            # Ensure venue exists
            venue_id = get_or_create_venue(JTA_VENUE_DATA)

            performances = _scrape_ludus_page(page)
            browser.close()

        logger.info(f"GMDT: scraped {len(performances)} performances")

        for perf in performances:
            title = perf["title"]
            start_date = perf["date"]
            start_time = perf.get("time")

            # Build tags
            tags = ["gmdt", "ballet", "dance", "performing-arts", "marietta", "youth-ballet"]
            title_lower = title.lower()
            if "nutcracker" in title_lower:
                tags.extend(["nutcracker", "holiday", "family-friendly"])
            if "quixote" in title_lower:
                tags.extend(["classical-ballet", "don-quixote"])
            if "sleeping" in title_lower or "beauty" in title_lower:
                tags.extend(["classical-ballet", "tchaikovsky"])
            if "cinderella" in title_lower:
                tags.extend(["classical-ballet"])
            if "swan" in title_lower:
                tags.extend(["classical-ballet", "tchaikovsky"])

            # Include time in hash to distinguish matinee from evening on the same day
            hash_key = f"{title}|{start_time or ''}"
            content_hash = generate_content_hash(hash_key, JTA_VENUE_DATA["name"], start_date)
            events_found += 1

            event_record = {
                "source_id": source_id,
                "venue_id": venue_id,
                "title": title,
                "description": perf.get("description"),
                "start_date": start_date,
                "start_time": start_time,
                "end_date": None,
                "end_time": None,
                "is_all_day": False,
                "category": "theater",
                "subcategory": "ballet",
                "tags": tags,
                "price_min": perf.get("price_min"),
                "price_max": perf.get("price_max"),
                "price_note": None,
                "is_free": False,
                "source_url": SOURCE_URL,
                "ticket_url": LUDUS_URL,
                "image_url": perf.get("image_url"),
                "raw_text": f"{title} — {start_date} {start_time or ''}".strip(),
                "extraction_confidence": 0.93,
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
                logger.info(
                    f"GMDT: added '{title}' on {start_date} at {start_time} "
                    f"(Jennie T. Anderson Theatre)"
                )
            except Exception as e:
                logger.error(f"GMDT: failed to insert '{title}' on {start_date}: {e}")

    except Exception as e:
        logger.error(f"GMDT: crawl failed: {e}")
        raise

    logger.info(
        f"GMDT crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
    )
    return events_found, events_new, events_updated
