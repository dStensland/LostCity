#!/usr/bin/env python3
"""
Generate a concrete normalization patch plan for invalid existing profiles.

This script does not modify crawler profile files. It converts the schema-drift
queue into exact replacement snippets so the session that owns
`crawlers/sources/profiles/` can fix invalid profiles without recomputing
legacy-to-current mappings by hand.
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

try:
    import yaml
except ImportError as exc:  # pragma: no cover - exercised in runtime, not tests
    raise SystemExit("pyyaml is required to load YAML profiles") from exc

from scripts.profile_schema_drift_queue import build_queue as build_drift_queue
from source_goals import normalize_goal

DEFAULT_REPORT_DIR = ROOT / "reports"
LEGACY_DESTINATION_GOALS = {"destinations", "destination_details", "venue_features"}
HOURS_HINTS = {
    "recreation center",
    "recreation-center",
    "activity center",
    "activity-center",
    "nature center",
    "nature-center",
}


@dataclass
class DriftPatchRow:
    slug: str
    profile_path: str
    error_class: str
    current_data_goals: list[str]
    recommended_data_goals: list[str]
    current_discovery_type: Optional[str]
    recommended_discovery_type: Optional[str]
    change_actions: list[str]
    reasons: list[str]
    yaml_snippet: str


def _deep_get(data: dict[str, Any], dotpath: str, default: Any = None) -> Any:
    current: Any = data
    for part in dotpath.split("."):
        if not isinstance(current, dict):
            return default
        if part not in current:
            return default
        current = current[part]
    return current


def _load_profile_data(path: Path) -> dict[str, Any]:
    return yaml.safe_load(path.read_text(encoding="utf-8")) or {}


def _dedupe_keep_order(values: list[str]) -> list[str]:
    seen: set[str] = set()
    output: list[str] = []
    for value in values:
        if value in seen:
            continue
        seen.add(value)
        output.append(value)
    return output


def _needs_hours_goal(slug: str, name: str) -> bool:
    combined = f"{slug} {name}".lower()
    return any(hint in combined for hint in HOURS_HINTS)


def normalize_legacy_data_goals(*, goals: list[str], slug: str, name: str) -> tuple[list[str], list[str]]:
    valid_goals = [goal for goal in (normalize_goal(goal) for goal in goals) if goal]
    if not any(goal in LEGACY_DESTINATION_GOALS for goal in goals):
        return _dedupe_keep_order(valid_goals), []

    recommended = ["images", "planning", "accessibility"]
    reasons = [
        "legacy destination profile goals are no longer valid literals in the current schema",
        "destination-only profiles should express supported destination-intelligence goals instead of legacy destination entity flags",
    ]
    if _needs_hours_goal(slug, name):
        recommended.append("venue_hours")
        reasons.append("profile name suggests a staffed center where hours are part of first-pass capture")

    for goal in valid_goals:
        if goal not in recommended:
            recommended.append(goal)

    return _dedupe_keep_order(recommended), reasons


def normalize_legacy_discovery_type(data: dict[str, Any]) -> tuple[Optional[str], dict[str, Any], list[str]]:
    current_type = _deep_get(data, "discovery.type")
    integration_method = str(data.get("integration_method") or "").strip().lower()
    urls = [str(url) for url in (_deep_get(data, "discovery.urls", []) or [])]

    if current_type == "curated":
        return (
            "list",
            {"type": "list"},
            [
                "legacy discovery.type 'curated' is not supported by the current schema",
                "this profile points at a canonical schedule page rather than a feed or API endpoint",
            ],
        )

    if current_type != "json":
        return None, {}, []

    looks_like_api = integration_method == "api" or any(
        marker in url.lower()
        for url in urls
        for marker in ("/wp-json/", ".json", "/api/")
    )
    if looks_like_api:
        patch = {"type": "api"}
        reasons = [
            "legacy discovery.type 'json' maps to the current 'api' mode when the profile targets JSON endpoints directly",
        ]
        if _deep_get(data, "discovery.enabled") is True and not _deep_get(data, "discovery.api.adapter"):
            patch["api"] = {"adapter": "custom"}
            reasons.append("enabled API discovery also needs a minimal adapter declaration to satisfy the current pipeline contract")
        return "api", patch, reasons

    return (
        "html",
        {"type": "html"},
        [
            "legacy discovery.type 'json' is not supported by the current schema",
            "the profile URL points at a public page, so 'html' is the least-wrong schema-safe fallback for a disabled bespoke crawler",
        ],
    )


def _render_yaml_lines(value: Any, *, indent: int = 0) -> list[str]:
    prefix = " " * indent
    if isinstance(value, dict):
        lines: list[str] = []
        for key, child in value.items():
            if isinstance(child, (dict, list)):
                lines.append(f"{prefix}{key}:")
                lines.extend(_render_yaml_lines(child, indent=indent + 2))
            else:
                lines.append(f"{prefix}{key}: {child}")
        return lines
    if isinstance(value, list):
        return [f"{prefix}- {item}" for item in value]
    return [f"{prefix}{value}"]


def build_patch_plan(status_report_path: Path) -> dict[str, Any]:
    queue = build_drift_queue(status_report_path)
    rows: list[DriftPatchRow] = []

    for drift_row in queue["rows"]:
        path = Path(drift_row["profile_path"])
        data = _load_profile_data(path)
        slug = str(data.get("slug") or drift_row["slug"])
        name = str(data.get("name") or slug.replace("-", " ").title())

        current_goals = list(data.get("data_goals") or [])
        recommended_goals, goal_reasons = normalize_legacy_data_goals(goals=current_goals, slug=slug, name=name)
        current_discovery_type = _deep_get(data, "discovery.type")
        recommended_discovery_type, discovery_patch, discovery_reasons = normalize_legacy_discovery_type(data)

        change_actions: list[str] = []
        snippet_data: dict[str, Any] = {}
        reasons: list[str] = []

        if recommended_goals and recommended_goals != current_goals:
            snippet_data["data_goals"] = recommended_goals
            change_actions.append("replace-data-goals")
            reasons.extend(goal_reasons)

        if recommended_discovery_type and recommended_discovery_type != current_discovery_type:
            snippet_data["discovery"] = discovery_patch
            change_actions.append("replace-discovery-type")
            reasons.extend(discovery_reasons)

        yaml_lines: list[str] = []
        for key, value in snippet_data.items():
            if isinstance(value, (dict, list)):
                yaml_lines.append(f"{key}:")
                yaml_lines.extend(_render_yaml_lines(value, indent=2))
            else:
                yaml_lines.append(f"{key}: {value}")

        rows.append(
            DriftPatchRow(
                slug=slug,
                profile_path=str(path),
                error_class=drift_row["error_class"],
                current_data_goals=current_goals,
                recommended_data_goals=recommended_goals,
                current_discovery_type=current_discovery_type,
                recommended_discovery_type=recommended_discovery_type,
                change_actions=change_actions,
                reasons=_dedupe_keep_order(reasons),
                yaml_snippet="\n".join(yaml_lines),
            )
        )

    rows.sort(key=lambda row: (row.error_class, row.slug))
    action_counts: dict[str, int] = {}
    for row in rows:
        for action in row.change_actions:
            action_counts[action] = action_counts.get(action, 0) + 1

    return {
        "source_report": str(status_report_path),
        "summary": {
            "invalid_profiles": len(rows),
            "action_counts": dict(sorted(action_counts.items())),
            "error_counts": queue["summary"]["error_counts"],
        },
        "rows": [asdict(row) for row in rows],
    }


def render_markdown(report: dict[str, Any]) -> str:
    summary = report["summary"]
    rows = report["rows"]
    lines = [
        "# Profile Schema Drift Patch Plan",
        "",
        f"Source report: `{report['source_report']}`",
        "",
        "## Summary",
        "",
        f"- Invalid profiles: {summary['invalid_profiles']}",
        f"- Action counts: {', '.join(f'{key}={value}' for key, value in summary['action_counts'].items()) or 'none'}",
        f"- Error counts: {', '.join(f'{key}={value}' for key, value in summary['error_counts'].items()) or 'none'}",
        "",
        "## Patch Queue",
        "",
        "| Slug | Error Class | Actions | Why |",
        "| --- | --- | --- | --- |",
    ]

    for row in rows:
        why = "; ".join(row["reasons"]) or "-"
        actions = ", ".join(row["change_actions"]) or "-"
        lines.append(f"| {row['slug']} | {row['error_class']} | {actions} | {why} |")

    lines.extend(["", "## YAML Snippets", ""])
    for row in rows:
        lines.append(f"### {row['slug']}")
        lines.append("")
        lines.append(f"Target: `{row['profile_path']}`")
        lines.append("")
        lines.append("```yaml")
        lines.append(row["yaml_snippet"] or "# manual review required")
        lines.append("```")
        lines.append("")

    return "\n".join(lines).rstrip() + "\n"


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate normalization patch plan for invalid profiles")
    parser.add_argument("status_report_json", help="Path to profile_goal_patch_status_latest.json")
    parser.add_argument("--markdown-output", help="Optional markdown output path")
    parser.add_argument("--json-output", help="Optional JSON output path")
    args = parser.parse_args()

    report = build_patch_plan(Path(args.status_report_json))
    markdown = render_markdown(report)

    markdown_path = (
        Path(args.markdown_output)
        if args.markdown_output
        else DEFAULT_REPORT_DIR / f"profile_schema_drift_patch_plan_{date.today().isoformat()}.md"
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
        "Action counts:",
        ", ".join(f"{key}={value}" for key, value in summary.items())
        if (summary := report["summary"]["action_counts"])
        else "none",
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
