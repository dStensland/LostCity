# Crawler findings surfaced during Search Elevation Phase 0

Running log of data quality issues discovered while implementing the search rebuild. These are **not** blocking Phase 0 search ship (they don't fail the coverage gate in spec §1.6), but they affect search quality or feature completeness and belong to crawler-dev / data-specialist workstreams.

Track and close as separate efforts. Search Phase 0 ships without fixing any of these.

---

## Finding 1 — Event price coverage 54.2% (Atlanta)

**Discovered:** 2026-04-13, Task 1 data coverage audit
**Severity:** Medium
**Gating:** NO — not in the three bold thresholds
**Affects:** "Free events tonight", "Events under $20", price filter chips on result cards

### Numbers
- `events.price` populated: **54.2%** of active Atlanta events
- Spec target (non-gating): **≥80%**
- Gap: **~25 percentage points**, roughly 14,700 events missing price data

### Impact on search
- Result cards for ~46% of events render the "unknown price" fallback, which looks incomplete
- `?free=true` filter query under-recalls — users searching for free events miss events where crawlers haven't captured price
- Cannot satisfy "cheap eats" / "$$ brunch" type intents with precision
- Phase 1 synonym map won't help; this is a data extraction gap, not a query understanding gap

### Recommended owners
- **crawler-dev** — audit which sources are dropping price during extraction. Likely suspects: sources that link out to external ticketing (Eventbrite, DICE, Ticketmaster) where price sits one click deeper than the event landing page
- **data-specialist** — quantify per-source price coverage to prioritize the fix list

### Suggested next step
Run a "top 10 sources by missing price" query similar to the audit's place_id gap query, then file per-source crawler fixes.

---

## Finding 2 — Venues may not have `search_vector`

**Discovered:** 2026-04-13, Task 7 plan correction
**Severity:** Low
**Gating:** NO
**Affects:** Venue FTS quality; Phase 0 ships trigram-only for venues

### Issue
The `venues` table may not have a `search_vector tsvector` column (migration 045 added search_vector to `events` but I haven't confirmed a venues equivalent). Phase 0 Task 7's `search_unified` RPC compensates by using trigram similarity for venue search, which works for "jazz club" → "The Jazz Corner" but misses term-frequency/inverse-document-frequency ranking benefits.

### Impact on search
- Venue search relevance is shallower than event search
- "coffee shop midtown" search returns venues by title match only, no weighting by description frequency
- Acceptable for Phase 0 per spec §1.6 (venues are a secondary result type)

### Recommended owners
- **data-specialist** — add a migration that creates `venues.search_vector tsvector` populated from `name || ' ' || COALESCE(description, '')` with a trigger to maintain it
- **search-dev** — after the column lands, add a `fts_venues` CTE to `search_unified` that uses `ts_rank_cd` against the new vector

### Suggested next step
Verify column existence first with `psql -c "\d venues" | grep search_vector`. If missing, file as a Phase 1 migration task.

---

## Template for future findings

```markdown
## Finding N — [short title]

**Discovered:** YYYY-MM-DD, Task X [description]
**Severity:** Low / Medium / High
**Gating:** YES / NO — [which threshold it fails, if any]
**Affects:** [what the user sees]

### Numbers
[concrete coverage / count / percentage]

### Impact on search
[bulleted list of user-visible effects]

### Recommended owners
[specific role, e.g., crawler-dev, data-specialist, portal-config]

### Suggested next step
[concrete first action]
```
