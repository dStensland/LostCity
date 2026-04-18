# Live Tonight Widget — Mobile Spec

**Source:** `docs/design-system.pen` node `UMEL6`
**Viewport:** 375px wide × 989px tall (extracted)
**Theme axis:** atlanta (default)
**Extraction date:** 2026-04-17

> Reference screenshot: `mcp__pencil__get_screenshot(filePath: "docs/design-system.pen", nodeId: "UMEL6")`. Pull this side-by-side with the spec while implementing.

---

## Component tree

[frame] LiveTonightWidget-Mobile (UMEL6)
  width: 375px
  padding: 16px
  display: flex
  flex-direction: column
  gap: 16px (variable per zone — see annotations)
  background: var(--void) (#09090B)

  [frame] FeedSectionHeader (0kztk)
    width: 343px
    height: 15px
    display: flex
    flex-direction: row
    justify-content: space-between
    align-items: center

    [frame] LeftCluster (k5bqo) — width: 118px, gap: 8px, layout: horizontal, align-items: center
      [icon_font] mic icon (LDzq1)
        Icon: phosphor microphone
        size: 14×14px
        color: var(--coral) (#FF6B7A)
      [text] section-label (syVG2)
        content: "LIVE TONIGHT"
        font-family: var(--font-mono) (JetBrains Mono)
        font-size: 12px
        font-weight: 600
        letter-spacing: 1.5px
        text-transform: uppercase
        color: var(--cream) (#F5F5F3)

    [frame] RightCluster (v4AnF) — width: 63px, gap: 4px, layout: horizontal, align-items: center
      [text] see-all (I81sa)
        content: "See all →"
        font-family: var(--font-mono) (JetBrains Mono)
        font-size: 12px
        font-weight: 500
        letter-spacing: 1px
        text-transform: uppercase
        color: var(--soft) (#A1A1AA)
      [icon_font] arrow (Qynyc)
        Icon: phosphor arrow-right
        size: 12×12px
        color: var(--soft) (#A1A1AA)

  [frame] ThisWeekHeroStrip (FvHQm)
    width: 343px
    margin-top: 16px
    display: flex
    flex-direction: column
    gap: 8px

    [frame] StripHeader (P5vBb)
      width: 343px
      display: flex
      flex-direction: row
      justify-content: space-between
      align-items: center

      [text] eyebrow (pWmiz)
        content: "THIS WEEK · 3 HEADLINERS"
        font-family: var(--font-mono) (JetBrains Mono)
        font-size: 10px
        font-weight: 600
        letter-spacing: 1.5px
        text-transform: uppercase
        color: var(--soft) (#A1A1AA)

      [text] meta-right (MjyC8)
        content: "Hurry, low stock" (or similar editorial micro-copy)
        font-family: var(--font-mono) (JetBrains Mono)
        font-size: 9px
        font-weight: 500
        letter-spacing: 1px
        text-transform: uppercase
        color: var(--muted) (#8B8B94)

    [frame] HeroTileRow (oxGRI)
      width: 343px
      height: 233px
      display: grid
      grid-template-columns: repeat(2, 1fr)
      gap: 0
      (2-up portrait tiles on mobile, 171.5px wide each, no gap — they touch)

      NOTE: The 3rd hero tile from desktop (Big Thief / Tabernacle / SOLD OUT) is
      hidden in this mobile comp. If data shape needs the 3rd visible, swap to a
      horizontal scroll-snap carousel; do NOT mask-fade the edges (see
      feedback_no_carousel_mask_fades). Default mobile = 2-up grid.

      [frame] HeroTile-1 (f9ihG → W9NtZ)
        width: 171.5px
        height: 233px
        position: relative
        background: linear-gradient(135deg, #2A1B3D 0%, #1A1230 60%, #0F0F14 100%)
          (atmospheric purple gradient — varies per artist, see desktop spec note)
        overflow: hidden
        border-radius: 0
        cursor: pointer

        [frame] CuratorPickBadge (G3Kbo)
          position: absolute
          top: 132px
          left: 12px
          height: 16px
          padding: 2px 6px
          background: var(--gold) (#FFD93D)
          border-radius: 0
          [text] content: "CURATOR PICK" (hY7Ua)
            font-family: var(--font-mono) (JetBrains Mono)
            font-size: 9px
            font-weight: 700
            letter-spacing: 1.5px
            text-transform: uppercase
            color: var(--void) (#09090B)

        [text] headliner (RQw7F)
          position: absolute
          top: 152px
          left: 12px
          width: 147.5px
          height: 17px
          content: "Phoebe Bridgers"
          font-family: var(--font-display) (Outfit)
          font-size: 15px
          font-weight: 600
          line-height: 1.2
          color: var(--cream) (#F5F5F3)

        [text] support (vHOJJ)
          position: absolute
          top: 173px
          left: 12px
          width: 147.5px
          height: 14px
          content: "with MUNA"
          font-family: var(--font-body) (Outfit)
          font-size: 12px
          font-weight: 400
          color: var(--soft) (#A1A1AA)

        [text] venue-time (IQXf3) — height 30 indicates 2 lines (venue \n time)
          position: absolute
          top: 191px
          left: 12px
          width: 147.5px
          height: 30px
          content: "The Eastern\n8:00 PM"
          font-family: var(--font-mono) (JetBrains Mono)
          font-size: 11px
          font-weight: 500
          letter-spacing: 0.4px
          line-height: 1.35
          font-variant-numeric: tabular-nums
          color: var(--gold) (#FFD93D)

      [frame] HeroTile-2 (7sfNz → hAM3E)
        width: 171.5px
        height: 233px
        background: linear-gradient(135deg, #3D1F1F 0%, #2A1612 60%, #1A0E0B 100%)
          (atmospheric warm-brown/red)
        (no badge on this tile — earned only)
        [text] headliner (oONnD) — height 34 indicates 2-line wrap
          position: absolute, top: 135px, left: 12px, width: 147.5px, height: 34px
          content: "Hurray for the Riff Raff"
          font-family: var(--font-display) (Outfit)
          font-size: 15px
          font-weight: 600
          line-height: 1.15
          color: var(--cream) (#F5F5F3)
        [text] support (KaJYq)
          position: absolute, top: 173px, left: 12px
          content: "with Katy Kirby"
          font-family: var(--font-body) (Outfit)
          font-size: 12px
          color: var(--soft) (#A1A1AA)
        [text] venue-time (QMuWE)
          position: absolute, top: 191px, left: 12px, height: 30px
          content: "Variety Playhouse\n9:00 PM"
          font-family: var(--font-mono) (JetBrains Mono)
          font-size: 11px
          font-weight: 500
          line-height: 1.35
          font-variant-numeric: tabular-nums
          color: var(--gold) (#FFD93D)

  [frame] DoorsImminentTicker (ndKw5)
    width: 343px
    margin-top: 16px (gap from hero strip)
    display: flex
    flex-direction: row
    justify-content: space-between
    align-items: center
    height: 19px

    [text] ticker-msg (orDnR)
      content: "● Doors at Smith's in 42 min"  (mobile abbreviates "Smith's Olde Bar" → "Smith's")
      width: 206px
      height: 19px
      font-family: var(--font-mono) (JetBrains Mono)
      font-size: 12px
      font-weight: 500
      letter-spacing: 0.3px
      color: var(--cream) (#F5F5F3)

      NOTE: leading "●" is a Pencil multi-color text workaround. Implementation MUST replace with:
        <span class="inline-block w-1.5 h-1.5 rounded-full bg-[var(--gold)] motion-safe:animate-pulse mr-1.5 align-middle" />
      Remove "●" from text content; only the span renders.

    [text] live-now (ag9nO)
      content: "LIVE NOW"
      width: 60px
      height: 13px
      font-family: var(--font-mono) (JetBrains Mono)
      font-size: 10px
      font-weight: 700
      letter-spacing: 1.5px
      text-transform: uppercase
      color: var(--gold) (#FFD93D)

  [frame] TonightZoneSubHeader (NF5sw)
    width: 343px
    margin-top: 16px
    display: flex
    flex-direction: row
    justify-content: space-between
    align-items: center
    height: 13px
    border-bottom: 1px solid var(--twilight) — sits ~12px below this header

    [text] left (Mn5Zp)
      content: "TONIGHT  ·  FRI APR 17  ·  14 SHOWS"
      width: 163px (text wraps tighter on mobile; if data exceeds width, ellipsize)
      font-family: var(--font-mono) (JetBrains Mono)
      font-size: 10px
      font-weight: 600
      letter-spacing: 1.3px
      text-transform: uppercase
      color: var(--soft) (#A1A1AA)

    [text] right (YgrY6)
      content: "6 OF 14 VENUES"
      width: 58px (abbreviates if needed)
      font-family: var(--font-mono) (JetBrains Mono)
      font-size: 10px
      font-weight: 500
      letter-spacing: 1.3px
      text-transform: uppercase
      color: var(--muted) (#8B8B94)

  ===== VENUE BLOCKS — playbill rows (mobile) =====
  Each VenueBlock is rendered as a top-level <a href={venueDetailHref}> with display:block.
  Whole block is the link target. NO caret arrows.

  [a → frame] VenueBlock-1 TERMINAL WEST (guZnV)
    width: 343px
    margin-top: 16px (first block); subsequent blocks gap: 16px
    padding: 12px 4px 0 4px
    display: flex
    flex-direction: column
    gap: 8px
    border-top: 1px solid var(--twilight)
    cursor: pointer

    [frame] marquee (zOFWw) — 335px, layout: row, justify-content: space-between, align-items: center
      [text] venue-name (hemhL)
        content: "TERMINAL WEST"
        height: 20px
        font-family: var(--font-mono)
        font-size: 14px
        font-weight: 700
        letter-spacing: 1.8px
        text-transform: uppercase
        color: var(--cream) (#F5F5F3)
      [text] kicker (Jdpit)
        content: "FAREWELL TOUR"
        font-family: var(--font-mono)
        font-size: 9px
        font-weight: 700
        letter-spacing: 1.5px
        text-transform: uppercase
        color: var(--vibe) (#A78BFA)
        text-align: right

    [frame] show-row primary (xo5tL) — 335px, layout: row, justify-content: space-between, padding-left: 16px
      [text] headliner (svbUn) "Kishi Bashi" — Outfit 13/500 cream
      [text] showtime (kk5OF) "8:00" — JetBrains Mono 12/500 gold tabular

    [frame] show-row support (OyUht) — padding-left: 16px
      [text] support-name (swSuy) "+ Tall Heights" — Outfit 12/400 soft
      [text] support-time (Egidd) "9:30" — JetBrains Mono 12/500 gold tabular

  [a → frame] VenueBlock-2 THE EARL (dpPMz)
    [frame] marquee (tY6Jd)
      [text] venue-name (jIpl2) "THE EARL"
      [text] kicker (Je8dW) "SOLD OUT TONIGHT" — color: var(--coral)
    [frame] show-row (yx9Yi)
      [text] headliner (n3eeP) "Lala Lala" cream
      [text] showtime (IRQNe) "7:30" gold

  [a → frame] VenueBlock-3 EDDIE'S ATTIC (HJRkx)
    [frame] marquee (zYwbJ)
      [text] venue-name (w4Tva) "EDDIE'S ATTIC"
      [text] kicker (Y8N6J) "SONGWRITER ROUND" — color: var(--vibe)
    [frame] show-row (RbIPt)
      [text] headliner (rlSR0) "Sarah Jarosz" cream
      [text] showtime (cPn3b) "7:00" gold

  [a → frame] VenueBlock-4 SMITH'S OLDE BAR (nm50H)
    [frame] marquee (DTG6T)
      [text] venue-name (Cb6gR) "SMITH'S OLDE BAR"
      (no kicker — node m0ktz is empty/0 width — suppress entirely)
    [frame] show-row primary (FFeXI)
      [text] headliner (2d1at) "Wild Pink" cream
      [text] showtime (KwITd) "7:30" gold
    [frame] show-row support (w8zPP)
      [text] support-name (EBNMW) "+ Cusses" soft
      [text] support-time (VAlUH) "10:00" gold tabular

  [a → frame] VenueBlock-5 AISLE 5 (oQHO0)
    [frame] marquee (7XplC)
      [text] venue-name (jFCco) "AISLE 5"
      [text] kicker (RPON7) "FREE TONIGHT" — color: var(--gold)
    [frame] show-row (V20tm)
      [text] headliner (FpIj7) "Snail Mail" cream
      [text] showtime (4ZkTr) "8:00" gold

  [a → frame] VenueBlock-6 VELVET NOTE (Wieoe)
    [frame] marquee (Cn5MQ)
      [text] venue-name (LO7uJ) "VELVET NOTE"
      [text] kicker (4mc5u) "LATE  ·  AFTER 9 PM" — color: var(--muted)
    [frame] show-row (mZApq)
      [text] headliner (0RDo2) "Joe Gransden Big Band" cream (long name; allow wrap to 2 lines if needed)
      [text] showtime (eXgLS) "10:30" gold tabular

  [frame] FooterLink (kFrHG)
    width: 343px
    margin-top: 16px
    [text] see-all (a4JDT)
      content: "See all 14 venues tonight  →"
      font-family: var(--font-mono) (JetBrains Mono)
      font-size: 11px
      font-weight: 500
      letter-spacing: 1px
      text-transform: uppercase
      color: var(--soft) (#A1A1AA)
      cursor: pointer
      hover: color: var(--cream)

---

## States

**HeroTile (link)**
- default: gradient bg as defined, headliner cream, footer gold
- hover (touch devices = active): brightness(1.05); on touch start
- active: `transform: scale(0.985); transition: transform 150ms ease`
- focus-visible: 2px outline outline-offset-2 outline-[var(--gold)]

**VenueBlock (link, the whole `<a>`)**
- default: bg transparent, top border var(--twilight)
- active (touch): `background: rgba(255, 217, 61, 0.05)`; transition 100ms
- focus-visible: 2px outline outline-offset-[-2px] outline-[var(--gold)]

**See-all links** (header + footer)
- default: var(--soft)
- active: var(--cream); arrow `transform: translateX(2px)`

**Doors-imminent ticker dot** (real `<span>`, not unicode)
- always: `motion-safe:animate-pulse` ~1.6s loop. Disable for `prefers-reduced-motion`.

**Tap targets** — every `<a>` (hero tile, venue block, see-all, ticker if linkable) must clear 44×44 minimum hit area. Venue blocks already exceed this; see-all may need extra padding on touch.

---

## Shadows

No shadows in this comp. Same cinematic-minimalism rule as desktop. Do NOT introduce `box-shadow`.

---

## Responsive Notes

- Extracted at 375px wide (iPhone SE / standard mobile baseline).
- Apply this layout for viewports <1024px. Desktop layout (`live-tonight-widget-desktop.md`) takes over at >=1024px.
- Hero strip is 2-up by default on mobile. The 3rd desktop tile is hidden. If the data set requires showing >2 hero tiles on mobile, switch the strip to a horizontal scroll-snap carousel (snap-x mandatory, snap-start on each tile, NO mask-fade on edges per `feedback_no_carousel_mask_fades`).
- Venue blocks remain a single-column stack with reduced 12-16px internal padding vs desktop's 14-24px.
- Long venue / artist names: allow up to 2-line wrap on mobile (e.g., "Joe Gransden Big Band"). Don't ellipsize the headliner; ellipsize the support name if needed.
- `TONIGHT · FRI APR 17 · 14 SHOWS` sub-header — at very narrow widths (<360px) the right-side "6 OF 14 VENUES" may need to wrap to a second line. Keep both texts left-aligned in that fallback rather than truncating.

---

## Implementation Constraint

**Do not add any CSS property not listed in this spec.** If an element needs a property not documented here (extra hover state, shadow, transition, z-index, animation), stop and ask rather than improvising. The spec is the ceiling, not the floor.

---

## Implementation hints (from comp design intent)

Same intent as the desktop spec. Mobile-specific notes:

1. **Letterboard playbill** is `<section>` with each VenueBlock being an `<a>` (whole block clickable). Top border on each block forms the rule.
2. **Editorial kickers earned, not always present** — same color rules as desktop. SMITH'S OLDE BAR shows the no-kicker case. One kicker per block max.
3. **Gold mono showtimes everywhere** — both hero tile times and venue-block showtimes use `var(--gold)`.
4. **Hero strip is 2-up on mobile by default.** The 3rd desktop tile is dropped, not collapsed into a smaller tile. Carousel is the escape hatch only if data requires it.
5. **Hero tile venue + time stack on two lines** on mobile (vs desktop's single line). The venue-time text node has height 30px = 2 line-height-1.35 lines at 11px.
6. **Sub-header text shrinks** to 10px mono with 1.3px letter-spacing on mobile (from 11px / 1.5px on desktop).
7. **Caret arrows still GONE.** Block IS the link.
8. **Doors-imminent ticker dot** must be a real `<span>` with CSS pulse, not unicode "●". On mobile the dot is `w-1.5 h-1.5` (6px), tighter than desktop's `w-2 h-2` (8px), to match the smaller body type.
9. **Late Night band** decision (separate sub-zone vs kicker on late venue) is the same as desktop — comp shows the kicker pattern, switch if data has 3+ late shows.
10. **No mask-fade** on any horizontal scroll surfaces in this widget.
