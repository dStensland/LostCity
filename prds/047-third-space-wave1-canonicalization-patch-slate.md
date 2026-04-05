# PRD 047: Third-Space Wave 1 Canonicalization Patch Slate

**Portal:** `atlanta`
**Surface:** `consumer`
**Status:** Implementation slate
**Last Updated:** 2026-04-01
**Depends on:** [2026-04-01-third-space-source-canonicalization.md](/Users/coach/Projects/LostCity/docs/decisions/2026-04-01-third-space-source-canonicalization.md), `prds/046-atlanta-third-space-wave1-blocker-audit.md`

---

## Purpose

This document translates the canonicalization ADR into the smallest useful set
of code and metadata edits.

It is not a broad cleanup pass.

It is the minimum patch slate needed so Wave 1 implementation does not sit on
top of source-identity drift.

---

## Scope

This slate covers only three canonicalization targets:

- `charis-books`
- `atlanta-beltline`
- `fulton-library`

It does not include:

- the new `community-grounds` crawler
- registration migration implementation
- feature work beyond canonicalization

---

## Patch Order

Apply in this order:

1. `charis-books` identity cleanup
2. `fulton-library` metadata correction
3. `atlanta-beltline` source consolidation decision implementation

### Why this order

- Charis has the cleanest fix and touches immediate Wave 1 activation
- Fulton is a metadata correction with low behavioral risk
- BeltLine has the widest blast radius and should be tackled last, once the
  canonical target is explicit

---

## 1. Charis Cleanup

### Files to touch

- [crawlers/sources/recurring_social_events.py](/Users/coach/Projects/LostCity/crawlers/sources/recurring_social_events.py)
- [crawlers/sources/profiles/charis-books.yaml](/Users/coach/Projects/LostCity/crawlers/sources/profiles/charis-books.yaml)
- optionally [crawlers/sources/charis_books.py](/Users/coach/Projects/LostCity/crawlers/sources/charis_books.py) if code comments or metadata need alignment

### Required changes

In `recurring_social_events.py`:

- keep venue map key: `charis-books`
- change embedded venue slug from:
  - `charis-books-and-more`
- to:
  - `charis-books`

In `charis-books.yaml`:

- align `integration_method` with the actual intended runtime path

Recommended default:

- if the hand-written crawler remains authoritative, do not leave the profile
  implying a different execution mode

### Why this matters

- recurring-social seed data should resolve to the same venue slug as the main
  crawler and future source row
- Charis should have exactly one canonical source/venue identity

### Done when

- `charis-books` is the only surviving Charis slug in Wave 1-relevant code
- profile metadata no longer contradicts the actual crawler path

---

## 2. Fulton Library Metadata Correction

### Files to touch

- [crawlers/sources/profiles/fulton-library.yaml](/Users/coach/Projects/LostCity/crawlers/sources/profiles/fulton-library.yaml)

### Required changes

- update profile metadata so it does not present `fulton-library` as an
  HTML-first source when the real event backbone is the BiblioCommons API

This does not require changing the crawler logic itself.

The point is to prevent future agents or tooling from being misled by stale
profile semantics.

### Done when

- the profile accurately signals API-primary behavior
- no one reading the profile would assume HTML scraping is the core ingestion
  mode

---

## 3. BeltLine Consolidation

### Files to review

- [crawlers/sources/atlanta_beltline.py](/Users/coach/Projects/LostCity/crawlers/sources/atlanta_beltline.py)
- [crawlers/sources/beltline.py](/Users/coach/Projects/LostCity/crawlers/sources/beltline.py)
- [crawlers/sources/beltline_fitness.py](/Users/coach/Projects/LostCity/crawlers/sources/beltline_fitness.py)
- [crawlers/sources/profiles/atlanta-beltline.yaml](/Users/coach/Projects/LostCity/crawlers/sources/profiles/atlanta-beltline.yaml)
- [crawlers/sources/profiles/beltline.yaml](/Users/coach/Projects/LostCity/crawlers/sources/profiles/beltline.yaml)

### Required decision to implement

Canonical source:

- `atlanta-beltline`

### Minimum patch objective

Make sure only one general BeltLine source is treated as canonical.

### Recommended implementation posture

- preserve [crawlers/sources/atlanta_beltline.py](/Users/coach/Projects/LostCity/crawlers/sources/atlanta_beltline.py) as the canonical general BeltLine crawler
- treat [crawlers/sources/beltline.py](/Users/coach/Projects/LostCity/crawlers/sources/beltline.py) as legacy and either:
  - deprecate it,
  - mark it clearly as superseded,
  - or remove it once safe
- keep [crawlers/sources/beltline_fitness.py](/Users/coach/Projects/LostCity/crawlers/sources/beltline_fitness.py) only if it remains a deliberate specialized supporting source

### Minimum metadata cleanup

- profile default should point to `atlanta-beltline`, not `beltline`
- legacy `beltline` profile should be deprecated or marked compatibility-only

### Why this matters

- Run Club and general BeltLine activity should not fragment across multiple
  general-source identities
- Wave 1 recurring-program work needs a single obvious target file

### Done when

- `atlanta-beltline` is the default implementation target everywhere
- `beltline` no longer looks like an equally canonical general source

---

## Suggested Commit / Change Split

If these are implemented in code, split them like this:

### Change 1

`Normalize Charis canonical slug`

Includes:

- recurring social seed slug fix
- Charis profile metadata alignment

### Change 2

`Correct Fulton Library source metadata`

Includes:

- profile correction only

### Change 3

`Canonicalize BeltLine source identity`

Includes:

- legacy/general-source cleanup
- profile cleanup
- explicit comments if legacy files remain

This split keeps risk localized and makes review easier.

---

## Verification

After canonicalization edits:

- search for `charis-books-and-more` in Wave 1-relevant source code
- search for duplicate general BeltLine slugs in active source metadata
- verify `fulton-library` profile no longer implies the wrong ingestion model

Suggested checks:

```bash
rg -n "charis-books-and-more|charis-books" crawlers/sources crawlers/sources/profiles
rg -n "slug: beltline|slug: atlanta-beltline" crawlers/sources/profiles crawlers/sources
rg -n "integration_method: llm_crawler|integration_method: html" crawlers/sources/profiles/charis-books.yaml crawlers/sources/profiles/fulton-library.yaml
```

---

## Next Step After This Slate

Once canonicalization is applied, the next implementation branch should be:

1. source registration migration for `community-grounds` and `charis-books`
2. `community_grounds.py`
3. Charis quality pass
4. Central and BeltLine Wave 1 upgrades
