"""
Crawler for Atlanta Botanical Garden (atlantabg.org).

Uses the Tribe Events Calendar REST API (wp-json/tribe/events/v1/events)
which returns structured JSON — no Playwright needed.

Covers both campus locations:
  - Midtown Atlanta: 1345 Piedmont Ave NE
  - Gainesville: 1911 Sweetbay Drive

Notable event types:
  - Garden Lights (Nov-Jan, major ticketed family draw)
  - Children's programs: Garden Playtime, Storybook Time, Sprouting Scientists
  - Homeschool Days
  - Summer/Spring Camps (Atlanta Camps category)
  - Art/culinary classes for adults
  - Cocktails in the Garden (adult-tagged)
  - Orchid shows and seasonal exhibitions
"""

from __future__ import annotations

import logging
import re
from html import unescape
from datetime import datetime
from typing import Optional

import requests
from bs4 import BeautifulSoup

from db import (
    get_client,
    get_or_create_venue,
    insert_event,
    find_event_by_hash,
    smart_update_existing_event,
)
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://atlantabg.org"
API_URL = f"{BASE_URL}/wp-json/tribe/events/v1/events"

# Tribe Events category IDs we care about — used for tag/category inference
_CAT_KIDS = {"Atlanta For Kids", "Gainesville For Kids", "Kids Programming"}
_CAT_CAMPS = {"Atlanta Camps"}
_CAT_HOMESCHOOL = {"Atlanta Homeschool", "Gainesville Homeschool"}
_CAT_ADULTS = {"Adults Programming"}
_CAT_CLASSES = {"Atlanta Classes/Education", "Gainesville Classes/Education"}
_CAT_ART = {"Atlanta Art", "Gainesville Art", "Botanical Drawing Program"}
_CAT_FOOD = {
    "Atlanta Food",
    "Gainesville Food",
    "Culinary Experiences",
    "Fresh Plates",
    "Outdoor Kitchen",
    "Plant. Eat. Repeat.",
    "Well Seasoned Chef",
    "Garden Chef Demos",
}
_CAT_EXHIBITION = {"Atlanta Exhibition", "Gainesville Exhibition", "Outdoor Exhibition"}
_CAT_GAINESVILLE = {"Gainesville"}
_CAT_MEMBERS = {"Members Only", "Gainesville Members Only"}

# Recurring programs that should be grouped into series
_RECURRING_SERIES: dict[str, str] = {
    "garden playtime": "Garden Playtime",
    "storybook time": "Storybook Time",
    "sprouting scientists": "Sprouting Scientists",
    "drop-in garden tours": "Drop-In Garden Tours",
    "garden grooves": "Garden Grooves",
    "frog feeding": "Frog Feeding",
    "tulips at twilight": "Tulips at Twilight",
}

# Venue data for both locations
_VENUE_MIDTOWN: dict = {
    "name": "Atlanta Botanical Garden",
    "slug": "atlanta-botanical-garden",
    "address": "1345 Piedmont Ave NE",
    "neighborhood": "Midtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30309",
    "lat": 33.7893,
    "lng": -84.3733,
    "venue_type": "garden",
    "spot_type": "garden",
    "website": BASE_URL,
    "vibes": ["family-friendly", "outdoor-seating", "all-ages"],
    "description": (
        "Atlanta Botanical Garden is a 30-acre urban oasis in Midtown Atlanta "
        "featuring stunning plant collections, world-class exhibitions, "
        "family programs, and seasonal events from Garden Lights to the "
        "Orchid Daze show."
    ),
    "hours": {
        "monday": None,
        "tuesday": {"open": "09:00", "close": "19:00"},
        "wednesday": {"open": "09:00", "close": "19:00"},
        "thursday": {"open": "09:00", "close": "19:00"},
        "friday": {"open": "09:00", "close": "19:00"},
        "saturday": {"open": "09:00", "close": "19:00"},
        "sunday": {"open": "09:00", "close": "19:00"},
    },
}

_VENUE_GAINESVILLE: dict = {
    "name": "Atlanta Botanical Garden, Gainesville",
    "slug": "atlanta-botanical-garden-gainesville",
    "address": "1911 Sweetbay Drive",
    "neighborhood": "Gainesville",
    "city": "Gainesville",
    "state": "GA",
    "zip": "30501",
    "lat": 34.3054,
    "lng": -83.8243,
    "venue_type": "garden",
    "spot_type": "garden",
    "website": f"{BASE_URL}/gainesville/",
    "vibes": ["family-friendly", "outdoor-seating", "all-ages"],
    "description": (
        "The Atlanta Botanical Garden's Gainesville campus spans 18 acres on "
        "the shores of Lake Lanier, featuring curated gardens, children's "
        "programs, horticultural exhibitions, and seasonal events."
    ),
    "hours": {
        "monday": None,
        "tuesday": {"open": "09:00", "close": "19:00"},
        "wednesday": {"open": "09:00", "close": "19:00"},
        "thursday": {"open": "09:00", "close": "19:00"},
        "friday": {"open": "09:00", "close": "19:00"},
        "saturday": {"open": "09:00", "close": "19:00"},
        "sunday": {"open": "09:00", "close": "19:00"},
    },
}


def _strip_html(html: str) -> str:
    """Remove HTML tags and normalize whitespace."""
    text = re.sub(r"<[^>]+>", " ", html)
    text = unescape(text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def _fetch_og_image(session: requests.Session, url: str) -> Optional[str]:
    """
    Fetch og:image from a URL. Best-effort — returns None on any failure.
    Used to enrich venue records with the garden's canonical hero image.
    """
    try:
        resp = session.get(url, timeout=15)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "html.parser")
        og = soup.find("meta", property="og:image")
        if og and og.get("content"):
            return og["content"].strip()
    except Exception as exc:
        logger.debug(f"ABG: og:image fetch failed for {url}: {exc}")
    return None


def _clean_title(title: str) -> str:
    """Remove 'SOLD OUT: ' prefix from event titles."""
    return re.sub(r"^SOLD\s+OUT:\s*", "", title, flags=re.IGNORECASE).strip()


def _parse_price(event: dict) -> tuple[Optional[float], Optional[float], Optional[str], bool]:
    """
    Parse price from Tribe API cost/cost_details fields.

    Returns (price_min, price_max, price_note, is_free).

    cost_details.values examples:
      ['0']                          -> free
      ['free-with-garden-admission'] -> free (with admission)
      ['free-with-admission']        -> free (with admission)
      ['85', '90']                   -> $85-$90
      ['50']                         -> $50
      []                             -> unknown (null)
    """
    cost_text = (event.get("cost") or "").strip()
    cost_details = event.get("cost_details") or {}
    values = cost_details.get("values") or []

    # Normalize string values list — filter out non-numeric/non-free strings
    numeric_vals: list[float] = []
    has_free_marker = False

    for v in values:
        v_str = str(v).lower().strip()
        if v_str in ("0", "free", "free-with-garden-admission", "free-with-admission"):
            has_free_marker = True
        elif re.match(r"^\d+(\.\d+)?$", v_str):
            numeric_vals.append(float(v_str))

    # Also check cost text for free indicators
    cost_lower = cost_text.lower()
    if any(kw in cost_lower for kw in ["free", "no cost", "no charge", "complimentary"]):
        has_free_marker = True

    if has_free_marker and not numeric_vals:
        return 0.0, 0.0, cost_text or "Free", True

    if numeric_vals:
        price_min = min(numeric_vals)
        price_max = max(numeric_vals)
        return price_min, price_max, cost_text or None, False

    # No price info available — return None (not free, not ticketed, just unknown)
    return None, None, cost_text or None, False


def _determine_category_and_tags(
    title: str,
    tribe_cats: set[str],
    description: str,
    cost_text: str,
) -> tuple[str, Optional[str], list[str]]:
    """
    Map Tribe categories and title keywords to LostCity category + tags.
    """
    title_lower = title.lower()
    desc_lower = description.lower()
    combined = f"{title_lower} {desc_lower}"
    tags: list[str] = ["garden", "outdoor", "nature", "midtown"]

    # Gainesville events get a different base tag
    if tribe_cats & _CAT_GAINESVILLE:
        tags = ["garden", "outdoor", "nature"]

    # -------------------------------------------------------------------
    # Family / Kids signals
    # -------------------------------------------------------------------
    is_kids = bool(tribe_cats & _CAT_KIDS)
    is_camp = bool(tribe_cats & _CAT_CAMPS)
    is_homeschool = bool(tribe_cats & _CAT_HOMESCHOOL)

    if is_camp:
        tags += ["family-friendly", "kids", "educational", "class"]
        return "programs", "camp", tags

    if is_homeschool:
        tags += ["family-friendly", "kids", "educational", "class"]
        return "family", "homeschool", tags

    if is_kids:
        tags += ["family-friendly", "kids", "all-ages"]
        # Age cues from title/description
        if any(kw in combined for kw in ["baby", "infant", "newborn"]):
            tags.append("infant")
        if any(kw in combined for kw in ["toddler"]):
            tags.append("toddler")
        if any(kw in combined for kw in ["preschool", "pre-k", "pre k", "6 months"]):
            tags.append("preschool")
        if any(kw in combined for kw in ["elementary", "grade", "k-5"]):
            tags.append("elementary")
        # Default to preschool age for Garden Playtime (ages 6 mo - 5 yrs)
        if "garden playtime" in title_lower and "preschool" not in tags:
            tags.append("preschool")
        return "family", "kids-program", tags

    # -------------------------------------------------------------------
    # Exhibition / On-view
    # -------------------------------------------------------------------
    is_exhibition = bool(tribe_cats & _CAT_EXHIBITION)
    if is_exhibition or any(kw in combined for kw in ["exhibition", "exhibit", "on view", "on display"]):
        tags += ["educational", "seasonal"]
        return "art", "exhibition", tags

    # -------------------------------------------------------------------
    # Art classes
    # -------------------------------------------------------------------
    if tribe_cats & _CAT_ART:
        tags += ["class", "hands-on", "adults"]
        return "art", "workshop", tags

    # -------------------------------------------------------------------
    # Food / Culinary
    # -------------------------------------------------------------------
    if tribe_cats & _CAT_FOOD:
        if any(kw in combined for kw in ["cocktail", "wine", "beer", "spirits", "sip", "drink"]):
            tags += ["date-night", "adults", "21+"]
            return "food_drink", "cocktails", tags
        tags += ["hands-on", "adults", "educational"]
        return "food_drink", "culinary", tags

    # -------------------------------------------------------------------
    # Classes / workshops
    # -------------------------------------------------------------------
    if tribe_cats & _CAT_CLASSES:
        if any(kw in combined for kw in ["yoga", "meditation", "wellness"]):
            tags += ["adults", "class"]
            return "wellness", "class", tags
        tags += ["adults", "class", "educational"]
        return "learning", "class", tags

    # -------------------------------------------------------------------
    # Adults Programming (generic)
    # -------------------------------------------------------------------
    if tribe_cats & _CAT_ADULTS:
        if any(kw in combined for kw in ["cocktail", "wine", "beer", "spirits", "happy hour", "twilight"]):
            tags += ["date-night", "adults"]
            return "food_drink", "cocktails", tags
        if any(kw in combined for kw in ["lecture", "talk", "presentation", "symposium"]):
            tags += ["educational", "adults"]
            return "learning", "talk", tags
        tags += ["adults"]
        return "community", None, tags

    # -------------------------------------------------------------------
    # Members-only
    # -------------------------------------------------------------------
    if tribe_cats & _CAT_MEMBERS:
        tags += ["adults"]
        return "community", None, tags

    # -------------------------------------------------------------------
    # Title keyword fallbacks
    # -------------------------------------------------------------------
    if any(kw in title_lower for kw in ["camp", "camps"]):
        tags += ["family-friendly", "kids", "educational"]
        return "programs", "camp", tags

    if any(kw in title_lower for kw in ["class", "workshop", "course", "lesson"]):
        tags += ["class", "adults"]
        return "learning", "class", tags

    if any(kw in title_lower for kw in ["concert", "music", "jazz", "band"]):
        tags += ["live-music"]
        return "music", None, tags

    if any(kw in title_lower for kw in ["tour"]):
        tags += ["adults"]
        return "community", "tour", tags

    if any(kw in title_lower for kw in ["festival", "show", "fair", "market"]):
        tags += ["all-ages"]
        return "community", None, tags

    # Default
    tags += ["all-ages"]
    return "community", None, tags


def _get_series_hint(title: str, tribe_cats: set[str]) -> Optional[dict]:
    """Return a series_hint dict if the event is part of a known recurring program."""
    title_lower = title.lower()
    for key, series_title in _RECURRING_SERIES.items():
        if key in title_lower:
            return {
                "series_type": "recurring_show",
                "series_title": series_title,
                "frequency": "weekly",
            }
    # All kids programs are effectively recurring through a season
    if tribe_cats & _CAT_KIDS and not (tribe_cats & _CAT_CAMPS):
        return {
            "series_type": "recurring_show",
            "series_title": title,
            "frequency": "weekly",
        }
    return None


def _fetch_events_page(
    session: requests.Session,
    page: int,
    per_page: int = 50,
) -> dict:
    """Fetch one page of events from the Tribe Events Calendar API."""
    params = {
        "per_page": per_page,
        "page": page,
        "status": "publish",
    }
    response = session.get(API_URL, params=params, timeout=30)
    response.raise_for_status()
    return response.json()


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl Atlanta Botanical Garden events via the Tribe Events Calendar REST API.

    Handles both the Midtown Atlanta campus and the Gainesville campus.
    Produces rich family/age tagging for kids programs, camps, homeschool days.
    """
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    session = requests.Session()
    session.headers.update({
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        "Accept": "application/json",
    })

    try:
        # Pre-create both venues once
        midtown_venue_id = get_or_create_venue(_VENUE_MIDTOWN)
        gainesville_venue_id = get_or_create_venue(_VENUE_GAINESVILLE)

        # Enrich venue records with og:image from their homepages
        for venue_id_local, venue_url in [
            (midtown_venue_id, BASE_URL),
            (gainesville_venue_id, f"{BASE_URL}/gainesville/"),
        ]:
            og_image = _fetch_og_image(session, venue_url)
            if og_image:
                try:
                    get_client().table("venues").update({"image_url": og_image}).eq(
                        "id", venue_id_local
                    ).execute()
                    logger.debug(f"ABG: updated venue {venue_id_local} image from {venue_url}")
                except Exception as enrich_exc:
                    logger.warning(f"ABG: venue image update failed: {enrich_exc}")

        logger.info("Fetching Atlanta Botanical Garden events from Tribe API")

        page = 1
        per_page = 50
        total_pages = 1  # Updated after first fetch

        while page <= total_pages:
            try:
                data = _fetch_events_page(session, page, per_page)
            except requests.RequestException as exc:
                logger.error(f"ABG API page {page} failed: {exc}")
                break

            total_pages = data.get("total_pages", 1)
            events_batch = data.get("events", [])

            if not events_batch:
                break

            logger.debug(
                f"ABG page {page}/{total_pages}: {len(events_batch)} events"
            )

            for event in events_batch:
                try:
                    raw_title = event.get("title") or ""
                    if not raw_title:
                        continue

                    title = _clean_title(raw_title)
                    was_sold_out = raw_title.lower().startswith("sold out")

                    # Build Tribe category name set for this event
                    tribe_cats: set[str] = {
                        c["name"] for c in event.get("categories") or []
                    }

                    # Determine venue
                    api_venue = event.get("venue") or {}
                    api_venue_name = api_venue.get("venue", "")
                    is_gainesville = (
                        "gainesville" in api_venue_name.lower()
                        or bool(tribe_cats & _CAT_GAINESVILLE)
                    )
                    venue_id = gainesville_venue_id if is_gainesville else midtown_venue_id
                    venue_name = (
                        "Atlanta Botanical Garden, Gainesville"
                        if is_gainesville
                        else "Atlanta Botanical Garden"
                    )

                    # Dates
                    start_date_raw = event.get("start_date") or ""
                    end_date_raw = event.get("end_date") or ""
                    if not start_date_raw:
                        continue

                    try:
                        start_dt = datetime.strptime(start_date_raw, "%Y-%m-%d %H:%M:%S")
                    except ValueError:
                        logger.debug(f"ABG: bad start_date format for {title!r}: {start_date_raw!r}")
                        continue

                    # Skip past events
                    if start_dt.date() < datetime.now().date():
                        continue

                    start_date = start_dt.strftime("%Y-%m-%d")
                    start_time: Optional[str] = None
                    if not event.get("all_day"):
                        start_time = start_dt.strftime("%H:%M")
                        # Midnight start on non-all-day = likely a data entry artifact;
                        # treat as time unknown rather than a midnight event
                        if start_time == "00:00":
                            start_time = None

                    end_date: Optional[str] = None
                    end_time: Optional[str] = None
                    is_all_day = bool(event.get("all_day"))

                    if end_date_raw:
                        try:
                            end_dt = datetime.strptime(end_date_raw, "%Y-%m-%d %H:%M:%S")
                            # Only set end_date if it's a different calendar day
                            if end_dt.date() != start_dt.date():
                                end_date = end_dt.strftime("%Y-%m-%d")
                            elif not is_all_day and start_time:
                                # Same-day: record end time if meaningfully different
                                e_time = end_dt.strftime("%H:%M")
                                if e_time != start_time and e_time != "00:00":
                                    end_time = e_time
                        except ValueError:
                            pass

                    # Multi-day events (camps, exhibitions) are all-day by nature
                    if end_date and end_date != start_date:
                        is_all_day = True
                        start_time = None
                        end_time = None

                    # Description — strip HTML tags
                    raw_description = event.get("description") or event.get("excerpt") or ""
                    description = _strip_html(raw_description)[:1000] if raw_description else None

                    # Image
                    image_data = event.get("image") or {}
                    image_url: Optional[str] = None
                    if isinstance(image_data, dict):
                        image_url = image_data.get("url")

                    # Source URL
                    source_url = event.get("url") or f"{BASE_URL}/events-exhibitions/"

                    # Price
                    price_min, price_max, price_note, is_free = _parse_price(event)

                    # If sold out and price was previously unknown, we can infer it was ticketed
                    if was_sold_out and is_free is False and price_min is None:
                        price_note = (price_note or "") + " (sold out)"

                    # Category, subcategory, tags
                    category, subcategory, tags = _determine_category_and_tags(
                        title, tribe_cats, description or "", price_note or ""
                    )

                    # Add "ticketed" tag when there's a real price
                    if price_min and price_min > 0:
                        if "ticketed" not in tags:
                            tags.append("ticketed")

                    # Deduplicate: use venue_name (not slug) to stay consistent
                    content_hash = generate_content_hash(title, venue_name, start_date)

                    events_found += 1

                    # Series grouping for recurring programs
                    series_hint = _get_series_hint(title, tribe_cats)
                    is_recurring = series_hint is not None

                    event_record: dict = {
                        "source_id": source_id,
                        "venue_id": venue_id,
                        "title": title,
                        "description": description,
                        "start_date": start_date,
                        "start_time": start_time,
                        "end_date": end_date,
                        "end_time": end_time,
                        "is_all_day": is_all_day,
                        "category": category,
                        "subcategory": subcategory,
                        "tags": tags,
                        "price_min": price_min,
                        "price_max": price_max,
                        "price_note": price_note,
                        "is_free": is_free,
                        "source_url": source_url,
                        "ticket_url": source_url,
                        "image_url": image_url,
                        "raw_text": f"{title} {start_date}",
                        "extraction_confidence": 0.92,
                        "is_recurring": is_recurring,
                        "recurrence_rule": None,
                        "content_hash": content_hash,
                    }

                    existing = find_event_by_hash(content_hash)
                    if existing:
                        smart_update_existing_event(existing, event_record)
                        events_updated += 1
                    else:
                        try:
                            insert_event(event_record, series_hint=series_hint)
                            events_new += 1
                            logger.info(f"ABG added: {title} on {start_date}")
                        except Exception as exc:
                            logger.error(f"ABG insert failed: {title!r}: {exc}")

                except Exception as exc:
                    logger.warning(f"ABG: error processing event {event.get('id')}: {exc}")
                    continue

            page += 1

        # Sanity check — ABG always has a healthy event calendar
        if events_found < 10:
            logger.warning(
                f"ABG: only {events_found} events found — expected 10+. "
                "API may be down or URL changed."
            )

        logger.info(
            f"ABG crawl complete: {events_found} found, "
            f"{events_new} new, {events_updated} updated"
        )

    except Exception as exc:
        logger.error(f"Failed to crawl Atlanta Botanical Garden: {exc}")
        raise

    return events_found, events_new, events_updated
