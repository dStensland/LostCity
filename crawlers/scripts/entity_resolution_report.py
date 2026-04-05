#!/usr/bin/env python3
"""Generate the Phase 4 entity-resolution baseline report."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

CRAWLERS_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(CRAWLERS_ROOT))

from entity_resolution_metrics import compute_entity_resolution_snapshot


def _render_issue_rows(rows: list[dict], columns: list[tuple[str, str]]) -> list[str]:
    if not rows:
        return ["_None_", ""]
    lines = [
        "| " + " | ".join(label for label, _ in columns) + " |",
        "|" + "|".join("---" for _ in columns) + "|",
    ]
    for row in rows:
        lines.append(
            "| " + " | ".join(str(row.get(key, "")) for _, key in columns) + " |"
        )
    lines.append("")
    return lines


def render_markdown(snapshot: dict) -> str:
    counts = snapshot["counts"]
    metrics = snapshot["metrics"]
    issues = snapshot["issues"]
    top_issues = snapshot["top_issues"]

    lines = [
        "# Entity Resolution Report",
        "",
        f"- Generated: {snapshot['generated_at']}",
        "",
        "## Baseline Metrics",
        "",
        f"- Duplicate place rate: {metrics['duplicate_place_rate_pct']}%",
        f"- Unresolved place/source match rate: {metrics['unresolved_place_source_match_rate_pct']}%",
        f"- Festival yearly-wrapper fragmentation rate: {metrics['festival_yearly_wrapper_fragmentation_rate_pct']}%",
        f"- Program/session fragmentation rate: {metrics['program_session_fragmentation_rate_pct']}%",
        f"- Organizer duplication rate: {metrics['organizer_duplication_rate_pct']}%",
        "",
        "## Inventory Snapshot",
        "",
        f"- Venues: {counts['venues']}",
        f"- Events sampled for resolution: {counts['events']}",
        f"- Programs: {counts['programs']}",
        f"- Festivals: {counts['festivals']}",
        f"- Festival-linked series: {counts['festival_linked_series']}",
        f"- Organizers: {counts['organizers']}",
        "",
        "## Top Issues",
        "",
    ]
    lines.extend(
        _render_issue_rows(
            top_issues,
            [
                ("Family", "entity_family"),
                ("Issue", "issue_type"),
                ("Classification", "label"),
                ("Count", "count"),
                ("Sample", "sample_names"),
            ],
        )
    )
    lines.extend(["## Venue Duplicate Families", ""])
    lines.extend(
        _render_issue_rows(
            issues["venue"],
            [
                ("Classification", "label"),
                ("Count", "count"),
                ("Sample", "sample_names"),
            ],
        )
    )
    lines.extend(["## Festival Yearly-Wrapper Families", ""])
    lines.extend(
        _render_issue_rows(
            issues["festival"],
            [
                ("Festival", "festival_slug"),
                ("Classification", "label"),
                ("Count", "count"),
                ("Sample", "sample_names"),
            ],
        )
    )
    lines.extend(["## Program / Session Families", ""])
    lines.extend(
        _render_issue_rows(
            issues["program"],
            [
                ("Classification", "label"),
                ("Count", "count"),
                ("Sample", "sample_names"),
            ],
        )
    )
    lines.extend(["## Organizer Duplicate Families", ""])
    lines.extend(
        _render_issue_rows(
            issues["organizer"],
            [
                ("Classification", "label"),
                ("Count", "count"),
                ("Sample", "sample_names"),
            ],
        )
    )
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Generate the entity-resolution baseline report"
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=CRAWLERS_ROOT / "reports" / "entity_resolution_report_latest.md",
    )
    args = parser.parse_args()

    snapshot = compute_entity_resolution_snapshot()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(render_markdown(snapshot), encoding="utf-8")
    print(args.output)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
