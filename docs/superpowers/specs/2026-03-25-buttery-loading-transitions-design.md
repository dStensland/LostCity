# Buttery Loading & Transitions Design Spec

**Date**: 2026-03-25
**Status**: Approved
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
- Theme-aware: uses `var(--skeleton-base)` and `var(--skeleton-highlight)` tokens defined at the theme layer. Dark portals get `--twilight` → lighter mix. Light portals get visible gray → lighter gray. **No separate `skeleton-shimmer-light` class** — theme tokens handle it.
- Single `skeleton-shimmer` keyframe (1.5s linear infinite, already exists in globals.css)

**`<SkeletonGroup>`** — Wraps multiple `<Skeleton>` children:
- Auto-increments `--skeleton-delay` on children (staggered animation)
- Enforces `useMinSkeletonDelay(400ms)` so the group never micro-flashes
- Crossfade out: when `show` transitions true→false, opacity 1→0 over 200ms (not a hard cut)
- Replaces all ad-hoc skeleton wrapper patterns

**Content-matched skeleton factories** — `EventCardSkeleton`, `VenueCardSkeleton`, `DetailHeroSkeleton`, `StandardRowSkeleton`, `HeroCardSkeleton`, etc.
- Render the **exact DOM structure** of the real component with skeleton fills
- Dimensions match pixel-for-pixel — eliminates CLS
- Consolidate from existing partial implementations (EventCardSkeleton, VenueListSkeleton already exist but don't dimension-match)

#### Theme Tokens (added to globals.css `@theme inline`)

```css
--skeleton-base: var(--twilight);
--skeleton-highlight: color-mix(in srgb, var(--twilight) 70%, var(--soft) 30%);
```

Portal theme overrides for light mode:
```css
[data-theme="light"] {
  --skeleton-base: rgba(0, 0, 0, 0.08);
  --skeleton-highlight: rgba(0, 0, 0, 0.14);
}
```

#### What Dies

- `skeleton-shimmer-light` CSS class (theme tokens replace it)
- `FeedSectionSkeleton` horse animation as default loading (replaced by `SkeletonGroup` crossfade)
- `NeonSpinner.tsx` (dead code, delete)
- Inline shimmer divs in `loading.tsx` files (replaced by skeleton factories)
- All per-component `animate-pulse` usage for loading states

#### What Survives

- `HorseSpinner` — kept as brand element for 12s+ timeout "taking longer than usual" state
- `skeleton-shimmer` keyframe in globals.css (unchanged, all variants consolidated to use it)
- `useMinSkeletonDelay()` hook (promoted from FeedSectionSkeleton-local to shared utility)

---

### System 2: React 19 Transitions for In-Page State Changes

Every tab switch, filter change, and date selection keeps old content visible until new content is ready.

#### Mechanism

React 19's `useTransition()` returns `[isPending, startTransition]`. Wrapping state updates in `startTransition` tells React to:
1. Keep rendering old content (non-blocking)
2. Render new content in the background
3. Swap when ready

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
- `isPending=true`: Applies `opacity: 0.7`, `pointer-events: none`, 150ms CSS transition
- When `isPending` transitions false→true→false, old content dims then new content appears at full opacity
- Respects `prefers-reduced-motion` (no opacity change, just `pointer-events: none`)

#### Where Applied

| Component | Current Pattern | New Pattern |
|-----------|----------------|-------------|
| FindView tab switches | Content unmounts, skeleton, remount | `startTransition` + `TransitionContainer` |
| EventsFinder filter/category | `useState(loading)` + conditional skeleton | `startTransition` + pending dim |
| MusicListingsView date switch | Spinner overlay on old content | `startTransition` + `TransitionContainer` |
| RegularsView activity/day filters | No loading indicator | `startTransition` + `TransitionContainer` |
| Feed tab switches | Suspense with HorseSpinner fallback | `startTransition` + `TransitionContainer` |

#### What Dies

- `{loading && shows.length > 0 && <SpinnerOverlay>}` patterns
- Per-component `useState(loading)` + conditional skeleton for tab/filter changes
- Content-disappears-before-new-content-arrives pattern for non-first-loads

---

### System 3: View Transitions API for Page Navigation

Page-to-page navigation feels like content reshaping, not page rebuilding.

#### Mechanism

The View Transitions API (`document.startViewTransition()`) lets the browser:
1. Snapshot the current page as an image
2. Render the new page
3. Crossfade old snapshot → new page
4. Morph elements with matching `view-transition-name` values

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
- Chrome 111+, Edge 111+: Full shared element transitions
- Safari 18+: Basic crossfade (view transitions land without shared elements)
- Firefox, older browsers: Standard Next.js navigation with existing CSS fade. Zero degradation.

#### Shared Element Transitions

| Source | Destination | Shared Element |
|--------|-------------|----------------|
| Event card image | Event detail hero image | `view-transition-name: event-{id}` |
| Event card title | Event detail title | `view-transition-name: event-title-{id}` |
| Venue card image | Venue detail hero image | `view-transition-name: venue-{id}` |
| Section header | Find view header | `view-transition-name: section-{slug}` |
| Back navigation | Reverse of above | Same names, browser reverses animation |

Dynamic assignment:
```tsx
// On the card (source)
<div style={{ viewTransitionName: `event-${event.id}` }}>
  <SmartImage src={event.image_url} ... />
</div>

// On the detail hero (destination)
<div style={{ viewTransitionName: `event-${event.id}` }}>
  <DetailHero ... />
</div>
```

#### View Transition CSS (added to globals.css)

```css
/* Default crossfade for all navigations */
::view-transition-old(root) {
  animation: 250ms ease-out both fade-out;
}
::view-transition-new(root) {
  animation: 250ms ease-out both fade-in;
}

/* Shared elements morph with slight scale */
::view-transition-old(*):not(::view-transition-old(root)),
::view-transition-new(*):not(::view-transition-new(root)) {
  animation-duration: 300ms;
  animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
}
```

#### `template.tsx` Changes

Remove the `key={pathname}` remount trick — it causes the blank flash that View Transitions eliminates. For non-VT browsers, trigger the `animate-page-enter` class via a route-change listener instead of key-based remount.

```tsx
// Before
<div key={pathname} className="animate-page-enter">{children}</div>

// After
<div className={transitioning ? "animate-page-enter" : ""}>{children}</div>
```

#### Navigation Timeline

| Network Speed | User Experience |
|--------------|-----------------|
| Fast (< 300ms) | Old page → 250ms crossfade → new page. No skeleton visible. |
| Medium (300-800ms) | Old page → crossfade begins → skeleton briefly visible during stream → content fades in. |
| Slow (> 800ms) | Old page → crossfade → skeleton with shimmer → content streams in and crossfades. |

---

### System 4: ContentSwap (The Glue)

Every place content replaces other content uses one unified component.

#### `<ContentSwap>` Component

```tsx
interface ContentSwapProps {
  children: React.ReactNode;
  swapKey: string | number;        // triggers crossfade on change
  minDisplayMs?: number;            // default 400ms, prevents micro-flash
  duration?: number;                // crossfade duration in ms, default 200
  className?: string;
}
```

Behavior:
1. Renders `children` at `opacity: 1`
2. When `swapKey` changes, holds old children visible
3. After `minDisplayMs` elapsed (if applicable), crossfades old → new (200ms)
4. Uses `prefers-reduced-motion` to skip animation
5. Uses `useLayoutEffect` to measure outgoing height, set `min-height` on container to prevent CLS during swap

#### Where Applied

Replaces all ad-hoc swap patterns:
- LazySection's manual opacity transition → `<ContentSwap>`
- Detail page conditional rendering (`loading ? skeleton : content`) → `<ContentSwap>`
- Feed section skeleton → content swap → `<ContentSwap>`
- Any `{isLoading ? <Skeleton /> : <RealContent />}` pattern

---

## File Changes Summary

### New Files

| File | Purpose |
|------|---------|
| `components/ui/SkeletonGroup.tsx` | Staggered skeleton wrapper with crossfade |
| `components/ui/TransitionContainer.tsx` | Pending-state dimming for React 19 transitions |
| `components/ui/ContentSwap.tsx` | Unified crossfade content replacement |
| `hooks/useViewTransition.ts` | View Transitions API wrapper with fallback |
| `hooks/useMinSkeletonDelay.ts` | Promoted from FeedSectionSkeleton to shared (move, not new) |

### Modified Files

| File | Change |
|------|--------|
| `components/Skeleton.tsx` | Refactor to use theme tokens, add variant prop |
| `app/globals.css` | Add skeleton theme tokens, view transition CSS, remove `skeleton-shimmer-light` |
| `app/template.tsx` | Remove `key={pathname}` remount, integrate view transition detection |
| `app/[portal]/loading.tsx` | Replace inline shimmer divs with skeleton factories |
| `app/[portal]/events/[id]/loading.tsx` | Replace inline shimmer with `DetailHeroSkeleton` etc. |
| `components/feed/CityPulseShell.tsx` | Replace FeedSectionSkeleton usage with SkeletonGroup + ContentSwap |
| `components/feed/FeedSectionSkeleton.tsx` | Gut and simplify — becomes SkeletonGroup + HorseSpinner for timeout only |
| `components/find/EventsFinder.tsx` | Add `useTransition` + `TransitionContainer` for filter changes |
| `components/find/MusicListingsView.tsx` | Replace spinner overlay with `TransitionContainer` |
| `components/find/RegularsView.tsx` | Add `TransitionContainer` for filter feedback |
| `components/feed/FeedShell.tsx` | Replace Suspense+HorseSpinner with `useTransition` for tab switches |
| `components/cards/EventCard.tsx` | Add `view-transition-name` for shared element |
| `components/cards/VenueCard.tsx` | Add `view-transition-name` for shared element |
| `components/detail/DetailHero.tsx` | Add matching `view-transition-name` |
| `components/views/VenueDetailView.tsx` | Wrap in ContentSwap for skeleton→content |
| `components/WhosGoing.tsx` | Fix blank-before-skeleton flash (render skeleton immediately) |

### Deleted Files

| File | Reason |
|------|--------|
| `components/ui/NeonSpinner.tsx` | Dead code, zero usage |

### Touched But Not Rearchitected

All other `loading.tsx` files, feed section components, and detail views get minor updates (swap inline skeletons for factory components, wrap conditional renders in ContentSwap) but no structural changes.

## Error States

Currently missing. Added as part of this work:

- **`ContentSwap` timeout** — if content doesn't arrive within 10s, show error state (not infinite skeleton)
- **Detail pages** — `useDetailFetch` gets an error return that renders a "Something went wrong" card instead of eternal skeleton
- **Feed sections** — sections that fail to load collapse gracefully (0 height, no error banner cluttering the feed)
- **HorseSpinner** appears at 12s with "Taking longer than usual..." + retry button (existing pattern, kept)

## Reduced Motion

All four systems respect `prefers-reduced-motion: reduce`:
- Skeleton shimmer: static fill, no animation
- ContentSwap: instant swap, no crossfade
- TransitionContainer: `pointer-events: none` only, no opacity change
- View Transitions: browser respects the media query natively for `::view-transition` pseudos

## Success Criteria

1. **Zero CLS** — no layout shifts measured between skeleton and content on any page
2. **No blank flashes** — navigating between any two pages never shows empty white/void space
3. **Tab/filter switches keep old content visible** — old results stay on screen until new results are ready
4. **Shared element transitions work** — event card image morphs to detail hero on Chrome/Edge
5. **Progressive enhancement** — Safari gets crossfades, Firefox gets existing fade, nothing breaks
6. **Light-mode skeletons visible** — HelpATL/family portal skeletons are clearly visible loading indicators
7. **Consistent timing** — every crossfade is 200ms, every skeleton minimum is 400ms, every pending dim is 150ms
8. **Reduced motion respected** — all animations disabled for users who prefer it

## Non-Goals

- No gesture-based transitions (swipe to go back)
- No spring physics or bounce animations
- No framer-motion or new dependencies
- No changes to data fetching architecture (RSC, API routes, React Query)
- No changes to the feed section order or content strategy
