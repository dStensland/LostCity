#!/usr/bin/env python3
"""
Apply closed-venue registry to database.

Dry-run by default. Use --apply to execute writes.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from db import get_client
from closed_venues import CLOSED_VENUES, CLOSED_VENUE_NOTE


def _append_note(description: str | None) -> str:
    text = (description or "").strip()
    if not text:
        return CLOSED_VENUE_NOTE
    lower = text.lower()
    if "do not reactivate via crawler" in lower:
        return text
    if "permanently closed" in lower:
        if text.endswith((".", "!", "?")):
            return f"{text} Do not reactivate via crawler."
        return f"{text}. Do not reactivate via crawler."
    if text.endswith((".", "!", "?")):
        return f"{text} {CLOSED_VENUE_NOTE}"
    return f"{text}. {CLOSED_VENUE_NOTE}"


def _has_best_of_table(client) -> bool:
    try:
        client.table("best_of_nominations").select("id").limit(1).execute()
        return True
    except Exception:
        return False


def main() -> None:
    parser = argparse.ArgumentParser(description="Apply closed venues registry.")
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Execute writes (default is dry-run)",
    )
    args = parser.parse_args()

    client = get_client()
    can_touch_best_of = _has_best_of_table(client)

    updated_venues = 0
    disabled_sources = 0
    rejected_best_of = 0

    for entry in CLOSED_VENUES:
        venues = (
            client.table("venues")
            .select("id,name,slug,active,description")
            .eq("slug", entry.slug)
            .limit(1)
            .execute()
        ).data or []

        if not venues:
            print(f"[WARN] Missing venue slug `{entry.slug}`")
            continue

        venue: dict[str, Any] = venues[0]
        venue_updates = {}
        if venue.get("active") is not False:
            venue_updates["active"] = False
        new_desc = _append_note(venue.get("description"))
        if new_desc != (venue.get("description") or "").strip():
            venue_updates["description"] = new_desc

        if venue_updates:
            print(f"[VENUE] {entry.slug} -> {venue_updates}")
            if args.apply:
                client.table("venues").update(venue_updates).eq("id", venue["id"]).execute()
            updated_venues += 1

        if entry.source_slug:
            src = (
                client.table("sources")
                .select("id,slug,is_active")
                .eq("slug", entry.source_slug)
                .limit(1)
                .execute()
            ).data or []
            if src and src[0].get("is_active") is True:
                print(f"[SOURCE] disable `{entry.source_slug}` (id={src[0]['id']})")
                if args.apply:
                    client.table("sources").update({"is_active": False}).eq("id", src[0]["id"]).execute()
                disabled_sources += 1

        if can_touch_best_of:
            res = (
                client.table("best_of_nominations")
                .select("id,status")
                .eq("venue_id", venue["id"])
                .eq("status", "approved")
                .execute()
            ).data or []
            if res:
                print(
                    f"[BEST_OF] reject {len(res)} approved nominations for `{entry.slug}`"
                )
                if args.apply:
                    client.table("best_of_nominations").update({"status": "rejected"}).eq("venue_id", venue["id"]).eq("status", "approved").execute()
                rejected_best_of += len(res)

    mode = "APPLY" if args.apply else "DRY-RUN"
    print(
        f"[{mode}] venues_updated={updated_venues}, sources_disabled={disabled_sources}, best_of_rejected={rejected_best_of}"
    )


if __name__ == "__main__":
    main()
