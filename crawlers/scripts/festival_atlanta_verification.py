#!/usr/bin/env python3
"""Generate an Atlanta-facing verification snapshot for festival quality."""

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

from festival_audit_metrics import compute_festival_audit_snapshot
from scripts.festival_promotion_gate import build_gate_report
from scripts.festival_quality_report import build_report_payload, _summarize_llm_pilot


def build_atlanta_verification(
    snapshot: dict[str, Any], gate: dict[str, Any]
) -> dict[str, Any]:
    report_payload = build_report_payload(
        snapshot,
        _summarize_llm_pilot(
            CRAWLERS_ROOT / "llm-tasks" / "festivals",
            CRAWLERS_ROOT / "llm-results" / "festivals",
        ),
    )
    remediation_queue = report_payload["remediation_queue"]
    date_quality = snapshot["date_quality"]
    description_quality = snapshot["description_quality"]
    samples = snapshot["samples"]

    if gate["decision"] != "PASS":
        status = gate["decision"]
    elif remediation_queue:
        status = "WARN"
    elif date_quality["festival_missing_announced_start"] > 0:
        status = "WARN"
    else:
        status = "PASS"

    return {
        "generated_at": datetime.utcnow().isoformat(timespec="seconds") + "Z",
        "status": status,
        "overall_gate_status": gate["overall_gate_status"],
        "promotion_decision": gate["decision"],
        "promotion_hold_count": gate["promotion_hold_count"],
        "remediation_queue_count": len(remediation_queue),
        "counts": {
            "in_scope_festivals": snapshot["counts"]["festivals_in_scope"],
            "festival_missing_announced_start": date_quality[
                "festival_missing_announced_start"
            ],
            "festival_past_cycle_pending_only": date_quality[
                "festival_past_cycle_pending_only"
            ],
            "festivals_with_events_outside_announced_window": date_quality[
                "festivals_with_events_outside_announced_window"
            ],
            "festival_short_description_lt80": description_quality[
                "festival_short_description_lt80"
            ],
            "series_description_gap_festivals": len(
                description_quality["top_series_description_gap_festivals"]
            ),
        },
        "samples": {
            "missing_announced_start": samples["festival_missing_announced_start"][:10],
            "short_festival_descriptions": samples["festival_short_description"][:10],
            "outside_window": samples["festivals_with_events_outside_announced_window"][
                :10
            ],
            "historical_pending_only": samples["festival_past_cycle_pending_only"][:10],
            "remediation_queue": remediation_queue[:10],
        },
    }


def _render_simple_table(
    title: str, rows: list[dict[str, Any]], columns: list[tuple[str, str]]
) -> list[str]:
    if not rows:
        return [f"## {title}", "", "_None_", ""]
    lines = [
        f"## {title}",
        "",
        "| " + " | ".join(label for label, _ in columns) + " |",
        "|" + "|".join("---" for _ in columns) + "|",
    ]
    for row in rows:
        lines.append(
            "| " + " | ".join(str(row.get(key, "")) for _, key in columns) + " |"
        )
    lines.append("")
    return lines


def render_markdown(verification: dict[str, Any]) -> str:
    counts = verification["counts"]
    samples = verification["samples"]
    lines = [
        "# Atlanta Festival Verification",
        "",
        f"- Generated: {verification['generated_at']}",
        f"- Verification status: **{verification['status']}**",
        f"- Promotion decision: **{verification['promotion_decision']}**",
        f"- Overall gate status: **{verification['overall_gate_status']}**",
        f"- Promotion holds: {verification['promotion_hold_count']}",
        f"- Remediation queue entries: {verification['remediation_queue_count']}",
        "",
        "## Consumer-Facing Checks",
        "",
        f"- In-scope festivals: {counts['in_scope_festivals']}",
        f"- Missing announced start (in scope): {counts['festival_missing_announced_start']}",
        f"- Festivals with events outside announced windows: {counts['festivals_with_events_outside_announced_window']}",
        f"- Short festival descriptions (<80 chars): {counts['festival_short_description_lt80']}",
        f"- Historical past-cycle pending-only rows: {counts['festival_past_cycle_pending_only']}",
        "",
    ]

    lines.extend(
        _render_simple_table(
            "Active Remediation Queue",
            samples["remediation_queue"],
            [
                ("Target", "target"),
                ("Scope", "scope"),
                ("Reason", "reason"),
                ("Evidence", "evidence"),
            ],
        )
    )
    lines.extend(
        _render_simple_table(
            "Missing Announced Start Samples",
            samples["missing_announced_start"],
            [
                ("Slug", "slug"),
                ("Pending Start", "pending_start"),
                ("Last Year Start", "last_year_start"),
                ("Date Source", "date_source"),
            ],
        )
    )
    lines.extend(
        _render_simple_table(
            "Short Festival Description Samples",
            samples["short_festival_descriptions"],
            [("Slug", "slug"), ("Length", "len"), ("Sample", "sample")],
        )
    )
    lines.extend(
        _render_simple_table(
            "Outside-Window Samples",
            samples["outside_window"],
            [
                ("Slug", "slug"),
                ("Outside Count", "outside_count"),
                ("Window", "window"),
            ],
        )
    )
    lines.extend(
        _render_simple_table(
            "Historical Past-Cycle Pending-Only Rows",
            samples["historical_pending_only"],
            [
                ("Slug", "slug"),
                ("Pending Start", "pending_start"),
                ("Pending End", "pending_end"),
                ("Date Source", "date_source"),
            ],
        )
    )
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Generate Atlanta-facing festival verification"
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=CRAWLERS_ROOT / "reports" / "festival_atlanta_verification_latest.md",
        help="Markdown output path",
    )
    args = parser.parse_args()

    snapshot = compute_festival_audit_snapshot()
    gate = build_gate_report()
    verification = build_atlanta_verification(snapshot, gate)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(render_markdown(verification), encoding="utf-8")
    print(args.output)
    return 0 if verification["status"] == "PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())
