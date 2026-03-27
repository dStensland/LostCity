"""
Tests for classify.classify_rules() — rules-only layer.

Each test is a focused assertion about a single classification behaviour.
No DB, no network, no mocks required.
"""
import pytest
from classify import classify_rules, CONFIDENCE_THRESHOLD


# ---------------------------------------------------------------------------
# Category classification
# ---------------------------------------------------------------------------

def test_cinema_venue_hint_film():
    """Cinema venue type hint → film, even with a generic title."""
    result = classify_rules(title="Feature Presentation", venue_type="cinema")
    assert result.category == "film"


def test_trivia_night_games():
    """Trivia night at bar → games with trivia genre."""
    result = classify_rules(title="Tuesday Trivia Night", venue_type="bar")
    assert result.category == "games"
    assert "trivia" in result.genres


def test_drag_show_theater():
    """Drag show → theater with drag genre."""
    result = classify_rules(title="Friday Drag Show")
    assert result.category == "theater"
    assert "drag" in result.genres


def test_dj_set_music():
    """DJ set → music with dj genre."""
    result = classify_rules(title="DJ Set with DJ Hype")
    assert result.category == "music"
    assert "dj" in result.genres


def test_paint_and_sip_workshops():
    """Paint and sip → workshops."""
    result = classify_rules(title="Paint and Sip Night")
    assert result.category == "workshops"


def test_book_club_words():
    """Book club → words with book-club genre."""
    result = classify_rules(title="Monthly Book Club Meeting")
    assert result.category == "words"
    assert "book-club" in result.genres


def test_yoga_fitness():
    """Yoga → fitness with yoga genre."""
    result = classify_rules(title="Morning Yoga Class")
    assert result.category == "fitness"
    assert "yoga" in result.genres


def test_hiking_outdoors():
    """Hiking → outdoors with hiking genre."""
    result = classify_rules(title="Saturday Morning Hike")
    assert result.category == "outdoors"
    assert "hiking" in result.genres


def test_gallery_opening_art():
    """Gallery opening → art."""
    result = classify_rules(title="Gallery Opening: New Works")
    assert result.category == "art"
    assert "gallery-opening" in result.genres


def test_farmers_market_food_drink():
    """Farmers market → food_drink with farmers-market genre."""
    result = classify_rules(title="Saturday Farmers Market")
    assert result.category == "food_drink"
    assert "farmers-market" in result.genres


def test_escape_room_games():
    """Escape room → games with escape-room genre."""
    result = classify_rules(title="Escape Room: Haunted Mansion")
    assert result.category == "games"
    assert "escape-room" in result.genres


def test_improv_show_comedy():
    """Improv show → comedy with improv genre."""
    result = classify_rules(title="Friday Night Improv Show")
    assert result.category == "comedy"
    assert "improv" in result.genres


def test_expo_conventions():
    """Expo → conventions category."""
    result = classify_rules(title="Home Improvement Expo 2026")
    assert result.category == "conventions"


def test_volunteer_food_pantry():
    """Volunteer food pantry shift → volunteer."""
    result = classify_rules(title="Volunteer Shift: Food Pantry")
    assert result.category == "volunteer"


def test_senate_floor_session_civic():
    """Senate floor session → civic."""
    result = classify_rules(title="Senate Floor Session")
    assert result.category == "civic"


def test_aa_meeting_support():
    """AA meeting → support."""
    result = classify_rules(title="AA Meeting — Open Discussion")
    assert result.category == "support"


# ---------------------------------------------------------------------------
# Word-boundary correctness (critical anti-false-positive tests)
# ---------------------------------------------------------------------------

def test_blazesports_no_esports_genre():
    """'BlazeSports Learn to Swim' must NOT get esports as a genre.

    'esports' must not match inside 'BlazeSports' — word boundary required.
    """
    result = classify_rules(
        title="BlazeSports Learn to Swim",
        description="Adaptive aquatics program for athletes with disabilities.",
    )
    assert "esports" not in result.genres


def test_about_bowling_no_mma_genre():
    """'Learn about bowling' must NOT get mma as genre.

    'mma' must not match inside 'comma' or similar substrings.
    """
    result = classify_rules(
        title="Learn about bowling technique",
        description="Join us for a fun evening of bowling.",
    )
    assert "mma" not in result.genres


def test_music_genre_not_inferred_from_description():
    """Punk genre in artist bio description must NOT be inferred.

    Music genre inference is title-only — description is off-limits.
    """
    result = classify_rules(
        title="Live Music at The Earl",
        description="The band draws from punk, metal, and hardcore influences.",
    )
    assert "punk" not in result.genres


# ---------------------------------------------------------------------------
# Dance genre precision — each style must map to its own genre
# ---------------------------------------------------------------------------

def test_swing_night_dance_swing_genre():
    """Swing night → dance with SWING genre (not salsa, not generic)."""
    result = classify_rules(title="Swing Night at Variety Playhouse")
    assert result.category == "dance"
    assert "swing" in result.genres
    assert "salsa" not in result.genres


def test_bachata_night_dance_bachata_genre():
    """Bachata night → dance with BACHATA genre."""
    result = classify_rules(title="Bachata Night with DJ Flores")
    assert result.category == "dance"
    assert "bachata" in result.genres
    assert "salsa" not in result.genres


# ---------------------------------------------------------------------------
# MTG vs Warhammer — distinct keywords produce distinct genres
# ---------------------------------------------------------------------------

def test_mtg_tournament_games_no_warhammer():
    """MTG Tournament → games with card-games genre; warhammer NOT inferred."""
    result = classify_rules(title="MTG Tournament: Modern Format")
    assert result.category == "games"
    assert "card-games" in result.genres
    assert "warhammer" not in result.genres


# ---------------------------------------------------------------------------
# Dance party at nightclub → music override
# ---------------------------------------------------------------------------

def test_dance_party_at_nightclub_becomes_music():
    """'Dance party' at nightclub → music (not dance), dj genre."""
    result = classify_rules(title="Dance Party Friday", venue_type="nightclub")
    assert result.category == "music"
    assert "dj" in result.genres


def test_dance_party_with_style_keyword_stays_dance():
    """'Salsa dance party' at bar → stays dance (has specific style keyword)."""
    result = classify_rules(title="Salsa Dance Party", venue_type="bar")
    assert result.category == "dance"
    assert "salsa" in result.genres


# ---------------------------------------------------------------------------
# Open mic — low confidence → falls below LLM handoff threshold
# ---------------------------------------------------------------------------

def test_open_mic_low_confidence():
    """Open mic must have confidence ≤ 0.65 so LLM fallback can handle it."""
    result = classify_rules(title="Open Mic Night")
    assert result.confidence <= 0.65


# ---------------------------------------------------------------------------
# Audience inference
# ---------------------------------------------------------------------------

def test_explicit_21_plus_in_title():
    """'21+' in title → audience '21+'."""
    result = classify_rules(title="21+ Comedy Night")
    assert result.audience == "21+"


def test_preschool_storytime_audience():
    """'Preschool Storytime' → audience 'preschool'."""
    result = classify_rules(title="Preschool Storytime at the Library")
    assert result.audience == "preschool"


def test_trivia_at_bar_audience_general():
    """Bar venue does NOT auto-gate audience — trivia at a bar is 'general'."""
    result = classify_rules(title="Tuesday Trivia Night", venue_type="bar")
    assert result.audience == "general"


# ---------------------------------------------------------------------------
# Confidence and source metadata
# ---------------------------------------------------------------------------

def test_source_field_is_rules():
    """classify_rules must always return source='rules'."""
    result = classify_rules(title="Live Jazz Night")
    assert result.source == "rules"


def test_high_confidence_known_pattern():
    """Well-known pattern (paint and sip) must exceed CONFIDENCE_THRESHOLD."""
    result = classify_rules(title="Paint and Sip with Friends")
    assert result.confidence >= CONFIDENCE_THRESHOLD


def test_unknown_title_no_category():
    """Completely unrecognised title → no category, zero confidence."""
    result = classify_rules(title="Zorp XQ7 Gathering")
    assert result.category is None
    assert result.confidence == 0.0
