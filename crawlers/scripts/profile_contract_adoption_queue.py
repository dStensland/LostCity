#!/usr/bin/env python3
"""
Queue profile-backed sources whose live outputs still miss their declared contract.

This builds on the activation gate and focuses only on sources with explicit
profile-level data goals. The resulting artifact is the post-rollout queue for
bringing crawler behavior into alignment with the newly applied contracts.
"""

from __future__ import annotations

import argparse
import json
import sys
from collections import Counter
from datetime import date
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from scripts.source_activation_gate import build_report as build_activation_report

DEFAULT_REPORT_DIR = ROOT / "reports"


def _load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def classify_action(source: dict[str, Any]) -> str:
    fails = set(source.get("failing_checks") or [])
    warns = set(source.get("warning_checks") or [])

    if fails & {"health", "stale"}:
        return "ops-rehab"
    if fails & {"events", "classes", "exhibits", "open_calls"}:
        return "entity-output-fix"
    if fails & {"specials", "venue_hours", "images", "missing-primary-venue"}:
        return "first-pass-destination-fix"
    if warns or fails & {"planning"}:
        return "metadata-polish"
    return "healthy"


def build_adoption_report(activation_report: dict[str, Any]) -> dict[str, Any]:
    profile_sources = [
        source
        for source in activation_report.get("sources", [])
        if source.get("goal_mode") == "profile"
    ]

    actionable_rows: list[dict[str, Any]] = []
    for source in profile_sources:
        if source.get("status") == "pass":
            continue
        row = dict(source)
        row["action"] = classify_action(source)
        actionable_rows.append(row)

    actionable_rows.sort(key=lambda row: (-int(row.get("priority_score", 0)), row.get("portal_slug") or "", row.get("slug") or ""))

    status_counts = Counter(source.get("status") or "unknown" for source in profile_sources)
    action_counts = Counter(row["action"] for row in actionable_rows)
    fail_checks = Counter(check for row in actionable_rows for check in row.get("failing_checks") or [])
    warn_checks = Counter(check for row in actionable_rows for check in row.get("warning_checks") or [])

    return {
        "generated_at": activation_report.get("generated_at"),
        "scope": activation_report.get("scope", {}),
        "summary": {
            "profile_sources_reviewed": len(profile_sources),
            "actionable_sources": len(actionable_rows),
            "status_counts": dict(sorted(status_counts.items())),
            "action_counts": dict(sorted(action_counts.items())),
            "fail_checks": dict(fail_checks.most_common()),
            "warn_checks": dict(warn_checks.most_common()),
        },
        "rows": actionable_rows,
    }


def render_markdown(report: dict[str, Any], limit: int = 40) -> str:
    summary = report["summary"]
    scope = report.get("scope", {})
    lines = [
        "# Profile Contract Adoption Queue",
        "",
        f"Scope: portal={scope.get('portal_slug', 'all')}, include_inactive={scope.get('include_inactive', False)}",
        "",
        "## Summary",
        "",
        f"- Profile-backed sources reviewed: {summary['profile_sources_reviewed']}",
        f"- Actionable sources: {summary['actionable_sources']}",
        f"- Status counts: {', '.join(f'{key}={value}' for key, value in summary['status_counts'].items()) or 'none'}",
        f"- Action counts: {', '.join(f'{key}={value}' for key, value in summary['action_counts'].items()) or 'none'}",
        "",
        "## Top Fail Checks",
        "",
    ]
    if summary["fail_checks"]:
        lines.extend(["| Check | Count |", "| --- | ---: |"])
        for check, count in summary["fail_checks"].items():
            lines.append(f"| {check} | {count} |")
    else:
        lines.append("_None_")

    if summary["warn_checks"]:
        lines.extend(["", "## Warning Checks", "", "| Check | Count |", "| --- | ---: |"])
        for check, count in summary["warn_checks"].items():
            lines.append(f"| {check} | {count} |")

    lines.extend(
        [
            "",
            "## Adoption Queue",
            "",
            "| Action | Portal | Slug | Status | Goals | Fails | Warns | Priority | Why |",
            "| --- | --- | --- | --- | --- | --- | --- | ---: | --- |",
        ]
    )
    rows = report.get("rows", [])
    for row in rows[:limit]:
        goals = ", ".join(row.get("goals") or []) or "-"
        fails = ", ".join(row.get("failing_checks") or []) or "-"
        warns = ", ".join(row.get("warning_checks") or []) or "-"
        why = "; ".join(row.get("reasons") or []) or "-"
        lines.append(
            f"| {row['action']} | {row['portal_slug']} | {row['slug']} | {row['status']} | "
            f"{goals} | {fails} | {warns} | {row['priority_score']} | {why} |"
        )
    if len(rows) > limit:
        lines.extend(["", f"_Showing {limit} of {len(rows)} actionable sources._"])

    return "\n".join(lines).rstrip() + "\n"


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate post-rollout adoption queue for profile-backed sources")
    parser.add_argument("--activation-gate-json", help="Optional existing activation-gate JSON report")
    parser.add_argument("--include-inactive", action="store_true", help="Include inactive sources when building live activation data")
    parser.add_argument("--portal", help="Limit review to a single portal slug when building live activation data")
    parser.add_argument("--output", help="Markdown output path")
    parser.add_argument("--json-output", help="Optional JSON output path")
    parser.add_argument("--limit", type=int, default=40, help="Rows to show in markdown output")
    args = parser.parse_args()

    if args.activation_gate_json:
        activation_report = _load_json(Path(args.activation_gate_json))
    else:
        activation_report = build_activation_report(include_inactive=args.include_inactive, portal_slug=args.portal)

    report = build_adoption_report(activation_report)
    markdown = render_markdown(report, limit=max(1, args.limit))

    output_path = Path(args.output) if args.output else DEFAULT_REPORT_DIR / f"profile_contract_adoption_queue_{date.today().isoformat()}.md"
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(markdown, encoding="utf-8")
    print(f"Wrote markdown report: {output_path}")

    if args.json_output:
        json_path = Path(args.json_output)
        json_path.parent.mkdir(parents=True, exist_ok=True)
        json_path.write_text(json.dumps(report, indent=2, sort_keys=True), encoding="utf-8")
        print(f"Wrote JSON report: {json_path}")

    print(
        "Adoption queue summary:",
        json.dumps(
            {
                "profile_sources_reviewed": report["summary"]["profile_sources_reviewed"],
                "actionable_sources": report["summary"]["actionable_sources"],
                "action_counts": report["summary"]["action_counts"],
            },
            sort_keys=True,
        ),
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
