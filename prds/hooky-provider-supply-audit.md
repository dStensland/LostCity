# Hooky Provider Supply Audit

**Portal:** `hooky`
**Surface:** `consumer`
**Research Track:** Track 3 from `prds/hooky-content-research-plan.md`
**Status:** First pass
**Last Updated:** 2026-03-10

---

## Executive Takeaways

The `programs` layer is viable, but only if Hooky is selective.

The strongest near-term supply does **not** come from generic family-event sources. It comes from a specific mix:

1. Institution-led camps and classes with public session detail
2. Platform-backed private enrichment providers with visible schedules
3. A small number of private providers where the registration platform is open enough to support recurring or session-based program records

The core strategic conclusion from this first pass:

- Hooky can build a real `programs` moat around camps, arts enrichment, coding, pottery, and swim
- Hooky should not over-index early on youth sports and giant all-in-one program finders unless they expose structured session data
- The best launch path is a curated source pack of high-structure providers, not a broad provider land grab

---

## Method

This first pass used two evidence sources:

1. **Live provider pages** inspected on current official sites
2. **Existing crawler/source analysis** already present in the repo

This is enough to make prioritization decisions, but not enough to declare the provider market fully mapped. Some providers below are fully validated; others are strong next-audit candidates.

---

## What the Market Actually Looks Like

### Strongest segments

- museum and arts camps
- coding camps
- pottery / hands-on studio classes
- swim schools with exposed registration platforms

These segments tend to expose:

- age bands or grade bands
- week-by-week session structure
- date windows
- registration URLs
- schedule detail
- occasional care add-ons
- visible sold-out or waitlist states

That is exactly the metadata Hooky needs for compare and camp-season utility.

### Weakest segments

- giant dynamic activity finders
- youth sports organizations without public schedule/session structure
- providers whose registration lives entirely inside locked or anti-bot platforms
- generic event calendars that say "family-friendly" but not who they are for

These can still matter later, but they should not be mistaken for launch-ready `programs` supply.

---

## Audited Providers

These are the providers or provider types with enough evidence to score now.

| Provider | Segment | Evidence observed | Platform / structure | Hooky value | Feasibility |
|---|---|---|---|---|---|
| High Museum of Art | Arts camps | Official camp page exposes week-by-week camp entries, rising K-8 grouping, Monday-Friday schedule, beforecare/aftercare, and sold out / waitlist states | Custom page + form links; existing repo crawler already handles High event surfaces via Playwright | Very high for camp-season and arts compare | High |
| Center for Puppetry Arts | Arts / theater camps | Official camp page exposes ages 5-17, rising grade bands, Monday-Friday structure, and direct registration prompts; repo crawler notes structured show/program extraction without Playwright for many pages | Public program pages with parseable content | Very high for premium, distinctive family inventory | High |
| Zoo Atlanta | Wildlife / nature camps | Official summer camp page exposes ages 5-14 and age-banded tracks (`Ages 5-7`, `8-11`, `12-14`) plus camp packet detail | Public page structure with strong visible metadata | Very high for flagship family programming | High |
| theCoderSchool Atlanta-area locations | Coding camps / recurring lessons | Live location page exposes a camp table with 55 camps, age filters, Mon-Fri hours, before-care/after-care language, and Pike13 links; repo crawler already documents table parsing | Public HTML table + Pike13 registration | Extremely high; one of the best private-provider fits for Hooky | Very high |
| Goldfish Swim School metro locations | Swim lessons / clinics | Repo crawler documents iClassPro open API for sessions/classes and public portal links are visible on live pages | Open iClassPro endpoints + public portal links | Extremely high for recurring programs plus break-week clinics | Very high |
| Spruill Center for the Arts | Classes / youth arts | Repo crawler documents ActiveNetwork/WebConnect schedule with 600+ class sessions, start dates, meeting times, and instructor fields | Structured registration table | Extremely high volume and structure, though family slice needs filtering | Very high |
| All Fired Up Art | Pottery classes / camps / workshops | Repo crawler documents Shopify BookThatApp API with class products and schedule items carrying local date/time | Public booking API | High-value hands-on enrichment with good structure | Very high |
| Atlanta Workshop Players | Theater camps / shows | Repo crawler documents server-rendered camp page with explicit date ranges and prices plus JS-heavy show/event pages | Static camp page + Wix-rendered ancillary pages | High-value family arts inventory with camp-season utility | High |
| Children's Museum of Atlanta | Special programs / museum programming | Repo crawler documents embedded homepage JSON with `special_programs`, dates, content, and age extraction patterns | Embedded JSON on homepage | High for events and special programs; medium for true compareable camp inventory | High |
| MJCCA Camps | Large camp operator | Official camps page shows day camps for rising Pre-K through 9th grade, overnight camp for rising 1st-11th, and preschool camps; deep program detail still needs audit | Multi-program public pages likely with richer downstream detail | Very high potential due to breadth and camp volume | Medium-high |
| YMCA of Metro Atlanta | Camps / sports / afterschool | Repo crawler documents that community events are crawlable, but program discovery lives in a Salesforce Experience Cloud app with no public API and JS-heavy rendering | Salesforce LWC activity finder | Large market presence, but weak near-term extraction economics | Low-medium |
| SwimAtlanta | Swim lessons / meets | Repo crawler documents descriptive recurring lesson records and Jackrabbit / TeamUnify dependence, with no open API and Cloudflare constraints | Jackrabbit + TeamUnify; no open session API | Useful later, but not a strong early compare source | Low-medium |

---

## Immediate Strategic Read

### 1. Museum and arts providers are the best launch wedge

This first pass strongly supports leading Hooky's structured `programs` layer with:

- High Museum
- Center for Puppetry Arts
- Zoo Atlanta
- Spruill
- Atlanta Workshop Players
- Children's Museum
- MJCCA

These providers create a premium, family-distinctive launch story and already expose better metadata than most generic parent-calendar competitors.

### 2. Private enrichment is viable where the platform is exposed

The best private-provider examples in this pass are:

- theCoderSchool via visible camp tables and Pike13
- Goldfish via iClassPro open endpoints
- All Fired Up Art via BookThatApp

This is important. It means Hooky does not need to wait for a bespoke provider ecosystem to get real private-program inventory. It can start with providers whose public registration stack is already machine-readable.

### 3. Youth sports is strategically important but not a smart first source pack

Youth sports still matters to the Hooky thesis, but this pass suggests it is a weak first move for `programs`:

- registration often lives in Jackrabbit or custom forms
- session detail is inconsistent
- public pages frequently market programs without exposing compareable metadata
- schedule and age information may exist, but not in a crawl-friendly way

Recommendation: treat youth sports as a second-wave source class unless a specific provider exposes unusually strong structure.

### 4. Giant activity finders are not a moat

The YMCA result is the warning sign. A large operator may look strategically important, but if discovery is trapped in a JS-heavy or authenticated finder, the extraction economics are bad.

For launch, Hooky should prefer:

- smaller number of high-structure providers

over:

- broad but fragile coverage from giant, dynamic program directories

---

## First Source Pack Recommendation

If Hooky starts building `programs` now, the first source pack should be:

### Tier A: Build first

- High Museum of Art
- Center for Puppetry Arts
- Zoo Atlanta
- theCoderSchool metro locations
- Goldfish Swim School metro locations
- Spruill Center for the Arts
- All Fired Up Art
- Atlanta Workshop Players

**Why:** These sources combine strong family relevance, visible age/schedule metadata, and realistic extraction paths.

### Tier B: Build after Tier A stabilizes

- Children's Museum of Atlanta
- MJCCA camps
- Fernbank family camps / programs
- Alliance Theatre youth classes if classes pages prove structured enough

**Why:** These are high-value, but either more event-like than program-like or still need deeper validation on session structure.

### Tier C: Do not lead with these

- YMCA Activity Finder
- SwimAtlanta structured lessons
- generic youth sports league websites
- directory-style camp roundups

**Why:** They may matter later, but they are not the cleanest way to prove the `programs` layer.

---

## Next 13 Providers to Audit

This is the next-pass candidate list to take the audited sample toward a 25-provider market map.

### Arts / culture / premium family programming

- Fernbank Museum of Natural History
- Atlanta Ballet Centre for Dance Education
- Atlanta History Center camps and youth programs
- Atlanta Botanical Garden family and youth programs
- Alliance Theatre youth classes

### STEM / coding / hands-on enrichment

- Code Ninjas metro Atlanta locations
- Play-Well TEKnologies Atlanta programs
- Challenge Island North Metro Atlanta
- Atlanta Tech Park youth tech camps

### Outdoor / nature / civic-style family enrichment

- Dunwoody Nature Center camps
- Autrey Mill Nature Preserve programs

### Sports / movement / broad family demand

- Soccer Shots Atlanta
- i9 Sports metro Atlanta

These are next-pass candidates, not yet validated launch recommendations.

---

## Platform Pattern Summary

This first pass also clarifies the platform landscape:

| Pattern | Examples | Hooky implication |
|---|---|---|
| Public structured HTML tables | theCoderSchool, Spruill | Best case for session-level program crawling |
| Open public scheduling API | Goldfish / iClassPro | Best case for ongoing and break-week programs |
| Public booking API embedded in commerce stack | All Fired Up Art / BookThatApp | Excellent if filtered carefully |
| Static or semi-static camp landing pages | High Museum, Zoo Atlanta, Puppetry Arts, MJCCA | Strong camp-season supply; may need custom parsers |
| JS-heavy program finder | YMCA Activity Finder | Poor first-wave investment |
| Locked or anti-bot registration systems | SwimAtlanta / Jackrabbit, some sports orgs | Only worth it if page-level metadata is strong enough without direct platform extraction |

---

## What This Means for Hooky Content

The strongest Hooky launch content is not "family activities in Atlanta."

It is:

- age-banded summer camps
- structured arts and museum programs
- coding and maker enrichment
- swim clinics and recurring lessons where status and session structure are visible

That content is peerless because it is:

- compareable
- current
- age-specific
- status-aware
- spread across institutions and private providers in one surface

That is a more defensible product than another family roundup feed.

---

## Recommendations

1. Build the first `programs` source pack from Tier A only.
2. Delay broad youth-sports investment until a few specific providers prove unusually structured.
3. Treat camp-season as the primary proving ground for Hooky's content moat.
4. Use museum + arts + coding + swim as the first cross-segment mix.
5. Make provider/platform structure a hard gating criterion for source priority.

---

## Follow-Up Research Tasks

- Deep-audit MJCCA subpages to confirm session-level detail and registration structure
- Validate Fernbank camp/program surfaces separately from the museum events calendar
- Audit Atlanta Ballet summer programs as a likely high-value arts provider
- Audit Code Ninjas and Challenge Island to compare against theCoderSchool
- Identify 3 youth sports providers with better-than-average public structure before expanding that segment
