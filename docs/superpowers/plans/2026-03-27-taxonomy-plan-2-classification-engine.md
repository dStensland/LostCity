# Taxonomy Redesign Plan 2: Hybrid Classification Engine

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the regex/substring classification engine with a hybrid rules + LLM pipeline that classifies events into the new 19-category taxonomy with per-category genre scoping, audience tagging, and derived attributes.

**Architecture:** New `crawlers/classify.py` module contains the rules engine, LLM classifier, and validation layer. It plugs into the existing `INSERT_PIPELINE` in `db/events.py` as new steps that run alongside (and eventually replace) the old `_step_infer_category`, `_step_infer_genres`, and `_step_infer_tags`. The LLM layer uses the existing `llm_client.py` abstraction.

**Tech Stack:** Python, pytest, Anthropic Claude API (via existing llm_client.py)

**Spec:** `docs/superpowers/specs/2026-03-27-event-taxonomy-redesign.md`

**Depends on:** Plan 1 (schema & constants) — must be complete.

---

### Task 1: Source-level category defaults

**Files:**
- Create: `crawlers/source_defaults.py`
- Test: `crawlers/tests/test_source_defaults.py`

Source-level defaults short-circuit classification for high-volume sources where the category is deterministic. This avoids wasting LLM tokens on 651 identical Painting With a Twist events.

- [ ] **Step 1: Write test**

```python
# crawlers/tests/test_source_defaults.py
"""Tests for source-level category defaults."""
from source_defaults import get_source_default

def test_painting_with_a_twist():
    assert get_source_default(source_id=554) == {"category": "workshops"}

def test_callanwolde():
    result = get_source_default(source_id=809)
    assert result is not None
    assert result["category"] in ("workshops", "art")

def test_amc_theaters():
    """AMC sources should default to film."""
    # AMC source IDs vary — test the name-based lookup
    assert get_source_default(source_name="AMC Phipps Plaza 14") == {"category": "film"}

def test_unknown_source():
    assert get_source_default(source_id=999999) is None

def test_coder_school():
    assert get_source_default(source_id=1318) == {"category": "education", "genre": "technology"}
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
"""
from __future__ import annotations
from typing import Optional

# source_id -> {category, genre (optional)}
_SOURCE_ID_DEFAULTS: dict[int, dict] = {
    # Paint-and-sip chains → workshops
    554: {"category": "workshops"},   # Painting With a Twist
    # Arts centers → workshops (classes dominate)
    808: {"category": "workshops"},   # Spruill Center
    809: {"category": "workshops"},   # Callanwolde Fine Arts Center
    # Coding schools → education
    1318: {"category": "education", "genre": "technology"},  # theCoderSchool
}

# source_name substring -> {category}
_SOURCE_NAME_DEFAULTS: list[tuple[str, dict]] = [
    ("AMC ", {"category": "film"}),
    ("Regal ", {"category": "film"}),
]

# Recovery / support group sources
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

- [ ] **Step 1: Write tests for the rules classifier**

```python
# crawlers/tests/test_classify_rules.py
"""Tests for the rules-based classification engine."""
from classify import classify_rules, ClassificationResult

def test_cinema_venue_defaults_to_film():
    result = classify_rules(
        title="Project Hail Mary",
        description="",
        venue_type="cinema",
        source_name="AMC Phipps Plaza",
    )
    assert result.category == "film"
    assert result.confidence >= 0.8

def test_stadium_defaults_to_sports():
    result = classify_rules(
        title="Braves vs Royals",
        description="",
        venue_type="stadium",
    )
    assert result.category == "sports"
    assert "baseball" in result.genres

def test_trivia_is_games_not_nightlife():
    result = classify_rules(
        title="Geek Trivia Night",
        description="Test your knowledge",
        venue_type="bar",
    )
    assert result.category == "games"
    assert "trivia" in result.genres

def test_drag_show_is_theater():
    result = classify_rules(
        title="Friday Night Drag Show",
        description="Drag performances all night",
        venue_type="bar",
    )
    assert result.category == "theater"
    assert "drag" in result.genres

def test_dj_set_is_music():
    result = classify_rules(
        title="DJ Jen $5 Fridays",
        description="",
        venue_type="bar",
    )
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
    result = classify_rules(
        title="Bowling",
        description="Come learn about bowling techniques",
        venue_type="recreation",
    )
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
    result = classify_rules(
        title="Date Night! Blossoming Night!",
        description="Paint and sip party",
        venue_type="studio",
    )
    assert result.category == "workshops"

def test_book_club_is_words():
    result = classify_rules(
        title="Nonfiction Friday Book Club",
        description="Monthly book discussion",
        venue_type="library",
    )
    assert result.category == "words"
    assert "book-club" in result.genres

def test_yoga_is_fitness():
    result = classify_rules(
        title="Friday Morning Yoga",
        description="All levels vinyasa flow",
        venue_type="studio",
    )
    assert result.category == "fitness"
    assert "yoga" in result.genres

def test_hiking_is_outdoors():
    result = classify_rules(
        title="Eagle Mountain to Sassafras Knob",
        description="A moderate 6-mile hike through the mountains",
        venue_type="park",
    )
    assert result.category == "outdoors"
    assert "hiking" in result.genres

def test_low_confidence_returns_none():
    """Ambiguous events should return low confidence for LLM fallback."""
    result = classify_rules(
        title="Friday Night at Ten Atlanta",
        description="",
        venue_type="nightclub",
    )
    # Could be music or dance — rules layer should be uncertain
    assert result.confidence < 0.7 or result.category in ("music", "dance")

def test_volunteer_detected():
    result = classify_rules(
        title="Food Pantry - Product Sorter",
        description="Help sort donated food items",
        venue_type="organization",
    )
    assert result.category == "volunteer"

def test_civic_detected():
    result = classify_rules(
        title="Senate: Floor Session (LD 38)",
        description="",
        venue_type="government",
    )
    assert result.category == "civic"

def test_recovery_meeting_is_support():
    result = classify_rules(
        title="Gratitude Group",
        description="Open AA meeting",
        venue_type="church",
    )
    assert result.category == "support"
    assert "recovery" in result.genres
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/coach/Projects/LostCity/crawlers && python3 -m pytest tests/test_classify_rules.py -v
```

- [ ] **Step 3: Implement classify.py — rules layer**

Create `crawlers/classify.py` with the following structure:

```python
# crawlers/classify.py
"""
Hybrid classification engine for the new 19-category taxonomy.
Three layers: source defaults → rules → LLM fallback.
"""
from __future__ import annotations

import re
import logging
from dataclasses import dataclass, field
from typing import Optional

from genre_normalize import GENRES_BY_CATEGORY, normalize_genre
from source_defaults import get_source_default

logger = logging.getLogger(__name__)

CONFIDENCE_THRESHOLD = 0.7  # Below this → LLM fallback


@dataclass
class ClassificationResult:
    """Output of the classification pipeline."""
    category: Optional[str] = None
    genres: list[str] = field(default_factory=list)
    audience: str = "general"
    confidence: float = 0.0
    source: str = "none"  # "source_default", "rules", "llm"
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


def _any_word_match(text: str, keywords: list[str]) -> bool:
    """Return True if any keyword matches with word boundaries."""
    return any(_word_match(text, kw) for kw in keywords)


# --- Venue type → category hints ---
_VENUE_CATEGORY_HINTS: dict[str, tuple[str, float]] = {
    "cinema": ("film", 0.95),
    "stadium": ("sports", 0.8),
    "arena": ("sports", 0.7),
    "comedy_club": ("comedy", 0.9),
    "theater": ("theater", 0.7),
    "church": ("religious", 0.5),  # Low — churches host many non-religious events
    "government": ("civic", 0.9),
    "dance_studio": ("dance", 0.7),
}

# --- Title keyword patterns ---
# Each tuple: (keywords, category, genres, confidence)
_TITLE_PATTERNS: list[tuple[list[str], str, list[str], float]] = [
    # Games
    (["trivia night", "trivia at", "pub quiz", "quiz night"], "games", ["trivia"], 0.9),
    (["bingo night", "bingo at", "drag bingo"], "games", ["bingo"], 0.9),
    (["board game", "game night", "poker night"], "games", ["board-games"], 0.85),
    (["warhammer", "40k", "magic the gathering", "mtg "], "games", ["warhammer"], 0.9),
    (["d&d", "dungeons", "pathfinder"], "games", ["dnd"], 0.9),
    # Theater / Performance
    (["drag show", "drag night", "drag brunch", "drag race viewing"], "theater", ["drag"], 0.9),
    (["burlesque"], "theater", ["burlesque"], 0.9),
    (["puppet", "puppetry", "marionette"], "theater", ["puppet"], 0.9),
    # Music
    (["dj set", "dj night", "dj "], "music", ["dj"], 0.8),
    (["karaoke"], "music", ["karaoke"], 0.9),
    (["live music", "live band", "concert", "live jazz", "live blues"], "music", [], 0.85),
    (["open mic"], "music", ["open-mic"], 0.8),
    # Dance
    (["salsa night", "bachata night", "latin night", "swing night"], "dance", ["salsa"], 0.9),
    (["line dancing", "line dance"], "dance", ["line-dancing"], 0.9),
    (["dance party", "dance night"], "dance", [], 0.75),
    # Fitness
    (["yoga class", "yoga at", "yoga in", "morning yoga", "friday yoga"], "fitness", ["yoga"], 0.9),
    (["run club", "running club", "fun run"], "fitness", ["running"], 0.9),
    (["crossfit", "hiit", "boot camp", "bootcamp"], "fitness", ["crossfit"], 0.85),
    (["zumba", "dance cardio", "dance fitness"], "fitness", ["dance-fitness"], 0.9),
    (["swim lesson", "swim class", "water aerobics", "aqua "], "fitness", ["swimming"], 0.85),
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
    # Outdoors
    (["hike to", "hiking", "nature walk", "trail run"], "outdoors", ["hiking"], 0.85),
    (["kayak", "paddle", "canoe"], "outdoors", ["paddling"], 0.85),
    (["bird walk", "birding"], "outdoors", ["birding"], 0.9),
    # Volunteer
    (["food pantry", "food bank", "food distribution"], "volunteer", ["food-bank"], 0.95),
    (["tree planting", "park cleanup", "trail maintenance"], "volunteer", ["cleanup"], 0.9),
    (["meal delivery", "meal packing", "meal prep"], "volunteer", ["meal-delivery"], 0.9),
    # Civic
    (["town hall", "public comment", "public hearing"], "civic", ["town-hall"], 0.9),
    (["floor session", "committee meeting", "commission"], "civic", ["legislation"], 0.85),
    (["voter registration", "voter reg"], "civic", ["voter-registration"], 0.9),
    # Support
    (["aa meeting", "na meeting", "al-anon", "recovery meeting"], "support", ["recovery"], 0.95),
    (["grief support", "grief group", "bereavement"], "support", ["grief"], 0.9),
    # Conventions
    (["comic con", "comicon", "dragon con", "dragoncon"], "conventions", ["fan"], 0.95),
    (["expo ", " expo", "trade show", "conference"], "conventions", [], 0.7),
    # Food & Drink
    (["happy hour", "oyster hour"], "food_drink", ["happy-hour"], 0.85),
    (["food festival", "taste of", "restaurant week"], "food_drink", ["food-festival"], 0.9),
    (["wine tasting", "beer tasting", "cocktail class"], "food_drink", ["tasting"], 0.85),
    # Religious
    (["worship service", "sunday service", "bible study", "prayer meeting"], "religious", ["worship"], 0.9),
    # Education
    (["seminar", "grand rounds", "symposium"], "education", ["seminar"], 0.75),
    (["esl class", "english as a second"], "education", ["language"], 0.9),
]


def classify_rules(
    title: str,
    description: str,
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
    """
    result = ClassificationResult(source="rules")
    title_lower = title.lower() if title else ""
    desc_lower = description.lower() if description else ""

    # --- Source-level defaults (highest confidence) ---
    source_default = get_source_default(
        source_id=source_id, source_name=source_name, source_slug=source_slug
    )
    if source_default:
        result.category = source_default["category"]
        if "genre" in source_default:
            result.genres.append(source_default["genre"])
        result.confidence = 0.95
        result.source = "source_default"
        return result

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

    # --- Venue type hints (only if title patterns didn't match) ---
    if not result.category and venue_type and venue_type in _VENUE_CATEGORY_HINTS:
        cat, conf = _VENUE_CATEGORY_HINTS[venue_type]
        result.category = cat
        result.confidence = conf

    # --- Category hint from crawler (lowest priority) ---
    if not result.category and category_hint:
        result.category = category_hint
        result.confidence = 0.5

    # --- Genre inference (title-only for music, prevents bio contamination) ---
    if result.category == "music":
        _infer_music_genres_title_only(title_lower, result)
    elif result.category:
        _infer_genres_for_category(title_lower, desc_lower, result)

    # --- Validate genres belong to category ---
    if result.category and result.genres:
        allowed = GENRES_BY_CATEGORY.get(result.category, set())
        result.genres = [g for g in result.genres if g in allowed]

    return result


def _infer_music_genres_title_only(title: str, result: ClassificationResult):
    """Infer music genres from TITLE ONLY — not description (which may contain artist bios)."""
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
        (["dj ", "dj set"], "dj"),
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

Iterate until all pass. The key tests are word-boundary (esports/bout) and title-only music genre inference.

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

The LLM layer handles events where rules confidence is below the threshold. Uses existing `llm_client.generate_text()`.

- [ ] **Step 1: Write tests**

```python
# crawlers/tests/test_classify_llm.py
"""Tests for LLM classification layer."""
import json
import pytest
from unittest.mock import patch
from classify import classify_llm, ClassificationResult, TAXONOMY_PROMPT_VERSION

def _mock_llm_response(category="music", genres=None, audience="general", confidence=0.9):
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
def test_llm_returns_valid_classification(mock_gen):
    mock_gen.return_value = _mock_llm_response("games", ["trivia"])
    result = classify_llm(
        title="Wednesday Trivia",
        description="Test your knowledge at the pub",
        venue_type="bar",
    )
    assert result.category == "games"
    assert "trivia" in result.genres
    assert result.source == "llm"
    assert result.confidence >= 0.7

@patch("classify.generate_text")
def test_llm_strips_invalid_genres(mock_gen):
    """LLM returns basketball genre for a music event — should be stripped."""
    mock_gen.return_value = _mock_llm_response("music", ["rock", "basketball"])
    result = classify_llm(
        title="Concert at State Farm Arena",
        description="",
        venue_type="arena",
    )
    assert result.category == "music"
    assert "basketball" not in result.genres
    assert "rock" in result.genres

@patch("classify.generate_text")
def test_llm_handles_malformed_json(mock_gen):
    mock_gen.return_value = "I'm not valid JSON {{"
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
import json
from llm_client import generate_text

TAXONOMY_PROMPT_VERSION = "v1.0-2026-03-27"

_SYSTEM_PROMPT = """You are an event classifier for a city events platform.
Given an event's title, description, venue name/type, and source, classify it into exactly one of these 19 categories:

PERFORMANCE & ENTERTAINMENT:
- music: Concerts, DJ sets, live bands, karaoke, listening sessions
- film: Screenings, premieres, watch parties
- comedy: Standup, improv, sketch
- theater: Plays, musicals, drag shows, burlesque, puppetry, immersive, dance performances (watching)
- art: Exhibitions, galleries, installations. NOT paint-and-sip (that's workshops)
- dance: Social dance, latin night, swing, line dancing, dance classes for fun

ACTIVE & OUTDOORS:
- sports: Spectator events, matches, races
- fitness: Gym classes, yoga, run clubs, swim lessons, Zumba — exercise intent
- outdoors: Hiking, nature walks, garden tours, paddling — activity IS being outside
- games: Trivia, bingo, board games, poker, Warhammer, esports

FOOD & SOCIAL:
- food_drink: Tastings, food festivals, happy hours, pop-ups
- conventions: Expos, conferences, trade shows, fan conventions

LEARNING & MAKING:
- workshops: Pottery, paint-and-sip, blacksmithing, cooking, crafts — make/do something (creative output)
- education: Seminars, ESL, career development, medical lectures — learn something (intellectual output)
- words: Book clubs, poetry readings, author signings, literary events, spoken word

CIVIC & SERVICE:
- volunteer: Service shifts, food pantries, tree planting
- civic: Government sessions, political organizing, public meetings
- support: Recovery meetings, support groups
- religious: Worship services, faith-based gatherings

RULES:
- Dance: doing it for fun → dance. Exercise intent (Zumba) → fitness. Watching on stage → theater.
- Workshops vs Education: creative/physical output → workshops. Intellectual output → education.
- Watch parties: categorize by subject (Drag Race → theater, Super Bowl → sports, movie → film)

Also provide:
- genres: array of genre slugs specific to the category
- audience: "general", "toddler", "preschool", "kids", "teen", "18+", or "21+" (only if event explicitly gates by age, NOT just because venue is a bar)
- duration: "short" (<1hr), "medium" (1-3hr), "half-day", "full-day", "multi-day"
- cost_tier: "free", "$", "$$", "$$$"
- skill_level: "beginner", "intermediate", "advanced", "all-levels"
- booking_required: true/false
- indoor_outdoor: "indoor", "outdoor", "both"
- significance: "low", "medium", "high"
- significance_signals: array of applicable signals: "touring", "large_venue", "festival", "limited_run", "opening", "high_price", "known_name", "championship"
- confidence: 0.0-1.0

Respond with ONLY valid JSON, no markdown or explanation."""


def classify_llm(
    title: str,
    description: str,
    venue_type: str = None,
    venue_name: str = None,
    source_name: str = None,
) -> ClassificationResult:
    """
    Classify an event using LLM. Called when rules confidence < threshold.
    Uses existing llm_client.generate_text() abstraction.
    """
    result = ClassificationResult(source="llm")

    user_msg = f"Title: {title}\n"
    if description:
        # Truncate description to avoid token waste — 500 chars is enough for classification
        user_msg += f"Description: {description[:500]}\n"
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
            model_override="claude-haiku-4-5-20251001",  # Fast + cheap for classification
        )
        data = json.loads(raw.strip())
    except (json.JSONDecodeError, Exception) as e:
        logger.warning("LLM classification failed for '%s': %s", title[:60], e)
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

    # Validate: strip genres that don't belong to the assigned category
    if result.category and result.genres:
        allowed = GENRES_BY_CATEGORY.get(result.category, set())
        stripped = [g for g in result.genres if g not in allowed]
        if stripped:
            logger.debug("Stripped cross-category genres %s from %s event '%s'",
                        stripped, result.category, title[:40])
        result.genres = [g for g in result.genres if g in allowed]

    # Validate category is in the new taxonomy
    valid_cats = {
        "music", "film", "comedy", "theater", "art", "dance",
        "sports", "fitness", "outdoors", "games",
        "food_drink", "conventions",
        "workshops", "education", "words",
        "volunteer", "civic", "support", "religious",
    }
    if result.category not in valid_cats:
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
git commit -m "feat(crawlers): LLM classification layer with validation"
```

---

### Task 4: Unified classify_event() orchestrator

**Files:**
- Modify: `crawlers/classify.py` (add orchestrator)
- Test: `crawlers/tests/test_classify_orchestrator.py`

The orchestrator ties together source defaults → rules → LLM fallback into a single `classify_event()` function.

- [ ] **Step 1: Write tests**

```python
# crawlers/tests/test_classify_orchestrator.py
"""Tests for the classification orchestrator."""
from unittest.mock import patch
from classify import classify_event, ClassificationResult

def test_source_default_short_circuits():
    """Known source should skip rules and LLM entirely."""
    result = classify_event(
        title="Neon Stiletto Paint Party",
        description="",
        source_id=554,  # Painting With a Twist
    )
    assert result.category == "workshops"
    assert result.source == "source_default"
    assert result.confidence >= 0.9

def test_high_confidence_rules_skips_llm():
    """Clear trivia event should be classified by rules, no LLM call."""
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
def test_low_confidence_falls_back_to_llm(mock_llm):
    """Ambiguous event should trigger LLM."""
    import json
    mock_llm.return_value = json.dumps({
        "category": "music",
        "genres": ["electronic"],
        "audience": "general",
        "confidence": 0.85,
    })
    result = classify_event(
        title="Nether Hour",
        description="An evening experience",
        venue_type="venue",
    )
    # Either rules or LLM should have classified it
    assert result.category is not None

def test_prompt_version_set():
    result = classify_event(
        title="Blues Night",
        description="Live blues",
        venue_type="bar",
    )
    assert result.prompt_version is not None
```

- [ ] **Step 2: Implement orchestrator in classify.py**

Add to `crawlers/classify.py`:

```python
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
    source defaults → rules → LLM fallback.

    Returns ClassificationResult with category, genres, audience, derived attributes.
    """
    # Layer 1: Source defaults (highest confidence, no further processing needed)
    source_default = get_source_default(
        source_id=source_id, source_name=source_name, source_slug=source_slug
    )
    if source_default:
        result = ClassificationResult(
            category=source_default["category"],
            genres=[source_default["genre"]] if "genre" in source_default else [],
            confidence=0.95,
            source="source_default",
        )
        result.prompt_version = TAXONOMY_PROMPT_VERSION
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
        llm_result = classify_llm(
            title=title,
            description=description,
            venue_type=venue_type,
            venue_name=venue_name,
            source_name=source_name,
        )
        if llm_result.category and llm_result.confidence > result.confidence:
            result = llm_result

    result.prompt_version = TAXONOMY_PROMPT_VERSION
    return result
```

Also add `prompt_version` to the `ClassificationResult` dataclass:

```python
    prompt_version: Optional[str] = None
```

- [ ] **Step 3: Run tests**

```bash
cd /Users/coach/Projects/LostCity/crawlers && python3 -m pytest tests/test_classify_orchestrator.py -v
```

- [ ] **Step 4: Commit**

```bash
git add crawlers/classify.py crawlers/tests/test_classify_orchestrator.py
git commit -m "feat(crawlers): classify_event() orchestrator — source defaults → rules → LLM"
```

---

### Task 5: Wire into INSERT_PIPELINE

**Files:**
- Modify: `crawlers/db/events.py` (add new pipeline step)
- Test: `crawlers/tests/test_classify_pipeline.py`

Add a new `_step_classify_v2` step to the INSERT_PIPELINE that runs `classify_event()` and writes the new columns. It runs alongside the existing steps during the dual-write phase.

- [ ] **Step 1: Write test**

```python
# crawlers/tests/test_classify_pipeline.py
"""Test that classify_v2 pipeline step populates new taxonomy columns."""
from unittest.mock import patch, MagicMock
from db.events import _step_classify_v2, InsertContext

def test_step_populates_new_columns():
    event_data = {
        "title": "Geek Trivia Night",
        "description": "Test your knowledge at Battle & Brew",
        "category": "nightlife",
    }
    ctx = InsertContext(
        client=MagicMock(),
        venue_type="restaurant",
    )
    result = _step_classify_v2(event_data, ctx)
    # Should have new taxonomy fields
    assert result.get("audience_tags") is not None
    assert result.get("classification_prompt_version") is not None

def test_step_preserves_old_category():
    """During dual-write, old category_id should NOT be overwritten."""
    event_data = {
        "title": "Blues Night",
        "description": "",
        "category": "music",
    }
    ctx = InsertContext(
        client=MagicMock(),
        venue_type="bar",
    )
    result = _step_classify_v2(event_data, ctx)
    # Old category preserved (reclassification is Phase 3)
    assert result["category"] == "music"
```

- [ ] **Step 2: Implement _step_classify_v2 in db/events.py**

Add after the existing `_step_infer_tags` function:

```python
def _step_classify_v2(event_data: dict, ctx: InsertContext) -> dict:
    """
    Run the new hybrid classification engine (Phase 2).
    Populates derived columns WITHOUT overwriting category_id yet.
    Category reclassification happens in Phase 3 backfill.
    """
    from classify import classify_event

    result = classify_event(
        title=event_data.get("title", ""),
        description=event_data.get("description", ""),
        venue_type=ctx.venue_type,
        venue_name=None,  # Could fetch from venue if needed
        source_name=ctx.source_slug,
        source_id=ctx.source_id if hasattr(ctx, "source_id") else None,
        source_slug=ctx.source_slug,
        category_hint=event_data.get("category"),
    )

    # Populate derived attributes (additive — don't overwrite category yet)
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
    if result.audience and result.audience != "general":
        event_data["audience_tags"] = [result.audience]
    else:
        event_data["audience_tags"] = []
    event_data["classification_prompt_version"] = result.prompt_version

    # Store derived_attributes JSONB
    derived = {}
    if hasattr(result, "social_format") and result.social_format:
        derived["social_format"] = result.social_format
    if derived:
        event_data["derived_attributes"] = derived

    return event_data
```

Add `_step_classify_v2` to `INSERT_PIPELINE` — insert it AFTER `_step_infer_tags`:

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
    _step_classify_v2,       # NEW — populates derived columns
    _step_infer_content_kind,
    _step_show_signals,
    _step_field_metadata,
    _step_data_quality,
]
```

- [ ] **Step 3: Run tests**

```bash
cd /Users/coach/Projects/LostCity/crawlers && python3 -m pytest tests/test_classify_pipeline.py -v
```

- [ ] **Step 4: Run full crawler test suite to ensure no breakage**

```bash
cd /Users/coach/Projects/LostCity/crawlers && python3 -m pytest -x -q 2>&1 | tail -10
```

- [ ] **Step 5: Commit**

```bash
git add crawlers/db/events.py crawlers/tests/test_classify_pipeline.py
git commit -m "feat(crawlers): wire classify_v2 into INSERT_PIPELINE"
```

---

### Task 6: Run golden test set benchmark

**Files:**
- Create: `crawlers/tests/test_golden_accuracy.py`

Run the rules engine against the golden test set and measure accuracy. This is the benchmark that tells us how well the rules layer performs before LLM fallback.

- [ ] **Step 1: Write accuracy benchmark test**

```python
# crawlers/tests/test_golden_accuracy.py
"""Benchmark rules engine accuracy against golden test set."""
import json
import os
import pytest
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
            description="",  # Rules use title primarily
            venue_type=event.get("venue_type"),
        )
        if result.category == event["expected_category"]:
            correct += 1
        else:
            errors.append({
                "title": event["title"],
                "expected": event["expected_category"],
                "got": result.category,
                "confidence": result.confidence,
            })

    accuracy = correct / len(golden)
    print(f"\nRules accuracy: {correct}/{len(golden)} = {accuracy:.1%}")
    print(f"Top misclassifications:")
    for e in errors[:10]:
        print(f"  '{e['title'][:50]}': expected={e['expected']}, got={e['got']} (conf={e['confidence']:.2f})")

    assert accuracy >= 0.6, f"Rules accuracy too low: {accuracy:.1%}"

def test_no_known_bugs():
    """Verify the specific bugs from the data audit are fixed."""
    golden = load_golden_set()

    for event in golden:
        result = classify_rules(
            title=event["title"],
            description=event.get("description", ""),
            venue_type=event.get("venue_type"),
        )
        # BlazeSports events should never have esports genre
        if "blazesport" in event["title"].lower():
            assert "esports" not in result.genres, f"BlazeSports false positive: {event['title']}"
```

- [ ] **Step 2: Run benchmark**

```bash
cd /Users/coach/Projects/LostCity/crawlers && python3 -m pytest tests/test_golden_accuracy.py -v -s
```

Review the accuracy output. The rules layer won't hit 100% — that's what the LLM fallback is for. But it should handle the clear cases (>60%).

- [ ] **Step 3: Commit**

```bash
git add crawlers/tests/test_golden_accuracy.py
git commit -m "test: golden set accuracy benchmark — rules engine baseline"
```

---

### Task 7: Verify full pipeline end-to-end

- [ ] **Step 1: Run all crawler tests**

```bash
cd /Users/coach/Projects/LostCity/crawlers && python3 -m pytest -x -q
```

Expected: All tests pass.

- [ ] **Step 2: Test a real crawl in dry-run mode**

```bash
cd /Users/coach/Projects/LostCity/crawlers && python3 main.py --source laughing-skull --dry-run 2>&1 | tail -20
```

Expected: Crawl completes without errors. New derived columns should appear in log output.

- [ ] **Step 3: Run web TypeScript check**

```bash
cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit 2>&1 | tail -5
```

Expected: Clean build.

- [ ] **Step 4: Commit any fixes**

```bash
git add -A && git status
git commit -m "fix: address issues found during classification engine verification" || echo "No fixes needed"
```
