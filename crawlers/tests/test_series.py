"""
Tests for series.py — series matching / creation logic.
All tests use MagicMock to avoid real database calls.
"""

from unittest.mock import MagicMock, call
import pytest

from series import find_series_by_title, get_or_create_series, slugify, normalize_title


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

    def test_different_day_does_not_reuse_existing_series(self):
        """
        Different weekday series must not collapse onto the same record just
        because title + series_type match. That corrupts recurring metadata.
        """
        client = _make_client([[], [], [], []])

        result = find_series_by_title(
            client,
            "OutSpoken Team Trivia",
            "recurring_show",
            day_of_week="monday",
        )

        assert result is None

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


class TestGetOrCreateSeries:
    def test_backfills_missing_metadata_on_existing_film_series(self):
        client = MagicMock()
        table = MagicMock()
        client.table.return_value = table
        table.select.return_value = table
        table.eq.return_value = table
        table.ilike.return_value = table
        table.update.return_value = table
        table.execute.side_effect = [
            MagicMock(data=[{"id": "atlanta-film-festival", "festival_type": None, "website": None}]),
            MagicMock(
                data=[
                    {
                        "id": "series-1",
                        "title": "Power Ballad",
                        "festival_id": "atlanta-film-festival",
                        "series_type": "film",
                        "description": None,
                        "image_url": None,
                        "director": None,
                        "runtime_minutes": None,
                        "year": None,
                        "rating": None,
                        "imdb_id": None,
                        "genres": None,
                    }
                ]
            ),
            MagicMock(data=[{"id": "series-1"}]),
        ]

        series_id = get_or_create_series(
            client,
            {
                "series_type": "film",
                "series_title": "Power Ballad",
                "festival_name": "Atlanta Film Festival",
                "description": "Film synopsis",
                "image_url": "https://example.com/poster.jpg",
                "director": "John Carney",
                "runtime_minutes": 98,
                "year": 2026,
                "imdb_id": "tt1234567",
            },
            category="film",
        )

        assert series_id == "series-1"
        update_payload = table.update.call_args_list[-1].args[0]
        assert update_payload["description"] == "Film synopsis"
        assert update_payload["image_url"] == "https://example.com/poster.jpg"
        assert update_payload["director"] == "John Carney"
        assert update_payload["runtime_minutes"] == 98
        assert update_payload["year"] == 2026
        assert update_payload["imdb_id"] == "tt1234567"

    def test_backfills_whitespace_only_metadata_on_existing_film_series(self):
        client = MagicMock()
        table = MagicMock()
        client.table.return_value = table
        table.select.return_value = table
        table.eq.return_value = table
        table.ilike.return_value = table
        table.update.return_value = table
        table.execute.side_effect = [
            MagicMock(data=[{"id": "atlanta-film-festival", "festival_type": None, "website": None}]),
            MagicMock(
                data=[
                    {
                        "id": "series-1",
                        "title": "Building Bombs",
                        "festival_id": "atlanta-film-festival",
                        "series_type": "film",
                        "description": "   ",
                        "image_url": " ",
                        "director": " ",
                        "runtime_minutes": None,
                        "year": 1989,
                        "rating": None,
                        "imdb_id": " ",
                        "genres": [],
                    }
                ]
            ),
            MagicMock(data=[{"id": "series-1"}]),
        ]

        series_id = get_or_create_series(
            client,
            {
                "series_type": "film",
                "series_title": "Building Bombs",
                "festival_name": "Atlanta Film Festival",
                "description": "Feature synopsis",
                "image_url": "https://example.com/building-bombs.jpg",
                "director": "Paul Devlin",
                "runtime_minutes": 97,
                "year": 1989,
                "imdb_id": "tt0099185",
                "genres": ["documentary"],
            },
            category="film",
        )

        assert series_id == "series-1"
        update_payload = table.update.call_args_list[-1].args[0]
        assert update_payload["description"] == "Feature synopsis"
        assert update_payload["image_url"] == "https://example.com/building-bombs.jpg"
        assert update_payload["director"] == "Paul Devlin"
        assert update_payload["runtime_minutes"] == 97
        assert update_payload["imdb_id"] == "tt0099185"
        assert update_payload["genres"] == ["documentary"]

    def test_class_series_also_keeps_day_boundaries(self):
        """class_series should not reuse a different-day series record either."""
        client = _make_client([[], [], [], []])

        result = find_series_by_title(
            client, "Morning Yoga", "class_series", day_of_week="tuesday"
        )

        assert result is None

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
