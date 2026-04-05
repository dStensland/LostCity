"""
Discovery script: Mine Atlanta Parent's Tribe Events API for family venue leads.

Atlanta Parent is a curator/aggregator — we DON'T crawl them as a source.
Instead, we use their event calendar to discover venues we should build
dedicated crawlers for.

Usage:
    python scripts/discover_family_venues_from_ap.py [--check-existing]

    --check-existing    Cross-reference against our sources table to show
                        which venues we already cover vs. new leads.

Output: A report of unique venues from Atlanta Parent's calendar, grouped by
category, with event counts and whether we already have a crawler for them.
"""

from __future__ import annotations

import argparse
import logging
import re
import time
from collections import Counter
from datetime import date
from html import unescape
from typing import Optional

import requests

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# API
# ---------------------------------------------------------------------------

API_URL = "https://www.atlantaparent.com/wp-json/tribe/events/v1/events"
EVENTS_PER_PAGE = 50
_PAGE_DELAY = 0.5

_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/122.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json",
}

# Atlanta metro cities — used for GA inference
_KNOWN_METRO_CITIES: frozenset[str] = frozenset({
    "atlanta", "marietta", "alpharetta", "sandy springs", "roswell",
    "decatur", "smyrna", "norcross", "dunwoody", "tucker", "brookhaven",
    "johns creek", "milton", "peachtree city", "kennesaw", "acworth",
    "woodstock", "canton", "cumming", "duluth", "suwanee", "buford",
    "lawrenceville", "snellville", "lilburn", "stone mountain",
    "conyers", "covington", "mcdonough", "stockbridge", "fayetteville",
    "newnan", "douglasville", "powder springs", "doraville", "chamblee",
    "clarkston", "avondale estates", "east point", "college park",
    "hapeville", "forest park", "riverdale", "jonesboro", "morrow",
})

_NON_GA_CITIES: frozenset[str] = frozenset({
    "nashville", "birmingham", "charlotte", "orlando", "tampa",
    "miami", "jacksonville", "memphis", "knoxville", "chattanooga",
})


def _is_metro_ga(city: str, state: Optional[str]) -> bool:
    if not city:
        return False
    city_lower = city.lower().strip()
    if state and state.strip().upper() not in ("GA", ""):
        return False
    if city_lower in _NON_GA_CITIES:
        return False
    if city_lower in _KNOWN_METRO_CITIES:
        return True
    if state and state.strip().upper() == "GA":
        return True
    return True  # AP is GA-focused, assume GA for unknowns


def _strip_html(html_text: str) -> str:
    text = re.sub(r"<[^>]+>", " ", html_text)
    text = unescape(text)
    return re.sub(r"\s+", " ", text).strip()


def _slugify(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


# ---------------------------------------------------------------------------
# Fetch all events
# ---------------------------------------------------------------------------

def fetch_all_events() -> list[dict]:
    """Fetch all upcoming events from AP's Tribe API."""
    session = requests.Session()
    session.headers.update(_HEADERS)

    all_events = []
    page = 1
    total_pages = 1
    start_date = date.today().strftime("%Y-%m-%d")

    while page <= total_pages:
        try:
            resp = session.get(API_URL, params={
                "per_page": EVENTS_PER_PAGE,
                "page": page,
                "status": "publish",
                "start_date": start_date,
            }, timeout=30)
            resp.raise_for_status()
            data = resp.json()
        except Exception as exc:
            logger.error(f"API page {page} failed: {exc}")
            break

        total_pages = data.get("total_pages", 1)
        events = data.get("events") or []
        if not events:
            break

        all_events.extend(events)
        logger.info(f"  Page {page}/{total_pages}: {len(events)} events")

        page += 1
        if page <= total_pages:
            time.sleep(_PAGE_DELAY)

    return all_events


# ---------------------------------------------------------------------------
# Extract venue leads
# ---------------------------------------------------------------------------

def extract_venue_leads(events: list[dict]) -> dict[str, dict]:
    """
    Extract unique venue records from AP events.

    Returns dict keyed by venue slug with:
      name, city, address, website, event_count, sample_events, categories
    """
    venues: dict[str, dict] = {}

    for event in events:
        tribe_venue = event.get("venue") or {}
        if not isinstance(tribe_venue, dict):
            continue

        name = (tribe_venue.get("venue") or "").strip()
        if not name:
            continue

        city = (tribe_venue.get("city") or "").strip()
        state = (tribe_venue.get("stateprovince") or tribe_venue.get("state") or "").strip()

        if not _is_metro_ga(city, state or None):
            continue

        slug = tribe_venue.get("slug") or _slugify(name)

        if slug not in venues:
            venues[slug] = {
                "name": name,
                "slug": slug,
                "city": city or "Atlanta",
                "address": (tribe_venue.get("address") or "").strip(),
                "website": tribe_venue.get("url") or None,
                "lat": tribe_venue.get("geo_lat"),
                "lng": tribe_venue.get("geo_lng"),
                "event_count": 0,
                "sample_events": [],
                "categories": Counter(),
            }

        v = venues[slug]
        v["event_count"] += 1

        title = unescape((event.get("title") or "").strip())
        if title and len(v["sample_events"]) < 3:
            v["sample_events"].append(title)

        # Rough category from title keywords
        title_lower = title.lower()
        if any(w in title_lower for w in ("camp", "summer camp", "spring camp")):
            v["categories"]["camp"] += 1
        elif any(w in title_lower for w in ("class", "workshop", "lesson")):
            v["categories"]["classes"] += 1
        elif any(w in title_lower for w in ("festival", "fair", "carnival")):
            v["categories"]["festival"] += 1
        elif any(w in title_lower for w in ("show", "performance", "theater", "theatre")):
            v["categories"]["performance"] += 1
        else:
            v["categories"]["event"] += 1

    return venues


# ---------------------------------------------------------------------------
# Cross-reference with existing sources
# ---------------------------------------------------------------------------

def check_existing_sources(venues: dict[str, dict]) -> dict[str, Optional[str]]:
    """
    Check which venue leads we already have crawlers for.

    Returns dict: venue_slug -> existing source slug or None.
    """
    try:
        import sys
        sys.path.insert(0, ".")
        from config import get_supabase_client
        supabase = get_supabase_client()

        # Get all active source names/slugs
        resp = supabase.table("sources").select("id,slug,name").execute()
        sources = resp.data or []

        # Build lookup sets
        source_slugs = {s["slug"] for s in sources}
        source_names = {s["name"].lower(): s["slug"] for s in sources}

        matches: dict[str, Optional[str]] = {}

        for slug, v in venues.items():
            name_lower = v["name"].lower()
            venue_slug = _slugify(v["name"])

            # Direct slug match
            if venue_slug in source_slugs:
                matches[slug] = venue_slug
            # Name substring match
            elif name_lower in source_names:
                matches[slug] = source_names[name_lower]
            else:
                # Fuzzy: check if any source name is contained in venue name or vice versa
                found = None
                for sname, sslug in source_names.items():
                    if len(sname) > 4 and (sname in name_lower or name_lower in sname):
                        found = sslug
                        break
                matches[slug] = found

        return matches

    except Exception as exc:
        logger.warning(f"Could not check existing sources: {exc}")
        return {}


# ---------------------------------------------------------------------------
# Report
# ---------------------------------------------------------------------------

def print_report(venues: dict[str, dict], existing: dict[str, Optional[str]]):
    total = len(venues)
    covered = sum(1 for v in existing.values() if v is not None)
    new_leads = total - covered

    print(f"\n{'='*70}")
    print("ATLANTA PARENT VENUE DISCOVERY REPORT")
    print(f"{'='*70}")
    print(f"Total unique venues: {total}")
    print(f"Already covered:     {covered}")
    print(f"New leads:           {new_leads}")
    print()

    # Sort by event count descending
    sorted_venues = sorted(venues.values(), key=lambda v: v["event_count"], reverse=True)

    # New leads (not yet covered)
    new_venues = [v for v in sorted_venues if existing.get(v["slug"]) is None]
    if new_venues:
        print("\n--- NEW VENUE LEADS (build crawlers for these) ---\n")
        print(f"{'Venue':<40} {'City':<20} {'Events':>6}  {'Top Categories'}")
        print(f"{'-'*40} {'-'*20} {'-'*6}  {'-'*30}")
        for v in new_venues[:50]:
            cats = ", ".join(f"{k}({n})" for k, n in v["categories"].most_common(3))
            print(f"{v['name'][:39]:<40} {v['city'][:19]:<20} {v['event_count']:>6}  {cats}")
            if v["website"]:
                print(f"  {'→ ' + v['website']}")
            if v["sample_events"]:
                for s in v["sample_events"][:2]:
                    print(f"    • {s[:70]}")
            print()

    # Already covered
    covered_venues = [v for v in sorted_venues if existing.get(v["slug"]) is not None]
    if covered_venues:
        print(f"\n--- ALREADY COVERED ({len(covered_venues)} venues) ---\n")
        for v in covered_venues[:20]:
            src = existing[v["slug"]]
            print(f"  ✓ {v['name'][:40]:<40} → source: {src}  ({v['event_count']} AP events)")


def main():
    parser = argparse.ArgumentParser(description="Discover family venues from Atlanta Parent")
    parser.add_argument("--check-existing", action="store_true",
                        help="Cross-reference against our sources table")
    args = parser.parse_args()

    print("Fetching events from Atlanta Parent API...")
    events = fetch_all_events()
    print(f"Total events fetched: {len(events)}")

    venues = extract_venue_leads(events)
    print(f"Unique venues extracted: {len(venues)}")

    existing: dict[str, Optional[str]] = {}
    if args.check_existing:
        print("Cross-referencing with existing sources...")
        existing = check_existing_sources(venues)
    else:
        # Without DB check, all are "new"
        existing = {slug: None for slug in venues}

    print_report(venues, existing)


if __name__ == "__main__":
    main()
