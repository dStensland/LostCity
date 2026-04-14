# Search Elevation — Design Spec

**Date:** 2026-04-13
**Status:** Draft — design approved, implementation plan pending
**Owner:** Search working group
**Benchmark:** Resy / Time Out / Google Events / Linear / Raycast (explicitly *not* Facebook)

---

## Executive summary

Lost City's search is broken today: a 1869-line `lib/unified-search.ts` silently strips user queries and substitutes category filters (the query "jazz" returned one organizer while the parallel `instant` endpoint returned fifteen events), the explore-page input unmounts mid-type due to a URL-sync state-machine bug, four API routes overlap, and two components ship the same input into four surfaces with incompatible state machines.

This spec defines a comprehensive rebuild: one unified search experience launched from everywhere, progressive results, discovery-forward body, three-layer backend (Retrieval → Ranking → Presentation) with enforced contracts, forgiving text (trigram + synonyms + did-you-mean), and observability-from-day-one. Phases are data-gated, not calendar-gated.

**What the plan is NOT:** this is not a Facebook Events clone. Facebook search is mediocre and uses patterns (algorithmic personalization, social-graph ranking, feed-style ranking) that contradict our stated principles. Our benchmark is Resy + Time Out + Google Events + Linear. The success metric is **Search Conversion Rate (SCR)** — percent of search sessions that end in a save, RSVP, or plan creation.

**Explicitly out of scope:** pgvector embeddings, LLM query routing, hidden ("Because you saved X") personalization, cross-portal result mixing, voice/image search, saved-search alerts, algorithmic trending. These are deferred to future phases with explicit re-evaluation criteria, or cut outright where they contradict principle.

**Principal tension resolved in this spec:** the architect's retriever-pluralism model vs. the performance expert's connection-pool-exhaustion concern. Resolution: TypeScript `Retriever` classes remain distinct and A/B-able, but the orchestrator invokes a single `search_unified` SQL function that runs all retrievers as CTEs inside one connection. This preserves the abstraction while keeping connection cost at 1-per-request instead of 9.

---

## Part 1 — Strategy

### 1.1 North star

> **"The only events search that knows Atlanta well enough to return the right answer when you don't know exactly what you're looking for — not because it guesses, but because its data is comprehensive enough that the right answer is actually in there."**

Data coverage, not ranking sophistication, is the moat. A great ranker on sparse data returns ugly results faster. Search quality is a trailing indicator of crawler health.

### 1.2 Principles

These override all downstream decisions. Where this spec contradicts a principle, the principle wins.

1. **One experience, one codebase.** A single `UnifiedSearch` component renders into two modes: `inline` (explore hero) and `overlay` (launcher, portaled with backdrop). Separate components exist only for genuinely different jobs (lane filters, people search).
2. **Progressive, not state-switched.** No "dropdown → commit → results page" state machine. Input stays mounted. Results stream in beneath the input as the query takes shape.
3. **Fast first, rich second.** First paint of any result happens within ~150ms from keystroke on a warm cache hit (100ms debounce + ~45ms render). Full rich results within ~415ms p95 on cache miss. Never a spinner in place of results — shimmer skeletons with honest counts.
4. **Trust the backend.** If the query returns zero results, the UI says zero. We never synthesize placeholder rows, inflate counts, or strip the user's query and substitute a "smarter" one. This is a deliberate rejection of how `unified-search.ts` was working.
5. **Forgiving.** Trigram similarity, curated synonyms, and "did you mean" absorb user imprecision. The user never types something and gets told they typed it wrong.
6. **Complex data model, simple mental model.** Users don't know (and shouldn't need to) the difference between an event, series, festival, program, exhibition, organizer, or category. Results are grouped under user-comprehensible labels, ordered by intent, with a "Top matches" row that erases the hierarchy when it doesn't help.
7. **Personalization is visible, never hidden.** Saved state and RSVP state render as chips the user can see. No ranking-level personalization that silently alters results. The user can always answer "why did this result come up?" Hidden personalization (trending, popular-now, "because you saved X") is **cut** — it contradicts the feed-philosophy decision and smuggles recommendation-engine patterns into search presearch.
8. **Portal-scoped by default.** Results always come from the current portal. Cross-portal results appear only in explicit "Elsewhere on Lost City" sections, never mixed into the main list. This is non-negotiable — enforced at the RPC level, not the UI.
9. **Cinematic minimalism.** Visual language follows `docs/decisions/2026-03-08-cinematic-minimalism-design.md`. Solid surfaces, atmospheric glow, controlled motion, no bounce, no glass.
10. **Accessible.** Full keyboard nav from the first keystroke. Focus management across open/close. Screen-reader announcements for result counts, loading, corrections. The keyboard experience is as good as the touch experience.

### 1.3 Benchmark rubric

| Product | Patterns we copy | Why | Patterns we explicitly don't copy |
|---|---|---|---|
| **Resy** | Venue tile grid with image-dominant cards; price + neighborhood always visible at tile level; neighborhood as a primary browse axis | Intent profile matches ours — users search with a goal | Waitlist/reservation funnel; "Resy Regulars" social layer; paid editorial injection |
| **Time Out Atlanta** | Section headers + lane layout for grouped results; city-specific editorial voice in zero-result and empty-lane states | City-scoped framing is the right mental model — we answer "what's good in Atlanta," not "what exists anywhere" | Staff picks injected as content rows; "Time Out" brand authority as ranking signal; paywall |
| **Google Events** | Structured event cards with date/time/venue/distance inline without a click; Quick Intent chips; clean zero-chrome results container; **corrected-results-by-default typo handling** | Users are trained on this layout. Don't reinvent what they already know. Google-scale validation of quick-intent patterns. | Aggregated "Buy tickets" CTA pointing off-platform; sponsored injection; knowledge graph venue cards (we *are* the venue card) |
| **Linear (command palette)** | Single input, instant results, section dividers within results (Projects/Issues/Members); dense result rows (icon + primary + secondary on one line) | Linear proved command palette works for heterogeneous entity graphs — same problem we have | Desktop-keyboard-first as primary access. Our users are on mobile. Command palette = desktop only |
| **Raycast** | Progressive results (partial-match results appear before query is complete); section headers reflow as results arrive (no spinner-then-page); fallback section for no-match queries | The latency illusion — "jazz" returns venues with jazz nights before the user finishes typing "jazz brunch" | Extension ecosystem; AI-generated summaries; personal productivity features |
| **Airbnb** | Structured filter row persistent above results (not in a drawer); filters compose with text query (applying "outdoor" to "Midtown" narrows, not resets); mobile keyboard handling via `visualViewport` | Structured filters as a first-class persistent top-bar drives dramatically higher filter usage | Map-as-primary for all searches (our inventory is temporal); "Experiences" curation; pricing psychology dark patterns |
| **Do404** (strategic contrast) | *Nothing functional.* Their no-search stance is a valid editorial choice for small-scale hand-picked curation | Their model is our anti-pattern — we have too much inventory to browse without search | "If it's not in our picks, it doesn't exist" philosophy |

### 1.4 Success metric

**Search Conversion Rate (SCR).** Percent of search sessions that end in a save, RSVP, plan creation, add-to-saved-list, or share-sheet-opened action originating from within the search UI.

- **Numerator:** Any of {save, RSVP, add-to-plan, add-to-list, share-opened} where the action originated from a result card inside the search overlay or the explore results view (not from the result's detail page reached via other navigation).
- **Denominator:** Sessions where the user typed ≥1 character and at least one result was rendered. Empty sessions (focused but never typed) are excluded.
- **Session boundary:** Starts on input focus. Ends on (a) overlay dismissed, (b) navigation leaves the explore/detail route family, or (c) 10 minutes of inactivity.
- **Baseline:** Unknown — we have no historical data. Set at day-30 post-launch median. Pre-launch comparison floor is the feed's save/RSVP rate.
- **30-day target:** SCR ≥ feed conversion rate. If intent-driven search doesn't convert at least as well as passive browsing, it is not doing its job.
- **90-day target:** SCR ≥ 1.5× feed conversion rate. Intent-driven search should outperform browse by a meaningful margin. If it doesn't, the query→result relevance is broken and we reopen data coverage before any ranking work.

**Diagnostic metrics (watched, not optimized):**
- **Zero-result rate** — target <8% on 2+ word queries. Above 10% signals a data gap, not a ranking problem.
- **Click-through by position** — flat distribution signals broken ranking; heavy position-1 concentration signals working ranking.
- **Time-to-first-click** — <8s = users found something fast; >30s = results required too much scanning.
- **Abandonment rate** — sessions with ≥1 search and 0 interactions. High abandonment = results present but not compelling.
- **Filter usage rate** — are users composing filters with text queries? <15% usage means the "filters are first-class" bet is wrong and we revisit.

### 1.5 Scope decision table

Every feature originally in the conversational plan, placed explicitly:

| Feature | Phase | Reasoning |
|---|---|---|
| Delete 1869-line `unified-search.ts` | **Phase 0** | Not optional. Cannot tune a ranking system built on undifferentiated logic. |
| Delete orphaned routes (`/api/search`, `/preview`, `/suggestions`) | **Phase 0** | Dead code compounds maintenance burden; delete before replacing. |
| Single unified endpoint | **Phase 0** | Prerequisite for all downstream work. |
| Three-layer architecture (Retrieval / Ranking / Presentation) | **Phase 0** | The architecture IS Phase 0. Without it, Phase 1 features have nowhere to land. |
| `UnifiedSearch` component (inline + overlay modes) | **Phase 0** | Component shell must exist before instrumentation, testing, or demo. |
| `LaneFilterInput` split | **Phase 0** | Prerequisite for filters-as-first-class. Decouples lane narrowing from global discovery. |
| Progressive results layout | **Phase 0** | Core interaction model. No spinner-then-page, ever. |
| Portal isolation enforcement (RPC-level) | **Phase 0** | Trust infrastructure. A FORTH guest must not see HelpATL civic events in their hotel search. |
| `pg_trgm` typo tolerance | **Phase 0** | Users will misspell "Ponce City Market" constantly. Fuzzy match is table stakes. |
| Structured filtering as first-class (composable with query) | **Phase 0** | Core query contract at the RPC layer. Not a UI feature. |
| Visible-state personalization (saved/RSVP chips on cards) | **Phase 0** | Persistence of the user's own actions. Not personalization — honesty. |
| Recent searches (localStorage) | **Phase 0** | Client-only is acceptable for Phase 0; server sync is Phase 1. |
| Mobile keyboard handling (`visualViewport`) | **Phase 0** | Primary use case is mobile. Broken keyboard handling = broken product. |
| Card anatomy per entity type | **Phase 0** | A unified card that shows the wrong fields per type is worse than type-specific layouts. |
| Empty state design (zero-result, network fail, etc.) | **Phase 0** | Production, not demos. Empty states are product, not polish. |
| Presearch content strategy | **Phase 0** | Define what populates presearch or the screen is blank. Static-only per principle. |
| Quick Intents | **Phase 0** | Already exists on explore hero. Static, non-algorithmic. |
| `search_events` observability table | **Phase 0** | Without this, every downstream decision is guesswork. Non-negotiable. |
| Portal-scoped by default | **Phase 0** | Enforced at RPC via `p_portal_id NOT NULL`. |
| Adaptive presearch (inline minimal / overlay rich) | **Phase 0** | Same component, two layout modes. Not a new feature. |
| Hybrid Top Matches + Grouped Sections body | **Phase 0** | Result layout structure. Must be defined even if only 1-2 sections are populated on day 1. |
| Recent searches server sync | **Phase 1** | Cross-device persistence. Valuable but not blocking. |
| Curated synonym map | **Phase 1** | Start with `pg_trgm`. Synonyms are maintenance burden justified only once zero-result data shows specific gaps. |
| "Did you mean" UX | **Phase 1** | Blocked on synonym/correction data. Build once Phase 0 data shows where users are stuck. |
| Motion spec refinements (beyond Phase 0 defaults) | **Phase 1** | Correctness first, delight second. |
| OpenTelemetry + Server-Timing + RUM | **Phase 1** | Phase 0 ships basic `search_events` + latency columns. Full OTel tracing is Phase 1 production tuning. |
| Redis cache layer | **Phase 1** | Phase 0 uses `lib/shared-cache.ts` (already Upstash-backed). Explicit tuning and stampede hardening is Phase 1. |
| Single-flight stampede protection | **Phase 1** | Tied to cache hardening. |
| Layered rate limiting (per-IP + per-user + per-query-shape) | **Phase 1** | Phase 0 uses existing `RATE_LIMITS.read` preset. Layered presets land before public promotion. |
| Desktop keyboard nav model (arrow-key navigation) | **Phase 1** | Mobile keyboard nav is Phase 0. Desktop power-user flow is Phase 1. |
| Search warm-up cron | **Phase 1** | Cost-bearing operational detail. Ship after Phase 0 load-tests. |
| Friends-going chips | **Deferred** | Contingent on social graph density. Premature before the social layer has traction. |
| Text highlighting (bold matched terms) | **Phase 1** | Small polish that compounds. Cheap to ship. |
| `pgvector` embeddings backfill | **Deferred** | Contingent on Phase 1 shipping AND zero-result/relevance gap that embeddings would actually close. Re-evaluate 90 days post-Phase-1. |
| Crawler-side embedding generation | **Deferred** | Blocked on embeddings decision. |
| Hybrid ranking with vector similarity | **Deferred** | Same dependency chain. BM25 + `pg_trgm` + structured filters may be sufficient. Prove the gap first. |
| "Because you saved X" presearch block | **Cut** | Explicit rejection. Smuggles recommendation engine into presearch. Contradicts feed-philosophy decision. |
| "Trending / Popular now" curated content | **Cut** | Same reason. Requires scoring model = ranking dressed as editorial. If it ever ships, ships as an honest time-based signal ("most-saved in last 48h") with that exact label. |
| LLM query routing | **Cut (for now)** | No evidence it solves a problem we have. Variable operational cost. Revisit only if users consistently write natural-language queries that structured search fails on. |

### 1.6 Data coverage prerequisites

**Search quality is bounded by data quality.** Phase 0 is gated on a data audit before ranking work begins. Phase 0 does not ship until these floors are cleared.

| Entity type | Fields | Minimum coverage |
|---|---|---|
| Events | title, start_date, venue_id, image_url, category, price | title 100%, start_date 100%, **venue_id ≥ 85%**, image ≥ 70%, **category ≥ 90%**, price ≥ 80% |
| Venues (places) | name, image_url, neighborhood, hours, category, lat/lng | name 100%, image ≥ 80%, **neighborhood ≥ 85%**, hours ≥ 60%, category ≥ 95%, lat/lng ≥ 90% |
| Programs | name, venue_id, audience tag, session dates or registration_url, category | name 100%, venue_id ≥ 90%, audience ≥ 85%, session/reg ≥ 80% |
| Series | name, venue_id, recurrence description, category | name 100%, venue_id ≥ 85%, category ≥ 80% |
| Exhibitions | title, venue_id, start_date, end_date, image | Phase P4 dependency — **exclude from search scope until P4 ships** |
| Neighborhoods | name, polygon or centroid | 100% — reference data |
| Festivals | title, start/end dates, venue, image | title 100%, dates 100%, venue ≥ 85%, image ≥ 70% |

**What happens below the bar:** do NOT hide records. Hiding sparse records punishes coverage where we claim coverage is our moat. Surface the record with reduced rank and a card fallback (no-image state, unknown-hours chip). The exception is exhibitions, which are P4-dependent and gated out entirely until that workstream lands.

**Audit owner:** run the coverage audit as a Phase 0 task using `data-specialist` subagent. Gate Phase 0 ship on (a) audit complete, (b) bold numbers above met.

**The bolded rows are the hard gates:** venue_id linkage on events (85%), category on events (90%), neighborhood on venues (85%). If any of these three is below bar, the "filters compose with query" contract is hollow because half the records can't participate in the most useful filters. Fix data before shipping search.

---

## Part 2 — Architecture

### 2.1 Three-layer contract

The single most important decision in this spec. **`lib/search/search-service.ts` must be ~150 lines wiring three layers — not 500+ lines of orchestration with mixed concerns. This is what prevents the plan from becoming v2 of `unified-search.ts`.**

```typescript
// web/lib/search/types.ts

/**
 * A Candidate is the atomic unit crossing Retrieval → Ranking → Presentation.
 * Retrievers MUST NOT pre-shape for presentation. The ranker owns ordering;
 * the presenter owns grouping and top-matches selection.
 */
export interface Candidate {
  id: string;                       // stable entity id
  type: EntityType;                 // 'event' | 'venue' | 'organizer' | ...
  source_retriever: RetrieverId;    // 'fts' | 'trigram' | 'structured'
  raw_score: number;                // retriever-native, pre-normalization
  matched_fields: string[];         // ['title', 'description', 'venue.name']
  payload: Record<string, unknown>; // type-specific, opaque to ranker
}

export type RetrieverId = 'fts' | 'trigram' | 'structured';

export type EntityType =
  | 'event' | 'venue' | 'organizer' | 'series' | 'festival'
  | 'exhibition' | 'program' | 'neighborhood' | 'category';

export interface RetrieverContext {
  portal_id: string;                // REQUIRED — data isolation boundary
  user_id?: string;                 // for visible persistence only, never hidden personalization
  limit: number;                    // per-retriever cap; ranker does final truncation
  signal: AbortSignal;              // cooperative cancellation
}

/**
 * Retriever is the contract for candidate generation. Each retriever returns
 * its own candidate list with raw, un-normalized scores. Cross-retriever math
 * is the ranker's job, not the retriever's.
 */
export interface Retriever {
  readonly id: RetrieverId;
  retrieve(q: AnnotatedQuery, ctx: RetrieverContext): Promise<Candidate[]>;
}
```

```typescript
// web/lib/search/ranking/types.ts

export interface RankedCandidate extends Candidate {
  final_score: number;
  contributing_retrievers: RetrieverId[];  // for debugging + observability
  rank: number;
}

export interface RankingContext {
  weights: Partial<Record<RetrieverId, number>>;
  intent: AnnotatedQuery['intent'];
  diversityLambda?: number;              // MMR tradeoff, 0 = pure relevance
}

/**
 * Ranker fuses N retrievers' candidate sets into a final ordering.
 * The default ranker is RrfRanker (Reciprocal Rank Fusion, k=60) — scale-invariant,
 * robust to score-scale differences across retrievers, no weight tuning required.
 */
export interface Ranker {
  readonly id: string;
  rank(
    candidateSets: Map<RetrieverId, Candidate[]>,
    ctx: RankingContext
  ): RankedCandidate[];
}

export type RrfRank = (sets: Map<RetrieverId, Candidate[]>, k?: number) => RankedCandidate[];
```

```typescript
// web/lib/search/presenting/types.ts

export interface PresentationPolicy {
  topMatchesCount: number;                              // default 6 desktop, 3 mobile
  groupCaps: Partial<Record<EntityType, number>>;       // { event: 8, venue: 6, ... }
  diversityLambda: number;                              // MMR: 0 = relevance, 1 = pure novelty
  dedupeKey: (c: RankedCandidate) => string;            // e.g. same venue in event+place
}

export interface PresentedResults {
  topMatches: RankedCandidate[];  // hero rail, cross-type interleaved
  sections: Array<{ type: EntityType; title: string; items: RankedCandidate[] }>;
  totals: Record<EntityType, number>;
  diagnostics: SearchDiagnostics; // always present, used for Server-Timing + analytics
}

export interface Presenter {
  present(ranked: RankedCandidate[], policy: PresentationPolicy): PresentedResults;
}
```

**Contract enforcement:**

1. **Lint rule:** `web/tools/eslint-rules/no-retriever-rpc-calls.js` — fails CI if any file under `web/lib/search/retrievers/` imports `supabase` clients, uses `.rpc()`, or imports from `@/lib/ranking` / `@/lib/features`. Retrievers interpret shared execution output into `Candidate[]` — they do not issue their own database calls. (This is the adjusted rule reflecting the connection-pool reconciliation; see §2.5.)

2. **Contract test:** `web/lib/search/__tests__/retriever-contract.test.ts` — loads every registered retriever, feeds fixed `AnnotatedQuery` fixtures, asserts that (a) output order is a pure function of input, (b) two runs with the same query produce identical output, (c) `raw_score` is monotonic in the retriever's native signal.

3. **Both must be in place at Phase 0 merge.** Retrofitting these after the first "just this once" violation is harder than writing them upfront.

### 2.2 `AnnotatedQuery` — query understanding as a first-class phase

The immutable object passed from query-understanding to retrieval. Retrievers receive this; they **never** see the raw user string. The original user query is preserved end-to-end for debugging, logging, and UI display — but retrieval consumes the annotated form.

```typescript
// web/lib/search/understanding/types.ts

export interface Token {
  text: string;        // original surface form
  normalized: string;  // lowercased, unaccented, NFKC
  start: number;       // char offset in raw
  end: number;
  stop: boolean;       // stopword flag
}

export type EntityKind = 'category' | 'neighborhood' | 'venue' | 'person' | 'time' | 'audience';

export interface EntityAnnotation {
  kind: EntityKind;
  span: [number, number];       // offsets in raw
  resolved_id?: string;          // linked to canonical id when confident
  surface: string;               // original text
  confidence: number;            // 0..1
}

export interface StructuredFilters {
  categories?: string[];
  neighborhoods?: string[];
  date_range?: { start: string; end: string };
  price?: { free?: boolean; max?: number };
  audience?: string[];           // taxonomy v2 audience gates
  venue_ids?: string[];
}

export interface AnnotatedQuery {
  readonly raw: string;                                     // user's original — NEVER mutated
  readonly normalized: string;                              // NFKC + lowercase + ws-collapse + control-char strip
  readonly tokens: ReadonlyArray<Token>;
  readonly entities: ReadonlyArray<EntityAnnotation>;
  readonly temporal?: { type: 'point' | 'range' | 'recurring'; start: string; end: string };
  readonly spatial?: { neighborhood?: string; distance_m?: number; center?: [number, number] };
  readonly spelling: ReadonlyArray<{ corrected: string; confidence: number }>;
  readonly synonyms: ReadonlyArray<{ token: string; expansions: string[]; weight: number }>;
  readonly structured_filters: Readonly<StructuredFilters>;
  readonly intent: { type: IntentType; confidence: number };
  readonly fingerprint: string;                              // stable hash for cache key + observability
}

export type IntentType = 'find_event' | 'find_venue' | 'browse_category' | 'unknown';

// web/lib/search/understanding/annotate.ts
export declare function annotate(raw: string, ctx: PortalContext): Promise<AnnotatedQuery>;
```

**`AnnotatedQuery` is `Object.freeze`d at construction.** Downstream layers receive it by reference and may only read. No method on `AnnotatedQuery` mutates it. The tokenizer, entity linker, intent classifier, and spell-correction all run **inside** `annotate()`; no layer outside `understanding/` touches query understanding.

### 2.3 File layout

```
web/lib/search/
├── index.ts                         # public API: { search, SearchService, types }
├── search-service.ts                # orchestrator, ~150 lines target
├── types.ts                         # Candidate, EntityType, RetrieverId, shared enums
├── cache.ts                         # Redis wrapper (Phase 0: existing shared-cache; Phase 1: Upstash + single-flight)
├── observability.ts                 # logSearchEvent (async), Server-Timing helpers
├── unified-retrieval.ts             # calls the search_unified RPC (see §2.5)
│
├── understanding/
│   ├── annotate.ts                  # the only public entry
│   ├── tokenize.ts                  # internal
│   ├── intent.ts                    # internal, rule-based classifier
│   ├── synonyms.ts                  # internal (Phase 1)
│   ├── entities.ts                  # internal, entity linker
│   └── types.ts                     # AnnotatedQuery + friends
│
├── retrievers/
│   ├── index.ts                     # registry: Record<RetrieverId, Retriever>
│   ├── fts.ts                       # FtsRetriever — reads unified retrieval result
│   ├── trigram.ts                   # TrigramRetriever — reads unified retrieval result
│   ├── structured.ts                # StructuredRetriever — pure filter pushdown
│   └── types.ts
│
├── ranking/
│   ├── index.ts                     # rankerRegistry
│   ├── rrf.ts                       # RrfRanker (default, k=60)
│   ├── hybrid.ts                    # stub for Phase 2 embedding-augmented ranker
│   └── types.ts
│
├── presenting/
│   ├── index.ts
│   ├── grouped.ts                   # GroupedPresenter (sections + top matches)
│   ├── mmr.ts                       # diversity util
│   └── types.ts
│
├── input-schema.ts                  # Zod schema + normalization (see §3.1)
├── normalize.ts                     # NFKC + control char strip + length clamp
└── __tests__/
    ├── retriever-contract.test.ts
    ├── annotate.test.ts
    ├── ranker.test.ts
    └── integration.test.ts
```

**Public API** is only `index.ts`. API routes import `@/lib/search`, never `@/lib/search/retrievers/fts`. Everything else is internal.

### 2.4 State management — Zustand

**Pick: single Zustand store with `subscribeWithSelector` middleware.** Justification: two-context split (QueryContext + ResultsContext) forces `useMemo` on every derived value and creates a subscription pyramid that breaks the moment someone adds a cross-cutting concern. Zustand + React 19 `useSyncExternalStore` gives per-field selector granularity for free, no provider wrapping — important because the overlay mounts outside the inline search's tree.

```typescript
// web/lib/search/store.ts
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

interface SearchStore {
  // query slice — updates on every keystroke
  raw: string;
  annotated: AnnotatedQuery | null;
  filters: StructuredFilters;

  // results slice — updates on fetch completion only
  results: PresentedResults | null;
  status: 'idle' | 'annotating' | 'fetching' | 'ready' | 'error';
  requestId: string | null;

  // ui slice
  mode: 'inline' | 'overlay';
  overlayOpen: boolean;

  // actions
  setRaw: (raw: string) => void;
  setFilters: (f: Partial<StructuredFilters>) => void;
  commitResults: (r: PresentedResults, requestId: string) => void;
  openOverlay: () => void;
  closeOverlay: () => void;
}

export const useSearchStore = create<SearchStore>()(
  subscribeWithSelector((set, get) => ({ /* ... */ }))
);
```

**How it avoids the re-render storm:**

- Input subscribes only to `raw` via `useSearchStore(s => s.raw)`. Typing updates this field; only components selecting `raw` re-render.
- Results list subscribes only to `results` + `status`. Keystrokes never reach it. `commitResults` (with `requestId` guard against stale responses) triggers the list to re-render once per fetch.
- Each result card uses `useSearchStore(s => s.results?.topMatches[i], shallow)` — adding a card 20 positions down doesn't re-render position 3.
- **URL sync is a side effect subscription at the page level** in inline mode only: `useSearchStore.subscribe(s => s.raw, debounce(updateUrl, 400))` guarded by `mode === 'inline'`. Overlay mode never touches the URL. **This is the fix for today's "URL sync unmounts my input" bug applied at the architecture level.**
- The inline input (on explore) and the overlay input both bind to `raw`, so opening the overlay with pre-filled text is free — no prop drilling, no handoff.

### 2.5 The reconciliation — retriever pluralism + single SQL function

**The tension.** The architect's model requires distinct, pluggable `Retriever` classes (one per retriever kind) so they're A/B-able, testable, and extensible. The performance expert identified that executing three retrievers × three entity types in parallel would fan out to **9 Postgres connections per search request**; at 50 concurrent searches this is 450 connections, blowing past Supabase Pro's 200-connection pooler cap in a cliff-shaped failure mode.

**The reconciliation.** Retrievers remain distinct TypeScript classes with clean contracts, but **they do not issue their own database calls**. The orchestrator calls `runUnifiedRetrieval(annotatedQuery, ctx)`, which executes a single SQL function `search_unified(p_portal_id, p_query, p_types, p_filters, ...)` that runs all retrievers as CTEs inside one Postgres connection and returns tagged rows. The orchestrator demultiplexes the result into `Map<RetrieverId, Candidate[]>` and hands each retriever its own slice.

```typescript
// web/lib/search/unified-retrieval.ts
export interface UnifiedRetrievalResult {
  fts: Candidate[];
  trigram: Candidate[];
  structured: Candidate[];
}

export async function runUnifiedRetrieval(
  q: AnnotatedQuery,
  ctx: RetrieverContext
): Promise<UnifiedRetrievalResult> {
  const client = createServiceClient();
  const { data, error } = await client.rpc('search_unified', {
    p_portal_id: ctx.portal_id,              // REQUIRED, enforced in SQL
    p_query: q.normalized,
    p_types: ['event', 'venue', 'organizer'],
    p_categories: q.structured_filters.categories ?? null,
    p_neighborhoods: q.structured_filters.neighborhoods ?? null,
    p_date_from: q.temporal?.start ?? null,
    p_date_to: q.temporal?.end ?? null,
    p_free_only: q.structured_filters.price?.free ?? false,
    p_limit_per_retriever: ctx.limit,
  });
  if (error) throw new Error(`search_unified failed: ${error.message}`);

  // Demultiplex tagged rows into per-retriever candidate sets
  const result: UnifiedRetrievalResult = { fts: [], trigram: [], structured: [] };
  for (const row of data ?? []) {
    const candidate = toCandidateFromRow(row);
    result[row.retriever_id as RetrieverId].push(candidate);
  }
  return result;
}
```

```typescript
// web/lib/search/retrievers/fts.ts
export class FtsRetriever implements Retriever {
  readonly id = 'fts' as const;

  // Retriever reads from a pre-computed unified result, not the database.
  constructor(private readonly source: UnifiedRetrievalResult) {}

  async retrieve(q: AnnotatedQuery, ctx: RetrieverContext): Promise<Candidate[]> {
    // Any retriever-specific post-processing happens here (filtering,
    // trimming, raw-score adjustments). Execution is shared; interpretation
    // is per-retriever.
    return this.source.fts;
  }
}
```

**What each layer owns:**
- **SQL function:** portal isolation, top-k per retriever (fan-out via CTEs), time/status filters, returns compact rows (id, type, retriever_id, raw_score, quality, days_out, + minimal display fields).
- **Retriever class:** interprets the unified result for its slice, applies retriever-specific post-processing if any, enforces the `Retriever` contract.
- **Ranker:** fuses all candidate sets via RRF (Reciprocal Rank Fusion, k=60 — the canonical Cormack 2009 constant).
- **Presenter:** grouping, top-matches selection, MMR diversity pass.

**What this preserves:**
- TypeScript abstraction is clean. Each retriever is testable in isolation with a mocked `UnifiedRetrievalResult`.
- A/B-able rankers — the ranker contract is unchanged. Swap `RrfRanker` for `HybridRanker` (Phase 2 vector-augmented) without touching retrievers.
- Future extensibility: adding `VectorRetriever` in Phase 2 is (a) add a CTE to the SQL function, (b) add the demultiplex branch, (c) register the retriever. No changes to the orchestrator or ranker.

**What this fixes:**
- Connection cost per search: **1**, not 9.
- Pool exhaustion collapses from cliff-shaped to linear degradation.
- Cross-CTE query plan optimization: Postgres can share hash tables across CTEs, dramatically cheaper than 9 separate queries.
- Single point of `p_portal_id NOT NULL` enforcement.

**What this costs:**
- The SQL function is longer (~150-200 lines of CTEs for Phase 1). It's still auditable, still enforces isolation, still testable via pgTAP, still one contract. Complexity belongs in Postgres — that's where the query planner can optimize it.
- Adding a new retriever requires a schema migration (new CTE). Acceptable — retrievers are added rarely and require coordinated design work.

### 2.6 Component tree (UI)

```
UnifiedSearchShell (mode: "inline" | "overlay")
├─ SearchInput            # the text input, clear button, launcher affordance
├─ PresearchBody          # shown when query is empty, adaptive per mode
│  ├─ RecentSearches
│  ├─ QuickIntents        # static pills from lib/search/presearch-config.ts
│  ├─ BrowseByCategory    # overlay mode only, static grid
│  └─ BrowseByNeighborhood # overlay mode only, portal-scoped static list
├─ ResultsBody            # shown when query.length >= 2
│  ├─ TopMatchesStrip     # 6 cards desktop (horizontal), 3 cards mobile (vertical)
│  ├─ GroupedResultSection × N  # Events · 15, Places · 2, ...
│  ├─ DidYouMeanChip      # Phase 1
│  ├─ LaneSuggestionStrip # "See all music events in the Shows lane"
│  └─ EmptyState          # zero results, network error, etc.
└─ LoadingState           # shimmer skeletons (never a spinner)
```

**Inline mode** (explore hero): rendered as a static page section. No backdrop, no close button, no portal. URL sync active (debounced via store subscription).

**Overlay mode** (launcher from any other surface): portaled to `#search-portal` (stable root, mounted once in root layout — not `document.body` on each open). Backdrop with solid `rgba(11,13,15,0.92)` — no `backdrop-filter` per cinematic-minimalism and INP concerns. Body scroll locked via `overflow: hidden` + fixed positioning (NOT `preventDefault` on touchmove — kills INP on iOS). Return focus to trigger on close. URL **never** touched in overlay mode.

**Separate `LaneFilterInput` component** (~50 lines) for per-lane filter bars in EventsFinder and PlaceFilterBar. No dependency on the unified-search stack. Debounced input that writes `?search=...` to URL; the lane's existing timeline fetcher reads the URL param. This is the Q8 split decision — lane filters and unified discovery are genuinely different user tasks.

---

## Part 3 — Security

> **Schema reality note (added 2026-04-13 post-midpoint review):**
> The SQL example in §3.2 below was written before the data coverage audit
> surfaced the actual column names in the events/places schema. The real
> schema uses `events.portal_id` (not `owner_portal_id`), `events.place_id`
> (not `venue_id`), `events.category_id TEXT` (not an FK), `events.start_date DATE`
> (not `starts_at timestamptz`), and **the table is `places` — `venues` was
> renamed**. Places has no `portal_id` — portal isolation for place search is
> enforced via a `portal_venues` CTE that scopes places to those referenced by
> the current portal's active events.
>
> **The canonical, committed implementation** is in
> `database/migrations/20260413000008_search_unified_hardening.sql` (Sprint A).
> Use that file as the source of truth for column names, return shape, and
> portal scoping logic. The §3.2 example below remains useful for
> illustrating the *pattern* (single SQL function, CTEs, portal isolation)
> but do not copy its specific column names into new code.

### 3.1 Input validation (Zod schema)

```typescript
// web/lib/search/input-schema.ts
import { z } from "zod";

export const SearchEntityType = z.enum([
  "event", "venue", "organizer", "series", "festival", "exhibition", "program", "neighborhood"
]);

const FacetSlug = z.string().min(1).max(32).regex(/^[a-z0-9_]+$/);

export const SearchDateWindow = z.enum(["today", "tomorrow", "weekend", "week"]);

export const SearchInputSchema = z.object({
  q: z.string().min(1).max(120),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).max(500).default(0),  // beyond 500 requires cursor
  types: z.array(SearchEntityType).max(8).optional(),
  categories: z.array(FacetSlug).max(20).optional(),
  neighborhoods: z.array(FacetSlug).max(20).optional(),
  tags: z.array(FacetSlug).max(20).optional(),
  date: SearchDateWindow.nullable().optional(),
  free: z.coerce.boolean().optional(),
  price: z.coerce.number().int().min(1).max(4).nullable().optional(),
  cursor: z.string().max(256).optional(),
  locale: z.string().regex(/^[a-z]{2}(-[A-Z]{2})?$/).max(5).optional(),
  debug: z.coerce.boolean().optional(),      // dev users only — stripped at handler
});

export type SearchInput = z.infer<typeof SearchInputSchema>;
```

```typescript
// web/lib/search/normalize.ts
const CONTROL_CHARS = /[\u0000-\u001F\u007F-\u009F\u2028\u2029]/g;
const ZERO_WIDTH = /[\u200B-\u200D\uFEFF]/g;
const MULTI_SPACE = /\s+/g;

export function normalizeSearchQuery(raw: string): string {
  return raw
    .normalize("NFKC")              // unicode canonicalization
    .replace(CONTROL_CHARS, " ")    // strip control chars
    .replace(ZERO_WIDTH, "")        // strip zero-width + BOM (homograph defense)
    .replace(MULTI_SPACE, " ")
    .trim()
    .slice(0, 120);                 // hard clamp after normalization (NFKC can expand length)
}
```

**Critically: `portal_id` is NOT a query parameter.** It is derived server-side from the route segment:

```typescript
// Route handler: app/[portal]/api/search/unified/route.ts
const resolved = await resolvePortalRequest({
  slug: params.portal,
  headersList: await headers()
});
if (!resolved) return NextResponse.json({ error: "Not found" }, { status: 404 });
const portalId = resolved.portal.id;  // uuid — the only trusted source
```

### 3.2 Portal isolation enforcement

Every search RPC (including `search_unified`) must satisfy:

1. Take `p_portal_id uuid NOT NULL` as the first parameter.
2. Apply `WHERE owner_portal_id = p_portal_id` inside the function body — not in a view, not at the caller.
3. Be `SECURITY INVOKER` (default) or `SECURITY DEFINER` with `SET search_path = public, pg_temp` lockdown.
4. Never accept a portal slug — UUID only.

```sql
CREATE OR REPLACE FUNCTION public.search_unified(
  p_portal_id           uuid,        -- REQUIRED, NOT NULL
  p_query               text,
  p_types               text[],
  p_categories          text[] DEFAULT NULL,
  p_neighborhoods       text[] DEFAULT NULL,
  p_date_from           timestamptz DEFAULT NULL,
  p_date_to             timestamptz DEFAULT NULL,
  p_free_only           boolean DEFAULT false,
  p_limit_per_retriever int DEFAULT 30
)
RETURNS TABLE (
  retriever_id text, entity_type text, id uuid, raw_score real,
  quality real, days_out int, title text, venue_name text, starts_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  WITH q AS (
    SELECT
      websearch_to_tsquery('simple', p_query) AS fts_q,
      p_query                                  AS raw_q
  ),
  fts_events AS (
    SELECT 'fts'::text AS retriever_id, 'event'::text AS entity_type,
      e.id, ts_rank_cd(e.search_vector, q.fts_q)::real AS raw_score,
      e.quality_score AS quality,
      GREATEST(0, EXTRACT(EPOCH FROM (e.starts_at - now())) / 86400)::int AS days_out,
      e.title, e.venue_name, e.starts_at
    FROM public.events e, q
    WHERE e.owner_portal_id = p_portal_id
      AND 'event' = ANY(p_types)
      AND e.status = 'published'
      AND e.search_vector @@ q.fts_q
      AND (p_date_from IS NULL OR e.starts_at >= p_date_from)
      AND (p_date_to   IS NULL OR e.starts_at <  p_date_to)
      AND (p_categories IS NULL OR e.category_slug = ANY(p_categories))
      AND (NOT p_free_only OR e.is_free IS TRUE)
    ORDER BY raw_score DESC
    LIMIT LEAST(p_limit_per_retriever, 80)
  ),
  trgm_events AS (
    SELECT 'trigram'::text, 'event'::text, e.id,
      GREATEST(similarity(e.title, q.raw_q), similarity(COALESCE(e.venue_name, ''), q.raw_q) * 0.8)::real,
      e.quality_score,
      GREATEST(0, EXTRACT(EPOCH FROM (e.starts_at - now())) / 86400)::int,
      e.title, e.venue_name, e.starts_at
    FROM public.events e, q
    WHERE e.owner_portal_id = p_portal_id
      AND 'event' = ANY(p_types)
      AND e.status = 'published'
      AND (e.title % q.raw_q OR e.venue_name % q.raw_q)
      AND (p_date_from IS NULL OR e.starts_at >= p_date_from)
      AND (p_date_to   IS NULL OR e.starts_at <  p_date_to)
    ORDER BY raw_score DESC
    LIMIT LEAST(p_limit_per_retriever, 80)
  )
  -- Additional CTEs: structured_events, fts_venues, trgm_venues, fts_organizers, ...
  -- Pattern repeats per entity type × retriever. All enforce p_portal_id.
  SELECT * FROM fts_events
  UNION ALL SELECT * FROM trgm_events
  -- UNION ALL SELECT * FROM structured_events
  -- UNION ALL SELECT * FROM fts_venues ...
  ;
$$;

REVOKE ALL ON FUNCTION public.search_unified(uuid, text, text[], text[], text[], timestamptz, timestamptz, boolean, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_unified TO authenticated, anon, service_role;
```

**pgTAP test** (regression gate for portal isolation):

```sql
BEGIN;
SELECT plan(4);

-- Two portals with one event each
INSERT INTO portals (id, slug, name) VALUES
  ('11111111-1111-1111-1111-111111111111', 'atl-test', 'ATL'),
  ('22222222-2222-2222-2222-222222222222', 'nyc-test', 'NYC');

INSERT INTO events (owner_portal_id, title, status, starts_at, search_vector)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'Atlanta jazz night', 'published',
   now() + interval '1 day', to_tsvector('simple', 'atlanta jazz night')),
  ('22222222-2222-2222-2222-222222222222', 'NYC jazz night', 'published',
   now() + interval '1 day', to_tsvector('simple', 'nyc jazz night'));

SELECT ok(
  (SELECT count(*) FROM search_unified(
    '11111111-1111-1111-1111-111111111111'::uuid, 'jazz', ARRAY['event']
  ) WHERE retriever_id = 'fts') >= 1,
  'atlanta search returns atlanta event'
);

SELECT ok(
  (SELECT count(*) FROM search_unified(
    '11111111-1111-1111-1111-111111111111'::uuid, 'jazz', ARRAY['event']
  ) WHERE title LIKE 'NYC%') = 0,
  'atlanta search does not leak NYC rows'
);

SELECT ok(
  (SELECT count(*) FROM search_unified(
    '00000000-0000-0000-0000-000000000000'::uuid, 'jazz', ARRAY['event']
  )) = 0,
  'unknown portal returns 0 rows'
);

SELECT throws_ok(
  $$ SELECT * FROM search_unified(NULL::uuid, 'jazz', ARRAY['event']) $$,
  NULL,
  'null portal id is rejected'
);

SELECT * FROM finish();
ROLLBACK;
```

### 3.3 Cache strategy — split endpoints

**Decision: Option B (two endpoints).** The public `/api/search/unified` returns deterministic, portal-scoped, cacheable data. A separate `/api/search/unified/personalize` returns user-specific hydration (saved/RSVP chip state) with `private, no-store`. This lets the edge cache the hot path while personalization is a tiny no-store round-trip after the skeleton paints. Option A (`no-store` when authed) would tank cache hit rate on ~40-60% of traffic.

```typescript
// Public endpoint headers
function buildPublicCacheHeaders(input: SearchInput): Record<string, string> {
  const isTimeSensitive = input.date === "today" || input.date === "tomorrow";
  const sMaxAge = isTimeSensitive ? 15 : 30;
  const swr     = isTimeSensitive ? 30 : 120;
  return {
    "Cache-Control": `public, s-maxage=${sMaxAge}, stale-while-revalidate=${swr}`,
    "Vary": "Accept-Language, Accept-Encoding",
  };
}

// Personalize endpoint headers
const personalizeHeaders = {
  "Cache-Control": "private, no-store, must-revalidate",
};
```

**Server-side cache key (Redis):**

```
search:v1:{portalSlug}:{locale}:{timeBucket}:{segment}:{sha256(annotatedFingerprint)}
```

- `v1` — schema version, bump to mass-invalidate
- `portalSlug` — hard isolation
- `segment` — `anon` | `authed` (NOT user_id)
- `timeBucket` — 60s for `today`/`tomorrow`, 5min for undated, 15min for `weekend`, daily for `week` and evergreen

```typescript
function buildCacheKey(portalSlug: string, annotated: AnnotatedQuery, segment: 'anon' | 'authed'): string {
  // Locale is reserved for future i18n; Phase 0 hardcodes 'en'. The key format
  // includes locale so future localized content can invalidate without a v-bump.
  const locale = 'en';
  const bucket = buildTimeBucket(annotated);
  return `search:v1:${portalSlug}:${locale}:${bucket}:${segment}:${annotated.fingerprint}`;
}
```

### 3.4 Rate limiting — layered

Additions to `web/lib/rate-limit.ts`:

```typescript
// Phase 1 presets (Phase 0 uses existing RATE_LIMITS.read as a baseline)
search_anon:            { limit: 30, windowSec: 60 },  // per-IP unauthenticated
search_authed:          { limit: 60, windowSec: 60 },  // per-user authenticated
search_expensive:       { limit: 15, windowSec: 60 },  // per-IP+user for expensive paths (future)
search_daily_embedding: { limit: 500, windowSec: 86400 }, // per-user/day (Phase 2+)
```

Route handler composition (using existing `withOptionalAuth` from `lib/api-middleware.ts:301`):

```typescript
export const GET = withOptionalAuth(async (request, { user }, { params }) => {
  // Layer 1: per-IP baseline
  const ip = getClientIdentifier(request);
  const anonLimit = await applyRateLimit(request, RATE_LIMITS.search_anon, ip);
  if (anonLimit) return anonLimit;

  // Layer 2: per-user lift for authed
  if (user) {
    const userLimit = await applyRateLimit(request, RATE_LIMITS.search_authed, `user:${user.id}`);
    if (userLimit) return userLimit;
  }

  // Resolve portal from ROUTE, never query
  const resolved = await resolvePortalRequest({ slug: params.portal, headersList: await headers() });
  if (!resolved) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const portalId = resolved.portal.id;
  const portalSlug = resolved.portal.slug;

  // Parse + normalize
  const input = parseSearchInput(request.nextUrl.searchParams);

  // ... run search service
});
```

### 3.5 Recent searches endpoint

```typescript
// web/app/api/user/recent-searches/route.ts
// POST (insert) and DELETE (remove or clear) only. No GET.

const RecentSearchInsertSchema = z.object({
  query: z.string().min(1).max(120),
  filters: z.object({ /* ... */ }).optional(),
});

const RecentSearchDeleteSchema = z.object({
  id: z.string().uuid().optional(),
  clearAll: z.boolean().optional(),
}).refine((v) => Boolean(v.id) !== Boolean(v.clearAll));

// Origin header check — CSRF defense for SameSite=Lax
function isAllowedOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try { return new URL(origin).host === request.nextUrl.host; } catch { return false; }
}

export const POST = withAuth(async (request, { user, serviceClient }) => {
  if (!isAllowedOrigin(request)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const rl = await applyRateLimit(request, RATE_LIMITS.write, `user:${user.id}`);
  if (rl) return rl;

  const body = RecentSearchInsertSchema.parse(await request.json());
  const normalized = normalizeSearchQuery(body.query);

  // Atomic insert + rotation via RPC
  const { error } = await serviceClient.rpc("insert_recent_search", {
    p_user_id: user.id,
    p_query: normalized,
    p_filters: body.filters ?? null,
    p_max_rows: 50,
  } as never);
  if (error) return NextResponse.json({ error: "insert_failed" }, { status: 500 });
  return NextResponse.json({ ok: true });
});
```

**Schema:**

```sql
CREATE TABLE public.user_recent_searches (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  query      text NOT NULL CHECK (char_length(query) BETWEEN 1 AND 120),
  filters    jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_user_recent_searches_user_created
  ON public.user_recent_searches (user_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.insert_recent_search(
  p_user_id uuid, p_query text, p_filters jsonb, p_max_rows int
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  INSERT INTO public.user_recent_searches (user_id, query, filters)
  VALUES (p_user_id, p_query, p_filters);

  DELETE FROM public.user_recent_searches
  WHERE user_id = p_user_id
    AND id NOT IN (
      SELECT id FROM public.user_recent_searches
      WHERE user_id = p_user_id
      ORDER BY created_at DESC
      LIMIT p_max_rows
    );
END $$;
```

**GDPR cascade:** `ON DELETE CASCADE` on the FK means account deletion automatically wipes all recent searches. No application code required.

### 3.6 Query logging — `search_events`

**Critical policy: `user_id` is NOT logged.** Only `user_segment` ('anon' | 'authed'). Justification: logging user_id gives marginal Phase 1 value (no personalized ranker to train), adds a real GDPR erasure cascade, insider-threat surface, and breach blast radius. Since hidden personalization is cut, there is no ranker that needs per-user training signal. Revisit in Phase 2 if and only if personalized ranking is reintroduced (and then log against a rotating opaque `user_signal_id` severable from `profiles.id`).

```sql
CREATE TABLE public.search_events (
  id                     uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at            timestamptz NOT NULL DEFAULT now(),
  portal_slug            text        NOT NULL,
  locale                 text        NOT NULL DEFAULT 'en',
  user_segment           text        NOT NULL CHECK (user_segment IN ('anon', 'authed')),
  query_hash             bytea       NOT NULL,  -- sha256(normalized_q || daily_salt || portal_slug)
  query_length           int         NOT NULL,
  query_word_count       int         NOT NULL,
  intent_type            text,
  filters_json           jsonb       NOT NULL DEFAULT '{}'::jsonb,
  cache_hit              text        NOT NULL CHECK (cache_hit IN ('fresh','stale','miss')),
  degraded               boolean     NOT NULL DEFAULT false,
  retriever_breakdown    jsonb       NOT NULL,  -- { fts_ms, fts_count, trgm_ms, trgm_count, ... }
  result_count           int         NOT NULL,
  result_type_counts     jsonb       NOT NULL,  -- { event: 12, venue: 4 }
  top_matches_types      text[]      NOT NULL,
  zero_result            boolean     NOT NULL,
  total_ms               int         NOT NULL
);

CREATE INDEX ix_search_events_portal_time ON public.search_events (portal_slug, occurred_at DESC);
CREATE INDEX ix_search_events_hash ON public.search_events (query_hash);
CREATE INDEX ix_search_events_zero_result ON public.search_events (portal_slug, occurred_at DESC)
  WHERE zero_result = true;

-- Click events are a separate table (many clicks can follow one search)
CREATE TABLE public.search_click_events (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  search_event_id   uuid        NOT NULL REFERENCES search_events(id) ON DELETE CASCADE,
  clicked_at        timestamptz NOT NULL DEFAULT now(),
  position          smallint    NOT NULL,
  result_type       text        NOT NULL,
  result_id         text        NOT NULL,
  primary_retriever text        NOT NULL,
  conversion_type   text        CHECK (conversion_type IN ('click','save','rsvp','plan')),
  dwell_ms          integer
);
```

**Daily salt rotation:**

```sql
CREATE TABLE public.search_log_salt (
  day  date PRIMARY KEY,
  salt bytea NOT NULL
);
-- Populated by a cron job at 00:05 UTC; old rows retained for 2 days
-- so late-arriving click events can still join.
```

**Retention:** 30 days hot + daily rollup materialized view for ranking tuning. Partition `search_events` by day via `pg_partman` — makes retention a DROP TABLE, not a DELETE.

**Async write:** use `after` from `next/server` (Next 16 stable) so logging never blocks the response:

```typescript
import { after } from 'next/server';

export const GET = withOptionalAuth(async (request, { user }, { params }) => {
  // ... compute search ...
  const response = NextResponse.json(body, { headers: cacheHeaders });

  after(async () => {
    try {
      await logSearchEvent({ /* fields */ });
    } catch (err) {
      // log to OTel, never throw
    }
  });

  return response;
});
```

### 3.7 Referrer-Policy

Add to `web/next.config.ts` (or `middleware.ts` if that's where security headers are wired):

```typescript
async headers() {
  return [
    {
      source: "/:path*",
      headers: [
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      ],
    },
  ];
}
```

**Why:** inline-mode search places the query into the URL (`/atlanta/explore?q=drag+brunch`). When a user clicks an outbound link from the results, the browser sends `Referer: https://lostcity.example/atlanta/explore?q=drag+brunch`. Third-party vendors (Eventbrite, DICE, venue analytics) would receive the user's query verbatim. `strict-origin-when-cross-origin` strips path and query from cross-origin navigations, sending only the origin.

### 3.8 STRIDE summary

| Category | Threat | Mitigation |
|---|---|---|
| **S** Spoofing | Attacker forges portal context via `?portal_id=` to read another tenant's data | Portal derived only from route segment via `resolvePortalRequest`; `p_portal_id uuid NOT NULL` enforced inside `search_unified` RPC |
| **T** Tampering | Query params inject into tsquery, ILIKE, or RPC arguments | Zod allowlist schemas + NFKC normalization + server-side `websearch_to_tsquery` construction; no string concat into SQL |
| **R** Repudiation | User denies a sensitive search happened | `search_events` table logs hashed query + portal + timestamp with 30-day retention and rotating daily salt; no user_id |
| **I** Information Disclosure | Cross-portal leakage, cache poisoning of personalized payloads, referrer leakage | Split endpoints (public `s-maxage` vs personalize `no-store`); `Referrer-Policy: strict-origin-when-cross-origin`; hashed query logs |
| **D** Denial of Service | Deep-offset scans, pathological Unicode, cost abuse | `limit ≤ 50`, `offset ≤ 500`, NFKC+control-char normalization, per-IP+per-user rate limits, `SET statement_timeout` on RPCs |
| **E** Elevation of Privilege | Anonymous user reaches expensive paths and pivots into service credentials | Expensive retrievers gated in route handler with explicit `if (!user) return 401`; RPCs `SECURITY INVOKER` with `search_path` lockdown |

### 3.9 Pre-ship security checklist

Each item is grep-able or runnable:

1. **No `portal_id` in search route files.** `rg "portal_id" web/app/**/api/search/` returns zero matches outside RPC call sites (`p_portal_id`).
2. **No `portal_id` read from query params.** `rg "searchParams.*portal_id|searchParams.*portal(?!Slug)" web/app/` is empty.
3. **Every search RPC signature begins with `p_portal_id uuid`.** Manual review of `database/migrations/*search*.sql`.
4. **pgTAP cross-portal leak test passes.** `psql -f database/tests/search_unified.pgtap.sql` shows 4/4.
5. **Zod rejects oversized input.** Vitest: `q.repeat(10_000)` → 400; `limit=999` → 400; `offset=10_000` → 400.
6. **NFKC strips control chars.** Vitest: `"a\u0000b\u200Bc"` → `"abc"`; `"ｊａｚｚ"` → `"jazz"`.
7. **Rate-limit layering active.** Integration test: 31 unauth requests → 429 on #31; 61 authed → 429 on #61.
8. **Personalize endpoint returns `Cache-Control: private, no-store`.** `curl -si .../search/unified/personalize | grep -i cache-control`.
9. **Public endpoint response schema rejects user-specific fields.** Snapshot test: no `savedByMe`, `rsvpStatus`, or `friendsGoing` in the public payload.
10. **`Referrer-Policy: strict-origin-when-cross-origin` present.** `curl -si .../atlanta/explore | grep -i referrer-policy`.

---

## Part 4 — Performance

### 4.1 Honest latency budget

**All numbers include the 100ms client-side debounce.**

**Warm cache hit** (user typing a hot query prefix, cache present):

| Step | p50 ms | p95 ms | p99 ms |
|---|---|---|---|
| Debounce | 100 | 100 | 100 |
| TLS + HTTP (keep-alive) | 8 | 25 | 60 |
| Function invocation (warm) | 2 | 6 | 15 |
| Zod parse + rate limit | 2 | 5 | 12 |
| Query annotate (local, no I/O) | 4 | 10 | 18 |
| Redis GET (Upstash, same region) | 6 | 18 | 45 |
| Serialize + HTTP response | 11 | 33 | 76 |
| React render | 12 | 35 | 80 |
| **Total** | **~145** | **~232** | **~406** |

**Warm cache miss** (lambda warm, Redis miss, full path):

| Step | p50 ms | p95 ms | p99 ms |
|---|---|---|---|
| Debounce | 100 | 100 | 100 |
| Function + parse + annotate | 16 | 46 | 105 |
| Redis GET (miss) | 5 | 15 | 40 |
| Single-flight lock (SET NX) | 4 | 12 | 30 |
| **`search_unified` RPC** (collapsed fan-out) | 55 | 140 | 280 |
| RRF + normalization (Node) | 3 | 8 | 18 |
| Presentation | 2 | 6 | 14 |
| Serialize + HTTP + render | 29 | 86 | 190 |
| **Total** | **~214** | **~413** | **~777** |

**Cold start** (new lambda instance, cold Redis): p50 ~534ms, p95 ~1363ms, p99 ~2610ms. No user-facing SLO; mitigation is warm-up cron.

**Degraded** (Redis timeout, Postgres under load): p50 ~328ms, p95 ~818ms, p99 ~1885ms. Circuit breaker fails open to cache-only with `degraded: true` flag.

**Honest targets:**
- **Warm cache hit:** p50 150ms / p95 230ms / p99 400ms
- **Warm cache miss:** p50 215ms / p95 415ms / p99 780ms
- **Cold start:** no SLO; warmup mitigates
- **Degraded:** graceful, bounded at 800ms via retriever circuit breaker

**Principle 3 in §1.2 references these numbers specifically.** The "150ms first paint" target is a **cache-hit promise**, not a cold-query promise. Documented as such in the principle, not as a marketing number.

### 4.2 Cache strategy — Upstash (already in place)

**Pick: Upstash Redis via existing `lib/shared-cache.ts`.** Already wired up, already in `package.json`. Vercel KV is Upstash under the hood since 2024 — going direct is simpler and cheaper.

**Key schema:** `search:v1:{portalSlug}:{locale}:{timeBucket}:{segment}:{sha256(annotatedFingerprint)}`

**Time buckets by query intent:**

| Intent | Bucket length | Rationale |
|---|---|---|
| `today` / `tonight` / undated | 5 min | Balance freshness vs hit rate |
| `this weekend` | 15 min | Multi-day, less volatile |
| `next week` / date range | 60 min | Stable horizon |
| Evergreen (venue, category-only) | 60 min | Near-static |
| Time-sensitive (today/tomorrow, explicitly) | 60s | Boundary drift cap |

**TTL policy:**
- Hot prefixes (top 50 from warmup cron): TTL 60s, SWR +30s
- Warm (any query that hit cache in last hour): TTL 30s, SWR +15s
- Cold/novel: TTL 15s, SWR +10s
- Zero-result: TTL 120s (cheap, commonly retried)

**Phase 0 uses existing `lib/shared-cache.ts` with its current TTL.** Phase 1 adds single-flight wrapper and tuned TTL policy.

### 4.3 Single-flight stampede protection

**Within-lambda (per-request dedup)** via `AsyncLocalStorage`:

```typescript
// web/lib/search/request-context.ts
import { AsyncLocalStorage } from 'node:async_hooks';

type RequestCtx = { inflight: Map<string, Promise<unknown>> };
export const als = new AsyncLocalStorage<RequestCtx>();

export function dedup<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const ctx = als.getStore();
  if (!ctx) return fn();
  const existing = ctx.inflight.get(key) as Promise<T> | undefined;
  if (existing) return existing;
  const p = fn().finally(() => ctx.inflight.delete(key));
  ctx.inflight.set(key, p);
  return p;
}
```

**Cross-lambda** via Redis `SET NX` lock:

```typescript
async function singleFlightCompute<T>(
  key: string, lockKey: string, ttlSec: number, loader: () => Promise<T>
): Promise<T> {
  const lockId = crypto.randomUUID();
  const acquired = await redis.set(lockKey, lockId, { nx: true, ex: 2 });

  if (acquired === 'OK') {
    try {
      const value = await loader();
      after(async () => {
        await redis.set(key, { value, cachedAt: Date.now() }, { ex: ttlSec + 30 });
        await redis.del(lockKey);
      });
      return value;
    } catch (err) {
      await redis.del(lockKey).catch(() => {});
      throw err;
    }
  }

  // Lost the race — poll for cache, bounded at 400ms
  const deadline = Date.now() + 400;
  let delay = 25;
  while (Date.now() < deadline) {
    await sleep(delay);
    const cached = await redis.get(key);
    if (cached) return cached.value;
    delay = Math.min(delay * 1.6, 120);
  }

  // Fallback: compute locally (better a duplicate DB hit than a 500)
  return loader();
}
```

### 4.4 Observability stack

**Phase 0:** `search_events` table (§3.6). Populated async via `after()`. Basic columns cover latency, cache hit, retriever breakdown, zero-result, result counts. Enough to answer "is it working" and "where's the data gap" questions.

**Phase 1:** `@vercel/otel` + Axiom exporter. Span hierarchy:

```
search.request                              (root, http span)
├─ search.annotate
├─ search.cache.get                         (cache_hit: fresh|stale|miss)
├─ search.single_flight                     (lock_acquired, lock_wait_ms)
│  └─ search.compute
│     ├─ search.retriever.unified           (duration, total_candidates)
│     ├─ search.rank.rrf                    (input_count, output_count)
│     └─ search.present                     (group_count, top_matches_count, zero_result)
├─ search.cache.set                         (waitUntil, detached)
└─ search.log.write                         (waitUntil, detached)
```

**Server-Timing header** (Phase 1):

```
server-timing: annotate;dur=4, cache;dur=3, retrieve;dur=55, rank;dur=3, present;dur=2, total;dur=67
```

**Client RUM** (Phase 1): `web-vitals` v4 reporting overlay-open INP/LCP. Custom metric `inp_overlay_p95_ms` targeting <200ms.

**Custom metrics (Phase 1, Axiom dataset `search_metrics`):**

| Metric | Dimensions | Target / alarm |
|---|---|---|
| `search.cache.hit_rate` | portal, segment, bucket_type | — |
| `search.retriever.duration_p95_ms` | portal, retriever | alarm > 400 for 2min |
| `search.zero_result_rate` | portal, intent, query_length | target < 8% |
| `search.ctr_by_position` | portal, position, result_type | — |
| `search.conversion_rate` | portal, intent | target ≥ feed rate |
| `search.single_flight.fallback_rate` | portal | alarm > 0.5% |
| `search.degraded_rate` | portal, reason | alarm > 1% |
| `search.lambda.cold_start_rate` | portal | alarm > 2% |
| `search.inp_overlay_p95_ms` | portal, route | target < 200 |

### 4.5 Hybrid ranking — Reciprocal Rank Fusion

**RRF (k=60, canonical Cormack 2009) is the default ranker.** Scale-invariant: only cares about ranks within each retriever, so you can add or remove retrievers without retuning weights. Z-score normalization is a soft tiebreaker, available but not required for Phase 1.

```typescript
// web/lib/search/ranking/rrf.ts
function rrf(ranked: Candidate[][], k = 60): Map<string, number> {
  const scores = new Map<string, number>();
  for (const list of ranked) {
    list.forEach((c, i) => {
      scores.set(c.id, (scores.get(c.id) ?? 0) + 1 / (k + i + 1));
    });
  }
  return scores;
}

function zNormalize(list: Candidate[]): Map<string, number> {
  if (list.length === 0) return new Map();
  const scores = list.map(c => c.raw_score);
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  const variance = scores.reduce((a, b) => a + (b - mean) ** 2, 0) / scores.length;
  const std = Math.sqrt(variance) || 1;
  return new Map(list.map(c => {
    const z = Math.max(-3, Math.min(3, (c.raw_score - mean) / std));
    return [c.id, (z + 3) / 6];  // map to [0, 1]
  }));
}

export function fuse(
  sets: Map<RetrieverId, Candidate[]>,
  opts: { freshnessHalfLifeDays: number } = { freshnessHalfLifeDays: 14 }
): RankedCandidate[] {
  // Sort each retriever by raw score
  const lists = Array.from(sets.values()).map(list => list.slice().sort((a, b) => b.raw_score - a.raw_score));

  const rrfScores = rrf(lists);

  // Union of all candidates
  const all = new Map<string, Candidate>();
  lists.flat().forEach(c => all.set(c.id, c));

  const now = Date.now();
  const scored: RankedCandidate[] = [...all.values()].map(c => {
    const rrfS = rrfScores.get(c.id) ?? 0;
    const quality = (c.payload.quality as number | undefined) ?? 0.5;
    const daysOut = (c.payload.days_out as number | undefined) ?? null;
    const freshness = daysOut === null
      ? 0.5
      : Math.exp(-Math.max(0, daysOut) / opts.freshnessHalfLifeDays);

    // RRF dominates; quality + freshness are soft tiebreakers
    const final =
      0.75 * (rrfS * 10)        // rrf scaled
      + 0.15 * quality
      + 0.10 * freshness;

    return { ...c, final_score: final, contributing_retrievers: [], rank: 0 };
  });

  scored.sort((a, b) => b.final_score - a.final_score);
  scored.forEach((c, i) => { c.rank = i; });
  return scored;
}
```

**Phase 1 ships pure RRF.** Z-score weighting is available in the code but toggled off by default. A/B tests add it only if ranking data shows gains.

### 4.6 Warm-up cron (Phase 1)

Vercel Cron, every 60 seconds, prefetches top 50 queries per portal from `search_events`. Route at `app/api/cron/search-warmup/route.ts`, authenticated via `CRON_SECRET`. Estimated cost at launch scale: ~$35/mo.

**Not Phase 0.** Phase 0 uses best-effort lambda warmth; Phase 1 adds the cron after load testing validates the cost/benefit.

### 4.7 The #1 performance risk — pool exhaustion

**Already mitigated by the retriever reconciliation (§2.5).** The single `search_unified` SQL function collapses per-search connections from 9 to 1. This was the highest-severity risk in the performance review, and it's addressed architecturally rather than as layered defense.

**Additional defense in depth:**
- Per-request connection budget: semaphore capping concurrent retriever execution at 3 (currently unused because the unified function internalizes the fan-out, but preserved for future vector retriever addition).
- Circuit breaker: fail open to cache-only with `degraded: true` flag when `pg_stat_activity` crosses 90% of pool cap.
- Pool isolation: dedicated Supabase pooler for search traffic, separate from writes and other reads (Phase 1).
- Load test at 2x expected peak in staging using `k6` with realistic query distribution from `search_events` dev data (pre-ship gate for Phase 1).

---

## Part 5 — User Experience

### 5.1 Card anatomy per entity type

**Shared constraints:**
- **Top Matches strip** (desktop): all entity cards are 280×84px, `rounded-card`, identical outer shell so types interleave cleanly.
- **Top Matches strip** (mobile, 375px): vertical stack, max 3 items — NOT horizontal scroll.
- **Grouped-section rows:** type-specific density, 72px min-height.
- All cards: `bg-[var(--night)] border border-[var(--twilight)]/50 rounded-card`.
- Focus: `.focus-ring` (coral outline, offset 2px).
- Hover: `hover:bg-[var(--dusk)] hover:border-[var(--twilight)]`. No `translateY` — dropdown items don't pop.
- Motion: fade + slide per §5.2.

**Event card (Top Matches, 280×84):**
```
┌──────────┬───────────────────────────────────┐
│ image    │ [CATEGORY chip] · time/date chip   │
│ 64×64    │ title — text-sm font-semibold cream │
│ rounded- │ venue · neighborhood — text-xs      │
│ md       │                [Free?] [Saved ♥?]  │
└──────────┴───────────────────────────────────┘
```
- Image fallback: `color-mix(in srgb, catColor 15%, var(--night))` + `CategoryIcon` size 20
- Title: `text-sm font-semibold text-[var(--cream)]`, 2 lines max, `line-clamp-2`
- Meta line 1: category label (`font-mono text-2xs font-bold uppercase` in catColor) · smart date/time (`text-2xs text-[var(--muted)]`)
- Meta line 2: venue · neighborhood, `text-xs text-[var(--muted)] truncate`
- Chips: `<Badge variant="success">Free</Badge>` (`--neon-green`); saved state: coral bookmark (`PhBookmarkSimple`, filled)

**Venue card:** `PLACE` label in `--coral`; meta line neighborhood · category; "Open Now" chip if hours present and currently open. No saved chip in search results (saved state is for events/series only).

**Organizer card:** avatar 40×40 `rounded-full`, initials fallback on `--twilight`. No image slot behind text. `ORG` label. Meta: category · "N upcoming events" (hide if 0).

**Series card:** `SERIES` chip in `--gold`. Recurrence label "Weekly · Thursdays" from `series.recurrence_text`. Next occurrence chip. Saved state (coral bookmark).

**Festival card:** `FESTIVAL` chip in `--gold`. Date range "Apr 18–20". Multi-day chip if duration > 1 day. Image mandatory (no-image hero fallback pattern from `HeroCard`).

**Exhibition card:** `EXHIBITION` chip in `--vibe` (`#A78BFA`). Close-urgency copy: "Closes in 3 days" in `--coral` if end_date within 7 days, else "Through Apr 20" in `--muted`. **Phase P4 dependency — exclude from search scope until P4 ships.**

**Program/class card:** icon box fallback on `--neon-green/15` bg. Age range "Ages 6–12" in `text-2xs text-[var(--soft)]`. Enrollment chip if registration open.

**Neighborhood card:** no image slot (neighborhoods don't have photos). `NEIGHBORHOOD` chip in `--soft`. "N events this week · N venues". "Browse →" inline link in `--coral`.

**Category/tag card:** icon box 40×40 with `CategoryIcon`. `TAG` chip in `--muted`. "N events · N venues" count (hide if zero). Capped at 4 items max in grouped section — categories are browsing shortcuts, not primary targets.

**Grouped-section variants:** full-width, slightly denser. Event grouped variant is identical to existing `StandardRow.tsx`.

### 5.2 Motion spec

Cinematic minimalism — no bounce, no overshoot. CSS custom properties:
```css
--search-duration-fast: 60ms;
--search-duration-base: 120ms;
--search-duration-slow: 200ms;
```
Easings: `ease-out`, `ease-in`, `cubic-bezier(0.16, 1, 0.3, 1)` (fast-out-slow-in).

| Trigger | Element | Property | Duration | Easing | Stagger |
|---|---|---|---|---|---|
| Overlay open | Backdrop | `opacity` 0→1 | 120ms | `ease-out` | — |
| Overlay open | Shell panel | `opacity`, `translateY` 8→0 | 200ms | `cubic-bezier(.16,1,.3,1)` | 30ms after backdrop |
| Overlay open | Input | `opacity` 0→1 | 60ms | `ease-out` | 80ms after panel |
| Overlay close | Backdrop + shell | `opacity` 1→0 | 120ms | `ease-in` | simultaneous |
| Presearch → results | Presearch | `opacity`, `translateY` 0→-4 | 80ms | `ease-in` | — |
| Presearch → results | Results | `opacity`, `translateY` 4→0 | 120ms | `ease-out` | 40ms after presearch starts |
| Results → presearch (clear) | Results | `opacity` 1→0 | 80ms | `ease-in` | — |
| Results → presearch (clear) | Presearch | `opacity`, `translateY` -4→0 | 120ms | `ease-out` | 40ms delay |
| New result cards | Each card | `opacity`, `translateY` 6→0 | 120ms | `ease-out` | 20ms per card, max 8 staggered |
| Hover card | Background | color shift | 80ms | `ease-out` | — |
| Focus card (keyboard) | Border + bg | `--coral/30` border, `--twilight` bg | 60ms | `ease-out` | — |
| Selected card (keyboard) | Card | `translateX` 0→2 | 60ms | `ease-out` | — |
| Did-you-mean chip | Chip | `opacity`, `translateY` -4→0 | 150ms | `ease-out` | — |
| Empty state | Container | `opacity` 0→1 | 200ms | `ease-out` | 100ms delay |
| Error state | Container | `opacity` 0→1 | 150ms | `ease-out` | — |
| Loading skeleton | Cards | `opacity` 0→1 | 100ms | `ease-out` | 15ms per row |

**Reduced motion:**
```css
@media (prefers-reduced-motion: reduce) {
  .search-card-enter { animation: none; opacity: 1; transform: none; }
  .search-overlay-panel { transition: opacity 60ms ease-out; transform: none; }
}
```

### 5.3 Presearch content

**What's cut:** "Popular now", "Trending", "Because you saved X", any algorithmic ranking signal. Contradicts `docs/decisions/2026-02-21-feed-philosophy.md`. Visible state on cards the user already touched is the only personalization.

**Inline mode (explore hero):** minimal — page carries the browse load.

```
┌────────────────────────────────────────────┐
│ [Recent searches — max 3, if any]          │
│  ClockIcon · "Jazz at Variety Playhouse" × │
│  ClockIcon · "Free events this weekend"  × │
├────────────────────────────────────────────┤
│ [Quick Intents — static pills]             │
│  Tonight  Free  Brunch  Live Music  Week   │
└────────────────────────────────────────────┘
```

**Overlay mode:** rich because nothing else is on screen. Still no algorithmic curation.

```
┌────────────────────────────────────────────┐
│ RECENT  [Clear all]                        │
│  ClockIcon · "Jazz at Variety Playhouse" × │
│  ClockIcon · "Cabbagetown"               × │
│  ClockIcon · "Free events this weekend"  × │
├────────────────────────────────────────────┤
│ BROWSE BY CATEGORY                         │
│  [Music] [Comedy] [Food] [Art]             │
│  [Nightlife] [Sports] [Film] [Family]      │
├────────────────────────────────────────────┤
│ BROWSE BY NEIGHBORHOOD                     │
│  [Ponce City] [Beltline] [Cabbagetown]     │
│  [Old Fourth Ward] [West End] [Decatur]    │
└────────────────────────────────────────────┘
```

**Spec:**
- **Recent searches:** max 5 overlay, max 3 inline. `localStorage` for Phase 0; server-sync via `/api/user/recent-searches` in Phase 1. Individual × clears one; "Clear all" clears all. Show section only if count > 0.
- **Quick Intents / Browse by Category:** static array in `web/lib/search/presearch-config.ts`, not DB-driven. Curated-once editorial config, updated manually. Pills use `<FilterChip>` inactive style.
- **Browse by Neighborhood:** static array per-portal in `portals/[slug]/config.ts`. Max 6 chips in overlay. Not shown in inline mode.

### 5.4 Empty state matrix

| State | Trigger | Render | Copy | Actions |
|---|---|---|---|---|
| Initial / presearch | Empty query | Full presearch content | — | Quick Intents, Browse, Recent |
| 1 char typed | `query.length === 1` | Input hint | "Keep typing…" (`text-xs text-[var(--muted)] text-center py-4`) | None |
| Query < 2 chars | `query.length < 2` | Same as 1-char | — | — |
| Loading (>150ms) | Fetch inflight | 3 skeleton rows per active section, shimmer animation | — | None |
| Zero results | Query ≥ 2 chars, zero real results | `PhMagnifyingGlass` at 48px `--twilight/60` + copy + category chips | "Nothing matched **{query}**. Try a category below or adjust your search." | 4 FilterChips for top categories; "Browse everything →" link to `/[portal]/explore` |
| Network error | Fetch rejects or ≥ 500 | Error container | "Search is having a moment. Try again?" | "Retry" button (re-fires last query) |
| Rate limited | 429 | Same as network error | "Too many searches — give it a second." | Auto-retry after 3s |
| Offline | `navigator.onLine === false` | Offline indicator | "You're offline. Connect to search." | Auto-restore on `online` event |
| Query is URL | Matches `^https?://` or `www.` | Single item: link icon + "Open this link" | "Open **{truncated-url}**" | Tap/Enter navigates to URL in new tab |
| Query matches lane name | Matches "events", "music", etc. | Quick Intent chip above results | "Jump to: **[Music events →]**" chip in `--coral` | Chip navigates to `/[portal]/explore?category=music`; normal results below |
| Typo, high confidence (≥0.8) | Backend corrects | Corrected results + chip | "Showing results for **jazz** — search instead for **jaz**" | Chip re-runs with `forceUncorrected: true` |
| Typo, low confidence (<0.8) | Zero results, candidate correction | Zero-result + did-you-mean chip | "Did you mean **{correction}**?" | Chip applies correction |

### 5.5 Keyboard navigation model

| Key | Context | Action |
|---|---|---|
| `⌘K` / `Ctrl+K` | Anywhere | Open overlay, focus input. If already open or inline focused, select all text. |
| `/` | Outside input/textarea | Open overlay, focus input. If inside input, type literal `/`. |
| `Esc` | Overlay open, input has content | Clear input (restore presearch) |
| `Esc` | Overlay open, input empty | Close overlay, return focus to trigger |
| `Esc` | Inline mode, input focused | Blur input |
| `↓` | Input focused, results present | Focus first item in Top Matches (or first grouped-section item if no Top Matches) |
| `↓` | On last item in section | First item of next section |
| `↓` | On last item overall | Wrap to input |
| `↑` | First item in any section | Return focus to input |
| `↑` | Non-first item | Move up within section |
| `→` | Top Matches strip (desktop only) | Next Top Matches card |
| `←` | Top Matches strip (desktop only) | Previous Top Matches card |
| `Tab` | Input focused | Move to first result (like `↓`); does NOT escape search |
| `Tab` | Last result item | Back to input (cycles within search panel while overlay open) |
| `Shift+Tab` | Any result | Move up |
| `Enter` | Input, no selection, query ≥ 2 | Navigate to `/[portal]/explore?q={query}` |
| `Enter` | Result focused | Navigate to result |
| `⌘+Enter` / `Ctrl+Enter` | Result focused | Open in new tab |

**Focus management on close:** store trigger in `ref` (`openedByRef`). On close, call `openedByRef.current?.focus()` after close animation (120ms timeout).

### 5.6 Mobile keyboard handling (`visualViewport`)

```typescript
// web/lib/hooks/useVisualViewportHeight.ts
import { useEffect, useState } from "react";

export function useVisualViewportHeight() {
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    function handleResize() { setOffset(vv!.offsetTop); }
    vv.addEventListener("resize", handleResize);
    vv.addEventListener("scroll", handleResize);
    return () => {
      vv.removeEventListener("resize", handleResize);
      vv.removeEventListener("scroll", handleResize);
    };
  }, []);

  return offset;
}
```

```css
.search-overlay-mobile {
  position: fixed;
  inset: 0;
  padding-top: env(safe-area-inset-top);
  display: flex;
  flex-direction: column;
  background: var(--night);
  z-index: 200;
}
.search-input-bar {
  flex-shrink: 0;
  padding: 12px 16px;
  padding-top: max(12px, env(safe-area-inset-top));
}
.search-results-scroll {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding-bottom: env(safe-area-inset-bottom);
  overscroll-behavior: contain;
}
```

```tsx
const vpOffset = useVisualViewportHeight();
<div className="search-results-scroll"
  style={{ maxHeight: `calc(100dvh - 64px - ${vpOffset}px - env(safe-area-inset-bottom))` }}
>
```

**iOS:** `visualViewport.offsetTop` grows when keyboard opens (viewport scrolls up). Dual `resize` + `scroll` listener catches both. Input stays visible because it's `flex-shrink: 0` at top.

**Android:** `100dvh` tracks visual viewport on Android; `maxHeight` calc auto-contracts. Hook's `offsetTop` approach handles the `resize-none` edge case.

**Never use `window.innerHeight`** — unreliable on iOS with keyboard open.

### 5.7 Typo correction UX flow

**High-confidence (≥0.8):**
- User types "jaz"
- Backend returns corrected results for "jazz"
- UI renders corrected results by default
- Chip above results: `bg-[var(--dusk)] border border-[var(--twilight)]` rounded-lg px-3 py-2
  - Content: `PhInfo` icon · "Showing results for **jazz** — search instead for **jaz**" · × dismiss
  - "jazz" in `font-semibold text-[var(--cream)]`; "jaz" (the link) in `font-semibold text-[var(--coral)]`
- Input retains user's original "jaz"
- "search instead for jaz" button re-runs query with `forceUncorrected: true`
- × removes chip for this query only

**Low-confidence (<0.8):**
- Zero results render
- Chip above empty state: "Did you mean **jazz**?"
- Tapping "jazz" sets input to "jazz" and re-runs (with `forceUncorrected: false`)

### 5.8 Accessibility spec

- [ ] Overlay: `role="dialog"`, `aria-modal="true"`, `aria-label="Search"`
- [ ] Input: `role="combobox"`, `aria-expanded`, `aria-autocomplete="list"`, `aria-controls="search-listbox"`, `aria-activedescendant`
- [ ] Results container: `role="listbox"`, `id="search-listbox"`
- [ ] Each result item: `role="option"`, `aria-selected`, `id="suggestion-{globalIndex}"`
- [ ] Section headers: `role="group"`, `aria-label="Events, 4 results"`
- [ ] Live region `role="status" aria-live="polite" aria-atomic="true"` — announces "4 events, 2 places found" (debounced 300ms)
- [ ] Loading: live region "Searching…"
- [ ] Did-you-mean: live region announces correction
- [ ] Error: `role="alert"` (not `status`) — errors are urgent
- [ ] Zero results: live region "No results found for {query}" (100ms delay)
- [ ] Focus NOT trapped in strict cycle — Tab cycles within overlay panel only while open; Esc closes and returns focus to `openedByRef`
- [ ] `prefers-reduced-motion` disables `translateY`/`translateX` + skeleton shimmer; opacity transitions at 60ms max
- [ ] Forced-colors mode: solid 1px `--coral` outline as fallback for `--coral/30` focus borders
- [ ] Touch targets: min-height 44px (`min-h-[44px]`)
- [ ] Keyboard-only: every interactive element reachable via Tab/Shift+Tab + arrows

---

## Part 6 — Phasing

### 6.1 Phase 0 — Foundation

**Goal:** replace the broken stack with a correct, instrumented, contract-enforced foundation. Measure the real product surface. Ship visible quality improvements on day one.

**Scope summary (from §1.5):** cleanup + unified endpoint + three-layer architecture + UnifiedSearch component + LaneFilterInput split + progressive layout + portal isolation + pg_trgm + structured filters + visible state + recent searches (localStorage) + mobile keyboard + card anatomy + empty states + presearch (static) + Top Matches/Grouped body + `search_events` table + adaptive presearch.

**Phase 0 green-light conditions (must be TRUE before build starts):**

1. **Data coverage audit complete** with bold thresholds from §1.6 met: venue_id linkage on events ≥ 85%, category on events ≥ 90%, neighborhood on venues ≥ 85%. If below, crawler fixes ship first.
2. **1869-line `unified-search.ts` and orphaned routes deleted** before new code is written. No parallel existence.
3. **Portal isolation enforcement specified** at the RPC level — `p_portal_id uuid NOT NULL` required signature.
4. **Card anatomy per entity type agreed** before component implementation. One round-trip costs less than retrofit.
5. **`search_events` schema defined** (not necessarily populated) so every interaction is instrumented from day one.

**Phase 0 ship gates (must be TRUE at merge):**

- ESLint rule `no-retriever-rpc-calls` in CI
- `retriever-contract.test.ts` passing
- pgTAP portal-isolation test passing (4/4)
- Zod input validation test suite passing
- 10-item security pre-ship checklist (§3.9) all green
- Mobile keyboard cold-start test on iOS Safari and Android Chrome passing
- `search_events` table migrated and populated on every request
- Lint passing, `tsc --noEmit` clean

**Phase 0 is dev-gated, not time-gated.** Ships when the gates pass.

### 6.2 Phase 1 — Forgiving text + instrumentation + polish

**Goal:** make search *smart* about user imprecision and make ranking *observable* for future tuning.

**Scope summary:** recent searches server sync + curated synonym map + did-you-mean UX + motion refinements + OpenTelemetry + Server-Timing + client RUM + Redis single-flight hardening + layered rate limits + desktop keyboard nav + warm-up cron + text highlighting.

**Phase 1 green-light conditions (must be TRUE at Phase 0 ship + 14 days):**

1. **SCR is measurable** — `search_events` has real data; the metric can be computed.
2. **Zero-result rate < 10%** on 2+ word queries. If above, Phase 1 synonym work is treating symptoms; stop and fix data first.
3. **Mobile keyboard handling verified** in production on real devices (iOS Safari + Android Chrome).
4. **Phase 0 has been in production 14 days minimum** with real users. Shipping Phase 1 before seeing real query patterns is guesswork. **Not optional — this 14-day hold is how we get real Quick Intent candidates, real synonym gaps, and real zero-result queries to target.**

### 6.3 Deferred — Phase 2+

**Contingent work that enters scope only after Phase 1 shipping data justifies it:**

- **pgvector embeddings** — contingent on Phase 1 data showing a residual relevance gap that embeddings would close. Re-evaluate 90 days post-Phase-1. If zero-result rate on well-formed queries is below 5% and SCR is within target, embeddings are unjustified.
- **Friends-going chips** — contingent on social graph density reaching a usability floor. Current graph is sparse.
- **LLM query routing** — contingent on evidence that users write natural-language queries structured search fails on. Not a default assumption.
- **Cross-portal "Elsewhere on Lost City" section** — contingent on having multiple portals with enough inventory to be useful.

**Explicit re-evaluation trigger:** at Phase 1 ship + 60 days, review `search_events` data and decide which deferred items enter a Phase 2 spec. Do not commit in advance.

---

## Part 7 — Risk Register

Three strategic risks specific to this plan, ordered by leverage:

### Risk 1: Well-architected search on sparse data

**Probability:** High. **Impact:** High. **Detection signal:** SCR underperforms feed baseline at 30 days; zero-result rate on 2+ word queries exceeds 10%.

We ship clean Retrieval/Ranking/Presentation layers, but venue_id linkage is 60%, neighborhood coverage is 55%, and category tags are inconsistent. Filters compose correctly but return thin, unsatisfying result sets. The architecture is right, the data is wrong, and the product feels mid-tier despite the work.

**Mitigation:** the §1.6 data coverage gate. Phase 0 does not ship until the bold thresholds are met. Audit is re-run monthly (not once at Phase 0 gate) to catch drift.

### Risk 2: Phase 1 scoping creep reintroduces hidden personalization

**Probability:** Medium. **Impact:** Medium. **Detection signal:** a PR titled "Add recommendations to presearch" lands in Phase 1.

The "Because you saved X" and "trending" cuts were agreed in principle. But when Phase 1 starts and engineers see an empty presearch slot, the temptation to fill it with "relevant content" will be real. Personalization re-enters through the presearch slot.

**Mitigation:** this spec documents the cuts explicitly, not just in conversation. The presearch content strategy (§5.3) specifies exactly what populates presearch — recents, static Quick Intents, static Browse by Category, static Browse by Neighborhood. Named anti-pattern in CLAUDE.md: "presearch is not a recommendations slot." The `lib/search/presearch-config.ts` file is reviewed by the search working group on every change.

### Risk 3: Search work distracts from data-layer maintenance

**Probability:** Medium. **Impact:** High. **Detection signal:** crawler health monthly audit shows dead-source drift climbing while search engineering is shipping.

Search is high-visibility, high-effort. Crawler reliability has shown a 60%+ dead-source drift rate with no automated monitoring. If attention concentrates on search UX while crawler health degrades, we end up with excellent search over shrinking data — the moat erodes while the interface improves.

**Mitigation:** Phase 0 search work is not a reason to pause crawler health work. These are parallel tracks. The data coverage check is re-run monthly on a schedule (not just at Phase 0 gate). Search quality is treated as a trailing indicator of crawler health.

---

## Part 8 — Open Questions

Real decisions the implementer will face that aren't fully specified in this document. These become review-gate items for the implementation PR.

1. **Did-you-mean confidence threshold source.** Spec says 0.8 is the threshold. What trigram score or synonym match quality (or combined signal) does "confidence" refer to? Search working group defines this during Phase 1 backend work when real data informs the call.
2. **Stagger animation cap behavior under streaming.** Spec caps stagger at 8 cards assuming results arrive in one batch. If Phase 1 adds result streaming, stagger needs to reset per batch rather than globally.
3. **`forceUncorrected` API contract.** Spec describes the behavior but not the request/response shape. Needs a concrete query-param or header decision at the route level.
4. **z-index audit.** Overlay uses `z-index: 200`. Needs an audit against existing stacking in `globals.css` — toast stack, mobile tab bar, sticky detail bar, feed page index.
5. **Per-portal presearch neighborhood chips.** `presearch-config.ts` needs a portal-keyed map or a fallback to an empty array. Non-Atlanta portals have no defined source of truth yet.
6. **Session boundary for server sync of recent searches.** Every query write is expensive; only on result selection is safer but misses uncommitted intent. Phase 1 decision, gated on server-side rate limit data.
7. **Lane filter input URL param collision.** Lane filter uses `?search=`, unified search uses `?q=`. When a user is on `/explore?lane=events&search=jazz` and then opens the global search overlay, do we pre-populate with "jazz" or start empty? Decision needed for Phase 0 UX polish.
8. **Exhibitions — included or excluded?** Spec currently excludes from search until P4 ships. Confirm with P4 owners whether data coverage exists to include them in Phase 0 at reduced ranking.
9. **Quick Intent configuration — per-portal or global?** Currently assumed static per portal. Arts portal and Lost Youth portal may want different Quick Intents than Atlanta hero.

---

## Appendix A — File manifest

**New files (Phase 0):**

```
# Backend
database/migrations/{date}_search_unified_function.sql
database/migrations/{date}_search_events_table.sql
database/migrations/{date}_user_recent_searches_table.sql
database/migrations/{date}_search_log_salt_table.sql
database/tests/search_unified.pgtap.sql

# Search library
web/lib/search/index.ts
web/lib/search/search-service.ts
web/lib/search/types.ts
# web/lib/search/cache.ts                 — Phase 1 (Phase 0 uses lib/shared-cache.ts directly)
web/lib/search/observability.ts
web/lib/search/unified-retrieval.ts
web/lib/search/input-schema.ts
web/lib/search/normalize.ts
web/lib/search/store.ts
web/lib/search/presearch-config.ts

web/lib/search/understanding/annotate.ts
web/lib/search/understanding/tokenize.ts
web/lib/search/understanding/intent.ts
web/lib/search/understanding/entities.ts
web/lib/search/understanding/types.ts

web/lib/search/retrievers/index.ts
web/lib/search/retrievers/fts.ts
web/lib/search/retrievers/trigram.ts
web/lib/search/retrievers/structured.ts
web/lib/search/retrievers/types.ts

web/lib/search/ranking/index.ts
web/lib/search/ranking/rrf.ts
web/lib/search/ranking/types.ts

web/lib/search/presenting/index.ts
web/lib/search/presenting/grouped.ts
# web/lib/search/presenting/mmr.ts       — Phase 1 (diversity reranker)
web/lib/search/presenting/types.ts

web/lib/search/__tests__/retriever-contract.test.ts
web/lib/search/__tests__/annotate.test.ts
web/lib/search/__tests__/ranker.test.ts
web/lib/search/__tests__/integration.test.ts

# API routes
web/app/[portal]/api/search/unified/route.ts
web/app/[portal]/api/search/unified/personalize/route.ts
web/app/api/user/recent-searches/route.ts

# Components
web/components/search/UnifiedSearchShell.tsx
web/components/search/SearchInput.tsx
web/components/search/PresearchBody.tsx
web/components/search/ResultsBody.tsx
web/components/search/TopMatchesStrip.tsx
web/components/search/GroupedResultSection.tsx
web/components/search/EmptyState.tsx
web/components/search/LaunchButton.tsx   # header launcher trigger

# Entity cards
web/components/search/cards/EventResultCard.tsx
web/components/search/cards/VenueResultCard.tsx
web/components/search/cards/OrganizerResultCard.tsx
web/components/search/cards/SeriesResultCard.tsx
web/components/search/cards/FestivalResultCard.tsx
web/components/search/cards/ProgramResultCard.tsx
web/components/search/cards/NeighborhoodResultCard.tsx
web/components/search/cards/CategoryResultCard.tsx

# Lane filter (split from FindSearchInput)
web/components/find/LaneFilterInput.tsx

# Hooks
web/lib/hooks/useVisualViewportHeight.ts

# CI / tooling
web/tools/eslint-rules/no-retriever-rpc-calls.js
```

**Files deleted (Phase 0):**

```
web/lib/unified-search.ts                                    # 1869 lines
web/app/api/search/route.ts                                  # orphaned
web/app/api/search/preview/route.ts                          # orphaned
web/app/api/search/suggestions/route.ts                      # orphaned
# FindSearchInput.tsx is refactored into UnifiedSearch + LaneFilterInput
# HeaderSearchButton.tsx becomes a trigger for the unified overlay
# MobileSearchOverlay.tsx merges into UnifiedSearchShell overlay mode
# ExploreSearchResults.tsx becomes UnifiedSearchShell inline mode content
```

**Files modified (Phase 0 + Phase 0.5):**

```
# Phase 0
web/components/explore-platform/ExploreShellClient.tsx      # renders UnifiedSearchShell inline
web/components/explore-platform/ExploreHomeScreen.tsx       # JSDoc updated to reference UnifiedSearchShell (Phase 0.5)
web/components/find/EventsFinder.tsx                        # uses LaneFilterInput
web/components/find/PlaceFilterBar.tsx                      # uses LaneFilterInput
web/components/headers/*.tsx                                # replaced HeaderSearchButton with LaunchButton
web/lib/rate-limit.ts                                       # add search presets (Phase 1)
web/next.config.ts                                          # add Referrer-Policy header (already present)
# ExploreSearchHero.tsx, ExploreSearchResults.tsx, FindSearchInput.tsx,
# HeaderSearchButton.tsx, MobileSearchOverlay.tsx listed above as "deleted"
# — they were removed in Phase 0.5's cascade, not modified.

# Phase 0.5 — legacy cleanup + regression fix
web/components/GlassHeader.tsx                              # HeaderSearchButton → LaunchButton
web/components/search/RootSearchOverlay.tsx                 # new — root-layout overlay mount
web/app/layout.tsx                                          # mount RootSearchOverlay in provider chain
web/app/[portal]/layout.tsx                                 # remove duplicate overlay mount (root covers it)
web/app/[portal]/api/search/unified/personalize/route.ts    # portal-scope event + venue IDs
web/lib/search/search-service.ts                            # diagnostics immutable via spread
web/lib/portal-attribution.test.ts                          # drop unified-search disk sentinel
web/scripts/perf-audit.ts                                   # retarget to new /{portal}/api/search/unified
web/scripts/prewarm-cache.ts                                # retarget to new /{portal}/api/search/unified
web/package.json                                            # drop search:audit / search:check npm scripts
.github/workflows/web-perf-smoke.yml                        # drop 'Run search quality audit' step
database/migrations/20260413000012_revoke_anon_insert_recent_search.sql  # new (Phase 0 security H1)
```

---

## Appendix B — Existing infrastructure verified

Infrastructure the spec depends on that is already in place (no new setup required):

| Infrastructure | Location | Notes |
|---|---|---|
| Upstash Redis | `lib/shared-cache.ts` | `@upstash/redis` in package.json; `getSharedCacheJson`/`setSharedCacheJson` helpers exist |
| Rate limiting | `lib/rate-limit.ts` | `@upstash/ratelimit` in package.json; `RATE_LIMITS.read/write/auth/standard` exist |
| `withOptionalAuth` | `lib/api-middleware.ts:301` | Required by the search route handler; exists |
| Portal resolution | `lib/portal-runtime/resolvePortalRequest` | Route-based portal resolution; used by existing routes |
| Vercel Cron | `vercel.json` | No crons configured yet; adding search warmup is a new crons block |
| Phosphor icons | `@phosphor-icons/react` | Used throughout; no new icon package needed |

---

**End of spec.**
