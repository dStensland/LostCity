# Goblin Ranking Visual Upgrade — Spy HUD Design

## Overview

Transform the MI ranking experience from utilitarian list into a cinematic spy-HUD interface. Every item shows its curated scene image at a larger size. Visual intensity scales with rank — top 3 get the full dossier treatment, lower ranks fade to operational background. All three views (My Rankings, Group, Compare) get the treatment.

## Design Direction

**Aesthetic:** Surveillance HUD meets classified dossier. Scan lines, corner bracket targeting reticles, tactical grid backgrounds, glitch transitions, pulsing status indicators. The MI franchise itself is the design language.

**Color system (existing tokens, new usage):**
- Cyan `#00f0ff` — ranks 1-3, active states, HUD elements
- Magenta `#ff00aa` — ranks 4-10, secondary accents
- Zinc `#52525b` — ranks 11+, background-level items
- Amber `#ffd93d` — contested items in Group view
- Green `#00d9a0` — positive rank deltas, save confirmation

## Component Changes

### 1. GoblinRankingGamePage (page shell)

**Header redesign:**
- Classification label above title: `OPERATION ACTIVE // RANKING PROTOCOL` in monospace, 9px, cyan at 40% opacity, letter-spacing 4px
- Title keeps existing text-2xl/3xl but adds `text-shadow: 0 0 30px rgba(0,240,255,0.2)` and wider letter-spacing `0.25em`
- Pulsing status dot (6px cyan circle with box-shadow glow) + gradient divider line below title
- Subtle tactical grid background on the header area: CSS `background-image` with 40px grid lines at `rgba(0,240,255,0.03)`

**Category tabs upgrade:**
- Active tab: `bg-cyan-500/15 border-cyan-500/40` with `box-shadow: 0 0 12px rgba(0,240,255,0.1), inset 0 0 12px rgba(0,240,255,0.05)` and white text
- Inactive: same as current, no change needed

**View toggle:** No change — secondary controls stay understated.

**Save indicator:**
- "SAVING..." gets scan-line sweep animation (horizontal gradient band moves top-to-bottom)
- "SAVED" types itself out character by character over 400ms, then fades after 2s

### 2. GoblinRankingItem (core list item)

**Image upgrade (responsive):**
- Mobile (< sm): top 3 get 80px image width, ranks 4+ get 56px (current size)
- Desktop (sm+): all items get 100px image width
- Height matches row via `object-cover`
- Top 3 ranked items: corner bracket HUD overlay on image (4 corner elements, 8px, 2px solid cyan border on two sides each). **All bracket elements must be `pointer-events: none`** to avoid blocking touch drag.
- Top 3: full image with no opacity reduction
- Ranks 4-10: no corner brackets
- Ranks 11+: slight opacity reduction (0.7)
- Items without images: dark zinc placeholder with rank number watermarked large, zinc-colored corner brackets so grid reads consistently, subtle scanline texture on placeholder

**Rank number upgrade:**
- Top 3: zero-padded two digits (`01`, `02`, `03`), font-size 28px, font-weight 900
- Glow effect: **do NOT animate `text-shadow`** (triggers paint every frame). Instead, use a `::after` pseudo-element with `background: radial-gradient(cyan)` positioned behind the text, animate only `opacity` (0.4 to 1.0, 2s ease-in-out infinite). This is fully composited.
- Ranks 4-10: single/double digit, font-size 20px, static magenta text-shadow (no animation)
- Ranks 11+: regular size, zinc-500, no glow (same as current)

**Threat-level sidebar:**
- New 4px wide bar on the right edge of ranked items
- Top 3: full cyan, gradient fade at bottom
- Ranks 4-10: magenta, shorter gradient
- Ranks 11+: none (hidden)

**Row styling:**
- Replace `bg-zinc-950 border border-zinc-800/50` with more defined surface
- Top 3: `bg-zinc-950 border border-cyan-500/20` with very subtle cyan inner glow
- Ranks 4-10: `bg-zinc-950 border border-zinc-800/40`
- Ranks 11+: `bg-zinc-950/80 border border-zinc-800/30` (slightly more transparent)

### 3. GoblinRankingList (My Rankings view)

**Staggered entry animation:**
- On initial load and category switch, items animate in from the right
- Each item delays 50ms after the previous (`animation-delay: ${index * 50}ms`)
- **Cap stagger at 10 items (500ms max).** Items 11+ render immediately with no delay.
- Animation: `translateX(20px) opacity(0)` to `translateX(0) opacity(1)`, 300ms ease-out
- Top 3 items get an additional brief glitch flicker: rapid `opacity` oscillation (1.0 → 0.7 → 1.0 → 0.8 → 1.0) over 80ms at the end of entry. **Do NOT use clipPath jitter** (not composited on Safari).

**Drag reorder effects:**
- Dragged item: `scale(1.02) translateY(-2px)` with `shadow-xl` and cyan border glow
- Drop zone: cyan insertion line (2px) that pulses between 40% and 100% opacity
- On drop: brief flash animation on the settled item (white overlay 0→10%→0 over 200ms)

**Unranked section:**
- Items stay dimmed with images at 50% opacity
- Mobile: 56px images. Desktop (sm+): 80px images.
- "TAP TO ADD" label stays

**Tier labels (vertical sidebar):**
- Add scan-line texture to the tier color bar
- Tier name text gets matching glow (static text-shadow, not animated)

### 4. GoblinRankingGroup (Group view)

**Full image treatment:**
- Each aggregated item shows its image at 80px width (60px on mobile)
- Top 3 group-ranked items get corner brackets (`pointer-events: none`)
- "CONTESTED" badge: amber pulse via `opacity` animation on a `::before` pseudo-element with pre-rendered amber glow. **Do NOT animate `box-shadow`** (triggers paint).

**Rank distribution bar:**
- Thin horizontal bar (4px height, rounded-full) below each item's metadata
- Background: `zinc-800`
- Width: maps the item's rank range to the total item count (e.g., ranked #2-#8 out of 20 items → bar spans 10%-40% of container)
- Current user's position: 6px cyan dot on the bar
- Other participants: 4px zinc-500 dots
- If all participants rank the same: single dot, no bar needed (collapse)

**Entry animation:** Same staggered entry as My Rankings (capped at 10 items)

### 5. GoblinRankingCompare (Compare view)

**Participant selector:**
- Selected participant tab gets the active HUD treatment (cyan glow, inner shadow)
- Avatar images get corner bracket treatment when selected (`pointer-events: none`)

**Comparison items:**
- Image treatment matches My Rankings (responsive: 80px top-3 mobile, 56px rest mobile, 100px desktop)
- Delta badges get enhanced styling:
  - Positive (you rank higher): green glow badge
  - Negative: red glow badge
  - Equal: zinc, no glow
- Items where you disagree significantly (delta >= 5) get an amber "DIVERGENT" micro-label

**Entry animation:** Same staggered entry, capped at 10 items

### 6. Category Switch Transition

**Glitch wipe effect:**
- When switching categories, apply a brief glitch transition to the content area
- Implementation: CSS animation on the content wrapper
  1. Frame 0: normal
  2. Frame 30%: `clipPath: inset(0 0 60% 0)` + `translateX(2px)` (top portion shifts right)
  3. Frame 50%: `clipPath: inset(40% 0 0 0)` + `translateX(-2px)` (bottom portion shifts left)
  4. Frame 100%: normal (new content visible)
- Duration: 150ms total — fast enough to feel snappy, slow enough to register
- Apply `will-change: clip-path` only during the transition, remove after
- Clean up via `animationend` listener, not `setTimeout`

### 7. Page Background

**Tactical grid overlay:**
- Full page background with subtle grid: `background-image: linear-gradient(rgba(0,240,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(0,240,255,0.02) 1px, transparent 1px); background-size: 40px 40px`
- Applied to the page wrapper, not individual items
- Very subtle — just barely visible, creates atmosphere without competing

**Scan line overlay:**
- Thin repeating horizontal lines across the entire content area
- `background: repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,240,255,0.015) 2px, rgba(0,240,255,0.015) 4px)`
- Applied as a `::before` pseudo-element on the page wrapper
- **Must have:** `pointer-events: none; contain: layout style paint; position: fixed` to isolate from scroll repaints

**Accessibility:**
- Both grid and scan line overlays are disabled under `@media (prefers-reduced-motion: reduce)` and `@media (prefers-contrast: more)`
- All continuous animations (glow pulse, status dot) also respect `prefers-reduced-motion`
- Lower-rank opacity reduction (0.7) stays above WCAG AA contrast minimum for text on dark backgrounds

## Animation Performance Notes

- All animations use CSS `transform` and `opacity` only (composited, no layout/paint triggers)
- **`text-shadow` and `box-shadow` are NEVER animated.** They are applied as static styles via classes. All glow effects that need animation use `opacity` on pseudo-elements with pre-rendered gradients.
- Category switch glitch uses `clipPath` (acceptable for 150ms burst; `will-change` applied only during transition)
- Top-3 entry glitch uses `opacity` flicker, NOT `clipPath` (Safari compatibility)
- Staggered entry uses `animation-delay` + `animation-fill-mode: backwards` (no JS timers), capped at 10 items
- Scan line overlay uses `contain: layout style paint` to prevent scroll repaint propagation

## Files Modified

1. `web/components/goblin/GoblinRankingItem.tsx` — image size (responsive), HUD frames, rank styling, threat sidebar, empty placeholder
2. `web/components/goblin/GoblinRankingGamePage.tsx` — header redesign, grid/scanline background, save animation, glitch transition, accessibility queries
3. `web/components/goblin/GoblinRankingList.tsx` — staggered entry (capped), drag effects, entry glitch
4. `web/components/goblin/GoblinRankingGroup.tsx` — images, rank spread bar, CONTESTED pulse, entry animations
5. `web/components/goblin/GoblinRankingCompare.tsx` — images, enhanced deltas, DIVERGENT label, participant HUD treatment

No new files. No new dependencies. All CSS-driven, no animation libraries.

## What This Does NOT Change

- Ranking logic, save behavior, drag-and-drop mechanics
- API routes or database schema
- Auth flow, login prompt
- Add/edit/delete item forms (they stay functional/minimal)
- The Goblin Day pages outside the ranking experience

## Expert Review Changes Applied

Based on architecture, performance, and product design reviews:

1. **Glow pulse:** Changed from animated `text-shadow` to `opacity` on `::after` pseudo-element (compositor-friendly)
2. **Mobile images:** Responsive sizing (56px/80px mobile, 100px desktop) instead of flat 100px everywhere
3. **Corner brackets:** Explicit `pointer-events: none` to avoid blocking touch drag
4. **Top-3 entry glitch:** Changed from `clipPath` jitter to `opacity` flicker (Safari compatibility)
5. **"CLASSIFIED // STUNT" label:** Removed — category is already shown in tab selector
6. **Stagger cap:** Limited to 10 items (500ms), remaining items render immediately
7. **Scan line overlay:** Added `contain`, `position: fixed`, and `prefers-reduced-motion`/`prefers-contrast` queries
8. **CONTESTED pulse:** Uses `opacity` on pre-rendered glow pseudo-element, not `box-shadow`
9. **Empty placeholder:** Gets zinc corner brackets + scanline texture for visual consistency
10. **Rank distribution bar:** Fully specified (4px height, dot sizes, collapse behavior)
11. **Glitch wipe cleanup:** Uses `animationend` listener instead of `setTimeout`
