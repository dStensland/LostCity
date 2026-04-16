# Detail Page Elevation: Event Detail

**Date:** 2026-04-16
**Scope:** Event detail pages only (other entity types extend later)
**Approach:** Shell Replacement — swap layout chrome, keep section modules intact

## Problem

The current two-column detail page (340px sticky sidebar + fluid content) is functional but reads as CMS-grade. The hero is constrained to sidebar width, the CTA is buried in an action zone, and the overall experience doesn't match the cinematic minimalism design language. The goal is a tier shift — from information display to premium experience.

## Design Summary

- Full-width adaptive hero (3 tiers based on image quality, determined server-side)
- Identity moves from sidebar to content column with elevated typography
- Sticky action rail (300px, desktop) replaces the 340px sidebar
- Mobile: adaptive hero → identity → sections → sticky bottom bar (current pattern)
- Back button floats over hero on desktop canonical pages

## Server-Side Hero Tier Detection

Hero tier is determined at the data layer, not client-side. This eliminates layout shifts, CLS problems, and SSR mismatches.

### Data Changes

Add `image_width` and `image_height` to event image metadata (populated at crawl time via image intrinsics, or backfilled for existing records).

### Tier Rules

Computed in `mapEventServerDataToViewData`, returned as `heroTier` on the response:

| Tier | Key | Condition |
|------|-----|-----------|
| Expanded | `expanded` | `image_url` present AND `image_width >= 1200` AND `image_width / image_height >= 1.3` (landscape) |
| Compact | `compact` | `image_url` present but doesn't meet expanded criteria |
| Typographic | `typographic` | No `image_url` |

Gallery override: if `galleryUrls` has 2+ images, auto-promote to `expanded` regardless of primary image dimensions.

The `heroTier` field is added to `EventApiResponse`. `HeroConfig` gains a `tier: 'expanded' | 'compact' | 'typographic'` field that replaces the current `fallbackMode`.

## Adaptive Hero

### Tier 1: Expanded (~50-60vh)

For events with high-quality landscape images.

- Full-viewport-width image with `object-cover`, height ~50-60vh
- Bottom gradient fade: transparent → `var(--void)` over last 30% of hero height
- Back button: absolute positioned, top-left, `backdrop-blur-sm` circle, overlays the image
- Gallery navigation (if `galleryUrls.length > 1`): prev/next arrows (Phosphor `ArrowLeft`/`ArrowRight`, bold, 16px, pill buttons), 8px dot indicators with 3px gap
- `motion-fade-in` entrance animation
- `prefers-reduced-motion`: instant display, no fade

### Tier 2: Compact (~180-220px)

For events with poster-quality or smaller images.

- Full-width gradient band using portal accent color or extracted image dominant color
- Bottom gradient fade to `var(--void)`
- Back button: same overlay treatment as Tier 1
- No poster in the hero itself — poster thumbnail lives in the action rail
- `motion-fade-in` entrance

### Tier 3: Typographic (~200-240px)

For events with no image. The hero IS the identity — they merge.

- Full-width atmospheric gradient band using category accent at 0.15-0.25 opacity (enough to feel the color, not enough to overpower)
- Category icon: 40×40px, rounded-10px, category accent at 0.12 opacity background with 24px blur glow
- Event title: `text-3xl font-bold` rendered inside the gradient band
- Mono metadata line: `DATE · VENUE` below title, inside the band, `text-xs font-mono uppercase tracking-[0.14em]`
- Tags/genres below metadata if present
- Content column starts directly after the band — no separate identity section (it's embedded in the hero)
- `motion-fade-in` on band, `motion-fade-up` on title at 100ms delay

### All Tiers

- Full viewport width (uses negative margin or break-out utility if parent constrains)
- Smooth gradient transition to content area below
- `prefers-reduced-motion` compliance
- No 52px chrome bar above the hero on desktop canonical pages

## Desktop Layout: ElevatedShell

Replaces `DetailShell` for events. Uses named slots for clarity.

```
┌─────────────────────────────────────────────────┐
│                 HERO (full width)                │
│         (adaptive tier, back button overlay)     │
├──────────────────────────────┬──────────────────┤
│                              │                  │
│     IDENTITY                 │   ACTION RAIL    │
│     (title, metadata, tags)  │   (sticky)       │
│                              │   300px          │
│     ─────────────────────    │                  │
│                              │   • poster*      │
│     SECTION: About           │   • CTA          │
│                              │   • secondaries  │
│     ─────────────────────    │   • quick facts  │
│                              │   • social proof │
│     SECTION: Lineup          │                  │
│                              │                  │
│     ─────────────────────    │                  │
│                              │                  │
│     SECTION: Getting There   │                  │
│                              │                  │
│     ...more sections         │                  │
│                              │                  │
└──────────────────────────────┴──────────────────┘

* poster only on Tier 2
```

### Named Slots

```typescript
interface ElevatedShellProps {
  hero: ReactNode;
  identity: ReactNode;       // null for Tier 3 (identity embedded in hero)
  rail: ReactNode;           // null on mobile
  content: ReactNode;        // section modules
  bottomBar?: ReactNode;     // mobile sticky bar
}
```

### Responsive Behavior

- **Desktop (≥1024px):** Two-column below hero — fluid content (left) + 300px sticky rail (right)
- **Mobile (<1024px):** Single column — hero → identity → content → sticky bottom bar. Rail doesn't render.
- **Tablet consideration:** At 768-1024px, rail collapses to bottom bar (same as mobile). No dual action surfaces.

## Sticky Action Rail

Desktop-only, 300px wide, sticky at `top: 24px`. Max height `calc(100dvh - 48px)` with `overflow-y: auto scrollbar-hide`.

### Rail Adapts Per Hero Tier

| Tier | Rail Top Element |
|------|-----------------|
| Expanded (Tier 1) | Starts at CTA — hero already showed image full-bleed |
| Compact (Tier 2) | Poster thumbnail (120px wide, 3:4, rounded-12px, `drop-shadow(0 8px 24px rgba(0,0,0,0.6))`) → CTA |
| Typographic (Tier 3) | Starts at CTA — no image exists |

### Rail Content (top to bottom)

1. **Poster thumbnail** (Tier 2 only)
   - 120px wide, aspect 3:4, rounded-12px
   - `drop-shadow(0 8px 24px rgba(0,0,0,0.6))` — free-floating shadow, not card shadow token
   - 1px border at `var(--twilight)` opacity
   - Omitted when no image or when hero already showed it full-bleed

2. **Primary CTA** (full rail width, h-[48px], rounded-full)
   - Single-pulse glow animation on initial render: keyframe `0 → 0.15 → 0` on box-shadow, 1 iteration
   - `motion-hover-glow` + `motion-press` on interaction
   - Content varies by event type (see table below)

3. **Secondary actions** (icon row, centered, gap-2)
   - Save, Share, Add to Calendar, Invite
   - `w-10 h-10 rounded-xl border border-[var(--twilight)]`
   - `motion-hover-lift` on each
   - Always present regardless of CTA

4. **Quick facts card** (surface, rounded-12px, `bg-[var(--night)]`, 1px border `var(--twilight)`)
   - Each line: appropriate icon + text, `text-xs`, `var(--muted)`
   - Date + time (formatted)
   - Venue name (linked to venue detail page)
   - Price range (if available)
   - Age/door policy (if available)
   - Divider between actions and quick facts: `border-t border-[var(--twilight)]/40`

5. **Social proof** (if friends data exists)
   - Stacked friend avatars (20px, -6px overlap) + "N friends going" text
   - Divider above: `border-t border-[var(--twilight)]/40`
   - When social proof renders in rail, remove `socialProof` from content column manifest to avoid duplication

### CTA Variants by Event Type

| Event Type | CTA Label | Variant | Color |
|------------|-----------|---------|-------|
| Ticketed (`ticket_url`) | "Get Tickets" | filled | `var(--coral)` |
| Free + RSVP | "Free · RSVP" | filled | `var(--neon-green)` |
| Free, no RSVP | "Free Entry" | outlined | border `var(--twilight)` |
| Source URL only | "Learn More" | outlined | border `var(--twilight)` |
| No URL | No CTA rendered | — | — |

Secondary actions (Save, Share, Calendar, Invite) always render regardless of CTA presence.

## Identity Zone

Moves from sidebar to content column. Gets elevated typography and breathing room.

### Tier 1 & 2: Identity Below Hero

- Renders as first element in content column, above sections
- Event title: `text-2xl lg:text-3xl font-bold text-[var(--cream)]`
- Metadata line: `text-xs font-mono uppercase tracking-[0.14em] text-[var(--muted)]` — "APR 18 · TERMINAL WEST"
- Tags/genres below metadata if present
- `motion-fade-up` at 100ms delay
- Padding: `px-4 lg:px-8 pt-6 pb-4`
- No icons on the metadata line (icons live in the rail's quick facts card — two hierarchy levels of the same info)

### Tier 3: Identity Embedded in Hero

- Title, metadata, tags all render inside the gradient band (see Tier 3 hero spec above)
- No separate identity element in the content column
- Content column starts directly with sections

## Back Button

| Context | Treatment |
|---------|-----------|
| Desktop canonical (Tier 1/2) | Floating overlay on hero: absolute, top-16px left-16px, backdrop-blur-sm circle, white icon at 0.7 opacity |
| Desktop canonical (Tier 3) | Same overlay treatment on gradient band |
| Mobile (all tiers) | Floating overlay on hero/band |
| Overlay/modal context | Back button in top bar row (current `NeonBackButton` behavior, acts as close) |

No 52px chrome bar above the hero on desktop canonical pages. The hero starts at the viewport edge.

## Architecture Changes

### DetailLayout Orchestrator

Add `shellVariant: 'sidebar' | 'elevated'` prop. When `elevated`:

- Hero renders full-width above both columns (not in sidebar)
- Identity renders as first element in content column (or embedded in hero for Tier 3)
- Actions route to `ActionRail` component (rail variant) instead of sidebar `DetailActions`
- `socialProof` section removed from content manifest when social proof data exists (promoted to rail)
- All other section modules render unchanged in content column

### Component Changes

| Component | Change |
|-----------|--------|
| `DetailShell` | Kept for non-event entity types. No changes. |
| `ElevatedShell` | **New.** Named slots: hero, identity, rail, content, bottomBar. |
| `DetailHero` (core) | Gains `tier` prop. Renders expanded/compact/typographic. **Consolidate outer `DetailHero.tsx` into this file first.** |
| `DetailIdentity` | Gains elevated typography variant. Tier 3: not rendered (identity in hero). |
| `DetailActions` | Gains `variant: 'sidebar' | 'rail'`. Rail variant: vertical stack, full-width CTA, adapted per tier. Same `ActionConfig` data contract. |
| `DetailLayout` | Gains `shellVariant` prop. Routes configs to correct shell. |
| `EventDetailView` | Passes `shellVariant: 'elevated'` and `heroTier` from server data. |
| `SectionWrapper` | No changes. |
| Section modules | No changes. |
| Manifests | No changes (social proof removal is handled dynamically by the orchestrator). |

### New Components

| Component | Purpose |
|-----------|---------|
| `ElevatedShell` | Layout container with named slots, responsive breakpoint handling |
| `QuickFactsCard` | Rail sub-component: date, venue link, price, age policy |
| `HeroOverlayNav` | Back button overlay for hero (replaces top bar on canonical desktop) |

### Prerequisite: Consolidate DetailHero Files

Two `DetailHero` components exist:
- `/web/components/detail/DetailHero.tsx` (243 lines, older, with title overlay and view transitions)
- `/web/components/detail/core/DetailHero.tsx` (138 lines, current, HeroConfig-based)

Consolidate into the core version before adding adaptive tier logic. The outer version appears to be legacy from pre-rearchitecture.

## Motion

### Page Load Orchestration

1. Hero: `motion-fade-in` (instant for Tier 3 gradient)
2. Identity: `motion-fade-up` at 100ms delay (Tier 1/2 only — Tier 3 identity is inside hero)
3. Rail: `motion-fade-in` at 200ms delay
4. CTA: single-pulse glow keyframe at 400ms delay (1 iteration, subtle)
5. First section: `motion-fade-up` at 200ms (existing stagger behavior)
6. Below-fold sections: scroll reveal via `useScrollReveal` (existing behavior)

### Interactions

- CTA: `motion-hover-glow` + `motion-press` (existing)
- Secondary action icons: `motion-hover-lift` (existing)
- Quick facts venue link: subtle underline on hover
- Gallery arrows (Tier 1): fade in on hero hover, fade out on leave
- All: `prefers-reduced-motion` compliance (existing infrastructure)

## Mobile Behavior

- Adaptive hero renders full-width at top (same 3 tiers)
- Identity below hero (or embedded for Tier 3)
- Sections in single column
- Rail does NOT render
- Sticky bottom bar with CTA + share button (existing `DetailStickyBar` pattern)
- Quick facts info folds into identity zone or Getting There section
- Social proof renders as its own section in content column (not promoted to rail since rail doesn't exist)

## What Stays Unchanged

- All 20 section modules (about, lineup, showSignals, connections, socialProof, gettingThere, producer, nearby, etc.)
- Event manifest and section ordering
- Trait functions for section inclusion
- Data hooks (`useDetailData`)
- `SectionWrapper` and `SectionHeader` chrome
- `ScopedStyles` accent color plumbing
- Loading/error states
- All non-event entity detail pages (places, series, festivals, orgs continue using current `DetailShell`)

## Scope Boundaries

**In scope:**
- ElevatedShell component
- Adaptive hero (3 tiers) with server-side detection
- DetailHero consolidation
- DetailActions rail variant
- QuickFactsCard component
- HeroOverlayNav component
- Identity typography elevation
- CTA pulse animation
- `image_width`/`image_height` data migration
- Gallery arrow polish (Phosphor icons, 8px dots)

**Out of scope:**
- New section modules
- Other entity type elevation (places, series, festivals, orgs)
- Crawler image quality improvements (separate initiative)
- Search integration changes
- Feed card changes
