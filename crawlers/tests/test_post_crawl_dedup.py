"""
Tests for post_crawl_dedup.py — cross-source event deduplication batch job.
"""

from unittest.mock import MagicMock, patch


# ---------------------------------------------------------------------------
# normalize_title
# ---------------------------------------------------------------------------


def test_normalize_title_strips_leading_the():
    from post_crawl_dedup import normalize_title

    assert normalize_title("The Black Keys") == "black keys"


def test_normalize_title_strips_leading_a_and_an():
    from post_crawl_dedup import normalize_title

    assert normalize_title("A Night to Remember") == "night to remember"
    assert normalize_title("An Evening with Friends") == "evening with friends"


def test_normalize_title_strips_punctuation_and_collapses_whitespace():
    from post_crawl_dedup import normalize_title

    assert normalize_title("  Jazz Night! @ The Lounge  ") == "jazz night the lounge"


def test_normalize_title_lowercases():
    from post_crawl_dedup import normalize_title

    assert normalize_title("JAZZ NIGHT") == "jazz night"


def test_normalize_title_handles_none_and_empty():
    from post_crawl_dedup import normalize_title

    assert normalize_title("") == ""
    assert normalize_title(None) == ""  # type: ignore[arg-type]


def test_normalize_title_strips_sold_out_suffix():
    from post_crawl_dedup import normalize_title

    assert normalize_title("Jazz Night (Sold Out)") == "jazz night"
    assert normalize_title("Jazz Night (Cancelled)") == "jazz night"


def test_normalize_title_same_across_sources():
    """Events with minor punctuation differences should normalize identically."""
    from post_crawl_dedup import normalize_title

    assert normalize_title("Summer Concert Series") == normalize_title(
        "Summer Concert Series!"
    )


# ---------------------------------------------------------------------------
# pick_canonical
# ---------------------------------------------------------------------------


def test_pick_canonical_prefers_highest_data_quality():
    from post_crawl_dedup import pick_canonical

    events = [
        {"id": 1, "data_quality": 50, "image_url": None, "description": "", "ticket_url": None, "created_at": "2026-01-01"},
        {"id": 2, "data_quality": 90, "image_url": None, "description": "", "ticket_url": None, "created_at": "2026-01-02"},
        {"id": 3, "data_quality": 70, "image_url": None, "description": "", "ticket_url": None, "created_at": "2026-01-03"},
    ]
    result = pick_canonical(events)
    assert result["id"] == 2


def test_pick_canonical_prefers_image_over_no_image_when_quality_tied():
    from post_crawl_dedup import pick_canonical

    events = [
        {"id": 1, "data_quality": 80, "image_url": None, "description": "", "ticket_url": None, "created_at": "2026-01-01"},
        {"id": 2, "data_quality": 80, "image_url": "https://example.com/img.jpg", "description": "", "ticket_url": None, "created_at": "2026-01-02"},
    ]
    result = pick_canonical(events)
    assert result["id"] == 2


def test_pick_canonical_prefers_longer_description_when_quality_and_image_tied():
    from post_crawl_dedup import pick_canonical

    events = [
        {"id": 1, "data_quality": 80, "image_url": "https://x.com/a.jpg", "description": "Short.", "ticket_url": None, "created_at": "2026-01-01"},
        {"id": 2, "data_quality": 80, "image_url": "https://x.com/b.jpg", "description": "A much longer description with more detail about the event.", "ticket_url": None, "created_at": "2026-01-02"},
    ]
    result = pick_canonical(events)
    assert result["id"] == 2


def test_pick_canonical_prefers_ticket_url_as_tiebreaker():
    from post_crawl_dedup import pick_canonical

    events = [
        {"id": 1, "data_quality": 80, "image_url": "https://x.com/a.jpg", "description": "Same length desc.", "ticket_url": None, "created_at": "2026-01-02"},
        {"id": 2, "data_quality": 80, "image_url": "https://x.com/b.jpg", "description": "Same length desc.", "ticket_url": "https://tickets.com/event", "created_at": "2026-01-03"},
    ]
    result = pick_canonical(events)
    assert result["id"] == 2


def test_pick_canonical_falls_back_to_earliest_created_at():
    from post_crawl_dedup import pick_canonical

    events = [
        {"id": 1, "data_quality": 80, "image_url": None, "description": "", "ticket_url": None, "created_at": "2026-01-03"},
        {"id": 2, "data_quality": 80, "image_url": None, "description": "", "ticket_url": None, "created_at": "2026-01-01"},
    ]
    result = pick_canonical(events)
    assert result["id"] == 2


def test_pick_canonical_handles_none_data_quality():
    """None data_quality should be treated as 0."""
    from post_crawl_dedup import pick_canonical

    events = [
        {"id": 1, "data_quality": None, "image_url": None, "description": "", "ticket_url": None, "created_at": "2026-01-01"},
        {"id": 2, "data_quality": 60, "image_url": None, "description": "", "ticket_url": None, "created_at": "2026-01-02"},
    ]
    result = pick_canonical(events)
    assert result["id"] == 2


# ---------------------------------------------------------------------------
# find_duplicate_clusters
# ---------------------------------------------------------------------------


def _make_event(
    id: int,
    title: str,
    start_date: str,
    venue_id: int,
    source_id: int,
    **kwargs,
) -> dict:
    return {
        "id": id,
        "title": title,
        "start_date": start_date,
        "start_time": None,
        "venue_id": venue_id,
        "source_id": source_id,
        "canonical_event_id": None,
        "image_url": None,
        "description": None,
        "ticket_url": None,
        "created_at": "2026-01-01T00:00:00",
        "is_active": True,
        "data_quality": 70,
        **kwargs,
    }


def test_find_duplicate_clusters_groups_same_title_date_venue_different_sources():
    """Two events with the same title+date+venue from different sources = 1 cluster."""
    events = [
        _make_event(1, "Summer Concert", "2026-04-15", venue_id=10, source_id=100),
        _make_event(2, "Summer Concert", "2026-04-15", venue_id=10, source_id=200),
    ]

    mock_result = MagicMock()
    mock_result.data = events
    mock_client = MagicMock()
    mock_client.table.return_value.select.return_value.gte.return_value.lte.return_value.eq.return_value.is_.return_value.order.return_value.execute.return_value = mock_result

    with patch("post_crawl_dedup.get_client", return_value=mock_client):
        from post_crawl_dedup import find_duplicate_clusters

        clusters = find_duplicate_clusters(days_ahead=30)

    assert len(clusters) == 1
    assert len(clusters[0]) == 2
    ids = {e["id"] for e in clusters[0]}
    assert ids == {1, 2}


def test_find_duplicate_clusters_does_not_group_same_source():
    """Two events from the same source with matching title+date+venue are NOT a cross-source cluster."""
    events = [
        _make_event(1, "Trivia Night", "2026-04-15", venue_id=10, source_id=100),
        _make_event(2, "Trivia Night", "2026-04-15", venue_id=10, source_id=100),
    ]

    mock_result = MagicMock()
    mock_result.data = events
    mock_client = MagicMock()
    mock_client.table.return_value.select.return_value.gte.return_value.lte.return_value.eq.return_value.is_.return_value.order.return_value.execute.return_value = mock_result

    with patch("post_crawl_dedup.get_client", return_value=mock_client):
        from post_crawl_dedup import find_duplicate_clusters

        clusters = find_duplicate_clusters(days_ahead=30)

    assert clusters == []


def test_find_duplicate_clusters_does_not_group_different_dates():
    """Same title+venue but different dates are not duplicates."""
    events = [
        _make_event(1, "Jazz Night", "2026-04-15", venue_id=10, source_id=100),
        _make_event(2, "Jazz Night", "2026-04-22", venue_id=10, source_id=200),
    ]

    mock_result = MagicMock()
    mock_result.data = events
    mock_client = MagicMock()
    mock_client.table.return_value.select.return_value.gte.return_value.lte.return_value.eq.return_value.is_.return_value.order.return_value.execute.return_value = mock_result

    with patch("post_crawl_dedup.get_client", return_value=mock_client):
        from post_crawl_dedup import find_duplicate_clusters

        clusters = find_duplicate_clusters(days_ahead=30)

    assert clusters == []


def test_find_duplicate_clusters_does_not_group_different_venues():
    """Same title+date but different venue_id are not duplicates (could be a tour date)."""
    events = [
        _make_event(1, "The Black Keys", "2026-04-15", venue_id=10, source_id=100),
        _make_event(2, "The Black Keys", "2026-04-15", venue_id=99, source_id=200),
    ]

    mock_result = MagicMock()
    mock_result.data = events
    mock_client = MagicMock()
    mock_client.table.return_value.select.return_value.gte.return_value.lte.return_value.eq.return_value.is_.return_value.order.return_value.execute.return_value = mock_result

    with patch("post_crawl_dedup.get_client", return_value=mock_client):
        from post_crawl_dedup import find_duplicate_clusters

        clusters = find_duplicate_clusters(days_ahead=30)

    assert clusters == []


def test_find_duplicate_clusters_normalizes_title_before_grouping():
    """'The Summer Concert' and 'Summer Concert!' should cluster together."""
    events = [
        _make_event(1, "The Summer Concert", "2026-04-15", venue_id=10, source_id=100),
        _make_event(2, "Summer Concert!", "2026-04-15", venue_id=10, source_id=200),
    ]

    mock_result = MagicMock()
    mock_result.data = events
    mock_client = MagicMock()
    mock_client.table.return_value.select.return_value.gte.return_value.lte.return_value.eq.return_value.is_.return_value.order.return_value.execute.return_value = mock_result

    with patch("post_crawl_dedup.get_client", return_value=mock_client):
        from post_crawl_dedup import find_duplicate_clusters

        clusters = find_duplicate_clusters(days_ahead=30)

    assert len(clusters) == 1


def test_find_duplicate_clusters_skips_events_with_missing_venue():
    """Events with no venue_id cannot be matched and should be skipped."""
    events = [
        _make_event(1, "Mystery Show", "2026-04-15", venue_id=None, source_id=100),
        _make_event(2, "Mystery Show", "2026-04-15", venue_id=None, source_id=200),
    ]

    mock_result = MagicMock()
    mock_result.data = events
    mock_client = MagicMock()
    mock_client.table.return_value.select.return_value.gte.return_value.lte.return_value.eq.return_value.is_.return_value.order.return_value.execute.return_value = mock_result

    with patch("post_crawl_dedup.get_client", return_value=mock_client):
        from post_crawl_dedup import find_duplicate_clusters

        clusters = find_duplicate_clusters(days_ahead=30)

    assert clusters == []


def test_find_duplicate_clusters_returns_multiple_independent_clusters():
    """When two separate pairs of duplicates exist, both are returned."""
    events = [
        _make_event(1, "Event Alpha", "2026-04-15", venue_id=10, source_id=100),
        _make_event(2, "Event Alpha", "2026-04-15", venue_id=10, source_id=200),
        _make_event(3, "Event Beta", "2026-04-20", venue_id=20, source_id=300),
        _make_event(4, "Event Beta", "2026-04-20", venue_id=20, source_id=400),
    ]

    mock_result = MagicMock()
    mock_result.data = events
    mock_client = MagicMock()
    mock_client.table.return_value.select.return_value.gte.return_value.lte.return_value.eq.return_value.is_.return_value.order.return_value.execute.return_value = mock_result

    with patch("post_crawl_dedup.get_client", return_value=mock_client):
        from post_crawl_dedup import find_duplicate_clusters

        clusters = find_duplicate_clusters(days_ahead=30)

    assert len(clusters) == 2
