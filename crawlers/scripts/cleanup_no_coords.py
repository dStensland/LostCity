#!/usr/bin/env python3
"""
Clean up ~657 active venues that have NULL lat/lng coordinates.

4 phases:
  1. Deactivate junk/placeholder venues (unmappable even with an address)
  2. Geocode remaining venues that have addresses via Nominatim
  3. Assign neighborhoods to newly geocoded venues
  4. Print summary report

Usage:
  python cleanup_no_coords.py --dry-run           # Preview all phases
  python cleanup_no_coords.py --phase 1            # Only deactivate junk
  python cleanup_no_coords.py --phase 2 --limit 10 # Test geocoding on 10
  python cleanup_no_coords.py                      # Run all phases
"""

import re
import time
import argparse
import logging
from typing import Optional

from db import get_client
from geocode_venues import geocode_address
from assign_neighborhoods import haversine, find_neighborhood
from cleanup_venue_data import get_venue_event_counts
from classify_venues import should_deactivate

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


# ─── CONSTANTS ─────────────────────────────────────────────────────────────────

# Known city centers — used to detect geocoder fallback to centroid
CITY_CENTERS = {
    "Atlanta":   (33.749, -84.388),
    "Nashville": (36.162, -86.781),
}
CITY_CENTER_THRESHOLD_M = 500  # within 500m = probably a fallback

# Additional junk patterns specific to no-coords venues.
# The existing should_deactivate() covers city-as-venue and generic placeholders;
# these catch Eventbrite privacy stubs and stage markers that slip through.
NO_COORDS_JUNK_PATTERNS = [
    # Eventbrite privacy placeholders
    re.compile(r"this event'?s? address is private", re.IGNORECASE),
    re.compile(r"check the event description", re.IGNORECASE),
    # Stage markers (e.g., "ATL - Main Stage", "South Atlanta - Stage 3")
    re.compile(r"^.{0,30}\bstage\s*\d*$", re.IGNORECASE),
    # Meetup-style generic spaces
    re.compile(r"^meetup\s+space$", re.IGNORECASE),
    re.compile(r"^community\s+location$", re.IGNORECASE),
    # Literal null / placeholder
    re.compile(r"^null$", re.IGNORECASE),
]

# Venue types that indicate a real destination (even without coords)
REAL_VENUE_TYPES = {
    "bar", "restaurant", "music_venue", "nightclub", "comedy_club",
    "gallery", "museum", "brewery", "coffee_shop", "bookstore",
    "library", "arena", "cinema", "park", "garden", "food_hall",
    "farmers_market", "convention_center", "venue", "church",
    "event_space", "sports_bar", "distillery", "winery", "hotel",
    "rooftop", "coworking", "record_store", "studio", "fitness_center",
    "community_center", "college", "university", "organization",
}


# ─── HELPERS ───────────────────────────────────────────────────────────────────

def fetch_no_coord_venues(client) -> list[dict]:
    """Fetch all active venues with NULL lat or lng, paginated."""
    all_venues = []
    offset = 0
    while True:
        result = (
            client.table("venues")
            .select("id,name,slug,address,city,state,venue_type,neighborhood,lat,lng,website")
            .eq("active", True)
            .is_("lat", "null")
            .order("id")
            .range(offset, offset + 999)
            .execute()
        )
        rows = result.data or []
        if not rows:
            break
        all_venues.extend(rows)
        if len(rows) < 1000:
            break
        offset += 1000
    return all_venues


def is_no_coords_junk(venue: dict) -> Optional[str]:
    """
    Check if a no-coords venue is junk that should be deactivated.
    Returns a reason string or None.

    Layers:
      1. Existing should_deactivate() from classify_venues.py
      2. Additional no-coords-specific patterns (Eventbrite stubs, stages)
      3. Null-type venues with 0 events and non-destination names
    """
    # Layer 1: existing junk detection
    reason = should_deactivate(venue)
    if reason:
        return reason

    name = (venue.get("name") or "").strip()

    # Layer 2: no-coords-specific patterns
    for pattern in NO_COORDS_JUNK_PATTERNS:
        if pattern.search(name):
            return f"no-coords junk pattern: {name}"

    return None


def is_city_center_fallback(lat: float, lng: float) -> bool:
    """Check if coords are within 500m of a known city center (geocoder fallback)."""
    for city, (clat, clng) in CITY_CENTERS.items():
        dist = haversine(lat, lng, clat, clng)
        if dist <= CITY_CENTER_THRESHOLD_M:
            return True
    return False


# ─── PHASE 1: DEACTIVATE JUNK ─────────────────────────────────────────────────

def phase1_deactivate_junk(client, venues: list[dict], event_counts: dict,
                           dry_run: bool = False) -> dict:
    """
    Deactivate junk/placeholder venues even if they have events.
    Events persist — they just lose the broken venue link on the map.

    Also deactivates null-type, 0-event venues that are clearly not real
    destinations (festivals, shows, generic names).
    """
    stats = {"deactivated": 0, "skipped_real": 0, "details": []}

    for v in venues:
        vid = v["id"]
        name = v.get("name", "")
        vtype = v.get("venue_type")
        n_events = event_counts.get(vid, 0)

        # Check explicit junk patterns (deactivate even with events)
        reason = is_no_coords_junk(v)

        # If not caught by patterns, check null-type + 0-event venues
        if not reason and not vtype and n_events == 0:
            # Preserve null-type venues that look like real places
            # (have an address and a name that doesn't look like a festival/event)
            if v.get("address") and not _looks_like_event_name(name):
                stats["skipped_real"] += 1
                continue
            reason = f"null type, 0 events: {name}"

        if not reason:
            continue

        stats["details"].append({
            "id": vid, "name": name, "type": vtype,
            "events": n_events, "reason": reason,
        })

        if not dry_run:
            client.table("venues").update({"active": False}).eq("id", vid).execute()

        stats["deactivated"] += 1

    return stats


def _looks_like_event_name(name: str) -> bool:
    """Heuristic: does this venue name look like a festival/event rather than a place?"""
    event_keywords = [
        r"\bfestival\b", r"\bfest\b", r"\bweek\b", r"\bweekend\b",
        r"\bshow\b", r"\btour\b", r"\bconcert\b", r"\bsummit\b",
        r"\bconference\b", r"\bexpo\b", r"\bgala\b", r"\bmarathon\b",
        r"\bcrawl\b", r"\bblock\s*party\b",
    ]
    name_lower = name.lower()
    return any(re.search(kw, name_lower) for kw in event_keywords)


# ─── PHASE 2: GEOCODE ─────────────────────────────────────────────────────────

def phase2_geocode(client, venues: list[dict], dry_run: bool = False,
                   limit: Optional[int] = None) -> dict:
    """
    Geocode active no-coords venues that have an address.
    Skips city-center fallback results.
    """
    stats = {"geocoded": 0, "skipped_no_address": 0, "skipped_city_center": 0,
             "failed": 0, "details": []}

    candidates = [v for v in venues if v.get("address") and v.get("city") and v.get("state")]
    skipped = len(venues) - len(candidates)
    stats["skipped_no_address"] = skipped

    if limit:
        candidates = candidates[:limit]

    total = len(candidates)
    logger.info(f"Geocoding {total} venues (rate limit: 1.1s/request, ~{total * 1.1 / 60:.1f} min)")

    for i, v in enumerate(candidates, 1):
        vid = v["id"]
        name = v.get("name", "")
        address = v["address"]
        city = v["city"]
        state = v["state"]

        if dry_run:
            stats["details"].append({"id": vid, "name": name, "address": address, "action": "would geocode"})
            stats["geocoded"] += 1
            continue

        result = geocode_address(address, city, state)

        if not result:
            stats["failed"] += 1
            logger.warning(f"[{i}/{total}] Failed: {name} — {address}, {city}, {state}")
            time.sleep(1.1)
            continue

        lat, lng = result

        # Guard: skip city-center fallbacks
        if is_city_center_fallback(lat, lng):
            stats["skipped_city_center"] += 1
            logger.info(f"[{i}/{total}] Skipped city-center fallback: {name} -> ({lat}, {lng})")
            time.sleep(1.1)
            continue

        client.table("venues").update({"lat": lat, "lng": lng}).eq("id", vid).execute()
        stats["geocoded"] += 1
        stats["details"].append({"id": vid, "name": name, "lat": lat, "lng": lng})
        logger.info(f"[{i}/{total}] Geocoded: {name} -> ({lat:.4f}, {lng:.4f})")

        time.sleep(1.1)  # Nominatim rate limit

    return stats


# ─── PHASE 3: ASSIGN NEIGHBORHOODS ────────────────────────────────────────────

def phase3_assign_neighborhoods(client, dry_run: bool = False) -> dict:
    """
    Assign neighborhoods to all active venues that have coords but no neighborhood.
    Covers newly geocoded venues plus any historical gaps.
    """
    stats = {"assigned": 0, "no_match": 0, "details": []}

    # Fetch all active venues with coords but no neighborhood (paginated)
    all_venues = []
    offset = 0
    while True:
        result = (
            client.table("venues")
            .select("id,name,lat,lng")
            .eq("active", True)
            .not_.is_("lat", "null")
            .is_("neighborhood", "null")
            .order("id")
            .range(offset, offset + 999)
            .execute()
        )
        rows = result.data or []
        if not rows:
            break
        all_venues.extend(rows)
        if len(rows) < 1000:
            break
        offset += 1000

    logger.info(f"Found {len(all_venues)} venues with coords but no neighborhood")

    for v in all_venues:
        vid = v["id"]
        name = v.get("name", "")
        lat, lng = v["lat"], v["lng"]

        neighborhood = find_neighborhood(lat, lng)
        if not neighborhood:
            stats["no_match"] += 1
            continue

        if not dry_run:
            client.table("venues").update({"neighborhood": neighborhood}).eq("id", vid).execute()

        stats["assigned"] += 1
        stats["details"].append({"id": vid, "name": name, "neighborhood": neighborhood})

    return stats


# ─── PHASE 4: SUMMARY REPORT ──────────────────────────────────────────────────

def phase4_report(client) -> None:
    """Print final accounting of no-coords venues."""
    print("\n" + "=" * 70)
    print("FINAL REPORT: Venues Without Coordinates")
    print("=" * 70)

    # Count remaining no-coords active venues
    remaining = fetch_no_coord_venues(client)
    total = len(remaining)

    # Break down by type
    by_type = {}
    with_address = 0
    without_address = 0
    for v in remaining:
        vtype = v.get("venue_type") or "(null)"
        by_type[vtype] = by_type.get(vtype, 0) + 1
        if v.get("address"):
            with_address += 1
        else:
            without_address += 1

    print(f"\nRemaining active venues with no coords: {total}")
    print(f"  With address (geocoding failed/skipped): {with_address}")
    print(f"  Without address:                         {without_address}")

    if by_type:
        print("\nBreakdown by venue_type:")
        for vtype, count in sorted(by_type.items(), key=lambda x: -x[1]):
            print(f"  {vtype:30s} {count}")

    # Count venues with coords but no neighborhood
    no_hood = []
    offset = 0
    while True:
        result = (
            client.table("venues")
            .select("id", count="exact")
            .eq("active", True)
            .not_.is_("lat", "null")
            .is_("neighborhood", "null")
            .range(offset, offset + 999)
            .execute()
        )
        rows = result.data or []
        if not rows:
            break
        no_hood.extend(rows)
        if len(rows) < 1000:
            break
        offset += 1000

    print(f"\nActive venues with coords but no neighborhood: {len(no_hood)}")

    print("\n── Next Steps ──────────────────────────────────────────")
    if with_address > 0:
        print(f"  • {with_address} venues have addresses — try Google Places geocoding")
    if without_address > 0:
        print(f"  • {without_address} venues lack addresses — manual review or deactivate")
    if len(no_hood) > 0:
        print(f"  • {len(no_hood)} venues need neighborhood assignment (outside known areas)")
    print("=" * 70)


# ─── MAIN ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Clean up venues without coordinates")
    parser.add_argument("--dry-run", action="store_true", help="Preview changes without writing to DB")
    parser.add_argument("--phase", type=int, choices=[1, 2, 3, 4], help="Run only a specific phase")
    parser.add_argument("--limit", type=int, help="Limit geocoding to N venues (phase 2)")
    args = parser.parse_args()

    dry_run = args.dry_run
    run_phase = args.phase

    if dry_run:
        print("🔍 DRY RUN — no changes will be written\n")

    client = get_client()

    # ── Phase 1: Deactivate junk ──────────────────────────────────────────
    if run_phase in (None, 1):
        print("=" * 70)
        print("PHASE 1: Deactivate junk/placeholder venues")
        print("=" * 70)

        venues = fetch_no_coord_venues(client)
        print(f"Found {len(venues)} active venues with no coordinates")

        event_counts = get_venue_event_counts(client)
        stats = phase1_deactivate_junk(client, venues, event_counts, dry_run=dry_run)

        print(f"\n{'Would deactivate' if dry_run else 'Deactivated'}: {stats['deactivated']} venues")
        print(f"Preserved (look like real places): {stats['skipped_real']}")

        if stats["details"]:
            print("\nDetails:")
            for d in stats["details"]:
                evt_str = f" ({d['events']} events)" if d["events"] else ""
                print(f"  [{d['id']}] {d['name']}{evt_str} — {d['reason']}")

        # Refresh venue list for subsequent phases (excluding newly deactivated)
        if not dry_run and stats["deactivated"] > 0:
            venues = fetch_no_coord_venues(client)
        print()

    # ── Phase 2: Geocode ──────────────────────────────────────────────────
    if run_phase in (None, 2):
        print("=" * 70)
        print("PHASE 2: Geocode venues with addresses")
        print("=" * 70)

        venues = fetch_no_coord_venues(client)
        stats = phase2_geocode(client, venues, dry_run=dry_run, limit=args.limit)

        print(f"\n{'Would geocode' if dry_run else 'Geocoded'}: {stats['geocoded']} venues")
        print(f"Skipped (no address/city/state): {stats['skipped_no_address']}")
        print(f"Skipped (city-center fallback):  {stats['skipped_city_center']}")
        print(f"Failed:                          {stats['failed']}")
        print()

    # ── Phase 3: Assign neighborhoods ─────────────────────────────────────
    if run_phase in (None, 3):
        print("=" * 70)
        print("PHASE 3: Assign neighborhoods")
        print("=" * 70)

        stats = phase3_assign_neighborhoods(client, dry_run=dry_run)

        print(f"\n{'Would assign' if dry_run else 'Assigned'}: {stats['assigned']} neighborhoods")
        print(f"No match (outside known areas): {stats['no_match']}")
        print()

    # ── Phase 4: Report ───────────────────────────────────────────────────
    if run_phase in (None, 4):
        phase4_report(client)


if __name__ == "__main__":
    main()
