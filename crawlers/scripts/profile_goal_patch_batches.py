#!/usr/bin/env python3
"""
Split the profile goal patch plan into manageable batch handoff packets.
"""

from __future__ import annotations

import argparse
import json
import sys
from dataclasses import dataclass
from datetime import date
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from scripts.profile_goal_patch_plan import build_patch_plan

DEFAULT_REPORT_DIR = ROOT / "reports"


@dataclass
class BatchSummary:
    index: int
    size: int
    first_slug: str
    last_slug: str


def chunk_rows(rows: list[dict[str, Any]], batch_size: int) -> list[list[dict[str, Any]]]:
    return [rows[idx : idx + batch_size] for idx in range(0, len(rows), batch_size)]


def render_batch_markdown(batch_rows: list[dict[str, Any]], *, batch_index: int, batch_count: int) -> str:
    lines = [
        f"# Profile Goal Patch Batch {batch_index} of {batch_count}",
        "",
        f"- Rows in batch: {len(batch_rows)}",
        "",
        "| Profile Action | Slug | Portal | File | Recommended Goals |",
        "| --- | --- | --- | --- | --- |",
    ]
    for row in batch_rows:
        lines.append(
            f"| {row['profile_action']} | {row['slug']} | {row['portal_slug']} | {row['profile_path']} | "
            f"{', '.join(row['recommended_goals']) or '-'} |"
        )

    lines.extend(["", "## YAML Snippets", ""])
    for row in batch_rows:
        lines.append(f"### {row['slug']}")
        lines.append("")
        lines.append(f"Target: `{row['profile_path']}`")
        lines.append("")
        lines.append("```yaml")
        lines.append(row["yaml_snippet"])
        lines.append("```")
        lines.append("")

    return "\n".join(lines).rstrip() + "\n"


def build_batches(batch_size: int, include_inactive: bool = False, portal_slug: str | None = None) -> dict[str, Any]:
    report = build_patch_plan(include_inactive=include_inactive, portal_slug=portal_slug)
    rows = report["rows"]
    batches = chunk_rows(rows, batch_size)
    batch_summaries = [
        BatchSummary(
            index=idx + 1,
            size=len(batch),
            first_slug=batch[0]["slug"],
            last_slug=batch[-1]["slug"],
        )
        for idx, batch in enumerate(batches)
        if batch
    ]

    return {
        "generated_at": report["generated_at"],
        "scope": report["scope"],
        "summary": {
            "patch_candidates": report["summary"]["patch_candidates"],
            "batch_size": batch_size,
            "batch_count": len(batches),
            "profile_action_counts": report["summary"]["profile_action_counts"],
        },
        "batch_summaries": [summary.__dict__ for summary in batch_summaries],
        "batches": batches,
    }


def render_index_markdown(report: dict[str, Any]) -> str:
    summary = report["summary"]
    lines = [
        f"# Profile Goal Patch Batches - {report['generated_at'][:10]}",
        "",
        f"- Patch candidates: {summary['patch_candidates']}",
        f"- Batch size: {summary['batch_size']}",
        f"- Batch count: {summary['batch_count']}",
        f"- Profile actions: {', '.join(f'{key}={value}' for key, value in summary['profile_action_counts'].items()) or 'none'}",
        "",
        "| Batch | Size | First Slug | Last Slug |",
        "| --- | ---: | --- | --- |",
    ]
    for row in report["batch_summaries"]:
        lines.append(f"| {row['index']} | {row['size']} | {row['first_slug']} | {row['last_slug']} |")
    return "\n".join(lines) + "\n"


def main() -> int:
    parser = argparse.ArgumentParser(description="Split profile goal patch plan into batches")
    parser.add_argument("--batch-size", type=int, default=20, help="Rows per batch")
    parser.add_argument("--include-inactive", action="store_true", help="Include inactive sources")
    parser.add_argument("--portal", help="Limit review to a single portal slug")
    parser.add_argument("--output-dir", help="Output directory")
    args = parser.parse_args()

    batch_size = max(1, args.batch_size)
    report = build_batches(batch_size=batch_size, include_inactive=args.include_inactive, portal_slug=args.portal)

    output_dir = Path(args.output_dir) if args.output_dir else DEFAULT_REPORT_DIR / f"profile_goal_patch_batches_{date.today().isoformat()}"
    output_dir.mkdir(parents=True, exist_ok=True)

    index_path = output_dir / "index.md"
    index_path.write_text(render_index_markdown(report), encoding="utf-8")

    json_path = output_dir / "index.json"
    json_path.write_text(json.dumps(report, indent=2, sort_keys=True), encoding="utf-8")

    batch_count = report["summary"]["batch_count"]
    padding = len(str(max(1, batch_count)))
    for idx, batch_rows in enumerate(report["batches"], start=1):
        batch_name = f"batch_{idx:0{padding}d}"
        markdown_path = output_dir / f"{batch_name}.md"
        json_batch_path = output_dir / f"{batch_name}.json"
        markdown_path.write_text(
            render_batch_markdown(batch_rows, batch_index=idx, batch_count=batch_count),
            encoding="utf-8",
        )
        json_batch_path.write_text(json.dumps(batch_rows, indent=2, sort_keys=True), encoding="utf-8")

    print(f"Wrote batch directory: {output_dir}")
    print(f"Batches: {batch_count}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
