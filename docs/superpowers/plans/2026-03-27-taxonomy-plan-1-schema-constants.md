# Taxonomy Redesign Plan 1: Schema & Constants Foundation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add new taxonomy categories, derived attribute columns, and updated constants alongside existing ones — zero breaking changes.

**Architecture:** Phase 1 of a 3-plan migration. Adds new categories to DB, updates all constant files (crawler + web) to recognize new categories, preserves all old values. Nothing is removed or reclassified yet. The system accepts both old and new category values.

**Tech Stack:** PostgreSQL (Supabase), Python (crawlers), TypeScript (Next.js web)

**Spec:** `docs/superpowers/specs/2026-03-27-event-taxonomy-redesign.md`

---

### Task 1: Database migration — new categories + derived attribute columns

**Files:**
- Create: `database/migrations/598_taxonomy_redesign_phase1.sql`
- Create: `supabase/migrations/20260327200000_taxonomy_redesign_phase1.sql`

- [ ] **Step 1: Generate migration pair**

```bash
cd /Users/coach/Projects/LostCity
python3 database/create_migration_pair.py taxonomy_redesign_phase1
```

If the script isn't available, manually create both files with the same content.

- [ ] **Step 2: Write the migration SQL**

Write the following to both migration files:

```sql
-- Taxonomy Redesign Phase 1: Expand schema (additive only, nothing removed)
-- Adds new category values, legacy_category_id for rollback, derived attribute columns.

-- 1. Add new category rows (categories table uses id as PK text)
INSERT INTO categories (id, name, display_order, icon, color)
VALUES
  ('games', 'Games', 21, 'game-controller', '#4ADE80'),
  ('workshops', 'Workshops', 22, 'paint-brush', '#FBBF24'),
  ('education', 'Education', 23, 'graduation-cap', '#60A5FA'),
  ('conventions', 'Conventions', 24, 'buildings', '#38BDF8'),
  ('support', 'Support', 25, 'heart', '#F9A8D4'),
  ('fitness', 'Fitness', 26, 'barbell', '#5EEAD4')
ON CONFLICT (id) DO NOTHING;

-- 2. Add legacy_category_id for rollback capability
ALTER TABLE events ADD COLUMN IF NOT EXISTS legacy_category_id TEXT;

-- 3. Add derived attribute columns (high-value = first-class)
ALTER TABLE events ADD COLUMN IF NOT EXISTS duration TEXT
  CHECK (duration IN ('short', 'medium', 'half-day', 'full-day', 'multi-day'));
ALTER TABLE events ADD COLUMN IF NOT EXISTS cost_tier TEXT
  CHECK (cost_tier IN ('free', '$', '$$', '$$$'));
ALTER TABLE events ADD COLUMN IF NOT EXISTS skill_level TEXT
  CHECK (skill_level IN ('beginner', 'intermediate', 'advanced', 'all-levels'));
ALTER TABLE events ADD COLUMN IF NOT EXISTS booking_required BOOLEAN;
ALTER TABLE events ADD COLUMN IF NOT EXISTS indoor_outdoor TEXT
  CHECK (indoor_outdoor IN ('indoor', 'outdoor', 'both'));

-- 4. Add JSONB column for medium-value derived attributes
ALTER TABLE events ADD COLUMN IF NOT EXISTS derived_attributes JSONB DEFAULT '{}';

-- 5. Add significance columns
ALTER TABLE events ADD COLUMN IF NOT EXISTS significance TEXT
  CHECK (significance IN ('low', 'medium', 'high'));
ALTER TABLE events ADD COLUMN IF NOT EXISTS significance_signals TEXT[] DEFAULT '{}';

-- 6. Add classification prompt version for auditability
ALTER TABLE events ADD COLUMN IF NOT EXISTS classification_prompt_version TEXT;

-- 7. Add audience_explicit column to distinguish event-explicit vs venue-inferred age gating
ALTER TABLE events ADD COLUMN IF NOT EXISTS audience_tags TEXT[] DEFAULT '{}';
COMMENT ON COLUMN events.audience_tags IS 'Explicit audience tags (toddler, preschool, kids, teen, 18+, 21+). Only event-explicit 21+ gates from anonymous feed; venue-inferred is soft label only.';

-- 8. Update feed_events_ready to include new columns (will be populated by Phase 3 refresh)
ALTER TABLE feed_events_ready ADD COLUMN IF NOT EXISTS duration TEXT;
ALTER TABLE feed_events_ready ADD COLUMN IF NOT EXISTS cost_tier TEXT;
ALTER TABLE feed_events_ready ADD COLUMN IF NOT EXISTS significance TEXT;
ALTER TABLE feed_events_ready ADD COLUMN IF NOT EXISTS audience_tags TEXT[] DEFAULT '{}';
```

- [ ] **Step 3: Verify migration applies locally**

```bash
cd /Users/coach/Projects/LostCity
PGPASSWORD=Qf0g44tG84fAdpo7 psql -h db.rtppvljfrkjtoxmaizea.supabase.co -p 5432 -U postgres -d postgres -f database/migrations/598_taxonomy_redesign_phase1.sql
```

Expected: No errors. Verify with:
```bash
PGPASSWORD=Qf0g44tG84fAdpo7 psql -h db.rtppvljfrkjtoxmaizea.supabase.co -p 5432 -U postgres -d postgres -c "\d events" | grep -E "legacy_category|duration|cost_tier|skill_level|booking_required|indoor_outdoor|derived_attributes|significance|audience_tags|classification_prompt"
```

Expected: All new columns visible.

- [ ] **Step 4: Commit**

```bash
git add database/migrations/598_taxonomy_redesign_phase1.sql supabase/migrations/20260327200000_taxonomy_redesign_phase1.sql
git commit -m "migration: taxonomy redesign phase 1 — new categories + derived columns"
```

---

### Task 2: Update crawler VALID_CATEGORIES

**Files:**
- Modify: `crawlers/tags.py` (lines 291-316)

- [ ] **Step 1: Write test for new categories**

Create `crawlers/tests/test_taxonomy_constants.py`:

```python
"""Tests for taxonomy constants alignment between old and new categories."""
from tags import VALID_CATEGORIES

def test_new_categories_present():
    """All 19 new taxonomy categories must be in VALID_CATEGORIES."""
    new_cats = {
        "music", "film", "comedy", "theater", "art", "dance",
        "sports", "fitness", "outdoors", "games",
        "food_drink", "conventions",
        "workshops", "education", "words",
        "volunteer", "civic", "support", "religious",
    }
    for cat in new_cats:
        assert cat in VALID_CATEGORIES, f"Missing new category: {cat}"

def test_old_categories_still_present():
    """Old categories must remain during dual-write phase."""
    old_cats = {
        "nightlife", "community", "family", "recreation",
        "wellness", "exercise", "learning", "support_group", "other",
    }
    for cat in old_cats:
        assert cat in VALID_CATEGORIES, f"Old category prematurely removed: {cat}"
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/coach/Projects/LostCity/crawlers && python -m pytest tests/test_taxonomy_constants.py -v
```

Expected: FAIL — `games`, `workshops`, `education`, `conventions`, `support` missing.

- [ ] **Step 3: Update VALID_CATEGORIES in tags.py**

Replace the `VALID_CATEGORIES` set in `crawlers/tags.py` (lines 291-316):

```python
# Canonical valid categories (new taxonomy + legacy during migration)
VALID_CATEGORIES = {
    # === New taxonomy (19 categories) ===
    "music",
    "film",
    "comedy",
    "theater",
    "art",
    "dance",
    "sports",
    "fitness",
    "outdoors",
    "games",
    "food_drink",
    "conventions",
    "workshops",
    "education",
    "words",
    "volunteer",
    "civic",
    "support",
    "religious",
    # === Legacy (kept during dual-write migration, removed in Phase 5) ===
    "nightlife",
    "community",
    "family",
    "recreation",
    "wellness",
    "exercise",
    "learning",
    "support_group",
    "other",
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /Users/coach/Projects/LostCity/crawlers && python -m pytest tests/test_taxonomy_constants.py -v
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add crawlers/tags.py crawlers/tests/test_taxonomy_constants.py
git commit -m "feat(crawlers): add new taxonomy categories to VALID_CATEGORIES"
```

---

### Task 3: Update crawler genre sets for new categories

**Files:**
- Modify: `crawlers/genre_normalize.py` (lines 25-173)

- [ ] **Step 1: Write test for new genre sets**

Add to `crawlers/tests/test_taxonomy_constants.py`:

```python
from genre_normalize import GENRES_BY_CATEGORY, VALID_GENRES

def test_new_genre_sets_exist():
    """New categories must have genre sets in GENRES_BY_CATEGORY."""
    new_cats_with_genres = [
        "games", "workshops", "education", "conventions",
        "support", "fitness", "words", "religious",
    ]
    for cat in new_cats_with_genres:
        assert cat in GENRES_BY_CATEGORY, f"Missing genre set for: {cat}"
        assert len(GENRES_BY_CATEGORY[cat]) > 0, f"Empty genre set for: {cat}"

def test_karaoke_and_dj_in_music():
    """karaoke and dj must be valid music genres (were missing from spec)."""
    music = GENRES_BY_CATEGORY.get("music", set())
    assert "karaoke" in music, "karaoke missing from music genres"
    assert "dj" in music, "dj missing from music genres"

def test_volleyball_in_sports():
    """volleyball must be in sports genres (was missing)."""
    sports = GENRES_BY_CATEGORY.get("sports", set())
    assert "volleyball" in sports, "volleyball missing from sports genres"

def test_all_genre_sets_are_subsets_of_valid():
    """Every genre in a category set must be in VALID_GENRES."""
    for cat, genres in GENRES_BY_CATEGORY.items():
        for g in genres:
            assert g in VALID_GENRES, f"Genre '{g}' in {cat} not in VALID_GENRES"
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/coach/Projects/LostCity/crawlers && python -m pytest tests/test_taxonomy_constants.py -v
```

Expected: FAIL — missing genre sets for new categories, karaoke/dj not in music.

- [ ] **Step 3: Add new genre sets and update existing ones**

In `crawlers/genre_normalize.py`, add these new genre sets after the existing ones (before `VALID_GENRES`), and update existing sets:

Add `"karaoke", "dj", "vinyl", "listening-party"` to `MUSIC_GENRES`.

Add `"volleyball"` to `SPORTS_GENRES` (it's currently only in `RECREATION_GENRES`).

Add `"salsa", "bachata", "line-dancing", "tap", "modern", "jazz"` to `DANCE_GENRES`.

Add new sets:

```python
GAMES_GENRES = {
    "trivia", "bingo", "board-games", "poker", "dnd", "warhammer",
    "bar-games", "escape-room", "esports", "card-games", "pub-quiz",
    "game-night",
}

WORKSHOPS_GENRES = {
    "pottery", "painting", "blacksmithing", "woodworking", "jewelry",
    "textiles", "glassblowing", "printmaking", "floral", "candle-making",
    "resin", "crafts",
}

EDUCATION_GENRES = {
    "seminar", "lecture", "certification", "language", "career",
    "medical", "technology", "financial", "science",
}

CONVENTIONS_GENRES = {
    "fan", "tech", "professional", "trade", "hobby", "academic",
    "convention",
}

SUPPORT_GENRES = {
    "recovery", "grief", "caregiver", "chronic-illness", "mental-health",
    "peer-support", "meditation",
}

FITNESS_NEW_GENRES = {
    "yoga", "running", "cycling", "swimming", "crossfit", "pilates",
    "climbing", "martial-arts", "gymnastics", "barre", "hiit",
    "dance-fitness", "aerial", "run",
}

WORDS_NEW_GENRES = {
    "book-club", "reading", "signing", "poetry", "zine",
    "literary-festival", "storytime", "spoken-word",
}

RELIGIOUS_GENRES = {
    "worship", "prayer", "bible-study", "interfaith", "revival",
    "choir", "ministry",
}
```

Update `GENRES_BY_CATEGORY` to include new mappings:

```python
GENRES_BY_CATEGORY: dict[str, set[str]] = {
    # New taxonomy
    "music": MUSIC_GENRES,
    "film": FILM_GENRES,
    "comedy": COMEDY_GENRES,
    "theater": THEATER_GENRES,
    "dance": DANCE_GENRES,
    "sports": SPORTS_GENRES,
    "fitness": FITNESS_NEW_GENRES,
    "outdoors": OUTDOOR_GENRES,
    "games": GAMES_GENRES,
    "food_drink": FOOD_DRINK_GENRES,
    "conventions": CONVENTIONS_GENRES,
    "workshops": WORKSHOPS_GENRES,
    "education": EDUCATION_GENRES,
    "words": WORDS_NEW_GENRES,
    "volunteer": {"food-bank", "habitat", "cleanup", "mentoring", "animal-shelter", "tutoring", "tree-planting", "meal-delivery"},
    "civic": {"legislation", "town-hall", "public-comment", "advocacy", "organizing", "voter-registration", "commission"},
    "support": SUPPORT_GENRES,
    "religious": RELIGIOUS_GENRES,
    "art": ART_GENRES,
    # Legacy (kept during migration)
    "recreation": RECREATION_GENRES,
    "exercise": EXERCISE_GENRES,
    "nightlife": NIGHTLIFE_GENRES,
    "learning": LEARNING_GENRES,
    "community": COMMUNITY_GENRES,
    "family": FAMILY_GENRES,
    "outdoor": OUTDOOR_GENRES,
    "wellness": WELLNESS_GENRES,
    "meetup": MEETUP_GENRES,
    "gaming": GAMING_GENRES,
}
```

Update `VALID_GENRES` to include the union of all new genre sets.

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /Users/coach/Projects/LostCity/crawlers && python -m pytest tests/test_taxonomy_constants.py -v
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add crawlers/genre_normalize.py crawlers/tests/test_taxonomy_constants.py
git commit -m "feat(crawlers): add genre sets for new taxonomy categories"
```

---

### Task 4: Update web event-taxonomy.ts

**Files:**
- Modify: `web/lib/event-taxonomy.ts`

- [ ] **Step 1: Update PUBLIC_EVENT_CATEGORY_OPTIONS**

Replace the `PUBLIC_EVENT_CATEGORY_OPTIONS` array:

```typescript
export const PUBLIC_EVENT_CATEGORY_OPTIONS = [
  // Performance & Entertainment
  { id: "music", label: "Music" },
  { id: "film", label: "Film" },
  { id: "comedy", label: "Comedy" },
  { id: "theater", label: "Theater" },
  { id: "art", label: "Art" },
  { id: "dance", label: "Dance" },
  // Active & Outdoors
  { id: "sports", label: "Sports" },
  { id: "fitness", label: "Fitness" },
  { id: "outdoors", label: "Outdoors" },
  { id: "games", label: "Games" },
  // Food & Social
  { id: "food_drink", label: "Food & Drink" },
  { id: "conventions", label: "Conventions" },
  // Learning & Making
  { id: "workshops", label: "Workshops" },
  { id: "education", label: "Education" },
  { id: "words", label: "Words" },
  // Civic & Service
  { id: "volunteer", label: "Volunteer" },
  { id: "civic", label: "Civic" },
  { id: "support", label: "Support" },
  { id: "religious", label: "Religious" },
] as const;
```

- [ ] **Step 2: Update LEGACY_EVENT_CATEGORY_ALIASES**

Replace the aliases to map dissolved categories to new ones:

```typescript
export const LEGACY_EVENT_CATEGORY_ALIASES: Record<string, string> = {
  // Dissolved categories -> new taxonomy
  nightlife: "music",          // Default; real reclassification happens in pipeline
  community: "civic",          // Default; real reclassification happens in pipeline
  family: "workshops",         // Default; real reclassification happens in pipeline
  recreation: "fitness",       // Default; real reclassification happens in pipeline
  wellness: "fitness",         // Default; real reclassification happens in pipeline
  exercise: "fitness",         // Merged into fitness
  learning: "education",       // Default; real reclassification happens in pipeline
  support_group: "support",    // Renamed
  // Legacy string aliases
  activism: "civic",
  civic_engagement: "civic",
  government: "civic",
  volunteering: "volunteer",
  service: "volunteer",
  arts: "art",
  class: "workshops",
  cooking: "workshops",
  cultural: "civic",
  education_legacy: "education",
  "food-drink": "food_drink",
  food: "food_drink",
  gaming: "games",
  health: "fitness",
  "kids-family": "workshops",
  markets: "food_drink",
  meetup: "education",
  museums: "art",
  outdoor: "outdoors",
  programs: "education",
  shopping: "food_drink",
  sports_recreation: "fitness",
  tours: "education",
  yoga: "fitness",
  gym: "fitness",
  workout: "fitness",
  fitness_legacy: "fitness",
};
```

- [ ] **Step 3: Update ADMIN_EVENT_CATEGORY_OPTIONS**

```typescript
export const ADMIN_EVENT_CATEGORY_OPTIONS = [
  ...PUBLIC_EVENT_CATEGORY_OPTIONS,
  { id: "other", label: "Other" },
] as const;
```

(Support is now in PUBLIC, no longer admin-only.)

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit 2>&1 | head -30
```

Expected: No errors related to event-taxonomy.ts. (Other pre-existing errors may exist.)

- [ ] **Step 5: Commit**

```bash
git add web/lib/event-taxonomy.ts
git commit -m "feat(web): update event-taxonomy.ts with 19 new categories"
```

---

### Task 5: Update web category-config.ts

**Files:**
- Modify: `web/lib/category-config.ts` (lines 4-85)

- [ ] **Step 1: Add new category entries to CATEGORY_CONFIG**

Add these entries after the existing event categories (before the spot types section):

```typescript
  // New taxonomy categories
  games: { label: "Games", color: "#4ADE80" },
  workshops: { label: "Workshops", color: "#FBBF24" },
  education: { label: "Education", color: "#60A5FA" },
  conventions: { label: "Conventions", color: "#38BDF8" },
  support: { label: "Support", color: "#F9A8D4" },
  fitness: { label: "Fitness", color: "#5EEAD4" },
```

Note: `games`, `fitness`, and `support` may already have entries or near-matches. Check for duplicates — `fitness` already exists at line 14. Keep the existing entry, don't duplicate. Only add entries for IDs that don't exist yet: `games` (line 44 has it for spot type — add as event category too if not present), `workshops`, `education`, `conventions`, `support`.

- [ ] **Step 2: Update MAP_PIN_COLORS to include new categories**

Find the `MAP_PIN_FAMILY_LOOKUP` or equivalent mapping and ensure new categories are assigned to color families:

- `games` → Amber (#FCD34D) — same family as comedy
- `workshops` → Bright Violet (#A78BFA) — same family as art/learning
- `education` → Bright Violet (#A78BFA) — same family as learning
- `conventions` → Cyan (#22D3EE) — same family as sports
- `support` → Coral (#F87171) — same family as family/community

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 4: Commit**

```bash
git add web/lib/category-config.ts
git commit -m "feat(web): add colors and config for new taxonomy categories"
```

---

### Task 6: Update web search-constants.ts

**Files:**
- Modify: `web/lib/search-constants.ts`

- [ ] **Step 1: Verify CATEGORIES auto-derives from event-taxonomy.ts**

The `CATEGORIES` export on line 3 already maps from `PUBLIC_EVENT_CATEGORY_OPTIONS`. Since we updated that in Task 4, `CATEGORIES` automatically reflects the new 19 categories. Verify:

```bash
cd /Users/coach/Projects/LostCity/web && node -e "
  const { CATEGORIES } = require('./lib/search-constants');
  console.log(CATEGORIES.map(c => c.value).join(', '));
" 2>/dev/null || echo "ESM — check manually"
```

If ESM, just confirm by reading that line 3 imports from event-taxonomy.ts.

- [ ] **Step 2: Update TAG_GROUPS if needed**

The TAG_GROUPS may need updates to reflect the new taxonomy. The `Activity` group currently contains tags like `trivia`, `karaoke`, `dj` which are now genres under specific categories. However, they're still useful as cross-category filter tags in search. **No changes needed to TAG_GROUPS for Phase 1** — tag groups remain cross-cutting and still serve their purpose.

- [ ] **Step 3: Commit** (only if changes were made)

```bash
git add web/lib/search-constants.ts
git commit -m "feat(web): verify search constants align with new taxonomy"
```

---

### Task 7: Create golden test set for classification accuracy

**Files:**
- Create: `crawlers/tests/golden_classification_set.json`
- Create: `crawlers/tests/test_golden_classification.py`

- [ ] **Step 1: Query 200 events across all categories for manual classification**

```bash
PGPASSWORD=Qf0g44tG84fAdpo7 psql -h db.rtppvljfrkjtoxmaizea.supabase.co -p 5432 -U postgres -d postgres -c "
SELECT e.id, e.title, e.category_id as old_category, array_to_string(e.genres, ',') as genres,
       v.name as venue, v.venue_type
FROM events e LEFT JOIN venues v ON e.venue_id = v.id
WHERE e.start_date >= NOW()::date AND e.is_active = true
ORDER BY random()
LIMIT 200
" --csv > /tmp/golden_set_raw.csv
```

- [ ] **Step 2: Create the golden test set JSON**

Manually classify each event with the correct new category. Create `crawlers/tests/golden_classification_set.json` with this structure:

```json
[
  {
    "event_id": 12345,
    "title": "Blues Night at Elliott Street Pub",
    "old_category": "music",
    "venue_name": "Elliott Street Deli & Pub",
    "venue_type": "bar",
    "expected_category": "music",
    "expected_genres": ["blues"],
    "expected_audience": "general",
    "notes": "Straightforward music event"
  },
  {
    "event_id": 12346,
    "title": "Geek Trivia Night",
    "old_category": "nightlife",
    "venue_name": "Battle & Brew",
    "venue_type": "restaurant",
    "expected_category": "games",
    "expected_genres": ["trivia"],
    "expected_audience": "general",
    "notes": "Nightlife dissolved — trivia is games"
  }
]
```

Aim for at least 10 events per new category, with extra coverage for:
- Dissolved categories (nightlife, community, family, words, wellness, recreation)
- Ambiguous cases (dance class at rec center, cooking class, meditation)
- Known misclassifications (Painting With a Twist, BlazeSports, Cobb Energy)

- [ ] **Step 3: Write the golden set test harness**

Create `crawlers/tests/test_golden_classification.py`:

```python
"""
Golden test set for classification accuracy.
Tests that the classification engine correctly categorizes known events.
This test is a BENCHMARK, not a gate — it measures accuracy but
doesn't block CI until the classification engine is built (Plan 2).
"""
import json
import os
import pytest

GOLDEN_SET_PATH = os.path.join(os.path.dirname(__file__), "golden_classification_set.json")

def load_golden_set():
    with open(GOLDEN_SET_PATH) as f:
        return json.load(f)

@pytest.fixture
def golden_set():
    return load_golden_set()

def test_golden_set_has_minimum_coverage(golden_set):
    """Golden set must have at least 200 events."""
    assert len(golden_set) >= 200, f"Golden set too small: {len(golden_set)}"

def test_golden_set_covers_all_new_categories(golden_set):
    """Every new category must have at least 5 test events."""
    new_cats = {
        "music", "film", "comedy", "theater", "art", "dance",
        "sports", "fitness", "outdoors", "games",
        "food_drink", "conventions",
        "workshops", "education", "words",
        "volunteer", "civic", "support", "religious",
    }
    cat_counts = {}
    for event in golden_set:
        cat = event["expected_category"]
        cat_counts[cat] = cat_counts.get(cat, 0) + 1

    for cat in new_cats:
        count = cat_counts.get(cat, 0)
        assert count >= 5, f"Category '{cat}' only has {count} golden events (need >= 5)"

def test_golden_set_schema(golden_set):
    """Each golden event must have required fields."""
    required = {"event_id", "title", "expected_category", "expected_audience"}
    for i, event in enumerate(golden_set):
        for field in required:
            assert field in event, f"Event {i} missing field: {field}"
```

- [ ] **Step 4: Run the harness (will fail until golden set is populated)**

```bash
cd /Users/coach/Projects/LostCity/crawlers && python -m pytest tests/test_golden_classification.py -v
```

Expected: FAIL (golden set doesn't exist yet or is underpopulated). This is the benchmark target for Plan 2.

- [ ] **Step 5: Commit the harness (golden set will be populated as a separate task)**

```bash
git add crawlers/tests/test_golden_classification.py crawlers/tests/golden_classification_set.json
git commit -m "test: add golden classification test harness for taxonomy accuracy"
```

---

### Task 8: Verify end-to-end — no breakage

- [ ] **Step 1: Run crawler tests**

```bash
cd /Users/coach/Projects/LostCity/crawlers && python -m pytest -x -q
```

Expected: All existing tests pass. New taxonomy constants are additive.

- [ ] **Step 2: Run web TypeScript check**

```bash
cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit 2>&1 | tail -5
```

Expected: No new errors from taxonomy changes. Pre-existing errors are fine.

- [ ] **Step 3: Run web tests**

```bash
cd /Users/coach/Projects/LostCity/web && npm test -- --run 2>&1 | tail -10
```

Expected: All existing tests pass.

- [ ] **Step 4: Verify old categories still work in API**

```bash
cd /Users/coach/Projects/LostCity/web && npm run dev &
sleep 5
curl -s http://localhost:3000/api/events?category=nightlife | python3 -m json.tool | head -5
curl -s http://localhost:3000/api/events?category=music | python3 -m json.tool | head -5
kill %1
```

Expected: Both old (nightlife) and existing (music) categories return results.

- [ ] **Step 5: Final commit if any fixes were needed**

```bash
git add -A && git status
# Only commit if there are changes
git commit -m "fix: address breakage found during taxonomy phase 1 verification" || echo "No fixes needed"
```
