"""
Crawler for Fly on a Wall (flyonawall.buzz).
Contemporary dance company and creative space at 2450 Piedmont Rd NE, Atlanta.
AKA the Lindbergh/Buckhead corridor.

Site: Wix (JS-rendered). Ticketing via built-in Wix Events.

Strategy:
  1. Load /whats-next with Playwright to get the full rendered event listing.
  2. Extract event-detail URLs from social-share links embedded in the page
     (pattern: flyonawall.buzz/event-details/<slug>).
  3. For each event-detail URL, fetch the page and extract JSON-LD structured
     data, which Wix generates for all events: title, startDate, endDate,
     location, and offer prices.
  4. Also capture description from the body text as a fallback.

Wix event-detail JSON-LD format:
  {
    "@type": "Event",
    "name": "Excuse The Art - FRIDAY",
    "startDate": "2026-03-27T20:00:00-04:00",
    "endDate": "2026-03-27T22:00:00-04:00",
    "location": {"@type": "Place", "name": "Fly on a Wall", "address": "2450 Piedmont Rd NE..."},
    "offers": {"highPrice": "20.50", "lowPrice": "15.38", "priceCurrency": "USD"}
  }
"""

from __future__ import annotations

import json
import logging
import re
from datetime import datetime, timezone
from typing import Optional

from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeoutError

from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://www.flyonawall.buzz"
EVENTS_LISTING_URL = f"{BASE_URL}/whats-next"

# Fly on a Wall's home venue
VENUE_DATA = {
    "name": "Fly on a Wall",
    "slug": "fly-on-a-wall",
    "address": "2450 Piedmont Rd NE, Suite 200",
    "neighborhood": "Buckhead",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30324",
    "lat": 33.8231,
    "lng": -84.3641,
    "venue_type": "dance_studio",
    "spot_type": "theater",
    "website": BASE_URL,
    "vibes": ["artsy", "intimate", "all-ages"],
}

# Some Fly on a Wall events happen at other Atlanta venues (e.g. "Channel 13")
# We'll create those dynamically from JSON-LD location data when they differ.

SKIP_TITLES = {
    "about", "team", "contact", "support", "donate", "subscribe", "calendar",
}


def _parse_iso_datetime(dt_str: str) -> tuple[Optional[str], Optional[str]]:
    """
    Parse an ISO-8601 datetime string to (date, time) strings.

    Input: "2026-03-27T20:00:00-04:00"
    Output: ("2026-03-27", "20:00")
    """
    if not dt_str:
        return None, None
    try:
        # Handle timezone-aware strings
        dt_str_clean = dt_str.rstrip("Z")
        # Remove timezone offset for naive parsing
        tz_match = re.search(r"([+-]\d{2}:\d{2})$", dt_str_clean)
        if tz_match:
            dt_str_clean = dt_str_clean[: -len(tz_match.group(1))]

        dt = datetime.fromisoformat(dt_str_clean)
        return dt.strftime("%Y-%m-%d"), dt.strftime("%H:%M")
    except (ValueError, TypeError):
        return None, None


def _extract_jsonld_event(html: str) -> Optional[dict]:
    """
    Extract the first Event JSON-LD block from a Wix event detail page.
    Returns the parsed dict or None.
    """
    scripts = re.findall(
        r'<script[^>]+type=["\']application/ld\+json["\'][^>]*>(.*?)</script>',
        html,
        re.DOTALL | re.IGNORECASE,
    )
    for script_content in scripts:
        try:
            data = json.loads(script_content.strip())
            if isinstance(data, dict) and data.get("@type") == "Event":
                return data
        except (json.JSONDecodeError, ValueError):
            continue
    return None


def _parse_price(offers: Optional[dict]) -> tuple[Optional[float], Optional[float], bool]:
    """
    Extract price_min, price_max, is_free from a JSON-LD offers block.

    Wix uses AggregateOffer with highPrice/lowPrice (with service fees included).
    We report the base ticket prices from the individual offers list when available,
    otherwise fall back to the aggregate.
    """
    if not offers:
        return None, None, False

    individual_prices: list[float] = []
    if "offers" in offers and isinstance(offers["offers"], list):
        for offer in offers["offers"]:
            try:
                p = float(offer.get("price", 0))
                if p > 0:
                    individual_prices.append(p)
            except (TypeError, ValueError):
                pass

    if individual_prices:
        price_min = min(individual_prices)
        price_max = max(individual_prices)
    else:
        # Fall back to aggregate — lowPrice/highPrice include service fees, close enough
        try:
            price_min = float(offers.get("lowPrice", 0)) or None
            price_max = float(offers.get("highPrice", 0)) or None
        except (TypeError, ValueError):
            price_min = None
            price_max = None

    if price_min is not None and price_max is not None:
        # Ensure min <= max
        if price_min > price_max:
            price_min, price_max = price_max, price_min

    is_free = price_min == 0.0 and price_max == 0.0

    return price_min, price_max, is_free


def _get_event_urls_from_listing(page) -> list[str]:
    """
    Load the What's Next listing page and extract all unique event-detail URLs.

    Wix embeds share links that contain the canonical event URLs:
      href="https://twitter.com/intent/tweet?url=https://www.flyonawall.buzz/event-details/..."
    We use those to reliably discover all events without needing to scrape
    the event card structure directly.
    """
    event_urls: list[str] = []
    seen: set[str] = set()

    try:
        logger.info(f"Fly on a Wall: loading {EVENTS_LISTING_URL}")
        page.goto(EVENTS_LISTING_URL, wait_until="domcontentloaded", timeout=30000)
        page.wait_for_timeout(7000)

        html = page.content()

        # Pattern 1: Direct href to /event-details/
        direct_links = re.findall(
            r'href=["\'](' + re.escape(BASE_URL) + r'/event-details/[^"\'?#]+)["\']',
            html,
        )
        for url in direct_links:
            if url not in seen:
                seen.add(url)
                event_urls.append(url)

        # Pattern 2: Share links embedding event URLs (Twitter, Facebook, LinkedIn)
        share_pattern = re.compile(
            r'url=' + re.escape(BASE_URL) + r'(/event-details/[A-Za-z0-9\-_]+)',
        )
        for m in share_pattern.finditer(html):
            full_url = BASE_URL + m.group(1)
            if full_url not in seen:
                seen.add(full_url)
                event_urls.append(full_url)

    except PlaywrightTimeoutError:
        logger.warning(f"Fly on a Wall: timeout loading {EVENTS_LISTING_URL}")
    except Exception as e:
        logger.error(f"Fly on a Wall: error loading listing page: {e}")

    logger.info(f"Fly on a Wall: found {len(event_urls)} event-detail URLs")
    return event_urls


def _parse_event_from_body_text(body_text: str, event_url: str) -> Optional[dict]:
    """
    Fallback text-based parser for Wix event detail pages that lack JSON-LD.

    Wix body text format (after nav items):
      EventTitle
      Time
      Mon, Mar 28, 2026, 8:00 PM – 10:00 PM
      Venue Name, Address, City, State Zip, USA
      Details
      <description text>
      ...
      Tickets
      ...

    Returns a partial event dict or None.
    """
    lines = [l.strip() for l in body_text.split("\n") if l.strip()]

    # Find the title: first non-nav line after the nav section
    nav_items = {
        "about", "team", "find us", "contact", "fly paper", "board of directors",
        "press", "what's next", "performance", "opportunities", "fellowship",
        "eta tickets", "education & community", "classes", "open bounce",
        "creative intensive", "eye level", "catalogue", "floor story", "support",
        "fly on a wall merch", "donate", "how to find us", "calendar", "subscribe",
        "time", "details", "tickets",
    }

    title = None
    title_idx = -1
    for i, line in enumerate(lines):
        if line.lower() not in nav_items and len(line) > 3 and len(line) < 200:
            # First non-nav, non-empty line is likely the title
            title = line
            title_idx = i
            break

    if not title:
        return None

    # Find datetime line — Wix format: "Mon, Mar 28, 2026, 8:00 PM – 10:00 PM"
    # or "Mar 28, 2026, 8:00 PM – 10:00 PM"
    dt_pattern = re.compile(
        r"(?:(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\w*,?\s+)?"
        r"(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+"
        r"(\d{1,2}),?\s+"
        r"(\d{4}),?\s+"
        r"(\d{1,2}:\d{2}\s*(?:AM|PM))"
        r"(?:\s*[–\-]\s*(\d{1,2}:\d{2}\s*(?:AM|PM)))?",
        re.IGNORECASE,
    )

    start_date = None
    start_time = None
    end_date = None
    end_time = None

    for line in lines[title_idx:title_idx + 8]:
        m = dt_pattern.search(line)
        if m:
            month_abbr, day, year, time_start = m.group(1), m.group(2), m.group(3), m.group(4)
            time_end = m.group(5)

            # Parse month
            month_abbr_map = {
                "jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6,
                "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12,
            }
            month = month_abbr_map.get(month_abbr[:3].lower())
            if not month:
                continue

            try:
                dt = datetime(int(year), month, int(day))
                start_date = dt.strftime("%Y-%m-%d")
                end_date = start_date

                # Parse times to 24h
                def _to_24h(t_str: str) -> Optional[str]:
                    if not t_str:
                        return None
                    tm = re.match(r"(\d{1,2}):(\d{2})\s*(AM|PM)", t_str.strip(), re.IGNORECASE)
                    if not tm:
                        return None
                    h, m_val, mer = int(tm.group(1)), int(tm.group(2)), tm.group(3).upper()
                    if mer == "PM" and h != 12:
                        h += 12
                    elif mer == "AM" and h == 12:
                        h = 0
                    return f"{h:02d}:{m_val:02d}"

                start_time = _to_24h(time_start)
                end_time = _to_24h(time_end) if time_end else None
                break
            except ValueError:
                continue

    if not start_date:
        return None

    # Find location line — comes right after the time line
    location_name = "Fly on a Wall"
    location_address = ""
    for line in lines[title_idx:title_idx + 12]:
        if re.search(r"\d{5}", line) and "," in line:
            # Looks like an address with zip code
            parts = [p.strip() for p in line.split(",")]
            if parts:
                location_name = parts[0]
                location_address = line
            break

    # Find description — between "Details" and "Tickets"
    description = None
    in_desc = False
    desc_lines = []
    for line in lines:
        if line.lower() == "details":
            in_desc = True
            continue
        if in_desc:
            if line.lower() in ("tickets", "ticket type", "subscribe"):
                break
            desc_lines.append(line)
    if desc_lines:
        raw = "\n".join(desc_lines).strip()
        raw = re.sub(r"\n{3,}", "\n\n", raw)
        description = raw[:800]

    # Parse prices from description text
    price_min, price_max, is_free = None, None, False
    all_text = "\n".join(desc_lines)
    price_matches = re.findall(r"\$(\d+(?:\.\d+)?)", all_text)
    if price_matches:
        prices = [float(p) for p in price_matches]
        price_min = min(prices)
        price_max = max(prices)
        is_free = price_max == 0.0

    return {
        "title": title,
        "description": description,
        "start_date": start_date,
        "start_time": start_time,
        "end_date": end_date,
        "end_time": end_time,
        "location_name": location_name,
        "location_address": location_address,
        "price_min": price_min,
        "price_max": price_max,
        "is_free": is_free,
        "image_url": None,
        "event_url": event_url,
    }


def _scrape_event_detail(page, event_url: str) -> Optional[dict]:
    """
    Load an event-detail page and extract all available data.

    Primary path: JSON-LD structured data (most Wix event pages have this).
    Fallback: Text-based parsing of body content for pages without JSON-LD.

    Returns a dict with:
        title, description, start_date, start_time, end_date, end_time,
        location_name, location_address, price_min, price_max, is_free, image_url
    """
    try:
        page.goto(event_url, wait_until="domcontentloaded", timeout=25000)
        page.wait_for_timeout(5000)

        html = page.content()
        body_text = page.inner_text("body")

        # Primary: JSON-LD
        ld_data = _extract_jsonld_event(html)

        if ld_data:
            title = ld_data.get("name", "").strip()
            if not title or title.lower() in SKIP_TITLES:
                return None

            start_date, start_time = _parse_iso_datetime(ld_data.get("startDate", ""))
            end_date, end_time = _parse_iso_datetime(ld_data.get("endDate", ""))

            if not start_date:
                logger.debug(f"Fly on a Wall: no parseable start date for {event_url}")
                return None

            location = ld_data.get("location", {})
            location_name = location.get("name", "Fly on a Wall")
            location_address = location.get("address", "")

            offers = ld_data.get("offers", {})
            price_min, price_max, is_free = _parse_price(offers)

        else:
            # Fallback: text-based parsing
            logger.debug(f"Fly on a Wall: no JSON-LD on {event_url}, using text fallback")
            result = _parse_event_from_body_text(body_text, event_url)
            if not result:
                return None

            title = result["title"]
            start_date = result["start_date"]
            start_time = result["start_time"]
            end_date = result["end_date"]
            end_time = result["end_time"]
            location_name = result["location_name"]
            location_address = result["location_address"]
            price_min = result["price_min"]
            price_max = result["price_max"]
            is_free = result["is_free"]

        if not title or title.lower() in SKIP_TITLES:
            return None

        # Skip past events
        try:
            if datetime.strptime(start_date, "%Y-%m-%d").date() < datetime.now().date():
                return None
        except ValueError:
            pass

        # Description — extract from body text regardless of parse path
        description = None
        desc_match = re.search(
            r"Details\s*\n+([\s\S]+?)(?:\nTickets|\nTicket type|\nSubscribe|\Z)",
            body_text,
        )
        if desc_match:
            raw_desc = desc_match.group(1).strip()
            raw_desc = re.sub(r"\n{3,}", "\n\n", raw_desc)
            description = raw_desc[:800]

        # Image from og:image meta tag
        image_url = None
        og_match = re.search(
            r'<meta[^>]+property=["\']og:image["\'][^>]+content=["\']([^"\']+)["\']',
            html,
            re.IGNORECASE,
        )
        if not og_match:
            og_match = re.search(
                r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+property=["\']og:image["\']',
                html,
                re.IGNORECASE,
            )
        if og_match:
            image_url = og_match.group(1)

        return {
            "title": title,
            "description": description,
            "start_date": start_date,
            "start_time": start_time,
            "end_date": end_date,
            "end_time": end_time,
            "location_name": location_name,
            "location_address": location_address,
            "price_min": price_min,
            "price_max": price_max,
            "is_free": is_free,
            "image_url": image_url,
            "event_url": event_url,
        }

    except PlaywrightTimeoutError:
        logger.warning(f"Fly on a Wall: timeout scraping {event_url}")
        return None
    except Exception as e:
        logger.warning(f"Fly on a Wall: error scraping {event_url}: {e}")
        return None


def _get_or_create_event_venue(event_data: dict, home_venue_id: int) -> tuple[int, str]:
    """
    Determine the venue for an event. If the event is at Fly on a Wall's own
    space, return the home venue. If it's at another Atlanta venue, create/fetch
    that venue dynamically.
    """
    location_name = event_data.get("location_name", "").strip()
    location_address = event_data.get("location_address", "").strip()

    # Check if this is the home venue
    home_indicators = {"fly on a wall", "flyonawall", "2450 piedmont"}
    if any(ind in location_name.lower() or ind in location_address.lower() for ind in home_indicators):
        return home_venue_id, VENUE_DATA["name"]

    # External venue — try to create from address data
    if not location_name or not location_address:
        return home_venue_id, VENUE_DATA["name"]

    # Parse city/state/zip from address string like
    # "2450 Piedmont Rd NE, Atlanta, GA 30324, USA"
    addr_parts = [p.strip() for p in location_address.split(",")]
    city = "Atlanta"
    state = "GA"
    zip_code = None
    address_line = location_address

    if len(addr_parts) >= 3:
        address_line = addr_parts[0]
        city = addr_parts[1] if len(addr_parts) > 1 else "Atlanta"
        state_zip = addr_parts[2] if len(addr_parts) > 2 else "GA"
        state_zip_match = re.match(r"([A-Z]{2})\s*(\d{5})?", state_zip.strip(), re.IGNORECASE)
        if state_zip_match:
            state = state_zip_match.group(1).upper()
            zip_code = state_zip_match.group(2)

    slug = re.sub(r"[^a-z0-9]+", "-", location_name.lower()).strip("-")

    venue_data = {
        "name": location_name,
        "slug": slug,
        "address": address_line,
        "city": city,
        "state": state,
        "zip": zip_code,
        "neighborhood": city if city != "Atlanta" else "Atlanta",
        "venue_type": "venue",
        "spot_type": "theater",
    }

    try:
        venue_id = get_or_create_venue(venue_data)
        return venue_id, location_name
    except Exception as e:
        logger.warning(f"Fly on a Wall: could not create venue '{location_name}': {e}")
        return home_venue_id, VENUE_DATA["name"]


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Fly on a Wall contemporary dance events."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                user_agent=(
                    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
                ),
                viewport={"width": 1280, "height": 900},
            )
            page = context.new_page()

            # Ensure home venue exists
            home_venue_id = get_or_create_venue(VENUE_DATA)

            # Step 1: Collect all event-detail URLs from the listing page
            event_urls = _get_event_urls_from_listing(page)

            # Step 2: Scrape each event detail page
            for event_url in event_urls:
                event_data = _scrape_event_detail(page, event_url)
                if not event_data:
                    continue

                venue_id, venue_name = _get_or_create_event_venue(event_data, home_venue_id)

                title = event_data["title"]
                start_date = event_data["start_date"]
                start_time = event_data.get("start_time")

                # Build tags
                tags = ["fly-on-a-wall", "dance", "contemporary-dance", "performing-arts", "buckhead"]
                title_lower = title.lower()
                if "excuse the art" in title_lower or "eta" == title_lower:
                    tags.append("excuse-the-art")
                if "bunk beds" in title_lower:
                    tags.append("new-work")
                if "intensive" in title_lower:
                    tags.extend(["workshop", "dance-education"])
                if "channel" in title_lower:
                    tags.append("new-work")

                content_hash = generate_content_hash(title, venue_name, start_date)
                events_found += 1

                event_record = {
                    "source_id": source_id,
                    "venue_id": venue_id,
                    "title": title,
                    "description": event_data.get("description"),
                    "start_date": start_date,
                    "start_time": start_time,
                    "end_date": event_data.get("end_date"),
                    "end_time": event_data.get("end_time"),
                    "is_all_day": False,
                    "category": "theater",
                    "subcategory": "dance",
                    "tags": tags,
                    "price_min": event_data.get("price_min"),
                    "price_max": event_data.get("price_max"),
                    "price_note": "$20 presale / $25 at door" if event_data.get("price_min") == 20.0 else None,
                    "is_free": event_data.get("is_free", False),
                    "source_url": event_url,
                    "ticket_url": event_url,
                    "image_url": event_data.get("image_url"),
                    "raw_text": f"{title} — {start_date} {start_time or ''}".strip(),
                    "extraction_confidence": 0.95,
                    "is_recurring": False,
                    "recurrence_rule": None,
                    "content_hash": content_hash,
                }

                existing = find_event_by_hash(content_hash)
                if existing:
                    smart_update_existing_event(existing, event_record)
                    events_updated += 1
                    continue

                try:
                    insert_event(event_record)
                    events_new += 1
                    logger.info(
                        f"Fly on a Wall: added '{title}' on {start_date} at {start_time} ({venue_name})"
                    )
                except Exception as e:
                    logger.error(f"Fly on a Wall: failed to insert '{title}' on {start_date}: {e}")

            browser.close()

    except Exception as e:
        logger.error(f"Fly on a Wall: crawl failed: {e}")
        raise

    logger.info(
        f"Fly on a Wall crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
    )
    return events_found, events_new, events_updated
