#!/usr/bin/env python3
"""
Merge weekly source review and activation gate into a single operations queue.

The weekly review tells us what kind of work is worth doing.
The activation gate tells us whether a source is fit to stay active.
This artifact combines both so weekly triage can start from an execution queue
instead of two separate reports.
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
from scripts.weekly_source_review import build_review as build_weekly_review

DEFAULT_REPORT_DIR = ROOT / "reports"


@dataclass
class OpsQueueRow:
    id: int
    slug: str
    portal_slug: str
    integration_method: str
    weekly_action: str
    gate_status: str
    workstream: str
    entity_lane: str
    future_items: int
    recent_items_30d: int
    weekly_priority_score: int
    gate_priority_score: int
    combined_priority_score: int
    gate_failing_checks: list[str]
    gate_warning_checks: list[str]
    weekly_reasons: list[str]
    gate_reasons: list[str]


def classify_workstream(weekly_action: str, gate_status: str) -> str:
    if weekly_action == "graduate-from-llm":
        return "deterministic-upgrade"
    if weekly_action == "connector":
        return "connector-promotion"
    if weekly_action == "rehab":
        return "crawler-rehab"
    if gate_status == "fail":
        return "gate-only-fix"
    if gate_status == "warn":
        return "metadata-polish"
    return "monitor"


def build_ops_queue(include_inactive: bool = False, portal_slug: Optional[str] = None) -> dict[str, Any]:
    weekly = build_weekly_review(include_inactive=include_inactive, portal_slug=portal_slug)
    gate = build_gate_report(include_inactive=include_inactive, portal_slug=portal_slug)

    weekly_by_id = {row["id"]: row for row in weekly["sources"]}
    gate_by_id = {row["id"]: row for row in gate["sources"]}
    all_ids = sorted(set(weekly_by_id) | set(gate_by_id))

    rows: list[OpsQueueRow] = []
    for source_id in all_ids:
        weekly_row = weekly_by_id.get(source_id, {})
        gate_row = gate_by_id.get(source_id, {})

        slug = weekly_row.get("slug") or gate_row.get("slug") or f"source-{source_id}"
        portal = weekly_row.get("portal_slug") or gate_row.get("portal_slug") or "unknown"
        weekly_action = weekly_row.get("action") or "ignore"
        gate_status = gate_row.get("status") or "pass"
        entity_lane = weekly_row.get("entity_lane") or gate_row.get("entity_mode") or "events"
        future_items = int(weekly_row.get("future_items") or 0)
        recent_items = int(weekly_row.get("recent_inserts_30d") or 0)
        weekly_score = int(weekly_row.get("priority_score") or 0)
        gate_score = int(gate_row.get("priority_score") or 0)

        combined = weekly_score + gate_score
        if weekly_action == "graduate-from-llm" and gate_status == "fail":
            combined += 80
        elif weekly_action == "connector" and gate_status == "fail":
            combined += 60
        elif weekly_action == "rehab" and gate_status == "fail":
            combined += 40
        elif weekly_action == "ignore" and gate_status == "fail":
            combined += 20

        rows.append(
            OpsQueueRow(
                id=source_id,
                slug=slug,
                portal_slug=portal,
                integration_method=(weekly_row.get("integration_method") or gate_row.get("integration_method") or "unknown"),
                weekly_action=weekly_action,
                gate_status=gate_status,
                workstream=classify_workstream(weekly_action, gate_status),
                entity_lane=entity_lane,
                future_items=future_items,
                recent_items_30d=recent_items,
                weekly_priority_score=weekly_score,
                gate_priority_score=gate_score,
                combined_priority_score=combined,
                gate_failing_checks=list(gate_row.get("failing_checks") or []),
                gate_warning_checks=list(gate_row.get("warning_checks") or []),
                weekly_reasons=list(weekly_row.get("reasons") or []),
                gate_reasons=list(gate_row.get("reasons") or []),
            )
        )

    filtered_rows = [row for row in rows if row.workstream != "monitor"]
    filtered_rows.sort(
        key=lambda row: (
            -row.combined_priority_score,
            row.portal_slug,
            row.slug,
        )
    )

    workstream_counts: dict[str, int] = {}
    for row in filtered_rows:
        workstream_counts[row.workstream] = workstream_counts.get(row.workstream, 0) + 1

    return {
        "generated_at": weekly["generated_at"],
        "scope": weekly["scope"],
        "summary": {
            "sources_reviewed": len(rows),
            "queued_sources": len(filtered_rows),
            "workstream_counts": dict(sorted(workstream_counts.items())),
            "weekly_action_counts": weekly["summary"]["action_counts"],
            "gate_status_counts": gate["summary"]["status_counts"],
        },
        "rows": [asdict(row) for row in filtered_rows],
    }


def render_markdown(report: dict[str, Any], limit: int = 25) -> str:
    summary = report["summary"]
    scope = report["scope"]
    rows = report["rows"]

    lines = [
        f"# Weekly Ops Queue - {report['generated_at'][:10]}",
        "",
        f"Scope: portal={scope['portal_slug']}, include_inactive={scope['include_inactive']}",
        "",
        "## Summary",
        "",
        f"- Sources reviewed: {summary['sources_reviewed']}",
        f"- Queued sources: {summary['queued_sources']}",
        f"- Workstreams: {', '.join(f'{key}={value}' for key, value in summary['workstream_counts'].items()) or 'none'}",
        f"- Weekly actions: {', '.join(f'{key}={value}' for key, value in summary['weekly_action_counts'].items()) or 'none'}",
        f"- Gate statuses: {', '.join(f'{key}={value}' for key, value in summary['gate_status_counts'].items()) or 'none'}",
        "",
        "## Top Queue",
        "",
    ]

    if rows:
        lines.extend(
            [
                "| Workstream | Slug | Portal | Weekly | Gate | Score | Lane | Future | Recent 30d | Why |",
                "| --- | --- | --- | --- | --- | ---: | --- | ---: | ---: | --- |",
            ]
        )
        for row in rows[:limit]:
            reasons = row["weekly_reasons"] + row["gate_reasons"]
            why = "; ".join(dict.fromkeys(reasons)) or "-"
            lines.append(
                f"| {row['workstream']} | {row['slug']} | {row['portal_slug']} | {row['weekly_action']} | {row['gate_status']} | "
                f"{row['combined_priority_score']} | {row['entity_lane']} | {row['future_items']} | {row['recent_items_30d']} | {why} |"
            )
    else:
        lines.append("_No queued sources._")

    def add_section(title: str, workstream: str) -> None:
        section_rows = [row for row in rows if row["workstream"] == workstream]
        lines.extend(["", f"## {title}", ""])
        if not section_rows:
            lines.append("_None_")
            return
        lines.extend(
            [
                "| Slug | Portal | Weekly | Gate | Checks | Why |",
                "| --- | --- | --- | --- | --- | --- |",
            ]
        )
        for row in section_rows[:limit]:
            checks = ", ".join(row["gate_failing_checks"] or row["gate_warning_checks"]) or "-"
            reasons = row["weekly_reasons"] + row["gate_reasons"]
            why = "; ".join(dict.fromkeys(reasons)) or "-"
            lines.append(
                f"| {row['slug']} | {row['portal_slug']} | {row['weekly_action']} | {row['gate_status']} | {checks} | {why} |"
            )
        if len(section_rows) > limit:
            lines.extend(["", f"_Showing {limit} of {len(section_rows)} rows._"])

    add_section("Deterministic Upgrades", "deterministic-upgrade")
    add_section("Connector Promotions", "connector-promotion")
    add_section("Crawler Rehab", "crawler-rehab")
    add_section("Gate-Only Fixes", "gate-only-fix")
    add_section("Metadata Polish", "metadata-polish")

    return "\n".join(lines) + "\n"


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate merged weekly crawler operations queue")
    parser.add_argument("--include-inactive", action="store_true", help="Include inactive sources")
    parser.add_argument("--portal", help="Limit review to a single portal slug")
    parser.add_argument("--output", help="Markdown output path")
    parser.add_argument("--json-output", help="Optional JSON output path")
    parser.add_argument("--limit", type=int, default=25, help="Rows per markdown section")
    args = parser.parse_args()

    report = build_ops_queue(include_inactive=args.include_inactive, portal_slug=args.portal)
    markdown = render_markdown(report, limit=max(1, args.limit))

    output_path = Path(args.output) if args.output else DEFAULT_REPORT_DIR / f"weekly_ops_queue_{date.today().isoformat()}.md"
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(markdown, encoding="utf-8")
    print(f"Wrote markdown report: {output_path}")

    if args.json_output:
        json_path = Path(args.json_output)
        json_path.parent.mkdir(parents=True, exist_ok=True)
        json_path.write_text(json.dumps(report, indent=2, sort_keys=True), encoding="utf-8")
        print(f"Wrote JSON report: {json_path}")

    print(
        "Workstreams:",
        ", ".join(f"{key}={value}" for key, value in sorted(report["summary"]["workstream_counts"].items())) or "none",
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
