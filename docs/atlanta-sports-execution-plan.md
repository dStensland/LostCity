# Atlanta Sports Execution Plan

Surface: `consumer`
Portal context: Atlanta
Last updated: March 11, 2026

## Phase Framing

### Phase 1: Core Coverage and Cleanup

Status: `complete`

Phase 1 solved the obvious Atlanta sports identity problem:
- official spectator coverage is strong
- public-play exists as a real lane, not just attendance
- watch parties are viable
- sports groups/channels exist
- major placeholder and weak-owner cleanup is done

Phase 1 ended when Atlanta sports shifted from `buildout because it feels thin` to `maintenance unless a selective enrichment lane justifies more work`.

### Phase 2: Selective Enrichment

Status: `complete`

Phase 2 is not another crawler-count sprint. It exists to deepen user value where the remaining gaps are real, while routing adjacent inventory into the correct surface instead of forcing it into the sports feed.

Phase 2 has four lanes:
- sports groups maturity
- family/program sports handoff
- precision / quality hardening
- portal presentation upgrades

Phase 2 should stop if new work is mostly count inflation, outer-county drift, or inventory that belongs in another portal.

## Purpose

Turn Atlanta sports coverage into a tranche-based Atlanta-core workstream instead of a sequence of one-off crawler pushes.

This plan now reflects the current live state after the official ownership cleanup tranche. The remaining work is no longer "fix obvious team coverage gaps." It is:
- deepen Atlanta-core watch-party and sports-bar coverage
- expand in-city public-play sports beyond aquatics and pickleball
- separate join-first sports communities into a groups backlog
- only do narrow cleanup when it unlocks one of the first three

## Product Boundaries

### Feed

Include only sports inventory where the primary CTA is effectively `Attend`, `Watch`, `Go`, or `Show up`.

Allowed examples:
- home games
- official watch parties
- open play
- pickup
- drop-in sessions
- public rec-center programming
- public clinics
- try-it nights

### Groups

Anything whose primary CTA is `Join`, `Register`, `Apply`, `Get placed`, or `Be accepted` belongs in a groups/interest-groups surface, not the public feed.

Examples:
- rec leagues
- rostered clubs
- team placement programs
- captain-led league registration
- application-gated sports communities

### Exclude From Public Event View

Do not ship join-first inventory into the public feed just because it is sports-related.

Examples:
- screened leagues
- member-only sessions
- registration-only season play
- application-first participation programs

## Current Atlanta-Core State

As of March 11, 2026, Atlanta-core spectator coverage is strong and the broad duplicate cleanup tranche is mostly complete.

### Official Attendance Coverage

These are no longer the primary gap:

- `truist-park`: 81
- `georgia-tech-athletics`: 70
- `atlanta-dream`: 22
- `gsu-athletics`: 21
- `atlanta-gladiators`: 24
- `atlanta-united-fc`: 16
- `atlanta-hawks`: 9
- `atlanta-vibe`: 7
- `atlanta-hustle`: 6
- `georgia-swarm`: 4
- `lovb-atlanta`: 4
- `college-park-skyhawks`: 2
- `usmnt`: 2
- `georgia-bulldogs-baseball-atlanta`: 1

### Public-Play / In-City Participation Coverage

This lane is materially improved but still uneven by sport type:

- `atlanta-rec-center-open-gym`: 98
- `atlanta-aquatic-fitness`: 68
- `atlanta-adult-swim-lessons`: 54
- `atlanta-natatorium-open-swim`: 32
- `atlanta-rec-center-pickleball`: 30
- `atlanta-track-club`: 20
- `beltline-fitness`: 22
- `piedmont-fitness`: 25
- `blazesports`: 168

### Watch Parties / Sports Bars

This is now the thinnest Atlanta-core lane relative to how visible it is in the product:

- `atlutd-pubs`: 7
- `hawks-bars`: 2
- `sports-social`: 3

There is also sports-adjacent in-city venue inventory already present in general venue crawlers:

- `Dark Horse Tavern`: 21
- `New Realm Brewing`: 16
- `The Supermarket ATL`: 12
- `Atkins Park Restaurant & Bar`: 6
- `Midway Pub`: 6
- `Moe's and Joe's`: 6

These are real candidate foundations for Atlanta-core watch-party/bar deepening, but they are not yet a coherent sports-specific lane.

### Ownership Cleanup State

This lane is almost exhausted.

- Atlanta-core `ticketmaster` sports residuals are down to `1` real row:
  - `MLW Major League Wrestling - Fusion TV Taping`
- `Hawks vs ...` placeholder rows: `0`
- `georgia-tech-athletics` legacy `GT ...` rows: `0`
- `Spring Classic: Georgia vs. Georgia Tech` is officially owned
- `Men in Blazers` is only on the official `the-eastern` source

### Groups / Interest Channels

This lane is now viable for Atlanta sports without polluting the public feed.

Current high-signal channel set:
- `atlanta-watch-parties`
- `atlanta-public-play`
- `atlanta-run-clubs`
- `atlanta-aquatics`

Current sport-specific tranche:
- `atlanta-soccer-scene`
- `atlanta-basketball-scene`
- `atlanta-racquet-sports`
- `atlanta-ultimate-frisbee`

Current activity/community tranche:
- `atlanta-pickleball-community`
- `atlanta-cycling-community`

Deferred follow-up:
- `atlanta-adaptive-recreation` after the BlazeSports-to-Atlanta matching path is fully materializing

These should be backed only by high-signal Atlanta-core sources and narrow mixed-source expressions, not broad county rec catalogs or join-first league spam.

## Remaining Opportunity Map

### 1. Atlanta Sports Bars / Watch Parties

This is the highest-leverage remaining Atlanta-core feed gap.

Current state:
- official team-backed watch-party coverage exists, but only at low depth
- several in-city bars and mixed-use venues already surface sports-adjacent public rows
- the portal still does not feel rich on "where should I go watch the game?" outside a few sources

Target source families:
- official team bar networks and pub partner programs
- venue-owned recurring sports programming at in-city sports bars
- in-city bars with explicit watch-party or match-day event pages

### 2. Atlanta Proper Public-Play Sports Beyond Aquatics / Pickleball

This is the biggest remaining participation gap.

Current state:
- swim, aquatic fitness, open gym, and pickleball are now decent
- basketball, soccer/futsal, volleyball, tennis open play, batting cages, and similar "go do this" sports remain thin

Target source families:
- additional Atlanta DPR sports slices
- in-city park or facility pages with scheduled public play
- racquet, batting, or court operators only when they publish public dated inventory

### 3. Interest-Groups Sports Lane

This is probably the biggest remaining sports dataset overall, but it does not belong in the public feed.

Current state:
- logic boundary is clear
- data work is now started through high-signal Atlanta sports channels
- sport-specific channels should deepen from real Atlanta inventory before adding broad join-first league packs

Target source families:
- adult rec leagues
- pickup communities
- run clubs and sports clubs with explicit join flows
- tennis ladders and free-agent placement communities

### 4. Long-Tail Official Quality Fixes

This is no longer a main lane.

Examples:
- `atlanta-dream` still lacks tipoff times because it relies on a release asset
- one or two real official-owner orphans may still appear over time

This work should happen only when it is cheap or obviously high-signal.

## Phase 2 Lanes

### Lane E: Sports Groups Maturity

Goal:
- make the sports `groups` surface as credible as the sports `feed`

Scope:
- rec leagues
- pickup communities
- tennis ladders
- free-agent / join-first sports orgs
- neighborhood and scene-based sports communities

Output:
- stronger group-safe sourcing rules
- deeper group/channel definitions
- cleaner `Attend` vs `Join` separation

Success criteria:
- major Atlanta sports scenes have credible join-first community representation
- users can find sports communities without polluting the public feed

### Lane F: Family / Program Sports Handoff

Goal:
- move excluded sports inventory into the right product home instead of leaving it as dead-end residue

Scope:
- youth sports leagues
- structured swim lesson ladders
- family sports clinics
- seasonal sports programs

Output:
- a clean backlog or execution lane for Atlanta family/program sports
- fewer feed debates because non-feed inventory has a destination

Success criteria:
- family/program sports inventory no longer feels like "missing data" from the sports portal
- excluded inventory is intentionally routed, not simply ignored

Current tranche state:
- `hooky-swim-lessons` is live as `Swim & Aquatics` with `109` current matches
- `hooky-youth-sports` is live for youth ball-sports, clinics, and camps with `50` current matches
- `hooky-cheer-gymnastics` is live with `13` current matches after the final materialization pass

### Lane G: Precision / Quality Hardening

Goal:
- reduce remaining residual noise where the fix is cheap and user-visible

Scope:
- high-value official-owner handoffs
- stale misclassification drift
- watch-party tag consistency
- title normalization
- cheap time fixes on high-value attendance rows

Output:
- lower maintenance burden
- cleaner sports channels
- fewer long-tail quality defects in Atlanta-core sports

Success criteria:
- remaining residuals are legitimate long-tail inventory, not obvious quality misses

### Lane H: Portal Presentation Upgrades

Goal:
- make the sports richness legible in the Atlanta portal itself

Scope:
- stronger sports group landing pages
- better watch/public-play presentation
- clearer feed vs groups framing
- better browsing by sports scene

Output:
- a portal that feels intentionally organized around sports behavior, not just denser data

Success criteria:
- the Atlanta sports experience is improved by structure and presentation, not just more rows

Current tranche state:
- Atlanta groups/feed copy now presents the channel surface as `Scenes & Groups`
- Hooky groups/feed copy now presents the channel surface as `Program Tracks`
- both portals now support settings-driven feed titles, page titles, search placeholders, joined labels, and type-label overrides without adding a new UI system

## Execution Lanes

### Lane A: Official Attendance

Goal: every Atlanta team or recurring sports home venue should have an official owner.

Source types:
- team schedule APIs
- official league/team pages
- official venue season pages when they are the primary owner

Priority:
1. Official team source
2. Official league source
3. Official venue season source
4. Aggregator fallback only if nothing better exists

### Lane B: Public Play

Goal: materially expand public-access sports participation inventory.

Include:
- open play
- drop-in
- pickup
- public rec-center programming
- clinics
- try-it sessions

Do not include:
- join-first leagues
- screening-based programs
- season registration inventory in the feed

### Lane C: Watch Parties / Sports Bars

Goal: cover the public viewing layer, starting with official team-backed networks.

Priority:
1. official team watch-party networks
2. official club pub partner programs
3. venue-owned recurring public sports programming

### Lane D: Groups

Goal: maintain a separate backlog for join-first sports communities.

This lane should not block feed execution.

## Program Rules

### Atlanta-Core Bias

Do not keep spending cycles on outer-county rec catalogs unless a source clearly improves how the Atlanta portal feels to a real user.

Good reasons to break the rule:
- the source is Atlanta-adjacent but still materially visible to Atlanta users
- the source is uniquely strong and public-access
- the source fills a major sports identity gap that Atlanta proper does not currently cover

Otherwise, prefer Atlanta proper and obvious ITP sports identity first.

### No Check-In Mode

Work should proceed in tranches, not per-source prompts.

Within a tranche:
- keep shipping until the tranche target is complete
- stop only for a real blocker, ambiguous `feed` vs `groups` classification, or obvious diminishing returns
- report at tranche boundaries, not after every crawler

### Root-Cause Rule

Do not use manual DB cleanup as the main solution.

## Done State

Atlanta sports should be considered `done` for this phase when all of the following are true:

### Feed

- major Atlanta spectator inventory is officially owned and stable
- watch-party coverage feels meaningfully useful to a real Atlanta user
- public-play coverage includes more than aquatics, pickleball, and open gym
- remaining feed gaps are clearly long-tail, not obvious identity holes

### Groups

- Atlanta has a coherent sports community layer, not just one generic sports bucket
- at least the major community scenes are represented:
  - running
  - soccer
  - basketball
  - racquet/pickleball
  - cycling
  - ultimate
- join-first inventory is routed to groups rather than leaking into feed

### Cleanup / Quality

- no known major Atlanta sports rows are still owned by weak placeholder sources
- no empty or obviously broken Atlanta sports channels are left active
- remaining issues are explicitly documented as deferred long-tail or blocked upstream

If those conditions are met, the workstream should shift from `buildout` to `maintenance`.

## Remaining Tranches

### Tranche 4: Atlanta Watch Layer

Goal:
- make the Atlanta portal feel genuinely useful for `where should I go watch the game?`

Scope:
- new first-party or venue-owned in-city watch-party sources
- deeper extraction from existing in-city sports-bar sources only where the source is actually live
- stronger routing of existing sports-viewing rows into the watch channels

Success criteria:
- watch-party / sports-bar inventory is no longer obviously thin next to attendance and public-play
- channel counts and sample rows look like true Atlanta sports-viewing behavior, not nightlife noise

### Tranche 5: Atlanta Public-Play Depth

Goal:
- close the biggest remaining participation gaps beyond aquatics and pickleball

Priority gaps:
- basketball pickup / gym access beyond the current rec-center slice
- soccer / futsal public play beyond Piedmont
- volleyball / court-sport public sessions
- tennis open play and clinics where truly public
- batting / practice / sports-facility inventory only when eventized and public

Success criteria:
- Atlanta-core participation no longer feels concentrated in just aquatics, pickleball, and one open-gym source

### Tranche 6: Atlanta Groups Completion

Goal:
- finish the sports-community layer so it reflects how Atlanta people actually organize around sports

Priority channels and source families:
- join-first rec leagues
- pickup communities
- tennis ladders
- run clubs beyond the current obvious pack
- neighborhood soccer / cycling / racquet communities

Success criteria:
- the groups surface gives a user a credible picture of Atlanta sports communities even when a source is join-first and not feed-safe

### Tranche 7: Final Quality Sweep

Goal:
- harden the finished surface before declaring the lane done

Scope:
- remaining official-owner orphans
- bad titles or stale rows still visible in Atlanta sports channels
- empty channels
- over-broad matches in interest channels
- obvious missing times on high-value attendance rows if cheap to fix

Success criteria:
- final Atlanta sports audit produces only low-severity residuals

## Workstream Order

Run the rest of the work in this order:

1. `watch layer`
2. `public-play depth`
3. `groups completion`
4. `final quality sweep`

If Phase 1 is complete and the workstream resumes as Phase 2, use this order instead:

1. `sports groups maturity`
2. `family / program handoff`
3. `precision / quality hardening`
4. `portal presentation upgrades`

Do not jump back into outer-county class inventory unless it directly improves one of those four.

## Batch Size

Default operating batch:
- `3-6` substantive changes per tranche boundary

A substantive change can be:
- one new source
- one channel/backfill tranche
- one meaningful upstream classification or federation fix

Do not report after each source. Report when:
- a tranche meaningfully moved, or
- a real blocker appears, or
- the remaining opportunity has become low enough to call the lane nearly done

## Stop Rules

Stop adding new sources when any of these become true:

- new additions are mostly outer-county or family drift, not Atlanta-core sports identity
- new rows are mostly duplicates or thin variants of already-covered patterns
- the remaining candidate sources are mostly brittle, stale, or low-confidence
- the product perception gap is no longer about missing sports coverage

At that point, the right move is maintenance and selective upgrades, not continued expansion.

## Phase 2 Done State

Atlanta sports Phase 2 should be considered `done` when all of the following are true:

- sports `groups` feels as credible as sports `feed`
- family/program sports inventory has a clear destination outside the public sports feed
- remaining Atlanta sports residuals are acceptable long-tail noise, not obvious quality misses
- the portal experience is measurably improved through presentation and structure, not just ingestion

If those conditions are met, Atlanta sports should remain in `maintenance` until a new product priority justifies reopening it.

## Current Endgame Queue

This is the recommended order for the remaining work:

1. `Atlanta watch-party / sports-bar tranche`
Target:
- venue-owned sports programming that is actually current
- in-city bars with explicit match-day or watch-party detail pages
- deepen existing watch classification where rows already exist

2. `Atlanta public-play sports tranche`
Target:
- additional city-core basketball, soccer/futsal, volleyball, and tennis public-play inventory
- only official or clearly durable sources

3. `Atlanta groups tranche`
Target:
- rec leagues, ladders, and join-first sports communities routed into group channels
- do not force these into feed

4. `Final audit`
Target:
- verify feed, groups, and source ownership against the done state

## Reporting Contract

At each tranche boundary, report only:

- `shipped`
- `live counts`
- `quality / contamination findings`
- `what remains`
- `whether we are closer to done or still in buildout`

That is the standing contract until Atlanta sports reaches the done state above.
