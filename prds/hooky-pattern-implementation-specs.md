# Hooky Pattern Implementation Specs

**Portal:** `hooky`
**Surface:** `consumer`
**Status:** Pre-implementation spec
**Last Updated:** 2026-03-10
**Depends on:** `prds/hooky-first-wave-pattern-briefs.md`

---

## Purpose

This document defines the implementation contract for Hooky’s first four source patterns.

It is designed to answer the questions engineering will hit immediately:

- what fields should each pattern produce
- what extraction approach should be used first
- how should records be normalized into Hooky program objects
- what failure modes are acceptable in phase one

This is not code yet. It is the handoff between research and crawler work.

---

## Shared Product Contract

Every first-wave pattern should attempt to populate the same program-level shape.

### Required when available

- `title`
- `provider_name`
- `provider_url`
- `program_url`
- `registration_url`
- `location_name`
- `address` or place label
- `age_min`
- `age_max`
- `grade_text`
- `start_date`
- `end_date`
- `session_text`
- `price_min`
- `price_max`
- `price_text`
- `description`
- `source_pattern`
- `source_system`

### Nice to have

- `category`
- `theme`
- `full_day` / `half_day`
- `aftercare`
- `season`
- `status_signal`
- `audience_tags`

### Minimum bar for shipping a pattern

A pattern is good enough to expand only if it can reliably produce:

- title
- provider
- program or registration URL
- at least one of age/grade, session/date, or price

If it cannot do that without heavy manual cleanup, it should not drive expansion.

---

## Canonical Normalization Rules

These apply across all first-wave patterns.

### 1. Program concept vs session instance

When one named program appears in multiple weeks or locations:

- keep a stable **program concept**
- emit session-level records when date/location granularity is visible

Examples:

- Club SciKidz camp title reused across many weeks and churches
- Kid Chess seasonal camps with multiple locations or session variants

### 2. Registration URL precedence

Prefer:

1. direct registration/session URL
2. program detail page with registration CTA
3. public provider program hub

Do not downgrade to a competitor or editorial page.

### 3. Age normalization

Map age data to:

- `age_min`
- `age_max`
- `grade_text` when the provider uses grade bands instead of ages

Preserve the raw visible string if parsing is partial.

### 4. Price normalization

Store:

- numeric min/max when cleanly parseable
- raw `price_text` always

If multiple session prices exist in a single row, preserve the raw visible matrix even if only partial numeric parsing is possible in phase one.

### 5. Session text

Always preserve a visible human-readable session field when one exists:

- week range
- “Morning Camp”
- “Full Day w/ Lunch”
- “2026 Summer”

This is important even when start/end dates are parsed successfully.

### 6. Source traceability

Each emitted record should preserve:

- `source_pattern`
- `source_system`
- original visible provider page URL

This is part of Hooky’s trust model.

---

## Pattern 1 Spec: `MyRec`

### Initial targets

- [Marist School](https://maristschoolga.myrec.com/info/default.aspx)
- [Chamblee Parks & Recreation](https://chambleega.myrec.com/info/activities/default.aspx)

### Strategic goal

Prove one school `MyRec` source and one municipal `MyRec` source can normalize into the same output shape.

### Expected source structure

- landing page
- category filters
- program list pages
- detail pages via `program_details.aspx?ProgramID=...`

### Extraction approach

1. fetch the main activities page
2. extract visible categories and program links
3. fetch each program detail page
4. parse the highest-confidence structured fields from detail content

### Target fields

- `title`
- `category`
- `program_url`
- `registration_url`
- `location_name`
- `start_date`
- `end_date`
- `session_text`
- `age_min`
- `age_max`
- `description`

### Normalization guidance

- use provider-specific venue mapping only if location quality is strong; otherwise preserve the provider-level venue
- distinguish municipal categories from school camp categories using provider identity, not inferred titles
- if the list page exposes stronger category labels than detail pages, preserve both

### Known risks

- some visible data may be encoded in server-rendered state blobs rather than clean HTML
- age or timing fields may be uneven across providers
- MyRec category IDs and field order may differ between operators

### Phase-one success

- stable list traversal
- stable detail extraction
- shared normalization between Marist and Chamblee without forking the pattern immediately

---

## Pattern 2 Spec: Session-Rich Public Camp Archives

### Initial target

- [Club SciKidz Atlanta](https://atlanta.clubscikidz.com/)

### Strategic goal

Prove Hooky can ingest a large private-provider summer inventory with session-level specificity from public pages plus public registration links.

### Expected source structure

- camp category archive pages
- camp cards or entries
- age and price badges
- session groups with direct `ACTIVE` registration links

### Extraction approach

1. crawl camp archive pages
2. extract visible camp concept metadata from each card/entry
3. extract embedded session groups under that camp
4. emit one session record per visible dated registration link

### Target fields

- `title`
- `theme`
- `age_min`
- `age_max`
- `price_min`
- `price_text`
- `start_date`
- `location_name`
- `registration_url`
- `season`
- `program_url`

### Normalization guidance

- create a stable concept key from provider + camp title + age band
- treat each dated `ACTIVE` link as a session instance
- preserve church/school hosting site as session location, not as provider identity

### Known risks

- one camp may appear across many pages or categories
- session duplication across category archives is possible
- age band may be embedded in the title instead of a separate field

### Phase-one success

- one clean concept/session split
- dedupe across repeated appearances
- accurate session location and registration URLs

---

## Pattern 3 Spec: Public HTML Camp Tables

### Initial target

- [Kid Chess](https://kidchess.com/our-programs/seasonal-camps/)

### Strategic goal

Prove Hooky can turn structured seasonal tables into high-density enrichment records without relying on APIs.

### Expected source structure

- season anchors or sections
- HTML tables with columns like:
  - camp
  - dates
  - grades
  - sessions
  - times
  - tuition

### Extraction approach

1. detect season sections
2. parse each visible table row into a canonical intermediate object
3. split bundled session variants when they are visually distinct
4. preserve raw row content when column parsing is partial

### Target fields

- `title`
- `start_date`
- `end_date`
- `grade_text`
- `session_text`
- `time_text`
- `price_text`
- `location_name`
- `registration_url`
- `season`

### Normalization guidance

- if a row contains multiple session variants and prices, preserve each variant distinctly when possible
- if exact dates cannot be separated from a row cleanly, keep the raw row text and downgrade only the affected structured fields
- keep “advanced camp” or invite-only offerings distinct from normal camp offerings

### Known risks

- rows may mix location, timing, and pricing in a single cell
- one season page may include special one-off events and normal camps together
- future seasons may shift column order

### Phase-one success

- table parsing survives across multiple seasonal sections
- tuition and grade bands stay accurate
- registration destination stays tied to the right offering

---

## Pattern 4 Spec: School Summer Hubs

### Initial targets

- [Pace Academy](https://www.paceacademy.org/community/summer-programs)
- [Trinity School](https://www.trinityatl.org/campus-life/summer-camp)
- [Wesleyan School](https://www.wesleyanschool.org/camps-clinics)
- [The Swift School](https://www.theswiftschool.org/programs/summer-programs/summerexplorations)

### Strategic goal

Prove that one school-hub pattern can recover enough structured school-camp detail to justify broader school-camp expansion.

### Expected source structure

- summer hub landing page
- linked search or brochure pages
- subpages for camp families
- registration CTAs

### Extraction approach

1. crawl the hub page
2. collect all linked camp/discovery pages and brochure/PDF references
3. extract visible camp-family metadata from HTML first
4. only add brochure/PDF parsing if the HTML layer is insufficient

### Target fields

- `title`
- `program_family`
- `age_min` / `age_max` or `grade_text`
- `full_day`
- `half_day`
- `aftercare`
- `registration_url`
- `season`
- `program_url`

### Normalization guidance

- prefer HTML over brochures when both exist
- keep school-specific qualifiers like “rising K-12” or “3-week program” verbatim if full numeric normalization is lossy
- avoid flattening all school camps into a single generic “summer camp” record

### Known risks

- field fragmentation across multiple subpages
- brochure-only detail
- school CMS differences even within similar platforms like Finalsite or Blackbaud-style school sites

### Phase-one success

- at least two schools normalize into one shared school-hub contract
- aftercare/full-day/half-day logic is preserved where visible
- enough detail exists to justify continued school-camp investment

---

## Suggested Engineering Sequence

### Pass 1

Build the extraction scaffolding and normalization helpers for:

- shared age parsing
- shared price parsing
- concept/session split helpers
- source traceability metadata

### Pass 2

Implement one provider for each pattern:

- Marist or Chamblee for `MyRec`
- Club SciKidz for session-rich archives
- Kid Chess for HTML camp tables
- Pace or Swift for school summer hubs

### Pass 3

Add the second provider inside the same pattern before broadening further.

This is important because it tests whether the pattern is real or just provider-specific luck.

---

## Verification Criteria

Before broadening any pattern, confirm:

1. records stay stable across reruns
2. dedupe works for repeated sessions and concept-level variants
3. registration URLs remain canonical
4. age/price/date parsing does not silently degrade into empty fields
5. program objects remain useful enough for compare and planning views

If a pattern cannot meet those checks on two providers, it should remain narrow until fixed.

---

## What Comes After

If the first four patterns are successful, the next expansion order should be:

- additional school hubs
- additional arts/performance camp pages
- recurring swim/location stacks
- camp-network ecosystems

That is the point where broader expansion becomes justified.

