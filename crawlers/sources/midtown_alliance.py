"""
Crawler for Midtown Alliance (midtownatl.com).

Midtown Alliance is the Business Improvement District (BID) for Midtown Atlanta.
They produce original community programming — yoga in parks, cardio dance at MARTA
stations, community paint days, mural events, and more. These are NOT duplicates
from other venues; Midtown Alliance is the organizer.

The site returns 403 on automated HTTP requests, so Playwright is required.

Event calendar pattern observed on-site:
  - Event cards have title, date/time, venue name, and category tags
  - Time/venue format: "6pm - 7pm / MARTA - North Avenue Station"
  - Category pills: "Midtown Alliance Event", "Sports & Recreation", "Community", etc.
  - Events produced by Midtown Alliance are tagged "Midtown Alliance Event"
  - The calendar also aggregates events from nearby venues; those will be deduped downstream

Recurring Midtown Alliance programming detected:
  - "Yoga Flow at 10th Street Park" — weekly (Saturday)
  - "Cardio Dance" at MARTA North Avenue Station — recurring fitness
"""

from __future__ import annotations

import logging
import re
from datetime import datetime, date
from typing import Optional

from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeoutError

from db import (
    get_or_create_place,
    get_client,
    insert_event,
    find_event_by_hash,
    smart_update_existing_event,
)
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://www.midtownatl.com"
CALENDAR_URL = f"{BASE_URL}/events"

# Organization name stamped on all events from this source
ORGANIZATION_NAME = "Midtown Alliance"

# -----------------------------------------------------------------------
# Fallback venue for events where no specific venue is parsed.
# Midtown Alliance events happen across Midtown; this org record anchors
# events whose venue can't be resolved.
# -----------------------------------------------------------------------
ORG_VENUE_DATA = {
    "name": "Midtown Alliance",
    "slug": "midtown-alliance",
    "address": "999 Peachtree St NE, Suite 730",
    "neighborhood": "Midtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30309",
    "lat": 33.7848,
    "lng": -84.3836,
    "place_type": "organization",
    "spot_type": "organization",
    "website": BASE_URL,
    "description": (
        "Midtown Alliance is the Business Improvement District for Midtown Atlanta. "
        "They organize community programming including free yoga in parks, cardio dance "
        "at MARTA stations, mural events, and neighborhood activations throughout Midtown."
    ),
    "vibes": ["family-friendly", "all-ages"],
}

# -----------------------------------------------------------------------
# Known Midtown venues referenced inline in calendar entries.
# Maps lowercased venue name fragments to structured venue data.
# When Playwright extracts a venue name from an event card, we match
# against these to produce a proper venue record instead of always
# falling back to the org venue.
# -----------------------------------------------------------------------
_KNOWN_VENUES: list[dict] = [
    {
        "name": "10th Street Park",
        "slug": "10th-street-park-midtown",
        "address": "804 10th St NE",
        "neighborhood": "Midtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30309",
        "lat": 33.7786,
        "lng": -84.3763,
        "place_type": "park",
        "spot_type": "park",
        "website": BASE_URL,
        "vibes": ["family-friendly", "outdoor-seating"],
        "keywords": ["10th street park"],
    },
    {
        "name": "MARTA North Avenue Station",
        "slug": "marta-north-avenue-station",
        "address": "25 North Ave NE",
        "neighborhood": "Midtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30308",
        "lat": 33.7718,
        "lng": -84.3869,
        "place_type": "community_center",
        "spot_type": "community_center",
        "website": "https://www.itsmarta.com",
        "vibes": [],
        "keywords": ["marta - north avenue", "marta north avenue"],
    },
    {
        "name": "Ferst Center for the Arts at Georgia Tech",
        "slug": "ferst-center-for-the-arts",
        "address": "349 Ferst Dr NW",
        "neighborhood": "Georgia Tech",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30332",
        "lat": 33.7744,
        "lng": -84.3960,
        "place_type": "theater",
        "spot_type": "theater",
        "website": "https://www.ferstcenter.org",
        "vibes": ["performing-arts", "live-music"],
        "keywords": ["ferst center", "ferst center for the arts"],
    },
    {
        "name": "All Saints' Episcopal Church",
        "slug": "all-saints-episcopal-church-midtown",
        "address": "634 W Peachtree St NW",
        "neighborhood": "Midtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30308",
        "lat": 33.7750,
        "lng": -84.3876,
        "place_type": "church",
        "spot_type": "community_center",
        "website": "https://www.allsaintsatlanta.org",
        "vibes": ["historic"],
        "keywords": ["all saints", "all saints' episcopal"],
    },
]

# -----------------------------------------------------------------------
# Series hints for known recurring Midtown Alliance programming.
# Title fragments (lowercased) → series_hint dict.
# -----------------------------------------------------------------------
_RECURRING_SERIES: dict[str, dict] = {
    "yoga flow": {
        "series_type": "class_series",
        "series_title": "Yoga Flow at 10th Street Park",
        "frequency": "weekly",
        "day_of_week": "Saturday",
    },
    "cardio dance": {
        "series_type": "recurring_show",
        "series_title": "Cardio Dance",
        "frequency": "weekly",
    },
    "morning yoga": {
        "series_type": "class_series",
        "series_title": "Morning Yoga",
        "frequency": "weekly",
    },
    "midtown run club": {
        "series_type": "recurring_show",
        "series_title": "Midtown Run Club",
        "frequency": "weekly",
    },
}

# -----------------------------------------------------------------------
# Category mapping from Midtown Alliance calendar tag text
# -----------------------------------------------------------------------
_TAG_CATEGORY_MAP: dict[str, tuple[str, Optional[str]]] = {
    "sports & recreation": ("fitness", None),
    "sports and recreation": ("fitness", None),
    "arts & exhibitions": ("art", "exhibition"),
    "arts and exhibitions": ("art", "exhibition"),
    "community": ("community", None),
    "nightlife": ("nightlife", None),
    "food & dining": ("food_drink", None),
    "food and dining": ("food_drink", None),
    "concerts & live music": ("music", None),
    "music": ("music", None),
    "film": ("film", None),
    "theatre & shows": ("theater", None),
    "theater": ("theater", None),
    "wellness": ("wellness", None),
    "fitness": ("fitness", None),
    "family-friendly": ("family", None),
    "family": ("family", None),
    "education": ("learning", None),
    "technology & innovation": ("learning", "talk"),
    "sustainability": ("community", None),
    "parades & festivals": ("community", "festival"),
    "special deals": ("food_drink", None),
    "holidays": ("community", None),
    "history": ("community", None),
}


def _match_venue(venue_name: str) -> Optional[dict]:
    """
    Try to match a venue name string to one of our known Midtown venues.
    Returns the venue dict if matched, None otherwise.
    """
    if not venue_name:
        return None
    name_lower = venue_name.lower()
    for vdata in _KNOWN_VENUES:
        for kw in vdata.get("keywords", []):
            if kw in name_lower:
                return vdata
    return None


def _parse_12h(t: str) -> Optional[str]:
    """Parse a 12-hour time string like '6pm' or '10:30am' to 24h 'HH:MM'."""
    t = t.strip().upper().replace(" ", "")
    for fmt in ("%I:%M%p", "%I%p"):
        try:
            return datetime.strptime(t, fmt).strftime("%H:%M")
        except ValueError:
            pass
    return None


def _parse_evcard_date(dow: str, day: str, month: str) -> Optional[str]:
    """
    Parse date from evcard date-box parts: dow='Wed', day='18', month='Mar'.
    Returns 'YYYY-MM-DD'. Infers year from current date — if parsed date is
    more than 60 days in the past, assumes next year.
    """
    try:
        day_int = int(day)
        month_dt = datetime.strptime(month.strip(), "%b")
        month_int = month_dt.month
    except (ValueError, TypeError):
        return None

    today = date.today()
    year = today.year
    try:
        parsed = date(year, month_int, day_int)
    except ValueError:
        return None

    # If date is >60 days in the past, assume next year
    if (today - parsed).days > 60:
        try:
            parsed = date(year + 1, month_int, day_int)
        except ValueError:
            return None

    return parsed.isoformat()


def _parse_time_venue(text: str) -> tuple[Optional[str], Optional[str], str]:
    """
    Parse .evcard-content-text which has format:
      '6pm - 7pm / MARTA - North Avenue Station'
      '8pm - 10pm / Atlanta Symphony Hall'
      '12am - 11:55pm'
      'Read More'

    Returns (start_time, end_time, venue_text).
    """
    if not text:
        return None, None, ""

    # Split on ' / ' to separate time from venue
    parts = text.split(" / ", 1)
    time_part = parts[0].strip()
    venue_text = parts[1].strip() if len(parts) > 1 else ""

    start_time: Optional[str] = None
    end_time: Optional[str] = None

    # Match time range: "6pm - 7pm", "10:30am - 12:30pm"
    time_range_match = re.match(
        r"(\d{1,2}(?::\d{2})?\s*[APap][Mm])\s*[-–]\s*(\d{1,2}(?::\d{2})?\s*[APap][Mm])",
        time_part,
    )
    if time_range_match:
        start_time = _parse_12h(time_range_match.group(1))
        end_time = _parse_12h(time_range_match.group(2))
    else:
        # Single time: "7:30pm"
        single_match = re.match(r"(\d{1,2}(?::\d{2})?\s*[APap][Mm])", time_part)
        if single_match:
            start_time = _parse_12h(single_match.group(1))

    return start_time, end_time, venue_text


def _extract_price(text: str) -> tuple[Optional[float], Optional[float], Optional[str], bool]:
    """
    Extract price info from event text.
    Returns (price_min, price_max, price_note, is_free).
    """
    text_lower = text.lower()
    if any(kw in text_lower for kw in ["free", "no cost", "no charge", "complimentary", "at no cost"]):
        return 0.0, 0.0, "Free", True
    price_matches = re.findall(r"\$(\d+(?:\.\d{2})?)", text)
    if price_matches:
        prices = [float(p) for p in price_matches]
        return min(prices), max(prices), None, False
    return None, None, None, False


def _infer_category(tags: list[str], title: str, description: str) -> tuple[str, Optional[str]]:
    """
    Infer LostCity category + subcategory from calendar tags and event text.
    """
    text_lower = (title + " " + description).lower()

    for tag in tags:
        tag_lower = tag.lower().strip()
        if tag_lower in _TAG_CATEGORY_MAP:
            return _TAG_CATEGORY_MAP[tag_lower]

    # Title/description keyword fallbacks
    if any(kw in text_lower for kw in ["yoga", "meditation", "pilates"]):
        return "fitness", None
    if any(kw in text_lower for kw in ["dance", "cardio dance"]):
        return "fitness", "dance"
    if any(kw in text_lower for kw in ["mural", "paint", "art", "gallery", "exhibition"]):
        return "art", None
    if any(kw in text_lower for kw in ["concert", "music", "band", "jazz"]):
        return "music", None
    if any(kw in text_lower for kw in ["run", "5k", "walk", "fitness"]):
        return "fitness", None
    if any(kw in text_lower for kw in ["food", "dinner", "wine", "chef"]):
        return "food_drink", None
    if any(kw in text_lower for kw in ["talk", "lecture", "panel", "tech"]):
        return "learning", "talk"
    if any(kw in text_lower for kw in ["volunteer", "cleanup", "beautification"]):
        return "community", None

    return "community", None


def _get_series_hint(title: str, tags: list[str]) -> Optional[dict]:
    """
    Return a series_hint for known recurring programming.
    """
    title_lower = title.lower()
    for key, hint in _RECURRING_SERIES.items():
        if key in title_lower:
            return hint
    return None


def _build_tags(
    calendar_tags: list[str],
    is_midtown_alliance_event: bool,
    category: str,
    title_lower: str,
) -> list[str]:
    """Build a tag list from available signals."""
    tags = ["midtown"]
    if is_midtown_alliance_event:
        tags.append("midtown-alliance")
    if "outdoor" in title_lower or any(
        kw in title_lower for kw in ["park", "plaza", "beltline", "station"]
    ):
        tags.append("outdoor")
    if "free" in title_lower:
        tags.append("free")
    if category == "fitness":
        tags.append("active")
    if any(kw in title_lower for kw in ["yoga", "cardio", "dance"]):
        tags.append("wellness")
    return tags


def _parse_events_from_page(page) -> list[dict]:
    """
    Extract raw event data from the Midtown Alliance events calendar page.

    The site uses `a.evcard` cards with:
      - `.evcard-content-headline` — event title
      - `.evcard-content-subhead` — categories ("Community • Nightlife • Food & Dining")
      - `.evcard-content-text`    — time and venue ("6pm - 7pm / MARTA - North Avenue Station")
      - `.evcard-date-dow`        — day of week ("Wed")
      - `.evcard-date-day`        — day number ("18")
      - `.evcard-date-month`      — month abbreviation ("Mar")
      - href                      — detail link ("/do/event-slug")

    Returns a list of dicts with parsed fields.
    """
    try:
        raw_events = page.evaluate("""
            () => {
                const cards = document.querySelectorAll('a.evcard');
                const results = [];
                for (const card of cards) {
                    try {
                        const headline = (card.querySelector('.evcard-content-headline') || {}).textContent || '';
                        const subhead = (card.querySelector('.evcard-content-subhead') || {}).textContent || '';
                        const text = (card.querySelector('.evcard-content-text') || {}).textContent || '';
                        const dow = (card.querySelector('.evcard-date-dow') || {}).textContent || '';
                        const day = (card.querySelector('.evcard-date-day') || {}).textContent || '';
                        const month = (card.querySelector('.evcard-date-month') || {}).textContent || '';
                        const href = card.getAttribute('href') || '';
                        const imgDiv = card.querySelector('.evcard-image-image');
                        const bgStyle = imgDiv ? (imgDiv.getAttribute('style') || '') : '';
                        results.push({
                            title: headline.trim(),
                            subhead: subhead.trim(),
                            text: text.trim(),
                            dow: dow.trim(),
                            day: day.trim(),
                            month: month.trim(),
                            href: href.trim(),
                            bgStyle: bgStyle.trim(),
                        });
                    } catch (e) { /* skip malformed card */ }
                }
                return results;
            }
        """)

        if raw_events:
            logger.info(f"Midtown Alliance: extracted {len(raw_events)} event cards via DOM")
            return raw_events

    except Exception as exc:
        logger.warning(f"Midtown Alliance: DOM extraction failed: {exc}")

    return []


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl Midtown Alliance events using Playwright.

    Returns (events_found, events_new, events_updated).
    """
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    browser = None
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                user_agent=(
                    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/122.0.0.0 Safari/537.36"
                ),
                viewport={"width": 1440, "height": 900},
                locale="en-US",
            )
            page = context.new_page()

            # ----------------------------------------------------------------
            # Step 1: Extract og:image/description from homepage for org venue
            # ----------------------------------------------------------------
            og_image: Optional[str] = None
            og_desc: Optional[str] = None
            try:
                page.goto(BASE_URL, wait_until="domcontentloaded", timeout=30000)
                og_image = page.evaluate(
                    "() => { const m = document.querySelector('meta[property=\"og:image\"]'); "
                    "return m ? m.content : null; }"
                )
                og_desc = page.evaluate(
                    "() => { const m = document.querySelector('meta[property=\"og:description\"]') "
                    "|| document.querySelector('meta[name=\"description\"]'); "
                    "return m ? m.content : null; }"
                )
                if og_image:
                    ORG_VENUE_DATA["image_url"] = og_image
                if og_desc:
                    ORG_VENUE_DATA["description"] = og_desc
                logger.debug("Midtown Alliance: homepage og: extracted")
            except Exception as exc:
                logger.debug(f"Midtown Alliance: homepage og: extraction failed: {exc}")

            # Ensure org venue exists
            org_venue_id = get_or_create_place(ORG_VENUE_DATA)

            # Persist any og: enrichment to the org venue record
            try:
                venue_update: dict = {}
                if ORG_VENUE_DATA.get("image_url"):
                    venue_update["image_url"] = ORG_VENUE_DATA["image_url"]
                if ORG_VENUE_DATA.get("description"):
                    venue_update["description"] = ORG_VENUE_DATA["description"]
                if venue_update:
                    get_client().table("places").update(venue_update).eq("id", org_venue_id).execute()
                    logger.debug("Midtown Alliance: org venue enriched with og: data")
            except Exception as exc:
                logger.warning(f"Midtown Alliance: org venue update failed: {exc}")

            # Pre-create known Midtown venue records so they're available for matching
            _known_venue_id_cache: dict[str, int] = {}
            for vdata in _KNOWN_VENUES:
                try:
                    vslug = vdata["slug"]
                    vd = {k: v for k, v in vdata.items() if k != "keywords"}
                    vid = get_or_create_place(vd)
                    _known_venue_id_cache[vslug] = vid
                except Exception as exc:
                    logger.warning(f"Midtown Alliance: could not create venue {vdata['name']}: {exc}")

            # ----------------------------------------------------------------
            # Step 2: Load events calendar
            # ----------------------------------------------------------------
            logger.info(f"Midtown Alliance: loading {CALENDAR_URL}")
            try:
                page.goto(CALENDAR_URL, wait_until="networkidle", timeout=45000)
            except PlaywrightTimeoutError:
                # networkidle can time out on heavy pages; domcontentloaded is fine
                logger.debug("Midtown Alliance: networkidle timed out, retrying with domcontentloaded")
                try:
                    page.goto(CALENDAR_URL, wait_until="domcontentloaded", timeout=30000)
                except Exception as nav_exc:
                    logger.error(f"Midtown Alliance: failed to load calendar: {nav_exc}")
                    browser.close()
                    return 0, 0, 0

            # Give JS time to render events
            page.wait_for_timeout(3000)

            # Scroll to trigger lazy loading
            for _ in range(4):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(800)

            # ----------------------------------------------------------------
            # Step 3: Parse events
            # ----------------------------------------------------------------
            raw_events = _parse_events_from_page(page)

            if not raw_events:
                logger.warning(
                    "Midtown Alliance: no events found on calendar — site structure may have changed"
                )
                browser.close()
                return 0, 0, 0

            today = date.today()

            for raw in raw_events:
                try:
                    title = (raw.get("title") or "").strip()
                    if not title or len(title) < 3:
                        continue

                    # Strip "Midtown Alliance Event" suffix from titles
                    title = re.sub(r"\s*Midtown Alliance Event\s*$", "", title).strip()
                    if not title:
                        continue

                    # Parse date from evcard date-box parts
                    start_date = _parse_evcard_date(
                        raw.get("dow", ""),
                        raw.get("day", ""),
                        raw.get("month", ""),
                    )
                    if not start_date:
                        logger.debug(f"Midtown Alliance: skipping {title!r} — could not parse date")
                        continue

                    try:
                        parsed_date = datetime.strptime(start_date, "%Y-%m-%d").date()
                        if parsed_date < today:
                            continue
                    except ValueError:
                        continue

                    # Parse time and venue from evcard-content-text
                    text_field = raw.get("text", "")
                    start_time, end_time, venue_text = _parse_time_venue(text_field)

                    # Determine venue
                    matched_venue = _match_venue(venue_text)

                    if matched_venue:
                        vslug = matched_venue["slug"]
                        if vslug in _known_venue_id_cache:
                            venue_id = _known_venue_id_cache[vslug]
                        else:
                            vd = {k: v for k, v in matched_venue.items() if k != "keywords"}
                            venue_id = get_or_create_place(vd)
                            _known_venue_id_cache[vslug] = venue_id
                        venue_name_for_hash = matched_venue["name"]
                    else:
                        venue_id = org_venue_id
                        venue_name_for_hash = ORGANIZATION_NAME

                    # Categories from subhead ("Community • Nightlife • Food & Dining")
                    subhead = raw.get("subhead", "")
                    raw_tags = [t.strip() for t in subhead.split("•") if t.strip()]
                    is_midtown_alliance_event = any(
                        "midtown alliance" in t.lower() for t in raw_tags
                    )

                    category, subcategory = _infer_category(raw_tags, title, "")
                    tags = _build_tags(raw_tags, is_midtown_alliance_event, category, title.lower())

                    # Price — Midtown Alliance community events are typically free
                    price_min, price_max, price_note, is_free = _extract_price(title)
                    if is_midtown_alliance_event and not is_free and price_min is None:
                        is_free = True
                        price_min = 0.0
                        price_max = 0.0
                        price_note = "Free"

                    # Source URL from href
                    href = raw.get("href", "")
                    source_url = f"{BASE_URL}{href}" if href and href.startswith("/") else CALENDAR_URL

                    # Image from background style
                    bg_style = raw.get("bgStyle", "")
                    image_url = None
                    bg_match = re.search(r'url\(["\']?([^"\')]+)["\']?\)', bg_style)
                    if bg_match:
                        image_url = bg_match.group(1)

                    # Deduplication
                    hash_key = f"{start_date}|{start_time}" if start_time else start_date
                    content_hash = generate_content_hash(title, venue_name_for_hash, hash_key)

                    # Series hint
                    series_hint = _get_series_hint(title, raw_tags)
                    is_recurring = series_hint is not None

                    event_record: dict = {
                        "source_id": source_id,
                        "place_id": venue_id,
                        "title": title,
                        "description": None,
                        "start_date": start_date,
                        "start_time": start_time,
                        "end_date": None,
                        "end_time": end_time,
                        "is_all_day": False,
                        "category": category,
                        "subcategory": subcategory,
                        "tags": tags,
                        "price_min": price_min,
                        "price_max": price_max,
                        "price_note": price_note,
                        "is_free": is_free,
                        "source_url": source_url,
                        "ticket_url": source_url if source_url != CALENDAR_URL else None,
                        "image_url": image_url,
                        "raw_text": f"{title} {start_date}",
                        "extraction_confidence": 0.85,
                        "is_recurring": is_recurring,
                        "recurrence_rule": None,
                        "content_hash": content_hash,
                        "organization_name": ORGANIZATION_NAME,
                    }

                    # Venue name hints for downstream resolution if needed
                    if venue_text and venue_id == org_venue_id:
                        event_record["venue_name_hint"] = venue_text

                    events_found += 1

                    existing = find_event_by_hash(content_hash)
                    if existing:
                        smart_update_existing_event(existing, event_record)
                        events_updated += 1
                    else:
                        try:
                            insert_event(event_record, series_hint=series_hint)
                            events_new += 1
                            logger.info(
                                f"Midtown Alliance added: {title} on {start_date}"
                                + (f" at {venue_text}" if venue_text else "")
                            )
                        except Exception as exc:
                            logger.error(f"Midtown Alliance: insert failed for {title!r}: {exc}")

                except Exception as exc:
                    logger.warning(f"Midtown Alliance: error processing event {raw.get('title')!r}: {exc}")
                    continue

            browser.close()

        # Health check
        if events_found < 3:
            logger.warning(
                f"Midtown Alliance: only {events_found} events found — "
                "calendar structure may have changed or page is blocking crawl"
            )

        logger.info(
            f"Midtown Alliance crawl complete: {events_found} found, "
            f"{events_new} new, {events_updated} updated"
        )

    except Exception as exc:
        logger.error(f"Midtown Alliance: crawl failed: {exc}")
        if browser:
            try:
                browser.close()
            except Exception:
                pass
        raise

    return events_found, events_new, events_updated
