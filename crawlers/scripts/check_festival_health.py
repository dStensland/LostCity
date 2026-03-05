#!/usr/bin/env python3
"""Festival health check with enforced positive-state gates.

Usage:
  python3 check_festival_health.py
  python3 check_festival_health.py --json

Exit code:
  0 only when all gates are PASS.
  1 when any gate is WARN or FAIL.
"""

from __future__ import annotations

import argparse
import json
import sys
from typing import Any

from festival_audit_metrics import compute_festival_audit_snapshot, evaluate_positive_state


STATUS_ICON = {
    "PASS": "✅",
    "WARN": "⚠️",
    "FAIL": "❌",
}


def _print_gate_results(gate_eval: dict[str, Any]) -> None:
    print("\n" + "=" * 80)
    print("FESTIVAL POSITIVE-STATE HEALTH CHECK")
    print("=" * 80)

    for gate in gate_eval["gates"]:
        icon = STATUS_ICON[gate["status"]]
        if gate["direction"] == "min":
            target = f"target>={gate['warn']:.1f}% (fail<{gate['fail']:.1f}%)"
            value = f"{gate['value']:.1f}%"
        else:
            target = f"target<={gate['warn']:.1f} (fail>{gate['fail']:.1f})"
            value = f"{gate['value']:.1f}"

        print(f"{icon} {gate['label']}: {value} [{gate['status']}] {target}")

    print("\n" + "=" * 80)
    overall_icon = STATUS_ICON[gate_eval["overall"]]
    print(f"Overall status: {overall_icon} {gate_eval['overall']}")



def main() -> int:
    parser = argparse.ArgumentParser(description="Check festival data health gates")
    parser.add_argument("--json", action="store_true", help="Emit full JSON payload")
    args = parser.parse_args()

    snapshot = compute_festival_audit_snapshot()
    gate_eval = evaluate_positive_state(snapshot)

    if args.json:
        print(json.dumps({"snapshot": snapshot, "gates": gate_eval}, indent=2))
    else:
        _print_gate_results(gate_eval)

    # Health is considered positive only with all PASS gates.
    return 0 if gate_eval["overall"] == "PASS" else 1


if __name__ == "__main__":
    sys.exit(main())
