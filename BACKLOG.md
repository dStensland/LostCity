# LostCity Product Roadmap

Active initiatives, reprioritized for launch proof and sales readiness.

---

## Current Operating Decision (2026-02-11)

1. **Non-negotiable:** strict portal attribution everywhere (events, preferences, activities, enrichments, analytics).
2. **Launch focus:** increase Atlanta usage and quality to validate the core hypothesis.
3. **Sales focus:** ship high-quality vertical demos (FORTH first, then 1-2 additional demo verticals).
4. **Defer:** self-serve portal creation/admin expansion until real customers require it.
5. **Icebox:** Public Developer API until after launch traction.

---

## Tier 0: Attribution + Data Integrity (Do First)

### 0.1 Strict Portal Attribution Hardening
- [ ] Add `portal_id` attribution to all user activity writes that feed personalization and analytics (`activities`, inferred preference signals, recommendation signals).
- [ ] Ensure onboarding and behavioral signal ingestion write `inferred_preferences.portal_id` when in a portal context.
- [ ] Enforce attribution guardrails in DB (constraints/triggers where possible, plus app-level validation where not).
- [ ] Add attribution lineage for global enrichments (`contributed_by_portal_id`, `enrichment_source`) across tags/claims flows.
- [ ] Add attribution audit checks (daily report: rows with missing/invalid portal attribution by table).

### 0.2 Data Quality as Sales Readiness
- [ ] Run `python data_health.py` weekly and track trendline.
- [ ] Identify and fix/disable top 20 degraded crawlers.
- [ ] Enforce field coverage targets for events and venues (time, description, image, geo, tags).
- [ ] Add quality gates for demo-critical sources used in Atlanta + FORTH experiences.

---

## Tier 1: Launch Proof (Atlanta + Demos)

### 1.1 Atlanta Usage Engine (Primary Product Surface)
- [ ] Tighten Atlanta feed quality: ranking, dedupe quality, dead-content suppression, stronger "tonight/weekend" relevance.
- [ ] Improve conversion loops: RSVP/save/follow flows, recommendation visibility, clearer "For You" value.
- [ ] Strengthen Atlanta analytics for sales proof: growth, retention proxies, engagement depth.
- [ ] Resolve rough edges on core event/venue UX and mobile responsiveness.

### 1.2 FORTH Hotel Demo (In Development)
- [ ] Finish FORTH-specific concierge experience polish (tonight picks, neighborhood blocks, concierge CTA, specials context).
- [ ] Verify attribution behavior in FORTH end-to-end (views/signals/preferences tied to portal context).
- [ ] Produce demo-ready storyline and QA checklist for live sales walkthroughs.

### 1.3 Next Demo Verticals (Suggested)
- [ ] **Film Festival Demo:** schedule-first UX, screening/venue-aware discovery, series/program framing.
- [ ] **Hospital Visitor Demo:** proximity + time-aware + accessibility-first recommendations.
- [ ] Build as curated demo experiences (not self-serve productization yet).

### 1.4 Venue Specials / Time-Boxed Content
- [ ] Finalize `venue_specials` model and API integration for concierge-style discovery ("happy hour now", exhibits, recurring deals).
- [ ] Add targeted crawler patterns for specials/exhibits from high-impact Atlanta sources.
- [ ] Surface specials in Atlanta and hotel demo feeds.

---

## Tier 2: Scale Foundations (Before Broad Customer Rollout)

### 2.1 Architecture for Scale (Without Premature Self-Serve)
- [ ] Standardize portal-aware query patterns across feeds/search/recommendation paths.
- [ ] Improve indexing and query performance for portal-scoped reads/writes.
- [ ] Expand API route tests for attribution invariants and portal isolation behavior.
- [ ] Add operational dashboards for source health + attribution health + portal engagement.

### 2.2 Portal Operations (Internal-first)
- [ ] Keep portal creation/admin workflows internal/operator-led for now.
- [ ] Improve only the minimum admin capabilities needed to support active demos and first customers.
- [ ] Postpone broad UX polish for portal onboarding/self-serve until customer pull is clear.

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

---

## Tier 4: Iceboxed Until After Launch

### 4.1 Public Developer API
- `withApiKey()` middleware for general product endpoints
- Public `/api/v1/*` surface
- OpenAPI docs + developer portal
- External partner programs

### 4.2 Broader Platform Surfaces
- Embeddable widget productization
- Multi-city expansion at scale
- Long-tail vertical templates beyond active sales priorities

### 4.3 Religious Venue Service Times
- Add `service_times` JSON field on venues (weekly schedule like `hours`): `{"sunday": ["09:00", "11:00"], "friday": ["13:00"]}`
- Enrichment pass: scrape/LLM-extract service schedules from religious venue websites
- Surface in Spots view — "Services Today" filter, "Next service: Sunday 11am" on venue cards
- Venue detail page shows full weekly service schedule alongside hours
- Works naturally with concierge portals (same pattern as happy hours on venue pages)
- Covers church, temple, mosque, synagogue, monastery venue types + denomination vibes

### 4.4 Social Layer: Profiles, Friend Finder, Check-ins
A connected set of features for helping people find likeminded people and share what they're up to. **All features require privacy controls** — users must control what's public, friends-only, or private.

- **Influencer / Curator profiles:** Users who want to share their taste can curate public lists, "what I'm going to this week", favorite spots. Think local tastemaker, not celebrity. Profile as a discovery surface.
- **Friend finder:** Match people by overlapping interests, favorite venues, event attendance patterns. "People who like the same stuff as you." Opt-in discovery — only visible if you want to be found.
- **Following people:** Re-introduce follow model (was in app previously, removed). Follow curators or friends to see their activity in your feed. Privacy-gated: users choose what followers can see.
- **Destination check-ins:** Check in to a venue as a hangout. Visibility levels: private (just tracking for yourself), friends-only ("I'm at Mary's"), or public/open ("I'm here and open to meeting people"). Solves the "I'm at a bar alone and want company" use case.
- **Privacy controls (prerequisite):** Granular visibility settings across all social features. Some of this infra may already exist. Audit existing privacy model before building.

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
