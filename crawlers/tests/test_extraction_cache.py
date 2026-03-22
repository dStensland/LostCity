import hashlib
from unittest.mock import MagicMock, patch
from pipeline.extraction_cache import get_cached_extraction, store_extraction, compute_content_hash


def test_compute_content_hash_is_deterministic():
    assert compute_content_hash("<html>test</html>") == compute_content_hash("<html>test</html>")


def test_compute_content_hash_differs_for_different_content():
    assert compute_content_hash("<html>a</html>") != compute_content_hash("<html>b</html>")


def test_get_cached_extraction_returns_none_on_miss():
    client = MagicMock()
    client.table.return_value.select.return_value.eq.return_value.eq.return_value.maybeSingle.return_value.execute.return_value.data = None
    result = get_cached_extraction(client, "test-source", "abc123")
    assert result is None


def test_get_cached_extraction_returns_data_on_hit():
    client = MagicMock()
    cached = [{"title": "Test Event"}]
    client.table.return_value.select.return_value.eq.return_value.eq.return_value.maybeSingle.return_value.execute.return_value.data = {"extraction_result": cached}
    result = get_cached_extraction(client, "test-source", "abc123")
    assert result == cached


def test_store_extraction_upserts():
    client = MagicMock()
    with patch("pipeline.extraction_cache.writes_enabled", return_value=True):
        store_extraction(client, "test-source", "abc123", [{"title": "Test"}])
    client.table.return_value.upsert.assert_called_once()
