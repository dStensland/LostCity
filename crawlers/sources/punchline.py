"""
Crawler for Punchline Comedy Club (punchline.com).
National touring comedy acts in Atlanta.

Crawls the /shows/ page which has inline comedian bios and images.
Paginates via ?offset=N (6 shows per page). No individual show detail
pages exist, so descriptions are extracted directly from the listings.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime
from typing import Optional

from playwright.sync_api import sync_playwright

from db import get_or_create_place, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash
from utils import extract_images_from_page

logger = logging.getLogger(__name__)

BASE_URL = "https://punchline.com"
SHOWS_URL = f"{BASE_URL}/shows/"
MAX_PAGES = 5  # 6 shows per page × 5 = 30 shows max

PLACE_DATA = {
    "name": "Punchline Comedy Club",
    "slug": "punchline-comedy-club",
    "address": "3652 Roswell Rd NE",
    "neighborhood": "Buckhead",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30342",
    "lat": 33.8762,
    "lng": -84.3803,
    "place_type": "comedy_club",
    "website": BASE_URL,
}

# Venue boilerplate patterns — reject descriptions containing these
BOILERPLATE_PATTERNS = [
    r"3652 Roswell",
    r"Atlanta's Number One",
    r"Atlanta's number one",
    r"comedy destination since 1982",
    r"Reservations are required",
    r"404.*252.*LAFF",
    r"404.*252.*5233",
    r"Upcoming Shows",
    r"Loading.*Loading.*Loading",
]


def _infer_showtime(start_date: str) -> str:
    """Infer start_time from day-of-week per Punchline's published schedule.

    Source: https://punchline.com/shows/ (schedule listed at top of page)
    Mon-Thu: 7:30PM (1 show)
    Fri: 7:30PM (first of 2)
    Sat: 6:00PM (first of 2-3)
    Sun: 7:00PM (first of 1-2)
    """
    dow = datetime.strptime(start_date, "%Y-%m-%d").weekday()  # 0=Mon
    if dow <= 4:  # Mon-Fri
        return "19:30"
    if dow == 5:  # Sat
        return "18:00"
    return "19:00"  # Sun


def parse_date_range(date_text: str) -> tuple[Optional[str], Optional[str]]:
    """Parse date from 'Mar 15 - 17' or 'Mar 15' format."""
    try:
        current_year = datetime.now().year

        today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)

        # Range: "Mar 15 - 17"
        range_match = re.match(r"(\w{3})\s+(\d+)\s*[-–]\s*(\d+)", date_text)
        if range_match:
            month, day1, day2 = range_match.groups()
            try:
                start = datetime.strptime(f"{month} {day1} {current_year}", "%b %d %Y")
                end = datetime.strptime(f"{month} {day2} {current_year}", "%b %d %Y")
                if start < today:
                    start = datetime.strptime(f"{month} {day1} {current_year + 1}", "%b %d %Y")
                    end = datetime.strptime(f"{month} {day2} {current_year + 1}", "%b %d %Y")
                return start.strftime("%Y-%m-%d"), end.strftime("%Y-%m-%d")
            except ValueError:
                pass

        # Single: "Mar 15"
        single_match = re.match(r"(\w{3})\s+(\d+)", date_text)
        if single_match:
            month, day = single_match.groups()
            try:
                dt = datetime.strptime(f"{month} {day} {current_year}", "%b %d %Y")
                if dt < today:
                    dt = datetime.strptime(f"{month} {day} {current_year + 1}", "%b %d %Y")
                return dt.strftime("%Y-%m-%d"), None
            except ValueError:
                pass

        return None, None
    except Exception:
        return None, None


def _is_boilerplate(text: str) -> bool:
    """Check if text contains venue boilerplate that shouldn't be a description."""
    for pattern in BOILERPLATE_PATTERNS:
        if re.search(pattern, text, re.IGNORECASE):
            return True
    return False


def _clean_description(raw: str) -> Optional[str]:
    """Clean up a raw description block extracted from the shows page."""
    if not raw or len(raw) < 20:
        return None

    # Remove HTML entities
    text = raw.replace("and#8203;", "").replace("&#8203;", "")

    # Remove social media handles and URLs at the end
    text = re.sub(r"\s*(Instagram|TikTok|Twitter|Facebook|YouTube|Socials)\s*[-–:]?\s*.*$",
                  "", text, flags=re.IGNORECASE | re.DOTALL)

    # Remove "For more info visit..." trailing text
    text = re.sub(r"\s*For more info\s+visit\s+.*$", "", text, flags=re.IGNORECASE | re.DOTALL)

    # Remove "VIP ACCESS TICKET..." preamble
    text = re.sub(r"^VIP ACCESS TICKET.*?(?:ADD-ON\.?\s*)", "", text, flags=re.IGNORECASE)

    # Remove "Click here..." links
    text = re.sub(r"Click here[^.]*\.\s*", "", text, flags=re.IGNORECASE)

    text = text.strip()
    if not text or len(text) < 20:
        return None

    # Truncate trailing "..." from page truncation
    if text.endswith("..."):
        text = text[:-3].strip()
        # Try to end at the last complete sentence
        last_period = text.rfind(".")
        if last_period > len(text) // 2:
            text = text[: last_period + 1]

    if _is_boilerplate(text):
        return None

    return text


def _parse_show_blocks(body_text: str) -> list[dict]:
    """Parse show blocks from the /shows/ page text.

    Each show is separated by "Buy Tickets!" and contains:
    - A date line like "Mar 4 | Atlanta" or "Mar 5 - 7 | Atlanta"
    - A title line (comedian name, sometimes with "- Subtitle")
    - Description text (comedian bio)
    """
    shows = []

    # Split by "Buy Tickets!" (the button text between show blocks)
    blocks = re.split(r"Buy Tickets!|BUY TICKETS", body_text, flags=re.IGNORECASE)

    for block in blocks:
        lines = [l.strip() for l in block.strip().split("\n") if l.strip()]
        if len(lines) < 2:
            continue

        date_text = None
        title = None
        description_lines = []

        for line in lines:
            # Date pattern: "Mar 4 | Atlanta" or "Mar 5 - 7 | Atlanta"
            date_match = re.match(
                r"(\w{3}\s+\d+(?:\s*[-–]\s*\d+)?)\s*\|\s*Atlanta", line
            )
            if date_match:
                date_text = date_match.group(1)
                continue

            if not title:
                # Title must come AFTER a date line
                if not date_text:
                    continue
                # Title: first line after date with reasonable length
                if len(line) > 3:
                    title = line
                    continue
            else:
                # After title: collect ALL remaining lines as description
                description_lines.append(line)

        if not title or not date_text:
            continue

        # Join description lines
        raw_desc = " ".join(description_lines).strip()
        description = _clean_description(raw_desc)

        shows.append({
            "date_text": date_text,
            "title": title,
            "description": description,
        })

    return shows


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Punchline events from the /shows/ page."""
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

            venue_id = get_or_create_place(PLACE_DATA)
            all_shows: list[dict] = []
            image_map: dict[str, str] = {}

            # Paginate through /shows/ pages
            for page_num in range(MAX_PAGES):
                offset = page_num * 6
                url = SHOWS_URL if offset == 0 else f"{SHOWS_URL}?offset={offset}"

                logger.info(f"Fetching Punchline shows page {page_num + 1}: {url}")
                page.goto(url, wait_until="domcontentloaded", timeout=30000)
                page.wait_for_timeout(3000)

                # Extract images from this page
                page_images = extract_images_from_page(page)
                image_map.update(page_images)

                body_text = page.inner_text("body")
                shows = _parse_show_blocks(body_text)

                if not shows:
                    logger.info(f"No shows found on page {page_num + 1}, stopping pagination")
                    break

                all_shows.extend(shows)

                has_more = "view more shows" in body_text.lower()
                logger.info(f"Page {page_num + 1}: found {len(shows)} shows, has_more={has_more}")

                # Stop if no "View More Shows" link
                if not has_more:
                    break

            logger.info(f"Total shows found across all pages: {len(all_shows)}")

            for show in all_shows:
                title = show["title"]
                date_text = show["date_text"]

                start_date, end_date = parse_date_range(date_text)
                if not start_date:
                    continue

                events_found += 1

                content_hash = generate_content_hash(
                    title, "Punchline Comedy Club", start_date
                )

                event_record = {
                    "source_id": source_id,
                    "place_id": venue_id,
                    "title": title,
                    "description": show["description"],
                    "start_date": start_date,
                    "start_time": _infer_showtime(start_date),
                    "end_date": end_date,
                    "end_time": None,
                    "is_all_day": False,
                    "category": "comedy",
                    "subcategory": "standup",
                    "tags": ["comedy", "standup", "punchline"],
                    "price_min": None,
                    "price_max": None,
                    "price_note": None,
                    "is_free": False,
                    "source_url": SHOWS_URL,
                    "ticket_url": None,
                    "image_url": image_map.get(title),
                    "raw_text": None,
                    "extraction_confidence": 0.9,
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
                    insert_event(event_record, genres=["comedy", "stand-up"])
                    events_new += 1
                    logger.info(f"Added: {title} on {start_date}")
                except Exception as e:
                    logger.error(f"Failed to insert: {title}: {e}")

            browser.close()

        logger.info(f"Punchline crawl complete: {events_found} found, {events_new} new, {events_updated} updated")

    except Exception as e:
        logger.error(f"Failed to crawl Punchline: {e}")
        raise

    return events_found, events_new, events_updated
