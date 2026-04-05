#!/usr/bin/env python3
"""Fail-fast promotion gate for festival quality.

This gate reuses the live festival audit snapshot plus the bounded LLM pilot
summary to produce a machine-readable decision artifact.
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
CRAWLERS_ROOT = REPO_ROOT / "crawlers"
sys.path.insert(0, str(CRAWLERS_ROOT))

from festival_audit_metrics import compute_festival_audit_snapshot
from scripts.festival_quality_report import _summarize_llm_pilot, build_report_payload


def build_gate_report() -> dict:
    snapshot = compute_festival_audit_snapshot()
    pilot = _summarize_llm_pilot(
        CRAWLERS_ROOT / "llm-tasks" / "festivals",
        CRAWLERS_ROOT / "llm-results" / "festivals",
    )
    payload = build_report_payload(snapshot, pilot)
    holds = payload["promotion_holds"]
    overall = payload["evaluation"]["overall"]

    if holds:
        decision = "HOLD"
    elif overall == "FAIL":
        decision = "HOLD"
    elif overall == "WARN":
        decision = "WARN"
    else:
        decision = "PASS"

    return {
        "generated_at": datetime.utcnow().isoformat(timespec="seconds") + "Z",
        "decision": decision,
        "overall_gate_status": overall,
        "promotion_hold_count": len(holds),
        "promotion_holds": holds,
        "top_remediation_queue": payload["remediation_queue"][:10],
        "llm_pilot": {
            "tasks_total": pilot["tasks_total"],
            "results_total": pilot["results_total"],
            "accepted_total": pilot["accepted_total"],
            "rejected_total": pilot["rejected_total"],
            "prepared_only_total": pilot["prepared_only_total"],
        },
        "derived": snapshot["derived"],
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Evaluate festival promotion gate")
    parser.add_argument(
        "--output",
        type=Path,
        default=REPO_ROOT
        / "crawlers"
        / "reports"
        / "festival_promotion_gate_latest.json",
        help="JSON output path",
    )
    args = parser.parse_args()

    report = build_gate_report()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(args.output)
    return 0 if report["decision"] == "PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())
