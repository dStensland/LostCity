# Portal Themes Design System — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Validate portal theme transformations on shared components, build portal-specific components and signature pages for each consumer portal, and create the first distribution template.

**Architecture:** Extends the existing Pencil design system (`docs/design-system.pen`) with 25 reusable components and 32 themed variables on the `portal` axis (atlanta, arts, adventure, family, citizen). Each portal gets its own section with unique components and pages.

**Tech Stack:** Pencil MCP (`batch_design`, `set_variables`, `get_screenshot`), existing design system variables and components.

**Spec:** `docs/superpowers/specs/2026-03-22-pencil-figma-design-system.md` (Phase 5)

**Prerequisite:** Phase 1-4 complete. Design system file open in Pencil editor.

---

## Task 1: Validate Theme Transformations

**Purpose:** Screenshot every shared component under each portal theme. Confirm the theming system actually produces 5 visually distinct and coherent designs.

- [ ] **Step 1: Create a theme validation frame**

Find empty canvas space (2400x2000, direction: "right", padding: 300). Create a frame titled "PORTAL THEME VALIDATION".

- [ ] **Step 2: Build a 5-column theme showcase**

For each of these shared components, create 5 instances side-by-side, each with a different portal theme:

| Component | ID |
|---|---|
| Badge | I7NUV |
| FilterChip | olqzW |
| Button | GBoOR |
| EventCard | ViqPG |
| FeedSectionHeader | v1ON6 |
| FeaturedCard | CX6oB |

Layout:
- Column headers: "ATLANTA", "ARTS", "ADVENTURE", "FAMILY", "CITIZEN" (mono/label style)
- Row label on left: component name
- Each cell: component instance with `theme: {"portal": "<mode>"}`

```javascript
// Example for Badge row
atl_badge=I(row, {type: "ref", ref: "I7NUV", theme: {"portal": "atlanta"}})
arts_badge=I(row, {type: "ref", ref: "I7NUV", theme: {"portal": "arts"}})
adv_badge=I(row, {type: "ref", ref: "I7NUV", theme: {"portal": "adventure"}})
fam_badge=I(row, {type: "ref", ref: "I7NUV", theme: {"portal": "family"}})
cit_badge=I(row, {type: "ref", ref: "I7NUV", theme: {"portal": "citizen"}})
```

- [ ] **Step 3: Screenshot and evaluate**

Screenshot the full validation grid. For each portal column, verify:
- **Atlanta**: Coral accents, Outfit font, 12px rounded corners
- **Arts**: Copper (#C9874F) accents, IBM Plex Mono/Space Grotesk, 0px sharp corners, stroke-style cards
- **Adventure**: Terracotta (#C45A3B) accents, Space Grotesk, 0px sharp corners, thick 2px borders
- **Family**: Field sage (#5E7A5E) accents, Plus Jakarta Sans/DM Sans, 12px rounded corners
- **Citizen**: Teal (#2D6A4F) accents, Inter, 12px rounded corners

Document any themes that look wrong or need variable adjustments.

- [ ] **Step 4: Fix any theme issues**

If any portal's components look wrong (wrong colors, fonts not switching, radii not changing), debug and fix the variables via `set_variables`. Re-screenshot to confirm.

---

## Task 2: Arts Portal — Components + Signature Page

**Design language:** Underground gallery aesthetic. Dark warm canvas (#141210), copper accent (#C9874F), warm red urgency (#B54A3A). IBM Plex Mono for body/labels, Playfair Display italic for exhibition titles, Space Grotesk for headings. Zero corner radius. Stroke-defined cards (no fill). `// code comment` style section headers. Art provides the only color.

**Reference:** Memory entry "Arts portal (Lost City: Arts)" — exhibition-first, Living CV, Open Calls, Studio Map.

- [ ] **Step 1: Build ExhibitionCard component**

Reusable component for art exhibitions:
- Frame: width ~700, horizontal layout, stroke `$accent/coral` (copper in arts theme), border-width `$shape/border-width`, cornerRadius `$shape/card-radius` (0 in arts), fill transparent (stroke-only in arts theme)
- Left: image area, 160x120, fill `$surface/dusk` (exhibition artwork placeholder)
- Right: vertical layout, padding 16, gap 8
  - Title: exhibition name in Playfair Display italic (`$font/accent`), 18px, 500, cream — e.g., "Hamu Noguchi, 'I am not a designer'"
  - Date range: "Jun 16, 2026 — Aug 3, 2026" (font `$font/mono`, 11px, muted)
  - Type badge: Badge instance with "EXHIBITION" label
  - Venue: "High Museum of Art" (font `$font/body`, 13px, soft)

- [ ] **Step 2: Build ArtistProfile component**

- Frame: horizontal layout, gap 16, padding 16, stroke `$surface/twilight`, cornerRadius `$shape/card-radius`
- Left: avatar circle, 64x64, rounded-full, fill `$surface/dusk`
- Right: vertical layout, gap 4
  - Name: "Amy Sherald" (`$font/display`, 18px, 600, cream)
  - Medium: "Painting · Portraiture" (`$font/body`, 13px, soft)
  - Stats row: "12 exhibitions · 4 venues" (`$font/mono`, 11px, muted)

- [ ] **Step 3: Build OpenCallCard component**

- Frame: vertical layout, padding 16, gap 12, stroke `$accent/gold` (warm red in arts), cornerRadius `$shape/card-radius`
- Top row: "OPEN CALL" badge (warm red/urgent) + deadline "Closes Mar 30" (mono, muted)
- Title: "Emerging Artists Residency" (`$font/display`, 15px, 600, cream)
- Org: "Atlanta Contemporary" (`$font/body`, 13px, soft)
- Details: "Painting, Sculpture, Mixed Media" (`$font/mono`, 11px, muted)
- CTA: Button instance "Apply →"

- [ ] **Step 4: Compose Arts Feed page (desktop 1440px + mobile 375px)**

Create "Arts Feed — Desktop" (1440px) with arts portal theme:
- All shared component instances use `theme: {"portal": "arts"}`
- Header: "LOST ARTS" branding, mono typography, sharp styling
- Section header style: `// EXHIBITIONS` (code comment aesthetic)
- Content sections:
  1. Featured exhibitions carousel (3 ExhibitionCards)
  2. "// NOW SHOWING" — list of ExhibitionCards
  3. "// OPEN CALLS" — 2-3 OpenCallCards with deadline urgency
  4. "// ARTISTS" — 3 ArtistProfile cards
- Footer with arts branding

Mobile version (375px): same content stacked, MobileHeader, MobileTabBar.

- [ ] **Step 5: Screenshot and verify arts aesthetic**

The arts pages should feel completely different from Atlanta — monospace typography, sharp corners, stroke-only cards, copper/warm-red accents, Playfair Display for exhibition titles. No rounded corners anywhere.

---

## Task 3: Adventure Portal — Components + Signature Page

**Design language:** Nordic Brutalist. Space Grotesk, terracotta #C45A3B primary, olive #6B8E5E secondary, warm cream #F5F2ED light accent. Sharp corners (0px), heavy 2px borders. Rugged, outdoor feel.

**Reference:** Memory — destinations-first, commitment filter (hour/halfday/fullday/weekend), conditions intelligence.

- [ ] **Step 1: Build TrailCard component**

- Frame: horizontal layout, stroke `$accent/coral` (terracotta in adventure), border-width `$shape/border-width` (2px), cornerRadius `$shape/card-radius` (0), fill `$surface/night`
- Left: image area 140x100, fill `$surface/dusk` (trail photo placeholder)
- Right: vertical layout, padding 16, gap 6
  - Name: "Sweetwater Creek State Park" (`$font/display`, 15px, 700, cream)
  - Distance: "45 min · West of Atlanta" (`$font/body`, 13px, soft)
  - Commitment badge row: Badge "HALF DAY" + Badge "MODERATE"
  - Conditions: "Trail: Dry · 72°F · Clear" (`$font/mono`, 11px, neon-green)

- [ ] **Step 2: Build CommitmentFilter component**

Horizontal row of 4 chunky filter buttons:
- "1 HOUR", "HALF DAY", "FULL DAY", "WEEKEND"
- Each: frame, padding [12, 20], `$shape/card-radius` (0 = sharp), stroke `$surface/twilight`, border-width `$shape/border-width` (2px), font `$font/mono` 11px bold uppercase
- Active state: fill `$accent/coral` (terracotta), text `$surface/void`

- [ ] **Step 3: Compose Adventure Destinations page (desktop + mobile)**

"Adventure Destinations — Desktop" (1440px) with adventure theme:
- Header: "LOST TRACK" branding, heavy borders, Space Grotesk
- CommitmentFilter row at top
- "NEARBY" section: 3 TrailCards within 30 min
- "WORTH THE DRIVE" section: 3 TrailCards 1-2 hrs
- "WEEKEND TRIPS" section: 2 TrailCards (overnight)
- Conditions sidebar or banner: weather/trail conditions summary

Mobile (375px): stacked, commitment filter scrolls horizontally.

- [ ] **Step 4: Screenshot and verify adventure aesthetic**

Should feel rugged and bold — thick borders, sharp corners, terracotta/olive palette, Space Grotesk throughout. No rounded corners, no glow.

---

## Task 4: Family Portal — Components + Signature Page

**Design language:** "Afternoon Field" warmth. Plus Jakarta Sans display, DM Sans body. Field sage #5E7A5E primary, amber #C48B1D accent, pale grass #F0EDE4 canvas. Rounded badges, warm feel. Light theme (note: this portal uses a LIGHT background unlike the others).

**Reference:** Memory — programs entity, per-kid profiles, school calendar, COPPA safe.

- [ ] **Step 1: Add light-theme surface variables for Family**

The Family portal uses a light background, unlike the dark defaults. Update surface variables to include family-specific overrides:

```
set_variables (merge, not replace):
  "surface/void": add theme {"portal": "family"} → "#F0EDE4" (pale grass)
  "surface/night": add theme {"portal": "family"} → "#FFFFFF" (white cards)
  "surface/dusk": add theme {"portal": "family"} → "#F5F2ED" (warm cream elevated)
  "surface/twilight": add theme {"portal": "family"} → "#E0DDD5" (warm border)
  "text/cream": add theme {"portal": "family"} → "#1A1A1A" (dark text on light)
  "text/soft": add theme {"portal": "family"} → "#666666" (medium gray)
  "text/muted": add theme {"portal": "family"} → "#999999" (light gray)
```

**IMPORTANT:** Use careful merge — do NOT lose existing theme values for other portals. May need to read current variables first, then set the full themed value arrays including the new family entries.

- [ ] **Step 2: Build ProgramCard component**

- Frame: vertical layout, padding 16, gap 12, cornerRadius `$shape/card-radius` (12px), fill `$surface/night` (white in family), stroke `$surface/twilight`
- Image area: height 120, rounded 8px, fill `$surface/dusk` (placeholder for program photo)
- Title: "Summer Art Camp" (`$font/display`, 15px, 600, cream → dark text in family)
- Org: "High Museum of Art" (`$font/body`, 13px, soft)
- Details row: "Ages 6-10" Badge + "Jun 1 - Aug 15" + "$225/week"
- CTA: "Learn More →" (`$font/mono`, 11px, accent/coral → sage in family)

- [ ] **Step 3: Build SchoolCalendarRow component**

- Frame: horizontal layout, padding [12, 16], gap 12, cornerRadius `$shape/card-radius`, fill `$surface/night`, stroke `$surface/twilight`, align center
- Left: date badge — vertical, align center, fill `$accent/gold` (amber in family), cornerRadius 8, padding [4, 8]
  - Month: "MAR" (`$font/mono`, 10px, 700, void)
  - Day: "15" (`$font/display`, 20px, 700, void)
- Right: vertical, gap 2
  - Event: "Teacher Workday — No School" (`$font/display`, 15px, 600, cream)
  - District: "Atlanta Public Schools" (`$font/body`, 13px, soft)
  - Tag: Badge "SCHOOL BREAK"

- [ ] **Step 4: Compose Family Feed page (desktop + mobile)**

"Family Feed — Desktop" (1440px) with family theme:
- Light background throughout (pale grass #F0EDE4)
- Header: "LOST YOUTH" branding, warm sage/amber palette, Plus Jakarta Sans
- Hero: warm, inviting image — playful feel
- "PROGRAMS STARTING SOON" — 3 ProgramCards in carousel
- "SCHOOL CALENDAR" — upcoming SchoolCalendarRows (teacher workdays, breaks)
- "THIS WEEKEND WITH KIDS" — FeedSection with EventCards themed to family
- Footer

Mobile (375px): same, stacked layout. Light theme throughout.

- [ ] **Step 5: Screenshot and verify family aesthetic**

Must feel completely different: LIGHT background, warm colors, rounded badges, friendly fonts. Should feel inviting and parental, not nightlife-dark. The sage/amber palette should dominate.

---

## Task 5: Citizen Portal — Components + Signature Page

**Design language:** Editorial civic. Teal #2D6A4F primary, light cream canvas. System fonts (Inter). Rounded corners. Clean, trustworthy, governmental feel. Light theme.

**Reference:** Memory — HelpATL civic portal, meetings, volunteer ops, data-theme="light".

- [ ] **Step 1: Add light-theme surface variables for Citizen**

Similar to Family, Citizen uses a light background:

```
  "surface/void": add theme {"portal": "citizen"} → "#FAFAF8" (light cream)
  "surface/night": add theme {"portal": "citizen"} → "#FFFFFF" (white cards)
  "surface/dusk": add theme {"portal": "citizen"} → "#F5F5F0" (elevated)
  "surface/twilight": add theme {"portal": "citizen"} → "#E0E0D8" (borders)
  "text/cream": add theme {"portal": "citizen"} → "#1A2E1A" (dark teal-tinted text)
  "text/soft": add theme {"portal": "citizen"} → "#4A5A4A" (medium)
  "text/muted": add theme {"portal": "citizen"} → "#7A8A7A" (light)
```

- [ ] **Step 2: Build CivicHero component**

- Frame: width fill, padding [24, 32], vertical layout, gap 12, fill `$surface/night` (white in citizen), stroke left 3px `$accent/coral` (teal in citizen), cornerRadius `$shape/card-radius`
- Category label: "CIVIC ENGAGEMENT" (`$font/mono`, 11px, accent/coral → teal, uppercase)
- Headline: "Atlanta City Council meets Tuesday at 1pm" (`$font/display`, 24px, 600, cream → dark text)
- Subtext: "3 agenda items affect your neighborhood" (`$font/body`, 15px, soft)
- Quick links row: 3 FilterChip instances ("Watch Live", "Agenda", "Public Comment")

- [ ] **Step 3: Build MeetingCard component**

- Frame: horizontal layout, padding 16, gap 16, cornerRadius `$shape/card-radius`, fill `$surface/night`, stroke `$surface/twilight`
- Left: date/time vertical block
  - Day: "TUE" (`$font/mono`, 11px, 700, muted, uppercase)
  - Date: "25" (`$font/display`, 24px, 700, cream)
  - Time: "1:00 PM" (`$font/mono`, 11px, muted)
- Right: vertical, gap 4
  - Title: "City Council Regular Meeting" (`$font/display`, 15px, 600, cream)
  - Location: "Atlanta City Hall, Council Chambers" (`$font/body`, 13px, soft)
  - Tags: Badge "PUBLIC COMMENT" + Badge "LIVESTREAM"

- [ ] **Step 4: Compose Citizen Feed page (desktop + mobile)**

"Citizen Feed — Desktop" (1440px) with citizen theme:
- Light background throughout
- Header: "LOST CITIZEN" branding, teal accents, clean editorial feel
- CivicHero at top (featured meeting/issue)
- "UPCOMING MEETINGS" — 3 MeetingCards
- "VOLUNTEER OPPORTUNITIES" — EventCards themed to citizen (volunteer events)
- "YOUR REPRESENTATIVES" — simple info cards
- Footer

Mobile (375px): stacked, light theme.

- [ ] **Step 5: Screenshot and verify citizen aesthetic**

Light, editorial, trustworthy. Teal accents, clean typography, no neon/nightlife energy. Should feel like a civic newspaper, not an events app.

---

## Task 6: Distribution Template — FORTH Hotel

**Design language:** Inherits shared components with client branding. For FORTH: warm hospitality palette — could be navy/gold, terracotta/cream, or whatever the hotel brand dictates. Uses the same page structure as Atlanta but with concierge focus.

- [ ] **Step 1: Add FORTH theme mode to variables**

Add a new portal mode "forth" to the themed variables:

```
accent/coral: #1B3A5C (navy blue — hospitality)
accent/gold: #C5A55A (warm gold)
font/display: "Playfair Display" (elegant serif)
font/body: "Inter" (clean body)
font/mono: "JetBrains Mono"
shape/card-radius: 8 (slightly less rounded)
shape/border-width: 1
```

Surface colors: light theme for hospitality
```
surface/void: #FAF9F7 (warm white)
surface/night: #FFFFFF (white cards)
surface/twilight: #E8E4DE (warm borders)
text/cream: #1A1A1A (dark text)
text/soft: #666660 (warm gray)
text/muted: #99998A (light warm gray)
```

- [ ] **Step 2: Compose Distribution Feed page (desktop + mobile)**

"FORTH Feed — Desktop" (1440px) with forth theme:
- Light, elegant, hospitality feel
- Header: "FORTH" branding (client logo area), Playfair Display, navy/gold
- Hero: "Tonight in Atlanta" — concierge-curated highlight
- "GUEST PICKS" — FeaturedCard carousel (curated events)
- "DINING TONIGHT" — VenueCards for restaurants
- "HAPPENING NEARBY" — EventCards for hotel vicinity events
- Simplified footer with hotel branding

Mobile (375px): concierge-optimized, large tap targets, simplified navigation.

- [ ] **Step 3: Screenshot and verify distribution aesthetic**

Must feel like a completely different product from Lost City — elegant, hospitality-branded, concierge-focused. The navy/gold/serif combination should feel upscale. No coral, no neon, no nightlife energy.

- [ ] **Step 4: Update design system rules**

Add new portal theme modes and component IDs to `web/.claude/rules/figma-design-system.md`:
- FORTH theme values
- Family/Citizen light-theme surface overrides
- New portal-specific component IDs (ExhibitionCard, TrailCard, ProgramCard, etc.)
- Distribution template page IDs

---

## Task 7: Final Validation + Cleanup

- [ ] **Step 1: Delete spike artifacts**

Remove the test frames from Task 0 spike (IDs: QtstG, W5ZYe, vouL1, fhTVq, 39z97, tlpGe, xnMtS) that are still on the canvas.

- [ ] **Step 2: Organize canvas layout**

Ensure the canvas is cleanly organized:
- Top-left: Reference frames (Color Palette, Typography, Spacing, Shadows)
- Below: Component library (Tier 1, 2, 3)
- Right section: Atlanta portal pages
- Below right: Arts, Adventure, Family, Citizen portal sections
- Far right: Distribution template (FORTH)
- Theme validation grid in its own area

- [ ] **Step 3: Full theme validation screenshot**

Take a wide screenshot showing the entire design system. Export for documentation.

- [ ] **Step 4: Commit rules update**

```bash
git add web/.claude/rules/figma-design-system.md
git commit -m "docs: add portal themes and distribution template to design system rules"
```
