# Search Phase 1 — Foundation for Locally-Aware Search

> **For agentic workers:** Use `superpowers:subagent-driven-development` or `superpowers:executing-plans` to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the items that make the new search stack feel **locally aware** — alias canonicalization for Atlanta shorthand, entity linking for venues and neighborhoods, venue FTS retrieval, ranking quality pass, MMR diversity safety net, and cross-device recent-search continuity. Plus observability + small perf wins that unblock future tuning.

**Honest framing:** This sprint produces a "solid, production-grade, locally-aware" search experience. It does NOT produce "excellent" in the Resy/Time Out sense — fuzzy typo tolerance, full empty-state coverage, and query-volume-driven ranking are Phase 2 and require signal the observability in this sprint is designed to capture.

**Architecture:** Extends the three-layer stack shipped in PRs #15 and #16. New code in `web/lib/search/understanding/**` (alias + entity dictionaries), `web/lib/search/ranking/boost-rules.ts`, one new retriever in `web/lib/search/retrievers/**`, one SQL migration adding an `fts_places` CTE to `search_unified`. No new web services, no new deploys.

**Tech stack:** TypeScript, existing Zod/vitest/Supabase-JS stack. Static JSON for aliases (portal-scoped); runtime cache for entity dictionary (no checked-in JSON). One DB migration for the places FTS CTE.

**Estimated scope:** Six tasks + one observability/perf bundle, executable as a single agentic sprint. Do not estimate in developer-days — per the agentic lens, each task is a well-specified subagent dispatch.

---

## Prerequisites

Before starting the sprint, verify:

- [ ] Service-role Supabase credentials available in `web/.env.local` (`NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`). Needed for entity dictionary runtime cache and for the regression fixture (which env-gates like the existing integration test).
- [ ] Atlanta portal populated in dev database with real `places` rows (used by entity dictionary cache at cold-start) and enough events that fixture queries like `the earl`, `fox`, `high`, `garden`, `masquerade` return the expected venues.
- [ ] `places.search_vector` confirmed 100% populated per Finding 2 in `docs/search-phase-0-crawler-findings.md` (already verified).
- [ ] Exhibition card hotfix merged via PR #17 — verified shipped at commit `c7f94cd1`.
- [ ] Dev server on port 3000 (or similar) can hit `/atlanta/api/search/unified?q=jazz` and return 200 with real results for manual smoke tests.

If any prerequisite fails, STOP and report — don't guess at data.

---

## Non-goals (explicitly deferred, do NOT build in this sprint)

- **Did-you-mean / typo correction.** Interacts with alias expansion in non-obvious ways; needs its own scoping pass. Phase 2.
- **Structured retriever wiring.** The existing `structured.ts` shim is empty because the structured CTE isn't in `search_unified` yet. Adding it requires a migration + SQL + type changes — bigger than this sprint's budget. Phase 2.
- **Full Redis cache wrapper with single-flight.** Phase 0 uses `lib/shared-cache.ts` directly. Stampede-protected caching is Phase 2.
- **Trending section on presearch.** User memory explicitly warns against the "presearch is a recommendations slot" anti-pattern. Do not build this, even a disciplined version. The moment presearch becomes algorithmic, curation discipline collapses.
- **Remaining empty-state scenarios** (URL paste, lane name, typo). Phase 2 — needs Phase 1 observability to know which edges matter.
- **Partial trigram index / portal_venues CTE materialization.** Performance tuning, 10×-scale concern. Phase 2.
- **Batch `search_events` inserts.** Performance tuning at load. Phase 2.
- **Salt rotation cron.** Defense-in-depth hygiene. Phase 2.
- **LLM-based query routing.** Out of scope.
- **pgvector / semantic search.** Out of scope.

If any of these become urgent mid-sprint, open a separate ticket. Do not add them here.

---

## Type reality check (what the plan assumes exists)

The previous draft had type drift. This version writes against actual shipped code. Key types per `web/lib/search/understanding/types.ts`:

```typescript
export interface AnnotatedQuery {
  readonly raw: string;
  readonly normalized: string;
  readonly tokens: ReadonlyArray<Token>;
  readonly entities: ReadonlyArray<EntityAnnotation>;
  readonly temporal?: { type; start; end };
  readonly spatial?: { neighborhood?; distance_m?; center? };
  readonly spelling: ReadonlyArray<{ corrected; confidence }>;
  readonly synonyms: ReadonlyArray<{ token; expansions; weight }>;  // ← alias expansion writes here
  readonly structured_filters: Readonly<StructuredFilters>;
  readonly intent: { type; confidence };
  readonly fingerprint: string;
}

export interface EntityAnnotation {
  kind: "category" | "neighborhood" | "venue" | "person" | "time" | "audience";
  span: [number, number];
  resolved_id?: string;
  surface: string;
  confidence: number;
}

export interface StructuredFilters {
  categories?: string[];
  neighborhoods?: string[];
  date_range?: { start; end };
  price?: { free?; max? };
  audience?: string[];
  venue_ids?: string[];  // ← entity-linked venue IDs go here
}

export function linkEntities(
  _raw: string,          // 3 args, NOT 1
  _tokens: Token[],
  _ctx: PortalContext
): EntityAnnotation[]    // returns EntityAnnotation[], not "EntityMatch"

export interface Token {
  text: string;
  normalized: string;
  start: number;         // char offset in raw — NO way to fabricate for synthetic alias tokens
  end: number;
  stop: boolean;
}
```

**Implications for the plan:**

- **Alias expansion writes to `AnnotatedQuery.synonyms`**, not a new `diagnostics.aliases_hit` field. The existing shape is already designed for this.
- **Entity linking returns `EntityAnnotation[]`** with `kind`, `span`, `resolved_id`, `surface`, `confidence`. `kind` for venues is `"venue"`, for neighborhoods is `"neighborhood"`.
- **`EntityType` vs `EntityKind` are different types.** `EntityType` (in `lib/search/types.ts`) is the candidate type — `event | venue | exhibition | ...`. `EntityKind` (in `understanding/types.ts`) is the query-linking kind — `venue | neighborhood | category | ...`. Do not confuse them.
- **Synthetic expansion tokens have no raw-string offsets.** Alias expansion does NOT create new `Token` objects. It writes to `synonyms[]` instead. Retrievers already consume `synonyms[]` through the fingerprint and SQL query building.
- **Entity matches feed into two places**: (1) `AnnotatedQuery.entities[]` for ranking/presentation metadata, and (2) `StructuredFilters.venue_ids[]` for the retriever/SQL layer to filter on. Use both.
- **`RankingContext.diversityLambda` already exists** — MMR wiring is a matter of consuming the field in the ranker, not adding new plumbing.

---

## File structure

New files:

- `web/lib/search/understanding/aliases.ts` — alias expansion function
- `web/lib/search/understanding/aliases.common.json` — base dictionary (portal-agnostic)
- `web/lib/search/understanding/aliases.atlanta.json` — Atlanta-specific overrides
- `web/lib/search/understanding/__tests__/aliases.test.ts`
- `web/lib/search/understanding/entity-cache.ts` — runtime entity dictionary cache
- `web/lib/search/understanding/__tests__/entities.test.ts` — replaces trivial stub test
- `web/lib/search/ranking/boost-rules.ts` — whole-token, exact-entity, intent-aware boosts
- `web/lib/search/ranking/mmr.ts` — diversity reranker (λ=0.3 default)
- `web/lib/search/__tests__/ranking-quality.test.ts` — env-gated fixture vs live DB
- `web/lib/search/retrievers/fts-places.ts` — new retriever reading `fts_places` slice
- `web/app/[portal]/api/search/recents/route.ts` — GET handler for cross-device recent-search hydration
- `database/migrations/20260414000001_search_unified_fts_places.sql` — adds `fts_places` CTE
- `supabase/migrations/20260414000001_search_unified_fts_places.sql` — mirror

Modified:

- `web/lib/search/understanding/annotate.ts` — call `expandAliases` after tokenize; route results into `synonyms[]` and `structured_filters`
- `web/lib/search/understanding/entities.ts` — replace stub body with entity-cache lookup (3-arg signature stays the same)
- `web/lib/search/types.ts` — add `"fts_places"` to `RetrieverId` union
- `web/lib/search/ranking/rrf.ts` — consume `RankingContext.diversityLambda` via MMR post-pass; currently ignored with `_ctx`
- `web/lib/search/search-service.ts` — instantiate `FtsPlacesRetriever` in registry, apply `BoostRules` after ranking, populate `structured_filters.venue_ids` from entity matches before retrieval
- `web/lib/search/unified-retrieval.ts` — demux the new `fts_places` result slice from `UnifiedRetrievalResult`
- `web/lib/search/observability.ts` — populate per-retriever timings into `retriever_ms` map (currently empty), add `zero_result` flag
- `web/app/[portal]/api/search/unified/route.ts` — read per-retriever timings from service result, pass to `logSearchEvent`
- `web/app/[portal]/api/search/unified/personalize/route.ts` — single-query `!inner` join (architect Phase 0.5 Important)
- `web/components/search/UnifiedSearchShell.tsx` — wire recent-search write-through + hydration; gate `useVisualViewportHeight` listener on `overlayOpen`
- `web/components/search/useSearchFetch.ts` — (only if needed for recent-search hydration)
- `web/lib/hooks/useVisualViewportHeight.ts` — accept `active` parameter to short-circuit listener attachment

---

## Task 1: Portal-scoped alias dictionary + synonym expansion

**Why:** Atlanta locals type `l5p`, `o4w`, `PCM`, `brunch`, `The Earl` and expect results. Without this, search feels ignorant of its own city. The `synonyms[]` field on `AnnotatedQuery` is already designed for this — we just need to populate it.

**Portal-scoping note:** Using `aliases.{portal_slug}.json` with a `common.json` base-merge (architect flag). Hardcoding to `aliases.atlanta.json` would make HelpATL / Arts portal onboarding a refactor.

### Files

- Create: `web/lib/search/understanding/aliases.ts`
- Create: `web/lib/search/understanding/aliases.common.json`
- Create: `web/lib/search/understanding/aliases.atlanta.json`
- Create: `web/lib/search/understanding/__tests__/aliases.test.ts`
- Modify: `web/lib/search/understanding/annotate.ts`

### Dictionary schema

```json
{
  "aliases": [
    {
      "match": "l5p",
      "expansions": ["little five points"],
      "kind": "neighborhood",
      "neighborhood": "little-five-points"
    },
    {
      "match": "brunch",
      "expansions": ["brunch", "breakfast"],
      "kind": "category",
      "categories": ["food_drink"]
    },
    {
      "match": "old fourth ward",
      "expansions": ["old fourth ward", "o4w"],
      "kind": "neighborhood",
      "neighborhood": "old-fourth-ward"
    }
  ]
}
```

- `match`: what the user types (can be multi-word; matched against joined normalized tokens)
- `expansions`: additional terms to push into the FTS query via `synonyms[]`
- `kind`: `"category" | "neighborhood" | "venue" | "category_label"` (informs which structured_filters field gets populated)
- `categories`, `neighborhood`, etc. — populate the relevant `structured_filters` field

`common.json` is empty for now (just `{"aliases": []}`) but the mechanism exists so any portal can inherit a base.

### Seed data for `aliases.atlanta.json`

Hand-curate 30-50 entries. Minimum set to ship:

- Neighborhoods: `l5p`, `o4w`, `pcm`, `ponce city market`, `little five points`, `old fourth ward`, `west end`, `cabbagetown`, `edgewood`, `grant park`, `east atlanta`, `eav`, `inman park`, `virginia highland`, `poncey-highland`, `decatur`, `midtown`, `downtown`, `buckhead`
- Categories: `brunch → food_drink + breakfast`, `hip hop → music + rap`, `edm → music + electronic`, `speakeasy → nightlife + cocktail`, `happy hour → food_drink + specials`, `dive → nightlife + dive_bar`
- Atlanta events: `music midtown`, `dragon con`, `atl pride`, `shaky knees`, `atlanta jazz fest`

Do NOT seed venue aliases here — those come from entity linking (Task 2) which is more precise than string matching.

### Steps

- [ ] **Step 1: Write the dictionary JSON files**

Create `aliases.common.json`:
```json
{"aliases": []}
```

Create `aliases.atlanta.json` with the seed entries above. Use kebab-case for `neighborhood` slugs to match the `places.neighborhood` column convention.

- [ ] **Step 2: Write the failing test**

Create `web/lib/search/understanding/__tests__/aliases.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { loadAliases, expandAliases } from "@/lib/search/understanding/aliases";

describe("loadAliases", () => {
  it("merges common + portal dictionaries", () => {
    const dict = loadAliases("atlanta");
    expect(dict.entries.length).toBeGreaterThan(0);
    // Should contain Atlanta-specific entries
    expect(dict.entries.some((e) => e.match === "l5p")).toBe(true);
  });

  it("returns empty-entries dictionary for unknown portal", () => {
    const dict = loadAliases("unknown-portal");
    expect(dict.entries).toEqual([]);
  });
});

describe("expandAliases", () => {
  const dict = loadAliases("atlanta");

  it("expands l5p to little five points", () => {
    const result = expandAliases(
      [
        { text: "l5p", normalized: "l5p", start: 0, end: 3, stop: false },
      ],
      dict
    );
    expect(result.synonyms).toContainEqual(
      expect.objectContaining({ token: "l5p", expansions: ["little five points"] })
    );
    expect(result.neighborhoods).toContain("little-five-points");
  });

  it("expands brunch to food_drink + breakfast", () => {
    const result = expandAliases(
      [
        { text: "brunch", normalized: "brunch", start: 0, end: 6, stop: false },
      ],
      dict
    );
    expect(result.categories).toContain("food_drink");
    const synonymForBrunch = result.synonyms.find((s) => s.token === "brunch");
    expect(synonymForBrunch?.expansions).toContain("breakfast");
  });

  it("matches multi-word aliases (old fourth ward)", () => {
    const tokens = [
      { text: "old", normalized: "old", start: 0, end: 3, stop: false },
      { text: "fourth", normalized: "fourth", start: 4, end: 10, stop: false },
      { text: "ward", normalized: "ward", start: 11, end: 15, stop: false },
    ];
    const result = expandAliases(tokens, dict);
    expect(result.neighborhoods).toContain("old-fourth-ward");
  });

  it("returns empty expansions when no alias matches", () => {
    const result = expandAliases(
      [
        { text: "jazz", normalized: "jazz", start: 0, end: 4, stop: false },
      ],
      dict
    );
    expect(result.synonyms).toEqual([]);
    expect(result.categories).toEqual([]);
    expect(result.neighborhoods).toEqual([]);
  });

  it("is idempotent — expanding an already-expanded result adds no new synonyms", () => {
    const tokens = [
      { text: "l5p", normalized: "l5p", start: 0, end: 3, stop: false },
    ];
    const first = expandAliases(tokens, dict);
    // "little five points" has been injected into expansions, not into tokens,
    // so re-running on the same tokens produces the same result.
    const second = expandAliases(tokens, dict);
    expect(second.synonyms).toEqual(first.synonyms);
  });
});
```

Run: `cd web && npx vitest run lib/search/understanding/__tests__/aliases.test.ts` → expect FAIL (unresolved import).

- [ ] **Step 3: Implement `aliases.ts`**

```typescript
// web/lib/search/understanding/aliases.ts
import type { Token } from "@/lib/search/understanding/types";
import commonData from "./aliases.common.json";
import atlantaData from "./aliases.atlanta.json";

export type AliasKind = "category" | "neighborhood" | "venue" | "category_label";

export interface AliasEntry {
  match: string;                // normalized user input (may be multi-word)
  expansions: string[];         // additional FTS terms
  kind: AliasKind;
  categories?: string[];        // populate structured_filters.categories
  neighborhood?: string;        // populate structured_filters.neighborhoods
}

export interface AliasDictionary {
  entries: AliasEntry[];
}

export interface ExpansionResult {
  synonyms: Array<{ token: string; expansions: string[]; weight: number }>;
  categories: string[];
  neighborhoods: string[];
}

// Module-level cache keyed by portal slug.
const CACHE: Map<string, AliasDictionary> = new Map();

export function loadAliases(portalSlug: string): AliasDictionary {
  const cached = CACHE.get(portalSlug);
  if (cached) return cached;

  const base = (commonData as { aliases: AliasEntry[] }).aliases ?? [];
  const portalData = portalSlug === "atlanta"
    ? (atlantaData as { aliases: AliasEntry[] }).aliases
    : [];

  // Portal entries override common entries on same `match` key.
  const merged = new Map<string, AliasEntry>();
  for (const entry of base) merged.set(entry.match.toLowerCase(), entry);
  for (const entry of portalData) merged.set(entry.match.toLowerCase(), entry);

  const dict: AliasDictionary = { entries: Array.from(merged.values()) };
  CACHE.set(portalSlug, dict);
  return dict;
}

const SYNONYM_WEIGHT = 0.5; // alias-expansion weight; lower than exact match

export function expandAliases(
  tokens: ReadonlyArray<Token>,
  dict: AliasDictionary
): ExpansionResult {
  const synonyms: Array<{ token: string; expansions: string[]; weight: number }> = [];
  const categories = new Set<string>();
  const neighborhoods = new Set<string>();

  // Join all normalized tokens into one string for multi-word match lookup.
  const joined = tokens.map((t) => t.normalized).join(" ");

  for (const entry of dict.entries) {
    const matchLower = entry.match.toLowerCase();
    const matchTokenCount = matchLower.split(/\s+/).length;

    // Multi-word: check if `joined` contains the match as a whole-word substring.
    // Single-word: check if any individual token matches.
    let hit = false;
    if (matchTokenCount === 1) {
      hit = tokens.some((t) => t.normalized === matchLower);
    } else {
      // Whole-word containment: boundaries on both sides
      const pattern = new RegExp(`\\b${escapeRegex(matchLower)}\\b`);
      hit = pattern.test(joined);
    }

    if (!hit) continue;

    // Record the expansion as a synonym rather than as new tokens.
    synonyms.push({
      token: entry.match,
      expansions: entry.expansions.filter((e) => e !== entry.match),
      weight: SYNONYM_WEIGHT,
    });

    if (entry.categories) {
      for (const c of entry.categories) categories.add(c);
    }
    if (entry.neighborhood) {
      neighborhoods.add(entry.neighborhood);
    }
  }

  return {
    synonyms,
    categories: Array.from(categories),
    neighborhoods: Array.from(neighborhoods),
  };
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
```

Run the test again: `cd web && npx vitest run lib/search/understanding/__tests__/aliases.test.ts` → expect PASS.

- [ ] **Step 4: Wire into `annotate()`**

Modify `web/lib/search/understanding/annotate.ts`. After `const tokens = tokenize(normalized);` and before `const intent = classifyIntent(...)`:

```typescript
import { loadAliases, expandAliases } from "@/lib/search/understanding/aliases";

// ... inside annotate() ...
const aliasDict = loadAliases(ctx.portal_slug);
const expansion = expandAliases(tokens, aliasDict);
```

In the `structured_filters` build block, merge expansion results with any explicit filter input:

```typescript
// Merge alias-derived categories/neighborhoods into structured_filters.
// Explicit filterInput wins when both are present.
if (expansion.categories.length > 0 && !structured_filters.categories) {
  structured_filters.categories = expansion.categories;
}
if (expansion.neighborhoods.length > 0 && !structured_filters.neighborhoods) {
  structured_filters.neighborhoods = expansion.neighborhoods;
}
```

In the `queryObj` literal, replace `synonyms: []` with:

```typescript
synonyms: expansion.synonyms,
```

The deep-freeze at the end of annotate() preserves the existing invariant — alias expansion does NOT mutate tokens, does NOT add anything unshown to fingerprint (the fingerprint already includes `structured_filters` so expansion-derived filter values are captured).

**Note on fingerprint:** because the fingerprint includes `structured_filters`, queries that differ only in alias-expansion-derived filters will have different fingerprints. This is correct — they ARE different queries — and the Phase 2 cache layer will key on fingerprint.

- [ ] **Step 5: Run + commit**

```bash
cd web && npx vitest run lib/search && npx tsc --noEmit
git add web/lib/search/understanding/aliases.ts web/lib/search/understanding/aliases.common.json web/lib/search/understanding/aliases.atlanta.json web/lib/search/understanding/__tests__/aliases.test.ts web/lib/search/understanding/annotate.ts
git commit -m "feat(search): portal-scoped alias dictionary and synonym expansion"
```

**Acceptance:**
- All alias tests pass
- Existing `lib/search` suite still green (no regression from the annotate() change)
- Manual smoke: hit `/atlanta/api/search/unified?q=l5p&limit=5` in the dev server and verify results include Little Five Points venues/events (requires Task 2 entity linking OR Atlanta events with "little five points" in title/venue)

---

## Task 2: Entity linking via runtime-cached dictionary

**Why:** Companion to Task 1. Even with alias expansion, `The Earl` needs to resolve to a specific `venue_id` so the retriever can filter on `structured_filters.venue_ids[]` and the ranker can boost the exact match to #1. Without it, "earl" matches by TF-IDF and "The Earl" may not rank first.

**Runtime cache, not build-time JSON:** architect flagged staleness risk of a checked-in JSON that goes stale the moment a new venue is crawled. A runtime cache queries `places` + `neighborhoods` at cold start, keeps an in-memory TTL (24h), and stays fresh without deploys. At ~6.8k Atlanta places the cache is tiny.

**Signature preserved:** `linkEntities(raw: string, tokens: Token[], ctx: PortalContext): EntityAnnotation[]`. Three args, sync, returns `EntityAnnotation[]`. This is the Phase 0 shape.

### Files

- Create: `web/lib/search/understanding/entity-cache.ts`
- Create: `web/lib/search/understanding/__tests__/entities.test.ts`
- Modify: `web/lib/search/understanding/entities.ts`

### Steps

- [ ] **Step 1: Write the cache module**

```typescript
// web/lib/search/understanding/entity-cache.ts
import "server-only";
import { createServiceClient } from "@/lib/supabase/service";

export interface EntityEntry {
  normalized_name: string;   // lowercased, stopwords-stripped, NFKC
  kind: "venue" | "neighborhood";
  resolved_id: string;
  display_name: string;
}

interface CacheSnapshot {
  portalSlug: string;
  entries: EntityEntry[];
  byFirstToken: Map<string, EntityEntry[]>;  // index for fast lookup
  loadedAt: number;
}

const TTL_MS = 24 * 60 * 60 * 1000;  // 24 hours
const CACHE: Map<string, CacheSnapshot> = new Map();

// Module-level in-flight promise prevents thundering herd on cold start.
const IN_FLIGHT: Map<string, Promise<CacheSnapshot>> = new Map();

export async function getEntityCache(portalSlug: string): Promise<CacheSnapshot> {
  const cached = CACHE.get(portalSlug);
  const now = Date.now();
  if (cached && now - cached.loadedAt < TTL_MS) return cached;

  const inFlight = IN_FLIGHT.get(portalSlug);
  if (inFlight) return inFlight;

  const loadPromise = loadSnapshot(portalSlug).finally(() => {
    IN_FLIGHT.delete(portalSlug);
  });
  IN_FLIGHT.set(portalSlug, loadPromise);
  return loadPromise;
}

async function loadSnapshot(portalSlug: string): Promise<CacheSnapshot> {
  const client = createServiceClient();
  const portalId = await resolvePortalId(client, portalSlug);
  if (!portalId) {
    // Empty cache for unknown portal so callers don't crash.
    const empty: CacheSnapshot = {
      portalSlug,
      entries: [],
      byFirstToken: new Map(),
      loadedAt: Date.now(),
    };
    CACHE.set(portalSlug, empty);
    return empty;
  }

  // Pull all portal-scoped places via the search_unified portal_venues rule
  // (places referenced by at least one active event in this portal).
  const placesRes = await client
    .from("events")
    .select("place_id, places!inner(id, name, slug)")
    .eq("portal_id", portalId)
    .eq("is_active", true)
    .not("place_id", "is", null);

  const placesRows = (placesRes.data ?? []) as Array<{
    place_id: number;
    places: { id: number; name: string; slug: string };
  }>;

  // Deduplicate by place_id
  const seen = new Set<number>();
  const venueEntries: EntityEntry[] = [];
  for (const row of placesRows) {
    if (seen.has(row.place_id)) continue;
    seen.add(row.place_id);
    const name = row.places?.name;
    if (!name) continue;
    venueEntries.push({
      normalized_name: normalizeName(name),
      kind: "venue",
      resolved_id: String(row.place_id),
      display_name: name,
    });
  }

  // Pull distinct neighborhoods from the same portal-scoped places.
  // Using the same join so we don't pull global neighborhoods.
  const neighborhoodRes = await client
    .from("events")
    .select("places!inner(neighborhood)")
    .eq("portal_id", portalId)
    .eq("is_active", true)
    .not("place_id", "is", null);

  const hoodRows = (neighborhoodRes.data ?? []) as Array<{
    places: { neighborhood: string | null };
  }>;

  const seenHoods = new Set<string>();
  const neighborhoodEntries: EntityEntry[] = [];
  for (const row of hoodRows) {
    const hood = row.places?.neighborhood;
    if (!hood || seenHoods.has(hood)) continue;
    seenHoods.add(hood);
    neighborhoodEntries.push({
      normalized_name: normalizeName(hood),
      kind: "neighborhood",
      resolved_id: hood,
      display_name: hood,
    });
  }

  const entries = [...venueEntries, ...neighborhoodEntries];

  // Index by first-token for O(1) candidate pruning at match time.
  const byFirstToken = new Map<string, EntityEntry[]>();
  for (const e of entries) {
    const firstToken = e.normalized_name.split(/\s+/)[0];
    if (!firstToken) continue;
    const bucket = byFirstToken.get(firstToken) ?? [];
    bucket.push(e);
    byFirstToken.set(firstToken, bucket);
  }

  const snapshot: CacheSnapshot = {
    portalSlug,
    entries,
    byFirstToken,
    loadedAt: Date.now(),
  };
  CACHE.set(portalSlug, snapshot);
  return snapshot;
}

async function resolvePortalId(
  client: ReturnType<typeof createServiceClient>,
  portalSlug: string
): Promise<string | null> {
  const res = await client
    .from("portals")
    .select("id")
    .eq("slug", portalSlug)
    .single();
  const data = res.data as { id: string } | null;
  return data?.id ?? null;
}

// Normalization: lowercase, strip leading articles, collapse whitespace.
// This is the SAME function applied to query tokens at match time.
export function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKC")
    .replace(/^(the|a|an)\s+/i, "")
    .replace(/\s+/g, " ")
    .trim();
}
```

- [ ] **Step 2: Write the failing test**

```typescript
// web/lib/search/understanding/__tests__/entities.test.ts
import { describe, it, expect, vi } from "vitest";
import { linkEntities } from "@/lib/search/understanding/entities";
import type { Token, PortalContext } from "@/lib/search/understanding/types";

// Mock the entity-cache module so tests don't hit the DB.
vi.mock("@/lib/search/understanding/entity-cache", () => ({
  getEntityCache: vi.fn(async (portalSlug: string) => {
    if (portalSlug !== "atlanta") {
      return { portalSlug, entries: [], byFirstToken: new Map(), loadedAt: 0 };
    }
    const entries = [
      { normalized_name: "earl", kind: "venue" as const, resolved_id: "12345", display_name: "The Earl" },
      { normalized_name: "high museum of art", kind: "venue" as const, resolved_id: "67890", display_name: "High Museum of Art" },
      { normalized_name: "atlanta botanical garden", kind: "venue" as const, resolved_id: "11111", display_name: "Atlanta Botanical Garden" },
      { normalized_name: "park tavern", kind: "venue" as const, resolved_id: "22222", display_name: "Park Tavern" },
      { normalized_name: "little five points", kind: "neighborhood" as const, resolved_id: "little-five-points", display_name: "Little Five Points" },
    ];
    const byFirstToken = new Map<string, typeof entries>();
    for (const e of entries) {
      const first = e.normalized_name.split(/\s+/)[0];
      const bucket = byFirstToken.get(first) ?? [];
      bucket.push(e);
      byFirstToken.set(first, bucket);
    }
    return { portalSlug, entries, byFirstToken, loadedAt: Date.now() };
  }),
}));

const ctx: PortalContext = {
  portal_id: "test-uuid",
  portal_slug: "atlanta",
};

function mkTokens(text: string): Token[] {
  const parts = text.toLowerCase().split(/\s+/);
  let offset = 0;
  return parts.map((p) => {
    const start = text.toLowerCase().indexOf(p, offset);
    const end = start + p.length;
    offset = end;
    return { text: p, normalized: p, start, end, stop: false };
  });
}

describe("linkEntities", () => {
  it("matches 'the earl' to The Earl venue", async () => {
    const raw = "the earl";
    const tokens = mkTokens(raw);
    const result = await linkEntities(raw, tokens, ctx);
    expect(result).toContainEqual(
      expect.objectContaining({
        kind: "venue",
        resolved_id: "12345",
        surface: expect.stringMatching(/earl/i),
      })
    );
  });

  it("matches 'high museum of art' to High Museum venue", async () => {
    const raw = "high museum of art";
    const tokens = mkTokens(raw);
    const result = await linkEntities(raw, tokens, ctx);
    expect(result[0]?.resolved_id).toBe("67890");
  });

  it("matches 'little five points' to the neighborhood", async () => {
    const raw = "little five points";
    const tokens = mkTokens(raw);
    const result = await linkEntities(raw, tokens, ctx);
    expect(result.some((e) => e.kind === "neighborhood")).toBe(true);
    expect(result.find((e) => e.kind === "neighborhood")?.resolved_id).toBe("little-five-points");
  });

  it("does NOT false-positive 'park' against Park Tavern (min 2-token guard for multi-word names)", async () => {
    const raw = "park";
    const tokens = mkTokens(raw);
    const result = await linkEntities(raw, tokens, ctx);
    // "park" alone should not match "park tavern" because it's only 1 token
    // against a 2-token venue name. Single-word venue names match on exact equality.
    expect(result.every((e) => e.resolved_id !== "22222")).toBe(true);
  });

  it("requires whole-token containment, not substring", async () => {
    const raw = "earliest";
    const tokens = mkTokens(raw);
    const result = await linkEntities(raw, tokens, ctx);
    expect(result).toEqual([]);
  });

  it("returns empty array for nonsense tokens", async () => {
    const raw = "xyzqwerty";
    const tokens = mkTokens(raw);
    const result = await linkEntities(raw, tokens, ctx);
    expect(result).toEqual([]);
  });

  it("returns empty for unknown portal", async () => {
    const raw = "the earl";
    const tokens = mkTokens(raw);
    const result = await linkEntities(raw, tokens, { portal_id: "x", portal_slug: "unknown" });
    expect(result).toEqual([]);
  });
});
```

Run: expect FAIL until Step 3 implements the real matcher.

**Note on test signature:** the existing `linkEntities` is sync (returns `EntityAnnotation[]` not `Promise<EntityAnnotation[]>`). To support the cache, it becomes `async` — this is a breaking change to the signature that ripples into `annotate()` which already `await`s it implicitly (the `const entities = linkEntities(...)` line). Verify by reading `annotate.ts:115` before editing.

**If `annotate()` currently treats `linkEntities` as sync**: convert to `await linkEntities(...)` as part of this task. This is a real signature change and should be in the commit message.

- [ ] **Step 3: Implement real matching in `entities.ts`**

```typescript
// web/lib/search/understanding/entities.ts
import type {
  EntityAnnotation,
  PortalContext,
  Token,
} from "@/lib/search/understanding/types";
import { getEntityCache, normalizeName } from "@/lib/search/understanding/entity-cache";

/**
 * High-precision entity linking. Matches normalized query tokens against
 * a portal-scoped entity dictionary loaded at server cold-start and cached
 * for 24h. Intentionally precise — the goal is to push confident matches
 * into structured_filters.venue_ids for the retriever/ranker to boost.
 * Fuzzy matching belongs in the trigram retriever, not here.
 *
 * Rules:
 * - Whole-token match only (not substring)
 * - Multi-word entities require ALL tokens present AND adjacent in the query
 * - Single-word entities require exact token equality
 * - NO stopword matching ("the earl" matches "earl" because "the" is stripped)
 * - NO min-length guard — short venue names like "dbA" should still match exact
 */
export async function linkEntities(
  raw: string,
  tokens: Token[],
  ctx: PortalContext
): Promise<EntityAnnotation[]> {
  if (tokens.length === 0) return [];

  const cache = await getEntityCache(ctx.portal_slug);
  if (cache.entries.length === 0) return [];

  // Build a normalized query string for substring-boundary checks.
  const normalizedQuery = tokens
    .filter((t) => !t.stop)
    .map((t) => t.normalized)
    .join(" ");

  // Also preserve the original raw normalized form for "the X" → "X" matching.
  const rawNormalized = normalizeName(raw);

  const matches: EntityAnnotation[] = [];
  const seenResolvedIds = new Set<string>();

  for (const entry of cache.entries) {
    // Whole-token match via word boundaries.
    const hit = matchWholeTokens(entry.normalized_name, normalizedQuery) ||
                matchWholeTokens(entry.normalized_name, rawNormalized);
    if (!hit) continue;

    const key = `${entry.kind}:${entry.resolved_id}`;
    if (seenResolvedIds.has(key)) continue;
    seenResolvedIds.add(key);

    // Compute span: find the entity's first token in the raw string.
    const firstToken = entry.normalized_name.split(/\s+/)[0];
    const span = findSpan(raw, firstToken);

    matches.push({
      kind: entry.kind,
      span,
      resolved_id: entry.resolved_id,
      surface: entry.display_name,
      confidence: matchConfidence(entry, tokens),
    });
  }

  // Sort by confidence descending so callers can take top-N safely.
  matches.sort((a, b) => b.confidence - a.confidence);
  return matches;
}

function matchWholeTokens(needle: string, haystack: string): boolean {
  if (!needle || !haystack) return false;
  const needleTokens = needle.split(/\s+/);
  const haystackTokens = haystack.split(/\s+/);
  // All needle tokens must appear in haystack in order, as contiguous tokens.
  // This prevents "park" matching "park tavern" unless both tokens are present.
  if (needleTokens.length > haystackTokens.length) return false;
  for (let i = 0; i + needleTokens.length <= haystackTokens.length; i++) {
    let allMatch = true;
    for (let j = 0; j < needleTokens.length; j++) {
      if (haystackTokens[i + j] !== needleTokens[j]) {
        allMatch = false;
        break;
      }
    }
    if (allMatch) return true;
  }
  return false;
}

function matchConfidence(entry: { normalized_name: string }, tokens: Token[]): number {
  // High confidence if the entity name is a complete exact match of the
  // non-stopword query; lower if the entity is only part of the query.
  const nonStopTokens = tokens.filter((t) => !t.stop);
  const queryNormalized = nonStopTokens.map((t) => t.normalized).join(" ");
  if (entry.normalized_name === queryNormalized) return 1.0;
  // Multi-token entity name found inside larger query → 0.8
  return 0.8;
}

function findSpan(raw: string, firstToken: string): [number, number] {
  const idx = raw.toLowerCase().indexOf(firstToken);
  if (idx === -1) return [0, 0];
  return [idx, idx + firstToken.length];
}
```

- [ ] **Step 4: Update `annotate()` for async signature**

Find the `const entities = linkEntities(normalized, tokens, ctx);` line in `annotate.ts` and change to:

```typescript
const entities = await linkEntities(normalized, tokens, ctx);
```

`annotate()` is already `async`, so this is safe. Verify tests still pass.

- [ ] **Step 5: Push entity matches into `structured_filters.venue_ids`**

In `annotate()`, after the entity linking line and before the fingerprint computation, add:

```typescript
// Push confident venue entity matches into structured_filters.venue_ids so
// the retriever/ranker layers can filter/boost at the SQL boundary.
const confidentVenueMatches = entities
  .filter((e) => e.kind === "venue" && e.confidence >= 0.8 && e.resolved_id)
  .map((e) => e.resolved_id!)
  .slice(0, 5);  // cap — this is a boost signal, not a hard filter

if (confidentVenueMatches.length > 0) {
  structured_filters.venue_ids = confidentVenueMatches;
}
```

- [ ] **Step 6: Run + commit**

```bash
cd web && npx vitest run lib/search && npx tsc --noEmit
git add web/lib/search/understanding/entity-cache.ts web/lib/search/understanding/entities.ts web/lib/search/understanding/__tests__/entities.test.ts web/lib/search/understanding/annotate.ts
git commit -m "feat(search): runtime-cached entity linking for venues and neighborhoods

Replaces the Phase 0 stub with real entity resolution. Pulls portal-scoped
places + neighborhoods via the portal_venues rule (distinct place_ids from
active events in the portal), caches for 24h in memory, matches whole-token
containment to prevent 'park' false-positives against 'Park Tavern'.

Confident venue matches (>=0.8) populate structured_filters.venue_ids so
the retriever layer can filter/boost at the SQL boundary. linkEntities
signature changes from sync to async to support the cache."
```

**Acceptance:**
- All entity tests pass
- Existing `lib/search` suite still green
- Cold-start DB query hits only once per portal per 24h (verify via log sampling)
- No `as never` casts or unsafe types introduced

---

## Task 3: FTS places retriever

**Why:** Finding 2 in the crawler-findings doc notes `places.search_vector` is 100% populated (6785/6785 rows). Phase 0 shipped places-side retrieval via trigram only, leaving 50% of the retrieval signal unused. Adding a cheap `fts_places` CTE to `search_unified` closes the gap before the boost layer even fires.

**Type change warning:** This adds a new `RetrieverId` value. Update `web/lib/search/types.ts`:

```typescript
export type RetrieverId = "fts" | "trigram" | "structured" | "fts_places";
```

### Files

- Create: `database/migrations/20260414000001_search_unified_fts_places.sql`
- Create: `supabase/migrations/20260414000001_search_unified_fts_places.sql` (mirror)
- Create: `web/lib/search/retrievers/fts-places.ts`
- Modify: `web/lib/search/types.ts` (add `"fts_places"` to `RetrieverId`)
- Modify: `web/lib/search/unified-retrieval.ts` (demux the new slice)
- Modify: `web/lib/search/retrievers/index.ts` (register the new retriever)
- Modify: `web/lib/search/search-service.ts` (call it in the parallel retriever block)

### Migration

```sql
-- database/migrations/20260414000001_search_unified_fts_places.sql
-- Adds fts_places CTE to search_unified for direct FTS against places.search_vector.
-- Phase 0 only used trigram for places; this closes the retrieval gap since
-- places.search_vector is 100% populated (Finding 2 in crawler-findings doc).

CREATE OR REPLACE FUNCTION public.search_unified(
  p_query         text,
  p_portal_id     uuid,
  p_types         text[],
  p_limit         int,
  p_categories    text[] DEFAULT NULL,
  p_neighborhoods text[] DEFAULT NULL,
  p_date_start    date   DEFAULT NULL,
  p_date_end      date   DEFAULT NULL,
  p_price_free    boolean DEFAULT NULL,
  p_venue_ids     bigint[] DEFAULT NULL
)
RETURNS SETOF jsonb
LANGUAGE plpgsql
STABLE
PARALLEL SAFE
SET statement_timeout TO '2s'
AS $$
-- ... existing function body preserved ...
-- Add this CTE parallel to fts_events, trgm_events, trgm_venues:
--
-- fts_places AS (
--   SELECT
--     'fts_places'::text AS retriever_id,
--     'venue'::text      AS entity_type,
--     p.id::text         AS id,
--     ts_rank_cd(p.search_vector, v_tsq) AS raw_score,
--     jsonb_build_object(
--       'title', p.name,
--       'subtitle', p.neighborhood,
--       'image_url', p.primary_image_url,
--       'href_slug', p.slug
--     ) AS payload
--   FROM public.places p
--   WHERE p.search_vector @@ v_tsq
--     AND p.id IN (SELECT place_id FROM portal_venues)
--   ORDER BY raw_score DESC
--   LIMIT p_limit * 2
-- )
--
-- Add to the final UNION ALL, returning jsonb rows.
```

**Implementation note for the subagent:** the exact function body needs to be copied from migration `20260413000010_search_unified_filters.sql` and the `fts_places` CTE added to the existing CTE list. The subagent must read the prior migration to see the full shape.

- [ ] **Step 1: Read prior migration**

```bash
cat database/migrations/20260413000010_search_unified_filters.sql
```

Identify the existing CTE pattern. Note: the function returns `SETOF jsonb`, each row has `retriever_id`, `entity_type`, and payload fields.

- [ ] **Step 2: Write the new migration**

Create `database/migrations/20260414000001_search_unified_fts_places.sql` with a full `CREATE OR REPLACE FUNCTION` that includes the `fts_places` CTE. Do NOT use a partial patch — `CREATE OR REPLACE FUNCTION` replaces the whole body.

Mirror the file verbatim to `supabase/migrations/20260414000001_search_unified_fts_places.sql`.

- [ ] **Step 3: Apply the migration locally**

Apply via Supabase migration tooling or psql. Verify with:

```sql
SELECT * FROM search_unified('jazz', '<atlanta-uuid>', ARRAY['event','venue'], 20);
```

The result should include rows with `retriever_id = 'fts_places'` if the query matches any place's name.

- [ ] **Step 4: Add `"fts_places"` to `RetrieverId`**

```typescript
// web/lib/search/types.ts
export type RetrieverId = "fts" | "trigram" | "structured" | "fts_places";
```

tsc will now flag every Map and switch that iterates RetrieverId — fix each one:
- `unified-retrieval.ts` — demux slot for `fts_places`
- `search-service.ts` — retriever loop includes `"fts_places"`
- `retrievers/index.ts` — registry factory
- `observability.ts` — `retriever_ms` map type

- [ ] **Step 5: Implement `FtsPlacesRetriever`**

Copy `web/lib/search/retrievers/fts.ts` to `web/lib/search/retrievers/fts-places.ts`. Change the retriever id to `"fts_places"` and have it read the `fts_places` slice from `UnifiedRetrievalResult`. Same purity contract — no DB calls, reads from pre-computed result.

The ESLint rule `local/no-retriever-rpc-calls` already guards `web/lib/search/retrievers/**` against `.rpc()` or supabase imports — no changes needed to the lint config.

- [ ] **Step 6: Update `unified-retrieval.ts`**

Read the RPC result and demux rows where `retriever_id === "fts_places"` into `UnifiedRetrievalResult.fts_places` alongside the existing `fts`, `trigram`, `structured` keys.

- [ ] **Step 7: Update `search-service.ts` retriever loop**

Add `"fts_places"` to the `retrieverIds: RetrieverId[] = [...]` array. The existing `Promise.all` pattern handles the parallel dispatch automatically.

- [ ] **Step 8: Run + commit**

```bash
cd web && npx vitest run lib/search && npx tsc --noEmit
git add database/migrations/20260414000001_* supabase/migrations/20260414000001_* web/lib/search/retrievers/fts-places.ts web/lib/search/retrievers/index.ts web/lib/search/types.ts web/lib/search/unified-retrieval.ts web/lib/search/search-service.ts
git commit -m "feat(search): add fts_places retriever — direct FTS against populated places.search_vector"
```

**Acceptance:**
- Migration applies cleanly
- `SELECT ... FROM search_unified('high', ...)` returns rows with `retriever_id = 'fts_places'` for "High Museum of Art"
- All existing retriever contract tests still pass
- The retriever-contract test explicitly covers `fts_places` in its fixture
- The `no-retriever-rpc-calls` lint rule still passes (the new file contains no DB imports)

---

## Task 4: Ranking boosts + MMR diversity + regression fixture

**Why:** Alias expansion + entity linking + FTS places produce better signal, but RRF still ranks by TF-IDF across retrievers — and boost-eligible matches (exact entity, whole-token, intent-preferred type) need to surface to the top. MMR prevents the boost amplification from collapsing top-N into a single venue.

**Architect's strongest point, folded in:** MMR MUST ship with the boosts. Without it, "brunch" returns 3 results from the same venue in the top, which is actively worse than Phase 0. The `RankingContext.diversityLambda` knob already exists — this task consumes it.

**Boost ordering (architect flag):** `intentTypeMultiplier` applies BEFORE `entityMatchBoost`, not after. Otherwise "jazz tonight" returns Jazz Bar venue #1 over tonight's jazz show — the event intent is swamped by the entity boost.

### Files

- Create: `web/lib/search/ranking/boost-rules.ts`
- Create: `web/lib/search/ranking/mmr.ts`
- Create: `web/lib/search/__tests__/ranking-quality.test.ts` (env-gated, live DB)
- Modify: `web/lib/search/ranking/rrf.ts` (consume `diversityLambda` by calling MMR as a post-pass)
- Modify: `web/lib/search/search-service.ts` (apply `BoostRules` after `RrfRanker.rank`)

### Steps

- [ ] **Step 1: Write the boost rules**

```typescript
// web/lib/search/ranking/boost-rules.ts
import type { RankedCandidate } from "@/lib/search/ranking/types";
import type { AnnotatedQuery } from "@/lib/search/understanding/types";

export interface BoostRules {
  intentTypeMultiplier: number;  // applied FIRST — intent wins over entity
  entityMatchBoost: number;      // applied SECOND — entity match on top of intent
  wholeTokenBoost: number;       // applied THIRD — whole-token title match
}

export const DEFAULT_BOOSTS: BoostRules = {
  intentTypeMultiplier: 1.4,  // 40% multiplier for intent-preferred types
  entityMatchBoost: 0.5,       // additive boost for entity-linked matches
  wholeTokenBoost: 0.2,        // additive boost for whole-token title matches
};

/**
 * Apply boosts in strict order:
 *   1. Intent type multiplier — multiplicative, preserves relative ranking within type
 *   2. Entity match boost — additive, promotes confident venue matches
 *   3. Whole-token title match boost — additive, fallback for non-entity matches
 *
 * Returns a NEW array sorted by boosted final_score descending. Input not mutated.
 */
export function applyBoosts(
  ranked: ReadonlyArray<RankedCandidate>,
  annotated: AnnotatedQuery,
  rules: BoostRules = DEFAULT_BOOSTS
): RankedCandidate[] {
  const preferredType = intentToPreferredType(annotated.intent.type);
  const venueIdSet = new Set(annotated.structured_filters.venue_ids ?? []);
  const normalizedTokens = annotated.tokens
    .filter((t) => !t.stop)
    .map((t) => t.normalized);

  const boosted: RankedCandidate[] = ranked.map((c) => {
    let score = c.final_score;

    // 1. Intent type multiplier (applied FIRST)
    if (preferredType && c.type === preferredType) {
      score *= rules.intentTypeMultiplier;
    }

    // 2. Entity match boost (applied SECOND, on top of intent)
    if (c.type === "venue" && venueIdSet.has(c.id)) {
      score += rules.entityMatchBoost;
    }

    // 3. Whole-token title match boost (applied THIRD)
    const title = (c.payload.title as string | undefined)?.toLowerCase() ?? "";
    const titleTokens = title.split(/\s+/);
    const hasWholeTokenMatch = normalizedTokens.some((qt) =>
      titleTokens.includes(qt)
    );
    if (hasWholeTokenMatch) {
      score += rules.wholeTokenBoost;
    }

    return { ...c, final_score: score };
  });

  // Re-sort by boosted score and reassign rank positions.
  boosted.sort((a, b) => b.final_score - a.final_score);
  boosted.forEach((c, i) => { c.rank = i; });
  return boosted;
}

function intentToPreferredType(
  intent: AnnotatedQuery["intent"]["type"]
): RankedCandidate["type"] | null {
  switch (intent) {
    case "find_event":      return "event";
    case "find_venue":      return "venue";
    case "browse_category": return null;  // no preference
    case "unknown":         return null;
    default:                return null;
  }
}
```

- [ ] **Step 2: Write MMR**

```typescript
// web/lib/search/ranking/mmr.ts
import type { RankedCandidate } from "@/lib/search/ranking/types";

/**
 * Maximal Marginal Relevance reranker. Promotes diversity by penalizing
 * candidates that share a key with already-selected candidates (e.g., same
 * venue_name, same category). Lambda=0 is pure relevance (no diversity),
 * lambda=1 is maximum diversity (ignores relevance).
 *
 * Phase 1 default: 0.3 — conservative, lets relevance dominate but prevents
 * top-N from being 8 results from the same venue. Phase 2 can tune based on
 * query-volume data from search_events.
 *
 * Similarity key: venue_name for events (prevents 1 venue hogging top-N for
 * a category query like "brunch"); title for venues (prevents 1 chain dominating).
 */
export function applyMmr(
  ranked: ReadonlyArray<RankedCandidate>,
  lambda: number
): RankedCandidate[] {
  if (lambda <= 0) return [...ranked];
  if (ranked.length <= 1) return [...ranked];

  const selected: RankedCandidate[] = [];
  const remaining: RankedCandidate[] = [...ranked];

  // Always take the top relevance result first.
  selected.push(remaining.shift()!);

  while (remaining.length > 0) {
    let bestIdx = 0;
    let bestScore = -Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const candidate = remaining[i];
      const relevance = candidate.final_score;
      const maxSim = Math.max(
        ...selected.map((s) => similarityKey(candidate, s))
      );
      const mmrScore = (1 - lambda) * relevance - lambda * maxSim;
      if (mmrScore > bestScore) {
        bestScore = mmrScore;
        bestIdx = i;
      }
    }
    selected.push(remaining.splice(bestIdx, 1)[0]);
  }

  selected.forEach((c, i) => { c.rank = i; });
  return selected;
}

function similarityKey(a: RankedCandidate, b: RankedCandidate): number {
  // Same exact entity → max similarity (though the dedupe in presenter catches this)
  if (a.type === b.type && a.id === b.id) return 1;

  // Same venue → high similarity (prevents venue clustering in top-N)
  const aVenue = (a.payload.venue_name as string | undefined) ?? (a.payload.subtitle as string | undefined);
  const bVenue = (b.payload.venue_name as string | undefined) ?? (b.payload.subtitle as string | undefined);
  if (aVenue && bVenue && aVenue.toLowerCase() === bVenue.toLowerCase()) return 0.8;

  // Same category → moderate similarity
  const aCat = a.payload.category_id as string | undefined;
  const bCat = b.payload.category_id as string | undefined;
  if (aCat && bCat && aCat === bCat) return 0.4;

  return 0;
}
```

- [ ] **Step 3: Wire MMR into RrfRanker**

```typescript
// web/lib/search/ranking/rrf.ts
// ... existing RRF body ...
// At the bottom of rank(), after ranked is assigned:
  const lambda = _ctx.diversityLambda ?? 0.3;
  const diversified = applyMmr(ranked, lambda);
  return diversified;
```

Rename `_ctx` to `ctx` in the `rank` function signature since we're now using it.

- [ ] **Step 4: Wire boost rules into `search-service.ts`**

After `RrfRanker.rank()` returns, apply boosts before passing to the presenter:

```typescript
import { applyBoosts, DEFAULT_BOOSTS } from "@/lib/search/ranking/boost-rules";

// ... in search() ...
const ranked = RrfRanker.rank(candidateSets, {
  weights: {},
  intent: annotated.intent,
  diversityLambda: 0.3,
});
const boosted = applyBoosts(ranked, annotated, DEFAULT_BOOSTS);
const presented = GroupedPresenter.present(boosted, DEFAULT_POLICY);
```

- [ ] **Step 5: Write the regression fixture**

```typescript
// web/lib/search/__tests__/ranking-quality.test.ts
import { describe, it, expect, beforeAll } from "vitest";
import { search } from "@/lib/search";
import { createServiceClient } from "@/lib/supabase/service";

const hasDb = Boolean(
  (process.env.NEXT_PUBLIC_SUPABASE_URL &&
   process.env.NEXT_PUBLIC_SUPABASE_URL !== "https://test.supabase.co") &&
  (process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)
);

const maybe = hasDb ? describe : describe.skip;

maybe("ranking quality regression fixture", () => {
  let portalId: string;

  beforeAll(async () => {
    const client = createServiceClient();
    const res = await client
      .from("portals")
      .select("id")
      .eq("slug", "atlanta")
      .single();
    const data = res.data as { id: string } | null;
    portalId = data?.id ?? "";
    if (!portalId) throw new Error("atlanta portal not found in test DB");
  });

  const POSITIVE_CASES = [
    { query: "the earl",   expectTopMatch: { type: "venue",  titlePattern: /the earl/i } },
    { query: "fox",        expectTopMatch: { type: "venue",  titlePattern: /fox theatre/i } },
    { query: "high",       expectTopMatch: { type: "venue",  titlePattern: /high museum/i } },
    { query: "garden",     expectTopMatch: { type: "venue",  titlePattern: /botanical garden/i } },
    { query: "masquerade", expectTopMatch: { type: "venue",  titlePattern: /^the masquerade$/i } },
    { query: "l5p",        expectTopMatch: { type: "venue",  titlePattern: /(little five points|5 points)/i } },
  ];

  for (const c of POSITIVE_CASES) {
    it(`positive: "${c.query}" → ${c.expectTopMatch.titlePattern}`, async () => {
      const result = await search(c.query, {
        portal_id: portalId,
        portal_slug: "atlanta",
        limit: 20,
      });
      const top = result.presented.topMatches[0];
      expect(top).toBeDefined();
      expect(top?.type).toBe(c.expectTopMatch.type);
      const title = (top?.payload.title as string | undefined) ?? "";
      expect(title).toMatch(c.expectTopMatch.titlePattern);
    });
  }

  // NEGATIVE CASES: explicitly check that intent wins over entity boost
  it("negative: 'jazz tonight' returns at least one event in top 3 (intent > entity)", async () => {
    const result = await search("jazz tonight", {
      portal_id: portalId,
      portal_slug: "atlanta",
      limit: 20,
    });
    const top3 = result.presented.topMatches.slice(0, 3);
    expect(top3.length).toBeGreaterThan(0);
    const hasEvent = top3.some((c) => c.type === "event");
    expect(hasEvent).toBe(true);
  });

  it("negative: 'the earl show' includes events AT The Earl in top 5 (not just the venue)", async () => {
    const result = await search("the earl show", {
      portal_id: portalId,
      portal_slug: "atlanta",
      limit: 20,
    });
    const top5 = result.presented.topMatches.slice(0, 5);
    const hasEarlEvent = top5.some(
      (c) =>
        c.type === "event" &&
        ((c.payload.venue_name as string | undefined) ?? "").match(/the earl/i)
    );
    expect(hasEarlEvent).toBe(true);
  });

  // DIVERSITY CASE: MMR should prevent single-venue clustering
  it("diversity: 'brunch' top 5 includes at least 2 distinct venues", async () => {
    const result = await search("brunch", {
      portal_id: portalId,
      portal_slug: "atlanta",
      limit: 20,
    });
    const top5 = result.presented.topMatches.slice(0, 5);
    const venueNames = new Set(
      top5.map((c) => (c.payload.venue_name as string | undefined) ?? "")
    );
    expect(venueNames.size).toBeGreaterThanOrEqual(2);
  });
});
```

- [ ] **Step 6: Iterate boost weights until fixture passes (bounded)**

Run: `source web/.env.local && cd web && npx vitest run lib/search/__tests__/ranking-quality.test.ts`

Failure loop with a HARD TERMINATION GATE:

1. Run fixture.
2. If all cases pass → done.
3. If some fail, adjust boost weights: `entityMatchBoost` between [0.3, 0.8], `intentTypeMultiplier` between [1.2, 1.6], `wholeTokenBoost` between [0.1, 0.3]. Default MMR lambda stays at 0.3.
4. Maximum **3 iterations**. If not all passing after 3, STOP and surface the failing cases for human review. Do NOT grind.
5. Do NOT special-case individual fixture queries. If a query needs a bespoke rule, the rule must apply to the general class of queries, not just that one.

Fixture gaming is forbidden. If tuning hits the iteration limit, it means the boost abstractions are wrong and the plan needs re-thinking — not more tuning.

- [ ] **Step 7: Run + commit**

```bash
cd web && npx vitest run lib/search && npx tsc --noEmit
git add web/lib/search/ranking/ web/lib/search/search-service.ts web/lib/search/__tests__/ranking-quality.test.ts
git commit -m "feat(search): ranking boosts + MMR diversity with regression fixture"
```

**Acceptance:**
- All 6 positive cases pass
- Both negative cases pass (intent > entity, entity doesn't suppress events)
- Diversity case passes (brunch top 5 has ≥2 distinct venues)
- `lib/search` unit-test suite still green (no regressions from the RRF + MMR integration)
- Boost weights sit within the documented ranges

---

## Task 5: Observability + perf wins bundle

**Why:** These are small-cost, load-bearing items the architect and code-quality reviewers flagged. Bundled because they're all ~15-minute changes that unblock observability for future tuning AND fix 3 lingering items from Phase 0 reviews.

### Files

- Modify: `web/lib/search/observability.ts` (fill `retriever_ms` map + add `zero_result` flag)
- Modify: `web/lib/search/search-service.ts` (capture per-retriever timings)
- Modify: `web/app/[portal]/api/search/unified/route.ts` (pass timings to logger)
- Modify: `web/lib/hooks/useVisualViewportHeight.ts` (accept `active` param)
- Modify: `web/components/search/UnifiedSearchShell.tsx` (pass `overlayOpen` to hook)
- Modify: `web/app/[portal]/api/search/unified/personalize/route.ts` (single-query !inner join)

### Steps

- [ ] **Step 1: Per-retriever timings**

In `search-service.ts`, replace the `Promise.all` retriever block with timed dispatch:

```typescript
const retrieverStarts = new Map<RetrieverId, number>();
const retrieverEnds = new Map<RetrieverId, number>();

const retrieverResults = await Promise.all(
  retrieverIds.map(async (id) => {
    retrieverStarts.set(id, Date.now());
    try {
      const result = await registry[id].retrieve(annotated, { ... });
      retrieverEnds.set(id, Date.now());
      return result;
    } catch (err) {
      retrieverEnds.set(id, Date.now());
      throw err;
    }
  })
);

const retrieverMs: Partial<Record<RetrieverId, number>> = {};
for (const id of retrieverIds) {
  const start = retrieverStarts.get(id);
  const end = retrieverEnds.get(id);
  if (start !== undefined && end !== undefined) {
    retrieverMs[id] = end - start;
  }
}
```

Pass `retrieverMs` into the returned `diagnostics` object (replacing the current empty `{}`).

- [ ] **Step 2: Zero-result flag**

In `observability.ts`, add `zero_result: boolean` to the `SearchEventRow` shape if not present. Populate from `presented.topMatches.length === 0 && presented.sections.length === 0`.

- [ ] **Step 3: `useVisualViewportHeight` gate**

Modify the hook signature to accept an `active` parameter:

```typescript
// web/lib/hooks/useVisualViewportHeight.ts
export function useVisualViewportHeight(active: boolean = true): number {
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    if (!active) return;  // short-circuit — no listeners attached
    const vv = window.visualViewport;
    if (!vv) return;
    // ... existing handler + cleanup ...
  }, [active]);

  return active ? offset : 0;
}
```

In `UnifiedSearchShell.tsx`, pass the overlay-open state:

```typescript
const vpOffset = useVisualViewportHeight(mode === "overlay" && overlayOpen);
```

- [ ] **Step 4: Personalize single-query `!inner` join**

Refactor `personalize/route.ts` to replace the current two-phase query (portal filter → saved items) with a single JOIN:

```typescript
// Instead of: query events first, then saved_items with portal-scoped ids
// Use: saved_items JOIN events WHERE events.portal_id = portal.id
const res = await serviceClient
  .from("saved_items")
  .select("event_id, events!inner(portal_id)")
  .eq("user_id", user.id)
  .eq("events.portal_id", portal.id)
  .in("event_id", eventIntIds)
  .not("event_id", "is", null);
```

Same pattern for `event_rsvps`. Venues use the `portal_venues` rule so they need a separate place_id → portal_id resolution; if Supabase's PostgREST doesn't support the nested join cleanly, revert to the Phase 0.5 two-query version and note it. Don't break the existing behavior to chase a minor perf win.

- [ ] **Step 5: Run + commit**

```bash
cd web && npx vitest run lib/search components/search && npx tsc --noEmit
git add web/lib/search/observability.ts web/lib/search/search-service.ts "web/app/[portal]/api/search/unified/route.ts" "web/app/[portal]/api/search/unified/personalize/route.ts" web/lib/hooks/useVisualViewportHeight.ts web/components/search/UnifiedSearchShell.tsx
git commit -m "feat(search): observability + perf bundle (retriever timings, zero-result flag, useVisualViewportHeight gate, personalize join)"
```

**Acceptance:**
- `retriever_ms` map in `search_events` is now populated with real per-retriever numbers
- `zero_result` flag is set on search_events rows where `len(top+sections)===0`
- `useVisualViewportHeight` listener is NOT attached on non-overlay pages (verify via DevTools event listener count)
- Personalize route passes existing tests (the join change is a refactor, not a behavior change)
- tsc clean

---

## Task 6: Recent searches server-sync

**Why:** Phase 0 ships localStorage-only recents. For cross-device continuity, the `user_recent_searches` table + `insert_recent_search` RPC ALREADY ship — we just need to hook up the client and add a GET endpoint. Promoted from "time-permitting" to mandatory per the agentic-lens re-triage.

### Files

- Create: `web/app/[portal]/api/search/recents/route.ts` (GET handler)
- Modify: `web/components/search/UnifiedSearchShell.tsx` (write-through + hydration)

### Steps

- [ ] **Step 1: Write the GET endpoint**

`/[portal]/api/search/recents` (GET). Inline auth pattern matching `personalize/route.ts`. Read up to 20 recent entries from `user_recent_searches` filtered by `user_id = user.id` and `portal_id = portal.id`, return as `{ recents: string[] }`.

- [ ] **Step 2: Write-through on persist**

In `UnifiedSearchShell`'s existing 1500ms debounced recent-persist effect, also POST to the existing `/api/user/recent-searches` route (Phase 0 shipped this). Use `fetch()` with `credentials: "same-origin"`. Log failures to console without blocking the localStorage write.

- [ ] **Step 3: Hydration on overlay open**

On overlay open for authed users (use `useSearchStore(s => s.overlayOpen)` + auth context), fetch `/${portalSlug}/api/search/recents`. Merge with localStorage (dedupe by term, server state wins, cap at 50). Hydrate once per session — use a `useRef` flag.

- [ ] **Step 4: Run + commit**

```bash
cd web && npx vitest run && npx tsc --noEmit
git add web/app/[portal]/api/search/recents/route.ts web/components/search/UnifiedSearchShell.tsx
git commit -m "feat(search): server-sync recent searches for cross-device continuity"
```

**Acceptance:**
- Authed user searches on device A, opens overlay on device B, sees the search in the list
- Unauth users get localStorage-only behavior (no regression)
- No console errors on the write-through path when offline (graceful degradation)

---

## Task 7: Exhibition card — DONE via hotfix

**Status:** Completed ahead of the sprint via PR #17 (commit `c7f94cd1`). Exhibition results now render in `ResultCard`. No work needed in this sprint.

---

## Sprint acceptance

- [ ] Tasks 1-6 complete with passing tests
- [ ] `lib/search` vitest suite green
- [ ] `tsc --noEmit` clean
- [ ] `ranking-quality.test.ts` (env-gated) passes all positive + negative + diversity cases when run with real DB credentials
- [ ] `retriever_ms` map populated with real per-retriever numbers in `search_events` rows
- [ ] Manual dev-server smoke on `/atlanta`:
  - `l5p` → Little Five Points venues/events in top 3
  - `o4w` → Old Fourth Ward results
  - `brunch` → food_drink events with venue diversity in top 5
  - `the earl` → The Earl venue #1
  - `fox` → Fox Theatre venue top 3
  - `high` → High Museum of Art #1
  - `garden` → Atlanta Botanical Garden #1
  - `jazz tonight` → at least one event in top 3 (intent > entity)
- [ ] Cross-device recent-search test: authed user searches on laptop, sees it on phone
- [ ] All commits conventional, no `--no-verify`
- [ ] Sprint ships as one PR stacked on main

## Signals the sprint is off-track

- Any task taking materially longer than the surrounding tasks (agentic sprints have relatively flat task costs when correctly scoped)
- Regressions in existing `lib/search` tests from the boost-rules change → tuning is over-aggressive, back off
- The fixture test requires query-specific special-casing → don't. If a class of queries needs a rule, the rule must apply to the class.
- Entity cache TTL exceeded because the cold-start query is slow → investigate places row count (should be ~6.8k for Atlanta)
- MMR diversity produces worse top-N than no diversity → lambda is too high, lower to 0.15-0.2 range

## Rollback

If any task causes a production regression after merge:

- **Task 1 (aliases):** feature-flag via `DEFAULT_BOOSTS` — set `entityMatchBoost` and `wholeTokenBoost` to 0 to effectively disable alias-driven structured_filters. No code revert needed.
- **Task 2 (entity linking):** revert `entities.ts` to the stub returning `[]`. The cache module stays unused.
- **Task 3 (fts_places):** `DROP FUNCTION public.search_unified(...)` and re-apply migration `20260413000010`. No data loss.
- **Task 4 (boosts + MMR):** set `DEFAULT_BOOSTS` to all-zero and `diversityLambda` to 0 in `search-service.ts`. No code revert needed.
- **Task 5 (observability bundle):** individual commits per file allow cherry-pick revert.
- **Task 6 (recent searches):** the write-through is additive — disable via feature flag or revert the component change.
