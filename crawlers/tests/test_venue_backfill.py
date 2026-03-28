"""
Unit tests for _maybe_update_existing_venue — the venue NULL-backfill helper.

All tests mock the Supabase client so no real DB calls are made.
"""

from unittest.mock import MagicMock, patch, call
import pytest

import db.places as venues_module
from db.places import _maybe_update_existing_venue


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_client(current_row: dict):
    """Return a mock Supabase client whose venues.select returns current_row."""
    client = MagicMock()
    select_chain = (
        client.table.return_value
        .select.return_value
        .eq.return_value
        .execute
    )
    select_chain.return_value = MagicMock(data=[current_row])

    update_chain = (
        client.table.return_value
        .update.return_value
        .eq.return_value
        .execute
    )
    update_chain.return_value = MagicMock(data=[{**current_row}])

    return client


def _run(current_row: dict, incoming: dict):
    """
    Run _maybe_update_existing_venue with a mocked client.

    Returns (client_mock, update_call_args_or_None).
    update_call_args is the dict passed to client.table(...).update(...) if an
    UPDATE was issued, otherwise None.
    """
    client = _make_client(current_row)

    with (
        patch.object(venues_module, "writes_enabled", return_value=True),
        patch.object(venues_module, "get_client", return_value=client),
    ):
        _maybe_update_existing_venue(current_row["id"], incoming)

    # Inspect whether .update(…) was called
    update_mock = client.table.return_value.update
    if update_mock.called:
        return client, update_mock.call_args[0][0]
    return client, None


# ---------------------------------------------------------------------------
# Core backfill behaviour
# ---------------------------------------------------------------------------

class TestLatLngBackfill:
    def test_null_coords_backfilled_when_incoming_has_both(self):
        current = {"id": 1, "name": "Venue A", "lat": None, "lng": None}
        incoming = {"lat": 33.749, "lng": -84.388}
        _, updates = _run(current, incoming)
        assert updates is not None
        assert updates["lat"] == 33.749
        assert updates["lng"] == -84.388

    def test_existing_coords_not_overwritten(self):
        current = {"id": 1, "name": "Venue A", "lat": 33.0, "lng": -84.0}
        incoming = {"lat": 33.749, "lng": -84.388}
        _, updates = _run(current, incoming)
        assert updates is None  # nothing to update

    def test_only_one_coord_in_incoming_is_skipped(self):
        """Both lat AND lng must be provided; partial coordinates are ignored."""
        current = {"id": 1, "name": "Venue A", "lat": None, "lng": None}
        incoming = {"lat": 33.749}  # lng missing
        _, updates = _run(current, incoming)
        assert updates is None

    def test_only_lat_null_skips_backfill(self):
        """If lng already has a value, the pair is not overwritten."""
        current = {"id": 1, "name": "Venue A", "lat": None, "lng": -84.0}
        incoming = {"lat": 33.749, "lng": -84.388}
        _, updates = _run(current, incoming)
        assert updates is None


class TestDescriptionBackfill:
    def test_null_description_backfilled(self):
        current = {"id": 1, "name": "V", "description": None}
        incoming = {"description": "A great place to visit."}
        _, updates = _run(current, incoming)
        assert updates is not None
        assert updates["description"] == "A great place to visit."

    def test_existing_description_not_replaced_by_shorter(self):
        current = {"id": 1, "name": "V", "description": "A great place to visit."}
        incoming = {"description": "Short."}
        _, updates = _run(current, incoming)
        assert updates is None

    def test_existing_description_replaced_by_meaningfully_longer(self):
        """Incoming must be > 50 chars longer than existing to trigger update."""
        current = {"id": 1, "name": "V", "description": "Short desc."}  # 11 chars
        long_desc = "A" * 70  # 70 chars — 59 chars longer → triggers update
        incoming = {"description": long_desc}
        _, updates = _run(current, incoming)
        assert updates is not None
        assert updates["description"] == long_desc

    def test_existing_description_not_replaced_when_margin_is_50_chars(self):
        """Exactly 50 chars longer does NOT trigger update (threshold is > 50)."""
        current = {"id": 1, "name": "V", "description": "A" * 10}
        incoming = {"description": "A" * 60}  # 60 - 10 = 50 → NOT enough
        _, updates = _run(current, incoming)
        assert updates is None

    def test_existing_description_replaced_when_margin_is_51_chars(self):
        current = {"id": 1, "name": "V", "description": "A" * 10}
        incoming = {"description": "A" * 61}  # 61 - 10 = 51 → triggers update
        _, updates = _run(current, incoming)
        assert updates is not None
        assert updates["description"] == "A" * 61


class TestSimpleNullBackfill:
    @pytest.mark.parametrize("field", [
        "address", "zip", "neighborhood", "website",
        "venue_type", "spot_type", "hours", "phone",
    ])
    def test_null_field_backfilled(self, field):
        current = {"id": 1, "name": "V", field: None}
        incoming = {field: "some_value"}
        _, updates = _run(current, incoming)
        assert updates is not None
        assert updates[field] == "some_value"

    @pytest.mark.parametrize("field", [
        "address", "zip", "neighborhood", "website",
        "venue_type", "spot_type", "hours", "phone",
    ])
    def test_existing_field_not_overwritten(self, field):
        current = {"id": 1, "name": "V", field: "existing_value"}
        incoming = {field: "new_value"}
        _, updates = _run(current, incoming)
        assert updates is None


class TestImageUrlBackfill:
    def test_image_url_backfilled_when_null(self):
        current = {"id": 1, "name": "V", "image_url": None}
        incoming = {"image_url": "https://example.com/img.jpg"}
        _, updates = _run(current, incoming)
        assert updates is not None
        assert "image_url" in updates

    def test_hero_image_url_backfilled_when_null(self):
        current = {"id": 1, "name": "V", "hero_image_url": None}
        incoming = {"hero_image_url": "https://example.com/hero.jpg"}
        _, updates = _run(current, incoming)
        assert updates is not None
        assert "hero_image_url" in updates

    def test_image_url_not_overwritten(self):
        current = {"id": 1, "name": "V", "image_url": "https://example.com/existing.jpg"}
        incoming = {"image_url": "https://example.com/new.jpg"}
        _, updates = _run(current, incoming)
        assert updates is None


class TestVibesBackfill:
    def test_vibes_backfilled_when_null(self):
        current = {"id": 1, "name": "V", "vibes": None}
        incoming = {"vibes": ["live-music", "dive-bar"]}
        with (
            patch.object(venues_module, "writes_enabled", return_value=True),
            patch.object(venues_module, "get_client", return_value=_make_client(current)),
            patch.object(venues_module, "VALID_VIBES", {"live-music", "dive-bar", "rooftop"}),
        ):
            _maybe_update_existing_venue(current["id"], incoming)
            client = _make_client(current)

        # Re-run with a captured client to inspect updates
        client = MagicMock()
        client.table.return_value.select.return_value.eq.return_value.execute.return_value = MagicMock(data=[current])
        with (
            patch.object(venues_module, "writes_enabled", return_value=True),
            patch.object(venues_module, "get_client", return_value=client),
            patch.object(venues_module, "VALID_VIBES", {"live-music", "dive-bar", "rooftop"}),
        ):
            _maybe_update_existing_venue(current["id"], incoming)

        update_mock = client.table.return_value.update
        assert update_mock.called
        passed = update_mock.call_args[0][0]
        assert set(passed["vibes"]) == {"live-music", "dive-bar"}

    def test_invalid_vibes_filtered_out(self):
        current = {"id": 1, "name": "V", "vibes": None}
        incoming = {"vibes": ["live-music", "not-a-real-vibe"]}
        client = MagicMock()
        client.table.return_value.select.return_value.eq.return_value.execute.return_value = MagicMock(data=[current])
        with (
            patch.object(venues_module, "writes_enabled", return_value=True),
            patch.object(venues_module, "get_client", return_value=client),
            patch.object(venues_module, "VALID_VIBES", {"live-music", "dive-bar"}),
        ):
            _maybe_update_existing_venue(current["id"], incoming)

        update_mock = client.table.return_value.update
        assert update_mock.called
        passed = update_mock.call_args[0][0]
        assert passed["vibes"] == ["live-music"]

    def test_all_invalid_vibes_skips_update(self):
        """If every incoming vibe is invalid, don't include vibes in the update."""
        current = {"id": 1, "name": "V", "vibes": None}
        incoming = {"vibes": ["not-valid"]}
        client = MagicMock()
        client.table.return_value.select.return_value.eq.return_value.execute.return_value = MagicMock(data=[current])
        with (
            patch.object(venues_module, "writes_enabled", return_value=True),
            patch.object(venues_module, "get_client", return_value=client),
            patch.object(venues_module, "VALID_VIBES", {"live-music", "dive-bar"}),
        ):
            _maybe_update_existing_venue(current["id"], incoming)

        update_mock = client.table.return_value.update
        assert not update_mock.called

    def test_existing_vibes_not_overwritten(self):
        current = {"id": 1, "name": "V", "vibes": ["rooftop"]}
        incoming = {"vibes": ["live-music", "dive-bar"]}
        _, updates = _run(current, incoming)
        assert updates is None


# ---------------------------------------------------------------------------
# Identity / administrative fields — NEVER updated
# ---------------------------------------------------------------------------

class TestProtectedFields:
    @pytest.mark.parametrize("field,incoming_val", [
        ("name", "New Name"),
        ("slug", "new-slug"),
        ("city", "Nashville"),
        ("state", "TN"),
        ("active", False),
    ])
    def test_protected_field_never_updated(self, field, incoming_val):
        current = {"id": 1, "name": "V", "slug": "v", "city": "Atlanta", "state": "GA", "active": True}
        incoming = {field: incoming_val}
        _, updates = _run(current, incoming)
        # If updates dict exists, the protected field must not be in it
        if updates is not None:
            assert field not in updates


# ---------------------------------------------------------------------------
# No-op behaviour
# ---------------------------------------------------------------------------

class TestNoOp:
    def test_no_update_when_nothing_improves(self):
        """Incoming data that doesn't improve any NULL field → no UPDATE issued."""
        current = {
            "id": 1,
            "name": "V",
            "lat": 33.0, "lng": -84.0,
            "address": "123 Main St",
            "description": "Existing description.",
            "image_url": "https://example.com/img.jpg",
        }
        incoming = {
            "lat": 33.9, "lng": -84.9,          # existing coords → skip
            "address": "999 Other St",            # existing → skip
            "description": "Short.",              # shorter → skip
            "image_url": "https://example.com/x", # existing → skip
        }
        _, updates = _run(current, incoming)
        assert updates is None

    def test_no_update_when_incoming_is_empty(self):
        current = {"id": 1, "name": "V"}
        _, updates = _run(current, {})
        assert updates is None

    def test_writes_disabled_skips_entirely(self):
        """When writes_enabled() is False, no DB queries at all."""
        client = MagicMock()
        with (
            patch.object(venues_module, "writes_enabled", return_value=False),
            patch.object(venues_module, "get_client", return_value=client),
        ):
            _maybe_update_existing_venue(1, {"lat": 33.749, "lng": -84.388})

        client.table.assert_not_called()

    def test_missing_venue_in_db_skips_gracefully(self):
        """If the venue ID doesn't exist in DB, no UPDATE is issued."""
        client = MagicMock()
        client.table.return_value.select.return_value.eq.return_value.execute.return_value = MagicMock(data=[])
        with (
            patch.object(venues_module, "writes_enabled", return_value=True),
            patch.object(venues_module, "get_client", return_value=client),
        ):
            _maybe_update_existing_venue(999, {"lat": 33.749, "lng": -84.388})

        update_mock = client.table.return_value.update
        assert not update_mock.called


# ---------------------------------------------------------------------------
# Combined scenario
# ---------------------------------------------------------------------------

class TestCombinedScenario:
    def test_multiple_null_fields_backfilled_in_one_update(self):
        """Multiple NULL fields should be collected and written in a single UPDATE."""
        current = {
            "id": 42,
            "name": "Empty Venue",
            "lat": None, "lng": None,
            "address": None,
            "neighborhood": None,
            "description": None,
            "image_url": None,
            "website": None,
            "venue_type": None,
            "vibes": None,
        }
        incoming = {
            "lat": 33.749,
            "lng": -84.388,
            "address": "100 Peachtree St",
            "neighborhood": "Downtown",
            "description": "A wonderful music venue in the heart of Atlanta.",
            "image_url": "https://example.com/img.jpg",
            "website": "https://venue.com",
            "venue_type": "music_venue",
            "vibes": ["live-music", "rooftop"],
            # These should never make it into updates:
            "name": "Hacker Name",
            "slug": "hacker-slug",
            "city": "Nashville",
        }
        client = MagicMock()
        client.table.return_value.select.return_value.eq.return_value.execute.return_value = MagicMock(data=[current])
        with (
            patch.object(venues_module, "writes_enabled", return_value=True),
            patch.object(venues_module, "get_client", return_value=client),
            patch.object(venues_module, "VALID_VIBES", {"live-music", "rooftop", "dive-bar"}),
        ):
            _maybe_update_existing_venue(42, incoming)

        update_mock = client.table.return_value.update
        assert update_mock.called
        updates = update_mock.call_args[0][0]

        # Backfilled fields present
        assert updates["lat"] == 33.749
        assert updates["lng"] == -84.388
        assert updates["address"] == "100 Peachtree St"
        assert updates["neighborhood"] == "Downtown"
        assert "description" in updates
        assert "image_url" in updates
        assert updates["website"] == "https://venue.com"
        assert updates["venue_type"] == "music_venue"
        assert set(updates["vibes"]) == {"live-music", "rooftop"}

        # Protected fields absent
        assert "name" not in updates
        assert "slug" not in updates
        assert "city" not in updates
