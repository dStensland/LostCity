#!/usr/bin/env python3
"""
Migrate existing content_kind='exhibit' events to venue_features rows.

Backfills venue features from exhibit events at Stone Mountain Park and
Chattahoochee Nature Center. Does NOT delete the exhibit events — they're
already hidden from feeds via content_kind filtering.

Usage:
    python3 scripts/migrate_exhibits_to_features.py          # dry-run
    python3 scripts/migrate_exhibits_to_features.py --apply  # commit writes
"""

from __future__ import annotations

import argparse
import logging
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from db import get_client, upsert_venue_feature, venues_support_features_table, configure_write_mode

logger = logging.getLogger(__name__)

# Venue slugs to migrate
TARGET_VENUES = [
    "stone-mountain-park",
    "chattahoochee-nature-center",
]

# Map venue slug → default feature_type for its exhibits
_VENUE_DEFAULT_FEATURE_TYPE: dict[str, str] = {
    "stone-mountain-park": "attraction",
    "chattahoochee-nature-center": "amenity",
}


def migrate(apply: bool = False) -> None:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")

    if not venues_support_features_table():
        logger.error("venue_features table does not exist. Run migration 275_venue_features.sql first.")
        return

    configure_write_mode(apply, "" if apply else "dry-run")

    client = get_client()
    total_upserted = 0

    for venue_slug in TARGET_VENUES:
        # Look up venue
        venue_res = (
            client.table("places")
            .select("id, name, place_type")
            .eq("slug", venue_slug)
            .limit(1)
            .execute()
        )
        if not venue_res.data:
            logger.warning("Venue '%s' not found, skipping", venue_slug)
            continue

        venue = venue_res.data[0]
        venue_id = venue["id"]
        venue_name = venue["name"]
        default_type = _VENUE_DEFAULT_FEATURE_TYPE.get(venue_slug, "attraction")

        # Fetch exhibit events for this venue
        exhibit_res = (
            client.table("events")
            .select("title, description, image_url")
            .eq("place_id", venue_id)
            .eq("content_kind", "exhibit")
            .execute()
        )

        if not exhibit_res.data:
            logger.info("No exhibit events at '%s', skipping", venue_name)
            continue

        # Dedupe by title (take first occurrence)
        seen_titles: set[str] = set()
        unique_features: list[dict] = []
        for event in exhibit_res.data:
            title_key = (event.get("title") or "").strip().lower()
            if title_key in seen_titles or not title_key:
                continue
            seen_titles.add(title_key)
            unique_features.append(event)

        logger.info(
            "%s: %d exhibit events → %d unique features",
            venue_name,
            len(exhibit_res.data),
            len(unique_features),
        )

        for i, feat in enumerate(unique_features):
            title = (feat.get("title") or "").strip()
            result = upsert_venue_feature(venue_id, {
                "title": title,
                "feature_type": default_type,
                "description": feat.get("description"),
                "image_url": feat.get("image_url"),
                "sort_order": i,
            })
            action = "upserted" if apply else "would upsert"
            logger.info("  %s: '%s' (id=%s)", action, title, result)
            total_upserted += 1

    mode = "APPLIED" if apply else "DRY RUN"
    logger.info("[%s] Total features processed: %d", mode, total_upserted)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Migrate exhibit events to venue_features")
    parser.add_argument("--apply", action="store_true", help="Commit writes (default: dry-run)")
    args = parser.parse_args()
    migrate(apply=args.apply)
