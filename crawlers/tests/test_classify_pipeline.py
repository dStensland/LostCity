"""Test _step_classify_v2 pipeline step."""
import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from unittest.mock import patch, MagicMock
from db.events import _step_classify_v2, InsertContext


def test_step_skipped_when_flag_disabled():
    """Without CLASSIFY_V2_ENABLED, step is a no-op."""
    event_data = {"title": "Test", "category": "music"}
    ctx = InsertContext(client=MagicMock())
    env = os.environ.copy()
    env.pop("CLASSIFY_V2_ENABLED", None)
    with patch.dict(os.environ, env, clear=True):
        result = _step_classify_v2(event_data, ctx)
    assert "classification_prompt_version" not in result


def test_step_populates_columns_when_enabled():
    event_data = {
        "title": "Geek Trivia Night",
        "description": "Test your knowledge",
        "category": "nightlife",
        "source_id": 42,
    }
    ctx = InsertContext(client=MagicMock(), venue_type="restaurant")
    ctx.source_info = {"id": 42, "slug": "battle-and-brew"}
    ctx.source_slug = "battle-and-brew"
    ctx.source_name = "Battle & Brew"

    with patch.dict(os.environ, {"CLASSIFY_V2_ENABLED": "1"}):
        with patch("db.events.events_support_taxonomy_v2_columns", return_value=True):
            result = _step_classify_v2(event_data, ctx)

    assert result.get("classification_prompt_version") is not None
    # Old category NOT overwritten
    assert result["category"] == "nightlife"


def test_step_extracts_source_id_from_source_info():
    """source_id should come from ctx.source_info, not ctx.source_id (which doesn't exist)."""
    event_data = {"title": "Paint Party", "category": "art", "source_id": 554}
    ctx = InsertContext(client=MagicMock(), venue_type="studio")
    ctx.source_info = {"id": 554, "slug": "painting-with-a-twist"}
    ctx.source_slug = "painting-with-a-twist"

    with patch.dict(os.environ, {"CLASSIFY_V2_ENABLED": "1"}):
        with patch("db.events.events_support_taxonomy_v2_columns", return_value=True):
            result = _step_classify_v2(event_data, ctx)

    # Source default for PWT (#554) should fire → workshops classification
    assert result.get("classification_prompt_version") is not None


def test_audience_not_set_for_general():
    event_data = {"title": "Jazz Night", "description": "", "category": "music", "source_id": 99}
    ctx = InsertContext(client=MagicMock(), venue_type="music_venue")
    ctx.source_info = {"id": 99}
    ctx.source_slug = "test"

    with patch.dict(os.environ, {"CLASSIFY_V2_ENABLED": "1"}):
        with patch("db.events.events_support_taxonomy_v2_columns", return_value=True):
            result = _step_classify_v2(event_data, ctx)

    # General audience → audience_tags should NOT be in event_data
    assert result.get("audience_tags") is None or result.get("audience_tags") == []
