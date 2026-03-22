#!/usr/bin/env python3
"""
Apply targeted fixes from tmp/method_audit.json.

Actions:
- verdict == needs_js: enable discovery.fetch.render_js
- verdict == jsonld_rich: promote to jsonld_only + enable JSON-LD detail flags
- verdict == feed_rss: set integration_method=feed and discovery.type=feed with format=rss
- verdict in {empty, unclear, error}: emit diagnostics list

Usage:
  python scripts/apply_method_audit_fixes.py --dry-run
  python scripts/apply_method_audit_fixes.py --apply
  python scripts/apply_method_audit_fixes.py --apply --output tmp/audit_fix_report.json
"""
from __future__ import annotations

import argparse
import json
import sys
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional, Tuple

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

PROFILE_DIR = ROOT / "sources" / "profiles"
TMP_DIR = ROOT / "tmp"
AUDIT_PATH = TMP_DIR / "method_audit.json"

try:
    import yaml  # type: ignore
except Exception:
    yaml = None


@dataclass
class Change:
    slug: str
    path: str
    changes: List[str]
    verdict: str


def _load_audit() -> List[dict]:
    if not AUDIT_PATH.exists():
        raise FileNotFoundError(f"{AUDIT_PATH} not found")
    return json.loads(AUDIT_PATH.read_text(encoding="utf-8"))


def _profile_path(slug: str) -> Optional[Path]:
    for ext in (".json", ".yaml", ".yml"):
        path = PROFILE_DIR / f"{slug}{ext}"
        if path.exists():
            return path
    return None


# ----------------------------
# JSON helpers
# ----------------------------

def _json_load(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def _json_write(path: Path, data: dict) -> None:
    path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")


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


# ----------------------------
# Minimal YAML line editor
# ----------------------------

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


def _ensure_block(lines: List[str], key: str, indent: int) -> Tuple[int, int]:
    idx = _find_block(lines, key, indent)
    if idx is not None:
        return idx, indent
    insert_at = len(lines)
    line = " " * indent + f"{key}:"
    lines.insert(insert_at, line)
    return insert_at, indent


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

    # not found, insert before end
    lines.insert(end, key_prefix + f" {value}")
    changes.append(f"{key}: <unset> -> {value}")


def _yaml_update(path: Path, updates: Dict[str, str], changes: List[str]) -> None:
    lines = path.read_text(encoding="utf-8").splitlines()
    if not lines:
        lines = []

    # ensure top-level keys as needed
    for dotpath, value in updates.items():
        parts = dotpath.split(".")
        if len(parts) == 1:
            # top-level
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

        # nested
        parent_keys = parts[:-1]
        key = parts[-1]
        parent_idx = None
        parent_indent = 0
        # walk parents
        cur_indent = 0
        for parent in parent_keys:
            idx = _find_block(lines, parent, cur_indent)
            if idx is None:
                idx, cur_indent = _ensure_block(lines, parent, cur_indent)
            parent_idx = idx
            parent_indent = cur_indent
            cur_indent += 2
        if parent_idx is None:
            continue
        _set_in_block(lines, parent_idx, parent_indent, key, value, changes)

    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


# ----------------------------
# Main logic
# ----------------------------

def _apply_json_updates(path: Path, updates: Dict[str, object], changes: List[str]) -> None:
    data = _json_load(path)
    for dotpath, value in updates.items():
        _set_if_diff(data, dotpath, value, changes)
    _json_write(path, data)


def main() -> None:
    parser = argparse.ArgumentParser(description="Apply method audit fixes")
    parser.add_argument("--apply", action="store_true", help="Write changes to profile files")
    parser.add_argument("--dry-run", action="store_true", help="Print changes only (default)")
    parser.add_argument("--output", default=str(TMP_DIR / "audit_fix_report.json"), help="Report output path")
    parser.add_argument("--diagnostics", default=str(TMP_DIR / "audit_diagnostics.json"), help="Diagnostics output path")
    args = parser.parse_args()

    if not args.apply and not args.dry_run:
        args.dry_run = True

    audit = _load_audit()
    changes: List[Change] = []
    diagnostics: List[dict] = []

    for item in audit:
        slug = item.get("slug")
        verdict = item.get("verdict") or "unknown"
        url = item.get("url") or ""
        method = item.get("method") or ""
        detail = item.get("detail") or ""

        if not slug:
            continue

        if verdict in {"empty", "unclear", "error"}:
            diagnostics.append({
                "slug": slug,
                "method": method,
                "verdict": verdict,
                "url": url,
                "detail": detail,
            })
            continue

        profile_path = _profile_path(slug)
        if not profile_path:
            continue

        update_map: Dict[str, object] = {}

        if verdict == "needs_js":
            update_map["discovery.fetch.render_js"] = True

        if verdict == "jsonld_rich":
            # promote to jsonld_only
            update_map["integration_method"] = "jsonld_only"
            update_map["detail.jsonld_only"] = True
            update_map["detail.use_jsonld"] = True
            update_map["detail.enabled"] = True

        if verdict == "feed_rss":
            update_map["integration_method"] = "feed"
            update_map["discovery.type"] = "feed"
            update_map["discovery.feed.format"] = "rss"
            update_map["discovery.enabled"] = True

        if not update_map:
            continue

        file_changes: List[str] = []
        if args.apply:
            if profile_path.suffix == ".json":
                _apply_json_updates(profile_path, update_map, file_changes)
            else:
                # YAML: update via pyyaml if available, else line-based
                if yaml is not None:
                    data = yaml.safe_load(profile_path.read_text(encoding="utf-8")) or {}
                    for dotpath, value in update_map.items():
                        _set_if_diff(data, dotpath, value, file_changes)
                    profile_path.write_text(
                        yaml.safe_dump(data, sort_keys=False, default_flow_style=False),
                        encoding="utf-8",
                    )
                else:
                    # line-based update (string values expected for YAML)
                    yaml_updates = {k: ("true" if v is True else "false" if v is False else str(v)) for k, v in update_map.items()}
                    _yaml_update(profile_path, yaml_updates, file_changes)
        else:
            # dry-run only; compute changes without writing
            file_changes = [f"{k} -> {v}" for k, v in update_map.items()]

        if file_changes:
            changes.append(Change(slug=slug, path=str(profile_path), changes=file_changes, verdict=verdict))
            if args.apply:
                print(f"[apply] {slug}: {', '.join(file_changes)}")
            else:
                print(f"[dry-run] {slug}: {', '.join(file_changes)}")

    report = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "mode": "apply" if args.apply else "dry-run",
        "total_audit_entries": len(audit),
        "changes": [c.__dict__ for c in changes],
        "change_count": len(changes),
        "diagnostic_count": len(diagnostics),
    }

    TMP_DIR.mkdir(parents=True, exist_ok=True)
    Path(args.output).write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    Path(args.diagnostics).write_text(json.dumps(diagnostics, indent=2) + "\n", encoding="utf-8")

    print("\n" + "=" * 60)
    print(f"Applied changes to {len(changes)} profiles")
    print(f"Diagnostics entries: {len(diagnostics)}")
    print(f"Report: {args.output}")
    print(f"Diagnostics: {args.diagnostics}")

    if args.dry_run:
        print("\nDry run only; no profiles updated.")


if __name__ == "__main__":
    main()
