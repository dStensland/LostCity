# PRD 028: Interest Channels (Platform Capability + Architecture Evaluation)

**Status:** Draft
**Priority:** P1 (Platform capability, Atlanta pilot)
**Created:** 2026-03-07
**Owner:** Product + Data Platform

---

## 1. Why This Exists

We need one abstraction that works across all portals for "follow/join to receive relevant events," not one-off civic logic.

The capability is called **Interest Channels**.

Examples:
- Civic portal: `City of Atlanta`, `Fulton County`, `DeKalb County`, `School Board`
- Hotel portal: `Walkable Morning`, `Family-Friendly`, `Near Convention Center`
- Hospital portal: `Caregiver Support`, `Pediatrics`, `Recovery-Friendly`
- Film portal: `Indie Screenings`, `Community Groups`, `Industry Panels`

This directly supports the north star: shared data infrastructure with bespoke consumer/admin surfaces.

---

## 2. Capability Definition

An **Interest Channel** is a reusable, portal-scoped audience lens that:
1. Defines matching rules over events/entities.
2. Lets users subscribe.
3. Drives feed prioritization and notifications.
4. Can be managed by portal operators in admin.

### 2.1 Channel Types

- `jurisdiction` (city/county/district/government body)
- `institution` (school board, hospital unit, museum network)
- `topic` (volunteer, transit, sustainability, nightlife)
- `community` (neighborhood association, affinity group)
- `intent` (date night, family day, accessible options)

### 2.2 Core Data Model

- `interest_channels`
  - `id`, `portal_id` (nullable for global), `slug`, `name`, `channel_type`, `description`, `is_active`, `sort_order`
- `interest_channel_rules`
  - `id`, `channel_id`, `rule_type`, `rule_payload`, `priority`, `is_active`
  - Rule payload supports selectors like `source_ids`, `organization_ids`, `venue_ids`, `category_ids`, `tags`, optional geo/jurisdiction fields
- `user_channel_subscriptions`
  - `id`, `user_id`, `channel_id`, `portal_id`, `delivery_mode` (`feed_only`, `instant`, `digest`), `digest_frequency`, `created_at`
- `event_channel_matches` (materialized view or denormalized table)
  - `event_id`, `channel_id`, `portal_id`, `match_reasons`, `matched_at`

### 2.3 Surface Contract

- **Consumer Portal**: discover channels, subscribe, see "why shown" badges.
- **Admin Portal**: create/edit channels and rules, monitor coverage, tune channel health.
- This maintains the hard consumer/admin boundary in `/docs/portal-surfaces-contract.md`.

---

## 3. Current-State Architecture Evaluation

## 3.1 Data Architecture

| Area | Current State | Score (1-5) | Evidence | Gap |
|---|---|---:|---|---|
| Portal federation foundation | Strong | 4 | `source_sharing_rules`, `source_subscriptions`, `portal_source_access` are in active use (`web/app/api/admin/portals/[id]/subscriptions/route.ts`) | No user-level channel abstraction on top |
| Follow data model | Partial | 2 | Follow API supports `user/venue/organization` (`web/app/api/follow/route.ts`) | No channel entity or rule layer |
| Follow portal attribution storage | Partial | 3 | `follows.portal_id` added (`supabase/migrations/20260214200000_portal_attribution_columns.sql`) | Follow reads are mostly not portal-scoped |
| Schema/type consistency | Weak | 1 | Generated types for `follows` in `web/lib/supabase/database.types.ts` omit `portal_id` despite migration | Type drift increases regression risk |
| Organization-to-portal mapping | Strong | 4 | `organization_portals` table + triggers (`database/migrations/125_organization_portals_and_triggers.sql`) | Not used as a channel backbone yet |
| Civic source signal richness | Partial | 3 | Meeting crawlers emit civic tags/source metadata | Many civic events lack explicit organization linkage |
| School-board structured coverage | Weak | 1 | No explicit school-board source family in crawler registration | Major gap for target use case |

## 3.2 Portal Product Architecture

| Area | Current State | Score (1-5) | Evidence | Gap |
|---|---|---:|---|---|
| Portal attribution on write paths | Strong | 4 | Shared guard coverage in `web/lib/portal-attribution.test.ts` | Read/query attribution is inconsistent |
| "Following" user experience | Partial | 2 | Events from followed venue/org exist (`web/app/api/events/following/route.ts`) | Not channel-based; no jurisdiction constructs |
| Personalized feed signals | Partial | 3 | Feed and city-pulse read follows (`web/app/api/feed/route.ts`, `web/app/api/portals/[slug]/city-pulse/route.ts`) | Follows queried globally, not by `portal_id` |
| Admin controls for subscriptions | Strong (operator scope) | 4 | Admin portal subscriptions exist (`web/app/api/admin/portals/[id]/subscriptions/route.ts`) | These are source-federation controls, not user subscriptions |
| Notification UX for subscriptions | Weak | 1 | Notifications endpoint is generic read/mark-read (`web/app/api/notifications/route.ts`) | No channel-driven digest/alert model |

## 3.3 Software Architecture

| Area | Current State | Score (1-5) | Evidence | Gap |
|---|---|---:|---|---|
| Shared portal context resolution | Strong | 4 | `web/lib/portal-query-context.ts` | Channel context not integrated |
| Test posture for attribution/scope | Partial-Strong | 4 | `portal-attribution.test.ts`, `portal-scope.test.ts`, `portal-query-context.test.ts` | No tests for channel matching/subscription behavior |
| Query composition for feed reasons | Partial | 3 | Existing reason badges for followed venue/org in following API | No unified reason model (`followed_channel`) |
| Extensibility for cross-vertical use | Partial | 3 | Existing modular APIs and portal-scoped data contracts | Missing generalized semantic subscription primitive |

### 3.4 Summary Assessment

- **Data layer readiness:** 3/5
- **Portal UX readiness:** 2.5/5
- **Backend architecture readiness:** 3.5/5
- **Overall readiness for Interest Channels:** **3/5**

Interpretation: foundation is good enough to ship a phased implementation without risky rewrites, but current follow model is too narrow and query scoping needs hardening.

---

## 4. Key Architecture Decisions

1. **Do not overload `follows` further.**
   - Keep it for social/entity follow compatibility.
   - Add channel tables as first-class platform primitives.

2. **Treat channels as rule-based overlays, not duplicate content stores.**
   - Events remain canonical in `events`.
   - Channel matches are derived.

3. **Enforce portal scoping in both write and read paths.**
   - Existing write guard is good.
   - Must add portal-aware filters for follow/channel reads.

4. **Keep consumer/admin responsibilities separate.**
   - Consumer subscribes and consumes.
   - Admin defines and governs channel rules.

5. **Use Atlanta as pilot data pack, not architecture fork.**
   - Seed Atlanta channels through config/data.
   - No Atlanta-specific code branches.

---

## 5. Rollout Plan (Platform First, Atlanta Activated)

## Phase 0: Architecture Hardening (Prereq)

- Regenerate/update typed schema so `follows.portal_id` is represented in app types.
- Add portal-scoped read helpers for behavioral tables.
- Add a shared query utility for user subscriptions to prevent per-route drift.

**Exit criteria:** no schema/type drift for attribution-critical tables.

## Phase 1: Interest Channel Core

- Add new tables: `interest_channels`, `interest_channel_rules`, `user_channel_subscriptions`.
- Add read/write APIs:
  - `GET /api/portals/[slug]/channels`
  - `POST /api/channels/subscriptions`
  - `DELETE /api/channels/subscriptions/[id]`
- Admin APIs for channel CRUD and rule CRUD.

**Exit criteria:** users can subscribe/unsubscribe to channels; admin can configure channels.

## Phase 2: Matching + Feed Integration

- Implement channel-event matching pipeline (`event_channel_matches`).
- Inject channel reasoning into feed and following endpoints (`reason.type = followed_channel`).
- Add channel chips/filters in consumer experience.

**Exit criteria:** subscribed channels measurably alter ranking and explainability.

## Phase 3: Delivery + Measurement

- Notification modes: instant and digest.
- Add channel performance analytics in admin:
  - subscriptions
  - matched events
  - opens/click-through
  - stale/empty channel warnings

**Exit criteria:** channels drive measurable engagement and have operational observability.

---

## 6. Atlanta Pilot Spec (Data Activation Layer)

Initial seed channels:
1. `atlanta-city-government`
2. `fulton-county-government`
3. `dekalb-county-government`
4. `school-board-watch` (placeholder until school-board sources are integrated)
5. `volunteer-opportunities-atl`

Rule strategy:
- Start with high-confidence selectors: `source_id` for known civic/volunteer sources.
- Add secondary selectors: `tags` (`government`, `public-meeting`, `civic-engagement`, `volunteer`).
- Introduce institution selectors (`organization_id`) where available.

Pilot success metrics:
- `% of civic events matched to >=1 channel`
- `% of channel subscriptions with at least one matched event in 14 days`
- `CTR lift for channel-reasoned feed items vs baseline`
- `notification opt-in rate by channel type`

---

## 7. Evaluation Framework (Use This to Judge Readiness Each Sprint)

## 7.1 Data Quality Checks

- Coverage: upcoming events with at least one channel match.
- Precision: sampled false-positive rate of event-channel matches.
- Freshness: median lag from event ingestion to channel match.
- Integrity: orphan rates where rule selectors point to missing entities.

## 7.2 Portal Experience Checks

- Subscription flow completion rate.
- Feed explainability rate (`why shown` rendered and accurate).
- Channel emptiness rate (channels with no events in next 14 days).
- Cross-portal isolation checks (no unintended channel leakage).

## 7.3 Software Architecture Checks

- Contract tests for channel APIs + portal scoping.
- Regression suite for attribution-critical writes and reads.
- Query performance SLAs for feed with channel joins.
- Observability: metrics/traces for channel matching pipeline.

---

## 8. Risks and Mitigations

- **Risk:** Channel sprawl and low-signal channels.
  - **Mitigation:** admin quality thresholds + stale channel alerts.

- **Risk:** Portal leakage through non-scoped subscription reads.
  - **Mitigation:** centralized portal-scoped query helpers + tests.

- **Risk:** Weak civic coverage for school boards.
  - **Mitigation:** prioritize school-board source onboarding in Atlanta pilot.

- **Risk:** Type drift causes silent runtime issues.
  - **Mitigation:** enforce generated type sync in CI for schema-touching changes.

---

## 9. Immediate Next Actions

1. Approve this capability shape and data model.
2. Execute Phase 0 hardening before building channel APIs.
3. Build Phase 1 behind feature flag `interest_channels_v1`.
4. Seed Atlanta channel definitions and run two-week pilot.
5. Decide Phase 2 scope based on pilot precision + engagement.

