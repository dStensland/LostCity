#!/usr/bin/env python3
"""
Fix three venue data gaps in one pass:

1. Venues with coords but no neighborhood (230 venues)
2. Venues with no coords AND no neighborhood (172 venues)
3. Venues with website but no description (T1+ = data_quality >= 50)

Run directly against production — this is authoritative data enrichment.
"""

import sys
import time
import logging
from typing import Optional

logging.basicConfig(level=logging.WARNING)

sys.path.insert(0, '/Users/coach/Projects/LostCity/crawlers')

from db.client import get_client
from neighborhood_lookup import infer_neighborhood_from_coords, NEIGHBORHOODS_BY_CITY
from description_fetcher import fetch_description_from_url

# ─────────────────────────────────────────────────────────────────────────────
# Manual neighborhood overrides for well-known Atlanta venues
# (Used when coords-based inference fails or coords are missing)
# ─────────────────────────────────────────────────────────────────────────────

KNOWN_VENUE_NEIGHBORHOODS = {
    # Well-known Atlanta ITP venues
    "underground atlanta": "Downtown",
    "underground atl": "Downtown",
    "ticonderoga club": "Ponce City Market",
    "ponce city market": "Old Fourth Ward",
    "three taverns brewery": "Avondale Estates",
    "three taverns": "Avondale Estates",
    "woofs": "Midtown",
    "woof's": "Midtown",
    "woofs atlanta": "Midtown",
    "sister louisa's church of the living room": "Old Fourth Ward",
    "sister louisa": "Old Fourth Ward",
    "blake's on the park": "Midtown",
    "blake's": "Midtown",
    "ten atlanta": "Midtown",
    "tens atlanta": "Midtown",
    "the sound table": "Old Fourth Ward",
    "sound table": "Old Fourth Ward",
    "church": "Old Fourth Ward",
    "mother bar": "Old Fourth Ward",
    "noni's": "Old Fourth Ward",
    "noni's bar & deli": "Old Fourth Ward",
    "the earl": "East Atlanta Village",
    "the porter beer bar": "Little Five Points",
    "porter beer bar": "Little Five Points",
    "elmyr": "Little Five Points",
    "the vortex bar & grill": "Little Five Points",
    "vortex bar & grill": "Little Five Points",
    "vortex": "Little Five Points",
    "mary's": "East Atlanta Village",
    "the glenwood": "East Atlanta Village",
    "flatiron": "East Atlanta Village",
    "dark horse tavern": "Virginia-Highland",
    "atkins park": "Virginia-Highland",
    "moe's & joe's": "Virginia-Highland",
    "barcelona wine bar": "Inman Park",
    "wrecking bar brewpub": "Inman Park",
    "wrecking bar": "Inman Park",
    "star bar": "Little Five Points",
    "the star bar": "Little Five Points",
    "edgewood ave": "Old Fourth Ward",
    "bookhouse pub": "Poncey-Highland",
    "ladybird grove": "Reynoldstown",
    "friday's": "Midtown",
    "havana club": "Buckhead",
    "johnny's hideaway": "Buckhead",
    "ormsby's": "West Midtown",
    "painted duck": "West Midtown",
    "monday night brewing": "West End",
    "monday night garage": "West End",
    "monday night west midtown": "West Midtown",
    "max lager's": "Downtown",
    "der biergarten": "Downtown",
    "sidebar": "Downtown",
    "the brickstore pub": "Decatur",
    "brick store pub": "Decatur",
    "leon's full service": "Decatur",
    "square pub": "Decatur",
    "victory sandwich bar": "Decatur",
    "sweetwater brewing company": "West Midtown",
    "sweetwater 420 fest": "West Midtown",
    "georgia aquarium": "Downtown",
    "world of coca-cola": "Downtown",
    "cnn center": "Downtown",
    "state farm arena": "Downtown",
    "centennial olympic park": "Downtown",
    "national center for civil and human rights": "Downtown",
    "fernbank museum": "Druid Hills",
    "fernbank science center": "Druid Hills",
    "emory university": "Druid Hills",
    "georgia tech": "Midtown",
    "fox theatre": "Midtown",
    "alliance theatre": "Midtown",
    "woodruff arts center": "Midtown",
    "high museum of art": "Midtown",
    "symphony hall": "Midtown",
    "atlanta botanical garden": "Midtown",
    "piedmont park": "Midtown",
    "the plaza theatre": "Poncey-Highland",
    "plaza theatre": "Poncey-Highland",
    "little 5 points community center": "Little Five Points",
    "variety playhouse": "Little Five Points",
    "the variety playhouse": "Little Five Points",
    "tabernacle": "Downtown",
    "the tabernacle": "Downtown",
    "terminal west": "West Midtown",
    "masquerade": "Old Fourth Ward",
    "the masquerade": "Old Fourth Ward",
    "vinyl": "Downtown",
    "opera": "Midtown",
    "opera atlanta": "Midtown",
    "apex museum": "Sweet Auburn",
    "king center": "Sweet Auburn",
    "martin luther king jr national park": "Sweet Auburn",
    "carter center": "Old Fourth Ward",
    "ponce de leon ballpark": "Old Fourth Ward",
    "norfolk southern amphitheater": "College Park",
    "ameris bank amphitheatre": "Alpharetta",
    "ameris bank amphitheater": "Alpharetta",
    "lakewood amphitheatre": "South Atlanta",
    "chastain park amphitheatre": "Buckhead",
    "truist park": "Marietta",
    "mercedes-benz stadium": "Downtown",
    "grant park": "Grant Park",
    "zoo atlanta": "Grant Park",
    "cyclorama": "Grant Park",
    "piedmont hospital": "Buckhead",
    "northside hospital": "Sandy Springs",
    "emory hospital": "Druid Hills",
    "morehouse college": "West End",
    "spelman college": "West End",
    "clark atlanta university": "West End",
    "atlanta university center": "West End",
    "agnes scott college": "Decatur",
    "georgia state university": "Downtown",
    "georgia state": "Downtown",
    "kennesaw state university": "Kennesaw",
    "life university": "Marietta",
    "chattahoochee nature center": "Roswell",
    "stone mountain park": "Stone Mountain",
    "arabia mountain": "Lithonia",
    "arabia mountain national heritage area": "Lithonia",
    "atlanta history center": "Buckhead",
    "museum of design atlanta": "Midtown",
    "moda": "Midtown",
    "national black arts festival": "Downtown",
    "braves": "Marietta",
    "atlanta braves": "Marietta",
    "hawks": "Downtown",
    "atlanta hawks": "Downtown",
    "united": "Downtown",
    "atlanta united": "Downtown",
    "the goat farm": "West Midtown",
    "goat farm arts center": "West Midtown",
    "callanwolde fine arts center": "Druid Hills",
    "callanwolde": "Druid Hills",
    "hammonds house museum": "West End",
    "hammonds house": "West End",
    "spruill arts center": "Dunwoody",
    "hudgens center": "Duluth",
    "norcross cultural arts center": "Norcross",
}

# City → neighborhood for non-Atlanta cities
CITY_TO_NEIGHBORHOOD = {
    "Decatur": "Decatur",
    "Stone Mountain": "Stone Mountain",
    "Kennesaw": "Kennesaw",
    "Austell": "Austell",
    "Blue Ridge": "Blue Ridge",
    "Lithonia": "Lithonia",
    "Smyrna": "Smyrna",
    "Marietta": "Marietta",
    "Sandy Springs": "Sandy Springs",
    "Dunwoody": "Dunwoody",
    "Brookhaven": "Brookhaven",
    "Chamblee": "Chamblee",
    "Doraville": "Doraville",
    "Tucker": "Tucker",
    "Norcross": "Norcross",
    "Duluth": "Duluth",
    "Alpharetta": "Alpharetta",
    "Roswell": "Roswell",
    "Lawrenceville": "Lawrenceville",
    "Buford": "Buford",
    "Snellville": "Snellville",
    "Conyers": "Conyers",
    "Covington": "Covington",
    "McDonough": "McDonough",
    "Jonesboro": "Jonesboro",
    "Morrow": "Morrow",
    "Riverdale": "Riverdale",
    "East Point": "East Point",
    "College Park": "College Park",
    "Hapeville": "Hapeville",
    "Forest Park": "Forest Park",
    "Union City": "Union City",
    "Fairburn": "Fairburn",
    "Peachtree City": "Peachtree City",
    "Fayetteville": "Fayetteville",
    "Newnan": "Newnan",
    "Woodstock": "Woodstock",
    "Canton": "Canton",
    "Acworth": "Acworth",
    "Powder Springs": "Powder Springs",
    "Dacula": "Dacula",
    # Nashville suburbs
    "Franklin": "Franklin",
    "Murfreesboro": "Murfreesboro",
    "Hendersonville": "Hendersonville",
    "Mt. Juliet": "Mt. Juliet",
    "Antioch": "Antioch",
    "Brentwood": "Brentwood",
    "Madison": "Madison",
    "Clarksville": "Clarksville",
    "Gallatin": "Gallatin",
    "Lebanon": "Lebanon",
}

# Known out-of-area cities we skip (no meaningful neighborhood to assign)
OUT_OF_AREA_CITIES = {
    "New Orleans", "Toronto", "Etobicoke", "Calgary", "Dallas", "Hartford",
    "Denver", "Broomfield", "Belle Chasse", "Washington",
}


def infer_neighborhood_for_venue(venue: dict) -> Optional[str]:
    """Multi-strategy neighborhood inference for a single venue."""
    name = (venue.get("name") or "").strip().lower()
    city = (venue.get("city") or "").strip()
    lat = venue.get("lat")
    lng = venue.get("lng")

    # Skip clearly virtual / online venues
    if "online" in name or "virtual" in name or "zoom" in name:
        return None

    # Skip out-of-area cities we have no data for
    if city in OUT_OF_AREA_CITIES:
        return None

    # 1. Manual override by venue name (highest confidence)
    for key, neighborhood in KNOWN_VENUE_NEIGHBORHOODS.items():
        if key in name:
            return neighborhood

    # 2. Coordinate-based inference
    if lat and lng:
        # Try city-scoped lookup first (Nashville vs Atlanta)
        if city == "Nashville":
            nh = infer_neighborhood_from_coords(lat, lng, "Nashville")
            if nh:
                return nh
        else:
            nh = infer_neighborhood_from_coords(lat, lng, "Atlanta")
            if nh:
                return nh

        # Coords exist but didn't match any zone — use city fallback
        if city and city != "Atlanta" and city != "Nashville":
            return CITY_TO_NEIGHBORHOOD.get(city, city if city else None)

        # Atlanta city with coords that fall outside all zones — use quadrant
        if city == "Atlanta" and lat and lng:
            return _atlanta_quadrant(lat, lng)

    # 3. Non-Atlanta city → use city name as neighborhood
    if city and city != "Atlanta" and city != "Nashville":
        if city in OUT_OF_AREA_CITIES:
            return None
        return CITY_TO_NEIGHBORHOOD.get(city, city)

    # 4. Nashville with no coords → can't infer
    if city == "Nashville":
        return None  # Nashville without coords is indeterminate

    # 5. Atlanta with no coords — try ZIP fallback
    from fix_neighborhoods import get_neighborhood_from_zip
    zip_code = venue.get("zip")
    if zip_code:
        nh = get_neighborhood_from_zip(zip_code)
        if nh:
            return nh

    return None


def _atlanta_quadrant(lat: float, lng: float) -> str:
    """Rough quadrant fallback for Atlanta coords that miss all named zones."""
    # Center of Atlanta ~33.749, -84.388
    if lat > 33.80:
        if lng > -84.39:
            return "Brookwood"
        else:
            return "West Midtown"
    elif lat > 33.76:
        if lng > -84.37:
            return "Virginia-Highland"
        elif lng > -84.40:
            return "Midtown"
        else:
            return "West Midtown"
    elif lat > 33.74:
        if lng > -84.37:
            return "Inman Park"
        elif lng > -84.40:
            return "Downtown"
        else:
            return "Castleberry Hill"
    else:
        if lng > -84.37:
            return "East Atlanta Village"
        elif lng > -84.41:
            return "Grant Park"
        else:
            return "West End"


# ─────────────────────────────────────────────────────────────────────────────
# GAP 1: Venues with coords but no neighborhood
# ─────────────────────────────────────────────────────────────────────────────

def fix_coords_no_neighborhood(client) -> dict:
    print("\n=== GAP 1: Venues with coords but no neighborhood ===")
    r = client.table("venues").select(
        "id, name, city, address, lat, lng, zip"
    ).is_("neighborhood", "null").not_.is_("lat", "null").not_.is_("lng", "null").execute()

    venues = r.data
    print(f"Found {len(venues)} venues")

    fixed = 0
    skipped = 0
    failed = []

    for v in venues:
        nh = infer_neighborhood_for_venue(v)
        if nh:
            try:
                client.table("venues").update({"neighborhood": nh}).eq("id", v["id"]).execute()
                fixed += 1
                print(f"  [+] {v['name'][:50]} -> {nh}")
            except Exception as e:
                print(f"  [!] FAILED {v['name']}: {e}")
                failed.append(v["id"])
        else:
            skipped += 1
            city = v.get("city") or "?"
            print(f"  [-] SKIP {v['name'][:50]} (city={city}, lat={v.get('lat'):.4f}, lng={v.get('lng'):.4f})")

    print(f"\nGap 1 result: {fixed} fixed, {skipped} skipped (no match), {len(failed)} errors")
    return {"fixed": fixed, "skipped": skipped, "errors": len(failed)}


# ─────────────────────────────────────────────────────────────────────────────
# GAP 2: Venues without coords AND no neighborhood
# ─────────────────────────────────────────────────────────────────────────────

def fix_no_coords_no_neighborhood(client) -> dict:
    print("\n=== GAP 2: Venues without coords AND no neighborhood ===")
    r = client.table("venues").select(
        "id, name, city, address, lat, lng, zip"
    ).is_("neighborhood", "null").is_("lat", "null").execute()

    venues = r.data
    print(f"Found {len(venues)} venues")

    fixed = 0
    skipped = 0
    failed = []

    for v in venues:
        nh = infer_neighborhood_for_venue(v)
        if nh:
            try:
                client.table("venues").update({"neighborhood": nh}).eq("id", v["id"]).execute()
                fixed += 1
                print(f"  [+] {v['name'][:50]} -> {nh}")
            except Exception as e:
                print(f"  [!] FAILED {v['name']}: {e}")
                failed.append(v["id"])
        else:
            skipped += 1
            city = v.get("city") or "?"
            print(f"  [-] SKIP {v['name'][:50]} (city={city})")

    print(f"\nGap 2 result: {fixed} fixed, {skipped} skipped, {len(failed)} errors")
    return {"fixed": fixed, "skipped": skipped, "errors": len(failed)}


# ─────────────────────────────────────────────────────────────────────────────
# GAP 3: Venues with website but no description (data_quality >= 50)
# ─────────────────────────────────────────────────────────────────────────────

def fix_missing_descriptions(client, min_dq: int = 50) -> dict:
    print(f"\n=== GAP 3: Venues with website but no description (data_quality >= {min_dq}) ===")
    r = client.table("venues").select(
        "id, name, website, data_quality"
    ).is_("description", "null").not_.is_("website", "null").gte("data_quality", min_dq).execute()

    venues = r.data
    print(f"Found {len(venues)} venues to try")

    import httpx

    fixed = 0
    skipped = 0
    failed = 0

    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
    }

    with httpx.Client(
        timeout=12.0,
        headers=headers,
        follow_redirects=True,
    ) as http:
        for v in venues:
            url = v["website"]
            name = v["name"]

            try:
                desc = fetch_description_from_url(url, session=http)
                if desc and len(desc) >= 30:
                    client.table("venues").update({"description": desc}).eq("id", v["id"]).execute()
                    fixed += 1
                    print(f"  [+] {name[:45]} (dq={v.get('data_quality')}) -> {len(desc)} chars")
                else:
                    skipped += 1
                    print(f"  [-] {name[:45]} -> no useful description found")
                # Polite rate limiting
                time.sleep(0.3)
            except Exception as e:
                failed += 1
                print(f"  [!] {name[:45]} -> error: {str(e)[:60]}")

    print(f"\nGap 3 result: {fixed} fixed, {skipped} no-desc, {failed} errors")
    return {"fixed": fixed, "skipped": skipped, "errors": failed}


# ─────────────────────────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────────────────────────

def main():
    client = get_client()

    print("=" * 60)
    print("VENUE DATA GAP FIX — PRODUCTION RUN")
    print("=" * 60)

    results = {}

    results["gap1"] = fix_coords_no_neighborhood(client)
    results["gap2"] = fix_no_coords_no_neighborhood(client)
    results["gap3"] = fix_missing_descriptions(client)

    print("\n" + "=" * 60)
    print("FINAL SUMMARY")
    print("=" * 60)
    total_fixed = sum(r["fixed"] for r in results.values())
    print(f"Gap 1 (coords → neighborhood):      {results['gap1']['fixed']} fixed, {results['gap1']['skipped']} skipped")
    print(f"Gap 2 (no-coords → neighborhood):   {results['gap2']['fixed']} fixed, {results['gap2']['skipped']} skipped")
    print(f"Gap 3 (website → description):      {results['gap3']['fixed']} fixed, {results['gap3']['skipped']} skipped")
    print(f"Total records enriched: {total_fixed}")


if __name__ == "__main__":
    main()
