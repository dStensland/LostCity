#!/usr/bin/env python3
"""
Scrape venue websites and LLM-extract specials, hours, menus, reservation links,
phone, instagram, price level, and vibes in a single pass.

For each venue with a website:
1. Fetches the main page + common subpages (/menu, /happy-hour, /specials, /hours)
2. Regex-extracts instagram handles and phone numbers from HTML
3. LLM-extracts structured data: specials, hours, menu_url, reservation_url,
   phone, instagram, price_level, vibes
4. Upserts into venue_specials + updates venue columns
5. Tracks last_verified_at for freshness

Usage:
    # Scrape venues in a corridor (lat/lng + radius)
    python3 scrape_venue_specials.py --lat 33.7834 --lng -84.3731 --radius 2

    # Scrape specific venues by ID
    python3 scrape_venue_specials.py --venue-ids 100,200,300

    # Scrape venues by type
    python3 scrape_venue_specials.py --venue-type bar --limit 50

    # Venue enrichment only (skip specials table writes)
    python3 scrape_venue_specials.py --venue-type restaurant --skip-specials

    # Overwrite existing data instead of only filling empty fields
    python3 scrape_venue_specials.py --venue-ids 100 --force-update

    # Dry run (don't write to DB)
    python3 scrape_venue_specials.py --lat 33.7834 --lng -84.3731 --radius 2 --dry-run
"""

import re
import sys
import json
import time
import math
import logging
import argparse
from datetime import datetime
from pathlib import Path
from typing import Optional
from bs4 import BeautifulSoup
import requests
from playwright.sync_api import sync_playwright

env_path = Path(__file__).parent.parent / ".env"
from dotenv import load_dotenv
load_dotenv(env_path)

sys.path.insert(0, str(Path(__file__).parent))
from db import get_client
from llm_client import generate_text

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
}

# Common subpage paths to check for specials/hours/menu
SUBPAGES = [
    "/menu", "/menus", "/food-menu", "/drink-menu", "/drinks",
    "/happy-hour", "/happyhour", "/specials", "/daily-specials",
    "/hours", "/visit", "/about",
    "/reservations", "/reserve", "/book",
    "/events", "/happenings", "/whats-on",
    "/holiday-hours", "/holidays",
]

# Known reservation platform patterns
RESERVATION_PATTERNS = [
    "resy.com", "opentable.com", "yelp.com/reservations",
    "exploretock.com", "sevenrooms.com", "toast.com",
]

# ISO weekday mapping for LLM output
DAY_MAP = {
    "monday": 1, "mon": 1,
    "tuesday": 2, "tue": 2, "tues": 2,
    "wednesday": 3, "wed": 3,
    "thursday": 4, "thu": 4, "thur": 4, "thurs": 4,
    "friday": 5, "fri": 5,
    "saturday": 6, "sat": 6,
    "sunday": 7, "sun": 7,
}

VALID_VIBES = {
    "dog-friendly", "patio", "rooftop", "outdoor-seating",
    "craft-cocktails", "live-music", "divey", "upscale", "casual",
    "intimate", "date-spot", "late-night", "good-for-groups",
    "family-friendly", "lgbtq-friendly",
}

# Regex for US phone numbers
PHONE_RE = re.compile(
    r"(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}"
)

# Regex for Instagram handles from links
INSTAGRAM_LINK_RE = re.compile(
    r"instagram\.com/([A-Za-z0-9_.]{1,30})(?:[/?#]|$)"
)

# Shared Playwright browser — lazily initialized, reused across venues
_playwright = None
_browser = None
_playwright_fallback_count = 0


def _get_browser():
    """Lazily launch a shared headless Chromium for the whole run."""
    global _playwright, _browser
    if _browser is None:
        _playwright = sync_playwright().start()
        _browser = _playwright.chromium.launch(headless=True)
    return _browser


def _close_browser():
    """Cleanup shared browser at end of run."""
    global _playwright, _browser
    if _browser:
        _browser.close()
        _browser = None
    if _playwright:
        _playwright.stop()
        _playwright = None


def fetch_page_playwright(url: str) -> Optional[str]:
    """Fetch a page using headless Chromium. Used as fallback for bot-protected sites."""
    try:
        browser = _get_browser()
        context = browser.new_context(
            user_agent=HEADERS["User-Agent"],
            viewport={"width": 1920, "height": 1080},
        )
        try:
            page = context.new_page()
            page.goto(url, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(2000)
            html = page.content()
            return html
        finally:
            context.close()
    except Exception as e:
        logger.debug(f"  Playwright fetch failed: {e}")
        return None


EXTRACTION_PROMPT = """You are a venue data extraction system for a nightlife/restaurant guide app.
Given HTML content from a venue's website, extract structured data in one pass.

RULES:
1. Extract ONLY information explicitly stated on the page. Never invent details.
2. For specials: look for happy hours, daily deals, recurring events (trivia, DJ nights, karaoke), brunch deals, wine specials, food specials.
3. For hours: extract operating hours for each day of the week.
4. For menu: find links to their menu page (food menu, drink menu, etc.).
5. For reservations: find links to Resy, OpenTable, SevenRooms, Tock, or any booking system.
6. For phone: extract venue phone number in format "(404) 555-1234".
7. For instagram: extract the handle (no @) from any Instagram link or @mention on the page.
8. For price_level: infer from menu prices or self-description. 1=$, 2=$$, 3=$$$, 4=$$$$. "Fine dining"=4, "dive bar"=1, typical bar/restaurant=2. Only set if evidence exists.
9. For vibes: tag ONLY vibes with explicit evidence on the page (e.g., "dogs welcome" photo of patio, "rooftop bar" in description). Valid values: "dog-friendly", "patio", "rooftop", "outdoor-seating", "craft-cocktails", "live-music", "divey", "upscale", "casual", "intimate", "date-spot", "late-night", "good-for-groups", "family-friendly", "lgbtq-friendly".
10. If information is unclear or not found, use null (or [] for arrays).
11. Times should be 24-hour format "HH:MM".
12. Days should be lowercase English day names: "monday", "tuesday", etc.
13. special.type must be one of: happy_hour, daily_special, recurring_deal, event_night, brunch, exhibit, seasonal_menu
14. For holiday_hours: extract any modified hours for specific holidays (Thanksgiving, Christmas Eve, Christmas, NYE, New Year's Day, etc.). Only extract holidays explicitly mentioned on the page.
15. For holiday_specials: extract one-off specials tied to specific dates (NYE party, Valentine's dinner, holiday brunch, etc.).
16. Use YYYY-MM-DD format for all dates. Infer the year from context — use the current year if the holiday hasn't passed yet, otherwise the next occurrence.

Return valid JSON only, no markdown formatting.

{
  "specials": [
    {
      "title": "Half-Price Wine Wednesday",
      "type": "daily_special",
      "description": "50% off all bottles of wine",
      "days": ["wednesday"],
      "time_start": "16:00",
      "time_end": "19:00",
      "price_note": "50% off bottles"
    }
  ],
  "holiday_hours": [
    {"name": "Christmas Eve", "date": "2026-12-24", "open": "11:00", "close": "17:00", "closed": false},
    {"name": "Christmas Day", "date": "2026-12-25", "open": null, "close": null, "closed": true}
  ],
  "holiday_specials": [
    {
      "title": "NYE Champagne Toast",
      "date": "2026-12-31",
      "description": "Ring in the new year with complimentary champagne toast at midnight",
      "price_note": "$150/person"
    }
  ],
  "hours": {
    "monday": {"open": "11:00", "close": "22:00"},
    "tuesday": {"open": "11:00", "close": "22:00"},
    "wednesday": {"open": "11:00", "close": "22:00"},
    "thursday": {"open": "11:00", "close": "23:00"},
    "friday": {"open": "11:00", "close": "00:00"},
    "saturday": {"open": "10:00", "close": "00:00"},
    "sunday": {"open": "10:00", "close": "22:00"}
  },
  "menu_url": "https://example.com/menu",
  "reservation_url": "https://resy.com/cities/atlanta/example",
  "description": "A brief one-sentence description of the venue if found.",
  "phone": "(404) 555-1234",
  "instagram": "venuename",
  "price_level": 2,
  "vibes": ["patio", "craft-cocktails", "date-spot"]
}

If the page has no useful venue information (e.g., it's a generic homepage with no hours/specials), return:
{"specials": [], "holiday_hours": [], "holiday_specials": [], "hours": null, "menu_url": null, "reservation_url": null, "description": null, "phone": null, "instagram": null, "price_level": null, "vibes": []}
"""


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Haversine distance in km."""
    R = 6371
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlng/2)**2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def fetch_page(url: str, timeout: int = 10, use_playwright: bool = True) -> Optional[str]:
    """Fetch a URL and return HTML. Falls back to Playwright on 403."""
    global _playwright_fallback_count
    try:
        resp = requests.get(url, headers=HEADERS, timeout=timeout, allow_redirects=True)
        if resp.status_code == 200:
            return resp.text
        if resp.status_code == 403 and use_playwright:
            logger.debug("  Retrying with browser (got 403)")
            html = fetch_page_playwright(url)
            if html:
                _playwright_fallback_count += 1
            return html
        return None
    except (requests.ConnectionError, requests.Timeout) as e:
        if use_playwright:
            logger.debug(f"  Connection failed ({e.__class__.__name__}), trying browser")
            html = fetch_page_playwright(url)
            if html:
                _playwright_fallback_count += 1
            return html
        return None
    except Exception:
        return None


def extract_page_content(html: str, max_chars: int = 12000) -> str:
    """Extract meaningful text from HTML, stripping scripts/styles/nav."""
    soup = BeautifulSoup(html, "html.parser")

    # Remove non-content elements
    for tag in soup.find_all(["script", "style", "nav", "footer", "header", "noscript", "iframe"]):
        tag.decompose()

    text = soup.get_text(separator="\n", strip=True)

    # Collapse multiple newlines
    lines = [line.strip() for line in text.split("\n") if line.strip()]
    text = "\n".join(lines)

    return text[:max_chars]


def extract_meta_and_links(html: str, base_url: str) -> dict:
    """Extract meta tags, og:image, reservation/menu links, instagram, and phone from HTML."""
    soup = BeautifulSoup(html, "html.parser")
    result = {
        "og_image": None,
        "meta_description": None,
        "reservation_links": [],
        "menu_links": [],
        "instagram": None,
        "phone": None,
    }

    # og:image
    og_img = soup.find("meta", attrs={"property": "og:image"})
    if og_img and og_img.get("content"):
        result["og_image"] = og_img["content"]

    # Meta description
    meta_desc = soup.find("meta", attrs={"name": "description"})
    if meta_desc and meta_desc.get("content"):
        result["meta_description"] = meta_desc["content"]

    # Scan all links for reservation, menu, and instagram URLs
    for a in soup.find_all("a", href=True):
        href = a["href"]
        href_lower = href.lower()
        text_lower = (a.get_text(strip=True) or "").lower()

        # Instagram links
        if "instagram.com/" in href_lower and not result["instagram"]:
            m = INSTAGRAM_LINK_RE.search(href)
            if m:
                handle = m.group(1).lower()
                # Skip generic pages
                if handle not in ("p", "reel", "stories", "explore", "accounts"):
                    result["instagram"] = handle

        # Reservation links
        if any(p in href_lower for p in RESERVATION_PATTERNS):
            result["reservation_links"].append(href)
        elif any(kw in text_lower for kw in ["reserve", "reservation", "book a table", "book now"]):
            if href.startswith("http"):
                result["reservation_links"].append(href)

        # Menu links
        if any(kw in href_lower for kw in ["/menu", "/food-menu", "/drink-menu", "/drinks"]):
            full_url = href if href.startswith("http") else base_url.rstrip("/") + "/" + href.lstrip("/")
            result["menu_links"].append(full_url)
        elif any(kw in text_lower for kw in ["menu", "food & drink", "food and drink"]):
            if "/menu" in href_lower or not href.startswith("#"):
                full_url = href if href.startswith("http") else base_url.rstrip("/") + "/" + href.lstrip("/")
                result["menu_links"].append(full_url)

    # Phone from tel: links
    tel_link = soup.find("a", href=re.compile(r"^tel:", re.I))
    if tel_link:
        raw_tel = tel_link["href"].replace("tel:", "").strip()
        digits = re.sub(r"\D", "", raw_tel)
        if len(digits) == 10:
            result["phone"] = f"({digits[:3]}) {digits[3:6]}-{digits[6:]}"
        elif len(digits) == 11 and digits[0] == "1":
            result["phone"] = f"({digits[1:4]}) {digits[4:7]}-{digits[7:]}"

    # Phone fallback: scan visible text for phone patterns
    if not result["phone"]:
        body_text = soup.get_text(separator=" ")
        phone_match = PHONE_RE.search(body_text)
        if phone_match:
            raw = phone_match.group()
            digits = re.sub(r"\D", "", raw)
            if len(digits) == 10:
                result["phone"] = f"({digits[:3]}) {digits[3:6]}-{digits[6:]}"
            elif len(digits) == 11 and digits[0] == "1":
                result["phone"] = f"({digits[1:4]}) {digits[4:7]}-{digits[7:]}"

    return result


def parse_days(day_names: list) -> list[int]:
    """Convert day name strings to ISO weekday integers."""
    result = []
    for d in day_names:
        d_lower = d.strip().lower()
        if d_lower in DAY_MAP:
            result.append(DAY_MAP[d_lower])
    return sorted(set(result))


def scrape_venue(venue: dict, use_playwright: bool = True) -> Optional[dict]:
    """Scrape a single venue's website and extract structured data."""
    website = venue.get("website", "")
    if not website:
        return None

    # Normalize URL
    if not website.startswith("http"):
        website = "https://" + website

    # Fetch main page — try requests first, log if Playwright needed
    main_html = fetch_page(website, use_playwright=False)
    if not main_html and use_playwright:
        logger.info("  Using browser fallback (got 403)")
        main_html = fetch_page_playwright(website)
        global _playwright_fallback_count
        if main_html:
            _playwright_fallback_count += 1
    if not main_html:
        logger.info("  Could not fetch main page")
        return None

    # Extract meta info and links from HTML
    meta = extract_meta_and_links(main_html, website)
    main_text = extract_page_content(main_html)

    # Try fetching relevant subpages
    subpage_texts = []
    for subpage in SUBPAGES:
        url = website.rstrip("/") + subpage
        html = fetch_page(url, timeout=5, use_playwright=use_playwright)
        if html:
            text = extract_page_content(html, max_chars=4000)
            if len(text) > 100 and text != main_text[:len(text)]:  # Skip if same as main
                subpage_texts.append(f"--- Page: {subpage} ---\n{text}")

    # Combine all content for LLM
    combined = f"--- Main Page ---\n{main_text}"
    if subpage_texts:
        combined += "\n\n" + "\n\n".join(subpage_texts[:3])  # Limit to 3 subpages

    # Truncate to stay within LLM context
    combined = combined[:20000]

    # LLM extraction
    try:
        raw = generate_text(EXTRACTION_PROMPT, combined)

        # Strip markdown code fences if present
        raw = raw.strip()
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[1] if "\n" in raw else raw[3:]
        if raw.endswith("```"):
            raw = raw[:-3]
        raw = raw.strip()

        data = json.loads(raw)
    except (json.JSONDecodeError, Exception) as e:
        logger.info(f"  LLM extraction failed: {e}")
        return None

    # Merge in meta-extracted data (HTML extraction preferred for links/phone/instagram)
    if not data.get("reservation_url") and meta["reservation_links"]:
        data["reservation_url"] = meta["reservation_links"][0]

    if not data.get("menu_url") and meta["menu_links"]:
        data["menu_url"] = meta["menu_links"][0]

    if not data.get("description") and meta["meta_description"]:
        desc = meta["meta_description"].strip()
        if len(desc) >= 30:
            data["description"] = desc

    data["og_image"] = meta["og_image"]

    # Prefer HTML-extracted instagram/phone (more reliable than LLM)
    if meta["instagram"]:
        data["instagram"] = meta["instagram"]
    elif data.get("instagram"):
        # Clean LLM output: strip @ prefix if present
        data["instagram"] = data["instagram"].lstrip("@").lower()

    if meta["phone"]:
        data["phone"] = meta["phone"]

    # Validate vibes — only keep valid ones
    raw_vibes = data.get("vibes") or []
    data["vibes"] = [v for v in raw_vibes if v in VALID_VIBES]

    # Validate price_level
    pl = data.get("price_level")
    if pl is not None:
        try:
            pl = int(pl)
            if pl < 1 or pl > 4:
                pl = None
        except (ValueError, TypeError):
            pl = None
        data["price_level"] = pl

    return data


def upsert_results(
    venue: dict,
    data: dict,
    dry_run: bool = False,
    skip_specials: bool = False,
    force_update: bool = False,
) -> dict:
    """Write extracted data to the database."""
    client = get_client()
    venue_id = venue["id"]
    now = datetime.utcnow().isoformat()
    stats = {"specials_added": 0, "holiday_hours_added": 0, "holiday_specials_added": 0, "venue_updated": False}

    def should_set(field_name: str, data_key: str = None) -> bool:
        """Return True if we should write this field (has data + empty or forced)."""
        dk = data_key or field_name
        if not data.get(dk):
            return False
        return force_update or not venue.get(field_name)

    # --- Update venue columns ---
    updates = {"last_verified_at": now}

    if data.get("hours"):
        updates["hours"] = data["hours"]

    if should_set("menu_url"):
        updates["menu_url"] = data["menu_url"]

    if should_set("reservation_url"):
        updates["reservation_url"] = data["reservation_url"]

    if should_set("description"):
        updates["description"] = data["description"]

    if should_set("image_url", "og_image"):
        updates["image_url"] = data["og_image"]

    if should_set("phone"):
        updates["phone"] = data["phone"]

    if should_set("instagram"):
        updates["instagram"] = data["instagram"]

    if data.get("price_level") and (force_update or not venue.get("price_level")):
        updates["price_level"] = data["price_level"]

    # Vibes: merge new vibes with existing ones (never remove)
    new_vibes = data.get("vibes") or []
    if new_vibes:
        existing_vibes = venue.get("vibes") or []
        merged = list(set(existing_vibes) | set(new_vibes))
        if force_update or set(merged) != set(existing_vibes):
            updates["vibes"] = sorted(merged)

    if len(updates) > 1:  # More than just last_verified_at
        stats["venue_updated"] = True

    if not dry_run:
        client.table("venues").update(updates).eq("id", venue_id).execute()

    # --- Upsert specials ---
    if not skip_specials:
        specials = data.get("specials", [])
        holiday_hours = data.get("holiday_hours", [])
        holiday_specials = data.get("holiday_specials", [])

        if not dry_run and (specials or holiday_hours or holiday_specials):
            # Delete only recurring specials (start_date IS NULL) — preserve holiday entries
            client.table("venue_specials").delete().eq("venue_id", venue_id).is_("start_date", "null").execute()
            # Delete holiday entries for the same holidays being re-scraped
            holiday_dates = [h["date"] for h in holiday_hours if h.get("date")]
            holiday_dates += [h["date"] for h in holiday_specials if h.get("date")]
            if holiday_dates:
                client.table("venue_specials").delete().eq("venue_id", venue_id).in_("start_date", holiday_dates).execute()

        # Recurring specials
        for special in specials:
            days = parse_days(special.get("days") or []) or None
            row = {
                "venue_id": venue_id,
                "title": special.get("title", "Special"),
                "type": special.get("type", "daily_special"),
                "description": special.get("description"),
                "days_of_week": days,
                "time_start": special.get("time_start"),
                "time_end": special.get("time_end"),
                "price_note": special.get("price_note"),
                "confidence": "medium",
                "source_url": venue.get("website"),
                "last_verified_at": now,
                "is_active": True,
            }

            if not dry_run:
                client.table("venue_specials").insert(row).execute()

            stats["specials_added"] += 1

        # Holiday hours
        for hh in holiday_hours:
            if not hh.get("date"):
                continue
            is_closed = hh.get("closed", False)
            row = {
                "venue_id": venue_id,
                "title": hh.get("name", "Holiday Hours"),
                "type": "holiday_hours",
                "description": "Closed" if is_closed else None,
                "start_date": hh["date"],
                "end_date": hh["date"],
                "time_start": None if is_closed else hh.get("open"),
                "time_end": None if is_closed else hh.get("close"),
                "confidence": "medium",
                "source_url": venue.get("website"),
                "last_verified_at": now,
                "is_active": True,
            }

            if not dry_run:
                client.table("venue_specials").insert(row).execute()

            stats["holiday_hours_added"] += 1

        # Holiday specials
        for hs in holiday_specials:
            if not hs.get("date"):
                continue
            row = {
                "venue_id": venue_id,
                "title": hs.get("title", "Holiday Special"),
                "type": "holiday_special",
                "description": hs.get("description"),
                "start_date": hs["date"],
                "price_note": hs.get("price_note"),
                "confidence": "medium",
                "source_url": venue.get("website"),
                "last_verified_at": now,
                "is_active": True,
            }

            if not dry_run:
                client.table("venue_specials").insert(row).execute()

            stats["holiday_specials_added"] += 1

    return stats


def get_venues(
    lat: Optional[float] = None,
    lng: Optional[float] = None,
    radius_km: float = 2.0,
    venue_ids: Optional[list[int]] = None,
    venue_type: Optional[str] = None,
    limit: int = 200,
) -> list[dict]:
    """Fetch venues to scrape from the database."""
    client = get_client()

    query = (
        client.table("venues")
        .select("id, name, slug, website, venue_type, description, image_url, lat, lng, hours, menu_url, reservation_url, instagram, price_level, vibes")
        .neq("active", False)
        .not_.is_("website", "null")
    )

    if venue_ids:
        query = query.in_("id", venue_ids)
    elif venue_type:
        query = query.eq("venue_type", venue_type)

    result = query.order("name").limit(5000).execute()
    venues = result.data or []

    # Filter by distance if lat/lng provided
    if lat is not None and lng is not None:
        venues = [
            v for v in venues
            if v.get("lat") and v.get("lng")
            and haversine_km(lat, lng, float(v["lat"]), float(v["lng"])) <= radius_km
        ]

    # Sort by distance from center if available
    if lat is not None and lng is not None:
        venues.sort(key=lambda v: haversine_km(lat, lng, float(v["lat"]), float(v["lng"])))

    return venues[:limit]


def main():
    parser = argparse.ArgumentParser(description="Scrape venue websites — extract specials, hours, phone, instagram, vibes, and more")
    parser.add_argument("--lat", type=float, help="Center latitude for corridor search")
    parser.add_argument("--lng", type=float, help="Center longitude for corridor search")
    parser.add_argument("--radius", type=float, default=2.0, help="Radius in km (default: 2)")
    parser.add_argument("--venue-ids", type=str, help="Comma-separated venue IDs")
    parser.add_argument("--venue-type", type=str, help="Filter by venue type (bar, restaurant, etc.)")
    parser.add_argument("--limit", type=int, default=200, help="Max venues to process")
    parser.add_argument("--dry-run", action="store_true", help="Don't write to database")
    parser.add_argument("--verbose", action="store_true", help="Show LLM extraction details")
    parser.add_argument("--skip-specials", action="store_true", help="Skip venue_specials writes (venue enrichment only)")
    parser.add_argument("--force-update", action="store_true", help="Overwrite existing data (default: only fill empty fields)")
    parser.add_argument("--no-playwright", action="store_true", help="Disable Playwright fallback for bot-protected sites")
    args = parser.parse_args()

    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)

    # Parse venue IDs
    venue_ids = None
    if args.venue_ids:
        venue_ids = [int(x.strip()) for x in args.venue_ids.split(",") if x.strip()]

    venues = get_venues(
        lat=args.lat, lng=args.lng, radius_km=args.radius,
        venue_ids=venue_ids, venue_type=args.venue_type, limit=args.limit,
    )

    use_playwright = not args.no_playwright

    logger.info(f"Found {len(venues)} venues to scrape")
    if args.dry_run:
        logger.info("DRY RUN — no database writes")
    if args.skip_specials:
        logger.info("SKIP SPECIALS — venue enrichment only")
    if args.force_update:
        logger.info("FORCE UPDATE — overwriting existing data")
    if not use_playwright:
        logger.info("PLAYWRIGHT DISABLED — no browser fallback for 403s")
    logger.info("=" * 60)

    totals = {"scraped": 0, "specials": 0, "holiday_hours": 0, "holiday_specials": 0, "venues_updated": 0, "failed": 0, "skipped": 0, "playwright_fallbacks": 0}

    try:
        for i, venue in enumerate(venues, 1):
            name = venue["name"][:45]
            dist_str = ""
            if args.lat and args.lng and venue.get("lat") and venue.get("lng"):
                dist = haversine_km(args.lat, args.lng, float(venue["lat"]), float(venue["lng"]))
                dist_str = f" ({dist:.1f}km)"

            logger.info(f"[{i}/{len(venues)}] {name}{dist_str}")

            data = scrape_venue(venue, use_playwright=use_playwright)
            if not data:
                totals["failed"] += 1
                continue

            n_specials = len(data.get("specials", []))
            n_hol_hours = len(data.get("holiday_hours", []))
            n_hol_specials = len(data.get("holiday_specials", []))
            has_hours = bool(data.get("hours"))
            has_menu = bool(data.get("menu_url"))
            has_resy = bool(data.get("reservation_url"))
            has_phone = bool(data.get("phone"))
            has_ig = bool(data.get("instagram"))
            has_price = bool(data.get("price_level"))
            n_vibes = len(data.get("vibes", []))

            details = []
            if n_specials: details.append(f"{n_specials} specials")
            if n_hol_hours: details.append(f"{n_hol_hours} holiday hours")
            if n_hol_specials: details.append(f"{n_hol_specials} holiday specials")
            if has_hours: details.append("hours")
            if has_menu: details.append("menu")
            if has_resy: details.append("reservations")
            if has_phone: details.append(f"phone:{data['phone']}")
            if has_ig: details.append(f"ig:@{data['instagram']}")
            if has_price: details.append(f"${'$' * data['price_level']}")
            if n_vibes: details.append(f"{n_vibes} vibes")

            if details:
                logger.info(f"  Found: {', '.join(details)}")
            else:
                logger.info("  No data extracted")
                totals["skipped"] += 1
                continue

            stats = upsert_results(
                venue, data,
                dry_run=args.dry_run,
                skip_specials=args.skip_specials,
                force_update=args.force_update,
            )
            totals["scraped"] += 1
            totals["specials"] += stats["specials_added"]
            totals["holiday_hours"] += stats["holiday_hours_added"]
            totals["holiday_specials"] += stats["holiday_specials_added"]
            if stats["venue_updated"]:
                totals["venues_updated"] += 1

            # Be polite — 1 second between requests
            time.sleep(1)
    finally:
        _close_browser()

    totals["playwright_fallbacks"] = _playwright_fallback_count

    logger.info("=" * 60)
    logger.info(f"Done! Scraped {totals['scraped']} venues")
    logger.info(f"  Specials found: {totals['specials']}")
    logger.info(f"  Holiday hours: {totals['holiday_hours']}")
    logger.info(f"  Holiday specials: {totals['holiday_specials']}")
    logger.info(f"  Venues updated: {totals['venues_updated']}")
    logger.info(f"  Playwright fallbacks: {totals['playwright_fallbacks']}")
    logger.info(f"  Failed/unreachable: {totals['failed']}")
    logger.info(f"  No data extracted: {totals['skipped']}")


if __name__ == "__main__":
    main()
