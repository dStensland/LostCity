# Template 02: Source and Attribution Contract

## Surface Scope (Required)

- Primary surface: `consumer` | `admin` | `both`
- Consumer display policy:
- Admin visibility policy:
- If `both`, list exact differences:

## Source Tiers

| Tier | Allowed source types | Usage rule | Promotion eligibility |
|---|---|---|---|
| Tier 1 |  |  |  |
| Tier 2 |  |  |  |
| Tier 3 |  |  |  |

## Exclusions

- Competitor organizations:
- Blocked domains:
- Blocked tags/categories:

## Provenance Display Requirements

- Consumer Portal:
  - Keep end-user UI simple; no operator-only provenance fields unless legally or contractually required.
  - If shown, keep to minimal plain-language context.
- Admin Portal:
  - Full source and policy detail for governance and QA.
  - Include freshness and policy status needed for operator decisions.

## Failure Behavior

- If required provenance data is missing: suppress from primary surfacing.
- If policy conflict: suppress and log policy event.
- Never expose internal confidence/scoring mechanics in consumer UI.
