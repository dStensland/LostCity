#!/usr/bin/env python3
"""
Scaffold profile-based crawler targets from inactive no-module sources.

This script intentionally excludes:
- Festival container rows (source_type=festival)
- Slugs that already exist in festivals table
- Internal/manual submission sources

Usage:
  python scripts/scaffold_inactive_crawler_targets.py --dry-run
  python scripts/scaffold_inactive_crawler_targets.py --apply
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from db import get_client
from main import get_source_modules
from pipeline.loader import find_profile_path

INTERNAL_SOURCE_TYPES = {"manual", "user", "website", "social_media"}


def _yaml_quote(value: str | None) -> str:
    return json.dumps(value or "")


def _is_internal_source(source: dict[str, Any]) -> bool:
    source_type = (source.get("source_type") or "").lower()
    url = (source.get("url") or "").lower()
    return source_type in INTERNAL_SOURCE_TYPES or "lostcity" in url


def _is_candidate(source: dict[str, Any], module_slugs: set[str], festival_slugs: set[str]) -> bool:
    slug = source["slug"]
    source_type = (source.get("source_type") or "").lower()

    if source.get("is_active"):
        return False
    if slug in module_slugs:
        return False
    if source_type == "festival":
        return False
    if _is_internal_source(source):
        return False
    # Guard against mis-modeled festival records (e.g. type=organization with festival slug).
    if slug in festival_slugs:
        return False
    return True


def _profile_text(source: dict[str, Any]) -> str:
    slug = source["slug"]
    name = source.get("name") or slug
    url = source.get("url") or ""
    source_type = (source.get("source_type") or "").lower()
    method = (source.get("integration_method") or "").lower()

    render_js = method in {"playwright", "crawler"}
    integration_method = source.get("integration_method") or "llm_crawler"
    venue_name = name if source_type in {"venue", "venue_calendar"} else None

    lines = [
        "version: 1",
        f"slug: {slug}",
        f"name: {_yaml_quote(name)}",
        f"integration_method: {integration_method}",
        "data_goals:",
        "  - events",
        "discovery:",
        "  enabled: true",
        "  type: html",
        "  urls:",
        f"    - {_yaml_quote(url)}",
        "  fetch:",
        f"    render_js: {'true' if render_js else 'false'}",
        "detail:",
        "  enabled: true",
        "  use_jsonld: true",
        "  use_open_graph: true",
        "  use_heuristic: true",
        "  use_llm: true",
    ]

    if venue_name:
        lines.extend(
            [
                "defaults:",
                f"  venue_name: {_yaml_quote(venue_name)}",
            ]
        )

    lines.append("")
    return "\n".join(lines)


def main() -> None:
    parser = argparse.ArgumentParser(description="Scaffold profiles for inactive crawler targets")
    parser.add_argument("--apply", action="store_true", help="Write profile files")
    parser.add_argument("--dry-run", action="store_true", help="Print actions without writing (default)")
    parser.add_argument("--limit", type=int, default=0, help="Limit number of sources processed")
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
        .select("id,slug,name,url,source_type,integration_method,is_active")
        .eq("is_active", False)
        .execute()
        .data
        or []
    )
    candidates = [r for r in rows if _is_candidate(r, module_slugs, festival_slugs)]
    candidates.sort(key=lambda r: r["slug"])
    if args.limit > 0:
        candidates = candidates[: args.limit]

    created = 0
    skipped_existing = 0

    print(f"CANDIDATES {len(candidates)}")
    for source in candidates:
        slug = source["slug"]
        existing = find_profile_path(slug)
        if existing:
            skipped_existing += 1
            print(f"[exists] {slug} -> {existing.name}")
            continue

        profile_path = ROOT / "sources" / "profiles" / f"{slug}.yaml"
        text = _profile_text(source)
        if args.apply:
            profile_path.parent.mkdir(parents=True, exist_ok=True)
            profile_path.write_text(text, encoding="utf-8")
            created += 1
            print(f"[write] {slug} -> {profile_path.name}")
        else:
            print(f"[plan]  {slug} -> {profile_path.name}")

    print(f"\nSUMMARY created={created} skipped_existing={skipped_existing}")
    if args.dry_run:
        print("Dry run only; no files written.")


if __name__ == "__main__":
    main()
