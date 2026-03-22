"""
Enrichment queue operations: enqueue, claim, complete, fail.

The enrichment queue decouples external API calls (TMDB, Spotify, Google Places,
blurhash) from the synchronous insert path. Workers claim tasks via the
`claim_enrichment_tasks` RPC (FOR UPDATE SKIP LOCKED), execute them, then call
complete_task or fail_task depending on outcome.
"""
import logging
from datetime import datetime, timedelta, timezone

from db.client import get_client, writes_enabled

logger = logging.getLogger(__name__)

# Exponential backoff windows for retryable failures (indexed by attempt number).
# attempt 1 → 1 min, attempt 2 → 5 min, attempt 3+ → 30 min
_BACKOFF_MINUTES = [1, 5, 30]


def enqueue_task(client, entity_type: str, entity_id, task_type: str, priority: int = 5) -> None:
    """Add a task to the enrichment queue.

    No-ops silently when writes are disabled (dry-run mode). Also swallows
    insert errors so that a queue failure never blocks the main crawl path.
    """
    if not writes_enabled():
        return
    try:
        client.table("enrichment_queue").insert({
            "entity_type": entity_type,
            "entity_id": str(entity_id),
            "task_type": task_type,
            "priority": priority,
            "status": "pending",
            "attempts": 0,
        }).execute()
    except Exception as e:
        logger.warning(
            "Failed to enqueue %s for %s/%s: %s",
            task_type, entity_type, entity_id, e,
        )


def claim_tasks(client, worker_id: str, limit: int = 10) -> list:
    """Claim pending tasks using FOR UPDATE SKIP LOCKED via RPC.

    Returns a list of task dicts, or an empty list on error.
    """
    try:
        result = client.rpc("claim_enrichment_tasks", {
            "p_worker_id": worker_id,
            "p_limit": limit,
        }).execute()
        return result.data or []
    except Exception as e:
        logger.error("Failed to claim enrichment tasks: %s", e)
        return []


def complete_task(client, task_id) -> None:
    """Mark a task as completed with a processed_at timestamp."""
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
    task_id,
    error: str,
    current_attempts: int,
    max_attempts: int = 3,
) -> None:
    """Record a task failure with retry backoff, or mark permanently failed.

    When new_attempts < max_attempts the task stays pending with a
    next_retry_at timestamp computed from _BACKOFF_MINUTES. When
    new_attempts >= max_attempts the task is marked failed and will not
    be retried automatically.
    """
    if not writes_enabled():
        return

    new_attempts = current_attempts + 1
    error_message = error[:500] if error else None

    if new_attempts >= max_attempts:
        client.table("enrichment_queue").update({
            "status": "failed",
            "attempts": new_attempts,
            "error_message": error_message,
            "locked_by": None,
            "locked_at": None,
        }).eq("id", task_id).execute()
    else:
        backoff_idx = min(new_attempts - 1, len(_BACKOFF_MINUTES) - 1)
        retry_at = datetime.now(timezone.utc) + timedelta(minutes=_BACKOFF_MINUTES[backoff_idx])
        client.table("enrichment_queue").update({
            "status": "pending",
            "attempts": new_attempts,
            "error_message": error_message,
            "next_retry_at": retry_at.isoformat(),
            "locked_by": None,
            "locked_at": None,
        }).eq("id", task_id).execute()


def get_queue_depth(client) -> dict:
    """Return queue depth by status for health monitoring.

    Returns a dict mapping status string to row count, e.g.
    {"pending": 12, "completed": 480, "failed": 3}.
    Returns {} on error.
    """
    try:
        result = client.rpc("enrichment_queue_depth").execute()
        return {row["status"]: row["count"] for row in (result.data or [])}
    except Exception:
        return {}
