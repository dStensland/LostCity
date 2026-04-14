# LostCity North Star Brief

**Read this before every task. If your work doesn't serve these priorities, stop and ask why.**

## What We Are

LostCity exists to **get people out and active in the real world** — to make it easy to discover what to do, where to go, and how to connect with others in your city. That's the mission.

The core question we answer is **"What should I go do?"** — and the answer is four first-class entity types working together:
- **Events**: What's happening — concerts, openings, classes, meetups, festivals. Temporal, crawled, comprehensive.
- **Places** (formerly "destinations" in older docs, now `places` in code): Where to go — restaurants, bars, parks, museums, trails, campgrounds. Persistent, enriched, opinionated. Not just containers for events, but independently discoverable places worth going to. Stored in the `places` table with PostGIS spatial data.
- **Programs**: What to join — swim lessons, summer camps, rec league basketball, pottery classes. Structured activities with sessions, age ranges, and registration. The bridge between events (one-off) and places (always there).
- **Exhibitions**: What to experience *while you're there* — gallery shows, museum exhibitions, aquarium habitats, zoo exhibits, historic site displays, park attractions, interpretive centers, permanent installations. Persistent experiences attached to a place, with optional run dates. Each lives in the `exhibitions` table with its own search vector, detail surface, and cross-vertical schema. The Arts portal produces gallery and museum shows; the Family portal produces aquarium/zoo/children's-museum experiences; the Adventure portal produces park attractions and interpretive centers; civic/historic portals produce permanent exhibits. Not Arts-specific.

Events tell you what's happening *right now*. Places tell you where's worth going *anytime*. Programs tell you what's worth committing to *this season*. Exhibitions tell you what's worth experiencing *while you're at a place*. Together they're the complete answer.

The business model is a **local discovery data infrastructure** company. The data layer is the product. Frontends are generated artifacts. Portals are one surface — the API, widgets, feeds, and AI integrations are others. We're building the local discovery infrastructure layer that hotels, hospitals, tourism boards, publications, and eventually dating apps and AI assistants all query.

**The B2B platform funds the mission. The consumer product IS the mission.** These aren't in tension — a great Atlanta consumer experience proves the model for B2B customers AND directly serves the goal of getting people out. Social features that build community and reduce the friction of going out are mission-critical, not nice-to-haves.

## Core Bets

### Bet 1: AI-Enabled Brute Force
One operator maintaining 1,000+ crawlers and enrichment pipelines. Coverage wins. The long tail (dive bar trivia, gallery openings, the neighborhood Thai place Eater just reviewed, the county rec center's swim lessons) is the moat — no one else can afford to crawl it. Every new source is cheap and compounds the defensibility.

### Bet 2: Inverted White-Labeling
AI collapses the cost of bespoke frontends. Never build a theme system. Each portal should feel purpose-built for its audience — a hotel portal looks nothing like a film festival portal looks nothing like a civic volunteer portal. The API is the shared layer, not the components.

### Bet 3: Data Federation Creates Network Effects
Portal customers enrich the shared data layer. Facts are global, preferences are local. More portals = richer data = more value per portal. A concierge pinning a venue, a neighborhood association correcting an address, a volunteer org tagging opportunities — all enrichments flow back to the network.

### Bet 4: First-Party Verticals as Content Factories
We don't just white-label for customers — we build our own niche portals that serve as two-sided content factories. Each vertical produces unique entities (civic opportunities, outdoor destinations, family programs, exhibitions) that enrich the platform, while federating general-interest content (festivals, concerts, food events) to the base layer and distribution portals.

**Content pillars** (produce unique entities): Atlanta (base layer), Lost City: Citizen (civic/volunteer), Lost City: Family (kids/programs), Lost City: Adventure (outdoors/trails), Lost City: Arts (exhibitions/studios), Lost City: Sports (spectator + social + participation).

**Distribution portals** (consume/repackage for paying audiences): Hotels (FORTH), Convention Companion (future), Neighborhood editions (future), Hospital/health (Gozio, future).

Each niche portal is a content factory AND a consumer product. The niche content stays in-portal (SAG meetings, open calls, trailhead conditions). The general-interest content federates out (festivals, concerts, openings). Distribution portals consume the richest version of the data because every content pillar is feeding it.

### Bet 5: Social Infrastructure Reduces Friction
The hardest part of going out isn't finding something to do — it's coordinating with other people. Hangs (lightweight check-ins), profiles, and social proof (who's going, who's been) reduce the friction of making plans. This directly serves the mission and creates retention that pure discovery can't.

## Brand Architecture

**"Lost City: X"** for all first-party portals. Lost City is the brand; verticals are descriptors. Cute names become taglines/personality, not brand names:
- Lost City: Citizen — "Show up"
- Lost City: Family — "Play hooky"
- Lost City: Adventure — "Wander over yonder"
- Lost City: Arts — "Atlanta's underground art scene, surfaced"

White-labeling demonstrated through B2B clients (FORTH, Gozio), not first-party portal name variety.

## Current Architecture Anchor (as of 2026-04-14)

Strategy without grounding becomes fiction. These are the load-bearing technical realities that shape what's possible. If you're proposing work that ignores them, the work is wrong.

- **The `places` table is the canonical destination model.** Renamed from `venues` in March 2026. PostGIS `location` column for spatial queries. All FKs use `place_id`. New work must use these names.
- **`web/lib/entity-urls.ts` builds all entity URLs.** Never hand-build a URL to an event, place, exhibition, series, or festival. `buildEventUrl` and `buildSpotUrl` take a `'feed' | 'page'` context arg — overlay is feed-only, canonical is everywhere else. Other builders are always canonical. This rule prevents infinite overlay nesting and broken share links.
- **`search_unified()` is the single search entry point.** Replaces all prior search stacks. Portal isolation is enforced inside the RPC via mandatory `p_portal_id`. New search features wrap this RPC; do not bypass it.
- **Portal isolation is enforced at the database layer.** `sources.owner_portal_id` is `NOT NULL` and CHECK-constrained. Events inherit `portal_id` via trigger. Cross-portal data leakage is a P0 trust failure — if a query needs to span portals, it must do so explicitly, never accidentally.
- **Exhibitions are first-class, cross-vertical, and mechanically so.** The `exhibitions` table models persistent experiences at a place — gallery shows, museum exhibitions, aquarium habitats, historic site displays, park attractions, permanent installations. The schema is portal-agnostic. The `events.exhibition_id` FK shipped 2026-04-14 (commit `838b9052`), `search_unified()` exposes exhibitions directly (commit `bd9cd223`), and `content_kind='exhibit'` is deprecated (commit `89026d9b`). Exhibitions are a noun on the same level as events and places — not a flag on events, not an Arts-only thing. Any portal that surfaces museums, aquariums, historic sites, or parks should be producing exhibitions. New exhibition-related events link via `exhibition_id`; new exhibitions live in the `exhibitions` table. The `exhibition_type` enum was expanded on 2026-04-10 and now accepts: `solo`, `group`, `installation`, `retrospective`, `popup`, `permanent`, `seasonal`, `special-exhibit`, `attraction` — non-arts portals should use `attraction`, `seasonal`, `special-exhibit`, or `permanent`.

## Current Priorities

Check `DEV_PLAN.md` for latest, but the general order is:

1. **Atlanta is a live consumer product** — not a proof-of-concept, not a sales demo. The bar is "would someone recommend this to a friend?" Coverage, data quality, UX polish, error handling, empty states — all must be consumer-grade. Real users using it daily is both the mission AND the best sales proof.
2. **Every portal ships consumer-ready** — FORTH is a live hotel concierge product guests use unsupervised. HelpATL is a live civic portal volunteers rely on. No portal ships at "demo quality" — if it's not ready for real users, it's not ready. A live product with real users IS the best sales demo.
3. **First-party verticals are the growth engine** — Family, Adventure, Arts, and Sports portals are in active development. Each must launch with its own unique entity type, data layer, and design language. Each must be consumer-ready or it doesn't ship.
4. **Social layer hardens** — Hangs, profiles, privacy tiers, and social proof are live. Iterate on real usage patterns, not hypothetical flows.
5. **Portal architecture hardened** — strict attribution, no data leakage between portals, federation working correctly. This is trust infrastructure for every current and future portal.
6. **First paying customers** — FORTH Hotel is the nearest target (fast close, hotel vertical opener), Gozio Health has the most scale potential. A consumer-grade product closes deals faster than a polished walkthrough.
7. **Geographic expansion** — Nashville data exists, more cities follow. The crawler framework + federation architecture should make new cities incremental, not monumental.

## Decision Filters

Before building anything, ask:
1. **Would a real user notice if this was missing or broken?** Consumer-ready means no dead links, no empty states without guidance, no errors that embarrass us. If a real person would hit it, it matters.
2. **Does this make the data layer richer — for events, places, programs, OR exhibitions?**
3. **Does it work across verticals and cities, or only for one?**
4. **Does it strengthen the portal platform (federation, attribution, bespoke creation), or is it a one-off?**
5. **Does it increase coverage or fix data quality at the source?**
6. **Does it move toward infrastructure, or couple us to one frontend?**
7. **Is it fixing a root cause or bandaiding a symptom?**
8. **Is this the highest-leverage thing we could be doing right now?**
9. **Does it reduce friction for getting people out, meeting others, or building community?**
10. **Does this portal/feature produce unique entities that enrich the network, or is it just a view?**

Features can earn their place through infrastructure value (questions 2-7), community-building value (question 9), or network enrichment (question 10). The strongest features serve multiple. Challenge features that serve none.

**Consumer-ready ≠ feature-complete.** Ship what we have at consumer quality, not everything a consumer product could have. The discipline is quality depth over feature breadth.

## Anti-Patterns (Flag These Immediately)

- **"Demo quality" as a shipping bar** — if you'd be embarrassed showing it to a stranger with no context, it's not ready. No walkthrough scripts, no "ignore that part." Every portal must work unsupervised.
- **Building a theme/config system** instead of bespoke frontends on a clean API
- **Siloing portal data** that should enrich the network
- **Manual data curation** replacing crawler fixes
- **Frontend-driven architecture** shaped by one portal's needs
- **Over-engineering configuration** when generating is cheaper
- **Fixing data in the DB** when the crawler should be fixed
- **Single-customer optimization** — building something only one customer needs without considering platform value
- **Planning documents that substitute for shipping**
- **Premature city expansion** before the architecture supports it cleanly
- **Feature breadth over quality depth** — adding new sections/features while existing ones have broken states, stale data, or dead ends. Fix what's live before adding what's next.
- **Portals without unique entity types** — a new vertical that's just a filtered view of events isn't a content pillar, it's a search preset. Every portal should produce something the base layer doesn't have.
- **Ignoring the social layer** — discovery without coordination is a content site. The mission is getting people *out together*.

## Tone & Working Style

- **Be a critical partner, not a yes-machine.** Challenge weak ideas. Point out gaps. Say "this doesn't serve the platform" when it doesn't.
- **Prefer strategic framing over technical detail.** Surface decisions at the "what and why" level. Handle "how" autonomously unless there's a meaningful tradeoff.
- **Think platform, not project.** Every feature should be evaluated as: "Does this make the next portal/city/vertical easier or harder?"
- **Cross-check your work.** Before completing a task, verify it against this brief. Engineering agents should ask whether strategy would approve. Strategy agents should ask whether engineering can build it.
- **Challenge the strategy, not just the code.** These strategy files are living documents, not scripture. If a principle isn't working in practice, if a hypothesis is being disproven by what you're building, or if the real work has diverged from what the docs say — flag it. Propose a specific update to `north-star.md`, `STRATEGIC_PRINCIPLES.md`, or `DEV_PLAN.md`. Strategy that doesn't match reality is worse than no strategy because it sends agents in the wrong direction.
- **Be direct.** No hedging, no "great question!", no softening bad news. Respect the human's time and intelligence.
- **Scope discipline.** Do what was asked. Don't gold-plate, don't add unrequested features, don't refactor adjacent code. If you see something worth fixing, note it separately.

---

**Last refreshed:** 2026-04-14 — added exhibitions as the fourth first-class entity (cross-vertical, not Arts-specific), renamed "destinations" to "places" to match the code, added "Current Architecture Anchor" section documenting the load-bearing technical realities (places table, entity-urls, search_unified, portal isolation, exhibitions as mechanical first-class). Previous refresh: 2026-02-25 (initial). Re-review whenever a major architectural shift lands.
