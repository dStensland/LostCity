#!/usr/bin/env python3
"""
Apply targeted venue metadata fixes discovered during the Atlanta activity quality audit.

Usage:
    python3 scripts/fix_atlanta_activity_quality_metadata.py
    python3 scripts/fix_atlanta_activity_quality_metadata.py --apply
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


VENUE_METADATA_FIXES: dict[str, dict[str, Any]] = {
    "andretti-marietta": {
        "website": "https://www.andrettikarting.com/marietta/",
    },
    "atlanta-history-center": {
        "website": "https://www.atlantahistorycenter.com/",
    },
    "delta-flight-museum": {
        "website": "https://www.deltamuseum.org/",
    },
    "fernbank-science-center": {
        "website": "https://www.fernbank.edu",
    },
    "georgia-aquarium": {
        "website": "https://www.georgiaaquarium.org",
    },
    "high-museum-of-art": {
        "website": "https://www.high.org",
    },
    "main-event-alpharetta": {
        "website": "https://www.mainevent.com/locations/georgia/alpharetta/",
    },
    "main-event-atlanta": {
        "place_type": "entertainment",
        "website": "https://www.mainevent.com/locations/georgia/atlanta/",
    },
    "main-event-sandy-springs": {
        "website": "https://www.mainevent.com/locations/georgia/atlanta/",
    },
    "metro-fun-center": {
        "website": "https://metrofuncenter.com/",
    },
    "sky-zone-atlanta": {
        "website": "https://www.skyzone.com/atlanta",
    },
    "sparkles-family-fun-center-kennesaw": {
        "place_type": "games",
    },
    "sparkles-kennesaw": {
        "place_type": "games",
    },
    "stars-and-strikes-cumming": {
        "place_type": "games",
    },
    "stars-and-strikes-dacula": {
        "place_type": "games",
    },
    "world-of-coca-cola": {
        "website": "https://www.worldofcoca-cola.com",
    },
}


def apply_metadata_fixes(apply: bool = False) -> int:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
    client = get_client()
    updated = 0

    for slug, patch in VENUE_METADATA_FIXES.items():
        venue_res = (
            client.table("places")
            .select("id,slug,name,place_type,website")
            .eq("slug", slug)
            .limit(1)
            .execute()
        )
        if not venue_res.data:
            logger.warning("Venue slug '%s' not found; skipping", slug)
            continue

        venue = venue_res.data[0]
        changes = {
            field: value
            for field, value in patch.items()
            if venue.get(field) != value
        }
        if not changes:
            logger.info("%s (%s): already clean", venue["name"], slug)
            continue

        if apply:
            client.table("places").update(changes).eq("id", venue["id"]).execute()
            logger.info("Updated %s (%s): %s", venue["name"], slug, changes)
        else:
            logger.info("Would update %s (%s): %s", venue["name"], slug, changes)
        updated += 1

    mode = "APPLIED" if apply else "DRY RUN"
    logger.info("[%s] Processed %d venue metadata fixes", mode, updated)
    return updated


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Apply targeted venue metadata fixes for the Atlanta activity layer"
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Persist changes to the database (default is dry-run mode)",
    )
    args = parser.parse_args()
    apply_metadata_fixes(apply=args.apply)


if __name__ == "__main__":
    main()
