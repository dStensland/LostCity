# Big Stuff See-All Page Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite `/[portal]/festivals` from a 3-col poster grid into a calendar-spined browse page: collapsed-sticky month ribbon, tier-driven hero-per-month with compact rows below, type-color accents, client-side filter chips, happening-now folded into the current month with LIVE NOW pill.

**Architecture:** Server component (RSC) renders metadata + loads data via new `loadBigStuffForPage`. Client island `<BigStuffPage>` owns filter state and the scroll/ribbon interaction. Pure helpers (`extractTeaser`, `getBigStuffType`, `groupItemsByMonth`) are unit-tested. Components are split by responsibility: page root, ribbon (full + collapsed-sticky), month section, hero card, compact row, filter chips.

**Tech Stack:** Next.js 16 (App Router, RSC), TypeScript, Supabase, Tailwind v4 `@theme inline` tokens, Phosphor icons, Vitest + React Testing Library.

**Spec:** `docs/superpowers/specs/2026-04-18-big-stuff-page-redesign.md` (read first).

**Reference files (read before starting):**
- `web/app/[portal]/festivals/page.tsx` — current implementation (being rewritten).
- `web/lib/city-pulse/loaders/big-stuff-shared.ts` — `BigStuffItem`, `BigStuffMonthBucket`, `groupItemsByMonth` (reused).
- `web/lib/city-pulse/loaders/load-big-stuff.ts` — existing loader to mirror the query shape.
- `web/lib/city-pulse/feed-section-contract.ts` — `FeedSectionContext`.
- `web/lib/festivals.ts` — existing Festival types for reference.
- `web/components/filters/FilterChip.tsx` — reused chip component; variants: `date`=gold, `vibe`=lavender, `access`=cyan, `free`=green, `default`=muted.
- `web/components/SmartImage.tsx` — use for all images.
- `web/CLAUDE.md` — token + recipe conventions.
- `docs/design-truth.md` — anti-patterns to avoid.

---

## Task 1: Create the Pencil comp

**Goal:** Per design-truth rule "no comp = no implementation," design this page in Pencil before any code. Use the Pencil MCP, echoing the existing feed ribbon visual vocabulary at page scale.

**Files:** adds a top-level frame in `docs/design-system.pen` — node name `Big Stuff — See-All Page (Desktop)`, referenced as node id in subsequent tasks.

- [ ] **Step 1: Open the design-system file + survey siblings**

Invoke the pencil skill path: get editor state → open `docs/design-system.pen` → `batch_get` existing Atlanta page compositions (e.g., `Z9AcJ` Feed Homepage, `BxHW9` Events View) to study typographic + spacing rhythm.

Reference the existing feed-ribbon node `qOUCP` ("Big Stuff — Feed (Month Ribbon)") to keep the month/badge vocabulary consistent.

- [ ] **Step 2: Find empty canvas space**

Run `mcp__pencil__find_empty_space_on_canvas` (direction=right, size=1440×2400, padding=80) starting from `qOUCP`. Record the coordinates.

- [ ] **Step 3: Insert the top-level frame**

Create a new top-level frame at the returned coordinates:
- `width: 1440`, `height: "fit_content"`, `layout: "vertical"`, `gap: 24`, `padding: [48, 64]`, `fill: "#09090B"` (--void), `name: "Big Stuff — See-All Page (Desktop)"`.

Record the node id (the operation returns it) — call it `PAGE_NODE_ID`. Record it in scratch notes for use in Tasks 2, 15, and 16.

- [ ] **Step 4: Build the header block**

Inside PAGE_NODE_ID, add:
- Title text: `"The Big Stuff"`, Bricolage Grotesque 32/700 cream, letter-spacing -0.5.
- Subtitle text: `"Festivals, tentpoles, and season-defining moments"`, Outfit 14 muted.
- Row of filter chips (5 placeholders: `All 45`, `Festivals 28`, `Conventions 11`, `Sports 4`, `Community 2`) — use the existing `olqzW` FilterChip ref + overrides per chip.
- Full month ribbon: horizontal row of 6 month columns, each with month label (Space Mono 14 bold cream tracking 0.12em uppercase), a smaller count line below (`12 EVENTS`, Space Mono 10 muted), and a current-month gold dot on APR. Container: `rounded-card`, `bg-[var(--night)]`, `border --twilight 1`, height ~96px.

- [ ] **Step 5: Build two month sections as examples**

Inside PAGE_NODE_ID, below the header:
- Month anchor: `═══ APR 2026 ═══` (Space Mono 12 bold cream uppercase tracking 0.14em, `border-t --twilight 1` spanning 100%).
- Hero card: 21:9 landscape image placeholder (`#252530` rect), type pill overlay top-left (gold pill with "FESTIVAL"), LIVE NOW pill beside if current month. Below image: title (Bricolage 28/700 cream), meta line (Outfit 13 muted), teaser (Outfit 13 soft, 2 lines). Card container: `bg-[var(--night)]`, `border --twilight 1`, `rounded-card`, `border-l-2` in type-color.
- 2–3 compact rows under the hero: `72×72` thumb + title + meta + type pill, row container same treatment with type-color left border.

Do this for APR (hero = Inman Park Festival placeholder, rows for Streets Alive + NASCAR + Blue Ridge) and MAY (hero = Shaky Knees, rows for Sweetwater 420 + Dunwoody Art + Atlanta Jazz + Food & Wine).

- [ ] **Step 6: Add the collapsed-sticky strip preview**

Off to the side of PAGE_NODE_ID (or as a second top-level frame named "Big Stuff — Collapsed Strip"), show a 1440×32 row: horizontal pill list of months, Space Mono 10 mono tracking 0.08em uppercase, active-month highlighted in gold. This is separate because it's a scroll state, not a static layout.

- [ ] **Step 7: Screenshot and visually review**

Run `mcp__pencil__get_screenshot` on PAGE_NODE_ID. Check:
- Header reads as one unit; filter chips align right/below title comfortably.
- Ribbon + body below have consistent left alignment.
- Hero card and rows have visible type-color accent.
- Section spacing feels intentional (not cramped, not airy).

If anything looks off, iterate via `batch_design` operations.

- [ ] **Step 8: Design review**

Invoke the `product-designer` agent with the PAGE_NODE_ID and the spec path. Agent returns VERDICT: BLOCK / PASS-WITH-NOTES / PASS.

Address any BLOCK-level notes before proceeding. PASS-WITH-NOTES can be deferred to the implementation's `/design-handoff verify` pass.

- [ ] **Step 9: Record the node id + commit**

```bash
# No file change (the .pen file is modified in place via MCP but tracked binary-style);
# if the git status shows design-system.pen modified, commit it:
git add docs/design-system.pen
git commit -m "design: Big Stuff see-all page comp in Pencil (node $PAGE_NODE_ID)"
```

Update the spec file to record the node id:

```bash
# replace the open-items section with the recorded node id
```

Or add a note to the top of the plan under "Pencil comp:" line. (Either works; what matters is the id is captured.)

---

## Task 2: Extract design spec from Pencil

**Files:** creates `docs/design-specs/big-stuff-page.md`.

**Goal:** Produce a CSS-ready spec the implementation tasks can follow. Pencil's MCP + the `design-handoff` skill do most of the work.

- [ ] **Step 1: Run extract**

Invoke: `/design-handoff extract $PAGE_NODE_ID` (the node id recorded in Task 1).

Follow the skill prompts. Output lands in `docs/design-specs/big-stuff-page.md`.

- [ ] **Step 2: Review the spec for completeness**

Open the generated spec. Verify presence of:
- Header block (title, subtitle, filter chips, ribbon).
- Month section layout (anchor, hero, rows).
- Hero card (image, overlays, body block).
- Compact row (thumb, title, meta, pill).
- Collapsed strip (separate frame or section).

If sections are missing (e.g., collapsed strip wasn't extracted), add them manually with reference to the implementation notes in Task 11 and Task 12 below.

- [ ] **Step 3: Commit**

```bash
git add docs/design-specs/big-stuff-page.md
git commit -m "design: extract Big Stuff see-all page spec from Pencil"
```

---

## Task 3: Teaser helper + type-derivation helper + shared page types

**Files:**
- Create: `web/lib/teaser.ts`
- Create: `web/lib/teaser.test.ts`
- Create: `web/lib/big-stuff/types.ts`
- Create: `web/lib/big-stuff/type-derivation.ts`
- Create: `web/lib/big-stuff/type-derivation.test.ts`

**Goal:** Three pure-function modules with full TDD. No component work depends on these yet; building them first locks the types the loader + components will consume.

- [ ] **Step 1: Write the failing teaser tests**

Create `web/lib/teaser.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { extractTeaser } from "./teaser";

describe("extractTeaser", () => {
  it("returns null for null input", () => {
    expect(extractTeaser(null)).toBeNull();
  });

  it("returns null for too-short input", () => {
    expect(extractTeaser("Short.")).toBeNull();
  });

  it("returns the first sentence when it fits 30-180 chars", () => {
    const desc = "A four-day rock festival anchored at Piedmont Park. Additional details follow here.";
    expect(extractTeaser(desc)).toBe("A four-day rock festival anchored at Piedmont Park.");
  });

  it("truncates at a word boundary with ellipsis if first sentence is too long", () => {
    const desc = "This is a very long first sentence that exceeds the 180-character limit and just keeps going and going with lots of filler words to make sure we actually hit the cap before finding a period somewhere";
    const result = extractTeaser(desc);
    expect(result).toMatch(/…$/);
    expect(result!.length).toBeLessThanOrEqual(161); // 160 + …
    expect(result).not.toMatch(/\w…$/); // must break at word boundary, not mid-word
  });

  it("returns null when input contains markdown fences", () => {
    expect(extractTeaser("A festival. ```json\n{stuff}\n```")).toBeNull();
  });

  it("returns null when input looks like a URL", () => {
    expect(extractTeaser("https://example.com/very-long-url-that-is-not-a-description")).toBeNull();
  });

  it("returns null for input between 1 and 29 chars", () => {
    expect(extractTeaser("A party.")).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests (should fail — module missing)**

```bash
cd web && npx vitest run lib/teaser.test.ts
```

Expected: FAIL with "Cannot find module './teaser'".

- [ ] **Step 3: Implement the teaser module**

Create `web/lib/teaser.ts`:

```typescript
/**
 * Extract a short "teaser" sentence from a longer description.
 * Returns null if no meaningful teaser can be produced.
 *
 * Rules:
 * - Reject null, markdown fences, URL-only strings.
 * - Reject under 30 chars.
 * - First sentence boundary (.?!) if length 30-180 → return it.
 * - Else truncate at 160 chars on a word boundary + ellipsis.
 */
export function extractTeaser(input: string | null): string | null {
  if (!input) return null;
  const s = input.trim();
  if (s.length < 30) return null;
  if (s.includes("```")) return null;
  // Raw URL (the whole string is a URL)
  if (/^https?:\/\/\S+$/.test(s)) return null;

  // First sentence boundary
  const match = s.match(/^(.{30,180}?[.!?])(\s|$)/);
  if (match) return match[1];

  // Truncate on word boundary, up to 160 chars, add ellipsis
  const hardCap = 160;
  if (s.length <= hardCap) return s;
  const slice = s.slice(0, hardCap);
  const lastSpace = slice.lastIndexOf(" ");
  const cut = lastSpace > 100 ? slice.slice(0, lastSpace) : slice;
  return cut + "…";
}
```

- [ ] **Step 4: Run the tests (should pass)**

```bash
cd web && npx vitest run lib/teaser.test.ts
```

Expected: 7/7 PASS.

- [ ] **Step 5: Write the failing type-derivation tests**

Create `web/lib/big-stuff/type-derivation.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { getBigStuffType } from "./type-derivation";
import type { RawBigStuffItem } from "./types";

const mk = (partial: Partial<RawBigStuffItem>): RawBigStuffItem => ({
  kind: "festival",
  title: "Item",
  festivalType: null,
  category: null,
  ...partial,
});

describe("getBigStuffType", () => {
  it("maps festival_type=festival to 'festival'", () => {
    expect(getBigStuffType(mk({ kind: "festival", festivalType: "festival" }))).toBe("festival");
  });

  it("maps festival_type=convention to 'convention'", () => {
    expect(getBigStuffType(mk({ kind: "festival", festivalType: "convention" }))).toBe("convention");
  });

  it("maps festival_type=conference to 'convention'", () => {
    expect(getBigStuffType(mk({ kind: "festival", festivalType: "conference" }))).toBe("convention");
  });

  it("maps festival_type=community to 'community'", () => {
    expect(getBigStuffType(mk({ kind: "festival", festivalType: "community" }))).toBe("community");
  });

  it("falls back from unknown festival_type to 'festival'", () => {
    expect(getBigStuffType(mk({ kind: "festival", festivalType: null }))).toBe("festival");
  });

  it("tentpole: FIFA World Cup match → 'sports'", () => {
    expect(getBigStuffType(mk({ kind: "tentpole", title: "FIFA World Cup 26™ - Spain vs. Cabo Verde" }))).toBe("sports");
  });

  it("tentpole: AJC Peachtree Road Race → 'sports'", () => {
    expect(getBigStuffType(mk({ kind: "tentpole", title: "AJC Peachtree Road Race 2026" }))).toBe("sports");
  });

  it("tentpole: NASCAR at Atlanta Motor Speedway → 'sports'", () => {
    expect(getBigStuffType(mk({ kind: "tentpole", title: "NASCAR at Atlanta Motor Speedway" }))).toBe("sports");
  });

  it("tentpole: DragonCon → 'convention'", () => {
    expect(getBigStuffType(mk({ kind: "tentpole", title: "Dragon Con" }))).toBe("convention");
  });

  it("tentpole: MomoCon → 'convention'", () => {
    expect(getBigStuffType(mk({ kind: "tentpole", title: "MomoCon" }))).toBe("convention");
  });

  it("tentpole: Juneteenth Atlanta Parade → 'community'", () => {
    expect(getBigStuffType(mk({ kind: "tentpole", title: "Juneteenth Atlanta Parade & Music Festival" }))).toBe("community");
  });

  it("tentpole: Atlanta Streets Alive → 'community'", () => {
    expect(getBigStuffType(mk({ kind: "tentpole", title: "Atlanta Streets Alive" }))).toBe("community");
  });

  it("tentpole: music festival title → 'festival'", () => {
    expect(getBigStuffType(mk({ kind: "tentpole", title: "Atlanta Jazz Festival", category: "music" }))).toBe("festival");
  });

  it("tentpole: no match → 'other'", () => {
    expect(getBigStuffType(mk({ kind: "tentpole", title: "Some Random Event" }))).toBe("other");
  });
});
```

- [ ] **Step 6: Write the types module**

Create `web/lib/big-stuff/types.ts`:

```typescript
import type { BigStuffItem } from "@/lib/city-pulse/loaders/big-stuff-shared";

export type BigStuffType = "festival" | "convention" | "sports" | "community" | "other";

/** Minimal shape for deriving type — keeps the derivation testable without DB coupling. */
export interface RawBigStuffItem {
  kind: "festival" | "tentpole";
  title: string;
  festivalType: string | null;
  category: string | null;
}

export interface BigStuffPageItem extends BigStuffItem {
  type: BigStuffType;
  isLiveNow: boolean;
  description: string | null;
  imageUrl: string | null;
  tier: "hero" | "featured" | "standard";
}

export interface BigStuffPageData {
  items: BigStuffPageItem[];
}

/** Color tokens per type — used to map to Tailwind classes in components. */
export const TYPE_ACCENT: Record<BigStuffType, string> = {
  festival: "var(--gold)",
  convention: "var(--vibe)",
  sports: "var(--neon-cyan)",
  community: "var(--neon-green)",
  other: "var(--muted)",
};

/** Human-readable label per type for chips + pills. */
export const TYPE_LABEL: Record<BigStuffType, string> = {
  festival: "FESTIVAL",
  convention: "CONVENTION",
  sports: "SPORTS",
  community: "COMMUNITY",
  other: "OTHER",
};
```

- [ ] **Step 7: Implement type-derivation**

Create `web/lib/big-stuff/type-derivation.ts`:

```typescript
import type { BigStuffType, RawBigStuffItem } from "./types";

// Precompiled regexes for tentpole title matching.
const SPORTS_RE = /\b(marathon|5k|10k|race|cup|match|nascar|peachtree)\b/i;
const COMMUNITY_RE = /\b(parade|streets alive|juneteenth|pride)\b/i;
const CONVENTION_RE = /(\b|^)[A-Z][a-z]*con\b/; // DragonCon, MomoCon, Frolicon
const FESTIVAL_IN_TITLE_RE = /\bfestival\b/i;

export function getBigStuffType(item: RawBigStuffItem): BigStuffType {
  if (item.kind === "festival") {
    const ft = (item.festivalType ?? "").toLowerCase();
    if (ft === "festival") return "festival";
    if (ft === "convention" || ft === "conference") return "convention";
    if (ft === "community") return "community";
    // Unknown/null festival_type → default to festival (data correctness assumption).
    return "festival";
  }

  // Tentpole event — apply title + category heuristics.
  const title = item.title ?? "";
  const cat = (item.category ?? "").toLowerCase();

  if (cat === "sports" || cat === "race" || cat === "running" || SPORTS_RE.test(title)) {
    return "sports";
  }
  if (COMMUNITY_RE.test(title)) return "community";
  if (CONVENTION_RE.test(title)) return "convention";
  if (FESTIVAL_IN_TITLE_RE.test(title)) return "festival";
  return "other";
}
```

- [ ] **Step 8: Run the tests (should pass)**

```bash
cd web && npx vitest run lib/big-stuff lib/teaser.test.ts
```

Expected: 14 derivation tests + 7 teaser tests = 21/21 PASS.

- [ ] **Step 9: TypeScript check**

```bash
cd web && npx tsc --noEmit
```

Expected: no new errors.

- [ ] **Step 10: Commit**

```bash
git add web/lib/teaser.ts web/lib/teaser.test.ts web/lib/big-stuff/types.ts web/lib/big-stuff/type-derivation.ts web/lib/big-stuff/type-derivation.test.ts
git commit -m "feat(big-stuff): teaser helper + type taxonomy + derivation"
```

---

## Task 4: Server loader for the see-all page

**Files:**
- Create: `web/lib/city-pulse/loaders/load-big-stuff-page.ts`
- Create: `web/lib/city-pulse/loaders/load-big-stuff-page.test.ts`

**Goal:** Mirror `load-big-stuff.ts` but relax festival_type filter, include in-progress events for the current month, and enrich each item with `type`, `isLiveNow`, `description`, `imageUrl`, `tier`.

- [ ] **Step 1: Write the failing test for the enrichment step**

Create `web/lib/city-pulse/loaders/load-big-stuff-page.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { enrichItem, type LoaderRow } from "./load-big-stuff-page";

describe("enrichItem", () => {
  const today = "2026-04-18";

  const festivalRow: LoaderRow = {
    kind: "festival",
    id: "f1",
    title: "Inman Park Festival",
    slug: "inman-park-festival",
    startDate: "2026-04-24",
    endDate: "2026-04-26",
    festivalType: "festival",
    category: null,
    description: "A neighborhood arts festival with live music. More details here.",
    imageUrl: "https://example.com/ipf.jpg",
    neighborhood: "Inman Park",
    location: null,
  };

  it("flags isLiveNow for festivals straddling today", () => {
    const row: LoaderRow = { ...festivalRow, startDate: "2026-04-10", endDate: "2026-04-25" };
    const item = enrichItem(row, today, "atlanta");
    expect(item.isLiveNow).toBe(true);
  });

  it("does NOT flag isLiveNow when startDate > today", () => {
    const item = enrichItem(festivalRow, today, "atlanta");
    expect(item.isLiveNow).toBe(false);
  });

  it("derives type=festival for festival_type=festival", () => {
    expect(enrichItem(festivalRow, today, "atlanta").type).toBe("festival");
  });

  it("derives tier=hero for flagship or imaged festival", () => {
    expect(enrichItem(festivalRow, today, "atlanta").tier).toBe("hero");
  });

  it("derives tier=featured when image but not festival", () => {
    const row: LoaderRow = { ...festivalRow, kind: "tentpole", title: "Some Event", festivalType: null };
    expect(enrichItem(row, today, "atlanta").tier).toBe("featured");
  });

  it("derives tier=standard when no image", () => {
    const row: LoaderRow = { ...festivalRow, kind: "tentpole", title: "Some Event", festivalType: null, imageUrl: null };
    expect(enrichItem(row, today, "atlanta").tier).toBe("standard");
  });

  it("extracts teaser from description", () => {
    const item = enrichItem(festivalRow, today, "atlanta");
    expect(item.description).toBe("A neighborhood arts festival with live music.");
  });

  it("uses neighborhood as location when both present", () => {
    const item = enrichItem(festivalRow, today, "atlanta");
    expect(item.location).toBe("Inman Park");
  });

  it("falls back to location field when neighborhood null", () => {
    const row: LoaderRow = { ...festivalRow, neighborhood: null, location: "Decatur" };
    expect(enrichItem(row, today, "atlanta").location).toBe("Decatur");
  });

  it("builds festival href from slug", () => {
    const item = enrichItem(festivalRow, today, "atlanta");
    expect(item.href).toBe("/atlanta/festivals/inman-park-festival");
  });

  it("builds tentpole href with event query", () => {
    const row: LoaderRow = { ...festivalRow, kind: "tentpole", id: 42, slug: null };
    const item = enrichItem(row, today, "atlanta");
    expect(item.href).toBe("/atlanta?event=42");
  });

  it("returns startDate as-is in ISO form", () => {
    expect(enrichItem(festivalRow, today, "atlanta").startDate).toBe("2026-04-24");
  });
});
```

- [ ] **Step 2: Run the tests (should fail — module missing)**

```bash
cd web && npx vitest run lib/city-pulse/loaders/load-big-stuff-page.test.ts
```

Expected: FAIL with "Cannot find module".

- [ ] **Step 3: Implement the loader**

Create `web/lib/city-pulse/loaders/load-big-stuff-page.ts`:

```typescript
/**
 * Server loader for the /[portal]/festivals page ("Big Stuff" see-all).
 *
 * Mirrors load-big-stuff.ts but:
 *   - Does NOT exclude conference/convention festival_types (filter chips handle it).
 *   - Includes in-progress events (start_date <= today <= end_date) for the current month.
 *   - Enriches each item with type, isLiveNow, description, imageUrl, tier.
 *
 * Display-only fields (currentMonthLabel, etc.) are computed in the component
 * at render time, not cached here.
 */
import { createClient } from "@/lib/supabase/server";
import { getLocalDateString } from "@/lib/formats";
import { getOrSetSharedCacheJson } from "@/lib/shared-cache";
import { applyFeedGate } from "@/lib/feed-gate";
import { applyFederatedPortalScopeToQuery } from "@/lib/portal-scope";
import {
  getPortalSourceAccess,
  isEventCategoryAllowedForSourceAccess,
} from "@/lib/federation";
import { logger } from "@/lib/logger";
import { extractTeaser } from "@/lib/teaser";
import { getBigStuffType } from "@/lib/big-stuff/type-derivation";
import type {
  BigStuffPageData,
  BigStuffPageItem,
  BigStuffType,
} from "@/lib/big-stuff/types";
import type { FeedSectionContext } from "../feed-section-contract";

const HORIZON_MONTHS = 6;

/** Narrowed DB row shape used by the enrichment step. Exported for test. */
export interface LoaderRow {
  kind: "festival" | "tentpole";
  id: string | number;
  title: string;
  slug: string | null;
  startDate: string;
  endDate: string | null;
  festivalType: string | null;
  category: string | null;
  description: string | null;
  imageUrl: string | null;
  neighborhood: string | null;
  location: string | null;
}

export async function loadBigStuffForPage(
  ctx: FeedSectionContext,
): Promise<BigStuffPageData | null> {
  try {
    const items = await fetchBigStuffForPage(ctx.portalId, ctx.portalSlug);
    return { items };
  } catch (err) {
    logger.error("load-big-stuff-page failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

export function enrichItem(
  row: LoaderRow,
  today: string,
  portalSlug: string,
): BigStuffPageItem {
  const isLiveNow =
    row.startDate <= today &&
    (row.endDate ?? row.startDate) >= today;

  const type: BigStuffType = getBigStuffType({
    kind: row.kind,
    title: row.title,
    festivalType: row.festivalType,
    category: row.category,
  });

  const tier: "hero" | "featured" | "standard" = row.kind === "festival" && row.imageUrl
    ? "hero"
    : row.imageUrl
    ? "featured"
    : "standard";

  const href =
    row.kind === "festival"
      ? row.slug
        ? `/${portalSlug}/festivals/${row.slug}`
        : `/${portalSlug}/festivals`
      : `/${portalSlug}?event=${row.id}`;

  const id = row.kind === "festival" ? `festival:${row.id}` : `event:${row.id}`;

  return {
    id,
    kind: row.kind,
    title: row.title,
    startDate: row.startDate,
    endDate: row.endDate,
    location: row.neighborhood ?? row.location,
    href,
    type,
    isLiveNow,
    description: extractTeaser(row.description),
    imageUrl: row.imageUrl,
    tier,
  };
}

type FestivalQueryRow = {
  id: string;
  name: string;
  slug: string | null;
  neighborhood: string | null;
  location: string | null;
  announced_start: string;
  announced_end: string | null;
  festival_type: string | null;
  description: string | null;
  image_url: string | null;
};

type TentpoleQueryRow = {
  id: number;
  title: string;
  start_date: string;
  end_date: string | null;
  category: string | null;
  source_id: number | null;
  description: string | null;
  image_url: string | null;
  venue: { id: number; name: string; slug: string; neighborhood: string | null } | null;
};

async function fetchBigStuffForPage(
  portalId: string | null | undefined,
  portalSlug: string,
): Promise<BigStuffPageItem[]> {
  const cacheKey = `${portalId ?? "none"}|${getLocalDateString()}|big-stuff-page-v1`;

  return getOrSetSharedCacheJson<BigStuffPageItem[]>(
    "api:big-stuff-page",
    cacheKey,
    5 * 60 * 1000,
    async () => {
      const supabase = await createClient();
      const today = getLocalDateString();
      const horizonDate = addMonthsISO(today, HORIZON_MONTHS);

      // Festivals: forward OR in-progress, all festival_types.
      let festivalsQuery = supabase
        .from("festivals")
        .select(
          "id, name, slug, neighborhood, location, announced_start, announced_end, festival_type, description, image_url, portal_id, announced_2026",
        )
        .eq("announced_2026", true)
        .lte("announced_start", horizonDate)
        .or(
          `announced_start.gt.${today},and(announced_start.lte.${today},announced_end.gte.${today})`,
        )
        .order("announced_start", { ascending: true })
        .limit(100);

      if (portalId) festivalsQuery = festivalsQuery.eq("portal_id", portalId);

      const [festivalsResult, sourceAccess] = await Promise.all([
        festivalsQuery,
        portalId ? getPortalSourceAccess(portalId) : Promise.resolve(null),
      ]);
      if (festivalsResult.error) throw festivalsResult.error;

      const festivalRows = (festivalsResult.data ?? []) as FestivalQueryRow[];
      const festivalItems = festivalRows.map((f) =>
        enrichItem(
          {
            kind: "festival",
            id: f.id,
            title: f.name,
            slug: f.slug,
            startDate: f.announced_start,
            endDate: f.announced_end,
            festivalType: f.festival_type,
            category: null,
            description: f.description,
            imageUrl: f.image_url,
            neighborhood: f.neighborhood,
            location: f.location,
          },
          today,
          portalSlug,
        ),
      );

      const allowedSourceIds: number[] | null = sourceAccess?.sourceIds ?? null;
      let tentpoleItems: BigStuffPageItem[] = [];

      if (!portalId || (allowedSourceIds && allowedSourceIds.length > 0)) {
        let tentpoleQuery = supabase
          .from("events")
          .select(
            `id, title, start_date, end_date, category:category_id, source_id, description, image_url, venue:places(id, name, slug, neighborhood)`,
          )
          .eq("is_tentpole", true)
          .eq("is_active", true)
          .is("festival_id", null)
          .is("canonical_event_id", null)
          .lte("start_date", horizonDate)
          .or(
            `start_date.gt.${today},and(start_date.lte.${today},end_date.gte.${today})`,
          )
          .order("start_date", { ascending: true })
          .limit(100);

        if (allowedSourceIds && allowedSourceIds.length > 0) {
          tentpoleQuery = tentpoleQuery.in("source_id", allowedSourceIds);
        }
        tentpoleQuery = applyFeedGate(tentpoleQuery);
        if (portalId) {
          tentpoleQuery = applyFederatedPortalScopeToQuery(tentpoleQuery, {
            portalId,
            sourceIds: allowedSourceIds || [],
          });
        }

        const { data: tentpoleData, error: tentpoleError } = await tentpoleQuery;
        if (tentpoleError) {
          logger.error("load-big-stuff-page tentpoles error", {
            error: tentpoleError.message,
          });
        } else {
          const raw = (tentpoleData ?? []) as TentpoleQueryRow[];
          tentpoleItems = raw
            .filter((e) =>
              isEventCategoryAllowedForSourceAccess(
                sourceAccess,
                e.source_id,
                e.category,
              ),
            )
            .map((e) =>
              enrichItem(
                {
                  kind: "tentpole",
                  id: e.id,
                  title: e.title,
                  slug: null,
                  startDate: e.start_date,
                  endDate: e.end_date,
                  festivalType: null,
                  category: e.category,
                  description: e.description,
                  imageUrl: e.image_url,
                  neighborhood: e.venue?.neighborhood ?? null,
                  location: e.venue?.name ?? null,
                },
                today,
                portalSlug,
              ),
            );
        }
      }

      // Dedup tentpoles whose normalized title matches a festival name.
      const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
      const festivalNorms = festivalItems.map((f) => normalize(f.title));
      const dedupedTentpoles = tentpoleItems.filter((t) => {
        const n = normalize(t.title);
        return !festivalNorms.some((fn) => fn.includes(n) || n.includes(fn));
      });

      return [...festivalItems, ...dedupedTentpoles];
    },
    { maxEntries: 100 },
  );
}

function addMonthsISO(dateStr: string, months: number): string {
  const [y, m, d] = dateStr.split("-").map((v) => parseInt(v, 10));
  const dt = new Date(Date.UTC(y, m - 1 + months, d));
  return dt.toISOString().slice(0, 10);
}
```

- [ ] **Step 4: Run the tests (should pass)**

```bash
cd web && npx vitest run lib/city-pulse/loaders/load-big-stuff-page.test.ts
```

Expected: 12/12 PASS.

- [ ] **Step 5: TypeScript + lint**

```bash
cd web && npx tsc --noEmit && npm run lint -- lib/city-pulse/loaders/load-big-stuff-page.ts
```

Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add web/lib/city-pulse/loaders/load-big-stuff-page.ts web/lib/city-pulse/loaders/load-big-stuff-page.test.ts
git commit -m "feat(big-stuff): server loader for see-all page with enrichment + in-progress"
```

---

## Task 5: Filter chips component

**Files:**
- Create: `web/components/festivals/BigStuffFilterChips.tsx`
- Create: `web/components/festivals/BigStuffFilterChips.test.tsx`

**Goal:** Tablist-flavored filter chip row; exclusive select; counts per bucket.

- [ ] **Step 1: Write the failing tests**

Create `web/components/festivals/BigStuffFilterChips.test.tsx`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import BigStuffFilterChips, { type FilterValue } from "./BigStuffFilterChips";

describe("BigStuffFilterChips", () => {
  const counts = { festival: 28, convention: 11, sports: 4, community: 2, other: 0 };

  it("renders a chip for each primary bucket + All", () => {
    const { getByText } = render(
      <BigStuffFilterChips counts={counts} active="all" onChange={vi.fn()} />,
    );
    expect(getByText(/All 45/i)).toBeDefined();
    expect(getByText(/Festivals 28/i)).toBeDefined();
    expect(getByText(/Conventions 11/i)).toBeDefined();
    expect(getByText(/Sports 4/i)).toBeDefined();
    expect(getByText(/Community 2/i)).toBeDefined();
  });

  it("does NOT render an 'Other' chip", () => {
    const { queryByText } = render(
      <BigStuffFilterChips counts={counts} active="all" onChange={vi.fn()} />,
    );
    expect(queryByText(/Other/i)).toBeNull();
  });

  it("invokes onChange with the bucket when an inactive chip is clicked", () => {
    const onChange = vi.fn();
    const { getByText } = render(
      <BigStuffFilterChips counts={counts} active="all" onChange={onChange} />,
    );
    fireEvent.click(getByText(/Festivals 28/i));
    expect(onChange).toHaveBeenCalledWith("festival");
  });

  it("invokes onChange('all') when the active chip is clicked (toggle off)", () => {
    const onChange = vi.fn();
    const { getByText } = render(
      <BigStuffFilterChips counts={counts} active="festival" onChange={onChange} />,
    );
    fireEvent.click(getByText(/Festivals 28/i));
    expect(onChange).toHaveBeenCalledWith("all");
  });

  it("has role=tablist on the container and role=tab on each chip", () => {
    const { container } = render(
      <BigStuffFilterChips counts={counts} active="all" onChange={vi.fn()} />,
    );
    expect(container.querySelector('[role="tablist"]')).toBeDefined();
    expect(container.querySelectorAll('[role="tab"]').length).toBeGreaterThanOrEqual(5);
  });

  it("hides a chip when count < 2", () => {
    const sparseCounts = { festival: 28, convention: 11, sports: 1, community: 0, other: 0 };
    const { queryByText } = render(
      <BigStuffFilterChips counts={sparseCounts} active="all" onChange={vi.fn()} />,
    );
    expect(queryByText(/Sports/i)).toBeNull();
    expect(queryByText(/Community/i)).toBeNull();
    // All is always shown, regardless of count.
    expect(queryByText(/All/i)).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run tests (fail)**

```bash
cd web && npx vitest run components/festivals/BigStuffFilterChips.test.tsx
```

Expected: FAIL with "Cannot find module".

- [ ] **Step 3: Implement**

Create `web/components/festivals/BigStuffFilterChips.tsx`:

```typescript
"use client";

import FilterChip, {
  type FilterChipVariant,
} from "@/components/filters/FilterChip";
import type { BigStuffType } from "@/lib/big-stuff/types";

export type FilterValue = BigStuffType | "all";

const BUCKETS: Array<{ value: Exclude<FilterValue, "all" | "other">; label: string; variant: FilterChipVariant }> = [
  { value: "festival", label: "Festivals", variant: "date" },
  { value: "convention", label: "Conventions", variant: "vibe" },
  { value: "sports", label: "Sports", variant: "access" },
  { value: "community", label: "Community", variant: "free" },
];

export interface BigStuffFilterChipsProps {
  counts: Record<BigStuffType, number>;
  active: FilterValue;
  onChange: (next: FilterValue) => void;
}

export default function BigStuffFilterChips({
  counts,
  active,
  onChange,
}: BigStuffFilterChipsProps) {
  const totalAll =
    counts.festival + counts.convention + counts.sports + counts.community + counts.other;

  return (
    <div
      role="tablist"
      aria-label="Filter by event type"
      className="flex flex-wrap items-center gap-2"
    >
      <button
        role="tab"
        aria-selected={active === "all"}
        onClick={() => onChange("all")}
        className="inline-flex items-center"
      >
        <FilterChip
          label="All"
          count={totalAll}
          variant="default"
          active={active === "all"}
        />
      </button>
      {BUCKETS.filter((b) => counts[b.value] >= 2).map((b) => (
        <button
          key={b.value}
          role="tab"
          aria-selected={active === b.value}
          onClick={() => onChange(active === b.value ? "all" : b.value)}
          className="inline-flex items-center"
        >
          <FilterChip
            label={b.label}
            count={counts[b.value]}
            variant={b.variant}
            active={active === b.value}
          />
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Run tests (pass)**

```bash
cd web && npx vitest run components/festivals/BigStuffFilterChips.test.tsx
```

Expected: 5/5 PASS.

- [ ] **Step 5: TypeScript + commit**

```bash
cd web && npx tsc --noEmit
git add web/components/festivals/BigStuffFilterChips.tsx web/components/festivals/BigStuffFilterChips.test.tsx
git commit -m "feat(big-stuff): BigStuffFilterChips — type filter tablist"
```

---

## Task 6: Hero card + compact row components

**Files:**
- Create: `web/components/festivals/BigStuffHeroCard.tsx`
- Create: `web/components/festivals/BigStuffRow.tsx`
- Create: `web/components/festivals/BigStuffCardTests.test.tsx` (shared tests)

**Goal:** The two card variants. Both render `BigStuffPageItem`, differ in layout and density.

- [ ] **Step 1: Write the failing tests**

Create `web/components/festivals/BigStuffCardTests.test.tsx`:

```typescript
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import BigStuffHeroCard from "./BigStuffHeroCard";
import BigStuffRow from "./BigStuffRow";
import type { BigStuffPageItem } from "@/lib/big-stuff/types";

const mkItem = (partial: Partial<BigStuffPageItem> = {}): BigStuffPageItem => ({
  id: "festival:1",
  kind: "festival",
  title: "Shaky Knees",
  startDate: "2026-05-02",
  endDate: "2026-05-04",
  location: "Piedmont Park",
  href: "/atlanta/festivals/shaky-knees",
  type: "festival",
  isLiveNow: false,
  description: "Four-day rock festival at Piedmont Park.",
  imageUrl: "https://example.com/sk.jpg",
  tier: "hero",
  ...partial,
});

describe("BigStuffHeroCard", () => {
  it("renders title, dates, location, and teaser", () => {
    const { getByText } = render(<BigStuffHeroCard item={mkItem()} />);
    expect(getByText("Shaky Knees")).toBeDefined();
    expect(getByText(/May 2 – 4/)).toBeDefined();
    expect(getByText(/Piedmont Park/)).toBeDefined();
    expect(getByText(/Four-day rock festival/)).toBeDefined();
  });

  it("renders the type pill", () => {
    const { getByText } = render(<BigStuffHeroCard item={mkItem()} />);
    expect(getByText(/FESTIVAL/)).toBeDefined();
  });

  it("renders a LIVE NOW pill when isLiveNow", () => {
    const { getByText } = render(
      <BigStuffHeroCard item={mkItem({ isLiveNow: true })} />,
    );
    expect(getByText(/LIVE NOW/i)).toBeDefined();
  });

  it("omits description block when description is null", () => {
    const { queryByText } = render(
      <BigStuffHeroCard item={mkItem({ description: null })} />,
    );
    expect(queryByText(/Four-day rock festival/)).toBeNull();
  });

  it("renders Crown fallback icon when imageUrl is null", () => {
    const { container } = render(
      <BigStuffHeroCard item={mkItem({ imageUrl: null })} />,
    );
    expect(container.querySelector('[data-hero-fallback]')).toBeDefined();
  });

  it("wraps content in a link with the item's href", () => {
    const { container } = render(<BigStuffHeroCard item={mkItem()} />);
    const link = container.querySelector("a");
    expect(link?.getAttribute("href")).toBe("/atlanta/festivals/shaky-knees");
  });

  it("applies the type accent on left border via data-type", () => {
    const { container } = render(<BigStuffHeroCard item={mkItem()} />);
    expect(container.querySelector('[data-type="festival"]')).toBeDefined();
  });
});

describe("BigStuffRow", () => {
  it("renders title, dates, location, and type pill", () => {
    const { getByText } = render(<BigStuffRow item={mkItem({ tier: "standard" })} />);
    expect(getByText("Shaky Knees")).toBeDefined();
    expect(getByText(/May 2 – 4/)).toBeDefined();
    expect(getByText(/Piedmont Park/)).toBeDefined();
    expect(getByText(/FESTIVAL/)).toBeDefined();
  });

  it("renders LIVE NOW pill IN PLACE OF the type pill when isLiveNow", () => {
    const { getByText, queryByText } = render(
      <BigStuffRow item={mkItem({ tier: "standard", isLiveNow: true })} />,
    );
    expect(getByText(/LIVE NOW/i)).toBeDefined();
    expect(queryByText(/FESTIVAL/)).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests (fail)**

```bash
cd web && npx vitest run components/festivals/BigStuffCardTests.test.tsx
```

Expected: FAIL.

- [ ] **Step 3: Implement `BigStuffHeroCard`**

Create `web/components/festivals/BigStuffHeroCard.tsx`:

```typescript
"use client";

import Link from "next/link";
import SmartImage from "@/components/SmartImage";
import { Crown, Users, MedalMilitary, HeartStraight, Star } from "@phosphor-icons/react";
import type { BigStuffPageItem, BigStuffType } from "@/lib/big-stuff/types";
import { TYPE_ACCENT, TYPE_LABEL } from "@/lib/big-stuff/types";

const FALLBACK_ICON: Record<BigStuffType, React.ComponentType<{ weight?: "duotone"; className?: string }>> = {
  festival: Crown,
  convention: Users,
  sports: MedalMilitary,
  community: HeartStraight,
  other: Star,
};

const MONTH_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function formatDates(startDate: string, endDate: string | null): string {
  const [sy, sm, sd] = startDate.split("-").map(Number);
  const startLabel = `${MONTH_SHORT[sm - 1]} ${sd}`;
  if (!endDate || endDate === startDate) return startLabel;
  const [ey, em, ed] = endDate.split("-").map(Number);
  if (sy === ey && sm === em) return `${MONTH_SHORT[sm - 1]} ${sd} – ${ed}`;
  if (sy !== ey) return `${startLabel} – ${MONTH_SHORT[em - 1]} ${ed}, ${ey}`;
  return `${startLabel} – ${MONTH_SHORT[em - 1]} ${ed}`;
}

export default function BigStuffHeroCard({ item }: { item: BigStuffPageItem }) {
  const accent = TYPE_ACCENT[item.type];
  const Fallback = FALLBACK_ICON[item.type];
  const aria = `${item.title}, ${TYPE_LABEL[item.type].toLowerCase()}, ${formatDates(item.startDate, item.endDate)}${item.location ? `, ${item.location}` : ""}`;

  return (
    <Link
      href={item.href}
      data-type={item.type}
      aria-label={aria}
      className="group/hero block rounded-card overflow-hidden border border-[var(--twilight)] bg-[var(--night)] focus-ring"
      style={{ borderLeft: `2px solid ${accent}` }}
    >
      <div className="relative aspect-[21/9] sm:aspect-[21/9] max-sm:aspect-[16/9] bg-[var(--dusk)] overflow-hidden">
        {item.imageUrl ? (
          <SmartImage
            src={item.imageUrl}
            alt={item.title}
            fill
            sizes="(max-width: 768px) 100vw, 768px"
            className="object-cover transition-transform duration-700 ease-out group-hover/hero:scale-[1.04]"
          />
        ) : (
          <div
            data-hero-fallback
            className="absolute inset-0 flex items-center justify-center"
            style={{
              background: `linear-gradient(135deg, ${accent}22, var(--void))`,
            }}
          >
            <Fallback weight="duotone" className="w-24 h-24" style={{ color: accent, opacity: 0.6 }} />
          </div>
        )}

        {/* Pill overlays — top-left */}
        <div className="absolute top-3 left-3 flex items-center gap-2">
          {item.isLiveNow && (
            <span className="inline-flex px-2 py-0.5 rounded text-2xs font-mono font-bold tracking-[0.08em] uppercase bg-[var(--neon-red)]/15 border border-[var(--neon-red)]/40 text-[var(--neon-red)]">
              LIVE NOW
            </span>
          )}
          <span
            className="inline-flex px-2 py-0.5 rounded text-2xs font-mono font-bold tracking-[0.08em] uppercase"
            style={{
              backgroundColor: `color-mix(in srgb, ${accent} 15%, transparent)`,
              border: `1px solid color-mix(in srgb, ${accent} 40%, transparent)`,
              color: accent,
            }}
          >
            {TYPE_LABEL[item.type]}
          </span>
        </div>
      </div>

      <div className="p-5">
        <h3 className="text-3xl font-bold text-[var(--cream)] tracking-[-0.01em] leading-tight group-hover/hero:underline decoration-[var(--gold)] underline-offset-[3px]">
          {item.title}
        </h3>
        <p className="text-sm text-[var(--muted)] mt-1">
          {formatDates(item.startDate, item.endDate)}
          {item.location && <> · {item.location}</>}
        </p>
        {item.description && (
          <p className="text-sm leading-relaxed text-[var(--soft)] mt-3">
            {item.description}
          </p>
        )}
      </div>
    </Link>
  );
}
```

- [ ] **Step 4: Implement `BigStuffRow`**

Create `web/components/festivals/BigStuffRow.tsx`:

```typescript
"use client";

import Link from "next/link";
import SmartImage from "@/components/SmartImage";
import { Crown, Users, MedalMilitary, HeartStraight, Star } from "@phosphor-icons/react";
import type { BigStuffPageItem, BigStuffType } from "@/lib/big-stuff/types";
import { TYPE_ACCENT, TYPE_LABEL } from "@/lib/big-stuff/types";

const FALLBACK_ICON: Record<BigStuffType, React.ComponentType<{ weight?: "duotone"; className?: string }>> = {
  festival: Crown,
  convention: Users,
  sports: MedalMilitary,
  community: HeartStraight,
  other: Star,
};

const MONTH_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function formatDates(startDate: string, endDate: string | null): string {
  const [sy, sm, sd] = startDate.split("-").map(Number);
  const startLabel = `${MONTH_SHORT[sm - 1]} ${sd}`;
  if (!endDate || endDate === startDate) return startLabel;
  const [ey, em, ed] = endDate.split("-").map(Number);
  if (sy === ey && sm === em) return `${MONTH_SHORT[sm - 1]} ${sd} – ${ed}`;
  if (sy !== ey) return `${startLabel} – ${MONTH_SHORT[em - 1]} ${ed}, ${ey}`;
  return `${startLabel} – ${MONTH_SHORT[em - 1]} ${ed}`;
}

export default function BigStuffRow({ item }: { item: BigStuffPageItem }) {
  const accent = TYPE_ACCENT[item.type];
  const Fallback = FALLBACK_ICON[item.type];
  const aria = `${item.title}, ${TYPE_LABEL[item.type].toLowerCase()}, ${formatDates(item.startDate, item.endDate)}${item.location ? `, ${item.location}` : ""}`;

  return (
    <Link
      href={item.href}
      data-type={item.type}
      aria-label={aria}
      className="group/row grid grid-cols-[72px_1fr] sm:grid-cols-[72px_1fr] gap-3 items-start p-2.5 rounded-card border border-[var(--twilight)] bg-[var(--night)] hover:bg-[var(--dusk)] transition-colors focus-ring"
      style={{ borderLeft: `2px solid ${accent}` }}
    >
      <div className="relative w-[72px] h-[72px] max-sm:w-14 max-sm:h-14 rounded-md overflow-hidden bg-[var(--dusk)] flex-shrink-0">
        {item.imageUrl ? (
          <SmartImage src={item.imageUrl} alt="" fill sizes="72px" className="object-cover" />
        ) : (
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ background: `linear-gradient(135deg, ${accent}22, var(--void))` }}
          >
            <Fallback weight="duotone" className="w-8 h-8" style={{ color: accent, opacity: 0.6 }} />
          </div>
        )}
      </div>

      <div className="min-w-0 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold text-[var(--cream)] truncate group-hover/row:underline decoration-[var(--gold)] underline-offset-[3px]">
            {item.title}
          </p>
          <p className="text-sm text-[var(--muted)] truncate">
            {formatDates(item.startDate, item.endDate)}
            {item.location && <> · {item.location}</>}
          </p>
        </div>
        {item.isLiveNow ? (
          <span className="inline-flex flex-shrink-0 px-2 py-0.5 rounded text-2xs font-mono font-bold tracking-[0.08em] uppercase bg-[var(--neon-red)]/15 border border-[var(--neon-red)]/40 text-[var(--neon-red)]">
            LIVE NOW
          </span>
        ) : (
          <span
            className="inline-flex flex-shrink-0 px-2 py-0.5 rounded text-2xs font-mono font-bold tracking-[0.08em] uppercase"
            style={{
              backgroundColor: `color-mix(in srgb, ${accent} 15%, transparent)`,
              border: `1px solid color-mix(in srgb, ${accent} 40%, transparent)`,
              color: accent,
            }}
          >
            {TYPE_LABEL[item.type]}
          </span>
        )}
      </div>
    </Link>
  );
}
```

- [ ] **Step 5: Run tests (pass)**

```bash
cd web && npx vitest run components/festivals/BigStuffCardTests.test.tsx
```

Expected: 9/9 PASS.

- [ ] **Step 6: TypeScript + commit**

```bash
cd web && npx tsc --noEmit
git add web/components/festivals/BigStuffHeroCard.tsx web/components/festivals/BigStuffRow.tsx web/components/festivals/BigStuffCardTests.test.tsx
git commit -m "feat(big-stuff): hero card + compact row components with tests"
```

---

## Task 7: Month section component

**Files:**
- Create: `web/components/festivals/BigStuffMonthSection.tsx`

**Goal:** Takes a month's items, applies the top=hero / rest=rows sort + rendering.

- [ ] **Step 1: Implement**

Create `web/components/festivals/BigStuffMonthSection.tsx`:

```typescript
"use client";

import BigStuffHeroCard from "./BigStuffHeroCard";
import BigStuffRow from "./BigStuffRow";
import type { BigStuffPageItem } from "@/lib/big-stuff/types";

const MONTH_LABELS = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];

const TIER_RANK: Record<BigStuffPageItem["tier"], number> = {
  hero: 0,
  featured: 1,
  standard: 2,
};

function sortItems(items: BigStuffPageItem[]): BigStuffPageItem[] {
  return [...items].sort((a, b) => {
    if (a.isLiveNow !== b.isLiveNow) return a.isLiveNow ? -1 : 1;
    if (a.tier !== b.tier) return TIER_RANK[a.tier] - TIER_RANK[b.tier];
    return a.startDate.localeCompare(b.startDate);
  });
}

export interface BigStuffMonthSectionProps {
  monthKey: string;
  items: BigStuffPageItem[];
}

export default function BigStuffMonthSection({
  monthKey,
  items,
}: BigStuffMonthSectionProps) {
  if (items.length === 0) return null;
  const sorted = sortItems(items);
  const [top, ...rest] = sorted;
  const [y, m] = monthKey.split("-");
  const label = `${MONTH_LABELS[parseInt(m, 10) - 1]} ${y}`;

  return (
    <section id={`month-${monthKey}`} className="scroll-mt-[40px]">
      <h2 className="font-mono text-xs font-bold tracking-[0.14em] uppercase text-[var(--cream)] border-t border-[var(--twilight)] pt-4 mb-4">
        {label}
      </h2>
      <div className="space-y-3">
        <BigStuffHeroCard item={top} />
        {rest.map((it) => (
          <BigStuffRow key={it.id} item={it} />
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: TypeScript check + commit**

```bash
cd web && npx tsc --noEmit
git add web/components/festivals/BigStuffMonthSection.tsx
git commit -m "feat(big-stuff): BigStuffMonthSection — sorts items, renders hero + rows"
```

---

## Task 8: Full ribbon + collapsed-sticky strip

**Files:**
- Create: `web/components/festivals/BigStuffRibbon.tsx`
- Create: `web/components/festivals/BigStuffCollapsedStrip.tsx`
- Create: `web/components/festivals/useActiveMonth.ts`

**Goal:** Two ribbon states + IntersectionObserver hook to track the active month.

- [ ] **Step 1: Implement the IntersectionObserver hook**

Create `web/components/festivals/useActiveMonth.ts`:

```typescript
"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Tracks which month section is "active" based on scroll position.
 * A section is active when its top is in the viewport's upper 30% band.
 * Multiple sections may intersect; the one highest up (closest to top) wins.
 */
export function useActiveMonth(monthKeys: string[]): string | null {
  const [active, setActive] = useState<string | null>(monthKeys[0] ?? null);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const sections = monthKeys
      .map((key) => document.getElementById(`month-${key}`))
      .filter((el): el is HTMLElement => el !== null);

    if (sections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (raf.current) cancelAnimationFrame(raf.current);
        raf.current = requestAnimationFrame(() => {
          // Pick the visible section closest to the top of the viewport.
          let best: { key: string; top: number } | null = null;
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            const key = entry.target.id.replace(/^month-/, "");
            const top = entry.boundingClientRect.top;
            if (!best || Math.abs(top) < Math.abs(best.top)) {
              best = { key, top };
            }
          }
          if (best) setActive(best.key);
        });
      },
      { rootMargin: "-40px 0px -70% 0px" },
    );

    sections.forEach((el) => observer.observe(el));
    return () => {
      observer.disconnect();
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [monthKeys.join(",")]);

  return active;
}
```

- [ ] **Step 2: Implement the full ribbon**

Create `web/components/festivals/BigStuffRibbon.tsx`:

```typescript
"use client";

const MONTH_LABELS = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];

export interface BigStuffRibbonProps {
  months: Array<{ monthKey: string; count: number; isCurrent: boolean }>;
  onJump: (monthKey: string) => void;
}

export default function BigStuffRibbon({ months, onJump }: BigStuffRibbonProps) {
  return (
    <div
      className="flex flex-row rounded-card border border-[var(--twilight)] bg-[var(--night)] overflow-hidden max-sm:overflow-x-auto max-sm:snap-x max-sm:snap-mandatory"
      role="navigation"
      aria-label="Jump to month"
    >
      {months.map((m, idx) => (
        <button
          key={m.monthKey}
          onClick={() => onJump(m.monthKey)}
          aria-label={`Jump to ${monthLabel(m.monthKey)} · ${m.count} events`}
          className={`flex-1 max-sm:flex-shrink-0 max-sm:min-w-[110px] max-sm:snap-start p-3 text-left hover:bg-[var(--dusk)] transition-colors focus-ring ${
            idx === 0 ? "" : "border-l border-[var(--twilight)]"
          }`}
        >
          <div className="flex items-center gap-1.5">
            {m.isCurrent && (
              <span className="inline-block w-[6px] h-[6px] rounded-full bg-[var(--gold)]" aria-hidden />
            )}
            <span className="font-mono text-sm font-bold tracking-[0.12em] uppercase text-[var(--cream)]">
              {monthLabel(m.monthKey)}
            </span>
          </div>
          <div className="font-mono text-2xs text-[var(--muted)] tracking-[0.15em] uppercase mt-0.5">
            {m.count} event{m.count === 1 ? "" : "s"}
          </div>
        </button>
      ))}
    </div>
  );
}

function monthLabel(monthKey: string): string {
  const m = parseInt(monthKey.slice(5, 7), 10);
  return MONTH_LABELS[m - 1];
}
```

- [ ] **Step 3: Implement the collapsed strip**

Create `web/components/festivals/BigStuffCollapsedStrip.tsx`:

```typescript
"use client";

import { useActiveMonth } from "./useActiveMonth";

const MONTH_LABELS = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];

export interface BigStuffCollapsedStripProps {
  monthKeys: string[];
  onJump: (monthKey: string) => void;
}

export default function BigStuffCollapsedStrip({
  monthKeys,
  onJump,
}: BigStuffCollapsedStripProps) {
  const active = useActiveMonth(monthKeys);

  return (
    <div
      role="navigation"
      aria-label="Jump to month (compact)"
      className="sticky top-0 z-30 min-h-[44px] sm:h-8 sm:min-h-0 bg-[var(--void)]/95 border-b border-[var(--twilight)] backdrop-blur-sm"
    >
      <div className="flex items-center h-full overflow-x-auto snap-x snap-mandatory px-4 gap-4 max-w-6xl mx-auto">
        {monthKeys.map((key) => {
          const isActive = key === active;
          const m = parseInt(key.slice(5, 7), 10);
          return (
            <button
              key={key}
              onClick={() => onJump(key)}
              aria-current={isActive ? "location" : undefined}
              className={`flex-shrink-0 snap-start font-mono text-2xs tracking-[0.08em] uppercase px-1 py-0.5 focus-ring ${
                isActive
                  ? "text-[var(--gold)] underline decoration-[var(--gold)] underline-offset-[4px]"
                  : "text-[var(--muted)] hover:text-[var(--cream)]"
              }`}
            >
              {MONTH_LABELS[m - 1]}
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: TypeScript check + commit**

```bash
cd web && npx tsc --noEmit
git add web/components/festivals/BigStuffRibbon.tsx web/components/festivals/BigStuffCollapsedStrip.tsx web/components/festivals/useActiveMonth.ts
git commit -m "feat(big-stuff): full ribbon + collapsed-sticky strip + active-month hook"
```

---

## Task 9: Root page component + rewire page.tsx

**Files:**
- Create: `web/components/festivals/BigStuffPage.tsx`
- Modify: `web/app/[portal]/festivals/page.tsx`

**Goal:** Tie everything together: filter state, groupings, scroll-to-month, conditional collapsed strip.

- [ ] **Step 1: Implement `BigStuffPage`**

Create `web/components/festivals/BigStuffPage.tsx`:

```typescript
"use client";

import { useCallback, useMemo, useState } from "react";
import BigStuffFilterChips, { type FilterValue } from "./BigStuffFilterChips";
import BigStuffRibbon from "./BigStuffRibbon";
import BigStuffCollapsedStrip from "./BigStuffCollapsedStrip";
import BigStuffMonthSection from "./BigStuffMonthSection";
import { groupItemsByMonth } from "@/lib/city-pulse/loaders/big-stuff-shared";
import { getLocalDateString } from "@/lib/formats";
import type { BigStuffPageData, BigStuffPageItem, BigStuffType } from "@/lib/big-stuff/types";

const HORIZON_MONTHS = 6;

export interface BigStuffPageProps {
  portalSlug: string;
  portalName: string;
  data: BigStuffPageData | null;
}

export default function BigStuffPage({ portalSlug, portalName, data }: BigStuffPageProps) {
  const items = data?.items ?? [];
  const [active, setActive] = useState<FilterValue>("all");

  const today = getLocalDateString();

  // Counts from the unfiltered data (constant per-load).
  const counts = useMemo<Record<BigStuffType, number>>(() => {
    const out: Record<BigStuffType, number> = {
      festival: 0,
      convention: 0,
      sports: 0,
      community: 0,
      other: 0,
    };
    for (const it of items) out[it.type]++;
    return out;
  }, [items]);

  // Filtered items.
  const filtered = useMemo(() => {
    if (active === "all") return items;
    return items.filter((it) => it.type === active);
  }, [items, active]);

  // Group filtered items by month.
  const monthBuckets = useMemo(
    () => groupItemsByMonth(filtered, today, HORIZON_MONTHS),
    [filtered, today],
  );
  const nonEmptyMonths = monthBuckets.filter((b) => b.items.length > 0);
  const monthKeys = nonEmptyMonths.map((b) => b.monthKey);

  const handleJump = useCallback((key: string) => {
    const el = document.getElementById(`month-${key}`);
    if (!el) return;
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: prefersReduced ? "auto" : "smooth", block: "start" });
  }, []);

  if (items.length === 0) {
    return (
      <main className="max-w-4xl mx-auto px-4 py-10">
        <Header portalName={portalName} counts={counts} active={active} onChange={setActive} ribbonMonths={[]} onJump={handleJump} />
        <p className="mt-12 text-center text-[var(--muted)]">
          Nothing on the 6-month horizon yet. Check back soon.
        </p>
      </main>
    );
  }

  if (nonEmptyMonths.length === 0) {
    return (
      <main className="max-w-4xl mx-auto px-4 py-10">
        <Header portalName={portalName} counts={counts} active={active} onChange={setActive} ribbonMonths={[]} onJump={handleJump} />
        <p className="mt-12 text-center text-[var(--muted)]">
          No {active === "all" ? "events" : active + " events"} in the next 6 months. Try a different filter.
        </p>
      </main>
    );
  }

  const ribbonMonths = nonEmptyMonths.map((b) => ({
    monthKey: b.monthKey,
    count: b.items.length,
    isCurrent: b.isCurrentMonth,
  }));

  return (
    <>
      <BigStuffCollapsedStrip monthKeys={monthKeys} onJump={handleJump} />
      <main className="max-w-4xl mx-auto px-4 py-10">
        <Header portalName={portalName} counts={counts} active={active} onChange={setActive} ribbonMonths={ribbonMonths} onJump={handleJump} />
        <div className="mt-8 space-y-10">
          {nonEmptyMonths.map((b) => (
            <BigStuffMonthSection key={b.monthKey} monthKey={b.monthKey} items={b.items} />
          ))}
        </div>
      </main>
    </>
  );
}

function Header({
  portalName,
  counts,
  active,
  onChange,
  ribbonMonths,
  onJump,
}: {
  portalName: string;
  counts: Record<BigStuffType, number>;
  active: FilterValue;
  onChange: (v: FilterValue) => void;
  ribbonMonths: Array<{ monthKey: string; count: number; isCurrent: boolean }>;
  onJump: (key: string) => void;
}) {
  return (
    <header>
      <h1 className="text-3xl font-bold text-[var(--cream)] tracking-[-0.02em]">The Big Stuff</h1>
      <p className="text-[var(--soft)] mt-1">
        Festivals, tentpoles, and season-defining moments coming up in {portalName}.
      </p>
      <div className="mt-5">
        <BigStuffFilterChips counts={counts} active={active} onChange={onChange} />
      </div>
      {ribbonMonths.length > 0 && (
        <div className="mt-4">
          <BigStuffRibbon months={ribbonMonths} onJump={onJump} />
        </div>
      )}
    </header>
  );
}
```

- [ ] **Step 2: Rewrite `page.tsx`**

Replace `web/app/[portal]/festivals/page.tsx` with:

```typescript
import type { Metadata } from "next";
import { loadBigStuffForPage } from "@/lib/city-pulse/loaders/load-big-stuff-page";
import BigStuffPage from "@/components/festivals/BigStuffPage";
import { resolveFeedPageRequest } from "../_surfaces/feed/resolve-feed-page-request";
import FilmPortalNav from "../_components/film/FilmPortalNav";

export const revalidate = 300;

type Props = { params: Promise<{ portal: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { portal: portalSlug } = await params;
  const request = await resolveFeedPageRequest({
    portalSlug,
    pathname: `/${portalSlug}/festivals`,
  });
  const portalName = request?.portal.name || "Lost City";
  return {
    title: `The Big Stuff | ${portalName}`,
    description: `Festivals, tentpole events, and season-defining moments coming up in ${portalName}. Mark your calendar.`,
  };
}

export default async function BigStuffSeeAllPage({ params }: Props) {
  const { portal: portalSlug } = await params;
  const request = await resolveFeedPageRequest({
    portalSlug,
    pathname: `/${portalSlug}/festivals`,
  });
  const portal = request?.portal ?? null;
  const portalName = portal?.name || portalSlug;
  const isFilmPortal = request?.isFilm ?? false;

  const data = await loadBigStuffForPage({
    portalId: portal?.id ?? "",
    portalSlug: portal?.slug ?? portalSlug,
    isLightTheme: false,
  });

  return (
    <div className="min-h-screen">
      {isFilmPortal && <FilmPortalNav portalSlug={portal?.slug ?? portalSlug} />}
      <BigStuffPage portalSlug={portal?.slug ?? portalSlug} portalName={portalName} data={data} />
    </div>
  );
}
```

- [ ] **Step 3: TypeScript + lint**

```bash
cd web && npx tsc --noEmit
cd web && npm run lint -- components/festivals/BigStuffPage.tsx 'app/[portal]/festivals/page.tsx'
```

Expected: clean.

- [ ] **Step 4: Start dev server + visit page**

```bash
cd web && PORT=3001 npm run dev &
# Wait for "Ready in ..."
curl --max-time 60 -sS -o /tmp/big-stuff.html -w "status=%{http_code} bytes=%{size_download}\n" http://localhost:3001/atlanta/festivals
```

Expected: `status=200`, bytes > 100k. Grep for key markers:

```bash
grep -c "month-" /tmp/big-stuff.html     # expect 3+
grep -c "LIVE NOW\|FESTIVAL\|CONVENTION\|SPORTS\|COMMUNITY" /tmp/big-stuff.html  # expect 10+
```

- [ ] **Step 5: Commit**

```bash
git add web/components/festivals/BigStuffPage.tsx web/app/[portal]/festivals/page.tsx
git commit -m "feat(big-stuff): root page component + rewire page.tsx to use new loader"
```

---

## Task 10: Browser verify desktop

**Files:** none — manual + qa agent verification.

- [ ] **Step 1: Pre-flight memory check**

```bash
vm_stat | awk '/Pages free/ {gsub(/\./,""); printf "free: %d MB\n", $3*16384/1048576}'
```

If <200MB, free memory before proceeding (kill unused dev servers, Chrome tabs).

- [ ] **Step 2: Dispatch qa agent**

Dispatch a `qa` subagent with prompt:

> Verify the rebuilt `/[portal]/festivals` page at `http://localhost:3001/atlanta/festivals`. One tab, max 3 screenshots. Checklist:
> - Page heading "The Big Stuff" + subtitle visible.
> - Filter chips rendered: All, Festivals, Conventions, Sports, Community — with counts.
> - Full month ribbon visible below chips: 3–6 month columns, each with count.
> - Click a month pill → smooth-scrolls to that month section.
> - Scroll down → collapsed-sticky strip appears at top with month pills.
> - Each month section has one hero card + N compact rows.
> - Hero card has type pill (overlay), title, date line, teaser description.
> - Compact row has thumbnail, title, date line, type pill.
> - Color accents: festival=gold, convention=purple, sports=cyan, community=green.
> - Click "Festivals" chip → only festival cards remain; ribbon months without festivals hide.
> - Click "Festivals" again → back to All.
> - LIVE NOW pill visible on any in-progress event (if any; may be zero in the current dataset).
> - No console errors.
> Report verdict: PASS / PASS-WITH-NOTES / FAIL + per-item results.

- [ ] **Step 3: Record findings**

Save the qa report to `/tmp/big-stuff-page-qa.md`.

No commit — verification step.

---

## Task 11: Design-handoff verify

**Files:** produces `docs/design-specs/verify/big-stuff-page-2026-04-18.md`.

- [ ] **Step 1: Run verify**

Invoke: `/design-handoff verify $PAGE_NODE_ID http://localhost:3001/atlanta/festivals`

(Use the PAGE_NODE_ID recorded in Task 1.)

- [ ] **Step 2: Address any Critical or Major deltas**

Common issues to expect:
- Typography size off by 1–2px → adjust class.
- Padding drift → bump spacing.
- Color saturation mismatch (design canvas vs browser rendering) → usually no change needed; verify is reference only.

- [ ] **Step 3: Manual mobile check (real Chrome)**

Per `feedback_mcp_browser_hidden_tab.md`, `resize_window` is a no-op on the web viewport. Do this by hand in Chrome DevTools device mode (iPhone 12, 390×844):
- Ribbon: horizontal snap-scroll visible.
- Collapsed strip: 28px pinned strip on scroll.
- Hero card: 16:9 image, readable title.
- Compact row: 56×56 thumb, type pill wraps below meta.
- Filter chips: horizontal scroll chip strip.

If mobile looks wrong, file follow-up issues; do not block merge unless titles truncate mid-word.

- [ ] **Step 4: Commit the verify report**

```bash
git add docs/design-specs/verify/big-stuff-page-2026-04-18.md
git commit -m "docs: design-handoff verify report for Big Stuff see-all page"
```

---

## Task 12: Final lint + tsc + tests + PR

- [ ] **Step 1: Full TypeScript check**

```bash
cd web && npx tsc --noEmit
```

Expected: zero new errors.

- [ ] **Step 2: Lint touched files**

```bash
cd web && npm run lint -- lib/teaser.ts lib/teaser.test.ts lib/big-stuff/types.ts lib/big-stuff/type-derivation.ts lib/big-stuff/type-derivation.test.ts lib/city-pulse/loaders/load-big-stuff-page.ts lib/city-pulse/loaders/load-big-stuff-page.test.ts components/festivals/BigStuffFilterChips.tsx components/festivals/BigStuffFilterChips.test.tsx components/festivals/BigStuffHeroCard.tsx components/festivals/BigStuffRow.tsx components/festivals/BigStuffCardTests.test.tsx components/festivals/BigStuffMonthSection.tsx components/festivals/BigStuffRibbon.tsx components/festivals/BigStuffCollapsedStrip.tsx components/festivals/useActiveMonth.ts components/festivals/BigStuffPage.tsx 'app/[portal]/festivals/page.tsx'
```

Expected: no errors.

- [ ] **Step 3: Full test suite**

```bash
cd web && npx vitest run
```

Expected: full suite green (prior count + ~30 new tests).

- [ ] **Step 4: Push + create PR**

```bash
git push -u origin feat/big-stuff-page-redesign
gh pr create --title "feat(festivals): rebuild Big Stuff see-all as calendar + hero page" --body "$(cat <<'EOF'
## Summary
- Rewrites `/[portal]/festivals` from a 3-col poster grid into a calendar-spined browse page.
- Collapsed-sticky month ribbon navigation.
- Tier-driven hero-per-month with compact rows underneath.
- Type-color accents and filter chips (Festivals / Conventions / Sports / Community).
- Happening-now events fold into the current month with LIVE NOW pill.

## Spec + plan
- Spec: `docs/superpowers/specs/2026-04-18-big-stuff-page-redesign.md`.
- Plan: `docs/superpowers/plans/2026-04-18-big-stuff-page-redesign.md`.
- Pencil comp: `docs/design-system.pen` node `$PAGE_NODE_ID` (recorded in plan Task 1).

## Test plan
- [x] Unit: `teaser` (7), `type-derivation` (14), `load-big-stuff-page` (12).
- [x] Component: `BigStuffFilterChips` (6), `BigStuffHeroCard` + `BigStuffRow` (9).
- [x] `tsc --noEmit` clean. Lint clean on touched files.
- [x] Browser desktop verify (qa agent).
- [x] `/design-handoff verify` against the Pencil comp.
- [ ] Manual mobile check at 390px (Chrome DevTools).

## Out of scope
- FIFA World Cup match dedup (flagged for crawler work).
- URL-state filtering / multi-select (explicit non-goal).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-Review Notes

**Spec coverage:**
- Page structure (ribbon + scroll body + sticky strip): Tasks 8, 9.
- Hero vs row tiering: Tasks 6, 7.
- Type taxonomy + derivation: Task 3.
- Filter chips: Task 5.
- Loader with in-progress inclusion: Task 4.
- Description teaser: Task 3.
- Happening-now pill: Tasks 6, 7.
- Pencil comp (design-first gate): Task 1.
- Handoff verify: Task 11.
- Mobile: Tasks 6/7/8 (responsive inline) + Task 11 step 3 (manual check).
- A11y (tablist semantics, aria-current, aria-label): Task 5 (chips), Tasks 6/7 (cards), Task 8 (ribbon).

**Placeholder scan:** None found. All code blocks are complete; no "TBD" markers.

**Type consistency:**
- `BigStuffPageItem` is defined once in `web/lib/big-stuff/types.ts` (Task 3) and consumed by Tasks 4, 6, 7, 9.
- `FilterValue = BigStuffType | "all"` defined in Task 5; consumed by Task 9.
- `groupItemsByMonth` signature is unchanged (reused from feed shared module).
- `loadBigStuffForPage` returns `BigStuffPageData | null`; page.tsx consumes same type.
- `LoaderRow` is loader-internal, exported solely for tests — no other consumer.
- `TYPE_ACCENT` + `TYPE_LABEL` live in `types.ts`; consumed by hero + row components.

**Known gotchas that apply here:**
- `text-[var(--text-xs)]` Tailwind v4 bug — avoided; using `text-sm`, `text-xs`, `text-2xs` throughout.
- `SmartImage` for all dynamic images — consistent.
- No `next/image` direct usage with dynamic URLs.
- Supabase `.or()` syntax for compound filter — already validated in PR #58's loader; mirrored here.
- `getOrSetSharedCacheJson` signature matches existing callers.
- `as never` — N/A, all reads.

**Follow-ups (not in scope):**
- FIFA World Cup match dedup (crawler).
- "Atlanta Caribbean Carnival™" near-dupe (crawler).
- `announced_2026` field rename when 2027 hits.
