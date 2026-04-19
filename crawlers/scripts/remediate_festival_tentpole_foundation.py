#!/usr/bin/env python3
"""
Apply targeted root-cause fixes for festival/tentpole coverage quality.

Fixes included:
1) Reactivate high-priority big-event sources
2) Promote known big-event rows to is_tentpole=true
3) Clean noisy Atlanta Streets Alive duplicates/wrong-date rows
"""

from __future__ import annotations

import argparse
import json
from datetime import date
from pathlib import Path
import sys
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from db import get_client


OFFICIAL_STREETS_ALIVE_2026 = {
    "2026-03-22",
    "2026-04-19",
    "2026-05-17",
    "2026-09-13",
}

SOURCE_BOOTSTRAP = {
    "decatur-watchfest": {
        "name": "Decatur WatchFest",
        "url": "https://decaturwatchfest26.com/",
        "source_type": "scrape",
    },
    "ga-renaissance-festival": {
        "name": "Georgia Renaissance Festival",
        "url": "https://www.garenfest.com",
        "source_type": "scrape",
    },
    "blue-ridge-trout-fest": {
        "name": "Blue Ridge Trout & Outdoor Adventures Festival",
        "url": "https://blueridgetroutfest.com",
        "source_type": "scrape",
    },
    "breakaway-atlanta": {
        "name": "Breakaway Music Festival Atlanta",
        "url": "https://www.breakawayfestival.com/festival/atlanta-2026",
        "source_type": "scrape",
    },
    "esfna-atlanta": {
        "name": "ESFNA Ethiopian Sports & Cultural Festival",
        "url": "https://esfna.org/",
        "source_type": "scrape",
    },
    "221b-con": {
        "name": "221B Con",
        "url": "https://www.221bcon.com/",
        "source_type": "scrape",
    },
    "fifa-fan-festival-atlanta": {
        "name": "FIFA Fan Festival Atlanta",
        "url": "https://www.fifa.com/en/tournaments/mens/worldcup/26",
        "source_type": "scrape",
    },
}

FORCE_EVENT_MODEL_SLUGS = (
    "one-musicfest",
    "sweetwater-420-fest",
    "bluesberry-norcross",
    "conyers-cherry-blossom",
    "conyers-cherry-blossom-festival",
    "decatur-watchfest",
    "ga-renaissance-festival",
    "blue-ridge-trout-fest",
    "breakaway-atlanta",
    "esfna-atlanta",
    "221b-con",
    "fifa-fan-festival-atlanta",
)

FESTIVAL_SLUG_CANONICALIZATION = (
    ("shaky-knees-festival", "shaky-knees"),
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Festival/tentpole root remediation")
    parser.add_argument("--apply", action="store_true", help="Apply updates (default dry-run)")
    parser.add_argument(
        "--report-out",
        help=(
            "Optional report path. "
            "Default: ../reports/festival-remediation-pass-YYYY-MM-DD.json"
        ),
    )
    return parser.parse_args()


def default_report_path() -> Path:
    return ROOT.parent / "reports" / f"festival-remediation-pass-{date.today().isoformat()}.json"


def _fetch_source_by_slug(client, slug: str) -> dict[str, Any] | None:
    rows = client.table("sources").select("id,slug,name,is_active").eq("slug", slug).limit(1).execute().data or []
    if not rows:
        return None
    return rows[0]


def _ensure_source(
    client,
    *,
    slug: str,
    name: str,
    url: str,
    source_type: str,
    apply: bool,
) -> dict[str, Any]:
    existing = _fetch_source_by_slug(client, slug)
    if existing:
        result = {
            "slug": slug,
            "exists": True,
            "source_id": existing.get("id"),
            "created": 0,
            "updated": 0,
            "was_active": bool(existing.get("is_active")),
        }
        updates: dict[str, Any] = {}
        if not existing.get("is_active"):
            updates["is_active"] = True
        if (existing.get("name") or "").strip() != name:
            updates["name"] = name
        if (existing.get("url") or "").strip() != url:
            updates["url"] = url
        if (existing.get("source_type") or "").strip() != source_type:
            updates["source_type"] = source_type
        if apply and updates:
            update_result = client.table("sources").update(updates).eq("id", existing["id"]).execute()
            result["updated"] = len(update_result.data or [])
        result["updates"] = updates
        return result

    payload = {
        "slug": slug,
        "name": name,
        "url": url,
        "source_type": source_type,
        "is_active": True,
    }
    result = {
        "slug": slug,
        "exists": False,
        "source_id": None,
        "created": 0,
        "updated": 0,
        "was_active": None,
    }
    if apply:
        inserted = client.table("sources").insert(payload).execute().data or []
        if inserted:
            result["created"] = 1
            result["source_id"] = inserted[0].get("id")
    return result


def _chunked(values: list[int], size: int = 200) -> list[list[int]]:
    return [values[idx : idx + size] for idx in range(0, len(values), size)]


def _update_event_flags(client, event_ids: list[int], payload: dict[str, Any], *, apply: bool) -> int:
    if not apply or not event_ids:
        return 0
    updated = 0
    for bucket in _chunked(event_ids):
        result = client.table("events").update(payload).in_("id", bucket).execute()
        updated += len(result.data or [])
    return updated


def _demote_festival_container(client, slug: str, *, apply: bool) -> dict[str, Any]:
    rows = (
        client.table("festivals")
        .select("id,slug,name")
        .eq("slug", slug)
        .limit(1)
        .execute()
        .data
        or []
    )
    if not rows:
        return {
            "slug": slug,
            "festival_exists": False,
            "festival_id": None,
            "series_link_count": 0,
            "event_link_count": 0,
            "series_unlinked": 0,
            "events_unlinked": 0,
            "festival_deleted": 0,
        }

    festival_id = rows[0]["id"]
    series_rows = (
        client.table("series")
        .select("id")
        .eq("festival_id", festival_id)
        .execute()
        .data
        or []
    )
    event_rows = (
        client.table("events")
        .select("id")
        .eq("festival_id", festival_id)
        .execute()
        .data
        or []
    )

    result = {
        "slug": slug,
        "festival_exists": True,
        "festival_id": festival_id,
        "series_link_count": len(series_rows),
        "event_link_count": len(event_rows),
        "series_unlinked": 0,
        "events_unlinked": 0,
        "festival_deleted": 0,
    }
    if not apply:
        return result

    if series_rows:
        unlink_series = (
            client.table("series")
            .update({"festival_id": None})
            .eq("festival_id", festival_id)
            .execute()
        )
        result["series_unlinked"] = len(unlink_series.data or [])

    if event_rows:
        unlink_events = (
            client.table("events")
            .update({"festival_id": None})
            .eq("festival_id", festival_id)
            .execute()
        )
        result["events_unlinked"] = len(unlink_events.data or [])

    delete_result = client.table("festivals").delete().eq("id", festival_id).execute()
    result["festival_deleted"] = len(delete_result.data or [])
    return result


def _canonicalize_festival_slug(
    client, from_slug: str, to_slug: str, *, apply: bool
) -> dict[str, Any]:
    from_rows = (
        client.table("festivals")
        .select("id,slug,name")
        .eq("slug", from_slug)
        .limit(1)
        .execute()
        .data
        or []
    )
    to_rows = (
        client.table("festivals")
        .select("id,slug,name")
        .eq("slug", to_slug)
        .limit(1)
        .execute()
        .data
        or []
    )
    if not from_rows:
        return {
            "from_slug": from_slug,
            "to_slug": to_slug,
            "from_exists": False,
            "to_exists": bool(to_rows),
            "events_relinked": 0,
            "series_relinked": 0,
            "from_deleted": 0,
        }
    if not to_rows:
        return {
            "from_slug": from_slug,
            "to_slug": to_slug,
            "from_exists": True,
            "to_exists": False,
            "events_relinked": 0,
            "series_relinked": 0,
            "from_deleted": 0,
        }

    from_id = from_rows[0]["id"]
    to_id = to_rows[0]["id"]
    event_rows = (
        client.table("events").select("id").eq("festival_id", from_id).execute().data
        or []
    )
    series_rows = (
        client.table("series").select("id").eq("festival_id", from_id).execute().data
        or []
    )
    result = {
        "from_slug": from_slug,
        "to_slug": to_slug,
        "from_exists": True,
        "to_exists": True,
        "from_festival_id": from_id,
        "to_festival_id": to_id,
        "event_link_count": len(event_rows),
        "series_link_count": len(series_rows),
        "events_relinked": 0,
        "series_relinked": 0,
        "from_deleted": 0,
    }
    if not apply:
        return result

    if event_rows:
        relink_events = (
            client.table("events")
            .update({"festival_id": to_id})
            .eq("festival_id", from_id)
            .execute()
        )
        result["events_relinked"] = len(relink_events.data or [])
    if series_rows:
        relink_series = (
            client.table("series")
            .update({"festival_id": to_id})
            .eq("festival_id", from_id)
            .execute()
        )
        result["series_relinked"] = len(relink_series.data or [])

    delete_result = client.table("festivals").delete().eq("id", from_id).execute()
    result["from_deleted"] = len(delete_result.data or [])
    return result


def main() -> int:
    args = parse_args()
    report_path = Path(args.report_out) if args.report_out else default_report_path()
    report_path.parent.mkdir(parents=True, exist_ok=True)

    client = get_client()
    apply = bool(args.apply)

    summary: dict[str, Any] = {
        "snapshot_date": date.today().isoformat(),
        "mode": "apply" if apply else "dry-run",
        "source_bootstrap": {},
        "source_reactivation": {},
        "festival_slug_canonicalization": {},
        "festival_container_demotion": {},
        "tentpole_promotions": {},
        "streets_alive_cleanup": {},
    }

    for slug, source_spec in SOURCE_BOOTSTRAP.items():
        summary["source_bootstrap"][slug] = _ensure_source(
            client,
            slug=slug,
            name=source_spec["name"],
            url=source_spec["url"],
            source_type=source_spec["source_type"],
            apply=apply,
        )

    # 1) Reactivate high-priority sources
    for slug in ("one-musicfest", "atlanta-streets-alive"):
        source = _fetch_source_by_slug(client, slug)
        row_summary = {
            "source_slug": slug,
            "exists": bool(source),
            "source_id": source.get("id") if source else None,
            "was_active": bool(source.get("is_active")) if source else None,
            "updated": 0,
        }
        if apply and source and not source.get("is_active"):
            result = (
                client.table("sources")
                .update({"is_active": True})
                .eq("id", source["id"])
                .execute()
            )
            row_summary["updated"] = len(result.data or [])
        summary["source_reactivation"][slug] = row_summary

    # 1b) Demote simple single-parent rows from festival container model.
    for slug in FORCE_EVENT_MODEL_SLUGS:
        summary["festival_container_demotion"][slug] = _demote_festival_container(
            client,
            slug,
            apply=apply,
        )

    for from_slug, to_slug in FESTIVAL_SLUG_CANONICALIZATION:
        summary["festival_slug_canonicalization"][from_slug] = _canonicalize_festival_slug(
            client,
            from_slug=from_slug,
            to_slug=to_slug,
            apply=apply,
        )

    # 2) Promote known tentpole events
    current_cycle_start = f"{date.today().year - 1}-01-01"

    sweet_one_rows = (
        client.table("events")
        .select("id,title,start_date,is_tentpole,is_active,source_id")
        .or_("title.ilike.%ONE Musicfest%,title.ilike.%SweetWater 420 Fest%")
        .gte("start_date", current_cycle_start)
        .is_("canonical_event_id", "null")
        .execute()
        .data
        or []
    )
    sweet_one_ids = sorted(
        {
            int(row["id"])
            for row in sweet_one_rows
            if row.get("id") is not None
            and row.get("is_active") is not False
            and not bool(row.get("is_tentpole"))
        }
    )
    updated_sweet_one = _update_event_flags(client, sweet_one_ids, {"is_tentpole": True}, apply=apply)
    summary["tentpole_promotions"]["one_musicfest_sweetwater"] = {
        "candidate_count": len(sweet_one_ids),
        "updated_count": updated_sweet_one,
        "sample": sweet_one_rows[:10],
    }

    # FIFA match rows get promoted to tentpole AND linked to the
    # 'fifa-world-cup-26' parent festival in a single pass. The festival_id
    # link keeps matches out of the Big Stuff month ribbon (loader filters
    # tentpoles on festival_id IS NULL) so the 8+ Atlanta matches surface
    # as one parent-festival entry rather than eight competing tentpoles.
    # Seed migration: 20260418000001_fifa_world_cup_tournament_festival.sql.
    fifa_rows = (
        client.table("events")
        .select("id,title,start_date,is_tentpole,is_active,source_id,festival_id")
        .in_("source_id", [12, 84])
        .ilike("title", "%FIFA World Cup%")
        .gte("start_date", "2026-01-01")
        .lte("start_date", "2026-12-31")
        .is_("canonical_event_id", "null")
        .execute()
        .data
        or []
    )
    fifa_ids = sorted(
        {
            int(row["id"])
            for row in fifa_rows
            if row.get("id") is not None
            and row.get("is_active") is not False
            and (not bool(row.get("is_tentpole")) or not row.get("festival_id"))
        }
    )
    updated_fifa = _update_event_flags(
        client,
        fifa_ids,
        {"is_tentpole": True, "festival_id": "fifa-world-cup-26"},
        apply=apply,
    )
    summary["tentpole_promotions"]["fifa_world_cup_matches"] = {
        "candidate_count": len(fifa_ids),
        "updated_count": updated_fifa,
        "sample": fifa_rows[:20],
    }

    # 3) Streets Alive cleanup
    streets_source = _fetch_source_by_slug(client, "atlanta-streets-alive")
    streets_source_id = int(streets_source["id"]) if streets_source and streets_source.get("id") else None

    streets_rows = (
        client.table("events")
        .select("id,title,start_date,is_active,is_tentpole,source_id")
        .ilike("title", "Atlanta Streets Alive%")
        .gte("start_date", "2026-01-01")
        .is_("canonical_event_id", "null")
        .execute()
        .data
        or []
    )

    duplicate_or_official_miss_ids: list[int] = []
    for row in streets_rows:
        event_id = row.get("id")
        start_date = str(row.get("start_date") or "")[:10]
        source_id = row.get("source_id")
        is_active = row.get("is_active")
        is_tentpole = bool(row.get("is_tentpole"))
        if event_id is None:
            continue

        source_mismatch = streets_source_id is not None and source_id != streets_source_id
        wrong_official_date = source_id == streets_source_id and start_date not in OFFICIAL_STREETS_ALIVE_2026

        should_demote = source_mismatch or wrong_official_date
        already_demoted = (is_active is False) and (not is_tentpole)
        if should_demote and not already_demoted:
            duplicate_or_official_miss_ids.append(int(event_id))

    duplicate_or_official_miss_ids = sorted(set(duplicate_or_official_miss_ids))
    updated_streets = _update_event_flags(
        client,
        duplicate_or_official_miss_ids,
        {"is_active": False, "is_tentpole": False},
        apply=apply,
    )

    summary["streets_alive_cleanup"] = {
        "streets_source_id": streets_source_id,
        "official_2026_dates": sorted(OFFICIAL_STREETS_ALIVE_2026),
        "candidate_count": len(duplicate_or_official_miss_ids),
        "updated_count": updated_streets,
        "sample": streets_rows[:20],
    }

    report_path.write_text(json.dumps(summary, indent=2) + "\n")
    print(f"Wrote: {report_path}")
    print(json.dumps(summary, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
