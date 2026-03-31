#!/usr/bin/env python3
"""
Alias entrypoint for executing the current recommended profile-contract phase.

This intentionally delegates to profile_contract_run_next so the project only
has one implementation of the forward-runner logic while preserving the
operator-facing command name.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from scripts.profile_contract_run_next import (
    DEFAULT_REPORT_DIR,
    render_markdown as render_markdown,
    run_next_phase,
)


def run_recommended(**kwargs: Any) -> dict[str, Any]:
    return run_next_phase(**kwargs)


def main() -> int:
    parser = argparse.ArgumentParser(description="Run the current recommended profile-contract phase")
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

    result = run_recommended(
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
        "Run-recommended result:",
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
