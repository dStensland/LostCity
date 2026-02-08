#!/usr/bin/env python3
"""
Upgrade a list of source profiles to Playwright.

Sets:
- integration_method: playwright
- discovery.enabled: true
- discovery.fetch.render_js: true
- detail.fetch.render_js: true (JSON only, and only if detail selectors are present)

Usage:
  python scripts/upgrade_playwright_candidates.py --list tmp/triage_playwright_candidates.txt --dry-run
  python scripts/upgrade_playwright_candidates.py --list tmp/triage_playwright_candidates.txt --apply
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path
from datetime import datetime, timezone
from typing import List, Dict, Optional

ROOT = Path(__file__).resolve().parents[1]
PROFILE_DIR = ROOT / "sources" / "profiles"
TMP_DIR = ROOT / "tmp"


def _profile_path(slug: str) -> Optional[Path]:
    for ext in (".json", ".yaml", ".yml"):
        path = PROFILE_DIR / f"{slug}{ext}"
        if path.exists():
            return path
    return None


def _deep_get(data: dict, dotpath: str, default=None):
    cur = data
    for part in dotpath.split("."):
        if not isinstance(cur, dict):
            return default
        if part not in cur:
            return default
        cur = cur[part]
    return cur


def _deep_set(data: dict, dotpath: str, value) -> None:
    cur = data
    parts = dotpath.split(".")
    for part in parts[:-1]:
        if part not in cur or not isinstance(cur[part], dict):
            cur[part] = {}
        cur = cur[part]
    cur[parts[-1]] = value


def _set_if_diff(data: dict, dotpath: str, value, changes: List[str]) -> None:
    current = _deep_get(data, dotpath)
    if current != value:
        old_display = current if current is not None else "<unset>"
        changes.append(f"{dotpath}: {old_display} -> {value}")
        _deep_set(data, dotpath, value)


def _has_detail_selectors(data: dict) -> bool:
    selectors = _deep_get(data, "detail.selectors", {})
    if not isinstance(selectors, dict):
        return False
    return any(bool(v) for v in selectors.values())


# Minimal YAML editor (string-based updates only)

def _find_block(lines: List[str], key: str, indent: int) -> Optional[int]:
    needle = f"{key}:"
    for i, line in enumerate(lines):
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        if line.strip().startswith(needle):
            line_indent = len(line) - len(line.lstrip(" "))
            if line_indent == indent:
                return i
    return None


def _block_end(lines: List[str], start_idx: int, indent: int) -> int:
    for j in range(start_idx + 1, len(lines)):
        line = lines[j]
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        cur_indent = len(line) - len(line.lstrip(" "))
        if cur_indent <= indent:
            return j
    return len(lines)


def _ensure_block(lines: List[str], key: str, indent: int) -> int:
    idx = _find_block(lines, key, indent)
    if idx is not None:
        return idx
    lines.append(" " * indent + f"{key}:")
    return len(lines) - 1


def _set_in_block(lines: List[str], parent_idx: int, parent_indent: int, key: str, value: str, changes: List[str]) -> None:
    end = _block_end(lines, parent_idx, parent_indent)
    child_indent = parent_indent + 2
    key_prefix = " " * child_indent + f"{key}:"

    for i in range(parent_idx + 1, end):
        line = lines[i]
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        line_indent = len(line) - len(line.lstrip(" "))
        if line_indent != child_indent:
            continue
        if line.strip().startswith(f"{key}:"):
            old = line.split(":", 1)[1].strip()
            if old == value:
                return
            lines[i] = key_prefix + f" {value}"
            old_display = old if old else "<unset>"
            changes.append(f"{key}: {old_display} -> {value}")
            return

    lines.insert(end, key_prefix + f" {value}")
    changes.append(f"{key}: <unset> -> {value}")


def _yaml_update(path: Path, updates: Dict[str, str], changes: List[str]) -> None:
    lines = path.read_text(encoding="utf-8").splitlines()
    if not lines:
        lines = []

    for dotpath, value in updates.items():
        parts = dotpath.split(".")
        if len(parts) == 1:
            key = parts[0]
            idx = _find_block(lines, key, 0)
            if idx is not None:
                old = lines[idx].split(":", 1)[1].strip() if ":" in lines[idx] else ""
                if old != value:
                    lines[idx] = f"{key}: {value}"
                    old_display = old if old else "<unset>"
                    changes.append(f"{key}: {old_display} -> {value}")
            else:
                lines.append(f"{key}: {value}")
                changes.append(f"{key}: <unset> -> {value}")
            continue

        parent_keys = parts[:-1]
        key = parts[-1]
        cur_indent = 0
        parent_idx = None
        for parent in parent_keys:
            parent_idx = _ensure_block(lines, parent, cur_indent)
            cur_indent += 2
        if parent_idx is None:
            continue
        _set_in_block(lines, parent_idx, cur_indent - 2, key, value, changes)

    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description="Upgrade playwright candidates")
    parser.add_argument("--list", required=True, help="Path to newline-delimited slug list")
    parser.add_argument("--apply", action="store_true", help="Write profile changes")
    parser.add_argument("--dry-run", action="store_true", help="Print changes only (default)")
    parser.add_argument("--output", default=str(TMP_DIR / "playwright_upgrade_report.json"))
    args = parser.parse_args()

    if not args.apply and not args.dry_run:
        args.dry_run = True

    slugs = [s.strip() for s in Path(args.list).read_text(encoding="utf-8").splitlines() if s.strip()]

    updates = []
    missing = []

    for slug in slugs:
        path = _profile_path(slug)
        if not path:
            missing.append(slug)
            continue

        changes: List[str] = []
        if path.suffix == ".json":
            data = json.loads(path.read_text(encoding="utf-8"))
            _set_if_diff(data, "integration_method", "playwright", changes)
            _set_if_diff(data, "discovery.enabled", True, changes)
            _set_if_diff(data, "discovery.fetch.render_js", True, changes)
            if _has_detail_selectors(data):
                _set_if_diff(data, "detail.fetch.render_js", True, changes)
            if args.apply and changes:
                path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
        else:
            # YAML line-based update
            yaml_updates = {
                "integration_method": "playwright",
                "discovery.enabled": "true",
                "discovery.fetch.render_js": "true",
            }
            if args.apply:
                _yaml_update(path, yaml_updates, changes)
            else:
                changes = [f"{k} -> {v}" for k, v in yaml_updates.items()]

        if changes:
            updates.append({"slug": slug, "path": str(path), "changes": changes})
            prefix = "[apply]" if args.apply else "[dry-run]"
            print(f"{prefix} {slug}: {', '.join(changes)}")

    report = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "mode": "apply" if args.apply else "dry-run",
        "total_slugs": len(slugs),
        "updated": len(updates),
        "missing": missing,
        "updates": updates,
    }

    TMP_DIR.mkdir(parents=True, exist_ok=True)
    Path(args.output).write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")

    print("\n" + "=" * 60)
    print(f"Total slugs: {len(slugs)}")
    print(f"Updated: {len(updates)}")
    print(f"Missing: {len(missing)}")
    print(f"Report: {args.output}")

    if args.dry_run:
        print("\nDry run only; no profiles updated.")


if __name__ == "__main__":
    main()
