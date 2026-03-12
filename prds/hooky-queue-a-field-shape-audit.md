# Hooky Queue A Field-Shape Audit

**Portal:** `hooky`
**Surface:** `consumer`
**Status:** Deep research pass
**Last Updated:** 2026-03-10
**Depends on:** `prds/hooky-program-map-frontier.md`

---

## Purpose

This document turns the Queue A provider universe into a more decision-useful question:

Which official sources are actually rich enough, repeatable enough, and clean enough to close competitive depth with a small number of crawler patterns?

This is still **research**, not implementation.

The output is a field-shape audit:

- what fields are visible on the public source
- what system pattern the source uses
- how reusable that pattern looks
- whether the provider is a true first-wave source or just a strategically relevant discovery target

---

## Executive Read

The Queue A universe now separates cleanly into three groups.

### 1. Best first-wave sources

These are the most attractive because they expose the right fields on public pages and map to reusable patterns:

- Marist School (`MyRec`)
- Chamblee Parks & Recreation (`MyRec`)
- Club SciKidz Atlanta (`ACTIVE` + session-rich camp archive)
- Kid Chess (public HTML camp tables)
- Big Blue Swim School (location stack with recurring lesson and clinic signals)
- Vinings School of Art (custom camp page with age bands and prices)
- Nellya Fencers Club (custom camp page with ages, dates, and pricing)
- Girl Scouts of Greater Atlanta (`CampInTouch` ecosystem + clear camp taxonomy)

### 2. Strong category sources, but less crawler-clean

These still matter strategically, but the public field shape is thinner, more brochure-driven, or more location/page-specific:

- Pace Academy
- Trinity School
- Wesleyan School
- The Swift School
- Diventures Alpharetta
- Dad’s Garage Camps
- Mister John’s Music
- Camp Invention

### 3. Strategically relevant, but not first-wave truth sources yet

These currently have weaker public structure or shakier access:

- The Walker School
- Ballethnic

That does not mean they should be dropped from the map. It means they should not drive the first implementation pattern decisions.

---

## Field Coverage Standard

For this audit, a provider is strongest when the public surface exposes most of the following in one crawlable layer:

- program title
- age band or grade band
- dates or week/session structure
- time block or full-day / half-day logic
- price
- location
- registration URL
- visible status signal or season signal

The more of these fields exist on a single public source, the more useful the source is for Hooky’s compare and planning strategy.

---

## Pattern-Level Findings

### Pattern 1: `MyRec`

**Examples:** Marist, Chamblee

Why it matters:

- strong public category lists
- clear program naming
- registration-native structure
- repeatable pattern across school and municipal operators

This is one of the best source classes in the current research set.

### Pattern 2: Session-rich custom camp archives tied to public registration

**Examples:** Club SciKidz

Why it matters:

- program pages expose age bands, prices, dates, and locations
- session links point to public `ACTIVE` registration flows
- high compare value inside one source

This is probably the single highest-yield private-provider pattern found so far.

### Pattern 3: Public HTML camp tables

**Examples:** Kid Chess

Why it matters:

- tables expose camp, dates, grades, session options, times, and tuition
- strong fit for compare UX
- easy to reason about without needing app-level API access

This is an excellent pattern even when it is not shared by many providers.

### Pattern 4: School summer hubs with downstream detail

**Examples:** Pace, Trinity, Wesleyan, Swift

Why it matters:

- strategically important category
- good breadth and age coverage
- often enough public structure to establish camp universes

Risk:

- details may be split across PDFs, brochures, or internal subpages
- pattern is reusable, but extraction may not be as clean as `MyRec`

### Pattern 5: Recurring-program location stacks

**Examples:** Big Blue, Diventures

Why it matters:

- recurring lesson structure matters for Hooky’s long-term `programs` model
- swim is one of the few movement categories that actually looks compareable

Risk:

- some useful fields live in marketing content rather than explicit schedule tables
- recurring session detail may require deeper inspection of downstream registration flows

### Pattern 6: Camp-network ecosystems

**Examples:** Girl Scouts, Camp Invention

Why it matters:

- broad inventory and strong family relevance
- better geographic and seasonal breadth than single-provider sites

Risk:

- the public entry layer is often a taxonomy or search surface, not a simple archive
- may require more workflow logic than a normal provider crawl

### Pattern 7: Custom arts/performance camp pages

**Examples:** Vinings, Nellya, Dad’s Garage, Mister John’s

Why it matters:

- rich category depth
- clear family utility
- good complement to Hooky’s existing premium arts base

Risk:

- quality varies a lot by provider
- some are field-rich, others are mostly promotional

---

## Provider Audit Matrix

| Provider | Category | Official source | Public field coverage | Pattern | Pattern reuse | Risk | Read |
|---|---|---|---|---|---|---|---|
| Marist School | school camps | [maristschoolga.myrec.com/info/default.aspx](https://maristschoolga.myrec.com/info/default.aspx) | High: ages 5-17, weekly sessions, full/half day, after-care, registration timing, camp categories | `MyRec` | High | Low | true first-wave source |
| Chamblee Parks & Recreation | civic / municipal | [chambleega.myrec.com/info/activities/default.aspx](https://chambleega.myrec.com/info/activities/default.aspx) | Medium-high: public categories, program names, camp section, recreation inventory, third-party providers visible | `MyRec` | High | Low | true first-wave source |
| Club SciKidz Atlanta | STEM camps | [atlanta.clubscikidz.com](https://atlanta.clubscikidz.com/) | Very high: age bands, prices, dates, locations, session links, season labels | custom archive + `ACTIVE` | Medium-high | Low-medium | elite first-wave source |
| Kid Chess | specialty enrichment | [kidchess.com/our-programs/seasonal-camps](https://kidchess.com/our-programs/seasonal-camps/) | Very high: dates, grades, sessions, times, tuition, location, registration CTA | public HTML tables | Medium | Low | elite first-wave source |
| Big Blue Swim School | swim / recurring lessons | [bigblueswimschool.com/locations/georgia/johns-creek](https://bigblueswimschool.com/locations/georgia/johns-creek/) | Medium-high: age range, weekly lessons, trial, clinic language, pricing signal | location stack | Medium | Medium | strong first-wave source |
| Diventures Alpharetta | swim / recurring lessons | [diventures.com/locations/atlanta/swim](https://www.diventures.com/locations/atlanta/swim/) | Medium: all-ages lesson taxonomy, private lessons, camps, monthly enrollment, free-trial signals | location stack + downstream calendar | Medium | Medium | strong but second-wave candidate |
| Vinings School of Art | arts camps | [viningsschoolofart.com/summer-camps.html](https://viningsschoolofart.com/summer-camps.html) | High: age bands, weekly structure, clear prices, PDF support | custom camp page | Low-medium | Low | excellent first-wave source |
| Nellya Fencers Club | specialty sports | [nellyafencers.com/camps-parties](https://nellyafencers.com/camps-parties/) | High: camp weeks, ages, prices, registration links, PDFs | custom camp page | Low-medium | Low | excellent first-wave source |
| Girl Scouts of Greater Atlanta | camp network | [girlscoutsummer.com](https://www.girlscoutsummer.com/) | Medium-high: camp taxonomy, camp families, registration flow, scholarship messaging, location families | camp network + `CampInTouch` | Medium | Medium | strong first-wave source |
| Pace Academy | school camps | [paceacademy.org/community/summer-programs](https://www.paceacademy.org/community/summer-programs) | Medium: full/half-day structure, rising K-12, program families, registration deadlines | school summer hub | High | Medium | valuable category anchor |
| Trinity School | school camps | [trinityatl.org/campus-life/summer-camp](https://www.trinityatl.org/campus-life/summer-camp) | Medium: ages 4-13, camp framing, brochure-based detail | school CMS + brochure | Medium-high | Medium | useful, but not the cleanest first build |
| Wesleyan School | school camps | [wesleyanschool.org/camps-clinics](https://www.wesleyanschool.org/camps-clinics) | Medium: ages 3-14 and broad camp taxonomy are visible, but detailed session fields need deeper extraction | Finalsite hub | Medium-high | Medium | useful category anchor |
| The Swift School | school camps | [theswiftschool.org/programs/summer-programs/summerexplorations](https://www.theswiftschool.org/programs/summer-programs/summerexplorations) | Medium-high: rising K-6, pricing tiers, aftercare, program framing | custom school program page | Medium | Medium | solid specialty-school source |
| Camp Invention | STEM network | [invent.org/program-search/camp-invention](https://www.invent.org/program-search/camp-invention/) | Medium: grade-band and location/session logic are visible, but search workflow is more involved | centralized search network | Medium | Medium-high | strategically good, not simplest first implementation |
| Dad’s Garage Camps | youth performance | [dadsgarage.com/camps](https://www.dadsgarage.com/camps) | High: rising grade bands, week-by-week camp links, daily hours, themed weeks, direct sign-up links | custom camp page + Salesforce ticketing | Low-medium | Low-medium | strong arts/performance source |
| Mister John’s Music | music camps | [misterjohnsmusic.com/summer-camp-atl](https://misterjohnsmusic.com/summer-camp-atl/) | Medium: current official camp page and strong category fit, but thinner public field extraction so far | custom WordPress camp page | Low | Medium | good map source, not top implementation source |
| The Walker School | school camps | [thewalkerschool.org/community/summer-programs](https://www.thewalkerschool.org/community/summer-programs) | Low-medium: category relevance is clear, but the public page response was not reliable in this pass | school summer hub | Unknown | High | keep on map, do not lead with it |
| Ballethnic | dance / youth arts | [ballethnic.org/academy-of-dance](https://ballethnic.org/academy-of-dance/) | Low-medium: academy relevance is clear and registration exists, but public camp/session detail is still thin from the main page | custom site + `Jackrabbit` link | Low | Medium-high | strategically relevant, not first-wave clean |

---

## What Actually Closes Depth Fastest

If the question is:

**“Which small source pack closes the most parity gaps with the fewest crawler patterns?”**

the best answer from this pass is:

1. Marist School
2. Chamblee Parks & Recreation
3. Club SciKidz Atlanta
4. Kid Chess
5. Big Blue Swim School
6. Vinings School of Art
7. Girl Scouts of Greater Atlanta
8. Pace Academy

Why this pack works:

- it covers school camps, civic programs, STEM, specialty enrichment, swim, arts, and camp networks
- it exercises several reusable source patterns instead of one-off custom work
- it closes the most visible breadth gaps against competitors without abandoning Hooky’s quality bar

Strong alternates:

- Nellya Fencers Club
- Dad’s Garage Camps
- Diventures Alpharetta
- The Swift School

---

## Revised Implementation Read

The first implementation wave should not be chosen by “best brands” alone.

It should be chosen by the intersection of:

- category gap closed
- field richness
- pattern reuse
- trustworthiness of the official source

That points to this pattern order:

1. `MyRec`
2. Club SciKidz-style session archives with public registration links
3. public HTML camp-table sources
4. one school summer-hub pattern
5. one recurring swim/location pattern
6. camp-network ecosystems after the above are understood

That order is more defensible than building random providers one at a time.

---

## Key Strategic Adjustment

The earlier frontier doc treated most Queue A sources as roughly equal research candidates.

This pass shows they are not equal.

The most important distinction is now:

- **pattern-rich truth sources** that should inform implementation
- versus
- **category-valid but field-thin sources** that should remain in the research map until a stronger entry path is found

That distinction is what should govern the next move.

