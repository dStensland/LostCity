# Exhibition Schema Evolution — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Evolve `venue_features` and `exhibitions` tables to support museums, zoos, attractions, and theme parks. Update all pipeline code that touches these tables.

**Architecture:** Two Supabase migrations (additive columns + expanded CHECK constraints), then crawler DB module updates, then TypeScript type updates. No new tables — evolving existing infrastructure.

**Tech Stack:** PostgreSQL (Supabase migrations), Python (crawler pipeline), TypeScript (web types)

**Spec:** `docs/superpowers/specs/2026-04-09-exhibition-system-expansion-design.md` — "Schema Changes" and "Pipeline Code Changes" sections

**Prerequisite:** Phase 1 pipeline quality fixes must be complete. P4 (Arts portal) exhibitions page must be live.

---

### Task 1: Migrate `venue_features` — Additive Columns

**Files:**
- Create: `supabase/migrations/YYYYMMDDHHMMSS_venue_features_expansion.sql`
- Modify: `database/schema.sql` (update the venue_features definition to match)

- [ ] **Step 1: Generate the migration file**

```bash
cd /Users/coach/Projects/LostCity
# Use the current timestamp for the migration filename
MIGRATION_NAME="venue_features_expansion"
TIMESTAMP=$(date -u +%Y%m%d%H%M%S)
MIGRATION_FILE="supabase/migrations/${TIMESTAMP}_${MIGRATION_NAME}.sql"
```

- [ ] **Step 2: Write the migration**

Create the migration file with this content:

```sql
-- Exhibition System Expansion: venue_features additive columns
-- Adds source tracking, portal federation, admission details, tags, and metadata
-- to support museums, zoos, attractions, and theme parks alongside art galleries.

BEGIN;

-- Source tracking
ALTER TABLE venue_features ADD COLUMN IF NOT EXISTS source_id INTEGER
  REFERENCES sources(id) ON DELETE SET NULL;

-- Portal federation
ALTER TABLE venue_features ADD COLUMN IF NOT EXISTS portal_id UUID
  REFERENCES portals(id) ON DELETE SET NULL;

-- Admission details
ALTER TABLE venue_features ADD COLUMN IF NOT EXISTS admission_type TEXT;
ALTER TABLE venue_features ADD COLUMN IF NOT EXISTS admission_url TEXT;

-- Provenance
ALTER TABLE venue_features ADD COLUMN IF NOT EXISTS source_url TEXT;

-- Discovery
ALTER TABLE venue_features ADD COLUMN IF NOT EXISTS tags TEXT[];

-- Flexible metadata (content_hash, last_verified_at)
ALTER TABLE venue_features ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Indexes for new FKs
CREATE INDEX IF NOT EXISTS idx_venue_features_source
  ON venue_features(source_id) WHERE source_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_venue_features_portal
  ON venue_features(portal_id) WHERE portal_id IS NOT NULL;

-- updated_at auto-update trigger
-- The update_updated_at_column() function already exists (used by 15+ tables)
DROP TRIGGER IF EXISTS update_venue_features_updated_at ON venue_features;
CREATE TRIGGER update_venue_features_updated_at
  BEFORE UPDATE ON venue_features
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMIT;
```

- [ ] **Step 3: Update `database/schema.sql`**

Add the new columns to the `venue_features` definition in `database/schema.sql` so the canonical schema stays in sync with migrations. Add `source_id`, `portal_id`, `admission_type`, `admission_url`, `source_url`, `tags`, and `metadata` columns after the existing column definitions. Add the trigger definition after the table.

- [ ] **Step 4: Apply the migration locally**

```bash
cd /Users/coach/Projects/LostCity
npx supabase db push --local
```

Or if using direct connection:

```bash
psql "$DATABASE_URL" -f "$MIGRATION_FILE"
```

- [ ] **Step 5: Verify**

```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'venue_features'
ORDER BY ordinal_position;
-- Should show all new columns

SELECT tgname FROM pg_trigger WHERE tgrelid = 'venue_features'::regclass;
-- Should include update_venue_features_updated_at
```

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/*venue_features_expansion* database/schema.sql
git commit -m "migrate: add source tracking, portal, admission, and metadata columns to venue_features

Supports exhibition system expansion to museums, zoos, and attractions.
Adds: source_id, portal_id, admission_type, admission_url, source_url,
tags, metadata. Adds updated_at trigger."
```

---

### Task 2: Migrate `exhibitions` — Expanded Types + Feature FK

**Files:**
- Create: `supabase/migrations/YYYYMMDDHHMMSS_exhibitions_expansion.sql`
- Modify: `database/schema.sql`

- [ ] **Step 1: Verify CHECK constraint names in live database**

Before writing the migration, confirm the auto-generated constraint names:

```sql
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'exhibitions'::regclass AND contype = 'c';
```

Expected names: `exhibitions_exhibition_type_check` and `exhibitions_admission_type_check`. If different, use the actual names in the migration.

- [ ] **Step 2: Write the migration**

```sql
-- Exhibition System Expansion: expanded types + venue feature FK
-- Adds seasonal, special-exhibit, attraction types for non-art venues.
-- Links exhibitions to venue_features via related_feature_id.

BEGIN;

-- 1. Add related_feature_id FK (BIGINT to match venue_features.id identity column)
ALTER TABLE exhibitions ADD COLUMN IF NOT EXISTS related_feature_id BIGINT
  REFERENCES venue_features(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_exhibitions_related_feature
  ON exhibitions(related_feature_id)
  WHERE related_feature_id IS NOT NULL;

-- 2. Expand exhibition_type CHECK constraint
--    Must DROP then re-ADD (cannot append values to CHECK)
ALTER TABLE exhibitions DROP CONSTRAINT IF EXISTS exhibitions_exhibition_type_check;
ALTER TABLE exhibitions ADD CONSTRAINT exhibitions_exhibition_type_check
  CHECK (exhibition_type IN (
    'solo', 'group', 'installation', 'retrospective', 'popup', 'permanent',
    'seasonal', 'special-exhibit', 'attraction'
  ));

-- 3. Expand admission_type CHECK constraint
ALTER TABLE exhibitions DROP CONSTRAINT IF EXISTS exhibitions_admission_type_check;
ALTER TABLE exhibitions ADD CONSTRAINT exhibitions_admission_type_check
  CHECK (admission_type IN (
    'free', 'ticketed', 'donation', 'suggested', 'included'
  ));

COMMIT;
```

- [ ] **Step 3: Update `database/schema.sql`**

Update the exhibitions table definition to include `related_feature_id BIGINT REFERENCES venue_features(id) ON DELETE SET NULL` and the expanded CHECK constraint values.

- [ ] **Step 4: Apply and verify**

```bash
psql "$DATABASE_URL" -f "$MIGRATION_FILE"
```

```sql
-- Verify new column
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'exhibitions' AND column_name = 'related_feature_id';
-- Should return: related_feature_id | bigint

-- Verify expanded constraints
SELECT pg_get_constraintdef(oid) FROM pg_constraint
WHERE conrelid = 'exhibitions'::regclass AND conname = 'exhibitions_exhibition_type_check';
-- Should include seasonal, special-exhibit, attraction

-- Test new values work
INSERT INTO exhibitions (title, exhibition_type, admission_type)
VALUES ('Test Seasonal', 'seasonal', 'included');
-- Should succeed
DELETE FROM exhibitions WHERE title = 'Test Seasonal';
```

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/*exhibitions_expansion* database/schema.sql
git commit -m "migrate: expand exhibition types and add venue feature FK

Adds seasonal, special-exhibit, attraction to exhibition_type CHECK.
Adds included to admission_type CHECK.
Adds related_feature_id BIGINT FK to venue_features for linking
time-boxed exhibitions to permanent features."
```

---

### Task 3: Update Crawler DB Module — `_EXHIBITION_COLUMNS`

**Files:**
- Modify: `crawlers/db/exhibitions.py:94-99`
- Test: `crawlers/tests/test_exhibition_dedup.py`

- [ ] **Step 1: Write the failing test**

Add to `crawlers/tests/test_exhibition_dedup.py`:

```python
def test_exhibition_columns_includes_related_feature_id():
    """The column whitelist must include related_feature_id for FK linking."""
    from db.exhibitions import _EXHIBITION_COLUMNS

    assert "related_feature_id" in _EXHIBITION_COLUMNS, (
        "related_feature_id must be in _EXHIBITION_COLUMNS or it will be "
        "silently dropped during insert_exhibition"
    )
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd crawlers && python -m pytest tests/test_exhibition_dedup.py::test_exhibition_columns_includes_related_feature_id -v
```

Expected: FAIL — `related_feature_id` not in set yet

- [ ] **Step 3: Add `related_feature_id` to the column set**

In `crawlers/db/exhibitions.py`, change lines 94-99 from:

```python
_EXHIBITION_COLUMNS = {
    "slug", "place_id", "source_id", "portal_id", "title", "description",
    "image_url", "opening_date", "closing_date", "medium", "exhibition_type",
    "admission_type", "admission_url", "source_url", "tags", "is_active",
    "metadata",
}
```

to:

```python
_EXHIBITION_COLUMNS = {
    "slug", "place_id", "source_id", "portal_id", "title", "description",
    "image_url", "opening_date", "closing_date", "medium", "exhibition_type",
    "admission_type", "admission_url", "source_url", "tags", "is_active",
    "metadata", "related_feature_id",
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd crawlers && python -m pytest tests/test_exhibition_dedup.py -v
```

Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add crawlers/db/exhibitions.py crawlers/tests/test_exhibition_dedup.py
git commit -m "fix(pipeline): add related_feature_id to exhibition column whitelist

Without this, insert_exhibition silently drops the FK when crawlers
try to link exhibitions to venue features."
```

---

### Task 4: Update Crawler DB Module — `upsert_venue_feature` Columns

**Files:**
- Modify: `crawlers/db/places.py:1021-1037`
- Test: `crawlers/tests/test_venue_feature_validation.py` (created in Phase 1)

- [ ] **Step 1: Write the failing test**

Add to `crawlers/tests/test_venue_feature_validation.py`:

```python
def test_upsert_venue_feature_row_includes_new_columns():
    """The row dict must include all new schema columns."""
    # We verify by checking the function handles the new fields without error
    # by inspecting the code structure. The real test is that these keys
    # are present in the row dict built by upsert_venue_feature.
    new_columns = {
        "source_id", "portal_id", "admission_type",
        "admission_url", "source_url", "tags", "metadata",
    }
    # Import and check the function builds a row with these keys
    import inspect
    from db.places import upsert_venue_feature
    source = inspect.getsource(upsert_venue_feature)
    for col in new_columns:
        assert f'"{col}"' in source or f"'{col}'" in source, (
            f"upsert_venue_feature must include '{col}' in the row dict"
        )
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd crawlers && python -m pytest tests/test_venue_feature_validation.py::test_upsert_venue_feature_row_includes_new_columns -v
```

Expected: FAIL — new columns not in the function source yet

- [ ] **Step 3: Update the row dict**

In `crawlers/db/places.py`, update the `row` dict in `upsert_venue_feature()` (after line 1036) to add the new columns before the closing `}`:

```python
    row = {
        "place_id": venue_id,
        "slug": slug,
        "title": title,
        "feature_type": feature_type,
        "description": feature_data.get("description"),
        "image_url": feature_data.get("image_url"),
        "url": feature_data.get("url"),
        "is_seasonal": feature_data.get("is_seasonal", False),
        "start_date": feature_data.get("start_date"),
        "end_date": feature_data.get("end_date"),
        "price_note": feature_data.get("price_note"),
        "is_free": feature_data.get("is_free", False),
        "sort_order": feature_data.get("sort_order", 0),
        "is_active": True,
        "updated_at": "now()",
        "source_id": feature_data.get("source_id"),
        "portal_id": feature_data.get("portal_id"),
        "admission_type": feature_data.get("admission_type"),
        "admission_url": feature_data.get("admission_url"),
        "source_url": feature_data.get("source_url"),
        "tags": feature_data.get("tags"),
        "metadata": feature_data.get("metadata") or {},
    }
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd crawlers && python -m pytest tests/test_venue_feature_validation.py -v
```

Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add crawlers/db/places.py crawlers/tests/test_venue_feature_validation.py
git commit -m "fix(pipeline): add new schema columns to upsert_venue_feature

Adds source_id, portal_id, admission_type, admission_url, source_url,
tags, metadata to the row dict so new venue_features columns are
populated by crawlers."
```

---

### Task 5: Update Entity Persistence — Feature ID Accumulation

**Files:**
- Modify: `crawlers/entity_persistence.py:91-102`
- Test: `crawlers/tests/test_entity_persistence.py`

- [ ] **Step 1: Write the failing test**

Add to `crawlers/tests/test_entity_persistence.py`:

```python
def test_persist_typed_entity_envelope_passes_related_feature_id():
    """When an exhibition has related_feature_slug, the persistence layer
    should resolve it to related_feature_id from the persisted features."""
    from entity_persistence import persist_typed_entity_envelope
    from entity_lanes import TypedEntityEnvelope

    # This is a structural test — verify the function signature accepts
    # envelopes with related_feature_slug and that the feature ID map
    # is built during persistence.
    import inspect
    source = inspect.getsource(persist_typed_entity_envelope)
    assert "feature_id_by_slug" in source or "related_feature" in source, (
        "persist_typed_entity_envelope must accumulate feature IDs "
        "and resolve related_feature_slug for exhibitions"
    )
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd crawlers && python -m pytest tests/test_entity_persistence.py::test_persist_typed_entity_envelope_passes_related_feature_id -v
```

Expected: FAIL — no `feature_id_by_slug` in the source yet

- [ ] **Step 3: Update the persistence layer**

In `crawlers/entity_persistence.py`, modify the venue_features loop (lines 91-102) to accumulate feature IDs:

```python
    # Build feature ID map for exhibition FK linking
    feature_id_by_slug: dict[str, int] = {}

    for feature in envelope.venue_features:
        feature_record = dict(feature)
        venue_id = _resolve_venue_id(feature_record, venue_ids_by_slug)
        if not venue_id:
            result.bump_skipped("venue_features")
            result.unresolved.append("venue_features")
            continue
        persisted = upsert_venue_feature(venue_id, feature_record)
        if persisted:
            result.bump_persisted("venue_features")
            slug = feature_record.get("slug") or ""
            if slug and isinstance(persisted, (int, float)):
                feature_id_by_slug[slug] = int(persisted)
        else:
            result.bump_skipped("venue_features")
```

Then in the exhibitions loop (which comes later), add the slug-to-id resolution:

```python
    for exhibition in envelope.exhibitions:
        exhibition_record = dict(exhibition)
        # Resolve related_feature_slug to related_feature_id
        related_slug = exhibition_record.pop("related_feature_slug", None)
        if related_slug and related_slug in feature_id_by_slug:
            exhibition_record["related_feature_id"] = feature_id_by_slug[related_slug]
        # ... rest of existing exhibition persistence
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd crawlers && python -m pytest tests/test_entity_persistence.py -v
```

Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add crawlers/entity_persistence.py crawlers/tests/test_entity_persistence.py
git commit -m "feat(pipeline): accumulate feature IDs for exhibition FK linking

When persisting a typed entity envelope, venue_features are processed
first and their IDs are accumulated by slug. Exhibitions with a
related_feature_slug get the resolved related_feature_id before insert."
```

---

### Task 6: Update TypeScript Types — Exhibitions

**Files:**
- Modify: `web/lib/types/exhibitions.ts`

- [ ] **Step 1: Update ExhibitionType union**

In `web/lib/types/exhibitions.ts`, change the `ExhibitionType` definition from:

```typescript
export type ExhibitionType =
  | "solo"
  | "group"
  | "installation"
  | "retrospective"
  | "popup"
  | "permanent";
```

to:

```typescript
export type ExhibitionType =
  | "solo"
  | "group"
  | "installation"
  | "retrospective"
  | "popup"
  | "permanent"
  | "seasonal"
  | "special-exhibit"
  | "attraction";
```

- [ ] **Step 2: Update AdmissionType**

Change from:

```typescript
export type AdmissionType = "free" | "ticketed" | "donation" | "suggested";
```

to:

```typescript
export type AdmissionType = "free" | "ticketed" | "donation" | "suggested" | "included";
```

- [ ] **Step 3: Add `related_feature_id` to Exhibition interface**

Add after the existing fields in the `Exhibition` interface:

```typescript
  related_feature_id: number | null;
```

- [ ] **Step 4: Update label maps**

Add to `EXHIBITION_TYPE_LABELS`:

```typescript
  seasonal: "Seasonal Event",
  "special-exhibit": "Special Exhibit",
  attraction: "Limited-Time Attraction",
```

Add to `ADMISSION_TYPE_LABELS`:

```typescript
  included: "Included with Admission",
```

- [ ] **Step 5: Run type check**

```bash
cd web && npx tsc --noEmit
```

Expected: PASS — no type errors introduced. If there are errors, they'll be in components that exhaustively switch on `ExhibitionType` — add the new cases.

- [ ] **Step 6: Commit**

```bash
git add web/lib/types/exhibitions.ts
git commit -m "feat(types): expand ExhibitionType and AdmissionType for non-art venues

Adds seasonal, special-exhibit, attraction to ExhibitionType.
Adds included to AdmissionType.
Adds related_feature_id to Exhibition interface.
Updates label maps for UI rendering."
```

---

### Task 7: Update TypeScript Types — Place Features

**Files:**
- Modify: `web/lib/place-features.ts`

- [ ] **Step 1: Update PlaceFeature type**

Add the new columns to the `PlaceFeature` type after the existing fields:

```typescript
export type PlaceFeature = {
  id: number;
  slug: string;
  title: string;
  feature_type: FeatureType;
  description: string | null;
  image_url: string | null;
  url: string | null;
  is_seasonal: boolean;
  start_date: string | null;
  end_date: string | null;
  price_note: string | null;
  is_free: boolean;
  sort_order: number;
  source_id: number | null;
  portal_id: string | null;
  admission_type: string | null;
  admission_url: string | null;
  source_url: string | null;
  tags: string[] | null;
  metadata: Record<string, unknown>;
};
```

- [ ] **Step 2: Run type check**

```bash
cd web && npx tsc --noEmit
```

Expected: PASS. If any component destructures `PlaceFeature` exhaustively, it may need the new fields added, but since they're all optional/nullable this is unlikely to cause errors.

- [ ] **Step 3: Commit**

```bash
git add web/lib/place-features.ts
git commit -m "feat(types): add new venue_features columns to PlaceFeature type

Adds source_id, portal_id, admission_type, admission_url, source_url,
tags, metadata to match the schema migration."
```

---

### Task 8: Add Exhibition to Unified Search Index

**Files:**
- Modify: the unified search module (location TBD — investigate `web/lib/unified-search/`)

- [ ] **Step 1: Find the search index configuration**

```bash
cd web && grep -r "search.*type\|result.*type\|SuggestionGroup" lib/ components/search/ --include="*.ts" --include="*.tsx" -l
```

Identify where search result types are registered and how new entity types are added.

- [ ] **Step 2: Add `exhibition` as a search result type**

The implementation depends on how the search index works. Add exhibitions to whatever type registry exists, with:
- Query: search `exhibitions` table by `title ILIKE %q%` or `description ILIKE %q%`
- Result shape: title, venue name (via join), date range, admission type, thumbnail (image_url)
- Type label: "Exhibition"

- [ ] **Step 3: Run type check and test**

```bash
cd web && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add web/lib/unified-search/ web/components/search/
git commit -m "feat(search): add exhibitions to unified search results

Exhibitions are now searchable by title and description. Results show
venue name, date range, admission type, and thumbnail."
```

---

## Verification

After all tasks are complete:

```bash
# Type check
cd web && npx tsc --noEmit

# Crawler tests
cd crawlers && python -m pytest tests/ -v --timeout=30

# Verify migrations applied
psql "$DATABASE_URL" -c "
  SELECT column_name FROM information_schema.columns
  WHERE table_name = 'venue_features' AND column_name IN ('source_id','portal_id','metadata','tags')
  ORDER BY column_name;
"
# Expected: metadata, portal_id, source_id, tags

psql "$DATABASE_URL" -c "
  SELECT column_name FROM information_schema.columns
  WHERE table_name = 'exhibitions' AND column_name = 'related_feature_id';
"
# Expected: related_feature_id

# Verify new exhibition types work
psql "$DATABASE_URL" -c "
  INSERT INTO exhibitions (title, exhibition_type, admission_type)
  VALUES ('Schema Test', 'seasonal', 'included');
  DELETE FROM exhibitions WHERE title = 'Schema Test';
"
```
