# Hooky Content Architecture

**Portal:** `hooky`
**Surface:** `consumer`
**Version:** 1.0
**Last Updated:** 2026-03-10
**Source of truth:** `prds/035-hooky-family-portal.md`

---

## Executive Summary

Hooky is not a family editorial site. It is a planning and coordination layer for families in Metro Atlanta.

That means the content architecture must optimize for four jobs:

1. Find good options for this weekend.
2. See upcoming school-break and teacher-workday pressure before it becomes a scramble.
3. Compare camps, classes, and programs without opening 20 tabs.
4. Trust that what is shown is current, age-appropriate, and actionable.

The content system should therefore prioritize structured, decision-ready records over lifestyle copy. The primary content assets are not articles. They are:

- Event records
- Program records
- School calendar alerts
- Comparison-ready metadata
- Time-bound landing pages built from those records

Editorial copy exists only to frame decisions, explain context, and improve scanability. It should not carry the product.

---

## 1. Content Principles

### 1.1 Planning Utility Beats Inspiration

Every section should help a parent decide, not just browse. If a content unit does not improve planning, comparison, or timing awareness, it is secondary.

### 1.2 Structured Data Beats Prose

The default Hooky asset is a structured card or record. Rich copy supports the record, but the record is the product.

### 1.3 Time Matters More Than Taxonomy

Users arrive with a time question first:

- this weekend
- next teacher workday
- spring break
- summer camp season
- after-school soon

Content should be organized first by planning moment, then by category.

### 1.4 Trust Must Be Visible

Freshness, status, source, and age fit are part of the content contract, not just backend metadata.

### 1.5 Family Context Without Child Exposure

Hooky can personalize around age bands, interests, and school system selection. It cannot require personal child identity or drift into child-facing content patterns.

### 1.6 No Fake Completeness

If age, registration status, or cost is unknown, Hooky should say so clearly or omit the affordance. It should never imply confidence it does not have.

---

## 2. Canonical Content Objects

Hooky should treat the following as the core content model.

### 2.1 Events

One-off or recurring happenings with a date and place.

Examples:
- library storytime
- museum family day
- park activity
- festival kid zone
- drop-in workshop

**Required for feed eligibility:**
- title
- start date/time
- venue or clear location text
- portal-safe age signal
- canonical destination URL

**Strongly preferred:**
- price or free flag
- image
- source attribution
- freshness timestamp

**Not enough on their own:**
- vague "family-friendly" label without age signal
- stale event with no recrawl confidence

### 2.2 Programs

Structured commitments with enrollment, schedules, or sessions. This is Hooky's most important differentiated content type.

Examples:
- summer camps
- enrichment classes
- leagues
- clubs
- recurring rec programs

**Required for program detail and compare eligibility:**
- program name
- provider
- age range
- session dates or season
- registration URL
- registration status

**Strongly preferred:**
- cost
- schedule days/times
- before/after care
- lunch included
- venue/location

Programs with missing age range or missing registration URL should not be treated as flagship compare content.

### 2.3 Calendar Alerts

Time-sensitive planning triggers derived from school calendars or deadlines.

Examples:
- no-school day next Friday
- spring break starts in 10 days
- camp registration opens Monday
- registration closes in 3 days

These are not editorial stories. They are utility modules that point into events or programs.

### 2.4 Personalized Recommendation Rails

Sections shaped by crew profile context.

Examples:
- For Bug
- For Tweens
- Good for preschoolers this weekend

These rails must only use safe inputs:
- age band
- stated interests
- household-level constraints where legally allowed

### 2.5 Collection Pages

SEO and browse pages assembled from structured records.

Examples:
- This Weekend
- Free This Week
- Summer Camps
- Teacher Workdays
- Spring Break

These pages should be generated from live inventory, not manually maintained article lists.

---

## 3. Feed Architecture

The feed is Hooky's primary content surface. It should feel like a weekly planning dashboard, not an infinite scroll of mixed listings.

### 3.1 Conditions Banner

**Purpose:** Set context for the weekend and frame the right kind of choices.

**Inputs:**
- weather
- season
- school-calendar context
- major family planning moments

**Content output:**
- short contextual sentence
- optional CTA into outdoor, indoor, free, or camp content

**Rules:**
- never over-write utility with cute copy
- do not mention a content type unless there is inventory behind it

### 3.2 Heads Up

**Purpose:** Surface upcoming moments that create planning pressure.

**Eligible inputs:**
- no-school days
- half-days
- school breaks
- registration opens
- registration closes

**Priority order:**
1. school-calendar disruptions
2. camp/program deadlines
3. high-confidence seasonal needs

**Output types:**
- alert card with deadline/date
- CTA to relevant event or program collection

This is the highest-leverage Hooky section after This Weekend because it creates return behavior and panic prevention.

### 3.3 This Weekend

**Purpose:** Answer the Thursday-through-Sunday planning question fast.

**Inclusion rules:**
- 5 to 8 high-confidence events or activities
- age-appropriate to crew or broadly family-safe if no crew profile exists
- strong freshness confidence
- distributed across free/paid and indoor/outdoor when inventory allows

**Card contract:**
- title
- day/time
- venue/neighborhood
- age fit
- price/free indicator when known
- status/freshness signal

This section cannot feel repetitive. It needs real rotation and de-duplication across sources.

### 3.4 Free This Week

**Purpose:** Guarantee budget utility and broaden reach.

**Inclusion rules:**
- explicitly free or zero-cost
- date-bounded and still live
- family-appropriate age signal

This section should always be populated, but not with low-signal filler. If free inventory is weak, widen geography before lowering trust.

### 3.5 Programs Starting Soon

**Purpose:** Bridge browsing into commitment planning.

**Inclusion rules:**
- open or waitlist registration
- upcoming start date or relevant seasonal window
- complete enough for decision-making

**Card contract:**
- program name
- provider
- age range
- start date
- cost when known
- registration status pill

### 3.6 For [Nickname]

**Purpose:** Make personalization useful, not decorative.

**Inclusion rules:**
- only appears after crew setup
- must clearly match kid age band
- should reflect one or more stated interests

**Quality bar:**
- if personalization confidence is weak, do not render the rail
- better no rail than generic filler labeled as personalized

### 3.7 Camp Season

**Purpose:** Own January through March for camp planning.

This becomes a first-class feed section during the seasonal window and should drive to a dedicated collection and compare flow.

**Inventory requirements:**
- structured programs with week/date coverage
- cost fields on a meaningful share of records
- before/after care and lunch where available
- deadline visibility

If program inventory is not deep enough, Hooky should not over-promise with heavy "camp engine" copy.

---

## 4. Browse and Landing Page Architecture

Hooky needs a small set of high-intent collection pages. These should be driven by structured inventory and refreshed automatically.

### 4.1 Core Persistent Collections

#### This Weekend

Primary planning page for the next 3-5 days.

**Sort order:**
1. crew age fit
2. freshness
3. distance relevance
4. source quality

#### Free This Week

Budget-first collection with strong utility and wide appeal.

#### Programs

Evergreen browse surface for structured commitments.

Primary filters:
- type
- age
- season
- cost
- registration status

### 4.2 Seasonal Collections

#### Summer Camps

Hooky's biggest seasonal collection.

Required facets:
- age band
- camp type
- week coverage
- cost band
- before/after care

#### Spring Break

A hybrid page mixing events and programs that solve the same planning problem.

#### Teacher Workdays / No-School Days

Dynamic collection built from school calendar triggers plus age-matched events and programs.

#### Fall Break / Winter Break

Lower-volume but still useful planning collections once school calendar data is live.

### 4.3 Collections Hooky Should Not Lead With

These may exist later, but they are not core launch architecture:

- generic parenting advice pages
- open-ended neighborhood guides without time relevance
- blog-style roundup articles disconnected from structured inventory
- provider spotlight editorial unless tied to planning utility

---

## 5. Metadata and Content Contract

Hooky content only works if the visible card contract is consistent.

### 5.1 Event Card Minimum Display Fields

- title
- date/time
- neighborhood or venue
- age fit
- price/free when known
- source or freshness signal on detail

### 5.2 Program Card Minimum Display Fields

- name
- provider
- age range
- schedule or session dates
- cost when known
- registration status

### 5.3 Compare Eligibility Rules

An item should be compareable only if Hooky has enough data to support a meaningful side-by-side view.

**Events:**
- age signal
- date/time
- location
- freshness

**Programs:**
- age range
- schedule window
- location
- registration status

**Preferred for both:**
- cost

### 5.4 Trust Labels

Visible trust signals should include:

- registration status: `Open`, `Closing Soon`, `Waitlist`, `Sold Out`, `Unknown`
- freshness: `Updated recently`, `Needs verification`, or equivalent tiering
- source transparency on detail pages

The product should never collapse unknown status into positive status language.

---

## 6. Taxonomy for Content Buildout

### 6.1 Age Bands

Hooky should standardize on:

- infant
- toddler
- preschool
- elementary
- tween
- teen

These must be the default age-language system across feed, filters, compare, and collection pages.

### 6.2 Program Types

Launch program browse and collection logic should support:

- camps
- enrichment
- leagues
- classes
- clubs
- rec programs

### 6.3 Interest Themes

Interest themes should stay narrow enough to drive recommendations and broad enough to populate:

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

### 6.4 Planning Moments

These are as important as taxonomic categories and should drive nav, feed logic, and landing page generation:

- this weekend
- this week
- no-school day
- teacher workday
- spring break
- summer camp season
- free options
- starting soon

---

## 7. Launch Content Requirements

The PRD launch gates are directionally right but too thin to guarantee a strong planning experience on their own.

For launch-quality Hooky content, the operational target should be:

### 7.1 Events

- 200+ family-relevant events with usable age data
- 50+ items each for toddler, preschool, elementary, and tween where source coverage supports it
- enough weekend inventory to support a fresh `This Weekend` rail every week without obvious repeats

### 7.2 Programs

- 40+ structured programs, not 20
- with a meaningful mix across camps, classes/enrichment, and leagues/rec programs

The reason is simple: compare and filters get weak fast when the structured pool is shallow.

### 7.3 Trust Coverage

- meaningful share of events with freshness confidence
- meaningful share of programs with real registration status
- enough source transparency to explain where information came from

### 7.4 School Calendar Utility

- APS
- DeKalb
- Cobb
- Gwinnett

Private and homeschool can exist as user options only if the UI clearly explains that Hooky will show general family planning content rather than system-specific closures.

---

## 8. Source-to-Content Priorities

Content priority should follow user jobs, not crawler convenience.

### 8.1 P0: Must Power Weekly Utility

- library systems
- museums
- zoo and aquarium
- parks and rec systems
- family-friendly city events

These keep `This Weekend` and `Free This Week` alive.

### 8.2 P0.5: Must Power Comparison Utility

- camps
- enrichment providers
- structured rec programs
- major youth arts programs

These are more strategically important than another generic event source because they build the moat.

### 8.3 P1: Must Power Seasonal and Repeat Use

- youth sports leagues
- YMCA / community centers
- after-school studios
- more provider-owned camp and class inventories

If forced to choose, Hooky should prioritize structured provider supply over broad low-signal event sprawl.

---

## 9. Voice and Presentation

Hooky's content voice should be:

- direct
- calm
- modern
- useful
- slightly warm

It should not sound:

- sugary
- infantilizing
- mommy-bloggy
- school-newsletter-ish
- overly "wholesome brand" polished

### 9.1 Good Hooky Copy Patterns

- "No school Friday. Here are the best elementary-age options."
- "Open now for summer."
- "Starts next week."
- "Free and easy this weekend."
- "Best fit for preschoolers."

### 9.2 Bad Hooky Copy Patterns

- "Fun for the whole fam!"
- "Make magical memories!"
- "Your little ones will love..."
- "The perfect adventure awaits..."

The product should speak like a smart local planner, not a content-marketing team.

---

## 10. What Content Should Not Exist Yet

To protect scope and strategy, Hooky should not invest early in:

- long-form parenting editorial
- provider-authored advertorial
- social proof content
- family reviews
- kid-generated or kid-facing content
- generalized "best of Atlanta with kids" SEO farms disconnected from live inventory

---

## 11. Immediate Buildout Recommendation

If content work starts now, build in this order:

1. Define the card contract for events and programs.
2. Stand up feed inventory for `This Weekend`, `Heads Up`, `Free This Week`, and `Programs Starting Soon`.
3. Create the core collection pages:
   - This Weekend
   - Free This Week
   - Programs
   - Summer Camps
4. Set compare eligibility rules so weak records do not degrade the feature.
5. Tighten content gates around structured programs before leaning hard into camp-season messaging.

This order matches the strategy's strongest wedge: better decisions, better planning, better trust.
