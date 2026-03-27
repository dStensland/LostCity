"""
Tests for classify.classify_event() — the three-layer orchestrator.

Layer execution order: source defaults → rules → LLM fallback.
"""
import json
from unittest.mock import patch
from classify import classify_event, TAXONOMY_PROMPT_VERSION


def test_source_default_short_circuits():
    """Source with a registered default → source_default layer, skips rules+LLM."""
    result = classify_event(title="Paint Party", description="", source_id=554)
    assert result.category == "workshops"
    assert result.source == "source_default"
    assert result.confidence >= 0.9


def test_source_default_sets_prompt_version():
    """prompt_version is always set even for source-default hits."""
    result = classify_event(title="Movie Screening", source_name="AMC Phipps Plaza 14")
    assert result.category == "film"
    assert result.prompt_version == TAXONOMY_PROMPT_VERSION


def test_high_confidence_rules_skips_llm():
    """High-confidence rules match → LLM is never called."""
    with patch("classify.generate_text") as mock_llm:
        result = classify_event(
            title="Geek Trivia Night",
            description="Test your knowledge",
            venue_type="bar",
        )
        assert result.category == "games"
        assert result.source == "rules"
        mock_llm.assert_not_called()


@patch("classify.generate_text")
def test_low_confidence_falls_to_llm(mock_llm):
    """Title with no rule match → LLM is called and result used if better."""
    mock_llm.return_value = json.dumps({
        "category": "education",
        "genres": ["seminar"],
        "audience": "general",
        "duration": None,
        "cost_tier": None,
        "skill_level": None,
        "booking_required": None,
        "indoor_outdoor": None,
        "significance": "low",
        "significance_signals": [],
        "confidence": 0.85,
    })
    result = classify_event(
        title="Nether Hour",
        description="An evening experience",
        venue_type="venue",
    )
    # LLM was called and its result should be used (confidence 0.85 > rules 0.0)
    assert result.category == "education"
    mock_llm.assert_called_once()


def test_prompt_version_always_set():
    """prompt_version is set regardless of which layer produces the result."""
    result = classify_event(title="Blues Night", description="Live blues", venue_type="bar")
    assert result.prompt_version == TAXONOMY_PROMPT_VERSION


@patch("classify.generate_text")
def test_llm_failure_returns_rules(mock_llm):
    """LLM API failure → falls back to rules result without crashing."""
    mock_llm.side_effect = Exception("API down")
    result = classify_event(title="Friday Night", description="", venue_type="nightclub")
    # Should not crash; prompt_version always set
    assert result.prompt_version is not None


@patch("classify.generate_text")
def test_llm_not_called_when_rules_exceed_threshold(mock_llm):
    """Rules confidence at or above CONFIDENCE_THRESHOLD → no LLM call."""
    result = classify_event(title="Paint and Sip with Friends", description="")
    assert result.category == "workshops"
    mock_llm.assert_not_called()


@patch("classify.generate_text")
def test_llm_result_ignored_when_lower_confidence(mock_llm):
    """LLM result with lower confidence than rules is discarded."""
    # open mic has rules confidence 0.60, below threshold → LLM called
    # but if LLM returns even lower confidence, keep rules result
    mock_llm.return_value = json.dumps({
        "category": "comedy",
        "genres": ["open-mic"],
        "audience": "general",
        "duration": None,
        "cost_tier": None,
        "skill_level": None,
        "booking_required": None,
        "indoor_outdoor": None,
        "significance": "low",
        "significance_signals": [],
        "confidence": 0.40,  # lower than rules 0.60
    })
    result = classify_event(title="Open Mic Night", description="")
    # rules gave 0.60, LLM gave 0.40 → rules result kept
    assert result.source == "rules"
    assert result.category == "music"


def test_recovery_slug_source_default():
    """AA slug → support category via source_slug default."""
    result = classify_event(
        title="Weekly Meeting",
        source_slug="alcoholics-anonymous-atlanta",
    )
    assert result.category == "support"
    assert result.source == "source_default"
