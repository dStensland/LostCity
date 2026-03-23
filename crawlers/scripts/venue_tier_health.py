#!/usr/bin/env python3
"""
Venue Enrichment Tier Health Report

Each venue type has a TARGET tier (how much data it should have).
This tool measures how many venues meet their target.

Target tiers:
  Tier 3 (Premium):      museums, zoos, aquariums, theme parks, arenas, stadiums
  Tier 2 (Destination):   breweries, cinemas, entertainment, food halls, nightlife, attractions
  Tier 1 (Discoverable):  restaurants, bars, parks, galleries, hotels, landmarks
  Tier 0 (Floor):         organizations, churches, event spaces, community centers, catch-all

Data requirements:
  Tier 0: name + slug + coords + city/state + venue_type + active
  Tier 1: + image + description (real) + neighborhood
  Tier 2: + destination_details + 2 venue_features + vibes
  Tier 3: + 3/6 of: specials, editorial, 3+ occasions, hours, vibes, highlights

Usage:
    python3 scripts/venue_tier_health.py                 # Full compliance report
    python3 scripts/venue_tier_health.py --city Atlanta   # Filter by city
    python3 scripts/venue_tier_health.py --type brewery   # Filter by venue_type
    python3 scripts/venue_tier_health.py --gaps           # Show underperformers
    python3 scripts/venue_tier_health.py --json           # Machine-readable output
"""

import argparse
import json
import logging
import sys
from collections import Counter, defaultdict
from typing import Optional

sys.path.insert(0, ".")
from db.client import get_client

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)


# ── Terminal colors ──
class C:
    G = "\033[92m"
    Y = "\033[93m"
    R = "\033[91m"
    B = "\033[94m"
    D = "\033[90m"
    BOLD = "\033[1m"
    END = "\033[0m"


TIER_LABELS = {0: "Floor", 1: "Discoverable", 2: "Destination", 3: "Premium"}

# ── Target tier per venue_type ──
# "What level of data should this type of venue have?"

TARGET_TIER_3 = {
    "museum", "zoo", "aquarium", "theme_park", "arena", "convention_center",
    "stadium",
}

TARGET_TIER_2 = {
    "brewery", "distillery", "winery", "cinema", "entertainment", "bowling",
    "arcade", "food_hall", "farmers_market", "sports_bar", "comedy_club",
    "nightclub", "music_venue", "rooftop",
    # Experiential destinations
    "attraction", "escape_room", "games", "gaming", "club", "amphitheater",
    "lounge", "wine_bar", "cocktail_bar", "pool_hall", "karaoke",
}

TARGET_TIER_1 = {
    "restaurant", "bar", "coffee_shop", "gallery", "theater", "bookstore",
    "record_store", "library", "park", "garden", "fitness_center", "studio",
    "hotel", "rec_center",
    # Cultural and discoverable landmarks
    "arts_center", "recreation", "dance_studio", "cafe", "nature_center",
    "cooking_school", "outdoor_venue", "historic_site", "landmark",
}

# Everything else is Tier 0 (event containers, orgs, churches, etc.)
# Explicitly includes: organization, church, venue, festival, college,
# university, hospital, event_space, community_center, and all others.


def target_tier_for(venue_type: Optional[str]) -> int:
    if not venue_type:
        return 0
    if venue_type in TARGET_TIER_3:
        return 3
    if venue_type in TARGET_TIER_2:
        return 2
    if venue_type in TARGET_TIER_1:
        return 1
    return 0


BOILERPLATE_STARTS = [
    "welcome to", "just another", "coming soon", "page not found",
    "website coming", "under construction", "no description",
]


def _is_real_description(desc: Optional[str]) -> bool:
    if not desc or not isinstance(desc, str):
        return False
    desc = desc.strip()
    if len(desc) < 30:
        return False
    lower = desc.lower()
    return not any(lower.startswith(p) for p in BOILERPLATE_STARTS)


def _has_vibes(venue: dict) -> bool:
    vibes = venue.get("vibes")
    return bool(vibes and isinstance(vibes, list) and len(vibes) > 0)


def actual_tier(venue: dict, enrichment: dict) -> int:
    """What tier does this venue's data actually meet?"""
    # Tier 0 checks
    if not venue.get("name") or not venue.get("slug"):
        return -1
    if not venue.get("lat") or not venue.get("lng"):
        return -1
    if not venue.get("city") or not venue.get("state"):
        return -1
    if not venue.get("venue_type"):
        return -1
    if venue.get("active") is not True:
        return -1

    # Tier 1 checks
    if not venue.get("image_url"):
        return 0
    if not _is_real_description(venue.get("description")):
        return 0
    if not venue.get("neighborhood"):
        return 0

    # Tier 2 checks
    if not enrichment.get("has_destination_details"):
        return 1
    if enrichment.get("feature_count", 0) < 2:
        return 1
    if not _has_vibes(venue):
        return 1

    # Tier 3 checks — need 3/6 premium signals
    premium = 0
    if enrichment.get("special_count", 0) >= 1:
        premium += 1
    if enrichment.get("editorial_count", 0) >= 1:
        premium += 1
    if enrichment.get("occasion_count", 0) >= 3:
        premium += 1
    if venue.get("hours"):
        premium += 1
    # vibes already required at T2, so this is always 1 for T3-eligible venues
    if _has_vibes(venue):
        premium += 1
    if enrichment.get("highlight_count", 0) >= 1:
        premium += 1
    if premium < 3:
        return 2

    return 3


def tier_gaps(venue: dict, enrichment: dict, target: int) -> list[str]:
    """What's missing to reach the target tier?"""
    current = actual_tier(venue, enrichment)
    if current >= target:
        return []

    missing = []
    # Need Tier 1?
    if current < 1 and target >= 1:
        if not venue.get("image_url"):
            missing.append("image")
        if not _is_real_description(venue.get("description")):
            missing.append("description")
        if not venue.get("neighborhood"):
            missing.append("neighborhood")

    # Need Tier 2?
    if current < 2 and target >= 2:
        if not enrichment.get("has_destination_details"):
            missing.append("destination_details")
        fc = enrichment.get("feature_count", 0)
        if fc < 2:
            missing.append(f"features ({fc}/2)")
        if not _has_vibes(venue):
            missing.append("vibes")

    # Need Tier 3?
    if current < 3 and target >= 3:
        if enrichment.get("special_count", 0) < 1:
            missing.append("specials")
        if enrichment.get("editorial_count", 0) < 1:
            missing.append("editorial")
        if enrichment.get("occasion_count", 0) < 3:
            missing.append(f"occasions ({enrichment.get('occasion_count', 0)}/3)")
        if not venue.get("hours"):
            missing.append("hours")
        if not _has_vibes(venue):
            missing.append("vibes")
        if enrichment.get("highlight_count", 0) < 1:
            missing.append("highlights")

    return missing


def fetch_venues(client, *, city: Optional[str] = None, venue_type: Optional[str] = None) -> list[dict]:
    fields = "id,name,slug,lat,lng,city,state,venue_type,active,image_url,description,neighborhood,website,hours,vibes"
    all_venues = []
    offset = 0
    while True:
        q = client.table("venues").select(fields).eq("active", True)
        if city:
            q = q.eq("city", city)
        if venue_type:
            q = q.eq("venue_type", venue_type)
        q = q.order("id").range(offset, offset + 999)
        r = q.execute()
        if not r.data:
            break
        all_venues.extend(r.data)
        if len(r.data) < 1000:
            break
        offset += 1000
    return all_venues


def fetch_enrichment_counts(client, venue_ids: list[int]) -> dict[int, dict]:
    enrichment: dict[int, dict] = defaultdict(lambda: {
        "has_destination_details": False,
        "feature_count": 0,
        "special_count": 0,
        "editorial_count": 0,
        "occasion_count": 0,
        "highlight_count": 0,
    })
    if not venue_ids:
        return enrichment

    for offset in range(0, len(venue_ids), 500):
        batch = venue_ids[offset:offset + 500]
        r = client.table("venue_destination_details").select("venue_id").in_("venue_id", batch).execute()
        for row in (r.data or []):
            enrichment[row["venue_id"]]["has_destination_details"] = True

    for table, key in [
        ("venue_features", "feature_count"),
        ("venue_specials", "special_count"),
        ("editorial_mentions", "editorial_count"),
        ("venue_occasions", "occasion_count"),
        ("venue_highlights", "highlight_count"),
    ]:
        for offset in range(0, len(venue_ids), 500):
            batch = venue_ids[offset:offset + 500]
            r = client.table(table).select("venue_id").in_("venue_id", batch).execute()
            counts: Counter = Counter(row["venue_id"] for row in (r.data or []))
            for vid, count in counts.items():
                enrichment[vid][key] = count

    return enrichment


def _compliance_color(pct: float) -> str:
    if pct >= 70:
        return C.G
    if pct >= 40:
        return C.Y
    return C.R


def _bar(pct: float, width: int = 20) -> str:
    filled = int(pct / 100 * width)
    return f"{C.D}{'#' * filled}{'.' * (width - filled)}{C.END}"


def print_field_gaps(venues: list[dict], enrichment: dict):
    """Show per-field gap breakdown for each target tier."""

    print(f"\n{C.BOLD}Per-Field Gap Breakdown{C.END}")
    print(f"{'─' * 70}")

    # T1 gaps (all venues with target >= 1)
    t1_venues = [v for v in venues if target_tier_for(v.get("venue_type")) >= 1]
    if t1_venues:
        no_desc = sum(1 for v in t1_venues if not _is_real_description(v.get("description")))
        no_hood = sum(1 for v in t1_venues if not v.get("neighborhood"))
        no_img = sum(1 for v in t1_venues if not v.get("image_url"))
        total = len(t1_venues)

        t1_gaps = sorted([
            ("description", no_desc),
            ("neighborhood", no_hood),
            ("image", no_img),
        ], key=lambda x: -x[1])

        t1_pass = sum(1 for v in t1_venues
                      if actual_tier(v, enrichment.get(v["id"], {})) >= 1)
        t1_pct = t1_pass / total * 100 if total else 0

        print(f"\n  {C.BOLD}T1 Field Gaps{C.END} {C.D}({total} venues with target >= T1, {t1_pct:.0f}% meet T1){C.END}")
        for i, (field, count) in enumerate(t1_gaps):
            pct = count / total * 100 if total else 0
            marker = f"  {C.R}<- #1 blocker{C.END}" if i == 0 and count > 0 else ""
            print(f"    Missing {field:<20} {count:>5} ({pct:.0f}%){marker}")

    # T2 gaps (all venues with target >= 2)
    t2_venues = [v for v in venues if target_tier_for(v.get("venue_type")) >= 2]
    if t2_venues:
        total = len(t2_venues)
        no_dest = sum(1 for v in t2_venues if not enrichment.get(v["id"], {}).get("has_destination_details"))
        no_feat = sum(1 for v in t2_venues if enrichment.get(v["id"], {}).get("feature_count", 0) < 2)
        no_vibes = sum(1 for v in t2_venues if not _has_vibes(v))
        t1_prereq_fail = sum(1 for v in t2_venues
                             if actual_tier(v, enrichment.get(v["id"], {})) < 1)

        t2_pass = sum(1 for v in t2_venues
                      if actual_tier(v, enrichment.get(v["id"], {})) >= 2)
        t2_pct = t2_pass / total * 100 if total else 0

        t2_gaps = sorted([
            ("destination_details", no_dest),
            ("2+ features", no_feat),
            ("vibes", no_vibes),
        ], key=lambda x: -x[1])

        print(f"\n  {C.BOLD}T2 Field Gaps{C.END} {C.D}({total} venues with target >= T2, {t2_pct:.0f}% meet T2){C.END}")
        for field, count in t2_gaps:
            pct = count / total * 100 if total else 0
            print(f"    Missing {field:<20} {count:>5} ({pct:.0f}%)")
        pct = t1_prereq_fail / total * 100 if total else 0
        print(f"    {C.D}T1 prerequisite fail    {t1_prereq_fail:>5} ({pct:.0f}%){C.END}")

    # T3 premium signal gaps (all venues with target >= 3)
    t3_venues = [v for v in venues if target_tier_for(v.get("venue_type")) >= 3]
    if t3_venues:
        total = len(t3_venues)
        no_specials = sum(1 for v in t3_venues if enrichment.get(v["id"], {}).get("special_count", 0) < 1)
        no_editorial = sum(1 for v in t3_venues if enrichment.get(v["id"], {}).get("editorial_count", 0) < 1)
        no_occasions = sum(1 for v in t3_venues if enrichment.get(v["id"], {}).get("occasion_count", 0) < 3)
        no_hours = sum(1 for v in t3_venues if not v.get("hours"))
        no_vibes = sum(1 for v in t3_venues if not _has_vibes(v))
        no_highlights = sum(1 for v in t3_venues if enrichment.get(v["id"], {}).get("highlight_count", 0) < 1)

        t3_pass = sum(1 for v in t3_venues
                      if actual_tier(v, enrichment.get(v["id"], {})) >= 3)
        t3_pct = t3_pass / total * 100 if total else 0

        t2_prereq_fail = sum(1 for v in t3_venues
                             if actual_tier(v, enrichment.get(v["id"], {})) < 2)

        t3_gaps = sorted([
            ("specials", no_specials),
            ("editorial", no_editorial),
            ("3+ occasions", no_occasions),
            ("hours", no_hours),
            ("vibes", no_vibes),
            ("highlights", no_highlights),
        ], key=lambda x: -x[1])

        print(f"\n  {C.BOLD}T3 Premium Signal Gaps{C.END} {C.D}({total} venues with target >= T3, {t3_pct:.0f}% meet T3, need 3/6){C.END}")
        for field, count in t3_gaps:
            pct = count / total * 100 if total else 0
            print(f"    No {field:<22} {count:>5} ({pct:.0f}%)")
        pct = t2_prereq_fail / total * 100 if total else 0
        print(f"    {C.D}T2 prerequisite fail    {t2_prereq_fail:>5} ({pct:.0f}%){C.END}")


def print_report(venues: list[dict], enrichment: dict, *, show_gaps: bool = False, as_json: bool = False):
    # Assess every venue
    results = []
    for v in venues:
        vtype = v.get("venue_type", "unknown")
        target = target_tier_for(vtype)
        current = actual_tier(v, enrichment.get(v["id"], {}))
        meets_target = current >= target
        gaps = tier_gaps(v, enrichment.get(v["id"], {}), target)
        results.append({
            "id": v["id"],
            "name": v["name"],
            "venue_type": vtype,
            "target_tier": target,
            "actual_tier": current,
            "meets_target": meets_target,
            "gaps": gaps,
        })

    total = len(results)
    compliant = sum(1 for r in results if r["meets_target"])
    compliance_pct = compliant / total * 100 if total else 0

    # Group by target tier
    by_target: dict[int, list[dict]] = defaultdict(list)
    for r in results:
        by_target[r["target_tier"]].append(r)

    # Group by venue_type
    by_type: dict[str, list[dict]] = defaultdict(list)
    for r in results:
        by_type[r["venue_type"]].append(r)

    if as_json:
        output = {
            "total_venues": total,
            "compliant": compliant,
            "compliance_pct": round(compliance_pct, 1),
            "by_target_tier": {},
            "by_type": {},
            "field_gaps": {},
        }
        for tier in range(4):
            group = by_target.get(tier, [])
            met = sum(1 for r in group if r["meets_target"])
            output["by_target_tier"][f"tier_{tier}"] = {
                "count": len(group),
                "compliant": met,
                "pct": round(met / len(group) * 100, 1) if group else 0,
            }
        for vtype, group in sorted(by_type.items(), key=lambda x: -len(x[1])):
            met = sum(1 for r in group if r["meets_target"])
            output["by_type"][vtype] = {
                "count": len(group),
                "target_tier": target_tier_for(vtype),
                "compliant": met,
                "pct": round(met / len(group) * 100, 1) if group else 0,
            }

        # Field gaps in JSON
        for tier_level, tier_key in [(1, "t1"), (2, "t2"), (3, "t3")]:
            tier_venues = [v for v in venues if target_tier_for(v.get("venue_type")) >= tier_level]
            if not tier_venues:
                continue
            tier_total = len(tier_venues)
            gap_data = {"total": tier_total}

            if tier_level >= 1:
                gap_data["missing_description"] = sum(1 for v in tier_venues if not _is_real_description(v.get("description")))
                gap_data["missing_neighborhood"] = sum(1 for v in tier_venues if not v.get("neighborhood"))
                gap_data["missing_image"] = sum(1 for v in tier_venues if not v.get("image_url"))

            if tier_level >= 2:
                gap_data["missing_destination_details"] = sum(1 for v in tier_venues if not enrichment.get(v["id"], {}).get("has_destination_details"))
                gap_data["missing_features"] = sum(1 for v in tier_venues if enrichment.get(v["id"], {}).get("feature_count", 0) < 2)
                gap_data["missing_vibes"] = sum(1 for v in tier_venues if not _has_vibes(v))

            if tier_level >= 3:
                gap_data["missing_specials"] = sum(1 for v in tier_venues if enrichment.get(v["id"], {}).get("special_count", 0) < 1)
                gap_data["missing_editorial"] = sum(1 for v in tier_venues if enrichment.get(v["id"], {}).get("editorial_count", 0) < 1)
                gap_data["missing_occasions"] = sum(1 for v in tier_venues if enrichment.get(v["id"], {}).get("occasion_count", 0) < 3)
                gap_data["missing_hours"] = sum(1 for v in tier_venues if not v.get("hours"))
                gap_data["missing_highlights"] = sum(1 for v in tier_venues if enrichment.get(v["id"], {}).get("highlight_count", 0) < 1)

            output["field_gaps"][tier_key] = gap_data

        if show_gaps:
            failing = [r for r in results if not r["meets_target"] and r["target_tier"] >= 1]
            failing.sort(key=lambda r: (len(r["gaps"]), -r["target_tier"]))
            output["underperformers"] = failing[:30]
        print(json.dumps(output, indent=2))
        return

    # ── Print report ──
    print(f"\n{C.BOLD}{C.B}{'=' * 70}{C.END}")
    print(f"{C.BOLD}{C.B}{'VENUE ENRICHMENT HEALTH':^70}{C.END}")
    print(f"{C.BOLD}{C.B}{'=' * 70}{C.END}")

    # Overall compliance
    color = _compliance_color(compliance_pct)
    print(f"\n  {C.BOLD}Overall:{C.END} {color}{compliant}/{total} venues meet their target tier ({compliance_pct:.0f}%){C.END}")

    # ── By target tier ──
    print(f"\n{C.BOLD}Compliance by Target Tier{C.END}")
    print(f"{'─' * 70}")
    print(f"  {'Target Tier':<30} {'Total':>6} {'Pass':>6} {'Fail':>6} {'Rate':>7}")
    print(f"  {'─' * 26}  {'─' * 5} {'─' * 5} {'─' * 5} {'─' * 6}")

    for tier in [3, 2, 1, 0]:
        group = by_target.get(tier, [])
        if not group:
            continue
        met = sum(1 for r in group if r["meets_target"])
        fail = len(group) - met
        pct = met / len(group) * 100 if group else 0
        color = _compliance_color(pct)
        print(f"  Tier {tier} ({TIER_LABELS[tier]:<12})         {len(group):>6} {met:>6} {fail:>6} {color}{pct:>5.0f}%{C.END}  {_bar(pct)}")

    # ── By venue type (worst compliance first, only types with target >= 1) ──
    print(f"\n{C.BOLD}Compliance by Venue Type{C.END} {C.D}(target tier >= 1, sorted worst->best){C.END}")
    print(f"{'─' * 70}")
    print(f"  {'Type':<22} {'Target':>6} {'Count':>6} {'Pass':>6} {'Rate':>7}")
    print(f"  {'─' * 22} {'─' * 6} {'─' * 5} {'─' * 5} {'─' * 6}")

    type_rows = []
    for vtype, group in by_type.items():
        target = target_tier_for(vtype)
        if target < 1:
            continue
        met = sum(1 for r in group if r["meets_target"])
        pct = met / len(group) * 100 if group else 0
        type_rows.append((vtype, target, len(group), met, pct))

    type_rows.sort(key=lambda r: (r[4], -r[2]))  # worst compliance first, then by count

    for vtype, target, count, met, pct in type_rows:
        color = _compliance_color(pct)
        print(f"  {vtype:<22} T{target:>5} {count:>6} {met:>6} {color}{pct:>5.0f}%{C.END}  {_bar(pct)}")

    # ── Per-field gap breakdown ──
    print_field_gaps(venues, enrichment)

    # ── Gap analysis ──
    if show_gaps:
        print(f"\n{C.BOLD}Venues Not Meeting Target{C.END} {C.D}(easiest fixes first, target tier >= 2){C.END}")
        print(f"{'─' * 70}")

        failing = [r for r in results if not r["meets_target"] and r["target_tier"] >= 2]
        failing.sort(key=lambda r: (len(r["gaps"]), -r["target_tier"]))

        for r in failing[:25]:
            gap_str = ", ".join(r["gaps"][:4])
            print(f"  {r['name']:<35} {C.D}T{r['target_tier']} {r['venue_type']:<15}{C.END} needs: {C.Y}{gap_str}{C.END}")

    # ── Summary ──
    t2plus_types = TARGET_TIER_2 | TARGET_TIER_3
    high_value = [r for r in results if r["venue_type"] in t2plus_types]
    hv_met = sum(1 for r in high_value if r["meets_target"])
    hv_pct = hv_met / len(high_value) * 100 if high_value else 0

    print(f"\n{C.BOLD}Summary{C.END}")
    print(f"{'─' * 70}")
    print(f"  High-value venues (T2/T3 targets): {_compliance_color(hv_pct)}{hv_met}/{len(high_value)} compliant ({hv_pct:.0f}%){C.END}")

    t1_types = TARGET_TIER_1
    t1_venues = [r for r in results if r["venue_type"] in t1_types]
    t1_met = sum(1 for r in t1_venues if r["meets_target"])
    t1_pct = t1_met / len(t1_venues) * 100 if t1_venues else 0
    print(f"  Discoverable venues (T1 targets):  {_compliance_color(t1_pct)}{t1_met}/{len(t1_venues)} compliant ({t1_pct:.0f}%){C.END}")

    t0_venues = [r for r in results if target_tier_for(r["venue_type"]) == 0]
    t0_met = sum(1 for r in t0_venues if r["meets_target"])
    t0_pct = t0_met / len(t0_venues) * 100 if t0_venues else 0
    print(f"  Event containers (T0 targets):     {_compliance_color(t0_pct)}{t0_met}/{len(t0_venues)} compliant ({t0_pct:.0f}%){C.END}")
    print()


def main():
    parser = argparse.ArgumentParser(description="Venue Enrichment Tier Health Report")
    parser.add_argument("--city", help="Filter by city")
    parser.add_argument("--type", dest="venue_type", help="Filter by venue_type")
    parser.add_argument("--gaps", action="store_true", help="Show underperforming venues")
    parser.add_argument("--json", action="store_true", help="Machine-readable JSON output")
    args = parser.parse_args()

    client = get_client()
    venues = fetch_venues(client, city=args.city, venue_type=args.venue_type)
    if not venues:
        print("No venues found.")
        return

    venue_ids = [v["id"] for v in venues]
    enrichment = fetch_enrichment_counts(client, venue_ids)
    print_report(venues, enrichment, show_gaps=args.gaps, as_json=args.json)


if __name__ == "__main__":
    main()
