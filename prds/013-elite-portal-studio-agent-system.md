# PRD-013: Elite Portal Studio Agent System

**Status**: In progress  
**Priority**: P0 (sales-critical demos and launch readiness)  
**Scope**: White-label portal construction for hospital/hotel/city/community verticals

## 1. Objective

Create a repeatable, high-standard multi-agent system that produces:

1. Brand-native, premium visual direction.
2. Domain-specific UX and content curation with strict provenance.
3. Enterprise-grade architecture and security posture.
4. Measurable launch hypotheses tied to ROI and engagement.

This system must support bespoke portal expression while preserving a shared federated platform core.

## 2. Strategy Locks (Non-Negotiable)

1. Strict source attribution is always visible.
2. Public developer API remains iceboxed until post-launch validation.
3. Self-serve admin/generation remains deferred until customer proof is established.
4. Architecture decisions optimize for secure multi-tenant scale.

## 3. Agent Collection

1. Art Direction Agent
2. Domain Expertise Agent
3. Product UX Agent
4. Content Curation Agent
5. Architecture + Scale Agent
6. Security + Privacy Agent
7. Analytics + Hypothesis Agent
8. ROI Storytelling Agent

Each agent has explicit contracts and reason codes so decisions are explainable and auditable.

## 4. Runtime Interface

Endpoint:

- `GET /api/portals/[slug]/studio/orchestrated`

Optional query params:

- `lifecycle=discovery|prototype|pilot|launch`
- `focus=engagement|sales|operations`
- `vertical=hotel|hospital|city|community|film`
- `wayfinding_partner=<name>`
- `exclude_competitors=OrgA,OrgB`

Response includes:

1. Strategy locks.
2. Active agent registry and contracts.
3. Cross-agent blueprint packet:
   - Art direction rules and anti-patterns.
   - Domain journeys and service layers.
   - UX conversion model and required states.
   - Source tiering, exclusions, provenance requirements.
   - Scale architecture planes and controls.
   - Security controls and audit event schema.
   - Hypothesis matrix and dashboard modules.
   - ROI narrative and demo proof points.
4. Weighted scorecard and phased delivery plan.

## 5. Primary Deliverables by Portal

1. Brand-native portal composition spec.
2. Journey map (role-based, mode-aware).
3. Curation policy pack (tiers, exclusions, provenance).
4. Security controls checklist and audit telemetry mapping.
5. Launch hypothesis dashboard spec.
6. Executive proof narrative for sales and procurement.

## 6. Quality Gates

1. Attribution Gate: Every surfaced recommendation has source + trust metadata.
2. Action Clarity Gate: Primary next action appears in <10 seconds.
3. Security Gate: Portal-scoped access checks + audit events for critical actions.
4. Scale Gate: No portal-specific code forks for policy-only differences.
5. Proof Gate: Each major UX decision ties to measurable launch metrics.

## 7. Current Implementation

Implemented:

1. Typed contracts: `web/lib/agents/portal-studio/types.ts`
2. Deterministic orchestrator: `web/lib/agents/portal-studio/orchestrator.ts`
3. API route: `web/app/api/portals/[slug]/studio/orchestrated/route.ts`
4. Unit tests: `web/lib/agents/portal-studio/orchestrator.test.ts`

## 8. Next Iteration

1. Add portal-level policy storage in DB (weights, thresholds, exclusions).
2. Add admin UI panel to compare blueprint scorecards across portals.
3. Connect blueprint outputs to scaffolded page components for rapid demo generation.
4. Expand domain packs (health systems, higher-ed, mixed-use districts, airports).

