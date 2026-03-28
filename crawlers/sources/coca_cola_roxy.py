"""
Crawler for Coca-Cola Roxy (cocacolaroxy.com).
4,000-seat concert venue at The Battery Atlanta.

Site uses JavaScript rendering - must use Playwright.
Format: DAY (3-letter), DD, MON (3-letter), TITLE
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from playwright.sync_api import sync_playwright

from db import get_or_create_place, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash
from description_fetcher import fetch_detail_html_playwright
from pipeline.detail_enrich import enrich_from_detail
from pipeline.models import DetailConfig
from source_destination_sync import ensure_venue_destination_fields
from utils import extract_images_from_page, extract_event_links, find_event_url, enrich_event_record

logger = logging.getLogger(__name__)

BASE_URL = "https://www.cocacolaroxy.com"
# Main page has the event listings, /events is just a landing page
EVENTS_URL = BASE_URL
PLANNING_NOTE = (
    "Use the official show page for parking, entry timing, and bag/ticket policy before arrival. "
    "Battery traffic can materially change arrival time on Braves and major-event nights."
)

PLACE_DATA = {
    "name": "Coca-Cola Roxy",
    "slug": "coca-cola-roxy",
    "address": "800 Battery Ave SE",
    "neighborhood": "The Battery",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30339",
    "lat": 33.8907,
    "lng": -84.4678,
    "venue_type": "music_venue",
    "website": BASE_URL,
}

# 3-letter day names for validation
DAY_NAMES = {"MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"}

# 3-letter month names to full month numbers
MONTH_MAP = {
    "JAN": 1,
    "FEB": 2,
    "MAR": 3,
    "APR": 4,
    "MAY": 5,
    "JUN": 6,
    "JUL": 7,
    "AUG": 8,
    "SEP": 9,
    "OCT": 10,
    "NOV": 11,
    "DEC": 12,
}


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Coca-Cola Roxy events using Playwright."""
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
            ensure_venue_destination_fields(venue_id, planning_notes=PLANNING_NOTE)

            logger.info(f"Fetching Coca-Cola Roxy: {EVENTS_URL}")
            page.goto(EVENTS_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(3000)

            # Extract images from page
            image_map = extract_images_from_page(page)

            # Extract event links for specific URLs
            event_links = extract_event_links(page, BASE_URL)

            # Scroll to load all content
            for _ in range(5):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1000)

            # Extract event detail links from page
            detail_links = page.evaluate("""
                () => {
                    const links = {};
                    document.querySelectorAll('a[href*="/shows/"], a[href*="/events/"]').forEach(a => {
                        const text = a.textContent.trim();
                        const href = a.href;
                        if (text && text.length > 3 && href) {
                            links[text] = href;
                        }
                    });
                    return links;
                }
            """)

            # Get page text
            body_text = page.inner_text("body")
            lines = [line.strip() for line in body_text.split("\n") if line.strip()]

            # Skip navigation items
            skip_items = [
                "skip to content",
                "view shows",
                "enter",
                "featured shows",
                "follow us",
                "sign up",
                "get in touch",
                "coca-cola roxy",
                "privacy policy",
                "terms of use",
                "do not sell",
                "recaptcha",
                "live nation",
                "be the first",
            ]

            i = 0
            seen_events = set()
            current_year = datetime.now().year
            new_events = []

            while i < len(lines):
                line = lines[i].upper()

                # Skip nav/UI items
                if lines[i].lower() in skip_items or len(line) < 2:
                    i += 1
                    continue

                # Look for 3-letter day name (SAT, TUE, etc.)
                if line in DAY_NAMES:
                    # Next lines should be: day number, month, title
                    if i + 3 < len(lines):
                        day_num = lines[i + 1].strip()
                        month = lines[i + 2].strip().upper()
                        title = lines[i + 3].strip()

                        # Validate day number (1-31)
                        if not day_num.isdigit() or not (1 <= int(day_num) <= 31):
                            i += 1
                            continue

                        # Validate month
                        if month not in MONTH_MAP:
                            i += 1
                            continue

                        # Skip if title is another day name (malformed data)
                        if title.upper() in DAY_NAMES:
                            i += 1
                            continue

                        # Build date
                        day = int(day_num)
                        month_num = MONTH_MAP[month]

                        # Determine year - if month is in the past, use next year
                        year = current_year
                        try:
                            event_date = datetime(year, month_num, day)
                            if event_date < datetime.now():
                                year += 1
                                event_date = datetime(year, month_num, day)
                            start_date = event_date.strftime("%Y-%m-%d")
                        except ValueError:
                            i += 1
                            continue

                        # Check for duplicates (same show on multiple dates)
                        event_key = f"{title}|{start_date}"
                        if event_key in seen_events:
                            i += 4
                            continue
                        seen_events.add(event_key)

                        events_found += 1

                        # Generate content hash
                        content_hash = generate_content_hash(
                            title, "Coca-Cola Roxy", start_date
                        )

                        # Check for existing
                        existing = find_event_by_hash(content_hash)
                        if existing:
                            events_updated += 1
                            i += 4
                            continue

                        # Determine category based on title
                        category = "music"
                        subcategory = "concert"
                        tags = ["music", "concert", "coca-cola-roxy", "the-battery"]

                        title_lower = title.lower()
                        if any(
                            w in title_lower
                            for w in ["comedy", "comedian", "stand-up", "stand up"]
                        ):
                            category = "comedy"
                            subcategory = None
                            tags = ["comedy", "coca-cola-roxy", "the-battery"]
                        elif any(w in title_lower for w in ["murder", "podcast"]):
                            category = "community"
                            subcategory = "podcast"
                            tags = ["podcast", "coca-cola-roxy", "the-battery"]

                        # Get specific event URL


                        event_url = find_event_url(title, event_links, EVENTS_URL)



                        event_record = {
                            "source_id": source_id,
                            "venue_id": venue_id,
                            "title": title,
                            "description": None,
                            "start_date": start_date,
                            "start_time": None,
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
                            "source_url": event_url,
                            "ticket_url": event_url,
                            "image_url": image_map.get(title),
                            "raw_text": f"{line} {day_num} {month} - {title}",
                            "extraction_confidence": 0.90,
                            "is_recurring": False,
                            "recurrence_rule": None,
                            "content_hash": content_hash,
                        }

                        # Enrich from detail page
                        enrich_event_record(event_record, source_name="Coca-Cola Roxy")

                        # Determine is_free if still unknown after enrichment
                        if event_record.get("is_free") is None:
                            desc_lower = (event_record.get("description") or "").lower()
                            title_lower = event_record.get("title", "").lower()
                            combined = f"{title_lower} {desc_lower}"
                            if any(kw in combined for kw in ["free", "no cost", "no charge", "complimentary"]):
                                event_record["is_free"] = True
                                event_record["price_min"] = event_record.get("price_min") or 0
                                event_record["price_max"] = event_record.get("price_max") or 0
                            else:
                                event_record["is_free"] = False

                        new_events.append(event_record)

                        i += 4
                        continue

                i += 1

            # Fetch details from detail pages for new events
            detail_page = context.new_page()
            detail_fetches = 0
            detail_config = DetailConfig()
            for evt in new_events:
                title = evt["title"]
                detail_url = detail_links.get(title)
                if detail_url and detail_fetches < 20:
                    html = fetch_detail_html_playwright(detail_page, detail_url)
                    if html:
                        fields = enrich_from_detail(html, detail_url, "Coca-Cola Roxy", detail_config)
                        if fields.get("description"):
                            evt["description"] = fields["description"]
                        if fields.get("start_time") and not evt.get("start_time"):
                            evt["start_time"] = fields["start_time"]
                        if fields.get("doors_time") and not evt.get("doors_time"):
                            evt["doors_time"] = fields["doors_time"]
                        if fields.get("ticket_url") and not evt.get("ticket_url"):
                            evt["ticket_url"] = fields["ticket_url"]
                        if fields.get("image_url") and not evt.get("image_url"):
                            evt["image_url"] = fields["image_url"]
                        if fields.get("price_min") is not None and evt.get("price_min") is None:
                            evt["price_min"] = fields["price_min"]
                        if fields.get("price_max") is not None and evt.get("price_max") is None:
                            evt["price_max"] = fields["price_max"]
                        if fields.get("price_note") and not evt.get("price_note"):
                            evt["price_note"] = fields["price_note"]
                        if fields.get("is_free"):
                            evt["is_free"] = True
                        if fields.get("ticket_status") and not evt.get("ticket_status"):
                            evt["ticket_status"] = fields["ticket_status"]
                            evt["ticket_status_checked_at"] = datetime.now(timezone.utc).isoformat()
                    detail_fetches += 1
                    page.wait_for_timeout(1000)

                # No synthetic fallback — NULL is better than filler

                try:
                    insert_event(evt)
                    events_new += 1
                    logger.info(f"Added: {title} on {evt['start_date']}")
                except Exception as e:
                    logger.error(f"Failed to insert: {title}: {e}")

            detail_page.close()
            browser.close()

        logger.info(
            f"Coca-Cola Roxy crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Coca-Cola Roxy: {e}")
        raise

    return events_found, events_new, events_updated
