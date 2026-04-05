#!/usr/bin/env python3
"""
Check or apply a single profile-contract phase packet, then optionally refresh reports.

This is the execution entrypoint for the session that owns
`crawlers/sources/profiles/`.
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path
from typing import Any, Callable

ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = ROOT.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from scripts.profile_contract_refresh import refresh_reports

DEFAULT_REPORT_DIR = ROOT / "reports"


def find_phase_patch(packet_dir: Path, phase: int) -> Path:
    matches = sorted(packet_dir.glob(f"phase_{phase:02d}_*.patch"))
    if not matches:
        raise FileNotFoundError(f"No patch packet found for phase {phase:02d} in {packet_dir}")
    if len(matches) > 1:
        raise ValueError(f"Multiple patch packets found for phase {phase:02d}: {matches}")
    return matches[0]


def run_git_apply_check(repo_root: Path, patch_path: Path, *, reverse: bool = False) -> tuple[bool, str]:
    cmd = ["git", "-C", str(repo_root), "apply", "--check"]
    if reverse:
        cmd.append("--reverse")
    cmd.append(str(patch_path))
    result = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
    )
    message = (result.stderr or result.stdout or "").strip()
    return result.returncode == 0, message


def run_git_apply(repo_root: Path, patch_path: Path, *, reverse: bool = False) -> tuple[bool, str]:
    cmd = ["git", "-C", str(repo_root), "apply"]
    if reverse:
        cmd.append("--reverse")
    cmd.append(str(patch_path))
    result = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
    )
    message = (result.stderr or result.stdout or "").strip()
    return result.returncode == 0, message


def execute_phase(
    *,
    phase: int,
    packet_dir: Path,
    repo_root: Path,
    apply: bool,
    refresh: bool,
    reverse: bool = False,
    batch_dir: Path | None = None,
    rollout_json: Path | None = None,
    drift_plan_json: Path | None = None,
    report_dir: Path | None = None,
    refresh_fn: Callable[..., dict[str, Any]] = refresh_reports,
) -> dict[str, Any]:
    patch_path = find_phase_patch(packet_dir, phase)
    check_ok, check_message = run_git_apply_check(repo_root, patch_path, reverse=reverse)
    result: dict[str, Any] = {
        "phase": phase,
        "patch_path": str(patch_path),
        "reverse": reverse,
        "check_ok": check_ok,
        "check_message": check_message,
        "applied": False,
        "apply_message": "",
        "refreshed": False,
        "refresh_summary": None,
    }

    if not apply:
        return result

    if not check_ok:
        return result

    apply_ok, apply_message = run_git_apply(repo_root, patch_path, reverse=reverse)
    result["applied"] = apply_ok
    result["apply_message"] = apply_message
    if not apply_ok or not refresh:
        return result

    if not (batch_dir and rollout_json and drift_plan_json):
        raise ValueError("batch_dir, rollout_json, and drift_plan_json are required when refresh=True")

    refresh_report = refresh_fn(
        batch_dir=batch_dir,
        packet_dir=packet_dir,
        rollout_json=rollout_json,
        drift_plan_json=drift_plan_json,
        report_dir=report_dir or DEFAULT_REPORT_DIR,
    )
    result["refreshed"] = True
    result["refresh_summary"] = refresh_report["summary"]
    return result


def render_markdown(result: dict[str, Any]) -> str:
    lines = [
        "# Profile Contract Phase Execution",
        "",
        f"- Phase: {result['phase']}",
        f"- Reverse: {result.get('reverse', False)}",
        f"- Patch: `{result['patch_path']}`",
        f"- Check: {'ok' if result['check_ok'] else 'failed'}",
    ]
    if result.get("check_message"):
        lines.append(f"- Check message: {result['check_message']}")
    lines.append(f"- Applied: {result['applied']}")
    if result.get("apply_message"):
        lines.append(f"- Apply message: {result['apply_message']}")
    lines.append(f"- Refreshed: {result['refreshed']}")
    if result.get("refresh_summary"):
        summary = result["refresh_summary"]
        lines.extend(
            [
                "",
                "## Refresh Summary",
                "",
                f"- Next phase: {summary.get('next_phase')}",
                f"- Next-step status: {summary.get('next_step_status')}",
                f"- Patch status counts: {summary.get('patch_status_counts')}",
            ]
        )
    return "\n".join(lines) + "\n"


def main() -> int:
    parser = argparse.ArgumentParser(description="Check or apply a profile-contract phase packet")
    parser.add_argument("phase", type=int, help="Phase number to execute")
    parser.add_argument("packet_dir", help="Directory created by profile_contract_patch_packets.py")
    parser.add_argument("--apply", action="store_true", help="Actually apply the patch after a successful check")
    parser.add_argument("--reverse", action="store_true", help="Reverse the patch instead of applying it forward")
    parser.add_argument("--no-refresh", action="store_true", help="Skip report refresh after a successful apply")
    parser.add_argument("--repo-root", help="Override repo root (defaults to LostCity repo root)")
    parser.add_argument("--batch-dir", help="Required for refresh when --apply is used")
    parser.add_argument("--rollout-json", help="Required for refresh when --apply is used")
    parser.add_argument("--drift-plan-json", help="Required for refresh when --apply is used")
    parser.add_argument("--report-dir", help="Optional refresh report directory override")
    parser.add_argument("--markdown-output", help="Optional markdown output path")
    parser.add_argument("--json-output", help="Optional JSON output path")
    args = parser.parse_args()

    result = execute_phase(
        phase=args.phase,
        packet_dir=Path(args.packet_dir),
        repo_root=Path(args.repo_root) if args.repo_root else REPO_ROOT,
        apply=args.apply,
        refresh=not args.no_refresh and args.apply,
        reverse=args.reverse,
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

    print(
        "Execution result:",
        json.dumps(
            {
                "phase": result["phase"],
                "reverse": result["reverse"],
                "check_ok": result["check_ok"],
                "applied": result["applied"],
                "refreshed": result["refreshed"],
            },
            sort_keys=True,
        ),
    )
    return 0 if result["check_ok"] and (not args.apply or result["applied"]) else 1


if __name__ == "__main__":
    raise SystemExit(main())
