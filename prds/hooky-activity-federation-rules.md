# Hooky Activity Federation Rules

**Shared owner:** `atlanta`  
**Federated consumer:** `hooky`  
**Status:** Active rules  
**Last Updated:** 2026-03-11  
**Depends on:** `prds/hooky-next-big-effort-workstream.md`, `prds/atlanta-activity-overlay-audit.md`, `crawlers/reports/atlanta_activity_overlay_sweep_2026-03-11.md`

---

## Purpose

This document defines how Hooky should consume Atlanta-owned destination activity intelligence without duplicating ownership or inheriting non-family noise.

The principle is simple:

- Atlanta owns the durable destination graph
- Hooky consumes a family-safe subset of that graph

That means the federation layer should be opinionated, but it should not rewrite Atlanta’s source of truth.

---

## Core Rule

Hooky should federate `venue_features` from Atlanta when those rows describe real family outing value:

- attractions
- hands-on exhibits
- collections worth visiting with kids
- destination experiences
- practical family outing amenities

Hooky should not blindly inherit every active Atlanta feature row.

Operational, fundraising, or admin-adjacent rows weaken the family product even if they are technically valid for the broader city graph.

---

## Inclusion Rules

Hooky should include Atlanta-owned feature rows when they are:

1. destination-grade
2. useful for a parent deciding whether to go
3. legible as a place-to-go experience, not back-office context
4. appropriate for at least one real family age band

Good examples:

- `Ocean Voyager Gallery`
- `Children's Garden`
- `Hands-On Play Exhibits`
- `Wildlife Walk`
- `Planetarium Shows`
- `Summit Trail`

---

## Exclusion Rules

Hooky should exclude Atlanta feature rows that read like:

1. fundraising logistics
2. pick-up or operational instructions
3. member-only or staff-only notes
4. volunteer/admin activity that is not a family outing

Current hard exclusion examples:

- `birdseed-fundraiser-pick-up`

Current text-pattern exclusions:

- `fundraiser`
- `pick up` / `pickup`
- `member only`
- `staff`
- `volunteer`

---

## Venue-Specific Guardrails

### Chattahoochee Nature Center

This venue currently has a mixed feature pack:

- strong family outing overlays from the new Atlanta sweep
- older legacy rows that are still broadly useful
- one clearly off-target operational/fundraising row

Hooky should include:

- `wildlife-walk`
- `river-boardwalk-trails`
- `interactive-nature-play`
- `weekend-activities`
- `river-roots-science-stations`
- `naturally-artistic-interactive-exhibits`
- `winter-gallery`
- `spring-gallery`

Hooky should exclude:

- `birdseed-fundraiser-pick-up`

### Stone Mountain Park

Stone Mountain’s current feature pack is broadly acceptable for Hooky.

The old attraction rows are still family-useful:

- `summit-skyride`
- `scenic-railroad`
- `mini-golf`
- `dinosaur-explore`
- `historic-square-a-collection-of-georgia-homes-and-antiques`

The new broad overlays add family framing:

- `summit-trail`
- `lakeside-and-trail-outings`

No Hooky-specific exclusions are required right now.

---

## Implementation State

The current federation logic is implemented in:

- `web/lib/venue-features.ts`
- `web/app/[portal]/spots/[slug]/page.tsx`
- `web/components/views/VenueDetailView.tsx`

Behavior:

- Atlanta and other portals keep the full shared feature pack
- Hooky applies a family-specific filter before rendering
- the filter runs in both the server spot page and the client venue detail flow

---

## Follow-Up

This rule set is intentionally light.

The next refinement should happen only when one of these becomes true:

1. the second overlay wave introduces more mixed legacy packs
2. Hooky starts rendering activity rails beyond spot pages
3. feature rows need explicit age-band metadata rather than portal-side filtering

Until then, the right move is:

- keep Atlanta as owner
- keep Hooky as filtered consumer
- only hard-delete or deactivate shared rows when they are bad for Atlanta too
