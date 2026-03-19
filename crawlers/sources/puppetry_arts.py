"""
Crawler for Center for Puppetry Arts (puppet.org).
World-class puppetry museum and performance venue in Midtown Atlanta.

Strategy:
  1. Fetch the programs listing pages (puppet shows + events/workshops)
     to discover individual show URLs.
  2. For each show URL, parse the embedded performance JSON blob that
     lists every scheduled performance with date, time, and price.
  3. Extract age-range text from surrounding HTML.
  4. Emit one event record per performance (date + time slot).

No Playwright needed — the performance data lives in a <script> block
that BeautifulSoup can parse directly.
"""

from __future__ import annotations

import json
import logging
import re
import time
from datetime import datetime
from typing import Optional
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

from db import (
    get_client,
    find_event_by_hash,
    get_or_create_venue,
    insert_event,
    smart_update_existing_event,
)
from dedupe import generate_content_hash
from entity_lanes import SourceEntityCapabilities, TypedEntityEnvelope
from entity_persistence import persist_typed_entity_envelope

logger = logging.getLogger(__name__)

SOURCE_ENTITY_CAPABILITIES = SourceEntityCapabilities(
    events=True,
    destinations=True,
    destination_details=True,
    venue_features=True,
)

BASE_URL = "https://puppet.org"
PROGRAMS_URLS = [
    f"{BASE_URL}/programs/?type=puppet-show",
    f"{BASE_URL}/programs/?type=events-and-workshops",
]

REQUEST_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/122.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
}

# Polite delay between requests (seconds)
REQUEST_DELAY = 1.0

VENUE_DATA = {
    "name": "Center for Puppetry Arts",
    "slug": "center-for-puppetry-arts",
    "address": "1404 Spring St NW",
    "neighborhood": "Midtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30309",
    "lat": 33.7879,
    "lng": -84.3916,
    "venue_type": "theater",
    "spot_type": "theater",
    "website": BASE_URL,
    "vibes": ["family-friendly", "artsy", "all-ages"],
    "description": (
        "The Center for Puppetry Arts is the largest nonprofit organization "
        "in the United States dedicated to the art of puppetry. Located in "
        "Midtown Atlanta, it presents world-class performances, workshops, "
        "and houses the Jim Henson Collection museum."
    ),
    "hours": {
        "monday": None,
        "tuesday": {"open": "09:00", "close": "17:00"},
        "wednesday": {"open": "09:00", "close": "17:00"},
        "thursday": {"open": "09:00", "close": "17:00"},
        "friday": {"open": "09:00", "close": "17:00"},
        "saturday": {"open": "10:00", "close": "17:00"},
        "sunday": {"open": "12:00", "close": "17:00"},
    },
}


def _build_destination_envelope(venue_id: int) -> TypedEntityEnvelope:
    envelope = TypedEntityEnvelope()
    envelope.add(
        "destination_details",
        {
            "venue_id": venue_id,
            "destination_type": "puppetry_museum",
            "commitment_tier": "halfday",
            "primary_activity": "family puppetry museum and show visit",
            "best_seasons": ["spring", "summer", "fall", "winter"],
            "weather_fit_tags": ["indoor", "rainy-day", "heat-day", "family-daytrip"],
            "parking_type": "paid_lot",
            "best_time_of_day": "afternoon",
            "practical_notes": (
                "The Center works especially well as a half-day indoor family outing because museum galleries, "
                "hands-on activities, and performances can be stacked into one visit without requiring a huge walking day."
            ),
            "accessibility_notes": (
                "Indoor museum-and-theater circulation makes the Center easier for strollers and lower-energy family outings "
                "than destinations built around long exterior walking."
            ),
            "family_suitability": "yes",
            "reservation_required": False,
            "permit_required": False,
            "fee_note": "Performance tickets and museum admission vary by show and package; it remains one of the city's strongest indoor family culture destinations.",
            "source_url": BASE_URL,
            "metadata": {
                "source_type": "family_destination_enrichment",
                "venue_type": "theater",
                "city": "atlanta",
            },
        },
    )
    envelope.add(
        "venue_features",
        {
            "venue_id": venue_id,
            "slug": "jim-henson-collection-and-museum-galleries",
            "title": "Jim Henson Collection and museum galleries",
            "feature_type": "attraction",
            "description": "The Center for Puppetry Arts pairs performances with museum galleries, including the Jim Henson Collection, making it more than a single-show destination.",
            "url": BASE_URL,
            "is_free": False,
            "sort_order": 10,
        },
    )
    envelope.add(
        "venue_features",
        {
            "venue_id": venue_id,
            "slug": "family-puppet-performances-and-workshops",
            "title": "Family puppet performances and workshops",
            "feature_type": "amenity",
            "description": "Shows, workshops, and hands-on puppet-making give families multiple reasons to stay beyond the performance itself.",
            "url": PROGRAMS_URLS[0],
            "is_free": False,
            "sort_order": 20,
        },
    )
    envelope.add(
        "venue_features",
        {
            "venue_id": venue_id,
            "slug": "indoor-half-day-family-stack",
            "title": "Indoor half-day family stack",
            "feature_type": "experience",
            "description": "The Center combines museum galleries, performances, and hands-on activities in one indoor stop, which makes it unusually practical for a fuller family outing without lots of transit between stops.",
            "url": BASE_URL,
            "is_free": False,
            "sort_order": 30,
        },
    )
    return envelope


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _get(url: str, session: requests.Session, *, retries: int = 3) -> Optional[str]:
    """Fetch URL with retry/backoff, return HTML text or None."""
    for attempt in range(1, retries + 1):
        try:
            resp = session.get(url, headers=REQUEST_HEADERS, timeout=30)
            resp.raise_for_status()
            return resp.text
        except requests.RequestException as exc:
            if attempt >= retries:
                logger.warning("Failed to fetch %s after %d attempts: %s", url, retries, exc)
                return None
            time.sleep(1.5 * attempt)
    return None


def _parse_show_urls(html: str, listing_url: str) -> list[str]:
    """Extract individual show/program page URLs from a programs listing page."""
    soup = BeautifulSoup(html, "html.parser")
    urls: list[str] = []
    seen: set[str] = set()

    card_links = soup.select(
        ".puppets-archive__grid article.card-events a.wp-block-button__link[href], "
        ".puppets-archive__grid article.card-events h4.card-events__title a[href], "
        ".puppets-archive__grid article.card-events a[href]"
    )

    for a in card_links:
        href = a.get("href")
        if not href or not re.search(r"/programs/[^/?#]+/?$", href):
            continue
        absolute = urljoin(BASE_URL, href)
        if absolute in seen:
            continue
        seen.add(absolute)
        urls.append(absolute)

    return urls


def _extract_performances_json(html: str) -> dict:
    """
    Pull the performances JSON blob embedded in a script tag.

    The site embeds data as one of:
      var performances = {...};
      window.performances = {...};
      {"performances": {...}}
    Returns the inner "performances" dict (keyed by ID) or {}.
    """
    soup = BeautifulSoup(html, "html.parser")

    perf_json = soup.select_one(".perf-json")
    if perf_json:
        raw = perf_json.get_text(strip=True)
        if raw:
            try:
                data = json.loads(raw)
            except json.JSONDecodeError:
                data = None
            if isinstance(data, dict):
                performances = data.get("performances")
                if isinstance(performances, dict):
                    return performances

    for script in soup.find_all("script"):
        text = script.string or script.get_text() or ""
        if "performances" not in text:
            continue

        # Pattern 1: var performances = { ... }; or window.performances = { ... };
        m = re.search(r'(?:var\s+performances|window\.performances)\s*=\s*(\{.*?\});', text, re.DOTALL)
        if m:
            try:
                return json.loads(m.group(1))
            except json.JSONDecodeError:
                pass

        # Pattern 2: bare JSON blob containing a "performances" key
        m = re.search(r'(\{"performances"\s*:\s*\{.*?\})\s*[,;]?', text, re.DOTALL)
        if m:
            try:
                outer = json.loads(m.group(1))
                return outer.get("performances", {})
            except json.JSONDecodeError:
                pass

        # Pattern 3: JSON anywhere in the script block
        for candidate in re.findall(r'\{[^{}]{20,}\}', text, re.DOTALL):
            try:
                data = json.loads(candidate)
                if isinstance(data, dict) and "performances" in data:
                    return data["performances"]
                if isinstance(data, dict) and any(
                    isinstance(v, dict) and "PerfDate" in v
                    for v in data.values()
                ):
                    return data
            except (json.JSONDecodeError, TypeError):
                continue

    return {}


def _extract_age_range(html: str) -> tuple[Optional[int], Optional[int]]:
    """
    Extract age_min / age_max from phrases like:
      "Ages 4+" → (4, None)
      "Ages 4-8" → (4, 8)
      "Ages 8 and up" → (8, None)
    Returns (age_min, age_max) as ints or None.
    """
    soup = BeautifulSoup(html, "html.parser")
    text = soup.get_text(" ")

    # "Ages 4-8" or "Ages 4 - 8"
    m = re.search(r'[Aa]ges?\s+(\d+)\s*[-–]\s*(\d+)', text)
    if m:
        return int(m.group(1)), int(m.group(2))

    # "Ages 4+" or "Ages 4 and up" or "Ages 4+"
    m = re.search(r'[Aa]ges?\s+(\d+)\s*(?:\+|and\s+up)', text)
    if m:
        return int(m.group(1)), None

    # "4 and up" without "Ages"
    m = re.search(r'(\d+)\s+and\s+up', text, re.IGNORECASE)
    if m:
        return int(m.group(1)), None

    return None, None


def _extract_og_image(html: str) -> Optional[str]:
    """Pull og:image URL from the page's Open Graph meta tags."""
    soup = BeautifulSoup(html, "html.parser")
    tag = soup.find("meta", property="og:image")
    if tag and tag.get("content"):
        return tag["content"]
    # Fallback: look for a hero/featured image
    img = soup.find("img", class_=re.compile(r"hero|featured|show|poster", re.IGNORECASE))
    if img and img.get("src"):
        return urljoin(BASE_URL, img["src"])
    return None


def _extract_show_title(html: str, fallback_url: str) -> str:
    """Extract the canonical show title from the page."""
    soup = BeautifulSoup(html, "html.parser")

    # Prefer the page <h1>
    h1 = soup.find("h1")
    if h1:
        title = h1.get_text(" ", strip=True)
        if title and len(title) > 2:
            return title

    # og:title next
    meta = soup.find("meta", property="og:title")
    if meta and meta.get("content"):
        t = meta["content"].strip()
        # Strip site-name suffix like " | Center for Puppetry Arts"
        t = re.sub(r'\s*[|–-]\s*Center for Puppetry Arts.*$', '', t, flags=re.IGNORECASE)
        if t:
            return t

    # Fall back to the last path segment of the URL
    slug = fallback_url.rstrip("/").rsplit("/", 1)[-1]
    return slug.replace("-", " ").title()


def _extract_description(html: str) -> Optional[str]:
    """Extract a plain-text show description from the page."""
    soup = BeautifulSoup(html, "html.parser")

    # Try meta description first
    meta = soup.find("meta", attrs={"name": "description"})
    if meta and meta.get("content"):
        desc = meta["content"].strip()
        if len(desc) > 40:
            return desc[:1000]

    # og:description
    og = soup.find("meta", property="og:description")
    if og and og.get("content"):
        desc = og["content"].strip()
        if len(desc) > 40:
            return desc[:1000]

    # Look for a dedicated description/synopsis block
    for selector in [
        {"class": re.compile(r"description|synopsis|show-desc|program-desc", re.IGNORECASE)},
        {"itemprop": "description"},
    ]:
        el = soup.find(attrs=selector)
        if el:
            text = el.get_text(" ", strip=True)
            if len(text) > 40:
                return text[:1000]

    return None


def _parse_performance_datetime(perf: dict) -> tuple[Optional[str], Optional[str]]:
    """
    Parse a performance record into (start_date, start_time).

    Tries DateTimeString first ("March 11, 10:00 AM"), falls back to
    PerfDate.date ("2026-03-11 00:00:00.000000").
    """
    # Primary: "March 11, 10:00 AM"
    dts = perf.get("DateTimeString", "")
    if dts:
        # Format: "Month DD, HH:MM AM/PM"
        m = re.match(
            r'(\w+ \d{1,2}),\s*(\d{1,2}:\d{2}\s*(?:AM|PM))',
            dts.strip(),
            re.IGNORECASE,
        )
        if m:
            date_part = m.group(1).strip()   # "March 11"
            time_part = m.group(2).strip()   # "10:00 AM"
            now = datetime.now()
            for year in (now.year, now.year + 1):
                try:
                    dt = datetime.strptime(f"{date_part} {year}", "%B %d %Y")
                    start_date = dt.strftime("%Y-%m-%d")
                    # Parse time
                    try:
                        t = datetime.strptime(time_part, "%I:%M %p")
                        start_time = t.strftime("%H:%M")
                    except ValueError:
                        start_time = None
                    return start_date, start_time
                except ValueError:
                    continue

    # Fallback: PerfDate.date = "2026-03-11 00:00:00.000000"
    perf_date_obj = perf.get("PerfDate") or {}
    if isinstance(perf_date_obj, dict):
        raw = perf_date_obj.get("date", "")
    else:
        raw = str(perf_date_obj)

    if raw:
        m = re.match(r'(\d{4}-\d{2}-\d{2})', raw)
        if m:
            return m.group(1), None

    return None, None


def _age_band_tags(age_min: Optional[int], age_max: Optional[int]) -> list[str]:
    """Convert age_min/age_max into our canonical age-band tags."""
    tags: list[str] = []
    lo = age_min if age_min is not None else 0
    hi = age_max if age_max is not None else 99

    if lo <= 1:
        tags.append("infant")
    if lo <= 3 and hi >= 1:
        tags.append("toddler")
    if lo <= 5 and hi >= 3:
        tags.append("preschool")
    if lo <= 12 and hi >= 5:
        tags.append("elementary")
    if lo <= 13 and hi >= 10:
        tags.append("tween")
    if lo <= 18 and hi >= 13:
        tags.append("teen")

    # De-duplicate while preserving order
    seen: set[str] = set()
    out: list[str] = []
    for t in tags:
        if t not in seen:
            seen.add(t)
            out.append(t)
    return out


def _is_camp_title(title: str) -> bool:
    """Return True if this looks like a summer puppet camp program."""
    return bool(re.search(r'\bcamps?\b|\bpuppet\s+camp\b', title, re.IGNORECASE))


def _base_tags(title: str, age_min: Optional[int], age_max: Optional[int]) -> list[str]:
    """Build the base tag list for a puppetry arts event."""
    tags = ["theater", "family-friendly", "kids", "puppetry", "midtown"]

    age_bands = _age_band_tags(age_min, age_max)
    tags.extend(age_bands)

    title_lower = title.lower()
    if "sensory" in title_lower:
        tags.append("accessible")
    if "preview" in title_lower or "reduced" in title_lower:
        tags.append("budget-friendly")
    if _is_camp_title(title):
        tags.extend(["class", "educational"])

    # De-duplicate
    seen: set[str] = set()
    out: list[str] = []
    for t in tags:
        if t not in seen:
            seen.add(t)
            out.append(t)
    return out


# ---------------------------------------------------------------------------
# Main crawl function
# ---------------------------------------------------------------------------


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl Center for Puppetry Arts shows and workshops.

    Steps:
      1. Fetch each programs listing page and collect show URLs.
      2. For each show URL, extract the embedded performances JSON.
      3. Emit one event per performance slot with date, time, price, age range.
    """
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    session = requests.Session()

    try:
        venue_id = get_or_create_venue(VENUE_DATA)
        persist_typed_entity_envelope(_build_destination_envelope(venue_id))
        logger.info("Center for Puppetry Arts venue ensured (ID: %s)", venue_id)

        # Enrich venue with og:image from the homepage
        try:
            homepage_html = _get(BASE_URL, session)
            if homepage_html:
                og_image = _extract_og_image(homepage_html)
                if og_image:
                    get_client().table("venues").update(
                        {"image_url": og_image}
                    ).eq("id", venue_id).execute()
                    logger.debug(
                        "Center for Puppetry Arts: updated venue image from homepage og:image"
                    )
        except Exception as enrich_exc:
            logger.warning(
                "Center for Puppetry Arts: homepage og:image enrichment failed: %s",
                enrich_exc,
            )

        # ----------------------------------------------------------------
        # Step 1: Collect show page URLs from all listing pages
        # ----------------------------------------------------------------
        show_urls: list[str] = []
        seen_urls: set[str] = set()

        for listing_url in PROGRAMS_URLS:
            logger.info("Fetching programs listing: %s", listing_url)
            html = _get(listing_url, session)
            if not html:
                logger.warning("Could not fetch listing page: %s", listing_url)
                continue

            urls = _parse_show_urls(html, listing_url)
            for u in urls:
                if u not in seen_urls:
                    seen_urls.add(u)
                    show_urls.append(u)

            time.sleep(REQUEST_DELAY)

        logger.info("Discovered %d unique show URLs", len(show_urls))

        if not show_urls:
            logger.warning(
                "Center for Puppetry Arts: no show URLs found — "
                "listing page structure may have changed"
            )
            return 0, 0, 0

        # ----------------------------------------------------------------
        # Step 2: Process each show page
        # ----------------------------------------------------------------
        for show_url in show_urls:
            try:
                html = _get(show_url, session)
                if not html:
                    logger.warning("Skipping show page (fetch failed): %s", show_url)
                    continue

                title = _extract_show_title(html, show_url)
                description = _extract_description(html)
                image_url = _extract_og_image(html)
                age_min, age_max = _extract_age_range(html)
                performances = _extract_performances_json(html)

                if not performances:
                    logger.debug("No performance data found for: %s (%s)", title, show_url)
                    # Still a valid destination — skip event emission, don't error
                    time.sleep(REQUEST_DELAY)
                    continue

                logger.info(
                    "Show: %s — %d performance(s) found", title, len(performances)
                )

                tags = _base_tags(title, age_min, age_max)

                # Determine category: camps → programs, puppet shows → theater
                category = "programs" if _is_camp_title(title) else "theater"
                subcategory = "camp" if _is_camp_title(title) else "puppetry"

                # Series hint — group all performances of the same show together
                series_hint: dict = {
                    "series_type": "recurring_show",
                    "series_title": title,
                }
                if image_url:
                    series_hint["image_url"] = image_url
                if description:
                    series_hint["description"] = description[:500]

                today = datetime.now().date()

                for perf_id, perf in performances.items():
                    if not isinstance(perf, dict):
                        continue

                    start_date, start_time = _parse_performance_datetime(perf)
                    if not start_date:
                        logger.debug(
                            "Could not parse date for performance %s in %s",
                            perf_id,
                            title,
                        )
                        continue

                    # Skip performances that have already passed
                    try:
                        if datetime.strptime(start_date, "%Y-%m-%d").date() < today:
                            continue
                    except ValueError:
                        continue

                    # Price extraction
                    general_price = perf.get("generalPrice")
                    member_price = perf.get("memberPrice")

                    price_min: Optional[float] = None
                    price_max: Optional[float] = None

                    if member_price is not None:
                        try:
                            price_min = float(member_price)
                        except (TypeError, ValueError):
                            pass

                    if general_price is not None:
                        try:
                            price_max = float(general_price)
                        except (TypeError, ValueError):
                            pass

                    # Ensure min <= max
                    if price_min is not None and price_max is not None:
                        if price_min > price_max:
                            price_min, price_max = price_max, price_min
                    elif price_min is None and price_max is not None:
                        price_min = price_max

                    is_free = (price_max == 0.0) if price_max is not None else False

                    # Seats remaining
                    seats = perf.get("seats")
                    price_note: Optional[str] = None
                    if seats is not None:
                        try:
                            if int(seats) == 0:
                                price_note = "Sold Out"
                        except (TypeError, ValueError):
                            pass

                    # Build stable content hash including time so each slot is unique
                    hash_key = f"{start_date}|{start_time}" if start_time else start_date
                    content_hash = generate_content_hash(title, VENUE_DATA["name"], hash_key)

                    event_record: dict = {
                        "source_id": source_id,
                        "venue_id": venue_id,
                        "title": title,
                        "description": description,
                        "start_date": start_date,
                        "start_time": start_time,
                        "end_date": None,
                        "end_time": None,
                        "is_all_day": False,
                        "category": category,
                        "subcategory": subcategory,
                        "tags": tags,
                        "price_min": price_min,
                        "price_max": price_max,
                        "price_note": price_note,
                        "is_free": is_free,
                        "source_url": show_url,
                        "ticket_url": show_url,
                        "image_url": image_url,
                        "age_min": age_min,
                        "age_max": age_max,
                        "raw_text": (
                            f"{title} | {perf.get('DateTimeString', '')} | "
                            f"${general_price}" if general_price else title
                        ),
                        "extraction_confidence": 0.92,
                        "is_recurring": True,
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
                        logger.info("Added: %s on %s", title, start_date)
                    except Exception as exc:
                        logger.error("Failed to insert %s on %s: %s", title, start_date, exc)

            except Exception as exc:
                logger.error("Error processing show page %s: %s", show_url, exc)

            time.sleep(REQUEST_DELAY)

        if events_found < 5:
            logger.warning(
                "Center for Puppetry Arts: only %d event slots found — "
                "performance JSON extraction may need updating",
                events_found,
            )

        logger.info(
            "Puppetry Arts crawl complete: %d found, %d new, %d updated",
            events_found,
            events_new,
            events_updated,
        )

    except Exception as exc:
        logger.error("Failed to crawl Center for Puppetry Arts: %s", exc)
        raise

    return events_found, events_new, events_updated
