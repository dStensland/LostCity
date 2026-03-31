#!/usr/bin/env python3
"""
Find sources whose inferred data goals are likely misaligned with their actual lane
or live output, so profile cleanup can be done deliberately instead of ad hoc.
"""

from __future__ import annotations

import argparse
import json
import sys
from dataclasses import asdict, dataclass
from datetime import date
from pathlib import Path
from typing import Any, Optional

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from scripts.source_activation_gate import build_report as build_gate_report

DEFAULT_REPORT_DIR = ROOT / "reports"
GALLERY_HINTS = (
    "gallery",
    "museum",
    "botanical",
    "garden",
    "arboretum",
    "science center",
    "planetarium",
    "exhibition",
)


@dataclass
class GoalAlignmentRow:
    slug: str
    portal_slug: str
    entity_mode: str
    current_goals: list[str]
    recommended_goals: list[str]
    action: str
    priority_score: int
    failing_checks: list[str]
    reasons: list[str]


def recommend_goals(row: dict[str, Any]) -> tuple[str, list[str], list[str]]:
    slug = row["slug"]
    entity_mode = row["entity_mode"]
    current_goals = list(row.get("goals") or [])
    reasons: list[str] = []

    if entity_mode == "open_calls":
        reasons.append("source behaves like an open-calls lane and should not rely on fallback event goals")
        return "set-explicit-goals", ["open_calls"], reasons

    if entity_mode == "exhibitions" or slug.startswith("exhibitions-"):
        goals = ["exhibits"]
        if row.get("has_image"):
            goals.append("images")
        reasons.append("source behaves like an exhibitions lane and should declare exhibit intent explicitly")
        return "set-explicit-goals", goals, reasons

    lowered = f"{slug} {' '.join(current_goals)}".lower()
    if (
        any(hint in lowered for hint in GALLERY_HINTS)
        and "events" in current_goals
        and "events" in (row.get("failing_checks") or [])
        and "exhibits" in (row.get("failing_checks") or [])
    ):
        reasons.append("gallery/museum source is inferred as event-led but currently fails both event and exhibit expectations")
        return "review-gallery-profile", ["exhibits", "images"], reasons

    if "classes" in current_goals and "classes" in (row.get("failing_checks") or []) and row.get("future_events", 0) > 0:
        reasons.append("source may be mixing events and program expectations without an explicit profile contract")
        return "review-mixed-program-profile", current_goals, reasons

    if row.get("failing_checks"):
        reasons.append("inferred goals are still driving activation failures and should be reviewed explicitly")
        return "review-inferred-goals", current_goals, reasons

    return "monitor", current_goals, reasons


def build_queue(include_inactive: bool = False, portal_slug: Optional[str] = None) -> dict[str, Any]:
    gate = build_gate_report(include_inactive=include_inactive, portal_slug=portal_slug)
    rows: list[GoalAlignmentRow] = []

    for row in gate["sources"]:
        if row.get("goal_mode") != "inferred":
            continue

        action, recommended_goals, reasons = recommend_goals(row)
        if action == "monitor":
            continue

        score = int(row.get("priority_score") or 0)
        if action == "set-explicit-goals":
            score += 40
        elif action == "review-gallery-profile":
            score += 30
        elif action == "review-mixed-program-profile":
            score += 20

        rows.append(
            GoalAlignmentRow(
                slug=row["slug"],
                portal_slug=row["portal_slug"],
                entity_mode=row["entity_mode"],
                current_goals=list(row.get("goals") or []),
                recommended_goals=recommended_goals,
                action=action,
                priority_score=score,
                failing_checks=list(row.get("failing_checks") or []),
                reasons=reasons + list(row.get("reasons") or []),
            )
        )

    rows.sort(key=lambda row: (-row.priority_score, row.portal_slug, row.slug))

    action_counts: dict[str, int] = {}
    for row in rows:
        action_counts[row.action] = action_counts.get(row.action, 0) + 1

    return {
        "generated_at": gate["generated_at"],
        "scope": gate["scope"],
        "summary": {
            "sources_reviewed": len(gate["sources"]),
            "alignment_candidates": len(rows),
            "action_counts": dict(sorted(action_counts.items())),
        },
        "rows": [asdict(row) for row in rows],
    }


def render_markdown(report: dict[str, Any], limit: int = 25) -> str:
    summary = report["summary"]
    scope = report["scope"]
    rows = report["rows"]

    lines = [
        f"# Goal Alignment Queue - {report['generated_at'][:10]}",
        "",
        f"Scope: portal={scope['portal_slug']}, include_inactive={scope['include_inactive']}",
        "",
        "## Summary",
        "",
        f"- Sources reviewed: {summary['sources_reviewed']}",
        f"- Alignment candidates: {summary['alignment_candidates']}",
        f"- Actions: {', '.join(f'{key}={value}' for key, value in summary['action_counts'].items()) or 'none'}",
        "",
        "## Top Candidates",
        "",
    ]

    if rows:
        lines.extend(
            [
                "| Action | Slug | Portal | Lane | Current Goals | Recommended Goals | Checks | Why |",
                "| --- | --- | --- | --- | --- | --- | --- | --- |",
            ]
        )
        for row in rows[:limit]:
            checks = ", ".join(row["failing_checks"]) or "-"
            why = "; ".join(dict.fromkeys(row["reasons"])) or "-"
            lines.append(
                f"| {row['action']} | {row['slug']} | {row['portal_slug']} | {row['entity_mode']} | "
                f"{', '.join(row['current_goals']) or '-'} | {', '.join(row['recommended_goals']) or '-'} | {checks} | {why} |"
            )
    else:
        lines.append("_No alignment candidates._")

    return "\n".join(lines) + "\n"


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate queue for inferred-goal profile cleanup")
    parser.add_argument("--include-inactive", action="store_true", help="Include inactive sources")
    parser.add_argument("--portal", help="Limit review to a single portal slug")
    parser.add_argument("--output", help="Markdown output path")
    parser.add_argument("--json-output", help="Optional JSON output path")
    parser.add_argument("--limit", type=int, default=25, help="Rows per markdown table")
    args = parser.parse_args()

    report = build_queue(include_inactive=args.include_inactive, portal_slug=args.portal)
    markdown = render_markdown(report, limit=max(1, args.limit))

    output_path = Path(args.output) if args.output else DEFAULT_REPORT_DIR / f"goal_alignment_queue_{date.today().isoformat()}.md"
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(markdown, encoding="utf-8")
    print(f"Wrote markdown report: {output_path}")

    if args.json_output:
        json_path = Path(args.json_output)
        json_path.parent.mkdir(parents=True, exist_ok=True)
        json_path.write_text(json.dumps(report, indent=2, sort_keys=True), encoding="utf-8")
        print(f"Wrote JSON report: {json_path}")

    print(
        "Actions:",
        ", ".join(f"{key}={value}" for key, value in sorted(report["summary"]["action_counts"].items())) or "none",
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
