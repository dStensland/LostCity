#!/usr/bin/env python3
"""
Scrape venue websites and LLM-extract specials, hours, menus, and reservation links.

For each venue with a website:
1. Fetches the main page + common subpages (/menu, /happy-hour, /specials, /hours)
2. LLM-extracts structured data: specials, hours, menu_url, reservation_url
3. Upserts into venue_specials + updates venue columns
4. Tracks last_verified_at for freshness

Usage:
    # Scrape venues in a corridor (lat/lng + radius)
    python3 scrape_venue_specials.py --lat 33.7834 --lng -84.3731 --radius 2

    # Scrape specific venues by ID
    python3 scrape_venue_specials.py --venue-ids 100,200,300

    # Scrape venues by type
    python3 scrape_venue_specials.py --venue-type bar --limit 50

    # Dry run (don't write to DB)
    python3 scrape_venue_specials.py --lat 33.7834 --lng -84.3731 --radius 2 --dry-run
"""

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


EXTRACTION_PROMPT = """You are a venue data extraction system for a nightlife/restaurant guide app.
Given HTML content from a venue's website, extract structured data about their specials, hours, and links.

RULES:
1. Extract ONLY information explicitly stated on the page. Never invent details.
2. For specials: look for happy hours, daily deals, recurring events (trivia, DJ nights, karaoke), brunch deals, wine specials, food specials.
3. For hours: extract operating hours for each day of the week.
4. For menu: find links to their menu page (food menu, drink menu, etc.).
5. For reservations: find links to Resy, OpenTable, SevenRooms, Tock, or any booking system.
6. If information is unclear or not found, use null.
7. Times should be 24-hour format "HH:MM".
8. Days should be lowercase English day names: "monday", "tuesday", etc.
9. special.type must be one of: happy_hour, daily_special, recurring_deal, event_night, brunch, exhibit, seasonal_menu

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
  "description": "A brief one-sentence description of the venue if found."
}

If the page has no useful venue information (e.g., it's a generic homepage with no hours/specials), return:
{"specials": [], "hours": null, "menu_url": null, "reservation_url": null, "description": null}
"""


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Haversine distance in km."""
    R = 6371
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlng/2)**2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def fetch_page(url: str, timeout: int = 10) -> Optional[str]:
    """Fetch a URL and return cleaned text content."""
    try:
        resp = requests.get(url, headers=HEADERS, timeout=timeout, allow_redirects=True)
        if resp.status_code != 200:
            return None
        return resp.text
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
    """Extract meta tags, og:image, and reservation/menu links from HTML."""
    soup = BeautifulSoup(html, "html.parser")
    result = {
        "og_image": None,
        "meta_description": None,
        "reservation_links": [],
        "menu_links": [],
    }

    # og:image
    og_img = soup.find("meta", attrs={"property": "og:image"})
    if og_img and og_img.get("content"):
        result["og_image"] = og_img["content"]

    # Meta description
    meta_desc = soup.find("meta", attrs={"name": "description"})
    if meta_desc and meta_desc.get("content"):
        result["meta_description"] = meta_desc["content"]

    # Scan all links for reservation and menu URLs
    for a in soup.find_all("a", href=True):
        href = a["href"]
        href_lower = href.lower()
        text_lower = (a.get_text(strip=True) or "").lower()

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

    return result


def parse_days(day_names: list) -> list[int]:
    """Convert day name strings to ISO weekday integers."""
    result = []
    for d in day_names:
        d_lower = d.strip().lower()
        if d_lower in DAY_MAP:
            result.append(DAY_MAP[d_lower])
    return sorted(set(result))


def scrape_venue(venue: dict) -> Optional[dict]:
    """Scrape a single venue's website and extract structured data."""
    website = venue.get("website", "")
    if not website:
        return None

    # Normalize URL
    if not website.startswith("http"):
        website = "https://" + website

    # Fetch main page
    main_html = fetch_page(website)
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
        html = fetch_page(url, timeout=5)
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

    # Merge in meta-extracted data
    if not data.get("reservation_url") and meta["reservation_links"]:
        data["reservation_url"] = meta["reservation_links"][0]

    if not data.get("menu_url") and meta["menu_links"]:
        data["menu_url"] = meta["menu_links"][0]

    if not data.get("description") and meta["meta_description"]:
        desc = meta["meta_description"].strip()
        if len(desc) >= 30:
            data["description"] = desc

    data["og_image"] = meta["og_image"]

    return data


def upsert_results(venue: dict, data: dict, dry_run: bool = False) -> dict:
    """Write extracted data to the database."""
    client = get_client()
    venue_id = venue["id"]
    now = datetime.utcnow().isoformat()
    stats = {"specials_added": 0, "venue_updated": False}

    # --- Update venue columns ---
    updates = {"last_verified_at": now}

    if data.get("hours"):
        updates["hours"] = data["hours"]

    if data.get("menu_url") and not venue.get("menu_url"):
        updates["menu_url"] = data["menu_url"]

    if data.get("reservation_url") and not venue.get("reservation_url"):
        updates["reservation_url"] = data["reservation_url"]

    if data.get("description") and not venue.get("description"):
        updates["description"] = data["description"]

    if data.get("og_image") and not venue.get("image_url"):
        updates["image_url"] = data["og_image"]

    if len(updates) > 1:  # More than just last_verified_at
        stats["venue_updated"] = True

    if not dry_run:
        client.table("venues").update(updates).eq("id", venue_id).execute()

    # --- Upsert specials ---
    specials = data.get("specials", [])
    if specials and not dry_run:
        # Delete existing specials for this venue (full replace on scrape)
        client.table("venue_specials").delete().eq("venue_id", venue_id).execute()

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
        .select("id, name, slug, website, venue_type, description, image_url, lat, lng, hours, menu_url, reservation_url")
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
    parser = argparse.ArgumentParser(description="Scrape venue specials from websites via LLM extraction")
    parser.add_argument("--lat", type=float, help="Center latitude for corridor search")
    parser.add_argument("--lng", type=float, help="Center longitude for corridor search")
    parser.add_argument("--radius", type=float, default=2.0, help="Radius in km (default: 2)")
    parser.add_argument("--venue-ids", type=str, help="Comma-separated venue IDs")
    parser.add_argument("--venue-type", type=str, help="Filter by venue type (bar, restaurant, etc.)")
    parser.add_argument("--limit", type=int, default=200, help="Max venues to process")
    parser.add_argument("--dry-run", action="store_true", help="Don't write to database")
    parser.add_argument("--verbose", action="store_true", help="Show LLM extraction details")
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

    logger.info(f"Found {len(venues)} venues to scrape")
    if args.dry_run:
        logger.info("DRY RUN — no database writes")
    logger.info("=" * 60)

    totals = {"scraped": 0, "specials": 0, "venues_updated": 0, "failed": 0, "skipped": 0}

    for i, venue in enumerate(venues, 1):
        name = venue["name"][:45]
        dist_str = ""
        if args.lat and args.lng and venue.get("lat") and venue.get("lng"):
            dist = haversine_km(args.lat, args.lng, float(venue["lat"]), float(venue["lng"]))
            dist_str = f" ({dist:.1f}km)"

        logger.info(f"[{i}/{len(venues)}] {name}{dist_str}")

        data = scrape_venue(venue)
        if not data:
            totals["failed"] += 1
            continue

        n_specials = len(data.get("specials", []))
        has_hours = bool(data.get("hours"))
        has_menu = bool(data.get("menu_url"))
        has_resy = bool(data.get("reservation_url"))

        details = []
        if n_specials: details.append(f"{n_specials} specials")
        if has_hours: details.append("hours")
        if has_menu: details.append("menu")
        if has_resy: details.append("reservations")

        if details:
            logger.info(f"  Found: {', '.join(details)}")
        else:
            logger.info("  No data extracted")
            totals["skipped"] += 1
            continue

        stats = upsert_results(venue, data, dry_run=args.dry_run)
        totals["scraped"] += 1
        totals["specials"] += stats["specials_added"]
        if stats["venue_updated"]:
            totals["venues_updated"] += 1

        # Be polite — 1 second between requests
        time.sleep(1)

    logger.info("=" * 60)
    logger.info(f"Done! Scraped {totals['scraped']} venues")
    logger.info(f"  Specials found: {totals['specials']}")
    logger.info(f"  Venues updated: {totals['venues_updated']}")
    logger.info(f"  Failed/unreachable: {totals['failed']}")
    logger.info(f"  No data extracted: {totals['skipped']}")


if __name__ == "__main__":
    main()
