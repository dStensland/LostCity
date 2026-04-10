# Animation System Remediation & Polish

**Date:** 2026-04-10
**Status:** Approved

## Goal

Fix issues identified in the design review of the animation/typography overhaul, then apply unused animation utilities to product surfaces for polish.

## Context

The animation system (motion tokens, view transitions, pointer glow, gradient borders, film grain, ShaderCanvas, aurora) and typography swap (Bricolage Grotesque, DM Sans, Fraunces, Space Mono) were shipped 2026-04-09. A product design review identified critical issues, important fixes, and polish opportunities.

---

## Critical Fixes

### C1. Remove mask-vignette from DetailHero

**File:** `web/components/detail/DetailHero.tsx`

Remove `mask-vignette` class from the image mode outer container div. The radial gradient mask clips the hero image into an oval shape, which looks like broken CSS rather than cinematic production. The existing gradient overlay inside the card already handles the transition from image to content below. A clean edge-to-edge image is more confident.

### C2. Fix gradient-border on HeroCard

**File:** `web/components/feed/HeroCard.tsx`

Replace `gradient-border` with `gradient-border-subtle` on the outer `<Link>` element. The animated spinning border on hover is too aggressive for the highest-prominence card in the feed — two simultaneous motion effects (hover-lift + border spin) on one interaction is too much. The subtle variant provides a static, barely-visible coral-to-gold border at rest that signals "featured" without moving.

### C3. Delete duplicate grain system

**File:** `web/app/globals.css` (~line 1417-1426)

Delete the `body::after` SVG grain block. This is the old grain implementation using inline SVG `feTurbulence` at `opacity: var(--grain-opacity, 0.01)` — effectively invisible (1% opacity fallback). The PNG-based `.grain-overlay` div in the portal layout is the correct system. Running both creates two independent z-index layers (z-index 50 vs 9999) for no visual benefit. Remove the old one entirely.

---

## Important Fixes

### I1. Wire usePointerGlow to SeriesCard + FestivalCard

**Files:**
- `web/components/SeriesCard.tsx`
- `web/components/FestivalCard.tsx`

Both cards have the `.pointer-glow` CSS class but no `usePointerGlow` hook, so the glow defaults to the center of the card instead of tracking the cursor. Add the hook import, call it, and attach the returned ref to the outer card element.

- SeriesCard: outer element is a `<div>` — use `usePointerGlow<HTMLDivElement>()`
- FestivalCard: outer element is a `<Link>` — use `usePointerGlow<HTMLAnchorElement>()`

### I2. Apply Bricolage Grotesque to card titles

**Files:**
- `web/app/globals.css` (add utility class)
- `web/components/EventCard.tsx` (apply class to title)
- `web/components/SeriesCard.tsx` (apply class to title)
- `web/components/FestivalCard.tsx` (apply class to title)
- `web/components/feed/StandardRow.tsx` (apply class to title, if it exists)

The h1/h2/h3 global selector applies Bricolage Grotesque, but most card titles use `<span>` or `<p>` elements. Add a utility class in globals.css:

```css
.card-title-display {
  font-family: var(--font-display), var(--font-sans), system-ui, sans-serif;
}
```

Apply this class to the title elements in EventCard, SeriesCard, FestivalCard, and StandardRow. This makes the typography investment visible on the main feed surface.

### I3. Guard viewTransitionName for unsupported browsers

**Files:**
- `web/components/event-card/EventCardImage.tsx`
- `web/components/detail/DetailHero.tsx`
- `web/components/detail/DetailHeroImage.tsx`
- `web/components/SeriesCard.tsx`
- `web/components/FestivalCard.tsx`

The `viewTransitionName` style is currently set unconditionally. On browsers without View Transitions API support (Firefox, older Safari), this could cause unexpected behavior. Guard the assignment with a runtime check:

```typescript
const supportsVT = typeof document !== "undefined" && "startViewTransition" in document;
```

Only set `viewTransitionName` when `supportsVT` is true. This can be a shared constant exported from a utility module (e.g., `web/lib/view-transition-utils.ts`) to avoid repeating the check.

---

## Polish

### P1. Apply animate-enter utilities to modals/overlays

**Files:**
- `web/components/ConfirmDialog.tsx` — replace `animate-in scale-in` with `animate-enter-scale`
- `web/components/CreateCollectionModal.tsx` — replace `animate-in fade-in scale-in` with `animate-enter-scale`
- `web/components/detail/DetailStickyBar.tsx` — add `animate-enter` for the floating CTA bar appearance
- `web/components/filters/MobileFilterSheet.tsx` — add `animate-enter-right` for the side drawer entrance (if applicable to its pattern)

These replacements use the new `@starting-style` CSS entry/exit utilities which provide native CSS transitions including exit animations, replacing the JS-dependent `animate-in` approach.

### P2. Button press feedback

**Files:**
- `web/components/RSVPButton.tsx`
- `web/components/filters/FilterChip.tsx`
- `web/components/ui/Button.tsx`

Add `active:scale-[0.96] transition-transform` to interactive elements. This provides immediate tactile feedback on tap/click. CSS-only, no JS needed. On mobile this is the difference between "dead tap" and "something happened."

### P3. Remove global CursorGlow component

**Files:**
- Delete: `web/components/CursorGlow.tsx`
- Modify: `web/components/ClientEffects.tsx` — remove CursorGlow import and rendering

The global CursorGlow tracks the cursor across the entire viewport with an always-on RAF loop and a 400px radial gradient at z-index 9998. This is redundant with the card-level `pointer-glow` which is scoped to individual elements and only active on hover. Removing CursorGlow eliminates an always-on animation loop and one compositing layer.

### P4. Fix AuroraBackground blob sizing

**File:** `web/components/ambient/AuroraBackground.tsx`

Current: 60vmax blobs with 5vw/3vh drift — the blobs are larger than the viewport and the drift is imperceptible. Fix:
- Reduce default blob size from 60vmax to 40vmax
- Increase drift range from `translate(5vw, 3vh)` to `translate(15vw, 10vh)`
- This makes the gradient edge visible within the viewport and the motion perceptible

### P5. Tab switching animation in LineupSection

**File:** `web/components/feed/lineup/LineupSection.tsx` (or wherever tab content renders)

When switching between feed tabs (Today/This Week/Weekend/etc.), the content currently hard-swaps. Add a cross-fade by applying the `animate-enter` class to the tab content container. Each tab switch triggers a re-mount with the entry animation, providing a smooth 250ms fade+slide transition.

---

## Out of Scope

- Migrating all existing `ScrollReveal` component usage to CSS `scroll-reveal` classes (tracked separately)
- Adding view transitions to venue/place detail pages (no generic VenueCard exists yet)
- Portal-specific typography tuning (per-portal font-weight adjustments for dark theme)
- Motion library (Framer Motion / Motion) evaluation — CSS-only approach is sufficient for current needs
