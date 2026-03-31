#!/usr/bin/env python3
"""
Turn the goal-alignment queue into an executable profile patch plan.

This does not modify crawler profiles directly. It produces a concrete batch of
proposed profile updates so profile cleanup can be delegated safely without
recomputing recommendations by hand.
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

from pipeline.loader import find_profile_path, load_profile
from scripts.goal_alignment_queue import build_queue as build_goal_alignment_queue
from scripts.source_activation_gate import build_report as build_gate_report

DEFAULT_REPORT_DIR = ROOT / "reports"


@dataclass
class ProfilePatchRow:
    slug: str
    name: str
    portal_slug: str
    action: str
    profile_action: str
    profile_path: str
    current_goals: list[str]
    recommended_goals: list[str]
    priority_score: int
    yaml_snippet: str
    reasons: list[str]


def format_data_goals_yaml(goals: list[str]) -> str:
    lines = ["data_goals:"]
    for goal in goals:
        lines.append(f"  - {goal}")
    return "\n".join(lines)


def format_profile_yaml(*, slug: str, name: str, goals: list[str], profile_action: str) -> str:
    if profile_action == "create-profile":
        lines = [
            "version: 1",
            f"slug: {slug}",
            f"name: {name}",
            format_data_goals_yaml(goals),
        ]
        return "\n".join(lines)
    return format_data_goals_yaml(goals)


def profile_is_schema_invalid(slug: str) -> bool:
    path = find_profile_path(slug)
    if not path:
        return False
    try:
        load_profile(slug)
    except Exception:
        return True
    return False


def build_patch_plan(include_inactive: bool = False, portal_slug: Optional[str] = None) -> dict[str, Any]:
    queue = build_goal_alignment_queue(include_inactive=include_inactive, portal_slug=portal_slug)
    gate = build_gate_report(include_inactive=include_inactive, portal_slug=portal_slug)
    names_by_slug = {row["slug"]: row["name"] for row in gate["sources"]}
    rows: list[ProfilePatchRow] = []
    skipped_invalid_profiles = 0

    for row in queue["rows"]:
        slug = row["slug"]
        name = names_by_slug.get(slug, slug.replace("-", " ").title())
        profile_path = find_profile_path(slug)
        if profile_is_schema_invalid(slug):
            skipped_invalid_profiles += 1
            continue
        current_goals: list[str] = []
        profile_action = "create-profile"
        output_path = str(ROOT / "sources" / "profiles" / f"{slug}.yaml")

        if profile_path:
            output_path = str(profile_path)
            profile_action = "add-data-goals"
            try:
                profile = load_profile(slug)
                current_goals = list(profile.data_goals or [])
                if current_goals:
                    profile_action = "replace-data-goals"
            except Exception:
                current_goals = []

        rows.append(
            ProfilePatchRow(
                slug=slug,
                name=name,
                portal_slug=row["portal_slug"],
                action=row["action"],
                profile_action=profile_action,
                profile_path=output_path,
                current_goals=current_goals,
                recommended_goals=list(row["recommended_goals"]),
                priority_score=int(row["priority_score"]),
                yaml_snippet=format_profile_yaml(
                    slug=slug,
                    name=name,
                    goals=list(row["recommended_goals"]),
                    profile_action=profile_action,
                ),
                reasons=list(row["reasons"]),
            )
        )

    rows.sort(key=lambda row: (-row.priority_score, row.portal_slug, row.slug))

    profile_action_counts: dict[str, int] = {}
    for row in rows:
        profile_action_counts[row.profile_action] = profile_action_counts.get(row.profile_action, 0) + 1

    return {
        "generated_at": queue["generated_at"],
        "scope": queue["scope"],
        "summary": {
            "patch_candidates": len(rows),
            "skipped_invalid_profiles": skipped_invalid_profiles,
            "profile_action_counts": dict(sorted(profile_action_counts.items())),
            "alignment_action_counts": queue["summary"]["action_counts"],
        },
        "rows": [asdict(row) for row in rows],
    }


def render_markdown(report: dict[str, Any], limit: int = 25) -> str:
    summary = report["summary"]
    scope = report["scope"]
    rows = report["rows"]

    lines = [
        f"# Profile Goal Patch Plan - {report['generated_at'][:10]}",
        "",
        f"Scope: portal={scope['portal_slug']}, include_inactive={scope['include_inactive']}",
        "",
        "## Summary",
        "",
        f"- Patch candidates: {summary['patch_candidates']}",
        f"- Skipped invalid profiles: {summary.get('skipped_invalid_profiles', 0)}",
        f"- Profile actions: {', '.join(f'{key}={value}' for key, value in summary['profile_action_counts'].items()) or 'none'}",
        f"- Alignment actions: {', '.join(f'{key}={value}' for key, value in summary['alignment_action_counts'].items()) or 'none'}",
        "",
        "## Top Patches",
        "",
    ]

    if rows:
        lines.extend(
            [
                "| Profile Action | Slug | Portal | File | Recommended Goals | Why |",
                "| --- | --- | --- | --- | --- | --- |",
            ]
        )
        for row in rows[:limit]:
            why = "; ".join(dict.fromkeys(row["reasons"])) or "-"
            lines.append(
                f"| {row['profile_action']} | {row['slug']} | {row['portal_slug']} | {row['profile_path']} | "
                f"{', '.join(row['recommended_goals']) or '-'} | {why} |"
            )

        lines.extend(["", "## YAML Snippets", ""])
        for row in rows[:limit]:
            lines.append(f"### {row['slug']}")
            lines.append("")
            lines.append(f"Target: `{row['profile_path']}`")
            lines.append("")
            lines.append("```yaml")
            lines.append(row["yaml_snippet"])
            lines.append("```")
            lines.append("")
    else:
        lines.append("_No patch candidates._")

    return "\n".join(lines).rstrip() + "\n"


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate profile data-goals patch plan")
    parser.add_argument("--include-inactive", action="store_true", help="Include inactive sources")
    parser.add_argument("--portal", help="Limit review to a single portal slug")
    parser.add_argument("--output", help="Markdown output path")
    parser.add_argument("--json-output", help="Optional JSON output path")
    parser.add_argument("--limit", type=int, default=25, help="Rows to show in markdown")
    args = parser.parse_args()

    report = build_patch_plan(include_inactive=args.include_inactive, portal_slug=args.portal)
    markdown = render_markdown(report, limit=max(1, args.limit))

    output_path = Path(args.output) if args.output else DEFAULT_REPORT_DIR / f"profile_goal_patch_plan_{date.today().isoformat()}.md"
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(markdown, encoding="utf-8")
    print(f"Wrote markdown report: {output_path}")

    if args.json_output:
        json_path = Path(args.json_output)
        json_path.parent.mkdir(parents=True, exist_ok=True)
        json_path.write_text(json.dumps(report, indent=2, sort_keys=True), encoding="utf-8")
        print(f"Wrote JSON report: {json_path}")

    print(
        "Profile actions:",
        ", ".join(f"{key}={value}" for key, value in sorted(report["summary"]["profile_action_counts"].items())) or "none",
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
