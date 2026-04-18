---
description: Extract visual specs from Pencil comps and verify implementation fidelity. Use when handing off designs to implementation agents or checking if built code matches the design. Commands - `/design-handoff extract <node-id-or-name>` to generate CSS spec from Pencil, `/design-handoff verify <spec-or-node-id> <url>` to compare live page against design.
---

# Design Handoff

$ARGUMENTS

**First read:** root `CLAUDE.md` → `docs/design-truth.md`. Before extracting, confirm the Pencil node maps to a registry entry; if it doesn't, flag it — new patterns need justification, not drive-by registry additions.

## Usage

- `/design-handoff extract <node-id-or-name>` — Extract a Pencil comp into a visual spec with CSS values + screenshot
- `/design-handoff extract --all <pattern>` — Extract all comps matching a name pattern
- `/design-handoff verify <spec-or-node-id> <url>` — Compare live page against Pencil comp, output discrepancies

## Overview

This skill bridges Pencil design comps and code implementation. It solves the problem where designs exist in .pen files that implementation agents can't read, resulting in agents ignoring designs and rebuilding from old code.

**Two flows:**
1. **Extract** — reads a Pencil comp via MCP tools, generates a markdown visual spec with raw CSS values + screenshot
2. **Verify** — screenshots a live page, compares visually against the Pencil comp, outputs a structured diff with severity ratings

---

## Extract Flow

### Step 1: Resolve the Pencil Node

Load the Pencil MCP tools first (`ToolSearch` for `mcp__pencil__batch_get`, `mcp__pencil__get_screenshot`, `mcp__pencil__get_variables`).

**If argument is a node ID** (5-char alphanumeric like `LhPKq`): use directly.

**If argument is a name** (like `"Event Concert"`): search for it:
```
mcp__pencil__batch_get({
  filePath: "docs/design-system.pen",
  patterns: [{ name: "<search-term>" }],
  searchDepth: 1
})
```
If zero matches: error — suggest running `mcp__pencil__get_editor_state` to list available comps.
If multiple matches: list them and ask the user to pick one.

### Step 2: Screenshot the Comp

```
mcp__pencil__get_screenshot({
  filePath: "docs/design-system.pen",
  nodeId: "<resolved-id>"
})
```

Save the screenshot. The image is now in context for the spec document.

### Step 3: Read the Node Tree

```
mcp__pencil__batch_get({
  filePath: "docs/design-system.pen",
  nodeIds: ["<resolved-id>"],
  readDepth: 4
})
```

**Check for truncation:** If any children in the result show as `"..."`, issue follow-up calls:
```
mcp__pencil__batch_get({
  filePath: "docs/design-system.pen",
  nodeIds: ["<truncated-child-id-1>", "<truncated-child-id-2>"],
  readDepth: 3
})
```
Repeat until no truncation remains.

**For page-level comps** (full mobile/desktop pages with many sections): start with `readDepth: 2` to get top-level section IDs, then read each section individually at `readDepth: 3`.

### Step 4: Read Design Variables

```
mcp__pencil__get_variables({
  filePath: "docs/design-system.pen"
})
```

Build the variable resolution map. For each Pencil variable:
- Strip the namespace prefix to get the CSS token: `$surface/night` → `var(--night)`
- Look up the hex value from the variable definition
- **Known aliases** (not derivable by name):
  - `$semantic/card-bg` → `var(--night)` (#0F0F14)
  - `$semantic/card-bg-hover` → `var(--dusk)` (#18181F)
  - `$semantic/action-primary` → `var(--coral)` (#FF6B7A)
- **Themed variables:** If the variable has multiple values across the `portal` theme axis, flag it as `(themed: varies by portal)`.

### Step 5: Walk the Tree and Extract CSS

For each node, extract properties using this mapping:

**Layout:**
- `layout: "vertical"` → `display: flex; flex-direction: column`
- `layout: "horizontal"` → `display: flex; flex-direction: row`
- `layout: "none"` → `position: relative` (children use absolute positioning)
- `gap: N` → `gap: Npx`
- `padding: N` → `padding: Npx` (uniform)
- `padding: [V, H]` → `padding: Vpx Hpx`
- `padding: [T, R, B, L]` → `padding: Tpx Rpx Bpx Lpx`
- `justifyContent` → `justify-content: flex-start|center|flex-end|space-between|space-around`
- `alignItems` → `align-items: flex-start|center|flex-end`

**Size:**
- `width: N` (number) → `width: Npx`
- `width: "fill_container"` → `width: 100%`
- `width: "fit_content"` or `"fit_content(N)"` → `width: fit-content`
- Same for `height`

**Positioning:**
- `layoutPosition: "absolute"` → `position: absolute` with `x`→`left`, `y`→`top`
- Note positioning context: `{absolute, relative to: [parent name]}`

**Visual:**
- `fill: "$variable/name"` → resolve via variable map → `background: var(--token) (#hex)`
- `fill: "#RRGGBB"` or `"#RRGGBBAA"` → `background: #RRGGBB` (include alpha if present)
- `fill: { type: "gradient", gradientType: "linear", rotation, colors: [{color, position}...] }` →
  `background: linear-gradient({rotation}deg, {color1} {pos1*100}%, {color2} {pos2*100}%, ...)`
  Include ALL color stops.
- `fill: { type: "image", mode }` → `background: image-fill ({mode})`
- `fill` as array → list each fill on its own line (last paints on top)
- `stroke: { thickness, fill, align }` → `border: {thickness}px solid {resolved-color}` ({align})
- `cornerRadius: N` → `border-radius: Npx`
- `cornerRadius: [TL, TR, BR, BL]` → `border-radius: TLpx TRpx BRpx BLpx`
- `opacity: N` (if not 1) → `opacity: N`
- `clip: true` → `overflow: hidden`

**Typography** (text nodes only):
- `fontFamily` → `font-family: {name}`
- `fontSize` → `font-size: Npx`
- `fontWeight` → `font-weight: {value}`
- `letterSpacing` → `letter-spacing: Npx`
- `lineHeight` → `line-height: {value}`
- `textAlign` → `text-align: left|center|right`
- `content` → the actual text (show in quotes)
- `fill` on text → `color: var(--token) (#hex)`
- `textGrowth: "fixed-width"` → note `text-wrap: enabled`

**Icons** (icon_font nodes):
- `iconFontFamily` + `iconFontName` → `Icon: {family} {name}` (e.g., `Icon: phosphor map-pin`)
- `width`/`height` → `size: Npx`
- `fill` → `color: var(--token) (#hex)`

**Effects/Shadows:**
- `effect: { type: "shadow", offset, blur, spread, color, shadowType }` →
  `box-shadow: {x}px {y}px {blur}px {spread}px {color}` (prepend `inset` if `shadowType: "inner"`)
- `effect: { type: "blur", radius }` → `filter: blur({radius}px)`
- `effect: { type: "background_blur", radius }` → `backdrop-filter: blur({radius}px)`

**Component instances** (ref nodes):
Check if the `ref` ID matches a known component from the design system. Known component IDs:
- `I7NUV` → Badge
- `olqzW` → FilterChip
- `GBoOR` → Button
- `ViqPG` → EventCard
- `h5zDT` → VenueCard
- `vBfLD` → SectionHeader
- `fupdn` → DetailHero
- `cwCFk` → InfoCard
- `wEQon` → DetailStickyBar

If matched, emit:
```
[ref → ComponentName (ID)] InstanceName
  overrides: property=value, ...
```

If not a known component, expand the subtree normally.

### Step 6: Generate the Spec Document

Use the **indented block format** (NOT markdown headings — those break at depth >4):

```
[type] NodeName
  property: value
  property: value

  [type] ChildName
    property: value

    [type] GrandchildName
      property: value
```

Each node gets:
- `[type]` tag: frame, text, ellipse, rectangle, icon_font, ref, path, line
- Node name (from Pencil `name` property)
- `{absolute, ...}` annotation if absolutely positioned
- Indented properties (2 spaces per level)
- Children indented one more level

### Step 7: Add Required Sections

After the component tree, always include:

**## States** — for each interactive element (buttons, links, chips), list:
- default, hover, active, focus, disabled states with CSS properties
- If Pencil has variant states, extract them. If not, annotate from the design system patterns in `web/CLAUDE.md`.

**## Shadows** — list all shadow values found in the tree. If none found, note "No shadows in this comp."

**## Responsive Notes** — note the extraction viewport width. Add known breakpoint behavior:
- Desktop (>=1024px) vs mobile (<1024px) layout differences
- This is manual annotation — Pencil comps are single-breakpoint.

**## Implementation Constraint** — always include:
> **Do not add any CSS property not listed in this spec.** If an element needs a property not documented here (hover state, shadow, transition, z-index), stop and ask rather than improvising. The spec is the ceiling, not the floor.

### Step 8: Save

Write to `docs/design-specs/{kebab-case-name}.md`

### Conventions

- Omit default/zero values (don't list `opacity: 1` or `border-radius: 0`)
- Show resolved variable values inline: `var(--token) (#hex)`
- For `fill_container` → `width: 100%`
- For `fit_content` → `width: fit-content`
- For image fills → `background: image-fill (fill|cover|contain)` — don't embed URLs
- For gradients → include ALL color stops with positions

---

## Verify Flow

### Step 1: Get Reference Image

**If argument is a spec file path:** Read the spec file, find the screenshot reference.

**If argument is a Pencil node ID:** Screenshot it fresh using `mcp__pencil__get_screenshot`.

### Step 2: Screenshot the Live Page

**Pre-flight memory check (mandatory — 16GB RAM + 0 swap = screenshot accumulation crashes the machine):**

```bash
vm_stat | awk '/Pages free/ {gsub(/\./,"",$3); printf "free: %d MB\n", $3*16384/1048576}'
```

If free memory < 200 MB, **abort** and ask the user to quit Spotify, close non-essential Chrome tabs, and close any other MCP browser sessions. Do not proceed — every screenshot is a 1-3MB PNG held in context, and a verify run with multiple scrolls will tip the system over.

Load Chrome browser tools (`ToolSearch` for `mcp__claude-in-chrome__*`).

**Mobile viewport testing is currently unavailable via this skill.** `mcp__claude-in-chrome__resize_window` resizes the macOS window frame but does NOT change the web viewport — `window.innerWidth` stays at desktop. Any "mobile" screenshot via this path captures a desktop-rendered page at a smaller window size, which is worse than useless (it doubles screenshot budget for zero mobile coverage). When mobile verification is required, ask the user to open the page in a real Chrome window at 390px wide, on a real device, or in Chrome DevTools device emulation. Do not claim mobile verification from this skill. See `docs/feed-audit-2026-04-16.md` §10.

**Hard budget per verify run: 3 screenshots desktop-only. Close the tab when done.** A single tab accumulates compositor layers and scroll-position layer buffers that never free until the tab closes. On pages with backdrop-blur (detail pages, modals), this is the dominant memory growth source.

**Desktop pass (max 3 screenshots):**
```
1. mcp__claude-in-chrome__tabs_create_mcp → get tab ID
2. mcp__claude-in-chrome__resize_window({ width: 1440, height: 900 })
3. mcp__claude-in-chrome__navigate({ url: "<url>" })
4. Wait for load
5. mcp__claude-in-chrome__computer({ action: "screenshot" })   // above fold
6. mcp__claude-in-chrome__javascript_tool({ code: "window.scrollTo(0, window.innerHeight)" })
7. mcp__claude-in-chrome__computer({ action: "screenshot" })   // mid
8. mcp__claude-in-chrome__javascript_tool({ code: "window.scrollTo(0, document.body.scrollHeight)" })
9. mcp__claude-in-chrome__computer({ action: "screenshot" })   // bottom
10. Close the tab before finishing
```

**Never `scrollBy(0, 700)` in a loop.** Three jump-scrolls (top, mid, bottom) cover the page; incremental scrolls produce more layer churn and more screenshots than the comparison needs. If the page is genuinely longer than 3 viewports and a section is missed, take one additional targeted screenshot — do not re-loop.

### Step 3: Visual Comparison

Compare the reference image(s) against the live screenshot(s). Analyze differences for:

- **Structural:** Wrong layout direction, missing elements, wrong element order
- **Typography:** Wrong font family, size, weight, letter-spacing, color
- **Spacing:** Wrong padding, gap, margin (reliable >4px, unreliable <4px)
- **Color:** Wrong background, border, or text color
- **Icons:** Wrong icon, wrong size, wrong color
- **Borders:** Wrong thickness, color, radius
- **Shadows:** Present vs absent, wrong values

**Reliability note:** Visual comparison is strong for structural/typography differences, moderate for spacing >4px, and unreliable for subtle color shifts or sub-4px spacing. Flag uncertain comparisons as "Needs manual check."

### Step 4: Output the Diff

Write a structured report:

```markdown
# Visual Verification: {Comp Name}

**Reference:** {source}
**Live:** {url}
**Date:** {date}
**Viewport:** {width}x{height}

## Discrepancies

### Critical
- [element]: [what's wrong]. Spec: [expected]. Live: [actual].

### Major
- [element]: [what's wrong]. Spec: [expected]. Live: [actual].

### Minor
- [element]: [difference].

### Needs Manual Check
- [element]: [uncertain observation].

### Correct
- [element] ✓
- [element] ✓
```

### Step 5: Save

Write to `docs/design-specs/verify/{kebab-name}-{YYYY-MM-DD}.md`

---

## Quality Gate

**Verify-blocks-ship rule:** No implementation is "done" until `/design-handoff verify` produces zero Critical and zero Major discrepancies.

Workflow:
1. `/design-handoff extract` → generates spec
2. Implementation agent builds from spec
3. `/design-handoff verify` → checks fidelity
4. If Critical/Major → fix → verify again
5. Only when clean → mark complete

---

## Variable Resolution Reference

Derived at runtime from `get_variables()`. This table is for quick reference:

| Pencil Variable | CSS Token | Default Hex |
|----------------|-----------|-------------|
| `$surface/void` | `var(--void)` | #09090B |
| `$surface/night` | `var(--night)` | #0F0F14 |
| `$surface/dusk` | `var(--dusk)` | #18181F |
| `$surface/twilight` | `var(--twilight)` | #252530 |
| `$text/cream` | `var(--cream)` | #F5F5F3 |
| `$text/soft` | `var(--soft)` | #A1A1AA |
| `$text/muted` | `var(--muted)` | #8B8B94 |
| `$accent/coral` | `var(--coral)` | #FF6B7A |
| `$accent/gold` | `var(--gold)` | #FFD93D |
| `$accent/neon-green` | `var(--neon-green)` | #00D9A0 |
| `$accent/neon-cyan` | `var(--neon-cyan)` | #00D4E8 |
| `$accent/vibe` | `var(--vibe)` | #A78BFA |
| `$semantic/card-bg` | `var(--night)` | #0F0F14 |
| `$semantic/card-bg-hover` | `var(--dusk)` | #18181F |
| `$semantic/action-primary` | `var(--coral)` | #FF6B7A |
| `$shape/card-radius` | 12px | — |
| `$shape/chip-radius` | 9999px | — |
| `$spacing/base` | 16px | — |
