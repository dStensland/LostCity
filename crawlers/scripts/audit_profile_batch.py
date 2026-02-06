#!/usr/bin/env python3
"""
Audit a batch of sources and update profile integration_method.

Input file format (CSV, no header):
  slug,url,events

Usage:
  python scripts/audit_profile_batch.py --input tmp/top50_sources.csv --apply
  python scripts/audit_profile_batch.py --input tmp/top50_sources.csv --dry-run --output tmp/top50_audit.json
"""

from __future__ import annotations

import argparse
import csv
import json
import sys
from pathlib import Path
from typing import Dict, List, Optional

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from scripts.source_audit import audit


PROFILE_DIR = ROOT / "sources" / "profiles"


def _quick_method_from_url(url: str) -> Optional[str]:
    lower = url.lower()
    if "ticketmaster.com" in lower or "eventbrite.com" in lower:
        return "aggregator"
    if "meetup.com" in lower:
        return "api"
    if lower.startswith("webcal://"):
        return "feed"
    if lower.endswith(".ics"):
        return "feed"
    if lower.endswith(".rss") or lower.endswith(".atom"):
        return "feed"
    if "rss" in lower and ("feed" in lower or "rss" in lower):
        return "feed"
    return None


def _load_input(path: Path) -> List[Dict[str, str]]:
    items: List[Dict[str, str]] = []
    with path.open("r", encoding="utf-8") as f:
        reader = csv.reader(f)
        for row in reader:
            if not row or len(row) < 2:
                continue
            slug = row[0].strip()
            url = row[1].strip()
            events = row[2].strip() if len(row) > 2 else ""
            if not slug or not url:
                continue
            items.append({"slug": slug, "url": url, "events": events})
    return items


def _choose_profile_path(slug: str) -> Optional[Path]:
    json_path = PROFILE_DIR / f"{slug}.json"
    if json_path.exists():
        return json_path
    yaml_path = PROFILE_DIR / f"{slug}.yaml"
    if yaml_path.exists():
        return yaml_path
    yml_path = PROFILE_DIR / f"{slug}.yml"
    if yml_path.exists():
        return yml_path
    return None


def _read_profile_method(path: Path) -> Optional[str]:
    if path.suffix == ".json":
        data = json.loads(path.read_text(encoding="utf-8"))
        method = data.get("integration_method")
        return method.strip() if isinstance(method, str) else None

    for line in path.read_text(encoding="utf-8").splitlines():
        if line.strip().startswith("integration_method:"):
            return line.split(":", 1)[1].strip().strip("'\"")
    return None


def _update_profile_method(path: Path, method: str, overwrite: bool) -> bool:
    if path.suffix == ".json":
        data = json.loads(path.read_text(encoding="utf-8"))
        existing = data.get("integration_method")
        if existing and existing != "unknown" and not overwrite:
            return False
        data["integration_method"] = method
        path.write_text(json.dumps(data, indent=2), encoding="utf-8")
        return True

    # YAML/YML: do a light text replacement to preserve formatting
    lines = path.read_text(encoding="utf-8").splitlines()
    for idx, line in enumerate(lines):
        if line.strip().startswith("integration_method:"):
            existing = line.split(":", 1)[1].strip()
            if existing and existing != "unknown" and not overwrite:
                return False
            lines[idx] = f"integration_method: {method}"
            path.write_text("\n".join(lines) + "\n", encoding="utf-8")
            return True

    # Insert after name if missing
    insert_at = None
    for idx, line in enumerate(lines):
        if line.strip().startswith("name:"):
            insert_at = idx + 1
            break
    if insert_at is None:
        insert_at = 2 if len(lines) >= 2 else len(lines)
    lines.insert(insert_at, f"integration_method: {method}")
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return True


def main() -> None:
    parser = argparse.ArgumentParser(description="Audit sources and update integration_method in profiles")
    parser.add_argument("--input", required=True, help="CSV input file with slug,url,events")
    parser.add_argument("--apply", action="store_true", help="Write profile updates")
    parser.add_argument("--dry-run", action="store_true", help="Print summary only (default)")
    parser.add_argument("--output", help="Write audit report JSON")
    parser.add_argument("--overwrite", action="store_true", help="Overwrite existing non-unknown methods")
    parser.add_argument("--timeout-ms", type=int, default=15000)
    parser.add_argument("--user-agent", default=None)
    parser.add_argument("--limit", type=int, default=0, help="Limit number of rows processed")
    parser.add_argument("--offset", type=int, default=0, help="Skip first N rows")
    args = parser.parse_args()

    if not args.apply and not args.dry_run:
        args.dry_run = True

    items = _load_input(Path(args.input))
    if args.offset:
        items = items[args.offset :]
    if args.limit and args.limit > 0:
        items = items[: args.limit]
    if not items:
        print("No items found in input.")
        return

    report: List[Dict[str, object]] = []
    updated = 0

    for item in items:
        slug = item["slug"]
        url = item["url"]

        path = _choose_profile_path(slug)
        existing_method = _read_profile_method(path) if path else None
        if existing_method and existing_method != "unknown" and not args.overwrite:
            entry = {
                "slug": slug,
                "url": url,
                "events": item.get("events"),
                "method": existing_method,
                "signals": {"existing": True},
                "notes": ["already_set"],
            }
            report.append(entry)
            print(f"[keep] {slug} -> existing method")
            continue

        quick = _quick_method_from_url(url)
        if quick:
            method = quick
            entry = {
                "slug": slug,
                "url": url,
                "events": item.get("events"),
                "method": method,
                "signals": {"quick": True},
                "notes": ["quick_match"],
            }
            report.append(entry)
            if args.apply:
                if path:
                    did_update = _update_profile_method(path, method, args.overwrite)
                    if did_update:
                        updated += 1
                        print(f"[update] {slug} -> {method}")
                    else:
                        print(f"[keep] {slug} -> existing method")
                else:
                    print(f"[skip] {slug} (no profile found)")
            else:
                print(f"[audit] {slug} -> {method}")
            continue

        try:
            result = audit(url, args.timeout_ms, args.user_agent)
            method = result.recommendation.get("method")
            entry = {
                "slug": slug,
                "url": url,
                "events": item.get("events"),
                "method": method,
                "signals": result.signals,
                "notes": result.recommendation.get("notes", []),
            }
        except Exception as e:
            method = _quick_method_from_url(url) or "unknown"
            entry = {
                "slug": slug,
                "url": url,
                "events": item.get("events"),
                "method": method,
                "signals": {},
                "notes": [f"audit_error: {e}"],
            }
            print(f"[error] {slug}: {e}")

        report.append(entry)

        if not path:
            print(f"[skip] {slug} (no profile found)")
            continue

        if args.apply:
            did_update = _update_profile_method(path, method, args.overwrite)
            if did_update:
                updated += 1
                print(f"[update] {slug} -> {method}")
            else:
                print(f"[keep] {slug} -> existing method")
        else:
            print(f"[audit] {slug} -> {method}")

    if args.output:
        Path(args.output).write_text(json.dumps(report, indent=2), encoding="utf-8")
        print(f"\nReport written to {args.output}")

    if args.dry_run:
        print("\nDry run only; no profiles updated.")
    else:
        print(f"\nProfiles updated: {updated}/{len(items)}")


if __name__ == "__main__":
    main()
