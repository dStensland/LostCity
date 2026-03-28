#!/usr/bin/env python3
"""
Clean up duplicate Atlanta activity venues by reassigning safe references and
deactivating duplicate shell rows.

Usage:
    python3 scripts/cleanup_duplicate_activity_venues.py
    python3 scripts/cleanup_duplicate_activity_venues.py --apply
"""

from __future__ import annotations

import argparse
import logging
import os
import sys
from typing import Any

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from db import get_client  # noqa: E402

logger = logging.getLogger(__name__)


DUPLICATE_VENUE_PLANS: list[dict[str, Any]] = [
    {
        "canonical_slug": "sparkles-family-fun-center-kennesaw",
        "duplicate_slug": "sparkles-kennesaw",
        "reassign": [
            ("events", "venue_id"),
        ],
    },
    {
        "canonical_slug": "puttshack-atlanta",
        "duplicate_slug": "puttshack",
        "reassign": [],
    },
    {
        "canonical_slug": "puttshack-atlanta",
        "duplicate_slug": "puttshack-atlanta-midtown",
        "reassign": [],
    },
]


VENUE_PATCHES: dict[str, dict[str, Any]] = {
    "puttshack-atlanta-dunwoody": {
        "place_type": "entertainment",
    }
}


def _get_venue(slug: str) -> dict[str, Any] | None:
    client = get_client()
    result = client.table("places").select("id,slug,name,active").eq("slug", slug).limit(1).execute()
    if result.data:
        return result.data[0]
    return None


def cleanup_duplicates(apply: bool = False) -> None:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
    client = get_client()

    for patch_slug, patch in VENUE_PATCHES.items():
        venue = _get_venue(patch_slug)
        if not venue:
            logger.warning("Patch target venue '%s' not found; skipping", patch_slug)
            continue
        if apply:
            client.table("places").update(patch).eq("id", venue["id"]).execute()
            logger.info("Updated %s (%s): %s", venue["name"], patch_slug, patch)
        else:
            logger.info("Would update %s (%s): %s", venue["name"], patch_slug, patch)

    for plan in DUPLICATE_VENUE_PLANS:
        canonical = _get_venue(plan["canonical_slug"])
        duplicate = _get_venue(plan["duplicate_slug"])
        if not canonical or not duplicate:
            logger.warning("Missing canonical or duplicate venue for plan %s", plan)
            continue

        logger.info(
            "Merging duplicate venue %s (%s) -> %s (%s)",
            duplicate["name"],
            duplicate["slug"],
            canonical["name"],
            canonical["slug"],
        )

        for table, column in plan["reassign"]:
            rows = client.table(table).select("id").eq(column, duplicate["id"]).execute().data or []
            if apply and rows:
                client.table(table).update({column: canonical["id"]}).eq(column, duplicate["id"]).execute()
            logger.info(
                "  %s %d %s rows",
                "reassigned" if apply else "would reassign",
                len(rows),
                table,
            )

        if apply:
            client.table("places").update({"is_active": False}).eq("id", duplicate["id"]).execute()
        logger.info("  %s duplicate venue row", "deactivated" if apply else "would deactivate")


def main() -> None:
    parser = argparse.ArgumentParser(description="Clean up duplicate Atlanta activity venues")
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Persist changes to the database (default is dry-run mode)",
    )
    args = parser.parse_args()
    cleanup_duplicates(apply=args.apply)


if __name__ == "__main__":
    main()
