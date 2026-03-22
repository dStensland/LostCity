#!/usr/bin/env python3
"""
Phase 1 data remediation tasks.

Tasks:
  1a  Verify AA/NA sources are scoped to the support portal (not leaking into
      general feeds).
  1d  Deactivate sources with known dead domains (persistent DNS/connection
      failures confirmed by repeated crawl failures).
  1e  Reclassify Stone Mountain Park permanent attractions as
      content_kind='exhibit' so they stay in the DB but are excluded from the
      event feed.

NOTE on 1e: The project convention (see deactivate_exhibit_spam.py) is to
reclassify misclassified permanent attractions as content_kind='exhibit' rather
than setting is_active=False.  Deactivation is reserved for sources, not
individual events that are legitimate venue records.  This script follows that
convention.

Usage:
    python scripts/remediation_phase1.py                   # All tasks, dry-run
    python scripts/remediation_phase1.py --task aa-na      # Single task
    python scripts/remediation_phase1.py --apply           # Execute changes
"""

import argparse
import logging
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from db import get_client

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# 1a — AA/NA portal scoping verification
# ---------------------------------------------------------------------------

def verify_aa_na_portal_scoping() -> None:
    """Check that AA/NA sources are scoped to the support portal, not the main feed.

    These sources should have owner_portal_id set to the support/community
    portal so their events never surface in general city feeds or hotel portals.
    If owner_portal_id is NULL, events from these sources leak into every portal
    that uses the null-inclusive filter pattern.
    """
    client = get_client()

    # Locate AA/NA sources by slug pattern or known name fragments.
    result = client.table("sources").select(
        "id, slug, name, owner_portal_id, is_active"
    ).or_(
        "slug.ilike.%aa-atlanta%,"
        "slug.ilike.%na-georgia%,"
        "slug.ilike.%aa-meeting%,"
        "slug.ilike.%na-meeting%,"
        "name.ilike.%alcoholics anonymous%,"
        "name.ilike.%narcotics anonymous%,"
        "name.ilike.%aa atlanta%,"
        "name.ilike.%na georgia%"
    ).execute()

    sources = result.data or []

    if not sources:
        print("  No AA/NA sources found — nothing to check.")
        print("  (If sources exist under different slugs, update search patterns above.)")
    else:
        print(f"  Found {len(sources)} AA/NA source(s):")
        for source in sources:
            portal_id = source.get("owner_portal_id")
            active_flag = "active" if source.get("is_active") else "inactive"
            status_prefix = "OK" if portal_id else "WARNING"
            print(
                f"  [{status_prefix}] {source['slug']} (id={source['id']}, {active_flag}): "
                f"owner_portal_id={portal_id!r}"
            )
            if not portal_id:
                print(
                    f"    !! {source['slug']} has NO portal scoping — "
                    f"events will leak into all portals using the null-inclusive filter."
                )
            else:
                print(f"    => Correctly scoped to portal {portal_id}.")

    # Show available portals for reference when diagnosing issues.
    portals_result = client.table("portals").select("id, slug, name").execute()
    portals = portals_result.data or []
    print("\n  Available portals:")
    if portals:
        for p in portals:
            print(f"    {p['slug']} (id={p['id']}): {p['name']}")
    else:
        print("    (no portals found)")


# ---------------------------------------------------------------------------
# 1d — Deactivate dead-domain sources
# ---------------------------------------------------------------------------

# Slugs confirmed as having persistent DNS/connection failures.
# Listed in both hyphenated and slug-as-written variants so partial matching
# can catch whichever form was used at source registration time.
_DEAD_DOMAIN_SLUGS = [
    "folklorehh",
    "irwin-street",
    "irwinstreet",
    "lyfe-atlanta",
    "lyfeatlanta",
    "vista-yoga-atl",
    "vistayogaatl",
    "zucot",
    "moods-music",
    "moodsmusic",
    "paranoia-quest-rooms",
    "paranoiaquestrooms",
    "spaceman-atlanta",
    "spacemanatlanta",
    "live-at-the-battery-atlanta",
    "liveatthebatteryatlanta",
]


def deactivate_dead_domain_sources(dry_run: bool = True) -> None:
    """Deactivate sources with persistent DNS/connection failures.

    Only deactivates sources that are currently active.  Already-inactive
    sources are reported but not touched.  A dry-run pass prints what would
    change without writing to the database.
    """
    client = get_client()

    # Deduplicate slug list while preserving the deterministic order for output.
    seen: set[str] = set()
    unique_slugs = [s for s in _DEAD_DOMAIN_SLUGS if not (s in seen or seen.add(s))]  # type: ignore[func-returns-value]

    found_ids: set[str] = set()
    rows_to_process: list[dict] = []

    for slug in unique_slugs:
        # Exact match first.
        result = (
            client.table("sources")
            .select("id, slug, name, is_active, website")
            .eq("slug", slug)
            .execute()
        )

        if not result.data:
            # Fall back to partial (ilike) match to catch variant spellings.
            result = (
                client.table("sources")
                .select("id, slug, name, is_active, website")
                .ilike("slug", f"%{slug}%")
                .execute()
            )

        for source in result.data or []:
            if source["id"] not in found_ids:
                found_ids.add(source["id"])
                rows_to_process.append(source)

    if not rows_to_process:
        print("  No matching dead-domain sources found.")
        print("  (Check that slugs in _DEAD_DOMAIN_SLUGS match the sources table.)")
        return

    would_deactivate = 0
    already_inactive = 0

    for source in sorted(rows_to_process, key=lambda s: s["slug"]):
        if source.get("is_active"):
            would_deactivate += 1
            website = source.get("website") or "(no website)"
            action = "DRY RUN — would deactivate" if dry_run else "Deactivating"
            print(f"  [{action}] {source['slug']} ({source['name']}) — {website}")
            if not dry_run:
                client.table("sources").update({"is_active": False}).eq(
                    "id", source["id"]
                ).execute()
                logger.info("Deactivated source %s (id=%s)", source["slug"], source["id"])
        else:
            already_inactive += 1
            print(f"  [already inactive] {source['slug']} ({source['name']})")

    print(
        f"\n  Summary: {would_deactivate} {'would be deactivated' if dry_run else 'deactivated'}, "
        f"{already_inactive} already inactive."
    )


# ---------------------------------------------------------------------------
# 1e — Reclassify Stone Mountain permanent attractions
# ---------------------------------------------------------------------------

# Canonical attraction title set (lower-cased for case-insensitive matching).
# Sourced from the existing deactivate_exhibit_spam.py to stay consistent.
_STONE_MOUNTAIN_ATTRACTION_TITLES = {
    "summit skyride",
    "scenic railroad",
    "dinosaur explore",
    "skyhike",
    "sky hike",
    "mini golf",
    "adventure golf",
    "adventure outpost",
    "gemstone mining",
    "geyser towers",
    "geyser tower",
    "farmyard",
    "4-d theater",
    "duck adventures",
    "duck tour",
    "general admission",
    "nature playground",
    "splash pad",
    "camp highland outpost",
    "skylift",
}

_STONE_MOUNTAIN_VENUE_SLUG = "stone-mountain-park"


def remove_stone_mountain_attractions(dry_run: bool = True) -> None:
    """Reclassify Stone Mountain Park permanent attractions as content_kind='exhibit'.

    These are not real events — they are permanent attractions that the park
    lists as if they were scheduled activities.  The correct handling per
    project convention is content_kind='exhibit', which keeps the records in
    the DB (for venue completeness) but excludes them from the event feed.

    NOTE: is_active=False is NOT used here.  Per CLAUDE.md and the established
    deactivate_exhibit_spam.py script, deactivation is for sources, not for
    individual event rows that represent real (if misclassified) venue content.
    """
    client = get_client()

    venue_result = (
        client.table("venues")
        .select("id, name, slug")
        .eq("slug", _STONE_MOUNTAIN_VENUE_SLUG)
        .execute()
    )

    if not venue_result.data:
        # Try a broader name search as a fallback.
        venue_result = (
            client.table("venues")
            .select("id, name, slug")
            .ilike("name", "%stone mountain%")
            .execute()
        )

    if not venue_result.data:
        print(f"  Venue '{_STONE_MOUNTAIN_VENUE_SLUG}' not found — nothing to reclassify.")
        return

    total_reclassified = 0

    for venue in venue_result.data:
        venue_id = venue["id"]
        venue_name = venue["name"]
        print(f"\n  Venue: {venue_name} (id={venue_id})")

        events_result = (
            client.table("events")
            .select("id, title, start_date, content_kind")
            .eq("venue_id", venue_id)
            .neq("content_kind", "exhibit")
            .execute()
        )

        events = events_result.data or []
        if not events:
            print("    No non-exhibit events found.")
            continue

        matches = [
            e for e in events
            if (e.get("title") or "").strip().lower() in _STONE_MOUNTAIN_ATTRACTION_TITLES
        ]

        if not matches:
            print(
                f"    {len(events)} events found, none matched attraction title list."
            )
            continue

        # Group by title for readable output.
        by_title: dict[str, int] = {}
        for e in matches:
            title = e.get("title") or "?"
            by_title[title] = by_title.get(title, 0) + 1

        action_label = "DRY RUN — would reclassify" if dry_run else "Reclassifying"
        print(
            f"    {action_label} {len(matches)} events as content_kind='exhibit':"
        )
        for title, count in sorted(by_title.items(), key=lambda x: -x[1]):
            print(f"      - \"{title}\" x{count}")

        if not dry_run:
            ids = [e["id"] for e in matches]
            # Batch updates in chunks of 100 to avoid URL length limits.
            for i in range(0, len(ids), 100):
                chunk = ids[i : i + 100]
                client.table("events").update({"content_kind": "exhibit"}).in_(
                    "id", chunk
                ).execute()
            logger.info(
                "Reclassified %d events as exhibit at %s", len(ids), venue_name
            )
            total_reclassified += len(ids)
        else:
            total_reclassified += len(matches)

    qualifier = "would reclassify" if dry_run else "reclassified"
    print(f"\n  Total {qualifier}: {total_reclassified} events as content_kind='exhibit'.")


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Phase 1 data remediation: AA/NA scoping, dead-domain sources, Stone Mountain attractions."
    )
    parser.add_argument(
        "--task",
        choices=["aa-na", "dead-domains", "stone-mountain", "all"],
        default="all",
        help="Which task to run (default: all)",
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Execute changes (default is dry-run — safe to run without this flag).",
    )
    args = parser.parse_args()

    dry_run = not args.apply

    if dry_run:
        print("=" * 60)
        print("DRY RUN MODE — no changes will be made.")
        print("Pass --apply to execute.")
        print("=" * 60)
        print()

    if args.task in ("aa-na", "all"):
        print("=== 1a. AA/NA Portal Scoping ===")
        verify_aa_na_portal_scoping()

    if args.task in ("dead-domains", "all"):
        print("\n=== 1d. Dead Domain Sources ===")
        deactivate_dead_domain_sources(dry_run=dry_run)

    if args.task in ("stone-mountain", "all"):
        print("\n=== 1e. Stone Mountain Attractions ===")
        remove_stone_mountain_attractions(dry_run=dry_run)
