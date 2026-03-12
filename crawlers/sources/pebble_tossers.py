"""
Crawler for Pebble Tossers volunteer opportunities.
https://www.pebbletossers.org / https://www.givepulse.com/group/772370

Pebble Tossers is Atlanta's leading youth volunteer and service-learning nonprofit.
60+ partner nonprofits, Teen Leadership Program (TLP) across 10 metro counties.
Primary age range: 5-18 (younger children with a parent; teens independently).

Data source: GivePulse (givepulse.com) — Pebble Tossers' volunteer management platform.
Group ID: 772370

Access strategy:
  The GivePulse REST API (laravel-api.givepulse.com/api/v1/events) is gated behind
  a browser-origin HMAC (`request-key` header + `timestamp`) that cannot be replicated
  from a plain HTTP client. Playwright is required to load the public group page and
  intercept the API responses as the browser's own fetch calls them.

  Pagination: the group home page loads 10 events (page 1). Subsequent pages are loaded
  by navigating to ?page=N, which triggers another API call with the same auth context.
  Typically 4-6 pages of 10 events each (~40-60 total events, mostly upcoming).

Event types:
  - Dated events (event_type_raw != "nodate"): have start_date_time and are usable.
  - Ongoing / no-date opportunities: skipped (no actionable date for discovery).
  - Virtual events: skipped (HelpATL / Hooky are in-person products).
  - Multi-day ranges (e.g. "Mar 10 - Apr 30"): use start_date only.

Venue handling:
  Events happen at partner nonprofits across metro Atlanta, not at a single venue.
  latitude/longitude are almost never populated in the API response. We use the
  partner org name as the venue and set the city/state only; geocoding can be
  done via venue enrichment scripts. The Pebble Tossers HQ is registered as the
  fallback venue for events with no partner org info.

Series grouping:
  Recurring opportunities (e.g. "Big Trees: Forest & Trail Maintenance" monthly,
  "Beltline Beautification Project" monthly) are grouped into series so the feed
  shows one card with "See all dates" instead of 6+ individual rows.
  Series title = opportunity name (stable across months).
"""

from __future__ import annotations

import json
import logging
import re
from datetime import date, datetime
from typing import Optional

from db import (
    find_event_by_hash,
    get_or_create_venue,
    insert_event,
    smart_update_existing_event,
)
from dedupe import generate_content_hash
from utils import slugify

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

GIVEPULSE_GROUP_ID = 772370
GIVEPULSE_GROUP_URL = "https://www.givepulse.com/group/772370"
GIVEPULSE_EVENT_BASE = "https://www.givepulse.com"
PEBBLETOSSERS_URL = "https://www.pebbletossers.org"

# GivePulse API (requires browser session — accessed via Playwright interception)
GIVEPULSE_API_BASE = "https://laravel-api.givepulse.com/api/v1"
EVENTS_ENDPOINT = f"{GIVEPULSE_API_BASE}/events"

# How many GivePulse group page loads to do (each triggers one page of events)
# 6 pages × 10 events = up to 60 events. Adjust if the org grows.
MAX_PAGES = 8

# Lookahead: only import events starting within this many days
LOOKAHEAD_DAYS = 90

# Minimum spots remaining to consider an event (avoids showing sold-out opps)
MIN_SPOTS_TO_INCLUDE = 0  # 0 = include even if full (registration page is still useful)

# Default fallback venue — Pebble Tossers HQ in Dunwoody
PEBBLE_TOSSERS_VENUE: dict = {
    "name": "Pebble Tossers",
    "slug": "pebble-tossers",
    "address": "1155 Mount Vernon Hwy NE, Ste. 800",
    "neighborhood": "Dunwoody",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30338",
    "lat": 33.9415,
    "lng": -84.3467,
    "venue_type": "nonprofit_hq",
    "spot_type": "nonprofit_hq",
    "website": PEBBLETOSSERS_URL,
    "vibes": ["family-friendly", "all-ages"],
}

# Base tags applied to every Pebble Tossers event
BASE_TAGS = ["volunteer", "community", "family-friendly", "all-ages"]

# Tags inferred from event title / description keywords
KEYWORD_TAGS: list[tuple[list[str], list[str]]] = [
    # (keyword_list, tags_to_add)
    (["teen", "tlp", "leadership program"], ["teen"]),
    (["youth", "kids", "children", "families", "family"], ["kids", "elementary"]),
    (
        [
            "trail",
            "forest",
            "park",
            "beltline",
            "nature",
            "outdoor",
            "garden",
            "beautif",
        ],
        ["outdoor", "environment", "volunteer-outdoors"],
    ),
    (
        ["literacy", "book", "reading", "library", "stories"],
        ["educational", "education"],
    ),
    (["food", "hunger", "pantry", "meal", "sandwich", "snack"], ["food-security"]),
    (["art", "craft", "paint", "creative", "music"], ["arts", "hands-on"]),
    (["elder", "senior", "aging", "nursing"], ["health"]),
    (["animal", "pet", "dog", "cat", "wildlife"], ["environment"]),
    (["environment", "clean", "recycle", "scrap", "sort", "organiz"], ["environment"]),
    (["foster", "care", "child welfare"], ["kids"]),
    (["habitat", "build", "construct", "housing"], ["housing"]),
    (["esl", "english", "language"], ["educational", "education"]),
    (["africa", "global", "international"], ["educational"]),
    (["storytime", "story time", "read aloud"], ["educational", "kids", "hands-on"]),
    (["donate", "drive", "donation", "supply"], []),  # no extra tags needed
]


# ---------------------------------------------------------------------------
# Playwright helpers
# ---------------------------------------------------------------------------


def _fetch_events_via_playwright() -> list[dict]:
    """
    Load the Pebble Tossers GivePulse group page with Playwright and intercept
    the JSON API responses. Paginates by clicking numbered MUI pagination buttons.

    GivePulse uses a signed HMAC `request-key` header that only the browser can
    generate; plain HTTP requests return 403. The browser makes the API calls
    automatically as pagination buttons are clicked, and we intercept the responses.

    Returns a flat list of raw event dicts from the GivePulse API.
    Raises on import or browser failure.
    """
    import asyncio
    from playwright.async_api import async_playwright

    async def _run() -> list[dict]:
        all_events: list[dict] = []

        async with async_playwright() as pw:
            browser = await pw.chromium.launch(headless=True)
            context = await browser.new_context(
                user_agent=(
                    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/120.0.0.0 Safari/537.36"
                )
            )
            page = await context.new_page()

            # Intercept GivePulse events API responses as the browser makes them
            captured: dict[int, list[dict]] = {}

            async def on_response(response):
                url = response.url
                if EVENTS_ENDPOINT in url and f"group_id={GIVEPULSE_GROUP_ID}" in url:
                    try:
                        body = await response.text()
                        data = json.loads(body)
                        events = data.get("events") or []
                        m = re.search(r"page=(\d+)", url)
                        page_num = int(m.group(1)) if m else len(captured) + 1
                        captured[page_num] = events
                        logger.debug(
                            "GivePulse API page %d: %d events", page_num, len(events)
                        )
                    except Exception as exc:
                        logger.warning("Failed to parse GivePulse response: %s", exc)

            page.on("response", on_response)

            # Page 1: load the main group page (browser auto-fetches first events page)
            try:
                await page.goto(
                    GIVEPULSE_GROUP_URL,
                    wait_until="networkidle",
                    timeout=30000,
                )
            except Exception as exc:
                logger.warning("Timeout loading GivePulse group page: %s", exc)

            # Pages 2+: GivePulse renders MUI pagination buttons that trigger API calls
            # in-page when clicked. We click each numbered button and wait briefly for
            # the network response to be intercepted.
            for target_pg in range(2, MAX_PAGES + 1):
                # Find the MuiPaginationItem button labelled with the target page number
                btns = await page.query_selector_all("button.MuiPaginationItem-root")
                target_btn = None
                for btn in btns:
                    text = (await btn.inner_text()).strip()
                    if text == str(target_pg):
                        target_btn = btn
                        break

                if target_btn is None:
                    logger.debug(
                        "GivePulse: no pagination button for page %d — reached end",
                        target_pg,
                    )
                    break

                try:
                    await target_btn.click()
                    # Allow time for the API response to arrive and be captured
                    await page.wait_for_timeout(2000)
                except Exception as exc:
                    logger.warning(
                        "GivePulse: error clicking page %d button: %s", target_pg, exc
                    )
                    break

                # Stop early if the captured page came back empty
                if (
                    captured.get(target_pg) is not None
                    and len(captured[target_pg]) == 0
                ):
                    logger.debug(
                        "GivePulse: empty response on page %d, stopping", target_pg
                    )
                    break

            await browser.close()

        # Merge across pages in order
        for pg_num in sorted(captured.keys()):
            all_events.extend(captured[pg_num])

        return all_events

    return asyncio.run(_run())


# ---------------------------------------------------------------------------
# Parsing helpers
# ---------------------------------------------------------------------------


def _parse_givepulse_datetime(
    dt_str: Optional[str],
) -> tuple[Optional[str], Optional[str]]:
    """
    Parse a GivePulse datetime string ('2026-03-14 09:30:00') into
    (YYYY-MM-DD, HH:MM). Returns (None, None) on failure.
    """
    if not dt_str:
        return None, None
    try:
        dt = datetime.strptime(dt_str.strip(), "%Y-%m-%d %H:%M:%S")
        return dt.strftime("%Y-%m-%d"), dt.strftime("%H:%M")
    except ValueError:
        # Try date-only
        try:
            dt = datetime.strptime(dt_str.strip()[:10], "%Y-%m-%d")
            return dt.strftime("%Y-%m-%d"), None
        except ValueError:
            return None, None


def _is_within_lookahead(start_date_str: str) -> bool:
    """Return True if start_date_str is today or within LOOKAHEAD_DAYS."""
    try:
        event_date = date.fromisoformat(start_date_str)
        today = date.today()
        return (
            today
            <= event_date
            <= today.replace(year=today.year + (1 if today.month > 9 else 0))
            and (event_date - today).days <= LOOKAHEAD_DAYS
        )
    except ValueError:
        return False


def _strip_html(html_str: str) -> str:
    """Strip HTML tags and collapse whitespace."""
    if not html_str:
        return ""
    clean = re.sub(r"<[^>]+>", " ", html_str)
    clean = re.sub(r"&nbsp;", " ", clean)
    clean = re.sub(r"&amp;", "&", clean)
    clean = re.sub(r"&lt;", "<", clean)
    clean = re.sub(r"&gt;", ">", clean)
    clean = re.sub(r"&[a-z]+;", "", clean)
    return re.sub(r"\s+", " ", clean).strip()


def _infer_tags(title: str, description: str) -> list[str]:
    """Infer content tags from title and description keywords."""
    combined = (title + " " + description).lower()
    tags: list[str] = list(BASE_TAGS)
    seen = set(tags)

    for keywords, extra_tags in KEYWORD_TAGS:
        if any(kw in combined for kw in keywords):
            for t in extra_tags:
                if t not in seen:
                    tags.append(t)
                    seen.add(t)

    # Outdoor events get "outdoor" tag if not already added
    if "outdoor" not in seen and any(
        kw in combined for kw in ["outside", "outdoors", "trail", "park", "garden"]
    ):
        tags.append("outdoor")

    return tags


def _build_venue_data(raw_event: dict) -> dict:
    """
    Build a venue data dict from a GivePulse event record.

    The 'group' field on the event indicates the hosting nonprofit.
    If different from Pebble Tossers, that org becomes the venue.
    Coordinates are almost never populated in the API response; the venue
    enrichment pipeline will geocode them from the address.
    """
    group = raw_event.get("group") or {}
    org_name = (group.get("title") or "").strip()

    # If no partner org, or it's Pebble Tossers themselves, use HQ venue
    if not org_name or "pebble tossers" in org_name.lower():
        return dict(PEBBLE_TOSSERS_VENUE)

    lat = raw_event.get("latitude")
    lng = raw_event.get("longitude")

    venue: dict = {
        "name": org_name,
        "slug": slugify(org_name),
        "city": "Atlanta",
        "state": "GA",
        "venue_type": "nonprofit_hq",
        "spot_type": "nonprofit_hq",
    }
    if lat and lng:
        try:
            venue["lat"] = float(lat)
            venue["lng"] = float(lng)
        except (TypeError, ValueError):
            pass

    return venue


def _detect_series(title: str, events_with_title: list[dict]) -> Optional[dict]:
    """
    Return a series_hint if this title appears multiple times in the batch
    (indicating a recurring opportunity).
    """
    if len(events_with_title) < 2:
        return None

    # Infer frequency from date gaps
    dates: list[date] = []
    for e in events_with_title:
        start_str, _ = _parse_givepulse_datetime(e.get("start_date_time"))
        if start_str:
            try:
                dates.append(date.fromisoformat(start_str))
            except ValueError:
                pass

    if len(dates) < 2:
        return {
            "series_type": "recurring_show",
            "series_title": title,
            "frequency": "irregular",
        }

    dates.sort()
    gaps = [(dates[i + 1] - dates[i]).days for i in range(len(dates) - 1)]
    avg_gap = sum(gaps) / len(gaps) if gaps else 0

    if avg_gap <= 1.5:
        frequency = "daily"
    elif 5 <= avg_gap <= 9:
        frequency = "weekly"
    elif 12 <= avg_gap <= 16:
        frequency = "biweekly"
    elif 25 <= avg_gap <= 35:
        frequency = "monthly"
    else:
        frequency = "irregular"

    return {
        "series_type": "recurring_show",
        "series_title": title,
        "frequency": frequency,
    }


# ---------------------------------------------------------------------------
# Main crawl function
# ---------------------------------------------------------------------------


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl Pebble Tossers volunteer opportunities via GivePulse.

    Uses Playwright to load the public group page and intercept the JSON API
    responses, then upserts each dated, in-person event.

    Returns (events_found, events_new, events_updated).
    """
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    # Step 1: Fetch events via Playwright
    logger.info("Fetching Pebble Tossers events from GivePulse via Playwright")
    try:
        raw_events = _fetch_events_via_playwright()
    except Exception as exc:
        logger.error("Failed to fetch Pebble Tossers events from GivePulse: %s", exc)
        raise

    logger.info("GivePulse returned %d raw events for Pebble Tossers", len(raw_events))

    # Step 2: Filter to actionable events
    # Skip: no-date (ongoing), virtual, past, and beyond lookahead window
    actionable: list[dict] = []
    skipped_nodate = 0
    skipped_virtual = 0
    skipped_past = 0
    skipped_lookahead = 0

    today = date.today()

    for evt in raw_events:
        # Skip ongoing/no-date opportunities
        if evt.get("event_type_raw") == "nodate" or evt.get("is_open_opp"):
            skipped_nodate += 1
            continue

        # Skip virtual events (in-person discovery platform)
        if evt.get("virtual"):
            skipped_virtual += 1
            continue

        start_str, _ = _parse_givepulse_datetime(evt.get("start_date_time"))
        if not start_str:
            skipped_nodate += 1
            continue

        try:
            evt_date = date.fromisoformat(start_str)
        except ValueError:
            skipped_nodate += 1
            continue

        if evt_date < today:
            skipped_past += 1
            continue

        if (evt_date - today).days > LOOKAHEAD_DAYS:
            skipped_lookahead += 1
            continue

        actionable.append(evt)

    logger.info(
        "Pebble Tossers: %d actionable events | skipped: %d no-date, %d virtual, "
        "%d past, %d beyond %d-day window",
        len(actionable),
        skipped_nodate,
        skipped_virtual,
        skipped_past,
        skipped_lookahead,
        LOOKAHEAD_DAYS,
    )

    if not actionable:
        logger.warning(
            "Pebble Tossers: no actionable events found — check GivePulse page "
            "or increase LOOKAHEAD_DAYS (%d)",
            LOOKAHEAD_DAYS,
        )
        return 0, 0, 0

    # Step 3: Group by title for series detection
    title_groups: dict[str, list[dict]] = {}
    for evt in actionable:
        title = (evt.get("title") or "").strip()
        title_groups.setdefault(title, []).append(evt)

    # Step 4: Upsert each event
    for evt in actionable:
        title = (evt.get("title") or "").strip()
        if not title:
            continue

        event_id = evt.get("event_id")
        path = evt.get("path") or f"/event/{event_id}"
        source_url = f"{GIVEPULSE_EVENT_BASE}{path}"

        start_str, start_time = _parse_givepulse_datetime(evt.get("start_date_time"))
        end_str, end_time = _parse_givepulse_datetime(evt.get("end_date_time"))

        if not start_str:
            continue

        # Build description
        raw_desc = _strip_html(evt.get("description") or "")
        if raw_desc and len(raw_desc) > 1800:
            raw_desc = raw_desc[:1800]

        # Image
        cover = evt.get("cover") or {}
        image_url: Optional[str] = cover.get("url") if isinstance(cover, dict) else None

        # Build/get venue
        venue_data = _build_venue_data(evt)
        try:
            venue_id = get_or_create_venue(venue_data)
        except Exception as exc:
            logger.warning("Could not create venue for '%s': %s", title, exc)
            continue

        venue_name = venue_data["name"]

        # Tags
        tags = _infer_tags(title, raw_desc)

        # Registration info
        is_free = True  # Pebble Tossers volunteer events are free to participate

        # Multi-day events: use start_date from range, no end_date in DB record
        # (avoids feed confusion about event duration)
        event_type_raw = evt.get("event_type_raw", "")
        is_multiday_range = event_type_raw == "multiday" and evt.get("end_date_time")

        # Series hint for recurring opportunities
        is_recurring = len(title_groups.get(title, [])) > 1
        series_hint = None
        if is_recurring:
            series_hint = _detect_series(title, title_groups[title])

        # For same-day multi-timeslot events (e.g. "Books for Africa 9am" and
        # "Books for Africa 1pm" on the same date), include the start_time in the
        # hash key so each timeslot gets a unique hash.
        hash_title = title if not start_time else f"{title} {start_time}"
        content_hash = generate_content_hash(hash_title, venue_name, start_str)

        event_record: dict = {
            "source_id": source_id,
            "venue_id": venue_id,
            "title": title[:300],
            "description": raw_desc or None,
            "start_date": start_str,
            "start_time": start_time or None,
            "end_date": end_str if not is_multiday_range else None,
            "end_time": end_time or None,
            "is_all_day": start_time is None and not is_multiday_range,
            "category": "community",
            "subcategory": "volunteer",
            "tags": tags,
            "price_min": 0,
            "price_max": 0,
            "price_note": "Free — volunteer opportunity",
            "is_free": is_free,
            "source_url": source_url,
            "ticket_url": source_url,
            "image_url": image_url,
            "raw_text": None,
            "extraction_confidence": 0.92,
            "is_recurring": is_recurring,
            "recurrence_rule": None,
            "content_hash": content_hash,
        }

        events_found += 1
        existing = find_event_by_hash(content_hash)

        if existing:
            smart_update_existing_event(existing, event_record)
            events_updated += 1
            continue

        try:
            insert_event(event_record, series_hint=series_hint)
            events_new += 1
            logger.debug("Added: %s on %s", title[:60], start_str)
        except Exception as exc:
            logger.error("Failed to insert '%s' on %s: %s", title[:60], start_str, exc)
            events_found -= 1

    logger.info(
        "Pebble Tossers crawl complete: %d found, %d new, %d updated",
        events_found,
        events_new,
        events_updated,
    )
    return events_found, events_new, events_updated
