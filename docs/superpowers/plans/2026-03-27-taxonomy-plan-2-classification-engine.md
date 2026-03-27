# Taxonomy Redesign Plan 2: Hybrid Classification Engine

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the regex/substring classification engine with a hybrid rules + LLM pipeline that classifies events into the new 19-category taxonomy with per-category genre scoping, audience tagging, and derived attributes.

**Architecture:** New `crawlers/classify.py` module contains the rules engine, LLM classifier, and validation layer. It plugs into the existing `INSERT_PIPELINE` in `db/events.py` as a new step that runs alongside (and eventually replaces) the old `_step_infer_category`, `_step_infer_genres`, and `_step_infer_tags`. The LLM layer uses the existing `llm_client.py` abstraction.

**Tech Stack:** Python, pytest, Anthropic Claude API (via existing llm_client.py)

**Spec:** `docs/superpowers/specs/2026-03-27-event-taxonomy-redesign.md`

**Depends on:** Plan 1 (schema & constants) — must be complete.

**Review amendments (2026-03-27):** Incorporates fixes from architect + crawler-dev reviews. Key changes: source_id extraction from ctx.source_info, column-existence guard, feature flag, fixed genre mappings, LLM prompt with genre lists, markdown-fence stripping, timeout wrapper, disagreement logging.

---

### Task 1: Source-level category defaults

**Files:**
- Create: `crawlers/source_defaults.py`
- Test: `crawlers/tests/test_source_defaults.py`

Source-level defaults short-circuit classification for high-volume sources where the category is deterministic. This avoids wasting LLM tokens on 651 identical Painting With a Twist events.

**Review fix:** Callanwolde (#809) removed from source defaults — its events split between workshops (classes) and art (exhibitions), so it needs rules/LLM classification per-event.

- [ ] **Step 1: Write test**

```python
# crawlers/tests/test_source_defaults.py
"""Tests for source-level category defaults."""
from source_defaults import get_source_default

def test_painting_with_a_twist():
    assert get_source_default(source_id=554) == {"category": "workshops"}

def test_callanwolde_not_in_defaults():
    """Callanwolde has mixed content (classes + exhibitions) — should NOT have a default."""
    assert get_source_default(source_id=809) is None

def test_amc_theaters():
    assert get_source_default(source_name="AMC Phipps Plaza 14") == {"category": "film"}

def test_unknown_source():
    assert get_source_default(source_id=999999) is None

def test_coder_school():
    assert get_source_default(source_id=1318) == {"category": "education", "genre": "technology"}

def test_spruill_center():
    assert get_source_default(source_id=808) == {"category": "workshops"}

def test_recovery_source_slug():
    assert get_source_default(source_slug="alcoholics-anonymous-atlanta") == {"category": "support"}
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/coach/Projects/LostCity/crawlers && python3 -m pytest tests/test_source_defaults.py -v
```

- [ ] **Step 3: Implement source_defaults.py**

```python
# crawlers/source_defaults.py
"""
Source-level category defaults for high-volume deterministic sources.
These short-circuit the classification pipeline — no rules or LLM needed.

Only add sources here when EVERY event from that source has the same category.
If a source has mixed content (e.g., Callanwolde has both classes and exhibitions),
do NOT add it — let the rules/LLM classify per-event.
"""
from __future__ import annotations
from typing import Optional

# source_id -> {category, genre (optional)}
_SOURCE_ID_DEFAULTS: dict[int, dict] = {
    # Paint-and-sip chains -> workshops
    554: {"category": "workshops"},   # Painting With a Twist
    # Arts centers (classes only — no exhibitions)
    808: {"category": "workshops"},   # Spruill Center
    # Coding schools -> education
    1318: {"category": "education", "genre": "technology"},  # theCoderSchool
}

# source_name prefix -> {category}
_SOURCE_NAME_DEFAULTS: list[tuple[str, dict]] = [
    ("AMC ", {"category": "film"}),
    ("Regal ", {"category": "film"}),
]

# Recovery / support group source slugs
_SUPPORT_SOURCE_SLUGS = {
    "alcoholics-anonymous-atlanta",
    "narcotics-anonymous-georgia",
    "ga-council-recovery",
}


def get_source_default(
    source_id: int = None,
    source_name: str = None,
    source_slug: str = None,
) -> Optional[dict]:
    """
    Return category default for a known source, or None if no default exists.
    Returns dict with at least {"category": "..."}, optionally {"genre": "..."}.
    """
    if source_id and source_id in _SOURCE_ID_DEFAULTS:
        return _SOURCE_ID_DEFAULTS[source_id].copy()

    if source_slug and source_slug in _SUPPORT_SOURCE_SLUGS:
        return {"category": "support"}

    if source_name:
        for prefix, default in _SOURCE_NAME_DEFAULTS:
            if source_name.startswith(prefix):
                return default.copy()

    return None
```

- [ ] **Step 4: Run tests**

```bash
cd /Users/coach/Projects/LostCity/crawlers && python3 -m pytest tests/test_source_defaults.py -v
```

- [ ] **Step 5: Commit**

```bash
git add crawlers/source_defaults.py crawlers/tests/test_source_defaults.py
git commit -m "feat(crawlers): source-level category defaults for high-volume sources"
```

---

### Task 2: Rules-based classifier with word-boundary matching

**Files:**
- Create: `crawlers/classify.py`
- Test: `crawlers/tests/test_classify_rules.py`

The rules layer assigns category + genres using deterministic patterns. It fixes the two biggest bugs in the current system: substring matching and title+description genre contamination for music.

**Review fixes applied:**
- Source defaults NOT called from classify_rules (only in orchestrator)
- "expo", "mtg" use bare words (no trailing spaces) — `_word_match` handles boundaries
- Swing/bachata/latin each map to their own genre
- MTG separated from warhammer
- "open mic" lowered to 0.6 confidence (could be comedy)
- "dance party" at nightclub/bar biases toward music
- Added patterns for farmer's market, gallery opening, improv, escape room

- [ ] **Step 1: Write tests for the rules classifier**

```python
# crawlers/tests/test_classify_rules.py
"""Tests for the rules-based classification engine."""
from classify import classify_rules, ClassificationResult

def test_cinema_venue_defaults_to_film():
    result = classify_rules(title="Project Hail Mary", description="", venue_type="cinema")
    assert result.category == "film"
    assert result.confidence >= 0.8

def test_stadium_defaults_to_sports():
    result = classify_rules(title="Braves vs Royals", description="", venue_type="stadium")
    assert result.category == "sports"

def test_trivia_is_games_not_nightlife():
    result = classify_rules(title="Geek Trivia Night", description="Test your knowledge", venue_type="bar")
    assert result.category == "games"
    assert "trivia" in result.genres

def test_drag_show_is_theater():
    result = classify_rules(title="Friday Night Drag Show", description="Drag performances", venue_type="bar")
    assert result.category == "theater"
    assert "drag" in result.genres

def test_dj_set_is_music():
    result = classify_rules(title="DJ Jen $5 Fridays", description="", venue_type="bar")
    assert result.category == "music"
    assert "dj" in result.genres

def test_word_boundary_esports():
    """BlazeSports should NOT trigger esports."""
    result = classify_rules(
        title="Learn to Swim",
        description="BlazeSports America is excited to offer swimming",
        venue_type="fitness_center",
    )
    assert "esports" not in result.genres

def test_word_boundary_bout():
    """'about' should NOT trigger MMA/roller-derby 'bout'."""
    result = classify_rules(title="Bowling", description="Come learn about bowling techniques", venue_type="recreation")
    assert "mma" not in result.genres
    assert "roller-derby" not in result.genres

def test_music_genre_title_only():
    """Music genre inference should NOT fire on artist bio descriptions."""
    result = classify_rules(
        title="Anna Tivel",
        description="Anna Tivel is a folk singer whose early influences include post-punk and new wave",
        venue_type="music_venue",
        category_hint="music",
    )
    assert "punk" not in result.genres

def test_paint_and_sip_is_workshops():
    result = classify_rules(title="Date Night! Blossoming Night!", description="Paint and sip party", venue_type="studio")
    assert result.category == "workshops"

def test_book_club_is_words():
    result = classify_rules(title="Nonfiction Friday Book Club", description="Monthly book discussion", venue_type="library")
    assert result.category == "words"
    assert "book-club" in result.genres

def test_yoga_is_fitness():
    result = classify_rules(title="Friday Morning Yoga", description="All levels vinyasa flow", venue_type="studio")
    assert result.category == "fitness"
    assert "yoga" in result.genres

def test_hiking_is_outdoors():
    result = classify_rules(title="Eagle Mountain to Sassafras Knob", description="A moderate 6-mile hike", venue_type="park")
    assert result.category == "outdoors"
    assert "hiking" in result.genres

def test_volunteer_detected():
    result = classify_rules(title="Food Pantry - Product Sorter", description="Help sort donated food", venue_type="organization")
    assert result.category == "volunteer"

def test_civic_detected():
    result = classify_rules(title="Senate: Floor Session (LD 38)", description="", venue_type="government")
    assert result.category == "civic"

def test_recovery_is_support():
    result = classify_rules(title="Gratitude Group", description="Open AA meeting", venue_type="church")
    assert result.category == "support"

def test_open_mic_low_confidence():
    """Open mic is ambiguous (could be comedy) — should be low confidence for LLM fallback."""
    result = classify_rules(title="Open Mic Night", description="", venue_type="bar")
    assert result.confidence <= 0.65

def test_swing_night_genre_is_swing():
    """Swing night should get 'swing' genre, not 'salsa'."""
    result = classify_rules(title="Friday Swing Night", description="", venue_type="bar")
    assert result.category == "dance"
    assert "swing" in result.genres
    assert "salsa" not in result.genres

def test_bachata_night_genre_is_bachata():
    result = classify_rules(title="Bachata Night", description="", venue_type="bar")
    assert result.category == "dance"
    assert "bachata" in result.genres

def test_mtg_is_games_not_warhammer():
    result = classify_rules(title="Magic the Gathering Tournament", description="", venue_type="games")
    assert result.category == "games"
    assert "warhammer" not in result.genres

def test_expo_matches_convention():
    result = classify_rules(title="Southern Fried Gaming Expo", description="", venue_type="convention_center")
    assert result.category == "conventions"

def test_improv_is_comedy():
    result = classify_rules(title="Friday Night Improv Show", description="", venue_type="theater")
    assert result.category == "comedy"
    assert "improv" in result.genres

def test_gallery_opening_is_art():
    result = classify_rules(title="Spring Gallery Opening Reception", description="", venue_type="gallery")
    assert result.category == "art"

def test_farmers_market_is_food():
    result = classify_rules(title="Saturday Farmers Market", description="", venue_type="farmers_market")
    assert result.category == "food_drink"
    assert "farmers-market" in result.genres

def test_escape_room_is_games():
    result = classify_rules(title="Escape Room: Mystery Mansion", description="", venue_type="entertainment")
    assert result.category == "games"
    assert "escape-room" in result.genres

def test_dance_party_at_nightclub_is_music():
    """Dance party at a nightclub should bias toward music, not dance."""
    result = classify_rules(title="Friday Night Dance Party", description="", venue_type="nightclub")
    assert result.category == "music"

def test_audience_21_explicit():
    """Event with explicit 21+ in title should get 21+ audience."""
    result = classify_rules(title="Comedy Night - Ages 21+", description="", venue_type="comedy_club")
    assert result.audience == "21+"

def test_audience_kids():
    result = classify_rules(title="Preschool Storytime", description="Ages 3-5", venue_type="library")
    assert result.audience in ("preschool", "kids")

def test_audience_general_at_bar():
    """Bar venue alone should NOT set 21+ audience — only explicit event gates do."""
    result = classify_rules(title="Trivia Night", description="", venue_type="bar")
    assert result.audience == "general"
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/coach/Projects/LostCity/crawlers && python3 -m pytest tests/test_classify_rules.py -v
```

- [ ] **Step 3: Implement classify.py — rules layer**

Create `crawlers/classify.py`. Key design principles from review:
- `_word_match()` uses `\b` regex for all keyword matching
- Music genre inference uses TITLE ONLY (not description)
- Source defaults are NOT in classify_rules — only in the orchestrator
- Each dance style maps to its own genre
- MTG is separate from Warhammer
- "open mic" is low confidence (0.6) for LLM fallback
- Dance party at nightclub/bar → music (not dance)
- Audience tags: only set from explicit event signals (title contains "21+", "ages 3-5", etc.), never from venue type alone

```python
# crawlers/classify.py
"""
Hybrid classification engine for the new 19-category taxonomy.
Three layers: source defaults -> rules -> LLM fallback.
"""
from __future__ import annotations

import json
import logging
import os
import re
import time
from dataclasses import dataclass, field
from typing import Optional

from genre_normalize import GENRES_BY_CATEGORY

logger = logging.getLogger(__name__)

CONFIDENCE_THRESHOLD = 0.7
TAXONOMY_PROMPT_VERSION = "v1.0-2026-03-27"


@dataclass
class ClassificationResult:
    category: Optional[str] = None
    genres: list[str] = field(default_factory=list)
    audience: str = "general"
    confidence: float = 0.0
    source: str = "none"  # "source_default", "rules", "llm"
    prompt_version: Optional[str] = None
    # Derived attributes
    duration: Optional[str] = None
    cost_tier: Optional[str] = None
    skill_level: Optional[str] = None
    booking_required: Optional[bool] = None
    indoor_outdoor: Optional[str] = None
    significance: Optional[str] = None
    significance_signals: list[str] = field(default_factory=list)


def _word_match(text: str, keyword: str) -> bool:
    """Match keyword with word boundaries. Prevents 'esports' in 'blazesports'."""
    return bool(re.search(r'\b' + re.escape(keyword) + r'\b', text, re.IGNORECASE))


# --- Venue type -> category hints ---
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

# --- Title keyword patterns ---
# (keywords, category, genres, confidence)
# IMPORTANT: keywords must be plain words — _word_match handles boundaries
_TITLE_PATTERNS: list[tuple[list[str], str, list[str], float]] = [
    # Games
    (["trivia night", "trivia at", "pub quiz", "quiz night"], "games", ["trivia"], 0.9),
    (["bingo night", "bingo at", "drag bingo"], "games", ["bingo"], 0.9),
    (["board game", "game night", "poker night", "free poker"], "games", ["board-games"], 0.85),
    (["warhammer", "40k"], "games", ["warhammer"], 0.9),
    (["magic the gathering", "mtg tournament", "mtg draft"], "games", ["card-games"], 0.9),
    (["dungeons", "pathfinder"], "games", ["dnd"], 0.9),
    (["d&d"], "games", ["dnd"], 0.9),
    (["escape room"], "games", ["escape-room"], 0.9),
    # Comedy (before theater — improv is comedy, not theater)
    (["improv show", "improv night", "improv comedy"], "comedy", ["improv"], 0.9),
    (["stand-up", "standup", "comedy show", "comedy night", "comedy showcase"], "comedy", ["standup"], 0.85),
    # Theater / Performance
    (["drag show", "drag night", "drag brunch"], "theater", ["drag"], 0.9),
    (["drag race viewing"], "theater", ["drag"], 0.85),
    (["burlesque"], "theater", ["burlesque"], 0.9),
    (["puppet", "puppetry", "marionette"], "theater", ["puppet"], 0.9),
    # Music
    (["dj set", "dj night"], "music", ["dj"], 0.85),
    (["karaoke"], "music", ["karaoke"], 0.9),
    (["live music", "live band", "concert", "live jazz", "live blues"], "music", [], 0.85),
    (["open mic"], "music", [], 0.6),  # Low confidence — could be comedy
    # Dance (each style -> its own genre)
    (["salsa night", "salsa social"], "dance", ["salsa"], 0.9),
    (["bachata night", "bachata social"], "dance", ["bachata"], 0.9),
    (["latin night", "latin dance"], "dance", ["latin"], 0.9),
    (["swing night", "swing dance", "lindy hop"], "dance", ["swing"], 0.9),
    (["line dancing", "line dance"], "dance", ["line-dancing"], 0.9),
    # Fitness
    (["yoga class", "yoga at", "yoga in", "morning yoga"], "fitness", ["yoga"], 0.9),
    (["run club", "running club", "fun run"], "fitness", ["running"], 0.9),
    (["crossfit", "hiit", "boot camp", "bootcamp"], "fitness", ["crossfit"], 0.85),
    (["zumba", "dance cardio", "dance fitness"], "fitness", ["dance-fitness"], 0.9),
    (["swim lesson", "swim class", "water aerobics", "aqua fitness"], "fitness", ["swimming"], 0.85),
    # Workshops
    (["paint and sip", "paint & sip", "sip and paint", "painting with a twist"], "workshops", ["painting"], 0.95),
    (["pottery class", "ceramics class", "wheel throwing"], "workshops", ["pottery"], 0.9),
    (["cooking class", "cooking workshop"], "workshops", [], 0.85),
    (["blacksmith", "woodwork", "jewelry making", "candle making"], "workshops", [], 0.85),
    # Words / Literary
    (["book club", "book discussion", "reading group"], "words", ["book-club"], 0.9),
    (["author signing", "book signing", "book launch"], "words", ["signing"], 0.9),
    (["poetry reading", "poetry slam", "spoken word"], "words", ["poetry"], 0.9),
    (["storytime", "story time"], "words", ["storytime"], 0.9),
    # Art
    (["gallery opening", "art opening", "opening reception"], "art", ["exhibition"], 0.85),
    (["exhibition", "art exhibit"], "art", ["exhibition"], 0.8),
    # Outdoors
    (["hike to", "hiking", "nature walk", "trail run"], "outdoors", ["hiking"], 0.85),
    (["kayak", "paddle", "canoe"], "outdoors", ["paddling"], 0.85),
    (["bird walk", "birding"], "outdoors", ["birding"], 0.9),
    # Volunteer
    (["food pantry", "food bank", "food distribution"], "volunteer", ["food-bank"], 0.95),
    (["tree planting", "park cleanup", "trail maintenance", "forest restoration"], "volunteer", ["cleanup"], 0.9),
    (["meal delivery", "meal packing", "meal prep"], "volunteer", ["meal-delivery"], 0.9),
    # Civic
    (["town hall", "public comment", "public hearing"], "civic", ["town-hall"], 0.9),
    (["floor session", "committee meeting", "commission"], "civic", ["legislation"], 0.85),
    (["voter registration"], "civic", ["voter-registration"], 0.9),
    # Support
    (["aa meeting", "na meeting", "al-anon", "recovery meeting"], "support", ["recovery"], 0.95),
    (["grief support", "grief group", "bereavement"], "support", ["grief"], 0.9),
    # Conventions
    (["comic con", "comicon", "dragon con", "dragoncon"], "conventions", ["fan"], 0.95),
    (["expo", "trade show"], "conventions", [], 0.75),
    (["conference"], "conventions", [], 0.65),  # Low — many non-convention uses
    # Food & Drink
    (["happy hour", "oyster hour"], "food_drink", ["happy-hour"], 0.85),
    (["food festival", "taste of", "restaurant week"], "food_drink", ["food-festival"], 0.9),
    (["wine tasting", "beer tasting", "cocktail class"], "food_drink", ["tasting"], 0.85),
    (["farmers market", "farmer's market", "flea market"], "food_drink", ["farmers-market"], 0.9),
    # Religious
    (["worship service", "sunday service", "bible study", "prayer meeting"], "religious", ["worship"], 0.9),
    # Education
    (["seminar", "grand rounds", "symposium"], "education", ["seminar"], 0.75),
    (["esl class", "english as a second"], "education", ["language"], 0.9),
]


def _infer_audience(title: str, description: str) -> str:
    """Infer audience from explicit event text signals. NOT from venue type."""
    text = f"{title} {description}".lower()
    if _word_match(text, "21+") or _word_match(text, "ages 21"):
        return "21+"
    if _word_match(text, "18+") or _word_match(text, "ages 18"):
        return "18+"
    if any(_word_match(text, kw) for kw in ["preschool", "ages 3-5", "pre-k", "ages 2-5"]):
        return "preschool"
    if any(_word_match(text, kw) for kw in ["toddler", "ages 1-3", "ages 0-3"]):
        return "toddler"
    if any(_word_match(text, kw) for kw in ["ages 6-11", "ages 5-12", "elementary"]):
        return "kids"
    if any(_word_match(text, kw) for kw in ["teen", "ages 13", "ages 12-17"]):
        return "teen"
    return "general"


def classify_rules(
    title: str,
    description: str = "",
    venue_type: str = None,
    source_name: str = None,
    source_id: int = None,
    source_slug: str = None,
    category_hint: str = None,
    genres_hint: list[str] = None,
) -> ClassificationResult:
    """
    Classify an event using deterministic rules.
    Returns ClassificationResult with confidence score.
    If confidence < CONFIDENCE_THRESHOLD, caller should fall back to LLM.

    NOTE: Source defaults are NOT checked here — they belong in the orchestrator only.
    """
    result = ClassificationResult(source="rules")
    title_lower = title.lower() if title else ""
    desc_lower = description.lower() if description else ""

    # --- Title pattern matching (word-boundary) ---
    best_match: Optional[tuple[str, list[str], float]] = None
    for keywords, category, genres, conf in _TITLE_PATTERNS:
        if any(_word_match(title_lower, kw) for kw in keywords):
            if best_match is None or conf > best_match[2]:
                best_match = (category, genres, conf)

    if best_match:
        result.category = best_match[0]
        result.genres = list(best_match[1])
        result.confidence = best_match[2]

    # --- Dance party at nightclub/bar -> music (not dance) ---
    if result.category == "dance" and venue_type in ("nightclub", "bar", "club"):
        if not any(_word_match(title_lower, kw) for kw in
                   ["salsa", "bachata", "swing", "latin", "line dancing", "ballroom"]):
            result.category = "music"
            result.genres = ["dj"]
            result.confidence = 0.7

    # --- Venue type hints (only if title patterns didn't match) ---
    if not result.category and venue_type and venue_type in _VENUE_CATEGORY_HINTS:
        cat, conf = _VENUE_CATEGORY_HINTS[venue_type]
        result.category = cat
        result.confidence = conf

    # --- Category hint from crawler (lowest priority) ---
    if not result.category and category_hint:
        result.category = category_hint
        result.confidence = 0.5

    # --- Genre inference ---
    if result.category == "music":
        _infer_music_genres_title_only(title_lower, result)
    elif result.category:
        _infer_genres_for_category(title_lower, desc_lower, result)

    # --- Validate genres belong to category ---
    if result.category and result.genres:
        allowed = GENRES_BY_CATEGORY.get(result.category, set())
        result.genres = [g for g in result.genres if g in allowed]

    # --- Audience inference (from event text, not venue) ---
    result.audience = _infer_audience(title, description)

    return result


def _infer_music_genres_title_only(title: str, result: ClassificationResult):
    """Infer music genres from TITLE ONLY — not description (prevents bio contamination)."""
    patterns = [
        (["jazz", "bebop", "big band"], "jazz"),
        (["blues", "juke joint"], "blues"),
        (["hip hop", "hip-hop", "rap "], "hip-hop"),
        (["rock", "punk", "metal", "grunge"], "rock"),
        (["indie", "lo-fi"], "indie"),
        (["country", "honky"], "country"),
        (["folk", "bluegrass", "americana"], "folk"),
        (["electronic", "edm", "house", "techno"], "electronic"),
        (["classical", "symphony", "orchestra", "chamber"], "classical"),
        (["soul", "r&b", "rnb", "neo-soul"], "soul"),
        (["reggae", "ska", "dub"], "reggae"),
        (["gospel", "praise"], "gospel"),
        (["singer-songwriter", "acoustic"], "singer-songwriter"),
        (["latin", "salsa", "cumbia"], "latin"),
        (["cover band", "tribute"], "cover"),
        (["karaoke"], "karaoke"),
        (["dj set", "dj night"], "dj"),
    ]
    for keywords, genre in patterns:
        if any(_word_match(title, kw) for kw in keywords):
            if genre not in result.genres:
                result.genres.append(genre)


def _infer_genres_for_category(title: str, desc: str, result: ClassificationResult):
    """Infer genres from title + description for non-music categories."""
    text = f"{title} {desc}"
    allowed = GENRES_BY_CATEGORY.get(result.category, set())
    for genre in allowed:
        if _word_match(text, genre):
            if genre not in result.genres:
                result.genres.append(genre)
```

- [ ] **Step 4: Run tests**

```bash
cd /Users/coach/Projects/LostCity/crawlers && python3 -m pytest tests/test_classify_rules.py -v
```

Iterate until all pass.

- [ ] **Step 5: Commit**

```bash
git add crawlers/classify.py crawlers/tests/test_classify_rules.py
git commit -m "feat(crawlers): rules-based classifier with word-boundary matching"
```

---

### Task 3: LLM classification layer

**Files:**
- Modify: `crawlers/classify.py` (add LLM functions)
- Test: `crawlers/tests/test_classify_llm.py`

**Review fixes applied:**
- System prompt includes full per-category genre lists
- Markdown-fence stripping before JSON parse
- API errors and JSON parse errors handled separately
- Description truncation bumped to 800 chars
- Haiku model ID — verify against current Anthropic API docs

- [ ] **Step 1: Write tests**

```python
# crawlers/tests/test_classify_llm.py
"""Tests for LLM classification layer."""
import json
import pytest
from unittest.mock import patch
from classify import classify_llm, ClassificationResult, TAXONOMY_PROMPT_VERSION

def _mock_response(category="music", genres=None, audience="general", confidence=0.9):
    return json.dumps({
        "category": category, "genres": genres or [], "audience": audience,
        "duration": "medium", "cost_tier": "$", "skill_level": "all-levels",
        "booking_required": False, "indoor_outdoor": "indoor",
        "significance": "low", "significance_signals": [], "confidence": confidence,
    })

@patch("classify.generate_text")
def test_llm_returns_valid_classification(mock_gen):
    mock_gen.return_value = _mock_response("games", ["trivia"])
    result = classify_llm(title="Wednesday Trivia", description="Test your knowledge", venue_type="bar")
    assert result.category == "games"
    assert "trivia" in result.genres
    assert result.source == "llm"

@patch("classify.generate_text")
def test_llm_strips_invalid_genres(mock_gen):
    mock_gen.return_value = _mock_response("music", ["rock", "basketball"])
    result = classify_llm(title="Concert at State Farm Arena", description="", venue_type="arena")
    assert "basketball" not in result.genres
    assert "rock" in result.genres

@patch("classify.generate_text")
def test_llm_handles_malformed_json(mock_gen):
    mock_gen.return_value = "I'm not valid JSON {{"
    result = classify_llm(title="Some Event", description="")
    assert result.category is None
    assert result.confidence == 0.0

@patch("classify.generate_text")
def test_llm_strips_markdown_fences(mock_gen):
    mock_gen.return_value = "```json\n" + _mock_response("comedy", ["improv"]) + "\n```"
    result = classify_llm(title="Improv Show", description="", venue_type="theater")
    assert result.category == "comedy"
    assert "improv" in result.genres

@patch("classify.generate_text")
def test_llm_api_error_returns_empty(mock_gen):
    mock_gen.side_effect = Exception("API rate limited")
    result = classify_llm(title="Some Event", description="")
    assert result.category is None
    assert result.confidence == 0.0

def test_prompt_version_exists():
    assert TAXONOMY_PROMPT_VERSION is not None
    assert len(TAXONOMY_PROMPT_VERSION) > 0
```

- [ ] **Step 2: Implement LLM classification in classify.py**

Add to `crawlers/classify.py`:

```python
from llm_client import generate_text

# Build system prompt with full genre lists per category
def _build_genre_list_text() -> str:
    """Generate genre list section for the LLM prompt."""
    lines = []
    for cat, genres in sorted(GENRES_BY_CATEGORY.items()):
        # Skip legacy categories
        if cat in ("nightlife", "community", "family", "recreation", "wellness",
                   "exercise", "learning", "meetup", "gaming", "outdoor"):
            continue
        lines.append(f"  {cat}: {', '.join(sorted(genres))}")
    return "\n".join(lines)

_SYSTEM_PROMPT = f"""You are an event classifier for a city events platform.
Given an event's title, description, venue name/type, and source, classify it.

CATEGORIES (pick exactly one):
- music: Concerts, DJ sets, live bands, karaoke, listening sessions
- film: Screenings, premieres, watch parties
- comedy: Standup, improv, sketch
- theater: Plays, musicals, drag shows, burlesque, puppetry, immersive, dance performances (watching)
- art: Exhibitions, galleries, installations. NOT paint-and-sip (that's workshops)
- dance: Social dance, latin night, swing, line dancing, dance classes for fun
- sports: Spectator events, matches, races
- fitness: Gym classes, yoga, run clubs, swim lessons, Zumba — exercise intent
- outdoors: Hiking, nature walks, garden tours, paddling — activity IS being outside
- games: Trivia, bingo, board games, poker, Warhammer, esports
- food_drink: Tastings, food festivals, happy hours, pop-ups
- conventions: Expos, conferences, trade shows, fan conventions
- workshops: Pottery, paint-and-sip, blacksmithing, cooking, crafts — creative output
- education: Seminars, ESL, career development, medical lectures — intellectual output
- words: Book clubs, poetry readings, author signings, literary events, spoken word
- volunteer: Service shifts, food pantries, tree planting
- civic: Government sessions, political organizing, public meetings
- support: Recovery meetings, support groups
- religious: Worship services, faith-based gatherings

VALID GENRES PER CATEGORY (only use these slugs):
{_build_genre_list_text()}

RULES:
- Dance: doing for fun -> dance. Exercise intent (Zumba) -> fitness. Watching on stage -> theater.
- Workshops vs Education: creative/physical output -> workshops. Intellectual output -> education.
- Watch parties: categorize by subject (Drag Race -> theater, Super Bowl -> sports, movie -> film).
- Audience: "general" unless event EXPLICITLY gates by age. Bar venue alone is NOT 21+.

Return JSON with: category, genres (array), audience ("general"/"toddler"/"preschool"/"kids"/"teen"/"18+"/"21+"),
duration ("short"/"medium"/"half-day"/"full-day"/"multi-day"), cost_tier ("free"/"$"/"$$"/"$$$"),
skill_level ("beginner"/"intermediate"/"advanced"/"all-levels"), booking_required (bool),
indoor_outdoor ("indoor"/"outdoor"/"both"), significance ("low"/"medium"/"high"),
significance_signals (array: "touring","large_venue","festival","limited_run","opening","high_price","known_name","championship"),
confidence (0.0-1.0).

Respond with ONLY valid JSON. No markdown, no explanation."""


def _strip_markdown_fences(raw: str) -> str:
    """Strip markdown code fences if present."""
    raw = raw.strip()
    if raw.startswith("```"):
        # Remove opening fence (possibly with language tag)
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
    venue_type: str = None,
    venue_name: str = None,
    source_name: str = None,
) -> ClassificationResult:
    """
    Classify an event using LLM. Called when rules confidence < threshold.
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

    # Call LLM — API errors and parse errors handled separately
    try:
        raw = generate_text(
            system_prompt=_SYSTEM_PROMPT,
            user_message=user_msg,
            model_override="claude-haiku-4-5-20251001",
        )
    except Exception as e:
        logger.error("LLM API call failed for '%s': %s", title[:60], e)
        return result

    try:
        cleaned = _strip_markdown_fences(raw)
        data = json.loads(cleaned)
    except json.JSONDecodeError as e:
        logger.warning("LLM returned non-JSON for '%s': %.100s", title[:60], raw)
        return result

    # Extract fields
    result.category = data.get("category")
    result.genres = data.get("genres", [])
    result.audience = data.get("audience", "general")
    result.confidence = float(data.get("confidence", 0.5))
    result.duration = data.get("duration")
    result.cost_tier = data.get("cost_tier")
    result.skill_level = data.get("skill_level")
    result.booking_required = data.get("booking_required")
    result.indoor_outdoor = data.get("indoor_outdoor")
    result.significance = data.get("significance")
    result.significance_signals = data.get("significance_signals", [])

    # Validate: strip genres that don't belong to assigned category
    if result.category and result.genres:
        allowed = GENRES_BY_CATEGORY.get(result.category, set())
        result.genres = [g for g in result.genres if g in allowed]

    # Validate category is in the new taxonomy
    if result.category not in _VALID_NEW_CATEGORIES:
        logger.warning("LLM returned invalid category '%s' for '%s'", result.category, title[:60])
        result.category = None
        result.confidence = 0.0

    return result
```

- [ ] **Step 3: Run tests**

```bash
cd /Users/coach/Projects/LostCity/crawlers && python3 -m pytest tests/test_classify_llm.py -v
```

- [ ] **Step 4: Commit**

```bash
git add crawlers/classify.py crawlers/tests/test_classify_llm.py
git commit -m "feat(crawlers): LLM classification layer with genre validation and fence stripping"
```

---

### Task 4: Unified classify_event() orchestrator

**Files:**
- Modify: `crawlers/classify.py` (add orchestrator)
- Test: `crawlers/tests/test_classify_orchestrator.py`

**Review fix:** Source defaults checked ONLY here, not in classify_rules.

- [ ] **Step 1: Write tests**

```python
# crawlers/tests/test_classify_orchestrator.py
"""Tests for the classification orchestrator."""
import json
from unittest.mock import patch
from classify import classify_event

def test_source_default_short_circuits():
    result = classify_event(title="Neon Stiletto Paint Party", description="", source_id=554)
    assert result.category == "workshops"
    assert result.source == "source_default"
    assert result.confidence >= 0.9

def test_high_confidence_rules_skips_llm():
    with patch("classify.generate_text") as mock_llm:
        result = classify_event(title="Geek Trivia Night", description="Test your knowledge", venue_type="bar")
        assert result.category == "games"
        assert result.source == "rules"
        mock_llm.assert_not_called()

@patch("classify.generate_text")
def test_low_confidence_falls_back_to_llm(mock_llm):
    mock_llm.return_value = json.dumps({
        "category": "education", "genres": ["seminar"], "audience": "general", "confidence": 0.85,
    })
    # "Nether Hour" is ambiguous — rules won't match confidently
    result = classify_event(title="Nether Hour: an evening experience", description="", venue_type="venue")
    assert result.category is not None

def test_prompt_version_always_set():
    result = classify_event(title="Blues Night", description="Live blues", venue_type="bar")
    assert result.prompt_version == "v1.0-2026-03-27"

@patch("classify.generate_text")
def test_llm_failure_still_returns_rules_result(mock_llm):
    """If LLM fails, should still return whatever rules found."""
    mock_llm.side_effect = Exception("API down")
    result = classify_event(title="Friday Night at Venue", description="", venue_type="nightclub")
    # Rules might return something at low confidence, or nothing — either way no crash
    assert result.prompt_version is not None
```

- [ ] **Step 2: Implement orchestrator in classify.py**

Add to `crawlers/classify.py`:

```python
from source_defaults import get_source_default

def classify_event(
    title: str,
    description: str = "",
    venue_type: str = None,
    venue_name: str = None,
    source_name: str = None,
    source_id: int = None,
    source_slug: str = None,
    category_hint: str = None,
    genres_hint: list[str] = None,
) -> ClassificationResult:
    """
    Classify an event through the full pipeline:
    source defaults -> rules -> LLM fallback.
    """
    # Layer 1: Source defaults (highest confidence)
    source_default = get_source_default(
        source_id=source_id, source_name=source_name, source_slug=source_slug
    )
    if source_default:
        result = ClassificationResult(
            category=source_default["category"],
            genres=[source_default["genre"]] if "genre" in source_default else [],
            confidence=0.95,
            source="source_default",
            prompt_version=TAXONOMY_PROMPT_VERSION,
        )
        return result

    # Layer 2: Rules engine
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

    # Layer 3: LLM fallback for low-confidence results
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
```

- [ ] **Step 3: Run tests**

```bash
cd /Users/coach/Projects/LostCity/crawlers && python3 -m pytest tests/test_classify_orchestrator.py -v
```

- [ ] **Step 4: Commit**

```bash
git add crawlers/classify.py crawlers/tests/test_classify_orchestrator.py
git commit -m "feat(crawlers): classify_event() orchestrator — source defaults -> rules -> LLM"
```

---

### Task 5: Wire into INSERT_PIPELINE

**Files:**
- Modify: `crawlers/db/events.py`
- Test: `crawlers/tests/test_classify_pipeline.py`

**Review fixes applied:**
- source_id extracted from `ctx.source_info.get("id")` or `event_data.get("source_id")` — NOT `ctx.source_id`
- Column-existence guard via capability check function
- Feature flag `CLASSIFY_V2_ENABLED` env var
- audience_tags only set when non-empty
- Disagreement logging: old category vs new category
- Timing instrumentation
- Full INSERT_PIPELINE preserved (NOT truncated — keep _step_finalize and all existing steps)

- [ ] **Step 1: Write test**

```python
# crawlers/tests/test_classify_pipeline.py
"""Test that classify_v2 pipeline step populates new taxonomy columns."""
import os
from unittest.mock import patch, MagicMock
# Use sys.path if needed for db.events import
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from db.events import _step_classify_v2, InsertContext

def test_step_populates_derived_columns():
    event_data = {
        "title": "Geek Trivia Night",
        "description": "Test your knowledge at Battle & Brew",
        "category": "nightlife",
        "source_id": 42,
    }
    ctx = InsertContext(client=MagicMock(), venue_type="restaurant")
    ctx.source_info = {"id": 42, "slug": "battle-and-brew"}
    ctx.source_slug = "battle-and-brew"

    with patch.dict(os.environ, {"CLASSIFY_V2_ENABLED": "1"}):
        result = _step_classify_v2(event_data, ctx)

    assert result.get("classification_prompt_version") is not None

def test_step_preserves_old_category():
    event_data = {
        "title": "Blues Night",
        "description": "",
        "category": "music",
        "source_id": 99,
    }
    ctx = InsertContext(client=MagicMock(), venue_type="bar")
    ctx.source_info = {"id": 99}
    ctx.source_slug = "test"

    with patch.dict(os.environ, {"CLASSIFY_V2_ENABLED": "1"}):
        result = _step_classify_v2(event_data, ctx)

    assert result["category"] == "music"  # NOT overwritten

def test_step_skipped_when_flag_disabled():
    event_data = {"title": "Test", "category": "music"}
    ctx = InsertContext(client=MagicMock())

    with patch.dict(os.environ, {}, clear=True):
        os.environ.pop("CLASSIFY_V2_ENABLED", None)
        result = _step_classify_v2(event_data, ctx)

    assert "classification_prompt_version" not in result

def test_audience_tags_not_set_when_general():
    event_data = {
        "title": "Jazz Night",
        "description": "",
        "category": "music",
        "source_id": 99,
    }
    ctx = InsertContext(client=MagicMock(), venue_type="music_venue")
    ctx.source_info = {"id": 99}
    ctx.source_slug = "test"

    with patch.dict(os.environ, {"CLASSIFY_V2_ENABLED": "1"}):
        result = _step_classify_v2(event_data, ctx)

    # audience_tags should NOT be set for general audience
    assert "audience_tags" not in result or result.get("audience_tags") is None
```

- [ ] **Step 2: Add capability check function**

Add to `crawlers/db/client.py` (or wherever other `events_support_*` functions live):

```python
def events_support_taxonomy_v2_columns() -> bool:
    """Check if events table has the taxonomy v2 columns."""
    # Cache the check — only need to verify once per process
    if not hasattr(events_support_taxonomy_v2_columns, "_cached"):
        try:
            client = get_client()
            result = client.table("events").select("classification_prompt_version").limit(1).execute()
            events_support_taxonomy_v2_columns._cached = True
        except Exception:
            events_support_taxonomy_v2_columns._cached = False
    return events_support_taxonomy_v2_columns._cached
```

- [ ] **Step 3: Implement _step_classify_v2 in db/events.py**

Add after `_step_infer_tags`:

```python
def _step_classify_v2(event_data: dict, ctx: InsertContext) -> dict:
    """
    Run new hybrid classification engine (Phase 2).
    Populates derived columns WITHOUT overwriting category_id.
    Guarded by CLASSIFY_V2_ENABLED env var and column-existence check.
    """
    import time as _time

    # Feature flag — disable without a code deploy if needed
    if not os.environ.get("CLASSIFY_V2_ENABLED"):
        return event_data

    # Column-existence guard — skip if Plan 1 migration hasn't run
    if not events_support_taxonomy_v2_columns():
        return event_data

    from classify import classify_event

    # Extract source_id from ctx.source_info (NOT ctx.source_id which doesn't exist)
    source_id = None
    if ctx.source_info:
        source_id = ctx.source_info.get("id")
    if not source_id:
        source_id = event_data.get("source_id")

    title = event_data.get("title", "")
    old_category = event_data.get("category", "")

    start = _time.monotonic()
    result = classify_event(
        title=title,
        description=event_data.get("description", ""),
        venue_type=ctx.venue_type,
        source_name=ctx.source_slug,
        source_id=source_id,
        source_slug=ctx.source_slug,
        category_hint=old_category,
    )
    elapsed = _time.monotonic() - start
    if elapsed > 2.0:
        logger.info("classify_v2 took %.1fs for '%s' (source=%s)", elapsed, title[:40], result.source)

    # Log disagreements between old and new classification
    if result.category and old_category and result.category != old_category:
        logger.info("classify_v2 disagrees: old=%s new=%s title='%s'",
                    old_category, result.category, title[:60])

    # Populate derived attributes (additive — DON'T overwrite category)
    if result.duration:
        event_data["duration"] = result.duration
    if result.cost_tier:
        event_data["cost_tier"] = result.cost_tier
    if result.skill_level:
        event_data["skill_level"] = result.skill_level
    if result.booking_required is not None:
        event_data["booking_required"] = result.booking_required
    if result.indoor_outdoor:
        event_data["indoor_outdoor"] = result.indoor_outdoor
    if result.significance:
        event_data["significance"] = result.significance
    if result.significance_signals:
        event_data["significance_signals"] = result.significance_signals
    # Only set audience_tags when non-general (avoid writing empty arrays)
    if result.audience and result.audience != "general":
        event_data["audience_tags"] = [result.audience]
    event_data["classification_prompt_version"] = result.prompt_version

    return event_data
```

- [ ] **Step 4: Add to INSERT_PIPELINE**

In `db/events.py`, find the `INSERT_PIPELINE` list and add `_step_classify_v2` after `_step_infer_tags`. **Keep ALL existing steps exactly as they are.** Only insert the new step:

```python
INSERT_PIPELINE = [
    _step_normalize_category,
    _step_validate,
    _step_check_past_date,
    _step_validate_source_url,
    _step_generate_hash,
    _step_resolve_source,
    _step_resolve_venue,
    _step_normalize_image,
    _step_enrich_film,
    _step_parse_artists,
    _step_enrich_music,
    _step_infer_category,
    _step_resolve_series,
    _step_infer_genres,
    _step_set_flags,
    _step_infer_tags,
    _step_classify_v2,          # NEW — populates derived columns
    _step_infer_content_kind,
    _step_show_signals,
    _step_field_metadata,
    _step_data_quality,
]
```

**IMPORTANT:** Do NOT remove or reorder any existing steps. The `_step_finalize` (if it exists) and all other steps after `_step_data_quality` must remain. Read the actual file to see the full current pipeline before editing.

- [ ] **Step 5: Run tests**

```bash
cd /Users/coach/Projects/LostCity/crawlers && python3 -m pytest tests/test_classify_pipeline.py -v
```

- [ ] **Step 6: Run full crawler test suite**

```bash
cd /Users/coach/Projects/LostCity/crawlers && python3 -m pytest -x -q 2>&1 | tail -10
```

- [ ] **Step 7: Commit**

```bash
git add crawlers/db/events.py crawlers/db/client.py crawlers/tests/test_classify_pipeline.py
git commit -m "feat(crawlers): wire classify_v2 into INSERT_PIPELINE with feature flag and guards"
```

---

### Task 6: Run golden test set benchmark

**Files:**
- Create: `crawlers/tests/test_golden_accuracy.py`

- [ ] **Step 1: Write accuracy benchmark**

```python
# crawlers/tests/test_golden_accuracy.py
"""Benchmark rules engine accuracy against golden test set."""
import json
import os
from classify import classify_rules

GOLDEN_SET_PATH = os.path.join(os.path.dirname(__file__), "golden_classification_set.json")

def load_golden_set():
    with open(GOLDEN_SET_PATH) as f:
        return json.load(f)

def test_rules_accuracy_above_60_percent():
    """Rules engine should correctly classify at least 60% of golden events."""
    golden = load_golden_set()
    correct = 0
    errors = []
    for event in golden:
        result = classify_rules(
            title=event["title"],
            description=event.get("description", ""),
            venue_type=event.get("venue_type"),
        )
        if result.category == event["expected_category"]:
            correct += 1
        else:
            errors.append({
                "title": event["title"][:50],
                "expected": event["expected_category"],
                "got": result.category,
                "conf": result.confidence,
            })
    accuracy = correct / len(golden)
    print(f"\nRules accuracy: {correct}/{len(golden)} = {accuracy:.1%}")
    for e in errors[:15]:
        print(f"  '{e['title']}': expected={e['expected']}, got={e['got']} (conf={e['conf']:.2f})")
    assert accuracy >= 0.6, f"Rules accuracy too low: {accuracy:.1%}"

def test_no_esports_on_blazesports():
    golden = load_golden_set()
    for event in golden:
        if "blazesport" in event["title"].lower():
            result = classify_rules(
                title=event["title"],
                description=event.get("description", ""),
                venue_type=event.get("venue_type"),
            )
            assert "esports" not in result.genres, f"BlazeSports false positive: {event['title']}"

def test_audience_inference_coverage():
    """Spot-check audience inference on golden set events with known audiences."""
    golden = load_golden_set()
    audience_events = [e for e in golden if e.get("expected_audience") != "general"]
    if len(audience_events) < 5:
        return  # Not enough audience-tagged events to test
    correct = 0
    for event in audience_events:
        result = classify_rules(
            title=event["title"],
            description=event.get("description", ""),
            venue_type=event.get("venue_type"),
        )
        if result.audience == event["expected_audience"]:
            correct += 1
    accuracy = correct / len(audience_events)
    print(f"\nAudience accuracy: {correct}/{len(audience_events)} = {accuracy:.1%}")
```

- [ ] **Step 2: Run benchmark**

```bash
cd /Users/coach/Projects/LostCity/crawlers && python3 -m pytest tests/test_golden_accuracy.py -v -s
```

Review the accuracy output. Target: >60% rules accuracy. The remaining ~40% is what the LLM handles.

- [ ] **Step 3: Commit**

```bash
git add crawlers/tests/test_golden_accuracy.py
git commit -m "test: golden set accuracy benchmark — rules engine baseline"
```

---

### Task 7: End-to-end verification

- [ ] **Step 1: Run all crawler tests**

```bash
cd /Users/coach/Projects/LostCity/crawlers && python3 -m pytest -x -q
```

- [ ] **Step 2: Test dry-run with feature flag enabled**

```bash
cd /Users/coach/Projects/LostCity/crawlers && CLASSIFY_V2_ENABLED=1 python3 main.py --source laughing-skull --dry-run 2>&1 | tail -30
```

Look for: classify_v2 disagreement logs, no crashes, derived columns in output.

- [ ] **Step 3: Test dry-run with feature flag disabled (default)**

```bash
cd /Users/coach/Projects/LostCity/crawlers && python3 main.py --source laughing-skull --dry-run 2>&1 | tail -20
```

Should behave exactly like before — no classify_v2 activity.

- [ ] **Step 4: Run web TypeScript check**

```bash
cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit 2>&1 | tail -5
```

- [ ] **Step 5: Commit any fixes**

```bash
git add -A && git status
git commit -m "fix: address issues found during classification engine verification" || echo "No fixes needed"
```
