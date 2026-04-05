# PRD 044: Atlanta Third-Space Wave 1 Activation Plan

**Portal:** `atlanta`
**Surface:** `consumer`
**Status:** Activation handoff
**Last Updated:** 2026-04-01
**Depends on:** `prds/042-atlanta-third-space-wave1-execution-checklist.md`, `prds/043-atlanta-third-space-wave1-source-matrix.md`, `database/CLAUDE.md`

---

## Purpose

This document covers the non-crawler side of Wave 1:

- source registration
- ownership
- migration shape
- validation sequence

This is needed because Wave 1 includes:

- one truly new source slug: `community-grounds`
- one existing crawler/profile with registry and metadata drift questions:
  `charis-books`

Without active `sources` rows, crawler files alone do not make the source pack
real.

---

## Strategic Rule

These should be registered as Atlanta-owned sources.

Use:

- `owner_portal_id = (SELECT id FROM portals WHERE slug = 'atlanta')`

Why:

- these are general Atlanta destination facts
- they enrich the shared Atlanta layer
- they should not be siloed behind a special third-space ownership model

---

## Repo Reality

### Community Grounds

- no crawler file found at
  [crawlers/sources/community_grounds.py](/Users/coach/Projects/LostCity/crawlers/sources/community_grounds.py)
- no profile found
- no source-registration hit found in migrations during this research pass

### Charis Books

- crawler exists at
  [crawlers/sources/charis_books.py](/Users/coach/Projects/LostCity/crawlers/sources/charis_books.py)
- profile exists at
  [crawlers/sources/profiles/charis-books.yaml](/Users/coach/Projects/LostCity/crawlers/sources/profiles/charis-books.yaml)
- no source-registration migration hit was found during the initial research
  pass
- dry-run validation on 2026-04-01 confirmed a live `sources` row is present in
  the current DB target for slug `charis-books`

### Existing upgrade sources

- [crawlers/sources/fulton_library.py](/Users/coach/Projects/LostCity/crawlers/sources/fulton_library.py)
- [crawlers/sources/atlanta_beltline.py](/Users/coach/Projects/LostCity/crawlers/sources/atlanta_beltline.py)

Dry-run validation on 2026-04-01 also confirmed live `sources` rows in the
current DB target for:

- `fulton-library`
- `atlanta-beltline`

No activation work is expected for those two unless registry drift is
discovered.

---

## Activation Targets

## 1. `community-grounds`

Recommended registration:

- `slug`: `community-grounds`
- `name`: `Community Grounds`
- `url`: `https://communitygrounds.com/`
- `source_type`: `venue`
- `crawl_frequency`: `weekly`
- `is_active`: `true`
- `integration_method`: `html`
- `owner_portal_id`: Atlanta portal

Why `weekly`:

- destination-first site with relatively slow structural change
- enough cadence to keep hours / description / specials reasonably fresh

Why `html`:

- Squarespace brochure site
- requests/BeautifulSoup + JSON-LD should be sufficient

## 2. `charis-books`

Recommended registration:

- `slug`: `charis-books`
- `name`: `Charis Books & More`
- `url`: `https://www.charisbooksandmore.com/events`
- `source_type`: `venue`
- `crawl_frequency`: `daily`
- `is_active`: `true`
- `integration_method`: `html`
- `owner_portal_id`: Atlanta portal

Why `daily`:

- event-driven venue with frequent calendar turnover

Why `html`:

- current crawler uses Playwright against HTML pages
- existing profile indicates `llm_crawler`, but source registration should align
  with the implementation actually intended to run

Open implementation question:

- whether the profile and `sources.integration_method` should both stay
  `llm_crawler`
- or whether this should be normalized to `html` if the current crawler remains
  the real path

The important point is consistency. The source row should reflect the actual
execution path.

Current-state note:

- a live source row already exists in the current DB target
- the practical next move is likely `ownership / metadata verification`, not
  first-time registration

---

## Migration Guidance

Per [database/CLAUDE.md](/Users/coach/Projects/LostCity/database/CLAUDE.md), use:

```bash
python3 /Users/coach/Projects/LostCity/database/create_migration_pair.py source_name
```

This should create:

- `database/migrations/<timestamp>_source_name.sql`
- matching `supabase/migrations/<timestamp>_source_name.sql`

Recommended migration names:

- `community_grounds_source_registration`
- `charis_books_source_registration`

If both are registered together, a combined migration is acceptable:

- `atlanta_third_space_wave1_source_registration`

---

## Recommended SQL Shape

Use the recent Atlanta registration pattern:

```sql
INSERT INTO sources (
  name,
  slug,
  url,
  source_type,
  crawl_frequency,
  is_active,
  owner_portal_id,
  integration_method
)
SELECT
  'Community Grounds',
  'community-grounds',
  'https://communitygrounds.com/',
  'venue',
  'weekly',
  TRUE,
  p.id,
  'html'
FROM portals p
WHERE p.slug = 'atlanta'
  AND NOT EXISTS (
    SELECT 1 FROM sources s WHERE s.slug = 'community-grounds'
  );
```

Apply the same pattern for `charis-books`.

If expected-event counts are in active use for the source-health tooling, add:

- `expected_event_count`

Suggested initial values:

- `community-grounds`: `0` or omit if destination-first source-health handling
  does not use it
- `charis-books`: `25`

Do not guess if the health tooling treats `0` as a broken source. Check current
source-health semantics first.

---

## Source Sharing

For Wave 1, no special sharing rule is required unless another portal needs
direct subscription immediately.

Default posture:

- register under Atlanta ownership
- rely on standard Atlanta shared-layer usage

If later needed by Family or Citizen:

- add `source_sharing_rules` deliberately
- do not front-run that complexity in Wave 1

---

## Validation Sequence

For each new or newly activated source:

### 1. Migration parity

```bash
python3 /Users/coach/Projects/LostCity/database/audit_migration_parity.py --fail-on-unmatched
```

### 2. Source-pack validation

If a manifest is created for this pack:

```bash
cd web
npx tsx scripts/portal-factory/validate-source-pack.ts --manifest <manifest>
```

### 3. Dry-run crawl

```bash
cd crawlers
python3 main.py --source community-grounds --dry-run
python3 main.py --source charis-books --dry-run
```

### 4. Data inspection

Confirm:

- source row exists and is active
- owner portal is Atlanta
- venue record is complete
- no empty-source false positive

---

## Known Risks

### 1. `charis-books` drift between profile and crawler

Profile currently says:

- `integration_method: llm_crawler`

Current crawler file is hand-written Playwright code.

This mismatch should be resolved before treating activation as complete.

### 2. Destination-first source health semantics

`community-grounds` may produce strong destination data with few or no events.

Do not let source-health logic mark it as unhealthy just because event yield is
light. This source is strategically valid if destination data is strong.

### 3. Claimed implementation area

`crawlers/sources/` is currently claimed in
[ACTIVE_WORK.md](/Users/coach/Projects/LostCity/ACTIVE_WORK.md), so activation
planning can proceed, but crawler implementation should be coordinated before
editing claimed files.

---

## Recommended Next Step

The next concrete artifact should be the actual registration migration for:

- `community-grounds`
- `charis-books`

followed immediately by:

- crawler implementation / hardening
- dry-run validation

That is the shortest path from strategic research to live source-pack progress.
