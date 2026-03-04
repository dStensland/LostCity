"""
Tests for series.py — series matching / creation logic.
All tests use MagicMock to avoid real database calls.
"""

from unittest.mock import MagicMock, call
import pytest

from series import find_series_by_title, slugify, normalize_title


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_client(side_effects: list) -> MagicMock:
    """
    Return a mock Supabase client whose table().select()…execute() chain
    returns successive values from *side_effects*.

    Every element of side_effects is either:
    - a list  → returned as .data on that execute() call
    - None    → returned as .data = [] (convenience)
    """
    client = MagicMock()
    table = MagicMock()
    client.table.return_value = table

    # Each chained method returns the same table mock so callers can chain freely.
    table.select.return_value = table
    table.eq.return_value = table
    table.is_.return_value = table

    data_values = [
        MagicMock(data=(v if v is not None else []))
        for v in side_effects
    ]
    table.execute.side_effect = data_values
    return client


# ---------------------------------------------------------------------------
# find_series_by_title — basic cases
# ---------------------------------------------------------------------------

class TestFindSeriesByTitleExactMatch:
    def test_returns_record_on_exact_title_match(self):
        """First execute() returning data should short-circuit the rest."""
        record = {"id": "abc-123", "title": "Team Trivia", "series_type": "recurring_show"}
        client = _make_client([[record]])

        result = find_series_by_title(client, "Team Trivia", "recurring_show")

        assert result == record

    def test_returns_none_when_no_match(self):
        """All fallbacks exhausted → None."""
        # No day_of_week, series_type without day branch:
        # Two queries: exact title, slug
        client = _make_client([[], []])

        result = find_series_by_title(client, "Obscure Night", "recurring_show")

        assert result is None

    def test_slug_fallback_on_title_miss(self):
        """When exact title query returns empty, slug query should find it."""
        record = {"id": "xyz", "title": "Team Trivia", "series_type": "recurring_show"}
        client = _make_client([[], [record]])

        result = find_series_by_title(client, "Team Trivia", "recurring_show")

        assert result == record


# ---------------------------------------------------------------------------
# find_series_by_title — day_of_week cases
# ---------------------------------------------------------------------------

class TestFindSeriesByTitleWithDayOfWeek:
    def test_exact_match_with_correct_day(self):
        """Exact title + day_of_week → found immediately."""
        record = {"id": "d1", "title": "OutSpoken Team Trivia", "day_of_week": "tuesday"}
        client = _make_client([[record]])

        result = find_series_by_title(
            client, "OutSpoken Team Trivia", "recurring_show", day_of_week="Tuesday"
        )

        assert result == record

    def test_null_day_fallback(self):
        """
        When use_day is True and exact+slug queries miss, the NULL-day
        fallback should find a record that was auto-created without day info.
        """
        record = {"id": "d2", "title": "OutSpoken Team Trivia", "day_of_week": None}
        # Sequence: exact+day miss, slug+day miss, exact+NULL hit
        client = _make_client([[], [], [record]])

        result = find_series_by_title(
            client, "OutSpoken Team Trivia", "recurring_show", day_of_week="Tuesday"
        )

        assert result == record

    def test_any_day_fallback_prevents_duplicate_series(self):
        """
        Core regression test: a subsequent crawl with a different day_of_week
        must NOT create a new series — instead it must return the existing one.

        Sequence of execute() calls when use_day=True and all prior checks miss:
          1. exact title + day_of_week filter  → []
          2. slug + day_of_week filter          → []
          3. exact title + NULL day_of_week     → []
          4. slug + NULL day_of_week            → []
          5. exact title, no day filter         → [record]   ← new fallback
        """
        existing = {"id": "tour-1", "title": "OutSpoken Team Trivia", "day_of_week": "wednesday"}
        client = _make_client([[], [], [], [], [existing]])

        result = find_series_by_title(
            client,
            "OutSpoken Team Trivia",
            "recurring_show",
            day_of_week="monday",  # different day than what's stored
        )

        assert result == existing, (
            "Should have found the existing touring series via the any-day fallback "
            "instead of returning None (which would trigger duplicate creation)"
        )

    def test_any_day_slug_fallback(self):
        """
        Same as above but the any-day title query misses and the slug query hits.

        Sequence:
          1. exact title + day  → []
          2. slug + day         → []
          3. exact + NULL day   → []
          4. slug + NULL day    → []
          5. exact, no day      → []
          6. slug, no day       → [record]   ← slug variant of new fallback
        """
        existing = {"id": "tour-2", "title": "Geeks Who Drink", "day_of_week": "thursday"}
        client = _make_client([[], [], [], [], [], [existing]])

        result = find_series_by_title(
            client,
            "Geeks Who Drink",
            "recurring_show",
            day_of_week="friday",
        )

        assert result == existing

    def test_no_false_positive_without_day(self):
        """
        When use_day is False (no day_of_week supplied), only the two base
        queries run — the day-fallback branches must not execute.
        """
        client = _make_client([[], []])  # only 2 execute() calls expected

        result = find_series_by_title(
            client, "Team Trivia", "recurring_show", day_of_week=None
        )

        assert result is None
        assert client.table().execute.call_count == 2

    def test_class_series_also_uses_any_day_fallback(self):
        """The any-day fallback applies to class_series too, not just recurring_show."""
        existing = {"id": "yoga-1", "title": "Morning Yoga", "day_of_week": "monday"}
        client = _make_client([[], [], [], [], [existing]])

        result = find_series_by_title(
            client, "Morning Yoga", "class_series", day_of_week="tuesday"
        )

        assert result == existing

    def test_film_type_does_not_use_any_day_fallback(self):
        """
        use_day is only True for recurring_show and class_series.
        Film series should never enter the day-of-week branches.
        Two base queries only.
        """
        client = _make_client([[], []])  # only 2 execute() calls expected

        result = find_series_by_title(
            client, "Casablanca", "film", day_of_week="wednesday"
        )

        assert result is None
        assert client.table().execute.call_count == 2
