"""
Crawler for Alliance Theatre (alliancetheatre.org/shows).
Atlanta's flagship theater company at Woodruff Arts Center.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime
from typing import Optional

from playwright.sync_api import sync_playwright

from db import get_or_create_venue, insert_event, find_event_by_hash
from dedupe import generate_content_hash
from utils import extract_images_from_page

logger = logging.getLogger(__name__)

BASE_URL = "https://www.alliancetheatre.org"
SHOWS_URL = f"{BASE_URL}/shows/"

VENUE_DATA = {
    "name": "Alliance Theatre",
    "slug": "alliance-theatre",
    "address": "1280 Peachtree St NE",
    "neighborhood": "Midtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30309",
    "venue_type": "theater",
    "website": BASE_URL,
}

# Date pattern: MM/DD/YYYY – MM/DD/YYYY or MM/DD/YYYY
DATE_PATTERN = re.compile(r"(\d{2}/\d{2}/\d{4})\s*[–-]\s*(\d{2}/\d{2}/\d{4})")
SINGLE_DATE_PATTERN = re.compile(r"(\d{2}/\d{2}/\d{4})")

# Stage patterns to identify venue lines
STAGE_PATTERN = re.compile(r"on the\s+(.+(?:STAGE|THEATRE|ANYWHERE))", re.IGNORECASE)


def parse_date(date_str: str) -> Optional[str]:
    """Parse MM/DD/YYYY to YYYY-MM-DD."""
    try:
        dt = datetime.strptime(date_str.strip(), "%m/%d/%Y")
        return dt.strftime("%Y-%m-%d")
    except ValueError:
        return None


def parse_date_range(line: str) -> tuple[Optional[str], Optional[str]]:
    """Parse date range from line like '01/17/2026 – 02/22/2026'."""
    # Try range first
    match = DATE_PATTERN.search(line)
    if match:
        start = parse_date(match.group(1))
        end = parse_date(match.group(2))
        return start, end

    # Try single date
    match = SINGLE_DATE_PATTERN.search(line)
    if match:
        start = parse_date(match.group(1))
        return start, None

    return None, None


def is_date_line(line: str) -> bool:
    """Check if line contains a date pattern."""
    return bool(SINGLE_DATE_PATTERN.search(line))


def is_stage_line(line: str) -> bool:
    """Check if line describes a stage/venue."""
    return bool(STAGE_PATTERN.search(line))


def is_section_header(line: str) -> bool:
    """Check if line is a section header to skip."""
    skip_phrases = [
        "COMING UP THIS SEASON",
        "PREVIOUSLY THIS SEASON",
        "NOW STREAMING",
        "SPECIAL EVENTS",
        "GO BEYOND",
        "EXPLORE",
        "ACCESS FOR ALL",
        "ANNUAL MEMBERSHIP",
        "OUR GENEROUS",
        "FIRST TIME OR RETURNING",
        "FOLLOW US",
        "SUPPORTED BY",
        "1280 Peachtree",
        "Box Office:",
        "404.733",
        "Plan Your Visit",
        "Contact Us",
        "Privacy Policy",
        "Skip to Main",
    ]
    return any(phrase in line for phrase in skip_phrases)


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Alliance Theatre shows using Playwright."""
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

            logger.info(f"Fetching Alliance Theatre: {SHOWS_URL}")
            page.goto(SHOWS_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(3000)

            # Extract images from page
            image_map = extract_images_from_page(page)

            # Scroll to load dynamic content
            for _ in range(5):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1000)

            # Accept cookies if popup appears
            try:
                ok_btn = page.query_selector("button:has-text('OK')")
                if ok_btn:
                    ok_btn.click()
                    page.wait_for_timeout(500)
            except Exception:
                pass

            venue_id = get_or_create_venue(VENUE_DATA)

            body_text = page.inner_text("body")
            lines = [l.strip() for l in body_text.split("\n") if l.strip()]

            # Track section state
            in_upcoming = False
            in_streaming = False
            in_past = False

            # Parse shows: Title, Date, Stage appear on consecutive lines
            i = 0
            while i < len(lines):
                line = lines[i]

                # Track which section we're in
                if "COMING UP THIS SEASON" in line:
                    in_upcoming = True
                    in_streaming = False
                    in_past = False
                    i += 1
                    continue
                elif "NOW STREAMING" in line:
                    in_upcoming = False
                    in_streaming = True
                    in_past = False
                    i += 1
                    continue
                elif "PREVIOUSLY THIS SEASON" in line:
                    in_upcoming = False
                    in_streaming = False
                    in_past = True
                    i += 1
                    continue
                elif "SPECIAL EVENTS" in line or "GO BEYOND" in line:
                    # Stop processing when we hit special events or footer
                    break

                # Skip if in past section or not in a valid section
                if in_past or (not in_upcoming and not in_streaming):
                    i += 1
                    continue

                # Skip section headers and navigation
                if is_section_header(line):
                    i += 1
                    continue

                # Look for pattern: Title, Date, Stage
                # Title line: not a date, not a stage, reasonable length
                if (
                    not is_date_line(line)
                    and not is_stage_line(line)
                    and len(line) > 3
                    and len(line) < 100
                    and i + 1 < len(lines)
                ):
                    potential_title = line

                    # Check next line for date
                    if i + 1 < len(lines) and is_date_line(lines[i + 1]):
                        date_line = lines[i + 1]
                        start_date, end_date = parse_date_range(date_line)

                        if start_date:
                            # Found a valid show
                            title = potential_title

                            # Check for stage info
                            stage = None
                            if i + 2 < len(lines) and is_stage_line(lines[i + 2]):
                                stage_match = STAGE_PATTERN.search(lines[i + 2])
                                if stage_match:
                                    stage = stage_match.group(1).strip()

                            events_found += 1

                            content_hash = generate_content_hash(
                                title, "Alliance Theatre", start_date
                            )

                            existing = find_event_by_hash(content_hash)
                            if existing:
                                events_updated += 1
                                i += 3 if stage else 2
                                continue

                            # Determine subcategory and tags
                            title_lower = title.lower()
                            subcategory = "play"
                            tags = ["theater", "alliance-theatre", "woodruff-arts-center"]

                            if any(
                                w in title_lower
                                for w in ["musical", "rock experience", "christmas carol"]
                            ):
                                subcategory = "musical"
                                tags.append("musical")
                            elif "(stream)" in title_lower:
                                subcategory = "streaming"
                                tags.append("streaming")

                            # Add family tag for family shows
                            if stage and "GOIZUETA" in stage.upper():
                                tags.append("family")
                            if stage and "VERY YOUNG" in stage.upper():
                                tags.append("family")
                                tags.append("kids")

                            # Build event URL slug
                            event_slug = (
                                title.lower()
                                .replace(" ", "-")
                                .replace(":", "")
                                .replace("'", "")
                                .replace("(", "")
                                .replace(")", "")
                                .replace("!", "")
                            )
                            event_slug = re.sub(r"-+", "-", event_slug).strip("-")

                            event_record = {
                                "source_id": source_id,
                                "venue_id": venue_id,
                                "title": title,
                                "description": f"At Alliance Theatre{f' - {stage}' if stage else ''}",
                                "start_date": start_date,
                                "start_time": None,
                                "end_date": end_date,
                                "end_time": None,
                                "is_all_day": False,
                                "category": "theater",
                                "subcategory": subcategory,
                                "tags": tags,
                                "price_min": None,
                                "price_max": None,
                                "price_note": None,
                                "is_free": False,
                                "source_url": SHOWS_URL,
                                "ticket_url": SHOWS_URL,
                                "image_url": image_map.get(title),
                                "raw_text": f"{title} | {date_line} | {stage or 'Alliance Theatre'}",
                                "extraction_confidence": 0.90,
                                "is_recurring": True,
                                "recurrence_rule": None,
                                "content_hash": content_hash,
                            }

                            try:
                                insert_event(event_record)
                                events_new += 1
                                logger.info(
                                    f"Added: {title} ({start_date} to {end_date or 'N/A'})"
                                )
                            except Exception as e:
                                logger.error(f"Failed to insert: {title}: {e}")

                            # Skip past the lines we processed
                            i += 3 if stage else 2
                            continue

                i += 1

            browser.close()

        logger.info(
            f"Alliance Theatre crawl complete: {events_found} found, {events_new} new"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Alliance Theatre: {e}")
        raise

    return events_found, events_new, events_updated
