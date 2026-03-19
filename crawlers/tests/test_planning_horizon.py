"""
Tests for planning-horizon fields in the crawler pipeline.

Coverage:
  1. smart_update_existing_event — planning field merge logic
  2. _maybe_infer_importance — auto-importance inference
  3. parse_event (ticketmaster) — sales/on_sale_date extraction
"""

from contextlib import ExitStack
from typing import Optional
from unittest.mock import MagicMock, patch


# ---------------------------------------------------------------------------
# Helpers shared by multiple test groups
# ---------------------------------------------------------------------------


def _base_existing(overrides: Optional[dict] = None) -> dict:
    """Minimal existing-event dict that satisfies smart_update_existing_event."""
    base = {
        "id": 42,
        "title": "Test Event",
        "source_id": 10,
        "venue_id": 99,
        "start_date": "2026-04-01",
        "start_time": "20:00",
        "category_id": "music",
        "description": None,
        "image_url": None,
        "ticket_url": None,
        "source_url": "https://example.com/event",
        "price_min": None,
        "price_max": None,
        "price_note": None,
        "importance": "standard",
        "on_sale_date": None,
        "presale_date": None,
        "early_bird_deadline": None,
        "announce_date": None,
        "registration_opens": None,
        "registration_closes": None,
        "registration_url": None,
        "sellout_risk": None,
        "ticket_status_checked_at": None,
        "tags": [],
        "genres": [],
        "is_active": True,
        "portal_id": None,
    }
    if overrides:
        base.update(overrides)
    return base


def _base_incoming(overrides: Optional[dict] = None) -> dict:
    """Minimal incoming-event dict for smart_update_existing_event."""
    base = {
        "source_id": 10,
        "venue_id": 99,
        "title": "Test Event",
        "start_date": "2026-04-01",
        "start_time": "20:00",
        "category": "music",
        "description": None,
        "image_url": None,
        "ticket_url": "https://example.com/ticket",
        "source_url": "https://example.com/event",
        "importance": "standard",
        "on_sale_date": None,
        "presale_date": None,
        "early_bird_deadline": None,
        "announce_date": None,
        "registration_opens": None,
        "registration_closes": None,
        "registration_url": None,
        "sellout_risk": None,
        "ticket_status_checked_at": None,
        "tags": [],
        "genres": [],
    }
    if overrides:
        base.update(overrides)
    return base


def _run_smart_update(existing: dict, incoming: dict) -> dict:  # noqa: E501
    """
    Call smart_update_existing_event with heavy mocking of every side-effectful
    dependency (DB writes, source lookups, venue lookups, scoring, artists).

    Returns the ``updates`` dict that was passed to _update_event_record.
    """
    captured_updates: list[dict] = []

    def _fake_update_event_record(_client, _event_id, updates):
        captured_updates.append(dict(updates))

    with ExitStack() as stack:
        stack.enter_context(patch("db.events.writes_enabled", return_value=True))
        stack.enter_context(patch("db.events.get_client", return_value=MagicMock()))
        stack.enter_context(patch("db.events.get_source_info", return_value=None))
        stack.enter_context(patch("db.events.get_venue_by_id_cached", return_value=None))
        stack.enter_context(patch("db.events._update_event_record", side_effect=_fake_update_event_record))
        stack.enter_context(patch("db.events._should_use_incoming_image", return_value=False))
        stack.enter_context(patch("db.events._should_promote_incoming_ticket_url", return_value=False))
        stack.enter_context(patch("db.events._should_promote_incoming_url", return_value=False))
        stack.enter_context(patch("db.events.events_support_is_active_column", return_value=False))
        stack.enter_context(patch("db.events.events_support_content_kind_column", return_value=False))
        stack.enter_context(patch("db.events.events_support_film_identity_columns", return_value=False))
        stack.enter_context(patch("db.events._maybe_infer_importance"))
        stack.enter_context(patch("db.events.upsert_event_artists"))
        stack.enter_context(patch("db.events.parse_lineup_from_title", return_value=[]))
        # Patch description quality lazily (imported inside the function)
        stack.enter_context(patch("description_quality.classify_description", return_value="poor", create=True))
        stack.enter_context(patch("description_quality.is_likely_truncated_description", return_value=False, create=True))
        stack.enter_context(patch("compute_data_quality.score_record", return_value=0.9, create=True))
        stack.enter_context(patch("compute_data_quality.EVENT_WEIGHTS", {}, create=True))

        from db.events import smart_update_existing_event

        smart_update_existing_event(existing, incoming)

    return captured_updates[0] if captured_updates else {}


# ===========================================================================
# 1. smart_update_existing_event — planning field merge
# ===========================================================================


class TestSmartUpdatePlanningFieldFillIfEmpty:
    """Fill-if-empty logic: incoming value is taken only when existing is blank."""

    def test_on_sale_date_set_when_existing_is_empty(self):
        existing = _base_existing({"on_sale_date": None})
        incoming = _base_incoming({"on_sale_date": "2026-02-01"})
        updates = _run_smart_update(existing, incoming)
        assert updates.get("on_sale_date") == "2026-02-01"

    def test_on_sale_date_not_overwritten_when_existing_has_value(self):
        existing = _base_existing({"on_sale_date": "2026-01-15"})
        incoming = _base_incoming({"on_sale_date": "2026-02-01"})
        updates = _run_smart_update(existing, incoming)
        assert "on_sale_date" not in updates

    def test_presale_date_set_when_existing_is_empty(self):
        existing = _base_existing({"presale_date": None})
        incoming = _base_incoming({"presale_date": "2026-01-25"})
        updates = _run_smart_update(existing, incoming)
        assert updates.get("presale_date") == "2026-01-25"

    def test_presale_date_not_overwritten_when_existing_has_value(self):
        existing = _base_existing({"presale_date": "2026-01-10"})
        incoming = _base_incoming({"presale_date": "2026-01-25"})
        updates = _run_smart_update(existing, incoming)
        assert "presale_date" not in updates

    def test_all_fill_if_empty_planning_fields_propagate(self):
        """Every planning field that supports fill-if-empty is covered."""
        planning_fields = {
            "on_sale_date": "2026-02-01",
            "presale_date": "2026-01-25",
            "early_bird_deadline": "2026-03-01",
            "announce_date": "2026-01-05",
            "registration_opens": "2026-01-10",
            "registration_closes": "2026-03-20",
            "registration_url": "https://example.com/register",
            "sellout_risk": "high",
        }
        existing = _base_existing({k: None for k in planning_fields})
        incoming = _base_incoming(planning_fields)
        updates = _run_smart_update(existing, incoming)
        for field, value in planning_fields.items():
            assert updates.get(field) == value, f"Expected {field}={value!r} in updates"


class TestSmartUpdateImportanceEscalation:
    """importance: only upgrades, never downgrades. flagship > major > standard."""

    def test_standard_to_major_when_incoming_is_major(self):
        existing = _base_existing({"importance": "standard"})
        incoming = _base_incoming({"importance": "major"})
        updates = _run_smart_update(existing, incoming)
        assert updates.get("importance") == "major"

    def test_standard_not_downgraded_when_incoming_is_standard(self):
        existing = _base_existing({"importance": "major"})
        incoming = _base_incoming({"importance": "standard"})
        updates = _run_smart_update(existing, incoming)
        assert "importance" not in updates

    def test_major_to_flagship_when_incoming_is_flagship(self):
        existing = _base_existing({"importance": "major"})
        incoming = _base_incoming({"importance": "flagship"})
        updates = _run_smart_update(existing, incoming)
        assert updates.get("importance") == "flagship"

    def test_flagship_not_downgraded_by_major(self):
        existing = _base_existing({"importance": "flagship"})
        incoming = _base_incoming({"importance": "major"})
        updates = _run_smart_update(existing, incoming)
        assert "importance" not in updates

    def test_standard_unchanged_when_both_standard(self):
        existing = _base_existing({"importance": "standard"})
        incoming = _base_incoming({"importance": "standard"})
        updates = _run_smart_update(existing, incoming)
        assert "importance" not in updates


class TestSmartUpdateTicketStatusCheckedAt:
    """ticket_status_checked_at: always take the most recent timestamp."""

    def test_takes_incoming_when_newer(self):
        existing = _base_existing(
            {"ticket_status_checked_at": "2026-03-17T08:00:00Z"}
        )
        incoming = _base_incoming(
            {"ticket_status_checked_at": "2026-03-17T10:00:00Z"}
        )
        updates = _run_smart_update(existing, incoming)
        assert updates.get("ticket_status_checked_at") == "2026-03-17T10:00:00Z"

    def test_keeps_existing_when_it_is_newer(self):
        existing = _base_existing(
            {"ticket_status_checked_at": "2026-03-17T08:00:00Z"}
        )
        incoming = _base_incoming(
            {"ticket_status_checked_at": "2026-03-17T06:00:00Z"}
        )
        updates = _run_smart_update(existing, incoming)
        assert "ticket_status_checked_at" not in updates

    def test_takes_incoming_when_existing_is_none(self):
        existing = _base_existing({"ticket_status_checked_at": None})
        incoming = _base_incoming(
            {"ticket_status_checked_at": "2026-03-17T10:00:00Z"}
        )
        updates = _run_smart_update(existing, incoming)
        assert updates.get("ticket_status_checked_at") == "2026-03-17T10:00:00Z"

    def test_no_update_when_incoming_is_none(self):
        existing = _base_existing(
            {"ticket_status_checked_at": "2026-03-17T08:00:00Z"}
        )
        incoming = _base_incoming({"ticket_status_checked_at": None})
        updates = _run_smart_update(existing, incoming)
        assert "ticket_status_checked_at" not in updates


# ===========================================================================
# 2. _maybe_infer_importance
# ===========================================================================


class TestMaybeInferImportance:
    """Auto-inference bumps standard → major for high-capacity venues only."""

    def _call(self, event_data: dict, venue: Optional[dict], writes: bool = True) -> None:
        mock_client = MagicMock()
        # Simulate the chained Supabase call for the events update
        (
            mock_client.table.return_value.update.return_value.eq.return_value.eq.return_value.execute
        ) = MagicMock(return_value=MagicMock(data=[]))

        with ExitStack() as stack:
            stack.enter_context(patch("db.events.writes_enabled", return_value=writes))
            stack.enter_context(patch("db.events.get_venue_by_id_cached", return_value=venue))
            stack.enter_context(patch("db.events.get_client", return_value=mock_client))

            from db.events import _maybe_infer_importance

            _maybe_infer_importance(99, event_data)

        return mock_client

    def test_upgrades_to_major_for_high_capacity_venue(self):
        event_data = {"venue_id": 10, "importance": "standard", "category": "music"}
        venue = {"id": 10, "capacity_tier": 5}
        mock_client = self._call(event_data, venue)

        mock_client.table.assert_called_with("events")
        update_call = mock_client.table.return_value.update
        update_call.assert_called_once_with({"importance": "major"})

    def test_no_upgrade_for_low_capacity_venue(self):
        event_data = {"venue_id": 10, "importance": "standard"}
        venue = {"id": 10, "capacity_tier": 2}
        mock_client = self._call(event_data, venue)

        mock_client.table.return_value.update.assert_not_called()

    def test_flagship_event_skipped_early(self):
        """Already-flagship events must not be touched at all."""
        event_data = {"venue_id": 10, "importance": "flagship"}
        venue = {"id": 10, "capacity_tier": 5}
        mock_client = self._call(event_data, venue)

        mock_client.table.return_value.update.assert_not_called()

    def test_major_event_skipped_early(self):
        """Already-major events must not be touched at all."""
        event_data = {"venue_id": 10, "importance": "major"}
        venue = {"id": 10, "capacity_tier": 5}
        mock_client = self._call(event_data, venue)

        mock_client.table.return_value.update.assert_not_called()

    def test_no_venue_id_skips_entirely(self):
        """Events without venue_id cannot be inferred and should exit silently."""
        event_data = {"importance": "standard"}  # no venue_id key
        mock_client = self._call(event_data, venue=None)

        mock_client.table.return_value.update.assert_not_called()

    def test_venue_not_found_skips_upgrade(self):
        """If venue lookup returns None, no upgrade should occur."""
        event_data = {"venue_id": 10, "importance": "standard"}
        mock_client = self._call(event_data, venue=None)

        mock_client.table.return_value.update.assert_not_called()

    def test_capacity_tier_exactly_4_triggers_upgrade(self):
        """Boundary: tier >= 4 should upgrade."""
        event_data = {"venue_id": 10, "importance": "standard", "category": "music"}
        venue = {"id": 10, "capacity_tier": 4}
        mock_client = self._call(event_data, venue)

        mock_client.table.return_value.update.assert_called_once_with(
            {"importance": "major"}
        )

    def test_writes_disabled_returns_early(self):
        """When writes are disabled the function must be a no-op."""
        event_data = {"venue_id": 10, "importance": "standard"}
        venue = {"id": 10, "capacity_tier": 5}
        mock_client = self._call(event_data, venue, writes=False)

        mock_client.table.return_value.update.assert_not_called()


# ===========================================================================
# 3. parse_event (ticketmaster) — sales / on_sale_date extraction
# ===========================================================================


def _minimal_tm_event(overrides: Optional[dict] = None) -> dict:
    """Return a well-formed TM API event payload, optionally with overrides."""
    base: dict = {
        "id": "tm-test-1",
        "name": "Test Concert",
        "url": "https://www.ticketmaster.com/event/tm-test-1",
        "dates": {
            "start": {
                "localDate": "2026-05-01",
                "localTime": "20:00:00",
            }
        },
        "classifications": [
            {
                "segment": {"name": "Music"},
                "genre": {"name": "Rock"},
            }
        ],
        "_embedded": {
            "venues": [
                {
                    "name": "Test Venue",
                    "city": {"name": "Atlanta"},
                    "state": {"stateCode": "GA"},
                    "address": {"line1": "100 Main St"},
                }
            ],
            "attractions": [{"name": "Test Band"}],
        },
        # Enough text to satisfy _is_low_quality_description length check
        "info": (
            "A full evening of rock music from Test Band. "
            "Gates open at 6pm. All ages welcome. "
            "This is a large general admission event at the venue."
        ),
    }
    if overrides:
        _deep_merge(base, overrides)
    return base


def _deep_merge(target: dict, source: dict) -> None:
    """Shallow merge at the top level; overwrite nested dicts wholesale."""
    for k, v in source.items():
        target[k] = v


class TestParseEventSalesExtraction:
    """parse_event correctly extracts planning fields from Ticketmaster payloads."""

    def _parse(self, payload: dict) -> Optional[dict]:
        # Disable detail enrichment so the test is deterministic and
        # does not make real HTTP requests.
        with patch("sources.ticketmaster.DETAIL_ENRICH", False):
            from sources.ticketmaster import parse_event

            return parse_event(payload)

    def test_on_sale_date_populated_from_public_sale(self):
        payload = _minimal_tm_event(
            {
                "sales": {
                    "public": {"startDateTime": "2026-02-01T10:00:00Z"},
                    "presales": [],
                }
            }
        )
        result = self._parse(payload)
        assert result is not None
        assert result["on_sale_date"] == "2026-02-01"

    def test_presale_date_populated_from_presales_array(self):
        payload = _minimal_tm_event(
            {
                "sales": {
                    "public": {},
                    "presales": [
                        {"startDateTime": "2026-01-25T10:00:00Z", "name": "Fan presale"}
                    ],
                }
            }
        )
        result = self._parse(payload)
        assert result is not None
        assert result["presale_date"] == "2026-01-25"

    def test_both_fields_none_when_no_sales_key(self):
        payload = _minimal_tm_event()
        # Ensure no 'sales' key at all
        payload.pop("sales", None)
        result = self._parse(payload)
        assert result is not None
        assert result["on_sale_date"] is None
        assert result["presale_date"] is None

    def test_presale_date_none_when_presales_array_is_empty(self):
        payload = _minimal_tm_event(
            {
                "sales": {
                    "public": {"startDateTime": "2026-02-01T10:00:00Z"},
                    "presales": [],
                }
            }
        )
        result = self._parse(payload)
        assert result is not None
        assert result["presale_date"] is None

    def test_ticket_status_checked_at_always_set(self):
        """ticket_status_checked_at must never be None on a successful parse."""
        payload = _minimal_tm_event()
        result = self._parse(payload)
        assert result is not None
        assert result["ticket_status_checked_at"] is not None
        assert len(result["ticket_status_checked_at"]) > 0

    def test_on_sale_date_only_yyyy_mm_dd_fragment_stored(self):
        """Only the date portion (YYYY-MM-DD) of the ISO timestamp is stored."""
        payload = _minimal_tm_event(
            {
                "sales": {
                    "public": {"startDateTime": "2026-03-15T08:00:00Z"},
                    "presales": [],
                }
            }
        )
        result = self._parse(payload)
        assert result is not None
        assert result["on_sale_date"] == "2026-03-15"
        # Must be exactly YYYY-MM-DD — no time component
        assert "T" not in result["on_sale_date"]

    def test_presale_date_only_yyyy_mm_dd_fragment_stored(self):
        payload = _minimal_tm_event(
            {
                "sales": {
                    "public": {},
                    "presales": [{"startDateTime": "2026-03-10T06:00:00Z"}],
                }
            }
        )
        result = self._parse(payload)
        assert result is not None
        assert result["presale_date"] == "2026-03-10"
        assert "T" not in result["presale_date"]

    def test_on_sale_date_none_when_startdatetime_malformed(self):
        """A value that doesn't match YYYY-MM-DD after slicing must be discarded."""
        payload = _minimal_tm_event(
            {
                "sales": {
                    "public": {"startDateTime": "bad-date"},
                    "presales": [],
                }
            }
        )
        result = self._parse(payload)
        assert result is not None
        assert result["on_sale_date"] is None
