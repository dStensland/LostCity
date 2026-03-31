#!/usr/bin/env python3
"""
Reverse the most recently completed profile-contract rollout phase.

This is the rollback companion to the forward execution wrappers. It resolves
the highest-numbered completed phase from the live phase scoreboard, then
delegates to the guarded phase executor in reverse mode.
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


def _load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def select_latest_completed_phase(phase_status_path: Path) -> dict[str, Any] | None:
    phase_status = _load_json(phase_status_path)
    completed = [row for row in phase_status.get("rows", []) if row.get("status") == "complete"]
    if not completed:
        return None
    return max(completed, key=lambda row: int(row["phase"]))


def reverse_latest_phase(
    *,
    phase_status_json: Path,
    packet_dir: Path,
    repo_root: Path,
    apply: bool,
    refresh: bool,
    batch_dir: Path | None = None,
    rollout_json: Path | None = None,
    drift_plan_json: Path | None = None,
    report_dir: Path | None = None,
    phase_selector: Callable[[Path], dict[str, Any] | None] = select_latest_completed_phase,
    execute_fn: Callable[..., dict[str, Any]] = execute_phase,
) -> dict[str, Any]:
    phase = phase_selector(phase_status_json)
    result: dict[str, Any] = {
        "phase_status_path": str(phase_status_json),
        "selected_phase": phase,
        "execution": None,
    }
    if phase is None:
        return result

    result["execution"] = execute_fn(
        phase=int(phase["phase"]),
        packet_dir=packet_dir,
        repo_root=repo_root,
        apply=apply,
        refresh=refresh and apply,
        reverse=True,
        batch_dir=batch_dir,
        rollout_json=rollout_json,
        drift_plan_json=drift_plan_json,
        report_dir=report_dir,
    )
    return result


def render_markdown(result: dict[str, Any]) -> str:
    lines = [
        "# Profile Contract Reverse Latest",
        "",
        f"- Phase status: `{result['phase_status_path']}`",
        "",
    ]

    selected_phase = result.get("selected_phase")
    if selected_phase is None:
        lines.append("_No completed phase is available to reverse._")
        return "\n".join(lines) + "\n"

    lines.extend(
        [
            "## Selected Phase",
            "",
            f"- Phase: {selected_phase['phase']} ({selected_phase['name']})",
            f"- Rows: {selected_phase['rows']}",
            f"- Status: {selected_phase['status']}",
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
    parser = argparse.ArgumentParser(description="Reverse the latest completed profile-contract phase")
    parser.add_argument("phase_status_json", help="Path to profile_contract_phase_status_latest.json")
    parser.add_argument("packet_dir", help="Directory created by profile_contract_patch_packets.py")
    parser.add_argument("--apply", action="store_true", help="Actually reverse-apply the phase patch")
    parser.add_argument("--repo-root", help="Override repo root")
    parser.add_argument("--no-refresh", action="store_true", help="Skip report refresh after successful reverse apply")
    parser.add_argument("--batch-dir", help="Required for refresh when --apply is used")
    parser.add_argument("--rollout-json", help="Required for refresh when --apply is used")
    parser.add_argument("--drift-plan-json", help="Required for refresh when --apply is used")
    parser.add_argument("--report-dir", help="Optional refresh report directory override")
    parser.add_argument("--markdown-output", help="Optional markdown output path")
    parser.add_argument("--json-output", help="Optional JSON output path")
    args = parser.parse_args()

    result = reverse_latest_phase(
        phase_status_json=Path(args.phase_status_json),
        packet_dir=Path(args.packet_dir),
        repo_root=Path(args.repo_root) if args.repo_root else ROOT.parent,
        apply=args.apply,
        refresh=not args.no_refresh,
        batch_dir=Path(args.batch_dir) if args.batch_dir else None,
        rollout_json=Path(args.rollout_json) if args.rollout_json else None,
        drift_plan_json=Path(args.drift_plan_json) if args.drift_plan_json else None,
        report_dir=Path(args.report_dir) if args.report_dir else None,
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
    selected_phase = result.get("selected_phase") or {}
    print(
        "Reverse-latest result:",
        json.dumps(
            {
                "selected_phase": selected_phase.get("phase"),
                "check_ok": execution.get("check_ok"),
                "applied": execution.get("applied"),
            },
            sort_keys=True,
        ),
    )
    if selected_phase == {}:
        return 0
    return 0 if execution.get("check_ok") else 1


if __name__ == "__main__":
    raise SystemExit(main())
