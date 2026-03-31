"""
Rules-based taxonomy classifier for LostCity events.

Classification pipeline (in priority order):
  1. Source defaults  — checked in orchestrator, not here
  2. Title pattern matching (rules)
  3. Dance-party-at-bar override
  4. Venue type hints (fallback when title gives nothing)
  5. Category hint from crawler (lowest priority)
  6. Genre inference (title-only for music; title+desc for others)
  7. Genre validation (strip genres that don't belong to assigned category)
  8. Audience inference (from explicit event text only)

Usage:
    from classify import classify_rules, ClassificationResult
    result = classify_rules(
        title="Tuesday Trivia Night",
        description="Test your knowledge at the bar",
        venue_type="bar",
    )
    # result.category == "games", result.genres == ["trivia"]
"""
from __future__ import annotations

import json
import logging
import re
import time
from dataclasses import dataclass, field
from typing import Optional

from genre_normalize import GENRES_BY_CATEGORY
from llm_client import generate_text
from sources._sports_bar_common import detect_sports_watch_party

logger = logging.getLogger(__name__)

CONFIDENCE_THRESHOLD = 0.7
TAXONOMY_PROMPT_VERSION = "v1.0-2026-03-27"

_NULL_LIKE_STRINGS = frozenset({"", "null", "none", "n/a", "na", "unknown"})
_VALID_COST_TIERS = frozenset({"free", "$", "$$", "$$$"})
_VALID_SKILL_LEVELS = frozenset({"beginner", "intermediate", "advanced", "all-levels"})
_VALID_INDOOR_OUTDOOR = frozenset({"indoor", "outdoor", "both"})
_VALID_SIGNIFICANCE = frozenset({"low", "medium", "high"})


# ---------------------------------------------------------------------------
# Result dataclass
# ---------------------------------------------------------------------------

@dataclass
class ClassificationResult:
    category: Optional[str] = None
    genres: list[str] = field(default_factory=list)
    audience: str = "general"
    confidence: float = 0.0
    source: str = "none"  # "source_default", "rules", "llm"
    prompt_version: Optional[str] = None
    duration: Optional[str] = None
    cost_tier: Optional[str] = None
    skill_level: Optional[str] = None
    booking_required: Optional[bool] = None
    indoor_outdoor: Optional[str] = None
    significance: Optional[str] = None
    significance_signals: list[str] = field(default_factory=list)


def _normalize_nullable_text(value: object) -> Optional[str]:
    if value is None:
        return None
    if isinstance(value, str):
        cleaned = value.strip()
    else:
        cleaned = str(value).strip()
    if cleaned.lower() in _NULL_LIKE_STRINGS:
        return None
    return cleaned


def _normalize_choice(value: object, allowed: frozenset[str]) -> Optional[str]:
    cleaned = _normalize_nullable_text(value)
    if not cleaned:
        return None
    normalized = cleaned.lower()
    return normalized if normalized in allowed else None


def _normalize_cost_tier(value: object) -> Optional[str]:
    cleaned = _normalize_nullable_text(value)
    if not cleaned:
        return None
    normalized = cleaned.lower()
    return normalized if normalized in _VALID_COST_TIERS else None


def _normalize_booking_required(value: object) -> Optional[bool]:
    if isinstance(value, bool):
        return value
    cleaned = _normalize_nullable_text(value)
    if not cleaned:
        return None
    normalized = cleaned.lower()
    if normalized in {"true", "yes", "required"}:
        return True
    if normalized in {"false", "no", "optional"}:
        return False
    return None


def _normalize_significance_signals(value: object) -> list[str]:
    if not value:
        return []
    if isinstance(value, list):
        normalized: list[str] = []
        for item in value:
            cleaned = _normalize_nullable_text(item)
            if cleaned:
                normalized.append(cleaned)
        return normalized
    cleaned = _normalize_nullable_text(value)
    return [cleaned] if cleaned else []


# ---------------------------------------------------------------------------
# Word-boundary match helper
# ---------------------------------------------------------------------------

def _word_match(text: str, keyword: str) -> bool:
    """Match keyword with word boundaries.

    Prevents false positives like 'esports' matching inside 'blazesports',
    or 'mma' matching inside 'comma'.
    """
    return bool(re.search(r"\b" + re.escape(keyword) + r"\b", text, re.IGNORECASE))


# ---------------------------------------------------------------------------
# Venue-type → category hints
# ---------------------------------------------------------------------------

_VENUE_CATEGORY_HINTS: dict[str, tuple[str, float]] = {
    "cinema": ("film", 0.95),
    "stadium": ("sports", 0.8),
    "arena": ("sports", 0.7),
    "comedy_club": ("comedy", 0.9),
    "theater": ("theater", 0.7),
    "church": ("religious", 0.5),
    "government": ("civic", 0.9),
    "dance_studio": ("dance", 0.7),
    "gallery": ("art", 0.6),
    "farmers_market": ("food_drink", 0.85),
}


# ---------------------------------------------------------------------------
# Title-based pattern table
# ---------------------------------------------------------------------------
# Each entry: (keywords_list, category, genres_list, confidence)
# Keywords are bare words — _word_match() applies \b boundaries.
# Order matters: first match with highest confidence wins when there are ties.
# More specific / higher-confidence patterns should come BEFORE general ones.

_TITLE_PATTERNS: list[tuple[list[str], str, list[str], float]] = [
    # --- Games ---
    (["trivia night", "trivia"],             "games",     ["trivia"],       0.9),
    (["pub quiz"],                            "games",     ["trivia"],       0.9),
    (["bingo"],                               "games",     ["bingo"],        0.9),
    (["poker night", "poker tournament"],     "games",     ["poker"],        0.9),
    (["board game", "board games", "board game night"], "games", ["board-games"], 0.85),
    (["warhammer", "warhammer 40k", "age of sigmar"], "games", ["warhammer"], 0.9),
    (["magic: the gathering", "mtg tournament", "magic tournament",
      "magic the gathering"],                 "games",     ["card-games"],   0.9),
    (["pauper league", "commander night", "commander league"],
                                             "games",     ["card-games"],   0.88),
    (["nintendo switch"],                     "games",     ["video-games"],  0.9),
    (["virtual reality", "vr game"],         "games",     ["video-games"],  0.88),
    (["pokemon club", "pokémon club"],       "games",     [],               0.88),
    (["chess club", "chess night", "chess tournament", "chess"], 
                                             "games",     ["chess"],        0.88),
    (["mah jongg", "mahjong"],                "games",     ["board-games"], 0.88),
    (["d&d", "dungeons and dragons", "dungeons & dragons",
      "dnd campaign", "dnd night"],           "games",     ["dnd"],          0.9),
    (["escape room"],                         "games",     ["escape-room"],  0.9),
    (["game night", "game day"],              "games",     ["game-night"],   0.8),

    # --- Comedy (BEFORE theater — improv is comedy, not theater) ---
    (["improv show", "improv night", "improv comedy", "improv"],
                                              "comedy",    ["improv"],       0.88),
    (["stand-up", "standup", "stand up comedy"], "comedy", ["stand-up"],    0.9),
    (["comedy show", "comedy night", "comedy open mic"],
                                              "comedy",    [],               0.85),
    (["roast"],                               "comedy",    ["roast"],        0.8),

    # --- Theater ---
    (["drag show", "drag performance", "drag brunch"],
                                              "theater",   ["drag"],         0.9),
    (["burlesque show", "burlesque"],         "theater",   ["burlesque"],    0.9),
    (["puppet show", "puppetry"],             "theater",   ["puppet"],       0.9),
    (["musical", "the musical"],              "theater",   ["musical"],      0.85),
    (["shakespeare"],                         "theater",   ["shakespeare"],  0.9),
    (["theater", "theatre"],                  "theater",   [],               0.75),
    (["opera"],                               "theater",   ["opera"],        0.85),

    # --- Music (open mic is LOW — could be comedy or poetry) ---
    (["dj set", "dj night"],                  "music",     ["dj"],           0.88),
    (["dueling pianos"],                      "music",     [],               0.88),
    (["live music"],                          "music",     [],               0.82),
    (["open mic"],                            "music",     ["open-mic"],     0.60),  # ambiguous
    (["concert", "live show", "live performance"], "music", [],              0.75),

    # --- Nightlife / social formats ---
    (["karaoke night", "karaoke"],            "nightlife", ["karaoke"],      0.88),

    # --- Dance (each style maps to its own specific genre) ---
    (["salsa night", "salsa dancing", "salsa class", "salsa lessons"],
                                              "dance",     ["salsa"],        0.9),
    (["bachata night", "bachata dancing", "bachata class", "bachata lessons"],
                                              "dance",     ["bachata"],      0.9),
    (["swing night", "swing dancing", "swing dance"],
                                              "dance",     ["swing"],        0.9),
    (["lindy hop"],                           "dance",     ["swing"],        0.9),
    (["latin night", "latin dance night"],    "dance",     ["latin"],        0.85),
    (["line dancing", "line dance"],          "dance",     ["line-dancing"], 0.9),
    (["dance class", "dance lesson", "dance workshop"],
                                              "dance",     [],               0.82),
    (["dance party", "dancing"],              "dance",     ["dance-party"],  0.75),

    # --- Fitness ---
    (["yoga", "yoga class", "yoga session"],  "fitness",   ["yoga"],         0.9),
    (["run club", "running club"],            "fitness",   ["running"],      0.9),
    (["crossfit", "cross fit", "wod"],        "fitness",   ["crossfit"],     0.88),
    (["zumba"],                               "fitness",   ["dance-fitness"], 0.9),
    (["pilates"],                             "fitness",   ["pilates"],      0.9),
    (["spin class", "cycling class"],         "fitness",   ["cycling"],      0.88),
    (["barre class", "barre"],                "fitness",   ["barre"],        0.88),
    (["qigong", "qi gong"],                   "fitness",   [],               0.88),
    (["bootcamp", "boot camp"],               "fitness",   ["hiit"],         0.8),
    (["swim lessons", "swimming lessons", "learn to swim"],
                                              "fitness",   ["swimming"],     0.9),
    (["martial arts", "karate", "jiu-jitsu", "bjj", "taekwondo"],
                                              "fitness",   ["martial-arts"], 0.88),

    # --- Workshops ---
    (["paint and sip", "painting and sip", "sip and paint"],
                                              "workshops", ["painting"],     0.92),
    (["sewing class", "sewing workshop", "kids sewing", "sewing"],
                                              "workshops", [],               0.88),
    (["origami", "papermaking", "soap making", "soapmaking"],
                                              "workshops", ["crafts"],       0.88),
    (["take & make", "take and make", "cricut creations"],
                                              "workshops", ["crafts"],       0.88),
    (["lego club", "middle makers", "adult craft", "embroidery"],
                                              "workshops", ["crafts"],       0.88),
    (["crafternoon"],                         "workshops", ["crafts"],       0.88),
    (["creative writing workshop", "clothing repair clinic", "repair clinic",
      "shell charm bracelet", "fearless art"],
                                              "workshops", ["crafts"],       0.87),
    (["podcast workshop", "podcast basics workshop", "craft and chat"],
                                              "workshops", ["crafts"],       0.86),
    (["pottery class", "pottery workshop", "pottery"],
                                              "workshops", ["pottery"],      0.88),
    (["cooking class", "cooking workshop", "culinary class"],
                                              "workshops", ["cooking-class"], 0.88),
    (["blacksmithing", "blacksmith"],         "workshops", ["blacksmithing"], 0.9),
    (["woodworking", "woodworking class"],    "workshops", ["woodworking"],  0.88),
    (["glassblowing", "glass blowing"],       "workshops", ["glassblowing"], 0.9),
    (["candle making", "candle-making"],      "workshops", ["candle-making"], 0.88),
    (["jewelry making", "jewelry class"],     "workshops", ["jewelry"],      0.88),
    (["printmaking", "screen printing"],      "workshops", ["printmaking"],  0.88),

    # --- Words / literary ---
    (["baby time"],                          "words",     ["storytime"],    0.92),
    (["toddler time"],                       "words",     ["storytime"],    0.9),
    (["tummy time"],                         "family",    [],               0.9),
    (["read to a pet", "pet partner"],       "words",     ["reading"],      0.88),
    (["book club"],                           "words",     ["book-club"],    0.92),
    (["reading buddies"],                     "words",     ["reading"],      0.9),
    (["storywalk"],                           "words",     ["reading"],      0.88),
    (["author signing", "author talk", "book signing", "book talk"],
                                              "words",     ["signing"],      0.88),
    (["poetry slam", "poetry open mic"],      "words",     ["poetry-slam"],  0.9),
    (["poetry reading", "poetry night", "poetry"],
                                              "words",     ["poetry"],       0.85),
    (["storytime", "story time", "storycraft"], "words",   ["storytime"],    0.9),
    (["spoken word"],                         "words",     ["spoken-word"],  0.88),

    # --- Art ---
    (["gallery opening", "art opening", "opening reception"],
                                              "art",       ["gallery-opening"], 0.9),
    (["art exhibition", "exhibition opening", "exhibit opening"],
                                              "art",       ["exhibition"],   0.88),
    (["art show", "art fair", "art market"],  "art",       ["market"],       0.82),

    # --- Outdoors ---
    (["hiking", "hike", "trail walk"],        "outdoors",  ["hiking"],       0.9),
    (["kayaking", "kayak"],                   "outdoors",  ["water"],        0.88),
    (["birding", "bird watching", "bird walk"],
                                              "outdoors",  [],               0.85),
    (["camping", "campfire"],                 "outdoors",  ["camping"],      0.85),
    (["nature walk", "nature hike"],          "outdoors",  [],               0.85),

    # --- Volunteer ---
    (["food pantry", "food bank", "food drive"],
                                              "volunteer", ["food-bank"],    0.9),
    (["blood drive"],                        "volunteer", [],               0.9),
    (["tree planting", "tree plant"],         "volunteer", ["tree-planting"], 0.9),
    (["meal delivery", "meal packing"],       "volunteer", ["meal-delivery"], 0.9),
    (["cleanup", "clean up", "park cleanup"], "volunteer", ["cleanup"],      0.85),
    (["volunteer"],                           "volunteer", [],               0.8),

    # --- Civic ---
    (["floor session", "senate session", "house session", "legislative session"],
                                              "civic",     ["legislation"],  0.92),
    (["town hall", "town hall meeting"],      "civic",     ["town-hall"],    0.9),
    (["public comment", "public hearing"],    "civic",     ["public-comment"], 0.88),
    (["voter registration"],                  "civic",     ["voter-registration"], 0.92),
    (["city council", "county commission"],   "civic",     ["commission"],   0.88),

    # --- Support ---
    (["social work intern"],                  "support",   ["peer-support"], 0.86),
    (["adults with disabilities"],            "support",   ["peer-support"], 0.88),
    (["aa meeting", "alcoholics anonymous"],  "support",   ["recovery"],     0.92),
    (["na meeting", "narcotics anonymous"],   "support",   ["recovery"],     0.92),
    (["grief support", "grief group"],        "support",   ["grief"],        0.9),
    (["support group"],                       "support",   ["peer-support"], 0.85),

    # --- Religious ---
    (["worship service", "sunday service", "church service"],
                                              "religious", ["worship"],      0.9),
    (["bible study", "bible class"],          "religious", ["bible-study"],  0.9),
    (["prayer meeting", "prayer service"],    "religious", ["prayer"],       0.88),

    # --- Education ---
    (["language learning", "conversations in english"],
                                              "education", ["language"],     0.9),
    (["homework help", "tutoring"],          "education", [],               0.9),
    (["book-a-librarian", "book a librarian", "1:1 tech help", "tech help", "computer basics", "internet basics"],
                                              "education", ["technology"],   0.88),
    (["english as a second language", "study cafe"],
                                              "education", ["language"],     0.88),
    (["ged study", "ged class"],             "education", [],               0.88),
    (["code-blazers", "coding club", "coding class", "learn to code"],
                                              "education", ["technology"],   0.88),
    (["artificial intelligence", "ai basics", "intro to ai"],
                                              "education", ["technology"],   0.88),
    (["seminar"],                             "education", ["seminar"],      0.82),
    (["esl class", "english class", "language class"],
                                              "education", ["language"],     0.85),
    (["lecture series", "public lecture"],    "education", ["lecture"],      0.82),

    # --- Workshops / participatory music programs ---
    (["ukulele series of classes", "ukulele class", "ukulele program", "ukulele group"],
                                              "workshops", [],               0.86),

    # --- Conventions ---
    (["comic con", "comicon", "anime con", "anime convention"],
                                              "conventions", ["fan"],        0.9),

    # --- Film ---
    (["filmmakers club", "film club"],        "film",      [],               0.88),
    (["movie night", "movie screening", "film screening", "friday movies"],
                                              "film",      [],               0.88),

    # --- Family ---
    (["sensory play", "sensory playtime"],    "family",    [],               0.85),
    (["expo", "trade show", "trade expo"],    "conventions", ["trade"],      0.65),
    (["conference"],                          "conventions", [],             0.65),
    (["convention"],                          "conventions", ["convention"], 0.65),

    # --- Food & Drink ---
    (["happy hour"],                          "food_drink", ["happy-hour"],  0.88),
    (["food festival", "food fest"],          "food_drink", ["food-festival"], 0.88),
    (["wine tasting", "wine dinner"],         "food_drink", ["wine"],        0.88),
    (["beer tasting", "beer festival", "brew fest"],
                                              "food_drink", ["beer"],        0.88),
    (["farmers market", "farmer's market", "farmers' market"],
                                              "food_drink", ["farmers-market"], 0.92),
    (["pop-up dinner", "pop-up restaurant"],  "food_drink", ["pop-up"],      0.85),
    (["cocktail class", "mixology class"],    "food_drink", ["cocktails"],   0.88),
]

# ---------------------------------------------------------------------------
# Dance-party-at-bar override constants
# ---------------------------------------------------------------------------

_DANCE_VENUE_TYPES = {"nightclub", "bar", "club", "sports_bar"}
_OPEN_FORMAT_SOCIAL_VENUE_TYPES = {
    "bar",
    "nightclub",
    "club",
    "restaurant",
    "brewery",
    "food_hall",
    "lounge",
}
_DANCE_STYLE_KEYWORDS = [
    "salsa", "bachata", "swing", "latin", "line dancing", "line dance",
    "waltz", "tango", "foxtrot", "ballroom", "flamenco", "tap",
    "contemporary", "ballet",
]
_OPEN_MIC_WORDS_HINTS = ("poetry", "spoken word", "spoken-word")
_OPEN_MIC_COMEDY_HINTS = ("comedy", "stand-up", "standup", "improv")


# ---------------------------------------------------------------------------
# Core helpers
# ---------------------------------------------------------------------------

def _best_title_match(
    title: str,
) -> tuple[Optional[str], list[str], float]:
    """Return (category, genres, confidence) for the best title pattern match.

    Multi-word phrases are checked as whole phrases first so 'improv show'
    beats a hypothetical single-word 'show' match. Within a single pattern
    entry, confidence is the same for any keyword in the list, so we just
    find the best-confidence match across all entries.
    """
    best_category: Optional[str] = None
    best_genres: list[str] = []
    best_confidence: float = 0.0

    for keywords, category, genres, confidence in _TITLE_PATTERNS:
        if confidence <= best_confidence:
            # Can't improve; skip (patterns are not sorted, but we keep best)
            pass
        for kw in keywords:
            if _word_match(title, kw):
                if confidence > best_confidence:
                    best_confidence = confidence
                    best_category = category
                    best_genres = list(genres)
                break  # one match per pattern entry is enough

    return best_category, best_genres, best_confidence


def _has_dance_style_keyword(title: str) -> bool:
    """Return True if the title contains a specific dance style keyword."""
    for kw in _DANCE_STYLE_KEYWORDS:
        if _word_match(title, kw):
            return True
    return False


def _description_has_any(description: str, phrases: tuple[str, ...]) -> bool:
    """Return True if any phrase appears with word-boundary-aware matching."""
    for phrase in phrases:
        if _word_match(description, phrase):
            return True
    return False


def _infer_audience(text: str) -> str:
    """Infer audience from explicit event text only. Never from venue type.

    Returns the most specific match found, defaulting to 'general'.
    """
    if re.search(r"\b21\s*\+|\bages?\s+21\b", text, re.IGNORECASE):
        return "21+"
    if re.search(r"\b18\s*\+", text, re.IGNORECASE):
        return "18+"
    if re.search(r"\bpreschool\b|ages?\s+3[-–]5\b|ages?\s+4[-–]5\b", text, re.IGNORECASE):
        return "preschool"
    if re.search(r"\btoddler\b|ages?\s+1[-–]3\b|ages?\s+2[-–]3\b", text, re.IGNORECASE):
        return "toddler"
    if re.search(r"\bages?\s+(6[-–]11|7[-–]11|5[-–]10|6[-–]12)\b|\belementary\b",
                 text, re.IGNORECASE):
        return "kids"
    if re.search(r"\bteen\b|\bteens\b|\bages?\s+13\b|\bages?\s+13[-–]", text, re.IGNORECASE):
        return "teen"
    return "general"


def _infer_music_genres_title_only(title: str, result: ClassificationResult) -> None:
    """Infer music genres from title only (never from description).

    Per spec: music genre from bio/description is explicitly forbidden —
    only the event title is used to avoid false positives from venue or
    artist biography text.
    """
    patterns: list[tuple[list[str], str]] = [
        (["jazz", "bebop", "big band"],          "jazz"),
        (["blues", "juke joint"],                "blues"),
        (["hip hop", "hip-hop"],                 "hip-hop"),
        (["rock", "punk", "metal"],              "rock"),
        (["indie", "lo-fi"],                     "indie"),
        (["country", "honky"],                   "country"),
        (["folk", "bluegrass"],                  "folk"),
        (["electronic", "edm", "house", "techno"], "electronic"),
        (["classical", "symphony", "orchestra", "chamber"], "classical"),
        (["soul", "r&b", "neo-soul"],            "soul"),
        (["reggae", "ska"],                      "reggae"),
        (["gospel"],                             "gospel"),
        (["singer-songwriter", "acoustic"],      "singer-songwriter"),
        (["latin", "cumbia"],                    "latin"),
        (["cover band", "tribute"],              "cover"),
        (["karaoke"],                            "karaoke"),
        (["dj set", "dj night"],                 "dj"),
    ]
    for keywords, genre in patterns:
        if any(_word_match(title, kw) for kw in keywords):
            if genre not in result.genres:
                result.genres.append(genre)


def _infer_nonmusic_genres(
    category: str, title: str, description: str, result: ClassificationResult
) -> None:
    """Infer genres for non-music categories from title + description combined."""
    valid_genres = GENRES_BY_CATEGORY.get(category, set())
    if not valid_genres:
        return
    combined = f"{title} {description or ''}"
    for genre in sorted(valid_genres):  # sorted for determinism
        if _word_match(combined, genre.replace("-", " ")) or _word_match(combined, genre):
            if genre not in result.genres:
                result.genres.append(genre)


def _validate_genres(category: str, genres: list[str]) -> list[str]:
    """Strip genres that don't belong to the assigned category."""
    valid_for_category = GENRES_BY_CATEGORY.get(category, set())
    return [g for g in genres if g in valid_for_category]


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def classify_rules(
    title: str,
    description: str = "",
    venue_type: Optional[str] = None,
    category_hint: Optional[str] = None,
    # Extra params accepted (but unused) so orchestrator can call uniformly
    source_name: Optional[str] = None,
    source_id: Optional[int] = None,
    source_slug: Optional[str] = None,
    genres_hint: Optional[list[str]] = None,
) -> ClassificationResult:
    """Apply rules-based classification. Source defaults are NOT checked here.

    Args:
        title: Event title (required).
        description: Event description (optional). Used for non-music genre
            inference only — never for music genre inference.
        venue_type: Venue type slug (e.g. "bar", "cinema"). Used for venue
            hints and dance-party override.
        category_hint: Category hint from the crawler (lowest priority, 0.5
            confidence ceiling).
        source_name: Unused at rules layer; accepted for orchestrator compat.
        source_id: Unused at rules layer; accepted for orchestrator compat.
        source_slug: Unused at rules layer; accepted for orchestrator compat.
        genres_hint: Unused at rules layer; accepted for orchestrator compat.

    Returns:
        ClassificationResult with category, genres, audience, confidence, and source.
    """
    result = ClassificationResult(source="rules")
    title = title or ""
    description = description or ""

    # ------------------------------------------------------------------
    # Step 1: Title pattern matching
    # ------------------------------------------------------------------
    matched_category, matched_genres, matched_confidence = _best_title_match(title)

    if matched_category:
        result.category = matched_category
        result.genres = matched_genres
        result.confidence = matched_confidence

    # ------------------------------------------------------------------
    # Step 2: Dance-party-at-bar override
    # When a title matches "dance" category but venue is a bar/nightclub
    # AND no specific dance style keyword was found, it's almost certainly
    # a DJ night / dance party → reclassify as music with dj genre.
    # ------------------------------------------------------------------
    if (
        result.category == "dance"
        and venue_type in _DANCE_VENUE_TYPES
        and not _has_dance_style_keyword(title)
    ):
        result.category = "music"
        result.genres = ["dj"]
        result.confidence = 0.7

    # ------------------------------------------------------------------
    # Step 2a: Open-format karaoke at bar/nightlife venues
    # Preserve the social-format classification instead of force-promoting
    # karaoke into "music" when the venue context is clearly bar/nightlife.
    # ------------------------------------------------------------------
    if (
        result.category == "music"
        and "karaoke" in result.genres
        and venue_type in _OPEN_FORMAT_SOCIAL_VENUE_TYPES
    ):
        result.category = category_hint or "nightlife"
        result.confidence = 0.85 if result.category == "nightlife" else 0.5

    # ------------------------------------------------------------------
    # Step 2aa: Ambiguous open mic with literary/comedy cues
    # Generic "open mic" titles are intentionally low-confidence. When the
    # description clearly says the format includes poetry/spoken word or
    # comedy, keep that deterministic classification and avoid escalating an
    # ambiguous recurring format into an overconfident LLM rewrite.
    # ------------------------------------------------------------------
    if result.category == "music" and "open-mic" in result.genres:
        if _description_has_any(description, _OPEN_MIC_WORDS_HINTS):
            result.category = "words"
            result.confidence = 0.72
        elif _description_has_any(description, _OPEN_MIC_COMEDY_HINTS):
            result.category = "comedy"
            result.confidence = 0.72

    # ------------------------------------------------------------------
    # Step 2b: Sports watch party at sports bar
    # When venue is sports_bar AND title/description signals a watch party
    # with a known sport keyword, override to sports category.
    # This runs AFTER the dance-party check but BEFORE general venue hints
    # so the specific detection wins over the generic sports_bar → film fallback.
    # ------------------------------------------------------------------
    if venue_type == "sports_bar":
        watch_party_result = detect_sports_watch_party(title, description)
        if watch_party_result is not None:
            _wp_category, _wp_genre, _wp_tags = watch_party_result
            result.category = _wp_category  # "sports"
            result.genres = [_wp_genre]  # ["watch_party"]
            result.confidence = 0.88
            result.source = "rules"

    # ------------------------------------------------------------------
    # Step 3: Venue type hints (only when title matching produced nothing)
    # ------------------------------------------------------------------
    if not result.category and venue_type and venue_type in _VENUE_CATEGORY_HINTS:
        hint_category, hint_confidence = _VENUE_CATEGORY_HINTS[venue_type]
        result.category = hint_category
        result.confidence = hint_confidence

    # ------------------------------------------------------------------
    # Step 4: Category hint from crawler (lowest priority, capped at 0.5)
    # ------------------------------------------------------------------
    if not result.category and category_hint:
        result.category = category_hint
        result.confidence = 0.5

    # ------------------------------------------------------------------
    # Step 5 + 6: Genre inference + validation
    # ------------------------------------------------------------------
    if result.category == "music":
        _infer_music_genres_title_only(title, result)
    elif result.category:
        # Title patterns already seeded genres; also scan title+desc for more
        _infer_nonmusic_genres(result.category, title, description, result)

    # Validate: strip any genres not in the assigned category's set
    if result.category:
        result.genres = _validate_genres(result.category, result.genres)

    # ------------------------------------------------------------------
    # Step 7: Audience inference (from explicit event text only)
    # ------------------------------------------------------------------
    result.audience = _infer_audience(f"{title} {description}")

    return result


# ---------------------------------------------------------------------------
# LLM classification layer
# ---------------------------------------------------------------------------

def _build_genre_list_text() -> str:
    """Generate genre list section for the LLM prompt."""
    _SKIP_LEGACY = {
        "nightlife", "community", "family", "recreation", "wellness",
        "exercise", "learning", "meetup", "gaming", "outdoor",
    }
    lines = []
    for cat, genres in sorted(GENRES_BY_CATEGORY.items()):
        if cat in _SKIP_LEGACY:
            continue
        lines.append(f"  {cat}: {', '.join(sorted(genres))}")
    return "\n".join(lines)


_SYSTEM_PROMPT = f"""You are an event taxonomy classifier for LostCity, an Atlanta event discovery platform.

Classify the event into exactly one of these 19 categories:
  music         - Live performances, concerts, DJ sets, karaoke. NOT dance classes.
  film          - Movie screenings, film festivals, cinema events.
  comedy        - Stand-up, improv, sketch, roast, comedy open mic.
  theater       - Plays, musicals, opera, puppetry, drag, burlesque.
  art           - Gallery openings, exhibitions, art shows, art fairs.
  dance         - Dance classes, dance performances, social dance nights with a named style.
  sports        - Spectator sports: games, matches, tournaments, watch parties.
  fitness       - Workout classes, yoga, run clubs, martial arts, cycling, pilates, barre.
  outdoors      - Hiking, kayaking, camping, birding, nature walks, trail events.
  games         - Trivia, bingo, poker, board games, D&D, escape rooms, esports.
  food_drink    - Tastings, food festivals, farmers markets, cooking classes, happy hours.
  conventions   - Cons, expos, trade shows, conferences, fan conventions.
  workshops     - Hands-on making: pottery, painting, woodworking, jewelry, glassblowing.
  education     - Seminars, lectures, certifications, language classes, professional training.
  words         - Book clubs, author talks, poetry readings, spoken word, storytime.
  volunteer     - Volunteer shifts, service events, cleanups, food drives.
  civic         - Town halls, public hearings, legislative sessions, voter registration.
  support       - Recovery meetings, grief groups, peer support, mental health groups.
  religious     - Worship services, Bible study, prayer meetings, choir, ministry events.

Rules:
- Dance workshops and classes → "dance". General skill-building workshops → "workshops".
- "Education" is for seminars/lectures/certifications, NOT hands-on craft workshops.
- Watch parties for sports events → "sports", not "music" or "film".
- Audience is "general" UNLESS the event text EXPLICITLY gates by age (e.g. "21+ only", "ages 6-12"). A bar venue alone does NOT make an event "21+".

Valid genres per category:
{_build_genre_list_text()}

Return a JSON object with these fields:
  category           - one of the 19 categories above (string)
  genres             - list of valid genre slugs for that category (array of strings, may be empty)
  audience           - "general", "21+", "18+", "kids", "teen", "toddler", or "preschool" (string)
  duration           - "quick" (<2h), "medium" (2-4h), "long" (4-8h), "all-day", or null (string or null)
  cost_tier          - "free", "$", "$$", "$$$", or null (string or null)
  skill_level        - "beginner", "intermediate", "advanced", "all-levels", or null (string or null)
  booking_required   - true, false, or null (boolean or null)
  indoor_outdoor     - "indoor", "outdoor", "both", or null (string or null)
  significance       - "low", "medium", "high", or null (string or null)
  significance_signals - list of strings explaining why significance is high (e.g. ["annual festival", "sold out last year"]) (array)
  confidence         - float 0.0-1.0 reflecting how certain you are of the category assignment

Respond with ONLY valid JSON. No markdown, no explanation."""


def _strip_markdown_fences(raw: str) -> str:
    raw = raw.strip()
    if raw.startswith("```"):
        raw = raw.split("\n", 1)[1] if "\n" in raw else raw[3:]
    if raw.endswith("```"):
        raw = raw[:-3]
    return raw.strip()


_VALID_NEW_CATEGORIES = {
    "music", "film", "comedy", "theater", "art", "dance",
    "sports", "fitness", "outdoors", "games",
    "food_drink", "conventions",
    "workshops", "education", "words",
    "volunteer", "civic", "support", "religious",
}


def classify_llm(
    title: str,
    description: str = "",
    venue_type: Optional[str] = None,
    venue_name: Optional[str] = None,
    source_name: Optional[str] = None,
) -> ClassificationResult:
    """Classify an event using the LLM. Returns a ClassificationResult with source='llm'.

    On API or parse errors, returns an empty result (category=None, confidence=0.0).
    """
    result = ClassificationResult(source="llm")

    user_msg = f"Title: {title}\n"
    if description:
        user_msg += f"Description: {description[:800]}\n"
    if venue_name:
        user_msg += f"Venue: {venue_name}\n"
    if venue_type:
        user_msg += f"Venue type: {venue_type}\n"
    if source_name:
        user_msg += f"Source: {source_name}\n"

    try:
        raw = generate_text(
            system_prompt=_SYSTEM_PROMPT,
            user_message=user_msg,
        )
    except Exception as e:
        logger.error("LLM API call failed for '%s': %s", title[:60], e)
        return result

    try:
        cleaned = _strip_markdown_fences(raw)
        data = json.loads(cleaned)
    except json.JSONDecodeError:
        logger.warning("LLM returned non-JSON for '%s': %.100s", title[:60], raw)
        return result

    result.category = _normalize_nullable_text(data.get("category"))
    result.genres = data.get("genres", [])
    result.audience = _normalize_nullable_text(data.get("audience")) or "general"
    result.confidence = float(data.get("confidence", 0.5))
    result.duration = _normalize_nullable_text(data.get("duration"))
    result.cost_tier = _normalize_cost_tier(data.get("cost_tier"))
    result.skill_level = _normalize_choice(data.get("skill_level"), _VALID_SKILL_LEVELS)
    result.booking_required = _normalize_booking_required(data.get("booking_required"))
    result.indoor_outdoor = _normalize_choice(
        data.get("indoor_outdoor"), _VALID_INDOOR_OUTDOOR
    )
    result.significance = _normalize_choice(
        data.get("significance"), _VALID_SIGNIFICANCE
    )
    result.significance_signals = _normalize_significance_signals(
        data.get("significance_signals", [])
    )

    # Validate: strip genres that don't belong to the returned category
    if result.category and result.genres:
        allowed = GENRES_BY_CATEGORY.get(result.category, set())
        result.genres = [g for g in result.genres if g in allowed]

    # Validate category against known set
    if result.category not in _VALID_NEW_CATEGORIES:
        logger.warning(
            "LLM returned invalid category '%s' for '%s'", result.category, title[:60]
        )
        result.category = None
        result.confidence = 0.0

    return result


# ---------------------------------------------------------------------------
# Orchestrator — source defaults → rules → LLM fallback
# ---------------------------------------------------------------------------

from source_defaults import get_source_default  # noqa: E402 — intentional late import


def classify_event(
    title: str,
    description: str = "",
    venue_type: Optional[str] = None,
    venue_name: Optional[str] = None,
    source_name: Optional[str] = None,
    source_id: Optional[int] = None,
    source_slug: Optional[str] = None,
    category_hint: Optional[str] = None,
    genres_hint: Optional[list[str]] = None,
) -> ClassificationResult:
    """Classify an event using the three-layer pipeline.

    Layer 1 — source defaults: deterministic override for high-volume sources
        where every event has the same category (e.g. AMC theatres → film).
    Layer 2 — rules: fast pattern matching, no network calls.
    Layer 3 — LLM fallback: called only when rules confidence < CONFIDENCE_THRESHOLD.

    Args:
        title: Event title (required).
        description: Event description text.
        venue_type: Venue type slug (e.g. "bar", "cinema").
        venue_name: Human-readable venue name (passed to LLM context).
        source_name: Crawler/source name string.
        source_id: Source DB id for source-default lookup.
        source_slug: Source slug for source-default lookup.
        category_hint: Crawler-supplied category hint (capped at 0.5 confidence).
        genres_hint: Crawler-supplied genre hints (unused by current layers).

    Returns:
        ClassificationResult with prompt_version always set.
    """
    # Layer 1: Source defaults
    source_default = get_source_default(
        source_id=source_id, source_name=source_name, source_slug=source_slug
    )
    if source_default:
        return ClassificationResult(
            category=source_default["category"],
            genres=[source_default["genre"]] if "genre" in source_default else [],
            confidence=0.95,
            source="source_default",
            prompt_version=TAXONOMY_PROMPT_VERSION,
        )

    # Layer 2: Rules
    result = classify_rules(
        title=title,
        description=description,
        venue_type=venue_type,
        source_name=source_name,
        source_id=source_id,
        source_slug=source_slug,
        category_hint=category_hint,
        genres_hint=genres_hint,
    )

    # Layer 3: LLM fallback (only when rules didn't reach threshold)
    if result.confidence < CONFIDENCE_THRESHOLD:
        start = time.monotonic()
        llm_result = classify_llm(
            title=title,
            description=description,
            venue_type=venue_type,
            venue_name=venue_name,
            source_name=source_name,
        )
        elapsed = time.monotonic() - start
        if elapsed > 3.0:
            logger.info("LLM classify took %.1fs for '%s'", elapsed, title[:40])
        if llm_result.category and llm_result.confidence > result.confidence:
            result = llm_result

    result.prompt_version = TAXONOMY_PROMPT_VERSION
    return result
