# PRD 046: Atlanta Third-Space Wave 1 Blocker Audit

**Portal:** `atlanta`
**Surface:** `consumer`
**Status:** Risk audit
**Last Updated:** 2026-04-01
**Depends on:** `prds/042-atlanta-third-space-wave1-execution-checklist.md`, `prds/043-atlanta-third-space-wave1-source-matrix.md`, `prds/044-atlanta-third-space-wave1-activation-plan.md`

---

## Purpose

This document records the implementation blockers and drift discovered while
preparing the Wave 1 third-space source pack.

These are not abstract concerns.

They are concrete mismatches already present in the repo that could cause:

- duplicate sources
- bad source activation decisions
- incorrect source-health reads
- recurring-event linkage bugs
- avoidable rework in claimed crawler areas

---

## Executive Summary

Wave 1 has four meaningful implementation risks:

1. `Charis` is not net-new code, but it has profile / registration drift.
2. `BeltLine` appears in multiple overlapping crawler and profile forms.
3. `Fulton Library` profile metadata does not match the actual API-based
   crawler.
4. recurring-social seed data has a `Charis` slug mismatch that can create
   duplicate or fragmented venue identity.

These should be resolved or explicitly accepted before treating Wave 1 as a
clean implementation target.

---

## 1. Charis Source Drift

### What exists

- crawler:
  [crawlers/sources/charis_books.py](/Users/coach/Projects/LostCity/crawlers/sources/charis_books.py)
- profile:
  [crawlers/sources/profiles/charis-books.yaml](/Users/coach/Projects/LostCity/crawlers/sources/profiles/charis-books.yaml)

### What is inconsistent

- profile says:
  - `integration_method: llm_crawler`
- crawler is:
  - hand-written Playwright / Python extraction
- no matching source-registration migration hit was found during this research
  pass

### Why this matters

If Charis is activated without reconciling this:

- the source row may misrepresent actual execution mode
- ops tooling may classify it incorrectly
- future agents may think a new crawler needs to be written when it does not

### Additional data drift

In
[crawlers/sources/recurring_social_events.py](/Users/coach/Projects/LostCity/crawlers/sources/recurring_social_events.py),
the venue map key is `charis-books`, but the embedded venue slug is
`charis-books-and-more`.

Relevant references:

- venue map key: `charis-books`
- embedded venue slug: `charis-books-and-more`
- recurring event uses `venue_key: "charis-books"`

### Risk

This is a direct venue-identity fragmentation risk.

### Recommended resolution

- make `charis-books` the canonical slug everywhere
- align profile integration method with the actual crawler path
- register the source row using the chosen execution path

---

## 2. BeltLine Source Duplication

### What exists

Crawlers:

- [crawlers/sources/atlanta_beltline.py](/Users/coach/Projects/LostCity/crawlers/sources/atlanta_beltline.py)
- [crawlers/sources/beltline.py](/Users/coach/Projects/LostCity/crawlers/sources/beltline.py)
- [crawlers/sources/beltline_fitness.py](/Users/coach/Projects/LostCity/crawlers/sources/beltline_fitness.py)

Profiles:

- [crawlers/sources/profiles/atlanta-beltline.yaml](/Users/coach/Projects/LostCity/crawlers/sources/profiles/atlanta-beltline.yaml)
- [crawlers/sources/profiles/beltline.yaml](/Users/coach/Projects/LostCity/crawlers/sources/profiles/beltline.yaml)

Registry history:

- `database/migrations/004_phase2_sources.sql` references both `beltline` and
  `atlanta-beltline`
- later migrations and source-federation references also include
  `atlanta-beltline`

### What is inconsistent

- there are at least two main BeltLine crawler names for similar territory
- there are at least two profile slugs:
  - `beltline`
  - `atlanta-beltline`
- `beltline_fitness.py` explicitly says it is separate from the main BeltLine
  crawler, but Wave 1 recurring-program work overlaps with exactly that fitness
  / run-club lane

### Why this matters

Without a canonical source decision, Wave 1 BeltLine work could:

- upgrade the wrong crawler
- split recurring output across multiple source identities
- create inconsistent source-health expectations
- leave Run Club logic duplicated across sources

### Recommended resolution

Choose one canonical BeltLine source strategy:

Option A:

- keep `atlanta-beltline` as the canonical general source
- fold or explicitly deprecate `beltline`
- decide whether `beltline_fitness` remains separate or is treated as a
  subordinate recurring-program source

Option B:

- keep `beltline` and `beltline_fitness` deliberately separate, but then document
  source ownership and product semantics clearly

Recommended default:

- canonicalize on `atlanta-beltline`

because that slug already appears in newer source-pack thinking and the richer
typed-envelope crawler currently lives there.

---

## 3. Fulton Library Profile Drift

### What exists

- crawler:
  [crawlers/sources/fulton_library.py](/Users/coach/Projects/LostCity/crawlers/sources/fulton_library.py)
- profile:
  [crawlers/sources/profiles/fulton-library.yaml](/Users/coach/Projects/LostCity/crawlers/sources/profiles/fulton-library.yaml)

### What is inconsistent

- profile says:
  - `integration_method: html`
- crawler actually uses:
  - BiblioCommons API via `https://gateway.bibliocommons.com/v2/libraries/fulcolibrary/...`

### Why this matters

This can mislead future implementation in two ways:

- agents may treat it as a scrape-first HTML source when the API is the real
  backbone
- source registration / source-health fields may not match actual runtime shape

### Recommended resolution

- align profile metadata to the API-driven implementation path
- preserve HTML branch-page enrichment only as a supplement, not as the core
  source identity

---

## 4. Community Grounds Source Health Risk

### What exists

- no crawler file yet
- no profile yet
- no source-registration hit found during this research pass

### Why this matters

Community Grounds is strategically valid even if it produces zero or near-zero
event yield in Wave 1.

It is a destination-first third-space source.

If source-health expectations are event-heavy by default, this source could be
misclassified as weak even when the destination data is excellent.

### Recommended resolution

- explicitly treat Community Grounds as a destination-first source
- ensure activation and review criteria include:
  - hours
  - description
  - image
  - meeting-space signal
  - specials signal if available

and do not require recurring events for the source to count as healthy

---

## Resolution Order

Resolve in this order:

1. `Charis` slug + integration-method consistency
2. `BeltLine` canonical source decision
3. `Fulton Library` profile metadata correction
4. `Community Grounds` destination-first health expectations

### Why this order

- Charis is immediately in Wave 1 and touches both activation and recurring
  logic
- BeltLine has the largest duplication surface
- Fulton is lower risk because its runtime path is already clear in code
- Community Grounds is new work and can be implemented cleanly once the review
  bar is explicit

---

## Recommended Next Artifact

The next useful artifact is a short `canonical slug and integration-method
decision memo` covering:

- `charis-books`
- `atlanta-beltline`
- `fulton-library`

That would let implementation proceed with fewer hidden assumptions.
