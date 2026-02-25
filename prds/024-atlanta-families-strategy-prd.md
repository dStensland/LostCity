# PRD 024: Atlanta Families Portal Strategy

## 1. Document Purpose
Define the big-picture product strategy for `atlanta-families` before deep implementation of any single flow.

## 2. Surface + Portal Contract
- Surface: `consumer` for V1, with light `admin` operations only for internal curation.
- Portal: `atlanta-families` by default, with federated reuse across other family portals later.
- Scope guard: preserve portal attribution/federation contracts and shared data standards.

## 3. Product Vision
Build the most trusted planning layer for families in Atlanta: a place that helps parents discover, compare, and plan kid activities quickly with current, structured, and reliable information.

## 4. Strategy Thesis
Directory-style discovery already exists. The winning position is not "more listings," it is:
- Better decisions (fit by age, budget, schedule, distance).
- Better planning (save, compare, calendar-ready shortlist).
- Better trust (freshness + status verification + source transparency).

## 5. Primary Users
1. Busy parents/caregivers (children ages 0-17) planning weekly and seasonal activities.
2. Grandparents/relatives helping plan outings and school-break activities.
3. Family coordinators (nannies, co-parents, caretakers) optimizing logistics.

## 6. Core Jobs To Be Done
1. "Help me find good options for my kid this weekend/school break."
2. "Help me compare options quickly without opening 20 tabs."
3. "Help me know what is actually available and worth driving to."
4. "Help me keep plans organized for multiple kids."

## 7. V1 Product Pillars
1. Discovery: high-quality activity/event/program inventory beyond summer camps.
2. Decision support: structured comparison by age, time, cost, and proximity.
3. Planning: shortlist, save, compare, and calendar export.
4. Trust: freshness, registration/ticket status, and source reliability.

## 8. Content Coverage Priorities (Non-Healthcare)
1. After-school enrichment (art, STEM, coding, music, theater, chess, language).
2. Youth sports leagues/clinics (year-round).
3. School-break programs (fall/winter/spring + teacher workdays).
4. Ongoing classes by age band.
5. Family events calendars (museums, libraries, parks, festivals, free events).
6. Teen opportunities (volunteer, internships, jobs, pre-college).
7. Kid-friendly places and activity guides (weekend/rainy-day/free).

## 9. Capability Strategy
### 9.1 Foundation (Now)
- Shared capability metadata model in ingestion:
  - registration status
  - age range/band
  - schedule bucket
  - price band
  - freshness tier
  - source reliability
  - completeness/quality score

### 9.2 Productized Capabilities (Next)
1. Compare stack for families.
2. Multi-child preference memory (age, interests, constraints).
3. Ranking model based on fit + freshness + proximity + cost.
4. Deadline/change alerts for saved items.

### 9.3 Federated Reuse
- Keep capability model portal-agnostic so future family portals reuse the same scoring and planning primitives.

## 10. Differentiation vs Competitors
Direct competitors (Atlanta Parent, Mommy Poppins, Kids Out and About, Macaroni KID) are strong on editorial/listings.

`atlanta-families` differentiates on:
1. Structured comparison and planning UX, not just content pages.
2. Freshness/status reliability as a first-class product feature.
3. Family-profile-driven ranking and multi-child planning.
4. Cross-source normalization so decisions are faster and clearer.

## 11. Partner Strategy
Primary partner motions:
1. Distribution partners: Discover Atlanta, Atlanta on the Cheap, community newsletters.
2. Trust partners: museums, schools, parks/library systems for canonical links.
3. Data partners: high-signal aggregators as fallback, never primary truth if official source exists.

## 12. Monetization Hypotheses (Post-MVP)
1. Sponsored placements with strict relevance and labeling.
2. Premium planning utilities for families (advanced alerts, deeper compare, shared family planner).
3. B2B provider analytics/listing upgrades (later, after consumer value is proven).

## 13. Success Metrics
### North Star
- Weekly Active Planning Families (WAPF): families who save/compare/export at least one plan weekly.

### Leading Indicators
1. Save rate per session.
2. Compare usage rate.
3. Calendar export rate.
4. % of viewed items with high freshness.
5. % of top-ranked results with complete capability metadata.

### Quality Guardrails
1. Stale-item exposure rate.
2. Broken-link rate.
3. Duplicate-item rate.
4. Source reliability mix in top results.

## 14. 90-Day Execution Plan
1. Weeks 1-2: finalize schema/contract for planning metadata in read APIs.
2. Weeks 3-5: ship compare + shortlist + basic ranking in `atlanta-families`.
3. Weeks 6-8: add alerts and freshness badges.
4. Weeks 9-12: expand non-camp categories and tune ranking with behavioral signals.

## 15. Explicit Non-Goals (Current Phase)
1. Healthcare/provider deep workflow expansion.
2. Full provider CRM or provider operations platform.
3. Hyper-custom AI concierge interactions before planner fundamentals are stable.

## 16. Key Risks + Mitigations
1. Risk: stale or wrong availability data.
- Mitigation: freshness tiering, source reliability weighting, scheduled re-verification.

2. Risk: feature sprawl before core planning value is proven.
- Mitigation: prioritize compare/save/rank/alert path only.

3. Risk: too much dependence on aggregators.
- Mitigation: official-source preference and confidence penalties for directory-only links.

## 17. Decisions Needed Next
1. V1 priority order between compare UI and alerts.
2. Initial ranking weights (fit vs freshness vs distance vs cost).
3. Family profile model depth for launch (single child vs multi-child).
4. Minimum freshness SLA by category.

## 18. Immediate Follow-Up Artifacts
1. `atlanta-families` V1 IA + core user flow map.
2. Capability-to-API contract doc for web queries.
3. MVP scoring rubric and measurement dashboard spec.
