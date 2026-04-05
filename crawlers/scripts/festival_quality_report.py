#!/usr/bin/env python3
"""Generate a minimum viable festival quality report.

This report combines the shared festival audit snapshot with the bounded
festival LLM pilot outputs so operators can see both platform-level quality
health and the current pilot status in one place.
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[2]
CRAWLERS_ROOT = REPO_ROOT / "crawlers"
sys.path.insert(0, str(CRAWLERS_ROOT))

from enrich_festivals import _passes_description_quality
from festival_audit_metrics import (
    compute_festival_audit_snapshot,
    evaluate_positive_state,
)


def _load_json_files(directory: Path) -> list[dict[str, Any]]:
    if not directory.exists():
        return []
    rows: list[dict[str, Any]] = []
    for path in sorted(directory.glob("*.json")):
        try:
            rows.append(json.loads(path.read_text(encoding="utf-8")))
        except Exception:
            continue
    return rows


def _summarize_llm_pilot(task_dir: Path, result_dir: Path) -> dict[str, Any]:
    tasks = _load_json_files(task_dir)
    results = _load_json_files(result_dir)

    result_by_slug = {row.get("slug"): row for row in results if row.get("slug")}
    accepted: list[dict[str, Any]] = []
    rejected: list[dict[str, Any]] = []

    for row in results:
        description = str(row.get("description") or "")
        source_text = str(row.get("source_text") or "")
        passed, reason = _passes_description_quality(description, source_text)
        status_row = {
            "slug": row.get("slug"),
            "name": row.get("name"),
            "status": "accepted" if passed else "rejected",
            "reason": reason,
            "description_length": len(description),
            "source_length": len(source_text),
        }
        if passed:
            accepted.append(status_row)
        else:
            rejected.append(status_row)

    prepared_without_result = []
    for task in tasks:
        slug = task.get("slug")
        if slug and slug not in result_by_slug:
            prepared_without_result.append(
                {
                    "slug": slug,
                    "name": task.get("name"),
                    "status": "prepared_only",
                }
            )

    return {
        "tasks_total": len(tasks),
        "results_total": len(results),
        "accepted_total": len(accepted),
        "rejected_total": len(rejected),
        "prepared_only_total": len(prepared_without_result),
        "accepted": accepted[:20],
        "rejected": rejected[:20],
        "prepared_only": prepared_without_result[:20],
    }


def _format_gate_table(gates: list[dict[str, Any]]) -> list[str]:
    lines = [
        "| Gate | Value | Warn | Fail | Status |",
        "|---|---:|---:|---:|---|",
    ]
    for gate in gates:
        lines.append(
            f"| {gate['label']} | {gate['value']:.1f} | {gate['warn']:.1f} | {gate['fail']:.1f} | {gate['status']} |"
        )
    return lines


def _format_pairs(
    title: str, rows: list[list[Any]] | list[tuple[Any, Any]]
) -> list[str]:
    if not rows:
        return [f"### {title}", "", "_None_", ""]
    lines = [f"### {title}", "", "| Source | Count |", "|---|---:|"]
    for source, count in rows:
        lines.append(f"| {source} | {count} |")
    lines.append("")
    return lines


def _format_pilot_rows(
    title: str, rows: list[dict[str, Any]], include_reason: bool = False
) -> list[str]:
    if not rows:
        return [f"### {title}", "", "_None_", ""]
    if include_reason:
        lines = [f"### {title}", "", "| Slug | Name | Reason |", "|---|---|---|"]
        for row in rows:
            lines.append(f"| {row['slug']} | {row['name']} | {row['reason']} |")
    else:
        lines = [f"### {title}", "", "| Slug | Name |", "|---|---|"]
        for row in rows:
            lines.append(f"| {row['slug']} | {row['name']} |")
    lines.append("")
    return lines


def _build_promotion_holds(snapshot: dict[str, Any]) -> list[dict[str, Any]]:
    description_quality = snapshot["description_quality"]
    fragmented_sources = snapshot["samples"].get("fragmented_sources", [])

    holds: dict[str, dict[str, Any]] = {}

    for row in fragmented_sources:
        source_slug = row["source_slug"]
        holds[source_slug] = {
            "target": source_slug,
            "scope": "source",
            "reason": "festival_program fragmentation",
            "evidence": f"{row['festival_program_series']} festival_program series",
            "action": "hold promotion until festival_program series fragmentation is reduced",
        }

    for source_slug, count in description_quality.get(
        "top_short_description_sources", []
    ):
        if count < 10:
            continue
        holds.setdefault(
            source_slug,
            {
                "target": source_slug,
                "scope": "source",
                "reason": "festival event descriptions too short",
                "evidence": f"{count} short festival event descriptions",
                "action": "hold promotion until short-description count drops below 10",
            },
        )

    for source_slug, count in description_quality.get(
        "top_missing_description_sources", []
    ):
        if count < 2:
            continue
        holds.setdefault(
            source_slug,
            {
                "target": source_slug,
                "scope": "source",
                "reason": "festival event descriptions missing",
                "evidence": f"{count} missing festival event descriptions",
                "action": "hold promotion until missing-description count drops below 2",
            },
        )

    return sorted(holds.values(), key=lambda row: (row["scope"], row["target"]))


def _build_remediation_queue(snapshot: dict[str, Any]) -> list[dict[str, Any]]:
    description_quality = snapshot["description_quality"]
    schedule_quality = snapshot["schedule_quality"]
    samples = snapshot["samples"]
    queue: list[dict[str, Any]] = []

    for row in samples.get("fragmented_sources", [])[:5]:
        queue.append(
            {
                "target": row["source_slug"],
                "scope": "source",
                "reason": "festival_program fragmentation",
                "evidence": f"{row['festival_program_series']} festival_program series",
                "action": "collapse ghost/single festival_program series before the next promotion",
            }
        )

    for row in schedule_quality.get("top_orphan_program_festivals", [])[:5]:
        if row["orphan_program_series"] <= 0:
            continue
        queue.append(
            {
                "target": row["slug"],
                "scope": "festival",
                "reason": "orphan festival_program series",
                "evidence": (
                    f"{row['orphan_program_series']} orphan series "
                    f"({row['ghost_program_series']} ghost / {row['single_program_series']} single)"
                ),
                "action": "delete zero-event ghost series and unlink one-off festival_program series that should be direct festival events",
            }
        )

    for row in description_quality.get("top_series_description_gap_festivals", [])[:5]:
        if row["series_description_gaps"] <= 0:
            continue
        queue.append(
            {
                "target": row["slug"],
                "scope": "festival",
                "reason": "festival series descriptions weak",
                "evidence": (
                    f"{row['series_description_gaps']} weak series descriptions "
                    f"({row['series_missing_description']} missing / {row['series_short_description']} short)"
                ),
                "action": "backfill first-pass series descriptions or collapse stale series that no longer represent active festival structure",
            }
        )

    for row in samples.get("tentpole_fit_candidates", [])[:5]:
        queue.append(
            {
                "target": row["slug"],
                "scope": "festival",
                "reason": "festival likely fits tentpole model",
                "evidence": (
                    f"events={row['event_count']} program_series={row['program_series_count']} "
                    f"active_program_series={row['active_program_series_count']}"
                ),
                "action": "review demotion from festival container to tentpole event if the source only produces one real anchor event",
            }
        )

    missing_announced_start_rows = [
        row
        for row in samples.get("festival_missing_announced_start", [])
        if row.get("date_source") != "auto-demoted-stale"
    ]

    for row in missing_announced_start_rows[:5]:
        queue.append(
            {
                "target": row["slug"],
                "scope": "festival",
                "reason": "missing announced start",
                "evidence": f"pending_start={row['pending_start']} last_year_start={row['last_year_start']}",
                "action": "promote a valid announced_start or improve date extraction",
            }
        )

    for row in samples.get("festivals_with_events_outside_announced_window", [])[:5]:
        queue.append(
            {
                "target": row["slug"],
                "scope": "festival",
                "reason": "events outside announced window",
                "evidence": f"{row['outside_count']} event(s) outside {row['window'][0]}..{row['window'][1]}",
                "action": "tighten festival window logic or unlink out-of-window events",
            }
        )

    deduped: list[dict[str, Any]] = []
    seen: set[tuple[str, str]] = set()
    for row in queue:
        key = (row["scope"], row["target"])
        if key in seen:
            continue
        seen.add(key)
        deduped.append(row)
    return deduped


def _format_action_rows(title: str, rows: list[dict[str, Any]]) -> list[str]:
    if not rows:
        return [f"### {title}", "", "_None_", ""]
    lines = [
        f"### {title}",
        "",
        "| Target | Scope | Reason | Evidence | Action |",
        "|---|---|---|---|---|",
    ]
    for row in rows:
        lines.append(
            f"| {row['target']} | {row['scope']} | {row['reason']} | {row['evidence']} | {row['action']} |"
        )
    lines.append("")
    return lines


def build_report_payload(
    snapshot: dict[str, Any], pilot: dict[str, Any]
) -> dict[str, Any]:
    evaluation = evaluate_positive_state(snapshot)
    promotion_holds = _build_promotion_holds(snapshot)
    remediation_queue = _build_remediation_queue(snapshot)
    return {
        "evaluation": evaluation,
        "promotion_holds": promotion_holds,
        "remediation_queue": remediation_queue,
        "snapshot": snapshot,
        "pilot": pilot,
    }


def render_markdown(snapshot: dict[str, Any], pilot: dict[str, Any]) -> str:
    payload = build_report_payload(snapshot, pilot)
    evaluation = payload["evaluation"]
    counts = snapshot["counts"]
    description_quality = snapshot["description_quality"]
    date_quality = snapshot["date_quality"]
    schedule_quality = snapshot["schedule_quality"]
    promotion_holds = payload["promotion_holds"]
    remediation_queue = payload["remediation_queue"]

    lines = [
        "# Festival Quality Report",
        "",
        f"- Generated: {datetime.utcnow().isoformat(timespec='seconds')}Z",
        f"- Overall gate status: **{evaluation['overall']}**",
        "",
        "## Coverage Snapshot",
        "",
        f"- In-scope festivals: {counts['festivals_in_scope']} / {counts['festivals']}",
        f"- In-scope linked series: {counts['festival_linked_series_in_scope']}",
        f"- In-scope linked events: {counts['festival_linked_events_in_scope']}",
        "",
        "## Positive-State Gates",
        "",
        *_format_gate_table(evaluation["gates"]),
        "",
        "## Festival LLM Pilot",
        "",
        f"- Prepared tasks: {pilot['tasks_total']}",
        f"- Result files: {pilot['results_total']}",
        f"- Accepted by current dry-run gate: {pilot['accepted_total']}",
        f"- Rejected by current dry-run gate: {pilot['rejected_total']}",
        f"- Prepared without result: {pilot['prepared_only_total']}",
        "",
    ]

    lines.extend(_format_pilot_rows("Accepted pilot rows", pilot["accepted"]))
    lines.extend(
        _format_pilot_rows(
            "Rejected pilot rows", pilot["rejected"], include_reason=True
        )
    )
    lines.extend(_format_pilot_rows("Prepared-only pilot rows", pilot["prepared_only"]))
    lines.extend(
        _format_pairs(
            "Top festival event sources with short descriptions",
            description_quality.get("top_short_description_sources", []),
        )
    )
    lines.extend(
        _format_pairs(
            "Top festival event sources with missing descriptions",
            description_quality.get("top_missing_description_sources", []),
        )
    )
    lines.extend(_format_action_rows("Recommended promotion holds", promotion_holds))
    lines.extend(
        _format_action_rows("Recommended remediation queue", remediation_queue)
    )

    lines.extend(
        [
            "## Structural Risk Signals",
            "",
            f"- Festivals missing all dates (in scope): {date_quality['festival_missing_all_dates']}",
            f"- Festivals missing announced start (in scope): {date_quality['festival_missing_announced_start']}",
            f"- Past-cycle pending-only rows (historical, non-blocking): {date_quality['festival_past_cycle_pending_only']}",
            f"- Festival events outside announced windows: {date_quality['total_window_outside_events']} / {date_quality['total_window_scoped_events']}",
            f"- Ghost festival_program series: {schedule_quality['festival_program_ghost_series_zero_events']}",
            f"- Single-event festival_program series: {schedule_quality['festival_program_single_event_series']}",
            "",
        ]
    )

    return "\n".join(lines) + "\n"


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate a festival quality report")
    parser.add_argument(
        "--output",
        type=Path,
        default=REPO_ROOT
        / "crawlers"
        / "reports"
        / "festival_quality_report_latest.md",
        help="Markdown output path",
    )
    args = parser.parse_args()

    snapshot = compute_festival_audit_snapshot()
    pilot = _summarize_llm_pilot(
        CRAWLERS_ROOT / "llm-tasks" / "festivals",
        CRAWLERS_ROOT / "llm-results" / "festivals",
    )
    report = render_markdown(snapshot, pilot)

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(report, encoding="utf-8")
    print(args.output)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
