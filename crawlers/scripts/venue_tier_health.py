#!/usr/bin/env python3
"""
Venue Enrichment Tier Health Report

Measures every venue against the platform tier contract (prds/040):
  Tier 0: Floor       — name, slug, coords, city/state, venue_type, active
  Tier 1: Discoverable — + image, description (real), neighborhood
  Tier 2: Destination  — + destination_details + 2 features
  Tier 3: Premium      — + 3/5 of: specials, editorial, 3+ occasions, hours, vibes

Usage:
    python3 scripts/venue_tier_health.py                    # Full report
    python3 scripts/venue_tier_health.py --city Atlanta     # Filter by city
    python3 scripts/venue_tier_health.py --type brewery     # Filter by venue_type
    python3 scripts/venue_tier_health.py --gaps             # Show easiest upgrade targets
    python3 scripts/venue_tier_health.py --json             # Machine-readable output
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
    G = "\033[92m"  # green
    Y = "\033[93m"  # yellow
    R = "\033[91m"  # red
    B = "\033[94m"  # blue
    W = "\033[97m"  # white
    D = "\033[90m"  # dim
    BOLD = "\033[1m"
    END = "\033[0m"


TIER_COLORS = {0: C.R, 1: C.Y, 2: C.G, 3: C.B}
TIER_LABELS = {0: "Floor", 1: "Discoverable", 2: "Destination", 3: "Premium"}

# ── Venue types considered "destinations" (worth enriching to Tier 2+) ──
DESTINATION_TYPES = {
    "museum", "gallery", "park", "garden", "brewery", "distillery", "winery",
    "cinema", "music_venue", "comedy_club", "nightclub", "arena", "food_hall",
    "farmers_market", "convention_center", "event_space", "entertainment",
    "bowling", "arcade", "theater", "zoo", "aquarium", "theme_park",
    "sports_bar", "rec_center", "community_center", "library", "bookstore",
    "record_store", "studio", "fitness_center", "restaurant", "bar",
    "coffee_shop", "hotel", "rooftop",
}

BOILERPLATE_STARTS = [
    "welcome to", "just another", "coming soon", "page not found",
    "website coming", "under construction", "no description",
]


def _is_real_description(desc: Optional[str]) -> bool:
    """Return True if description is non-null, non-boilerplate, >30 chars."""
    if not desc or not isinstance(desc, str):
        return False
    desc = desc.strip()
    if len(desc) < 30:
        return False
    lower = desc.lower()
    return not any(lower.startswith(p) for p in BOILERPLATE_STARTS)


def assess_tier(venue: dict, enrichment: dict) -> tuple[int, dict]:
    """
    Assess a venue's tier (0-3) and return (tier, gap_info).

    gap_info has keys for each tier with missing fields.
    """
    gaps: dict[int, list[str]] = {0: [], 1: [], 2: [], 3: []}

    # ── Tier 0 checks ──
    if not venue.get("name"):
        gaps[0].append("name")
    if not venue.get("slug"):
        gaps[0].append("slug")
    if not venue.get("lat") or not venue.get("lng"):
        gaps[0].append("coords")
    if not venue.get("city") or not venue.get("state"):
        gaps[0].append("city/state")
    if not venue.get("venue_type"):
        gaps[0].append("venue_type")
    if venue.get("active") is not True:
        gaps[0].append("active")

    if gaps[0]:
        return 0, gaps

    # ── Tier 1 checks ──
    if not venue.get("image_url"):
        gaps[1].append("image_url")
    if not _is_real_description(venue.get("description")):
        gaps[1].append("description")
    if not venue.get("neighborhood"):
        gaps[1].append("neighborhood")

    if gaps[1]:
        return 0, gaps

    # ── Tier 2 checks ──
    if not enrichment.get("has_destination_details"):
        gaps[2].append("destination_details")
    if enrichment.get("feature_count", 0) < 2:
        gaps[2].append(f"venue_features (have {enrichment.get('feature_count', 0)}, need 2)")

    if gaps[2]:
        return 1, gaps

    # ── Tier 3 checks (need 3/5 premium signals) ──
    premium_signals = 0
    premium_missing = []

    if enrichment.get("special_count", 0) >= 1:
        premium_signals += 1
    else:
        premium_missing.append("specials")

    if enrichment.get("editorial_count", 0) >= 1:
        premium_signals += 1
    else:
        premium_missing.append("editorial_mentions")

    if enrichment.get("occasion_count", 0) >= 3:
        premium_signals += 1
    else:
        premium_missing.append(f"occasions (have {enrichment.get('occasion_count', 0)}, need 3)")

    if venue.get("hours"):
        premium_signals += 1
    else:
        premium_missing.append("hours")

    vibes = venue.get("vibes")
    if vibes and isinstance(vibes, list) and len(vibes) > 0:
        premium_signals += 1
    else:
        premium_missing.append("vibes")

    if premium_signals < 3:
        gaps[3] = premium_missing
        return 2, gaps

    return 3, gaps


def fetch_venues(client, *, city: Optional[str] = None, venue_type: Optional[str] = None) -> list[dict]:
    """Fetch all venues with relevant fields."""
    fields = "id,name,slug,lat,lng,city,state,venue_type,active,image_url,description,neighborhood,website,hours,vibes"
    all_venues = []
    offset = 0
    batch_size = 1000

    while True:
        q = client.table("venues").select(fields).eq("active", True)
        if city:
            q = q.eq("city", city)
        if venue_type:
            q = q.eq("venue_type", venue_type)
        q = q.order("id").range(offset, offset + batch_size - 1)
        r = q.execute()
        if not r.data:
            break
        all_venues.extend(r.data)
        if len(r.data) < batch_size:
            break
        offset += batch_size

    return all_venues


def fetch_enrichment_counts(client, venue_ids: list[int]) -> dict[int, dict]:
    """Batch-fetch enrichment entity counts for a set of venue IDs."""
    enrichment: dict[int, dict] = defaultdict(lambda: {
        "has_destination_details": False,
        "feature_count": 0,
        "special_count": 0,
        "editorial_count": 0,
        "occasion_count": 0,
    })

    if not venue_ids:
        return enrichment

    # Destination details — just need existence
    offset = 0
    while True:
        batch_ids = venue_ids[offset:offset + 500]
        if not batch_ids:
            break
        r = client.table("venue_destination_details").select("venue_id").in_("venue_id", batch_ids).execute()
        for row in (r.data or []):
            enrichment[row["venue_id"]]["has_destination_details"] = True
        offset += 500

    # Features — count per venue
    _count_enrichment(client, "venue_features", venue_ids, enrichment, "feature_count")
    # Specials
    _count_enrichment(client, "venue_specials", venue_ids, enrichment, "special_count")
    # Editorial mentions
    _count_enrichment(client, "editorial_mentions", venue_ids, enrichment, "editorial_count")
    # Occasions
    _count_enrichment(client, "venue_occasions", venue_ids, enrichment, "occasion_count")

    return enrichment


def _count_enrichment(client, table: str, venue_ids: list[int], enrichment: dict, key: str):
    """Count rows per venue_id for an enrichment table."""
    offset = 0
    while True:
        batch_ids = venue_ids[offset:offset + 500]
        if not batch_ids:
            break
        r = client.table(table).select("venue_id").in_("venue_id", batch_ids).execute()
        counts: Counter = Counter()
        for row in (r.data or []):
            counts[row["venue_id"]] += 1
        for vid, count in counts.items():
            enrichment[vid][key] = count
        offset += 500


def print_report(venues: list[dict], enrichment: dict, *, show_gaps: bool = False, as_json: bool = False):
    """Print the tier health report."""
    tier_counts: Counter = Counter()
    type_tiers: dict[str, Counter] = defaultdict(Counter)
    gap_candidates: list[dict] = []

    for v in venues:
        tier, gaps = assess_tier(v, enrichment.get(v["id"], {}))
        tier_counts[tier] += 1
        vtype = v.get("venue_type", "unknown")
        type_tiers[vtype][tier] += 1

        # Track venues closest to upgrading
        if tier < 3:
            next_tier = tier + 1
            missing = gaps.get(next_tier, [])
            gap_candidates.append({
                "id": v["id"],
                "name": v["name"],
                "venue_type": vtype,
                "current_tier": tier,
                "next_tier": next_tier,
                "missing": missing,
                "missing_count": len(missing),
            })

    total = len(venues)

    if as_json:
        result = {
            "total_venues": total,
            "tier_distribution": {f"tier_{t}": tier_counts.get(t, 0) for t in range(4)},
            "tier_percentages": {f"tier_{t}": round(tier_counts.get(t, 0) / total * 100, 1) if total else 0 for t in range(4)},
            "by_type": {
                vtype: {f"tier_{t}": counts.get(t, 0) for t in range(4)}
                for vtype, counts in sorted(type_tiers.items(), key=lambda x: -sum(x[1].values()))
            },
        }
        if show_gaps:
            # Top 20 easiest upgrades
            gap_candidates.sort(key=lambda x: (x["missing_count"], -x["current_tier"]))
            result["easiest_upgrades"] = gap_candidates[:20]
        print(json.dumps(result, indent=2))
        return

    # ── Header ──
    print(f"\n{C.BOLD}{C.B}{'=' * 70}{C.END}")
    print(f"{C.BOLD}{C.B}{'VENUE ENRICHMENT TIER HEALTH':^70}{C.END}")
    print(f"{C.BOLD}{C.B}{'=' * 70}{C.END}\n")

    # ── Overall distribution ──
    print(f"{C.BOLD}Tier Distribution ({total} venues){C.END}")
    print(f"{'-' * 70}")
    for tier in range(4):
        count = tier_counts.get(tier, 0)
        pct = count / total * 100 if total else 0
        color = TIER_COLORS[tier]
        bar = "#" * int(pct / 2)
        label = TIER_LABELS[tier]
        print(f"  {color}Tier {tier} ({label:>12}){C.END}: {count:>5} ({pct:5.1f}%) {C.D}{bar}{C.END}")

    # ── Destination venues breakdown ──
    dest_venues = [v for v in venues if v.get("venue_type") in DESTINATION_TYPES]
    dest_tiers: Counter = Counter()
    for v in dest_venues:
        tier, _ = assess_tier(v, enrichment.get(v["id"], {}))
        dest_tiers[tier] += 1

    print(f"\n{C.BOLD}Destination Venues Only ({len(dest_venues)} venues){C.END}")
    print(f"{'-' * 70}")
    for tier in range(4):
        count = dest_tiers.get(tier, 0)
        pct = count / len(dest_venues) * 100 if dest_venues else 0
        color = TIER_COLORS[tier]
        bar = "#" * int(pct / 2)
        label = TIER_LABELS[tier]
        print(f"  {color}Tier {tier} ({label:>12}){C.END}: {count:>5} ({pct:5.1f}%) {C.D}{bar}{C.END}")

    # ── By venue type (top 15) ──
    print(f"\n{C.BOLD}By Venue Type (top 15){C.END}")
    print(f"{'-' * 70}")
    print(f"  {'Type':<25} {'T0':>5} {'T1':>5} {'T2':>5} {'T3':>5} {'Total':>6} {'%T2+':>6}")
    print(f"  {'-'*25} {'-'*5} {'-'*5} {'-'*5} {'-'*5} {'-'*6} {'-'*6}")

    sorted_types = sorted(type_tiers.items(), key=lambda x: -sum(x[1].values()))
    for vtype, counts in sorted_types[:15]:
        t0 = counts.get(0, 0)
        t1 = counts.get(1, 0)
        t2 = counts.get(2, 0)
        t3 = counts.get(3, 0)
        type_total = t0 + t1 + t2 + t3
        pct_t2plus = (t2 + t3) / type_total * 100 if type_total else 0
        color = C.G if pct_t2plus >= 50 else (C.Y if pct_t2plus >= 20 else C.R)
        print(f"  {vtype:<25} {t0:>5} {t1:>5} {t2:>5} {t3:>5} {type_total:>6} {color}{pct_t2plus:>5.0f}%{C.END}")

    # ── Gap analysis ──
    if show_gaps:
        print(f"\n{C.BOLD}Easiest Tier Upgrades (closest to next tier){C.END}")
        print(f"{'-' * 70}")

        # Group by upgrade path
        for target_tier in [1, 2, 3]:
            candidates = [g for g in gap_candidates if g["next_tier"] == target_tier and g["missing_count"] <= 2]
            candidates.sort(key=lambda x: x["missing_count"])
            if not candidates:
                continue

            color = TIER_COLORS[target_tier]
            print(f"\n  {color}{C.BOLD}→ Tier {target_tier} ({TIER_LABELS[target_tier]}) — {len(candidates)} venues within reach{C.END}")
            for g in candidates[:10]:
                missing_str = ", ".join(g["missing"])
                print(f"    {g['name']:<35} {C.D}({g['venue_type']}){C.END} needs: {C.Y}{missing_str}{C.END}")

    # ── Summary ──
    t2plus = tier_counts.get(2, 0) + tier_counts.get(3, 0)
    t2plus_pct = t2plus / total * 100 if total else 0
    print(f"\n{C.BOLD}Summary{C.END}")
    print(f"{'-' * 70}")
    print(f"  Tier 2+ (Destination-ready): {t2plus} venues ({t2plus_pct:.1f}%)")

    dest_t2plus = dest_tiers.get(2, 0) + dest_tiers.get(3, 0)
    dest_t2plus_pct = dest_t2plus / len(dest_venues) * 100 if dest_venues else 0
    print(f"  Destination venues at Tier 2+: {dest_t2plus} / {len(dest_venues)} ({dest_t2plus_pct:.1f}%)")
    print()


def main():
    parser = argparse.ArgumentParser(description="Venue Enrichment Tier Health Report")
    parser.add_argument("--city", help="Filter by city")
    parser.add_argument("--type", dest="venue_type", help="Filter by venue_type")
    parser.add_argument("--gaps", action="store_true", help="Show easiest upgrade targets")
    parser.add_argument("--json", action="store_true", help="Machine-readable JSON output")
    args = parser.parse_args()

    client = get_client()

    logger.info("Fetching venues...") if not args.json else None
    venues = fetch_venues(client, city=args.city, venue_type=args.venue_type)
    if not venues:
        logger.info("No venues found matching filters.")
        return

    logger.info(f"Fetching enrichment data for {len(venues)} venues...") if not args.json else None
    venue_ids = [v["id"] for v in venues]
    enrichment = fetch_enrichment_counts(client, venue_ids)

    print_report(venues, enrichment, show_gaps=args.gaps, as_json=args.json)


if __name__ == "__main__":
    main()
