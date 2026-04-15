# Festival ATLFF — Mobile

**Source:** `docs/design-system.pen` node `1b6P3`
**Extracted:** 2026-04-15

---

## Component Tree

[frame] Root: v2 / Festival ATLFF — Mobile
  width: 375px
  background: var(--void) (#09090B) (themed: varies by portal)
  display: flex; flex-direction: column
  overflow: hidden

  [frame] Hero
    width: 100%; height: 240px
    background: image-fill (fill)
    position: relative (children absolutely positioned)

    [frame] HeroGrad  {absolute, fills parent}
      width: 100%; height: 100%
      background: linear-gradient(0deg, transparent 20%, #09090BEE 100%)

    [frame] FestivalBadge  {absolute, bottom: 16px, left: 16px}
      background: #E879F9CC
      border-radius: 4px
      padding: 3px 8px
      display: flex; flex-direction: row; gap: 4px; align-items: center

      [icon_font] BadgeIcon
        Icon: phosphor film-slate
        size: 12px
        color: #FFFFFF

      [text] BadgeText
        content: "FILM FESTIVAL"
        font-family: JetBrains Mono; font-size: 9px; font-weight: 700
        letter-spacing: 1px
        color: #FFFFFF

  [frame] Identity
    width: 100%
    padding: 16px 16px 12px 16px
    display: flex; flex-direction: column; gap: 8px

    [text] Title
      content: "Atlanta Film Festival 2026"
      font-family: Outfit; font-size: 26px; font-weight: 700
      color: var(--cream) (#F5F5F3)

    [frame] DateRow
      width: 100%
      display: flex; flex-direction: row; gap: 6px; align-items: center

      [icon_font] DateIcon
        Icon: phosphor calendar-blank
        size: 14px
        color: var(--gold) (#FFD93D)

      [text] DateText
        content: "Apr 24 – May 3, 2026"
        font-family: Outfit; font-size: 13px; font-weight: normal
        color: var(--soft) (#A1A1AA)

    [frame] LocationRow
      width: 100%
      display: flex; flex-direction: row; gap: 6px; align-items: flex-start

      [icon_font] LocationIcon
        Icon: phosphor map-pin
        size: 14px
        color: var(--muted) (#8B8B94)
        margin-top: 2px

      [text] LocationText
        content: "Plaza Theatre, Landmark Midtown Art Cinema, and 4 more Atlanta venues"
        font-family: Outfit; font-size: 13px; font-weight: normal
        color: var(--soft) (#A1A1AA)
        text-wrap: enabled (width: 100%)

  [frame] TemporalBanner
    width: 100%
    padding: 0 16px 12px 16px

    [frame] BannerInner
      width: 100%
      background: #FFD93D15
      border-radius: 10px
      padding: 10px 14px
      display: flex; flex-direction: row; gap: 10px; align-items: center

      [ellipse] GoldDot
        width: 8px; height: 8px
        background: var(--gold) (#FFD93D)
        flex-shrink: 0

      [text] CountdownText
        content: "Starts in 9 days"
        font-family: Outfit; font-size: 13px; font-weight: 600
        color: var(--gold) (#FFD93D)
        flex: 1

      [frame] GetPassesBtn
        background: var(--gold) (#FFD93D)
        border-radius: 8px
        padding: 6px 12px
        display: flex; justify-content: center; align-items: center

        [text] BtnText
          content: "Get Passes"
          font-family: Outfit; font-size: 12px; font-weight: 600
          color: var(--void) (#09090B)

  [frame] ExperienceTags
    width: 100%
    padding: 0 16px 16px 16px
    display: flex; flex-direction: row; gap: 8px; flex-wrap: wrap

    [frame] ExperienceChip (repeating)
      background: #E879F91A
      border-radius: 20px (var: $shape/chip-radius)
      padding: 5px 12px
      display: flex; flex-direction: row; gap: 6px; align-items: center

      [text] ChipText
        font-family: Outfit; font-size: 11px; font-weight: normal
        color: #E879F9

    — Chips (with emoji prefix in text): "🎬 Feature Films", "🎤 Q&As", "🏆 Competitions", "🌍 International", "🎭 Shorts"

  [rectangle] SectionDivider
    width: 100%; height: 8px
    background: var(--night) (#0F0F14)

  [frame] ScheduleSection
    width: 100%
    padding: 16px
    display: flex; flex-direction: column; gap: 12px

    [frame] ScheduleHead
      display: flex; flex-direction: row; gap: 8px; align-items: center

      [icon_font] SectionIcon
        Icon: phosphor calendar-dots
        size: 16px
        color: var(--muted) (#8B8B94)

      [text] SectionLabel
        content: "SCHEDULE"
        font-family: JetBrains Mono; font-size: 11px; font-weight: 500
        letter-spacing: 1.5px
        color: var(--soft) (#A1A1AA)

      [frame] ScheduleCount
        background: var(--twilight) (#252530)
        border-radius: 10px
        padding: 2px 8px

        [text] CountText
          content: "158"
          font-family: JetBrains Mono; font-size: 10px; font-weight: 500
          color: var(--muted) (#8B8B94)

    [frame] DayTabRow
      width: 100%
      display: flex; flex-direction: row; gap: 8px; overflow-x: auto
      padding-bottom: 2px

      [frame] DayPill-Active  {active state}
        background: var(--coral) (#FF6B7A)
        border-radius: 10px
        padding: 8px 12px
        display: flex; flex-direction: column; align-items: center; gap: 2px

        [text] DayLabel-Active
          content: "THU"
          font-family: JetBrains Mono; font-size: 9px; font-weight: 500
          letter-spacing: 0.5px
          color: #FFFFFF

        [text] DateNumber-Active
          content: "24"
          font-family: Outfit; font-size: 16px; font-weight: 700
          color: #FFFFFF

      [frame] DayPill-Inactive (repeating — FRI/25, SAT/26, SUN/27)
        background: var(--dusk) (#1C1C24)
        border: 1px solid var(--twilight) (#252530) (inside)
        border-radius: 10px
        padding: 8px 12px
        display: flex; flex-direction: column; align-items: center; gap: 2px

        [text] DayLabel-Inactive
          font-family: JetBrains Mono; font-size: 9px; font-weight: 500
          letter-spacing: 0.5px
          color: var(--muted) (#8B8B94)

        [text] DateNumber-Inactive
          font-family: Outfit; font-size: 16px; font-weight: 600
          color: var(--cream) (#F5F5F3)

      [frame] OverflowPill
        background: var(--dusk) (#1C1C24)
        border: 1px solid var(--twilight) (#252530) (inside)
        border-radius: 10px
        padding: 8px 12px
        display: flex; flex-direction: column; align-items: center; gap: 2px

        [text] OverflowText
          content: "+6"
          font-family: JetBrains Mono; font-size: 9px; font-weight: 500
          color: var(--muted) (#8B8B94)

    [frame] SessionCard (repeating)
      width: 100%
      display: flex; flex-direction: row; gap: 12px; align-items: flex-start
      padding: 10px 0
      border-bottom: 1px solid var(--twilight) (#252530)

      [frame] TimeColumn
        width: 50px
        flex-shrink: 0
        display: flex; flex-direction: column; align-items: flex-start; gap: 0px

        [text] TimeValue
          content: "7:30"
          font-family: JetBrains Mono; font-size: 14px; font-weight: 600
          color: var(--cream) (#F5F5F3)

        [text] TimePeriod
          content: "PM"
          font-family: JetBrains Mono; font-size: 9px; font-weight: 500
          color: var(--muted) (#8B8B94)

      [frame] TimeDivider
        width: 1px; height: 40px
        background: var(--twilight) (#252530)
        flex-shrink: 0
        align-self: center

      [frame] InfoColumn
        flex: 1
        display: flex; flex-direction: column; gap: 4px

        [frame] TitleRow
          display: flex; flex-direction: row; gap: 6px; align-items: flex-start; flex-wrap: wrap

          [text] SessionTitle
            content: "Past Lives"
            font-family: Outfit; font-size: 14px; font-weight: 600
            color: var(--cream) (#F5F5F3)

          [frame] SelectionBadge  {optional, appears on festival entries}
            background: #FFD93D1A
            border-radius: 4px
            padding: 2px 6px
            display: flex; justify-content: center; align-items: center

            [text] BadgeText
              content: "Official Selection"
              font-family: JetBrains Mono; font-size: 9px; font-weight: 500
              color: var(--gold) (#FFD93D)

        [text] SessionMeta
          content: "Plaza Theatre · 2h 6m · Dir. Celine Song"
          font-family: Outfit; font-size: 11px; font-weight: normal
          color: var(--muted) (#8B8B94)

    — SessionCard repeated for additional sessions (last card omits bottom border)

    [frame] SeeAllRow
      width: 100%
      padding-top: 4px
      display: flex; justify-content: center; align-items: center

      [text] SeeAllLink
        content: "See all 24 events on Apr 24 →"
        font-family: JetBrains Mono; font-size: 11px; font-weight: 500
        color: var(--coral) (#FF6B7A)
        text-align: center

  [rectangle] SectionDivider — same pattern: 100% x 8px, var(--night)

  [frame] ConnectionsSection
    width: 100%
    padding: 16px
    display: flex; flex-direction: column; gap: 10px

    [frame] ConnHead — same header pattern as ScheduleHead
      [icon_font] Icon: phosphor graph, size: 16px, color: var(--muted)
      [text] "CONNECTIONS" — JetBrains Mono 11px 500, tracking 1.5px, var(--soft)

    [frame] ConnOrg — standard connection row pattern
      IconBox icon: phosphor buildings, size: 18px, color: var(--soft)
      Label: "Atlanta Film Festival Organization"
      ContextLine: "Non-profit · Founded 1976"

    [frame] ConnVenues — standard connection row pattern
      IconBox icon: phosphor map-pin, size: 18px, color: var(--soft)
      Label: "6 Venues"
      ContextLine: "Plaza Theatre, Landmark Midtown Art Cinema, +4 more"

---

## Reusable Patterns

### Section Header Pattern
Identical to `event-concert-mobile.md`. Used by: Schedule, Connections.
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

### Date Pill Pattern (active)
Same as `place-cinema-mobile.md`.
```
background: var(--coral); border-radius: 10px; padding: 8px 12px
display: flex; flex-direction: column; align-items: center; gap: 2px
  [text] day: JetBrains Mono 9px 500, letter-spacing: 0.5px, color: #FFFFFF
  [text] number: Outfit 16px 700, color: #FFFFFF
```

### Date Pill Pattern (inactive)
Same as `place-cinema-mobile.md`.
```
background: var(--dusk); border: 1px solid var(--twilight) (inside); border-radius: 10px; padding: 8px 12px
display: flex; flex-direction: column; align-items: center; gap: 2px
  [text] day: JetBrains Mono 9px 500, letter-spacing: 0.5px, color: var(--muted)
  [text] number: Outfit 16px 600, color: var(--cream)
```

### Session Card Pattern
```
width: 100%; display: flex; flex-direction: row; gap: 12px; align-items: flex-start
padding: 10px 0; border-bottom: 1px solid var(--twilight)
  [frame] TimeColumn: width 50px, flex-column, gap 0
    [text] time: JetBrains Mono 14px 600, var(--cream)
    [text] AM/PM: JetBrains Mono 9px 500, var(--muted)
  [frame] divider: 1px x 40px, background var(--twilight), align-self center
  [frame] InfoColumn: flex-1, flex-column, gap 4px
    [frame] TitleRow: flex-row, gap 6px, flex-wrap
      [text] title: Outfit 14px 600, var(--cream)
      [frame] SelectionBadge (optional): #FFD93D1A bg, border-radius 4px, padding 2px 6px
        [text] JetBrains Mono 9px 500, var(--gold)
    [text] meta: Outfit 11px normal, var(--muted)
```

---

## States

### Day Tabs
- active: background var(--coral), white text (same as cinema date pills)
- inactive: dusk bg, twilight border, muted day, cream number
- hover (inactive): background var(--twilight)/60

### Get Passes Button
- default: background var(--gold), text var(--void)
- hover: background var(--gold)/90
- active: background var(--gold)/80

### See All Link
- default: color var(--coral)
- hover: color var(--coral)/80, text-decoration: underline

### Connection Rows
- default: as specified above
- hover: background var(--dusk)

---

## Shadows

No shadows in this comp.

---

## Responsive Notes

Extracted at 375px (mobile). Known breakpoint behavior:
- Desktop (>=1024px): DetailShell renders sidebar (340px sticky) + content (fluid) side-by-side
- Mobile (<1024px): full-width single column (this comp)
- Hero height: 240px mobile; may scale on larger viewports
- Day tab row scrolls horizontally on mobile; desktop shows all tabs without overflow
- Session cards stack vertically at all breakpoints

---

## Implementation Constraint

**Do not add any CSS property not listed in this spec.** If an element needs a property not documented here (hover state, shadow, transition, z-index), stop and ask rather than improvising. The spec is the ceiling, not the floor.
