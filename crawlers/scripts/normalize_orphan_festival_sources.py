#!/usr/bin/env python3
"""
Normalize sources incorrectly typed as festivals.

An orphan festival source is:
- source_type='festival'
- no matching festivals.slug

These are not valid structural festival containers. Reclassify them to
organization sources and tag explicitly so audits and scaffolding keep them
out of auto-crawler pipelines unless rebuilt intentionally.

Usage:
  python scripts/normalize_orphan_festival_sources.py --dry-run
  python scripts/normalize_orphan_festival_sources.py --apply
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from db import get_client

DEMOTION_TAGS = {
    "festival-model-cleanup",
    "not-in-festivals-table",
    "retyped-from-festival",
}


def _merge_tags(existing: list[str] | None) -> list[str]:
    tags = set(existing or [])
    tags.update(DEMOTION_TAGS)
    return sorted(tags)


def main() -> None:
    parser = argparse.ArgumentParser(description="Normalize orphan festival source rows")
    parser.add_argument("--apply", action="store_true", help="Write updates")
    parser.add_argument("--dry-run", action="store_true", help="Print updates only (default)")
    args = parser.parse_args()

    if not args.apply and not args.dry_run:
        args.dry_run = True

    client = get_client()
    festival_slugs = {
        row["slug"]
        for row in (client.table("festivals").select("slug").execute().data or [])
        if row.get("slug")
    }
    rows = (
        client.table("sources")
        .select("id,slug,name,is_active,source_type,integration_method,health_tags")
        .eq("source_type", "festival")
        .execute()
        .data
        or []
    )

    targets: list[dict[str, Any]] = [r for r in rows if r.get("slug") not in festival_slugs]
    print(f"ORPHAN_FESTIVAL_SOURCE_TARGETS {len(targets)}")

    updates = 0
    active_targets = 0
    inactive_targets = 0
    for row in sorted(targets, key=lambda r: r["slug"]):
        patch = {
            "source_type": "organization",
            "health_tags": _merge_tags(row.get("health_tags")),
        }
        if row.get("is_active"):
            active_targets += 1
        else:
            inactive_targets += 1
        print(
            f"[normalize] {row['slug']} (active={row.get('is_active')}) "
            f"-> source_type=organization tags={patch['health_tags']}"
        )
        if args.apply:
            client.table("sources").update(patch).eq("id", row["id"]).execute()
            updates += 1

    print(f"\nSUMMARY updates={updates} active_targets={active_targets} inactive_targets={inactive_targets}")
    if args.dry_run:
        print("Dry run only; no DB writes.")


if __name__ == "__main__":
    main()
