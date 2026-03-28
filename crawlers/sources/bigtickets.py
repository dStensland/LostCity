"""
BigTickets.com aggregator crawler for Atlanta metro area events.

Scrapes search results pages to discover events, resolves venues against
our DB via get_or_create_place, and enriches existing events with ticket URLs.
"""

from __future__ import annotations

import logging
import re
import time
from datetime import datetime
from typing import Optional

from playwright.sync_api import sync_playwright
from bs4 import BeautifulSoup

from db import get_or_create_place, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

SEARCH_URL = "https://www.bigtickets.com/events/q/atlanta-ga-all-dates/"
PAGE_SIZE = 20
MAX_PAGES = 10  # Safety cap; typically ~5 pages exist

CATEGORY_MAP = {
    "concerts": "music",
    "artsentertainment": "music",
    "festivals": "community",
    "sports": "sports",
    "comedy": "comedy",
    "theater": "theater",
    "family": "family",
    "nightlife": "nightlife",
    "fooddrink": "food_drink",
    "food & drink": "food_drink",
    "food": "food_drink",
    "drink": "food_drink",
    "fundraisers": "community",
    "charity": "community",
    "education": "learning",
    "stpatricksday": "community",
}


def _parse_date(date_text: str) -> Optional[str]:
    """Parse date from BigTickets format like 'Sat, Mar 07, 2026'."""
    # Try full format: Day, Mon DD, YYYY
    match = re.search(
        r"(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\w*,?\s+"
        r"(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\.?\s+"
        r"(\d{1,2}),?\s+(\d{4})",
        date_text,
        re.IGNORECASE,
    )
    if match:
        month_str, day_str, year_str = match.group(1), match.group(2), match.group(3)
        month_map = {
            "jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6,
            "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12,
        }
        month_num = month_map.get(month_str[:3].lower())
        if month_num:
            try:
                dt = datetime(int(year_str), month_num, int(day_str))
                return dt.strftime("%Y-%m-%d")
            except ValueError:
                pass
    return None


def _parse_time(text: str) -> Optional[str]:
    """Parse time from text like '7:00 PM' or '7PM'."""
    match = re.search(r"(\d{1,2})(?::(\d{2}))?\s*(am|pm)", text, re.IGNORECASE)
    if match:
        hour = int(match.group(1))
        minute = match.group(2) or "00"
        period = match.group(3).lower()
        if period == "pm" and hour != 12:
            hour += 12
        elif period == "am" and hour == 12:
            hour = 0
        return f"{hour:02d}:{minute}"
    return None


def _parse_price(text: str) -> tuple[Optional[float], Optional[float], bool]:
    """Parse price from text like '$25', '$18 - $45', or 'Free'. Returns (min, max, is_free)."""
    if "free" in text.lower():
        return None, None, True
    prices = re.findall(r"\$(\d+(?:\.\d{2})?)", text)
    if prices:
        amounts = [float(p) for p in prices]
        return min(amounts), max(amounts), False
    return None, None, False


def _extract_categories(text: str) -> list[str]:
    """Extract category hashtags like #Concerts, #Festivals from text."""
    return re.findall(r"#(\w+(?:\s*&\s*\w+)?)", text)


def _map_category(raw_categories: list[str]) -> str:
    """Map BigTickets categories to our taxonomy."""
    for cat in raw_categories:
        mapped = CATEGORY_MAP.get(cat.lower())
        if mapped:
            return mapped
    return "community"


def _parse_venue_location(text: str) -> tuple[str, str, str]:
    """Parse venue string like '529, Atlanta, GA' or 'Park Tavern - Atlanta, Atlanta, GA'.
    Returns (venue_name, city, state)."""
    text = text.strip()
    if not text:
        return "TBA", "Atlanta", "GA"

    # Try "Venue - City, City, ST" pattern first (BigTickets sometimes repeats city)
    m = re.match(r"^(.+?)\s*[-–]\s*.+?,\s*([A-Z]{2})\s*$", text)
    if m:
        venue_name = m.group(1).strip()
        state = m.group(2)
        # Extract city: everything between dash and state, take last comma-segment
        after_dash = re.split(r"\s*[-–]\s*", text, maxsplit=1)[1]
        city_part = re.sub(r",\s*[A-Z]{2}\s*$", "", after_dash).strip()
        # If city is repeated ("Atlanta, Atlanta"), take unique value
        cities = [c.strip() for c in city_part.split(",") if c.strip()]
        city = cities[-1] if cities else "Atlanta"
        return venue_name, city, state

    # Try "Venue, City, ST" pattern (most common)
    m = re.match(r"^(.+?),\s*(.+?),\s*([A-Z]{2})\s*$", text)
    if m:
        return m.group(1).strip(), m.group(2).strip(), m.group(3)

    return text, "Atlanta", "GA"


def _fetch_detail_description(page, event_url: str) -> Optional[str]:
    """Fetch event detail page for description. Returns description text or None."""
    try:
        page.goto(event_url, wait_until="domcontentloaded", timeout=20000)
        page.wait_for_timeout(2000)
        html = page.content()
        soup = BeautifulSoup(html, "html.parser")

        # Look for description in meta tags first
        meta_desc = soup.find("meta", attrs={"name": "description"})
        if meta_desc and meta_desc.get("content"):
            desc = meta_desc["content"].strip()
            if len(desc) > 30:
                return desc[:2000]

        # Look for description in common content areas
        for selector in ["div.event-description", "div.description", "article", "div.content"]:
            el = soup.select_one(selector)
            if el:
                text = el.get_text(separator=" ", strip=True)
                if len(text) > 30:
                    return text[:2000]

        return None
    except Exception as e:
        logger.debug(f"Could not fetch detail page {event_url}: {e}")
        return None


def _parse_event_cards(html: str) -> list[dict]:
    """Parse event cards from a BigTickets search results page.

    HTML structure per card (inside div.item-info):
      <h5>Title</h5>
      <h6><span class="item-dates">Day, Mon DD, YYYY | Time</span>
          <span class="item-categories">|#Cat1#Cat2</span></h6>
      <p>Venue, City, ST</p>
      <div>$Price <a>Get Tickets</a></div>
    """
    soup = BeautifulSoup(html, "html.parser")
    events = []

    for card in soup.find_all("div", class_="item-info"):
        # 1. Title from <h5>
        h5 = card.find("h5")
        if not h5:
            continue
        title = h5.get_text(strip=True)
        if not title or len(title) < 3:
            continue

        # 2. Date/time from span.item-dates
        date_span = card.find("span", class_="item-dates")
        if not date_span:
            continue
        date_text = date_span.get_text(strip=True)
        start_date = _parse_date(date_text)
        start_time = _parse_time(date_text)
        if not start_date:
            continue

        # Skip past events
        try:
            if datetime.strptime(start_date, "%Y-%m-%d").date() < datetime.now().date():
                continue
        except ValueError:
            continue

        # 3. Categories from span.item-categories
        cat_span = card.find("span", class_="item-categories")
        cat_text = cat_span.get_text(strip=True) if cat_span else ""
        raw_categories = _extract_categories(cat_text)
        category = _map_category(raw_categories)

        # 4. Venue from <p> element
        venue_p = card.find("p")
        venue_text = venue_p.get_text(strip=True) if venue_p else ""
        venue_name, city, state = _parse_venue_location(venue_text) if venue_text else ("TBA", "Atlanta", "GA")

        # 4b. Strip "@venue" suffix from title — BigTickets often appends
        # venue name to the event title (e.g. "VentanA @529") but our
        # venue-specific crawlers don't, causing hash mismatches.
        if venue_name and venue_name != "TBA":
            # Strip patterns like "@529", "@ 529", "@529 EAV", "@ Drunken Unicorn"
            title = re.sub(
                r"\s*@\s*" + re.escape(venue_name) + r"(?:\s+EAV)?\s*$",
                "", title, flags=re.IGNORECASE,
            ).strip()
            # Also try without "The " prefix
            bare_venue = re.sub(r"^the\s+", "", venue_name, flags=re.IGNORECASE)
            if bare_venue != venue_name:
                title = re.sub(
                    r"\s*@\s*" + re.escape(bare_venue) + r"(?:\s+EAV)?\s*$",
                    "", title, flags=re.IGNORECASE,
                ).strip()

        # 5. Price from sibling price div
        price_text = card.get_text(strip=True)
        price_min, price_max, is_free = _parse_price(price_text)

        # 6. Event URL from "Get Tickets" link
        ticket_link = card.find("a", string="Get Tickets")
        event_url = ""
        if ticket_link:
            event_url = ticket_link.get("href", "")
            if event_url and not event_url.startswith("http"):
                event_url = f"https://www.bigtickets.com{event_url}"
            event_url = re.sub(r"\?referral=.*$", "", event_url)

        events.append({
            "title": title[:500],
            "start_date": start_date,
            "start_time": start_time,
            "venue_name": venue_name,
            "city": city,
            "state": state,
            "price_min": price_min,
            "price_max": price_max,
            "is_free": is_free,
            "category": category,
            "raw_categories": raw_categories,
            "event_url": event_url,
        })

    return events


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl BigTickets Atlanta search results.

    Two-pass approach:
      1. Collect all unique event cards across paginated search pages.
      2. Process each card: dedup against DB, enrich existing events with
         ticket URLs, or fetch detail page + insert for truly new events.
    """
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

            # --- Pass 1: collect all unique cards ---
            all_cards: list[dict] = []
            seen_hashes: set[str] = set()

            for page_idx in range(MAX_PAGES):
                offset = page_idx * (PAGE_SIZE + 1) if page_idx > 0 else 0
                url = f"{SEARCH_URL}?p={offset}" if offset > 0 else SEARCH_URL
                logger.info(f"Fetching page {page_idx + 1} (offset {offset})")

                try:
                    page.goto(url, wait_until="domcontentloaded", timeout=30000)
                    page.wait_for_timeout(3000)
                except Exception as e:
                    logger.warning(f"Failed to load page {page_idx + 1}: {e}")
                    break

                cards = _parse_event_cards(page.content())

                if not cards:
                    logger.info(f"No events on page {page_idx + 1}, stopping")
                    break

                new_on_page = 0
                for c in cards:
                    h = generate_content_hash(c["title"], c["venue_name"], c["start_date"])
                    if h not in seen_hashes:
                        seen_hashes.add(h)
                        all_cards.append(c)
                        new_on_page += 1

                if not new_on_page:
                    logger.info(f"Page {page_idx + 1}: all duplicates, stopping")
                    break

                logger.info(f"Page {page_idx + 1}: {new_on_page} new ({len(all_cards)} total)")
                time.sleep(1)

            logger.info(f"Collected {len(all_cards)} unique events, processing...")

            # --- Pass 2: resolve venues, dedup, insert/update ---
            for card in all_cards:
                events_found += 1
                title = card["title"]
                start_date = card["start_date"]
                venue_name = card["venue_name"]
                event_url = card["event_url"]

                # Resolve venue
                venue_id = None
                if venue_name and venue_name != "TBA":
                    venue_record = {
                        "name": venue_name,
                        "slug": re.sub(r"[^a-z0-9-]", "", venue_name.lower().replace(" ", "-"))[:50],
                        "city": card["city"],
                        "state": card["state"],
                        "venue_type": "event_space",
                    }
                    try:
                        venue_id = get_or_create_place(venue_record)
                    except Exception as e:
                        logger.warning(f"Could not resolve venue '{venue_name}': {e}")

                # Dedup via content hash
                content_hash = generate_content_hash(title, venue_name, start_date)
                existing = find_event_by_hash(content_hash)

                if existing:
                    # Enrich with ticket URL if missing
                    update_fields = {}
                    if event_url and not existing.get("ticket_url"):
                        update_fields["ticket_url"] = event_url
                    if event_url and not existing.get("source_url"):
                        update_fields["source_url"] = event_url
                    if update_fields:
                        smart_update_existing_event(existing, {
                            **update_fields,
                            "source_id": source_id,
                            "content_hash": content_hash,
                        })
                    events_updated += 1
                    logger.debug(f"Existing: {title}")
                    continue

                # New event — fetch detail page for description
                description = None
                if event_url:
                    description = _fetch_detail_description(page, event_url)

                if not description:
                    description = f"{title} at {venue_name}."

                tags = [card["category"]]
                if card["is_free"]:
                    tags.append("free")
                for raw_cat in card["raw_categories"]:
                    tag = raw_cat.lower().replace(" & ", "-").replace(" ", "-")
                    if tag not in tags:
                        tags.append(tag)

                event_record = {
                    "source_id": source_id,
                    "venue_id": venue_id,
                    "title": title,
                    "description": description[:2000],
                    "start_date": start_date,
                    "start_time": card["start_time"],
                    "end_date": None,
                    "end_time": None,
                    "is_all_day": False,
                    "category": card["category"],
                    "tags": tags,
                    "price_min": card["price_min"],
                    "price_max": card["price_max"],
                    "price_note": "Free" if card["is_free"] else None,
                    "is_free": card["is_free"],
                    "source_url": event_url or SEARCH_URL,
                    "ticket_url": event_url,
                    "image_url": None,
                    "raw_text": f"{title} | {venue_name} | {start_date}",
                    "extraction_confidence": 0.80,
                    "is_recurring": False,
                    "recurrence_rule": None,
                    "content_hash": content_hash,
                }

                try:
                    insert_event(event_record)
                    events_new += 1
                    logger.info(f"Added: {title} on {start_date} at {venue_name}")
                except Exception as e:
                    logger.error(f"Failed to insert: {title}: {e}")

            browser.close()

        logger.info(
            f"BigTickets crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl BigTickets: {e}")
        raise

    return events_found, events_new, events_updated
