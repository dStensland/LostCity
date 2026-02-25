# ATLittle Family Portal: Comprehensive Feature Plan

> **PRD 025** | February 2026 (Revised)
> **Status**: Draft v2 — post strategy/bizdev/COPPA audit
> **Depends on**: PRD 024 (Atlanta Families Strategy)
> **Portal**: ATLittle (Atlanta Family Activity Portal)
> **Audits incorporated**: Strategy alignment, go-to-market, COPPA compliance

## Context

The Atlanta family activity market is fragmented across booking platforms (ActivityHero, Sawyer), editorial sites (Mommy Poppins, Atlanta Parent), and newsletters/Facebook groups (Macaroni KID). No single product bridges discovery → comparison → planning → coordination. ATLittle fills this gap by combining LostCity's 844 crawlers, social graph, and portal system with family-specific features no competitor offers.

This plan defines what ATLittle needs from a feature standpoint to stand out, organized into 9 feature areas with clear prioritization (MVP → V1.5 → V2).

### Product Identity (V1)

ATLittle is a **planning utility** first. Not a marketplace, not a media product, not a SaaS tool. The V1 identity is: help parents compare, decide, and plan kid activities faster than opening 20 tabs. Marketplace and SaaS layers build on top of proven planning utility retention.

### Strategy Guardrails (from PRD 024)

The MVP must honor PRD 024's risk mitigation: **"prioritize compare/save/rank/alert path only."** Features that don't serve this path are deferred regardless of how easy they look. Specifically:

- Discovery pillar = age-appropriate filtering + ranking
- Decision support pillar = compare
- Planning pillar = shortlists + calendar export
- Trust pillar = freshness + source transparency + registration status

---

## Privacy & COPPA Compliance

### Design Principle: Stay Outside the COPPA Perimeter

ATLittle is a **parent-facing planning tool**. Children never create accounts, log in, or interact with the app. Parents manage household data about their children. This architecture is structurally similar to pediatric scheduling apps and family travel planners — neither of which are COPPA-regulated.

The FTC's updated COPPA rule (effective June 2025, **compliance deadline April 22, 2026**) focuses on services where children are users of the interface, not where parents manage data about children.

### Privacy Decisions

| Decision | Rationale |
|----------|-----------|
| **Age ranges, not birthdays** | Broad bands (toddler/elementary/tween) are not PII. Birthdays are. |
| **Nicknames, not real names** | "Bug" and "Monkey" are not identifiable. "Jackson Smith" is. |
| **Needs at household level, not per-child** | "Our family needs wheelchair access" is not about a specific child. `needs['nut_free']` on a specific child's record + age + nickname + neighborhood = potentially re-identifiable medical profile of a minor. **This is the highest-risk field in the entire PRD.** |
| **No school affiliation until legal review** | School + age + neighborhood = identifiable child. Deferred to V2 with mandatory legal sign-off. |
| **Social features show adult names only** | "Sarah is going" (parent name), never "Maya (age 4) is attending." |
| **Interests at household level** | Avoids building a behavioral profile of an individual minor. |

### Required Implementation (MVP)

1. **Signup age gate**: "I confirm I am 18 or older" — required for mixed-audience sites under updated COPPA rule
2. **Privacy policy update**: Replace current boilerplate with specific household data section covering what's collected, how it's stored, parental control/deletion rights
3. **`needs[]` on `household_preferences` only** — never on `household_members`
4. **Data deletion**: Parent can delete household and all associated child data at any time

### Required Before V1.5

5. **Parental acknowledgment**: "I am the parent/guardian of the children in this household" during onboarding
6. **Data retention policy**: `last_active_at` on households, auto-archive after 12 months inactivity
7. **Consent audit trail**: `household_consent_log` table

### Deferred to V2 (requires legal review)

8. **School/Group Affinity** — "5 families from Druid Hills Elementary" discloses which school a child attends. Must not ship without legal sign-off.

---

## Feature Area 1: Family Profiles & Household Management

**Why**: No competitor has any concept of a family profile. This is the foundation that personalization (V1.5) depends on.

### Phasing Decision (per strategy audit)

PRD 024 flags "family profile model depth for launch" as an **unresolved decision** (Section 17, item 3) and lists "multi-child preference memory" as a **Next capability** (Section 9.2), not a Now capability.

**MVP**: Lightweight profile — age range selector on user profile (not full household model). Enough to power age filtering and basic ranking boosts. No onboarding flow, no co-parent invite, no household tables.

**V1.5**: Full household model with onboarding, co-parent invite, and multi-child support. Ships after compare/save/freshness prove retention.

### MVP: Profile Age Context (S effort)

- Add `family_age_ranges[]` to existing `portal_preferences` (already has `travel_party: 'family'`)
- Simple inline prompt on first family portal visit: "What ages are your kids?" with age-range chips
- Stored at user level, not household level
- Powers age filtering + ranking boosts without new tables or onboarding flow

### V1.5: Full Household Model (M effort)

New tables:

```sql
-- households — core family unit
households:
  id, owner_id (→ profiles), name, home_neighborhood,
  home_lat/lng, max_drive_minutes

-- household_members — who's in the crew
household_members:
  id, household_id, member_type (parent/child/caretaker),
  nickname, age_range (infant/toddler/preschool/elementary/tween/teen),
  user_id (nullable — only for adults), invite_status
  -- NOTE: NO needs[] here — COPPA design-around

-- household_preferences — family-level settings (needs live HERE)
household_preferences:
  household_id, budget_preference, schedule_preferences[],
  needs_accessibility[], needs_dietary[]
```

Onboarding (3-step, skippable):
1. "Who's in your crew?" — Add children with nicknames + age range selectors
2. "What are they into?" — Interest selection per household
3. "Your home base" — Neighborhood + drive radius

Co-parent invite:
- Share link (uses existing `share_token` pattern from itineraries)
- Second parent gets write access to household

### Architecture Decision

- Household data is **NOT** portal-scoped (works across all LostCity portals, like profiles)
- **Open question**: The `member_type` and `age_range` enums are family-specific. If a pet portal or senior portal later needs household semantics, these enums need abstraction. For now, ship family-specific and refactor if a second portal type needs households. Document this as tech debt.

### Key files

- `portal_preferences` migration — add `family_age_ranges[]`
- V1.5: New migration for household tables (extends patterns in `database/migrations/011_users.sql`)
- V1.5: New onboarding components in `web/components/family/`

---

## Feature Area 2: Personalized Discovery

**Why**: Every competitor shows every parent the same page. A family with a toddler and a family with teens have totally different needs.

### Phasing Decision (per strategy audit)

Per-child personalized feed sections and the "Plan for" selector require the full household model (V1.5). The MVP needs simpler age filtering that works with the lightweight profile.

### MVP: Age-Appropriate Filtering (M effort)

- Add `min_age`/`max_age` integer columns to `events` table (nullable, crawler-extracted)
- **Content threshold**: min_age/max_age must be populated on ≥60% of family-tagged events before personalization is useful. Track this as a quality metric.
- Age filter dropdown in `FamilyDiscoveryView.tsx`: filter by age band
- Fallback to existing tag-based filtering (toddler, preschool, kids, tweens, teens) when `min_age`/`max_age` is null
- Mapping from user's `family_age_ranges[]` to auto-set default filter

### MVP: Search Ranking Extension (M effort)

Extend `web/lib/search-ranking.ts` with family boost factors:

| Boost Factor | Weight | Trigger |
|-------------|--------|---------|
| `ageMatch` | 25 | Event age range matches user's family age ranges |
| `interestMatch` | 15 | Category matches portal preferences |
| `sourceAuthority` | 20 | Official source (library, parks dept) outranks aggregator |
| `completeness` | 10 | Events with price + age + schedule + registration fully populated |

**Critical addition from strategy audit**: `sourceAuthority` and `completeness` boosts were missing from v1 of this PRD. PRD 024 explicitly calls for "source reliability weighting" and "completeness/quality score" as foundation capabilities.

### Baseline experience for non-household users

Users without family age ranges set see:
- All family-tagged events, sorted by: freshness → source authority → completeness → recency
- Prominent but non-blocking prompt to set age ranges
- No degraded experience — just unfiltered by age

### V1.5: Personalized Feed Sections (M effort)

- Modify `FamilyFeed.tsx` to generate sections per child: "Adventures for [Nickname]"
- Requires full household model
- Prioritize events matching household interests + drive radius
- Surface free events for budget-conscious households

### V1.5: "Plan for" Selector (M effort)

- Toggle at top of feed: `[Everyone] [Maya, 3-5] [Jackson, 6-10] [Date Night]`
- Changes all results, recommendations, and saved items context
- Requires full household model

### V1.5: "Good for your family" badge

- Computed on event cards when age + interest + distance all match
- Requires household with drive radius set

### V2: Behavioral Ranking Tuning

- Feed click-through rate, save rate, and compare rate back into ranking model
- PRD 024 calls for this in weeks 9-12 — captured here to ensure it's not forgotten

### Key files

- `web/components/family/FamilyDiscoveryView.tsx` (509 lines) — wire age filter
- `web/lib/search-ranking.ts` (404 lines) — add family + source authority + completeness boosts
- Events API — add `min_age`/`max_age` filter params

---

## Feature Area 3: Compare & Decide (MVP)

**Why**: ZERO competitors offer side-by-side comparison. Parents currently open 20 tabs. This is the most defensible feature in the entire plan.

### Compare tray (bottom sheet)

- Activates on "Compare" button tap on any AdventureTicket card
- Up to 4 items in tray
- Persists across navigation within portal
- State in `localStorage` (transient by design — no DB bloat)

### Comparison view

- Route: `/{portalSlug}?view=compare`
- **MVP ships 5 dimensions** (remaining 3 added in V1.5 when household model + social features are ready):

**MVP dimensions:**

| Dimension | Source | Display |
|-----------|--------|---------|
| Age Range | `min_age`/`max_age` or tags | Age band labels (V1.5: green check/red X per child) |
| Cost | `price_min`/`price_max` + `is_free` | Dollar signs or "Free" |
| Location | Venue address | Neighborhood + address (V1.5: drive time from home) |
| Schedule | `start_date`, `start_time`, recurrence | Calendar snippet |
| Freshness | Crawl log timestamp | "Updated 2 days ago" |

**V1.5 dimensions** (require household model or social features):

| Dimension | Source | Display | Dependency |
|-----------|--------|---------|------------|
| Registration | `registration_status` field | Open/Waitlist/Closed/Walk-in | Crawler extraction maturity |
| Ratings | `recommendations` table aggregation | Stars + count | Sufficient review volume |
| Friends Going | `event_rsvps` + social graph | Adult name avatar stack | Social features (FA9) |

### Share comparison

- Generate shareable link (existing `share_token` pattern)
- Read-only view (no account required)
- **V1.5**: Co-parent thumbs up/down voting (requires household model)

### Click-through attribution (MVP)

- **Critical addition from bizdev audit**: When a user clicks `registration_url` from the comparison or detail view, track it. This is the only way to prove ATLittle's value to providers later.
- `click_events` table: event_id, user_id, click_type (registration/website/directions), source_view (compare/detail/feed), timestamp
- This data powers the provider dashboard (V1.5) and is the foundation of the monetization thesis

### Mobile UX

- **MVP**: Responsive table/card layout (works on all viewports)
- **V1.5**: Optimized swipeable card stack for phones

### Key files

- New component: `web/components/family/CompareView.tsx`
- New component: `web/components/family/CompareTray.tsx`
- New migration: `click_events` table
- Extends `saved_items` pattern, `share_token` pattern from itineraries

---

## Feature Area 4: Planning & Coordination

### Family Shortlists (MVP)

- Extend `lists` table (migration `039`) with optional `household_id` column (nullable for MVP — personal shortlists work without household)
- New category: `'family_shortlist'`
- Default shortlists auto-created: "This Weekend", "Spring Break Ideas", "Summer Camps"
- Save action offers "Save to..." with shortlist picker
- **V1.5**: Visible to all household members (extend RLS when household model ships)

### Calendar Export (MVP)

- iCal export of shortlisted/saved events
- PRD 024 calls for "calendar export" as a leading indicator — ship the export, not a calendar app
- Simple .ics file generation from saved items

### Family Calendar Overlay (V1.5)

- Extend existing `CalendarView.tsx` with household overlay
- Color-coded lanes per household member
- Conflict detection for overlapping saved events
- Default to week view (families plan week-by-week)
- **Moved from MVP**: This is a calendar *application*, not a planning *primitive*. PRD 024's 90-day plan calls for "calendar-ready shortlist," which iCal export satisfies.

### Deadline Alerts (MVP)

- **Moved to MVP from V1.5**: PRD 024 puts alerts at weeks 6-8. The original v1 of this PRD deferred them to make room for features the strategy didn't call for. Corrected.
- New notification types: `registration_closing`, `price_change`, `spot_available`
- Background job checks `registration_deadline` against saved items
- Extends existing `notifications` table (migration `011`)

### Co-parent Plan Sharing (V1.5)

- Extend `plans` table with `household_id`
- All household parents can edit plans
- Share link works without account (view-only)

### Key files

- `database/migrations/039_community_lists.sql` — extend lists
- `web/app/api/notifications/route.ts` — new alert types
- V1.5: `web/components/CalendarView.tsx` — household overlay
- V1.5: `web/components/plans/` directory — extend for households

---

## Feature Area 5: Trust & Freshness (MVP)

**Why**: Stale data is the #1 reason parents distrust directories. No competitor systematically addresses this. Trust is a core pillar of PRD 024.

### Freshness badges

| Badge | Color | Criteria | Tooltip |
|-------|-------|----------|---------|
| **Live** | Green | Crawled within 48 hours | — |
| **Recent** | Blue | Crawled within 7 days | — |
| **Stale** | Yellow | 7-30 days | "May be outdated" |
| **Unverified** | Gray | 30+ days | "Check source" link |

- Data from `crawl_logs.completed_at` joined with events
- **Source reliability gate** (from strategy audit): A "Live" badge requires both recent crawl AND source authority ≥ medium. A listing crawled yesterday from a low-authority aggregator gets "Recent" at best, not "Live." This prevents the badge from being misleading.

### Source authority scoring (NEW — from strategy audit)

PRD 024 calls for "source reliability weighting" and "confidence penalties for directory-only links." This was missing from v1.

| Authority Level | Examples | Weight |
|----------------|---------|--------|
| **Official** | Atlanta-Fulton Library, Atlanta Parks & Rec, Fernbank | 1.0 |
| **Institutional** | Children's Museum, Alliance Theatre, Zoo Atlanta | 0.9 |
| **Curated** | Mommy Poppins, Atlanta Parent | 0.7 |
| **Aggregator** | Directory-only sources | 0.4 |

- Stored as `authority_level` on `sources` table (one-time manual classification of active sources, maintained as new sources are added)
- Feeds into ranking (FA2) and freshness badge eligibility

### Registration status tracking

- New fields on `events`:
  - `registration_status` (open/waitlist/closed/walk_in/sold_out/unknown)
  - `registration_url`
  - `registration_deadline`
  - `last_status_check_at`
- Crawlers extract during each cycle
- **Realistic expectation**: Most crawlers will not extract structured registration data at launch. Default to `unknown`. Track coverage % as a quality metric. Prioritize extraction for P0 sources (libraries, parks, museums).

### Source transparency

- Event detail shows: "This information comes from [Source Name]" with link
- Uses existing `sources` table

### Cross-source normalization (NEW — from strategy audit)

PRD 024 lists "cross-source normalization" as a core differentiator (#4) and "duplicate-item rate" as a quality guardrail. This was entirely missing from v1.

- **MVP**: Basic deduplication — same event title + same venue + same date = candidate duplicate. Surface dedupe candidates in admin tooling. Manual merge for MVP.
- **V1.5**: Automated entity resolution pipeline. Canonical event model with source attribution chain.

### Community verification (V1.5)

- "I confirmed this is still happening" button (lightweight verification)
- Aggregate into "Parent-Verified" badge

---

## Feature Area 6: Content Coverage Expansion

### Crawler Readiness Assessment

**Existing crawlers for P0 sources:**
- Atlanta-Fulton Library (BiblioCommons API)
- DeKalb Library, Gwinnett Library, Cobb Library (active)
- Children's Museum of Atlanta (Playwright)
- Fernbank Museum (Playwright)
- Zoo Atlanta, Georgia Aquarium (active)
- Atlanta Parks & Rec (active)
- Alliance Theatre (active)

**P0 gaps — crawlers needed before MVP launch:**
- Center for Puppetry Arts
- Cobb Parks & Rec
- DeKalb Parks & Rec
- Gwinnett Parks & Rec

**Minimum viable content threshold** (must be met before personalization is meaningful):
- ≥200 family-tagged events with `min_age`/`max_age` populated
- ≥50 events per age band (toddler, preschool, elementary, tween)
- ≥30 events with registration status ≠ unknown
- Track these as launch-gate quality metrics

### P0 — MVP

- **Libraries** (Atlanta-Fulton, DeKalb, Gwinnett, Cobb) — storytimes, STEM programs
- **Parks & Recreation** — Atlanta Parks, Cobb, DeKalb, Gwinnett
- **Museums kids programs** — Children's Museum, Fernbank, Center for Puppetry Arts

### P1 — V1.5

- YMCA/Community Centers
- Youth Sports Leagues (AYSO, Little League, metro rec)
- After-School Enrichment (STEM studios, art schools, coding)

### P2 — V2

- Teen Programs (volunteer, internships, pre-college)
- School District Calendars (APS, DeKalb, Cobb, Gwinnett)

### Taxonomy expansion in FamilyDiscoveryView

Add to existing 8 categories: STEM & Coding, Music & Dance, Art Classes, Teen Programs, Free Events, School Break

---

## Feature Area 7: Provider Ecosystem (V1.5 → V2)

**Why**: This is the monetization foundation. Providers pay for visibility to the audience ATLittle builds.

### Pre-requisite: Validation (before building)

**From bizdev audit**: The "compare data as selling point to providers" thesis is assumed, not validated. Before building the provider dashboard:

1. Interview 20 activity providers in Atlanta (mix of camps, enrichment, sports, studios)
2. Show mockups of the provider dashboard with sample analytics
3. Get 5 letters of intent at the $99/mo tier
4. If LOIs cannot be secured, pivot the monetization model before investing in provider features

### Pricing Reality Check

P0 content sources (libraries, parks, museums) are public institutions — they will not pay $99/mo. The paying provider market is P1 sources (enrichment, sports, studios) arriving in V1.5. Pricing tiers must target these private businesses, not public institutions.

### Claimed Listings (V1.5)

- New `provider_claims` table: `source_id`, `venue_id`, `claimed_by`, `claim_status`, `verification_method`
- Verification via email domain matching
- **Outreach plan required**: The first 50 claims will not happen organically. Define who contacts providers and how.

### Provider Dashboard (V1.5)

- Route: `/{portalSlug}/provider/[venueSlug]`
- Views, saves, compare appearances, click-throughs (powered by `click_events` from FA3)
- Ability to edit event details, update registration status

### Visibility Tiers (V2)

| Tier | Price | Features |
|------|-------|----------|
| Free | $0 | Standard crawled listing |
| Verified | $0 | Trust badge, edit access, basic analytics |
| Featured | $99/mo | Priority placement, featured in collections, full analytics |
| Premium | $249/mo | Sponsored placement, category banner, dedicated support |

---

## Feature Area 8: Smart Recommendations (V1.5 → V2)

### Dynamic Curated Collections (V1.5)

- "Rainy Day Rescues" only appears when weather forecast is rainy (from `portal_weather_cache`)
- "After School Today" appears weekday afternoons
- "This Weekend for [Nickname]" appears Thursday-Saturday

### AI "What should we do?" (V2)

- Combines household profile + weather + behavioral history + availability
- Returns 3-5 ranked recommendations with natural language reasoning
- Uses existing Claude API integration
- PRD 024 non-goal: "No hyper-custom AI concierge interactions before planner fundamentals are stable." This stays V2.

### Weekend Planner (V2)

- Guided flow: pulls household, checks saved events, finds gaps, proposes itinerary
- Output uses existing `itineraries` table

---

## Feature Area 9: Community & Social

### Friends Going on Cards (V1.5)

- **Moved from MVP**: Social proof is outside all four strategy pillars (Discovery, Decision Support, Planning, Trust). Ships when household model + social graph are wired.
- Wire existing `event_rsvps` + social proof aggregation to AdventureTicket cards
- **"Sarah + 2 others going"** — adult/parent names only, never children's names (COPPA design-around)

### Parent Reviews with Tips (V1.5)

- Extend `recommendations` metadata JSONB with:
  - `rating`
  - `age_appropriateness`
  - `tip`
  - `visited_with_ages`
  - `would_return`
- Sort reviews by relevance to viewing family's profile

### School/Group Affinity (V2 — requires legal review)

- Optional field on `household_preferences` (NOT `household_members`): `school_affiliation`, `group_affiliations[]`
- Enables "5 families from Druid Hills Elementary interested"
- **BLOCKED until legal review**: School + age + neighborhood = identifiable child. Must not ship without COPPA/privacy legal sign-off.

---

## Feature Area 10: Acquisition & Distribution (NEW)

**Why**: The bizdev audit identified zero acquisition infrastructure as the most critical gap. A product without users is not a product.

### MVP: Distribution Integration Points (M effort)

PRD 024 names three partner categories. The MVP must have hooks for at least one:

**Newsletter embed widget**:
- Embeddable "This Weekend in ATL for Kids" widget (iframe or web component)
- Targets: Macaroni KID Atlanta, Atlanta on the Cheap, neighborhood newsletters
- Shows top 5 age-filtered events with "See more on ATLittle" CTA
- Trackable via `utm_source` for attribution

**SEO landing pages**:
- Auto-generated pages: `/{portalSlug}/this-weekend`, `/{portalSlug}/free-events`, `/{portalSlug}/summer-camps-2026`
- Structured data (JSON-LD) for event listings
- These pages are the organic search entry point — without them, Google sends parents to Mommy Poppins

**Social sharing**:
- Open Graph meta tags optimized for family activity sharing
- "Share this comparison" generates a preview card showing the compared activities

### V1.5: Partner Integrations

- **Trust partner badges**: "Featured on ATLittle" badge for partner sites (libraries, museums) that link back
- **Referral program**: "Invite a parent friend" with tracked invite links
- **Co-branded landing pages**: `/atlanta-families/partners/atlanta-on-the-cheap` for distribution partners

### Booking Leakage Mitigation

**From bizdev audit**: Parents will discover on ATLittle and book elsewhere. This is acceptable in V1 IF we track it.

- Click-through tracking on all `registration_url` clicks (implemented in FA3 `click_events`)
- UTM parameters on outbound registration links where provider allows
- This data proves ATLittle's referral value to providers, which powers the provider dashboard (FA7)
- **V2 consideration**: Deep-link agreements with booking platforms (ActivityHero, Sawyer) for conversion attribution

---

## Release Sequencing

### MVP (Weeks 1-6)

> A parent can filter activities by age, compare up to 4 side-by-side, save to shortlists, export to calendar, and get deadline alerts. Every listing shows freshness and source. Distribution hooks exist for partner newsletters and SEO.

**Strategy alignment check**: This MVP maps directly to PRD 024's "compare/save/rank/alert path only" mitigation.

| Feature | Effort | Feature Area | PRD 024 Pillar |
|---------|--------|-------------|---------------|
| Age range on profile + age filter | S | 1, 2 | Discovery |
| Search ranking (age + source authority + completeness) | M | 2 | Discovery |
| Compare tray + comparison view (5 dimensions) | L | 3 | Decision Support |
| Click-through attribution tracking | S | 3 | (Monetization foundation) |
| Family shortlists | S | 4 | Planning |
| iCal calendar export | S | 4 | Planning |
| Deadline/registration alerts | M | 4 | Planning |
| Freshness badges + source authority scoring | S | 5 | Trust |
| Registration status field | S | 5 | Trust |
| Source transparency | XS | 5 | Trust |
| Basic cross-source deduplication | S | 5 | Trust |
| P0 crawler gaps (4 new crawlers) | M | 6 | Content |
| Newsletter embed widget | S | 10 | Acquisition |
| SEO landing pages | M | 10 | Acquisition |
| Signup age gate + privacy policy update | XS | COPPA | Compliance |

### V1.5 (Weeks 7-14)

> Full household profiles with onboarding, per-child personalization, co-parent coordination, social features, provider flywheel starts.

| Feature | Effort | Feature Area |
|---------|--------|-------------|
| Full household model + onboarding | M | 1 |
| Co-parent invite + shared access | M | 1 |
| Per-child feed sections ("Adventures for [Nickname]") | M | 2 |
| "Plan for" selector | M | 2 |
| "Good for your family" badge | S | 2 |
| Compare view: +3 dimensions (registration, ratings, friends) | S | 3 |
| Mobile swipeable compare UX | S | 3 |
| Co-parent compare voting | S | 3 |
| Family calendar overlay | M | 4 |
| Co-parent plan sharing | M | 4 |
| Community verification | S | 5 |
| Automated cross-source entity resolution | M | 5 |
| Friends going on cards | S | 9 |
| Parent reviews with tips | M | 9 |
| Dynamic curated collections | M | 8 |
| Claimed listings + provider verification | M | 7 |
| Provider dashboard (basic) | M | 7 |
| Partner integrations + referral | M | 10 |
| P1 crawler sources | L | 6 |

### V2 (Weeks 15-24)

> AI-powered planning, monetization, community depth.

| Feature | Effort | Feature Area |
|---------|--------|-------------|
| AI recommendations | L | 8 |
| Weekend Planner | L | 8 |
| Behavioral ranking tuning | M | 2 |
| Provider visibility tiers + payments | L | 7 |
| School/group affinity (requires legal review) | M | 9 |
| Premium parent subscription | M | 7 |
| P2 crawler sources | M | 6 |

---

## Success Metrics

**North Star**: Weekly Active Planning Families (WAPF) — save/compare/export ≥1 activity/week

### Product Metrics

| Metric | 6-Month Target | 12-Month Target |
|--------|---------------|-----------------|
| WAPF | 200+ | 500+ |
| Compare usage | 15%+ of sessions | 20%+ |
| Save rate | 20%+ per session | 25%+ |
| Calendar export | 10%+ of active users | 15%+ |
| Household creation (V1.5+) | 30%+ of signups | 40%+ |
| Provider claims (V1.5+) | 20+ | 50+ |

### Quality Guardrails (from PRD 024 — were missing in v1)

| Guardrail | Target | Measurement |
|-----------|--------|-------------|
| Stale-item exposure rate | <15% of viewed items are "Stale" or "Unverified" | Freshness badge distribution on viewed events |
| Broken-link rate | <5% | Automated link checking on `registration_url` and source links |
| Duplicate-item rate | <3% | Cross-source entity resolution candidates unmerged |
| Source reliability mix | >60% of top-10 results from Official/Institutional sources | Source authority level on ranked results |
| `min_age`/`max_age` coverage | >60% of family-tagged events | Column population rate |
| Registration status coverage | >30% of family-tagged events ≠ unknown | Field population rate |

### Leading Indicators (from PRD 024)

| Indicator | Target |
|-----------|--------|
| % of viewed items with high freshness (Live or Recent) | >70% |
| % of top-ranked results with complete capability metadata | >50% |
| Onboarding completion rate (V1.5) | >25% |
| Newsletter widget click-through rate | >2% |
| SEO landing page organic sessions/month | 5,000+ by month 6 |

---

## Verification

### MVP Verification

1. **Age filtering**: Set age ranges on profile → verify feed filters to age-appropriate events → verify ranking boosts in search results → verify baseline experience for users without age ranges set
2. **Compare**: Add 2-4 activities to compare tray → open comparison view → verify 5 dimensions render → share comparison link → verify read-only view loads without account
3. **Click tracking**: Click registration URL from compare view → verify `click_events` row created with correct source_view
4. **Shortlists + Export**: Save activity to shortlist → export as iCal → verify .ics file opens in Google Calendar / Apple Calendar
5. **Alerts**: Save activity with `registration_deadline` → verify notification fires when deadline approaches
6. **Freshness**: Verify freshness badges compute correctly from `crawl_logs` → verify source authority gates "Live" badge → verify registration status displays on cards
7. **Deduplication**: Create two events from different sources with same title/venue/date → verify admin tooling surfaces as candidate duplicate
8. **Source transparency**: Verify event detail shows source name + link
9. **Distribution**: Verify newsletter embed widget renders correctly → verify SEO landing pages have correct structured data → verify social share cards render preview
10. **COPPA**: Verify signup age gate appears → verify `needs[]` is on `household_preferences` not `household_members` → verify privacy policy has household data section

### V1.5 Verification

11. **Household flow**: Complete onboarding → verify household appears in DB → add co-parent via invite link → verify shared access
12. **Personalization**: Create household with toddler + elementary child → verify feed shows per-child sections → verify "Plan for" selector changes results
13. **Provider**: Claim a listing → verify email verification → verify analytics dashboard shows view/save/compare/click-through counts

---

## Appendix: Audit Trail

This PRD was revised based on three audits conducted February 2026:

1. **Strategy Audit** (architect review): Identified MVP scope overreach vs PRD 024's guardrails, missing quality guardrails, absent cross-source normalization, undefined non-household UX, and sequencing contradictions with the 90-day plan.

2. **BizDev Audit** (go-to-market review): Identified zero acquisition strategy, unvalidated provider pricing, booking leakage risk, content readiness gaps, optimistic success metrics, and undefined business model identity.

3. **COPPA Compliance Audit**: Identified `needs[]` per-child as highest-risk field, recommended household-level needs storage, flagged `school_affiliation` for legal review, and defined a three-tier compliance approach (design-around → defensive → full compliance).

Key changes from v1:
- MVP scope cut to match PRD 024's "compare/save/rank/alert" path
- Full household model deferred to V1.5; lightweight age profile for MVP
- Calendar overlay deferred to V1.5; iCal export for MVP
- Deadline alerts moved TO MVP (was incorrectly deferred in v1)
- Friends Going deferred to V1.5
- Per-child personalization deferred to V1.5
- Added Feature Area 10 (Acquisition & Distribution)
- Added source authority scoring, completeness scoring, cross-source deduplication
- Added all 4 quality guardrails from PRD 024
- Added click-through attribution tracking
- Added COPPA compliance section with design-around approach
- Added minimum viable content threshold
- Added crawler readiness assessment
- Added provider validation pre-requisite
- Added non-household baseline experience definition
- Adjusted 6-month WAPF target from 500 to 200 (realistic without acquisition budget)
- Added 12-month targets
