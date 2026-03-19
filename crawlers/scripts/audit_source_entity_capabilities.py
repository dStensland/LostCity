#!/usr/bin/env python3
"""
Audit declared typed-entity lane capabilities across crawler sources.

Usage:
  python3 crawlers/scripts/audit_source_entity_capabilities.py
  python3 crawlers/scripts/audit_source_entity_capabilities.py --lane exhibitions
  python3 crawlers/scripts/audit_source_entity_capabilities.py --json
"""

from __future__ import annotations

import argparse
import ast
import json
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[2]
SOURCES_DIR = ROOT / "crawlers" / "sources"


def _literal_bool(node: ast.AST) -> bool | None:
    if isinstance(node, ast.Constant) and isinstance(node.value, bool):
        return node.value
    return None


def extract_declared_capabilities(path: Path) -> dict[str, Any]:
    tree = ast.parse(path.read_text(), filename=str(path))
    declared: dict[str, bool] | None = None

    for node in tree.body:
        if not isinstance(node, ast.Assign):
            continue
        if len(node.targets) != 1:
            continue
        target = node.targets[0]
        if not isinstance(target, ast.Name) or target.id != "SOURCE_ENTITY_CAPABILITIES":
            continue
        value = node.value
        if not isinstance(value, ast.Call):
            continue
        func = value.func
        if not isinstance(func, ast.Name) or func.id != "SourceEntityCapabilities":
            continue
        declared = {}
        for keyword in value.keywords:
            if keyword.arg is None:
                continue
            literal = _literal_bool(keyword.value)
            if literal is not None:
                declared[keyword.arg] = literal
        break

    return {
        "source": path.stem,
        "path": str(path.relative_to(ROOT)),
        "declared": declared is not None,
        "capabilities": declared or {},
    }


def iter_source_files() -> list[Path]:
    return sorted(
        path
        for path in SOURCES_DIR.glob("*.py")
        if not path.name.startswith("_") and path.name != "__init__.py"
    )


def build_report(lane: str | None) -> dict[str, Any]:
    rows = [extract_declared_capabilities(path) for path in iter_source_files()]

    if lane:
        rows = [
            row
            for row in rows
            if row["capabilities"].get(lane) is True
        ]

    declared_rows = [row for row in rows if row["declared"]]
    undeclared_rows = [row for row in rows if not row["declared"]]

    lane_counts: dict[str, int] = {}
    for row in declared_rows:
        for cap_name, enabled in row["capabilities"].items():
            if enabled:
                lane_counts[cap_name] = lane_counts.get(cap_name, 0) + 1

    return {
        "scope": {
            "lane": lane,
            "source_count": len(rows),
        },
        "counts": {
            "declared": len(declared_rows),
            "undeclared": len(undeclared_rows),
            "enabled_lane_counts": lane_counts,
        },
        "sources": rows,
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Audit typed entity capability declarations across crawler sources.",
    )
    parser.add_argument(
        "--lane",
        help="Filter to sources declaring a specific lane, e.g. programs or exhibitions.",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Emit JSON instead of a human-readable summary.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    report = build_report(args.lane)

    if args.json:
        print(json.dumps(report, indent=2))
        return 0

    print("Typed Entity Capability Audit")
    print(f"Sources in scope: {report['scope']['source_count']}")
    print(f"Declared capabilities: {report['counts']['declared']}")
    print(f"Undeclared capabilities: {report['counts']['undeclared']}")
    print()
    print("Enabled lane counts:")
    for lane_name, count in sorted(report["counts"]["enabled_lane_counts"].items()):
        print(f"  {lane_name}: {count}")

    print()
    print("Declared sources:")
    declared_sources = [
        row for row in report["sources"]
        if row["declared"]
    ]
    for row in declared_sources:
        enabled = sorted(
            lane_name for lane_name, value in row["capabilities"].items()
            if value
        )
        print(f"  {row['source']}: {', '.join(enabled) if enabled else '(none enabled)'}")

    if not args.lane:
        print()
        print("Undeclared sources:")
        for row in report["sources"]:
            if not row["declared"]:
                print(f"  {row['source']}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
