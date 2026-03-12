# Hooky Content Research Plan

**Purpose:** Validate the Hooky strategy and content architecture with real-world evidence before investing heavily in crawler expansion, launch messaging, or compare/camp UX.

**Portal:** `hooky`
**Surface:** `consumer`
**Status:** Draft
**Last Updated:** 2026-03-10
**Depends on:** `prds/035-hooky-family-portal.md`, `prds/hooky-content-architecture.md`

---

## Research Philosophy

Hooky does not become peerless by sounding better than parenting blogs. It becomes peerless by knowing more, structuring more, and timing content better than everyone else.

That means the research burden is not "what should we write about?" It is:

1. What planning problems do Atlanta families actually need solved?
2. Which sources contain enough structured signal to solve them reliably?
3. Where can Hooky create a content advantage competitors cannot easily copy?
4. Which parts of the strategy are real, and which are still wishful thinking?

Every research track should produce a concrete artifact:

- source field inventory
- volume count
- sample dataset
- competitor gap matrix
- decision recommendation
- updated requirement in the strategy or content architecture docs

Do not let content strategy drift into editorial ambition. If a research output does not improve planning utility, comparison power, or trust, it is secondary.

---

## What "Peerless Content" Means for Hooky

For Hooky, peerless content is:

- more structured than Atlanta Parent, Mommy Poppins, and Macaroni KID
- more current than static camp roundups
- more compareable than provider directories
- more useful on teacher workdays, breaks, and deadline moments than generic event calendars
- more trustworthy than aggregator dumps labeled "family-friendly"

Hooky does **not** need to win by:

- publishing more listicles
- having the most lifestyle copy
- pretending every event is a good fit for every family
- bloating the feed with low-signal "kid-friendly" filler

---

## Research Track 1: Family Planning Moment Discovery

**Goal:** Validate the actual planning moments Hooky should own, and rank them by frequency, urgency, and monetizable value.

This track answers the highest-level product question: what moments deserve content and structured inventory first?

### 1A. Planning Moment Inventory

**Research tasks:**
- [ ] Turn the PRD's core jobs into a planning-moment list:
  - this weekend
  - teacher workday
  - no-school day
  - spring break
  - summer camp signup
  - after-school decision
  - "Kid A is busy, what can Kid B do?"
- [ ] For each moment, document:
  - urgency
  - recurrence
  - likely time horizon
  - whether it is event-led, program-led, or hybrid
- [ ] Rank moments by:
  - weekly frequency
  - planning pain
  - inventory availability
  - differentiation potential

**Output:** Planning-moment matrix with launch priority ranking.

**Blocks:** Feed composition, seasonal collections, crawler prioritization.

### 1B. Calendar Pressure Map

**Research tasks:**
- [ ] Map the annual family planning calendar for Metro Atlanta:
  - Jan-Mar camp season
  - spring break
  - May-Aug summer planning
  - Aug back-to-school reset
  - fall break
  - holiday break / winter break
- [ ] Document which moments depend on school calendars vs provider deadlines vs general seasonality
- [ ] Identify which moments create genuine "panic" behavior versus light browsing

**Output:** Annual Hooky content calendar tied to planning demand, not editorial seasonality.

**Blocks:** `Heads Up`, camp messaging, seasonal landing pages.

---

## Research Track 2: Source Reality Audit for Weekly Utility

**Goal:** Determine whether current and near-term sources can power `This Weekend`, `Free This Week`, and age-filtered family discovery without obvious thinness or repetition.

### 2A. Existing Family Source Audit

**Strategy sections:** PRD-035 §Existing Infrastructure, §Content Coverage

**Research tasks:**
- [ ] Audit each current Hooky-relevant source:
  - Atlanta-Fulton Library
  - DeKalb Library
  - Gwinnett Library
  - Cobb Library
  - Fernbank
  - Zoo Atlanta
  - Georgia Aquarium
  - Atlanta Parks & Rec
  - Alliance Theatre
  - Piedmont classes
  - Eventbrite family filter
- [ ] For each source, document:
  - current volume
  - event cadence
  - location coverage
  - age-signal quality
  - price/free coverage
  - image quality
  - freshness/reliability
- [ ] Sample the next 30-60 days from each source and categorize:
  - storytime / literacy
  - museum / attraction
  - outdoor / parks
  - arts / theater
  - class / workshop
  - generic "family event"
- [ ] Identify over-concentration risk:
  - too much storytime
  - too much broad all-ages museum inventory
  - not enough older-kid content

**Output:** Source profile matrix for weekly utility and diversity.

**Blocks:** Feed launch readiness, age-band distribution, section quality.

### 2B. P0 Gap Validation

**Research tasks:**
- [ ] Validate the missing launch sources in PRD-035:
  - Center for Puppetry Arts
  - Cobb Parks & Rec
  - DeKalb Parks & Rec
  - Gwinnett Parks & Rec
  - Children's Museum of Atlanta
- [ ] For each, answer:
  - does the source publish enough volume to matter?
  - does it have structured age signal?
  - is the source crawlable?
  - does it improve content diversity or just add more of the same?

**Output:** P0 gap priority order with "must-have", "nice-to-have", or "skip".

**Blocks:** Crawler backlog sequencing.

---

## Research Track 3: Programs and Provider Supply Audit

**Goal:** Prove that Hooky can actually build the differentiated `programs` layer instead of just describing one in a PRD.

This is the most important track. If the programs layer is weak, Hooky collapses into a family events portal with nicer copy.

### 3A. Structured Program Source Audit

**Research tasks:**
- [ ] Identify the first 25 Atlanta providers most likely to publish structured program data:
  - camps
  - enrichment studios
  - youth sports / rec leagues
  - museums with recurring classes
  - arts organizations with recurring youth programs
- [ ] For each provider, document:
  - whether programs are published on web pages, PDFs, forms, or booking platforms
  - age range visibility
  - schedule visibility
  - cost visibility
  - registration status visibility
  - registration URL quality
  - seasonality
- [ ] Categorize providers by extraction feasibility:
  - high-structure / high-value
  - crawlable but messy
  - likely manual seed + enrich
  - not worth launch effort

**Output:** Provider source pack shortlist for the first `programs` inventory push.

**Blocks:** `programs` table usefulness, compare UX, camp season positioning.

### 3B. Booking Platform Discovery

**Research tasks:**
- [ ] Inventory the booking/registration platforms common in Atlanta family programs:
  - Sawyer
  - ActivityHero
  - Jackrabbit
  - Mindbody
  - CampMinder
  - custom forms / Google Forms / PDF registration packets
- [ ] For each platform, determine:
  - what metadata is exposed publicly
  - whether pricing is visible
  - whether registration status is inferable
  - whether session granularity exists
  - whether anti-bot or auth constraints are likely blockers

**Output:** Platform feasibility matrix.

**Blocks:** Program crawler strategy, registration-status confidence.

### 3C. Provider Market Reality Check

**Research tasks:**
- [ ] Segment providers into:
  - camps
  - arts enrichment
  - STEM / coding
  - sports / rec
  - tutoring / academic enrichment
  - nature / outdoor
- [ ] Estimate how much usable program inventory each segment can contribute
- [ ] Identify which segments are most likely to eventually pay for visibility and analytics
- [ ] Compare that against which segments are easiest to crawl

**Output:** Market-and-data overlap matrix showing where content advantage and future business value align.

**Blocks:** P1 source strategy, provider outreach thesis.

---

## Research Track 4: Age-Fit and Interest Signal Validation

**Goal:** Prove that Hooky can personalize responsibly and accurately enough to be useful.

### 4A. Age Signal Audit

**Research tasks:**
- [ ] Sample 100 family-relevant items across priority sources
- [ ] For each item, classify the age signal as:
  - explicit numeric range
  - explicit band (`ages 3-5`, `tweens`, etc.)
  - inferred but risky
  - absent
- [ ] Build a normalization map from source language to Hooky age bands:
  - infant
  - toddler
  - preschool
  - elementary
  - tween
  - teen
- [ ] Identify which sources have enough age structure to support feed filtering and compare

**Output:** Age-signal quality report plus normalization rules.

**Blocks:** `For [Nickname]`, age filters, collection reliability.

### 4B. Interest Tag Feasibility

**Research tasks:**
- [ ] Sample 100 items and test whether interests can be reliably mapped from title/description:
  - STEM
  - art
  - music
  - sports
  - outdoors
  - animals
  - reading
  - cooking
  - dance
  - theater
- [ ] Document ambiguity rates
- [ ] Flag tags that require too much editorial judgment and should not drive personalized rails

**Output:** Interest-tag feasibility table.

**Blocks:** Personalized recommendation rails, onboarding interest choices.

---

## Research Track 5: Trust and Registration Intelligence Audit

**Goal:** Validate that Hooky can make trustworthy claims about freshness, availability, and registration timing.

### 5A. Freshness Reality Check

**Research tasks:**
- [ ] Sample 50 event records and 50 prospective program records
- [ ] Check whether source pages still match the crawled data
- [ ] Measure how often dates, status, or links are stale
- [ ] Group issues by cause:
  - source changed
  - crawler missed update
  - listing expired
  - status no longer available

**Output:** Freshness defect taxonomy and freshness-badge threshold recommendation.

**Blocks:** trust labels, source quality scoring.

### 5B. Registration Signal Audit

**Research tasks:**
- [ ] Sample 50 provider and event registration pages
- [ ] Classify what Hooky can truly know:
  - open
  - closed
  - waitlist
  - sold out
  - upcoming
  - unknown
- [ ] Measure how often registration state is explicit versus only implied
- [ ] Identify which provider/platform patterns support high-confidence status extraction

**Output:** Registration-status confidence rubric.

**Blocks:** status pills, camp urgency messaging, compare usefulness.

---

## Research Track 6: Competitor and Gap Audit

**Goal:** Find the actual whitespace in Atlanta family discovery, not the imagined one.

This track should be internet-backed when executed because competitor inventories and UX evolve.

### 6A. Competitor Surface Audit

**Priority competitors:**
- Atlanta Parent
- Mommy Poppins Atlanta
- Macaroni KID
- ActivityHero
- Sawyer
- Kids Out and About
- local provider directories and "summer camps" guides

**Research tasks:**
- [ ] Document what each competitor is strong at:
  - editorial roundup
  - event listings
  - camp discovery
  - booking
  - age filtering
  - compare
  - freshness
- [ ] Record where they are weak:
  - poor structure
  - stale lists
  - no compare
  - no school-calendar awareness
  - weak trust signals
- [ ] Capture example pages and note the UX contract each one makes

**Output:** Competitor matrix with Hooky differentiation opportunities.

**Blocks:** launch messaging, landing-page strategy, scope discipline.

### 6B. Atlanta-Specific Search Intent Audit

**Research tasks:**
- [ ] Inventory high-intent family search themes in Atlanta:
  - things to do with kids this weekend
  - Atlanta summer camps
  - free kids activities Atlanta
  - spring break camps Atlanta
  - teacher workday camps Atlanta
  - toddler classes Atlanta
- [ ] Group terms by planning moment rather than generic category
- [ ] Identify which search intents Hooky can satisfy with structured inventory instead of article-only content

**Output:** Search-intent map for collection-page priorities.

**Blocks:** SEO collection pages, naming, content sourcing.

---

## Research Track 7: Geography and Coverage Audit

**Goal:** Make sure Hooky is not accidentally overfitting to intown culture-parent inventory while claiming to serve Metro Atlanta families broadly.

### 7A. Geography Balance Check

**Research tasks:**
- [ ] Map current and proposed family inventory across:
  - intown Atlanta
  - Decatur / DeKalb
  - Cobb
  - Gwinnett
  - North Fulton / Sandy Springs / Roswell / Alpharetta
- [ ] Measure which regions are underrepresented in:
  - free events
  - programs
  - camps
  - elementary-age options
  - tween/teen options

**Output:** Metro coverage heatmap with region gaps.

**Blocks:** source prioritization, trust in "Metro Atlanta" positioning.

### 7B. Age-Band Coverage Check

**Research tasks:**
- [ ] Measure how much inventory exists for each age band
- [ ] Identify whether Hooky risks becoming a preschool-storytime product
- [ ] Flag where tween and teen coverage will require different source classes

**Output:** Age-band gap report with source recommendations.

**Blocks:** personalized rails, browse filters, launch gates.

---

## Research Track 8: Parent and Caregiver Reality Check

**Goal:** Keep Hooky grounded in actual adult planning behavior, not internal assumptions.

This track can start lightweight. It does not require a full user-research program to be useful.

### 8A. Lightweight Interview Guide

**Research tasks:**
- [ ] Create a 10-question interview guide for:
  - family coordinators
  - co-parents
  - grandparents/caregivers
- [ ] Focus questions on:
  - how they currently find things
  - what information is always missing
  - when planning feels hardest
  - what makes them trust or distrust a listing
  - how they compare camps/classes today

**Output:** Interview script and note template.

**Blocks:** feed priorities, card contract, compare dimensions.

### 8B. Evidence Synthesis

**Research tasks:**
- [ ] Run 8-12 lightweight interviews
- [ ] Extract recurring pain patterns
- [ ] Map pain patterns back to planning moments and missing metadata

**Output:** Parent pain-point memo with product implications.

**Blocks:** scope discipline, launch messaging, compare emphasis.

---

## Research Track 9: Synthesis and Decision Outputs

**Goal:** Convert research into product decisions, not a folder of interesting notes.

### Required Final Outputs

- [ ] Update `prds/035-hooky-family-portal.md` if major assumptions change
- [ ] Update `prds/hooky-content-architecture.md` with validated field and collection rules
- [ ] Produce a Hooky launch inventory checklist by section:
  - `This Weekend`
  - `Heads Up`
  - `Free This Week`
  - `Programs Starting Soon`
  - `Summer Camps`
- [ ] Produce a provider/prioritized source backlog
- [ ] Produce a "do not build yet" list based on weak evidence

---

## Recommended Research Order

Do the tracks in this order:

1. Planning moments and calendar pressure
2. Weekly-utility source audit
3. Programs/provider supply audit
4. Age-fit and registration-signal validation
5. Competitor gap audit
6. Geography and age-band coverage audit
7. Parent/caregiver interviews
8. Synthesis into source backlog and launch inventory

This order keeps Hooky focused on the real wedge:

- better timing
- better structure
- better comparison
- better trust

Not more content for content's sake.
