# Lost City Design System — Pencil + Figma Bridge

**Date**: 2026-03-22
**Status**: Review
**Goal**: Establish a design system as source of truth for all Lost City portals, enabling AI-driven design exploration with pixel-perfect implementation.

## Context

Lost City is a multi-portal platform where each consumer portal (Atlanta, Arts, Adventure, Family, Citizen) has a radically different visual language — different fonts, colors, corners, card treatments, layout patterns. Distribution portals (FORTH hotels, convention companions, neighborhood editions) share structural templates but adopt client branding.

Today, design decisions live in code. There's no canonical design reference. Components drift visually across pages. New portals get designed ad-hoc. The goal is to systematize this without slowing down the agentic development pace.

## Architecture Decision: Pencil + Figma

**Pencil (.pen)** is the design system home. Agents can programmatically create, update, and compose components via `batch_design`. This is where design exploration, component authoring, and theming happen.

**Figma** is the implementation bridge. Captured pages provide real-state reference. `get_design_context` reads captured pages when agents implement designs. Code Connect maps captured Figma components to React components. Periodic re-captures keep Figma current.

**Design system rules** (`web/.claude/rules/figma-design-system.md`) encode tokens, component mappings, recipes, and constraints. Already written. Guides agents regardless of source.

### Why not Figma-only?

The Figma MCP has no write API for component creation. It can capture pages (`generate_figma_design`) and read designs (`get_design_context`), but cannot create components, set auto-layout, or manage variants programmatically. Pencil's `batch_design` can.

### Why not Pencil-only?

Figma's `get_design_context` returns structured code hints mapped to the project's stack. Code Connect formally links Figma components to React components. These capabilities don't exist in Pencil. Figma also has native variable modes for multi-theme support.

## Design Principles

1. **Pixel perfection is the implementation bar.** The sync between Pencil/Figma and code is loosely coupled (bidirectional reference, not strict gating), but when implementing from a design, the result must match exactly.

2. **Components are built entirely on variables.** No hardcoded colors, fonts, or radii anywhere in the component library. Switching a theme mode transforms every component completely.

3. **Consumer portals are radically different.** They share atoms and molecules but compose unique pages. Arts is exhibition-first, Adventure is destination-first, Atlanta is feed-first. Page templates are NOT shared across consumer portals.

4. **Distribution portals share templates.** FORTH, convention companion, neighborhood editions use the same page structures with client token sets. New distribution templates are a growing library.

5. **Design quality is the primary value.** This system exists to explore better designs before building, enforce consistency within a portal, and communicate intent to agents. In that priority order.

## Relationship to Existing Token System

The codebase already has a 3-layer token system:
1. **Primitives** (`--primitive-primary-500`, etc.) — raw colors per portal, defined in `web/lib/visual-presets.ts`
2. **Semantic** (`--action-primary`, `--card-bg`, `--card-bg-hover`) — role-based, derived from primitives
3. **Component** (`--shadow-card`, `--radius-card`, `--glow-opacity`) — component-specific overrides

These are injected at runtime by `PortalTheme.tsx` as CSS variables on `:root`.

**Pencil variables mirror this system, not replace it.** The Pencil variable names map directly to CSS custom properties. When implementing from Pencil designs, agents use the CSS variable name from the mapping column, not the Pencil variable name. The canonical source for token VALUES is `globals.css` (`:root` and `@theme inline` blocks) + `visual-presets.ts` (portal overrides).

### Distribution Portal Token Sets

Distribution portals (FORTH, convention companions, neighborhood editions) get their own entry in `visual-presets.ts` like any other portal. The token set is populated from client brand guidelines. Distribution tokens override the semantic layer (`--action-primary`, `--card-bg`, etc.) and optionally the primitive layer. Shared component structure stays identical — only visual properties change via the token cascade.

## Token Foundation

### Variable Collections

All visual properties are tokenized into Pencil variables with portal theme modes.

**Color variables:**

| Group | Variables | CSS Mapping |
|-------|-----------|-------------|
| `surface/void` | Page background | `--void` |
| `surface/night` | Card background | `--night` |
| `surface/dusk` | Modal/elevated | `--dusk` |
| `surface/twilight` | Borders, dividers | `--twilight` |
| `text/cream` | Primary text | `--cream` |
| `text/soft` | Secondary text | `--soft` |
| `text/muted` | Tertiary text | `--muted` |
| `accent/coral` | Brand CTA | `--coral` |
| `accent/gold` | Featured/time | `--gold` |
| `accent/neon-green` | Free/success | `--neon-green` |
| `accent/neon-cyan` | Secondary accent | `--neon-cyan` |
| `accent/neon-magenta` | Nightlife | `--neon-magenta` |
| `accent/vibe` | Mood/vibe | `--vibe` |
| `semantic/action-primary` | Portal primary action | `--action-primary` |
| `semantic/card-bg` | Card background (portal-aware) | `--card-bg` |

**Typography variables:**

| Variable | Atlanta | Arts | Adventure | Family | Citizen |
|----------|---------|------|-----------|--------|---------|
| `font/display` | Outfit | Space Grotesk | Space Grotesk | Plus Jakarta Sans | System (sans-serif) |
| `font/body` | Outfit | IBM Plex Mono | Space Grotesk | DM Sans | System (sans-serif) |
| `font/accent` | JetBrains Mono | Playfair Display | — | — | Serif (tagline) |
| `font/mono` | JetBrains Mono | IBM Plex Mono | JetBrains Mono | JetBrains Mono | JetBrains Mono |

**Shape variables:**

| Variable | Atlanta | Arts | Adventure | Family | Citizen |
|----------|---------|------|-----------|--------|---------|
| `shape/card-radius` | 12px | 0px | 0px | 12px | 12px |
| `shape/chip-radius` | 9999px | 0px | 0px | 9999px | 9999px |
| `shape/input-radius` | 8px | 0px | 0px | 8px | 8px |
| `shape/border-width` | 1px | 1.5px | 2px | 1px | 1px |

**Elevation variables:**

| Variable | Atlanta | Arts | Adventure | Family | Citizen |
|----------|---------|------|-----------|--------|---------|
| `elevation/card-shadow` | shadow-card-sm | none | none | shadow-card-sm | shadow-card-sm |
| `elevation/glow-opacity` | 0.08 | 0 | 0 | 0 | 0 |
| `elevation/card-fill` | solid | stroke-only | solid + thick border | solid | solid (light bg) |

### Typography Scale

Fixed scale across all portals (sizes don't change, fonts do):

| Style | Size | Weight | Tracking | Line Height | Use |
|-------|------|--------|----------|-------------|-----|
| `heading/3xl` | 30px | 600 | 0 | 1.2 | Hero titles |
| `heading/2xl` | 24px | 600 | 0 | 1.25 | Section headers, detail titles |
| `heading/xl` | 20px | 600 | 0 | 1.3 | Secondary headers |
| `heading/lg` | 18px | 600 | 0 | 1.3 | Prominent card titles |
| `body/base` | 15px | 400 | 0 | 1.5 | Card titles, body text |
| `body/sm` | 13px | 400 | 0 | 1.5 | Descriptions, metadata |
| `mono/label` | 11px | 700 | 0.12em | 1.2 | Section headers (uppercase) |
| `mono/micro` | 10px | 700 | 0.12em | 1.2 | Badge counts only |

### Spacing

4px base grid. Standard scale: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64.

### Reference Frames

Build four reference frames in the Pencil file:
1. **Color Palette** — all color variables with swatches, names, CSS mapping
2. **Typography** — all text styles rendered at each scale step
3. **Spacing & Radius** — visual grid + radius examples
4. **Shadows & Elevation** — shadow levels + glow examples

## Component Library

### Tier 1: Atoms

| Component | Variants / Props | Description |
|-----------|-----------------|-------------|
| **Badge** | variant: neutral, success, alert, info, accent; size: sm, md | Color-coded status pills |
| **FilterChip** | active/inactive; variant: date, category, free; size: sm, md | Tappable filter pills |
| **CountBadge** | placement: inline, overlay | Notification count indicator |
| **IconBox** | category-colored container with icon | Category indicator in cards |
| **Dot** | — | Metadata separator (middot) |
| **Button** | variant: primary, secondary, ghost; size: sm, md, lg | CTA buttons |

### Tier 2: Molecules

| Component | Variants | Description |
|-----------|----------|-------------|
| **EventCard** | size: compact, full; with/without image rail | List row event card with time, title, venue, tags |
| **VenueCard** | with/without image | Venue in spots finder with distance, price, events |
| **FeaturedCard** | — | Poster image + gradient + title overlay for feed carousels (inline in `FeaturedCarousel.tsx` today — to be extracted) |
| **FeedSectionHeader** | priority: primary, secondary; with/without badge | Mono label + icon + accent + see-all |
| **MetadataGrid** | — | Label/value pairs for detail pages |
| **SectionHeader** | — | Border-t separator + mono uppercase title |

### Tier 3: Organisms

| Component | Description |
|-----------|-------------|
| **DetailHero** | Image/poster/fallback modes with gradient overlay |
| **InfoCard** | Bordered content container for detail page sections |
| **DetailStickyBar** | Fixed bottom CTA bar |
| **MobileFilterSheet** | Bottom sheet with filter grid + apply/clear |
| **FeedSection** | Header + content slot (accepts carousel or list rows) |
| **Modal** | Backdrop + panel + DialogFooter |

### Build Principles

- Every component uses auto-layout (vertical/horizontal) matching Tailwind flex patterns
- Every visual property references a variable — fill, stroke, radius, text color, font family
- Variants match React component props where applicable
- Components are composable — FeedSection accepts CarouselCard or EventCard as content

### Portal-Specific Components (NOT in shared library)

These live in their portal's section of the Pencil file:

- **Arts**: ExhibitionCard, ArtistProfile, OpenCallCard, StudioCard
- **Adventure**: TrailCard, CommitmentFilter, ConditionsBadge, TripCard
- **Family**: ProgramCard, KidProfileBadge, SchoolCalendarRow
- **Civic**: CivicHero, ImpactStrip, MeetingCard, VolunteerCard
- **Distribution**: Inherits shared components, no unique ones (by design)

## Page Templates

### Consumer Portals (unique pages per portal)

Each consumer portal designs its own pages from scratch, composing shared atoms/molecules with portal-specific organisms. Pages are built at desktop (1440px) and mobile (375px).

**Atlanta pages**: Feed, Events View, Places View, Venue Detail, Event Detail, Neighborhoods
**Arts pages**: Feed/Discovery, Exhibition Detail, Artist Profile, Open Calls Board, Studios
**Adventure pages**: Destinations, Trail Detail, Trip Planning
**Family pages**: Feed, Programs, School Calendar, Kid Profiles
**Civic pages**: Feed, Meetings, Volunteer Board, Channel Detail

### Distribution Templates (shared structure, client tokens)

Distribution portals share page structures. A template is duplicated and the theme mode switched to the client's token set.

**Base distribution template**: Feed, Events View, Places View, Venue Detail, Event Detail
**Concierge variant**: Simplified feed, curated highlights, "tonight" focus
**Neighborhood variant**: Geo-scoped, walking-distance filter, local business emphasis

New distribution templates are added as B2B verticals emerge.

## Figma Bridge

### Captured Pages

Periodically capture live localhost pages into Figma for `get_design_context` reads. Current captures (file: `Te8s9LaC1o9KRQQyHzgyC7`):
- Feed homepage, Events view, Places view, Venue Detail, Neighborhoods

### Code Connect

Map captured Figma components to React components:

| Figma Component | React Component | Import |
|-----------------|----------------|--------|
| Event Card | `EventCard` | `@/components/EventCard` |
| Venue Card | `VenueCard` | `@/components/VenueCard` |
| Badge | `Badge` | `@/components/ui/Badge` |
| Filter Chip | `FilterChip` | `@/components/filters/FilterChip` |
| Section Header | `FeedSectionHeader` | `@/components/feed/FeedSectionHeader` |
| Detail Hero | `DetailHero` | `@/components/detail/DetailHero` |
| Detail Sticky Bar | `DetailStickyBar` | `@/components/detail/DetailStickyBar` |
| Featured Carousel | `FeaturedCarousel` | `@/components/feed/FeaturedCarousel` |

### Re-capture Recipe

Documented in memory (`reference_figma_mcp_capture.md`):
1. Create a temporary branch (e.g., `tmp/figma-capture`) — never capture on `main`
2. Add `https://mcp.figma.com` to `script-src` and `connect-src` in `web/lib/csp.ts`
3. Add capture script to `web/app/layout.tsx`
4. Generate capture IDs, open pages with hash fragment
5. Poll until complete
6. `git checkout -- web/lib/csp.ts web/app/layout.tsx` to revert (or delete the branch)

**Safeguard**: The capture script and CSP changes must never be committed to `main`. Using a temporary branch prevents accidental deployment.

### Reconciliation Cadence

- **Before new portal theming work**: Re-capture current state so the Pencil designs start from reality
- **After major UI changes** (e.g., elevate sessions, feed redesigns): Update Pencil components + re-capture Figma
- **Not needed for**: Minor bug fixes, copy changes, data-layer work
- **Trigger**: If an agent reads a Pencil component and the live site looks noticeably different, flag it and reconcile before implementing

## Pencil Variable Mechanics

Pencil variables are managed via the `set_variables` and `get_variables` MCP tools. Variables support theme modes (similar to Figma variable modes) for multi-portal theming.

**Phase 0 must validate this assumption before any component work begins.** If Pencil variables don't support theme modes, the fallback is one .pen file per portal with hardcoded values, which is less elegant but still functional.

### Target File

Create a new file: `docs/design-system.pen`. The existing `docs/scratchboard.pen` has ad-hoc portal design explorations at various coordinates — it should remain as-is for reference, not be repurposed as the design system.

## Implementation Phases

### Phase 0: Pencil Variable Spike (must complete first)
- Create `docs/design-system.pen`
- Test `set_variables` with a small token set (3-4 colors)
- Validate whether theme modes are supported (can variables have different values per mode?)
- If modes work: proceed with the multi-mode architecture
- If modes don't work: document the limitation and adjust Phase 1 to use per-portal .pen files or hardcoded values with a naming convention (e.g., `atlanta/surface/void`, `arts/surface/void`)
- Build one simple test component (Badge) using the variables to confirm the end-to-end flow

### Phase 1: Token Foundation
- Target file: `docs/design-system.pen`
- Build color, typography, spacing, radius, shadow variables
- Build the 4 reference frames (palette, type, spacing, elevation) — optional if blocking; tokens are already documented in `globals.css`
- Set up Atlanta as default theme mode
- Validate tokens match `globals.css` `:root` block and `@theme inline` overrides exactly

### Phase 2: Shared Component Library
- Build Tier 1 atoms (Badge, FilterChip, CountBadge, IconBox, Dot, Button)
- Build Tier 2 molecules (EventCard, VenueCard, CarouselCard, FeedSectionHeader, MetadataGrid, SectionHeader)
- Build Tier 3 organisms (DetailHero, InfoCard, DetailStickyBar, MobileFilterSheet, FeedSection, Modal)
- Validate each component against live site screenshots for pixel accuracy

### Phase 3: Atlanta Portal Pages
- Compose Feed homepage from component library (desktop + mobile)
- Compose Events View, Places View, Venue Detail, Neighborhoods
- Compare against captured Figma pages for fidelity
- These become the design exploration surfaces

### Phase 4: Code Connect + Rules Update
- Wire up Code Connect mappings in Figma for captured components
- Update `web/.claude/rules/figma-design-system.md` with Pencil component references
- Test end-to-end: modify a component in Pencil → implement in code → validate

### Phase 5: Portal Themes (fast follow)
- Add Arts token set (copper, warm red, Plex Mono, Playfair, zero radius, stroke cards)
- Add Adventure token set (terracotta, olive, Space Grotesk, sharp corners, heavy borders)
- Add Family token set (field sage, amber, Plus Jakarta, DM Sans, warm rounded)
- Add Citizen token set (teal, light cream, serif tagline, rounded)
- Build portal-specific components for each
- Build first distribution template

## Success Criteria

1. An agent can read a Pencil component, implement it in code, and achieve pixel-perfect match
2. Switching theme mode on a shared component in Pencil produces a valid design for any portal
3. Design exploration (rearranging components, trying new layouts) happens in Pencil, not in code
4. The design system rules file is sufficient for agents to implement without reading the Pencil file directly (the rules ARE the bridge when Pencil MCP isn't available)
5. New distribution portals can be spun up by duplicating a template + applying a client token set

## Risks

- **Pencil variable modes** (HIGH): The entire multi-portal theming strategy assumes Pencil `set_variables` supports mode/theme switching. Phase 0 spike validates this before any real work begins. Fallback: per-portal files or namespaced variables.
- **Pencil MCP maturity**: If `batch_design` can't handle complex auto-layout or variant components, we may need to simplify component structure. Test with Badge in Phase 0.
- **Drift**: Code will move ahead of Pencil designs. The bidirectional reference model accepts this. Reconciliation cadence defined above — trigger-based, not calendar-based.
- **Token sprawl**: Each portal adds 30+ variables. Naming convention is `{group}/{property}` (e.g., `surface/void`, `accent/coral`). Portal variants are theme modes, not separate variable names.
- **Pencil-to-Figma gap**: No automated bridge. The design system rules file is the manual bridge. Agents read Pencil for design specs, Figma for `get_design_context` code hints.
- **Re-capture fragility**: CSP/script injection required for Figma captures. Mitigated by always using a temporary branch, never `main`.
