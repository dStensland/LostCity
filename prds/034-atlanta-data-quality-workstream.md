# PRD 034: Atlanta Data Quality Workstream

**Status**: Active  
**Scope**: Atlanta only  
**Surface**: Data layer / crawler operations  
**Mode**: Autonomous execution until blocked  
**Updated**: 2026-03-11

## Why This Exists

Atlanta is past the stage where one more ad hoc crawler fix changes the whole
picture.

The remaining work is now a repeatable data-quality program:

- repair polluted or misleading enrichment fields
- expand high-value planning intelligence where first-party sources support it
- keep feed quality moving without reintroducing noise
- avoid spending cycles on weak sites that only yield hours or identity

This document is the execution contract for the remainder of the current
Atlanta pass. The goal is to remove the need for manual “continue” prompts.

## Working Rule

Unless blocked by one of the explicit stop conditions below, work should
continue in order through the queued batches in this document.

That means:

1. pick the highest-priority open batch
2. execute a small, reviewable tranche
3. verify live results
4. record what changed materially
5. move to the next open batch

Do not stop just because a batch is complete.

## Interrupt / Stop Conditions

Execution should stop only if one of these is true:

1. a schema change is required
2. a source is blocked and needs a different environment or human relationship
3. repo changes appear that conflict with this workstream
4. a batch produces only low-signal metadata wins and the lane should be
   reranked
5. the next action would clearly be lower leverage than preparing a fresh
   ranked shortlist

If none of those are true, continue.

## Current Product Frame

Atlanta quality is now managed across four practical data lanes:

1. **Feed integrity**
   Event and exhibit coverage must be current, correctly classified, and free
   of crawler-caused zeros.

2. **Destination intelligence**
   Venues must be useful for planning, not just present in the database.

3. **Hospitality / hangs utility**
   Bars, restaurants, breweries, and social venues should surface useful
   before/after guidance and recurring operational value without polluting the
   event feed.

4. **Mobility and friction reduction**
   Parking, transit, walkability, access, and venue-policy friction need to be
   trustworthy enough to support hangs, concierge, and recommendation use.

## Current State Snapshot

This workstream starts from the current live state reached in the ongoing
Atlanta pass:

- museum-anchor and district-hub event coverage is materially better than the
  initial baseline
- hospitality planning-note coverage now has a working shared composer
- parking-note pollution has been identified as a real shared-system defect and
  the root cause is now partially repaired
- the remaining leverage is in quality cleanup and selective high-signal venue
  hydration, not blind broad sweeps

Known recent live wins:

- `tio-luchos` parking note repaired to clean OSM-backed mobility guidance
- `city-winery-atlanta` parking note repaired to clean OSM-backed mobility
  guidance
- `flight-club-atlanta` parking note now reflects validated parking guidance
- `painted-duck` parking note now reflects valet guidance
- `le-colonial-atlanta`, `storico-fresco`, `banshee-atlanta`, and `marys-bar`
  have usable planning-note coverage
- `529`, `terminal-west`, `variety-playhouse`, `blue-heron-nature-preserve`,
  `red-light-cafe`, `fox-theatre-atlanta`, `apache-cafe`,
  `gsu-convocation-center`, `buckhead-theatre`, and the Masquerade room rows
  all received cleaner parking-note coverage from the shared normalization path
- `monday-night-brewing-the-grove`, `high-museum-of-art`, and
  `cobb-galleria-centre` now correctly fall through to OSM-backed parking
  guidance instead of preserving bad scraped parking notes sourced from forms,
  member-marketing copy, or venue FAQ junk
- `boccalupo` now has a usable hospitality planning note centered on walk-ins
  vs reservations
- `puttshack-atlanta` now has a usable planning note with parking payment
  guidance
- `bold-monk-brewing` now has safe recurring `Weekend Brunch` coverage from the
  deterministic fallback path, with separate Saturday/Sunday recurring series
- shared venue creation is now hardened against event-field schema drift:
  - `crawlers/db/venues.py` strips event-only payload fields like `price_note`,
    `ticket_url`, and `start_date` before inserting into `venues`
  - regression coverage now exists in `crawlers/tests/test_db.py`
  - this closes the `PGRST204` venue-schema failures that briefly affected
    `skyview-atlanta` and `museum-of-illusions-atlanta`
- `roswell365` now rejects stale past dates before write logic, closing the
  archived-event leak that was inflating the crawl-error lane with bad source
  behavior
- sports participant backfill is now materially improved across Atlanta:
  - `atlanta-dream`, `atlanta-united-fc`, `atlanta-hustle`, `atlanta-vibe`,
    `atlutd-pubs`, `lovb-atlanta`, and `gwinnett-stripers` now have full
    participant coverage on future active events after source-level structured
    `_parsed_artists` support plus the shared sports backfill fix in
    `crawlers/db/events.py`
  - `georgia-tech-athletics` is now closed as a participant-gap source:
    older baseball/softball title variants are reconciled onto one canonical
    active row per date, stale same-slot variants are deactivated, and future
    active Georgia Tech rows now verify at `121/121` with participants
  - `atlanta-roller-derby` now emits structured team participants directly
    from parsed double-header bout strings and has full participant coverage on
    future active events
- shared parking-note cleanup now strips breadcrumb prefixes, footer noise,
  duplicate parking headers, and truncated address tails more reliably than the
  prior extractor behavior

Known remaining quality debt:

- several Atlanta rows still carry technically valid but user-hostile scraped
  `parking_note` blobs from the older shared path
- a subset of destination `planning_notes` remain noisy because those sites
  only expose hours-heavy or promo-heavy first-party copy
- `world-of-coca-cola` still has a short parking-garage-address note because
  the stored row predates the newer extractor and the current website path does
  not produce a stronger parking extract on demand
- the latest Lane A validation batch on `1655-mclendon-ave-ne`,
  `silom-thai-sushi-bar`, `dads-garage`, `symphony-hall`,
  `atlanta-symphony-hall`, `auburn-avenue-research-library`, and
  `hard-rock-cafe-atlanta` mostly produced timestamp churn or confirmed weak
  but already-stable notes rather than new user-facing quality wins
- the latest Lane B hospitality batches were also low-yield overall:
  `the-optimist(-atlanta)`, `petit-chou`, `marcus-bar-grille`,
  `taste-wine-bar-and-market`, and `south-city-kitchen-buckhead` did not yield
  meaningful hospitality planning notes, while `fia-restaurant-buckhead`
  produced a mostly hours-heavy note
- the latest Lane C verification batch also underperformed: `schwartz-center`,
  `the-earl`, `tara-theatre`, and `limelight-theater` still have no
  `planning_notes`, while `gwcca` is not a valid venue slug in the current
  Atlanta venue set
- refreshed March 11 Atlanta scorecard now reports `18685` visible future
  events and `70` active specials, but the launch gate still fails on
  `24h crawl error rate = 17.4%` and `Active specials total = 70`
- follow-up dry-runs confirmed that `ameris-bank-amphitheatre`,
  `piedmont-park`, `ridgeview-institute`, and `lakewood-amphitheatre` are all
  currently healthy, so the crawl-error gate now looks mostly like transient
  24h noise plus the already-fixed `roswell365` defect rather than a large pool
  of active crawler breakage
- March 11 duplicate cleanup is now live:
  - future `spruill-center` rows were consolidated onto
    `spruill-center-for-the-arts`
  - legacy source `spruill-center` is now inactive
  - the visible `buckhead-theatre` / `ticketmaster` overlap was deactivated
  - duplicate audit grouping now uses time-sensitive keys for class-like
    categories, so same-day class sections are no longer mis-scored as
    duplicates
- `springs-cinema` is now fixed and live again:
  - GraphQL auth header capture no longer depends on a single operation name
  - the source last crawled successfully on March 11, 2026
  - live source state now shows `277` active future rows on or after March 11,
    2026
- `georgia-general-assembly` was a real crawl-error source:
  - it had two stale shared-helper calls in the crawler
  - `smart_update_existing_event(existing["id"], ..., existing_event=...)`
    was replaced with the current shared contract
  - `remove_stale_source_events(..., start_date=...)` was replaced with the
    current shared contract
  - canceled/postponed legislative notices are now skipped at extraction time
    instead of being routed into an invalid event ticket-status state
  - targeted regression coverage now exists in
    `crawlers/tests/test_georgia_general_assembly.py`
  - dry-run now completes cleanly at `38 found, 21 new, 17 updated`
- the March 11 participant gap drilldown is no longer a broad sports lane:
  - `atlanta-dream`, `atlanta-united-fc`, `atlanta-hustle`, `atlanta-vibe`,
    `atlutd-pubs`, `lovb-atlanta`, `gwinnett-stripers`, and
    `atlanta-roller-derby` are now effectively closed
  - `georgia-tech-athletics` is now also closed after the same-slot
    baseball/softball reconciliation pass
  - the remaining participant-gap list is now long-tail music/film/nightlife,
    not an Atlanta sports-coverage defect
- follow-up crawl-error verification on March 11:
  - `hard-rock-cafe-atlanta` dry-run and live run both completed cleanly at
    `3 found, 0 new, 3 updated`
  - `atlanta-film-society` dry-run and live run both completed cleanly at
    `19 found, 0 new, 19 updated`
  - `skyview-atlanta` and `museum-of-illusions-atlanta` both now have fresh
    successful live crawl logs after the earlier `venues.price_note` schema
    cache error
  - `georgia-general-assembly` now also has a fresh successful live run at
    `38 found, 0 new, 38 updated`, so its March 11 error volume is now
    confirmed as stale-window telemetry rather than an active broken source
  - `center-stage` and `commune` previously looked like slow/noisy 24h runs,
    not reproduced hard failures
  - the current crawl-error blocker increasingly looks like rolling-window
    telemetry lag rather than a large pool of active broken sources
- `rei-atlanta` has been taken out of the active crawl queue:
  - dry-run reproduces a Playwright `net::ERR_HTTP2_PROTOCOL_ERROR` on
    `https://www.rei.com/events?location=Atlanta%2C+GA`
  - direct runtime fetches against the REI events surface return `403`
  - this is a source-access / anti-bot problem, not an extraction bug
  - source row `1328` is now inactive with `expected_event_count = 0`, so it
    no longer belongs in the active Atlanta rehab queue unless REI exposes a
    reachable surface later
- Anthropic credits remain unavailable, so specials rollout is currently
  limited to deterministic fallback sites; broad `venue_specials` growth is
  therefore constrained until either credits return or more explicit
  first-party weekly-offer pages are found
- the last fallback-only specials discovery batch (`buckhead-saloon`,
  `friends-on-ponce`, `jojos-beloved-cocktail-lounge`, `steady-hand-beer`,
  `taste-wine-bar-and-market`) produced no additional specials wins, confirming
  that the current broad specials lane is temporarily bottlenecked on external
  LLM access plus sparse first-party offer copy

## Execution Lanes

### Lane A: Invalid Parking / Mobility Note Cleanup

Purpose:
- remove misleading scraped `parking_note` values and replace them with either
  cleaner scraped guidance or OSM-backed mobility notes

What belongs here:
- `parking_note` values polluted by event promo, review blobs, reservation copy,
  page chrome, or policy-page lead-ins
- rows where `parking_source='scraped'` but the note is not actually
  parking-focused

Batch size:
- `4-8` venue slugs per pass

Entry criteria:
- note fails shared parking-note validation, or
- note is visibly user-hostile even if technically parking-related

Success criteria:
- repaired note is clearly parking-specific and user-facing, or
- stale invalid note is cleared and replaced by valid OSM fallback, or
- stale invalid note is cleared to `null` when no defensible replacement exists

Current queued targets:

1. `world-of-coca-cola` only if a stronger first-party parking extract path is found
2. `symphony-hall` only if a more specific first-party garage snippet can be isolated
3. `atlanta-symphony-hall` only if a more specific first-party garage snippet can be isolated
4. otherwise rerank to Lane B

### Lane B: Hospitality Planning-Note Expansion

Purpose:
- increase real hangs / before-after usefulness for food, bar, brewery, and
  nightlife venues that expose first-party reservation or policy signals

What belongs here:
- reservation guidance
- walk-in guidance
- patio / seating / after-hours / dress-code notes
- concise hospitality policy notes

Batch size:
- `3-6` venue slugs per pass

Entry criteria:
- site exposes clear first-party signals like reservations, patio, after-hours,
  dress code, valet, or private dining

Success criteria:
- note is concise, source-backed, and useful for decision-making
- no hours-only or address-only notes are accepted

Current queued targets:

1. `boccalupo` only if note cleanup is needed
2. `puttshack-atlanta` only if note cleanup is needed
3. otherwise rerank to Lane E

### Lane C: Event-Led Destination Planning Coverage

Purpose:
- improve event-led venues where weekly hours matter less than arrival and
  friction information

What belongs here:
- theaters
- clubs
- music venues
- performance venues
- event-led mixed-use anchors

Batch size:
- `4-8` venue slugs per pass

Entry criteria:
- venue has consumer relevance and a reachable first-party logistics surface

Success criteria:
- notes meaningfully help with arrival, access, parking, doors, policies, or
  will-call/security questions

Current queued targets:

1. pause this lane unless a new venue-specific logistics surface is identified
2. do not retry `gwcca` under that slug; verify canonical venue mapping first
3. rerank to Lane E after the next scorecard refresh

### Lane D: Specials / Recurring Offer Selective Rollout

Purpose:
- expand operational nightlife and food utility without polluting the main
  event feed

What belongs here:
- weekly recurring offers with clear first-party copy
- `venue_specials` and recurring operational series

Batch size:
- `2-4` venues per pass

Entry criteria:
- first-party offer text is explicit enough to survive deterministic fallback

Success criteria:
- no malformed recurring series
- no participant inference
- no parked-domain or promo-only false positives

Current queued targets:

1. `bold-monk-brewing` follow-up complete
2. find one more deterministic fallback win
3. if none is found quickly, rerank away from broad specials rollout until
   Anthropic credits return

### Lane E: Cleanup Audit / Reranking

Purpose:
- prevent the workstream from drifting into low-signal batches

What belongs here:
- reranking venue lists after shared extractor improvements
- checking that repaired rows actually improved live data
- closing lanes that are no longer yielding

Trigger:
- after every `2-3` meaningful batches, or
- earlier if one batch mostly yields identity/hours only

Success criteria:
- next queue is still the highest-leverage path

## Batch Protocol

Every batch should follow this exact protocol:

1. choose the highest-priority open lane
2. build a small shortlist from live data or first-party inspection
3. apply shared code fix first if the defect is systemic
4. run targeted tests
5. run targeted live enrichment or source crawl
6. verify live rows directly
7. record whether the batch was:
   - a real quality win
   - identity-only / mobility-only
   - blocked
   - exhausted / low-signal

If a batch is mostly identity-only, rerank instead of broadening it.

## What Counts As a Real Win

A batch counts as a real win only if at least one of these is true:

1. a broken or polluted field is repaired in production
2. a venue gains useful `planning_notes`
3. a venue gains trustworthy `parking_note` / mobility data
4. a source yields materially more correct future inventory
5. a blocked or destination-first source is explicitly and correctly
   reclassified

These do **not** count as real wins by themselves:

- only adding Foursquare IDs
- only re-verifying hours timestamps
- only changing phone when phone already existed
- broad runs that produce no user-facing improvement

## Current Queue Order

Execution should proceed in this order unless new live evidence reranks it:

1. **Lane A**
   Continue only on rows where a stronger parking source or more specific
   first-party snippet is likely. Do not broad-sweep the remaining “valid but
   mediocre” notes.

2. **Lane B**
   Pause broad hospitality expansion until a fresh shortlist is justified by
   live evidence. Keep only clearly high-signal note opportunities.

3. **Lane C**
   Keep closed unless new live evidence shows a reachable first-party logistics
   surface with better signal than the current exhausted shortlist.

4. **Lane D**
   Keep only opportunistic deterministic wins here until Anthropic credits
   return. Do not treat this as the primary execution lane while external
   access remains constrained.

5. **Lane E**
   This is now the active next step. Regenerate the Atlanta scorecard and
   rerank the backlog after the latest feed-integrity closeout and exhausted
   Lane C check.

6. **Feed Integrity Re-entry**
   This is now the active next step. `roswell365` is fixed, and the remaining
   task is to verify whether any current crawl-error sources are still true
   defects before spending more time on low-yield enrichment lanes.

7. **Duplicate / Error Rerank**
   After the March 11 cleanup, visible duplicate groups are now `0`. The
   controlling queue is the refreshed crawl-error shortlist:
   - `center-stage`
   - `commune`
   - `hard-rock-cafe-atlanta`
   - `atlanta-film-society`
   - `georgia-general-assembly`

8. **Participant Residue**
   The broad sports-participant lane is now closed. Only continue here when:
   - a source still has structured matchup data available but is not emitting
     participants, or
   - a residual gap is concentrated enough to justify a source-specific fix

   Current queued target:
   - none; rerank to feed integrity or specials

## Deliverables

This workstream should keep producing three things:

1. improved live Atlanta rows
2. small shared extractor/enricher fixes with tests
3. periodic scorecard refreshes against:
   - [`/Users/coach/Projects/LostCity/prds/033-atlanta-coverage-execution-plan.md`](/Users/coach/Projects/LostCity/prds/033-atlanta-coverage-execution-plan.md)
   - [`/Users/coach/Projects/LostCity/crawlers/reports/content_health_assessment_2026-03-10_city-atlanta.md`](/Users/coach/Projects/LostCity/crawlers/reports/content_health_assessment_2026-03-10_city-atlanta.md)

## Completion Criteria

This workstream is complete only when one of these is true:

1. the remaining Atlanta venue-quality issues are mostly upstream-content
   constraints rather than our shared extraction logic
2. the next best lane requires schema work or a new product contract
3. the current queue has been exhausted and reranking produces only low-value
   identity-only work

Until then, continue automatically against the next open batch.
