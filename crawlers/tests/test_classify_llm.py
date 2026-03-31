"""
Tests for classify.classify_llm() — LLM classification layer.

All LLM calls are mocked; no network calls required.
"""
import json
import pytest
from unittest.mock import patch
from classify import classify_llm, TAXONOMY_PROMPT_VERSION


def _mock_response(
    category="music",
    genres=None,
    audience="general",
    confidence=0.9,
):
    return json.dumps({
        "category": category,
        "genres": genres or [],
        "audience": audience,
        "duration": "medium",
        "cost_tier": "$",
        "skill_level": "all-levels",
        "booking_required": False,
        "indoor_outdoor": "indoor",
        "significance": "low",
        "significance_signals": [],
        "confidence": confidence,
    })


@patch("classify.generate_text")
def test_llm_valid_classification(mock_gen):
    """LLM returns valid category + genre → result reflects them."""
    mock_gen.return_value = _mock_response("games", ["trivia"])
    result = classify_llm(
        title="Wednesday Trivia",
        description="Test your knowledge",
        venue_type="bar",
    )
    assert result.category == "games"
    assert "trivia" in result.genres
    assert result.source == "llm"


@patch("classify.generate_text")
def test_llm_strips_invalid_genres(mock_gen):
    """Genres that don't belong to the returned category are stripped."""
    mock_gen.return_value = _mock_response("music", ["rock", "basketball"])
    result = classify_llm(title="Concert", description="", venue_type="arena")
    assert "basketball" not in result.genres
    assert "rock" in result.genres


@patch("classify.generate_text")
def test_llm_handles_malformed_json(mock_gen):
    """Non-JSON response → category None, no crash."""
    mock_gen.return_value = "Not valid JSON {{"
    result = classify_llm(title="Event", description="")
    assert result.category is None


@patch("classify.generate_text")
def test_llm_strips_markdown_fences(mock_gen):
    """```json ... ``` wrapper is stripped before JSON parse."""
    mock_gen.return_value = "```json\n" + _mock_response("comedy", ["improv"]) + "\n```"
    result = classify_llm(title="Improv Show", description="")
    assert result.category == "comedy"
    assert "improv" in result.genres


@patch("classify.generate_text")
def test_llm_api_error(mock_gen):
    """API exception → empty result, no crash."""
    mock_gen.side_effect = Exception("API rate limited")
    result = classify_llm(title="Event", description="")
    assert result.category is None
    assert result.source == "llm"


@patch("classify.generate_text")
def test_llm_invalid_category_rejected(mock_gen):
    """LLM hallucinating an unknown category → category set to None."""
    mock_gen.return_value = _mock_response("nightlife", [])  # legacy, not in _VALID_NEW_CATEGORIES
    result = classify_llm(title="DJ Night", description="")
    assert result.category is None
    assert result.confidence == 0.0


@patch("classify.generate_text")
def test_llm_audience_preserved(mock_gen):
    """Audience field from LLM response is preserved."""
    mock_gen.return_value = _mock_response("fitness", ["yoga"], audience="general")
    result = classify_llm(title="Morning Yoga", description="")
    assert result.audience == "general"


@patch("classify.generate_text")
def test_llm_enrichment_fields_populated(mock_gen):
    """Duration, cost_tier, skill_level, booking_required, indoor_outdoor all mapped."""
    mock_gen.return_value = json.dumps({
        "category": "workshops",
        "genres": ["pottery"],
        "audience": "general",
        "duration": "long",
        "cost_tier": "$$",
        "skill_level": "beginner",
        "booking_required": True,
        "indoor_outdoor": "indoor",
        "significance": "medium",
        "significance_signals": ["sold out last year"],
        "confidence": 0.88,
    })
    result = classify_llm(title="Pottery Workshop", description="Wheel throwing class")
    assert result.duration == "long"
    assert result.cost_tier == "$$"
    assert result.skill_level == "beginner"
    assert result.booking_required is True
    assert result.indoor_outdoor == "indoor"
    assert result.significance == "medium"
    assert "sold out last year" in result.significance_signals


@patch("classify.generate_text")
def test_llm_null_string_enrichment_fields_are_dropped(mock_gen):
    """String sentinels like 'null' should not be written into constrained DB columns."""
    mock_gen.return_value = json.dumps({
        "category": "workshops",
        "genres": [],
        "audience": "general",
        "duration": "null",
        "cost_tier": "null",
        "skill_level": "null",
        "booking_required": "null",
        "indoor_outdoor": "null",
        "significance": "null",
        "significance_signals": ["null", ""],
        "confidence": 0.82,
    })
    result = classify_llm(title="Adult Take Home Craft Kit", description="Library craft kit")
    assert result.duration is None
    assert result.cost_tier is None
    assert result.skill_level is None
    assert result.booking_required is None
    assert result.indoor_outdoor is None
    assert result.significance is None
    assert result.significance_signals == []


def test_prompt_version_exists():
    """TAXONOMY_PROMPT_VERSION constant is defined."""
    assert TAXONOMY_PROMPT_VERSION is not None
    assert isinstance(TAXONOMY_PROMPT_VERSION, str)
    assert len(TAXONOMY_PROMPT_VERSION) > 0
