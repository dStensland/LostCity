#!/usr/bin/env python3
"""
Validate that profile configs are consistent with their integration_method.

Checks for FAIL (will break routing) and WARNING (suspicious but may work) conditions.

Usage:
  python scripts/check_profile_consistency.py
  python scripts/check_profile_consistency.py --verbose
  python scripts/check_profile_consistency.py --methods playwright,html
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

try:
    import yaml
except ImportError:
    print("pyyaml is required: pip install pyyaml")
    sys.exit(1)

PROFILE_DIR = ROOT / "sources" / "profiles"
TMP_DIR = ROOT / "tmp"


def _load_profiles() -> Dict[str, Path]:
    profiles: Dict[str, Path] = {}
    for ext in ("*.yaml", "*.yml", "*.json"):
        for path in PROFILE_DIR.glob(ext):
            profiles.setdefault(path.stem, path)
    return profiles


def _read_data(path: Path) -> dict:
    if path.suffix == ".json":
        return json.loads(path.read_text(encoding="utf-8"))
    return yaml.safe_load(path.read_text(encoding="utf-8")) or {}


def _deep_get(data: dict, dotpath: str, default=None):
    keys = dotpath.split(".")
    cur = data
    for k in keys:
        if not isinstance(cur, dict):
            return default
        cur = cur.get(k, default)
        if cur is default:
            return default
    return cur


KNOWN_ADAPTERS = {"ticketmaster", "eventbrite"}


def _check_aggregator(data: dict, fails: list, warns: list) -> None:
    if _deep_get(data, "discovery.type") != "api":
        fails.append("discovery.type must be 'api'")
    if not _deep_get(data, "discovery.api.adapter"):
        fails.append("missing discovery.api.adapter")
    adapter = _deep_get(data, "discovery.api.adapter")
    if adapter and adapter not in KNOWN_ADAPTERS:
        warns.append(f"adapter '{adapter}' not in known set {KNOWN_ADAPTERS}")


def _check_api(data: dict, fails: list, warns: list) -> None:
    if _deep_get(data, "discovery.type") != "api":
        fails.append("discovery.type must be 'api'")
    if not _deep_get(data, "discovery.api"):
        fails.append("missing discovery.api config")


def _check_feed(data: dict, fails: list, warns: list) -> None:
    if _deep_get(data, "discovery.type") != "feed":
        fails.append("discovery.type must be 'feed'")
    if not _deep_get(data, "discovery.feed"):
        warns.append("missing discovery.feed config")


def _check_playwright(data: dict, fails: list, warns: list) -> None:
    if _deep_get(data, "discovery.fetch.render_js") is not True:
        fails.append("discovery.fetch.render_js must be true")
    if _deep_get(data, "discovery.type") not in (None, "list"):
        warns.append(f"discovery.type is '{_deep_get(data, 'discovery.type')}', expected 'list'")


def _check_llm_crawler(data: dict, fails: list, warns: list) -> None:
    if _deep_get(data, "discovery.type") != "html":
        fails.append("discovery.type must be 'html'")


def _check_llm_extraction(data: dict, fails: list, warns: list) -> None:
    if _deep_get(data, "detail.use_llm") is not True:
        fails.append("detail.use_llm must be true")


def _check_jsonld_only(data: dict, fails: list, warns: list) -> None:
    if _deep_get(data, "detail.jsonld_only") is not True:
        fails.append("detail.jsonld_only must be true")
    if _deep_get(data, "detail.use_jsonld") is not True:
        warns.append("detail.use_jsonld should be true")


def _check_html(data: dict, fails: list, warns: list) -> None:
    if _deep_get(data, "discovery.fetch.render_js") is True:
        warns.append("render_js is true — should this be playwright?")


CHECKERS = {
    "aggregator": _check_aggregator,
    "api": _check_api,
    "feed": _check_feed,
    "playwright": _check_playwright,
    "llm_crawler": _check_llm_crawler,
    "llm_extraction": _check_llm_extraction,
    "jsonld_only": _check_jsonld_only,
    "html": _check_html,
}


def main() -> None:
    parser = argparse.ArgumentParser(description="Check profile consistency with integration_method")
    parser.add_argument("--verbose", action="store_true", help="Print all profiles, not just issues")
    parser.add_argument("--methods", help="Comma-separated list of methods to check")
    parser.add_argument("--output", default=str(TMP_DIR / "mismatch_report.json"), help="Report output path")
    args = parser.parse_args()

    method_filter = set(args.methods.split(",")) if args.methods else None
    profiles = _load_profiles()

    results: List[dict] = []
    total_fails = 0
    total_warns = 0
    fails_by_method: Dict[str, int] = {}
    warns_by_method: Dict[str, int] = {}
    checked = 0
    skipped = 0

    for slug in sorted(profiles.keys()):
        path = profiles[slug]
        data = _read_data(path)
        method = data.get("integration_method")

        if not method or method == "unknown":
            skipped += 1
            continue

        if method not in CHECKERS:
            skipped += 1
            continue

        if method_filter and method not in method_filter:
            continue

        checked += 1
        fails: list = []
        warns: list = []

        # Common checks
        if _deep_get(data, "discovery.enabled") is not True:
            warns.append("discovery.enabled is not true")

        CHECKERS[method](data, fails, warns)

        if fails or warns:
            entry = {"slug": slug, "method": method, "fails": fails, "warnings": warns}
            results.append(entry)
            total_fails += len(fails)
            total_warns += len(warns)
            if fails:
                fails_by_method[method] = fails_by_method.get(method, 0) + len(fails)
            if warns:
                warns_by_method[method] = warns_by_method.get(method, 0) + len(warns)

            marker = "FAIL" if fails else "WARN"
            print(f"[{marker}] {slug} ({method})")
            for f in fails:
                print(f"  FAIL: {f}")
            for w in warns:
                print(f"  WARN: {w}")
        elif args.verbose:
            print(f"[OK] {slug} ({method})")

    # Report
    report = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "total_profiles": len(profiles),
        "checked": checked,
        "skipped": skipped,
        "total_fails": total_fails,
        "total_warnings": total_warns,
        "profiles_with_issues": len(results),
        "fails_by_method": fails_by_method,
        "warnings_by_method": warns_by_method,
        "issues": results,
    }

    TMP_DIR.mkdir(parents=True, exist_ok=True)
    output_path = Path(args.output)
    output_path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")

    print(f"\n{'=' * 60}")
    print(f"Checked: {checked} | Skipped: {skipped}")
    print(f"FAILs: {total_fails} | WARNINGs: {total_warns}")
    if fails_by_method:
        print("Fails by method:")
        for m, c in sorted(fails_by_method.items()):
            print(f"  {m}: {c}")
    if warns_by_method:
        print("Warnings by method:")
        for m, c in sorted(warns_by_method.items()):
            print(f"  {m}: {c}")
    print(f"\nReport: {output_path}")

    sys.exit(1 if total_fails > 0 else 0)


if __name__ == "__main__":
    main()
