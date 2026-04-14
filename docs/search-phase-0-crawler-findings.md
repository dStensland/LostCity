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

## Finding 2 — ~~Venues may not have `search_vector`~~ **RESOLVED — places already has it**

**Discovered:** 2026-04-13, Task 7 plan correction
**Resolved:** 2026-04-13, Task 7 implementation — implementer verified during schema inspection that the table is actually `places` (renamed from `venues`) and `places.search_vector tsvector` is populated at 100% (6,785/6,785 rows). Phase 0 still ships trigram-only for places to match the committed migration, but **Phase 1 can add an `fts_places` CTE trivially** — the underlying data is ready. This is not a gap; it's an opportunity.

### Phase 1 follow-up (not blocking anything)
Add an `fts_places` CTE to `search_unified` using `ts_rank_cd(p.search_vector, v_tsq)`. Same structure as `fts_events`. One small migration, no crawler work, no data fix.

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
