"""
Tests for database operations in db.py.
Uses mocked Supabase client to avoid actual database calls.
"""

from unittest.mock import patch, MagicMock


class TestGetOrCreateVenue:
    """Tests for get_or_create_venue function."""

    @patch("db.get_client")
    def test_finds_existing_venue_by_slug(self, mock_get_client, sample_venue_data):
        """Should return existing venue ID when slug matches."""
        client = MagicMock()
        mock_get_client.return_value = client

        # Setup mock to return existing venue
        table = MagicMock()
        client.table.return_value = table
        table.select.return_value = table
        table.eq.return_value = table
        table.execute.return_value = MagicMock(data=[{"id": 42}])

        from db import get_or_create_venue

        venue_id = get_or_create_venue(sample_venue_data)

        assert venue_id == 42
        client.table.assert_called_with("venues")

    @patch("db.get_client")
    def test_finds_existing_venue_by_name(self, mock_get_client, sample_venue_data):
        """Should return existing venue ID when name matches."""
        client = MagicMock()
        mock_get_client.return_value = client

        table = MagicMock()
        client.table.return_value = table
        table.select.return_value = table
        table.eq.return_value = table

        # First call (by slug) returns empty, second call (by name) returns venue
        table.execute.side_effect = [
            MagicMock(data=[]),  # No match by slug
            MagicMock(data=[{"id": 99}]),  # Match by name
        ]

        from db import get_or_create_venue

        venue_id = get_or_create_venue(sample_venue_data)

        assert venue_id == 99

    @patch("db.get_client")
    def test_creates_new_venue(self, mock_get_client, sample_venue_data):
        """Should create new venue when no match found."""
        client = MagicMock()
        mock_get_client.return_value = client

        table = MagicMock()
        client.table.return_value = table
        table.select.return_value = table
        table.eq.return_value = table
        table.insert.return_value = table

        # No existing venue found
        table.execute.side_effect = [
            MagicMock(data=[]),  # No match by slug
            MagicMock(data=[]),  # No match by name
            MagicMock(data=[{"id": 123}]),  # Insert returns new ID
        ]

        from db import get_or_create_venue

        venue_id = get_or_create_venue(sample_venue_data)

        assert venue_id == 123
        table.insert.assert_called_once_with(sample_venue_data)


class TestInsertEvent:
    """Tests for insert_event function."""

    @patch("db.get_festival_source_hint", return_value=None)
    @patch("db.get_venue_by_id_cached")
    @patch("db.get_client")
    def test_inserts_event_with_tags(
        self, mock_get_client, mock_get_venue, mock_festival_hint, sample_event_data
    ):
        """Should insert event and infer tags."""
        client = MagicMock()
        mock_get_client.return_value = client
        mock_get_venue.return_value = {"vibes": ["intimate"]}

        table = MagicMock()
        client.table.return_value = table
        table.insert.return_value = table
        table.execute.return_value = MagicMock(data=[{"id": 456}])

        from db import insert_event

        event_id = insert_event(sample_event_data)

        assert event_id == 456
        client.table.assert_any_call("events")
        table.insert.assert_called()

        # Verify tags were added to event data (first insert call is the event)
        inserted_data = table.insert.call_args_list[0][0][0]
        assert "tags" in inserted_data

    @patch("db.get_festival_source_hint", return_value=None)
    @patch("db.get_venue_by_id_cached")
    @patch("db.get_client")
    def test_inherits_venue_vibes(
        self, mock_get_client, mock_get_venue, mock_festival_hint, sample_event_data
    ):
        """Should inherit vibes from venue when inferring tags."""
        client = MagicMock()
        mock_get_client.return_value = client
        mock_get_venue.return_value = {"vibes": ["intimate", "all-ages"]}

        table = MagicMock()
        client.table.return_value = table
        table.insert.return_value = table
        table.execute.return_value = MagicMock(data=[{"id": 789}])

        from db import insert_event

        insert_event(sample_event_data)

        # Verify tags include inherited vibes (first insert call is the event)
        inserted_data = table.insert.call_args_list[0][0][0]
        assert "intimate" in inserted_data["tags"]
        assert "all-ages" in inserted_data["tags"]

    @patch("db.get_festival_source_hint", return_value=None)
    @patch("db.get_venue_by_id_cached")
    @patch("db.get_client")
    def test_normalizes_activism_category_to_community_with_genre(
        self, mock_get_client, mock_get_venue, mock_festival_hint, sample_event_data
    ):
        """Should map activism category to community and preserve activism as a genre signal."""
        client = MagicMock()
        mock_get_client.return_value = client
        mock_get_venue.return_value = {"vibes": []}

        table = MagicMock()
        client.table.return_value = table
        table.insert.return_value = table
        table.execute.return_value = MagicMock(data=[{"id": 999}])

        from db import insert_event

        event_data = dict(sample_event_data)
        event_data["category"] = "activism"
        event_data["tags"] = ["activism"]
        event_data["title"] = "Community Organizing Rally"

        insert_event(event_data)

        inserted_data = table.insert.call_args_list[0][0][0]
        assert inserted_data["category"] == "community"
        assert "activism" in (inserted_data.get("genres") or [])

    @patch("db.get_festival_source_hint", return_value=None)
    @patch("db.get_venue_by_id_cached")
    @patch("db.get_client")
    def test_defaults_invalid_category_to_other(
        self, mock_get_client, mock_get_venue, mock_festival_hint, sample_event_data
    ):
        """Should default invalid categories to 'other' instead of rejecting the event."""
        client = MagicMock()
        mock_get_client.return_value = client
        mock_get_venue.return_value = {"vibes": []}

        table = MagicMock()
        client.table.return_value = table
        table.insert.return_value = table
        table.execute.return_value = MagicMock(data=[{"id": 888}])

        from db import insert_event

        event_data = dict(sample_event_data)
        event_data["category"] = "invalid_garbage_category"
        event_data["title"] = "Some Event"

        event_id = insert_event(event_data)

        # Event should be inserted, not rejected
        assert event_id == 888

        # Category should be defaulted to "other"
        inserted_data = table.insert.call_args_list[0][0][0]
        assert inserted_data["category"] == "other"


class TestFindEventByHash:
    """Tests for find_event_by_hash function."""

    @patch("db.get_client")
    def test_finds_existing_event(self, mock_get_client):
        """Should return event when hash matches."""
        client = MagicMock()
        mock_get_client.return_value = client

        table = MagicMock()
        client.table.return_value = table
        table.select.return_value = table
        table.eq.return_value = table
        table.execute.return_value = MagicMock(
            data=[{"id": 1, "title": "Test Event", "content_hash": "abc123"}]
        )

        from db import find_event_by_hash

        result = find_event_by_hash("abc123")

        assert result is not None
        assert result["id"] == 1
        assert result["title"] == "Test Event"

    @patch("db.get_client")
    def test_returns_none_when_not_found(self, mock_get_client):
        """Should return None when no match found."""
        client = MagicMock()
        mock_get_client.return_value = client

        table = MagicMock()
        client.table.return_value = table
        table.select.return_value = table
        table.eq.return_value = table
        table.execute.return_value = MagicMock(data=[])

        from db import find_event_by_hash

        result = find_event_by_hash("nonexistent")

        assert result is None


class TestFindEventsByDateAndVenue:
    """Tests for find_events_by_date_and_venue function."""

    @patch("db.get_client")
    def test_finds_events(self, mock_get_client):
        """Should return events matching date and venue."""
        client = MagicMock()
        mock_get_client.return_value = client

        table = MagicMock()
        client.table.return_value = table
        table.select.return_value = table
        table.eq.return_value = table
        table.execute.return_value = MagicMock(
            data=[
                {"id": 1, "title": "Event 1"},
                {"id": 2, "title": "Event 2"},
            ]
        )

        from db import find_events_by_date_and_venue

        results = find_events_by_date_and_venue("2026-01-15", 42)

        assert len(results) == 2
        assert results[0]["title"] == "Event 1"

    @patch("db.get_client")
    def test_returns_empty_list(self, mock_get_client):
        """Should return empty list when no events found."""
        client = MagicMock()
        mock_get_client.return_value = client

        table = MagicMock()
        client.table.return_value = table
        table.select.return_value = table
        table.eq.return_value = table
        table.execute.return_value = MagicMock(data=None)

        from db import find_events_by_date_and_venue

        results = find_events_by_date_and_venue("2026-01-15", 999)

        assert results == []


class TestCrawlLog:
    """Tests for crawl log functions."""

    @patch("db.get_client")
    def test_create_crawl_log(self, mock_get_client):
        """Should create a crawl log entry."""
        client = MagicMock()
        mock_get_client.return_value = client

        table = MagicMock()
        client.table.return_value = table
        table.insert.return_value = table
        table.execute.return_value = MagicMock(data=[{"id": 100}])

        from db import create_crawl_log

        log_id = create_crawl_log(source_id=1)

        assert log_id == 100
        client.table.assert_called_with("crawl_logs")

        # Verify log data
        insert_data = table.insert.call_args[0][0]
        assert insert_data["source_id"] == 1
        assert insert_data["status"] == "running"
        assert "started_at" in insert_data

    @patch("db.get_client")
    def test_update_crawl_log(self, mock_get_client):
        """Should update crawl log with results."""
        client = MagicMock()
        mock_get_client.return_value = client

        table = MagicMock()
        client.table.return_value = table
        table.update.return_value = table
        table.eq.return_value = table
        table.execute.return_value = MagicMock(data=[])

        from db import update_crawl_log

        update_crawl_log(
            log_id=100,
            status="completed",
            events_found=10,
            events_new=5,
            events_updated=3,
        )

        client.table.assert_called_with("crawl_logs")
        table.update.assert_called_once()

        update_data = table.update.call_args[0][0]
        assert update_data["status"] == "completed"
        assert update_data["events_found"] == 10
        assert update_data["events_new"] == 5
        assert update_data["events_updated"] == 3
        assert "completed_at" in update_data

    @patch("db.get_client")
    def test_update_crawl_log_with_error(self, mock_get_client):
        """Should include error message when provided."""
        client = MagicMock()
        mock_get_client.return_value = client

        table = MagicMock()
        client.table.return_value = table
        table.update.return_value = table
        table.eq.return_value = table
        table.execute.return_value = MagicMock(data=[])

        from db import update_crawl_log

        update_crawl_log(
            log_id=100, status="failed", error_message="Connection timeout"
        )

        update_data = table.update.call_args[0][0]
        assert update_data["status"] == "failed"
        assert update_data["error_message"] == "Connection timeout"
