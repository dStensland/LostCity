#!/usr/bin/env python3
"""
Tag inactive festival source rows that are structural containers.

Structural container criteria:
- source_type='festival'
- source is inactive
- slug exists in festivals table
- no dedicated crawler module for slug
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
from main import get_source_modules

STRUCTURAL_TAGS = {"festival-structural", "no-standalone-crawler"}


def _merge_tags(existing: list[str] | None) -> list[str]:
    tags = set(existing or [])
    tags.update(STRUCTURAL_TAGS)
    return sorted(tags)


def main() -> None:
    parser = argparse.ArgumentParser(description="Tag structural festival source rows")
    parser.add_argument("--apply", action="store_true", help="Write updates")
    parser.add_argument("--dry-run", action="store_true", help="Print updates only (default)")
    args = parser.parse_args()

    if not args.apply and not args.dry_run:
        args.dry_run = True

    client = get_client()
    module_slugs = set(get_source_modules().keys())
    festival_slugs = {
        row["slug"]
        for row in (client.table("festivals").select("slug").execute().data or [])
        if row.get("slug")
    }

    rows = (
        client.table("sources")
        .select("id,slug,name,is_active,source_type,integration_method,health_tags")
        .eq("is_active", False)
        .eq("source_type", "festival")
        .execute()
        .data
        or []
    )

    targets: list[dict[str, Any]] = []
    for row in rows:
        slug = row["slug"]
        if slug not in festival_slugs:
            continue
        if slug in module_slugs:
            continue
        targets.append(row)

    print(f"STRUCTURAL_FESTIVAL_TARGETS {len(targets)}")
    updates = 0
    for row in sorted(targets, key=lambda r: r["slug"]):
        merged_tags = _merge_tags(row.get("health_tags"))
        patch: dict[str, Any] = {"health_tags": merged_tags}
        if not row.get("integration_method"):
            patch["integration_method"] = "festival_schedule"
        print(f"[tag] {row['slug']} -> {patch}")
        if args.apply:
            client.table("sources").update(patch).eq("id", row["id"]).execute()
            updates += 1

    print(f"\nSUMMARY updates={updates}")
    if args.dry_run:
        print("Dry run only; no DB writes.")


if __name__ == "__main__":
    main()
