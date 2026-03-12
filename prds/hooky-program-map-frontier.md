# Hooky Program Map Frontier

**Portal:** `hooky`
**Surface:** `consumer`
**Status:** Deep research pass
**Last Updated:** 2026-03-10
**Depends on:** `prds/035-hooky-family-portal.md`, `prds/hooky-provider-supply-audit.md`, `prds/hooky-competitor-program-map.md`, `prds/hooky-broad-official-source-audit.md`

---

## Purpose

This document answers the next strategic question after the first provider and competitor audits:

If Hooky wants a genuinely strong Atlanta `programs` map before building a larger crawler backlog, what is the official-source frontier by category, and where does current coverage still look thin against the competitor-discovered universe?

This is a **program-map artifact**, not a crawler build plan.

**Rule:** competitors remain discovery inputs only. Official provider sites, registration systems, and official program hubs remain the only acceptable source-of-truth layer.

---

## Executive Read

The market is now clearer.

Hooky already has a strong premium family-program core, but competitor depth is still materially broader in five areas:

1. school-hosted summer programs
2. long-tail STEM and specialty enrichment
3. swim and structured movement providers
4. neighborhood arts, music, dance, and youth performance operators
5. municipal and civic youth-program layers

The important shift from this pass:

- this is no longer a question of whether Atlanta has enough official family-program supply
- it is a question of which official-source patterns are worth building around

The best expansion targets are not generic directories. They are operators using one of a small number of repeatable surface types:

- school summer-program hubs
- `MyRec` municipal registration systems
- franchise/location program stacks
- camp hubs with downloadable brochures or weekly matrices
- registration platforms like `Jackrabbit`, `CampInTouch`, `PlayByPoint`, `ACTIVE`, and similar public flows

That is good news for Hooky. It means the frontier is broad enough to map before crawler work, and structured enough to prioritize rationally.

---

## Current Coverage Baseline

The repo already covers a meaningful family-program base:

- `high_museum.py`
- `puppetry_arts.py`
- `zoo_atlanta.py`
- `spruill_center_for_the_arts.py`
- `all_fired_up.py`
- `atlanta_workshop_players.py`
- `childrens_museum.py`
- `goldfish_swim.py`
- `the_coder_school.py`
- `atlanta_ballet.py`
- `mjcca.py`
- `atlanta_history_center.py`
- `chattahoochee_nature.py`
- `fernbank.py`
- `carlos_museum.py`
- `alliance_theatre.py`
- `swim_atlanta.py`
- `ymca_atlanta.py`
- `atlanta_parks_rec.py`
- `cobb_parks_rec.py`

Strategically, this means Hooky already owns a stronger premium core than most family products:

- museums and cultural institutions
- arts camps and performance programming
- coding and maker enrichment
- at least one elite swim lane
- some civic and parks coverage

The gap is not quality. The gap is **breadth and category completeness**.

---

## Category Frontier Map

### 1. School-Hosted and Campus Summer Programs

This is the biggest confirmed breadth gap versus competitor discovery surfaces.

| Provider | Official source | What is visible | System pattern | Hooky fit | Priority |
|---|---|---|---|---|---|
| Marist School | [maristschoolga.myrec.com/info/default.aspx](https://maristschoolga.myrec.com/info/default.aspx) | sports, arts, academic camps; weekly sessions; ages 5-17; after-camp care; public registration timing | `MyRec` | Excellent summer-depth source | Queue A |
| Pace Academy | [paceacademy.org/community/summer-programs](https://www.paceacademy.org/community/summer-programs) | full-day and half-day camps; rising K-12; athletic, arts, STEAM, specialty programs; registration deadlines | school summer hub | Excellent breadth and age spread | Queue A |
| Trinity School | [trinityatl.org/campus-life/summer-camp](https://www.trinityatl.org/campus-life/summer-camp) | ages 4-13; academic, specialty, and sports framing; full-day extensions; brochure-driven structure | school CMS + brochures | Strong camp-universe source | Queue A |
| The Walker School | [thewalkerschool.org/community/summer-programs](https://www.thewalkerschool.org/community/summer-programs) | summer programs hub; academic, athletic, artistic breadth; multi-program packaging | school summer hub | Strong category-completeness source | Queue A |
| Wesleyan School | [wesleyanschool.org/camps-clinics](https://www.wesleyanschool.org/camps-clinics) | ages 3-14; academic, athletic, enrichment, fine arts; morning, afternoon, full-day mixes | school camp/clinic hub | Strong mixed-age breadth | Queue A |
| The Swift School | [theswiftschool.org/programs/summer-programs/summerexplorations](https://www.theswiftschool.org/programs/summer-programs/summerexplorations) | rising K-6; 3-week program; explicit pricing tiers; aftercare | custom program page + form | Valuable specialty-school summer signal | Queue A |
| MJCCA Camps | [mjcca.org/camp](https://www.mjcca.org/camp) | camps for rising pre-K through 10th; day camps, sports, arts, specialty, overnight | large camp hub | Very high breadth, partly covered already | Queue B |

**Strategic read:** school camps should be treated as a category lane, not opportunistic one-offs. Competitors clearly use them to feel complete. Hooky needs enough of this category to avoid looking narrow every summer.

### 2. STEM, Coding, Chess, and Specialty Enrichment

This category is deeper than it first looked and has unusually strong compare potential.

| Provider | Official source | What is visible | System pattern | Hooky fit | Priority |
|---|---|---|---|---|---|
| theCoderSchool | existing official location pages | weekly camps, age filters, hours, before/after-care, Pike13 flows | public tables + `Pike13` | Existing benchmark source | Covered |
| Club SciKidz Atlanta | [atlanta.clubscikidz.com](https://atlanta.clubscikidz.com/) | 2026 summer camps, registration open, metro locations, STEM camp categories, `ACTIVE` registration | franchise site + `ACTIVE` | High-value STEM depth source | Queue A |
| Camp Invention | [invent.org/program-search/camp-invention](https://www.invent.org/program-search/camp-invention/) | official local session search, grade bands, host-level sessions, season-specific discovery | centralized program search | High-value official network source | Queue A |
| Kid Chess | [kidchess.com/our-programs/seasonal-camps](https://kidchess.com/our-programs/seasonal-camps/) | school-break and summer camps; metro locations; camp and enrichment framing | custom hub | Strong specialty-enrichment lane | Queue A |
| Snapology Dunwoody | [snapology.com/georgia-dunwoody](https://www.snapology.com/georgia-dunwoody/) | camps, classes, birthday and STEAM offerings; local franchise structure | franchise/location stack | Good breadth candidate | Queue B |
| Science Akademeia | [scienceakademeia.org](https://www.scienceakademeia.org/) | STEM camp and enrichment positioning is visible, but Atlanta specificity still needs tighter validation | custom site | Discovery-worthy, not yet proven | Queue C |
| Brainy Bytes | competitor-discovered; official Atlanta fit still weak | market relevance surfaced in competitor lists, but official Atlanta source confidence remains low | unclear | Do not force it into the first map | Queue C |

**Strategic read:** this is one of the most important expansion layers because parents actually compare within this category. Ages, themes, session dates, price, and location matter a lot, which fits Hooky’s product strategy.

### 3. Swim, Sports, and Movement

This remains weaker than arts or STEM overall, but it now has enough structured official supply to matter.

| Provider | Official source | What is visible | System pattern | Hooky fit | Priority |
|---|---|---|---|---|---|
| Goldfish Swim School | existing official location pages | recurring lessons, clinics, public lesson structure, program taxonomy | `iClassPro` | Existing benchmark source | Covered |
| Big Blue Swim School | [bigblueswimschool.com/locations/georgia/johns-creek](https://bigblueswimschool.com/locations/georgia/johns-creek/) | lessons for infants to kids; pricing signal; free trial; spring-break clinics; recurring structure | location program stack | Strong recurring-program lane | Queue A |
| Diventures Alpharetta | [diventures.com/locations/atlanta/swim](https://www.diventures.com/locations/atlanta/swim/) | swim lessons, camps, private lessons, free trial, monthly enrollment, family discounts, `Jackrabbit`-style calendar/config signals | location stack + registration platform | Strong recurring + camp source | Queue A |
| Nellya Fencers Club | [nellyafencers.com/camps-parties](https://www.nellyafencers.com/camps-parties/) | week-by-week camps, ages, prices, registration flow, PDF schedule support | custom camp hub | Excellent niche-sports source | Queue A |
| Atlanta Community Squash | [atlantacommunitysquash.org](https://www.atlantacommunitysquash.org/) | sports + tutoring + mentorship + summer camp framing | nonprofit program hub | Good mission-aligned family source | Queue B |
| A+ Squash | [aplussquash.org](https://www.aplussquash.org/) | juniors, camps, clinics, training structure | custom program site | Good specialty-sports candidate | Queue B |
| SwimAtlanta | existing source | recurring lesson importance is clear, but session-level structure remains weaker than Goldfish | `Jackrabbit` / `TeamUnify` mix | Useful later, not a lead expansion bet | Covered / lower priority |

**Strategic read:** swim is still the clearest first expansion lane inside sports and movement. It offers recurring structure, clear age bands, trials, and higher compare value than most youth sports sites.

### 4. Arts, Music, Dance, and Youth Performance Long Tail

This is already a Hooky strength, but the long tail is much wider than current coverage.

| Provider | Official source | What is visible | System pattern | Hooky fit | Priority |
|---|---|---|---|---|---|
| High Museum | existing source | flagship arts camp structure, weekly detail, sold-out/waitlist signals | premium cultural source | Benchmark | Covered |
| Center for Puppetry Arts | existing source | youth camps and age-structured seasonal programming | premium cultural source | Benchmark | Covered |
| Spruill Center for the Arts | existing source | high-volume youth arts classes and camps | registration-backed arts source | Benchmark | Covered |
| Atlanta Workshop Players | existing source | camp page with explicit dates and prices | camp hub | Benchmark | Covered |
| Ballethnic | [ballethnic.org/academy-of-dance](https://ballethnic.org/academy-of-dance/) | academy structure, summer camps, open registration signals, youth training ladder | custom site + `Jackrabbit` registration | Strong dance-depth source | Queue A |
| Vinings School of Art | [viningsschoolofart.com/summer-camps.html](https://viningsschoolofart.com/summer-camps.html) | age groups, 5-day camp structure, clear weekly prices, PDF support | custom camp page + docs | Excellent arts long-tail source | Queue A |
| Mister John’s Music | [misterjohnsmusic.com/summer-camp-atl](https://misterjohnsmusic.com/summer-camp-atl/) | dedicated Atlanta music camp page, current 2026-modified official content, youth arts framing | custom WordPress camp page | Strong music-camp candidate | Queue A |
| Dad’s Garage Camps | [dadsgarage.com/camps](https://www.dadsgarage.com/camps) | school-break camps, youth improv framing, registration and policy surface | custom camp hub | Strong neighborhood arts/performance source | Queue A |
| School of Rock Buckhead | [schoolofrock.com/locations/buckhead/music-camps](https://www.schoolofrock.com/locations/buckhead/music-camps) | location-specific music camps and workshops, age-based youth focus | franchise/location camp stack | Strong long-tail music source | Queue B |
| Atlanta Ballet School | [atlantaballet.com/education/summer-programs](https://atlantaballet.com/education/summer-programs) | summer intensives and youth programs; existing repo coverage can go deeper here | branded summer-programs hub | High-value youth-program deepening | Queue B |

**Strategic read:** this can become Hooky’s signature category. The right move is not generic “arts camp” editorial, but a denser official-source web of neighborhood arts schools, dance academies, improv camps, and location-based music programs.

### 5. Municipal and Civic Program Layers

This category matters for completeness, geography, and price diversity.

| Provider | Official source | What is visible | System pattern | Hooky fit | Priority |
|---|---|---|---|---|---|
| Atlanta Parks & Rec | existing source | baseline public rec and city-program inventory | civic programs | Existing civic layer | Covered |
| Cobb Parks & Rec | existing source | additional municipal program layer | civic programs | Existing metro extension | Covered |
| Chamblee Parks & Recreation | [chambleega.myrec.com/info/activities/default.aspx](https://chambleega.myrec.com/info/activities/default.aspx) | public `MyRec` activities with camps, athletics, recreation, and third-party providers like Snapology visible | `MyRec` | Excellent municipal structured source | Queue A |
| Girl Scouts of Greater Atlanta | [girlscoutsummer.com](https://www.girlscoutsummer.com/) | day camps, sleepaway, leadership camps, scholarship messaging, official registration flow | custom camp hub + `CampInTouch` | Strong camp-ecosystem source | Queue A |
| Sandy Springs Recreation and Parks | [sandyspringsga.gov/activities/recreation-and-parks](https://www.sandyspringsga.gov/activities/recreation-and-parks) | official city recreation surface exists, but public activity/program granularity still needs a tighter second pass | city recreation site | Important geography layer, not yet proven | Queue B |
| YMCA of Metro Atlanta | existing source | strategically broad but operationally messy program discovery | heavy JS / app-driven | Still poor early economics | Covered / lower priority |

**Strategic read:** this layer is less glamorous than premium camps, but it is important for geographic trust and budget breadth. It also catches teacher-workday and school-break utility moments better than private providers alone.

---

## Official-Source Pattern Intelligence

This pass clarified which source patterns are actually worth building around.

| Pattern | Examples | Why it matters | Hooky implication |
|---|---|---|---|
| `MyRec` | Marist, Chamblee | public activities, categories, registration framing, structured program names | very attractive for municipal and school-camp depth |
| School summer-program hubs | Pace, Trinity, Walker, Wesleyan, Swift | broad camp matrices, age bands, session logic, PDFs/brochures | treat as a reusable source class, not isolated one-offs |
| Franchise/location camp stacks | Club SciKidz, School of Rock, Big Blue, Snapology | local pages with branded templates and repeated fields | good leverage if field patterns repeat across locations |
| Registration platforms | `ACTIVE`, `CampInTouch`, `Jackrabbit`, `Pike13`, `PlayByPoint` | often expose the most program-like signals even when marketing pages are thin | platform intelligence is part of the moat |
| Custom camp pages with brochures | Vinings, Nellya, Trinity, Dad’s Garage | weekly camp framing plus downloadable detail | good if page + PDF combination is stable |
| Heavy JS activity finders | YMCA-style flows | high market relevance, low near-term crawl economics | avoid treating market size as extraction quality |

---

## Category Parity Read

This is the current parity view versus the competitor-derived provider universe.

| Category | Hooky today | Market depth target | Read |
|---|---|---|---|
| Premium museums / cultural camps | Strong | Strong | already credible |
| Arts / theater / youth performance | Strong but still expandable | Strong | best category to deepen into signature strength |
| School-hosted camps | Thin | Broad | biggest completeness gap |
| STEM / coding / specialty enrichment | Moderate | Broad | important next frontier |
| Swim / movement | Moderate in swim, weak in broader sports | Moderate | swim is the best near-term wedge |
| Municipal / civic youth programs | Moderate | Moderate | worth expanding for trust and geography |

---

## Ranked Frontier

### Queue A: Best next official-source universe for the map

- Marist School
- Pace Academy
- Trinity School
- The Walker School
- Wesleyan School
- The Swift School
- Club SciKidz Atlanta
- Camp Invention
- Kid Chess
- Big Blue Swim School
- Diventures Alpharetta
- Nellya Fencers Club
- Ballethnic
- Vinings School of Art
- Mister John’s Music
- Dad’s Garage Camps
- Chamblee Parks & Recreation
- Girl Scouts of Greater Atlanta

### Queue B: Strong second-wave expansion

- MJCCA subprogram detail
- School of Rock Buckhead
- Atlanta Ballet youth/summer program deepening
- Atlanta Community Squash
- A+ Squash
- Sandy Springs Recreation and Parks
- Snapology Dunwoody

### Queue C: Keep in the discovery map, but do not treat as first-wave truth sources yet

- Brainy Bytes
- Science Akademeia
- large generic sports finders
- heavy-JS giant activity directories

---

## What This Means Before Building More Crawlers

The crawler question should now be sequenced behind the map question.

The right pre-build checklist is:

1. confirm enough official-source breadth in each weak category
2. identify the repeatable source-system patterns inside that breadth
3. pick the smallest source pack that closes the biggest parity gaps

The wrong move would be:

- building one crawler each for a random mix of camps, studios, and sports programs
- without first proving which category lanes actually close the competitor-depth gap

At this point the most important open frontier is no longer “does Atlanta have enough family programs?”

It is:

**“How many of the remaining parity gaps can Hooky close with a small number of repeatable official-source patterns?”**

That is the right question to answer next.

