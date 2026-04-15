# Place Restaurant — Mobile

**Source:** `docs/design-system.pen` node `tVmBI`
**Extracted:** 2026-04-15

---

## Component Tree

[frame] Root: v2 / Place Restaurant — Mobile
  width: 375px
  background: var(--void) (#09090B) (themed: varies by portal)
  display: flex; flex-direction: column
  overflow: hidden

  [frame] Hero
    width: 100%; height: 200px
    background: image-fill (fill)
    position: relative (children absolutely positioned)

    [frame] HeroGrad  {absolute, fills parent}
      width: 100%; height: 100%
      background: linear-gradient(0deg, transparent 30%, #09090BEE 100%)

  [frame] Identity
    width: 100%
    padding: 16px 16px 12px 16px
    display: flex; flex-direction: column; gap: 8px

    [frame] TypeBadge
      display: flex; flex-direction: row; gap: 4px; align-items: center
      background: #FF6B7A1A
      border-radius: 4px
      padding: 3px 8px
      align-self: flex-start

      [icon_font] BadgeIcon
        Icon: phosphor fork-knife
        size: 12px
        color: var(--coral) (#FF6B7A)

      [text] BadgeText
        content: "RESTAURANT"
        font-family: JetBrains Mono; font-size: 9px; font-weight: 700
        letter-spacing: 1px
        color: var(--coral) (#FF6B7A)

    [text] Title
      content: "Staplehouse"
      font-family: Outfit; font-size: 26px; font-weight: 700
      color: var(--cream) (#F5F5F3)

    [frame] SubtitleRow
      width: 100%
      display: flex; flex-direction: row; gap: 6px; align-items: center

      [icon_font] LocationIcon
        Icon: phosphor map-pin
        size: 14px
        color: var(--muted) (#8B8B94)

      [text] SubtitleText
        content: "Old Fourth Ward · New American · $$$"
        font-family: Outfit; font-size: 13px; font-weight: normal
        color: var(--soft) (#A1A1AA)

    [frame] RatingRow
      width: 100%
      display: flex; flex-direction: row; gap: 6px; align-items: center

      [icon_font] StarIcon
        Icon: phosphor star
        size: 14px
        color: var(--gold) (#FFD93D)

      [text] RatingValue
        content: "4.8"
        font-family: Outfit; font-size: 13px; font-weight: 600
        color: var(--gold) (#FFD93D)

      [text] RatingCount
        content: "(2,341)"
        font-family: Outfit; font-size: 13px; font-weight: normal
        color: var(--muted) (#8B8B94)

  [frame] StatusBar
    width: 100%
    padding: 0 16px 12px 16px
    display: flex; flex-direction: row; gap: 8px; align-items: center

    [frame] OpenPill
      background: #00D9A01A
      border-radius: 20px
      padding: 4px 10px
      display: flex; flex-direction: row; gap: 6px; align-items: center

      [ellipse] OpenDot
        width: 6px; height: 6px
        background: var(--neon-green) (#00D9A0)

      [text] OpenText
        content: "Open now"
        font-family: Outfit; font-size: 12px; font-weight: 500
        color: var(--neon-green) (#00D9A0)

    [text] ClosesText
      content: "· Closes 10pm"
      font-family: Outfit; font-size: 12px; font-weight: normal
      color: var(--muted) (#8B8B94)

    [text] SeeHoursLink
      content: "See hours"
      font-family: JetBrains Mono; font-size: 11px; font-weight: 500
      color: var(--coral) (#FF6B7A)

  [frame] QuickActions
    width: 100%
    padding: 0 16px 16px 16px
    display: flex; flex-direction: row; gap: 12px; justify-content: flex-start

    [frame] ReserveBtn  {accent CTA — coral bg}
      display: flex; flex-direction: column; gap: 6px; align-items: center

      [frame] BtnCircle
        width: 40px; height: 40px
        background: var(--coral) (#FF6B7A)
        border-radius: 20px
        display: flex; justify-content: center; align-items: center

        [icon_font] Icon: phosphor calendar-check, size: 18px, color: #FFFFFF

      [text] BtnLabel
        content: "Reserve"
        font-family: Outfit; font-size: 11px; font-weight: normal
        color: var(--coral) (#FF6B7A)

    [frame] MenuBtn — standard circle action pattern
      BtnCircle icon: phosphor list-bullets, size: 18px, color: var(--soft) (#A1A1AA)
      BtnLabel: "Menu"

    [frame] DirectionsBtn — standard circle action pattern
      BtnCircle icon: phosphor navigation-arrow, size: 18px, color: var(--soft)
      BtnLabel: "Directions"

    [frame] CallBtn — standard circle action pattern
      BtnCircle icon: phosphor phone, size: 18px, color: var(--soft)
      BtnLabel: "Call"

  [rectangle] SectionDivider
    width: 100%; height: 8px
    background: var(--night) (#0F0F14)

  [frame] DiningSection
    width: 100%
    padding: 16px
    display: flex; flex-direction: column; gap: 12px

    [frame] DiningHead
      display: flex; flex-direction: row; gap: 8px; align-items: center

      [icon_font] SectionIcon
        Icon: phosphor fork-knife
        size: 16px
        color: var(--muted) (#8B8B94)

      [text] SectionLabel
        content: "DINING"
        font-family: JetBrains Mono; font-size: 11px; font-weight: 500
        letter-spacing: 1.5px
        color: var(--soft) (#A1A1AA)

    [frame] ServiceGrid
      width: 100%
      display: flex; flex-direction: row; gap: 8px

      [frame] ServiceCard-Duration
        flex: 1
        background: var(--dusk) (#1C1C24)
        border-radius: 8px
        padding: 12px
        display: flex; flex-direction: column; gap: 4px

        [text] CardLabel
          content: "MEAL DURATION"
          font-family: JetBrains Mono; font-size: 9px; font-weight: 500
          letter-spacing: 0.5px
          color: var(--muted) (#8B8B94)

        [text] CardValue
          content: "90–120 min"
          font-family: Outfit; font-size: 14px; font-weight: 600
          color: var(--cream) (#F5F5F3)

        [text] CardSub
          content: "Fine dining pace"
          font-family: Outfit; font-size: 10px; font-weight: normal
          color: var(--muted) (#8B8B94)

      [frame] ServiceCard-Reservations
        flex: 1
        background: var(--dusk) (#1C1C24)
        border-radius: 8px
        padding: 12px
        display: flex; flex-direction: column; gap: 4px

        [text] CardLabel
          content: "RESERVATIONS"
          font-family: JetBrains Mono; font-size: 9px; font-weight: 500
          letter-spacing: 0.5px
          color: var(--muted) (#8B8B94)

        [text] CardValue
          content: "Required"
          font-family: Outfit; font-size: 14px; font-weight: 600
          color: var(--coral) (#FF6B7A)

        [text] CardSub
          content: "Book 3–5 weeks out"
          font-family: Outfit; font-size: 10px; font-weight: normal
          color: var(--muted) (#8B8B94)

    [frame] CuisineRow
      width: 100%
      display: flex; flex-direction: column; gap: 8px

      [text] CuisineLabel
        content: "CUISINE"
        font-family: JetBrains Mono; font-size: 9px; font-weight: 500
        letter-spacing: 0.5px
        color: var(--muted) (#8B8B94)

      [frame] CuisineChips
        display: flex; flex-direction: row; gap: 6px; flex-wrap: wrap

        [frame] CuisineChip (repeating)
          border: 1px solid var(--twilight) (#252530) (inside)
          border-radius: 20px (var: $shape/chip-radius)
          padding: 5px 12px
          display: flex; justify-content: center; align-items: center

          [text] ChipText
            font-family: Outfit; font-size: 11px; font-weight: normal
            color: var(--soft) (#A1A1AA)

        — Chips: "New American", "Contemporary", "Seasonal"

    [frame] DietaryRow
      width: 100%
      display: flex; flex-direction: column; gap: 8px

      [text] DietaryLabel
        content: "DIETARY"
        font-family: JetBrains Mono; font-size: 9px; font-weight: 500
        letter-spacing: 0.5px
        color: var(--muted) (#8B8B94)

      [frame] DietaryChips
        display: flex; flex-direction: row; gap: 6px; flex-wrap: wrap

        [frame] DietaryChip (repeating)
          background: #00D9A01A
          border-radius: 20px (var: $shape/chip-radius)
          padding: 5px 12px
          display: flex; justify-content: center; align-items: center

          [text] ChipText
            font-family: Outfit; font-size: 11px; font-weight: normal
            color: var(--neon-green) (#00D9A0)

        — Chips: "Vegetarian", "Gluten-Free Options", "Vegan Adaptable"

  [rectangle] SectionDivider — same pattern: 100% x 8px, var(--night)

  [frame] GoodForSection
    width: 100%
    padding: 16px
    display: flex; flex-direction: column; gap: 12px

    [frame] GoodForHead
      display: flex; flex-direction: row; gap: 8px; align-items: center

      [icon_font] SectionIcon
        Icon: phosphor sparkle
        size: 16px
        color: var(--muted) (#8B8B94)

      [text] SectionLabel
        content: "GOOD FOR"
        font-family: JetBrains Mono; font-size: 11px; font-weight: 500
        letter-spacing: 1.5px
        color: var(--soft) (#A1A1AA)

    [frame] OccasionChips
      display: flex; flex-direction: row; gap: 6px; flex-wrap: wrap

      [frame] OccasionChip (repeating)
        border: 1px solid var(--twilight) (#252530) (inside)
        border-radius: 20px (var: $shape/chip-radius)
        padding: 5px 12px
        display: flex; justify-content: center; align-items: center

        [text] ChipText
          font-family: Outfit; font-size: 12px; font-weight: normal
          color: var(--soft) (#A1A1AA)

      — Chips: "Date Night", "Special Occasion", "Business Dinner", "Anniversary", "Celebration"

---

## Reusable Patterns

### Section Header Pattern
Identical to `event-concert-mobile.md`. Used by: Dining, Good For.
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

### Quick Action Button Pattern (circle, standard)
```
display: flex; flex-direction: column; gap: 6px; align-items: center
  [frame] circle: 40x40px, background: var(--dusk), border-radius: 20px, centered icon 18px var(--soft)
  [text] label: Outfit 11px normal, var(--muted)
```

### Quick Action Button Pattern (circle, accent)
Reserve button only:
```
display: flex; flex-direction: column; gap: 6px; align-items: center
  [frame] circle: 40x40px, background: var(--coral), border-radius: 20px, centered icon 18px #FFFFFF
  [text] label: Outfit 11px normal, var(--coral)
```

### Service Card Pattern
```
flex: 1; background: var(--dusk); border-radius: 8px; padding: 12px
display: flex; flex-direction: column; gap: 4px
  [text] label: JetBrains Mono 9px 500, letter-spacing: 0.5px, var(--muted), text-transform: uppercase
  [text] value: Outfit 14px 600, var(--cream)  [coral if notable status]
  [text] sub: Outfit 10px normal, var(--muted)
```

### Chip Pattern (standard)
```
border: 1px solid var(--twilight) (inside); border-radius: 20px; padding: 5px 12px
  [text] Outfit 11-12px normal, var(--soft)
```

### Chip Pattern (dietary/neon-green)
```
background: #00D9A01A; border-radius: 20px; padding: 5px 12px
  [text] Outfit 11px normal, var(--neon-green)
```

### Status Bar Pattern
```
padding: 0 16px 12px 16px; display: flex; flex-direction: row; gap: 8px; align-items: center
  [frame] OpenPill: background #00D9A01A, border-radius 20px, padding 4px 10px
    [ellipse] dot: 6x6px, background var(--neon-green)
    [text] Outfit 12px 500, var(--neon-green)
  [text] closes time: Outfit 12px normal, var(--muted)
  [text] "See hours": JetBrains Mono 11px 500, var(--coral)
```

---

## States

### Reserve Button
- default: background var(--coral), icon #FFFFFF, label color var(--coral)
- hover: background var(--coral)/90
- active: background var(--coral)/80

### Standard Quick Action Buttons
- default: background var(--dusk), icon var(--soft)
- hover: background var(--twilight), icon var(--cream)
- active: background var(--twilight)/80

### Cuisine Chips
- default: twilight border, soft text
- hover: background var(--twilight)/40

### Dietary Chips
- default: neon-green tinted bg, neon-green text
- hover: background #00D9A02A

### Occasion Chips
- default: twilight border, soft text
- hover: background var(--twilight)/40

---

## Shadows

No shadows in this comp.

---

## Responsive Notes

Extracted at 375px (mobile). Known breakpoint behavior:
- Desktop (>=1024px): DetailShell renders sidebar (340px sticky) + content (fluid) side-by-side
- Mobile (<1024px): full-width single column (this comp)
- ServiceGrid: 2-column at all breakpoints; cards stretch equally via flex: 1
- Chip rows: flex-wrap at all widths; desktop may show all chips without wrapping

---

## Implementation Constraint

**Do not add any CSS property not listed in this spec.** If an element needs a property not documented here (hover state, shadow, transition, z-index), stop and ask rather than improvising. The spec is the ceiling, not the floor.
