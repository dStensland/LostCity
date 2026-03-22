# LostCity Strategic Principles

This document defines the core hypotheses and strategic principles that should guide every product, architecture, and feature decision. Before building anything, check it against these principles. If a feature doesn't support or align with them, challenge it.

---

## Core Hypotheses

### Hypothesis 1: AI-Enabled Brute Force
Agentic coding allows a single operator to build and maintain 1,000+ individual crawlers — a brute-force approach to a fragmented ecosystem that was previously uneconomical. The event/destination/program ecosystem is too fragmented for any elegant solution (APIs, partnerships, user-submitted data). Comprehensive coverage requires scraping every source individually, and AI makes that feasible.

**Implication**: Always favor adding more sources over building smarter abstractions on limited data. Coverage wins. The long tail of local activity (the neighborhood bar's trivia night, the gallery opening, the county rec center's swim class) is where the value is — and it's where no one else can compete because the economics didn't work before AI-assisted development.

**Defend by**: Continuously expanding source count. Every new crawler is cheap and compounds the moat. Currently at 1,000+ sources across events, destinations, programs, and editorial signals.

### Hypothesis 2: Inverted White-Labeling
AI collapses the cost of building bespoke frontends. Traditional white-labeling (one codebase, theme system, swap logos) produces generic products. With a solid data layer and API backbone, we can generate radically different frontends per customer or vertical — purpose-built UIs that share nothing visually but share everything at the data level.

**Implication**: Never build a theme/config system. Never constrain portal UX to what a shared component library can express. Each portal should feel like it was built for that specific audience. The data layer and API are the product — frontends are generated artifacts.

**Defend by**: Keeping the API layer clean and well-documented. Every piece of data must be accessible via composable endpoints. Frontend decisions should never leak into the data layer.

### Hypothesis 3: Data Federation Creates Network Effects
Portals aren't siloed views of a database — they're nodes in a network. Enrichments flow upward (portal customers improve the shared data layer) and downward (every portal benefits from all other portals' enrichments). Shared auth creates a cross-portal user graph. The more portals, the richer the data, the more valuable each portal becomes.

**Implication**: Every portal interaction that generates data (a concierge pinning a venue, a user saving an event, a neighborhood association correcting an address) should flow back to the shared data layer. Design for enrichment, not isolation.

**Defend by**: Clean inheritance model. Portal-level overrides stored separately but queryable globally. Never fork data — always federate.

### Hypothesis 4: First-Party Verticals as Content Factories
We don't just white-label for external customers — we build our own constellation of niche portals that serve as two-sided content factories. Each first-party vertical produces unique entities that the base layer doesn't have (civic opportunities, outdoor destinations, family programs, exhibitions, sports schedules), while consuming and repackaging general-interest content (concerts, festivals, food events) for its specific audience.

**Implication**: Every new first-party portal must introduce a unique entity type or data dimension — otherwise it's just a filtered view, not a content pillar. The portal justifies its existence by making the network richer, not by slicing existing data differently.

**Content pillars** (produce unique entities): Atlanta (base), Citizen (civic/volunteer opportunities), Family (programs, camps, age-appropriate activities), Adventure (trails, campgrounds, outdoor destinations), Arts (exhibitions, studios, open calls, artist profiles), Sports (team schedules, watch parties, rec leagues).

**Distribution portals** (consume for paying audiences): Hotels (FORTH), hospitals (Gozio), convention companions, neighborhood editions.

**Defend by**: Each portal launch adding measurably to the shared data layer. Track unique entities contributed per portal.

### Hypothesis 5: Social Infrastructure Is Mission-Critical
Discovery without coordination is a content site. The hardest part of going out isn't finding something — it's coordinating with other people. Lightweight social features (Hangs check-ins, profiles, social proof) reduce the friction of making plans and create retention that pure discovery can't. This is the difference between "I found something cool" and "I actually went."

**Implication**: Social features aren't a growth hack layered on later — they're core to the mission of getting people out together. Hangs, profiles, and friend activity should be first-class across every portal, not an Atlanta-only experiment.

**Defend by**: Measuring not just discovery (events viewed) but activation (plans made, hangs created, friends invited). The social layer succeeds when it converts intent into action.

---

## Strategic Principles

### 1. The Data Layer Is the Product
Frontends come and go. The comprehensive, enriched, federated data layer is the durable asset. Every decision should ask: "Does this make the data layer richer, more accurate, or more comprehensive?" This now includes three entity types — events, destinations, and programs — plus editorial signals, occasion intelligence, and social proof data.

**Do**: Build features that improve data quality (validation, enrichment, venue claiming).
**Don't**: Build frontend features that bypass the data layer or create data in frontend-only state.

### 2. Coverage Over Curation
Comprehensive automated coverage beats selective manual curation at scale. We crawl 1,000+ sources because the long tail matters. A manually curated list of "top 50 events" is what every competitor does. We show everything — from the arena concert to the dive bar's open mic to the county pool's adult swim lessons.

**Do**: Add more sources. Improve crawler reliability. Capture the long tail. Expand into new entity types (programs, trails, exhibitions) as portals demand them.
**Don't**: Over-invest in editorial curation. Don't manually pick featured events when the system should surface them through data (popularity, recency, relevance).

### 3. Destinations and Programs, Not Just Events
Venues, trails, parks, campgrounds, and studios are valuable independent of their events. A great bar with no upcoming events is still a place someone wants to discover. A rec center with swim classes is worth knowing about even outside registration windows. This multi-entity philosophy is a core differentiator — event platforms only show venues with scheduled events.

**Do**: Ensure every venue has rich standalone data (vibes, type, neighborhood, hours, images, editorial mentions, occasion tags). Build programs as a first-class entity with age ranges, sessions, and registration. Expand destination types as portals demand (trails for Adventure, studios for Arts).
**Don't**: Treat venues as mere containers for events. Don't ignore non-event entities because the events pipeline is more mature.

### 4. Every Portal Enriches the Network
Portal customers are data contributors, not just data consumers. A hotel concierge who pins a restaurant, a civic portal that surfaces volunteer opportunities, an adventure portal that maps trailhead conditions — all of these enrichments flow back to the global data layer and benefit every other portal.

**Do**: Design features so that portal-level actions enrich shared data. Track unique entity contributions per portal.
**Don't**: Silo portal data. Don't build features that only benefit one portal's users.

### 5. Shared Auth, Separate Experiences
Users authenticate once and their profile carries across portals. A person who used the hotel portal as a tourist and later the civic portal as a volunteer has a unified taste profile — without any coordination between the hotel and the nonprofit. This cross-portal user graph is a sleeper moat. Privacy tiers (low-key/social/open-book) give users control over what's visible where.

**Do**: Maintain unified user identity across all portals. Track preferences and behavior at the user level, not the portal level.
**Don't**: Create portal-specific user accounts. Don't fragment the user graph.

### 6. Bespoke Over Configurable
A hotel portal should look nothing like a civic portal should look nothing like an adventure portal. Don't build a theme system — build a clean API and generate purpose-built frontends. Each first-party portal has its own design language, typography, color system, and interaction patterns. The cost of bespoke is now low enough that configuration-based white-labeling is a worse tradeoff.

**Do**: Keep the API clean enough that any frontend can be built on top of it. Give each portal a distinct visual identity.
**Don't**: Build portal "templates" or "themes." Don't constrain new portals to existing UI patterns. Don't add feature flags for portal-specific behavior in shared frontend code.

### 7. Crawlers Bootstrap, Federation Sustains
Crawlers got us to critical mass. Over time, as LostCity becomes valuable to venues and organizers, they'll submit data directly. The crawler infrastructure remains essential for the long tail and for keeping everyone honest, but the data flywheel should increasingly be fed by the network itself.

**Do**: Build venue claiming and self-service event submission.
**Don't**: Assume crawlers are the only data source forever. Don't build architecture that can't accept submitted data alongside crawled data.

### 8. Low-Margin Customers Can Be High-Value
The cost of spinning up a bespoke portal is low. This means we can serve customers that traditional white-label companies can't afford to serve — neighborhood associations at $50/mo, wedding planners at $100/mo. These low-margin customers may contribute disproportionate data enrichment and network effects.

**Do**: Build self-serve onboarding. Make it cheap to serve the long tail of small customers.
**Don't**: Set artificial minimum price floors. Don't ignore small customers because their revenue is low — evaluate them on data contribution, not just margin.

### 9. Validate at Ingestion, Not After
When crawlers produce bad data, fix the crawler and add a validation rule — don't fix the data in the database. Every manual data repair that should have been caught upstream is a failure of the system. The maintenance burden should stay flat as source count grows, not grow linearly.

**Do**: Add validation rules whenever a class of bad data is discovered. Reject bad data loudly. Capture ALL signal in one crawler pass (events, specials, hours, recurring programming, venue metadata).
**Don't**: Bandaid data in the database. Don't silently accept garbage and clean it later. Don't build enrichment scripts for data that should have been captured at crawl time.

### 10. The Endgame Is Infrastructure
Portals are one surface for the data. The API, embeddable widgets, data feeds, AI integrations, and analytics are others. The long-term vision is becoming the local discovery infrastructure layer — the system that dating apps, transit apps, real estate platforms, and AI assistants all query. Build for that future.

**Do**: Design the API as a first-class product, not just a backend for our own frontend.
**Don't**: Couple business logic to any single frontend. Don't build features that only work in the context of our own app.

### 11. Social Features Build Community, Not Engagement
The social layer (Hangs, profiles, friend activity, social proof) exists to get people out together — not to maximize time-in-app. Every social feature should reduce friction between "I want to go" and "I'm going with friends." No algorithmic feeds, no engagement optimization, no dark patterns.

**Do**: Build lightweight coordination tools (Hangs, invites, shared plans). Show social proof that helps decisions ("3 friends have been here"). Respect privacy tiers.
**Don't**: Build comment systems, reaction feeds, or notification loops designed for retention. Don't optimize for session length. Don't make social features feel like social media.

### 12. Build Cost Is Not a Decision Variable
Agentic development collapses build cost to near-zero and enables massive parallelism. When a bespoke portal, a new API, and a crawler fleet all take roughly the same agent-hours, "how hard is this to build?" stops being a useful question.

Sequencing decisions should be based on dependency graphs and market readiness, not effort estimates. Five portals can ship in the same week if the data layer supports them — the constraint is review bandwidth and data readiness, not build capacity.

Prioritization shifts from "build complexity vs. business value" to pure signal: Does the data exist? Is there market pull? Does it compound? Build everything that passes the product smell test — the old "is this worth the engineering investment?" filter made sense when engineers were scarce. It doesn't anymore.

**Do**: Evaluate features on data readiness, market pull, distribution leverage, and network effects. Parallelize independent work aggressively.
**Don't**: Use effort estimates to defer good ideas. Don't sequence work that could be parallel. Don't let "build complexity" influence prioritization — it's a solved problem.

---

## Decision Framework

When evaluating any new feature, ask:

1. **Does it make the data layer richer?** (Principle 1, 4)
2. **Does it increase coverage or improve data quality?** (Principle 2, 9)
3. **Does it work across portals or only for one?** (Principle 4, 5)
4. **Does it constrain future portal designs?** (Principle 6)
5. **Does it move us toward infrastructure or away from it?** (Principle 10)
6. **Is it fixing a root cause or bandaiding a symptom?** (Principle 9)
7. **Does it produce unique entities that enrich the network?** (Hypothesis 4)
8. **Does it reduce friction for going out together?** (Hypothesis 5, Principle 11)
9. **Is effort the real blocker, or is it data/market readiness?** (Principle 12)

If a feature fails on multiple questions, it's probably not aligned with strategy. Challenge it.

---

## Anti-Patterns to Watch For

- **Shipping at "demo quality"** — if it needs a walkthrough script or "ignore that part," it's not ready. Every portal must work unsupervised for real users.
- **Feature breadth over quality depth** — adding new sections while existing ones have stale data, dead links, or broken empty states. Fix what's live before building what's next.
- **Building a theme system** instead of building bespoke frontends on a clean API
- **Portal-specific feature flags** in shared code instead of separate frontend codebases
- **Siloed portal data** that doesn't flow back to the shared layer
- **Manual data curation** replacing automated crawling + validation
- **Frontend-driven architecture** where the API is shaped by one portal's needs
- **Ignoring small customers** because their revenue doesn't justify traditional customization costs
- **Fixing data instead of fixing crawlers** when ingestion produces bad results
- **Over-engineering configuration** when generating a new frontend is cheaper
- **Portals without unique entity types** — a vertical that's just a filtered event view isn't a content pillar
- **Social features that feel like social media** — we're coordination infrastructure, not a feed algorithm
- **Planning as progress** — strategy docs and roadmaps that substitute for shipping code
- **Using build effort to defer good ideas** — "that would take too long" is almost never true anymore. If the data exists and there's market pull, build it. The real constraints are data readiness and review bandwidth.
