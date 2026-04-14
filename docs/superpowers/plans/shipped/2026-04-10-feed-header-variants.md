# Feed Section Header Variants Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `variant` prop to `FeedSectionHeader` that gives each feed section type its own typographic voice — from bold display headings (Lineup) to serif italic (Cinema) to condensed poster type (Horizon).

**Architecture:** Add a `variant` prop to the existing `FeedSectionHeader` component with 8 visual treatments. Each variant controls font family, size, weight, casing, accent elements, and layout. Consumers pass `variant="lineup"` etc. alongside existing props. The existing `priority` system remains as fallback for sections that don't specify a variant.

**Tech Stack:** CSS utilities in globals.css, Bricolage Grotesque (`--font-display`), Fraunces (`--font-serif`), Bebas Neue (`--font-masthead`), DM Sans (`--font-sans`), Space Mono (`--font-mono`)

**Design reference:** Pencil design system file `docs/design-system.pen`, frame "Feed Section Headers — Variants" (node ID: `Zw538`)

---

### Task 1: Add variant styles to globals.css

**Files:**
- Modify: `web/app/globals.css`

Add CSS classes for each header variant. Place these after the existing `.section-header-primary` block (around line 5350).

- [ ] **Step 1: Add header variant CSS**

```css
/* ── Feed Section Header Variants ───────────────────────────────── */

/* Variant: lineup — bold display, accent underline */
.section-header-lineup {
  font-family: var(--font-display), var(--font-sans), system-ui, sans-serif;
  font-size: 2rem;
  font-weight: 800;
  letter-spacing: -0.02em;
  color: var(--cream);
}

.section-header-lineup-underline {
  height: 3px;
  background: linear-gradient(to right, var(--section-accent, var(--coral)) 80px, var(--twilight) 80px);
}

/* Variant: cinema — serif italic, editorial */
.section-header-cinema {
  font-family: var(--font-serif), Georgia, serif;
  font-size: 1.625rem;
  font-weight: 500;
  font-style: italic;
  letter-spacing: 0;
  color: var(--section-accent, var(--vibe));
}

/* Variant: destinations — clean sans, discovery tone */
.section-header-destinations {
  font-family: var(--font-sans), system-ui, sans-serif;
  font-size: 1.125rem;
  font-weight: 600;
  letter-spacing: 0;
  color: var(--cream);
}

/* Variant: horizon — condensed poster, wide tracking */
.section-header-horizon {
  font-family: var(--font-masthead), sans-serif;
  font-size: 2.25rem;
  font-weight: 400;
  letter-spacing: 0.25em;
  text-transform: uppercase;
  color: var(--section-accent, var(--gold));
}

/* Variant: regulars — friendly lowercase */
.section-header-regulars {
  font-family: var(--font-sans), system-ui, sans-serif;
  font-size: 1.25rem;
  font-weight: 500;
  letter-spacing: 0.02em;
  color: var(--cream);
  text-transform: none;
}

/* Variant: meta — small caps mono, navigation-tier */
.section-header-meta {
  font-family: var(--font-mono), monospace;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--soft);
}

/* Variant: featured — display with badge prominence */
.section-header-featured {
  font-family: var(--font-display), var(--font-sans), system-ui, sans-serif;
  font-size: 1.5rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--cream);
}

/* Variant: gameday — condensed bold, sport energy */
.section-header-gameday {
  font-family: var(--font-masthead), sans-serif;
  font-size: 2rem;
  font-weight: 400;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--cream);
}
```

- [ ] **Step 2: Verify**

```bash
cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add web/app/globals.css
git commit -m "feat(design): add 8 feed section header variant CSS classes"
```

---

### Task 2: Add variant prop to FeedSectionHeader component

**Files:**
- Modify: `web/components/feed/FeedSectionHeader.tsx`

This is the core change. Add a `variant` prop that, when present, overrides the `priority`-based styling with the variant-specific layout.

- [ ] **Step 1: Read the file and understand the current structure**

Read `web/components/feed/FeedSectionHeader.tsx`. The component currently has:
- `priority: "primary" | "secondary" | "tertiary"` controlling styles
- `accentColor`, `icon`, `badge`, `seeAllHref` props
- A `getPriorityStyles()` function returning config per priority level

- [ ] **Step 2: Add the variant type and prop**

Add a `SectionVariant` type and add `variant` to the props interface:

```typescript
export type SectionVariant = 
  | "lineup" 
  | "cinema" 
  | "destinations" 
  | "horizon" 
  | "regulars" 
  | "meta" 
  | "featured" 
  | "gameday";
```

Add to `SectionHeaderProps`:
```typescript
/** Visual variant — overrides priority-based styling when set */
variant?: SectionVariant;
```

- [ ] **Step 3: Add variant rendering logic**

After the existing `getPriorityStyles()` function, add a `getVariantRender()` function. When `variant` is set, this function returns the complete JSX for the header, bypassing the priority-based rendering. When `variant` is not set, the existing priority rendering is used (backward compatible).

Each variant produces a different layout:

**lineup**: Large Bricolage title + accent underline stroke
```tsx
<div className={...}>
  <div className="flex items-center justify-between">
    <h3 className="section-header-lineup">{title}</h3>
    {seeAllHref && <Link ...>}
  </div>
  <div className="section-header-lineup-underline mt-2" />
</div>
```

**cinema**: Serif italic title, no icon box
```tsx
<div className={...}>
  <div className="flex items-center justify-between">
    <h3 className="section-header-cinema">{title}</h3>
    {seeAllHref && <Link ...>}
  </div>
</div>
```

**destinations**: Clean sans with icon inline
```tsx
<div className={...}>
  <div className="flex items-center gap-3">
    {displayIcon && <span className="text-[var(--section-accent)]">{displayIcon}</span>}
    <h3 className="section-header-destinations">{title}</h3>
    <div className="flex-1" />
    {seeAllHref && <Link ...>}
  </div>
</div>
```

**horizon**: Bebas Neue all-caps poster
```tsx
<div className={...}>
  <div className="flex items-center justify-between items-end">
    <h3 className="section-header-horizon">{title}</h3>
    {seeAllHref && <Link ...>}
  </div>
</div>
```

**regulars**: Friendly lowercase with icon
```tsx
<div className={...}>
  <div className="flex items-center gap-3">
    {displayIcon && <span className="text-[var(--section-accent)]">{displayIcon}</span>}
    <h3 className="section-header-regulars">{title}</h3>
    <div className="flex-1" />
    {seeAllHref && <Link ...>}
  </div>
</div>
```

**meta**: Small caps mono with top divider line
```tsx
<div className={...}>
  <div className="h-px bg-[var(--twilight)] mb-3" />
  <div className="flex items-center justify-between">
    <h3 className="section-header-meta">{title}</h3>
    {seeAllHref && <Link ...>}
  </div>
</div>
```

**featured**: Display type with prominent badge
```tsx
<div className={...}>
  <div className="flex items-center gap-3">
    {badge && <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-accent-20 border border-accent-40">
      {displayIcon && <span className="text-[var(--section-accent)]">{displayIcon}</span>}
      <span className="font-mono text-2xs font-bold uppercase tracking-[0.12em] text-accent">{badge}</span>
    </span>}
    <h3 className="section-header-featured">{title}</h3>
    <div className="flex-1" />
    {seeAllHref && <Link ...>}
  </div>
</div>
```

**gameday**: Condensed bold with accent bar
```tsx
<div className={...}>
  <div className="flex items-center justify-between items-end">
    <div className="flex items-center gap-2.5">
      <div className="w-1 h-7 rounded-full bg-[var(--section-accent)]" />
      <h3 className="section-header-gameday">{title}</h3>
    </div>
    {seeAllHref && <Link ...>}
  </div>
</div>
```

The "See all" link should use the same styling as existing (font-mono text-xs with accent color) but match the variant's accent.

The key implementation approach: at the top of the render function, check if `variant` is set. If so, render the variant-specific JSX and return early. If not, fall through to the existing priority-based rendering. This ensures 100% backward compatibility — no existing usage breaks.

- [ ] **Step 4: Verify**

```bash
cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add web/components/feed/FeedSectionHeader.tsx
git commit -m "feat(design): add variant prop to FeedSectionHeader with 8 visual treatments"
```

---

### Task 3: Apply variants to feed section consumers

**Files:**
- Modify: `web/components/feed/LineupSection.tsx` — add `variant="lineup"`
- Modify: `web/components/feed/sections/NowShowingSection.tsx` — add `variant="cinema"`
- Modify: `web/components/feed/sections/PlacesToGoSection.tsx` — add `variant="destinations"`
- Modify: `web/components/feed/sections/PlanningHorizonSection.tsx` — add `variant="horizon"`
- Modify: `web/components/feed/sections/HangFeedSection.tsx` — add `variant="regulars"`
- Modify: `web/components/feed/sections/PortalTeasersSection.tsx` — add `variant="meta"`
- Modify: `web/components/feed/FeaturedCarousel.tsx` — add `variant="featured"`
- Modify: `web/components/feed/sections/GameDaySection.tsx` — add `variant="gameday"`
- Modify: `web/components/feed/sections/SeeShowsSection.tsx` — add `variant="cinema"`

For each file, read it first, find the `<FeedSectionHeader>` usage, and add the `variant` prop. Keep all existing props (title, priority, accentColor, icon, seeAllHref, etc.) — the variant overrides the visual treatment but the other props still provide data.

Example transformation:
```tsx
// Before
<FeedSectionHeader
  title="The Lineup"
  priority="secondary"
  accentColor="var(--coral)"
  icon={<Lightning weight="duotone" className="w-5 h-5" />}
  seeAllHref={...}
/>

// After
<FeedSectionHeader
  title="The Lineup"
  priority="secondary"
  variant="lineup"
  accentColor="var(--coral)"
  icon={<Lightning weight="duotone" className="w-5 h-5" />}
  seeAllHref={...}
/>
```

**Section → Variant mapping:**

| File | Section | Variant |
|------|---------|---------|
| LineupSection.tsx | The Lineup | `lineup` |
| NowShowingSection.tsx | Now Showing | `cinema` |
| SeeShowsSection.tsx | See Shows | `cinema` |
| PlacesToGoSection.tsx | Places to Go / Worth Checking Out | `destinations` |
| PlanningHorizonSection.tsx | On the Horizon | `horizon` |
| HangFeedSection.tsx | Regular Hangs | `regulars` |
| PortalTeasersSection.tsx | Around the City | `meta` |
| FeaturedCarousel.tsx | Featured Events | `featured` |
| GameDaySection.tsx | Game Day | `gameday` |

Note: Some files may have multiple `<FeedSectionHeader>` usages (e.g., GameDaySection has 2). Apply the variant to the primary section header only — secondary/sub-headers within the same section should keep their existing priority-based styling.

- [ ] **Step 1: Apply variants to all 9 files**

Read each file, find `<FeedSectionHeader`, add the `variant` prop.

- [ ] **Step 2: Verify**

```bash
cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add web/components/feed/LineupSection.tsx web/components/feed/sections/NowShowingSection.tsx web/components/feed/sections/PlacesToGoSection.tsx web/components/feed/sections/PlanningHorizonSection.tsx web/components/feed/sections/HangFeedSection.tsx web/components/feed/sections/PortalTeasersSection.tsx web/components/feed/FeaturedCarousel.tsx web/components/feed/sections/GameDaySection.tsx web/components/feed/sections/SeeShowsSection.tsx
git commit -m "feat(design): apply header variants to all feed sections"
```
