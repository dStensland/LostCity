# Buttery Loading & Transitions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate all loading jank — no blank flashes, no layout shifts, smooth crossfades between every state across all portals.

**Architecture:** Four coordinated systems shipped in phases: (1) unified skeleton primitives with portal-aware theme tokens, (2) React 19 transitions for in-page state changes, (3) ContentSwap component for unified crossfade content replacement, (4) View Transitions API for page-to-page navigation. Each phase is independently valuable.

**Tech Stack:** React 19, Next.js 16 App Router, CSS custom properties, Web Animations API, View Transitions API (progressive enhancement). Zero new dependencies.

**Spec:** `docs/superpowers/specs/2026-03-25-buttery-loading-transitions-design.md`

**Key directories:**
- Hooks live in `web/lib/hooks/` (already exists)
- Card components live in `web/components/` (top level, NOT `components/cards/`)
- Find tab switching is managed in `web/app/[portal]/page.tsx`
- Loading skeletons are server-rendered in `web/app/[portal]/loading.tsx`

---

## Phase 1: Skeleton Primitives + Theme Tokens

### Task 1: Add skeleton theme tokens and reduced motion to globals.css

**Files:**
- Modify: `web/app/globals.css`

- [ ] **Step 1: Add semantic skeleton tokens to `@theme inline` block**

Find the `@theme inline` block in globals.css and add:
```css
--skeleton-base: var(--card-bg, var(--twilight));
--skeleton-highlight: color-mix(in srgb, var(--skeleton-base) 70%, var(--soft) 30%);
```

- [ ] **Step 2: Add light-mode override**

After the existing `[data-theme="light"]` block in globals.css, add:
```css
[data-theme="light"] {
  --skeleton-base: var(--twilight);
  --skeleton-highlight: color-mix(in srgb, var(--skeleton-base) 60%, white 40%);
}
```

- [ ] **Step 3: Update `.skeleton-shimmer` to use tokens**

Replace the hardcoded `.skeleton-shimmer` class (~lines 3405-3413) with:
```css
.skeleton-shimmer {
  background: linear-gradient(
    90deg,
    var(--skeleton-base) 30%,
    var(--skeleton-highlight) 50%,
    var(--skeleton-base) 70%
  );
  background-size: 300% 100%;
  animation: skeleton-shimmer 1.5s linear infinite;
}
```

- [ ] **Step 4: Delete `skeleton-shimmer-light` class**

Remove the `.skeleton-shimmer-light` block (~lines 3415-3423). Replaced by `[data-theme="light"]` token override.

- [ ] **Step 5: Add skeleton reduced motion**

In the existing `@media (prefers-reduced-motion: reduce)` block (~line 2886), add:
```css
.skeleton-shimmer {
  animation: none !important;
  background: var(--skeleton-base) !important;
}
```

- [ ] **Step 6: Align page-enter timing to 250ms**

Find `.animate-page-enter` (~line 2869) and change `0.3s` to `0.25s`:
```css
.animate-page-enter {
  animation: page-enter 0.25s ease-out forwards;
}
```

- [ ] **Step 7: Verify build**

Run: `cd web && npx tsc --noEmit`

- [ ] **Step 8: Commit**

```bash
git add web/app/globals.css
git commit -m "refactor: skeleton theme tokens, light-mode override, reduced motion, align timing"
```

---

### Task 2: Promote useMinSkeletonDelay to shared hook

**Files:**
- Create: `web/lib/hooks/useMinSkeletonDelay.ts`
- Modify: `web/components/feed/FeedSectionSkeleton.tsx`

- [ ] **Step 1: Create the shared hook with bug fix**

Create `web/lib/hooks/useMinSkeletonDelay.ts`:
```typescript
"use client";

import { useState, useEffect, useRef } from "react";

/**
 * Enforce a minimum display time for loading skeletons.
 * Prevents disorienting micro-flashes when data arrives quickly.
 *
 * @param isLoading - Whether data is currently loading
 * @param minMs - Minimum display time in ms (default 250)
 * @returns Whether the skeleton should still be shown
 */
export function useMinSkeletonDelay(isLoading: boolean, minMs = 250): boolean {
  const [showSkeleton, setShowSkeleton] = useState(isLoading);
  const loadStartRef = useRef<number>(isLoading ? Date.now() : 0);

  useEffect(() => {
    if (isLoading) {
      loadStartRef.current = Date.now();
      setShowSkeleton(true);
    } else if (loadStartRef.current > 0) {
      const elapsed = Date.now() - loadStartRef.current;
      const remaining = minMs - elapsed;
      if (remaining <= 0) {
        setShowSkeleton(false);
        loadStartRef.current = 0;
      } else {
        const t = setTimeout(() => {
          setShowSkeleton(false);
          loadStartRef.current = 0;
        }, remaining);
        return () => clearTimeout(t);
      }
    }
  }, [isLoading, minMs]);

  return showSkeleton;
}
```

Bug fixes: `loadStartRef` initializes to `Date.now()` when `isLoading` starts true. Default reduced 400ms → 250ms. Resets ref after hide.

- [ ] **Step 2: Update FeedSectionSkeleton to re-export**

In `web/components/feed/FeedSectionSkeleton.tsx`, replace the `useMinSkeletonDelay` function (lines 264-295) with:
```typescript
export { useMinSkeletonDelay } from "@/lib/hooks/useMinSkeletonDelay";
```

- [ ] **Step 3: Verify build and tests**

Run: `cd web && npx tsc --noEmit && npx vitest run`

- [ ] **Step 4: Commit**

```bash
git add web/lib/hooks/useMinSkeletonDelay.ts web/components/feed/FeedSectionSkeleton.tsx
git commit -m "refactor: promote useMinSkeletonDelay to shared hook, fix init bug, default 250ms"
```

---

### Task 3: Refactor Skeleton component with variant prop

**Files:**
- Modify: `web/components/Skeleton.tsx`

- [ ] **Step 1: Rewrite Skeleton.tsx**

Replace full content:
```typescript
"use client";

import ScopedStyles from "@/components/ScopedStyles";
import { createCssVarClassForTime } from "@/lib/css-utils";

type SkeletonVariant = "text" | "circle" | "rect" | "card";

type Props = {
  variant?: SkeletonVariant;
  className?: string;
  delay?: string;
  width?: string | number;
  height?: string | number;
};

const variantClasses: Record<SkeletonVariant, string> = {
  text: "rounded h-4",
  circle: "rounded-full",
  rect: "rounded-lg",
  card: "rounded-card",
};

export default function Skeleton({
  variant = "rect",
  className = "",
  delay,
  width,
  height,
}: Props) {
  const delayClass = delay
    ? createCssVarClassForTime("--skeleton-delay", delay, "skeleton-delay")
    : null;

  const style: React.CSSProperties = {};
  if (width) style.width = typeof width === "number" ? `${width}px` : width;
  if (height) style.height = typeof height === "number" ? `${height}px` : height;

  return (
    <>
      <ScopedStyles css={delayClass?.css} />
      <div
        className={`skeleton-shimmer ${variantClasses[variant]} ${delay ? "skeleton-delay" : ""} ${delayClass?.className ?? ""} ${className}`}
        style={Object.keys(style).length > 0 ? style : undefined}
      />
    </>
  );
}
```

Removed `light` prop (theme tokens handle it). Added `variant`, `width`, `height`. Always uses `skeleton-shimmer` (no branching).

- [ ] **Step 2: Fix callers using `light` prop**

Run: `cd web && grep -rn 'light=' --include="*.tsx" --include="*.ts" | grep -i skeleton`

Remove `light={true}` from any callers.

- [ ] **Step 3: Verify build**

Run: `cd web && npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add web/components/Skeleton.tsx
git commit -m "refactor: Skeleton — variant prop, theme-token-aware, remove light prop"
```

---

### Task 4: Build SkeletonGroup component

**Files:**
- Create: `web/components/ui/SkeletonGroup.tsx`

- [ ] **Step 1: Create SkeletonGroup**

Create `web/components/ui/SkeletonGroup.tsx`:
```typescript
"use client";

import {
  Children,
  cloneElement,
  isValidElement,
  useRef,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import { useMinSkeletonDelay } from "@/lib/hooks/useMinSkeletonDelay";

interface SkeletonGroupProps {
  show: boolean;
  stagger?: number;
  minDisplayMs?: number;
  fadeDuration?: number;
  children: ReactNode;
  className?: string;
}

export default function SkeletonGroup({
  show,
  stagger = 0.05,
  minDisplayMs = 250,
  fadeDuration = 200,
  children,
  className = "",
}: SkeletonGroupProps) {
  const showSkeleton = useMinSkeletonDelay(show, minDisplayMs);
  const [visible, setVisible] = useState(showSkeleton);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (showSkeleton) {
      setVisible(true);
      return;
    }
    const el = ref.current;
    if (!el) {
      setVisible(false);
      return;
    }
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) {
      setVisible(false);
      return;
    }
    const anim = el.animate([{ opacity: 1 }, { opacity: 0 }], {
      duration: fadeDuration,
      easing: "ease-out",
      fill: "forwards",
    });
    anim.onfinish = () => {
      anim.cancel();
      setVisible(false);
    };
    return () => anim.cancel();
  }, [showSkeleton, fadeDuration]);

  if (!visible) return null;

  const staggeredChildren = Children.map(children, (child, i) => {
    if (!isValidElement(child)) return child;
    const delay = `${(i * stagger).toFixed(2)}s`;
    // Only pass delay to elements that accept it (Skeleton components)
    if (typeof child.type === "function" && child.type.name === "Skeleton") {
      return cloneElement(child as React.ReactElement<{ delay?: string }>, { delay });
    }
    return child;
  });

  return (
    <div ref={ref} className={className}>
      {staggeredChildren}
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `cd web && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add web/components/ui/SkeletonGroup.tsx
git commit -m "feat: SkeletonGroup — staggered skeleton wrapper with min-delay and crossfade-out"
```

---

### Task 5: Delete NeonSpinner (dead code)

**Files:**
- Delete: `web/components/ui/NeonSpinner.tsx`

- [ ] **Step 1: Verify zero imports**

Run: `cd web && grep -rn "NeonSpinner" --include="*.tsx" --include="*.ts" .`

Expected: No matches.

- [ ] **Step 2: Delete and commit**

```bash
rm web/components/ui/NeonSpinner.tsx
git add -A web/components/ui/NeonSpinner.tsx
git commit -m "chore: delete NeonSpinner — dead code, zero usage"
```

---

### Task 6: Build content-matched skeleton factories and update loading.tsx

**Files:**
- Modify: `web/components/EventCardSkeleton.tsx` (add SKELETON_HEIGHT export)
- Create: `web/components/skeletons/DetailHeroSkeleton.tsx`
- Create: `web/components/skeletons/StandardRowSkeleton.tsx`
- Create: `web/components/skeletons/HeroCardSkeleton.tsx`
- Modify: `web/app/[portal]/loading.tsx` (use factories, keep skyline for first load)
- Modify: `web/app/[portal]/events/[id]/loading.tsx` (use DetailHeroSkeleton)

- [ ] **Step 1: Add SKELETON_HEIGHT to EventCardSkeleton**

In `web/components/EventCardSkeleton.tsx`, add at the top after imports:
```typescript
/** Approximate rendered height of a single EventCard for ContentSwap minHeight */
export const EVENT_CARD_SKELETON_HEIGHT = 94; // px, matches comfortable mode
```

- [ ] **Step 2: Create skeleton factories directory and components**

```bash
mkdir -p web/components/skeletons
```

Create content-matched skeleton factories that mirror the exact DOM structure of their real components. Each exports a `SKELETON_HEIGHT` constant. Read the real component first, then build the skeleton to match its dimensions pixel-for-pixel.

Key factories needed:
- `DetailHeroSkeleton` — matches `DetailHero` component (hero image + title + metadata)
- `StandardRowSkeleton` — matches `StandardRow` feed component
- `HeroCardSkeleton` — matches `HeroCard` feed component

- [ ] **Step 3: Update portal loading.tsx to use factories**

Read `web/app/[portal]/loading.tsx`. Replace inline shimmer `S()` helper calls with skeleton factory components where appropriate. Keep the Atlanta skyline SVG for the initial page load (brand element — only shown on first visit per session).

- [ ] **Step 4: Update event detail loading.tsx**

Read `web/app/[portal]/events/[id]/loading.tsx`. Replace inline skeleton markup with `DetailHeroSkeleton` and other factory components.

- [ ] **Step 5: Verify build**

Run: `cd web && npx tsc --noEmit`

- [ ] **Step 6: Commit**

```bash
git add web/components/skeletons/ web/components/EventCardSkeleton.tsx web/app/[portal]/loading.tsx web/app/[portal]/events/[id]/loading.tsx
git commit -m "feat: content-matched skeleton factories with SKELETON_HEIGHT exports"
```

---

## Phase 2: React 19 Transitions (In-Page)

### Task 7: Build TransitionContainer component

**Files:**
- Create: `web/components/ui/TransitionContainer.tsx`

- [ ] **Step 1: Create TransitionContainer**

Create `web/components/ui/TransitionContainer.tsx`:
```typescript
"use client";

import { useRef, useEffect, useState, type ReactNode } from "react";

interface TransitionContainerProps {
  isPending: boolean;
  children: ReactNode;
  scrollToTopOnPending?: boolean;
  className?: string;
}

export default function TransitionContainer({
  isPending,
  children,
  scrollToTopOnPending = false,
  className = "",
}: TransitionContainerProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    setReducedMotion(
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  }, []);

  useEffect(() => {
    if (!isPending) return;
    // Scroll to top of content area on transition start (Pattern B tab switches only)
    if (scrollToTopOnPending && ref.current) {
      ref.current.scrollIntoView({ block: "start", behavior: "instant" as ScrollBehavior });
    }
    // Move focus to container so keyboard users don't interact with stale content
    if (ref.current && document.activeElement !== ref.current) {
      ref.current.focus({ preventScroll: true });
    }
  }, [isPending, scrollToTopOnPending]);

  // When reduced motion is preferred, only apply pointer-events change
  const pendingStyle: React.CSSProperties = isPending
    ? reducedMotion
      ? { pointerEvents: "none" }
      : {
          opacity: 0.55,
          filter: "blur(1px)",
          pointerEvents: "none",
          transition: "opacity 150ms ease-out, filter 150ms ease-out",
        }
    : reducedMotion
      ? {}
      : {
          opacity: 1,
          filter: "none",
          transition: "opacity 150ms ease-out, filter 150ms ease-out",
        };

  return (
    <div
      ref={ref}
      tabIndex={-1}
      className={className}
      style={{ outline: "none", ...pendingStyle }}
    >
      {children}
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `cd web && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add web/components/ui/TransitionContainer.tsx
git commit -m "feat: TransitionContainer — pending dim with blur, reduced motion, focus management"
```

---

### Task 8: Apply transitions to RegularsView (Pattern A — client state)

**Files:**
- Modify: `web/components/find/RegularsView.tsx`

- [ ] **Step 1: Read the current filtering logic**

Read `web/components/find/RegularsView.tsx`. Understand filter state management, chip click handlers, and re-render pattern.

- [ ] **Step 2: Add useTransition + TransitionContainer**

Import `useTransition` from React and `TransitionContainer`. Wrap filter state updates in `startTransition`. Wrap results area in `<TransitionContainer isPending={isPending}>`.

- [ ] **Step 3: Verify build and commit**

```bash
cd web && npx tsc --noEmit
git add web/components/find/RegularsView.tsx
git commit -m "feat: RegularsView — pending dim on filter changes via useTransition"
```

---

### Task 9: Apply transitions to MusicListingsView (Pattern A — client state)

**Files:**
- Modify: `web/components/find/MusicListingsView.tsx`

- [ ] **Step 1: Read current spinner overlay pattern (~lines 245-257)**

- [ ] **Step 2: Replace spinner overlay with TransitionContainer**

Remove the spinner overlay div and replace with `useTransition` + `TransitionContainer` wrapping the results area.

- [ ] **Step 3: Verify build and commit**

```bash
cd web && npx tsc --noEmit
git add web/components/find/MusicListingsView.tsx
git commit -m "feat: MusicListingsView — replace spinner overlay with TransitionContainer"
```

---

### Task 10: Apply transitions to Find tab switches (Pattern B — URL-driven)

**Files:**
- Modify: `web/app/[portal]/page.tsx` (manages Find view tab switching)

- [ ] **Step 1: Read the tab switching logic**

Read `web/app/[portal]/page.tsx`. Find where the Find view tabs (Events/Venues/Regulars/Calendar/Map) are managed and how tab content is swapped.

- [ ] **Step 2: Wrap tab content changes in startTransition**

Add `useTransition` and `TransitionContainer` with `scrollToTopOnPending` for the tab content area.

- [ ] **Step 3: Verify build and commit**

```bash
cd web && npx tsc --noEmit
git add web/app/[portal]/page.tsx
git commit -m "feat: Find tabs — pending dim on tab switch via useTransition"
```

---

### Task 11: Apply transitions to EventsFinder filters (Pattern B)

**Files:**
- Modify: `web/components/find/EventsFinder.tsx`

- [ ] **Step 1: Read current loading pattern and replace with useTransition + TransitionContainer**

- [ ] **Step 2: Verify build and commit**

```bash
cd web && npx tsc --noEmit
git add web/components/find/EventsFinder.tsx
git commit -m "feat: EventsFinder — pending dim on filter/category changes"
```

---

### Task 12: Apply transitions to FeedShell tab switches (Pattern B)

**Files:**
- Modify: `web/components/feed/FeedShell.tsx`

- [ ] **Step 1: Read current Suspense + HorseSpinner pattern**

- [ ] **Step 2: Add useTransition for tab switches, keep Suspense for initial load**

Wrap tab content changes in `startTransition`. Replace HorseSpinner Suspense fallback with `TransitionContainer` for subsequent tab switches. Keep `<Suspense>` for the initial load fallback.

- [ ] **Step 3: Verify build and commit**

```bash
cd web && npx tsc --noEmit
git add web/components/feed/FeedShell.tsx
git commit -m "feat: FeedShell — pending dim on tab switches, keep Suspense for initial load"
```

---

## Phase 3: ContentSwap

### Task 13: Build ContentSwap component

**Files:**
- Create: `web/components/ui/ContentSwap.tsx`
- Modify: `web/app/globals.css` (add `.content-swap-enter`)

- [ ] **Step 1: Add CSS class to globals.css**

Add to globals.css:
```css
.content-swap-enter {
  opacity: 0;
}
```

- [ ] **Step 2: Create ContentSwap**

Create `web/components/ui/ContentSwap.tsx`:
```typescript
"use client";

import {
  useRef,
  useState,
  useEffect,
  type ReactNode,
  type CSSProperties,
} from "react";
import { useMinSkeletonDelay } from "@/lib/hooks/useMinSkeletonDelay";

interface ContentSwapProps {
  children: ReactNode;
  swapKey: string | number;
  error?: Error | null;
  minDisplayMs?: number;
  duration?: number;
  minHeight?: number | string;
  className?: string;
}

export default function ContentSwap({
  children,
  swapKey,
  error,
  minDisplayMs = 250,
  duration = 200,
  minHeight,
  className = "",
}: ContentSwapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const latestChildrenRef = useRef(children);
  const latestKeyRef = useRef(swapKey);
  const [displayedKey, setDisplayedKey] = useState(swapKey);
  const [displayedChildren, setDisplayedChildren] = useState(children);
  const isFirstRender = useRef(true);

  // Always track latest children and key to avoid stale closures in animation callbacks
  latestChildrenRef.current = children;
  latestKeyRef.current = swapKey;

  const isSwapping = displayedKey !== swapKey;
  const delayReady = useMinSkeletonDelay(isSwapping, minDisplayMs);

  // Crossfade helper — fade out then swap then fade in
  function crossfade(el: HTMLDivElement) {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) {
      setDisplayedKey(latestKeyRef.current);
      setDisplayedChildren(latestChildrenRef.current);
      return;
    }

    const halfDuration = duration / 2;
    // Fade out
    const fadeOut = el.animate([{ opacity: 1 }, { opacity: 0 }], {
      duration: halfDuration,
      easing: "ease-out",
    });
    fadeOut.onfinish = () => {
      // Swap content (use refs for latest values, avoiding stale closure)
      setDisplayedKey(latestKeyRef.current);
      setDisplayedChildren(latestChildrenRef.current);
      // Fade in — requestAnimationFrame ensures React has committed the new content
      requestAnimationFrame(() => {
        el.animate([{ opacity: 0 }, { opacity: 1 }], {
          duration: halfDuration,
          easing: "ease-out",
        });
      });
    };
    return fadeOut;
  }

  // Handle error: immediate crossfade
  useEffect(() => {
    if (!error || !containerRef.current) return;
    const anim = crossfade(containerRef.current);
    return () => anim?.cancel();
  }, [error]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle normal swap
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (isSwapping && !delayReady) return;
    if (displayedKey === swapKey && !isSwapping) return;
    if (!containerRef.current) {
      setDisplayedKey(swapKey);
      setDisplayedChildren(children);
      return;
    }
    const anim = crossfade(containerRef.current);
    return () => anim?.cancel();
  }, [swapKey, delayReady]); // eslint-disable-line react-hooks/exhaustive-deps

  const containerStyle: CSSProperties = {};
  if (minHeight) {
    containerStyle.minHeight = typeof minHeight === "number" ? `${minHeight}px` : minHeight;
  }

  return (
    <div
      ref={containerRef}
      className={className}
      style={Object.keys(containerStyle).length > 0 ? containerStyle : undefined}
    >
      {displayedChildren}
    </div>
  );
}
```

Key design decisions:
- `latestChildrenRef` / `latestKeyRef` avoid stale closures in animation callbacks
- `requestAnimationFrame` in `onfinish` ensures React commits new content before fade-in starts (no invisible frame)
- No `fill: "forwards"` — avoids stuck opacity state between animations
- Web Animations API auto-cancels previous animation on same element via effect cleanup
- Static `minHeight` only, no runtime measurement

- [ ] **Step 3: Verify build**

Run: `cd web && npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add web/components/ui/ContentSwap.tsx web/app/globals.css
git commit -m "feat: ContentSwap — unified crossfade content replacement with error prop"
```

---

### Task 14: Fix WhosGoing blank-before-skeleton flash

**Files:**
- Modify: `web/components/WhosGoing.tsx`

- [ ] **Step 1: Read the component, find the loading state**

- [ ] **Step 2: Ensure skeleton renders immediately when loading=true (not blank)**

- [ ] **Step 3: Verify build and commit**

```bash
cd web && npx tsc --noEmit
git add web/components/WhosGoing.tsx
git commit -m "fix: WhosGoing — render skeleton immediately, eliminate blank flash"
```

---

### Task 15: Apply ContentSwap to VenueDetailView

**Files:**
- Modify: `web/components/views/VenueDetailView.tsx`

- [ ] **Step 1: Read VenueDetailView, find loading→content pattern**

- [ ] **Step 2: Wrap in ContentSwap with error prop and minHeight**

Do NOT wrap above-fold server-rendered content (CityBriefing) in ContentSwap.

- [ ] **Step 3: Verify build and commit**

```bash
cd web && npx tsc --noEmit
git add web/components/views/VenueDetailView.tsx
git commit -m "feat: VenueDetailView — ContentSwap for smooth skeleton→content crossfade"
```

---

### Task 16: Apply ContentSwap to event detail view

**Files:**
- Identify and modify the event detail view component (likely `web/components/views/EventDetailView.tsx` or similar)

- [ ] **Step 1: Find and read the event detail component**

Run: `cd web && grep -rn "EventDetail" --include="*.tsx" components/views/`

- [ ] **Step 2: Wrap in ContentSwap with error prop and minHeight**

- [ ] **Step 3: Verify build and commit**

```bash
cd web && npx tsc --noEmit
git add web/components/views/
git commit -m "feat: EventDetailView — ContentSwap for smooth skeleton→content crossfade"
```

---

### Task 17: Apply ContentSwap to feed sections in CityPulseShell

**Files:**
- Modify: `web/components/feed/CityPulseShell.tsx`

- [ ] **Step 1: Read CityPulseShell, identify all skeleton→content swap patterns**

Look for `useMinSkeletonDelay` usage and `showSkeleton ? <FeedSectionSkeleton> : <Content>` patterns. List each feed section that needs ContentSwap.

- [ ] **Step 2: Apply ContentSwap to each feed section (exclude CityBriefing/greeting bar)**

CityBriefing renders from server data — it paints immediately, no ContentSwap. For each other section:
```typescript
<ContentSwap swapKey={data ? "loaded" : "loading"} minHeight={200}>
  {data ? <SectionContent /> : <SectionSkeleton />}
</ContentSwap>
```

- [ ] **Step 3: Compose LazySection + ContentSwap for below-fold sections**

```typescript
<LazySection minHeight={200}>
  <ContentSwap swapKey={data ? "loaded" : "loading"}>
    {data ? <Content /> : <Skeleton />}
  </ContentSwap>
</LazySection>
```

- [ ] **Step 4: Verify build and commit**

```bash
cd web && npx tsc --noEmit
git add web/components/feed/CityPulseShell.tsx
git commit -m "feat: feed sections — ContentSwap for smooth skeleton→content crossfade"
```

---

## Phase 4: View Transitions (Navigation)

### Task 18: Build useViewTransition hook

**Files:**
- Create: `web/lib/hooks/useViewTransition.ts`

- [ ] **Step 1: Create the hook**

Create `web/lib/hooks/useViewTransition.ts`:
```typescript
"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";

/**
 * Wraps router.push() in View Transitions API when supported.
 * Progressive enhancement: Chrome/Edge get crossfade, others get normal navigation.
 */
export function useViewTransition() {
  const router = useRouter();

  const navigate = useCallback(
    (href: string) => {
      if (
        typeof document !== "undefined" &&
        "startViewTransition" in document
      ) {
        document.startViewTransition(() => {
          router.push(href);
        });
      } else {
        router.push(href);
      }
    },
    [router]
  );

  return { navigate };
}
```

- [ ] **Step 2: Verify build and commit**

```bash
cd web && npx tsc --noEmit
git add web/lib/hooks/useViewTransition.ts
git commit -m "feat: useViewTransition — View Transitions API with progressive fallback"
```

---

### Task 19: Update template.tsx for hydration-safe VT detection

**Files:**
- Modify: `web/app/template.tsx`

- [ ] **Step 1: Update template.tsx**

Replace full content:
```typescript
"use client";

import { ReactNode, useState, useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Template component for page transitions.
 * Re-renders on every navigation via key={pathname} for state isolation.
 * Suppresses CSS page-enter animation when View Transitions API is active
 * (VT handles its own crossfade).
 */
export default function Template({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [supportsVT, setSupportsVT] = useState(false);

  useEffect(() => {
    setSupportsVT("startViewTransition" in document);
  }, []);

  return (
    <div key={pathname} className={supportsVT ? "" : "animate-page-enter"}>
      {children}
    </div>
  );
}
```

Server renders with `animate-page-enter` (safe fallback). Client removes after hydration if VT is supported. No hydration mismatch.

- [ ] **Step 2: Verify build and commit**

```bash
cd web && npx tsc --noEmit
git add web/app/template.tsx
git commit -m "feat: template.tsx — hydration-safe VT detection, suppress CSS fade when VT active"
```

---

### Task 20: Add View Transition CSS to globals.css

**Files:**
- Modify: `web/app/globals.css`

- [ ] **Step 1: Add VT CSS near the page-enter animation section**

```css
/* View Transitions — progressive enhancement for page navigation */
@keyframes vt-fade-out {
  to { opacity: 0; }
}
@keyframes vt-fade-in {
  from { opacity: 0; }
}

::view-transition-old(root) {
  animation: 250ms ease-out both vt-fade-out;
}
::view-transition-new(root) {
  animation: 250ms ease-out both vt-fade-in;
}
```

- [ ] **Step 2: Commit**

```bash
git add web/app/globals.css
git commit -m "style: View Transition CSS — root-level crossfade for page navigation"
```

---

### Task 21: Update NavigationProgress for VT delay

**Files:**
- Modify: `web/components/ui/NavigationProgress.tsx`

- [ ] **Step 1: Add hydration-safe VT detection and 300ms delay**

Add after existing state declarations:
```typescript
const [supportsVT, setSupportsVT] = useState(false);
useEffect(() => {
  setSupportsVT("startViewTransition" in document);
}, []);
```

In the click handler that calls `setState("loading")`, add delay when VT active:
```typescript
if (supportsVT) {
  timerRef.current = setTimeout(() => setState("loading"), 300);
} else {
  setState("loading");
}
```

- [ ] **Step 2: Verify build and commit**

```bash
cd web && npx tsc --noEmit
git add web/components/ui/NavigationProgress.tsx
git commit -m "feat: NavigationProgress — 300ms delay when View Transitions active"
```

---

### Task 22: Wire useViewTransition into card navigation

**Files:**
- Modify: `web/components/EventCard.tsx`
- Modify: `web/components/VenueCard.tsx`

- [ ] **Step 1: Read EventCard.tsx and VenueCard.tsx navigation patterns**

Find how they navigate to detail pages (router.push, Link, or anchor tags).

- [ ] **Step 2: Replace navigation with useViewTransition**

For components using `router.push()`:
```typescript
import { useViewTransition } from "@/lib/hooks/useViewTransition";
const { navigate } = useViewTransition();
// Replace: router.push(href)
// With: navigate(href)
```

For `<Link>` usage, intercept the click:
```typescript
<a href={href} onClick={(e) => { e.preventDefault(); navigate(href); }}>
```

- [ ] **Step 3: Verify build and commit**

```bash
cd web && npx tsc --noEmit
git add web/components/EventCard.tsx web/components/VenueCard.tsx
git commit -m "feat: card navigation — use View Transitions for smooth page crossfade"
```

---

## Phase 5: Verification

### Task 23: Full build + test + smoke test

- [ ] **Step 1: TypeScript build**

Run: `cd web && npx tsc --noEmit` — expect zero errors.

- [ ] **Step 2: Run all tests**

Run: `cd web && npx vitest run` — expect all passing.

- [ ] **Step 3: Lint**

Run: `cd web && npm run lint` — expect no new errors.

- [ ] **Step 4: Dev server smoke test**

Run: `cd web && npm run dev`

Verify at `http://localhost:3000/atlanta`:
1. Feed loads with shimmer skeletons (not blank)
2. Skeletons crossfade to content (not hard swap)
3. Clicking a Find tab dims old content (opacity + blur)
4. Clicking an event card crossfades to detail page (no blank flash on Chrome)
5. Back button crossfades back
6. Light-mode portal (`/helpatl`) has visible skeletons
7. `prefers-reduced-motion` disables all animations
