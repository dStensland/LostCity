"""
Crawler for Relapse Theatre (relapsetheatre.com).
West Midtown improv, standup, and sketch comedy venue.

Uses Seat Engine for ticketing at therelapsetheater-com.seatengine.com/events.

NOTE: As of 2026-03 the venue appears dormant — the Seat Engine page has
zero upcoming events and the main site shows "Launching Soon". The crawler
is kept active so it will pick up events if/when programming resumes.

Seat Engine renders events server-side so plain HTTP + BeautifulSoup is
sufficient (no Playwright needed).
"""

from __future__ import annotations

import json
import logging
import re
from datetime import datetime
from typing import Optional
from zoneinfo import ZoneInfo

import requests
from bs4 import BeautifulSoup

from db import (
    find_event_by_hash,
    get_or_create_place,
    insert_event,
    remove_stale_source_events,
    smart_update_existing_event,
)
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://www.relapsetheatre.com"
EVENTS_URL = "https://therelapsetheater-com.seatengine.com/events"

PLACE_DATA = {
    "name": "Relapse Theatre",
    "slug": "relapse-theatre",
    "address": "380 14th St NW",
    "neighborhood": "West Midtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30318",
    "lat": 33.7880,
    "lng": -84.4010,
    "place_type": "comedy_club",
    "spot_type": "comedy_club",
    "website": BASE_URL,
    "description": (
        "Atlanta's home for improv, standup, and sketch comedy. Multiple shows nightly "
        "with a full-service bar featuring 200+ brands. Classes and workshops for "
        "aspiring performers."
    ),
    "vibes": ["comedy", "improv", "live-shows", "late-night", "fun"],
}

_EASTERN = ZoneInfo("America/New_York")

_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
}


# ---------------------------------------------------------------------------
# Date parsing
# ---------------------------------------------------------------------------


def _parse_date_text(text: str) -> Optional[tuple[str, str]]:
    """
    Parse date/time from Seat Engine format.

    Handles:
      - "Mar 18, 2026 8:00 PM"
      - "March 18, 2026 at 8:00 PM"
      - "Tue, Mar 18 8:00 PM"
      - "3/18/2026 8:00 PM"

    Returns (YYYY-MM-DD, HH:MM) or None.
    """
    # Pattern 1: "Mon DD, YYYY H:MM AM/PM" or "Month DD, YYYY at H:MM AM/PM"
    m = re.search(
        r"([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})\s+(?:at\s+)?(\d{1,2}):(\d{2})\s*(AM|PM)",
        text,
        re.IGNORECASE,
    )
    if m:
        month_str, day, year, hour, minute, period = m.groups()
        try:
            month_num = datetime.strptime(month_str[:3], "%b").month
        except ValueError:
            pass
        else:
            h = _to_24h(int(hour), period)
            return (f"{year}-{month_num:02d}-{int(day):02d}", f"{h:02d}:{minute}")

    # Pattern 2: "Day, Mon DD H:MM AM/PM" (no year)
    m = re.search(
        r"(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*,?\s+([A-Za-z]+)\s+(\d{1,2})\s+(\d{1,2}):(\d{2})\s*(AM|PM)",
        text,
        re.IGNORECASE,
    )
    if m:
        month_str, day, hour, minute, period = m.groups()
        try:
            month_num = datetime.strptime(month_str[:3], "%b").month
        except ValueError:
            pass
        else:
            now = datetime.now(_EASTERN)
            year = now.year
            candidate = datetime(year, month_num, int(day), tzinfo=_EASTERN)
            if candidate < now.replace(hour=0, minute=0, second=0, microsecond=0):
                year += 1
            h = _to_24h(int(hour), period)
            return (f"{year}-{month_num:02d}-{int(day):02d}", f"{h:02d}:{minute}")

    # Pattern 3: "M/DD/YYYY H:MM AM/PM"
    m = re.search(
        r"(\d{1,2})/(\d{1,2})/(\d{4})\s+(\d{1,2}):(\d{2})\s*(AM|PM)",
        text,
        re.IGNORECASE,
    )
    if m:
        month, day, year, hour, minute, period = m.groups()
        h = _to_24h(int(hour), period)
        return (f"{year}-{int(month):02d}-{int(day):02d}", f"{h:02d}:{minute}")

    return None


def _to_24h(hour: int, period: str) -> int:
    if period.upper() == "PM" and hour != 12:
        return hour + 12
    if period.upper() == "AM" and hour == 12:
        return 0
    return hour


# ---------------------------------------------------------------------------
# JSON-LD parsing (primary extraction path)
# ---------------------------------------------------------------------------


def _parse_jsonld_events(soup: BeautifulSoup) -> list[dict]:
    """
    Extract events from Schema.org JSON-LD embedded in the page.
    Seat Engine embeds a Place entity with an Events array.
    """
    results = []
    for tag in soup.find_all("script", type="application/ld+json"):
        try:
            data = json.loads(tag.string or "")
        except (json.JSONDecodeError, TypeError):
            continue

        # Seat Engine uses a non-standard ":@context" key (typo on their end)
        raw_events = data.get("Events") or data.get("events") or []
        for evt in raw_events:
            results.append(evt)

    return results


# ---------------------------------------------------------------------------
# HTML card parsing (fallback for when JSON-LD is empty)
# ---------------------------------------------------------------------------


def _parse_html_event_cards(soup: BeautifulSoup) -> list[dict]:
    """
    Parse event cards from the HTML events list.

    Seat Engine renders each event inside the `.events-list` section.
    Cards typically contain: title, date/time, price, and a ticket link.
    """
    events_section = soup.find(id="mini-events") or soup.find(class_="events-list")
    if not events_section:
        return []

    # Seat Engine uses a variety of card selectors across versions
    card_selectors = [
        ".event-card",
        ".event-list-item",
        ".se-event",
        "[data-event-id]",
        ".show-item",
        ".event-item",
        "article",
    ]

    cards = []
    for sel in card_selectors:
        found = events_section.select(sel)
        if found:
            logger.debug(f"Found {len(found)} HTML event cards with selector: {sel}")
            cards = found
            break

    parsed = []
    for card in cards:
        text = card.get_text("\n", strip=True)
        lines = [ln for ln in text.splitlines() if ln.strip()]
        if len(lines) < 2:
            continue

        # Title: first non-date, non-price line
        title = None
        for line in lines[:6]:
            if re.match(r"^(Buy|Get|Sold|More|\$|Free)", line, re.IGNORECASE):
                continue
            if re.match(r"^\d{1,2}[:/]\d{2}", line):
                continue
            if len(line) > 5 and not re.match(r"^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s*$", line):
                title = line
                break

        if not title:
            continue

        # Date/time
        showtime = None
        for line in lines:
            showtime = _parse_date_text(line)
            if showtime:
                break
        if not showtime:
            showtime = _parse_date_text(text)
        if not showtime:
            continue

        # Image
        img = card.find("img")
        image_url = img["src"] if img and img.get("src") else None

        # Ticket link
        ticket_url = None
        for a in card.find_all("a", href=True):
            href = a["href"]
            if any(kw in href for kw in ("event", "ticket", "buy", "/show")):
                ticket_url = href
                if not ticket_url.startswith("http"):
                    ticket_url = f"https://therelapsetheater-com.seatengine.com{ticket_url}"
                break

        # Price
        price_min = None
        pm = re.search(r"\$(\d+(?:\.\d{2})?)", text)
        if pm:
            price_min = float(pm.group(1))

        parsed.append(
            {
                "title": title,
                "showtime": showtime,
                "image_url": image_url,
                "ticket_url": ticket_url,
                "price_min": price_min,
                "raw_text": text[:500],
                "is_free": "free" in text.lower() and "$" not in text,
            }
        )

    return parsed


# ---------------------------------------------------------------------------
# Main crawl
# ---------------------------------------------------------------------------


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Relapse Theatre events from Seat Engine ticketing page."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0
    current_hashes: set[str] = set()

    try:
        venue_id = get_or_create_place(PLACE_DATA)

        logger.info(f"Fetching Relapse Theatre events: {EVENTS_URL}")
        try:
            resp = requests.get(EVENTS_URL, headers=_HEADERS, timeout=20)
            resp.raise_for_status()
        except requests.RequestException as exc:
            logger.error(f"HTTP error fetching {EVENTS_URL}: {exc}")
            return 0, 0, 0

        soup = BeautifulSoup(resp.text, "html.parser")

        # Primary path: JSON-LD embedded by Seat Engine
        jsonld_events = _parse_jsonld_events(soup)

        # Fallback: parse HTML event cards
        html_events = _parse_html_event_cards(soup)

        if not jsonld_events and not html_events:
            page_content = soup.get_text(" ", strip=True)
            logger.info(
                "Relapse Theatre: no events found on Seat Engine page "
                "(venue may be dormant). "
                f"Page preview: {page_content[:200]}"
            )
            return 0, 0, 0

        # --- Process JSON-LD events ---
        for evt in jsonld_events:
            try:
                title = evt.get("name") or evt.get("title")
                if not title:
                    continue

                start_raw = evt.get("startDate") or evt.get("start_date") or ""
                showtime = _parse_date_text(start_raw)
                if not showtime:
                    logger.debug(f"Unrecognised date format for '{title}': {start_raw!r}")
                    continue

                start_date, start_time = showtime
                _skip_if_past(start_date, start_time)  # raises ValueError if past

                image_url = evt.get("image") or evt.get("image_url")
                ticket_url = evt.get("url") or evt.get("ticket_url")
                description = evt.get("description") or "Comedy show at Relapse Theatre"
                price_min = _extract_price(evt)
                is_free = not price_min and "free" in description.lower()

                content_hash = generate_content_hash(title, "Relapse Theatre", start_date)
                current_hashes.add(content_hash)

                event_record = _build_event_record(
                    source_id=source_id,
                    venue_id=venue_id,
                    title=title,
                    description=description,
                    start_date=start_date,
                    start_time=start_time,
                    image_url=image_url,
                    ticket_url=ticket_url,
                    price_min=price_min,
                    is_free=is_free,
                    raw_text=json.dumps(evt)[:500],
                    content_hash=content_hash,
                )

                events_found += 1
                existing = find_event_by_hash(content_hash)
                if existing:
                    smart_update_existing_event(existing, event_record)
                    events_updated += 1
                else:
                    try:
                        insert_event(event_record)
                        events_new += 1
                        logger.info(f"Added: {title} on {start_date} at {start_time}")
                    except Exception as exc:
                        logger.error(f"Failed to insert '{title}': {exc}")

            except ValueError:
                continue  # past event, skip
            except Exception as exc:
                logger.warning(f"Failed to process JSON-LD event: {exc}")
                continue

        # --- Process HTML card events (if JSON-LD was empty) ---
        if not jsonld_events:
            for item in html_events:
                try:
                    title = item["title"]
                    start_date, start_time = item["showtime"]
                    _skip_if_past(start_date, start_time)

                    content_hash = generate_content_hash(title, "Relapse Theatre", start_date)
                    current_hashes.add(content_hash)

                    event_record = _build_event_record(
                        source_id=source_id,
                        venue_id=venue_id,
                        title=title,
                        description="Comedy show at Relapse Theatre",
                        start_date=start_date,
                        start_time=start_time,
                        image_url=item.get("image_url"),
                        ticket_url=item.get("ticket_url"),
                        price_min=item.get("price_min"),
                        is_free=item.get("is_free", False),
                        raw_text=item.get("raw_text", ""),
                        content_hash=content_hash,
                    )

                    events_found += 1
                    existing = find_event_by_hash(content_hash)
                    if existing:
                        smart_update_existing_event(existing, event_record)
                        events_updated += 1
                    else:
                        try:
                            insert_event(event_record)
                            events_new += 1
                            logger.info(f"Added: {title} on {start_date} at {start_time}")
                        except Exception as exc:
                            logger.error(f"Failed to insert '{title}': {exc}")

                except ValueError:
                    continue
                except Exception as exc:
                    logger.warning(f"Failed to process HTML card event: {exc}")
                    continue

        remove_stale_source_events(source_id, current_hashes)

    except Exception as exc:
        logger.error(f"Failed to crawl Relapse Theatre: {exc}")
        raise

    logger.info(
        f"Relapse Theatre crawl complete: {events_found} found, "
        f"{events_new} new, {events_updated} updated"
    )
    return events_found, events_new, events_updated


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _skip_if_past(start_date: str, start_time: str) -> None:
    """Raise ValueError if the event is in the past."""
    try:
        dt = datetime.strptime(f"{start_date} {start_time}", "%Y-%m-%d %H:%M")
        dt = dt.replace(tzinfo=_EASTERN)
        if dt < datetime.now(_EASTERN):
            raise ValueError("past")
    except ValueError as exc:
        if "past" in str(exc):
            raise
        # If strptime fails, don't skip


def _extract_price(evt: dict) -> Optional[float]:
    """Extract price_min from a JSON-LD event dict."""
    for key in ("price", "price_min", "minPrice", "min_price"):
        val = evt.get(key)
        if val is not None:
            try:
                return float(str(val).replace("$", "").strip())
            except (ValueError, TypeError):
                pass

    # Try nested offers
    offers = evt.get("offers") or evt.get("Offers")
    if isinstance(offers, list) and offers:
        offers = offers[0]
    if isinstance(offers, dict):
        for key in ("price", "minPrice", "lowPrice"):
            val = offers.get(key)
            if val is not None:
                try:
                    return float(str(val).replace("$", "").strip())
                except (ValueError, TypeError):
                    pass

    return None


def _subcategory_from_title(title: str) -> str:
    lower = title.lower()
    if "improv" in lower:
        return "improv"
    if "standup" in lower or "stand-up" in lower or "stand up" in lower:
        return "standup"
    if "sketch" in lower:
        return "sketch"
    if "open mic" in lower:
        return "open_mic"
    return "comedy"


def _build_event_record(
    *,
    source_id: int,
    venue_id: int,
    title: str,
    description: str,
    start_date: str,
    start_time: str,
    image_url: Optional[str],
    ticket_url: Optional[str],
    price_min: Optional[float],
    is_free: bool,
    raw_text: str,
    content_hash: str,
) -> dict:
    subcategory = _subcategory_from_title(title)
    tags = ["comedy", "relapse-theatre"]
    if subcategory != "comedy":
        tags.append(subcategory)

    return {
        "source_id": source_id,
        "place_id": venue_id,
        "title": title,
        "description": description,
        "start_date": start_date,
        "start_time": start_time,
        "end_date": None,
        "end_time": None,
        "is_all_day": False,
        "category": "comedy",
        "subcategory": subcategory,
        "tags": tags,
        "price_min": price_min,
        "price_max": None,
        "is_free": is_free,
        "source_url": ticket_url or EVENTS_URL,
        "ticket_url": ticket_url,
        "image_url": image_url,
        "raw_text": raw_text,
        "extraction_confidence": 0.85,
        "is_recurring": False,
        "recurrence_rule": None,
        "content_hash": content_hash,
    }
