# Figma MCP Design System Rules — Lost City

These rules guide AI coding agents when implementing Figma designs into the Lost City codebase.

## Figma Source of Truth

- **Atlanta Portal Figma file**: https://www.figma.com/design/Te8s9LaC1o9KRQQyHzgyC7
- Pages captured: Feed, Events view, Places view, Venue Detail (High Museum), Neighborhoods

## Required Figma Implementation Flow

1. Run `get_design_context` for the target node(s) to get structured code + hints
2. Run `get_screenshot` for visual reference of the design
3. If Code Connect mappings exist, use the mapped codebase component directly
4. Translate the output (React + Tailwind) into this project's conventions below
5. IMPORTANT: Validate the final UI against the Figma screenshot for 1:1 visual parity
6. IMPORTANT: Browser-test every implementation at both desktop and 375px mobile

## Component Organization

- **Shared UI components**: `web/components/ui/` — Badge, Button, CountBadge, Dot, DialogFooter, ScrollableRow
- **Detail page components**: `web/components/detail/` — DetailHero, DescriptionTeaser, SocialProofStrip, GenreChip, InfoCard, MetadataGrid, SectionHeader, RelatedSection, DetailStickyBar
- **Feed components**: `web/components/feed/` — FeedSectionHeader, CompactEventRow, feed section components
- **Feed tier components**: `web/components/feed/` — HeroCard, StandardRow, TieredEventList, EditorialCallout, PressQuote, SocialProofRow
- **Filter components**: `web/components/filters/` — FilterChip, SimpleFilterBar, MobileFilterSheet
- **Card components**: `web/components/cards/` — EventCard, SeriesCard, FestivalCard, VenueCard
- **Headers**: `web/components/headers/` — PlatformHeader, MinimalHeader
- **Layout**: `web/components/` — SmartImage (ALWAYS use instead of next/image for dynamic URLs)

IMPORTANT: Always check existing components before creating new ones. Reuse `Badge`, `Dot`, `CountBadge`, `FilterChip`, `FeedSectionHeader`, `DialogFooter` — never rebuild these inline.

## Design Tokens (CSS Variables)

Tokens are defined in `web/app/globals.css` via `@theme inline`. Portal-specific overrides come from `PortalTheme.tsx`.

### Surface Tokens (backgrounds/borders ONLY — never for text)

| Token | Value | Use |
|-------|-------|-----|
| `--void` | #09090B | Page background |
| `--night` | #0F0F14 | Card backgrounds |
| `--dusk` | #18181F | Modal/elevated surfaces |
| `--twilight` | #252530 | Borders, dividers |

### Text Tokens (the ONLY text colors on dark backgrounds)

| Token | Value | Role |
|-------|-------|------|
| `--cream` | #F5F5F3 | Primary — headings, titles |
| `--soft` | #A1A1AA | Secondary — labels, metadata |
| `--muted` | #8B8B94 | Tertiary — timestamps (minimum readable) |

### Accent Tokens

| Token | Value | Use |
|-------|-------|-----|
| `--coral` | #FF6B7A | Brand primary / CTA |
| `--gold` | #FFD93D | Featured / date filters |
| `--neon-green` | #00D9A0 | Success / free indicator |
| `--neon-cyan` | #00D4E8 | Secondary accent |
| `--neon-magenta` | #E855A0 | Nightlife |
| `--vibe` | #A78BFA | Vibe/mood accent |

IMPORTANT: Never hardcode hex colors. Always use `var(--token-name)`.
IMPORTANT: Never use surface tokens (--void, --night, --dusk, --twilight) as text colors — they're invisible on dark backgrounds.
Exception: `text-[var(--void)]` is correct on bright backgrounds (e.g., coral CTA buttons).

## Typography Scale

Tailwind v4 with custom overrides in `globals.css`. Use standard Tailwind classes — they produce the correct pixels:

| Class | Size | Use |
|-------|------|-----|
| `text-2xs` | 10px | Count badges inside chips only (custom `@utility`) |
| `text-xs` | 11px | Section headers (mono uppercase), date/time metadata |
| `text-sm` | 13px | Secondary content, descriptions, metadata |
| `text-base` | 15px | Card titles, body text |
| `text-lg` | 18px | Prominent card titles |
| `text-xl` | 20px | Secondary section headers |
| `text-2xl` | 24px | Primary section headers, detail page titles |
| `text-3xl` | 30px | Page/hero titles (desktop) |

IMPORTANT: Never use `text-[var(--text-xs)]` or similar arbitrary value syntax. In Tailwind v4, this generates `color:` instead of `font-size:`, silently falling back to 16px.

### Typography Patterns

- **Section headers**: `font-mono text-xs font-bold tracking-[0.12em] uppercase text-[var(--accent)]`
- **Card titles**: `text-base font-semibold text-[var(--cream)]`
- **Metadata**: `text-sm text-[var(--soft)]`
- **Micro text**: `text-xs text-[var(--muted)]`

## Styling Approach

- **Framework**: Tailwind v4 with CSS variables via `@theme inline` in `globals.css`
- **Utility classes**: Prefer existing utilities over raw Tailwind:
  - Cards: `card-premium hover-lift` (never rebuild card/shadow/hover)
  - Surfaces: `.surface-base`, `.surface-raised`, `.surface-elevated`
  - Text: `.text-primary`, `.text-secondary`, `.text-tertiary`
  - Labels: `.mono-label` (font-mono text-xs font-bold uppercase tracking-wider)
  - Borders: `.border-subtle` (never `border-gray-*`)
  - Shadows: `.shadow-card-{sm|md|lg|xl}` (never raw `shadow-*`)
  - Radius: `rounded-card` (12px cards), `rounded-card-xl` (16px), `rounded-xl` (list rows), `rounded-lg` (grid cards)
  - Hover: `.hover-lift` (never rebuild translateY hover)
  - Focus: `.focus-ring` (accessible coral outline)
- **Dynamic colors**: Use `ScopedStyles` + `createCssVarClass()` from `lib/css-utils.ts`
- **Responsive**: Mobile-first. Always check 375px viewport. Use `sm:` breakpoint for desktop.

## Portal Theming

3-layer token system:
1. **Primitives**: `--primitive-primary-500` etc. (raw colors per portal)
2. **Semantic**: `--action-primary`, `--card-bg`, `--card-bg-hover` (role-based)
3. **Component**: `--shadow-card`, `--radius-card`, `--glow-opacity`

Portal-specific styling uses data attributes in `globals.css`:
```css
[data-portal-slug="helpatl"] .component { /* portal overrides */ }
[data-theme="light"] .component { /* light mode */ }
```

IMPORTANT: Never add portal-specific `if (portal === 'foo')` checks in shared components. Use data attributes and CSS.

## Icon System

- **Library**: Phosphor Icons (`@phosphor-icons/react`)
- **Default weight**: `weight="duotone"`
- **Sizes**: Match text scale — typically `w-3.5 h-3.5` for inline, `w-4 h-4` for buttons
- IMPORTANT: Do NOT install new icon packages. Use Phosphor for all icons.
- If Figma MCP returns localhost image sources for icons, use those directly.

## Image Handling

- IMPORTANT: Always use `<SmartImage>` from `components/SmartImage` for dynamic/external URLs
- Never use `import Image from "next/image"` for dynamic URLs — crashes on unknown hostnames
- `<Image>` from next/image is ONLY for static local assets (`/public/` or imported images)
- SmartImage provides: proxy for unknown hosts, passthrough loader, error boundary with fallback UI

```tsx
// Dynamic URLs — always SmartImage
<SmartImage src={event.image_url} alt={event.title} fill />
<SmartImage src={venue.image_url} alt="" fill blurhash={venue.blurhash} />
<SmartImage src={org.logo_url} alt="" width={40} height={40}
  fallback={<div className="w-10 h-10 bg-[var(--twilight)] rounded-full" />}
/>
```

## Asset Storage

- Static assets: `web/public/`
- Portal assets: `web/public/portals/[slug]/`
- Downloaded Figma assets should go in the appropriate public directory

## Key Component Recipes

When implementing from Figma, match these proven production patterns:

### Carousel Card (288-320px)
```
Container: flex-shrink-0 w-72 snap-start rounded-card overflow-hidden bg-[var(--night)] shadow-card-sm hover-lift border border-[var(--twilight)]/40
Image: h-32 or h-44, relative overflow-hidden
Gradient: absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[var(--night)] via-[var(--night)]/60 to-transparent
Title: text-base font-semibold text-[var(--cream)]
Metadata: text-sm text-[var(--soft)]
```

### List Row Card
```
Container: find-row-card find-row-card-bg rounded-xl overflow-hidden border border-[var(--twilight)]/75 border-l-[2px] border-l-[var(--accent-color)]
Padding: p-3 sm:p-3.5
Title: text-base sm:text-lg font-semibold text-[var(--cream)]
Venue: font-medium text-sm text-[var(--text-secondary)]
```

### Detail Page
```
Shell: <main className="max-w-3xl mx-auto px-4 py-4 sm:py-6 pb-28 space-y-5 sm:space-y-8">
Hero: <DetailHero> — modes: "image", "poster", "fallback"
Content: <InfoCard> — border border-[var(--twilight)] bg-[var(--card-bg)] p-6 sm:p-8
Sections: <SectionHeader> — mono uppercase with border-t separator
```

### Modal/Dialog
```
Backdrop: fixed inset-0 z-50 bg-black/60 backdrop-blur-sm
Panel: bg-[var(--night)] border border-[var(--twilight)] rounded-xl p-6 max-w-md w-full shadow-2xl
Footer: use <DialogFooter> component
```

## What NOT To Do

```
NEVER: text-[var(--text-xs)]     → USE: text-xs
NEVER: text-[#8a8a9a]           → USE: text-[var(--muted)]
NEVER: text-white / bg-gray-900  → USE: text-[var(--cream)] / bg-[var(--night)]
NEVER: text-[var(--twilight)]    → USE: text-[var(--muted)]
NEVER: border-[var(--soft)]      → USE: border-[var(--twilight)]
NEVER: shadow-lg                 → USE: shadow-card-lg
NEVER: rounded-xl (for cards)    → USE: rounded-card
NEVER: <Image src={dynamicUrl}>  → USE: <SmartImage src={dynamicUrl}>
NEVER: inline <span>·</span>    → USE: <Dot />
NEVER: hardcoded hex colors      → USE: CSS variable tokens
NEVER: new icon packages          → USE: Phosphor Icons
NEVER: AI-generated editorial     → USE: editorial-templates.ts (template + data)
NEVER: Show "0 friends going"    → USE: SocialProofRow returns null when empty
NEVER: Same card for all events  → USE: TieredEventList with card_tier from API
```

## Code Connect Mappings

These map Figma components to codebase components. When `get_design_context` returns a Code Connect snippet, use the mapped component directly.

| Figma Component | Codebase Component | Import |
|-----------------|-------------------|--------|
| Event Card | `EventCard` | `@/components/cards/EventCard` |
| Venue Card | `VenueCard` | `@/components/cards/VenueCard` |
| Badge | `Badge` | `@/components/ui/Badge` |
| Filter Chip | `FilterChip` | `@/components/filters/FilterChip` |
| Section Header | `FeedSectionHeader` | `@/components/feed/FeedSectionHeader` |
| Detail Hero | `DetailHero` | `@/components/detail/DetailHero` |
| Smart Image | `SmartImage` | `@/components/SmartImage` |

## Feed Tier System

Events are assigned a `card_tier` (hero/featured/standard) by the CityPulse pipeline based on intrinsic quality + personalized signals.

### Tier Assignment (`web/lib/city-pulse/tier-assignment.ts`)
- **Hero**: `importance = 'flagship'` OR `is_tentpole` OR `festival_id` set OR intrinsic score >= 30
- **Featured**: `importance = 'major'` OR venue has editorial_mentions OR friends going > 0 OR intrinsic score >= 15
- **Standard**: Everything else

### Rendering (`web/components/feed/TieredEventList.tsx`)
LineupSection uses `<TieredEventList>` for vertical tiered rendering:
1. Editorial callout (if template matches) — replaces section header
2. Hero card (max 1) — full-width image, gradient, large title
3. Featured carousel (max 4) — 288px cards in horizontal scroll
4. Standard rows — compact single-line, staggered entrance

### Feed Section Order (CityPulseShell)
1. **Contextual Hero** (CityBriefing) — binds to flagship events when present
2. **The Lineup** (LineupSection) — tabbed, filtered, vertical tiered rendering
3. **Worth Checking Out** (DestinationsSection) — contextual venues from occasion + editorial data
4. **Today in Atlanta** (TodayInAtlantaSection) — news, defaults to Culture/Arts/Food
5. **Regular Hangs** (HangFeedSection) — unchanged
6. **See Shows** (SeeShowsSection) — Film/Music/Stage tabs
7. **Around the City** (PortalTeasersSection) — cross-portal headlines
8. **On the Horizon** (PlanningHorizonSection) — quality-gated: tentpoles, festivals, multi-day only
9. **Browse** — category grid

### Noise Filtering
The curated feed excludes `category_id IN (recreation, unknown)` and YMCA sources from the pipeline query (`fetch-events.ts`). Filtered events remain accessible via "See all" links to the Find view.

### Planning Horizon Quality Gate
Only: `is_tentpole = true` OR `festival_id IS NOT NULL` OR multi-day OR `importance = 'flagship'`. No weekly recurring events.

### Editorial Voice (`web/lib/editorial-templates.ts`)
Template-driven, never AI-generated. Three patterns:
1. **Contextual callout**: "Atlanta's biggest food festival starts tonight."
2. **Press attribution**: PressQuote component renders editorial_mentions snippets
3. **Social proof**: SocialProofRow renders friend avatars + attendance

### Elevation Component Reference

| Component | Path | Purpose |
|-----------|------|---------|
| HeroCard | `web/components/feed/HeroCard.tsx` | Full-width image card for hero-tier events |
| StandardRow | `web/components/feed/StandardRow.tsx` | Compact single-line row for standard-tier |
| TieredEventList | `web/components/feed/TieredEventList.tsx` | Tier-aware section renderer |
| EditorialCallout | `web/components/feed/EditorialCallout.tsx` | Gold-bordered contextual editorial aside |
| PressQuote | `web/components/feed/PressQuote.tsx` | Inline press attribution quote |
| SocialProofRow | `web/components/feed/SocialProofRow.tsx` | Friend avatars + attendance text |

### Elevation Utilities

| Utility | Path | Purpose |
|---------|------|---------|
| getCardTier | `web/lib/city-pulse/tier-assignment.ts` | Compute card tier from event signals |
| generateEditorialCallout | `web/lib/editorial-templates.ts` | Template-match editorial text |
| getContextualTimeLabel | `web/lib/time-labels.ts` | "Starts in 2 hours", "Tomorrow at 8 PM" |
| getRaritySignal | `web/lib/rarity-signals.ts` | "One Night Only", "Closes Saturday" |

## Architectural Rules

- All authenticated mutations go through API routes, never client-side Supabase
- Use `as never` for Supabase insert/update operations
- Always add timeouts to fetch calls (default 8-10s)
- Feature flags in `lib/launch-flags.ts`
- Client components (`"use client"`) import from `*-utils.ts` files, never server modules

## Figma Code Connect Status

Code Connect requires a Figma Organization/Enterprise plan with Developer seats. The captured Figma file (`Te8s9LaC1o9KRQQyHzgyC7`) contains flat DOM snapshots from page captures, not structured Figma components with variants/props. Code Connect cannot meaningfully map these flat frame hierarchies to React components.

The manual mapping table in "Code Connect Mappings" above serves as the functional equivalent. When Figma returns design context for captured pages, use that table to identify the correct codebase component.

## Pencil Design System

The canonical design system lives in `docs/design-system.pen`. This file contains:
- 32 variables (colors, fonts, shapes, spacing) with portal theming on the `portal` axis
- 25 reusable components across 3 tiers (atoms, molecules, organisms)
- 10 Atlanta portal page compositions (5 pages x desktop + mobile)

### Using Pencil for Design Reference

When implementing or modifying shared components:

1. Open the design system: `mcp__pencil__open_document("docs/design-system.pen")`
2. Find components: `mcp__pencil__batch_get(patterns: ["Badge", "EventCard"], filePath: "docs/design-system.pen")`
3. Screenshot for reference: `mcp__pencil__get_screenshot(filePath: "docs/design-system.pen", nodeId: "<id>")`
4. Implement following the design system rules above
5. Browser-test and compare against the Pencil screenshot for pixel-perfect match

### Pencil Component IDs

| Component | Node ID | Tier |
|-----------|---------|------|
| Badge | I7NUV | Atom |
| FilterChip | olqzW | Atom |
| Button | GBoOR | Atom |
| Dot | CsjTB | Atom |
| CountBadge | xDCna | Atom |
| IconBox | W2bkv | Atom |
| EventCard | ViqPG | Molecule |
| EventCard/compact | pjp57 | Molecule |
| VenueCard | h5zDT | Molecule |
| FeaturedCard | CX6oB | Molecule |
| FeedSectionHeader | v1ON6 | Molecule |
| MetadataGrid | YYhn1 | Molecule |
| SectionHeader | vBfLD | Molecule |
| DetailHero | fupdn | Organism |
| InfoCard | cwCFk | Organism |
| DetailStickyBar | wEQon | Organism |
| MobileFilterSheet | q6CvR | Organism |
| FeedSection (carousel) | yt3B5 | Organism |
| FeedSection (list) | Bo2iQ | Organism |
| Modal | InHlJ | Organism |
| HeaderNav | u7MOk | Page |
| MobileHeader | rEX9y | Page |
| Footer | gJVuG | Page |
| MobileTabBar | 8LoLi | Page |
| NeighborhoodCard | eoLUe | Page |

### Portal Theming in Pencil

Variables support a `portal` theme axis with modes: atlanta, arts, adventure, family, citizen.
Themed variables (accent colors, fonts, shapes) automatically transform when a component instance sets `theme: {"portal": "arts"}`.

To preview a component in a different portal theme, create an instance with:
```javascript
I(parent, {type: "ref", ref: "<component-id>", theme: {"portal": "arts"}})
```

### Additional Pencil Component IDs

| Component | Node ID | Tier |
|-----------|---------|------|
| DescriptionTeaser | 2ZOe9 | Molecule |
| SocialProofStrip | gaiuv | Molecule |
| ScheduleRow | t5jrF | Molecule |
| DayOfWeekFilter | mNhjk | Molecule |
| CalendarDayCell | RHvqs | Atom |
| MapPin | J2l3r | Atom |

### Atlanta Portal Page Compositions

| Page | Desktop ID | Mobile ID |
|------|-----------|-----------|
| Feed Homepage | Z9AcJ | 6TYYC |
| Events View | BxHW9 | Y6t71 |
| Places View | DFOYd | UAmLb |
| Venue Detail | JxXPT | Kv8Oa |
| Event Detail | neovA | wHsA6 |
| Series Detail | dtvVK | 0BDgZ |
| Regulars Tab | HYCT0 | DBYJ0 |
| Neighborhoods | QwPkU | 8inW1 |
| Neighborhood Detail | Z0gY3 | YvbKx |
| Search Results | s7ROV | vcZOu |
| Calendar View | AhhUW | ekxuA |
| Map View | MFk47 | 5zLpv |
| Profile | y1Zdz | Rs7e5 |
| Saved | PwoI6 | z1a7U |
| Saved (Empty State) | ykN0g | — |
| Community | JikA8 | NcXkj |
| Community (Groups) | nqF65 | — |
