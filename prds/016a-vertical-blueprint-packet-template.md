# Vertical Blueprint Packet Template (Repeatable)

Use this for every new vertical or major portal redesign.

## Metadata
- Vertical:
- Portal slug:
- Customer / property:
- Owner:
- Status:
- Priority:
- Date:

## BP-1 Strategy Lock
1. Problem statement
2. Target users and jobs-to-be-done
3. Business hypothesis to prove
4. Non-negotiable constraints
5. Success criteria and launch proof points

Output file:
- `prds/<id>-<vertical>-strategy.md`

## BP-2 Consumer IA
1. Primary routes and purpose of each route
2. Journey map by user type
3. Section hierarchy (what appears first and why)
4. Scope boundaries (what is intentionally excluded)

Output file:
- `prds/<id>-<vertical>-consumer-ia.md`

## BP-3 Design Direction
1. Visual contrast vs existing platform defaults
2. Typography, spacing, motion rules
3. Photography/content style requirements
4. Voice and copybook rules

Output file:
- `prds/<id>-<vertical>-design-direction.md`

## BP-4 Data + Curation Contract
1. Federated data sources
2. Local curation overlays
3. Ranking logic and weighting
4. Freshness/provenance policy
5. Fallback behavior

Output file:
- `prds/<id>-<vertical>-data-contract.md`

## BP-5 Build Map
1. Existing entry routes/components
2. Target route/component architecture
3. State model and URL contract
4. API contracts (reuse or additions)
5. Phase-by-phase build sequencing

Output file:
- `prds/<id>-<vertical>-build-map.md`

## BP-6 Validation Plan
1. UX quality gates
2. Device/browser QA matrix
3. Analytics instrumentation checklist
4. Demo script and scenario tests

Output file:
- `prds/<id>-<vertical>-validation.md`

## Execution Phases (Standard)
1. Blueprint freeze
2. Structural decomposition
3. Consumer flow implementation
4. Visual and copy polish
5. Validation and extraction

## Required Hard Gates
1. Action clarity in <10 seconds
2. Mobile no-horizontal-overflow
3. Guest vs admin control separation
4. Source attribution/freshness integrity
5. Measurable success metrics attached to key UX flows

## Handoff Package
Before launch, ship:
1. Blueprint packet files (BP-1 to BP-6)
2. Change log of implemented routes/components
3. QA report
4. Metrics tracking spec
5. "Next portal reuse" notes
