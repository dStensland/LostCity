#!/usr/bin/env python3
"""
Mark cross-source duplicate events as non-canonical for feed suppression.

Rule: same venue_id + start_date + start_time + normalized title, but from different sources.
Keeps one canonical row visible (canonical_event_id IS NULL), marks others with canonical_event_id.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import time
from collections import defaultdict
from datetime import date
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from db import get_client, get_source_info


AGGREGATOR_SOURCE_PREFIXES = ("ticketmaster", "eventbrite", "mobilize")
AGGREGATOR_SOURCE_SLUGS = {
    "atlanta-recurring-social",
    "instagram-captions",
    "creative-loafing",
}


def is_transient_error(exc: Exception) -> bool:
    text = str(exc).lower()
    transient_markers = (
        "timeout",
        "timed out",
        "connection reset",
        "connectionterminated",
        "protocol_error",
        "compression_error",
        "resource temporarily unavailable",
    )
    return any(marker in text for marker in transient_markers)


def execute_with_retry(
    operation_name: str,
    fn,
    *,
    max_retries: int,
    retry_base_seconds: float,
):
    attempt = 0
    while True:
        attempt += 1
        try:
            return fn()
        except Exception as exc:  # noqa: BLE001 - retry wrapper for crawler maintenance
            if attempt > max_retries or not is_transient_error(exc):
                raise
            wait_seconds = retry_base_seconds * (2 ** (attempt - 1))
            print(
                f"[retry] {operation_name} attempt {attempt}/{max_retries} failed: {exc}; "
                f"sleeping {wait_seconds:.1f}s"
            )
            time.sleep(wait_seconds)


def normalize_title(value: str | None) -> str:
    text = (value or "").lower().strip()
    text = re.sub(r"\s+", " ", text)
    text = re.sub(r"^(the|a|an)\s+", "", text)
    text = re.sub(r"[^\w\s]", "", text)
    return text.strip()


def normalize_start_time(value: str | None) -> str:
    text = (value or "").strip()
    if not text:
        return "__none__"
    if text in {"00:00", "00:00:00"}:
        return "__none__"
    return text


def source_priority(slug: str | None, is_active: bool | None = None) -> int:
    s = (slug or "").strip().lower()
    inactive_penalty = 500 if is_active is False else 0
    if not s:
        return 200 + inactive_penalty
    if s.endswith("-test"):
        return 300 + inactive_penalty
    if s in AGGREGATOR_SOURCE_SLUGS:
        return 230 + inactive_penalty
    if s.startswith(AGGREGATOR_SOURCE_PREFIXES):
        return 220 + inactive_penalty
    return 100 + inactive_penalty


def quality_key(row: dict) -> tuple[int, int, int]:
    desc_len = len((row.get("description") or "").strip())
    has_image = 1 if row.get("image_url") else 0
    has_ticket = 1 if row.get("ticket_url") else 0
    return (desc_len, has_image, has_ticket)


def _write_checkpoint(checkpoint_file: Path | None, payload: dict[str, Any]) -> None:
    if not checkpoint_file:
        return
    checkpoint_file.parent.mkdir(parents=True, exist_ok=True)
    checkpoint_file.write_text(json.dumps(payload, indent=2))


def _load_resume_cursor(checkpoint_file: Path | None, default_cursor: int) -> int:
    cursor = default_cursor
    if not checkpoint_file or not checkpoint_file.exists():
        return cursor
    try:
        payload = json.loads(checkpoint_file.read_text())
        checkpoint_cursor = int(payload.get("last_seen_id") or 0)
        if checkpoint_cursor > cursor:
            cursor = checkpoint_cursor
    except Exception:
        return cursor
    return cursor


def fetch_events(
    *,
    start_date: str | None,
    page_size: int,
    max_retries: int,
    retry_base_seconds: float,
    resume_after_id: int = 0,
    checkpoint_file: Path | None = None,
) -> list[dict]:
    client = get_client()
    rows: list[dict] = []
    cursor = _load_resume_cursor(checkpoint_file, resume_after_id)
    while True:
        query = client.table("events").select(
            "id,source_id,place_id,title,start_date,start_time,description,image_url,ticket_url,created_at,canonical_event_id"
        )
        if start_date:
            query = query.gte("start_date", start_date)
        if cursor > 0:
            query = query.gt("id", cursor)
        # Keyset paging is resilient to concurrent writes and supports resume from id.
        operation_name = f"fetch batch id>{cursor}"
        batch = execute_with_retry(
            operation_name,
            lambda: query.order("id").range(0, page_size - 1).execute().data or [],
            max_retries=max_retries,
            retry_base_seconds=retry_base_seconds,
        )
        if not batch:
            break
        rows.extend(batch)
        cursor = int(batch[-1]["id"])
        _write_checkpoint(
            checkpoint_file,
            {
                "last_seen_id": cursor,
                "rows_loaded": len(rows),
                "start_date": start_date,
                "updated_at": time.time(),
            },
        )
        if len(batch) < page_size:
            break
    unique_by_id = {row["id"]: row for row in rows if row.get("id")}
    return list(unique_by_id.values())


def main() -> None:
    parser = argparse.ArgumentParser(description="Canonicalize cross-source duplicate events")
    parser.add_argument("--start-date", default=date.today().isoformat(), help="Lower bound start_date (YYYY-MM-DD)")
    parser.add_argument("--dry-run", action="store_true", help="Do not write updates")
    parser.add_argument("--limit-groups", type=int, default=0, help="Only process first N groups for testing")
    parser.add_argument("--page-size", type=int, default=400, help="Batch size for source event fetch.")
    parser.add_argument("--resume-after-id", type=int, default=0, help="Resume event scan after this id.")
    parser.add_argument(
        "--checkpoint-file",
        default=None,
        help="Optional checkpoint path for resumable fetch progress.",
    )
    parser.add_argument("--max-retries", type=int, default=4, help="Retries for transient read/write failures.")
    parser.add_argument("--retry-base-seconds", type=float, default=1.5, help="Base backoff seconds.")
    args = parser.parse_args()

    client = get_client()
    checkpoint_file = Path(args.checkpoint_file) if args.checkpoint_file else None
    events = fetch_events(
        start_date=args.start_date,
        page_size=max(1, int(args.page_size)),
        resume_after_id=max(0, int(args.resume_after_id)),
        checkpoint_file=checkpoint_file,
        max_retries=max(0, int(args.max_retries)),
        retry_base_seconds=max(0.1, float(args.retry_base_seconds)),
    )
    print(f"Loaded {len(events)} events (start_date >= {args.start_date})")

    groups: dict[tuple, list[dict]] = defaultdict(list)
    for row in events:
        if not row.get("source_id") or not row.get("place_id") or not row.get("title"):
            continue
        key = (
            row.get("place_id"),
            row.get("start_date"),
            normalize_start_time(row.get("start_time")),
            normalize_title(row.get("title")),
        )
        groups[key].append(row)

    dup_groups: list[list[dict]] = []
    for rows in groups.values():
        source_ids = {r.get("source_id") for r in rows if r.get("source_id")}
        if len(source_ids) > 1 and len(rows) > 1:
            dup_groups.append(rows)

    dup_groups.sort(key=lambda g: (g[0].get("start_date") or "", g[0].get("start_time") or ""))
    if args.limit_groups > 0:
        dup_groups = dup_groups[: args.limit_groups]

    print(f"Found {len(dup_groups)} cross-source duplicate groups")

    updates = 0
    canonical_resets = 0
    touched_groups = 0
    source_cache: dict[int, dict[str, Any]] = {}

    for rows in dup_groups:
        def sort_key(row: dict):
            source_id = int(row.get("source_id") or 0)
            if source_id not in source_cache:
                source_cache[source_id] = get_source_info(source_id) or {}
            src = source_cache[source_id]
            pri = source_priority(src.get("slug"), src.get("is_active"))
            q = quality_key(row)
            created = row.get("created_at") or ""
            return (pri, -q[0], -q[1], -q[2], created, row.get("id"))

        ordered = sorted(rows, key=sort_key)
        canonical = ordered[0]
        canonical_id = canonical["id"]

        group_touched = False
        if canonical.get("canonical_event_id") is not None:
            canonical_resets += 1
            group_touched = True
            if not args.dry_run:
                execute_with_retry(
                    f"reset canonical_event_id for {canonical_id}",
                    lambda: client.table("events")
                    .update({"canonical_event_id": None})
                    .eq("id", canonical_id)
                    .execute(),
                    max_retries=max(0, int(args.max_retries)),
                    retry_base_seconds=max(0.1, float(args.retry_base_seconds)),
                )

        for row in ordered[1:]:
            if row.get("canonical_event_id") == canonical_id:
                continue
            group_touched = True
            updates += 1
            if not args.dry_run:
                row_id = int(row["id"])
                execute_with_retry(
                    f"mark row {row_id} canonical_event_id={canonical_id}",
                    lambda: client.table("events")
                    .update({"canonical_event_id": canonical_id})
                    .eq("id", row_id)
                    .execute(),
                    max_retries=max(0, int(args.max_retries)),
                    retry_base_seconds=max(0.1, float(args.retry_base_seconds)),
                )

        if group_touched:
            touched_groups += 1

    print(f"Groups touched: {touched_groups}")
    print(f"Rows marked non-canonical: {updates}")
    print(f"Canonical rows reset to visible: {canonical_resets}")
    print(f"Dry run: {args.dry_run}")


if __name__ == "__main__":
    main()
