# Animation System Remediation & Polish

**Date:** 2026-04-10
**Status:** Approved (revised after expert review)

## Goal

Fix issues identified in the design review of the animation/typography overhaul, then apply unused animation utilities to product surfaces for polish.

## Context

The animation system (motion tokens, view transitions, pointer glow, gradient borders, film grain, ShaderCanvas, aurora) and typography swap (Bricolage Grotesque, DM Sans, Fraunces, Space Mono) were shipped 2026-04-09. A product design review identified critical issues, important fixes, and polish opportunities. An architecture review and design accuracy audit further refined the spec.

---

## Critical Fixes

### C1. Remove mask-vignette from DetailHero

**File:** `web/components/detail/DetailHero.tsx`

Remove `mask-vignette` class from the image mode outer container div (line ~152). The radial gradient mask clips the hero image into an oval shape, which looks like broken CSS rather than cinematic production. The existing gradient overlay inside the card already handles the transition from image to content below. A clean edge-to-edge image is more confident.

### C2. Fix gradient-border on HeroCard

**File:** `web/components/feed/HeroCard.tsx`

Replace `gradient-border` with `gradient-border-subtle` on the outer `<Link>` element (line ~113). The animated spinning border on hover is too aggressive for the highest-prominence card in the feed — two simultaneous motion effects (hover-lift + border spin) on one interaction is too much. The subtle variant provides a static, barely-visible coral-to-gold border at rest that signals "featured" without moving.

### C3. Delete duplicate grain system + dead suppression rules

**File:** `web/app/globals.css`

Delete the `body::after` SVG grain block (~lines 1417-1426). This is the old grain implementation using inline SVG `feTurbulence` at `opacity: var(--grain-opacity, 0.01)` — effectively invisible. The PNG-based `.grain-overlay` in the portal layout is the correct system.

Also delete the suppression rules below it (~lines 1429-1455) that target `body::after` for festival-detail, clean-detail, and hotel verticals — these become dead code after the `body::after` block is removed. Review each rule to confirm it only targets the old grain system before deleting.

---

## Important Fixes

### I1. Wire usePointerGlow to SeriesCard + FestivalCard

**Files:**
- `web/components/SeriesCard.tsx`
- `web/components/FestivalCard.tsx`

Both cards have the `.pointer-glow` CSS class but no `usePointerGlow` hook, so the glow defaults to the center of the card instead of tracking the cursor.

- **SeriesCard**: outer element is a `<div>` — use `usePointerGlow<HTMLDivElement>()`, attach ref to the comfortable-density outer div
- **FestivalCard**: the comfortable-density branch wraps content in a `<>` fragment with `<ScopedStyles>` before the `<Link>`. Attach the ref to the `<Link>` element directly (inside the fragment), NOT the fragment itself. Use `usePointerGlow<HTMLAnchorElement>()`.

Note: compact density branches intentionally excluded — they don't have the `pointer-glow` class.

### I2. Apply Bricolage Grotesque to card titles

**Files:**
- `web/components/EventCard.tsx` — apply `.font-display` to desktop `<span>` title (line ~528) and compact `<span>` title (line ~326). The mobile `<h3>` (line ~512) already gets Bricolage from the global `h1,h2,h3` rule — don't add redundant class.
- `web/components/SeriesCard.tsx` — apply `.font-display` to desktop `<span>` title (line ~373). Mobile `<h3>` already covered.
- `web/components/FestivalCard.tsx` — apply `.font-display` to desktop `<span>` title (line ~238). Mobile `<h3>` already covered.
- `web/components/feed/StandardRow.tsx` — apply `.font-display` to `<p>` title (line ~103).

Use the **existing** `.font-display` class from globals.css (line ~1504), which already sets `font-family: var(--font-display), system-ui, sans-serif; font-weight: 600; letter-spacing: -0.02em`. Do NOT create a new `.card-title-display` class — `.font-display` already does this.

---

## Polish

### P1. Apply animate-enter to ConfirmDialog + CreateCollectionModal

**Scope narrowed after review.** Only migrate components that use conditional rendering (mount/unmount). Components with class-based visibility toggles (Toast, SaveToListButton, ActiveFiltersRow) stay on the existing `animate-in` system.

**Files:**
- `web/components/ConfirmDialog.tsx` — replace `animate-in scale-in` on the panel div (line ~86) with `animate-enter-scale`. Also replace `animate-in fade-in` on the backdrop div (line ~77) with a simple opacity transition or keep as-is (backdrop animation is less critical).
- `web/components/CreateCollectionModal.tsx` — replace `animate-in fade-in scale-in` on the panel div (line ~151) with `animate-enter-scale`.

Keep the `animate-in` / `scale-in` keyframe system intact — it's still used by 10+ other components.

**Browser support note:** `@starting-style` requires Chrome 117+, Safari 17.5+, Firefox 129+. Older browsers get no entrance animation (graceful degradation — modal just appears instantly).

### P2. Button press feedback

**Files:**
- `web/components/RSVPButton.tsx`
- `web/components/filters/FilterChip.tsx`
- `web/components/ui/Button.tsx`

Add `active:scale-[0.96] transition-transform` to interactive elements. Instant scale-down on press, smooth release — the correct tactile feel. CSS-only.

### P3. Remove global CursorGlow + dead code cleanup

**Files:**
- Delete: `web/components/CursorGlow.tsx`
- Modify: `web/components/ClientEffects.tsx` — remove CursorGlow import and rendering
- Clean up dead CSS suppression rules referencing `.cursor-glow` in:
  - `web/app/globals.css` (~lines 1436, 1439)
  - `web/app/[portal]/_surfaces/feed/AmbientSuppression.tsx` (~line 8)
  - `web/app/[portal]/map/page.tsx` (~line 33)
  - `web/app/[portal]/_components/dog/DogDeepPageShell.tsx` (~line 34)
- Delete: `web/lib/visual-settings-context.tsx` — exports `cursorGlowEnabled`/`setCursorGlowEnabled` but the provider is never mounted anywhere. `CursorGlow` and `RainEffect` both read localStorage directly. Entire file is dead code.

### P4. Fix AuroraBackground blob sizing

**File:** `web/components/ambient/AuroraBackground.tsx`

- Reduce default blob size from 60vmax to 40vmax
- Increase drift range: `translate(5vw, 3vh)` → `translate(15vw, 10vh)` on blob-1, `translate(-4vw, -2vh)` → `translate(-12vw, -8vh)` on blob-2, similar scale-up on blob-3
- This makes the gradient edge visible within the viewport and the motion perceptible

### P5. Tab switching animation in LineupSection

**File:** `web/components/feed/lineup/LineupSection.tsx`

Use the View Transitions API for tab cross-fades, NOT `animate-enter` (which only fires on mount, not re-renders). In the `handleTabClick` callback, wrap the state update with `document.startViewTransition()`:

```typescript
const handleTabClick = (tabId: string) => {
  if ("startViewTransition" in document) {
    document.startViewTransition(() => {
      setActiveTabId(tabId);
    });
  } else {
    setActiveTabId(tabId);
  }
};
```

This gives a browser-native crossfade on Chrome/Edge/Safari with zero DOM restructuring. Unsupported browsers get the current instant swap (fine).

---

## Dropped from Spec

- **I3 (viewTransitionName guard)**: Dropped. Setting `viewTransitionName` on unsupported browsers is harmless — unknown CSS properties are silently ignored per spec. Not worth the complexity.
- **DetailStickyBar animate-enter**: Dropped. The bar already has scroll-driven CSS transitions (`translate-y` + `opacity` toggle). `animate-enter` with `@starting-style` conflicts with this pattern.
- **MobileFilterSheet animate-enter-right**: Dropped. The sheet already has a working slide animation (`transition-transform duration-300`).

## Out of Scope

- Migrating all 10+ `animate-in` usages to `@starting-style` (incremental, do later)
- Migrating all `ScrollReveal` component usage to CSS `scroll-reveal` classes
- Portal-specific typography tuning
- Motion library evaluation
