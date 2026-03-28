"""
Crawler for Woodstock Arts Theatre (woodstockarts.org).
Community theater in Woodstock, GA producing mainstage productions.

Site structure: Theatre events at /events/category/theatre/
Each show has its own event detail page with title, date range, description,
og:image, and per-performance ticket links.
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

BASE_URL = "https://woodstockarts.org"
THEATRE_EVENTS_URL = f"{BASE_URL}/events/category/theatre/"

PLACE_DATA = {
    "name": "Woodstock Arts Theatre",
    "slug": "woodstock-arts-theatre",
    "address": "8534 Main St",
    "neighborhood": "Downtown Woodstock",
    "city": "Woodstock",
    "state": "GA",
    "zip": "30188",
    "lat": 34.1015,
    "lng": -84.5194,
    "place_type": "theater",
    "spot_type": "theater",
    "website": BASE_URL,
}

# Month name → number for ordinal date parsing
MONTH_MAP = {
    "january": 1, "february": 2, "march": 3, "april": 4,
    "may": 5, "june": 6, "july": 7, "august": 8,
    "september": 9, "october": 10, "november": 11, "december": 12,
}


def parse_date_range(text: str) -> tuple[Optional[str], Optional[str]]:
    """
    Parse show date range from text like:
    - "MARCH 13 – MARCH 29"
    - "MAY 1 – MAY 24"
    - "JUNE 10 – JUNE 24"

    Returns (start_date, end_date) as YYYY-MM-DD strings, or (None, None).
    The site does not include a year in the listing text, so we infer the year
    as the current or next calendar year, whichever keeps the date in the future.
    """
    if not text:
        return None, None

    text = text.strip()

    # Pattern: "MONTH DAY – MONTH DAY" (en-dash or regular dash)
    cross_month = re.search(
        r"(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})\s*[–\-—]\s*(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})",
        text,
        re.IGNORECASE,
    )
    if cross_month:
        start_month, start_day, end_month, end_day = cross_month.groups()
        start_date = _infer_year(start_month, int(start_day))
        end_date = _infer_year(end_month, int(end_day))
        if start_date and end_date:
            return start_date, end_date

    # Pattern: "MONTH DAY – DAY" (same month)
    same_month = re.search(
        r"(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})\s*[–\-—]\s*(\d{1,2})",
        text,
        re.IGNORECASE,
    )
    if same_month:
        month, start_day, end_day = same_month.groups()
        start_date = _infer_year(month, int(start_day))
        end_date = _infer_year(month, int(end_day))
        if start_date and end_date:
            return start_date, end_date

    # Single date
    single = re.search(
        r"(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})",
        text,
        re.IGNORECASE,
    )
    if single:
        month, day = single.groups()
        date = _infer_year(month, int(day))
        if date:
            return date, date

    return None, None


def _infer_year(month_name: str, day: int) -> Optional[str]:
    """
    Infer the year for a month/day combination. The Woodstock Arts website
    shows upcoming productions without an explicit year in the listing text.

    Strategy: try the current year first; if the resulting date is more than
    30 days in the past, use next year. This handles season pages that span
    December → January without explicitly stating the year change.
    """
    month_num = MONTH_MAP.get(month_name.lower())
    if not month_num:
        return None

    today = datetime.now().date()
    for year_offset in (0, 1):
        year = today.year + year_offset
        try:
            candidate = datetime(year, month_num, day).date()
        except ValueError:
            continue
        # Accept dates that haven't passed by more than 30 days
        days_past = (today - candidate).days
        if days_past <= 30:
            return candidate.strftime("%Y-%m-%d")

    return None


def _extract_show_info(page) -> dict:
    """
    Extract structured show info from a Woodstock Arts event detail page.
    Returns a dict with: title, date_range_text, description, image_url, ticket_url.
    """
    info: dict = {}

    # Title from h1
    h1 = page.query_selector("h1")
    if h1:
        info["title"] = h1.inner_text().strip().title()

    # og:image for the show poster
    og_image = page.query_selector('meta[property="og:image"]')
    if og_image:
        info["image_url"] = og_image.get_attribute("content")

    # og:description for a clean summary
    og_desc = page.query_selector('meta[property="og:description"]')
    if og_desc:
        meta_desc = og_desc.get_attribute("content") or ""
        if meta_desc and len(meta_desc) > 30:
            info["meta_description"] = meta_desc

    # Collect all text editor widget text blocks
    widgets = page.query_selector_all(".elementor-widget-text-editor")
    text_blocks = []
    for widget in widgets:
        txt = widget.inner_text().strip()
        if txt:
            text_blocks.append(txt)

    # First text block is typically the date range (e.g. "MARCH 13 – MARCH 29")
    if text_blocks:
        first_block = text_blocks[0]
        # Only use it as date range if it looks like a date
        if re.search(
            r"(January|February|March|April|May|June|July|August|September|October|November|December)",
            first_block,
            re.IGNORECASE,
        ):
            info["date_range_text"] = first_block

    # Description: find the "About" section text block — it usually contains
    # the show's tagline ("DISCOVER…") followed by the synopsis paragraph
    description_parts = []
    for block in text_blocks[1:]:
        # Skip functional blocks
        skip_phrases = [
            "featuring", "cast to be announced", "we're excited", "first time",
            "if you have any questions", "discover…", "why see this show",
            "who is this show for", "opening reception", "schedule",
            "doors open", "run time", "rating", "written by", "direction by",
            "know before you go", "reach out",
        ]
        block_lower = block.lower()
        if any(block_lower.startswith(phrase) for phrase in skip_phrases):
            continue
        if len(block) > 80 and not block.startswith("http"):
            description_parts.append(block)
            if len(description_parts) >= 2:
                break

    if description_parts:
        info["description"] = " ".join(description_parts)[:600]

    # Ticket URL: prefer a show-specific booking link if present,
    # otherwise fall back to the first book-online link
    ticket_links = page.query_selector_all('a[href*="book-online"]')
    if ticket_links:
        info["ticket_url"] = ticket_links[0].get_attribute("href") or ""
    else:
        # Fall back to any link with "ticket" in href or text
        for link in page.query_selector_all("a"):
            href = link.get_attribute("href") or ""
            link_text = link.inner_text().strip().lower()
            if "ticket" in href.lower() or "buy ticket" in link_text:
                info["ticket_url"] = href
                break

    return info


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Woodstock Arts Theatre production schedule."""
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

            # Step 1: Load the theatre category page to discover show URLs
            logger.info(f"Fetching Woodstock Arts Theatre events: {THEATRE_EVENTS_URL}")
            page.goto(THEATRE_EVENTS_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(2000)

            # Collect show links from article elements that have event titles
            show_links: list[tuple[str, str]] = []  # (title, url)
            articles = page.query_selector_all("article")
            for article in articles:
                links = article.query_selector_all("a")
                for link in links:
                    href = link.get_attribute("href") or ""
                    text = link.inner_text().strip()
                    if (
                        text
                        and href
                        and f"{BASE_URL}/events/" in href
                        and "/category/" not in href
                    ):
                        show_links.append((text.title(), href))
                        break  # one link per article is sufficient

            logger.info(f"Found {len(show_links)} show links: {[t for t, _ in show_links]}")

            # Step 2: Visit each show page for full details
            for show_title, show_url in show_links:
                try:
                    page.goto(show_url, wait_until="domcontentloaded", timeout=30000)
                    page.wait_for_timeout(1500)

                    info = _extract_show_info(page)

                    # Use the h1 title from the detail page if available
                    title = info.get("title") or show_title
                    if not title or len(title) < 3:
                        logger.debug(f"Skipping show with no title: {show_url}")
                        continue

                    date_range_text = info.get("date_range_text", "")
                    start_date, end_date = parse_date_range(date_range_text)

                    if not start_date:
                        # Try parsing from the listing-level title text as fallback
                        start_date, end_date = parse_date_range(show_title)

                    if not start_date:
                        logger.debug(f"No dates found for {title} — skipping")
                        continue

                    # Skip shows whose run has ended (with 1-day grace)
                    check_date = end_date or start_date
                    try:
                        if (
                            datetime.strptime(check_date, "%Y-%m-%d").date()
                            < datetime.now().date()
                        ):
                            logger.debug(f"Skipping past show: {title} (ended {check_date})")
                            continue
                    except ValueError:
                        pass

                    description = info.get("description") or info.get("meta_description")
                    image_url = info.get("image_url")
                    ticket_url = info.get("ticket_url") or show_url

                    # Classify subcategory
                    title_lower = title.lower()
                    subcategory = "play"
                    tags = ["woodstock-arts-theatre", "theater", "woodstock", "community-theater"]
                    if any(
                        kw in title_lower
                        for kw in ["musical", "mamma mia", "annie", "wimpy kid", "ring of fire"]
                    ):
                        subcategory = "musical"
                        tags.append("musical")
                    if any(kw in title_lower for kw in ["kid", "wimpy", "annie"]):
                        tags.append("family")

                    events_found += 1

                    content_hash = generate_content_hash(title, "Woodstock Arts Theatre", start_date)

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
                        "place_id": venue_id,
                        "title": title,
                        "description": description or f"{title} at Woodstock Arts Theatre",
                        "start_date": start_date,
                        "start_time": "19:30",  # Default evening showtime
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
                        "source_url": show_url,
                        "ticket_url": ticket_url,
                        "image_url": image_url,
                        "raw_text": date_range_text,
                        "extraction_confidence": 0.90,
                        "is_recurring": bool(end_date and end_date != start_date),
                        "recurrence_rule": None,
                        "content_hash": content_hash,
                    }

                    existing = find_event_by_hash(content_hash)
                    if existing:
                        smart_update_existing_event(existing, event_record)
                        events_updated += 1
                        logger.info(f"Updated: {title} ({start_date} to {end_date})")
                    else:
                        try:
                            insert_event(event_record, series_hint=series_hint)
                            events_new += 1
                            logger.info(f"Added: {title} ({start_date} to {end_date})")
                        except Exception as e:
                            logger.error(f"Failed to insert {title}: {e}")

                except Exception as e:
                    logger.warning(f"Failed to process show {show_url}: {e}")
                    continue

            browser.close()

    except Exception as e:
        logger.error(f"Failed to crawl Woodstock Arts Theatre: {e}")
        raise

    logger.info(
        f"Woodstock Arts Theatre crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
    )
    return events_found, events_new, events_updated
