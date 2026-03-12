# Hooky First-Wave Pattern Briefs

**Portal:** `hooky`
**Surface:** `consumer`
**Status:** Research-to-build brief
**Last Updated:** 2026-03-10
**Depends on:** `prds/hooky-pattern-backlog.md`

---

## Purpose

This document defines the first pattern work Hooky should nail before expanding program coverage more broadly.

It is deliberately narrow.

The goal is not:

- “cover as many providers as possible”

The goal is:

- “prove the highest-value source patterns can reliably produce strong Hooky program objects”

---

## Executive Summary

The first wave should focus on four patterns:

1. `MyRec`
2. session-rich public camp archives with public registration links
3. public HTML camp-table sources
4. school summer hubs

If Hooky can make those four patterns work well, it will have a much stronger base for:

- school camps
- civic and municipal program layers
- STEM and specialty enrichment
- a broad camp-season planning surface

That is enough to materially change the family-program map before chasing harder long-tail sources.

---

## Pattern 1: `MyRec`

### Why this pattern is first-wave

`MyRec` is strategically attractive because it closes two major gaps at once:

- school-hosted camps
- municipal and civic program inventory

It also looks structured enough to be reusable.

### Initial providers

- [Marist School](https://maristschoolga.myrec.com/info/default.aspx)
- [Chamblee Parks & Recreation](https://chambleega.myrec.com/info/activities/default.aspx)

### What Hooky needs from this pattern

- program title
- category
- program detail URL
- date or session window when available
- age or audience cue when available
- location
- registration URL
- provider identity

### Why it matters strategically

- school camps are one of the biggest breadth gaps vs competitors
- civic inventory improves geographic credibility and budget breadth
- both are high-trust official sources

### Likely extraction shape

- category/list pages
- program detail pages
- registration-native links

### Key risks

- details may be split between listing and detail pages
- age information may be inconsistent across providers

### Success criteria

- one school `MyRec` source and one municipal `MyRec` source normalized into the same program shape
- stable extraction of list + detail records
- category and registration preserved without manual cleanup

---

## Pattern 2: Session-Rich Public Camp Archives

### Why this pattern is first-wave

This is the cleanest private-provider pattern found in the research.

It creates strong compareable camp records from public pages without needing a fragile app-only workflow.

### Initial provider

- [Club SciKidz Atlanta](https://atlanta.clubscikidz.com/)

### What Hooky needs from this pattern

- camp title
- age band
- session date
- location
- price
- season label
- registration URL
- category/theme

### Why it matters strategically

- closes the long-tail STEM gap
- produces exactly the kind of structured camp data competitors imply but do not normalize well
- high compare value across dates, ages, themes, and locations

### Likely extraction shape

- public camp archive pages
- camp detail cards or entries
- direct `ACTIVE` registration session links

### Key risks

- franchise or provider-specific markup may limit reuse
- location/session duplication may need careful normalization

### Success criteria

- one provider yields a large, structured summer inventory
- sessions roll up cleanly under canonical camp/program concepts
- age, price, location, and registration are preserved at session level

---

## Pattern 3: Public HTML Camp Tables

### Why this pattern is first-wave

This is a low-ambiguity pattern with unusually dense program fields.

It is one of the fastest ways to create high-trust, compareable enrichment records.

### Initial provider

- [Kid Chess](https://kidchess.com/our-programs/seasonal-camps/)

### What Hooky needs from this pattern

- camp name
- date range
- grade band
- session type
- times
- tuition
- location
- registration CTA

### Why it matters strategically

- expands STEM/specialty enrichment without relying on generic directories
- fits Hooky’s compare and planning strategy extremely well

### Likely extraction shape

- structured HTML tables
- season sections
- optional linked location/detail elements

### Key risks

- tables may vary across seasons
- some rows may bundle multiple session types inside one visual entry

### Success criteria

- table structure can be parsed without brittle one-off hacks
- session variants normalize into comparable program records
- price and schedule remain machine-usable

---

## Pattern 4: School Summer Hubs

### Why this pattern is first-wave

This is the biggest market-completeness gap, but also the messiest early pattern.

It belongs in the first wave because Hooky needs to prove it can represent school-camp breadth, even if the first implementation is narrower than the other three patterns.

### Initial providers

- [Pace Academy](https://www.paceacademy.org/community/summer-programs)
- [Trinity School](https://www.trinityatl.org/campus-life/summer-camp)
- [Wesleyan School](https://www.wesleyanschool.org/camps-clinics)
- [The Swift School](https://www.theswiftschool.org/programs/summer-programs/summerexplorations)

### What Hooky needs from this pattern

- camp/program family
- age or grade framing
- full-day / half-day / aftercare logic
- registration deadline or season signal
- downstream detail links or brochure references
- provider identity

### Why it matters strategically

- competitors feel deep partly because they include private school and campus summer programs
- this category adds age spread, sports breadth, and seasonal volume

### Likely extraction shape

- summer-program hub page
- linked subpages or search pages
- brochure or PDF references
- registration links

### Key risks

- field richness may be fragmented
- some providers may require school-specific handling even when the CMS looks similar
- brochures can introduce additional parsing complexity

### Success criteria

- at least one school hub yields enough structured detail to be worth the pattern
- Hooky can preserve school-specific structure like half-day/full-day and aftercare
- pattern can be reused across more than one school without full rewrite

---

## Cross-Pattern Requirements

Every first-wave pattern should prove the same core product contract.

Hooky program objects should preserve, when available:

- title
- provider
- age/grade fit
- session/date logic
- location
- price
- registration destination
- season/status signal

If a pattern cannot reliably produce most of that, it should not drive early expansion.

---

## Recommended Build Order

### Step 1

Prove `MyRec`.

Why:

- strongest blend of reuse and market gap closed

### Step 2

Prove Club SciKidz-style session archives.

Why:

- highest-quality private-provider pattern found so far

### Step 3

Prove Kid Chess-style public camp tables.

Why:

- dense fields and low ambiguity

### Step 4

Prove one school summer-hub implementation.

Why:

- validates whether the biggest breadth gap is operationally realistic

---

## What Not To Do Yet

Do not treat these as first-wave priorities:

- camp-network ecosystems like Girl Scouts and Camp Invention
- recurring swim/location stacks as the main early expansion wedge
- field-thin arts sources that are strategically interesting but structurally weak

Those should follow after the first four patterns are producing reliable objects.

---

## Strategic Meaning

If these first-wave patterns work, Hooky will have proven something important:

It can expand family-program depth through a small number of repeatable official-source models, rather than through endless one-off crawler work.

That is the condition required for a defensible `programs` moat.

