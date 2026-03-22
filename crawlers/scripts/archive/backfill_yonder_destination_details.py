#!/usr/bin/env python3
"""
Backfill shared destination-details rows from existing Yonder seed metadata.

This controlled wave converts known Yonder campground / lake / trail seed
definitions into the shared venue_destination_details table instead of leaving
that richness trapped only on the venue row.

Usage:
    python3 scripts/backfill_yonder_destination_details.py
    python3 scripts/backfill_yonder_destination_details.py --apply
"""

from __future__ import annotations

import argparse
import logging
import os
import sys
from dataclasses import dataclass
from typing import Any, Optional

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config import set_database_target  # noqa: E402
from db import (  # noqa: E402
    configure_write_mode,
    get_venue_by_slug,
    upsert_venue_destination_details,
)
from scripts.seed_yonder_federal_backbone_wave2 import RIDB_TARGETS  # noqa: E402
from scripts.seed_yonder_public_land_campgrounds_wave1 import WAVE_1_CAMPGROUNDS  # noqa: E402
from scripts.seed_yonder_public_land_trails_wave3 import WAVE_3_TRAILS  # noqa: E402

logger = logging.getLogger(__name__)


@dataclass
class BackfillStats:
    candidates: int = 0
    persisted: int = 0
    missing_venues: int = 0
    skipped: int = 0


def _season_list(*names: str) -> list[str]:
    return [name for name in names if name]


def _build_detail_record(kind: str, seed: dict[str, Any]) -> dict[str, Any]:
    website = seed.get("website")
    planning_notes = seed.get("planning_notes")
    parking_note = seed.get("parking_note")

    metadata = {
        "backfill_source": "yonder_seed_destination_details_wave1",
        "seed_kind": kind,
        "seed_slug": seed["slug"],
    }

    if kind == "campground":
        return {
            "destination_type": "campground",
            "commitment_tier": "weekend",
            "primary_activity": "camping",
            "best_seasons": _season_list("spring", "summer", "fall"),
            "weather_fit_tags": ["outdoor", "warm-weather", "cool-weather"],
            "practical_notes": planning_notes,
            "parking_type": "free_lot",
            "reservation_required": bool(
                website and ("reserveamerica" in website or "recreation.gov" in website)
            ),
            "source_url": website,
            "metadata": metadata,
        }

    if kind == "lake":
        return {
            "destination_type": "lake",
            "commitment_tier": "halfday",
            "primary_activity": "lake recreation",
            "best_seasons": _season_list("spring", "summer", "fall"),
            "weather_fit_tags": ["outdoor", "warm-weather"],
            "practical_notes": planning_notes,
            "parking_type": "free_lot",
            "reservation_required": False,
            "source_url": website,
            "metadata": metadata,
        }

    if kind == "trail":
        notes = " ".join(part for part in [planning_notes, parking_note] if part).strip() or None
        return {
            "destination_type": "trail",
            "commitment_tier": "halfday",
            "primary_activity": "hiking",
            "best_seasons": _season_list("spring", "fall"),
            "weather_fit_tags": ["outdoor", "dry-weather", "cool-weather"],
            "practical_notes": notes,
            "parking_type": "free_lot",
            "dog_friendly": True,
            "source_url": website,
            "metadata": metadata,
        }

    raise ValueError(f"Unsupported seed kind: {kind}")


def iter_seed_records() -> list[tuple[str, dict[str, Any]]]:
    records: list[tuple[str, dict[str, Any]]] = []
    records.extend(("campground", seed) for seed in WAVE_1_CAMPGROUNDS)
    records.extend(
        (
            "lake",
            {
                "slug": slug,
                "website": config["website"],
                "planning_notes": config["planning_notes"],
            },
        )
        for slug, config in RIDB_TARGETS.items()
    )
    records.extend(("trail", seed) for seed in WAVE_3_TRAILS)
    return records


def backfill_destination_details(apply: bool) -> BackfillStats:
    configure_write_mode(apply, "" if apply else "dry-run")
    stats = BackfillStats()

    for kind, seed in iter_seed_records():
        stats.candidates += 1
        venue = get_venue_by_slug(seed["slug"])
        if not venue:
            stats.missing_venues += 1
            logger.warning("missing venue for destination_details backfill: %s", seed["slug"])
            continue

        record = _build_detail_record(kind, seed)
        persisted = upsert_venue_destination_details(venue["id"], record)
        if persisted:
            stats.persisted += 1
            logger.info(
                "%s destination_details: slug=%s venue_id=%s type=%s",
                "upserted" if apply else "would upsert",
                seed["slug"],
                venue["id"],
                kind,
            )
        else:
            stats.skipped += 1

    return stats


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Backfill shared destination_details from Yonder seed metadata.",
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Write to the active database target.",
    )
    parser.add_argument(
        "--db-target",
        choices=("production", "staging"),
        default="production",
        help="Database target to use.",
    )
    args = parser.parse_args()

    set_database_target(args.db_target)
    logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")

    stats = backfill_destination_details(apply=args.apply)
    logger.info(
        "[%s] candidates=%s persisted=%s missing_venues=%s skipped=%s",
        "APPLIED" if args.apply else "DRY RUN",
        stats.candidates,
        stats.persisted,
        stats.missing_venues,
        stats.skipped,
    )


if __name__ == "__main__":
    main()
