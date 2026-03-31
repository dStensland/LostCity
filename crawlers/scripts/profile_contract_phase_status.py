#!/usr/bin/env python3
"""
Build a phase-by-phase status scoreboard for profile-contract rollout.

Phase 0 is evaluated by checking whether the formerly invalid existing profiles
now load under the current schema. Batch phases are evaluated from the existing
profile goal patch status report.
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import date
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from pipeline.loader import load_profile

DEFAULT_REPORT_DIR = ROOT / "reports"


def _load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def _phase_zero_status(drift_plan: dict[str, Any]) -> dict[str, Any]:
    rows = drift_plan["rows"]
    complete = 0
    pending = 0
    invalid_rows: list[str] = []
    for row in rows:
        slug = row["slug"]
        try:
            load_profile(slug)
            complete += 1
        except Exception:
            pending += 1
            invalid_rows.append(slug)

    status = "complete" if pending == 0 else "pending"
    return {
        "phase": 0,
        "name": "fix-invalid-existing-profiles",
        "status": status,
        "rows": len(rows),
        "complete_rows": complete,
        "pending_rows": pending,
        "top_pending_slugs": invalid_rows[:5],
        "reason": "phase 0 complete" if pending == 0 else "schema-invalid existing profiles remain",
    }


def _batch_phase_status(rollout_phase: dict[str, Any], batch_summaries: dict[str, dict[str, int]]) -> dict[str, Any]:
    counts = dict(batch_summaries.get(rollout_phase["name"], {}))
    total = int(rollout_phase["count"])
    complete = int(counts.get("applied", 0))
    pending = total - complete
    status = "complete" if pending == 0 else "pending"
    return {
        "phase": rollout_phase["phase"],
        "name": rollout_phase["name"],
        "status": status,
        "rows": total,
        "complete_rows": complete,
        "pending_rows": pending,
        "reason": "batch complete" if pending == 0 else "batch still has unapplied rows",
    }


def _normalize_patch_check_status(phase_row: dict[str, Any], patch_check_status: str) -> str:
    if phase_row["status"] == "complete" and patch_check_status == "blocked":
        return "already_applied"
    return patch_check_status


def build_phase_status(
    rollout_path: Path,
    drift_plan_path: Path,
    patch_status_path: Path,
    patch_check_path: Path,
) -> dict[str, Any]:
    rollout = _load_json(rollout_path)
    drift_plan = _load_json(drift_plan_path)
    patch_status = _load_json(patch_status_path)
    patch_check = _load_json(patch_check_path)

    batch_summaries = {
        row["batch"]: row["status_counts"]
        for row in patch_status.get("batch_summaries", [])
    }
    patch_check_by_phase = {
        row["phase"]: row
        for row in patch_check.get("rows", [])
    }

    phases: list[dict[str, Any]] = []
    phase0 = _phase_zero_status(drift_plan)
    phase0_key = "phase_00_fix-invalid-existing-profiles"
    phase0["patch_check_status"] = _normalize_patch_check_status(
        phase0,
        patch_check_by_phase.get(phase0_key, {}).get("status", "unknown"),
    )
    phases.append(phase0)

    for rollout_phase in rollout["phases"][1:]:
        row = _batch_phase_status(rollout_phase, batch_summaries)
        key = f"phase_{rollout_phase['phase']:02d}_{rollout_phase['name']}"
        row["patch_check_status"] = _normalize_patch_check_status(
            row,
            patch_check_by_phase.get(key, {}).get("status", "unknown"),
        )
        phases.append(row)

    complete_phases = sum(1 for row in phases if row["status"] == "complete")
    pending_phases = sum(1 for row in phases if row["status"] == "pending")
    blocked_phases = sum(1 for row in phases if row.get("patch_check_status") == "blocked")

    return {
        "summary": {
            "phases": len(phases),
            "complete_phases": complete_phases,
            "pending_phases": pending_phases,
            "blocked_phases": blocked_phases,
        },
        "rows": phases,
    }


def render_markdown(report: dict[str, Any]) -> str:
    summary = report["summary"]
    lines = [
        "# Profile Contract Phase Status",
        "",
        "## Summary",
        "",
        f"- Phases: {summary['phases']}",
        f"- Complete phases: {summary['complete_phases']}",
        f"- Pending phases: {summary['pending_phases']}",
        f"- Blocked phases: {summary['blocked_phases']}",
        "",
        "## Phase Scoreboard",
        "",
        "| Phase | Name | Status | Rows | Complete | Pending | Patch Check | Reason |",
        "| --- | --- | --- | ---: | ---: | ---: | --- | --- |",
    ]
    for row in report["rows"]:
        lines.append(
            f"| {row['phase']} | {row['name']} | {row['status']} | {row['rows']} | "
            f"{row['complete_rows']} | {row['pending_rows']} | {row.get('patch_check_status', 'unknown')} | {row['reason']} |"
        )

    pending_with_slugs = [row for row in report["rows"] if row.get("top_pending_slugs")]
    if pending_with_slugs:
        lines.extend(["", "## Pending Phase Details", ""])
        for row in pending_with_slugs:
            lines.append(f"### Phase {row['phase']}: {row['name']}")
            lines.append("")
            lines.append(f"- Pending slugs: {', '.join(row['top_pending_slugs'])}")
            lines.append("")

    return "\n".join(lines).rstrip() + "\n"


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate phase-by-phase profile-contract rollout status")
    parser.add_argument("rollout_json", help="Path to profile_contract_rollout_latest.json")
    parser.add_argument("drift_plan_json", help="Path to profile_schema_drift_patch_plan_latest.json")
    parser.add_argument("patch_status_json", help="Path to profile_goal_patch_status_latest.json")
    parser.add_argument("patch_check_json", help="Path to profile_contract_patch_check_latest.json")
    parser.add_argument("--markdown-output", help="Optional markdown output path")
    parser.add_argument("--json-output", help="Optional JSON output path")
    args = parser.parse_args()

    report = build_phase_status(
        rollout_path=Path(args.rollout_json),
        drift_plan_path=Path(args.drift_plan_json),
        patch_status_path=Path(args.patch_status_json),
        patch_check_path=Path(args.patch_check_json),
    )
    markdown = render_markdown(report)

    markdown_path = (
        Path(args.markdown_output)
        if args.markdown_output
        else DEFAULT_REPORT_DIR / f"profile_contract_phase_status_{date.today().isoformat()}.md"
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
        "Phase status summary:",
        f"complete={report['summary']['complete_phases']}, pending={report['summary']['pending_phases']}",
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
