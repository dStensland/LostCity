# PRD 041: Atlanta Third-Space Source Pack

**Portal:** `atlanta`
**Surface:** `consumer`
**Status:** Research-to-build brief
**Last Updated:** 2026-04-01
**Scope:** Atlanta destination intelligence + recurring-program capture

---

## Purpose

This document defines the first source pack LostCity should use to turn
Atlanta "third spaces" into real platform data.

This is not a new portal and not a new first-class entity type.

The goal is:

- enrich `destinations` with hangout intelligence
- capture recurring low-friction social programming
- improve recommendation quality for "where should we hang?" use cases

The goal is not:

- publish a generic editorial list of "best third spaces"
- create hand-maintained venue blurbs that do not scale
- treat third spaces as a siloed content vertical

---

## Product Frame

Third-space intelligence should be modeled as:

1. `destination facts`
2. `recurring program / event signals`
3. `inferred ranking scores`

This work strengthens:

- Atlanta destination pages
- search and recommendation quality
- hangs / social coordination prompts
- future Family and Citizen use cases

It should not introduce a new entity type.

---

## Why This Matters

Atlanta already has a real third-space ecosystem, but it is fragmented,
unevenly distributed, and poorly structured for discovery.

The biggest product opportunity is not "best cafes."

It is:

- cheap indoor hangs
- low-pressure social spaces
- solo-friendly places
- family linger spots
- recurring community infrastructure

These are all recommendation and planning problems, which means the answer
belongs in the shared data layer.

---

## Non-Negotiable Rules

From `.claude/north-star.md` and `crawlers/CLAUDE.md`:

- the work must make the data layer richer
- crawlers must capture destinations, not just events
- every source should capture all useful first-pass signal
- recurring programming should become series when appropriate
- this should create reusable infrastructure, not editorial debt

Operational rule:

- treat "third-space" as a destination-intelligence lens over real venues
- use recurring programs to prove a venue is socially active
- prefer official sources over editorial coverage

---

## What The First Wave Should Prove

The first wave should prove four things:

1. we can reliably capture third-space destination facts from official sources
2. we can capture recurring social programming without polluting the main feed
3. we can score venues for hangout use cases without pretending weak inference is fact
4. we can do this across multiple archetypes, not just coffee shops

If those four things work, third-space intelligence becomes a reusable Atlanta
layer instead of a one-off content experiment.

---

## First-Wave Source Set

The first wave should focus on twelve sources across six archetypes:

### 1. Public / Civic Infrastructure

- [Atlanta BeltLine](https://beltline.org/things-to-do/fitness/run-club/)
- [Atlanta Central Library](https://www.fulcolibrary.org/central-library/)

### 2. Mission-Driven Neighborhood Hubs

- [Community Grounds](https://communitygrounds.com/)
- [The Ke'nekt Cooperative](https://www.thekenekt.com/)
- [Pittsburgh Yards](https://www.pittsburghyards.com/)

### 3. Bookish / Low-Pressure Spaces

- [Charis Books & More](https://charisbooksandmore.com/upcoming-events)
- [Little Shop of Stories](https://littleshopofstories.com/storytime)

### 4. Maker / Learning Spaces

- [Museum of Design Atlanta](https://www.museumofdesign.org/)
- [Decatur Makers](https://www.decaturmakers.org/)

### 5. Community Coffee / Social Formats

- [Peoples Town Coffee](https://www.peoplestowncoffee.com/events)

### 6. Evening Sober-ish Social

- [Tea'z Social](https://www.teazsocial.com/events/game-night)
- [Kava Mama](https://kavamamastore.com/pages/events)

This set is deliberately mixed.

It is not trying to maximize venue count.

It is trying to prove that the destination-intelligence layer works across:

- public space
- civic space
- coffee shops
- bookstores
- makerspaces
- family-oriented venues
- evening non-bar social formats

---

## Why These Sources Are First

These sources are attractive because they produce both a viable destination
record and some form of recurring programming or socially legible behavior.

That means they help answer both:

- "is this a place worth going?"
- "is this a place where people actually gather?"

This is the right first wave because pure venue metadata is not enough to
identify real third spaces.

Recurring social use is what separates a nice venue from actual hangout
infrastructure.

---

## Extraction Contract

Each source should emit three classes of signal.

### A. Destination Facts

Minimum fields:

- `name`
- `slug`
- `address`
- `neighborhood`
- `city`
- `state`
- `lat`
- `lng`
- `venue_type`
- `spot_type`
- `website`
- `description`
- `image_url`
- `hours`

Additional high-value fields:

- `price_signals`
- `alcohol_primary`
- `under_21_allowed`
- `membership_required`
- `has_wifi`
- `has_seating`
- `indoor_outdoor`

### B. Recurring Program / Event Signals

Capture any:

- run clubs
- storytimes
- game nights
- markets
- open make sessions
- workshops
- discussion groups
- classes
- recurring community nights

Minimum program fields:

- `title`
- `source_url`
- `program_type`
- `start_date` or recurrence window
- `start_time` when available
- `drop_in_ok`
- `registration_required`
- `age_min` / `age_max` when available
- `price_note`

When the source clearly represents repeating programming, prefer:

- `is_recurring = true`
- `series_hint`

over feed spam from repeated cloned event cards.

### C. Third-Space Evidence

Store evidence that can later support scoring:

- official hours
- "community" / "gather" / "cowork" / "reading" / "storytime" language
- explicit amenities like wifi, communal seating, meeting rooms, teen rooms
- free or low-cost entry cues
- recurring cadence language like weekly, monthly, every Thursday
- evening availability
- family or beginner framing

If a score cannot point back to source evidence, it should not exist.

---

## Source-By-Source Briefs

## 1. Atlanta BeltLine

### Why it matters

This is Atlanta's clearest public third-space system.

### What to capture

- destination system record for the BeltLine
- recurring public programming like Run Club
- free-entry and public-access cues
- neighborhood and trail-adjacency language

### Strategic value

- proves public-space third-space intelligence
- strengthens "free tonight" and "meet people without a bar" queries

### Key risks

- programming may be distributed across multiple BeltLine sections
- destination is a system, not a single storefront-style venue

### Success criteria

- one healthy BeltLine destination record
- recurring public programming captured cleanly
- no fake one-off event spam for repeating activations

## 2. Atlanta Central Library

### Why it matters

Libraries are among the strongest low-cost third-space assets and are
underrepresented in lifestyle coverage.

### What to capture

- hours
- meeting-room and teen-space cues
- public-program calendar items
- explicit free/community language

### Strategic value

- improves civic and youth third-space coverage
- gives LostCity non-commercial hangout infrastructure

### Key risks

- programming can be branch- and page-specific
- some public-space features may be described outside the event calendar

### Success criteria

- Central Library is useful as a destination even with zero current events
- recurring or representative programming is captured without flattening every
  branch into the same venue

## 3. Community Grounds

### Why it matters

This is one of the clearest mission-driven "third space" venues in Atlanta.

### What to capture

- official "third space" positioning
- nonprofit / community framing
- hours
- event and market programming
- coffee-shop destination data

### Strategic value

- strong canonical source for hangout-intelligence heuristics
- Southwest Atlanta cluster anchor

### Key risks

- event cadence may be social-post-driven rather than highly structured

### Success criteria

- high-confidence destination object
- recurring community-program signal preserved

## 4. The Ke'nekt Cooperative

### Why it matters

This is a direct example of identity-specific community infrastructure.

### What to capture

- mission language
- community and cowork uses
- event / workshop cadence
- hours and access model

### Strategic value

- expands beyond generic cafe logic
- adds community-hub pattern support

### Key risks

- avoid overclaiming safety/inclusion traits beyond explicit official language

### Success criteria

- venue captured as a community hub, not just a cafe or event space
- programming linked to destination intelligence

## 5. Pittsburgh Yards

### Why it matters

This is a multi-use community hub with stronger program surface area than a
typical venue.

### What to capture

- destination identity
- classes, markets, and workshops
- entrepreneurship / cowork / maker cues
- recurring cadence where available

### Strategic value

- bridges destination, community, and program data
- strengthens Southwest Atlanta coverage

### Key risks

- source may span multiple initiatives or sub-brands

### Success criteria

- one coherent destination record
- repeated public-facing programming normalized cleanly

## 6. Charis Books & More

### Why it matters

Charis is a strong example of a bookstore that functions as community
infrastructure, not just retail.

### What to capture

- event taxonomy
- free vs paid cues
- recurring discussion / art-making / community formats
- evening viability

### Strategic value

- strengthens low-pressure social and bookish recommendation lanes

### Key risks

- event volume can tempt overproduction of one-off feed clutter

### Success criteria

- destination remains legible as a bookstore/community space
- recurring program patterns are preserved where appropriate

## 7. Little Shop of Stories

### Why it matters

This is one of the strongest family-safe low-pressure hangout sources.

### What to capture

- storytime cadence
- age-band cues
- family programming
- bookstore destination fields

### Strategic value

- directly useful to Family later
- proves the third-space lens can serve kids/family use cases

### Key risks

- children's event listings can blur into one-off book-signing noise

### Success criteria

- strong destination record
- recurring family programming captured with age-aware normalization

## 8. Museum of Design Atlanta

### Why it matters

MODA is a strong maker / learning pattern, not just a museum listing.

### What to capture

- open make and workshop formats
- destination hours and practical visit info
- adult and family participation cues

### Strategic value

- proves the third-space layer can incorporate learning-centered destinations

### Key risks

- museum programming may mix standard exhibitions with participatory formats

### Success criteria

- participatory programs remain distinguishable from destination identity

## 9. Decatur Makers

### Why it matters

This is a strong makerspace pattern with explicit learning and community
activity.

### What to capture

- membership vs public-access cues
- classes and workshops
- family / youth cues where present
- maker-space amenities

### Strategic value

- helps define a reusable makerspace source pattern

### Key risks

- membership requirements can change the venue's hangout accessibility

### Success criteria

- access model is explicit
- classes and open-shop/community formats are differentiated

## 10. Peoples Town Coffee

### Why it matters

This is a coffee-shop source whose event layer appears to create real community
behavior.

### What to capture

- hours
- event calendar
- collaboration partners
- recurring social formats

### Strategic value

- proves that a coffee-shop source can generate both destination and community
  signals without becoming generic cafe metadata

### Key risks

- event depth may be modest relative to its cultural importance

### Success criteria

- destination intelligence remains strong even if event volume is light

## 11. Tea'z Social

### Why it matters

This is one of the cleanest evening non-bar social patterns in the city.

### What to capture

- game-night and recurring social formats
- evening hours
- sober-ish / non-alcohol-primary positioning where explicit
- lounge-style destination cues

### Strategic value

- closes the cheap indoor evening hang gap better than daytime cafes do

### Key risks

- avoid inferring more about vibe or safety than the source actually says

### Success criteria

- venue ranks as an evening social option for the right reasons:
  hours, format, and recurring activity

## 12. Kava Mama

### Why it matters

This is another strong evening social source, but with a different access and
substance model than a cafe or bar.

### What to capture

- evening hours
- event cadence
- kava lounge positioning
- access and pricing cues

### Strategic value

- broadens evening non-bar social coverage
- prevents the model from being overfit to coffee/bookstore/public-space sources

### Key risks

- product language may be easy to misclassify as bar-like nightlife

### Success criteria

- correct classification as evening social lounge, not generic bar

---

## Recommended Build Sequence

The source pack should be built in three waves.

### Wave 1: Foundation Patterns

- Community Grounds
- Charis Books
- Atlanta Central Library
- Atlanta BeltLine

Why:

- strongest mix of destination value and clean strategic signal
- enough variation to test the model without high pattern complexity

### Wave 2: Family / Maker / Community Hub Expansion

- Little Shop of Stories
- Pittsburgh Yards
- Museum of Design Atlanta
- Decatur Makers

Why:

- expands the pattern library across family, maker, and hub use cases

### Wave 3: Evening Social Completion

- Peoples Town Coffee
- Tea'z Social
- Kava Mama
- The Ke'nekt Cooperative

Why:

- closes the evening and identity/community-hub lanes after the foundation is
  stable

---

## Data Shape Guidance

This work should not wait on a perfect new schema.

At minimum, each source should already improve:

- venue completeness
- recurring series capture
- destination usefulness

If a schema extension is added later for third-space scoring, keep the layers
separate:

1. facts
2. evidence
3. inferred scores

Do not collapse them into a single ambiguous blob.

---

## Acceptance Criteria

This source pack is successful when:

- at least 12 Atlanta sources are active and producing useful destination
  intelligence
- at least 8 of the 12 produce recurring-program or recurring-series signal
- the resulting destinations support queries like:
  - cheap indoor hang
  - quiet catch-up
  - meet people without a bar vibe
  - family linger spot
- no source is considered "done" if it only emits events and ignores venue
  hours, description, image, or community-use signal
- no crawler creates repeated low-signal event spam for weekly operations

---

## Anti-Patterns

Do not:

- create a "third spaces" portal or pseudo-entity
- publish hard claims like "welcoming" or "safe" from weak inference
- rely on editorial listicles as source truth
- hand-curate venue blurbs as the core data strategy
- flatten recurring weekly activity into dozens of disconnected feed events
- ignore neighborhood clusters in Southwest Atlanta because they are less
  mainstream than BeltLine-adjacent inventory

---

## Recommended Next Artifact

The next implementation artifact should be a crawler execution checklist for the
first four sources:

- source URLs and fallback URLs
- exact selectors / API paths
- venue fields expected
- recurring-series logic
- dry-run validation commands

That is the right bridge from this brief into code.
