# Place Cinema — Mobile

**Source:** `docs/design-system.pen` node `dG8YG`
**Extracted:** 2026-04-15

---

## Component Tree

[frame] Root: v2 / Place Cinema — Mobile
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
      background: #FFD93D1A
      border-radius: 4px
      padding: 3px 8px
      align-self: flex-start

      [icon_font] BadgeIcon
        Icon: phosphor film-strip
        size: 12px
        color: var(--gold) (#FFD93D)

      [text] BadgeText
        content: "CINEMA"
        font-family: JetBrains Mono; font-size: 9px; font-weight: 700
        letter-spacing: 1px
        color: var(--gold) (#FFD93D)

    [text] Title
      content: "Plaza Theatre"
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
        content: "Poncey-Highland"
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
        content: "4.6"
        font-family: Outfit; font-size: 13px; font-weight: 600
        color: var(--gold) (#FFD93D)

      [text] RatingCount
        content: "(842)"
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
      content: "· Closes 11pm"
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

    [frame] WebsiteBtn
      display: flex; flex-direction: column; gap: 6px; align-items: center

      [frame] BtnCircle
        width: 40px; height: 40px
        background: var(--dusk) (#1C1C24)
        border-radius: 20px
        display: flex; justify-content: center; align-items: center

        [icon_font] Icon: phosphor globe-simple, size: 18px, color: var(--soft) (#A1A1AA)

      [text] BtnLabel
        content: "Website"
        font-family: Outfit; font-size: 11px; font-weight: normal
        color: var(--muted) (#8B8B94)

    [frame] DirectionsBtn — same pattern as WebsiteBtn
      BtnCircle icon: phosphor navigation-arrow, size: 18px, color: var(--soft)
      BtnLabel: "Directions"

    [frame] CallBtn — same pattern as WebsiteBtn
      BtnCircle icon: phosphor phone, size: 18px, color: var(--soft)
      BtnLabel: "Call"

  [rectangle] SectionDivider
    width: 100%; height: 8px
    background: var(--night) (#0F0F14)

  [frame] NowPlayingSection
    width: 100%
    padding: 16px
    display: flex; flex-direction: column; gap: 12px

    [frame] NowPlayingHead
      display: flex; flex-direction: row; gap: 8px; align-items: center

      [icon_font] SectionIcon
        Icon: phosphor film-strip
        size: 16px
        color: var(--muted) (#8B8B94)

      [text] SectionLabel
        content: "NOW PLAYING"
        font-family: JetBrains Mono; font-size: 11px; font-weight: 500
        letter-spacing: 1.5px
        color: var(--soft) (#A1A1AA)

    [frame] DatePillRow
      width: 100%
      display: flex; flex-direction: row; gap: 8px; overflow-x: auto
      padding-bottom: 2px

      [frame] DatePill-Active  {active state}
        background: var(--coral) (#FF6B7A)
        border-radius: 10px
        padding: 8px 12px
        display: flex; flex-direction: column; align-items: center; gap: 2px

        [text] DayLabel-Active
          content: "TODAY"
          font-family: JetBrains Mono; font-size: 9px; font-weight: 500
          letter-spacing: 0.5px
          color: #FFFFFF

        [text] DateNumber-Active
          content: "15"
          font-family: Outfit; font-size: 16px; font-weight: 700
          color: #FFFFFF

      [frame] DatePill-Inactive  {inactive state, repeating}
        background: var(--dusk) (#1C1C24)
        border: 1px solid var(--twilight) (#252530) (inside)
        border-radius: 10px
        padding: 8px 12px
        display: flex; flex-direction: column; align-items: center; gap: 2px

        [text] DayLabel-Inactive
          content: "WED"
          font-family: JetBrains Mono; font-size: 9px; font-weight: 500
          letter-spacing: 0.5px
          color: var(--muted) (#8B8B94)

        [text] DateNumber-Inactive
          content: "16"
          font-family: Outfit; font-size: 16px; font-weight: 600
          color: var(--cream) (#F5F5F3)

      — Remaining inactive pills follow same pattern for subsequent dates

    [frame] FilmCard (repeating pattern)
      width: 100%
      background: var(--night) (#0F0F14) (var: $color/card-bg)
      border: 1px solid var(--twilight) (#252530) (inside)
      border-radius: 12px (var: $shape/card-radius)
      padding: 12px
      display: flex; flex-direction: column; gap: 8px

      [frame] FilmInfo
        display: flex; flex-direction: column; gap: 4px

        [text] FilmTitle
          content: "The Substance"
          font-family: Outfit; font-size: 14px; font-weight: 600
          color: var(--cream) (#F5F5F3)

        [frame] FilmMetaRow
          display: flex; flex-direction: row; gap: 6px; align-items: center

          [text] FilmYear
            content: "2024"
            font-family: JetBrains Mono; font-size: 10px; font-weight: normal
            color: var(--muted) (#8B8B94)

          [text] FilmRating
            content: "R"
            font-family: JetBrains Mono; font-size: 10px; font-weight: normal
            color: var(--muted) (#8B8B94)

          [text] FilmRuntime
            content: "2h 21m"
            font-family: JetBrains Mono; font-size: 10px; font-weight: normal
            color: var(--muted) (#8B8B94)

      [frame] ShowtimePillRow
        display: flex; flex-direction: row; gap: 8px; flex-wrap: wrap

        [frame] ShowtimePill (repeating)
          border: 1px solid var(--coral) (#FF6B7A) (inside)
          border-radius: 6px
          padding: 6px 12px
          display: flex; justify-content: center; align-items: center

          [text] ShowtimeText
            content: "4:15 PM"
            font-family: JetBrains Mono; font-size: 11px; font-weight: 500
            color: var(--coral) (#FF6B7A)

        — Additional showtimes: "7:00 PM", "9:45 PM" — same pill pattern

    — FilmCard repeated for additional currently-playing films

  [rectangle] SectionDivider — same pattern: 100% x 8px, var(--night)

  [frame] ConnectionsSection
    width: 100%
    padding: 16px
    display: flex; flex-direction: column; gap: 10px

    [frame] ConnHead — same header pattern as NowPlayingHead
      [icon_font] Icon: phosphor graph, size: 16px, color: var(--muted)
      [text] "CONNECTIONS" — JetBrains Mono 11px 500, tracking 1.5px, var(--soft)

    [frame] ConnFestival  {gold accent connection row}
      width: 100%
      background: #FFD93D0D
      border: 1px solid #FFD93D33 (inside)
      border-radius: 8px
      padding: 12px
      display: flex; flex-direction: row; gap: 12px; align-items: center

      [frame] IconBox
        width: 36px; height: 36px
        background: #FFD93D1A
        border-radius: 8px
        display: flex; justify-content: center; align-items: center

        [icon_font] Icon: phosphor star-four, size: 18px, color: var(--gold) (#FFD93D)

      [frame] TextContent
        width: 100%
        display: flex; flex-direction: column; gap: 2px

        [text] Label
          content: "Atlanta Film Festival"
          font-family: Outfit; font-size: 13px; font-weight: 500
          color: var(--gold) (#FFD93D)

        [text] ContextLine
          content: "Official venue · 14 screenings this week"
          font-family: Outfit; font-size: 11px; font-weight: normal
          color: var(--muted) (#8B8B94)
          text-wrap: enabled

      [icon_font] Arrow
        Icon: phosphor arrow-right
        size: 14px
        color: #FFD93D66

    [frame] ConnOrg — standard connection row pattern
      IconBox icon: phosphor buildings, size: 18px, color: var(--soft)
      Label: "Landmark Theatres"
      ContextLine: "Organization · 3 Atlanta locations"

---

## Reusable Patterns

### Section Header Pattern
Identical to `event-concert-mobile.md`. Used by: Now Playing, Connections.
```
display: flex; flex-direction: row; gap: 8px; align-items: center
  [icon_font] size: 16px, color: var(--muted)
  [text] font-family: JetBrains Mono; font-size: 11px; font-weight: 500; letter-spacing: 1.5px; color: var(--soft); text-transform: uppercase
  [frame] count badge (optional): background: var(--twilight); border-radius: 10px; padding: 2px 8px
    [text] JetBrains Mono 10px 500, color: var(--muted)
```

### Section Divider Pattern
Identical to `event-concert-mobile.md`.
```
[rectangle] width: 100%; height: 8px; background: var(--night) (#0F0F14)
```

### Connection Row Pattern (standard)
Identical to `event-concert-mobile.md`.
```
width: 100%; background: var(--night); border-radius: 8px; padding: 12px
display: flex; flex-direction: row; gap: 12px; align-items: center
  [frame] IconBox: 36x36px, background: var(--twilight), border-radius: 8px, centered icon 18px
  [frame] TextContent: flex-column, gap: 2px
    [text] Label: Outfit 13px 500, var(--cream)
    [text] Context: Outfit 11px normal, var(--muted)
  [icon_font] Arrow: phosphor arrow-right, 14px, var(--twilight)
```

### Connection Row Pattern (gold/festival accent)
Same structure as standard but:
```
background: #FFD93D0D; border: 1px solid #FFD93D33 (inside)
IconBox background: #FFD93D1A; icon color: var(--gold)
Label color: var(--gold)
Arrow color: #FFD93D66
```

### Date Pill Pattern (active)
```
background: var(--coral); border-radius: 10px; padding: 8px 12px
display: flex; flex-direction: column; align-items: center; gap: 2px
  [text] day: JetBrains Mono 9px 500, letter-spacing: 0.5px, color: #FFFFFF
  [text] number: Outfit 16px 700, color: #FFFFFF
```

### Date Pill Pattern (inactive)
```
background: var(--dusk); border: 1px solid var(--twilight) (inside); border-radius: 10px; padding: 8px 12px
display: flex; flex-direction: column; align-items: center; gap: 2px
  [text] day: JetBrains Mono 9px 500, letter-spacing: 0.5px, color: var(--muted)
  [text] number: Outfit 16px 600, color: var(--cream)
```

### Film Card Pattern
```
width: 100%; background: var(--night); border: 1px solid var(--twilight) (inside); border-radius: 12px; padding: 12px
display: flex; flex-direction: column; gap: 8px
  [frame] FilmInfo: flex-column, gap: 4px
    [text] title: Outfit 14px 600, var(--cream)
    [frame] meta row: flex-row, gap: 6px
      [text] year/rating/runtime: JetBrains Mono 10px normal, var(--muted)
  [frame] showtime row: flex-row, gap: 8px, flex-wrap: wrap
    [frame] ShowtimePill: border 1px solid var(--coral) (inside), border-radius: 6px, padding: 6px 12px
      [text] JetBrains Mono 11px 500, var(--coral)
```

### Quick Action Button Pattern (circle)
```
display: flex; flex-direction: column; gap: 6px; align-items: center
  [frame] circle: 40x40px, background: var(--dusk), border-radius: 20px, centered icon 18px var(--soft)
  [text] label: Outfit 11px normal, var(--muted)
```

---

## States

### Date Pills
- active: background var(--coral), white text
- inactive: background var(--dusk), twilight border, muted day label, cream date number
- hover (inactive): background var(--twilight)/60, retain border

### Showtime Pills
- default: coral border, coral text
- hover: background var(--coral)/10
- active/selected: background var(--coral), text #FFFFFF

### Quick Action Buttons
- default: background var(--dusk), icon color var(--soft)
- hover: background var(--twilight), icon color var(--cream)
- active: background var(--twilight)/80

### Connection Rows
- default: as specified above
- hover: standard row background lightens to var(--dusk); festival row background to #FFD93D1A

---

## Shadows

No shadows in this comp.

---

## Responsive Notes

Extracted at 375px (mobile). Known breakpoint behavior:
- Desktop (>=1024px): DetailShell renders sidebar (340px sticky) + content (fluid) side-by-side
- Mobile (<1024px): full-width single column (this comp)
- Date pill row scrolls horizontally on mobile; wraps or expands on desktop
- Film cards stack vertically at all breakpoints; desktop may use 2-column grid

---

## Implementation Constraint

**Do not add any CSS property not listed in this spec.** If an element needs a property not documented here (hover state, shadow, transition, z-index), stop and ask rather than improvising. The spec is the ceiling, not the floor.
