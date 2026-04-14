# Exhibition System Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the exhibition entity extraction — add search support, exhibition_id FK on events, and deprecate content_kind='exhibit'.

**Architecture:** Three database migrations (search_vector on exhibitions, exhibition CTEs in search_unified, exhibition_id FK on events) plus crawler docs update. The search UI layer (types, presentation, result cards) already exists — only the DB retrieval layer is missing.

**Tech Stack:** PostgreSQL, Supabase migrations, TypeScript, Python (crawler docs)

**Spec:** `docs/superpowers/specs/2026-04-14-detail-architecture-remediation-design.md` (Phase 2b, 2c, 2d)

---

### Task 1: Add search_vector to exhibitions table

**Files:**
- Create: `database/migrations/NNN_exhibitions_search_vector.sql` (use next sequential number)
- Create: `supabase/migrations/YYYYMMDDHHMMSS_exhibitions_search_vector.sql` (same content)

- [ ] **Step 1: Find next migration number**

Run: `ls /Users/coach/Projects/LostCity/database/migrations/*.sql | sort -t_ -k1 -n | tail -1`

- [ ] **Step 2: Create migration pair**

Run: `python3 /Users/coach/Projects/LostCity/database/create_migration_pair.py exhibitions_search_vector`

- [ ] **Step 3: Write the migration**

```sql
-- Add tsvector search_vector column to exhibitions for unified search.
-- Mirrors the pattern used on events table.

ALTER TABLE exhibitions ADD COLUMN IF NOT EXISTS search_vector tsvector;

CREATE INDEX IF NOT EXISTS idx_exhibitions_search_vector
  ON exhibitions USING gin(search_vector)
  WHERE is_active = true;

-- Backfill existing rows
UPDATE exhibitions
SET search_vector = to_tsvector('simple',
  COALESCE(title, '') || ' ' ||
  COALESCE(description, '') || ' ' ||
  COALESCE(medium, '') || ' ' ||
  COALESCE(array_to_string(tags, ' '), '')
);

-- Trigger to keep search_vector updated on INSERT/UPDATE
CREATE OR REPLACE FUNCTION update_exhibition_search_vector()
RETURNS trigger AS $$
BEGIN
  NEW.search_vector := to_tsvector('simple',
    COALESCE(NEW.title, '') || ' ' ||
    COALESCE(NEW.description, '') || ' ' ||
    COALESCE(NEW.medium, '') || ' ' ||
    COALESCE(NEW.array_to_string, '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Simpler approach: use a generated column trigger
CREATE OR REPLACE FUNCTION exhibitions_search_vector_trigger()
RETURNS trigger AS $$
BEGIN
  NEW.search_vector := to_tsvector('simple',
    COALESCE(NEW.title, '') || ' ' ||
    COALESCE(NEW.description, '') || ' ' ||
    COALESCE(NEW.medium, '') || ' ' ||
    COALESCE(array_to_string(NEW.tags, ' '), '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_exhibitions_search_vector ON exhibitions;
CREATE TRIGGER trg_exhibitions_search_vector
  BEFORE INSERT OR UPDATE OF title, description, medium, tags
  ON exhibitions
  FOR EACH ROW
  EXECUTE FUNCTION exhibitions_search_vector_trigger();
```

Note: Remove the first `update_exhibition_search_vector` function — only `exhibitions_search_vector_trigger` is needed. The first was a draft.

- [ ] **Step 4: Verify migration parity**

Run: `python3 /Users/coach/Projects/LostCity/database/audit_migration_parity.py --fail-on-unmatched 2>&1 | tail -5`

- [ ] **Step 5: Commit**

```bash
git add database/migrations/ supabase/migrations/
git commit -m "feat: add search_vector column to exhibitions table

Adds tsvector column with GIN index for full-text search. Includes
trigger to keep it updated on title/description/medium/tags changes.
Backfills existing rows."
```

---

### Task 2: Add exhibition CTEs to search_unified function

**Files:**
- Create: `database/migrations/NNN_search_unified_exhibitions.sql`
- Create: `supabase/migrations/YYYYMMDDHHMMSS_search_unified_exhibitions.sql`

- [ ] **Step 1: Create migration pair**

Run: `python3 /Users/coach/Projects/LostCity/database/create_migration_pair.py search_unified_exhibitions`

- [ ] **Step 2: Write the migration**

This migration replaces the `search_unified` function, adding `fts_exhibitions` and `trgm_exhibitions` CTEs. The full function body must be copied from `supabase/migrations/20260413000010_search_unified_filters.sql` and extended.

Add these two CTEs before the final SELECT:

```sql
  fts_exhibitions AS (
    SELECT
      'fts'::text AS retriever_id,
      'exhibition'::text AS entity_type,
      ex.id::text AS entity_id,
      ts_rank_cd(ex.search_vector, v_tsq)::real AS raw_score,
      0.5::real AS quality,
      GREATEST(0, EXTRACT(EPOCH FROM (COALESCE(ex.opening_date, now()::date)::timestamptz - now())) / 86400)::int AS days_out,
      ex.title,
      p.name AS venue_name,
      p.neighborhood,
      ex.image_url,
      ex.slug AS href_slug,
      ex.opening_date::timestamptz AS starts_at
    FROM public.exhibitions ex
    LEFT JOIN public.places p ON p.id = ex.place_id
    WHERE ex.portal_id = p_portal_id
      AND 'exhibition' = ANY(p_types)
      AND ex.is_active = true
      AND (p_query = '' OR ex.search_vector @@ v_tsq)
      AND (p_date_from IS NULL OR ex.opening_date >= p_date_from OR ex.opening_date IS NULL)
      AND (p_date_to IS NULL OR ex.opening_date < p_date_to OR ex.opening_date IS NULL)
      AND (p_neighborhoods IS NULL OR p.neighborhood = ANY(p_neighborhoods))
      AND (NOT p_free_only OR ex.admission_type = 'free')
    ORDER BY ts_rank_cd(ex.search_vector, v_tsq) DESC
    LIMIT v_effective_limit
  ),
  trgm_exhibitions AS (
    SELECT
      'trigram'::text AS retriever_id,
      'exhibition'::text AS entity_type,
      ex.id::text AS entity_id,
      similarity(ex.title, p_query)::real AS raw_score,
      0.5::real AS quality,
      GREATEST(0, EXTRACT(EPOCH FROM (COALESCE(ex.opening_date, now()::date)::timestamptz - now())) / 86400)::int AS days_out,
      ex.title,
      p.name AS venue_name,
      p.neighborhood,
      ex.image_url,
      ex.slug AS href_slug,
      ex.opening_date::timestamptz AS starts_at
    FROM public.exhibitions ex
    LEFT JOIN public.places p ON p.id = ex.place_id
    WHERE ex.portal_id = p_portal_id
      AND 'exhibition' = ANY(p_types)
      AND ex.is_active = true
      AND p_query <> ''
      AND ex.title % p_query
      AND (p_date_from IS NULL OR ex.opening_date >= p_date_from OR ex.opening_date IS NULL)
      AND (p_date_to IS NULL OR ex.opening_date < p_date_to OR ex.opening_date IS NULL)
      AND (p_neighborhoods IS NULL OR p.neighborhood = ANY(p_neighborhoods))
    ORDER BY similarity(ex.title, p_query) DESC
    LIMIT v_effective_limit
  )
```

Update the final SELECT to include them:
```sql
  SELECT * FROM fts_events
  UNION ALL SELECT * FROM trgm_events
  UNION ALL SELECT * FROM trgm_venues
  UNION ALL SELECT * FROM fts_exhibitions
  UNION ALL SELECT * FROM trgm_exhibitions;
```

Update the COMMENT to note exhibitions are included.

Preserve the exact same function signature, grants, and REVOKE statements from the previous migration.

- [ ] **Step 3: Verify migration parity**

Run: `python3 /Users/coach/Projects/LostCity/database/audit_migration_parity.py --fail-on-unmatched 2>&1 | tail -5`

- [ ] **Step 4: Commit**

```bash
git add database/migrations/ supabase/migrations/
git commit -m "feat: add exhibition CTEs to search_unified function

Exhibitions are now searchable via FTS and trigram matching. Portal-
scoped via portal_id, with venue name and neighborhood from places
join. Admission type filtering for free exhibitions."
```

---

### Task 3: Add exhibition to default search types

**Files:**
- Modify: `web/lib/search/unified-retrieval.ts`

- [ ] **Step 1: Check if exhibitions need to be added to default types**

Read `web/lib/search/unified-retrieval.ts` and find where default types are set (if any). Also check `web/lib/search/search-service.ts` for `DEFAULT_POLICY` or default type lists.

If the default types list doesn't include `"exhibition"`, add it. The search service already has `exhibition: 4` in groupCaps, and the presenting layer already has exhibition labels/ordering. The only thing that might be missing is whether `"exhibition"` is included in the default `p_types` array passed to the RPC.

- [ ] **Step 2: Run tsc**

Run: `cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit 2>&1 | head -10`

- [ ] **Step 3: Commit if changes were needed**

```bash
git add web/lib/search/
git commit -m "feat: include exhibition in default search types"
```

---

### Task 4: Add exhibition_id FK on events

**Files:**
- Create: `database/migrations/NNN_events_exhibition_id.sql`
- Create: `supabase/migrations/YYYYMMDDHHMMSS_events_exhibition_id.sql`

- [ ] **Step 1: Create migration pair**

Run: `python3 /Users/coach/Projects/LostCity/database/create_migration_pair.py events_exhibition_id`

- [ ] **Step 2: Write the migration**

```sql
-- Add exhibition_id FK to events table.
-- Lets "opening night" or "artist talk" events link to their parent exhibition.
-- Many-to-one: multiple events can reference the same exhibition.

ALTER TABLE events ADD COLUMN IF NOT EXISTS exhibition_id UUID REFERENCES exhibitions(id);

CREATE INDEX IF NOT EXISTS idx_events_exhibition_id
  ON events(exhibition_id)
  WHERE exhibition_id IS NOT NULL;

COMMENT ON COLUMN events.exhibition_id IS
  'Links events to their parent exhibition (opening nights, artist talks, etc.)';
```

- [ ] **Step 3: Verify migration parity**

Run: `python3 /Users/coach/Projects/LostCity/database/audit_migration_parity.py --fail-on-unmatched 2>&1 | tail -5`

- [ ] **Step 4: Commit**

```bash
git add database/migrations/ supabase/migrations/
git commit -m "feat: add exhibition_id FK to events table

Enables linking events (opening nights, artist talks) to their parent
exhibition. Sparse index — only populated for exhibition-related events."
```

---

### Task 5: Deprecate content_kind='exhibit' in crawler docs

**Files:**
- Modify: `crawlers/ARCHITECTURE.md`

- [ ] **Step 1: Find and update the content_kind documentation**

Read `crawlers/ARCHITECTURE.md` and find where `content_kind` or `exhibit` is documented. Add a deprecation notice:

```markdown
### DEPRECATED: content_kind='exhibit'

Events with `content_kind='exhibit'` are a legacy pattern. Exhibitions must be created
in the `exhibitions` table (via `exhibition_utils.py`), never as events. Events that
relate to an exhibition (opening nights, artist talks) should set `exhibition_id` to
link to the parent exhibition record.

The `content_kind='exhibit'` value is filtered from all event feeds. Do not set it
on new events.
```

- [ ] **Step 2: Commit**

```bash
git add crawlers/ARCHITECTURE.md
git commit -m "docs: deprecate content_kind='exhibit' in crawler architecture

Exhibitions belong in the exhibitions table. Events related to
exhibitions use the exhibition_id FK. content_kind='exhibit' is
filtered from feeds and should not be set on new events."
```

---

### Task 6: Final verification

- [ ] **Step 1: Run tsc**

Run: `cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit 2>&1 | head -10`

- [ ] **Step 2: Run migration parity check**

Run: `python3 /Users/coach/Projects/LostCity/database/audit_migration_parity.py --fail-on-unmatched 2>&1 | tail -10`

- [ ] **Step 3: Verify all migrations are paired**

Run: `ls database/migrations/*exhibition* supabase/migrations/*exhibition*`
Expected: Each migration exists in both directories
