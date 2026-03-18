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
    get_or_create_venue,
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
    "venue_type": "organization",
    "spot_type": "organization",
    "website": BASE_URL,
    "description": (
        "Midtown Alliance is the Business Improvement District for Midtown Atlanta. "
        "They organize community programming including free yoga in parks, cardio dance "
        "at MARTA stations, mural events, and neighborhood activations throughout Midtown."
    ),
    "vibes": ["community", "outdoor", "free", "neighborhood"],
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
        "venue_type": "park",
        "spot_type": "park",
        "website": BASE_URL,
        "vibes": ["outdoor", "free", "community"],
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
        "venue_type": "community_center",
        "spot_type": "community_center",
        "website": "https://www.itsmarta.com",
        "vibes": ["community", "free", "transit"],
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
        "venue_type": "theater",
        "spot_type": "theater",
        "website": "https://www.ferstcenter.org",
        "vibes": ["performing-arts", "georgia-tech"],
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
        "venue_type": "church",
        "spot_type": "community_center",
        "website": "https://www.allsaintsatlanta.org",
        "vibes": ["community", "historic"],
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
    "music": ("music", None),
    "film": ("film", None),
    "theater": ("theater", None),
    "wellness": ("wellness", None),
    "fitness": ("fitness", None),
    "family": ("family", None),
    "education": ("learning", None),
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


def _parse_date_time(date_str: str) -> tuple[Optional[str], Optional[str], Optional[str]]:
    """
    Parse a date/time string from the Midtown Alliance calendar.

    Observed formats:
      - "March 22, 2026"
      - "Saturday, March 22, 2026"
      - "March 22, 2026 10:00 AM"
      - "Saturday, March 22, 2026 10:00 AM - 11:00 AM"

    Returns (start_date, start_time, end_time) in normalized form.
    start_date: "YYYY-MM-DD" or None
    start_time: "HH:MM" (24h) or None
    end_time:   "HH:MM" (24h) or None
    """
    if not date_str:
        return None, None, None

    date_str = re.sub(r"\s+", " ", date_str.strip())

    # Strip leading day-of-week if present (e.g. "Saturday, March 22, 2026")
    date_str = re.sub(
        r"^(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s*",
        "",
        date_str,
        flags=re.IGNORECASE,
    )

    # Extract time range if present: "10:00 AM - 11:00 AM" or "6pm - 7pm"
    time_range_match = re.search(
        r"(\d{1,2}(?::\d{2})?\s*[APap][Mm])\s*[-–]\s*(\d{1,2}(?::\d{2})?\s*[APap][Mm])",
        date_str,
    )
    single_time_match = re.search(
        r"(\d{1,2}(?::\d{2})?\s*[APap][Mm])",
        date_str,
    )

    start_time: Optional[str] = None
    end_time: Optional[str] = None

    def _parse_12h(t: str) -> Optional[str]:
        t = t.strip().upper()
        t = re.sub(r"\s+", "", t)
        for fmt in ("%I:%M%p", "%I%p"):
            try:
                return datetime.strptime(t, fmt).strftime("%H:%M")
            except ValueError:
                pass
        return None

    if time_range_match:
        start_time = _parse_12h(time_range_match.group(1))
        end_time = _parse_12h(time_range_match.group(2))
    elif single_time_match:
        start_time = _parse_12h(single_time_match.group(1))

    # Strip time portion from date string before parsing the date
    date_only = re.sub(
        r"\s*\d{1,2}(?::\d{2})?\s*[APap][Mm].*$", "", date_str
    ).strip().rstrip(",").strip()

    start_date: Optional[str] = None
    for fmt in ("%B %d, %Y", "%b %d, %Y", "%m/%d/%Y", "%Y-%m-%d"):
        try:
            dt = datetime.strptime(date_only, fmt)
            start_date = dt.strftime("%Y-%m-%d")
            break
        except ValueError:
            continue

    return start_date, start_time, end_time


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

    Returns a list of dicts with raw strings (title, date_text, time_text,
    venue_text, tags, description, source_url, image_url).
    """
    events: list[dict] = []

    # The midtownatl.com events calendar renders event cards via JavaScript.
    # We extract structured data from the DOM using page.evaluate().
    try:
        raw_events = page.evaluate("""
            () => {
                const results = [];

                // Midtown Alliance uses various event card layouts.
                // Try multiple selector strategies to be resilient.

                // Strategy 1: Structured event card containers
                const cardSelectors = [
                    'article[class*="event"]',
                    'div[class*="event-item"]',
                    'div[class*="event-card"]',
                    'li[class*="event"]',
                    '.events-list > *',
                    '[data-event-id]',
                ];

                let cards = [];
                for (const sel of cardSelectors) {
                    cards = document.querySelectorAll(sel);
                    if (cards.length > 0) break;
                }

                // Strategy 2: Fall back to any container with a date-like element
                if (cards.length === 0) {
                    // Look for containers that have both a heading and a time element
                    const allContainers = document.querySelectorAll(
                        'article, .card, [class*="listing"], [class*="item"]'
                    );
                    cards = Array.from(allContainers).filter(el => {
                        return el.querySelector('h2, h3, h4, [class*="title"]') &&
                               (el.querySelector('time, [class*="date"]') ||
                                /\\d{1,2}[,\\s]+\\d{4}/.test(el.textContent));
                    });
                }

                cards.forEach(card => {
                    try {
                        // Title
                        const titleEl = card.querySelector(
                            'h2, h3, h4, [class*="title"], a[class*="title"]'
                        );
                        const title = titleEl ? titleEl.textContent.trim() : '';
                        if (!title || title.length < 3) return;

                        // Source URL
                        const linkEl = card.querySelector('a[href]') ||
                                       (titleEl && titleEl.closest('a')) ||
                                       (titleEl && titleEl.querySelector('a'));
                        let sourceUrl = linkEl ? linkEl.href : '';
                        // Only keep internal links to the site
                        if (sourceUrl && !sourceUrl.includes('midtownatl.com')) {
                            sourceUrl = '';
                        }

                        // Date/time
                        const timeEl = card.querySelector('time');
                        const dateEl = card.querySelector(
                            '[class*="date"], [class*="time"], [class*="when"]'
                        );
                        let dateText = timeEl
                            ? (timeEl.getAttribute('datetime') || timeEl.textContent.trim())
                            : (dateEl ? dateEl.textContent.trim() : '');

                        // Venue
                        const venueEl = card.querySelector(
                            '[class*="venue"], [class*="location"], [class*="where"]'
                        );
                        let venueText = venueEl ? venueEl.textContent.trim() : '';

                        // Some layouts show "time / venue" inline
                        // e.g. "6pm - 7pm / MARTA - North Avenue Station"
                        const cardText = card.innerText || card.textContent || '';
                        const timeVenueMatch = cardText.match(
                            /(\d{1,2}(?::\d{2})?\s*[aApP][mM]\s*[-–]\s*\d{1,2}(?::\d{2})?\s*[aApP][mM])\s*\/\s*(.+?)(?=\\n|$)/
                        );
                        let timeText = '';
                        if (timeVenueMatch) {
                            timeText = timeVenueMatch[1].trim();
                            if (!venueText) venueText = timeVenueMatch[2].trim();
                        }

                        // Tags / category pills
                        const tagEls = card.querySelectorAll(
                            '[class*="tag"], [class*="category"], [class*="label"], [class*="badge"]'
                        );
                        const tags = Array.from(tagEls).map(el => el.textContent.trim()).filter(Boolean);

                        // Description
                        const descEl = card.querySelector(
                            '[class*="desc"], [class*="excerpt"], p'
                        );
                        const description = descEl ? descEl.textContent.trim() : '';

                        // Image
                        const imgEl = card.querySelector('img[src]');
                        const imageUrl = imgEl ? imgEl.src : '';

                        results.push({
                            title,
                            dateText: dateText.replace(/\\s+/g, ' ').trim(),
                            timeText: timeText.replace(/\\s+/g, ' ').trim(),
                            venueText: venueText.replace(/\\s+/g, ' ').trim(),
                            tags,
                            description: description.replace(/\\s+/g, ' ').trim(),
                            sourceUrl,
                            imageUrl,
                        });
                    } catch (e) {
                        // Skip malformed cards
                    }
                });

                return results;
            }
        """)

        if raw_events:
            logger.info(f"Midtown Alliance: extracted {len(raw_events)} event cards via DOM")
            return raw_events

    except Exception as exc:
        logger.warning(f"Midtown Alliance: DOM extraction failed: {exc}")

    # -----------------------------------------------------------------------
    # Fallback: Parse from page body text
    # -----------------------------------------------------------------------
    try:
        body_text = page.inner_text("body")
        events = _parse_events_from_body_text(body_text)
        logger.info(f"Midtown Alliance: extracted {len(events)} events via body text fallback")
        return events
    except Exception as exc:
        logger.warning(f"Midtown Alliance: body text fallback failed: {exc}")

    return []


def _parse_events_from_body_text(body_text: str) -> list[dict]:
    """
    Fallback parser: extract events from plain body text.
    Looks for repeating blocks: title → date → venue → tags.
    """
    events: list[dict] = []
    lines = [line.strip() for line in body_text.split("\n") if line.strip()]

    _SKIP = {
        "skip to content", "home", "about", "events", "development", "transportation",
        "safety", "advocacy", "contact", "sign in", "search", "menu", "donate",
        "view event calendar", "load more", "filter", "all events",
    }

    i = 0
    now = date.today()

    while i < len(lines):
        line = lines[i]

        if line.lower() in _SKIP or len(line) < 4:
            i += 1
            continue

        # Look for a date line: "March 22, 2026" or "Saturday, March 22, 2026"
        date_match = re.match(
            r"(?:(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),\s*)?"
            r"(January|February|March|April|May|June|July|August|September|October|November|December)"
            r"\s+\d{1,2},\s+\d{4}",
            line,
            re.IGNORECASE,
        )

        if date_match:
            # Heuristic: the event title is likely within 3 lines before or after the date
            title_candidate = None
            for offset in [-2, -1, 1, 2]:
                idx = i + offset
                if 0 <= idx < len(lines):
                    candidate = lines[idx]
                    if (
                        candidate.lower() not in _SKIP
                        and len(candidate) >= 4
                        and not re.match(r"^\d{1,2}:\d{2}", candidate)
                        and not re.match(
                            r"(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)",
                            candidate,
                            re.IGNORECASE,
                        )
                    ):
                        title_candidate = candidate
                        break

            if not title_candidate:
                i += 1
                continue

            date_str = line
            start_date, start_time, end_time = _parse_date_time(date_str)

            if not start_date:
                i += 1
                continue

            try:
                parsed_date = datetime.strptime(start_date, "%Y-%m-%d").date()
                if parsed_date < now:
                    i += 1
                    continue
            except ValueError:
                i += 1
                continue

            # Collect tags from nearby lines
            tags: list[str] = []
            for look_offset in range(1, 5):
                look_idx = i + look_offset
                if look_idx >= len(lines):
                    break
                look_line = lines[look_idx]
                if look_line in ("Midtown Alliance Event", "Sports & Recreation",
                                 "Community", "Nightlife", "Food & Dining",
                                 "Arts & Exhibitions", "Music", "Film", "Wellness"):
                    tags.append(look_line)

            events.append({
                "title": title_candidate,
                "dateText": date_str,
                "timeText": "",
                "venueText": "",
                "tags": tags,
                "description": "",
                "sourceUrl": CALENDAR_URL,
                "imageUrl": "",
            })

        i += 1

    return events


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
            org_venue_id = get_or_create_venue(ORG_VENUE_DATA)

            # Persist any og: enrichment to the org venue record
            try:
                venue_update: dict = {}
                if ORG_VENUE_DATA.get("image_url"):
                    venue_update["image_url"] = ORG_VENUE_DATA["image_url"]
                if ORG_VENUE_DATA.get("description"):
                    venue_update["description"] = ORG_VENUE_DATA["description"]
                if venue_update:
                    get_client().table("venues").update(venue_update).eq("id", org_venue_id).execute()
                    logger.debug("Midtown Alliance: org venue enriched with og: data")
            except Exception as exc:
                logger.warning(f"Midtown Alliance: org venue update failed: {exc}")

            # Pre-create known Midtown venue records so they're available for matching
            _known_venue_id_cache: dict[str, int] = {}
            for vdata in _KNOWN_VENUES:
                try:
                    vslug = vdata["slug"]
                    vd = {k: v for k, v in vdata.items() if k != "keywords"}
                    vid = get_or_create_venue(vd)
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

                    # Parse date/time from dateText + timeText
                    date_text = raw.get("dateText", "")
                    time_text = raw.get("timeText", "")
                    combined_dt = f"{date_text} {time_text}".strip()
                    start_date, start_time, end_time = _parse_date_time(combined_dt)

                    if not start_date:
                        logger.debug(f"Midtown Alliance: skipping {title!r} — could not parse date from {combined_dt!r}")
                        continue

                    try:
                        parsed_date = datetime.strptime(start_date, "%Y-%m-%d").date()
                        if parsed_date < today:
                            continue
                    except ValueError:
                        continue

                    # Determine venue
                    venue_text = (raw.get("venueText") or "").strip()
                    matched_venue = _match_venue(venue_text)

                    if matched_venue:
                        vslug = matched_venue["slug"]
                        if vslug in _known_venue_id_cache:
                            venue_id = _known_venue_id_cache[vslug]
                        else:
                            vd = {k: v for k, v in matched_venue.items() if k != "keywords"}
                            venue_id = get_or_create_venue(vd)
                            _known_venue_id_cache[vslug] = venue_id
                        venue_name_for_hash = matched_venue["name"]
                    else:
                        venue_id = org_venue_id
                        venue_name_for_hash = ORGANIZATION_NAME

                    # Tags and category
                    raw_tags: list[str] = [t for t in (raw.get("tags") or []) if t]
                    is_midtown_alliance_event = any(
                        "midtown alliance" in t.lower() for t in raw_tags
                    )

                    description = (raw.get("description") or "").strip()
                    category, subcategory = _infer_category(raw_tags, title, description)
                    tags = _build_tags(raw_tags, is_midtown_alliance_event, category, title.lower())

                    # Price
                    price_min, price_max, price_note, is_free = _extract_price(
                        f"{title} {description}"
                    )
                    # Midtown Alliance community events are typically free
                    if is_midtown_alliance_event and is_free is False and price_min is None:
                        is_free = True
                        price_min = 0.0
                        price_max = 0.0
                        price_note = "Free"

                    # Source URL
                    source_url = (raw.get("sourceUrl") or "").strip() or CALENDAR_URL
                    image_url = (raw.get("imageUrl") or "").strip() or None

                    # Deduplication
                    hash_key = f"{start_date}|{start_time}" if start_time else start_date
                    content_hash = generate_content_hash(title, venue_name_for_hash, hash_key)

                    # Series hint
                    series_hint = _get_series_hint(title, raw_tags)
                    is_recurring = series_hint is not None

                    event_record: dict = {
                        "source_id": source_id,
                        "venue_id": venue_id,
                        "title": title,
                        "description": description or None,
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
