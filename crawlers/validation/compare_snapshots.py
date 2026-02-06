#!/usr/bin/env python3
"""
Compare two snapshot JSON files and print coverage deltas.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any


def _load(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text())


def _format_delta(value: float) -> str:
    sign = "+" if value >= 0 else ""
    return f"{sign}{value:.2f}"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base", required=True, help="Baseline snapshot JSON")
    parser.add_argument("--candidate", required=True, help="Candidate snapshot JSON")
    args = parser.parse_args()

    base = _load(Path(args.base))
    cand = _load(Path(args.candidate))

    base_cov = base.get("coverage", {})
    cand_cov = cand.get("coverage", {})

    keys = sorted(set(base_cov.keys()) | set(cand_cov.keys()))

    print("Snapshot Comparison")
    print("=" * 60)
    print(f"Base: {base.get('source', {}).get('slug')} ({base.get('mode')})")
    print(f"Cand: {cand.get('source', {}).get('slug')} ({cand.get('mode')})")
    print("-")

    for key in keys:
        b = float(base_cov.get(key, 0.0))
        c = float(cand_cov.get(key, 0.0))
        delta = c - b
        print(f"{key:15} {b:7.2f}% -> {c:7.2f}%  ({_format_delta(delta)})")

    print("-")
    print(
        f"Totals: {base.get('counts', {}).get('total', 0)} -> {cand.get('counts', {}).get('total', 0)}"
    )


if __name__ == "__main__":
    main()
