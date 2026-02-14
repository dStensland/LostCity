# Template 04: Quality Gate Scorecard

## Surface Scope (Required)

- Surface: `consumer` | `admin` | `both`
- If `both`, run separate scorecards for each surface.

## Gate Summary

| Gate | Pass criteria | Status | Evidence |
|---|---|---|---|
| Brand fidelity | Looks native to client brand |  |  |
| Action clarity | Primary next action visible in under 10 seconds |  |  |
| Trust policy integrity | Recommendations comply with source policy and suppression rules |  |  |
| Persona coherence | Persona defaults and priorities behave correctly |  |  |
| Mobile excellence | Critical flows complete comfortably on mobile |  |  |
| Accessibility baseline | Contrast, focus, semantics pass |  |  |
| Security controls | Tenant and policy boundaries enforced |  |  |
| Surface separation | Consumer and admin concerns are not mixed in one UX flow |  |  |

## Blocking Rule

If any critical gate fails, the portal does not progress to demo sign-off.
