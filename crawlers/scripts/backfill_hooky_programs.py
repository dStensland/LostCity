#!/usr/bin/env python3
"""
Backfill Atlanta Families program rows from existing event-shaped family inventory.

Usage:
    python3 scripts/backfill_hooky_programs.py
    python3 scripts/backfill_hooky_programs.py --apply
    python3 scripts/backfill_hooky_programs.py --apply --source-slugs club-scikidz-atlanta,the-coder-school
"""

from __future__ import annotations

import argparse
import logging
import os
import re
import sys
from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal
from typing import Any, Iterable, Optional

import psycopg2
from psycopg2.extras import RealDictCursor

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config import get_config, set_database_target  # noqa: E402
from db import (  # noqa: E402
    configure_write_mode,
    generate_program_hash,
    infer_cost_period,
    infer_program_type,
    infer_season,
    insert_program,
)

logger = logging.getLogger(__name__)

DEFAULT_SOURCE_SLUGS = [
    "club-scikidz-atlanta",
    "the-coder-school",
    "woodward-summer-camps",
    "mjcca-day-camps",
]
DEFAULT_MAX_SOURCES = 12
DEFAULT_MIN_CANDIDATES = 20
DEFAULT_PORTAL_SLUG = "atlanta-families"
NOISY_LOGGERS = ("httpx", "httpcore", "postgrest", "supabase", "httpcore.connection")

_WEEKDAY_RANGE_RE = re.compile(
    r"\b("
    r"mon(?:day)?|monday|tue(?:s|sday)?|tu|wed(?:nesday|s)?|thu(?:r|rs|rsday|sday)?|th|"
    r"fri(?:day)?|sat(?:urday)?|sun(?:day)?"
    r")\s*[-–]\s*("
    r"mon(?:day)?|monday|tue(?:s|sday)?|tu|wed(?:nesday|s)?|thu(?:r|rs|rsday|sday)?|th|"
    r"fri(?:day)?|sat(?:urday)?|sun(?:day)?"
    r")\b",
    re.IGNORECASE,
)
_WEEKDAY_TOKEN_RE = re.compile(
    r"\b("
    r"mon(?:day)?|monday|tue(?:s|sday)?|tu|wed(?:nesday|s)?|thu(?:r|rs|rsday|sday)?|th|"
    r"fri(?:day)?|sat(?:urday)?|sun(?:day)?"
    r")\b",
    re.IGNORECASE,
)
_WEEKDAY_TOKEN_MAP = {
    "mon": 1,
    "monday": 1,
    "tue": 2,
    "tues": 2,
    "tuesday": 2,
    "tu": 2,
    "wed": 3,
    "weds": 3,
    "wednesday": 3,
    "thu": 4,
    "thur": 4,
    "thurs": 4,
    "thursday": 4,
    "th": 4,
    "fri": 5,
    "friday": 5,
    "sat": 6,
    "saturday": 6,
    "sun": 7,
    "sunday": 7,
}
_TIME_RANGE_RE = re.compile(
    r"(?P<start>\d{1,2}(?::\d{2})?(?:\s*[ap]m)?)\s*(?:-|to)\s*(?P<end>\d{1,2}(?::\d{2})?\s*[ap]m)",
    re.IGNORECASE,
)


@dataclass
class BackfillStats:
    candidates: int = 0
    inserted: int = 0
    existing: int = 0
    skipped: int = 0


def _connect():
    cfg = get_config()
    database_url = cfg.database.active_database_url
    if not database_url:
        raise RuntimeError(f"Missing database URL for target '{cfg.database.active_target}'")
    return psycopg2.connect(database_url)


def _parse_source_slugs(raw: Optional[str]) -> list[str]:
    if not raw:
        return []
    return [slug.strip() for slug in raw.split(",") if slug.strip()]


def _discover_candidate_source_slugs(
    portal_slug: str = DEFAULT_PORTAL_SLUG,
    max_sources: int = DEFAULT_MAX_SOURCES,
    min_candidates: int = DEFAULT_MIN_CANDIDATES,
) -> list[str]:
    with _connect() as conn, conn.cursor() as cur:
        cur.execute(
            """
            with family_portal as (
              select id
              from portals
              where slug = %s
            ),
            future_family_events as (
              select
                e.source_id,
                count(*) as event_count,
                count(
                  distinct md5(
                    lower(btrim(e.title)) || '|' || e.venue_id::text || '|' || e.start_date::text
                  )
                ) as candidate_program_count
              from events e
              where e.portal_id = (select id from family_portal)
                and coalesce(e.is_active, true) = true
                and e.start_date >= current_date
                and e.venue_id is not null
                and (e.age_min is not null or e.age_max is not null)
              group by e.source_id
            ),
            existing_programs as (
              select
                p.source_id,
                count(*) as program_count
              from programs p
              where p.portal_id = (select id from family_portal)
                and p.status = 'active'
              group by p.source_id
            )
            select s.slug
            from future_family_events f
            join sources s on s.id = f.source_id
            left join existing_programs p on p.source_id = f.source_id
            where f.candidate_program_count >= %s
              and f.candidate_program_count > coalesce(p.program_count, 0)
            order by
              (f.candidate_program_count - coalesce(p.program_count, 0)) desc,
              f.candidate_program_count desc,
              f.event_count desc,
              s.slug asc
            limit %s
            """,
            (portal_slug, min_candidates, max_sources),
        )
        return [row[0] for row in cur.fetchall()]


def _weekday_value(token: str) -> Optional[int]:
    return _WEEKDAY_TOKEN_MAP.get(str(token).strip().lower())


def _schedule_days_from_text(parts: Iterable[Any]) -> Optional[list[int]]:
    combined = " ".join(str(part) for part in parts if part).lower()
    if not combined:
        return None

    days: set[int] = set()

    for match in _WEEKDAY_RANGE_RE.finditer(combined):
        start = _weekday_value(match.group(1))
        end = _weekday_value(match.group(2))
        if not start or not end:
            continue
        if start <= end:
            days.update(range(start, end + 1))
        else:
            days.update(range(start, 8))
            days.update(range(1, end + 1))

    for token in _WEEKDAY_TOKEN_RE.findall(combined):
        day = _weekday_value(token)
        if day:
            days.add(day)

    return sorted(days) if days else None


def _schedule_days_from_span(
    start_date: Optional[date],
    end_date: Optional[date],
) -> Optional[list[int]]:
    if not start_date:
        return None
    if not end_date or end_date < start_date:
        return None

    span_days = (end_date - start_date).days
    if span_days < 0 or span_days > 6:
        return None

    return sorted(
        {
            (start_date.fromordinal(start_date.toordinal() + offset)).isoweekday()
            for offset in range(span_days + 1)
        }
    )


def _schedule_days(
    start_date: Optional[date],
    end_date: Optional[date],
    tags: Iterable[str] | None,
    *text_parts: Any,
) -> Optional[list[int]]:
    explicit_days = _schedule_days_from_text(text_parts)
    if explicit_days:
        return explicit_days

    tag_set = {str(tag).lower() for tag in (tags or [])}
    if "weekly" not in tag_set or not start_date:
        return _schedule_days_from_span(start_date, end_date)
    return [start_date.isoweekday()]


def _normalize_time_value(raw: str, fallback_ampm: Optional[str] = None) -> Optional[str]:
    cleaned = str(raw or "").strip().lower().replace(".", "")
    match = re.match(r"(?P<hour>\d{1,2})(?::(?P<minute>\d{2}))?\s*(?P<ampm>[ap]m)?", cleaned)
    if not match:
        return None

    hour = int(match.group("hour"))
    minute = int(match.group("minute") or "00")
    ampm = match.group("ampm") or (fallback_ampm.lower() if fallback_ampm else None)
    if not ampm:
        return None
    if match.group("ampm") is None and fallback_ampm and fallback_ampm.lower() == "pm" and hour < 12:
        ampm = "am"
    if ampm == "pm" and hour != 12:
        hour += 12
    if ampm == "am" and hour == 12:
        hour = 0
    return f"{hour:02d}:{minute:02d}:00"


def _schedule_time_range(*text_parts: Any) -> tuple[Optional[str], Optional[str]]:
    combined = " ".join(str(part) for part in text_parts if part)
    if not combined:
        return None, None

    explicit_patterns = (
        r"full\s*day[^.]*?(?P<start>\d{1,2}(?::\d{2})?\s*[ap]m)\s*(?:-|to)\s*(?P<end>\d{1,2}(?::\d{2})?\s*[ap]m)",
        r"monday\s*-\s*friday[^.]*?(?P<start>\d{1,2}(?::\d{2})?\s*[ap]m)\s*(?:-|to)\s*(?P<end>\d{1,2}(?::\d{2})?\s*[ap]m)",
        r"our week is[^.]*?(?P<start>\d{1,2}(?::\d{2})?\s*[ap]m)\s*(?:-|to)\s*(?P<end>\d{1,2}(?::\d{2})?\s*[ap]m)",
    )
    for pattern in explicit_patterns:
        match = re.search(pattern, combined, re.IGNORECASE)
        if match:
            end_ampm = re.search(r"([ap]m)", match.group("end"), re.IGNORECASE)
            fallback_ampm = end_ampm.group(1) if end_ampm else None
            return _normalize_time_value(match.group("start"), fallback_ampm), _normalize_time_value(match.group("end"))

    match = _TIME_RANGE_RE.search(combined)
    if not match:
        return None, None
    end_ampm = re.search(r"([ap]m)", match.group("end"), re.IGNORECASE)
    fallback_ampm = end_ampm.group(1) if end_ampm else None
    return _normalize_time_value(match.group("start"), fallback_ampm), _normalize_time_value(match.group("end"))


def _normalize_decimal(value: Any) -> Optional[float]:
    if value is None:
        return None
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, (int, float)):
        return float(value)
    return None


def build_program_record(event_row: dict[str, Any]) -> Optional[dict[str, Any]]:
    venue_id = event_row.get("place_id") or event_row.get("venue_id")
    title = (event_row.get("title") or "").strip()
    if not venue_id or not title:
        return None

    tags = event_row.get("tags") or []
    session_start = event_row.get("start_date")
    if not session_start:
        return None

    if isinstance(session_start, datetime):
        session_start = session_start.date()

    session_end = event_row.get("end_date")
    if isinstance(session_end, datetime):
        session_end = session_end.date()

    price_min = _normalize_decimal(event_row.get("price_min"))
    price_max = _normalize_decimal(event_row.get("price_max"))
    cost_amount = price_min if price_min is not None else price_max
    registration_url = event_row.get("ticket_url") or event_row.get("source_url")
    price_note = event_row.get("price_note")
    title_and_tags = " ".join([title] + [str(tag) for tag in tags])
    schedule_start_time = (
        event_row.get("start_time").strftime("%H:%M:%S")
        if event_row.get("start_time")
        else None
    )
    schedule_end_time = (
        event_row.get("end_time").strftime("%H:%M:%S")
        if event_row.get("end_time")
        else None
    )
    if not schedule_start_time or not schedule_end_time:
        inferred_start_time, inferred_end_time = _schedule_time_range(
            title,
            event_row.get("description"),
            price_note,
        )
        schedule_start_time = schedule_start_time or inferred_start_time
        schedule_end_time = schedule_end_time or inferred_end_time

    record = {
        "portal_id": event_row.get("portal_id") or event_row.get("owner_portal_id"),
        "source_id": event_row.get("source_id"),
        "place_id": venue_id,
        "name": title,
        "description": event_row.get("description"),
        "program_type": infer_program_type(title, section_name=title_and_tags),
        "provider_name": event_row.get("source_name"),
        "age_min": event_row.get("age_min"),
        "age_max": event_row.get("age_max"),
        "season": infer_season(title, session_start=session_start),
        "session_start": session_start.isoformat(),
        "session_end": session_end.isoformat() if session_end else None,
        "schedule_days": _schedule_days(
            session_start,
            session_end,
            tags,
            title,
            event_row.get("description"),
            price_note,
        ),
        "schedule_start_time": schedule_start_time,
        "schedule_end_time": schedule_end_time,
        "cost_amount": cost_amount,
        "cost_period": infer_cost_period(price_note),
        "cost_notes": price_note,
        "registration_status": "open" if registration_url else "unknown",
        "registration_url": registration_url,
        "tags": tags,
        "status": "active",
        "metadata": {
            "backfilled_from_event_id": event_row.get("event_id"),
            "backfilled_from_event_hash": event_row.get("content_hash"),
            "backfill_source_slug": event_row.get("source_slug"),
        },
        "_venue_name": event_row.get("venue_name") or "venue",
    }
    return record


def _fetch_candidate_events(
    portal_slug: str,
    source_slugs: list[str],
    per_source_limit: int,
) -> list[dict[str, Any]]:
    with _connect() as conn, conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(
            """
            with ranked as (
              select
                e.id as event_id,
                e.source_id,
                s.slug as source_slug,
                s.name as source_name,
                s.owner_portal_id,
                e.portal_id,
                e.venue_id,
                v.name as venue_name,
                e.title,
                e.description,
                e.start_date,
                e.end_date,
                e.start_time,
                e.end_time,
                e.age_min,
                e.age_max,
                e.price_min,
                e.price_max,
                e.price_note,
                e.tags,
                e.source_url,
                e.ticket_url,
                e.content_hash,
                row_number() over (partition by s.slug order by e.start_date, e.start_time nulls first, e.id) as rn
              from events e
              join sources s on s.id = e.source_id
              join portals p on p.id = s.owner_portal_id
              left join venues v on v.id = e.venue_id
              where p.slug = %s
                and s.slug = any(%s)
                and e.start_date >= current_date
                and coalesce(e.is_active, true) = true
                and e.venue_id is not null
                and (e.age_min is not null or e.age_max is not null)
            )
            select *
            from ranked
            where rn <= %s
            order by source_slug, start_date, start_time nulls first, event_id
            """,
            (portal_slug, source_slugs, per_source_limit),
        )
        return [dict(row) for row in cur.fetchall()]


def _fetch_existing_program_hashes(content_hashes: Iterable[str]) -> set[str]:
    hashes = [content_hash for content_hash in content_hashes if content_hash]
    if not hashes:
        return set()

    with _connect() as conn, conn.cursor() as cur:
        cur.execute(
            """
            select metadata->>'content_hash' as content_hash
            from programs
            where status = 'active'
              and metadata ? 'content_hash'
              and metadata->>'content_hash' = any(%s)
            """,
            (hashes,),
        )
        return {row[0] for row in cur.fetchall() if row[0]}


def backfill_hooky_programs(
    portal_slug: str,
    source_slugs: list[str],
    per_source_limit: int,
    apply: bool,
) -> BackfillStats:
    configure_write_mode(apply, "" if apply else "dry-run")
    stats = BackfillStats()

    candidate_events = _fetch_candidate_events(portal_slug, source_slugs, per_source_limit)
    logger.info("Loaded %d candidate family events across %d sources", len(candidate_events), len(source_slugs))
    if not candidate_events and portal_slug == DEFAULT_PORTAL_SLUG:
        logger.warning(
            "No candidate family events found for %s. Live Family inventory may still be owned by the legacy 'hooky' portal slug.",
            portal_slug,
        )

    candidate_programs: list[tuple[dict[str, Any], dict[str, Any], str]] = []
    candidate_hashes: list[str] = []
    for row in candidate_events:
        program_record = build_program_record(row)
        if not program_record:
            stats.candidates += 1
            stats.skipped += 1
            continue

        content_hash = generate_program_hash(
            program_record["name"],
            program_record.get("place_id") or program_record.get("venue_id"),
            program_record["session_start"],
        )
        candidate_programs.append((row, program_record, content_hash))
        candidate_hashes.append(content_hash)

    existing_hashes = _fetch_existing_program_hashes(candidate_hashes)
    logger.info(
        "Prefetched %d existing %s program hashes across %d candidate program records",
        len(existing_hashes),
        portal_slug,
        len(candidate_programs),
    )

    for row, program_record, content_hash in candidate_programs:
        stats.candidates += 1
        if content_hash in existing_hashes:
            if apply:
                result = insert_program(program_record)
                if result:
                    stats.existing += 1
                    logger.info(
                        "updated existing program: source=%s event_id=%s name=%s",
                        row["source_slug"],
                        row["event_id"],
                        row["title"][:80],
                    )
                else:
                    stats.skipped += 1
                continue
            stats.existing += 1
            logger.debug(
                "existing program: source=%s event_id=%s name=%s",
                row["source_slug"],
                row["event_id"],
                row["title"][:80],
            )
            continue

        if not apply:
            stats.inserted += 1
            logger.debug(
                "would insert program: source=%s event_id=%s name=%s",
                row["source_slug"],
                row["event_id"],
                row["title"][:80],
            )
            continue

        result = insert_program(program_record)
        if result:
            stats.inserted += 1
            existing_hashes.add(content_hash)
            logger.info(
                "inserted program: source=%s event_id=%s name=%s",
                row["source_slug"],
                row["event_id"],
                row["title"][:80],
            )
        else:
            stats.skipped += 1

    return stats


def _configure_logging() -> None:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
    for logger_name in NOISY_LOGGERS:
        logging.getLogger(logger_name).setLevel(logging.WARNING)


def main() -> None:
    parser = argparse.ArgumentParser(description="Backfill Atlanta Families program rows from family events.")
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Persist changes to the database (default is dry-run mode).",
    )
    parser.add_argument(
        "--db-target",
        choices=("production", "staging"),
        default="production",
        help="Database target environment.",
    )
    parser.add_argument(
        "--source-slugs",
        help="Comma-separated list of family source slugs to backfill.",
    )
    parser.add_argument(
        "--portal-slug",
        default=DEFAULT_PORTAL_SLUG,
        help="Portal slug to target for Family program backfill.",
    )
    parser.add_argument(
        "--max-sources",
        type=int,
        default=DEFAULT_MAX_SOURCES,
        help="When source slugs are omitted, auto-select up to this many Family sources.",
    )
    parser.add_argument(
        "--min-candidates",
        type=int,
        default=DEFAULT_MIN_CANDIDATES,
        help="Minimum future age-banded event rows required for auto-selected sources.",
    )
    parser.add_argument(
        "--per-source-limit",
        type=int,
        default=75,
        help="Maximum event-shaped rows to inspect per source.",
    )
    args = parser.parse_args()

    _configure_logging()
    set_database_target(args.db_target)

    slugs = _parse_source_slugs(args.source_slugs)
    if not slugs:
        slugs = _discover_candidate_source_slugs(
            portal_slug=args.portal_slug,
            max_sources=args.max_sources,
            min_candidates=args.min_candidates,
        )
    if not slugs:
        slugs = list(DEFAULT_SOURCE_SLUGS)

    logger.info("%s source scope: %s", args.portal_slug, ", ".join(slugs))
    stats = backfill_hooky_programs(
        portal_slug=args.portal_slug,
        source_slugs=slugs,
        per_source_limit=args.per_source_limit,
        apply=args.apply,
    )

    logger.info(
        "[%s] candidates=%d inserted=%d existing=%d skipped=%d",
        "APPLIED" if args.apply else "DRY RUN",
        stats.candidates,
        stats.inserted,
        stats.existing,
        stats.skipped,
    )


if __name__ == "__main__":
    main()
