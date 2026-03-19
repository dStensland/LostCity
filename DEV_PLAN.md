# LostCity Agentic Dev Plan

The playbook for what to build next and how. Written for AI agents.

Each phase is a self-contained block of work an agent can pick up cold. Phases within a tier can often run in parallel. Each phase lists: goal, files changed, concrete steps, and verification criteria.

**Principles for agent-driven development:**
- Prefer brute-force over elegance. 1,000+ crawlers > 1 smart abstraction.
- Every phase should be completable in one session with clear verification.
- Agents should be able to validate their own work (tests, type checks, data queries).
- When a phase says "for each X, do Y" — that's a parallelizable loop. Spin up agents.

**Key reference docs:**
- `.claude/north-star.md` — Mission, core bets, decision filters
- `STRATEGIC_PRINCIPLES.md` — Hypotheses and principles
- `BACKLOG.md` — Product roadmap
- `ARCHITECTURE_PLAN.md` — System gaps and implementation priorities
- `TECH_DEBT.md` — Code-level debt items
- `crawlers/CLAUDE.md` — Crawler patterns and data requirements
- `web/CLAUDE.md` — Web app patterns, auth, API routes

---

## Surface Declaration Rule (Required)

Every new phase/PRD/checklist must declare target surface:
- `consumer` — Consumer Portal
- `admin` — Admin Portal
- `both` — only if acceptance criteria are split by surface

If this declaration is missing, the work is not ready.

---

## Status

| Phase | Status | Date | Tier |
|-------|--------|------|------|
| **Foundation (Done)** | | | |
| A: Seal the Data Boundary | Done | 2026-02-10 | Data |
| B: Data Quality Triage | Done | 2026-02-10 | Data |
| C: Crawler Coverage Blitz | Done (batch 1) | 2026-02-10 | Data |
| D: Genre Backfill (events) | Done | 2026-02-10 | Taxonomy |
| E: Drop Subcategory | Done | 2026-02-10 | Taxonomy |
| F: Schema Migrations | Done | 2026-02-10 | Taxonomy |
| G: Onboarding Revamp | Done | 2026-02-10 | UX |
| H: User Profile & Preferences UX | Done | 2026-02-10 | UX |
| I: Discovery UX | Done | 2026-02-10 | UX |
| N: Strict Portal Attribution | Done | 2026-02-16 | Foundation |
| Q: Scale Guardrails | Done | 2026-02-16 | Foundation |
| **Live Portals** | | | |
| J: FORTH Hotel Concierge | Done | 2026-02-10 | Live Portal |
| K: Admin Portal Onboarding | Paused | 2026-02-10 | Admin |
| **Atlanta Consumer Quality** | | | |
| O: Atlanta Consumer Product | Active | 2026-03-09 | Live Product |
| **Portal Ecosystem** | | | |
| P1: HelpATL (Citizen) | Active | 2026-03-09 | Content Pillar |
| P2: Family Portal | Active | 2026-03-11 | Content Pillar |
| P3: Adventure Portal | Active | 2026-03-11 | Content Pillar |
| P4: Arts Portal | Design Complete | 2026-03-11 | Content Pillar |
| P5: Sports Portal | Active | 2026-03-11 | Content Pillar |
| **Data & Intelligence** | | | |
| S1: Crawler Scaling | Active (ongoing) | 2026-03-11 | Data |
| S2: Editorial + Occasion Intelligence | Done | 2026-03-11 | Data |
| S3: Interest Channels | Done | 2026-03-11 | Data |
| **Social Layer** | | | |
| T1: Hangs + Profiles | Done (v1) | 2026-03-10 | Social |
| T2: My Plans + Social Proof | Done | 2026-03-11 | Social |
| **Engineering Health** | | | |
| L: API Route Test Coverage | Backlog | — | Eng Health |
| M: Community Needs Tags | Backlog | — | Network |
| R: Public Developer API | Iceboxed | — | Platform |

---

## Reprioritization (2026-03-11)

We are no longer building demos. Every portal and product ships consumer-ready or doesn't ship.

**Strategic shift**: LostCity is now building a constellation of first-party content pillar portals alongside B2B distribution portals. Each content pillar produces unique entities that enrich the shared data layer. This is the growth engine — not just B2B sales.

1. **Consumer-grade quality on everything live.** Atlanta, FORTH, HelpATL — all must work unsupervised for real users.
2. **First-party portals are content factories.** Family, Adventure, Arts, Sports each introduce unique entity types (programs, trails, exhibitions, schedules) that make the whole network richer.
3. **Fix what's live before adding what's next.** Feature breadth without quality depth is demo thinking.
4. **Social layer is live — iterate on real usage.** Hangs, profiles, plans are shipped. Polish based on actual behavior.
5. **Strict portal attribution** across data, behavior, enrichment, and analytics.
6. **A live product with real users IS the sales motion.** Optimize for real usage, not presentation-readiness.
7. **Self-serve Admin Portal and Public API paused** until customer pull is real.

---

## Active Work

### Phase O: Atlanta Consumer Product Quality

**Surface:** `consumer`

**Goal:** Make the Atlanta consumer product good enough that someone would recommend it to a friend.

**Why:** Atlanta is a live consumer product, not a proof-of-concept. The bar is real daily usage.

**Core tasks:**
1. Tighten feed/search quality and ranking consistency.
2. Reduce low-quality/duplicate/noisy event surfacing.
3. Eliminate dead links, broken empty states, and confusing error states.
4. Improve conversion flows (RSVP/save/follow/return behavior).
5. Ensure every user-facing path works without supervision or explanation.
6. Editorial mentions and occasion intelligence live on venue detail pages.
7. Hangs and social proof integrated into discovery flows.

**Verification:** Cold-start test — someone unfamiliar with LostCity can open Atlanta, understand what it is, find something to do tonight, and get there. No dead ends.

---

### Phase P1: HelpATL — Lost City: Citizen

**Surface:** `consumer`

**Goal:** Ship HelpATL as a functional civic portal for real volunteer/civic users.

**Why:** First content pillar portal. Proves the model: unique entity types (volunteer opportunities, civic meetings, advocacy actions) enriching the shared layer.

**Current state:** Live with 786+ feed-ready events. CivicHero, CivicFeedShell, light-mode theme, source-backed badges all shipped. 87% of content from Hands on Atlanta.

**Remaining work:**
1. Fix HOA crawler error handling (primary content source).
2. School board crawlers (APS, Fulton, DeKalb) producing events.
3. Venue image enrichment (13% coverage).
4. Verify all hero CTAs lead to populated channels.
5. Cold-start test for a civic-minded Atlanta resident.

**Reference:** `prds/030-volunteer-engagement-capability.md`, migrations 288-350+

---

### Phase P2: Lost City: Family

**Surface:** `consumer`

**Goal:** Ship a family activities portal with programs as a first-class entity.

**Why:** Programs (swim lessons, summer camps, rec leagues) are a new entity type that no competitor handles well. Massive data moat — 5,000+ family events/programs across parks & rec departments, private venues, and community orgs.

**Unique entities:** Programs (structured activities with sessions, age ranges, registration links).

**Current state:** Schema built (`programs` table, `age_min`/`age_max` on events, `school_calendar_events`). 28+ crawlers built (Cobb/Gwinnett/Atlanta/DeKalb parks & rec, YMCA 22 branches, Children's Museum, Puppetry Arts, swim schools, summer camps). Hooky now has live `programs` inventory, in-feed school-calendar + registration-radar surfacing, and a live crew setup tab instead of placeholder shell states.

**Design:** Warm amber (Outfit font, honey #C48B1D, sage #7D8B72, cream #F3EEE8). Tagline: "Play hooky."

**Remaining work:**
1. Source registration migrations for all 28+ crawlers.
2. Broaden Family feed depth beyond the current tabs so more of the portal feels program-native rather than event-adjacent.
3. Browser-verify the parent cold-start path and signed-in crew personalization path end to end.
4. Keep converting Family sources/backfills until Hooky inventory is comfortably dense across ages and seasons.

**Reference:** `prds/035-hooky-family-portal.md`

---

### Phase P3: Lost City: Adventure

**Surface:** `consumer`

**Goal:** Ship an outdoor adventure portal with destinations as the primary entity.

**Why:** Destinations-first portal (not events-first). Proves that persistent places (trails, campgrounds, parks) are independently valuable. Commitment filter (hour/halfday/fullday/weekend) is a novel UX pattern.

**Unique entities:** Outdoor destinations (trails, campgrounds, parks, waterfalls) with difficulty ratings, conditions intelligence, commitment levels.

**Current state:** Strategy locked. 31 curated destinations fully enriched. Nordic Brutalist design (Space Grotesk, terracotta #C45A3B, olive #6B8E5E, cream #F5F2ED). Pencil screens designed. NPS campground and public land trail data seeded. Accommodation inventory modeled.

**Design:** Sharp corners, heavy borders, terracotta accent. Tagline: "Wander over yonder."

**Remaining work:**
1. Web: destination detail pages, commitment filter, conditions intelligence.
2. Trip hangs (social coordination for outdoor plans).
3. Geographic scope expansion: Atlanta → North Georgia mountains.
4. Consumer-quality cold-start test for an outdoor enthusiast.

**Reference:** `prds/034-yonder-adventure-portal.md` and `prds/034a-034q` workstream docs

---

### Phase P4: Lost City: Arts

**Surface:** `consumer`

**Goal:** Ship an arts portal with exhibitions as the primary entity.

**Why:** Exhibition-first (not events-first). Core entity = EXHIBITION with run dates, not a single event. Killer feature: artist tracking across venues over time (living CV). Open calls aggregation for working artists.

**Unique entities:** Exhibitions (time-bounded, has run dates), Artists (tracked across venues), Studios/Workspaces (directory), Open Calls (deadline-driven submissions/residencies/grants).

**Current state:** Design complete — 5 Pencil screens. "Underground Gallery" aesthetic (dark warm canvas #141210, copper #C9874F, warm red #B54A3A). Type: Space Grotesk / Playfair Display italic / IBM Plex Mono.

**Design:** `// code comment` section headers, stroke-defined cards, zero corner radius, art provides the only color. Tagline: "Atlanta's underground art scene, surfaced."

**Remaining work:**
1. Schema: exhibitions table, artists table, studios table, open_calls table.
2. Crawlers: gallery exhibition scrapers, open call aggregation.
3. Web: all 5 screens (Feed, Exhibition Detail, Artist Profile, Open Calls Board, Studios).
4. Artist tracking: auto-update profiles when venues add exhibitions.
5. Consumer-quality cold-start test for a gallery-goer.

**Anti-features:** No social comments (tight community, wrong dynamics), no artist networking (they already know each other), no sales (Artsy exists).

---

### Phase P5: Lost City: Sports

**Surface:** `consumer`

**Goal:** Ship a sports portal spanning spectator, social, and participation tiers.

**Why:** Three-tier coverage is unique — no one else combines pro team schedules with bar watch parties with rec league signups. Data already crawled for 15+ teams.

**Unique entities:** Team schedules (structured game data), watch party venues (social layer), rec leagues/pickup (participation programs).

**Current state:** Pro team crawlers live (Hawks, United, Dream, Gladiators, Swarm, Hustle, Skyhawks, Stripers, LOVB). Watch party bar crawlers active (ATL UTD pubs, Hawks bars, Sports Social). Pencil design in progress.

**Remaining work:**
1. Schema: structured game/match data (opponent, score, broadcast info).
2. Web: game day experience, watch party finder, rec league discovery.
3. Participation tier: pickup games, rec leagues, adult sports.
4. Consumer-quality cold-start test for a sports fan.

---

### Phase S1: Crawler Scaling (Ongoing)

**Surface:** infrastructure

**Goal:** Maintain and expand the 1,000+ source crawler fleet.

**Why:** Coverage is the moat. Every new source compounds defensibility.

**Current state:** 1,000+ active sources. Platform crawlers built: `_rec1_base.py` (Cobb+Gwinnett parks), ACTIVENet (Atlanta DPR+DeKalb), `_tribe_events_base.py` (WordPress venues), Eventbrite family URLs. UA rotation and 429/403 retry logic added.

**Ongoing work:**
- Fix broken/degraded crawlers as detected by health monitoring.
- Add crawlers for new venues and coverage gaps.
- Expand to new entity types as portals demand (programs, exhibitions, trails).
- Maintain crawler quality: first-pass capture of all signal, validation at ingestion.

---

### Phase S2: Editorial + Occasion Intelligence [DONE]

**Surface:** infrastructure

**Goal:** Build editorial mention tracking and occasion-based venue intelligence.

**Done:**
- `editorial_ingest.py`: RSS/sitemap pipeline across 4 sources (Eater, Infatuation, Rough Draft, Atlanta Eats). 193 mentions, 139 venues, 49 articles.
- `occasion_inference.py`: 14 occasions (date_night, groups, solo, etc.) inferred from venue attributes. 4,431 occasion rows across 2,491 venues.
- Web: "In the Press" + "Perfect For" sections on venue detail pages.

---

### Phase S3: Interest Channels [DONE]

**Surface:** infrastructure

**Goal:** Build interest-based content channels for cross-portal content organization.

**Done:** `interest_channels` table, `event_channel_matches` table, Atlanta seed data. Migrations 284-286.

---

### Phase T1: Hangs + Profiles [DONE v1]

**Surface:** `consumer`

**Goal:** Ship lightweight social coordination (check-ins, profiles, friend activity).

**Done:**
- Schema: `privacy_mode`, `user_regular_spots`, `user_portal_activity`, `get_public_profile` RPC, blocking/unfriending triggers, hangs RLS.
- API: `/api/profile/[username]`, `/api/hangs/venue/[id]`, `/api/hangs/friends`, `/api/auth/profile` PATCH.
- Components: ProfileView, PrivacyTierSelector, VenueHangStrip (compact+full), HangFeedSection, ActiveHangBanner.
- Feature flag: `ENABLE_HANGS_V1` in `lib/launch-flags.ts`.

---

### Phase T2: My Plans + Social Proof [DONE]

**Surface:** `consumer`

**Goal:** Plans page + join/RSVP notification flow.

**Done:** My Plans page, join/RSVP notifications, plan sharing. Shipped 2026-03-11.

---

## Backlog

### Phase L: API Route Test Coverage

**Surface:** `both`

**Goal:** Add tests for the most critical API routes.

**Priority routes:** `/api/rsvp`, `/api/saved`, `/api/auth/profile`, `/api/follow`, `/api/events`, `/api/spots`, `/api/tonight`, `/api/admin/portals`

**Pattern:** Mock Supabase, test auth (401/200), test validation (400), test happy path, test rate limiting.

---

### Phase M: Community Needs Tags

**Surface:** `consumer`

**Goal:** Extend venue tag voting to accessibility/dietary/family needs across all entities.

**Why:** PRD 004 identifies needs-verified data as the #1 most defensible data in the system. "Wheelchair accessible (47 confirm)" is data no competitor has.

---

### Phase R: Public Developer API [Iceboxed]

**Surface:** `platform`

**Goal:** Ship a public API for third-party developers.

**Why:** The endgame is infrastructure (Principle 10). Deferred until live portals prove the model and customer pull is real.

---

## Appendix: Agent Coordination

### How to hand off between agents

Each phase is designed so an agent can:
1. Read this file + `.claude/north-star.md` + the relevant CLAUDE.md + any referenced PRDs
2. Execute the steps
3. Run verification
4. Update the Status table at the top of this file

### Parallelization

- **S1** (crawler scaling) can run alongside ANYTHING — it's fully independent
- **O** (Atlanta quality) can run in parallel with any portal phase
- **P1-P5** (portal phases) are independent of each other — parallelize freely
- **L** (API tests) is independent of everything
- **M** (needs tags) can start anytime but is lower priority than portal work

### When to spin up sub-agents

- S1: one agent per 5-10 crawlers (batch by neighborhood or entity type)
- P1-P5: one agent per portal (each is independent)
- L: one agent per API route group
- Any phase that says "for each X, do Y" — parallelize across X
