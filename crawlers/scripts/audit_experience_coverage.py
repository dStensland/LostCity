#!/usr/bin/env python3
"""
One-time audit: cross-reference Atlanta experience venues against editorial
"things to do" lists. Identifies venues we're missing and venue_type mismatches.

Usage:
    python3 scripts/audit_experience_coverage.py

Not a crawler — run once, review output, add missing venues manually.
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from db import get_client

# Canonical experience venues compiled from:
# - Discover Atlanta "50 Fun Things to Do"
# - Unexpected Atlanta "35+ Best Things to Do"
# - US News Travel Atlanta Guide
# - TripAdvisor top attractions
# - Search results for "things to do in Atlanta 2026"
#
# Organized by experience category.
EDITORIAL_VENUES = {
    "outdoors": [
        "Piedmont Park",
        "Atlanta Botanical Garden",
        "Atlanta BeltLine",
        "Chattahoochee River National Recreation Area",
        "Kennesaw Mountain National Battlefield Park",
        "Stone Mountain Park",
        "Arabia Mountain",
        "Panola Mountain State Park",
        "Cascade Springs Nature Preserve",
        "Constitution Lakes Park",
        "East Palisades Trail",
        "Silver Comet Trail",
        "Tanyard Creek Trail",
        "Sope Creek Trail",
        "Freedom Park",
        "Grant Park",
        "Mason Mill Park",
        "Fernbank Forest",
        "Cochran Shoals",
        "Sweetwater Creek State Park",
    ],
    "culture": [
        "Georgia Aquarium",
        "World of Coca-Cola",
        "High Museum of Art",
        "Atlanta History Center",
        "Fernbank Museum of Natural History",
        "National Center for Civil and Human Rights",
        "Center for Puppetry Arts",
        "Children's Museum of Atlanta",
        "College Football Hall of Fame",
        "The King Center",
        "Martin Luther King Jr. National Historical Park",
        "Margaret Mitchell House",
        "Jimmy Carter Presidential Library",
        "Atlanta Contemporary",
        "Museum of Design Atlanta (MODA)",
        "Hammonds House Museum",
        "Michael C. Carlos Museum",
        "Wren's Nest House Museum",
        "The Cyclorama",
        "Oakland Cemetery",
        "Westview Cemetery",
        "Trap Music Museum",
        "The Oddities Museum",
        "Waffle House Museum",
        "Illuminarium Atlanta",
        "Atlanta Pinball Museum",
        "Ebenezer Baptist Church",
        "Swan House",
        "Krog Street Tunnel",
        "Centennial Olympic Park",
        "SkyView Atlanta",
        "Monastery of the Holy Spirit",
    ],
    "recreation": [
        "Six Flags Over Georgia",
        "Zoo Atlanta",
        "Topgolf Midtown",
        "Topgolf Alpharetta",
        "Porsche Experience Center",
        "LEGO Discovery Center Atlanta",
        "Medieval Times",
        "Skyline Park",
        "Puttshack Atlanta",
        "Painted Pin",
        "The Painted Duck",
        "Painted Pickle",
        "Your 3rd Spot",
        "Sandbox VR Atlanta",
        "The Escape Game Atlanta",
        "Paranoia Quest Escape Room",
        "Breakout Games Atlanta",
        "Bowlero Atlanta",
        "Round1 North Point",
        "Dave & Busters",
        "Main Event",
        "Stars and Strikes",
        "Monster Mini Golf Marietta",
        "Andretti Indoor Karting",
        "Sky Zone Atlanta",
        "Urban Air Atlanta",
        "Fowling Warehouse Atlanta",
        "Activate Games Atlanta",
        "Stone Summit Climbing",
        "Challenge Aerial",
        "Defy Atlanta",
    ],
    "food": [
        "Ponce City Market",
        "Krog Street Market",
        "Sweet Auburn Curb Market",
        "Politan Row",
        "The Battery Atlanta",
    ],
}


def normalize(name: str) -> str:
    return name.lower().strip().replace("'", "'").replace("\u2019", "'")


def find_match(name, venues):
    """Fuzzy match: containment both ways, then keyword overlap."""
    nl = normalize(name)

    # Exact containment
    for v in venues:
        vn = normalize(v["name"])
        if nl in vn or vn in nl:
            return v

    # Keyword overlap (all 3+ char words must appear)
    words = [w for w in nl.split() if len(w) > 2]
    if len(words) >= 2:
        for v in venues:
            vn = normalize(v["name"])
            if all(w in vn for w in words):
                return v

    return None


EXPERIENCE_VENUE_TYPES = {
    "park", "trail", "garden", "zoo", "aquarium",
    "landmark", "public_art", "viewpoint", "historic_site", "skyscraper",
    "museum", "gallery",
    "attraction", "arcade", "eatertainment", "bowling", "pool_hall",
    "entertainment",
    "farmers_market", "food_hall",
}

SUGGESTED_TYPES = {
    "outdoors": "park",
    "culture": "museum",
    "recreation": "entertainment",
    "food": "food_hall",
}


def main():
    client = get_client()

    # Fetch all active venues
    result = client.table("places").select(
        "id, name, venue_type, city, neighborhood, active"
    ).eq("is_active", True).execute()
    all_venues = result.data or []

    total_missing = 0
    total_mistyped = 0
    total_found = 0

    for category, names in EDITORIAL_VENUES.items():
        missing = []
        mistyped = []
        found = []

        for name in names:
            match = find_match(name, all_venues)
            if match:
                vt = match["venue_type"] or ""
                is_exp = vt in EXPERIENCE_VENUE_TYPES
                if is_exp:
                    found.append((name, match))
                else:
                    mistyped.append((name, match))
            else:
                missing.append(name)

        print(f"\n{'='*60}")
        print(f"  {category.upper()} ({len(found)} ok, {len(mistyped)} mistyped, {len(missing)} missing)")
        print(f"{'='*60}")

        if mistyped:
            print(f"\n  Venue type mismatch (won't appear as experience):")
            for name, v in mistyped:
                print(f"    [{v['id']:>5}] {v['venue_type']:<20} {v['name']}")
                print(f"           → should be: {SUGGESTED_TYPES[category]}")

        if missing:
            print(f"\n  Not in DB — add as venue_type={SUGGESTED_TYPES[category]}:")
            for name in missing:
                print(f"    • {name}")

        if found:
            print(f"\n  Covered:")
            for name, v in found:
                print(f"    ✓ {v['venue_type']:<20} {v['name']}")

        total_missing += len(missing)
        total_mistyped += len(mistyped)
        total_found += len(found)

    print(f"\n{'='*60}")
    print(f"  SUMMARY")
    print(f"{'='*60}")
    print(f"  Found & correctly typed:  {total_found}")
    print(f"  Found but wrong type:     {total_mistyped}")
    print(f"  Missing from DB:          {total_missing}")
    print(f"  Total editorial venues:   {total_found + total_mistyped + total_missing}")
    print()


if __name__ == "__main__":
    main()
