#!/usr/bin/env python3
"""
Launch health gate wrapper.

Runs content_health_audit.py and fails CI/ops run if launch gate is not PASS.
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
AUDIT_SCRIPT = ROOT / "scripts" / "content_health_audit.py"


def normalize_city(value: str | None) -> str:
    if not value:
        return ""
    return " ".join(value.strip().lower().split())


def scope_slug(city: str | None, portal: str | None) -> str:
    city_slug = normalize_city(city) if city else ""
    portal_slug = normalize_city(portal) if portal else ""
    if city_slug and portal_slug:
        return f"portal-{portal_slug.replace(' ', '-')}_city-{city_slug.replace(' ', '-')}"
    if portal_slug:
        return f"portal-{portal_slug.replace(' ', '-')}"
    if city_slug:
        return f"city-{city_slug.replace(' ', '-')}"
    return "global"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run launch health audit and enforce PASS gate.")
    parser.add_argument(
        "--as-of",
        type=str,
        default=date.today().isoformat(),
        help="Audit date (YYYY-MM-DD). Default: today.",
    )
    parser.add_argument(
        "--window-days",
        type=int,
        default=30,
        help="Forward window in days. Default: 30.",
    )
    parser.add_argument(
        "--output-dir",
        type=str,
        default=str(ROOT / "reports"),
        help="Directory for generated audit artifacts.",
    )
    parser.add_argument(
        "--city",
        type=str,
        default=None,
        help="Optional city scope. Example: --city Atlanta",
    )
    parser.add_argument(
        "--portal",
        type=str,
        default=None,
        help="Optional portal slug scope. Includes public rows plus portal-scoped rows.",
    )
    parser.add_argument(
        "--strict-city",
        action="store_true",
        help="Disable metro expansion for --city Atlanta.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    portal_arg = args.portal
    if args.city and normalize_city(args.city) == "atlanta" and not portal_arg:
        portal_arg = "atlanta"
        print("Info: defaulting portal scope to 'atlanta' for --city Atlanta.")

    command = [
        sys.executable,
        str(AUDIT_SCRIPT),
        "--as-of",
        args.as_of,
        "--window-days",
        str(args.window_days),
        "--output-dir",
        args.output_dir,
    ]
    if args.city:
        command.extend(["--city", args.city])
    if portal_arg:
        command.extend(["--portal", portal_arg])
    if args.strict_city:
        command.append("--strict-city")

    result = subprocess.run(command, capture_output=True, text=True)
    if result.stdout:
        print(result.stdout, end="")
    if result.stderr:
        print(result.stderr, end="", file=sys.stderr)
    if result.returncode != 0:
        return result.returncode

    metrics_scope_slug = scope_slug(args.city, portal_arg)
    suffix = "" if metrics_scope_slug == "global" else f"_{metrics_scope_slug}"
    gate_path = Path(args.output_dir) / f"content_health_gate_{args.as_of}{suffix}.json"
    if not gate_path.exists():
        print(f"Launch gate file not found: {gate_path}", file=sys.stderr)
        return 2

    payload = json.loads(gate_path.read_text(encoding="utf-8"))
    overall_status = str(payload.get("overall_status") or "").upper()
    counts = payload.get("counts") or {}
    print(
        "Launch Health Gate: "
        f"{overall_status} "
        f"(PASS={counts.get('PASS', 0)}, WARN={counts.get('WARN', 0)}, FAIL={counts.get('FAIL', 0)})"
    )

    if overall_status == "PASS":
        return 0

    failing_checks = [
        check
        for check in (payload.get("checks") or [])
        if str(check.get("status") or "").upper() in {"WARN", "FAIL"}
    ]
    if failing_checks:
        print("Blocking checks:")
        for check in failing_checks:
            print(f"- [{check.get('status')}] {check.get('id')}: {check.get('value')}")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
