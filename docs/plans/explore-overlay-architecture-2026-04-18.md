# Explore Overlay Architecture — Design Memo (post-review v2)

**Date:** 2026-04-18
**Status:** Post-review, ready for implementation on user approval.
**Supersedes:** v1 draft of this memo. All open questions from v1 have been resolved or reshaped by expert review.
**Reviewers:** product-designer (REVISE → resolved), code-review-ai:architect-review (APPROVE-WITH-NOTES → folded).

---

## Problem

Detail-page navigation breaks user flow on every surface:

1. **Blank scaffold** during load on `/atlanta/events/[id]` et al.
2. **Sidebar loss** — user on `/atlanta/explore?lane=events` who clicks an event lands on canonical detail page under feed chrome. Explore shell, gone.
3. **Slow back button** — re-SSR of the prior lane page, same 1-3s cost.

The overlay infrastructure already exists but is inconsistently applied:

- `DetailOverlayRouter` at `web/app/[portal]/_surfaces/detail/DetailOverlayRouter.tsx` handles overlays for event, place, series, org, festival.
- `entity-urls.ts` defines `LinkContext = 'feed' | 'page'` (to be renamed — see §Locked Decisions).
- **Every caller manually passes `LinkContext`** — error-prone, silently wrong when components move between surfaces.
- `FeedSurface` mounts `DetailOverlayRouter`. `ExploreSurface` does not. No overlay view for neighborhoods at all.
- `resolvePortalRuntimePolicy` already computes `supportsOverlayEntry: surface === "feed" || surface === "explore"` — the policy exists; ExploreSurface just doesn't honor it.

---

## Locked Decisions (resolved in review)

These are binding. No further debate.

### 1. Rename `LinkContext`: `'feed' | 'page'` → `'overlay' | 'canonical'`

- Both reviewers converged. Architect: "Rename once at Phase 1 or pay for it forever."
- Happens in Phase 1 alongside the `useLinkContext` introduction.

### 2. Mount overlay router in `PortalSurfaceChrome`, gated on `supportsOverlayEntry`

- NOT lift-and-shift into ExploreSurface.
- Single `if (request.runtimePolicy.supportsOverlayEntry && hasDetailOverlayTarget(...))` branch.
- Deletes ~60 lines of `overlayEnabled ? ... : ...` duplication in FeedSurface.
- Any future overlay-capable surface (calendar, search) becomes a one-line policy change.

### 3. Swap-not-stack via URL builders clearing sibling params

- URL builders (option a) are the single seam that owns overlay-param hygiene.
- `buildEventUrl(id, portal, "overlay")` always clears `spot, series, festival, org, artist, neighborhood` when constructing the URL.
- Shared constant `DETAIL_ENTRY_PARAM_KEYS` imported from `detail-entry-contract.ts` (already exists).
- Router's `resolveDetailOverlayTarget` priority-order stays as defense-in-depth.

### 4. Max overlay depth = 5, then canonical fallback

- After 5 swap-depth steps, the next entity-link click resolves to `'canonical'` context (full-page navigation), regardless of surface.
- Counter tracked in URL state or a ref inside `DetailOverlayRouter`.
- Transition to canonical gets a distinct motion treatment (see §Motion Specs).

### 5. Visual affordance — dusk surface + shadow-card-xl + close X

- Overlay renders at `max-w-3xl` (same as page) on `--dusk` (#18181F) surface.
- Lane behind it stays on `--void` (#09090B) — shadow elevation creates depth, not backdrop dim.
- Close button: X, top-right, 40×40 touch target, `hover:bg-[var(--twilight)]`.
- **No** backdrop dim (violates stillness-is-design).
- **No** breadcrumb (navigation UI competing with content).
- **No** max-width reduction (reads as "less important" which it isn't).
- **No** `backdrop-blur-sm` (that's the modal pattern; overlay ≠ modal per design-truth.md).

### 6. Data seeding pattern — card publishes, router consumes

- **Problem:** overlay opening shouldn't show blank scaffold; cards already have the entity's basic data.
- **Solution:** in-module subscribe-publish store keyed by entity ref (`{kind, id|slug} → partial payload`), populated by cards at render, consumed by router when resolving an overlay target.
- NOT context (cards don't know they're wrapping the overlay).
- NOT URL (length, escape, staleness on back navigation).
- NOT Zustand (too heavy for this scope).
- TTL 60s, cap ~200 entries.
- Overlay renders immediately with seeded data + thin progress bar (`--motion-fast` 200ms) during enrichment fetch.
- Accepts mild staleness (card may know slightly-old venue data); freshness correctness matters less than <200ms open for city-guide data.

### 7. URL state coexistence — two providers, two key-spaces

- `ExploreUrlStateProvider` owns `{lane, display, q, focus, laneParams}`.
- `DetailOverlayRouter` owns overlay params (`event, spot, series, festival, org, artist, neighborhood`).
- Dev-time assertion in `ExploreUrlStateProvider.replaceParams`: mutator must not touch `DETAIL_ENTRY_PARAM_KEYS`. Import the constant and assert.
- Document as a hard rule in `web/CLAUDE.md` § Portal Surface Architecture.

### 8. Migration scope — small, single PR

- Architect grepped the codebase: **2 explicit `context=` prop callers** (`ScheduleRow`, `neighborhoods/[slug]/page.tsx`) + **~14 direct `buildXxxUrl(..., "feed"|"page")` call sites**.
- Single PR for migration. Not staged.
- No ESLint rule — surface area too small. Use `@deprecated` TSDoc on the override prop instead.
- Revisit lint only if call sites multiply post-migration.

---

## Proposed Architecture

### Component 1: `useLinkContext` / `LinkContextProvider`

```tsx
// New: web/lib/link-context.tsx
export type LinkContext = "overlay" | "canonical";

const LinkContextCtx = createContext<LinkContext>("canonical"); // safe default

export function LinkContextProvider({
  value,
  children,
}: { value: LinkContext; children: ReactNode }) {
  return <LinkContextCtx.Provider value={value}>{children}</LinkContextCtx.Provider>;
}

export function useLinkContext(): LinkContext {
  return useContext(LinkContextCtx);
}
```

**Wrapping:**
- `FeedSurface` + `ExploreSurface` wrap in `<LinkContextProvider value="overlay">`
- Standalone detail-page layouts (`/events/[id]`, `/neighborhoods/[slug]`) wrap in `<LinkContextProvider value="canonical">`
- Default (no provider): `"canonical"` — safe

**Consumers:** card components call `useLinkContext()` internally:

```tsx
function EventCard({ event, portal, contextOverride }) {
  const ambient = useLinkContext();
  const context = contextOverride ?? ambient;
  return <Link href={buildEventUrl(event.id, portal, context)} />;
}
```

- Override prop defaults to `undefined` (NOT `"canonical"`), so `useLinkContext()` fires only when the prop is omitted. Avoids the subtle bug where `context={undefined}` short-circuits the hook.
- Optional override marked `@deprecated` — discouraged but available for the rare case (share buttons, etc.).

### Component 2: Overlay router mount in `PortalSurfaceChrome`

Lift the `DetailSurface` wrap out of `FeedSurface`. Single mount point:

```tsx
// In PortalSurfaceChrome
{request.runtimePolicy.supportsOverlayEntry && hasDetailOverlayTarget(searchParams) ? (
  <DetailOverlayRouter portalSlug={request.portal.slug}>
    {children}
  </DetailOverlayRouter>
) : (
  children
)}
```

ExploreSurface gets overlay support for free. FeedSurface sheds its 5+ duplicated branches. Community surface stays unaffected (policy returns false).

### Component 3: URL builders teach overlay-param clearing

```ts
// web/lib/entity-urls.ts — import from detail-entry-contract.ts
import { DETAIL_ENTRY_PARAM_KEYS } from "@/app/[portal]/_surfaces/detail/detail-entry-contract";

function clearOverlayParamsExcept(
  search: URLSearchParams,
  keep: string,
): URLSearchParams {
  const next = new URLSearchParams(search);
  for (const key of DETAIL_ENTRY_PARAM_KEYS) {
    if (key !== keep) next.delete(key);
  }
  return next;
}

export function buildEventUrl(
  id: number,
  portalSlug: string,
  context: LinkContext,
  existingParams?: URLSearchParams,
): string {
  if (context === "overlay") {
    const params = existingParams
      ? clearOverlayParamsExcept(existingParams, "event")
      : new URLSearchParams();
    params.set("event", String(id));
    return `/${portalSlug}?${params.toString()}`;
  }
  return `/${portalSlug}/events/${id}`;
}
```

Every call to `buildXxxUrl(..., "overlay", existingParams)` produces a URL with exactly one overlay param. Swap-not-stack is a property of the URL, not the click handler.

### Component 4: Neighborhood overlay view

- New `NeighborhoodDetailView` client component — extract content from `app/[portal]/neighborhoods/[slug]/page.tsx`.
- Accepts `initialData` prop (seeded from card) + fetches enrichment on mount.
- Registered in `DetailOverlayRouter` dispatch table.
- `buildNeighborhoodUrl(slug, portal, context, existingParams?)` added to `entity-urls.ts`.
- `NeighborhoodIndexCard`, nearby chip row, map drill-down links all go through the new builder.

### Component 5: Standalone detail-page fallback

- `/atlanta/events/[id]`, `/atlanta/neighborhoods/[slug]`, etc., stay as canonical routes.
- Direct visits (shared links, SEO) land on full page under `<LinkContextProvider value="canonical">`.
- Entity children link canonical (no overlay stacking from page → page).
- `DetailOverlayRouter` URL in address bar IS shareable — copy/paste produces same overlay content.

---

## Motion Specs (required before implementation)

Per product-designer — motion spec gates plan approval. Three behaviors:

### Enter (cold load of `/explore?event=123` or click-to-open)

- Existing `animate-detail-enter` — confirm tokens resolve to `--motion-dramatic` 600ms `--ease-out`
- Content slides up 16px + fades in opacity 0 → 1
- Shadow casts 300ms after enter completes (delayed shadow prevents visual noise during slide)

### Exit (close button, Escape, browser back clears param)

- Existing `animate-detail-exit` — same tokens, reversed
- Shadow fades first (200ms), content fades + slides down after

### Swap (entity link clicked inside open overlay)

- Outgoing content opacity fade-out 150ms `--motion-fast`
- Incoming content opacity fade-in 150ms
- **No horizontal slide** — simple cross-fade inside the open overlay container
- `AnimatedDetailWrapper` key based on entity ref — current `key={kind-id}` pattern preserved
- Known acceptable behavior: exit animation of prior overlay is SKIPPED on swap (feels snappy)

### Depth-cap → canonical navigation (user hits depth 5)

- Overlay slides down-and-off 300ms `--motion-normal`
- Then canonical page loads
- Visual distinction from normal close so user senses "leaving overlay context"

### Initial SSR guard

- `animate-detail-enter` must NOT fire on initial page load of a shared `?event=123` link (user would see animation over a blank lane)
- Guard via "did the param just appear" flag from pushState. Use the prior param snapshot: if prior snapshot had no overlay param and current does, animate. Otherwise, render directly.

---

## Accessibility (acceptance gate)

Per product-designer — these are gates, not nice-to-haves.

- [ ] Focus moves to overlay panel (or first interactive element within it) on open
- [ ] Focus restores to the triggering card on close
- [ ] Escape key closes overlay (clears overlay searchParam)
- [ ] `aria-label="Detail overlay"` (or entity-specific: `aria-label="Event detail overlay"`) on overlay container
- [ ] `aria-live="polite"` announcement on open (e.g., "Event detail opened")
- [ ] Focus trap while open — tab/shift-tab cycles within overlay
- [ ] Browser back traverses swap chain correctly (automatic via history, verified by Playwright)

---

## Revised Phase Plan (7 phases)

Per architect-review. Ordered for minimum-risk migration.

### Phase 1 — `useLinkContext` primitive + rename

- New `web/lib/link-context.tsx`
- Rename type: `LinkContext` literal values `'feed' | 'page'` → `'overlay' | 'canonical'`
- Wrap `FeedSurface`, `ExploreSurface` with `value="overlay"`
- Wrap standalone detail-page layouts with `value="canonical"`
- Unit tests: hook returns right value per surface context

### Phase 2 — URL builders learn overlay-param clearing

- Import `DETAIL_ENTRY_PARAM_KEYS` from `detail-entry-contract.ts`
- Builders accept optional `existingParams` + clear sibling keys
- Property-based vitest: for every pair `(kindA, kindB)`, `buildXUrl("B", portal, "overlay", urlWithKindA)` produces `?kindB=...&!kindA`
- ~20-line property test

### Phase 3 — Lift `DetailSurface` into `PortalSurfaceChrome`

- Move the wrap out of FeedSurface, into PortalSurfaceChrome
- Gate on `runtimePolicy.supportsOverlayEntry`
- Delete FeedSurface's 5+ overlay-enabled branches
- Verify: explore → events lane → click event → overlay opens, sidebar persists, no `overlayEnabled` flag checks sprinkled elsewhere

### Phase 4 — Migrate call sites

- 2 explicit `context=` prop callers + ~14 `buildXxxUrl(..., "overlay"|"canonical")` sites
- All card components: replace explicit `context={...}` with `useLinkContext()` + optional override
- `@deprecated` TSDoc on the override prop
- Single PR

### Phase 5 — Portal attribution + auth-gate parity (P0)

- `DetailOverlayRouter` currently doesn't check portal attribution. P0 gap.
- Route overlay data through the same server loader used by canonical pages
- Or fail-closed: if entity's `portal_id` doesn't match surface's portal, redirect to canonical (which 404s/403s)
- Explicit test: auth-gated entity (e.g., sensitive content, private event) overlay request must behave identically to page request

### Phase 6 — Neighborhood overlay view

- New `NeighborhoodDetailView` (client component, accepts `initialData`)
- Register `?neighborhood=slug` in `DetailOverlayRouter`
- New `buildNeighborhoodUrl` in `entity-urls.ts`
- Update `NeighborhoodIndexCard` + nearby chip row + map drill-down

### Phase 7 — Data seeding store + motion polish follow-up

- In-module subscribe-publish store keyed by entity ref
- Cards publish on render, router consumes
- Motion polish beyond the locked specs (if audit finds gaps)
- Tracked separately; ships after Phase 6

---

## Testability Strategy

### Unit (vitest)

- `resolveDetailOverlayTarget` — pure function, trivial
- URL builders' overlay-param-clearing — property-based: `∀ (kindA, kindB), buildBUrl` on URL-with-kindA produces kindB only
- `useLinkContext` fallback + override semantics
- Portal attribution check helper

### Integration (vitest-dom / RTL — minimal use)

- Surface provider values are correctly inherited by card components
- Depth-counter increments/decrements correctly on swap
- `ExploreUrlStateProvider.replaceParams` mutator assertion fires in dev when it attempts to touch overlay keys

### End-to-end (Playwright)

- Depth-3 swap-and-back: click A → overlay A → click B inside A → overlay B (not A+B stacked) → back → overlay A → back → lane surface
- Shared-link canonical: `/atlanta/events/[id]` from fresh tab opens as full page, not overlay
- Escape closes overlay
- Browser back chain on 5 swaps lands back in lane
- Portal mismatch: `forth.../atlanta/explore?event=123` where event 123 is atlanta-only → redirects to canonical 404

---

## Non-Goals

- Not redesigning the detail views themselves (EventDetailView, PlaceDetailView, etc. — keep as-is, just wrap differently).
- Not changing canonical route URLs (SEO preserved).
- Not touching `FeedSurface` overlay behavior beyond the lift into `PortalSurfaceChrome`.
- Not inventing a new overlay mechanism.
- Data seeding store is Phase 7, follow-up. Acceptable to ship overlay without it; it's a latency polish.

---

## Risks

1. **Portal attribution leak in overlay (Phase 5)** — P0 gap architect flagged. If shipped without the fix, a FORTH user could see Atlanta events via overlay that canonical page would 404. **Phase 5 is a gate, not a polish.**
2. **`animate-detail-enter` on initial SSR** — user lands on `?event=123` cold, sees animation over blank lane. Guard required (Component 4 spec).
3. **Migration partial-state** — if Phase 4 migration is partial, some callers still pass explicit `context=` while others use hook. Single-PR migration mitigates. Dev-time assertion catches drift.
4. **URL param collision** — future explore feature adds `?event=` as a non-overlay param? Unlikely — `DETAIL_ENTRY_PARAM_KEYS` namespace is shared, any conflict would be caught by the dev assertion in Phase 1.
5. **Depth counter drift** — swap 5× but then hit a canonical-page URL via address bar → depth counter should reset. Verify in Phase 3/4.

---

## Open Questions (non-blocking — resolve during implementation)

These are small enough to resolve in code review, not pre-approval:

1. **`AnimatedDetailWrapper` key strategy on swap** — current `key={kind-id}` skips prior exit animation (feels snappy). Product-designer's swap spec accepts this. Verify doesn't feel jarring in practice; if it does, coordinate with a delayed-unmount pattern.
2. **Scroll behavior on swap** — current router does `scrollTo(0, 0)` on overlay target change. Keep for swap (new entity = fresh top).
3. **Overlay title handling** — when an event is open in an overlay, should the browser tab title change to the event title, or stay as the portal title? Page context changes title; overlay context probably should too, for shareable-URL correctness. Verify.

---

## Acceptance Gate

**Before Phase 1 starts:**
- [x] product-designer returned REVISE on v1; all 5 actionables folded into v2 — ready for approval re-pass
- [x] architect-review returned APPROVE-WITH-NOTES on v1; all refinements folded into v2 — ready for approval
- [ ] User signs off on v2

**Before Phase 6 ships:**
- [ ] All unit tests pass (bucket util, builder swap invariant, hook)
- [ ] All Playwright scenarios pass (depth-3, shared-link, escape, back-chain, portal-mismatch)
- [ ] `tsc --noEmit` clean
- [ ] `eslint` clean
- [ ] Overlay open latency < 200ms on warm cache (Lighthouse or manual perf test)
- [ ] Accessibility criteria verified (focus trap, Escape, focus restore, aria-label, aria-live)
- [ ] Portal attribution check in place + test (P0 Phase 5)
- [ ] No backdrop-blur, no dim, no breadcrumb on overlay (anti-pattern scan)
- [ ] `product-designer` returns PASS on live surface review
- [ ] `web/CLAUDE.md` updated with the two-provider key-space rule

**Before Phase 7 ships:**
- [ ] Data seeding reduces overlay-open render latency measurably (instrumented before/after)

---

## References

- Memo v1 (pre-review): replaced by this file
- product-designer review: returned REVISE, 5 actionables applied
- architect-review: returned APPROVE-WITH-NOTES, 7-phase plan applied, P0 portal attribution surfaced
- `web/app/[portal]/_surfaces/detail/DetailOverlayRouter.tsx` — existing overlay shell
- `web/app/[portal]/_surfaces/detail/detail-entry-contract.ts` — `DETAIL_ENTRY_PARAM_KEYS` source of truth
- `web/lib/portal-runtime/resolvePortalRuntimePolicy.ts` — `supportsOverlayEntry` policy
- `web/lib/entity-urls.ts` — URL builders (migration target)
- `docs/design-truth.md` — cinematic minimalism, "stillness is design"
- `docs/quality-bar.md` § Motion — motion spec required before plan approval
- `docs/decisions/2026-03-08-cinematic-minimalism-design.md` — no glassmorphism, no decorative neon
