# PRD 043: Atlanta Third-Space Wave 1 Source Matrix

**Portal:** `atlanta`
**Surface:** `consumer`
**Status:** Technical handoff
**Last Updated:** 2026-04-01
**Depends on:** `prds/041-atlanta-third-space-source-pack.md`, `prds/042-atlanta-third-space-wave1-execution-checklist.md`

---

## Purpose

This document turns the Wave 1 checklist into an implementation matrix an agent
can execute without repeating discovery work.

It answers:

- which file should change
- whether the source is new or existing
- which source slug to use
- which fields are required
- which extraction surfaces matter
- which recurring patterns should become series
- which blockers are known already

---

## Wave 1 Matrix

| Source | Mode | File target | Slug | Priority | Main value |
|---|---|---|---|---|---|
| Community Grounds | New | `crawlers/sources/community_grounds.py` | `community-grounds` | P0 | Destination-first third-space anchor |
| Charis Books & More | Existing + activate/harden | `crawlers/sources/charis_books.py` | `charis-books` | P0 | Recurring low-pressure social pattern |
| Atlanta Central Library | Upgrade | `crawlers/sources/fulton_library.py` | `fulton-library` | P1 | Civic / youth / public indoor third-space enrichment |
| Atlanta BeltLine | Upgrade | `crawlers/sources/atlanta_beltline.py` | `atlanta-beltline` | P1 | Public-space recurring infrastructure |

---

## Common Requirements

Every Wave 1 source should produce:

- complete `VENUE_DATA`
- source-backed `description`
- `image_url`
- structured `hours` if present
- recurring-series logic where official source signal is clear
- no fake certainty around social traits

Every source should also preserve evidence for later scoring:

- community language
- free or low-cost cues
- family cues
- evening viability
- meeting-space or linger cues

---

## 1. Community Grounds

### File target

`crawlers/sources/community_grounds.py`

### Source registration

Needs a new `sources` row.

### Canonical URLs

- `https://communitygrounds.com/`
- `https://communitygrounds.com/products`
- `https://communitygrounds.com/reservations`

### Venue contract

Recommended `VENUE_DATA` shape:

```python
VENUE_DATA = {
    "name": "Community Grounds",
    "slug": "community-grounds",
    "address": "1297 McDonough Blvd SE",
    "neighborhood": "South Atlanta",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30315",
    "venue_type": "coffee_shop",
    "spot_type": "coffee_shop",
    "website": "https://communitygrounds.com/",
    "vibes": ["community", "coffee", "third-space", "conversation"],
}
```

Lat/lng should be filled if available from existing geocoding helpers or source
resolution flow.

### Must-capture fields

- address
- hours
- homepage description
- image
- nonprofit ownership
- conference-room reservation cue
- specials menu signal

### Extraction surfaces

- homepage JSON-LD:
  - `WebSite.description`
  - `Organization.address`
  - `LocalBusiness.openingHours`
- homepage visible sections:
  - `About Us`
  - `Our Hours`
  - `Specials`
- reservation page:
  - conference-room / meeting-space language

### Recommended parser shape

- `requests`
- `BeautifulSoup`
- JSON-LD first
- visible text fallback second

### Expected outputs

- destination record
- venue details / features if current pipeline supports them
- possibly `venue_specials`

### Recurring logic

None required in Wave 1.

This source should explicitly ship as `destination-first` unless an official
event surface is discovered later.

### Open questions

- best neighborhood normalization: `South Atlanta` vs more specific local label
- whether specials belong in `venue_specials` immediately or can wait for a
  later lane

### Failure conditions

- shipping a crawler that outputs no hours despite official hours being present
- inventing events from weak brochure copy

---

## 2. Charis Books & More

### File target

`crawlers/sources/charis_books.py`

### Source registration

Likely needs a `sources` row registration migration.

Existing artifacts already present:

- [crawlers/sources/charis_books.py](/Users/coach/Projects/LostCity/crawlers/sources/charis_books.py)
- [crawlers/sources/profiles/charis-books.yaml](/Users/coach/Projects/LostCity/crawlers/sources/profiles/charis-books.yaml)

No matching migration hit was found during this research pass.

### Canonical URLs

- `https://charisbooksandmore.com/upcoming-events`
- `https://charisbooksandmore.com/events`
- `https://charisbooksandmore.com/event/<date>/<slug>`

### Venue contract

Recommended `VENUE_DATA` shape:

```python
VENUE_DATA = {
    "name": "Charis Books & More",
    "slug": "charis-books",
    "address": "184 S Candler St",
    "neighborhood": "Downtown Decatur",
    "city": "Decatur",
    "state": "GA",
    "zip": "30030",
    "venue_type": "bookstore",
    "spot_type": "bookstore",
    "website": "https://charisbooksandmore.com/",
    "vibes": ["bookstore", "community", "discussion", "queer", "feminist"],
}
```

### Must-capture fields

- event title
- date
- start time / end time when present
- place
- event tags
- detail URL
- RSVP URL if present
- in-store vs virtual distinction

### Extraction surfaces

Listing page:

- row container: `.views-row`
- title: `h3.event-list__title a`
- tags: anchors under `/events/tags/`
- detail links: anchors under `/event/`

Detail pages:

- title: `h1.event-details__info--title`
- additional description and RSVP support

### Recommended parser shape

- parse listing page first
- follow detail pages only when description, RSVP, or structure is missing
- avoid over-fetching every detail page if listing rows already contain enough
  structured content

### Category / recurrence rules

One-off:

- author talks
- launches
- single-date conversations

Recurring-series candidates:

- book clubs
- repeat support/discussion groups
- repeat youth/adult group meetings

Recommended `series_hint` types:

- `recurring_show` for discussion groups and clubs
- `other` only if format is genuinely repeating but does not fit existing types

### Expected outputs

- bookstore destination record
- event records
- recurring series where warranted

### Open questions

- whether virtual events should remain attached to Charis as organizer or be
  filtered for destination-first experiences only
- whether tags like `online` should suppress destination-intelligence scoring

### Failure conditions

- every book-club instance lands as disconnected event clutter
- in-store and online formats are mixed together without clear tagging

---

## 3. Atlanta Central Library

### File target

`crawlers/sources/fulton_library.py`

### Source registration

No new source row needed if `fulton-library` is already active.

### Canonical URLs

- locations API:
  `https://gateway.bibliocommons.com/v2/libraries/fulcolibrary/locations`
- events API:
  `https://gateway.bibliocommons.com/v2/libraries/fulcolibrary/events`
- branch page:
  `https://www.fulcolibrary.org/central-library/`

### Current strength

The existing source already does the hard part:

- paginated BiblioCommons ingestion
- branch venue creation
- category inference
- branch destination envelope persistence

### Wave 1 upgrade target

Make Central Library materially stronger than a generic branch.

### Must-capture Central-specific signals

- branch description
- branch image if current source lacks one
- meeting-room signal
- Best Buy Teen Tech Center signal
- public indoor destination value

### Recommended implementation shape

- keep API event ingestion unchanged
- add branch-page enrichment for Central-specific destination detail
- keep branch-level venue creation model

### Recommended branch feature outputs

- `meeting rooms`
- `teen tech center`
- `free public programming`
- `indoor family / solo hang`

### Recurring logic

Keep existing BiblioCommons recurrence handling.

Do not special-case Central event recurrence unless the API or source labels
make it necessary.

### Open questions

- whether branch-page image quality is good enough for `image_url`
- whether branch-specific hours are in API, branch page, or both

### Failure conditions

- breaking the existing shared Fulton Library event source
- creating a Central-only crawler that duplicates branch events

---

## 4. Atlanta BeltLine

### File target

`crawlers/sources/atlanta_beltline.py`

### Source registration

Likely already active.

### Canonical URLs

- `https://beltline.org/events/`
- `https://beltline.org/things-to-do/fitness/run-club/`
- `https://beltline.org/visit/`

### Current strength

The source already:

- uses Playwright for rendered event cards
- creates a BeltLine destination record
- persists destination detail / feature envelope

### Wave 1 upgrade target

Promote recurring BeltLine infrastructure, especially Run Club, from generic
event output into clearer recurring series.

### Must-capture fields

- event title
- date
- time
- source URL
- image where available
- recurring Run Club cadence if explicit
- free/public-access cues

### Extraction surfaces

Listing page:

- rendered `a[href*='/events/']`
- card text lines for date and title

Supporting page:

- `run-club` page for recurring cadence and meeting details

### Recommended implementation shape

- preserve current Playwright listing flow
- add a targeted supporting-page read for recurring Run Club metadata
- do not replace working list parsing with a speculative API hunt unless a
  stable API is confirmed

### Recurring logic

Recommended:

- Run Club should use `series_hint`
- recurring BeltLine public activations should become series when cadence is
  explicit

Avoid:

- marking all BeltLine events recurring by default

### Open questions

- whether Run Club is better represented as recurring events or a stronger
  destination feature plus one canonical recurring series
- whether detail pages expose richer structured metadata than current card-only
  parsing

### Failure conditions

- regressing current event yield
- flattening the BeltLine into a normal single-venue model

---

## Source Activation / Ops Notes

For the two new sources:

- `community-grounds`
- `charis-books`

execution will also require:

- source-row creation or activation
- dry-run validation
- ownership decision consistent with Atlanta shared-layer logic

Recommended ownership:

- Atlanta portal ownership, not a separate third-space source pack owner

Why:

- these are broadly useful Atlanta facts
- they should enrich the shared Atlanta layer
- no new silo should be introduced

---

## Recommended Engineering Sequence

### Step 1

Implement `community_grounds.py`

Why:

- smallest ambiguity
- clean destination-first proof
- minimal recurring-series complexity

### Step 2

Implement `charis_books.py`

Why:

- strongest recurring-program pattern in Wave 1
- fastest proof of low-pressure social recurrence

### Step 3

Upgrade `fulton_library.py` for Central-specific enrichment

Why:

- preserves existing API pipeline
- adds civic / youth hangout value without re-architecting

### Step 4

Upgrade `atlanta_beltline.py` for Run Club recurrence

Why:

- public-space recurring infrastructure is important, but current source already
  has a useful baseline

---

## Acceptance Gate

Wave 1 is ready to review when:

- both new sources dry-run cleanly
- both upgrade sources preserve prior yield
- Community Grounds ships with strong destination data despite thin event
  surface
- Charis cleanly distinguishes recurring clubs from one-off talks
- Central gets stronger branch-specific destination intelligence
- BeltLine preserves event yield while improving recurring public-program shape
