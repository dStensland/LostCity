"""
Crawler for The Masquerade (masqueradeatlanta.com/events).
Atlanta's legendary multi-room music venue with Heaven, Hell, Purgatory, and Altar.

Site uses JavaScript rendering - must use Playwright.
Format: THU, 22, JAN, 2026, "presents", TITLE, opener, "Room at The Masquerade", "Doors X:XX pm"
"""

from __future__ import annotations

import re
import logging
from datetime import datetime, date
from typing import Optional
from urllib.parse import urlparse

from playwright.sync_api import sync_playwright

from artist_images import fetch_artist_info
from db import (
    get_client,
    get_or_create_place,
    insert_event,
    find_event_by_hash,
    smart_update_existing_event,
)
from dedupe import generate_content_hash
from description_quality import is_likely_truncated_description
from utils import extract_images_from_page, extract_event_links, find_event_url, enrich_event_record

logger = logging.getLogger(__name__)

BASE_URL = "https://www.masqueradeatlanta.com"
EVENTS_URL = f"{BASE_URL}/events/"

# URL fragments that identify venue promotional/schedule graphics — not event-specific images.
# Any image_url matching one of these patterns is cleared to None so that the detail-page
# enrichment pass (enrich_event_record) can fetch the correct poster from the event page.
# Belt-and-suspenders: the same patterns are also registered in utils._IMAGE_SKIP_PATTERNS
# so they are caught at the central is_likely_non_event_image() gate as well.
_SCHEDULE_IMAGE_BLOCKLIST = re.compile(
    r"weeklyservice",  # covers weeklyservice_0202slider, weeklyservice_0209slider, etc.
    re.IGNORECASE,
)


def _is_schedule_image(url: Optional[str]) -> bool:
    """Return True if the URL matches a known venue schedule/promo graphic pattern."""
    if not url:
        return False
    return bool(_SCHEDULE_IMAGE_BLOCKLIST.search(url))


PLACE_DATA = {
    "name": "The Masquerade",
    "slug": "the-masquerade",
    "address": "50 Lower Alabama St SW #110",
    "neighborhood": "Downtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30303",
    "lat": 33.7537,
    "lng": -84.3963,
    "place_type": "music_venue",
    "website": BASE_URL,
}


def parse_time(time_text: str) -> Optional[str]:
    """Parse time from 'Doors 7:00 pm' format."""
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


MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"]
DAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]

_SPECIAL_EVENT_SLUG_ARTIST_OVERRIDES = {
    "theartit": "TheARTI$T",
}
_NON_ARTIST_SLUG_TERMS = (
    "karaoke",
    "open-mic",
    "trivia",
    "party",
)


def _normalize_slug_phrase(value: str) -> str:
    cleaned = re.sub(r"-(?:\d+)$", "", (value or "").strip().lower())
    cleaned = re.sub(r"[-_]+", " ", cleaned)
    return " ".join(cleaned.split()).strip()


def _to_display_name(value: str) -> str:
    words = []
    for token in value.split():
        if token.upper() in {"DJ", "MC"}:
            words.append(token.upper())
        elif re.fullmatch(r"[a-z]\.", token):
            words.append(token.upper())
        else:
            words.append(token.capitalize())
    return " ".join(words).strip()


def _title_needs_slug_artist_fallback(title: str) -> bool:
    text = (title or "").strip().lower()
    if not text:
        return False
    return bool(re.search(r"\b(tour|experience|anniversary|celebrating)\b", text))


def _extract_artist_from_event_url(event_url: str) -> Optional[str]:
    url = (event_url or "").strip()
    if not url:
        return None

    parsed = urlparse(url)
    parts = [part for part in parsed.path.split("/") if part]
    if len(parts) < 2 or parts[0] != "events":
        return None

    slug_part = _normalize_slug_phrase(parts[1])
    if not slug_part:
        return None
    if any(term in slug_part for term in _NON_ARTIST_SLUG_TERMS):
        return None

    if slug_part in _SPECIAL_EVENT_SLUG_ARTIST_OVERRIDES:
        return _SPECIAL_EVENT_SLUG_ARTIST_OVERRIDES[slug_part]
    return _to_display_name(slug_part)


def _is_listing_events_url(url: str) -> bool:
    value = (url or "").strip().rstrip("/")
    return bool(value) and value == EVENTS_URL.rstrip("/")


def _resolve_better_event_url(
    title: str,
    event_links: dict[str, str],
    current_url: str,
) -> Optional[str]:
    if not _is_listing_events_url(current_url):
        return None
    candidate = find_event_url(title, event_links, EVENTS_URL)
    if _is_listing_events_url(candidate):
        return None
    if candidate.strip().rstrip("/") == current_url.strip().rstrip("/"):
        return None
    return candidate


def _repair_listing_url_events(source_id: int, event_links: dict[str, str]) -> tuple[int, int]:
    """
    Upgrade lingering listing-page URLs to event-detail URLs for upcoming rows.
    Also supplies parsed artists for promo-style titles when URL-derived fallback exists.
    """
    client = get_client()
    today = date.today().isoformat()
    rows = (
        client.table("events")
        .select(
            "id,title,category_id,source_id,source_url,ticket_url,start_date,is_sensitive"
        )
        .eq("source_id", source_id)
        .gte("start_date", today)
        .execute()
    ).data or []

    url_repairs = 0
    artist_fallback_attempts = 0

    for row in rows:
        title = str(row.get("title") or "").strip()
        source_url = str(row.get("source_url") or "").strip()
        if not title or not source_url:
            continue

        better_url = _resolve_better_event_url(title, event_links, source_url)

        incoming = {
            "title": title,
            "source_id": row.get("source_id"),
            "category_id": row.get("category_id"),
        }
        if better_url:
            incoming["source_url"] = better_url
            incoming["ticket_url"] = better_url

        if _title_needs_slug_artist_fallback(title):
            fallback_url = better_url or source_url
            fallback_artist = _extract_artist_from_event_url(fallback_url)
            if fallback_artist:
                incoming["_parsed_artists"] = [
                    {
                        "name": fallback_artist,
                        "role": "headliner",
                        "billing_order": 1,
                        "is_headliner": True,
                    }
                ]
                artist_fallback_attempts += 1

        # Skip rows where no repair payload was generated.
        if len(incoming) <= 3:
            continue

        smart_update_existing_event(row, incoming)
        if better_url:
            url_repairs += 1

    return url_repairs, artist_fallback_attempts


def _repair_description_from_artist_bio(event_record: dict) -> None:
    """Replace truncated venue excerpts with a real artist bio when available."""
    description = str(event_record.get("description") or "").strip()
    if description and len(description) >= 80 and not is_likely_truncated_description(description):
        return

    artist_name = None
    parsed_artists = event_record.get("_parsed_artists") or []
    if parsed_artists:
        artist_name = str(parsed_artists[0].get("name") or "").strip()

    if not artist_name:
        artist_name = _extract_artist_from_event_url(
            event_record.get("source_url") or event_record.get("ticket_url") or ""
        )

    if not artist_name:
        return

    artist_info = fetch_artist_info(artist_name)
    if not artist_info:
        return

    if artist_info.bio:
        event_record["description"] = artist_info.bio[:2000]
    if not event_record.get("image_url") and artist_info.image_url:
        event_record["image_url"] = artist_info.image_url


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl The Masquerade events using Playwright."""
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

            logger.info(f"Fetching The Masquerade: {EVENTS_URL}")
            page.goto(EVENTS_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(5000)

            # Extract images from page
            image_map = extract_images_from_page(page)

            # Extract event links for specific URLs
            event_links = extract_event_links(page, BASE_URL)

            # Scroll to load all content
            for _ in range(5):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1000)

            # Get page text and parse line by line
            body_text = page.inner_text("body")
            lines = [l.strip() for l in body_text.split("\n") if l.strip()]

            # Parse events - format is:
            # THU (day of week)
            # 22 (day number)
            # JAN (month)
            # 2026 (year)
            # "The Masquerade presents"
            # ARTIST NAME (title)
            # opener
            # "Room at The Masquerade"
            # "Doors X:XX pm / All Ages"
            # BUY TICKETS / SOLD OUT / CANCELED

            i = 0
            while i < len(lines):
                line = lines[i].upper()

                # Look for day-of-week pattern starting an event block
                if line in DAYS and i + 3 < len(lines):
                    # Check if next lines follow the pattern: day number, month, year
                    day_num = lines[i + 1]
                    month = lines[i + 2].upper()
                    year = lines[i + 3]

                    if (day_num.isdigit() and
                        month in MONTHS and
                        year.isdigit() and len(year) == 4):

                        # Valid date block found
                        day = int(day_num)
                        month_idx = MONTHS.index(month) + 1
                        year_int = int(year)

                        # Look ahead for title, room, time
                        title = None
                        opener = None
                        room = None
                        start_time = None
                        is_cancelled = False
                        is_sold_out = False

                        # Scan next ~10 lines for event details
                        for j in range(i + 4, min(i + 15, len(lines))):
                            check_line = lines[j]
                            check_upper = check_line.upper()

                            # Skip "The Masquerade presents" header
                            if "masquerade presents" in check_line.lower():
                                continue

                            # Check for room
                            if not room:
                                for r in ["Heaven", "Hell", "Purgatory", "Altar"]:
                                    if f"{r} at The Masquerade" in check_line:
                                        room = r
                                        break

                            # Check for time (Doors X:XX pm)
                            if not start_time and "doors" in check_line.lower():
                                start_time = parse_time(check_line)

                            # Check status
                            if check_upper == "CANCELED" or check_upper == "CANCELLED":
                                is_cancelled = True
                            if "SOLD OUT" in check_upper:
                                is_sold_out = True

                            # Check for end of event block (next event starts)
                            if check_upper in DAYS:
                                break

                            # Skip navigation/status items
                            skip = ["BUY TICKETS", "MORE INFO", "SOLD OUT", "CANCELED", "CANCELLED",
                                   "FILTER BY", "SEARCH BY", "SUBMIT", "UPCOMING SHOWS"]
                            if check_upper in skip or any(s in check_upper for s in skip):
                                continue

                            # Get title (first substantial line after date that's not skipped)
                            if not title and len(check_line) > 2:
                                if not any(s.lower() in check_line.lower() for s in
                                          ["masquerade", "doors", "all ages", "heaven at", "hell at", "purgatory at", "altar at"]):
                                    title = check_line
                                    continue

                            # Get opener (line after title, before room)
                            if title and not opener and not room and len(check_line) > 2:
                                if not any(s.lower() in check_line.lower() for s in
                                          ["masquerade", "doors", "all ages"]):
                                    opener = check_line

                        # Skip cancelled events
                        if is_cancelled:
                            i += 1
                            continue

                        if not title:
                            i += 1
                            continue

                        # Build date
                        try:
                            dt = datetime(year_int, month_idx, day)
                            start_date = dt.strftime("%Y-%m-%d")
                        except ValueError:
                            i += 1
                            continue

                        events_found += 1

                        # Generate content hash
                        content_hash = generate_content_hash(title, "The Masquerade", start_date)

                        # Check for existing

                        # Build tags
                        tags = ["music", "concert", "the-masquerade", "downtown"]
                        if room:
                            tags.append(f"masquerade-{room.lower()}")

                        # Get specific event URL


                        event_url = find_event_url(title, event_links, EVENTS_URL)



                        # Guard: image_map is built from listing-page alt text, which can
                        # match venue schedule/promo graphics (weeklyservice_*slider) instead
                        # of event-specific posters.  Clear any blocklisted URL so that the
                        # enrich_event_record() pass below can fetch the correct image from
                        # the individual event detail page.
                        raw_image = image_map.get(title)
                        if _is_schedule_image(raw_image):
                            logger.warning(
                                "Masquerade: blocked schedule image for %r: %s",
                                title,
                                raw_image,
                            )
                            raw_image = None

                        event_record = {
                            "source_id": source_id,
                            "place_id": venue_id,
                            "title": title,
                            "description": None,
                            "start_date": start_date,
                            "start_time": start_time,
                            "end_date": None,
                            "end_time": None,
                            "is_all_day": False,
                            "category": "music",
                            "subcategory": "concert",
                            "tags": tags,
                            "price_min": None,
                            "price_max": None,
                            "price_note": "Sold Out" if is_sold_out else None,
                            "is_free": False,
                            "source_url": event_url,
                            "ticket_url": event_url,
                            "image_url": raw_image,
                            "raw_text": f"{title} - {start_date}",
                            "extraction_confidence": 0.90,
                            "is_recurring": False,
                            "recurrence_rule": None,
                            "content_hash": content_hash,
                        }

                        if _title_needs_slug_artist_fallback(title):
                            fallback_artist = _extract_artist_from_event_url(event_url)
                            if fallback_artist:
                                event_record["_parsed_artists"] = [
                                    {
                                        "name": fallback_artist,
                                        "role": "headliner",
                                        "billing_order": 1,
                                        "is_headliner": True,
                                    }
                                ]

                        # Enrich from detail page (description, image, price, artists)
                        # Skip if URL fell back to listing page
                        if event_url and event_url != EVENTS_URL:
                            enrich_event_record(event_record, "The Masquerade")

                        # Post-enrich guard: if enrichment somehow set a schedule image
                        # (e.g. the detail page og:image also resolves to a promo graphic),
                        # clear it rather than persist a wrong image.
                        if _is_schedule_image(event_record.get("image_url")):
                            logger.warning(
                                "Masquerade: post-enrich blocked schedule image for %r: %s",
                                title,
                                event_record.get("image_url"),
                            )
                            event_record["image_url"] = None

                        _repair_description_from_artist_bio(event_record)

                        existing = find_event_by_hash(content_hash)
                        if existing:
                            smart_update_existing_event(existing, event_record)
                            events_updated += 1
                            i += 1
                            continue

                        try:
                            insert_event(event_record)
                            events_new += 1
                            logger.info(f"Added: {title} on {start_date}")
                        except Exception as e:
                            logger.error(f"Failed to insert: {title}: {e}")

                i += 1

            repaired_urls, repaired_artist_attempts = _repair_listing_url_events(
                source_id, event_links
            )
            if repaired_urls > 0:
                logger.info(
                    "The Masquerade URL repair pass: %s listing URLs upgraded%s",
                    repaired_urls,
                    (
                        f", {repaired_artist_attempts} artist fallback attempts"
                        if repaired_artist_attempts
                        else ""
                    ),
                )

            browser.close()

        logger.info(
            f"The Masquerade crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl The Masquerade: {e}")
        raise

    return events_found, events_new, events_updated
