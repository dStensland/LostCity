"""
Crawler for Art Farm at Serenbe (artfarmatserenbe.org).

Multi-disciplinary arts organization in the Serenbe community (Chattahoochee Hills, GA).
Presents immersive outdoor theater, dance, film, and intimate performances in natural
settings. Successor to Serenbe Playhouse.

Strategy: requests + BeautifulSoup against the Webflow CMS events page.
Webflow renders collection list items server-side, so the event listing and most
content is in the initial HTML. Follows detail page links for full descriptions,
prices, and ticket URLs.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime
from typing import Optional

import requests
from bs4 import BeautifulSoup

from db import (
    get_or_create_place,
    insert_event,
    find_event_by_hash,
    smart_update_existing_event,
    remove_stale_source_events,
)
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://www.artfarmatserenbe.org"
EVENTS_URL = f"{BASE_URL}/events"

REQUEST_HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; LostCity/1.0)",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}

PLACE_DATA = {
    "name": "Art Farm at Serenbe",
    "slug": "art-farm-serenbe",
    "address": "10950 Hutchesons Ferry Rd",
    "neighborhood": "Serenbe",
    "city": "Chattahoochee Hills",
    "state": "GA",
    "zip": "30268",
    "lat": 33.4467,
    "lng": -84.7267,
    "place_type": "theater",
    "spot_type": "theater",
    "website": BASE_URL,
    "description": (
        "Multi-disciplinary arts organization in the Serenbe community. Presents "
        "immersive outdoor theater, dance, film, and intimate performances in natural "
        "settings. Successor to Serenbe Playhouse."
    ),
    "vibes": ["theater", "performing-arts", "outdoor", "immersive", "nature"],
}

# Map Webflow category labels to LostCity categories
CATEGORY_MAP = {
    "theater": ("theater", None),
    "theatre": ("theater", None),
    "dance": ("dance", None),
    "film": ("film", None),
    "special projects": ("community", None),
    "special project": ("community", None),
    "music": ("music", "live"),
    "family": ("family", None),
    "education": ("family", None),
}

BASE_TAGS = ["art-farm-serenbe", "serenbe", "performing-arts", "chattahoochee-hills"]


def _year_for_month_day(month_str: str, day: int) -> int:
    """Return the most likely upcoming year for a given month+day combination."""
    now = datetime.now()
    # Try current year first
    for year in (now.year, now.year + 1):
        try:
            dt = datetime.strptime(f"{month_str[:3]} {day} {year}", "%b %d %Y")
            if dt.date() >= now.date():
                return year
        except ValueError:
            pass
    return now.year + 1


_ABBREV_MONTH = (
    r"(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)"
)
_FULL_MONTH = (
    r"(January|February|March|April|May|June|July|August"
    r"|September|October|November|December)"
)


def _abbrev_to_date(month_abbrev: str, day: str, year: Optional[int] = None) -> Optional[str]:
    """Convert abbreviated month + day + optional year to YYYY-MM-DD."""
    if year is None:
        year = _year_for_month_day(month_abbrev, int(day))
    try:
        dt = datetime.strptime(f"{month_abbrev[:3]} {day} {year}", "%b %d %Y")
        return dt.strftime("%Y-%m-%d")
    except ValueError:
        return None


def parse_webflow_date(text: str) -> tuple[Optional[str], Optional[str]]:
    """
    Parse dates from Webflow event cards.

    Handles formats from Art Farm listing cards:
      - "Fri, Apr 17 to Sun, Apr 26"      (card format, no year — infer from context)
      - "Mon, Jun 8 to Fri, Jun 19"        (card format)
      - "Sat, Mar 21 to Sat, Mar 21"       (single-day card format)
    Also handles full-date formats from detail pages:
      - "March 21, 2026"                   (single date with year)
      - "April 17 - 26, 2026"             (same-month range with year)
      - "May 8-10, 15-17, 2026"           (multi-weekend — use first/last date)
    """
    # Card format: "Day[,] Mon DD to Day[,] Mon DD" (no year — infer)
    # Art Farm Webflow uses "Sat , Mar 21 to Sat , Mar 21" (space before comma)
    card_range = re.search(
        r"(?:\w+\s*,\s*)?" + _ABBREV_MONTH + r"\s+(\d{1,2})\s+to\s+(?:\w+\s*,\s*)?" + _ABBREV_MONTH + r"\s+(\d{1,2})",
        text,
        re.IGNORECASE,
    )
    if card_range:
        s_mon, s_day, e_mon, e_day = card_range.groups()
        s_year = _year_for_month_day(s_mon, int(s_day))
        e_year = _year_for_month_day(e_mon, int(e_day))
        s_date = _abbrev_to_date(s_mon, s_day, s_year)
        e_date = _abbrev_to_date(e_mon, e_day, e_year)
        if s_date and e_date:
            return s_date, e_date

    # ISO date pair in hidden text: "2026-03-21" (from Webflow data attributes)
    iso_pair = re.findall(r"(\d{4}-\d{2}-\d{2})", text)
    if len(iso_pair) >= 2:
        return iso_pair[0], iso_pair[-1]
    if len(iso_pair) == 1:
        return iso_pair[0], iso_pair[0]

    # Multi-weekend with year: "May 8-10, 15-17, 2026"
    multi = re.search(
        _FULL_MONTH + r"\s+(\d{1,2})-(\d{1,2}),\s*\d{1,2}-(\d{1,2}),?\s*(\d{4})",
        text,
        re.IGNORECASE,
    )
    if multi:
        month, s_day, _, e_day, year = multi.groups()
        try:
            s = datetime.strptime(f"{month} {s_day} {year}", "%B %d %Y")
            e = datetime.strptime(f"{month} {e_day} {year}", "%B %d %Y")
            return s.strftime("%Y-%m-%d"), e.strftime("%Y-%m-%d")
        except ValueError:
            pass

    # Cross-month with year: "Month Day - Month Day, Year"
    cross = re.search(
        _FULL_MONTH + r"\s+(\d{1,2})\s*[-\u2013]\s*" + _FULL_MONTH + r"\s+(\d{1,2}),?\s*(\d{4})",
        text,
        re.IGNORECASE,
    )
    if cross:
        s_mon, s_day, e_mon, e_day, year = cross.groups()
        try:
            s = datetime.strptime(f"{s_mon} {s_day} {year}", "%B %d %Y")
            e = datetime.strptime(f"{e_mon} {e_day} {year}", "%B %d %Y")
            return s.strftime("%Y-%m-%d"), e.strftime("%Y-%m-%d")
        except ValueError:
            pass

    # Same month range with year: "Month Day - Day, Year"
    same = re.search(
        _FULL_MONTH + r"\s+(\d{1,2})\s*[-\u2013]\s*(\d{1,2}),?\s*(\d{4})",
        text,
        re.IGNORECASE,
    )
    if same:
        month, s_day, e_day, year = same.groups()
        try:
            s = datetime.strptime(f"{month} {s_day} {year}", "%B %d %Y")
            e = datetime.strptime(f"{month} {e_day} {year}", "%B %d %Y")
            return s.strftime("%Y-%m-%d"), e.strftime("%Y-%m-%d")
        except ValueError:
            pass

    # Single date with year
    single = re.search(
        _FULL_MONTH + r"\s+(\d{1,2}),?\s*(\d{4})",
        text,
        re.IGNORECASE,
    )
    if single:
        month, day, year = single.groups()
        try:
            dt = datetime.strptime(f"{month} {day} {year}", "%B %d %Y")
            date_str = dt.strftime("%Y-%m-%d")
            return date_str, date_str
        except ValueError:
            pass

    return None, None


def parse_price_info(text: str) -> tuple[Optional[float], Optional[float], Optional[str], bool]:
    """Extract price from event detail page text."""
    text_lower = text.lower()
    if re.search(r"\bfree\b", text_lower):
        return 0.0, 0.0, "Free", True

    amounts = [float(m) for m in re.findall(r"\$(\d+(?:\.\d{2})?)", text)]
    if amounts:
        # Try to find a price note line
        note_match = re.search(
            r"(?:tickets?|admission|price[sd]?)[:\s]+([^\n]{1,80})", text, re.IGNORECASE
        )
        note = note_match.group(1).strip()[:80] if note_match else None
        return min(amounts), max(amounts), note, False

    return None, None, None, False


def resolve_category(category_text: str) -> tuple[str, Optional[str], list[str]]:
    """Map Webflow category label to LostCity category + extra tags."""
    key = category_text.strip().lower()
    cat, subcat = CATEGORY_MAP.get(key, ("art", None))
    extra_tags = [key.replace(" ", "-")] if key else []
    return cat, subcat, extra_tags


def fetch_detail_page(url: str) -> Optional[BeautifulSoup]:
    """Fetch and parse an individual event detail page."""
    try:
        resp = requests.get(url, headers=REQUEST_HEADERS, timeout=20)
        if resp.status_code == 200:
            return BeautifulSoup(resp.text, "html.parser")
    except Exception as exc:
        logger.debug("Could not fetch detail page %s: %s", url, exc)
    return None


def parse_events_from_listing(html: str) -> list[dict]:
    """
    Extract event stubs from the Art Farm Webflow events listing page.

    Each event card is an <a href="/events/slug"> link containing:
      - Category label (first text node: "Dance", "Theater", "Film", "Special Projects")
      - Event title (second text block)
      - Date range: "Day, Mon DD to Day, Mon DD" (infer year)
      - Time range
      - Short description / tagline

    The page also embeds ISO dates in hidden elements that we can harvest.
    """
    soup = BeautifulSoup(html, "html.parser")
    events = []

    # Find all event links (/events/<slug>)
    seen_hrefs: set[str] = set()
    event_links = [
        a for a in soup.find_all("a", href=True)
        if re.match(r"^/events/[^/]+$", a.get("href", ""))
        and a.get("href", "") not in seen_hrefs
        and not seen_hrefs.add(a.get("href", ""))  # type: ignore[func-returns-value]
    ]

    for link in event_links:
        href = link["href"]
        full_url = BASE_URL + href

        # Get card text as list of lines (pipe-separated in inner_text)
        card_parts = [p.strip() for p in link.get_text(separator="|", strip=True).split("|") if p.strip()]
        if len(card_parts) < 2:
            continue

        # First non-empty part is category, second is title
        category_label = ""
        title = ""
        short_desc = ""

        # card_parts format: [category, title, day, comma, mon+day, to, day, comma, mon+day, time, dash, time, description...]
        # We join them for date parsing
        card_joined = " ".join(card_parts)

        # Category: first item that matches known categories
        known_cats = {"dance", "theater", "film", "special projects", "music", "environment", "workshop"}
        for i, part in enumerate(card_parts):
            if part.lower() in known_cats:
                category_label = part
                # Title is next non-trivial part
                for j in range(i + 1, min(i + 3, len(card_parts))):
                    if len(card_parts[j]) > 5 and not re.match(r"^(Mon|Tue|Wed|Thu|Fri|Sat|Sun|to)$", card_parts[j]):
                        title = card_parts[j]
                        break
                break

        if not title:
            # Fallback: longest part that isn't a day/month/time
            for part in card_parts:
                if (
                    len(part) > len(title)
                    and not re.match(r"^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)$", part)
                    and not re.match(r"^\d{1,2}:\d{2}", part)
                    and "to" != part.lower()
                    and "," != part
                ):
                    title = part

        if not title or len(title) < 3:
            logger.debug("Could not extract title from card: %s", href)
            continue

        # Parse dates from card text
        start_date, end_date = parse_webflow_date(card_joined)

        # If no date from card text, look for ISO date near this link in the source HTML
        if not start_date:
            # Find ISO dates near this link in the raw HTML
            link_html_pos = html.find(href)
            if link_html_pos >= 0:
                nearby = html[link_html_pos: link_html_pos + 500]
                iso_dates = re.findall(r"(\d{4}-\d{2}-\d{2})", nearby)
                if iso_dates:
                    start_date = iso_dates[0]
                    end_date = iso_dates[-1]

        # Image from card (Webflow often puts thumbnail in link)
        image_url: Optional[str] = None
        img_el = link.find("img")
        if img_el:
            src = img_el.get("src") or img_el.get("data-src") or ""
            if src and "logo" not in src.lower() and src.startswith("http"):
                image_url = src

        # Short description: last part that looks like a sentence
        for part in reversed(card_parts):
            if len(part) > 20 and part != title and part.lower() not in known_cats:
                short_desc = part
                break

        events.append(
            {
                "title": title,
                "url": full_url,
                "start_date": start_date,
                "end_date": end_date,
                "category_label": category_label,
                "image_url": image_url,
                "description": short_desc or None,
            }
        )

    return events


def enrich_from_detail(stub: dict) -> dict:
    """
    Fetch the detail page and fill in missing fields:
    description, price, ticket URL, image, dates (if missing from listing card).
    """
    detail_soup = fetch_detail_page(stub["url"])
    if not detail_soup:
        return stub

    enriched = dict(stub)

    # Dates — try to get more precise dates from detail page if listing didn't have them
    if not enriched.get("start_date"):
        detail_text = detail_soup.get_text(separator=" ", strip=True)
        start_date, end_date = parse_webflow_date(detail_text)
        enriched["start_date"] = start_date
        enriched["end_date"] = end_date

    # Description
    desc_els = detail_soup.select("div.rich-text p, div[class*='description'] p, article p")
    paragraphs = [
        el.get_text(strip=True) for el in desc_els if len(el.get_text(strip=True)) > 30
    ]
    if paragraphs:
        enriched["description"] = " ".join(paragraphs[:3])[:600]

    # Price
    page_text = detail_soup.get_text(separator=" ", strip=True)
    price_min, price_max, price_note, is_free = parse_price_info(page_text)
    enriched["price_min"] = price_min
    enriched["price_max"] = price_max
    enriched["price_note"] = price_note
    enriched["is_free"] = is_free

    # Ticket URL
    ticket_url: Optional[str] = None
    for a in detail_soup.find_all("a", href=True):
        href = a["href"]
        if "neoncrm" in href or "eventbrite" in href or "tickets" in href.lower():
            ticket_url = href
            break
    enriched["ticket_url"] = ticket_url

    # Image — prefer og:image from detail page
    og_img = detail_soup.find("meta", property="og:image")
    if og_img and og_img.get("content"):
        enriched["image_url"] = og_img["content"]
    elif not enriched.get("image_url"):
        img_el = detail_soup.find("img")
        if img_el:
            src = img_el.get("src") or img_el.get("data-src") or ""
            if src.startswith("http") and "logo" not in src.lower():
                enriched["image_url"] = src

    # Category label from detail page if missing
    if not enriched.get("category_label"):
        cat_el = detail_soup.select_one(
            "div[class*='category'], span[class*='category'], div[class*='tag']"
        )
        if cat_el:
            enriched["category_label"] = cat_el.get_text(strip=True)

    return enriched


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Art Farm at Serenbe events listing and detail pages."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0
    seen_hashes: set[str] = set()

    try:
        venue_id = get_or_create_place(PLACE_DATA)

        logger.info("Fetching Art Farm at Serenbe events: %s", EVENTS_URL)
        try:
            resp = requests.get(EVENTS_URL, headers=REQUEST_HEADERS, timeout=25)
            resp.raise_for_status()
        except Exception as exc:
            logger.error("Failed to fetch events page: %s", exc)
            raise

        stubs = parse_events_from_listing(resp.text)
        logger.info("Found %d event stubs on listing page", len(stubs))

        today = datetime.now().date()

        for stub in stubs:
            # Enrich from detail page
            event = enrich_from_detail(stub)

            title = event.get("title", "")
            if not title:
                continue

            start_date = event.get("start_date")
            end_date = event.get("end_date")

            if not start_date:
                logger.debug("No date for: %s", title)
                continue

            # Skip past events
            check_date = end_date or start_date
            try:
                if datetime.strptime(check_date, "%Y-%m-%d").date() < today:
                    continue
            except ValueError:
                pass

            events_found += 1

            category, subcategory, extra_tags = resolve_category(event.get("category_label", ""))
            tags = sorted(set(BASE_TAGS + extra_tags))

            content_hash = generate_content_hash(
                title, "Art Farm at Serenbe", start_date
            )
            seen_hashes.add(content_hash)

            series_hint = None
            if end_date and end_date != start_date:
                series_hint = {
                    "series_type": "recurring_show",
                    "series_title": title,
                }
                if event.get("description"):
                    series_hint["description"] = event["description"]
                if event.get("image_url"):
                    series_hint["image_url"] = event["image_url"]

            is_free = event.get("is_free", False)
            if is_free and "free" not in tags:
                tags = sorted(set(tags) | {"free"})

            source_url = event.get("url") or EVENTS_URL
            ticket_url = event.get("ticket_url") or source_url

            event_record = {
                "source_id": source_id,
                "place_id": venue_id,
                "title": title,
                "description": event.get("description") or f"{title} at Art Farm at Serenbe",
                "start_date": start_date,
                "start_time": None,
                "end_date": end_date,
                "end_time": None,
                "is_all_day": False,
                "category": category,
                "subcategory": subcategory,
                "tags": tags,
                "price_min": event.get("price_min"),
                "price_max": event.get("price_max"),
                "price_note": event.get("price_note"),
                "is_free": is_free,
                "source_url": source_url,
                "ticket_url": ticket_url,
                "image_url": event.get("image_url"),
                "raw_text": None,
                "extraction_confidence": 0.86,
                "is_recurring": True if end_date and end_date != start_date else False,
                "recurrence_rule": None,
                "content_hash": content_hash,
            }

            existing = find_event_by_hash(content_hash)
            if existing:
                smart_update_existing_event(existing, event_record)
                events_updated += 1
                continue

            try:
                insert_event(event_record, series_hint=series_hint)
                events_new += 1
                logger.info("Added: %s (%s to %s)", title, start_date, end_date)
            except Exception as exc:
                logger.error("Failed to insert %s: %s", title, exc)

        if seen_hashes:
            stale = remove_stale_source_events(source_id, seen_hashes)
            if stale:
                logger.info("Removed %d stale Art Farm at Serenbe events", stale)

        logger.info(
            "Art Farm at Serenbe crawl complete: %d found, %d new, %d updated",
            events_found,
            events_new,
            events_updated,
        )

    except Exception as exc:
        logger.error("Failed to crawl Art Farm at Serenbe: %s", exc)
        raise

    return events_found, events_new, events_updated
