# Crawler Pipeline Foundation (Track 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Decouple external API enrichment from the insert path, add health reporting and alerting, and triage the scripts backlog — laying the foundation for the profile-first pipeline redesign.

**Architecture:** Extract TMDB/Spotify/blurhash calls from the synchronous `INSERT_PIPELINE` in `db/events.py` into an async enrichment queue backed by a Postgres table. Add crawl health reports and source quality scoring to Supabase. Triage 292 scripts into archive/active/utility categories.

**Tech Stack:** Python, Supabase/Postgres, existing crawl pipeline (`crawlers/db/events.py`, `crawlers/main.py`)

**Spec:** `docs/superpowers/specs/2026-03-21-crawler-pipeline-architecture-design.md`

**Parallel tracks:** Track 2 (Playwright Sprint) is independent and can run concurrently. Tracks 3-5 depend on Track 1.

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `supabase/migrations/XXXXXX_enrichment_queue.sql` | Create | enrichment_queue table + index |
| `supabase/migrations/XXXXXX_extraction_cache.sql` | Create | extraction_cache table |
| `supabase/migrations/XXXXXX_crawl_health_reports.sql` | Create | crawl_health_reports + system_alerts tables |
| `crawlers/db/enrichment_queue.py` | Create | Queue operations: enqueue, claim, complete, fail, retry |
| `crawlers/enrichment_worker.py` | Create | Worker that drains the queue (TMDB, Spotify, blurhash, series) |
| `crawlers/db/events.py` | Modify | Remove `_step_enrich_film`, `_step_enrich_music` from INSERT_PIPELINE; add enqueue calls |
| `crawlers/db/enrichment.py` | Modify | Move blurhash queueing to enrichment_queue instead of inline |
| `crawlers/health_report.py` | Create | Post-crawl health report generator + source quality scoring |
| `crawlers/main.py` | Modify | Wire health report generation into `run_post_crawl_tasks()` |
| `crawlers/tests/test_enrichment_queue.py` | Create | Tests for queue operations |
| `crawlers/tests/test_enrichment_worker.py` | Create | Tests for worker task processing |
| `crawlers/tests/test_health_report.py` | Create | Tests for health report + scoring |
| `crawlers/tests/test_insert_pipeline_no_external.py` | Create | Verify insert path no longer calls external APIs |
| `crawlers/scripts/archive/` | Create | Directory for completed one-time scripts |
| `crawlers/scripts/TRIAGE.md` | Create | Categorization of all 292 scripts |

---

## Task 1: Enrichment Queue Table Migration

**Files:**
- Create: `supabase/migrations/XXXXXX_enrichment_queue.sql`

- [ ] **Step 1: Check latest migration number**

```bash
ls supabase/migrations/ | tail -5
```

- [ ] **Step 2: Create the migration file**

```sql
-- Enrichment queue: async processing for external API calls
-- Decouples insert speed from enrichment completeness

create table if not exists enrichment_queue (
  id bigint generated always as identity primary key,
  entity_type text not null,
  entity_id uuid not null,
  task_type text not null,
  status text not null default 'pending',
  priority int not null default 5,
  attempts int not null default 0,
  max_attempts int not null default 3,
  next_retry_at timestamptz,
  locked_by text,
  locked_at timestamptz,
  created_at timestamptz not null default now(),
  processed_at timestamptz,
  error_message text
);

create index idx_enrichment_queue_pending
  on enrichment_queue (priority, created_at)
  where status = 'pending' and (next_retry_at is null or next_retry_at <= now());

create index idx_enrichment_queue_entity
  on enrichment_queue (entity_type, entity_id);

comment on table enrichment_queue is
  'Async enrichment tasks (TMDB, Spotify, blurhash, series linking) decoupled from insert path';
```

- [ ] **Step 3: Create matching migration in database/migrations/**

Copy the same SQL to `database/migrations/` with appropriate numbering.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/*enrichment_queue* database/migrations/*enrichment_queue*
git commit -m "feat: add enrichment_queue table for async post-insert processing"
```

---

## Task 2: Enrichment Queue Operations Module

**Files:**
- Create: `crawlers/db/enrichment_queue.py`
- Create: `crawlers/tests/test_enrichment_queue.py`

- [ ] **Step 1: Write failing tests for queue operations**

```python
# crawlers/tests/test_enrichment_queue.py
"""Tests for enrichment queue CRUD operations."""
import pytest
from unittest.mock import MagicMock, patch
from db.enrichment_queue import enqueue_task, claim_tasks, complete_task, fail_task


def test_enqueue_task_builds_correct_record():
    """enqueue_task should build a record with entity info and task type."""
    mock_client = MagicMock()
    mock_client.table.return_value.insert.return_value.execute.return_value = MagicMock()

    enqueue_task(
        mock_client,
        entity_type="event",
        entity_id="abc-123",
        task_type="tmdb_poster",
        priority=3,
    )

    call_args = mock_client.table.return_value.insert.call_args[0][0]
    assert call_args["entity_type"] == "event"
    assert call_args["entity_id"] == "abc-123"
    assert call_args["task_type"] == "tmdb_poster"
    assert call_args["priority"] == 3
    assert call_args["status"] == "pending"


def test_enqueue_task_skips_when_writes_disabled():
    """enqueue_task should no-op when writes are disabled."""
    mock_client = MagicMock()

    with patch("db.enrichment_queue.writes_enabled", return_value=False):
        enqueue_task(mock_client, "event", "abc", "tmdb_poster")

    mock_client.table.assert_not_called()


def test_fail_task_increments_attempts_and_sets_backoff():
    """fail_task should increment attempts and set exponential next_retry_at."""
    mock_client = MagicMock()
    mock_client.table.return_value.update.return_value.eq.return_value.execute.return_value = MagicMock()

    fail_task(mock_client, task_id=42, error="API timeout", current_attempts=1)

    call_args = mock_client.table.return_value.update.call_args[0][0]
    assert call_args["attempts"] == 2
    assert call_args["status"] == "pending"  # still retryable (attempt 2 < max 3)
    assert "next_retry_at" in call_args


def test_fail_task_marks_failed_at_max_attempts():
    """fail_task should set status=failed when max_attempts reached."""
    mock_client = MagicMock()
    mock_client.table.return_value.update.return_value.eq.return_value.execute.return_value = MagicMock()

    fail_task(mock_client, task_id=42, error="API timeout", current_attempts=3, max_attempts=3)

    call_args = mock_client.table.return_value.update.call_args[0][0]
    assert call_args["status"] == "failed"
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd crawlers && python -m pytest tests/test_enrichment_queue.py -v
```

Expected: FAIL — module `db.enrichment_queue` does not exist.

- [ ] **Step 3: Implement the queue operations module**

```python
# crawlers/db/enrichment_queue.py
"""
Enrichment queue operations: enqueue, claim, complete, fail.

The enrichment queue decouples external API calls (TMDB, Spotify, Google Places,
blurhash) from the synchronous insert path. Events are written to the DB first,
then enriched asynchronously.
"""
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from db.client import get_client, writes_enabled

logger = logging.getLogger(__name__)

# Backoff schedule: attempt 1 → 1min, attempt 2 → 5min, attempt 3 → 30min
_BACKOFF_MINUTES = [1, 5, 30]


def enqueue_task(
    client,
    entity_type: str,
    entity_id: str,
    task_type: str,
    priority: int = 5,
) -> None:
    """Add a task to the enrichment queue."""
    if not writes_enabled():
        return
    try:
        client.table("enrichment_queue").insert({
            "entity_type": entity_type,
            "entity_id": entity_id,
            "task_type": task_type,
            "priority": priority,
            "status": "pending",
            "attempts": 0,
        }).execute()
    except Exception as e:
        logger.warning("Failed to enqueue %s for %s/%s: %s", task_type, entity_type, entity_id, e)


def claim_tasks(client, worker_id: str, limit: int = 10) -> list[dict]:
    """Claim pending tasks using FOR UPDATE SKIP LOCKED via RPC."""
    try:
        result = client.rpc("claim_enrichment_tasks", {
            "p_worker_id": worker_id,
            "p_limit": limit,
        }).execute()
        return result.data or []
    except Exception as e:
        logger.error("Failed to claim tasks: %s", e)
        return []


def complete_task(client, task_id: int) -> None:
    """Mark a task as completed."""
    if not writes_enabled():
        return
    client.table("enrichment_queue").update({
        "status": "completed",
        "processed_at": datetime.now(timezone.utc).isoformat(),
        "locked_by": None,
        "locked_at": None,
    }).eq("id", task_id).execute()


def fail_task(
    client,
    task_id: int,
    error: str,
    current_attempts: int,
    max_attempts: int = 3,
) -> None:
    """Mark a task as failed with retry backoff, or permanently failed."""
    if not writes_enabled():
        return
    new_attempts = current_attempts + 1
    if new_attempts >= max_attempts:
        client.table("enrichment_queue").update({
            "status": "failed",
            "attempts": new_attempts,
            "error_message": error,
            "locked_by": None,
            "locked_at": None,
        }).eq("id", task_id).execute()
    else:
        backoff_idx = min(new_attempts - 1, len(_BACKOFF_MINUTES) - 1)
        retry_at = datetime.now(timezone.utc) + timedelta(minutes=_BACKOFF_MINUTES[backoff_idx])
        client.table("enrichment_queue").update({
            "status": "pending",
            "attempts": new_attempts,
            "error_message": error,
            "next_retry_at": retry_at.isoformat(),
            "locked_by": None,
            "locked_at": None,
        }).eq("id", task_id).execute()


def get_queue_depth(client) -> dict:
    """Return queue depth by status for health monitoring."""
    try:
        result = client.rpc("enrichment_queue_depth").execute()
        return {row["status"]: row["count"] for row in (result.data or [])}
    except Exception:
        return {}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd crawlers && python -m pytest tests/test_enrichment_queue.py -v
```

Expected: All 4 tests PASS.

- [ ] **Step 5: Add claim_enrichment_tasks RPC to migration**

Add an RPC function to the enrichment_queue migration for atomic task claiming:

```sql
create or replace function claim_enrichment_tasks(p_worker_id text, p_limit int default 10)
returns setof enrichment_queue
language sql
as $$
  update enrichment_queue
  set status = 'processing',
      locked_by = p_worker_id,
      locked_at = now()
  where id in (
    select id from enrichment_queue
    where status = 'pending'
      and (next_retry_at is null or next_retry_at <= now())
    order by priority, created_at
    limit p_limit
    for update skip locked
  )
  returning *;
$$;

create or replace function enrichment_queue_depth()
returns table(status text, count bigint)
language sql stable
as $$
  select status, count(*) from enrichment_queue group by status;
$$;
```

- [ ] **Step 6: Commit**

```bash
git add crawlers/db/enrichment_queue.py crawlers/tests/test_enrichment_queue.py supabase/migrations/*enrichment_queue*
git commit -m "feat: enrichment queue operations module with claim/complete/fail"
```

---

## Task 3: Decouple External Enrichment from INSERT_PIPELINE

**Files:**
- Modify: `crawlers/db/events.py` (lines 994-1016 INSERT_PIPELINE, lines 516-570 _step_enrich_film, lines 572-630 _step_enrich_music)
- Create: `crawlers/tests/test_insert_pipeline_no_external.py`

- [ ] **Step 1: Write test verifying insert path doesn't call external APIs**

```python
# crawlers/tests/test_insert_pipeline_no_external.py
"""Verify INSERT_PIPELINE no longer contains external API steps."""
from db.events import INSERT_PIPELINE


def test_pipeline_has_no_external_enrichment_steps():
    """The insert pipeline should not contain _step_enrich_film or _step_enrich_music."""
    step_names = [s.__name__ for s in INSERT_PIPELINE]
    assert "_step_enrich_film" not in step_names, "Film enrichment should be in async queue, not insert pipeline"
    assert "_step_enrich_music" not in step_names, "Music enrichment should be in async queue, not insert pipeline"
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd crawlers && python -m pytest tests/test_insert_pipeline_no_external.py -v
```

Expected: FAIL — both steps are currently in the pipeline.

- [ ] **Step 3: Remove enrichment steps from INSERT_PIPELINE and add enqueue calls**

In `crawlers/db/events.py`:

1. Remove `_step_enrich_film` and `_step_enrich_music` from the `INSERT_PIPELINE` list (lines 1003-1005).

2. Add a new `_step_enqueue_enrichment` function that runs after `_step_finalize`:

```python
def _step_enqueue_enrichment(event_data: dict, ctx: InsertContext) -> dict:
    """Enqueue async enrichment tasks for external API calls."""
    from db.enrichment_queue import enqueue_task

    event_id = event_data.get("id") or ctx.event_id
    if not event_id:
        return event_data

    client = get_client()
    category = event_data.get("category") or event_data.get("category_id")

    # Film enrichment (TMDB/OMDB)
    if category == "film":
        enqueue_task(client, "event", str(event_id), "enrich_film", priority=3)

    # Music enrichment (Spotify/Deezer)
    if category == "music":
        enqueue_task(client, "event", str(event_id), "enrich_music", priority=3)

    # Blurhash (any event with image)
    if event_data.get("image_url"):
        enqueue_task(client, "event", str(event_id), "blurhash", priority=8)

    return event_data
```

3. Update INSERT_PIPELINE to remove the two external steps and add the enqueue step after finalize:

```python
INSERT_PIPELINE = [
    _step_normalize_category,
    _step_validate,
    _step_check_past_date,
    _step_validate_source_url,
    _step_generate_hash,
    _step_resolve_source,
    _step_resolve_venue,
    _step_normalize_image,
    # _step_enrich_film — MOVED TO ASYNC QUEUE
    _step_parse_artists,
    # _step_enrich_music — MOVED TO ASYNC QUEUE
    _step_infer_category,
    _step_resolve_series,
    _step_infer_genres,
    _step_infer_tags,
    _step_infer_content_kind,
    _step_set_flags,
    _step_show_signals,
    _step_field_metadata,
    _step_data_quality,
    _step_finalize,
    _step_enqueue_enrichment,
]
```

**Do NOT delete** `_step_enrich_film` and `_step_enrich_music` functions — the enrichment worker will reuse their logic.

- [ ] **Step 4: Run tests**

```bash
cd crawlers && python -m pytest tests/test_insert_pipeline_no_external.py tests/test_enrichment_queue.py -v
```

Expected: All tests PASS.

- [ ] **Step 5: Run full test suite to check for regressions**

```bash
cd crawlers && python -m pytest -x
```

Expected: No regressions.

- [ ] **Step 6: Commit**

```bash
git add crawlers/db/events.py crawlers/tests/test_insert_pipeline_no_external.py
git commit -m "feat: decouple TMDB/Spotify/blurhash from insert pipeline into async queue"
```

---

## Task 4: Enrichment Worker

**Files:**
- Create: `crawlers/enrichment_worker.py`
- Create: `crawlers/tests/test_enrichment_worker.py`

- [ ] **Step 1: Write failing tests for worker task dispatch**

```python
# crawlers/tests/test_enrichment_worker.py
"""Tests for the enrichment worker task processing."""
import pytest
from unittest.mock import MagicMock, patch
from enrichment_worker import process_task, TASK_HANDLERS


def test_task_handlers_cover_all_task_types():
    """All expected task types should have handlers registered."""
    expected = {"enrich_film", "enrich_music", "blurhash", "series_linking"}
    assert expected.issubset(set(TASK_HANDLERS.keys()))


def test_process_task_calls_correct_handler():
    """process_task should dispatch to the registered handler."""
    mock_handler = MagicMock()
    mock_client = MagicMock()
    task = {"id": 1, "entity_type": "event", "entity_id": "abc", "task_type": "enrich_film", "attempts": 0, "max_attempts": 3}

    with patch.dict("enrichment_worker.TASK_HANDLERS", {"enrich_film": mock_handler}):
        process_task(mock_client, task)

    mock_handler.assert_called_once_with(mock_client, "event", "abc")


def test_process_task_handles_unknown_type():
    """process_task should fail gracefully for unknown task types."""
    mock_client = MagicMock()
    task = {"id": 1, "entity_type": "event", "entity_id": "abc", "task_type": "unknown_type", "attempts": 0, "max_attempts": 3}

    # Should not raise — just log warning and mark failed
    with patch("enrichment_worker.fail_task") as mock_fail:
        process_task(mock_client, task)
        mock_fail.assert_called_once()
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd crawlers && python -m pytest tests/test_enrichment_worker.py -v
```

Expected: FAIL — `enrichment_worker` module does not exist.

- [ ] **Step 3: Implement the enrichment worker**

```python
# crawlers/enrichment_worker.py
"""
Async enrichment worker: drains the enrichment_queue table.

Handles TMDB poster fetch, Spotify artist images, blurhash generation,
and series linking. Runs after each crawl batch or on a polling schedule.

Usage:
  python enrichment_worker.py                    # process pending tasks
  python enrichment_worker.py --poll --interval 300  # poll every 5 min
  python enrichment_worker.py --dry-run          # claim and log, don't process
"""
import argparse
import logging
import os
import time
import uuid

from db.client import get_client, writes_enabled
from db.enrichment_queue import claim_tasks, complete_task, fail_task, get_queue_depth

logger = logging.getLogger(__name__)

WORKER_ID = f"worker-{uuid.uuid4().hex[:8]}"


def _handle_enrich_film(client, entity_type: str, entity_id: str) -> None:
    """Fetch TMDB/OMDB metadata for a film event."""
    from db.events import _step_enrich_film, InsertContext
    # Fetch the event, run the enrichment step, update the record
    result = client.table("events").select("*").eq("id", entity_id).maybeSingle().execute()
    if not result.data:
        return
    event_data = result.data
    ctx = InsertContext()
    enriched = _step_enrich_film(dict(event_data), ctx)
    # Update only the fields that changed
    updates = {}
    for key in ("image_url", "film_title", "film_release_year", "film_identity_source"):
        if enriched.get(key) != event_data.get(key):
            updates[key] = enriched.get(key)
    if updates:
        client.table("events").update(updates).eq("id", entity_id).execute()


def _handle_enrich_music(client, entity_type: str, entity_id: str) -> None:
    """Fetch Spotify/Deezer metadata for a music event."""
    from db.events import _step_enrich_music, InsertContext
    result = client.table("events").select("*").eq("id", entity_id).maybeSingle().execute()
    if not result.data:
        return
    event_data = result.data
    ctx = InsertContext()
    enriched = _step_enrich_music(dict(event_data), ctx)
    updates = {}
    for key in ("image_url",):
        if enriched.get(key) != event_data.get(key):
            updates[key] = enriched.get(key)
    if ctx.genres:
        updates["genres"] = ctx.genres
    if updates:
        client.table("events").update(updates).eq("id", entity_id).execute()


def _handle_blurhash(client, entity_type: str, entity_id: str) -> None:
    """Generate blurhash for an entity's image."""
    from db.enrichment import _generate_and_store_blurhash
    table = "events" if entity_type == "event" else "venues"
    result = client.table(table).select("id, image_url, blurhash").eq("id", entity_id).maybeSingle().execute()
    if not result.data or result.data.get("blurhash") or not result.data.get("image_url"):
        return
    _generate_and_store_blurhash(client, table, entity_id, result.data["image_url"])


def _handle_series_linking(client, entity_type: str, entity_id: str) -> None:
    """Attempt to link an event to an existing series."""
    from db.series_linking import link_event_to_series
    link_event_to_series(client, entity_id)


TASK_HANDLERS = {
    "enrich_film": _handle_enrich_film,
    "enrich_music": _handle_enrich_music,
    "blurhash": _handle_blurhash,
    "series_linking": _handle_series_linking,
}


def process_task(client, task: dict) -> None:
    """Process a single enrichment task."""
    task_type = task["task_type"]
    handler = TASK_HANDLERS.get(task_type)
    if not handler:
        fail_task(client, task["id"], f"Unknown task type: {task_type}", task["attempts"], task["max_attempts"])
        return
    try:
        handler(client, task["entity_type"], task["entity_id"])
        complete_task(client, task["id"])
    except Exception as e:
        logger.warning("Task %s failed for %s/%s: %s", task_type, task["entity_type"], task["entity_id"], e)
        fail_task(client, task["id"], str(e)[:500], task["attempts"], task["max_attempts"])


def run_worker(batch_size: int = 10, max_batches: int = 100, dry_run: bool = False) -> int:
    """Process pending enrichment tasks. Returns total processed count."""
    client = get_client()
    total = 0
    for _ in range(max_batches):
        tasks = claim_tasks(client, WORKER_ID, limit=batch_size)
        if not tasks:
            break
        for task in tasks:
            if dry_run:
                logger.info("[DRY RUN] Would process %s for %s/%s", task["task_type"], task["entity_type"], task["entity_id"])
                complete_task(client, task["id"])
            else:
                process_task(client, task)
            total += 1
    depth = get_queue_depth(client)
    if depth.get("pending", 0) > 1000:
        logger.warning("Enrichment queue backup: %s pending tasks", depth["pending"])
    return total


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Enrichment queue worker")
    parser.add_argument("--poll", action="store_true", help="Poll continuously")
    parser.add_argument("--interval", type=int, default=300, help="Poll interval in seconds")
    parser.add_argument("--batch-size", type=int, default=10, help="Tasks per batch")
    parser.add_argument("--dry-run", action="store_true", help="Claim and log without processing")
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO)

    if args.poll:
        while True:
            processed = run_worker(batch_size=args.batch_size, dry_run=args.dry_run)
            logger.info("Processed %d tasks", processed)
            time.sleep(args.interval)
    else:
        processed = run_worker(batch_size=args.batch_size, dry_run=args.dry_run)
        logger.info("Processed %d tasks", processed)
```

- [ ] **Step 4: Run tests**

```bash
cd crawlers && python -m pytest tests/test_enrichment_worker.py -v
```

Expected: All 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add crawlers/enrichment_worker.py crawlers/tests/test_enrichment_worker.py
git commit -m "feat: enrichment worker drains async queue for TMDB/Spotify/blurhash/series"
```

---

## Task 5: Wire Worker into Post-Crawl Pipeline

**Files:**
- Modify: `crawlers/main.py` (inside `run_post_crawl_tasks()`, around line 1035)

- [ ] **Step 1: Add enrichment worker call to post-crawl tasks**

In `crawlers/main.py`, inside `run_post_crawl_tasks()`, add after existing steps:

```python
# --- Enrichment queue drain ---
try:
    from enrichment_worker import run_worker
    logger.info("POST-CRAWL: Draining enrichment queue...")
    processed = run_worker(batch_size=20, max_batches=200)
    logger.info("POST-CRAWL: Enrichment queue processed %d tasks", processed)
except Exception as e:
    logger.error("POST-CRAWL: Enrichment worker error: %s", e)
```

- [ ] **Step 2: Test with a dry run**

```bash
cd crawlers && python main.py --source terminal-west --dry-run
```

Expected: Post-crawl log shows "Draining enrichment queue..." (queue will be empty in dry-run mode, so 0 tasks processed).

- [ ] **Step 3: Commit**

```bash
git add crawlers/main.py
git commit -m "feat: wire enrichment worker into post-crawl pipeline"
```

---

## Task 6: Crawl Health Reports Table + Generator

**Files:**
- Create: `supabase/migrations/XXXXXX_crawl_health_reports.sql`
- Create: `crawlers/health_report.py`
- Create: `crawlers/tests/test_health_report.py`

- [ ] **Step 1: Create the migration**

```sql
-- Crawl health reports: post-crawl summaries visible in Supabase
create table if not exists crawl_health_reports (
  id bigint generated always as identity primary key,
  run_id text not null,
  created_at timestamptz not null default now(),
  total_sources int not null default 0,
  sources_succeeded int not null default 0,
  sources_failed int not null default 0,
  sources_zero_events int not null default 0,
  sources_yield_drop jsonb default '[]',
  sources_newly_broken jsonb default '[]',
  fleet_event_yield int not null default 0,
  enrichment_queue_depth jsonb default '{}',
  summary text
);

create table if not exists system_alerts (
  id bigint generated always as identity primary key,
  alert_type text not null,
  severity text not null default 'warning',
  message text not null,
  metadata jsonb default '{}',
  created_at timestamptz not null default now(),
  acknowledged_at timestamptz
);

create index idx_system_alerts_unacked
  on system_alerts (created_at desc)
  where acknowledged_at is null;
```

- [ ] **Step 2: Write failing tests for health report generation**

```python
# crawlers/tests/test_health_report.py
"""Tests for post-crawl health report generation."""
from unittest.mock import MagicMock, patch
from health_report import compute_source_quality_score, generate_health_report


def test_quality_score_perfect_source():
    """A source with 5+ consecutive successes, stable yield, full lanes = ~100."""
    score = compute_source_quality_score(
        consecutive_successes=5,
        yield_ratio=1.0,  # actual == baseline
        lane_completeness=1.0,
        rejection_rate=0.0,
        days_since_success=0,
    )
    assert score >= 90


def test_quality_score_broken_source():
    """A source with 0 successes, no yield, stale = near 0."""
    score = compute_source_quality_score(
        consecutive_successes=0,
        yield_ratio=0.0,
        lane_completeness=0.0,
        rejection_rate=1.0,
        days_since_success=14,
    )
    assert score < 20


def test_quality_score_clamps_to_0_100():
    """Score should never exceed 0-100 range."""
    score = compute_source_quality_score(
        consecutive_successes=100,
        yield_ratio=2.0,
        lane_completeness=1.0,
        rejection_rate=0.0,
        days_since_success=0,
    )
    assert 0 <= score <= 100
```

- [ ] **Step 3: Run tests to verify failure**

```bash
cd crawlers && python -m pytest tests/test_health_report.py -v
```

Expected: FAIL — module `health_report` does not exist.

- [ ] **Step 4: Implement health report generator**

```python
# crawlers/health_report.py
"""
Post-crawl health report generator.

Produces a summary of crawl run health, writes to crawl_health_reports table,
and raises system_alerts for P0 conditions.
"""
import logging
from datetime import datetime, timezone

from db.client import get_client, writes_enabled

logger = logging.getLogger(__name__)


def compute_source_quality_score(
    consecutive_successes: int,
    yield_ratio: float,
    lane_completeness: float,
    rejection_rate: float,
    days_since_success: int,
) -> float:
    """
    Compute a 0-100 quality score for a source.

    Weights: run_success=0.30, yield_stability=0.25, lane_completeness=0.20,
    rejection_rate=0.15, freshness=0.10
    """
    # Run success: 100 = 5+ consecutive, -20 per failure gap
    run_score = min(100, consecutive_successes * 20)

    # Yield stability: 100 = within 10% of baseline, decreases linearly
    if yield_ratio >= 0.9:
        yield_score = 100.0
    elif yield_ratio <= 0.0:
        yield_score = 0.0
    else:
        yield_score = max(0.0, yield_ratio * 100)

    # Lane completeness: direct percentage
    lane_score = lane_completeness * 100

    # Rejection rate: inverted
    rejection_score = max(0.0, (1.0 - rejection_rate) * 100)

    # Freshness: 100 = today, -10 per day, floor 0
    freshness_score = max(0.0, 100 - days_since_success * 10)

    raw = (
        run_score * 0.30
        + yield_score * 0.25
        + lane_score * 0.20
        + rejection_score * 0.15
        + freshness_score * 0.10
    )
    return max(0.0, min(100.0, raw))


def generate_health_report(
    run_id: str,
    crawl_results: list[dict],
) -> dict:
    """
    Generate and store a health report from crawl results.

    Each crawl_result dict should have: source_slug, status, events_found,
    events_new, events_rejected, error_message.
    """
    if not writes_enabled():
        return {}

    total = len(crawl_results)
    succeeded = sum(1 for r in crawl_results if r.get("status") == "success")
    failed = sum(1 for r in crawl_results if r.get("status") == "error")
    zero_events = sum(1 for r in crawl_results if r.get("status") == "success" and r.get("events_found", 0) == 0)
    newly_broken = [r["source_slug"] for r in crawl_results if r.get("status") == "error"]
    fleet_yield = sum(r.get("events_found", 0) for r in crawl_results)

    report = {
        "run_id": run_id,
        "total_sources": total,
        "sources_succeeded": succeeded,
        "sources_failed": failed,
        "sources_zero_events": zero_events,
        "sources_newly_broken": newly_broken[:50],
        "fleet_event_yield": fleet_yield,
        "summary": f"{succeeded}/{total} succeeded, {failed} failed, {zero_events} zero-event",
    }

    client = get_client()

    # Write report
    try:
        client.table("crawl_health_reports").insert(report).execute()
    except Exception as e:
        logger.error("Failed to write health report: %s", e)

    # Check P0 conditions and raise alerts
    alerts = []
    if failed > 5:
        alerts.append({
            "alert_type": "sources_broken",
            "severity": "critical",
            "message": f"{failed} sources failed in run {run_id}",
            "metadata": {"broken_slugs": newly_broken[:20]},
        })

    if alerts:
        try:
            client.table("system_alerts").insert(alerts).execute()
        except Exception as e:
            logger.error("Failed to write alerts: %s", e)

    return report
```

- [ ] **Step 5: Run tests**

```bash
cd crawlers && python -m pytest tests/test_health_report.py -v
```

Expected: All 3 tests PASS.

- [ ] **Step 6: Wire into main.py post-crawl**

In `crawlers/main.py`, in `run_post_crawl_tasks()`:

```python
# --- Health report ---
try:
    from health_report import generate_health_report
    logger.info("POST-CRAWL: Generating health report...")
    report = generate_health_report(run_id=f"run-{int(time.time())}", crawl_results=crawl_results)
    logger.info("POST-CRAWL: Health report: %s", report.get("summary", ""))
except Exception as e:
    logger.error("POST-CRAWL: Health report error: %s", e)
```

Note: `crawl_results` needs to be accumulated during the crawl run. Check if `main.py` already collects per-source results — it likely does in the `_run_split_pool` return values. Wire those into `generate_health_report`.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/*crawl_health* database/migrations/*crawl_health* crawlers/health_report.py crawlers/tests/test_health_report.py crawlers/main.py
git commit -m "feat: post-crawl health reports with source quality scoring and system alerts"
```

---

## Task 7: Extraction Cache Table

**Files:**
- Create: `supabase/migrations/XXXXXX_extraction_cache.sql`

- [ ] **Step 1: Create the migration**

```sql
-- Extraction cache: skip LLM calls when HTML hasn't changed
create table if not exists extraction_cache (
  source_slug text not null,
  content_hash text not null,
  extraction_result jsonb not null,
  created_at timestamptz not null default now(),
  primary key (source_slug, content_hash)
);

-- Auto-expire old entries (keep last 3 per source)
comment on table extraction_cache is
  'Cache LLM extraction results keyed by HTML content hash. Reduces LLM costs 50-80%.';
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/*extraction_cache* database/migrations/*extraction_cache*
git commit -m "feat: add extraction_cache table for LLM result caching"
```

---

## Task 8: Scripts Triage

**Files:**
- Create: `crawlers/scripts/archive/` (directory)
- Create: `crawlers/scripts/TRIAGE.md`

- [ ] **Step 1: Create archive directory**

```bash
mkdir -p crawlers/scripts/archive
touch crawlers/scripts/archive/.gitkeep
```

- [ ] **Step 2: Categorize all scripts**

Read through `crawlers/scripts/` and create `TRIAGE.md` with three categories:

```markdown
# Scripts Triage

Categorization of crawlers/scripts/ contents.

## Category A: Already Run Once (→ archive/)
Scripts that executed a one-time operation and are now complete.
Move to `archive/` subdirectory.

[list each script with a one-line description]

## Category B: Active Enrichment Covering Crawler Gap (→ crawler debt)
Scripts that run regularly because a crawler doesn't capture the data.
Each represents a crawler that needs to be fixed.

| Script | Source Slug | Missing Data | Fix |
|--------|------------|--------------|-----|
[list each with the crawler that should be fixed]

## Category C: Operational Utility (→ keep)
Scripts that serve an ongoing operational purpose (audits, diagnostics, tools).

[list each script]
```

- [ ] **Step 3: Move Category A scripts to archive/**

```bash
cd crawlers/scripts && mv <script1>.py <script2>.py ... archive/
```

- [ ] **Step 4: Commit**

```bash
git add crawlers/scripts/archive/ crawlers/scripts/TRIAGE.md
git commit -m "feat: triage 292 crawler scripts into archive/active-debt/utility categories"
```

---

## Task 9: Immediate Fixes (Prerequisite Cleanup)

**Files:**
- Stage: `crawlers/exhibition_utils.py` (currently untracked)
- Stage: `crawlers/scripts/migrate_exhibit_events_to_exhibitions.py` (currently untracked)

- [ ] **Step 1: Commit untracked exhibition pipeline code**

```bash
git add crawlers/exhibition_utils.py crawlers/scripts/migrate_exhibit_events_to_exhibitions.py
git commit -m "feat: commit exhibition pipeline utilities (previously untracked)"
```

- [ ] **Step 2: Identify and deactivate editorial aggregator crawlers**

Check which of these are active in the database, then deactivate:
- `crawlers/sources/arts_atl.py`
- `crawlers/sources/artsatl.py`
- `crawlers/sources/creative_loafing.py`
- `crawlers/sources/discover_atlanta.py`
- `crawlers/sources/access_atlanta.py`
- `crawlers/sources/nashville_scene.py`
- `crawlers/sources/visit_franklin.py`
- `crawlers/sources/nashville_com.py`

For each active one, create a migration to set `is_active = false` and add a comment at the top of the Python file explaining why it's deactivated:

```python
# DEACTIVATED: Editorial aggregator — violates original-source-only policy.
# See CRAWLER_STRATEGY.md "Source Rule: Original Sources Over Curators".
# Events from this source should come from the original venue crawlers instead.
```

- [ ] **Step 3: Commit**

```bash
git add crawlers/sources/arts_atl.py crawlers/sources/artsatl.py crawlers/sources/creative_loafing.py crawlers/sources/discover_atlanta.py crawlers/sources/access_atlanta.py crawlers/sources/nashville_scene.py crawlers/sources/visit_franklin.py crawlers/sources/nashville_com.py supabase/migrations/*deactivate_editorial*
git commit -m "fix: deactivate editorial aggregator crawlers that violate source policy"
```

- [ ] **Step 4: Fix hardcoded 2026 dates**

Check `HARDCODED_DATES_TODO.md` for the list of 8 crawlers. For each, replace hardcoded year with dynamic year logic:

```python
# Before:
if "2026" in date_str:
    ...

# After:
from datetime import datetime
current_year = datetime.now().year
```

- [ ] **Step 5: Commit**

```bash
git add crawlers/sources/*.py
git commit -m "fix: replace hardcoded 2026 dates with dynamic year in 8 crawlers"
```

---

## Verification Checklist

After all tasks complete, verify:

- [ ] `cd crawlers && python -m pytest -x` — all tests pass
- [ ] `INSERT_PIPELINE` in `db/events.py` contains no `_step_enrich_film` or `_step_enrich_music`
- [ ] `enrichment_queue` table migration exists in both `supabase/migrations/` and `database/migrations/`
- [ ] `extraction_cache` table migration exists
- [ ] `crawl_health_reports` and `system_alerts` table migrations exist
- [ ] `enrichment_worker.py` runs without error: `python enrichment_worker.py --dry-run`
- [ ] Editorial aggregator crawlers are deactivated
- [ ] Exhibition utils committed to git
- [ ] `crawlers/scripts/TRIAGE.md` categorizes all scripts
- [ ] No hardcoded 2026 dates remain in crawlers
