#!/usr/bin/env python3
# ruff: noqa: E402
"""Generate the machine-readable venue-description pilot gate."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

CRAWLERS_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(CRAWLERS_ROOT))

from venue_description_metrics import (
    build_venue_description_gate,
    compute_venue_description_snapshot,
)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Generate the venue-description pilot gate"
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=CRAWLERS_ROOT / "reports" / "venue_description_gate_latest.json",
    )
    args = parser.parse_args()

    snapshot = compute_venue_description_snapshot()
    gate = build_venue_description_gate(snapshot)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(gate, indent=2), encoding="utf-8")
    print(args.output)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
