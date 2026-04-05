#!/usr/bin/env python3
"""Generate the bounded venue-description expansion report."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

CRAWLERS_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(CRAWLERS_ROOT))

from venue_description_metrics import compute_venue_description_snapshot


def _render_rows(rows: list[dict], columns: list[tuple[str, str]]) -> list[str]:
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
    candidates = snapshot["issues"]["pilot_candidates"]
    monitor_only = snapshot["issues"]["monitor_only"]

    lines = [
        "# Venue Description Pilot Report",
        "",
        f"- Generated: {snapshot['generated_at']}",
        "",
        "## Pilot Metrics",
        "",
        f"- Eligible website-backed Tier 1+ places: {counts['eligible_places']}",
        f"- Pilot candidate count: {counts['pilot_candidate_count']}",
        f"- Monitor-only low-signal count: {counts.get('monitor_only_count', 0)}",
        f"- Healthy description rate: {metrics['healthy_description_pct']}%",
        f"- Missing description rate: {metrics['missing_description_pct']}%",
        f"- Junk / boilerplate rate: {metrics['junk_or_boilerplate_pct']}%",
        f"- Short description rate: {metrics['short_description_pct']}%",
        "",
        "## Pilot Queue",
        "",
    ]
    lines.extend(
        _render_rows(
            candidates[:15],
            [
                ("Tier", "tier_label"),
                ("Name", "name"),
                ("Type", "place_type"),
                ("Issue", "issue_type"),
                ("Reason", "reason"),
                ("Description Len", "description_len"),
                ("Slug", "slug"),
            ],
        )
    )
    lines.extend(
        [
            "## Monitor-Only Queue",
            "",
        ]
    )
    lines.extend(
        _render_rows(
            monitor_only[:15],
            [
                ("Tier", "tier_label"),
                ("Name", "name"),
                ("Type", "place_type"),
                ("Issue", "issue_type"),
                ("Queue Reason", "queue_reason"),
                ("Description Len", "description_len"),
                ("Slug", "slug"),
            ],
        )
    )
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Generate the venue-description pilot report"
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=CRAWLERS_ROOT / "reports" / "venue_description_report_latest.md",
    )
    args = parser.parse_args()

    snapshot = compute_venue_description_snapshot()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(render_markdown(snapshot), encoding="utf-8")
    print(args.output)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
