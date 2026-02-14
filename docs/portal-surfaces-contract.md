# Portal Surfaces Contract

## Purpose
This contract prevents product and architecture drift by defining two separate products that share infrastructure but do not share UX intent.

## Two Products (Always)

### 1) Consumer Portal
Audience: end users of the vertical experience.
- Hospital: patients, caregivers, visitors, staff (consumer-facing context)
- Hotel: guests, concierge-assisted guests
- Film: filmmakers, moviegoers, community members
- City/Community: residents and visitors

Intent: help people complete real-world tasks quickly.
- Discover
- Decide
- Act

Allowed UX characteristics:
- Simple language
- Action-first hierarchy
- Minimal cognitive load
- No operator/configuration framing

### 2) Admin Portal
Audience: operators, content managers, client teams, internal teams.

Intent: manage content, operations, governance, and business reporting.
- Content curation and moderation
- Source/network management
- Portal configuration and publishing
- Analytics and reporting

Allowed UX characteristics:
- Operational controls
- Configuration depth
- Workflow/status visibility
- Management and reporting tools

## Hard Boundary Rules
1. Consumer and Admin are separate surfaces, not modes of the same screen.
2. Consumer UI must not expose admin concepts (configuration, orchestration, management, analytics dashboards).
3. Admin UI must not constrain itself to consumer simplicity when operational depth is needed.
4. Shared data/services are allowed; shared UX intent is not.
5. Every feature proposal must declare target surface explicitly: `consumer`, `admin`, or `both`.
6. If `both`, define distinct UX and acceptance criteria for each surface.

## Route and Naming Guidance
- Treat consumer routes and admin routes as separate product namespaces.
- Use explicit language in docs and PRDs:
  - Say `Consumer Portal` (not just "portal")
  - Say `Admin Portal` (not just "dashboard" or "admin")

## Acceptance Gate (Required in PRDs / plans)
A change is not ready for implementation until it answers:
1. Which surface is this for?
2. What user job does it serve on that surface?
3. What must be explicitly excluded from that surface?
4. What are the acceptance criteria for that surface only?

## Example: Emory
- Consumer Portal: hospital logistics + community support for patients/caregivers/visitors.
- Admin Portal: content governance, source operations, campaign controls, and reporting.
- Non-goal: showing admin analytics/provenance complexity in the consumer surface.
