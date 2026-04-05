"""Test classification-related insert pipeline steps."""
import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from unittest.mock import patch, MagicMock
from classify import classify_event
from db.events import (
    _step_classify_v2,
    _step_infer_is_show,
    _compute_is_show,
    _should_rewrite_category_from_v2,
    _normalize_classification_duration,
    InsertContext,
)


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


def test_step_rewrites_category_when_rewrite_flag_enabled():
    event_data = {
        "title": "Live Band Karaoke at Metalsome Live Band Karaoke",
        "description": "",
        "category": "music",
        "source_id": 349,
    }
    ctx = InsertContext(client=MagicMock(), venue_type="bar")
    ctx.source_info = {"id": 349, "slug": "atlanta-recurring-social"}
    ctx.source_slug = "atlanta-recurring-social"
    ctx.source_name = "Atlanta Recurring Social Events"

    with patch.dict(
        os.environ,
        {"CLASSIFY_V2_ENABLED": "1", "CLASSIFY_V2_REWRITE_CATEGORY": "1"},
    ):
        with patch("db.events.events_support_taxonomy_v2_columns", return_value=True):
            result = _step_classify_v2(event_data, ctx)

    assert result["category"] == "nightlife"
    assert result.get("classification_prompt_version") is not None


def test_rewrite_gate_rejects_low_confidence_category_shift():
    assert _should_rewrite_category_from_v2("nightlife", "music", 0.6) is False


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


def test_step_skips_llm_for_festival_film_rows():
    event_data = {
        "title": "Power Ballad",
        "description": "Feature film screening.",
        "category": "film",
        "source_id": 30,
    }
    ctx = InsertContext(client=MagicMock(), venue_type="festival")
    ctx.source_info = {"id": 30, "slug": "atlanta-film-festival"}
    ctx.source_slug = "atlanta-film-festival"
    ctx.source_name = "Atlanta Film Festival"

    with patch.dict(os.environ, {"CLASSIFY_V2_ENABLED": "1"}):
        with patch("db.events.events_support_taxonomy_v2_columns", return_value=True):
            with patch("classify.classify_event") as mock_classify:
                result = _step_classify_v2(event_data, ctx)

    mock_classify.assert_not_called()
    assert result["category"] == "film"
    assert result["_classification_confidence"] == 1.0
    assert result["classification_prompt_version"] == "source-grounded-film"


def test_classification_duration_normalizes_to_db_values():
    assert _normalize_classification_duration("quick") == "short"
    assert _normalize_classification_duration("medium") == "medium"
    assert _normalize_classification_duration("long") == "half-day"
    assert _normalize_classification_duration("all-day") == "full-day"
    assert _normalize_classification_duration(None) is None


def test_classify_event_skips_llm_for_multiformat_open_mic():
    with patch("classify.classify_llm") as mock_llm:
        result = classify_event(
            title="Open Mic at Joe's Coffeehouse",
            description="Weekly open mic. All performers welcome — music, poetry, spoken word.",
            venue_type="coffee_shop",
            category_hint="nightlife",
        )

    mock_llm.assert_not_called()
    assert result.category == "words"
    assert result.confidence >= 0.7


def test_classify_event_skips_llm_for_lindy_hop_social():
    with patch("classify.classify_llm") as mock_llm:
        result = classify_event(
            title="Lindy Hop Social Dance at Hot Jam Atlanta",
            description="Free beginner solo jazz class at 7pm, intro swing class at 7:30, social dance after.",
            category_hint="music",
        )

    mock_llm.assert_not_called()
    assert result.category == "dance"
    assert "swing" in result.genres


def test_classify_event_skips_llm_for_pauper_league():
    with patch("classify.classify_llm") as mock_llm:
        result = classify_event(
            title="MTG Pauper League at East Atlanta Comics",
            description="Wednesday evening Magic: The Gathering Pauper League at East Atlanta Comics.",
            category_hint="music",
        )

    mock_llm.assert_not_called()
    assert result.category == "games"
    assert "card-games" in result.genres


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


def test_compute_is_show_for_ticketed_music_show():
    event_data = {
        "title": "Touring Artist Live",
        "category": "music",
        "ticket_url": "https://tickets.example.com/event/123",
        "tags": ["concert"],
    }
    assert _compute_is_show(event_data, "music_venue") is True


def test_compute_is_show_rejects_open_format_music():
    event_data = {
        "title": "Weekly Open Mic",
        "category": "music",
        "tags": ["open-mic", "open-format"],
        "is_recurring": True,
    }
    assert _compute_is_show(event_data, "music_venue") is False


def test_compute_is_show_allows_ticketed_one_off_show_with_bad_open_format_genre():
    event_data = {
        "title": "Whitney Bjerken, Ana Grosh, & Dalby Beihl",
        "category": "music",
        "ticket_url": "https://www.boggssocial.com/events/whitney-bjerken-ana-grosh-dalby-beihl",
        "tags": ["live-music", "ticketed"],
        "genres": ["karaoke"],
        "is_recurring": False,
    }
    assert _compute_is_show(event_data, "music_venue") is True


def test_compute_is_show_keeps_ticketed_open_mic_false_when_title_is_explicit():
    event_data = {
        "title": "Eddie's Attic Songwriters Open Mic Night",
        "category": "music",
        "ticket_url": "https://link.dice.fm/zfd49bcb75f4",
        "tags": ["live-music", "ticketed"],
        "genres": ["open-mic", "singer-songwriter"],
        "is_recurring": False,
    }
    assert _compute_is_show(event_data, "music_venue") is False


def test_compute_is_show_rejects_free_recurring_open_mic_comedy():
    event_data = {
        "title": "Monday Night Comedy",
        "category": "comedy",
        "ticket_status": "free",
        "tags": ["open-mic", "weekly"],
        "genres": ["open-mic", "stand-up"],
        "is_recurring": True,
    }
    assert _compute_is_show(event_data, "bar") is False


def test_compute_is_show_rejects_generic_ticket_status_for_recurring_bar_music():
    event_data = {
        "title": "Live Music Thursday",
        "category": "music",
        "ticket_status": "tickets-available",
        "tags": ["weekly"],
        "genres": ["blues"],
        "is_recurring": True,
    }
    assert _compute_is_show(event_data, "bar") is False


def test_compute_is_show_keeps_paid_recurring_music_show_true():
    event_data = {
        "title": "Friday Residency",
        "category": "music",
        "price_min": 15,
        "ticket_status": "tickets-available",
        "tags": ["live-music"],
        "is_recurring": True,
    }
    assert _compute_is_show(event_data, "bar") is True


def test_compute_is_show_for_film():
    event_data = {"title": "Movie Night", "category": "film"}
    assert _compute_is_show(event_data, "cinema") is True


def test_step_infer_is_show_populates_when_column_exists():
    event_data = {
        "title": "Comedy Showcase",
        "category": "comedy",
        "ticket_url": "https://tickets.example.com/comedy",
    }
    ctx = InsertContext(client=MagicMock(), venue_type="comedy_club")

    with patch("db.events.events_support_is_show_column", return_value=True):
        result = _step_infer_is_show(event_data, ctx)

    assert result["is_show"] is True
