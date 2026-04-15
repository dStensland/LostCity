# Design Handoff Skill — Design Spec

**Date:** 2026-04-15
**Goal:** Bridge the gap between Pencil design comps and code implementation by extracting visual specs and verifying pixel fidelity
**Approach:** Single skill with two subcommands (`extract` and `verify`) orchestrating Pencil MCP + Chrome browser automation

---

## 1. Problem

Pencil design comps are created but never translated into specs that implementation agents can consume. The .pen format requires MCP tools to read — subagents can't access it. Result: designs are ignored, agents rebuild old code in new files, visual fidelity is lost.

## 2. Skill Interface

**Skill name:** `design-handoff`
**Location:** `.claude/skills/design-handoff/SKILL.md`

### Subcommands

- `/design-handoff extract <node-id-or-name>` — Extract a Pencil comp into a visual spec document
- `/design-handoff verify <spec-or-node-id> <url>` — Compare a live page against a Pencil comp or spec
- `/design-handoff extract --all <pattern>` — Extract all comps matching a name pattern (e.g., "v2 /"). Iterates each match through the single-node extract flow sequentially.

### Arguments

- `node-id-or-name`: Either a Pencil node ID (e.g., `LhPKq`) or a name search string (e.g., `"Event Concert"`)
- `url`: A URL or route path to screenshot (e.g., `http://localhost:3000/atlanta?e=123` or `/atlanta?e=123`)
- `spec-or-node-id`: Either a path to an existing spec file or a Pencil node ID to screenshot fresh

---

## 3. Extract Flow

### Input
- Pencil node ID or name search
- Optional: .pen file path (defaults to `docs/design-system.pen`)

### Process

1. **Resolve the node.** If a name is given, use `batch_get` with `patterns: [{ name: "..." }]` to find the node ID.

2. **Screenshot the comp.** Use `get_screenshot(nodeId)` to capture the visual reference. Save the screenshot image to `docs/design-specs/screenshots/{name}.png`.

3. **Read the node tree.** Use `batch_get(nodeIds: [id], readDepth: 4)` to get the component hierarchy. **Check for truncation:** if any children in the result are `"..."`, issue follow-up `batch_get` calls with those specific node IDs at `readDepth: 3` to get the deeper content. Repeat until no truncation remains. For page-level comps (>5 levels deep), start with `readDepth: 2` to get section IDs, then `batch_get` each section individually at `readDepth: 3`.

4. **Read design variables.** Use `get_variables()` to get the Pencil variable → value mapping (e.g., `$surface/night` → `#0F0F14`). Note: some Pencil variables are aliases that don't map by name transformation — `$semantic/card-bg` maps to `var(--night)`, not `var(--card-bg)`. Use this alias table for known exceptions:

   | Pencil Variable | CSS Token |
   |----------------|-----------|
   | `$semantic/card-bg` | `var(--night)` |
   | `$semantic/card-bg-hover` | `var(--dusk)` |
   | `$semantic/action-primary` | `var(--coral)` |

   For themed variables (where `get_variables` returns multiple values across the `portal` theme axis), flag the property as `(themed: varies by portal)` so implementation agents use the CSS custom property, not the hardcoded hex.

5. **Walk the tree and extract CSS.** For each node in the tree, extract:

   **Layout:**
   - `layout` → `display: flex; flex-direction: row|column`
   - `gap` → `gap: {n}px`
   - `padding` → `padding: {t}px {r}px {b}px {l}px`
   - `justifyContent` → `justify-content: flex-start|center|flex-end|space-between|space-around`
   - `alignItems` → `align-items: flex-start|center|flex-end`

   **Size:**
   - `width` / `height` → numeric: `width: {n}px`, `fill_container`: `width: 100%`, `fit_content`: `width: fit-content`

   **Positioning:**
   - `layoutPosition: "absolute"` → `position: absolute` with `x`/`y` mapped to `left`/`top`
   - For absolute nodes, note the positioning context: `{absolute, relative to: [parent name]}`
   - `layoutPosition: "auto"` or absent → normal flow (no position property needed)

   **Visual:**
   - `fill` (string/variable) → resolve via variable map, output `background: var(--token) (#hex)`
   - `fill` (gradient object) → map to CSS gradient:
     - `gradientType: "linear"` → `background: linear-gradient({rotation}deg, {color1} {pos1*100}%, {color2} {pos2*100}%, ...)`
     - `gradientType: "radial"` → `background: radial-gradient(...)`
     - Include ALL color stops, not just first and last
   - `fill` (image object) → `background: image-fill ({mode})` where mode is stretch/fill/fit
   - Multiple fills (array) → list each on its own line, in order (last paints on top)
   - `stroke` → `border: {thickness}px solid {color}` with align (inside/outside/center)
   - `cornerRadius` → `border-radius: {n}px` (or per-corner)
   - `opacity` → `opacity: {n}`
   - `clip` → `overflow: hidden`

   **Typography (text nodes):**
   - `fontFamily` → `font-family: {name}`
   - `fontSize` → `font-size: {n}px`
   - `fontWeight` → `font-weight: {n}`
   - `letterSpacing` → `letter-spacing: {n}px`
   - `lineHeight` → `line-height: {n}`
   - `textAlign` → `text-align: left|center|right`
   - `content` → the actual text content
   - `fill` on text → `color: var(--token) (#hex)`

   **Icons (icon_font nodes):**
   - `iconFontFamily` + `iconFontName` → `Icon: {family} {name}`
   - `width`/`height` → `size: {n}px`
   - `fill` → `color: var(--token) (#hex)`

   **Effects/Shadows:**
   - `effect` with `type: "shadow"` → `box-shadow: {offset.x}px {offset.y}px {blur}px {spread}px {color}`
   - `shadowType: "inner"` → `box-shadow: inset ...`
   - `effect` with `type: "blur"` → `filter: blur({radius}px)`
   - `effect` with `type: "background_blur"` → `backdrop-filter: blur({radius}px)`

6. **Detect component instances.** When the tree contains `ref` nodes (Pencil component instances), check if the `ref` ID matches a known design system component (see Pencil Component IDs table in `web/.claude/rules/figma-design-system.md`). If it matches, emit a component reference instead of inlining the subtree:

   ```
   [ref → Badge (I7NUV)] LiveBadge
     overrides: content="LIVE NOW", fill=#FF6B7A
   ```

   This tells the implementation agent to use `<Badge>` rather than rebuild the component from raw elements.

7. **Generate the spec document.** Markdown format with:
   - Title + screenshot reference
   - Component tree with indentation showing hierarchy
   - Per-element CSS properties
   - Variable resolution showing both token name and hex fallback

8. **Save.** Write to `docs/design-specs/{kebab-name}.md`

### Output Format

Uses indented block format (not markdown headings) to handle deep component trees without hitting the 6-level heading limit.

```markdown
# {Comp Name}

**Source:** `{pen-file-path}` node `{node-id}`
**Extracted:** {date}

![Reference](screenshots/{kebab-name}.png)

---

## Component Tree

[frame] Root: {name}
  width: 375px
  background: var(--void) (#09090B)
  layout: vertical
  overflow: hidden

  [frame] Hero
    width: 100%; height: 220px
    background: image-fill
    position: relative

    [frame] GradientOverlay  {absolute, fills parent}
      background: linear-gradient(0deg, transparent 30%, #09090BEE 100%)

    [frame] LiveBadge  {absolute, top: 12px, left: 16px}
      background: var(--coral) (#FF6B7A)
      border-radius: 4px
      padding: 3px 8px
      layout: horizontal; gap: 4px; align-items: center

      [ellipse] Dot
        width: 6px; height: 6px
        background: #FFFFFF

      [text] Label
        content: "LIVE NOW"
        font-family: JetBrains Mono; font-size: 9px; font-weight: 700
        letter-spacing: 1px
        color: #FFFFFF

  [frame] Identity
    width: 100%
    padding: 16px 16px 12px 16px
    layout: vertical; gap: 8px

    [text] Title
      content: "Khruangbin"
      font-family: Outfit; font-size: 26px; font-weight: 700
      color: var(--cream) (#F5F5F3)

    ...

---

## States

Interactive elements need explicit state definitions. Extract from Pencil if variants exist, otherwise annotate manually.

### CTA Button (Get Tickets)
- default: background: var(--coral); color: #FFFFFF
- hover: background: var(--coral)/90; transform: translateY(-1px)
- active: background: var(--coral)/80; transform: none
- disabled: opacity: 0.5; pointer-events: none

### Secondary Action Button (Save, Share, etc.)
- default: border: 1px solid var(--twilight); color: var(--soft)
- hover: background: var(--twilight)/50; color: var(--cream)

---

## Shadows

Extract any shadow/effect properties from nodes. Map to the design system shadow tokens.

- Card surfaces: box-shadow: 0 2px 8px rgba(0,0,0,0.3)
- Elevated surfaces: box-shadow: 0 8px 24px rgba(0,0,0,0.5)
- (Use shadow-card-sm/md/lg utility classes when available)

---

## Responsive Notes

The comp is extracted at {width}px. Note any known breakpoint behavior:

- Desktop (≥1024px): sidebar + content two-column layout via DetailShell
- Mobile (<1024px): stacks vertically, sidebar above content
- (Manual annotation — Pencil comps are single-breakpoint)

---

## Implementation Constraint

**Do not add any CSS property not listed in this spec.** If an element needs a property that is not documented here (hover state, shadow, transition, z-index), stop and ask rather than improvising. The spec is the ceiling, not the floor.
```

### Conventions

- Use indented block format with `[type] Name` for each node
- Indent 2 spaces per tree level — handles arbitrary depth without heading limits
- `{absolute, ...}` annotations after the name for positioning context
- Show resolved variable values inline: `var(--token) (#hex)`
- For `fill_container` sizing, output `width: 100%`
- For `fit_content` sizing, output `width: fit-content`
- Omit default/zero values (don't list `opacity: 1` or `border-radius: 0`)
- For image fills, output `background: image-fill` (don't embed the URL)
- For gradient fills, output the full gradient spec with all stops
- For shadow/effects, extract the full `box-shadow` or `filter` spec
- Include a `## States` section for interactive elements (hover, active, focus, disabled)
- Include a `## Shadows` section listing all shadow values used
- Include a `## Responsive Notes` section (manual annotation, Pencil is single-breakpoint)
- Include the implementation constraint ("do not improvise") at the bottom of every spec

---

## 4. Verify Flow

### Input
- Reference: either a spec file path (uses its screenshot) or a Pencil node ID (screenshots fresh)
- URL to compare against

### Process

1. **Get the reference image.** Either read the spec file and find the screenshot path, or screenshot the Pencil node fresh.

2. **Screenshot the live page.** Use Chrome browser automation:
   - `tabs_create_mcp` to open a new tab
   - `navigate` to the URL
   - Wait for page to load
   - `get_screenshot` or use the computer tool to capture
   - For mobile comparison, `resize_window` to 375px width first

3. **Capture full page.** For pages longer than one viewport, scroll down and capture additional screenshots at each viewport-height increment. Label each: "viewport 1 (top)", "viewport 2 (middle)", "viewport 3 (bottom)". Compare each viewport segment against the corresponding region of the Pencil comp.

4. **Compare visually.** The agent (itself) receives both images and analyzes differences. This is prose-based visual comparison, not pixel-diffing. Note: visual comparison is reliable for structural and typography differences, reasonably accurate for spacing >4px, and unreliable for subtle color differences or sub-4px spacing. Flag uncertain comparisons as "needs manual check" rather than guessing.

5. **Output a structured diff.** Categorized by severity:

   - **Critical:** Wrong font, wrong color, missing element, wrong layout direction, broken hierarchy
   - **Major:** Wrong spacing (>4px off), wrong icon, wrong border treatment, wrong border-radius
   - **Minor:** Slightly different spacing (<4px), opacity differences, animation differences
   - **Needs manual check:** Subtle color differences, sub-4px spacing, shadow presence
   - **Match:** Elements that are correct

6. **Save the report.** Write to `docs/design-specs/verify/{name}-{date}.md` with both screenshots embedded.

### Output Format

```markdown
# Visual Verification: {Comp Name}

**Reference:** {source}
**Live:** {url}
**Date:** {date}
**Viewport:** {width}x{height}

## Reference
![Pencil comp](screenshots/{name}.png)

## Live
![Live page](screenshots/{name}-live.png)

## Discrepancies

### Critical
- **Section headers:** Live uses 14px regular weight. Spec: 11px JetBrains Mono 500 uppercase tracking 1.5px.
- **Connection rows:** Missing gold accent border on festival connection.

### Major
- **Identity padding:** Live has ~24px horizontal. Spec: 16px.
- **CTA button:** Live uses rounded-lg (~8px). Spec: 22px (pill shape).

### Minor
- **Genre pill gap:** Live ~8px. Spec: 6px.

### Correct
- Hero gradient direction and opacity ✓
- Title font-family and size ✓
- Venue icon color (coral) ✓
- Action button grid layout ✓
```

---

## 5. File Structure

```
.claude/skills/design-handoff/
└── SKILL.md

docs/design-specs/
├── screenshots/          (generated screenshots)
│   ├── event-concert-mobile.png
│   ├── event-concert-mobile-live.png
│   └── ...
├── event-concert-mobile.md   (extracted specs)
├── place-cinema-mobile.md
└── verify/               (verification reports)
    └── event-concert-mobile-2026-04-15.md
```

---

## 6. Integration with Implementation Workflow

The extracted spec files become part of the implementation prompt:

```
"Build SectionHeader to match this design spec.

[paste contents of docs/design-specs/section-header.md]

The reference screenshot is at docs/design-specs/screenshots/section-header.png
— read it for visual reference."
```

Implementation agents receive:
1. The screenshot (they can see images via the Read tool)
2. The exact CSS values (they can implement without guessing)
3. The component hierarchy (they know what to build)

After implementation, `/design-handoff verify` closes the loop.

---

## 7. Design System Variable Resolution

The skill maintains a mapping from Pencil variable names to CSS custom properties:

| Pencil Variable | CSS Property | Hex Value |
|----------------|-------------|-----------|
| `$surface/void` | `var(--void)` | `#09090B` |
| `$surface/night` | `var(--night)` | `#0F0F14` |
| `$surface/dusk` | `var(--dusk)` | `#18181F` |
| `$surface/twilight` | `var(--twilight)` | `#252530` |
| `$text/cream` | `var(--cream)` | `#F5F5F3` |
| `$text/soft` | `var(--soft)` | `#A1A1AA` |
| `$text/muted` | `var(--muted)` | `#8B8B94` |
| `$accent/coral` | `var(--coral)` | `#FF6B7A` |
| `$accent/gold` | `var(--gold)` | `#FFD93D` |
| `$accent/neon-green` | `var(--neon-green)` | `#00D9A0` |
| `$accent/neon-cyan` | `var(--neon-cyan)` | `#00D4E8` |
| `$accent/vibe` | `var(--vibe)` | `#A78BFA` |
| `$semantic/card-bg` | `var(--night)` | `#0F0F14` |
| `$shape/card-radius` | `12px` | — |
| `$shape/chip-radius` | `9999px` | — |
| `$spacing/base` | `16px` | — |

This mapping is derived at runtime from `get_variables()` — not hardcoded. The table above is for reference only.

---

## 8. Verify-Blocks-Ship Rule

The verify flow is not optional documentation — it is a quality gate.

**The rule:** No implementation is "done" until `/design-handoff verify` produces a report with zero Critical and zero Major discrepancies. Minor discrepancies are acceptable and can be tracked for later cleanup.

This should be enforced in the implementation workflow:
1. Implementation agent builds from the extracted spec
2. `/design-handoff verify` runs against the live page
3. If Critical or Major issues → implementation agent fixes → verify again
4. Only when verify passes → mark task complete

Without this gate, the extract flow produces specs that get ignored the same way the Pencil comps did.
