#!/usr/bin/env python3
"""
Execute the currently recommended profile-contract rollout phase.

This reads the current rollout state, resolves the next recommended phase, and
then delegates to the guarded phase executor in check-only or apply mode.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any, Callable

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from scripts.profile_contract_execute_phase import execute_phase, render_markdown as render_execution
from scripts.profile_contract_next_step import build_recommendation

DEFAULT_REPORT_DIR = ROOT / "reports"


def run_next_phase(
    *,
    rollout_json: Path,
    patch_check_json: Path,
    patch_status_json: Path,
    packet_dir: Path,
    repo_root: Path,
    apply: bool,
    refresh: bool,
    batch_dir: Path | None = None,
    drift_plan_json: Path | None = None,
    report_dir: Path | None = None,
    phase_status_json: Path | None = None,
    recommendation_fn: Callable[..., dict[str, Any]] = build_recommendation,
    execute_fn: Callable[..., dict[str, Any]] = execute_phase,
) -> dict[str, Any]:
    recommendation = recommendation_fn(
        rollout_path=rollout_json,
        patch_check_path=patch_check_json,
        status_path=patch_status_json,
        packet_dir=packet_dir,
        phase_status_path=phase_status_json,
    )

    result: dict[str, Any] = {
        "recommendation": recommendation,
        "execution": None,
    }

    next_phase = recommendation.get("next_phase")
    if not next_phase:
        return result

    result["execution"] = execute_fn(
        phase=int(next_phase["phase"]),
        packet_dir=packet_dir,
        repo_root=repo_root,
        apply=apply,
        refresh=refresh and apply,
        batch_dir=batch_dir,
        rollout_json=rollout_json,
        drift_plan_json=drift_plan_json,
        report_dir=report_dir,
    )
    return result


def render_markdown(result: dict[str, Any]) -> str:
    recommendation = result["recommendation"]
    lines = [
        "# Profile Contract Run Next",
        "",
        f"- Recommendation status: {recommendation['status']}",
        f"- Reason: {recommendation['reason']}",
        "",
    ]

    next_phase = recommendation.get("next_phase")
    if not next_phase:
        lines.append("_No phase to execute._")
        return "\n".join(lines) + "\n"

    lines.extend(
        [
            "## Recommended Phase",
            "",
            f"- Phase: {next_phase['phase']} ({next_phase['name']})",
            f"- Packet: `{next_phase['packet_path']}`",
            f"- Patch check: {next_phase['patch_check_status']}",
            "",
            "## Execution",
            "",
        ]
    )

    execution = result.get("execution")
    if execution is None:
        lines.append("_Execution not attempted._")
        return "\n".join(lines) + "\n"

    lines.append(render_execution(execution).rstrip())
    return "\n".join(lines).rstrip() + "\n"


def main() -> int:
    parser = argparse.ArgumentParser(description="Execute the current recommended profile-contract phase")
    parser.add_argument("rollout_json", help="Path to profile_contract_rollout_latest.json")
    parser.add_argument("patch_check_json", help="Path to profile_contract_patch_check_latest.json")
    parser.add_argument("patch_status_json", help="Path to profile_goal_patch_status_latest.json")
    parser.add_argument("packet_dir", help="Directory created by profile_contract_patch_packets.py")
    parser.add_argument("--apply", action="store_true", help="Actually apply the recommended patch")
    parser.add_argument("--repo-root", help="Override repo root")
    parser.add_argument("--no-refresh", action="store_true", help="Skip report refresh after successful apply")
    parser.add_argument("--batch-dir", help="Required for refresh when --apply is used")
    parser.add_argument("--drift-plan-json", help="Required for refresh when --apply is used")
    parser.add_argument("--report-dir", help="Optional refresh report directory override")
    parser.add_argument("--markdown-output", help="Optional markdown output path")
    parser.add_argument("--json-output", help="Optional JSON output path")
    args = parser.parse_args()

    result = run_next_phase(
        rollout_json=Path(args.rollout_json),
        patch_check_json=Path(args.patch_check_json),
        patch_status_json=Path(args.patch_status_json),
        packet_dir=Path(args.packet_dir),
        repo_root=Path(args.repo_root) if args.repo_root else ROOT.parent,
        apply=args.apply,
        refresh=not args.no_refresh,
        batch_dir=Path(args.batch_dir) if args.batch_dir else None,
        drift_plan_json=Path(args.drift_plan_json) if args.drift_plan_json else None,
        report_dir=Path(args.report_dir) if args.report_dir else None,
        phase_status_json=DEFAULT_REPORT_DIR / "profile_contract_phase_status_latest.json",
    )

    markdown = render_markdown(result)
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
        path.write_text(json.dumps(result, indent=2, sort_keys=True), encoding="utf-8")
        print(f"Wrote JSON report: {path}")

    execution = result.get("execution") or {}
    print(
        "Run-next result:",
        json.dumps(
            {
                "recommendation_status": result["recommendation"]["status"],
                "phase": (result["recommendation"].get("next_phase") or {}).get("phase"),
                "check_ok": execution.get("check_ok"),
                "applied": execution.get("applied"),
            },
            sort_keys=True,
        ),
    )
    if result["recommendation"]["status"] == "done":
        return 0
    return 0 if execution.get("check_ok") else 1


if __name__ == "__main__":
    raise SystemExit(main())
