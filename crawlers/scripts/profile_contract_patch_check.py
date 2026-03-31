#!/usr/bin/env python3
"""
Check whether generated profile-contract patch packets are actionable.

This does not apply any patch. It shells out to `git apply --check` for each
phase packet. If a forward apply fails, it also checks whether the reverse
patch would apply cleanly, which indicates that the packet has already been
applied to the current worktree.
"""

from __future__ import annotations

import argparse
import json
import subprocess
from datetime import date
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = ROOT.parent
DEFAULT_REPORT_DIR = ROOT / "reports"


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


def build_report(packet_dir: Path) -> dict[str, Any]:
    rows: list[dict[str, Any]] = []
    for patch_path in sorted(packet_dir.glob("phase_*.patch")):
        forward_ok, forward_message = run_git_apply_check(REPO_ROOT, patch_path)
        reverse_ok = False
        reverse_message = ""
        status = "clean"
        message = ""

        if not forward_ok:
            reverse_ok, reverse_message = run_git_apply_check(REPO_ROOT, patch_path, reverse=True)
            if reverse_ok:
                status = "already_applied"
                message = reverse_message
            else:
                status = "blocked"
                message = forward_message

        rows.append(
            {
                "phase": patch_path.stem,
                "patch_path": str(patch_path),
                "status": status,
                "message": message,
                "forward_check_ok": forward_ok,
                "forward_check_message": forward_message,
                "reverse_check_ok": reverse_ok,
                "reverse_check_message": reverse_message,
            }
        )

    summary = {
        "phases": len(rows),
        "clean": sum(1 for row in rows if row["status"] == "clean"),
        "already_applied": sum(1 for row in rows if row["status"] == "already_applied"),
        "blocked": sum(1 for row in rows if row["status"] == "blocked"),
    }
    return {
        "packet_dir": str(packet_dir),
        "summary": summary,
        "rows": rows,
    }


def render_markdown(report: dict[str, Any]) -> str:
    summary = report["summary"]
    lines = [
        "# Profile Contract Patch Check",
        "",
        f"Packet dir: `{report['packet_dir']}`",
        "",
        "## Summary",
        "",
        f"- Phases: {summary['phases']}",
        f"- Clean: {summary['clean']}",
        f"- Already applied: {summary['already_applied']}",
        f"- Blocked: {summary['blocked']}",
        "",
        "## Phase Status",
        "",
        "| Phase | Status | Patch | Message |",
        "| --- | --- | --- | --- |",
    ]
    for row in report["rows"]:
        message = row["message"].replace("\n", " ") if row["message"] else ""
        lines.append(f"| {row['phase']} | {row['status']} | {row['patch_path']} | {message or '-'} |")
    return "\n".join(lines) + "\n"


def main() -> int:
    parser = argparse.ArgumentParser(description="Check whether profile-contract patch packets apply cleanly")
    parser.add_argument("packet_dir", help="Directory created by profile_contract_patch_packets.py")
    parser.add_argument("--markdown-output", help="Optional markdown output path")
    parser.add_argument("--json-output", help="Optional JSON output path")
    args = parser.parse_args()

    report = build_report(Path(args.packet_dir))
    markdown = render_markdown(report)

    markdown_path = (
        Path(args.markdown_output)
        if args.markdown_output
        else DEFAULT_REPORT_DIR / f"profile_contract_patch_check_{date.today().isoformat()}.md"
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
        "Patch check summary:",
        f"clean={report['summary']['clean']}, blocked={report['summary']['blocked']}",
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
