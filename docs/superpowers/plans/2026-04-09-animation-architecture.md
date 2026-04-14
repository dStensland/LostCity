# Animation Architecture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish a layered animation system across LostCity — motion tokens, film grain, view transitions, scroll-driven reveals, pointer glow, gradient borders, and a WebGL shader infrastructure — that makes the platform feel cinematic and crafted.

**Architecture:** Three phases. P0 builds shared infrastructure (motion tokens, film grain, view transitions, CSS scroll animations). P1 adds interaction polish (pointer glow, gradient borders, mask fades). P2 adds atmospheric WebGL (ShaderCanvas component, warped noise, particle fields). Each task is independent after Task 1 (motion tokens).

**Tech Stack:** CSS `@property`, `animation-timeline: view()`, View Transitions API, `@starting-style`, WebGL 2 (raw, no Three.js), GLSL fragment shaders. No animation library dependencies.

---

## Phase 0: Foundation

### Task 1: Motion Tokens

**Files:**
- Modify: `web/app/globals.css` (inside `@theme inline` block, ~line 1200)

Motion tokens standardize all animation timing across the app. Every subsequent task references these.

- [ ] **Step 1: Add motion token CSS variables**

In `web/app/globals.css`, find the `@theme inline` block (near the top where `--void`, `--night`, etc. are defined). Add the motion tokens inside the same block:

```css
/* Motion tokens */
--duration-instant: 100ms;
--duration-fast: 180ms;
--duration-normal: 250ms;
--duration-slow: 350ms;
--duration-slower: 500ms;

--ease-out: cubic-bezier(0.16, 1, 0.3, 1);
--ease-in: cubic-bezier(0.55, 0, 1, 0.45);
--ease-standard: cubic-bezier(0.4, 0, 0.2, 1);
--ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);

--stagger-item: 40ms;
--stagger-section: 200ms;
```

- [ ] **Step 2: Update prefers-reduced-motion to collapse tokens**

Find the existing `@media (prefers-reduced-motion: reduce)` block (~line 2939). Add token overrides at the top of it:

```css
@media (prefers-reduced-motion: reduce) {
  :root {
    --duration-instant: 0ms;
    --duration-fast: 0ms;
    --duration-normal: 0ms;
    --duration-slow: 0ms;
    --duration-slower: 0ms;
    --stagger-item: 0ms;
    --stagger-section: 0ms;
  }
  /* ...existing reduced-motion rules... */
}
```

- [ ] **Step 3: Run type check**

```bash
cd web && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add web/app/globals.css
git commit -m "feat(animation): add motion token CSS variables with reduced-motion collapse"
```

---

### Task 2: Film Grain Overlay

**Files:**
- Create: `web/public/textures/noise-256.png` (generate via script)
- Modify: `web/app/globals.css` (add grain overlay utility)
- Modify: `web/app/[portal]/layout.tsx` (add overlay div)

A static noise PNG tiled at low opacity. The single cheapest path to "cinematic." The existing `NoiseTextureAmbient.tsx` uses SVG feTurbulence which is CPU-heavy on large areas — a static PNG tile is near-zero cost.

- [ ] **Step 1: Generate a 256x256 noise texture PNG**

```bash
cd web && node -e "
const { createCanvas } = require('canvas');
const c = createCanvas(256, 256);
const ctx = c.getContext('2d');
const img = ctx.createImageData(256, 256);
for (let i = 0; i < img.data.length; i += 4) {
  const v = Math.floor(Math.random() * 255);
  img.data[i] = v; img.data[i+1] = v; img.data[i+2] = v; img.data[i+3] = 255;
}
ctx.putImageData(img, 0, 0);
const fs = require('fs');
fs.mkdirSync('public/textures', { recursive: true });
fs.writeFileSync('public/textures/noise-256.png', c.toBuffer('image/png'));
console.log('Created noise-256.png');
"
```

If `canvas` npm package isn't available, create the texture using Python or any image tool — it's just a 256x256 image of random grayscale pixels. Alternatively, download one from fffuel.co/nnnoise.

- [ ] **Step 2: Add grain overlay CSS to globals.css**

Add near the end of globals.css, before the `@media (prefers-reduced-motion)` block:

```css
/* ── Film grain overlay ─────────────────────────────────────────── */
.grain-overlay {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 9999;
  opacity: 0.035;
  background-image: url('/textures/noise-256.png');
  background-repeat: repeat;
  mix-blend-mode: overlay;
  animation: grain-shift 400ms steps(6) infinite;
}

@keyframes grain-shift {
  0% { transform: translate(0, 0); }
  20% { transform: translate(-2%, -2%); }
  40% { transform: translate(2%, 1%); }
  60% { transform: translate(-1%, 2%); }
  80% { transform: translate(1%, -1%); }
  100% { transform: translate(0, 0); }
}

@media (prefers-reduced-motion: reduce) {
  .grain-overlay {
    animation: none;
  }
}
```

- [ ] **Step 3: Add grain overlay div to portal layout**

In `web/app/[portal]/layout.tsx`, add the grain overlay div as the last child before the closing tag of the outermost wrapper. Find the return statement and add:

```tsx
<div className="grain-overlay" aria-hidden="true" />
```

Place it after all other content but before the closing `</>` or `</div>`. The `z-index: 9999` and `pointer-events: none` ensure it floats above everything without blocking interaction.

- [ ] **Step 4: Run type check and verify**

```bash
cd web && npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add web/public/textures/ web/app/globals.css web/app/\\[portal\\]/layout.tsx
git commit -m "feat(animation): add film grain overlay with static noise texture"
```

---

### Task 3: View Transitions — Enable + Card-to-Detail Morphing

**Files:**
- Modify: `web/next.config.ts` (~line 169, experimental block)
- Modify: `web/components/event-card/EventCardImage.tsx` (add view-transition-name)
- Modify: `web/components/detail/DetailHero.tsx` (add matching view-transition-name)
- Modify: `web/app/globals.css` (enhance view transition keyframes)

The View Transitions API makes card images morph into detail page heroes during navigation. Next.js 16 supports this via `experimental.viewTransition: true`. The browser snapshots old/new states and cross-fades — compositor-thread, GPU-accelerated.

- [ ] **Step 1: Enable viewTransition in next.config.ts**

Find the `experimental` block (~line 169):

```typescript
experimental: {
  optimizePackageImports: ["@phosphor-icons/react", "date-fns"],
},
```

Add `viewTransition: true`:

```typescript
experimental: {
  optimizePackageImports: ["@phosphor-icons/react", "date-fns"],
  viewTransition: true,
},
```

- [ ] **Step 2: Add view-transition-name to EventCardImage**

In `web/components/event-card/EventCardImage.tsx`, the component needs an event ID to generate a unique transition name. Add an `eventId` prop:

Update the interface (~line 12):
```typescript
interface EventCardImageProps {
  eventId?: number | string;  // ADD THIS
  railImageUrl: string | undefined;
  // ... rest unchanged
}
```

Update the function signature to destructure it, and add the style to the image container div (~line 42):

```tsx
<div
  ref={parallaxContainerRef}
  className={`hidden sm:flex flex-shrink-0 self-stretch relative w-[100px] -ml-3 sm:-ml-3.5 -my-3 sm:-my-3.5 overflow-hidden border-r border-[var(--twilight)]/60 ${
    hasRailImage ? "list-rail-media" : "bg-[var(--night)]/44"
  }`}
  style={{
    borderTopLeftRadius: "inherit",
    borderBottomLeftRadius: "inherit",
    viewTransitionName: eventId ? `event-hero-${eventId}` : undefined,
  } as CSSProperties}
>
```

Add the import for CSSProperties if not already present:
```typescript
import type { CSSProperties } from "react";
```

- [ ] **Step 3: Pass eventId from EventCard to EventCardImage**

In `web/components/EventCard.tsx`, find where `<EventCardImage>` is rendered and add the `eventId` prop. The event ID is available as `event.id` in the component's props. Find the `<EventCardImage` JSX and add:

```tsx
<EventCardImage
  eventId={event.id}
  // ... existing props
/>
```

- [ ] **Step 4: Add matching view-transition-name to DetailHero**

In `web/components/detail/DetailHero.tsx`, add an `entityId` prop to the interface (~line 10):

```typescript
export interface DetailHeroProps {
  entityId?: number | string;  // ADD THIS
  mode: "image" | "poster" | "fallback";
  // ... rest unchanged
}
```

Destructure it in the function signature. Then find the image container div (the one wrapping the `<Image>` tag) and add the style:

```tsx
style={{
  viewTransitionName: entityId ? `event-hero-${entityId}` : undefined,
} as CSSProperties}
```

Add `CSSProperties` import if needed.

- [ ] **Step 5: Pass entityId from event detail page to DetailHero**

In `web/app/[portal]/events/[id]/page.tsx`, find where `<DetailHero>` is rendered and pass the event ID:

```tsx
<DetailHero
  entityId={event.id}
  // ... existing props
/>
```

- [ ] **Step 6: Enhance view transition CSS**

In `web/app/globals.css`, find the existing view transition rules (~line 2919) and replace them with richer animations:

```css
/* ── View transitions ───────────────────────────────────────────── */
@keyframes vt-fade-out {
  from { opacity: 1; }
  to { opacity: 0; }
}

@keyframes vt-fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes vt-slide-out {
  from { opacity: 1; transform: scale(1); }
  to { opacity: 0; transform: scale(0.96); }
}

@keyframes vt-slide-in {
  from { opacity: 0; transform: scale(1.02); }
  to { opacity: 1; transform: scale(1); }
}

::view-transition-old(root) {
  animation: var(--duration-normal) var(--ease-in) both vt-slide-out;
}
::view-transition-new(root) {
  animation: var(--duration-normal) var(--ease-out) both vt-slide-in;
}

/* Named hero transitions get a crossfade + scale morph */
::view-transition-old(event-hero-*) {
  animation: var(--duration-slow) var(--ease-standard) both vt-fade-out;
}
::view-transition-new(event-hero-*) {
  animation: var(--duration-slow) var(--ease-out) both vt-fade-in;
}
```

Note: The `event-hero-*` wildcard selector may not work in all browsers. If it doesn't match, the browser falls back to the default crossfade which is still good. Test and adjust.

- [ ] **Step 7: Run type check**

```bash
cd web && npx tsc --noEmit
```

- [ ] **Step 8: Commit**

```bash
git add web/next.config.ts web/components/event-card/EventCardImage.tsx web/components/EventCard.tsx web/components/detail/DetailHero.tsx web/app/globals.css
git commit -m "feat(animation): enable View Transitions API with card-to-detail hero morphing"
```

---

### Task 4: CSS Scroll-Driven Animations

**Files:**
- Modify: `web/app/globals.css` (add scroll-driven animation utilities)
- Modify: `web/lib/hooks/useScrollReveal.ts` (add CSS-native path + progressive enhancement)

Replace IntersectionObserver-based reveals with native CSS `animation-timeline: view()` where supported, falling back to the existing JS hook. This moves scroll animation to the compositor thread — zero main-thread cost.

- [ ] **Step 1: Add scroll-driven animation utility classes to globals.css**

Add these utilities before the reduced-motion block:

```css
/* ── Scroll-driven reveal animations ────────────────────────────── */
@keyframes scroll-reveal-up {
  from {
    opacity: 0;
    transform: translateY(1rem);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes scroll-reveal-fade {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* CSS-native scroll reveal — used when animation-timeline is supported */
@supports (animation-timeline: view()) {
  .scroll-reveal {
    animation: scroll-reveal-up var(--duration-slower) var(--ease-out) both;
    animation-timeline: view();
    animation-range: entry 0% entry 30%;
  }

  .scroll-reveal-fade {
    animation: scroll-reveal-fade var(--duration-slower) var(--ease-out) both;
    animation-timeline: view();
    animation-range: entry 0% entry 25%;
  }

  /* Staggered children within a scroll-reveal-stagger parent */
  .scroll-reveal-stagger > * {
    animation: scroll-reveal-up var(--duration-slower) var(--ease-out) both;
    animation-timeline: view();
    animation-range: entry 0% entry 35%;
  }

  .scroll-reveal-stagger > *:nth-child(1) { animation-delay: 0ms; }
  .scroll-reveal-stagger > *:nth-child(2) { animation-delay: var(--stagger-item); }
  .scroll-reveal-stagger > *:nth-child(3) { animation-delay: calc(var(--stagger-item) * 2); }
  .scroll-reveal-stagger > *:nth-child(4) { animation-delay: calc(var(--stagger-item) * 3); }
  .scroll-reveal-stagger > *:nth-child(5) { animation-delay: calc(var(--stagger-item) * 4); }
  .scroll-reveal-stagger > *:nth-child(6) { animation-delay: calc(var(--stagger-item) * 5); }
}

/* Fallback for browsers without animation-timeline (Firefox behind flag) */
@supports not (animation-timeline: view()) {
  .scroll-reveal,
  .scroll-reveal-fade {
    /* These elements will use the JS useScrollReveal hook as fallback */
  }
}
```

- [ ] **Step 2: Add CSS-native detection to useScrollReveal**

In `web/lib/hooks/useScrollReveal.ts`, add a feature detection helper and a `className` return value so consumers can use CSS-native reveals when supported:

```typescript
"use client";

import { useEffect, useRef, useState } from "react";

/** Check if the browser supports CSS scroll-driven animations */
const supportsScrollTimeline =
  typeof CSS !== "undefined" && CSS.supports("animation-timeline", "view()");

interface UseScrollRevealOptions {
  threshold?: number;
  rootMargin?: string;
  triggerOnce?: boolean;
}

/**
 * Hook to trigger reveal animations when element scrolls into view.
 * On browsers with animation-timeline support, returns a CSS class
 * and skips the IntersectionObserver (let CSS handle it).
 */
export function useScrollReveal<T extends HTMLElement = HTMLDivElement>({
  threshold = 0.1,
  rootMargin = "0px 0px -50px 0px",
  triggerOnce = true,
}: UseScrollRevealOptions = {}) {
  const ref = useRef<T>(null);
  const [isVisible, setIsVisible] = useState(supportsScrollTimeline);

  useEffect(() => {
    // If CSS handles it, no JS observer needed
    if (supportsScrollTimeline) return;

    const element = ref.current;
    if (!element) return;

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          if (triggerOnce) {
            observer.unobserve(element);
          }
        } else if (!triggerOnce) {
          setIsVisible(false);
        }
      },
      { threshold, rootMargin }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [threshold, rootMargin, triggerOnce]);

  return {
    ref,
    isVisible,
    /** Add this class to the element for CSS-native scroll reveal */
    cssRevealClass: supportsScrollTimeline ? "scroll-reveal" : "",
  };
}

export const scrollRevealClasses = {
  hidden: "opacity-0 translate-y-4",
  visible: "opacity-100 translate-y-0",
  transition: "transition-all duration-500 ease-out",
};

export function getScrollRevealClasses(isVisible: boolean, baseClasses: string = ""): string {
  return `${baseClasses} ${scrollRevealClasses.transition} ${
    isVisible ? scrollRevealClasses.visible : scrollRevealClasses.hidden
  }`;
}
```

- [ ] **Step 3: Run type check**

```bash
cd web && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add web/app/globals.css web/lib/hooks/useScrollReveal.ts
git commit -m "feat(animation): add CSS scroll-driven animation utilities with JS fallback"
```

---

### Task 5: `@starting-style` Entry/Exit Animations

**Files:**
- Modify: `web/app/globals.css` (add entry/exit utility classes)

Native CSS entry animations for elements appearing via `display: none` toggling. Replaces the need for AnimatePresence in most modal/toast/popover cases. Progressive enhancement — browsers without support get instant display.

- [ ] **Step 1: Add @starting-style utility classes to globals.css**

```css
/* ── Entry/exit animations (@starting-style) ────────────────────── */

/* Fade + slide up entry — for modals, toasts, popovers */
.animate-enter {
  opacity: 1;
  transform: translateY(0);
  transition:
    opacity var(--duration-normal) var(--ease-out),
    transform var(--duration-normal) var(--ease-out),
    display var(--duration-normal) allow-discrete;

  @starting-style {
    opacity: 0;
    transform: translateY(0.75rem);
  }
}

.animate-enter[hidden],
.animate-enter.is-hidden {
  opacity: 0;
  transform: translateY(-0.5rem);
  display: none;
  transition:
    opacity var(--duration-fast) var(--ease-in),
    transform var(--duration-fast) var(--ease-in),
    display var(--duration-fast) allow-discrete;
}

/* Scale + fade entry — for dropdowns, popups */
.animate-enter-scale {
  opacity: 1;
  transform: scale(1);
  transition:
    opacity var(--duration-fast) var(--ease-out),
    transform var(--duration-fast) var(--ease-spring),
    display var(--duration-fast) allow-discrete;

  @starting-style {
    opacity: 0;
    transform: scale(0.95);
  }
}

.animate-enter-scale[hidden],
.animate-enter-scale.is-hidden {
  opacity: 0;
  transform: scale(0.97);
  display: none;
  transition:
    opacity var(--duration-instant) var(--ease-in),
    transform var(--duration-instant) var(--ease-in),
    display var(--duration-instant) allow-discrete;
}

/* Slide from right — for side panels, drawers */
.animate-enter-right {
  opacity: 1;
  transform: translateX(0);
  transition:
    opacity var(--duration-normal) var(--ease-out),
    transform var(--duration-normal) var(--ease-out),
    display var(--duration-normal) allow-discrete;

  @starting-style {
    opacity: 0;
    transform: translateX(1.5rem);
  }
}

.animate-enter-right[hidden],
.animate-enter-right.is-hidden {
  opacity: 0;
  transform: translateX(1rem);
  display: none;
}
```

- [ ] **Step 2: Run type check**

```bash
cd web && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add web/app/globals.css
git commit -m "feat(animation): add @starting-style entry/exit animation utilities"
```

---

## Phase 1: Interaction Polish

### Task 6: Pointer-Following Card Glow

**Files:**
- Create: `web/lib/hooks/usePointerGlow.ts`
- Modify: `web/app/globals.css` (add glow overlay CSS)

A radial gradient mask that tracks the cursor along card borders. The signature "crafted" micro-interaction. Portal-themed via CSS variable `--action-primary`.

- [ ] **Step 1: Create the usePointerGlow hook**

Create `web/lib/hooks/usePointerGlow.ts`:

```typescript
"use client";

import { useEffect, useRef, useCallback } from "react";

/**
 * Adds a pointer-following glow effect to a card element.
 * Injects --glow-x and --glow-y CSS variables on pointermove.
 * Pair with .pointer-glow CSS class on the element.
 */
export function usePointerGlow<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null);

  const handlePointerMove = useCallback((e: PointerEvent) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty("--glow-x", `${e.clientX - rect.left}px`);
    el.style.setProperty("--glow-y", `${e.clientY - rect.top}px`);
  }, []);

  const handlePointerLeave = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.removeProperty("--glow-x");
    el.style.removeProperty("--glow-y");
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Respect reduced motion
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    el.addEventListener("pointermove", handlePointerMove);
    el.addEventListener("pointerleave", handlePointerLeave);
    return () => {
      el.removeEventListener("pointermove", handlePointerMove);
      el.removeEventListener("pointerleave", handlePointerLeave);
    };
  }, [handlePointerMove, handlePointerLeave]);

  return ref;
}
```

- [ ] **Step 2: Add pointer-glow CSS to globals.css**

```css
/* ── Pointer-following card glow ────────────────────────────────── */
.pointer-glow {
  position: relative;
  overflow: hidden;
}

.pointer-glow::before {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 1;
  opacity: 0;
  pointer-events: none;
  border-radius: inherit;
  background: radial-gradient(
    600px circle at var(--glow-x, 50%) var(--glow-y, 50%),
    color-mix(in srgb, var(--action-primary, var(--coral)) 12%, transparent),
    transparent 40%
  );
  transition: opacity var(--duration-fast) var(--ease-standard);
}

.pointer-glow:hover::before {
  opacity: 1;
}
```

- [ ] **Step 3: Run type check**

```bash
cd web && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add web/lib/hooks/usePointerGlow.ts web/app/globals.css
git commit -m "feat(animation): add pointer-following card glow hook and CSS"
```

- [ ] **Step 5: Integrate with EventCard (optional, can be done later)**

In `web/components/EventCard.tsx`, add the hook to the card's outer container. Find the main `<Link>` or `<a>` wrapper and add:

```typescript
import { usePointerGlow } from "@/lib/hooks/usePointerGlow";

// Inside the component:
const glowRef = usePointerGlow<HTMLAnchorElement>();

// On the card container element, merge refs if needed and add className:
<Link ref={glowRef} className="... pointer-glow ...">
```

This is a light integration — just adding the class + ref. Test on desktop; the effect is invisible on mobile (no pointer events).

---

### Task 7: Animated Gradient Borders

**Files:**
- Modify: `web/app/globals.css` (add @property registration + gradient border utility)

Rotating gradient border for featured/premium cards. Uses `@property` to animate a custom angle. On-hover only to keep it subtle.

- [ ] **Step 1: Add @property and gradient border CSS**

```css
/* ── Animated gradient border ───────────────────────────────────── */
@property --border-angle {
  inherits: false;
  initial-value: 0deg;
  syntax: "<angle>";
}

@keyframes border-spin {
  to { --border-angle: 360deg; }
}

.gradient-border {
  --border-color-1: var(--action-primary, var(--coral));
  --border-color-2: var(--gold);
  border: 1px solid transparent;
  background:
    linear-gradient(var(--night), var(--night)) padding-box,
    conic-gradient(
      from var(--border-angle) in oklch longer hue,
      var(--border-color-1),
      var(--border-color-2),
      var(--border-color-1)
    ) border-box;
}

.gradient-border:hover {
  animation: border-spin 3s linear infinite;
}

/* Subtle variant — lower contrast, for non-featured cards */
.gradient-border-subtle {
  --border-color-1: color-mix(in srgb, var(--action-primary, var(--coral)) 40%, transparent);
  --border-color-2: color-mix(in srgb, var(--gold) 30%, transparent);
  border: 1px solid transparent;
  background:
    linear-gradient(var(--night), var(--night)) padding-box,
    conic-gradient(
      from var(--border-angle) in oklch longer hue,
      var(--border-color-1),
      var(--border-color-2),
      var(--border-color-1)
    ) border-box;
}

.gradient-border-subtle:hover {
  animation: border-spin 4s linear infinite;
}
```

- [ ] **Step 2: Run type check**

```bash
cd web && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add web/app/globals.css
git commit -m "feat(animation): add animated gradient border utility via @property"
```

---

### Task 8: Mask-Image Edge Fades

**Files:**
- Modify: `web/app/globals.css` (add mask-image utilities)

Gradient masks for soft edges on carousels, feed sections, and hero images. GPU-accelerated, near-zero cost.

- [ ] **Step 1: Add mask-image utility classes**

```css
/* ── Mask-image edge fades ──────────────────────────────────────── */

/* Horizontal scroll fade — both edges */
.mask-fade-x {
  -webkit-mask-image: linear-gradient(to right, transparent, black 5%, black 95%, transparent);
  mask-image: linear-gradient(to right, transparent, black 5%, black 95%, transparent);
}

/* Bottom fade — encourages scroll */
.mask-fade-bottom {
  -webkit-mask-image: linear-gradient(to bottom, black 80%, transparent 100%);
  mask-image: linear-gradient(to bottom, black 80%, transparent 100%);
}

/* Radial vignette — cinematic hero images */
.mask-vignette {
  -webkit-mask-image: radial-gradient(ellipse 80% 80% at center, black 50%, transparent 100%);
  mask-image: radial-gradient(ellipse 80% 80% at center, black 50%, transparent 100%);
}

/* Top fade — for sticky elements that fade at top edge */
.mask-fade-top {
  -webkit-mask-image: linear-gradient(to bottom, transparent, black 15%);
  mask-image: linear-gradient(to bottom, transparent, black 15%);
}
```

- [ ] **Step 2: Commit**

```bash
git add web/app/globals.css
git commit -m "feat(animation): add mask-image edge fade utility classes"
```

---

## Phase 2: Atmospheric WebGL

### Task 9: ShaderCanvas Component

**Files:**
- Create: `web/components/ambient/ShaderCanvas.tsx`

The foundation component for all WebGL background effects. Handles: lazy mount via IntersectionObserver, visibility pause (`document.visibilityState`), resize, mobile resolution scaling, portal color uniforms, and graceful fallback. Individual shaders are GLSL strings passed as props.

- [ ] **Step 1: Create ShaderCanvas.tsx**

```typescript
"use client";

import { useEffect, useRef, useState, useCallback } from "react";

interface ShaderCanvasProps {
  /** GLSL fragment shader source */
  fragmentShader: string;
  /** Optional uniform values (updated each frame) */
  uniforms?: Record<string, number | number[]>;
  /** Resolution scale factor (0.5 = half res for mobile) */
  resolutionScale?: number;
  /** CSS class for the container div */
  className?: string;
  /** Fallback gradient CSS (shown while loading or on WebGL failure) */
  fallbackGradient?: string;
}

const DEFAULT_VERTEX = `#version 300 es
precision mediump float;
in vec2 a_position;
void main() { gl_Position = vec4(a_position, 0.0, 1.0); }
`;

function createShader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.warn("Shader compile error:", gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

export default function ShaderCanvas({
  fragmentShader,
  uniforms = {},
  resolutionScale = 1,
  className = "",
  fallbackGradient = "linear-gradient(135deg, var(--void), var(--night))",
}: ShaderCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const startTimeRef = useRef(0);
  const programRef = useRef<WebGLProgram | null>(null);
  const glRef = useRef<WebGL2RenderingContext | null>(null);
  const [failed, setFailed] = useState(false);

  const initGL = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return false;

    const gl = canvas.getContext("webgl2", {
      alpha: true,
      antialias: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
    });
    if (!gl) { setFailed(true); return false; }

    const vert = createShader(gl, gl.VERTEX_SHADER, DEFAULT_VERTEX);
    const frag = createShader(gl, gl.FRAGMENT_SHADER, fragmentShader);
    if (!vert || !frag) { setFailed(true); return false; }

    const program = gl.createProgram();
    if (!program) { setFailed(true); return false; }
    gl.attachShader(program, vert);
    gl.attachShader(program, frag);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.warn("Program link error:", gl.getProgramInfoLog(program));
      setFailed(true);
      return false;
    }

    // Full-screen quad
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
    const posAttr = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(posAttr);
    gl.vertexAttribPointer(posAttr, 2, gl.FLOAT, false, 0, 0);

    gl.useProgram(program);
    glRef.current = gl;
    programRef.current = program;
    startTimeRef.current = performance.now();
    return true;
  }, [fragmentShader]);

  const resize = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    const gl = glRef.current;
    if (!canvas || !container || !gl) return;

    const dpr = Math.min(window.devicePixelRatio, 2) * resolutionScale;
    const w = container.clientWidth;
    const h = container.clientHeight;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
  }, [resolutionScale]);

  const render = useCallback(() => {
    const gl = glRef.current;
    const program = programRef.current;
    const canvas = canvasRef.current;
    if (!gl || !program || !canvas) return;

    const time = (performance.now() - startTimeRef.current) / 1000;
    const timeLoc = gl.getUniformLocation(program, "u_time");
    if (timeLoc) gl.uniform1f(timeLoc, time);

    const resLoc = gl.getUniformLocation(program, "u_resolution");
    if (resLoc) gl.uniform2f(resLoc, canvas.width, canvas.height);

    // Set custom uniforms
    for (const [name, value] of Object.entries(uniforms)) {
      const loc = gl.getUniformLocation(program, name);
      if (!loc) continue;
      if (Array.isArray(value)) {
        if (value.length === 2) gl.uniform2fv(loc, value);
        else if (value.length === 3) gl.uniform3fv(loc, value);
        else if (value.length === 4) gl.uniform4fv(loc, value);
      } else {
        gl.uniform1f(loc, value);
      }
    }

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    rafRef.current = requestAnimationFrame(render);
  }, [uniforms]);

  useEffect(() => {
    // Reduced motion check
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setFailed(true); // Show fallback gradient instead
      return;
    }

    const container = containerRef.current;
    if (!container) return;

    let initialized = false;

    // Lazy init via IntersectionObserver
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !initialized) {
          initialized = initGL();
          if (initialized) {
            resize();
            rafRef.current = requestAnimationFrame(render);
          }
          observer.disconnect();
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(container);

    // Pause when tab hidden
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
        cancelAnimationFrame(rafRef.current);
      } else if (initialized) {
        rafRef.current = requestAnimationFrame(render);
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    // Resize handler
    const handleResize = () => { if (initialized) resize(); };
    window.addEventListener("resize", handleResize);

    return () => {
      observer.disconnect();
      cancelAnimationFrame(rafRef.current);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("resize", handleResize);
      // Cleanup WebGL
      const gl = glRef.current;
      if (gl && programRef.current) {
        gl.deleteProgram(programRef.current);
      }
    };
  }, [initGL, resize, render]);

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden ${className}`}
      style={failed ? { background: fallbackGradient } : undefined}
    >
      {!failed && (
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full"
          style={{ display: "block" }}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Run type check**

```bash
cd web && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add web/components/ambient/ShaderCanvas.tsx
git commit -m "feat(animation): add ShaderCanvas component for WebGL background effects"
```

---

### Task 10: Warped fBM Noise Shader

**Files:**
- Create: `web/lib/shaders/warped-noise.ts` (GLSL source as a string)
- Create: `web/components/ambient/WarpedNoiseBackground.tsx` (wrapper component)

The bread-and-butter atmospheric background. Slow, breathing, organic color on black. Configurable accent color via uniform so it themes per portal.

- [ ] **Step 1: Create the GLSL shader source**

Create `web/lib/shaders/warped-noise.ts`:

```typescript
/**
 * Warped fBM noise — domain warping produces organic, marble-like patterns.
 * Based on Inigo Quilez's technique: f(p + fbm(p + fbm(p)))
 *
 * Uniforms:
 *   u_time       - elapsed seconds
 *   u_resolution - canvas size in pixels
 *   u_color1     - primary accent color (vec3, 0-1 range)
 *   u_color2     - secondary accent color (vec3, 0-1 range)
 *   u_speed      - animation speed multiplier (default 1.0)
 *   u_intensity  - brightness multiplier (default 1.0)
 */
export const WARPED_NOISE_FRAG = `#version 300 es
precision mediump float;
out vec4 fragColor;

uniform float u_time;
uniform vec2 u_resolution;
uniform vec3 u_color1;
uniform vec3 u_color2;
uniform float u_speed;
uniform float u_intensity;

// Simple hash-based noise
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);

  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));

  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  vec2 shift = vec2(100.0);
  mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p = rot * p * 2.0 + shift;
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  float t = u_time * u_speed * 0.15;

  // Domain warping: f(p + fbm(p + fbm(p)))
  vec2 p = uv * 3.0;
  float f1 = fbm(p + fbm(p + vec2(t * 0.7, t * 0.3)));
  float f2 = fbm(p + vec2(f1 * 1.5 + t * 0.2, f1 * 1.2 - t * 0.1));

  // Color mixing
  vec3 color = mix(u_color1, u_color2, f2);
  color *= f2 * f2 * u_intensity;

  // Vignette
  float vig = 1.0 - 0.5 * length(uv - 0.5);
  color *= vig;

  fragColor = vec4(color, 1.0);
}
`;
```

- [ ] **Step 2: Create the wrapper component**

Create `web/components/ambient/WarpedNoiseBackground.tsx`:

```typescript
"use client";

import { useMemo } from "react";
import ShaderCanvas from "./ShaderCanvas";
import { WARPED_NOISE_FRAG } from "@/lib/shaders/warped-noise";

interface WarpedNoiseBackgroundProps {
  /** Primary color as [r, g, b] in 0-1 range */
  color1?: [number, number, number];
  /** Secondary color as [r, g, b] in 0-1 range */
  color2?: [number, number, number];
  /** Speed multiplier (default 1.0) */
  speed?: number;
  /** Brightness multiplier (default 0.4 — subtle for backgrounds) */
  intensity?: number;
  /** Resolution scale (default 0.5 — half res for performance) */
  resolutionScale?: number;
  className?: string;
}

/** Convert hex color to [r, g, b] in 0-1 range */
function hexToVec3(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255,
  ];
}

// Default colors: coral and deep purple
const DEFAULT_COLOR1 = hexToVec3("#FF6B7A");
const DEFAULT_COLOR2 = hexToVec3("#4A1942");

export default function WarpedNoiseBackground({
  color1 = DEFAULT_COLOR1,
  color2 = DEFAULT_COLOR2,
  speed = 1.0,
  intensity = 0.4,
  resolutionScale = 0.5,
  className = "absolute inset-0 -z-10",
}: WarpedNoiseBackgroundProps) {
  const uniforms = useMemo(
    () => ({
      u_color1: color1,
      u_color2: color2,
      u_speed: speed,
      u_intensity: intensity,
    }),
    [color1, color2, speed, intensity],
  );

  return (
    <ShaderCanvas
      fragmentShader={WARPED_NOISE_FRAG}
      uniforms={uniforms}
      resolutionScale={resolutionScale}
      className={className}
      fallbackGradient={`radial-gradient(ellipse at 30% 40%, rgba(${Math.round(color1[0] * 255)},${Math.round(color1[1] * 255)},${Math.round(color1[2] * 255)},0.15), transparent 60%)`}
    />
  );
}

export { hexToVec3 };
```

- [ ] **Step 3: Run type check**

```bash
cd web && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add web/lib/shaders/warped-noise.ts web/components/ambient/WarpedNoiseBackground.tsx
git commit -m "feat(animation): add warped fBM noise shader background component"
```

---

### Task 11: Aurora CSS Background

**Files:**
- Create: `web/components/ambient/AuroraBackground.tsx`

Pure CSS atmospheric background — 2-3 large blurred pseudo-elements drifting slowly. No canvas, no WebGL. Different color palettes per portal via props. Good for lighter-weight pages where a full shader is overkill.

- [ ] **Step 1: Create AuroraBackground component**

Create `web/components/ambient/AuroraBackground.tsx`:

```typescript
"use client";

import { useId, useMemo } from "react";
import ScopedStyles from "@/components/ScopedStyles";

interface AuroraBackgroundProps {
  /** Primary blob color (CSS color value) */
  color1?: string;
  /** Secondary blob color (CSS color value) */
  color2?: string;
  /** Third blob color (optional) */
  color3?: string;
  /** Opacity of the blobs (default 0.12) */
  opacity?: number;
  /** Animation duration in seconds (default 20) */
  duration?: number;
  className?: string;
}

export default function AuroraBackground({
  color1 = "var(--coral)",
  color2 = "var(--neon-cyan)",
  color3,
  opacity = 0.12,
  duration = 20,
  className = "absolute inset-0 -z-10 overflow-hidden",
}: AuroraBackgroundProps) {
  const rawId = useId();
  const id = rawId.replace(/[^a-zA-Z0-9]/g, "");

  const css = useMemo(() => `
    .aurora-${id} .aurora-blob {
      position: absolute;
      width: 60vmax;
      height: 60vmax;
      border-radius: 50%;
      filter: blur(80px);
      opacity: ${opacity};
      will-change: transform;
    }

    .aurora-${id} .aurora-blob-1 {
      background: ${color1};
      top: -30%;
      left: -15%;
      animation: aurora-drift-${id}-1 ${duration}s ease-in-out infinite alternate;
    }

    .aurora-${id} .aurora-blob-2 {
      background: ${color2};
      bottom: -30%;
      right: -15%;
      animation: aurora-drift-${id}-2 ${duration}s ease-in-out infinite alternate;
      animation-delay: ${-duration / 2}s;
    }

    ${color3 ? `
    .aurora-${id} .aurora-blob-3 {
      background: ${color3};
      top: 20%;
      right: 30%;
      width: 40vmax;
      height: 40vmax;
      animation: aurora-drift-${id}-3 ${duration * 1.3}s ease-in-out infinite alternate;
      animation-delay: ${-duration / 3}s;
    }
    ` : ""}

    @keyframes aurora-drift-${id}-1 {
      from { transform: translate(0, 0) rotate(0deg); }
      to { transform: translate(5vw, 3vh) rotate(15deg); }
    }

    @keyframes aurora-drift-${id}-2 {
      from { transform: translate(0, 0) rotate(0deg); }
      to { transform: translate(-4vw, -2vh) rotate(-10deg); }
    }

    @keyframes aurora-drift-${id}-3 {
      from { transform: translate(0, 0) rotate(0deg) scale(1); }
      to { transform: translate(3vw, -4vh) rotate(20deg) scale(1.1); }
    }

    @media (prefers-reduced-motion: reduce) {
      .aurora-${id} .aurora-blob {
        animation: none !important;
      }
    }
  `, [id, color1, color2, color3, opacity, duration]);

  return (
    <div className={`aurora-${id} ${className}`} aria-hidden="true">
      <ScopedStyles css={css} />
      <div className="aurora-blob aurora-blob-1" />
      <div className="aurora-blob aurora-blob-2" />
      {color3 && <div className="aurora-blob aurora-blob-3" />}
    </div>
  );
}
```

- [ ] **Step 2: Run type check**

```bash
cd web && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add web/components/ambient/AuroraBackground.tsx
git commit -m "feat(animation): add Aurora CSS background component with portal theming"
```

---

## Integration Notes

### How to use these in pages

**Film grain** — already global after Task 2.

**View transitions** — already active after Task 3 for event cards. To add to other entity types (venues, festivals), follow the same pattern: add `view-transition-name` with a unique prefix + entity ID on both the card image and the detail hero.

**Scroll reveals** — add `className="scroll-reveal"` to any element you want to fade in on scroll. For staggered children, use `className="scroll-reveal-stagger"` on the parent. Falls back to JS `useScrollReveal` hook on unsupported browsers.

**Pointer glow** — add `usePointerGlow()` ref + `pointer-glow` class to any card.

**Gradient borders** — add `gradient-border` class to featured cards. Use `gradient-border-subtle` for less prominent cards.

**Mask fades** — add `mask-fade-x` to horizontal scroll containers, `mask-vignette` to hero images.

**ShaderCanvas** — use `<WarpedNoiseBackground>` for portal landing page backgrounds. Pass portal accent colors as `color1`/`color2` props.

**Aurora** — use `<AuroraBackground>` for lighter-weight atmospheric backgrounds on secondary pages.

### File map

```
web/
├── app/globals.css                        # Motion tokens, grain, scroll, entry/exit, glow, gradient border, mask
├── lib/
│   ├── hooks/
│   │   ├── useScrollReveal.ts             # Enhanced with CSS-native detection
│   │   └── usePointerGlow.ts              # NEW: pointer-following glow hook
│   └── shaders/
│       └── warped-noise.ts                # NEW: GLSL source for warped fBM
├── components/
│   ├── ambient/
│   │   ├── ShaderCanvas.tsx               # NEW: WebGL shader infrastructure
│   │   ├── WarpedNoiseBackground.tsx      # NEW: warped noise wrapper
│   │   ├── AuroraBackground.tsx           # NEW: CSS aurora background
│   │   └── NoiseTextureAmbient.tsx        # EXISTING: SVG noise (unchanged)
│   ├── event-card/
│   │   └── EventCardImage.tsx             # Modified: view-transition-name
│   └── detail/
│       └── DetailHero.tsx                 # Modified: view-transition-name
├── next.config.ts                         # Modified: viewTransition: true
└── public/textures/
    └── noise-256.png                      # NEW: film grain tile
```
