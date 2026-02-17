#!/usr/bin/env python3
"""
One-time data repair for music venue event quality.

Targets:
- Duplicate events at the same venue/date/time (sets canonical_event_id)
- Missing/fragmented lineups (merges parsed + existing artists into canonical event)
- Garbage calendar-scrape descriptions (replaces with synthetic music summaries)

Default is dry-run. Use --apply to write changes.
"""

from __future__ import annotations

import argparse
import html
import os
import re
import sys
from collections import defaultdict
from datetime import date
from typing import Any
from urllib.parse import urlparse

# Add crawlers/ to import path when run directly.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from db import get_client, parse_lineup_from_title, upsert_event_artists
from description_fetcher import generate_synthetic_description


NOISY_TITLE_PREFIX_RE = re.compile(
    r"^(with|w/|special guests?|support(?:ing)?|opening|openers?)\b",
    flags=re.IGNORECASE,
)

SCHEDULE_NOISE_TERMS = [
    "sort shows by",
    "show calendar",
    "calendar view",
    "upcoming shows",
    "buy tickets",
    "more info",
    "view details",
    "load more",
    "filter by",
    "all shows",
]

GENERIC_MUSIC_DESC_RE = re.compile(
    r"^(?:live music|other event|hip-hop/rap event|dance/electronic event|event)\s+at\s+.+\.?$",
    flags=re.IGNORECASE,
)

ARTIST_STOPWORDS = {
    "with",
    "w",
    "special guest",
    "special guests",
    "guest",
    "guests",
    "support",
    "supporting",
    "opening",
    "openers",
    "an evening",
    "lp release show",
    "album release show",
    "release show",
    "presents",
}


def canonicalize_artist_name(name: str | None) -> str:
    if not name:
        return ""
    cleaned = html.unescape(str(name))
    cleaned = " ".join(cleaned.split()).strip()
    cleaned = re.sub(r"^[\s,&+/|•\-]+", "", cleaned)
    cleaned = re.sub(r"[\s,&+/|•\-]+$", "", cleaned)
    cleaned = re.sub(r"\s{2,}", " ", cleaned).strip()
    return cleaned


def normalize_text(value: str | None) -> str:
    if not value:
        return ""
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9\s]", " ", value.lower())).strip()


def normalized_headliner(title: str | None) -> str:
    if not title:
        return ""
    first_chunk = (title.split(",")[0] or title).strip()
    parts = re.split(
        r"\s+(?:w/|with|feat\.?|ft\.?|featuring|support(?:ing)?|special guests?|openers?|opening)\s+",
        first_chunk,
        flags=re.IGNORECASE,
    )
    return normalize_text(parts[0] if parts else first_chunk)


def is_root_url(url: str | None) -> bool:
    if not url:
        return True
    try:
        parsed = urlparse(url)
        path = (parsed.path or "").rstrip("/")
        return path == ""
    except Exception:
        return False


def parse_artists_from_title(title: str | None) -> list[str]:
    if not title:
        return []
    parsed = parse_lineup_from_title(title)
    names = [canonicalize_artist_name(row["name"]) for row in parsed if row.get("name")]
    return [name for name in names if is_valid_artist_name(name)]


def is_valid_artist_name(name: str | None) -> bool:
    if not name:
        return False
    cleaned = canonicalize_artist_name(name)
    if not cleaned or len(cleaned) < 2:
        return False
    normalized = normalize_text(cleaned)
    if not normalized:
        return False
    if normalized in ARTIST_STOPWORDS:
        return False
    if normalized.startswith("with ") or normalized.startswith("special guest"):
        return False
    if normalized.startswith("an evening"):
        return False
    # Drop likely tour/show labels, keep plausible artist names.
    if any(token in normalized for token in (" tour", " release show", " presents ")):
        return False
    if normalized in {"the", "and"}:
        return False
    return True


def score_event(event: dict[str, Any], artist_names: list[str]) -> int:
    score = 0
    title = (event.get("title") or "").strip()
    description = event.get("description") or ""

    if artist_names:
        score += min(len(artist_names), 4) * 2
    if event.get("ticket_url"):
        score += 2
    if not is_root_url(event.get("source_url")):
        score += 2
    if event.get("image_url"):
        score += 1
    if description and len(description) > 80:
        score += 1
    if event.get("extraction_version") == "pipeline_v3":
        score += 1
    if not NOISY_TITLE_PREFIX_RE.match(title):
        score += 1
    if re.search(r"[a-z]", title):
        score += 1
    score += min(len(title) // 20, 2)
    return score


def is_schedule_garbage(desc: str | None) -> bool:
    if not desc:
        return False
    text = " ".join(desc.split()).lower()
    noise_hits = sum(1 for term in SCHEDULE_NOISE_TERMS if term in text)
    if noise_hits >= 3:
        return True
    if text.count("more info") >= 2 or text.count("buy tickets") >= 2:
        return True
    month_hits = len(re.findall(r"\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b", text))
    meridiem_hits = text.count(" am") + text.count(" pm")
    if len(text) > 220 and month_hits >= 3 and meridiem_hits >= 3:
        return True
    return False


def is_music_stub_or_garbage(desc: str | None) -> bool:
    if not desc:
        return True

    text = " ".join(str(desc).split()).strip()
    lowered = text.lower()

    if GENERIC_MUSIC_DESC_RE.match(text):
        return True
    if lowered.startswith("tix") and ("doors" in lowered or "presented by:" in lowered):
        return True
    if "presented by:" in lowered and any(token in lowered for token in (" adv", " dos", "$")):
        return True
    if "|" in text and "atlanta, ga" in lowered:
        return True

    return False


def dedupe_ordered_names(names: list[str]) -> list[str]:
    seen: set[str] = set()
    ordered: list[str] = []
    for name in names:
        cleaned = canonicalize_artist_name(name)
        if not is_valid_artist_name(cleaned):
            continue
        if not cleaned:
            continue
        key = normalize_text(cleaned)
        if key in seen:
            continue
        seen.add(key)
        ordered.append(cleaned)
    return ordered


def build_artist_payload(ordered_names: list[str], headliner_name: str | None) -> list[dict[str, Any]]:
    payload: list[dict[str, Any]] = []
    normalized_headliner_name = (headliner_name or "").strip().lower()
    for idx, name in enumerate(ordered_names, start=1):
        is_headliner = False
        if normalized_headliner_name:
            is_headliner = name.lower() == normalized_headliner_name
        if idx == 1 and not normalized_headliner_name:
            is_headliner = True
        payload.append(
            {
                "name": name,
                "role": "headliner" if is_headliner else "support",
                "billing_order": idx,
                "is_headliner": is_headliner,
            }
        )
    if payload and not any(row["is_headliner"] for row in payload):
        payload[0]["is_headliner"] = True
        payload[0]["role"] = "headliner"
    return payload


def normalize_existing_payload(rows: list[dict[str, Any]], headliner_name: str | None) -> list[dict[str, Any]]:
    if not rows:
        return []

    normalized_headliner_name = (headliner_name or "").strip().lower()
    sorted_rows = sorted(
        rows,
        key=lambda row: (
            row.get("billing_order") if row.get("billing_order") is not None else 999,
            row.get("name") or "",
        ),
    )

    payload: list[dict[str, Any]] = []
    for idx, row in enumerate(sorted_rows, start=1):
        name = canonicalize_artist_name(row.get("name"))
        if not is_valid_artist_name(name):
            continue

        explicit_role = (row.get("role") or "").strip().lower()
        role = explicit_role if explicit_role in {"headliner", "support", "opener"} else None
        is_headliner = bool(row.get("is_headliner"))

        if normalized_headliner_name:
            is_headliner = name.lower() == normalized_headliner_name
        elif idx == 1 and not any(bool(r.get("is_headliner")) for r in sorted_rows):
            is_headliner = True

        if is_headliner:
            role = "headliner"
        if not role:
            role = "support"

        payload.append(
            {
                "name": name,
                "role": role,
                "billing_order": idx,
                "is_headliner": is_headliner,
            }
        )

    if payload and not any(row["is_headliner"] for row in payload):
        payload[0]["is_headliner"] = True
        payload[0]["role"] = "headliner"

    return payload


def replace_event_artists(client: Any, event_id: int, payload: list[dict[str, Any]]) -> None:
    # Route through shared writer so one-off fixes can't bypass sanitization/canonical linking.
    upsert_event_artists(event_id, payload, link_canonical=True)


def run_music_venue_quality_fix(
    *,
    venue_slugs: list[str] | None = None,
    from_date: str | None = None,
    dry_run: bool = True,
    verbose: bool = True,
) -> dict[str, Any]:
    venue_slugs = venue_slugs or ["the-eastern", "the-earl"]
    from_date = from_date or str(date.today())

    def emit(message: str) -> None:
        if verbose:
            print(message)

    client = get_client()

    venues_result = (
        client.table("venues")
        .select("id,name,slug")
        .in_("slug", venue_slugs)
        .execute()
    )
    venues = venues_result.data or []
    if not venues:
        emit("No matching venues found.")
        return {
            "scanned_events": 0,
            "duplicate_slot_groups": 0,
            "canonical_updates": 0,
            "canonical_resets": 0,
            "lineup_updates": 0,
            "description_repairs": 0,
            "deleted": 0,
            "dry_run": dry_run,
        }

    venue_map = {v["id"]: v for v in venues}
    venue_ids = list(venue_map.keys())
    emit(f"Target venues: {', '.join(v['name'] for v in venues)}")
    emit(f"Mode: {'DRY RUN' if dry_run else 'APPLY'}")
    emit(f"From date: {from_date}")

    events_result = (
        client.table("events")
        .select(
            "id,venue_id,title,start_date,start_time,description,category,"
            "source_url,ticket_url,image_url,extraction_version,canonical_event_id"
        )
        .in_("venue_id", venue_ids)
        .gte("start_date", from_date)
        .order("start_date")
        .order("start_time")
        .execute()
    )
    events = events_result.data or []
    if not events:
        emit("No matching events found.")
        return {
            "scanned_events": 0,
            "duplicate_slot_groups": 0,
            "canonical_updates": 0,
            "canonical_resets": 0,
            "lineup_updates": 0,
            "description_repairs": 0,
            "deleted": 0,
            "dry_run": dry_run,
        }

    event_ids = [e["id"] for e in events]
    artist_rows: list[dict[str, Any]] = []
    # Large IN lists can exceed API request limits; fetch in chunks.
    chunk_size = 400
    for idx in range(0, len(event_ids), chunk_size):
        batch_ids = event_ids[idx : idx + chunk_size]
        artists_result = (
            client.table("event_artists")
            .select("event_id,name,role,billing_order,is_headliner")
            .in_("event_id", batch_ids)
            .order("billing_order", desc=False)
            .execute()
        )
        artist_rows.extend(artists_result.data or [])

    artists_by_event: dict[int, list[dict[str, Any]]] = defaultdict(list)
    for row in artist_rows:
        artists_by_event[row["event_id"]].append(row)

    by_slot: dict[tuple[int, str, str], list[dict[str, Any]]] = defaultdict(list)
    for event in events:
        slot_key = (
            event["venue_id"],
            event["start_date"],
            str(event.get("start_time") or "00:00:00"),
        )
        by_slot[slot_key].append(event)

    duplicate_groups = [group for group in by_slot.values() if len(group) > 1]
    emit(f"Upcoming events scanned: {len(events)}")
    emit(f"Duplicate slot groups: {len(duplicate_groups)}")

    canonical_updates = 0
    canonical_resets = 0
    artist_updates = 0
    description_updates = 0

    # Track final canonical root per slot for subsequent description/artist backfill
    canonical_by_slot: dict[tuple[int, str, str], int] = {}

    for group in duplicate_groups:
        scored: list[tuple[int, int, int, dict[str, Any], list[str], list[str]]] = []
        for event in group:
            existing_artist_names = [row["name"] for row in artists_by_event.get(event["id"], [])]
            parsed_artist_names = parse_artists_from_title(event.get("title"))
            all_artist_names = dedupe_ordered_names(parsed_artist_names + existing_artist_names)
            # Use only parsed artists for ranking to keep winner selection stable across reruns.
            score = score_event(event, parsed_artist_names)
            if event.get("canonical_event_id") is None:
                score += 3
            scored.append(
                (
                    score,
                    len((event.get("title") or "")),
                    -int(event["id"]),
                    event,
                    parsed_artist_names,
                    all_artist_names,
                )
            )

        scored.sort(key=lambda item: (item[0], item[1], item[2]), reverse=True)
        winner = scored[0][3]
        winner_id = winner["id"]
        slot_key = (
            winner["venue_id"],
            winner["start_date"],
            str(winner.get("start_time") or "00:00:00"),
        )
        canonical_by_slot[slot_key] = winner_id

        # Merge artists from all grouped events into winner
        ordered_candidates: list[str] = []
        ordered_candidates.extend(parse_artists_from_title(winner.get("title")))
        ordered_candidates.extend([row["name"] for row in artists_by_event.get(winner_id, [])])

        for _, _, _, event, _, _ in scored[1:]:
            ordered_candidates.extend(parse_artists_from_title(event.get("title")))
            ordered_candidates.extend([row["name"] for row in artists_by_event.get(event["id"], [])])

        merged_names = dedupe_ordered_names(ordered_candidates)
        headliner = parse_artists_from_title(winner.get("title"))
        headliner_name = headliner[0] if headliner else (merged_names[0] if merged_names else None)

        if merged_names:
            desired_payload = build_artist_payload(merged_names, headliner_name)
            existing_payload = normalize_existing_payload(
                artists_by_event.get(winner_id, []),
                headliner_name,
            )
            if existing_payload != desired_payload:
                if dry_run:
                    emit(
                        f"[DRY RUN] Event {winner_id}: lineup -> {', '.join(merged_names)}"
                    )
                else:
                    replace_event_artists(client, winner_id, desired_payload)
                artist_updates += 1
                artists_by_event[winner_id] = desired_payload

        for _, _, _, event, _, _ in scored:
            event_id = event["id"]
            current_canonical = event.get("canonical_event_id")
            if event_id == winner_id:
                if current_canonical is not None:
                    if dry_run:
                        emit(f"[DRY RUN] Event {event_id}: canonical_event_id -> NULL")
                    else:
                        client.table("events").update({"canonical_event_id": None}).eq("id", event_id).execute()
                    canonical_resets += 1
                continue

            if current_canonical != winner_id:
                if dry_run:
                    emit(f"[DRY RUN] Event {event_id}: canonical_event_id -> {winner_id}")
                else:
                    client.table("events").update({"canonical_event_id": winner_id}).eq("id", event_id).execute()
                canonical_updates += 1

    # Ensure every slot has a canonical root (including non-duplicate slots)
    for slot_key, group in by_slot.items():
        if slot_key not in canonical_by_slot:
            roots = [e for e in group if e.get("canonical_event_id") is None]
            canonical_by_slot[slot_key] = (roots[0] if roots else group[0])["id"]

    # Backfill missing lineups + repair garbage descriptions on canonical rows
    for event in events:
        slot_key = (
            event["venue_id"],
            event["start_date"],
            str(event.get("start_time") or "00:00:00"),
        )
        canonical_id = canonical_by_slot.get(slot_key)
        if canonical_id != event["id"]:
            continue

        venue_name = venue_map[event["venue_id"]]["name"]
        current_artists = artists_by_event.get(event["id"], [])
        if not current_artists:
            parsed = parse_lineup_from_title(event.get("title"))
            if parsed:
                payload = build_artist_payload(
                    [row["name"] for row in parsed if row.get("name")],
                    parsed[0]["name"] if parsed else None,
                )
                if payload:
                    if dry_run:
                        emit(f"[DRY RUN] Event {event['id']}: backfill lineup from title")
                    else:
                        replace_event_artists(client, event["id"], payload)
                    artists_by_event[event["id"]] = payload
                    artist_updates += 1
        else:
            current_names = dedupe_ordered_names([row.get("name") for row in current_artists])
            parsed_headliner = parse_artists_from_title(event.get("title"))
            headliner_name = parsed_headliner[0] if parsed_headliner else (current_names[0] if current_names else None)
            desired_payload = build_artist_payload(current_names, headliner_name)
            existing_payload = normalize_existing_payload(current_artists, headliner_name)
            if desired_payload and existing_payload != desired_payload:
                if dry_run:
                    emit(f"[DRY RUN] Event {event['id']}: normalize lineup roles/headliner")
                else:
                    replace_event_artists(client, event["id"], desired_payload)
                artists_by_event[event["id"]] = desired_payload
                artist_updates += 1

        desc = event.get("description")
        if is_schedule_garbage(desc) or is_music_stub_or_garbage(desc):
            artist_entries = artists_by_event.get(event["id"], [])
            artist_payload = [{"name": a["name"]} for a in artist_entries if a.get("name")]
            new_desc = generate_synthetic_description(
                event.get("title") or "",
                venue_name=venue_name,
                category=(event.get("category") or "music"),
                artists=artist_payload if artist_payload else None,
            )
            if new_desc and new_desc != desc:
                if dry_run:
                    emit(f"[DRY RUN] Event {event['id']}: replace garbage description")
                else:
                    client.table("events").update({"description": new_desc}).eq("id", event["id"]).execute()
                description_updates += 1

    emit("\nSummary")
    emit(f"- canonical_event_id updates: {canonical_updates}")
    emit(f"- canonical_event_id resets: {canonical_resets}")
    emit(f"- lineup updates: {artist_updates}")
    emit(f"- description repairs: {description_updates}")

    return {
        "scanned_events": len(events),
        "duplicate_slot_groups": len(duplicate_groups),
        "canonical_updates": canonical_updates,
        "canonical_resets": canonical_resets,
        "lineup_updates": artist_updates,
        "description_repairs": description_updates,
        "deleted": 0,
        "dry_run": dry_run,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="One-time music venue data quality repair")
    parser.add_argument(
        "--venue-slugs",
        nargs="+",
        default=["the-eastern", "the-earl"],
        help="Venue slugs to repair",
    )
    parser.add_argument(
        "--from-date",
        default=str(date.today()),
        help="Only process events on/after this date (YYYY-MM-DD)",
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Write changes. Default is dry-run.",
    )
    args = parser.parse_args()

    run_music_venue_quality_fix(
        venue_slugs=args.venue_slugs,
        from_date=args.from_date,
        dry_run=not args.apply,
        verbose=True,
    )


if __name__ == "__main__":
    main()
