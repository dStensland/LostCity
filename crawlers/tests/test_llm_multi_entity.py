"""
Tests for llm_multi_entity — focused per-lane LLM extraction calls.
"""

from unittest.mock import patch, MagicMock

import pytest

from pipeline.llm_multi_entity import extract_entities_for_lanes


# ---------------------------------------------------------------------------
# Primary (events) lane
# ---------------------------------------------------------------------------


def test_only_calls_event_extraction_for_events_lane():
    with patch("pipeline.llm_multi_entity.extract_events") as mock:
        mock.return_value = [
            MagicMock(model_dump=lambda: {"title": "Test", "content_kind": "event"})
        ]
        result = extract_entities_for_lanes(
            "<html>test</html>", "http://test.com", "Test", ["events"]
        )
    assert len(result) >= 1
    mock.assert_called_once()


def test_event_extraction_returns_dicts():
    """Results must always be plain dicts, not EventData objects."""
    event_data = {"title": "Jazz Night", "content_kind": "event", "start_date": "2026-04-01"}
    with patch("pipeline.llm_multi_entity.extract_events") as mock:
        mock.return_value = [MagicMock(model_dump=lambda: event_data)]
        result = extract_entities_for_lanes(
            "<html></html>", "http://test.com", "Test", ["events"]
        )
    assert all(isinstance(r, dict) for r in result)
    assert result[0]["title"] == "Jazz Night"


def test_returns_empty_list_when_no_lanes_declared():
    result = extract_entities_for_lanes(
        "<html></html>", "http://test.com", "Test", []
    )
    assert result == []


def test_empty_extraction_result():
    with patch("pipeline.llm_multi_entity.extract_events") as mock:
        mock.return_value = []
        result = extract_entities_for_lanes(
            "<html></html>", "http://test.com", "Test", ["events"]
        )
    assert result == []


# ---------------------------------------------------------------------------
# destination_details lane
# ---------------------------------------------------------------------------


def test_calls_venue_extraction_when_destination_details_declared():
    with patch("pipeline.llm_multi_entity.extract_events") as mock_events, \
         patch("pipeline.llm_multi_entity.extract_venue_metadata") as mock_venue:
        mock_events.return_value = []
        mock_venue.return_value = {"hours": "9-5", "description": "Great place"}
        result = extract_entities_for_lanes(
            "<html>test</html>",
            "http://test.com",
            "Test",
            ["events", "destination_details"],
        )
    mock_venue.assert_called_once()


def test_skips_venue_when_not_declared():
    with patch("pipeline.llm_multi_entity.extract_events") as mock_events, \
         patch("pipeline.llm_multi_entity.extract_venue_metadata") as mock_venue:
        mock_events.return_value = []
        extract_entities_for_lanes(
            "<html></html>", "http://test.com", "Test", ["events"]
        )
    mock_venue.assert_not_called()


def test_venue_metadata_included_in_results():
    """Venue metadata dict should appear in results tagged with the right lane."""
    metadata = {"hours": "Mon-Fri 9am-5pm", "description": "A fine gallery"}
    with patch("pipeline.llm_multi_entity.extract_events") as mock_events, \
         patch("pipeline.llm_multi_entity.extract_venue_metadata") as mock_venue:
        mock_events.return_value = []
        mock_venue.return_value = metadata
        result = extract_entities_for_lanes(
            "<html></html>",
            "http://test.com",
            "Test",
            ["events", "destination_details"],
        )
    venue_results = [r for r in result if r.get("_lane") == "destination_details"]
    assert len(venue_results) == 1
    assert venue_results[0]["hours"] == "Mon-Fri 9am-5pm"


def test_none_venue_metadata_not_included():
    """If extract_venue_metadata returns None, nothing is added to results."""
    with patch("pipeline.llm_multi_entity.extract_events") as mock_events, \
         patch("pipeline.llm_multi_entity.extract_venue_metadata") as mock_venue:
        mock_events.return_value = []
        mock_venue.return_value = None
        result = extract_entities_for_lanes(
            "<html></html>",
            "http://test.com",
            "Test",
            ["events", "destination_details"],
        )
    venue_results = [r for r in result if r.get("_lane") == "destination_details"]
    assert len(venue_results) == 0


# ---------------------------------------------------------------------------
# venue_specials lane
# ---------------------------------------------------------------------------


def test_calls_specials_when_venue_specials_declared():
    with patch("pipeline.llm_multi_entity.extract_events") as mock_events, \
         patch("pipeline.llm_multi_entity.extract_specials") as mock_specials:
        mock_events.return_value = []
        mock_specials.return_value = [{"name": "Happy Hour", "days": ["monday"]}]
        result = extract_entities_for_lanes(
            "<html></html>",
            "http://test.com",
            "Test",
            ["events", "venue_specials"],
        )
    mock_specials.assert_called_once()


def test_skips_specials_when_not_declared():
    with patch("pipeline.llm_multi_entity.extract_events") as mock_events, \
         patch("pipeline.llm_multi_entity.extract_specials") as mock_specials:
        mock_events.return_value = []
        extract_entities_for_lanes(
            "<html></html>", "http://test.com", "Test", ["events"]
        )
    mock_specials.assert_not_called()


def test_specials_included_in_results():
    """Specials dicts should appear in results tagged with venue_specials lane."""
    specials = [
        {"name": "Happy Hour", "days": ["monday", "tuesday"]},
        {"name": "Sunday Brunch", "days": ["sunday"]},
    ]
    with patch("pipeline.llm_multi_entity.extract_events") as mock_events, \
         patch("pipeline.llm_multi_entity.extract_specials") as mock_specials:
        mock_events.return_value = []
        mock_specials.return_value = specials
        result = extract_entities_for_lanes(
            "<html></html>",
            "http://test.com",
            "Test",
            ["events", "venue_specials"],
        )
    specials_results = [r for r in result if r.get("_lane") == "venue_specials"]
    assert len(specials_results) == 2
    assert specials_results[0]["name"] == "Happy Hour"


def test_empty_specials_not_added():
    with patch("pipeline.llm_multi_entity.extract_events") as mock_events, \
         patch("pipeline.llm_multi_entity.extract_specials") as mock_specials:
        mock_events.return_value = []
        mock_specials.return_value = []
        result = extract_entities_for_lanes(
            "<html></html>",
            "http://test.com",
            "Test",
            ["events", "venue_specials"],
        )
    specials_results = [r for r in result if r.get("_lane") == "venue_specials"]
    assert len(specials_results) == 0


# ---------------------------------------------------------------------------
# Multi-lane combinations
# ---------------------------------------------------------------------------


def test_all_three_lanes_declared():
    """All three extractor functions called when all lanes declared."""
    with patch("pipeline.llm_multi_entity.extract_events") as mock_events, \
         patch("pipeline.llm_multi_entity.extract_venue_metadata") as mock_venue, \
         patch("pipeline.llm_multi_entity.extract_specials") as mock_specials:
        mock_events.return_value = [
            MagicMock(model_dump=lambda: {"title": "Event", "content_kind": "event"})
        ]
        mock_venue.return_value = {"hours": "9-5"}
        mock_specials.return_value = [{"name": "HH"}]
        result = extract_entities_for_lanes(
            "<html></html>",
            "http://test.com",
            "Test",
            ["events", "destination_details", "venue_specials"],
        )
    mock_events.assert_called_once()
    mock_venue.assert_called_once()
    mock_specials.assert_called_once()
    assert len(result) == 3  # 1 event + 1 venue + 1 special


def test_events_lane_not_declared_skips_event_extraction():
    """No event extraction if 'events' not in declared lanes."""
    with patch("pipeline.llm_multi_entity.extract_events") as mock_events, \
         patch("pipeline.llm_multi_entity.extract_venue_metadata") as mock_venue:
        mock_venue.return_value = {"hours": "9-5"}
        result = extract_entities_for_lanes(
            "<html></html>",
            "http://test.com",
            "Test",
            ["destination_details"],
        )
    mock_events.assert_not_called()
    assert len(result) == 1


def test_correct_args_passed_to_extract_events():
    """extract_events receives html, url, source_name."""
    with patch("pipeline.llm_multi_entity.extract_events") as mock:
        mock.return_value = []
        extract_entities_for_lanes(
            "<html>content</html>",
            "https://venue.example.com/events",
            "Example Venue",
            ["events"],
        )
    call_args = mock.call_args
    assert call_args[0][0] == "<html>content</html>"
    assert call_args[0][1] == "https://venue.example.com/events"
    assert call_args[0][2] == "Example Venue"


def test_correct_args_passed_to_extract_venue_metadata():
    """extract_venue_metadata receives html, url, source_name."""
    with patch("pipeline.llm_multi_entity.extract_events") as mock_events, \
         patch("pipeline.llm_multi_entity.extract_venue_metadata") as mock_venue:
        mock_events.return_value = []
        mock_venue.return_value = None
        extract_entities_for_lanes(
            "<html>venue page</html>",
            "https://venue.example.com/about",
            "Example Venue",
            ["events", "destination_details"],
        )
    call_args = mock_venue.call_args
    assert call_args[0][0] == "<html>venue page</html>"
    assert call_args[0][1] == "https://venue.example.com/about"
    assert call_args[0][2] == "Example Venue"


def test_correct_args_passed_to_extract_specials():
    """extract_specials receives html, url, source_name."""
    with patch("pipeline.llm_multi_entity.extract_events") as mock_events, \
         patch("pipeline.llm_multi_entity.extract_specials") as mock_specials:
        mock_events.return_value = []
        mock_specials.return_value = []
        extract_entities_for_lanes(
            "<html>specials page</html>",
            "https://bar.example.com/specials",
            "Example Bar",
            ["events", "venue_specials"],
        )
    call_args = mock_specials.call_args
    assert call_args[0][0] == "<html>specials page</html>"
    assert call_args[0][1] == "https://bar.example.com/specials"
    assert call_args[0][2] == "Example Bar"


def test_event_results_tagged_with_events_lane():
    """Events in the result list carry _lane='events'."""
    with patch("pipeline.llm_multi_entity.extract_events") as mock:
        mock.return_value = [
            MagicMock(model_dump=lambda: {"title": "Concert", "content_kind": "event"})
        ]
        result = extract_entities_for_lanes(
            "<html></html>", "http://test.com", "Test", ["events"]
        )
    assert result[0].get("_lane") == "events"
