#!/usr/bin/env python3
"""
Extract invalid profile files from a patch-status report into a focused queue.
"""

from __future__ import annotations

import argparse
import json
from collections import Counter
from pathlib import Path


def classify_reason(reason: str) -> str:
    text = (reason or "").lower()
    if "data_goals" in text:
        return "unsupported-data-goals"
    if "discovery.type" in text:
        return "unsupported-discovery-type"
    return "other-schema-error"


def build_queue(status_report_path: Path) -> dict:
    report = json.loads(status_report_path.read_text())
    invalid_rows = [row for row in report["rows"] if row["status"] == "invalid"]
    for row in invalid_rows:
        row["error_class"] = classify_reason(row["reason"])

    counts = Counter(row["error_class"] for row in invalid_rows)
    invalid_rows.sort(key=lambda row: (row["error_class"], row["slug"]))

    return {
        "source_report": str(status_report_path),
        "summary": {
            "invalid_profiles": len(invalid_rows),
            "error_counts": dict(sorted(counts.items())),
        },
        "rows": invalid_rows,
    }


def render_markdown(queue: dict, limit: int = 50) -> str:
    summary = queue["summary"]
    rows = queue["rows"]
    lines = [
        "# Profile Schema Drift Queue",
        "",
        f"Source report: `{queue['source_report']}`",
        "",
        "## Summary",
        "",
        f"- Invalid profiles: {summary['invalid_profiles']}",
        f"- Error counts: {', '.join(f'{key}={value}' for key, value in summary['error_counts'].items()) or 'none'}",
        "",
        "## Invalid Profiles",
        "",
        "| Slug | Error Class | Profile Path | Reason |",
        "| --- | --- | --- | --- |",
    ]
    for row in rows[:limit]:
        reason = row["reason"].replace("\n", " ")
        lines.append(f"| {row['slug']} | {row['error_class']} | {row['profile_path']} | {reason} |")
    if len(rows) > limit:
        lines.extend(["", f"_Showing {limit} of {len(rows)} rows._"])
    return "\n".join(lines) + "\n"


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate queue of invalid profile files from patch-status report")
    parser.add_argument("status_report_json", help="Path to profile_goal_patch_status_latest.json")
    parser.add_argument("--markdown-output", help="Optional markdown output path")
    parser.add_argument("--json-output", help="Optional JSON output path")
    args = parser.parse_args()

    queue = build_queue(Path(args.status_report_json))
    markdown = render_markdown(queue)

    if args.markdown_output:
        path = Path(args.markdown_output)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(markdown, encoding="utf-8")
        print(f"Wrote markdown report: {path}")
    else:
        print(markdown, end="")

    if args.json_output:
        path = Path(args.json_output)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(queue, indent=2, sort_keys=True), encoding="utf-8")
        print(f"Wrote JSON report: {path}")

    print("Invalid profiles:", queue["summary"]["invalid_profiles"])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
