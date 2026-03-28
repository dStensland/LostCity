"""
Crawler for Atlanta Comedy Theater (atlcomedytheater.com).
Stand-up comedy club in Norcross, GA.

Site structure: Events listed on /norcross-tickets page.
Each event is a ShowClix link whose text includes the date prefix:
  "MMM DD TITLE", "MMM DD & DD TITLE", "MMM DD-DD TITLE",
  "MMM DD @ HHpm TITLE", "MMM DD&DD TITLE"
Prices appear on the line after the title: "25/35/VIP" or "$15.00"
"""

from __future__ import annotations

import re
import logging
from datetime import datetime
from typing import Optional

from playwright.sync_api import sync_playwright

from db import get_or_create_place, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://atlcomedytheater.com"
TICKETS_URL = f"{BASE_URL}/norcross-tickets"

# Page says: 4650 JIMMY CARTER BLVD SUITE 114B NORCROSS, GA. 30093
PLACE_DATA = {
    "name": "Atlanta Comedy Theater",
    "slug": "atlanta-comedy-theater",
    "address": "4650 Jimmy Carter Blvd Suite 114B",
    "neighborhood": "Norcross",
    "city": "Norcross",
    "state": "GA",
    "zip": "30093",
    "lat": 33.9168,
    "lng": -84.2592,
    "venue_type": "comedy_club",
    "spot_type": "comedy_club",
    "website": BASE_URL,
}

# Month abbreviations the site uses
MONTH_ABBREVS = {
    "JAN": "January", "FEB": "February", "MAR": "March", "APR": "April",
    "MAY": "May", "JUN": "June", "JUL": "July", "AUG": "August",
    "SEP": "September", "OCT": "October", "NOV": "November", "DEC": "December",
}

# Pattern: "MMM DD", "MMM DD & DD", "MMM DD-DD", "MMM DD&DD"
# Optionally followed by "@ HHpm" or "@ HH:MMpm"
DATE_PREFIX_RE = re.compile(
    r"^(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\s+"  # month abbrev
    r"(\d{1,2})"                                                  # start day
    r"(?:\s*[-&]\s*(\d{1,2}))?"                                  # optional end day
    r"(?:\s*@\s*(\d{1,2}(?::\d{2})?(?:AM|PM|am|pm)))?"          # optional time
    r"\s+(.+)$",                                                  # title
    re.IGNORECASE,
)

# Alternate form: "MMM DD & DD TITLE" where & separates days
ALT_DATE_RE = re.compile(
    r"^(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\s+"
    r"(\d{1,2})\s*&\s*(\d{1,2})\s+(.+)$",
    re.IGNORECASE,
)

PRICE_RE = re.compile(r"(\d+)/(\d+)(?:/VIP)?", re.IGNORECASE)
DOLLAR_PRICE_RE = re.compile(r"\$(\d+(?:\.\d+)?)")


def parse_link_date_title(link_text: str) -> tuple[Optional[str], Optional[str], Optional[str], str]:
    """
    Parse the ShowClix link text format into (start_date, end_date, start_time, title).
    Link text examples:
      "MAR 20 BIG PISTOL STARTER LIVE"
      "MAR 21 & 22 COUSIN TIERA"
      "APR 2-4 STEVE BROWN"
      "APR 17&18 CHARLESTON WHITE"
      "MAR 28 @ 10PM WHO AIN'T FUNNY?"
    """
    text = link_text.strip().upper()
    current_year = datetime.now().year

    # Try the main pattern (handles single day, range with -, and single & before title)
    m = DATE_PREFIX_RE.match(text)
    if not m:
        return None, None, None, link_text

    month_abbr, start_day_str, end_day_str, time_str, raw_title = m.groups()
    month_full = MONTH_ABBREVS.get(month_abbr.upper())
    if not month_full:
        return None, None, None, link_text

    # The site uses ALL CAPS for link text; apply title case for clean storage
    # Re-match on original text to grab the title portion, then normalize
    m2 = DATE_PREFIX_RE.match(link_text.strip())
    raw_title_orig = m2.group(5).strip() if m2 else raw_title
    # Title-case but preserve short words and quoted segments naturally
    title = raw_title_orig.title()

    start_day = int(start_day_str)
    end_day = int(end_day_str) if end_day_str else start_day

    try:
        start_dt = datetime.strptime(f"{month_full} {start_day} {current_year}", "%B %d %Y")
        end_dt = datetime.strptime(f"{month_full} {end_day} {current_year}", "%B %d %Y")
    except ValueError:
        return None, None, None, link_text

    # If dates are in the past, assume next year
    today = datetime.now().date()
    if start_dt.date() < today:
        start_dt = start_dt.replace(year=current_year + 1)
        end_dt = end_dt.replace(year=current_year + 1)

    start_date = start_dt.strftime("%Y-%m-%d")
    end_date = end_dt.strftime("%Y-%m-%d")

    # Parse optional inline time (e.g. "10PM", "3PM")
    start_time = None
    if time_str:
        time_str_clean = time_str.strip().upper()
        t_match = re.match(r"(\d{1,2})(?::(\d{2}))?(AM|PM)", time_str_clean)
        if t_match:
            hour, minute, meridiem = t_match.groups()
            hour = int(hour)
            minute = int(minute) if minute else 0
            if meridiem == "PM" and hour != 12:
                hour += 12
            elif meridiem == "AM" and hour == 12:
                hour = 0
            start_time = f"{hour:02d}:{minute:02d}"

    return start_date, end_date, start_time, title


def parse_price(block_text: str) -> tuple[Optional[float], Optional[float], Optional[str]]:
    """
    Parse price from block text.
    Formats: "25/35/VIP", "$15.00", "20/30/VIP", "50/60/VIP"
    Returns (price_min, price_max, price_note).
    """
    # "25/35/VIP" style
    m = PRICE_RE.search(block_text)
    if m:
        low, high = float(m.group(1)), float(m.group(2))
        price_note = None
        if "vip" in block_text.lower():
            price_note = "VIP available"
        return low, high, price_note

    # "$15.00" style
    m = DOLLAR_PRICE_RE.search(block_text)
    if m:
        price = float(m.group(1))
        return price, price, None

    return None, None, None


def determine_subcategory(title: str, block_text: str) -> str:
    """Infer subcategory from show title and description."""
    combined = (title + " " + block_text).lower()
    if "drag" in combined:
        return "drag"
    if "improv" in combined:
        return "improv"
    if "murder mystery" in combined or "dinner theater" in combined:
        return "variety"
    if "karaoke" in combined:
        return "variety"
    if "hip hop" in combined or "hip-hop" in combined:
        return "standup"
    return "standup"


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Atlanta Comedy Theater shows from the /norcross-tickets page."""
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
                    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                ),
                viewport={"width": 1920, "height": 1080},
            )
            page = context.new_page()

            venue_id = get_or_create_place(PLACE_DATA)

            logger.info(f"Fetching Atlanta Comedy Theater tickets page: {TICKETS_URL}")
            page.goto(TICKETS_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(4000)

            # Scroll to trigger lazy-loaded content
            for _ in range(3):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1000)

            # All ShowClix links; named links (non-empty text) carry the date + title
            all_links = page.query_selector_all('a[href*="showclix.com"]')

            seen_hrefs: set[str] = set()
            processed_titles: set[str] = set()

            for link in all_links:
                link_text = link.inner_text().strip()
                # Skip image-only links (no text)
                if not link_text:
                    continue

                href = link.get_attribute("href") or ""
                if not href:
                    continue

                # Deduplicate by ShowClix URL (same show may appear more than once)
                if href in seen_hrefs:
                    continue
                seen_hrefs.add(href)

                # Parse date + title from link text
                start_date, end_date, inline_time, title = parse_link_date_title(link_text)

                if not start_date or not title:
                    logger.debug(f"Could not parse date from link text: {link_text!r}")
                    continue

                # Deduplicate by title+date
                dedup_key = f"{title.lower()}|{start_date}"
                if dedup_key in processed_titles:
                    continue
                processed_titles.add(dedup_key)

                # Get event block text for description + price (two levels up)
                block_text = ""
                try:
                    parent = link.evaluate_handle("el => el.parentElement.parentElement")
                    el = parent.as_element()
                    if el:
                        block_text = el.inner_text().strip()
                except Exception:
                    pass

                # Extract description: remove the first two lines (title line + price line)
                description_lines = block_text.split("\n")
                # Skip lines that look like the title or price header
                desc_parts = []
                skip_count = 0
                for line in description_lines:
                    line = line.strip()
                    if not line:
                        continue
                    if skip_count < 2 and (
                        title.upper() in line.upper()
                        or re.match(r"^\$?\d+", line)
                    ):
                        skip_count += 1
                        continue
                    desc_parts.append(line)
                description = " ".join(desc_parts).strip() or f"{title} at Atlanta Comedy Theater"

                # Determine show time
                start_time = inline_time
                if not start_time:
                    # Look for time in description text
                    time_match = re.search(
                        r"(?:showtime|show)\s+(\d{1,2}(?::\d{2})?(?:am|pm))",
                        block_text,
                        re.IGNORECASE,
                    )
                    if time_match:
                        t = time_match.group(1).upper()
                        t_m = re.match(r"(\d{1,2})(?::(\d{2}))?(AM|PM)", t)
                        if t_m:
                            h, mn, mer = t_m.groups()
                            h = int(h)
                            mn = int(mn) if mn else 0
                            if mer == "PM" and h != 12:
                                h += 12
                            start_time = f"{h:02d}:{mn:02d}"
                    if not start_time:
                        # Default: most shows are at 8pm
                        start_time = "20:00"

                # Price parsing
                price_min, price_max, price_note = parse_price(block_text)

                # Tags
                combined_lower = (title + " " + block_text).lower()
                tags = ["atlanta-comedy-theater", "comedy", "norcross"]
                subcategory = determine_subcategory(title, block_text)
                tags.append(subcategory)
                if "drag" in combined_lower:
                    tags.append("drag")
                    tags.append("brunch")
                if "special engagement" in combined_lower:
                    tags.append("special-engagement")
                if "hip hop" in combined_lower or "hip-hop" in combined_lower:
                    tags.append("hip-hop")

                events_found += 1

                content_hash = generate_content_hash(title, "Atlanta Comedy Theater", start_date)

                # Series hint for multi-night runs
                series_hint = None
                if end_date and end_date != start_date:
                    series_hint = {
                        "series_type": "other",
                        "series_title": title,
                        "description": description,
                    }

                event_record = {
                    "source_id": source_id,
                    "venue_id": venue_id,
                    "title": title,
                    "description": description,
                    "start_date": start_date,
                    "start_time": start_time,
                    "end_date": end_date if end_date != start_date else None,
                    "end_time": None,
                    "is_all_day": False,
                    "category": "comedy",
                    "subcategory": subcategory,
                    "tags": tags,
                    "price_min": price_min,
                    "price_max": price_max,
                    "price_note": price_note,
                    "is_free": False,
                    "source_url": TICKETS_URL,
                    "ticket_url": href,
                    "image_url": None,
                    "raw_text": block_text[:500],
                    "extraction_confidence": 0.88,
                    "is_recurring": False,
                    "recurrence_rule": None,
                    "content_hash": content_hash,
                }

                existing = find_event_by_hash(content_hash)
                if existing:
                    smart_update_existing_event(existing, event_record)
                    events_updated += 1
                    logger.debug(f"Updated: {title} ({start_date})")
                    continue

                try:
                    insert_event(event_record, series_hint=series_hint)
                    events_new += 1
                    logger.info(f"Added: {title} ({start_date}{'–' + end_date if end_date != start_date else ''})")
                except Exception as e:
                    logger.error(f"Failed to insert {title!r}: {e}")

            browser.close()

        logger.info(
            f"Atlanta Comedy Theater crawl complete: "
            f"{events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Atlanta Comedy Theater: {e}")
        raise

    return events_found, events_new, events_updated
