"""
Disable broken and zero-event sources.

Targets:
1. Sources with 0% success rate in last 7 days (fully broken)
2. Sources that succeed but consistently find 0 events (waste of resources)

Does NOT disable sources that:
- Are bar/restaurant venues (they may legitimately have no events — they're destinations)
- Have been recently added (< 14 days old)
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from db import get_client
from datetime import datetime, timedelta
from collections import defaultdict

# Venue-type sources that are destinations (no events expected)
DESTINATION_KEYWORDS = [
    "bar", "pub", "tavern", "grill", "brewing", "brewery", "distillery",
    "coffee", "cafe", "restaurant", "kitchen", "eatery", "diner",
    "lounge", "club", "parlor", "tap", "tiger", "duck",
]

# Known Atlanta destination venues that don't have event pages but are important spots
KNOWN_DESTINATIONS = {
    "the-vortex", "atkins-park", "my-sisters-room", "sound-table", "elmyr",
    "the-glenwood", "flatiron", "nonis", "ladybird-grove", "the-porter",
    "torched-hop", "argosy", "church-atlanta", "wax-n-facts", "the-heretic",
    "sister-louisas", "der-biergarten", "urban-grind", "brake-pad",
    "knock-music-house", "lips-atlanta", "domaine-atlanta", "painted-duck",
    "moes-and-joes", "highland-tap", "ormsbys", "rowdy-tiger", "book-boutique",
}

# Festival/seasonal sources — these legitimately have 0 events most of the year
SEASONAL_KEYWORDS = [
    "fest", "festival", "expo", "convention", "games", "show",
    "pride", "parade", "marathon", "race", "musicfest", "afropunk",
    "renaissance", "furry", "blade", "japanfest",
]


def is_destination_source(slug):
    slug_lower = slug.lower().replace("-", " ")
    return any(kw in slug_lower for kw in DESTINATION_KEYWORDS)


def is_seasonal_source(slug):
    slug_lower = slug.lower().replace("-", " ")
    return any(kw in slug_lower for kw in SEASONAL_KEYWORDS)


def main():
    dry_run = "--dry-run" in sys.argv
    client = get_client()
    week_ago = (datetime.now() - timedelta(days=7)).isoformat()

    # Get all crawl logs from last 7 days
    r = client.table("crawl_logs").select("source_id,status,events_found").gte("started_at", week_ago).execute()

    source_stats = defaultdict(lambda: {"total": 0, "success": 0, "events_found": 0})
    for log in r.data:
        sid = log["source_id"]
        source_stats[sid]["total"] += 1
        if log["status"] == "success":
            source_stats[sid]["success"] += 1
        source_stats[sid]["events_found"] += (log.get("events_found") or 0)

    # Get source names
    all_ids = list(source_stats.keys())
    source_info = {}
    for i in range(0, len(all_ids), 50):
        batch = all_ids[i:i + 50]
        sr = client.table("sources").select("id,slug,is_active").in_("id", batch).execute()
        for s in sr.data:
            source_info[s["id"]] = s

    # Find broken sources (0% success, >= 2 attempts)
    broken = []
    for sid, stats in source_stats.items():
        info = source_info.get(sid, {})
        if not info.get("is_active"):
            continue
        if stats["total"] >= 2 and stats["success"] == 0:
            broken.append((sid, info.get("slug", "?"), stats))

    # Find zero-event sources (100% success but 0 events found)
    zero_event = []
    for sid, stats in source_stats.items():
        info = source_info.get(sid, {})
        if not info.get("is_active"):
            continue
        slug = info.get("slug", "")
        if stats["success"] >= 5 and stats["events_found"] == 0 and not is_destination_source(slug) and not is_seasonal_source(slug) and slug not in KNOWN_DESTINATIONS:
            zero_event.append((sid, slug, stats))

    # Disable broken sources
    print(f"=== BROKEN SOURCES (0% success) — {len(broken)} ===")
    disabled_broken = 0
    for sid, slug, stats in sorted(broken, key=lambda x: -x[2]["total"]):
        print(f"  {slug:45s} 0/{stats['total']} runs succeeded")
        if not dry_run:
            client.table("sources").update({"is_active": False}).eq("id", sid).execute()
            disabled_broken += 1

    # Disable zero-event sources
    print(f"\n=== ZERO-EVENT SOURCES (succeed but find nothing) — {len(zero_event)} ===")
    disabled_zero = 0
    for sid, slug, stats in sorted(zero_event, key=lambda x: -x[2]["success"]):
        print(f"  {slug:45s} {stats['success']} successful runs, 0 events")
        if not dry_run:
            client.table("sources").update({"is_active": False}).eq("id", sid).execute()
            disabled_zero += 1

    action = "disabled" if not dry_run else "would disable"
    print(f"\n=== SUMMARY ===")
    print(f"  Broken sources {action}: {disabled_broken if not dry_run else len(broken)}")
    print(f"  Zero-event sources {action}: {disabled_zero if not dry_run else len(zero_event)}")
    print(f"  Total: {(disabled_broken + disabled_zero) if not dry_run else len(broken) + len(zero_event)}")

    # Show destination sources we're keeping
    kept_destinations = []
    for sid, stats in source_stats.items():
        info = source_info.get(sid, {})
        slug = info.get("slug", "")
        if info.get("is_active") and stats["success"] >= 2 and stats["events_found"] == 0 and is_destination_source(slug):
            kept_destinations.append(slug)
    if kept_destinations:
        print(f"\n  Kept {len(kept_destinations)} destination sources (bars/restaurants with no events expected):")
        for s in sorted(kept_destinations)[:10]:
            print(f"    - {s}")
        if len(kept_destinations) > 10:
            print(f"    ... and {len(kept_destinations) - 10} more")


if __name__ == "__main__":
    main()
