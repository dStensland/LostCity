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


def test_dueling_pianos_is_music():
    """Dueling pianos should classify as music without needing the LLM."""
    result = classify_rules(title="Dueling Pianos at Park Bench Battery")
    assert result.category == "music"


def test_paint_and_sip_workshops():
    """Paint and sip → workshops."""
    result = classify_rules(title="Paint and Sip Night")
    assert result.category == "workshops"


def test_book_club_words():
    """Book club → words with book-club genre."""
    result = classify_rules(title="Monthly Book Club Meeting")
    assert result.category == "words"
    assert "book-club" in result.genres


def test_baby_time_words_storytime():
    """Baby Time at a library should classify as words/storytime."""
    result = classify_rules(title="Baby Time at the Library")
    assert result.category == "words"
    assert "storytime" in result.genres


def test_tummy_time_family_not_support():
    """Tummy Time should stay family-oriented and not get routed to support."""
    result = classify_rules(title="Community | Tummy Time")
    assert result.category == "family"


def test_reading_buddies_words_reading():
    """Reading Buddies should stay literary, not education/support."""
    result = classify_rules(title="Literacy | Reading Buddies")
    assert result.category == "words"
    assert "reading" in result.genres


def test_yoga_fitness():
    """Yoga → fitness with yoga genre."""
    result = classify_rules(title="Morning Yoga Class")
    assert result.category == "fitness"
    assert "yoga" in result.genres


def test_qigong_fitness():
    """QiGong programs should classify as fitness."""
    result = classify_rules(title="Mindful Arts: QiGong")
    assert result.category == "fitness"


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


def test_adults_with_disabilities_support():
    """Meetups for adults with disabilities should map to support."""
    result = classify_rules(title="Meet Up for Adults with Disabilities")
    assert result.category == "support"
    assert "peer-support" in result.genres


def test_language_learning_education():
    """Language-learning conversation groups should map to education."""
    result = classify_rules(title="Language Learning | Conversations in English")
    assert result.category == "education"
    assert "language" in result.genres


def test_ukulele_program_workshops():
    """Participatory ukulele programs should map to workshops, not music."""
    result = classify_rules(title="Beginner's Ukulele Series of Classes")
    assert result.category == "workshops"


def test_nintendo_switch_games():
    """Nintendo Switch library programming should resolve to games."""
    result = classify_rules(title="Game On: Nintendo Switch")
    assert result.category == "games"
    assert "video-games" in result.genres


def test_pokemon_club_games():
    """Pokemon club titles should stay in games and not leak to the LLM."""
    result = classify_rules(title="Pokémon Club")
    assert result.category == "games"


def test_virtual_reality_game_days_games():
    """VR game-day library programs should classify as games/video-games."""
    result = classify_rules(title="Virtual Reality (VR) Game Days for Teens")
    assert result.category == "games"
    assert "video-games" in result.genres


def test_chess_club_games():
    """Chess club should resolve to games without needing the LLM."""
    result = classify_rules(title="Chess Club")
    assert result.category == "games"
    assert "chess" in result.genres


def test_kids_sewing_workshops():
    """Kids sewing should map to workshops, not family or education."""
    result = classify_rules(title="Kids Sewing")
    assert result.category == "workshops"


def test_origami_workshops():
    """Origami and similar paper crafts should resolve to workshops."""
    result = classify_rules(title="Stone Mountain Origami Club")
    assert result.category == "workshops"
    assert "crafts" in result.genres


def test_social_work_intern_support():
    """Social-work office hours should route to support."""
    result = classify_rules(title="Speak to a Decatur Social Work Intern")
    assert result.category == "support"
    assert "peer-support" in result.genres


def test_filmmakers_club_film():
    """Filmmakers clubs should classify as film-oriented programming."""
    result = classify_rules(title="DeKalb Filmmakers Club - Cameras and Lenses")
    assert result.category == "film"


def test_homework_help_education():
    """Homework help should stay education-focused, not volunteer."""
    result = classify_rules(title="Mind Bubble Homework Help")
    assert result.category == "education"


def test_read_to_a_pet_words():
    """Read-to-a-pet literacy programs should classify as words."""
    result = classify_rules(title="Read to a Pet Partner")
    assert result.category == "words"
    assert "reading" in result.genres


def test_toddler_time_words_storytime():
    """Toddler Time should resolve to a words/storytime program."""
    result = classify_rules(title="Toddler Time")
    assert result.category == "words"
    assert "storytime" in result.genres


def test_friday_movies_film():
    """Recurring movie programs should resolve to film."""
    result = classify_rules(title="Friday Movies")
    assert result.category == "film"


def test_ged_study_time_education():
    """GED study sessions should stay education-oriented."""
    result = classify_rules(title="GED Study Time")
    assert result.category == "education"


def test_sensory_play_family():
    """Sensory play should classify as family programming."""
    result = classify_rules(title="Sensory Play")
    assert result.category == "family"


def test_sensory_playtime_family():
    """Sensory Playtime should use the same family rule as sensory-play variants."""
    result = classify_rules(title="Sensory Playtime")
    assert result.category == "family"


def test_blood_drive_volunteer():
    """Blood drives should classify as volunteer/community service."""
    result = classify_rules(title="Red Cross Blood Drive")
    assert result.category == "volunteer"


def test_storywalk_words_reading():
    """StoryWalk programs should classify as words/reading."""
    result = classify_rules(title="StoryWalk at Mason Mill Park")
    assert result.category == "words"
    assert "reading" in result.genres


def test_storycraft_words_storytime():
    """Storycraft library programs should resolve as words/storytime."""
    result = classify_rules(title="Afterschool Storycraft")
    assert result.category == "words"
    assert "storytime" in result.genres


def test_take_and_make_workshops():
    """Take-and-make craft programming should resolve to workshops."""
    result = classify_rules(title="Take & Make Saturdays")
    assert result.category == "workshops"
    assert "crafts" in result.genres


def test_open_mah_jongg_games():
    """Mah jongg groups should classify as games."""
    result = classify_rules(title="Let's Play American Mah Jongg!")
    assert result.category == "games"
    assert "board-games" in result.genres


def test_cricut_creations_workshops():
    """Cricut craft programming should resolve to workshops."""
    result = classify_rules(title="Cricut Creations")
    assert result.category == "workshops"
    assert "crafts" in result.genres


def test_lego_club_workshops():
    """LEGO maker programs should resolve to workshops."""
    result = classify_rules(title="Lego Club")
    assert result.category == "workshops"
    assert "crafts" in result.genres


def test_middle_makers_workshops():
    """General makerspace programming should resolve to workshops."""
    result = classify_rules(title="Middle Makers")
    assert result.category == "workshops"
    assert "crafts" in result.genres


def test_adult_craft_workshops():
    """Adult craft sessions should resolve to workshops."""
    result = classify_rules(title="Adult Craft: Floral Embroidery")
    assert result.category == "workshops"
    assert "crafts" in result.genres


def test_code_blazers_education():
    """Coding clubs should resolve to education/technology."""
    result = classify_rules(title="Code-Blazers")
    assert result.category == "education"
    assert "technology" in result.genres


def test_podcast_workshop_workshops():
    """Podcast workshops should resolve to workshops."""
    result = classify_rules(title="Creative Studios: Podcast Basics Workshop")
    assert result.category == "workshops"
    assert "crafts" in result.genres


def test_craft_and_chat_workshops():
    """Casual craft meetup titles should resolve to workshops."""
    result = classify_rules(title="Craft and Chat")
    assert result.category == "workshops"
    assert "crafts" in result.genres


def test_crafternoon_workshops():
    """Crafternoon titles should resolve to workshops without LLM fallback."""
    result = classify_rules(title="Wednesday Crafternoon")
    assert result.category == "workshops"
    assert "crafts" in result.genres


def test_artificial_intelligence_education():
    """Intro AI programs should resolve to education/technology."""
    result = classify_rules(title="How To Get Started With Artificial Intelligence")
    assert result.category == "education"
    assert "technology" in result.genres


def test_book_a_librarian_tech_help_education():
    """Book-A-Librarian tech help should route to education/technology."""
    result = classify_rules(title="Book-A-Librarian Tech Help")
    assert result.category == "education"
    assert "technology" in result.genres


def test_book_a_librarian_variant_education():
    """Book a Librarian variants should also route to education/technology."""
    result = classify_rules(title="Book a Librarian: 1-on-1 Computer & eReader Help")
    assert result.category == "education"
    assert "technology" in result.genres


def test_book_a_librarian_one_to_one_tech_help_education():
    """1:1 tech help variants should stay in education/technology."""
    result = classify_rules(title="Book a Librarian 1:1 Tech Help")
    assert result.category == "education"
    assert "technology" in result.genres


def test_computer_basics_education():
    """Computer basics classes should stay education-oriented."""
    result = classify_rules(title="Computer Basics")
    assert result.category == "education"
    assert "technology" in result.genres


def test_creative_writing_workshop_workshops():
    """Creative writing workshop branding is participatory programming, not words."""
    result = classify_rules(title="Creative Studios: Creative Writing Workshop")
    assert result.category == "workshops"
    assert "crafts" in result.genres


def test_clothing_repair_clinic_workshops():
    """Repair-clinic craft programming should classify as workshops."""
    result = classify_rules(title="Wear It, Fix It! A Clothing Repair Clinic")
    assert result.category == "workshops"
    assert "crafts" in result.genres


def test_shell_charm_bracelet_workshops():
    """Single-project craft titles should classify as workshops."""
    result = classify_rules(title="Shell Charm Bracelet")
    assert result.category == "workshops"
    assert "crafts" in result.genres


def test_english_as_a_second_language_education():
    """Full ESL phrasing should resolve to education/language."""
    result = classify_rules(
        title="English as a Second Language (ESL) Class with Cobb County Adult Education"
    )
    assert result.category == "education"
    assert "language" in result.genres


def test_study_cafe_education():
    """Study cafe programming should resolve to education."""
    result = classify_rules(title="South Cobb Study Cafe")
    assert result.category == "education"
    assert "language" in result.genres


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


def test_lindy_hop_maps_to_dance_swing():
    """Lindy hop socials should classify as swing dance."""
    result = classify_rules(title="Lindy Hop Social Dance at Hot Jam Atlanta")
    assert result.category == "dance"
    assert "swing" in result.genres


# ---------------------------------------------------------------------------
# MTG vs Warhammer — distinct keywords produce distinct genres
# ---------------------------------------------------------------------------

def test_mtg_tournament_games_no_warhammer():
    """MTG Tournament → games with card-games genre; warhammer NOT inferred."""
    result = classify_rules(title="MTG Tournament: Modern Format")
    assert result.category == "games"
    assert "card-games" in result.genres
    assert "warhammer" not in result.genres


def test_pauper_league_games_card_games():
    """Magic league variants should classify as games without the LLM path."""
    result = classify_rules(title="MTG Pauper League at East Atlanta Comics")
    assert result.category == "games"
    assert "card-games" in result.genres


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


def test_open_mic_with_spoken_word_cues_becomes_words():
    """Poetry/spoken-word open mics should stay deterministic and literary."""
    result = classify_rules(
        title="Open Mic at Joe's Coffeehouse",
        description="Weekly open mic. All performers welcome — music, poetry, spoken word.",
        venue_type="coffee_shop",
        category_hint="nightlife",
    )
    assert result.category == "words"
    assert result.confidence >= CONFIDENCE_THRESHOLD
    assert "poetry" in result.genres or "spoken-word" in result.genres


def test_open_mic_with_comedy_cues_becomes_comedy():
    """Comedy-signaled open mics should resolve without the LLM fallback."""
    result = classify_rules(
        title="Monday Open Mic",
        description="Open mic focused on stand-up and improv sets.",
        venue_type="bar",
    )
    assert result.category == "comedy"
    assert result.confidence >= CONFIDENCE_THRESHOLD


def test_karaoke_at_bar_preserves_nightlife_hint():
    """Karaoke at a bar should classify as nightlife, not be promoted to music."""
    result = classify_rules(
        title="Live Band Karaoke at Metalsome Live Band Karaoke",
        venue_type="bar",
        category_hint="nightlife",
    )
    assert result.category == "nightlife"
    assert "karaoke" in result.genres
    assert result.confidence >= CONFIDENCE_THRESHOLD


def test_karaoke_at_music_venue_stays_nightlife():
    """Karaoke remains a social-format classification even at a stage venue."""
    result = classify_rules(
        title="Karaoke Night with House Band",
        venue_type="music_venue",
    )
    assert result.category == "nightlife"
    assert "karaoke" in result.genres


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


# ---------------------------------------------------------------------------
# Sports watch party detection
# ---------------------------------------------------------------------------

def test_sports_watch_party_at_sports_bar():
    """Super Bowl watch party at sports bar → sports/watch_party."""
    result = classify_rules(
        title="Super Bowl Watch Party",
        description="Come watch the big game!",
        venue_type="sports_bar",
    )
    assert result.category == "sports"
    assert "watch_party" in result.genres
    assert result.confidence >= 0.85


def test_sports_bar_no_sport_keyword_stays_film():
    """Sports bar with 'viewing party' but no sport keyword → no sports override."""
    result = classify_rules(
        title="Movie Viewing Party",
        description="Watch a film together.",
        venue_type="sports_bar",
    )
    # Should NOT be classified as sports — no sport keyword
    assert result.category != "sports"
