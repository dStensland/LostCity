#!/usr/bin/env python3
"""Deep festival diagnostic aligned to current schema and quality gates.

Usage:
  python3 festival_deep_diagnostic.py
  python3 festival_deep_diagnostic.py --json
  python3 festival_deep_diagnostic.py --json-out reports/festival_deep_diagnostic.json
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

from festival_audit_metrics import compute_festival_audit_snapshot, evaluate_positive_state


STATUS_ICON = {
    "PASS": "✅",
    "WARN": "⚠️",
    "FAIL": "❌",
}


def _print_section(title: str) -> None:
    print("\n" + "=" * 80)
    print(title)
    print("=" * 80)


def _print_gate_section(gate_eval: dict[str, Any]) -> None:
    _print_section("POSITIVE-STATE GATES")
    for gate in gate_eval["gates"]:
        icon = STATUS_ICON[gate["status"]]
        if gate["direction"] == "min":
            target = f"target>={gate['warn']:.1f}% (fail<{gate['fail']:.1f}%)"
            value = f"{gate['value']:.1f}%"
        else:
            target = f"target<={gate['warn']:.1f} (fail>{gate['fail']:.1f})"
            value = f"{gate['value']:.1f}"
        print(f"{icon} {gate['label']}: {value} [{gate['status']}] {target}")


def _print_dict_rows(title: str, rows: list[dict[str, Any]], keys: list[str], limit: int) -> None:
    print(f"\n{title} ({len(rows)})")
    if not rows:
        print("  - none")
        return
    for row in rows[:limit]:
        bits = [f"{key}={row.get(key)}" for key in keys]
        print("  - " + ", ".join(bits))
    if len(rows) > limit:
        print(f"  ... and {len(rows) - limit} more")


def _print_detail(snapshot: dict[str, Any], gate_eval: dict[str, Any], limit: int) -> None:
    counts = snapshot["counts"]
    scope = snapshot.get("scope", {})
    date_quality = snapshot["date_quality"]
    description_quality = snapshot["description_quality"]
    schedule_quality = snapshot["schedule_quality"]
    model_fit = snapshot["model_fit"]
    samples = snapshot["samples"]

    _print_section("FESTIVAL DEEP DIAGNOSTIC")
    print(f"Snapshot date: {snapshot['snapshot_date']}")
    print(
        "Universe: "
        f"festivals={counts['festivals']}, "
        f"festival-linked series={counts['festival_linked_series']}, "
        f"festival_program series={counts['festival_program_series']}, "
        f"festival-linked events={counts['festival_linked_events']}"
    )
    if scope:
        print(
            "Gate scope: "
            f"definition={scope.get('definition')}, "
            f"cutoff={scope.get('cutoff_date')}, "
            f"in_scope_festivals={counts.get('festivals_in_scope', 0)}"
        )

    _print_gate_section(gate_eval)

    _print_section("DATE INTEGRITY")
    print(json.dumps(date_quality, indent=2))
    _print_dict_rows(
        "Missing announced_start festivals",
        samples["festival_missing_announced_start"],
        ["slug", "pending_start", "last_year_start"],
        limit,
    )
    _print_dict_rows(
        "Festivals with out-of-window events",
        samples["festivals_with_events_outside_announced_window"],
        ["slug", "outside_count", "window"],
        limit,
    )

    _print_section("DESCRIPTION QUALITY")
    print(json.dumps(description_quality, indent=2))
    _print_dict_rows(
        "Festival rows missing description",
        samples["festival_missing_description"],
        ["slug", "name"],
        limit,
    )
    _print_dict_rows(
        "Series rows missing description",
        samples["series_missing_description"],
        ["series_id", "festival_id", "title"],
        limit,
    )
    _print_dict_rows(
        "Festival events missing description",
        samples["festival_events_missing_description"],
        ["event_id", "source_slug", "title"],
        limit,
    )

    _print_section("SCHEDULE STRUCTURE")
    print(json.dumps(schedule_quality, indent=2))
    _print_dict_rows(
        "Ghost festival_program series",
        samples["ghost_program_series"],
        ["series_id", "festival_id", "title"],
        limit,
    )
    _print_dict_rows(
        "Single-event festival_program series",
        samples["single_program_series"],
        ["series_id", "festival_id", "title"],
        limit,
    )
    _print_dict_rows(
        "Fragmented sources",
        samples["fragmented_sources"],
        ["source_slug", "festival_program_series"],
        limit,
    )

    _print_section("MODEL FIT (FESTIVAL VS TENTPOLE EVENT)")
    print(json.dumps(model_fit, indent=2))
    _print_dict_rows(
        "Tentpole-fit candidates (demote festival model)",
        samples["tentpole_fit_candidates"],
        [
            "slug",
            "event_count",
            "program_series_count",
            "unique_venue_count",
            "simple_reasons",
        ],
        limit,
    )
    _print_dict_rows(
        "Festival-fit examples (keep festival model)",
        samples["festival_fit_examples"],
        [
            "slug",
            "event_count",
            "program_series_count",
            "unique_venue_count",
            "complex_reasons",
        ],
        limit,
    )
    _print_dict_rows(
        "Ambiguous model-fit rows",
        samples["model_fit_ambiguous"],
        [
            "slug",
            "event_count",
            "program_series_count",
            "unique_venue_count",
            "simple_reasons",
            "complex_reasons",
        ],
        limit,
    )

    print("\n" + "=" * 80)
    overall_icon = STATUS_ICON[gate_eval["overall"]]
    print(f"Overall positive-state status: {overall_icon} {gate_eval['overall']}")


def main() -> int:
    parser = argparse.ArgumentParser(description="Run deep festival diagnostic")
    parser.add_argument("--json", action="store_true", help="Print JSON to stdout")
    parser.add_argument("--json-out", help="Write JSON payload to a file")
    parser.add_argument("--limit", type=int, default=12, help="Sample row print limit")
    parser.add_argument(
        "--strict",
        action="store_true",
        help="Return non-zero unless all positive-state gates are PASS",
    )
    args = parser.parse_args()

    snapshot = compute_festival_audit_snapshot()
    gate_eval = evaluate_positive_state(snapshot)
    payload = {"snapshot": snapshot, "gates": gate_eval}

    if args.json:
        print(json.dumps(payload, indent=2))
    else:
        _print_detail(snapshot, gate_eval, args.limit)

    if args.json_out:
        out_path = Path(args.json_out)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(json.dumps(payload, indent=2) + "\n")
        print(f"\nWrote: {out_path}")

    if args.strict and gate_eval["overall"] != "PASS":
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
