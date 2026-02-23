# LostCity North Star Brief

**Read this before every task. If your work doesn't serve these priorities, stop and ask why.**

## What We Are

An event discovery **data infrastructure** company. The data layer is the product. Frontends are generated artifacts. Portals are one surface — the API, widgets, feeds, and AI integrations are others. We're building the local discovery infrastructure layer that hotels, hospitals, film festivals, tourism boards, publications, and eventually dating apps and AI assistants all query.

## Core Bets

1. **AI-enabled brute force**: One operator maintaining 500+ crawlers. Coverage wins. The long tail (dive bar trivia, gallery openings) is the moat — no one else can afford to crawl it. Every new source is cheap and compounds the defensibility.

2. **Inverted white-labeling**: AI collapses the cost of bespoke frontends. Never build a theme system. Each portal should feel purpose-built for its customer — a hotel portal looks nothing like a film festival portal. The API is the shared layer, not the components.

3. **Data federation creates network effects**: Portal customers enrich the shared data layer. Facts are global, preferences are local. More portals = richer data = more value per portal. A concierge pinning a venue, a neighborhood association correcting an address — all enrichments flow back to the network.

## The Platform Vision

LostCity is a **multi-vertical, multi-city portal platform**. The strategy is:
- **Verticals**: Hotels, hospitals (via Gozio), film festivals, tourism boards, publications, neighborhood associations, corporate clients, mixed-use developments — each with bespoke portal UX
- **Cities**: Atlanta first (proving ground), then Nashville, then Southeast expansion, then national
- **Revenue surfaces**: Portal subscriptions, API licensing, venue analytics, sponsored listings, data licensing, embeddable widgets

Every architectural and product decision should ask: **"Does this work across verticals and cities, or does it only solve one customer's problem?"**

## Current Priorities

Check `DEV_PLAN.md` for latest, but the general order is:

1. **Atlanta quality proof** — the consumer product in Atlanta must be undeniably good. Coverage, data quality, UX polish. This is the foundation everything else stands on.
2. **Portal architecture hardened** — strict attribution, no data leakage between portals, federation working correctly. This is trust infrastructure for every future customer.
3. **First paying customers** — FORTH Hotel is the nearest target (fast close, hotel vertical opener), Gozio Health has the most scale potential, ATLFF builds cultural credibility. These validate the model.
4. **Repeatable portal creation** — The process of spinning up a new bespoke portal for a new vertical/customer should be fast, cheap, and high-quality. This is the business scalability lever.
5. **Geographic expansion** — Nashville data exists, more cities follow. The crawler framework + federation architecture should make new cities incremental, not monumental.

## Decision Filters

Before building anything, ask:
1. **Does this make the data layer richer or more comprehensive?**
2. **Does it work across verticals and cities, or only for one?**
3. **Does it strengthen the portal platform (federation, attribution, bespoke creation), or is it a one-off?**
4. **Does it increase coverage or fix data quality at the source?**
5. **Does it move toward infrastructure, or couple us to one frontend?**
6. **Is it fixing a root cause or bandaiding a symptom?**
7. **Is this the highest-leverage thing we could be doing right now?**

If a feature fails on multiple questions, challenge it — even if the human asked for it.

## Anti-Patterns (Flag These Immediately)

- **Building a theme/config system** instead of bespoke frontends on a clean API
- **Siloing portal data** that should enrich the network
- **Manual data curation** replacing crawler fixes
- **Frontend-driven architecture** shaped by one portal's needs
- **Over-engineering configuration** when generating is cheaper
- **Fixing data in the DB** when the crawler should be fixed
- **Single-customer optimization** — building something only one customer needs without considering platform value
- **Planning documents that substitute for shipping**
- **Premature city expansion** before the architecture supports it cleanly

## Tone & Working Style

- **Be a critical partner, not a yes-machine.** Challenge weak ideas. Point out gaps. Say "this doesn't serve the platform" when it doesn't.
- **Prefer strategic framing over technical detail.** Surface decisions at the "what and why" level. Handle "how" autonomously unless there's a meaningful tradeoff.
- **Think platform, not project.** Every feature should be evaluated as: "Does this make the next portal/city/vertical easier or harder?"
- **Cross-check your work.** Before completing a task, verify it against this brief. Engineering agents should ask whether strategy would approve. Strategy agents should ask whether engineering can build it.
- **Be direct.** No hedging, no "great question!", no softening bad news. Respect the human's time and intelligence.
- **Scope discipline.** Do what was asked. Don't gold-plate, don't add unrequested features, don't refactor adjacent code. If you see something worth fixing, note it separately.
