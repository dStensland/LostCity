#!/usr/bin/env python3
"""
Align YAML profile configs to match their integration_method.

Many profiles have integration_method assigned but discovery/detail configs
that don't match (e.g., integration_method: playwright but render_js: false).
This script corrects configs so the pipeline routes correctly.

Usage:
  python scripts/align_profiles_to_integration_method.py --dry-run
  python scripts/align_profiles_to_integration_method.py --apply
  python scripts/align_profiles_to_integration_method.py --apply --methods playwright,html
  python scripts/align_profiles_to_integration_method.py --apply --slugs fox-theatre,terminal-west
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional

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

VALID_METHODS = {
    "aggregator", "api", "feed", "playwright",
    "llm_crawler", "llm_extraction", "jsonld_only", "html",
}


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


def _write_data(path: Path, data: dict) -> None:
    if path.suffix == ".json":
        path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    else:
        path.write_text(yaml.safe_dump(data, sort_keys=False, default_flow_style=False), encoding="utf-8")


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


def _deep_set(data: dict, dotpath: str, value) -> None:
    keys = dotpath.split(".")
    cur = data
    for k in keys[:-1]:
        if k not in cur or not isinstance(cur[k], dict):
            cur[k] = {}
        cur = cur[k]
    cur[keys[-1]] = value


def _set_if_different(data: dict, dotpath: str, value, changes: list) -> None:
    current = _deep_get(data, dotpath)
    if current != value:
        old_display = current if current is not None else "<unset>"
        changes.append(f"{dotpath}: {old_display} -> {value}")
        _deep_set(data, dotpath, value)


def _infer_adapter_from_url(data: dict) -> Optional[str]:
    urls = _deep_get(data, "discovery.urls", [])
    slug = data.get("slug", "")
    for url in (urls or []):
        lower = url.lower()
        if "ticketmaster.com" in lower:
            return "ticketmaster"
        if "eventbrite.com" in lower:
            return "eventbrite"
    if "ticketmaster" in slug:
        return "ticketmaster"
    if "eventbrite" in slug:
        return "eventbrite"
    return None


def _infer_feed_format(data: dict) -> str:
    urls = _deep_get(data, "discovery.urls", [])
    for url in (urls or []):
        lower = url.lower()
        if lower.endswith(".ics") or "webcal://" in lower:
            return "ics"
        if lower.endswith(".rss") or lower.endswith(".atom"):
            return "rss"
    return "auto"


def _has_detail_selectors(data: dict) -> bool:
    selectors = _deep_get(data, "detail.selectors", {})
    if not isinstance(selectors, dict):
        return False
    return any(v for v in selectors.values() if v)


# --- Method-specific alignment transformers ---

def _align_aggregator(data: dict, changes: list, manual: list) -> None:
    _set_if_different(data, "discovery.type", "api", changes)
    _set_if_different(data, "discovery.enabled", True, changes)

    adapter = _deep_get(data, "discovery.api.adapter")
    if not adapter:
        inferred = _infer_adapter_from_url(data)
        if inferred:
            _set_if_different(data, "discovery.api.adapter", inferred, changes)
        else:
            manual.append({
                "slug": data.get("slug", "?"),
                "reason": "Cannot infer aggregator adapter from URL",
                "url": (_deep_get(data, "discovery.urls") or [""])[0],
            })


def _align_api(data: dict, changes: list, manual: list) -> None:
    _set_if_different(data, "discovery.type", "api", changes)
    _set_if_different(data, "discovery.enabled", True, changes)

    if not _deep_get(data, "discovery.api.adapter"):
        _set_if_different(data, "discovery.api.adapter", "custom", changes)


def _align_feed(data: dict, changes: list, manual: list) -> None:
    _set_if_different(data, "discovery.type", "feed", changes)
    _set_if_different(data, "discovery.enabled", True, changes)

    fmt = _infer_feed_format(data)
    if not _deep_get(data, "discovery.feed.format"):
        _set_if_different(data, "discovery.feed.format", fmt, changes)


def _align_playwright(data: dict, changes: list, manual: list) -> None:
    _set_if_different(data, "discovery.fetch.render_js", True, changes)
    _set_if_different(data, "discovery.enabled", True, changes)

    if _has_detail_selectors(data):
        _set_if_different(data, "detail.fetch.render_js", True, changes)


def _align_llm_crawler(data: dict, changes: list, manual: list) -> None:
    _set_if_different(data, "discovery.type", "html", changes)
    _set_if_different(data, "discovery.enabled", True, changes)


def _align_llm_extraction(data: dict, changes: list, manual: list) -> None:
    _set_if_different(data, "detail.use_llm", True, changes)
    _set_if_different(data, "detail.enabled", True, changes)
    _set_if_different(data, "discovery.enabled", True, changes)


def _align_jsonld_only(data: dict, changes: list, manual: list) -> None:
    _set_if_different(data, "detail.jsonld_only", True, changes)
    _set_if_different(data, "detail.use_jsonld", True, changes)
    _set_if_different(data, "detail.enabled", True, changes)
    _set_if_different(data, "discovery.enabled", True, changes)


def _align_html(data: dict, changes: list, manual: list) -> None:
    _set_if_different(data, "discovery.enabled", True, changes)
    # Confirm render_js is false (don't force-set if not present — default is false)
    if _deep_get(data, "discovery.fetch.render_js") is True:
        _set_if_different(data, "discovery.fetch.render_js", False, changes)


ALIGNERS = {
    "aggregator": _align_aggregator,
    "api": _align_api,
    "feed": _align_feed,
    "playwright": _align_playwright,
    "llm_crawler": _align_llm_crawler,
    "llm_extraction": _align_llm_extraction,
    "jsonld_only": _align_jsonld_only,
    "html": _align_html,
}


def main() -> None:
    parser = argparse.ArgumentParser(description="Align profile configs to integration_method")
    parser.add_argument("--dry-run", action="store_true", help="Print changes without writing (default)")
    parser.add_argument("--apply", action="store_true", help="Write changes to profile files")
    parser.add_argument("--methods", help="Comma-separated list of methods to process")
    parser.add_argument("--slugs", help="Comma-separated list of slugs to process")
    parser.add_argument("--output", default=str(TMP_DIR / "align_profile_report.json"), help="Report output path")
    args = parser.parse_args()

    if not args.apply and not args.dry_run:
        args.dry_run = True

    method_filter = set(args.methods.split(",")) if args.methods else None
    slug_filter = set(args.slugs.split(",")) if args.slugs else None

    profiles = _load_profiles()
    all_changes: List[dict] = []
    manual_review: List[dict] = []
    changes_by_method: Dict[str, dict] = {}
    skipped = 0
    aligned = 0

    for slug in sorted(profiles.keys()):
        if slug_filter and slug not in slug_filter:
            continue

        path = profiles[slug]
        data = _read_data(path)
        method = data.get("integration_method")

        if not method or method == "unknown":
            skipped += 1
            continue

        if method not in VALID_METHODS:
            skipped += 1
            continue

        if method_filter and method not in method_filter:
            continue

        changes: list = []
        manual: list = []
        aligner = ALIGNERS.get(method)
        if aligner:
            aligner(data, changes, manual)

        manual_review.extend(manual)

        if changes:
            all_changes.append({
                "slug": slug,
                "method": method,
                "changes": changes,
            })
            by_method = changes_by_method.setdefault(method, {"profiles_changed": 0, "total_changes": 0})
            by_method["profiles_changed"] += 1
            by_method["total_changes"] += len(changes)

            if args.apply:
                _write_data(path, data)
                print(f"[apply] {slug} ({method}): {', '.join(changes)}")
            else:
                print(f"[dry-run] {slug} ({method}): {', '.join(changes)}")
        else:
            aligned += 1

    # Report
    report = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "mode": "apply" if args.apply else "dry-run",
        "total_profiles": len(profiles),
        "already_aligned": aligned,
        "profiles_changed": len(all_changes),
        "skipped_no_method": skipped,
        "manual_review_required": len(manual_review),
        "changes_by_method": changes_by_method,
        "profile_changes": all_changes,
        "manual_review_items": manual_review,
    }

    TMP_DIR.mkdir(parents=True, exist_ok=True)
    output_path = Path(args.output)
    output_path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")

    print(f"\n{'=' * 60}")
    print(f"Total profiles: {len(profiles)}")
    print(f"Already aligned: {aligned}")
    print(f"Changed: {len(all_changes)}")
    print(f"Skipped (no/unknown method): {skipped}")
    print(f"Manual review needed: {len(manual_review)}")
    for method, stats in sorted(changes_by_method.items()):
        print(f"  {method}: {stats['profiles_changed']} profiles, {stats['total_changes']} changes")
    print(f"\nReport: {output_path}")

    if args.dry_run:
        print("\nDry run only; no profiles updated.")


if __name__ == "__main__":
    main()
