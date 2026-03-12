# Hooky Pattern Backlog

**Portal:** `hooky`
**Surface:** `consumer`
**Status:** Research-to-implementation bridge
**Last Updated:** 2026-03-10
**Depends on:** `prds/hooky-program-map-frontier.md`, `prds/hooky-queue-a-field-shape-audit.md`

---

## Purpose

This document converts the family-program research into a pattern backlog instead of a provider backlog.

That is the right level for the next decision because Hooky does not need to answer:

- “Which single provider should we crawl next?”

It needs to answer:

- “Which source patterns close the most competitive depth with the least net-new crawler invention?”

This doc combines:

- market-depth value
- field richness
- repeatability
- evidence of similar patterns already present in the repo

---

## Executive Read

The repo already has meaningful precedent for several adjacent program patterns:

- `ACTIVENet` via [`crawlers/sources/atlanta_dpr.py`](/Users/coach/Projects/LostCity/crawlers/sources/atlanta_dpr.py) and [`crawlers/sources/dekalb_parks_rec.py`](/Users/coach/Projects/LostCity/crawlers/sources/dekalb_parks_rec.py)
- `iClassPro` via [`crawlers/sources/goldfish_swim.py`](/Users/coach/Projects/LostCity/crawlers/sources/goldfish_swim.py)
- `Pike13`-adjacent HTML extraction via [`crawlers/sources/the_coder_school.py`](/Users/coach/Projects/LostCity/crawlers/sources/the_coder_school.py)
- `Jackrabbit` constraints via [`crawlers/sources/swim_atlanta.py`](/Users/coach/Projects/LostCity/crawlers/sources/swim_atlanta.py)
- `Finalsite` page parsing via [`crawlers/sources/atlanta_public_schools_board.py`](/Users/coach/Projects/LostCity/crawlers/sources/atlanta_public_schools_board.py)

That matters because it means Hooky is not starting from zero on program-system intelligence.

The best next pattern order is:

1. `MyRec`
2. session-rich public camp archives tied to public registration
3. public HTML camp-table sources
4. school summer hubs
5. custom arts/performance camp pages
6. recurring swim/location stacks
7. camp-network ecosystems

This order is not “easiest first.” It is the best blend of:

- market depth closed
- pattern reuse
- repo-adjacent capability
- data quality potential

---

## Pattern Matrix

| Pattern | Example providers | Depth closed | Repo precedent | Net-new complexity | Recommendation |
|---|---|---|---|---|---|
| `MyRec` program catalogs | Marist, Chamblee | school camps + municipal programs | adjacent to `ACTIVENet`, but no confirmed `MyRec` crawler yet | Medium | Build early |
| session-rich public archives + public registration links | Club SciKidz | STEM and camp-depth gap | no dedicated pattern yet, but public registration-link handling is familiar | Medium | Build early |
| public HTML camp tables | Kid Chess | specialty enrichment with high compare value | similar to table extraction already used in `the_coder_school.py` | Low-medium | Build early |
| school summer hubs | Pace, Trinity, Wesleyan, Swift | major school-camp parity gap | `Finalsite` precedent exists; brochure splitting is the main risk | Medium | Build after first three |
| custom arts/performance camp pages | Vinings, Nellya, Dad’s Garage | arts depth and neighborhood completeness | strong precedent from current arts/camp sources | Low-medium | Build opportunistically after school-hub pattern |
| recurring swim/location stacks | Big Blue, Diventures | swim/movement gap | strong adjacent knowledge from `goldfish_swim.py` and `swim_atlanta.py` | Medium | Build after school-hub and arts patterns |
| camp-network ecosystems | Girl Scouts, Camp Invention | broad seasonal and geographic depth | no direct confirmed implementation yet | High | Build later, once simpler patterns are proven |

---

## Pattern Briefs

### 1. `MyRec` program catalogs

**Examples**

- [Marist School](https://maristschoolga.myrec.com/info/default.aspx)
- [Chamblee Parks & Recreation](https://chambleega.myrec.com/info/activities/default.aspx)

**What the pattern gives Hooky**

- school-hosted camps
- municipal program breadth
- public category trees
- registration-native program lists
- strong names and cleaner source-of-truth than editorial directories

**Visible fields**

- program names
- categories
- camp/program grouping
- registration links
- often dates and program detail pages downstream

**Repo adjacency**

- no direct `MyRec` crawler confirmed
- strong conceptual similarity to `ACTIVENet` crawling already present
- existing municipal-program normalization work should transfer

**Why it should be early**

- closes two strategic gaps at once: school camps and civic layers
- likely reusable beyond just these two providers

**Risk**

- `MyRec` is net-new enough that the first implementation will still be exploratory

### 2. Session-rich public camp archives tied to public registration

**Examples**

- [Club SciKidz Atlanta](https://atlanta.clubscikidz.com/)

**What the pattern gives Hooky**

- one of the strongest STEM expansion lanes
- age, price, date, location, and registration in a single public surface
- unusually high compare value

**Visible fields**

- camp title
- age band
- price
- season label
- session date
- location
- direct `ACTIVE` registration link

**Repo adjacency**

- no fully confirmed dedicated `ACTIVE` camp-archive crawler yet
- the repo already understands public registration-link normalization in several sources

**Why it should be early**

- this is one of the cleanest private-provider patterns found in the research
- closes the “long-tail STEM” gap very efficiently

**Risk**

- may be more franchise-specific than it first appears

### 3. Public HTML camp-table sources

**Examples**

- [Kid Chess](https://kidchess.com/our-programs/seasonal-camps/)

**What the pattern gives Hooky**

- specialty enrichment with strong planning utility
- explicit compare fields without app-level scraping

**Visible fields**

- dates
- grades
- sessions
- times
- tuition
- location
- registration CTA

**Repo adjacency**

- closest existing analogue is [`crawlers/sources/the_coder_school.py`](/Users/coach/Projects/LostCity/crawlers/sources/the_coder_school.py), which already scrapes a session-style public table and preserves price + signup structure

**Why it should be early**

- low ambiguity
- very strong field density
- good complement to STEM and specialty-enrichment depth

**Risk**

- less reusable as a single named platform than `MyRec`, but the extraction style is still broadly useful

### 4. School summer hubs

**Examples**

- [Pace Academy](https://www.paceacademy.org/community/summer-programs)
- [Trinity School](https://www.trinityatl.org/campus-life/summer-camp)
- [Wesleyan School](https://www.wesleyanschool.org/camps-clinics)
- [The Swift School](https://www.theswiftschool.org/programs/summer-programs/summerexplorations)

**What the pattern gives Hooky**

- the biggest breadth gap against competitor camp directories
- broad age coverage
- sports + arts + academic variety

**Visible fields**

- age/grade framing
- full-day / half-day logic
- camp-family taxonomy
- registration deadlines or season signals
- brochure or downstream-page detail

**Repo adjacency**

- [`crawlers/sources/atlanta_public_schools_board.py`](/Users/coach/Projects/LostCity/crawlers/sources/atlanta_public_schools_board.py) proves there is already Finalsite parsing literacy in the repo
- this lowers risk on some school CMS surfaces

**Why it should not be first**

- strategically essential, but more fragmented than the top three patterns
- details often split across PDFs or subpages

**Risk**

- a school-hub crawler may still require school-specific handling even when the CMS family overlaps

### 5. Custom arts/performance camp pages

**Examples**

- [Vinings School of Art](https://viningsschoolofart.com/summer-camps.html)
- [Nellya Fencers Club](https://www.nellyafencers.com/camps-parties/)
- [Dad’s Garage Camps](https://www.dadsgarage.com/camps)

**What the pattern gives Hooky**

- neighborhood depth inside Hooky’s strongest category
- more local personality than school-camp universes alone

**Visible fields**

- age or grade bands
- weekly camp structure
- themes
- prices
- registration links

**Repo adjacency**

- Hooky already has strong custom-source arts program experience in:
  - [`crawlers/sources/atlanta_workshop_players.py`](/Users/coach/Projects/LostCity/crawlers/sources/atlanta_workshop_players.py)
  - [`crawlers/sources/all_fired_up.py`](/Users/coach/Projects/LostCity/crawlers/sources/all_fired_up.py)
  - [`crawlers/sources/spruill_center_for_the_arts.py`](/Users/coach/Projects/LostCity/crawlers/sources/spruill_center_for_the_arts.py)

**Why it belongs in the first half of the backlog**

- low conceptual risk
- continues Hooky’s premium-to-local expansion in its most differentiated category

**Risk**

- pattern reuse is weaker than system-based sources like `MyRec`

### 6. Recurring swim/location stacks

**Examples**

- [Big Blue Swim School](https://bigblueswimschool.com/locations/georgia/johns-creek/)
- [Diventures Alpharetta](https://www.diventures.com/locations/atlanta/swim/)

**What the pattern gives Hooky**

- a real movement/sports wedge
- recurring-program inventory rather than just one-off camps

**Visible fields**

- lesson taxonomy
- age segmentation
- trial language
- clinic/camp language
- recurring structure
- some price or enrollment-model signal

**Repo adjacency**

- [`crawlers/sources/goldfish_swim.py`](/Users/coach/Projects/LostCity/crawlers/sources/goldfish_swim.py) already proves the value of open `iClassPro`
- [`crawlers/sources/swim_atlanta.py`](/Users/coach/Projects/LostCity/crawlers/sources/swim_atlanta.py) documents the limits of `Jackrabbit`

**Why it is later than it may seem**

- strategically useful, but recurring-program detail may live deeper than the visible marketing layer
- it is easy to overestimate this category based on demand alone

**Risk**

- downstream registration systems may be partially closed or inconsistent

### 7. Camp-network ecosystems

**Examples**

- [Girl Scouts of Greater Atlanta](https://www.girlscoutsummer.com/)
- [Camp Invention](https://www.invent.org/program-search/camp-invention/)

**What the pattern gives Hooky**

- high seasonal breadth
- better geography and camp-family range than single operators

**Visible fields**

- camp families
- location families
- registration ecosystems
- grade-band or season-level framing

**Repo adjacency**

- no clear direct crawler precedent for `CampInTouch`
- no confirmed current dedicated pattern for centralized camp-network search flows

**Why it is later**

- high strategic value, but more workflow complexity than the cleaner early patterns

**Risk**

- search/network logic may require more orchestration than one-site crawlers

---

## Recommended Order

### Phase 1: Highest leverage pattern work

1. `MyRec`
2. session-rich public camp archives tied to public registration
3. public HTML camp-table sources

Why:

- these give the best ratio of field richness to implementation complexity
- they close visible competitor gaps quickly
- they produce strong program objects, not just discovery copy

### Phase 2: Category-completeness expansion

4. school summer hubs
5. custom arts/performance camp pages
6. recurring swim/location stacks

Why:

- these broaden Hooky into the biggest market gaps after the first clean patterns are proven

### Phase 3: Higher-complexity ecosystem patterns

7. camp-network ecosystems

Why:

- these may be valuable enough to do, but they should not set the shape of the first implementation wave

---

## Minimal First Pattern Pack

If Hooky wants the smallest research-backed implementation pack that still changes the competitive story, it should be:

- one `MyRec` source
- one Club SciKidz-style session archive source
- one Kid Chess-style public camp-table source
- one school summer hub

That gives Hooky:

- school camps
- civic/school registration-native programs
- long-tail STEM
- specialty enrichment

before it spends time on harder recurring-program or network models.

---

## Key Strategic Conclusion

The research now supports a stronger claim than before:

Hooky does not need a giant crawler land grab to materially improve family-program depth.

It needs:

- a small number of well-chosen source patterns
- each tied to a category gap competitors currently cover better

That is a much more defensible path to a peerless `programs` layer.

