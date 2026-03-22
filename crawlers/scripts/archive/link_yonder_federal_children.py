#!/usr/bin/env python3
"""
Attach obvious campground child rows to Yonder's federal parent anchors.

This keeps the public-land graph from flattening into unrelated point rows once
federal parent anchors are seeded.

Usage:
    cd /Users/coach/Projects/LostCity/crawlers
    python3 scripts/link_yonder_federal_children.py
    python3 scripts/link_yonder_federal_children.py --apply
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / ".env")
sys.path.insert(0, str(ROOT))

from db import get_client, get_venue_by_slug

PARENT_CHILDREN: dict[str, list[str]] = {
    "cumberland-island-national-seashore": [
        "brickhill-bluff-campground",
        "hickory-hill-wilderness-campsite",
        "sea-camp-campground",
        "stafford-beach-campground",
        "yankee-paradise-wilderness-campsite",
    ],
    "lake-sidney-lanier": [
        "old-federal-campground",
        "bolding-mill-campground",
        "bolding-mill-shelters-ga",
        "toto-creek-campground",
        "ducket-mill",
    ],
    "chattahoochee-oconee-national-forest": [
        "bear-creek-campground",
        "cooper-creek-recreation-area",
        "deep-hole-recreation-area",
        "dockery-lake-campground",
        "lake-winfield-scott-campground",
        "the-pocket-campground",
        "upper-stamp-creek-campground",
        "desoto-falls-campground",
        "mulky-campground",
        "frank-gross-recreation-area",
        "lake-conasauga-campground",
        "lake-conasauga-overflow-campground",
        "hickey-gap-forest-service-camping-area",
    ],
}


def main() -> None:
    parser = argparse.ArgumentParser(description="Attach federal child rows for Yonder.")
    parser.add_argument("--apply", action="store_true", help="Write parent_venue_id changes.")
    parser.add_argument(
        "--refresh-existing",
        action="store_true",
        help="Reassign children even if they already have a parent.",
    )
    args = parser.parse_args()

    client = get_client()
    linked = 0
    skipped = 0
    missing = 0

    print("=" * 72)
    print("Link Yonder Federal Children")
    print("=" * 72)
    print(f"Mode: {'apply' if args.apply else 'dry-run'}")
    print(f"Refresh existing: {args.refresh_existing}")
    print("")

    for parent_slug, child_slugs in PARENT_CHILDREN.items():
        parent = get_venue_by_slug(parent_slug)
        if not parent:
            print(f"MISS parent: {parent_slug}")
            missing += len(child_slugs)
            continue
        for child_slug in child_slugs:
            child = get_venue_by_slug(child_slug)
            if not child:
                print(f"MISS child: {child_slug}")
                missing += 1
                continue
            current_parent = child.get("parent_venue_id")
            if current_parent and not args.refresh_existing:
                print(f"KEEP child: {child_slug} (already linked)")
                skipped += 1
                continue
            if current_parent == parent["id"]:
                print(f"KEEP child: {child_slug} (already linked to {parent_slug})")
                skipped += 1
                continue
            if args.apply:
                client.table("venues").update({"parent_venue_id": parent["id"]}).eq("id", child["id"]).execute()
            print(
                f"{'LINK' if args.apply else 'WOULD LINK'} child: {child_slug} -> {parent_slug}"
            )
            linked += 1

    print("")
    print(f"Summary: linked={linked} skipped={skipped} missing={missing}")


if __name__ == "__main__":
    main()
