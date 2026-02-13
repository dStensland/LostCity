# PRD 015: Emory Community Resource Persona Matrix

## Objective
Define who the Emory white-label portal serves at launch, what each persona should be able to do, and how those experiences map to current platform capabilities without drifting into care coordination.

## Strategic Position
Lost City for Emory is a:
- Community resource layer
- Location intelligence and wayfinding layer
- Trusted source federation layer

It is not:
- Clinical triage
- Care coordination workflow
- Appointment orchestration system
- Medical advice surface
- PHI collection workflow

## Scope Guardrails
In scope:
1. Campus selection, wayfinding handoff, and local logistics.
2. Nearby support discovery: food, lodging, late-hour essentials.
3. Public health and nonprofit resource discovery with visible provenance.
4. Action-first UX: clear next action in under 10 seconds.
5. Portal-scoped analytics and attribution.

Out of scope:
1. Diagnosis, symptom triage, treatment recommendations.
2. Clinical messaging, results, records access.
3. Scheduling workflows beyond linking out to official systems.
4. Any data flow requiring HIPAA-grade PHI handling in this product surface.

## Current Capability Inventory (What We Can Reliably Ship)
1. Intent mode switching (`urgent`, `treatment`, `visitor`, `staff`).
2. Hospital directory and per-hospital companion pages.
3. Wayfinding launch via Gozio deep links and map fallbacks.
4. Ranked nearby options by mode (food/stay/late).
5. Federated source briefing layer with provenance visibility.
6. Competitor exclusion policy messaging.
7. Portal action analytics (`mode_selected`, `wayfinding_opened`, `resource_clicked`).
8. Feed/Find/Community routing for broader discovery.

## Persona Matrix
| Persona | Core Job To Be Done | Must Be Able To Do | What They Can Access | What They Cannot Access | Primary Surfaces |
|---|---|---|---|---|---|
| Visitor / Caregiver | Get to the right place quickly and confidently | Select campus, launch wayfinding, find on-site services, find nearby food/lodging | Hospital directory, hospital companion, federated briefings, source links | Medical advice, care plans, appointment workflow inside Lost City | `/{portal}`, `/{portal}/hospitals`, `/{portal}/hospitals/[hospital]` |
| Out-of-Town Family | Manage multi-day support logistics | Compare campuses, find lodging, find open-now options, save practical next steps | Stay/food/late sections, wayfinding links, nonprofit support tracks | Insurance guidance, discharge planning, clinical instructions | `/{portal}/hospitals/[hospital]`, Find view |
| Patient (non-clinical support) | Handle logistics around treatment visits | Identify right campus, find parking/pharmacy/cafeteria, access external official links | On-site amenities, wayfinding handoff, public health support tracks | Medication decisions, treatment coordination, direct clinical communication | `/{portal}/hospitals/[hospital]` |
| Staff / Shift Worker | Solve time-sensitive practical needs around shifts | Quickly open wayfinding, find late-hour essentials, find low-friction local options | Mode-specific ranking, open-now filters, nearby essentials | Internal HR systems, clinical operations tools, patient data | `/{portal}`, `/{portal}/hospitals/[hospital]` |
| Community Health Seeker | Find prevention and wellness opportunities | Discover screenings, wellness events, food-access resources | Federated briefings, Find results, source-level provenance | Care management or personalized medical protocol | `/{portal}`, `/{portal}?view=find` |
| Nonprofit / Community Partner | Reach relevant audiences with trusted programs | Be surfaced in curated tracks with source attribution | Source-linked visibility in briefing and discovery rails | Editorial control over Emory portal, admin privileges | Find + briefing cards |
| Portal Operator (Emory marketing/innovation) | Prove value and trust to leadership | Track action funnels, validate source trust posture, tune narrative emphasis | Portal analytics, policy messaging, interaction metrics | Self-serve builder for broad portal generation (deferred) | Portal analytics + front-end observation |

## Persona -> Action Model
Each persona should experience:
1. One obvious first action.
2. One reliable fallback action.
3. One community continuation action.

Example:
- Visitor first action: `Book Visit` or `Get Directions`
- Visitor fallback: `Call Main Desk`
- Visitor continuation: `Open in Emory Feed` for vetted community supports

## Persona -> KPI Matrix
| Persona | Leading KPI | Confidence KPI | Outcome KPI |
|---|---|---|---|
| Visitor / Caregiver | Time to first action | Wayfinding click-through rate | Return visit rate (7-day) |
| Out-of-Town Family | Lodging/food support CTR | Open-now interaction rate | Multi-action session completion |
| Patient (non-clinical) | On-site service CTR | Source-link click rate | Companion page completion rate |
| Staff | Late-hour utility CTR | Open-now relevance confirmation rate | Shift-mode repeat usage |
| Community Health Seeker | Public health track CTR | Provenance exposure rate | Resource engagement depth |
| Portal Operator | Funnel completion by mode | Attribution coverage % | Hypothesis pass rate per sprint |

## Surface Prioritization (Launch)
P0:
1. Hospital directory -> hospital companion -> wayfinding flow.
2. Federated briefings with explicit source labels and direct source links.
3. Food/stay/late utility sections with open-now prioritization.
4. Full attribution and action instrumentation.

P1:
1. Save/share lightweight plans for visitors and out-of-town families.
2. Stronger Find presets per mode and persona.
3. Role-tailored onboarding prompt copy.

P2:
1. Personalization refinement from interaction history.
2. Operator-facing persona segment analytics view.

## Copy and UX Rules
1. Use action verbs, not system descriptions.
2. Every panel must contain a concrete action, not only explanation.
3. Show source provenance where decisions are made.
4. Use official-system handoff language when crossing scope boundaries.
5. Never imply clinical guidance.

## Decisions Locked
1. Emory portal positioning is community resource + location guide.
2. Clinical coordination remains explicitly out of scope.
3. Source federation is a trust advantage only if provenance is always visible.
4. "Wayfinding first, then support layers" is the default interaction pattern.
