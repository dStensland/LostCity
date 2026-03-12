# Hooky Family Program Workstream

**Portal:** `hooky`  
**Surface:** `consumer`  
**Status:** Active execution  
**Last Updated:** 2026-03-11  
**Depends on:** `prds/hooky-pattern-backlog.md`, `prds/hooky-pattern-implementation-specs.md`, `prds/hooky-family-inventory-scorecard.md`

---

## Purpose

This document turns the Hooky family-program expansion into an execution workstream.

The operating rule is:

- research broad
- implement narrow
- only stop when the next source hits a real blocker

This is not a provider wish list. It is a pattern-led delivery queue with explicit
acceptance gates, sequencing, and blocker definitions.

---

## Current Read

The first-wave program map is now materially real.

The newest expansion step is no longer another private camp operator.

Hooky now has a reusable `family-only civic Rec1` wrapper shape for broad public
catalogs, backed by a shared relevance filter and a short-date rollover fix in the
shared `Rec1` base.

The civic/public lane is now materially populated in the live DB, not just activated.
The grouped civic health sweep on 2026-03-11 now reads:

- `230` future civic/public rows
- `19` distinct venue hits across the six-source pack
- `82.0%` mean age coverage
- `94.1%` mean price coverage
- `100.0%` ticket coverage

Current per-source sweep counts:

- `atlanta-family-programs`: `43`
- `dekalb-family-programs`: `67`
- `gwinnett-family-programs`: `50`
- `milton-parks-rec`: `31`
- `chamblee-parks-rec`: `10`
- `cobb-family-programs`: `29`

The new issue surfaced by that sweep is quality, not emptiness:

- the shared DB category normalization now maps `programs -> family`, which removed
  the production write blocker for civic family-program sources
- the shared `ACTIVENet` family filter was tightened after live writes exposed adult
  leakage in Atlanta-style broad public catalogs
- Atlanta and DeKalb need a cleanup rerun under the stricter filter before the civic
  lane should be considered scorecard-stable

Validated pattern families:

1. `MyRec`
2. session-rich public camp archives
3. public HTML camp tables
4. school summer hubs
5. hybrid school hubs backed by public Google exports
6. recurring swim/location stacks
7. custom arts/performance camp pages
8. brand-owned local program-search networks

This means the strategic risk has shifted.

The main question is no longer:

- can Hooky parse family programs at all?

It is now:

- how quickly can Hooky compound depth inside the highest-leverage pattern families without fragmenting into one-off source work?

---

## Implemented Pattern Pack

| Pattern family | Source | Status | Live result |
|---|---|---|---|
| `MyRec` | `marist-school` | implemented | 25 programs discovered in smoke pass |
| `MyRec` | `chamblee-parks-rec` | implemented | 18 family/youth programs in sampled smoke pass |
| session archive + public registration | `club-scikidz-atlanta` | implemented | 313 future sessions |
| public HTML camp tables | `kid-chess` | implemented | 8 current rows |
| school summer hub | `wesleyan-summer-camps` | implemented | 43 rows |
| school summer hub | `pace-summer-programs` | implemented | 87 rows |
| school summer hub | `swift-summer-programs` | implemented | 5 rows |
| school summer hub | `walker-summer-programs` | implemented | 91 rows |
| hybrid school hub + Google exports | `trinity-summer-camps` | implemented | 111 rows |
| recurring swim/location | `big-blue-swim-johns-creek` | implemented | 7 recurring program templates / 42 weekly records |
| recurring swim/location | `diventures-alpharetta-swim` | implemented | 4 recurring lesson templates / 24 weekly records |
| arts/performance camp | `dads-garage-camps` | implemented | 18 summer camp rows |
| arts/performance camp | `nellya-beginner-camps` | implemented | 3 beginner fencing camp rows |
| arts/performance camp | `vinings-school-of-art-summer-camps` | implemented | 7 summer art camp rows |
| arts/performance camp | `mister-johns-music-summer-camp` | implemented | 4 public 2026 theme-week rows |
| brand-network local program search | `camp-invention-atlanta` | implemented | 8 Atlanta-metro STEM camp rows after filtering 1 restricted school-only site |
| camp network + public REST inventory | `girl-scouts-greater-atlanta-camps` | implemented | 43-camp official inventory exposed via public REST + session tables |
| branded multi-venue summer hub | `atlanta-ballet-centre-summer-programs` | implemented | multi-venue dance + intensive program pack from official Centre pages |
| institution-led camp page | `zoo-atlanta-summer-safari-camp` | implemented | 30 weekly 2026 camp rows across three age tracks |
| institution-led camp page | `high-museum-summer-art-camp` | implemented | 41 weekly 2026 art-camp rows across grade bands plus rising-kindergarten |
| arts-center camp course pages | `spruill-summer-camps` | implemented | 41 public 2026 art-camp rows from official course-detail pages |
| institution-led season camp page | `fernbank-summer-camp` | implemented | 18 weekly 2026 science-camp rows across two age bands |
| school summer hub + Google Sheet exports | `woodward-summer-camps` | implemented | 251 weekly 2026 camp rows from public Woodward sheet exports |
| institution-led weekly camp tracks | `georgia-aquarium-camp-h2o` | implemented | 23 weekly 2026 aquarium-camp rows across age-track themes |
| public school specialty-camp catalog | `greater-atlanta-christian-specialty-camps` | implemented | 41 public specialty-camp rows across visible week and rising-grade filters |
| Finalsite summer-program board | `lovett-summer-programs` | implemented | 71 official catalog rows from public type/week/school-level taxonomy |
| civic `Rec1` family-program catalog | `milton-parks-rec` | implemented | 28 kept family program groups / 117 live sessions across camps, youth, preschool, and outdoor recreation |
| civic `Rec1` family wrapper | `gwinnett-family-programs` | implemented + activated | family-focused public-program wrapper over official Gwinnett Rec1 catalog |
| civic `Rec1` family wrapper | `cobb-family-programs` | implemented + activated | family-focused public-program wrapper over official Cobb Rec1 catalog |
| civic `ACTIVENet` family wrapper | `atlanta-family-programs` | implemented + activated | family-focused public-program wrapper over official Atlanta DPR ACTIVENet catalog |
| civic `ACTIVENet` family wrapper | `dekalb-family-programs` | implemented + activated | family-focused public-program wrapper over official DeKalb ACTIVENet catalog |
| brand-owned local camp-search network | `mjcca-day-camps` | implemented | 181 public week/session rows across 95 distinct camp titles |
| nature-preserve camp page | `blue-heron-summer-camps` | implemented | 14 public summer-camp rows across Little Blue Herons, Great Blue Herons, and Outdoor Skills |
| public park weekly camp page | `piedmont-park-enviroventures-camp` | implemented | 9 public rows across weekly EnviroVentures themes plus teen leadership training |
| single-program nature camp page | `frazer-nature-camp` | implemented | 8 public session rows with official registration and inclusion-focused age band |
| dedicated garden-camp page | `atlanta-botanical-garden-camps` | implemented | 6 age-banded camp rows across Enchanted Creative Garden, Adventures in the Garden, and Seeds to Snacks |
| arts-center creative camp page | `callanwolde-creative-camps` | implemented | 7 public weekly creative-camp rows with registration codes and official ACTIVE registration |
| public camp page + official themes PDF | `dunwoody-summer-camp` | implemented | 13 Dunwoody Park weekly camp rows from official page + camp-themes PDF |
| public camp page + official themes PDF | `dunwoody-island-ford-camps` | implemented | 7 older-kid Island Ford camp rows from official page + camp-themes PDF |

Recent execution note:
- the family-program validation pack now passes as a single grouped sweep (`104` targeted tests), which is the new default operating cadence for this workstream instead of single-source stop points
- `mjcca-day-camps` no longer stalls at the first 20 cards; it now follows the official public AJAX endpoint and captures the full 181-card inventory
- `dunwoody-summer-camp` and `dunwoody-island-ford-camps` reuse a shared PDF pairing helper because the public week inventory lives in Dunwoody Nature Center's official theme PDFs while the landing pages carry the pricing, age, and registration constraints
- the live DB source-registration gap for the Hooky family-program pack is now closed; the current source rows are activated and subscribed into Atlanta

---

## Workstream Goal

Build a first production-quality family-program source pack that proves Hooky can:

- match competitor depth in the biggest category gaps
- preserve official-source trust
- normalize multiple source families into one planning-oriented program contract
- expand by repeating patterns, not by inventing each source from scratch

---

## Acceptance Gates

A pattern family is considered proven only when it satisfies all of the following:

1. At least two sources work in that family, unless the family is structurally unique.
2. The pattern emits real Hooky program objects, not loose listings.
3. The pattern survives live verification against the current public site.
4. The pattern has source-specific tests for the tricky parsing behavior.
5. The pattern does not require manual DB cleanup to remain usable.

A source is considered production-candidate only when it has:

- crawler implementation
- tests
- migration
- lint / compile pass
- live smoke verification

---

## What Counts As A Real Blocker

A blocker is real only if one of these is true:

1. The official source no longer exposes the needed data publicly.
2. The source requires browser/app auth or anti-bot handling beyond reasonable first-wave effort.
3. The public surface cannot reliably emit Hooky’s minimum program fields.
4. The source changed shape so aggressively that the pattern itself no longer generalizes.

These do **not** count as blockers:

- provider-specific parsing quirks
- weak first-pass tests
- source-specific normalization cleanup
- needing one more implementation pass after live smoke testing

If a source is not blocked, the default action is to keep shipping.

---

## Queue Order

### Lane A: deepen the proven families

1. third `MyRec` operator if it is still metro-relevant
2. next official source that materially widens civic or specialty depth
3. second swim/location operator in another operator family if needed

### Lane B: extend the school-hub family

1. one more high-volume school catalog if low-friction
2. one brochure-linked school source only if the public field density is still acceptable

### Lane C: later pattern families

1. camp-network ecosystems
2. franchise/location stacks that need app-level endpoint discovery

---

## Immediate Execution Queue

### Now

- one more metro-relevant civic or municipal operator

Why:

- arts/performance is now proven across multiple operator shapes
- session-rich private enrichment is now also proven across multiple operators
- the biggest remaining breadth opportunity is public/civic family inventory that expands coverage without duplicating the same private camp lane again

### Next candidates

Candidates:

- another metro `MyRec` or comparable municipal operator if available
- one more civic/public family-program source
- another branded youth-program hub with strong field density

Current note:

- `Girl Scouts of Greater Atlanta` is now implemented via the public `girlscoutsummer.com` WordPress camp inventory and official registration flow
- `Sandy Springs Recreation` remains a real target, but the older strategy URLs are dead and the currently linked registration host timed out in this environment during validation, so it is not yet a build candidate
- `Ballethnic` remains on the map, but the public site currently drops into a heavy Jackrabbit enrollment flow without a clean camp catalog, so it is not a first-wave build candidate yet
- `Stage Door Theatre` no longer exposes a clean standalone camp surface on its current public site, so it is not a first-wave build candidate on its own
- `Children's Museum of Atlanta` still has value in its special-program feed, but that inventory is already covered by the existing `childrens_museum.py` source; the scout page is evergreen workshop marketing, not session-rich camp inventory
- `Greater Atlanta Christian` is now implemented via the public specialty-camps page; `GROW Day Camp` remains intentionally excluded from the Hooky public pack because the official page states it is only available to current GAC families
- `Lovett` is now implemented from the public Summer at Lovett board, but the current official surface does not expose stable deep registration/detail pages; Hooky uses the official board/filter URLs as the trustable source destination instead
- `callanwolde-creative-camps` preserves `age_min` / `age_max` as unknown for the younger creative camps because the official public camp page exposes dates and registration codes but does not publish those age bands directly
- `dunwoody-summer-camp` is now implemented from the official summer-camp page plus the public themes-and-dates PDF; because Dunwoody Park's public page publishes pricing by track rather than by individual theme, non-explicit half-day-only rows keep the official mixed-track price range in `price_note`
- `dunwoody-island-ford-camps` is now implemented from the official Island Ford page plus the public camp PDF; the current public surface is field-rich enough to emit exact ages (`9-13`), hours (`9:00 AM - 4:00 PM`), and weekly price (`$422`)
- `gwinnett-family-programs` and `cobb-family-programs` are now activated in the live DB as Hooky-owned civic-family sources; the shared `Rec1` base now supports `require_family_relevance` for broad municipal catalogs instead of forcing one-off family filters per operator
- the shared `Rec1` short-date parser now avoids rolling recently past `MM/DD` sessions into the next year, which surfaced during the new civic-family smoke pass
- `atlanta-family-programs` and `dekalb-family-programs` are now activated in the live DB as Hooky-owned civic-family sources; Hooky now has family-focused public wrappers in both major metro operator families already present in the repo: `Rec1` and `ACTIVENet`
- the civic/public source rows are no longer merely activated; real production writes are now landing in the live DB after fixing the `events.category_id` mismatch (`programs` now normalizes to `family` in shared DB validation paths)
- the `ACTIVENet` family filter now excludes obvious adult-coded inventory like `men's` / `women's` activities before generic family/camp terms can admit them; this needs one cleanup rerun on Atlanta and DeKalb to fully harden the live public lane

---

## Delivery Rules

For each source added in this workstream:

1. Prefer a pattern-adjacent implementation over a bespoke one.
2. Preserve official registration URLs whenever visible.
3. Normalize age bands even if the source uses months, grade bands, or “all ages” phrasing.
4. Keep the Hooky object planning-oriented: title, dates or recurring shape, age fit, price note, trustable source URL.
5. Add tests for the source’s ugliest public edge case, not just the happy path.

---

## Current Risk Register

### Low risk

- school summer hubs
- `MyRec`
- public camp tables

### Medium risk

- swim/location stacks
- arts/performance customs
- hybrid public exports

### Higher risk

- app-backed schedule systems where the public landing page is thin and the real data lives behind client-side APIs

---

## Exit Condition For This Workstream

This workstream should continue until one of these becomes true:

1. Hooky has at least one strong source in every major family-program gap:
   - school camps
   - STEM/specialty enrichment
   - swim/movement
   - arts/performance
   - civic/municipal
2. The next highest-value sources are blocked by app/API constraints instead of normal crawler work.
3. The limiting factor becomes DB activation / portal QA rather than crawler coverage.

Until then, the default is to keep moving down the queue.
