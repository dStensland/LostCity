# Event Concert — Mobile

**Source:** `docs/design-system.pen` node `LhPKq`
**Extracted:** 2026-04-15

![Reference](screenshots/event-concert-mobile.png)

---

## Component Tree

[frame] Root: v2 / Event Concert — Mobile
  width: 375px
  background: var(--void) (#09090B) (themed: varies by portal)
  display: flex; flex-direction: column
  overflow: hidden

  [frame] Hero
    width: 100%; height: 220px
    background: image-fill (fill)
    position: relative (children absolutely positioned)

    [frame] HeroGrad  {absolute, fills parent}
      width: 100%; height: 100%
      background: linear-gradient(0deg, transparent 30%, #09090BEE 100%)

    [frame] LiveTag  {absolute, top: 12px, left: 16px}
      background: #FF6B7A
      border-radius: 4px
      padding: 3px 8px
      display: flex; flex-direction: row; gap: 4px; align-items: center

      [ellipse] LiveIcon
        width: 6px; height: 6px
        background: #FFFFFF

      [text] LiveText
        content: "LIVE NOW"
        font-family: JetBrains Mono; font-size: 9px; font-weight: 700
        letter-spacing: 1px
        color: #FFFFFF

  [frame] Identity
    width: 100%
    padding: 16px 16px 12px 16px
    display: flex; flex-direction: column; gap: 8px

    [text] Title
      content: "Khruangbin"
      font-family: Outfit; font-size: 26px; font-weight: 700
      color: var(--cream) (#F5F5F3) (themed: varies by portal)

    [frame] VenueRow
      width: 100%
      display: flex; flex-direction: row; gap: 6px; align-items: center

      [icon_font] VenueIcon
        Icon: phosphor map-pin
        size: 14px
        color: var(--coral) (#FF6B7A) (themed: varies by portal)

      [text] VenueText
        content: "The Eastern · Reynoldstown"
        font-family: Outfit; font-size: 13px; font-weight: normal
        color: var(--soft) (#A1A1AA) (themed: varies by portal)

    [frame] DateRow
      width: 100%
      display: flex; flex-direction: row; gap: 8px; align-items: center

      [icon_font] DateIcon
        Icon: phosphor calendar-blank
        size: 14px
        color: var(--muted) (#8B8B94)

      [text] DateText
        content: "Sat, Mar 28 · Doors 7pm · Show 8pm"
        font-family: Outfit; font-size: 13px; font-weight: normal
        color: var(--soft) (#A1A1AA)

    [frame] PriceRow
      width: 100%
      display: flex; flex-direction: row; gap: 8px; align-items: center

      [icon_font] PriceIcon
        Icon: phosphor ticket
        size: 14px
        color: var(--muted) (#8B8B94)

      [text] PriceText
        content: "$45 – $85 · All Ages · Standing"
        font-family: Outfit; font-size: 13px; font-weight: normal
        color: var(--soft) (#A1A1AA)

  [frame] CtaRow
    width: 100%
    padding: 0 16px 12px 16px
    display: flex; flex-direction: row; gap: 10px; align-items: center

    [frame] TicketBtn
      width: 100%; height: 44px
      background: var(--coral) (#FF6B7A) (themed: varies by portal)
      border-radius: 22px
      display: flex; flex-direction: row; gap: 8px; justify-content: center; align-items: center

      [icon_font] TicketIcon
        Icon: phosphor ticket
        size: 18px
        color: #FFFFFF

      [text] TicketText
        content: "Get Tickets"
        font-family: Outfit; font-size: 14px; font-weight: 600
        color: #FFFFFF

    [frame] RsvpBtn
      width: 44px; height: 44px
      border: 1px solid var(--twilight) (#252530) (inside)
      border-radius: 22px
      display: flex; flex-direction: column; justify-content: center; align-items: center

      [icon_font] RsvpIcon
        Icon: phosphor hand-waving
        size: 18px
        color: var(--soft) (#A1A1AA)

  [frame] ActionsRow
    width: 100%
    padding: 0 16px 16px 16px
    display: flex; flex-direction: row; gap: 8px; justify-content: center

    [frame] SaveBtn
      width: 40px; height: 40px
      border: 1px solid var(--twilight) (#252530) (inside)
      border-radius: 12px
      display: flex; flex-direction: column; justify-content: center; align-items: center

      [icon_font] SaveIcon
        Icon: phosphor bookmark-simple
        size: 18px
        color: var(--soft) (#A1A1AA)

    [frame] InviteBtn — same pattern as SaveBtn
      [icon_font] Icon: phosphor user-plus, size: 18px, color: var(--soft)

    [frame] CalBtn — same pattern as SaveBtn
      [icon_font] Icon: phosphor calendar-plus, size: 18px, color: var(--soft)

    [frame] ShareBtn — same pattern as SaveBtn
      [icon_font] Icon: phosphor share-network, size: 18px, color: var(--soft)

  [rectangle] SectionDivider
    width: 100%; height: 8px
    background: var(--night) (#0F0F14)

  [frame] LineupSection
    width: 100%
    padding: 16px
    display: flex; flex-direction: column; gap: 12px

    [frame] LineupHead
      display: flex; flex-direction: row; gap: 8px; align-items: center

      [icon_font] LineupIcon
        Icon: phosphor microphone-stage
        size: 16px
        color: var(--muted) (#8B8B94)

      [text] LineupLabel
        content: "LINEUP"
        font-family: JetBrains Mono; font-size: 11px; font-weight: 500
        letter-spacing: 1.5px
        color: var(--soft) (#A1A1AA)

      [frame] LineupCount
        background: var(--twilight) (#252530)
        border-radius: 10px
        padding: 2px 8px
        display: flex; justify-content: center; align-items: center

        [text] CountText
          content: "2"
          font-family: JetBrains Mono; font-size: 10px; font-weight: 500
          color: var(--muted) (#8B8B94)

    [frame] Artist1 (headliner card)
      width: 100%
      background: var(--night) (#0F0F14)
      border: 1px solid var(--twilight) (#252530) (inside)
      border-radius: 12px (var: $shape/card-radius)
      padding: 12px
      display: flex; flex-direction: row; gap: 12px; align-items: center

      [frame] A1Img
        width: 48px; height: 48px
        border-radius: 24px
        background: image-fill (fill)

      [frame] A1Info
        width: 100%
        display: flex; flex-direction: column; gap: 2px

        [frame] A1Name
          display: flex; flex-direction: row; gap: 6px; align-items: center

          [text] A1NameText
            content: "Khruangbin"
            font-family: Outfit; font-size: 14px; font-weight: 600
            color: var(--cream) (#F5F5F3)

          [frame] A1Badge
            background: #FF6B7A33
            border-radius: 4px
            padding: 2px 6px

            [text] BadgeText
              content: "HEADLINER"
              font-family: JetBrains Mono; font-size: 8px; font-weight: 600
              letter-spacing: 0.5px
              color: var(--coral) (#FF6B7A)

        [text] A1Meta
          content: "Houston, TX · Funk, World, Psychedelia"
          font-family: Outfit; font-size: 11px; font-weight: normal
          color: var(--muted) (#8B8B94)

    [frame] Artist2 (support card)
      width: 100%
      background: var(--night) (#0F0F14)
      border: 1px solid var(--twilight) (#252530) (inside)
      border-radius: 12px
      padding: 8px 12px
      display: flex; flex-direction: row; gap: 12px; align-items: center

      [frame] A2Img
        width: 36px; height: 36px
        border-radius: 18px
        background: image-fill (fill)

      [frame] A2Info
        width: 100%
        display: flex; flex-direction: column; gap: 2px

        [frame] A2Row
          display: flex; flex-direction: row; gap: 6px; align-items: center

          [text] A2Name
            content: "Men I Trust"
            font-family: Outfit; font-size: 13px; font-weight: 500
            color: var(--cream) (#F5F5F3)

          [text] A2Support
            content: "SUPPORT"
            font-family: JetBrains Mono; font-size: 8px; font-weight: 500
            letter-spacing: 0.5px
            color: var(--muted) (#8B8B94)

        [text] A2Meta
          content: "Montréal, QC · Indie Pop, Dream Pop"
          font-family: Outfit; font-size: 11px; font-weight: normal
          color: var(--muted) (#8B8B94)

  [rectangle] SectionDivider — same pattern: 100% x 8px, var(--night)

  [frame] ConnectionsSection
    width: 100%
    padding: 16px
    display: flex; flex-direction: column; gap: 10px

    [frame] ConnHead — same header pattern as LineupHead
      [icon_font] Icon: phosphor graph, size: 16px, color: var(--muted)
      [text] "CONNECTIONS" — JetBrains Mono 11px 500, tracking 1.5px, var(--soft)
      [frame] CountBadge — "3", same pattern as LineupCount

    [frame] ConnVenue (standard connection row)
      width: 100%
      background: var(--night) (#0F0F14)
      border-radius: 8px
      padding: 12px
      display: flex; flex-direction: row; gap: 12px; align-items: center

      [frame] IconBox
        width: 36px; height: 36px
        background: var(--twilight) (#252530)
        border-radius: 8px
        display: flex; flex-direction: column; justify-content: center; align-items: center

        [icon_font] Icon: phosphor map-pin, size: 18px, color: var(--soft)

      [frame] TextContent
        width: 100%
        display: flex; flex-direction: column; gap: 2px

        [text] Label
          content: "The Eastern"
          font-family: Outfit; font-size: 13px; font-weight: 500
          color: var(--cream) (#F5F5F3)

        [text] ContextLine
          content: "Music Venue · Reynoldstown · 14 upcoming"
          font-family: Outfit; font-size: 11px; font-weight: normal
          color: var(--muted) (#8B8B94)
          text-wrap: enabled

      [icon_font] Arrow
        Icon: phosphor arrow-right
        size: 14px
        color: var(--twilight) (#252530)

    [frame] ConnSeries — same pattern as ConnVenue
      IconBox icon: phosphor repeat
      Label: "The New World Tour"
      ContextLine: "Tour · 3 Atlanta dates remaining"

    [frame] ConnFriends (social connection row — coral accent)
      width: 100%
      background: #FF6B7A0D
      border: 1px solid #FF6B7A33 (inside)
      border-radius: 8px
      padding: 12px
      display: flex; flex-direction: row; gap: 12px; align-items: center

      [frame] Avatars
        width: 52px; height: 20px
        position: relative

        [ellipse] Av1  {absolute, left: 0, top: 0}
          width: 20px; height: 20px
          background: linear-gradient(0deg, #FF6B7A 0%, #E855A0 100%)
          border: 2px solid var(--void) (#09090B) (outside)

        [ellipse] Av2  {absolute, left: 16px, top: 0}
          width: 20px; height: 20px
          background: linear-gradient(0deg, #FFD93D 0%, #FF6B7A 100%)
          border: 2px solid var(--void) (outside)

        [ellipse] Av3  {absolute, left: 32px, top: 0}
          width: 20px; height: 20px
          background: linear-gradient(0deg, #00D9A0 0%, #00D4E8 100%)
          border: 2px solid var(--void) (outside)

      [frame] TextContent
        width: 100%
        display: flex; flex-direction: column; gap: 2px

        [text] Label
          content: "3 friends going"
          font-family: Outfit; font-size: 13px; font-weight: 500
          color: var(--cream) (#F5F5F3)

        [text] ContextLine
          content: "Maya, Jordan, Alex"
          font-family: Outfit; font-size: 11px; font-weight: normal
          color: var(--muted) (#8B8B94)

      [icon_font] Arrow
        Icon: phosphor arrow-right
        size: 14px
        color: #FF6B7A66

  [rectangle] SectionDivider — same pattern

  [frame] AboutSection
    width: 100%
    padding: 16px
    display: flex; flex-direction: column; gap: 10px

    [frame] AboutHead — same header pattern
      [icon_font] Icon: phosphor article, size: 16px, color: var(--muted)
      [text] "ABOUT" — JetBrains Mono 11px 500, tracking 1.5px, var(--soft)

    [text] AboutBody
      content: "Khruangbin brings their signature blend of global psychedelia..."
      font-family: Outfit; font-size: 13px; font-weight: normal
      line-height: 1.6
      color: var(--soft) (#A1A1AA)
      text-wrap: enabled (width: 100%)

  [rectangle] SectionDivider — same pattern

  [frame] GettingThereSection
    width: 100%
    padding: 16px
    display: flex; flex-direction: column; gap: 12px

    [frame] GtHead — same header pattern
      [icon_font] Icon: phosphor navigation-arrow, size: 16px, color: var(--muted)
      [text] "GETTING THERE" — JetBrains Mono 11px 500, tracking 1.5px, var(--soft)

    [frame] VenueLocCard
      width: 100%
      background: var(--night) (#0F0F14)
      border: 1px solid var(--twilight) (#252530) (inside)
      border-radius: 12px
      padding: 12px
      display: flex; flex-direction: column; gap: 10px

      [text] Address
        content: "777 Memorial Dr SE\nReynoldstown, Atlanta, GA 30316"
        font-family: Outfit; font-size: 13px; font-weight: normal
        line-height: 1.4
        color: var(--cream) (#F5F5F3)
        text-wrap: enabled

      [frame] Transit
        width: 100%
        display: flex; flex-direction: column; gap: 6px

        [frame] MartaRow
          display: flex; flex-direction: row; gap: 8px; align-items: center
          [icon_font] Icon: phosphor train, size: 14px, color: var(--neon-green) (#00D9A0)
          [text] "King Memorial MARTA · 8 min walk" — Outfit 12px normal, var(--soft)

        [frame] ParkingRow
          display: flex; flex-direction: row; gap: 8px; align-items: center
          [icon_font] Icon: phosphor car, size: 14px, color: var(--muted)
          [text] "Free lot parking available" — Outfit 12px normal, var(--soft)

        [frame] BeltLineRow
          display: flex; flex-direction: row; gap: 8px; align-items: center
          [icon_font] Icon: phosphor path, size: 14px, color: var(--neon-cyan) (#00D4E8)
          [text] "BeltLine adjacent · Eastside Trail" — Outfit 12px normal, var(--soft)

  [rectangle] SectionDivider — same pattern

  [frame] NearbySection
    width: 100%
    padding: 16px
    display: flex; flex-direction: column; gap: 12px

    [frame] NearbyHead — same header pattern
      [icon_font] Icon: phosphor compass, size: 16px, color: var(--muted)
      [text] "NEARBY" — JetBrains Mono 11px 500, tracking 1.5px, var(--soft)

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

    — Row 1: "Bookhouse Pub" / "Bar · 2 min walk · Open now" / dot: var(--neon-green)
    — Row 2: "Little Bear" / "Restaurant · 4 min walk · Open til 11pm" / dot: var(--coral)
    — Row 3: "Muchacho" / "Coffee · 3 min walk · Closes 6pm" / dot: var(--gold)

---

## Reusable Patterns

### Section Header Pattern
Used by: Lineup, Connections, About, Getting There, Nearby
```
display: flex; flex-direction: row; gap: 8px; align-items: center
  [icon_font] size: 16px, color: var(--muted)
  [text] font-family: JetBrains Mono; font-size: 11px; font-weight: 500; letter-spacing: 1.5px; color: var(--soft); text-transform: uppercase
  [frame] count badge (optional): background: var(--twilight); border-radius: 10px; padding: 2px 8px
    [text] JetBrains Mono 10px 500, color: var(--muted)
```

### Section Divider Pattern
```
[rectangle] width: 100%; height: 8px; background: var(--night) (#0F0F14)
```

### Connection Row Pattern (standard)
```
width: 100%; background: var(--night); border-radius: 8px; padding: 12px
display: flex; flex-direction: row; gap: 12px; align-items: center
  [frame] IconBox: 36x36px, background: var(--twilight), border-radius: 8px, centered icon 18px
  [frame] TextContent: flex-column, gap: 2px
    [text] Label: Outfit 13px 500, var(--cream)
    [text] Context: Outfit 11px normal, var(--muted)
  [icon_font] Arrow: phosphor arrow-right, 14px, var(--twilight)
```

### Connection Row Pattern (social/coral accent)
Same as standard but:
```
background: #FF6B7A0D; border: 1px solid #FF6B7A33 (inside)
Avatar stack instead of icon box
Arrow color: #FF6B7A66
```

### Secondary Action Button Pattern
```
width: 40px; height: 40px; border: 1px solid var(--twilight) (inside); border-radius: 12px
display: flex; justify-content: center; align-items: center
  [icon_font] size: 18px, color: var(--soft)
```

---

## States

### Get Tickets Button (TicketBtn)
- default: background: var(--coral) (#FF6B7A); color: #FFFFFF
- hover: background: var(--coral)/90; transform: translateY(-1px)
- active: background: var(--coral)/80; transform: none
- disabled: opacity: 0.5; pointer-events: none

### RSVP Button (RsvpBtn)
- default: border: 1px solid var(--twilight); color: var(--soft)
- hover: background: var(--twilight)/50; color: var(--cream)

### Secondary Action Buttons (Save, Invite, Calendar, Share)
- default: border: 1px solid var(--twilight); color: var(--soft)
- hover: background: var(--twilight)/50; color: var(--cream)
- active: background: var(--twilight); color: var(--cream)

### Connection Rows
- default: as specified above
- hover: background lightens slightly (var(--dusk) for standard, #FF6B7A1A for coral)

---

## Shadows

No shadows in this comp.

---

## Responsive Notes

Extracted at 375px (mobile). Known breakpoint behavior:
- Desktop (>=1024px): DetailShell renders sidebar (340px sticky) + content (fluid) side-by-side
- Mobile (<1024px): sidebar stacks above content vertically (this comp)
- Hero aspect ratio: same at all breakpoints (16/10 equivalent via fixed 220px height)

---

## Implementation Constraint

**Do not add any CSS property not listed in this spec.** If an element needs a property not documented here (hover state, shadow, transition, z-index), stop and ask rather than improvising. The spec is the ceiling, not the floor.
