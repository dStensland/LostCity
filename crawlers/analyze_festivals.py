#!/usr/bin/env python3
"""Festival quality analyzer with positive-state gates.

Usage:
  python3 analyze_festivals.py
  python3 analyze_festivals.py --json
  python3 analyze_festivals.py --strict
"""

from __future__ import annotations

import argparse
import json
from typing import Any

from festival_audit_metrics import compute_festival_audit_snapshot, evaluate_positive_state


STATUS_ICON = {
    "PASS": "✅",
    "WARN": "⚠️",
    "FAIL": "❌",
}


def _print_gate_summary(gate_eval: dict[str, Any]) -> None:
    print("\nPOSITIVE-STATE GATES")
    print("-" * 80)
    for gate in gate_eval["gates"]:
        icon = STATUS_ICON[gate["status"]]
        if gate["direction"] == "min":
            threshold = f"warn<{gate['warn']:.1f} fail<{gate['fail']:.1f}"
        else:
            threshold = f"warn>{gate['warn']:.1f} fail>{gate['fail']:.1f}"
        print(
            f"{icon} {gate['label']}: {gate['value']:.1f} ({gate['status']}; {threshold})"
        )


def _print_top_list(title: str, rows: list[Any], limit: int = 8) -> None:
    print(f"\n{title}")
    print("-" * 80)
    for row in rows[:limit]:
        if isinstance(row, list) or isinstance(row, tuple):
            print(f"  - {row[0]}: {row[1]}")
        else:
            print(f"  - {row}")
    if len(rows) > limit:
        print(f"  ... and {len(rows) - limit} more")


def main() -> int:
    parser = argparse.ArgumentParser(description="Analyze festival data quality.")
    parser.add_argument("--json", action="store_true", help="Print full JSON output")
    parser.add_argument(
        "--strict",
        action="store_true",
        help="Return non-zero unless all positive-state gates are PASS",
    )
    args = parser.parse_args()

    snapshot = compute_festival_audit_snapshot()
    gate_eval = evaluate_positive_state(snapshot)

    if args.json:
        print(json.dumps({"snapshot": snapshot, "gates": gate_eval}, indent=2))
    else:
        counts = snapshot["counts"]
        scope = snapshot.get("scope", {})
        date_quality = snapshot["date_quality"]
        description_quality = snapshot["description_quality"]
        schedule_quality = snapshot["schedule_quality"]
        model_fit = snapshot["model_fit"]

        print("=" * 80)
        print("FESTIVAL DATA QUALITY ANALYSIS")
        print("=" * 80)
        print(f"Snapshot date: {snapshot['snapshot_date']}")
        print(
            "Universe: "
            f"{counts['festivals']} festivals, "
            f"{counts['festival_linked_series']} festival-linked series, "
            f"{counts['festival_linked_events']} festival-linked events"
        )
        if scope:
            print(
                "Gate scope: "
                f"{scope.get('definition')} since {scope.get('cutoff_date')} "
                f"({counts.get('festivals_in_scope', 0)} festivals in scope)"
            )

        _print_gate_summary(gate_eval)

        print("\nKEY METRICS")
        print("-" * 80)
        print(
            "Date: "
            f"missing announced_start={date_quality['festival_missing_announced_start']}, "
            f"missing all dates={date_quality['festival_missing_all_dates']}, "
            f"outside-window festivals={date_quality['festivals_with_events_outside_announced_window']}"
        )
        print(
            "Description: "
            f"festival missing={description_quality['festival_missing_description']}, "
            f"series missing={description_quality['series_missing_description']}, "
            f"event missing={description_quality['festival_events_missing_description']}"
        )
        print(
            "Schedule: "
            f"ghost program series={schedule_quality['festival_program_ghost_series_zero_events']}, "
            f"single-event program series={schedule_quality['festival_program_single_event_series']}, "
            f"fragmented sources={schedule_quality['sources_with_5plus_festival_program_series']}"
        )
        print(
            "Model fit: "
            f"festival_fit={model_fit['festival_fit_count']}, "
            f"tentpole_candidates={model_fit['tentpole_fit_candidate_count']}, "
            f"ambiguous={model_fit['ambiguous_count']}, "
            f"insufficient={model_fit['insufficient_data_count']}"
        )

        _print_top_list(
            "Top missing-event-description sources",
            description_quality["top_missing_description_sources"],
        )
        _print_top_list(
            "Top short-event-description sources",
            description_quality["top_short_description_sources"],
        )
        _print_top_list(
            "Example festivals with out-of-window events",
            [
                f"{row['slug']} ({row['outside_count']} outside)"
                for row in snapshot["samples"]["festivals_with_events_outside_announced_window"]
            ],
            limit=10,
        )
        _print_top_list(
            "Tentpole-fit candidates (should likely be normal tentpole events)",
            [
                (
                    row["slug"],
                    f"events={row['event_count']}, "
                    f"program_series={row['program_series_count']}, "
                    f"venues={row['unique_venue_count']}, "
                    f"reasons={','.join(row['simple_reasons'])}",
                )
                for row in snapshot["samples"]["tentpole_fit_candidates"]
            ],
            limit=10,
        )

        print("\n" + "=" * 80)
        overall_icon = STATUS_ICON[gate_eval["overall"]]
        print(f"Overall positive-state status: {overall_icon} {gate_eval['overall']}")

    if args.strict and gate_eval["overall"] != "PASS":
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
