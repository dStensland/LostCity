#!/usr/bin/env python3
"""
Backfill or normalize `data_goals` in source profiles.

Usage:
  python scripts/backfill_source_data_goals.py
  python scripts/backfill_source_data_goals.py --apply
  python scripts/backfill_source_data_goals.py --apply --slugs the-earl,terminal-west,529
  python scripts/backfill_source_data_goals.py --apply --overwrite
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

try:
    import yaml
except ImportError:
    print("pyyaml is required: pip install pyyaml")
    raise SystemExit(1)

from source_goals import infer_data_goals, normalize_goal

PROFILE_DIR = ROOT / "sources" / "profiles"


def _load_profile(path: Path) -> dict:
    if path.suffix == ".json":
        return json.loads(path.read_text(encoding="utf-8"))
    return yaml.safe_load(path.read_text(encoding="utf-8")) or {}


def _write_profile(path: Path, data: dict) -> None:
    if path.suffix == ".json":
        path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
        return
    path.write_text(yaml.safe_dump(data, sort_keys=False), encoding="utf-8")


def _normalize_goals(goals: list) -> list[str]:
    normalized = []
    seen = set()
    for raw_goal in goals:
        goal = normalize_goal(str(raw_goal))
        if not goal or goal in seen:
            continue
        seen.add(goal)
        normalized.append(goal)
    return normalized


def _iter_profiles() -> list[Path]:
    paths: list[Path] = []
    for ext in ("*.yaml", "*.yml", "*.json"):
        paths.extend(sorted(PROFILE_DIR.glob(ext)))
    return paths


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Backfill/normalize source profile data_goals"
    )
    parser.add_argument(
        "--apply", action="store_true", help="Write updates to profile files"
    )
    parser.add_argument(
        "--overwrite",
        action="store_true",
        help="Overwrite existing data_goals with newly inferred goals",
    )
    parser.add_argument(
        "--slugs",
        default="",
        help="Optional comma-separated source slugs to update",
    )
    args = parser.parse_args()

    slug_filter = {slug.strip() for slug in args.slugs.split(",") if slug.strip()}
    updated = 0
    normalized = 0
    skipped = 0
    touched: list[str] = []

    for path in _iter_profiles():
        data = _load_profile(path)
        slug = str(data.get("slug") or path.stem)
        if slug_filter and slug not in slug_filter:
            continue

        name = str(data.get("name") or slug)
        defaults = data.get("defaults") or {}
        default_category = str(defaults.get("category") or "")

        existing = data.get("data_goals")
        changed = False
        if isinstance(existing, list) and existing and not args.overwrite:
            normalized_goals = _normalize_goals(existing)
            if normalized_goals and normalized_goals != existing:
                data["data_goals"] = normalized_goals
                changed = True
                normalized += 1
        else:
            inferred_goals = infer_data_goals(
                source_slug=slug,
                source_name=f"{name} {default_category}".strip(),
            )
            if inferred_goals != existing:
                data["data_goals"] = inferred_goals
                changed = True

        if not changed:
            skipped += 1
            continue

        if args.apply:
            _write_profile(path, data)
        updated += 1
        touched.append(slug)

    mode = "APPLY" if args.apply else "DRY RUN"
    print(f"{mode}: backfill_source_data_goals")
    print(f"Profiles updated: {updated}")
    print(f"Profiles normalized: {normalized}")
    print(f"Profiles unchanged: {skipped}")
    if touched:
        print("\nTouched slugs (up to 60):")
        for slug in touched[:60]:
            print(f"  - {slug}")
        if len(touched) > 60:
            print(f"  ... and {len(touched) - 60} more")

    if not args.apply:
        print("\nDry run only. Re-run with --apply to persist changes.")


if __name__ == "__main__":
    main()
