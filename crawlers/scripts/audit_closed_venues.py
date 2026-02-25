#!/usr/bin/env python3
"""
Audit venue/source closure health.

Outputs:
1) Registry drift (confirmed closed venues still active/missing)
2) High-confidence closure candidates (active venues with strong closure language)
3) Active sources pointing at inactive venues by shared slug
"""

from __future__ import annotations

import argparse
import re
import sys
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from db import get_client
from closed_venues import CLOSED_VENUES, CLOSED_VENUE_SLUGS


HARD_CLOSURE_PATTERNS = (
    re.compile(r"\bpermanently closed\b", re.I),
    re.compile(r"\bclosed permanently\b", re.I),
    re.compile(r"\bclosed for good\b", re.I),
    re.compile(r"\bno longer open\b", re.I),
    re.compile(r"\bout of business\b", re.I),
    re.compile(r"\bceased operations?\b", re.I),
    re.compile(r"\bshut\s*down\b", re.I),
    re.compile(r"\b(unfortunately|sadly)\b.*\bwe have closed\b", re.I),
)

SOFT_CLOSURE_PATTERNS = (
    re.compile(r"\btemporarily closed\b", re.I),
    re.compile(r"\blocation closed\b", re.I),
)

NOISE_PATTERNS = (
    re.compile(r"\bclosed (today|until)\b", re.I),
    re.compile(
        r"\b(closed monday|closed tuesday|closed wednesday|closed thursday|closed friday|closed saturday|closed sunday)\b",
        re.I,
    ),
)


@dataclass
class Candidate:
    id: int
    slug: str
    name: str
    active: bool | None
    signal: str
    snippet: str


def _clean_snippet(text: str, limit: int = 160) -> str:
    normalized = " ".join((text or "").strip().split())
    if len(normalized) <= limit:
        return normalized
    return normalized[: limit - 1] + "…"


def _signal_for_description(description: str) -> str | None:
    if not description:
        return None

    for pattern in NOISE_PATTERNS:
        if pattern.search(description):
            return None

    for pattern in HARD_CLOSURE_PATTERNS:
        if pattern.search(description):
            return "hard"

    for pattern in SOFT_CLOSURE_PATTERNS:
        if pattern.search(description):
            return "soft"

    return None


def _safe_best_of_counts(client, venue_ids: list[int]) -> dict[int, int]:
    if not venue_ids:
        return {}
    try:
        rows = (
            client.table("best_of_nominations")
            .select("venue_id", count="exact")
            .in_("venue_id", venue_ids)
            .eq("status", "approved")
            .execute()
        ).data or []
        counts: dict[int, int] = {}
        for row in rows:
            vid = row.get("venue_id")
            if not vid:
                continue
            counts[vid] = counts.get(vid, 0) + 1
        return counts
    except Exception:
        return {}


def run_audit(limit: int) -> dict[str, Any]:
    client = get_client()
    venues = (
        client.table("venues")
        .select("id,name,slug,active,description,is_event_venue")
        .limit(12000)
        .execute()
    ).data or []
    sources = (
        client.table("sources")
        .select("id,name,slug,is_active")
        .limit(5000)
        .execute()
    ).data or []

    venues_by_slug = {(v.get("slug") or ""): v for v in venues}
    sources_by_slug = {(s.get("slug") or ""): s for s in sources}

    registry_drift: list[dict[str, Any]] = []
    for entry in CLOSED_VENUES:
        venue = venues_by_slug.get(entry.slug)
        source = sources_by_slug.get(entry.source_slug or "")
        if not venue:
            registry_drift.append(
                {
                    "slug": entry.slug,
                    "issue": "missing_venue",
                    "source_active": source.get("is_active") if source else None,
                }
            )
            continue
        if venue.get("active") is not False:
            registry_drift.append(
                {
                    "slug": entry.slug,
                    "issue": "venue_active",
                    "venue_id": venue.get("id"),
                    "source_active": source.get("is_active") if source else None,
                }
            )
        if source and source.get("is_active") is True:
            registry_drift.append(
                {
                    "slug": entry.slug,
                    "issue": "source_active",
                    "venue_id": venue.get("id"),
                    "source_id": source.get("id"),
                }
            )

    candidates: list[Candidate] = []
    for venue in venues:
        if venue.get("active") is not True:
            continue
        slug = venue.get("slug") or ""
        if slug in CLOSED_VENUE_SLUGS:
            continue
        desc = venue.get("description") or ""
        signal = _signal_for_description(desc)
        if not signal:
            continue
        candidates.append(
            Candidate(
                id=venue.get("id"),
                slug=slug,
                name=venue.get("name") or "",
                active=venue.get("active"),
                signal=signal,
                snippet=_clean_snippet(desc),
            )
        )

    candidates.sort(key=lambda c: (c.signal != "hard", c.name.lower()))
    candidates = candidates[:limit]

    active_source_for_inactive_venue = []
    for source in sources:
        if source.get("is_active") is not True:
            continue
        venue = venues_by_slug.get(source.get("slug") or "")
        if not venue:
            continue
        if venue.get("active") is False:
            active_source_for_inactive_venue.append(
                {
                    "source_slug": source.get("slug"),
                    "source_id": source.get("id"),
                    "venue_slug": venue.get("slug"),
                    "venue_id": venue.get("id"),
                    "venue_name": venue.get("name"),
                }
            )

    best_of_counts = _safe_best_of_counts(
        client,
        [v.get("id") for v in venues if v.get("active") is False and v.get("id")],
    )

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "venue_count": len(venues),
        "source_count": len(sources),
        "registry_drift": registry_drift,
        "candidates": candidates,
        "active_source_for_inactive_venue": active_source_for_inactive_venue,
        "inactive_venue_best_of_count": sum(best_of_counts.values()),
    }


def render_markdown(report: dict[str, Any]) -> str:
    lines: list[str] = []
    lines.append("# Closed Venues Audit")
    lines.append("")
    lines.append(f"- Generated: {report['generated_at']}")
    lines.append(f"- Venues scanned: {report['venue_count']}")
    lines.append(f"- Sources scanned: {report['source_count']}")
    lines.append(
        f"- Registry drift issues: {len(report['registry_drift'])}"
    )
    lines.append(f"- Closure candidates: {len(report['candidates'])}")
    lines.append(
        f"- Active sources on inactive venues: {len(report['active_source_for_inactive_venue'])}"
    )
    lines.append(
        f"- Approved Best Of nominations tied to inactive venues: {report['inactive_venue_best_of_count']}"
    )
    lines.append("")

    lines.append("## Registry Drift")
    if not report["registry_drift"]:
        lines.append("- None")
    else:
        for row in report["registry_drift"]:
            lines.append(f"- `{row['slug']}`: {row['issue']}")
    lines.append("")

    lines.append("## High-confidence Candidates")
    if not report["candidates"]:
        lines.append("- None")
    else:
        for c in report["candidates"]:
            lines.append(
                f"- `{c.slug}` (id={c.id}, signal={c.signal}): {c.snippet}"
            )
    lines.append("")

    lines.append("## Active Sources For Inactive Venues")
    if not report["active_source_for_inactive_venue"]:
        lines.append("- None")
    else:
        for row in report["active_source_for_inactive_venue"]:
            lines.append(
                f"- source `{row['source_slug']}` (id={row['source_id']}) -> venue `{row['venue_slug']}` (id={row['venue_id']})"
            )

    return "\n".join(lines) + "\n"


def main() -> None:
    parser = argparse.ArgumentParser(description="Audit closed-venue health.")
    parser.add_argument(
        "--limit",
        type=int,
        default=50,
        help="Max closure candidates to print/export (default: 50)",
    )
    parser.add_argument(
        "--export",
        type=str,
        default="",
        help="Optional markdown output path",
    )
    args = parser.parse_args()

    report = run_audit(limit=args.limit)
    markdown = render_markdown(report)
    print(markdown)

    if args.export:
        out = Path(args.export)
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(markdown, encoding="utf-8")
        print(f"Wrote report to {out}")


if __name__ == "__main__":
    main()
