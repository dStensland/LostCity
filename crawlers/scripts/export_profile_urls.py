#!/usr/bin/env python3
"""
Export profile slugs + URLs to CSV.

Usage:
  python scripts/export_profile_urls.py --output tmp/profile_urls.csv
  python scripts/export_profile_urls.py --output tmp/profile_urls.csv --unknown-only
"""

from __future__ import annotations

import argparse
import csv
import json
import sys
from pathlib import Path
from typing import Any, Dict, Iterable

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

try:
    import yaml  # type: ignore
except Exception:
    yaml = None


PROFILE_DIR = ROOT / "sources" / "profiles"
PROFILE_EXTS = (".json", ".yaml", ".yml")


def _iter_profile_paths() -> Iterable[Path]:
    for ext in PROFILE_EXTS:
        for path in PROFILE_DIR.glob(f"*{ext}"):
            yield path


def _load_profile(path: Path) -> Dict[str, Any]:
    if path.suffix == ".json":
        return json.loads(path.read_text(encoding="utf-8"))

    text = path.read_text(encoding="utf-8")
    if yaml is not None:
        try:
            return yaml.safe_load(text) or {}
        except Exception:
            pass

    # Minimal YAML fallback parser for stubs
    data: Dict[str, Any] = {}
    lines = text.splitlines()
    urls: list[str] = []
    in_urls = False
    urls_indent = None

    for line in lines:
        raw = line
        line = line.rstrip()
        if not line.strip() or line.strip().startswith("#"):
            continue

        if line.startswith("slug:"):
            data["slug"] = line.split(":", 1)[1].strip().strip("'\"")
            continue

        if line.startswith("integration_method:"):
            data["integration_method"] = line.split(":", 1)[1].strip().strip("'\"")
            continue

        if line.strip() == "urls:":
            in_urls = True
            urls_indent = len(raw) - len(raw.lstrip(" "))
            continue

        if in_urls:
            indent = len(raw) - len(raw.lstrip(" "))
            if urls_indent is not None and indent <= urls_indent:
                in_urls = False
                urls_indent = None
                continue
            if line.strip().startswith("- "):
                url = line.strip()[2:].strip().strip("'\"")
                if url:
                    urls.append(url)

    if urls:
        data["discovery"] = {"urls": urls}
    return data


def _get_first_url(data: Dict[str, Any]) -> str | None:
    discovery = data.get("discovery") or {}
    urls = discovery.get("urls") or []
    if isinstance(urls, list) and urls:
        first = urls[0]
        if isinstance(first, str) and first.strip():
            return first.strip()
    return None


def main() -> None:
    parser = argparse.ArgumentParser(description="Export profile slugs and URLs to CSV")
    parser.add_argument("--output", required=True, help="CSV output path")
    parser.add_argument("--unknown-only", action="store_true", help="Only include profiles with integration_method=unknown")
    args = parser.parse_args()

    rows = []
    for path in _iter_profile_paths():
        data = _load_profile(path)
        slug = data.get("slug") or path.stem
        url = _get_first_url(data)
        if not url:
            continue
        method = (data.get("integration_method") or "unknown").strip()
        if args.unknown_only and method != "unknown":
            continue
        rows.append({"slug": slug, "url": url})

    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f)
        for row in sorted(rows, key=lambda r: r["slug"]):
            writer.writerow([row["slug"], row["url"], ""])

    print(f"Wrote {len(rows)} rows to {output_path}")


if __name__ == "__main__":
    main()
