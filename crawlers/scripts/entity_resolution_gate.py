#!/usr/bin/env python3
"""Generate the machine-readable Phase 4 entity-resolution baseline gate."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

CRAWLERS_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(CRAWLERS_ROOT))

from entity_resolution_metrics import (
    build_entity_resolution_gate,
    compute_entity_resolution_snapshot,
)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Generate the entity-resolution baseline gate"
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=CRAWLERS_ROOT / "reports" / "entity_resolution_gate_latest.json",
    )
    args = parser.parse_args()

    snapshot = compute_entity_resolution_snapshot()
    gate = build_entity_resolution_gate(snapshot)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(gate, indent=2), encoding="utf-8")
    print(args.output)
    return 0 if gate["decision"] != "INCOMPLETE" else 1


if __name__ == "__main__":
    raise SystemExit(main())
