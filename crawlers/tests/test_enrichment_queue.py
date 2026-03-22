"""
Tests for db/enrichment_queue.py — enqueue, claim, complete, fail operations.
"""
from unittest.mock import MagicMock, patch, call


def _make_client():
    """Build a minimal Supabase client mock with chainable table methods."""
    client = MagicMock()
    table = MagicMock()
    client.table.return_value = table
    table.insert.return_value = table
    table.update.return_value = table
    table.eq.return_value = table
    table.execute.return_value = MagicMock(data=[])
    rpc = MagicMock()
    client.rpc.return_value = rpc
    rpc.execute.return_value = MagicMock(data=[])
    return client


# ---------------------------------------------------------------------------
# enqueue_task
# ---------------------------------------------------------------------------


def test_enqueue_task_inserts_correct_record():
    """enqueue_task should insert a pending record with all required fields."""
    from db.enrichment_queue import enqueue_task

    client = _make_client()
    with patch("db.enrichment_queue.writes_enabled", return_value=True):
        enqueue_task(client, "venue", "42", "google_places", priority=3)

    client.table.assert_called_once_with("enrichment_queue")
    client.table().insert.assert_called_once_with({
        "entity_type": "venue",
        "entity_id": "42",
        "task_type": "google_places",
        "priority": 3,
        "status": "pending",
        "attempts": 0,
    })
    client.table().insert().execute.assert_called_once()


def test_enqueue_task_uses_default_priority():
    """enqueue_task should default to priority=5 when not specified."""
    from db.enrichment_queue import enqueue_task

    client = _make_client()
    with patch("db.enrichment_queue.writes_enabled", return_value=True):
        enqueue_task(client, "event", "99", "blurhash")

    inserted = client.table().insert.call_args[0][0]
    assert inserted["priority"] == 5


def test_enqueue_task_coerces_entity_id_to_string():
    """enqueue_task should coerce integer entity_id to str."""
    from db.enrichment_queue import enqueue_task

    client = _make_client()
    with patch("db.enrichment_queue.writes_enabled", return_value=True):
        enqueue_task(client, "event", 123, "blurhash")

    inserted = client.table().insert.call_args[0][0]
    assert inserted["entity_id"] == "123"


def test_enqueue_task_noop_when_writes_disabled():
    """enqueue_task should skip the insert when writes are disabled."""
    from db.enrichment_queue import enqueue_task

    client = _make_client()
    with patch("db.enrichment_queue.writes_enabled", return_value=False):
        enqueue_task(client, "venue", "42", "google_places")

    client.table.assert_not_called()


# ---------------------------------------------------------------------------
# fail_task
# ---------------------------------------------------------------------------


def test_fail_task_sets_backoff_when_retryable():
    """fail_task should reschedule with exponential backoff when attempts remain."""
    from db.enrichment_queue import fail_task

    client = _make_client()
    with patch("db.enrichment_queue.writes_enabled", return_value=True):
        fail_task(client, task_id=7, error="timeout", current_attempts=0, max_attempts=3)

    client.table.assert_called_once_with("enrichment_queue")
    update_payload = client.table().update.call_args[0][0]
    assert update_payload["status"] == "pending"
    assert update_payload["attempts"] == 1
    assert update_payload["error_message"] == "timeout"
    assert update_payload["next_retry_at"] is not None
    assert update_payload["locked_by"] is None
    assert update_payload["locked_at"] is None
    client.table().update().eq.assert_called_once_with("id", 7)


def test_fail_task_marks_failed_at_max_attempts():
    """fail_task should set status=failed when new_attempts reaches max_attempts."""
    from db.enrichment_queue import fail_task

    client = _make_client()
    with patch("db.enrichment_queue.writes_enabled", return_value=True):
        fail_task(client, task_id=7, error="still broken", current_attempts=2, max_attempts=3)

    update_payload = client.table().update.call_args[0][0]
    assert update_payload["status"] == "failed"
    assert update_payload["attempts"] == 3
    assert "next_retry_at" not in update_payload


def test_fail_task_truncates_long_error_messages():
    """fail_task should truncate error_message to 500 chars."""
    from db.enrichment_queue import fail_task

    long_error = "x" * 600
    client = _make_client()
    with patch("db.enrichment_queue.writes_enabled", return_value=True):
        fail_task(client, task_id=1, error=long_error, current_attempts=0, max_attempts=3)

    update_payload = client.table().update.call_args[0][0]
    assert len(update_payload["error_message"]) == 500


def test_fail_task_noop_when_writes_disabled():
    """fail_task should skip the update when writes are disabled."""
    from db.enrichment_queue import fail_task

    client = _make_client()
    with patch("db.enrichment_queue.writes_enabled", return_value=False):
        fail_task(client, task_id=1, error="oops", current_attempts=0)

    client.table.assert_not_called()


# ---------------------------------------------------------------------------
# complete_task
# ---------------------------------------------------------------------------


def test_complete_task_sets_completed_status():
    """complete_task should mark the row completed with a processed_at timestamp."""
    from db.enrichment_queue import complete_task

    client = _make_client()
    with patch("db.enrichment_queue.writes_enabled", return_value=True):
        complete_task(client, task_id=5)

    update_payload = client.table().update.call_args[0][0]
    assert update_payload["status"] == "completed"
    assert update_payload["processed_at"] is not None
    assert update_payload["locked_by"] is None
    assert update_payload["locked_at"] is None
    client.table().update().eq.assert_called_once_with("id", 5)


def test_complete_task_noop_when_writes_disabled():
    """complete_task should skip the update when writes are disabled."""
    from db.enrichment_queue import complete_task

    client = _make_client()
    with patch("db.enrichment_queue.writes_enabled", return_value=False):
        complete_task(client, task_id=5)

    client.table.assert_not_called()


# ---------------------------------------------------------------------------
# claim_tasks
# ---------------------------------------------------------------------------


def test_claim_tasks_calls_rpc():
    """claim_tasks should call the claim_enrichment_tasks RPC with correct params."""
    from db.enrichment_queue import claim_tasks

    client = _make_client()
    client.rpc.return_value.execute.return_value = MagicMock(data=[{"id": 1}, {"id": 2}])

    result = claim_tasks(client, worker_id="worker-1", limit=5)

    client.rpc.assert_called_once_with("claim_enrichment_tasks", {
        "p_worker_id": "worker-1",
        "p_limit": 5,
    })
    assert result == [{"id": 1}, {"id": 2}]


def test_claim_tasks_returns_empty_on_error():
    """claim_tasks should return [] on RPC failure."""
    from db.enrichment_queue import claim_tasks

    client = _make_client()
    client.rpc.side_effect = Exception("connection refused")

    result = claim_tasks(client, worker_id="worker-1", limit=5)

    assert result == []


# ---------------------------------------------------------------------------
# get_queue_depth
# ---------------------------------------------------------------------------


def test_get_queue_depth_parses_rpc_rows():
    """get_queue_depth should return a status->count dict from RPC data."""
    from db.enrichment_queue import get_queue_depth

    client = _make_client()
    client.rpc.return_value.execute.return_value = MagicMock(data=[
        {"status": "pending", "count": 10},
        {"status": "completed", "count": 50},
        {"status": "failed", "count": 2},
    ])

    result = get_queue_depth(client)

    assert result == {"pending": 10, "completed": 50, "failed": 2}


def test_get_queue_depth_returns_empty_on_error():
    """get_queue_depth should return {} on RPC failure."""
    from db.enrichment_queue import get_queue_depth

    client = _make_client()
    client.rpc.side_effect = Exception("network error")

    result = get_queue_depth(client)

    assert result == {}
