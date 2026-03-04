#!/usr/bin/env python3
"""Festival + tentpole qualification audit.

Produces a single report that combines:
1) Festival-model-fit signals (festival vs event container)
2) Current tentpole event inventory
3) Recommended tentpole add/remove candidates
"""

from __future__ import annotations

import argparse
import json
from collections import defaultdict
from dataclasses import dataclass
from datetime import date
from pathlib import Path
from typing import Any, Callable, Optional

from db import get_client
from festival_audit_metrics import compute_festival_audit_snapshot


@dataclass
class EventScore:
    event: dict[str, Any]
    score: int
    reasons: list[str]
    festival_slug: Optional[str]
    festival_name: Optional[str]
    festival_classification: Optional[str]


def _fetch_rows(
    table: str,
    fields: str,
    *,
    query_builder: Optional[Callable[[Any], Any]] = None,
    order_column: Optional[str] = "id",
    page_size: int = 1000,
) -> list[dict[str, Any]]:
    client = get_client()
    rows: list[dict[str, Any]] = []
    offset = 0

    while True:
        query = client.table(table).select(fields).range(offset, offset + page_size - 1)
        if query_builder:
            query = query_builder(query)
        if order_column:
            query = query.order(order_column)
        result = query.execute()
        batch = result.data or []
        if not batch:
            break
        rows.extend(batch)
        if len(batch) < page_size:
            break
        offset += page_size

    return rows


def _parse_date(value: Any) -> Optional[date]:
    if not value:
        return None
    text = str(value)[:10]
    try:
        return date.fromisoformat(text)
    except Exception:
        return None


def _wordish(text: str) -> list[str]:
    lowered = "".join(ch if ch.isalnum() else " " for ch in text.lower())
    return [w for w in lowered.split() if len(w) >= 4 and w not in {"festival", "atlanta"}]


def _name_matches_title(festival_name: str, event_title: str) -> bool:
    if not festival_name or not event_title:
        return False
    festival_tokens = _wordish(festival_name)
    event_tokens = set(_wordish(event_title))
    if not festival_tokens or not event_tokens:
        return False
    overlap = sum(1 for token in festival_tokens if token in event_tokens)
    return overlap >= 1


def _score_event(
    event: dict[str, Any],
    festival: Optional[dict[str, Any]],
    model_fit_by_festival: dict[str, dict[str, Any]],
    today: date,
) -> EventScore:
    reasons: list[str] = []
    score = 0

    festival_id = event.get("festival_id")
    model = model_fit_by_festival.get(festival_id, {})
    classification = model.get("classification")

    start = _parse_date(event.get("start_date"))
    end = _parse_date(event.get("end_date")) or start
    duration_days = (end - start).days if start and end else 0

    if festival_id and event.get("series_id") is None:
        score += 50
        reasons.append("festival_parent_event")
    elif event.get("series_id") is None:
        score += 10
        reasons.append("standalone_event")

    if duration_days >= 2:
        score += 15
        reasons.append("multi_day_event")
    elif duration_days == 1:
        score += 5
        reasons.append("two_day_span")

    if classification == "festival_fit":
        score += 15
        reasons.append("festival_structural_fit")
    elif classification == "tentpole_fit_candidate":
        score += 25
        reasons.append("festival_should_demote_to_event")
    elif classification == "ambiguous":
        score += 5
        reasons.append("festival_ambiguous")
    elif classification == "insufficient_data":
        score -= 20
        reasons.append("festival_insufficient_data")

    festival_name = festival.get("name") if festival else None
    if festival_name and _name_matches_title(festival_name, event.get("title") or ""):
        score += 10
        reasons.append("title_matches_festival")

    description = (event.get("description") or "").strip()
    if len(description) >= 120:
        score += 5
        reasons.append("rich_description")

    if start and start >= today:
        score += 5
        reasons.append("upcoming")

    return EventScore(
        event=event,
        score=score,
        reasons=reasons,
        festival_slug=festival.get("slug") if festival else None,
        festival_name=festival_name,
        festival_classification=classification,
    )


def _is_current_event(event: dict[str, Any], today: date) -> bool:
    if event.get("is_active") is False:
        return False

    start = _parse_date(event.get("start_date"))
    end = _parse_date(event.get("end_date")) or start
    if start is None and end is None:
        return True
    if end and end >= today:
        return True
    if start and start >= today:
        return True
    return False


def build_audit() -> dict[str, Any]:
    snapshot = compute_festival_audit_snapshot()
    today = date.today()

    festivals = _fetch_rows("festivals", "id,slug,name")
    festival_by_id = {row["id"]: row for row in festivals}
    # Keep model-fit decisions constrained to currently materialized festival rows.
    # The upstream snapshot can temporarily contain stale ids after slug merges.
    model_fit_by_festival = {
        festival_id: model
        for festival_id, model in (snapshot["model_fit"]["by_festival"] or {}).items()
        if festival_id in festival_by_id
    }

    festival_events = _fetch_rows(
        "events",
        "id,title,start_date,end_date,festival_id,series_id,is_tentpole,source_id,venue_id,description,is_active",
        query_builder=lambda q: q.not_.is_("festival_id", "null"),
    )
    unlinked_tentpoles = _fetch_rows(
        "events",
        "id,title,start_date,end_date,festival_id,series_id,is_tentpole,source_id,venue_id,description,is_active",
        query_builder=lambda q: q.eq("is_tentpole", True).is_("festival_id", "null"),
    )

    all_events_by_id: dict[Any, dict[str, Any]] = {}
    for event in festival_events + unlinked_tentpoles:
        all_events_by_id[event.get("id")] = event
    events = list(all_events_by_id.values())

    scored: list[EventScore] = []
    for event in events:
        festival = festival_by_id.get(event.get("festival_id")) if event.get("festival_id") else None
        scored.append(_score_event(event, festival, model_fit_by_festival, today))

    events_by_festival: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in scored:
        festival_id = row.event.get("festival_id")
        if festival_id:
            events_by_festival[festival_id].append(row.event)

    recommended_add = [
        row
        for row in scored
        if not row.event.get("is_tentpole")
        and row.score >= 70
        and _is_current_event(row.event, today)
    ]
    all_tentpoles = [row for row in scored if row.event.get("is_tentpole")]
    current_tentpoles = [row for row in all_tentpoles if _is_current_event(row.event, today)]
    stale_tentpoles = [row for row in all_tentpoles if not _is_current_event(row.event, today)]

    # Guardrail: do not recommend removing the only tentpole coverage event for
    # a structurally valid or ambiguous festival row.
    tentpole_count_by_festival: dict[str, int] = defaultdict(int)
    for row in all_tentpoles:
        festival_id = row.event.get("festival_id")
        if festival_id:
            tentpole_count_by_festival[festival_id] += 1

    recommended_remove: list[EventScore] = []
    for row in stale_tentpoles:
        if row.score >= 45:
            continue
        festival_id = row.event.get("festival_id")
        if festival_id:
            classification = model_fit_by_festival.get(festival_id, {}).get("classification")
            if classification in {"festival_fit", "ambiguous"} and tentpole_count_by_festival.get(festival_id, 0) <= 1:
                continue
        recommended_remove.append(row)

    festival_fit_missing_tentpole: list[dict[str, Any]] = []
    current_tentpole_festival_ids = {
        row.event.get("festival_id")
        for row in current_tentpoles
        if row.event.get("festival_id")
    }
    for festival_id, model in model_fit_by_festival.items():
        if model.get("classification") not in {"festival_fit", "ambiguous"}:
            continue
        festival_events_for_id = [
            event
            for event in events_by_festival.get(festival_id, [])
            if _is_current_event(event, today)
        ]
        if not festival_events_for_id:
            continue
        if festival_id in current_tentpole_festival_ids:
            continue
        festival = festival_by_id.get(festival_id, {})
        festival_fit_missing_tentpole.append(
            {
                "festival_id": festival_id,
                "festival_slug": festival.get("slug"),
                "festival_name": festival.get("name"),
                "classification": model.get("classification"),
                "event_count": len(festival_events_for_id),
                "active_program_series_count": model.get("active_program_series_count"),
            }
        )

    festival_demote_candidates = sorted(
        [
            {
                "festival_id": festival_id,
                "festival_slug": model.get("slug"),
                "festival_name": (festival_by_id.get(festival_id) or {}).get("name"),
                "event_count": model.get("event_count"),
                "program_series_count": model.get("program_series_count"),
                "active_program_series_count": model.get("active_program_series_count"),
                "unique_venue_count": model.get("unique_venue_count"),
                "simple_reasons": model.get("simple_reasons") or [],
            }
            for festival_id, model in model_fit_by_festival.items()
            if model.get("classification") == "tentpole_fit_candidate"
        ],
        key=lambda row: (-int(row.get("event_count") or 0), row.get("festival_slug") or ""),
    )

    festival_model_decisions: list[dict[str, Any]] = []
    for festival_id, model in model_fit_by_festival.items():
        classification = model.get("classification")
        if classification == "festival_fit":
            proposed_model = "festival_container"
        elif classification == "tentpole_fit_candidate":
            proposed_model = "tentpole_event"
        else:
            proposed_model = "manual_review"

        festival = festival_by_id.get(festival_id, {})
        festival_model_decisions.append(
            {
                "festival_id": festival_id,
                "festival_slug": model.get("slug"),
                "festival_name": festival.get("name"),
                "classification": classification,
                "proposed_model": proposed_model,
                "recommended_action": model.get("recommended_action"),
                "event_count": model.get("event_count"),
                "program_series_count": model.get("program_series_count"),
                "active_program_series_count": model.get("active_program_series_count"),
                "unique_venue_count": model.get("unique_venue_count"),
                "complex_reasons": model.get("complex_reasons") or [],
                "simple_reasons": model.get("simple_reasons") or [],
            }
        )

    festival_model_decisions.sort(
        key=lambda row: (
            row.get("proposed_model") != "tentpole_event",
            row.get("proposed_model") != "manual_review",
            -int(row.get("event_count") or 0),
            row.get("festival_slug") or "",
        )
    )

    keep_festival_count = sum(
        1 for row in festival_model_decisions if row.get("proposed_model") == "festival_container"
    )
    demote_to_event_count = sum(
        1 for row in festival_model_decisions if row.get("proposed_model") == "tentpole_event"
    )
    manual_review_count = sum(
        1 for row in festival_model_decisions if row.get("proposed_model") == "manual_review"
    )

    def serialize_score(row: EventScore) -> dict[str, Any]:
        return {
            "event_id": row.event.get("id"),
            "title": row.event.get("title"),
            "start_date": row.event.get("start_date"),
            "end_date": row.event.get("end_date"),
            "festival_id": row.event.get("festival_id"),
            "festival_slug": row.festival_slug,
            "festival_name": row.festival_name,
            "festival_classification": row.festival_classification,
            "is_tentpole": bool(row.event.get("is_tentpole")),
            "series_id": row.event.get("series_id"),
            "score": row.score,
            "reasons": row.reasons,
        }

    payload = {
        "snapshot_date": today.isoformat(),
        "summary": {
            "festival_count": len(festival_by_id),
            "festival_linked_event_count": snapshot["counts"]["festival_linked_events"],
            "current_tentpole_event_count": len(current_tentpoles),
            "stale_tentpole_event_count": len(stale_tentpoles),
            "recommended_tentpole_add_count": len(recommended_add),
            "recommended_tentpole_remove_count": len(recommended_remove),
            "festival_fit_missing_tentpole_count": len(festival_fit_missing_tentpole),
            "festival_demote_to_event_count": len(festival_demote_candidates),
            "festival_model_decision_keep_count": keep_festival_count,
            "festival_model_decision_demote_count": demote_to_event_count,
            "festival_model_decision_review_count": manual_review_count,
        },
        "festival_model_decisions": festival_model_decisions,
        "festival_demote_candidates": festival_demote_candidates[:100],
        "festival_fit_missing_tentpole": festival_fit_missing_tentpole[:100],
        "recommended_tentpole_add": [serialize_score(row) for row in sorted(recommended_add, key=lambda x: -x.score)[:120]],
        "recommended_tentpole_remove": [serialize_score(row) for row in sorted(recommended_remove, key=lambda x: x.score)[:120]],
        "current_tentpole_inventory": [serialize_score(row) for row in sorted(current_tentpoles, key=lambda x: -x.score)],
        "stale_tentpole_inventory": [serialize_score(row) for row in sorted(stale_tentpoles, key=lambda x: x.score)],
    }
    return payload


def _to_markdown(payload: dict[str, Any]) -> str:
    summary = payload["summary"]

    lines = [
        f"# Festival + Tentpole Qualification Audit ({payload['snapshot_date']})",
        "",
        "## Summary",
        f"- Festivals: **{summary['festival_count']}**",
        f"- Festival-linked events: **{summary['festival_linked_event_count']}**",
        f"- Current tentpole events: **{summary['current_tentpole_event_count']}**",
        f"- Stale tentpole events: **{summary['stale_tentpole_event_count']}**",
        f"- Recommended tentpole adds: **{summary['recommended_tentpole_add_count']}**",
        f"- Recommended tentpole removals: **{summary['recommended_tentpole_remove_count']}**",
        f"- Festival-fit rows missing any current tentpole event: **{summary['festival_fit_missing_tentpole_count']}**",
        f"- Festival rows that should demote to event model: **{summary['festival_demote_to_event_count']}**",
        f"- Festival model decisions: keep={summary['festival_model_decision_keep_count']}, "
        f"demote={summary['festival_model_decision_demote_count']}, "
        f"review={summary['festival_model_decision_review_count']}",
        "",
        "## Festival/Event Model Decisions",
    ]

    for row in payload["festival_model_decisions"][:30]:
        lines.append(
            f"- `{row['festival_slug']}` -> **{row['proposed_model']}** "
            f"(class={row.get('classification')}, events={row.get('event_count')}, "
            f"program_series={row.get('program_series_count')}, "
            f"reasons={','.join(row.get('simple_reasons') or [])})"
        )

    lines.extend(
        [
            "",
        "## Top Tentpole Adds",
        ]
    )

    for row in payload["recommended_tentpole_add"][:20]:
        lines.append(
            f"- `{row['event_id']}` {row['title']} "
            f"(festival={row.get('festival_slug')}, score={row['score']}, reasons={','.join(row['reasons'])})"
        )

    lines.append("")
    lines.append("## Questionable Current Tentpoles")
    for row in payload["recommended_tentpole_remove"][:20]:
        lines.append(
            f"- `{row['event_id']}` {row['title']} "
            f"(festival={row.get('festival_slug')}, score={row['score']}, reasons={','.join(row['reasons'])})"
        )

    lines.append("")
    lines.append("## Festival Demote Candidates")
    for row in payload["festival_demote_candidates"][:25]:
        lines.append(
            f"- `{row['festival_slug']}` events={row['event_count']} program_series={row['program_series_count']} "
            f"venues={row['unique_venue_count']} reasons={','.join(row['simple_reasons'])}"
        )

    lines.append("")
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description="Festival + tentpole qualification audit")
    parser.add_argument("--json-out", help="Write JSON report to file")
    parser.add_argument("--md-out", help="Write markdown summary to file")
    args = parser.parse_args()

    payload = build_audit()

    if args.json_out:
        path = Path(args.json_out)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(payload, indent=2) + "\n")
        print(f"Wrote: {path}")

    if args.md_out:
        path = Path(args.md_out)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(_to_markdown(payload) + "\n")
        print(f"Wrote: {path}")

    if not args.json_out and not args.md_out:
        print(json.dumps(payload, indent=2))

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
