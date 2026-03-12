# PRD 030: Volunteer Engagement Capability (Platform + HelpATL Launch)

**Status:** Draft
**Priority:** P1
**Created:** 2026-03-08
**Owner:** Product + Data Platform

---

## 1. Why This Exists

Current volunteer discovery is list-based. Users can find opportunities but conversion and retention are weak because there is no structured fit model, no commitment ladder, and no reliability feedback loop.

We need a platform volunteer capability that supports:
1. Better matching.
2. Faster conversion.
3. Better retention.
4. Better quality signal for operators.

`helpatl` is launch surface; capability should be reusable for nonprofits, neighborhood groups, and future city portals.

---

## 2. Capability Definition

**Volunteer Engagement Capability** = structured opportunity model + matching + lifecycle tracking over existing event infrastructure.

Core outputs:
1. Structured volunteer opportunity cards.
2. Fit-ranked results per user.
3. Fast-apply workflow.
4. Retention/impact metrics (user + portal + organization).

---

## 3. Product Scope

### 3.1 In Scope (v1)

1. **Structured Opportunity Schema**
- Enrich volunteer events with standardized fields.

2. **Volunteer Fit Score v1**
- Rank opportunities using user profile + constraints.

3. **Commitment Ladder UX**
- Segment opportunities by commitment level (`easy start`, `ongoing`, `lead`).

4. **Fast Apply / Express Interest**
- one-click interest with logged user profile.

5. **Urgent Needs Lane**
- dedicated near-term `needs volunteers soon` lane.

6. **Volunteer Impact Ledger v1**
- hours committed/attended (where available), opportunities joined, streak basics.

### 3.2 Out of Scope (v1)

1. Full background-check processing pipeline.
2. Payments/stipend workflows.
3. External volunteer CRM replacement.

---

## 4. User Roles

1. **Volunteer/User**
- discovers matched opportunities.
- expresses interest/commits.
- tracks impact.

2. **Organizer/Admin**
- publishes opportunities with structured requirements.
- manages capacity and urgency.
- reviews reliability and attendance signals.

3. **Portal Operator**
- monitors ecosystem quality and match performance.

---

## 5. Data Model Requirements

### 5.1 Opportunity Extension (event-linked)

Add `volunteer_opportunities` table keyed by `event_id`:
1. `event_id`
2. `organization_id`
3. `role_title`
4. `skills_required[]`
5. `physical_demand` (`low`, `medium`, `high`)
6. `min_age`
7. `language_support[]`
8. `family_friendly` (bool)
9. `group_friendly` (bool)
10. `remote_allowed` (bool)
11. `accessibility_notes`
12. `background_check_required` (bool)
13. `training_required` (bool)
14. `capacity_total`
15. `capacity_remaining`
16. `urgency_level` (`normal`, `urgent`)

### 5.2 Volunteer Profile Signals

Add `user_volunteer_profile`:
1. `causes[]`
2. `skills[]`
3. `availability_windows`
4. `travel_radius_km`
5. `mobility_constraints`
6. `languages[]`

### 5.3 Engagement Events

Add `volunteer_engagements`:
1. `user_id`
2. `event_id`
3. `status` (`interested`, `committed`, `attended`, `cancelled`, `no_show`)
4. `created_at`, `updated_at`

---

## 6. Matching Logic (v1)

`volunteer_fit_score` composed from:
1. Cause match.
2. Skill match.
3. Availability overlap.
4. Distance/travel feasibility.
5. Accessibility compatibility.
6. Commitment preference (one-time vs recurring).

Output reason tags:
1. `Cause match`
2. `Skill match`
3. `Near you`
4. `Urgent need`
5. `Group-friendly`

---

## 7. UX Requirements (HelpATL)

1. **Volunteer Opportunities lane** on Act feed.
2. **Urgent Needs** module (top-priority when urgent opportunities exist).
3. **Commitment Ladder chips** (`Easy Start`, `Ongoing`, `Lead`).
4. **Opportunity detail panel** with requirements + capacity + apply CTA.
5. **My Impact** mini panel (`joined`, `attended`, `hours` when reported).

---

## 8. API Surface

### 8.1 Consumer

1. `GET /api/portals/[slug]/volunteer/opportunities`
- filter + ranking + fit reasons.

2. `POST /api/volunteer/engagements`
- express interest / commit.

3. `PATCH /api/volunteer/engagements/[id]`
- status transitions.

4. `GET /api/me/volunteer-impact`
- user impact ledger.

### 8.2 Admin

1. `POST /api/admin/volunteer/opportunities`
2. `PATCH /api/admin/volunteer/opportunities/[id]`
3. `GET /api/admin/volunteer/quality`
- stale opportunities
- over-capacity mismatches
- zero-apply listings

---

## 9. Rollout Plan

### Phase 0
1. Use existing channel + event pipeline for volunteer topic segmentation.
2. Surface `Volunteer Opportunities` as joined channel experience.

### Phase 1
1. Add structured opportunity schema + admin editing.
2. Ship fit score v1 and urgent lane.
3. Ship express interest flow.

### Phase 2
1. Add attendance + reliability signals.
2. Add commitment ladder personalization.
3. Add team volunteering (invite + grouped commitment).

---

## 10. Success Metrics

1. Opportunity view → express-interest conversion rate.
2. Interest → committed conversion rate.
3. D30 volunteer retention.
4. Fill-rate for urgent opportunities.
5. % opportunities with complete structured metadata.
6. Organizer response latency (interest to confirmation).

---

## 11. Risks + Mitigations

1. **Risk:** low-quality listings reduce trust.
- **Mitigation:** required structured fields + quality scoring + admin alerts.

2. **Risk:** fit scoring biases against newcomers.
- **Mitigation:** include exploratory slots and `easy start` prioritization.

3. **Risk:** manual organizer overhead.
- **Mitigation:** templates and cloneable role patterns.

4. **Risk:** privacy concerns with volunteer profile data.
- **Mitigation:** explicit consent + minimal required fields + clear data retention policy.

---

## 12. Acceptance Criteria (v1)

1. Users can see structured volunteer opportunities with fit reasons.
2. Users can express interest in <=2 clicks from feed card.
3. Urgent opportunities can be filtered and prioritized.
4. Admin can identify stale/low-performing volunteer listings.
5. Core metrics are captured for conversion and retention evaluation.
