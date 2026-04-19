# Big Stuff — See-All Page — Visual Spec

**Pencil nodes:**
- Main page: `YynKd` in `docs/design-system.pen` (name: "Big Stuff — See-All Page (Desktop)")
- Collapsed-sticky strip preview: `6JK5d` (name: "Big Stuff — Collapsed Strip (sticky state)")
- Feed-ribbon sibling reference: `qOUCP` (name: "Big Stuff — Feed (Month Ribbon)")

**Extraction date:** 2026-04-18
**Viewport:** Desktop, 1440 width (with 64px side padding → 1312px content width)
**Registry status:** New composition. No prior pattern registry entry — justified in `docs/superpowers/specs/2026-04-18-big-stuff-page-redesign.md`.

---

## Component Tree

```
[frame] Big Stuff — See-All Page (Desktop)  — id: YynKd
  background: #09090B (var(--void))
  display: flex; flex-direction: column
  gap: 28px
  padding: 48px 64px
  width: 1440px

  [frame] headerBlock
    display: flex; flex-direction: column
    gap: 20px
    width: 100%

    [frame] titleBlock
      display: flex; flex-direction: column
      gap: 6px
      width: 100%

      [text] title
        content: "The Big Stuff"
        font-family: Bricolage Grotesque
        font-size: 38px
        font-weight: 700
        letter-spacing: -0.5px
        color: var(--cream) (#F5F5F3)
        (production: render as <h1>)

      [text] subtitle
        content: "Festivals, tentpoles, and season-defining moments coming up in Atlanta."
        font-family: Outfit
        font-size: 14px
        font-weight: normal
        color: var(--soft) (#A1A1AA)
        (production: portal name substituted at runtime)

    [frame] chipsRow  — filter chip tablist
      display: flex; flex-direction: row
      gap: 8px
      width: 100%

      [frame] chip:All  — always visible
        display: flex; flex-direction: row
        align-items: center; gap: 6px
        padding: 6px 12px
        border-radius: 9999px
        background: #F5F5F3 @ 13% alpha
        border: 1px solid #F5F5F3 @ 40% alpha

        [text] "All · 45"
          font-family: Space Mono; font-size: 11px; font-weight: 700
          letter-spacing: 0.5px
          color: var(--cream)

      [frame] chip:Festivals  — visible when count >= 2
        same shape as chip:All with:
        background: var(--gold) @ 10% (#FFD93D1A)
        border: 1px solid var(--gold) @ 25%
        text color: var(--gold) (#FFD93D)
        content: "Festivals · <count>"

      [frame] chip:Conventions  — visible when count >= 2
        background: var(--vibe) @ 10% (#A78BFA1A)
        border: var(--vibe) @ 25%
        text color: var(--vibe) (#A78BFA)
        content: "Conventions · <count>"

      [frame] chip:Sports  — visible when count >= 2
        background: var(--neon-cyan) @ 10% (#00D4E81A)
        border: var(--neon-cyan) @ 25%
        text color: var(--neon-cyan) (#00D4E8)
        content: "Sports · <count>"

      [frame] chip:Community  — visible when count >= 2
        background: var(--neon-green) @ 10% (#00D9A01A)
        border: var(--neon-green) @ 25%
        text color: var(--neon-green) (#00D9A0)
        content: "Community · <count>"

  [frame] monthRibbon  — full above-the-fold ribbon
    display: flex; flex-direction: row
    width: 100%
    height: fit-content
    border-radius: 12px  — rounded-card
    background: var(--night) (#0F0F14)
    border: 1px solid var(--twilight) (#252530)
    overflow: hidden

    [frame] month-column (×6: APR, MAY, JUN, JUL, AUG, SEP)
      display: flex; flex-direction: column
      gap: 4px
      width: fill_container (flex: 1 — equal share)
      padding: 14px 16px
      border-left: 1px solid var(--twilight)  — on columns 2..N only

      [frame] head (current month only)
        display: flex; flex-direction: row
        align-items: center; gap: 6px
        width: 100%

        [ellipse] gold-dot  — current month only
          width: 6px; height: 6px
          background: var(--gold)

        [text] month-label
          content: "APR"
          font-family: Space Mono
          font-size: 14px
          font-weight: 700
          letter-spacing: 1.7px
          color: var(--cream)

      [text] count-line
        content: "4 EVENTS"
        font-family: Space Mono
        font-size: 10px
        font-weight: normal
        letter-spacing: 1.5px
        color: var(--muted) (#8B8B94)

  [frame] body  — month sections
    display: flex; flex-direction: column
    gap: 36px
    width: 100%

    [frame] month-section  (×N for non-empty months)
      display: flex; flex-direction: column
      gap: 20px
      width: 100%

      [frame] month-anchor
        display: flex; flex-direction: column
        gap: 14px

        [frame] anchor-hr
          width: 100%; height: 1px
          background: var(--twilight)

        [text] anchor-label
          content: "APR 2026"
          font-family: Space Mono
          font-size: 12px
          font-weight: 700
          letter-spacing: 1.7px
          color: var(--cream)

      [frame] hero-card
        display: flex; flex-direction: column
        gap: 0
        width: 100%
        height: fit-content
        border-radius: 12px
        background: var(--night)
        border: 1px solid var(--twilight)
        overflow: hidden
        (production: apply `border-l-[2px]` in type color — Pencil comp shows accent as top strip for visual clarity)

        [frame] hero-image
          width: 100%
          aspect-ratio: 21/9 (desktop); 16/9 (mobile)
          background: var(--twilight) (placeholder)
          layout: none  (children absolutely positioned)
          overflow: hidden
          (production: background: image-fill (cover) of item.imageUrl via SmartImage)

          [frame] pill-row  — absolute, top-left
            display: flex; flex-direction: row
            gap: 8px
            x: 20; y: 20

            [frame] live-now-pill  — only when isLiveNow
              display: flex; flex-direction: row; align-items: center
              padding: 3px 8px
              border-radius: 3px
              background: var(--neon-red) @ 15% (#FF5A5A26)
              border: 1px solid var(--neon-red) @ 40%

              [text]
                content: "LIVE NOW"
                font-family: Space Mono
                font-size: 9px
                font-weight: 700
                letter-spacing: 0.8px
                color: var(--neon-red)

            [frame] type-pill
              same shape as live-now-pill with type-color tokens:
              - festival: var(--gold)
              - convention: var(--vibe)
              - sports: var(--neon-cyan)
              - community: var(--neon-green)
              - other: var(--muted)

              [text]
                content: "FESTIVAL" | "CONVENTION" | "SPORTS" | "COMMUNITY" | "OTHER"
                same typography as live-now-pill text
                color: type-color

        [frame] hero-body
          display: flex; flex-direction: column
          gap: 12px
          width: 100%
          padding: 24px

          [text] title
            content: item.title
            font-family: Bricolage Grotesque
            font-size: 32px
            font-weight: 700
            letter-spacing: -0.4px
            line-height: 1.1
            color: var(--cream)

          [text] meta
            content: "<date-range> · <location>"
            font-family: Outfit
            font-size: 14px
            font-weight: normal
            color: var(--muted)

          [text] teaser  — only when item.description is non-null
            content: item.description
            font-family: Outfit
            font-size: 14px
            font-weight: normal
            line-height: 1.5
            color: var(--soft)
            text-wrap: enabled (fixed-width, fill_container)

      [frame] row  (×N compact rows)
        display: flex; flex-direction: row
        gap: 12px
        width: 100%
        padding: 10px
        border-radius: 12px
        background: var(--night)
        border: 1px solid var(--twilight)
        align-items: start
        (production: apply `border-l-[2px]` in type color via CSS)

        [frame] row-accent
          width: 2px
          height: fill_container (matches row height)
          background: type-color

        [frame] row-thumb
          width: 72px; height: 72px
          border-radius: 6px
          background: var(--twilight) (placeholder)
          (production: SmartImage cover, with type-color gradient + icon fallback when null)

        [frame] row-content
          display: flex; flex-direction: column
          gap: 3px
          width: fill_container

          [text] row-title
            content: item.title
            font-family: Outfit; font-size: 15px; font-weight: 600
            color: var(--cream)
            (production: truncate to 1 line)

          [text] row-meta
            content: "<date-range> · <location>"
            font-family: Outfit; font-size: 13px; font-weight: normal
            color: var(--muted)
            (production: truncate to 1 line)

        [frame] row-type-pill
          right-aligned on desktop; wraps below meta on mobile
          same shape + typography as hero type-pill
          (production: replaced entirely by LIVE NOW pill when isLiveNow — no both)
```

## Collapsed-sticky strip — `6JK5d`

```
[frame] Big Stuff — Collapsed Strip (sticky state)
  display: flex; flex-direction: row
  align-items: center
  width: 1440px
  height: 44px  (production: min-h-[44px] mobile, h-8 desktop)
  padding: 0 64px
  background: var(--void) @ 94% alpha (#09090BF0)
  border-bottom: 1px solid var(--twilight)
  gap: 28px
  (production: sticky; top: 0; z-index: 30; backdrop-filter: blur(4px))

  [text] month-pill (×6)
    content: "APR", "MAY", "JUN", "JUL", "AUG", "SEP"
    font-family: Space Mono
    font-size: 10px
    font-weight: 700
    letter-spacing: 0.8px

    Active month (example: APR):
      color: var(--gold)
      text-decoration: underline (offset-[4px], decoration-[var(--gold)])

    Inactive months:
      color: var(--muted)
      hover: color → var(--cream)
```

---

## States

### Filter chip
- **Default (unselected):** 10% alpha fill, 40% border, full-color text.
- **Active (selected):** full-opacity fill per variant, inverted text (void on bright background for gold/green; cream for vibe/cyan to preserve contrast). Reused from `FilterChip` component's `active` prop — no custom styling here.
- **Hover:** increase fill opacity to 20%, same text color.
- **Focus-visible:** 2px coral ring (`.focus-ring` utility).

### Month pill (full ribbon)
- **Default:** cream label + muted count on dark card.
- **Hover:** `bg-[var(--dusk)]` (100ms ease).
- **Focus-visible:** `.focus-ring`.

### Month pill (collapsed strip)
- **Inactive:** muted text, hover → cream.
- **Active (scroll-tracked):** gold text + gold underline at 4px offset.
- **Focus-visible:** `.focus-ring`.

### Hero card
- **Default:** as spec.
- **Hover (whole card):** image ken-burns (700ms ease-out, scale 1.0 → 1.04), title gains gold underline at 3px offset. Desktop only; `prefers-reduced-motion` → static.
- **Focus-visible:** `.focus-ring` on the wrapping link.

### Compact row
- **Default:** as spec.
- **Hover:** `bg-[var(--dusk)]` (100ms ease), title gains gold underline.
- **Focus-visible:** `.focus-ring` on the wrapping link.

### LIVE NOW pill
- Continuous slow pulse: 3s infinite, opacity 0.7 → 1 → 0.7.
- `prefers-reduced-motion` → static at opacity 0.85.

---

## Shadows

No shadows on any element. Cinematic-minimalism decision enforces flat surfaces with atmospheric depth via gradient fallbacks (`docs/decisions/2026-03-08-cinematic-minimalism-design.md`).

---

## Responsive Notes

- **Desktop (≥640px / `sm:` breakpoint):** as spec. Full ribbon 6-column flex, hero 21:9, row thumb 72×72, chip row wraps if needed.
- **Mobile (<640px):**
  - Header title: `text-2xl` (24px) instead of 38px.
  - Filter chips: horizontal snap-scroll strip (`FilterChip` mobile default).
  - Full ribbon: horizontal snap-scroll, 3 columns visible at 110px each.
  - Collapsed strip: `min-h-[44px]` (touch target), horizontal snap-scroll.
  - Hero card: `aspect-[16/9]` image; padding → 16px.
  - Compact row: thumb 56×56; type pill wraps below meta (no right-align).

---

## Implementation Notes

**A. Left-border accent.** The Pencil comp renders the type-color accent as a 2px top strip on the hero card (easier to position in Pencil's layout system). In production, implement as `border-left: 2px solid <type-color>` on the outer card element — matches the existing `find-row-card` pattern.

**B. Row-accent strip height.** The Pencil comp uses a separate 2px child frame for the row's left accent. In production, use `border-l-[2px] border-l-[<color>]` on the row's outer div — single declaration, no child element.

**C. Type-color tokens.** The comp uses hex values for the pill background/border alpha tints (`#FFD93D1A`, etc.) because Pencil's MCP doesn't accept `color-mix()` syntax. In production, use `color-mix(in srgb, <token> 15%, transparent)` for backgrounds and `color-mix(in srgb, <token> 40%, transparent)` for borders — same visual result, token-driven.

**D. Filter chip variants.** Map Pencil comp chip styling to existing `FilterChip` variants:
- All → `default`
- Festivals → `date` (gold)
- Conventions → `vibe` (lavender)
- Sports → `access` (cyan)
- Community → `free` (green)

---

## Implementation Constraint

**Do not add any CSS property not listed in this spec.** If an element needs a property not documented here (new shadow, filter, z-index), stop and ask rather than improvising. The spec is the ceiling, not the floor.

Intentional deviations from the Pencil comp in the production code:
1. Accent strip on hero: top-2px in Pencil → left-2px in production (Note A).
2. Row accent strip: separate child frame in Pencil → CSS border-left in production (Note B).
3. Pill alpha values: hex in Pencil → `color-mix()` in production (Note C).

Any deviation beyond these three must be justified in the PR description.
