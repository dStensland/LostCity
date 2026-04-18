# Shows Lane — Elevate Brief

**Status:** direction brief, not implementation plan. No code until user approves direction.
**Date:** 2026-04-18
**Scope:** `/atlanta/explore?lane=shows&tab=film` + the `NowShowingSection` feed widget. Retires the sibling `/atlanta/explore/film` route.
**Source of critique:** product-designer + business-strategist agent reviews, 2026-04-18. User's verbatim bar: *"hip and cool and effortlessly functional."*

---

## Strategic anchor (from strategist review)

**Lead with time, not taxonomy.** The primary question driving 80% of film decisions is *"what's worth seeing this week/tonight"* — not *"what's at Plaza"*, not *"By Format category"*, not *"show me a schedule grid."* Everything else is downstream of answering that one question simply and confidently.

**Audience:** mainstream Atlanta consumer choosing what to do Thursday night. **Not** cinephiles, who already subscribe to Plaza's newsletter and don't need us.

**Competitive posture:** LostCity's edge is **breadth + local knowledge**, not cinephile editorial depth. Letterboxd/Mubi own the cinephile identity; chasing that battle is a positioning trap. We win by being the **city guide that handles film as well as it handles everything else** — consistent cross-vertical voice, local context (parking, neighborhood, what else is nearby), and trust that the signal is curated without shouting about it.

---

## Reference set

| Reference | What to steal |
|---|---|
| **Pitchfork Best New Music** (direct analog) | "Here's what matters, here's everything else." Ranked signal + completeness. No three-view toggle, no schedule grid. |
| **The Infatuation / Eater city pages** | Confident short copy, editorial voice that sounds like a person, images doing the work. |
| **Mubi mobile** (NOT their editorial voice) | Images at poster scale, play buttons, minimal chrome. The interaction model, not the cinephile voice. |
| **Linear** | Whitespace as feature. One mono label per screen. Color for state only. |
| **Apple TV+** | Hero artwork treatment. Title + one-line meta. No stacked kickers. |

### Anti-references

| Reference | What NOT to do |
|---|---|
| **Fandango** | Correct By Theater + By Film structure, but every decision drowned in commerce chrome (ads, upsell, loyalty). Steal the theater accordion, avoid the chrome. |
| **The current /explore/film sibling route I just shipped** | Literal transcription of "Programmer's Board" aesthetic. Five mono-caps labels stacked before content. Founding-year metadata floating on a film thumbnail. AI-generated editorial subtitle. |

---

## What dies

### 1. Sibling `/atlanta/explore/film` route (entire feature)

All of these get deleted after the shows lane rebuild lands + a one-week redirect bridge:
- `web/app/[portal]/explore/film/page.tsx` + `loading.tsx`
- `web/app/[portal]/explore/film/_components/FilmExploreShell.tsx`
- `web/app/[portal]/explore/film/_components/DateStrip.tsx` (replaced by lane's existing date pills)
- `web/app/[portal]/explore/film/_components/ViewToggle.tsx` (three-view toggle — lane has the correct binary one)
- `web/app/[portal]/explore/film/_components/FilmFilterChips.tsx` (replaced by a simpler inline row)
- `web/app/[portal]/explore/film/_components/ThisWeekZone.tsx` (merged into the lane's This Week strip)
- `web/app/[portal]/explore/film/_components/ByTheaterView.tsx`
- `web/app/[portal]/explore/film/_components/TheaterBlockTier1.tsx` (programmer's board pattern — belongs on venue detail, not discovery)
- `web/app/[portal]/explore/film/_components/TheaterBlockTier2.tsx`
- `web/app/[portal]/explore/film/_components/ByFilmView.tsx` (replaced by the lane's existing By Movie mode)
- `web/app/[portal]/explore/film/_components/FilmCard.tsx`
- `web/app/[portal]/explore/film/_components/EditorialGroupHeader.tsx`
- `web/app/[portal]/explore/film/_components/ScheduleView.tsx`
- `web/app/[portal]/explore/film/_components/schedule/ScheduleCell.tsx`
- `web/app/[portal]/explore/film/_components/schedule/ScheduleTimeAxis.tsx`
- `web/app/[portal]/explore/film/_components/schedule/ScheduleGrid.tsx`
- `web/lib/film/schedule-geometry.ts` (Schedule grid helpers, no consumer home)
- `web/app/api/film/by-film/route.ts` + `web/lib/film/by-film-loader.ts` (functionality absorbed by the lane's existing film data path)

**Redirect:** `web/middleware.ts` or a simple rewrite in `next.config.ts` sends `/atlanta/explore/film*` → `/atlanta/explore?lane=shows&tab=film` for one cycle, then the redirect is removed too per the "Delete compatibility aggressively" rule.

### 2. Three-view toggle

`By Theater | By Film | Schedule`. Dies. The lane's **existing two-mode toggle** (`By Movie | By Theater` in `ShowtimesView.tsx`) is correct and stays — the split between "I know the film, find a theater" vs "I know the theater, see what's on" is real. Schedule grid is a power-user toy with no consumer home; it goes away entirely.

### 3. The feed widget's Today typographic playbill

`PLAZA Bunnylovr 7:45 · Exit 8 5:15 · Normal 7:30` rows. Print DNA, unscannable on phone. The feed widget becomes one zone, not two — see "feed widget target" below.

### 4. Editorial group dividers in By-Film mode

`OPENS THIS WEEK` / `NOW PLAYING` / `CLOSES THIS WEEK` as stacked section headers with counts. Not a section divider. Optionally a subtle chip on the film card (`Premiere` or `Last chance` in a color-coded pill).

### 5. Specific visual tells flagged by designer

- **Founding-year chip on any film-surface tile** (`est. 1939` in gold). Venue-detail metadata on a discovery card.
- **Press quote floating on feed hero image.** Magazine-collage pattern. Dies on feed tile; lives on detail page + optionally on the lane's This Week expanded view.
- **`backdrop-blur-md` on cards/surfaces.** Violates the 2026-03-08 cinematic-minimalism decision. Already removed from ShowtimesView's date-pills section in the hotfix; audit the rest.
- **Gradient icon boxes** (`from-[var(--coral)]/20 to-[var(--twilight)]/20` on 40px containers in `TheaterAccordionCard`). Crutch for surfaces with nothing meaningful to render. Flat `--dusk` surface or drop the container.
- **`--vibe` token as decoration** on 4+ non-state elements (section headers, showtime chips in rest state, theater names, arrows). Rule: `--vibe` fires on **active/selected state only**. Rest state uses `--twilight`/25 border + `--soft` text.
- **Compound label stacking** like `THIS WEEK · 3 SIGNIFICANT SCREENINGS · Not to miss.` (three semantic units in one line, each from a different design intent). Pick one — usually none.

---

## What lives

### Data layer (all of it)

- `web/lib/film/types.ts` — all types
- `web/lib/film/this-week-loader.ts` — hero cascade is sound
- `web/lib/film/today-playbill-loader.ts` — venues × screenings shape is fine
- `web/lib/film/hero-tags.ts` — pure function, useful
- `web/lib/film/classification.ts` — pure, reused
- `web/lib/film/editorial-subtitle.ts` — keep the helper but **do not render its output in the UI**. It's AI-generated prose. Useful as an internal debugging aid or future opt-in, not a user-facing string.
- `web/api/film/this-week` + `/today-playbill` — API routes are fine
- `web/lib/film/screening-runs-portal-id` migration + trigger — these are infrastructure, stay

### `ShowtimesView.tsx` (already shipped inside the lane)

- Binary `By Movie / By Theater` toggle — correct, stays
- Date pills with picker — pattern is correct, elevate the styling (already dropped backdrop-blur in hotfix)
- Theater accordion card — pattern is correct, drop gradient icon boxes, rest-state color discipline

### Feed widget concept

- Adaptive 1/2/3 tile hero layout — elegant, keeps
- Hero images as primary content — keeps
- The idea of "this week's signal" on the feed — keeps, but the implementation gets stripped to title + one-line meta

---

## What gets rebuilt

### Feed widget — target

**One zone**, not two. Image-first carousel of 3–5 films that matter this week. Each tile:

- Full-bleed still, adaptive height by density
- Title (one line, truncate)
- One-line meta: either the *tag* (`Premiere`, `35mm`, `Last chance`) OR the *timestamp* (`Thu at Plaza`, `Sat 7:30 · Tara`) — **never both**. Pick whichever is more decision-relevant for that screening.
- No press quote on tile
- No founding year
- No gold-outline editorial badge competing with the image — if there's a tag, it's a small subtle chip in the corner, not a tag pill shouting for attention

The `Today playbill` zone beneath dies. The feed widget's job is to tease the week, not display a TV-guide grid.

Section header reads: `Now Showing` + `See all →`. Nothing else. No `14 films showing in Atlanta tonight` subtitle.

### Explore `shows` lane film tab — target

Within `ShowtimesView.tsx` (or its elevated successor), **two regions**, not three:

1. **This Week strip** — persistent top module. 3–5 films as image cards, same treatment as the feed widget tiles but larger. Does NOT rekey on the date picker — it's the week's editorial signal, always present. One gold `Premiere` chip on the one film that has an ATL premiere this week, maximum.

2. **Date-keyed list** — everything else, for the selected date:
   - 7-day date pill row (currently the lane has this; trim from 14 to 7 visible + picker)
   - Binary toggle: `By Movie | By Theater` (keep current behavior)
   - Format filter chips inline above the list: `IMAX · 70mm · Dolby · 35mm · 4DX` (sparingly — not the 10-chip row I shipped). Attribute filters (`premieres only`, `festival`) collapse into an overflow menu if needed, not a primary row.
   - Venue filter = a small chip `+ Add theaters` that opens a sheet. This replaces the "By Theater programmer's board" as a surface — theater loyalty is a filter, not an axis.
   - The list itself: image-first cards, title, closest showtime, venue, tap to expand all showtimes. Accordion pattern is fine.

That's the entire surface. No separate "Tonight grid" region — when today is selected, the list IS tonight.

### Section headers across the surface

One mono-caps label per screen max. The lane chip already says "Shows" — the tab already says "Film." Inside the content: no `Films Showing in Atlanta.` H1. No `CURATED BY Lost City Film` signage. No italic editorial subtitle. The content leads.

### Copy rewrite table (complete)

| Current | Replace with |
|---|---|
| `Now Showing` (feed section title) | Keep |
| `◎` icon prefix | Keep if it reads as a recognizable mark; drop if the icon is the decorative filled circle I used |
| `14 films showing in Atlanta tonight` | Kill — count is a micro tag on the See-all link if needed |
| `THIS WEEK · 3 SIGNIFICANT SCREENINGS · Not to miss.` | `This week` — no count, no editorial kicker |
| `Films Showing in Atlanta.` (H1) | Kill — lane/tab chips already label this |
| `CURATED BY Lost City Film` | Kill |
| `A print-style grid — scroll right for later tonight.` | Kill (and kill the grid) |
| `Atlanta's programs tonight.` | Kill |
| `Every film showing in Atlanta, tonight.` | Kill |
| AI-generated editorial subtitle (`"This week — Bunnylovr opens at Plaza, Dune: Part Three lights up the true IMAX at Mall of Georgia..."`) | Kill |
| `ATL PREMIERE · OPENS THURSDAY` | `Premiere` (chip) + `Thu · Plaza` (meta) — two units, never compound |
| `35MM · SATURDAY ONLY` | `35mm · Sat` |
| `OPENS THIS WEEK` / `NOW PLAYING` / `CLOSES THIS WEEK` section headers | Kill as headers. Optionally a `Premiere` / `Last chance` chip on individual cards. |
| `Quiet night — see what's opening this week` | Kill — show fewer items silently |
| `PLAYING AT` label above theater×showtime matrix | Kill as uppercase label. A thin rule + theater-count (e.g. `4 theaters`) in muted text is sufficient. |
| `See the week →` / `See all X films tonight →` | `See all →` |
| `drive-in` suffix on Starlight row | Keep as a small muted tag — it IS a useful signal |
| `NOW 14:00` red line label on Schedule grid | Moot — Schedule grid dies |
| `+2 standard showings →` chip in By-Film playing-at matrix | `+2 more` — drop "standard showings" jargon |

**Rule:** one mono-caps label per screen max. Currently 4–5 stacked.

### Visual language rules

1. **Color means state, not decoration.** `--vibe`, `--gold`, `--coral` fire ONLY on active/selected/state. Rest state uses `--twilight` borders + `--soft` or `--muted` text. Current violation: `--vibe` appears 4× in the feed widget in non-state contexts.
2. **Images are the only decoration.** No gradient icon boxes. No gold borders on cards as visual flair. If a card has an image, the image carries the visual weight.
3. **One mono-caps label per screen max.** Section header or page label — pick one. Never both.
4. **No `backdrop-blur` on cards/surfaces.** Per the 2026-03-08 cinematic-minimalism decision. Exception: modal backdrops (matches the existing modal recipe).
5. **Hero tile content is title + one meta unit.** Never title + meta + press quote + badge + secondary meta. Collage is not a pattern.
6. **Whitespace is load-bearing.** Current surfaces are text-dense. Target: 1.5–2× the current whitespace on feed tiles and the Explore list.
7. **Motion is feedback, not decoration.** Entrance fade + subtle hover on tiles is enough. No staggered card reveals unless the stagger conveys meaning.

---

## File-level change plan (no code here — just file-level intent)

| File | Action |
|---|---|
| `web/components/feed/sections/NowShowingSection.tsx` | Rebuild from one-zone target. Drop the Today playbill section entirely. |
| `web/components/feed/sections/now-showing/HeroTile.tsx` | Trim to title + single meta unit. Press quote already removed in hotfix. |
| `web/components/feed/sections/now-showing/PlaybillRow.tsx` | **Delete.** Playbill dies. |
| `web/components/find/ShowtimesView.tsx` | Elevate: add This Week strip at top, tighten filter chip row, rest-state color discipline, remove gradient icon boxes, 7-day date pills + picker (from 14). |
| `web/components/find/TheaterAccordionCard.tsx` (inferred) | Drop gradient icon box, color rest-state, image-first. |
| `web/app/[portal]/explore/film/**` | All delete. Redirect bridge in `middleware.ts` or `next.config.ts` for one cycle, then delete the redirect too. |
| `web/lib/film/by-film-loader.ts` + `/api/film/by-film/*` | Delete. Redundant with the lane's existing film data path. |
| `web/lib/film/schedule-geometry.ts` + schedule components | Delete. Schedule grid has no consumer home. |
| `web/lib/film/editorial-subtitle.ts` | Keep the pure helper; **stop rendering its output** in the UI. |

---

## Success criteria for the elevate execution (when it happens)

1. A first-time visitor on the Atlanta feed sees `Now Showing` as an image-first strip of 3–5 films. Can tell at a glance what's worth seeing this week. One tap opens Explore.
2. `/atlanta/explore?lane=shows&tab=film` renders one clear primary flow: "what's on, pick a date, filter if you care, tap a film." Not three competing views.
3. No mono-caps label stack. No AI-generated editorial prose. No press quotes floating on thumbnails. No `CURATED BY` signage.
4. Every color applied to a non-image element is either neutral (`--twilight` / `--soft` / `--muted` / `--cream`) OR a genuine state signal (active filter, selected date, upcoming premiere). No decorative color.
5. Surface feels continuous with the rest of `/atlanta/explore` — same chrome, same patterns, same voice. Film doesn't feel like a bolted-on cinephile zine.
6. No dead routes. No 404s from feed CTAs.

---

## Execution proposal (order, not scope)

1. **Redirect bridge** (tiny, 5 min): `/atlanta/explore/film*` → `/atlanta/explore?lane=shows&tab=film` in middleware. Ships immediately, any shared links keep working.
2. **This Week strip inside the shows lane** (feed parity first): build the shared `ThisWeekStrip` component that both the feed widget AND the lane use. Image-first, trim copy to plan.
3. **Feed widget rebuild**: swap current NowShowingSection to use the ThisWeekStrip + drop the playbill zone. Ships the feed fix behind ~3 hours of work.
4. **Shows lane tab elevation**: integrate ThisWeekStrip at top, drop 14-day strip to 7-day, clean filter chip row, rest-state color discipline, tighten theater accordion. Ships the Explore fix.
5. **Retirement pass**: delete the sibling route files + loader + geometry helper. Audit and remove cross-references.
6. **Browser verify** on preview: walk a first-time visitor through the feed → Explore flow on mobile (375px). Full stop on any decision point that needs > 3 seconds.

Motion + interaction polish is a follow-on pass, not part of the elevate. Visual correctness first.

---

## What's NOT in this brief

- **Tier 3 opt-in additional theaters.** Deferred. Mainstream consumer default doesn't need it.
- **Plan creation on showtime tap.** Separate feature; existing lane pattern handles it.
- **Real suncalc for drive-in sunset marker.** Schedule grid dies, moot.
- **Motion system.** Separate follow-on.
- **Cross-vertical voice audit.** This brief focuses on film; the voice rules here should inform Music/Places/etc but those are separate reviews.

---

## Open questions for the user

1. **Redirect bridge duration.** One cycle (week) and then delete? Or shorter? Per `web/CLAUDE.md` *"Delete compatibility aggressively — if you replace a route bridge or legacy emitter, remove the old emission path in the same workstream or the immediately following one."*
2. **By Movie / By Theater default.** Strategist implies "lead with time" means films-first. Should the default tab inside the lane be `By Movie`, not `By Theater`? (ShowtimesView currently has a default; I haven't audited which.)
3. **The "Premiere" chip color.** Currently `--gold`. The cinematic minimalism decision doc should say which of our accent colors earns state-signal semantics. If `--gold` is ambiguous, could be `--coral` (brand CTA) or a neutral `--cream/20` chip.
4. **Keep the `editorial-subtitle.ts` helper for future surface, or delete?** Strategist says the voice is wrong for LostCity; designer says the helper is pure. Lean toward delete — unused code is risk.
5. **Retiring the standalone `/explore/film` route removes Test coverage (~60 tests across ByFilmView, ScheduleGrid, FilmCard, etc).** The underlying component tests go with the components. The loader/API/type tests for retained code stay. Is that acceptable, or do we need to port any specific test to the lane's elevated surface?
