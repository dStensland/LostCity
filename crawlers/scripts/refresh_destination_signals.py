#!/usr/bin/env python3
"""
Refresh destination-facing venue signals for targeted source or venue slugs.

This is a surgical alternative to rerunning a full crawl when we want to push
specials and planning-note quality after crawler improvements.

Examples:
  python3 scripts/refresh_destination_signals.py --source-slug midway-pub --force
  python3 scripts/refresh_destination_signals.py --source-slug the-earl --planning --apply
  python3 scripts/refresh_destination_signals.py --venue-slug the-vortex --specials --apply
"""

from __future__ import annotations

import argparse
import os
import sys
from dataclasses import dataclass
from importlib import import_module
from pathlib import Path
from typing import Optional

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config import set_database_target  # noqa: E402
from db import get_client  # noqa: E402
from db.client import configure_write_mode  # noqa: E402
from main import get_source_modules  # noqa: E402
from source_destination_sync import (  # noqa: E402
    ensure_venue_destination_fields,
    refresh_venue_specials_from_website,
)


@dataclass
class Target:
    source_slug: Optional[str]
    venue_id: int
    venue_slug: str
    venue_name: str
    planning_notes: Optional[str] = None
    description: Optional[str] = None
    short_description: Optional[str] = None
    image_url: Optional[str] = None


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Refresh destination-facing venue signals for targeted venues."
    )
    parser.add_argument(
        "--source-slug",
        action="append",
        default=[],
        help="Source slug(s) to refresh. Can be repeated or comma-separated.",
    )
    parser.add_argument(
        "--venue-slug",
        action="append",
        default=[],
        help="Venue slug(s) to refresh directly. Can be repeated or comma-separated.",
    )
    parser.add_argument(
        "--specials",
        action="store_true",
        help="Refresh venue-site specials and related destination metadata.",
    )
    parser.add_argument(
        "--planning",
        action="store_true",
        help="Refresh planning notes and destination copy from source module constants.",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Ignore freshness checks and overwrite eligible destination fields.",
    )
    parser.add_argument(
        "--include-social-bios",
        action="store_true",
        help="Include social bio scraping in specials refresh.",
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Write changes to the configured DB target. Default is dry-run.",
    )
    parser.add_argument(
        "--db-target",
        choices=["production", "staging"],
        default=os.getenv("CRAWLER_DB_TARGET", "production").strip().lower(),
        help="Database target (default: CRAWLER_DB_TARGET or production).",
    )
    return parser.parse_args()


def _normalize_values(values: list[str]) -> list[str]:
    normalized: list[str] = []
    for value in values:
        for part in value.split(","):
            slug = part.strip()
            if slug:
                normalized.append(slug)
    return sorted(set(normalized))


def _venue_rows_by_slug(venue_slugs: list[str]) -> dict[str, dict]:
    if not venue_slugs:
        return {}
    rows = (
        get_client()
        .table("places")
        .select("id,slug,name")
        .in_("slug", venue_slugs)
        .execute()
        .data
        or []
    )
    return {row["slug"]: row for row in rows}


def _target_from_source_slug(source_slug: str) -> Optional[Target]:
    modules = get_source_modules()
    module_path = modules.get(source_slug)
    if not module_path:
        print(f"Warning: unknown source slug {source_slug}")
        return None

    module = import_module(module_path)
    place_data = getattr(module, "PLACE_DATA", None) or {}
    venue_slug = place_data.get("slug") or source_slug
    venue_name = place_data.get("name") or source_slug
    venue_rows = _venue_rows_by_slug([venue_slug])
    venue_row = venue_rows.get(venue_slug)
    if not venue_row:
        print(f"Warning: no venue row found for source {source_slug} (venue slug {venue_slug})")
        return None

    return Target(
        source_slug=source_slug,
        venue_id=venue_row["id"],
        venue_slug=venue_row["slug"],
        venue_name=venue_row["name"],
        planning_notes=getattr(module, "PLANNING_NOTE", None),
        description=getattr(module, "VENUE_DESCRIPTION", None),
        short_description=getattr(module, "SHORT_DESCRIPTION", None),
        image_url=getattr(module, "IMAGE_URL", None),
    )


def _targets_from_venue_slugs(venue_slugs: list[str]) -> list[Target]:
    rows = _venue_rows_by_slug(venue_slugs)
    targets: list[Target] = []
    for slug in venue_slugs:
        row = rows.get(slug)
        if not row:
            print(f"Warning: unknown venue slug {slug}")
            continue
        targets.append(
            Target(
                source_slug=None,
                venue_id=row["id"],
                venue_slug=row["slug"],
                venue_name=row["name"],
            )
        )
    return targets


def _print_target_header(target: Target) -> None:
    label = target.source_slug or target.venue_slug
    print(f"\n[{label}] {target.venue_name} ({target.venue_slug})")


def main() -> None:
    args = _parse_args()
    source_slugs = _normalize_values(args.source_slug)
    venue_slugs = _normalize_values(args.venue_slug)

    if not source_slugs and not venue_slugs:
        print("Provide at least one --source-slug or --venue-slug.")
        sys.exit(1)

    do_specials = args.specials or not args.planning
    do_planning = args.planning

    set_database_target(args.db_target)
    configure_write_mode(args.apply, reason="refresh_destination_signals dry-run")

    targets: list[Target] = []
    for source_slug in source_slugs:
        target = _target_from_source_slug(source_slug)
        if target:
            targets.append(target)
    targets.extend(_targets_from_venue_slugs(venue_slugs))

    if not targets:
        print("No valid targets found.")
        return

    seen: set[tuple[Optional[str], int]] = set()
    unique_targets: list[Target] = []
    for target in targets:
        key = (target.source_slug, target.venue_id)
        if key in seen:
            continue
        seen.add(key)
        unique_targets.append(target)

    print(
        f"Refreshing {len(unique_targets)} target(s) "
        f"on {args.db_target} | writes={'enabled' if args.apply else 'disabled'}"
    )

    specials_attempted = 0
    specials_added = 0
    planning_attempted = 0
    planning_updated = 0

    for target in unique_targets:
        _print_target_header(target)

        if do_specials:
            specials_attempted += 1
            stats = refresh_venue_specials_from_website(
                target.venue_id,
                force=args.force,
                include_social_bios=args.include_social_bios,
            )
            specials_added += int(stats.get("specials_added", 0) or 0)
            print(f"  specials: {stats}")

        if do_planning:
            if not any(
                value
                for value in (
                    target.planning_notes,
                    target.description,
                    target.short_description,
                    target.image_url,
                )
            ):
                print("  planning: skipped (no source-owned destination fields)")
                continue

            planning_attempted += 1
            updated = ensure_venue_destination_fields(
                target.venue_id,
                planning_notes=target.planning_notes,
                description=target.description,
                short_description=target.short_description,
                image_url=target.image_url,
                force=args.force,
            )
            planning_updated += int(updated)
            print(f"  planning: {'updated' if updated else 'no-op'}")

    print("\nSummary")
    print(f"  specials attempted: {specials_attempted}")
    print(f"  specials added:     {specials_added}")
    print(f"  planning attempted: {planning_attempted}")
    print(f"  planning updated:   {planning_updated}")


if __name__ == "__main__":
    main()
