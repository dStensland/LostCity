# Lost City Design System — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Pencil-based design system with shared tokens and components for all Lost City portals, bridged to Figma for implementation reads.

**Architecture:** Pencil (.pen) is the design authoring surface — agents build tokens, components, and page compositions via `batch_design` and `set_variables`. Figma holds captured page screenshots for `get_design_context` reads. Design system rules (`web/.claude/rules/figma-design-system.md`) bridge both.

**Tech Stack:** Pencil MCP (`batch_design`, `set_variables`, `get_screenshot`), Figma MCP (`get_design_context`, `code_connect`), CSS variables in `globals.css`, React + Tailwind v4

**Spec:** `docs/superpowers/specs/2026-03-22-pencil-figma-design-system.md`

---

## Task 0: Pencil Variable Spike (MUST complete before all other tasks)

**Purpose:** Validate that Pencil `set_variables` supports the theming model we need. This is the highest-risk item — if it fails, we need to adjust the entire approach.

**Files:**
- Create: `docs/design-system.pen`

- [ ] **Step 1: Read Pencil design-system guidelines (MUST be first)**

```
mcp__pencil__get_guidelines(topic: "design-system")
```

This returns the .pen file schema including: variable definition format, variable reference syntax for `batch_design`, component creation patterns (`reusable: true`), auto-layout properties, and text node properties. **All subsequent steps depend on this output.** If the schema differs from the examples below, adapt accordingly.

- [ ] **Step 2: Create the .pen file**

```
mcp__pencil__open_document(filePathOrTemplate: "/Users/coach/Projects/LostCity/docs/design-system.pen")
```

If `open_document` doesn't accept a path for new files, call `open_document("new")` and note the created file path from the response. The file must end up at `docs/design-system.pen`.

- [ ] **Step 3: Set a small batch of color variables**

```
mcp__pencil__set_variables(
  filePath: "docs/design-system.pen",
  variables: {
    "surface/void": { "type": "color", "value": "#09090B" },
    "surface/night": { "type": "color", "value": "#0F0F14" },
    "accent/coral": { "type": "color", "value": "#FF6B7A" },
    "text/cream": { "type": "color", "value": "#F5F5F3" }
  }
)
```

- [ ] **Step 4: Read back variables to confirm they persisted**

```
mcp__pencil__get_variables(filePath: "docs/design-system.pen")
```

Verify all 4 variables are returned with correct values.

- [ ] **Step 5: Test theme modes (critical validation)**

Try setting variables with a theme axis (e.g., "portal" with modes "atlanta" and "arts"):

```
mcp__pencil__set_variables(
  filePath: "docs/design-system.pen",
  variables: {
    "accent/coral": {
      "type": "color",
      "value": "#FF6B7A",
      "themes": {
        "portal": {
          "atlanta": "#FF6B7A",
          "arts": "#C9874F"
        }
      }
    }
  }
)
```

Read back with `get_variables` and check if theme modes are returned.

**Decision gate:**
- If themes work → proceed with multi-mode architecture (Tasks 1-7 as written)
- If themes don't work → adjust Task 1 to use namespaced variable names instead (e.g., `atlanta/accent/coral`, `arts/accent/coral`). Document the limitation in the spec.

- [ ] **Step 6: Validate font availability**

Build a test text node with `fontFamily: "Outfit"` and screenshot it. Verify the font rendered correctly (not a system fallback). Repeat for `JetBrains Mono`. If fonts aren't available, document the limitation — components will need to use available fallbacks.

- [ ] **Step 7: Build a test Badge component using variables**

Build a simple Badge using the variable reference syntax confirmed in Step 1's guidelines output. The example below is illustrative — **adapt property names and variable reference syntax to match what `get_guidelines` returned**:

```
mcp__pencil__batch_design(
  filePath: "docs/design-system.pen",
  operations: """
badge=I(document,{type:"frame",name:"Badge",reusable:true,layout:"horizontal",gap:4,padding:[4,10,4,10],fill:"$accent/coral",cornerRadius:9999})
label=I(badge,{type:"text",name:"label",content:"BADGE",fontSize:10,fontWeight:700,fill:"$surface/void",letterSpacing:0.12,fontFamily:"JetBrains Mono"})
"""
)
```

**Important:** Capture the returned node ID for the badge — you'll need it for the screenshot step.

- [ ] **Step 8: Screenshot the Badge to validate**

```
mcp__pencil__get_screenshot(filePath: "docs/design-system.pen", nodeId: "<badge-id>")
```

Verify: coral pill with white/void text, fully rounded corners, mono uppercase label.

- [ ] **Step 9: Document findings**

Update the spec with:
- Whether theme modes are supported and the exact syntax
- The correct variable reference syntax for `batch_design` operations
- Any limitations discovered (auto-layout gaps, font handling, etc.)

---

## Task 1: Token Foundation — Colors

**Files:**
- Modify: `docs/design-system.pen`
- Reference: `web/app/globals.css:91-106` (`:root` color tokens)

- [ ] **Step 1: Set all surface color variables**

```
mcp__pencil__set_variables(
  filePath: "docs/design-system.pen",
  variables: {
    "surface/void": { "type": "color", "value": "#09090B" },
    "surface/night": { "type": "color", "value": "#0F0F14" },
    "surface/dusk": { "type": "color", "value": "#18181F" },
    "surface/twilight": { "type": "color", "value": "#252530" }
  }
)
```

- [ ] **Step 2: Set all text color variables**

```
mcp__pencil__set_variables(
  filePath: "docs/design-system.pen",
  variables: {
    "text/cream": { "type": "color", "value": "#F5F5F3" },
    "text/soft": { "type": "color", "value": "#A1A1AA" },
    "text/muted": { "type": "color", "value": "#8B8B94" }
  }
)
```

- [ ] **Step 3: Set all accent color variables**

```
mcp__pencil__set_variables(
  filePath: "docs/design-system.pen",
  variables: {
    "accent/coral": { "type": "color", "value": "#FF6B7A" },
    "accent/gold": { "type": "color", "value": "#FFD93D" },
    "accent/neon-green": { "type": "color", "value": "#00D9A0" },
    "accent/neon-cyan": { "type": "color", "value": "#00D4E8" },
    "accent/neon-magenta": { "type": "color", "value": "#E855A0" },
    "accent/vibe": { "type": "color", "value": "#A78BFA" },
    "accent/neon-red": { "type": "color", "value": "#FF5A5A" }
  }
)
```

- [ ] **Step 4: Set semantic color variables**

```
mcp__pencil__set_variables(
  filePath: "docs/design-system.pen",
  variables: {
    "semantic/action-primary": { "type": "color", "value": "#FF6B7A" },
    "semantic/card-bg": { "type": "color", "value": "#0F0F14" },
    "semantic/card-bg-hover": { "type": "color", "value": "#18181F" }
  }
)
```

- [ ] **Step 5: Verify all variables**

```
mcp__pencil__get_variables(filePath: "docs/design-system.pen")
```

Cross-reference every value against `globals.css:91-106`. Any mismatch is a bug.

- [ ] **Step 6: Build Color Palette reference frame**

Use `find_empty_space_on_canvas` to place a frame, then build a visual palette showing each color as a swatch with its name and CSS mapping. Organize as:
- Row 1: Surfaces (void → twilight, dark to light)
- Row 2: Text (cream → muted, light to dark)
- Row 3: Accents (coral, gold, neon-green, neon-cyan, neon-magenta, vibe, neon-red)
- Row 4: Semantics (action-primary, card-bg, card-bg-hover)

Each swatch: 80x80 frame with the color fill + text label below (name + hex + CSS var).

---

## Task 2: Token Foundation — Typography, Spacing, Shape

**Files:**
- Modify: `docs/design-system.pen`
- Reference: `web/app/globals.css` (`@theme inline` block for font sizes)

- [ ] **Step 1: Set shape and elevation variables**

```
mcp__pencil__set_variables(
  filePath: "docs/design-system.pen",
  variables: {
    "shape/card-radius": { "type": "number", "value": 12 },
    "shape/card-xl-radius": { "type": "number", "value": 16 },
    "shape/chip-radius": { "type": "number", "value": 9999 },
    "shape/input-radius": { "type": "number", "value": 8 },
    "shape/border-width": { "type": "number", "value": 1 }
  }
)
```

Note: Adapt `type` field to match what `get_guidelines` returned for numeric variables. If Pencil doesn't support number variables, store these as reference values in the reference frames only.

- [ ] **Step 2: Build Typography reference frame**

Create a frame titled "Typography Scale" showing each text style rendered:

| Row | Style | Content | Properties |
|-----|-------|---------|------------|
| 1 | heading/3xl | "Hero Title 30px" | Outfit 30px/600/1.2 |
| 2 | heading/2xl | "Section Header 24px" | Outfit 24px/600/1.25 |
| 3 | heading/xl | "Secondary Header 20px" | Outfit 20px/600/1.3 |
| 4 | heading/lg | "Card Title 18px" | Outfit 18px/600/1.3 |
| 5 | body/base | "Body text at 15px" | Outfit 15px/400/1.5 |
| 6 | body/sm | "Metadata at 13px" | Outfit 13px/400/1.5 |
| 7 | mono/label | "SECTION HEADER 11PX" | JetBrains Mono 11px/700/1.2, tracking 0.12em, uppercase |
| 8 | mono/micro | "BADGE 10PX" | JetBrains Mono 10px/700/1.2, tracking 0.12em, uppercase |

All text in `$text/cream` on `$surface/void` background. Include the CSS class mapping next to each row (e.g., "→ text-3xl", "→ text-xs + mono-label").

- [ ] **Step 3: Build Spacing reference frame**

Create a frame showing the spacing scale as horizontal bars:
- 4px, 8px, 12px, 16px, 20px, 24px, 32px, 40px, 48px, 64px
- Each bar has width = the spacing value, height = 24px, fill = `$accent/coral` at 30% opacity
- Label each with the px value and Tailwind equivalent (e.g., "16px → p-4")

- [ ] **Step 4: Build Shape reference frame**

Show radius examples:
- `card`: 12px rounded rectangle (120x80)
- `card-xl`: 16px rounded rectangle (120x80)
- `chip`: fully rounded pill (120x32)
- `input`: 8px rounded rectangle (200x40)
- `sharp` (Arts/Adventure): 0px rectangle (120x80)

Show border width examples:
- 1px (Atlanta default), 1.5px (Arts), 2px (Adventure)

- [ ] **Step 5: Build Shadows & Elevation reference frame**

Show three cards with different elevation levels:
- `shadow-card-sm`: subtle shadow
- `shadow-card-md`: medium shadow
- `shadow-card-lg`: prominent shadow
- One card showing "stroke-only" style (Arts portal)
- One card showing "thick border" style (Adventure portal)

- [ ] **Step 6: Screenshot all 4 reference frames and verify**

Take a screenshot of each frame. Verify:
- Colors match hex values exactly
- Typography renders at correct sizes
- Spacing bars are proportionally correct
- Radius examples show visible differences

---

## Task 3: Shared Components — Tier 1 Atoms

**Files:**
- Modify: `docs/design-system.pen`
- Reference: `web/components/ui/Badge.tsx`, `web/components/filters/FilterChip.tsx`

- [ ] **Step 1: Read the Pencil design-system guidelines**

```
mcp__pencil__get_guidelines(topic: "design-system")
```

Understand component creation patterns, reusable flag, auto-layout, variable references.

- [ ] **Step 2: Build Badge component**

Reusable component with variants. Reference `web/components/ui/Badge.tsx` for exact styling:
- Container: horizontal layout, gap 4, padding [4, 10], fully rounded, fill varies by variant
- Label: mono/micro style (10px, 700, uppercase, 0.12em tracking)
- Variants: neutral (twilight bg, soft text), success (neon-green/10 bg, neon-green text), alert (coral/10 bg, coral text), info (neon-cyan/10 bg, neon-cyan text), accent (coral bg, void text)

Build each variant as a separate instance next to the reusable component for reference.

- [ ] **Step 3: Screenshot Badge variants and compare against live site**

Take screenshot. Compare against the live site Badge rendering. Adjust until pixel-perfect.

- [ ] **Step 4: Build FilterChip component**

Reference `web/components/filters/FilterChip.tsx`:
- Container: horizontal layout, gap 6, padding [10, 14], fully rounded, border
- Label: mono text, 11px for sm, 13px for md
- States: inactive (white/5 bg, soft text, white/10 border), active (accent-colored per variant)
- Active variants: date (gold), category (coral), free (neon-green)

- [ ] **Step 5: Build Button component**

Reference production CTA patterns:
- Primary: coral bg, void text, rounded-lg, padding [10, 24], font-mono text-sm font-medium
- Secondary: twilight bg, cream text, same shape
- Ghost: transparent bg, soft text, hover → twilight bg

- [ ] **Step 6: Build Dot, CountBadge, IconBox**

Simple atoms:
- **Dot**: text node with "·" character, soft color, 13px
- **CountBadge**: small coral circle with white number, mono/micro text
- **IconBox**: 32x32 rounded-lg frame with accent/20 bg, centered 16px icon placeholder

- [ ] **Step 7: Screenshot all atoms and validate**

Take screenshots of all Tier 1 atoms. Verify against live site. Fix any discrepancies.

---

## Task 4: Shared Components — Tier 2 Molecules

**Files:**
- Modify: `docs/design-system.pen`
- Reference: `web/components/EventCard.tsx`, `web/components/VenueCard.tsx`, `web/components/feed/FeedSectionHeader.tsx`, `web/components/feed/FeaturedCarousel.tsx`

- [ ] **Step 1: Read EventCard.tsx to extract exact layout**

Read `web/components/EventCard.tsx` and `web/components/event-card/*.tsx` to understand:
- Layout structure (grid with image rail, time display, content area, actions)
- Exact spacing values (p-3, gap-2.5, etc.)
- Typography assignments (title = text-base font-semibold, venue = text-sm, etc.)
- Border styling (border-l-[2px] accent color)
- Image rail dimensions (w-[100px])

- [ ] **Step 2: Build EventCard component in Pencil**

Build as reusable component matching the exact layout from Step 1:
- Full variant: image rail + time display + content + actions
- Compact variant: no image rail, condensed spacing
- Use variables for all colors, border colors, text colors
- Use auto-layout matching the Tailwind flex patterns

- [ ] **Step 3: Screenshot EventCard and compare against live site**

Use `get_screenshot` on the Pencil component. Open `localhost:3000/atlanta?view=happening` in browser for comparison. Adjust until they match.

- [ ] **Step 4: Build VenueCard component**

Read `web/components/VenueCard.tsx` for exact layout, then build:
- Image thumbnail (left), content area (right)
- Name, description, distance/price metadata, events count
- HOT badge variant
- Use variables for all visual properties

- [ ] **Step 5: Build FeaturedCard component**

Read `web/components/feed/FeaturedCarousel.tsx` for the inline FeaturedCard pattern:
- 288-320px wide, snap-start
- h-32 or h-44 image area with gradient overlay
- Title + metadata overlay at bottom
- rounded-card, shadow-card-sm, hover-lift border

- [ ] **Step 6: Build FeedSectionHeader component**

Read `web/components/feed/FeedSectionHeader.tsx`:
- Horizontal layout: icon (Phosphor, 14px) + title (mono-label) + spacer + see-all link
- Badge variant (optional count badge next to title)
- Accent color prop (coral, gold, neon-green, vibe per section type)

- [ ] **Step 7: Build MetadataGrid and SectionHeader**

- **MetadataGrid**: vertical list of label/value pairs. Label = mono/label style (muted), Value = body/base (cream)
- **SectionHeader**: border-t separator line (twilight) + mono/label text below. Used in detail pages.

- [ ] **Step 8: Screenshot all molecules and validate**

Screenshot each molecule. Compare against live site pages. Fix discrepancies.

---

## Task 5: Shared Components — Tier 3 Organisms

**Files:**
- Modify: `docs/design-system.pen`
- Reference: `web/components/detail/DetailHero.tsx`, `web/components/detail/InfoCard.tsx`, `web/components/detail/DetailStickyBar.tsx`

- [ ] **Step 1: Build DetailHero component**

Read `web/components/detail/DetailHero.tsx` for the three modes:
- **Image mode**: full-width image with gradient overlay, title + metadata on top
- **Poster mode**: side-by-side image + content
- **Fallback mode**: themed gradient background + icon + title
- Build all three as variants of one reusable component

- [ ] **Step 2: Build InfoCard component**

Simple container:
- border border-[var(--twilight)], bg-[var(--card-bg)], padding 24-32, rounded-card
- Content slot (placeholder: true) for child content
- Used to wrap sections on detail pages

- [ ] **Step 3: Build DetailStickyBar component**

Read `web/components/detail/DetailStickyBar.tsx`:
- Fixed bottom bar, full width
- bg-void with border-t twilight
- Left: event title (truncated), Right: CTA button (coral primary)
- Appears on scroll (but in Pencil, just show the bar)

- [ ] **Step 4: Build FeedSection component**

Composed organism:
- FeedSectionHeader at top
- Content area (placeholder: true) — accepts carousel cards or list rows
- Outer container with no background (transparent)

- [ ] **Step 5: Build MobileFilterSheet component**

Read `web/components/filters/MobileFilterSheet.tsx` and the Bottom Sheet recipe from `web/CLAUDE.md`:
- Backdrop: black/50 overlay
- Sheet: void bg, border-t twilight, rounded-t-2xl, max-h-[85vh]
- Drag handle: w-12 h-1 rounded-full bg-twilight
- Header: title (mono/lg, cream) + close X button
- Content: scrollable area with FilterChip grids
- Footer: sticky, border-t twilight, cancel (twilight bg) + apply (coral bg) buttons

On desktop (md+): renders as side panel (right-aligned, 420px wide, no rounded top).

- [ ] **Step 6: Build Modal component**

- Backdrop: black/60 overlay
- Panel: night bg, twilight border, rounded-xl, p-6, max-w-md
- Title: heading/xl, cream
- Footer slot for DialogFooter (cancel + primary buttons)

- [ ] **Step 7: Screenshot all organisms and validate**

Compare each against live site equivalents. DetailHero against venue detail page hero. InfoCard against venue detail content sections. Modal against any modal in the app (settings, etc.).

---

## Task 6: Atlanta Portal Pages

**Files:**
- Modify: `docs/design-system.pen`
- Reference: Figma captures at `https://www.figma.com/design/Te8s9LaC1o9KRQQyHzgyC7`

- [ ] **Step 1: Get Figma screenshots for reference**

First verify current node IDs (they may have changed if re-captures happened):

```
mcp__figma__get_metadata(fileKey: "Te8s9LaC1o9KRQQyHzgyC7", nodeId: "0:1")
```

Then capture screenshots of all pages. Expected node IDs (verify against metadata):
- Feed homepage (latest capture with content)
- Events view (expected: node 8:2)
- Places view (expected: node 9:2)
- Venue detail (expected: node 7:2)
- Neighborhoods (expected: node 6:2)

- [ ] **Step 2: Compose Feed Homepage (desktop 1440px)**

Build the Atlanta feed page from component library instances:
- Header (nav bar with logo, tabs, search)
- CityBriefing hero (full-width image, time-of-day headline, quick link pills)
- FeedSection instances (trending, tonight, coming up, regulars) with FeaturedCards and EventCards
- Footer

Use `find_empty_space_on_canvas` to place at a clean location. Frame size: 1440x auto-height.

- [ ] **Step 3: Compose Feed Homepage (mobile 375px)**

Duplicate the desktop feed and rebuild at 375px width:
- Stack layout, no sidebar
- Carousel cards scroll horizontally
- Mobile tab bar at bottom

- [ ] **Step 4: Compose Events View (desktop + mobile)**

From the Figma capture reference:
- Header with sub-tabs (Events, Regulars, Showtimes)
- Search bar
- Trending chips row
- Filter bar (Category, Upcoming, Filters)
- Timeline with EventCard list rows
- Desktop: 1440px. Mobile: 375px.

- [ ] **Step 5: Compose Places View (desktop + mobile)**

From the Figma capture reference:
- Header with sub-tabs (Eat & Drink, Things to Do, Nightlife)
- Search bar
- Occasion filter chips
- Filter row (All Areas, All Types, Open, Events, Near Me)
- VenueCard list
- Desktop: 1440px. Mobile: 375px.

- [ ] **Step 6: Compose Venue Detail page (desktop + mobile)**

From the Figma capture reference:
- DetailHero (image mode with High Museum photo)
- Exhibition/event listings
- "What's Here" section with InfoCards
- "Don't Miss" photo spots
- About section
- Related venues
- DetailStickyBar at bottom
- Desktop: 1440px (max-w-3xl centered). Mobile: 375px.

- [ ] **Step 7: Compose Neighborhoods page (desktop + mobile)**

From the Figma capture reference:
- Header
- "Popular" section — 4-column grid of neighborhood cards with name + place count
- "More Neighborhoods" section
- "Up-and-Coming" section
- Footer
- Desktop: 1440px. Mobile: 375px.

- [ ] **Step 8: Screenshot all pages and compare against Figma captures**

Side-by-side comparison. The Pencil pages should match the Figma captures closely (same content, same layout, same colors). Differences are acceptable only where the Pencil version improves on the captured state.

---

## Task 7: Code Connect + Rules Update

**Files:**
- Modify: `web/.claude/rules/figma-design-system.md`
- Reference: Figma file `Te8s9LaC1o9KRQQyHzgyC7`

- [ ] **Step 1: Discover mappable Figma components**

First, get current page/node IDs from the Figma file (they may have changed since initial capture):

```
mcp__figma__get_metadata(
  fileKey: "Te8s9LaC1o9KRQQyHzgyC7",
  nodeId: "0:1"
)
```

Then get Code Connect suggestions to find components that can be mapped:

```
mcp__figma__get_code_connect_suggestions(
  fileKey: "Te8s9LaC1o9KRQQyHzgyC7"
)
```

- [ ] **Step 2: Wire up Code Connect mappings**

Using the node IDs discovered in Step 1, send mappings via `mcp__figma__send_code_connect_mappings` or individual `mcp__figma__add_code_connect_map` calls:

| Figma Component | React | Import |
|---|---|---|
| Event Card | `EventCard` | `@/components/EventCard` |
| Venue Card | `VenueCard` | `@/components/VenueCard` |
| Badge | `Badge` | `@/components/ui/Badge` |
| Filter Chip | `FilterChip` | `@/components/filters/FilterChip` |
| Feed Section Header | `FeedSectionHeader` | `@/components/feed/FeedSectionHeader` |
| Detail Hero | `DetailHero` | `@/components/detail/DetailHero` |
| Detail Sticky Bar | `DetailStickyBar` | `@/components/detail/DetailStickyBar` |
| Featured Carousel | `FeaturedCarousel` | `@/components/feed/FeaturedCarousel` |

Each mapping requires the component's `nodeId` from Step 1 and the `fileKey` `Te8s9LaC1o9KRQQyHzgyC7`.

- [ ] **Step 3: Update design system rules with Pencil references**

Add a new section to `web/.claude/rules/figma-design-system.md`:

```markdown
## Pencil Design System

Design system file: `docs/design-system.pen`

When implementing or modifying shared components, reference the Pencil component
for the canonical design spec. Use `get_screenshot` on the component to verify
pixel-perfect match after implementation.

### Reading Pencil Components
1. Open the file: mcp__pencil__open_document("docs/design-system.pen")
2. Get component node IDs: mcp__pencil__batch_get(patterns: ["Badge", "EventCard", etc.])
3. Screenshot for reference: mcp__pencil__get_screenshot(nodeId: "<id>")
4. Implement following the design system rules in this file
```

- [ ] **Step 4: Test end-to-end flow**

Pick one component (e.g., Badge). Modify it in Pencil (change padding, font size). Then:
1. Screenshot the modified Pencil component
2. Implement the change in `web/components/ui/Badge.tsx`
3. Browser-test at localhost:3000
4. Compare browser rendering against Pencil screenshot
5. Verify pixel-perfect match

If the flow works, the design system is operational.

- [ ] **Step 5: Commit rules update**

```bash
git add web/.claude/rules/figma-design-system.md
git commit -m "docs: add Pencil design system references to Figma rules"
```

---

## Parking Lot: Phase 5 (Portal Themes)

Not planned in detail here — this is the "fast follow" after the foundation is proven. High-level:

1. Add Arts token set to Pencil variables (copper #C9874F, warm red #B54A3A, IBM Plex Mono, Playfair Display, 0px radius, stroke-only cards)
2. Add Adventure token set (terracotta #C45A3B, olive #6B8E5E, Space Grotesk, 0px radius, thick borders)
3. Add Family token set (field sage #5E7A5E, amber #C48B1D, Plus Jakarta Sans, DM Sans, rounded)
4. Add Citizen token set (teal #2D6A4F, light cream, system fonts, rounded)
5. Switch shared components to each theme mode and screenshot to validate transformations
6. Build portal-specific components (ExhibitionCard, TrailCard, ProgramCard, etc.)
7. Build first distribution template (FORTH hotel variant)

Each portal theme is its own task, parallelizable once the shared foundation is stable.
