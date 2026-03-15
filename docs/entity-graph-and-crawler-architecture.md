# Entity Graph And Crawler Architecture

**Status:** Proposed  
**Date:** 2026-03-15  
**Purpose:** Define a durable entity architecture for LostCity that supports current portal entities and future ones, while staying consistent with destination-first enrichment and crawler-first ingestion.

## Why This Exists

LostCity is no longer only an events platform.

The live system now has:

- strong `events`
- live portal federation
- destination enrichment on `venues`
- `venue_specials`
- `programs` schema
- `volunteer_opportunities`
- exhibit signal already encoded as `events.content_kind = 'exhibit'`
- destination-oriented enrichment work for Atlanta, Hooky, FORTH, and Yonder

The next problem is not "how do we add one more table."

It is:

1. how to keep adding new entity types without turning the model into one-off side systems
2. how to keep destination richness as a first-class part of the product
3. how to let crawlers emit the right information into the right lane instead of flattening everything into `events`

This document defines that architecture.

## Live Validation Snapshot

Validated directly against production on **2026-03-15**.

- `events`: `30,725`
- `venues`: `5,430`
- `sources`: `1,334`
- `programs`: `0`
- `school_calendar_events`: `124`
- `volunteer_opportunities`: `61`

Portal ownership shape:

- `atlanta`: `493` active owned sources, `16,172` future active events
- `hooky`: `47` active owned sources, `2,848` future active events
- `helpatl`: `51` active owned sources, `1,222` future active events
- `arts-atlanta`: `0` active owned sources, `0` owned future events
- `yonder`: `0` active owned sources, `0` owned future events

Critical production gaps:

- `exhibitions` not live
- `open_calls` not live
- `venue_destination_details` not live
- `programs` live but empty
- `programs` write path currently assumes a `metadata` column that production does not have
- `activities.portal_id` exists but last-30-day writes are still null

This means the architecture must solve both **model shape** and **ingestion alignment**.

## North-Star Model

LostCity should operate on a three-layer entity graph:

1. **Anchors**: durable things in the world
2. **Attendables / Joinables / Actionables**: things a person can do, attend, join, book, or submit to
3. **Attached richness**: facts, features, signals, and notable details that make anchors useful

This is the durable structure that should survive future portals.

## Layer 1: Anchors

These are the stable entities that other entities attach to.

### Destinations

Canonical persistent places.

Examples:

- restaurant
- bar
- park
- trail
- museum
- gallery
- campground
- climbing gym
- civic building
- sports bar
- stadium

Current home:

- `venues`

Direction:

- keep `venues` as the canonical destination table
- treat "destination" as the product concept and `venues` as the storage table
- continue expanding destination-grade fields there and in destination extension tables

### Organizations

Canonical operators, producers, hosts, and institutions.

Examples:

- nonprofit
- parks department
- arts center
- sports team org
- gallery operator
- civic office

Current homes:

- `organizations`
- `event_producers`

Direction:

- converge long-term on one canonical organization graph
- stop creating new entity families that need their own shadow operator model

### People / Participants / Brands

Examples:

- artists
- curators
- teams
- venues-as-brands
- providers

Current state:

- partially structured via `event_artists`
- partly implicit in strings

Direction:

- keep attached participant rows where needed
- add first-class person/team entities only when there is durable cross-record value

## Layer 2: Actionable Entities

These are the entities that answer "what can I do with this?"

A new entity type should only become first-class if it has independent browse, search, routing, comparison, recommendation, or cross-portal reuse value.

### Events

Use for dated happenings in the feed.

Examples:

- concert
- screening
- city council meeting
- watch party
- volunteer shift

Current home:

- `events`

### Programs

Use for structured commitments with registration and session shape.

Examples:

- swim lessons
- summer camps
- rec leagues
- class series with enrollment

Current home:

- `programs`

### Exhibitions

Use for time-bounded art or museum runs that deserve identity beyond one event card.

Examples:

- museum exhibition
- gallery run
- installation run

Current home:

- `exhibitions`

### Opportunities

Use for submission-, volunteer-, or deadline-driven actionables.

Examples:

- volunteer opportunities
- open calls
- grants
- residencies

Current homes:

- `volunteer_opportunities`
- `open_calls`

### Games / Matches / Schedules

Use when sports has structured semantics that matter independent of generic events.

Examples:

- opponent
- home/away
- standings impact
- broadcast link
- score

Current state:

- flattened into `events`

Direction:

- add a sports extension model or first-class `games` table when the web product needs game-day semantics and historical schedule integrity

### Stays / Bookable Inventory

Use for accommodations and bookable destination inventory.

Examples:

- campsite
- cabin
- glamping unit
- overnight inventory slices

Current state:

- partially represented through venue/destination workstreams

Direction:

- keep this as a likely future first-class entity family

## Layer 3: Attached Richness

This is the layer that makes the data moat real.

These records usually should not become first-class routable entities on day one.
They should attach to anchors or actionables and enrich them.

### Destination Features

This is the right home for "things you can do / see / experience at a place" when they do not deserve full first-class identity.

Current home:

- `venue_features`

This table should become the canonical attached-feature layer for destinations.

Examples:

- permanent attraction
- rotating destination-scoped exhibition
- collection
- tour
- playground
- splash pad
- scenic overlook
- ropes course inside a larger venue
- kid zone
- climbing wall
- on-site museum experience

Recommended product naming:

- call these **destination features** in docs and UI
- keep `venue_features` as the physical table until renaming is worth the migration cost

### Specials

Current home:

- `venue_specials`

Use for:

- happy hour
- recurring food/drink deals
- destination-linked promotional offers

This is not an event lane.

### Editorial Signals

Current homes:

- `editorial_mentions`
- `venue_occasions`

Use for:

- best-of mentions
- guide inclusion
- date-night signal
- family-friendly signal
- trail guide references

These are enrichment signals, not user actions and not primary entities.

### Planning Facts

Current homes:

- `venues.planning_notes`
- destination-oriented venue fields
- future destination extensions

Use for:

- parking
- reservation friction
- access caveats
- family suitability
- dog suitability
- weather fit
- accessibility nuance

These should remain facts attached to destinations, not event rows.

### Landmarks / Artifacts / Notable Facts

This is the trickiest lane.

Not every notable thing deserves its own top-level entity.

Use this rule:

- if it is mainly a story-rich point inside or around a broader destination, keep it as attached richness first
- if it has standalone consumer value, map value, and repeat discovery value, promote it to a destination-grade record

Recommended storage strategy:

- short term: represent many of these through destination records plus destination-feature or relationship metadata
- medium term: add a dedicated landmark/artifact table only when Yonder truly needs independent routing, quest joins, and progress tracking

This aligns with the existing Yonder artifact research direction.

## Promotion Rules

Every new "thing" should pass this promotion test:

### Stay Attached To A Destination If

- it is mainly useful in the context of a parent destination
- it does not need its own search/browse route
- it does not need cross-venue comparison
- it does not need independent social proof / tracking
- it does not appear across multiple portals as a standalone surface

Examples:

- splash pad at a park
- permanent exhibit inside a museum
- rooftop viewpoint inside a venue
- kid area
- notable sculpture on a trail
- on-site dining note

### Become First-Class If

- it has independent browse/search value
- it has its own schedule, deadline, or booking state
- it needs cross-destination comparison
- it has strong user intent on its own
- it should appear in recommendations independent of the parent destination

Examples:

- program
- exhibition run
- open call
- volunteer opportunity
- sports game
- bookable campsite inventory

## Destination-Centric Unification

The destination model should be the stable spine across portals.

### Destination Core

Keep in `venues`:

- identity
- geo
- type
- image
- short description
- planning notes
- broad destination utility

### Destination Extensions

Use extension tables where the fields are durable but domain-specific.

Examples:

- `venue_destination_details` for Adventure-grade destination metadata such as
  `destination_type`, `commitment_tier`, `weather_fit_tags`, and planning friction
- future hospitality/accommodation tables
- future accessibility / suitability extensions if needed

### Destination Attachments

Use attached tables for child richness:

- `venue_features`
- `venue_specials`
- `editorial_mentions`
- `venue_occasions`

This gives us a clean pattern:

- **destination** = the place
- **feature** = something at the place
- **special** = an offer at the place
- **editorial/occasion/fact** = signals about the place

## Recommended Graph Relationships

We should standardize around a small relationship vocabulary.

Core relationship types:

- `hosted_at`
- `offered_by`
- `produced_by`
- `parent_of`
- `child_of`
- `related_to`
- `occurs_at`
- `bookable_at`
- `notable_within`
- `fed_from`

Near-term implementation does not require a universal polymorphic relationship table.
But product docs and new schema should use the same relationship concepts.

## Crawler Architecture Implications

The crawler system should stop treating "insert event" as the default output.

### New Crawler Contract

Every crawler should emit typed payloads, not direct DB assumptions.

Recommended output envelope:

```python
{
  "destinations": [...],
  "destination_details": [...],
  "events": [...],
  "programs": [...],
  "exhibitions": [...],
  "opportunities": [...],
  "specials": [...],
  "destination_features": [...],
  "editorial_signals": [...],
  "planning_facts": [...],
}
```

Not every crawler emits every lane.
But every crawler should explicitly decide which lanes it supports.

### Source Capability Declaration

Add per-source capabilities:

- `emits_events`
- `emits_programs`
- `emits_exhibitions`
- `emits_opportunities`
- `emits_specials`
- `emits_destination_features`
- `emits_destination_details`
- `emits_planning_facts`
- `emits_destination_metadata`

This makes "first-pass capture" auditable.

### Shared Writers

Shared writers should exist per lane:

- event writer
- program writer
- exhibition writer
- opportunity writer
- specials writer
- destination feature writer
- destination-details writer
- destination enrichment writer

No new portal entity should launch without a shared writer.

### Classify Before Persist

Pipeline shape:

1. fetch
2. extract
3. normalize
4. classify into lanes
5. validate lane-specific payload
6. persist via shared writer

This avoids:

- fake recurring events for permanent attractions
- exhibit rows mixed with normal events by accident
- activities that should be destination features becoming feed spam
- portal-specific ad hoc persistence logic in source files

## Immediate Production Corrections

Before broader rearchitecture, fix these:

1. Deploy the missing production tables:
   - `exhibitions`
   - `open_calls`
   - `venue_destination_details`

2. Fix the live `programs` schema/code mismatch:
   - either add `metadata` to `programs`
   - or remove `metadata` dependency from the writer and use a dedicated hash column

3. Fix `activities.portal_id` writes so attribution is operational, not just theoretical.

4. Make `exhibitions` and `open_calls` APIs portal-aware before those tables fill.

## Recommended Near-Term Schema Strategy

### Keep

- `venues` as destination spine
- `events` as feed/event spine
- `programs`, `exhibitions`, `open_calls`, `volunteer_opportunities` as first-class actionables
- `venue_features` as the attached destination-experience layer
- `venue_specials` as the offer layer

### Add Or Strengthen

- `venue_destination_details` in production
- a stable hash/dedupe strategy for `programs`
- possibly a `games` or `sports_event_details` extension table
- eventually a `landmarks` / `artifacts` table only when Yonder needs independent destination-child routing and quest joins

### Avoid

- creating a new bespoke table for every portal whim
- forcing all "things at a place" into `events`
- turning every landmark or tidbit into a top-level routable entity
- building portal-local data silos when the fact is globally useful

## Decision Rules For Future Entities

When a new portal asks for a new entity, answer these in order:

1. Is this a durable place, operator, or participant?
2. Is this a first-class actionable thing?
3. Is this attached richness on a destination or actionable?
4. Does it need independent routing and cross-portal reuse?
5. Can it start life as an attachment and be promoted later?

If the answer to 3 is yes and 4 is no, do not create a new top-level table yet.

## Bottom Line

The right architecture is not "everything becomes an event" and not "every portal gets its own table zoo."

It is:

- a stable destination spine
- a clear set of first-class actionable entity families
- a rich attached-feature and signal layer
- crawler outputs that classify into those lanes explicitly

That structure supports future entities without losing the thing that makes LostCity valuable:

the accumulation of real-world detail around places, happenings, commitments, experiences, and all the little facts that make local discovery actually useful.
