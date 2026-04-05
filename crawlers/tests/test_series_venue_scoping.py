"""
Tests for venue-scoped series matching.

Verifies that class_series and recurring_show with different venue_ids produce
separate series records, and that film/festival types ignore venue_id entirely.
All tests mock the Supabase client to avoid real database calls.
"""

from unittest.mock import MagicMock, patch

from series import find_series_by_title, get_or_create_series


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_client(side_effects: list) -> MagicMock:
    """
    Return a mock Supabase client whose chained table()…execute() calls
    return successive values from *side_effects*.

    Elements are either a list (returned as .data) or None (.data = []).
    """
    client = MagicMock()
    table = MagicMock()
    client.table.return_value = table

    table.select.return_value = table
    table.eq.return_value = table
    table.is_.return_value = table
    table.insert.return_value = table
    table.update.return_value = table

    data_values = [
        MagicMock(data=(v if v is not None else []))
        for v in side_effects
    ]
    table.execute.side_effect = data_values
    return client


# ---------------------------------------------------------------------------
# find_series_by_title — venue scoping
# ---------------------------------------------------------------------------

class TestFindSeriesByTitleVenueScoping:
    def test_same_title_different_venue_ids_return_none(self):
        """
        When venue_id is provided, queries include a venue-scope filter.
        A series stored under venue 1 must NOT be returned when searching
        for venue 2 — the mock will return empty for all queries.
        """
        client = _make_client([[], []])  # exact title miss, slug miss

        with patch("series._detect_series_venue_column", return_value="venue_id"):
            result = find_series_by_title(
                client,
                "Yoga Basics",
                "class_series",
                venue_id=2,
            )

        assert result is None

    def test_exact_match_with_matching_venue_id(self):
        """When venue_id matches, the record is returned on first query."""
        record = {"id": "abc", "title": "Yoga Basics", "venue_id": 1}
        client = _make_client([[record]])

        with patch("series._detect_series_venue_column", return_value="venue_id"):
            result = find_series_by_title(
                client,
                "Yoga Basics",
                "class_series",
                venue_id=1,
            )

        assert result == record

    def test_venue_filter_applied_to_recurring_show(self):
        """recurring_show also uses venue scoping."""
        record = {"id": "xyz", "title": "Monday Night Trivia", "venue_id": 42}
        client = _make_client([[record]])

        with patch("series._detect_series_venue_column", return_value="venue_id"):
            result = find_series_by_title(
                client,
                "Monday Night Trivia",
                "recurring_show",
                venue_id=42,
            )

        assert result == record

    def test_film_type_ignores_venue_id(self):
        """Film series must never apply a venue_id filter — only 2 queries run."""
        client = _make_client([[], []])  # exactly 2 queries expected

        with patch("series._detect_series_venue_column", return_value="venue_id"):
            result = find_series_by_title(
                client,
                "Casablanca",
                "film",
                venue_id=99,
            )

        assert result is None
        assert client.table().execute.call_count == 2

    def test_no_venue_id_does_not_add_filter(self):
        """When venue_id is None, no venue filter is applied for class_series."""
        client = _make_client([[], []])  # exactly 2 queries expected

        with patch("series._detect_series_venue_column", return_value="venue_id"):
            result = find_series_by_title(
                client,
                "Yoga Basics",
                "class_series",
                venue_id=None,
            )

        assert result is None
        # eq should NOT have been called with "venue_id"
        eq_calls = [str(c) for c in client.table().eq.call_args_list]
        assert not any("venue_id" in c for c in eq_calls)


# ---------------------------------------------------------------------------
# get_or_create_series — two venues produce two records
# ---------------------------------------------------------------------------

class TestGetOrCreateSeriesVenueScoping:
    def _patch_resolve_festival(self):
        """Patch resolve_festival_id so it always returns None (no festival)."""
        return patch("series.resolve_festival_id", return_value=None)

    def test_different_venue_ids_create_separate_series(self):
        """
        Calling get_or_create_series twice with the same title but different
        venue_ids should result in two separate INSERT calls (two new series).

        Per-call execute() sequence:
          1. find exact title → [] (miss)
          2. find by slug    → [] (miss)
          3. slug uniqueness check in create_series → [] (slug free)
          4. insert          → [new_series]
        Total: 4 per call = 8 for both.
        """
        new_series_1 = {"id": "series-venue-1", "title": "Yoga Basics", "slug": "yoga-basics"}
        new_series_2 = {"id": "series-venue-2", "title": "Yoga Basics", "slug": "yoga-basics-1"}

        client = _make_client([
            # --- First call (venue_id=10) ---
            [],              # find exact title → miss
            [],              # find by slug → miss
            [],              # create_series: slug uniqueness check → free
            [new_series_1],  # insert → returns record
            # --- Second call (venue_id=20) ---
            [],              # find exact title → miss
            [],              # find by slug → miss
            [],              # create_series: slug uniqueness check → free
            [new_series_2],  # insert → returns record
        ])

        hint_1 = {"series_type": "class_series", "series_title": "Yoga Basics", "venue_id": 10}
        hint_2 = {"series_type": "class_series", "series_title": "Yoga Basics", "venue_id": 20}

        with self._patch_resolve_festival(), patch(
            "series._detect_series_venue_column", return_value="venue_id"
        ):
            id_1 = get_or_create_series(client, hint_1)
            id_2 = get_or_create_series(client, hint_2)

        assert id_1 == "series-venue-1"
        assert id_2 == "series-venue-2"
        assert id_1 != id_2

    def test_film_series_ignores_venue_id_in_hint(self):
        """
        For film series_type, venue_id in the hint must not be passed to
        find_series_by_title (use_venue=False for film).  Two find queries only,
        then a create path.
        """
        new_series = {"id": "film-1", "title": "Casablanca", "slug": "casablanca"}

        client = _make_client([
            [],          # find exact title → miss
            [],          # find by slug → miss
            [],          # slug uniqueness check → free
            [new_series],  # insert → returns record
        ])

        hint = {
            "series_type": "film",
            "series_title": "Casablanca",
            "venue_id": 99,
        }

        with self._patch_resolve_festival(), patch(
            "series._detect_series_venue_column", return_value="venue_id"
        ):
            series_id = get_or_create_series(client, hint, venue_id=99)

        assert series_id == "film-1"

        # Confirm venue_id was never used as a filter: eq("venue_id", ...) not called
        eq_calls = [str(c) for c in client.table().eq.call_args_list]
        assert not any("venue_id" in c for c in eq_calls)

    def test_legacy_place_id_column_is_still_supported(self):
        new_series = {"id": "series-legacy", "title": "Yoga Basics", "slug": "yoga-basics"}

        client = _make_client([
            [],
            [],
            [],
            [new_series],
        ])

        hint = {"series_type": "class_series", "series_title": "Yoga Basics", "venue_id": 10}

        with self._patch_resolve_festival(), patch(
            "series._detect_series_venue_column", return_value="place_id"
        ):
            series_id = get_or_create_series(client, hint)

        assert series_id == "series-legacy"
        insert_payload = client.table().insert.call_args.args[0]
        assert insert_payload["place_id"] == 10

    def test_missing_series_venue_column_skips_venue_scope_without_crashing(self):
        new_series = {"id": "series-noscope", "title": "Yoga Basics", "slug": "yoga-basics"}

        client = _make_client([
            [],
            [],
            [],
            [new_series],
        ])

        hint = {"series_type": "class_series", "series_title": "Yoga Basics", "venue_id": 10}

        with self._patch_resolve_festival(), patch(
            "series._detect_series_venue_column", return_value=None
        ):
            series_id = get_or_create_series(client, hint)

        assert series_id == "series-noscope"
        insert_payload = client.table().insert.call_args.args[0]
        assert "venue_id" not in insert_payload
        assert "place_id" not in insert_payload
