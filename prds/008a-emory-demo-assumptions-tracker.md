# Emory Demo Assumptions Tracker

## Scope
- Portal: `emory-demo`
- Experience: network home + hospital guide pages
- Tracking model: explicit assumptions that require Emory validation; defaults applied for demo continuity

## Network Assumptions
| Key | Status | Impact | Owner | Demo Default |
|---|---|---|---|---|
| `network.service-line-priority` | `needs_validation` | `high` | Emory Marketing + Patient Experience | Urgent support first, then care pathways, then community health |
| `network.public-health-calendar-policy` | `assumed` | `high` | LostCity Strategy | Nonprofit/public-health sources only; competitor systems excluded |
| `network.legal-content-disclaimer` | `needs_validation` | `high` | Emory Legal/Compliance | Informational-only disclaimer near care CTAs and footer |
| `network.gozio-deeplink-contract` | `assumed` | `high` | LostCity Engineering + Gozio | `gozio://search?query=<hospital name>` fallback deeplink |
| `network.gozio-payload-schema` | `assumed` | `high` | LostCity Engineering + Gozio | Hospital + ranked `food/stay/late` wayfinding payload via hospital API |
| `network.analytics-roi-model` | `needs_validation` | `medium` | Emory Digital + LostCity Analytics | Track wayfinding, service CTA, section/action attribution |

## Hospital Assumptions
| Hospital | Key | Status | Impact | Owner | Demo Default |
|---|---|---|---|---|---|
| EUH | `hospital.euh.after-hours-services` | `needs_validation` | `high` | EUH Operations | Show hours as variable, escalate to phone quickly |
| EUH | `hospital.euh.parking-entry-points` | `assumed` | `medium` | EUH Facilities | Visitor deck + main entrance default |
| Midtown | `hospital.midtown.visitor-transit` | `needs_validation` | `medium` | Midtown Campus Ops | Main entrance + nearby transit hints |
| St. Joseph's | `hospital.stj.specialty-journeys` | `needs_validation` | `medium` | St. Joseph's Service Line Leads | Balanced urgent + visitor logistics ordering |
| Johns Creek | `hospital.jc.out-of-town-lodging` | `needs_validation` | `medium` | Johns Creek Ops + Patient Services | Nearest lodging ranked by distance and late-night availability |

## Validation Workflow
1. Confirm owner per assumption.
2. Replace demo default with approved value.
3. Update status (`validated` or `blocked`).
4. Record decision date and source of truth doc.

## Notes
- Assumptions are also seeded in `portal_demo_assumptions` via migration `189`.
- Use this markdown file for stakeholder calls and demo debrief capture.
