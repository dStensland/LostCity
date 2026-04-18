# LostCity Design Truth

**Read first. Every UI-touching agent, every session, every task.**

This is the product's spirit, the platform pattern library index, and the anti-pattern gallery — the shared anchor that keeps every feature feeling like part of one product. `docs/quality-bar.md` is the detailed rule reference; this file is the tight always-loaded spine.

---

## Product Spirit

- **Camera, not cartoon.** Motion is slow, deliberate, atmospheric. No bouncing, no elastic overshoot, no playful wobble. (Save that for family/youth portals.)
- **Cinematic minimalism.** Solid surfaces with atmospheric glow for depth. No glassmorphism. No decorative neon. No heavy stacked gradients.
- **Portals are bespoke, never configured.** Each vertical has its own typography, color, corner radius, border style. A theme system is an anti-pattern.
- **Typography carries when images don't.** Type is the design — never a fallback.
- **Stillness is design.** Not everything moves. Static elements provide contrast that makes motion meaningful.

---

## Component Registry (Platform DNA)

Cross-portal patterns that MUST be reused. Before building any new UI piece, check here first. Net-new patterns require explicit justification in the plan.

The full 33-component system lives in `docs/design-system.pen`. This registry captures the *platform DNA* — the patterns that compose across verticals.

### Atoms

| Pattern | Shipped Code | Pencil ID | Use for | Don't use for |
|---|---|---|---|---|
| Badge | `web/components/ui/Badge.tsx` | `I7NUV` | Status, category, short descriptors | Actions (use Button) |
| FilterChip | `web/components/filters/FilterChip.tsx` | `olqzW` | Selectable filter state | Static labels (use Badge) |
| Button | `web/components/ui/Button.tsx` | `GBoOR` | Actions | Display state |
| Dot | `web/components/ui/Dot.tsx` | `CsjTB` | Inline metadata separator (middot) | Decorative |
| CountBadge | `web/components/ui/CountBadge.tsx` | `xDCna` | Notification count indicators | Section totals (the "68 SHOWS" header anti-pattern) |
| IconBox | — | `W2bkv` | Icon containers with tinted backgrounds | — |

### Molecules

| Pattern | Shipped Code | Pencil ID | Use for | Don't use for |
|---|---|---|---|---|
| EventCard | `web/components/cards/EventCard.tsx` | `ViqPG` | Temporal happenings in feeds and lists | Venues/places |
| EventCard/compact | `web/components/feed/CompactEventRow.tsx` | `pjp57` | Dense list rows | Card contexts (use EventCard) |
| VenueCard | `web/components/cards/VenueCard.tsx` | `h5zDT` | Places/venues in directories and nearby sections | Events |
| FeaturedCard | — | `CX6oB` | Hero carousel cards | Row lists |
| FeedSectionHeader | `web/components/feed/FeedSectionHeader.tsx` | `v1ON6` | Feed section titles + see-all links | Page H1 (use DetailHero) |
| MetadataGrid | — | `YYhn1` | Detail page metadata (label + value pairs) | Narrative content |
| SectionHeader | `web/components/detail/SectionHeader.tsx` | `vBfLD` | Detail page section dividers (border-t + mono label) | Feed headers (use FeedSectionHeader) |
| DescriptionTeaser | `web/components/detail/DescriptionTeaser.tsx` | `2ZOe9` | Pull-quote between hero and InfoCard | Full descriptions (use InfoCard) |
| SocialProofStrip | `web/components/detail/SocialProofStrip.tsx` | `gaiuv` | Friend attendance pills + avatars | Generic social content |
| ScheduleRow | — | `t5jrF` | Showtime / schedule rows | Generic list rows |

### Organisms

| Pattern | Shipped Code | Pencil ID | Use for | Don't use for |
|---|---|---|---|---|
| DetailHero | `web/components/detail/DetailHero.tsx` | `fupdn` | Event/venue/exhibition detail headers | Feed cards |
| InfoCard | — | `cwCFk` | Detail content section wrapper | Feed sections |
| DetailStickyBar | `web/components/detail/DetailStickyBar.tsx` | `wEQon` | Mobile detail CTA (scroll-triggered) | Desktop (use DetailActions) |
| MobileFilterSheet | `web/components/filters/MobileFilterSheet.tsx` | `q6CvR` | Mobile filter UI | Desktop |
| FeedSection (carousel) | — | `yt3B5` | Horizontal scroll feed sections | Vertical lists |
| FeedSection (list) | — | `Bo2iQ` | Vertical feed sections | Carousels |
| Modal | — | `InHlJ` | Dialogs | Detail overlays (use overlay context) |

### Shipped compositions (code, no Pencil ID yet)

- **Now Showing widget** — `web/components/film/NowShowingSection.tsx` — cinema programming at right-sized density (accepted exemplar)
- **LiveTonightHeroStrip** — `web/components/music/LiveTonightHeroStrip.tsx` — adaptive 1/2/3-up hero (post-polish, accepted)
- **DetailActions** — `web/components/detail/DetailActions.tsx` — desktop side-rail actions
- **ConnectionsSection** — related rows on detail pages

### Atlanta portal page compositions (Pencil IDs)

| Page | Desktop | Mobile |
|---|---|---|
| Feed Homepage | `Z9AcJ` | `6TYYC` |
| Events View | `BxHW9` | `Y6t71` |
| Places View | `DFOYd` | `UAmLb` |
| Venue Detail | `JxXPT` | `Kv8Oa` |
| Event Detail | `neovA` | `wHsA6` |
| Series Detail | `dtvVK` | `0BDgZ` |
| Regulars Tab | `HYCT0` | `DBYJ0` |
| Neighborhoods | `QwPkU` | `8inW1` |
| Search Results | `s7ROV` | `vcZOu` |
| Calendar View | `AhhUW` | `ekxuA` |
| Map View | `MFk47` | `5zLpv` |
| Profile | `y1Zdz` | `Rs7e5` |
| Saved | `PwoI6` | `z1a7U` |
| Community | `JikA8` | `NcXkj` |

---

## Anti-Pattern Gallery

Reject patterns. Each is tagged to the rule it violates.

- **Count badges as a header element** ("68 SHOWS", "1,247 EVENTS"): violates editorial-not-debug copy standard. The count is implementation-side noise, not information a user needs. → Plan 2 retrospective, `feedback_no_comp_no_implementation.md`.

- **Enum chip labels** ("FLAGSHIP", "MAJOR SHOW", "TIER 1", raw category values surfaced as UI): violates editorial label standard. Either give it an editorial name or don't show it. → Plan 2.

- **Widget giantism** (feed sections >2000px tall, 36+ rows with low editorial curation): violates grid cardinality. Bigger isn't better; right-sized is. → Plan 2 (3617px tall — 14× the cinema widget).

- **`mask-fade-x` on carousels**: gradient edge fades obscure cards at the edges, making them unreadable. → `feedback_no_carousel_mask_fades.md`.

- **Redundant filter shortcuts** (Tonight/Weekend/Big Events buttons next to a date dropdown that already contains them): violates information minimalism. UI surface should express one thing per thing. → `feedback_no_redundant_filters.md`.

- **Placeholder / skeleton hides missing data**: showing a skeleton loader to mask a section that has no real data makes the product feel populated when it isn't. Render nothing or a proper empty state — never fake content. → `feedback_no_smoke_and_mirrors.md`.

- **Glassmorphism / backdrop-blur on cards**: banned since 2026-03-08 cinematic minimalism decision. → `docs/decisions/2026-03-08-cinematic-minimalism-design.md`.

- **Burgundy / wine color palette**: stale aesthetic, replaced by cinematic minimalism surfaces (`--void`, `--night`, `--dusk`, `--twilight`). → same decision.

- **Decorative neon, "80s nightlife" effects**: violates "camera, not cartoon." Atmospheric glow is the permitted substitute — subtle, ambient, never loud. → `quality-bar.md` § Visual.

- **Icon soup** (decorative icons without semantic meaning, cluttered icon rows on cards): violates stillness-is-design. Every icon needs a reason.

- **Theme system / configurable portal flags**: portals are bespoke, never configured. Building `if (portal === 'foo')` branches in shared code violates Bet 2 of the north star.

- **Mid-word truncation at small card widths**: if venue names or titles truncate mid-word, the card width is wrong or the text treatment is wrong — fix the sizing, don't ship the truncation. → Plan 2 retrospective.

Add entries as new failures surface. After each `/coherence` run (when implemented), refresh this gallery with observations.

---

## Taste Exemplars

### Accepted (cite as reference)

- **Now Showing widget** — editorial density, typographic hierarchy, right-sized for 8–12 films. Not bloated, not empty.
- **DetailHero** — typography carries the page; atmospheric glow, no glass; solid surface.
- **Lost Youth Arts portal header** — bespoke portal identity done right. Plus Jakarta Sans, field sage + amber, portal-specific corner radii.
- **LiveTonightHeroStrip post-polish** — adaptive 1/2/3-up responsive to data cardinality.

### Rejected (cite as anti-reference)

- **Live Tonight Plan 2 initial ship** — SaaS-template slop. "68 SHOWS" count badge. "MAJOR SHOW" / "FLAGSHIP" enum labels. 3617px tall (14× the cinema widget). Venue names truncated mid-word at 110px. User verdict: *"absolutely terrible... some of the worst designed interface work we've done... you failed miserably without the Pencil comp."* → `feedback_no_comp_no_implementation.md`.
- **Any carousel with `mask-fade-x`** — edge cards illegible.

When reviewing new work, actively compare against exemplars. "Does this feel more like Now Showing, or more like Plan 2?"

---

## Aesthetic Decisions Index

- **`.claude/north-star.md`** — mission; bets; decision filters. Source of product framing.
- **`docs/decisions/2026-03-08-cinematic-minimalism-design.md`** — the aesthetic call (surfaces, glow, no-blur, no-neon).
- **`docs/quality-bar.md`** — detailed standards reference (Visual, Motion, Data, Crawler, Process, Strategic). This file is the tight spine; quality-bar is the deep reference.
- **`docs/decisions/2026-03-12-portal-naming-convention.md`** — "Lost ___" naming; per-portal brand identity.
- **`.claude/skills/motion/SKILL.md`** — motion language, tokens, patterns.
- **`web/CLAUDE.md`** § Design System Contract — token semantics, typography scale, component recipes, utility classes.

---

## Coherence Check

Two binding questions every contributor answers.

- **Before approving a plan:** *"Would this feel like it belongs next to Now Showing and DetailHero?"*
- **Before merging a PR:** *"Put this screenshot beside three other features. Is it the same product?"*

If the answer is no to either, the work isn't done. Fix the drift before shipping.

---

**Maintenance:** this is a living standard. Update the registry when a cross-portal pattern ships. Add anti-patterns as new failures are observed. If this file ages and stops being accurate, the whole design-quality system degrades — keep it current.

**Last refreshed:** 2026-04-18 (initial creation; Pencil IDs migrated from `web/.claude/rules/figma-design-system.md`, anti-patterns synthesized from memory feedback files + `docs/quality-bar.md`).
