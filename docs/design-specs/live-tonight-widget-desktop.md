# Live Tonight Widget — Desktop Spec

**Source:** `docs/design-system.pen` node `xUkWi`
**Viewport:** 1024px wide × 1267px tall (extracted)
**Theme axis:** atlanta (default)
**Extraction date:** 2026-04-17

> Reference screenshot: `mcp__pencil__get_screenshot(filePath: "docs/design-system.pen", nodeId: "xUkWi")`. Pull this side-by-side with the spec while implementing.

---

## Component tree

[frame] LiveTonightWidget (xUkWi)
  width: 1024px
  padding: 24px
  display: flex
  flex-direction: column
  gap: 16px (variable per zone — see annotations)
  background: var(--void) (#09090B)

  [frame] FeedSectionHeader (O7Qs7)
    width: 976px (fill_container minus padding)
    height: 15px
    display: flex
    flex-direction: row
    justify-content: space-between
    align-items: center

    [frame] LeftCluster (B9SeI) — width: 118px, gap: 8px, layout: horizontal, align-items: center
      [icon_font] mic icon (0CdKu)
        Icon: phosphor microphone (or equivalent)
        size: 14×14px
        color: var(--coral) (#FF6B7A)
      [text] section-label (2yA2G)
        content: "LIVE TONIGHT"
        font-family: var(--font-mono) (JetBrains Mono)
        font-size: 12px
        font-weight: 600
        letter-spacing: 1.5px
        text-transform: uppercase
        color: var(--cream) (#F5F5F3)

    [frame] RightCluster (4lXRv) — width: 63px, gap: 4px, layout: horizontal, align-items: center
      [text] see-all (iC1o5)
        content: "See all →"
        font-family: var(--font-mono) (JetBrains Mono)
        font-size: 12px
        font-weight: 500
        letter-spacing: 1px
        text-transform: uppercase
        color: var(--soft) (#A1A1AA)
      [icon_font] arrow (byMqk)
        Icon: phosphor arrow-right
        size: 12×12px
        color: var(--soft) (#A1A1AA)

  [frame] ThisWeekHeroStrip (We5Mz)
    width: 976px
    margin-top: 16px (gap from header)
    display: flex
    flex-direction: column
    gap: 8px

    [frame] StripHeader (8YO9J)
      width: 976px
      display: flex
      flex-direction: row
      justify-content: space-between
      align-items: center

      [text] eyebrow (u1WhD)
        content: "THIS WEEK · 3 HEADLINERS"
        font-family: var(--font-mono) (JetBrains Mono)
        font-size: 11px
        font-weight: 600
        letter-spacing: 1.5px
        text-transform: uppercase
        color: var(--soft) (#A1A1AA)

      [text] meta-right (pUUlc)
        content: "Hurry, low stock" (or similar editorial micro-copy; conditional)
        font-family: var(--font-mono) (JetBrains Mono)
        font-size: 10px
        font-weight: 500
        letter-spacing: 1px
        text-transform: uppercase
        color: var(--muted) (#8B8B94)

    [frame] HeroTileRow (BMleC)
      width: 976px
      height: 410px
      display: grid
      grid-template-columns: repeat(3, 1fr)
      gap: 0
      (3 portrait tiles, 325.33px wide each, no gap between — they touch)

      [frame] HeroTile-1 (go61F → URfmg)
        width: 325.33px
        height: 410px
        position: relative
        background: linear-gradient(135deg, #2A1B3D 0%, #1A1230 60%, #0F0F14 100%)
          (atmospheric purple gradient — see screenshot; varies per tile / artist hero image fill)
        overflow: hidden
        border-radius: 0
        cursor: pointer

        [optional image] hero-image
          background: image-fill (cover) — top 290px, fades into footer area

        [frame] CuratorPickBadge (JVdfZ)
          position: absolute
          top: 306px (mid-tile, sits over gradient base)
          left: 16px
          height: 18px
          padding: 3px 7px
          background: var(--gold) (#FFD93D)
          border-radius: 0 (sharp letterboard corners)
          [text] content: "CURATOR PICK"
          font-family: var(--font-mono) (JetBrains Mono)
          font-size: 9px
          font-weight: 700
          letter-spacing: 1.5px
          text-transform: uppercase
          color: var(--void) (#09090B)

        [text] headliner (nFOeG)
          position: absolute
          top: 330px
          left: 16px
          width: 293.33px
          height: 21px
          content: "Phoebe Bridgers"
          font-family: var(--font-display) (Outfit)
          font-size: 18px
          font-weight: 600
          line-height: 1.15
          color: var(--cream) (#F5F5F3)

        [text] support (e2qwp)
          position: absolute
          top: 357px
          left: 16px
          width: 293.33px
          height: 16px
          content: "with MUNA"
          font-family: var(--font-body) (Outfit)
          font-size: 13px
          font-weight: 400
          color: var(--soft) (#A1A1AA)

        [text] venue-time (xDz0o)
          position: absolute
          top: 379px
          left: 16px
          width: 293.33px
          height: 15px
          content: "The Eastern · 8:00 PM"
          font-family: var(--font-mono) (JetBrains Mono)
          font-size: 11px
          font-weight: 500
          letter-spacing: 0.5px
          font-variant-numeric: tabular-nums
          color: var(--gold) (#FFD93D)

      [frame] HeroTile-2 (5LOlZ → Zzsgz)
        width: 325.33px
        height: 410px
        background: linear-gradient(135deg, #3D1F1F 0%, #2A1612 60%, #1A0E0B 100%)
          (atmospheric warm-brown/red gradient per screenshot)
        (no badge on this tile — earned only)
        [text] headliner (LHZJT) at top: 330px, left: 16px
          content: "Hurray for the Riff Raff"
          font-family: var(--font-display) (Outfit)
          font-size: 18px
          font-weight: 600
          line-height: 1.15
          color: var(--cream) (#F5F5F3)
        [text] support (X0B1K) at top: 357px, left: 16px
          content: "with Katy Kirby"
          font-family: var(--font-body) (Outfit)
          font-size: 13px
          color: var(--soft) (#A1A1AA)
        [text] venue-time (eL83p) at top: 379px, left: 16px
          content: "Variety Playhouse · 9:00 PM"
          font-family: var(--font-mono) (JetBrains Mono)
          font-size: 11px
          font-weight: 500
          font-variant-numeric: tabular-nums
          color: var(--gold) (#FFD93D)

      [frame] HeroTile-3 (IL047 → nJUme)
        width: 325.33px
        height: 410px
        background: linear-gradient(135deg, #1A2A3D 0%, #0F1A2A 60%, #0A1118 100%)
          (atmospheric blue/teal gradient)
        [frame] SoldOutBadge (ZW3tN)
          position: absolute
          top: 306px
          left: 16px
          height: 18px
          padding: 3px 7px
          background: var(--coral) (#FF6B7A)
          [text] content: "SOLD OUT"
          font-family: var(--font-mono) (JetBrains Mono)
          font-size: 9px
          font-weight: 700
          letter-spacing: 1.5px
          text-transform: uppercase
          color: var(--void) (#09090B)
        [text] headliner (WAWIb)
          position: absolute, top: 330px, left: 16px
          content: "Big Thief"
          font-family: var(--font-display) (Outfit)
          font-size: 18px
          font-weight: 600
          color: var(--cream) (#F5F5F3)
        [text] support (QIihd) at top: 357px
          content: "with Buck Meek"
          font-family: var(--font-body) (Outfit)
          font-size: 13px
          color: var(--soft) (#A1A1AA)
        [text] venue-time (JbFQN) at top: 379px
          content: "Tabernacle · 8:00 PM"
          font-family: var(--font-mono) (JetBrains Mono)
          font-size: 11px
          font-weight: 500
          font-variant-numeric: tabular-nums
          color: var(--gold) (#FFD93D)

  [frame] DoorsImminentTicker (njsVO)
    width: 976px
    margin-top: 16px (gap from hero strip)
    display: flex
    flex-direction: row
    justify-content: space-between
    align-items: center
    height: 20px

    [text] ticker-msg (GarkP)
      content: "● Doors at Smith's Olde Bar in 42 min"
      width: 244px
      height: 20px
      font-family: var(--font-mono) (JetBrains Mono)
      font-size: 13px
      font-weight: 500
      letter-spacing: 0.3px
      color: var(--cream) (#F5F5F3)

      NOTE: In the comp the leading dot is a unicode "●" character because Pencil
      doesn't support multi-color text runs. Implementation MUST replace this with
      a real element:
        <span class="inline-block w-2 h-2 rounded-full bg-[var(--gold)] motion-safe:animate-pulse mr-2 align-middle" />
      The "●" should be REMOVED from the text content; only the rendered span should appear.

    [text] live-now (wV2dm)
      content: "LIVE NOW"
      width: 64px
      height: 15px
      font-family: var(--font-mono) (JetBrains Mono)
      font-size: 11px
      font-weight: 700
      letter-spacing: 1.5px
      text-transform: uppercase
      color: var(--gold) (#FFD93D)

  [frame] TonightZoneSubHeader (Befq2)
    width: 976px
    margin-top: 16px
    display: flex
    flex-direction: row
    justify-content: space-between
    align-items: center
    height: 15px
    border-bottom: 1px solid var(--twilight) (#252530) — divider sits 12px below this header

    [text] left (pK33K)
      content: "TONIGHT  ·  FRI APR 17  ·  14 SHOWS"
      width: 280px
      font-family: var(--font-mono) (JetBrains Mono)
      font-size: 11px
      font-weight: 600
      letter-spacing: 1.5px
      text-transform: uppercase
      color: var(--soft) (#A1A1AA)

    [text] right (iHgrr)
      content: "6 OF 14 VENUES"
      width: 110px
      font-family: var(--font-mono) (JetBrains Mono)
      font-size: 11px
      font-weight: 500
      letter-spacing: 1.5px
      text-transform: uppercase
      color: var(--muted) (#8B8B94)

  ===== VENUE BLOCKS — playbill rows =====
  Each VenueBlock is rendered as a top-level <a href={venueDetailHref}> with display:block.
  The whole block is the link target. NO caret arrows.

  [a → frame] VenueBlock-1 TERMINAL WEST (Pou8p)
    width: 976px
    margin-top: 16px (gap above first block; subsequent blocks gap: 16px)
    padding: 14px 4px 0 4px (interior padding so marquee text sits flush with surrounding rule)
    display: flex
    flex-direction: column
    gap: 8px
    border-top: 1px solid var(--twilight) (#252530) — letterboard divider
    cursor: pointer
    transition: background 120ms ease

    [frame] marquee (kb8x7) — 968px wide, layout: row, justify-content: space-between, align-items: center
      [text] venue-name (w8KDF)
        content: "TERMINAL WEST"
        width: 180px
        height: 26px
        font-family: var(--font-mono) (JetBrains Mono)
        font-size: 18px
        font-weight: 700
        letter-spacing: 2px
        text-transform: uppercase
        color: var(--cream) (#F5F5F3)
      [text] kicker (TwBj8)
        content: "FAREWELL TOUR" (editorial kicker — vibe color)
        width: 102px
        font-family: var(--font-mono) (JetBrains Mono)
        font-size: 10px
        font-weight: 700
        letter-spacing: 1.5px
        text-transform: uppercase
        color: var(--vibe) (#A78BFA)
        text-align: right

    [frame] show-row primary (cTu2p) — 968px wide, layout: row, justify-content: space-between, padding-left: 18px
      [text] headliner (Zzonf)
        content: "Kishi Bashi"
        font-family: var(--font-display) (Outfit)
        font-size: 15px
        font-weight: 500
        color: var(--cream) (#F5F5F3)
      [text] showtime (4ddTc)
        content: "8:00"
        font-family: var(--font-mono) (JetBrains Mono)
        font-size: 13px
        font-weight: 500
        letter-spacing: 0.5px
        font-variant-numeric: tabular-nums
        color: var(--gold) (#FFD93D)

    [frame] show-row support (A9Uil) — 968px wide, layout: row, justify-content: space-between, padding-left: 18px
      [text] support-name (XDeSH)
        content: "+ Tall Heights"
        font-family: var(--font-body) (Outfit)
        font-size: 13px
        font-weight: 400
        color: var(--soft) (#A1A1AA)
      [text] support-time (TqIpP)
        content: "9:30"
        font-family: var(--font-mono) (JetBrains Mono)
        font-size: 13px
        font-weight: 500
        font-variant-numeric: tabular-nums
        color: var(--gold) (#FFD93D)

  [a → frame] VenueBlock-2 THE EARL (8hJBy)
    [frame] marquee (E1WeW)
      [text] venue-name (2dshC) "THE EARL" — same type as TERMINAL WEST
      [text] kicker (z6b20) "SOLD OUT TONIGHT" — color: var(--coral) (#FF6B7A)
    [frame] show-row (Hbqih) — single row, no support
      [text] headliner (yNkDX) "Lala Lala" — Outfit 15/500 cream
      [text] showtime (CzxO0) "7:30" — JetBrains Mono 13/500 gold tabular

  [a → frame] VenueBlock-3 EDDIE'S ATTIC (Wb5Th)
    [frame] marquee (PROR6)
      [text] venue-name (sBdMy) "EDDIE'S ATTIC"
      [text] kicker (pCrRr) "SONGWRITER ROUND" — color: var(--vibe) (#A78BFA)
    [frame] show-row (3BCuJ)
      [text] headliner (Rc7Xy) "Sarah Jarosz" cream
      [text] showtime (QsGum) "7:00" gold

  [a → frame] VenueBlock-4 SMITH'S OLDE BAR (JZvcf)
    [frame] marquee (mKSLQ)
      [text] venue-name (p2zyo) "SMITH'S OLDE BAR"
      (no kicker — kicker text node nx2Wj is empty/0 width — suppress entirely)
    [frame] show-row primary (cyZWI)
      [text] headliner (vz314) "Wild Pink" cream
      [text] showtime (LRnv1) "7:30" gold
    [frame] show-row support (M8n9g)
      [text] support-name (WODiY) "+ Cusses" soft
      [text] support-time (DfJdx) "10:00" gold tabular

  [a → frame] VenueBlock-5 AISLE 5 (2gls7)
    [frame] marquee (TdQ31)
      [text] venue-name (MTGr3) "AISLE 5"
      [text] kicker (Q95aS) "FREE TONIGHT" — color: var(--gold) (#FFD93D)
    [frame] show-row (jbj2W)
      [text] headliner (jqSeb) "Snail Mail" cream
      [text] showtime (Lloz7) "8:00" gold

  [a → frame] VenueBlock-6 VELVET NOTE (pfCBK)
    [frame] marquee (BZVh1)
      [text] venue-name (pgl4I) "VELVET NOTE"
      [text] kicker (7K5Je) "LATE  ·  AFTER 9 PM" — color: var(--muted) (#8B8B94)
    [frame] show-row (JLXWf)
      [text] headliner (gBs4T) "Joe Gransden Big Band" cream
      [text] showtime (qXq0q) "10:30" gold tabular

  [frame] FooterLink (VSnab)
    width: 976px
    margin-top: 24px
    [text] see-all (3oQMa)
      content: "See all 14 venues tonight  →"
      font-family: var(--font-mono) (JetBrains Mono)
      font-size: 12px
      font-weight: 500
      letter-spacing: 1px
      text-transform: uppercase
      color: var(--soft) (#A1A1AA)
      cursor: pointer
      hover: color: var(--cream) (#F5F5F3)

---

## States

**HeroTile (link)**
- default: gradient bg as defined, headliner cream, footer gold
- hover: subtle lift — `transform: translateY(-1px); transition: transform 200ms ease;` plus brightness(1.05) on the gradient
- focus-visible: 2px outline outline-offset-2 outline-[var(--gold)]
- active: `transform: translateY(0); brightness(0.97)`

**VenueBlock (link, the whole `<a>`)**
- default: bg transparent, top border var(--twilight)
- hover: `background: rgba(255, 217, 61, 0.03)` (gold at 3% — atmospheric, not loud); `transition: background 120ms ease`
- focus-visible: 2px outline outline-offset-[-2px] outline-[var(--gold)] inside the block
- active: bg darkens to `rgba(255, 217, 61, 0.06)`

**See-all links** (header + footer)
- default: var(--soft)
- hover: var(--cream); arrow `transform: translateX(2px); transition: transform 150ms ease`

**Doors-imminent ticker dot** (the real `<span>` replacing the unicode "●")
- always: `motion-safe:animate-pulse` — opacity oscillates between 1 and 0.6 at ~1.6s. Disable for `prefers-reduced-motion`.

---

## Shadows

No shadows in this comp. The widget intentionally uses solid-on-solid surfaces and atmospheric color, not card shadows. Do NOT introduce `box-shadow` in implementation — it breaks the cinematic-minimalism posture (see decision `2026-03-08-cinematic-minimalism-design`).

---

## Responsive Notes

- Extracted at 1024px wide (desktop). All sizing assumes a 976px content column inside 24px outer padding.
- Three-up hero strip is the desktop-only layout. At <1024px, see the mobile spec (`live-tonight-widget-mobile.md`) — strip collapses to 2-up tiles, 3rd tile is hidden (or carouseled per data shape).
- Venue blocks remain a single-column stack on desktop; mobile keeps the same stack with reduced padding.
- The widget is not intended for tablet (768-1023px) — clamp to mobile layout below 1024px.

---

## Implementation Constraint

**Do not add any CSS property not listed in this spec.** If an element needs a property not documented here (extra hover state, shadow, transition, z-index, animation), stop and ask rather than improvising. The spec is the ceiling, not the floor.

---

## Implementation hints (from comp design intent)

These decisions were made during comp design and must survive into code:

1. **Letterboard playbill** is `<section>` with each VenueBlock being an `<a>` (whole block clickable to venue detail). NOT a grid table. Top-border on each block creates the letterboard rule.
2. **Editorial kickers are EARNED** — most venue blocks have NONE. One kicker per block max. Suppress entirely if no kicker is earned (the comp's SMITH'S OLDE BAR demonstrates the no-kicker case).
   - vibe color (`var(--vibe)` #A78BFA): FAREWELL TOUR, RESIDENCY NIGHT, SONGWRITER ROUND, FIRST US DATE
   - gold color (`var(--gold)` #FFD93D): FREE TONIGHT
   - coral color (`var(--coral)` #FF6B7A): SOLD OUT TONIGHT
   - muted color (`var(--muted)` #8B8B94): LATE · AFTER 9 PM
3. **Gold mono showtimes everywhere.** The comp uses `var(--gold)` for all time text in venue blocks AND hero tiles. Replace any `var(--vibe)` time text from prior comp drafts with `var(--gold)`.
4. **Late Night band** — original spec had this as a separate sub-zone; the comp merged it as a kicker on the late venue (VELVET NOTE). Implementation chooses based on data shape:
   - if 1-2 late shows → merge as muted kicker on the venue block(s) (this comp's pattern)
   - if 3+ late shows → break out as separate "LATE NIGHT" sub-zone with its own sub-header
5. **Caret arrows are GONE from playbill rows.** The venue block IS the link target. Do not add `→` glyphs at row ends.
6. **Doors-imminent ticker** is conditional (≥1 show <90min from now). Disappears at 9PM local. The leading dot must be a real CSS-pulsing `<span>`, NOT the unicode "●" shown in the comp (that was a Pencil-text-rendering workaround).
7. **Hero tile gradients** — the comp uses bespoke gradients per artist (purple, warm brown, blue). Implementation should derive these from artist hero image data (extract dominant + secondary colors) or fall back to a small palette of curated gradients keyed off venue/genre. Do NOT hardcode the 3 gradients above into the component — they're examples.
