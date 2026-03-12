# Template 06: Provisioning Readiness Gate

Use this before any portal data writes. If any hard gate fails, execution is blocked.

## Run Identity

- Date:
- Operator:
- Portal slug:
- Vertical:
- Environment: `staging` | `production`

## Hard Gates

| Gate | Pass criteria | Status (`pass`/`fail`) | Evidence |
|---|---|---|---|
| G1 Data pack integrity | Every `Live Event Sources` slug is crawlable and active; every `Ongoing Opportunity Sources` slug is active and portal-accessible |  |  |
| G2 Seed/rule integrity | Every channel rule selector resolves to live entities (source/tag/org/venue/category) |  |  |
| G3 Process idempotency | Provisioning plan supports safe re-run with no duplicate side effects |  |  |
| G4 Federation integrity | `source_subscriptions` (`Live Event Sources`), `structured_opportunity_sources` (`Ongoing Opportunity Sources`), and `portal_source_access` resolve expected source access |  |  |
| G5 Match readiness | Channels have active rules and match materialization path is configured |  |  |
| G6 Surface readiness | Consumer and admin flows are both accessible and contract-correct |  |  |
| G7 Observability readiness | Health + analytics endpoints/events are available for post-launch monitoring |  |  |

## Soft Gates

| Gate | Target | Status | Evidence |
|---|---|---|---|
| S1 Launch content density | >= 20 upcoming events across top channels in next 14 days |  |  |
| S2 Channel coverage | >= 70% of scoped events match >=1 channel |  |  |
| S3 Empty subscribed channel risk | 0 channels with subscribers and 0 matches |  |  |
| S4 School-board/county coverage | Dedicated sources integrated (no tag-only fallback) |  |  |

## Go/No-Go Decision

- Decision: `go` | `no-go`
- Blocking failures:
- Mitigations and owners:
- Earliest next review date:
