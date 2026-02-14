# Architecture Plan: Portal Federation & Bespoke Frontends

## Portal Surfaces Contract (Hard Boundary)

This architecture supports two separate products that share infrastructure but must not share UX intent:
- `Consumer Portal` — end-user product (patients/guests/filmmakers/residents).
- `Admin Portal` — operator product (content management, governance, operations, analytics).

Authoritative contract: `docs/portal-surfaces-contract.md`.

Non-negotiable rule: do not conflate consumer and admin concerns in IA, copy, routing, or feature acceptance criteria.

## Execution Update (2026-02-11)

This architecture remains directionally correct, but execution order is now constrained:

1. **Strict portal attribution is launch-critical** and takes precedence over feature expansion.
2. **Atlanta usage + quality proof** is the primary validation loop before broad productization.
3. **Vertical demos are operator-led** (FORTH first, then additional demos), not self-serve.
4. **Self-serve Admin Portal onboarding/expansion is deferred** until customer pull.
5. **Public Developer API is iceboxed until post-launch traction.**

## Current State Assessment

### What's Already Built (and it's a lot)

**Portal System** — fully operational:
- Portal model with types (city/event/business/personal), plans (starter/pro/enterprise)
- `parent_portal_id` for hierarchy/inheritance
- Custom domain routing (subdomain + CNAME via middleware)
- Portal branding (colors, fonts, visual presets, card styles, ambient effects)
- Portal members & roles (owner/admin/editor/viewer)
- Portal sections (auto/curated/mixed with auto_filter JSONB)
- Portal content (featured events, announcements, custom events with pinning)

**Federation** — core mechanics exist:
- `source_sharing_rules` — how source owners share data (all/selected/none + category constraints)
- `source_subscriptions` — portals subscribe to shared sources
- `portal_source_access` — materialized view pre-computing effective access
- Event isolation via `portal_id` inherited from `source.owner_portal_id` (trigger-based)
- Category-level access control on both sharing and subscription sides

**Shared Auth** — works across portals:
- Supabase auth (email + Google OAuth)
- Unified `profiles` table with preferences
- `inferred_preferences` for behavioral learning (category, venue, neighborhood, time_slot, org)
- Trust tier system for submissions
- Session refresh in middleware, cookie-based

**Data Layer** — rich and comprehensive:
- 100+ tables covering events, venues, orgs, series, festivals, artists
- Submissions workflow with portal-scoped moderation
- Venue claiming (`entity_claim_requests` → `entity_claims` with roles)
- Community venue tagging with voting and suggestions
- Lists with portal scoping and contribution controls
- Social features (follows, friends, activities, notifications, invites)
- Full-text search (tsvector on events, venues, orgs)
- Deduplication via content_hash

**API** — solid foundation:
- 138 API routes with auth middleware wrappers (withAuth, withOptionalAuth)
- Rate limiting per user per endpoint
- Service client for admin operations
- `api_keys` table exists (scopes, portal_id, expiry)

**Crawler Pipeline** — proven at scale:
- 500+ sources with auto-enrichment (TMDB, Spotify/Deezer, Google Places)
- Validation layer with hard rejections + warnings
- Series/festival/class rollup logic
- Crawl health logging and tracking

---

## Gap Analysis

### Surface Ownership By Gap

| Gap | Primary Surface | Notes |
|-----|------------------|-------|
| Gap 1: Cross-Portal Enrichment Flow | `admin` + shared data layer | Admin actions write enrichments; consumer may read outcomes |
| Gap 2: Cross-Portal User Graph | `consumer` + shared data layer | Consumer behavior and personalization |
| Gap 3: Public Developer API | `admin`/platform | Not a consumer UX surface |
| Gap 4: Bespoke Frontend Architecture | `consumer` | Vertical-specific end-user experiences |
| Gap 5: Admin Portal Analytics | `admin` | Operator reporting and decisions |
| Gap 6: Billing Integration | `admin` | Operator billing and plan controls |
| Gap 7: Venue Self-Service | `admin` | Claimed-entity management workflows |

### What's Missing for the Full Vision

#### Gap 1: Cross-Portal Enrichment Flow
**Status**: Partially exists
**What we have**: `portal_content` stores per-portal featured/pinned content. `venue_tags` are global. `entity_claims` are global.
**What's missing**: When a hotel concierge pins a venue or adds a note, that enrichment is portal-scoped (`portal_content`). It doesn't flow back to enrich the global data layer for other portals.

**Fix**: Create a distinction between:
- **Portal-local overrides** (pinned order, display preferences) — stay in `portal_content`
- **Global enrichments** (venue quality signals, accessibility tags, corrections) — flow to shared tables (`venue_tags`, `venues`, etc.)

When a portal admin tags a venue as "wheelchair accessible," that should go to `venue_tags` (global), not `portal_content` (scoped). The key principle: facts are global, preferences are local.

**Implementation**:
- [ ] Audit `portal_content` — which actions are facts vs. preferences?
- [ ] Route fact-type enrichments to global tables with `contributed_by_portal_id` attribution
- [ ] Keep display-order and pinning in `portal_content`
- [ ] Add `enrichment_source` column to `venue_tags` (crawled/admin/portal/community)

---

#### Gap 2: Cross-Portal User Graph
**Status**: Partially exists
**What we have**: Shared auth, `inferred_preferences` tracks behavioral signals, `activities` logs user actions, `user_preferences` stores explicit preferences.
**What's missing**: Are `inferred_preferences` and `activities` portal-aware? If a user interacts with events on the hotel portal and later uses the film portal, does the preference engine know about both?

**Fix**: Ensure user behavior data is stored globally (not portal-scoped) but tagged with portal context. The recommendation engine should aggregate across portals.

**Implementation**:
- [ ] Add `portal_id` column to `activities` and `inferred_preferences` (for attribution/analytics) but always query across all portals for recommendations
- [ ] The "For You" feed on any portal should reflect the user's full cross-portal taste profile
- [ ] Portal analytics can see activity within their portal; user recommendations see everything
- [ ] Privacy: users should be able to see which portals have their data (settings page)

---

#### Gap 3: Public Developer API
**Status**: Table exists, no product (**Iceboxed until post-launch**)
**What we have**: `api_keys` table with scopes, portal_id, expiry, key_hash. The internal API routes handle auth and rate limiting.
**What's missing**: No external-facing API documentation, no developer onboarding, no separate rate limit tiers for API consumers vs. web users.

**Fix**: The current API routes already return JSON. The gap is primarily:
1. API key authentication middleware (check `api_keys` table instead of Supabase session)
2. API-specific rate limits (tied to plan tier)
3. Documentation (OpenAPI/Swagger)
4. Developer portal (signup, key management, usage dashboard)

**Implementation**:
- [ ] Create `withApiKey()` middleware wrapper alongside `withAuth()`
- [ ] API key auth: look up key_hash, check scopes, check portal_id for data scoping
- [ ] Rate limits by plan: free (1k/day), starter (10k/day), pro (100k/day), enterprise (unlimited)
- [ ] Expose subset of read endpoints under `/api/v1/` prefix
- [ ] Auto-generate OpenAPI spec from route definitions
- [ ] Developer portal page at `/developers`

**Execution note**: keep existing analytics/API-key plumbing for internal and admin use only until launch metrics validate expansion.

---

#### Gap 4: Bespoke Frontend Architecture
**Status**: One Next.js app with theming
**What we have**: Single Next.js app at `/web` with portal-aware components, visual presets, and `PortalProvider` context. All portal UIs share the same component library.
**What's missing**: The strategic hypothesis says radically different frontends per vertical. Currently, every portal looks like a themed version of the same app.

**Fix**: This is the biggest architectural decision. Three approaches:

**Option A: Separate Apps per Vertical** (maximally bespoke)
```
/web          → Default city portal frontend (Atlanta, Nashville, etc.)
/web-hotel    → Hotel concierge frontend (completely different UI)
/web-film     → Film festival frontend (schedule builder, etc.)
/web-hospital → Hospital visitor frontend (proximity-focused, accessible)
```
Each is a separate Next.js app sharing:
- Supabase auth (same project, same cookies)
- API layer (same `/api/` endpoints, or extracted to standalone API)
- Types and data access utilities (shared package)

**Option B: Monorepo with Shared Core** (balanced)
```
packages/
  core/          → Auth, API client, types, data hooks
  ui-primitives/ → Minimal shared primitives (not a design system)
apps/
  city/          → Default city portal
  hotel/         → Hotel concierge
  film/          → Film festival
  hospital/      → Hospital visitor
```
Turborepo or similar. Each app imports from `core` but has its own UI layer.

**Option C: Single App with Route-Based Verticals** (pragmatic)
```
/app/[portal]/                → Default layout
/app/[portal]/(hotel)/        → Hotel-specific layout + pages
/app/[portal]/(film)/         → Film-specific layout + pages
/app/[portal]/(hospital)/     → Hospital-specific layout + pages
```
Portal `settings.vertical` determines which route group renders. Shares one deployment but allows completely different page structures per vertical.

**Recommendation**: Start with **Option C** (pragmatic). It keeps deployment simple, shares auth naturally, and still allows radically different UIs per vertical via Next.js route groups. Move to **Option B** if/when the verticals diverge enough that a single app becomes unwieldy. Avoid Option A until you have 10+ verticals — the deployment overhead isn't worth it early on.

**Implementation**:
- [ ] Add `vertical` field to portal settings (city/hotel/film/hospital/community/fitness/etc.)
- [ ] Create route groups per vertical with independent layouts
- [ ] Each vertical has its own component directory (no shared design system between verticals)
- [ ] Shared: auth, data hooks, API client, types
- [ ] Not shared: visual design, page structure, navigation patterns, component implementations

---

#### Gap 5: Admin Portal Analytics
**Status**: Basic crawl logs exist, no portal-facing analytics
**What we have**: `crawl_logs` tracks crawler execution. `activities` logs user actions. No Admin Portal dashboard showing engagement metrics.
**What's missing**: Admin Portal users need to see: page views, event clicks, popular venues, user engagement, search queries, RSVP counts.

**Fix**: Build analytics from existing data + lightweight event tracking.

**Implementation**:
- [ ] Track portal-scoped page views (lightweight, maybe PostHog or custom)
- [ ] Aggregate `activities` + `event_rsvps` + `saved_items` by portal for admin dashboard
- [ ] Admin Portal dashboard showing: active users, popular events, search terms, engagement trends
- [ ] For venue analytics (future product): views per venue, click-through, comparative metrics
- [ ] Export capability for portal admins (CSV/PDF reports)

---

#### Gap 6: Billing Integration
**Status**: Plans defined, no payment processing
**What we have**: Portal `plan` field (starter/professional/enterprise). Feature flags based on plan.
**What's missing**: No Stripe integration, no billing UI, no plan upgrade flow.

**Fix**: Integrate Stripe for subscription billing.

**Implementation**:
- [ ] Stripe Customer per portal owner (org or user)
- [ ] Stripe Subscription per portal, mapped to plan tier
- [ ] Webhook handler for subscription events (upgrade, downgrade, cancel, payment failure)
- [ ] Billing settings page in Admin Portal
- [ ] Plan limits enforced at API level (not just UI)
- [ ] Usage-based billing option for API product (metered billing)

---

#### Gap 7: Venue Self-Service
**Status**: Claiming exists, limited management
**What we have**: `entity_claim_requests` + `entity_claims` with verification flow. `submissions` for user-submitted events/venues.
**What's missing**: Full venue management UI after claiming. Venues need to: edit their listing, submit events, see engagement analytics, respond to tags, upload photos.

**Fix**: Build venue management portal (a vertical in itself).

**Implementation**:
- [ ] Post-claim: venue owner gets management dashboard
- [ ] Edit venue details (hours, description, images, vibes, accessibility info)
- [ ] Submit events directly (bypass crawler for owned venues)
- [ ] View analytics (how many portals show this venue, view counts, saves)
- [ ] Respond to community tags (confirm/deny "wheelchair accessible" etc.)
- [ ] "Verified" badge displayed on venue across all portals
- [ ] Notification when a portal features their venue

---

## Architecture Overview

```
                    ┌─────────────────────────────────┐
                    │         Shared Auth              │
                    │     (Supabase, cross-portal)     │
                    └──────────────┬──────────────────┘
                                   │
                    ┌──────────────┴──────────────────┐
                    │         API Layer                │
                    │   /api/* routes + /api/v1/*      │
                    │   (withAuth, withApiKey)          │
                    │   Rate limiting by plan           │
                    └──────────────┬──────────────────┘
                                   │
              ┌────────────────────┼───────────────────────┐
              │                    │                        │
    ┌─────────┴────────┐  ┌────────┴────────┐   ┌──────────┴─────────┐
    │ Consumer Portals  │  │  Admin Portal   │   │ Shared Service APIs │
    │ city/hotel/film   │  │ content+ops+BI  │   │ internal/external   │
    │ patient/guest/etc │  │ operator-facing │   │ clients             │
    └───────────────────┘  └─────────────────┘   └─────────────────────┘
              │                    │
              └────────────────────┼───────────────────────┘
                                   │
                    ┌──────────────┴──────────────────┐
                    │      Data Federation Layer       │
                    │                                  │
                    │  ┌──────────────────────────┐   │
                    │  │ Global Data Layer         │   │
                    │  │ Events, Venues, Tags,     │   │
                    │  │ Enrichments, User Graph   │   │
                    │  └──────────┬───────────────┘   │
                    │             │                    │
                    │  ┌──────────┴───────────────┐   │
                    │  │ Portal Scoping            │   │
                    │  │ source_sharing_rules      │   │
                    │  │ source_subscriptions      │   │
                    │  │ portal_source_access (MV) │   │
                    │  │ portal_content (local)    │   │
                    │  └──────────────────────────┘   │
                    └─────────────────────────────────┘
                                   │
                    ┌──────────────┴──────────────────┐
                    │      Crawler Pipeline            │
                    │  500+ sources → validate →       │
                    │  enrich → dedupe → insert         │
                    │  + Venue self-service submissions │
                    └─────────────────────────────────┘
```

---

## Enrichment Flow Design

The key architectural principle: **facts are global, preferences are local.**

```
Admin Portal Action             → Where It Goes
────────────────────────────── → ──────────────────────────
Pin venue to top of feed         → portal_content (local)
Set display order of sections    → portal_sections (local)
Tag venue as "wheelchair access" → venue_tags (global) + contributed_by_portal_id
Correct venue address            → venues table (global) + edit_source attribution
Add venue hours                  → venues table (global)
Rate/review a venue              → venue_ratings (global, new table)
Flag venue as permanently closed → venues table (global)
Feature an event                 → portal_content (local)
Submit a new event               → events table (global) via submissions workflow
Hide an event from their portal  → portal_content exclusion (local)
```

This means every Admin Portal interaction that produces a **fact** enriches the global layer. Every Admin Portal interaction that expresses a **preference** stays scoped.

---

## Cross-Portal User Graph Design

```
User interacts on Hotel Consumer Portal:
  → activities (global, portal_id = hotel for attribution)
  → inferred_preferences updated (global, aggregated)
  → saved_items (global)

User later visits Film Consumer Portal:
  → "For You" feed reflects hotel preferences + film preferences
  → Recommendations span both portals' data
  → User sees same saved items

User visits City Consumer Portal:
  → Full aggregated taste profile
  → Most personalized experience (has data from hotel + film + city)
```

**Privacy model**: Users can see which portals they've interacted with. Admin Portal users can see aggregate analytics but NOT individual user profiles from other portals.

---

## Implementation Priority

### Phase 1: Attribution + Launch Proof (Weeks 1-4)
Things that unblock trustworthy sales demos and hypothesis validation.

- [ ] Enforce strict portal attribution across behavior, enrichment, and analytics writes
- [ ] Ensure cross-portal preference aggregation is portal-attributed and auditable
- [ ] Improve Atlanta usage/quality metrics and reporting (core sales proof)
- [ ] Complete FORTH hotel demo polish with attribution QA
- [ ] Build one additional high-priority demo vertical (film or hospital)

### Phase 2: Enrichment Layer (Weeks 5-8)
Things that activate the network effect.

- [ ] Implement fact vs. preference routing for portal admin actions
- [ ] Add `contributed_by_portal_id` to global enrichment tables
- [ ] Build venue claiming + self-service management UI
- [ ] Add "Verified" badge for claimed venues
- [ ] Venue event submission (bypass crawlers for claimed venues)

### Phase 3: Revenue Infrastructure (Weeks 9-12)
Things that let you charge money without premature platform expansion.

- [ ] Stripe billing integration (subscriptions per portal)
- [ ] Plan enforcement at API level
- [ ] Portal analytics improvements used directly in sales and renewal conversations

### Phase 4: Post-Launch Platform Expansion
Activate only after launch traction and first customer pull.

- [ ] Public API with key auth, rate limits, docs
- [ ] Developer portal page
- [ ] Self-serve Admin Portal onboarding and broader operator productization
- [ ] Admin Portal analytics dashboard for paying customers

### Phase 5: Scale (Weeks 13+)
Things that compound the network.

- [ ] Additional vertical layouts (film, hospital, community, fitness)
- [ ] Venue analytics product (view counts, comparatives)
- [ ] Cross-portal recommendation engine
- [ ] Neighborhood association onboarding (free tier, enrichment-focused)
- [ ] Sponsored listings / self-serve promotion

---

## What NOT to Build

Per the strategic principles, explicitly avoid:

1. **A theme system** — No portal "themes" or "templates." Each vertical gets its own route group with independent UI. The API is the shared layer, not the components.

2. **Portal feature flags in shared code** — Don't add `if (portal.vertical === 'hotel')` in shared components. Build separate components per vertical.

3. **A configuration UI for layout** — Don't build a drag-and-drop portal builder. Build bespoke layouts with AI assistance. The cost of building a new layout is low; the cost of building a layout builder is high and constraining.

4. **Shared component library across verticals** — Primitives (buttons, inputs) can be shared. Page-level components should not be. A hotel event card should look nothing like a film screening card.

5. **User accounts per portal** — Auth is global. Never create portal-scoped user identities. One user, one profile, many portal interactions.

---

## Key Architecture Decisions to Lock In

1. **API-first**: Every piece of data accessible via API endpoint. Frontend never queries Supabase directly for mutations (already enforced).

2. **Federation at query time**: Events aren't copied to portals. They're filtered at query time via `portal_source_access`. This is already the pattern — keep it.

3. **Enrichments flow up**: Portal-generated facts enrich the global layer. This is the network effect mechanism.

4. **Preferences stay local**: Portal display configuration (pinning, ordering, hiding) is portal-scoped.

5. **User graph is global**: Preferences, activities, and saved items aggregate across portals. Recommendations reflect the full user, not one portal's view.

6. **Vertical = route group**: Each vertical is a Next.js route group with independent layouts and components, sharing only auth and data hooks.

7. **Crawlers + submissions coexist**: Crawled data and submitted data live in the same tables with source attribution. Neither replaces the other.
