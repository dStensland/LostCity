#!/usr/bin/env python3
"""
Venue data cleanup: deactivate non-destinations, merge duplicates.

Usage:
    python3 cleanup_venue_data.py --dry-run          # Report what would happen
    python3 cleanup_venue_data.py --deactivate       # Deactivate junk venues
    python3 cleanup_venue_data.py --merge-dupes      # Merge exact-name duplicates
    python3 cleanup_venue_data.py --all              # Everything
"""

import re
import argparse
from typing import Optional
from collections import defaultdict
from db import get_client


# ─── CHAIN / NON-DESTINATION LISTS ──────────────────────────────────────────

PHARMACY_CHAINS = {
    "cvs", "walgreens", "rite aid", "publix pharmacy", "kroger pharmacy",
    "walmart pharmacy", "costco pharmacy", "sam's club pharmacy",
}

GAS_STATION_BRANDS = {
    "shell", "bp", "chevron", "quiktrip", "qt", "racetrac", "raceway",
    "citgo", "exxon", "mobil", "marathon", "sunoco", "valero", "murphy usa",
    "circle k", "speedway", "pilot", "flying j", "loves", "wawa",
    "sheetz", "mapco", "flash foods", "parker's",
}

CHAIN_FAST_FOOD = {
    "mcdonald's", "mcdonalds", "subway", "taco bell", "burger king",
    "wendy's", "wendys", "domino's", "dominos", "papa john's", "papa johns",
    "pizza hut", "kfc", "kentucky fried chicken", "popeyes", "popeye's",
    "chick-fil-a", "chick fil a", "sonic drive-in", "sonic drive in",
    "jack in the box", "arby's", "arbys", "hardee's", "hardees",
    "little caesars", "little caesar's", "jimmy john's", "jimmy johns",
    "firehouse subs", "jersey mike's", "jersey mikes", "panda express",
    "chipotle", "five guys", "raising cane's", "raising canes",
    "whataburger", "zaxby's", "zaxbys", "wingstop", "church's chicken",
    "el pollo loco", "del taco", "captain d's", "captain ds",
    "cook out", "cookout",
}

CHAIN_CASUAL_DINING = {
    "applebee's", "applebees", "chili's", "chilis", "olive garden",
    "red lobster", "outback steakhouse", "cracker barrel",
    "texas roadhouse", "ihop", "denny's", "dennys", "waffle house",
    "golden corral", "ruby tuesday", "tgi friday's", "tgi fridays",
    "buffalo wild wings", "hooters", "red robin", "bob evans",
    "longhorn steakhouse", "cheddar's", "cheddars",
}

# Waffle House is an Atlanta institution — KEEP it
CHAIN_EXCEPTIONS = {
    "waffle house",
}

BIG_BOX_RETAIL = {
    "walmart", "target", "home depot", "lowe's", "lowes", "costco",
    "sam's club", "sams club", "best buy", "autozone", "advance auto parts",
    "o'reilly auto parts", "oreilly auto parts", "napa auto parts",
    "dollar general", "dollar tree", "family dollar", "big lots",
    "marshalls", "tj maxx", "ross", "burlington", "harbor freight",
    "staples", "office depot", "office max", "bed bath & beyond",
    "petco", "petsmart", "tractor supply",
}

CHAIN_COFFEE = {
    "dunkin", "dunkin'", "dunkin donuts",
}
# NOTE: Starbucks intentionally excluded — some host events

GROCERY_CHAINS = {
    "kroger", "publix", "aldi", "lidl", "food lion", "piggly wiggly",
    "ingles", "bi-lo", "bilo", "food depot", "save-a-lot", "save a lot",
}

# Venue types that are never destinations
NON_DESTINATION_TYPES = {"pharmacy"}


def _normalize(name: str) -> str:
    """Lowercase, strip possessives and punctuation for matching."""
    return re.sub(r"[''`]s?\b", "", name.lower()).strip()


def _matches_chain_list(name: str, chain_set: set) -> bool:
    """Check if venue name starts with or exactly matches a chain name."""
    norm = _normalize(name)
    for chain in chain_set:
        chain_norm = _normalize(chain)
        if norm == chain_norm or norm.startswith(chain_norm + " ") or norm.startswith(chain_norm + " #"):
            return True
    return False


ADDRESS_ONLY_RE = re.compile(
    r"^\d+\s+[\w\s]+\b(St|Ave|Rd|Blvd|Dr|Ln|Way|Pkwy|Hwy|Cir|Ct|Pl|Pike|Trail|Terrace|Lane)\b",
    re.IGNORECASE,
)


def classify_non_destination(venue: dict) -> Optional[str]:
    """Return a reason string if venue is a non-destination, else None."""
    name = venue.get("name", "")
    vtype = venue.get("venue_type", "")

    # Entire venue_type is non-destination
    if vtype in NON_DESTINATION_TYPES:
        return f"non-destination type: {vtype}"

    # Check exceptions first
    if _matches_chain_list(name, CHAIN_EXCEPTIONS):
        return None

    # Check each chain category
    if _matches_chain_list(name, PHARMACY_CHAINS):
        return "pharmacy chain"
    if _matches_chain_list(name, GAS_STATION_BRANDS):
        return "gas station"
    if _matches_chain_list(name, CHAIN_FAST_FOOD):
        return "chain fast food"
    if _matches_chain_list(name, CHAIN_CASUAL_DINING):
        # Keep Waffle House (already in exceptions above)
        return "chain casual dining"
    if _matches_chain_list(name, BIG_BOX_RETAIL):
        return "big box retail"
    if _matches_chain_list(name, CHAIN_COFFEE):
        return "chain coffee"
    if _matches_chain_list(name, GROCERY_CHAINS):
        return "grocery chain"

    # Address-only names (e.g. "269 Buckhead Ave NE")
    if ADDRESS_ONLY_RE.match(name):
        return "address-as-name"

    return None


# ─── DEACTIVATION ───────────────────────────────────────────────────────────

def get_venue_event_counts(client) -> dict:
    """Get event counts per venue_id for all venues with at least 1 event."""
    # Use RPC or raw query — paginate through events table
    counts = {}
    page_size = 1000
    offset = 0

    while True:
        result = (
            client.table("events")
            .select("venue_id", count="exact")
            .not_.is_("venue_id", "null")
            .range(offset, offset + page_size - 1)
            .execute()
        )
        rows = result.data or []
        if not rows:
            break
        for row in rows:
            vid = row.get("venue_id")
            if vid:
                counts[vid] = counts.get(vid, 0) + 1
        if len(rows) < page_size:
            break
        offset += page_size

    return counts


def run_deactivate(dry_run: bool = False):
    """Deactivate non-destination venues that have zero events."""
    client = get_client()

    print("Loading active venues...")
    result = (
        client.table("venues")
        .select("id,name,slug,venue_type,website,city,state,address")
        .eq("active", True)
        .order("name")
        .execute()
    )
    venues = result.data or []
    print(f"  {len(venues)} active venues")

    print("Loading event counts per venue...")
    event_counts = get_venue_event_counts(client)
    venues_with_events = {vid for vid, cnt in event_counts.items() if cnt > 0}
    print(f"  {len(venues_with_events)} venues have at least 1 event")

    # Categorize
    to_deactivate = []
    protected = []
    clean = 0

    for v in venues:
        reason = classify_non_destination(v)
        if reason:
            if v["id"] in venues_with_events:
                protected.append((v, reason))
            else:
                to_deactivate.append((v, reason))
        else:
            clean += 1

    # Report
    print(f"\n{'=' * 70}")
    print(f"DEACTIVATION REPORT")
    print(f"{'=' * 70}")

    by_reason = defaultdict(list)
    for v, reason in to_deactivate:
        by_reason[reason].append(v)

    for reason in sorted(by_reason.keys()):
        vlist = by_reason[reason]
        print(f"\n  {reason} ({len(vlist)}):")
        for v in vlist[:10]:
            print(f"    [{v['id']}] {v['name'][:55]}")
        if len(vlist) > 10:
            print(f"    ... and {len(vlist) - 10} more")

    print(f"\n  PROTECTED (have events, would otherwise deactivate) ({len(protected)}):")
    for v, reason in protected[:20]:
        ec = event_counts.get(v["id"], 0)
        print(f"    [{v['id']}] {v['name'][:45]} — {reason} — {ec} events")
    if len(protected) > 20:
        print(f"    ... and {len(protected) - 20} more")

    print(f"\n{'=' * 70}")
    print(f"  Would deactivate: {len(to_deactivate)}")
    print(f"  Protected (have events): {len(protected)}")
    print(f"  Clean destinations: {clean}")
    print(f"{'=' * 70}")

    if dry_run:
        print("\n  [DRY RUN] No changes made.")
        return {"deactivated": 0, "protected": len(protected), "clean": clean, "would_deactivate": len(to_deactivate)}

    # Execute
    deactivated = 0
    for v, reason in to_deactivate:
        try:
            client.table("venues").update({"active": False}).eq("id", v["id"]).execute()
            deactivated += 1
        except Exception as e:
            print(f"  ERROR deactivating [{v['id']}] {v['name']}: {e}")

    print(f"\n  Deactivated {deactivated} venues.")
    return {"deactivated": deactivated, "protected": len(protected), "clean": clean}


# ─── DUPLICATE MERGING ──────────────────────────────────────────────────────

def _venue_completeness_score(v: dict) -> int:
    """Score how complete a venue record is. Higher = more data."""
    score = 0
    for field in ["website", "instagram", "phone", "description", "image_url",
                   "neighborhood", "lat", "lng", "hours", "menu_url",
                   "reservation_url", "vibes"]:
        val = v.get(field)
        if val and val not in ([], {}):
            score += 1
    return score


def run_merge_dupes(dry_run: bool = False):
    """Find and merge exact-name duplicate venues in the same city."""
    client = get_client()

    print("Loading active venues...")
    result = (
        client.table("venues")
        .select("id,name,slug,venue_type,website,city,state,address,neighborhood,"
                "instagram,phone,description,image_url,lat,lng,hours,menu_url,"
                "reservation_url,vibes,created_at")
        .eq("active", True)
        .order("name")
        .execute()
    )
    venues = result.data or []
    print(f"  {len(venues)} active venues")

    print("Loading event counts...")
    event_counts = get_venue_event_counts(client)

    # Group by (normalized_name, city)
    groups = defaultdict(list)
    for v in venues:
        key = (_normalize(v["name"]), (v.get("city") or "").lower().strip())
        groups[key].append(v)

    # Filter to groups with 2+ venues
    dupe_groups = {k: vlist for k, vlist in groups.items() if len(vlist) >= 2}

    print(f"  {len(dupe_groups)} duplicate name groups ({sum(len(vl) for vl in dupe_groups.values())} venues)")

    if not dupe_groups:
        print("  No duplicates found.")
        return {"merged": 0, "groups": 0}

    merged = 0
    events_reassigned = 0

    print(f"\n{'=' * 70}")
    print("DUPLICATE MERGE REPORT")
    print(f"{'=' * 70}")

    for (norm_name, city), vlist in sorted(dupe_groups.items()):
        # Pick keeper: most events, then highest completeness, then oldest (lowest ID)
        scored = []
        for v in vlist:
            ec = event_counts.get(v["id"], 0)
            cs = _venue_completeness_score(v)
            scored.append((ec, cs, -v["id"], v))  # negative id so lower id wins ties

        scored.sort(reverse=True)
        keeper = scored[0][3]
        dupes = [s[3] for s in scored[1:]]

        keeper_events = event_counts.get(keeper["id"], 0)
        print(f"\n  \"{vlist[0]['name']}\" in {city or '?'} — {len(vlist)} records")
        print(f"    KEEP [{keeper['id']}] {keeper['name'][:45]} ({keeper_events} events, score={_venue_completeness_score(keeper)})")

        for d in dupes:
            d_events = event_counts.get(d["id"], 0)
            print(f"    DROP [{d['id']}] {d['name'][:45]} ({d_events} events, score={_venue_completeness_score(d)})")

        if dry_run:
            continue

        # Reassign events and deactivate duplicates
        for d in dupes:
            d_events = event_counts.get(d["id"], 0)
            if d_events > 0:
                try:
                    client.table("events").update(
                        {"venue_id": keeper["id"]}
                    ).eq("venue_id", d["id"]).execute()
                    events_reassigned += d_events
                    print(f"      Reassigned {d_events} events from [{d['id']}] → [{keeper['id']}]")
                except Exception as e:
                    print(f"      ERROR reassigning events from [{d['id']}]: {e}")
                    continue

            try:
                client.table("venues").update({"active": False}).eq("id", d["id"]).execute()
                merged += 1
            except Exception as e:
                print(f"      ERROR deactivating [{d['id']}]: {e}")

        # Backfill keeper with any missing data from best duplicate
        backfill_fields = ["website", "instagram", "phone", "description",
                           "image_url", "neighborhood", "hours", "menu_url",
                           "reservation_url"]
        updates = {}
        for field in backfill_fields:
            if not keeper.get(field):
                for d in dupes:
                    if d.get(field):
                        updates[field] = d[field]
                        break
        if updates:
            try:
                client.table("venues").update(updates).eq("id", keeper["id"]).execute()
                print(f"      Backfilled {list(updates.keys())} onto keeper [{keeper['id']}]")
            except Exception as e:
                print(f"      ERROR backfilling [{keeper['id']}]: {e}")

    print(f"\n{'=' * 70}")
    if dry_run:
        print(f"  [DRY RUN] Would merge {sum(len(vl) - 1 for vl in dupe_groups.values())} duplicates across {len(dupe_groups)} groups")
    else:
        print(f"  Merged: {merged} duplicate venues deactivated")
        print(f"  Events reassigned: {events_reassigned}")
    print(f"{'=' * 70}")

    return {"merged": merged, "groups": len(dupe_groups), "events_reassigned": events_reassigned}


# ─── MAIN ────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Clean venue data: deactivate non-destinations, merge duplicates"
    )
    parser.add_argument("--dry-run", action="store_true",
                        help="Report what would happen without making changes")
    parser.add_argument("--deactivate", action="store_true",
                        help="Deactivate chain/pharmacy/gas station/address-only venues")
    parser.add_argument("--merge-dupes", action="store_true",
                        help="Merge exact-name duplicate venues")
    parser.add_argument("--all", action="store_true",
                        help="Run all cleanup steps")

    args = parser.parse_args()

    if not any([args.deactivate, args.merge_dupes, args.all]):
        # Default to dry-run report
        print("No action specified. Use --deactivate, --merge-dupes, --all, or --dry-run")
        print("Running dry-run report...\n")
        args.dry_run = True
        args.all = True

    if args.all or args.deactivate:
        print("=" * 70)
        print("  STEP 1: DEACTIVATE NON-DESTINATIONS")
        print("=" * 70)
        run_deactivate(dry_run=args.dry_run)
        print()

    if args.all or args.merge_dupes:
        print("=" * 70)
        print("  STEP 2: MERGE DUPLICATES")
        print("=" * 70)
        run_merge_dupes(dry_run=args.dry_run)
