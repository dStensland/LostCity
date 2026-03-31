#!/usr/bin/env python3
"""
Recommend the next executable step for the profile-contract rollout.

This merges rollout order, patch apply checks, and current patch status into a
single current recommendation.
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


def _phase_packet_path(packet_dir: Path, phase_number: int, phase_name: str) -> Path:
    return packet_dir / f"phase_{phase_number:02d}_{phase_name}.patch"


def _phase_zero_pending(rollout: dict[str, Any], phase_status_path: Path | None) -> bool:
    if phase_status_path and phase_status_path.exists():
        phase_status = _load_json(phase_status_path)
        phase_zero = next((row for row in phase_status.get("rows", []) if int(row.get("phase", -1)) == 0), None)
        if phase_zero is not None:
            return phase_zero.get("status") != "complete"
    return int(rollout["summary"].get("invalid_preflight_profiles", 0)) > 0


def build_recommendation(
    rollout_path: Path,
    patch_check_path: Path,
    status_path: Path,
    packet_dir: Path,
    phase_status_path: Path | None = None,
) -> dict[str, Any]:
    rollout = _load_json(rollout_path)
    patch_check = _load_json(patch_check_path)
    status = _load_json(status_path)

    patch_check_by_phase = {row["phase"]: row for row in patch_check["rows"]}
    pending_batches = {
        row["batch"]: row["status_counts"]
        for row in status.get("batch_summaries", [])
        if row.get("status_counts")
    }

    next_phase: dict[str, Any] | None = None
    reason = ""

    if _phase_zero_pending(rollout, phase_status_path):
        next_phase = rollout["phases"][0]
        reason = "schema-invalid existing profiles still need phase-0 remediation before batch rollout can start"
    else:
        for phase in rollout["phases"][1:]:
            batch_name = phase["name"]
            counts = pending_batches.get(batch_name, {})
            if any(counts.get(key, 0) > 0 for key in ("missing", "pending", "mismatch", "invalid")):
                next_phase = phase
                reason = f"{batch_name} still has unapplied rows"
                break

    if next_phase is None:
        return {
            "status": "done",
            "reason": "no remaining rollout phases need action",
            "next_phase": None,
            "commands": [],
        }

    phase_key = f"phase_{next_phase['phase']:02d}_{next_phase['name']}"
    patch_status = patch_check_by_phase.get(phase_key, {"status": "unknown", "message": "patch check missing"})
    packet_path = _phase_packet_path(packet_dir, next_phase["phase"], next_phase["name"])

    commands = [
        f"git apply {packet_path}",
        (
            f"python3 {ROOT / 'scripts' / 'profile_goal_patch_status.py'} "
            f"{ROOT / 'reports' / 'profile_goal_patch_batches_2026-03-31'} "
            f"--markdown-output {ROOT / 'reports' / f'profile_goal_patch_status_{date.today().isoformat()}.md'} "
            f"--json-output {ROOT / 'reports' / 'profile_goal_patch_status_latest.json'}"
        ),
    ]

    return {
        "status": "ready" if patch_status.get("status") == "clean" else "blocked",
        "reason": reason,
        "next_phase": {
            "phase": next_phase["phase"],
            "name": next_phase["name"],
            "count": next_phase["count"],
            "packet_path": str(packet_path),
            "patch_check_status": patch_status.get("status"),
            "patch_check_message": patch_status.get("message") or "",
        },
        "commands": commands,
    }


def render_markdown(report: dict[str, Any]) -> str:
    lines = [
        "# Profile Contract Next Step",
        "",
        f"- Status: {report['status']}",
        f"- Reason: {report['reason']}",
        "",
    ]

    if not report.get("next_phase"):
        lines.append("_No rollout action pending._")
        return "\n".join(lines) + "\n"

    phase = report["next_phase"]
    lines.extend(
        [
            "## Next Phase",
            "",
            f"- Phase: {phase['phase']} ({phase['name']})",
            f"- Rows: {phase['count']}",
            f"- Packet: `{phase['packet_path']}`",
            f"- Patch check: {phase['patch_check_status']}",
        ]
    )
    if phase.get("patch_check_message"):
        lines.append(f"- Patch check message: {phase['patch_check_message']}")

    lines.extend(["", "## Commands", ""])
    for command in report["commands"]:
        lines.append("```bash")
        lines.append(command)
        lines.append("```")
        lines.append("")

    return "\n".join(lines).rstrip() + "\n"


def main() -> int:
    parser = argparse.ArgumentParser(description="Recommend the next executable profile-contract rollout step")
    parser.add_argument("rollout_json", help="Path to profile_contract_rollout_latest.json")
    parser.add_argument("patch_check_json", help="Path to profile_contract_patch_check_latest.json")
    parser.add_argument("status_json", help="Path to profile_goal_patch_status_latest.json")
    parser.add_argument("packet_dir", help="Path to profile_contract_patch_packets directory")
    parser.add_argument("--markdown-output", help="Optional markdown output path")
    parser.add_argument("--json-output", help="Optional JSON output path")
    args = parser.parse_args()

    report = build_recommendation(
        rollout_path=Path(args.rollout_json),
        patch_check_path=Path(args.patch_check_json),
        status_path=Path(args.status_json),
        packet_dir=Path(args.packet_dir),
        phase_status_path=DEFAULT_REPORT_DIR / "profile_contract_phase_status_latest.json",
    )
    markdown = render_markdown(report)

    markdown_path = (
        Path(args.markdown_output)
        if args.markdown_output
        else DEFAULT_REPORT_DIR / f"profile_contract_next_step_{date.today().isoformat()}.md"
    )
    markdown_path.parent.mkdir(parents=True, exist_ok=True)
    markdown_path.write_text(markdown, encoding="utf-8")
    print(f"Wrote markdown report: {markdown_path}")

    if args.json_output:
        json_path = Path(args.json_output)
        json_path.parent.mkdir(parents=True, exist_ok=True)
        json_path.write_text(json.dumps(report, indent=2, sort_keys=True), encoding="utf-8")
        print(f"Wrote JSON report: {json_path}")

    print("Next-step status:", report["status"])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
