# Place Thin State — Mobile

**Source:** `docs/design-system.pen` node `zXYRS`
**Extracted:** 2026-04-15

---

## Component Tree

[frame] Root: v2 / Place Thin State — Mobile
  width: 375px
  background: var(--void) (#09090B) (themed: varies by portal)
  display: flex; flex-direction: column
  overflow: hidden

  [frame] HeroFallback
    width: 100%; height: 180px
    background: linear-gradient(180deg, var(--dusk) (#1C1C24) 0%, var(--night) (#0F0F14) 100%)
    position: relative (children absolutely positioned)
    display: flex; flex-direction: column; justify-content: center; align-items: center

    [icon_font] BuildingsIcon  {absolute, centered}
      Icon: phosphor buildings
      size: 64px
      color: var(--cream) (#F5F5F3)
      opacity: 0.15

    [text] VenueLabel  {absolute, bottom: 24px, centered horizontally}
      content: "VENUE"
      font-family: JetBrains Mono; font-size: 10px; font-weight: 500
      letter-spacing: 1px
      color: var(--muted) (#8B8B94)
      opacity: 0.4
      text-align: center

  [frame] Identity
    width: 100%
    padding: 16px 16px 12px 16px
    display: flex; flex-direction: column; gap: 8px

    [frame] TypeBadge
      display: flex; flex-direction: row; gap: 4px; align-items: center
      background: var(--dusk) (#1C1C24)
      border-radius: 4px
      padding: 3px 8px
      align-self: flex-start

      [icon_font] BadgeIcon
        Icon: phosphor martini
        size: 12px
        color: var(--muted) (#8B8B94)

      [text] BadgeText
        content: "BAR"
        font-family: JetBrains Mono; font-size: 9px; font-weight: 700
        letter-spacing: 1px
        color: var(--muted) (#8B8B94)

    [text] Title
      content: "The Highlander"
      font-family: Outfit; font-size: 26px; font-weight: 700
      color: var(--cream) (#F5F5F3)

    [frame] NeighborhoodRow
      width: 100%
      display: flex; flex-direction: row; gap: 6px; align-items: center

      [icon_font] NeighborhoodIcon
        Icon: phosphor map-pin
        size: 14px
        color: var(--muted) (#8B8B94)

      [text] NeighborhoodText
        content: "East Atlanta Village"
        font-family: Outfit; font-size: 13px; font-weight: normal
        color: var(--soft) (#A1A1AA)

  [frame] QuickActions
    width: 100%
    padding: 0 16px 16px 16px
    display: flex; flex-direction: row; gap: 12px; justify-content: flex-start

    [frame] DirectionsBtn
      display: flex; flex-direction: column; gap: 6px; align-items: center

      [frame] BtnCircle
        width: 40px; height: 40px
        background: var(--dusk) (#1C1C24)
        border-radius: 20px
        display: flex; justify-content: center; align-items: center

        [icon_font] Icon: phosphor navigation-arrow, size: 18px, color: var(--soft) (#A1A1AA)

      [text] BtnLabel
        content: "Directions"
        font-family: Outfit; font-size: 11px; font-weight: normal
        color: var(--muted) (#8B8B94)

    [frame] SaveBtn — same pattern as DirectionsBtn
      BtnCircle icon: phosphor bookmark-simple, size: 18px, color: var(--soft)
      BtnLabel: "Save"

    [frame] ShareBtn — same pattern as DirectionsBtn
      BtnCircle icon: phosphor share-network, size: 18px, color: var(--soft)
      BtnLabel: "Share"

  [rectangle] SectionDivider
    width: 100%; height: 8px
    background: var(--night) (#0F0F14)

  [frame] AboutSection
    width: 100%
    padding: 16px
    display: flex; flex-direction: column; gap: 10px

    [frame] AboutHead
      display: flex; flex-direction: row; gap: 8px; align-items: center

      [icon_font] SectionIcon
        Icon: phosphor article
        size: 16px
        color: var(--muted) (#8B8B94)

      [text] SectionLabel
        content: "ABOUT"
        font-family: JetBrains Mono; font-size: 11px; font-weight: 500
        letter-spacing: 1.5px
        color: var(--soft) (#A1A1AA)

    [text] AboutBody
      content: "Classic dive bar in East Atlanta Village with a full bar, pool tables, and a no-frills vibe."
      font-family: Outfit; font-size: 13px; font-weight: normal
      line-height: 1.6
      color: var(--soft) (#A1A1AA)
      text-wrap: enabled (width: 100%)

  [rectangle] SectionDivider — same pattern: 100% x 8px, var(--night)

  [frame] EmptyFallback
    width: 100%
    padding: 40px 32px
    display: flex; flex-direction: column; align-items: center; gap: 10px

    [icon_font] EmptyIcon
      Icon: phosphor magnifying-glass
      size: 48px
      color: var(--cream) (#F5F5F3)
      opacity: 0.1

    [text] EmptyHeading
      content: "We're still learning about this place"
      font-family: Outfit; font-size: 15px; font-weight: 600
      color: var(--cream) (#F5F5F3)
      text-align: center

    [text] EmptySubtext
      content: "Check back soon — or help us out by suggesting details"
      font-family: Outfit; font-size: 13px; font-weight: normal
      color: var(--muted) (#8B8B94)
      text-align: center
      line-height: 1.5
      width: 260px

  [rectangle] SectionDivider — same pattern: 100% x 8px, var(--night)

  [frame] NearbySection
    width: 100%
    padding: 16px
    display: flex; flex-direction: column; gap: 12px

    [frame] NearbyHead
      display: flex; flex-direction: row; gap: 8px; align-items: center

      [icon_font] SectionIcon
        Icon: phosphor compass
        size: 16px
        color: var(--muted) (#8B8B94)

      [text] SectionLabel
        content: "NEARBY"
        font-family: JetBrains Mono; font-size: 11px; font-weight: 500
        letter-spacing: 1.5px
        color: var(--soft) (#A1A1AA)

    [frame] NearbyRow (repeating pattern)
      width: 100%
      display: flex; flex-direction: row; gap: 10px; align-items: center

      [ellipse] CategoryDot
        width: 8px; height: 8px
        background: var(--neon-green) (#00D9A0) — varies by category

      [frame] TextContent
        width: 100%
        display: flex; flex-direction: column; gap: 1px

        [text] Name
          font-family: Outfit; font-size: 13px; font-weight: 500
          color: var(--cream) (#F5F5F3)

        [text] Meta
          font-family: Outfit; font-size: 11px; font-weight: normal
          color: var(--muted) (#8B8B94)

    — Row 1: "Flatiron Bar" / "Bar · 1 min walk · Open now" / dot: var(--neon-green)
    — Row 2: "The Earl" / "Bar · Music · 3 min walk · Open til 2am" / dot: var(--coral)
    — Row 3: "Muchacho" / "Coffee · 4 min walk · Closes 6pm" / dot: var(--gold)

---

## Reusable Patterns

### Section Header Pattern
Identical to `event-concert-mobile.md`. Used by: About, Nearby.
```
display: flex; flex-direction: row; gap: 8px; align-items: center
  [icon_font] size: 16px, color: var(--muted)
  [text] font-family: JetBrains Mono; font-size: 11px; font-weight: 500; letter-spacing: 1.5px; color: var(--soft); text-transform: uppercase
```

### Section Divider Pattern
Identical to `event-concert-mobile.md`.
```
[rectangle] width: 100%; height: 8px; background: var(--night) (#0F0F14)
```

### Nearby Row Pattern
Identical to `event-concert-mobile.md`.
```
width: 100%; display: flex; flex-direction: row; gap: 10px; align-items: center
  [ellipse] dot: 8x8px, background varies by category
  [frame] TextContent: flex-column, gap: 1px
    [text] name: Outfit 13px 500, var(--cream)
    [text] meta: Outfit 11px normal, var(--muted)
```

### Quick Action Button Pattern (circle, no accent)
All three buttons on this screen are non-accent (muted) — no coral CTA.
```
display: flex; flex-direction: column; gap: 6px; align-items: center
  [frame] circle: 40x40px, background: var(--dusk), border-radius: 20px, centered icon 18px var(--soft)
  [text] label: Outfit 11px normal, var(--muted)
```

### Type Badge Pattern (muted, thin-state variant)
On a rich place, the type badge uses an accent color. On a thin-state place, it is deliberately muted to reflect data absence.
```
background: var(--dusk); border-radius: 4px; padding: 3px 8px; align-self: flex-start
display: flex; flex-direction: row; gap: 4px; align-items: center
  [icon_font] size: 12px, color: var(--muted)
  [text] JetBrains Mono 9px 700, letter-spacing: 1px, color: var(--muted)
```

### Hero Fallback Pattern
Used when no image is available for the place.
```
width: 100%; height: 180px
background: linear-gradient(180deg, var(--dusk) 0%, var(--night) 100%)
position: relative; display: flex; justify-content: center; align-items: center
  [icon_font] buildings: 64px, color var(--cream), opacity 0.15
  [text] category label: JetBrains Mono 10px 500, letter-spacing 1px, var(--muted), opacity 0.4, centered, bottom 24px
```

### Empty Fallback Pattern
Used when enrichment data is unavailable for a section.
```
padding: 40px 32px; display: flex; flex-direction: column; align-items: center; gap: 10px
  [icon_font] magnifying-glass: 48px, color var(--cream), opacity 0.1
  [text] heading: Outfit 15px 600, var(--cream), text-align center
  [text] subtext: Outfit 13px normal, var(--muted), text-align center, line-height 1.5, width 260px
```

---

## States

### Quick Action Buttons (all non-accent)
- default: background var(--dusk), icon var(--soft)
- hover: background var(--twilight), icon var(--cream)
- active: background var(--twilight)/80

### Nearby Rows
- default: as specified above
- hover: background var(--dusk)/50 (applied to full row)

---

## Shadows

No shadows in this comp.

---

## Responsive Notes

Extracted at 375px (mobile). Known breakpoint behavior:
- Desktop (>=1024px): DetailShell renders sidebar (340px sticky) + content (fluid) side-by-side
- Mobile (<1024px): full-width single column (this comp)
- Hero fallback: 180px fixed height at all breakpoints (shorter than rich hero to signal data absence)
- Empty fallback width 260px constraint on subtext remains at all breakpoints
- Nearby section is injected as fallback content when primary sections have no data

---

## Implementation Constraint

**Do not add any CSS property not listed in this spec.** If an element needs a property not documented here (hover state, shadow, transition, z-index), stop and ask rather than improvising. The spec is the ceiling, not the floor.
