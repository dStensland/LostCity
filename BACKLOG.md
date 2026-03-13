# LostCity Product Roadmap (Historical)

> **Note:** This file is historical. The active roadmap is `DEV_PLAN.md`.

Active initiatives, reprioritized for launch proof and sales readiness.
Updated 2026-02-23 with comprehensive implementation audit.

---

## Current Operating Decision (2026-02-11, still active)

1. **Non-negotiable:** strict portal attribution everywhere (events, preferences, activities, enrichments, analytics).
2. **Launch focus:** increase Atlanta usage and quality to validate the core hypothesis.
3. **Sales focus:** ship high-quality vertical demos (FORTH first, then 1-2 additional demo verticals).
4. **Defer:** self-serve portal creation/admin expansion until real customers require it.
5. **Icebox:** Public Developer API until after launch traction.

---

## Completed Foundation

The original roadmap (Phases 0-7) covered ~45 features across data quality, user accounts, social, discovery, portals, real-time, growth, and hospital B2B. The vast majority are implemented and operational. This section tracks what's done to avoid re-planning solved problems.

### Data & Crawlers
- [x] **Source tracking** — Sources table with crawl logs, health monitoring, circuit breakers
- [x] **844 crawlers** — Venues, APIs, platforms, orgs, cinemas (well beyond original 10-source scope)
- [x] **Time extraction quality** — `extraction_confidence`, `field_confidence` JSONB, content_hash dedup
- [x] **Event rollup/dedup** — Content hashing, canonical_event_id, series/festival grouping
- [x] **Venue enrichment** — Neighborhoods, types, aliases, restaurant planning fields, venue tags with voting
- [x] **Auto-enrichment pipeline** — TMDB, Spotify/Deezer, Google Places, Wikidata
- [x] **Content health audit** — `data_health.py` with audit artifacts, baseline snapshots, and final audit report
- [x] **Venue menus scraper** — `scrape_venue_menus.py` with Playwright, LLM extraction, dump/results pipeline

### User Foundation
- [x] **User auth** — Supabase Auth with email/password + OAuth (Google, Apple)
- [x] **User profiles** — Username, avatar, bio, location, website, public/private visibility
- [x] **User preferences** — Categories, neighborhoods, vibes, price, notification settings
- [x] **Save/bookmark** — Events and venues with saved items API
- [x] **Following** — Polymorphic follows (users, venues, organizations) with self-follow prevention
- [x] **Calendar integration** — .ics feeds, Google/Apple calendar, friend calendars, feed URLs

### Social Foundation
- [x] **Friends system** — Friend requests, mutual follow detection, `are_friends()` function
- [x] **Recommendations** — Polymorphic (event, venue, org) with notes + visibility
- [x] **Going/Interested** — Event RSVPs (going/interested/went) with public/friends/private visibility
- [x] **Privacy/visibility** — RLS policies on all social tables, per-action visibility controls
- [x] **Activity feed** — Activities table: rsvp, recommendation, follow, check_in, save + metadata JSONB
- [x] **Notifications** — new_follower, friend_rsvp, recommendation, event_reminder, friend_going, venue_event, system
- [x] **User blocks** — Mute/block distinction with mutual block prevention
- [x] **Event invites** — Friend-to-friend event invitations with status tracking

### Discovery & Feed
- [x] **City Pulse feed** — Portal-scoped context-aware feed with time-of-day sections (Right Now, Tonight, This Weekend, This Week, Coming Up, Browse), weather-aware reranking, social proof, personalization scoring
- [x] **Find Discovery Shell** — 6 discovery modes (Events, Classes, Spots, Showtimes, Playbook, Regulars) with List/Calendar/Map views, density toggle, filter bar
- [x] **Interest chips** — 17-chip system (Music, Comedy, Art, Food & Drink, Nightlife, Film, Sports, Family, Theater, Fitness, Community, Learning, Wellness, Dance, Outdoors, Markets + Happy Hour + Free)
- [x] **Search** — Full-text (tsvector), instant search, suggestions, unified across events/venues/orgs/people
- [x] **Natural language search** — LLM-powered query parsing via `/api/search/nl`, context layering, fallback to keyword, daily quota + rate limiting
- [x] **Filters** — Category, date, price, neighborhood, content kind — progressive disclosure, availability-aware
- [x] **Collections** — User-created and editorial lists with visibility, featured ordering
- [x] **Explore tracks** — Curated venue-driven guides with tips, upvotes, community suggestions
- [x] **Trending** — Trending content API
- [x] **Neighborhood pages** — 45+ Atlanta neighborhoods with tier system, polygon auto-assignment
- [x] **Series & Festivals** — Film series, recurring shows, class series, festival programs
- [x] **Showtimes** — Cinema showtime aggregation
- [x] **Holiday campaigns** — Ramadan, Holi, WHM, St. Patrick's + linkable explore tracks
- [x] **Dead-content suppression** — Canonical event dedup, class/sensitive filtering at query level
- [x] **Social proof in feed** — Going/interested counts, friend RSVPs, "Your People" section

### Playbook / Outing Builder
- [x] **Playbook view** — Time-blocked unified discovery (events + specials + exhibits + festivals) with date navigation and category filtering
- [x] **Outing builder** — "Plan around this" on event cards, OutingDrawer with anchor event, OutingFAB persistence
- [x] **Outing suggestions** — Smart before/after venue suggestions based on proximity, open hours, walk time
- [x] **Itinerary system** — Full CRUD API (`/api/itineraries/*`), items with add/remove/reorder, walk distance calculations
- [x] **Playbook editor** — Full-page editor at `/{portal}/playbook/{id}` with Mapbox map, timeline spine, danger zone indicators (safe/warning/danger buffer calculations), inline title editing
- [x] **Playbook sharing** — Public share via token (`/{portal}/playbook/share/{token}`), read-only view with map + timeline
- [x] **Playbook list** — User's playbooks at `/{portal}/playbook` with create/delete
- [x] **Restaurant timing** — Dining timing calculator with service styles (quick_service through tasting_menu), seating windows, confidence scoring

### Portal System (B2B)
- [x] **Portal schema** — Multi-tenant with types (city, event, business, personal), JSONB branding/filters/settings
- [x] **Subdomain routing** — Portal middleware with custom domain resolution
- [x] **Portal branding** — Logo, colors, custom sections
- [x] **Portal filters** — Geo, category, date scoping per portal
- [x] **Portal admin** — Dashboard, analytics, sources, sections, subscriptions, QR codes
- [x] **Portal analytics** — Tracking, attribution, engagement reporting, export
- [x] **Portal custom content** — Portal-only events, featured items, announcements, section curation
- [x] **Portal members** — Roles (owner, admin, editor, viewer)
- [x] **Portal attribution** — `resolvePortalAttributionForWrite()` resolver, `portal_attribution_audit` view, RLS enforcement via `_portal_id()` functions
- [x] **Portal query scoping** — `buildPortalManifest()` + `applyManifestFederatedScopeToQuery()` standardized across all routes

### Real-Time & Places
- [x] **Google Places integration** — Full places table with PostGIS, scoring, attributes, hours, FTS
- [x] **Happening Now** — Live events API + portal-scoped happening-now
- [x] **Around Me** — Context-aware nearby discovery API
- [x] **Hospital nearby places** — Materialized view with 5km proximity scoring
- [x] **Venue specials infrastructure** — Schema, API, UI, scraper all built
- [x] **Weather integration** — Portal weather endpoint, weather-aware feed reranking, weather discovery sections

### Growth Features
- [x] **User submitted events** — Submission flow with AI pre-fill, image upload, moderation queue
- [x] **Venue/org submissions** — Submit new venues and organizations
- [x] **Organizations/Producers** — Full schema with slugs, logos, following, event linking, tags
- [x] **Venue claiming** — Claim workflow with verification, roles (owner/editor/manager), admin approval
- [x] **Newsletter** — Subscription and digest API
- [x] **Tag voting** — Cross-entity voting system (venues, orgs, events, producers) with up/down/remove

### Hospital/B2B & Specialty Portals
- [x] **Hospital portal template** — Hospital pages, discharge planning, nearby places
- [x] **Healthcare filters** — heart_healthy, low_sodium, diabetic_friendly on places
- [x] **Concierge experience** — Orchestrated recommendations for hotel/hospital portals
- [x] **FORTH Hotel portal** — Tonight picks, neighborhood blocks, specials, concierge CTA, studio mode
- [x] **Emory portal** — Campus-specific experience with category pathway highlights
- [x] **Dog adoption portal** — Specialty vertical demo
- [x] **Community hub** — Community engagement pages
- [x] **Best-of voting** — Nomination and voting system

### Infrastructure
- [x] **API rate limiting** — Strict prod backend with daily quotas
- [x] **Cache coalescing** — Discovery API fanout optimization
- [x] **Signal tracking** — Analytics pipeline for views, clicks, saves, calendar adds
- [x] **Image proxy** — CDN-friendly image serving
- [x] **CSP reporting** — Content Security Policy monitoring
- [x] **Find filter analytics** — Instrumentation for filter usage patterns
- [x] **Portal attribution tests** — Test suites for attribution, isolation, scope, route guards
- [x] **Staging crawler support** — `--db-target staging` flag, staging credentials config, dry-run capability

---

## Tier 0: Attribution + Data Integrity (Do First)

### 0.1 Strict Portal Attribution Hardening
**Status:** Attribution resolver and audit infrastructure built. DB columns missing on 3 tables.

- [x] `resolvePortalAttributionForWrite()` utility — detects portal context from body, headers, query params, cookies, referrer
- [x] `inferred_preferences.portal_id` — migration 171, API writes portal_id on upsert
- [x] `portal_attribution_audit` view — migration 243, covers 10 tables, shows last 7 days with % missing
- [x] Events RLS enforcement — migration 245, `_portal_id()` and `_portal_source_ids()` functions
- [ ] **Add missing DB columns**: `event_rsvps.portal_id`, `saved_items.portal_id`, `activities.portal_id` — code writes them but columns don't exist in migrations
- [ ] Attribution lineage for global enrichments (`contributed_by_portal_id`, `enrichment_source`) across tags/claims flows

### 0.2 Data Quality as Sales Readiness
- [x] Content health audit script (`data_health.py` with baseline snapshots, final audit report)
- [x] Source health monitoring with circuit breakers and health tags
- [x] Crawler health DB (`crawler_health.db`, 2.5MB of performance data)
- [ ] Automate weekly `data_health.py` runs and track trendline
- [ ] Identify and fix/disable top 20 degraded crawlers
- [ ] Enforce field coverage targets for events and venues (time, description, image, geo, tags)
- [ ] Add quality gates for demo-critical sources used in Atlanta + FORTH experiences

### 0.3 Crawler Staging Validation Pipeline
- [x] Staging database config (`config.py` with `STAGING_SUPABASE_URL`, `--db-target staging` flag)
- [x] Dry-run capability (`python main.py --db-target staging --dry-run`)
- [ ] Run full staging dry-run crawl and capture health baseline
- [ ] Add pre-prod validation checklist: crawl success rate threshold, error-type review, top-source diff checks
- [ ] Define promotion gate from staging to production runs and document rollback path

### 0.4 Venue Specials Infrastructure
**Status:** Infrastructure complete. Specials render on venue detail pages. NOT a feed section (product decision 2026-03-05).

- [x] Schema, API (`/api/specials`), UI (`VenueSpecialsSection`), scraper (`scrape_venue_specials.py`) all built
- [x] Deployed in FORTH portal with themed specials sections
- [x] **Backfill: scraped 88 Atlanta bars/restaurants** — series + specials data
- [x] **Integrated scraper into main.py** (`--specials` flag) and post_crawl_maintenance.py (biweekly cadence)
- [x] **Expanded routing** — food nights, happy hours, brunches route to events via `_FOOD_NIGHT_RE`
- [x] **Regular Hangs in Atlanta feed** — recurring events with activity chips (trivia, karaoke, open mic, etc.)
- [x] **Source 1177 migration** (2026-03-05) — 207 food/drink events deactivated, 12 venue_specials inserted, 34 real events kept
- [x] **Shared utils extracted** — `specials-utils.ts` with `isActiveNow()`, `formatDays()`, `formatTimeWindow()`, ISO 8601 day handling
- [x] **ISO day bug fixed** — `isActiveNow()` now correctly converts JS `getDay()` (0=Sun) to ISO 8601 (1=Mon, 7=Sun)
- [x] **Venue detail rendering** — `VenueSpecialsSection` shows specials on venue pages
- [ ] **Price badges in Regular Hangs UI** — show `series.price_note` on event rows
- [ ] **Confidence decay cron** — downgrade series confidence when `last_verified_at > 30 days`
- [ ] **Data enrichment** — specials data is thin (~60 Atlanta records). Needs scraper coverage expansion before specials become a Find filter.

**Product decision (2026-03-05):** Evaluated adding a "Deals & Specials" venue-card section to the Regulars tab. Rejected — fails product smell test: (1) ~60 specials from one bad source is not a section, (2) mixing venue attributes with recurring events confuses intent, (3) not curated enough for LostCity quality bar. Specials are **venue metadata** shown on venue detail pages, not a discovery surface. Revisit when data is 10x richer and could work as a Find filter ("show venues with active specials").

---

## Tier 1: Launch Proof (Atlanta + Demos)

### 1.1 Atlanta Usage Engine (Primary Product Surface)
- [x] For You feed redesign shipped
- [x] Find filters with progressive disclosure and availability-awareness
- [x] Holiday campaigns with linkable explore tracks
- [x] Find filter analytics instrumentation
- [x] Neighborhood pages with polygon pipeline
- [x] Dead-content suppression (canonical dedup, class/sensitive filtering)
- [x] Tonight/weekend relevance (evening queries, time-of-day sections, weekend boundary logic)
- [x] RSVP/save/follow visibility (social proof counts, friend RSVPs, "Your People" section)
- [x] Mobile responsiveness (responsive EventCard, fluid layouts, Tailwind breakpoints)
- [ ] Strengthen Atlanta analytics for sales proof: growth, retention proxies, engagement depth
- [ ] Resolve remaining rough edges on core event/venue UX

### 1.2 FORTH Hotel Demo
- [x] FORTH-specific concierge UX (tonight picks, neighborhood blocks, specials, studio mode)
- [x] Specials integration deployed in FORTH portal
- [x] Concierge components (HeroSection, HappyHourRail, BestBetCard, WeekendCuration, ConciergeBrief)
- [x] Portal attribution wired through concierge orchestrator
- [x] Attribution test suite (portal-attribution, isolation, scope, route-guards)
- [ ] Final concierge experience polish
- [ ] Produce demo-ready storyline and QA checklist for live sales walkthroughs

### 1.3 Next Demo Verticals (Suggested)
- [ ] **Film Festival Demo:** schedule-first UX, screening/venue-aware discovery, series/program framing
- [ ] **Hospital Visitor Demo:** proximity + time-aware + accessibility-first recommendations
- [ ] Build as curated demo experiences (not self-serve productization yet)

### 1.4 Contextual Time-of-Day / Weather Feed
**Status:** Core infrastructure built and deployed. Content curation layer remaining.

- [x] Time-of-day sections: Right Now, Tonight, This Weekend, This Week (via `getTimeSlot()` + section builders)
- [x] Weather API integration (`/api/portals/[slug]/weather`, `getPortalWeather()`, weather discovery sections)
- [x] Weather-aware reranking (`getWeatherVenueFilter()`, `buildWeatherDiscoverySection()`)
- [x] Day-of-week keyword matching in specials (monday-sunday detection)
- [ ] Richer day-of-week context in feed: "Taco Tuesday Picks", "Trivia Monday", "First Friday art walks", "Game Day" when local teams play
- [ ] Weather banner on feed: "72° and gorgeous — get outside"
- [ ] Weekend forecast teasers

---

## Tier 2: Scale Foundations (Before Broad Customer Rollout)

### 2.1 Architecture for Scale
- [x] Portal-scoped API patterns standardized (`buildPortalManifest`, `applyManifestFederatedScopeToQuery`)
- [x] API rate limiting with strict prod backend and daily quotas
- [x] Cache coalescing across discovery APIs
- [x] Portal isolation and attribution test suites
- [ ] Improve indexing and query performance for portal-scoped reads/writes
- [ ] Expand API route test coverage beyond attribution/isolation
- [ ] Add operational dashboards for source health + attribution health + portal engagement

### 2.2 Portal Operations (Internal-first)
- [x] Portal admin dashboard with analytics, sources, sections, subscriptions, QR codes
- [ ] Improve minimum admin capabilities needed to support active demos and first customers

### 2.3 Natural Language Search
**Status:** Removed (2026-03-05). Route `/api/search/nl` deleted as part of portal-scope cleanup.

- [x] ~~LLM-powered query parsing~~ — removed, dead code. Standard full-text search + portal-scoped RPCs are the active search path.
- The NL search infrastructure was functional but not worth maintaining alongside the portal-scoped search system. If conversational search returns, it should be rebuilt on top of the current portal-scoped search RPCs rather than as a separate pipeline.

### 2.4 User Curations
**Status:** Both systems operational. Unification pending.

- [x] Collections API with visibility, featured ordering, community submissions
- [x] Explore tracks with tips, upvotes, community suggestions
- [x] Curation submissions and collaborator management endpoints
- [ ] Unify collections + explore tracks into "curations" — shared data model
- [ ] Open/closed/collaborative submission mode toggle
- [ ] Profile integration: curations visible on user profile, pinned curations
- [ ] Discovery: browse page, trending section in feed, search results

---

## Tier 3: Post-Launch / Post-Customer Pull

### 3.1 Self-Serve Portal Creation
- Public-facing "Create Your Portal" flow
- Plan selection and automated provisioning
- Expanded non-technical portal setup UX

### 3.2 Expanded Portal Admin Productization
- Team management UX polish
- Moderation workflows
- Advanced analytics exports and comparative reporting

### 3.3 Billing Productization
- Stripe lifecycle automation
- Plan enforcement at API and data boundaries
- Usage billing where relevant

### 3.4 Open Friend-Level Events
Lightweight casual events visible to friends and optionally friends-of-friends. Not a full public listing — more like "I'm going to the park Saturday, come through."

- Quick create: minimal fields — what, when, where
- Attach to existing platform event: "I'm going to Jazz in the Park, who's in?"
- Visibility: friends only, friends-of-friends, or invite-link
- Recurring support: "We do trivia every Tuesday at Midway"
- +1 toggle, lightweight coordination thread
- Friends-of-friends discovery in activity feed

Dependencies: auth (done), friends system (done), activity feed (done).

### 3.5 Social Layer Polish
Infrastructure is built (profiles, follows, friends, activities, blocks, RLS policies) but discovery UX needs buildout.

- [ ] Influencer/curator profiles — tastemaker discovery surface
- [ ] Friend finder UX — match by interests, venues, attendance overlap
- [ ] Activity feed UI polish — infrastructure exists, UI is partial
- [ ] Destination check-ins with privacy levels
- [ ] Privacy controls UI — DB-modeled with per-action visibility, not fully surfaced in settings

---

## Tier 4: Iceboxed Until After Launch

### 4.1 Public Developer API
- `withApiKey()` middleware exists (infrastructure ready)
- Public `/api/v1/*` surface
- OpenAPI docs + developer portal
- External partner programs

### 4.2 Broader Platform Surfaces
- Embeddable widget productization
- Multi-city expansion at scale
- Long-tail vertical templates beyond active sales priorities

### 4.3 Religious Venue Service Times
- Add `service_times` JSON field on venues
- Enrichment pass: scrape/LLM-extract service schedules
- "Services Today" filter, "Next service: Sunday 11am" on venue cards
- Covers church, temple, mosque, synagogue, monastery venue types

### 4.4 Groups & Group Calendars
Interest/neighborhood/social groups with their own event calendars.

- Groups: open, request-to-join, or invite-only
- Subscribable via Google/Apple Calendar (.ics feed per group)
- Group events can cross-post to main feed
- Discovery: browse by category, neighborhood, trending
- Roles: owner, admin, member

Dependencies: auth (done), calendar integration (done), friends system (done).

### 4.5 Group Outing Planner — Phase 2+
**Status:** Phase 1 shipped as Playbook feature (see Completed Foundation). Remaining phases are social/group coordination.

Phase 2 (Sharing & Invites):
- Share playbook via link or to specific friends
- Collaborative editing (friend can add/remove stops)
- "Who's in?" RSVP on shared playbooks

Phase 3 (Group Coordination):
- When2Meet-style availability polling
- Vote on suggested stops
- Group chat / coordination thread

Dependencies: Playbook Phase 1 (done), friends system (done).

---

## Reference Documents

| Document | Purpose |
|----------|---------|
| STRATEGIC_PRINCIPLES.md | Core hypotheses and decision framework |
| ARCHITECTURE_PLAN.md | Gap analysis and implementation phases |
| TECH_DEBT.md | Code-level debt and system health items |
| PORTAL_PREMIUM_UX_BACKLOG.md | Agent-optimized premium UX execution spec (Atlanta-first, parallel dispatch) |
| COMPETITIVE_INTEL.md | Competitor analysis and battle cards |
| GTM_STRATEGY.md | Go-to-market sequencing and target prioritization |
| NOVEL_TARGETS.md | 15 novel B2B target segments |
| MONETIZATION_PLAYBOOK.md | Revenue models beyond portal subscriptions |
| SALES_ENABLEMENT.md | Demo scripts, one-pagers, objection handlers |
| docs/playbook-prd.md | Playbook feature PRD (Phase 1 complete) |
