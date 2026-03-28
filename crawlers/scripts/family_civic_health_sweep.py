#!/usr/bin/env python3
"""
Grouped health sweep for Hooky's civic/public family-program sources.

Produces:
1) JSON metrics for the tracked civic-family source pack.
2) Markdown summary for planning docs and scorecard refreshes.

Run:
  cd /Users/coach/Projects/LostCity/crawlers
  ./venv/bin/python scripts/family_civic_health_sweep.py
"""

from __future__ import annotations

import json
import sys
from collections import Counter
from dataclasses import dataclass
from datetime import date
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from db import get_client

REPORT_SLUGS = [
    "chamblee-parks-rec",
    "milton-parks-rec",
    "gwinnett-family-programs",
    "cobb-family-programs",
    "atlanta-family-programs",
    "dekalb-family-programs",
]


@dataclass
class SourceSweep:
    slug: str
    name: str
    source_id: int
    future_rows: int
    venues: int
    age_coverage_pct: float
    price_coverage_pct: float
    ticket_coverage_pct: float
    tag_markers: list[tuple[str, int]]


def pct(numerator: int, denominator: int) -> float:
    if denominator == 0:
        return 0.0
    return round((numerator / denominator) * 100, 1)


def fetch_sources(client, slugs: list[str]) -> list[dict[str, Any]]:
    response = (
        client.table("sources")
        .select("id,slug,name")
        .in_("slug", slugs)
        .order("slug")
        .execute()
    )
    rows = response.data or []
    by_slug = {row["slug"]: row for row in rows}
    return [by_slug[slug] for slug in slugs if slug in by_slug]


def fetch_future_events(client, source_id: int, today_iso: str) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    offset = 0
    page_size = 1000
    while True:
        response = (
            client.table("events")
            .select(
                "source_id,start_date,end_date,age_min,age_max,price_min,price_max,is_free,"
                "ticket_url,place_id,tags,is_active"
            )
            .eq("source_id", source_id)
            .eq("is_active", True)
            .gte("start_date", today_iso)
            .order("start_date")
            .range(offset, offset + page_size - 1)
            .execute()
        )
        batch = response.data or []
        rows.extend(batch)
        if len(batch) < page_size:
            break
        offset += page_size
    return rows


def score_source(source_row: dict[str, Any], event_rows: list[dict[str, Any]]) -> SourceSweep:
    future_rows = len(event_rows)
    venue_ids = {row.get("place_id") for row in event_rows if row.get("place_id") is not None}
    age_rows = [
        row for row in event_rows if row.get("age_min") is not None or row.get("age_max") is not None
    ]
    price_rows = [
        row
        for row in event_rows
        if row.get("price_min") is not None or row.get("price_max") is not None or row.get("is_free") is True
    ]
    ticket_rows = [row for row in event_rows if row.get("ticket_url")]
    tag_counts: Counter[str] = Counter()
    for row in event_rows:
        for tag in row.get("tags") or []:
            if tag in {"kids", "preschool", "teen", "tween", "family-friendly", "outdoor", "water-sports"}:
                tag_counts[str(tag)] += 1
    top_tags = tag_counts.most_common(4)

    return SourceSweep(
        slug=source_row["slug"],
        name=source_row["name"],
        source_id=source_row["id"],
        future_rows=future_rows,
        venues=len(venue_ids),
        age_coverage_pct=pct(len(age_rows), future_rows),
        price_coverage_pct=pct(len(price_rows), future_rows),
        ticket_coverage_pct=pct(len(ticket_rows), future_rows),
        tag_markers=top_tags,
    )


def lane_summary(scores: list[SourceSweep]) -> dict[str, float]:
    if not scores:
        return {
            "future_rows": 0.0,
            "venues": 0.0,
            "age_coverage_pct": 0.0,
            "price_coverage_pct": 0.0,
            "ticket_coverage_pct": 0.0,
        }
    return {
        "future_rows": float(sum(score.future_rows for score in scores)),
        "venues": float(sum(score.venues for score in scores)),
        "age_coverage_pct": round(
            sum(score.age_coverage_pct for score in scores) / len(scores), 1
        ),
        "price_coverage_pct": round(
            sum(score.price_coverage_pct for score in scores) / len(scores), 1
        ),
        "ticket_coverage_pct": round(
            sum(score.ticket_coverage_pct for score in scores) / len(scores), 1
        ),
    }


def render_markdown(scores: list[SourceSweep], summary: dict[str, float], generated_on: str) -> str:
    lines = [
        "# Hooky Civic Family Health Sweep",
        "",
        f"- Generated: {generated_on}",
        f"- Sources in sweep: {len(scores)}",
        f"- Total future rows: {int(summary['future_rows'])}",
        f"- Aggregate venue count (sum of per-source distinct venues): {int(summary['venues'])}",
        f"- Mean age coverage: {summary['age_coverage_pct']}%",
        f"- Mean price coverage: {summary['price_coverage_pct']}%",
        f"- Mean ticket coverage: {summary['ticket_coverage_pct']}%",
        "",
        "| Source | Future Rows | Venues | Age % | Price % | Ticket % | Top Markers |",
        "|---|---:|---:|---:|---:|---:|---|",
    ]
    for score in scores:
        top_markers = ", ".join(f"{name} ({count})" for name, count in score.tag_markers) or "n/a"
        lines.append(
            f"| `{score.slug}` | {score.future_rows} | {score.venues} | "
            f"{score.age_coverage_pct}% | {score.price_coverage_pct}% | {score.ticket_coverage_pct}% | "
            f"{top_markers} |"
        )

    lines.extend(
        [
            "",
            "## Read",
            "",
            "- Strong civic health should mean both breadth and planning trust, not raw row volume alone.",
            "- `future_rows` shows whether the source contributes real weekly utility.",
            "- `age_coverage_pct` and `price_coverage_pct` show whether the lane is compare-ready enough for Hooky.",
            "- `ticket_coverage_pct` is a trust proxy: public sources should reliably point families to an official destination.",
        ]
    )
    return "\n".join(lines) + "\n"


def main() -> int:
    client = get_client()
    today_iso = date.today().isoformat()
    generated_on = date.today().isoformat()

    source_rows = fetch_sources(client, REPORT_SLUGS)
    scores: list[SourceSweep] = []
    for source_row in source_rows:
        event_rows = fetch_future_events(client, source_row["id"], today_iso)
        scores.append(score_source(source_row, event_rows))

    summary = lane_summary(scores)

    reports_dir = ROOT / "reports"
    reports_dir.mkdir(parents=True, exist_ok=True)
    json_path = reports_dir / f"family_civic_health_sweep_{generated_on}.json"
    md_path = reports_dir / f"family_civic_health_sweep_{generated_on}.md"

    json_payload = {
        "generated_on": generated_on,
        "sources": [score.__dict__ for score in scores],
        "summary": summary,
    }
    json_path.write_text(json.dumps(json_payload, indent=2) + "\n")
    md_path.write_text(render_markdown(scores, summary, generated_on))

    print(json.dumps({"json": str(json_path), "markdown": str(md_path), "summary": summary}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
