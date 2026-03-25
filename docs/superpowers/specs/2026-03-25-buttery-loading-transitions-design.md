# Buttery Loading & Transitions Design Spec

**Date**: 2026-03-25
**Status**: Approved (rev 3 — post expert review)
**Goal**: Make the entire Atlanta portal feel like a native app — no blank flashes, no layout shifts, smooth crossfades between every state.

## Problem

Loading states across the portal are inconsistent and jarring:

- **3 separate skeleton implementations** (server CSS in loading.tsx, client `Skeleton.tsx` component, `FeedSectionSkeleton` with horse animation) that don't share visual language
- **Light-mode skeletons are invisible** — HelpATL/family portals shimmer at barely-visible opacity
- **CLS from skeleton/content height mismatches** — cards shift 1-3px each, cumulative in lists
- **Flash patterns** — components mount blank before skeleton appears (useEffect gap in WhosGoing, RegularsView)
- **Tab/filter switches show emptiness** — MusicListingsView uses spinner overlay, RegularsView shows no indicator, Find tabs flash blank between content
- **Navigation is skeleton-based** — clicking event card → old page disappears → skeleton → content fades in. 300-800ms of staring at a placeholder.
- **Dead code** — NeonSpinner exists but is unused
- **Missing error states** — detail pages show skeleton forever if API fails
- **Ragged progressive loading** — feed sections finish at different times causing staggered reflows

## Principle

**Never show emptiness for content being replaced.** Skeletons are for first loads only. Every subsequent interaction — tabs, filters, navigation, back — shows old content persisting until new content is ready, then crossfades.

## Architecture: Four Coordinated Systems

### System 1: Unified Skeleton Primitives

The foundation. One skeleton system replacing the current three implementations.

#### Components

**`<Skeleton>`** — Atomic primitive. A shimmer bar with configurable shape via props:
- `variant`: `"text"` | `"circle"` | `"rect"` | `"card"`
- `width`, `height`, `radius` as CSS custom properties (server-renderable)
- Theme-aware: uses `var(--skeleton-base)` and `var(--skeleton-highlight)` semantic tokens (see Theme Tokens below)
- Single `skeleton-shimmer` keyframe (1.5s linear infinite, already exists in globals.css)

**`<SkeletonGroup>`** — Wraps multiple `<Skeleton>` children:
- Auto-increments `--skeleton-delay` on children (staggered animation)
- Enforces `useMinSkeletonDelay(250ms)` so the group never micro-flashes
- Crossfade out: when `show` transitions true→false, opacity 1→0 over 200ms (not a hard cut)
- Replaces all ad-hoc skeleton wrapper patterns

**Content-matched skeleton factories** — `EventCardSkeleton`, `VenueCardSkeleton`, `DetailHeroSkeleton`, `StandardRowSkeleton`, `HeroCardSkeleton`, etc.
- Render the **exact DOM structure** of the real component with skeleton fills
- Dimensions match pixel-for-pixel — eliminates CLS
- Each factory exports a `SKELETON_HEIGHT` constant for use as ContentSwap's `minHeight` prop
- Consolidate from existing partial implementations (EventCardSkeleton, VenueListSkeleton already exist but don't dimension-match)

#### Theme Tokens (semantic, portal-aware)

Skeleton tokens derive from each portal's existing surface tokens. Dark portals use `--card-bg` (which is a dark surface with natural contrast against `--void`). Light portals need an explicit override because `--card-bg` is near-white and invisible against the light page background.

```css
/* In globals.css @theme inline */
--skeleton-base: var(--card-bg, var(--twilight));
--skeleton-highlight: color-mix(in srgb, var(--skeleton-base) 70%, var(--soft) 30%);
```

Light-mode override (required — `--card-bg` is near-white on light portals):
```css
[data-theme="light"] {
  --skeleton-base: var(--twilight);
  --skeleton-highlight: color-mix(in srgb, var(--skeleton-base) 60%, white 40%);
}
```

This gives light portals (HelpATL, Family) a visible gray shimmer (`--twilight` = `#D6D3D1` in light mode) against their warm/cool page backgrounds, while dark portals get palette-matched shimmer from `--card-bg`.

#### Atlanta Skyline: Keep for First Load

The Atlanta skyline SVG in `FeedSectionSkeleton` is a premium brand element — city-specific, hand-crafted, and distinctive. It stays as the initial portal page skeleton (`loading.tsx` for `/atlanta` first load, once per session). The horse appears at 12s for timeout states.

Generic `SkeletonGroup` replaces the skyline only for **repeat interactions** (tab switches, filter changes, content refreshes) where the skyline would feel excessive.

#### What Dies

- `skeleton-shimmer-light` CSS class (theme token overrides replace it)
- `NeonSpinner.tsx` (dead code, delete)
- Inline shimmer divs in `loading.tsx` files (replaced by skeleton factories)
- All per-component `animate-pulse` usage for loading states

#### What Survives

- `HorseSpinner` — brand element for 12s+ timeout "taking longer than usual" state
- Atlanta skyline SVG — kept in `loading.tsx` for first page load
- `skeleton-shimmer` keyframe in globals.css (unchanged, all variants consolidated to use it)
- `useMinSkeletonDelay()` hook (promoted from FeedSectionSkeleton-local to shared utility)

**Note on `useMinSkeletonDelay` promotion:** The current implementation has a bug: `loadStartRef.current` initializes to `0`, so if `isLoading` starts as `false` the delay logic never fires. Fix: initialize `loadStartRef.current = isLoading ? Date.now() : 0` based on the initial `isLoading` value.

**Default minimum delay: 250ms** (reduced from current 400ms). 400ms is perceptibly sluggish on fast networks — users wait 350ms extra when data arrives in 50ms. 250ms prevents micro-flash while staying under the threshold of perceived sluggishness.

---

### System 2: React 19 Transitions for In-Page State Changes

Every tab switch, filter change, and date selection keeps old content visible until new content is ready.

#### Mechanism

React 19's `useTransition()` returns `[isPending, startTransition]`. Wrapping state updates in `startTransition` tells React to:
1. Keep rendering old content (non-blocking)
2. Render new content in the background
3. Swap when ready

#### Two Distinct Patterns

**Pattern A: Client-side state changes.** Filter toggles, date switches, and activity selectors that re-render from existing data or trigger a client-side fetch. `startTransition` wraps the `setState` call. React keeps old UI visible and renders new state in the background. Old content persists until new content is fully ready. This is the ideal case.

**Pattern B: URL-driven data fetching.** Tab switches and category changes that navigate via `router.push()` with new search params, triggering an RSC server round-trip. When `router.push()` is wrapped in `startTransition`, React 19 defers the navigation and keeps old content visible. However, the transition "completes" when the **first** Suspense boundary resolves, not when all nested content is ready. If FindView has a filter bar that renders immediately and a results list inside a Suspense boundary, the transition completes at the filter bar — the results list still shows as a skeleton inside the new content.

This is still a significant improvement over the current behavior (blank flash → full skeleton → content). The user sees old content → brief dim → new shell with results streaming in. But it's not "old results stay until new results are ready" for RSC-driven switches.

#### `<TransitionContainer>` Component

```tsx
interface TransitionContainerProps {
  isPending: boolean;
  children: React.ReactNode;
  className?: string;
}
```

Behavior:
- `isPending=false`: Renders children at full opacity
- `isPending=true`: Applies `opacity: 0.55`, `filter: blur(1px)`, `pointer-events: none`, 150ms CSS transition. The blur carries the "inactive/loading" signal much more clearly than opacity alone on dark surfaces. At 0.7 (originally proposed), content is still fully readable and users re-tap thinking nothing happened.
- Respects `prefers-reduced-motion` (no opacity/blur change, just `pointer-events: none`)
- **Focus management:** On transition start, moves focus to the container itself (`tabIndex={-1}`, `focus()`) so keyboard users don't interact with stale content. Focus returns to the first focusable element in new content after transition completes.
- **Scroll position:** For tab switches (Pattern B), scrolls the content container to top inside the `startTransition` callback, before the state update. Prevents users from landing mid-scroll in new content.

#### Where Applied

| Component | Current Pattern | New Pattern | Type |
|-----------|----------------|-------------|------|
| RegularsView activity/day filters | No loading indicator | `startTransition` + `TransitionContainer` | A (client state) |
| MusicListingsView date switch | Spinner overlay on old content | `startTransition` + `TransitionContainer` | A (client state) |
| FindView tab switches | Content unmounts, skeleton, remount | `startTransition` + `TransitionContainer` | B (URL-driven) |
| EventsFinder filter/category | `useState(loading)` + conditional skeleton | `startTransition` + pending dim | B (URL-driven) |
| Feed tab switches | Suspense with HorseSpinner fallback | `startTransition` + `TransitionContainer` | B (URL-driven) |

#### What Dies

- `{loading && shows.length > 0 && <SpinnerOverlay>}` patterns
- Per-component `useState(loading)` + conditional skeleton for tab/filter changes
- Content-disappears-before-new-content-arrives pattern for non-first-loads

---

### System 3: View Transitions API for Page Navigation

Page-to-page navigation gets a smooth crossfade instead of a blank flash.

#### How View Transitions Interact with Next.js Streaming

This is the critical constraint. `document.startViewTransition()` works by:
1. Capturing a screenshot of the current DOM
2. Running the callback (which triggers `router.push()`)
3. Waiting for the DOM to "settle" into the new state
4. Crossfading old screenshot → new DOM

With Next.js App Router streaming, the new page is **not** an atomic swap. The shell renders immediately with `loading.tsx` skeletons (Suspense fallbacks), then RSC payload streams in chunks. The View Transitions API resolves the transition as soon as the initial DOM is painted — which means **the crossfade lands on the skeleton**, and real content streams in afterward without transition treatment.

**This is the design model we embrace, not fight:**
1. View transition crossfades old page → skeleton (smooth, no blank flash)
2. ContentSwap (System 4) crossfades skeleton → real content as it streams in
3. The result is a two-phase visual sequence: old content → skeleton → real content, each transition smooth

This is a material improvement over the current experience (old content disappears → blank → skeleton hard-cuts in → content hard-cuts in).

#### Shared Element Transitions: Follow-Up, Not V1

Shared element transitions (card image morphing to detail hero) require the destination element to exist when the view transition resolves. Since detail heroes live inside Suspense boundaries and don't exist during the initial skeleton render, shared elements won't work on first implementation.

**V1 scope: root-level crossfade only.** Old page → smooth crossfade → new page skeleton. No `view-transition-name` on individual elements.

**Follow-up scope:** Once the architecture is stable, explore prefetching detail data so the hero exists at transition resolution time. This is a separate design problem.

#### `useViewTransition()` Hook

```tsx
function useViewTransition() {
  const router = useRouter();

  const navigate = useCallback((href: string) => {
    if (document.startViewTransition) {
      document.startViewTransition(() => {
        router.push(href);
      });
    } else {
      router.push(href);
    }
  }, [router]);

  return { navigate };
}
```

Progressive enhancement:
- Chrome 111+, Edge 111+: Root-level crossfade
- Safari 18+: Basic crossfade (view transitions landing in Safari)
- Firefox, older browsers: Standard Next.js navigation with existing CSS fade. Zero degradation.

#### View Transition CSS (added to globals.css)

All view transition CSS lives in globals.css (not inline styles), so no CSP concerns.

```css
@keyframes vt-fade-out {
  to { opacity: 0; }
}
@keyframes vt-fade-in {
  from { opacity: 0; }
}

/* Default crossfade for all navigations */
::view-transition-old(root) {
  animation: 250ms ease-out both vt-fade-out;
}
::view-transition-new(root) {
  animation: 250ms ease-out both vt-fade-in;
}
```

#### `template.tsx` Changes

**Keep `key={pathname}`.** Removing it would break client component state isolation between navigations — form inputs, scroll positions, expanded accordions, and error boundaries would persist across routes. The `key` forces React to unmount/remount the subtree, which is correct behavior.

The view transition captures the old DOM screenshot *before* the key change unmounts the tree. So the sequence is:
1. Browser captures screenshot of old page
2. `key={pathname}` changes → React unmounts old tree, mounts new tree with skeletons
3. Browser crossfades captured screenshot → new skeleton DOM
4. ContentSwap handles skeleton → real content transition

The only change: when View Transitions are active, suppress the `animate-page-enter` CSS class to avoid doubling the fade animation (VT handles the fade, CSS class would add a second one).

**Hydration-safe VT detection:** Cannot use inline `typeof document` check (causes server/client mismatch). Use `useState(false)` + `useEffect` pattern:

```tsx
const [supportsVT, setSupportsVT] = useState(false);
useEffect(() => {
  setSupportsVT("startViewTransition" in document);
}, []);

return (
  <div key={pathname} className={supportsVT ? "" : "animate-page-enter"}>
    {children}
  </div>
);
```

Server always renders with `animate-page-enter` (safe fallback). Client removes it after hydration if VT is supported. The first navigation uses CSS fade; subsequent navigations use VT. No hydration mismatch.

#### NavigationProgress Interaction

The codebase has a `NavigationProgress` component that shows a thin progress bar during navigation. When View Transitions are supported, the crossfade provides visual feedback for the first 250ms. But on slow navigations (>500ms), the crossfade completes and there's no signal that loading continues.

**Don't suppress NavigationProgress. Delay it.** Show the progress bar only after a 300ms delay when VT is active (the crossfade covers the first 250ms, the 50ms buffer avoids overlap). On non-VT browsers, show immediately as today.

```tsx
// In NavigationProgress.tsx
const [supportsVT, setSupportsVT] = useState(false);
useEffect(() => { setSupportsVT("startViewTransition" in document); }, []);

// When navigation starts:
const delay = supportsVT ? 300 : 0;
```

#### Navigation Timeline (Corrected)

| Network Speed | User Experience |
|--------------|-----------------|
| Fast (< 300ms) | Old page screenshot → 250ms crossfade → new page (skeleton may flash briefly, then ContentSwap fades in real content). |
| Medium (300-800ms) | Old page screenshot → 250ms crossfade → skeleton visible → progress bar appears at 300ms → ContentSwap fades in real content. |
| Slow (> 800ms) | Old page screenshot → 250ms crossfade → skeleton with shimmer → progress bar → content streams in, ContentSwap fades each section. |

In all cases: **no blank flash.** The old page screenshot persists through the crossfade. The skeleton is the worst case, and it transitions smoothly in and out.

---

### System 4: ContentSwap (The Glue)

Every place content replaces other content uses one unified component.

#### `<ContentSwap>` Component

```tsx
interface ContentSwapProps {
  children: React.ReactNode;
  swapKey: string | number;        // triggers crossfade on change
  error?: Error | null;            // triggers immediate error state on API failure
  minDisplayMs?: number;            // default 250ms, prevents micro-flash
  duration?: number;                // crossfade duration in ms, default 200
  minHeight?: number | string;      // SSR-safe fallback height (static, no runtime measurement)
  className?: string;
}
```

Behavior:
1. Renders `children` at `opacity: 1`
2. When `swapKey` changes, holds old children visible
3. After `minDisplayMs` elapsed (if applicable), crossfades old → new (200ms)
4. Uses `prefers-reduced-motion` to skip animation
5. **CLS prevention: static `minHeight` only.** No runtime height measurement. The content-matched skeleton factories pixel-match real content, so measured heights are unnecessary. Runtime `offsetHeight` reads on multiple ContentSwap instances cause forced reflow storms (3-4 simultaneous layout thrashes on feed page load). The `minHeight` prop is the sole CLS guard. Skeleton factories export `SKELETON_HEIGHT` constants for this purpose.
6. **Rapid swap handling:** If `swapKey` changes again while a crossfade is in progress, the latest content wins. Use Web Animations API (`element.animate()`) for the crossfade — calling `.animate()` on an element that's already animating automatically cancels the previous animation. This gives cancellation for free without manual state management.
7. **Error prop:** When `error` is set (from a data-fetching hook), ContentSwap immediately crossfades to an error state component (200ms, same duration as content swap). This triggers on API failure, not on a timeout. The 10s independent timer is a safety net for cases where the hook never settles, not the primary error path.
8. **No one-frame flash:** Incoming content is styled with `opacity: 0` via a CSS class (`.content-swap-enter { opacity: 0; }`) applied on initial render. The crossfade animation transitions it to `opacity: 1`. Because the CSS class applies before paint, there's no flash of unstyled content. No `useLayoutEffect` needed.

**Exclusion: CityBriefing.** The above-fold CityBriefing/hero section renders from `serverFeedData` (server-side data passed as props). It does NOT get wrapped in ContentSwap — it should paint immediately without any crossfade delay. ContentSwap is for content that transitions from skeleton → loaded, not for content that's already available at render time.

#### Where Applied

Replaces all ad-hoc swap patterns:
- LazySection's manual opacity transition → compose LazySection (viewport trigger) + ContentSwap (crossfade). LazySection retains its IntersectionObserver deferred rendering; ContentSwap handles the visual transition.
- Detail page conditional rendering (`loading ? skeleton : content`) → `<ContentSwap>`
- Feed section skeleton → content swap → `<ContentSwap>`
- Any `{isLoading ? <Skeleton /> : <RealContent />}` pattern

---

## Implementation Phases

Ship incrementally, not all at once. Each phase is independently valuable and reduces risk.

### Phase 1: Skeleton Primitives + Theme Tokens
- Refactor `Skeleton.tsx` with semantic tokens + light-mode override
- Build `SkeletonGroup` with staggered delays and crossfade-out
- Create content-matched skeleton factories with exported `SKELETON_HEIGHT` constants
- Promote `useMinSkeletonDelay` to shared hook (fix the init bug, default 250ms)
- Update `loading.tsx` files to use factories (keep Atlanta skyline for first load)
- Delete `NeonSpinner.tsx`
- Align `animate-page-enter` fallback to 250ms (currently 300ms) for timing consistency
- **Result:** Consistent, visible skeletons on every portal. Zero CLS. Light-mode fixed.

### Phase 2: React 19 Transitions (In-Page)
- Build `TransitionContainer` (opacity 0.55 + blur(1px), focus management, scroll-to-top)
- Apply to Pattern A components (RegularsView, MusicListingsView)
- Apply to Pattern B components (FindView tabs, EventsFinder, Feed tabs)
- Remove spinner overlays and per-component loading state management
- **Note:** FeedSectionSkeleton's tab-switch usage is replaced here (not in Phase 1). Phase 1 only changes the visual style of skeletons, not the transition behavior.
- **Result:** Tabs and filters keep old content visible. No blank flashes on interaction.

### Phase 3: ContentSwap
- Build `ContentSwap` component (CSS-first opacity, Web Animations API, error prop, static minHeight)
- Replace LazySection opacity transition (compose, don't replace viewport trigger)
- Replace detail page skeleton/content conditional renders
- Replace feed section skeleton→content swaps (exclude CityBriefing)
- Add error prop wiring to `useDetailFetch` and feed section hooks
- Add 10s safety-net timeout → error state, 12s → HorseSpinner retry
- **Result:** Every content replacement is a smooth crossfade. Error states exist.

### Phase 4: View Transitions (Navigation)
- Build `useViewTransition` hook
- Update `template.tsx` (hydration-safe VT detection via useState+useEffect, suppress `animate-page-enter` when VT active)
- Update `NavigationProgress` (300ms delay when VT active, not hidden)
- Add root-level crossfade CSS
- Wire `useViewTransition` into navigation components (cards, links)
- **Result:** Page navigation is a smooth crossfade. No blank flashes between pages.

### Follow-Up (Post V1): Shared Element Transitions
- Explore data prefetching for detail pages
- Add `view-transition-name` to cards and detail heroes once content is available at transition time
- **Result:** Card images morph into detail heroes on supported browsers.

---

## File Changes Summary

### New Files

| File | Purpose | Phase |
|------|---------|-------|
| `components/ui/SkeletonGroup.tsx` | Staggered skeleton wrapper with crossfade | 1 |
| `components/ui/TransitionContainer.tsx` | Pending-state dimming for React 19 transitions | 2 |
| `components/ui/ContentSwap.tsx` | Unified crossfade content replacement | 3 |
| `hooks/useViewTransition.ts` | View Transitions API wrapper with fallback | 4 |
| `hooks/useMinSkeletonDelay.ts` | Promoted from FeedSectionSkeleton to shared (move, not new) | 1 |

### Modified Files

| File | Change | Phase |
|------|--------|-------|
| `components/Skeleton.tsx` | Refactor to use semantic theme tokens, add variant prop | 1 |
| `app/globals.css` | Add skeleton theme tokens + light override, view transition CSS, `.content-swap-enter`, remove `skeleton-shimmer-light` | 1, 3, 4 |
| `app/[portal]/loading.tsx` | Replace inline shimmer divs with skeleton factories (keep skyline for first load) | 1 |
| `app/[portal]/events/[id]/loading.tsx` | Replace inline shimmer with `DetailHeroSkeleton` etc. | 1 |
| `components/feed/CityPulseShell.tsx` | Replace FeedSectionSkeleton usage with SkeletonGroup + ContentSwap | 1, 3 |
| `components/feed/FeedSectionSkeleton.tsx` | Simplify — becomes SkeletonGroup + HorseSpinner for timeout only | 1, 2 |
| `components/find/RegularsView.tsx` | Add `TransitionContainer` for filter feedback | 2 |
| `components/find/MusicListingsView.tsx` | Replace spinner overlay with `TransitionContainer` | 2 |
| `components/find/EventsFinder.tsx` | Add `useTransition` + `TransitionContainer` for filter changes | 2 |
| `components/feed/FeedShell.tsx` | Replace Suspense+HorseSpinner with `useTransition` for tab switches | 2 |
| `components/views/VenueDetailView.tsx` | Wrap in ContentSwap for skeleton→content | 3 |
| `components/WhosGoing.tsx` | Fix blank-before-skeleton flash (render skeleton immediately) | 3 |
| `app/template.tsx` | Hydration-safe VT detection, suppress `animate-page-enter` when VT active | 4 |
| `components/ui/NavigationProgress.tsx` | 300ms delay when VT active (not hidden) | 4 |

### Deleted Files

| File | Reason | Phase |
|------|--------|-------|
| `components/ui/NeonSpinner.tsx` | Dead code, zero usage | 1 |

### Touched But Not Rearchitected

All other `loading.tsx` files, feed section components, and detail views get minor updates (swap inline skeletons for factory components, wrap conditional renders in ContentSwap) but no structural changes.

## Error States

Currently missing. Added as part of Phase 3:

- **`ContentSwap` error prop** — when data-fetching hook returns an error, ContentSwap immediately crossfades to error state (200ms). No waiting for a timeout. Renders a "Something went wrong" card with retry button.
- **`ContentSwap` safety-net timeout** — if content never arrives AND no error is returned (hook hangs), show error state after 10s. This is the fallback, not the primary error path.
- **Detail pages** — `useDetailFetch` passes error to ContentSwap's `error` prop
- **Feed sections** — sections that fail to load collapse gracefully (0 height, no error banner cluttering the feed)
- **HorseSpinner** appears at 12s with "Taking longer than usual..." + retry button (existing pattern, kept)
- **Error boundary reset** — `key={pathname}` on `template.tsx` already handles this (error boundaries reset on navigation because the tree remounts)

## Reduced Motion

All four systems respect `prefers-reduced-motion: reduce`:
- Skeleton shimmer: static fill, no animation
- ContentSwap: instant swap, no crossfade
- TransitionContainer: `pointer-events: none` only, no opacity/blur change
- View Transitions: browser respects the media query natively for `::view-transition` pseudos

## Performance Constraints

These are hard rules to prevent jank:

1. **No runtime height measurement in ContentSwap.** Use static `minHeight` prop exclusively. Skeleton factories export `SKELETON_HEIGHT` constants.
2. **All transitions are GPU-compositable only.** `opacity` and `transform` transitions only. Never animate `height`, `max-height`, `width`, or any layout-triggering property. Container height snaps after crossfade completes.
3. **ContentSwap uses CSS-first opacity** (`.content-swap-enter { opacity: 0; }`) — no `useLayoutEffect`, no one-frame flash.
4. **ContentSwap uses Web Animations API** (`element.animate()`) for crossfades — automatic cancellation on rapid swaps, no manual state machine.
5. **Don't wrap CityBriefing in ContentSwap.** It renders from server data and should paint immediately.
6. **`skeleton-shimmer` background-position animation is paint-triggering** but on small elements with negligible cost. Accepted tradeoff (already running in production).

## Success Criteria

1. **Zero CLS** — no layout shifts measured between skeleton and content on any page
2. **No blank flashes** — navigating between any two pages never shows empty white/void space
3. **Client-side tab/filter switches keep old content visible** — Pattern A transitions hold old results until new results are ready
4. **URL-driven tab switches show smooth transition** — Pattern B transitions dim old content, crossfade to new shell, content streams in gracefully
5. **Progressive enhancement** — Chrome/Edge get crossfade, Safari gets crossfade, Firefox gets existing fade, nothing breaks
6. **Light-mode skeletons visible** — HelpATL/family portal skeletons are clearly visible loading indicators
7. **Consistent timing** — every crossfade is 200ms, every skeleton minimum is 250ms, every pending dim is 150ms
8. **Reduced motion respected** — all animations disabled for users who prefer it
9. **No forced reflows** — zero `offsetHeight`/`getBoundingClientRect` reads during content swap transitions

## Non-Goals

- No shared element transitions in V1 (follow-up after streaming coordination solved)
- No gesture-based transitions (swipe to go back)
- No spring physics or bounce animations
- No framer-motion or new dependencies
- No changes to data fetching architecture (RSC, API routes, React Query)
- No changes to the feed section order or content strategy
