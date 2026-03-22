"""
Tests for the enrichment worker that drains the async enrichment queue.

Covers:
- TASK_HANDLERS dict covers all expected task types
- process_task dispatches to the correct handler based on task_type
- process_task calls complete_task on success
- process_task calls fail_task on handler exception
- process_task fails gracefully for unknown task types
"""
import sys
from types import SimpleNamespace
from unittest.mock import MagicMock, patch


# ---------------------------------------------------------------------------
# Stub all heavy transitive dependencies before importing enrichment_worker.
# enrichment_worker imports:
#   - db.enrichment_queue (as _queue at module level)
#   - db.client (get_client, writes_enabled)
# And lazily inside handlers:
#   - db.events (_step_enrich_film, _step_enrich_music, InsertContext)
#   - db.enrichment (_compute_and_save_event_blurhash)
#   - series (get_or_create_series)
# ---------------------------------------------------------------------------

# --- db.client stub (needed before db/__init__.py loads) ---
_fake_client_mod = SimpleNamespace(
    get_client=MagicMock(return_value=MagicMock()),
    writes_enabled=MagicMock(return_value=True),
    _BLURHASH_EXECUTOR=MagicMock(),
    smart_title_case=lambda s: s,
    _normalize_image_url=lambda u: u,
    _normalize_source_url=lambda u: u,
    ValidationStats=MagicMock,
    reset_validation_stats=MagicMock(),
    get_validation_stats=MagicMock(),
    _ValidationStatsProxy=MagicMock,
    _validation_stats=MagicMock(),
    configure_write_mode=MagicMock(),
    _next_temp_id=MagicMock(),
    _log_write_skip=MagicMock(),
    reset_client=MagicMock(),
    retry_on_network_error=lambda *a, **kw: (lambda f: f),
    events_support_show_signal_columns=MagicMock(return_value=False),
    events_support_film_identity_columns=MagicMock(return_value=True),
    events_support_content_kind_column=MagicMock(return_value=False),
    venues_support_features_table=MagicMock(return_value=False),
    events_support_is_active_column=MagicMock(return_value=False),
    events_support_field_metadata_columns=MagicMock(return_value=False),
    venues_support_location_designator=MagicMock(return_value=False),
    has_event_extractions_table=MagicMock(return_value=False),
    venues_support_destination_details_table=MagicMock(return_value=False),
    _SOURCE_CACHE={},
    _VENUE_CACHE={},
)
sys.modules["db.client"] = _fake_client_mod

# --- Stub all other db sub-modules so db/__init__.py doesn't blow up ---
for _mod in (
    "db.validation",
    "db.sources",
    "db.venues",
    "db.enrichment",
    "db.series_linking",
    "db.artists",
    "db.events",
    "db.programs",
    "db.exhibitions",
    "db.open_calls",
    "db.destination_details",
    "db.venue_specials",
    "db.editorial_mentions",
    "db.venue_occasions",
    "db.volunteer_opportunities",
    "db.notifications",
    "db.enrichment_queue",
):
    if _mod not in sys.modules:
        sys.modules[_mod] = MagicMock()

# --- Populate the specific attributes enrichment_worker needs ---
_fake_enrichment_queue = sys.modules["db.enrichment_queue"]
_fake_enrichment_queue.claim_tasks = MagicMock(return_value=[])
_fake_enrichment_queue.complete_task = MagicMock()
_fake_enrichment_queue.fail_task = MagicMock()
_fake_enrichment_queue.get_queue_depth = MagicMock(return_value={})

# Fake db.enrichment
_fake_enrichment = sys.modules["db.enrichment"]
_fake_enrichment._compute_and_save_event_blurhash = MagicMock()

# Fake db.events
_fake_db_events = sys.modules["db.events"]
_fake_db_events._step_enrich_film = MagicMock(side_effect=lambda data, ctx: data)
_fake_db_events._step_enrich_music = MagicMock(side_effect=lambda data, ctx: data)
_fake_db_events.InsertContext = MagicMock

# Stub series module
if "series" not in sys.modules:
    sys.modules["series"] = SimpleNamespace(
        get_or_create_series=MagicMock(return_value=None),
    )

# Stub the top-level db package to avoid re-importing everything
if "db" not in sys.modules:
    sys.modules["db"] = MagicMock()
    sys.modules["db"].configure_write_mode = MagicMock()

import enrichment_worker as ew  # noqa: E402 — must come after stubs


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_task(task_type: str, entity_id: str = "42", attempts: int = 0) -> dict:
    return {
        "id": "task-uuid-1",
        "entity_type": "event",
        "entity_id": entity_id,
        "task_type": task_type,
        "attempts": attempts,
    }


def _make_client() -> MagicMock:
    client = MagicMock()
    table = MagicMock()
    client.table.return_value = table
    table.select.return_value = table
    table.eq.return_value = table
    table.execute.return_value = MagicMock(data=[])
    return client


def _make_queue_mock() -> SimpleNamespace:
    """Return a fresh queue mock for isolation."""
    return SimpleNamespace(
        claim_tasks=MagicMock(return_value=[]),
        complete_task=MagicMock(),
        fail_task=MagicMock(),
        get_queue_depth=MagicMock(return_value={}),
    )


# ---------------------------------------------------------------------------
# Tests: TASK_HANDLERS coverage
# ---------------------------------------------------------------------------

class TestTaskHandlersCoverage:
    def test_enrich_film_handler_present(self):
        assert "enrich_film" in ew.TASK_HANDLERS

    def test_enrich_music_handler_present(self):
        assert "enrich_music" in ew.TASK_HANDLERS

    def test_blurhash_handler_present(self):
        assert "blurhash" in ew.TASK_HANDLERS

    def test_series_linking_handler_present(self):
        assert "series_linking" in ew.TASK_HANDLERS

    def test_all_handlers_are_callable(self):
        for task_type, handler in ew.TASK_HANDLERS.items():
            assert callable(handler), f"Handler for {task_type!r} is not callable"


# ---------------------------------------------------------------------------
# Tests: process_task dispatching
# ---------------------------------------------------------------------------

class TestProcessTaskDispatching:
    def test_dispatches_to_correct_handler(self):
        client = _make_client()
        called_with = []

        fake_handler = lambda c, entity_type, entity_id: called_with.append(
            (entity_type, entity_id)
        )

        queue = _make_queue_mock()
        with patch.dict(ew.TASK_HANDLERS, {"enrich_film": fake_handler}):
            with patch.object(ew, "_queue", queue):
                task = _make_task("enrich_film", entity_id="99")
                ew.process_task(client, task)

        assert called_with == [("event", "99")]

    def test_dispatches_blurhash_handler(self):
        client = _make_client()
        called_with = []

        fake_handler = lambda c, entity_type, entity_id: called_with.append(entity_id)

        queue = _make_queue_mock()
        with patch.dict(ew.TASK_HANDLERS, {"blurhash": fake_handler}):
            with patch.object(ew, "_queue", queue):
                task = _make_task("blurhash", entity_id="7")
                ew.process_task(client, task)

        assert called_with == ["7"]

    def test_dispatches_series_linking_handler(self):
        client = _make_client()
        called = []

        fake_handler = lambda c, entity_type, entity_id: called.append(True)

        queue = _make_queue_mock()
        with patch.dict(ew.TASK_HANDLERS, {"series_linking": fake_handler}):
            with patch.object(ew, "_queue", queue):
                ew.process_task(client, _make_task("series_linking"))

        assert called == [True]

    def test_dispatches_enrich_music_handler(self):
        client = _make_client()
        called = []

        fake_handler = lambda c, entity_type, entity_id: called.append(entity_id)

        queue = _make_queue_mock()
        with patch.dict(ew.TASK_HANDLERS, {"enrich_music": fake_handler}):
            with patch.object(ew, "_queue", queue):
                ew.process_task(client, _make_task("enrich_music", entity_id="55"))

        assert called == ["55"]


# ---------------------------------------------------------------------------
# Tests: complete_task on success
# ---------------------------------------------------------------------------

class TestProcessTaskCompletesOnSuccess:
    def test_calls_complete_task_after_success(self):
        client = _make_client()
        queue = _make_queue_mock()

        fake_handler = lambda c, entity_type, entity_id: None  # success

        with patch.dict(ew.TASK_HANDLERS, {"enrich_film": fake_handler}):
            with patch.object(ew, "_queue", queue):
                task = _make_task("enrich_film", entity_id="10")
                ew.process_task(client, task)

        queue.complete_task.assert_called_once_with(client, "task-uuid-1")
        queue.fail_task.assert_not_called()

    def test_does_not_call_fail_task_on_success(self):
        client = _make_client()
        queue = _make_queue_mock()

        fake_handler = lambda c, entity_type, entity_id: None

        with patch.dict(ew.TASK_HANDLERS, {"blurhash": fake_handler}):
            with patch.object(ew, "_queue", queue):
                ew.process_task(client, _make_task("blurhash"))

        queue.fail_task.assert_not_called()


# ---------------------------------------------------------------------------
# Tests: fail_task on handler exception
# ---------------------------------------------------------------------------

class TestProcessTaskFailsOnException:
    def test_calls_fail_task_when_handler_raises(self):
        client = _make_client()
        queue = _make_queue_mock()

        def exploding_handler(c, entity_type, entity_id):
            raise RuntimeError("TMDB unreachable")

        with patch.dict(ew.TASK_HANDLERS, {"enrich_film": exploding_handler}):
            with patch.object(ew, "_queue", queue):
                task = _make_task("enrich_film", entity_id="5", attempts=0)
                ew.process_task(client, task)

        queue.fail_task.assert_called_once_with(
            client,
            "task-uuid-1",
            "TMDB unreachable",
            0,  # current_attempts
        )
        queue.complete_task.assert_not_called()

    def test_fail_task_receives_error_string(self):
        client = _make_client()
        fail_calls = []
        queue = SimpleNamespace(
            complete_task=MagicMock(),
            fail_task=lambda c, task_id, error, current_attempts: fail_calls.append(
                {"task_id": task_id, "error": error}
            ),
        )

        def exploding_handler(c, entity_type, entity_id):
            raise ValueError("Bad event ID")

        with patch.dict(ew.TASK_HANDLERS, {"enrich_music": exploding_handler}):
            with patch.object(ew, "_queue", queue):
                ew.process_task(client, _make_task("enrich_music"))

        assert len(fail_calls) == 1
        assert "Bad event ID" in fail_calls[0]["error"]
        assert fail_calls[0]["task_id"] == "task-uuid-1"


# ---------------------------------------------------------------------------
# Tests: unknown task type
# ---------------------------------------------------------------------------

class TestProcessTaskUnknownType:
    def test_unknown_task_type_calls_fail_task(self):
        client = _make_client()
        queue = _make_queue_mock()

        with patch.object(ew, "_queue", queue):
            task = _make_task("unknown_type_xyz")
            ew.process_task(client, task)

        queue.fail_task.assert_called_once()
        queue.complete_task.assert_not_called()

    def test_unknown_task_type_does_not_raise(self):
        client = _make_client()
        queue = _make_queue_mock()

        with patch.object(ew, "_queue", queue):
            # Should not raise — graceful degradation
            ew.process_task(client, _make_task("totally_fake_task"))


# ---------------------------------------------------------------------------
# Tests: run_worker basic behaviour
# ---------------------------------------------------------------------------

class TestRunWorkerDryRun:
    def test_dry_run_does_not_call_process_task(self):
        """In dry-run mode run_worker reports depth but skips processing."""
        client = _make_client()
        process_calls = []
        queue = SimpleNamespace(
            claim_tasks=MagicMock(return_value=[_make_task("enrich_film")]),
            complete_task=MagicMock(),
            fail_task=MagicMock(),
            get_queue_depth=MagicMock(return_value={"pending": 1}),
        )
        with patch.object(ew, "_queue", queue):
            with patch.object(ew, "process_task", side_effect=lambda c, t: process_calls.append(t)):
                ew.run_worker(client, batch_size=10, max_batches=1, dry_run=True)

        assert process_calls == [], "dry_run should not invoke process_task"

    def test_run_worker_processes_claimed_tasks(self):
        """run_worker dispatches each claimed task to process_task."""
        client = _make_client()
        processed = []

        tasks = [_make_task("blurhash", entity_id=str(i)) for i in range(3)]
        queue = SimpleNamespace(
            claim_tasks=MagicMock(side_effect=[tasks, []]),
            complete_task=MagicMock(),
            fail_task=MagicMock(),
            get_queue_depth=MagicMock(return_value={"pending": 0}),
        )
        with patch.object(ew, "_queue", queue):
            with patch.object(ew, "process_task", side_effect=lambda c, t: processed.append(t["entity_id"])):
                ew.run_worker(client, batch_size=10, max_batches=2, dry_run=False)

        assert processed == ["0", "1", "2"]

    def test_run_worker_stops_after_max_batches(self):
        """run_worker honours max_batches even when the queue always returns tasks."""
        client = _make_client()
        batch_call_count = []

        always_has_tasks = [_make_task("blurhash")]
        queue = SimpleNamespace(
            claim_tasks=MagicMock(side_effect=lambda c, w, limit: (
                batch_call_count.append(1) or always_has_tasks
            )),
            complete_task=MagicMock(),
            fail_task=MagicMock(),
            get_queue_depth=MagicMock(return_value={"pending": 99}),
        )
        with patch.object(ew, "_queue", queue):
            with patch.object(ew, "process_task", return_value=None):
                ew.run_worker(client, batch_size=5, max_batches=3, dry_run=False)

        assert len(batch_call_count) == 3
