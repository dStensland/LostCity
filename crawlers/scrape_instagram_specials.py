#!/usr/bin/env python3
"""
Scrape Instagram profiles to extract venue data via LLM.

Many bars post happy hours, trivia nights, daily deals, AND upcoming events on
Instagram rather than their website. This script loads public Instagram profiles
via Playwright, extracts visible post captions, and uses an LLM to identify:

1. Recurring specials → venue_specials table
2. Upcoming events → events table (via insert_event with full enrichment pipeline)
3. Venue enrichment → venues table (vibes, description)

Usage:
    # Dry run a single venue
    python3 scrape_instagram_specials.py --venue-ids 123 --dry-run --verbose

    # Bars with no existing specials
    python3 scrape_instagram_specials.py --venue-type bar --no-specials --limit 20 --dry-run

    # Full run — specials + events
    python3 scrape_instagram_specials.py --venue-type bar --limit 100

    # Specials only (skip event extraction)
    python3 scrape_instagram_specials.py --venue-type bar --specials-only --limit 50
"""

import base64
import json
import logging
import argparse
import re
import sys
import time
from datetime import datetime, date
from pathlib import Path
from typing import Optional

from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright

env_path = Path(__file__).parent.parent / ".env"
from dotenv import load_dotenv
load_dotenv(env_path)

sys.path.insert(0, str(Path(__file__).parent))
from db import get_client, insert_event, find_event_by_hash
from dedupe import generate_content_hash
from llm_client import generate_text, generate_text_with_images

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)

USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

# ISO weekday mapping
DAY_MAP = {
    "monday": 1, "mon": 1,
    "tuesday": 2, "tue": 2, "tues": 2,
    "wednesday": 3, "wed": 3,
    "thursday": 4, "thu": 4, "thur": 4, "thurs": 4,
    "friday": 5, "fri": 5,
    "saturday": 6, "sat": 6,
    "sunday": 7, "sun": 7,
}

# Lines that are Instagram UI boilerplate, not post captions
BOILERPLATE_PATTERNS = [
    "log in", "sign up", "see more on instagram",
    "from @", "follow", "followers", "following",
    "posts", "reels", "tagged",
    "open app", "not now", "cookie",
    "about", "help", "press", "api", "jobs", "privacy", "terms",
    "locations", "instagram lite", "threads", "contact uploading",
    "meta verified", "create new account",
]

# Valid event categories (from our taxonomy)
VALID_CATEGORIES = {
    "music", "comedy", "art", "theater", "film", "food_drink",
    "nightlife", "community", "fitness", "family", "sports", "other",
}

# Shared Playwright browser
_playwright = None
_browser = None

# Instagram source ID — lazily fetched
_ig_source_id = None

# Chrome cookies for authenticated IG access
_ig_cookies = None
_use_chrome_cookies = False


def _load_chrome_cookies() -> list[dict]:
    """Extract Instagram cookies from Chrome via rookiepy."""
    global _ig_cookies
    if _ig_cookies is not None:
        return _ig_cookies

    try:
        import rookiepy
        raw_cookies = rookiepy.chrome(domains=[".instagram.com", "www.instagram.com", "instagram.com"])
        # Convert to Playwright cookie format
        _ig_cookies = []
        for c in raw_cookies:
            cookie = {
                "name": c["name"],
                "value": c["value"],
                "domain": c["domain"],
                "path": c.get("path", "/"),
                "secure": c.get("secure", True),
                "httpOnly": c.get("httpOnly", False),
            }
            if c.get("expires"):
                cookie["expires"] = c["expires"]
            _ig_cookies.append(cookie)

        has_session = any(c["name"] == "sessionid" for c in _ig_cookies)
        logger.info(f"  Loaded {len(_ig_cookies)} Chrome cookies (session={'yes' if has_session else 'NO'})")
        return _ig_cookies
    except Exception as e:
        logger.warning(f"  Failed to load Chrome cookies: {e}")
        _ig_cookies = []
        return []


def _get_browser():
    """Lazily launch a shared headless Chromium."""
    global _playwright, _browser
    if _browser is None:
        _playwright = sync_playwright().start()
        _browser = _playwright.chromium.launch(headless=True)
    return _browser


def _create_ig_context():
    """Create a Playwright browser context, optionally with Chrome cookies."""
    browser = _get_browser()
    context = browser.new_context(
        user_agent=USER_AGENT,
        viewport={"width": 1920, "height": 1080},
        locale="en-US",
    )
    if _use_chrome_cookies:
        cookies = _load_chrome_cookies()
        if cookies:
            context.add_cookies(cookies)
    return context


def _close_browser():
    """Cleanup shared browser at end of run."""
    global _playwright, _browser
    if _browser:
        _browser.close()
        _browser = None
    if _playwright:
        _playwright.stop()
        _playwright = None


def _get_or_create_ig_source() -> int:
    """Get or create a source record for Instagram caption scraping."""
    global _ig_source_id
    if _ig_source_id is not None:
        return _ig_source_id

    client = get_client()

    # Check if it already exists
    result = (
        client.table("sources")
        .select("id")
        .eq("slug", "instagram-captions")
        .execute()
    )
    if result.data:
        _ig_source_id = result.data[0]["id"]
        return _ig_source_id

    # Create it
    row = {
        "name": "Instagram Captions",
        "slug": "instagram-captions",
        "url": "https://instagram.com",
        "integration_method": "playwright",
        "source_type": "social_media",
        "is_active": True,
    }
    result = client.table("sources").insert(row).execute()
    _ig_source_id = result.data[0]["id"]
    logger.info(f"Created 'instagram-captions' source (id={_ig_source_id})")
    return _ig_source_id


def parse_days(day_names: list) -> list[int]:
    """Convert day name strings to ISO weekday integers."""
    result = []
    for d in day_names:
        d_lower = d.strip().lower()
        if d_lower in DAY_MAP:
            result.append(DAY_MAP[d_lower])
    return sorted(set(result))


def fetch_instagram_captions(handle: str) -> Optional[str]:
    """Load an Instagram profile and extract visible post captions."""
    url = f"https://www.instagram.com/{handle}/"
    try:
        context = _create_ig_context()
        try:
            page = context.new_page()
            page.goto(url, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(6000)  # Let IG render
            html = page.content()
        finally:
            context.close()
    except Exception as e:
        logger.info(f"  Playwright failed for @{handle}: {e}")
        return None

    if not html:
        return None

    # Parse visible text, filter boilerplate
    soup = BeautifulSoup(html, "html.parser")

    # Remove script/style/nav
    for tag in soup.find_all(["script", "style", "noscript", "svg"]):
        tag.decompose()

    text = soup.get_text(separator="\n", strip=True)
    lines = text.split("\n")

    # Filter: keep lines > 20 chars that aren't boilerplate
    captions = []
    for line in lines:
        line = line.strip()
        if len(line) < 20:
            continue
        line_lower = line.lower()
        if any(bp in line_lower for bp in BOILERPLATE_PATTERNS):
            continue
        # Skip lines that are just numbers (follower counts, etc)
        if line.replace(",", "").replace(".", "").replace(" ", "").isdigit():
            continue
        captions.append(line)

    if not captions:
        return None

    # Join and truncate for LLM context
    return "\n\n".join(captions)[:15000]


def fetch_instagram_images(handle: str) -> list[str]:
    """Load an Instagram profile and extract grid post images as base64 data URIs.

    Returns base64 data URIs because IG CDN URLs are authenticated and can't
    be fetched by external services like OpenAI.
    """
    url = f"https://www.instagram.com/{handle}/"
    try:
        context = _create_ig_context()
        try:
            page = context.new_page()
            page.goto(url, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(6000)  # Let IG render

            # Extract image URLs and download them in-browser (has cookies)
            image_data = page.evaluate("""() => {
                const imgs = document.querySelectorAll('img');
                const results = [];
                for (const img of imgs) {
                    const src = img.src || '';
                    const alt = (img.alt || '').toLowerCase();
                    const isCdn = (src.includes('cdninstagram.com') && src.includes('/v/'))
                        || (src.includes('fbcdn.net') && src.includes('/v/'))
                        || (src.includes('scontent') && src.includes('instagram'));
                    const isProfile = alt.includes('profile picture');
                    if (isCdn && !isProfile) {
                        results.push(src);
                    }
                }
                return results.slice(0, 9);
            }""")

            if not image_data:
                return []

            # Download each image via fetch() inside the page context (uses IG cookies)
            data_uris = []
            for img_url in image_data[:9]:
                try:
                    b64 = page.evaluate("""async (url) => {
                        try {
                            const resp = await fetch(url);
                            if (!resp.ok) return null;
                            const blob = await resp.blob();
                            return new Promise((resolve) => {
                                const reader = new FileReader();
                                reader.onloadend = () => resolve(reader.result);
                                reader.readAsDataURL(blob);
                            });
                        } catch { return null; }
                    }""", img_url)
                    if b64 and b64.startswith("data:"):
                        data_uris.append(b64)
                except Exception:
                    continue

            return data_uris
        finally:
            context.close()
    except Exception as e:
        logger.info(f"  Playwright failed for @{handle}: {e}")
        return []


VISION_EXTRACTION_PROMPT = """You are a venue data extraction system. You are looking at recent Instagram post images from a venue — these may include flyers, posters, menus, and promotional graphics.

Extract THREE types of data from what you see:

## 1. RECURRING SPECIALS
Weekly/daily deals visible in the images.
Examples: happy hours, daily drink/food deals, trivia nights, wing nights, karaoke, DJ nights, brunch deals, game day specials.
- special.type must be one of: happy_hour, daily_special, recurring_deal, event_night, brunch

## 2. UPCOMING EVENTS
One-off or specific-date happenings shown in the images (concert flyers, event posters, etc).
- Must have a specific date or enough context to infer one (use today's date {today} to calculate)
- event.category must be one of: music, comedy, art, theater, film, food_drink, nightlife, community, fitness, family, sports, other
- Include ticket price if visible
- Do NOT create events for things that are clearly recurring specials

## 3. VENUE VIBES (optional)
If the images reveal the venue's character, list applicable vibes.
Valid vibes: dog-friendly, patio, rooftop, outdoor-seating, craft-cocktails, live-music, divey, upscale, casual, intimate, date-spot, late-night, good-for-groups, family-friendly, lgbtq-friendly

## RULES
- Extract ONLY information clearly visible in the images. Never invent.
- Times in 24-hour format "HH:MM". Days as lowercase English day names.
- Dates in "YYYY-MM-DD" format. Today is {today}.
- If text in an image is too blurry or unclear, skip it.

Return valid JSON only, no markdown formatting:

{{
  "specials": [
    {{
      "title": "Half-Price Wine Wednesday",
      "type": "daily_special",
      "description": "50% off all bottles of wine every Wednesday",
      "days": ["wednesday"],
      "time_start": "17:00",
      "time_end": "21:00",
      "price_note": "50% off bottles"
    }}
  ],
  "events": [
    {{
      "title": "DJ So-and-So Live Set",
      "date": "2026-02-20",
      "start_time": "22:00",
      "category": "nightlife",
      "description": "Guest DJ spinning house and techno all night",
      "price_note": "$10 cover",
      "is_free": false
    }}
  ],
  "vibes": ["late-night", "lgbtq-friendly"]
}}

If nothing found: {{"specials": [], "events": [], "vibes": []}}
"""


EXTRACTION_PROMPT = """You are a venue data extraction system. You are given text extracted from a bar/restaurant's Instagram profile — these are their recent post captions.

Extract THREE types of data:

## 1. RECURRING SPECIALS
Weekly/daily deals that happen on a regular schedule.
Examples: happy hours, daily drink/food deals, trivia nights, wing nights, karaoke, DJ nights, brunch deals, game day specials, ladies nights, industry nights.
- Parse days/times from natural language ("every Wednesday", "Mon-Fri 4-7")
- special.type must be one of: happy_hour, daily_special, recurring_deal, event_night, brunch

## 2. UPCOMING EVENTS
One-off or specific-date happenings announced in the captions.
Examples: live music shows, comedy nights with a specific performer, themed parties, watch parties, album release events, guest DJ sets, holiday parties, pop-ups, ticketed events.
- Must have a specific date or enough context to infer one (e.g., "this Saturday" — use today's date {today} to calculate)
- event.category must be one of: music, comedy, art, theater, film, food_drink, nightlife, community, fitness, family, sports, other
- Include ticket price if mentioned
- Do NOT create events for things that are clearly recurring specials (those go in specials)

## 3. VENUE VIBES (optional)
If the captions reveal the venue's character, list applicable vibes.
Valid vibes: dog-friendly, patio, rooftop, outdoor-seating, craft-cocktails, live-music, divey, upscale, casual, intimate, date-spot, late-night, good-for-groups, family-friendly, lgbtq-friendly

## RULES
- Extract ONLY information clearly stated in the captions. Never invent.
- Times in 24-hour format "HH:MM". Days as lowercase English day names.
- Dates in "YYYY-MM-DD" format. Today is {today}.
- Ignore hiring posts, general announcements, shoutouts, and promo that doesn't describe a specific event or recurring deal.
- If a post is ambiguous between a recurring special and a one-off event, prefer event (we can always find it).

Return valid JSON only, no markdown formatting:

{{
  "specials": [
    {{
      "title": "Half-Price Wine Wednesday",
      "type": "daily_special",
      "description": "50% off all bottles of wine every Wednesday",
      "days": ["wednesday"],
      "time_start": "17:00",
      "time_end": "21:00",
      "price_note": "50% off bottles"
    }}
  ],
  "events": [
    {{
      "title": "DJ So-and-So Live Set",
      "date": "2026-02-20",
      "start_time": "22:00",
      "category": "nightlife",
      "description": "Guest DJ spinning house and techno all night",
      "price_note": "$10 cover",
      "is_free": false
    }}
  ],
  "vibes": ["late-night", "lgbtq-friendly"]
}}

If nothing found: {{"specials": [], "events": [], "vibes": []}}
"""


def extract_from_captions(captions: str, venue_name: str) -> Optional[dict]:
    """Send captions to LLM and parse the full extraction."""
    today = date.today().isoformat()
    prompt = EXTRACTION_PROMPT.replace("{today}", today)
    user_msg = f"Venue: {venue_name}\n\nInstagram captions:\n\n{captions}"

    try:
        raw = generate_text(prompt, user_msg)

        # Strip markdown code fences if present
        raw = raw.strip()
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[1] if "\n" in raw else raw[3:]
        if raw.endswith("```"):
            raw = raw[:-3]
        raw = raw.strip()

        return json.loads(raw)
    except (json.JSONDecodeError, Exception) as e:
        logger.info(f"  LLM extraction failed: {e}")
        return None


def extract_from_images(image_urls: list[str], venue_name: str) -> Optional[dict]:
    """Send Instagram post images to vision LLM and parse the full extraction."""
    today = date.today().isoformat()
    prompt = VISION_EXTRACTION_PROMPT.replace("{today}", today)
    user_msg = f"Venue: {venue_name}\n\nThese are recent Instagram post images from this venue. Extract any specials, events, and vibes you can see."

    try:
        raw = generate_text_with_images(prompt, user_msg, image_urls)

        # Strip markdown code fences if present
        raw = raw.strip()
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[1] if "\n" in raw else raw[3:]
        if raw.endswith("```"):
            raw = raw[:-3]
        raw = raw.strip()

        return json.loads(raw)
    except (json.JSONDecodeError, Exception) as e:
        logger.info(f"  Vision LLM extraction failed: {e}")
        return None


def upsert_specials(
    venue_id: int,
    handle: str,
    specials: list,
    dry_run: bool = False,
) -> int:
    """Write extracted specials to venue_specials table. Returns count written."""
    if not specials:
        return 0

    client = get_client()
    now = datetime.utcnow().isoformat()
    source_url = f"https://instagram.com/{handle}"

    if not dry_run:
        # Delete existing Instagram-sourced specials for this venue (idempotent re-runs)
        client.table("venue_specials").delete().eq(
            "venue_id", venue_id
        ).like("source_url", "%instagram.com%").execute()

    count = 0
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
            "confidence": "low",
            "source_url": source_url,
            "last_verified_at": now,
            "is_active": True,
        }

        if not dry_run:
            client.table("venue_specials").insert(row).execute()

        count += 1

    return count


def insert_events(
    venue: dict,
    handle: str,
    events: list,
    dry_run: bool = False,
) -> int:
    """Insert extracted events via the standard pipeline. Returns count inserted."""
    if not events:
        return 0

    source_id = None if dry_run else _get_or_create_ig_source()
    source_url = f"https://instagram.com/{handle}"
    today = date.today().isoformat()
    count = 0

    for ev in events:
        title = ev.get("title", "").strip()
        ev_date = ev.get("date", "")

        if not title or not ev_date:
            continue

        # Skip past events
        if ev_date < today:
            logger.debug(f"  Skipping past event: {title} ({ev_date})")
            continue

        # Validate category
        category = ev.get("category", "other")
        if category not in VALID_CATEGORIES:
            category = "other"

        # Dedup check
        content_hash = generate_content_hash(title, venue["name"], ev_date)
        existing = find_event_by_hash(content_hash)
        if existing:
            logger.debug(f"  Duplicate: {title} ({ev_date})")
            continue

        event_data = {
            "title": title,
            "start_date": ev_date,
            "start_time": ev.get("start_time"),
            "venue_id": venue["id"],
            "source_id": source_id or 0,
            "source_url": source_url,
            "category": category,
            "description": ev.get("description"),
            "content_hash": content_hash,
            "is_free": ev.get("is_free"),
        }

        # Parse price if present
        price_note = ev.get("price_note", "")
        if price_note:
            price_match = re.search(r"\$(\d+)", price_note)
            if price_match:
                event_data["price_min"] = float(price_match.group(1))

        if dry_run:
            count += 1
            continue

        try:
            insert_event(event_data)
            count += 1
        except (ValueError, Exception) as e:
            logger.debug(f"  Event insert failed: {e}")

    return count


def update_venue_vibes(
    venue_id: int,
    new_vibes: list,
    dry_run: bool = False,
) -> bool:
    """Merge new vibes into venue's existing vibes. Returns True if updated."""
    if not new_vibes:
        return False

    valid_vibes = {
        "dog-friendly", "patio", "rooftop", "outdoor-seating",
        "craft-cocktails", "live-music", "divey", "upscale", "casual",
        "intimate", "date-spot", "late-night", "good-for-groups",
        "family-friendly", "lgbtq-friendly",
    }
    new_vibes = [v for v in new_vibes if v in valid_vibes]
    if not new_vibes:
        return False

    client = get_client()
    result = client.table("venues").select("vibes").eq("id", venue_id).execute()
    existing = (result.data[0].get("vibes") or []) if result.data else []
    merged = sorted(set(existing) | set(new_vibes))

    if set(merged) == set(existing):
        return False

    if not dry_run:
        client.table("venues").update({"vibes": merged}).eq("id", venue_id).execute()

    return True


def get_venues_with_instagram(
    venue_ids: Optional[list[int]] = None,
    venue_type: Optional[str] = None,
    no_specials: bool = False,
    limit: int = 100,
) -> list[dict]:
    """Fetch venues that have an Instagram handle."""
    client = get_client()

    query = (
        client.table("venues")
        .select("id, name, slug, instagram, venue_type, website")
        .neq("active", False)
        .not_.is_("instagram", "null")
    )

    if venue_ids:
        query = query.in_("id", venue_ids)
    elif venue_type:
        query = query.eq("venue_type", venue_type)

    result = query.order("name").limit(5000).execute()
    venues = result.data or []

    if no_specials:
        # Filter to only venues with zero active specials
        venue_ids_with_specials = set()
        specials_result = (
            client.table("venue_specials")
            .select("venue_id")
            .eq("is_active", True)
            .execute()
        )
        for row in specials_result.data or []:
            venue_ids_with_specials.add(row["venue_id"])

        venues = [v for v in venues if v["id"] not in venue_ids_with_specials]

    return venues[:limit]


def main():
    parser = argparse.ArgumentParser(
        description="Scrape Instagram profiles — extract specials, events, and venue vibes"
    )
    parser.add_argument("--venue-ids", type=str, help="Comma-separated venue IDs")
    parser.add_argument("--venue-type", type=str, help="Filter by venue type (bar, restaurant, brewery)")
    parser.add_argument("--no-specials", action="store_true", help="Only venues with zero existing specials")
    parser.add_argument("--limit", type=int, default=100, help="Max venues to process (default: 100)")
    parser.add_argument("--dry-run", action="store_true", help="Don't write to database")
    parser.add_argument("--verbose", action="store_true", help="Show extracted captions")
    parser.add_argument("--specials-only", action="store_true", help="Only extract specials (skip events)")
    parser.add_argument("--vision", action="store_true", help="Use vision LLM to read post images instead of text captions")
    parser.add_argument("--chrome-cookies", action="store_true", help="Use Chrome Instagram cookies for authenticated access")
    args = parser.parse_args()

    if args.verbose:
        logger.setLevel(logging.DEBUG)

    # Enable Chrome cookie injection
    global _use_chrome_cookies
    if args.chrome_cookies:
        _use_chrome_cookies = True
        logger.info("Using Chrome cookies for Instagram authentication")

    # Parse venue IDs
    venue_ids = None
    if args.venue_ids:
        venue_ids = [int(x.strip()) for x in args.venue_ids.split(",") if x.strip()]

    venues = get_venues_with_instagram(
        venue_ids=venue_ids,
        venue_type=args.venue_type,
        no_specials=args.no_specials,
        limit=args.limit,
    )

    logger.info(f"Found {len(venues)} venues with Instagram handles")
    if args.dry_run:
        logger.info("DRY RUN — no database writes")
    if args.no_specials:
        logger.info("FILTER — only venues with zero existing specials")
    if args.specials_only:
        logger.info("MODE — specials only (skipping events)")
    if args.vision:
        logger.info("MODE — vision (reading post images via GPT-4o)")
    logger.info("=" * 60)

    totals = {
        "scraped": 0, "specials": 0, "events": 0,
        "vibes_updated": 0, "no_captions": 0,
        "nothing_found": 0, "failed": 0,
    }

    try:
        for i, venue in enumerate(venues, 1):
            name = venue["name"][:45]
            handle = venue["instagram"]
            logger.info(f"[{i}/{len(venues)}] {name} (@{handle})")

            # Fetch data from Instagram — vision (images) or text (captions)
            if args.vision:
                images = fetch_instagram_images(handle)
                if not images:
                    logger.info("  No images extracted")
                    totals["no_captions"] += 1
                    time.sleep(3)
                    continue
                if args.verbose:
                    logger.debug(f"  Found {len(images)} images")
                data = extract_from_images(images, venue["name"])
            else:
                captions = fetch_instagram_captions(handle)
                if not captions:
                    logger.info("  No captions extracted")
                    totals["no_captions"] += 1
                    time.sleep(3)
                    continue
                if args.verbose:
                    preview = captions[:500].replace("\n", " | ")
                    logger.debug(f"  Captions: {preview}...")
                data = extract_from_captions(captions, venue["name"])

            # LLM extraction result
            if data is None:
                totals["failed"] += 1
                time.sleep(3)
                continue

            specials = data.get("specials", [])
            events = data.get("events", [])
            vibes = data.get("vibes", [])

            if not specials and not events and not vibes:
                logger.info("  Nothing actionable found in posts")
                totals["nothing_found"] += 1
                time.sleep(3)
                continue

            # Report and write specials
            if specials:
                for s in specials:
                    days_str = ", ".join(s.get("days") or ["any day"])
                    logger.info(f"  [special] {s.get('title', '?')} ({days_str})")
                count = upsert_specials(
                    venue["id"], handle, specials, dry_run=args.dry_run
                )
                totals["specials"] += count

            # Report and write events
            if events and not args.specials_only:
                for ev in events:
                    logger.info(f"  [event] {ev.get('title', '?')} ({ev.get('date', '?')})")
                count = insert_events(
                    venue, handle, events, dry_run=args.dry_run
                )
                totals["events"] += count

            # Update vibes
            if vibes:
                logger.info(f"  [vibes] {', '.join(vibes)}")
                if update_venue_vibes(venue["id"], vibes, dry_run=args.dry_run):
                    totals["vibes_updated"] += 1

            totals["scraped"] += 1

            # Rate limit — Instagram is aggressive about bots
            time.sleep(3)

    finally:
        _close_browser()

    logger.info("=" * 60)
    logger.info(f"Done! Processed {totals['scraped']} venues")
    logger.info(f"  Specials extracted: {totals['specials']}")
    logger.info(f"  Events extracted:   {totals['events']}")
    logger.info(f"  Vibes updated:      {totals['vibes_updated']}")
    logger.info(f"  No captions found:  {totals['no_captions']}")
    logger.info(f"  Nothing actionable: {totals['nothing_found']}")
    logger.info(f"  LLM failures:       {totals['failed']}")


if __name__ == "__main__":
    main()
