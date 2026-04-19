"""
Shared screening storage helpers.

This gives crawler sources a first-class additive persistence path for movie and
screening-style inventory instead of treating every showing as only an event row.
"""

from __future__ import annotations

import logging
import re
from datetime import datetime
from typing import Any, Optional

from posters import extract_film_info, fetch_film_metadata

from db.client import (
    _log_write_skip,
    get_client,
    retry_on_network_error,
    screenings_support_tables,
    writes_enabled,
    _error_indicates_missing_relation,
)

logger = logging.getLogger(__name__)

_TITLE_COLUMNS = {
    "source_key",
    "canonical_title",
    "slug",
    "kind",
    "poster_image_url",
    "synopsis",
    "genres",
    "tmdb_id",
    "imdb_id",
    "festival_work_key",
    "director",
    "runtime_minutes",
    "year",
    "rating",
}

_RUN_COLUMNS = {
    "source_key",
    "screening_title_id",
    "place_id",
    "festival_id",
    "source_id",
    "label",
    "start_date",
    "end_date",
    "buy_url",
    "info_url",
    "is_special_event",
    "metadata",
    "screen_name",
}

_TIME_COLUMNS = {
    "source_key",
    "screening_run_id",
    "event_id",
    "start_date",
    "start_time",
    "end_time",
    "ticket_url",
    "source_url",
    "format_labels",
    "status",
}

_FORMAT_SUFFIX_RE = re.compile(
    r"\s*(?:\(|-|:)?\s*(?:digital(?:\s*\+\s*35mm)?|imax|3d|dolby|atmos|4dx|35mm|70mm|the mike|the lefont|the rej)\s*\)?$",
    re.IGNORECASE,
)
_TITLE_YEAR_RE = re.compile(r"\s*\((?:19|20)\d{2}\)\s*$")


def _slugify(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")


def _normalize_title_key(title: str) -> str:
    cleaned = _TITLE_YEAR_RE.sub("", title.strip())
    cleaned = _FORMAT_SUFFIX_RE.sub("", cleaned)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned.lower()


def _clean_title(title: str, *, is_special_event: bool) -> str:
    cleaned = title.strip()
    if not is_special_event:
        cleaned = _TITLE_YEAR_RE.sub("", cleaned)
        cleaned = _FORMAT_SUFFIX_RE.sub("", cleaned)
    cleaned = re.sub(r"\s+", " ", cleaned).strip(" -:")
    return cleaned or title.strip()


def _collect_format_labels(tags: list[str] | None) -> list[str]:
    labels: list[str] = []
    for tag in tags or []:
        normalized = str(tag).strip().lower()
        if normalized == "imax" and "IMAX" not in labels:
            labels.append("IMAX")
        elif normalized == "3d" and "3D" not in labels:
            labels.append("3D")
        elif normalized == "35mm" and "35mm" not in labels:
            labels.append("35mm")
        elif normalized == "70mm" and "70mm" not in labels:
            labels.append("70mm")
        elif normalized in {"captioned", "open_caption"} and "Captioned" not in labels:
            labels.append("Captioned")
    return labels


def _infer_kind(event: dict[str, Any], is_special_event: bool) -> str:
    if event.get("category_id") == "film":
        return "film"
    if event.get("festival_id") and is_special_event:
        return "festival_screening_block"
    return "screening_program"


def entries_to_event_like_rows(
    entries: list[dict[str, Any]],
    default_tags: list[str] | None = None,
) -> list[dict[str, Any]]:
    """Convert screening entries to event-like dicts for build_screening_bundle_from_event_rows.

    Crawlers accumulate entry dicts during extraction (title, date, time, image, etc.).
    This helper maps them to the shape expected by the bundle builder, which was
    originally designed for actual event rows from the database.
    """
    rows: list[dict[str, Any]] = []
    for entry in entries:
        rows.append({
            "id": None,
            "title": entry["title"],
            "start_date": entry["start_date"],
            "start_time": entry.get("start_time"),
            "end_time": entry.get("end_time"),
            "image_url": entry.get("image_url"),
            "source_url": entry.get("source_url"),
            "ticket_url": entry.get("ticket_url"),
            "description": entry.get("description"),
            "tags": entry.get("tags", default_tags or ["film", "cinema", "showtime"]),
            "category_id": entry.get("category_id", "film"),
            "place_id": entry.get("place_id"),
            "festival_id": entry.get("festival_id"),
            "director": entry.get("director"),
            "runtime_minutes": entry.get("runtime_minutes"),
            "year": entry.get("year"),
            "rating": entry.get("rating"),
            "screen_name": entry.get("screen_name"),
        })
    return rows


def build_screening_bundle_from_event_rows(
    *,
    source_id: int,
    source_slug: str,
    events: list[dict[str, Any]],
) -> dict[str, Any]:
    titles_by_key: dict[str, dict[str, Any]] = {}
    runs_by_key: dict[str, dict[str, Any]] = {}
    times_by_key: dict[str, dict[str, Any]] = {}

    for event in events:
        tags = [str(tag).strip().lower() for tag in (event.get("tags") or []) if str(tag).strip()]
        is_special_event = "showtime" not in tags
        canonical_title = _clean_title(
            str(event.get("title") or "").strip(),
            is_special_event=is_special_event,
        )
        if not canonical_title:
            continue

        title_key = _normalize_title_key(canonical_title) or _slugify(canonical_title)
        title_source_key = f"{source_slug}|title|{title_key}"
        run_scope = f"place:{event.get('place_id')}" if event.get("place_id") else f"festival:{event.get('festival_id') or 'unknown'}"
        screen_name = event.get("screen_name")
        screen_suffix = f"|screen:{screen_name}" if screen_name else ""
        run_source_key = f"{source_slug}|run|{title_key}|{run_scope}{screen_suffix}"

        title_row = titles_by_key.get(title_source_key)
        if not title_row:
            title_row = {
                "source_key": title_source_key,
                "canonical_title": canonical_title,
                "slug": _slugify(canonical_title),
                "kind": _infer_kind(event, is_special_event),
                "poster_image_url": event.get("image_url"),
                "synopsis": event.get("description"),
                "genres": [],
                "tmdb_id": event.get("tmdb_id"),
                "imdb_id": event.get("imdb_id"),
                "festival_work_key": event.get("festival_work_key"),
                "director": event.get("director"),
                "runtime_minutes": event.get("runtime_minutes"),
                "year": event.get("year"),
                "rating": event.get("rating"),
            }
            titles_by_key[title_source_key] = title_row
        else:
            title_row["poster_image_url"] = title_row.get("poster_image_url") or event.get("image_url")
            title_row["synopsis"] = title_row.get("synopsis") or event.get("description")

        run_row = runs_by_key.get(run_source_key)
        if not run_row:
            # Stash per-event category/subcategory/tags in metadata so
            # derive_run_event_from_screening can propagate them to the event row
            # instead of hardcoding "film". Crawlers that don't set these
            # fields fall back to the film defaults.
            run_metadata = {"source_slug": source_slug}
            event_category = event.get("category_id") or event.get("category")
            if event_category and event_category != "film":
                run_metadata["category_id"] = event_category
            event_subcategory = event.get("subcategory")
            if event_subcategory and event_subcategory != "cinema":
                run_metadata["subcategory"] = event_subcategory
            event_tags_raw = event.get("tags")
            if event_tags_raw:
                run_metadata["tags"] = list(event_tags_raw)

            run_row = {
                "source_key": run_source_key,
                "title_source_key": title_source_key,
                "place_id": event.get("place_id"),
                "festival_id": event.get("festival_id"),
                "source_id": source_id,
                "label": canonical_title,
                "start_date": event.get("start_date"),
                "end_date": event.get("start_date"),
                "buy_url": event.get("ticket_url"),
                "info_url": event.get("source_url"),
                "is_special_event": is_special_event,
                "metadata": run_metadata,
                "screen_name": screen_name,
            }
            runs_by_key[run_source_key] = run_row
        else:
            if event.get("start_date") and event["start_date"] < run_row["start_date"]:
                run_row["start_date"] = event["start_date"]
            if event.get("start_date") and event["start_date"] > run_row["end_date"]:
                run_row["end_date"] = event["start_date"]
            run_row["buy_url"] = run_row.get("buy_url") or event.get("ticket_url")
            run_row["info_url"] = run_row.get("info_url") or event.get("source_url")
            run_row["is_special_event"] = bool(run_row["is_special_event"] or is_special_event)

        if not event.get("start_time"):
            continue

        time_source_key = (
            f"{source_slug}|time|{run_source_key}|{event.get('start_date')}|"
            f"{event.get('start_time')}|{event.get('id')}"
        )
        times_by_key[time_source_key] = {
            "source_key": time_source_key,
            "run_source_key": run_source_key,
            "event_id": event.get("id"),
            "start_date": event.get("start_date"),
            "start_time": event.get("start_time"),
            "end_time": event.get("end_time"),
            "ticket_url": event.get("ticket_url"),
            "source_url": event.get("source_url"),
            "format_labels": _collect_format_labels(tags),
            "status": "scheduled",
        }

    return {
        "source_id": source_id,
        "source_slug": source_slug,
        "titles": list(titles_by_key.values()),
        "runs": list(runs_by_key.values()),
        "times": list(times_by_key.values()),
    }


@retry_on_network_error(max_retries=4, base_delay=0.5)
def _select_id_by_source_key(table: str, source_key: str) -> Optional[str]:
    result = (
        get_client()
        .table(table)
        .select("id")
        .eq("source_key", source_key)
        .limit(1)
        .execute()
    )
    rows = result.data or []
    return rows[0]["id"] if rows else None


@retry_on_network_error(max_retries=4, base_delay=0.5)
def _upsert_table_row(table: str, row: dict[str, Any]):
    return get_client().table(table).upsert(row, on_conflict="source_key").execute()


@retry_on_network_error(max_retries=4, base_delay=0.5)
def _delete_rows_by_ids(table: str, ids: list[str]) -> None:
    get_client().table(table).delete().in_("id", ids).execute()


@retry_on_network_error(max_retries=4, base_delay=0.5)
def _select_runs_for_source(source_id: int) -> list[dict[str, Any]]:
    result = (
        get_client()
        .table("screening_runs")
        .select("id,source_key,screening_title_id")
        .eq("source_id", source_id)
        .execute()
    )
    return result.data or []


@retry_on_network_error(max_retries=4, base_delay=0.5)
def _select_times_for_run_ids(run_ids: list[str]) -> list[dict[str, Any]]:
    if not run_ids:
        return []
    result = (
        get_client()
        .table("screening_times")
        .select("id,source_key,screening_run_id")
        .in_("screening_run_id", run_ids)
        .execute()
    )
    return result.data or []


@retry_on_network_error(max_retries=4, base_delay=0.5)
def _select_titles_for_source_slug(source_slug: str) -> list[dict[str, Any]]:
    result = (
        get_client()
        .table("screening_titles")
        .select("id,source_key")
        .like("source_key", f"{source_slug}|%")
        .execute()
    )
    return result.data or []


@retry_on_network_error(max_retries=4, base_delay=0.5)
def _select_event_rows_for_screenings(source_id: int) -> list[dict[str, Any]]:
    today = datetime.now().strftime("%Y-%m-%d")
    result = (
        get_client()
        .table("events")
        .select(
            "id,title,description,start_date,start_time,end_time,image_url,source_url,ticket_url,tags,category_id,place_id,festival_id",
        )
        .eq("source_id", source_id)
        .eq("is_active", True)
        .eq("category_id", "film")
        .gte("start_date", today)
        .order("start_date", desc=False)
        .execute()
    )
    return result.data or []


def _enrich_title_from_omdb(row: dict[str, Any]) -> dict[str, Any]:
    """Enrich a screening title row with OMDB metadata if fields are missing."""
    if row.get("director") and row.get("runtime_minutes") and row.get("year"):
        return row
    canonical_title = row.get("canonical_title") or ""
    if not canonical_title:
        return row
    try:
        film_title, year_str = extract_film_info(canonical_title)
        if not film_title:
            film_title = canonical_title
        metadata = fetch_film_metadata(film_title, year_str)
        if metadata:
            if not row.get("director") and metadata.director:
                row["director"] = metadata.director
            if not row.get("runtime_minutes") and metadata.runtime_minutes:
                row["runtime_minutes"] = metadata.runtime_minutes
            if not row.get("year") and metadata.year:
                row["year"] = metadata.year
            if not row.get("rating") and metadata.rating:
                row["rating"] = metadata.rating
            if not row.get("genres") and metadata.genres:
                row["genres"] = metadata.genres
            if not row.get("poster_image_url") and metadata.poster_url:
                row["poster_image_url"] = metadata.poster_url
            if not row.get("synopsis") and metadata.plot:
                row["synopsis"] = metadata.plot
            logger.info("OMDB enriched: %s (dir=%s, year=%s)", canonical_title, metadata.director, metadata.year)
    except Exception as exc:
        logger.debug("OMDB enrichment failed for %s: %s", canonical_title, exc)
    return row


def upsert_screening_title(record: dict[str, Any]) -> Optional[str]:
    if not screenings_support_tables():
        return None

    row = {key: value for key, value in record.items() if key in _TITLE_COLUMNS}
    if not row.get("source_key"):
        logger.warning("upsert_screening_title: missing source_key")
        return None

    row = _enrich_title_from_omdb(row)

    if not writes_enabled():
        _log_write_skip(f"upsert screening_titles source_key={row['source_key']}")
        return row["source_key"]

    _upsert_table_row("screening_titles", row)
    return _select_id_by_source_key("screening_titles", row["source_key"])


def upsert_screening_run(record: dict[str, Any]) -> Optional[str]:
    if not screenings_support_tables():
        return None

    row = {key: value for key, value in record.items() if key in _RUN_COLUMNS}
    if not row.get("source_key") or not row.get("screening_title_id"):
        logger.warning("upsert_screening_run: missing source_key or screening_title_id")
        return None

    if not writes_enabled():
        _log_write_skip(f"upsert screening_runs source_key={row['source_key']}")
        return row["source_key"]

    _upsert_table_row("screening_runs", row)
    return _select_id_by_source_key("screening_runs", row["source_key"])


def upsert_screening_time(record: dict[str, Any]) -> Optional[str]:
    if not screenings_support_tables():
        return None

    row = {key: value for key, value in record.items() if key in _TIME_COLUMNS}
    if not row.get("source_key") or not row.get("screening_run_id"):
        logger.warning("upsert_screening_time: missing source_key or screening_run_id")
        return None

    if not writes_enabled():
        _log_write_skip(f"upsert screening_times source_key={row['source_key']}")
        return row["source_key"]

    _upsert_table_row("screening_times", row)
    return _select_id_by_source_key("screening_times", row["source_key"])


def remove_stale_source_screenings(
    *,
    source_id: int,
    source_slug: str,
    seen_time_source_keys: set[str],
    seen_run_source_keys: set[str],
    seen_title_source_keys: set[str],
) -> dict[str, int]:
    if not screenings_support_tables():
        return {"times_deleted": 0, "runs_deleted": 0, "titles_deleted": 0}

    runs = _select_runs_for_source(source_id)
    run_ids = [row["id"] for row in runs]
    times = _select_times_for_run_ids(run_ids)

    stale_time_ids = [
        row["id"]
        for row in times
        if row.get("source_key") not in seen_time_source_keys
    ]
    if stale_time_ids and writes_enabled():
        _delete_rows_by_ids("screening_times", stale_time_ids)

    stale_run_ids = [
        row["id"]
        for row in runs
        if row.get("source_key") not in seen_run_source_keys
    ]
    if stale_run_ids and writes_enabled():
        _delete_rows_by_ids("screening_runs", stale_run_ids)

    remaining_title_ids = {
        row.get("screening_title_id")
        for row in _select_runs_for_source(source_id)
        if row.get("screening_title_id")
    }
    stale_title_ids = [
        row["id"]
        for row in _select_titles_for_source_slug(source_slug)
        if row.get("source_key") not in seen_title_source_keys
        and row.get("id") not in remaining_title_ids
    ]
    if stale_title_ids and writes_enabled():
        _delete_rows_by_ids("screening_titles", stale_title_ids)

    return {
        "times_deleted": len(stale_time_ids),
        "runs_deleted": len(stale_run_ids),
        "titles_deleted": len(stale_title_ids),
    }


def persist_screening_bundle(bundle: dict[str, Any]) -> dict[str, Any]:
    if not screenings_support_tables():
        return {"persisted": 0, "skipped": 0, "unsupported": True}

    title_ids_by_key: dict[str, str] = {}
    run_ids_by_key: dict[str, str] = {}
    persisted = 0
    skipped = 0

    titles = bundle.get("titles") or []
    runs = bundle.get("runs") or []
    times = bundle.get("times") or []

    for title in titles:
        title_id = upsert_screening_title(title)
        if title_id:
            title_ids_by_key[title["source_key"]] = title_id
            persisted += 1
        else:
            skipped += 1

    for run in runs:
        title_id = title_ids_by_key.get(run.get("title_source_key"))
        if not title_id:
            skipped += 1
            continue
        run_id = upsert_screening_run(
            {
                **run,
                "screening_title_id": title_id,
            }
        )
        if run_id:
            run_ids_by_key[run["source_key"]] = run_id
            persisted += 1
        else:
            skipped += 1

    for time in times:
        run_id = run_ids_by_key.get(time.get("run_source_key"))
        if not run_id:
            skipped += 1
            continue
        time_id = upsert_screening_time(
            {
                **time,
                "screening_run_id": run_id,
            }
        )
        if time_id:
            persisted += 1
        else:
            skipped += 1

    cleanup = remove_stale_source_screenings(
        source_id=bundle["source_id"],
        source_slug=bundle["source_slug"],
        seen_time_source_keys={row["source_key"] for row in times},
        seen_run_source_keys={row["source_key"] for row in runs},
        seen_title_source_keys={row["source_key"] for row in titles},
    )

    return {
        "persisted": persisted,
        "skipped": skipped,
        "cleanup": cleanup,
        "titles": len(titles),
        "runs": len(runs),
        "times": len(times),
    }


def sync_source_screenings_from_events(
    *,
    source_id: int,
    source_slug: str,
) -> dict[str, Any]:
    if not screenings_support_tables():
        return {"persisted": 0, "skipped": 0, "unsupported": True}

    events = _select_event_rows_for_screenings(source_id)
    bundle = build_screening_bundle_from_event_rows(
        source_id=source_id,
        source_slug=source_slug,
        events=events,
    )
    return persist_screening_bundle(bundle)


# ---------------------------------------------------------------------------
# Screening-primary: derive events FROM screening tables (inverse direction)
# ---------------------------------------------------------------------------

_HAS_SCREENING_RUN_ID_COLUMN: bool | None = None


def _events_support_screening_run_id() -> bool:
    """Check if events table has screening_run_id column."""
    global _HAS_SCREENING_RUN_ID_COLUMN
    if _HAS_SCREENING_RUN_ID_COLUMN is not None:
        return _HAS_SCREENING_RUN_ID_COLUMN
    try:
        get_client().table("events").select("screening_run_id").limit(1).execute()
        _HAS_SCREENING_RUN_ID_COLUMN = True
    except Exception as exc:
        if _error_indicates_missing_relation(exc):
            _HAS_SCREENING_RUN_ID_COLUMN = False
        else:
            raise
    return _HAS_SCREENING_RUN_ID_COLUMN


@retry_on_network_error(max_retries=4, base_delay=0.5)
def _select_screening_runs_with_context(source_id: int) -> list[dict[str, Any]]:
    """Fetch runs + title + times for a source, ready for event derivation."""
    today = datetime.now().strftime("%Y-%m-%d")
    runs = (
        get_client()
        .table("screening_runs")
        .select(
            "id,source_key,screening_title_id,place_id,festival_id,source_id,"
            "label,start_date,end_date,buy_url,info_url,is_special_event,metadata,"
            "screening_titles(id,canonical_title,poster_image_url,synopsis,genres,slug)"
        )
        .eq("source_id", source_id)
        .gte("end_date", today)
        .execute()
    )
    return runs.data or []


@retry_on_network_error(max_retries=4, base_delay=0.5)
def _select_times_for_run(run_id: str) -> list[dict[str, Any]]:
    """Fetch screening_times for a specific run."""
    result = (
        get_client()
        .table("screening_times")
        .select("id,source_key,start_date,start_time,end_time,ticket_url,source_url,event_id")
        .eq("screening_run_id", run_id)
        .order("start_date", desc=False)
        .order("start_time", desc=False)
        .execute()
    )
    return result.data or []


@retry_on_network_error(max_retries=4, base_delay=0.5)
def _update_screening_times_event_id(run_id: str, event_id: int) -> int:
    """Point all screening_times for a run at the derived run-level event."""
    if not writes_enabled():
        return 0
    result = (
        get_client()
        .table("screening_times")
        .update({"event_id": event_id})
        .eq("screening_run_id", run_id)
        .execute()
    )
    return len(result.data or [])


@retry_on_network_error(max_retries=4, base_delay=0.5)
def _update_event_screening_run_id(event_id: int, run_id: str) -> None:
    """Set screening_run_id on the derived event for reverse lookup."""
    if not writes_enabled() or not _events_support_screening_run_id():
        return
    get_client().table("events").update({"screening_run_id": run_id}).eq("id", event_id).execute()


@retry_on_network_error(max_retries=4, base_delay=0.5)
def _fetch_venue_name(place_id: int) -> str:
    """Fetch venue name for content hash computation."""
    result = get_client().table("places").select("name").eq("id", place_id).limit(1).execute()
    return (result.data or [{}])[0].get("name", "")


def _get_venue_name(place_id: int, cache: dict[int, str] | None = None) -> str:
    """Get venue name, using cache if provided."""
    if cache is not None and place_id in cache:
        return cache[place_id]
    try:
        name = _fetch_venue_name(place_id)
    except Exception:
        name = ""
    if cache is not None:
        cache[place_id] = name
    return name


def derive_run_event_from_screening(
    *,
    run: dict[str, Any],
    title: dict[str, Any],
    times: list[dict[str, Any]],
    venue_name_cache: dict[int, str] | None = None,
) -> Optional[int]:
    """Create or update a single event per screening_run.

    Returns the event_id of the created/updated event, or None on failure.
    The run| prefix in the content hash prevents collision with per-showtime events.
    """
    from db.events import find_event_by_hash, insert_event, smart_update_existing_event
    from dedupe import generate_content_hash

    canonical_title = title.get("canonical_title") or run.get("label") or "Unknown Film"
    place_id = run.get("place_id")
    source_id = run.get("source_id")
    run_id = run.get("id")

    if not place_id:
        logger.warning("derive_run_event: no place_id for run %s", run.get("source_key"))
        return None

    venue_name = _get_venue_name(place_id, venue_name_cache)

    # Content hash uses run| prefix to avoid collision with per-showtime hashes
    content_hash = generate_content_hash(
        canonical_title,
        venue_name,
        f"run|{run.get('source_key', '')}",
    )

    # Earliest showtime for start_time
    earliest_time = None
    start_date = run.get("start_date")
    if times:
        first_day_times = [t for t in times if t.get("start_date") == start_date and t.get("start_time")]
        if first_day_times:
            earliest_time = min(t["start_time"] for t in first_day_times)

    # Category/subcategory/tags can be overridden per-run via run.metadata.
    # Crawlers that don't set them (all pure-cinema crawlers) get the film
    # defaults. Crawlers that do (ATLFF with non-film events) carry through
    # their own taxonomy and tag taxonomy.
    run_meta = run.get("metadata") or {}
    event_category = run_meta.get("category_id") or "film"
    event_subcategory = run_meta.get("subcategory") or ("cinema" if event_category == "film" else None)
    event_tags = run_meta.get("tags") or ["film", "cinema", "showtime"]

    event_record = {
        "title": canonical_title,
        "start_date": start_date,
        "end_date": run.get("end_date"),
        "start_time": earliest_time,
        "category": event_category,
        "subcategory": event_subcategory,
        "tags": list(event_tags),
        "image_url": title.get("poster_image_url"),
        "source_url": run.get("info_url"),
        "ticket_url": run.get("buy_url"),
        "place_id": place_id,
        "source_id": source_id,
        "festival_id": run.get("festival_id"),
        "is_all_day": False,
        "content_hash": content_hash,
    }

    # Film defaults to a film series; non-film events use "other" so they
    # still cluster recurring instances (e.g., weekly Filmmaker Lounge) without
    # claiming film-series semantics.
    series_hint = {
        "series_type": "film" if event_category == "film" else "other",
        "series_title": canonical_title,
    }

    existing = find_event_by_hash(content_hash)
    if existing:
        event_id = existing["id"]
        smart_update_existing_event(existing, event_record)
    else:
        event_id = insert_event(event_record, series_hint=series_hint)

    if event_id and run_id:
        _update_screening_times_event_id(run_id, event_id)
        _update_event_screening_run_id(event_id, run_id)

    return event_id


def sync_run_events_from_screenings(
    *,
    source_id: int,
    source_slug: str,
) -> dict[str, Any]:
    """Derive one event per screening_run for backward compatibility.

    Returns summary: {events_created, events_updated, times_linked, run_event_hashes}.
    The run_event_hashes set can be passed to remove_stale_showtime_events().
    """
    if not screenings_support_tables():
        return {"events_created": 0, "events_updated": 0, "unsupported": True}

    from db.events import find_event_by_hash
    from dedupe import generate_content_hash

    runs = _select_screening_runs_with_context(source_id)
    events_created = 0
    events_updated = 0
    times_linked = 0
    run_event_hashes: set[str] = set()
    venue_name_cache: dict[int, str] = {}

    for run in runs:
        title_data = run.get("screening_titles") or {}
        times = _select_times_for_run(run["id"])
        canonical_title = title_data.get("canonical_title") or run.get("label") or ""

        # Compute the hash we'd generate for this run
        place_id = run.get("place_id")
        venue_name = _get_venue_name(place_id, venue_name_cache) if place_id else ""

        content_hash = generate_content_hash(
            canonical_title,
            venue_name,
            f"run|{run.get('source_key', '')}",
        )
        run_event_hashes.add(content_hash)

        # Check if event already exists to track created vs updated
        existing = find_event_by_hash(content_hash)
        event_id = derive_run_event_from_screening(
            run=run,
            title=title_data,
            times=times,
            venue_name_cache=venue_name_cache,
        )
        if event_id:
            if existing:
                events_updated += 1
            else:
                events_created += 1
            times_linked += len(times)

    return {
        "events_created": events_created,
        "events_updated": events_updated,
        "times_linked": times_linked,
        "run_event_hashes": run_event_hashes,
    }


@retry_on_network_error(max_retries=4, base_delay=0.5)
def _select_future_film_events_for_source(source_id: int) -> list[dict[str, Any]]:
    """Select future film events for a source, for stale cleanup."""
    today = datetime.now().strftime("%Y-%m-%d")
    result = (
        get_client()
        .table("events")
        .select("id,content_hash,is_active")
        .eq("source_id", source_id)
        .eq("category_id", "film")
        .gte("start_date", today)
        .execute()
    )
    return result.data or []


@retry_on_network_error(max_retries=4, base_delay=0.5)
def _event_has_references(event_id: int) -> bool:
    """Check if an event has RSVPs (via plans/plan_invitees) or saved items."""
    client = get_client()
    # Check plans anchored to this event (replaces the dropped event_rsvps table)
    try:
        result = (
            client.table("plans")
            .select("id")
            .eq("anchor_event_id", event_id)
            .eq("anchor_type", "event")
            .limit(1)
            .execute()
        )
        if result.data:
            return True
    except Exception:
        pass
    # Check saved items
    try:
        result = client.table("saved_items").select("id").eq("event_id", event_id).limit(1).execute()
        if result.data:
            return True
    except Exception:
        pass
    return False


def remove_stale_showtime_events(
    *,
    source_id: int,
    run_event_hashes: set[str],
) -> dict[str, int]:
    """Remove per-showtime events for a now-screening-primary source.

    Events whose content_hash is in run_event_hashes are run-level events (keep).
    All other future film events for this source are per-showtime leftovers.

    Events with RSVPs/saves are deactivated (is_active=false), not deleted.
    Unreferenced events are hard-deleted.
    """
    if not writes_enabled():
        return {"deactivated": 0, "deleted": 0}

    events = _select_future_film_events_for_source(source_id)
    stale = [e for e in events if e.get("content_hash") not in run_event_hashes]

    deactivated = 0
    deleted = 0
    client = get_client()

    for event in stale:
        event_id = event["id"]
        if _event_has_references(event_id):
            # Deactivate — preserve RSVP/saved data
            try:
                client.table("events").update({"is_active": False}).eq("id", event_id).execute()
                deactivated += 1
            except Exception as exc:
                logger.warning("Failed to deactivate event %s: %s", event_id, exc)
        else:
            # No references — safe to delete
            try:
                client.table("events").delete().eq("id", event_id).execute()
                deleted += 1
            except Exception as exc:
                logger.warning("Failed to delete stale showtime event %s: %s", event_id, exc)

    if deactivated or deleted:
        logger.info(
            "Stale showtime cleanup for source %s: %s deactivated, %s deleted",
            source_id, deactivated, deleted,
        )

    return {"deactivated": deactivated, "deleted": deleted}
