#!/usr/bin/env python3
"""
Build a single ordered rollout queue for profile-contract remediation.

Phase 0 fixes invalid existing profiles that currently fail schema validation.
Subsequent phases apply the generated goal patch batches for missing or
under-specified profiles.
"""

from __future__ import annotations

import argparse
import json
from datetime import date
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_REPORT_DIR = ROOT / "reports"


def _load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def build_rollout(drift_plan_path: Path, batch_dir: Path, status_report_path: Path) -> dict[str, Any]:
    drift_plan = _load_json(drift_plan_path)
    status_report = _load_json(status_report_path)

    batches: list[dict[str, Any]] = []
    batch_rows_total = 0
    for batch_path in sorted(batch_dir.glob("batch_*.json")):
        rows = _load_json(batch_path)
        batch_rows_total += len(rows)
        batches.append(
            {
                "batch": batch_path.stem,
                "count": len(rows),
                "top_slugs": [row["slug"] for row in rows[:5]],
                "path": str(batch_path),
                "markdown_path": str(batch_path.with_suffix(".md")),
            }
        )

    status_counts = dict(status_report["summary"]["status_counts"])
    phases = [
        {
            "phase": 0,
            "name": "fix-invalid-existing-profiles",
            "count": drift_plan["summary"]["invalid_profiles"],
            "path": str(drift_plan_path),
            "markdown_path": str(
                drift_plan_path.with_name(drift_plan_path.name.replace("_latest.json", f"_{date.today().isoformat()}.md"))
            )
            if drift_plan_path.name.endswith("_latest.json")
            else None,
            "rows": drift_plan["rows"],
        }
    ]

    for index, batch in enumerate(batches, start=1):
        phases.append(
            {
                "phase": index,
                "name": batch["batch"],
                "count": batch["count"],
                "path": batch["path"],
                "markdown_path": batch["markdown_path"],
                "top_slugs": batch["top_slugs"],
            }
        )

    return {
        "drift_plan_path": str(drift_plan_path),
        "batch_dir": str(batch_dir),
        "status_report_path": str(status_report_path),
        "summary": {
            "invalid_preflight_profiles": drift_plan["summary"]["invalid_profiles"],
            "batch_count": len(batches),
            "batch_rows": batch_rows_total,
            "status_counts": status_counts,
        },
        "phases": phases,
    }


def render_markdown(report: dict[str, Any]) -> str:
    summary = report["summary"]
    phases = report["phases"]
    lines = [
        "# Profile Contract Rollout",
        "",
        f"Status report: `{report['status_report_path']}`",
        f"Drift plan: `{report['drift_plan_path']}`",
        f"Batch dir: `{report['batch_dir']}`",
        "",
        "## Summary",
        "",
        f"- Preflight invalid profiles: {summary['invalid_preflight_profiles']}",
        f"- Patch batches: {summary['batch_count']}",
        f"- Batch rows: {summary['batch_rows']}",
        f"- Current patch status: {', '.join(f'{key}={value}' for key, value in summary['status_counts'].items()) or 'none'}",
        "",
        "## Execution Order",
        "",
    ]

    for phase in phases:
        lines.append(f"### Phase {phase['phase']}: {phase['name']}")
        lines.append("")
        lines.append(f"- Rows: {phase['count']}")
        if phase.get("markdown_path"):
            lines.append(f"- Markdown: `{phase['markdown_path']}`")
        lines.append(f"- JSON: `{phase['path']}`")
        top_slugs = phase.get("top_slugs") or []
        if top_slugs:
            lines.append(f"- First slugs: {', '.join(top_slugs)}")
        if phase["phase"] == 0:
            lines.append("- Purpose: clear schema-invalid blockers before applying new profile batches")
        else:
            lines.append("- Purpose: apply the next profile goal batch and re-run status after the batch lands")
        lines.append("")

    lines.extend(
        [
            "## Verification",
            "",
            "1. Apply phase 0 fixes from the drift patch plan.",
            "2. Apply one batch at a time from the profile goal patch batches.",
            "3. Re-run `python3 /Users/coach/Projects/LostCity/crawlers/scripts/profile_goal_patch_status.py /Users/coach/Projects/LostCity/crawlers/reports/profile_goal_patch_batches_2026-03-31 --markdown-output /Users/coach/Projects/LostCity/crawlers/reports/profile_goal_patch_status_$(date +%F).md --json-output /Users/coach/Projects/LostCity/crawlers/reports/profile_goal_patch_status_latest.json`.",
            "4. Confirm `invalid=0` before evaluating remaining `missing` rows.",
        ]
    )

    return "\n".join(lines).rstrip() + "\n"


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate ordered rollout plan for profile contract remediation")
    parser.add_argument("drift_plan_json", help="Path to profile_schema_drift_patch_plan_latest.json")
    parser.add_argument("batch_dir", help="Directory created by profile_goal_patch_batches.py")
    parser.add_argument("status_report_json", help="Path to profile_goal_patch_status_latest.json")
    parser.add_argument("--markdown-output", help="Optional markdown output path")
    parser.add_argument("--json-output", help="Optional JSON output path")
    args = parser.parse_args()

    report = build_rollout(
        drift_plan_path=Path(args.drift_plan_json),
        batch_dir=Path(args.batch_dir),
        status_report_path=Path(args.status_report_json),
    )
    markdown = render_markdown(report)

    markdown_path = (
        Path(args.markdown_output)
        if args.markdown_output
        else DEFAULT_REPORT_DIR / f"profile_contract_rollout_{date.today().isoformat()}.md"
    )
    markdown_path.parent.mkdir(parents=True, exist_ok=True)
    markdown_path.write_text(markdown, encoding="utf-8")
    print(f"Wrote markdown report: {markdown_path}")

    if args.json_output:
        json_path = Path(args.json_output)
        json_path.parent.mkdir(parents=True, exist_ok=True)
        json_path.write_text(json.dumps(report, indent=2, sort_keys=True), encoding="utf-8")
        print(f"Wrote JSON report: {json_path}")

    print(
        "Rollout summary:",
        f"preflight={report['summary']['invalid_preflight_profiles']}, "
        f"batches={report['summary']['batch_count']}, rows={report['summary']['batch_rows']}",
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
