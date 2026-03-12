#!/usr/bin/env python3
"""Audit externally researched big-event candidates against festival/event coverage.

Outputs a deterministic JSON + Markdown report so "what are we still missing?"
is reproducible across runs.
"""

from __future__ import annotations

import argparse
import json
from collections import Counter
from dataclasses import dataclass
from datetime import date
from pathlib import Path
from typing import Any

from db import get_client


@dataclass(frozen=True)
class Candidate:
    name: str
    target_model: str  # festival | tentpole_event | festival_or_program
    aliases: tuple[str, ...]
    source: str
    source_slug_hints: tuple[str, ...] = ()


CANDIDATES: tuple[Candidate, ...] = (
    Candidate(
        name="Atlanta Pride Festival",
        target_model="festival",
        aliases=("atlanta pride", "atlanta pride festival"),
        source="https://www.atlantapride.org/festival",
        source_slug_hints=("atlanta-pride",),
    ),
    Candidate(
        name="ONE Musicfest",
        target_model="tentpole_event",
        aliases=("one musicfest", "one music festival"),
        source="https://onemusicfest.com/tickets/",
        source_slug_hints=("one-musicfest",),
    ),
    Candidate(
        name="SweetWater 420 Fest",
        target_model="tentpole_event",
        aliases=("sweetwater 420 fest", "420 fest"),
        source="https://www.sweetwater420fest.com/faq",
        source_slug_hints=("sweetwater-420-fest",),
    ),
    Candidate(
        name="FIFA World Cup 26 Atlanta Matches",
        target_model="tentpole_event",
        aliases=("fifa world cup 26", "fifa world cup atlanta", "world cup atlanta"),
        source="https://discoveratlanta.com/blog/discover-the-fifa-world-cup-26-in-atlanta/",
        source_slug_hints=("mercedes-benz-stadium", "gwcc"),
    ),
    Candidate(
        name="Atlanta Streets Alive",
        target_model="tentpole_event",
        aliases=("atlanta streets alive",),
        source="https://www.atlantastreetsalive.org/",
        source_slug_hints=("atlanta-streets-alive",),
    ),
    Candidate(
        name="Inman Park Festival",
        target_model="festival",
        aliases=("inman park festival",),
        source="https://inmanparkfestival.org/",
        source_slug_hints=("inman-park-festival",),
    ),
    Candidate(
        name="Peachtree Road Race",
        target_model="tentpole_event",
        aliases=("peachtree road race", "ajc peachtree road race"),
        source="https://www.atlantatrackclub.org/peachtree",
        source_slug_hints=("peachtree-road-race", "atlanta-track-club"),
    ),
    Candidate(
        name="Atlanta BeltLine Lantern Parade",
        target_model="tentpole_event",
        aliases=("atlanta beltline lantern parade", "beltline lantern parade"),
        source="https://beltline.org/lantern-parade/",
        source_slug_hints=("beltline-lantern-parade", "atlanta-beltline", "beltline"),
    ),
    Candidate(
        name="Atlanta Caribbean Carnival",
        target_model="tentpole_event",
        aliases=("atlanta caribbean carnival",),
        source="https://discoveratlanta.com/events/atlanta-caribbean-carnival/",
        source_slug_hints=("atlanta-caribbean-carnival",),
    ),
    Candidate(
        name="Decatur WatchFest",
        target_model="tentpole_event",
        aliases=("decatur watchfest",),
        source="https://decaturwatchfest26.com/",
        source_slug_hints=("decatur-watchfest",),
    ),
    Candidate(
        name="Atlanta Science Festival",
        target_model="festival",
        aliases=("atlanta science festival",),
        source="https://discoveratlanta.com/stories/things-to-do/ultimate-guide-to-spring-in-atlanta/",
        source_slug_hints=("atlanta-science-festival",),
    ),
    Candidate(
        name="404 Day",
        target_model="tentpole_event",
        aliases=("404 day",),
        source="https://discoveratlanta.com/stories/things-to-do/ultimate-guide-to-spring-in-atlanta/",
        source_slug_hints=("404-weekend",),
    ),
    Candidate(
        name="Atlanta Film Festival",
        target_model="festival",
        aliases=("atlanta film festival",),
        source="https://discoveratlanta.com/stories/things-to-do/ultimate-guide-to-spring-in-atlanta/",
        source_slug_hints=("atlanta-film-festival",),
    ),
    Candidate(
        name="Atlanta Dogwood Festival",
        target_model="festival",
        aliases=("atlanta dogwood festival", "dogwood festival"),
        source="https://discoveratlanta.com/stories/things-to-do/ultimate-guide-to-spring-in-atlanta/",
        source_slug_hints=("dogwood-festival", "atlanta-dogwood"),
    ),
    Candidate(
        name="Atlanta Jazz Festival",
        target_model="festival",
        aliases=("atlanta jazz festival", "atlanta jazz fest"),
        source="https://discoveratlanta.com/stories/things-to-do/ultimate-guide-to-spring-in-atlanta/",
        source_slug_hints=("atlanta-jazz-fest", "atlanta-jazz-festival"),
    ),
    Candidate(
        name="Sweet Auburn Springfest",
        target_model="festival",
        aliases=("sweet auburn springfest", "sweet auburn fest"),
        source="https://discoveratlanta.com/stories/things-to-do/atlantas-biggest-anniversaries-to-celebrate-in-2026/",
        source_slug_hints=("sweet-auburn-springfest",),
    ),
    Candidate(
        name="Dragon Con",
        target_model="festival",
        aliases=("dragon con", "dragoncon"),
        source="https://www.dragoncon.org/",
        source_slug_hints=("dragon-con",),
    ),
    Candidate(
        name="Shaky Knees",
        target_model="festival",
        aliases=("shaky knees", "shaky knees festival"),
        source="https://www.shakykneesfestival.com/",
        source_slug_hints=("shaky-knees",),
    ),
    Candidate(
        name="Piedmont Park Arts Festival",
        target_model="tentpole_event",
        aliases=("piedmont park arts festival", "piedmont park arts"),
        source="https://discoveratlanta.com/blog/ultimate-guide-to-summer-festivals-in-atlanta/",
        source_slug_hints=("piedmont-park-arts-festival",),
    ),
    Candidate(
        name="BronzeLens Film Festival",
        target_model="festival",
        aliases=("bronzelens film festival", "bronzelens"),
        source="https://discoveratlanta.com/blog/black-events-atlanta/",
        source_slug_hints=("bronzelens",),
    ),
    Candidate(
        name="National Black Arts Festival",
        target_model="tentpole_event",
        aliases=("national black arts festival", "national black arts"),
        source="https://discoveratlanta.com/events/national-black-arts-festival/",
        source_slug_hints=("national-black-arts-festival", "nbaf"),
    ),
    Candidate(
        name="Elevate Atlanta",
        target_model="festival",
        aliases=("elevate atlanta",),
        source="https://www.atlantafestivals.com/events/elevate/",
        source_slug_hints=("elevate-atl-art",),
    ),
    Candidate(
        name="Native American Festival and Pow-Wow",
        target_model="tentpole_event",
        aliases=("native american festival and pow wow", "native american festival"),
        source="https://www.atlantafestivals.com/events/native-american-festival-and-pow-wow/",
        source_slug_hints=("native-american-festival-and-pow-wow",),
    ),
    Candidate(
        name="Atlanta Greek Picnic",
        target_model="tentpole_event",
        aliases=("atlanta greek picnic", "greek picnic"),
        source="https://discoveratlanta.com/blog/black-events-atlanta/",
        source_slug_hints=("atlanta-greek-picnic",),
    ),
    Candidate(
        name="Atlanta Black Pride Weekend",
        target_model="tentpole_event",
        aliases=("atlanta black pride weekend", "atlanta black pride"),
        source="https://discoveratlanta.com/blog/black-events-atlanta/",
        source_slug_hints=("atlanta-black-pride",),
    ),
    Candidate(
        name="Taste of Soul Atlanta",
        target_model="tentpole_event",
        aliases=("taste of soul atlanta", "taste of soul"),
        source="https://discoveratlanta.com/blog/black-events-atlanta/",
        source_slug_hints=("taste-of-soul-atlanta",),
    ),
)


def _fetch_rows(table: str, fields: str, *, page_size: int = 1000) -> list[dict[str, Any]]:
    client = get_client()
    rows: list[dict[str, Any]] = []
    offset = 0
    while True:
        result = (
            client.table(table)
            .select(fields)
            .order("id")
            .range(offset, offset + page_size - 1)
            .execute()
        )
        batch = result.data or []
        if not batch:
            break
        rows.extend(batch)
        if len(batch) < page_size:
            break
        offset += page_size
    return rows


def _norm(text: str) -> str:
    lowered = "".join(ch if ch.isalnum() else " " for ch in (text or "").lower())
    return " ".join(lowered.split())


def _matches_any(text: str, aliases: tuple[str, ...]) -> bool:
    normalized = _norm(text)
    return any(_norm(alias) in normalized for alias in aliases)


def _parse_date(value: Any) -> date | None:
    if not value:
        return None
    try:
        return date.fromisoformat(str(value)[:10])
    except Exception:
        return None


def _evaluate_candidate(
    candidate: Candidate,
    festivals: list[dict[str, Any]],
    events: list[dict[str, Any]],
    sources: list[dict[str, Any]],
    latest_crawl_by_source_id: dict[int, dict[str, Any]],
    today: date,
) -> dict[str, Any]:
    festival_matches = [
        {"id": row["id"], "slug": row.get("slug"), "name": row.get("name")}
        for row in festivals
        if _matches_any(f"{row.get('name', '')} {row.get('slug', '')}", candidate.aliases)
    ]
    matched_festival_ids = {row["id"] for row in festival_matches}

    event_matches = []
    for row in events:
        if row.get("is_active") is False:
            continue
        title = row.get("title") or ""
        linked_festival_match = row.get("festival_id") in matched_festival_ids
        title_match = _matches_any(title, candidate.aliases)
        if not linked_festival_match and not title_match:
            continue

        start = _parse_date(row.get("start_date"))
        event_matches.append(
            {
                "id": row.get("id"),
                "title": title,
                "start_date": row.get("start_date"),
                "festival_id": row.get("festival_id"),
                "is_tentpole": bool(row.get("is_tentpole")),
                "is_active": bool(row.get("is_active", True)),
                "is_upcoming": bool(start and start >= today),
            }
        )

    event_matches.sort(
        key=lambda row: (
            not row["is_upcoming"],
            not row["is_tentpole"],
            row.get("start_date") or "",
            str(row.get("title") or "").lower(),
        )
    )

    upcoming_events = [row for row in event_matches if row["is_upcoming"]]
    upcoming_tentpole_events = [row for row in upcoming_events if row["is_tentpole"]]

    source_matches = []
    for source in sources:
        slug = (source.get("slug") or "").strip()
        name = (source.get("name") or "").strip()
        url = (source.get("url") or "").strip()
        haystack = f"{name} {slug} {url}"
        hint_match = any(slug == hint for hint in candidate.source_slug_hints if hint)
        alias_match = _matches_any(haystack, candidate.aliases)
        if hint_match or alias_match:
            source_id = source.get("id")
            source_matches.append(
                {
                    "id": source_id,
                    "slug": slug,
                    "name": name,
                    "url": url,
                    "is_active": bool(source.get("is_active")),
                    "last_crawled_at": source.get("last_crawled_at"),
                    "latest_crawl": latest_crawl_by_source_id.get(source_id) if source_id else None,
                }
            )
    source_matches.sort(key=lambda row: (not row["is_active"], row["slug"] or ""))

    status = "missing"
    if candidate.target_model == "tentpole_event":
        if upcoming_tentpole_events:
            status = "covered_tentpole_upcoming"
        elif upcoming_events:
            status = "covered_event_not_tentpole"
        elif any(row["is_tentpole"] for row in event_matches):
            status = "covered_tentpole_past_only"
        elif event_matches:
            status = "covered_event_past_only"
        elif festival_matches:
            status = "covered_festival_only"
    else:
        if festival_matches:
            status = "covered_festival"
            if not upcoming_events:
                status = "covered_festival_no_upcoming_event"
        elif upcoming_events:
            status = "covered_event_only"
        elif event_matches:
            status = "covered_event_past_only"

    if not source_matches:
        source_status = "no_source"
    elif any(row["is_active"] for row in source_matches):
        source_status = "active_source"
    else:
        source_status = "inactive_source"

    active_matches = [row for row in source_matches if row["is_active"]]
    if status == "missing" and active_matches:
        latest_crawls = [row.get("latest_crawl") or {} for row in active_matches]
        if any(crawl.get("status") == "success" for crawl in latest_crawls):
            status = "covered_source_active_no_current_events"
        else:
            status = "covered_source_active_unverified"

    recommended_action = "none"
    if status == "missing":
        if source_status == "no_source":
            recommended_action = "create_source_and_crawler"
        elif source_status == "inactive_source":
            recommended_action = "activate_source_and_run"
        else:
            active_matches = [row for row in source_matches if row["is_active"]]
            has_recent_zero_output = any(
                (row.get("latest_crawl") or {}).get("events_found") == 0
                for row in active_matches
            )
            if has_recent_zero_output:
                recommended_action = "active_source_zero_output_investigate_url_or_parser"
            else:
                recommended_action = "debug_active_source_extraction"
    elif status == "covered_source_active_no_current_events":
        recommended_action = "monitor_next_edition_dates"
    elif status == "covered_source_active_unverified":
        recommended_action = "debug_active_source_extraction"
    elif status == "covered_event_not_tentpole":
        recommended_action = "promote_event_to_tentpole"
    elif status in {"covered_event_only", "covered_festival_only"}:
        recommended_action = "decide_festival_vs_event_model"
    elif status in {"covered_festival_no_upcoming_event", "covered_tentpole_past_only", "covered_event_past_only"}:
        recommended_action = "monitor_next_edition_dates"

    return {
        "name": candidate.name,
        "target_model": candidate.target_model,
        "source": candidate.source,
        "festival_matches": festival_matches,
        "source_matches": source_matches,
        "source_status": source_status,
        "event_matches": event_matches[:12],
        "status": status,
        "recommended_action": recommended_action,
    }


def run_audit() -> dict[str, Any]:
    today = date.today()
    festivals = _fetch_rows("festivals", "id,slug,name")
    sources = _fetch_rows("sources", "id,slug,name,url,is_active,last_crawled_at")
    events = _fetch_rows(
        "events",
        "id,title,start_date,festival_id,is_tentpole,is_active",
    )

    source_ids: set[int] = set()
    for candidate in CANDIDATES:
        for source in sources:
            source_id = source.get("id")
            if not source_id:
                continue
            slug = (source.get("slug") or "").strip()
            name = (source.get("name") or "").strip()
            url = (source.get("url") or "").strip()
            haystack = f"{name} {slug} {url}"
            hint_match = any(slug == hint for hint in candidate.source_slug_hints if hint)
            alias_match = _matches_any(haystack, candidate.aliases)
            if hint_match or alias_match:
                source_ids.add(int(source_id))

    latest_crawl_by_source_id: dict[int, dict[str, Any]] = {}
    client = get_client()
    for source_id in source_ids:
        latest = (
            client.table("crawl_logs")
            .select("status,started_at,events_found,events_new,events_updated,error_message")
            .eq("source_id", source_id)
            .order("started_at", desc=True)
            .limit(1)
            .execute()
            .data
            or []
        )
        if latest:
            latest_crawl_by_source_id[int(source_id)] = latest[0]

    rows = [
        _evaluate_candidate(candidate, festivals, events, sources, latest_crawl_by_source_id, today)
        for candidate in CANDIDATES
    ]
    status_counts = Counter(row["status"] for row in rows)
    source_status_counts = Counter(row["source_status"] for row in rows)
    action_counts = Counter(
        row["recommended_action"] for row in rows if row["recommended_action"] != "none"
    )

    return {
        "snapshot_date": today.isoformat(),
        "candidate_count": len(rows),
        "status_counts": dict(status_counts),
        "source_status_counts": dict(source_status_counts),
        "action_counts": dict(action_counts),
        "rows": rows,
    }


def _to_markdown(payload: dict[str, Any]) -> str:
    lines: list[str] = []
    lines.append(f"# Festival + Tentpole Missing Research ({payload['snapshot_date']})")
    lines.append("")
    lines.append("External references were compared against current `festivals` + `events` coverage.")
    lines.append("")
    lines.append(
        "| Candidate | Target Model | Festivals Match | Source Match | Events Match | Status | Action | Source |"
    )
    lines.append("|---|---:|---:|---|---:|---|---|---|")

    for row in payload["rows"]:
        source_badge = f"{row['source_status']} ({len(row['source_matches'])})"
        lines.append(
            "| "
            + f"{row['name']} | `{row['target_model']}` | "
            + f"{len(row['festival_matches'])} | {source_badge} | {len(row['event_matches'])} | "
            + f"**{row['status']}** | `{row['recommended_action']}` | {row['source']} |"
        )

    lines.append("")
    lines.append("## Missing Set")
    missing = [row for row in payload["rows"] if row["status"] == "missing"]
    if not missing:
        lines.append("- none")
    else:
        for row in missing:
            lines.append(f"- {row['name']} (`{row['target_model']}`)")

    lines.append("")
    lines.append("## Action Queue")
    if not payload.get("action_counts"):
        lines.append("- none")
    else:
        for action, count in sorted(payload["action_counts"].items(), key=lambda item: (-item[1], item[0])):
            lines.append(f"- `{action}`: {count}")

    lines.append("")
    lines.append("## Covered But Needs Model Action")
    needs_action = [
        row
        for row in payload["rows"]
        if row["status"] in {"covered_event_not_tentpole", "covered_festival_only"}
    ]
    if not needs_action:
        lines.append("- none")
    else:
        for row in needs_action:
            lines.append(f"- {row['name']}: {row['status']}")

    return "\n".join(lines) + "\n"


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Audit externally researched festival/tentpole candidates"
    )
    parser.add_argument("--json-out", help="Write JSON output to a file")
    parser.add_argument("--md-out", help="Write Markdown output to a file")
    args = parser.parse_args()

    payload = run_audit()
    print(json.dumps(payload["status_counts"], indent=2))

    if args.json_out:
        out = Path(args.json_out)
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(json.dumps(payload, indent=2) + "\n")
        print(f"Wrote: {out}")

    if args.md_out:
        out = Path(args.md_out)
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(_to_markdown(payload))
        print(f"Wrote: {out}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
