# PRD-007: Experience Compiler for AI-Generated Customer Portals

**Status**: Draft  
**Priority**: P0  
**Strategic Alignment**: Federated backbone + radically differentiated customer frontends

## 1. Objective

Support a strategy where each new customer gets a custom AI-generated portal/feed experience while still operating on LostCity's shared content network and federation model.

## 2. Problem

Current onboarding uses static templates and manual step-by-step configuration. This does not scale to:

- fast creation of distinct premium portal experiences,
- consistent quality across customers,
- repeatable mapping from AI intent to safe platform configuration.

## 3. Solution: Experience Compiler

Introduce an **Experience Compiler** layer that converts an AI (or operator) spec into deterministic portal configuration:

- `filters` (audience/location/category scope)
- `branding` (visual preset + overrides)
- `settings` (vertical/feed/nav behavior)
- `sections` (ordered portal section configuration)

The compiler acts as a contract between generative orchestration and production portal infrastructure.

## 4. API Contract

New endpoint:

- `POST /api/admin/portals/[id]/experience`

Modes:

- **Dry run** (default): compile spec and return output + warnings, no DB writes
- **Apply** (`apply: true`): persist compiled portal updates and optionally sync sections

Section sync controls:

- `sync_sections` (default `true`)
- `replace_sections` (default `true`)

## 5. Federation Alignment

Spec supports federation metadata:

- `federation.parent_portal_id`
- `federation.source_portal_slug`
- `federation.subscribe_shared_sources`

This keeps customer portals visually custom but operationally connected to shared source infrastructure.

## 6. Guardrails

- strict input validation and normalization
- deterministic defaults via vertical templates
- safe slug generation + duplicate handling for sections
- warnings surfaced for ambiguous config (example: auto sections without filters)

## 7. Non-Goals

- runtime LLM orchestration in this phase
- autonomous copywriting/image generation in this endpoint
- billing or plan entitlement mutation

## 8. Rollout Plan

1. Integrate compiler endpoint into onboarding/admin workflows.
2. Add AI orchestration that generates `ExperienceSpec` per customer.
3. Add approval UX (preview diff + apply) before launch.
4. Track outcomes (time-to-launch, section engagement, conversion to active portals).
