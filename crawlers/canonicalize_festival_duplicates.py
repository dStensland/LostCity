#!/usr/bin/env python3
"""Canonicalize duplicate festival rows.

Merges known duplicate festival IDs into canonical IDs by:
1) Backfilling canonical metadata from duplicate rows (missing-only)
2) Repointing festival_id references in dependent tables
3) Deleting duplicate rows

Usage:
  python3 canonicalize_festival_duplicates.py --dry-run
  python3 canonicalize_festival_duplicates.py --apply
"""

from __future__ import annotations

import argparse
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Optional

from db import get_client


@dataclass(frozen=True)
class MergePlan:
    canonical_id: str
    duplicate_id: str


MERGE_PLANS: tuple[MergePlan, ...] = (
    MergePlan(canonical_id="shaky-knees", duplicate_id="shaky-knees-festival"),
    MergePlan(canonical_id="atlanta-pride", duplicate_id="atl-pride"),
    MergePlan(canonical_id="snellville-days", duplicate_id="snellville-days-festival"),
    MergePlan(canonical_id="render-atl", duplicate_id="renderatl"),
)

DEPENDENCY_TABLES: tuple[str, ...] = (
    "series",
    "events",
    "event_calendar_saves",
)

MERGEABLE_FIELDS: tuple[str, ...] = (
    "name",
    "description",
    "website",
    "image_url",
    "ticket_url",
    "location",
    "neighborhood",
    "festival_type",
    "primary_type",
    "typical_month",
    "typical_duration_days",
    "announced_start",
    "announced_end",
    "pending_start",
    "pending_end",
    "date_source",
    "date_confidence",
    "categories",
    "free",
)


def _is_empty(value: Any) -> bool:
    if value is None:
        return True
    if isinstance(value, str):
        return value.strip() == ""
    if isinstance(value, list):
        return len(value) == 0
    return False


def _count_rows(table: str, festival_id: str) -> Optional[int]:
    client = get_client()
    try:
        rows = (
            client.table(table)
            .select("id")
            .eq("festival_id", festival_id)
            .limit(10000)
            .execute()
            .data
            or []
        )
        return len(rows)
    except Exception:
        return None


def _build_metadata_patch(canonical: dict[str, Any], duplicate: dict[str, Any]) -> dict[str, Any]:
    updates: dict[str, Any] = {}

    for field in MERGEABLE_FIELDS:
        current = canonical.get(field)
        candidate = duplicate.get(field)
        if _is_empty(current) and not _is_empty(candidate):
            updates[field] = candidate

    # Prefer higher confidence date metadata when canonical is weaker/missing.
    canonical_conf = canonical.get("date_confidence") or 0
    duplicate_conf = duplicate.get("date_confidence") or 0
    if duplicate_conf > canonical_conf:
        if duplicate.get("date_confidence") is not None:
            updates["date_confidence"] = duplicate["date_confidence"]
        if not _is_empty(duplicate.get("date_source")):
            updates["date_source"] = duplicate["date_source"]

    return updates


def run(*, apply: bool, report_path: Optional[Path]) -> dict[str, Any]:
    client = get_client()
    report: dict[str, Any] = {
        "mode": "apply" if apply else "dry-run",
        "plans": [],
    }

    for plan in MERGE_PLANS:
        canonical_rows = (
            client.table("festivals")
            .select("*")
            .eq("id", plan.canonical_id)
            .limit(1)
            .execute()
            .data
            or []
        )
        duplicate_rows = (
            client.table("festivals")
            .select("*")
            .eq("id", plan.duplicate_id)
            .limit(1)
            .execute()
            .data
            or []
        )

        item: dict[str, Any] = {
            "canonical_id": plan.canonical_id,
            "duplicate_id": plan.duplicate_id,
            "status": "pending",
            "metadata_updates": {},
            "reference_counts_before": {},
            "reference_counts_after": {},
            "deleted_duplicate": False,
            "notes": [],
        }

        if not canonical_rows:
            item["status"] = "skipped"
            item["notes"].append("canonical_not_found")
            report["plans"].append(item)
            continue
        if not duplicate_rows:
            item["status"] = "skipped"
            item["notes"].append("duplicate_not_found")
            report["plans"].append(item)
            continue

        canonical = canonical_rows[0]
        duplicate = duplicate_rows[0]

        metadata_updates = _build_metadata_patch(canonical, duplicate)
        item["metadata_updates"] = metadata_updates

        for table in DEPENDENCY_TABLES:
            item["reference_counts_before"][table] = _count_rows(table, plan.duplicate_id)

        if apply:
            if metadata_updates:
                client.table("festivals").update(metadata_updates).eq("id", plan.canonical_id).execute()

            for table in DEPENDENCY_TABLES:
                try:
                    (
                        client.table(table)
                        .update({"festival_id": plan.canonical_id})
                        .eq("festival_id", plan.duplicate_id)
                        .execute()
                    )
                except Exception as exc:
                    item["notes"].append(f"update_failed:{table}:{exc}")

            for table in DEPENDENCY_TABLES:
                item["reference_counts_after"][table] = _count_rows(table, plan.duplicate_id)

            try:
                client.table("festivals").delete().eq("id", plan.duplicate_id).execute()
                item["deleted_duplicate"] = True
                item["status"] = "applied"
            except Exception as exc:
                item["status"] = "error"
                item["notes"].append(f"delete_failed:{exc}")
        else:
            item["status"] = "dry-run"

        report["plans"].append(item)

    if report_path:
        report_path.parent.mkdir(parents=True, exist_ok=True)
        report_path.write_text(json.dumps(report, indent=2) + "\n")

    return report


def _print_report(report: dict[str, Any]) -> None:
    print(f"Mode: {report['mode']}")
    for item in report["plans"]:
        print("\n" + "-" * 80)
        print(f"{item['duplicate_id']} -> {item['canonical_id']} [{item['status']}]")
        if item["metadata_updates"]:
            print(f"metadata updates: {sorted(item['metadata_updates'].keys())}")
        else:
            print("metadata updates: none")
        if item["reference_counts_before"]:
            print(f"refs before: {item['reference_counts_before']}")
        if item["reference_counts_after"]:
            print(f"refs after: {item['reference_counts_after']}")
        print(f"deleted duplicate: {item['deleted_duplicate']}")
        if item["notes"]:
            print(f"notes: {item['notes']}")


def main() -> int:
    parser = argparse.ArgumentParser(description="Canonicalize duplicate festivals")
    parser.add_argument("--apply", action="store_true", help="Apply merge operations")
    parser.add_argument("--dry-run", action="store_true", help="Preview only (default)")
    parser.add_argument("--report-out", type=str, help="Write JSON report to path")
    args = parser.parse_args()

    apply = bool(args.apply)
    if args.dry_run:
        apply = False

    report_path = Path(args.report_out) if args.report_out else None
    report = run(apply=apply, report_path=report_path)
    _print_report(report)
    if report_path:
        print(f"\nWrote: {report_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

