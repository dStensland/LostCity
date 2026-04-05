# PRD 042: Atlanta Third-Space Wave 1 Execution Checklist

**Portal:** `atlanta`
**Surface:** `consumer`
**Status:** Execution checklist
**Last Updated:** 2026-04-01
**Depends on:** `prds/041-atlanta-third-space-source-pack.md`, `crawlers/CLAUDE.md`

---

## Purpose

This document converts the Wave 1 third-space brief into an implementation
sequence for the first four sources:

- Community Grounds
- Charis Books & More
- Atlanta Central Library
- Atlanta BeltLine

The goal is not generic crawler planning.

The goal is source-specific execution:

- exact source URLs
- extraction shape
- likely selectors or API paths
- what counts as success
- what should *not* be forced

---

## Strategic Rule

Wave 1 should prove that third-space intelligence can come from two different
implementation modes:

1. `destination-first sources`
2. `destination + recurring-program sources`

Do not force every source into the same pattern.

That matters immediately for Community Grounds, whose official site provides
strong destination signal but does **not** currently expose a reliable first-
party event calendar.

---

## Current Repo Reality

Wave 1 is not four blank-slate crawlers.

### Existing source files already in repo

- [crawlers/sources/atlanta_beltline.py](/Users/coach/Projects/LostCity/crawlers/sources/atlanta_beltline.py)
- [crawlers/sources/fulton_library.py](/Users/coach/Projects/LostCity/crawlers/sources/fulton_library.py)
- [crawlers/sources/charis_books.py](/Users/coach/Projects/LostCity/crawlers/sources/charis_books.py)

### Implication

- `Atlanta BeltLine` is an upgrade / hardening task, not a net-new crawler
- `Atlanta Central Library` should be implemented inside the existing Fulton
  Library source, not as a separate crawler
- `Charis Books & More` already has crawler/profile artifacts and should be
  treated as an activation + quality-hardening task unless the existing source
  proves unusable
- `Community Grounds` is the true net-new source pattern in this wave

---

## Launch Bar

Wave 1 is successful when:

- all four sources produce strong destination records
- at least three of the four produce recurring-program or recurring-series
  signal
- no source ships with empty destination fields that are clearly present on the
  official site
- no source pollutes the feed with operational noise or cloned recurring events
- dry-run validation passes for every implemented or upgraded source

---

## Source 1: Community Grounds

### Implementation Mode

`new crawler`

### Recommended slug

`community-grounds`

### Source URLs

- primary: `https://communitygrounds.com/`
- supporting: `https://communitygrounds.com/products`
- supporting: `https://communitygrounds.com/reservations`
- sitemap: `https://communitygrounds.com/sitemap.xml`

### Current live shape

Official site is a Squarespace brochure-style site with:

- homepage sections for `About Us`, `Our Hours`, `Specials`
- JSON-LD with description, address, and opening hours
- a conference-room reservation page
- no credible first-party event calendar discovered from site navigation or
  sitemap

### Concrete extraction targets

Destination facts:

- business name
- street address
- city/state/zip
- hours
- description
- image
- coffee-shop venue type
- community / nonprofit framing
- conference-room / meeting-space cue

Useful evidence:

- explicit `"Third Space"` language from homepage JSON-LD / About section
- `Focused Community Strategies` nonprofit ownership
- conference-room reservation capability
- specials section

### Likely extraction strategy

- plain `requests + BeautifulSoup` is sufficient
- parse JSON-LD first for:
  - `LocalBusiness.openingHours`
  - `Organization.address`
  - homepage description copy
- fallback to visible homepage text for hours and About copy

### Likely selectors / paths

- JSON-LD scripts: `script[type='application/ld+json']`
- headings: `h2`, `h3`
- About section text containing `About Us`
- hours text containing `Our Hours`
- reservations page title `Conference Room Reservations`

### What to capture in first pass

- `VENUE_DATA` complete
- `description` with third-space/community language
- `hours` as structured JSON
- `image_url`
- `venue_specials` candidates from homepage drinks/specials section
- destination evidence for:
  - community
  - conversation
  - meeting space
  - nonprofit / neighborhood anchor

### What not to force

Do **not** fabricate event or recurring-program extraction from weak clues.

Current official site evidence supports a strong destination-first crawler.
If recurring programming is not exposed on the official site, phase 1 should
ship without it.

### Success criteria

- strong destination record with hours, description, image, and meeting-space
  signal
- specials captured if feasible
- no fake event output

### Dry-run command

```bash
cd crawlers
python3 main.py --source community-grounds --dry-run
```

---

## Source 2: Charis Books & More

### Implementation Mode

`existing crawler + activation / quality pass`

### Recommended slug

`charis-books`

### Source URLs

- listing page: `https://charisbooksandmore.com/upcoming-events`
- calendar page: `https://charisbooksandmore.com/events`
- detail pages: `https://charisbooksandmore.com/event/<date>/<slug>`

### Current live shape

The site exposes a clean server-rendered event list.

Observed structure:

- listing rows use `.views-row`
- titles appear in `h3.event-list__title`
- rows include:
  - title
  - date
  - time
  - place
  - taxonomy tags like `Book Club` or `In-Store Only Event`
  - detail-page links
  - occasional external RSVP links

Repo note:

- an existing crawler already lives at
  [crawlers/sources/charis_books.py](/Users/coach/Projects/LostCity/crawlers/sources/charis_books.py)
- an existing profile already lives at
  [crawlers/sources/profiles/charis-books.yaml](/Users/coach/Projects/LostCity/crawlers/sources/profiles/charis-books.yaml)
- no matching migration hit was found during this research pass, so the likely
  missing piece is source registration / activation rather than file creation

### Concrete extraction targets

Destination facts:

- bookstore destination record
- in-store community framing
- Decatur address
- image / og:image
- description from site metadata or About page if needed

Event / recurring-program facts:

- title
- date
- start/end time
- place
- detail URL
- RSVP URL if present
- tags / taxonomy
- virtual vs in-store flag
- free vs registration-required cues

Recurring-series candidates:

- book clubs
- recurring youth or adult groups
- repeat community formats

### Likely extraction strategy

- `requests + BeautifulSoup`
- parse `https://charisbooksandmore.com/upcoming-events`
- iterate `.views-row`
- follow detail pages only when listing rows do not provide enough description
  or RSVP detail

### Likely selectors / paths

- row container: `.views-row`
- title: `h3.event-list__title a`
- all row text for date/time/place extraction
- tags: links under `/events/tags/`
- detail link pattern: `/event/`
- RSVP links: external `https://` anchors within row or detail page

### Classification guidance

- in-store book clubs and recurring discussion groups should become
  `series_hint`
- one-off author conversations remain events
- virtual-only events should stay attached to Charis as organizer only if that
  matches existing source conventions

### Key risks

- Charis has high event volume; do not turn every recurring book club instance
  into disconnected feed clutter
- do not lose bookstore destination identity under event volume

### Success criteria

- healthy bookstore destination record
- reliable event extraction from `.views-row`
- recurring formats grouped where appropriate
- clean handling of in-store vs virtual

### Dry-run command

```bash
cd crawlers
python3 main.py --source charis-books --dry-run
```

---

## Source 3: Atlanta Central Library

### Implementation Mode

`upgrade existing source`

### Existing source

[crawlers/sources/fulton_library.py](/Users/coach/Projects/LostCity/crawlers/sources/fulton_library.py)

### Important rule

Do **not** create a separate `central-library` crawler file.

Central Library should be implemented as a scoped improvement inside the
existing Fulton Library BiblioCommons source.

### Source URLs / API paths

- locations API: `https://gateway.bibliocommons.com/v2/libraries/fulcolibrary/locations`
- events API: `https://gateway.bibliocommons.com/v2/libraries/fulcolibrary/events`
- branch page: `https://www.fulcolibrary.org/central-library/`
- event detail URL pattern:
  `https://fulcolibrary.bibliocommons.com/events/<event_id>`

### Current repo behavior

`fulton_library.py` already:

- pulls BiblioCommons locations
- pulls paginated events
- maps events to branch venues
- writes destination details and venue features for branches

### Wave 1 upgrade targets

Central-specific destination improvements:

- ensure Central Library venue record has:
  - strong description
  - image
  - explicit hours where available
  - teen-tech-center and meeting-room signal when supported by official pages

Central-specific evidence targets:

- free indoor hang
- meeting rooms
- Best Buy Teen Tech Center
- public programming

### Recommended implementation shape

Keep API-driven event ingestion in `fulton_library.py`.

Add a branch-aware destination enrichment layer for Central specifically using:

- official branch page content
- current destination envelope support already present in source

### Likely extraction strategy

- keep BiblioCommons API for events
- add a lightweight branch-page scraper for Central page-only metadata that the
  API does not expose

### Likely selectors / paths

- API pagination already uses:
  - `LOCATIONS_URL?page=<n>&pageSize=50`
  - `EVENTS_URL?page=<n>&pageSize=50`
- branch page title:
  - `Central Library Home | Fulton County Library System`
- branch-page text cues:
  - `Best Buy Teen Tech Center`
  - `meeting room`
  - department / featured area language

### What to capture in first pass

- branch venue completeness
- branch-specific hours if available
- branch-specific features:
  - teen space
  - meeting room
  - public programming
- existing event API output retained

### What not to do

- do not fork Central into a standalone source unless the shared Fulton source
  becomes unworkable
- do not replace API extraction with brittle HTML-only scraping

### Success criteria

- Central Library becomes a clearly useful destination even independent of event
  feed rows
- existing Fulton Library event extraction remains healthy
- Central-specific destination details improve beyond generic branch handling

### Dry-run command

```bash
cd crawlers
python3 main.py --source fulton-library --dry-run
```

---

## Source 4: Atlanta BeltLine

### Implementation Mode

`upgrade existing source`

### Existing source

[crawlers/sources/atlanta_beltline.py](/Users/coach/Projects/LostCity/crawlers/sources/atlanta_beltline.py)

### Source URLs

- events page: `https://beltline.org/events/`
- run club page: `https://beltline.org/things-to-do/fitness/run-club/`
- visit page: `https://beltline.org/visit/`

### Current repo behavior

`atlanta_beltline.py` already:

- uses Playwright against `/events/`
- writes a BeltLine destination envelope
- extracts event links from the rendered page
- maps event category/tags heuristically

### Wave 1 upgrade targets

Destination improvements:

- keep BeltLine as a destination-system record
- make sure destination details reflect public-space and trail-system reality
- keep free-entry and neighborhood/trail exploration language

Recurring-program improvements:

- explicitly capture Run Club as recurring infrastructure
- use `series_hint` where BeltLine recurring formats are clear
- avoid treating repeat public activations as disconnected one-offs when the
  source clearly represents a series

### Likely extraction strategy

- keep Playwright for `/events/`
- add a targeted fetch for the Run Club page if recurring cadence is clearer
  there than on generic event cards

### Likely selectors / paths

Current crawler already relies on:

- links matching `a[href*='/events/']`
- card text lines for:
  - month
  - day
  - title
  - time

Likely supporting page pattern:

- run-club page text for cadence, meeting location, and registration/newsletter
  cues

### What to capture in first pass

- BeltLine destination details
- recurring Run Club series
- free/public access signal
- public-space / connected-neighborhood value

### Key risks

- BeltLine is a system, not a normal venue
- event cards can be sparse
- recurring formats may have stronger signal on detail pages than listing cards

### Success criteria

- destination record remains strong
- recurring public programs are represented as recurring
- no degradation of current event extraction

### Dry-run command

```bash
cd crawlers
python3 main.py --source atlanta-beltline --dry-run
```

---

## Build Order

Implement Wave 1 in this order:

1. `Community Grounds`
2. `Charis Books & More`
3. `Atlanta Central Library` upgrade
4. `Atlanta BeltLine` upgrade

### Why this order

- Community Grounds proves destination-first third-space capture
- Charis proves a high-signal recurring-program pattern
- Central proves branch-aware civic destination enrichment on an existing API
  source
- BeltLine proves public-space recurring-series handling on an existing
  destination-system source

This sequence gives the fastest pattern coverage with the least ambiguity.

---

## Verification Checklist

For each source:

- run source dry-run
- confirm destination object is complete
- confirm image and description are source-backed
- confirm hours are captured when present
- confirm recurring programming is grouped when the source clearly supports it
- confirm no low-signal operational spam enters the feed

For the two upgrade sources:

- verify existing production-worthy behavior does not regress

---

## Follow-On If Wave 1 Lands Cleanly

After Wave 1, the next sources should be:

- Pittsburgh Yards
- Little Shop of Stories
- Museum of Design Atlanta
- Decatur Makers

That is the right second wave because it expands from:

- destination-first community anchor
- bookstore event pattern
- civic branch API pattern
- public-space system pattern

into:

- community hub
- family recurring programming
- maker / workshop participation
- membership-aware community access
