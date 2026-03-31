#!/usr/bin/env python3
"""
Validate whether profile goal patch batches have been applied.

Reads a batch directory produced by profile_goal_patch_batches.py and checks the
current state of crawler profiles on disk against the recommended data_goals.
"""

from __future__ import annotations

import argparse
import json
import sys
from collections import Counter
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from pipeline.loader import find_profile_path, load_profile


@dataclass
class PatchStatusRow:
    slug: str
    profile_action: str
    profile_path: str
    recommended_goals: list[str]
    actual_goals: list[str]
    status: str
    reason: str


def evaluate_row(row: dict[str, Any]) -> PatchStatusRow:
    slug = row["slug"]
    recommended = list(row.get("recommended_goals") or [])
    expected_path = Path(row["profile_path"])
    actual_path = find_profile_path(slug)

    if actual_path is None:
        return PatchStatusRow(
            slug=slug,
            profile_action=row["profile_action"],
            profile_path=str(expected_path),
            recommended_goals=recommended,
            actual_goals=[],
            status="missing",
            reason="profile file does not exist yet",
        )

    try:
        profile = load_profile(slug)
    except Exception as exc:
        return PatchStatusRow(
            slug=slug,
            profile_action=row["profile_action"],
            profile_path=str(actual_path),
            recommended_goals=recommended,
            actual_goals=[],
            status="invalid",
            reason=f"profile failed to load: {exc}",
        )

    actual_goals = list(profile.data_goals or [])
    if actual_goals == recommended:
        return PatchStatusRow(
            slug=slug,
            profile_action=row["profile_action"],
            profile_path=str(actual_path),
            recommended_goals=recommended,
            actual_goals=actual_goals,
            status="applied",
            reason="profile data_goals match recommendation",
        )

    if not actual_goals:
        return PatchStatusRow(
            slug=slug,
            profile_action=row["profile_action"],
            profile_path=str(actual_path),
            recommended_goals=recommended,
            actual_goals=actual_goals,
            status="pending",
            reason="profile exists but has no data_goals",
        )

    return PatchStatusRow(
        slug=slug,
        profile_action=row["profile_action"],
        profile_path=str(actual_path),
        recommended_goals=recommended,
        actual_goals=actual_goals,
        status="mismatch",
        reason="profile data_goals differ from recommendation",
    )


def load_batches(batch_dir: Path) -> list[tuple[str, list[dict[str, Any]]]]:
    batches: list[tuple[str, list[dict[str, Any]]]] = []
    for path in sorted(batch_dir.glob("batch_*.json")):
        rows = json.loads(path.read_text())
        batches.append((path.stem, rows))
    return batches


def build_status_report(batch_dir: Path) -> dict[str, Any]:
    batch_rows = load_batches(batch_dir)
    statuses: list[dict[str, Any]] = []
    batch_summaries: list[dict[str, Any]] = []

    for batch_name, rows in batch_rows:
        evaluated = [asdict(evaluate_row(row)) for row in rows]
        counts = Counter(row["status"] for row in evaluated)
        statuses.extend({"batch": batch_name, **row} for row in evaluated)
        batch_summaries.append(
            {
                "batch": batch_name,
                "total": len(evaluated),
                "status_counts": dict(sorted(counts.items())),
            }
        )

    overall_counts = Counter(row["status"] for row in statuses)
    return {
        "batch_dir": str(batch_dir),
        "summary": {
            "batches": len(batch_summaries),
            "rows": len(statuses),
            "status_counts": dict(sorted(overall_counts.items())),
        },
        "batch_summaries": batch_summaries,
        "rows": statuses,
    }


def render_markdown(report: dict[str, Any], limit: int = 50) -> str:
    summary = report["summary"]
    lines = [
        "# Profile Goal Patch Status",
        "",
        f"Batch dir: `{report['batch_dir']}`",
        "",
        "## Summary",
        "",
        f"- Batches: {summary['batches']}",
        f"- Rows: {summary['rows']}",
        f"- Status counts: {', '.join(f'{key}={value}' for key, value in summary['status_counts'].items()) or 'none'}",
        "",
        "## Batch Summary",
        "",
        "| Batch | Total | Status Counts |",
        "| --- | ---: | --- |",
    ]
    for row in report["batch_summaries"]:
        counts = ", ".join(f"{key}={value}" for key, value in row["status_counts"].items()) or "none"
        lines.append(f"| {row['batch']} | {row['total']} | {counts} |")

    lines.extend(["", "## Pending Work", "", "| Batch | Slug | Status | Reason |", "| --- | --- | --- | --- |"])
    pending_rows = [row for row in report["rows"] if row["status"] != "applied"]
    for row in pending_rows[:limit]:
        lines.append(f"| {row['batch']} | {row['slug']} | {row['status']} | {row['reason']} |")
    if len(pending_rows) > limit:
        lines.extend(["", f"_Showing {limit} of {len(pending_rows)} pending rows._"])

    return "\n".join(lines) + "\n"


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate profile goal patch batches against current profile files")
    parser.add_argument("batch_dir", help="Directory created by profile_goal_patch_batches.py")
    parser.add_argument("--markdown-output", help="Optional markdown output path")
    parser.add_argument("--json-output", help="Optional JSON output path")
    args = parser.parse_args()

    batch_dir = Path(args.batch_dir)
    report = build_status_report(batch_dir)

    markdown = render_markdown(report)
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
        path.write_text(json.dumps(report, indent=2, sort_keys=True), encoding="utf-8")
        print(f"Wrote JSON report: {path}")

    counts = report["summary"]["status_counts"]
    print("Status counts:", ", ".join(f"{key}={value}" for key, value in counts.items()) or "none")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
