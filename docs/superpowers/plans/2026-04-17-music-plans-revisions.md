# Music Plans — Expert Review Revisions

**Date:** 2026-04-17
**Status:** Required corrections before executing any of the 5 music plans.

This document consolidates findings from three expert reviews (architect, data-specialist, product-designer) and specifies exact corrections. Each fix is keyed to the plan + task it patches. Implementation agents MUST read this alongside the plan they are executing; any discrepancy between the plan and this revisions doc is resolved in favor of this doc.

---

## 🔴 BLOCKING — silent-failure or runtime-crash risks

These bugs cause plans to no-op, crash, or leak data if not fixed BEFORE dispatch.

### R1. Fabricated import paths across all 7 Plan 1 API loaders

**Affected:** Plan 1 Tasks 10, 11, 12, 13, 14, 15, 16 (every server loader).

**Problem:** Plans import `getManifestForPortalSlug` from `@/lib/portal-runtime` and `getSourceAccessForPortal` from `@/lib/portal-sources` and `applyManifestFederatedScopeToQuery` from `@/lib/city-pulse/source-scoping`. **None of these paths exist** in the codebase. The real APIs live at different paths with different names.

**Fix:** Read `web/app/api/portals/[slug]/shows/route.ts` for the working portal-scoping pattern. Replace the imports and call shape in every loader. The canonical pattern (verify against that file before editing):

```typescript
// Replace this (wrong):
import { createClient } from "@/lib/supabase/server";
import { getManifestForPortalSlug } from "@/lib/portal-runtime";
import { applyManifestFederatedScopeToQuery } from "@/lib/city-pulse/source-scoping";
import { getSourceAccessForPortal } from "@/lib/portal-sources";

// With this (matches shows/route.ts):
import { createClient } from "@/lib/supabase/server";
import { getPortalBySlug } from "@/lib/portal";
import { buildPortalManifest } from "@/lib/portal-manifest";
import { getPortalSourceAccess } from "@/lib/federation";
import { applyManifestFederatedScopeToQuery } from "@/lib/portal-scope";
```

And the invocation pattern:

```typescript
const portal = await getPortalBySlug(portalSlug);
if (!portal) return empty;
const manifest = await buildPortalManifest(portal.id);
const sourceAccess = await getPortalSourceAccess(portal.id);
// ...
q = applyManifestFederatedScopeToQuery(q, manifest, {
  publicOnlyWhenNoPortal: true,
  sourceIds: sourceAccess.sourceIds,
  sourceColumn: "source_id",
});
```

**Verification before ANY loader is written:** open `web/app/api/portals/[slug]/shows/route.ts` and copy the exact import names + invocation. If this revisions doc's names differ from what's actually in that file, the file wins.

---

### R2. Plan 1 Task 4 — slug corrections

**Affected:** Plan 1 Task 4 SQL seed.

**Problem:** Four slugs in the SQL do not match actual `places.slug` values; the UPDATEs silently no-op. Also: the `LIKE 'masquerade%'` wildcard applies one capacity to six different venues (data corruption — Masquerade Heaven/Hell/Purgatory have different capacities).

**Fix (replace these UPDATEs verbatim):**

| Slug in plan | Actual slug in DB |
|---|---|
| `fox-theatre` | `fox-theatre-atlanta` |
| `tabernacle-atlanta` | `tabernacle` |
| `cadence-bank-amphitheatre-lakewood` | `lakewood-amphitheatre` |
| `masquerade%` (wildcard) | **Split into 3 discrete UPDATEs** |

Replace the Masquerade block with:

```sql
UPDATE places SET
  music_programming_style = 'curated_indie',
  music_venue_formats = ARRAY['standing_room']::text[],
  capacity = 1000
WHERE slug = 'the-masquerade-heaven' AND is_active = true;

UPDATE places SET
  music_programming_style = 'curated_indie',
  music_venue_formats = ARRAY['standing_room']::text[],
  capacity = 450
WHERE slug = 'the-masquerade-hell' AND is_active = true;

UPDATE places SET
  music_programming_style = 'curated_indie',
  music_venue_formats = ARRAY['standing_room']::text[],
  capacity = 300
WHERE slug = 'the-masquerade-purgatory' AND is_active = true;
```

Drop `the-masquerade` (the parent record without a room designation) from seeding entirely.

---

### R3. Plan 1 Task 15 — `festivals` table uses `announced_start`, NOT `start_date`

**Affected:** Plan 1 Task 15 `festivals-horizon-loader.ts`.

**Problem:** The loader queries `festivals.start_date` and `festivals.is_active`. The actual schema uses `announced_start` + an `announced_<year>` boolean flag. The loader as written throws a runtime error or returns 0 rows.

**Fix:** Before writing the loader, verify the actual column shape:

```bash
psql "$(npx supabase status -o json | jq -r '.DB_URL')" -c "\d festivals"
```

Rewrite the query to use the real column names. Likely shape:

```typescript
const { data } = await supabase
  .from("festivals")
  .select(`
    id, slug, name, announced_start, announced_end,
    image_url, tags, genres, description,
    place:places(name, neighborhood)
  `)
  .eq("owner_portal_id", portal.id)
  .eq("announced_2026", true)  // or whatever the current-year flag is
  .gte("announced_start", todayIso)
  .lte("announced_start", endIso)
  .order("announced_start", { ascending: true });
```

Then rename `start_date`/`end_date` in the mapped payload to point at the correct columns.

---

### R4. Plan 1 migration ordering — dedupe must run BEFORE seed

**Affected:** Plan 1 Tasks 3 (dedupe, numbered 614) + 4 (seed, numbered 612).

**Problem:** Migration files replay in filename order: 610 → 611 → 612 (seed) → 613 → 614 (dedupe). The seed references `terminal-west` BEFORE dedupe runs, so if the test-suffixed slug is canonical in dev, the UPDATE no-ops. Additionally, Task 3's own audit query at Step 1 sees both canonical and duplicate rows, but Task 3 also requires human input to fill in specific IDs — conflicting with the automated-replay semantics of migrations.

**Fix:** Renumber so dedupe happens first. Option A (rename Task 3 file to `609b_music_place_dedupe.sql` — before 610). Option B (cleaner): run dedupe as a pre-flight check using defensive slug matching in the seed:

```sql
-- In the seed migration, add a defensive CTE up top:
WITH canonical AS (
  SELECT DISTINCT ON (regexp_replace(lower(slug), '-(test|atlanta|dupe)-?.*$', ''))
    id, slug
  FROM places
  WHERE is_active = true
    AND place_type IN ('music_venue', 'bar', 'restaurant')
  ORDER BY regexp_replace(lower(slug), '-(test|atlanta|dupe)-?.*$', ''),
           (SELECT count(*) FROM events WHERE place_id = places.id) DESC
)
UPDATE places SET music_programming_style = 'listening_room', ...
WHERE id IN (SELECT id FROM canonical WHERE slug LIKE 'eddies-attic%');
```

**Recommended:** Option A — renumber. Simpler to reason about. New order:
- 610 = dedupe (was 614)
- 611 = tiering columns (was 610)
- 612 = curator_pick (was 611)
- 613 = classification seed (was 612)
- 614 = residency reclassification (was 613)

Update the plan + all `create_migration_pair.py` invocations accordingly.

---

### R5. Plan 1 Task 5 — residency reclassification uses DB-state UUIDs

**Affected:** Plan 1 Task 5.

**Problem:** `WHERE id = '<eddies_songwriter_round_id>'` placeholders require manual UUID lookup per environment. A plan that works in dev may target the wrong series in staging/prod.

**Fix:** Use slug-only matching. Drop the UUID branch entirely:

```sql
UPDATE series
SET series_type = 'residency',
    description = 'Songwriter-in-the-round since 1993. Audience quiet. Signing up is an honor.'
WHERE slug = 'songwriter-round'  -- verify actual slug first
  AND category = 'music'
  AND is_active = true;
```

Task 5 Step 1 already queries candidates with slug/title — reuse those slugs directly. If a residency has no slug, add one first (a separate UPDATE to generate slugs from titles) before reclassification.

---

### R6. Residency count: target 6-7, not 10

**Affected:** Plan 1 Task 5 completion criteria + spec §2 language.

**Problem:** Data review found only 6-7 usable weekly music series with non-generic, "editorial-voice-worthy" titles. The spec language "~20 residencies" and "10 seeded residencies" over-promises.

**Fix:** Replace Task 5 Step 3 verification count:

```bash
# Before:
# Expected: count >= 10

# After:
# Expected: count >= 6 (Atlanta's real residency count; upper bound ~10 after sources reactivate)
```

Real top candidates (per data review):
- `Sunday Blues at Northside Tavern`
- `Live Latin Band & DJ at Eclipse di Luna`
- `Sunday Jazz Brunch` (venue TBD per data)
- `Thursday Jazz Night`
- `Vegas-Style Piano Show at Park Bench Battery`
- `Dueling Pianos at Park Bench Battery`
- `Sputnik! Dark Alternative Music Video Night`
- `Songwriter Round` (if Eddie's source reactivates)

---

### R7. Doors_time 40% gate is unachievable for most Tier-1 venues

**Affected:** Plan 1 Task 18 Step 5 + Plan 2 completion checklist.

**Problem:** Current fill: Buckhead Theatre 34%, Aisle 5 28%, Tabernacle 20%, all others 0-2%. 40% across all 11 venues is not reachable without crawler overhauls that are bigger than Plan 1 scope.

**Fix:** Two changes:
1. **Lower the gate to 20% on individual venues, 10% average across Tier-1.** Document honestly that `MusicShowtimeChip` degrades gracefully (renders `SHOW 9PM` when only start_time present).
2. **Add two new follow-up tasks to Plan 1's backlog (not blocking):**
   - "Crawler: extract doors_time from Terminal West event DOM (appears inside event subtitle HTML)"
   - "Crawler: extract doors_time from Eddie's Attic listings (structured data available)"

Update Plan 1 Task 18 Step 5 expected output:

```
# Expected: Tier-1 venues at 20%+ fill, average >= 10% across all 11.
# (Was 40% — lowered per data review.)
# If below, MusicShowtimeChip degrades to SHOW-only for affected rows;
# that's acceptable UX per spec §5 and does not block Plan 2.
```

Remove the "Gate: Plan 2 cannot ship" language. Keep fill rate as monitoring metric.

---

### R8. Plan 2 MusicActionSheet — remove `backdrop-blur-sm`

**Affected:** Plan 2 Task 3.

**Problem:** The cinematic-minimalism ADR (`docs/decisions/2026-03-08-cinematic-minimalism-design.md`) is explicit: no backdrop blur. The plan copies the antipattern from `EventPreviewSheet`.

**Fix:** In `MusicActionSheet.tsx`:

```tsx
// Before:
<div className="fixed inset-0 z-[140] bg-black/60 backdrop-blur-sm" ...>

// After:
<div className="fixed inset-0 z-[140] bg-black/70" ...>
```

Consider the same fix in `EventPreviewSheet` as a cleanup follow-up, but not in this workstream.

---

### R9. `text-2xs` systemic misuse across all 4 UI plans

**Affected:** Plans 2, 3a, 3b, 3c — nearly every component with metadata.

**Problem:** `web/CLAUDE.md` is explicit: `text-2xs` (10px) is ONLY for count badges inside chips. Multiple components use it for readable metadata.

**Fix:** Replace `text-2xs` with `text-xs` (11px) in every metadata context. Specific offenders to fix:

| File | Context | Change |
|---|---|---|
| `LiveTonightHeroTile.tsx` | Meta line at bottom of tile | `text-2xs` → `text-xs` |
| `LiveTonightPlaybillRow.tsx` | Any metadata row | `text-2xs` → `text-xs` |
| `ByVenueRow.tsx` | Genre/age/price meta | `text-2xs` → `text-xs` |
| `ByVenueBlock.tsx` | Neighborhood/cap/show-count meta | `text-2xs` → `text-xs` |
| `ByShowRow.tsx` | Genre/bucket chips, meta | `text-2xs` → `text-xs` |
| `MusicResidencyCard.tsx` | Venue + neighborhood meta + "NEXT: ..." stamp | `text-2xs` → `text-xs` |
| `MusicFestivalCard.tsx` | Date/venue/genre/teaser meta | `text-2xs` → `text-xs` |
| `MusicOnSaleCard.tsx` | Venue + date + genre meta | `text-2xs` → `text-xs` |

**Exception — KEEP `text-2xs`:** chip state badges (`FREE`, `21+`, `SOLD OUT`, `LAST TIX`, `CURATOR PICK`, `RESIDENCY`) inside the chip itself. Those ARE count-badge-style decorations.

**Rule for subagents:** if the string is prose or metadata users read, it's `text-xs` minimum. If it's a small pill glued to another element, `text-2xs` is OK.

---

### R10. `text-[var(--twilight)]` as text color — uses `<Dot />` instead

**Affected:** Plan 2 Task 2 `MusicShowtimeChip.tsx`.

**Problem:** `--twilight` is a surface token; using it as text color makes the separator invisible. The antipattern list in `web/CLAUDE.md` flags both:
- `text-[var(--twilight)]` → use `text-[var(--muted)]`
- `<span>·</span>` with opacity → use `<Dot />`

**Fix:** In `MusicShowtimeChip`, replace:

```tsx
// Before:
<span className="text-[var(--twilight)]">·</span>

// After:
import { Dot } from "@/components/ui/Dot";
<Dot />
```

---

### R11. `text-3xl` headliner overflows at 3-up mobile

**Affected:** Plan 2 Task 4 `LiveTonightHeroTile.tsx`.

**Problem:** 30px headliner name in a 125px-wide tile (3-up at 375px) wraps or overflows. Component has no responsive awareness.

**Fix:** Either (A) pass a size variant from the strip:

```tsx
// LiveTonightHeroStrip.tsx — pass sizeVariant based on n:
<LiveTonightHeroTile sizeVariant={n === 1 ? "xl" : n === 2 ? "lg" : "md"} ... />
```

And in `LiveTonightHeroTile`, pick the class based on variant:

```tsx
const headlineCls = {
  xl: "text-3xl sm:text-4xl",
  lg: "text-2xl sm:text-3xl",
  md: "text-lg sm:text-2xl",
}[sizeVariant];
```

Or (B) use container queries — `@container` on the parent strip and `@lg:text-3xl` on the headline. Option A is simpler and the plan already has the prop plumbing.

---

### R12. Route shadow conflict with `[track]/page.tsx`

**Affected:** Plan 3a Task 10 — new `/{portal}/explore/music/page.tsx`.

**Problem:** If `lib/explore-platform/editorial-guides.ts` already has a `music` editorial-guide entry, the existing `[track]/page.tsx` returns different content for `/atlanta/explore/music` than our new page. Next.js static-over-dynamic precedence means the new file wins, but a stale guide entry leaves two competing editorial sources.

**Fix:** Add as **new Task 0 in Plan 3a** (runs before all other tasks):

```markdown
### Task 0: Audit + disable stale music editorial guide

- [ ] **Step 1:** Read `web/lib/explore-platform/editorial-guides.ts`. If there's an entry keyed by `"music"`, document what it currently renders.
- [ ] **Step 2:** Decide handling — if the guide has hand-written editorial copy worth preserving, migrate it into the new page's title/subtitle. If generic, delete the entry.
- [ ] **Step 3:** In the same commit as Plan 3a Task 10 page creation, remove the `"music"` entry from the editorial-guides file OR reshape it to return null for music.
- [ ] **Step 4:** Smoke test — `/atlanta/explore/music` resolves to the NEW page (check the rendered HTML for our new breadcrumb "EXPLORE / MUSIC").
```

---

### R13. Empty state strings should be links

**Affected:** Plan 2 Task 6 (LiveTonightPlaybill), Plan 3a Tasks 6 + 7 (ByVenueView, ByShowView).

**Problem:** Strings like `"Quiet night — see residencies and what's coming up →"` render as `<div>` with arrow glyph. The arrow implies linkability; users will tap it and nothing happens.

**Fix:** Wrap every empty-state string with an arrow in an `<a>`:

```tsx
// Before:
<div className="text-sm italic text-[var(--muted)] py-3">
  Quiet night — see residencies and what's coming up →
</div>

// After:
<a
  href={`/${portalSlug}/explore/music`}
  className="text-sm italic text-[var(--muted)] hover:text-[var(--cream)] py-3 inline-block transition-colors"
>
  Quiet night — see residencies and what's coming up →
</a>
```

---

### R14. Row-tap affordance missing

**Affected:** Plan 2 `LiveTonightPlaybillRow`, Plan 3a `ByVenueRow` + `ByShowRow`.

**Problem:** Spec §9 rule 5: "every tappable showtime/row opens the action sheet." Current plan: only the `MusicShowtimeChip` is tappable. Users expect row-level tap.

**Fix:** Make the row a button or wrap the artist name span in an onClick handler. The chip retains its own handler (don't double-wrap — use `stopPropagation` on the chip's click). Example:

```tsx
// LiveTonightPlaybillRow.tsx — row-level tap:
<div
  onClick={() => onShowTap(show)}
  className="... cursor-pointer hover:bg-[var(--twilight)]/10 transition-colors"
>
  <span>{name}</span>
  <MusicShowtimeChip
    ...
    onTap={(e) => { e?.stopPropagation(); onShowTap(show); }}
  />
</div>
```

Confirm WCAG: the row should have `role="button"` and `tabindex={0}` and keyboard onKeyDown handling for Enter/Space.

---

### R15. `editorial_blurb` vs `featured_blurb` clarification

**Affected:** Plan 1 Task 8, Plan 3a Task 5.

**Problem:** Spec uses the word "editorial blurb." The actual field is `featured_blurb` on events. A subagent grepping for `editorial_blurb` on events may try to add a redundant migration.

**Fix:** Add a note to Plan 1 Task 8 comment header:

```typescript
// NOTE: The editorial blurb field on events is named `featured_blurb` (existing column — do NOT add a new `editorial_blurb` column). Series editorial blurbs use `series.description`.
```

Verify in Plan 3a Task 5 that `ByVenueRow` references `show.featured_blurb` (it does — correct).

---

### R16. Unauthenticated Pin click silently fails

**Affected:** Plan 3a Task 10 `MusicPageClient.handleTogglePin`.

**Problem:** `fetch("/api/music/venue-pins", ...)` returns 401 for guests. The `try`/`catch` doesn't catch 401 (it's a resolved Response, not a thrown error). Optimistic UI persists while the server never records.

**Fix:** Two-part:

1. **Auth-gate the Pin button.** Use `useAuth()` hook (verify name in codebase). If not logged in, Pin button becomes a "Sign in to pin" link:

```tsx
{user ? (
  <button onClick={() => onTogglePin(venue)}>...</button>
) : (
  <a href={`/login?next=/${portalSlug}/explore/music`}>Sign in to pin</a>
)}
```

2. **Check response status in handler:**

```typescript
const res = isPinned
  ? await fetch(`/api/music/venue-pins?portal=${portalSlug}&place_id=${venue.id}`, { method: "DELETE" })
  : await fetch("/api/music/venue-pins", { method: "POST", ... });

if (!res.ok) {
  // Rollback optimistic update.
  setPinnedSlugs((prev) => { /* inverse */ });
  // Toast error.
}
```

3. **Add localStorage mirror for guest state** (per spec §8.5 — "localStorage for guests, merge on login"). New hook `useVenuePins(portalSlug)` returns `{ pins, togglePin }`; for unauth users, writes to `localStorage[`pins-${portalSlug}`]`; on login, POSTs batch to `/api/music/venue-pins/merge` (new endpoint to add).

---

### R17. MusicShowtimeChip + MusicActionSheet dependency between Plans

**Affected:** Plan 3a Tasks 5, 7, 10 — import from `@/components/feed/music/...` (Plan 2 paths).

**Problem:** If Plan 3a executes before Plan 2, TypeScript fails in Task 5 (missing import).

**Fix:** Move both components up from `components/feed/music/` to a new shared location `components/music/` (no `feed` in path). Update Plan 2 to place them there originally; update Plan 3a imports to match. File paths:

- `web/components/music/MusicShowtimeChip.tsx`
- `web/components/music/MusicActionSheet.tsx`

These are shared primitives; the feed-widget-specific components (`LiveTonightHeroTile`, etc.) stay under `components/feed/music/`.

Document in Plan 2 preamble: "Tasks 2 and 3 produce shared primitives at `web/components/music/` — do not place these under `feed/`." Document in Plan 3a preamble: "Depends on Plan 2 Tasks 2 + 3 shipped (creates `components/music/MusicShowtimeChip.tsx` + `MusicActionSheet.tsx`)."

---

### R18. `buildShowPayload` extract upfront (consolidates Task 17)

**Affected:** Plan 1 Task 10 + Task 17.

**Problem:** Task 17 extracts the shared row-to-payload transform AFTER Tasks 10-16 duplicate it six times. TDD-pure, but subagent-driven development hits drift — each task inlines a slightly different version.

**Fix:** Move `buildShowPayload` into Task 10 as a prerequisite. Task 10 becomes:

1. Write `build-show-payload.ts` + test (current Task 17 content)
2. Write `this-week-loader.ts` using it
3. Route + test + commit

Renumber tasks: Task 17 deleted; Tasks 11-16 reference `buildShowPayload` immediately.

Add to Plan 1 preamble: "Task 10 establishes the shared `buildShowPayload` helper. Tasks 11-16 consume it. Do NOT inline the transform in any later loader."

---

### R19. `MusicDisplayTier | "my-venues"` type extension — move to proper prop

**Affected:** Plan 3a Task 5 `ByVenueBlock`.

**Problem:** Prop type `tier: MusicDisplayTier | "my-venues"` extends the canonical type inline. Future consumers of `MusicDisplayTier` have to know about the extension.

**Fix:** Separate rendering-group concern from data-tier concern:

```tsx
// Before:
export interface ByVenueBlockProps {
  tier: MusicDisplayTier | "my-venues";
  // ...
}

// After:
export interface ByVenueBlockProps {
  tier: MusicDisplayTier;  // stored tier
  isPinnedGroup?: boolean;  // UI-only: render as pinned My Venues section
  // ...
}
```

The `ByVenueView` renders My Venues by passing `isPinnedGroup={true}` + the real `tier` of each venue. Pinning is a UI concern on top of tier classification, not a replacement for it.

---

### R20. Sticky day header `bg-[var(--void)]` — fragile

**Affected:** Plan 3a Task 7 `ByShowView`.

**Problem:** Sticky header uses `bg-[var(--void)]` which may or may not match the actual page background (depends on whether the page uses `--void` or `--night`). If mismatched, the sticky header shows a "color band" behind it as content scrolls.

**Fix:** Inherit parent background semantically:

```tsx
// Before:
<div className="sticky top-0 bg-[var(--void)] z-10 py-2">

// After:
<div className="sticky top-0 z-10 py-2 bg-[inherit]">
```

Or wrap the ByShowView in a section with an explicit class `bg-[var(--void)]` and use `bg-[inherit]` inside. Alternative: add a small gradient mask above the sticky header (`from-[var(--void)] to-transparent`) to avoid the hard-edge cut as content scrolls under.

---

### R21. Masquerade/Northside editorial line accuracy

**Affected:** Plan 1 Task 4 (seed editorial lines) — spec §3.

**Problem:** Spec seeds editorial lines for rooms per CM; plan doesn't explicitly populate `places.short_description` or whatever field holds the per-venue italic line. The loader (`buildShowPayload` / `classifyMusicVenue`) maps `short_description` → `editorial_line`. If `short_description` is already used for other CM copy, we conflict.

**Fix:** Audit before seeding. Check:

```bash
psql ... -c "SELECT slug, short_description FROM places WHERE music_programming_style IS NOT NULL LIMIT 5;"
```

If `short_description` is in use for generic copy (restaurant blurbs, etc.), move music-editorial lines to a NEW column `music_editorial_line text` on `places` — one more migration in Plan 1 Task 1's SQL body:

```sql
ALTER TABLE places
  ADD COLUMN IF NOT EXISTS music_editorial_line text;
```

Then the loader reads `music_editorial_line` with fallback to `short_description`. Update `types.ts` and `build-show-payload.ts` accordingly.

---

### R22. `MusicResidencyCard` casing + chip label

**Affected:** Plan 3a Task 8 `MusicResidencyCard.tsx`.

**Problem:** `RESIDENCY` chip text is `"Residency"` (title case) but spec §5 + §7.5 require `RESIDENCY` (all caps). Day-of-week append: `{dow}s` produces "MONDAYs" (mixed case).

**Fix:**

```tsx
// Before:
<span className="...">Residency</span>
<span className="...">{dow}s</span>

// After:
<span className="...">RESIDENCY</span>
<span className="...">{dow?.toUpperCase()}S</span>
```

---

### R23. `MusicPageClient` genre filter — client + server double-wire

**Affected:** Plan 3a Task 10 client genre filter vs Plan 1 Task 13 server genre filter.

**Problem:** Server loader supports genre filter via query param; client re-filters in JS. The page doesn't pass URL genre to the server, so shareability (§8.5) is partially broken — URL preserves filter, server returns unfiltered, client filters on mount (works, but costs a full hydration round).

**Fix:** Commit to client-side-only filtering for v1 (Atlanta's ~30 shows/day is small enough). Simplify both server loaders and the page:

1. Remove `genre_buckets`, `free_only`, `under_25`, `all_ages_only`, `late_night_only` options from `ByShowOptions` and `ByVenueOptions`.
2. Loaders return everything; client filters.
3. URL params remain for shareability; client reads them on mount via `useEffect`.

This simplifies the API surface and removes the server/client duplication. If volume becomes a problem, reintroduce server-side filtering later.

---

## 🟡 SHOULD-FIX — not blocking but fold in before execution

These are quality issues. Subagents should be told about them; skipping them produces lower-quality output but doesn't break.

### S1. Plan 2 Task 8 — manifest ID preservation

When swapping `id: "live-music"` to `id: "live-tonight"`, verify the section id is not used as a cache key anywhere. Grep:

```bash
grep -rn "live-music" web/lib/city-pulse/
```

If any cache layer keys off the id, migrate or preserve.

### S2. Plan 3a Task 10 — `window.location.search = ...` is a full reload

Task 11 fixes this to `router.push({ scroll: false })` for date and `replaceState` for filters. If Task 10 and Task 11 are dispatched as separate subagents, the intermediate state ships with hard reloads. Either merge them or call out the intermediate UX.

### S3. Plan 3a Task 8 — editorial line quoting

```tsx
// Before (may double-quote if DB value is already quoted):
<div>"{venue.editorial_line}"</div>

// After (let italic styling carry it):
<div className="italic">{venue.editorial_line}</div>
```

### S4. Typographic fallback tile (Plan 2 Task 4 State B)

Genre label currently absolute-positioned top-left (floats visually unanchored). Consolidate to bottom overlay alongside artist name; chip stays top-left alone. Matches the State A geometry.

### S5. Plan 3b / 3c completion checklists — verify inherited stagger animation

Both plans need a completion-checklist item: "Browser verify Plan 3a Task 12's page-level stagger fires on this section (it should — sections use `nth-child`, not hard-coded component names)."

### S6. Smith's Olde Bar has 6 upcoming events — source health issue

Tier-1 editorial listed in seed, but with sparse event production. Add to a source-health watch list; consider bumping to "Additional" tier if volume doesn't recover.

### S7. `drive_in_amph` enum value has zero consumers

Plan 1 defines the value in the enum and `programmingLabel` switch, but no seeded venue uses it. Leaving in is harmless (future-proofing for Starlight Six Drive-In re-add), just note in the plan that it's intentionally unused at launch.

### S8. Client-side filter tests

Plan 3a Task 10 client wrapper has filter logic but no test. Add a test file with 3-4 cases: genre-only, free-only, late-night-only, combination.

### S9. Accessibility: action sheet drag handle

Plan 2 Task 3 drag handle is a `<div>`. If non-functional (no drag-to-dismiss), it's fine. Verify `EventPreviewSheet` doesn't implement drag (if it does, parity is needed). Add `aria-hidden="true"` to the handle so screen readers skip it.

---

### R24. `supabase db reset --local` doesn't work in this repo — use `psql $DATABASE_URL`

**Affected:** Every plan task that says `npx supabase db reset --local`.

**Problem:** The supabase/migrations/ track starts at `20260128000086_producer_to_organization_rename.sql`, which renames `event_producers` → `organizations`. But there is no prior migration in the supabase/ track that creates `event_producers`. That table exists only because the canonical schema lives at `database/schema.sql` and/or was historically bootstrapped out-of-band. `supabase db reset --local` replays only the supabase/ track, so it fails with `relation "event_producers" does not exist` on every fresh reset. This has never worked; it's dead documentation, not a regression.

**Fix:** Use the repo's actual verification path:

```bash
# Apply a new migration against the dev/staging DB via DATABASE_URL from .env:
psql "$DATABASE_URL" -f database/migrations/<NNN_name>.sql

# Verify columns / rows exist:
psql "$DATABASE_URL" -c "\\d places"
psql "$DATABASE_URL" -c "SELECT count(*) FROM places WHERE music_programming_style IS NOT NULL;"
```

`$DATABASE_URL` comes from `.env` (loaded by any script that uses `dotenv`); for interactive psql, either `source .env; export DATABASE_URL` or just `psql "$(grep ^DATABASE_URL= .env | cut -d= -f2- | tr -d '\"')"`.

For larger migration batches, `python database/apply_targeted_migrations.py --target staging` (or `production`) is the canonical script — see `database/apply_targeted_migrations.py` for flags. Don't hand-edit the migrations registry in `supabase_migrations.schema_migrations` unless you know what you're doing.

**Subagents must:** replace `npx supabase db reset --local` with `psql "$DATABASE_URL" -f <path>` in every task they execute. Replace `psql "$(npx supabase status -o json | jq -r '.DB_URL')" -c "..."` with `psql "$DATABASE_URL" -c "..."`.

---

## 🟢 NOTABLE — defer to post-v1

Real improvements, not blocking.

### N1. Add `events.on_sale_date` column and crawler backfill

Plan 3c uses `created_at DESC` as a proxy. Real fix: crawler captures announce timestamp from Ticketmaster/AXS. Post-v1 follow-up.

### N2. Artist image pipeline

Typographic fallback is first-class, but long-tail image coverage remains poor. Consider a Spotify/MusicBrainz image pull in the enrichment pipeline; would uplift hero tile density materially.

### N3. Festival event linkage

Few events have `festival_id` populated even when they belong to seeded festivals. Cascade's festival tier fires rarely. Follow-up: audit the festival-event linkage crawler.

---

## Execution order (revised)

After applying all 🔴 fixes, the execution order across plans is:

1. **Plan 1** (with fixes R1-R7, R15, R18, R21 applied) — data foundation. No dispatch until R1 (fabricated imports) is verified against the live codebase.
2. **Plan 2** (with fixes R8-R11, R13, R14, R17 applied) — feed widget. Ships after Plan 1.
3. **Plan 3a** (with fixes R12, R16, R19, R20, R22, R23, R17 applied) — explore page. Ships after Plan 1. Shared primitives from Plan 2 Tasks 2+3 must be in place.
4. **Plan 3b** (with R9 applied) — festivals on horizon. Ships after 3a.
5. **Plan 3c** (with R9 applied) — just announced. Ships after 3a.

---

## Signoff checklist before first subagent dispatch

- [ ] R1: imports verified against `web/app/api/portals/[slug]/shows/route.ts`
- [ ] R2: slugs verified against live `places` table
- [ ] R3: `festivals` column names verified via `\d festivals`
- [ ] R4: migration numbering adjusted in Plan 1
- [ ] R5: residency reclassification uses slugs not UUIDs
- [ ] R7: doors_time gate relaxed; Plan 1 backlog captures crawler follow-ups
- [ ] R8: backdrop-blur removed from MusicActionSheet
- [ ] R9: every `text-2xs` usage in 4 UI plans audited + corrected
- [ ] R12: editorial-guides.ts audited before Plan 3a Task 10
- [ ] R17: `MusicShowtimeChip` + `MusicActionSheet` moved to `components/music/` shared location
- [ ] R18: `buildShowPayload` consolidated into Plan 1 Task 10 (Task 17 deleted)
- [ ] R21: `music_editorial_line` column vs `short_description` reuse decided
- [ ] Execution dependency matrix recorded in each plan's preamble
