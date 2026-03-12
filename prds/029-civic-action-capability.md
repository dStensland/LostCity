# PRD 029: Civic Action Capability (Platform + HelpATL Launch)

**Status:** Draft
**Priority:** P1
**Created:** 2026-03-08
**Owner:** Product + Platform

---

## 1. Why This Exists

Users can discover civic events today, but they still have to do manual work to understand urgency, relevance, and next action.

We need a platform capability that turns civic listings into action workflows:
1. Know what is happening.
2. Know why it matters.
3. Take action quickly.
4. Track impact over time.

`helpatl` is the first consumer surface. The capability must remain reusable across future portals (CVB/government/community verticals).

---

## 2. Capability Definition

**Civic Action Capability** = portal-scoped layer that structures civic opportunities and attaches action context to events.

Core outputs:
1. Civic-first feed modules (`Upcoming Deadlines`, `My Groups`, action rail).
2. Explainability metadata (`Matched`, `Jurisdiction`, `Institution`, `Source`).
3. Action assets (comment links, signup links, submission windows).
4. Outcome instrumentation (joins, actions taken, attendance proxies).

---

## 3. Product Scope

### 3.1 In Scope (v1)

1. **Upcoming Deadlines Module**
- Next 3 high-priority civic items from the feed pipeline.
- Date/time + direct action path.

2. **Civic Reason Layer**
- Portal-aware reason labels for `helpatl`.
- Preserve discovery labels for `atlanta`.

3. **Action Metadata on Event Detail**
- Source link, freshness, deadline window (if applicable), action CTA.

4. **Issue Tracks (Lightweight)**
- Topic-level follow (housing/transit/schools/safety) via channel mappings.

5. **Impact Snapshot v1**
- Weekly counters:
  - matched civic opportunities
  - groups joined
  - new meetings in followed channels

### 3.2 Out of Scope (v1)

1. Full legislative document parsing/summarization.
2. Auto-generated policy recommendations.
3. End-to-end constituent CRM.

---

## 4. User Roles

1. **Resident/User**
- Follows groups/topics.
- Tracks deadlines.
- Clicks through to act.

2. **Portal Operator/Admin**
- Curates channels/rules.
- Monitors stale/empty channels.
- Verifies source quality and action metadata coverage.

---

## 5. Information Architecture (HelpATL)

Primary nav (canonical):
1. `Act`
2. `Calendar`
3. `Groups`

Screen priorities:
1. **Act**: hero + action rail + groups + deadlines + matched lineup.
2. **Calendar**: date/filter-first civic timeline.
3. **Groups**: joined-first channel management.
4. **Event Detail**: source-backed trust + action context.

---

## 6. Data + Schema Requirements

### 6.1 Event Action Context

Add event-level structured metadata (nullable):
1. `action_type` (`attend`, `public_comment`, `signup`, `application`)
2. `action_deadline_at` (timestamp)
3. `action_url`
4. `agenda_url`
5. `source_updated_at`

### 6.2 Channel/Matching Reuse

Build on existing interest-channel stack:
1. `interest_channels`
2. `interest_channel_rules`
3. `user_channel_subscriptions`
4. `event_channel_matches`

No separate civic match table in v1.

### 6.3 Quality Contract

For `jurisdiction`/`institution` channels:
1. `source-backed` required for trust badge.
2. stale threshold warning in admin (example: >72h old for high-frequency feeds).

---

## 7. API Surface

### 7.1 Consumer

1. `GET /api/portals/[slug]/city-pulse`
- include `upcoming_deadlines[]` block.
- include civic reason metadata for events.

2. `GET /api/portals/[slug]/channels`
- include source-backed signal per channel.

3. `GET /api/events/[id]` (or existing detail source)
- expose action context fields.

### 7.2 Admin

1. `GET /api/admin/portals/[id]/channels/quality`
- stale channels
- zero-match channels
- no-source-backed channels (where required)

---

## 8. Rollout Plan

### Phase 0 (Complete/Current)
1. HelpATL provisioning + channels + matching.
2. Hero/action rail and groups strip.
3. Portal nav semantics split (`atlanta` vs `helpatl`).

### Phase 1
1. Upcoming Deadlines: include only items with valid action context or near-term starts.
2. Impact Snapshot card.
3. Event detail trust panel (`source`, `updated`, `action window`).

### Phase 2
1. Issue Tracks UX.
2. Admin Civic Quality rail.
3. Reminder delivery mode (`instant`/`digest`) for civic deadlines.

---

## 9. Success Metrics

1. % of civic feed sessions with at least one action click.
2. Deadline module CTR.
3. % subscribed channels with >=1 matched item in next 14 days.
4. Event detail trust panel interaction rate.
5. D30 retention for users who join >=2 civic groups.

---

## 10. Risks + Mitigations

1. **Risk:** civic noise overwhelms users.
- **Mitigation:** joined-first personalization + issue tracks + relevance scoring.

2. **Risk:** low trust due to thin source metadata.
- **Mitigation:** enforce source-backed badges and freshness display.

3. **Risk:** portal-specific branching grows.
- **Mitigation:** keep capability in shared primitives, gate only copy/priority by portal.

---

## 11. Acceptance Criteria (v1)

1. HelpATL top fold clearly communicates civic intent in <10 seconds.
2. Deadlines module displays valid upcoming items with direct event/action paths.
3. Civic reasons render on cards and match portal semantics.
4. Admin can identify stale/empty civic channels.
5. No portal scope or attribution regressions in existing contract tests.
