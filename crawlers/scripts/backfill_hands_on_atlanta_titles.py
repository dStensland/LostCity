"""
Backfill Hands On Atlanta event titles from current opportunity detail.

Why this exists:
Some HOA opportunities publish `name="Volunteer"`, which produces useless event
titles like "Volunteer: Volunteer" in HelpATL. Other rows have legacy whitespace
artifacts like trailing spaces. The crawler now fixes this upstream, but
existing rows need a one-time repair.

Scope:
- source_id=13 (Hands On Atlanta)
- future events only
- generic placeholder titles or whitespace-dirty titles
- updates `events.title`, `events.content_hash`, and related `series` titles/slugs
"""

from __future__ import annotations

import re
from collections import defaultdict
from datetime import datetime, timedelta

from db import get_client
from dedupe import generate_content_hash
from sources.hands_on_atlanta import (
    _build_event_title,
    _fetch_opportunity_detail,
    _is_generic_opportunity_title,
)
from utils import slugify

HOA_SOURCE_ID = 13
GENERIC_TITLE_SQL_PATTERNS = [
    "volunteer",
    "volunteer: volunteer",
    "volunteer opportunity",
    "opportunity",
    "volunteer shift",
    "shift",
]


def _extract_opportunity_id(source_url: str | None) -> str | None:
    if not source_url:
        return None
    match = re.search(r"/opportunities/([^/?#]+)", source_url)
    return match.group(1) if match else None


def _series_title_for_event(event_title: str, venue_name: str | None) -> str:
    venue = (venue_name or "Hands On Atlanta").strip()
    return f"{event_title} at {venue}"


def _rolling_start_date_iso() -> str:
    """Match HelpATL's pre-5am rollover so visible rows get repaired too."""
    now = datetime.now()
    if now.hour < 5:
        now = now - timedelta(days=1)
    return now.date().isoformat()


def main() -> None:
    client = get_client()
    today = _rolling_start_date_iso()

    result = (
        client.table("events")
        .select("id,title,start_date,start_time,content_hash,source_url,series_id,venue:venue_id(name)")
        .eq("source_id", HOA_SOURCE_ID)
        .gte("start_date", today)
        .order("start_date", desc=False)
        .limit(2000)
        .execute()
    )

    rows = result.data or []
    candidate_rows = [
        row
        for row in rows
        if _is_generic_opportunity_title(str(row.get("title") or "").strip())
        or str(row.get("title") or "") != str(row.get("title") or "").strip()
        or str(row.get("title") or "").strip().lower() in GENERIC_TITLE_SQL_PATTERNS
    ]

    if not candidate_rows:
        print("No Hands On Atlanta title repairs needed.")
        return

    rows_by_opp_id: dict[str, list[dict]] = defaultdict(list)
    for row in candidate_rows:
        opp_id = _extract_opportunity_id(row.get("source_url"))
        if opp_id:
            rows_by_opp_id[opp_id].append(row)

    updated_events = 0
    updated_series: set[str] = set()

    for opp_id, opp_rows in rows_by_opp_id.items():
        detail = _fetch_opportunity_detail(opp_id)
        if not detail:
            print(f"Skipping {opp_id}: failed to fetch detail")
            continue

        new_title = _build_event_title(detail)
        rows_needing_update = [
            row for row in opp_rows if str(row.get("title") or "") != new_title
        ]
        if not rows_needing_update:
            continue

        venue_name = (
            ((rows_needing_update[0].get("venue") or {}).get("name"))
            if rows_needing_update
            else None
        )
        series_title = _series_title_for_event(new_title, venue_name)
        series_slug = slugify(series_title)

        for row in rows_needing_update:
            new_hash = generate_content_hash(
                new_title,
                venue_name or "Hands On Atlanta",
                row["start_date"],
            )
            (
                client.table("events")
                .update({"title": new_title, "content_hash": new_hash})
                .eq("id", row["id"])
                .execute()
            )
            updated_events += 1

            if row.get("series_id") and row["series_id"] not in updated_series:
                (
                    client.table("series")
                    .update({"title": series_title, "slug": series_slug})
                    .eq("id", row["series_id"])
                    .execute()
                )
                updated_series.add(row["series_id"])

        print(
            f"{opp_id}: updated {len(rows_needing_update)} event(s) to '{new_title}'"
            + (
                f" and series '{series_title}'"
                if rows_needing_update[0].get("series_id")
                else ""
            )
        )

    print(
        f"Done. Updated {updated_events} event(s) and {len(updated_series)} series record(s)."
    )


if __name__ == "__main__":
    main()
