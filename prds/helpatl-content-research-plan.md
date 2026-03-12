# HelpATL Content Research Plan

**Purpose:** Validate and flesh out every section of `helpatl-content-strategy.md` with real-world data before building crawlers or shipping UX.

**Status:** Draft — 2026-03-08

---

## Research Philosophy

The content strategy is currently a hypothesis. Every section contains assumptions about source data, event volumes, cause coverage, and tag inferrability that haven't been tested against reality. This plan turns assumptions into evidence.

**Ground rules:**
- Every research task produces a concrete artifact (data sample, field inventory, volume count, or decision recommendation)
- Research that changes a strategy assumption updates the strategy doc directly
- Don't build crawlers until the source audit confirms what data is actually available
- Research tasks are parallelizable — run them concurrently where possible

---

## Research Track 1: Source Data Audits

**Goal:** For each priority source, answer: What data do they actually serve? What fields? What volume? What's the content mix? Can we reliably tag it?

This is the foundation — everything else (tags, channels, feed sections) depends on knowing what data we're actually working with.

### 1A. Mobilize.us API Audit

**Strategy section:** §2 (Organize mode), §4 (tag inference), §5 (source mapping)

**Research tasks:**
- [ ] Hit the public API (`GET https://api.mobilize.us/v1/events`) with Atlanta geo filter
- [ ] Document the full field inventory (what does each event object contain?)
- [ ] Count Atlanta-area events currently listed (total + by event_type)
- [ ] Categorize event types returned: what % are rallies vs. canvassing vs. organizing meetings vs. volunteer shifts?
- [ ] Identify whether Mobilize's `event_type` field maps cleanly to our engagement tags (rally, canvass, organize)
- [ ] Check for cause/issue tags in the API response — does Mobilize categorize by cause?
- [ ] Test geo filtering accuracy — do results include events outside Atlanta metro?
- [ ] Identify the organization field structure — can we attribute events to organizing groups?
- [ ] Sample 20 event descriptions — can we reliably infer cause tags (housing, transit, environment) from text?
- [ ] Check for virtual/hybrid events — how common, and do they have location data?

**Output:** Source data profile document with field map, volume estimate, sample events, and tag inference feasibility assessment.

**Blocks:** §4 tag vocabulary validation, §5 source-to-taxonomy mapping, §10 crawler design

### 1B. Hands On Atlanta (Golden Volunteer) Audit

**Strategy section:** §2 (Serve mode), §4 (tag inference), §5 (source mapping)

**Research tasks:**
- [ ] Navigate `volunteer.handsonatlanta.org` and document the page structure (SSR vs SPA, auth requirements)
- [ ] Identify how opportunities are listed — calendar view, list view, search results?
- [ ] Document fields visible per opportunity (title, org, date, time, location, cause, capacity, description)
- [ ] Count currently listed opportunities (total + with specific dates vs. ongoing)
- [ ] Categorize by cause: what % are food-related vs. environment vs. education vs. youth vs. animals?
- [ ] Identify the "partner org" field — does HOA attribute events to downstream nonprofits?
- [ ] Check for tags/filters HOA already provides (cause area, skill level, group friendly, etc.)
- [ ] Assess drop-in vs. commitment split: what % have a specific date+time vs. "ongoing" or "flexible"?
- [ ] Test whether individual opportunity pages (e.g., `/timeslots/[id]`) are publicly accessible without login
- [ ] Check if HOA uses a JSON/API payload embedded in SSR (look for `__NEXT_DATA__` or similar)
- [ ] Document bot protection mechanisms (Cloudflare, captcha, rate limiting)

**Output:** Source data profile with crawlability assessment, field map, volume by category, drop-in vs. commitment ratio.

**Blocks:** §2 content type volumes, §4 cause tag coverage, §10 crawler feasibility

### 1C. Eventbrite Charity & Causes Audit

**Strategy section:** §2 (Serve + Organize), §5 (source mapping)

**Research tasks:**
- [ ] Query Eventbrite API for Atlanta events in category 111 (Charity & Causes)
- [ ] Count current volume and document field inventory
- [ ] Categorize the content mix: what % are fundraiser galas vs. service events vs. advocacy events vs. awareness walks?
- [ ] Assess how many are actually volunteer opportunities vs. ticketed charity events
- [ ] Check for subcategory or tag fields that could help separate Serve from Organize content
- [ ] Identify overlap with other sources (are HOA or Mobilize events also listed on Eventbrite?)
- [ ] Document price distribution — what % are free vs. paid?
- [ ] Review our existing Eventbrite crawler to understand what modifications are needed

**Output:** Content mix analysis, overlap assessment, recommended filter criteria for HelpATL-relevant events.

**Blocks:** §5 gap analysis, §10 crawler modification scope

### 1D. Legistar Government Meetings Audit

**Strategy section:** §2 (Participate mode), §3 (jurisdiction channels), §8 (action fields)

**Research tasks:**
- [ ] Hit Atlanta Legistar (`atlanta.legistar.com`) — document the calendar/events API
- [ ] Check DeKalb Legistar (`dekalbcountyga.legistar.com`) — same API structure?
- [ ] Check Fulton County — do they use Legistar or a different platform?
- [ ] Document fields per meeting: title, body/committee, date, time, location, agenda URL, minutes URL
- [ ] Count meetings per month by body type (council, committee, commission, board)
- [ ] Identify which meetings have public comment periods — is this a field or inferred from meeting type?
- [ ] Check agenda PDF availability — are agendas posted before meetings? How far in advance?
- [ ] Assess whether Legistar provides structured agenda items (individual motions/topics) or just the PDF
- [ ] Document the NPU meeting structure — are NPU meetings in Legistar or published elsewhere?
- [ ] Check for API access vs. scraping needs (Legistar has an API: `webapi.legistar.com`)

**Output:** Government source profile per jurisdiction, API field map, meeting volume, agenda/public-comment availability assessment.

**Blocks:** §3 jurisdiction channels, §7 Public Meetings feed section, §8 action_deadline_at feasibility

### 1E. School Board Profile Validation

**Strategy section:** §2 (Participate), §5 (source mapping)

**Research tasks:**
- [ ] Read existing YAML profiles at `crawlers/sources/profiles/atlanta-public-schools-board.yaml`, `fulton-county-schools-board.yaml`, `dekalb-county-schools-board.yaml`
- [ ] Visit each school board's website — confirm the calendar URLs in the profiles are still valid
- [ ] Document meeting frequency (monthly? twice monthly?) and typical schedule
- [ ] Check for agenda publication — when are agendas posted relative to meetings?
- [ ] Identify whether public comment is a standing agenda item or case-by-case
- [ ] Confirm the profiles have enough info to build crawlers (selectors, URL patterns, data format)

**Output:** Profile validation report — ready to activate vs. needs updating.

**Blocks:** §10 Phase 1 activation

### 1F. VolunteerMatch / United Way / Idealist Quick Assessment

**Strategy section:** §2 (Serve mode commitment roles), §5 (P2-P3 sources)

**Research tasks:**
- [ ] VolunteerMatch: Check current developer portal, understand application process and timeline
- [ ] VolunteerMatch: Browse Atlanta listings on the public site — count total, sample 20 for field quality
- [ ] United Way (Galaxy Digital): Navigate `volunteer.unitedwayatlanta.org` — document listing structure and auth requirements
- [ ] United Way: Count active opportunities, categorize by type (drop-in vs. ongoing)
- [ ] Idealist: Browse `idealist.org/en/volunteer-in-atlanta-ga` — count listings, sample for date-specificity
- [ ] Idealist: What % of listings have specific dates vs. "ongoing"? This determines signal-to-noise.
- [ ] For all three: Document the application/API access process and estimated timeline

**Output:** P2/P3 source viability assessment with recommendation on which to pursue first.

**Blocks:** §5 gap analysis, §10 Phase 3 planning

---

## Research Track 2: Interest Channel Validation

**Goal:** Confirm which cause-based channels will actually have content, and which are empty promises.

**Strategy section:** §3 (Interest Group Architecture)

### 2A. Cause Coverage Reality Check

**Research tasks:**
- [ ] Using source audit data from Track 1, map real events to each proposed cause channel
- [ ] For each of the 9 proposed cause channels, estimate upcoming event count:
  - Food Security: how many food-related events from HOA + Eventbrite?
  - Housing: how many housing events from Mobilize + Legistar zoning?
  - Environment: how many cleanup/conservation events from HOA + Mobilize?
  - Education: how many tutoring events from HOA + school board meetings?
  - Transit: how many transit events from Mobilize + MARTA board?
  - Public Safety: how many from Mobilize + oversight boards?
  - Health: how many health-related events from HOA + Eventbrite?
  - Animals: how many shelter events from HOA + Eventbrite?
  - Arts & Culture: how many from any source?
- [ ] Identify which channels meet the minimum threshold (5+ upcoming events)
- [ ] Identify which channels would be perpetually empty and should be deferred

**Depends on:** Track 1 source audits (all of them)

**Output:** Channel viability matrix — which 5-6 channels to seed in v1 vs. defer.

**Blocks:** §3 v1 seed decision, §7 feed section population, §11 channel coverage targets

### 2B. Jurisdiction Channel Mapping

**Research tasks:**
- [ ] Confirm which government bodies publish calendars we can crawl (from 1D)
- [ ] Map Atlanta NPU structure — how many NPUs, which have active websites/calendars?
- [ ] Check if existing neighborhood civic association crawlers produce content that maps to jurisdiction channels
- [ ] Determine whether NPU channels are viable (25 NPUs = 25 channels, most with 1 meeting/month — too thin?)
- [ ] Recommendation: should NPU channels be individual or grouped by area?

**Depends on:** Track 1D (Legistar audit)

**Output:** Jurisdiction channel inventory with recommended granularity.

### 2C. Cross-Mode Channel Test

The killer feature claim is that cause channels cross-cut all three modes. Validate this.

**Research tasks:**
- [ ] Pick 3 causes (e.g., Environment, Housing, Education)
- [ ] For each, find real examples across all three modes:
  - Serve: volunteer events related to this cause
  - Participate: government meetings related to this cause
  - Organize: advocacy events related to this cause
- [ ] Assess: can tag inference reliably connect events to the right cause? Or do events from different sources use different vocabulary for the same cause?
- [ ] Identify vocabulary mapping needs (e.g., HOA says "hunger relief", Mobilize says "food justice", Legistar says "nutrition assistance" — all map to `food-security`)

**Depends on:** Track 1 source audits (1A, 1B, 1D at minimum)

**Output:** Cross-mode channel feasibility report with tag vocabulary mapping table.

**Blocks:** §4 tag inference rules, §3 cross-mode channel design

---

## Research Track 3: Tag Inference Feasibility

**Goal:** Can we actually assign cause tags, engagement tags, and commitment tags reliably at crawl time?

**Strategy section:** §4 (Tag Vocabulary)

### 3A. Cause Tag Inference from Event Descriptions

**Research tasks:**
- [ ] Collect 50 sample event titles + descriptions from each priority source (HOA, Mobilize, Eventbrite Charity)
- [ ] For each sample, manually assign cause tags — how ambiguous is the mapping?
- [ ] Identify keyword patterns per cause:
  - `food-security`: food bank, food sort, meal, hunger, pantry, food drive
  - `environment`: cleanup, tree, park, river, trail, conservation, climate, sustainability
  - `education`: tutor, mentor, school, literacy, STEM, reading, youth education
  - `housing`: habitat, build, housing, shelter, homeless, zoning, tenant
  - `animals`: shelter, foster, adoption, animal, pet, rescue, spay/neuter
  - `health`: health fair, blood drive, clinic, wellness, mental health
  - `transit`: MARTA, transit, bike, pedestrian, bus, transportation
  - `public-safety`: police, court, safety, justice, oversight, community watch
  - `arts-culture`: art, music, mural, cultural, heritage, gallery
- [ ] Estimate accuracy: what % of events would be correctly tagged by keyword matching alone?
- [ ] Identify ambiguous cases that keyword matching would get wrong
- [ ] Check whether source-level attribution (all HOA food bank events = food-security) is more reliable than text parsing

**Output:** Tag inference rule set with estimated accuracy per cause, recommendation on source-based vs. text-based tagging.

**Blocks:** §4 finalization, crawler tag assignment logic

### 3B. Engagement Tag Inference

**Research tasks:**
- [ ] Does Mobilize.us provide an `event_type` field that maps to our engagement tags (rally, canvass, organize)?
- [ ] Does HOA/Golden provide a field distinguishing volunteer events from info sessions?
- [ ] Does Eventbrite provide any signal for engagement type beyond the charity category?
- [ ] For events without a structured engagement type field, can we infer from title keywords?
  - "rally", "march", "demonstration" → `rally`
  - "canvass", "door-to-door", "phone bank" → `canvass`
  - "meeting", "planning session", "coalition" → `organize`
  - "sort", "build", "clean", "serve", "prep" → `volunteer`
  - "drive", "collection", "fundraiser" → `donate`

**Depends on:** Track 1 field inventories

**Output:** Engagement tag mapping table per source.

### 3C. Commitment Level Inference

**Research tasks:**
- [ ] From HOA sample data, can we distinguish drop-in from commitment-required?
  - Does HOA use tags like "orientation required" or "training needed"?
  - Does the description mention background checks, training, or prerequisites?
- [ ] From VolunteerMatch/United Way samples, are commitment requirements structured fields or free text?
- [ ] What % of volunteer listings lack clear commitment signals? (These default to untagged, not drop-in)

**Depends on:** Track 1B (HOA audit), Track 1F (VM/UW assessment)

**Output:** Commitment tag feasibility assessment — reliable enough for v1 filter, or defer?

---

## Research Track 4: Competitive & Comparative Analysis

**Goal:** Understand how existing civic/volunteer platforms present content, what works, and where HelpATL is uniquely positioned.

**Strategy section:** §1 (taxonomy validation), §6 (voice & tone), §9 (exclusions)

### 4A. Competitor Content Audit

**Research tasks:**
- [ ] **Hands On Atlanta (consumer site)**: How do they organize volunteer discovery? Categories, filters, content hierarchy? What's their voice/tone? What do they do well vs. poorly?
- [ ] **VolunteerMatch**: How do they present search results? What filters exist? How do they handle ongoing vs. one-time? What's the UX for commitment level?
- [ ] **Mobilize.us (consumer browse)**: How do they present events in a city? Filtering, cause categories, event types? Voice/tone of event descriptions?
- [ ] **Idealist**: How do they differentiate volunteer roles from jobs? What filters work? What's the content density problem?
- [ ] **City of Atlanta website**: How does the city present civic participation opportunities? How usable is their NPU/meeting calendar? Where does it fall short?

**Output:** Competitive feature matrix — what each platform does well, where the gaps are, what HelpATL can uniquely offer.

### 4B. Voice & Tone Benchmarking

**Research tasks:**
- [ ] Collect 10 sample content pieces from each competitor: event descriptions, section headers, CTAs, empty states
- [ ] Rate each on: clarity, warmth, specificity, actionability
- [ ] Identify voice anti-patterns we want to avoid (government-speak, corporate CSR, activist urgency)
- [ ] Identify voice patterns we want to adopt (if any)
- [ ] Validate our voice principles against real-world civic content — do our "good" examples actually read better than competitor equivalents?

**Output:** Voice comparison table, refined examples for §6.

### 4C. Civic Tech Landscape Scan

**Research tasks:**
- [ ] What other civic engagement platforms exist nationally? (Brigade by Code for America, Resistbot, 5Calls, Democracy.io, Countable, etc.)
- [ ] Which have Atlanta-specific presence?
- [ ] What content model do they use? Events-only, actions-only, mixed?
- [ ] What's died or failed? (Neighborland, NextDoor civic, Brigade deprecation) — what can we learn from failures?
- [ ] Is there a "civic infrastructure API" opportunity we're missing? (e.g., OpenStates for state legislature data, Cicero for districts)

**Output:** Landscape map with positioning implications. May update §9 exclusions or §3 channel design.

---

## Research Track 5: Atlanta Civic Ecosystem Mapping

**Goal:** Map the real organizational ecosystem HelpATL is serving, not just data sources.

**Strategy section:** §2 (content types), §3 (channels), §5 (sources)

### 5A. Volunteer Organization Ecosystem

**Research tasks:**
- [ ] Identify the top 20 volunteer-placing organizations in Atlanta by volume
- [ ] For each: what platform do they use to post opportunities? (HOA/Golden, VolunteerHub, Eventbrite, own website, social media only)
- [ ] Which are HOA partner orgs and would be covered by a single HOA crawler?
- [ ] Which are independent and need dedicated crawlers or manual coverage?
- [ ] What causes do they cover? (Map to our cause tags)
- [ ] Identify seasonal patterns: what spikes when? (MLK Day service, Earth Day, Thanksgiving food, holiday giving)

**Output:** Organization-to-source mapping, seasonal content calendar, independent org gap list.

### 5B. Government Body Inventory

**Research tasks:**
- [ ] Complete list of government bodies with public meetings in the Atlanta metro:
  - City of Atlanta: council, committees, boards, commissions, authorities
  - Fulton County: commission, boards, authorities
  - DeKalb County: commission, boards, authorities
  - Cobb County: relevant? (OTP but part of metro)
  - School boards: APS, Fulton, DeKalb — any others in scope?
- [ ] For each body: meeting frequency, calendar platform, public accessibility
- [ ] Total monthly meeting count across all jurisdictions — validates §7 feed section viability
- [ ] Which bodies have the most public interest? (Zoning? School board? Transit authority?)

**Output:** Government body inventory with meeting volume estimates.

### 5C. Activism Organization Mapping

**Research tasks:**
- [ ] Identify the top 20 advocacy/activism organizations active in Atlanta
- [ ] For each: primary causes, event frequency, where they post events (Mobilize, Eventbrite, own site, social only)
- [ ] Which are on Mobilize.us? (This determines how much the Mobilize crawler covers)
- [ ] Which are exclusively on social media? (These are out of scope for crawling)
- [ ] What's the political/ideological distribution? (HelpATL is non-partisan — are we inadvertently covering one side more?)
- [ ] Identify cause coverage gaps: are any of our 9 cause channels not represented by any active Atlanta org?

**Output:** Activism org map, Mobilize coverage assessment, political balance check.

---

## Research Track 6: Data Model Validation

**Goal:** Confirm that the data model changes proposed in the strategy actually work with real source data.

**Strategy section:** §8 (Data Model Requirements)

### 6A. Action Fields Feasibility

**Research tasks:**
- [ ] From Legistar audit (1D): Can we extract `action_deadline_at` from meeting data? Where does the deadline live?
- [ ] From Legistar audit (1D): Can we extract `agenda_url`? Is it a direct field or requires URL construction?
- [ ] From Mobilize audit (1A): Does Mobilize provide an equivalent of `action_type`?
- [ ] From HOA audit (1B): Does HOA provide an `action_url` (registration/signup link)?
- [ ] For each field: is it available in structured data from the source, or would it require description parsing?

**Depends on:** Track 1 source audits

**Output:** Field availability matrix per source. Determines which PRD 029 fields are buildable vs. aspirational.

### 6B. Geo Rule Implementation Scoping

**Research tasks:**
- [ ] Read `web/lib/interest-channel-matches.ts` — understand the current matching engine
- [ ] Document what `MatchableEvent` currently includes (fields available for matching)
- [ ] Check: do events in the DB consistently have venue city/state populated?
- [ ] Check: do events have coordinates (lat/lng) for radius-based matching?
- [ ] Design the geo rule implementation: exact city match, radius from coordinates, or both?
- [ ] Estimate effort: how many files change, how complex is the matching logic?

**Output:** Geo rule implementation spec with effort estimate.

**Blocks:** Mobilize.us crawler activation (can't use without geo filtering)

---

## Research Track 7: Feed Volume Modeling

**Goal:** Validate that the feed composition in §7 can actually be populated.

**Strategy section:** §7 (Feed Composition), §10 (Launch Thresholds)

### 7A. Weekly Volume Projections

**Research tasks:**
- [ ] Using volume data from Track 1 audits, project weekly event counts per feed section:
  - This Week: Volunteer — how many drop-in events per week from HOA + Eventbrite?
  - Public Meetings — how many meetings per week from Legistar + school boards?
  - Taking Action — how many advocacy events per week from Mobilize?
  - Your Neighborhood — can we populate this with geo-filtered content?
- [ ] Identify seasonal variation — are there dead weeks/months?
- [ ] Check: do launch thresholds (§10) align with actual projected volumes?
- [ ] Adjust launch thresholds if projected volumes are significantly different from assumptions

**Depends on:** Track 1 source audits (all)

**Output:** Weekly volume projection table per feed section, updated launch thresholds.

### 7B. Section Viability Assessment

**Research tasks:**
- [ ] For each proposed feed section, answer: will this section have content 90%+ of weeks?
- [ ] Identify sections that may need to be conditional (only shown in certain seasons or when content exists)
- [ ] Check: does the "Your Neighborhood" section work with current venue geo data quality?
- [ ] Assess: should the three mode sections (Volunteer, Public Meetings, Taking Action) be separate sections or tabs within one section?

**Depends on:** 7A volume projections

**Output:** Feed section go/no-go per section, with design recommendations.

---

## Execution Plan

### Parallel tracks (can run simultaneously)

| Track | Dependencies | Estimated Effort | Agent Type |
|---|---|---|---|
| 1A: Mobilize API audit | None | 2-3 hours | crawler-dev + data |
| 1B: HOA audit | None | 3-4 hours | crawler-dev + data |
| 1C: Eventbrite audit | None | 1-2 hours | data |
| 1D: Legistar audit | None | 2-3 hours | crawler-dev + data |
| 1E: School board validation | None | 1 hour | data |
| 1F: VM/UW/Idealist assessment | None | 2 hours | business-strategist |
| 4A: Competitor content audit | None | 3-4 hours | business-strategist |
| 4B: Voice benchmarking | None | 2 hours | business-strategist |
| 4C: Civic tech landscape | None | 2 hours | business-strategist |
| 5A: Volunteer org ecosystem | None | 3 hours | data + business-strategist |
| 5B: Government body inventory | None | 2 hours | data |
| 5C: Activism org mapping | None | 2 hours | business-strategist |
| 6B: Geo rule scoping | None | 1 hour | full-stack-dev |

### Sequential tracks (depend on Track 1 results)

| Track | Dependencies | Estimated Effort | Agent Type |
|---|---|---|---|
| 2A: Cause coverage reality check | 1A, 1B, 1C, 1D | 2 hours | data |
| 2B: Jurisdiction channel mapping | 1D | 1 hour | data |
| 2C: Cross-mode channel test | 1A, 1B, 1D | 2 hours | data + business-strategist |
| 3A: Cause tag inference | 1A, 1B, 1C | 3 hours | data + crawler-dev |
| 3B: Engagement tag inference | 1A, 1B | 1 hour | data |
| 3C: Commitment level inference | 1B, 1F | 1 hour | data |
| 6A: Action fields feasibility | 1A, 1B, 1D | 1 hour | data |
| 7A: Weekly volume projections | All Track 1 | 2 hours | data |
| 7B: Section viability | 7A | 1 hour | data + business-strategist |

### Suggested execution order

**Wave 1 (parallel — run all at once):**
All Track 1 source audits (1A-1F) + Track 4 competitive analysis + Track 5 ecosystem mapping + Track 6B geo scoping

**Wave 2 (after Wave 1 completes):**
Track 2 channel validation + Track 3 tag inference + Track 6A action fields

**Wave 3 (after Wave 2 completes):**
Track 7 feed volume modeling → final strategy doc updates

---

## Deliverables

After all research tracks complete, update `helpatl-content-strategy.md` with:

1. **Validated cause channels** — replace the 9-channel hypothesis with the evidence-based v1 seed set
2. **Real volume numbers** — replace "estimated" volumes with actual counts per source
3. **Tag inference rules** — append keyword patterns and source-based rules to §4
4. **Source field maps** — append per-source data profiles to §5
5. **Adjusted launch thresholds** — update §10 based on real projections
6. **Competitive positioning** — sharpen §1 executive summary with differentiation evidence
7. **Voice examples** — replace hypothetical examples in §6 with real source-derived content
8. **Implementation readiness** — each source gets a go/no-go with specific crawl approach

The strategy doc should go from "here's what we think" to "here's what we know and here's exactly what to build."
