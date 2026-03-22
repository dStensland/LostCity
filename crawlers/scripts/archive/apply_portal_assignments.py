#!/usr/bin/env python3
"""
Assign source owner portals and backfill NULL portal_id on future events.

Usage:
  python3 scripts/apply_portal_assignments.py --dry-run
  python3 scripts/apply_portal_assignments.py
"""

from __future__ import annotations

import argparse
import os
import sys
from collections import Counter
from datetime import date

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from db import get_client, get_portal_id_by_slug


SOURCE_PORTAL_SLUG_MAP: dict[str, str] = {
    # Top Atlanta leakage sources
    "mobilize-api": "atlanta",
    "painting-with-a-twist": "atlanta",
    "roswell365": "atlanta",
    "atlanta-city-meetings": "atlanta",
    "instagram-captions": "atlanta",
    "sister-louisas": "atlanta",
    "callanwolde-fine-arts-center": "atlanta",
    "aso": "atlanta",
    "dark-horse-tavern": "atlanta",
    "gwinnett-stripers": "atlanta",
    "atlanta-city-events": "atlanta",
    "wild-bills": "atlanta",
    "velvet-note": "atlanta",
    "ormsbys": "atlanta",
    "chastain-park-amphitheatre": "atlanta",
    "lifeline-animal-project": "atlanta",
    "ten-atlanta": "atlanta",
    "havana-club": "atlanta",
    "chattahoochee-riverkeeper": "atlanta",
    "pullman-yards": "atlanta",
    "manual-holiday-events": "atlanta",
    "atlanta-gladiators": "atlanta",
    "drepung-loseling-monastery": "atlanta",
    "sister-louisas-church": "atlanta",
    "our-bar-atl": "atlanta",
    "atlanta-humane-society": "atlanta",
    "concerts-at-first": "atlanta",
    "grant-park-conservancy": "atlanta",
    "lwv-atlanta": "atlanta",
    "block-and-drum": "atlanta",
    "civic-innovation-atl": "atlanta",
    "terminus-mbt": "atlanta",
    "peachtree-road-umc": "atlanta",
    "paws-atlanta": "atlanta",
    "ncg-cinemas-atlanta": "atlanta",
    "ellis-station-candle-co": "atlanta",
    "all-star-monster-trucks": "atlanta",
    "dekalb-county-meetings": "atlanta",
    "brick-store-pub": "atlanta",
    "second-helpings-atlanta": "atlanta",
    "fulton-county-meetings": "atlanta",
    "wrecking-bar": "atlanta",
    "monday-night-garage": "atlanta",
    "furkids": "atlanta",
    # Support portal sources
    "na-georgia": "atlanta-support",
    "ridgeview-institute": "atlanta-support",
    "griefshare-atlanta": "atlanta-support",
    "dbsa-atlanta": "atlanta-support",
    "medshare": "atlanta-support",
    "northside-hospital-community": "atlanta-support",
    # Atlanta support portal - core crawler-backed health/community sources
    "atlanta-community-food-bank": "atlanta-support",
    "ymca-atlanta": "atlanta-support",
    "nami-georgia": "atlanta-support",
    "good-samaritan-health-center": "atlanta-support",
    "dekalb-public-health": "atlanta-support",
    "fulton-board-health": "atlanta-support",
    "northside-health-fairs": "atlanta-support",
    "aid-atlanta": "atlanta-support",
    "positive-impact-health": "atlanta-support",
    "grady-health": "atlanta-support",
    "health-walks-atlanta": "atlanta-support",
    "shepherd-center": "atlanta-support",
    "cancer-support-community-atlanta": "atlanta-support",
    "acs-georgia": "atlanta-support",
    "winship-cancer-institute": "atlanta-support",
    "atlanta-cancer-care-foundation": "atlanta-support",
    "colorectal-cancer-alliance": "atlanta-support",
    "georgia-ovarian-cancer": "atlanta-support",
    "cure-childhood-cancer": "atlanta-support",
    "healthy-mothers-ga": "atlanta-support",
    "piedmont-healthcare": "atlanta-support",
    "piedmonthealthcare-events": "atlanta-support",
    "piedmont-classes": "atlanta-support",
    "piedmont-heart-conferences": "atlanta-support",
    "piedmont-womens-heart": "atlanta-support",
    "piedmont-transplant": "atlanta-support",
    "piedmont-fitness": "atlanta-support",
    "piedmont-cme": "atlanta-support",
    "adventhealth-georgia": "atlanta-support",
    # Atlanta support portal - additional high-value crawlers now implemented
    "open-hand-atlanta": "atlanta-support",
    "community-farmers-markets": "atlanta-support",
    "atlanta-legal-aid": "atlanta-support",
    "worksource-atlanta": "atlanta-support",
    "irc-atlanta": "atlanta-support",
    "choa-community-events": "atlanta-support",
    "camp-twin-lakes": "atlanta-support",
    "georgia-transplant-foundation": "atlanta-support",
    "american-lung-georgia": "atlanta-support",
    "hands-on-atlanta": "atlanta-support",
    "meals-on-wheels-atlanta": "atlanta-support",
    "hosea-helps": "atlanta-support",
    "mha-georgia": "atlanta-support",
    "skyland-trail": "atlanta-support",
    "park-pride": "atlanta-support",
    "mercy-care": "atlanta-support",
    "va-atlanta": "atlanta-support",
    "goodwill-north-ga": "atlanta-support",
    "komen-atlanta": "atlanta-support",
    "lls-georgia": "atlanta-support",
    # Atlanta support portal - observed slug variants
    "fulton-county-board-of-health": "atlanta-support",
    "northside-hospital": "atlanta-support",
    "northside-hospital-atlanta": "atlanta-support",
    "adventhealth-gordon": "atlanta-support",
    "piedmont-healthcare-nc": "atlanta-support",
    "piedmont-healthcare-cme": "atlanta-support",
    "mercy-care-atlanta": "atlanta-support",
}


def _load_portal_ids() -> dict[str, str]:
    portal_ids: dict[str, str] = {}
    required_portals = sorted(set(SOURCE_PORTAL_SLUG_MAP.values()))
    for portal_slug in required_portals:
        pid = get_portal_id_by_slug(portal_slug)
        if not pid:
            raise RuntimeError(f"Portal slug '{portal_slug}' not found")
        portal_ids[portal_slug] = pid
    return portal_ids


def _count_unassigned_future_by_source(client, today: str) -> Counter:
    counts: Counter = Counter()
    page = 0
    while True:
        rows = (
            client.table("events")
            .select("source_id")
            .gte("start_date", today)
            .is_("portal_id", "null")
            .range(page * 1000, page * 1000 + 999)
            .execute()
            .data
            or []
        )
        for row in rows:
            sid = row.get("source_id")
            if sid is not None:
                counts[sid] += 1
        if len(rows) < 1000:
            break
        page += 1
    return counts


def apply_assignments(dry_run: bool) -> None:
    client = get_client()
    today = str(date.today())
    portal_ids = _load_portal_ids()

    print("Applying owner_portal_id assignments")
    print(f"  Dry run: {dry_run}")
    print(f"  Date floor for event backfill: {today}")

    updated_sources = 0
    skipped_sources = 0

    for source_slug, portal_slug in SOURCE_PORTAL_SLUG_MAP.items():
        target_portal_id = portal_ids[portal_slug]
        source_rows = (
            client.table("sources")
            .select("id,slug,name,owner_portal_id")
            .eq("slug", source_slug)
            .limit(1)
            .execute()
            .data
            or []
        )
        if not source_rows:
            print(f"  [skip] source missing: {source_slug}")
            skipped_sources += 1
            continue

        source = source_rows[0]
        if source.get("owner_portal_id") == target_portal_id:
            print(f"  [ok] {source_slug} already owned by {portal_slug}")
            continue

        if not dry_run:
            (
                client.table("sources")
                .update({"owner_portal_id": target_portal_id})
                .eq("id", source["id"])
                .execute()
            )
        print(
            f"  [set] {source_slug} owner_portal_id -> {portal_slug}"
        )
        updated_sources += 1

    unassigned_by_source = _count_unassigned_future_by_source(client, today)
    if not unassigned_by_source:
        print("\nNo future events with NULL portal_id found.")
        return

    source_ids = sorted(unassigned_by_source.keys())
    source_lookup = {}
    for i in range(0, len(source_ids), 100):
        batch = source_ids[i : i + 100]
        rows = (
            client.table("sources")
            .select("id,slug,name,owner_portal_id")
            .in_("id", batch)
            .execute()
            .data
            or []
        )
        for row in rows:
            source_lookup[row["id"]] = row

    total_to_backfill = 0
    sources_backfilled = 0

    print("\nBackfilling future events with NULL portal_id")
    for source_id, null_count in sorted(
        unassigned_by_source.items(), key=lambda item: item[1], reverse=True
    ):
        source = source_lookup.get(source_id)
        if not source:
            continue
        owner_portal_id = source.get("owner_portal_id")
        if not owner_portal_id:
            continue

        if not dry_run:
            (
                client.table("events")
                .update({"portal_id": owner_portal_id})
                .eq("source_id", source_id)
                .gte("start_date", today)
                .is_("portal_id", "null")
                .execute()
            )

        total_to_backfill += null_count
        sources_backfilled += 1
        print(
            f"  [backfill] {source.get('slug')} -> {null_count} future events"
        )

    remaining_after = _count_unassigned_future_by_source(client, today) if not dry_run else Counter()
    remaining_total = sum(remaining_after.values()) if not dry_run else None

    print("\nSummary")
    print(f"  Sources updated: {updated_sources}")
    print(f"  Sources skipped (missing): {skipped_sources}")
    print(f"  Sources backfilled: {sources_backfilled}")
    print(f"  Future events targeted for backfill: {total_to_backfill}")
    if remaining_total is not None:
        print(f"  Remaining future NULL portal_id: {remaining_total}")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Assign source owner portals and backfill NULL event portal_id."
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show planned changes without writing to the database.",
    )
    args = parser.parse_args()
    apply_assignments(dry_run=args.dry_run)


if __name__ == "__main__":
    main()
