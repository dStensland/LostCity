#!/usr/bin/env python3
"""
Refresh all profile-contract rollout reports after a phase is applied.

This is the single post-apply command for the session that owns
`crawlers/sources/profiles/`. It rebuilds:
- profile goal patch status
- patch applicability check
- phase scoreboard
- next-step recommendation
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

from scripts.profile_contract_next_step import build_recommendation, render_markdown as render_next_step
from scripts.profile_contract_patch_check import build_report as build_patch_check, render_markdown as render_patch_check
from scripts.profile_contract_phase_status import build_phase_status, render_markdown as render_phase_status
from scripts.profile_goal_patch_status import build_status_report, render_markdown as render_patch_status

DEFAULT_REPORT_DIR = ROOT / "reports"


def build_output_paths(report_dir: Path, report_date: str) -> dict[str, Path]:
    return {
        "patch_status_md": report_dir / f"profile_goal_patch_status_{report_date}.md",
        "patch_status_json": report_dir / "profile_goal_patch_status_latest.json",
        "patch_check_md": report_dir / f"profile_contract_patch_check_{report_date}.md",
        "patch_check_json": report_dir / "profile_contract_patch_check_latest.json",
        "phase_status_md": report_dir / f"profile_contract_phase_status_{report_date}.md",
        "phase_status_json": report_dir / "profile_contract_phase_status_latest.json",
        "next_step_md": report_dir / f"profile_contract_next_step_{report_date}.md",
        "next_step_json": report_dir / "profile_contract_next_step_latest.json",
    }


def _write_report(markdown_path: Path, json_path: Path, markdown: str, data: dict[str, Any]) -> None:
    markdown_path.parent.mkdir(parents=True, exist_ok=True)
    markdown_path.write_text(markdown, encoding="utf-8")
    json_path.parent.mkdir(parents=True, exist_ok=True)
    json_path.write_text(json.dumps(data, indent=2, sort_keys=True), encoding="utf-8")


def refresh_reports(*, batch_dir: Path, packet_dir: Path, rollout_json: Path, drift_plan_json: Path, report_dir: Path) -> dict[str, Any]:
    report_date = date.today().isoformat()
    output_paths = build_output_paths(report_dir, report_date)

    patch_status = build_status_report(batch_dir)
    _write_report(
        output_paths["patch_status_md"],
        output_paths["patch_status_json"],
        render_patch_status(patch_status),
        patch_status,
    )

    patch_check = build_patch_check(packet_dir)
    _write_report(
        output_paths["patch_check_md"],
        output_paths["patch_check_json"],
        render_patch_check(patch_check),
        patch_check,
    )

    phase_status = build_phase_status(
        rollout_path=rollout_json,
        drift_plan_path=drift_plan_json,
        patch_status_path=output_paths["patch_status_json"],
        patch_check_path=output_paths["patch_check_json"],
    )
    _write_report(
        output_paths["phase_status_md"],
        output_paths["phase_status_json"],
        render_phase_status(phase_status),
        phase_status,
    )

    next_step = build_recommendation(
        rollout_path=rollout_json,
        patch_check_path=output_paths["patch_check_json"],
        status_path=output_paths["patch_status_json"],
        packet_dir=packet_dir,
        phase_status_path=output_paths["phase_status_json"],
    )
    _write_report(
        output_paths["next_step_md"],
        output_paths["next_step_json"],
        render_next_step(next_step),
        next_step,
    )

    return {
        "report_date": report_date,
        "output_paths": {key: str(value) for key, value in output_paths.items()},
        "summary": {
            "patch_status_counts": patch_status["summary"]["status_counts"],
            "patch_check": patch_check["summary"],
            "phase_status": phase_status["summary"],
            "next_step_status": next_step["status"],
            "next_phase": (next_step.get("next_phase") or {}).get("name"),
        },
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Refresh all profile-contract rollout reports")
    parser.add_argument("batch_dir", help="Directory created by profile_goal_patch_batches.py")
    parser.add_argument("packet_dir", help="Directory created by profile_contract_patch_packets.py")
    parser.add_argument("rollout_json", help="Path to profile_contract_rollout_latest.json")
    parser.add_argument("drift_plan_json", help="Path to profile_schema_drift_patch_plan_latest.json")
    parser.add_argument("--report-dir", help="Optional report directory override")
    args = parser.parse_args()

    report = refresh_reports(
        batch_dir=Path(args.batch_dir),
        packet_dir=Path(args.packet_dir),
        rollout_json=Path(args.rollout_json),
        drift_plan_json=Path(args.drift_plan_json),
        report_dir=Path(args.report_dir) if args.report_dir else DEFAULT_REPORT_DIR,
    )

    print("Refreshed profile-contract reports")
    print(json.dumps(report["summary"], sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
