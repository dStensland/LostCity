#!/usr/bin/env python3
"""
Generate profile stubs for sources missing in crawlers/sources/profiles.

Usage:
  python scripts/generate_profile_stubs.py --dry-run
  python scripts/generate_profile_stubs.py --apply
  python scripts/generate_profile_stubs.py --apply --limit 50
  python scripts/generate_profile_stubs.py --apply --slugs the-earl ticketmaster
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Iterable

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from db import get_client


PROFILE_DIR = ROOT / "sources" / "profiles"
PROFILE_EXTS = (".json", ".yaml", ".yml")


def _yaml_quote(value: str) -> str:
    return json.dumps(value)


def _existing_profile_slugs() -> set[str]:
    slugs: set[str] = set()
    for ext in PROFILE_EXTS:
        for path in PROFILE_DIR.glob(f"*{ext}"):
            slugs.add(path.stem)
    return slugs


def _fetch_sources() -> list[dict]:
    client = get_client()
    result = (
        client.table("sources")
        .select("id, slug, name, url")
        .order("slug")
        .execute()
    )
    return result.data or []


def _build_stub(source: dict) -> str:
    slug = source.get("slug") or ""
    name = source.get("name") or slug
    url = source.get("url") or ""

    return "\n".join(
        [
            "version: 1",
            f"slug: {slug}",
            f"name: {_yaml_quote(name)}",
            "integration_method: unknown",
            "defaults: {}",
            "discovery:",
            "  enabled: false",
            "  type: list",
            "  urls:",
            f"    - {_yaml_quote(url)}",
            "detail:",
            "  enabled: false",
            "",
        ]
    )


def _write_stub(path: Path, content: str) -> None:
    path.write_text(content, encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate profile stubs for missing sources")
    parser.add_argument("--apply", action="store_true", help="Write stub files")
    parser.add_argument("--dry-run", action="store_true", help="Print summary only (default)")
    parser.add_argument("--limit", type=int, default=0, help="Limit number of stubs created")
    parser.add_argument("--slugs", nargs="*", default=None, help="Limit to specific slugs")
    args = parser.parse_args()

    if not args.apply and not args.dry_run:
        args.dry_run = True

    PROFILE_DIR.mkdir(parents=True, exist_ok=True)

    existing = _existing_profile_slugs()
    sources = _fetch_sources()

    if args.slugs:
        allowed = set(args.slugs)
        sources = [s for s in sources if s.get("slug") in allowed]

    missing = [s for s in sources if s.get("slug") not in existing]

    if args.limit and args.limit > 0:
        missing = missing[: args.limit]

    print(f"Existing profiles: {len(existing)}")
    print(f"Sources in DB: {len(sources)}")
    print(f"Missing profiles: {len(missing)}")

    if not missing:
        return

    for source in missing:
        slug = source.get("slug")
        if not slug:
            continue
        path = PROFILE_DIR / f"{slug}.yaml"
        if path.exists():
            print(f"[skip] {slug} -> {path.name} already exists")
            continue
        if args.apply:
            _write_stub(path, _build_stub(source))
            print(f"[write] {slug} -> {path.name}")
        else:
            print(f"[stub] {slug} -> {path.name}")

    if args.dry_run:
        print("\nDry run only; no files written.")


if __name__ == "__main__":
    main()
