# Big Stuff — Feed (Month Ribbon) — Visual Spec

**Pencil node:** `qOUCP` in `docs/design-system.pen`
**Extraction date:** 2026-04-18
**Viewport:** Desktop, 1024px content width (matches feedContent inner width at 1440 viewport − 2×208 padding)
**Registry status:** New composition — no existing registry entry. Justified in `docs/superpowers/plans/2026-04-18-big-stuff-month-ribbon.md` (rebuild of `FestivalsSection`). Add to registry post-ship.

---

## Component Tree

```
[frame] Big Stuff — Feed (Month Ribbon)
  background: #09090B (var(--void)) -- canvas bg; feedContent itself already paints --void
  display: flex; flex-direction: column
  gap: 16px
  padding: 32px 40px  -- outer padding for standalone preview; in feed, the feedContent wrapper already paints this
  width: 1024px

  [text] contextNote
    content: "Big Stuff — Feed (Month Ribbon) · desktop 1024 content width"
    -- spec-only annotation. NOT rendered in production.
    font-family: Space Mono
    font-size: 10px
    font-weight: normal
    letter-spacing: 0.5px
    color: var(--muted) (#8B8B94)

  [frame] section
    display: flex; flex-direction: column
    gap: 12px
    width: 100%

    [text] label
      content: "THE BIG STUFF — 6 months of plans"
      font-family: Space Mono
      font-size: 11px
      font-weight: normal
      letter-spacing: 1.5px
      color: var(--muted) (#8B8B94)
      text-transform: uppercase  -- content string is already uppercase; kept for semantic clarity

    [frame] titleRow
      display: flex; flex-direction: row
      align-items: center
      gap: 12px
      width: 100%

      [frame] badge
        display: flex; flex-direction: row
        align-items: center
        gap: 5px
        padding: 3px 7px
        background: #FFD93D1A (var(--gold) @ 10% alpha)
        border: 1px solid #FFD93D40 (var(--gold) @ 25% alpha)
        border-radius: 3px

        [icon_font] badgeIcon
          Icon: phosphor crown
          size: 10px
          color: var(--gold) (#FFD93D)
          weight: 500

        [text] badgeText
          content: "APR 2026"  -- dynamic: current month
          font-family: Space Mono
          font-size: 9px
          font-weight: 700
          letter-spacing: 0.8px
          color: var(--gold) (#FFD93D)

      [text] title
        content: "The Big Stuff"
        font-family: Bricolage Grotesque
        font-size: 22px
        font-weight: 700
        letter-spacing: -0.3px
        color: var(--cream) (#F5F5F3)

      [frame] spacer
        width: 100%  -- flex-grow:1 in implementation
        height: 1px

      [text] seeAll
        content: "See all →"
        font-family: Space Mono
        font-size: 11px
        font-weight: normal
        color: var(--gold) (#FFD93D)

  [frame] ribbon
    display: flex; flex-direction: row
    background: var(--night) (#0F0F14)
    border: 1px solid var(--twilight) (#252530)
    border-radius: 12px
    width: 100%
    overflow: hidden  -- rounded corners clip column borders cleanly

    [frame] m1 (APR — current month, 3 items)
      display: flex; flex-direction: column
      gap: 10px
      padding: 14px
      width: 100%  -- flex-grow:1 equal-share column
      -- no left border on the first column

      [frame] m1head
        display: flex; flex-direction: row
        align-items: center
        gap: 6px
        width: 100%

        [ellipse] m1dot  -- CURRENT MONTH marker
          width: 10px
          height: 10px
          background: var(--gold) (#FFD93D)
          -- spec dot is 10×10 but should render at 5×5 per design-truth. See Implementation Note A.

        [text] m1label
          content: "APR"
          font-family: Space Mono
          font-size: 11px
          font-weight: 700
          letter-spacing: 1.2px
          color: var(--cream) (#F5F5F3)

      [frame] m1e1
        display: flex; flex-direction: column
        gap: 2px
        width: 100%

        [text] m1e1t
          content: "Georgia Ren. Fest"
          font-family: Outfit
          font-size: 12px
          font-weight: 600
          line-height: 1.3
          color: var(--cream) (#F5F5F3)
          text-wrap: enabled  -- fixed-width; 1-line truncation in implementation

        [text] m1e1d
          content: "Through Jun 2 · Now"
          -- "· Now" suffix is from the original comp when happening-now items were included.
          -- In production, started events are filtered out; this item variant will not appear.
          -- Treat this as the "ongoing" date-format sample; the gold color DOES apply to the
          -- current-month column's first item IF it's happening-now, per the earlier comp.
          font-family: Space Mono
          font-size: 10px
          font-weight: normal
          letter-spacing: 0.3px
          color: var(--gold) (#FFD93D)

      [frame] m1e2
        display: flex; flex-direction: column
        gap: 2px
        width: 100%

        [text] m1e2t
          content: "Dogwood Festival"
          font-family: Outfit
          font-size: 12px
          font-weight: 600
          line-height: 1.3
          color: var(--cream) (#F5F5F3)

        [text] m1e2d
          content: "Apr 11 – 13"
          font-family: Space Mono
          font-size: 10px
          font-weight: normal
          letter-spacing: 0.3px
          color: var(--muted) (#8B8B94)

      [frame] m1e3
        display: flex; flex-direction: column
        gap: 2px
        width: 100%

        [text] m1e3t
          content: "Atlanta Film Fest"
          font-family: Outfit
          font-size: 12px
          font-weight: 600
          line-height: 1.3
          color: var(--cream) (#F5F5F3)

        [text] m1e3d
          content: "Apr 24 – May 4"
          font-family: Space Mono
          font-size: 10px
          font-weight: normal
          letter-spacing: 0.3px
          color: var(--muted) (#8B8B94)

    [frame] m2 (MAY — 3 items)
      display: flex; flex-direction: column
      gap: 10px
      padding: 14px
      width: 100%
      border-left: 1px solid var(--twilight) (#252530)  -- columns 2..N have left border

      [frame] m2head
        display: flex; flex-direction: row
        align-items: center
        gap: 6px
        width: 100%

        [text] m2label
          content: "MAY"
          font-family: Space Mono
          font-size: 11px
          font-weight: 700
          letter-spacing: 1.2px
          color: var(--cream) (#F5F5F3)

      [frame] m2e1 .. m2e3
        Same shape as m1e1..m1e3 with MAY content:
          "Shaky Knees" / "May 2 – 4"
          "Sweetwater 420" / "May 16 – 17"
          "Atl. Jazz Festival" / "May 24 – 26"
        Date colors are all var(--muted) (#8B8B94) — no gold suffix (not happening-now).

    [frame] m3 (JUN — 2 items)
      Same shape as m2. Content:
        "Atlanta Pride" / "Jun 6 – 7"
        "Juneteenth ATL" / "Jun 19"

    [frame] m4 (JUL — 1 item, sparse)
      Same shape. Content:
        "Peachtree Rd Race" / "Jul 4"
      -- NOTE: month label "JUL" gets opacity 0.4 in implementation because items < 2
      -- and it is not the current month. Spec shows full-opacity label; this is an
      -- implementation rule from plan Task 6, not a Pencil override.

    [frame] m5 (AUG — 0 items)
      Same shape. Content:
        [text] m5empty
          content: "—"  -- em-dash
          font-family: Space Mono
          font-size: 14px
          color: var(--muted) (#8B8B94)
      -- NOTE: in implementation, AUG will be removed entirely (0 items means skip column
      -- unless it's the current month, per plan). The em-dash in the spec is archival —
      -- do not render it in code.

    [frame] m6 (SEP — 2 items)
      Same shape. Content:
        "Music Midtown" / "Sep 13 – 14"
        "A3C Festival" / "Sep 20 – 27"
```

---

## Implementation Notes

**A. Current-month dot.** The Pencil comp draws the dot at 10×10px. In implementation render it at **5×5px** to match the compact ribbon scale — the comp dimension was set large for legibility in the design canvas; the production scale is smaller. Gold fill unchanged.

**B. Happening-now suffix (`· Now`).** The original comp included a "· Now" gold suffix on ongoing festivals (Georgia Ren. Fest sample). Per plan data rules, the production data filter is `start_date > today`, so no items currently running will ever appear in the ribbon. The gold-colored suffix treatment is therefore **not needed in v1**. The gold color style on item dates should NOT be implemented for v1. If/when the data window is widened to include in-progress items, re-introduce the gold treatment with the `· Now` text. For v1, **all item dates render in `var(--muted)` (#8B8B94)**.

**C. Sparse-month opacity.** Columns with fewer than 2 items get `opacity: 0.4` on the month label ONLY (not the items). Exception: the current month column always renders at full opacity regardless of item count (the gold dot is the "you are here" anchor). This rule is NOT in the Pencil comp — it's implementation-only per plan Task 6.

**D. Empty-month skip.** Columns with zero items should be removed from the rendered ribbon entirely (`trimVisibleMonths` in `BigStuffSection.tsx`). The em-dash in the AUG sample is archival Pencil content — do not render it.

**E. Container padding.** The `32px 40px` padding on the outer `qOUCP` frame is for standalone preview on the design canvas. In the production feed, `CityPulseShell` / `feedContent` already applies its own horizontal padding. In `BigStuffSection.tsx`, the outer `<FeedSectionReveal>` should NOT add horizontal padding — only vertical spacing.

---

## States

### Ribbon container (`[data-bigstuff-ribbon]`)
- **Default:** as spec above.
- **Hover (any descendant item):** `.group-hover/ribbon:opacity-75` applied to sibling items. No change to the ribbon container itself.

### Column `[frame] m1 .. m6`
- **Default:** as spec. Sparse columns (<2 items, non-current) get `opacity: 0.4` on the label only (plan Task 6 rule).
- **No hover state** on the column container.

### Item `[frame] m_e_` (and its children `m_e_t`, `m_e_d`)
- **Default:** as spec. All date colors `var(--muted)` in v1 (see Implementation Note B).
- **Default opacity inside hovered ribbon (sibling):** `opacity: 0.75`, 200ms transition.
- **Hover (this item):** `opacity: 1`, title gains 1px underline in `var(--gold)` with 3px underline offset.
  - Transition: `transition: opacity 200ms ease`
  - Cursor: `pointer` (anchor element).
- **Active/click:** delegated to the Link anchor; no explicit style override.
- **Focus-visible:** default browser focus ring at `var(--coral)`. No override needed.

### Header "See all →" link
- **Default:** `var(--gold)` text.
- **Hover:** `opacity: 0.8`, 200ms transition.
- **Focus-visible:** default browser focus ring.

### Overflow link "+N more"
- **Default:** Space Mono 10px, uppercase, `letter-spacing: 0.2em`, `var(--muted)` text.
- **Hover:** text color transitions to `var(--gold)`, 200ms ease.
- **Focus-visible:** default browser focus ring.

### Current-month badge (gold chip)
- **Default:** as spec. Not interactive in v1.

---

## Shadows

No shadows in this comp. The ribbon uses a flat `var(--night)` surface with a 1px `var(--twilight)` stroke. This matches the cinematic-minimalism aesthetic (`docs/decisions/2026-03-08-cinematic-minimalism-design.md`) — no glow, no lift.

---

## Responsive Notes

- **Extraction viewport:** 1024px content width (desktop).
- **Desktop (≥640px / `sm:` breakpoint):** 6-column flex row, each column `flex: 1` splitting the 1024px container. Ribbon total height ≈160–200px depending on column content density.
- **Mobile (<640px):** the 6-column row becomes a horizontal snap-scroll container. Each column is fixed `min-width: 110px` on mobile (resets to `flex: 1` at `sm:`). First column pinned-left as the scroll entry point. Scrollbar hidden. This is mobile-only behavior — the Pencil comp itself is single-breakpoint (desktop).

---

## Implementation Constraint

**Do not add any CSS property not listed in this spec.** If an element needs a property not documented here (new shadow, transition, z-index, filter), stop and ask rather than improvising. The spec is the ceiling, not the floor.

The one set of deviations intentionally introduced by the implementation plan (not by the Pencil comp):
1. Dot size reduced to 5×5 from 10×10 (Note A).
2. Gold date treatment removed for v1 (Note B).
3. Sparse-month 40% opacity rule added (Note C).
4. Empty-month skip rule added (Note D).
5. Outer padding dropped in production (Note E).

Any deviation beyond these five must be justified and flagged in the PR description.
