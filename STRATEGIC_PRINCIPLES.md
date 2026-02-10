# LostCity Strategic Principles

This document defines the core hypotheses and strategic principles that should guide every product, architecture, and feature decision. Before building anything, check it against these principles. If a feature doesn't support or align with them, challenge it.

---

## Core Hypotheses

### Hypothesis 1: AI-Enabled Brute Force
Agentic coding allows a single operator to build and maintain 500+ individual crawlers — a brute-force approach to a fragmented ecosystem that was previously uneconomical. The event ecosystem is too fragmented for any elegant solution (APIs, partnerships, user-submitted data). Comprehensive coverage requires scraping every source individually, and AI makes that feasible.

**Implication**: Always favor adding more sources over building smarter abstractions on limited data. Coverage wins. The long tail of local events (the neighborhood bar's trivia night, the gallery opening) is where the value is — and it's where no one else can compete because the economics didn't work before AI-assisted development.

**Defend by**: Continuously expanding source count. Every new crawler is cheap and compounds the moat.

### Hypothesis 2: Inverted White-Labeling
AI collapses the cost of building bespoke frontends. Traditional white-labeling (one codebase, theme system, swap logos) produces generic products. With a solid data layer and API backbone, we can generate radically different frontends per customer or vertical — purpose-built UIs that share nothing visually but share everything at the data level.

**Implication**: Never build a theme/config system. Never constrain portal UX to what a shared component library can express. Each portal should feel like it was built for that specific customer. The data layer and API are the product — frontends are generated artifacts.

**Defend by**: Keeping the API layer clean and well-documented. Every piece of data must be accessible via composable endpoints. Frontend decisions should never leak into the data layer.

### Hypothesis 3: Data Federation Creates Network Effects
Portals aren't siloed views of a database — they're nodes in a network. Enrichments flow upward (portal customers improve the shared data layer) and downward (every portal benefits from all other portals' enrichments). Shared auth creates a cross-portal user graph. The more portals, the richer the data, the more valuable each portal becomes.

**Implication**: Every portal interaction that generates data (a concierge pinning a venue, a user saving an event, a neighborhood association correcting an address) should flow back to the shared data layer. Design for enrichment, not isolation.

**Defend by**: Clean inheritance model. Portal-level overrides stored separately but queryable globally. Never fork data — always federate.

---

## Strategic Principles

### 1. The Data Layer Is the Product
Frontends come and go. The comprehensive, enriched, federated data layer is the durable asset. Every decision should ask: "Does this make the data layer richer, more accurate, or more comprehensive?"

**Do**: Build features that improve data quality (validation, enrichment, venue claiming).
**Don't**: Build frontend features that bypass the data layer or create data in frontend-only state.

### 2. Coverage Over Curation
Comprehensive automated coverage beats selective manual curation at scale. We crawl 500+ sources because the long tail matters. A manually curated list of "top 50 events" is what every competitor does. We show everything — from the arena concert to the dive bar's open mic.

**Do**: Add more sources. Improve crawler reliability. Capture the long tail.
**Don't**: Over-invest in editorial curation. Don't manually pick featured events when the system should surface them through data (popularity, recency, relevance).

### 3. Destinations, Not Just Events
Venues are valuable independent of their events. A great bar with no upcoming events is still a place someone wants to discover. This "destination-first" philosophy is a core differentiator — event platforms only show venues with scheduled events.

**Do**: Ensure every venue has rich standalone data (vibes, type, neighborhood, hours, images).
**Don't**: Treat venues as mere containers for events. Don't deprioritize venues without upcoming events.

### 4. Every Portal Enriches the Network
Portal customers are data contributors, not just data consumers. A hotel concierge who pins a restaurant, a neighborhood association that corrects an address, a festival that tags a screening — all of these enrichments should flow back to the global data layer and benefit every other portal.

**Do**: Design features so that portal-level actions enrich shared data.
**Don't**: Silo portal data. Don't build features that only benefit one portal's users.

### 5. Shared Auth, Separate Experiences
Users authenticate once and their profile carries across portals. A person who used the hotel portal as a tourist and later the apartment portal as a resident has a unified taste profile — without any coordination between the hotel and the apartment complex. This cross-portal user graph is a sleeper moat.

**Do**: Maintain unified user identity across all portals. Track preferences and behavior at the user level, not the portal level.
**Don't**: Create portal-specific user accounts. Don't fragment the user graph.

### 6. Bespoke Over Configurable
A hotel portal should look nothing like a film festival portal. Don't build a theme system — build a clean API and generate purpose-built frontends. The cost of a bespoke frontend is now low enough (AI-assisted) that the traditional rationale for configuration-based white-labeling no longer holds.

**Do**: Keep the API clean enough that any frontend can be built on top of it.
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

**Do**: Add validation rules whenever a class of bad data is discovered. Reject bad data loudly.
**Don't**: Bandaid data in the database. Don't silently accept garbage and clean it later.

### 10. The Endgame Is Infrastructure
Portals are one surface for the data. The API, embeddable widgets, data feeds, AI integrations, and analytics are others. The long-term vision is becoming the local discovery infrastructure layer — the system that dating apps, transit apps, real estate platforms, and AI assistants all query. Build for that future.

**Do**: Design the API as a first-class product, not just a backend for our own frontend.
**Don't**: Couple business logic to any single frontend. Don't build features that only work in the context of our own app.

---

## Decision Framework

When evaluating any new feature, ask:

1. **Does it make the data layer richer?** (Principle 1, 4)
2. **Does it increase coverage or improve data quality?** (Principle 2, 9)
3. **Does it work across portals or only for one?** (Principle 4, 5)
4. **Does it constrain future portal designs?** (Principle 6)
5. **Does it move us toward infrastructure or away from it?** (Principle 10)
6. **Is it fixing a root cause or bandaiding a symptom?** (Principle 9)

If a feature fails on multiple questions, it's probably not aligned with strategy. Challenge it.

---

## Anti-Patterns to Watch For

- **Building a theme system** instead of building bespoke frontends on a clean API
- **Portal-specific feature flags** in shared code instead of separate frontend codebases
- **Siloed portal data** that doesn't flow back to the shared layer
- **Manual data curation** replacing automated crawling + validation
- **Frontend-driven architecture** where the API is shaped by one portal's needs
- **Ignoring small customers** because their revenue doesn't justify traditional customization costs
- **Fixing data instead of fixing crawlers** when ingestion produces bad results
- **Over-engineering configuration** when generating a new frontend is cheaper
